'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import SaveReportDialog from '@/components/SaveReportDialog';
import Sidebar from '@/components/Sidebar';
import { autoTable } from 'jspdf-autotable'

import {
  Calculator as CalculatorIcon,
  Plus,
  Trash2,
  Download,
  FileSpreadsheet,
  Save,
  Info,
  Calendar
} from 'lucide-react';

export default function Calculator({ currentReport, onReportSaved }) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalTaxRate, setGlobalTaxRate] = useState(1.00);
  const [defaultPayoneerFee, setDefaultPayoneerFee] = useState(2.00);
  const [sources, setSources] = useState([createEmptySource()]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentReportId, setCurrentReportId] = useState(null);
  const [reports, setReports] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuth();
    loadReports();
  }, []);

  useEffect(() => {
    if (currentReport) {
      loadReportData(currentReport);
    }
  }, [currentReport]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const loadReports = async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const loadReportData = (reportData) => {
    const { report, sources: reportSources } = reportData;

    setCurrentReportId(report.id);
    setReportDate(report.report_date);
    setGlobalTaxRate(report.global_tax_rate);
    setDefaultPayoneerFee(report.default_payoneer_fee);

    const loadedSources = reportSources.map(source => ({
      sourceType: source.source_type,
      date: source.source_date,
      grossAmount: source.gross_amount,
      miscFee: source.misc_fee,
      taxRate: source.tax_rate,
      payoneerFee: source.payoneer_fee,
      conversionRate: source.conversion_rate
    }));

    setSources(loadedSources.length > 0 ? loadedSources : [createEmptySource()]);

    // Trigger calculation
    setTimeout(() => {
      handleCalculate();
    }, 100);
  };

  const handleLoadReport = async (reportId) => {
    try {
      const response = await fetch(`/api/reports/${reportId}`);
      if (response.ok) {
        const data = await response.json();
        loadReportData(data);
      } else {
        setError('Failed to load report');
      }
    } catch (error) {
      setError('Network error loading report');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadReports();
        if (currentReportId === reportId) {
          handleNewReport();
        }
      } else {
        setError('Failed to delete report');
      }
    } catch (error) {
      setError('Network error deleting report');
    }
  };

  const handleNewReport = () => {
    setCurrentReportId(null);
    setReportDate(new Date().toISOString().split('T')[0]);
    setGlobalTaxRate(1.00);
    setDefaultPayoneerFee(2.00);
    setSources([createEmptySource()]);
    setResults(null);
    setError('');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  function createEmptySource() {
    return {
      sourceType: 'Direct',
      date: new Date().toISOString().split('T')[0],
      grossAmount: '',
      miscFee: '',
      taxRate: '',
      payoneerFee: defaultPayoneerFee,
      conversionRate: ''
    };
  }

  const addSource = () => {
    setSources([...sources, createEmptySource()]);
  };

  const removeSource = (index) => {
    if (sources.length > 1) {
      setSources(sources.filter((_, i) => i !== index));
    }
  };

  const updateSource = (index, field, value) => {
    const newSources = [...sources];
    newSources[index] = { ...newSources[index], [field]: value };

    // Auto-set Payoneer fee for new Fiverr sources
    if (field === 'sourceType' && value === 'Fiverr' && !newSources[index].payoneerFee) {
      newSources[index].payoneerFee = defaultPayoneerFee;
    }

    setSources(newSources);
  };

  const handleCalculate = () => {
    setError('');

    const calculatedSources = [];
    let totalGross = 0;
    let totalMiscFee = 0;
    let totalTax = 0;
    let totalNet = 0;
    let subtotalReceivable = 0;
    let hasErrors = false;

    sources.forEach((source, index) => {
      const grossAmount = parseFloat(source.grossAmount) || 0;
      const miscFee = parseFloat(source.miscFee) || 0;
      const taxRate = parseFloat(source.taxRate) || 0;
      const payoneerFee = parseFloat(source.payoneerFee) || 0;
      const conversionRate = parseFloat(source.conversionRate) || 0;

      if (grossAmount <= 0) {
        setError(`Source #${index + 1} has invalid Gross Amount`);
        hasErrors = true;
        return;
      }

      if (source.sourceType === 'Fiverr' && conversionRate <= 0) {
        setError(`Fiverr source #${index + 1} requires a valid Conversion Rate`);
        hasErrors = true;
        return;
      }

      let fiverrFee = 0;
      let remainingUSD = 0;
      let converted = 0;
      let net = 0;
      let taxAmount = 0;
      let finalAmount = 0;
      let receivable = 0;
      let percentOfGross = 0;
      let grossInPKR = 0;

      if (source.sourceType === 'Direct') {
        net = grossAmount - miscFee;
        taxAmount = net * (taxRate / 100);
        finalAmount = net - taxAmount;
        receivable = finalAmount * 0.6;
        percentOfGross = (receivable / grossAmount) * 100;
        grossInPKR = grossAmount;
      } else {
        fiverrFee = grossAmount * 0.2;
        remainingUSD = grossAmount - fiverrFee - payoneerFee;
        converted = remainingUSD * conversionRate;
        net = converted - miscFee;
        taxAmount = net * (taxRate / 100);
        finalAmount = net - taxAmount;
        receivable = finalAmount * 0.6;
        percentOfGross = (receivable / (remainingUSD * conversionRate)) * 100;
        grossInPKR = grossAmount * conversionRate;
      }

      calculatedSources.push({
        ...source,
        fiverrFee,
        payoneerFee,
        conversionRate,
        miscFee,
        taxRate,
        taxAmount,
        net,
        receivable,
        percentOfGross,
        grossInPKR
      });

      totalGross += grossInPKR;
      totalMiscFee += miscFee;
      totalTax += taxAmount;
      totalNet += net;
      subtotalReceivable += receivable;
    });

    if (hasErrors) return;

    const globalTaxAmount = subtotalReceivable * (globalTaxRate / 100);
    const grandTotalReceivable = subtotalReceivable - globalTaxAmount;

    setResults({
      sources: calculatedSources,
      totals: {
        totalGross,
        totalMiscFee,
        totalTax,
        totalNet,
        subtotalReceivable,
        globalTaxAmount,
        grandTotalReceivable
      }
    });
  };

  const formatNumber = (num) => {
    if (isNaN(num) || num === null) return '0.00';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSaveReport = async (title) => {
    if (!results) {
      setError('Please calculate results before saving');
      return;
    }

    try {
      const url = currentReportId ? `/api/reports/${currentReportId}` : '/api/reports';
      const method = currentReportId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          reportDate,
          globalTaxRate,
          defaultPayoneerFee,
          sources: results.sources,
          totals: results.totals
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (!currentReportId) {
          setCurrentReportId(data.reportId);
        }
        loadReports();
        setShowSaveDialog(false);
        onReportSaved?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save report');
      }
    } catch (error) {
      setError('Network error saving report');
    }
  };

  const exportToPDF = () => {
    if (!results) return;

    // Dynamic import for client-side only
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const reportDateFormatted = formatDate(reportDate);
      doc.setFontSize(18);
      doc.setTextColor(66, 96, 238);
      doc.text(`Earnings Report as of ${reportDateFormatted}`, 10, 15);

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("With Tax Deduction from Final Amount", 10, 24);

      const tableData = results.sources.map(source => [
        formatDate(source.date),
        source.sourceType,
        source.sourceType === 'Direct' ? `PKR ${formatNumber(source.grossAmount)}` : `$${formatNumber(source.grossAmount)} USD`,
        source.sourceType === 'Fiverr' ? `$${formatNumber(source.fiverrFee)}` : '—',
        source.sourceType === 'Fiverr' ? `$${formatNumber(source.payoneerFee)}` : '—',
        source.sourceType === 'Fiverr' ? formatNumber(source.conversionRate) : '—',
        `PKR ${formatNumber(source.miscFee)}`,
        `${formatNumber(source.taxRate)}%`,
        `PKR ${formatNumber(source.taxAmount)}`,
        `PKR ${formatNumber(source.net)}`,
        `PKR ${formatNumber(source.receivable)}`,
        `${formatNumber(source.percentOfGross)}%`
      ]);

      const headers = [
        "Date", "Source", "Gross Amount", "Fiverr Fee",
        "Payoneer Fee", "Conversion Rate", "Misc Fee (PKR)",
        "Tax Rate", "Tax Amount (PKR)", "Net (PKR)",
        "Receivable (PKR)", "% of Gross"
      ];

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 40,
        margin: { top: 10, right: 8, bottom: 10, left: 8 },
        theme: 'grid',
        headStyles: {
          fillColor: [67, 97, 238],
          textColor: [255, 255, 255],
          fontSize: 9
        },
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 15 },
          2: { cellWidth: 22 },
          3: { cellWidth: 15 },
          4: { cellWidth: 18 },
          5: { cellWidth: 18 },
          6: { cellWidth: 18 },
          7: { cellWidth: 15 },
          8: { cellWidth: 18 },
          9: { cellWidth: 18 },
          10: { cellWidth: 22 },
          11: { cellWidth: 15 }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(13);
      doc.setTextColor(66, 96, 238);
      doc.text("Summary", 10, finalY);

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Subtotal Receivable: PKR ${formatNumber(results.totals.subtotalReceivable)}`, 10, finalY + 8);
      doc.text(`Global Tax (${globalTaxRate}%): PKR ${formatNumber(results.totals.globalTaxAmount)}`, 10, finalY + 16);
      doc.setFontSize(14);
      doc.setTextColor(40, 167, 69);
      doc.text(`Grand Receivable Total: PKR ${formatNumber(results.totals.grandTotalReceivable)}`, 10, finalY + 26);

      doc.save(`Earnings_Report_${reportDate}.pdf`);
    });
  };

  const exportToExcel = () => {
    if (!results) return;

    // Dynamic import for client-side only
    import('xlsx').then((XLSX) => {
      const wsData = [
        // Headers
        [
          "Date", "Source", "Gross Amount", "Fiverr Fee",
          "Payoneer Fee", "Conversion Rate", "Misc Fee (PKR)",
          "Tax Rate", "Tax Amount (PKR)", "Net (PKR)",
          "Receivable (PKR)", "% of Gross"
        ],
        // Data rows
        ...results.sources.map(source => [
          formatDate(source.date),
          source.sourceType,
          source.sourceType === 'Direct' ? `PKR ${formatNumber(source.grossAmount)}` : `$${formatNumber(source.grossAmount)} USD`,
          source.sourceType === 'Fiverr' ? `$${formatNumber(source.fiverrFee)}` : '—',
          source.sourceType === 'Fiverr' ? `$${formatNumber(source.payoneerFee)}` : '—',
          source.sourceType === 'Fiverr' ? formatNumber(source.conversionRate) : '—',
          `PKR ${formatNumber(source.miscFee)}`,
          `${formatNumber(source.taxRate)}%`,
          `PKR ${formatNumber(source.taxAmount)}`,
          `PKR ${formatNumber(source.net)}`,
          `PKR ${formatNumber(source.receivable)}`,
          `${formatNumber(source.percentOfGross)}%`
        ]),
        // Totals
        [
          "Subtotal", "", `PKR ${formatNumber(results.totals.totalGross)}`, "—", "—", "—",
          `PKR ${formatNumber(results.totals.totalMiscFee)}`, "—",
          `PKR ${formatNumber(results.totals.totalTax)}`,
          `PKR ${formatNumber(results.totals.totalNet)}`,
          `PKR ${formatNumber(results.totals.subtotalReceivable)}`, "—"
        ],
        [
          `Global Tax (${globalTaxRate}%)`, "", "", "", "", "", "", "", "", "",
          `PKR ${formatNumber(results.totals.globalTaxAmount)}`, "—"
        ],
        [
          "Grand Receivable Total", "", "", "", "", "", "", "", "", "",
          `PKR ${formatNumber(results.totals.grandTotalReceivable)}`, "—"
        ]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Earnings Report");

      const colWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }
      ];
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `Earnings_Report_${reportDate}.xlsx`);
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={handleLogout}
        currentReportId={currentReportId}
        onLoadReport={handleLoadReport}
        onDeleteReport={handleDeleteReport}
        onNewReport={handleNewReport}
      /> */}

      <main className={`flex overflow-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : ''
        }`}>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <CalculatorIcon className="mr-3 h-8 w-8 text-blue-600" />
                  Earnings Calculator
                </h1>
                <p className="text-gray-600 mt-1">Calculate receivables with tax deduction</p>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="reportDate" className="text-sm font-medium">Report Date:</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reportDate"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="pl-10 w-40"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Global Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="mr-2 h-5 w-5" />
                Global Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="globalTaxRate">Global Tax Rate (%)</Label>
                  <Input
                    id="globalTaxRate"
                    type="number"
                    step="0.01"
                    value={globalTaxRate}
                    onChange={(e) => setGlobalTaxRate(parseFloat(e.target.value) || 0)}
                    placeholder="Global Tax Rate"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This tax will be applied to the total receivable amount
                  </p>
                </div>
                <div>
                  <Label htmlFor="defaultPayoneerFee">Default Payoneer Fee (USD)</Label>
                  <Input
                    id="defaultPayoneerFee"
                    type="number"
                    step="0.01"
                    value={defaultPayoneerFee}
                    onChange={(e) => setDefaultPayoneerFee(parseFloat(e.target.value) || 0)}
                    placeholder="Payoneer Fee"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Default value for new Fiverr sources
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculation Formulas */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800">Calculation Formulas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h6 className="font-semibold text-blue-800 mb-2">Direct Source:</h6>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• <strong>Net</strong> = Gross − Misc Fee</li>
                    <li>• <strong>Tax</strong> = Tax Rate % of Net</li>
                    <li>• <strong>Final Amount</strong> = Net − Tax</li>
                    <li>• <strong>Receivable</strong> = 60% of Final Amount</li>
                    <li>• <strong>% of Gross</strong> = (Receivable ÷ Gross) × 100</li>
                  </ul>
                </div>
                <div>
                  <h6 className="font-semibold text-green-800 mb-2">Fiverr Source:</h6>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• <strong>Fiverr Fee</strong> = 20% of Gross (USD)</li>
                    <li>• <strong>Remaining</strong> = Gross − Fiverr Fee − Payoneer Fee</li>
                    <li>• <strong>Converted</strong> = Remaining × Conversion Rate (to PKR)</li>
                    <li>• <strong>Net</strong> = Converted − Misc Fee</li>
                    <li>• <strong>Tax</strong> = Tax Rate % of Net</li>
                    <li>• <strong>Final Amount</strong> = Net − Tax</li>
                    <li>• <strong>Receivable</strong> = 60% of Final Amount</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sources Form */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Earnings Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sources.map((source, index) => (
                  <div key={index} className="relative p-4 border rounded-lg bg-white">
                    {sources.length > 1 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => removeSource(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div>
                        <Label>Source Type</Label>
                        <Select
                          value={source.sourceType}
                          onValueChange={(value) => updateSource(index, 'sourceType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Direct">Direct</SelectItem>
                            <SelectItem value="Fiverr">Fiverr</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={source.date}
                          onChange={(e) => updateSource(index, 'date', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Gross Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={source.grossAmount}
                          onChange={(e) => updateSource(index, 'grossAmount', e.target.value)}
                          placeholder="Amount"
                        />
                      </div>

                      {source.sourceType === 'Fiverr' && (
                        <>
                          <div>
                            <Label>Conversion Rate</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={source.conversionRate}
                              onChange={(e) => updateSource(index, 'conversionRate', e.target.value)}
                              placeholder="PKR/USD"
                            />
                          </div>

                          <div>
                            <Label>Payoneer Fee (USD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={source.payoneerFee}
                              onChange={(e) => updateSource(index, 'payoneerFee', e.target.value)}
                              placeholder="Payoneer Fee"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <Label>Misc Fee (PKR)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={source.miscFee}
                          onChange={(e) => updateSource(index, 'miscFee', e.target.value)}
                          placeholder="Misc Fee"
                        />
                      </div>

                      <div>
                        <Label>Tax Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={source.taxRate}
                          onChange={(e) => updateSource(index, 'taxRate', e.target.value)}
                          placeholder="Tax Rate"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-center">
                  <Button variant="outline" onClick={addSource}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Source
                  </Button>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button onClick={handleCalculate} className="bg-blue-600 hover:bg-blue-700">
                    <CalculatorIcon className="mr-2 h-4 w-4" />
                    Calculate Earnings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          {results && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>
                    Earnings Report as of {formatDate(reportDate)}
                  </CardTitle>
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                      <Save className="mr-2 h-4 w-4" />
                      {currentReportId ? 'Update Report' : 'Save Report'}
                    </Button>
                    <Button variant="outline" onClick={exportToExcel}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Excel
                    </Button>
                    <Button variant="outline" onClick={exportToPDF}>
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="border border-gray-300 p-2 text-left">Date</th>
                        <th className="border border-gray-300 p-2 text-left">Source</th>
                        <th className="border border-gray-300 p-2 text-right">Gross Amount</th>
                        <th className="border border-gray-300 p-2 text-right">Fiverr Fee</th>
                        <th className="border border-gray-300 p-2 text-right">Payoneer Fee</th>
                        <th className="border border-gray-300 p-2 text-right">Conversion Rate</th>
                        <th className="border border-gray-300 p-2 text-right">Misc Fee (PKR)</th>
                        <th className="border border-gray-300 p-2 text-right">Tax Rate</th>
                        <th className="border border-gray-300 p-2 text-right">Tax Amount (PKR)</th>
                        <th className="border border-gray-300 p-2 text-right">Net (PKR)</th>
                        <th className="border border-gray-300 p-2 text-right">Receivable (PKR)</th>
                        <th className="border border-gray-300 p-2 text-right">% of Gross</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.sources.map((source, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 p-2">
                            <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              {formatDate(source.date)}
                            </span>
                          </td>
                          <td className="border border-gray-300 p-2">{source.sourceType}</td>
                          <td className="border border-gray-300 p-2 text-right">
                            {source.sourceType === 'Direct'
                              ? `PKR ${formatNumber(source.grossAmount)}`
                              : `$${formatNumber(source.grossAmount)} USD`
                            }
                          </td>
                          <td className="border border-gray-300 p-2 text-right">
                            {source.sourceType === 'Fiverr' ? `$${formatNumber(source.fiverrFee)}` : '—'}
                          </td>
                          <td className="border border-gray-300 p-2 text-right">
                            {source.sourceType === 'Fiverr' ? `$${formatNumber(source.payoneerFee)}` : '—'}
                          </td>
                          <td className="border border-gray-300 p-2 text-right">
                            {source.sourceType === 'Fiverr' ? formatNumber(source.conversionRate) : '—'}
                          </td>
                          <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(source.miscFee)}</td>
                          <td className="border border-gray-300 p-2 text-right">{formatNumber(source.taxRate)}%</td>
                          <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(source.taxAmount)}</td>
                          <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(source.net)}</td>
                          <td className="border border-gray-300 p-2 text-right font-semibold">PKR {formatNumber(source.receivable)}</td>
                          <td className="border border-gray-300 p-2 text-right">{formatNumber(source.percentOfGross)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td className="border border-gray-300 p-2" colSpan="2">Subtotal</td>
                        <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(results.totals.totalGross)}</td>
                        <td className="border border-gray-300 p-2 text-right">—</td>
                        <td className="border border-gray-300 p-2 text-right">—</td>
                        <td className="border border-gray-300 p-2 text-right">—</td>
                        <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(results.totals.totalMiscFee)}</td>
                        <td className="border border-gray-300 p-2 text-right">—</td>
                        <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(results.totals.totalTax)}</td>
                        <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(results.totals.totalNet)}</td>
                        <td className="border border-gray-300 p-2 text-right">PKR {formatNumber(results.totals.subtotalReceivable)}</td>
                        <td className="border border-gray-300 p-2 text-right">—</td>
                      </tr>
                      <tr className="bg-yellow-100 text-yellow-800">
                        <td className="border border-gray-300 p-2 text-right" colSpan="10">
                          Global Tax ({formatNumber(globalTaxRate)}%)
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-semibold">
                          PKR {formatNumber(results.totals.globalTaxAmount)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">—</td>
                      </tr>
                      <tr className="bg-green-100 text-green-800 font-bold">
                        <td className="border border-gray-300 p-2 text-right" colSpan="10">
                          Grand Receivable Total
                        </td>
                        <td className="border border-gray-300 p-2 text-right text-lg">
                          PKR {formatNumber(results.totals.grandTotalReceivable)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold mb-2">Report Details</h5>
                  <p className="text-sm text-gray-600">
                    This report was generated on {new Date().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}. All calculations follow the locked formulas as specified.
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Calculation Flow:</strong> Individual sources → Subtotal Receivable → Minus Global Tax → Grand Receivable Total
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Report Dialog */}
          <SaveReportDialog
            open={showSaveDialog}
            onOpenChange={setShowSaveDialog}
            onSave={handleSaveReport}
            isUpdate={!!currentReportId}
          />
        </div>
      </main>
    </div>
  );
}