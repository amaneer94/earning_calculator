'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Calculator, 
  FileText, 
  Plus, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Trash2,
  Calendar
} from 'lucide-react';

export default function Sidebar({ 
  user, 
  collapsed, 
  onToggle, 
  onLogout,
  currentReportId,
  onLoadReport,
  onDeleteReport,
  onNewReport 
}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleDeleteClick = (e, reportId) => {
    e.stopPropagation();
    onDeleteReport(reportId);
    loadReports();
  };

  return (
    <div className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-80'
    } fixed h-full z-10`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <Calculator className="h-6 w-6 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">
                Earnings Calculator
              </h1>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {!collapsed && (
          <div className="mt-2 text-sm text-gray-600">
            Welcome, {user.username}
          </div>
        )}
      </div>

      {/* New Report Button */}
      <div className="p-4">
        <Button
          onClick={onNewReport}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size={collapsed ? "sm" : "default"}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span className="ml-2">New Report</span>}
          
        </Button>
      </div>

      {/* Reports List */}
      <div className="flex-1 overflow-hidden">
        {!collapsed && (
          <div className="px-4 pb-2">
            <h2 className="text-sm font-medium text-gray-900">Saved Reports</h2>
          </div>
        )}
        
        <ScrollArea className="flex-1 px-2">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              {collapsed ? '...' : 'Loading reports...'}
            </div>
          ) : reports.length === 0 ? (
            !collapsed && (
              <div className="p-4 text-center text-gray-500">
                No reports yet. Create your first report!
              </div>
            )
          ) : (
            <div className="space-y-1">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`group relative rounded-lg border transition-colors cursor-pointer ${
                    currentReportId === report.id
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => onLoadReport(report.id)}
                >
                  {collapsed ? (
                    <div className="p-3 flex justify-center">
                      <FileText className="h-4 w-4 text-gray-600" />
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {report.title}
                          </h3>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(report.report_date)}
                          </div>
                          <div className="mt-2 text-xs text-gray-600">
                            <div>Total: {formatCurrency(report.grand_total_receivable)}</div>
                            <div className="text-gray-400">
                              Updated: {formatDate(report.updated_at)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => handleDeleteClick(e, report.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          size={collapsed ? "sm" : "default"}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
          
        </Button>
      </div>
    </div>
  );
}