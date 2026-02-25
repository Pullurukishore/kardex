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
  Hash, CheckCheck, BanIcon
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Kardex semantic status colours — all 5 statuses the backend can return
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any; dot: string }> = {
  PENDING:              { label: 'Pending Review',       color: 'text-[#976E44]',  bg: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]/40', icon: Clock,         dot: 'bg-[#CE9F6B]' },
  APPROVED:             { label: 'Approved',             color: 'text-[#4F6A64]',  bg: 'bg-[#82A094]/15', border: 'border-[#82A094]/50', icon: CheckCircle2,  dot: 'bg-[#82A094]' },
  PARTIALLY_APPROVED:   { label: 'Partially Approved',   color: 'text-[#976E44]',  bg: 'bg-[#CE9F6B]/15', border: 'border-[#CE9F6B]/50', icon: AlertCircle,   dot: 'bg-[#CE9F6B]' },
  REJECTED:             { label: 'Rejected',             color: 'text-[#75242D]',  bg: 'bg-[#E17F70]/10', border: 'border-[#E17F70]/40', icon: XCircle,       dot: 'bg-[#E17F70]' },
};

const ALL_STATUSES = ['ALL', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as const;

export default function PaymentBatchesPage() {
  const { user } = useAuth();
  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN ||
                  user?.financeRole === FinanceRole.FINANCE_APPROVER;

  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [stats, setStats] = useState<PaymentBatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  const displayedBatches = useMemo(() => {
    if (statusFilter === 'ALL') return batches;
    return batches.filter(b => b.status === statusFilter);
  }, [batches, statusFilter]);

  const statCards = useMemo(() => {
    if (!stats || !isAdmin) return [];
    return [
      { key: 'ALL',                label: 'Total',      value: stats.total, icon: Hash },
      { key: 'PENDING',            label: 'Pending',    value: stats.pending, icon: Clock },
      { key: 'APPROVED',           label: 'Approved',   value: stats.approved, icon: CheckCircle2 },
      { key: 'REJECTED',           label: 'Rejected',   value: stats.rejected, icon: XCircle },
    ];
  }, [stats, isAdmin]);

  const totalPendingAmount = useMemo(() =>
    batches.filter(b => b.status === 'PENDING').reduce((s, b) => s + Number(b.totalAmount), 0),
  [batches]);

  // Detect dominant currency from pending batches for summary display
  const dominantCurrency = useMemo(() => {
    const pending = batches.filter(b => b.status === 'PENDING');
    if (pending.length === 0) return 'INR';
    const freq: Record<string, number> = {};
    pending.forEach(b => { freq[b.currency] = (freq[b.currency] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'INR';
  }, [batches]);

  return (
    <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094]" />
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center shadow-lg shadow-[#546A7A]/25 shrink-0">
                {isAdmin ? <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <Send className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-[#546A7A] truncate">
                  {isAdmin ? 'Batch Approvals' : 'Payment Requests'}
                </h1>
                <p className="text-xs sm:text-sm text-[#92A2A5] mt-0.5 truncate">
                  {isAdmin
                    ? 'Review and process payment batches'
                    : 'Track your submitted batches'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex-1 sm:flex-none rounded-xl border-[#6F8A9D]/40 text-[#546A7A] hover:bg-[#96AEC2]/10 h-10 sm:h-9"
              >
                <RefreshCw className={cn('w-4 h-4 mr-1.5', refreshing && 'animate-spin')} />
                Refresh
              </Button>
              {!isAdmin && (
                <Link href="/finance/bank-accounts/payments" className="flex-1 sm:flex-none">
                  <Button className="w-full bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white rounded-xl shadow-lg hover:shadow-[#CE9F6B]/40 hover:shadow-xl font-bold h-10 sm:h-9">
                    <Send className="w-4 h-4 mr-2" /> New Request
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Admin Summary Banners ─────────────────────────────────────── */}
        {isAdmin && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Pending — Sand */}
            <div className="bg-white/70 backdrop-blur-sm border border-[#CE9F6B]/25 rounded-2xl p-4 sm:p-5 flex items-center gap-4 relative overflow-hidden shadow-sm">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#CE9F6B] to-[#976E44]" />
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10 rounded-xl flex items-center justify-center ml-1 shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#976E44]" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-[#976E44] font-bold uppercase tracking-wide">Awaiting Review</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#976E44]">{stats.pending}</p>
                <p className="text-[10px] sm:text-xs text-[#CE9F6B] mt-0.5">pending batches</p>
              </div>
            </div>
            {/* Pending Amount — Blue */}
            <div className="bg-white/70 backdrop-blur-sm border border-[#96AEC2]/25 rounded-2xl p-4 sm:p-5 flex items-center gap-4 relative overflow-hidden shadow-sm">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#96AEC2] to-[#546A7A]" />
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#96AEC2]/15 to-[#6F8A9D]/10 rounded-xl flex items-center justify-center ml-1 shrink-0">
                <Banknote className="w-5 h-5 sm:w-6 sm:h-6 text-[#546A7A]" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-[#546A7A] font-bold uppercase tracking-wide">Pending Amount</p>
                <p className="text-xl sm:text-2xl font-extrabold text-[#546A7A]">
                  {totalPendingAmount > 0 ? formatARCurrency(totalPendingAmount, dominantCurrency) : '—'}
                </p>
                <p className="text-[10px] sm:text-xs text-[#6F8A9D] mt-0.5">total value pending</p>
              </div>
            </div>
            {/* Processed — Green */}
            <div className="bg-white/70 backdrop-blur-sm border border-[#82A094]/25 rounded-2xl p-4 sm:p-5 flex items-center gap-4 relative overflow-hidden shadow-sm">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#82A094] to-[#4F6A64]" />
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10 rounded-xl flex items-center justify-center ml-1 shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-[#4F6A64]" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-[#4F6A64] font-bold uppercase tracking-wide">Processed</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#4F6A64]">
                  {stats.approved}
                </p>
                <p className="text-[10px] sm:text-xs text-[#82A094] mt-0.5">approved batches</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Stat Filter Cards ─────────────────────────────────────────── */}
        {isAdmin && statCards.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {statCards.map((card) => {
              const cfg = STATUS_CONFIG[card.key];
              const Icon = card.icon;
              const isActive = statusFilter === card.key;
              return (
                <button
                  key={card.key}
                  onClick={() => setStatusFilter(card.key)}
                  className={cn(
                    'p-3 sm:p-3.5 rounded-xl border text-left transition-all hover:shadow-md',
                    isActive
                      ? (card.key === 'ALL'
                          ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] border-transparent shadow-md shadow-[#6F8A9D]/30 scale-[1.03]'
                          : `border-transparent shadow-md scale-[1.03] ${cfg?.bg.replace('/10','').replace('/15','')} ${cfg?.border}`)
                      : 'bg-white border-[#AEBFC3]/40 hover:border-[#96AEC2]/50 hover:bg-[#96AEC2]/5 hover:scale-[1.01]'
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2 text-[#92A2A5]">
                    <Icon className={cn('w-4 h-4', isActive ? (card.key === 'ALL' ? 'text-white/80' : cfg?.color) : 'text-[#92A2A5]')} />
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                  </div>
                  <p className={cn('text-lg sm:text-xl font-bold leading-tight', isActive ? (card.key === 'ALL' ? 'text-white' : cfg?.color) : 'text-[#546A7A]')}>{card.value}</p>
                  <p className={cn('text-[10px] sm:text-xs font-medium mt-0.5 truncate', isActive ? (card.key === 'ALL' ? 'text-white/70' : cfg?.color + ' opacity-70') : 'text-[#92A2A5]')}>{card.label}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Filter chips (non-admin) ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-[#92A2A5]">
              <Filter className="w-3.5 h-3.5" />
              <span className="text-xs font-black uppercase tracking-widest">Filter By Status</span>
            </div>
            {!isAdmin && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 no-scrollbar sm:no-auto">
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all whitespace-nowrap',
                      statusFilter === s
                        ? s === 'ALL'
                          ? 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-transparent shadow-sm'
                          : `${STATUS_CONFIG[s]?.bg} ${STATUS_CONFIG[s]?.border} ${STATUS_CONFIG[s]?.color} shadow-sm`
                        : 'bg-white text-[#5D6E73] border-[#AEBFC3]/40 hover:border-[#96AEC2]/50 hover:bg-[#96AEC2]/5'
                    )}
                  >
                    {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs sm:text-sm text-[#92A2A5] font-bold uppercase tracking-wider">
            {displayedBatches.length} batch{displayedBatches.length !== 1 ? 'es' : ''} found
          </span>
        </div>

        {/* ── Batch List ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-[#6F8A9D]" />
            <p className="text-sm text-[#546A7A] font-medium">Loading payment batches…</p>
          </div>
        ) : displayedBatches.length === 0 ? (
           <div className="text-center py-24 space-y-4">
            <div className="w-16 h-16 bg-[#96AEC2]/10 rounded-2xl flex items-center justify-center mx-auto border border-[#96AEC2]/25">
              <Package className="w-8 h-8 text-[#6F8A9D]" />
            </div>
            <div>
              <p className="text-[#546A7A] font-semibold text-lg">No batches found</p>
              <p className="text-sm text-[#ABACA9] mt-1">
                {isAdmin
                  ? 'Batches submitted by finance users will appear here'
                  : 'Submit a payment request from the Bulk Payments page'}
              </p>
            </div>
            {!isAdmin && (
              <Link href="/finance/bank-accounts/payments">
                <Button variant="outline" className="mt-2 rounded-xl border-[#6F8A9D]/40 text-[#546A7A] hover:bg-[#96AEC2]/10">
                  <Send className="w-4 h-4 mr-2" /> Go to Bulk Payments
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedBatches.map(batch => {
              const cfg = STATUS_CONFIG[batch.status] || STATUS_CONFIG.PENDING;
              const StatusIcon = cfg.icon;
              const approvalPct = batch.totalItems > 0 && batch.approvedItems != null
                ? Math.round((batch.approvedItems / batch.totalItems) * 100)
                : null;
              const isReviewed = batch.status !== 'PENDING';
              const approvedAmt = Number(batch.approvedAmount || 0);
              const rejectedAmt = Number(batch.totalAmount) - approvedAmt;

              return (
                <Link key={batch.id} href={`/finance/bank-accounts/payment-batches/${batch.id}`}>
                  <div className="group bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl hover:shadow-lg hover:shadow-[#6F8A9D]/10 hover:border-[#96AEC2]/40 transition-all cursor-pointer overflow-hidden">
                    {/* Status-coloured top accent bar */}
                    <div className={cn('h-1 w-full', cfg.dot)} />
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Left Content */}
                        <div className="flex items-start gap-4 min-w-0">
                          <div className={cn('w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border shrink-0', cfg.bg, cfg.border)}>
                            <StatusIcon className={cn('w-5 h-5', cfg.color)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-bold text-[#546A7A] group-hover:text-[#4F6A64] transition-colors font-mono text-sm sm:text-base">
                                {batch.batchNumber}
                              </h3>
                              <span className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full border h-5 flex items-center',
                                cfg.bg, cfg.border, cfg.color
                              )}>
                                {cfg.label}
                              </span>
                              {batch.exportFormat && (
                                <span className="text-[9px] font-black font-mono bg-[#96AEC2]/10 text-[#546A7A] px-1.5 py-0.5 rounded border border-[#96AEC2]/20 uppercase">
                                  {batch.exportFormat}
                                </span>
                              )}
                            </div>
                            
                            {/* Meta Info */}
                            <div className="flex items-center gap-x-3 gap-y-1.5 text-[11px] text-[#92A2A5] flex-wrap font-medium">
                              {isAdmin && batch.requestedBy?.name && (
                                <span className="flex items-center gap-1 text-[#5D6E73]">
                                  <User className="w-3 h-3 text-[#6F8A9D]" /> {batch.requestedBy.name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#6F8A9D]" /> {formatARDate(batch.requestedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3 text-[#6F8A9D]" /> {batch.totalItems} items
                              </span>
                              {batch.currency && (
                                <span className="font-black bg-[#96AEC2]/10 text-[#546A7A] px-1.5 py-0.5 rounded text-[10px] border border-[#96AEC2]/20">
                                  {batch.currency}
                                </span>
                              )}
                            </div>

                            {batch.notes && (
                              <p className="text-xs text-[#ABACA9] mt-2 italic truncate max-w-sm">"{batch.notes}"</p>
                            )}
                            
                            {/* Approval progress bar (Only on Mobile - Integrated) */}
                            {isReviewed && approvalPct !== null && (
                              <div className="mt-3 sm:hidden">
                                <div className="h-1 bg-[#AEBFC3]/20 rounded-full overflow-hidden flex">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] transition-all"
                                    style={{ width: `${approvalPct}%` }}
                                  />
                                  {100 - approvalPct > 0 && (
                                    <div
                                      className="h-full bg-[#E17F70]/40 transition-all"
                                      style={{ width: `${100 - approvalPct}%` }}
                                    />
                                  )}
                                </div>
                                <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-[#ABACA9] uppercase tracking-tighter">
                                  <span>{approvalPct}% Approved</span>
                                  <span>{batch.approvedItems}/{batch.totalItems} Items</span>
                                </div>
                              </div>
                            )}

                            {/* Desktop Approval Progress */}
                            {isReviewed && approvalPct !== null && (
                              <div className="mt-3 hidden sm:flex items-center gap-2">
                                <div className="flex-1 max-w-[160px] h-1.5 bg-[#AEBFC3]/20 rounded-full overflow-hidden flex">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-l-full transition-all"
                                    style={{ width: `${approvalPct}%` }}
                                  />
                                  {100 - approvalPct > 0 && (
                                    <div
                                      className="h-full bg-[#E17F70]/40 transition-all"
                                      style={{ width: `${100 - approvalPct}%` }}
                                    />
                                  )}
                                </div>
                                <span className="text-[10px] text-[#ABACA9] font-bold uppercase tracking-wider">
                                  {batch.approvedItems}/{batch.totalItems} approved
                                </span>
                              </div>
                            )}

                            {!isAdmin && batch.status === 'REJECTED' && batch.reviewNotes && (
                              <p className="text-[10px] text-[#75242D] mt-2 flex items-center gap-1 bg-[#E17F70]/10 px-2 py-1 rounded-lg border border-[#E17F70]/20 w-fit font-bold uppercase tracking-tighter">
                                <XCircle className="w-3 h-3" /> {batch.reviewNotes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right Content — Amount & Actions */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 sm:gap-1.5 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#AEBFC3]/10">
                          <div className="sm:text-right">
                            <p className="text-base sm:text-lg font-black text-[#546A7A] tabular-nums">
                              {formatARCurrency(batch.totalAmount, batch.currency)}
                            </p>
                            {isReviewed && batch.approvedAmount != null && (
                              <div className="flex sm:flex-col gap-2 sm:gap-0.5 mt-0.5">
                                <p className="text-[10px] sm:text-xs text-[#4F6A64] font-black flex items-center gap-1 justify-start sm:justify-end">
                                  <CheckCheck className="w-3 h-3" /> {formatARCurrency(approvedAmt, batch.currency)}
                                </p>
                                {rejectedAmt > 0 && (
                                  <p className="text-[10px] sm:text-xs text-[#75242D] font-bold flex items-center gap-1 justify-start sm:justify-end">
                                    <XCircle className="w-3 h-3" /> {formatARCurrency(rejectedAmt, batch.currency)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6F8A9D] uppercase tracking-widest sm:opacity-0 group-hover:opacity-100 transition-opacity bg-[#6F8A9D]/5 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-full">
                            Details <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </div>
  );
}
