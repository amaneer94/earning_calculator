'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, FileText, LogOut, Calendar, Calculator, ChevronLeft, ChevronRight, Trash2, Edit } from 'lucide-react';

export default function Sidebar({ user, onReportSelect, selectedReportId, isCollapsed, onToggleCollapse }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    setDeletingId(reportId);
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setReports(reports.filter(r => r.id !== reportId));
        if (selectedReportId === reportId) {
          onReportSelect(null);
        }
      } else {
        alert('Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Error deleting report');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReportClick = async (report) => {
    try {
      const response = await fetch(`/api/reports/${report.id}`);
      if (response.ok) {
        const data = await response.json();
        onReportSelect(data.report);
      } else {
        console.error('Failed to load report');
      }
    } catch (error) {
      console.error('Error loading report:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 ${isCollapsed ? 'w-16' : 'w-80'} bg-white shadow-lg border-r lg:block transition-all duration-300`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <Calculator className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Calculator</h2>
              {!isCollapsed && <p className="text-sm text-muted-foreground">Welcome, {user.username}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="ml-auto p-1 h-8 w-8"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          {!isCollapsed && (
            <Button 
              className="w-full"
              onClick={() => onReportSelect(null)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Report
            </Button>
          )}
          {isCollapsed && (
            <Button size="sm" className="w-full p-2" onClick={() => onReportSelect(null)}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Reports List */}
        <div className={`flex-1 ${isCollapsed ? 'p-2' : 'p-6'}`}>
          {!isCollapsed && <h3 className="text-sm font-medium text-muted-foreground mb-4">Saved Reports</h3>}
          <ScrollArea className="h-full">
            {loading ? (
              <div className="space-y-3">
                {!isCollapsed ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))
                ) : (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse mb-2" />
                  ))
                )}
              </div>
            ) : reports.length === 0 ? (
              !isCollapsed ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No reports yet</p>
                  <p className="text-sm text-muted-foreground">Create your first report to get started</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                </div>
              )
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <Card
                    key={report.id} 
                    className={`cursor-pointer hover:shadow-md transition-all ${
                      selectedReportId === report.id ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleReportClick(report)}
                  >
                    <CardContent className={isCollapsed ? "p-2" : "p-4"}>
                      {isCollapsed ? (
                        <div className="flex flex-col items-center gap-1">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-xs text-center truncate w-full" title={report.title}>
                            {report.title.substring(0, 8)}...
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <FileText className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium truncate">{report.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(report.report_date)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {formatDate(report.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDeleteReport(report.id, e)}
                              disabled={deletingId === report.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className={`${isCollapsed ? 'p-2' : 'p-6'} border-t`}>
          <Button 
            variant="outline" 
            className={isCollapsed ? "w-full p-2" : "w-full"}
            onClick={handleLogout}
          >
            <LogOut className={isCollapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
            {!isCollapsed && "Logout"}
          </Button>
        </div>
      </div>
    </div>
  );
}