'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, formatARCurrency } from '@/lib/ar-api';
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
    modeOfDelivery: '',
    sentHandoverDate: '',
    deliveryStatus: 'PENDING',
    impactDate: '',
    status: 'PENDING',
    invoiceType: 'REGULAR' as 'REGULAR' | 'MILESTONE',
  });

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id as string);
    }
  }, [params.id]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      const data = await arApi.getInvoiceById(id);
      
      // Redirect to milestone edit if it's a milestone invoice
      if (data.invoiceType === 'MILESTONE') {
        router.push(`/finance/ar/milestones/${encodeURIComponent(data.invoiceNumber)}/edit`);
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
        modeOfDelivery: data.modeOfDelivery || '',
        sentHandoverDate: data.sentHandoverDate ? data.sentHandoverDate.split('T')[0] : '',
        deliveryStatus: data.deliveryStatus || 'PENDING',
        impactDate: data.impactDate ? data.impactDate.split('T')[0] : '',
        status: data.status || 'PENDING',
        invoiceType: data.invoiceType || 'REGULAR',
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
        modeOfDelivery: formData.modeOfDelivery || undefined,
        sentHandoverDate: formData.sentHandoverDate || undefined,
        deliveryStatus: formData.deliveryStatus as any,
        impactDate: formData.impactDate || undefined,
        status: formData.status as any,
        invoiceType: 'REGULAR',
      } as any);
      
      router.push(`/finance/ar/invoices/${encodeURIComponent(formData.invoiceNumber)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div 
                key={i}
                className="w-4 h-4 rounded-full bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-[#92A2A5] text-sm">Loading invoice...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#E17F70]/20 to-[#CE9F6B]/20 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-12 h-12 text-[#CE9F6B]" />
          </div>
          <h2 className="text-xl font-bold text-[#546A7A] mb-2">Invoice Not Found</h2>
          <Link 
            href="/finance/ar/invoices" 
            className="text-[#E17F70] hover:text-[#9E3B47] font-semibold"
          >
            ← Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium";
  const readOnlyClass = "w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/10 border-2 border-[#AEBFC3]/20 text-[#92A2A5] cursor-not-allowed";
  const labelClass = "block text-[#5D6E73] text-sm font-semibold mb-2";
  const selectClass = "w-full h-12 px-4 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#E17F70]/50 focus:outline-none focus:ring-4 focus:ring-[#E17F70]/10 transition-all font-medium";

  return (
    <div className="space-y-6 relative">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#E17F70]/10 to-[#CE9F6B]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#976E44] p-6 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 right-32 w-48 h-48 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-center gap-4">
          <Link 
            href={`/finance/ar/invoices/${encodeURIComponent(formData.invoiceNumber)}`}
            className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
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
          <div className="p-4 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/10 border-2 border-[#E17F70]/30 rounded-xl text-[#9E3B47] font-medium">
            {error}
          </div>
        )}

        {/* SAP Fields (Read-only) */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#E17F70]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-2 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#E17F70] to-[#CE9F6B]">
              <FileText className="w-5 h-5 text-white" />
            </div>
            SAP Invoice Details
          </h3>
          <p className="text-[#92A2A5] text-sm mb-5">These fields are imported from SAP and cannot be edited</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Invoice Number</label>
              <input type="text" value={formData.invoiceNumber} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>BP Code</label>
              <input type="text" value={formData.bpCode} readOnly className={readOnlyClass} />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>Customer Name</label>
              <input type="text" value={formData.customerName} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Total Amount (₹)</label>
              <input type="text" value={formatARCurrency(Number(formData.totalAmount))} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Net Amount (₹)</label>
              <input type="text" value={formatARCurrency(Number(formData.netAmount))} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Tax Amount (₹)</label>
              <input type="text" value={formatARCurrency(Number(formData.taxAmount))} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Invoice Date</label>
              <input type="text" value={formData.invoiceDate} readOnly className={readOnlyClass} />
            </div>
          </div>
        </div>

        {/* Editable Fields - Payment & Status */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#82A094]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64]">
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
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]">
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

        {/* Delivery Tracking */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#6F8A9D]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]">
              <Truck className="w-5 h-5 text-white" />
            </div>
            Delivery Tracking
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Delivery Status</label>
              <select name="deliveryStatus" value={formData.deliveryStatus} onChange={handleChange} className={selectClass}>
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Mode of Delivery</label>
              <input
                type="text"
                name="modeOfDelivery"
                value={formData.modeOfDelivery}
                onChange={handleChange}
                placeholder="Email/Courier/Hand delivery"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sent/Handover Date</label>
              <input
                type="date"
                name="sentHandoverDate"
                value={formData.sentHandoverDate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Impact Date (GRN/Acknowledgement)</label>
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            href={`/finance/ar/invoices/${encodeURIComponent(formData.invoiceNumber)}`}
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
            <span className="relative">{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
