'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARCustomer, formatARCurrency } from '@/lib/ar-api';
import { Search, Plus, Users, ChevronLeft, ChevronRight, Building2, AlertTriangle, Eye, Pencil, Sparkles, Receipt, TrendingUp, Wallet, UploadCloud, CreditCard, IndianRupee, UserCheck, AlertCircle } from 'lucide-react';

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
      const result = await arApi.getCustomers({ search, page, limit: 500 });
      setCustomers(result.data);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalBalance = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const totalInvoiced = customers.reduce((sum, c) => sum + (c.totalInvoiceAmount || 0), 0);
    const totalCreditLimit = customers.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
    const highRiskCount = customers.filter(c => c.riskClass === 'HIGH' || c.riskClass === 'CRITICAL').length;
    return { totalBalance, totalInvoiced, totalCreditLimit, highRiskCount };
  }, [customers]);

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'bg-gradient-to-r from-[#A2B9AF] to-[#82A094] text-white shadow-lg shadow-[#82A094]/20';
      case 'MEDIUM': return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/20';
      case 'HIGH': return 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-lg shadow-[#E17F70]/20';
      case 'CRITICAL': return 'bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white shadow-lg shadow-[#9E3B47]/20 animate-pulse';
      default: return 'bg-[#AEBFC3]/20 text-[#5D6E73] border border-[#AEBFC3]/30';
    }
  };

  return (
    <div className="space-y-5 w-full relative overflow-hidden pb-8 p-4 sm:p-0">
      {/* Decorative Background */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-[#96AEC2]/8 to-[#6F8A9D]/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-32 w-80 h-80 bg-gradient-to-tr from-[#A2B9AF]/8 to-[#82A094]/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 right-1/4 w-64 h-64 bg-gradient-to-bl from-[#CE9F6B]/5 to-[#976E44]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Premium Header - Kardex Blue/Green Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] p-5 sm:p-6 shadow-2xl shadow-[#546A7A]/20">
        {/* Animated Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 hidden sm:block">
          <div className="absolute top-4 right-16 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-12 right-40 w-56 h-56 border-4 border-white/30 rounded-full" />
          <div className="absolute top-12 left-1/4 w-20 h-20 border-2 border-white/40 rounded-full" />
          <div className="absolute -top-8 left-1/2 w-12 h-12 bg-white/20 rounded-full" />
        </div>
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer-slide_4s_ease-in-out_infinite]" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative p-3 sm:p-4 rounded-2xl bg-white/15 backdrop-blur-md shadow-xl border border-white/20">
              <Users className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#82A094] rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                Customer Master
                <span className="px-4 py-1.5 text-sm font-bold bg-white/20 backdrop-blur-sm text-white rounded-full border border-white/30">
                  {total} Records
                </span>
              </h1>
              <p className="text-white/75 text-sm mt-1 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Manage AR customer contacts, credit limits, and risk classifications</span>
                <span className="sm:hidden">Manage customers & credit</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/finance/ar/customers/new"
              className="group relative flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-[#546A7A] font-bold hover:shadow-2xl hover:shadow-white/40 hover:-translate-y-0.5 transition-all overflow-hidden min-h-[44px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#96AEC2]/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Plus className="w-5 h-5" />
              <span className="relative">Add Customer</span>
              <Sparkles className="w-4 h-4 text-[#82A094] hidden sm:block" />
            </Link>
            <Link 
              href="/finance/ar/customers/import"
              className="group relative flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 backdrop-blur-sm text-white font-bold hover:bg-white/20 transition-all border border-white/30 min-h-[44px]"
            >
              <UploadCloud className="w-5 h-5" />
              <span className="relative">Import</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      {!loading && customers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="relative group bg-white rounded-2xl border-2 border-[#96AEC2]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#96AEC2] hover:scale-[1.02] transition-all overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#546A7A] via-[#96AEC2] to-[#6F8A9D]" />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#96AEC2] to-[#546A7A] shadow-lg shadow-[#96AEC2]/30">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#546A7A] uppercase tracking-wide">Total Balance</p>
                <p className="text-lg sm:text-xl font-bold text-[#546A7A] truncate">{formatARCurrency(stats.totalBalance)}</p>
              </div>
            </div>
          </div>
          
          <div className="relative group bg-white rounded-2xl border-2 border-[#82A094]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#82A094] hover:scale-[1.02] transition-all overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/30">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#4F6A64] uppercase tracking-wide">Total Invoiced</p>
                <p className="text-lg sm:text-xl font-bold text-[#4F6A64] truncate">{formatARCurrency(stats.totalInvoiced)}</p>
              </div>
            </div>
          </div>
          
          <div className="relative group bg-white rounded-2xl border-2 border-[#CE9F6B]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#CE9F6B] hover:scale-[1.02] transition-all overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#EEC1BF]" />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/30">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#976E44] uppercase tracking-wide">Credit Extended</p>
                <p className="text-lg sm:text-xl font-bold text-[#976E44] truncate">{formatARCurrency(stats.totalCreditLimit)}</p>
              </div>
            </div>
          </div>
          
          <div className="relative group bg-white rounded-2xl border-2 border-[#E17F70]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#E17F70] hover:scale-[1.02] transition-all overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]" />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] shadow-lg shadow-[#E17F70]/30">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#9E3B47] uppercase tracking-wide">High Risk</p>
                <p className="text-lg sm:text-xl font-bold text-[#9E3B47]">{stats.highRiskCount} <span className="text-sm font-medium text-[#E17F70]/70">customers</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 p-5 shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
        <div className="relative max-w-lg group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#92A2A5] group-focus-within:text-[#6F8A9D] transition-colors" />
          <input
            type="text"
            placeholder="Search by BP code or customer name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-gradient-to-r from-[#96AEC2]/5 to-[#6F8A9D]/5 border-2 border-[#6F8A9D]/30 text-[#546A7A] font-medium placeholder:text-[#92A2A5] focus:border-[#6F8A9D] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6F8A9D]/20 transition-all"
          />
          {search && (
            <button 
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-[#E17F70]/15 text-[#92A2A5] hover:text-[#E17F70] transition-colors"
            >
              <span className="sr-only">Clear search</span>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
        <div className="px-5 py-4 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#6F8A9D]/10 via-[#96AEC2]/5 to-transparent">
          <div className="flex items-center justify-between font-bold text-[#546A7A] text-sm uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/30">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <span>Customer Directory</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white rounded-lg text-xs font-bold shadow-lg shadow-[#6F8A9D]/20">{customers.length} records</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-gradient-to-r from-[#96AEC2]/10 via-[#6F8A9D]/5 to-transparent">
                <th className="w-[10%] text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">BP Code</th>
                <th className="w-[22%] text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">Customer / Region</th>
                <th className="w-[8%] text-center py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">Invoices</th>
                <th className="w-[14%] text-right py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">Total Invoiced</th>
                <th className="w-[14%] text-right py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">Balance Due</th>
                <th className="w-[14%] text-right py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">Credit Limit</th>
                <th className="w-[10%] text-center py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">Risk Class</th>
                <th className="w-[8%] text-center py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-xs font-bold uppercase text-[#546A7A] tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="p-5"><div className="h-5 bg-[#AEBFC3]/15 rounded-lg" /></td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#96AEC2] to-[#6F8A9D] flex items-center justify-center shadow-lg shadow-[#96AEC2]/20">
                        <Building2 className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-[#546A7A] font-bold text-lg">No customers found matching your search.</p>
                      <button 
                        onClick={() => { setSearch(''); setPage(1); }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-bold text-sm hover:shadow-lg hover:shadow-[#6F8A9D]/20 transition-all"
                      >
                        Clear search
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer, index) => (
                  <tr 
                    key={customer.id} 
                    className={`group cursor-pointer transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/60'} hover:bg-gradient-to-r hover:from-[#96AEC2]/10 hover:to-[#82A094]/5 hover:shadow-md`}
                    onClick={() => router.push(`/finance/ar/customers/${customer.id}`)}
                  >
                    <td className="py-4 px-4 text-left">
                      <span className="inline-flex items-center gap-1.5 text-[#6F8A9D] font-bold text-sm bg-gradient-to-r from-[#96AEC2]/20 to-[#6F8A9D]/10 px-3 py-1.5 rounded-xl border-2 border-[#6F8A9D]/20 shadow-sm">
                        {customer.bpCode}
                      </span>
                    </td>
                    <td className="py-4 px-4 overflow-hidden">
                      <div className="text-sm font-bold text-[#546A7A] truncate group-hover:text-[#546A7A] group-hover:underline transition-all decoration-2 decoration-[#96AEC2] underline-offset-4">{customer.customerName}</div>
                      <div className="text-[10px] text-[#92A2A5] font-medium tracking-wider uppercase mt-0.5">{customer.region || 'No region'}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white border border-[#82A094]/20 shadow-lg shadow-[#82A094]/20">
                        <Receipt className="w-3.5 h-3.5" />
                        <span className="font-bold text-sm">{customer._count?.invoices || 0}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TrendingUp className="w-4 h-4 text-[#82A094]" />
                        <span className="text-[#546A7A] font-bold">
                          {customer.totalInvoiceAmount ? formatARCurrency(customer.totalInvoiceAmount) : <span className="text-[#AEBFC3] font-normal">₹0</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Wallet className="w-4 h-4 text-[#E17F70]" />
                        <span className={`font-bold ${customer.outstandingBalance && customer.outstandingBalance > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
                          {customer.outstandingBalance ? formatARCurrency(customer.outstandingBalance) : <span className="text-[#82A094] font-normal">₹0</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-col items-end gap-1 min-w-[130px]">
                        <div className="text-xs">
                          <span className="text-[#546A7A] font-semibold">
                            {(customer.creditLimit !== null && customer.creditLimit !== undefined) ? formatARCurrency(customer.creditLimit) : <span className="text-[#AEBFC3] font-normal">No Limit</span>}
                          </span>
                        </div>
                        {customer.creditLimit !== null && customer.creditLimit !== undefined ? (
                          <div className="flex items-center gap-2 w-full justify-end">
                            <div className="flex-1 max-w-[70px] h-1.5 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 90 ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]' 
                                  : customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 75 ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]' 
                                  : 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]'
                                }`}
                                style={{ 
                                  width: `${customer.creditLimit > 0 
                                    ? Math.min(100, Math.max(0, ((customer.outstandingBalance || 0) / customer.creditLimit) * 100)) 
                                    : (customer.outstandingBalance || 0) > 0 ? 100 : 0}%` 
                                }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold whitespace-nowrap w-9 text-right ${
                              customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 90 ? 'text-[#9E3B47]' 
                              : customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 75 ? 'text-[#976E44]' 
                              : 'text-[#4F6A64]'
                            }`}>
                              {customer.creditLimit > 0 ? Math.round(((customer.outstandingBalance || 0) / customer.creditLimit) * 100) : ((customer.outstandingBalance || 0) > 0 ? '100' : '0')}%
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${getRiskBadge(customer.riskClass)}`}>
                        {customer.riskClass === 'CRITICAL' && <AlertTriangle className="w-3 h-3 animate-pulse" />}
                        {customer.riskClass}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/finance/ar/customers/${customer.id}`}
                          className="p-2 rounded-xl bg-gradient-to-br from-[#96AEC2]/15 to-[#6F8A9D]/10 hover:from-[#96AEC2] hover:to-[#6F8A9D] text-[#5D6E73] hover:text-white transition-all border border-[#96AEC2]/30 hover:border-transparent shadow-sm hover:shadow-lg hover:shadow-[#96AEC2]/20"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/finance/ar/customers/${customer.id}/edit`}
                          className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B]/15 to-[#976E44]/10 hover:from-[#CE9F6B] hover:to-[#976E44] text-[#5D6E73] hover:text-white transition-all border border-[#CE9F6B]/30 hover:border-transparent shadow-sm hover:shadow-lg hover:shadow-[#CE9F6B]/20"
                          title="Edit customer"
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

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-4 border-t-2 border-[#6F8A9D]/20 flex justify-between items-center bg-gradient-to-r from-[#96AEC2]/5 via-transparent to-white">
            <span className="text-sm font-bold text-[#92A2A5] tracking-wide">Page <span className="text-[#546A7A]">{page}</span> of <span className="text-[#546A7A]">{totalPages}</span></span>
            <div className="flex gap-3">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1} 
                className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-[#AEBFC3]/40 rounded-xl text-sm font-bold text-[#546A7A] hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages} 
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] rounded-xl text-sm font-bold text-white hover:shadow-xl hover:shadow-[#6F8A9D]/30 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-4 animate-pulse">
              <div className="h-4 bg-[#AEBFC3]/20 rounded w-24 mb-2" />
              <div className="h-3 bg-[#AEBFC3]/15 rounded w-40 mb-3" />
              <div className="h-6 bg-[#AEBFC3]/20 rounded w-28" />
            </div>
          ))
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#96AEC2] to-[#6F8A9D] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#96AEC2]/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <p className="text-[#546A7A] font-bold text-lg">No customers found</p>
            <button 
              onClick={() => { setSearch(''); setPage(1); }}
              className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-bold text-sm hover:shadow-lg hover:shadow-[#6F8A9D]/20 transition-all"
            >
              Clear search
            </button>
          </div>
        ) : (
          customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/finance/ar/customers/${customer.id}`}
              className={`relative block bg-white rounded-2xl border-2 shadow-lg overflow-hidden active:scale-[0.98] transition-all ${
                customer.riskClass === 'CRITICAL' || customer.riskClass === 'HIGH'
                  ? 'border-[#E17F70]/50'
                  : customer.riskClass === 'MEDIUM'
                  ? 'border-[#CE9F6B]/50'
                  : 'border-[#AEBFC3]/30'
              }`}
            >
              {/* Card Header with gradient accent */}
              <div className="relative p-4 pb-3">
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  customer.riskClass === 'CRITICAL' || customer.riskClass === 'HIGH' ? 'bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]' :
                  customer.riskClass === 'MEDIUM' ? 'bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#EEC1BF]' :
                  'bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]'
                }`} />
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center text-[#6F8A9D] font-bold text-sm bg-gradient-to-r from-[#96AEC2]/20 to-[#6F8A9D]/10 px-3 py-1 rounded-xl border-2 border-[#6F8A9D]/20 shadow-sm">
                      {customer.bpCode}
                    </span>
                    <p className="text-[#546A7A] font-bold mt-2 truncate text-lg">{customer.customerName}</p>
                    <p className="text-[#92A2A5] text-xs mt-0.5 font-medium">{customer.region || 'No region'}</p>
                  </div>
                  <span className={`ml-2 px-3 py-1.5 rounded-xl text-xs font-bold ${getRiskBadge(customer.riskClass)}`}>
                    {customer.riskClass}
                  </span>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-px bg-[#AEBFC3]/20 mx-4 mb-4 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/5 p-3 text-center">
                  <p className="text-[10px] text-[#4F6A64] uppercase tracking-wide font-bold">Invoices</p>
                  <p className="text-xl font-bold text-[#4F6A64] flex items-center justify-center gap-1">
                    <Receipt className="w-4 h-4" />
                    {customer._count?.invoices || 0}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-[#E17F70]/10 to-[#9E3B47]/5 p-3 text-center">
                  <p className="text-[10px] text-[#9E3B47] uppercase tracking-wide font-bold">Balance</p>
                  <p className={`text-xl font-bold flex items-center justify-center gap-1 ${customer.outstandingBalance && customer.outstandingBalance > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
                    <Wallet className="w-4 h-4" />
                    {customer.outstandingBalance ? formatARCurrency(customer.outstandingBalance) : '₹0'}
                  </p>
                </div>
              </div>
              
              {/* Footer Details */}
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between py-2 border-t-2 border-[#AEBFC3]/20">
                  <span className="text-xs text-[#5D6E73] font-bold">Total Invoiced</span>
                  <span className="text-sm font-bold text-[#546A7A]">
                    {customer.totalInvoiceAmount ? formatARCurrency(customer.totalInvoiceAmount) : '₹0'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#5D6E73] font-bold">Credit Limit</span>
                  <span className="text-sm font-bold text-[#546A7A]">
                    {customer.creditLimit ? formatARCurrency(customer.creditLimit) : <span className="text-[#AEBFC3] font-normal">No Limit</span>}
                  </span>
                </div>
                {customer.creditLimit !== null && customer.creditLimit !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 90 ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]' 
                          : customer.creditLimit > 0 && ((customer.outstandingBalance || 0) / customer.creditLimit) * 100 > 75 ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]' 
                          : 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, ((customer.outstandingBalance || 0) / customer.creditLimit) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[#92A2A5]">{Math.round(((customer.outstandingBalance || 0) / customer.creditLimit) * 100)}%</span>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
        
        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-[#6F8A9D]/30 p-4 shadow-lg">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-5 py-2.5 rounded-xl border-2 border-[#AEBFC3]/40 text-[#546A7A] disabled:opacity-40 min-h-[44px] font-bold text-sm hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm text-[#546A7A] font-bold">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white disabled:opacity-40 min-h-[44px] font-bold text-sm hover:shadow-lg hover:shadow-[#6F8A9D]/20 transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
