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

// --- Helper: Get Milestone Stage Config ---
const getMilestoneStageConfig = (status?: string) => {
  switch (status) {
    case 'AWAITING_DELIVERY': return { bg: 'bg-[#CE9F6B]/15', text: 'text-[#976E44]', border: 'border-[#CE9F6B]/40', icon: Package, label: 'Awaiting Delivery' };
    case 'PARTIALLY_DELIVERED': return { bg: 'bg-[#6F8A9D]/15', text: 'text-[#546A7A]', border: 'border-[#6F8A9D]/40', icon: Truck, label: 'Partially Delivered' };
    case 'FULLY_DELIVERED': return { bg: 'bg-[#82A094]/15', text: 'text-[#4F6A64]', border: 'border-[#82A094]/40', icon: PackageCheck, label: 'Fully Delivered' };
    case 'EXPIRED': return { bg: 'bg-[#E17F70]/15', text: 'text-[#9E3B47]', border: 'border-[#E17F70]/40', icon: PackageX, label: 'Expired' };
    case 'LINKED': return { bg: 'bg-[#82A094]/15', text: 'text-[#4F6A64]', border: 'border-[#82A094]/40', icon: BadgeCheck, label: 'Linked' };
    default: return { bg: 'bg-[#AEBFC3]/15', text: 'text-[#5D6E73]', border: 'border-[#AEBFC3]/30', icon: Package, label: 'Pending' };
  }
};

