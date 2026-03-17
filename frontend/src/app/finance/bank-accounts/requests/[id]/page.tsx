'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { arApi, BankAccountChangeRequest, BankAccount } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { 
  ArrowLeft, Sparkles, Clock, CheckCircle2, XCircle, 
  AlertCircle, Building2, Plus, Trash2, Pencil,
  ArrowRight, GitCompare, FileText, Eye, Download, FileImage, FileSpreadsheet, File, Download as DownloadIcon,
  User, Calendar, CreditCard, Hash, Mail, MessageSquare, Loader2, Shield, BadgeCheck
} from 'lucide-react';
// Lazy-load FilePreview — it pulls in the heavy `xlsx` library (~1MB).
const FilePreview = dynamic(() => import('@/components/FilePreview'), {
  ssr: false,
  loading: () => null,
});

interface FieldChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  icon: React.ReactNode;
}

export default function RequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState<BankAccountChangeRequest | null>(null);
  const [originalAccount, setOriginalAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

  useEffect(() => {
    loadRequest();
  }, [params.id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const data = await arApi.getRequestById(params.id as string);
      setRequest(data);

      // Load original account for UPDATE requests
      if (data.bankAccountId && data.requestType === 'UPDATE') {
        try {
          const account = await arApi.getBankAccountById(data.bankAccountId);
          setOriginalAccount(account);
        } catch (e) {
          console.log('Original account may have been deleted');
        }
      }
    } catch (error) {
      console.error('Failed to load request:', error);
    } finally {
      setLoading(false);
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

  const handleApprove = async () => {
    if (!confirm('Approve this request?')) return;
    
    try {
      setProcessing(true);
      await arApi.approveRequest(params.id as string);
      router.push('/finance/bank-accounts/requests');
    } catch (error: any) {
      alert(error.message || 'Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    try {
      setProcessing(true);
      await arApi.rejectRequest(params.id as string, rejectNotes);
      router.push('/finance/bank-accounts/requests');
    } catch (error: any) {
      alert(error.message || 'Failed to reject request');
    } finally {
      setProcessing(false);
    }
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

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'CREATE': return <Plus className="w-5 h-5" />;
      case 'UPDATE': return <Pencil className="w-5 h-5" />;
      case 'DELETE': return <Trash2 className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getRequestColor = (type: string) => {
    switch (type) {
      case 'CREATE': return 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/30';
      case 'UPDATE': return 'bg-[#CE9F6B]/15 text-[#976E44] border-[#CE9F6B]/30';
      case 'DELETE': return 'bg-[#E17F70]/15 text-[#E17F70] border-[#E17F70]/30';
      default: return 'bg-[#AEBFC3]/15 text-[#5D6E73] border-[#AEBFC3]/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/30';
      case 'REJECTED': return 'bg-[#E17F70]/15 text-[#E17F70] border-[#E17F70]/30';
      default: return 'bg-[#CE9F6B]/15 text-[#976E44] border-[#CE9F6B]/30';
    }
  };

  const getFieldChanges = (): FieldChange[] => {
    if (!request) return [];
    
    const fields: FieldChange[] = [
      {
        field: 'bpCode',
        label: 'BP Code / Vendor Code',
        oldValue: originalAccount?.bpCode || null,
        newValue: request.requestedData.bpCode || null,
        icon: <Shield className="w-4 h-4" />
      },
      {
        field: 'vendorName',
        label: 'Vendor Name',
        oldValue: originalAccount?.vendorName || null,
        newValue: request.requestedData.vendorName || null,
        icon: <User className="w-4 h-4" />
      },
      {
        field: 'beneficiaryName',
        label: 'Beneficiary Name',
        oldValue: (originalAccount as any)?.beneficiaryName || null,
        newValue: (request.requestedData as any).beneficiaryName || null,
        icon: <User className="w-4 h-4" />
      },
      {
        field: 'nickName',
        label: 'Nick Name',
        oldValue: originalAccount?.nickName || null,
        newValue: request.requestedData.nickName || null,
        icon: <Hash className="w-4 h-4" />
      },
      {
        field: 'beneficiaryBankName',
        label: 'Bank Name',
        oldValue: originalAccount?.beneficiaryBankName || null,
        newValue: request.requestedData.beneficiaryBankName || null,
        icon: <Building2 className="w-4 h-4" />
      },
      {
        field: 'accountNumber',
        label: 'Account Number',
        oldValue: originalAccount?.accountNumber || null,
        newValue: request.requestedData.accountNumber || null,
        icon: <CreditCard className="w-4 h-4" />
      },
      {
        field: 'ifscCode',
        label: 'IFSC Code / SWIFT Code',
        oldValue: originalAccount?.ifscCode || null,
        newValue: request.requestedData.ifscCode || null,
        icon: <Hash className="w-4 h-4" />
      },
      {
        field: 'emailId',
        label: 'Email ID',
        oldValue: originalAccount?.emailId || null,
        newValue: request.requestedData.emailId || null,
        icon: <Mail className="w-4 h-4" />
      },
      {
        field: 'isMSME',
        label: 'MSME Registered',
        oldValue: originalAccount?.isMSME ? 'Yes' : 'No',
        newValue: request.requestedData.isMSME ? 'Yes' : 'No',
        icon: <Sparkles className="w-4 h-4" />
      },
      {
        field: 'udyamRegNum',
        label: 'Udyam Reg. Number',
        oldValue: (originalAccount as any)?.udyamRegNum || null,
        newValue: (request.requestedData as any).udyamRegNum || null,
        icon: <Hash className="w-4 h-4" />
      },
      {
        field: 'gstNumber',
        label: 'GST Number',
        oldValue: (originalAccount as any)?.gstNumber || 'Unregistered',
        newValue: (request.requestedData as any).gstNumber || 'Unregistered',
        icon: <Shield className="w-4 h-4" />
      },
      {
        field: 'panNumber',
        label: 'PAN Number',
        oldValue: (originalAccount as any)?.panNumber || null,
        newValue: (request.requestedData as any).panNumber || null,
        icon: <BadgeCheck className="w-4 h-4" />
      },
      {
        field: 'currency',
        label: 'Currency',
        oldValue: originalAccount?.currency || null,
        newValue: request.requestedData.currency || null,
        icon: <CreditCard className="w-4 h-4" />
      },
      {
        field: 'accountType',
        label: 'Account Type',
        oldValue: originalAccount?.accountType || null,
        newValue: (request.requestedData as any).accountType || null,
        icon: <FileText className="w-4 h-4" />
      }
    ];

    return fields;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-[#CE9F6B]/30 border-t-[#CE9F6B] rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-16 h-16 text-[#E17F70]/50 mx-auto mb-4" />
        <p className="text-[#92A2A5] font-medium">Request not found</p>
        <Link href="/finance/bank-accounts/requests" className="text-[#CE9F6B] hover:underline mt-2 inline-block">
          Back to Requests
        </Link>
      </div>
    );
  }

  const fieldChanges = getFieldChanges();

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/finance/bank-accounts/requests"
            className="p-2 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] hover:text-[#546A7A] hover:border-[#CE9F6B]/30 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#546A7A] flex items-center gap-2">
              Request Details
              <Sparkles className="w-5 h-5 text-[#CE9F6B]" />
            </h1>
            <p className="text-[#92A2A5] text-sm mt-1 font-medium">
              Review change request details
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`px-4 py-2 rounded-xl text-sm font-semibold border ${getStatusColor(request.status)}`}>
          {request.status}
        </span>
      </div>

      {/* Request Summary Card */}
      <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-[#AEBFC3]/10">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${getRequestColor(request.requestType)}`}>
              {getRequestIcon(request.requestType)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#546A7A]">
                {request.requestType === 'CREATE' ? 'New Vendor Account Request' :
                 request.requestType === 'UPDATE' ? 'Vendor Account Update Request' :
                 'Vendor Account Deletion Request'}
              </h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-[#92A2A5]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(request.requestedAt)}
                </span>
                {request.requestedBy && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {request.requestedBy.name || request.requestedBy.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Field Changes Comparison */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#546A7A] mb-4 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-[#CE9F6B]" />
            {request.requestType === 'UPDATE' ? 'Changes Comparison' : 'Requested Data'}
          </h3>

          <div className="space-y-3">
            {fieldChanges.map((change) => {
              const hasChange = request.requestType === 'UPDATE' && change.oldValue !== change.newValue;
              const showField = request.requestType === 'CREATE' ? change.newValue : true;
              
              if (!showField && request.requestType === 'CREATE') return null;
              
              return (
                <div 
                  key={change.field}
                  className={`p-4 rounded-xl border ${
                    hasChange 
                      ? 'bg-[#CE9F6B]/5 border-[#CE9F6B]/30' 
                      : 'bg-[#F8FAFB] border-[#AEBFC3]/20'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm text-[#5D6E73] font-medium mb-2">
                    {change.icon}
                    {change.label}
                    {hasChange && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[#CE9F6B]/20 text-[#976E44]">
                        Modified
                      </span>
                    )}
                  </div>
                  
                  {request.requestType === 'UPDATE' ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 rounded-lg bg-white border border-[#AEBFC3]/20">
                        <div className="text-xs text-[#92A2A5] mb-1">Current</div>
                        <div className={`font-medium ${change.field === 'accountNumber' || change.field === 'ifscCode' ? 'font-mono' : ''} ${!change.oldValue ? 'text-[#AEBFC3] italic' : 'text-[#5D6E73]'}`}>
                          {change.oldValue || 'Not set'}
                        </div>
                      </div>
                      
                      <ArrowRight className={`w-5 h-5 flex-shrink-0 ${hasChange ? 'text-[#CE9F6B]' : 'text-[#AEBFC3]'}`} />
                      
                      <div className={`flex-1 p-3 rounded-lg border ${hasChange ? 'bg-[#CE9F6B]/10 border-[#CE9F6B]/30' : 'bg-white border-[#AEBFC3]/20'}`}>
                        <div className="text-xs text-[#92A2A5] mb-1">Requested</div>
                        <div className={`font-medium ${change.field === 'accountNumber' || change.field === 'ifscCode' ? 'font-mono' : ''} ${!change.newValue ? 'text-[#AEBFC3] italic' : 'text-[#546A7A]'}`}>
                          {change.newValue || 'Not set'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`font-medium ${change.field === 'accountNumber' || change.field === 'ifscCode' ? 'font-mono' : ''} text-[#546A7A]`}>
                      {change.newValue || <span className="text-[#AEBFC3] italic">Not provided</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Attachments Section */}
        {request.attachments && request.attachments.length > 0 && (
          <div className="p-6 border-t border-[#AEBFC3]/10">
            <h3 className="text-lg font-semibold text-[#546A7A] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#82A094]" />
              Attached Verification Documents
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {request.attachments.map((file) => (
                <div key={file.id} className="group relative p-4 rounded-2xl bg-white border border-[#AEBFC3]/20 hover:border-[#82A094]/40 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300 ${getFileColor(file.mimeType)}`}>
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#546A7A] truncate" title={file.filename}>
                          {file.filename}
                        </p>
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-[#AEBFC3]/10 text-[#92A2A5] text-[10px] font-bold uppercase tracking-tight">
                          {file.filename.split('.').pop()}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#92A2A5] mt-1 font-medium">
                        {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-[#AEBFC3]/10">
                    <button 
                      onClick={() => {
                        setPreviewFile(file);
                        setShowPreview(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#CE9F6B]/10 text-[#976E44] text-xs font-bold hover:bg-[#CE9F6B] hover:text-white transition-all shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button 
                      onClick={() => handleDownload(file.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#82A094]/10 text-[#82A094] text-xs font-bold hover:bg-[#82A094] hover:text-white transition-all shadow-sm"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review Notes (if reviewed) */}
        {request.reviewNotes && (
          <div className="p-6 border-t border-[#AEBFC3]/10 bg-[#F8FAFB]">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-[#92A2A5] mt-0.5" />
              <div>
                <div className="text-sm text-[#92A2A5] mb-1">
                  Admin Notes
                  {request.reviewedBy && ` by ${request.reviewedBy.name || request.reviewedBy.email}`}
                  {request.reviewedAt && ` • ${formatDate(request.reviewedAt)}`}
                </div>
                <p className="text-[#546A7A]">{request.reviewNotes}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        {isAdmin && request.status === 'PENDING' && (
          <>
            <button
              onClick={handleApprove}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-semibold hover:from-[#A2B9AF] hover:to-[#82A094] transition-all duration-300 shadow-lg shadow-[#82A094]/25 disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Approve Request
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#E17F70]/10 border-2 border-[#E17F70]/30 text-[#E17F70] font-semibold hover:bg-[#E17F70]/20 transition-all disabled:opacity-50"
            >
              <XCircle className="w-5 h-5" />
              Reject Request
            </button>
          </>
        )}

        {!isAdmin && request.status === 'REJECTED' && request.requestedById === user?.id && (
          <button
            onClick={() => router.push(`/finance/bank-accounts/requests/${request.id}/edit`)}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white font-semibold hover:from-[#976E44] hover:to-[#7A5837] transition-all duration-300 shadow-lg shadow-[#CE9F6B]/25"
          >
            <Pencil className="w-5 h-5" />
            Edit & Re-request
          </button>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-[#546A7A] flex items-center gap-2">
              <XCircle className="w-5 h-5 text-[#E17F70]" />
              Reject Request
            </h3>
            <p className="text-[#92A2A5] text-sm">
              Please provide a reason for rejecting this request.
            </p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full h-32 px-4 py-3 bg-white border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] placeholder-[#92A2A5] focus:outline-none focus:border-[#E17F70]/50 resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#AEBFC3]/10 border border-[#AEBFC3]/30 text-[#5D6E73] font-medium hover:bg-[#AEBFC3]/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectNotes.trim() || processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E17F70] text-white font-semibold hover:bg-[#9E3B47] transition-all disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </button>
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
