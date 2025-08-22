'use client';

import React from 'react';
import Calculator from '@/components/Calculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator as CalculatorIcon } from 'lucide-react';

export default function DashboardPage({ selectedReport, onReportChange }) {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <CalculatorIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-gray-900">Earnings Calculator</h1>
          </div>
          <p className="text-gray-600">
            Calculate receivables with tax deduction and export professional reports
          </p>
        </div>
        
        <Calculator selectedReport={selectedReport} onReportChange={onReportChange} />
      </div>
    </div>
  );
}