'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { arApi, formatARCurrency } from '@/lib/ar-api';
import { 
  TrendingUp, DollarSign, AlertTriangle, Clock, 
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
  criticalOverdue: { invoiceNumber: string; customerName: string; balance: number; daysOverdue: number }[];
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
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Invoiced */}
        <div className="bg-gradient-to-br from-[#5D6E73] to-[#3D4E53] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1">Total Invoiced</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.totalAmount || 0)}</div>
            <div className="text-xs text-white/60">{data?.kpis?.totalAllInvoices || 0} invoices</div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1">Collected</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.totalCollected || 0)}</div>
            <div className="text-xs text-white/60">{data?.kpis?.totalPayments || 0} payments</div>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1">Outstanding</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.totalBalance || 0)}</div>
            <div className="text-xs text-white/60">{data?.kpis?.totalInvoices || 0} unpaid</div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-gradient-to-br from-[#E17F70] to-[#9E3B47] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1">Overdue</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.overdueAmount || 0)}</div>
            <div className="text-xs text-white/60">{data?.statusCounts?.overdue || 0} past due</div>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1">Pending</div>
            <div className="text-xl font-bold mb-1">{data?.kpis?.pendingCount || 0}</div>
            <div className="text-xs text-white/60">awaiting payment</div>
          </div>
        </div>

        {/* Collections MTD */}
        <div className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="text-xs text-white/70 font-medium mb-1">Collections MTD</div>
            <div className="text-xl font-bold mb-1">{formatARCurrency(data?.kpis?.collectionsMTD || 0)}</div>
            <div className="text-xs text-white/60">{data?.kpis?.paymentsCount || 0} this month</div>
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
                    {/* Icon Badge */}
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-lg shadow-md group-hover:scale-110 transition-transform`}>
                      {item.icon}
                    </div>
                    
                    {/* Label & Description */}
                    <div className="w-24">
                      <div className="text-sm font-semibold text-[#546A7A]">{item.label}</div>
                      <div className="text-xs text-[#5D6E73]">{item.desc}</div>
                    </div>
                    
                    {/* Progress Bar */}
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
                    
                    {/* Count */}
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

        {/* Aging Summary - Enhanced with Details */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#546A7A] text-lg">Aging Summary</h3>
              <p className="text-xs text-[#5D6E73] mt-1">Outstanding balance by days overdue</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#5D6E73]">Total Outstanding</div>
              <div className="text-lg font-bold text-[#546A7A]">{formatARCurrency(getAgingTotal())}</div>
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Current', desc: 'Not yet due', key: 'current', color: 'from-[#82A094] to-[#4F6A64]', bgColor: 'bg-[#82A094]' },
              { label: '1-30 Days', desc: 'Slightly overdue', key: 'days1to30', color: 'from-[#6F8A9D] to-[#546A7A]', bgColor: 'bg-[#6F8A9D]' },
              { label: '31-60 Days', desc: 'Follow up needed', key: 'days31to60', color: 'from-[#CE9F6B] to-[#976E44]', bgColor: 'bg-[#CE9F6B]' },
              { label: '61-90 Days', desc: 'High risk', key: 'days61to90', color: 'from-[#E17F70] to-[#CE9F6B]', bgColor: 'bg-[#E17F70]' },
              { label: '90+ Days', desc: 'Critical - escalate', key: 'over90', color: 'from-[#9E3B47] to-[#75242D]', bgColor: 'bg-[#9E3B47]' },
            ].map(item => {
              const bucket = data?.aging?.[item.key as keyof typeof data.aging];
              const total = getAgingTotal();
              const pct = total > 0 ? ((bucket?.amount || 0) / total) * 100 : 0;
              const count = bucket?.count || 0;
              const amount = bucket?.amount || 0;
              return (
                <div key={item.key} className="group hover:bg-[#F8FAFB] rounded-xl p-2 -mx-2 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Status Dot */}
                    <div className={`w-3 h-3 rounded-full ${item.bgColor} flex-shrink-0`} />
                    
                    {/* Label & Description */}
                    <div className="w-24">
                      <div className="text-sm font-semibold text-[#546A7A]">{item.label}</div>
                      <div className="text-xs text-[#5D6E73] opacity-75">{item.desc}</div>
                    </div>
                    
                    {/* Progress Bar */}
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
                    
                    {/* Count & Amount */}
                    <div className="text-right w-28">
                      <div className="text-sm font-bold text-[#546A7A]">{formatARCurrency(amount)}</div>
                      <div className="text-xs text-[#5D6E73]">{count} invoice{count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Legend */}
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
            <h3 className="font-bold text-[#546A7A] text-lg">Performance Indicators</h3>
            <p className="text-xs text-[#5D6E73] mt-1">Key AR health metrics at a glance</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {data?.performance && Object.entries(data.performance).map(([key, perf]) => {
            const isGood = perf.status === 'GOOD';
            const isAverage = perf.status === 'AVERAGE';
            const isBad = perf.status === 'BAD';
            
            // Calculate circle progress
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const progress = (perf.value / 100) * circumference;
            
            // Colors based on status
            const ringColor = isGood ? '#82A094' : isAverage ? '#CE9F6B' : '#E17F70';
            const bgColor = isGood ? 'bg-[#82A094]/10' : isAverage ? 'bg-[#CE9F6B]/10' : 'bg-[#E17F70]/10';
            const textColor = isGood ? 'text-[#4F6A64]' : isAverage ? 'text-[#976E44]' : 'text-[#9E3B47]';
            const statusBg = isGood ? 'bg-[#82A094]' : isAverage ? 'bg-[#CE9F6B]' : 'bg-[#E17F70]';
            
            // Description for each metric
            const descriptions: Record<string, string> = {
              collectionRate: 'Amount collected vs invoiced',
              overdueRate: 'Invoices past due date',
              onTimeRate: 'Invoices within terms',
              currentRate: 'Balance not yet due'
            };
            
            return (
              <div key={key} className={`${bgColor} rounded-2xl p-5 text-center group hover:scale-[1.02] transition-transform`}>
                {/* Circular Progress */}
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
                    {/* Progress circle */}
                    <circle 
                      cx="50" cy="50" r={radius} fill="none" 
                      stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - progress}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${textColor}`}>{perf.value}%</span>
                  </div>
                </div>
                
                {/* Label */}
                <div className={`text-sm font-bold ${textColor} mb-1`}>{perf.label}</div>
                <div className="text-xs text-[#5D6E73] mb-3">{descriptions[key] || ''}</div>
                
                {/* Status Badge */}
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

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* ROW 4: Critical Overdue List - Enhanced */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-[#E17F70]/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] flex items-center justify-center text-white shadow-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#546A7A] text-lg">Critical Overdue</h3>
              <p className="text-xs text-[#5D6E73]">Invoices requiring immediate attention</p>
            </div>
          </div>
          <Link href="/finance/ar/invoices?status=OVERDUE" className="flex items-center gap-2 text-sm text-white bg-[#E17F70] hover:bg-[#9E3B47] px-4 py-2 rounded-lg transition-colors">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        
        {!data?.criticalOverdue?.length ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#82A094]/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#82A094]" />
            </div>
            <div className="text-lg font-semibold text-[#546A7A] mb-1">All Clear!</div>
            <div className="text-sm text-[#5D6E73]">No critical overdue invoices at this time</div>
          </div>
        ) : (
          <div className="divide-y divide-[#AEBFC3]/10">
            {data.criticalOverdue.map((inv, i) => {
              const severity = inv.daysOverdue > 90 ? 'critical' : inv.daysOverdue > 60 ? 'high' : 'medium';
              const severityColors = {
                critical: 'bg-[#9E3B47] border-[#9E3B47]',
                high: 'bg-[#E17F70] border-[#E17F70]',
                medium: 'bg-[#CE9F6B] border-[#CE9F6B]'
              };
              const severityLabels = {
                critical: 'CRITICAL',
                high: 'HIGH',
                medium: 'MEDIUM'
              };
              
              return (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-[#E17F70]/5 transition-colors group">
                  {/* Rank Badge */}
                  <div className="w-8 h-8 rounded-lg bg-[#F8FAFB] flex items-center justify-center text-sm font-bold text-[#546A7A]">
                    #{i + 1}
                  </div>
                  
                  {/* Invoice Info */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/finance/ar/invoices/${inv.invoiceNumber}`} className="text-sm font-bold text-[#E17F70] hover:underline group-hover:text-[#9E3B47]">
                      {inv.invoiceNumber}
                    </Link>
                    <div className="text-sm text-[#546A7A] truncate">{inv.customerName}</div>
                  </div>
                  
                  {/* Balance */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#546A7A]">{formatARCurrency(Number(inv.balance))}</div>
                    <div className="text-xs text-[#5D6E73]">Outstanding</div>
                  </div>
                  
                  {/* Days Overdue with Severity */}
                  <div className="text-center w-24">
                    <div className={`inline-flex items-center gap-1 ${severityColors[severity]} text-white text-xs font-bold px-3 py-1.5 rounded-lg`}>
                      +{inv.daysOverdue}d
                    </div>
                    <div className="text-xs text-[#5D6E73] mt-1">{severityLabels[severity]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
