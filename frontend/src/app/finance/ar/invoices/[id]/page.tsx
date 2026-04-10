'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, ARPaymentHistory, ARInvoiceActivityLog, MatchingMilestone, formatARCurrency, formatARDate, formatAmountForInput, parseFormattedAmount } from '@/lib/ar-api';
import { 
  ArrowLeft, Pencil, Trash2, FileText, Calendar, User, Clock, 
  AlertTriangle, CheckCircle, CheckCircle2, Loader2, Mail, Phone, MapPin, Building, 
  CreditCard, Hash, Receipt, Truck, MessageSquare, Shield, Copy, 
  RefreshCw, Plus, X, IndianRupee, Package, TrendingUp, XCircle, ArrowRight, PlusCircle,
  ChevronRight, ChevronLeft, Timer, Banknote, ArrowDownRight, ArrowUpRight, Sparkles,
  Wallet, CreditCard as CardIcon, BadgeCheck, Scale, Link2, Tag, PackageX, ExternalLink,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<ARInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'remarks' | 'activity'>('details');
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: '',
    referenceBank: '',
    notes: ''
  });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  
  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setEditingPaymentId(null);
    setPaymentForm({
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: '',
      referenceBank: '',
      notes: ''
    });
  };

  // Remarks state
  const [remarks, setRemarks] = useState<any[]>([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [addingRemark, setAddingRemark] = useState(false);
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingRemarkContent, setEditingRemarkContent] = useState('');

  // Activity log state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Milestone linking state
  const [matchingMilestones, setMatchingMilestones] = useState<MatchingMilestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<MatchingMilestone | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingMilestone, setLinkingMilestone] = useState(false);

  // Prev/Next Navigation
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);

  useEffect(() => {
    if (invoice?.invoiceNumber && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('ar_invoice_list');
      if (cached) {
        try {
          const list: string[] = JSON.parse(cached);
          const currentIndex = list.findIndex((id: string) => id === invoice.invoiceNumber);
          if (currentIndex !== -1) {
            setPrevId(currentIndex > 0 ? list[currentIndex - 1] : null);
            setNextId(currentIndex < list.length - 1 ? list[currentIndex + 1] : null);
          }
        } catch (e) {
          console.error("Failed to parse invoice list for navigation", e);
        }
      }
    }
  }, [invoice?.invoiceNumber]);

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id as string);
    }
  }, [params.id]);

  // Load remarks after invoice is loaded (using the actual UUID)
  useEffect(() => {
    if (invoice?.id) {
      loadRemarks(invoice.id);
    }
  }, [invoice?.id]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      // Pass type='REGULAR' to ensure we get the regular invoice when invoice numbers match milestone
      const data = await arApi.getInvoiceById(id, 'REGULAR');
      setInvoice(data);
    } catch (err) {
      console.error('Failed to load invoice:', err);
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const loadRemarks = async (id: string) => {
    try {
      setRemarksLoading(true);
      const data = await arApi.getInvoiceRemarks(id);
      setRemarks(data);
    } catch (err) {
      console.error('Failed to load remarks:', err);
    } finally {
      setRemarksLoading(false);
    }
  };

  const loadActivityLog = async (id: string) => {
    try {
      setActivityLoading(true);
      const data = await arApi.getInvoiceActivityLog(id);
      setActivityLogs(data);
    } catch (err) {
      console.error('Failed to load activity log:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  // Load activity log when tab changes to 'activity'
  useEffect(() => {
    if (invoice?.id && activeTab === 'activity' && activityLogs.length === 0) {
      loadActivityLog(invoice.id);
    }
  }, [activeTab, invoice?.id]);

  // Load matching milestones for regular invoices
  const loadMatchingMilestones = async (id: string) => {
    try {
      setMilestonesLoading(true);
      const data = await arApi.getMatchingMilestones(id);
      setMatchingMilestones(data.milestones);
    } catch (err) {
      console.error('Failed to load matching milestones:', err);
    } finally {
      setMilestonesLoading(false);
    }
  };

  // Auto-load matching milestones for non-milestone invoices
  // Note: Check !== 'MILESTONE' to include older imported invoices where invoiceType may be null
  // Note: Matching now primarily uses invoiceNumber for precision
  useEffect(() => {
    if (invoice?.id && invoice?.invoiceType !== 'MILESTONE' && invoice?.invoiceNumber) {
      loadMatchingMilestones(invoice.id);
    }
  }, [invoice?.id, invoice?.invoiceType, invoice?.invoiceNumber]);

  // Handle Escape key to close payment modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePaymentModal();
    };
    if (showPaymentModal) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPaymentModal]);

  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [transferOptions, setTransferOptions] = useState({
    payments: true,
    delivery: true,
    remarks: true,
    guarantees: true,
    tracking: true
  });

  // Handle linking milestone to invoice
  const handleLinkMilestone = async (milestone: MatchingMilestone) => {
    if (!invoice) return;
    
    try {
      setLinkingMilestone(true);
      setLinkingId(milestone.id);
      
      const result = await arApi.acceptMilestone(invoice.id, milestone.id, {
        transferPayments: transferOptions.payments,
        transferDelivery: transferOptions.delivery,
        transferRemarks: transferOptions.remarks,
        transferGuarantees: transferOptions.guarantees,
        transferTracking: transferOptions.tracking
      });
      
      let message = `Successfully linked milestone ${result.milestoneInvoiceNumber}!`;
      if (result.totalTransferred > 0) message += `\nTransferred: ${formatARCurrency(result.totalTransferred)} in payments.`;
      
      const transferredSections = [];
      if (transferOptions.delivery) transferredSections.push('Delivery');
      if (transferOptions.guarantees) transferredSections.push('Guarantees');
      if (transferOptions.remarks) transferredSections.push('Remarks');
      if (transferOptions.tracking) transferredSections.push('Payment Terms & Tracking');
      
      if (transferredSections.length > 0) {
        message += `\nTransferred: ${transferredSections.join(', ')}`;
      }
      
      toast.success(message, {
        duration: 5000,
        icon: <Zap className="w-5 h-5 text-[#CE9F6B]" />
      });
      
      // Reload invoice and clear milestones
      await loadInvoice(invoice.id);
      setMatchingMilestones([]);
      setShowLinkModal(false);
      setSelectedMilestone(null);
      setLinkingId(null);
    } catch (err: any) {
      console.error('Failed to link milestone:', err);
      toast.error(err.response?.data?.error || 'Failed to link milestone invoice');
      setLinkingId(null);
    } finally {
      setLinkingMilestone(false);
    }
  };


  const handleAddRemark = async () => {
    if (!invoice || !newRemark.trim()) return;
    
    try {
      setAddingRemark(true);
      await arApi.addInvoiceRemark(invoice.id, newRemark.trim());
      setNewRemark('');
      await loadRemarks(invoice.id);
    } catch (err) {
      console.error('Failed to add remark:', err);
      alert('Failed to add remark');
    } finally {
      setAddingRemark(false);
    }
  };

  const handleEditRemark = async (id: string) => {
    if (!invoice || !editingRemarkContent.trim()) return;
    try {
      await arApi.updateInvoiceRemark(invoice.id, id, editingRemarkContent.trim());
      setEditingRemarkId(null);
      await loadRemarks(invoice.id);
    } catch (err) {
      console.error('Failed to edit remark:', err);
      alert('Failed to edit remark');
    }
  };

  const handleDeleteRemark = async (id: string) => {
    if (!invoice || !confirm('Are you sure you want to delete this remark?')) return;
    try {
      setRemarksLoading(true);
      await arApi.deleteInvoiceRemark(invoice.id, id);
      await loadRemarks(invoice.id);
    } catch (err) {
      console.error('Failed to delete remark:', err);
      alert('Failed to delete remark');
      setRemarksLoading(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice || !cancelReason.trim()) return;
    
    try {
      setCancelling(true);
      await arApi.cancelInvoice(invoice.id, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      await loadInvoice(invoice.id); // Reload to show CANCELLED status
    } catch (err) {
      console.error('Failed to cancel invoice:', err);
      alert('Failed to cancel invoice');
    } finally {
      setCancelling(false);
    }
  };

  const handleRestoreInvoice = async () => {
    if (!invoice || !confirm('Are you sure you want to restore this invoice?')) return;
    
    try {
      setRestoring(true);
      await arApi.restoreInvoice(invoice.id);
      await loadInvoice(invoice.id);
    } catch (err) {
      console.error('Failed to restore invoice:', err);
      alert('Failed to restore invoice');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoice || !confirm('Are you sure you want to completely delete this invoice? This action cannot be undone.')) return;
    
    try {
      setDeleting(true);
      await arApi.deleteInvoice(invoice.id);
      router.back();
    } catch (err: any) {
      console.error('Failed to delete invoice:', err);
      alert(err.response?.data?.error || 'Failed to delete invoice');
      setDeleting(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    try {
      if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
        alert('Please enter a valid amount greater than zero');
        return;
      }
      setPaymentLoading(true);
      
      const paymentData = {
        amount: parseFloat(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMode: paymentForm.paymentMode,
        referenceBank: paymentForm.referenceBank,
        notes: paymentForm.notes
      };

      if (editingPaymentId) {
        await arApi.updatePayment(invoice.id, editingPaymentId, paymentData);
      } else {
        await arApi.addPayment(invoice.id, paymentData);
      }
      
      closePaymentModal();
      await loadInvoice(invoice.id);
    } catch (err) {
      console.error('Failed to record payment:', err);
      alert('Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleEditPayment = (payment: ARPaymentHistory) => {
    setEditingPaymentId(payment.id);
    setPaymentForm({
      amount: payment.amount.toString(),
      paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0],
      paymentMode: payment.paymentMode,
      referenceBank: payment.referenceBank || '',
      notes: payment.notes || ''
    });
    setShowPaymentModal(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!invoice || !confirm('Are you sure you want to delete this payment record? This will update the invoice balance.')) return;
    
    try {
      setPaymentLoading(true);
      await arApi.deletePayment(invoice.id, paymentId);
      await loadInvoice(invoice.id);
    } catch (err) {
      console.error('Failed to delete payment:', err);
      alert('Failed to delete payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/30" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#E17F70] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-[#CE9F6B] border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            <IndianRupee className="absolute inset-0 m-auto w-6 h-6 text-[#546A7A]" />
          </div>
          <p className="text-[#5D6E73] font-medium">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#E17F70]/20 via-[#CE9F6B]/10 to-[#976E44]/20 flex items-center justify-center mx-auto mb-6 shadow-xl">
            <FileText className="w-14 h-14 text-[#CE9F6B]" />
          </div>
          <h2 className="text-2xl font-bold text-[#546A7A] mb-3">Invoice Not Found</h2>
          <p className="text-[#92A2A5] mb-8">{error || "The invoice you're looking for doesn't exist or has been removed."}</p>
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  const totalAmount = Number(invoice.totalAmount || 0);
  const netAmount = Number(invoice.netAmount || 0);
  const taxAmount = Number(invoice.taxAmount || 0);
  const receipts = Number(invoice.receipts || 0);
  const adjustments = Number(invoice.adjustments || 0);
  const totalReceived = Number(invoice.totalReceipts || 0);
  const balanceAmount = Number(invoice.balance) || (totalAmount - totalReceived);
  const paymentProgress = totalAmount > 0 ? Math.min(100, (totalReceived / totalAmount) * 100) : 0;
  const daysOverdue = invoice.dueByDays || 0;
  const isOverdue = invoice.status === 'OVERDUE' || (daysOverdue > 0 && invoice.status !== 'PAID');
  const isPaid = invoice.status === 'PAID';
  // Milestone-specific computed values
  // On the Regular Invoice page, we ALWAYS hide milestone-specific tracking/UI
  const isMilestoneData = invoice.invoiceType === 'MILESTONE';
  const isMilestone = false; // Force regular UI on this page
  const showMilestoneTracking = false; 



  const termOptions: Record<string, string> = { ABG: 'ABG', PO: 'PO', DELIVERY: 'Delivery', FAR: 'FAR', PBG: 'PBG', FAR_PBG: 'FAR & PBG', INVOICE_SUBMISSION: 'Invoice Submission', PI: 'PI', OTHER: 'Other' };

  // Collection allocation per milestone term based on overall receipts
  const milestoneTermsArr: any[] = (invoice.milestoneTerms as any[]) || [];
  let remainingReceipts = totalReceived;
  const termCollections = milestoneTermsArr
    .slice()
    .sort((a, b: any) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime())
    .map((term: any) => {
      const percentage = term.percentage || 0;
      const isNetBasis = term.calculationBasis !== 'TOTAL_AMOUNT';
      const baseAmount = isNetBasis ? netAmount : totalAmount;
      const allocatedAmount = (baseAmount * percentage) / 100;
      const collectedForTerm = Math.min(allocatedAmount, Math.max(0, remainingReceipts));
      remainingReceipts -= collectedForTerm;
      const pendingForTerm = Math.max(0, allocatedAmount - collectedForTerm);
      const collectedPercent = allocatedAmount > 0 ? (collectedForTerm / allocatedAmount) * 100 : 0;
      return {
        termId: `${term.termType}-${term.termDate}-${percentage}`,
        allocatedAmount,
        collectedForTerm,
        pendingForTerm,
        collectedPercent,
        isNetBasis,
      };
    });

  // Overdue and Not Due calculations
  // On the Regular Invoice page, always use standard overdue logic based on balance and due date
  const overdueAmount = (isOverdue ? balanceAmount : 0);
  const notDueAmount = Math.max(0, balanceAmount - overdueAmount);
  const getMilestoneStatusConfig = (status?: string) => {
    switch(status) {
      case 'AWAITING_DELIVERY': return { bg: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]', text: 'text-white', label: 'Awaiting Delivery', icon: Package };
      case 'PARTIALLY_DELIVERED': return { bg: 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]', text: 'text-white', label: 'Partially Delivered', icon: Truck };
      case 'FULLY_DELIVERED': return { bg: 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]', text: 'text-white', label: 'Fully Delivered', icon: CheckCircle };
      case 'EXPIRED': return { bg: 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]', text: 'text-white', label: 'Expired', icon: XCircle };
      case 'LINKED': return { bg: 'bg-gradient-to-r from-[#82A094] to-[#546A7A]', text: 'text-white', label: 'Linked', icon: Link2 };
      default: return { bg: 'bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]', text: 'text-white', label: 'Unknown', icon: Package };
    }
  };
  const milestoneStatusConfig = isMilestone ? getMilestoneStatusConfig(invoice.milestoneStatus) : null;


  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'PAID': return { 
        bg: 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]', 
        text: 'text-white', 
        icon: CheckCircle,
        glow: 'shadow-[#82A094]/30'
      };
      case 'PARTIAL': return { 
        bg: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]', 
        text: 'text-white', 
        icon: TrendingUp,
        glow: 'shadow-[#CE9F6B]/30'
      };
      case 'OVERDUE': return { 
        bg: 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]', 
        text: 'text-white', 
        icon: AlertTriangle,
        glow: 'shadow-[#E17F70]/30'
      };
      case 'CANCELLED': return { 
        bg: 'bg-gradient-to-r from-[#92A2A5] to-[#5D6E73]', 
        text: 'text-white', 
        icon: XCircle,
        glow: 'shadow-[#92A2A5]/30'
      };
      default: return { 
        bg: 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]', 
        text: 'text-white', 
        icon: Clock,
        glow: 'shadow-[#6F8A9D]/30'
      };
    }
  };

  const getRiskConfig = (risk: string) => {
    switch(risk) {
      case 'LOW': return { bg: 'bg-[#82A094]', text: 'text-white', label: 'Low Risk' };
      case 'MEDIUM': return { bg: 'bg-[#CE9F6B]', text: 'text-white', label: 'Medium Risk' };
      case 'HIGH': return { bg: 'bg-[#E17F70]', text: 'text-white', label: 'High Risk' };
      case 'CRITICAL': return { bg: 'bg-[#9E3B47]', text: 'text-white', label: 'Critical' };
      default: return { bg: 'bg-[#AEBFC3]', text: 'text-white', label: risk };
    }
  };

  const statusConfig = getStatusConfig(invoice.status);
  const riskConfig = getRiskConfig(invoice.riskClass);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6 pb-10 relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-gradient-to-br from-[#E17F70]/10 to-[#9E3B47]/10 rounded-full blur-[8rem] opacity-50" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-[6rem] opacity-50" />
      </div>

      {/* Toast */}
      {copied && (
        <div className="fixed top-6 right-6 px-5 py-3 bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4" />
          Copied to clipboard!
        </div>
      )}

      {/* Premium Header Card */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white border-2 border-[#E17F70]/20 shadow-2xl">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#9E3B47]" />
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-64 h-64 bg-[#E17F70] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#CE9F6B] rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative p-8">
          {/* Top Row - Back & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-[#5D6E73] hover:text-[#546A7A] transition-colors group"
              >
                <div className="p-2.5 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/20 group-hover:bg-[#AEBFC3]/20 group-hover:border-[#AEBFC3]/40 transition-all group-hover:scale-105">
                  <ArrowLeft className="w-5 h-5" />
                </div>
                <span className="font-medium">Back to Invoices</span>
              </button>
              
              {/* Prev/Next Navigation */}
              <div className="flex items-center gap-2 ml-4 pl-4 border-l-2 border-[#AEBFC3]/20">
                <button
                  onClick={() => prevId && router.replace(`/finance/ar/invoices/${encodeURIComponent(prevId)}`)}
                  disabled={!prevId}
                  className={`p-2.5 rounded-xl border-2 transition-all group ${prevId ? 'bg-white border-[#AEBFC3]/30 text-[#546A7A] hover:border-[#6F8A9D] hover:shadow-md' : 'bg-[#AEBFC3]/5 border-transparent text-[#AEBFC3] cursor-not-allowed'}`}
                  title="Previous Invoice"
                >
                  <ChevronLeft className={`w-5 h-5 ${prevId ? 'group-hover:-translate-x-0.5 transition-transform' : ''}`} />
                </button>
                <button
                  onClick={() => nextId && router.replace(`/finance/ar/invoices/${encodeURIComponent(nextId)}`)}
                  disabled={!nextId}
                  className={`p-2.5 rounded-xl border-2 transition-all group ${nextId ? 'bg-white border-[#AEBFC3]/30 text-[#546A7A] hover:border-[#6F8A9D] hover:shadow-md' : 'bg-[#AEBFC3]/5 border-transparent text-[#AEBFC3] cursor-not-allowed'}`}
                  title="Next Invoice"
                >
                  <ChevronRight className={`w-5 h-5 ${nextId ? 'group-hover:translate-x-0.5 transition-transform' : ''}`} />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => loadInvoice(params.id as string)}
                className="p-2.5 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/20 text-[#5D6E73] hover:bg-[#AEBFC3]/20 hover:border-[#AEBFC3]/40 transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/40 hover:-translate-y-0.5 active:scale-95 transition-all text-sm sm:text-base"
              >
                <IndianRupee className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
              {invoice.status === 'CANCELLED' ? (
                <>
                  <button
                    onClick={handleRestoreInvoice}
                    disabled={restoring || deleting}
                    className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all text-sm sm:text-base disabled:opacity-50"
                  >
                    {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Restore Invoice
                  </button>
                  <button
                    onClick={handleDeleteInvoice}
                    disabled={restoring || deleting}
                    className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white font-bold shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all text-sm sm:text-base disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Invoice
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href={invoice.invoiceType === 'MILESTONE' 
                      ? `/finance/ar/milestones/${encodeURIComponent(invoice.invoiceNumber)}/edit`
                      : `/finance/ar/invoices/${encodeURIComponent(invoice.invoiceNumber)}/edit`
                    }
                    replace
                    className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white font-bold shadow-lg shadow-[#546A7A]/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all text-sm sm:text-base"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Link>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#92A2A5] to-[#5D6E73] text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all text-sm sm:text-base"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Invoice Identity */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="flex-1 w-full">
              {/* Invoice Number with Copy */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] shadow-lg shadow-[#E17F70]/20 flex-shrink-0 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-white/40 to-[#E17F70]" />
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-3xl font-bold text-[#546A7A] break-all">{invoice.invoiceNumber}</h1>
                    <button
                      onClick={() => copyToClipboard(invoice.invoiceNumber)}
                      className="p-1.5 rounded-lg hover:bg-[#AEBFC3]/20 transition-colors"
                      title="Copy invoice number"
                    >
                      <Copy className="w-4 h-4 text-[#92A2A5]" />
                    </button>
                  </div>
                  <p className="text-[#92A2A5] text-xs sm:text-sm mt-0.5">
                    {isMilestone ? 'Payment Tracking' : 'Invoice Details'} • Created on {formatARDate(invoice.invoiceDate)}
                  </p>
                </div>
              </div>
              
              {/* Customer & SO Info */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white text-base sm:text-lg font-bold shadow-lg flex-shrink-0">
                    {invoice.customerName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#546A7A] text-sm sm:text-base break-words leading-tight">{invoice.customerName}</p>
                    <p className="text-xs sm:text-sm text-[#92A2A5] font-mono mt-0.5">{invoice.bpCode}</p>
                  </div>
                </div>

                {isMilestone && invoice.soNo && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#CE9F6B]/10 border border-[#CE9F6B]/20">
                    <Package className="w-4 h-4 text-[#976E44]" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-[#976E44] leading-tight">SO Number</span>
                      <span className="text-xs sm:text-sm font-bold text-[#546A7A] leading-tight">{invoice.soNo}</span>
                    </div>
                  </div>
                )}
                
                {invoice.region && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#AEBFC3]/10 w-fit">
                    <MapPin className="w-4 h-4 text-[#6F8A9D]" />
                    <span className="text-xs sm:text-sm text-[#5D6E73]">{invoice.region}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Status & Risk Badges */}
            <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
              {/* Milestone Badge - Prominent */}
              {/* Milestone Badge - Hidden on Regular Invoice page */}



              
              <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl ${statusConfig.bg} ${statusConfig.text} shadow-lg ${statusConfig.glow}`}>
                <StatusIcon className="w-5 h-5" />
                <span className="font-bold text-lg">{invoice.status}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Global Status Configuration for Regular Invoice */}
                {!isMilestone && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${riskConfig.bg} ${riskConfig.text} text-sm font-semibold`}>
                    <Shield className="w-3.5 h-3.5" />
                    {riskConfig.label}
                  </div>
                )}


                
                {!isMilestone && (invoice.dueByDays ?? 0) !== 0 && invoice.status !== 'PAID' && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    (invoice.dueByDays ?? 0) > 0 
                      ? 'bg-[#E17F70]/10 text-[#9E3B47]' 
                      : 'bg-[#82A094]/10 text-[#4F6A64]'
                  }`}>
                    <Timer className="w-3.5 h-3.5" />
                    {(invoice.dueByDays ?? 0) > 0 ? `${invoice.dueByDays}d overdue` : `${Math.abs(invoice.dueByDays ?? 0)}d remaining`}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Smart Discovery: Matching Milestones - Prominent placement for reconciliation suggestions */}
      {!isMilestone && matchingMilestones.length > 0 && (() => {
        const linkedCount = matchingMilestones.filter(m => (m as any).linkedInvoiceId === invoice?.id).length;
        const hasNewPaymentsCount = matchingMilestones.filter(m => (m as any).untransferredPayments > 0).length;
        const totalNewPaymentsAmount = matchingMilestones.reduce((sum, m) => sum + ((m as any).untransferredAmount || 0), 0);
        
        return (
          <div className="relative group overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] p-6 shadow-2xl border border-white/10 mb-6 transition-all hover:scale-[1.005]">
            {/* Animated Background Pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-[#CE9F6B]/10 transition-colors duration-700" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#CE9F6B]/5 rounded-full blur-3xl -ml-24 -mb-24" />
            
            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20 flex-shrink-0">
                  <Sparkles className="w-8 h-8 text-[#CE9F6B] animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E17F70] border-2 border-[#546A7A] animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black tracking-widest text-[#CE9F6B] uppercase">Smart Match Detected</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[9px] font-bold">via Invoice No: {invoice?.invoiceNumber}</span>
                  </div>

                  <h3 className="text-xl font-bold text-white">
                    {linkedCount > 0 && linkedCount === matchingMilestones.length ? 'Sync Milestone Data?' : 'Import Milestone Payments?'}
                  </h3>
                  <p className="text-white/70 text-sm max-w-md">
                    {linkedCount > 0 && linkedCount === matchingMilestones.length 
                      ? `All matching milestones are linked. You can still sync delivery or remarks.`
                      : `We found ${matchingMilestones.length} milestone${matchingMilestones.length > 1 ? 's' : ''} with ${hasNewPaymentsCount > 0 ? (
                          <span className="text-[#CE9F6B] font-bold mx-1">{formatARCurrency(totalNewPaymentsAmount)}</span>
                        ) : ' available payments'} to import.`
                    }
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <div className="hidden sm:flex items-center gap-3 bg-black/10 rounded-2xl px-4 py-2 border border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-white/40 font-bold uppercase tracking-tighter">Source</span>
                    <span className="text-xs font-mono text-white/80">MILESTONE</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#CE9F6B]" />
                  <div className="flex flex-col">
                    <span className="text-[8px] text-white/40 font-bold uppercase tracking-tighter">Target</span>
                    <span className="text-xs font-mono text-white/80">INVOICE</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {matchingMilestones.length === 1 && (
                    <div className="flex items-center gap-2">
                       <Link
                        href={`/finance/ar/milestones/${encodeURIComponent(matchingMilestones[0].invoiceNumber)}`}
                        className="p-3 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                        title="View Milestone Details"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => handleLinkMilestone(matchingMilestones[0])}
                        disabled={linkingMilestone}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#546A7A] font-bold hover:shadow-2xl transition-all text-xs border-2 border-transparent hover:border-[#CE9F6B]"
                        title="Quick Sync everything in one click"
                      >
                        {linkingMilestone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-[#CE9F6B]" />}
                        Quick Sync All
                      </button>
                    </div>
                  )}
                  {matchingMilestones.length > 1 && (
                    <button
                      onClick={() => setShowLinkModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#CE9F6B] text-[#546A7A] font-black hover:bg-white hover:shadow-xl transition-all text-sm group/btn"
                    >
                      <PlusCircle className="w-4 h-4 group-hover/btn:rotate-90 transition-transform" />
                      {linkedCount > 0 ? 'Review & Sync Data' : 'Start Import'}
                    </button>
                  )}
                  {matchingMilestones.length === 1 && (
                    <button
                      onClick={() => setShowLinkModal(true)}
                      className="p-3 rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors text-xs font-bold"
                    >
                      Advanced
                    </button>
                  )}
                  <button
                    onClick={() => setMatchingMilestones([])}
                    className="p-3 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Financial Summary - Premium Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#546A7A] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-2 border-[#546A7A]/30">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#6F8A9D]" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Total Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(totalAmount)}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2">Invoice value</p>
          </div>
        </div>

        {/* Net Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6F8A9D] via-[#96AEC2] to-[#6F8A9D] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-2 border-[#6F8A9D]/30">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#AEBFC3] via-white/40 to-[#96AEC2]" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Net Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(netAmount)}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2">Before tax</p>
          </div>
        </div>

        {/* Tax Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#CE9F6B] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-2 border-[#CE9F6B]/30">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-white/40 to-[#CE9F6B]" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-xs sm:text-sm font-medium">Tax Amount</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatARCurrency(taxAmount)}</p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2">GST/VAT applied</p>
          </div>
        </div>

        {/* Receipts */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#82A094] via-[#4F6A64] to-[#82A094] p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-2 border-[#82A094]/30">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#4F6A64]" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <ArrowDownRight className="w-5 h-5 text-white" />
              </div>
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
        <div className={`group relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-2 ${
          overdueAmount > 0 
            ? 'bg-gradient-to-br from-[#E17F70] via-[#9E3B47] to-[#E17F70] border-[#E17F70]/30'
            : 'bg-gradient-to-br from-[#82A094]/40 to-[#4F6A64]/40 border-[#82A094]/20'
        }`}>
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-white/40 to-[#9E3B47]" />
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
        <div className={`group relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-2 ${
          notDueAmount > 0 
            ? 'bg-gradient-to-br from-[#6F8A9D] via-[#546A7A] to-[#6F8A9D] border-[#6F8A9D]/30'
            : 'bg-gradient-to-br from-[#AEBFC3]/40 to-[#92A2A5]/40 border-[#AEBFC3]/20'
        }`}>
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#AEBFC3] via-white/40 to-[#546A7A]" />
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

      {/* Milestone Payments & Aging Timeline */}
      {/* Milestone Payments & Aging Timeline - Hidden on Regular Invoice page */}




      {/* Collection Progress */}
      <div className="relative bg-white rounded-[2rem] border-2 border-[#82A094]/30 p-6 shadow-lg overflow-hidden">
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
          
          {/* Milestone markers */}
          <div className="absolute inset-0 flex items-center justify-between px-1">
            {[25, 50, 75].map((milestone) => (
              <div 
                key={milestone}
                className={`w-1 h-3 rounded-full ${paymentProgress >= milestone ? 'bg-white/50' : 'bg-[#92A2A5]/30'}`}
                style={{ marginLeft: `${milestone - 1}%` }}
              />
            ))}
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center justify-between mt-4">
          {['Pending', 'In Progress', 'Almost There', 'Completed'].map((label, i) => (
            <div key={label} className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mb-1 ${paymentProgress >= (i * 33) ? 'bg-[#82A094]' : 'bg-[#AEBFC3]/40'}`} />
              <span className={`text-xs ${paymentProgress >= (i * 33) ? 'text-[#5D6E73]' : 'text-[#AEBFC3]'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>



      {/* Link Milestone Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#AEBFC3]/20 bg-gradient-to-r from-[#CE9F6B]/10 to-[#E17F70]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#E17F70]">
                    <Link2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#546A7A]">Link Milestone Payment</h2>
                    <p className="text-sm text-[#92A2A5]">Transfer payments from milestone to this invoice</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowLinkModal(false); setSelectedMilestone(null); }}
                  className="p-2 rounded-xl hover:bg-[#AEBFC3]/20 transition-colors"
                >
                  <X className="w-6 h-6 text-[#5D6E73]" />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {matchingMilestones.map((milestone) => (
                  <div 
                    key={milestone.id}
                    onClick={() => {
                      setSelectedMilestone(milestone);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      selectedMilestone?.id === milestone.id 
                        ? 'border-[#CE9F6B] bg-[#CE9F6B]/5 shadow-lg' 
                        : (milestone as any).linkedInvoiceId === invoice?.id 
                          ? 'border-[#82A094]/30 bg-[#82A094]/5'
                          : 'border-[#AEBFC3]/20 hover:border-[#AEBFC3]/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          (milestone as any).linkedInvoiceId === invoice?.id && (milestone as any).untransferredPayments === 0
                            ? 'border-[#82A094] bg-[#82A094]'
                            : selectedMilestone?.id === milestone.id 
                              ? 'border-[#CE9F6B] bg-[#CE9F6B]' 
                              : 'border-[#AEBFC3]'
                        }`}>
                          {(((milestone as any).linkedInvoiceId === invoice?.id && (milestone as any).untransferredPayments === 0) || selectedMilestone?.id === milestone.id) && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-[#546A7A]">{milestone.invoiceNumber}</p>
                              <Link 
                                href={`/finance/ar/milestones/${encodeURIComponent(milestone.invoiceNumber)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded-lg hover:bg-[#AEBFC3]/20 text-[#6F8A9D] transition-all"
                                title="View details"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                            {(milestone as any).linkedInvoiceId === invoice?.id && (milestone as any).untransferredPayments === 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#82A094] text-white text-[10px] font-bold uppercase">
                                Fully Transferred ✓
                              </span>
                            )}
                            {(milestone as any).linkedInvoiceId === invoice?.id && (milestone as any).untransferredPayments > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#CE9F6B] text-white text-[10px] font-bold uppercase animate-pulse">
                                {(milestone as any).untransferredPayments} New
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#92A2A5]">{milestone.customerName}</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right pl-8 sm:pl-0">
                        <p className="text-lg sm:text-xl font-bold text-[#82A094]">{formatARCurrency(milestone.totalPayments)}</p>
                        <p className="text-[10px] sm:text-xs text-[#92A2A5] uppercase font-semibold">
                          {(milestone as any).linkedInvoiceId === invoice?.id ? 'Transferred' : milestone.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedMilestone && (
                <div className="mt-8 p-6 rounded-2xl bg-[#AEBFC3]/5 border-2 border-[#AEBFC3]/20">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-[#546A7A] mb-4 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-[#CE9F6B]" />
                    Select Data to Transfer
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'payments', label: 'Payment History', desc: 'Transfer all collected receipts', icon: IndianRupee },
                      { id: 'delivery', label: 'Delivery Tracking', desc: 'Status, mode and handover dates', icon: Truck },
                      { id: 'remarks', label: 'Comments & Remarks', desc: 'All history of remarks', icon: MessageSquare },
                      { id: 'guarantees', label: 'Bank Guarantees', desc: 'APG/PBG tracking steps', icon: Shield },
                      { id: 'tracking', label: 'Tracking Information', desc: 'PIC, Region, Dept, etc.', icon: User },
                    ].map((opt) => (
                      <label 
                        key={opt.id} 
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          (transferOptions as any)[opt.id] 
                            ? 'bg-white border-[#82A094]/30 shadow-sm' 
                            : 'border-transparent bg-[#AEBFC3]/10 opacity-70 grayscale'
                        }`}
                      >
                        <div className="pt-0.5">
                          <input 
                            type="checkbox" 
                            checked={(transferOptions as any)[opt.id]}
                            onChange={(e) => setTransferOptions(prev => ({ ...prev, [opt.id]: e.target.checked }))}
                            className="w-4 h-4 rounded text-[#82A094] border-[#AEBFC3] focus:ring-[#82A094]"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <opt.icon className={`w-3.5 h-3.5 ${ (transferOptions as any)[opt.id] ? 'text-[#82A094]' : 'text-[#92A2A5]' }`} />
                            <span className="text-sm font-bold text-[#546A7A]">{opt.label}</span>
                          </div>
                          <p className="text-[10px] text-[#92A2A5] leading-tight">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-[#AEBFC3]/20 bg-[#AEBFC3]/5">
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  {selectedMilestone && (
                    <div className="flex items-center gap-2 text-[#5D6E73]">
                      <div className="w-2 h-2 rounded-full bg-[#82A094] animate-pulse" />
                      <p className="text-xs sm:text-sm">
                        Transferring <span className="font-bold text-[#82A094]">{formatARCurrency(selectedMilestone.totalPayments)}</span> and selected details
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => { setShowLinkModal(false); setSelectedMilestone(null); }}
                    className="px-5 py-2.5 rounded-xl border border-[#AEBFC3]/30 text-[#5D6E73] font-semibold hover:bg-[#AEBFC3]/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => selectedMilestone && handleLinkMilestone(selectedMilestone)}
                    disabled={!selectedMilestone || linkingMilestone}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {linkingMilestone ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4" />
                        Complete Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 bg-white rounded-[2rem] border-2 border-[#AEBFC3]/30 p-2 shadow-lg mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: 'details', label: 'Details', icon: FileText },
          { id: 'payments', label: 'Payments', icon: Receipt, count: invoice.paymentHistory?.length || 0 },
          { id: 'remarks', label: 'Remarks', icon: MessageSquare, count: remarks.length },
          { id: 'activity', label: 'Activity', icon: Clock, count: activityLogs.length },
        ].map((tab) => (

          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl font-medium transition-all flex-1 min-w-fit whitespace-nowrap justify-center ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg'
                : 'text-[#5D6E73] hover:bg-[#AEBFC3]/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="text-sm sm:text-base">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-[#6F8A9D]/10 text-[#6F8A9D]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="relative bg-white rounded-[2rem] border-2 border-[#AEBFC3]/30 shadow-lg overflow-hidden">
        {activeTab === 'details' && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Invoice Information */}
              <div className="space-y-6">
                <div>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] shadow-lg shadow-[#E17F70]/20">
                      <Hash className="w-5 h-5 text-white" />
                    </div>
                    Invoice Information
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Invoice Date', value: formatARDate(invoice.invoiceDate), icon: Calendar },
                      { label: 'Due Date', value: formatARDate(invoice.dueDate), icon: Calendar, highlight: isOverdue },
                      { label: 'PO Number', value: invoice.poNo || '-', icon: Hash },
                      { label: 'Payment Terms', value: invoice.actualPaymentTerms || '-', icon: CreditCard },
                      { label: 'Type', value: invoice.type || '-', icon: Tag },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#AEBFC3]/10 transition-colors">
                        <item.icon className={`w-4 h-4 ${item.highlight ? 'text-[#E17F70]' : 'text-[#6F8A9D]'}`} />
                        <span className="text-[#92A2A5] text-sm w-28">{item.label}</span>
                        <span className={`font-medium ${item.highlight ? 'text-[#9E3B47]' : 'text-[#546A7A]'}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Milestones (if any) */}
                {matchingMilestones.some(m => (m as any).linkedInvoiceId === invoice.id) && (
                  <div>
                    <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-[#82A094] to-[#546A7A] shadow-lg shadow-[#82A094]/20">
                        <Link2 className="w-5 h-5 text-white" />
                      </div>
                      Linked Milestones
                    </h4>
                    <div className="space-y-3">
                      {matchingMilestones.filter(m => (m as any).linkedInvoiceId === invoice.id).map((milestone) => (
                        <div key={milestone.id} className="flex items-center justify-between p-3 rounded-xl bg-[#82A094]/5 border border-[#82A094]/20 hover:border-[#82A094]/40 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-white shadow-sm">
                              <Package className="w-4 h-4 text-[#82A094]" />
                            </div>
                            <div>
                              <p className="font-bold text-[#546A7A] text-sm">{milestone.invoiceNumber}</p>
                              <p className="text-[10px] text-[#92A2A5] font-medium">SO Number: {milestone.soNo || 'N/A'}</p>
                            </div>
                          </div>
                          <Link 
                            href={`/finance/ar/milestones/${encodeURIComponent(milestone.invoiceNumber)}`}
                            className="p-2 rounded-lg bg-white border border-[#AEBFC3]/30 text-[#6F8A9D] hover:bg-[#6F8A9D]/10 hover:border-[#6F8A9D]/30 hover:text-[#546A7A] transition-all shadow-sm"
                            title="View Milestone Details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Financial Breakdown */}
                <div>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20">
                      <IndianRupee className="w-5 h-5 text-white" />
                    </div>
                    Financial Breakdown
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#6F8A9D]/10">
                      <span className="text-[#546A7A] font-bold text-sm">Total Amount</span>
                      <span className="font-bold text-[#546A7A]">
                        {formatARCurrency(totalAmount)}
                      </span>
                    </div>

                    {/* Detailed Payments mapping */}
                    {invoice.paymentHistory && invoice.paymentHistory.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        <p className="text-[10px] uppercase tracking-wider text-[#92A2A5] font-bold ml-1">Payment Details</p>
                        {invoice.paymentHistory.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#AEBFC3]/10 transition-colors group">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                payment.paymentMode === 'TDS' ? 'bg-[#CE9F6B]' : 
                                payment.paymentMode === 'LD' ? 'bg-[#E17F70]' : 
                                'bg-[#82A094]'
                              }`} />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#546A7A] text-xs font-bold">{payment.paymentMode}</span>
                                  {payment.referenceBank && (
                                    <span className="text-[9px] font-extrabold text-[#6F8A9D] bg-[#6F8A9D]/10 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                                      @{payment.referenceBank}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[#92A2A5] text-[10px]">{formatARDate(payment.paymentDate)}</span>
                              </div>
                            </div>
                            <span className="font-bold text-[#546A7A] text-sm">
                              {formatARCurrency(payment.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#AEBFC3]/5 mb-4">
                        <span className="text-[#5D6E73] text-sm italic">No payments recorded</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#82A094]/10">
                      <span className="text-[#4F6A64] font-bold text-sm">Total Received</span>
                      <span className="font-bold text-[#4F6A64]">
                        {formatARCurrency(totalReceived)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#AEBFC3]/5">
                      <span className="text-[#5D6E73] text-sm">Balance</span>
                      <span className={`font-bold ${balanceAmount > 0 ? 'text-[#E17F70]' : 'text-[#546A7A]'}`}>
                        {formatARCurrency(balanceAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Customer & Contact */}
              <div className="space-y-6">
                <div>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20">
                      <Building className="w-5 h-5 text-white" />
                    </div>
                    Customer Details
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Company', value: invoice.customerName },
                      { label: 'BP Code', value: invoice.bpCode, mono: true },
                      { label: 'Region', value: invoice.region || '-' },
                      { label: 'Department', value: invoice.department || '-' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#AEBFC3]/10 transition-colors">
                        <span className="text-[#92A2A5] text-sm w-24">{item.label}</span>
                        <span className={`font-medium text-[#546A7A] ${item.mono ? 'font-mono text-[#E17F70]' : ''}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    Contact & Handling
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Kardex In-Charge', value: invoice.personInCharge || '-', icon: User },
                      { label: 'Customer Email', value: invoice.emailId || '-', icon: Mail, copyable: true },
                      { label: 'Customer Phone', value: invoice.contactNo || '-', icon: Phone, copyable: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#AEBFC3]/10 transition-colors group">
                        <item.icon className="w-4 h-4 text-[#CE9F6B]" />
                        <span className="text-[#92A2A5] text-xs w-28">{item.label}</span>
                        <span className="font-medium text-[#546A7A] flex-1">{item.value}</span>
                        {item.copyable && item.value !== '-' && (
                          <button
                            onClick={() => copyToClipboard(item.value)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#AEBFC3]/20 transition-all"
                          >
                            <Copy className="w-3.5 h-3.5 text-[#92A2A5]" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Milestone Payment Schedule - Hidden on Regular Invoice page */}




            {/* Delivery Tracking */}
            <div className="relative mt-8 p-6 rounded-2xl bg-gradient-to-r from-[#6F8A9D]/5 to-[#AEBFC3]/5 border-2 border-[#6F8A9D]/20 shadow-inner overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#AEBFC3]" />
              <div className="flex items-center gap-2 mb-6">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-[#546A7A] text-lg">Delivery Tracking</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white border border-[#AEBFC3]/20">
                  <span className="text-[#92A2A5] text-[10px] font-black uppercase tracking-widest">Delivery Status</span>
                  <div className="flex items-center gap-2">
                    {invoice.deliveryStatus === 'DELIVERED' ? (
                      <>
                        <div className="p-1 rounded-full bg-[#82A094]/20">
                          <CheckCircle2 className="w-4 h-4 text-[#82A094]" />
                        </div>
                        <span className="font-bold text-[#82A094]">Yes (Delivered)</span>
                      </>
                    ) : (
                      <>
                        <div className="p-1 rounded-full bg-[#E17F70]/20">
                          <Timer className="w-4 h-4 text-[#E17F70]" />
                        </div>
                        <span className="font-bold text-[#E17F70]">No (Pending)</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white border border-[#AEBFC3]/20">
                  <span className="text-[#92A2A5] text-[10px] font-black uppercase tracking-widest">Delivery details</span>
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-full bg-[#6F8A9D]/20">
                      <Package className="w-4 h-4 text-[#6F8A9D]" />
                    </div>
                    <span className="font-bold text-[#546A7A]">{invoice.modeOfDelivery || '-'}</span>
                  </div>
                  <span className="text-[10px] text-[#92A2A5] italic">all types support</span>
                </div>

                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white border border-[#AEBFC3]/20">
                  <span className="text-[#92A2A5] text-[10px] font-black uppercase tracking-widest">Handover date</span>
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-full bg-[#CE9F6B]/20">
                      <Calendar className="w-4 h-4 text-[#CE9F6B]" />
                    </div>
                    <span className="font-bold text-[#546A7A]">{invoice.sentHandoverDate ? formatARDate(invoice.sentHandoverDate) : '-'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white border border-[#AEBFC3]/20">
                  <span className="text-[#92A2A5] text-[10px] font-black uppercase tracking-widest">GRN / Delivered date</span>
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-full bg-[#82A094]/20">
                      <BadgeCheck className="w-4 h-4 text-[#82A094]" />
                    </div>
                    <span className="font-bold text-[#546A7A]">{invoice.impactDate ? formatARDate(invoice.impactDate) : '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guarantees Tracking */}
            {(invoice.hasAPG || invoice.hasPBG) && (
              <div className="relative mt-8 p-6 rounded-2xl bg-gradient-to-r from-[#546A7A]/5 to-[#6F8A9D]/5 border-2 border-[#546A7A]/20 shadow-inner overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]" />
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-[#546A7A] text-lg">Guarantees Tracking</span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {invoice.hasAPG && (
                    <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#AEBFC3]/30 shadow-sm transition-all hover:shadow-md">
                      <h4 className="font-bold text-[#E17F70] flex items-center gap-2 text-base pb-3 border-b border-[#AEBFC3]/20">
                        <Tag className="w-4 h-4" /> ABG Advance Bank Guarantee
                      </h4>
                      <div className="space-y-6 pt-2">
                        {/* Draft */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-[#CE9F6B] mt-1.5" />
                            <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[40px]" />
                          </div>
                          <div className="flex-1 pb-4">
                            <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1">Draft ABG</span>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-[#5D6E73] text-sm">{invoice.apgDraftDate ? formatARDate(invoice.apgDraftDate) : '-'}</span>
                              <span className="text-xs text-[#92A2A5] italic">{invoice.apgDraftNote || ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* APG Draft Steps */}
                        {Array.isArray(invoice.apgDraftSteps) && invoice.apgDraftSteps.map((step: any, idx: number) => (
                          <div key={`apg-draft-${idx}`} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded-full bg-[#CE9F6B]/60 mt-1.5 shadow-sm" />
                              <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[40px]" />
                            </div>
                            <div className="flex-1 pb-4">
                              <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1">Draft Step {idx + 1}</span>
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-[#5D6E73] text-sm">{step.date ? formatARDate(step.date) : '-'}</span>
                                <span className="text-xs text-[#92A2A5] italic">{step.note || ''}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* APG Signed Steps */}
                        {Array.isArray(invoice.apgSignedSteps) && invoice.apgSignedSteps.map((step: any, idx: number) => (
                          <div key={`apg-signed-${idx}`} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded-full bg-[#82A094]/60 mt-1.5 shadow-sm" />
                              <div className="w-0.5 h-full bg-[#82A094]/20 min-h-[40px]" />
                            </div>
                            <div className="flex-1 pb-4">
                              <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1">Signed Step {idx + 1}</span>
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-[#5D6E73] text-sm">{step.date ? formatARDate(step.date) : '-'}</span>
                                <span className="text-xs text-[#92A2A5] italic">{step.note || ''}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Signed */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-[#82A094] mt-1.5 border-2 border-white ring-2 ring-[#82A094]/20 shadow-sm" />
                          </div>
                          <div className="flex-1">
                            <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1 font-bold">Signed ABG</span>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-[#5D6E73] text-sm">{invoice.apgSignedDate ? formatARDate(invoice.apgSignedDate) : '-'}</span>
                              <span className="text-xs text-[#92A2A5] italic">{invoice.apgSignedNote || ''}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {invoice.hasPBG && (
                    <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#AEBFC3]/30 shadow-sm transition-all hover:shadow-md">
                      <h4 className="font-bold text-[#CE9F6B] flex items-center gap-2 text-base pb-3 border-b border-[#AEBFC3]/20">
                        <Tag className="w-4 h-4" /> Performance Bank Guarantee (PBG)
                      </h4>
                      <div className="space-y-6 pt-2">
                        {/* Draft */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-[#CE9F6B] mt-1.5" />
                            <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[40px]" />
                          </div>
                          <div className="flex-1 pb-4">
                            <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1">Draft PBG</span>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-[#5D6E73] text-sm">{invoice.pbgDraftDate ? formatARDate(invoice.pbgDraftDate) : '-'}</span>
                              <span className="text-xs text-[#92A2A5] italic">{invoice.pbgDraftNote || ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* PBG Draft Steps */}
                        {Array.isArray(invoice.pbgDraftSteps) && invoice.pbgDraftSteps.map((step: any, idx: number) => (
                          <div key={`pbg-draft-${idx}`} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded-full bg-[#CE9F6B]/60 mt-1.5 shadow-sm" />
                              <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[40px]" />
                            </div>
                            <div className="flex-1 pb-4">
                              <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1">Draft Step {idx + 1}</span>
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-[#5D6E73] text-sm">{step.date ? formatARDate(step.date) : '-'}</span>
                                <span className="text-xs text-[#92A2A5] italic">{step.note || ''}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* PBG Signed Steps */}
                        {Array.isArray(invoice.pbgSignedSteps) && invoice.pbgSignedSteps.map((step: any, idx: number) => (
                          <div key={`pbg-signed-${idx}`} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded-full bg-[#82A094]/60 mt-1.5 shadow-sm" />
                              <div className="w-0.5 h-full bg-[#82A094]/20 min-h-[40px]" />
                            </div>
                            <div className="flex-1 pb-4">
                              <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1">Signed Step {idx + 1}</span>
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-[#5D6E73] text-sm">{step.date ? formatARDate(step.date) : '-'}</span>
                                <span className="text-xs text-[#92A2A5] italic">{step.note || ''}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Signed */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-[#82A094] mt-1.5 border-2 border-white ring-2 ring-[#82A094]/20 shadow-sm" />
                          </div>
                          <div className="flex-1">
                            <span className="block text-[#92A2A5] text-[10px] font-black uppercase tracking-widest mb-1 font-bold">Signed PBG</span>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-[#5D6E73] text-sm">{invoice.pbgSignedDate ? formatARDate(invoice.pbgSignedDate) : '-'}</span>
                              <span className="text-xs text-[#92A2A5] italic">{invoice.pbgSignedNote || ''}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            {invoice.comments && (
              <div className="relative mt-8 p-6 rounded-2xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/20 shadow-inner overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]"><MessageSquare className="w-4 h-4 text-white" /></div>
                  <span className="font-bold text-[#546A7A]">Comments & Internal Notes</span>
                </div>
                <p className="text-[#5D6E73] whitespace-pre-wrap text-sm leading-relaxed">{invoice.comments}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A]">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                Payment History
              </h4>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/40 hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Payment
              </button>
            </div>
            
            {invoice.paymentHistory && invoice.paymentHistory.length > 0 ? (
              <div className="space-y-3">
                {invoice.paymentHistory.map((payment, index) => (
                  <div 
                    key={payment.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-[#AEBFC3]/5 hover:bg-[#82A094]/5 transition-colors border border-transparent hover:border-[#82A094]/20"
                  >
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
                        <button
                          onClick={() => handleEditPayment(payment)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-0 px-4 sm:px-2 py-2 rounded-lg bg-[#6F8A9D]/10 text-[#6F8A9D] hover:bg-[#6F8A9D]/20 transition-all font-semibold sm:font-normal text-xs sm:text-base"
                          title="Edit payment"
                        >
                          <Pencil className="w-4 h-4" />
                          <span className="sm:hidden">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-0 px-4 sm:px-2 py-2 rounded-lg bg-[#E17F70]/10 text-[#9E3B47] hover:bg-[#E17F70]/20 transition-all font-semibold sm:font-normal text-xs sm:text-base"
                          title="Delete payment"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sm:hidden">Delete</span>
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
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add First Payment
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'remarks' && (
          <div className="p-6">
            <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              Remarks & Follow-ups
            </h4>
            
            {/* Add New Remark Form */}
            <div className="relative mb-6 p-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/20 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]" />
              <div className="flex gap-3">
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Add a remark or follow-up note..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#6F8A9D] focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/10 resize-none h-20 transition-all"
                />
                <button
                  onClick={handleAddRemark}
                  disabled={addingRemark || !newRemark.trim()}
                  className="px-6 py-3 h-fit rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-bold shadow-lg shadow-[#6F8A9D]/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {addingRemark ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>
            </div>
            
            {/* Remarks Timeline */}
            {remarksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#6F8A9D]" />
              </div>
            ) : remarks.length > 0 ? (
              <div className="space-y-4">
                {remarks.map((remark, index) => (
                  <div 
                    key={remark.id}
                    className="relative pl-8 pb-4 border-l-2 border-[#AEBFC3]/30 last:border-l-transparent"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] border-2 border-white shadow" />
                    
                    {/* Remark card */}
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
                            <p className="text-xs text-[#92A2A5]">
                              {new Date(remark.createdAt).toLocaleDateString('en-IN', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </p>
                            <p className="text-xs text-[#CE9F6B] font-medium">
                              {new Date(remark.createdAt).toLocaleTimeString('en-IN', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
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
                <div className="w-20 h-20 rounded-2xl bg-[#AEBFC3]/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-10 h-10 text-[#AEBFC3]" />
                </div>
                <h3 className="text-lg font-semibold text-[#5D6E73] mb-2">No Remarks Yet</h3>
                <p className="text-[#92A2A5] mb-2">Add your first remark or follow-up note above.</p>
              </div>
            )}
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-[#546A7A]">Activity Log</h3>
                  <p className="text-sm text-[#92A2A5]">Complete audit trail of all invoice activities</p>
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
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-[#6F8A9D] animate-spin" />
              </div>
            ) : activityLogs.length > 0 ? (
              <div className="space-y-4">
                {activityLogs.map((activity, index) => {
                  const getActionIcon = (action: string) => {
                    switch (action) {
                      case 'INVOICE_CREATED': return { icon: Plus, color: 'from-[#82A094] to-[#4F6A64]' };
                      case 'INVOICE_UPDATED': return { icon: Pencil, color: 'from-[#6F8A9D] to-[#546A7A]' };
                      case 'PAYMENT_RECORDED': return { icon: CreditCard, color: 'from-[#CE9F6B] to-[#976E44]' };
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
                    <div key={activity.id} className="relative flex gap-4 group/timeline">
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
                <div className="w-20 h-20 rounded-2xl bg-[#AEBFC3]/10 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-[#AEBFC3]" />
                </div>
                <h3 className="text-lg font-semibold text-[#5D6E73] mb-2">No Activity Yet</h3>
                <p className="text-[#92A2A5]">Activity will be recorded when changes are made to this invoice.</p>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closePaymentModal(); }}>
          <div className="relative bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl animate-scale-in overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
            <button 
              onClick={closePaymentModal}
              className="absolute top-4 right-4 p-2 rounded-xl border-2 border-[#AEBFC3]/20 hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/40 transition-all"
            >
              <X className="w-5 h-5 text-[#5D6E73]" />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#4F6A64]" />
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#546A7A]">{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</h3>
                <p className="text-sm text-[#92A2A5]">{editingPaymentId ? 'Update this' : 'Add a'} payment record for {invoice.invoiceNumber}</p>
              </div>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="space-y-5">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-[#5D6E73] mb-2 uppercase tracking-wider">
                  <div className="p-1 rounded bg-gradient-to-br from-[#82A094] to-[#4F6A64]"><IndianRupee className="w-3 h-3 text-white" /></div>
                  Amount (₹) <span className="text-[#E17F70]">*</span>
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
                  className="w-full h-14 px-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none focus:ring-4 focus:ring-[#82A094]/15 transition-all font-mono text-xl font-bold"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-[#5D6E73] mb-2 uppercase tracking-wider">
                  <div className="p-1 rounded bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]"><Calendar className="w-3 h-3 text-white" /></div>
                  Payment Date <span className="text-[#E17F70]">*</span>
                </label>
                <input 
                  type="date" 
                  required
                  value={paymentForm.paymentDate}
                  onChange={e => setPaymentForm({...paymentForm, paymentDate: e.target.value})}
                  className="w-full h-12 px-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#6F8A9D] focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/10 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-bold text-[#5D6E73] mb-2 uppercase tracking-wider">
                    <div className="p-1 rounded bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><Building className="w-3 h-3 text-white" /></div>
                    Reference Bank <span className="text-[#E17F70]">*</span>
                  </label>
                  <select 
                    value={paymentForm.referenceBank}
                    onChange={e => setPaymentForm({...paymentForm, referenceBank: e.target.value})}
                    className="w-full h-12 px-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#CE9F6B] focus:outline-none focus:ring-2 focus:ring-[#CE9F6B]/10 transition-all font-medium"
                    required
                  >
                    <option value="" disabled>Select Bank</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="DB">Deutsche Bank (DB)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-bold text-[#5D6E73] mb-2 uppercase tracking-wider">
                    <div className="p-1 rounded bg-gradient-to-br from-[#E17F70] to-[#CE9F6B]"><CreditCard className="w-3 h-3 text-white" /></div>
                    Mode <span className="text-[#E17F70]">*</span>
                  </label>
                  <select 
                    value={paymentForm.paymentMode}
                    onChange={e => setPaymentForm({...paymentForm, paymentMode: e.target.value})}
                    className="w-full h-12 px-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70] focus:outline-none focus:ring-2 focus:ring-[#E17F70]/10 transition-all font-medium"
                    required
                  >
                    <option value="" disabled>Select Mode</option>
                    <option value="Receipt">Receipt</option>
                    <option value="TDS">TDS</option>
                    <option value="LD">LD</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-[#5D6E73] mb-2 uppercase tracking-wider">
                  <div className="p-1 rounded bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5]"><MessageSquare className="w-3 h-3 text-white" /></div>
                  Notes (Optional)
                </label>
                <textarea 
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#AEBFC3] focus:outline-none focus:ring-2 focus:ring-[#AEBFC3]/10 transition-all resize-none h-20 font-medium"
                  placeholder="Add any notes..."
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={closePaymentModal}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-bold hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/60 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={paymentLoading}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/40 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {paymentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
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
                <h3 className="text-xl font-bold text-[#546A7A]">Cancel Invoice</h3>
                <p className="text-sm text-[#92A2A5]">Are you sure you want to cancel {invoice.invoiceNumber}?</p>
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
                  placeholder="e.g., Customer returned items, Mistake in pricing..."
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
                  onClick={handleCancelInvoice}
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
