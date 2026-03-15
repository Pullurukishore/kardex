'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARCustomer, ARInvoice, formatARCurrency, formatARDate } from '@/lib/ar-api';
import { 
  ArrowLeft, Pencil, Building2, User, Mail, Phone, MapPin, Shield, 
  Sparkles, AlertTriangle, FileText, TrendingUp, Wallet, Receipt,
  Calendar, ChevronRight, Clock, CheckCircle2, XCircle, Trash, AlertCircle,
  IndianRupee, CreditCard, UserCheck, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function ViewCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<(ARCustomer & { invoices?: ARInvoice[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadCustomer();
  }, [params.id]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await arApi.getCustomerById(params.id as string);
      setCustomer(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to delete customer "${customer.customerName}"? This action cannot be undone.`);
    
    if (confirmDelete) {
      try {
        setDeleteLoading(true);
        await arApi.deleteCustomer(customer.id);
        router.push('/finance/ar/customers');
      } catch (err: any) {
        console.error('Failed to delete customer:', err);
        const errorMessage = err.response?.data?.error || err.message || 'Failed to delete customer';
        alert(errorMessage);
      } finally {
        setDeleteLoading(false);
      }
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'bg-gradient-to-r from-[#A2B9AF] to-[#82A094] text-white shadow-lg shadow-[#82A094]/20';
      case 'MEDIUM': return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/20';
      case 'HIGH': return 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-lg shadow-[#E17F70]/20';
      case 'CRITICAL': return 'bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white shadow-lg shadow-[#9E3B47]/20 animate-pulse';
      default: return 'bg-[#AEBFC3]/20 text-[#5D6E73] border border-[#AEBFC3]/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10 text-[#4F6A64] border border-[#82A094]/30';
      case 'PARTIAL': return 'bg-gradient-to-r from-[#CE9F6B]/15 to-[#976E44]/10 text-[#976E44] border border-[#CE9F6B]/30';
      case 'OVERDUE': return 'bg-gradient-to-r from-[#E17F70]/15 to-[#9E3B47]/10 text-[#9E3B47] border border-[#E17F70]/30';
      case 'CANCELLED': return 'bg-[#AEBFC3]/15 text-[#5D6E73] border border-[#AEBFC3]/30';
      default: return 'bg-gradient-to-r from-[#96AEC2]/15 to-[#6F8A9D]/10 text-[#546A7A] border border-[#96AEC2]/30';
    }
  };

  // Calculate financial stats
  const calculateStats = () => {
    if (!customer) return { total: 0, outstanding: 0, paid: 0, overdueCount: 0, creditLimit: 0, utilization: 0, totalInvoices: 0 };
    
    // Use backend-calculated totals if available, otherwise fallback to frontend calculation
    const activeInvoices = (customer.invoices || []).filter(inv => inv.status !== 'CANCELLED');
    
    const total = customer.totalInvoiceAmount !== undefined ? customer.totalInvoiceAmount : 
                 activeInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
                 
    const outstanding = customer.outstandingBalance !== undefined ? customer.outstandingBalance : 
                       activeInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
                       
    const paid = total - outstanding;
    
    const overdueCount = customer.overdueCount !== undefined ? customer.overdueCount : 
                        activeInvoices.filter(inv => inv.status === 'OVERDUE').length;
                        
    const totalInvoices = customer.invoiceCount !== undefined ? customer.invoiceCount : 
                         activeInvoices.length;

    const creditLimit = (customer.creditLimit !== null && customer.creditLimit !== undefined) ? customer.creditLimit : undefined;
    const utilization = creditLimit !== undefined ? (creditLimit > 0 ? (outstanding / creditLimit) * 100 : (outstanding > 0 ? 100 : 0)) : 0;
    
    return { total, outstanding, paid, overdueCount, creditLimit, utilization, totalInvoices };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-[#96AEC2]/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-[#6F8A9D] animate-spin"></div>
          </div>
          <span className="text-[#92A2A5] text-sm font-medium">Loading customer details...</span>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/finance/ar/customers"
            className="p-2.5 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] hover:bg-[#96AEC2]/10 hover:border-[#96AEC2]/50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[#546A7A]">Customer Not Found</h1>
        </div>
        <div className="p-6 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border border-[#E17F70]/30 rounded-xl text-[#9E3B47]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error || 'The requested customer could not be found.'}
          </div>
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="space-y-5 w-full relative overflow-hidden p-4 sm:p-0">
      {/* Decorative Background */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-[#96AEC2]/8 to-[#6F8A9D]/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -left-32 w-80 h-80 bg-gradient-to-tr from-[#A2B9AF]/8 to-[#82A094]/8 rounded-full blur-3xl pointer-events-none" />
      
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] p-5 sm:p-6 shadow-2xl shadow-[#546A7A]/20">
        {/* Animated Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 hidden sm:block">
          <div className="absolute top-4 right-16 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-12 right-40 w-56 h-56 border-4 border-white/30 rounded-full" />
          <div className="absolute top-12 left-1/4 w-20 h-20 border-2 border-white/40 rounded-full" />
        </div>
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer-slide_4s_ease-in-out_infinite]" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link 
              href="/finance/ar/customers"
              className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-all border border-white/20 shadow-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-start gap-4">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-xl border border-white/20">
                <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#82A094] rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  {customer.customerName}
                </h1>
                <p className="text-white/70 font-mono text-sm mt-0.5">{customer.bpCode}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${getRiskBadge(customer.riskClass)}`}>
                    {customer.riskClass === 'CRITICAL' && <AlertTriangle className="w-3 h-3 animate-pulse" />}
                    {customer.riskClass} RISK
                  </span>
                  {customer.region && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/15 backdrop-blur-sm text-white border border-white/20">
                      <MapPin className="w-3 h-3" />
                      {customer.region}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href={`/finance/ar/customers/${customer.id}/edit`}
              className="group flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white text-[#546A7A] font-bold hover:shadow-2xl hover:shadow-white/40 hover:-translate-y-0.5 transition-all"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Edit Customer</span>
              <span className="sm:hidden">Edit</span>
            </Link>
            
            {currentUser?.financeRole === 'FINANCE_ADMIN' && (
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="group flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white font-bold hover:shadow-2xl hover:shadow-[#E17F70]/30 hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {deleteLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="relative group bg-white rounded-2xl border-2 border-[#82A094]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#82A094] hover:scale-[1.02] transition-all overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/30">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-[#82A094] uppercase tracking-wide">Total Invoiced</p>
              <p className="text-lg sm:text-xl font-bold text-[#4F6A64] truncate">{formatARCurrency(stats.total)}</p>
              <p className="text-[10px] text-[#92A2A5] font-medium">{stats.totalInvoices} invoices</p>
            </div>
          </div>
        </div>

        <div className="relative group bg-white rounded-2xl border-2 border-[#E17F70]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#E17F70] hover:scale-[1.02] transition-all overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] shadow-lg shadow-[#E17F70]/30">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-[#E17F70] uppercase tracking-wide">Balance Due</p>
              <p className={`text-lg sm:text-xl font-bold truncate ${stats.outstanding > 0 ? 'text-[#9E3B47]' : 'text-[#82A094]'}`}>
                {formatARCurrency(stats.outstanding)}
              </p>
              <p className="text-[10px] text-[#92A2A5] font-medium">{stats.overdueCount} overdue</p>
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
              <p className="text-[10px] sm:text-xs font-bold text-[#CE9F6B] uppercase tracking-wide">Credit Limit</p>
              <p className="text-lg sm:text-xl font-bold text-[#976E44] truncate">
                {stats.creditLimit !== undefined ? formatARCurrency(stats.creditLimit) : 'N/A'}
              </p>
              {stats.creditLimit !== undefined ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 max-w-[60px] h-1.5 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        stats.utilization > 90 ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]' 
                        : stats.utilization > 70 ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]' 
                        : 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]'
                      }`}
                      style={{ width: `${Math.min(100, stats.utilization)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#976E44]">{Math.round(stats.utilization)}%</span>
                </div>
              ) : <p className="text-[10px] text-[#AEBFC3] font-medium">No limit</p>}
            </div>
          </div>
        </div>

        <div className="relative group bg-white rounded-2xl border-2 border-[#A2B9AF]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#A2B9AF] hover:scale-[1.02] transition-all overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#A2B9AF] to-[#82A094]" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#A2B9AF] to-[#4F6A64] shadow-lg shadow-[#A2B9AF]/30">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-[#4F6A64] uppercase tracking-wide">Collected</p>
              <p className="text-lg sm:text-xl font-bold text-[#4F6A64] truncate">{formatARCurrency(stats.paid)}</p>
              <p className="text-[10px] text-[#92A2A5] font-medium">
                {stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="relative group bg-white rounded-2xl border-2 border-[#96AEC2]/30 p-4 shadow-lg hover:shadow-xl hover:border-[#96AEC2] hover:scale-[1.02] transition-all overflow-hidden col-span-2 lg:col-span-1">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#546A7A] via-[#96AEC2] to-[#6F8A9D]" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#96AEC2] to-[#546A7A] shadow-lg shadow-[#96AEC2]/30">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-[#546A7A] uppercase tracking-wide">Total Invoices</p>
              <p className="text-lg sm:text-xl font-bold text-[#546A7A]">{stats.totalInvoices}</p>
              <p className="text-[10px] text-[#92A2A5] font-medium">Active records</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact Information Card */}
          <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 overflow-hidden shadow-lg hover:shadow-xl hover:border-[#82A094] transition-all group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
            <div className="px-5 py-4 border-b-2 border-[#82A094]/20 bg-gradient-to-r from-[#82A094]/10 via-[#A2B9AF]/5 to-transparent">
              <h3 className="text-lg font-bold text-[#4F6A64] flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/30">
                  <User className="w-5 h-5 text-white" />
                </div>
                Contact Information
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="group hover:bg-[#82A094]/5 p-3 rounded-xl transition-all">
                  <label className="text-[#82A094] text-xs uppercase tracking-wider font-bold mb-2 block">POC Name (Client Rep)</label>
                  <p className="text-[#4F6A64] font-bold text-lg">{customer.pocName || <span className="text-[#AEBFC3] font-normal">Not specified</span>}</p>
                </div>
                <div className="group hover:bg-[#82A094]/5 p-3 rounded-xl transition-all">
                  <label className="text-[#82A094] text-xs uppercase tracking-wider font-bold mb-2 block">Person In Charge (Internal)</label>
                  <p className="text-[#4F6A64] font-bold text-lg">{customer.personInCharge || <span className="text-[#AEBFC3] font-normal">Not specified</span>}</p>
                </div>
                <div className="group hover:bg-[#82A094]/5 p-3 rounded-xl transition-all">
                  <label className="flex items-center gap-2 text-[#82A094] text-xs uppercase tracking-wider font-bold mb-2">
                    <Phone className="w-4 h-4" />
                    Contact Number
                  </label>
                  {customer.contactNo ? (
                    <a href={`tel:${customer.contactNo}`} className="text-[#82A094] font-bold text-lg hover:text-[#4F6A64] hover:underline transition-colors">
                      {customer.contactNo}
                    </a>
                  ) : (
                    <p className="text-[#AEBFC3] font-normal text-lg">Not specified</p>
                  )}
                </div>
                <div className="group hover:bg-[#82A094]/5 p-3 rounded-xl transition-all">
                  <label className="flex items-center gap-2 text-[#82A094] text-xs uppercase tracking-wider font-bold mb-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  {customer.emailId ? (
                    <a href={`mailto:${customer.emailId}`} className="text-[#82A094] font-bold text-lg hover:text-[#4F6A64] hover:underline break-all transition-colors">
                      {customer.emailId}
                    </a>
                  ) : (
                    <p className="text-[#AEBFC3] font-normal text-lg">Not specified</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="relative bg-white rounded-2xl border-2 border-[#CE9F6B]/30 overflow-hidden shadow-lg hover:shadow-xl hover:border-[#CE9F6B] transition-all group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#EEC1BF]" />
            <div className="px-5 py-4 border-b-2 border-[#CE9F6B]/20 bg-gradient-to-r from-[#CE9F6B]/10 via-[#976E44]/5 to-transparent flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#976E44] flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/30">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                Invoices
                <span className="px-3 py-1 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white text-xs font-bold rounded-full shadow-lg shadow-[#CE9F6B]/20">
                  {customer.invoices?.length || 0}
                </span>
              </h3>
              <Link 
                href={`/finance/ar/invoices?customerId=${customer.id}`}
                className="text-sm text-[#CE9F6B] hover:text-[#976E44] font-bold flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-[#CE9F6B]/10 transition-all border border-[#CE9F6B]/30 hover:border-[#CE9F6B]"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-[#AEBFC3]/15">
              {customer.invoices && customer.invoices.length > 0 ? (
                customer.invoices.slice(0, 10).map((invoice: ARInvoice) => (
                  <Link
                    key={invoice.id}
                    href={`/finance/ar/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-[#CE9F6B]/10 hover:to-transparent transition-all group/item"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg shadow-[#CE9F6B]/20 group-hover/item:scale-110 transition-transform">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-[#546A7A] font-bold text-lg group-hover/item:text-[#976E44] group-hover/item:underline decoration-[#CE9F6B] underline-offset-2">{invoice.invoiceNumber}</p>
                        <div className="flex items-center gap-2 text-xs text-[#92A2A5] mt-1 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatARDate(invoice.invoiceDate)}
                          {invoice.dueDate && (
                            <>
                              <span className="text-[#AEBFC3]">•</span>
                              <Clock className="w-3.5 h-3.5" />
                              Due: {formatARDate(invoice.dueDate)}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[#546A7A] font-bold text-lg">{formatARCurrency(invoice.totalAmount)}</p>
                        {invoice.balance && invoice.balance > 0 && (
                          <p className="text-xs text-[#E17F70] font-bold">Balance: {formatARCurrency(invoice.balance)}</p>
                        )}
                      </div>
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusBadge(invoice.status)}`}>
                        {invoice.status}
                      </span>
                      <ChevronRight className="w-5 h-5 text-[#AEBFC3] group-hover/item:text-[#CE9F6B] transition-colors" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#CE9F6B]/20">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-[#546A7A] font-bold text-lg">No invoices found</p>
                  <p className="text-[#92A2A5] text-sm mt-1 font-medium">This customer doesn't have any invoices yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Company Details */}
          <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 overflow-hidden shadow-lg hover:shadow-xl hover:border-[#6F8A9D] transition-all group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
            <div className="px-5 py-4 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#6F8A9D]/10 via-[#96AEC2]/5 to-transparent">
              <h3 className="text-lg font-bold text-[#546A7A] flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/30">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                Company Details
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="hover:bg-[#6F8A9D]/5 p-3 rounded-xl transition-all">
                <label className="text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2 block">BP Code</label>
                <p className="text-[#6F8A9D] font-bold font-mono text-xl bg-gradient-to-r from-[#96AEC2]/20 to-[#6F8A9D]/10 px-4 py-2 rounded-xl inline-block border-2 border-[#6F8A9D]/30 shadow-sm">
                  {customer.bpCode}
                </p>
              </div>
              <div className="hover:bg-[#6F8A9D]/5 p-3 rounded-xl transition-all">
                <label className="flex items-center gap-2 text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2">
                  <MapPin className="w-4 h-4" />
                  Region
                </label>
                <p className="text-[#546A7A] font-bold text-lg">{customer.region || <span className="text-[#AEBFC3] font-normal">Not specified</span>}</p>
              </div>
              <div className="hover:bg-[#6F8A9D]/5 p-3 rounded-xl transition-all">
                <label className="text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2 block">Department</label>
                <p className="text-[#546A7A] font-bold text-lg">{customer.department || <span className="text-[#AEBFC3] font-normal">Not specified</span>}</p>
              </div>
              <div className="hover:bg-[#6F8A9D]/5 p-3 rounded-xl transition-all">
                <label className="text-[#6F8A9D] text-xs uppercase tracking-wider font-bold mb-2 block">Credit Limit</label>
                <p className="text-[#546A7A] font-bold text-lg">{customer.creditLimit ? formatARCurrency(customer.creditLimit) : <span className="text-[#AEBFC3] font-normal">Not specified</span>}</p>
              </div>
            </div>
          </div>

          {/* Risk Classification */}
          <div className="relative bg-white rounded-2xl border-2 border-[#CE9F6B]/30 overflow-hidden shadow-lg hover:shadow-xl hover:border-[#CE9F6B] transition-all group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#EEC1BF]" />
            <div className="px-5 py-4 border-b-2 border-[#CE9F6B]/20 bg-gradient-to-r from-[#CE9F6B]/10 via-[#976E44]/5 to-transparent">
              <h3 className="text-lg font-bold text-[#976E44] flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/30">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                Risk Classification
              </h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-center">
                <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold ${getRiskBadge(customer.riskClass)}`}>
                  {customer.riskClass === 'CRITICAL' && <AlertTriangle className="w-5 h-5 animate-pulse" />}
                  {customer.riskClass} RISK
                </span>
              </div>
              <p className="text-[#92A2A5] text-sm mt-5 leading-relaxed text-center font-medium bg-[#AEBFC3]/5 p-4 rounded-xl">
                {customer.riskClass === 'LOW' && 'This customer has a good payment history and reliable credit standing.'}
                {customer.riskClass === 'MEDIUM' && 'This customer has occasional payment delays. Monitor closely.'}
                {customer.riskClass === 'HIGH' && 'This customer has frequent payment issues. Consider credit review.'}
                {customer.riskClass === 'CRITICAL' && 'This customer requires immediate attention for collections. Escalate as needed.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
