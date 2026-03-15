'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi } from '@/lib/ar-api';
import { 
  ArrowLeft, Save, Loader2, Building2, Sparkles, User, Mail, Phone, 
  MapPin, Shield, CheckCircle, AlertTriangle, X
} from 'lucide-react';

const riskOptions = [
  { value: 'LOW', label: 'Low Risk', gradient: 'from-[#A2B9AF] to-[#82A094]', shadow: 'shadow-[#82A094]/20', description: 'Good payment history' },
  { value: 'MEDIUM', label: 'Medium Risk', gradient: 'from-[#CE9F6B] to-[#976E44]', shadow: 'shadow-[#CE9F6B]/20', description: 'Occasional delays' },
  { value: 'HIGH', label: 'High Risk', gradient: 'from-[#E17F70] to-[#9E3B47]', shadow: 'shadow-[#E17F70]/20', description: 'Frequent issues' },
  { value: 'CRITICAL', label: 'Critical', gradient: 'from-[#9E3B47] to-[#75242D]', shadow: 'shadow-[#9E3B47]/20', description: 'Immediate attention' },
];

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    bpCode: '',
    customerName: '',
    region: '',
    department: '',
    personInCharge: '',
    contactNo: '',
    emailId: '',
    riskClass: 'LOW',
    creditLimit: '',
  });

  useEffect(() => {
    loadCustomer();
  }, [params.id]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const data = await arApi.getCustomerById(params.id as string);
      setFormData({
        bpCode: data.bpCode,
        customerName: data.customerName,
        region: data.region || '',
        department: data.department || '',
        personInCharge: data.personInCharge || '',
        contactNo: data.contactNo || '',
        emailId: data.emailId || '',
        riskClass: data.riskClass,
        creditLimit: data.creditLimit ? String(data.creditLimit) : '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleRiskChange = (value: string) => {
    setFormData(prev => ({ ...prev, riskClass: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.bpCode || !formData.customerName) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      await arApi.updateCustomer(params.id as string, {
        bpCode: formData.bpCode.toUpperCase(),
        customerName: formData.customerName,
        region: formData.region || undefined,
        department: formData.department || undefined,
        personInCharge: formData.personInCharge || undefined,
        contactNo: formData.contactNo || undefined,
        emailId: formData.emailId || undefined,
        riskClass: formData.riskClass as any,
        creditLimit: formData.creditLimit ? Number(formData.creditLimit) : undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push(`/finance/ar/customers/${params.id}`);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-[#96AEC2]/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-[#6F8A9D] animate-spin"></div>
          </div>
          <span className="text-[#92A2A5] text-sm font-medium">Loading customer data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full relative overflow-hidden p-4 sm:p-0">
      {/* Decorative Background */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-[#96AEC2]/8 to-[#6F8A9D]/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -left-32 w-80 h-80 bg-gradient-to-tr from-[#A2B9AF]/8 to-[#82A094]/8 rounded-full blur-3xl pointer-events-none" />
      
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] p-5 sm:p-6 shadow-2xl shadow-[#546A7A]/20">
        {/* Animated Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 hidden sm:block">
          <div className="absolute top-4 right-16 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-12 right-40 w-56 h-56 border-4 border-white/30 rounded-full" />
          <div className="absolute top-12 left-1/4 w-20 h-20 border-2 border-white/40 rounded-full" />
        </div>
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer-slide_4s_ease-in-out_infinite]" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link 
              href={`/finance/ar/customers/${params.id}`}
              className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-all border border-white/20 shadow-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-start gap-4">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-xl border border-white/20">
                <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#CE9F6B] rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  Edit Customer
                </h1>
                <p className="text-white/70 text-sm mt-0.5">Update customer information</p>
                <p className="text-white/90 font-mono text-sm mt-2 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-lg inline-block border border-white/20">
                  {formData.bpCode}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10 border border-[#82A094]/30 rounded-xl text-[#4F6A64] animate-in slide-in-from-top shadow-lg shadow-[#82A094]/10">
          <div className="p-1 rounded-full bg-[#82A094]/20">
            <CheckCircle className="w-5 h-5" />
          </div>
          <span className="font-semibold">Customer updated successfully! Redirecting...</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border border-[#E17F70]/30 rounded-xl text-[#9E3B47] shadow-lg shadow-[#E17F70]/10">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-full bg-[#E17F70]/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1.5 hover:bg-[#E17F70]/20 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Information */}
        <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 overflow-hidden shadow-lg hover:shadow-xl hover:border-[#6F8A9D]/50 transition-all group">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
          <div className="px-5 py-4 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#6F8A9D]/10 via-[#96AEC2]/5 to-transparent">
            <h3 className="text-lg font-bold text-[#546A7A] flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/30">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              Basic Information
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="group/input">
                <label className="block text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2">
                  BP Code <span className="text-[#E17F70]">*</span>
                </label>
                <input
                  type="text"
                  name="bpCode"
                  value={formData.bpCode}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#96AEC2]/5 to-[#6F8A9D]/5 border-2 border-[#6F8A9D]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#6F8A9D] focus:outline-none focus:ring-4 focus:ring-[#6F8A9D]/20 focus:bg-white transition-all uppercase font-mono font-bold shadow-sm hover:border-[#6F8A9D]/50"
                  placeholder="BP001"
                  required
                />
              </div>
              <div className="lg:col-span-2 group/input">
                <label className="block text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2">
                  Customer Name <span className="text-[#E17F70]">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#96AEC2]/5 to-[#6F8A9D]/5 border-2 border-[#6F8A9D]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#6F8A9D] focus:outline-none focus:ring-4 focus:ring-[#6F8A9D]/20 focus:bg-white transition-all font-bold shadow-sm hover:border-[#6F8A9D]/50"
                  placeholder="Company Name Ltd."
                  required
                />
              </div>
              <div className="group/input">
                <label className="block text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Region
                </label>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#96AEC2]/5 to-[#6F8A9D]/5 border-2 border-[#6F8A9D]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#6F8A9D] focus:outline-none focus:ring-4 focus:ring-[#6F8A9D]/20 focus:bg-white transition-all shadow-sm hover:border-[#6F8A9D]/50"
                  placeholder="North India"
                />
              </div>
              <div className="group/input">
                <label className="block text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2">Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#96AEC2]/5 to-[#6F8A9D]/5 border-2 border-[#6F8A9D]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#6F8A9D] focus:outline-none focus:ring-4 focus:ring-[#6F8A9D]/20 focus:bg-white transition-all shadow-sm hover:border-[#6F8A9D]/50"
                  placeholder="Finance"
                />
              </div>
              <div className="group/input">
                <label className="block text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2">
                  Credit Limit
                </label>
                <input
                  type="text"
                  name="creditLimit"
                  value={formData.creditLimit ? Number(formData.creditLimit.replace(/,/g, '')).toLocaleString('en-IN') : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/,/g, '');
                    if (val === '' || /^\d+$/.test(val)) {
                      setFormData(prev => ({ ...prev, creditLimit: val }));
                    }
                  }}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 border-2 border-[#CE9F6B]/30 text-[#976E44] placeholder:text-[#92A2A5] focus:border-[#CE9F6B] focus:outline-none focus:ring-4 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all font-bold shadow-sm hover:border-[#CE9F6B]/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 overflow-hidden shadow-lg hover:shadow-xl hover:border-[#82A094]/50 transition-all group">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
          <div className="px-5 py-4 border-b-2 border-[#82A094]/20 bg-gradient-to-r from-[#82A094]/10 via-[#A2B9AF]/5 to-transparent">
            <h3 className="text-lg font-bold text-[#4F6A64] flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/30">
                <User className="w-5 h-5 text-white" />
              </div>
              Contact Information
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="group/input">
                <label className="block text-[#82A094] text-xs uppercase tracking-wider font-bold mb-2">Person In Charge</label>
                <input
                  type="text"
                  name="personInCharge"
                  value={formData.personInCharge}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#82A094]/5 to-[#4F6A64]/5 border-2 border-[#82A094]/30 text-[#4F6A64] placeholder:text-[#92A2A5] focus:border-[#82A094] focus:outline-none focus:ring-4 focus:ring-[#82A094]/20 focus:bg-white transition-all shadow-sm hover:border-[#82A094]/50 font-medium"
                  placeholder="John Doe"
                />
              </div>
              <div className="group/input">
                <label className="block text-[#82A094] text-xs uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Contact Number
                </label>
                <input
                  type="tel"
                  name="contactNo"
                  value={formData.contactNo}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#82A094]/5 to-[#4F6A64]/5 border-2 border-[#82A094]/30 text-[#4F6A64] placeholder:text-[#92A2A5] focus:border-[#82A094] focus:outline-none focus:ring-4 focus:ring-[#82A094]/20 focus:bg-white transition-all shadow-sm hover:border-[#82A094]/50 font-medium"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="group/input">
                <label className="block text-[#82A094] text-xs uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email ID
                </label>
                <input
                  type="email"
                  name="emailId"
                  value={formData.emailId}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#82A094]/5 to-[#4F6A64]/5 border-2 border-[#82A094]/30 text-[#4F6A64] placeholder:text-[#92A2A5] focus:border-[#82A094] focus:outline-none focus:ring-4 focus:ring-[#82A094]/20 focus:bg-white transition-all shadow-sm hover:border-[#82A094]/50 font-medium"
                  placeholder="contact@company.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Risk Classification */}
        <div className="relative bg-white rounded-2xl border-2 border-[#CE9F6B]/30 overflow-hidden shadow-lg hover:shadow-xl hover:border-[#CE9F6B]/50 transition-all group">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#EEC1BF]" />
          <div className="px-5 py-4 border-b-2 border-[#CE9F6B]/20 bg-gradient-to-r from-[#CE9F6B]/10 via-[#976E44]/5 to-transparent">
            <h3 className="text-lg font-bold text-[#976E44] flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/30">
                <Shield className="w-5 h-5 text-white" />
              </div>
              Risk Classification
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {riskOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRiskChange(option.value)}
                  className={`relative p-5 rounded-xl border-2 transition-all text-left group/card hover:scale-[1.02]
                    ${formData.riskClass === option.value 
                      ? 'border-[#546A7A] bg-gradient-to-br from-[#546A7A]/10 to-[#6F8A9D]/5 shadow-xl shadow-[#546A7A]/20 scale-[1.02]' 
                      : 'border-[#AEBFC3]/40 hover:border-[#96AEC2] hover:bg-[#96AEC2]/5'
                    }`}
                >
                  {formData.riskClass === option.value && (
                    <div className="absolute top-3 right-3 p-1 rounded-full bg-[#82A094]">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${option.gradient} mb-4 shadow-xl ${option.shadow} group-hover/card:scale-110 transition-transform`} />
                  <p className="font-bold text-[#546A7A] text-sm mb-1">{option.label}</p>
                  <p className="text-[11px] text-[#92A2A5] leading-relaxed">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-white via-[#96AEC2]/5 to-white rounded-2xl border-2 border-[#96AEC2]/30 shadow-lg">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-24 h-24 bg-[#96AEC2]/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#82A094]/10 rounded-full blur-2xl" />
          
          <p className="relative text-[#5D6E73] text-sm font-medium">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E17F70]/15 text-[#E17F70] text-xs font-bold mr-1">!</span>
            Required fields
          </p>
          <div className="relative flex items-center gap-4 w-full sm:w-auto">
            <Link
              href={`/finance/ar/customers/${params.id}`}
              className="flex-1 sm:flex-none text-center px-6 py-3 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] hover:bg-[#AEBFC3]/10 hover:border-[#92A2A5] transition-all font-bold text-sm shadow-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || success}
              className="flex-1 sm:flex-none group flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] text-white font-bold hover:shadow-2xl hover:shadow-[#546A7A]/30 hover:-translate-y-1 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none text-sm"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
              )}
              {saving ? 'Saving...' : success ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
