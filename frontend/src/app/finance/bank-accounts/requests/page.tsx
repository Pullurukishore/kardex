'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { arApi, BankAccountChangeRequest } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { 
  ArrowLeft, Sparkles, Clock, CheckCircle2, XCircle, 
  AlertCircle, Building2, Plus, Trash2, Pencil, Eye,
  MessageSquare, Loader2, Square, CheckSquare,
  ArrowRight, ExternalLink, Search
} from 'lucide-react';

export default function BankAccountRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<BankAccountChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null; notes: string; isBulk?: boolean }>({
    open: false,
    requestId: null,
    notes: '',
    isBulk: false
  });

  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

  useEffect(() => {
    loadRequests();
  }, [filter]);

  useEffect(() => {
    // Clear selections when filter changes
    setSelectedIds(new Set());
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      let data: BankAccountChangeRequest[];
      if (isAdmin) {
        data = await arApi.getPendingRequests(filter);
      } else {
        data = await arApi.getMyRequests();
        if (filter !== 'ALL') {
          data = data.filter(r => r.status === filter);
        }
      }
      setRequests(data);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this request?')) return;
    
    try {
      setProcessingId(id);
      await arApi.approveRequest(id);
      await loadRequests();
    } catch (error: any) {
      alert(error.message || 'Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.notes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    try {
      if (rejectModal.isBulk) {
        setBulkProcessing(true);
        const ids = Array.from(selectedIds);
        for (const id of ids) {
          await arApi.rejectRequest(id, rejectModal.notes);
        }
        setSelectedIds(new Set());
      } else if (rejectModal.requestId) {
        setProcessingId(rejectModal.requestId);
        await arApi.rejectRequest(rejectModal.requestId, rejectModal.notes);
      }
      setRejectModal({ open: false, requestId: null, notes: '', isBulk: false });
      await loadRequests();
    } catch (error: any) {
      alert(error.message || 'Failed to reject request');
    } finally {
      setProcessingId(null);
      setBulkProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    const count = selectedIds.size;
    if (!confirm(`Approve ${count} request${count > 1 ? 's' : ''}?`)) return;
    
    try {
      setBulkProcessing(true);
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await arApi.approveRequest(id);
      }
      setSelectedIds(new Set());
      await loadRequests();
    } catch (error: any) {
      alert(error.message || 'Failed to approve requests');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkReject = () => {
    setRejectModal({ open: true, requestId: null, notes: '', isBulk: true });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingInView = filteredRequests.filter(r => r.status === 'PENDING');
    if (selectedIds.size === pendingInView.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingInView.map(r => r.id)));
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
      case 'CREATE': return <Plus className="w-4 h-4" />;
      case 'UPDATE': return <Pencil className="w-4 h-4" />;
      case 'DELETE': return <Trash2 className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
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
      case 'APPROVED': return 'bg-[#82A094]/15 text-[#4F6A64]';
      case 'REJECTED': return 'bg-[#E17F70]/15 text-[#E17F70]';
      default: return 'bg-[#CE9F6B]/15 text-[#976E44]';
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();

    const vendorName = r.requestedData.vendorName?.toLowerCase() || '';
    const bpCode = r.requestedData.bpCode?.toLowerCase() || '';
    const bankName = r.requestedData.beneficiaryBankName?.toLowerCase() || '';
    const accountNumber = r.requestedData.accountNumber || '';
    const requesterName = r.requestedBy?.name?.toLowerCase() || '';
    const requesterEmail = r.requestedBy?.email?.toLowerCase() || '';

    return (
      vendorName.includes(term) ||
      bpCode.includes(term) ||
      bankName.includes(term) ||
      accountNumber.includes(term) ||
      requesterName.includes(term) ||
      requesterEmail.includes(term)
    );
  });

  const pendingRequests = filteredRequests.filter(r => r.status === 'PENDING');
  const hasSelection = selectedIds.size > 0;
  const allPendingSelected = pendingRequests.length > 0 && selectedIds.size === pendingRequests.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/finance/bank-accounts"
              className="p-2 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/40 text-[#5D6E73] hover:text-[#546A7A] hover:border-[#CE9F6B]/40 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#546A7A] flex items-center gap-2">
                {isAdmin ? 'Vendor Pending Requests' : 'My Vendor Requests'}
                <Sparkles className="w-5 h-5 text-[#CE9F6B]" />
              </h1>
              <p className="text-[#92A2A5] text-sm mt-1 font-medium">
                {isAdmin ? 'Review and approve vendor bank account changes' : 'Track your submitted vendor bank requests'}
              </p>
              <p className="text-[11px] text-[#AEBFC3] mt-1 font-medium">
                Showing {filteredRequests.length} {filter.toLowerCase()} request{filteredRequests.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isAdmin ? 'Search vendors, banks or accounts...' : 'Search your requests...'}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F8FAFB] border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] placeholder-[#92A2A5] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all text-sm"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setFilter('PENDING')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  filter === 'PENDING'
                    ? 'bg-[#CE9F6B] text-white border-[#CE9F6B] shadow-sm'
                    : 'bg-[#F8FAFB] text-[#92A2A5] border-[#AEBFC3]/40 hover:border-[#CE9F6B]/40 hover:text-[#546A7A]'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilter('APPROVED')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  filter === 'APPROVED'
                    ? 'bg-[#82A094] text-white border-[#82A094] shadow-sm'
                    : 'bg-[#F8FAFB] text-[#92A2A5] border-[#AEBFC3]/40 hover:border-[#CE9F6B]/40 hover:text-[#546A7A]'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilter('REJECTED')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  filter === 'REJECTED'
                    ? 'bg-[#E17F70] text-white border-[#E17F70] shadow-sm'
                    : 'bg-[#F8FAFB] text-[#92A2A5] border-[#AEBFC3]/40 hover:border-[#CE9F6B]/40 hover:text-[#546A7A]'
                }`}
              >
                Rejected
              </button>
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  filter === 'ALL'
                    ? 'bg-[#546A7A] text-white border-[#546A7A] shadow-sm'
                    : 'bg-[#F8FAFB] text-[#92A2A5] border-[#AEBFC3]/40 hover:border-[#CE9F6B]/40 hover:text-[#546A7A]'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar (Admin only, when there are pending requests) */}
      {isAdmin && filter === 'PENDING' && pendingRequests.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#AEBFC3]/20 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-[#5D6E73] hover:text-[#546A7A] transition-colors"
            >
              {allPendingSelected ? (
                <CheckSquare className="w-5 h-5 text-[#CE9F6B]" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              {allPendingSelected ? 'Deselect All' : 'Select All'}
            </button>
            {hasSelection && (
              <span className="text-sm text-[#92A2A5]">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {hasSelection && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                disabled={bulkProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#82A094]/15 border border-[#82A094]/30 text-[#4F6A64] font-medium hover:bg-[#82A094]/20 transition-all disabled:opacity-50"
              >
                {bulkProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Approve All ({selectedIds.size})
              </button>
              <button
                onClick={handleBulkReject}
                disabled={bulkProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E17F70]/15 border border-[#E17F70]/30 text-[#E17F70] font-medium hover:bg-[#E17F70]/20 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#AEBFC3]/20 p-6 animate-pulse shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#AEBFC3]/20 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-[#AEBFC3]/20 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-[#AEBFC3]/20 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-[#CE9F6B]/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-[#CE9F6B]/50" />
            </div>
            <p className="text-[#92A2A5] font-medium mb-2">No {filter.toLowerCase()} requests</p>
            <p className="text-[#AEBFC3] text-sm">
              {isAdmin ? 'All caught up! No pending requests to review.' : 'You haven\'t submitted any requests yet.'}
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-[#AEBFC3]/10 flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-[#AEBFC3]/60" />
            </div>
            <p className="text-[#92A2A5] font-medium mb-2">No matching requests found</p>
            <p className="text-[#AEBFC3] text-sm">
              Try adjusting your search term or clearing the filter.
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div 
              key={request.id} 
              className={`bg-white rounded-2xl border overflow-hidden hover:border-[#CE9F6B]/30 transition-all shadow-lg cursor-pointer group ${
                selectedIds.has(request.id) ? 'border-[#CE9F6B] ring-2 ring-[#CE9F6B]/20' : 'border-[#AEBFC3]/20'
              }`}
              onClick={() => router.push(`/finance/bank-accounts/requests/${request.id}`)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Selection Checkbox (Admin, Pending only) */}
                    {isAdmin && request.status === 'PENDING' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(request.id);
                        }}
                        className="mt-1 p-1 rounded-lg hover:bg-[#AEBFC3]/10 transition-colors"
                      >
                        {selectedIds.has(request.id) ? (
                          <CheckSquare className="w-5 h-5 text-[#CE9F6B]" />
                        ) : (
                          <Square className="w-5 h-5 text-[#92A2A5]" />
                        )}
                      </button>
                    )}

                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${getRequestColor(request.requestType)}`}>
                      {getRequestIcon(request.requestType)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-[#546A7A] group-hover:text-[#CE9F6B] transition-colors">
                          {request.requestType === 'CREATE' ? 'New Vendor Bank Account Request' :
                           request.requestType === 'UPDATE' ? 'Vendor Bank Account Update Request' :
                           'Vendor Bank Account Deletion Request'}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      
                      <p className="text-[#92A2A5] text-sm mb-3">
                        Submitted on {formatDate(request.requestedAt)}
                        {request.requestedBy && ` by ${request.requestedBy.name || request.requestedBy.email}`}
                      </p>

                      <div className="flex flex-wrap gap-4 text-sm">
                        {request.requestedData.vendorName && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#92A2A5]" />
                            <span className="text-[#546A7A]">{request.requestedData.vendorName} ({request.requestedData.bpCode || '—'})</span>
                          </div>
                        )}
                        {request.requestedData.beneficiaryBankName && (
                          <div className="text-[#92A2A5]">
                            Bank: <span className="text-[#546A7A]">{request.requestedData.beneficiaryBankName}</span>
                          </div>
                        )}
                        {request.requestedData.accountNumber && (
                          <div className="text-[#92A2A5]">
                            A/C: <span className="text-[#546A7A] font-mono">****{request.requestedData.accountNumber.slice(-4)}</span>
                          </div>
                        )}
                      </div>

                      {request.reviewNotes && (
                        <div className="mt-3 p-3 rounded-lg bg-[#AEBFC3]/10 border border-[#AEBFC3]/20">
                          <div className="flex items-center gap-2 text-[#92A2A5] text-sm mb-1">
                            <MessageSquare className="w-4 h-4" />
                            Admin Notes:
                          </div>
                          <p className="text-[#5D6E73] text-sm">{request.reviewNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && request.status === 'PENDING' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(request.id);
                          }}
                          disabled={processingId === request.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#82A094]/15 border border-[#82A094]/30 text-[#4F6A64] font-medium hover:bg-[#82A094]/20 transition-all disabled:opacity-50"
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRejectModal({ open: true, requestId: request.id, notes: '', isBulk: false });
                          }}
                          disabled={processingId === request.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E17F70]/15 border border-[#E17F70]/30 text-[#E17F70] font-medium hover:bg-[#E17F70]/20 transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}

                    {/* View Details Arrow */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#92A2A5] group-hover:text-[#CE9F6B] transition-all">
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-sm font-medium">Details</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-[#546A7A] flex items-center gap-2">
              <XCircle className="w-5 h-5 text-[#E17F70]" />
              {rejectModal.isBulk ? `Reject ${selectedIds.size} Request${selectedIds.size > 1 ? 's' : ''}` : 'Reject Request'}
            </h3>
            <p className="text-[#92A2A5] text-sm">
              Please provide a reason for rejection. {rejectModal.isBulk && 'This note will be applied to all selected requests.'}
            </p>
            <textarea
              value={rejectModal.notes}
              onChange={(e) => setRejectModal(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Enter rejection reason..."
              className="w-full h-32 px-4 py-3 bg-white border border-[#AEBFC3]/30 rounded-xl text-[#546A7A] placeholder-[#92A2A5] focus:outline-none focus:border-[#E17F70]/50 resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRejectModal({ open: false, requestId: null, notes: '', isBulk: false })}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#AEBFC3]/10 border border-[#AEBFC3]/30 text-[#5D6E73] font-medium hover:bg-[#AEBFC3]/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectModal.notes.trim() || processingId === rejectModal.requestId || bulkProcessing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E17F70] text-white font-semibold hover:bg-[#9E3B47] transition-all disabled:opacity-50"
              >
                {(processingId === rejectModal.requestId || bulkProcessing) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject{rejectModal.isBulk ? ` (${selectedIds.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
