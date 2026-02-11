'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, ARPaymentHistory, MatchingPrepaid, formatARCurrency, formatARDate } from '@/lib/ar-api';
import { 
  ArrowLeft, Pencil, Trash2, FileText, Calendar, User, Clock, 
  AlertTriangle, CheckCircle, Loader2, Mail, Phone, MapPin, Building, 
  CreditCard, Hash, Receipt, Truck, MessageSquare, Shield, Copy, 
  RefreshCw, Plus, X, IndianRupee, Package, TrendingUp, XCircle,
  ChevronRight, Timer, Banknote, ArrowDownRight, ArrowUpRight, Sparkles,
  Wallet, CreditCard as CardIcon, BadgeCheck, Scale, Link2, Tag
} from 'lucide-react';

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<ARInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'delivery' | 'remarks' | 'activity'>('details');
  
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

  // Activity log state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Prepaid linking state
  const [matchingPrepaids, setMatchingPrepaids] = useState<MatchingPrepaid[]>([]);
  const [prepaidsLoading, setPrepaidsLoading] = useState(false);
  const [selectedPrepaid, setSelectedPrepaid] = useState<MatchingPrepaid | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingPrepaid, setLinkingPrepaid] = useState(false);

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
      const data = await arApi.getInvoiceById(id);
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

  // Load matching prepaids for regular invoices
  const loadMatchingPrepaids = async (id: string) => {
    try {
      setPrepaidsLoading(true);
      const data = await arApi.getMatchingPrepaids(id);
      setMatchingPrepaids(data.prepaids);
    } catch (err) {
      console.error('Failed to load matching prepaids:', err);
    } finally {
      setPrepaidsLoading(false);
    }
  };

  // Auto-load matching prepaids for non-prepaid invoices with PO number
  // Note: Check !== 'PREPAID' to include older imported invoices where invoiceType may be null
  // Note: Removed linkedPrepaidId check to allow linking multiple prepaids
  useEffect(() => {
    if (invoice?.id && invoice?.invoiceType !== 'PREPAID' && invoice?.poNo) {
      loadMatchingPrepaids(invoice.id);
    }
  }, [invoice?.id, invoice?.invoiceType, invoice?.poNo]);

  // Handle linking prepaid to invoice
  const handleLinkPrepaid = async (prepaid: MatchingPrepaid, transferPayments: boolean = true) => {
    if (!invoice) return;
    
    try {
      setLinkingPrepaid(true);
      const result = await arApi.acceptPrepaid(invoice.id, prepaid.id, transferPayments);
      
      alert(`Successfully linked prepaid ${result.prepaidInvoiceNumber}! Transferred: ${formatARCurrency(result.totalTransferred)}`);
      
      // Reload invoice and clear prepaids
      await loadInvoice(invoice.id);
      setMatchingPrepaids([]);
      setShowLinkModal(false);
      setSelectedPrepaid(null);
    } catch (err: any) {
      console.error('Failed to link prepaid:', err);
      alert(err.response?.data?.error || 'Failed to link prepaid invoice');
    } finally {
      setLinkingPrepaid(false);
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

  const handleDelete = async () => {
    if (!invoice || !confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      setDeleting(true);
      await arApi.deleteInvoice(invoice.id);
      router.push('/finance/ar/invoices');
    } catch (err) {
      console.error('Failed to delete invoice:', err);
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
          <Link 
            href="/finance/ar/invoices" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
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

  // Prepaid-specific computed values
  const isPrepaid = invoice.invoiceType === 'PREPAID';
  const getDeliveryDueDays = () => {
    if (!invoice.deliveryDueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.deliveryDueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  const deliveryDueDays = getDeliveryDueDays();
  const isDeliveryOverdue = deliveryDueDays !== null && deliveryDueDays < 0 && invoice.prepaidStatus !== 'FULLY_DELIVERED';

  const getPrepaidStatusConfig = (status?: string) => {
    switch(status) {
      case 'AWAITING_DELIVERY': return { bg: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]', text: 'text-white', label: 'Awaiting Delivery', icon: Package };
      case 'PARTIALLY_DELIVERED': return { bg: 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]', text: 'text-white', label: 'Partially Delivered', icon: Truck };
      case 'FULLY_DELIVERED': return { bg: 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]', text: 'text-white', label: 'Fully Delivered', icon: CheckCircle };
      case 'EXPIRED': return { bg: 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]', text: 'text-white', label: 'Expired', icon: XCircle };
      case 'LINKED': return { bg: 'bg-gradient-to-r from-[#82A094] to-[#546A7A]', text: 'text-white', label: 'Linked', icon: Link2 };
      default: return { bg: 'bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]', text: 'text-white', label: 'Unknown', icon: Package };
    }
  };
  const prepaidStatusConfig = isPrepaid ? getPrepaidStatusConfig(invoice.prepaidStatus) : null;


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
    <div className="space-y-6 pb-10">
      {/* Toast */}
      {copied && (
        <div className="fixed top-6 right-6 px-5 py-3 bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4" />
          Copied to clipboard!
        </div>
      )}

      {/* Premium Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-[#AEBFC3]/20 shadow-2xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-64 h-64 bg-[#E17F70] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#CE9F6B] rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative p-8">
          {/* Top Row - Back & Actions */}
          <div className="flex items-center justify-between mb-8">
            <Link 
              href="/finance/ar/invoices"
              className="flex items-center gap-2 text-[#5D6E73] hover:text-[#546A7A] transition-colors group"
            >
              <div className="p-2 rounded-xl bg-[#AEBFC3]/10 group-hover:bg-[#AEBFC3]/20 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <span className="font-medium">Back to Invoices</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadInvoice(params.id as string)}
                className="p-2.5 rounded-xl bg-[#AEBFC3]/10 text-[#5D6E73] hover:bg-[#AEBFC3]/20 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold hover:shadow-lg hover:shadow-[#82A094]/30 transition-all"
              >
                <IndianRupee className="w-4 h-4" />
                Record Payment
              </button>
              <Link
                href={`/finance/ar/invoices/${encodeURIComponent(invoice.invoiceNumber)}/edit`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#546A7A] text-white font-semibold hover:bg-[#6F8A9D] transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-2.5 rounded-xl bg-[#E17F70]/10 text-[#9E3B47] hover:bg-[#E17F70]/20 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {/* Invoice Identity */}
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              {/* Invoice Number with Copy */}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] shadow-lg shadow-[#E17F70]/20">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold text-[#546A7A]">{invoice.invoiceNumber}</h1>
                    <button
                      onClick={() => copyToClipboard(invoice.invoiceNumber)}
                      className="p-1.5 rounded-lg hover:bg-[#AEBFC3]/20 transition-colors"
                      title="Copy invoice number"
                    >
                      <Copy className="w-4 h-4 text-[#92A2A5]" />
                    </button>
                  </div>
                  <p className="text-[#92A2A5] text-sm mt-0.5">
                    Created on {formatARDate(invoice.invoiceDate)}
                  </p>
                </div>
              </div>
              
              {/* Customer Info */}
              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white text-lg font-bold shadow-lg">
                    {invoice.customerName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-[#546A7A]">{invoice.customerName}</p>
                    <p className="text-sm text-[#92A2A5] font-mono">{invoice.bpCode}</p>
                  </div>
                </div>
                
                {invoice.region && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#AEBFC3]/10">
                    <MapPin className="w-4 h-4 text-[#6F8A9D]" />
                    <span className="text-sm text-[#5D6E73]">{invoice.region}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Status & Risk Badges */}
            <div className="flex flex-col items-end gap-3">
              {/* Prepaid Badge - Prominent */}
              {isPrepaid && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white shadow-lg shadow-[#CE9F6B]/30">
                  <Wallet className="w-5 h-5" />
                  <span className="font-bold">PREPAID INVOICE</span>
                </div>
              )}
              
              <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl ${statusConfig.bg} ${statusConfig.text} shadow-lg ${statusConfig.glow}`}>
                <StatusIcon className="w-5 h-5" />
                <span className="font-bold text-lg">{invoice.status}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Prepaid Delivery Status */}
                {isPrepaid && prepaidStatusConfig && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${prepaidStatusConfig.bg} ${prepaidStatusConfig.text} text-sm font-semibold shadow-md`}>
                    <prepaidStatusConfig.icon className="w-3.5 h-3.5" />
                    {prepaidStatusConfig.label}
                  </div>
                )}
                
                {!isPrepaid && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${riskConfig.bg} ${riskConfig.text} text-sm font-semibold`}>
                    <Shield className="w-3.5 h-3.5" />
                    {riskConfig.label}
                  </div>
                )}
                
                {/* Delivery countdown for prepaid OR payment overdue for regular */}
                {isPrepaid && deliveryDueDays !== null && invoice.prepaidStatus !== 'FULLY_DELIVERED' && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    deliveryDueDays < 0 
                      ? 'bg-[#E17F70]/10 text-[#9E3B47]' 
                      : 'bg-[#82A094]/10 text-[#4F6A64]'
                  }`}>
                    <Timer className="w-3.5 h-3.5" />
                    {deliveryDueDays < 0 ? `${Math.abs(deliveryDueDays)}d delivery overdue` : `${deliveryDueDays}d to delivery`}
                  </div>
                )}
                
                {!isPrepaid && (invoice.dueByDays ?? 0) !== 0 && invoice.status !== 'PAID' && (
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

      {/* Financial Summary - Premium Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#546A7A] p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Total Amount</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatARCurrency(totalAmount)}</p>
            <p className="text-white/60 text-xs mt-2">Invoice value</p>
          </div>
        </div>

        {/* Net Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6F8A9D] via-[#96AEC2] to-[#6F8A9D] p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Net Amount</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatARCurrency(netAmount)}</p>
            <p className="text-white/60 text-xs mt-2">Before tax</p>
          </div>
        </div>

        {/* Tax Amount */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#CE9F6B] p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Tax Amount</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatARCurrency(taxAmount)}</p>
            <p className="text-white/60 text-xs mt-2">GST/VAT applied</p>
          </div>
        </div>

        {/* Receipts */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#82A094] via-[#4F6A64] to-[#82A094] p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/20">
                <ArrowDownRight className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Receipts</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatARCurrency(totalReceived)}</p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3 h-3 text-white/80" />
              <span className="text-white/80 text-xs">{Math.round(paymentProgress)}% collected</span>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className={`group relative overflow-hidden rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ${
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
              <div className="p-2 rounded-lg bg-white/20">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Balance Due</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatARCurrency(Math.abs(balanceAmount))}</p>
            <p className="text-white/60 text-xs mt-2 flex items-center gap-1">
              {balanceAmount <= 0 ? (
                <><BadgeCheck className="w-3 h-3" /> Fully Paid</>
              ) : isOverdue ? (
                <><AlertTriangle className="w-3 h-3" /> Payment overdue</>
              ) : (
                <><Clock className="w-3 h-3" /> Pending payment</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Prepaid Milestones & Aging Timeline */}
      {isPrepaid && (
        <div className="bg-white rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Sparkles className="w-12 h-12 text-[#CE9F6B]" />
          </div>
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B]/20 to-[#E17F70]/20">
                <Timer className="w-5 h-5 text-[#CE9F6B]" />
              </div>
              <div>
                <h3 className="font-bold text-[#546A7A]">Milestones & Aging Tracking</h3>
                <p className="text-sm text-[#92A2A5]">Aging is calculated based on <span className="text-[#976E44] font-bold underline capitalize">{invoice.agingMilestone?.toLowerCase() || 'invoice'} date</span></p>
              </div>
            </div>
          </div>
          
          {/* Milestone Strip */}
          <div className="relative">
            {/* Background Line */}
            <div className="absolute top-8 left-6 right-6 h-1.5 bg-[#AEBFC3]/20 rounded-full" />
            
            <div className="grid grid-cols-5 gap-4 relative z-10">
              {[
                { id: 'ADVANCE', label: 'Adv Date', date: invoice.advanceReceivedDate, icon: Wallet },
                { id: 'INVOICE', label: 'Invoice Date', date: invoice.invoiceDate, icon: FileText },
                { id: 'BG', label: 'BG Date', date: invoice.bgDate, icon: Shield },
                { id: 'GRN', label: 'GRN Date', date: invoice.grnDate, icon: Package },
                { id: 'OTHERS', label: 'Others', date: invoice.othersDate, icon: Tag },
              ].map((m) => (
                <div key={m.id} className="flex flex-col items-center group">
                  <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${
                    m.date 
                      ? invoice.agingMilestone === m.id 
                        ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-xl shadow-[#CE9F6B]/30 scale-110 z-20' 
                        : 'bg-white border-2 border-[#CE9F6B]/30'
                      : 'bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/10 opacity-50'
                  }`}>
                    {invoice.agingMilestone === m.id && (
                      <div className="absolute -top-3 -right-3 p-1 rounded-full bg-white shadow-md border border-[#CE9F6B]">
                        <CheckCircle className="w-4 h-4 text-[#976E44]" />
                      </div>
                    )}
                    <m.icon className={`w-6 h-6 mb-1 ${
                      m.date 
                        ? invoice.agingMilestone === m.id ? 'text-white' : 'text-[#CE9F6B]'
                        : 'text-[#92A2A5]'
                    }`} />
                    {invoice.agingMilestone === m.id && (
                      <span className="text-[8px] font-black tracking-tighter text-white uppercase opacity-80">Aging Base</span>
                    )}
                  </div>
                  
                  <div className="mt-3 text-center">
                    <p className={`text-xs font-bold ${m.date ? 'text-[#546A7A]' : 'text-[#92A2A5]'}`}>{m.label}</p>
                    <p className={`text-[10px] whitespace-nowrap ${
                      m.date 
                        ? invoice.agingMilestone === m.id ? 'text-[#976E44] font-bold' : 'text-[#92A2A5]'
                        : 'text-[#AEBFC3]'
                    }`}>
                      {m.date ? formatARDate(m.date) : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#AEBFC3]/10 flex items-center justify-between">
            <div className="flex gap-4">
              <div className="bg-[#AEBFC3]/10 px-4 py-2 rounded-xl">
                <span className="text-xs text-[#92A2A5] block">Expected Delivery</span>
                <span className="font-bold text-[#546A7A]">{invoice.deliveryDueDate ? formatARDate(invoice.deliveryDueDate) : 'N/A'}</span>
              </div>
              <div className={`px-4 py-2 rounded-xl ${isDeliveryOverdue ? 'bg-[#E17F70]/10' : 'bg-[#82A094]/10'}`}>
                <span className="text-xs text-[#92A2A5] block">Delivery Status</span>
                <span className={`font-bold ${isDeliveryOverdue ? 'text-[#9E3B47]' : 'text-[#4F6A64]'}`}>
                  {isDeliveryOverdue ? 'Overdue' : invoice.prepaidStatus?.replace('_', ' ') || 'Pending'}
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-xs text-[#92A2A5] block">Days Left / Overdue</span>
              <div className="flex items-center gap-2">
                <Timer className={`w-4 h-4 ${daysOverdue > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`} />
                <span className={`text-xl font-black ${daysOverdue > 0 ? 'text-[#9E3B47]' : 'text-[#4F6A64]'}`}>
                  {daysOverdue > 0 ? `${daysOverdue} Days Overdue` : `${Math.abs(daysOverdue)} Days Left`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Matching Prepaids Banner - For regular invoices with matching prepaids */}
      {!isPrepaid && matchingPrepaids.length > 0 && (() => {
        const linkedCount = matchingPrepaids.filter(p => (p as any).linkedInvoiceId === invoice?.id).length;
        const availableCount = matchingPrepaids.length - linkedCount;
        const hasNewPaymentsCount = matchingPrepaids.filter(p => (p as any).untransferredPayments > 0).length;
        const totalNewPaymentsAmount = matchingPrepaids.reduce((sum, p) => sum + ((p as any).untransferredAmount || 0), 0);
        
        // Use green theme if already linked, orange/brown if only matching found
        const themeColor = linkedCount > 0 ? '#82A094' : '#CE9F6B';
        const gradientFrom = linkedCount > 0 ? 'from-[#82A094]/10' : 'from-[#CE9F6B]/10';
        const gradientTo = linkedCount > 0 ? 'to-[#4F6A64]/10' : 'to-[#E17F70]/10';
        const iconGradient = linkedCount > 0 ? 'from-[#82A094] to-[#4F6A64]' : 'from-[#CE9F6B] to-[#E17F70]';
        const shadowColor = linkedCount > 0 ? 'shadow-[#82A094]/30' : 'shadow-[#CE9F6B]/30';

        return (
        <div className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-2xl border border-${linkedCount > 0 ? '[#82A094]/30' : '[#CE9F6B]/30'} p-6 shadow-lg mb-6`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${iconGradient} shadow-lg ${shadowColor} mt-1`}>
                {linkedCount > 0 ? <BadgeCheck className="w-6 h-6 text-white" /> : <Wallet className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h3 className="font-bold text-[#546A7A] flex items-center gap-2">
                  {linkedCount > 0 ? <CheckCircle className="w-4 h-4 text-[#82A094]" /> : <Sparkles className="w-4 h-4 text-[#CE9F6B]" />}
                  {hasNewPaymentsCount > 0 ? 'New Payments Available!' : linkedCount > 0 ? 'Prepaid Invoices Linked' : 'Matching Prepaid Invoice Found!'}
                </h3>
                <p className="text-sm text-[#5D6E73] mt-1">
                  {linkedCount > 0 ? (
                    <>This invoice has been linked to <span className="font-bold text-[#546A7A]">{linkedCount}</span> prepaid invoice{linkedCount > 1 ? 's' : ''}.</>
                  ) : (
                    <>Matching prepaid invoice found with PO <span className="font-mono font-bold text-[#546A7A]">{invoice.poNo}</span>.</>
                  )}
                  {hasNewPaymentsCount > 0 && (
                    <span className="text-[#E17F70] font-bold animate-pulse ml-1"> • {formatARCurrency(totalNewPaymentsAmount)} new available</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(availableCount > 0 || hasNewPaymentsCount > 0) && (
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white font-bold hover:shadow-lg hover:shadow-[#CE9F6B]/30 transition-all text-sm"
                >
                  <Link2 className="w-4 h-4" />
                  {hasNewPaymentsCount > 0 ? 'Transfer New' : 'Link More'}
                </button>
              )}
              {availableCount === 0 && hasNewPaymentsCount === 0 && linkedCount > 0 && (
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#82A094] text-white font-bold hover:shadow-lg transition-all text-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  View Linked
                </button>
              )}
            </div>
          </div>
          
          {/* Detailed breakdown for linked invoices OR quick preview for available ones */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {linkedCount > 0 ? (
              // Detailed breakdown for linked prepaids
              (invoice as any).linkedFromPrepaids?.map((prepaid: any) => (
                <div key={prepaid.id} className="bg-white/60 rounded-xl border border-[#82A094]/20 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#82A094]/10">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-[#82A094]" />
                      <span className="font-bold text-[#546A7A]">{prepaid.invoiceNumber}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#82A094]">
                        {formatARCurrency(prepaid.paymentHistory?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0)}
                      </span>
                      <p className="text-[10px] text-[#92A2A5] leading-none">transferred</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {prepaid.paymentHistory?.map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between text-xs">
                        <span className="text-[#5D6E73] font-medium">
                          {formatARDate(payment.paymentDate)} • {payment.paymentMode}
                        </span>
                        <span className="font-bold text-[#546A7A]">{formatARCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Simple preview for available prepaids
              matchingPrepaids.slice(0, 2).map((prepaid) => (
                <div key={prepaid.id} className="flex items-center justify-between p-4 rounded-xl border bg-white/80 border-[#AEBFC3]/20 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#CE9F6B]/10">
                      <Receipt className="w-4 h-4 text-[#CE9F6B]" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#546A7A]">{prepaid.invoiceNumber}</p>
                      <p className="text-xs text-[#92A2A5]">{formatARDate(prepaid.invoiceDate)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#CE9F6B]">{formatARCurrency(prepaid.totalPayments)}</p>
                    <p className="text-[10px] text-[#92A2A5]">available</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        );
})()}

      {/* Link Prepaid Modal */}
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
                    <h2 className="text-xl font-bold text-[#546A7A]">Link Prepaid Invoice</h2>
                    <p className="text-sm text-[#92A2A5]">Transfer payments from prepaid to this invoice</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowLinkModal(false); setSelectedPrepaid(null); }}
                  className="p-2 rounded-xl hover:bg-[#AEBFC3]/20 transition-colors"
                >
                  <X className="w-6 h-6 text-[#5D6E73]" />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {matchingPrepaids.map((prepaid) => (
                  <div 
                    key={prepaid.id}
                    onClick={() => {
                      // Allow selection if: not linked, OR linked but has untransferred payments
                      const isLinked = (prepaid as any).linkedInvoiceId === invoice?.id;
                      const hasNewPayments = (prepaid as any).untransferredPayments > 0;
                      if (!isLinked || hasNewPayments) {
                        setSelectedPrepaid(prepaid);
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      (prepaid as any).linkedInvoiceId === invoice?.id && (prepaid as any).untransferredPayments === 0
                        ? 'border-[#82A094]/30 bg-[#82A094]/10 cursor-not-allowed opacity-70'
                        : (prepaid as any).linkedInvoiceId === invoice?.id && (prepaid as any).untransferredPayments > 0
                          ? 'border-[#CE9F6B]/50 bg-[#CE9F6B]/5 cursor-pointer'
                          : selectedPrepaid?.id === prepaid.id 
                            ? 'border-[#CE9F6B] bg-[#CE9F6B]/5 shadow-lg cursor-pointer' 
                            : 'border-[#AEBFC3]/20 hover:border-[#AEBFC3]/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          (prepaid as any).linkedInvoiceId === invoice?.id && (prepaid as any).untransferredPayments === 0
                            ? 'border-[#82A094] bg-[#82A094]'
                            : selectedPrepaid?.id === prepaid.id 
                              ? 'border-[#CE9F6B] bg-[#CE9F6B]' 
                              : 'border-[#AEBFC3]'
                        }`}>
                          {(((prepaid as any).linkedInvoiceId === invoice?.id && (prepaid as any).untransferredPayments === 0) || selectedPrepaid?.id === prepaid.id) && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-[#546A7A]">{prepaid.invoiceNumber}</p>
                            {(prepaid as any).linkedInvoiceId === invoice?.id && (prepaid as any).untransferredPayments === 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#82A094] text-white text-[10px] font-bold uppercase">
                                Fully Transferred ✓
                              </span>
                            )}
                            {(prepaid as any).linkedInvoiceId === invoice?.id && (prepaid as any).untransferredPayments > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#CE9F6B] text-white text-[10px] font-bold uppercase animate-pulse">
                                {(prepaid as any).untransferredPayments} New Payment{(prepaid as any).untransferredPayments > 1 ? 's' : ''} • {formatARCurrency((prepaid as any).untransferredAmount)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#92A2A5]">{prepaid.customerName}</p>
                          {prepaid.poNo && (
                            <p className="text-xs text-[#CE9F6B] font-mono mt-0.5">
                              PO: <span className="font-bold">{prepaid.poNo}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-[#82A094]">{formatARCurrency(prepaid.totalPayments)}</p>
                        <p className="text-xs text-[#92A2A5] uppercase font-semibold">
                          {(prepaid as any).linkedInvoiceId === invoice?.id ? 'Transferred' : prepaid.status}
                        </p>
                      </div>
                    </div>
                    
                    {/* Payment details */}
                    {prepaid.payments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#AEBFC3]/20">
                        <p className="text-xs font-semibold text-[#92A2A5] mb-2">PAYMENT RECORDS</p>
                        <div className="space-y-1">
                          {prepaid.payments.slice(0, 3).map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between text-sm">
                              <span className="text-[#5D6E73]">{formatARDate(payment.paymentDate)} • {payment.paymentMode}</span>
                              <span className="font-semibold text-[#546A7A]">{formatARCurrency(payment.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-[#AEBFC3]/20 bg-[#AEBFC3]/5">
              <div className="flex items-center justify-between">
                <div>
                  {selectedPrepaid && (
                    <p className="text-sm text-[#5D6E73]">
                      Transferring <span className="font-bold text-[#82A094]">{formatARCurrency(selectedPrepaid.totalPayments)}</span> to this invoice
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowLinkModal(false); setSelectedPrepaid(null); }}
                    className="px-5 py-2.5 rounded-xl border border-[#AEBFC3]/30 text-[#5D6E73] font-semibold hover:bg-[#AEBFC3]/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => selectedPrepaid && handleLinkPrepaid(selectedPrepaid, true)}
                    disabled={!selectedPrepaid || linkingPrepaid}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {linkingPrepaid ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4" />
                        Link & Transfer Payments
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
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-[#AEBFC3]/20 p-2 shadow-lg mb-6">
        {[
          { id: 'details', label: 'Details', icon: FileText },
          { id: 'payments', label: 'Payment History', icon: Receipt, count: invoice.paymentHistory?.length || 0 },
          { id: 'delivery', label: 'Delivery', icon: Truck },
          { id: 'remarks', label: 'Remarks', icon: MessageSquare, count: remarks.length },
          { id: 'activity', label: 'Activity Log', icon: Clock, count: activityLogs.length },
        ].filter(tab => !isPrepaid || tab.id !== 'delivery').map((tab) => (

          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg'
                : 'text-[#5D6E73] hover:bg-[#AEBFC3]/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-[#6F8A9D]/10 text-[#6F8A9D]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 shadow-lg overflow-hidden">
        {activeTab === 'details' && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Invoice Information */}
              <div className="space-y-6">
                <div>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-lg bg-[#E17F70]/10">
                      <Hash className="w-5 h-5 text-[#E17F70]" />
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
                
                {/* Financial Breakdown */}
                <div>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-4">
                    <div className="p-2 rounded-lg bg-[#82A094]/10">
                      <IndianRupee className="w-5 h-5 text-[#82A094]" />
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
                    <div className="p-2 rounded-lg bg-[#6F8A9D]/10">
                      <Building className="w-5 h-5 text-[#6F8A9D]" />
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
                    <div className="p-2 rounded-lg bg-[#CE9F6B]/10">
                      <User className="w-5 h-5 text-[#CE9F6B]" />
                    </div>
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
            
            {/* Comments */}
            {invoice.comments && (
              <div className="mt-6 p-4 rounded-xl bg-[#AEBFC3]/10 border border-[#AEBFC3]/20">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-[#6F8A9D]" />
                  <span className="font-semibold text-[#546A7A]">Comments</span>
                </div>
                <p className="text-[#5D6E73] whitespace-pre-wrap">{invoice.comments}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A]">
                <div className="p-2 rounded-lg bg-[#82A094]/10">
                  <Receipt className="w-5 h-5 text-[#82A094]" />
                </div>
                Payment History
              </h4>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold hover:shadow-lg transition-all"
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
                    <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                      <div>
                        <p className="text-xs text-[#92A2A5]">Date</p>
                        <p className="font-medium text-[#546A7A]">{formatARDate(payment.paymentDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#92A2A5]">Mode & Bank</p>
                        <div className="flex flex-col">
                          <p className="font-medium text-[#546A7A]">{payment.paymentMode || '-'}</p>
                          {payment.referenceBank && (
                            <span className="text-[10px] font-bold text-[#6F8A9D] uppercase">@{payment.referenceBank}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#92A2A5]">Added By</p>
                        <p className="font-medium text-[#CE9F6B] text-sm">{(payment as any).recordedBy || (payment as any).recordedByUser?.name || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#92A2A5]">Amount</p>
                        <p className="font-bold text-[#4F6A64] text-lg">{formatARCurrency(payment.amount)}</p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditPayment(payment)}
                          className="p-2 rounded-lg bg-[#6F8A9D]/10 text-[#6F8A9D] hover:bg-[#6F8A9D]/20 transition-all"
                          title="Edit payment"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="p-2 rounded-lg bg-[#E17F70]/10 text-[#9E3B47] hover:bg-[#E17F70]/20 transition-all"
                          title="Delete payment"
                        >
                          <Trash2 className="w-4 h-4" />
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

        {activeTab === 'delivery' && (
          <div className="p-6">
            <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-6">
              <div className="p-2 rounded-lg bg-[#CE9F6B]/10">
                <Truck className="w-5 h-5 text-[#CE9F6B]" />
              </div>
              Delivery Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#AEBFC3]/5">
                  <p className="text-xs text-[#92A2A5] mb-1">Delivery Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
                    invoice.deliveryStatus === 'DELIVERED' ? 'bg-[#82A094]/20 text-[#4F6A64]' :
                    invoice.deliveryStatus === 'SENT' ? 'bg-[#CE9F6B]/20 text-[#976E44]' :
                    invoice.deliveryStatus === 'ACKNOWLEDGED' ? 'bg-[#6F8A9D]/20 text-[#546A7A]' :
                    'bg-[#AEBFC3]/20 text-[#5D6E73]'
                  }`}>
                    {invoice.deliveryStatus === 'DELIVERED' && <CheckCircle className="w-4 h-4" />}
                    {invoice.deliveryStatus === 'SENT' && <Truck className="w-4 h-4" />}
                    {invoice.deliveryStatus}
                  </span>
                </div>
                
                <div className="p-4 rounded-xl bg-[#AEBFC3]/5">
                  <p className="text-xs text-[#92A2A5] mb-1">Mode of Delivery</p>
                  <p className="font-medium text-[#546A7A]">{invoice.modeOfDelivery || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#AEBFC3]/5">
                  <p className="text-xs text-[#92A2A5] mb-1">Sent/Handover Date</p>
                  <p className="font-medium text-[#546A7A]">{invoice.sentHandoverDate ? formatARDate(invoice.sentHandoverDate) : '-'}</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#AEBFC3]/5">
                  <p className="text-xs text-[#92A2A5] mb-1">Impact/Acknowledgement Date</p>
                  <p className="font-medium text-[#546A7A]">{invoice.impactDate ? formatARDate(invoice.impactDate) : '-'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'remarks' && (
          <div className="p-6">
            <h4 className="flex items-center gap-2 text-lg font-bold text-[#546A7A] mb-6">
              <div className="p-2 rounded-lg bg-[#6F8A9D]/10">
                <MessageSquare className="w-5 h-5 text-[#6F8A9D]" />
              </div>
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

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/20">
                  <Clock className="w-5 h-5 text-[#546A7A]" />
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
                    <div key={activity.id} className="relative flex gap-4">
                      {/* Timeline line */}
                      {index < activityLogs.length - 1 && (
                        <div className="absolute left-5 top-12 w-0.5 h-full bg-gradient-to-b from-[#AEBFC3]/50 to-transparent" />
                      )}
                      
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${actionConfig.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                        <ActionIcon className="w-5 h-5 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 bg-white rounded-xl p-4 shadow-md border border-[#AEBFC3]/20">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-[#546A7A]">{activity.description}</p>
                            {activity.fieldName && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-[#6F8A9D]/10 text-[#6F8A9D] px-2 py-0.5 rounded">
                                  {activity.fieldName}
                                </span>
                                {activity.oldValue && (
                                  <span className="text-xs text-[#92A2A5]">
                                    {activity.oldValue} → {activity.newValue}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[#92A2A5]">
                              {new Date(activity.createdAt).toLocaleDateString('en-IN', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </p>
                            <p className="text-xs text-[#CE9F6B] font-medium">
                              {new Date(activity.createdAt).toLocaleTimeString('en-IN', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
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
                <p className="text-[#92A2A5]">Activity will be recorded when changes are made to this invoice.</p>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl relative animate-scale-in">
            <button 
              onClick={closePaymentModal}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-[#AEBFC3]/20 transition-colors"
            >
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
                <label className="block text-sm font-semibold text-[#5D6E73] mb-2">
                  Amount (₹) <span className="text-[#E17F70]">*</span>
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="w-full h-14 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none focus:ring-4 focus:ring-[#82A094]/20 transition-all font-mono text-xl"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#5D6E73] mb-2">
                  Payment Date <span className="text-[#E17F70]">*</span>
                </label>
                <input 
                  type="date" 
                  required
                  value={paymentForm.paymentDate}
                  onChange={e => setPaymentForm({...paymentForm, paymentDate: e.target.value})}
                  className="w-full h-12 px-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#5D6E73] mb-2">
                    Reference Bank <span className="text-[#E17F70]">*</span>
                  </label>
                  <select 
                    value={paymentForm.referenceBank}
                    onChange={e => setPaymentForm({...paymentForm, referenceBank: e.target.value})}
                    className="w-full h-12 px-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all"
                    required
                  >
                    <option value="" disabled>Select Bank</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="DB">Deutsche Bank (DB)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#5D6E73] mb-2">
                    Mode <span className="text-[#E17F70]">*</span>
                  </label>
                  <select 
                    value={paymentForm.paymentMode}
                    onChange={e => setPaymentForm({...paymentForm, paymentMode: e.target.value})}
                    className="w-full h-12 px-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all"
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
                <label className="block text-sm font-semibold text-[#5D6E73] mb-2">Notes (Optional)</label>
                <textarea 
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#82A094] focus:outline-none transition-all resize-none h-20"
                  placeholder="Add any notes..."
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={closePaymentModal}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-semibold hover:bg-[#AEBFC3]/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={paymentLoading}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold hover:shadow-lg hover:shadow-[#82A094]/40 transition-all flex items-center justify-center gap-2"
                >
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
      `}</style>
    </div>
  );
}
