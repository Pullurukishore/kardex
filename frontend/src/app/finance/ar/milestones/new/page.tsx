'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, MilestonePaymentTerm, TSP_OPTIONS } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, Sparkles, AlertCircle, IndianRupee, Calendar, Info, Wallet, Plus, Trash2, Tag, X, CheckCircle2, BarChart3 } from 'lucide-react';

export default function NewMilestonePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    bpCode: '',
    customerName: '',
    poNo: '',
    soNo: '',
    totalAmount: '',
    netAmount: '',
    taxAmount: '',
    invoiceDate: '', // Invoice Date
    milestoneTerms: [] as MilestonePaymentTerm[],
    actualPaymentTerms: '',
    type: '' as any,
    accountingStatus: '' as '' | 'REVENUE_RECOGNISED' | 'BACKLOG',
    mailToTSP: '',
    invoiceNumber: '',
    bookingMonth: '',
    emailId: '',
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
    
    // Validation for percentage - cap so total never exceeds 100%
    if (field === 'percentage') {
      const numValue = parseFloat(value as string);
      if (!isNaN(numValue)) {
        const othersTotal = formData.milestoneTerms.reduce((sum, t, i) => i === index ? sum : sum + (Number(t.percentage) || 0), 0);
        const maxAllowed = Math.max(0, 100 - othersTotal);
        finalValue = Math.min(maxAllowed, Math.max(0, numValue));
      } else if (value === '') {
        finalValue = 0;
      }
    }
    if (field === 'taxPercentage') {
      const numValue = parseFloat(value as string);
      if (!isNaN(numValue)) {
        const othersTotal = formData.milestoneTerms.reduce((sum, t, i) => i === index ? sum : sum + (Number(t.taxPercentage) || 0), 0);
        const maxAllowed = Math.max(0, 100 - othersTotal);
        finalValue = Math.min(maxAllowed, Math.max(0, numValue));
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
  const totalTaxPercentage = formData.milestoneTerms.reduce((sum, term) => sum + (Number(term.taxPercentage) || 0), 0);

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
    setError(null);

    const rawTotal = parseFloat(unformatNumber(formData.totalAmount) || '0');
    if (rawTotal <= 0) {
      setError('Please fill in a valid amount');
      return;
    }

    if (!formData.soNo) {
      setError('Kardex SO number is required for milestone payments');
      return;
    }
    if (!formData.poNo) {
      setError('Kardex PO number is required for milestone payments');
      return;
    }
    if (!formData.bpCode) {
      setError('Customer Code is required');
      return;
    }
    if (!formData.customerName) {
      setError('Customer Name is required');
      return;
    }
    if (formData.milestoneTerms.length === 0) {
      setError('At least one payment term is required for milestone payments');
      return;
    }

    if (totalPercentage !== 100) {
      setError('Net allocation must be exactly 100%. Currently at ' + totalPercentage + '%');
      return;
    }
    const hasAnyTaxTerm = formData.milestoneTerms.some(t => t.calculationBasis === 'TOTAL_AMOUNT');
    const taxAmt = parseFloat(formData.taxAmount || '0');
    if (hasAnyTaxTerm && taxAmt > 0 && totalTaxPercentage > 100) {
      setError('Total tax percentage allocation cannot exceed 100%');
      return;
    }
    // Removed mandatory date check for consistency with edit page

    try {
      setSaving(true);
      
      await arApi.createInvoice({
        invoiceNumber: formData.invoiceNumber,
        customerId: formData.bpCode, // Explicitly send as customerId for backend compatibility
        bpCode: formData.bpCode,
        customerName: formData.customerName || '',
        poNo: formData.poNo,
        soNo: formData.soNo,
        totalAmount: parseFloat(unformatNumber(formData.totalAmount) || '0'),
        netAmount: parseFloat(unformatNumber(formData.netAmount) || '0'),
        taxAmount: formData.taxAmount ? parseFloat(unformatNumber(formData.taxAmount) || '0') : undefined,
        invoiceDate: formData.invoiceDate,
        // Milestone fields
        invoiceType: 'MILESTONE',
        milestoneTerms: formData.milestoneTerms,
        actualPaymentTerms: formData.actualPaymentTerms || undefined,
        type: formData.type || undefined,
        accountingStatus: formData.accountingStatus || undefined,
        mailToTSP: formData.mailToTSP,
        bookingMonth: formData.bookingMonth || undefined,
        emailId: formData.emailId || undefined,
      } as any);
      router.push('/finance/ar/milestones');
    } catch (err: any) {
      setError(err.message || 'Failed to create milestone payment');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all duration-300 font-medium hover:border-[#AEBFC3]/50";
  const labelClass = "block text-[#5D6E73] text-sm font-semibold mb-2";

  // Count filled fields for progress
  const requiredFilled = [formData.soNo, formData.poNo, formData.bpCode, formData.customerName, formData.totalAmount].filter(Boolean).length;
  const formProgress = Math.round((requiredFilled / 5) * 100);

  return (
    <div className="space-y-6 relative w-full pb-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
        <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-gradient-to-br from-[#E17F70]/15 to-[#CE9F6B]/15 rounded-full blur-[8rem] opacity-40" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-[6rem] opacity-40" />
      </div>
      
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#E17F70] p-6 shadow-2xl shadow-[#CE9F6B]/20 group">
        {/* Animated Pattern Overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-8 left-12 w-56 h-56 border-4 border-white/30 rounded-full" />
          <div className="absolute top-12 left-1/4 w-20 h-20 border-2 border-white/40 rounded-full" />
        </div>
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer-slide_4s_ease-in-out_infinite]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-white hover:bg-white/25 transition-all duration-300 shadow-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative p-3 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl transition-transform hover:rotate-3">
              <Wallet className="w-6 h-6 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#A2B9AF] rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                New Milestone Payment
                <Sparkles className="w-6 h-6 text-white/80 animate-pulse" />
              </h1>
              <p className="text-white/70 text-sm mt-1">Create a new milestone payment tracking record</p>
            </div>
          </div>
          {/* Mini Progress Indicator */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Form Progress</p>
              <p className="text-white text-lg font-bold">{formProgress}%</p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="4" strokeDasharray={`${formProgress * 1.76} 176`} strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className={`w-5 h-5 transition-all duration-300 ${formProgress === 100 ? 'text-white scale-110' : 'text-white/40'}`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {/* Error Banner */}
        {error && (
          <div className="relative flex items-center gap-3 p-4 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-2 border-[#E17F70]/30 rounded-xl text-[#9E3B47] font-medium animate-shake shadow-lg shadow-[#E17F70]/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]" />
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] shadow-lg shadow-[#E17F70]/20">
              <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
            </div>
            <span className="flex-1 text-sm font-bold">{error}</span>
            <button type="button" onClick={() => setError(null)} className="p-2 rounded-lg bg-white/50 hover:bg-white text-[#9E3B47] transition-colors border border-[#E17F70]/20">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Info Banner */}
        <div className="relative flex items-start gap-4 p-5 bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 border-2 border-[#CE9F6B]/30 rounded-xl hover:border-[#CE9F6B]/40 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[#976E44] font-bold text-sm">Milestone Payment Requirements</p>
            <p className="text-[#92A2A5] text-xs mt-1">
              Kardex SO number, Kardex PO number, Customer details, and Amount are mandatory. Add at least one payment term.
            </p>
          </div>
        </div>

        {/* Core Order Information */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl border-2 border-[#CE9F6B]/30 p-6 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20 group-hover:shadow-[#CE9F6B]/40 group-hover:scale-110 transition-all duration-300">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            Order & Customer Info
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>
                Kardex SO number <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="text"
                name="soNo"
                value={formData.soNo}
                onChange={handleChange}
                className={inputClass}
                placeholder="SO-12345"
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                Kardex PO number <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="text"
                name="poNo"
                value={formData.poNo}
                onChange={handleChange}
                className={inputClass}
                placeholder="PO-12345"
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                Customer Code <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="text"
                name="bpCode"
                value={formData.bpCode}
                onChange={handleChange}
                className={inputClass}
                placeholder="CUST001"
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                Invoice No
              </label>
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
              <label className={labelClass}>
                Customer Name <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                className={inputClass}
                placeholder="Customer Name"
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                Invoice Date
              </label>
              <input
                type="date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Booking Month
              </label>
              <input
                type="month"
                name="bookingMonth"
                value={formData.bookingMonth}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Accounting Status
              </label>
              <select 
                name="accountingStatus" 
                value={formData.accountingStatus} 
                onChange={handleChange} 
                className={inputClass}
              >
                <option value="">Select Status</option>
                <option value="REVENUE_RECOGNISED">Revenue Recognised</option>
                <option value="BACKLOG">Backlog</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                TSP
              </label>
              <select
                name="mailToTSP"
                value={formData.mailToTSP}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Select TSP</option>
                {TSP_OPTIONS.map(tsp => (
                  <option key={tsp} value={tsp}>{tsp}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Email ID
              </label>
              <input
                type="email"
                name="emailId"
                value={formData.emailId}
                onChange={handleChange}
                className={inputClass}
                placeholder="customer@example.com"
              />
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl border-2 border-[#82A094]/30 p-6 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20 group-hover:shadow-[#82A094]/40 group-hover:scale-110 transition-all duration-300">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            Financial Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
               <label className={labelClass}>Category</label>
               <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
                 <option value="">Select Category</option>
                 <option value="LCS">LCS</option>
                 <option value="NB">NB</option>
                 <option value="FINANCE">Finance</option>
               </select>
            </div>
            <div>
              <label className={labelClass}>
                Total Amount (₹) <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="text"
                name="totalAmount"
                value={formatWithCommas(formData.totalAmount)}
                readOnly
                className={inputClass + " bg-gray-50 border-gray-200 cursor-not-allowed"}
                placeholder="0.00"
                required
              />
              <p className="text-[10px] text-[#92A2A5] mt-1 italic">Auto-calculated: Net + Tax</p>
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
        </div>
      </div>

        {/* Milestone Terms Builder */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl border-2 border-[#CE9F6B]/30 p-6 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-2 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            Milestone Payment Terms
          </h3>

          {/* Allocation Overview Bar */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 bg-gradient-to-r from-[#82A094]/15 to-[#82A094]/5 rounded-xl border border-[#82A094]/30 shadow-inner">
            <div className="flex items-center gap-3 mb-3 sm:mb-0">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <BarChart3 className="w-5 h-5 text-[#4F6A64]" />
              </div>
              <div>
                <span className="block text-sm font-bold text-[#4F6A64]">Total Value Allocation</span>
                <span className="text-[10px] text-[#4F6A64]/70 uppercase font-bold tracking-wider">Net + Tax</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-[#4F6A64] bg-white px-3 py-1.5 rounded-lg shadow-sm border border-[#82A094]/20">
                ₹{totalAllocatedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-[#82A094] mx-1">/</span> ₹{parseFloat(formData.totalAmount || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              {totalPercentage > 100 && (
                  <span className="text-xs font-bold text-white bg-gradient-to-r from-[#E17F70] to-[#9E3B47] px-3 py-1.5 rounded-lg shadow-md animate-pulse hidden sm:block">Exceeds limits!</span>
              )}
            </div>
          </div>

          {/* Allocation Progress Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Net Allocation Progress Bar */}
            <div className="bg-[#AEBFC3]/5 p-4 rounded-xl border border-[#AEBFC3]/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#CE9F6B]" />
                  <span className="text-sm font-bold text-[#546A7A]">Net Allocation</span>
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
              <div className="relative h-2.5 bg-[#AEBFC3]/15 rounded-full overflow-hidden">
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

            {/* Tax Allocation Progress Bar */}
            {(() => {
              const taxAmt = parseFloat(formData.taxAmount || '0');
              const hasAnyTaxTerm = formData.milestoneTerms.some(t => t.calculationBasis === 'TOTAL_AMOUNT');
              const showTaxBar = taxAmt > 0 && hasAnyTaxTerm;
              
              if (!showTaxBar) {
                return (
                  <div className="bg-[#AEBFC3]/5 p-4 rounded-xl border border-[#AEBFC3]/15">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#AEBFC3]" />
                        <span className="text-sm font-bold text-[#92A2A5]">Tax Allocation</span>
                      </div>
                      <span className="text-xs font-bold text-[#92A2A5] bg-[#AEBFC3]/10 px-3 py-1 rounded-full">
                        {taxAmt === 0 ? 'No Tax Applied' : 'Select Net + Tax on a term'}
                      </span>
                    </div>
                    <div className="relative h-2.5 bg-[#AEBFC3]/10 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-0 rounded-full" />
                    </div>
                    {taxAmt === 0 && (
                      <p className="text-[10px] text-[#92A2A5] mt-2 italic text-center">Enter a tax amount and set terms to &quot;Net + Tax&quot; to enable tax allocation</p>
                    )}
                  </div>
                );
              }
              
              return (
                <div className="bg-[#E17F70]/5 p-4 rounded-xl border border-[#E17F70]/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#E17F70]" />
                      <span className="text-sm font-bold text-[#9E3B47]">Tax Allocation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black ${totalTaxPercentage > 100 ? 'text-red-500' : totalTaxPercentage === 100 ? 'text-[#82A094]' : 'text-[#E17F70]'}`}>
                        {totalTaxPercentage}%
                      </span>
                      <span className="text-xs text-[#92A2A5]">/ 100%</span>
                      {totalTaxPercentage > 100 && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Exceeds!</span>}
                      {totalTaxPercentage === 100 && <CheckCircle2 className="w-4 h-4 text-[#82A094]" />}
                    </div>
                  </div>
                  <div className="relative h-2.5 bg-[#E17F70]/15 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                        totalTaxPercentage > 100 ? 'bg-gradient-to-r from-red-400 to-red-500' :
                        totalTaxPercentage === 100 ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]' :
                        totalTaxPercentage >= 50 ? 'bg-gradient-to-r from-[#E17F70] to-[#E17F70]' :
                        'bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]'
                      }`}
                      style={{ width: `${Math.min(100, totalTaxPercentage)}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </div>
                    {[25, 50, 75].map((m) => (
                      <div key={m} className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${m}%` }} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>


          {/* Add Term Button */}
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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all duration-300 ${totalPercentage >= 100 ? 'bg-gray-300 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] hover:shadow-lg hover:shadow-[#CE9F6B]/30 hover:-translate-y-0.5 active:scale-95'}`}
            >
              <Plus className="w-3.5 h-3.5" /> {totalPercentage >= 100 ? 'All 100% Allocated' : 'Add Term'}
            </button>
          </div>

          {/* Empty State */}
          {formData.milestoneTerms.length === 0 && (
            <div className="relative text-center py-12 border-2 border-dashed border-[#CE9F6B]/30 rounded-2xl bg-gradient-to-br from-[#CE9F6B]/5 to-[#976E44]/5 hover:from-[#CE9F6B]/10 hover:to-[#976E44]/10 transition-colors overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#CE9F6B]/20">
                <Tag className="w-8 h-8 text-white" />
              </div>
              <p className="text-[#546A7A] font-bold mb-1">No Payment Terms Yet</p>
              <p className="text-[#92A2A5] text-sm mb-4">Click &quot;Add Term&quot; to define milestone payment schedule</p>
              <button
                type="button"
                onClick={addTerm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#CE9F6B]/30 transition-all hover:-translate-y-0.5 active:scale-95"
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
                <div key={index} className="relative flex flex-col gap-3 bg-white p-4 rounded-xl border-2 border-[#AEBFC3]/30 shadow-sm transition-all duration-300 hover:border-[#CE9F6B]/40 hover:shadow-lg hover:shadow-[#CE9F6B]/10 group/term overflow-hidden">
                  {/* Top Accent Bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
                  {/* Step Badge */}
                  <div className="absolute -left-2 top-3 w-7 h-7 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white text-xs font-bold flex items-center justify-center shadow-lg shadow-[#CE9F6B]/30">
                    {index + 1}
                  </div>

                  <div className="flex items-center gap-3 pl-5">
                    <div className="flex-1 grid grid-cols-12 gap-3 items-end">
                      <div className={isOther ? "col-span-2" : (hasTax ? "col-span-2" : "col-span-3")}>
                        <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1">
                          Term Type
                        </label>
                        <div className="relative">
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10 flex items-center justify-center">
                            <Tag className="w-3 h-3 text-[#976E44]" />
                          </div>
                          <select
                            value={term.termType}
                            onChange={(e) => updateTerm(index, 'termType', e.target.value)}
                            className="w-full h-10 pl-10 pr-3 rounded-lg border-2 border-[#AEBFC3]/30 text-sm font-bold text-[#546A7A] focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/10 transition-all bg-white"
                          >
                            {termOptions
                              .filter(opt => opt.value === 'OTHER' || opt.value === term.termType || !usedTermTypes.includes(opt.value))
                              .map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                      </div>
                      
                      {isOther && (
                        <div className={hasTax ? "col-span-2" : "col-span-3"}>
                          <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1">
                            Manual Description
                          </label>
                          <input
                            type="text"
                            value={term.customLabel || ''}
                            onChange={(e) => updateTerm(index, 'customLabel', e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border-2 border-[#CE9F6B]/30 bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 text-sm font-bold text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#CE9F6B] focus:outline-none focus:ring-2 focus:ring-[#CE9F6B]/10 transition-all"
                            placeholder="e.g., after installation..."
                          />
                        </div>
                      )}

                      <div className={isOther ? "col-span-2" : (hasTax ? "col-span-2" : "col-span-3")}>
                        <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1 text-center">
                          {hasTax ? 'Net %' : '%'}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={term.percentage || ''}
                            onChange={(e) => updateTerm(index, 'percentage', e.target.value)}
                            min="0"
                            max="100"
                            className="w-full h-10 px-3 pr-8 rounded-lg border-2 border-[#AEBFC3]/30 text-sm text-right font-bold text-[#546A7A] transition-all focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/10 bg-white"
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#CE9F6B]">%</span>
                        </div>
                        {(Number(term.percentage) > 0 && (parseFloat(formData.totalAmount) > 0 || parseFloat(formData.netAmount) > 0)) && (
                          <p className={`text-[9px] font-bold mt-1 text-center ${hasTax ? 'text-[#4F6A64] bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10 rounded-lg px-2 py-0.5 border border-[#82A094]/20' : 'text-[#4F6A64]'}`}>
                            {hasTax ? `Net: ₹${((parseFloat(formData.netAmount || '0') * (Number(term.percentage) || 0)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `= ₹${getTermAmount(term).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                          </p>
                        )}
                      </div>

                      <div className={hasTax ? "col-span-2" : "col-span-3"}>
                        <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1 text-center">
                          Target Date
                        </label>
                        <div className="relative">
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10 flex items-center justify-center">
                            <Calendar className="w-3 h-3 text-[#976E44]" />
                          </div>
                          <input
                            type="date"
                            value={term.termDate}
                            onChange={(e) => updateTerm(index, 'termDate', e.target.value)}
                            className="w-full h-10 pl-10 pr-3 rounded-lg border-2 border-[#AEBFC3]/30 text-sm font-bold text-[#546A7A] focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/10 transition-all bg-white"
                          />
                        </div>
                      </div>

                      {/* Calculation Basis - Pill Toggle */}
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1 text-center">
                          Calc. On
                        </label>
                        <div className="flex h-10 rounded-lg border-2 border-[#AEBFC3]/30 overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => updateTerm(index, 'calculationBasis', 'NET_AMOUNT')}
                            className={`flex-1 text-[10px] font-bold transition-all duration-200 ${
                              (term.calculationBasis || 'NET_AMOUNT') === 'NET_AMOUNT'
                                ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg'
                                : 'text-[#92A2A5] hover:text-[#546A7A] hover:bg-[#96AEC2]/10'
                            }`}
                          >
                            Net
                          </button>
                          <button
                            type="button"
                            disabled={!(parseFloat(formData.taxAmount || '0') > 0)}
                            onClick={() => updateTerm(index, 'calculationBasis', 'TOTAL_AMOUNT')}
                            title={!(parseFloat(formData.taxAmount || '0') > 0) ? "Enter a tax amount first" : ""}
                            className={`flex-1 text-[10px] font-bold transition-all duration-200 border-l-2 border-[#AEBFC3]/30 ${
                              term.calculationBasis === 'TOTAL_AMOUNT'
                                ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-lg'
                                : !(parseFloat(formData.taxAmount || '0') > 0)
                                ? 'text-[#AEBFC3]/50 bg-gray-50 cursor-not-allowed'
                                : 'text-[#92A2A5] hover:text-[#E17F70] hover:bg-[#E17F70]/10'
                            }`}
                          >
                            Net + Tax
                          </button>
                        </div>
                      </div>

                      {/* Tax % field - only visible when Net + Tax is selected */}
                      {hasTax && (
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-[#9E3B47] uppercase mb-1.5 ml-1 text-center">
                            Tax %
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={term.taxPercentage || ''}
                              onChange={(e) => updateTerm(index, 'taxPercentage', e.target.value)}
                              min="0"
                              max="100"
                              className="w-full h-10 px-3 pr-8 rounded-lg border-2 border-[#E17F70]/30 bg-gradient-to-r from-[#E17F70]/5 to-[#9E3B47]/5 text-sm text-right font-bold text-[#9E3B47] transition-all focus:border-[#E17F70] focus:ring-2 focus:ring-[#E17F70]/10"
                              placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E17F70]">%</span>
                          </div>
                          {(Number(term.taxPercentage) > 0 && parseFloat(formData.taxAmount || '0') > 0) && (
                            <p className="text-[9px] font-bold text-[#9E3B47] mt-1 text-center bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 rounded-lg px-2 py-0.5 border border-[#E17F70]/20">
                              Tax: ₹{((parseFloat(formData.taxAmount || '0') * (Number(term.taxPercentage) || 0)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                          )}
                          {(Number(term.percentage) > 0 || Number(term.taxPercentage) > 0) && getTermAmount(term) > 0 && (
                            <p className="text-[9px] font-bold text-white mt-1 text-center bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-lg px-2 py-0.5 shadow-lg">
                              Total: ₹{getTermAmount(term).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => removeTerm(index)} 
                      className="p-2.5 rounded-xl bg-gradient-to-br from-[#E17F70]/10 to-[#9E3B47]/5 text-[#9E3B47] hover:from-[#E17F70] hover:to-[#9E3B47] hover:text-white transition-all duration-300 mt-auto mb-0.5 opacity-60 group-hover/term:opacity-100 border-2 border-[#E17F70]/20 hover:border-[#E17F70]/40 shadow-sm hover:shadow-lg hover:shadow-[#E17F70]/20"
                      title="Remove term"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Manual Payment Terms Overview */}
          <div className="relative mt-6 pt-6 border-t-2 border-[#AEBFC3]/20 overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-1 bg-gradient-to-r from-[#CE9F6B] to-[#976E44]" />
            <label className="block text-[#5D6E73] text-sm font-bold mb-3 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]">
                <FileText className="w-4 h-4 text-white" />
              </div>
              Contractual Payment Terms (Full Summary)
            </label>
            <textarea
              name="actualPaymentTerms"
              value={formData.actualPaymentTerms}
              onChange={handleChange}
              rows={3}
              className="w-full p-4 rounded-xl bg-gradient-to-r from-white to-[#96AEC2]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#CE9F6B] focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium text-sm hover:border-[#CE9F6B]/40"
              placeholder="e.g., 10% Advance against ABG, 60% on Dispatch, 30% after Installation..."
            />
            <p className="text-[10px] text-[#92A2A5] mt-2 italic">Copy-paste the exact terms from the PO or Contract for quick reference.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="relative flex items-center justify-end gap-4 pt-2">
          <Link
            href="/finance/ar/milestones"
            className="px-8 py-3.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-bold hover:bg-[#96AEC2]/10 hover:border-[#6F8A9D] transition-all duration-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white font-bold shadow-lg shadow-[#CE9F6B]/20 hover:shadow-xl hover:shadow-[#CE9F6B]/30 transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Create Milestone Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
