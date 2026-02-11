'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { arApi, BankAccount, BankAccountChangeRequest, BankAccountActivityLog } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Building2, Sparkles, Pencil, Trash2, 
  CreditCard, Mail, Clock, CheckCircle2, XCircle,
  AlertCircle, User, Copy, ExternalLink, Check,
  FileText, Download, Upload, Loader2, FileIcon,
  FileSpreadsheet, FileImage, File, Landmark,
  Activity, ChevronDown, ChevronUp, Shield, TrendingUp, Globe, Eye
} from 'lucide-react';
import FilePreview from '@/components/FilePreview';

export default function BankAccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<BankAccountActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

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
    if (!confirm('Are you sure you want to delete this vendor bank account?')) return;
    
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
    return 'text-gray-500 bg-gray-50';
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
        <h2 className="text-2xl font-bold text-[#546A7A] mb-2">Vendor Bank Account Not Found</h2>
        <p className="text-[#92A2A5] mb-6">The requested vendor bank account could not be found.</p>
        <Link
          href="/finance/bank-accounts"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vendor Bank Accounts
        </Link>
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
            onClick={() => router.push('/finance/bank-accounts')}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#546A7A] truncate">{account.vendorName}</h1>
            <p className="text-[#5D6E73] mt-1 text-sm sm:text-base truncate">
              {account?.vendorName} • <span className="font-bold text-[#CE9F6B]">{account?.currency} {account?.accountType || ''} Account</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button onClick={() => router.push(`/finance/bank-accounts/${account.id}/edit`)} className="w-full sm:w-auto">
            <Pencil className="h-4 w-4 mr-2" />
            {isAdmin ? 'Edit Account' : 'Request Changes'}
          </Button>
          {isAdmin && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Status Card */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className={`border-b-0 py-4 sm:py-6 ${
              account.isActive 
                ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]' 
                : 'bg-gradient-to-r from-[#92A2A5] to-[#5D6E73]'
            } text-white`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                    {account.isActive ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
                    Account Status
                  </CardTitle>
                  <CardDescription className="text-white/80 text-sm mt-1">
                    {account.isActive ? 'This account is active and ready for transactions' : 'This account is currently inactive'}
                  </CardDescription>
                </div>
                <Badge className={`border-0 text-sm sm:text-base px-4 py-2 shadow-lg ${
                  account.isActive 
                    ? 'bg-white/20 text-white backdrop-blur-sm' 
                    : 'bg-white/20 text-white backdrop-blur-sm'
                }`}>
                  {account.isActive ? '✓ Active' : '○ Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Currency */}
                <div className="relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-[#96AEC2]" />
                      <p className="text-xs sm:text-sm text-[#96AEC2] font-semibold">Currency</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white uppercase">
                      {account.currency}
                    </p>
                  </div>
                </div>
                {/* MSME Status */}
                <div className={`relative overflow-hidden p-4 sm:p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 ${
                  account.isMSME 
                    ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44]' 
                    : 'bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5]'
                }`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white/70" />
                      <p className="text-xs sm:text-sm text-white/70 font-semibold">MSME Status</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white">
                      {account.isMSME ? 'MSME' : 'Non-MSME'}
                    </p>
                  </div>
                </div>
                {/* Verification */}
                <div className="relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-[#A2B9AF]" />
                      <p className="text-xs sm:text-sm text-[#A2B9AF] font-semibold">Verification</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white">
                      Verified
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details Card */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-b-0 py-4 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                Vendor Bank Account Details
              </CardTitle>
              <CardDescription className="text-[#96AEC2] text-sm">
                Primary banking information for this vendor
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#6F8A9D]/20 hover:shadow-md transition-all">
                  <h4 className="font-bold text-[#546A7A] mb-4 flex items-center gap-2 text-base sm:text-lg">
                    <div className="p-2 bg-[#6F8A9D]/10 rounded-lg">
                      <Landmark className="h-4 w-4 sm:h-5 sm:w-5 text-[#546A7A]" />
                    </div>
                    Bank Information
                  </h4>
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#6F8A9D] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Bank Name</dt>
                        <dd className="text-sm sm:text-base font-bold text-[#546A7A] mt-0.5 break-words">{account.beneficiaryBankName}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#6F8A9D] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">IFSC Code / SWIFT Code</dt>
                        <dd className="text-sm sm:text-base font-mono font-bold text-[#CE9F6B] mt-0.5 flex items-center gap-2">
                          {account.ifscCode}
                          <button 
                            onClick={() => copyToClipboard(account.ifscCode, 'ifsc')}
                            className="p-1 rounded hover:bg-[#CE9F6B]/10 text-[#92A2A5] hover:text-[#CE9F6B] transition-all"
                          >
                            {copied === 'ifsc' ? <Check className="w-3.5 h-3.5 text-[#82A094]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#CE9F6B]/20 hover:shadow-md transition-all">
                  <h4 className="font-bold text-[#976E44] mb-4 flex items-center gap-2 text-base sm:text-lg">
                    <div className="p-2 bg-[#CE9F6B]/10 rounded-lg">
                      <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-[#976E44]" />
                    </div>
                    Account Information
                  </h4>
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#CE9F6B] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Account Number</dt>
                        <dd className="text-sm sm:text-base font-mono font-bold text-[#546A7A] mt-0.5 flex items-center gap-2">
                          {account.accountNumber}
                          <button 
                            onClick={() => copyToClipboard(account.accountNumber, 'account')}
                            className="p-1 rounded hover:bg-[#CE9F6B]/10 text-[#92A2A5] hover:text-[#CE9F6B] transition-all"
                          >
                            {copied === 'account' ? <Check className="w-3.5 h-3.5 text-[#82A094]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#CE9F6B] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Account Type</dt>
                        <dd className="text-sm sm:text-base font-bold text-[#546A7A] mt-0.5">{account.accountType || 'Not Specified'}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#CE9F6B] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Beneficiary Name</dt>
                        <dd className="text-sm sm:text-base font-bold text-[#546A7A] mt-0.5 flex items-center gap-2">
                          <span className="truncate">{account.beneficiaryName || account.vendorName}</span>
                          <button 
                            onClick={() => copyToClipboard(account.beneficiaryName || account.vendorName, 'beneficiary')}
                            className="p-1 rounded hover:bg-[#CE9F6B]/10 text-[#92A2A5] hover:text-[#CE9F6B] transition-all shrink-0"
                          >
                            {copied === 'beneficiary' ? <Check className="w-3.5 h-3.5 text-[#82A094]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor & Tax Information Card */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-b-0 py-4 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                <User className="h-5 w-5 sm:h-6 sm:w-6" />
                Vendor & Tax Information
              </CardTitle>
              <CardDescription className="text-white/80 text-sm">
                Vendor details and tax compliance information
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vendor Details */}
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#CE9F6B]/20 hover:shadow-md transition-all">
                  <h4 className="font-bold text-[#976E44] mb-4 flex items-center gap-2 text-base sm:text-lg">
                    <div className="p-2 bg-[#CE9F6B]/10 rounded-lg">
                      <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#976E44]" />
                    </div>
                    Vendor Details
                  </h4>
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#CE9F6B] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">BP Code / Vendor Code</dt>
                        <dd className="text-sm sm:text-base font-bold text-[#546A7A] mt-0.5 break-words uppercase tracking-wider">{account.bpCode || '—'}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#CE9F6B] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Vendor Name</dt>
                        <dd className="text-sm sm:text-base font-bold text-[#546A7A] mt-0.5 break-words">{account.vendorName}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#CE9F6B] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Nickname</dt>
                        <dd className="text-sm sm:text-base font-medium text-[#5D6E73] mt-0.5">{account.nickName || '—'}</dd>
                      </div>
                    </div>
                    {account.emailId && (
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-[#CE9F6B] rounded-full mt-2 shrink-0"></div>
                        <div className="min-w-0 flex-1">
                          <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Email</dt>
                          <dd className="text-sm sm:text-base font-medium text-[#5D6E73] mt-0.5 flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-[#976E44] shrink-0" />
                            <span className="break-all">{account.emailId}</span>
                          </dd>
                        </div>
                      </div>
                    )}
                  </dl>
                </div>
                {/* Tax Information */}
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#82A094]/20 hover:shadow-md transition-all">
                  <h4 className="font-bold text-[#4F6A64] mb-4 flex items-center gap-2 text-base sm:text-lg">
                    <div className="p-2 bg-[#82A094]/10 rounded-lg">
                      <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 text-[#4F6A64]" />
                    </div>
                    Tax Information
                  </h4>
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#82A094] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">GST Number</dt>
                        <dd className="text-sm sm:text-base font-mono font-bold text-[#546A7A] mt-0.5">{account.gstNumber || '—'}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#82A094] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">PAN Number</dt>
                        <dd className="text-sm sm:text-base font-mono font-bold text-[#546A7A] mt-0.5">{account.panNumber || '—'}</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>
              
              {/* MSME Section */}
              {account.isMSME && (
                <div className="mt-6 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-[#CE9F6B]/10 to-[#CE9F6B]/5 border border-[#CE9F6B]/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-lg shadow-md">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#976E44]">MSME Registered</p>
                        <p className="text-xs text-[#5D6E73] mt-0.5">Udyam Registration: <span className="font-mono font-bold">{account.udyamRegNum}</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(account.udyamRegNum || '', 'udyam')}
                      className="px-4 py-2 rounded-lg bg-white border border-[#CE9F6B]/30 text-[#976E44] text-sm font-semibold hover:bg-[#CE9F6B] hover:text-white transition-all flex items-center gap-2"
                    >
                      {copied === 'udyam' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Documents Card */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white border-b-0 py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                    Documents
                  </CardTitle>
                  <CardDescription className="text-white/80 text-sm mt-1">
                    Verification documents and attachments
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
              {attachments.length === 0 ? (
                <div className="text-center py-12 bg-gradient-to-b from-[#F8FAFB] to-white rounded-xl border-2 border-dashed border-[#82A094]/30">
                  <FileIcon className="w-12 h-12 text-[#82A094]/40 mx-auto mb-3" />
                  <p className="text-[#5D6E73] font-semibold text-sm">No documents yet</p>
                  <p className="text-xs text-[#92A2A5] mt-1">Upload verification documents to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attachments.map((file) => (
                    <div key={file.id} className="group relative p-4 rounded-xl bg-white border border-[#82A094]/20 hover:border-[#82A094]/40 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${getFileColor(file.mimeType)}`}>
                          {getFileIcon(file.mimeType)}
                        </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#546A7A] truncate" title={file.filename}>{file.filename}</p>
                            <p className="text-[10px] text-[#92A2A5] mt-1">{formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                            {file.vendorType && (
                              <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                file.vendorType === 'DOMESTIC' ? 'bg-[#82A094]/15 text-[#4F6A64]' :
                                file.vendorType === 'INTERNATIONAL' ? 'bg-[#6F8A9D]/15 text-[#6F8A9D]' :
                                'bg-[#CE9F6B]/15 text-[#976E44]'
                              }`}>
                                {file.vendorType === 'DOMESTIC' ? '🏠 Domestic' :
                                 file.vendorType === 'INTERNATIONAL' ? '🌐 International' :
                                 '👤 Employee'}
                              </span>
                            )}
                          </div>
                        </div>
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-[#AEBFC3]/10">
                        <button 
                          onClick={() => {
                            setPreviewFile(file);
                            setShowPreview(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#CE9F6B]/10 text-[#976E44] text-xs font-semibold hover:bg-[#CE9F6B] hover:text-white transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                        <button 
                          onClick={() => handleDownload(file.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#82A094]/10 text-[#4F6A64] text-xs font-semibold hover:bg-[#82A094] hover:text-white transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteAttachment(file.id)}
                            className="p-2 rounded-lg bg-[#F8FAFB] text-[#92A2A5] hover:text-[#E17F70] hover:bg-[#E17F70]/10 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Right Column - Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Actions Card */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-b-0 py-4">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <TrendingUp className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 bg-gradient-to-br from-[#AEBFC3]/5 to-white">
              <div className="space-y-2">
                <Link
                  href={`/finance/bank-accounts/${account.id}/edit`}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[#CE9F6B]/10 text-[#5D6E73] hover:text-[#976E44] transition-all group"
                >
                  <div className="p-2 bg-[#CE9F6B]/10 rounded-lg group-hover:bg-[#CE9F6B]/20 group-hover:scale-110 transition-all">
                    <Pencil className="w-4 h-4 text-[#CE9F6B]" />
                  </div>
                  <span className="text-sm font-semibold">{isAdmin ? 'Edit Details' : 'Request Changes'}</span>
                </Link>
                <Link
                  href="/finance/bank-accounts/requests"
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[#6F8A9D]/10 text-[#5D6E73] hover:text-[#6F8A9D] transition-all group"
                >
                  <div className="p-2 bg-[#6F8A9D]/10 rounded-lg group-hover:bg-[#6F8A9D]/20 group-hover:scale-110 transition-all">
                    <Clock className="w-4 h-4 text-[#6F8A9D]" />
                  </div>
                  <span className="text-sm font-semibold">View Requests</span>
                </Link>
                <Link
                  href="/finance/bank-accounts/activities"
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[#82A094]/10 text-[#5D6E73] hover:text-[#4F6A64] transition-all group"
                >
                  <div className="p-2 bg-[#82A094]/10 rounded-lg group-hover:bg-[#82A094]/20 group-hover:scale-110 transition-all">
                    <Activity className="w-4 h-4 text-[#82A094]" />
                  </div>
                  <span className="text-sm font-semibold">All Activities</span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Activity Log Card */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-b-0 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Activity className="h-4 w-4" />
                  Activity Log
                </CardTitle>
                {activityLogs.length > 5 && (
                  <button 
                    onClick={() => setShowAllActivities(!showAllActivities)}
                    className="text-xs text-white/80 font-semibold flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {showAllActivities ? 'Show Less' : `View All (${activityLogs.length})`}
                    {showAllActivities ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 bg-gradient-to-br from-[#AEBFC3]/5 to-white">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#CE9F6B] animate-spin" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-8 h-8 text-[#AEBFC3]/40 mx-auto mb-2" />
                  <p className="text-sm text-[#5D6E73]">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {(showAllActivities ? activityLogs : activityLogs.slice(0, 5)).map((log, index) => (
                    <div 
                      key={log.id} 
                      className="flex gap-3 p-3 rounded-xl bg-white border border-[#AEBFC3]/10 hover:border-[#CE9F6B]/30 hover:shadow-sm transition-all"
                    >
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                        log.action.includes('CREATED') ? 'bg-[#82A094]' :
                        log.action.includes('UPDATED') ? 'bg-[#CE9F6B]' :
                        log.action.includes('APPROVED') ? 'bg-[#82A094]' :
                        log.action.includes('REJECTED') ? 'bg-[#E17F70]' :
                        log.action.includes('DELETE') || log.action.includes('DEACTIVATED') ? 'bg-[#E17F70]' :
                        'bg-[#6F8A9D]'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#546A7A] leading-tight">{log.description}</p>
                        {log.fieldName && (
                          <p className="text-xs text-[#92A2A5] mt-1">
                            <span className="font-medium">{log.fieldName}:</span>{' '}
                            <span className="line-through text-[#E17F70]/70">{log.oldValue || '(empty)'}</span>
                            {' → '}
                            <span className="text-[#82A094] font-medium">{log.newValue || '(empty)'}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#92A2A5]">
                          <span className="font-medium">{log.performedBy || 'System'}</span>
                          <span>•</span>
                          <span>{formatDate(log.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Request History */}
          {account.changeRequests && account.changeRequests.length > 0 && (
            <Card className="shadow-xl overflow-hidden border-0">
              <CardHeader className="bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white border-b-0 py-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <ExternalLink className="h-4 w-4" />
                  Recent Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 bg-gradient-to-br from-[#AEBFC3]/5 to-white">
                <div className="divide-y divide-[#AEBFC3]/10">
                  {account.changeRequests.slice(0, 5).map((request: BankAccountChangeRequest) => (
                    <Link 
                      key={request.id} 
                      href={`/finance/bank-accounts/requests/${request.id}`}
                      className="block px-4 py-3 hover:bg-[#82A094]/5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
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
                            <p className="text-xs text-[#92A2A5]">{formatDate(request.requestedAt)}</p>
                          </div>
                        </div>
                        <Badge className={`text-xs ${
                          request.status === 'APPROVED' ? 'bg-[#82A094]/15 text-[#4F6A64] border-0' :
                          request.status === 'REJECTED' ? 'bg-[#E17F70]/15 text-[#E17F70] border-0' :
                          'bg-[#CE9F6B]/15 text-[#976E44] border-0'
                        }`}>
                          {request.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      <FilePreview 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        file={previewFile} 
      />
    </div>
  );
}
