'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import {
  getPaymentBatchById, reviewPaymentBatch, downloadPaymentBatch,
  resubmitRejectedItems, PaymentBatch, formatARCurrency, formatARDate
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
  CheckCheck, BanIcon, Info, Eye, RefreshCcw
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  PENDING:              { label: 'Pending Review',       color: 'text-[#976E44]',  bg: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]/40', icon: Clock },
  APPROVED:             { label: 'Approved',             color: 'text-[#4F6A64]',  bg: 'bg-[#82A094]/15', border: 'border-[#82A094]/50', icon: CheckCircle2 },
  PARTIALLY_APPROVED:   { label: 'Partially Approved',   color: 'text-[#976E44]',  bg: 'bg-[#CE9F6B]/15', border: 'border-[#CE9F6B]/50', icon: AlertCircle },
  REJECTED:             { label: 'Rejected',             color: 'text-[#75242D]',  bg: 'bg-[#E17F70]/10', border: 'border-[#E17F70]/40', icon: XCircle },
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
  const [resubmitting, setResubmitting] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [customFilename, setCustomFilename] = useState('');

  const [decisions, setDecisions] = useState<Record<string, 'APPROVED' | 'REJECTED' | 'PENDING'>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { amount?: number; valueDate?: string; transactionMode?: string }>>({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'items' | 'summary' | 'preview'>('items');
  const [previewFormat, setPreviewFormat] = useState<'HDFC' | 'DB'>('HDFC');


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getPaymentBatchById(batchId);
        setBatch(data);
        if (data.exportFormat === 'HDFC' || data.exportFormat === 'DB') {
          setPreviewFormat(data.exportFormat as 'HDFC' | 'DB');
        }
        const init: Record<string, 'APPROVED' | 'REJECTED' | 'PENDING'> = {};
        data.items.forEach(item => { init[item.id] = item.status as 'APPROVED' | 'REJECTED' | 'PENDING'; });
        setDecisions(init);
      } catch {
        toast.error('Failed to load batch');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [batchId]);

  const setItemDecision = (itemId: string, decision: 'APPROVED' | 'REJECTED') => {
    setDecisions(prev => ({ ...prev, [itemId]: prev[itemId] === decision ? 'PENDING' : decision }));
  };

  const approveAll = () => {
    if (!batch) return;
    const init: Record<string, 'APPROVED' | 'REJECTED' | 'PENDING'> = {};
    batch.items.forEach(item => { init[item.id] = 'APPROVED'; });
    setDecisions(init);
    setRejectReasons({});
  };

  const rejectAll = () => {
    if (!batch) return;
    const init: Record<string, 'APPROVED' | 'REJECTED' | 'PENDING'> = {};
    batch.items.forEach(item => { init[item.id] = 'REJECTED'; });
    setDecisions(init);
  };

  const handleSubmitReview = async () => {
    if (!batch) return;
    const pendingDecisions = Object.entries(decisions).filter(([, s]) => s === 'PENDING');
    if (pendingDecisions.length > 0) {
      toast.error(`Please approve or reject all items. ${pendingDecisions.length} item(s) still pending.`);
      return;
    }
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
        id, status: status as 'APPROVED' | 'REJECTED', rejectReason: status === 'REJECTED' ? rejectReasons[id] : undefined
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

  const handleDownloadApproved = async (format: 'HDFC' | 'DB', subFormat: 'EXCEL' | 'CSV' | 'TXT') => {
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
      if (format === 'HDFC') {
        if (subFormat === 'CSV') await downloadICICICMS_CSV(rows, customFilename);
        else if (subFormat === 'TXT') await downloadICICICMS_TXT(rows, customFilename);
        else await downloadICICICMS(rows, customFilename);
      } else {
        if (subFormat === 'CSV') await downloadStandard_CSV(rows, customFilename);
        else if (subFormat === 'TXT') await downloadStandard_TXT(rows, customFilename);
        else await downloadStandardPayment(rows, customFilename);
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#546A7A]/5 via-white to-[#82A094]/5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#96AEC2]/20 to-[#82A094]/20 flex items-center justify-center border border-[#96AEC2]/30 shadow-lg shadow-[#96AEC2]/10">
            <Loader2 className="w-7 h-7 animate-spin text-[#546A7A]" />
          </div>
          <div className="absolute -inset-1 bg-gradient-to-br from-[#96AEC2]/20 to-[#82A094]/20 rounded-2xl blur-lg -z-10 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#546A7A]">Loading batch details…</p>
          <p className="text-xs text-[#92A2A5] mt-0.5">Please wait</p>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#546A7A]/5 via-white to-[#82A094]/5">
        <div className="text-center space-y-5 bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/30 rounded-3xl p-10 shadow-xl shadow-[#96AEC2]/8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#96AEC2]/15 to-[#82A094]/15 rounded-2xl flex items-center justify-center mx-auto border border-[#96AEC2]/30">
            <Package className="w-8 h-8 text-[#6F8A9D]" />
          </div>
          <div>
            <p className="text-[#546A7A] font-bold text-lg">Batch not found</p>
            <p className="text-sm text-[#92A2A5] mt-1">This batch may have been deleted or doesn't exist</p>
          </div>
          <Link href="/finance/bank-accounts/payment-batches">
            <Button variant="outline" className="rounded-xl border-[#6F8A9D]/40 text-[#546A7A] hover:bg-[#96AEC2]/15 font-semibold">Back to Batches</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isPending = batch.status === 'PENDING';
  const isPartiallyApproved = batch.status === 'PARTIALLY_APPROVED';
  const isReviewed = ['APPROVED', 'REJECTED', 'PARTIALLY_APPROVED'].includes(batch.status);
  const canDownload = batch.status === 'APPROVED';
  const isFinanceUser = user?.financeRole === FinanceRole.FINANCE_USER;
  const isRequester = user?.id === batch.requestedById;
  const canResubmit = isPartiallyApproved && isRequester;

  const handleResubmit = async () => {
    if (!batch) return;
    setResubmitting(true);
    try {
      const itemsToResubmit = Object.entries(edits).map(([id, data]) => ({
        id,
        ...data
      }));
      const result = await resubmitRejectedItems(batchId, itemsToResubmit.length > 0 ? itemsToResubmit : undefined);
      toast.success(result.message);
      setBatch(result.batch);
      // Re-init decisions and clear edits
      const init: Record<string, 'APPROVED' | 'REJECTED' | 'PENDING'> = {};
      result.batch.items.forEach(item => { init[item.id] = item.status as 'APPROVED' | 'REJECTED' | 'PENDING'; });
      setDecisions(init);
      setRejectReasons({});
      setEdits({});
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to re-submit rejected items');
    } finally {
      setResubmitting(false);
    }
  };

  const handleEditItem = (itemId: string, field: string, value: any) => {
    setEdits(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value
      }
    }));
  };


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
    <div className="min-h-screen bg-gradient-to-br from-[#546A7A]/5 via-[#AEBFC3]/5 to-[#82A094]/5">
      {/* ── Top Accent Bar ─────────────────────────────────────── */}
      <div className="h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094]" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl p-5 shadow-sm relative z-20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Link href="/finance/bank-accounts/payment-batches">
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-[#96AEC2]/15 text-[#546A7A] mt-0.5 border border-transparent hover:border-[#96AEC2]/30 transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-[#546A7A] tracking-tight">{batch.batchNumber}</h1>
                  <span className={cn(
                    'text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 shadow-sm',
                    cfg.bg, cfg.border, cfg.color
                  )}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </span>
                  {batch.exportFormat && (
                    <span className="text-[10px] font-bold font-mono bg-[#96AEC2]/12 text-[#546A7A] px-2.5 py-1 rounded-full border border-[#96AEC2]/25">
                      {batch.exportFormat === 'HDFC' ? 'HDFC' : 'DB'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-[#5D6E73] flex-wrap">
                  <span className="flex items-center gap-1.5 bg-[#96AEC2]/8 px-2.5 py-1 rounded-lg">
                    <User className="w-3.5 h-3.5 text-[#6F8A9D]" />
                    <span className="text-[#757777]">by</span> <strong className="text-[#546A7A]">{batch.requestedBy?.name || '—'}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 bg-[#96AEC2]/8 px-2.5 py-1 rounded-lg">
                    <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" /> {formatARDate(batch.requestedAt)}
                  </span>
                  {batch.reviewedBy && (
                    <span className="flex items-center gap-1.5 bg-[#82A094]/10 px-2.5 py-1 rounded-lg text-[#4F6A64]">
                      <Shield className="w-3.5 h-3.5" />
                      Reviewed by <strong>{batch.reviewedBy.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Download */}
            {canDownload && (
              <div className="relative shrink-0">
                <Button
                  onClick={() => setShowDownloadMenu(v => !v)}
                  disabled={downloading}
                  className="bg-gradient-to-r from-[#546A7A] to-[#4F6A64] text-white rounded-xl shadow-lg shadow-[#546A7A]/25 font-bold hover:shadow-xl transition-all"
                >
                  {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Download
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
                {showDownloadMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur-sm border border-[#AEBFC3]/30 rounded-2xl shadow-xl shadow-[#546A7A]/12 z-50 p-4 w-72 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-[#546A7A] uppercase tracking-widest px-1 mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3 h-3" /> Custom Filename
                      </p>
                      <input
                        type="text"
                        placeholder="Enter filename (optional)"
                        value={customFilename}
                        onChange={(e) => setCustomFilename(e.target.value)}
                        className="w-full text-xs border border-[#AEBFC3]/40 rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#546A7A] outline-none bg-white/50 backdrop-blur-sm"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide px-2 mb-2">HDFC Format</p>
                      <div className="flex gap-2">
                        {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                          <button key={f} onClick={() => handleDownloadApproved('HDFC', f)}
                            className="flex-1 text-xs font-semibold py-2.5 px-2 border border-[#AEBFC3]/40 rounded-xl hover:bg-[#96AEC2]/10 hover:border-[#96AEC2]/50 text-[#5D6E73] transition-all">
                            {f === 'EXCEL' ? <FileSpreadsheet className="w-3.5 h-3.5 mx-auto mb-0.5 text-[#6F8A9D]" /> : f === 'CSV' ? <FileText className="w-3.5 h-3.5 mx-auto mb-0.5 text-[#6F8A9D]" /> : <FileCode className="w-3.5 h-3.5 mx-auto mb-0.5 text-[#6F8A9D]" />}
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-[#AEBFC3]/20 pt-3">
                      <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide px-2 mb-2">DB Format</p>
                      <div className="flex gap-2">
                        {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                          <button key={f} onClick={() => handleDownloadApproved('DB', f)}
                            className="flex-1 text-xs font-semibold py-2.5 px-2 border border-[#96AEC2]/40 rounded-xl hover:bg-[#96AEC2]/12 text-[#546A7A] transition-all bg-[#96AEC2]/5">
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
        </div>

        {/* ── Metric Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
          <div className="bg-white/70 backdrop-blur-sm border border-[#96AEC2]/30 rounded-2xl p-5 space-y-1.5 transition-all hover:shadow-lg hover:shadow-[#96AEC2]/8 hover:border-[#96AEC2]/50 group relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#96AEC2] to-[#6F8A9D]" />
            <div className="flex items-center gap-2 text-[#6F8A9D] text-xs font-bold uppercase tracking-widest">
              <div className="w-7 h-7 rounded-lg bg-[#96AEC2]/12 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Hash className="w-3.5 h-3.5" />
              </div>
              Total Items
            </div>
            <p className="text-3xl font-extrabold text-[#546A7A]">{batch.totalItems}</p>
            <p className="text-xs text-[#92A2A5] font-medium">payment entries</p>
          </div>
          <div className="bg-white/70 backdrop-blur-sm border border-[#96AEC2]/30 rounded-2xl p-5 space-y-1.5 transition-all hover:shadow-lg hover:shadow-[#96AEC2]/8 hover:border-[#96AEC2]/50 group relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#6F8A9D] to-[#546A7A]" />
            <div className="flex items-center gap-2 text-[#6F8A9D] text-xs font-bold uppercase tracking-widest">
              <div className="w-7 h-7 rounded-lg bg-[#96AEC2]/12 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Banknote className="w-3.5 h-3.5" />
              </div>
              Total Amount
            </div>
            <p className="text-2xl font-extrabold text-[#546A7A]">{formatARCurrency(batch.totalAmount, batch.currency)}</p>
            <p className="text-xs text-[#92A2A5] font-medium">{batch.currency || 'INR'}</p>
          </div>
          <div className={cn(
            'rounded-2xl p-5 space-y-1.5 border transition-all hover:shadow-lg group relative overflow-hidden',
            approvedCount > 0 ? 'bg-[#82A094]/8 border-[#82A094]/40 hover:border-[#82A094] hover:shadow-[#82A094]/10' : 'bg-white/70 backdrop-blur-sm border-[#AEBFC3]/30'
          )}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#82A094] to-[#4F6A64]" />
            <div className="flex items-center gap-2 text-[#4F6A64] text-xs font-bold uppercase tracking-widest">
              <div className="w-7 h-7 rounded-lg bg-[#82A094]/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              Approved
            </div>
            <p className="text-3xl font-extrabold text-[#4F6A64]">{approvedCount}</p>
            <p className="text-xs text-[#82A094] font-semibold">{formatARCurrency(approvedTotal, batch.currency)}</p>
          </div>
          <div className={cn(
            'rounded-2xl p-5 space-y-1.5 border transition-all hover:shadow-lg group relative overflow-hidden',
            rejectedCount > 0 ? 'bg-[#E17F70]/8 border-[#E17F70]/30 hover:border-[#E17F70] hover:shadow-[#E17F70]/10' : 'bg-white/70 backdrop-blur-sm border-[#AEBFC3]/30'
          )}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#E17F70] to-[#9E3B47]" />
            <div className="flex items-center gap-2 text-[#75242D] text-xs font-bold uppercase tracking-widest">
              <div className="w-7 h-7 rounded-lg bg-[#E17F70]/12 flex items-center justify-center group-hover:scale-110 transition-transform">
                <XCircle className="w-3.5 h-3.5" />
              </div>
              Rejected
            </div>
            <p className="text-3xl font-extrabold text-[#75242D]">{rejectedCount}</p>
            <p className="text-xs text-[#E17F70] font-semibold">
              {rejectedCount > 0 ? formatARCurrency(Number(batch.totalAmount) - approvedTotal, batch.currency) : '—'}
            </p>
          </div>
        </div>

        {/* ── Approval Progress Bar ────────────────────────────────────────── */}
        {batch.totalItems > 0 && (
          <div className="bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#96AEC2]/20 to-[#82A094]/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#546A7A]" />
                </div>
                <span className="text-sm font-bold text-[#546A7A]">Approval Progress</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#82A094] to-[#4F6A64]" />
                  <span className="text-[#5D6E73] font-semibold">{approvedPct}% approved</span>
                </span>
                {rejectedCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#E17F70] to-[#9E3B47]" />
                    <span className="text-[#757777]">{100 - approvedPct}% rejected</span>
                  </span>
                )}
              </div>
            </div>
            <div className="h-3.5 bg-[#AEBFC3]/15 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-gradient-to-r from-[#A2B9AF] via-[#82A094] to-[#4F6A64] transition-all duration-700 rounded-l-full"
                style={{ width: `${approvedPct}%` }}
              />
              {rejectedCount > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-[#E17F70]/40 to-[#E17F70]/25 transition-all duration-700"
                  style={{ width: `${100 - approvedPct}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-2.5 text-xs text-[#92A2A5]">
              <span className="font-medium">{approvedCount} approved • {formatARCurrency(approvedTotal, batch.currency)}</span>
              <span className="font-medium">{rejectedCount} rejected</span>
            </div>
          </div>
        )}

        {/* ── Notes / Review Info ──────────────────────────────────────────── */}
        <div className="flex gap-4 flex-col sm:flex-row">
          {batch.notes && (
            <div className="flex-1 bg-white/70 backdrop-blur-sm border border-[#96AEC2]/25 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#96AEC2] to-[#6F8A9D]" />
              <Info className="w-4 h-4 text-[#546A7A] shrink-0 mt-0.5 ml-2" />
              <div>
                <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide mb-0.5">Batch Notes</p>
                <p className="text-sm text-[#5D6E73]">{batch.notes}</p>
              </div>
            </div>
          )}
          {isReviewed && batch.reviewedBy && (
            <div className="flex-1 bg-[#82A094]/8 border border-[#82A094]/30 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#82A094] to-[#4F6A64]" />
              <Shield className="w-4 h-4 text-[#4F6A64] shrink-0 mt-0.5 ml-2" />
              <div>
                <p className="text-xs font-bold text-[#4F6A64] uppercase tracking-wide mb-0.5">Reviewed By</p>
                <p className="text-sm font-semibold text-[#546A7A]">{batch.reviewedBy.name}</p>
                <p className="text-xs text-[#92A2A5]">{formatARDate(batch.reviewedAt)}</p>
                {batch.reviewNotes && <p className="text-xs text-[#976E44] mt-1 italic">"{batch.reviewNotes}"</p>}
              </div>
            </div>
          )}
        </div>

        {/* ── Re-Request Rejected Items Banner ──────────────────────────────── */}
        {canResubmit && (
          <div className="bg-gradient-to-r from-[#CE9F6B]/10 via-[#CE9F6B]/5 to-[#E17F70]/10 border border-[#CE9F6B]/40 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#CE9F6B] to-[#E17F70]" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ml-2">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#CE9F6B]/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-[#976E44]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#976E44] text-sm">Some Items Were Rejected</h3>
                  <p className="text-xs text-[#976E44]/80 mt-0.5">
                    {batch.items.filter(i => i.status === 'REJECTED').length} item(s) were rejected by the approver.
                    Click below to re-submit them for another review. Once all items are approved, you can download the payment files.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleResubmit}
                disabled={resubmitting}
                className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white rounded-xl shadow-lg shadow-[#CE9F6B]/25 font-bold hover:shadow-xl transition-all shrink-0 px-5"
              >
                {resubmitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Re-Submitting…</>
                  : <><RefreshCcw className="w-4 h-4 mr-2" /> Re-Request Rejected Items</>
                }
              </Button>
            </div>
          </div>
        )}


        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white/60 backdrop-blur-sm rounded-xl p-1.5 w-fit border border-[#AEBFC3]/25 shadow-sm">
          <button
            onClick={() => setActiveTab('items')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-bold transition-all',
              activeTab === 'items'
                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-md shadow-[#546A7A]/20'
                : 'text-[#92A2A5] hover:text-[#546A7A] hover:bg-[#96AEC2]/10'
            )}
          >
            Payment Items ({batch.items.length})
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-bold transition-all',
              activeTab === 'summary'
                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-md shadow-[#546A7A]/20'
                : 'text-[#92A2A5] hover:text-[#546A7A] hover:bg-[#96AEC2]/10'
            )}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5',
              activeTab === 'preview'
                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-md shadow-[#546A7A]/20'
                : 'text-[#92A2A5] hover:text-[#546A7A] hover:bg-[#96AEC2]/10'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Format Preview
            {batch.exportFormat && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-bold ml-0.5',
                activeTab === 'preview' ? 'bg-white/20 text-white' : 'bg-[#96AEC2]/20 text-[#546A7A]'
              )}>
                {batch.exportFormat === 'HDFC' ? 'HDFC' : 'DB'}
              </span>
            )}
          </button>
        </div>

        {/* ── Items Table ──────────────────────────────────────────────────── */}
        {activeTab === 'items' && (
          <div className="bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#AEBFC3]/20 flex items-center justify-between bg-gradient-to-r from-[#546A7A]/5 to-[#96AEC2]/8">
              <div>
                <h2 className="font-bold text-[#546A7A]">Payment Items</h2>
                <p className="text-xs text-[#6F8A9D] mt-0.5">{batch.items.length} entries • {batch.currency || 'INR'}</p>
              </div>
              {isPending && isApprover && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={approveAll}
                    className="border-[#82A094]/40 text-[#4F6A64] hover:bg-gradient-to-r hover:from-[#82A094] hover:to-[#4F6A64] hover:text-white rounded-xl font-bold transition-all px-3 h-8 text-xs"
                  >
                    <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Approve All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rejectAll}
                    className="border-[#E17F70]/40 text-[#75242D] hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#9E3B47] hover:text-white rounded-xl font-bold transition-all px-3 h-8 text-xs"
                  >
                    <BanIcon className="w-3.5 h-3.5 mr-1.5" /> Reject All
                  </Button>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submitting || Object.values(decisions).some(s => s === 'PENDING')}
                    className="bg-gradient-to-r from-[#546A7A] to-[#4F6A64] text-white shadow-lg hover:shadow-xl shadow-[#546A7A]/25 rounded-xl px-5 h-8 font-bold text-xs hover:from-[#4F6A64] hover:to-[#546A7A] transition-all disabled:opacity-50"
                  >
                    {submitting
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting…</>
                      : <><Shield className="w-3.5 h-3.5 mr-1.5" /> Submit Review</>
                    }
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]">
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Vendor</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Bank Account</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">IFSC</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Bank</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Date</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Mode</th>
                    <th className="text-right px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Amount</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Status</th>
                    {isPending && isApprover && (
                      <th className="text-center px-4 py-3.5 text-xs font-bold text-white/90 uppercase tracking-wider">Decision</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEBFC3]/15">
                  {batch.items.map((item, idx) => {
                    const itemDecision = item.status;
                    const itemCfg = ITEM_STATUS[itemDecision] || ITEM_STATUS.PENDING;
                    const isRejectedRow = isPending && isApprover && decisions[item.id] === 'REJECTED';

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'hover:bg-[#96AEC2]/8 transition-colors text-[#5D6E73]',
                          isRejectedRow && 'bg-[#E17F70]/6 hover:bg-[#E17F70]/10',
                          idx % 2 === 1 && !isRejectedRow && 'bg-[#96AEC2]/3'
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-[#546A7A] font-mono bg-[#96AEC2]/10 px-1.5 py-0.5 rounded border border-[#AEBFC3]/30">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-[#546A7A] text-sm">{item.vendorName}</p>
                          {item.bpCode && <p className="text-xs text-[#6F8A9D] font-mono">{item.bpCode}</p>}
                          {item.emailId && <p className="text-xs text-[#92A2A5] truncate max-w-[140px]">{item.emailId}</p>}
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
                          {canResubmit && item.status === 'REJECTED' ? (
                            <input
                              type="date"
                              value={edits[item.id]?.valueDate || (item.valueDate ? new Date(item.valueDate).toISOString().split('T')[0] : '')}
                              onChange={e => handleEditItem(item.id, 'valueDate', e.target.value)}
                              className="text-xs border border-[#AEBFC3]/40 rounded px-2 py-1 focus:ring-1 focus:ring-[#546A7A] outline-none w-28"
                            />
                          ) : (
                            <p className="font-mono text-xs text-[#757777]">{formatARDate(item.valueDate)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {canResubmit && item.status === 'REJECTED' ? (
                            <select
                              value={edits[item.id]?.transactionMode || item.transactionMode}
                              onChange={e => handleEditItem(item.id, 'transactionMode', e.target.value)}
                              className="text-xs border border-[#AEBFC3]/40 rounded px-2 py-1 focus:ring-1 focus:ring-[#546A7A] outline-none"
                            >
                              <option value="NFT">NEFT</option>
                              <option value="RTI">RTGS</option>
                              <option value="FT">I-FT</option>
                            </select>
                          ) : (
                            <span className="text-xs font-bold font-mono bg-[#96AEC2]/10 text-[#546A7A] px-2 py-1 rounded-lg border border-[#AEBFC3]/30">
                              {item.transactionMode}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {canResubmit && item.status === 'REJECTED' ? (
                            <input
                              type="number"
                              value={edits[item.id]?.amount !== undefined ? edits[item.id]?.amount : item.amount}
                              onChange={e => handleEditItem(item.id, 'amount', Number(e.target.value))}
                              className="text-xs border border-[#AEBFC3]/40 rounded px-2 py-1 focus:ring-1 focus:ring-[#546A7A] outline-none w-24 text-right font-bold"
                            />
                          ) : (
                            <p className="font-bold text-[#546A7A]">{formatARCurrency(Number(item.amount), batch.currency)}</p>
                          )}
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
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setItemDecision(item.id, 'APPROVED')}
                                  className={cn(
                                    'text-xs font-bold py-1.5 px-3 rounded-lg border transition-all',
                                    decisions[item.id] === 'APPROVED'
                                      ? 'bg-[#82A094]/20 border-[#82A094]/50 text-[#4F6A64] shadow-sm shadow-[#82A094]/15'
                                      : 'bg-white border-[#AEBFC3]/30 text-[#92A2A5] hover:bg-[#82A094]/10 hover:border-[#82A094]/30 hover:text-[#4F6A64]'
                                  )}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => setItemDecision(item.id, 'REJECTED')}
                                  className={cn(
                                    'text-xs font-bold py-1.5 px-3 rounded-lg border transition-all',
                                    decisions[item.id] === 'REJECTED'
                                      ? 'bg-[#E17F70]/15 border-[#E17F70]/40 text-[#75242D] shadow-sm shadow-[#E17F70]/15'
                                      : 'bg-white border-[#AEBFC3]/30 text-[#92A2A5] hover:bg-[#E17F70]/10 hover:border-[#E17F70]/30 hover:text-[#75242D]'
                                  )}
                                >
                                  ✗ Reject
                                </button>
                              </div>
                              {decisions[item.id] === 'REJECTED' && (
                                <input
                                  type="text"
                                  placeholder="Reason (required)"
                                  value={rejectReasons[item.id] || ''}
                                  onChange={e => setRejectReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-36 text-xs border border-[#E17F70]/30 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#E17F70]/30 outline-none bg-[#E17F70]/5"
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
                  <tr className="bg-gradient-to-r from-[#546A7A]/8 to-[#96AEC2]/10 border-t-2 border-[#6F8A9D]/30">
                    <td colSpan={7} className="px-4 py-3.5 text-xs font-bold text-[#546A7A] uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-extrabold text-[#546A7A] text-base">{formatARCurrency(batch.totalAmount, batch.currency)}</p>
                    </td>
                    <td colSpan={isPending && isApprover ? 2 : 1} className="px-4 py-3.5 text-center text-xs font-semibold text-[#6F8A9D]">
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
            <div className="bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[#AEBFC3]/20 bg-gradient-to-r from-[#546A7A]/5 to-[#96AEC2]/8 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#96AEC2]/15 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#546A7A]" />
                </div>
                <h3 className="font-bold text-[#546A7A]">By Bank</h3>
              </div>
              <div className="divide-y divide-[#AEBFC3]/15">
                {Object.entries(byBank).sort((a, b) => b[1].total - a[1].total).map(([bank, data]) => {
                  const pct = Number(batch.totalAmount) > 0 ? Math.round((data.total / Number(batch.totalAmount)) * 100) : 0;
                  return (
                    <div key={bank} className="px-5 py-3.5 hover:bg-[#96AEC2]/5 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-[#546A7A] truncate max-w-[200px]">{bank}</p>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-bold text-[#546A7A]">{formatARCurrency(data.total, data.currency)}</p>
                          <p className="text-xs text-[#92A2A5]">{data.count} item{data.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#AEBFC3]/15 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#96AEC2] to-[#546A7A] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#6F8A9D] w-8 text-right font-semibold">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Mode */}
            <div className="bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[#AEBFC3]/20 bg-gradient-to-r from-[#546A7A]/5 to-[#96AEC2]/8 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#96AEC2]/15 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-[#546A7A]" />
                </div>
                <h3 className="font-bold text-[#546A7A]">By Transaction Mode</h3>
              </div>
              <div className="p-5 space-y-4">
                {Object.entries(byMode).map(([mode, data]) => {
                  const pct = Number(batch.totalAmount) > 0 ? Math.round((data.total / Number(batch.totalAmount)) * 100) : 0;
                  return (
                    <div key={mode}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold font-mono bg-gradient-to-r from-[#546A7A]/8 to-[#96AEC2]/10 text-[#546A7A] px-3 py-1 rounded-lg border border-[#AEBFC3]/25">{mode}</span>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#546A7A]">{formatARCurrency(data.total, batch.currency)}</p>
                          <p className="text-xs text-[#92A2A5]">{data.count} payments • {pct}%</p>
                        </div>
                      </div>
                      <div className="h-2 bg-[#AEBFC3]/15 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#96AEC2] to-[#546A7A] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-[#AEBFC3]/20 px-5 py-4 space-y-2 bg-gradient-to-r from-[#546A7A]/3 to-[#96AEC2]/5">
                <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide mb-3">Batch Info</p>
                {[
                  ['Batch Number', batch.batchNumber],
                  ['Currency', batch.currency || 'INR'],
                  ['Export Format', batch.exportFormat || 'Not specified'],
                  ['Submitted', formatARDate(batch.requestedAt)],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-[#92A2A5]">{label}</span>
                    <span className="font-semibold text-[#546A7A] font-mono">{val}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#92A2A5]">Status</span>
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
          <div className="bg-white/80 backdrop-blur-sm border border-[#AEBFC3]/25 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#AEBFC3]/20 bg-gradient-to-r from-[#546A7A]/5 to-[#96AEC2]/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#96AEC2]/15 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-[#546A7A]" />
                </div>
                <h2 className="font-bold text-[#546A7A]">Format Preview</h2>
                {batch.exportFormat && (
                  <span className="text-[9px] bg-[#96AEC2]/15 text-[#546A7A] px-2 py-0.5 rounded-full font-bold border border-[#96AEC2]/25">
                    Submitted as {batch.exportFormat}
                  </span>
                )}
              </div>
              {/* Format toggle */}
              <div className="flex items-center gap-1 bg-[#AEBFC3]/10 rounded-xl p-1">
                <button
                  onClick={() => setPreviewFormat('HDFC')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                    previewFormat === 'HDFC'
                      ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-sm'
                      : 'text-[#92A2A5] hover:text-[#546A7A]'
                  )}
                >
                  HDFC
                </button>
                <button
                  onClick={() => setPreviewFormat('DB')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                    previewFormat === 'DB'
                      ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-sm'
                      : 'text-[#92A2A5] hover:text-[#546A7A]'
                  )}
                >
                  DB
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {previewFormat === 'HDFC' ? (
                // HDFC Key Columns Preview
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
                          <td className="px-3 py-2.5 font-bold text-[#546A7A]">{Number(item.amount).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5 font-mono text-[#757777]">{valueDate}</td>
                          <td className="px-3 py-2.5 text-[#546A7A] max-w-[180px] truncate">{item.vendorName}</td>
                          <td className="px-3 py-2.5 font-mono text-[#546A7A]">{item.accountNumber}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-[#757777]">{acctType}</td>
                          <td className="px-3 py-2.5 font-mono text-[#546A7A]">{item.ifscCode}</td>
                          <td className="px-3 py-2.5 font-mono text-[#757777]">{ref}</td>
                          <td className="px-3 py-2.5 font-mono text-[#757777]">{ref}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#AEBFC3]/20 bg-gradient-to-r from-[#546A7A]/3 to-[#96AEC2]/5 flex items-center gap-2 text-xs text-[#6F8A9D]">
              <Info className="w-3.5 h-3.5 shrink-0" />
              This is a preview only — the actual file is generated when downloading after approval. Showing {batch.items.length} items.
            </div>
          </div>
        )}

        {/* ── Additional Download Card for Discoverability ────────────────── */}
        {canDownload && (
          <div className="bg-white/80 backdrop-blur-sm border border-[#6F8A9D]/25 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#546A7A] via-[#6F8A9D] to-[#82A094]" />
            <div className="flex items-center gap-4 ml-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#546A7A] to-[#4F6A64] flex items-center justify-center shadow-lg shadow-[#546A7A]/20">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#546A7A]">Download Payment Files</h3>
                <p className="text-sm text-[#6F8A9D]">Get the bank-ready export files for the approved items in this batch.</p>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center items-end gap-5">
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-bold text-[#546A7A] uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Custom Filename
                </p>
                <input
                  type="text"
                  placeholder="Enter filename..."
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="text-xs border border-[#AEBFC3]/40 rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#546A7A] outline-none w-48 bg-white/50"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-[#546A7A] uppercase tracking-widest px-1">HDFC Format</p>
                  <div className="flex gap-1.5">
                    {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                      <Button key={f} size="sm" variant="outline" onClick={() => handleDownloadApproved('HDFC', f)}
                        className="rounded-xl border-[#AEBFC3]/40 text-[#546A7A] hover:bg-[#96AEC2]/15 hover:border-[#96AEC2]/50 font-bold text-xs h-9 px-3 transition-all">
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="w-px bg-[#AEBFC3]/30 mx-1 hidden sm:block" />
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-[#546A7A] uppercase tracking-widest px-1">DB Format</p>
                  <div className="flex gap-1.5">
                    {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                      <Button key={f} size="sm" variant="outline" onClick={() => handleDownloadApproved('DB', f)}
                        className="rounded-xl border-[#96AEC2]/40 text-[#546A7A] hover:bg-[#96AEC2]/20 hover:border-[#96AEC2]/50 font-bold text-xs h-9 px-3 bg-[#96AEC2]/5 transition-all">
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
