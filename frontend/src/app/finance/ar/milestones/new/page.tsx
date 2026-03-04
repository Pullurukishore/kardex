'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, MilestonePaymentTerm } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, Sparkles, AlertCircle, IndianRupee, Calendar, Info, Wallet, Plus, Trash2, Tag } from 'lucide-react';

export default function NewMilestonePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bpCode: '',
    customerName: '',
    poNo: '',
    soNo: '',
    totalAmount: '',
    netAmount: '',
    taxAmount: '',
    invoiceDate: '', // Invoice Date
    advanceReceivedDate: '',
    deliveryDueDate: '',
    milestoneTerms: [] as MilestonePaymentTerm[],
    actualPaymentTerms: '',
    type: '' as any,
    accountingStatus: '' as '' | 'REVENUE_RECOGNISED' | 'BACKLOG',
    mailToTSP: '',
    invoiceNumber: '',
  });

  const termOptions = [
    { value: 'ABG', label: 'ABG' },
    { value: 'PO', label: 'PO' },
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'FAR', label: 'FAR' },
    { value: 'PBG', label: 'PBG' },
    { value: 'FAR_PBG', label: 'FAR & PBG' },
    { value: 'INVOICE_SUBMISSION', label: 'Invoice Submission' },
    { value: 'OTHER', label: 'Other (Manually)' },
  ];

  const addTerm = () => {
    setFormData(prev => ({
      ...prev,
      milestoneTerms: [
        ...prev.milestoneTerms,
        { termType: 'ABG', termDate: '', percentage: 0 }
      ]
    }));
  };

  const removeTerm = (index: number) => {
    setFormData(prev => ({
      ...prev,
      milestoneTerms: prev.milestoneTerms.filter((_, i) => i !== index)
    }));
  };

  const updateTerm = (index: number, field: keyof MilestonePaymentTerm, value: string) => {
    let finalValue: any = value;
    
    // Validation for percentage
    if (field === 'percentage') {
      const numValue = parseFloat(value);
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

  const totalPercentage = formData.milestoneTerms.reduce((sum, term) => sum + (Number(term.percentage) || 0), 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.bpCode || !formData.totalAmount) {
      setError('Please fill in all required fields: Customer Code and Amount');
      return;
    }

    if (!formData.advanceReceivedDate) {
      setError('Advance Received Date is required for milestone payments');
      return;
    }
    if (!formData.soNo) {
      setError('SO Number is required for milestone payments');
      return;
    }
    if (!formData.poNo) {
      setError('PO Number is required for milestone payments');
      return;
    }
    if (formData.milestoneTerms.length === 0) {
      setError('At least one payment term is required for milestone payments');
      return;
    }
    
    // Check if any term is missing a date
    const missingDate = formData.milestoneTerms.some(t => !t.termDate);
    if (missingDate) {
      setError('Payment dates are required for all milestone terms');
      return;
    }

    try {
      setSaving(true);
      const invoiceNumber = formData.invoiceNumber || `PRE-${formData.poNo}`;
      
      await arApi.createInvoice({
        invoiceNumber,
        customerId: formData.bpCode,
        customerName: formData.customerName || '',
        poNo: formData.poNo,
        soNo: formData.soNo,
        totalAmount: parseFloat(formData.totalAmount),
        netAmount: formData.netAmount ? parseFloat(formData.netAmount) : parseFloat(formData.totalAmount),
        taxAmount: formData.taxAmount ? parseFloat(formData.taxAmount) : undefined,
        invoiceDate: formData.invoiceDate,
        // Milestone fields
        invoiceType: 'MILESTONE',
        advanceReceivedDate: formData.advanceReceivedDate,
        deliveryDueDate: formData.deliveryDueDate || undefined,
        milestoneTerms: formData.milestoneTerms,
        actualPaymentTerms: formData.actualPaymentTerms || undefined,
        type: formData.type || undefined,
        accountingStatus: formData.accountingStatus || undefined,
        mailToTSP: formData.mailToTSP,
      } as any);
      router.push('/finance/ar/milestones');
    } catch (err: any) {
      setError(err.message || 'Failed to create milestone payment');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium";

  return (
    <div className="space-y-6 w-full relative">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#E17F70]/10 to-[#CE9F6B]/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/finance/ar/milestones"
              className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                New Milestone Payment
                <Sparkles className="w-6 h-6 text-white/80" />
              </h1>
              <p className="text-white/80 text-sm mt-1">Create a new milestone payment tracking record</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-100 rounded-xl text-red-600 font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-5 bg-[#CE9F6B]/10 border-2 border-[#CE9F6B]/20 rounded-xl">
          <Info className="w-5 h-5 text-[#976E44] mt-0.5" />
          <div>
            <p className="text-[#976E44] font-semibold text-sm">Milestone Payment Requirements</p>
            <p className="text-[#92A2A5] text-xs mt-1">
              SO Number, PO Number, Customer Code, Amount, and Advance Received Date are mandatory.
            </p>
          </div>
        </div>

        {/* Core Order Information */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            Order & Customer Info
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                SO Number <span className="text-[#E17F70]">*</span>
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
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                PO Number <span className="text-[#E17F70]">*</span>
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
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Invoice No
              </label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleChange}
                placeholder="Invoice No"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Customer Name
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                className={inputClass}
                placeholder="Customer Name (Optional)"
              />
            </div>
          </div>
        </div>

        {/* Milestone Specifics */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#E17F70]">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            Milestone Tracking
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-3">
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
              <label className="block text-[#5D6E73] text-sm font-semibold mb-3">
                Advance Received Date <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="date"
                name="advanceReceivedDate"
                value={formData.advanceReceivedDate}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-3">
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
              <label className="block text-[#5D6E73] text-sm font-semibold mb-3">
                Mail to TSP
              </label>
              <input
                type="text"
                name="mailToTSP"
                value={formData.mailToTSP}
                onChange={handleChange}
                placeholder="Enter email or reference"
                className={inputClass}
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <h4 className="text-sm font-bold text-[#546A7A]">Payment Terms (Aging Targets)</h4>
                <div className={`text-[10px] font-bold mt-0.5 ${totalPercentage > 100 ? 'text-red-500' : 'text-[#82A094]'}`}>
                  Total Allocation: {totalPercentage}% {totalPercentage > 100 && '(Exceeds 100%)'}
                </div>
              </div>
              <button
                type="button"
                onClick={addTerm}
                disabled={totalPercentage >= 100}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all ${totalPercentage >= 100 ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#CE9F6B] hover:shadow-md active:scale-95'}`}
              >
                <Plus className="w-3.5 h-3.5" /> Add Term
              </button>
            </div>

            <div className="space-y-3">
              {formData.milestoneTerms.map((term, index) => {
                const isOther = term.termType === 'OTHER';
                
                return (
                  <div key={index} className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-all hover:border-[#CE9F6B]/30">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 grid grid-cols-12 gap-3 items-end">
                        <div className={isOther ? "col-span-3" : "col-span-4"}>
                          <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1 transition-all">
                            Term Type
                          </label>
                          <select
                            value={term.termType}
                            onChange={(e) => updateTerm(index, 'termType', e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-[#546A7A] focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/10 transition-all"
                          >
                            {termOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                        
                        {isOther ? (
                          <div className="col-span-5">
                            <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1 flex items-center gap-1">
                              Manual Description <span className="text-[#92A2A5] lowercase font-medium">(include % if needed)</span>
                            </label>
                            <input
                              type="text"
                              value={term.customLabel || ''}
                              onChange={(e) => updateTerm(index, 'customLabel', e.target.value)}
                              className="w-full h-10 px-3 rounded-lg border-2 border-[#CE9F6B]/30 bg-[#F4F7F9] text-sm font-medium placeholder:text-[#92A2A5]"
                              placeholder="e.g., after installation 30%..."
                            />
                          </div>
                        ) : (
                          <div className="col-span-3">
                            <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1 text-center">
                              %
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                value={term.percentage || ''}
                                onChange={(e) => updateTerm(index, 'percentage', e.target.value)}
                                min="0"
                                max="100"
                                className="w-full h-10 px-3 pr-8 rounded-lg border border-gray-200 text-sm text-right font-bold transition-all focus:border-[#CE9F6B]"
                                placeholder="0"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#92A2A5]">%</span>
                            </div>
                          </div>
                        )}

                        <div className={isOther ? "col-span-4" : "col-span-5"}>
                          <label className="block text-[10px] font-bold text-[#976E44] uppercase mb-1.5 ml-1 text-center">
                            Target Date
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CE9F6B]" />
                            <input
                              type="date"
                              value={term.termDate}
                              onChange={(e) => updateTerm(index, 'termDate', e.target.value)}
                              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm font-medium"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={() => removeTerm(index)} 
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-auto mb-0.5"
                        title="Remove term"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#82A094]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64]">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            Financial Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-1">
               <label className="block text-[#5D6E73] text-sm font-semibold mb-2">Category</label>
               <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
                 <option value="">Select Category</option>
                 <option value="LCS">LCS</option>
                 <option value="NB">NB</option>
                 <option value="FINANCE">Finance</option>
               </select>
            </div>
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
                Total Amount (₹) <span className="text-[#E17F70]">*</span>
              </label>
              <input
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">Net Amount (₹)</label>
              <input
                type="number"
                name="netAmount"
                value={formData.netAmount}
                onChange={handleChange}
                className={inputClass}
                placeholder="Auto-calculated"
              />
            </div>
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">Tax Amount (₹)</label>
              <input
                type="number"
                name="taxAmount"
                value={formData.taxAmount}
                onChange={handleChange}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/finance/ar/milestones" className="px-6 py-3 text-[#5D6E73] font-semibold">Cancel</Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white font-bold shadow-lg"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Create Milestone Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
