'use client';

import { Fragment, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { arApi, ARInvoice, MilestonePaymentTerm, formatARCurrency, formatARDate, formatARMonth } from '@/lib/ar-api';
import { 
  Search, ChevronLeft, ChevronRight, ChevronDown, Plus, 
  TrendingUp, AlertTriangle, Clock, CheckCircle2, Calendar, 
  Wallet, Package, Timer, Truck, PackageCheck, PackageX, 
  BadgeCheck, Tag, Sparkles, ExternalLink,
  ArrowRight, CheckCircle, Layers, ShieldAlert, ShieldCheck, Shield, MessageSquare,
  Eye, Pencil, Trash2, FileSpreadsheet
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
      <div className="flex flex-col items-center justify-center py-16 text-[#92A2A5] bg-gradient-to-br from-[#AEBFC3]/5 to-[#96AEC2]/5 border-y-2 border-dashed border-[#AEBFC3]/30">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/5 mb-4 shadow-lg border border-[#AEBFC3]/20">
          <Tag className="w-6 h-6 text-[#92A2A5]" />
        </div>
        <p className="text-sm font-bold tracking-tight text-[#546A7A]">No payment milestones configured</p>
        <Link 
          href={`/finance/ar/milestones/${invoice.id}`}
          className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white text-xs font-bold hover:shadow-lg hover:shadow-[#CE9F6B]/20 transition-all"
        >
          CONFIGURE MILESTONES →
        </Link>
      </div>
    );
  }

  // Calculate collections per term using specific targets -> FIFO generic pool fallback
  const paymentsByTarget: Record<string, number> = {};
  let genericPool = 0;

  (invoice.paymentHistory || []).forEach(p => {
    if (p.milestoneTerm) {
      paymentsByTarget[p.milestoneTerm] = (paymentsByTarget[p.milestoneTerm] || 0) + (Number(p.amount) || 0);
    } else {
      genericPool += (Number(p.amount) || 0);
    }
  });

  const termCollections = milestoneTerms.map((term) => {
    const percentage = term.percentage || 0;
    const taxPercentage = term.taxPercentage || 0;
    const isNetBasis = term.calculationBasis !== 'TOTAL_AMOUNT';
    const termId = `${term.termType}-${term.termDate}-${percentage}-${taxPercentage}`;
    
    let allocatedAmount = 0;
    if (isNetBasis) {
      allocatedAmount = (netAmount * percentage) / 100;
    } else {
      const netPortion = (netAmount * percentage) / 100;
      const taxPortion = (Number(invoice.taxAmount || 0) * taxPercentage) / 100;
      allocatedAmount = netPortion + taxPortion;
    }

    let collectedForTerm = (paymentsByTarget[termId] || 0) + (paymentsByTarget[term.termType] || 0);
    
    if (paymentsByTarget[termId]) delete paymentsByTarget[termId];
    if (paymentsByTarget[term.termType]) delete paymentsByTarget[term.termType];

    if (collectedForTerm > allocatedAmount) {
      genericPool += (collectedForTerm - allocatedAmount);
      collectedForTerm = allocatedAmount;
    }

    return {
      termId,
      allocatedAmount,
      collectedForTerm,
      pendingForTerm: 0,
      collectedPercent: 0,
      isNetBasis,
    };
  });

  Object.values(paymentsByTarget).forEach(orphanAmount => {
    genericPool += orphanAmount;
  });

  termCollections.forEach(tc => {
    const gap = Math.max(0, tc.allocatedAmount - tc.collectedForTerm);
    const fromGeneric = Math.min(gap, genericPool);
    tc.collectedForTerm += fromGeneric;
    genericPool -= fromGeneric;
    
    tc.pendingForTerm = Math.max(0, tc.allocatedAmount - tc.collectedForTerm);
    tc.collectedPercent = tc.allocatedAmount > 0 ? (tc.collectedForTerm / tc.allocatedAmount) * 100 : 0;
  });

  return (
    <div className="relative bg-white border-y-2 border-[#6F8A9D]/20 shadow-inner">
      {/* Top Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-lg">
             <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wide">Payment Milestones & Aging</h3>
            <p className="text-[10px] text-white/60 font-bold uppercase">{milestoneTerms.length} Scheduled Stages</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 text-[9px] font-bold text-white/70 uppercase tracking-tight">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#E17F70] shadow-[0_0_8px_#E17F70]" /> Overdue</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#82A094] shadow-[0_0_8px_#82A094]" /> On Track</div>
          </div>
          <Link 
            href={`/finance/ar/milestones/${invoice.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-[10px] font-bold text-white hover:bg-white/25 transition-all shadow-lg"
          >
            EDIT PLAN <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Term Rows */}
      <div className="divide-y divide-[#AEBFC3]/20">
        {milestoneTerms.map((term, index) => {
          const termDate = new Date(term.termDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const termAging = Math.floor((today.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
          const allocation = termCollections[index];
          const collectedPercent = allocation?.collectedPercent || 0;
          const isFullyPaid = allocation.pendingForTerm < 0.01 && allocation.allocatedAmount > 0;
          const isTermOverdue = termAging > 0 && !isFullyPaid;

          return (
            <div key={index} className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0 px-6 py-5 transition-all duration-300 ${
              isTermOverdue ? 'bg-gradient-to-r from-[#E17F70]/5 to-[#9E3B47]/5' : 'bg-white'
            } hover:bg-[#96AEC2]/5`}>
              {/* Stage Identity */}
              <div className="sm:w-[25%] flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-lg transition-all ${
                  isFullyPaid ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white shadow-[#82A094]/20' : 
                  isTermOverdue ? 'bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10 text-[#9E3B47] border-2 border-[#E17F70]/30' : 
                  'bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/10 text-[#546A7A] border-2 border-[#6F8A9D]/20'
                }`}>
                  {isFullyPaid ? <CheckCircle className="w-5 h-5" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#546A7A] text-sm uppercase tracking-tight">
                    {term.termType === 'OTHER' ? term.customLabel : termOptions[term.termType] || term.termType}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-[#CE9F6B]">{term.percentage}%</span>
                    <span className="w-1 h-1 rounded-full bg-[#AEBFC3]/40" />
                    <span className="text-[10px] font-bold text-[#92A2A5]">{formatARDate(term.termDate)}</span>
                  </div>
                </div>
              </div>

              {/* Progress & Values */}
              <div className="sm:w-[45%] sm:px-6">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/5 p-2.5 rounded-xl border-2 border-[#AEBFC3]/20 hover:border-[#96AEC2]/40 transition-all">
                    <p className="text-[9px] font-bold text-[#92A2A5] uppercase tracking-wide mb-0.5">Allocated</p>
                    <p className="text-xs font-bold text-[#546A7A]">{formatARCurrency(allocation?.allocatedAmount || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#82A094]/15 to-[#4F6A64]/10 p-2.5 rounded-xl border-2 border-[#82A094]/20 hover:border-[#82A094]/40 transition-all">
                    <p className="text-[9px] font-bold text-[#4F6A64] uppercase tracking-wide mb-0.5">Received</p>
                    <p className="text-xs font-bold text-[#4F6A64]">{formatARCurrency(allocation?.collectedForTerm || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#E17F70]/15 to-[#9E3B47]/10 p-2.5 rounded-xl border-2 border-[#E17F70]/20 hover:border-[#E17F70]/40 transition-all">
                    <p className="text-[9px] font-bold text-[#9E3B47] uppercase tracking-wide mb-0.5">Pending</p>
                    <p className={`text-xs font-bold ${allocation?.pendingForTerm || 0 > 0 ? 'text-[#9E3B47]' : 'text-[#82A094]'}`}>
                      {formatARCurrency(allocation?.pendingForTerm || 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden shadow-inner border border-[#AEBFC3]/20">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out relative ${
                        isFullyPaid ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]' : 
                        collectedPercent >= 50 ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]' : 
                        'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]'
                      }`}
                      style={{ width: `${Math.min(100, collectedPercent)}%` }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/30" />
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold min-w-[35px] text-right ${
                    isFullyPaid ? 'text-[#82A094]' : collectedPercent >= 50 ? 'text-[#CE9F6B]' : 'text-[#6F8A9D]'
                   }`}>{isFullyPaid ? '100%' : `${Math.floor(collectedPercent)}%`}</span>
                </div>
              </div>

              {/* Status & Aging */}
              <div className="sm:w-[30%] flex items-center justify-end gap-4">
                <div className="text-right">
                  <p className={`text-lg font-bold leading-none tracking-tight ${
                    isFullyPaid ? 'text-[#82A094]' : isTermOverdue ? 'text-[#9E3B47]' : 'text-[#546A7A]'
                  }`}>
                    {isFullyPaid ? 'CLEARED' : termAging > 0 ? `${termAging}d` : `${Math.abs(termAging)}d`}
                  </p>
                  <p className="text-[9px] font-bold text-[#92A2A5] uppercase tracking-wide mt-1">
                    {isFullyPaid ? 'PAYMENT RECEIVED' : termAging > 0 ? 'OVERDUE RISK' : 'REMAINING'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg border-2 ${
                  isFullyPaid ? 'bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10 text-[#82A094] border-[#82A094]/30' : 
                  isTermOverdue ? 'bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10 text-[#E17F70] border-[#E17F70]/30' : 
                  'bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/10 text-[#546A7A] border-[#6F8A9D]/20'
                }`}>
                  {isFullyPaid ? <CheckCircle2 className="w-5 h-5" /> : 
                   isTermOverdue ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : 
                   <Timer className="w-5 h-5" />}
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#E17F70] p-5 sm:p-6 shadow-2xl shadow-[#CE9F6B]/20 group">
        {/* Animated Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 hidden sm:block">
          <div className="absolute top-4 right-16 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-12 right-40 w-56 h-56 border-4 border-white/30 rounded-full" />
          <div className="absolute top-12 left-1/4 w-20 h-20 border-2 border-white/40 rounded-full" />
        </div>
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer-slide_4s_ease-in-out_infinite]" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative p-3 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl transition-transform hover:rotate-3">
              <Wallet className="w-6 h-6 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#A2B9AF] rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Milestone Dashboard</h1>
              <p className="text-white/70 text-sm font-medium">{total} tracking records</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/finance/ar/milestones/import"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-white text-sm font-bold hover:bg-white/25 transition-all shadow-lg"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Import Milestones</span>
              <span className="sm:hidden text-xs">Import</span>
            </Link>

            <Link 
              href="/finance/ar/milestones/new"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#976E44] text-sm font-bold hover:shadow-xl hover:shadow-white/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Milestone</span>
              <span className="sm:hidden text-xs">Add</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Aging Bucket Active Filter */}
      {agingBucket && (
        <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 rounded-xl border-2 border-[#CE9F6B]/30 p-4 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70]" />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-[#976E44]">Aging Filter:</span>
            <span className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white text-xs font-bold shadow-lg shadow-[#CE9F6B]/20">{agingBucketLabels[agingBucket] || agingBucket}</span>
          </div>
          <Link href="/finance/ar/milestones" className="ml-auto px-3 py-1.5 rounded-lg bg-[#E17F70]/10 text-[#9E3B47] text-xs font-bold hover:bg-[#E17F70]/20 transition-colors border border-[#E17F70]/20">✕ Clear Filter</Link>
        </div>
      )}

      {/* Filters */}
      <div className="relative flex flex-col sm:flex-row sm:flex-wrap items-center gap-3 bg-white rounded-xl border-2 border-[#6F8A9D]/30 p-4 shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
        <div className="w-full sm:flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
          <input
            type="text"
            placeholder="Search by SO, PO or Customer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-10 pr-10 rounded-xl bg-gradient-to-r from-[#96AEC2]/5 to-[#6F8A9D]/5 border-2 border-[#6F8A9D]/30 text-sm focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 transition-all text-[#546A7A] placeholder:text-[#92A2A5]"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[#AEBFC3]/20 text-[#92A2A5] transition-colors"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => { setStatus(filter.value); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                status === filter.value ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/20' : 'text-[#5D6E73] hover:bg-[#546A7A]/10 border border-[#AEBFC3]/30'
              }`}
            >
              <filter.icon className="w-3.5 h-3.5" />
              {filter.label}
            </button>
          ))}
          
          {(search || status) && (
            <button
              onClick={() => { setSearch(''); setStatus(''); setPage(1); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#E17F70] hover:bg-[#E17F70]/10 border border-[#E17F70]/30 transition-all ml-2"
              title="Clear all filters"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
        <div className="px-5 py-4 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A]">
          <div className="flex items-center justify-between font-bold text-white text-xs uppercase tracking-wide">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/15 border border-white/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <span>Milestone Receivables Table</span>
            </div>
            <div className="px-3 py-1 rounded-lg bg-white/15 text-[10px] font-bold">
              {invoices.length} entries shown
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-gradient-to-r from-[#96AEC2]/10 via-[#6F8A9D]/5 to-transparent sticky top-0 z-10 backdrop-blur-md bg-white/95">
                <th className="w-12 py-4 px-3 border-b-2 border-[#6F8A9D]/20 text-center">
                   <div className="w-2 h-2 rounded-full bg-[#6F8A9D]/30 mx-auto" />
                </th>
                <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#6F8A9D] tracking-wide">Sales Order Info</th>
                <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#976E44] tracking-wide">PO References</th>
                <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wide">Customer Profile</th>
                <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wide">Operational Context</th>
                <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#CE9F6B] tracking-wide">Recent Activity</th>
                <th className="text-right py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wide">Financial Status</th>
                <th className="text-center py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wide">Tracking Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#AEBFC3]/20">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={8} className="p-6"><div className="h-6 bg-gradient-to-r from-[#AEBFC3]/10 to-[#96AEC2]/5 rounded-xl" /></td></tr>
                ))
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-2xl bg-[#AEBFC3]/10">
                      <Sparkles className="w-8 h-8 text-[#AEBFC3]/40" />
                    </div>
                    <p className="text-[#92A2A5] font-bold">No milestone payments found matching your search.</p>
                  </div>
                </td></tr>
              ) : (
                invoices.map((invoice, index) => {
                  const isExpanded = expandedRows.has(invoice.id);
                  const terms: MilestonePaymentTerm[] = invoice.milestoneTerms || [];
                  // Calculate critical aging — accurately taking target payments into account
                  const nAmt = Number(invoice.netAmount || 0);
                  const paymentsByTargetAgg: Record<string, number> = {};
                  let genPool = 0;
                  (invoice.paymentHistory || []).forEach((p: any) => {
                    if (p.milestoneTerm) {
                      paymentsByTargetAgg[p.milestoneTerm] = (paymentsByTargetAgg[p.milestoneTerm] || 0) + (Number(p.amount) || 0);
                    } else {
                      genPool += (Number(p.amount) || 0);
                    }
                  });

                  const criticalAging = terms.length > 0 ? (() => {
                    const sorted = terms.slice().sort((a, b) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime());
                    
                    const tColls = sorted.map(t => {
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
                      const tId = `${t.termType}-${t.termDate}-${pct}-${taxPct}`;
                      let coll = (paymentsByTargetAgg[tId] || 0) + (paymentsByTargetAgg[t.termType] || 0);
                      if (paymentsByTargetAgg[tId]) delete paymentsByTargetAgg[tId];
                      if (paymentsByTargetAgg[t.termType]) delete paymentsByTargetAgg[t.termType];
                      if (coll > alloc) {
                        genPool += (coll - alloc);
                        coll = alloc;
                      }
                      return { alloc, coll, termDate: t.termDate };
                    });

                    Object.values(paymentsByTargetAgg).forEach(amt => { genPool += amt; });

                    const overdueUnpaid: number[] = [];
                    tColls.forEach(tc => {
                      const gap = Math.max(0, tc.alloc - tc.coll);
                      const fromGen = Math.min(gap, genPool);
                      tc.coll += fromGen;
                      genPool -= fromGen;
                      const isPaid = tc.alloc > 0 ? (tc.alloc - tc.coll) < 0.01 : true;
                      if (!isPaid) {
                        const aging = Math.floor((new Date().getTime() - new Date(tc.termDate).getTime()) / (1000*60*60*24));
                        if (aging > 0) overdueUnpaid.push(aging);
                      }
                    });
                    return overdueUnpaid.sort((a, b) => b - a)[0] || null;
                  })() : null;

                  return (
                    <Fragment key={invoice.id}>
                      <tr 
                         onClick={() => toggleRow(invoice.id)}
                         className={`group cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-[#CE9F6B]/5 ring-2 ring-[#CE9F6B]/20' : index % 2 === 0 ? 'bg-white' : 'bg-[#96AEC2]/5'} hover:bg-white hover:shadow-xl hover:translate-y-[-1px] hover:z-[5] relative`}
                      >
                        <td className="py-4 px-3 text-center">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/30 rotate-180' : 'bg-[#AEBFC3]/10 text-[#546A7A] group-hover:bg-gradient-to-br group-hover:from-[#6F8A9D] group-hover:to-[#546A7A] group-hover:text-white group-hover:shadow-lg'}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </td>
                        
                        <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                           <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex flex-col group/so">
                              <div className="flex items-center gap-2 mb-1.5">
                                 <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/10 flex items-center justify-center group-hover/so:from-[#6F8A9D] group-hover/so:to-[#546A7A] transition-all shadow-sm">
                                    <Layers className="w-3 h-3 text-[#6F8A9D] group-hover/so:text-white" />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">SO Number</span>
                                    <span className="text-xs font-bold text-[#546A7A] tracking-tight group-hover/so:text-[#6F8A9D]">{invoice.soNo || 'SO-N/A'}</span>
                                 </div>
                              </div>
                           </Link>
                           <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex items-center gap-2 group/inv" onClick={(e) => e.stopPropagation()}>
                              <div className="w-6 h-6 rounded-lg bg-[#AEBFC3]/15 flex items-center justify-center group-hover/inv:bg-gradient-to-br group-hover/inv:from-[#546A7A] group-hover/inv:to-[#6F8A9D] transition-all">
                                 <ExternalLink className="w-3 h-3 text-[#546A7A] group-hover/inv:text-white" />
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">Invoice No</span>
                                 <span className="text-xs font-bold text-[#92A2A5] truncate max-w-[100px] group-hover/inv:text-[#546A7A]">{invoice.invoiceNumber || 'PENDING'}</span>
                              </div>
                           </Link>
                        </td>

                        <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                           <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex flex-col group/po">
                              <div className="flex items-center gap-2 mb-1.5">
                                 <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10 flex items-center justify-center">
                                    <Tag className="w-3 h-3 text-[#CE9F6B]" />
                                 </div>
                                 <span className="text-sm font-bold text-[#976E44] group-hover/po:text-[#CE9F6B] transition-colors">{invoice.poNo || 'NO-PO-REF'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Calendar className="w-3 h-3 text-[#92A2A5]" />
                                 <span className="text-[10px] font-bold text-[#546A7A] uppercase tracking-wide">{formatARMonth(invoice.bookingMonth) || 'NO MONTH'}</span>
                              </div>
                           </Link>
                        </td>

                        <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/finance/ar/milestones/${invoice.id}`} className="flex flex-col group/cust">
                            {invoice.customerName && (
                              <span className="text-sm font-bold text-[#546A7A] mb-1 line-clamp-1 group-hover/cust:text-[#CE9F6B] transition-colors">{invoice.customerName}</span>
                            )}
                            <div className="flex items-center gap-2">
                              {invoice.bpCode ? (
                                <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#6F8A9D]/10 to-[#546A7A]/5 text-[9px] font-bold text-[#546A7A] tracking-tight border border-[#6F8A9D]/20">{invoice.bpCode}</span>
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

                        <td className="py-4 px-4">
                           <div className="flex flex-col gap-2.5">
                              {/* Category */}
                              {invoice.type && (() => {
                                const type = invoice.type;
                                const configObj: Record<string, any> = {
                                  'LCS': { bg: 'bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10', text: 'text-[#4F6A64]', icon: 'text-[#82A094]', border: 'border-[#82A094]/20' },
                                  'NB': { bg: 'bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/10', text: 'text-[#546A7A]', icon: 'text-[#6F8A9D]', border: 'border-[#6F8A9D]/20' },
                                  'FINANCE': { bg: 'bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10', text: 'text-[#976E44]', icon: 'text-[#CE9F6B]', border: 'border-[#CE9F6B]/20' }
                                };
                                const config = configObj[type] || { bg: 'bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/10', text: 'text-[#546A7A]', icon: 'text-[#6F8A9D]', border: 'border-[#6F8A9D]/20' };

                                return (
                                  <div className="flex items-center gap-2 group/cat">
                                     <div className={`w-6 h-6 rounded-lg ${config.bg} flex items-center justify-center transition-all group-hover/cat:scale-110 shadow-sm border ${config.border}`}>
                                        <Tag className={`w-3 h-3 ${config.icon}`} />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">Category</span>
                                        <span className={`text-[10px] font-bold tracking-tight ${config.text}`}>{type}</span>
                                     </div>
                                  </div>
                                );
                              })()}
                              
                              {/* Accounting Status */}
                              {(() => {
                                const status = invoice.accountingStatus;
                                const config = status === 'REVENUE_RECOGNISED' 
                                  ? { bg: 'bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10', text: 'text-[#4F6A64]', label: 'Revenue Recognised', border: 'border-[#82A094]/20' }
                                  : status === 'BACKLOG'
                                  ? { bg: 'bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10', text: 'text-[#9E3B47]', label: 'Backlog', border: 'border-[#E17F70]/20' }
                                  : { bg: 'bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10', text: 'text-[#976E44]', label: 'Acknowledged', border: 'border-[#CE9F6B]/20' };

                                return (
                                  <div className="flex items-center gap-2 group/acc">
                                     <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all group-hover/acc:scale-110 shadow-sm ${config.bg} border ${config.border}`}>
                                        <ShieldCheck className={`w-3 h-3 ${config.text}`} />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">Acct Status</span>
                                        <span className={`text-[9px] font-bold tracking-tight leading-tight ${config.text}`}>
                                          {config.label}
                                        </span>
                                     </div>
                                  </div>
                                );
                              })()}


                           </div>
                        </td>

                        <td className="py-4 px-4">
                           {invoice.remarks && invoice.remarks.length > 0 ? (
                             <div className="group/rem relative p-3 rounded-xl bg-gradient-to-br from-white to-[#CE9F6B]/5 border-2 border-[#CE9F6B]/20 shadow-lg max-w-[220px] hover:shadow-xl hover:border-[#CE9F6B]/40 transition-all">
                                <div className="flex items-start gap-2.5">
                                   <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#CE9F6B]/20">
                                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                                   </div>
                                   <div className="flex flex-col min-w-0">
                                      <TooltipProvider>
                                        <Tooltip delayDuration={300}>
                                          <TooltipTrigger asChild>
                                            <p className="text-xs font-bold text-[#546A7A] leading-snug line-clamp-2 italic cursor-help">
                                              &ldquo;{invoice.remarks[0].content}&rdquo;
                                            </p>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[300px] p-3 text-xs bg-white text-[#546A7A] border-2 border-[#CE9F6B]/20 shadow-xl whitespace-pre-wrap break-words z-50">
                                            {invoice.remarks[0].content}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                         <span className="text-[9px] font-bold text-[#976E44] uppercase tracking-tight">{invoice.remarks[0].createdBy?.name?.split(' ')[0] || 'AI'}</span>
                                         <span className="w-1 h-1 rounded-full bg-[#CE9F6B]/40" />
                                         <span className="text-[9px] font-bold text-[#CE9F6B]">{new Date(invoice.remarks[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                      </div>
                                   </div>
                                </div>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2 opacity-40 px-2">
                                <div className="p-1.5 rounded-lg bg-[#AEBFC3]/10">
                                   <Sparkles className="w-3 h-3 text-[#AEBFC3]" />
                                </div>
                                <span className="text-[10px] font-bold text-[#92A2A5]">No activity logged</span>
                             </div>
                           )}
                        </td>

                        <td className="py-4 px-4 text-right">
                           <div className="flex flex-col items-end gap-1.5">
                              <div className="relative">
                                 <p className="font-bold text-[#4F6A64] text-base tracking-tight leading-none">{formatARCurrency(Number(invoice.totalAmount))}</p>
                                 <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-[#82A094] to-transparent rounded-full" />
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                 <div className="flex items-center gap-2 bg-gradient-to-r from-[#82A094]/10 to-[#4F6A64]/5 px-2.5 py-1 rounded-lg border border-[#82A094]/20">
                                    <span className="text-[9px] font-bold text-[#82A094] uppercase tracking-wide">Received</span>
                                    <span className="text-[10px] font-bold text-[#4F6A64]">{formatARCurrency(Number(invoice.totalReceipts))}</span>
                                 </div>
                                 <div className="flex items-center gap-2 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 px-2.5 py-1 rounded-lg border border-[#E17F70]/20">
                                    <span className="text-[9px] font-bold text-[#E17F70] uppercase tracking-wide">Balance</span>
                                    <span className="text-[10px] font-bold text-[#9E3B47]">{formatARCurrency(Number(invoice.balance))}</span>
                                 </div>
                              </div>
                           </div>
                        </td>

                        <td className="py-4 px-4">
                           <div 
                             onClick={(e) => { e.stopPropagation(); toggleRow(invoice.id); }}
                             className={`group/aging flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300 ${
                                criticalAging && criticalAging > 0 
                                ? 'bg-gradient-to-br from-[#E17F70]/15 to-[#9E3B47]/10 border-[#E17F70]/30 text-[#9E3B47] shadow-lg shadow-[#E17F70]/10' 
                                : 'bg-gradient-to-br from-[#82A094]/15 to-[#4F6A64]/10 border-[#82A094]/30 text-[#4F6A64] shadow-lg shadow-[#82A094]/10'
                             } hover:scale-105 hover:border-current`}
                           >
                              <div className="flex items-center gap-2 mb-1">
                                 {criticalAging && criticalAging > 0 ? (
                                   <div className="relative">
                                     <AlertTriangle className="w-4 h-4 text-[#E17F70] animate-bounce" />
                                     <div className="absolute inset-0 bg-[#E17F70] blur-md opacity-30 animate-pulse" />
                                   </div>
                                 ) : <Timer className="w-4 h-4 text-[#82A094]" />}
                                 <span className="text-xs font-bold uppercase tracking-wide">
                                   {criticalAging && criticalAging > 0 ? `${criticalAging}d Risk` : 'Optimal'}
                                 </span>
                              </div>
                              <div className="flex items-center gap-1.5 p-1 px-2.5 rounded-lg bg-black/5 text-[9px] font-bold tracking-wide uppercase opacity-70">
                                 {terms.length} Stages <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                           </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${invoice.id}-timeline`}><td colSpan={8} className="p-0 border-x-2 border-b-2 border-[#CE9F6B]/20 shadow-inner bg-[#CE9F6B]/[0.02]"><MilestoneTimelineView invoice={invoice} /></td></tr>
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
          <div className="relative p-5 border-t-2 border-[#6F8A9D]/20 flex justify-between items-center bg-gradient-to-r from-[#96AEC2]/5 via-transparent to-white overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
            <span className="text-xs font-bold text-[#92A2A5] tracking-wide uppercase">Page {page} of {totalPages}</span>
            <div className="flex gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-[#AEBFC3]/40 rounded-xl text-xs font-bold text-[#546A7A] hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-30 shadow-sm transition-all">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-xl text-xs font-bold text-white hover:shadow-lg hover:shadow-[#546A7A]/20 disabled:opacity-30 shadow-lg transition-all">
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
              <div key={invoice.id} className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 shadow-lg overflow-hidden transition-all active:scale-[0.98]">
                 <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
                 <div className="p-5" onClick={() => toggleRow(invoice.id)}>
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20"><Wallet className="w-4 h-4 text-white" /></div>
                          <div>
                            <div className="font-bold text-[#546A7A] text-sm">{invoice.soNo || 'SO-N/A'}</div>
                            <div className="text-[10px] font-bold text-[#976E44] tracking-wide uppercase">{invoice.poNo || 'PO-N/A'}</div>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <Link 
                            href={`/finance/ar/milestones/${invoice.id}`}
                            className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/20 active:scale-95 transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <div className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white' : 'bg-[#AEBFC3]/20 text-[#546A7A]'}`}>
                            <ChevronDown className={`w-4 h-4 transition-all ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                       </div>
                    </div>
                    
                    <div className="mb-4">
                       <h3 className="text-sm font-bold text-[#546A7A] mb-0.5">{invoice.customerName}</h3>
                       <p className="text-[10px] text-[#92A2A5] font-bold uppercase tracking-wide leading-none">{invoice.bpCode}</p>
                       
                       {invoice.remarks && invoice.remarks.length > 0 && (
                         <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 border-2 border-[#CE9F6B]/20 flex items-start gap-2">
                           <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex-shrink-0">
                             <MessageSquare className="w-3 h-3 text-white" />
                           </div>
                           <TooltipProvider>
                             <Tooltip delayDuration={300}>
                               <TooltipTrigger asChild>
                                 <p className="text-[10px] text-[#5D6E73] font-medium leading-tight line-clamp-2 italic cursor-help">
                                   &ldquo;{invoice.remarks[0].content}&rdquo;
                                 </p>
                               </TooltipTrigger>
                               <TooltipContent side="top" className="max-w-[250px] p-3 text-xs bg-white text-[#546A7A] border-2 border-[#CE9F6B]/20 shadow-xl whitespace-pre-wrap break-words z-50">
                                 {invoice.remarks[0].content}
                               </TooltipContent>
                             </Tooltip>
                           </TooltipProvider>
                         </div>
                       )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-[#AEBFC3]/20">
                       <div>
                          <p className="text-[10px] text-[#92A2A5] font-bold uppercase mb-1">Balance Due</p>
                          <p className="text-lg font-bold text-[#E17F70]">{formatARCurrency(Number(invoice.balance))}</p>
                       </div>
                       <div className="text-right flex flex-col items-end">
                          <p className="text-[10px] text-[#92A2A5] font-bold uppercase mb-1">Milestones</p>
                          <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border-2 ${invoice.balance === 0 ? 'bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10 border-[#82A094]/30 text-[#4F6A64]' : 'bg-gradient-to-r from-[#CE9F6B]/15 to-[#976E44]/10 border-[#CE9F6B]/30 text-[#976E44]'}`}>
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
