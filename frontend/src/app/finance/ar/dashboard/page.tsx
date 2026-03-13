'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { arApi, formatARCurrency } from '@/lib/ar-api';
import { 
  TrendingUp, IndianRupee, AlertTriangle, Clock, 
  CheckCircle2, RefreshCw, ArrowUpRight, XCircle, Minus
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DashboardData {
  kpis: {
    totalAmount: number;
    totalAllInvoices: number;
    totalCollected: number;
    totalPayments: number;
    totalBalance: number;
    totalInvoices: number;
    overdueAmount: number;
    pendingCount: number;
    collectionsMTD: number;
    paymentsCount: number;
  };
  statusCounts: {
    pending: number;
    partial: number;
    paid: number;
    overdue: number;
    total: number;
  };
  performance: {
    collectionRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
    overdueRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
    onTimeRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
    currentRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
  };
  aging: {
    current: { count: number; amount: number };
    days1to30: { count: number; amount: number };
    days31to60: { count: number; amount: number };
    days61to90: { count: number; amount: number };
    over90: { count: number; amount: number };
  };
  milestoneKpis: {
    totalValue: number;
    totalCollected: number;
    totalOutstanding: number;
    overdueAmount: number;
    overdueTermsCount: number;
    totalMilestones: number;
    statusCounts: {
      pending: number;
      partial: number;
      paid: number;
      overdue: number;
      total: number;
    };
    aging: {
      current: { count: number; amount: number };
      days1to30: { count: number; amount: number };
      days31to60: { count: number; amount: number };
      days61to90: { count: number; amount: number };
      over90: { count: number; amount: number };
    };
    stages: {
      advance: { pending: number; overdue: number; paid: number };
      dispatch: { pending: number; overdue: number; paid: number };
      installation: { pending: number; overdue: number; paid: number };
      others: { pending: number; overdue: number; paid: number };
    };
    performance: {
      collectionRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
      overdueRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
      onTimeRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
      currentRate: { value: number; status: 'GOOD' | 'AVERAGE' | 'BAD'; label: string };
    };
  };
  criticalOverdue: { invoiceNumber: string; customerName: string; balance: number; daysOverdue: number }[];
  criticalMilestones: {
    id: string;
    soNo: string;
    poNo: string;
    customerName: string;
    bpCode: string;
    totalAmount: number;
    totalReceipts: number;
    balance: number;
    overdueTerms: number;
    worstAging: number;
    milestoneStatus: string;
    status: string;
  }[];
  recentInvoices: { id: string; invoiceNumber: string; customerName: string; totalAmount: number; balance: number; status: string; invoiceDate: string; dueDate: string }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ARDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await arApi.getEssentialDashboard();
      setData(result);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadDashboard(); };

  const getStatusIcon = (status: 'GOOD' | 'AVERAGE' | 'BAD') => {
    if (status === 'GOOD') return <CheckCircle2 className="w-5 h-5 text-[#82A094]" />;
    if (status === 'AVERAGE') return <Minus className="w-5 h-5 text-[#CE9F6B]" />;
    return <XCircle className="w-5 h-5 text-[#E17F70]" />;
  };

  const getStatusColor = (status: 'GOOD' | 'AVERAGE' | 'BAD') => {
    if (status === 'GOOD') return 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/30';
    if (status === 'AVERAGE') return 'bg-[#CE9F6B]/15 text-[#976E44] border-[#CE9F6B]/30';
    return 'bg-[#E17F70]/15 text-[#9E3B47] border-[#E17F70]/30';
  };

  const getAgingTotal = () => {
    if (!data?.aging) return 0;
    return (data.aging.current?.amount || 0) + (data.aging.days1to30?.amount || 0) + (data.aging.days31to60?.amount || 0) + (data.aging.days61to90?.amount || 0) + (data.aging.over90?.amount || 0);
  };

  const getMilestoneAgingTotal = () => {
    if (!data?.milestoneKpis?.aging) return 0;
    const a = data.milestoneKpis.aging;
    return (a.current?.amount || 0) + (a.days1to30?.amount || 0) + (a.days31to60?.amount || 0) + (a.days61to90?.amount || 0) + (a.over90?.amount || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse">
              <div className="h-4 bg-[#AEBFC3]/20 rounded w-24 mb-3" />
              <div className="h-8 bg-[#AEBFC3]/30 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-10 h-10 text-[#E17F70] mb-4" />
        <p className="text-[#546A7A] mb-4">{error}</p>
        <button onClick={handleRefresh} className="px-4 py-2 rounded-lg bg-[#546A7A] text-white">
          <RefreshCw className="w-4 h-4 inline mr-2" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-bold text-[#546A7A]">AR Dashboard</h1>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border text-[#546A7A] text-sm hover:border-[#6F8A9D] disabled:opacity-50 min-h-[44px]">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* ROW 1: 6 Essential KPIs - Enhanced Cards */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-xs font-bold text-[#546A7A] uppercase tracking-widest">Invoice</h2>
        <div className="h-px flex-1 bg-[#AEBFC3]/30" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Invoiced */}
        <div className="bg-gradient-to-br from-[#5D6E73] to-[#3D4E53] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Invoice Total</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.totalAmount || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">{data?.kpis?.totalAllInvoices || 0} Invoices</div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Invoice Collected</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.totalCollected || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">{data?.kpis?.totalPayments || 0} Payments</div>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Invoice Outstanding</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.totalBalance || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">Balance Receivable</div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-gradient-to-br from-[#E17F70] to-[#9E3B47] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Invoice Overdue</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.overdueAmount || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">{data?.statusCounts?.overdue || 0} Past Due</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* ROW 1.5: Milestone Summary */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-xs font-bold text-[#546A7A] uppercase tracking-widest">Milestone Payment</h2>
        <div className="h-px flex-1 bg-[#AEBFC3]/30" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Milestone Total */}
        <div className="bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Milestone Total</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.milestoneKpis?.totalValue || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">{data?.milestoneKpis?.totalMilestones || 0} Milestones tracked</div>
          </div>
        </div>

        {/* Milestone Collected */}
        <div className="bg-gradient-to-br from-[#A2B9AF] to-[#82A094] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Milestone Collected</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.milestoneKpis?.totalCollected || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">
              {((data?.milestoneKpis?.totalCollected || 0) / (data?.milestoneKpis?.totalValue || 1) * 100).toFixed(1)}% Collection Rate
            </div>
          </div>
        </div>

        {/* Milestone Outstanding */}
        <div className="bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Milestone Outstanding</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.milestoneKpis?.totalOutstanding || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">Balance Receivable</div>
          </div>
        </div>

        {/* Milestone Overdue */}
        <div className="bg-gradient-to-br from-[#9E3B47] to-[#75242D] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1 uppercase tracking-wider">Milestone Overdue</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.milestoneKpis?.overdueAmount || 0)}</div>
            <div className="text-[10px] text-white/60 font-bold uppercase">{data?.milestoneKpis?.overdueTermsCount || 0} stages past due</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* ROW 2: Status Counts + Aging Summary (Enhanced) */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Status - Premium Design */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#546A7A] text-lg">Invoice Status</h3>
              <p className="text-xs text-[#5D6E73] mt-1">Distribution by payment status</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#5D6E73]">Total Invoices</div>
              <div className="text-lg font-bold text-[#546A7A]">{data?.statusCounts?.total || 0}</div>
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Pending', desc: 'Awaiting payment', value: data?.statusCounts?.pending || 0, color: 'from-[#CE9F6B] to-[#976E44]', bgColor: 'bg-[#CE9F6B]', icon: '⏳' },
              { label: 'Partial', desc: 'Partially received', value: data?.statusCounts?.partial || 0, color: 'from-[#6F8A9D] to-[#546A7A]', bgColor: 'bg-[#6F8A9D]', icon: '◐' },
              { label: 'Paid', desc: 'Fully cleared', value: data?.statusCounts?.paid || 0, color: 'from-[#82A094] to-[#4F6A64]', bgColor: 'bg-[#82A094]', icon: '✓' },
              { label: 'Overdue', desc: 'Past due date', value: data?.statusCounts?.overdue || 0, color: 'from-[#E17F70] to-[#9E3B47]', bgColor: 'bg-[#E17F70]', icon: '⚠' },
            ].map(item => {
              const total = data?.statusCounts?.total || 1;
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.label} className="group hover:bg-[#F8FAFB] rounded-xl p-2 -mx-2 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-lg shadow-md group-hover:scale-110 transition-transform`}>
                      {item.icon}
                    </div>
                    <div className="w-24">
                      <div className="text-sm font-semibold text-[#546A7A]">{item.label}</div>
                      <div className="text-xs text-[#5D6E73]">{item.desc}</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 bg-[#F0F4F5] rounded-lg overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${item.color} rounded-lg flex items-center justify-end pr-2 transition-all duration-500`}
                          style={{ width: `${Math.max(pct, 0)}%`, minWidth: pct > 0 ? '35px' : '0' }}
                        >
                          {pct >= 10 && <span className="text-xs text-white font-medium">{pct.toFixed(0)}%</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right w-16">
                      <div className="text-xl font-bold text-[#546A7A]">{item.value}</div>
                      <div className="text-xs text-[#5D6E73]">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoice Aging Summary */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#546A7A] text-lg">Invoice Aging Summary</h3>
              <p className="text-xs text-[#5D6E73] mt-1">Outstanding balance by days overdue</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#5D6E73]">Total Outstanding</div>
              <div className="text-lg font-bold text-[#546A7A]">{formatARCurrency(getAgingTotal())}</div>
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Current', desc: 'Not yet due', key: 'current', agingParam: 'current', color: 'from-[#82A094] to-[#4F6A64]', bgColor: 'bg-[#82A094]' },
              { label: '1-30 Days', desc: 'Slightly overdue', key: 'days1to30', agingParam: '1-30', color: 'from-[#6F8A9D] to-[#546A7A]', bgColor: 'bg-[#6F8A9D]' },
              { label: '31-60 Days', desc: 'Follow up needed', key: 'days31to60', agingParam: '31-60', color: 'from-[#CE9F6B] to-[#976E44]', bgColor: 'bg-[#CE9F6B]' },
              { label: '61-90 Days', desc: 'High risk', key: 'days61to90', agingParam: '61-90', color: 'from-[#E17F70] to-[#CE9F6B]', bgColor: 'bg-[#E17F70]' },
              { label: '90+ Days', desc: 'Critical - escalate', key: 'over90', agingParam: '90%2B', color: 'from-[#9E3B47] to-[#75242D]', bgColor: 'bg-[#9E3B47]' },
            ].map(item => {
              const bucket = data?.aging?.[item.key as keyof typeof data.aging];
              const total = getAgingTotal();
              const pct = total > 0 ? ((bucket?.amount || 0) / total) * 100 : 0;
              const count = bucket?.count || 0;
              const amount = bucket?.amount || 0;
              return (
                <Link key={item.key} href={`/finance/ar/invoices?agingBucket=${item.agingParam}`} className="block group hover:bg-[#F8FAFB] rounded-xl p-2 -mx-2 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.bgColor} flex-shrink-0`} />
                    <div className="w-24">
                      <div className="text-sm font-semibold text-[#546A7A]">{item.label}</div>
                      <div className="text-xs text-[#5D6E73] opacity-75">{item.desc}</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 bg-[#F0F4F5] rounded-lg overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${item.color} rounded-lg flex items-center justify-end pr-2 transition-all duration-500`} 
                          style={{ width: `${Math.max(pct, 0)}%`, minWidth: pct > 0 ? '40px' : '0' }}
                        >
                          {pct >= 15 && <span className="text-xs text-white font-medium">{pct.toFixed(0)}%</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right w-28">
                      <div className="text-sm font-bold text-[#546A7A]">{formatARCurrency(amount)}</div>
                      <div className="text-xs text-[#5D6E73]">{count} invoice{count !== 1 ? 's' : ''}</div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#AEBFC3] group-hover:text-[#546A7A] transition-colors flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-[#AEBFC3]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#5D6E73]">
            <span>🟢 Current = On Track</span>
            <span>🟡 1-60 Days = Monitor</span>
            <span>🔴 60+ Days = Action Required</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* ROW 3: Milestone Status + Stages Breakdown */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestone Project Status */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#546A7A] text-lg">Milestone Status</h3>
              <p className="text-xs text-[#5D6E73] mt-1">Milestone distribution by health</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#5D6E73]">Total Milestones</div>
              <div className="text-lg font-bold text-[#546A7A]">{data?.milestoneKpis?.statusCounts?.total || 0}</div>
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Pending', desc: 'No terms overdue', value: data?.milestoneKpis?.statusCounts?.pending || 0, color: 'from-[#CE9F6B] to-[#976E44]', bgColor: 'bg-[#CE9F6B]', icon: '📋' },
              { label: 'Partial', desc: 'Some terms paid', value: data?.milestoneKpis?.statusCounts?.partial || 0, color: 'from-[#6F8A9D] to-[#546A7A]', bgColor: 'bg-[#6F8A9D]', icon: '🛠' },
              { label: 'Paid', desc: 'All terms cleared', value: data?.milestoneKpis?.statusCounts?.paid || 0, color: 'from-[#82A094] to-[#4F6A64]', bgColor: 'bg-[#82A094]', icon: '✅' },
              { label: 'Overdue', desc: 'One or more stages late', value: data?.milestoneKpis?.statusCounts?.overdue || 0, color: 'from-[#9E3B47] to-[#75242D]', bgColor: 'bg-[#9E3B47]', icon: '🚨' },
            ].map(item => {
              const total = data?.milestoneKpis?.statusCounts?.total || 1;
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.label} className="group hover:bg-[#F8FAFB] rounded-xl p-2 -mx-2 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-lg shadow-md group-hover:scale-110 transition-transform`}>
                      {item.icon}
                    </div>
                    <div className="w-24">
                      <div className="text-sm font-semibold text-[#546A7A]">{item.label}</div>
                      <div className="text-xs text-[#5D6E73]">{item.desc}</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 bg-[#F0F4F5] rounded-lg overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${item.color} rounded-lg flex items-center justify-end pr-2 transition-all duration-500`}
                          style={{ width: `${Math.max(pct, 0)}%`, minWidth: pct > 0 ? '35px' : '0' }}
                        >
                          {pct >= 10 && <span className="text-xs text-white font-medium">{pct.toFixed(0)}%</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right w-16">
                      <div className="text-xl font-bold text-[#546A7A]">{item.value}</div>
                      <div className="text-xs text-[#5D6E73]">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestone Aging Summary - Matching Invoice Aging Styling */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#546A7A] text-lg">Milestone Aging Summary</h3>
              <p className="text-xs text-[#5D6E73] mt-1">Outstanding milestone balance by days overdue</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#5D6E73]">Total Milestone Outstanding</div>
              <div className="text-lg font-bold text-[#546A7A]">{formatARCurrency(getMilestoneAgingTotal())}</div>
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Current', desc: 'Not yet due', key: 'current', agingParam: 'current', color: 'from-[#82A094] to-[#4F6A64]', bgColor: 'bg-[#82A094]' },
              { label: '1-30 Days', desc: 'Slightly overdue', key: 'days1to30', agingParam: '1-30', color: 'from-[#CE9F6B] to-[#976E44]', bgColor: 'bg-[#CE9F6B]' },
              { label: '31-60 Days', desc: 'Attention needed', key: 'days31to60', agingParam: '31-60', color: 'from-[#976E44] to-[#CE9F6B]', bgColor: 'bg-[#976E44]' },
              { label: '61-90 Days', desc: 'High risk', key: 'days61to90', agingParam: '61-90', color: 'from-[#E17F70] to-[#9E3B47]', bgColor: 'bg-[#E17F70]' },
              { label: '90+ Days', desc: 'Critical action', key: 'over90', agingParam: '90%2B', color: 'from-[#9E3B47] to-[#75242D]', bgColor: 'bg-[#9E3B47]' },
            ].map(item => {
              const aging = data?.milestoneKpis?.aging;
              const bucket = aging ? (aging as any)[item.key] : null;
              const total = getMilestoneAgingTotal();
              const pct = total > 0 ? ((bucket?.amount || 0) / total) * 100 : 0;
              const count = bucket?.count || 0;
              const amount = bucket?.amount || 0;
              return (
                <Link key={item.key} href={`/finance/ar/milestones?agingBucket=${item.agingParam}`} className="block group hover:bg-[#F8FAFB] rounded-xl p-2 -mx-2 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.bgColor} flex-shrink-0`} />
                    <div className="w-24">
                      <div className="text-sm font-semibold text-[#546A7A]">{item.label}</div>
                      <div className="text-xs text-[#5D6E73] opacity-75">{item.desc}</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 bg-[#F0F4F5] rounded-lg overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${item.color} rounded-lg flex items-center justify-end pr-2 transition-all duration-500`} 
                          style={{ width: `${Math.max(pct, 0)}%`, minWidth: pct > 0 ? '40px' : '0' }}
                        >
                          {pct >= 15 && <span className="text-xs text-white font-medium">{pct.toFixed(0)}%</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right w-28">
                      <div className="text-sm font-bold text-[#546A7A]">{formatARCurrency(amount)}</div>
                      <div className="text-xs text-[#5D6E73]">{count} milestone{count !== 1 ? 's' : ''}</div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#AEBFC3] group-hover:text-[#546A7A] transition-colors flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-[#AEBFC3]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#5D6E73]">
            <span>🟢 Current = On Track</span>
            <span>🟡 1-60 Days = Monitor</span>
            <span>🔴 60+ Days = Action Required</span>
          </div>
        </div>
      </div>



      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* ROW 3: Performance Indicators (Enhanced with Circular Gauges) */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-[#546A7A] text-lg">Invoice Performance Indicators</h3>
            <p className="text-xs text-[#5D6E73] mt-1">Key AR health metrics at a glance</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {data?.performance && Object.entries(data.performance).map(([key, perf]) => {
            const isGood = perf.status === 'GOOD';
            const isAverage = perf.status === 'AVERAGE';
            const isBad = perf.status === 'BAD';
            
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const progress = (perf.value / 100) * circumference;
            
            const ringColor = isGood ? '#82A094' : isAverage ? '#CE9F6B' : '#E17F70';
            const bgColor = isGood ? 'bg-[#82A094]/10' : isAverage ? 'bg-[#CE9F6B]/10' : 'bg-[#E17F70]/10';
            const textColor = isGood ? 'text-[#4F6A64]' : isAverage ? 'text-[#976E44]' : 'text-[#9E3B47]';
            const statusBg = isGood ? 'bg-[#82A094]' : isAverage ? 'bg-[#CE9F6B]' : 'bg-[#E17F70]';
            
            const descriptions: Record<string, string> = {
              collectionRate: 'Amount collected vs invoiced',
              overdueRate: 'Invoices past due date',
              onTimeRate: 'Invoices within terms',
              currentRate: 'Balance not yet due'
            };
            
            return (
              <div key={key} className={`${bgColor} rounded-2xl p-5 text-center group hover:scale-[1.02] transition-transform`}>
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
                    <circle 
                      cx="50" cy="50" r={radius} fill="none" 
                      stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - progress}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${textColor}`}>{perf.value}%</span>
                  </div>
                </div>
                
                <div className={`text-sm font-bold ${textColor} mb-1`}>{perf.label}</div>
                <div className="text-xs text-[#5D6E73] mb-3">{descriptions[key] || ''}</div>
                
                <div className={`inline-flex items-center gap-1.5 ${statusBg} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                  {isGood && <CheckCircle2 className="w-3 h-3" />}
                  {isAverage && <Minus className="w-3 h-3" />}
                  {isBad && <XCircle className="w-3 h-3" />}
                  {perf.status}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestone Performance Indicators */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-[#546A7A] text-lg">Milestone Performance Indicators</h3>
            <p className="text-xs text-[#5D6E73] mt-1">Key milestone health metrics at a glance</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {data?.milestoneKpis?.performance && Object.entries(data.milestoneKpis.performance).map(([key, perf]) => {
            const isGood = perf.status === 'GOOD';
            const isAverage = perf.status === 'AVERAGE';
            const isBad = perf.status === 'BAD';
            
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const progress = (perf.value / 100) * circumference;
            
            const ringColor = isGood ? '#82A094' : isAverage ? '#CE9F6B' : '#E17F70';
            const bgColor = isGood ? 'bg-[#82A094]/10' : isAverage ? 'bg-[#CE9F6B]/10' : 'bg-[#E17F70]/10';
            const textColor = isGood ? 'text-[#4F6A64]' : isAverage ? 'text-[#976E44]' : 'text-[#9E3B47]';
            const statusBg = isGood ? 'bg-[#82A094]' : isAverage ? 'bg-[#CE9F6B]' : 'bg-[#E17F70]';
            
            const descriptions: Record<string, string> = {
              collectionRate: 'Milestone value collected vs total',
              overdueRate: 'Milestones with overdue stages',
              onTimeRate: 'Milestones with all stages on time',
              currentRate: 'Milestone balance not yet overdue'
            };
            
            return (
              <div key={key} className={`${bgColor} rounded-2xl p-5 text-center group hover:scale-[1.02] transition-transform`}>
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
                    <circle 
                      cx="50" cy="50" r={radius} fill="none" 
                      stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - progress}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${textColor}`}>{perf.value}%</span>
                  </div>
                </div>
                
                <div className={`text-sm font-bold ${textColor} mb-1`}>{perf.label}</div>
                <div className="text-xs text-[#5D6E73] mb-3">{descriptions[key] || ''}</div>
                
                <div className={`inline-flex items-center gap-1.5 ${statusBg} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                  {isGood && <CheckCircle2 className="w-3 h-3" />}
                  {isAverage && <Minus className="w-3 h-3" />}
                  {isBad && <XCircle className="w-3 h-3" />}
                  {perf.status}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
