'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, formatARCurrency, TSP_OPTIONS } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, User, IndianRupee, Truck, Sparkles } from 'lucide-react';

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<ARInvoice | null>(null);

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
    riskClass: 'LOW',
    emailId: '',
    contactNo: '',
    region: '',
    department: '',
    personInCharge: '',
    type: '',
    status: 'PENDING',
    invoiceType: 'REGULAR' as 'REGULAR' | 'MILESTONE',
    mailToTSP: '',
  });

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id as string);
    }
  }, [params.id]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      const data = await arApi.getInvoiceById(id, 'REGULAR');
      
      // Redirect to milestone edit if it's a milestone invoice
      if (data.invoiceType === 'MILESTONE') {
        router.replace(`/finance/ar/milestones/${encodeURIComponent(data.invoiceNumber)}/edit`);
        return;
      }

      setInvoice(data);
      
      setFormData({
        invoiceNumber: data.invoiceNumber || '',
        bpCode: data.bpCode || '',
        customerName: data.customerName || '',
        poNo: data.poNo || '',
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
        type: (data.type as any) === 'SERVICE' ? 'LCS' : (data.type as any) === 'SALES' ? 'NB' : (data.type || ''),
        status: data.status || 'PENDING',
        invoiceType: data.invoiceType || 'REGULAR',
        mailToTSP: data.mailToTSP || '',
      });
    } catch (err) {
      console.error('Failed to load invoice:', err);
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setSaving(true);
      
      await arApi.updateInvoice(invoice!.id, {
        invoiceNumber: formData.invoiceNumber || undefined,
        bpCode: formData.bpCode || undefined,
        customerName: formData.customerName || undefined,
        totalAmount: formData.totalAmount ? Number(formData.totalAmount) : undefined,
        netAmount: formData.netAmount ? Number(formData.netAmount) : undefined,
        taxAmount: formData.taxAmount ? Number(formData.taxAmount) : undefined,
        invoiceDate: formData.invoiceDate || undefined,
        poNo: formData.poNo || undefined,
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
        invoiceType: 'REGULAR',
        mailToTSP: formData.mailToTSP || undefined,
      } as any);
      
      router.replace(`/finance/ar/invoices/${encodeURIComponent(formData.invoiceNumber)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/30" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#E17F70] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-[#CE9F6B] border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            <FileText className="absolute inset-0 m-auto w-6 h-6 text-[#546A7A]" />
          </div>
          <p className="text-[#5D6E73] font-medium">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-[#E17F70]/20 via-[#CE9F6B]/10 to-[#976E44]/20 flex items-center justify-center mx-auto mb-6 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#976E44]" />
            <FileText className="w-14 h-14 text-[#CE9F6B]" />
          </div>
          <h2 className="text-2xl font-bold text-[#546A7A] mb-3">Invoice Not Found</h2>
          <p className="text-[#92A2A5] mb-8">The invoice you're looking for doesn't exist or has been removed.</p>
          <button 
            onClick={() => router.back()} 
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white font-bold rounded-xl shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to previous page
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium";
  const readOnlyClass = "w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/10 border-2 border-[#AEBFC3]/20 text-[#92A2A5] cursor-not-allowed";
  const labelClass = "flex items-center gap-1.5 text-[#5D6E73] text-sm font-bold mb-2 uppercase tracking-wider";
  const selectClass = "w-full h-12 px-4 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium";

  return (
    <div className="space-y-6 relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-gradient-to-br from-[#E17F70]/10 to-[#CE9F6B]/10 rounded-full blur-[8rem] opacity-50" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-[6rem] opacity-50" />
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#976E44] p-6 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#CE9F6B] via-white/40 to-[#E17F70]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 right-32 w-48 h-48 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-center gap-4">
          <Link 
            href={`/finance/ar/invoices/${encodeURIComponent(formData.invoiceNumber)}`}
            replace
            className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/30 hover:scale-105 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30">
            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Edit Invoice
              <Sparkles className="w-5 h-5 text-white/80" />
            </h1>
            <p className="text-white/80 text-sm mt-1">{formData.invoiceNumber} • {formData.customerName}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="relative p-5 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/10 border-2 border-[#E17F70]/30 rounded-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-[#9E3B47] to-[#75242D]" />
            <p className="text-[#9E3B47] font-bold">{error}</p>
          </div>
        )}

        {/* Invoice Details */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#E17F70]/20 p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#976E44]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-2 flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] shadow-lg shadow-[#E17F70]/20 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-white/40 to-[#E17F70]" />
              <FileText className="w-5 h-5 text-white" />
            </div>
            Invoice Details
          </h3>
          <p className="text-[#92A2A5] text-sm mb-5">Edit invoice information below</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Invoice Number <span className="text-[#E17F70]">*</span></label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleChange}
                placeholder="Invoice Number"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>BP Code</label>
              <input
                type="text"
                name="bpCode"
                value={formData.bpCode}
                onChange={handleChange}
                placeholder="BP Code"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>Customer Name <span className="text-[#E17F70]">*</span></label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="Customer Name"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Total Amount (₹) <span className="text-[#E17F70]">*</span></label>
              <input
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                placeholder="0.00"
                className={inputClass}
                required
                step="0.01"
              />
            </div>
            <div>
              <label className={labelClass}>Net Amount (₹)</label>
              <input
                type="number"
                name="netAmount"
                value={formData.netAmount}
                onChange={handleChange}
                placeholder="0.00"
                className={inputClass}
                step="0.01"
              />
            </div>
            <div>
              <label className={labelClass}>Tax Amount (₹)</label>
              <input
                type="number"
                name="taxAmount"
                value={formData.taxAmount}
                onChange={handleChange}
                placeholder="0.00"
                className={inputClass}
                step="0.01"
              />
            </div>
            <div>
              <label className={labelClass}>Invoice Date <span className="text-[#E17F70]">*</span></label>
              <input
                type="date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}><Truck className="w-3.5 h-3.5 text-[#E17F70]" /> TSP (Service Provider)</label>
              <select
                name="mailToTSP"
                value={formData.mailToTSP}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="">Select TSP</option>
                {TSP_OPTIONS.map(tsp => (
                  <option key={tsp} value={tsp}>{tsp}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Editable Fields - Payment & Status */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#82A094]/20 p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/20 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#4F6A64]" />
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            Payment & Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>PO Number</label>
              <input
                type="text"
                name="poNo"
                value={formData.poNo}
                onChange={handleChange}
                placeholder="Customer PO/Ref No"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Due Date <span className="text-[#E17F70]">*</span></label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div className="sm:col-span-full">
              <label className={labelClass}>Payment Terms</label>
              <textarea
                name="actualPaymentTerms"
                value={formData.actualPaymentTerms}
                onChange={handleChange}
                placeholder="Declare detailed payment terms here..."
                className={`${inputClass} h-auto min-h-[100px] py-4 resize-y`}
                rows={3}
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className={selectClass}>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Risk Class</label>
              <select name="riskClass" value={formData.riskClass} onChange={handleChange} className={selectClass}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select 
                name="type" 
                value={formData.type || ''} 
                onChange={handleChange} 
                className={selectClass}
                required
              >
                <option value="">Select Type</option>
                <option value="LCS">LCS</option>
                <option value="NB">NB</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer Contact Fields */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#CE9F6B]/20 p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-white/40 to-[#CE9F6B]" />
              <User className="w-5 h-5 text-white" />
            </div>
            Customer Contact Information
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Email ID</label>
              <input
                type="email"
                name="emailId"
                value={formData.emailId}
                onChange={handleChange}
                placeholder="customer@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Contact No</label>
              <input
                type="text"
                name="contactNo"
                value={formData.contactNo}
                onChange={handleChange}
                placeholder="+91 XXXXX XXXXX"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Region</label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleChange}
                placeholder="North/South/East/West"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="Department name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Person In Charge</label>
              <input
                type="text"
                name="personInCharge"
                value={formData.personInCharge}
                onChange={handleChange}
                placeholder="Contact person name"
                className={inputClass}
              />
            </div>
          </div>
        </div>



        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            href={`/finance/ar/invoices/${encodeURIComponent(formData.invoiceNumber)}`}
            replace
            className="px-8 py-3.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-bold hover:bg-[#AEBFC3]/10 hover:border-[#AEBFC3]/60 transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="group relative flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white font-bold shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:shadow-[#E17F70]/40 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:hover:translate-y-0 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span className="relative">{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
