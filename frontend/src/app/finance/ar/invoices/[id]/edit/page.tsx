'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, formatARCurrency, PIC_OPTIONS } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, User, IndianRupee, Truck, Sparkles, Plus, Trash2 } from 'lucide-react';

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
        hasAPG: data.hasAPG || false,
        apgDraftDate: data.apgDraftDate ? data.apgDraftDate.split('T')[0] : '',
        apgDraftNote: data.apgDraftNote || '',
        apgDraftSteps: Array.isArray(data.apgDraftSteps) ? data.apgDraftSteps : [],
        apgIntermediateSteps: Array.isArray(data.apgIntermediateSteps) ? data.apgIntermediateSteps : [],
        apgSignedDate: data.apgSignedDate ? data.apgSignedDate.split('T')[0] : '',
        apgSignedNote: data.apgSignedNote || '',
        apgSignedSteps: Array.isArray(data.apgSignedSteps) ? data.apgSignedSteps : [],
        hasPBG: data.hasPBG || false,
        pbgDraftDate: data.pbgDraftDate ? data.pbgDraftDate.split('T')[0] : '',
        pbgDraftNote: data.pbgDraftNote || '',
        pbgDraftSteps: Array.isArray(data.pbgDraftSteps) ? data.pbgDraftSteps : [],
        pbgIntermediateSteps: Array.isArray(data.pbgIntermediateSteps) ? data.pbgIntermediateSteps : [],
        pbgSignedDate: data.pbgSignedDate ? data.pbgSignedDate.split('T')[0] : '',
        pbgSignedNote: data.pbgSignedNote || '',
        pbgSignedSteps: Array.isArray(data.pbgSignedSteps) ? data.pbgSignedSteps : [],
        // Delivery Tracking
        deliveryStatus: data.deliveryStatus || 'PENDING',
        modeOfDelivery: data.modeOfDelivery || '',
        sentHandoverDate: data.sentHandoverDate ? data.sentHandoverDate.split('T')[0] : '',
        impactDate: data.impactDate ? data.impactDate.split('T')[0] : '',
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

    try {
      // Validation
      if (!formData.invoiceNumber || !formData.bpCode || !formData.invoiceDate || !formData.dueDate || !formData.totalAmount) {
        setError('Please fill in all required fields: Invoice Number, BP Code, Invoice Date, Due Date, and Total Amount');
        return;
      }

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
        type: formData.type || undefined,
        status: formData.status as any,
        invoiceType: 'REGULAR',
        mailToTSP: undefined,
        personInCharge: formData.personInCharge || undefined,
        hasAPG: formData.hasAPG,
        apgDraftDate: formData.apgDraftDate || null,
        apgDraftNote: formData.apgDraftNote || null,
        apgDraftSteps: formData.apgDraftSteps,
        apgIntermediateSteps: formData.apgIntermediateSteps,
        apgSignedDate: formData.apgSignedDate || null,
        apgSignedNote: formData.apgSignedNote || null,
        apgSignedSteps: formData.apgSignedSteps,
        hasPBG: formData.hasPBG,
        pbgDraftDate: formData.pbgDraftDate || null,
        pbgDraftNote: formData.pbgDraftNote || null,
        pbgDraftSteps: formData.pbgDraftSteps,
        pbgIntermediateSteps: formData.pbgIntermediateSteps,
        pbgSignedDate: formData.pbgSignedDate || null,
        pbgSignedNote: formData.pbgSignedNote || null,
        pbgSignedSteps: formData.pbgSignedSteps,
        // Delivery Tracking
        deliveryStatus: formData.deliveryStatus,
        modeOfDelivery: formData.modeOfDelivery || undefined,
        sentHandoverDate: formData.sentHandoverDate || undefined,
        impactDate: formData.impactDate || undefined,
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
              <label className={labelClass}><User className="w-3.5 h-3.5 text-[#E17F70]" /> Kardex Person In-Charge</label>
              <select
                name="personInCharge"
                value={formData.personInCharge}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="">Select Person</option>
                {PIC_OPTIONS.map(person => (
                  <option key={person} value={person}>{person}</option>
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

        {/* Delivery Tracking */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[2rem] border-2 border-[#6F8A9D]/20 p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#AEBFC3]" />
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#AEBFC3] via-white/40 to-[#546A7A]" />
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
                className={selectClass}
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
                <span className="font-bold text-[#546A7A] text-lg">Advance Payment Guarantee (APG)</span>
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
            {/* Person In-Charge removed from here as it is moved above or redundant */}
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
