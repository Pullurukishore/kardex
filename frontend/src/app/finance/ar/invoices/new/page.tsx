'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, Sparkles, Upload, AlertCircle, IndianRupee, Calendar, Info, Wallet } from 'lucide-react';

export default function NewInvoicePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedMilestones, setCheckedMilestones] = useState({
    ADVANCE: true,
    INVOICE: true,
    GRN: false,
    BG: false,
    OTHERS: false,
  });

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    bpCode: '',
    customerName: '',
    poNo: '',
    soNo: '',  // Sales Order Number for prepaid
    totalAmount: '',
    netAmount: '',
    taxAmount: '',
    invoiceDate: '',
    dueDate: '',
    // Prepaid fields
    invoiceType: 'PREPAID' as 'REGULAR' | 'PREPAID',
    advanceReceivedDate: '',
    deliveryDueDate: '',
    grnDate: '',
    bgDate: '',
    othersDate: '',
    agingMilestone: 'INVOICE' as 'ADVANCE' | 'INVOICE' | 'GRN' | 'BG' | 'OTHERS',
    actualPaymentTerms: '',
    type: '' as any,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Required fields: For regular - invoiceNumber, bpCode, invoiceDate, totalAmount
    // For prepaid - bpCode, invoiceDate, totalAmount (invoiceNumber is auto-generated if empty)
    const isRegular = formData.invoiceType === 'REGULAR';
    
    if (isRegular && !formData.invoiceNumber) {
      setError('Please fill in all required fields: Doc. No., Customer Code, Document Date, and Amount');
      return;
    }
    
    if (!formData.bpCode || !formData.invoiceDate || !formData.totalAmount) {
      setError('Please fill in all required fields: Customer Code, Document Date, and Amount');
      return;
    }

    // Validate prepaid-specific fields
    if (formData.invoiceType === 'PREPAID') {
      if (!formData.advanceReceivedDate) {
        setError('Advance Received Date is required for prepaid invoices');
        return;
      }
      if (!formData.soNo) {
        setError('SO Number is required for prepaid invoices');
        return;
      }
      if (!formData.poNo) {
        setError('PO Number is required for prepaid invoices');
        return;
      }
    }

    try {
      setSaving(true);
      // For prepaid: use PO number as reference (PRE-{poNo}) for easy identification
      const invoiceNumber = formData.invoiceNumber || 
        (formData.invoiceType === 'PREPAID' && formData.poNo 
          ? `PRE-${formData.poNo}` 
          : formData.invoiceType === 'PREPAID' 
            ? `PRE-${Date.now().toString(36).toUpperCase()}` // Fallback if no PO
            : undefined);
      
      await arApi.createInvoice({
        invoiceNumber: invoiceNumber!,
        customerId: formData.bpCode, // Backend expects customerId, maps to bpCode
        customerName: formData.customerName || '',
        poNo: formData.poNo || undefined,
        soNo: formData.soNo || undefined,
        totalAmount: parseFloat(formData.totalAmount),
        netAmount: formData.netAmount ? parseFloat(formData.netAmount) : parseFloat(formData.totalAmount),
        taxAmount: formData.taxAmount ? parseFloat(formData.taxAmount) : undefined,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || undefined,
        // Prepaid fields
        invoiceType: formData.invoiceType,
        advanceReceivedDate: formData.advanceReceivedDate || undefined,
        deliveryDueDate: formData.deliveryDueDate || undefined,
        grnDate: formData.grnDate || undefined,
        bgDate: formData.bgDate || undefined,
        othersDate: formData.othersDate || undefined,
        agingMilestone: formData.agingMilestone,
        actualPaymentTerms: (formData as any).actualPaymentTerms || undefined,
        type: formData.type,
      } as any);
      router.push('/finance/ar/invoices');
    } catch (err: any) {
      console.error('Create invoice error:', err);
      console.error('Error response:', err.response);
      setError(err.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium";

  return (
    <div className="space-y-6 w-full relative">
      {/* Decorative Background */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#E17F70]/10 to-[#CE9F6B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-20 w-96 h-96 bg-gradient-to-tr from-[#82A094]/10 to-[#6F8A9D]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#976E44] p-6 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 right-32 w-48 h-48 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/finance/ar/invoices"
              className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                New Invoice
                <Sparkles className="w-6 h-6 text-white/80" />
              </h1>
              <p className="text-white/80 text-sm mt-1">Create a new AR invoice manually</p>
            </div>
          </div>
          <Link 
            href="/finance/ar/import"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#4F6A64] font-semibold hover:shadow-lg transition-all"
          >
            <Upload className="w-4 h-4" />
            Import from Excel
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/10 border-2 border-[#E17F70]/30 rounded-xl text-[#9E3B47] font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-5 bg-gradient-to-r from-[#6F8A9D]/15 to-[#82A094]/10 border-2 border-[#6F8A9D]/30 rounded-xl">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[#546A7A] font-semibold text-sm">Fields marked with <span className="text-[#E17F70]">*</span> are mandatory</p>
            <p className="text-[#92A2A5] text-xs mt-1">
              {formData.invoiceType === 'PREPAID' 
                ? 'Prepaid: SO Number, PO Number, Customer Code, Document Date, Amount, and Advance Received Date. Reference No. format: PRE-{PO Number}'
                : 'Regular: Doc. No., Customer Code, Document Date, and Amount'}
            </p>
          </div>
        </div>

        {/* Invoice Type Selection */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            Invoice Type
          </h3>
          
          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { value: 'REGULAR', label: 'Regular', desc: 'Standard invoice' },
              { value: 'PREPAID', label: 'Prepaid', desc: 'Advance payment' },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, invoiceType: type.value as any }))}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  formData.invoiceType === type.value
                    ? 'border-[#CE9F6B] bg-gradient-to-br from-[#CE9F6B]/10 to-[#E17F70]/5 shadow-lg'
                    : 'border-[#AEBFC3]/30 hover:border-[#CE9F6B]/50 hover:bg-[#CE9F6B]/5'
                }`}
              >
                {formData.invoiceType === type.value && (
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-[#CE9F6B] to-[#E17F70]" />
                )}
                <p className={`font-bold ${formData.invoiceType === type.value ? 'text-[#976E44]' : 'text-[#546A7A]'}`}>
                  {type.label}
                </p>
                <p className="text-xs text-[#92A2A5] mt-1">{type.desc}</p>
              </button>
            ))}
          </div>

          {/* Prepaid-specific fields */}
          {formData.invoiceType === 'PREPAID' && (
            <div className="space-y-5 pt-4 border-t border-[#CE9F6B]/20">
              {/* SO Number and PO Number - Required for linking */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#CE9F6B]/10 to-[#E17F70]/5 border border-[#CE9F6B]/20">
                <p className="text-sm font-semibold text-[#976E44] mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Order Reference Numbers (Required for linking)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                      SO Number (Sales Order) <span className="text-[#E17F70]">*</span>
                    </label>
                    <input
                      type="text"
                      name="soNo"
                      value={formData.soNo}
                      onChange={handleChange}
                      className="w-full h-12 px-4 rounded-xl bg-white border-2 border-[#CE9F6B]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium"
                      placeholder="SO-12345"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                      PO Number (Purchase Order) <span className="text-[#E17F70]">*</span>
                    </label>
                    <input
                      type="text"
                      name="poNo"
                      value={formData.poNo}
                      onChange={handleChange}
                      className="w-full h-12 px-4 rounded-xl bg-white border-2 border-[#CE9F6B]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium"
                      placeholder="PO-12345"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-[#92A2A5] mt-2">Enter PO Number to allow linking this prepaid to a regular invoice later.</p>
              </div>
              
              {/* Dates */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                    Advance Received Date <span className="text-[#E17F70]">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CE9F6B]" />
                    <input
                      type="date"
                      name="advanceReceivedDate"
                      value={formData.advanceReceivedDate}
                      onChange={handleChange}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#CE9F6B]/10 border-2 border-[#CE9F6B]/30 text-[#546A7A] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                    Expected Delivery Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CE9F6B]" />
                    <input
                      type="date"
                      name="deliveryDueDate"
                      value={formData.deliveryDueDate}
                      onChange={handleChange}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Milestones & Aging Configuration */}
              <div className="p-5 rounded-xl bg-white border border-[#CE9F6B]/20 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-[#546A7A] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#CE9F6B]" />
                    Prepaging Milestones & Aging Tracking
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#92A2A5]">Aging Base:</span>
                    <select
                      name="agingMilestone"
                      value={formData.agingMilestone}
                      onChange={handleChange}
                      className="text-xs font-bold py-1 px-2 rounded-lg bg-[#CE9F6B]/10 border border-[#CE9F6B]/30 text-[#976E44] focus:outline-none"
                    >
                      {Object.entries(checkedMilestones).filter(([_, checked]) => checked).map(([key]) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'ADVANCE', label: 'Adv Date', field: 'advanceReceivedDate' },
                    { id: 'INVOICE', label: 'Invoice Date', field: 'invoiceDate' },
                    { id: 'GRN', label: 'GRN Date', field: 'grnDate' },
                    { id: 'BG', label: 'BG Date', field: 'bgDate' },
                    { id: 'OTHERS', label: 'Others', field: 'othersDate' },
                  ].map((m) => (
                    <div key={m.id} className={`flex items-center gap-4 p-3 rounded-lg transition-all ${checkedMilestones[m.id as keyof typeof checkedMilestones] ? 'bg-[#CE9F6B]/5 border border-[#CE9F6B]/20' : 'opacity-60'}`}>
                      <label className="flex items-center gap-3 cursor-pointer min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={checkedMilestones[m.id as keyof typeof checkedMilestones]}
                          onChange={(e) => setCheckedMilestones(prev => ({ ...prev, [m.id]: e.target.checked }))}
                          className="w-4 h-4 rounded border-2 border-[#CE9F6B] text-[#CE9F6B] focus:ring-[#CE9F6B]/20"
                        />
                        <span className="text-sm font-bold text-[#546A7A]">{m.label}</span>
                      </label>
                      
                      {checkedMilestones[m.id as keyof typeof checkedMilestones] && (
                        <div className="flex-1 flex items-center gap-2">
                          {m.id !== 'INVOICE' && m.id !== 'ADVANCE' ? (
                            <input
                              type="date"
                              name={m.field}
                              value={(formData as any)[m.field]}
                              onChange={handleChange}
                              className="flex-1 h-9 px-3 rounded-lg bg-white border border-[#CE9F6B]/30 text-xs font-medium focus:border-[#CE9F6B] transition-all"
                            />
                          ) : (
                            <span className="text-xs text-[#92A2A5] italic font-medium">Synced with {m.label} field above</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#E17F70]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#E17F70] to-[#CE9F6B]">
              <FileText className="w-5 h-5 text-white" />
            </div>
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-5">
            {/* Doc. No. - Only show for REGULAR invoices, Prepaid uses auto-generated PRE-{poNo} */}
            {formData.invoiceType === 'REGULAR' && (
              <div>
                <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                  Doc. No. <span className="text-[#E17F70]">*</span>
                </label>
                <input
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="INV-2024-001"
                  required
                />
              </div>
            )}

            {/* Invoice Category Type (Service, Sales, Others) */}
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Type <span className="text-[#E17F70]">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className={inputClass}
                required
              >
                <option value="">Select Type</option>
                <option value="LCS">LCS</option>
                <option value="NB">NB</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>

            {/* Customer Code */}
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
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

            {/* Customer Name (Optional) */}
            <div className="col-span-2">
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Customer Name
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                className={inputClass}
                placeholder="ABC Corporation Ltd (Optional)"              />
            </div>

            {/* Customer Ref. No. (PO) - Only show for REGULAR invoices, prepaid has its own section */}
            {formData.invoiceType === 'REGULAR' && (
              <div>
                <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                  Customer Ref. No. (PO)
                </label>
                <input
                  type="text"
                  name="poNo"
                  value={formData.poNo}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="PO-12345 (Optional)"
                />
              </div>
            )}

            {/* Document Date */}
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Document Date <span className="text-[#E17F70]">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CE9F6B]" />
                <input
                  type="date"
                  name="invoiceDate"
                  value={formData.invoiceDate}
                  onChange={handleChange}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium"
                  required
                />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Due Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E17F70]" />
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Payment Terms */}
            <div className="col-span-2">
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Payment Terms
              </label>
              <textarea
                name="actualPaymentTerms"
                value={(formData as any).actualPaymentTerms}
                onChange={handleChange as any}
                className={`${inputClass} h-auto min-h-[80px] py-3 resize-y`}
                placeholder="Declare detailed payment terms..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Amount Details */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#82A094]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64]">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            Amount Details
          </h3>
          <div className="grid grid-cols-3 gap-5">
            {/* Amount */}
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Amount (₹) <span className="text-[#E17F70]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#CE9F6B] font-semibold">₹</span>
                <input
                  type="number"
                  name="totalAmount"
                  value={formData.totalAmount}
                  onChange={handleChange}
                  className="w-full h-12 pl-8 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all font-medium"
                  placeholder="100000"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {/* Net (Optional - defaults to Amount) */}
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Net (₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#CE9F6B] font-semibold">₹</span>
                <input
                  type="number"
                  name="netAmount"
                  value={formData.netAmount}
                  onChange={handleChange}
                  className="w-full h-12 pl-8 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all font-medium"
                  placeholder="Defaults to Amount"
                  min="0"
                  step="0.01"                />
              </div>
            </div>

            {/* Tax (Optional) */}
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Tax Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#CE9F6B] font-semibold">₹</span>
                <input
                  type="number"
                  name="taxAmount"
                  value={formData.taxAmount}
                  onChange={handleChange}
                  className="w-full h-12 pl-8 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all font-medium"
                  placeholder="Tax Amount (Optional)"
                  min="0"
                  step="0.01"                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            href="/finance/ar/invoices"
            className="px-8 py-3.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] hover:bg-[#AEBFC3]/10 transition-all font-semibold"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="group relative flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white font-bold hover:shadow-xl hover:shadow-[#E17F70]/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span className="relative">{saving ? 'Saving...' : 'Create Invoice'}</span>
            <Sparkles className="w-4 h-4 relative" />
          </button>
        </div>
      </form>
    </div>
  );
}
