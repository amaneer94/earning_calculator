// components/ReportContext.jsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'

// Define proper types instead of using 'any'
export interface Report {
  id: string
  name: string
  // Add other report properties
}

interface ReportContextType {
  selectedReport: Report | null
  onReportChange: (report: Report) => void
}

const ReportContext = createContext<ReportContextType | undefined>(undefined)

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  // Optional: Load initial report from URL/searchParams
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reportId = params.get('reportId')
    
    if (reportId) {
      // Fetch report data
    }
  }, [])

  return (
    <ReportContext.Provider 
      value={{ 
        selectedReport, 
        onReportChange: setSelectedReport 
      }}
    >
      {children}
    </ReportContext.Provider>
  )
}

export function useReport() {
  const context = useContext(ReportContext)
  if (!context) {
    throw new Error('useReport must be used within ReportProvider')
  }
  return context
}