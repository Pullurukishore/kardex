'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { arApi, BankAccount, BankAccountChangeRequest, BankAccountActivityLog } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { 
  ArrowLeft, Building2, Sparkles, Pencil, Trash2, 
  CreditCard, Mail, Hash, Clock, CheckCircle2, XCircle,
  AlertCircle, User, Calendar, Copy, ExternalLink, Check,
  FileText, Download, Trash, Upload, Loader2, FileIcon,
  Eye, FileSpreadsheet, FileImage, File, Landmark, BadgeCheck,
  Activity, ChevronDown, ChevronUp, Shield, TrendingUp
} from 'lucide-react';

export default function BankAccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<BankAccountActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);

  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

  useEffect(() => {
    loadAccount();
    loadAttachments();
    loadActivityLogs();
  }, [params.id]);

  const loadAccount = async () => {
    try {
      setLoading(true);
      const data = await arApi.getBankAccountById(params.id as string);
      setAccount(data);
    } catch (error) {
      console.error('Failed to load bank account:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    try {
      const data = await arApi.getBankAccountAttachments(params.id as string);
      setAttachments(data);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const loadActivityLogs = async () => {
    try {
      setLoadingActivities(true);
      const data = await arApi.getBankAccountActivityLogs(params.id as string, { limit: 50 });
      setActivityLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    
    try {
      await arApi.deleteBankAccount(params.id as string);
      router.push('/finance/bank-accounts');
    } catch (error) {
      console.error('Failed to delete bank account:', error);
      alert('Failed to delete bank account');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await arApi.uploadBankAccountAttachment(params.id as string, file);
      await loadAttachments();
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
    return 'text-slate-500 bg-slate-50';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#96AEC2]/20 border-t-[#6F8A9D] rounded-full animate-spin" />
          <Building2 className="w-6 h-6 text-[#6F8A9D] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-4 text-sm font-medium text-[#92A2A5]">Loading account details...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E17F70]/10 to-[#E17F70]/5 mb-5">
          <AlertCircle className="w-10 h-10 text-[#E17F70]" />
        </div>
        <h2 className="text-2xl font-bold text-[#546A7A] mb-2">Bank Account Not Found</h2>
        <p className="text-[#92A2A5] mb-6">The requested bank account could not be found.</p>
        <Link
          href="/finance/bank-accounts"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Bank Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none">
      {/* Premium Header with Kardex Blue Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#96AEC2]/10 via-[#6F8A9D]/8 to-[#546A7A]/5 rounded-2xl border border-[#96AEC2]/20 shadow-lg mb-8">
        {/* Decorative Pattern */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#6F8A9D]/5 to-transparent rounded-full blur-3xl -z-10" />
        
        <div className="relative p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Section - Title & Info */}
            <div className="flex items-start gap-4">
              <Link
                href="/finance/bank-accounts"
                className="group mt-1 p-3 rounded-xl bg-white/80 backdrop-blur-sm border border-[#96AEC2]/30 text-[#6F8A9D] hover:text-white hover:bg-gradient-to-r hover:from-[#6F8A9D] hover:to-[#546A7A] hover:border-[#546A7A] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </Link>
              
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] bg-clip-text text-transparent">
                      {account.vendorName}
                    </h1>
                  </div>
                  
                  {account.isActive && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white text-xs font-bold uppercase tracking-wide shadow-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active Account
                    </div>
                  )}
                </div>
                
                {account.nickName && (
                  <div className="flex items-center gap-2 text-[#6F8A9D]">
                    <Sparkles className="w-4 h-4" />
                    <p className="text-sm font-semibold">"{account.nickName}"</p>
                  </div>
                )}
                
                <div className="flex items-center gap-2 mt-3 text-xs text-[#92A2A5]">
                  <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>Created {formatDate(account.createdAt)}</span>
                </div>
              </div>
            </div>
            
            {/* Right Section - Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/finance/bank-accounts/${account.id}/edit`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">{isAdmin ? 'Edit Account' : 'Request Changes'}</span>
                <span className="sm:hidden">Edit</span>
              </Link>
              
              {isAdmin && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-[#E17F70]/30 text-[#E17F70] text-sm font-semibold hover:bg-[#E17F70] hover:text-white hover:border-[#E17F70] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content - Left Side */}
        <div className="xl:col-span-2 space-y-6">
          {/* Status & Quick Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Card */}
            <div className={`relative overflow-hidden rounded-2xl p-6 ${
              account.isActive 
                ? 'bg-gradient-to-br from-[#82A094]/15 via-white to-[#82A094]/5 border-2 border-[#82A094]/30' 
                : 'bg-gradient-to-br from-[#92A2A5]/15 via-white to-[#92A2A5]/5 border-2 border-[#92A2A5]/30'
            } shadow-lg hover:shadow-xl transition-shadow`}>
              {/* Decorative Circle */}
              <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full ${
                account.isActive ? 'bg-[#82A094]/10' : 'bg-[#92A2A5]/10'
              } blur-2xl`} />
              
              <div className="relative">
                <div className={`inline-flex p-3 rounded-xl ${
                  account.isActive 
                    ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64]' 
                    : 'bg-gradient-to-br from-[#92A2A5] to-[#5D6E73]'
                } shadow-lg mb-3`}>
                  {account.isActive 
                    ? <CheckCircle2 className="w-6 h-6 text-white" /> 
                    : <XCircle className="w-6 h-6 text-white" />
                  }
                </div>
                <p className="text-[#92A2A5] text-xs font-bold uppercase tracking-wider mb-1">Account Status</p>
                <p className={`text-3xl font-bold ${
                  account.isActive ? 'text-[#4F6A64]' : 'text-[#5D6E73]'
                }`}>
                  {account.isActive ? 'Active' : 'Inactive'}
                </p>
                
                {/* Verification Badge */}
                <div className="mt-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    account.isActive 
                      ? 'bg-[#82A094]/10 border border-[#82A094]/30 text-[#4F6A64]' 
                      : 'bg-[#92A2A5]/10 border border-[#92A2A5]/30 text-[#5D6E73]'
                  } text-xs font-semibold`}>
                    <Shield className="w-3.5 h-3.5" />
                    Verified Account
                  </div>
                </div>
              </div>
            </div>
          
          {/* Currency & Account Type Card */}
          <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-[#6F8A9D]/10 via-white to-[#546A7A]/5 border-2 border-[#6F8A9D]/20 shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-[#6F8A9D]/10 blur-2xl" />
            
            <div className="relative">
              <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg mb-3">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <p className="text-[#92A2A5] text-xs font-bold uppercase tracking-wider mb-1">Currency</p>
              <p className="text-3xl font-bold text-[#546A7A] uppercase">{account.currency}</p>
            </div>
          </div>
        </div>

        {/* Bank Details Card - Large */}
        <div className="bg-white rounded-2xl border-2 border-[#6F8A9D]/20 overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
          <div className="relative p-5 border-b border-[#6F8A9D]/10 bg-gradient-to-r from-[#96AEC2]/15 via-[#6F8A9D]/10 to-transparent flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#546A7A] flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#6F8A9D]/15">
                <Building2 className="w-5 h-5 text-[#6F8A9D]" />
              </div>
              Bank Account Details
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#82A094] bg-[#82A094]/10 px-2.5 py-1 rounded-lg border border-[#82A094]/20">Verified</span>
          </div>
          <div className="p-5 space-y-4">
              {/* Primary Details Grid - 3 columns on large screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#B18E63]/30 transition-all">
                  <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                    <Building2 className="w-3.5 h-3.5" />
                    Bank Name
                  </div>
                  <p className="text-[#546A7A] font-semibold text-sm">{account.beneficiaryBankName}</p>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#B18E63]/30 transition-all">
                  <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                    <Hash className="w-3.5 h-3.5" />
                    IFSC Code
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[#B18E63] font-mono text-sm font-bold">{account.ifscCode}</p>
                    <button 
                      onClick={() => copyToClipboard(account.ifscCode, 'ifsc')}
                      className="p-1 rounded-lg hover:bg-[#B18E63]/10 text-[#92A2A5] hover:text-[#B18E63] transition-all"
                    >
                      {copied === 'ifsc' ? <Check className="w-3.5 h-3.5 text-[#82A094]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#B18E63]/30 transition-all">
                  <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                    <CreditCard className="w-3.5 h-3.5" />
                    Currency
                  </div>
                  <p className="text-[#546A7A] font-semibold text-sm uppercase">{account.currency}</p>
                </div>
              </div>

              {/* Beneficiary Name */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#B18E63]/8 to-[#B18E63]/3 border border-[#B18E63]/20 hover:shadow-md transition-all">
                <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                  <User className="w-3.5 h-3.5 text-[#B18E63]" />
                  Beneficiary Name
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[#546A7A] font-semibold text-sm">{account.beneficiaryName || account.vendorName}</p>
                  <button 
                    onClick={() => copyToClipboard(account.beneficiaryName || account.vendorName, 'beneficiary')}
                    className="p-1 rounded-lg hover:bg-[#B18E63]/10 text-[#92A2A5] hover:text-[#B18E63] transition-all"
                  >
                    {copied === 'beneficiary' ? <Check className="w-3.5 h-3.5 text-[#82A094]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Account Number - Prominent Display */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#546A7A]/8 via-[#B18E63]/5 to-transparent border border-[#B18E63]/25 hover:shadow-md transition-all">
                <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                  <CreditCard className="w-3.5 h-3.5" />
                  Account Number
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[#546A7A] font-mono text-xl font-bold tracking-wider">{account.accountNumber}</p>
                  <button 
                    onClick={() => copyToClipboard(account.accountNumber, 'account')}
                    className="p-2 rounded-lg bg-white border border-[#B18E63]/20 hover:bg-[#B18E63]/10 text-[#92A2A5] hover:text-[#B18E63] transition-all"
                  >
                    {copied === 'account' ? <Check className="w-4 h-4 text-[#82A094]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Vendor Details Card */}
          <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-md">
            <div className="p-4 border-b border-[#AEBFC3]/10 bg-gradient-to-r from-[#6F8A9D]/10 via-[#6F8A9D]/5 to-transparent">
              <h2 className="text-base font-bold text-[#546A7A] flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#6F8A9D]/10">
                  <User className="w-5 h-5 text-[#6F8A9D]" />
                </div>
                Vendor Information
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#6F8A9D]/30 transition-all">
                <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                  <User className="w-3.5 h-3.5" />
                  Vendor Name
                </div>
                <p className="text-[#546A7A] font-semibold text-sm">{account.vendorName}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#6F8A9D]/30 transition-all">
                <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                  <Hash className="w-3.5 h-3.5" />
                  Nick Name
                </div>
                <p className="text-[#546A7A] font-semibold text-sm">{account.nickName || '—'}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#6F8A9D]/30 transition-all">
                <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </div>
                <p className="text-[#546A7A] font-semibold text-sm break-all">{account.emailId || '—'}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#6F8A9D]/30 transition-all">
                <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                  <Landmark className="w-3.5 h-3.5" />
                  GST Number
                </div>
                <p className="text-[#546A7A] font-mono font-semibold text-sm">{account.gstNumber || '—'}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/15 hover:shadow-md hover:border-[#6F8A9D]/30 transition-all">
                <div className="flex items-center gap-1.5 text-[#92A2A5] text-xs mb-2">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  PAN Number
                </div>
                <p className="text-[#546A7A] font-mono font-semibold text-sm">{account.panNumber || '—'}</p>
              </div>

              {account.isMSME && (
                <div className="sm:col-span-2 lg:col-span-3 p-4 rounded-xl bg-gradient-to-r from-[#B18E63]/10 to-[#B18E63]/5 border border-[#B18E63]/20 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[#B18E63] text-xs mb-1.5 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        MSME Registered
                      </div>
                      <p className="text-[#92A2A5] text-[11px] mb-1">Udyam Registration Number</p>
                      <p className="text-[#546A7A] font-mono text-base font-bold tracking-wide">{account.udyamRegNum}</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(account.udyamRegNum || '', 'udyam')}
                      className="p-2 rounded-lg bg-white border border-[#B18E63]/20 text-[#B18E63] hover:bg-[#B18E63] hover:text-white transition-all"
                    >
                      {copied === 'udyam' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-md">
            <div className="p-4 border-b border-[#AEBFC3]/10 bg-gradient-to-r from-[#82A094]/10 via-[#82A094]/5 to-transparent flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-base font-bold text-[#546A7A] flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#82A094]/10">
                  <FileText className="w-5 h-5 text-[#82A094]" />
                </div>
                Documents
              </h2>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white text-xs font-semibold cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Add Document
                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            <div className="p-4">
              {attachments.length === 0 ? (
                <div className="text-center py-12 bg-gradient-to-b from-[#F8FAFB] to-white rounded-xl border-2 border-dashed border-[#AEBFC3]/30">
                  <FileIcon className="w-12 h-12 text-[#AEBFC3]/40 mx-auto mb-3" />
                  <p className="text-[#92A2A5] font-semibold text-sm">No documents yet</p>
                  <p className="text-xs text-[#92A2A5]/70 mt-1">Upload verification documents</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {attachments.map((file) => (
                    <div key={file.id} className="group relative p-4 rounded-xl bg-white border border-[#AEBFC3]/20 hover:border-[#82A094]/40 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${getFileColor(file.mimeType)}`}>
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-[#546A7A] truncate" title={file.filename}>
                              {file.filename}
                            </p>
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#AEBFC3]/10 text-[#92A2A5] text-[9px] font-bold uppercase">
                              {file.filename.split('.').pop()}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#92A2A5] mt-1.5">
                            {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 pt-3 border-t border-[#AEBFC3]/10">
                        <button 
                          onClick={() => handleDownload(file.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#82A094]/10 text-[#82A094] text-xs font-semibold hover:bg-[#82A094] hover:text-white transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteAttachment(file.id)}
                            className="p-2 rounded-lg bg-[#F8FAFB] text-[#92A2A5] hover:text-[#E17F70] hover:bg-[#E17F70]/10 transition-all border border-transparent hover:border-[#E17F70]/20"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="xl:col-span-1 space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-[#AEBFC3]/20 overflow-hidden shadow-md">
            <div className="p-3 border-b border-[#AEBFC3]/10 bg-gradient-to-r from-[#B18E63]/5 to-transparent">
              <h3 className="text-sm font-bold text-[#546A7A]">Quick Actions</h3>
            </div>
            <div className="p-2 space-y-1">
              <Link
                href={`/finance/bank-accounts/${account.id}/edit`}
                className="flex items-center gap-2 w-full p-3 rounded-lg hover:bg-[#B18E63]/10 text-[#5D6E73] hover:text-[#976E44] transition-all group"
              >
                <div className="p-1.5 bg-[#B18E63]/10 rounded-lg group-hover:bg-[#B18E63]/20 group-hover:scale-110 transition-all">
                  <Pencil className="w-3.5 h-3.5 text-[#B18E63]" />
                </div>
                <span className="text-sm font-semibold">{isAdmin ? 'Edit Details' : 'Request Changes'}</span>
              </Link>
              <Link
                href="/finance/bank-accounts/requests"
                className="flex items-center gap-2 w-full p-3 rounded-lg hover:bg-[#6F8A9D]/10 text-[#5D6E73] hover:text-[#6F8A9D] transition-all group"
              >
                <div className="p-1.5 bg-[#6F8A9D]/10 rounded-lg group-hover:bg-[#6F8A9D]/20 group-hover:scale-110 transition-all">
                  <Clock className="w-3.5 h-3.5 text-[#6F8A9D]" />
                </div>
                <span className="text-sm font-semibold">View Requests</span>
              </Link>
            </div>
          </div>

          {/* Activity Log Card */}
          <div className="bg-white rounded-xl border border-[#AEBFC3]/20 overflow-hidden shadow-md">
            <div className="p-3 border-b border-[#AEBFC3]/10 bg-gradient-to-r from-[#82A094]/5 to-transparent flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#546A7A] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#B18E63]" />
                Activity Log
              </h3>
              {activityLogs.length > 5 && (
                <button 
                  onClick={() => setShowAllActivities(!showAllActivities)}
                  className="text-[10px] text-[#B18E63] font-bold flex items-center gap-0.5 hover:text-[#976E44] transition-colors"
                >
                  {showAllActivities ? 'Show Less' : `Show All (${activityLogs.length})`}
                  {showAllActivities ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
            <div className="p-3">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 text-[#B18E63] animate-spin" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-6">
                  <Activity className="w-6 h-6 text-[#AEBFC3]/40 mx-auto mb-1.5" />
                  <p className="text-xs text-[#92A2A5]">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {(showAllActivities ? activityLogs : activityLogs.slice(0, 5)).map((log, index) => (
                    <div 
                      key={log.id} 
                      className="flex gap-2 p-2.5 rounded-lg bg-[#F8FAFB] border border-[#AEBFC3]/10 hover:border-[#B18E63]/20 transition-all"
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full ${
                          log.action.includes('CREATED') ? 'bg-[#82A094]' :
                          log.action.includes('UPDATED') ? 'bg-[#B18E63]' :
                          log.action.includes('APPROVED') ? 'bg-[#82A094]' :
                          log.action.includes('REJECTED') ? 'bg-[#E17F70]' :
                          log.action.includes('DELETE') || log.action.includes('DEACTIVATED') ? 'bg-[#E17F70]' :
                          'bg-[#6F8A9D]'
                        }`} />
                        {index < activityLogs.length - 1 && (
                          <div className="flex-1 w-0.5 bg-gradient-to-b from-[#AEBFC3]/30 to-transparent mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#546A7A] leading-tight truncate">
                          {log.description}
                        </p>
                        {log.fieldName && (
                          <p className="text-[10px] text-[#92A2A5] mt-0.5">
                            <span className="font-medium">{log.fieldName}:</span>{' '}
                            <span className="line-through text-[#E17F70]/70">{log.oldValue || '(empty)'}</span>
                            {' → '}
                            <span className="text-[#82A094]">{log.newValue || '(empty)'}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] text-[#92A2A5]">
                          <span className="font-medium">{log.performedBy || 'System'}</span>
                          <span>•</span>
                          <span>{formatDate(log.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Change Request History */}
          {account.changeRequests && account.changeRequests.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="p-5 border-b border-[#AEBFC3]/10 bg-gradient-to-r from-[#CE9F6B]/5 to-transparent">
                <h3 className="font-bold text-[#546A7A] flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-[#CE9F6B]" />
                  Recent Requests
                </h3>
              </div>
              <div className="divide-y divide-[#AEBFC3]/10">
                {account.changeRequests.slice(0, 5).map((request: BankAccountChangeRequest) => (
                  <Link 
                    key={request.id} 
                    href={`/finance/bank-accounts/requests/${request.id}`}
                    className="block px-5 py-4 hover:bg-gradient-to-r hover:from-[#CE9F6B]/5 hover:to-transparent transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          request.status === 'APPROVED' ? 'bg-[#82A094]/15 text-[#4F6A64]' :
                          request.status === 'REJECTED' ? 'bg-[#E17F70]/15 text-[#E17F70]' :
                          'bg-[#CE9F6B]/15 text-[#976E44]'
                        }`}>
                          {request.status === 'APPROVED' ? <CheckCircle2 className="w-4 h-4" /> :
                           request.status === 'REJECTED' ? <XCircle className="w-4 h-4" /> :
                           <Clock className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#546A7A]">{request.requestType}</p>
                          <p className="text-xs text-[#92A2A5] mt-0.5">{formatDate(request.requestedAt)}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        request.status === 'APPROVED' ? 'bg-[#82A094]/15 text-[#4F6A64]' :
                        request.status === 'REJECTED' ? 'bg-[#E17F70]/15 text-[#E17F70]' :
                        'bg-[#CE9F6B]/15 text-[#976E44]'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
