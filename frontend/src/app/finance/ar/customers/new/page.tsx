'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi } from '@/lib/ar-api';
import { 
  ArrowLeft, Save, Loader2, Building2, Sparkles, User, Mail, Phone, 
  MapPin, Shield, CheckCircle, AlertTriangle, X, UserPlus
} from 'lucide-react';

const riskOptions = [
  { value: 'LOW', label: 'Low Risk', color: 'bg-[#82A094]', description: 'Good payment history' },
  { value: 'MEDIUM', label: 'Medium Risk', color: 'bg-[#CE9F6B]', description: 'Occasional delays' },
  { value: 'HIGH', label: 'High Risk', color: 'bg-[#E17F70]', description: 'Frequent issues' },
  { value: 'CRITICAL', label: 'Critical', color: 'bg-[#9E3B47]', description: 'Immediate attention' },
];

export default function NewCustomerPage() {
  const router = useRouter();
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
      await arApi.createCustomer({
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
        router.push('/finance/ar/customers');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF] p-6 shadow-xl">
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 right-32 w-48 h-48 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-start gap-4">
          <Link 
            href="/finance/ar/customers"
            className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Add New Customer
                <Sparkles className="w-5 h-5 text-white/70" />
              </h1>
              <p className="text-white/70 text-sm mt-1">Create a new customer in the AR system</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-[#82A094]/10 border-2 border-[#82A094]/30 rounded-xl text-[#4F6A64] animate-in slide-in-from-top">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Customer created successfully! Redirecting...</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-[#E17F70]/10 border-2 border-[#E17F70]/30 rounded-xl text-[#9E3B47]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-[#E17F70]/20 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#6F8A9D]/20 overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#6F8A9D]/5 to-transparent">
            <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#6F8A9D]" />
              Basic Information
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-[#5D6E73] text-sm font-medium mb-2">
                  BP Code <span className="text-[#E17F70]">*</span>
                </label>
                <input
                  type="text"
                  name="bpCode"
                  value={formData.bpCode}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all uppercase font-mono"
                  placeholder="BP001"
                  required
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[#5D6E73] text-sm font-medium mb-2">
                  Customer Name <span className="text-[#E17F70]">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all"
                  placeholder="Company Name Ltd."
                  required
                />
              </div>
              <div>
                <label className="block text-[#5D6E73] text-sm font-medium mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Region
                </label>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all"
                  placeholder="North India"
                />
              </div>
                <div>
                  <label className="block text-[#5D6E73] text-sm font-medium mb-2">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all"
                    placeholder="Finance"
                  />
                </div>
                <div>
                  <label className="block text-[#5D6E73] text-sm font-medium mb-2">
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
                    className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all font-semibold"
                    
                  />
                </div>
              </div>
            </div>
          </div>

        {/* Contact Information */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#82A094]/20 overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#82A094]/5 to-transparent">
            <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2">
              <User className="w-5 h-5 text-[#82A094]" />
              Contact Information
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-[#5D6E73] text-sm font-medium mb-2">Person In Charge</label>
                <input
                  type="text"
                  name="personInCharge"
                  value={formData.personInCharge}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-[#5D6E73] text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Contact Number
                </label>
                <input
                  type="tel"
                  name="contactNo"
                  value={formData.contactNo}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-[#5D6E73] text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email ID
                </label>
                <input
                  type="email"
                  name="emailId"
                  value={formData.emailId}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl bg-[#AEBFC3]/10 border-2 border-[#AEBFC3]/30 text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all"
                  placeholder="contact@company.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Risk Classification */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#CE9F6B]/5 to-transparent">
            <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#CE9F6B]" />
              Risk Classification
            </h3>
          </div>
          <div className="p-6">
            <p className="text-[#92A2A5] text-sm mb-4">Select the risk classification for this customer based on their payment history</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {riskOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRiskChange(option.value)}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left
                    ${formData.riskClass === option.value 
                      ? 'border-[#546A7A] bg-[#546A7A]/5 shadow-lg' 
                      : 'border-[#AEBFC3]/30 hover:border-[#82A094]/40 hover:bg-[#82A094]/5'
                    }`}
                >
                  {formData.riskClass === option.value && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="w-5 h-5 text-[#82A094]" />
                    </div>
                  )}
                  <div className={`w-3 h-3 rounded-full ${option.color} mb-3`} />
                  <p className="font-semibold text-[#546A7A]">{option.label}</p>
                  <p className="text-xs text-[#92A2A5] mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 bg-white/90 backdrop-blur-xl rounded-2xl border border-[#AEBFC3]/20 shadow-lg">
          <p className="text-[#92A2A5] text-sm">
            <span className="text-[#E17F70]">*</span> Required fields
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/finance/ar/customers"
              className="px-6 py-3 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] hover:bg-[#AEBFC3]/10 hover:border-[#82A094]/30 transition-all font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || success}
              className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold hover:shadow-xl hover:shadow-[#82A094]/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
              )}
              {saving ? 'Creating...' : success ? 'Created!' : 'Create Customer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
