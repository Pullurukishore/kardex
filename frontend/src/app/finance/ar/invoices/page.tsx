'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARInvoice, formatARCurrency, formatARDate, TSP_OPTIONS } from '@/lib/ar-api';
import { Search, ChevronLeft, ChevronRight, FileText, Plus, TrendingUp, AlertTriangle, Clock, CheckCircle2, IndianRupee, Calendar, Building2, Upload, Shield, Layers, Zap, Tag, XCircle, Filter, RotateCcw, User, Truck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";

export default function ARInvoicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Initialize state from URL
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState<{ id: string, label: string, searchText?: string }[]>([]);
  
  // Advanced Filter States initialized from URL
  const [customerId, setCustomerId] = useState(searchParams.get('customerId') || '');
  const [fromDate, setFromDate] = useState(searchParams.get('fromDate') || '');
  const [toDate, setToDate] = useState(searchParams.get('toDate') || '');
  const [region, setRegion] = useState(searchParams.get('region') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [accountingStatus, setAccountingStatus] = useState(searchParams.get('accountingStatus') || '');
  const [minAmount, setMinAmount] = useState(searchParams.get('minAmount') || '');
  const [maxAmount, setMaxAmount] = useState(searchParams.get('maxAmount') || '');
  const [riskClass, setRiskClass] = useState(searchParams.get('riskClass') || '');
  const [tsp, setTsp] = useState(searchParams.get('tsp') || '');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const agingBucket = searchParams.get('agingBucket') || '';

  // Synchronize state changes to URL
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    let changed = false;

    const updateParam = (key: string, value: string | number) => {
      const strVal = String(value);
      if (strVal) {
        if (params.get(key) !== strVal) { params.set(key, strVal); changed = true; }
      } else {
        if (params.has(key)) { params.delete(key); changed = true; }
      }
    };

    updateParam('search', search);
    updateParam('status', status);
    updateParam('page', page > 1 ? page : '');
    updateParam('customerId', customerId);
    updateParam('fromDate', fromDate);
    updateParam('toDate', toDate);
    updateParam('region', region);
    updateParam('category', category);
    updateParam('accountingStatus', accountingStatus);
    updateParam('minAmount', minAmount);
    updateParam('maxAmount', maxAmount);
    updateParam('riskClass', riskClass);
    updateParam('tsp', tsp);

    if (changed) {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [search, status, page, customerId, fromDate, toDate, region, category, accountingStatus, minAmount, maxAmount, riskClass, tsp, pathname, router, searchParams]);

  const agingBucketLabels: Record<string, string> = {
    'current': 'Current (Not Yet Due)',
    '1-30': '1-30 Days Overdue',
    '31-60': '31-60 Days Overdue',
    '61-90': '61-90 Days Overdue',
    '90+': '90+ Days Overdue',
  };

  useEffect(() => {
    loadInvoices();
  }, [search, status, page, agingBucket, customerId, fromDate, toDate, region, category, accountingStatus, minAmount, maxAmount, riskClass, tsp]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const result = await arApi.getCustomers({ limit: 1000 });
      setCustomers(result.data.map((c: any) => ({
        id: c.bpCode,
        label: c.customerName,
        searchText: `${c.bpCode} ${c.customerName}`
      })));
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const result = await arApi.getInvoices({ 
        search, 
        status, 
        invoiceType: 'REGULAR', // Hardcoded to Regular
        agingBucket: agingBucket || undefined,
        customerId: customerId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        region: region || undefined,
        category: category || undefined,
        accountingStatus: accountingStatus || undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
        riskClass: riskClass || undefined,
        tsp: tsp || undefined,
        page, 
        limit: 100
      });
      setInvoices(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
      
      // Cache current list for Prev/Next navigation in detail view
      if (typeof window !== 'undefined' && result.data) {
        const idList = result.data.map((inv: any) => inv.invoiceNumber);
        sessionStorage.setItem('ar_invoice_list', JSON.stringify(idList));
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusFilters = [
    { value: '', label: 'Active', icon: Layers },
    { value: 'PENDING', label: 'Pending', icon: Clock },
    { value: 'OVERDUE', label: 'Overdue', icon: AlertTriangle },
    { value: 'PAID', label: 'Paid', icon: CheckCircle2 },
    { value: 'PARTIAL', label: 'Partial', icon: TrendingUp },
    { value: 'CANCELLED', label: 'Cancelled', icon: XCircle },
  ];

  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'PAID': return 'bg-gradient-to-r from-[#4F6A64] to-[#82A094] text-white shadow-lg shadow-[#82A094]/20';
      case 'PARTIAL': return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/20';
      case 'OVERDUE': return 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-lg shadow-[#E17F70]/20';
      case 'PENDING': return 'bg-gradient-to-r from-[#96AEC2] to-[#6F8A9D] text-white shadow-lg shadow-[#96AEC2]/20';
      case 'CANCELLED': return 'bg-gradient-to-r from-[#92A2A5] to-[#5D6E73] text-white opacity-60';
      default: return 'bg-gradient-to-r from-[#92A2A5] to-[#5D6E73] text-white';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'PAID': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'PARTIAL': return <TrendingUp className="w-3.5 h-3.5" />;
      case 'OVERDUE': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'PENDING': return <Clock className="w-3.5 h-3.5" />;
      case 'CANCELLED': return <XCircle className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const getRiskStyle = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return 'bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white font-bold shadow-lg shadow-[#9E3B47]/20 animate-pulse';
      case 'HIGH': return 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-lg shadow-[#E17F70]/20';
      case 'MEDIUM': return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/20';
      case 'LOW': return 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/20';
      default: return 'bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5] text-white';
    }
  };

  const activeFilterCount = [
    customerId, fromDate, toDate, region, category, 
    accountingStatus, minAmount, maxAmount, riskClass, tsp
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch('');
    setStatus('');
    setCustomerId('');
    setFromDate('');
    setToDate('');
    setRegion('');
    setCategory('');
    setAccountingStatus('');
    setMinAmount('');
    setMaxAmount('');
    setRiskClass('');
    setTsp('');
    setPage(1);
  };

  // Generate page numbers with ellipsis for pagination
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const renderPagination = (isTop = false) => {
    if (loading || totalPages <= 1) return null;
    
    return (
      <div className={`relative p-5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-r from-[#96AEC2]/5 via-transparent to-white overflow-hidden ${isTop ? 'border-b-2 border-[#6F8A9D]/20' : 'border-t-2 border-[#6F8A9D]/20'}`}>
        <div className={`absolute left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] ${isTop ? 'bottom-0' : 'top-0'}`} />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#92A2A5] tracking-wide">Showing</span>
          <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#546A7A]/10 to-[#6F8A9D]/5 text-xs font-black text-[#546A7A] border border-[#6F8A9D]/20">{((page - 1) * 100) + 1}–{Math.min(page * 100, total)}</span>
          <span className="text-xs font-bold text-[#92A2A5]">of</span>
          <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 text-xs font-black text-[#976E44] border border-[#CE9F6B]/20">{total}</span>
          <span className="text-xs font-bold text-[#92A2A5] tracking-wide">records</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#96AEC2]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            title="First page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-[#AEBFC3]/30 rounded-lg text-xs font-bold text-[#546A7A] hover:bg-[#96AEC2]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            Prev
          </button>
          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="w-8 text-center text-xs font-bold text-[#92A2A5] select-none">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-all duration-200 ${
                    page === p
                      ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/25 scale-110 ring-2 ring-[#6F8A9D]/30'
                      : 'bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#96AEC2]/10 hover:border-[#6F8A9D] hover:scale-105 shadow-sm'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-lg text-xs font-bold text-white hover:shadow-lg hover:shadow-[#546A7A]/20 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg transition-all"
          >
            Next
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#96AEC2]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            title="Last page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 relative p-4 sm:p-0">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#546A7A]/10 to-[#6F8A9D]/10 rounded-full blur-[8rem] opacity-60" />
        <div className="absolute -bottom-40 -left-20 w-[25rem] h-[25rem] bg-gradient-to-br from-[#E17F70]/10 to-[#9E3B47]/10 rounded-full blur-[6rem] opacity-50" />
      </div>

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] shadow-[#546A7A]/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#546A7A]">AR Invoices</h1>
            <p className="text-xs text-[#92A2A5]">{total} total invoices</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            href="/finance/ar/import"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#546A7A] text-sm font-bold hover:border-[#6F8A9D] hover:bg-[#96AEC2]/5 transition-all min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </Link>
          <Link 
            href="/finance/ar/invoices/new"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white text-sm font-bold shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:shadow-[#E17F70]/30 hover:-translate-y-0.5 active:scale-95 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Invoice</span>
          </Link>
        </div>
      </div>

      {/* Aging Bucket Active Filter */}
      {agingBucket && (
        <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#546A7A]/10 to-[#6F8A9D]/5 rounded-xl border-2 border-[#546A7A]/30 p-3 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-[#546A7A]">Aging Filter:</span>
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white text-xs font-bold shadow-lg shadow-[#546A7A]/20">{agingBucketLabels[agingBucket] || agingBucket}</span>
          </div>
          <Link href="/finance/ar/invoices" className="ml-auto text-xs font-bold text-[#E17F70] hover:text-[#9E3B47] transition-colors px-2 py-1 rounded-lg hover:bg-[#E17F70]/10">✕ Clear Filter</Link>
        </div>
      )}

      {/* Filters */}
      <div className="relative flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-3 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
        <div className="w-full sm:flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-11 sm:h-10 pl-10 pr-10 rounded-xl bg-gradient-to-r from-[#AEBFC3]/5 to-[#92A2A5]/5 border-2 border-[#AEBFC3]/30 text-sm focus:border-[#6F8A9D] focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/10 transition-all font-medium"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[#AEBFC3]/20 text-[#92A2A5] transition-colors"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <button 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all whitespace-nowrap ${
                  activeFilterCount > 0 
                  ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-transparent shadow-lg shadow-[#CE9F6B]/20' 
                  : 'bg-white text-[#546A7A] border-[#AEBFC3]/30 hover:border-[#6F8A9D] hover:bg-[#96AEC2]/5'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#976E44] text-[10px] font-black">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md bg-white border-l-4 border-[#546A7A]">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
              <SheetHeader className="pb-6 border-b border-[#AEBFC3]/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] shadow-lg shadow-[#546A7A]/20">
                    <Filter className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <SheetTitle className="text-xl font-bold text-[#546A7A]">Advanced Filters</SheetTitle>
                    <SheetDescription className="text-xs font-semibold text-[#92A2A5]">Refine your invoice search results</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              
              <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] pr-2 scrollbar-thin">
                {/* Customer */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Customer
                  </Label>
                  <SearchableSelect 
                    options={customers}
                    value={customerId}
                    onValueChange={(val) => { setCustomerId(val); setPage(1); }}
                    placeholder="Search by customer name or code..."
                    className="border-2 border-[#AEBFC3]/30 focus:border-[#6F8A9D] rounded-xl h-11"
                  />
                </div>

                {/* Date Range */}
                <div className="space-y-2 flex flex-col">
                  <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Invoice Date Range
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[#92A2A5] ml-1">FROM</span>
                      <Input 
                        type="date"
                        value={fromDate ? new Date(fromDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => { setFromDate(e.target.value ? new Date(e.target.value).toISOString() : ''); setPage(1); }}
                        className="h-11 border-2 border-[#AEBFC3]/30 rounded-xl focus:ring-[#6F8A9D]/20 text-[#546A7A] font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[#92A2A5] ml-1">TO</span>
                      <Input 
                        type="date"
                        value={toDate ? new Date(toDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => { setToDate(e.target.value ? new Date(e.target.value).toISOString() : ''); setPage(1); }}
                        className="h-11 border-2 border-[#AEBFC3]/30 rounded-xl focus:ring-[#6F8A9D]/20 text-[#546A7A] font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Category & Region */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" /> Category
                    </Label>
                    <Select value={category} onValueChange={(val) => { setCategory(val); setPage(1); }}>
                      <SelectTrigger className="border-2 border-[#AEBFC3]/30 rounded-xl h-11 focus:ring-[#6F8A9D]/20">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL_CATEGORIES">All Categories</SelectItem>
                        <SelectItem value="LCS">LCS</SelectItem>
                        <SelectItem value="NB">NB</SelectItem>
                        <SelectItem value="FINANCE">Finance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" /> Region
                    </Label>
                    <Select value={region} onValueChange={(val) => { setRegion(val); setPage(1); }}>
                      <SelectTrigger className="border-2 border-[#AEBFC3]/30 rounded-xl h-11 focus:ring-[#6F8A9D]/20">
                        <SelectValue placeholder="All Regions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL_REGIONS">All Regions</SelectItem>
                        <SelectItem value="GLOBAL">Global</SelectItem>
                        <SelectItem value="NORTH">North</SelectItem>
                        <SelectItem value="SOUTH">South</SelectItem>
                        <SelectItem value="EAST">East</SelectItem>
                        <SelectItem value="WEST">West</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Amount Range */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                    <IndianRupee className="w-3.5 h-3.5" /> Total Amount Range
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#92A2A5]">MIN</span>
                      <Input 
                        type="number" 
                        placeholder="0"
                        value={minAmount}
                        onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
                        className="h-11 pl-10 border-2 border-[#AEBFC3]/30 rounded-xl focus:ring-[#6F8A9D]/20 text-sm font-bold"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#92A2A5]">MAX</span>
                      <Input 
                        type="number" 
                        placeholder="∞"
                        value={maxAmount}
                        onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }}
                        className="h-11 pl-10 border-2 border-[#AEBFC3]/30 rounded-xl focus:ring-[#6F8A9D]/20 text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Risk and Accounting Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Risk Class
                    </Label>
                    <Select value={riskClass} onValueChange={(val) => { setRiskClass(val); setPage(1); }}>
                      <SelectTrigger className="border-2 border-[#AEBFC3]/30 rounded-xl h-11 focus:ring-[#6F8A9D]/20">
                        <SelectValue placeholder="All Risk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL_RISK">All Risk</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" /> Accounting
                    </Label>
                    <Select value={accountingStatus} onValueChange={(val) => { setAccountingStatus(val); setPage(1); }}>
                      <SelectTrigger className="border-2 border-[#AEBFC3]/30 rounded-xl h-11 focus:ring-[#6F8A9D]/20">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL_STATUS">All Status</SelectItem>
                        <SelectItem value="REVENUE_RECOGNISED">Revenue Recognised</SelectItem>
                        <SelectItem value="BACKLOG">Backlog</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* TSP Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5" /> TSP (Service Provider)
                  </Label>
                  <Select value={tsp} onValueChange={(val) => { setTsp(val === 'ALL_TSPS' ? '' : val); setPage(1); }}>
                    <SelectTrigger className="border-2 border-[#AEBFC3]/30 rounded-xl h-11 focus:ring-[#CE9F6B]/20 font-bold text-[#546A7A]">
                      <SelectValue placeholder="All TSPs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_TSPS">All TSPs</SelectItem>
                      {TSP_OPTIONS.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#F8FAFB] to-white border-t border-[#AEBFC3]/20 flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={clearAllFilters}
                  className="flex-1 rounded-xl border-2 border-[#AEBFC3]/40 h-12 font-bold text-[#546A7A] hover:bg-[#AEBFC3]/10"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Reset All
                </Button>
                <Button 
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/30 h-12 font-bold hover:shadow-xl transition-all"
                >
                  Apply Filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <div className="w-[2px] h-6 bg-[#AEBFC3]/20 mx-1 hidden sm:block" />

          {statusFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = status === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => { setStatus(filter.value); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  isActive ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/20' : 'text-[#5D6E73] hover:bg-[#546A7A]/10 border-2 border-transparent hover:border-[#AEBFC3]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {filter.label}
              </button>
            );
          })}
          
          {(search || status || activeFilterCount > 0) && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#E17F70] hover:bg-[#E17F70]/10 border border-[#E17F70]/30 transition-all ml-2 whitespace-nowrap"
              title="Clear all filters"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table - Clean Kardex Design */}
      <div className="relative hidden md:block bg-white rounded-2xl border-2 border-[#6F8A9D]/30 overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
        <div className="px-5 py-4 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A]">
          <div className="flex items-center justify-between font-bold text-white text-xs uppercase tracking-wide">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/15 border border-white/20">
                <FileText className="w-4 h-4" />
              </div>
              <span>Invoice Records Table</span>
            </div>
            <div className="px-3 py-1 rounded-lg bg-white/15 text-[10px] font-bold">
              {invoices.length} entries shown
            </div>
          </div>
        </div>

        {/* Top Pagination */}
        {renderPagination(true)}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 border-b-2 border-[#546A7A]/30 bg-gradient-to-r from-[#546A7A]/10 to-[#546A7A]/5 text-xs font-bold uppercase text-[#546A7A]">Invoice</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#6F8A9D]/30 bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/5 text-xs font-bold uppercase text-[#6F8A9D]">Customer</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#976E44]/30 bg-gradient-to-r from-[#976E44]/10 to-[#976E44]/5 text-xs font-bold uppercase text-[#976E44]">Type</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#82A094]/30 bg-gradient-to-r from-[#82A094]/10 to-[#82A094]/5 text-xs font-bold uppercase text-[#4F6A64]">Date</th>
                <th className="text-left py-3 px-4 border-b-2 border-[#E17F70]/30 bg-gradient-to-r from-[#E17F70]/10 to-[#E17F70]/5 text-xs font-bold uppercase text-[#E17F70]">Due Date</th>
                <th className="text-right py-3 px-4 border-b-2 border-[#4F6A64]/30 bg-gradient-to-r from-[#4F6A64]/10 to-[#4F6A64]/5 text-xs font-bold uppercase text-[#4F6A64]">Total</th>
                <th className="text-right py-3 px-4 border-b-2 border-[#96AEC2]/30 bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/5 text-xs font-bold uppercase text-[#6F8A9D]">Received</th>
                <th className="text-right py-3 px-4 border-b-2 border-[#9E3B47]/30 bg-gradient-to-r from-[#9E3B47]/10 to-[#9E3B47]/5 text-xs font-bold uppercase text-[#9E3B47]">Balance</th>
                <th className="text-center py-3 px-4 border-b-2 border-[#5D6E73]/30 bg-gradient-to-r from-[#5D6E73]/10 to-[#5D6E73]/5 text-xs font-bold uppercase text-[#5D6E73]">Risk</th>
                <th className="text-center py-3 px-4 border-b-2 border-[#75242D]/30 bg-gradient-to-r from-[#75242D]/10 to-[#75242D]/5 text-xs font-bold uppercase text-[#5D6E73]">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-[#AEBFC3]/15">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/10 rounded-lg" /></td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                   <td colSpan={10} className="py-16 text-center">
                     <div className="flex flex-col items-center gap-3">
                       <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5] flex items-center justify-center shadow-lg">
                         <FileText className="w-8 h-8 text-white" />
                       </div>
                       <span className="text-[#5D6E73] font-bold">No invoices found</span>
                     </div>
                   </td>
                </tr>
              ) : (
                invoices.map((invoice, index) => (
                  <tr 
                    key={invoice.id}
                    onClick={() => router.push(`/finance/ar/invoices/${encodeURIComponent(invoice.invoiceNumber)}`)}
                    className={`cursor-pointer border-b border-[#AEBFC3]/15 transition-all hover:bg-[#546A7A]/5 hover:shadow-md ${
                      index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'
                    } ${invoice.status === 'OVERDUE' ? 'border-l-4 border-l-[#E17F70]' : 'border-l-4 border-l-transparent'}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#546A7A]">{invoice.invoiceNumber}</div>
                      {invoice.poNo && <div className="text-[10px] text-white bg-gradient-to-r from-[#976E44] to-[#CE9F6B] px-1.5 py-0.5 rounded inline-block mt-0.5 font-bold">PO: {invoice.poNo}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-semibold truncate max-w-[150px]">{invoice.customerName}</div>
                      <div className="text-[10px] text-[#92A2A5]">{invoice.bpCode}</div>
                    </td>
                    <td className="py-3 px-4"><span className="text-[10px] font-bold px-2 py-1 bg-gradient-to-r from-[#82A094]/20 to-[#4F6A64]/20 text-[#4F6A64] rounded-lg border border-[#82A094]/30">{invoice.type || '-'}</span></td>
                    <td className="py-3 px-4 text-sm text-[#546A7A]">{formatARDate(invoice.invoiceDate)}</td>
                    <td className="py-3 px-4">
                      <div className={`text-sm ${invoice.status === 'OVERDUE' ? 'text-[#E17F70] font-bold' : 'text-[#546A7A]'}`}>
                        {formatARDate(invoice.dueDate)}
                      </div>
                      {(invoice.dueByDays ?? 0) !== 0 && invoice.status !== 'PAID' && (
                        <div className={`text-[9px] font-bold mt-1 ${(invoice.dueByDays ?? 0) > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
                          {(invoice.dueByDays ?? 0) > 0 ? `+${invoice.dueByDays}d overdue` : `${Math.abs(invoice.dueByDays ?? 0)}d left`}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#4F6A64]">{formatARCurrency(Number(invoice.totalAmount) || 0)}</td>
                    <td className="py-3 px-4 text-right text-[#6F8A9D] font-medium">{formatARCurrency(Number(invoice.totalReceipts) || 0)}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#E17F70]">{formatARCurrency(Number(invoice.balance) || 0)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${getRiskStyle(invoice.riskClass || 'LOW')}`}>
                        {invoice.riskClass || 'LOW'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${getStatusStyle(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        {renderPagination()}
      </div>

      {/* Mobile view focused on REGULAR */}
      <div className="md:hidden space-y-3">
          {invoices.map(invoice => (
            <Link key={invoice.id} href={`/finance/ar/invoices/${encodeURIComponent(invoice.invoiceNumber)}`} className="relative block bg-white p-4 rounded-2xl border-2 border-[#AEBFC3]/30 shadow-lg transition-all active:scale-95 overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
               <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-[#546A7A]">{invoice.invoiceNumber}</div>
                    <div className="text-[10px] text-[#92A2A5]">{invoice.bpCode}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${getStatusStyle(invoice.status)}`}>{invoice.status}</span>
               </div>
               <div className="text-sm text-[#546A7A] mb-1 font-bold truncate">{invoice.customerName}</div>
               <div className="flex justify-between items-end mt-4 pt-3 border-t-2 border-[#AEBFC3]/20">
                  <div className="text-[10px] text-[#92A2A5] font-bold uppercase">Balance</div>
                  <div className="text-lg font-bold text-[#E17F70]">{formatARCurrency(Number(invoice.balance))}</div>
               </div>
            </Link>
          ))}

          {/* Mobile Pagination */}
          {!loading && totalPages > 1 && (
            <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 p-4 shadow-lg overflow-hidden mt-4">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-[#92A2A5] uppercase tracking-wide">Page {page} of {totalPages}</span>
                <span className="text-[10px] font-bold text-[#976E44]">{total} records</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] disabled:opacity-30 transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {getPageNumbers().map((p, i) =>
                  p === '...' ? (
                    <span key={`m-ellipsis-${i}`} className="w-7 text-center text-xs font-bold text-[#92A2A5]">…</span>
                  ) : (
                    <button
                      key={`m-${p}`}
                      onClick={() => setPage(p as number)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                        page === p
                          ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/25 scale-110'
                          : 'bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] active:scale-95'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white disabled:opacity-30 transition-all shadow-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
