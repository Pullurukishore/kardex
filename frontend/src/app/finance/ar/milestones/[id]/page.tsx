'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, ARPaymentHistory, formatARCurrency, formatARDate, MilestonePaymentTerm } from '@/lib/ar-api';
import {
  ArrowLeft, Pencil, Trash2, FileText, Calendar, User, Clock,
  AlertTriangle, CheckCircle, Loader2, Mail, Phone, MapPin,
  IndianRupee, Package, TrendingUp, XCircle, Timer, Banknote,
  ArrowDownRight, ArrowUpRight, Sparkles, Wallet, BadgeCheck,
  Scale, Link2, Tag, Truck, RefreshCw, Plus, X, Copy, Shield,
  PackageCheck, PackageX, Receipt, MessageSquare, ChevronLeft,
  Hash, CreditCard, Building
} from 'lucide-react';

export default function MilestoneViewPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<ARInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'remarks' | 'activity'>('details');

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: '', referenceBank: '', notes: ''
  });

  // Remarks
  const [remarks, setRemarks] = useState<any[]>([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [addingRemark, setAddingRemark] = useState(false);

  // Activity
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => { if (params.id) loadInvoice(params.id as string); }, [params.id]);
  useEffect(() => { if (invoice?.id) loadRemarks(invoice.id); }, [invoice?.id]);
  useEffect(() => {
    if (invoice?.id && activeTab === 'activity' && activityLogs.length === 0) loadActivityLog(invoice.id);
  }, [activeTab, invoice?.id]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true); setError(null);
      const data = await arApi.getInvoiceById(id);
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

  const handleDelete = async () => {
    if (!invoice || !confirm('Are you sure you want to delete this milestone payment?')) return;
    try { setDeleting(true); await arApi.deleteInvoice(invoice.id); router.push('/finance/ar/milestones'); }
    catch { setDeleting(false); }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false); setEditingPaymentId(null);
    setPaymentForm({ amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMode: '', referenceBank: '', notes: '' });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!invoice) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { alert('Please enter a valid amount'); return; }
    try {
      setPaymentLoading(true);
      const paymentData = { amount: parseFloat(paymentForm.amount), paymentDate: paymentForm.paymentDate, paymentMode: paymentForm.paymentMode, referenceBank: paymentForm.referenceBank, notes: paymentForm.notes };
      if (editingPaymentId) await arApi.updatePayment(invoice.id, editingPaymentId, paymentData);
      else await arApi.addPayment(invoice.id, paymentData);
      closePaymentModal(); await loadInvoice(invoice.id);
    } catch { alert('Failed to record payment'); } finally { setPaymentLoading(false); }
  };

  const handleEditPayment = (payment: ARPaymentHistory) => {
    setEditingPaymentId(payment.id);
    setPaymentForm({ amount: payment.amount.toString(), paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0], paymentMode: payment.paymentMode, referenceBank: payment.referenceBank || '', notes: payment.notes || '' });
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
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/30" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#CE9F6B] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-[#E17F70] border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          <Wallet className="absolute inset-0 m-auto w-6 h-6 text-[#546A7A]" />
        </div>
        <p className="text-[#5D6E73] font-medium">Loading milestone payment...</p>
      </div>
    </div>
  );

  if (error || !invoice) return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#CE9F6B]/20 to-[#E17F70]/20 flex items-center justify-center mx-auto mb-6 shadow-xl">
          <Wallet className="w-14 h-14 text-[#CE9F6B]" />
        </div>
        <h2 className="text-2xl font-bold text-[#546A7A] mb-3">Milestone Payment Not Found</h2>
        <p className="text-[#92A2A5] mb-8">{error || "The milestone payment you're looking for doesn't exist."}</p>
        <Link href="/finance/ar/milestones" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white font-semibold rounded-xl hover:shadow-lg transition-all">
          <ArrowLeft className="w-4 h-4" /> Back to Milestones
        </Link>
      </div>
    </div>
  );

  const totalAmount = Number(invoice.totalAmount || 0);
  const totalReceived = Number(invoice.totalReceipts || 0);
  const balanceAmount = Number(invoice.balance) || (totalAmount - totalReceived);
  const paymentProgress = totalAmount > 0 ? Math.min(100, (totalReceived / totalAmount) * 100) : 0;
  const daysOverdue = invoice.dueByDays || 0;
  const isOverdue = invoice.status === 'OVERDUE' || (daysOverdue > 0 && invoice.status !== 'PAID');

  const getDeliveryDueDays = () => {
    if (!invoice.deliveryDueDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.deliveryDueDate); dueDate.setHours(0, 0, 0, 0);
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };
  const deliveryDueDays = getDeliveryDueDays();
  const isDeliveryOverdue = deliveryDueDays !== null && deliveryDueDays < 0 && invoice.milestoneStatus !== 'FULLY_DELIVERED';

  const getMilestoneStatusConfig = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return { bg: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]', label: 'Awaiting Delivery', icon: Package };
      case 'PARTIALLY_DELIVERED': return { bg: 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]', label: 'Partially Delivered', icon: Truck };
      case 'FULLY_DELIVERED': return { bg: 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]', label: 'Fully Delivered', icon: CheckCircle };
      case 'EXPIRED': return { bg: 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]', label: 'Expired', icon: XCircle };
      case 'LINKED': return { bg: 'bg-gradient-to-r from-[#82A094] to-[#546A7A]', label: 'Linked', icon: Link2 };
      default: return { bg: 'bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]', label: 'Unknown', icon: Package };
    }
  };

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
  const milestoneStatusConfig = getMilestoneStatusConfig(invoice.milestoneStatus);
  const StatusIcon = statusConfig.icon;
  const MilestoneIcon = milestoneStatusConfig.icon;

  const termOptions: Record<string, string> = { ABG: 'ABG', PO: 'PO', DELIVERY: 'Delivery', FAR: 'FAR', PBG: 'PBG', FAR_PBG: 'FAR & PBG', INVOICE_SUBMISSION: 'Invoice Submission', OTHER: 'Other' };

  const tabs = [
    { key: 'details' as const, label: 'Details', icon: FileText },
    { key: 'payments' as const, label: 'Payments', icon: Receipt },
    { key: 'remarks' as const, label: 'Remarks', icon: MessageSquare },
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
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-2xl border border-[#AEBFC3]/20 transition-all">
        {/* Dynamic Background Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-gradient-to-br from-[#E17F70]/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#CE9F6B]/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <Link href="/finance/ar/milestones" className="group flex items-center gap-3 text-[#5D6E73] hover:text-[#546A7A] transition-all">
              <div className="p-2.5 rounded-xl bg-white shadow-lg border border-[#AEBFC3]/20 group-hover:bg-[#AEBFC3]/10 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg">Back to Milestones</span>
            </Link>
            
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={() => loadInvoice(params.id as string)} 
                className="p-3 rounded-2xl bg-[#AEBFC3]/10 text-[#5D6E73] hover:bg-[#AEBFC3]/20 transition-all hover:rotate-180 duration-500" 
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-[#6F8A9D]" />
              </button>
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold hover:shadow-xl hover:shadow-[#82A094]/30 transition-all hover:-translate-y-1"
              >
                <Plus className="w-5 h-5" /> Record Payment
              </button>
              <Link 
                href={`/finance/ar/milestones/${invoice.id}/edit`}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#546A7A] text-white font-bold hover:bg-[#435561] hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <Pencil className="w-5 h-5" /> Edit
              </Link>
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="p-3 rounded-2xl bg-[#E17F70]/10 text-[#9E3B47] hover:bg-[#E17F70]/20 transition-all disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div className="flex-1 space-y-8">
              {/* Main Identity */}
              <div className="flex items-center gap-5">
                <div className="p-3 sm:p-4 rounded-[1.5rem] bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] shadow-2xl shadow-[#E17F70]/30 flex-shrink-0 animate-scale-in">
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
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
              <div className="flex items-center gap-6 p-4 rounded-3xl bg-[#AEBFC3]/5 border border-[#AEBFC3]/10 w-fit">
                <div className="flex items-center gap-3 border-r border-[#AEBFC3]/20 pr-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white text-xl font-black shadow-lg">
                    {invoice.customerName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-bold text-[#546A7A] leading-tight">{invoice.customerName}</h2>
                    <p className="font-mono text-xs text-[#92A2A5] tracking-wider uppercase">{invoice.bpCode}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  {invoice.poNo && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white shadow-sm border border-[#AEBFC3]/20">
                      <div className="p-1 rounded-lg bg-[#CE9F6B]/10"><Tag className="w-3.5 h-3.5 text-[#CE9F6B]" /></div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[#92A2A5] leading-none mb-0.5">PO Number</p>
                        <p className="text-xs font-bold text-[#546A7A] leading-none">{invoice.poNo}</p>
                      </div>
                    </div>
                  )}
                  {invoice.region && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white shadow-sm border border-[#AEBFC3]/20">
                      <div className="p-1 rounded-lg bg-[#82A094]/10"><MapPin className="w-3.5 h-3.5 text-[#82A094]" /></div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[#92A2A5] leading-none mb-0.5">Region</p>
                        <p className="text-xs font-bold text-[#546A7A] leading-none">{invoice.region}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Timing */}
            <div className="flex flex-col items-start md:items-end gap-4 min-w-fit">
              <div className={`group relative px-8 py-4 rounded-[2rem] bg-gradient-to-br ${statusConfig.bg} shadow-2xl transition-all hover:scale-105 ${statusConfig.glow}`}>
                <div className="flex items-center gap-3">
                  <StatusIcon className="w-7 h-7 text-white" />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Invoice Status</p>
                    <p className="text-xl font-black text-white leading-none">{invoice.status}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl ${milestoneStatusConfig.bg} text-white shadow-lg`}>
                  <div className="flex items-center gap-2">
                    <MilestoneIcon className="w-4 h-4" />
                    <span className="text-sm font-bold tracking-wide uppercase">{milestoneStatusConfig.label}</span>
                  </div>
                </div>

                {deliveryDueDays !== null && invoice.milestoneStatus !== 'FULLY_DELIVERED' && (
                  <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white border-2 shadow-sm ${deliveryDueDays < 0 ? 'border-[#E17F70]/20 text-[#9E3B47]' : 'border-[#82A094]/20 text-[#4F6A64]'}`}>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Timer className="w-4 h-4" />
                      <span>{deliveryDueDays < 0 ? 'Delivery Overdue' : 'Due for Delivery'}</span>
                    </div>
                    <span className="text-lg font-black">{Math.abs(deliveryDueDays)}d</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary - Premium Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
            <p className="text-white/60 text-[10px] sm:text-xs mt-2">Invoice value</p>
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
              <span className="text-white/80 text-[10px] sm:text-xs">{Math.round(paymentProgress)}% collected</span>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className={`group relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ${
          balanceAmount <= 0 
            ? 'bg-gradient-to-br from-[#82A094] via-[#4F6A64] to-[#82A094]' 
            : isOverdue 
            ? 'bg-gradient-to-br from-[#E17F70] via-[#9E3B47] to-[#E17F70]'
            : 'bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#CE9F6B]'
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20"><Wallet className="w-5 h-5 text-white" /></div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Balance Due</span>
            </div>
            <p className="text-xl sm:text-3xl font-bold text-white">{formatARCurrency(Math.abs(balanceAmount))}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2 flex items-center gap-1">
              {balanceAmount <= 0 ? (
                <><BadgeCheck className="w-3 h-3" /> Fully Paid</>
              ) : isOverdue ? (
                <><AlertTriangle className="w-3 h-3" /> Overdue</>
              ) : (
                <><Clock className="w-3 h-3" /> Pending</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Collection Progress */}
      <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/20">
              <TrendingUp className="w-5 h-5 text-[#4F6A64]" />
            </div>
            <div>
              <h3 className="font-bold text-[#546A7A]">Collection Progress</h3>
              <p className="text-sm text-[#92A2A5]">Track payment status</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#546A7A]">{Math.round(paymentProgress)}%</p>
            <p className="text-xs text-[#92A2A5]">{formatARCurrency(totalReceived)} of {formatARCurrency(totalAmount)}</p>
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
              <div key={m} className={`w-1 h-3 rounded-full ${paymentProgress >= m ? 'bg-white/50' : 'bg-[#92A2A5]/30'}`} style={{ marginLeft: `${m - 1}%` }} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          {['Pending', 'In Progress', 'Almost There', 'Completed'].map((label, i) => (
            <div key={label} className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mb-1 ${paymentProgress >= (i * 33) ? 'bg-[#82A094]' : 'bg-[#AEBFC3]/40'}`} />
              <span className={`text-xs ${paymentProgress >= (i * 33) ? 'text-[#5D6E73]' : 'text-[#AEBFC3]'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-[#AEBFC3]/20 p-2 shadow-lg mb-6 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl font-medium transition-all flex-1 min-w-fit whitespace-nowrap justify-center ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg'
                : 'text-[#5D6E73] hover:bg-[#AEBFC3]/10'
            }`}>
            <tab.icon className="w-4 h-4" />
            <span className="text-sm sm:text-base">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 shadow-lg overflow-hidden">
        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Milestone Information */}
                <div>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-lg bg-[#E17F70]/10"><Hash className="w-5 h-5 text-[#E17F70]" /></div>
                    Milestone Information
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'SO Number', value: invoice.soNo || '-', icon: Hash },
                      { label: 'Created Date', value: formatARDate(invoice.invoiceDate), icon: Calendar },
                      { label: 'Due Date', value: formatARDate(invoice.dueDate), icon: Calendar, highlight: isOverdue },
                      { label: 'Payment Terms', value: invoice.actualPaymentTerms || '-', icon: CreditCard },
                      { label: 'Category', value: invoice.type || 'NB', icon: Tag },
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
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-lg bg-[#6F8A9D]/10"><Building className="w-5 h-5 text-[#6F8A9D]" /></div>
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
                      ...(invoice.mailToTSP && invoice.mailToTSP !== 'false' ? [{ label: 'Mail to TSP', value: invoice.mailToTSP }] : []),
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
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-lg bg-[#82A094]/10"><IndianRupee className="w-5 h-5 text-[#82A094]" /></div>
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
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-lg bg-[#CE9F6B]/10"><User className="w-5 h-5 text-[#CE9F6B]" /></div>
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

              {/* Milestone Terms Section */}
              <div className="mt-8 pt-8 border-t border-[#AEBFC3]/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B]/20 to-[#E17F70]/20"><Sparkles className="w-5 h-5 text-[#CE9F6B]" /></div>
                    <div>
                      <h3 className="font-bold text-[#546A7A]">Payment Terms & Aging</h3>
                      <p className="text-sm text-[#92A2A5]">Individual milestone tracking</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#E17F70]" /><span className="text-[#5D6E73]">Overdue</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#82A094]" /><span className="text-[#5D6E73]">On Track</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {(invoice.milestoneTerms as MilestonePaymentTerm[] || []).map((term, index) => {
                    const termDate = new Date(term.termDate);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const termAging = Math.floor((today.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isTermOverdue = termAging > 0 && invoice.milestoneStatus !== 'FULLY_DELIVERED';
                    return (
                      <div key={index} className={`relative p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] ${isTermOverdue ? 'bg-gradient-to-br from-[#E17F70]/5 to-[#9E3B47]/5 border-[#E17F70]/20' : 'bg-gradient-to-br from-[#82A094]/5 to-[#4F6A64]/5 border-[#82A094]/20'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-2 rounded-xl ${isTermOverdue ? 'bg-[#E17F70]/20' : 'bg-[#82A094]/20'}`}>
                            <Calendar className={`w-5 h-5 ${isTermOverdue ? 'text-[#E17F70]' : 'text-[#82A094]'}`} />
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${isTermOverdue ? 'bg-[#E17F70] text-white' : 'bg-[#82A094] text-white'}`}>
                            {isTermOverdue ? 'Overdue' : 'On Track'}
                          </span>
                        </div>
                        <h4 className="font-bold text-[#546A7A] mb-1">{term.termType === 'OTHER' ? term.customLabel : (termOptions[term.termType] || term.termType)}</h4>
                        {term.percentage !== undefined && term.percentage > 0 && <p className="text-xs text-[#976E44] font-bold mb-1">{term.percentage}% allocation</p>}
                        <p className="text-xs text-[#92A2A5] mb-4">Target: {formatARDate(term.termDate)}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-[#AEBFC3]/20">
                          <div>
                            <p className="text-[10px] text-[#92A2A5] uppercase font-bold">Current Aging</p>
                            <p className={`text-xl font-black ${isTermOverdue ? 'text-[#9E3B47]' : 'text-[#4F6A64]'}`}>
                              {termAging > 0 ? `${termAging} Days` : `${Math.abs(termAging)} Days Left`}
                            </p>
                          </div>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isTermOverdue ? 'bg-[#9E3B47]/10' : 'bg-[#4F6A64]/10'}`}>
                            {isTermOverdue ? <AlertTriangle className="w-5 h-5 text-[#9E3B47]" /> : <CheckCircle className="w-5 h-5 text-[#4F6A64]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!invoice.milestoneTerms || invoice.milestoneTerms.length === 0) && (
                    <div className="col-span-full text-center py-12 text-[#92A2A5]">
                      <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No payment terms defined</p>
                      <Link href={`/finance/ar/milestones/${encodeURIComponent(invoice.invoiceNumber)}/edit`} className="text-[#CE9F6B] text-sm font-semibold hover:underline mt-2 inline-block">
                        Add payment terms →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Delivery Summary Strip */}
                <div className="mt-8 pt-6 border-t border-[#AEBFC3]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-[#AEBFC3]/10 px-4 py-2 rounded-xl">
                      <span className="text-xs text-[#92A2A5] block">Expected Delivery</span>
                      <span className="font-bold text-[#546A7A]">{invoice.deliveryDueDate ? formatARDate(invoice.deliveryDueDate) : 'N/A'}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-xl ${isDeliveryOverdue ? 'bg-[#E17F70]/10' : 'bg-[#82A094]/10'}`}>
                      <span className="text-xs text-[#92A2A5] block">Delivery Status</span>
                      <span className={`font-bold ${isDeliveryOverdue ? 'text-[#9E3B47]' : 'text-[#4F6A64]'}`}>
                        {isDeliveryOverdue ? 'Overdue' : invoice.milestoneStatus?.replace(/_/g, ' ') || 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-[#92A2A5] block">Overall Aging</span>
                    <div className="flex items-center gap-2">
                      <Timer className={`w-4 h-4 ${daysOverdue > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`} />
                      <span className={`text-xl font-black ${daysOverdue > 0 ? 'text-[#9E3B47]' : 'text-[#4F6A64]'}`}>
                        {daysOverdue > 0 ? `${daysOverdue} Days Overdue` : `${Math.abs(daysOverdue)} Days Left`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A]">
                  <div className="p-2 rounded-lg bg-[#82A094]/10"><Receipt className="w-5 h-5 text-[#82A094]" /></div>
                  Payment History
                </h4>
                <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold hover:shadow-lg transition-all">
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
                      <div className="flex-1 flex flex-col sm:grid sm:grid-cols-5 gap-4 items-start sm:items-center">
                        <div className="w-full sm:w-auto">
                          <p className="text-[10px] sm:text-xs text-[#92A2A5] uppercase font-bold sm:normal-case sm:font-normal">Date</p>
                          <p className="font-medium text-[#546A7A] text-sm sm:text-base">{formatARDate(payment.paymentDate)}</p>
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
                  <div className="w-20 h-20 rounded-2xl bg-[#AEBFC3]/10 flex items-center justify-center mx-auto mb-4">
                    <Receipt className="w-10 h-10 text-[#AEBFC3]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#5D6E73] mb-2">No Payment Records</h3>
                  <p className="text-[#92A2A5] mb-6">Start tracking payments by adding your first record.</p>
                  <button onClick={() => setShowPaymentModal(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                    <Plus className="w-4 h-4" /> Add First Payment
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Remarks Tab */}
          {activeTab === 'remarks' && (
            <div>
              <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-6">
                <div className="p-2 rounded-lg bg-[#6F8A9D]/10"><MessageSquare className="w-5 h-5 text-[#6F8A9D]" /></div>
                Remarks & Follow-ups
              </h4>

              {/* Add New Remark Form */}
              <div className="mb-6 p-4 rounded-xl bg-[#AEBFC3]/10 border border-[#AEBFC3]/20">
                <div className="flex gap-3">
                  <textarea
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    placeholder="Add a remark or follow-up note..."
                    className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#6F8A9D] focus:outline-none resize-none h-20"
                  />
                  <button
                    onClick={handleAddRemark}
                    disabled={addingRemark || !newRemark.trim()}
                    className="px-6 py-3 h-fit rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
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
                      <div className="bg-white rounded-xl p-4 shadow-md border border-[#AEBFC3]/20 ml-4">
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
                          <div className="text-right">
                            <p className="text-xs text-[#92A2A5]">{new Date(remark.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <p className="text-xs text-[#CE9F6B] font-medium">{new Date(remark.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <p className="text-[#5D6E73] whitespace-pre-wrap">{remark.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#AEBFC3]/10 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-10 h-10 text-[#AEBFC3]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#5D6E73] mb-2">No Remarks Yet</h3>
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
                  <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/20">
                    <Clock className="w-5 h-5 text-[#546A7A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#546A7A]">Activity Log</h3>
                    <p className="text-sm text-[#92A2A5]">Complete audit trail of all activities</p>
                  </div>
                </div>
                <button 
                  onClick={() => invoice && loadActivityLog(invoice.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#6F8A9D] hover:bg-[#6F8A9D]/10 transition-colors"
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
                        case 'STATUS_CHANGED': return { icon: TrendingUp, color: 'from-[#E17F70] to-[#9E3B47]' };
                        case 'DELIVERY_UPDATED': return { icon: Truck, color: 'from-[#96AEC2] to-[#6F8A9D]' };
                        case 'REMARK_ADDED': return { icon: MessageSquare, color: 'from-[#CE9F6B] to-[#976E44]' };
                        case 'INVOICE_IMPORTED': return { icon: Package, color: 'from-[#82A094] to-[#4F6A64]' };
                        default: return { icon: Clock, color: 'from-[#AEBFC3] to-[#92A2A5]' };
                      }
                    };
                    const actionConfig = getActionIcon(activity.action);
                    const ActionIcon = actionConfig.icon;

                    return (
                      <div key={activity.id || index} className="relative flex gap-4">
                        {index < activityLogs.length - 1 && (
                          <div className="absolute left-5 top-12 w-0.5 h-full bg-gradient-to-b from-[#AEBFC3]/50 to-transparent" />
                        )}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${actionConfig.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                          <ActionIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 bg-white rounded-xl p-4 shadow-md border border-[#AEBFC3]/20">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-[#546A7A]">{activity.description}</p>
                              {activity.fieldName && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs bg-[#6F8A9D]/10 text-[#6F8A9D] px-2 py-0.5 rounded">{activity.fieldName}</span>
                                  {activity.oldValue && (
                                    <span className="text-xs text-[#92A2A5]">{activity.oldValue} → {activity.newValue}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[#92A2A5]">{new Date(activity.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                              <p className="text-xs text-[#CE9F6B] font-medium">{new Date(activity.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[#92A2A5]">
                            <User className="w-3.5 h-3.5" />
                            <span>{activity.performedBy || 'System'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#AEBFC3]/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-10 h-10 text-[#AEBFC3]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#5D6E73] mb-2">No Activity Yet</h3>
                  <p className="text-[#92A2A5]">Activity will be recorded when changes are made.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>



      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl relative animate-scale-in">
            <button onClick={closePaymentModal} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-[#AEBFC3]/20 transition-colors">
              <X className="w-5 h-5 text-[#5D6E73]" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg">
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#546A7A]">{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</h3>
                <p className="text-sm text-[#92A2A5]">{editingPaymentId ? 'Update this' : 'Add a'} payment record for {invoice.invoiceNumber}</p>
              </div>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#5D6E73] mb-2">Amount (₹) <span className="text-[#E17F70]">*</span></label>
                <input type="number" step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full h-14 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none focus:ring-4 focus:ring-[#82A094]/20 transition-all font-mono text-xl" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#5D6E73] mb-2">Payment Date <span className="text-[#E17F70]">*</span></label>
                <input type="date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm({...paymentForm, paymentDate: e.target.value})} className="w-full h-12 px-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#5D6E73] mb-2">Reference Bank <span className="text-[#E17F70]">*</span></label>
                  <select value={paymentForm.referenceBank} onChange={e => setPaymentForm({...paymentForm, referenceBank: e.target.value})} className="w-full h-12 px-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all" required>
                    <option value="" disabled>Select Bank</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="DB">Deutsche Bank (DB)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#5D6E73] mb-2">Mode <span className="text-[#E17F70]">*</span></label>
                  <select value={paymentForm.paymentMode} onChange={e => setPaymentForm({...paymentForm, paymentMode: e.target.value})} className="w-full h-12 px-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all" required>
                    <option value="" disabled>Select Mode</option>
                    <option value="Receipt">Receipt</option>
                    <option value="TDS">TDS</option>
                    <option value="LD">LD</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#5D6E73] mb-2">Notes (Optional)</label>
                <textarea value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all resize-none h-20" placeholder="Add any notes..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closePaymentModal} className="flex-1 py-3.5 rounded-xl border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-semibold hover:bg-[#AEBFC3]/10 transition-all">Cancel</button>
                <button type="submit" disabled={paymentLoading} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold hover:shadow-lg hover:shadow-[#82A094]/40 transition-all flex items-center justify-center gap-2">
                  {paymentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  {editingPaymentId ? 'Update Payment' : 'Record Payment'}
                </button>
              </div>
            </form>
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
