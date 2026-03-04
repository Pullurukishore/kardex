'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { arApi, ARInvoice, formatARCurrency, formatARDate } from '@/lib/ar-api';
import { Search, ChevronLeft, ChevronRight, FileText, Plus, TrendingUp, AlertTriangle, Clock, CheckCircle2, IndianRupee, Calendar, Building2, Upload, Shield, Layers, Zap, Wallet, Package, Timer, Truck, PackageCheck, PackageX, BadgeCheck, Tag } from 'lucide-react';

export default function ARMilestonesPage() {
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadInvoices();
  }, [search, status, page]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const result = await arApi.getInvoices({ 
        search, 
        status, 
        invoiceType: 'MILESTONE', 
        page, 
        limit: 25 
      });
      setInvoices(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (error) {
      console.error('Failed to load milestone payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusFilters = [
    { value: '', label: 'All', icon: Layers },
    { value: 'PENDING', label: 'Pending', icon: Clock },
    { value: 'OVERDUE', label: 'Overdue', icon: AlertTriangle },
    { value: 'PAID', label: 'Paid', icon: CheckCircle2 },
    { value: 'PARTIAL', label: 'Partial', icon: TrendingUp },
  ];

  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'PAID': return 'bg-[#4F6A64] text-white';
      case 'PARTIAL': return 'bg-[#CE9F6B] text-white';
      case 'OVERDUE': return 'bg-[#E17F70] text-white';
      case 'PENDING': return 'bg-[#96AEC2] text-white';
      default: return 'bg-[#92A2A5] text-white';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'PAID': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'PARTIAL': return <TrendingUp className="w-3.5 h-3.5" />;
      case 'OVERDUE': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'PENDING': return <Clock className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const getMilestoneStatusStyle = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return 'bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/40';
      case 'PARTIALLY_DELIVERED': return 'bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/40';
      case 'FULLY_DELIVERED': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/40';
      case 'EXPIRED': return 'bg-[#E17F70]/15 text-[#9E3B47] border border-[#E17F70]/40';
      case 'LINKED': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/40';
      default: return 'bg-[#AEBFC3]/15 text-[#5D6E73] border border-[#AEBFC3]/30';
    }
  };

  const getMilestoneStatusIcon = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return <Package className="w-3.5 h-3.5" />;
      case 'PARTIALLY_DELIVERED': return <Truck className="w-3.5 h-3.5" />;
      case 'FULLY_DELIVERED': return <PackageCheck className="w-3.5 h-3.5" />;
      case 'EXPIRED': return <PackageX className="w-3.5 h-3.5" />;
      case 'LINKED': return <BadgeCheck className="w-3.5 h-3.5" />;
      default: return <Package className="w-3.5 h-3.5" />;
    }
  };

  const getMilestoneStatusLabel = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return 'Awaiting';
      case 'PARTIALLY_DELIVERED': return 'Partial';
      case 'FULLY_DELIVERED': return 'Delivered';
      case 'EXPIRED': return 'Expired';
      case 'LINKED': return 'Linked';
      default: return 'N/A';
    }
  };

  const getDeliveryDueDays = (invoice: ARInvoice) => {
    if (!invoice.deliveryDueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.deliveryDueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-4 sm:space-y-5 relative p-4 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-lg bg-gradient-to-br from-[#CE9F6B] to-[#E17F70] shadow-[#CE9F6B]/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#546A7A]">Milestone Payments</h1>
            <p className="text-xs text-[#92A2A5]">{total} milestone payments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            href="/finance/ar/milestones/new"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#E17F70]/25 hover:-translate-y-0.5 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Milestone Payment</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 bg-white rounded-xl border border-[#AEBFC3]/30 p-3">
        <div className="w-full sm:flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
          <input
            type="text"
            placeholder="Search milestone payments..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-11 sm:h-10 pl-10 pr-4 rounded-lg bg-[#F8FAFB] border border-[#AEBFC3]/40 text-sm focus:border-[#6F8A9D] focus:outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {statusFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = status === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => { setStatus(filter.value); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-md' : 'text-[#5D6E73] hover:bg-[#546A7A]/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-[#AEBFC3]/40 overflow-hidden shadow-lg">
        <div className="px-5 py-3 border-b border-[#AEBFC3]/30 bg-gradient-to-r from-[#CE9F6B] to-[#E17F70]">
          <div className="flex items-center justify-between font-bold text-white text-sm">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 opacity-90" />
              <span>Milestone Payment Records</span>
            </div>
            <div className="opacity-80 font-normal">
              Showing {invoices.length} of {total} records
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#CE9F6B]/10">
                <th className="text-left py-3 px-4 border-b-2 border-[#546A7A] bg-[#546A7A]/10 text-xs font-bold uppercase text-[#546A7A]">SO No</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#6F8A9D] bg-[#6F8A9D]/10 text-xs font-bold uppercase text-[#6F8A9D]">PO No</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#976E44] bg-[#976E44]/10 text-xs font-bold uppercase text-[#976E44]">Customer</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#5D6E73] bg-[#5D6E73]/10 text-xs font-bold uppercase text-[#5D6E73]">Category</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#82A094] bg-[#82A094]/10 text-xs font-bold uppercase text-[#4F6A64]">Advance Date</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#E17F70] bg-[#E17F70]/10 text-xs font-bold uppercase text-[#E17F70]">Delivery Date</th>
                <th className="text-right py-3 px-4 border-b-2 border-[#4F6A64] bg-[#4F6A64]/10 text-xs font-bold uppercase text-[#4F6A64]">Total</th>
                <th className="text-right py-3 px-4 border-b-2 border-[#96AEC2] bg-[#96AEC2]/10 text-xs font-bold uppercase text-[#6F8A9D]">Received</th>
                <th className="text-right py-3 px-4 border-b-2 border-[#9E3B47] bg-[#9E3B47]/10 text-xs font-bold uppercase text-[#9E3B47]">Balance</th>
                <th className="text-center py-3 px-4 border-b-2 border-[#5D6E73] bg-[#5D6E73]/10 text-xs font-bold uppercase text-[#5D6E73]">Milestone</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-[#AEBFC3]/15">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-[#AEBFC3]/10 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                   <td colSpan={10} className="py-16 text-center text-[#92A2A5]">No milestone payments found</td>
                </tr>
              ) : (
                invoices.map((invoice, index) => {
                  const deliveryDays = getDeliveryDueDays(invoice);
                  const isOverdue = deliveryDays !== null && deliveryDays < 0 && invoice.milestoneStatus !== 'FULLY_DELIVERED';
                  
                  return (
                    <tr 
                      key={invoice.id}
                      onClick={() => window.location.href = `/finance/ar/milestones/${invoice.id}`}
                      className={`cursor-pointer border-b border-[#AEBFC3]/15 transition-colors hover:bg-[#F8FAFB] ${
                        index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'
                      } ${isOverdue ? 'border-l-4 border-l-[#E17F70]' : 'border-l-4 border-l-transparent'}`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#546A7A]">{invoice.soNo || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-[#976E44] font-medium">{invoice.poNo || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-semibold truncate max-w-[150px]">{invoice.customerName}</div>
                        <div className="text-[10px] text-[#92A2A5]">{invoice.bpCode}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#5D6E73]/10 text-[#5D6E73] rounded">
                          {invoice.type || 'NB'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[#546A7A]">{invoice.advanceReceivedDate ? formatARDate(invoice.advanceReceivedDate) : '-'}</td>
                      <td className="py-3 px-4">
                        <div className={`text-sm ${isOverdue ? 'text-[#E17F70] font-bold' : 'text-[#546A7A]'}`}>
                          {invoice.deliveryDueDate ? formatARDate(invoice.deliveryDueDate) : '-'}
                        </div>
                        {deliveryDays !== null && invoice.milestoneStatus !== 'FULLY_DELIVERED' && (
                          <div className={`text-[9px] font-bold mt-1 ${deliveryDays < 0 ? 'text-[#E17F70]' : 'text-[#92A2A5]'}`}>
                            {deliveryDays < 0 ? `${Math.abs(deliveryDays)}d overdue` : `${deliveryDays}d left`}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#4F6A64]">{formatARCurrency(Number(invoice.totalAmount) || 0)}</td>
                      <td className="py-3 px-4 text-right text-[#6F8A9D] font-medium">{formatARCurrency(Number(invoice.totalReceipts) || 0)}</td>
                      <td className="py-3 px-4 text-right font-bold text-[#E17F70]">{formatARCurrency(Number(invoice.balance) || 0)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${getMilestoneStatusStyle(invoice.milestoneStatus)}`}>
                          {getMilestoneStatusIcon(invoice.milestoneStatus)}
                          {getMilestoneStatusLabel(invoice.milestoneStatus)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Logic Simplified */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-[#AEBFC3]/15 flex justify-between items-center bg-[#F8FAFB]">
            <span className="text-sm text-[#5D6E73]">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 px-3 border rounded-lg bg-white disabled:opacity-50 hover:bg-[#F4F7F9]"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 px-3 border rounded-lg bg-white disabled:opacity-50 hover:bg-[#F4F7F9]"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile view omitted for brevity but should be similar to main page just focused on MILESTONE */}
      <div className="md:hidden space-y-3">
          {invoices.map(invoice => (
            <Link key={invoice.id} href={`/finance/ar/milestones/${invoice.id}`} className="block bg-white p-4 rounded-xl border border-[#AEBFC3]/30 shadow-sm transition-all active:scale-95">
               <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-[#546A7A]">{invoice.soNo || invoice.invoiceNumber}</div>
                    <div className="text-[10px] text-[#976E44] font-medium">PO: {invoice.poNo || '-'}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${getMilestoneStatusStyle(invoice.milestoneStatus)}`}>{getMilestoneStatusLabel(invoice.milestoneStatus)}</span>
               </div>
               <div className="text-sm text-[#546A7A] mb-1 font-semibold truncate">{invoice.customerName}</div>
               <div className="flex justify-between items-end mt-4 pt-3 border-t border-[#AEBFC3]/10">
                  <div className="text-[10px] text-[#92A2A5] font-bold uppercase">Balance</div>
                  <div className="text-lg font-bold text-[#E17F70]">{formatARCurrency(Number(invoice.balance))}</div>
               </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
