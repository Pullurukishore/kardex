'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { arApi, BankAccountChangeRequest } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, Building2, Sparkles, Save, AlertCircle, 
  CheckCircle2, Mail, CreditCard, Hash, User, Loader2,
  Info, FileText, Upload, X, Shield
} from 'lucide-react';

interface FormData {
  bpCode: string;
  vendorName: string;
  beneficiaryBankName: string;
  accountNumber: string;
  ifscCode: string;
  emailId: string;
  beneficiaryName: string;
  confirmAccountNumber: string;
  nickName: string;
  isMSME: boolean;
  udyamRegNum: string;
  isGstRegistered: boolean;
  gstNumber: string;
  panNumber: string;
  currency: string;
  otherCurrency?: string;
  otherAccountNumbers: string[];
}

export default function EditRequestPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newOtherAccountNum, setNewOtherAccountNum] = useState('');
  const [newOtherConfirmAccountNum, setNewOtherConfirmAccountNum] = useState('');
  const [newOtherAccountIFSC, setNewOtherAccountIFSC] = useState('');
  const [newOtherAccountBank, setNewOtherAccountBank] = useState('');
  const [otherAccError, setOtherAccError] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    bpCode: '',
    vendorName: '',
    beneficiaryBankName: '',
    accountNumber: '',
    ifscCode: '',
    emailId: '',
    beneficiaryName: '',
    confirmAccountNumber: '',
    nickName: '',
    isMSME: false,
    udyamRegNum: '',
    isGstRegistered: true,
    gstNumber: '',
    panNumber: '',
    currency: 'INR',
    otherCurrency: '',
    otherAccountNumbers: []
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [originalRequest, setOriginalRequest] = useState<BankAccountChangeRequest | null>(null);

  useEffect(() => {
    loadRequest();
  }, [params.id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const request = await arApi.getRequestById(params.id as string);
      
      if (request.status !== 'REJECTED') {
        router.push(`/finance/bank-accounts/requests/${request.id}`);
        return;
      }

      setOriginalRequest(request);
      const data = request.requestedData as any;
      setFormData({
        bpCode: data.bpCode || '',
        vendorName: data.vendorName || '',
        beneficiaryBankName: data.beneficiaryBankName || '',
        accountNumber: data.accountNumber || '',
        ifscCode: data.ifscCode || '',
        emailId: data.emailId || '',
        beneficiaryName: data.beneficiaryName || data.vendorName || '',
        confirmAccountNumber: data.accountNumber || '',
        nickName: data.nickName || '',
        isMSME: data.isMSME || false,
        udyamRegNum: data.udyamRegNum || '',
        isGstRegistered: !!data.gstNumber && data.gstNumber !== 'UNREGISTERED',
        gstNumber: data.gstNumber || '',
        panNumber: data.panNumber || '',
        currency: ['INR', 'EUR', 'USD'].includes(data.currency) ? data.currency : 'Other',
        otherCurrency: ['INR', 'EUR', 'USD'].includes(data.currency) ? '' : data.currency,
        otherAccountNumbers: data.otherAccountNumbers || []
      });
    } catch (err) {
      console.error('Failed to load request:', err);
      setError('Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const val = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: val };
      if (name === 'isGstRegistered' && !checked) {
        newData.gstNumber = '';
      }
      return newData;
    });
    setError('');
  };

  const isNumericOnly = (val: string) => /^[0-9]*$/.test(val);
  const isLettersOnly = (val: string) => /^[a-zA-Z\s]*$/.test(val);

  const handleAddOtherAccountNumber = () => {
    const num = newOtherAccountNum.trim();
    const confirmNum = newOtherConfirmAccountNum.trim();
    const ifsc = newOtherAccountIFSC.trim().toUpperCase();
    const bank = newOtherAccountBank.trim();

    if (!num || !confirmNum || !ifsc || !bank) {
      setOtherAccError('Please fill in Account Number, Confirm Account Number, IFSC, and Bank Name');
      return;
    }
    if (num !== confirmNum) {
      setOtherAccError('Account numbers do not match');
      return;
    }
    if (!isNumericOnly(num)) {
      setOtherAccError('Account number must contain numbers only');
      return;
    }
    if (num === formData.accountNumber) {
      setOtherAccError('Cannot be the same as the primary account number');
      return;
    }

    // Check if the account number already exists in the otherAccountNumbers list
    const isDuplicate = (formData.otherAccountNumbers || []).some(item => {
      const existingNum = item.includes('|') ? item.split('|')[0] : item;
      return existingNum === num;
    });
    if (isDuplicate) {
      setOtherAccError('This account number has already been added');
      return;
    }

    const encoded = `${num}|${ifsc}|${bank}`;
    setFormData(prev => ({
      ...prev,
      otherAccountNumbers: [...(prev.otherAccountNumbers || []), encoded]
    }));
    setNewOtherAccountNum('');
    setNewOtherConfirmAccountNum('');
    setNewOtherAccountIFSC('');
    setNewOtherAccountBank('');
    setOtherAccError('');
  };

  const handleRemoveOtherAccountNumber = (index: number) => {
    setFormData(prev => ({
      ...prev,
      otherAccountNumbers: (prev.otherAccountNumbers || []).filter((_, i) => i !== index)
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (!formData.vendorName || !formData.beneficiaryBankName || 
          !formData.accountNumber || !formData.ifscCode) {
        setError('Please fill in all required fields');
        setSubmitting(false);
        return;
      }

      // Smart Mandatory Validation for GST/PAN (only for INR)
      if (formData.currency === 'INR') {
        if (formData.isGstRegistered && !formData.gstNumber) {
          setError('GST Number is required for INR transactions');
          setSubmitting(false);
          return;
        }
        if (!formData.panNumber) {
          setError('PAN Number is required for INR transactions');
          setSubmitting(false);
          return;
        }
      }
      
      if (formData.accountNumber !== formData.confirmAccountNumber) {
        setError('Account numbers do not match');
        setSubmitting(false);
        return;
      }
      const { confirmAccountNumber, otherCurrency, isGstRegistered, ...apiData } = formData;
      // Override currency if 'Other' is selected
      if (formData.currency === 'Other') {
        apiData.currency = formData.otherCurrency || 'Other';
      }

      // Check if any fields were changed compared to the rejected request
      const hasFieldChanges = Object.keys(apiData).some(key => {
        const newVal = (apiData as any)[key];
        const oldVal = (originalRequest?.requestedData as any)?.[key];
        // Treat undefined, null, and empty string as equivalent for comparison
        if (!newVal && !oldVal) return false;
        if (key === 'otherAccountNumbers') {
          const orig = JSON.stringify([...(oldVal || [])].sort());
          const curr = JSON.stringify([...(newVal || [])].sort());
          return orig !== curr;
        }
        return newVal !== oldVal;
      });

      if (!hasFieldChanges && selectedFiles.length === 0) {
        setError('No changes detected to the request details or attachments.');
        setSubmitting(false);
        return;
      }
      
      // Create a NEW request based on the edited data
      const newRequest = await arApi.createBankAccountRequest({
        bankAccountId: originalRequest?.bankAccountId,
        requestType: originalRequest?.requestType || 'CREATE',
        requestedData: apiData
      });
      
      // Upload new attachments if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          await arApi.uploadBankAccountAttachment(newRequest.id, file);
        }
      }
      
      setSuccess('New request submitted successfully!');
      setTimeout(() => router.push('/finance/bank-accounts/requests'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-[#CE9F6B]/30 border-t-[#CE9F6B] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/finance/bank-accounts/requests/${params.id}`}
          className="p-2.5 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] hover:text-[#546A7A] hover:border-[#CE9F6B]/30 hover:shadow-lg transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#546A7A] flex items-center gap-2">
            Edit & Re-request
            <Sparkles className="w-5 h-5 text-[#CE9F6B]" />
          </h1>
          <p className="text-[#92A2A5] text-sm mt-1 font-medium">
            Fix and resubmit your rejected request
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Rejection Note Info */}
          {originalRequest?.reviewNotes && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#E17F70]/10 border border-[#E17F70]/20 mb-6">
              <AlertCircle className="w-5 h-5 text-[#E17F70] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#5D6E73]">
                <p className="font-semibold text-[#E17F70] mb-1">Rejection Reason</p>
                <p>{originalRequest.reviewNotes}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-lg">
            <div className="p-6 border-b border-[#AEBFC3]/10 bg-gradient-to-r from-[#F8FAFB] to-white">
              <h2 className="text-lg font-bold text-[#546A7A] flex items-center gap-2">
                <User className="w-5 h-5 text-[#CE9F6B]" />
                Vendor Information
              </h2>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-[#E17F70]/10 border border-[#E17F70]/20 text-[#E17F70]">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-[#82A094]/10 border border-[#82A094]/20 text-[#4F6A64]">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{success}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    BP Code / Vendor Code <span className="text-[#E17F70]">*</span>
                  </label>
                  <input
                    type="text"
                    name="bpCode"
                    value={formData.bpCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] uppercase font-bold tracking-wider"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    Vendor Name <span className="text-[#E17F70]">*</span>
                  </label>
                  <input
                    type="text"
                    name="vendorName"
                    value={formData.vendorName}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73]">Nick Name</label>
                  <input
                    type="text"
                    name="nickName"
                    value={formData.nickName}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73]">Email ID</label>
                  <input
                    type="email"
                    name="emailId"
                    value={formData.emailId}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A]"
                  />
                </div>



                <div className="md:col-span-2 flex flex-col gap-4 p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${formData.isMSME ? 'bg-[#CE9F6B]/20 text-[#CE9F6B]' : 'bg-[#AEBFC3]/20 text-[#5D6E73]'}`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-[#546A7A]">MSME Registered Vendor?</p>
                        <p className="text-xs text-[#92A2A5]">Is this vendor registered as a Micro, Small, or Medium Enterprise?</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="isMSME"
                        checked={formData.isMSME}
                        onChange={handleChange}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-[#AEBFC3]/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#CE9F6B]"></div>
                    </label>
                  </div>

                  {formData.isMSME && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                        Udyam Registration Number <span className="text-[#E17F70]">*</span>
                      </label>
                      <input
                        type="text"
                        name="udyamRegNum"
                        value={formData.udyamRegNum}
                        onChange={handleChange}
                        placeholder="UDYAM-XX-00-0000000"
                        className="w-full px-4 py-3.5 bg-white border border-[#CE9F6B]/30 rounded-xl text-[#546A7A] placeholder-[#92A2A5] focus:outline-none focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/20 transition-all font-mono"
                        required={formData.isMSME}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#AEBFC3]/10 bg-gradient-to-r from-[#F8FAFB] to-white">
              <h2 className="text-lg font-bold text-[#546A7A] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#CE9F6B]" />
                Bank Details
              </h2>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73]">Currency *</label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="Other">Other (Specify...)</option>
                  </select>
                </div>
                {formData.currency === 'Other' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-sm font-semibold text-[#5D6E73]">Specify Currency *</label>
                    <input
                      type="text"
                      name="otherCurrency"
                      value={formData.otherCurrency}
                      onChange={handleChange}
                      placeholder="e.g., GBP, JPY, CAD"
                      className="w-full px-4 py-3.5 bg-white border border-[#CE9F6B]/30 rounded-xl text-[#546A7A] placeholder-[#92A2A5] focus:outline-none focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/20 transition-all uppercase"
                      required={formData.currency === 'Other'}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                      <Shield className="w-4 h-4 text-[#CE9F6B]" />
                      GST Registered?
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="isGstRegistered"
                        checked={formData.isGstRegistered}
                        onChange={handleChange}
                        className="sr-only peer" 
                      />
                      <div 
                        className="w-11 h-6 bg-[#AEBFC3]/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#CE9F6B]"
                      ></div>
                    </label>
                  </div>

                  {formData.isGstRegistered ? (
                    <>
                      <label className="text-sm font-semibold text-[#5D6E73]">GST Number {formData.currency === 'INR' && <span className="text-[#E17F70]">*</span>}</label>
                      <input
                        type="text"
                        name="gstNumber"
                        value={formData.gstNumber}
                        onChange={handleChange}
                        placeholder="22AAAAA0000A1Z5"
                        className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] uppercase"
                      />
                    </>
                  ) : (
                    <div className="p-4 rounded-xl flex items-center gap-3 border border-[#CE9F6B]/20 bg-white shadow-sm mt-3">
                      <Info className="w-5 h-5 text-[#CE9F6B]" />
                      <div>
                        <p className="text-sm font-bold text-[#546A7A]">Unregistered Vendor</p>
                        <p className="text-xs text-[#92A2A5]">GST details will not be captured.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73]">PAN Number {formData.currency === 'INR' && <span className="text-[#E17F70]">*</span>}</label>
                  <input
                    type="text"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleChange}
                    placeholder="ABCDE1234F"
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] uppercase"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#5D6E73]">Beneficiary Bank Name *</label>
                <input
                  type="text"
                  name="beneficiaryBankName"
                  value={formData.beneficiaryBankName}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73]">Account Number *</label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] font-mono"
                    required
                  />
                  {formData.accountNumber !== formData.confirmAccountNumber && (
                    <p className="text-[10px] text-[#E17F70] font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      Account numbers do not match
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73]">IFSC Code / SWIFT Code *</label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] font-mono uppercase"
                    required
                  />
                </div>

                {/* Another Bank Account Details */}
                <div className="md:col-span-2 space-y-4 pt-4 border-t border-[#AEBFC3]/20">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <Building2 className="w-4 h-4 text-[#CE9F6B]" />
                    Another Bank Account Details
                    <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-[#92A2A5]">
                      Optional secondary accounts
                    </span>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6E73]">Account Number</label>
                      <input
                        type="text"
                        value={newOtherAccountNum}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || isNumericOnly(val)) {
                            setNewOtherAccountNum(val);
                            setOtherAccError('');
                          }
                        }}
                        placeholder="e.g. 1234567890"
                        maxLength={18}
                        className={`w-full px-4 py-2.5 rounded-xl font-mono font-bold text-sm tracking-wider transition-all focus:outline-none border-2 text-[#546A7A] bg-white ${otherAccError ? 'border-[#E17F70]' : 'border-[#AEBFC3]/30 focus:border-[#CE9F6B]/50'
                          }`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6E73]">Confirm Account Number</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={newOtherConfirmAccountNum}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || isNumericOnly(val)) {
                              setNewOtherConfirmAccountNum(val);
                              setOtherAccError('');
                            }
                          }}
                          placeholder="Re-type account number"
                          maxLength={18}
                          className={`w-full pl-4 pr-10 py-2.5 rounded-xl font-mono font-bold text-sm tracking-wider transition-all focus:outline-none border-2 text-[#546A7A] bg-white ${
                            newOtherConfirmAccountNum && newOtherAccountNum !== newOtherConfirmAccountNum
                              ? 'border-[#E17F70]'
                              : 'border-[#AEBFC3]/30 focus:border-[#CE9F6B]/50'
                          }`}
                        />
                        {newOtherConfirmAccountNum && newOtherAccountNum === newOtherConfirmAccountNum && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <CheckCircle2 className="w-4 h-4" style={{ color: '#82A094' }} />
                          </div>
                        )}
                        {newOtherConfirmAccountNum && newOtherAccountNum !== newOtherConfirmAccountNum && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-bounce">
                            <AlertCircle className="w-4 h-4" style={{ color: '#E17F70' }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6E73]">IFSC / SWIFT Code</label>
                      <input
                        type="text"
                        value={newOtherAccountIFSC}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setNewOtherAccountIFSC(val);
                          setOtherAccError('');
                        }}
                        placeholder="e.g. SBIN0001234"
                        maxLength={11}
                        className={`w-full px-4 py-2.5 rounded-xl font-mono font-bold text-sm tracking-widest transition-all focus:outline-none border-2 text-[#546A7A] bg-white ${otherAccError ? 'border-[#E17F70]' : 'border-[#AEBFC3]/30 focus:border-[#CE9F6B]/50'
                          }`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6E73]">Beneficiary Bank Name</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOtherAccountBank}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || isLettersOnly(val)) {
                              setNewOtherAccountBank(val);
                              setOtherAccError('');
                            }
                          }}
                          placeholder="e.g. State Bank of India"
                          maxLength={50}
                          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none border-2 text-[#546A7A] bg-white ${otherAccError ? 'border-[#E17F70]' : 'border-[#AEBFC3]/30 focus:border-[#CE9F6B]/50'
                            }`}
                        />
                        <button
                          type="button"
                          onClick={handleAddOtherAccountNumber}
                          className="px-4 py-2.5 rounded-xl font-bold bg-[#CE9F6B] text-white hover:bg-[#976E44] shadow-md shadow-[#CE9F6B]/20 transition-all text-xs"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {otherAccError && (
                    <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {otherAccError}
                    </p>
                  )}

                  {formData.otherAccountNumbers && formData.otherAccountNumbers.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                      {formData.otherAccountNumbers.map((item, idx) => {
                        const [accNum, ifsc, bankName] = item.includes('|')
                          ? item.split('|')
                          : [item, '—', '—'];
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8FAFB] border border-[#AEBFC3]/30 hover:border-[#CE9F6B]/40 hover:bg-white transition-all text-[#546A7A] text-xs"
                          >
                            <div className="space-y-1">
                              <p className="font-black text-[#976E44] uppercase tracking-tight">{bankName}</p>
                              <p className="font-mono text-[#546A7A]/80">A/C: <span className="font-bold">{accNum}</span></p>
                              <p className="font-mono text-[#92A2A5] text-[10px]">IFSC: <span className="font-bold">{ifsc}</span></p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveOtherAccountNumber(idx)}
                              className="p-2 rounded-xl bg-white border border-[#AEBFC3]/20 hover:bg-[#E17F70]/20 hover:text-[#E17F70] transition-colors"
                              title="Remove additional account"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="p-6 border-t border-[#AEBFC3]/10">
              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[#AEBFC3]/30 rounded-2xl bg-[#F8FAFB] cursor-pointer hover:bg-[#82A094]/5 transition-all">
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-[#92A2A5] mb-2" />
                  <p className="text-sm text-[#5D6E73] font-semibold">Upload new verification documents</p>
                </div>
                <input type="file" className="hidden" multiple onChange={handleFileSelect} />
              </label>

              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#AEBFC3]/20 shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-4 h-4 text-[#82A094]" />
                        <p className="text-sm font-bold text-[#546A7A] truncate">{file.name}</p>
                      </div>
                      <button type="button" onClick={() => removeFile(index)} className="text-[#92A2A5] hover:text-[#E17F70]">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[#AEBFC3]/10 bg-[#F8FAFB] flex items-center gap-4">
              <Link
                href={`/finance/bank-accounts/requests/${params.id}`}
                className="px-6 py-3 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] font-semibold hover:bg-[#AEBFC3]/10 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !!success}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold hover:from-[#4F6A64] hover:to-[#3D524D] transition-all duration-300 shadow-lg shadow-[#82A094]/25 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Submit New Request
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Preview */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-lg sticky top-6">
            <div className="p-5 border-b border-[#AEBFC3]/10 bg-gradient-to-r from-[#CE9F6B]/10 to-transparent">
              <h3 className="font-bold text-[#546A7A] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#CE9F6B]" />
                New Preview
              </h3>
            </div>
            <div className="p-5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center mb-4 shadow-lg">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h4 className="text-lg font-bold text-[#546A7A] mb-1">{formData.vendorName || 'Vendor Name'}</h4>
              <div className="space-y-2 text-sm border-t border-[#AEBFC3]/10 pt-4">
                <div className="flex justify-between">
                  <span className="text-[#92A2A5]">BP Code:</span>
                  <span className="text-[#546A7A] font-medium">{formData.bpCode || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#92A2A5]">Bank:</span>
                  <span className="text-[#546A7A] font-medium">{formData.beneficiaryBankName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#92A2A5]">A/C:</span>
                  <span className="text-[#546A7A] font-mono">****{formData.accountNumber.slice(-4) || '----'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#92A2A5]">IFSC/SWIFT:</span>
                  <span className="text-[#CE9F6B] font-mono">{formData.ifscCode || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#92A2A5]">GST:</span>
                  <span className="text-[#546A7A] font-mono">{formData.gstNumber || 'Unregistered'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#92A2A5]">PAN:</span>
                  <span className="text-[#546A7A] font-mono">{formData.panNumber || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
