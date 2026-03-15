'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARCustomer, formatARCurrency } from '@/lib/ar-api';
import { Search, Plus, Users, ChevronLeft, ChevronRight, Building2, AlertTriangle, Eye, Pencil, Sparkles, Receipt, TrendingUp, Wallet, UploadCloud } from 'lucide-react';

export default function ARCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<ARCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadCustomers();
  }, [search, page]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const result = await arApi.getCustomers({ search, page, limit: 20 });
      setCustomers(result.data);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-md';
      case 'MEDIUM': return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-md';
      case 'HIGH': return 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-md';
      case 'CRITICAL': return 'bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white shadow-md';
      default: return 'bg-[#AEBFC3]/15 text-[#5D6E73] border border-[#AEBFC3]/40';
    }
  };

  return (
    <div className="space-y-6 w-full relative overflow-hidden pb-8 p-4 sm:p-0">
      {/* Decorative Background */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-20 w-96 h-96 bg-gradient-to-tr from-[#A2B9AF]/10 to-[#82A094]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Premium Header - Teal/Green People Theme */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF] p-4 sm:p-6 shadow-xl">
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10 hidden sm:block">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 right-32 w-48 h-48 border-4 border-white rounded-full" />
          <div className="absolute top-8 left-1/3 w-16 h-16 border-2 border-white rounded-full" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3 flex-wrap">
                Customer Master
                <span className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold bg-white/20 backdrop-blur-sm text-white rounded-full border border-white/30">
                  {total} Total
                </span>
              </h1>
              <p className="text-white/80 text-xs sm:text-sm mt-1 flex items-center gap-2">
                <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Manage AR customer contacts and credit settings</span>
                <span className="sm:hidden">Manage customers</span>
              </p>
            </div>
          </div>
          <Link 
            href="/finance/ar/customers/new"
            className="group relative flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-white text-[#4F6A64] font-bold hover:shadow-2xl hover:shadow-white/30 hover:-translate-y-0.5 transition-all overflow-hidden min-h-[44px]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <Plus className="w-5 h-5" />
            <span className="relative">Add Customer</span>
            <Sparkles className="w-4 h-4 text-[#82A094] hidden sm:block" />
          </Link>
          <Link 
            href="/finance/ar/customers/import"
            className="group relative flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm text-white font-bold hover:bg-white/20 transition-all border border-white/30 min-h-[44px]"
          >
            <UploadCloud className="w-5 h-5" />
            <span className="relative">Import</span>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-[#82A094]/20 p-5 shadow-lg">
        <div className="relative max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#92A2A5] group-focus-within:text-[#82A094] transition-colors" />
          <input
            type="text"
            placeholder="Search by BP code or customer name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#82A094]/5 border-2 border-[#AEBFC3]/30 text-[#546A7A] font-medium placeholder:text-[#92A2A5] focus:border-[#82A094]/50 focus:outline-none focus:ring-4 focus:ring-[#82A094]/10 transition-all"
          />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#AEBFC3]/40 overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#AEBFC3]/30 bg-gradient-to-r from-[#4F6A64] to-[#82A094]">
          <div className="flex items-center justify-between font-bold text-white text-xs uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 opacity-90" />
              <span>Customer Master Table</span>
            </div>
            <div className="opacity-80">
              {customers.length} entries shown
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#F8FAFB]">
                <th className="w-[10%] text-left py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#4F6A64] tracking-wider">BP Code</th>
                <th className="w-[22%] text-left py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Customer / Region</th>
                <th className="w-[8%] text-center py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Invoices</th>
                <th className="w-[14%] text-right py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Total Invoiced</th>
                <th className="w-[14%] text-right py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Balance Due</th>
                <th className="w-[14%] text-right py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Credit Limit</th>
                <th className="w-[10%] text-center py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Risk Class</th>
                <th className="w-[8%] text-center py-4 px-4 border-b-2 border-[#4F6A64]/20 text-[10px] font-bold uppercase text-[#546A7A] tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={8} className="p-6"><div className="h-6 bg-[#AEBFC3]/10 rounded-xl" /></td></tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan={8} className="py-20 text-center text-[#92A2A5] font-medium italic">No customers found matching your search.</td></tr>
              ) : (
                customers.map((customer, index) => (
                  <tr 
                    key={customer.id} 
                    className={`group cursor-pointer transition-all ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'} hover:bg-[#F0F4F7]`}
                    onClick={() => router.push(`/finance/ar/customers/${customer.id}`)}
                  >
                    <td className="py-4 px-4 text-left">
                      <span className="text-[#82A094] font-bold text-sm bg-[#82A094]/10 px-3 py-1 rounded-lg">{customer.bpCode}</span>
                    </td>
                    <td className="py-4 px-4 overflow-hidden">
                      <div className="text-sm font-bold text-[#546A7A] truncate group-hover:text-[#4F6A64] group-hover:underline transition-all decoration-2 underline-offset-4">{customer.customerName}</div>
                      <div className="text-[10px] text-[#92A2A5] font-bold tracking-widest uppercase">{customer.region || '-'}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#82A094]/10 text-[#4F6A64]">
                        <Receipt className="w-3.5 h-3.5" />
                        <span className="font-bold text-sm">{customer._count?.invoices || 0}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TrendingUp className="w-4 h-4 text-[#82A094]" />
                        <span className="text-[#546A7A] font-bold">
                          {customer.totalInvoiceAmount ? formatARCurrency(customer.totalInvoiceAmount) : <span className="text-[#AEBFC3]">₹0</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Wallet className="w-4 h-4 text-[#E17F70]" />
                        <span className={`font-bold ${customer.outstandingBalance && customer.outstandingBalance > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
                          {customer.outstandingBalance ? formatARCurrency(customer.outstandingBalance) : <span className="text-[#82A094]">₹0</span>}
                        </span>
                      </div>
                    </td>
                     <td className="py-4 px-4 text-right">
                      <div className="flex flex-col items-end gap-1.5 min-w-[140px]">
                        <div className="text-xs">
                          <span className="text-[#546A7A] font-bold">
                            {(customer.creditLimit !== null && customer.creditLimit !== undefined) ? formatARCurrency(customer.creditLimit) : <span className="text-[#AEBFC3]">No Limit</span>}
                          </span>
                        </div>
                        {customer.creditLimit !== null && customer.creditLimit !== undefined ? (
                          <div className="flex items-center gap-2 w-full justify-end">
                            <div className="flex-1 max-w-[80px] h-2 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 ${
                                  customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 90 ? 'bg-[#E17F70]' 
                                  : customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 75 ? 'bg-[#CE9F6B]' 
                                  : 'bg-[#82A094]'
                                }`}
                                style={{ 
                                  width: `${customer.creditLimit > 0 
                                    ? Math.min(100, Math.max(0, ((customer.outstandingBalance || 0) / customer.creditLimit) * 100)) 
                                    : (customer.outstandingBalance || 0) > 0 ? 100 : 0}%` 
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-[#92A2A5] font-bold whitespace-nowrap w-10 text-right">
                              {customer.creditLimit > 0 ? Math.round(((customer.outstandingBalance || 0) / customer.creditLimit) * 100) : ((customer.outstandingBalance || 0) > 0 ? '100' : '0')}%
                            </span>
                          </div>
                        ) : (
                          <div className="h-2 w-full bg-transparent"></div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${getRiskBadge(customer.riskClass)}`}>
                        {customer.riskClass === 'CRITICAL' && <AlertTriangle className="w-3 h-3" />}
                        {customer.riskClass}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/finance/ar/customers/${customer.id}`}
                          className="p-2.5 rounded-xl bg-[#82A094]/10 hover:bg-[#82A094]/20 text-[#5D6E73] hover:text-[#4F6A64] transition-all"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/finance/ar/customers/${customer.id}/edit`}
                          className="p-2.5 rounded-xl bg-[#CE9F6B]/10 hover:bg-[#CE9F6B]/20 text-[#5D6E73] hover:text-[#976E44] transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Improved Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-5 border-t border-[#AEBFC3]/20 flex justify-between items-center bg-[#F8FAFB]">
            <span className="text-xs font-bold text-[#92A2A5] tracking-widest uppercase">Page {page} of {totalPages}</span>
            <div className="flex gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#AEBFC3]/30 rounded-xl text-xs font-bold text-[#546A7A] hover:bg-white/50 disabled:opacity-30 shadow-sm transition-all">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-2 px-4 py-2 bg-[#4F6A64] rounded-xl text-xs font-bold text-white hover:bg-[#82A094] disabled:opacity-30 shadow-lg transition-all">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#82A094]/20 p-4 animate-pulse">
              <div className="h-4 bg-[#AEBFC3]/20 rounded w-24 mb-2" />
              <div className="h-3 bg-[#AEBFC3]/15 rounded w-40 mb-3" />
              <div className="h-6 bg-[#AEBFC3]/20 rounded w-28" />
            </div>
          ))
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#82A094]/20 p-8 text-center">
            <Building2 className="w-12 h-12 text-[#82A094]/50 mx-auto mb-3" />
            <p className="text-[#546A7A] font-medium">No customers found</p>
          </div>
        ) : (
          customers.map((customer, index) => (
            <Link
              key={customer.id}
              href={`/finance/ar/customers/${customer.id}`}
              className={`block bg-white rounded-xl border shadow-sm p-4 active:scale-[0.98] transition-all ${
                customer.riskClass === 'CRITICAL' || customer.riskClass === 'HIGH'
                  ? 'border-l-4 border-l-[#E17F70] border-[#82A094]/20'
                  : 'border-[#82A094]/20'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[#82A094] font-bold text-sm bg-[#82A094]/10 px-2 py-0.5 rounded">{customer.bpCode}</span>
                  <p className="text-[#546A7A] font-semibold mt-1 truncate max-w-[200px]">{customer.customerName}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getRiskBadge(customer.riskClass)}`}>
                  {customer.riskClass}
                </span>
              </div>
              
              {/* Stats Row */}
              <div className="flex items-center justify-between py-2 border-t border-b border-[#82A094]/15">
                <div>
                  <p className="text-xs text-[#92A2A5]">Invoices</p>
                  <p className="font-bold text-[#546A7A]">{customer._count?.invoices || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#92A2A5]">Balance</p>
                  <p className={`font-bold ${customer.outstandingBalance && customer.outstandingBalance > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
                    {customer.outstandingBalance ? formatARCurrency(customer.outstandingBalance) : '₹0'}
                  </p>
                </div>
              </div>
              
              {/* Total */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-[#5D6E73]">Total Invoiced</span>
                <span className="text-sm font-bold text-[#546A7A]">
                  {customer.totalInvoiceAmount ? formatARCurrency(customer.totalInvoiceAmount) : '₹0'}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#82A094]/10">
                <span className="text-xs text-[#5D6E73]">Credit Limit</span>
                <span className="text-sm font-bold text-[#546A7A]">
                  {customer.creditLimit ? formatARCurrency(customer.creditLimit) : '-'}
                </span>
              </div>
            </Link>
          ))
        )}
        
        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-[#82A094]/20 p-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-[#82A094]/30 text-[#546A7A] disabled:opacity-40 min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm text-[#5D6E73] font-medium">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-[#82A094]/30 text-[#546A7A] disabled:opacity-40 min-h-[44px]"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
