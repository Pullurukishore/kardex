'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, ARCustomer, ARInvoice, formatARCurrency, formatARDate } from '@/lib/ar-api';
import { 
  ArrowLeft, Pencil, Building2, User, Mail, Phone, MapPin, Shield, 
  Sparkles, AlertTriangle, FileText, TrendingUp, Wallet, Receipt,
  Calendar, ChevronRight, Clock, CheckCircle2, XCircle
} from 'lucide-react';

export default function ViewCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<(ARCustomer & { invoices?: ARInvoice[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomer();
  }, [params.id]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const data = await arApi.getCustomerById(params.id as string);
      setCustomer(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/30';
      case 'MEDIUM': return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/30';
      case 'HIGH': return 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white shadow-lg shadow-[#E17F70]/30';
      case 'CRITICAL': return 'bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white shadow-lg shadow-[#9E3B47]/30';
      default: return 'bg-[#AEBFC3]/15 text-[#5D6E73] border border-[#AEBFC3]/40';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/30';
      case 'PARTIAL': return 'bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30';
      case 'OVERDUE': return 'bg-[#E17F70]/15 text-[#9E3B47] border border-[#E17F70]/30';
      default: return 'bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30';
    }
  };

  // Calculate financial stats
  const calculateStats = () => {
    if (!customer?.invoices) return { total: 0, outstanding: 0, paid: 0, overdueCount: 0 };
    const total = customer.invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const outstanding = customer.invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    const paid = total - outstanding;
    const overdueCount = customer.invoices.filter(inv => inv.status === 'OVERDUE').length;
    return { total, outstanding, paid, overdueCount };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-[#82A094]/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-[#82A094] animate-spin"></div>
          </div>
          <span className="text-[#92A2A5] text-sm font-medium">Loading customer details...</span>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/finance/ar/customers"
            className="p-2.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] hover:bg-[#6F8A9D]/10 hover:border-[#6F8A9D]/40 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[#546A7A]">Customer Not Found</h1>
        </div>
        <div className="p-6 bg-[#E17F70]/10 border-2 border-[#E17F70]/30 rounded-xl text-[#9E3B47]">
          {error || 'The requested customer could not be found.'}
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="space-y-6 w-full relative">
      {/* Decorative Background */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF] p-6 shadow-xl">
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 right-32 w-48 h-48 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link 
              href="/finance/ar/customers"
              className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  {customer.customerName}
                  <Sparkles className="w-5 h-5 text-white/70" />
                </h1>
                <p className="text-white/70 font-mono text-sm mt-1">{customer.bpCode}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${getRiskBadge(customer.riskClass)}`}>
                    {customer.riskClass === 'CRITICAL' && <AlertTriangle className="w-3 h-3" />}
                    {customer.riskClass} RISK
                  </span>
                  {customer.region && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                      <MapPin className="w-3 h-3" />
                      {customer.region}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Link
            href={`/finance/ar/customers/${customer.id}/edit`}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#4F6A64] font-bold hover:shadow-2xl hover:shadow-white/30 hover:-translate-y-0.5 transition-all"
          >
            <Pencil className="w-4 h-4" />
            Edit Customer
          </Link>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#82A094]/20 p-5 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#92A2A5] text-sm font-medium">Total Invoiced</span>
            <div className="p-2 rounded-xl bg-[#82A094]/10">
              <TrendingUp className="w-5 h-5 text-[#82A094]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#546A7A]">{formatARCurrency(stats.total)}</p>
          <p className="text-xs text-[#92A2A5] mt-1">{customer.invoices?.length || 0} invoices</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E17F70]/20 p-5 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#92A2A5] text-sm font-medium">Balance Due</span>
            <div className="p-2 rounded-xl bg-[#E17F70]/10">
              <Wallet className="w-5 h-5 text-[#E17F70]" />
            </div>
          </div>
          <p className={`text-2xl font-bold ${stats.outstanding > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
            {formatARCurrency(stats.outstanding)}
          </p>
          <p className="text-xs text-[#92A2A5] mt-1">{stats.overdueCount} overdue invoices</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#82A094]/20 p-5 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#92A2A5] text-sm font-medium">Collected</span>
            <div className="p-2 rounded-xl bg-[#82A094]/10">
              <CheckCircle2 className="w-5 h-5 text-[#82A094]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#82A094]">{formatARCurrency(stats.paid)}</p>
          <p className="text-xs text-[#92A2A5] mt-1">
            {stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}% collected
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#CE9F6B]/20 p-5 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#92A2A5] text-sm font-medium">Invoices</span>
            <div className="p-2 rounded-xl bg-[#CE9F6B]/10">
              <Receipt className="w-5 h-5 text-[#CE9F6B]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#546A7A]">{customer.invoices?.length || 0}</p>
          <p className="text-xs text-[#92A2A5] mt-1">Total invoices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information Card */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#82A094]/20 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#82A094]/5 to-transparent">
              <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2">
                <User className="w-5 h-5 text-[#82A094]" />
                Contact Information
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group">
                  <label className="text-[#92A2A5] text-xs uppercase tracking-wider font-medium mb-2 block">Person In Charge</label>
                  <p className="text-[#546A7A] font-semibold text-lg">{customer.personInCharge || <span className="text-[#AEBFC3]">Not specified</span>}</p>
                </div>
                <div className="group">
                  <label className="flex items-center gap-1.5 text-[#92A2A5] text-xs uppercase tracking-wider font-medium mb-2">
                    <Phone className="w-3.5 h-3.5" />
                    Contact Number
                  </label>
                  {customer.contactNo ? (
                    <a href={`tel:${customer.contactNo}`} className="text-[#82A094] font-semibold text-lg hover:underline">
                      {customer.contactNo}
                    </a>
                  ) : (
                    <p className="text-[#AEBFC3] font-semibold text-lg">Not specified</p>
                  )}
                </div>
                <div className="group">
                  <label className="flex items-center gap-1.5 text-[#92A2A5] text-xs uppercase tracking-wider font-medium mb-2">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </label>
                  {customer.emailId ? (
                    <a href={`mailto:${customer.emailId}`} className="text-[#82A094] font-semibold text-lg hover:underline break-all">
                      {customer.emailId}
                    </a>
                  ) : (
                    <p className="text-[#AEBFC3] font-semibold text-lg">Not specified</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#CE9F6B]/5 to-transparent flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#CE9F6B]" />
                Invoices
              </h3>
              <Link 
                href={`/finance/ar/invoices?customerId=${customer.id}`}
                className="text-sm text-[#CE9F6B] hover:text-[#976E44] font-medium flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-[#AEBFC3]/10">
              {customer.invoices && customer.invoices.length > 0 ? (
                customer.invoices.slice(0, 10).map((invoice: ARInvoice) => (
                  <Link
                    key={invoice.id}
                    href={`/finance/ar/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-[#CE9F6B]/5 hover:to-transparent transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#CE9F6B]/10 flex items-center justify-center group-hover:bg-[#CE9F6B]/20 transition-all">
                        <FileText className="w-5 h-5 text-[#CE9F6B]" />
                      </div>
                      <div>
                        <p className="text-[#546A7A] font-semibold group-hover:text-[#4F6A64]">{invoice.invoiceNumber}</p>
                        <div className="flex items-center gap-2 text-xs text-[#92A2A5] mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {formatARDate(invoice.invoiceDate)}
                          {invoice.dueDate && (
                            <>
                              <span className="text-[#AEBFC3]">•</span>
                              <Clock className="w-3 h-3" />
                              Due: {formatARDate(invoice.dueDate)}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[#546A7A] font-bold">{formatARCurrency(invoice.totalAmount)}</p>
                        {invoice.balance && invoice.balance > 0 && (
                          <p className="text-xs text-[#E17F70] font-medium">Balance: {formatARCurrency(invoice.balance)}</p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadge(invoice.status)}`}>
                        {invoice.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#AEBFC3] group-hover:text-[#CE9F6B] transition-colors" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#CE9F6B]/10 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#CE9F6B]" />
                  </div>
                  <p className="text-[#546A7A] font-medium">No invoices found</p>
                  <p className="text-[#92A2A5] text-sm mt-1">This customer doesn't have any invoices yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company Details */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#6F8A9D]/20 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#6F8A9D]/5 to-transparent">
              <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#6F8A9D]" />
                Company Details
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[#92A2A5] text-xs uppercase tracking-wider font-medium mb-2 block">BP Code</label>
                <p className="text-[#82A094] font-bold text-lg font-mono bg-[#82A094]/10 px-3 py-1.5 rounded-lg inline-block">
                  {customer.bpCode}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[#92A2A5] text-xs uppercase tracking-wider font-medium mb-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Region
                </label>
                <p className="text-[#546A7A] font-medium">{customer.region || <span className="text-[#AEBFC3]">Not specified</span>}</p>
              </div>
              <div>
                <label className="text-[#92A2A5] text-xs uppercase tracking-wider font-medium mb-2 block">Department</label>
                <p className="text-[#546A7A] font-medium">{customer.department || <span className="text-[#AEBFC3]">Not specified</span>}</p>
              </div>
              <div>
                <label className="text-[#92A2A5] text-xs uppercase tracking-wider font-medium mb-2 block">Credit Limit</label>
                <p className="text-[#546A7A] font-medium">{customer.creditLimit ? formatARCurrency(customer.creditLimit) : <span className="text-[#AEBFC3]">Not specified</span>}</p>
              </div>
            </div>
          </div>

          {/* Risk Classification */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#CE9F6B]/20 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#AEBFC3]/15 bg-gradient-to-r from-[#CE9F6B]/5 to-transparent">
              <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#CE9F6B]" />
                Risk Classification
              </h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${getRiskBadge(customer.riskClass)}`}>
                  {customer.riskClass === 'CRITICAL' && <AlertTriangle className="w-4 h-4" />}
                  {customer.riskClass} RISK
                </span>
              </div>
              <p className="text-[#92A2A5] text-sm mt-4">
                {customer.riskClass === 'LOW' && 'This customer has a good payment history.'}
                {customer.riskClass === 'MEDIUM' && 'This customer has occasional payment delays.'}
                {customer.riskClass === 'HIGH' && 'This customer has frequent payment issues.'}
                {customer.riskClass === 'CRITICAL' && 'This customer requires immediate attention for collections.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
