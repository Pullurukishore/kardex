'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import {
  getPaymentBatchById, reviewPaymentBatch, downloadPaymentBatch,
  PaymentBatch, formatARCurrency, formatARDate
} from '@/lib/ar-api';
import {
  downloadICICICMS, downloadStandardPayment, downloadICICICMS_CSV, downloadICICICMS_TXT,
  downloadStandard_CSV, downloadStandard_TXT, PaymentRow
} from '@/lib/payment-excel-utils';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  Download, Shield, Send, User, Calendar, Hash, Banknote,
  FileSpreadsheet, FileText, FileCode, Package, Building2,
  CreditCard, ChevronDown, TrendingUp,
  CheckCheck, BanIcon, Info, Eye
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  PENDING:            { label: 'Pending Review',     color: 'text-[#976E44]',  bg: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]/40', icon: Clock },
  APPROVED:           { label: 'Approved',           color: 'text-[#4F6A64]',  bg: 'bg-[#82A094]/15', border: 'border-[#82A094]/50', icon: CheckCircle2 },
  PARTIALLY_APPROVED: { label: 'Partially Approved', color: 'text-[#976E44]',  bg: 'bg-[#CE9F6B]/15', border: 'border-[#CE9F6B]/40', icon: AlertCircle },
  REJECTED:           { label: 'Rejected',           color: 'text-[#75242D]',  bg: 'bg-[#E17F70]/10', border: 'border-[#E17F70]/40', icon: XCircle },
  DOWNLOADED:         { label: 'Downloaded',         color: 'text-[#546A7A]',  bg: 'bg-[#96AEC2]/15', border: 'border-[#96AEC2]/40', icon: Download },
};

