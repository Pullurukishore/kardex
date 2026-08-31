'use client';

import { useState } from 'react';
import {
  FileText, Layers, BarChart3
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy load the heavy report components for better performance
const ContractReports = dynamic<{ role: string }>(() => import('./ContractReports'), {
  loading: () => (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
      <div className="w-10 h-10 border-3 border-[#82A094]/30 border-t-[#82A094] rounded-full animate-spin" />
      <p className="text-sm font-bold text-slate-700">Loading Contract Report...</p>
    </div>
  ),
  ssr: false
});

const AnnualContractReports = dynamic<{ role: string }>(() => import('./AnnualContractReports'), {
  loading: () => (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
      <div className="w-10 h-10 border-3 border-[#7CA5C4]/30 border-t-[#7CA5C4] rounded-full animate-spin" />
      <p className="text-sm font-bold text-slate-700">Loading Annual Contract Report...</p>
    </div>
  ),
  ssr: false
});

interface ContractReportsWrapperProps {
  role: string;
}

type ReportTab = 'contract' | 'annual';

const REPORT_TABS: { id: ReportTab; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  {
    id: 'contract',
    label: 'Contract Report',
    icon: FileText,
    description: 'PM schedules, customer portfolios & expiry analytics'
  },
  {
    id: 'annual',
    label: 'Annual Contract Report',
    icon: Layers,
    description: 'Machine-wise annual maintenance contract tracking'
  }
];

export default function ContractReportsWrapper({ role }: ContractReportsWrapperProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('contract');

  return (
    <div className="space-y-6">
      {/* ═══ PAGE HEADER — Same design as Ticket Reports ═══ */}
      <div className="mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#546A7A] mb-2">Contract Reports</h1>
            <p className="text-sm sm:text-base text-[#5D6E73]">
              Generate and view comprehensive contract portfolios, PM schedules, and annual machine contract analytics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="text-xs sm:text-sm text-[#5D6E73] bg-[#AEBFC3]/20 px-3 py-2 rounded-lg flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Report Module: <span className="font-medium">{REPORT_TABS.find(t => t.id === activeTab)?.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ REPORT TYPE TABS — Same design as Ticket Reports type selector ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Select Report Type</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {REPORT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all duration-200 text-left
                    ${isActive
                      ? 'border-[#6F8A9D] bg-gradient-to-br from-[#546A7A]/5 via-[#6F8A9D]/5 to-[#82A094]/5 ring-1 ring-[#6F8A9D]/20 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200
                    ${isActive
                      ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-md'
                      : 'bg-slate-100 text-slate-500'
                    }
                  `}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${isActive ? 'text-[#546A7A]' : 'text-slate-700'}`}>
                      {tab.label}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${isActive ? 'text-[#6F8A9D]' : 'text-slate-400'}`}>
                      {tab.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="ml-auto flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-[#82A094] animate-pulse" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ REPORT CONTENT ═══ */}
      <div className="animate-in fade-in duration-200">
        {activeTab === 'contract' && (
          <ContractReports role={role} />
        )}
        {activeTab === 'annual' && (
          <AnnualContractReports role={role} />
        )}
      </div>
    </div>
  );
}
