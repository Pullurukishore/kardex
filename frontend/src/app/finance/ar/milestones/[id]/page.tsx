'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, ARPaymentHistory, formatARCurrency, formatARDate, formatARMonth, MilestonePaymentTerm, formatAmountForInput, parseFormattedAmount } from '@/lib/ar-api';
import {
  ArrowLeft, ArrowRight, Pencil, Trash2, FileText, Calendar, User, Clock, CheckCircle2,
  AlertTriangle, CheckCircle, Loader2, Mail, Phone, MapPin,
  IndianRupee, Package, TrendingUp, XCircle, Timer, Banknote,
  ArrowDownRight, ArrowUpRight, Sparkles, Wallet, BadgeCheck, Flag,
  Scale, Link2, Tag, Truck, RefreshCw, Plus, X, Copy, Shield,
  PackageCheck, PackageX, Receipt, MessageSquare, ChevronLeft,
  Hash, CreditCard, Building, ShieldAlert, ShieldCheck,
  BarChart3
} from 'lucide-react';

export default function MilestoneViewPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<ARInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'remarks' | 'activity'>('details');

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: '', referenceBank: '', notes: '', milestoneTerm: ''
  });

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Remarks
  const [remarks, setRemarks] = useState<any[]>([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [addingRemark, setAddingRemark] = useState(false);
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingRemarkContent, setEditingRemarkContent] = useState('');

  // Activity
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => { if (params.id) loadInvoice(params.id as string); }, [params.id]);
  useEffect(() => { if (invoice?.id) loadRemarks(invoice.id); }, [invoice?.id]);
  useEffect(() => {
    if (invoice?.id && activeTab === 'activity' && activityLogs.length === 0) loadActivityLog(invoice.id);
  }, [activeTab, invoice?.id]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePaymentModal();
    };
    if (showPaymentModal) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPaymentModal]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true); setError(null);
      // Pass type='MILESTONE' to ensure we get the milestone record when invoice numbers match
      const data = await arApi.getInvoiceById(id, 'MILESTONE');
      if (data.invoiceType !== 'MILESTONE') { router.push(`/finance/ar/invoices/${id}`); return; }
      setInvoice(data);
    } catch { setError('Failed to load milestone payment'); }
    finally { setLoading(false); }
  };

  const loadRemarks = async (id: string) => {
    try { setRemarksLoading(true); setRemarks(await arApi.getInvoiceRemarks(id)); }
    catch {} finally { setRemarksLoading(false); }
  };

  const loadActivityLog = async (id: string) => {
    try { setActivityLoading(true); setActivityLogs(await arApi.getInvoiceActivityLog(id)); }
    catch {} finally { setActivityLoading(false); }
  };

  const handleAddRemark = async () => {
    if (!invoice || !newRemark.trim()) return;
    try { setAddingRemark(true); await arApi.addInvoiceRemark(invoice.id, newRemark.trim()); setNewRemark(''); await loadRemarks(invoice.id); }
    catch { alert('Failed to add remark'); } finally { setAddingRemark(false); }
  };

  const handleEditRemark = async (id: string) => {
    if (!invoice || !editingRemarkContent.trim()) return;
    try { 
      await arApi.updateInvoiceRemark(invoice.id, id, editingRemarkContent.trim()); 
      setEditingRemarkId(null);
      await loadRemarks(invoice.id); 
    }
    catch { alert('Failed to edit remark'); }
  };

  const handleDeleteRemark = async (id: string) => {
    if (!invoice || !confirm('Are you sure you want to delete this remark?')) return;
    try { 
      setRemarksLoading(true); 
      await arApi.deleteInvoiceRemark(invoice.id, id); 
      await loadRemarks(invoice.id); 
    }
    catch { alert('Failed to delete remark'); setRemarksLoading(false); }
  };

  const handleCancelMilestone = async () => {
    if (!invoice || !cancelReason.trim()) return;
    
    try {
      setCancelling(true);
      await arApi.cancelInvoice(invoice.id, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      await loadInvoice(invoice.id); // Reload to show CANCELLED status
    } catch (err) {
      console.error('Failed to cancel milestone:', err);
      alert('Failed to cancel milestone');
    } finally {
      setCancelling(false);
    }
  };

  const handleRestoreMilestone = async () => {
    if (!invoice || !confirm('Are you sure you want to restore this milestone?')) return;
    
    try {
      setRestoring(true);
      await arApi.restoreInvoice(invoice.id);
      await loadInvoice(invoice.id);
    } catch (err) {
      console.error('Failed to restore milestone:', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteMilestone = async () => {
    if (!invoice || !confirm('Are you sure you want to completely delete this milestone? This action cannot be undone.')) return;
    
    try {
      setDeleting(true);
      await arApi.deleteInvoice(invoice.id);
      router.push('/finance/ar/milestones');
    } catch (err: any) {
      console.error('Failed to delete milestone:', err);
      alert(err.response?.data?.error || 'Failed to delete milestone');
      setDeleting(false);
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false); setEditingPaymentId(null);
    setPaymentForm({ amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMode: '', referenceBank: '', notes: '', milestoneTerm: '' });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!invoice) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { alert('Please enter a valid amount'); return; }
    try {
      setPaymentLoading(true);
      const paymentData = { amount: parseFloat(paymentForm.amount), paymentDate: paymentForm.paymentDate, paymentMode: paymentForm.paymentMode, referenceBank: paymentForm.referenceBank, notes: paymentForm.notes, milestoneTerm: paymentForm.milestoneTerm || null };
      if (editingPaymentId) await arApi.updatePayment(invoice.id, editingPaymentId, paymentData);
      else await arApi.addPayment(invoice.id, paymentData);
      closePaymentModal(); await loadInvoice(invoice.id);
    } catch { alert('Failed to record payment'); } finally { setPaymentLoading(false); }
  };

  const handleEditPayment = (payment: ARPaymentHistory) => {
    setEditingPaymentId(payment.id);
    setPaymentForm({ amount: payment.amount.toString(), paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0], paymentMode: payment.paymentMode, referenceBank: payment.referenceBank || '', notes: payment.notes || '', milestoneTerm: payment.milestoneTerm || '' });
    setShowPaymentModal(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!invoice || !confirm('Delete this payment record?')) return;
    try { setPaymentLoading(true); await arApi.deletePayment(invoice.id, paymentId); await loadInvoice(invoice.id); }
    catch { alert('Failed to delete payment'); } finally { setPaymentLoading(false); }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[500px]">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#CE9F6B] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-[#E17F70] border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          <div className="absolute inset-6 rounded-full border-2 border-t-[#82A094] border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1.2s' }} />
          <div className="absolute inset-0 m-auto w-10 h-10 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg shadow-[#CE9F6B]/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
        </div>
        <p className="text-[#5D6E73] font-bold">Loading milestone details...</p>
      </div>
    </div>
  );

  if (error || !invoice) return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#CE9F6B]/20 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-[#EEC1BF] to-[#9E3B47]" />
          <Wallet className="w-14 h-14 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-[#546A7A] mb-3">Milestone Payment Not Found</h2>
        <p className="text-[#92A2A5] mb-8">{error || "The milestone payment you're looking for doesn't exist."}</p>
        <button 
          onClick={() => window.history.length > 2 ? router.back() : router.push('/finance/ar/milestones')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white font-bold rounded-xl shadow-lg shadow-[#CE9F6B]/20 hover:shadow-xl hover:shadow-[#CE9F6B]/30 transition-all hover:-translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Milestones
        </button>
      </div>
    </div>
  );

  const totalAmount = Number(invoice.totalAmount || 0);
  const totalReceived = Number(invoice.totalReceipts || 0);
  const balanceAmount = Number(invoice.balance) || (totalAmount - totalReceived);
  const paymentProgress = totalAmount > 0 ? Math.min(100, (totalReceived / totalAmount) * 100) : 0;
  const daysOverdue = invoice.dueByDays || 0;
  const isOverdue = invoice.status === 'OVERDUE' || (daysOverdue > 0 && invoice.status !== 'PAID');

  // Target payments to specific terms, then distribute balance via FIFO
  const milestoneTerms: MilestonePaymentTerm[] = (invoice.milestoneTerms as MilestonePaymentTerm[]) || [];
  const netAmount = Number(invoice.netAmount || 0);

  // 1. Group all payments by their target milestoneTerm
  const paymentsByTarget: Record<string, number> = {};
  let genericPool = 0;

  (invoice.paymentHistory || []).forEach(p => {
    if (p.milestoneTerm) {
      paymentsByTarget[p.milestoneTerm] = (paymentsByTarget[p.milestoneTerm] || 0) + (Number(p.amount) || 0);
    } else {
      genericPool += (Number(p.amount) || 0);
    }
  });

  // 2. Initial pass to calculate allocated amounts and apply specific payments
  const termCollections = milestoneTerms
    .slice()
    .sort((a, b) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime())
    .map((term) => {
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

      // Start with payments specifically targeted at this term
      // Fallback to termType for legacy payments that might just store 'ABG' instead of the full ID
      let collectedForTerm = (paymentsByTarget[termId] || 0) + (paymentsByTarget[term.termType] || 0);
      
      // Clear the targeted payments so they aren't double-counted
      if (paymentsByTarget[termId]) {
        delete paymentsByTarget[termId];
      }
      if (paymentsByTarget[term.termType]) {
        delete paymentsByTarget[term.termType];
      }

      // If a specific payment exceeds the term amount, the excess flows to the generic pool
      if (collectedForTerm > allocatedAmount) {
        genericPool += (collectedForTerm - allocatedAmount);
        collectedForTerm = allocatedAmount;
      }

      return {
        termId,
        allocatedAmount,
        collectedForTerm,
        isNetBasis,
        termDate: term.termDate,
        pendingForTerm: 0,
        collectedPercent: 0,
      };
    });

  // Any target payments that didn't match an exact term configuration meaning the term was edited (e.g. date changed)
  // Or orphaned fallback termType payments, funnel them into the generic pool for FIFO distribution 
  Object.values(paymentsByTarget).forEach(orphanAmount => {
    genericPool += orphanAmount;
  });

  // 3. Second pass: distribute generic pool (FIFO) to fill remaining gaps
  termCollections.forEach(tc => {
    const gap = Math.max(0, tc.allocatedAmount - tc.collectedForTerm);
    const fromGeneric = Math.min(gap, genericPool);
    tc.collectedForTerm += fromGeneric;
    genericPool -= fromGeneric;
    
    // Final percentages
    tc.pendingForTerm = Math.max(0, tc.allocatedAmount - tc.collectedForTerm);
    tc.collectedPercent = tc.allocatedAmount > 0 ? (tc.collectedForTerm / tc.allocatedAmount) * 100 : 0;
  });

  // Overdue and Not Due calculations
  const overdueAmount = termCollections
    .filter(tc => {
      const term = milestoneTerms.find(t => `${t.termType}-${t.termDate}-${t.percentage || 0}-${t.taxPercentage || 0}` === tc.termId);
      if (!term) return false;
      const termDate = new Date(term.termDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const termAging = Math.floor((today.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
      return termAging > 0 && tc.collectedPercent < 99 && invoice.milestoneStatus !== 'FULLY_DELIVERED';
    })
    .reduce((sum, tc) => sum + tc.pendingForTerm, 0);

  const notDueAmount = Math.max(0, balanceAmount - overdueAmount);

  // Compute worst-case aging across milestone terms (only for unpaid items)
  const worstTermAging = milestoneTerms.length > 0
    ? Math.max(0, ...milestoneTerms.map(t => {
        const aging = Math.floor((new Date().setHours(0,0,0,0) - new Date(t.termDate).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
        const allocation = termCollections.find(tc => tc.termId === `${t.termType}-${t.termDate}-${t.percentage || 0}-${t.taxPercentage || 0}`);
        const isTermPaid = (allocation?.collectedPercent || 0) >= 99;
        return (aging > 0 && !isTermPaid) ? aging : 0;
      }))
    : 0;



  const getRiskConfig = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return { bg: 'bg-[#9E3B47]/10', text: 'text-[#9E3B47]', border: 'border-[#9E3B47]/30', icon: ShieldAlert };
      case 'HIGH': return { bg: 'bg-[#E17F70]/10', text: 'text-[#E17F70]', border: 'border-[#E17F70]/30', icon: ShieldAlert };
      case 'MEDIUM': return { bg: 'bg-[#CE9F6B]/10', text: 'text-[#976E44]', border: 'border-[#CE9F6B]/30', icon: Shield };
      default: return { bg: 'bg-[#82A094]/10', text: 'text-[#4F6A64]', border: 'border-[#82A094]/30', icon: ShieldCheck };
    }
  };
  const riskConfig = getRiskConfig(invoice.riskClass);



  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'PAID': return { bg: 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]', icon: CheckCircle, glow: 'shadow-[#82A094]/30' };
      case 'PARTIAL': return { bg: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]', icon: TrendingUp, glow: 'shadow-[#CE9F6B]/30' };
      case 'OVERDUE': return { bg: 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]', icon: AlertTriangle, glow: 'shadow-[#E17F70]/30' };
      case 'CANCELLED': return { bg: 'bg-gradient-to-r from-[#92A2A5] to-[#5D6E73]', icon: XCircle, glow: 'shadow-[#92A2A5]/30' };
      default: return { bg: 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]', icon: Clock, glow: 'shadow-[#6F8A9D]/30' };
    }
  };

  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;

  const termOptions: Record<string, string> = { ABG: 'ABG', PO: 'PO', DELIVERY: 'Delivery', FAR: 'FAR', PBG: 'PBG', FAR_PBG: 'FAR & PBG', INVOICE_SUBMISSION: 'Invoice Submission', PI: 'PI', OTHER: 'Other' };

  const tabs = [
    { key: 'details' as const, label: 'Details', icon: Flag },
    { key: 'payments' as const, label: 'Payments', icon: Receipt, count: invoice?.paymentHistory?.length || 0 },
    { key: 'remarks' as const, label: 'Remarks', icon: MessageSquare, count: remarks.length },
    { key: 'activity' as const, label: 'Activity', icon: Clock },
  ];

  return (
    <div className="space-y-6 pb-10">
      {copied && (
        <div className="fixed top-6 right-6 px-5 py-3 bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4" /> Copied!
        </div>
      )}

      {/* Header Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-2xl border-2 border-[#CE9F6B]/30 transition-all">
        {/* Dynamic Background Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-gradient-to-br from-[#E17F70]/15 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#CE9F6B]/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <button 
              onClick={() => router.push('/finance/ar/milestones')}
              className="group flex items-center gap-3 text-[#5D6E73] hover:text-[#546A7A] transition-all"
            >
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#CE9F6B]/10 to-[#976E44]/10 shadow-lg border-2 border-[#CE9F6B]/20 group-hover:from-[#CE9F6B]/20 group-hover:to-[#976E44]/20 transition-colors">
                <ChevronLeft className="w-5 h-5 text-[#976E44]" />
              </div>
              <span className="font-bold text-lg">Back to Milestones</span>
            </button>
            
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={() => loadInvoice(params.id as string)} 
                className="p-3 rounded-2xl bg-gradient-to-br from-[#6F8A9D]/10 to-[#546A7A]/10 text-[#5D6E73] hover:from-[#6F8A9D]/20 hover:to-[#546A7A]/20 transition-all hover:rotate-180 duration-500 border-2 border-[#6F8A9D]/20" 
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-[#6F8A9D]" />
              </button>
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/30 transition-all hover:-translate-y-1 active:scale-95"
              >
                <Plus className="w-5 h-5" /> Record Payment
              </button>
              {invoice.status === 'CANCELLED' ? (
                <>
                  <button 
                    onClick={handleRestoreMilestone}
                    disabled={restoring || deleting}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/30 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                  >
                    {restoring ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    Restore Milestone
                  </button>
                  <button 
                    onClick={handleDeleteMilestone}
                    disabled={restoring || deleting}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white font-bold shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    Delete Milestone
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href={`/finance/ar/milestones/${invoice.id}/edit`}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white font-bold shadow-lg shadow-[#546A7A]/20 hover:shadow-xl transition-all hover:-translate-y-1"
                  >
                    <Pencil className="w-5 h-5" /> Edit
                  </Link>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#92A2A5] to-[#5D6E73] text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all text-sm uppercase tracking-wider"
                  >
                    <XCircle className="w-5 h-5" /> Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div className="flex-1 space-y-8">
              {/* Main Identity */}
              <div className="flex items-center gap-5">
                <div className="relative p-3 sm:p-4 rounded-[1.5rem] bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-2xl shadow-[#CE9F6B]/30 flex-shrink-0 animate-scale-in overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-[#EEC1BF] to-[#9E3B47]" />
                  <Flag className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-4xl font-black text-[#546A7A] tracking-tight">{invoice.invoiceNumber || invoice.soNo || 'MILESTONE RECORD'}</h1>
                    <button 
                      onClick={() => copyToClipboard(invoice.invoiceNumber || invoice.soNo || '')}
                      className="p-2 rounded-xl bg-[#AEBFC3]/10 hover:bg-[#AEBFC3]/20 transition-all group"
                      title="Copy number"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-[#82A094]" /> : <Copy className="w-4 h-4 text-[#92A2A5] group-hover:text-[#546A7A]" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-3 py-1 bg-[#CE9F6B]/10 text-[#976E44] rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Hash className="w-3 h-3" />
                      SO NO: {invoice.soNo || 'N/A'}
                    </span>
                    <span className="text-[#92A2A5] text-sm font-medium">Created {formatARDate(invoice.invoiceDate)}</span>
                  </div>
                </div>
              </div>

              {/* Entity Info */}
              <div className="relative flex items-center gap-6 p-4 rounded-3xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#96AEC2]/5 border-2 border-[#AEBFC3]/20 w-fit overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#96AEC2]" />
                <div className="flex items-center gap-3 border-r border-[#AEBFC3]/30 pr-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white shadow-lg shadow-[#6F8A9D]/20">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-[#546A7A] leading-tight">{invoice.customerName}</h2>
                    <p className="font-mono text-xs text-[#92A2A5] tracking-wider uppercase">{invoice.bpCode}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  {invoice.poNo && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 shadow-sm border-2 border-[#CE9F6B]/20">
                      <div className="p-1 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><Tag className="w-3.5 h-3.5 text-white" /></div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[#92A2A5] leading-none mb-0.5">PO Number</p>
                        <p className="text-xs font-bold text-[#546A7A] leading-none">{invoice.poNo}</p>
                      </div>
                    </div>
                  )}
                  {invoice.region && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#82A094]/5 to-[#4F6A64]/5 shadow-sm border-2 border-[#82A094]/20">
                      <div className="p-1 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64]"><MapPin className="w-3.5 h-3.5 text-white" /></div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[#92A2A5] leading-none mb-0.5">Region</p>
                        <p className="text-xs font-bold text-[#546A7A] leading-none">{invoice.region}</p>
                      </div>
                    </div>
                  )}
                  {/* Risk Class Badge */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-sm border-2 ${riskConfig.bg} ${riskConfig.border}`}>
                    <riskConfig.icon className={`w-3.5 h-3.5 ${riskConfig.text}`} />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#92A2A5] leading-none mb-0.5">Risk</p>
                      <p className={`text-xs font-bold leading-none ${riskConfig.text}`}>{invoice.riskClass}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Timing */}
            <div className="flex flex-col items-start md:items-end gap-3 min-w-fit">
              {/* Payment Status Badge */}
              <div className={`group relative px-6 py-3 rounded-[1.5rem] bg-gradient-to-br ${statusConfig.bg} shadow-2xl transition-all hover:scale-105 ${statusConfig.glow} overflow-hidden`}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/30" />
                <div className="flex items-center gap-3">
                  <StatusIcon className="w-6 h-6 text-white" />
                  <div className="text-left">
                    <p className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Payment Status</p>
                    <p className="text-lg font-black text-white leading-none">{invoice.status}</p>
                  </div>
                </div>
              </div>



              {/* Aging Days Indicator */}
              {worstTermAging > 0 && (
                <div className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-2 border-[#E17F70]/30 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-[#9E3B47] to-[#75242D]" />
                  <AlertTriangle className="w-4 h-4 text-[#E17F70] animate-pulse" />
                  <div>
                    <p className="text-[9px] font-black text-[#E17F70]/70 uppercase tracking-widest leading-none mb-0.5">Max Aging</p>
                    <p className="text-sm font-black text-[#9E3B47] leading-none">{worstTermAging} days overdue</p>
                  </div>
                </div>
              )}
              {worstTermAging === 0 && invoice.status !== 'PAID' && milestoneTerms.length > 0 && (
                <div className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#82A094]/10 to-[#4F6A64]/5 border-2 border-[#82A094]/30 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
                  <Timer className="w-4 h-4 text-[#4F6A64]" />
                  <div>
                    <p className="text-[9px] font-black text-[#82A094]/70 uppercase tracking-widest leading-none mb-0.5">Aging</p>
                    <p className="text-sm font-black text-[#4F6A64] leading-none">On Track</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary - Premium Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#546A7A] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20"><Banknote className="w-5 h-5 text-white" /></div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Total Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(totalAmount)}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2">Milestone value</p>
          </div>
        </div>

        {/* Net Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6F8A9D] via-[#96AEC2] to-[#6F8A9D] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20"><Scale className="w-5 h-5 text-white" /></div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Net Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(Number(invoice.netAmount || 0))}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2">Before tax</p>
          </div>
        </div>

        {/* Tax Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#CE9F6B] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20"><Receipt className="w-5 h-5 text-white" /></div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Tax Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(Number(invoice.taxAmount || 0))}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2">GST/VAT applied</p>
          </div>
        </div>

        {/* Receipts */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#82A094] via-[#4F6A64] to-[#82A094] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20"><ArrowDownRight className="w-5 h-5 text-white" /></div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Receipts</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(totalReceived)}</p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3 h-3 text-white/80" />
              <span className="text-white/80 text-[10px] sm:text-xs">{Math.floor(paymentProgress)}% collected</span>
            </div>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className={`group relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ${
          overdueAmount > 0 
            ? 'bg-gradient-to-br from-[#E17F70] via-[#9E3B47] to-[#E17F70]'
            : 'bg-gradient-to-br from-[#82A094]/40 to-[#4F6A64]/40 border border-[#82A094]/20'
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20"><AlertTriangle className="w-5 h-5 text-white" /></div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Overdue Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(overdueAmount)}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2 flex items-center gap-1">
              {overdueAmount > 0 ? 'Action required' : 'No overdue'}
            </p>
          </div>
        </div>

        {/* Not Due Amount */}
        <div className={`group relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ${
          notDueAmount > 0 
            ? 'bg-gradient-to-br from-[#6F8A9D] via-[#546A7A] to-[#6F8A9D]'
            : 'bg-gradient-to-br from-[#AEBFC3]/40 to-[#92A2A5]/40 border border-[#AEBFC3]/20'
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20"><Timer className="w-5 h-5 text-white" /></div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Not Due Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(notDueAmount)}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2 flex items-center gap-1">
              Future collection
            </p>
          </div>
        </div>
      </div>

      {/* Collection Progress */}
      <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 p-6 shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-[#546A7A]">Collection Progress</h3>
              <p className="text-sm text-[#92A2A5]">Track payment status</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#546A7A]">{Math.floor(paymentProgress)}%</p>
            <p className="text-xs text-[#92A2A5]">
              {formatARCurrency(totalReceived)} of {formatARCurrency(totalAmount)}
            </p>
          </div>
        </div>
        <div className="relative h-6 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${
              paymentProgress >= 100
                ? 'bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#82A094]'
                : paymentProgress >= 50
                ? 'bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#CE9F6B]'
                : 'bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#6F8A9D]'
            }`}
            style={{ width: `${paymentProgress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
          <div className="absolute inset-0 flex items-center justify-between px-1">
            {[25, 50, 75].map((m) => (
              <div
                key={m}
                className={`w-1 h-3 rounded-full ${
                  paymentProgress >= m ? 'bg-white/50' : 'bg-[#92A2A5]/30'
                }`}
                style={{ marginLeft: `${m - 1}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          {['Pending', 'In Progress', 'Almost There', 'Completed'].map((label, i) => (
            <div key={label} className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full mb-1 ${
                  paymentProgress >= i * 33 ? 'bg-[#82A094]' : 'bg-[#AEBFC3]/40'
                }`}
              />
              <span
                className={`text-xs ${
                  paymentProgress >= i * 33 ? 'text-[#5D6E73]' : 'text-[#AEBFC3]'
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Terms & Aging */}
      <div className="relative bg-white rounded-2xl border-2 border-[#CE9F6B]/30 shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-[#CE9F6B]/15 bg-gradient-to-r from-[#CE9F6B] to-[#976E44]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-white text-sm">Payment Terms & Aging</h3>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">{milestoneTerms.length} Terms</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-white/70">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#E17F70]" /> Overdue</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#A2B9AF]" /> On Track</div>
          </div>
        </div>

        {milestoneTerms.length > 0 ? (
          <div className="divide-y divide-[#AEBFC3]/10">
            {milestoneTerms.map((term, index) => {
              const termDate = new Date(term.termDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const termAging = Math.floor((today.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
              const percentage = term.percentage || 0;
              const taxPercentage = term.taxPercentage || 0;
              const allocation = termCollections.find((t) => t.termId === `${term.termType}-${term.termDate}-${percentage}-${taxPercentage}`);
              const collectedForTerm = allocation?.collectedForTerm || 0;
              const pendingForTerm = allocation?.pendingForTerm || 0;
              const collectedPercent = allocation?.collectedPercent || 0;
              const allocatedAmount = allocation?.allocatedAmount || 0;
              const isFullyPaid = pendingForTerm < 0.01 && allocatedAmount > 0;
              // BULK FIX: Remove milestoneStatus condition
              const isTermOverdue = termAging > 0 && !isFullyPaid;

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
                        <p className={`text-[9px] font-bold uppercase ${pendingForTerm > 0 ? (termAging > 0 ? 'text-[#9E3B47]' : 'text-[#CE9F6B]') : 'text-[#92A2A5]'}`}>
                          {isFullyPaid ? 'Pending' : termAging > 0 ? 'Due' : 'Not Due'}
                        </p>
                        <p className={`text-xs font-bold ${pendingForTerm > 0 ? (termAging > 0 ? 'text-[#9E3B47]' : 'text-[#CE9F6B]') : 'text-[#82A094]'}`}>{formatARCurrency(pendingForTerm)}</p>
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
                      }`}>{isFullyPaid ? '100%' : `${Math.floor(collectedPercent)}%`}</span>
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
                        {isFullyPaid ? 'Paid' : termAging > 0 ? 'Overdue' : 'Not Due'}
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
        ) : (
          <div className="text-center py-10">
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#CE9F6B]/20 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-white/40 to-[#CE9F6B]" />
              <Tag className="w-8 h-8 text-white" />
            </div>
            <p className="font-bold text-sm mb-1 text-[#5D6E73]">No payment terms defined</p>
            <Link href={`/finance/ar/milestones/${params.id}/edit`} className="text-[#CE9F6B] text-xs font-bold hover:underline">
              Add payment terms →
            </Link>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="relative flex items-center gap-2 bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-2 shadow-lg mb-6 overflow-x-auto scrollbar-hide">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl font-bold transition-all flex-1 min-w-fit whitespace-nowrap justify-center ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg'
                : 'text-[#5D6E73] hover:bg-[#AEBFC3]/10 border-2 border-transparent hover:border-[#AEBFC3]/30'
            }`}>
            <tab.icon className="w-4 h-4" />
            <span className="text-sm sm:text-base">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[#AEBFC3]/20 text-[#6F8A9D]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="relative bg-white rounded-2xl border-2 border-[#AEBFC3]/30 shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#96AEC2]" />
        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Milestone Information */}
                <div>
                  <h4 className="flex items-center gap-3 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] shadow-lg shadow-[#E17F70]/20"><Hash className="w-5 h-5 text-white" /></div>
                    Milestone Information
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'SO Number', value: invoice.soNo || '-', icon: Hash },
                      { label: 'Invoice Number', value: invoice.invoiceNumber || '-', icon: FileText },
                      { label: 'Invoice Date', value: formatARDate(invoice.invoiceDate), icon: Calendar, highlight: isOverdue },
                      { label: 'Booking Month', value: formatARMonth(invoice.bookingMonth), icon: BarChart3 },
                      { label: 'Category', value: invoice.type || 'N/A', icon: Tag },
                      { label: 'Risk Class', value: invoice.riskClass || '-', icon: Shield },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#AEBFC3]/10 transition-colors">
                        <item.icon className={`w-4 h-4 ${item.highlight ? 'text-[#E17F70]' : 'text-[#6F8A9D]'}`} />
                        <span className="text-[#92A2A5] text-sm w-32">{item.label}</span>
                        <span className={`font-medium ${item.highlight ? 'text-[#9E3B47]' : 'text-[#546A7A]'}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Details */}
                <div>
                  <h4 className="flex items-center gap-3 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20"><Building className="w-5 h-5 text-white" /></div>
                    Customer Details
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Company', value: invoice.customerName },
                      { label: 'BP Code', value: invoice.bpCode, mono: true },
                      { label: 'Region', value: invoice.region || '-' },
                      { label: 'Department', value: invoice.department || '-' },
                      { 
                        label: 'Accounting Status', 
                        value: invoice.accountingStatus === 'REVENUE_RECOGNISED' ? 'Revenue Recognised' : 
                               invoice.accountingStatus === 'BACKLOG' ? 'Backlog' : '-', 
                        highlight: !!invoice.accountingStatus 
                      },
                      ...(invoice.mailToTSP && invoice.mailToTSP !== 'false' ? [{ label: 'TSP Assigned', value: invoice.mailToTSP }] : []),
                      { label: 'Payment Terms', value: invoice.actualPaymentTerms || '-' },
                    ].map((item: any) => (
                      <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#AEBFC3]/10 transition-colors">
                        <span className="text-[#92A2A5] text-sm w-24">{item.label}</span>
                        <span className={`font-medium ${item.highlight ? 'text-[#CE9F6B]' : 'text-[#546A7A]'} ${item.mono ? 'font-mono text-[#E17F70]' : ''}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div>
                  <h4 className="flex items-center gap-3 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20"><IndianRupee className="w-5 h-5 text-white" /></div>
                    Financial Breakdown
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Total Amount', value: formatARCurrency(totalAmount), bg: 'bg-[#6F8A9D]/10', text: 'text-[#546A7A]' },
                      { label: 'Total Received', value: formatARCurrency(totalReceived), bg: 'bg-[#82A094]/10', text: 'text-[#4F6A64]' },
                      { label: 'Balance Due', value: formatARCurrency(balanceAmount), bg: 'bg-[#AEBFC3]/5', text: balanceAmount > 0 ? 'text-[#E17F70]' : 'text-[#546A7A]' },
                    ].map((item) => (
                      <div key={item.label} className={`flex items-center justify-between p-3 rounded-xl ${item.bg}`}>
                        <span className="text-[#546A7A] font-bold text-sm">{item.label}</span>
                        <span className={`font-bold ${item.text}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Person */}
                <div>
                  <h4 className="flex items-center gap-3 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20"><User className="w-5 h-5 text-white" /></div>
                    Contact Person
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Name', value: invoice.personInCharge || '-', icon: User },
                      { label: 'Email', value: invoice.emailId || '-', icon: Mail, copyable: true },
                      { label: 'Phone', value: invoice.contactNo || '-', icon: Phone, copyable: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#AEBFC3]/10 transition-colors group">
                        <item.icon className="w-4 h-4 text-[#CE9F6B]" />
                        <span className="text-[#92A2A5] text-sm w-20">{item.label}</span>
                        <span className="font-medium text-[#546A7A] flex-1">{item.value}</span>
                        {item.copyable && item.value !== '-' && (
                          <button onClick={() => copyToClipboard(item.value)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#AEBFC3]/20 transition-all">
                            <Copy className="w-3.5 h-3.5 text-[#92A2A5]" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

                {/* Contractual Payment Terms Summary */}
                <div className="lg:col-span-2">
                  <h4 className="flex items-center gap-3 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20"><FileText className="w-5 h-5 text-white" /></div>
                    Contractual Payment Terms (Full Summary)
                  </h4>
                  <div className="relative p-5 rounded-2xl bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 border-2 border-[#CE9F6B]/30 overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <FileText className="w-24 h-24 text-[#CE9F6B]" />
                    </div>
                    {invoice.actualPaymentTerms ? (
                      <p className="text-[#5D6E73] font-medium leading-relaxed whitespace-pre-wrap relative z-10">
                        {invoice.actualPaymentTerms}
                      </p>
                    ) : (
                      <p className="text-[#92A2A5] italic text-sm relative z-10">No manual payment terms summary provided.</p>
                    )}
                  </div>
                </div>
              </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h4 className="flex items-center gap-3 text-lg font-bold text-[#546A7A]">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20"><Receipt className="w-5 h-5 text-white" /></div>
                  Payment History
                </h4>
                <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/30 transition-all">
                  <Plus className="w-4 h-4" /> Add Payment
                </button>
              </div>

              {invoice.paymentHistory && invoice.paymentHistory.length > 0 ? (
                <div className="space-y-3">
                  {invoice.paymentHistory.map((payment, index) => (
                    <div key={payment.id} className="flex items-center gap-4 p-4 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#82A094]/5 transition-colors border border-transparent hover:border-[#82A094]/20">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center text-white font-bold shadow-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1 flex flex-col sm:grid sm:grid-cols-6 gap-4 items-start sm:items-center">
                        <div className="w-full sm:w-auto">
                          <p className="text-[10px] sm:text-xs text-[#92A2A5] uppercase font-bold sm:normal-case sm:font-normal">Date</p>
                          <p className="font-medium text-[#546A7A] text-sm sm:text-base">{formatARDate(payment.paymentDate)}</p>
                        </div>
                        <div className="w-full sm:w-auto">
                          <p className="text-[10px] sm:text-xs text-[#92A2A5] uppercase font-bold sm:normal-case sm:font-normal">Payment Term</p>
                          {payment.milestoneTerm ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#CE9F6B]/10 text-[#976E44] text-xs font-bold">
                              <Tag className="w-3 h-3" />
                              {(() => {
                                const termId = payment.milestoneTerm;
                                // Try to find the actual term in current milestone definition for the best label (especially for OTHER)
                                const actualTerm = milestoneTerms.find(t => `${t.termType}-${t.termDate}-${t.percentage || 0}-${t.taxPercentage || 0}` === termId);
                                if (actualTerm) {
                                  return actualTerm.termType === 'OTHER' ? (actualTerm.customLabel || 'Other') : (termOptions[actualTerm.termType] || actualTerm.termType);
                                }
                                
                                // Fallback: Parse the composite ID if term not found/deleted
                                if (termId.includes('-')) {
                                  const parts = termId.split('-');
                                  const type = parts[0];
                                  return termOptions[type] || type;
                                }
                                
                                // Fallback: Simple term type (Legacy payments)
                                return termOptions[termId] || termId;
                              })()}
                            </span>
                          ) : (
                            <p className="font-medium text-[#92A2A5] text-xs">-</p>
                          )}
                        </div>
                        <div className="w-full sm:w-auto">
                          <p className="text-[10px] sm:text-xs text-[#92A2A5] uppercase font-bold sm:normal-case sm:font-normal">Mode & Bank</p>
                          <div className="flex flex-row sm:flex-col items-center sm:items-start gap-2 sm:gap-0">
                            <p className="font-medium text-[#546A7A] text-sm sm:text-base">{payment.paymentMode || '-'}</p>
                            {payment.referenceBank && (
                              <span className="text-[9px] sm:text-[10px] font-bold text-[#6F8A9D] uppercase bg-[#6F8A9D]/10 px-1.5 py-0.5 rounded sm:p-0 sm:bg-transparent">@{payment.referenceBank}</span>
                            )}
                          </div>
                        </div>
                        <div className="w-full sm:w-auto">
                          <p className="text-[10px] sm:text-xs text-[#92A2A5] uppercase font-bold sm:normal-case sm:font-normal">Added By</p>
                          <p className="font-medium text-[#CE9F6B] text-xs sm:text-sm">{(payment as any).recordedBy || (payment as any).recordedByUser?.name || '-'}</p>
                        </div>
                        <div className="w-full sm:text-right">
                          <p className="text-[10px] sm:text-xs text-[#92A2A5] uppercase font-bold sm:normal-case sm:font-normal">Amount</p>
                          <p className="font-bold text-[#4F6A64] text-base sm:text-lg">{formatARCurrency(payment.amount)}</p>
                          {payment.notes && (
                            <p className="text-[10px] text-[#92A2A5] mt-0.5 italic truncate max-w-[200px]" title={payment.notes}>
                              <MessageSquare className="w-2.5 h-2.5 inline mr-1" />{payment.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                          <button onClick={() => handleEditPayment(payment)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-0 px-4 sm:px-2 py-2 rounded-lg bg-[#6F8A9D]/10 text-[#6F8A9D] hover:bg-[#6F8A9D]/20 transition-all font-semibold sm:font-normal text-xs sm:text-base" title="Edit payment">
                            <Pencil className="w-4 h-4" /><span className="sm:hidden">Edit</span>
                          </button>
                          <button onClick={() => handleDeletePayment(payment.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-0 px-4 sm:px-2 py-2 rounded-lg bg-[#E17F70]/10 text-[#9E3B47] hover:bg-[#E17F70]/20 transition-all font-semibold sm:font-normal text-xs sm:text-base" title="Delete payment">
                            <Trash2 className="w-4 h-4" /><span className="sm:hidden">Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#82A094]/20 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#82A094]" />
                    <Receipt className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-[#5D6E73] mb-2">No Payment Records</h3>
                  <p className="text-[#92A2A5] mb-6">Start tracking payments by adding your first record.</p>
                  <button onClick={() => setShowPaymentModal(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold rounded-xl shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/30 transition-all">
                    <Plus className="w-4 h-4" /> Add First Payment
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Remarks Tab */}
          {activeTab === 'remarks' && (
            <div>
              <h4 className="flex items-center gap-3 text-lg font-bold text-[#546A7A] mb-6">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20"><MessageSquare className="w-5 h-5 text-white" /></div>
                Remarks & Follow-ups
              </h4>

              {/* Add New Remark Form */}
              <div className="relative mb-6 p-4 rounded-xl bg-gradient-to-r from-[#6F8A9D]/5 to-[#546A7A]/5 border-2 border-[#6F8A9D]/20 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#96AEC2]" />
                <div className="flex gap-3">
                  <textarea
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    placeholder="Add a remark or follow-up note..."
                    className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#6F8A9D] focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/10 resize-none h-20 font-medium"
                  />
                  <button
                    onClick={handleAddRemark}
                    disabled={addingRemark || !newRemark.trim()}
                    className="px-6 py-3 h-fit rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-bold shadow-lg shadow-[#6F8A9D]/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {addingRemark ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                  </button>
                </div>
              </div>

              {/* Remarks Timeline */}
              {remarksLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#6F8A9D]" /></div>
              ) : remarks.length > 0 ? (
                <div className="space-y-4">
                  {remarks.map((remark: any) => (
                    <div key={remark.id} className="relative pl-8 pb-4 border-l-2 border-[#AEBFC3]/30 last:border-l-transparent">
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] border-2 border-white shadow" />
                      <div className="bg-white rounded-xl p-4 shadow-md border border-[#AEBFC3]/20 ml-4 group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center text-white text-sm font-bold">
                              {remark.createdBy?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-[#546A7A] text-sm">{remark.createdBy?.name || 'Unknown'}</p>
                              <p className="text-xs text-[#92A2A5]">{remark.createdBy?.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center justify-end gap-2 mb-1">
                              <p className="text-xs text-[#92A2A5]">{new Date(remark.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                              <p className="text-xs text-[#CE9F6B] font-medium">{new Date(remark.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                              <button onClick={() => {setEditingRemarkId(remark.id); setEditingRemarkContent(remark.content);}} className="text-[#6F8A9D] hover:text-[#546A7A] transition-colors" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteRemark(remark.id)} className="text-[#E17F70] hover:text-[#9E3B47] transition-colors" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {editingRemarkId === remark.id ? (
                          <div className="mt-2 flex flex-col gap-2">
                            <textarea
                              value={editingRemarkContent}
                              onChange={(e) => setEditingRemarkContent(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[#AEBFC3]/40 focus:border-[#6F8A9D] focus:outline-none focus:ring-1 focus:ring-[#6F8A9D]/20 resize-none text-sm text-[#5D6E73]"
                              rows={3}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => setEditingRemarkId(null)} className="px-3 py-1 text-xs font-bold text-[#92A2A5] hover:text-[#5D6E73]">Cancel</button>
                              <button onClick={() => handleEditRemark(remark.id)} className="px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] rounded-lg shadow-sm hover:opacity-90">Save</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[#5D6E73] whitespace-pre-wrap">{remark.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#6F8A9D]/20 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#96AEC2] via-white/40 to-[#6F8A9D]" />
                    <MessageSquare className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-[#5D6E73] mb-2">No Remarks Yet</h3>
                  <p className="text-[#92A2A5] mb-2">Add your first remark or follow-up note above.</p>
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#546A7A]">Activity Log</h3>
                    <p className="text-sm text-[#92A2A5]">Complete audit trail of all activities</p>
                  </div>
                </div>
                <button 
                  onClick={() => invoice && loadActivityLog(invoice.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#6F8A9D] font-bold hover:bg-[#6F8A9D]/10 transition-colors border-2 border-[#6F8A9D]/20 hover:border-[#6F8A9D]/40"
                >
                  <RefreshCw className={`w-4 h-4 ${activityLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {activityLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-[#6F8A9D] animate-spin" /></div>
              ) : activityLogs.length > 0 ? (
                <div className="space-y-4">
                  {activityLogs.map((activity: any, index: number) => {
                    const getActionIcon = (action: string) => {
                      switch (action) {
                        case 'INVOICE_CREATED': return { icon: Plus, color: 'from-[#82A094] to-[#4F6A64]' };
                        case 'INVOICE_UPDATED': return { icon: Pencil, color: 'from-[#6F8A9D] to-[#546A7A]' };
                        case 'PAYMENT_RECORDED': return { icon: IndianRupee, color: 'from-[#CE9F6B] to-[#976E44]' };
                        case 'PAYMENT_UPDATED': return { icon: Pencil, color: 'from-[#CE9F6B] to-[#976E44]' };
                        case 'PAYMENT_DELETED': return { icon: Trash2, color: 'from-[#E17F70] to-[#9E3B47]' };
                        case 'STATUS_CHANGED': return { icon: TrendingUp, color: 'from-[#E17F70] to-[#9E3B47]' };
                        case 'DELIVERY_UPDATED': return { icon: Truck, color: 'from-[#96AEC2] to-[#6F8A9D]' };
                        case 'REMARK_ADDED': return { icon: MessageSquare, color: 'from-[#CE9F6B] to-[#976E44]' };
                        case 'REMARK_UPDATED': return { icon: Pencil, color: 'from-[#6F8A9D] to-[#546A7A]' };
                        case 'REMARK_DELETED': return { icon: Trash2, color: 'from-[#E17F70] to-[#9E3B47]' };
                        case 'INVOICE_IMPORTED': return { icon: Package, color: 'from-[#82A094] to-[#4F6A64]' };
                        case 'MILESTONE_LINKED': 
                        case 'LINKED_TO_INVOICE': return { icon: Link2, color: 'from-[#82A094] to-[#546A7A]' };
                        default: return { icon: Clock, color: 'from-[#AEBFC3] to-[#92A2A5]' };
                      }
                    };
                    const actionConfig = getActionIcon(activity.action);
                    const ActionIcon = actionConfig.icon;

                    return (
                      <div key={activity.id || index} className="relative flex gap-4 group/timeline">
                        {/* Timeline line */}
                        {index < activityLogs.length - 1 && (
                          <div className="absolute left-5 top-12 w-0.5 h-full bg-gradient-to-b from-[#AEBFC3]/50 to-transparent group-hover/timeline:from-[#6F8A9D]/50 transition-colors" />
                        )}
                        
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${actionConfig.color} flex items-center justify-center shadow-md flex-shrink-0 relative z-10 group-hover/timeline:scale-110 transition-transform duration-300`}>
                          <ActionIcon className="w-5 h-5 text-white" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 bg-white rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md border border-[#AEBFC3]/20 hover:border-[#AEBFC3]/50 transition-all duration-300">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="font-semibold text-[#546A7A] text-base">{activity.description}</p>
                              {activity.fieldName && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 p-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-transparent border border-[#AEBFC3]/10">
                                  <span className="text-[10px] font-bold bg-white text-[#6F8A9D] px-2.5 py-1 rounded-lg border border-[#6F8A9D]/20 shadow-sm uppercase tracking-widest whitespace-nowrap w-fit">
                                    {activity.fieldName}
                                  </span>
                                  {(activity.oldValue || activity.newValue) ? (
                                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-sm flex-1">
                                      {activity.oldValue && (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E17F70]/5 border border-[#E17F70]/10">
                                          <span className="text-[10px] text-[#E17F70] font-bold uppercase tracking-wider">Old</span>
                                          <span className="text-[#9E3B47] line-through decoration-[#E17F70]/50 font-medium break-all">{activity.oldValue}</span>
                                        </div>
                                      )}
                                      {activity.oldValue && activity.newValue && (
                                        <ArrowRight className="w-4 h-4 text-[#AEBFC3] flex-shrink-0" />
                                      )}
                                      {activity.newValue && (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#82A094]/5 border border-[#82A094]/10">
                                          <span className="text-[10px] text-[#82A094] font-bold uppercase tracking-wider">New</span>
                                          <span className="text-[#4F6A64] font-bold break-all">{activity.newValue}</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            <div className="text-left sm:text-right flex-shrink-0">
                              <p className="text-xs text-[#92A2A5] font-medium">
                                {new Date(activity.createdAt).toLocaleDateString('en-IN', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </p>
                              <p className="text-xs text-[#CE9F6B] font-bold mt-0.5">
                                {new Date(activity.createdAt).toLocaleTimeString('en-IN', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#AEBFC3]/10">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#AEBFC3]/20 to-[#AEBFC3]/40 flex items-center justify-center border border-white shadow-sm">
                              <User className="w-3.5 h-3.5 text-[#546A7A]" />
                            </div>
                            <span className="text-sm font-semibold text-[#5D6E73]">{activity.performedBy || 'System'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#6F8A9D]/20 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#96AEC2] via-white/40 to-[#6F8A9D]" />
                    <Clock className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-[#5D6E73] mb-2">No Activity Yet</h3>
                  <p className="text-[#92A2A5]">Activity will be recorded when changes are made.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>



      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closePaymentModal(); }}>
          <div className="bg-white rounded-[2rem] w-full max-w-xl shadow-2xl relative animate-scale-in overflow-hidden">
            {/* Gradient Header with Balance Info */}
            <div className="relative bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#82A094] px-7 py-5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#82A094]" />
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-xl" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-lg" />
              <button onClick={closePaymentModal} className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="relative flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                  <IndianRupee className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</h3>
                  <p className="text-[11px] text-white/60">{invoice?.invoiceNumber ?? ''} • {invoice?.customerName ?? ''}</p>
                </div>
              </div>
              {/* Quick Balance Strip */}
              <div className="relative flex items-center gap-4 mt-4 pt-3 border-t border-white/15">
                <div className="flex-1">
                  <p className="text-[9px] uppercase tracking-widest text-white/50 font-bold">Total</p>
                  <p className="text-sm font-bold text-white">{formatARCurrency(totalAmount)}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] uppercase tracking-widest text-white/50 font-bold">Received</p>
                  <p className="text-sm font-bold text-[#A8E6CF]">{formatARCurrency(totalReceived)}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] uppercase tracking-widest text-white/50 font-bold">Balance</p>
                  <p className={`text-sm font-bold ${balanceAmount > 0 ? 'text-[#FFB8B8]' : 'text-[#A8E6CF]'}`}>{formatARCurrency(Math.abs(balanceAmount))}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-[9px] uppercase tracking-widest text-white/50 font-bold">Progress</p>
                  <p className="text-sm font-bold text-white">{Math.floor(paymentProgress)}%</p>
                </div>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handlePaymentSubmit} className="px-7 py-5 space-y-4">
              {/* Payment Term - Visual Card Selector */}
              {milestoneTerms.length > 0 && (
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#5D6E73] mb-2 uppercase tracking-wider">
                    <div className="p-1 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><Tag className="w-3 h-3 text-white" /></div> Milestone Stage <span className="text-[#E17F70]">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {milestoneTerms.map((term, idx) => {
                      const label = term.termType === 'OTHER' ? (term.customLabel || 'Other') : (termOptions[term.termType] || term.termType);
                      const currentTermId = `${term.termType}-${term.termDate}-${term.percentage || 0}-${term.taxPercentage || 0}`;
                      const isSelected = paymentForm.milestoneTerm === currentTermId;
                      const allocation = termCollections.find((t) => t.termId === currentTermId);
                      const stageProgress = allocation?.collectedPercent || 0;
                      const allocatedAmt = allocation?.allocatedAmount || 0;
                      const pendingAmt = allocation?.pendingForTerm || 0;
                      const isFullyPaid = pendingAmt < 0.01 && allocatedAmt > 0 && !isSelected;
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isFullyPaid}
                          onClick={() => {
                            setPaymentForm({...paymentForm, milestoneTerm: currentTermId});
                            if (pendingAmt > 0) {
                              // Optionally pre-fill the pending amount
                              // setPaymentForm(prev => ({...prev, amount: pendingAmt.toString(), milestoneTerm: currentTermId})) 
                            }
                          }}
                          className={`relative group p-2.5 rounded-xl border-2 text-left transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#82A094] bg-[#82A094]/5 shadow-md shadow-[#82A094]/10 ring-1 ring-[#82A094]/20'
                              : isFullyPaid
                                ? 'border-[#AEBFC3]/20 bg-[#F8FAFB] opacity-60 cursor-not-allowed'
                                : 'border-[#AEBFC3]/25 bg-white hover:border-[#AEBFC3]/50 hover:bg-[#AEBFC3]/5'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#82A094] flex items-center justify-center shadow-sm">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-1 w-full">
                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#4F6A64]' : 'text-[#546A7A]'}`}>{label}</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md whitespace-nowrap ${pendingAmt < 0.01 && allocatedAmt > 0 ? 'bg-[#82A094]/10 text-[#4F6A64]' : 'bg-[#AEBFC3]/20 text-[#546A7A]'}`}>
                              {pendingAmt < 0.01 && allocatedAmt > 0 ? '✓ Paid' : `${Math.floor(stageProgress)}%`}
                            </span>
                          </div>
                          <div className="flex flex-col mt-1 w-full gap-0.5">
                            <span className="text-[10px] font-black bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/10 text-[#976E44] px-1.5 py-0.5 rounded-md w-fit border border-[#CE9F6B]/20">
                              {term.percentage}% {term.taxPercentage ? `+ ${term.taxPercentage}% T` : ''}
                            </span>
                            
                            <div className="mt-1.5 flex flex-col gap-0.5 border-t border-[#AEBFC3]/20 pt-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-[#92A2A5]">Total Value:</span>
                                <span className="font-bold text-[#546A7A]">{formatARCurrency(allocatedAmt)}</span>
                              </div>
                              {pendingAmt > 0 && (
                                <div className="flex justify-between items-center text-[11px] mt-0.5">
                                  <span className="font-bold text-[#E17F70]">Pending:</span>
                                  <span className="font-black text-[#E17F70]">{formatARCurrency(pendingAmt)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Mini progress bar */}
                          <div className="h-1.5 bg-[#AEBFC3]/30 rounded-full mt-2 overflow-hidden w-full shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-500 ease-out ${isSelected ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]' : 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]'}`} style={{ width: `${Math.min(100, stageProgress)}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {/* Hidden required input for form validation */}
                  <input type="text" value={paymentForm.milestoneTerm} required className="sr-only" tabIndex={-1} onChange={() => {}} />
                </div>
              )}

              {/* Amount & Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#5D6E73] mb-1.5 uppercase tracking-wider">
                    <div className="p-1 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64]"><IndianRupee className="w-3 h-3 text-white" /></div> Amount <span className="text-[#E17F70]">*</span>
                  </label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    required 
                    value={formatAmountForInput(paymentForm.amount)} 
                    onChange={e => {
                      const raw = parseFormattedAmount(e.target.value);
                      if (!isNaN(Number(raw)) || raw === '' || raw === '.') {
                        setPaymentForm({...paymentForm, amount: raw});
                      }
                    }} 
                    className="w-full h-12 px-3.5 rounded-xl bg-gradient-to-r from-[#82A094]/5 to-[#4F6A64]/5 border-2 border-[#82A094]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none focus:ring-3 focus:ring-[#82A094]/15 transition-all font-mono text-lg font-bold" 
                    placeholder="0.00" 
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#5D6E73] mb-1.5 uppercase tracking-wider">
                    <div className="p-1 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]"><Calendar className="w-3 h-3 text-white" /></div> Date <span className="text-[#E17F70]">*</span>
                  </label>
                  <input type="date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm({...paymentForm, paymentDate: e.target.value})} className="w-full h-12 px-3 rounded-xl bg-gradient-to-r from-[#6F8A9D]/5 to-[#546A7A]/5 border-2 border-[#6F8A9D]/30 text-[#546A7A] focus:border-[#6F8A9D] focus:outline-none transition-all text-sm font-medium" />
                </div>
              </div>

              {/* Bank & Mode Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#5D6E73] mb-1.5 uppercase tracking-wider">
                    <div className="p-1 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><Building className="w-3 h-3 text-white" /></div> Bank <span className="text-[#E17F70]">*</span>
                  </label>
                  <select value={paymentForm.referenceBank} onChange={e => setPaymentForm({...paymentForm, referenceBank: e.target.value})} className="w-full h-12 px-3 rounded-xl bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 border-2 border-[#CE9F6B]/30 text-[#546A7A] focus:border-[#CE9F6B] focus:outline-none transition-all text-sm font-medium" required>
                    <option value="" disabled>Select Bank</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="DB">Deutsche Bank (DB)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#5D6E73] mb-1.5 uppercase tracking-wider">
                    <div className="p-1 rounded-lg bg-gradient-to-br from-[#E17F70] to-[#9E3B47]"><CreditCard className="w-3 h-3 text-white" /></div> Mode <span className="text-[#E17F70]">*</span>
                  </label>
                  <select value={paymentForm.paymentMode} onChange={e => setPaymentForm({...paymentForm, paymentMode: e.target.value})} className="w-full h-12 px-3 rounded-xl bg-gradient-to-r from-[#E17F70]/5 to-[#9E3B47]/5 border-2 border-[#E17F70]/30 text-[#546A7A] focus:border-[#E17F70] focus:outline-none transition-all text-sm font-medium" required>
                    <option value="" disabled>Select Mode</option>
                    <option value="Receipt">Receipt</option>
                    <option value="TDS">TDS</option>
                    <option value="LD">LD</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#5D6E73] mb-1.5 uppercase tracking-wider">
                  <div className="p-1 rounded-lg bg-gradient-to-br from-[#92A2A5] to-[#5D6E73]"><MessageSquare className="w-3 h-3 text-white" /></div> Notes <span className="text-[#92A2A5] font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <textarea value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#AEBFC3] focus:outline-none transition-all resize-none h-16 text-sm" placeholder="Add remarks or reference details..." />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 border-t-2 border-[#AEBFC3]/20">
                <button type="button" onClick={closePaymentModal} className="flex-1 py-3 rounded-xl border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-bold hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/60 transition-all text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={paymentLoading} className="flex-[1.5] py-3 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 active:scale-95">
                  {paymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {editingPaymentId ? 'Update Payment' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowCancelModal(false); }}>
          <div className="relative bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl animate-scale-in overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#92A2A5] via-[#5D6E73] to-[#A2B9AF]" />
            <button 
              onClick={() => setShowCancelModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl border-2 border-[#AEBFC3]/20 hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/40 transition-all"
            >
              <X className="w-5 h-5 text-[#5D6E73]" />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-[#92A2A5] to-[#5D6E73] shadow-lg shadow-[#92A2A5]/20 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#AEBFC3] via-white/40 to-[#92A2A5]" />
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#546A7A]">Cancel Milestone</h3>
                <p className="text-sm text-[#92A2A5]">Are you sure you want to cancel this milestone payment?</p>
              </div>
            </div>
            
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#E17F70]/5 border border-[#E17F70]/20">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#E17F70] flex-shrink-0" />
                  <p className="text-sm text-[#9E3B47]">
                    Cancelling will zero out the balance and mark it as non-receivable. This action is recorded in the audit log.
                  </p>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-[#5D6E73] mb-2 uppercase tracking-wider">
                  Reason for Cancellation <span className="text-[#E17F70]">*</span>
                </label>
                <textarea 
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#92A2A5] focus:outline-none focus:ring-2 focus:ring-[#92A2A5]/10 transition-all resize-none h-32 font-medium"
                  placeholder="e.g., Project scope changed, Mistake in entry..."
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-bold hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/60 transition-all"
                >
                  Go Back
                </button>
                <button 
                  onClick={handleCancelMilestone}
                  disabled={cancelling || !cancelReason.trim()}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white font-bold shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:shadow-[#E17F70]/40 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes scale-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
