'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus, Calculator as CalculatorIcon, FileText, Download, FileSpreadsheet, Save } from 'lucide-react';
import SaveReportDialog from './SaveReportDialog';
import { autoTable } from 'jspdf-autotable';


export default function Calculator({ selectedReport, onReportChange }) {
  const [globalTaxRate, setGlobalTaxRate] = useState(1.0);
  const [defaultPayoneerFee, setDefaultPayoneerFee] = useState(2.0);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportTitle, setReportTitle] = useState('');
  const [sources, setSources] = useState([{
    id: 1,
    sourceType: 'Direct',
    sourceDate: new Date().toISOString().split('T')[0],
    grossAmount: '',
    miscFee: '',
    taxRate: 0,
    payoneerFee: 2.0,
    conversionRate: ''
  }]);
  const [results, setResults] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load report data when selectedReport changes
  useEffect(() => {
    if (selectedReport) {
      setReportTitle(selectedReport.title);
      setReportDate(selectedReport.report_date);
      setGlobalTaxRate(selectedReport.global_tax_rate);
      setDefaultPayoneerFee(selectedReport.default_payoneer_fee);
      
      // Load sources
      if (selectedReport.sources && selectedReport.sources.length > 0) {
        const loadedSources = selectedReport.sources.map((source, index) => ({
          id: index + 1,
          sourceType: source.source_type,
          sourceDate: source.source_date,
          grossAmount: source.gross_amount.toString(),
          miscFee: source.misc_fee.toString(),
          taxRate: source.tax_rate,
          payoneerFee: source.payoneer_fee || 2.0,
          conversionRate: source.conversion_rate ? source.conversion_rate.toString() : ''
        }));
        setSources(loadedSources);
      }
      
      // Load financial metrics if available
      if (selectedReport.financial_metrics) {
        // Auto-calculate to show results
        setTimeout(() => {
          calculateEarnings();
        }, 100);
      }
      
      setIsEditing(true);
    } else {
      // Reset form for new report
      setReportTitle('');
      setReportDate(new Date().toISOString().split('T')[0]);
      setGlobalTaxRate(1.0);
      setDefaultPayoneerFee(2.0);
      setSources([{
        id: 1,
        sourceType: 'Direct',
        sourceDate: new Date().toISOString().split('T')[0],
        grossAmount: '',
        miscFee: '',
        taxRate: 0,
        payoneerFee: 2.0,
        conversionRate: ''
      }]);
      setResults(null);
      setIsEditing(false);
    }
  }, [selectedReport]);
  const addSource = () => {
    const newId = Math.max(...sources.map(s => s.id)) + 1;
    setSources([...sources, {
      id: newId,
      sourceType: 'Direct',
      sourceDate: new Date().toISOString().split('T')[0],
      grossAmount: '',
      miscFee: '',
      taxRate: 0,
      payoneerFee: defaultPayoneerFee,
      conversionRate: ''
    }]);
  };

  const removeSource = (id) => {
    if (sources.length > 1) {
      setSources(sources.filter(s => s.id !== id));
    }
  };

  const updateSource = (id, field, value) => {
    setSources(sources.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const calculateEarnings = () => {
    const calculatedSources = [];
    let totalGross = 0;
    let totalMiscFee = 0;
    let totalTax = 0;
    let totalNet = 0;
    let subtotalReceivable = 0;

    sources.forEach(source => {
      const grossAmount = parseFloat(source.grossAmount) || 0;
      const miscFee = parseFloat(source.miscFee) || 0;
      const taxRate = parseFloat(source.taxRate) || 0;
      const payoneerFee = parseFloat(source.payoneerFee) || 0;
      const conversionRate = parseFloat(source.conversionRate) || 0;

      if (grossAmount <= 0) return;

      let calculatedSource = {
        ...source,
        grossAmount,
        miscFee,
        taxRate,
        payoneerFee,
        conversionRate
      };

      if (source.sourceType === 'Direct') {
        const net = grossAmount - miscFee;
        const taxAmount = net * (taxRate / 100);
        const finalAmount = net - taxAmount;
        const receivable = finalAmount * 0.6;
        const percentOfGross = (receivable / grossAmount) * 100;

        calculatedSource = {
          ...calculatedSource,
          fiverrFee: 0,
          remainingUSD: 0,
          converted: 0,
          net,
          taxAmount,
          finalAmount,
          receivable,
          percentOfGross,
          grossInPKR: grossAmount
        };
      } else {
        const fiverrFee = grossAmount * 0.2;
        const remainingUSD = grossAmount - fiverrFee - payoneerFee;
        const converted = remainingUSD * conversionRate;
        const net = converted - miscFee;
        const taxAmount = net * (taxRate / 100);
        const finalAmount = net - taxAmount;
        const receivable = finalAmount * 0.6;
        const percentOfGross = (receivable / (remainingUSD * conversionRate)) * 100;

        calculatedSource = {
          ...calculatedSource,
          fiverrFee,
          remainingUSD,
          converted,
          net,
          taxAmount,
          finalAmount,
          receivable,
          percentOfGross,
          grossInPKR: grossAmount * conversionRate
        };
      }

      calculatedSources.push(calculatedSource);
      totalGross += calculatedSource.grossInPKR;
      totalMiscFee += miscFee;
      totalTax += calculatedSource.taxAmount;
      totalNet += calculatedSource.net;
      subtotalReceivable += calculatedSource.receivable;
    });

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

  const exportPDF = async () => {
    if (typeof window === 'undefined') return;
    
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
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
      formatDate(source.sourceDate),
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
  };

  const exportExcel = async () => {
    if (typeof window === 'undefined') return;
    
    const XLSX = await import('xlsx');
    
    const tableData = [
      ["Date", "Source", "Gross Amount", "Fiverr Fee", "Payoneer Fee", "Conversion Rate", "Misc Fee (PKR)", "Tax Rate", "Tax Amount (PKR)", "Net (PKR)", "Receivable (PKR)", "% of Gross"],
      ...results.sources.map(source => [
        formatDate(source.sourceDate),
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
      ["Subtotal", "", `PKR ${formatNumber(results.totals.totalGross)}`, "-", "-", "-", `PKR ${formatNumber(results.totals.totalMiscFee)}`, "-", `PKR ${formatNumber(results.totals.totalTax)}`, `PKR ${formatNumber(results.totals.totalNet)}`, `PKR ${formatNumber(results.totals.subtotalReceivable)}`, "-"],
      ["Global Tax", "", "", "", "", "", "", "", "", "", `PKR ${formatNumber(results.totals.globalTaxAmount)}`, "-"],
      ["Grand Total", "", "", "", "", "", "", "", "", "", `PKR ${formatNumber(results.totals.grandTotalReceivable)}`, "-"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Earnings Report");

    XLSX.writeFile(wb, `Earnings_Report_${reportDate}.xlsx`);
  };

  const handleSaveReport = async () => {
    if (!results) {
      alert('Please calculate earnings first');
      return;
    }
    
    if (isEditing && selectedReport) {
      // Update existing report
      try {
        const response = await fetch(`/api/reports/${selectedReport.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: reportTitle || `Report ${reportDate}`,
            reportDate,
            globalTaxRate,
            defaultPayoneerFee,
            sources,
            results
          }),
        });

        if (response.ok) {
          alert('Report updated successfully!');
          // Refresh the sidebar
          window.location.reload();
        } else {
          alert('Failed to update report');
        }
      } catch (error) {
        console.error('Error updating report:', error);
        alert('Error updating report');
      }
    } else {
      // Show save dialog for new report
      setShowSaveDialog(true);
    }
  };
  return (
    <div className="space-y-6">
      {/* Report Title for Editing */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Editing Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reportTitle">Report Title</Label>
                <Input
                  id="reportTitle"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Enter report title"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    onReportChange(null);
                  }}
                >
                  Cancel Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalculatorIcon className="h-5 w-5" />
            Global Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="reportDate">Report Date</Label>
              <Input
                id="reportDate"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
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
              <p className="text-sm text-muted-foreground mt-1">
                Applied to total receivable amount
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
              <p className="text-sm text-muted-foreground mt-1">
                Default value for new Fiverr sources
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Earnings Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="space-y-4">
              {sources.map((source) => (
                <div key={source.id} className="p-4 border rounded-lg bg-white relative">
                  {sources.length > 1 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 h-8 w-8 p-0"
                      onClick={() => removeSource(source.id)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Source Type</Label>
                      <Select 
                        value={source.sourceType} 
                        onValueChange={(value) => updateSource(source.id, 'sourceType', value)}
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
                        value={source.sourceDate}
                        onChange={(e) => updateSource(source.id, 'sourceDate', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label>Gross Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={source.grossAmount}
                        onChange={(e) => updateSource(source.id, 'grossAmount', e.target.value)}
                        placeholder={source.sourceType === 'Direct' ? 'PKR' : 'USD'}
                      />
                    </div>
                    
                    <div>
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={source.taxRate}
                        onChange={(e) => updateSource(source.id, 'taxRate', e.target.value)}
                        placeholder="Tax Rate"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {source.sourceType === 'Fiverr' && (
                      <>
                        <div>
                          <Label>Conversion Rate (PKR/USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={source.conversionRate}
                            onChange={(e) => updateSource(source.id, 'conversionRate', e.target.value)}
                            placeholder="Conversion Rate"
                          />
                        </div>
                        
                        <div>
                          <Label>Payoneer Fee (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={source.payoneerFee}
                            onChange={(e) => updateSource(source.id, 'payoneerFee', e.target.value)}
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
                        onChange={(e) => updateSource(source.id, 'miscFee', e.target.value)}
                        placeholder="Misc Fee"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={addSource}>
              <Plus className="mr-2 h-4 w-4" />
              Add Source
            </Button>
            
            <Button onClick={calculateEarnings}>
              <CalculatorIcon className="mr-2 h-4 w-4" />
              Calculate Earnings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Earnings Report - {formatDate(reportDate)}</CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={handleSaveReport}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? 'Update Report' : 'Save Report'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={isEditing}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Save As New
                </Button>
                <Button variant="outline" onClick={exportExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button onClick={exportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-right">Gross Amount</th>
                    <th className="p-3 text-right">Fiverr Fee</th>
                    <th className="p-3 text-right">Payoneer Fee</th>
                    <th className="p-3 text-right">Conv. Rate</th>
                    <th className="p-3 text-right">Misc Fee</th>
                    <th className="p-3 text-right">Tax Rate</th>
                    <th className="p-3 text-right">Tax Amount</th>
                    <th className="p-3 text-right">Net</th>
                    <th className="p-3 text-right">Receivable</th>
                    <th className="p-3 text-right">% of Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {results.sources.map((source, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-3">{formatDate(source.sourceDate)}</td>
                      <td className="p-3">{source.sourceType}</td>
                      <td className="p-3 text-right">
                        {source.sourceType === 'Direct' ? 
                          `PKR ${formatNumber(source.grossAmount)}` : 
                          `$${formatNumber(source.grossAmount)}`}
                      </td>
                      <td className="p-3 text-right">
                        {source.sourceType === 'Fiverr' ? `$${formatNumber(source.fiverrFee)}` : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {source.sourceType === 'Fiverr' ? `$${formatNumber(source.payoneerFee)}` : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {source.sourceType === 'Fiverr' ? formatNumber(source.conversionRate) : '—'}
                      </td>
                      <td className="p-3 text-right">PKR {formatNumber(source.miscFee)}</td>
                      <td className="p-3 text-right">{formatNumber(source.taxRate)}%</td>
                      <td className="p-3 text-right">PKR {formatNumber(source.taxAmount)}</td>
                      <td className="p-3 text-right">PKR {formatNumber(source.net)}</td>
                      <td className="p-3 text-right">PKR {formatNumber(source.receivable)}</td>
                      <td className="p-3 text-right">{formatNumber(source.percentOfGross)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan="2" className="p-3">Subtotal</td>
                    <td className="p-3 text-right">PKR {formatNumber(results.totals.totalGross)}</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right">PKR {formatNumber(results.totals.totalMiscFee)}</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right">PKR {formatNumber(results.totals.totalTax)}</td>
                    <td className="p-3 text-right">PKR {formatNumber(results.totals.totalNet)}</td>
                    <td className="p-3 text-right">PKR {formatNumber(results.totals.subtotalReceivable)}</td>
                    <td className="p-3 text-right">—</td>
                  </tr>
                  <tr className="bg-yellow-100">
                    <td colSpan="10" className="p-3 text-right">Global Tax ({globalTaxRate}%)</td>
                    <td className="p-3 text-right">PKR {formatNumber(results.totals.globalTaxAmount)}</td>
                    <td className="p-3 text-right">—</td>
                  </tr>
                  <tr className="bg-green-100 font-bold">
                    <td colSpan="10" className="p-3 text-right">Grand Receivable Total</td>
                    <td className="p-3 text-right">PKR {formatNumber(results.totals.grandTotalReceivable)}</td>
                    <td className="p-3 text-right">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <SaveReportDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        reportData={{
          reportDate,
          globalTaxRate,
          defaultPayoneerFee,
          sources,
          results
        }}
      />
    </div>
  );
}