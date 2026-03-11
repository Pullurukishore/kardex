'use client';

import { Fragment, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, MilestonePaymentTerm, formatARCurrency, formatARDate, formatARMonth } from '@/lib/ar-api';
import { 
  Search, ChevronLeft, ChevronRight, ChevronDown, Plus, 
  TrendingUp, AlertTriangle, Clock, CheckCircle2, Calendar, 
  Wallet, Package, Timer, Truck, PackageCheck, PackageX, 
  BadgeCheck, Tag, Sparkles, ExternalLink,
  ArrowRight, CheckCircle, Layers, ShieldAlert, ShieldCheck, Shield, MessageSquare,
  Eye, Pencil, Trash2
} from 'lucide-react';

const termOptions: Record<string, string> = {
  ABG: 'ABG',
  PO: 'PO',
  DELIVERY: 'Delivery',
  FAR: 'FAR',
  PBG: 'PBG',
  FAR_PBG: 'FAR & PBG',
  INVOICE_SUBMISSION: 'Invoice Submission',
  PI: 'PI',
  OTHER: 'Other',
};

const getStatusBadgeConfig = (s: string) => {
  switch (s) {
    case 'PAID': return { bg: 'bg-[#82A094]/10', text: 'text-[#4F6A64]', icon: CheckCircle };
    case 'PARTIAL': return { bg: 'bg-[#CE9F6B]/10', text: 'text-[#976E44]', icon: TrendingUp };
    case 'OVERDUE': return { bg: 'bg-[#E17F70]/10', text: 'text-[#9E3B47]', icon: AlertTriangle };
    default: return { bg: 'bg-[#6F8A9D]/10', text: 'text-[#546A7A]', icon: Clock };
  }
};

