'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, formatARCurrency, MilestonePaymentTerm } from '@/lib/ar-api';
import { ArrowLeft, Save, Loader2, FileText, User, Calendar, IndianRupee, Truck, Sparkles, Wallet, Plus, Trash2, Tag } from 'lucide-react';

export default function EditMilestonePage() {
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
    advanceReceivedDate: '',
    deliveryDueDate: '',
    milestoneTerms: [] as MilestonePaymentTerm[],
    milestoneStatus: '' as '' | 'AWAITING_DELIVERY' | 'PARTIALLY_DELIVERED' | 'FULLY_DELIVERED' | 'EXPIRED' | 'LINKED',
    accountingStatus: '' as '' | 'REVENUE_RECOGNISED' | 'BACKLOG',
    mailToTSP: '',
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
        advanceReceivedDate: data.advanceReceivedDate ? data.advanceReceivedDate.split('T')[0] : '',
        deliveryDueDate: data.deliveryDueDate ? data.deliveryDueDate.split('T')[0] : '',
        milestoneTerms: (data.milestoneTerms as MilestonePaymentTerm[]) || [],
        milestoneStatus: data.milestoneStatus || 'AWAITING_DELIVERY',
        accountingStatus: data.accountingStatus || '',
        mailToTSP: (data.mailToTSP === 'false' as any) ? '' : (data.mailToTSP || ''),
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
    setFormData(prev => ({ ...prev, [name]: value }));
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
        advanceReceivedDate: formData.advanceReceivedDate || undefined,
        deliveryDueDate: formData.deliveryDueDate || undefined,
        milestoneTerms: formData.milestoneTerms,
        milestoneStatus: formData.milestoneStatus || undefined,
        accountingStatus: formData.accountingStatus || undefined,
        mailToTSP: formData.mailToTSP,
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
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div 
                key={i}
                className="w-4 h-4 rounded-full bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-[#92A2A5] text-sm">Loading milestone records...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#CE9F6B]/20 to-[#E17F70]/20 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-12 h-12 text-[#CE9F6B]" />
          </div>
          <h2 className="text-xl font-bold text-[#546A7A] mb-2">Milestone Record Not Found</h2>
          <Link href="/finance/ar/milestones" className="text-[#E17F70] hover:text-[#9E3B47] font-semibold">
            ← Back to Milestone Payments
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium";
  const readOnlyClass = "w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/10 border-2 border-[#AEBFC3]/20 text-[#92A2A5] cursor-not-allowed";
  const labelClass = "block text-[#5D6E73] text-sm font-semibold mb-3";
  const selectClass = "w-full h-12 px-4 rounded-xl bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] focus:border-[#CE9F6B]/50 focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/10 transition-all font-medium";

  return (
    <div className="space-y-6 relative">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#CE9F6B]/10 to-[#E17F70]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#CE9F6B] via-[#E17F70] to-[#976E44] p-6 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-center gap-4">
          <Link 
            href={`/finance/ar/milestones/${invoice!.id}`}
            className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Edit Milestone Payment
              <Sparkles className="w-5 h-5 text-white/80" />
            </h1>
            <p className="text-white/80 text-sm mt-1">{formData.soNo || formData.invoiceNumber} • {formData.customerName}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Core Info */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#546A7A] mb-5 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            Milestone Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
              <label className={labelClass}>Mail to TSP</label>
              <input
                type="text"
                name="mailToTSP"
                value={formData.mailToTSP}
                onChange={handleChange}
                placeholder="Enter email or reference"
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
              <label className={labelClass}>Category</label>
              <select name="type" value={formData.type} onChange={handleChange} className={selectClass}>
                <option value="NB">NB</option>
                <option value="LCS">LCS</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Advance Received Date</label>
              <input
                type="date"
                name="advanceReceivedDate"
                value={formData.advanceReceivedDate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

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

          <div className="mt-10 border-t border-[#AEBFC3]/20 pt-8">
            <h4 className="text-sm font-bold text-[#546A7A] uppercase tracking-wider mb-6 flex items-center gap-2">
              <User className="w-4 h-4 text-[#CE9F6B]" /> Supplemental Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-[#546A7A] flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#E17F70]">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        Milestone Payment Terms
                    </h3>
                    <div className={`text-xs font-bold mt-1 ${totalPercentage > 100 ? 'text-red-500' : 'text-[#82A094]'}`}>
                        Total Allocation: {totalPercentage}% {totalPercentage > 100 && '(Exceeds 100%)'}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={addTerm}
                    disabled={totalPercentage >= 100}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold transition-all ${totalPercentage >= 100 ? 'bg-gray-300' : 'bg-[#CE9F6B] hover:shadow-lg active:scale-95'}`}
                >
                    <Plus className="w-4 h-4" /> Add Term
                </button>
            </div>

            <div className="space-y-4">
                {formData.milestoneTerms.map((term, index) => {
                    const isOther = term.termType === 'OTHER';
                    return (
                        <div key={index} className="group relative p-4 rounded-2xl bg-gray-50 border border-[#CE9F6B]/20 transition-all hover:bg-white hover:shadow-md hover:border-[#CE9F6B]/50">
                            <div className="grid grid-cols-12 gap-4 items-end">
                                <div className={isOther ? "col-span-3" : "col-span-4"}>
                                    <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block">Term Type</label>
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CE9F6B]" />
                                        <select
                                            value={term.termType}
                                            onChange={(e) => updateTerm(index, 'termType', e.target.value)}
                                            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-[#CE9F6B]/30 text-xs font-bold text-[#546A7A] focus:border-[#CE9F6B] focus:outline-none"
                                        >
                                            {termOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {isOther ? (
                                    <div className="col-span-5">
                                        <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block flex items-center gap-1">
                                            Manual Description <span className="text-[#92A2A5] lowercase font-medium">(include % if needed)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={term.customLabel || ''}
                                            onChange={(e) => updateTerm(index, 'customLabel', e.target.value)}
                                            className="w-full h-10 px-3 rounded-lg border border-[#CE9F6B]/30 bg-white text-xs font-bold text-[#546A7A] focus:border-[#CE9F6B] outline-none"
                                            placeholder="e.g. installation completion 40%"
                                        />
                                    </div>
                                ) : (
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block">Percentage</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={term.percentage || ''}
                                                onChange={(e) => updateTerm(index, 'percentage', e.target.value)}
                                                min="0"
                                                max="100"
                                                className="w-full h-10 px-3 pr-8 rounded-lg border border-[#CE9F6B]/30 bg-white text-xs font-bold text-[#546A7A] text-right focus:border-[#CE9F6B] outline-none"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#92A2A5]">%</span>
                                        </div>
                                    </div>
                                )}

                                <div className={isOther ? "col-span-3" : "col-span-4"}>
                                    <label className="text-[10px] font-black text-[#976E44] uppercase mb-1.5 ml-1 block">Payment Target Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#E17F70]" />
                                        <input
                                            type="date"
                                            value={term.termDate ? term.termDate.split('T')[0] : ''}
                                            onChange={(e) => updateTerm(index, 'termDate', e.target.value)}
                                            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-[#CE9F6B]/30 text-xs font-bold text-[#546A7A] focus:border-[#E17F70] focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="col-span-1 flex justify-center pb-1">
                                    <button
                                        type="button"
                                        onClick={() => removeTerm(index)}
                                        className="p-2 rounded-lg bg-white border border-[#E17F70]/20 text-[#E17F70] hover:bg-[#E17F70] hover:text-white transition-all shadow-sm"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* SAP Fields (Visible but Read-only for context) */}
        <div className="bg-[#F8FAFB] rounded-2xl border border-[#AEBFC3]/20 p-6">
            <h3 className="text-sm font-bold text-[#546A7A] mb-4 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" /> SAP Reference Data
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                   <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">Total Amount</label>
                   <p className="text-sm font-bold text-[#546A7A]">{formatARCurrency(Number(formData.totalAmount))}</p>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">BP Code</label>
                   <p className="text-sm font-bold text-[#546A7A]">{formData.bpCode}</p>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">Invoice Date</label>
                   <p className="text-sm font-bold text-[#546A7A]">{formData.invoiceDate}</p>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-[#92A2A5] uppercase mb-1 block">Customer</label>
                   <p className="text-sm font-bold text-[#546A7A] truncate">{formData.customerName}</p>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <Link
            href={`/finance/ar/milestones/${invoice!.id}`}
            className="px-8 py-3.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] font-semibold hover:bg-gray-50 transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-10 py-3.5 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white font-bold hover:shadow-xl transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Milestone'}
          </button>
        </div>
      </form>
    </div>
  );
}