const ITEM_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: 'Pending',  color: 'text-[#976E44]',  bg: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]/30' },
  APPROVED: { label: 'Approved', color: 'text-[#4F6A64]',  bg: 'bg-[#82A094]/15', border: 'border-[#82A094]/40' },
  REJECTED: { label: 'Rejected', color: 'text-[#75242D]',  bg: 'bg-[#E17F70]/10', border: 'border-[#E17F70]/30' },
};

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const batchId = params.id as string;
  const isApprover = user?.financeRole === FinanceRole.FINANCE_ADMIN ||
                     user?.financeRole === FinanceRole.FINANCE_APPROVER;

  const [batch, setBatch] = useState<PaymentBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const [decisions, setDecisions] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'items' | 'summary' | 'preview'>('items');
  const [previewFormat, setPreviewFormat] = useState<'ICICI' | 'STANDARD'>('ICICI');


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getPaymentBatchById(batchId);
        setBatch(data);
        if (data.exportFormat === 'ICICI' || data.exportFormat === 'STANDARD') {
          setPreviewFormat(data.exportFormat as 'ICICI' | 'STANDARD');
        }
        const init: Record<string, 'APPROVED' | 'REJECTED'> = {};
        data.items.forEach(item => { init[item.id] = item.status === 'PENDING' ? 'APPROVED' : item.status as 'APPROVED' | 'REJECTED'; });
        setDecisions(init);
      } catch {
        toast.error('Failed to load batch');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [batchId]);

  const toggleDecision = (itemId: string) => {
    setDecisions(prev => ({ ...prev, [itemId]: prev[itemId] === 'APPROVED' ? 'REJECTED' : 'APPROVED' }));
  };

  const approveAll = () => {
    if (!batch) return;
    const init: Record<string, 'APPROVED' | 'REJECTED'> = {};
    batch.items.forEach(item => { init[item.id] = 'APPROVED'; });
    setDecisions(init);
    setRejectReasons({});
  };

  const rejectAll = () => {
    if (!batch) return;
    const init: Record<string, 'APPROVED' | 'REJECTED'> = {};
    batch.items.forEach(item => { init[item.id] = 'REJECTED'; });
    setDecisions(init);
  };

  const handleSubmitReview = async () => {
    if (!batch) return;
    const rejected = Object.entries(decisions).filter(([, s]) => s === 'REJECTED');
    for (const [id] of rejected) {
      if (!rejectReasons[id]?.trim()) {
        toast.error('Please provide a reason for each rejected item');
        return;
      }
    }
    setSubmitting(true);
    try {
      const items = Object.entries(decisions).map(([id, status]) => ({
        id, status, rejectReason: status === 'REJECTED' ? rejectReasons[id] : undefined
      }));
      const result = await reviewPaymentBatch(batchId, { items, reviewNotes: reviewNotes || undefined });
      toast.success(result.message);
      setBatch(result.batch);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadApproved = async (format: 'ICICI' | 'STANDARD', subFormat: 'EXCEL' | 'CSV' | 'TXT') => {
    if (!batch) return;
    setDownloading(true);
    setShowDownloadMenu(false);
    try {
      const dlData = await downloadPaymentBatch(batchId);
      const rows: PaymentRow[] = dlData.approvedItems.map((item: any) => ({
        vendorName: item.vendorName,
        bpCode: item.bpCode || '',
        accountNumber: item.accountNumber,
        ifscCode: item.ifscCode,
        bankName: item.bankName,
        amount: item.amount,
        emailId: item.emailId || '',
        valueDate: new Date(item.valueDate),
        transactionMode: item.transactionMode as 'NFT' | 'RTI' | 'FT',
        accountType: item.accountType || ''
      }));
      if (format === 'ICICI') {
        if (subFormat === 'CSV') await downloadICICICMS_CSV(rows);
        else if (subFormat === 'TXT') await downloadICICICMS_TXT(rows);
        else await downloadICICICMS(rows);
      } else {
        if (subFormat === 'CSV') await downloadStandard_CSV(rows);
        else if (subFormat === 'TXT') await downloadStandard_TXT(rows);
        else await downloadStandardPayment(rows);
      }
      toast.success('Downloaded successfully');
      const updated = await getPaymentBatchById(batchId);
      setBatch(updated);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#96AEC2]/8 via-white to-[#82A094]/5">
        <Loader2 className="w-10 h-10 animate-spin text-[#6F8A9D]" />
        <p className="text-sm text-[#546A7A] font-medium">Loading batch details…</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#96AEC2]/8 via-white to-[#82A094]/5">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-[#96AEC2]/10 rounded-2xl flex items-center justify-center mx-auto border border-[#96AEC2]/25">
            <Package className="w-8 h-8 text-[#6F8A9D]" />
          </div>
          <div>
            <p className="text-slate-700 font-semibold text-lg">Batch not found</p>
            <p className="text-sm text-slate-400">This batch may have been deleted or doesn't exist</p>
          </div>
          <Link href="/finance/bank-accounts/payment-batches">
            <Button variant="outline" className="rounded-xl border-[#6F8A9D]/40 text-[#546A7A] hover:bg-[#96AEC2]/10">Back to Batches</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isPending = batch.status === 'PENDING';
  const isReviewed = ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'DOWNLOADED'].includes(batch.status);
  const canDownload = ['APPROVED', 'PARTIALLY_APPROVED', 'DOWNLOADED'].includes(batch.status);

  const approvedCount = isPending
    ? Object.values(decisions).filter(s => s === 'APPROVED').length
    : (batch.approvedItems || 0);
  const rejectedCount = isPending
    ? Object.values(decisions).filter(s => s === 'REJECTED').length
    : (batch.totalItems - (batch.approvedItems || 0));
  const approvedTotal = isPending
    ? batch.items.filter(i => decisions[i.id] === 'APPROVED').reduce((sum, i) => sum + Number(i.amount), 0)
    : Number(batch.approvedAmount || 0);

  const approvedPct = batch.totalItems > 0 ? Math.round((approvedCount / batch.totalItems) * 100) : 0;
  const cfg = STATUS_CONFIG[batch.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = cfg.icon;

  const byBank = batch.items.reduce<Record<string, { count: number; total: number; currency: string }>>((acc, item) => {
    const bank = item.bankName || 'Unknown Bank';
    if (!acc[bank]) acc[bank] = { count: 0, total: 0, currency: batch.currency };
    acc[bank].count++;
    acc[bank].total += Number(item.amount);
    return acc;
  }, {});

  const byMode = batch.items.reduce<Record<string, { count: number; total: number }>>((acc, item) => {
    const mode = item.transactionMode || 'UNKNOWN';
    if (!acc[mode]) acc[mode] = { count: 0, total: 0 };
    acc[mode].count++;
    acc[mode].total += Number(item.amount);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#96AEC2]/8 via-white to-[#82A094]/5">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/finance/bank-accounts/payment-batches">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-[#96AEC2]/15 text-[#546A7A] mt-0.5">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-800 font-mono">{batch.batchNumber}</h1>
                <span className={cn(
                  'text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5',
                  cfg.bg, cfg.border, cfg.color
                )}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {cfg.label}
                </span>
                {batch.exportFormat && (
                  <span className="text-[10px] font-bold font-mono bg-[#96AEC2]/15 text-[#546A7A] px-2 py-0.5 rounded-full border border-[#96AEC2]/25">
                    {batch.exportFormat === 'ICICI' ? 'ICICI CMS' : 'Standard NEFT/RTGS'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  Submitted by <strong className="text-slate-700 ml-1">{batch.requestedBy?.name || '—'}</strong>
                </span>
                <span className="text-[#AEBFC3]">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" /> {formatARDate(batch.requestedAt)}
                </span>
                {batch.reviewedBy && (
                  <>
                    <span className="text-[#AEBFC3]">•</span>
                    <span className="flex items-center gap-1 text-[#4F6A64]">
                      <Shield className="w-3.5 h-3.5" />
                      Reviewed by <strong className="ml-1">{batch.reviewedBy.name}</strong>
                    </span>
                  </>
                )}
                {batch.downloadedAt && (
                  <>
                    <span className="text-[#AEBFC3]">•</span>
                    <span className="flex items-center gap-1 text-[#546A7A]">
                      <Download className="w-3.5 h-3.5" />
                      Downloaded {formatARDate(batch.downloadedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Download */}
          {canDownload && isApprover && (
            <div className="relative shrink-0">
              <Button
                onClick={() => setShowDownloadMenu(v => !v)}
                disabled={downloading}
                className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white rounded-xl shadow-lg shadow-[#CE9F6B]/30 font-bold"
              >
                {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Download
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-[#AEBFC3]/30 rounded-2xl shadow-xl shadow-[#6F8A9D]/10 z-50 p-3 w-72 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide px-2 mb-2">ICICI Format</p>
                    <div className="flex gap-2">
                      {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                        <button key={f} onClick={() => handleDownloadApproved('ICICI', f)}
                          className="flex-1 text-xs font-semibold py-2 px-2 border border-[#AEBFC3]/40 rounded-lg hover:bg-[#96AEC2]/8 text-slate-600 transition-colors">
                          {f === 'EXCEL' ? <FileSpreadsheet className="w-3.5 h-3.5 mx-auto mb-0.5 text-[#6F8A9D]" /> : f === 'CSV' ? <FileText className="w-3.5 h-3.5 mx-auto mb-0.5 text-[#6F8A9D]" /> : <FileCode className="w-3.5 h-3.5 mx-auto mb-0.5 text-[#6F8A9D]" />}
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide px-2 mb-2">Standard Format</p>
                    <div className="flex gap-2">
                      {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                        <button key={f} onClick={() => handleDownloadApproved('STANDARD', f)}
                          className="flex-1 text-xs font-semibold py-2 px-2 border border-[#96AEC2]/40 rounded-lg hover:bg-[#96AEC2]/10 text-[#546A7A] transition-colors bg-[#96AEC2]/5">
                          {f === 'EXCEL' ? <FileSpreadsheet className="w-3.5 h-3.5 mx-auto mb-0.5" /> : f === 'CSV' ? <FileText className="w-3.5 h-3.5 mx-auto mb-0.5" /> : <FileCode className="w-3.5 h-3.5 mx-auto mb-0.5" />}
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Metric Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl p-5 space-y-1">
            <div className="flex items-center gap-2 text-[#6F8A9D] text-xs font-semibold uppercase tracking-wide">
              <Hash className="w-3.5 h-3.5" /> Total Items
            </div>
            <p className="text-3xl font-bold text-slate-800">{batch.totalItems}</p>
            <p className="text-xs text-slate-400">payment entries</p>
          </div>
          <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl p-5 space-y-1">
            <div className="flex items-center gap-2 text-[#6F8A9D] text-xs font-semibold uppercase tracking-wide">
              <Banknote className="w-3.5 h-3.5" /> Total Amount
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatARCurrency(batch.totalAmount, batch.currency)}</p>
            <p className="text-xs text-slate-400">{batch.currency || 'INR'}</p>
          </div>
          <div className={cn(
            'rounded-2xl p-5 space-y-1 border',
            approvedCount > 0 ? 'bg-[#82A094]/10 border-[#82A094]/40' : 'bg-white border-[#AEBFC3]/30'
          )}>
            <div className="flex items-center gap-2 text-[#4F6A64] text-xs font-semibold uppercase tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approved
            </div>
            <p className="text-3xl font-bold text-[#4F6A64]">{approvedCount}</p>
            <p className="text-xs text-[#82A094]">{formatARCurrency(approvedTotal, batch.currency)}</p>
          </div>
          <div className={cn(
            'rounded-2xl p-5 space-y-1 border',
            rejectedCount > 0 ? 'bg-[#E17F70]/10 border-[#E17F70]/30' : 'bg-white border-[#AEBFC3]/30'
          )}>
            <div className="flex items-center gap-2 text-[#75242D] text-xs font-semibold uppercase tracking-wide">
              <XCircle className="w-3.5 h-3.5" /> Rejected
            </div>
            <p className="text-3xl font-bold text-[#75242D]">{rejectedCount}</p>
            <p className="text-xs text-[#E17F70]">
              {rejectedCount > 0 ? formatARCurrency(Number(batch.totalAmount) - approvedTotal, batch.currency) : '—'}
            </p>
          </div>
        </div>

        {/* ── Approval Progress Bar ────────────────────────────────────────── */}
        {batch.totalItems > 0 && (
          <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#6F8A9D]" />
                <span className="text-sm font-bold text-slate-700">Approval Progress</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#82A094]" />
                  <span className="text-slate-600 font-medium">{approvedPct}% approved</span>
                </span>
                {rejectedCount > 0 && (
                  <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E17F70]/60" />
                    <span className="text-slate-500">{100 - approvedPct}% rejected</span>
                  </span>
                )}
              </div>
            </div>
            <div className="h-3 bg-[#AEBFC3]/20 rounded-full overflow-hidden flex">
              <div className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] transition-all rounded-l-full"
                style={{ width: `${approvedPct}%` }}
              />
              {rejectedCount > 0 && (
                <div
                  className="h-full bg-[#E17F70]/30 transition-all"
                  style={{ width: `${100 - approvedPct}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span>{approvedCount} approved • {formatARCurrency(approvedTotal, batch.currency)}</span>
              <span>{rejectedCount} rejected</span>
            </div>
          </div>
        )}

        {/* ── Notes / Review Info ──────────────────────────────────────────── */}
        <div className="flex gap-4 flex-col sm:flex-row">
          {batch.notes && (
            <div className="flex-1 bg-[#96AEC2]/8 border border-[#96AEC2]/25 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-[#546A7A] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide mb-0.5">Batch Notes</p>
                <p className="text-sm text-slate-600">{batch.notes}</p>
              </div>
            </div>
          )}
          {isReviewed && batch.reviewedBy && (
            <div className="flex-1 bg-[#82A094]/10 border border-[#82A094]/30 rounded-xl p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-[#4F6A64] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#4F6A64] uppercase tracking-wide mb-0.5">Reviewed By</p>
                <p className="text-sm font-semibold text-slate-700">{batch.reviewedBy.name}</p>
                <p className="text-xs text-slate-400">{formatARDate(batch.reviewedAt)}</p>
                {batch.reviewNotes && <p className="text-xs text-[#976E44] mt-1 italic">"{batch.reviewNotes}"</p>}
              </div>
            </div>
          )}
        </div>

        {/* ── Quick Action Bar ─────────────────────────────────────────────── */}
        {isPending && isApprover && (
          <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#82A094]" />
                  <div>
                    <p className="text-sm font-bold text-[#4F6A64]">{approvedCount} Approved</p>
                    <p className="text-xs text-[#82A094]">{formatARCurrency(approvedTotal, batch.currency)}</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-[#CE9F6B]/20" />
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-[#976E44]" />
                  <div>
                    <p className="text-sm font-bold text-[#75242D]">{rejectedCount} Rejected</p>
                    <p className="text-xs text-[#976E44]">
                      {rejectedCount > 0 ? formatARCurrency(Number(batch.totalAmount) - approvedTotal, batch.currency) : '—'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={approveAll}
                  className="border-[#82A094]/40 text-[#4F6A64] hover:bg-[#82A094]/10 rounded-lg font-semibold"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Approve All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rejectAll}
                  className="border-[#E17F70]/40 text-[#75242D] hover:bg-[#E17F70]/10 rounded-lg font-semibold"
                >
                  <BanIcon className="w-3.5 h-3.5 mr-1.5" /> Reject All
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-[#96AEC2]/10 rounded-xl p-1 w-fit border border-[#96AEC2]/20">
          <button
            onClick={() => setActiveTab('items')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'items'
                ? 'bg-white text-[#546A7A] shadow-sm'
                : 'text-[#6F8A9D] hover:text-[#546A7A]'
            )}
          >
            Payment Items ({batch.items.length})
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'summary'
                ? 'bg-white text-[#546A7A] shadow-sm'
                : 'text-[#6F8A9D] hover:text-[#546A7A]'
            )}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'preview'
                ? 'bg-white text-[#546A7A] shadow-sm'
                : 'text-[#6F8A9D] hover:text-[#546A7A]'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Format Preview
            {batch.exportFormat && (
              <span className="text-[10px] bg-[#96AEC2]/20 text-[#546A7A] px-1.5 py-0.5 rounded font-bold ml-0.5">
                {batch.exportFormat === 'ICICI' ? 'ICICI' : 'STD'}
              </span>
            )}
          </button>
        </div>

        {/* ── Items Table ──────────────────────────────────────────────────── */}
        {activeTab === 'items' && (
          <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#AEBFC3]/20 flex items-center justify-between bg-[#96AEC2]/5">
              <div>
                <h2 className="font-bold text-slate-800">Payment Items</h2>
                <p className="text-xs text-[#546A7A] mt-0.5">{batch.items.length} entries • {batch.currency || 'INR'}</p>
              </div>
              {isPending && isApprover && (
                <span className="text-xs text-[#546A7A] bg-[#96AEC2]/15 border border-[#96AEC2]/30 px-2.5 py-1 rounded-full font-semibold">
                  Toggle each row to approve/reject
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#96AEC2]/8 border-b border-[#AEBFC3]/20">
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">Bank Account</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">IFSC</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">Bank</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">Mode</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">Status</th>
                    {isPending && isApprover && (
                      <th className="text-center px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wider">Decision</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEBFC3]/15">
                  {batch.items.map((item, idx) => {
                    const itemDecision = (isPending && isApprover) ? decisions[item.id] : item.status;
                    const itemCfg = ITEM_STATUS[itemDecision] || ITEM_STATUS.PENDING;
                    const isRejectedRow = isPending && isApprover && decisions[item.id] === 'REJECTED';

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'hover:bg-[#96AEC2]/5 transition-colors',
                          isRejectedRow && 'bg-[#E17F70]/5'
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-[#546A7A] font-mono bg-[#96AEC2]/10 px-1.5 py-0.5 rounded border border-[#AEBFC3]/30">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-800 text-sm">{item.vendorName}</p>
                          {item.bpCode && <p className="text-xs text-[#6F8A9D] font-mono">{item.bpCode}</p>}
                          {item.emailId && <p className="text-xs text-slate-400 truncate max-w-[140px]">{item.emailId}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-xs text-slate-700 bg-[#96AEC2]/8 border border-[#AEBFC3]/30 px-2 py-1 rounded-lg inline-block">
                            {item.accountNumber}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-xs text-[#546A7A]">{item.ifscCode}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-600 font-medium max-w-[120px] truncate">{item.bankName || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs font-bold font-mono bg-[#96AEC2]/10 text-[#546A7A] px-2 py-1 rounded-lg border border-[#AEBFC3]/30">
                            {item.transactionMode}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <p className="font-bold text-slate-800">{formatARCurrency(Number(item.amount), batch.currency)}</p>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn(
                            'text-xs font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1',
                            itemCfg.bg, itemCfg.border, itemCfg.color
                          )}>
                            {itemDecision === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                            {itemDecision === 'REJECTED' && <XCircle className="w-3 h-3" />}
                            {itemDecision === 'PENDING' && <Clock className="w-3 h-3" />}
                            {itemCfg.label}
                          </span>
                          {item.rejectReason && (
                            <p className="text-xs text-[#976E44] mt-1 max-w-[120px] mx-auto text-left">{item.rejectReason}</p>
                          )}
                        </td>
                        {isPending && isApprover && (
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <button
                                onClick={() => toggleDecision(item.id)}
                                className={cn(
                                  'w-24 text-xs font-bold py-2 rounded-lg border transition-all',
                                  decisions[item.id] === 'APPROVED'
                                    ? 'bg-[#82A094]/15 border-[#82A094]/40 text-[#4F6A64] hover:bg-[#82A094]/25'
                                    : 'bg-[#E17F70]/10 border-[#E17F70]/30 text-[#75242D] hover:bg-[#E17F70]/20'
                                )}
                              >
                                {decisions[item.id] === 'APPROVED' ? '✓ Approve' : '✗ Reject'}
                              </button>
                              {decisions[item.id] === 'REJECTED' && (
                                <input
                                  type="text"
                                  placeholder="Reason (required)"
                                  value={rejectReasons[item.id] || ''}
                                  onChange={e => setRejectReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-32 text-xs border border-[#E17F70]/30 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#E17F70]/30 outline-none bg-[#E17F70]/5"
                                />
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#96AEC2]/8 border-t-2 border-[#AEBFC3]/30">
                    <td colSpan={6} className="px-4 py-3 text-xs font-bold text-[#546A7A] uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold text-slate-800 text-base">{formatARCurrency(batch.totalAmount, batch.currency)}</p>
                    </td>
                    <td colSpan={isPending && isApprover ? 2 : 1} className="px-4 py-3 text-center text-xs text-[#546A7A]">
                      {batch.totalItems} items
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Summary Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Bank */}
            <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#AEBFC3]/20 bg-[#96AEC2]/5 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#6F8A9D]" />
                <h3 className="font-bold text-slate-800">By Bank</h3>
              </div>
              <div className="divide-y divide-[#AEBFC3]/15">
                {Object.entries(byBank).sort((a, b) => b[1].total - a[1].total).map(([bank, data]) => {
                  const pct = Number(batch.totalAmount) > 0 ? Math.round((data.total / Number(batch.totalAmount)) * 100) : 0;
                  return (
                    <div key={bank} className="px-5 py-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">{bank}</p>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-bold text-slate-800">{formatARCurrency(data.total, data.currency)}</p>
                          <p className="text-xs text-[#546A7A]">{data.count} item{data.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#546A7A] w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Mode */}
            <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#AEBFC3]/20 bg-[#96AEC2]/5 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#6F8A9D]" />
                <h3 className="font-bold text-slate-800">By Transaction Mode</h3>
              </div>
              <div className="p-5 space-y-4">
                {Object.entries(byMode).map(([mode, data]) => {
                  const pct = Number(batch.totalAmount) > 0 ? Math.round((data.total / Number(batch.totalAmount)) * 100) : 0;
                  return (
                    <div key={mode}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold font-mono bg-[#96AEC2]/10 text-[#546A7A] px-3 py-1 rounded-lg border border-[#AEBFC3]/30">{mode}</span>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-800">{formatARCurrency(data.total, batch.currency)}</p>
                          <p className="text-xs text-[#546A7A]">{data.count} payments • {pct}%</p>
                        </div>
                      </div>
                      <div className="h-2 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-[#AEBFC3]/20 px-5 py-4 space-y-2 bg-[#96AEC2]/5">
                <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide mb-3">Batch Info</p>
                {[
                  ['Batch Number', batch.batchNumber],
                  ['Currency', batch.currency || 'INR'],
                  ['Export Format', batch.exportFormat || 'Not specified'],
                  ['Submitted', formatARDate(batch.requestedAt)],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-700 font-mono">{val}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className={cn('font-bold text-xs px-2.5 py-1 rounded-full border', cfg.bg, cfg.border, cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Format Preview Tab ───────────────────────────────────────────── */}
        {activeTab === 'preview' && (
          <div className="bg-white border border-[#AEBFC3]/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#AEBFC3]/20 bg-[#96AEC2]/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#6F8A9D]" />
                <h2 className="font-bold text-slate-800">Format Preview</h2>
                {batch.exportFormat && (
                  <span className="text-[9px] bg-[#96AEC2]/20 text-[#546A7A] px-2 py-0.5 rounded-full font-bold border border-[#96AEC2]/30">
                    Submitted as {batch.exportFormat}
                  </span>
                )}
              </div>
              {/* Format toggle */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setPreviewFormat('ICICI')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                    previewFormat === 'ICICI'
                      ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white shadow-sm'
                      : 'text-slate-500 hover:text-[#976E44]'
                  )}
                >
                  ICICI CMS
                </button>
                <button
                  onClick={() => setPreviewFormat('STANDARD')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                    previewFormat === 'STANDARD'
                      ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white shadow-sm'
                      : 'text-slate-500 hover:text-[#546A7A]'
                  )}
                >
                  Standard
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {previewFormat === 'ICICI' ? (
                // ICICI CMS Key Columns Preview
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#96AEC2]/8 border-b border-[#AEBFC3]/20">
                      {['Trn Type', 'Bene Code', 'Bene A/C No.', 'Amount', 'Bene Name', 'Cust Ref No.', 'Inst. Date', 'IFSC Code', 'Bene Bank Name', 'Bene Email ID'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-[#546A7A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                    <tr className="bg-[#AEBFC3]/10 border-b border-[#AEBFC3]/20">
                      {['A', 'A', 'A', 'N', 'C', 'C', 'DD/MM/YYYY', 'A', 'A', 'A'].map((t, i) => (
                        <td key={i} className="px-3 py-1 text-[10px] text-red-500 font-mono">{t}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#AEBFC3]/15">
                    {batch.items.map((item) => {
                      const trnType = item.transactionMode === 'NFT' ? 'N' : item.transactionMode === 'RTI' ? 'R' : 'I';
                      const beneCode = item.bpCode || item.vendorName.substring(0, 15).trim();
                      const custRef = item.vendorName.split(' ')[0].substring(0, 30);
                      const valueDate = item.valueDate ? new Date(item.valueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/') : '—';
                      return (
                        <tr key={item.id} className="hover:bg-[#96AEC2]/5">
                          <td className="px-3 py-2.5"><span className="font-mono font-bold text-[#546A7A]">{trnType}</span></td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{beneCode}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-700">{item.accountNumber}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-800">{Number(item.amount).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5 text-slate-700 max-w-[160px] truncate">{item.vendorName}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{custRef}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{valueDate}</td>
                          <td className="px-3 py-2.5 font-mono text-[#546A7A]">{item.ifscCode}</td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">{item.bankName}</td>
                          <td className="px-3 py-2.5 text-[#546A7A] font-mono text-[11px] max-w-[200px] truncate">{item.emailId || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                // Standard NEFT/RTGS Preview
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#546A7A] border-b border-[#6F8A9D]/40">
                      {['Transaction Mode', 'Amount', 'Value Date', 'Counter Party Name', 'Account No.', 'Acct Type', 'IFSC/Clearing Code', 'Order Ref', 'Txn Details'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#AEBFC3]/15">
                    {batch.items.map((item) => {
                      const nameParts = item.vendorName.split(' ');
                      let ref = item.vendorName.substring(0, 15);
                      if (nameParts.length > 2) ref = `Adv ${nameParts[0]}`;
                      else if (nameParts[0].length > 15) ref = nameParts[0].substring(0, 15);
                      else ref = nameParts[0];
                      const acctType = (item.accountType || '').toLowerCase().includes('sav') ? '10' : '11';
                      const valueDate = item.valueDate ? new Date(item.valueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/') : '—';
                      return (
                        <tr key={item.id} className="hover:bg-[#96AEC2]/5">
                          <td className="px-3 py-2.5"><span className="font-mono font-bold bg-[#96AEC2]/10 text-[#546A7A] px-2 py-0.5 rounded">{item.transactionMode}</span></td>
                          <td className="px-3 py-2.5 font-bold text-slate-800">{Number(item.amount).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{valueDate}</td>
                          <td className="px-3 py-2.5 text-slate-700 max-w-[180px] truncate">{item.vendorName}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-700">{item.accountNumber}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-500">{acctType}</td>
                          <td className="px-3 py-2.5 font-mono text-[#546A7A]">{item.ifscCode}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{ref}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{ref}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#AEBFC3]/20 bg-[#96AEC2]/5 flex items-center gap-2 text-xs text-[#546A7A]">
              <Info className="w-3.5 h-3.5 shrink-0" />
              This is a preview only — the actual file is generated when downloading after approval. Showing {batch.items.length} items.
            </div>
          </div>
        )}

        {/* ── Review Action Panel ───────────────────────────────────────────── */}
        {isPending && isApprover && (
          <div className="bg-white border-2 border-[#6F8A9D]/30 rounded-2xl p-6 space-y-4 shadow-sm shadow-[#6F8A9D]/8">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Submit Review Decision</h3>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                Review Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add any notes or comments about this batch review…"
                rows={3}
                className="w-full border border-[#AEBFC3]/40 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]/50 outline-none resize-none bg-[#96AEC2]/5"
              />
            </div>
            <div className="flex items-center justify-between border-t border-[#AEBFC3]/20 pt-4">
              <div className="text-sm text-slate-500">
                <strong className="text-[#4F6A64]">{approvedCount}</strong> approved&nbsp;
                ({formatARCurrency(approvedTotal, batch.currency)}) &nbsp;•&nbsp;
                <strong className="text-[#75242D]">{rejectedCount}</strong> rejected
              </div>
              <Button
                onClick={handleSubmitReview}
                disabled={submitting}
                className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white shadow-lg hover:shadow-xl shadow-[#6F8A9D]/30 rounded-xl px-8 h-12 font-bold text-base"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                  : <><Shield className="w-4 h-4 mr-2" /> Submit Review</>
                }
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
