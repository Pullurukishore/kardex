'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { arApi, BankAccount } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Building2, Sparkles, Save, AlertCircle, 
  CheckCircle2, Mail, CreditCard, Hash, User, Loader2,
  Info, ArrowRight, FileSpreadsheet, Globe, Shield,
  Upload, FileText, FileIcon, Trash2, Download,
  FileImage, File, Eye
} from 'lucide-react';
import FilePreview from '@/components/FilePreview';

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
  gstNumber: string;
  panNumber: string;
  currency: string;
  accountType: string;
  otherCurrency?: string;
}

export default function EditBankAccountPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [originalAccount, setOriginalAccount] = useState<BankAccount | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadVendorType, setUploadVendorType] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

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
    gstNumber: '',
    panNumber: '',
    currency: 'INR',
    accountType: '',
    otherCurrency: ''
  });

  useEffect(() => {
    loadAccount();
    loadAttachments();
  }, [params.id]);

  const loadAttachments = async () => {
    try {
      const data = await arApi.getBankAccountAttachments(params.id as string);
      setAttachments(data);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const loadAccount = async () => {
    try {
      setLoading(true);
      const data = await arApi.getBankAccountById(params.id as string);
      setOriginalAccount(data);
      setFormData({
        bpCode: data.bpCode || '',
        vendorName: data.vendorName,
        beneficiaryBankName: data.beneficiaryBankName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        emailId: data.emailId || '',
        beneficiaryName: data.beneficiaryName || data.vendorName,
        confirmAccountNumber: data.accountNumber,
        nickName: data.nickName || '',
        isMSME: data.isMSME || false,
        udyamRegNum: data.udyamRegNum || '',
        gstNumber: data.gstNumber || '',
        panNumber: data.panNumber || '',
        currency: ['INR', 'EUR', 'USD'].includes(data.currency) ? data.currency : 'Other',
        accountType: data.accountType || '',
        otherCurrency: ['INR', 'EUR', 'USD'].includes(data.currency) ? '' : data.currency
      });
    } catch (error) {
      console.error('Failed to load bank account:', error);
      setError('Failed to load bank account');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => {
      const val = type === 'checkbox' ? checked : value;
      const newData = { ...prev, [name]: val };
      
      // Default beneficiaryName to vendorName if it was matching or empty (and it's a new vendor name)
      if (name === 'vendorName' && (prev.beneficiaryName === prev.vendorName || prev.beneficiaryName === '')) {
        newData.beneficiaryName = value;
      }
      
      return newData;
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!formData.vendorName || !formData.beneficiaryBankName || 
          !formData.accountNumber || !formData.ifscCode) {
        setError('Please fill in all required fields');
        setSaving(false);
        return;
      }

      // Smart Mandatory Validation for GST/PAN (only for INR)
      if (formData.currency === 'INR') {
        if (!formData.gstNumber) {
          setError('GST Number is required for INR transactions');
          setSaving(false);
          return;
        }
        if (!formData.panNumber) {
          setError('PAN Number is required for INR transactions');
          setSaving(false);
          return;
        }
      }
      
      if (formData.accountNumber !== formData.confirmAccountNumber) {
        setError('Account numbers do not match');
        setSaving(false);
        return;
      }

      const { confirmAccountNumber, otherCurrency, ...apiData } = formData;
      // Override currency if 'Other' is selected
      if (formData.currency === 'Other') {
        apiData.currency = formData.otherCurrency || 'Other';
      }

      if (isAdmin) {
        await arApi.updateBankAccount(params.id as string, apiData);
        setSuccess('Vendor account updated successfully!');
        setTimeout(() => router.push(`/finance/bank-accounts/${params.id}`), 1500);
      } else {
        await arApi.createBankAccountRequest({
          bankAccountId: params.id as string,
          requestType: 'UPDATE',
          requestedData: apiData
        });
        setSuccess('Update request submitted! Waiting for admin approval.');
        setTimeout(() => router.push('/finance/bank-accounts/requests'), 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowUploadModal(true);
    e.target.value = ''; // Reset input
  };

  const handleUpload = async () => {
    if (!pendingFile || !uploadVendorType) {
      alert('Please select a vendor type');
      return;
    }

    try {
      setUploading(true);
      await arApi.uploadBankAccountAttachment(params.id as string, pendingFile, uploadVendorType);
      await loadAttachments();
      setShowUploadModal(false);
      setPendingFile(null);
      setUploadVendorType('');
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      alert('Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await arApi.deleteBankAccountAttachment(attachmentId);
      await loadAttachments();
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      alert('Failed to delete attachment');
    }
  };

  const handleDownload = async (attachmentId: string) => {
    arApi.downloadBankAccountAttachment(attachmentId);
  };

  const handleUpdateVendorType = async (attachmentId: string, vendorType: string) => {
    try {
      await arApi.updateBankAccountAttachmentVendorType(attachmentId, vendorType);
      await loadAttachments();
    } catch (error) {
      console.error('Failed to update vendor type:', error);
      alert('Failed to update vendor type');
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage className="w-5 h-5" />;
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5" />;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const getFileColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'text-blue-500 bg-blue-50';
    if (mimeType.includes('pdf')) return 'text-red-500 bg-red-50';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'text-emerald-500 bg-emerald-50';
    return 'text-gray-500 bg-gray-50';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hasChanges = (field: keyof FormData) => {
    if (!originalAccount || field === 'confirmAccountNumber') return false;
    
    const originalValue = (originalAccount as any)[field];
    const currentValue = formData[field];

    // 1. Handle specialized boolean defaults
    if (field === 'isMSME') {
      return (currentValue || false) !== (originalValue || false);
    }

    // 2. Handle specialized string defaults that match loadAccount() logic
    if (field === 'accountType') {
      return currentValue !== (originalValue || '');
    }

    if (field === 'beneficiaryName') {
      return currentValue !== (originalValue || originalAccount.vendorName);
    }

    // 3. Handle currency specially since it split into two fields in the form
    if (field === 'currency') {
      const originalCurrency = ['INR', 'EUR', 'USD'].includes(originalAccount.currency) 
        ? originalAccount.currency 
        : 'Other';
      return currentValue !== originalCurrency;
    }

    if (field === 'otherCurrency') {
      const originalOtherCurrency = ['INR', 'EUR', 'USD'].includes(originalAccount.currency) 
        ? '' 
        : originalAccount.currency;
      return currentValue !== originalOtherCurrency;
    }

    // 4. Standard string comparison with empty string fallback
    if (typeof currentValue === 'string') {
      return currentValue !== (originalValue || '');
    }

    return currentValue !== originalValue;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#CE9F6B]/20 border-t-[#CE9F6B] rounded-full animate-spin" />
          <Building2 className="w-6 h-6 text-[#CE9F6B] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-4 text-sm font-medium text-[#92A2A5]">Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/finance/bank-accounts/${params.id}`)}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#546A7A] truncate">
              {isAdmin ? 'Edit Vendor Account' : 'Request Changes'}
            </h1>
            <p className="text-[#5D6E73] mt-1 text-sm sm:text-base truncate">
              {originalAccount?.vendorName} • <span className="font-bold text-[#CE9F6B]">{originalAccount?.currency} {originalAccount?.accountType || ''} Account</span>
            </p>
          </div>
        </div>
      </div>

      {/* Info banner for non-admin */}
      {!isAdmin && (
        <Card className="border-[#6F8A9D]/30 bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#6F8A9D]/20 rounded-lg">
                <Info className="w-5 h-5 text-[#6F8A9D]" />
              </div>
              <div className="text-sm text-[#5D6E73]">
                <p className="font-semibold text-[#6F8A9D] mb-1">Request Mode</p>
                <p>Your changes will be sent to a Finance Admin for approval before being applied.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error/Success Messages */}
            {error && (
              <Card className="border-[#E17F70]/30 bg-gradient-to-r from-[#E17F70]/10 to-[#E17F70]/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#E17F70]/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-[#E17F70]" />
                    </div>
                    <span className="text-sm font-medium text-[#E17F70]">{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {success && (
              <Card className="border-[#82A094]/30 bg-gradient-to-r from-[#82A094]/10 to-[#82A094]/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#82A094]/20 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-[#4F6A64]" />
                    </div>
                    <span className="text-sm font-medium text-[#4F6A64]">{success}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vendor Information Card */}
            <Card className="shadow-xl overflow-hidden border-0">
              <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-b-0 py-4 sm:py-6">
                <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                  <User className="h-5 w-5 sm:h-6 sm:w-6" />
                  Vendor Information
                </CardTitle>
                <CardDescription className="text-white/80 text-sm">
                  Basic vendor details and registration information
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className={`space-y-2 ${hasChanges('bpCode') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <Shield className="w-4 h-4 text-[#CE9F6B]" />
                    BP Code / Vendor Code <span className="text-[#E17F70]">*</span>
                    {hasChanges('bpCode') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="bpCode"
                    value={formData.bpCode}
                    onChange={handleChange}
                    maxLength={15}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all uppercase tracking-wider font-bold"
                    required
                  />
                </div>

                <div className={`space-y-2 ${hasChanges('vendorName') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <User className="w-4 h-4 text-[#CE9F6B]" />
                    Vendor Name <span className="text-[#E17F70]">*</span>
                    {hasChanges('vendorName') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="vendorName"
                    value={formData.vendorName}
                    onChange={handleChange}
                    maxLength={100}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all"
                    required
                  />
                </div>

                <div className={`space-y-2 ${hasChanges('nickName') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <Hash className="w-4 h-4 text-[#CE9F6B]" />
                    Nick Name
                    {hasChanges('nickName') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="nickName"
                    value={formData.nickName}
                    onChange={handleChange}
                    maxLength={30}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all"
                  />
                </div>

                <div className={`space-y-2 ${hasChanges('emailId') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <Mail className="w-4 h-4 text-[#CE9F6B]" />
                    Email ID
                    {hasChanges('emailId') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="email"
                    name="emailId"
                    value={formData.emailId}
                    onChange={handleChange}
                    maxLength={50}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all"
                  />
                </div>



                <div className={`md:col-span-2 flex flex-col gap-4 p-4 rounded-xl ${hasChanges('isMSME') || hasChanges('udyamRegNum') ? 'bg-[#CE9F6B]/5 border-[#CE9F6B]/30' : 'bg-[#F8FAFB] border-[#AEBFC3]/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${formData.isMSME ? 'bg-[#CE9F6B]/20 text-[#CE9F6B]' : 'bg-[#AEBFC3]/20 text-[#5D6E73]'}`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[#546A7A]">MSME Registered Vendor?</p>
                          {hasChanges('isMSME') && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#CE9F6B]/20 text-[#976E44] uppercase tracking-wider">Modified</span>
                          )}
                        </div>
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
                        {hasChanges('udyamRegNum') && (
                          <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                        )}
                      </label>
                      <input
                        type="text"
                        name="udyamRegNum"
                        value={formData.udyamRegNum}
                        onChange={handleChange}
                        placeholder="UDYAM-XX-00-0000000"
                        maxLength={19}
                        className={`w-full px-4 py-3.5 border rounded-xl text-[#546A7A] focus:outline-none focus:ring-2 focus:ring-[#CE9F6B]/20 transition-all font-mono ${
                          hasChanges('udyamRegNum') ? 'bg-white border-[#CE9F6B]' : 'bg-white border-[#CE9F6B]/30'
                        }`}
                        required={formData.isMSME}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            </Card>

            {/* Bank Details Card */}
            <Card className="shadow-xl overflow-hidden border-0">
              <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-b-0 py-4 sm:py-6">
                <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  Vendor Bank Details
                </CardTitle>
                <CardDescription className="text-[#96AEC2] text-sm">
                  Banking and financial information
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className={`space-y-2 ${hasChanges('currency') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    Currency <span className="text-[#E17F70]">*</span>
                    {hasChanges('currency') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
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

                <div className={`space-y-2 ${hasChanges('accountType') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    Account Type <span className="text-[#E17F70]">*</span>
                    {hasChanges('accountType') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <select
                    name="accountType"
                    value={formData.accountType}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="" disabled>Select Account Type</option>
                    <option value="Current">Current Account</option>
                    <option value="Savings">Savings Account</option>
                  </select>
                </div>

                {(formData.currency === 'Other' || (originalAccount && !['INR', 'EUR', 'USD'].includes(originalAccount.currency))) && (
                  <div className={`space-y-2 animate-in fade-in slide-in-from-top-1 duration-200 ${hasChanges('currency') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                      Specify Currency <span className="text-[#E17F70]">*</span>
                      {hasChanges('currency') && formData.currency === 'Other' && (
                        <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                      )}
                    </label>
                    <input
                      type="text"
                      name="otherCurrency"
                      value={formData.otherCurrency}
                      onChange={handleChange}
                      placeholder="e.g., GBP, JPY, CAD"
                      maxLength={3}
                      className="w-full px-4 py-3.5 bg-white border border-[#CE9F6B]/30 rounded-xl text-[#546A7A] placeholder-[#92A2A5] focus:outline-none focus:border-[#CE9F6B] focus:ring-2 focus:ring-[#CE9F6B]/20 transition-all uppercase"
                      required={formData.currency === 'Other'}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className={`space-y-2 ${hasChanges('gstNumber') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    GST Number {formData.currency === 'INR' && <span className="text-[#E17F70]">*</span>}
                    {hasChanges('gstNumber') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleChange}
                    maxLength={15}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all uppercase"
                  />
                </div>

                <div className={`space-y-2 ${hasChanges('panNumber') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    PAN Number {formData.currency === 'INR' && <span className="text-[#E17F70]">*</span>}
                    {hasChanges('panNumber') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleChange}
                    maxLength={10}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all uppercase"
                  />
                </div>
              </div>

              <div className={`space-y-2 ${hasChanges('beneficiaryBankName') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Building2 className="w-4 h-4 text-[#CE9F6B]" />
                  Beneficiary Bank Name <span className="text-[#E17F70]">*</span>
                  {hasChanges('beneficiaryBankName') && (
                    <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                  )}
                </label>
                <input
                  type="text"
                  name="beneficiaryBankName"
                  value={formData.beneficiaryBankName}
                  onChange={handleChange}
                  maxLength={50}
                  className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all"
                  required
                />
              </div>

              <div className={`space-y-2 ${hasChanges('beneficiaryName') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <User className="w-4 h-4 text-[#CE9F6B]" />
                  Beneficiary Name <span className="text-[#AEBFC3] font-normal text-xs ml-auto">(Defaults to Vendor Name)</span>
                  {hasChanges('beneficiaryName') && (
                    <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                  )}
                </label>
                <input
                  type="text"
                  name="beneficiaryName"
                  value={formData.beneficiaryName}
                  onChange={handleChange}
                  placeholder="Name as per bank records"
                  maxLength={50}
                  className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className={`space-y-2 ${hasChanges('accountNumber') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <CreditCard className="w-4 h-4 text-[#CE9F6B]" />
                    Account Number <span className="text-[#E17F70]">*</span>
                    {hasChanges('accountNumber') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleChange}
                    maxLength={18}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all font-mono"
                    required
                  />
                </div>

                <div className={`space-y-2 ${hasChanges('ifscCode') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <Hash className="w-4 h-4 text-[#CE9F6B]" />
                    IFSC Code / SWIFT Code <span className="text-[#E17F70]">*</span>
                    {hasChanges('ifscCode') && (
                      <span className="ml-auto text-xs text-[#CE9F6B] font-medium">Modified</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleChange}
                    maxLength={11}
                    className="w-full px-4 py-3.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all font-mono uppercase"
                    required
                  />
                </div>

                <div className={`space-y-2 ${hasChanges('accountNumber') ? 'ring-2 ring-[#CE9F6B]/30 rounded-xl p-3 -m-3' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                    <CreditCard className="w-4 h-4 text-[#82A094]" />
                    Confirm Account Number <span className="text-[#E17F70]">*</span>
                  </label>
                  <input
                    type="text"
                    name="confirmAccountNumber"
                    value={formData.confirmAccountNumber}
                    onChange={handleChange}
                    maxLength={18}
                    className={`w-full px-4 py-3.5 bg-[#F8FAFB] border rounded-xl text-[#546A7A] focus:outline-none transition-all font-mono ${
                      formData.accountNumber !== formData.confirmAccountNumber
                        ? 'border-[#E17F70] ring-2 ring-[#E17F70]/10'
                        : 'border-[#AEBFC3]/30 focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white'
                    }`}
                    required
                  />
                  {formData.accountNumber !== formData.confirmAccountNumber && (
                    <p className="text-[10px] text-[#E17F70] font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      Account numbers do not match
                    </p>
                  )}
                </div>
              </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="shadow-xl overflow-hidden border-0">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-r from-[#AEBFC3]/10 to-white flex flex-col sm:flex-row items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/finance/bank-accounts/${params.id}`)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !!success}
                  className="w-full sm:flex-1 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] hover:from-[#976E44] hover:to-[#7A5837] text-white shadow-lg"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}
                  {isAdmin ? 'Save Changes' : 'Submit Request'}
                </Button>
              </CardContent>
            </Card>

            {/* Documents Card (Improved Grouped View) */}
            <Card className="shadow-xl overflow-hidden border-0">
              <CardHeader className="bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white border-b-0 py-4 sm:py-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl font-black uppercase tracking-tight">
                      <FileText className="h-6 w-6" />
                      Account Documents
                    </CardTitle>
                    <CardDescription className="text-white/80 text-sm mt-1">
                      Grouped by account category
                    </CardDescription>
                  </div>
                  <label className={`flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm font-black uppercase tracking-widest cursor-pointer hover:bg-white/30 hover:shadow-lg transition-all border border-white/30 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Add New document
                    <input type="file" className="hidden" onChange={handleFileSelect} disabled={uploading} />
                  </label>
                </div>
              </CardHeader>
              <CardContent className="pt-8 bg-[#F8FAFB] p-4 sm:p-8 space-y-10">
                {[
                  { id: 'DOMESTIC', label: 'Domestic', icon: Building2, color: '#82A094' },
                  { id: 'INTERNATIONAL', label: 'International', icon: Globe, color: '#6F8A9D' },
                  { id: 'EMPLOYEE', label: 'Employee', icon: User, color: '#CE9F6B' }
                ].map((type) => {
                  const typeAttachments = attachments.filter(a => a.vendorType === type.id);
                  
                  return (
                    <div key={type.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-white shadow-sm border border-[#AEBFC3]/20" style={{ color: type.color }}>
                            <type.icon className="w-4 h-4" />
                          </div>
                          <h4 className="font-black text-[#546A7A] text-sm uppercase tracking-widest">{type.label} Context</h4>
                          <span className="px-2 py-0.5 rounded-full bg-[#AEBFC3]/20 text-[#92A2A5] text-[10px] font-bold">
                            {typeAttachments.length} {typeAttachments.length === 1 ? 'File' : 'Files'}
                          </span>
                        </div>
                      </div>

                      {typeAttachments.length === 0 ? (
                        <div className="p-8 rounded-[2rem] border-2 border-dashed border-[#AEBFC3]/30 bg-white/50 flex flex-col items-center justify-center text-center group hover:border-[#CE9F6B]/30 transition-all">
                          <p className="text-[#92A2A5] text-xs font-medium mb-4">No {type.label.toLowerCase()} documents uploaded</p>
                          <label className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/30 text-[#546A7A] text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:border-[#CE9F6B]/50 hover:text-[#CE9F6B] transition-all">
                            <Upload className="w-3.5 h-3.5" />
                            Upload Now
                            <input type="file" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setPendingFile(file);
                                setUploadVendorType(type.id);
                                setShowUploadModal(true);
                              }
                            }} />
                          </label>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {typeAttachments.map((file) => (
                            <div key={file.id} className="group relative p-4 rounded-3xl bg-white border border-[#AEBFC3]/20 hover:border-[#82A094]/40 hover:shadow-xl transition-all">
                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${getFileColor(file.mimeType)}`}>
                                  {getFileIcon(file.mimeType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-black text-[#546A7A] truncate" title={file.filename}>{file.filename}</p>
                                  <p className="text-[10px] text-[#92A2A5] font-bold mt-1 uppercase tracking-tighter">
                                    {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                  </p>
                                </div>
                              </div>
                              
                                <div className="mt-4 flex items-center gap-2 pt-3 border-t border-[#AEBFC3]/10">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setPreviewFile(file);
                                      setShowPreview(true);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#CE9F6B]/10 text-[#976E44] text-[10px] font-black uppercase tracking-wider hover:bg-[#CE9F6B] hover:text-white transition-all shadow-sm"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    Preview
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDownload(file.id)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#82A094]/10 text-[#4F6A64] text-[10px] font-black uppercase tracking-wider hover:bg-[#82A094] hover:text-white transition-all shadow-sm"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                  </button>
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteAttachment(file.id)}
                                  className="p-2.5 rounded-xl bg-[#F8FAFB] text-[#92A2A5] hover:text-[#E17F70] hover:bg-[#E17F70]/10 transition-all border border-[#AEBFC3]/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Sidebar - Changes Preview */}
        <div className="lg:col-span-1 space-y-6">
          {/* Changes Summary Card */}
          <Card className="shadow-xl overflow-hidden border-0 sticky top-6">
            <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-b-0 py-4">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Sparkles className="h-4 w-4" />
                Changes Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 bg-gradient-to-br from-[#AEBFC3]/5 to-white">
              <div className="space-y-3">
                {Object.keys(formData).map((key) => {
                  const field = key as keyof FormData;
                  const changed = hasChanges(field);
                  if (!changed) return null;
                  
                  const labels: Record<string, string> = {
                    bpCode: 'BP Code',
                    vendorName: 'Vendor Name',
                    nickName: 'Nick Name',
                    emailId: 'Email ID',
                    beneficiaryName: 'Beneficiary Name',
                    beneficiaryBankName: 'Bank Name',
                    accountNumber: 'Account No.',
                    ifscCode: 'IFSC / SWIFT',
                    gstNumber: 'GST Number',
                    panNumber: 'PAN Number',
                    currency: 'Currency',
                    isMSME: 'MSME Status',
                    udyamRegNum: 'Udyam Reg.'
                  };

                  return (
                    <div key={key} className="p-3 rounded-xl bg-white border border-[#CE9F6B]/20 hover:border-[#CE9F6B]/40 transition-all">
                      <p className="text-xs font-semibold text-[#976E44] mb-2">{labels[key] || key}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[#92A2A5] line-through truncate max-w-[60px]" title={String((originalAccount as any)?.[field] || '(empty)')}>
                          {String((originalAccount as any)?.[field] || '(empty)').substring(0, 10)}...
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#CE9F6B] flex-shrink-0" />
                        <span className="text-[#546A7A] font-semibold truncate" title={String(formData[field])}>
                          {String(formData[field] || '(empty)')}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {!Object.keys(formData).some(key => hasChanges(key as keyof FormData)) && (
                  <div className="text-center py-8">
                    <Sparkles className="w-8 h-8 text-[#AEBFC3]/40 mx-auto mb-2" />
                    <p className="text-sm text-[#5D6E73]">No changes made yet</p>
                    <p className="text-xs text-[#92A2A5] mt-1">Modify fields to see preview</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Original Values Card */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-b-0 py-4">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <FileSpreadsheet className="h-4 w-4" />
                Original Values
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 bg-gradient-to-br from-[#AEBFC3]/5 to-white">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <dt className="text-[#92A2A5]">BP Code:</dt>
                  <dd className="text-[#546A7A] font-medium truncate max-w-[140px]">{originalAccount?.bpCode || '—'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-[#92A2A5]">Vendor:</dt>
                  <dd className="text-[#546A7A] font-medium truncate max-w-[140px]">{originalAccount?.vendorName}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-[#92A2A5]">Bank:</dt>
                  <dd className="text-[#546A7A] font-medium truncate max-w-[140px]">{originalAccount?.beneficiaryBankName}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-[#92A2A5]">A/C:</dt>
                  <dd className="text-[#546A7A] font-mono text-xs">****{originalAccount?.accountNumber?.slice(-4)}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-[#92A2A5]">IFSC/SWIFT:</dt>
                  <dd className="text-[#CE9F6B] font-mono text-xs font-bold">{originalAccount?.ifscCode}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vendor Type Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#82A094] to-[#4F6A64] px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Document
              </h3>
              <p className="text-white/80 text-sm mt-1">Select vendor type for &quot;{pendingFile?.name}&quot;</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#546A7A]">Vendor Type</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setUploadVendorType('DOMESTIC')}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      uploadVendorType === 'DOMESTIC' 
                        ? 'border-[#82A094] bg-[#82A094]/5 text-[#4F6A64]' 
                        : 'border-[#AEBFC3]/20 text-[#5D6E73] hover:border-[#82A094]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <div className="w-8 h-8 rounded-lg bg-[#82A094]/10 flex items-center justify-center">🏠</div>
                      Domestic
                    </div>
                    {uploadVendorType === 'DOMESTIC' && <CheckCircle2 className="w-5 h-5 text-[#82A094]" />}
                  </button>

                  <button
                    onClick={() => setUploadVendorType('INTERNATIONAL')}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      uploadVendorType === 'INTERNATIONAL' 
                        ? 'border-[#6F8A9D] bg-[#6F8A9D]/5 text-[#6F8A9D]' 
                        : 'border-[#AEBFC3]/20 text-[#5D6E73] hover:border-[#6F8A9D]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <div className="w-8 h-8 rounded-lg bg-[#6F8A9D]/10 flex items-center justify-center">🌐</div>
                      International
                    </div>
                    {uploadVendorType === 'INTERNATIONAL' && <CheckCircle2 className="w-5 h-5 text-[#6F8A9D]" />}
                  </button>

                  <button
                    onClick={() => setUploadVendorType('EMPLOYEE')}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      uploadVendorType === 'EMPLOYEE' 
                        ? 'border-[#CE9F6B] bg-[#CE9F6B]/5 text-[#976E44]' 
                        : 'border-[#AEBFC3]/20 text-[#5D6E73] hover:border-[#CE9F6B]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <div className="w-8 h-8 rounded-lg bg-[#CE9F6B]/10 flex items-center justify-center">👤</div>
                      Employees
                    </div>
                    {uploadVendorType === 'EMPLOYEE' && <CheckCircle2 className="w-5 h-5 text-[#CE9F6B]" />}
                  </button>
                </div>
              </div>

              {uploadVendorType === 'INTERNATIONAL' && (
                <div className="p-3 bg-[#E17F70]/10 border border-[#E17F70]/20 rounded-xl flex gap-3 animate-in fade-in zoom-in duration-200">
                  <AlertCircle className="w-5 h-5 text-[#E17F70] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#E17F70] font-medium leading-relaxed">
                    For international vendors, please ensure you only upload a **cancelled cheque** as per compliance requirements.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setPendingFile(null);
                    setUploadVendorType('');
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#AEBFC3] text-[#5D6E73] font-semibold hover:bg-[#F8FAFB] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadVendorType || uploading}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FilePreview 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        file={previewFile} 
      />
    </div>
  );
}
