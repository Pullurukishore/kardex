'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, PIC_OPTIONS } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, Sparkles, Upload, AlertCircle, IndianRupee, Calendar, Info, Truck, Plus, Trash2, User } from 'lucide-react';

export default function NewInvoicePage() {
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
    invoiceNumber: '',
    bpCode: '',
    customerName: '',
    poNo: '',
    totalAmount: '',
    netAmount: '',
    taxAmount: '',
    invoiceDate: '',
    dueDate: '',
    actualPaymentTerms: '',
    type: '' as any,
    emailId: '',
    mailToTSP: '',
    personInCharge: '',
    hasAPG: false,
    apgDraftDate: '',
    apgDraftNote: '',
    apgDraftSteps: [] as { id: string, date: string, note: string }[],
    apgIntermediateSteps: [] as { id: string, date: string, note: string }[],
    apgSignedDate: '',
    apgSignedNote: '',
    apgSignedSteps: [] as { id: string, date: string, note: string }[],
    hasPBG: false,
    pbgDraftDate: '',
    pbgDraftNote: '',
    pbgDraftSteps: [] as { id: string, date: string, note: string }[],
    pbgIntermediateSteps: [] as { id: string, date: string, note: string }[],
    pbgSignedDate: '',
    pbgSignedNote: '',
    pbgSignedSteps: [] as { id: string, date: string, note: string }[],
    // Delivery Tracking
    deliveryStatus: 'PENDING' as 'PENDING' | 'SENT' | 'DELIVERED' | 'ACKNOWLEDGED',
    modeOfDelivery: '',
    sentHandoverDate: '',
    impactDate: '',
  });

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

  const handleIntermediateStepChange = (type: 'apg' | 'pbg', stage: 'draft' | 'signed' | 'intermediate', index: number, field: 'date' | 'note', value: string) => {
    setFormData(prev => {
      const fieldName = `${type}${stage.charAt(0).toUpperCase() + stage.slice(1)}Steps` as keyof typeof formData;
      const steps = [...(prev[fieldName] as any[])];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, [fieldName]: steps };
    });
  };

  const addIntermediateStep = (type: 'apg' | 'pbg', stage: 'draft' | 'signed' | 'intermediate') => {
    setFormData(prev => {
      const fieldName = `${type}${stage.charAt(0).toUpperCase() + stage.slice(1)}Steps` as keyof typeof formData;
      const steps = [...(prev[fieldName] as any[])];
      steps.push({ id: Date.now().toString() + Math.random().toString(), date: '', note: '' });
      return { ...prev, [fieldName]: steps };
    });
  };

  const removeIntermediateStep = (type: 'apg' | 'pbg', stage: 'draft' | 'signed' | 'intermediate', index: number) => {
    setFormData(prev => {
      const fieldName = `${type}${stage.charAt(0).toUpperCase() + stage.slice(1)}Steps` as keyof typeof formData;
      const steps = [...(prev[fieldName] as any[])];
      steps.splice(index, 1);
      return { ...prev, [fieldName]: steps };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Required fields: invoiceNumber, bpCode, invoiceDate, totalAmount
    if (!formData.invoiceNumber || !formData.bpCode || !formData.invoiceDate || !formData.totalAmount) {
      setError('Please fill in all required fields: Doc. No., Customer Code, Document Date, and Amount');
      return;
    }

    try {
      setSaving(true);
      
      await arApi.createInvoice({
        invoiceNumber: formData.invoiceNumber,
        customerId: formData.bpCode,
        customerName: formData.customerName || '',
        poNo: formData.poNo || undefined,
        totalAmount: parseFloat(unformatNumber(formData.totalAmount) || '0'),
        netAmount: parseFloat(unformatNumber(formData.netAmount) || '0'),
        taxAmount: formData.taxAmount ? parseFloat(unformatNumber(formData.taxAmount) || '0') : undefined,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || undefined,
        invoiceType: 'REGULAR',
        actualPaymentTerms: formData.actualPaymentTerms || undefined,
        type: formData.type || undefined,
        emailId: formData.emailId || undefined,
        mailToTSP: undefined,
        personInCharge: formData.personInCharge || undefined,
        hasAPG: formData.hasAPG,
        apgDraftDate: formData.apgDraftDate || undefined,
        apgDraftNote: formData.apgDraftNote || undefined,
        apgDraftSteps: formData.apgDraftSteps,
        apgIntermediateSteps: formData.apgIntermediateSteps,
        apgSignedDate: formData.apgSignedDate || undefined,
        apgSignedNote: formData.apgSignedNote || undefined,
        apgSignedSteps: formData.apgSignedSteps,
        hasPBG: formData.hasPBG,
        pbgDraftDate: formData.pbgDraftDate || undefined,
        pbgDraftNote: formData.pbgDraftNote || undefined,
        pbgDraftSteps: formData.pbgDraftSteps,
        pbgIntermediateSteps: formData.pbgIntermediateSteps,
        pbgSignedDate: formData.pbgSignedDate || undefined,
        pbgSignedNote: formData.pbgSignedNote || undefined,
        pbgSignedSteps: formData.pbgSignedSteps,
        // Delivery Tracking
        deliveryStatus: formData.deliveryStatus,
        modeOfDelivery: formData.modeOfDelivery || undefined,
        sentHandoverDate: formData.sentHandoverDate || undefined,
        impactDate: formData.impactDate || undefined,
      } as any);
      
      router.push('/finance/ar/invoices');
    } catch (err: any) {
      console.error('Create invoice error:', err);
      setError(err.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#E17F70] focus:outline-none focus:ring-3 focus:ring-[#E17F70]/15 transition-all duration-300 font-medium hover:border-[#AEBFC3]/50";
  const labelClass = "flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider";

  return (
    <div className="space-y-6 w-full relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-gradient-to-br from-[#E17F70]/15 to-[#9E3B47]/10 rounded-full blur-[8rem] opacity-50" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-[6rem] opacity-50" />
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#E17F70] via-[#9E3B47] to-[#CE9F6B] p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#EEC1BF] via-white/40 to-[#9E3B47]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-48 h-48 border-4 border-white rounded-full" />
        </div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/30 transition-all duration-300 hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                New AR Invoice
                <Sparkles className="w-6 h-6 text-white/80 animate-pulse" />
              </h1>
              <p className="text-white/80 text-sm mt-1">Create a regular AR invoice manually</p>
            </div>
          </div>
          <Link 
            href="/finance/ar/import"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#E17F70] font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <Upload className="w-4 h-4" />
            Import from Excel
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {error && (
          <div className="relative flex items-center gap-3 p-4 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-2 border-[#E17F70]/30 rounded-xl text-[#9E3B47] font-bold overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-[#9E3B47] to-[#75242D]" />
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#E17F70] to-[#9E3B47]">
              <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
            </div>
            <span className="flex-1 text-sm">{error}</span>
          </div>
        )}

        {/* Info Banner */}
        <div className="relative flex items-start gap-3 p-5 bg-gradient-to-r from-[#546A7A]/5 to-[#6F8A9D]/5 border-2 border-[#546A7A]/20 rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] shadow-lg shadow-[#546A7A]/20">
            <Info className="w-5 h-5 text-white mt-0.5" />
          </div>
          <div>
            <p className="text-[#546A7A] font-bold text-sm">Regular Invoice Requirements</p>
            <p className="text-[#92A2A5] text-xs mt-1">
              Doc. No., Customer Code, Document Date, and Amount are mandatory fields.
            </p>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#E17F70]/30 p-6 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-[#9E3B47] to-[#CE9F6B]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] shadow-lg shadow-[#E17F70]/20 group-hover:shadow-[#E17F70]/40 transition-all duration-300">
              <FileText className="w-5 h-5 text-white" />
            </div>
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#E17F70] to-[#9E3B47]"><FileText className="w-3 h-3 text-white" /></div>
                Doc. No. (Invoice #) <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="INV/2024/001"
                required
              />
            </div>



            <div>
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]"><IndianRupee className="w-3 h-3 text-white" /></div>
                Customer Code <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="text"
                name="bpCode"
                value={formData.bpCode}
                onChange={handleChange}
                className={inputClass}
                placeholder="C00123"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Customer Name</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                className={inputClass}
                placeholder="Customer Name (Optional)"
              />
            </div>

            <div>
              <label className={labelClass}>Email ID</label>
              <input
                type="email"
                name="emailId"
                value={formData.emailId}
                onChange={handleChange}
                className={inputClass}
                placeholder="customer@example.com"
              />
            </div>

            <div>
              <label className={labelClass}>
                <User className="w-3 h-3 text-[#E17F70]" />
                Kardex Person In-Charge
              </label>
              <select
                name="personInCharge"
                value={formData.personInCharge}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Select Person</option>
                {PIC_OPTIONS.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#976E44] to-[#CE9F6B]"><FileText className="w-3 h-3 text-white" /></div>
                Customer PO Ref.
              </label>
              <input
                type="text"
                name="poNo"
                value={formData.poNo}
                onChange={handleChange}
                className={inputClass}
                placeholder="PO Number (Optional)"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><Calendar className="w-3 h-3 text-white" /></div>
                Document Date <span className="text-[#E17F70]">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CE9F6B]" />
                <input
                  type="date"
                  name="invoiceDate"
                  value={formData.invoiceDate}
                  onChange={handleChange}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#CE9F6B] focus:outline-none focus:ring-2 focus:ring-[#CE9F6B]/10 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#E17F70] to-[#9E3B47]"><Calendar className="w-3 h-3 text-white" /></div>
                Due Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E17F70]" />
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-gradient-to-r from-[#E17F70]/5 to-[#9E3B47]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70] focus:outline-none focus:ring-2 focus:ring-[#E17F70]/10 transition-all font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Details */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#82A094]/30 p-6 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20 group-hover:shadow-[#82A094]/40 transition-all duration-300">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            Financial Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
               <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                 <div className="p-1 rounded-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]"><FileText className="w-3 h-3 text-white" /></div>
                 Category <span className="text-[#E17F70]">*</span>
               </label>
               <select name="type" value={formData.type} onChange={handleChange} className={inputClass} required>
                 <option value="">Select Category</option>
                 <option value="LCS">LCS</option>
                 <option value="NB">NB</option>
                 <option value="FINANCE">Finance</option>
               </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5]"><IndianRupee className="w-3 h-3 text-white" /></div>
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
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64]"><IndianRupee className="w-3 h-3 text-white" /></div>
                Net Amount (₹) <span className="text-[#E17F70]">*</span>
              </label>
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
              <label className="flex items-center gap-1.5 text-[#5D6E73] text-xs font-bold mb-2 uppercase tracking-wider">
                <div className="p-1 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><IndianRupee className="w-3 h-3 text-white" /></div>
                Tax Amount (₹)
              </label>
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

        {/* Delivery Tracking */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#6F8A9D]/30 p-6 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#AEBFC3]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20 group-hover:shadow-[#6F8A9D]/40 transition-all duration-300">
              <Truck className="w-5 h-5 text-white" />
            </div>
            Delivery Tracking
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Delivery Status ( yes / no )</label>
              <select 
                name="deliveryStatus" 
                value={formData.deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'PENDING'} 
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryStatus: e.target.value as any }))}
                className={inputClass}
              >
                <option value="PENDING">No (Pending)</option>
                <option value="DELIVERED">Yes (Delivered)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Delivery details ( all types suport )</label>
              <input
                type="text"
                name="modeOfDelivery"
                value={formData.modeOfDelivery}
                onChange={handleChange}
                placeholder="Courier, Hand Delivery, etc."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Handover date</label>
              <input
                type="date"
                name="sentHandoverDate"
                value={formData.sentHandoverDate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>GRN / Delivered date</label>
              <input
                type="date"
                name="impactDate"
                value={formData.impactDate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Guarantees Tracking */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#546A7A]/30 p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] shadow-lg shadow-[#546A7A]/20 hover:shadow-[#546A7A]/40 transition-all duration-300">
              <FileText className="w-5 h-5 text-white" />
            </div>
            Guarantees Tracking
          </h3>
          
          <div className="space-y-6">
            {/* APG Section */}
            <div className="p-5 rounded-2xl border-2 border-[#AEBFC3]/30 bg-gradient-to-r from-[#546A7A]/5 to-[#6F8A9D]/5 hover:border-[#E17F70]/40 transition-all duration-300">
              <label className="flex items-center gap-3 cursor-pointer mb-2">
                <input 
                  type="checkbox" 
                  name="hasAPG"
                  checked={formData.hasAPG}
                  onChange={(e) => setFormData(prev => ({ ...prev, hasAPG: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-2 border-[#AEBFC3] text-[#E17F70] focus:ring-[#E17F70]/20 transition-all"
                />
                <span className="font-bold text-[#546A7A] text-lg">ABG Advance Bank Guarantee</span>
              </label>
              
              {formData.hasAPG && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-8 border-l-2 border-[#E17F70]/30 ml-2 mt-5 py-2">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-[#CE9F6B] uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#CE9F6B]" /> Draft Stage
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/40 p-4 rounded-xl border border-[#CE9F6B]/20">
                      <div>
                        <label className={labelClass}>Draft Date</label>
                        <input type="date" name="apgDraftDate" value={formData.apgDraftDate} onChange={handleChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Draft Note</label>
                        <input type="text" name="apgDraftNote" value={formData.apgDraftNote} onChange={handleChange} className={inputClass} placeholder="Initial draft details..." />
                      </div>
                    </div>

                    {formData.apgDraftSteps.map((step, idx) => (
                      <div key={step.id} className="space-y-4 relative bg-white/50 p-4 rounded-xl border border-[#CE9F6B]/20">
                        <button 
                          type="button"
                          onClick={() => removeIntermediateStep('apg', 'draft', idx)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-[#E17F70] hover:bg-[#E17F70]/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <h4 className="text-xs font-bold text-[#CE9F6B]/70 uppercase tracking-widest leading-none mb-1">Draft Tracking Step {idx + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={labelClass}>Step Date</label>
                            <input type="date" value={step.date} onChange={e => handleIntermediateStepChange('apg', 'draft', idx, 'date', e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Step Note</label>
                            <input type="text" value={step.note} onChange={e => handleIntermediateStepChange('apg', 'draft', idx, 'note', e.target.value)} className={inputClass} placeholder="Step detail..." />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      type="button"
                      onClick={() => addIntermediateStep('apg', 'draft')}
                      className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-[#CE9F6B]/30 text-[#CE9F6B] hover:bg-[#CE9F6B]/5 transition-all font-bold text-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Draft Tracking Step
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-[#82A094] uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#82A094]" /> Signed Stage
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/40 p-4 rounded-xl border border-[#82A094]/20">
                      <div>
                        <label className={labelClass}>Signed Date</label>
                        <input type="date" name="apgSignedDate" value={formData.apgSignedDate} onChange={handleChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Signed Note</label>
                        <input type="text" name="apgSignedNote" value={formData.apgSignedNote} onChange={handleChange} className={inputClass} placeholder="Final signed details..." />
                      </div>
                    </div>

                    {formData.apgSignedSteps.map((step, idx) => (
                      <div key={step.id} className="space-y-4 relative bg-white/50 p-4 rounded-xl border border-[#82A094]/20">
                        <button 
                          type="button"
                          onClick={() => removeIntermediateStep('apg', 'signed', idx)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-[#E17F70] hover:bg-[#E17F70]/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <h4 className="text-xs font-bold text-[#82A094]/70 uppercase tracking-widest leading-none mb-1">Signed Tracking Step {idx + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={labelClass}>Step Date</label>
                            <input type="date" value={step.date} onChange={e => handleIntermediateStepChange('apg', 'signed', idx, 'date', e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Step Note</label>
                            <input type="text" value={step.note} onChange={e => handleIntermediateStepChange('apg', 'signed', idx, 'note', e.target.value)} className={inputClass} placeholder="Step detail..." />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      type="button"
                      onClick={() => addIntermediateStep('apg', 'signed')}
                      className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-[#82A094]/30 text-[#82A094] hover:bg-[#82A094]/5 transition-all font-bold text-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Signed Tracking Step
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PBG Section */}
            <div className="p-5 rounded-2xl border-2 border-[#AEBFC3]/30 bg-gradient-to-r from-[#546A7A]/5 to-[#6F8A9D]/5 hover:border-[#CE9F6B]/40 transition-all duration-300">
              <label className="flex items-center gap-3 cursor-pointer mb-2">
                <input 
                  type="checkbox" 
                  name="hasPBG"
                  checked={formData.hasPBG}
                  onChange={(e) => setFormData(prev => ({ ...prev, hasPBG: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-2 border-[#AEBFC3] text-[#CE9F6B] focus:ring-[#CE9F6B]/20 transition-all"
                />
                <span className="font-bold text-[#546A7A] text-lg">Performance Bank Guarantee (PBG)</span>
              </label>
              
              {formData.hasPBG && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-8 border-l-2 border-[#CE9F6B]/30 ml-2 mt-5 py-2">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-[#CE9F6B] uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#CE9F6B]" /> Draft Stage
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/40 p-4 rounded-xl border border-[#CE9F6B]/20">
                      <div>
                        <label className={labelClass}>Draft Date</label>
                        <input type="date" name="pbgDraftDate" value={formData.pbgDraftDate} onChange={handleChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Draft Note</label>
                        <input type="text" name="pbgDraftNote" value={formData.pbgDraftNote} onChange={handleChange} className={inputClass} placeholder="Initial draft details..." />
                      </div>
                    </div>

                    {formData.pbgDraftSteps.map((step, idx) => (
                      <div key={step.id} className="space-y-4 relative bg-white/50 p-4 rounded-xl border border-[#CE9F6B]/20">
                        <button 
                          type="button"
                          onClick={() => removeIntermediateStep('pbg', 'draft', idx)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-[#E17F70] hover:bg-[#E17F70]/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <h4 className="text-xs font-bold text-[#CE9F6B]/70 uppercase tracking-widest leading-none mb-1">Draft Tracking Step {idx + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={labelClass}>Step Date</label>
                            <input type="date" value={step.date} onChange={e => handleIntermediateStepChange('pbg', 'draft', idx, 'date', e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Step Note</label>
                            <input type="text" value={step.note} onChange={e => handleIntermediateStepChange('pbg', 'draft', idx, 'note', e.target.value)} className={inputClass} placeholder="Step detail..." />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      type="button"
                      onClick={() => addIntermediateStep('pbg', 'draft')}
                      className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-[#CE9F6B]/30 text-[#CE9F6B] hover:bg-[#CE9F6B]/5 transition-all font-bold text-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Draft Tracking Step
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-[#82A094] uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#82A094]" /> Signed Stage
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/40 p-4 rounded-xl border border-[#82A094]/20">
                      <div>
                        <label className={labelClass}>Signed Date</label>
                        <input type="date" name="pbgSignedDate" value={formData.pbgSignedDate} onChange={handleChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Signed Note</label>
                        <input type="text" name="pbgSignedNote" value={formData.pbgSignedNote} onChange={handleChange} className={inputClass} placeholder="Final signed details..." />
                      </div>
                    </div>

                    {formData.pbgSignedSteps.map((step, idx) => (
                      <div key={step.id} className="space-y-4 relative bg-white/50 p-4 rounded-xl border border-[#82A094]/20">
                        <button 
                          type="button"
                          onClick={() => removeIntermediateStep('pbg', 'signed', idx)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-[#E17F70] hover:bg-[#E17F70]/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <h4 className="text-xs font-bold text-[#82A094]/70 uppercase tracking-widest leading-none mb-1">Signed Tracking Step {idx + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={labelClass}>Step Date</label>
                            <input type="date" value={step.date} onChange={e => handleIntermediateStepChange('pbg', 'signed', idx, 'date', e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Step Note</label>
                            <input type="text" value={step.note} onChange={e => handleIntermediateStepChange('pbg', 'signed', idx, 'note', e.target.value)} className={inputClass} placeholder="Step detail..." />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      type="button"
                      onClick={() => addIntermediateStep('pbg', 'signed')}
                      className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-[#82A094]/30 text-[#82A094] hover:bg-[#82A094]/5 transition-all font-bold text-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Signed Tracking Step
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#AEBFC3]/30 p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#AEBFC3] via-[#92A2A5] to-[#5D6E73]" />
          <label className="flex items-center gap-2 text-[#5D6E73] text-xs font-bold mb-3 uppercase tracking-wider">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5]"><FileText className="w-3.5 h-3.5 text-white" /></div>
            Payment Terms (Optional)
          </label>
          <textarea
            name="actualPaymentTerms"
            value={formData.actualPaymentTerms}
            onChange={handleChange}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#AEBFC3] focus:outline-none focus:ring-2 focus:ring-[#AEBFC3]/10 min-h-[100px] transition-all font-medium"
            placeholder="Enter specific payment terms here..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-8 py-3.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-bold hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/60 transition-all duration-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white font-bold shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:shadow-[#E17F70]/30 transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
