'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Layers, FileText, ArrowRight } from 'lucide-react';

// Lazy load the heavy report component for optimal performance
const AnnualContractReports = dynamic<{ role: string }>(() => import('./AnnualContractReports'), {
  loading: () => (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
      <div className="w-10 h-10 border-3 border-[#7CA5C4]/30 border-t-[#7CA5C4] rounded-full animate-spin" />
      <p className="text-sm font-bold text-slate-700">Loading Annual Contract Report...</p>
    </div>
  ),
  ssr: false
});

interface AnnualContractReportsWrapperProps {
  role: string;
}

export default function AnnualContractReportsWrapper({ role }: AnnualContractReportsWrapperProps) {
  const getBasePath = (r: string) => {
    if (r === 'Zone Manager') return '/zone-manager';
    if (r === 'Zone User') return '/zone';
    if (r === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  const basePath = getBasePath(role);

  return (
    <div className="space-y-6">
      {/* ═══ PAGE HEADER ═══ */}
      <div className="mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7CA5C4]/15 border border-[#7CA5C4]/25 mb-2">
              <Layers className="w-3.5 h-3.5 text-[#546A7A]" />
              <span className="text-[11px] font-bold text-[#546A7A] tracking-wider uppercase">
                Annual Maintenance Contracts
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#546A7A] mb-2">Annual Contract Reports</h1>
            <p className="text-sm sm:text-base text-[#5D6E73]">
              Machine-wise annual maintenance agreement tracking, SLA compliance, and multi-tier expiration analytics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Link
              href={`${basePath}/contracts/reports`}
              className="text-xs sm:text-sm text-[#546A7A] bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-xs transition-colors font-medium group"
            >
              <FileText className="w-3.5 h-3.5 text-[#6F8A9D]" />
              <span>Contract Reports</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ REPORT CONTENT ═══ */}
      <div className="animate-in fade-in duration-200">
        <AnnualContractReports role={role} />
      </div>
    </div>
  );
}
