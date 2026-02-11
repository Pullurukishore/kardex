'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { arApi, ARInvoice, formatARCurrency, formatARDate } from '@/lib/ar-api';
import { Search, ChevronLeft, ChevronRight, FileText, Plus, TrendingUp, AlertTriangle, Clock, CheckCircle2, IndianRupee, Calendar, Building2, Upload, Shield, ArrowUpRight, Layers, Zap, Wallet, Package, Timer, Truck, PackageCheck, PackageX, BadgeCheck, Tag } from 'lucide-react';

export default function ARInvoicesPage() {
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [invoiceType, setInvoiceType] = useState(searchParams.get('type') || ''); // Read from URL
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Check if we're viewing prepaid invoices
  const isPrepaidView = invoiceType === 'PREPAID';

  // Update invoiceType when URL changes (sidebar navigation)
  useEffect(() => {
    const typeFromUrl = searchParams.get('type') || '';
    if (typeFromUrl !== invoiceType) {
      setInvoiceType(typeFromUrl);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    loadInvoices();
  }, [search, status, invoiceType, page]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const result = await arApi.getInvoices({ search, status, invoiceType, page, limit: 25 });
      setInvoices(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate prepaid stats
  const prepaidStats = useMemo(() => {
    if (!isPrepaidView) return null;
    
    const awaiting = invoices.filter(inv => inv.prepaidStatus === 'AWAITING_DELIVERY').length;
    const partial = invoices.filter(inv => inv.prepaidStatus === 'PARTIALLY_DELIVERED').length;
    const delivered = invoices.filter(inv => inv.prepaidStatus === 'FULLY_DELIVERED').length;
    const expired = invoices.filter(inv => inv.prepaidStatus === 'EXPIRED').length;
    
    // Count overdue deliveries (delivery due date passed but not fully delivered)
    const overdueDeliveries = invoices.filter(inv => {
      if (inv.prepaidStatus === 'FULLY_DELIVERED') return false;
      if (!inv.deliveryDueDate) return false;
      return new Date(inv.deliveryDueDate) < new Date();
    }).length;

    return { awaiting, partial, delivered, expired, overdueDeliveries };
  }, [invoices, isPrepaidView]);

  const statusFilters = [
    { value: '', label: 'All', icon: Layers },
    { value: 'PENDING', label: 'Pending', icon: Clock },
    { value: 'OVERDUE', label: 'Overdue', icon: AlertTriangle },
    { value: 'PAID', label: 'Paid', icon: CheckCircle2 },
    { value: 'PARTIAL', label: 'Partial', icon: TrendingUp },
  ];

  // Invoice type filters for prepaid support
  const typeFilters = [
    { value: '', label: 'All Types', color: 'from-[#546A7A] to-[#6F8A9D]' },
    { value: 'REGULAR', label: 'Regular', color: 'from-[#6F8A9D] to-[#82A094]' },
    { value: 'PREPAID', label: 'Prepaid', color: 'from-[#CE9F6B] to-[#E17F70]' },
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

  const getPrepaidStatusStyle = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return 'bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/40';
      case 'PARTIALLY_DELIVERED': return 'bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/40';
      case 'FULLY_DELIVERED': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/40';
      case 'EXPIRED': return 'bg-[#E17F70]/15 text-[#9E3B47] border border-[#E17F70]/40';
      case 'LINKED': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/40';
      default: return 'bg-[#AEBFC3]/15 text-[#5D6E73] border border-[#AEBFC3]/30';
    }
  };

  const getPrepaidStatusIcon = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return <Package className="w-3.5 h-3.5" />;
      case 'PARTIALLY_DELIVERED': return <Truck className="w-3.5 h-3.5" />;
      case 'FULLY_DELIVERED': return <PackageCheck className="w-3.5 h-3.5" />;
      case 'EXPIRED': return <PackageX className="w-3.5 h-3.5" />;
      case 'LINKED': return <BadgeCheck className="w-3.5 h-3.5" />;
      default: return <Package className="w-3.5 h-3.5" />;
    }
  };

  const getPrepaidStatusLabel = (status?: string) => {
    switch (status) {
      case 'AWAITING_DELIVERY': return 'Awaiting';
      case 'PARTIALLY_DELIVERED': return 'Partial';
      case 'FULLY_DELIVERED': return 'Delivered';
      case 'EXPIRED': return 'Expired';
      case 'LINKED': return 'Linked';
      default: return 'N/A';
    }
  };

  const getRiskStyle = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return 'bg-[#9E3B47] text-white font-bold';
      case 'HIGH': return 'bg-[#E17F70] text-white';
      case 'MEDIUM': return 'bg-[#CE9F6B] text-white';
      case 'LOW': return 'bg-[#82A094] text-white';
      default: return 'bg-[#AEBFC3] text-white';
    }
  };

  const getDeliveryStyle = (status: string) => {
    switch (status) {
      case 'ACKNOWLEDGED': return 'bg-[#4F6A64]/15 text-[#4F6A64] border border-[#4F6A64]/30';
      case 'DELIVERED': return 'bg-[#6F8A9D]/15 text-[#6F8A9D] border border-[#6F8A9D]/30';
      case 'SENT': return 'bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30';
      default: return 'bg-[#AEBFC3]/15 text-[#5D6E73] border border-[#AEBFC3]/30';
    }
  };

  const getPaymentModeStyle = (mode: string) => {
    switch (mode) {
      case 'TDS': return 'bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30';
      case 'LD': return 'bg-[#E17F70]/15 text-[#9E3B47] border border-[#E17F70]/30';
      case 'Receipt': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/30';
      default: return 'bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30'; // Style for 'Other'
    }
  };

  // Calculate days until/overdue delivery for prepaid invoices
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

  // Row highlight based on status - enhanced for prepaid
  const getRowStyle = (invoice: ARInvoice, index: number) => {
    const baseStyle = index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]';
    
    // For prepaid invoices, use delivery-based highlighting
    if (isPrepaidView && invoice.invoiceType === 'PREPAID') {
      if (invoice.prepaidStatus === 'EXPIRED') {
        return `${baseStyle} border-l-4 border-l-[#9E3B47] hover:bg-[#9E3B47]/5`;
      }
      if (invoice.prepaidStatus === 'FULLY_DELIVERED') {
        return `${baseStyle} border-l-4 border-l-[#82A094] hover:bg-[#82A094]/5`;
      }
      const deliveryDays = getDeliveryDueDays(invoice);
      if (deliveryDays !== null && deliveryDays < 0) {
        return `${baseStyle} border-l-4 border-l-[#E17F70] hover:bg-[#E17F70]/5`;
      }
      if (deliveryDays !== null && deliveryDays <= 3) {
        return `${baseStyle} border-l-4 border-l-[#CE9F6B] hover:bg-[#CE9F6B]/5`;
      }
      return `${baseStyle} border-l-4 border-l-[#CE9F6B]/50 hover:bg-[#CE9F6B]/5`;
    }
    
    // Regular invoice highlighting
    if (invoice.status === 'OVERDUE') {
      return `${baseStyle} border-l-4 border-l-[#E17F70] hover:bg-[#E17F70]/5`;
    }
    if (invoice.status === 'PAID') {
      return `${baseStyle} border-l-4 border-l-[#82A094] hover:bg-[#82A094]/5`;
    }
    if (invoice.status === 'PARTIAL') {
      return `${baseStyle} border-l-4 border-l-[#CE9F6B] hover:bg-[#CE9F6B]/5`;
    }
    return `${baseStyle} border-l-4 border-l-[#96AEC2] hover:bg-[#96AEC2]/10`;
  };

  return (
    <div className="space-y-4 sm:space-y-5 relative p-4 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shadow-lg ${isPrepaidView ? 'bg-gradient-to-br from-[#CE9F6B] to-[#E17F70] shadow-[#CE9F6B]/20' : 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] shadow-[#546A7A]/20'}`}>
            {isPrepaidView ? <Wallet className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white" />}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#546A7A]">
              {isPrepaidView ? 'Prepaid Invoices' : 'AR Invoices'}
            </h1>
            <p className="text-xs text-[#92A2A5]">{total} total invoices</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            href="/finance/ar/import"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-white border border-[#AEBFC3]/50 text-[#546A7A] text-sm font-medium hover:border-[#6F8A9D] hover:bg-[#96AEC2]/5 transition-all min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </Link>
          <Link 
            href="/finance/ar/invoices/new"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#E17F70]/25 hover:-translate-y-0.5 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Invoice</span>
          </Link>
        </div>
      </div>

      {/* Prepaid Stats Banner - Only shown when viewing prepaid invoices */}
      {isPrepaidView && prepaidStats && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] p-4 shadow-lg">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs font-medium">Awaiting Delivery</span>
              </div>
              <p className="text-2xl font-bold text-white">{prepaidStats.awaiting}</p>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] p-4 shadow-lg">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs font-medium">Overdue Delivery</span>
              </div>
              <p className="text-2xl font-bold text-white">{prepaidStats.overdueDeliveries}</p>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] p-4 shadow-lg">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs font-medium">Partial Delivery</span>
              </div>
              <p className="text-2xl font-bold text-white">{prepaidStats.partial}</p>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] p-4 shadow-lg">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <PackageCheck className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs font-medium">Fully Delivered</span>
              </div>
              <p className="text-2xl font-bold text-white">{prepaidStats.delivered}</p>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#92A2A5] to-[#5D6E73] p-4 shadow-lg">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <PackageX className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs font-medium">Expired</span>
              </div>
              <p className="text-2xl font-bold text-white">{prepaidStats.expired}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 bg-white rounded-xl border border-[#AEBFC3]/30 p-3">
        <div className="w-full sm:flex-1 sm:min-w-[200px] lg:min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-11 sm:h-10 pl-10 pr-4 rounded-lg bg-[#F8FAFB] border border-[#AEBFC3]/40 text-sm text-[#546A7A] placeholder:text-[#92A2A5] focus:border-[#6F8A9D] focus:outline-none focus:ring-2 focus:ring-[#96AEC2]/20 transition-all"
          />
        </div>
        
        {/* Invoice Type Filter - Prepaid/Regular */}
        <div className="flex items-center gap-1 bg-[#F8FAFB] rounded-lg p-1 border border-[#AEBFC3]/30">
          {typeFilters.map((filter) => {
            const isActive = invoiceType === filter.value;
            return (
              <button
                key={filter.value || 'all'}
                onClick={() => { setInvoiceType(filter.value); setPage(1); }}
                className={`px-3 py-2 sm:py-1.5 rounded-md text-xs font-semibold transition-all min-h-[36px] sm:min-h-0 ${
                  isActive
                    ? `bg-gradient-to-r ${filter.color} text-white shadow-sm`
                    : 'text-[#5D6E73] hover:bg-white'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Status Filters - Horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0">
          {statusFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = status === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => { setStatus(filter.value); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-md'
                    : 'text-[#5D6E73] hover:bg-[#546A7A]/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Table - Hidden on mobile - Clean Table Design */}
      <div className="hidden md:block bg-white rounded-xl border border-[#AEBFC3]/40 overflow-hidden shadow-lg">
        {/* Table Header Bar */}
        <div className={`px-5 py-3 border-b border-[#AEBFC3]/30 ${isPrepaidView ? 'bg-gradient-to-r from-[#CE9F6B] to-[#E17F70]' : 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isPrepaidView ? <Wallet className="w-5 h-5 text-white/90" /> : <FileText className="w-5 h-5 text-white/90" />}
              <h3 className="text-sm font-bold text-white">{isPrepaidView ? 'Prepaid Invoice Records' : 'Invoice Records'}</h3>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <span>Showing</span>
              <span className="px-2 py-0.5 rounded bg-white/20 font-bold text-white">{invoices.length}</span>
              <span>of {total} records</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Table Header - Clean traditional design with Kardex colors */}
            <thead>
              <tr className={`${isPrepaidView ? 'bg-[#CE9F6B]/10' : 'bg-[#546A7A]/5'}`}>
                {/* Invoice */}
                <th className="text-left py-3 px-4 border-b-2 border-[#546A7A] bg-[#546A7A]/10">
                  <div className="flex items-center gap-2 text-[#546A7A]">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Invoice</span>
                  </div>
                </th>
                {/* Customer */}
                <th className="text-left py-3 px-4 border-b-2 border-[#6F8A9D] bg-[#6F8A9D]/10">
                  <div className="flex items-center gap-2 text-[#6F8A9D]">
                    <Building2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Customer</span>
                  </div>
                </th>
                {/* Type */}
                <th className="text-left py-3 px-4 border-b-2 border-[#976E44] bg-[#976E44]/10">
                  <div className="flex items-center gap-2 text-[#976E44]">
                    <Tag className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Type</span>
                  </div>
                </th>
                {/* Date */}
                <th className="text-left py-3 px-4 border-b-2 border-[#82A094] bg-[#82A094]/10">
                  <div className="flex items-center gap-2 text-[#4F6A64]">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">{isPrepaidView ? 'Advance' : 'Invoice Date'}</span>
                  </div>
                </th>
                {/* Due Date */}
                <th className="text-left py-3 px-4 border-b-2 border-[#E17F70] bg-[#E17F70]/10 min-w-[140px]">
                  <div className="flex items-center gap-2 text-[#E17F70]">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">{isPrepaidView ? 'Delivery' : 'Due Date'}</span>
                  </div>
                </th>
                {/* Total */}
                <th className="text-right py-3 px-4 border-b-2 border-[#4F6A64] bg-[#4F6A64]/10 min-w-[120px]">
                  <div className="inline-flex items-center gap-2 text-[#4F6A64]">
                    <IndianRupee className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Total</span>
                  </div>
                </th>
                {/* Received */}
                <th className="text-right py-3 px-4 border-b-2 border-[#96AEC2] bg-[#96AEC2]/10 min-w-[110px]">
                  <div className="inline-flex items-center gap-2 text-[#6F8A9D]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Received</span>
                  </div>
                </th>
                {/* Balance */}
                <th className="text-right py-3 px-4 border-b-2 border-[#9E3B47] bg-[#9E3B47]/10 min-w-[110px]">
                  <div className="inline-flex items-center gap-2 text-[#9E3B47]">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Balance</span>
                  </div>
                </th>
                {/* Risk/Delivery */}
                <th className="text-center py-3 px-4 border-b-2 border-[#5D6E73] bg-[#5D6E73]/10">
                  <div className="inline-flex items-center gap-2 text-[#5D6E73]">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">{isPrepaidView ? 'Delivery' : 'Risk'}</span>
                  </div>
                </th>
                {/* Status */}
                <th className="text-center py-3 px-4 border-b-2 border-[#757777] bg-[#757777]/10">
                  <div className="inline-flex items-center gap-2 text-[#5D6E73]">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Status</span>
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Body - Traditional table design with visible grid lines */}
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]'} border-b border-[#AEBFC3]/30`}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="py-3.5 px-4 border-r border-[#AEBFC3]/15 last:border-r-0">
                        <div className="h-4 bg-[#AEBFC3]/15 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center bg-[#F8FAFB]">
                    <div className="flex flex-col items-center">
                      {isPrepaidView ? (
                        <>
                          <div className="w-16 h-16 rounded-xl bg-[#CE9F6B]/10 flex items-center justify-center mb-3 border border-[#CE9F6B]/20">
                            <Wallet className="w-8 h-8 text-[#CE9F6B]" />
                          </div>
                          <p className="text-base font-semibold text-[#546A7A] mb-1">No prepaid invoices found</p>
                          <p className="text-sm text-[#92A2A5]">Create a new prepaid invoice or adjust your filters</p>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-xl bg-[#546A7A]/10 flex items-center justify-center mb-3 border border-[#546A7A]/20">
                            <FileText className="w-8 h-8 text-[#6F8A9D]" />
                          </div>
                          <p className="text-base font-semibold text-[#546A7A] mb-1">No invoices found</p>
                          <p className="text-sm text-[#92A2A5]">Try adjusting your search or filters</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice, index) => {
                  const deliveryDays = getDeliveryDueDays(invoice);
                  const paymentHistory = invoice.paymentHistory || [];
                  const paymentCount = paymentHistory.length;
                  
                  // Categorize modes: TDS, LD, Receipt, or Other
                  const categorizedModes = Array.from(new Set(paymentHistory.map(p => {
                    const mode = p.paymentMode?.toUpperCase();
                    if (mode === 'TDS') return 'TDS';
                    if (mode === 'LD') return 'LD';
                    if (mode === 'RECEIPT') return 'Receipt';
                    return 'Other';
                  })));
                  
                  // Determine row background and left border based on status
                  const getRowClasses = () => {
                    const baseColor = index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]';
                    if (invoice.status === 'OVERDUE' || (deliveryDays !== null && deliveryDays < 0)) {
                      return `${baseColor} border-l-4 border-l-[#E17F70]`;
                    }
                    if (invoice.status === 'PAID' || invoice.prepaidStatus === 'FULLY_DELIVERED') {
                      return `${baseColor} border-l-4 border-l-[#82A094]`;
                    }
                    if (invoice.status === 'PARTIAL') {
                      return `${baseColor} border-l-4 border-l-[#CE9F6B]`;
                    }
                    return `${baseColor} border-l-4 border-l-[#96AEC2]`;
                  };
                  
                  return (
                    <tr 
                      key={invoice.id}
                      onClick={() => window.location.href = `/finance/ar/invoices/${encodeURIComponent(invoice.invoiceNumber)}`}
                      className={`group cursor-pointer border-b border-[#AEBFC3]/30 transition-colors hover:bg-[#546A7A]/5 ${getRowClasses()}`}
                    >
                      {/* Invoice */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link 
                              href={`/finance/ar/invoices/${encodeURIComponent(invoice.invoiceNumber)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#546A7A] font-bold hover:text-[#E17F70] hover:underline transition-colors"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                            {invoice.invoiceType === 'PREPAID' && (
                              <span className="text-[8px] font-bold text-white bg-[#CE9F6B] px-1.5 py-0.5 rounded uppercase">
                                PREPAID
                              </span>
                            )}
                          </div>
                          {invoice.poNo && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-[#976E44] bg-[#976E44]/10 px-1.5 py-0.5 rounded border border-[#976E44]/20">PO: {invoice.poNo}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15">
                        <div className="max-w-[160px]">
                          <p className="text-sm text-[#546A7A] font-semibold truncate" title={invoice.customerName}>
                            {invoice.customerName || '-'}
                          </p>
                          <span className="text-[10px] font-mono text-[#6F8A9D] bg-[#6F8A9D]/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                            {invoice.bpCode}
                          </span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                          invoice.type === 'NB' ? 'bg-[#976E44]/10 text-[#976E44]' : 
                          invoice.type === 'FINANCE' ? 'bg-[#CE9F6B]/10 text-[#976E44]' : 
                          'bg-[#82A094]/10 text-[#4F6A64]' // LCS
                        }`}>
                          {invoice.type || '-'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15">
                        <span className="text-sm text-[#546A7A]">
                          {isPrepaidView 
                            ? (invoice.advanceReceivedDate ? formatARDate(invoice.advanceReceivedDate) : '-')
                            : formatARDate(invoice.invoiceDate)
                          }
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm whitespace-nowrap ${
                            isPrepaidView 
                              ? (deliveryDays !== null && deliveryDays < 0 ? 'text-[#E17F70] font-bold' : 'text-[#546A7A]')
                              : ((invoice.dueByDays ?? 0) > 0 ? 'text-[#E17F70] font-bold' : 'text-[#546A7A]')
                          }`}>
                            {isPrepaidView 
                              ? (invoice.deliveryDueDate ? formatARDate(invoice.deliveryDueDate) : '-')
                              : formatARDate(invoice.dueDate)
                            }
                          </span>
                          {/* Days indicator */}
                          {isPrepaidView ? (
                            deliveryDays !== null && invoice.prepaidStatus !== 'FULLY_DELIVERED' && (
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded w-fit ${
                                deliveryDays < 0 ? 'text-white bg-[#E17F70]' : 'text-[#5D6E73] bg-[#AEBFC3]/30'
                              }`}>
                                {deliveryDays < 0 ? `${Math.abs(deliveryDays)}d overdue` : `${deliveryDays}d left`}
                              </span>
                            )
                          ) : (
                            (invoice.dueByDays ?? 0) !== 0 && invoice.status !== 'PAID' && (
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded w-fit ${
                                (invoice.dueByDays ?? 0) > 0 ? 'text-white bg-[#E17F70]' : 'text-white bg-[#82A094]'
                              }`}>
                                {(invoice.dueByDays ?? 0) > 0 ? `+${invoice.dueByDays}d` : `${invoice.dueByDays}d`}
                              </span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15 text-right">
                        <span className="font-bold text-[#4F6A64]">
                          {formatARCurrency(Number(invoice.totalAmount) || 0)}
                        </span>
                      </td>

                      {/* Received */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15 text-right">
                        <span className="text-[#6F8A9D] font-medium">
                          {formatARCurrency(Number(invoice.totalReceipts) || 0)}
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15 text-right">
                        <span className={`font-bold ${invoice.balance && Number(invoice.balance) > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
                          {formatARCurrency(Number(invoice.balance) || 0)}
                        </span>
                      </td>

                      {/* Risk/Delivery */}
                      <td className="py-3 px-4 border-r border-[#AEBFC3]/15 text-center">
                        {isPrepaidView ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${getPrepaidStatusStyle(invoice.prepaidStatus)}`}>
                            {getPrepaidStatusLabel(invoice.prepaidStatus)}
                          </span>
                        ) : (
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${getRiskStyle(invoice.riskClass)}`}>
                            {invoice.riskClass || 'N/A'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${getStatusStyle(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Premium Pagination */}
        {!loading && invoices.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#AEBFC3]/15 bg-gradient-to-r from-[#F8FAFB] via-white to-[#F8FAFB]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#82A094] to-[#A2B9AF]" />
              <span className="text-sm text-[#5D6E73]">
                Showing <span className="font-bold text-[#546A7A]">{Math.min((page - 1) * 25 + 1, total)}</span> to{' '}
                <span className="font-bold text-[#546A7A]">{Math.min(page * 25, total)}</span> of{' '}
                <span className="font-bold text-[#E17F70]">{total}</span> invoices
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#546A7A] hover:bg-gradient-to-r hover:from-[#546A7A]/5 hover:to-[#6F8A9D]/5 hover:border-[#6F8A9D]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1 bg-[#F8FAFB] rounded-xl p-1 border border-[#AEBFC3]/20">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                        page === pageNum
                          ? isPrepaidView 
                            ? 'bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white shadow-lg shadow-[#CE9F6B]/30'
                            : 'bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/30'
                          : 'text-[#5D6E73] hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#546A7A] hover:bg-gradient-to-r hover:from-[#546A7A]/5 hover:to-[#6F8A9D]/5 hover:border-[#6F8A9D]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View - Shown only on mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          // Loading skeleton cards
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#AEBFC3]/30 p-4 animate-pulse">
              <div className="h-4 bg-[#AEBFC3]/20 rounded w-24 mb-2" />
              <div className="h-3 bg-[#AEBFC3]/15 rounded w-40 mb-3" />
              <div className="h-6 bg-[#AEBFC3]/20 rounded w-28" />
            </div>
          ))
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#AEBFC3]/30 p-8 text-center">
            <FileText className="w-12 h-12 text-[#AEBFC3] mx-auto mb-3" />
            <p className="text-[#546A7A] font-medium">No invoices found</p>
            <p className="text-sm text-[#92A2A5]">Try adjusting your filters</p>
          </div>
        ) : (
          invoices.map((invoice) => {
            const deliveryDays = getDeliveryDueDays(invoice);
            return (
              <Link 
                key={invoice.id}
                href={`/finance/ar/invoices/${encodeURIComponent(invoice.invoiceNumber)}`}
                className={`block bg-white rounded-xl border shadow-sm p-4 active:scale-[0.98] transition-all ${
                  invoice.status === 'OVERDUE' 
                    ? 'border-l-4 border-l-[#E17F70] border-[#AEBFC3]/30' 
                    : invoice.status === 'PAID'
                    ? 'border-l-4 border-l-[#82A094] border-[#AEBFC3]/30'
                    : 'border-[#AEBFC3]/30'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#E17F70] font-bold">{invoice.invoiceNumber}</span>
                      {invoice.invoiceType === 'PREPAID' && (
                        <span className="text-[8px] font-bold text-white bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] px-1.5 py-0.5 rounded uppercase">
                          PREPAID
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#546A7A] font-medium truncate max-w-[200px]">{invoice.customerName}</p>
                    <p className="text-xs text-[#92A2A5]">{invoice.bpCode}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${getStatusStyle(invoice.status)}`}>
                    {getStatusIcon(invoice.status)}
                    {invoice.status}
                  </span>
                </div>
                
                {/* Amount Row */}
                <div className="flex flex-col gap-2 py-3 border-t border-b border-[#AEBFC3]/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#92A2A5] uppercase font-bold">Total Amount</p>
                      <p className="text-lg font-extrabold text-[#546A7A]">{formatARCurrency(Number(invoice.totalAmount) || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#4F6A64] uppercase font-bold">Amount Received</p>
                      <p className="text-base font-bold text-[#4F6A64]">{formatARCurrency(Number(invoice.totalReceipts) || 0)}</p>
                    </div>
                  </div>
                  
                  {Number(invoice.balance) > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-[#AEBFC3]/10">
                      <p className="text-[10px] text-[#E17F70] uppercase font-bold">Balance Amount</p>
                      <p className="text-base font-bold text-[#E17F70]">{formatARCurrency(Number(invoice.balance))}</p>
                    </div>
                  )}

                  {invoice.paymentHistory && invoice.paymentHistory.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <p className="text-[10px] text-[#92A2A5] uppercase font-bold">Payment Modes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(new Set(invoice.paymentHistory.map(p => {
                          const mode = p.paymentMode?.toUpperCase();
                          return (mode === 'TDS' || mode === 'LD') ? mode : 'Other';
                        }))).map(mode => (
                          <span key={mode} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPaymentModeStyle(mode)}`}>
                            {mode}
                          </span>
                        ))}
                        {invoice.paymentHistory.length > 1 && (
                          <span className="text-[10px] text-[#92A2A5] font-bold self-center ml-1">
                            ({invoice.paymentHistory.length} payments)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Footer Row */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${getRiskStyle(invoice.riskClass)}`}>
                      {invoice.riskClass || 'N/A'}
                    </span>
                    {(invoice.dueByDays ?? 0) !== 0 && invoice.status !== 'PAID' && invoice.prepaidStatus !== 'FULLY_DELIVERED' && (
                      <span className={`text-[10px] font-bold text-white px-2 py-1 rounded shadow-sm ${
                        (invoice.dueByDays ?? 0) > 0 ? 'bg-[#E17F70]' : 'bg-[#82A094]'
                      }`}>
                        {(invoice.dueByDays ?? 0) > 0 ? `+${invoice.dueByDays}d overdue` : `${invoice.dueByDays}d left`}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#5D6E73] font-semibold">Due Date: {formatARDate(invoice.dueDate)}</span>
                </div>
              </Link>
            );
          })
        )}
        
        {/* Mobile Pagination */}
        {!loading && invoices.length > 0 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-[#AEBFC3]/30 p-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-[#AEBFC3]/40 text-[#546A7A] disabled:opacity-40 min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm text-[#5D6E73] font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-[#AEBFC3]/40 text-[#546A7A] disabled:opacity-40 min-h-[44px]"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
