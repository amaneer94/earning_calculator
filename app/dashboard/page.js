'use client';

import { useState, useEffect } from 'react';
import Calculator from '@/components/Calculator';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DashboardPage() {
  const [currentReport, setCurrentReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
      } else {
        setError('Failed to load reports');
      }
    } catch (error) {
      setError('Network error loading reports');
    } finally {
      setLoading(false);
    }
  };

  const handleReportSaved = () => {
    loadReports();
    setCurrentReport(null);
  };

  const handleLoadReport = async (reportId) => {
    try {
      const response = await fetch(`/api/reports/${reportId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentReport(data);
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
        if (currentReport && currentReport.report.id === reportId) {
          setCurrentReport(null);
        }
      } else {
        setError('Failed to delete report');
      }
    } catch (error) {
      setError('Network error deleting report');
    }
  };

  const handleNewReport = () => {
    setCurrentReport(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Calculator
        currentReport={currentReport}
        onReportSaved={handleReportSaved}
        onLoadReport={handleLoadReport}
        onDeleteReport={handleDeleteReport}
        onNewReport={handleNewReport}
        reports={reports}
      />
    </div>
  );
}