// --- Sub-Component: Payment Terms & Aging Dropdown (matching view page) ---
// --- Sub-Component: Payment Terms & Aging Dropdown ---
function MilestoneTimelineView({ invoice }: { invoice: ARInvoice }) {
  const milestoneTerms = (invoice.milestoneTerms || []).slice().sort((a, b) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime());
  const netAmount = Number(invoice.netAmount || 0);
  const totalReceived = Number(invoice.totalReceipts || 0);

  if (milestoneTerms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#92A2A5] bg-[#F8FAFB]/50 border-y border-dashed border-[#AEBFC3]/20">
        <div className="p-4 rounded-2xl bg-[#AEBFC3]/10 mb-3 shadow-inner">
          <Tag className="w-6 h-6 opacity-30" />
        </div>
        <p className="text-sm font-bold tracking-tight">No payment milestones configured</p>
        <Link 
          href={`/finance/ar/milestones/${invoice.id}`}
          className="mt-3 text-xs font-black text-[#CE9F6B] hover:text-[#976E44] transition-colors border-b border-current"
        >
          CONFIGURE MILESTONES →
        </Link>
      </div>
    );
  }

  // Calculate collections per term
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
      allocatedAmount,
      collectedForTerm,
      pendingForTerm,
      collectedPercent,
      isNetBasis,
    };
  });

  return (
    <div className="bg-white border-y border-[#AEBFC3]/20 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-gradient-to-r from-[#4A6070] to-[#546A7A]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
             <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-black text-white text-xs uppercase tracking-widest">Payment Milestones & Aging</h3>
            <p className="text-[10px] text-white/50 font-bold uppercase">{milestoneTerms.length} Scheduled Stages</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 text-[9px] font-black text-white/60 uppercase tracking-tighter">
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] shadow-[0_0_8px_#E07A5F]" /> Overdue</div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#70A288] shadow-[0_0_8px_#70A288]" /> On Track</div>
          </div>
          <Link 
            href={`/finance/ar/milestones/${invoice.id}`}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/10 border border-white/20 text-[10px] font-black text-white hover:bg-white/20 transition-all shadow-lg"
          >
            EDIT PLAN <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Term Rows */}
      <div className="divide-y divide-[#AEBFC3]/10">
        {milestoneTerms.map((term, index) => {
          const termDate = new Date(term.termDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const termAging = Math.floor((today.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
          const allocation = termCollections[index];
          const collectedPercent = allocation?.collectedPercent || 0;
          const isFullyPaid = collectedPercent >= 99;
          const isTermOverdue = termAging > 0 && !isFullyPaid;

          return (
            <div key={index} className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0 px-6 py-5 transition-all duration-300 ${
              isTermOverdue ? 'bg-[#E17F70]/[0.05]' : 'bg-white'
            } hover:bg-[#F8FAFB]`}>
              {/* Stage Identity */}
              <div className="sm:w-[25%] flex items-center gap-4">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-xs font-black shadow-sm transition-all ${
                  isFullyPaid ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white' : 
                  isTermOverdue ? 'bg-gradient-to-br from-[#E17F70]/20 to-[#E17F70]/10 text-[#9E3B47] border border-[#E17F70]/20' : 
                  'bg-gradient-to-br from-[#F8FAFB] to-[#F1F5F9] text-[#546A7A] border border-[#AEBFC3]/20'
                }`}>
                  {isFullyPaid ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-[#546A7A] text-sm uppercase tracking-tight">
                    {term.termType === 'OTHER' ? term.customLabel : termOptions[term.termType] || term.termType}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black text-[#CE9F6B]">{term.percentage}%</span>
                    <span className="w-1 h-1 rounded-full bg-[#AEBFC3]/40" />
                    <span className="text-[10px] font-bold text-[#92A2A5]">{formatARDate(term.termDate)}</span>
                  </div>
                </div>
              </div>

              {/* Progress & Values */}
              <div className="sm:w-[45%] sm:px-6">
                <div className="grid grid-cols-3 gap-4 mb-2.5">
                  <div className="bg-[#AEBFC3]/5 p-2 rounded-xl border border-transparent hover:border-[#AEBFC3]/20 transition-all">
                    <p className="text-[9px] font-black text-[#92A2A5] uppercase tracking-widest mb-0.5">Allocated</p>
                    <p className="text-xs font-black text-[#546A7A]">{formatARCurrency(allocation?.allocatedAmount || 0)}</p>
                  </div>
                  <div className="bg-[#82A094]/5 p-2 rounded-xl border border-transparent hover:border-[#82A094]/20 transition-all">
                    <p className="text-[9px] font-black text-[#4F6A64] uppercase tracking-widest mb-0.5">Received</p>
                    <p className="text-xs font-black text-[#4F6A64]">{formatARCurrency(allocation?.collectedForTerm || 0)}</p>
                  </div>
                  <div className="bg-[#E17F70]/5 p-2 rounded-xl border border-transparent hover:border-[#E17F70]/20 transition-all">
                    <p className="text-[9px] font-black text-[#9E3B47] uppercase tracking-widest mb-0.5">Pending</p>
                    <p className={`text-xs font-black ${allocation?.pendingForTerm || 0 > 0 ? 'text-[#9E3B47]' : 'text-[#82A094]'}`}>
                      {formatARCurrency(allocation?.pendingForTerm || 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out relative ${
                        isFullyPaid ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]' : 
                        collectedPercent >= 50 ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]' : 
                        'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]'
                      }`}
                      style={{ width: `${Math.min(100, collectedPercent)}%` }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/20" />
                    </div>
                  </div>
                  <span className={`text-[10px] font-black min-w-[35px] text-right ${
                    isFullyPaid ? 'text-[#82A094]' : collectedPercent >= 50 ? 'text-[#CE9F6B]' : 'text-[#6F8A9D]'
                   }`}>{Math.round(collectedPercent)}%</span>
                </div>
              </div>

              {/* Status & Aging */}
              <div className="sm:w-[30%] flex items-center justify-end gap-4">
                <div className="text-right">
                  <p className={`text-lg font-black leading-none tracking-tighter ${
                    isFullyPaid ? 'text-[#82A094]' : isTermOverdue ? 'text-[#9E3B47]' : 'text-[#546A7A]'
                  }`}>
                    {isFullyPaid ? 'CLEARED' : termAging > 0 ? `${termAging}d` : `${Math.abs(termAging)}d`}
                  </p>
                  <p className="text-[9px] font-black text-[#92A2A5] uppercase tracking-[0.1em] mt-1">
                    {isFullyPaid ? 'PAYMENT RECEIVED' : termAging > 0 ? 'OVERDUE RISK' : 'REMAINING'}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  isFullyPaid ? 'bg-[#82A094]/10 text-[#82A094]' : 
                  isTermOverdue ? 'bg-[#E17F70]/10 text-[#E17F70]' : 
                  'bg-[#F1F5F9] text-[#546A7A]'
                }`}>
                  {isFullyPaid ? <CheckCircle2 className="w-5 h-5" /> : 
                   isTermOverdue ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : 
                   <Timer className="w-5 h-4" />}
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
              <tr className="bg-[#F8FAFB] sticky top-0 z-10 backdrop-blur-md bg-white/95">
                <th className="w-12 py-5 px-3 border-b-2 border-[#546A7A]/10 text-center">
                   <div className="w-2 h-2 rounded-full bg-[#AEBFC3]/30 mx-auto" />
                </th>
                <th className="text-left py-5 px-4 border-b-2 border-[#546A7A]/10 text-[10px] font-black uppercase text-[#6F8A9D] tracking-[0.1em]">Sales Order Info</th>
                <th className="text-left py-5 px-4 border-b-2 border-[#546A7A]/10 text-[10px] font-black uppercase text-[#976E44] tracking-[0.1em]">PO References</th>
                <th className="text-left py-5 px-4 border-b-2 border-[#546A7A]/10 text-[10px] font-black uppercase text-[#546A7A] tracking-[0.1em]">Customer Profile</th>
                <th className="text-left py-5 px-4 border-b-2 border-[#546A7A]/10 text-[10px] font-black uppercase text-[#546A7A] tracking-[0.1em]">Operational Context</th>
                <th className="text-left py-5 px-4 border-b-2 border-[#546A7A]/10 text-[10px] font-black uppercase text-[#CE9F6B] tracking-[0.1em]">Recent Activity</th>
                <th className="text-right py-5 px-4 border-b-2 border-[#546A7A]/10 text-[10px] font-black uppercase text-[#546A7A] tracking-[0.1em]">Financial Status</th>
                <th className="text-center py-5 px-4 border-b-2 border-[#546A7A]/10 text-[10px] font-black uppercase text-[#546A7A] tracking-[0.1em]">Tracking Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={8} className="p-6"><div className="h-6 bg-[#AEBFC3]/10 rounded-xl" /></td></tr>
                ))
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="py-20 text-center text-[#92A2A5] font-medium italic">No milestone payments found matching your search.</td></tr>
              ) : (
                invoices.map((invoice, index) => {
                  const isExpanded = expandedRows.has(invoice.id);
                  const terms: MilestonePaymentTerm[] = invoice.milestoneTerms || [];
                  // Calculate critical aging — only count UNPAID overdue terms
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
                         className={`group cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-[#F4F7F9] ring-1 ring-[#CE9F6B]/20' : index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'} hover:bg-white hover:shadow-xl hover:translate-y-[-1px] hover:z-[5] relative`}
                      >
                        <td className="py-5 px-3 text-center">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white shadow-lg rotate-180' : 'bg-[#AEBFC3]/10 text-[#546A7A] group-hover:bg-[#546A7A] group-hover:text-white'}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </td>
                        
                        <td className="py-5 px-4" onClick={(e) => e.stopPropagation()}>
                           <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex flex-col group/so">
                              <div className="flex items-center gap-2 mb-1.5">
                                 <div className="w-5 h-5 rounded-md bg-[#6F8A9D]/10 flex items-center justify-center group-hover/so:bg-[#6F8A9D] transition-colors">
                                    <Layers className="w-3 h-3 text-[#6F8A9D] group-hover/so:text-white" />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-[#92A2A5] uppercase tracking-widest leading-none mb-0.5">SO Number</span>
                                    <span className="text-[11px] font-black text-[#546A7A] tracking-tight group-hover/so:text-[#6F8A9D]">{invoice.soNo || 'SO-N/A'}</span>
                                 </div>
                              </div>
                           </Link>
                           <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex items-center gap-2 group/inv" onClick={(e) => e.stopPropagation()}>
                              <div className="w-5 h-5 rounded-md bg-[#AEBFC3]/15 flex items-center justify-center group-hover/inv:bg-[#546A7A] transition-colors">
                                 <ExternalLink className="w-3 h-3 text-[#546A7A] group-hover/inv:text-white" />
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-[8px] font-black text-[#92A2A5] uppercase tracking-widest leading-none mb-0.5">Invoice No</span>
                                 <span className="text-[11px] font-bold text-[#92A2A5] truncate max-w-[100px] group-hover/inv:text-[#546A7A]">{invoice.invoiceNumber || 'PENDING'}</span>
                              </div>
                           </Link>
                        </td>

                        <td className="py-5 px-4" onClick={(e) => e.stopPropagation()}>
                           <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex flex-col group/po">
                              <div className="flex items-center gap-2 mb-1.5">
                                 <Tag className="w-3.5 h-3.5 text-[#CE9F6B]/60 group-hover/po:text-[#CE9F6B]" />
                                 <span className="text-sm font-black text-[#976E44] italic group-hover/po:underline">{invoice.poNo || 'NO-PO-REF'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Calendar className="w-3 h-3 text-[#92A2A5]" />
                                 <span className="text-[10px] font-black text-[#546A7A] uppercase tracking-wider">{formatARMonth(invoice.bookingMonth) || 'NO MONTH'}</span>
                              </div>
                           </Link>
                        </td>

                        <td className="py-5 px-4" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex flex-col group/cust">
                            {invoice.customerName && (
                              <span className="text-sm font-black text-[#546A7A] mb-1 line-clamp-1 group-hover/cust:text-[#CE9F6B] transition-colors">{invoice.customerName}</span>
                            )}
                            <div className="flex items-center gap-2">
                              {invoice.bpCode ? (
                                <span className="px-1.5 py-0.5 rounded bg-[#AEBFC3]/15 text-[9px] font-black text-[#546A7A] tracking-tighter">{invoice.bpCode}</span>
                              ) : !invoice.customerName && (
                                <div className="w-16 h-3 bg-[#AEBFC3]/10 rounded animate-pulse" />
                              )}
                              {invoice.region && invoice.region.toUpperCase() !== 'GLOBAL' && (
                                <div className="flex items-center gap-1 text-[9px] text-[#92A2A5] font-bold">
                                  <ShieldCheck className="w-2.5 h-2.5 text-[#82A094]" />
                                  <span className="uppercase">{invoice.region}</span>
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>

                        <td className="py-5 px-4">
                           <div className="flex flex-col gap-2.5">
                              {/* Category */}
                              {(() => {
                                const type = invoice.type || 'NB';
                                const config = {
                                  'LCS': { bg: 'bg-[#70A288]/10', text: 'text-[#4A6D5A]', icon: 'text-[#70A288]' },
                                  'NB': { bg: 'bg-[#506C83]/10', text: 'text-[#3E5466]', icon: 'text-[#506C83]' },
                                  'FINANCE': { bg: 'bg-[#8B5E3C]/10', text: 'text-[#6D4224]', icon: 'text-[#8B5E3C]' }
                                }[type] || { bg: 'bg-[#506C83]/10', text: 'text-[#3E5466]', icon: 'text-[#506C83]' };

                                return (
                                  <div className="flex items-center gap-2 group/cat">
                                     <div className={`w-5 h-5 rounded-md ${config.bg} flex items-center justify-center transition-colors group-hover/cat:scale-110 shadow-sm`}>
                                        <Tag className={`w-3 h-3 ${config.icon}`} />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-widest leading-none mb-0.5">Category</span>
                                        <span className={`text-[10px] font-black tracking-tight ${config.text}`}>{type}</span>
                                     </div>
                                  </div>
                                );
                              })()}
                              
                              {/* Accounting Status */}
                              {(() => {
                                const status = invoice.accountingStatus;
                                const config = status === 'REVENUE_RECOGNISED' 
                                  ? { bg: 'bg-[#588157]/10', text: 'text-[#3A5A40]', label: 'Revenue Recognised' }
                                  : status === 'BACKLOG'
                                  ? { bg: 'bg-[#E07A5F]/10', text: 'text-[#BC4B32]', label: 'Backlog' }
                                  : { bg: 'bg-[#D4A056]/10', text: 'text-[#8A6A34]', label: 'Acknowledged' };

                                return (
                                  <div className="flex items-center gap-2 group/acc">
                                     <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors group-hover/acc:scale-110 shadow-sm ${config.bg}`}>
                                        <ShieldCheck className={`w-3 h-3 ${config.text.replace('text-', 'text-opacity-80 ')}`} />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-widest leading-none mb-0.5">Acct Status</span>
                                        <span className={`text-[9px] font-black tracking-tight leading-tight ${config.text}`}>
                                          {config.label}
                                        </span>
                                     </div>
                                  </div>
                                );
                              })()}

                              {/* Milestone Status Overlay (if active) */}
                              {invoice.milestoneStatus && invoice.milestoneStatus !== 'AWAITING_DELIVERY' && (() => {
                                const mode = getMilestoneStageConfig(invoice.milestoneStatus);
                                return (
                                  <div className="mt-1 pt-1.5 border-t border-[#AEBFC3]/10 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${mode.bg.replace('/15', '')} animate-pulse`} />
                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${mode.text}`}>{mode.label}</span>
                                  </div>
                                );
                              })()}
                           </div>
                        </td>

                        <td className="py-5 px-4">
                           {invoice.remarks && invoice.remarks.length > 0 ? (
                             <div className="group/rem relative p-2.5 rounded-xl bg-gradient-to-br from-white to-[#F8FAFB] border border-[#AEBFC3]/20 shadow-sm max-w-[220px]">
                                <div className="flex items-start gap-2.5">
                                   <div className="w-6 h-6 rounded-lg bg-[#CE9F6B]/10 flex items-center justify-center flex-shrink-0">
                                      <MessageSquare className="w-3 h-3 text-[#CE9F6B]" />
                                   </div>
                                   <div className="flex flex-col min-w-0">
                                      <p className="text-[11px] font-bold text-[#546A7A] leading-snug line-clamp-2 italic">&ldquo;{invoice.remarks[0].content}&rdquo;</p>
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                         <span className="text-[9px] font-black text-[#92A2A5] uppercase tracking-tighter">{invoice.remarks[0].createdBy?.name?.split(' ')[0] || 'AI'}</span>
                                         <span className="w-1 h-1 rounded-full bg-[#AEBFC3]/40" />
                                         <span className="text-[9px] font-bold text-[#AEBFC3]">{new Date(invoice.remarks[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                      </div>
                                   </div>
                                </div>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2 opacity-30 italic px-2">
                                <Sparkles className="w-3 h-3" />
                                <span className="text-[10px] font-bold text-[#92A2A5]">No activity logged</span>
                             </div>
                           )}
                        </td>

                        <td className="py-5 px-4 text-right">
                           <div className="flex flex-col items-end gap-1.5">
                              <div className="relative">
                                 <p className="font-black text-[#4F6A64] text-base tracking-tight leading-none">{formatARCurrency(Number(invoice.totalAmount))}</p>
                                 <div className="absolute -left-3 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#82A094]/40 to-transparent" />
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                 <div className="flex items-center gap-2 bg-[#82A094]/5 px-2 py-0.5 rounded-md border border-[#82A094]/10">
                                    <span className="text-[9px] font-black text-[#82A094] uppercase tracking-widest">Received</span>
                                    <span className="text-[10px] font-black text-[#4F6A64]">{formatARCurrency(Number(invoice.totalReceipts))}</span>
                                 </div>
                                 <div className="flex items-center gap-2 bg-[#E17F70]/5 px-2 py-0.5 rounded-md border border-[#E17F70]/10 mt-0.5">
                                    <span className="text-[9px] font-black text-[#E17F70] uppercase tracking-widest">Balance</span>
                                    <span className="text-[10px] font-black text-[#9E3B47]">{formatARCurrency(Number(invoice.balance))}</span>
                                 </div>
                              </div>
                           </div>
                        </td>

                        <td className="py-5 px-4">
                           <div 
                             onClick={(e) => { e.stopPropagation(); toggleRow(invoice.id); }}
                             className={`group/aging flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 ${
                                criticalAging && criticalAging > 0 
                                ? 'bg-gradient-to-br from-[#E17F70]/10 to-[#E17F70]/5 border-[#E17F70]/20 text-[#9E3B47] shadow-lg shadow-[#E17F70]/5' 
                                : 'bg-gradient-to-br from-[#82A094]/10 to-[#82A094]/5 border-[#82A094]/20 text-[#4F6A64] shadow-lg shadow-[#82A094]/5'
                             } hover:scale-105 hover:border-current`}
                           >
                              <div className="flex items-center gap-2 mb-1">
                                 {criticalAging && criticalAging > 0 ? (
                                   <div className="relative">
                                     <AlertTriangle className="w-4 h-4 text-[#E17F70] animate-bounce" />
                                     <div className="absolute inset-0 bg-[#E17F70] blur-md opacity-20 animate-pulse" />
                                   </div>
                                 ) : <Timer className="w-4 h-4 text-[#82A094]" />}
                                 <span className="text-xs font-black uppercase tracking-[0.05em]">
                                   {criticalAging && criticalAging > 0 ? `${criticalAging}d Risk` : 'Optimal'}
                                 </span>
                              </div>
                              <div className="flex items-center gap-1.5 p-1 px-2.5 rounded-full bg-black/5 text-[9px] font-black tracking-widest uppercase opacity-70">
                                 {terms.length} Stages <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                           </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${invoice.id}-timeline`}><td colSpan={8} className="p-0 border-x border-b border-[#AEBFC3]/20 shadow-inner"><MilestoneTimelineView invoice={invoice} /></td></tr>
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
