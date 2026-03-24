'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  getPendingPaymentBatches, getMyPaymentBatches, getPaymentBatchStats,
  PaymentBatch, PaymentBatchStats, formatARCurrency, formatARDate
} from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import {
  Clock, CheckCircle2, XCircle, AlertCircle, Download,
  Eye, Loader2, Package, Shield, Send, User, Filter,
  TrendingUp, Banknote, RefreshCw, ChevronRight, Calendar,
  Hash, CheckCheck, BanIcon, Activity, Search, ArrowUpDown,
  ChevronLeft, ChevronDown, Layers
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Pre-defined static tailwind classes for gradients and rings to ensure JIT compiler picks them up
const STATUS_CONFIG: Record<string, { label: string; text: string; bg: string; border: string; icon: any; ring: string; gradFrom: string; gradTo: string; progressBg: string }> = {
  PENDING:              { label: 'Pending Review',     text: 'text-[#976E44]', bg: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]/40', icon: Clock,        ring: 'ring-[#CE9F6B]/40', gradFrom: 'from-[#CE9F6B]', gradTo: 'to-[#CE9F6B]/60', progressBg: 'bg-[#CE9F6B]' },
  APPROVED:             { label: 'Approved',           text: 'text-[#4F6A64]', bg: 'bg-[#82A094]/15', border: 'border-[#82A094]/50', icon: CheckCircle2, ring: 'ring-[#82A094]/40', gradFrom: 'from-[#82A094]', gradTo: 'to-[#82A094]/60', progressBg: 'bg-[#82A094]' },
  PARTIALLY_APPROVED:   { label: 'Partially Approved', text: 'text-[#8c6033]', bg: 'bg-[#CE9F6B]/15', border: 'border-[#CE9F6B]/50', icon: AlertCircle,  ring: 'ring-[#CE9F6B]/40', gradFrom: 'from-[#CE9F6B]', gradTo: 'to-[#CE9F6B]/60', progressBg: 'bg-[#CE9F6B]' },
  REJECTED:             { label: 'Rejected',           text: 'text-[#75242D]', bg: 'bg-[#E17F70]/10', border: 'border-[#E17F70]/40', icon: XCircle,      ring: 'ring-[#E17F70]/40', gradFrom: 'from-[#E17F70]', gradTo: 'to-[#E17F70]/60', progressBg: 'bg-[#E17F70]' },
};

const ALL_STATUSES = ['ALL', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as const;

type SortKey = 'date' | 'amount' | 'items' | 'status';
type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE = 15;

export default function PaymentBatchesPage() {
  const { user } = useAuth();
  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN ||
                  user?.financeRole === FinanceRole.FINANCE_APPROVER;

  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [stats, setStats] = useState<PaymentBatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      if (isAdmin) {
        const [batchData, statsData] = await Promise.all([
          getPendingPaymentBatches('ALL'),
          getPaymentBatchStats()
        ]);
        setBatches(batchData);
        setStats(statsData);
      } else {
        const batchData = await getMyPaymentBatches();
        setBatches(batchData);
      }
    } catch {
      toast.error('Failed to load payment batches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [isAdmin]);

  const filteredBatches = useMemo(() => {
    let result = batches;
    if (statusFilter !== 'ALL') {
      result = result.filter(b => b.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        b.batchNumber?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q) ||
        b.requestedBy?.name?.toLowerCase().includes(q) ||
        b.currency?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [batches, statusFilter, searchQuery]);

  const sortedBatches = useMemo(() => {
    const sorted = [...filteredBatches];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
          break;
        case 'amount':
          cmp = Number(a.totalAmount) - Number(b.totalAmount);
          break;
        case 'items':
          cmp = a.totalItems - b.totalItems;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [filteredBatches, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedBatches.length / ITEMS_PER_PAGE);
  const displayedBatches = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedBatches.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedBatches, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchQuery, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const statCards = useMemo(() => {
    if (!stats || !isAdmin) return [];
    return [
      { key: 'ALL',                label: 'Total Batches',      value: stats.total, icon: Activity, accent: 'from-[#546A7A] to-[#6F8A9D]' },
      { key: 'PENDING',            label: 'Pending Review',    value: stats.pending, icon: Clock, accent: 'from-[#CE9F6B] to-[#976E44]' },
      { key: 'APPROVED',           label: 'Fully Approved',   value: stats.approved, icon: CheckCircle2, accent: 'from-[#82A094] to-[#4F6A64]' },
      { key: 'REJECTED',           label: 'Rejected',   value: stats.rejected, icon: XCircle, accent: 'from-[#E17F70] to-[#9E3B47]' },
    ];
  }, [stats, isAdmin]);

  const totalPendingAmount = useMemo(() =>
    batches.filter(b => b.status === 'PENDING').reduce((s, b) => s + Number(b.totalAmount), 0),
  [batches]);

  const dominantCurrency = useMemo(() => {
    const pending = batches.filter(b => b.status === 'PENDING');
    if (pending.length === 0) return 'INR';
    const freq: Record<string, number> = {};
    pending.forEach(b => { freq[b.currency] = (freq[b.currency] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'INR';
  }, [batches]);

  // Time ago helper
  const timeAgo = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatARDate(dateStr);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── Stunning Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm border border-[#AEBFC3]/30">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-gradient-to-br from-[#6F8A9D]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-gradient-to-tr from-[#CE9F6B]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="h-1.5 w-full bg-gradient-to-r from-[#546A7A] via-[#82A094] to-[#CE9F6B]" />
        
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center p-0.5 shadow-xl shadow-[#546A7A]/20 shrink-0 transform transition-transform hover:scale-105 duration-300">
              <div className="absolute inset-0 bg-white/20 rounded-2xl" />
              <div className="relative w-full h-full bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] rounded-[14px] flex items-center justify-center backdrop-blur-xl">
                {isAdmin ? <Shield className="w-7 h-7 text-white" /> : <Send className="w-7 h-7 text-white" />}
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#546A7A] tracking-tight">
                {isAdmin ? 'Batch Approvals' : 'Payment Requests'}
              </h1>
              <p className="text-sm sm:text-base text-[#6F8A9D] mt-1 font-medium">
                {isAdmin
                  ? 'Review, verify, and process vendor payment batches securely.'
                  : 'Track your submitted batches and their approval status.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="rounded-xl border-[#AEBFC3]/50 text-[#546A7A] hover:bg-[#6F8A9D]/5 hover:text-[#546A7A] transition-all h-11 px-5 font-semibold bg-white shadow-sm"
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
              Refresh Data
            </Button>
            {!isAdmin && (
              <Link href="/finance/bank-accounts/payments" className="flex-1 sm:flex-none">
                <Button className="w-full bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white rounded-xl shadow-lg hover:shadow-[#CE9F6B]/30 hover:shadow-xl font-bold h-11 px-6 transition-all transform hover:-translate-y-0.5 border-0">
                  <Send className="w-4 h-4 mr-2" /> New Request
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Premium Summary Cards (Admin Only) ─────────────────────────────────── */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {statCards.map((card, idx) => {
            const isAll = card.key === 'ALL';
            const cfg = STATUS_CONFIG[card.key];
            const Icon = card.icon;
            const isActive = statusFilter === card.key;
            
            // Premium ALL card styling
            const cardColor = isAll ? 'text-[#546A7A]' : cfg?.text;
            const bgClass = isAll 
              ? isActive ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-[#546A7A]/30' : 'bg-white hover:bg-[#F8FAFA]'
              : isActive ? `${cfg?.bg} ${cfg?.border} shadow-sm` : 'bg-white hover:bg-[#F8FAFA]';
              
            const iconBgClass = isAll
              ? isActive ? 'bg-white/20 text-white' : 'bg-[#546A7A]/10 text-[#546A7A]'
              : isActive ? 'bg-white/60 shadow-sm' : `${cfg?.bg} ${cfg?.text}`;

            return (
              <button
                key={card.key}
                onClick={() => setStatusFilter(card.key)}
                className={cn(
                  'relative overflow-hidden p-5 sm:p-6 rounded-3xl border text-left transition-all duration-300 flex flex-col justify-between min-h-[140px] group outline-none',
                  bgClass,
                  isActive ? 'shadow-lg scale-[1.02] border-transparent' : 'border-[#AEBFC3]/30 shadow-sm hover:shadow-md hover:border-[#AEBFC3]/60',
                  (isActive && isAll) && 'text-white'
                )}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Decorative background element for active state */}
                {isActive && !isAll && (
                  <div className={cn("absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl opacity-20 rounded-bl-full pointer-events-none transition-all", cfg?.gradFrom, cfg?.gradTo)} />
                )}
                {isActive && isAll && (
                  <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent opacity-40 rounded-bl-full pointer-events-none" />
                )}

                <div className="relative z-10 flex items-center justify-between w-full mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                    iconBgClass,
                    !isActive && "group-hover:scale-110"
                  )}>
                    <Icon className={cn("w-6 h-6", (isActive && isAll) ? "text-white" : cardColor)} />
                  </div>
                  {card.key === 'PENDING' && isActive && (
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CE9F6B] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#CE9F6B]"></span>
                    </span>
                  )}
                </div>
                
                <div className="relative z-10 mt-auto">
                  <p className={cn(
                    "text-xs font-bold uppercase tracking-wider mb-1", 
                    (isActive && isAll) ? 'text-white/80' : 'text-[#6F8A9D]'
                  )}>
                    {card.label}
                  </p>
                  <div className="flex items-baseline gap-3">
                    <p className={cn(
                      "text-3xl sm:text-4xl font-extrabold tracking-tight", 
                      (isActive && isAll) ? 'text-white' : cardColor
                    )}>
                      {card.value}
                    </p>
                    {card.key === 'PENDING' && (
                      <p className={cn(
                        "text-sm font-semibold", 
                        (isActive && isAll) ? 'text-white/90' : cardColor
                      )}>
                        {totalPendingAmount > 0 ? formatARCurrency(totalPendingAmount, dominantCurrency) : ''}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modern Filter & Search Bar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#AEBFC3]/30 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEBFC3]" />
              <input
                type="text"
                placeholder="Search by batch number, notes, or requester..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm font-medium bg-[#F8FAFA] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] placeholder-[#AEBFC3] focus:ring-2 focus:ring-[#546A7A]/20 focus:border-[#546A7A]/40 outline-none transition-all"
              />
            </div>

            <div className="h-8 w-px bg-[#AEBFC3]/20 hidden sm:block" />

            {/* Status Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <div className="flex items-center gap-1.5 shrink-0 mr-1">
                <Filter className="w-3.5 h-3.5 text-[#AEBFC3]" />
                <span className="text-[10px] font-bold text-[#AEBFC3] uppercase tracking-wider hidden sm:inline">Status</span>
              </div>
              {(!isAdmin ? ALL_STATUSES : ['ALL', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as const).map(s => {
                const isActive = statusFilter === s;
                const cfg = STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap border',
                      isActive
                        ? s === 'ALL'
                          ? 'bg-[#546A7A] text-white border-[#546A7A] shadow-md shadow-[#546A7A]/20'
                          : `${cfg.bg} ${cfg.border} ${cfg.text} shadow-sm ring-1 ring-offset-1 ${cfg.ring}`
                        : 'bg-white text-[#92A2A5] border-[#AEBFC3]/30 hover:border-[#546A7A]/30 hover:bg-[#F8FAFA] hover:text-[#546A7A]'
                    )}
                  >
                    {s === 'ALL' ? 'All' : cfg?.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort + Count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#F8FAFA] px-3 py-2 rounded-lg border border-[#AEBFC3]/20">
              <Layers className="w-3.5 h-3.5 text-[#AEBFC3]" />
              <span className="text-xs text-[#6F8A9D] font-medium">
                <strong className="text-[#546A7A]">{sortedBatches.length}</strong> batch{sortedBatches.length !== 1 ? 'es' : ''}
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => toggleSort(sortKey === 'date' ? 'amount' : sortKey === 'amount' ? 'items' : 'date')}
                className="flex items-center gap-1.5 bg-[#F8FAFA] px-3 py-2 rounded-lg border border-[#AEBFC3]/20 text-xs font-bold text-[#546A7A] hover:bg-[#E8EEEE] transition-all"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#6F8A9D]" />
                <span className="hidden sm:inline">{sortKey === 'date' ? 'Date' : sortKey === 'amount' ? 'Amount' : 'Items'}</span>
                <span className="text-[#AEBFC3]">{sortDir === 'desc' ? '↓' : '↑'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Exquisite Batch List ──────────────────────────────────────────────── */}
      <div className="bg-white border border-[#AEBFC3]/30 rounded-3xl shadow-sm overflow-hidden relative min-h-[400px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-[#546A7A]/20 animate-pulse" />
              <div className="w-16 h-16 rounded-2xl bg-white shadow-xl border border-[#AEBFC3]/20 flex items-center justify-center relative z-10">
                <Loader2 className="w-8 h-8 animate-spin text-[#546A7A]" />
              </div>
            </div>
            <p className="text-sm font-semibold text-[#546A7A] mt-4 animate-pulse">Fetching batch data...</p>
          </div>
        ) : displayedBatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 px-4 text-center">
            <div className="relative mb-6 group">
              <div className="absolute inset-0 bg-[#6F8A9D]/5 rounded-3xl transform rotate-6 transition-transform group-hover:rotate-12 duration-300" />
              <div className="absolute inset-0 bg-[#CE9F6B]/5 rounded-3xl transform -rotate-6 transition-transform group-hover:-rotate-12 duration-300" />
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center relative z-10 border border-[#AEBFC3]/20 shadow-xl shadow-[#546A7A]/5">
                <Package className="w-10 h-10 text-[#6F8A9D]" />
              </div>
            </div>
            <h3 className="text-[#546A7A] font-extrabold text-2xl mb-2">No batches found</h3>
            <p className="text-base text-[#6F8A9D] max-w-sm mb-2">
              {isAdmin
                ? 'There are currently no batch requests matching your selected filters.'
                : 'You have not submitted any payment batch requests yet. Get started by creating a new one.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
                className="text-sm text-[#CE9F6B] font-semibold hover:underline mb-6"
              >
                Clear filters & search
              </button>
            )}
            {!isAdmin && (
              <Link href="/finance/bank-accounts/payments">
                <Button className="rounded-xl px-8 h-12 bg-[#546A7A] hover:bg-[#435560] text-white shadow-lg font-bold transition-all transform hover:scale-105">
                  <Send className="w-4 h-4 mr-2" /> Create First Batch
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]">
                    <th className="px-6 py-4 text-[10px] font-bold text-white/80 uppercase tracking-wider w-[28%]">Batch Information</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-white/80 uppercase tracking-wider w-[15%]">
                      <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-white transition-colors">
                        Request Data
                        {sortKey === 'date' && <span className="text-white text-xs">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-white/80 uppercase tracking-wider w-[20%]">Approval Progress</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-white/80 uppercase tracking-wider w-[17%] text-right">
                      <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">
                        Valuation
                        {sortKey === 'amount' && <span className="text-white text-xs">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-white/80 uppercase tracking-wider w-[14%] text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-white/80 uppercase tracking-wider w-[6%] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEBFC3]/15">
                  {displayedBatches.map((batch, idx) => {
                    const cfg = STATUS_CONFIG[batch.status] || STATUS_CONFIG.PENDING;
                    const StatusIcon = cfg.icon;
                    const approvalPct = batch.totalItems > 0 && batch.approvedItems != null
                      ? Math.round((batch.approvedItems / batch.totalItems) * 100)
                      : 0;
                    const isReviewed = batch.status !== 'PENDING';
                    const approvedAmt = Number(batch.approvedAmount || 0);
                    const rejectedAmt = Number(batch.totalAmount) - approvedAmt;

                    return (
                      <tr 
                        key={batch.id} 
                        className="group hover:bg-[#F8FAFA] transition-all cursor-pointer bg-white" 
                        onClick={() => window.location.href = `/finance/bank-accounts/payment-batches/${batch.id}`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        {/* 1. Batch Details */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 group-hover:scale-110 group-hover:shadow-md", 
                              cfg.bg, cfg.border
                            )}>
                              <StatusIcon className={cn("w-5 h-5", cfg.text)} />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <h3 className="font-bold text-[#546A7A] text-[15px] mb-2 group-hover:text-[#CE9F6B] transition-colors flex items-center gap-2">
                                {batch.batchNumber}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                {batch.exportFormat && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-[#6F8A9D] px-2.5 py-1 rounded-md border border-[#AEBFC3]/50 shadow-sm">
                                    {batch.exportFormat}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#546A7A] text-white px-2.5 py-1 rounded-md shadow-sm">
                                  {batch.currency || 'INR'}
                                </span>
                              </div>
                              {batch.notes && (
                                <p className="text-xs text-[#6F8A9D] mt-2.5 line-clamp-2" title={batch.notes}>
                                  {batch.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Submission Info */}
                        <td className="px-6 py-5 align-top">
                          <div className="space-y-3 pt-1">
                            {isAdmin && batch.requestedBy?.name ? (
                              <div className="flex items-center gap-2.5 text-sm text-[#546A7A]">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E8EEEE] to-[#D5E0E0] flex items-center justify-center shrink-0 border border-[#AEBFC3]/30 shadow-sm">
                                  <User className="w-3.5 h-3.5 text-[#546A7A]" />
                                </div>
                                <span className="truncate max-w-[120px] font-semibold">{batch.requestedBy.name}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5 text-sm text-[#546A7A]">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E8EEEE] to-[#D5E0E0] flex items-center justify-center shrink-0 border border-[#AEBFC3]/30 shadow-sm">
                                  <User className="w-3.5 h-3.5 text-[#546A7A]" />
                                </div>
                                <span className="font-semibold">You</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-[#6F8A9D] bg-[#F0F4F4] w-fit px-2.5 py-1 rounded-md border border-[#AEBFC3]/20">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatARDate(batch.requestedAt)}
                              </div>
                              <span className="text-[10px] font-semibold text-[#AEBFC3]">
                                {timeAgo(batch.requestedAt)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Approval Progress */}
                        <td className="px-6 py-5 align-top">
                          <div className="w-full max-w-[200px] space-y-3 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#6F8A9D] font-medium">Processing</span>
                              <span className="font-bold text-[#546A7A] bg-[#F0F4F4] px-2 py-0.5 rounded text-[10px] border border-[#AEBFC3]/30">
                                {batch.totalItems} Items
                              </span>
                            </div>
                            
                            {isReviewed ? (
                              <div>
                                <div className="h-2.5 bg-[#E8EEEE] rounded-full overflow-hidden flex w-full shadow-inner border border-[#AEBFC3]/20">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] transition-all duration-1000 ease-out"
                                    style={{ width: `${approvalPct}%` }}
                                  />
                                  {100 - approvalPct > 0 && (
                                    <div
                                      className="h-full bg-gradient-to-r from-[#E17F70] to-[#75242D] transition-all duration-1000 ease-out"
                                      style={{ width: `${100 - approvalPct}%` }}
                                    />
                                  )}
                                </div>
                                <div className="flex justify-between items-center mt-2 text-[10px] font-bold tracking-wide">
                                  <span className={cn("px-1.5 py-0.5 rounded", batch.approvedItems ? "bg-[#82A094]/10 text-[#4F6A64]" : "text-[#AEBFC3]")}>
                                    {batch.approvedItems || 0} APPR
                                  </span>
                                  {(batch.totalItems - (batch.approvedItems || 0)) > 0 && (
                                    <span className="bg-[#E17F70]/10 text-[#75242D] px-1.5 py-0.5 rounded">
                                      {batch.totalItems - (batch.approvedItems || 0)} REJ
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="h-2.5 bg-[#E8EEEE] rounded-full overflow-hidden w-full relative shadow-inner border border-[#AEBFC3]/20">
                                <div className="absolute inset-0 bg-[#CE9F6B]/30 animate-pulse" />
                                <div className="h-full bg-[#CE9F6B]" style={{ width: '0%' }}/>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 4. Transactions (Amounts) */}
                        <td className="px-6 py-5 align-top text-right">
                          <div className="pt-1">
                            <p className="text-base font-extrabold text-[#546A7A] mb-2 tracking-tight">
                              {formatARCurrency(batch.totalAmount, batch.currency)}
                            </p>
                            {isReviewed && batch.approvedAmount != null && (
                              <div className="flex flex-col items-end gap-1.5">
                                {approvedAmt > 0 && (
                                  <p className="text-[11px] font-bold flex items-center justify-end gap-2 w-full bg-[#82A094]/5 px-2 py-0.5 rounded border border-[#82A094]/10">
                                    <span className="text-[#82A094] uppercase tracking-wider">APPR</span>
                                    <span className="text-[#4F6A64]">{formatARCurrency(approvedAmt, batch.currency)}</span>
                                  </p>
                                )}
                                {rejectedAmt > 0 && (
                                  <p className="text-[11px] font-bold flex items-center justify-end gap-2 w-full bg-[#E17F70]/5 px-2 py-0.5 rounded border border-[#E17F70]/10">
                                    <span className="text-[#E17F70] uppercase tracking-wider">REJ</span>
                                    <span className="text-[#75242D]">{formatARCurrency(rejectedAmt, batch.currency)}</span>
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. Status */}
                        <td className="px-6 py-5 align-middle text-center">
                           <span className={cn(
                              'text-xs font-bold px-3 py-1.5 rounded-xl border inline-flex items-center justify-center gap-2 shadow-sm',
                              cfg.bg, cfg.border, cfg.text
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", cfg.progressBg, batch.status === 'PENDING' && "animate-pulse")} />
                              {cfg.label}
                            </span>
                            {!isAdmin && batch.status === 'REJECTED' && batch.reviewNotes && (
                              <div className="mt-3 text-[10px] font-medium text-[#75242D] bg-[#E17F70]/10 p-1.5 rounded-lg flex items-start gap-1.5 max-w-[160px] mx-auto text-left" title={batch.reviewNotes}>
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                                <span className="line-clamp-2">{batch.reviewNotes}</span>
                              </div>
                            )}
                        </td>

                        {/* 6. Action */}
                        <td className="px-6 py-5 align-middle text-center pe-6">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-10 w-10 rounded-xl text-[#AEBFC3] group-hover:bg-[#546A7A] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#546A7A]/30 transition-all duration-300"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-[#AEBFC3]/15">
              {displayedBatches.map((batch, idx) => {
                const cfg = STATUS_CONFIG[batch.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = cfg.icon;
                const approvalPct = batch.totalItems > 0 && batch.approvedItems != null
                  ? Math.round((batch.approvedItems / batch.totalItems) * 100)
                  : 0;
                const isReviewed = batch.status !== 'PENDING';

                return (
                  <Link
                    key={batch.id}
                    href={`/finance/bank-accounts/payment-batches/${batch.id}`}
                    className="block p-4 sm:p-5 hover:bg-[#F8FAFA] transition-all active:bg-[#E8EEEE]/50"
                  >
                    {/* Top Row: Status Icon + Batch Number + Amount */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                          cfg.bg, cfg.border
                        )}>
                          <StatusIcon className={cn("w-5 h-5", cfg.text)} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#546A7A] text-sm truncate">{batch.batchNumber}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-[#AEBFC3]">{timeAgo(batch.requestedAt)}</span>
                            {batch.exportFormat && (
                              <>
                                <span className="w-0.5 h-0.5 rounded-full bg-[#AEBFC3]" />
                                <span className="text-[10px] font-bold text-[#6F8A9D]">{batch.exportFormat}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-[#546A7A]">
                          {formatARCurrency(batch.totalAmount, batch.currency)}
                        </p>
                        <span className={cn(
                          'text-[9px] font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 mt-1',
                          cfg.bg, cfg.border, cfg.text
                        )}>
                          <span className={cn("w-1 h-1 rounded-full", cfg.progressBg, batch.status === 'PENDING' && "animate-pulse")} />
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Meta Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#6F8A9D]">
                          <User className="w-3 h-3" />
                          {isAdmin ? (batch.requestedBy?.name || '—') : 'You'}
                        </div>
                        <span className="w-0.5 h-0.5 rounded-full bg-[#AEBFC3]" />
                        <span className="text-[10px] font-bold text-[#6F8A9D]">{batch.totalItems} items</span>
                        <span className="text-[10px] font-bold text-[#546A7A] bg-[#546A7A]/10 px-1.5 py-0.5 rounded">{batch.currency || 'INR'}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#AEBFC3]" />
                    </div>

                    {/* Progress Bar for reviewed batches */}
                    {isReviewed && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-[#E8EEEE] rounded-full overflow-hidden flex w-full">
                          <div className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64]" style={{ width: `${approvalPct}%` }} />
                          {100 - approvalPct > 0 && (
                            <div className="h-full bg-gradient-to-r from-[#E17F70] to-[#75242D]" style={{ width: `${100 - approvalPct}%` }} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rejection Notes (for requester) */}
                    {!isAdmin && batch.status === 'REJECTED' && batch.reviewNotes && (
                      <div className="mt-3 text-[10px] font-medium text-[#75242D] bg-[#E17F70]/8 p-2 rounded-lg flex items-start gap-1.5" title={batch.reviewNotes}>
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> 
                        <span className="line-clamp-2">{batch.reviewNotes}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[#AEBFC3]/20 bg-[#F8FAFA]/50">
                <span className="text-xs text-[#6F8A9D] font-medium">
                  Page <strong className="text-[#546A7A]">{currentPage}</strong> of <strong className="text-[#546A7A]">{totalPages}</strong>
                  <span className="hidden sm:inline"> · {sortedBatches.length} total</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="rounded-lg border-[#AEBFC3]/40 text-[#546A7A] hover:bg-[#E8EEEE] disabled:opacity-40 h-8 px-3 text-xs font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Prev
                  </Button>
                  {/* Page Numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            'w-8 h-8 rounded-lg text-xs font-bold transition-all',
                            currentPage === pageNum
                              ? 'bg-[#546A7A] text-white shadow-sm'
                              : 'text-[#6F8A9D] hover:bg-[#E8EEEE]'
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="rounded-lg border-[#AEBFC3]/40 text-[#546A7A] hover:bg-[#E8EEEE] disabled:opacity-40 h-8 px-3 text-xs font-semibold"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
