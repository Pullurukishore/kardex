'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, Sparkles, Upload, AlertCircle, IndianRupee, Calendar, Info } from 'lucide-react';

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
            <Link 
              href="/finance/ar/invoices"
              className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/30 transition-all duration-300 hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
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
          <Link
            href="/finance/ar/invoices"
            className="px-8 py-3.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-bold hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/60 transition-all duration-300"
          >
            Cancel
          </Link>
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