// --- Sub-Component: Payment Terms & Aging Dropdown (matching view page) ---
function MilestoneTimelineView({ invoice }: { invoice: ARInvoice }) {
  const milestoneTerms = (invoice.milestoneTerms || []).slice().sort((a, b) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime());
  const totalAmount = Number(invoice.totalAmount || 0);
  const netAmount = Number(invoice.netAmount || 0);
  const totalReceived = Number(invoice.totalReceipts || 0);

  if (milestoneTerms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[#92A2A5]">
        <div className="p-3 rounded-full bg-[#AEBFC3]/10 mb-2">
          <Tag className="w-5 h-5 opacity-40" />
        </div>
        <p className="text-sm font-medium">No payment milestones configured</p>
        <Link 
          href={`/finance/ar/milestones/${invoice.id}`}
          className="mt-2 text-xs font-bold text-[#CE9F6B] hover:underline"
        >
          Click to configure milestones →
        </Link>
      </div>
    );
  }

  // Calculate collections per term – respecting calculationBasis and taxPercentage
  let remainingReceipts = totalReceived;
  const termCollections = milestoneTerms.map((term) => {
    const percentage = term.percentage || 0;
    const taxPercentage = term.taxPercentage || 0;
    const isNetBasis = term.calculationBasis !== 'TOTAL_AMOUNT';
    
    let allocatedAmount = 0;
    if (isNetBasis) {
      allocatedAmount = (netAmount * percentage) / 100;
    } else {
      const netPortion = (netAmount * percentage) / 100;
      const taxPortion = (Number(invoice.taxAmount || 0) * taxPercentage) / 100;
      allocatedAmount = netPortion + taxPortion;
    }

    const collectedForTerm = Math.min(allocatedAmount, Math.max(0, remainingReceipts));
    remainingReceipts -= collectedForTerm;
    const pendingForTerm = Math.max(0, allocatedAmount - collectedForTerm);
    const collectedPercent = allocatedAmount > 0 ? (collectedForTerm / allocatedAmount) * 100 : 0;
    return {
      termId: `${term.termType}-${term.termDate}-${percentage}-${taxPercentage}`,
      allocatedAmount,
      collectedForTerm,
      pendingForTerm,
      collectedPercent,
      isNetBasis,
    };
  });

  return (
    <div className="border-t border-dashed border-[#CE9F6B]/30 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-white/80" />
          <h3 className="font-bold text-white text-sm">Payment Terms & Aging</h3>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">{milestoneTerms.length} Terms</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-white/70">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#E17F70]" /> Overdue</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#82A094]" /> On Track</div>
          </div>
          <Link 
            href={`/finance/ar/milestones/${invoice.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-[10px] font-bold text-white hover:bg-white/25 transition-all"
          >
            Full Details <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Term Rows — same structure as view page */}
      <div className="divide-y divide-[#AEBFC3]/10">
        {milestoneTerms.map((term, index) => {
          const termDate = new Date(term.termDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const termAging = Math.floor((today.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
          const percentage = term.percentage || 0;
          const allocation = termCollections[index];
          const collectedForTerm = allocation?.collectedForTerm || 0;
          const pendingForTerm = allocation?.pendingForTerm || 0;
          const collectedPercent = allocation?.collectedPercent || 0;
          const isFullyPaid = collectedPercent >= 99;
          const isTermOverdue = termAging > 0 && !isFullyPaid && invoice.milestoneStatus !== 'FULLY_DELIVERED';

          return (
            <div key={index} className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 px-5 py-4 transition-colors ${
              isTermOverdue ? 'bg-[#E17F70]/[0.03]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/50'
            } hover:bg-[#546A7A]/[0.03]`}>
              {/* Term Identity */}
              <div className="sm:w-[22%] flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  isFullyPaid ? 'bg-[#82A094] text-white' : 
                  isTermOverdue ? 'bg-[#E17F70]/10 text-[#E17F70]' : 
                  'bg-[#546A7A]/10 text-[#546A7A]'
                }`}>
                  {isFullyPaid ? <CheckCircle className="w-3.5 h-3.5" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#546A7A] text-sm truncate">
                    {term.termType === 'OTHER' ? term.customLabel : termOptions[term.termType] || term.termType}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#92A2A5]">
                    <span className="font-semibold text-[#CE9F6B]">{percentage}% {term.taxPercentage ? `+ ${term.taxPercentage}% Tax` : ''}</span>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                      allocation?.isNetBasis ? 'bg-[#6F8A9D]/10 text-[#6F8A9D]' : 'bg-[#CE9F6B]/15 text-[#976E44]'
                    }`}>
                      {allocation?.isNetBasis ? 'Net' : 'Net+Tax'}
                    </span>
                    <span>•</span>
                    <span>{formatARDate(term.termDate)}</span>
                  </div>
                </div>
              </div>

              {/* Allocated / Received / Pending values */}
              <div className="sm:w-[44%] sm:px-4">
                <div className="grid grid-cols-3 gap-3 mb-1.5">
                  <div>
                    <p className="text-[9px] font-bold text-[#92A2A5] uppercase">Allocated</p>
                    <p className="text-xs font-bold text-[#546A7A]">{formatARCurrency(allocation?.allocatedAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#82A094] uppercase">Received</p>
                    <p className="text-xs font-bold text-[#4F6A64]">{formatARCurrency(collectedForTerm)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#92A2A5] uppercase">Pending</p>
                    <p className={`text-xs font-bold ${pendingForTerm > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>{formatARCurrency(pendingForTerm)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#AEBFC3]/15 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        isFullyPaid ? 'bg-[#82A094]' : collectedPercent >= 50 ? 'bg-[#CE9F6B]' : 'bg-[#6F8A9D]'
                      }`}
                      style={{ width: `${Math.min(100, collectedPercent)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold min-w-[32px] text-right ${
                    isFullyPaid ? 'text-[#82A094]' : collectedPercent >= 50 ? 'text-[#CE9F6B]' : 'text-[#6F8A9D]'
                  }`}>{Math.round(collectedPercent)}%</span>
                </div>
              </div>

              {/* Aging */}
              <div className="sm:w-[34%] flex items-center justify-end gap-3">
                <div className="text-right">
                  <p className={`text-base font-bold leading-tight ${
                    isFullyPaid ? 'text-[#82A094]' : isTermOverdue ? 'text-[#9E3B47]' : 'text-[#546A7A]'
                  }`}>
                    {isFullyPaid ? 'Cleared' : termAging > 0 ? `${termAging}d` : `${Math.abs(termAging)}d`}
                  </p>
                  <p className="text-[9px] font-semibold text-[#92A2A5] uppercase">
                    {isFullyPaid ? 'Paid' : termAging > 0 ? 'Overdue' : 'Left'}
                  </p>
                </div>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isFullyPaid ? 'bg-[#82A094]/10' : isTermOverdue ? 'bg-[#E17F70]/10' : 'bg-[#546A7A]/10'
                }`}>
                  {isFullyPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-[#82A094]" /> : 
                   isTermOverdue ? <AlertTriangle className="w-3.5 h-3.5 text-[#E17F70]" /> : 
                   <Timer className="w-3.5 h-3.5 text-[#546A7A]" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ARMilestonesPage() {
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const agingBucket = searchParams.get('agingBucket') || '';

  const agingBucketLabels: Record<string, string> = {
    'current': 'Current (Not Yet Due)',
    '1-30': '1-30 Days Overdue',
    '31-60': '31-60 Days Overdue',
    '61-90': '61-90 Days Overdue',
    '90+': '90+ Days Overdue',
  };

  useEffect(() => {
    loadInvoices();
  }, [search, status, page, agingBucket]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const result = await arApi.getInvoices({ 
        search, status, invoiceType: 'MILESTONE', agingBucket: agingBucket || undefined, page, limit: agingBucket ? 500 : 25 
      });
      setInvoices(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (error) {
      console.error('Failed to load milestone payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const statusFilters = [
    { value: '', label: 'All', icon: Layers },
    { value: 'PENDING', label: 'Pending', icon: Clock },
    { value: 'OVERDUE', label: 'Overdue', icon: AlertTriangle },
    { value: 'PAID', label: 'Paid', icon: CheckCircle2 },
    { value: 'PARTIAL', label: 'Partial', icon: TrendingUp },
  ];

  const getMilestoneStatusStyle = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return 'bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/40';
      case 'PARTIALLY_DELIVERED': return 'bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/40';
      case 'FULLY_DELIVERED': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/40';
      case 'EXPIRED': return 'bg-[#E17F70]/15 text-[#9E3B47] border border-[#E17F70]/40';
      case 'LINKED': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/40';
      default: return 'bg-[#AEBFC3]/15 text-[#5D6E73] border border-[#AEBFC3]/30';
    }
  };

  const getMilestoneStatusIcon = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return <Package className="w-3.5 h-3.5" />;
      case 'PARTIALLY_DELIVERED': return <Truck className="w-3.5 h-3.5" />;
      case 'FULLY_DELIVERED': return <PackageCheck className="w-3.5 h-3.5" />;
      case 'EXPIRED': return <PackageX className="w-3.5 h-3.5" />;
      case 'LINKED': return <BadgeCheck className="w-3.5 h-3.5" />;
      default: return <Package className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 relative p-4 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-lg bg-gradient-to-br from-[#CE9F6B] to-[#E17F70] shadow-[#CE9F6B]/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#546A7A]">Milestone Dashboard</h1>
            <p className="text-xs text-[#92A2A5]">{total} tracking records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            href="/finance/ar/milestones/new"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white text-sm font-semibold hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Milestone</span>
          </Link>
        </div>
      </div>

      {/* Aging Bucket Active Filter */}
      {agingBucket && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 rounded-xl border border-[#CE9F6B]/20 p-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#976E44]" />
            <span className="text-sm font-bold text-[#976E44]">Aging Filter:</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#CE9F6B] text-white text-xs font-bold">{agingBucketLabels[agingBucket] || agingBucket}</span>
          </div>
          <Link href="/finance/ar/milestones" className="ml-auto text-xs font-bold text-[#E17F70] hover:text-[#9E3B47] transition-colors">✕ Clear Filter</Link>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-3 bg-white rounded-xl border border-[#AEBFC3]/30 p-3 shadow-sm">
        <div className="w-full sm:flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
          <input
            type="text"
            placeholder="Search by SO, PO or Customer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#F8FAFB] border border-[#AEBFC3]/40 text-sm focus:border-[#6F8A9D] transition-all"
          />
        </div>
        
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => { setStatus(filter.value); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                status === filter.value ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-md' : 'text-[#5D6E73] hover:bg-[#546A7A]/10'
              }`}
            >
              <filter.icon className="w-3.5 h-3.5" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#AEBFC3]/40 overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#AEBFC3]/30 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]">
          <div className="flex items-center justify-between font-bold text-white text-xs uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 opacity-90" />
              <span>Milestone Receivables Table</span>
            </div>
            <div className="opacity-80">
              {invoices.length} entries shown
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#F8FAFB]">
                <th className="w-12 py-4 px-3 border-b-2 border-[#546A7A]/20"></th>
                <th className="text-left py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">SO / Invoice #</th>
                <th className="text-left py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#976E44] tracking-wider">PO Number</th>
                <th className="text-left py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Customer / Region</th>
                <th className="text-center py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Category</th>
                <th className="text-center py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Accounting</th>
                <th className="text-center py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">TSP</th>
                <th className="text-center py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Book Month</th>
                <th className="text-left py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#CE9F6B] tracking-wider">Latest Remark</th>
                <th className="text-right py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Financial Overview</th>
                <th className="text-center py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Status</th>
                <th className="text-center py-4 px-4 border-b-2 border-[#546A7A]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Milestone Aging</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={11} className="p-6"><div className="h-6 bg-[#AEBFC3]/10 rounded-xl" /></td></tr>
                ))
              ) : invoices.length === 0 ? (
                <tr><td colSpan={11} className="py-20 text-center text-[#92A2A5] font-medium italic">No milestone payments found matching your search.</td></tr>
              ) : (
                invoices.map((invoice, index) => {
                  const isExpanded = expandedRows.has(invoice.id);
                  const terms: MilestonePaymentTerm[] = invoice.milestoneTerms || [];
                  // Calculate critical aging — only count UNPAID overdue terms
                  const tAmt = Number(invoice.totalAmount || 0);
                  const nAmt = Number(invoice.netAmount || 0);
                  const tRec = Number(invoice.totalReceipts || 0);
                  let remRec = tRec;
                  const criticalAging = terms.length > 0 && invoice.milestoneStatus !== 'FULLY_DELIVERED' ? (() => {
                    const sorted = terms.slice().sort((a, b) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime());
                    const overdueUnpaid: number[] = [];
                    sorted.forEach(t => {
                      const pct = t.percentage || 0;
                      const taxPct = t.taxPercentage || 0;
                      let alloc = 0;
                      
                      if (t.calculationBasis !== 'TOTAL_AMOUNT') {
                        alloc = (nAmt * pct) / 100;
                      } else {
                        const netPortion = (nAmt * pct) / 100;
                        const taxPortion = (Number(invoice.taxAmount || 0) * taxPct) / 100;
                        alloc = netPortion + taxPortion;
                      }

                      const coll = Math.min(alloc, Math.max(0, remRec));
                      remRec -= coll;
                      const isPaid = alloc > 0 ? (coll / alloc) * 100 >= 99 : true;
                      if (!isPaid) {
                        const aging = Math.floor((new Date().getTime() - new Date(t.termDate).getTime()) / (1000*60*60*24));
                        if (aging > 0) overdueUnpaid.push(aging);
                      }
                    });
                    return overdueUnpaid.sort((a, b) => b - a)[0] || null;
                  })() : null;

                  return (
                    <Fragment key={invoice.id}>
                      <tr 
                         onClick={() => toggleRow(invoice.id)}
                         className={`group cursor-pointer transition-all ${isExpanded ? 'bg-[#F4F7F9]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'} hover:bg-[#F0F4F7]`}
                      >
                        <td className="py-4 px-3 text-center">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-[#CE9F6B] text-white shadow-lg rotate-180' : 'bg-[#AEBFC3]/10 text-[#546A7A] group-hover:bg-[#546A7A]/10'}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </td>
                        <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/finance/ar/milestones/${invoice.id}`} className="group/link block">
                            <div className="font-bold text-[#546A7A] text-sm group-hover/link:text-[#CE9F6B] group-hover/link:underline transition-all decoration-2 underline-offset-4">{invoice.soNo || '-'}</div>
                            <div className="text-[10px] text-[#92A2A5] font-bold uppercase tracking-tight">{invoice.invoiceNumber || '-'}</div>
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-sm text-[#976E44] font-bold italic">{invoice.poNo || '-'}</td>
                        <td className="py-4 px-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/finance/ar/milestones/${invoice.id}`} className="group/link block">
                            <div className="text-sm font-bold text-[#546A7A] truncate group-hover/link:text-[#CE9F6B] group-hover/link:underline transition-all decoration-2 underline-offset-4">{invoice.customerName}</div>
                            <div className="text-[10px] text-[#92A2A5] font-bold tracking-widest uppercase">{invoice.region || '-'} • {invoice.bpCode}</div>
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="px-2 py-1 rounded-lg bg-[#AEBFC3]/10 text-[#546A7A] text-[10px] font-bold">{invoice.type || 'NB'}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                           <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                             invoice.accountingStatus === 'REVENUE_RECOGNISED' ? 'bg-[#82A094]/10 text-[#4F6A64]' : 'bg-[#CE9F6B]/10 text-[#976E44]'
                           }`}>
                             {invoice.accountingStatus === 'REVENUE_RECOGNISED' ? 'REVENUE' : invoice.accountingStatus || 'BACKLOG'}
                           </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                           <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                             invoice.mailToTSP ? 'bg-[#82A094]/10 text-[#4F6A64]' : 'bg-[#AEBFC3]/10 text-[#5D6E73]'
                           }`}>
                             {invoice.mailToTSP || 'PEND'}
                           </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-xs font-bold text-[#546A7A]">{formatARMonth(invoice.bookingMonth)}</span>
                        </td>
                        <td className="py-4 px-4">
                           {invoice.remarks && invoice.remarks.length > 0 ? (
                             <div className="flex items-start gap-2 max-w-[180px] group/remark relative" title={invoice.remarks[0].content}>
                                <MessageSquare className="w-3 h-3 text-[#CE9F6B] flex-shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0">
                                  <p className="text-[10px] font-medium text-[#5D6E73] truncate leading-tight">{invoice.remarks[0].content}</p>
                                  <p className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-tighter mt-0.5">
                                    {invoice.remarks[0].createdBy?.name?.split(' ')[0] || 'System'} • {new Date(invoice.remarks[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                  </p>
                                </div>
                             </div>
                           ) : (
                             <span className="text-[10px] text-[#AEBFC3] italic">No remarks</span>
                           )}
                        </td>
                        <td className="py-4 px-4 text-right">
                           <div className="flex flex-col items-end">
                              <p className="font-bold text-[#4F6A64] text-sm leading-none">{formatARCurrency(Number(invoice.totalAmount))}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                 <span className="text-[9px] font-bold text-[#6F8A9D]">Rec: {formatARCurrency(Number(invoice.totalReceipts))}</span>
                                 <span className="text-[9px] font-black text-[#E17F70]">Bal: {formatARCurrency(Number(invoice.balance))}</span>
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-4">
                          {(() => {
                            const conf = getStatusBadgeConfig(invoice.status);
                            return (
                              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${conf.bg} ${conf.text} justify-center mx-auto w-fit`}>
                                <conf.icon className="w-2.5 h-2.5" />
                                <span className="text-[9px] font-black uppercase">{invoice.status}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-4">
                           <div 
                             onClick={(e) => { e.stopPropagation(); toggleRow(invoice.id); }}
                             className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                               criticalAging && criticalAging > 0 
                               ? 'bg-[#E17F70]/5 border-[#E17F70]/20 text-[#9E3B47]' 
                               : 'bg-[#82A094]/5 border-[#82A094]/20 text-[#4F6A64]'
                             }`}
                           >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                 {criticalAging && criticalAging > 0 ? <AlertTriangle className="w-3 h-3 animate-pulse" /> : <Timer className="w-3 h-3" />}
                                 <span className="text-[11px] font-bold uppercase tracking-wider">
                                   {criticalAging && criticalAging > 0 ? `${criticalAging}d Overdue` : 'On Track'}
                                 </span>
                              </div>
                              <div className="text-[9px] font-bold opacity-60 flex items-center gap-1 uppercase">
                                 {terms.length} Milestones <ChevronDown className="w-2.5 h-2.5" />
                              </div>
                           </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${invoice.id}-timeline`}><td colSpan={11} className="p-0"><MilestoneTimelineView invoice={invoice} /></td></tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Improved Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-5 border-t border-[#AEBFC3]/20 flex justify-between items-center bg-[#F8FAFB]">
            <span className="text-xs font-bold text-[#92A2A5] tracking-widest uppercase">Page {page} of {totalPages}</span>
            <div className="flex gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#AEBFC3]/30 rounded-xl text-xs font-bold text-[#546A7A] hover:bg-white/50 disabled:opacity-30 shadow-sm transition-all">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-2 px-4 py-2 bg-[#546A7A] rounded-xl text-xs font-bold text-white hover:bg-[#6F8A9D] disabled:opacity-30 shadow-lg transition-all">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Design Refinement */}
      <div className="md:hidden space-y-4">
          {invoices.map(invoice => {
            const isExpanded = expandedRows.has(invoice.id);
            return (
              <div key={invoice.id} className="bg-white rounded-2xl border border-[#AEBFC3]/30 shadow-lg overflow-hidden transition-all active:scale-[0.98]">
                 <div className="p-5" onClick={() => toggleRow(invoice.id)}>
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-[#546A7A]/10"><Wallet className="w-4 h-4 text-[#546A7A]" /></div>
                          <div>
                            <div className="font-bold text-[#546A7A] text-sm">{invoice.soNo || 'SO-N/A'}</div>
                            <div className="text-[10px] font-bold text-[#92A2A5] tracking-widest uppercase">{invoice.poNo || 'PO-N/A'}</div>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <Link 
                            href={`/finance/ar/milestones/${invoice.id}`}
                            className="p-2 rounded-xl bg-[#CE9F6B]/10 text-[#CE9F6B] active:bg-[#CE9F6B]/20 transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <ChevronDown className={`w-5 h-5 text-[#AEBFC3] transition-all ${isExpanded ? 'rotate-180' : ''}`} />
                       </div>
                    </div>
                    
                    <div className="mb-4">
                       <h3 className="text-sm font-bold text-[#546A7A] mb-0.5">{invoice.customerName}</h3>
                       <p className="text-[10px] text-[#92A2A5] font-bold uppercase tracking-widest leading-none">{invoice.bpCode}</p>
                       
                       {invoice.remarks && invoice.remarks.length > 0 && (
                         <div className="mt-3 p-2.5 rounded-xl bg-[#CE9F6B]/5 border border-[#CE9F6B]/10 flex items-start gap-2">
                           <MessageSquare className="w-3 h-3 text-[#CE9F6B] flex-shrink-0 mt-0.5" />
                           <p className="text-[10px] text-[#5D6E73] font-medium leading-tight line-clamp-2 italic">
                             &ldquo;{invoice.remarks[0].content}&rdquo;
                           </p>
                         </div>
                       )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#AEBFC3]/10">
                       <div>
                          <p className="text-[10px] text-[#92A2A5] font-bold uppercase mb-1">Balance Due</p>
                          <p className="text-lg font-bold text-[#E17F70]">{formatARCurrency(Number(invoice.balance))}</p>
                       </div>
                       <div className="text-right flex flex-col items-end">
                          <p className="text-[10px] text-[#92A2A5] font-bold uppercase mb-1">Milestones</p>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${invoice.balance === 0 ? 'bg-[#82A094]/10 border-[#82A094]/30 text-[#4F6A64]' : 'bg-[#CE9F6B]/10 border-[#CE9F6B]/30 text-[#976E44]'}`}>
                             {invoice.milestoneTerms?.length || 0} Terms
                          </div>
                       </div>
                    </div>
                 </div>
                 {isExpanded && <MilestoneTimelineView invoice={invoice} />}
              </div>
            );
          })}
      </div>
    </div>
  );
}
