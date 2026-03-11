'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, formatARCurrency, MilestonePaymentTerm } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, User, Calendar, IndianRupee, Sparkles, Wallet, Plus, Trash2, Tag, X, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react';

export default function EditMilestonePage() {
  const params = useParams();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<ARInvoice | null>(null);

  // Helper to format numbers with Indian commas
  const formatWithCommas = (val: string | number) => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('en-IN').format(num);
  };

  // Helper to strip commas
  const unformatNumber = (val: string) => val.replace(/,/g, '');

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    bpCode: '',
    customerName: '',
    poNo: '',
    soNo: '',
    totalAmount: '',
    netAmount: '',
    taxAmount: '',
    invoiceDate: '',
    dueDate: '',
    actualPaymentTerms: '',
    riskClass: 'LOW',
    emailId: '',
    contactNo: '',
    region: '',
    department: '',
    personInCharge: '',
    type: '',
    status: 'PENDING',
    // Milestone fields
    invoiceType: 'MILESTONE' as 'MILESTONE',
    milestoneTerms: [] as MilestonePaymentTerm[],
    milestoneStatus: '' as '' | 'AWAITING_DELIVERY' | 'PARTIALLY_DELIVERED' | 'FULLY_DELIVERED' | 'EXPIRED' | 'LINKED',
    accountingStatus: '' as '' | 'REVENUE_RECOGNISED' | 'BACKLOG',
    mailToTSP: '',
    bookingMonth: '',
  });

  const termOptions = [
    { value: 'ABG', label: 'ABG' },
    { value: 'PO', label: 'PO' },
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'FAR', label: 'FAR' },
    { value: 'PBG', label: 'PBG' },
    { value: 'FAR_PBG', label: 'FAR & PBG' },
    { value: 'INVOICE_SUBMISSION', label: 'Invoice Submission' },
    { value: 'PI', label: 'PI' },
    { value: 'OTHER', label: 'Other' },
  ];

  // Get term types already used (excluding OTHER which can be repeated)
  const usedTermTypes: string[] = formData.milestoneTerms
    .map(t => t.termType)
    .filter(t => t !== 'OTHER');

  const addTerm = () => {
    // Find the first unused term type
    const firstAvailable = termOptions.find(opt => opt.value === 'OTHER' || !usedTermTypes.includes(opt.value));
    const termType = firstAvailable?.value || 'OTHER';
    setFormData(prev => ({
      ...prev,
      milestoneTerms: [
        ...prev.milestoneTerms,
        { termType: termType as any, termDate: '', percentage: 0, calculationBasis: 'NET_AMOUNT' }
      ]
    }));
  };

  const removeTerm = (index: number) => {
    setFormData(prev => ({
      ...prev,
      milestoneTerms: prev.milestoneTerms.filter((_, i) => i !== index)
    }));
  };

  const updateTerm = (index: number, field: keyof MilestonePaymentTerm, value: string | boolean) => {
    let finalValue: any = value;

    // Validation for percentage
    if (field === 'percentage' || field === 'taxPercentage') {
      const numValue = parseFloat(value as string);
      if (!isNaN(numValue)) {
        finalValue = Math.min(100, Math.max(0, numValue));
      } else if (value === '') {
        finalValue = 0;
      }
    }

    setFormData(prev => {
      const newTerms = [...prev.milestoneTerms];
      newTerms[index] = { ...newTerms[index], [field]: finalValue };
      return { ...prev, milestoneTerms: newTerms };
    });
  };

  // Helper to get the calculated amount for a term
  const getTermAmount = (term: MilestonePaymentTerm) => {
    const pct = Number(term.percentage) || 0;
    const netAmount = parseFloat(formData.netAmount || '0');
    const netPortion = (netAmount * pct) / 100;
    
    if (term.calculationBasis === 'TOTAL_AMOUNT') {
      const taxPct = Number(term.taxPercentage) || 0;
      const taxAmount = parseFloat(formData.taxAmount || '0');
      const taxPortion = (taxAmount * taxPct) / 100;
      return netPortion + taxPortion;
    }
    
    return netPortion;
  };

  // Total allocated amount (sum of each term's calculated amount) based on total amount
  const totalAllocatedAmount = formData.milestoneTerms.reduce((sum, term) => sum + getTermAmount(term), 0);

  const totalPercentage = formData.milestoneTerms.reduce((sum, term) => sum + (Number(term.percentage) || 0), 0);

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id as string);
    }
  }, [params.id]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      const data = await arApi.getInvoiceById(id);
      
      // Ensure it's a milestone invoice, otherwise redirect
      if (data.invoiceType !== 'MILESTONE') {
        router.push(`/finance/ar/invoices/${id}/edit`);
        return;
      }

      setInvoice(data);
      
      setFormData({
        invoiceNumber: data.invoiceNumber || '',
        bpCode: data.bpCode || '',
        customerName: data.customerName || '',
        poNo: data.poNo || '',
        soNo: data.soNo || '',
        totalAmount: String(data.totalAmount || ''),
        netAmount: String(data.netAmount || ''),
        taxAmount: String(data.taxAmount || ''),
        invoiceDate: data.invoiceDate ? data.invoiceDate.split('T')[0] : '',
        dueDate: data.dueDate ? data.dueDate.split('T')[0] : '',
        actualPaymentTerms: data.actualPaymentTerms || '',
        riskClass: data.riskClass || 'LOW',
        emailId: data.emailId || '',
        contactNo: data.contactNo || '',
        region: data.region || '',
        department: data.department || '',
        personInCharge: data.personInCharge || '',
        type: data.type || 'NB',
        status: data.status || 'PENDING',
        invoiceType: 'MILESTONE',
        milestoneTerms: (data.milestoneTerms as MilestonePaymentTerm[]) || [],
        milestoneStatus: data.milestoneStatus || 'AWAITING_DELIVERY',
        accountingStatus: data.accountingStatus || '',
        mailToTSP: (data.mailToTSP === 'false' as any) ? '' : (data.mailToTSP || ''),
        bookingMonth: data.bookingMonth || '',
      });
    } catch (err) {
      console.error('Failed to load milestone payment:', err);
      setError('Failed to load milestone payment');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Handle comma formatting for financial fields
    if (['netAmount', 'taxAmount', 'totalAmount'].includes(name)) {
      const rawValue = unformatNumber(value);
      // Allow only numbers and one decimal point
      if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return;
      
      setFormData(prev => {
        const newData = { ...prev, [name]: rawValue };
        
        // Auto-calculate Total if Net or Tax changes
        if (name === 'netAmount' || name === 'taxAmount') {
          const net = parseFloat(unformatNumber(newData.netAmount) || '0');
          const tax = parseFloat(unformatNumber(newData.taxAmount) || '0');
          newData.totalAmount = (net + tax).toString();
        }
        
        return newData;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPercentage > 100) {
      setError('Total percentage allocation cannot exceed 100%');
      return;
    }
    setError(null);

    try {
      setSaving(true);
      
      await arApi.updateInvoice(invoice!.id, {
        poNo: formData.poNo || undefined,
        soNo: formData.soNo || undefined,
        totalAmount: parseFloat(unformatNumber(formData.totalAmount) || '0'),
        netAmount: parseFloat(unformatNumber(formData.netAmount) || '0'),
        taxAmount: parseFloat(unformatNumber(formData.taxAmount) || '0'),
        dueDate: formData.dueDate,
        actualPaymentTerms: formData.actualPaymentTerms || undefined,
        riskClass: formData.riskClass as any,
        emailId: formData.emailId || undefined,
        contactNo: formData.contactNo || undefined,
        region: formData.region || undefined,
        department: formData.department || undefined,
        personInCharge: formData.personInCharge || undefined,
        type: formData.type || undefined,
        status: formData.status as any,
        invoiceType: 'MILESTONE',
        milestoneTerms: formData.milestoneTerms,
        milestoneStatus: formData.milestoneStatus || undefined,
        accountingStatus: formData.accountingStatus || undefined,
        mailToTSP: formData.mailToTSP,
        bookingMonth: formData.bookingMonth || undefined,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
      } as any);
      
      router.push(`/finance/ar/milestones/${invoice!.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update milestone payment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/30" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#CE9F6B] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-[#E17F70] border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            <Wallet className="absolute inset-0 m-auto w-6 h-6 text-[#546A7A]" />
          </div>
          <span className="text-[#92A2A5] text-sm font-medium">Loading milestone records...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#CE9F6B]/20 to-[#E17F70]/20 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Wallet className="w-12 h-12 text-[#CE9F6B]" />
          </div>
          <h2 className="text-xl font-bold text-[#546A7A] mb-2">Milestone Record Not Found</h2>
          <Link href="/finance/ar/milestones" className="text-[#E17F70] hover:text-[#9E3B47] font-semibold transition-colors">
            ← Back to Milestone Payments
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all duration-300 font-medium hover:border-[#AEBFC3]/50";
  const labelClass = "block text-[#5D6E73] text-sm font-semibold mb-3";
  const selectClass = "w-full h-12 px-4 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all duration-300 font-medium hover:border-[#AEBFC3]/50";

  return (
    <div className="space-y-6 relative w-full pb-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
        <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-gradient-to-br from-[#CE9F6B]/20 to-[#E17F70]/20 rounded-full blur-[8rem] opacity-50" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-[6rem] opacity-50" />
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#CE9F6B] via-[#E17F70] to-[#976E44] p-6 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-48 h-48 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href={`/finance/ar/milestones/${invoice!.id}`}
              className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300 hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Edit Milestone Payment
                <Sparkles className="w-5 h-5 text-white/80 animate-pulse" />
              </h1>
              <p className="text-white/80 text-sm mt-1">{formData.soNo || formData.invoiceNumber} • {formData.customerName}</p>
            </div>
          </div>
          {/* SAP Quick Reference */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <IndianRupee className="w-4 h-4 text-white/80" />
              <div>
                <p className="text-white/60 text-[9px] font-bold uppercase tracking-wider">Total</p>
                <p className="text-white font-bold text-sm">{formatARCurrency(Number(formData.totalAmount))}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <User className="w-4 h-4 text-white/80" />
              <div>
                <p className="text-white/60 text-[9px] font-bold uppercase tracking-wider">Customer</p>
                <p className="text-white font-bold text-sm truncate max-w-[120px]">{formData.bpCode}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 font-medium animate-shake shadow-lg shadow-red-100">
            <div className="p-1.5 rounded-lg bg-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="flex-1 text-sm">{error}</span>
            <button type="button" onClick={() => setError(null)} className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Order & Customer Info */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20 group-hover:shadow-[#CE9F6B]/40 transition-all duration-300">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            Order & Customer Info
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>SO Number</label>
              <input
                type="text"
                name="soNo"
                value={formData.soNo}
                onChange={handleChange}
                placeholder="Sales Order Number"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>PO Number</label>
              <input
                type="text"
                name="poNo"
                value={formData.poNo}
                onChange={handleChange}
                placeholder="Customer PO Number"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Customer Code</label>
              <input
                type="text"
                name="bpCode"
                value={formData.bpCode}
                onChange={handleChange}
                placeholder="BP Code"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Invoice No</label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleChange}
                placeholder="Invoice Number"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Customer Name</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="Customer Name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Invoice Date</label>
              <input
                type="date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Booking Month</label>
              <input
                type="month"
                name="bookingMonth"
                value={formData.bookingMonth}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Accounting Status</label>
              <select 
                name="accountingStatus" 
                value={formData.accountingStatus} 
                onChange={handleChange} 
                className={selectClass}
              >
                <option value="">Select Status</option>
                <option value="REVENUE_RECOGNISED">Revenue Recognised</option>
                <option value="BACKLOG">Backlog</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>TSP</label>
              <select
                name="mailToTSP"
                value={formData.mailToTSP}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="">Select TSP</option>
                <option value="PEND">PEND</option>
                <option value="Aijaz">Aijaz</option>
                <option value="Tanmay">Tanmay</option>
                <option value="Anand">Anand</option>
                <option value="Rishi">Rishi</option>
                <option value="Vinay">Vinay</option>
                <option value="others">others</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-[#AEBFC3]/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Total Amount (₹) <span className="text-[#E17F70]">*</span></label>
              <input
                type="text"
                name="totalAmount"
                value={formatWithCommas(formData.totalAmount)}
                readOnly
                className={inputClass + " bg-gray-50 border-gray-200 cursor-not-allowed"}
                placeholder="0.00"
              />
              <p className="text-[10px] text-[#92A2A5] mt-1 italic">Auto: Net + Tax</p>
            </div>
            <div>
              <label className={labelClass}>Net Amount (₹) <span className="text-[#E17F70]">*</span></label>
              <input
                type="text"
                name="netAmount"
                value={formatWithCommas(formData.netAmount)}
                onChange={handleChange}
                className={inputClass}
                placeholder="Enter net amount"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Tax Amount (₹)</label>
              <input
                type="text"
                name="taxAmount"
                value={formatWithCommas(formData.taxAmount)}
                onChange={handleChange}
                className={inputClass}
                placeholder="Enter tax amount"
              />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select name="type" value={formData.type} onChange={handleChange} className={selectClass}>
                <option value="NB">NB</option>
                <option value="LCS">LCS</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[#AEBFC3]/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
             <div>
              <label className={labelClass}>Milestone Status</label>
              <select name="milestoneStatus" value={formData.milestoneStatus} onChange={handleChange} className={selectClass}>
                <option value="AWAITING_DELIVERY">Awaiting Delivery</option>
                <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
                <option value="FULLY_DELIVERED">Fully Delivered</option>
                <option value="EXPIRED">Expired</option>
                <option value="LINKED">Linked (Invoice Generated)</option>
              </select>
            </div>
          </div>

          <div className="mt-6 border-t border-[#AEBFC3]/20 pt-6">
            <h4 className="text-sm font-bold text-[#546A7A] uppercase tracking-wider mb-5 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#CE9F6B]/10">
                <User className="w-4 h-4 text-[#CE9F6B]" />
              </div>
              Supplemental Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className={labelClass}>Due Date (SAP)</label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Risk Class</label>
                <select name="riskClass" value={formData.riskClass} onChange={handleChange} className={selectClass}>
                  <option value="LOW">Low Risk</option>
                  <option value="MEDIUM">Medium Risk</option>
                  <option value="HIGH">High Risk</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Person In-Charge</label>
                <input
                  type="text"
                  name="personInCharge"
                  value={formData.personInCharge}
                  onChange={handleChange}
                  placeholder="Employee handling this"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Contact Number</label>
                <input
                  type="text"
                  name="contactNo"
                  value={formData.contactNo}
                  onChange={handleChange}
                  placeholder="Customer Phone"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Terms Builder */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <h3 className="text-lg font-bold text-[#546A7A] mb-2 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#E17F70] shadow-lg shadow-[#CE9F6B]/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            Milestone Payment Terms
          </h3>

          {/* Allocation Progress Bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#CE9F6B]" />
                <span className="text-sm font-bold text-[#546A7A]">Total Allocation</span>
                {totalAllocatedAmount > 0 && (
                  <span className="text-xs font-semibold text-[#82A094] bg-[#82A094]/10 px-2 py-0.5 rounded-full">
                    ₹{totalAllocatedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} / ₹{parseFloat(formData.totalAmount || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${totalPercentage > 100 ? 'text-red-500' : totalPercentage === 100 ? 'text-[#82A094]' : 'text-[#CE9F6B]'}`}>
                  {totalPercentage}%
                </span>
                <span className="text-xs text-[#92A2A5]">/ 100%</span>
                {totalPercentage > 100 && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Exceeds!</span>}
                {totalPercentage === 100 && <CheckCircle2 className="w-4 h-4 text-[#82A094]" />}
              </div>
            </div>
            <div className="relative h-3 bg-[#AEBFC3]/15 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                  totalPercentage > 100 ? 'bg-gradient-to-r from-red-400 to-red-500' :
                  totalPercentage === 100 ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]' :
                  totalPercentage >= 50 ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]' :
                  'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]'
                }`}
                style={{ width: `${Math.min(100, totalPercentage)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
              {/* Markers */}
              {[25, 50, 75].map((m) => (
                <div key={m} className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${m}%` }} />
              ))}
            </div>
          </div>

          {/* Add Term Header */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-[#546A7A]">
              Payment Terms
              {formData.milestoneTerms.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#CE9F6B]/10 text-[#976E44] text-xs font-bold">{formData.milestoneTerms.length} terms</span>
              )}
            </h4>
            <button
              type="button"
              onClick={addTerm}
              disabled={totalPercentage >= 100}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs transition-all duration-300 ${totalPercentage >= 100 ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] hover:shadow-lg hover:shadow-[#CE9F6B]/30 hover:-translate-y-0.5 active:scale-95'}`}
            >
              <Plus className="w-4 h-4" /> Add Term
            </button>
          </div>

          {/* Empty State */}
          {formData.milestoneTerms.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-[#CE9F6B]/20 rounded-2xl bg-[#CE9F6B]/[0.03] hover:bg-[#CE9F6B]/[0.06] transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CE9F6B]/20 to-[#E17F70]/20 flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-[#CE9F6B]/60" />
              </div>
              <p className="text-[#546A7A] font-semibold mb-1">No Payment Terms Yet</p>
              <p className="text-[#92A2A5] text-sm mb-4">Click &quot;Add Term&quot; to define milestone payment schedule</p>
              <button
                type="button"
                onClick={addTerm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#CE9F6B]/30 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" /> Add First Term
              </button>
            </div>
          )}

          {/* Term Cards */}
          <div className="space-y-3">
            {formData.milestoneTerms.map((term, index) => {
              const isOther = term.termType === 'OTHER';
              const hasTax = term.calculationBasis === 'TOTAL_AMOUNT';
              return (
                <div key={index} className="relative group/term p-4 rounded-xl bg-gray-50 border border-[#CE9F6B]/20 transition-all duration-300 hover:bg-white hover:shadow-md hover:border-[#CE9F6B]/50">
                  {/* Step Badge */}
                  <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-[#CE9F6B]/30 z-10">
                    {index + 1}
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-end pl-4">
                    <div className={isOther ? "col-span-2" : (hasTax ? "col-span-2" : "col-span-3")}>
                      <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block">Term Type</label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CE9F6B]" />
                        <select
                          value={term.termType}
                          onChange={(e) => updateTerm(index, 'termType', e.target.value)}
                          className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-[#CE9F6B]/30 text-xs font-bold text-[#546A7A] focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/10 focus:outline-none transition-all"
                        >
                          {termOptions
                            .filter(opt => opt.value === 'OTHER' || opt.value === term.termType || !usedTermTypes.includes(opt.value))
                            .map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isOther && (
                      <div className={hasTax ? "col-span-2" : "col-span-3"}>
                        <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block">
                          Manual Description
                        </label>
                        <input
                          type="text"
                          value={term.customLabel || ''}
                          onChange={(e) => updateTerm(index, 'customLabel', e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-[#CE9F6B]/30 bg-white text-xs font-bold text-[#546A7A] focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/10 outline-none transition-all"
                          placeholder="e.g. installation completion..."
                        />
                      </div>
                    )}

                    <div className={isOther ? "col-span-2" : (hasTax ? "col-span-2" : "col-span-3")}>
                      <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block text-center">{hasTax ? 'Net %' : '%'}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={term.percentage || ''}
                          onChange={(e) => updateTerm(index, 'percentage', e.target.value)}
                          min="0"
                          max="100"
                          className="w-full h-10 px-3 pr-8 rounded-lg border border-[#CE9F6B]/30 bg-white text-xs font-bold text-[#546A7A] text-right focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/10 outline-none transition-all"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#92A2A5]">%</span>
                      </div>
                      {(Number(term.percentage) > 0 && (parseFloat(formData.totalAmount) > 0 || parseFloat(formData.netAmount) > 0)) && (
                        <p className={`text-[9px] font-semibold mt-1 text-center ${hasTax ? 'text-[#82A094] bg-[#82A094]/10 rounded-full px-2 py-0.5' : 'text-[#82A094]'}`}>
                          {hasTax ? `Net: ₹${((parseFloat(formData.netAmount || '0') * (Number(term.percentage) || 0)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `= ₹${getTermAmount(term).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        </p>
                      )}
                    </div>

                    <div className={hasTax ? "col-span-2" : "col-span-3"}>
                      <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block text-center">Target Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#E17F70]" />
                        <input
                          type="date"
                          value={term.termDate ? term.termDate.split('T')[0] : ''}
                          onChange={(e) => updateTerm(index, 'termDate', e.target.value)}
                          className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-[#CE9F6B]/30 text-xs font-bold text-[#546A7A] focus:border-[#E17F70] focus:ring-2 focus:ring-[#E17F70]/10 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Calculation Basis - Pill Toggle */}
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block text-center">Calc. On</label>
                      <div className="flex h-10 rounded-lg border border-[#CE9F6B]/30 overflow-hidden bg-gray-50">
                        <button
                          type="button"
                          onClick={() => updateTerm(index, 'calculationBasis', 'NET_AMOUNT')}
                          className={`flex-1 text-[10px] font-bold transition-all duration-200 ${
                            (term.calculationBasis || 'NET_AMOUNT') === 'NET_AMOUNT'
                              ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-inner'
                              : 'text-[#92A2A5] hover:text-[#546A7A] hover:bg-white'
                          }`}
                        >
                          Net
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTerm(index, 'calculationBasis', 'TOTAL_AMOUNT')}
                          className={`flex-1 text-[10px] font-bold transition-all duration-200 border-l border-[#CE9F6B]/20 ${
                            term.calculationBasis === 'TOTAL_AMOUNT'
                              ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-inner'
                              : 'text-[#92A2A5] hover:text-[#546A7A] hover:bg-white'
                          }`}
                        >
                          Net + Tax
                        </button>
                      </div>
                    </div>

                    {/* Tax % field - only visible when Net + Tax is selected */}
                    {hasTax && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-[#E17F70] uppercase mb-1.5 ml-1 text-center">
                          Tax %
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={term.taxPercentage || ''}
                            onChange={(e) => updateTerm(index, 'taxPercentage', e.target.value)}
                            min="0"
                            max="100"
                            className="w-full h-10 px-3 pr-8 rounded-lg border border-[#E17F70]/30 bg-[#E17F70]/5 text-sm text-right font-bold transition-all focus:border-[#E17F70] focus:ring-2 focus:ring-[#E17F70]/10"
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E17F70]/60">%</span>
                        </div>
                        {(Number(term.taxPercentage) > 0 && parseFloat(formData.taxAmount || '0') > 0) && (
                          <p className="text-[9px] font-semibold text-[#E17F70] mt-1 text-center bg-[#E17F70]/8 rounded-full px-2 py-0.5">
                            Tax: ₹{((parseFloat(formData.taxAmount || '0') * (Number(term.taxPercentage) || 0)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        )}
                        {(Number(term.percentage) > 0 || Number(term.taxPercentage) > 0) && getTermAmount(term) > 0 && (
                          <p className="text-[9px] font-black text-white mt-1 text-center bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-full px-2 py-0.5 shadow-sm">
                            Total: ₹{getTermAmount(term).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="col-span-1 flex justify-center pb-1">
                      <button
                        type="button"
                        onClick={() => removeTerm(index)}
                        className="p-2 rounded-lg bg-white border border-[#E17F70]/20 text-[#E17F70] hover:bg-[#E17F70] hover:text-white transition-all duration-300 shadow-sm opacity-60 group-hover/term:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Manual Payment Terms Overview */}
          <div className="mt-6 pt-6 border-t border-[#AEBFC3]/20">
            <label className="block text-[#5D6E73] text-sm font-bold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#CE9F6B]" />
              Contractual Payment Terms (Full Summary)
            </label>
            <textarea
              name="actualPaymentTerms"
              value={formData.actualPaymentTerms}
              onChange={handleChange}
              rows={3}
              className="w-full p-4 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#CE9F6B] focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium text-sm hover:border-[#AEBFC3]/50"
              placeholder="e.g., 10% Advance against ABG, 60% on Dispatch, 30% after Installation..."
            />
            <p className="text-[10px] text-[#92A2A5] mt-2 italic">Copy-paste the exact terms from the PO or Contract for quick reference.</p>
          </div>
        </div>

        {/* SAP Reference Data */}
        <div className="bg-gradient-to-r from-[#F8FAFB] to-white rounded-2xl border border-[#AEBFC3]/20 p-6 hover:shadow-lg transition-all duration-300">
          <h3 className="text-sm font-bold text-[#546A7A] mb-4 uppercase tracking-wider flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#546A7A]/10">
              <FileText className="w-4 h-4 text-[#546A7A]" />
            </div>
            SAP Reference Data
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-white border border-[#AEBFC3]/10 hover:border-[#AEBFC3]/30 transition-all">
              <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">Total Amount</label>
              <p className="text-sm font-bold text-[#546A7A]">{formatARCurrency(Number(formData.totalAmount))}</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#AEBFC3]/10 hover:border-[#AEBFC3]/30 transition-all">
              <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">BP Code</label>
              <p className="text-sm font-bold text-[#546A7A]">{formData.bpCode}</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#AEBFC3]/10 hover:border-[#AEBFC3]/30 transition-all">
              <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">Invoice Date</label>
              <p className="text-sm font-bold text-[#546A7A]">{formData.invoiceDate}</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#AEBFC3]/10 hover:border-[#AEBFC3]/30 transition-all">
              <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">Customer</label>
              <p className="text-sm font-bold text-[#546A7A] truncate">{formData.customerName}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            href={`/finance/ar/milestones/${invoice!.id}`}
            className="px-8 py-3.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-semibold hover:bg-gray-50 hover:border-[#AEBFC3]/60 transition-all duration-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white font-bold shadow-lg hover:shadow-xl hover:shadow-[#CE9F6B]/30 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Milestone'}
          </button>
        </div>
      </form>
    </div>
  );
}
