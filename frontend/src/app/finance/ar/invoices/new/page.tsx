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
    setFormData(prev => ({ ...prev, [name]: value }));
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
        totalAmount: parseFloat(formData.totalAmount),
        netAmount: formData.netAmount ? parseFloat(formData.netAmount) : parseFloat(formData.totalAmount),
        taxAmount: formData.taxAmount ? parseFloat(formData.taxAmount) : undefined,
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

  const inputClass = "w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium";

  return (
    <div className="space-y-6 w-full relative">
      {/* Decorative Background */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#E17F70]/10 to-[#6F8A9D]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#976E44] p-6 shadow-xl">
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
                New AR Invoice
                <Sparkles className="w-6 h-6 text-white/80" />
              </h1>
              <p className="text-white/80 text-sm mt-1">Create a regular AR invoice manually</p>
            </div>
          </div>
          <Link 
            href="/finance/ar/import"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#E17F70] font-semibold hover:shadow-lg transition-all"
          >
            <Upload className="w-4 h-4" />
            Import from Excel
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 font-medium font-outfit">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-5 bg-blue-50/50 border-2 border-blue-100 rounded-xl">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-blue-700 font-semibold text-sm">Regular Invoice Requirements</p>
            <p className="text-[#92A2A5] text-xs mt-1">
              Doc. No., Customer Code, Document Date, and Amount are mandatory fields.
            </p>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#AEBFC3]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#E17F70] to-[#CE9F6B]">
              <FileText className="w-5 h-5 text-white" />
            </div>
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
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
                placeholder="C00123"
                required
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
                placeholder="Customer display name"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[#5D6E73] text-sm font-semibold mb-2">
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
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70]/50 focus:outline-none transition-all font-medium"
                  required
                />
              </div>
            </div>

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
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70]/50 focus:outline-none transition-all font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Amount Details */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#82A094]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64]">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            Financial Details
          </h3>
          <div className="grid grid-cols-3 gap-5">
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
                step="0.01"
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
                placeholder="Defaults to Total"
                step="0.01"
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
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#AEBFC3]/20 p-6 shadow-lg">
          <label className="block text-[#5D6E73] text-sm font-semibold mb-2">Payment Terms (Optional)</label>
          <textarea
            name="actualPaymentTerms"
            value={formData.actualPaymentTerms}
            onChange={handleChange}
            className="w-full p-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70]/50 focus:outline-none min-h-[100px]"
            placeholder="Enter specific payment terms here..."
          />
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
            className="flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white font-bold hover:shadow-xl transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
