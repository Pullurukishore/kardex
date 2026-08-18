'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, Search, Plus, Filter, Clock, CheckCircle, 
  AlertTriangle, X, TrendingUp, Sparkles, Building2, ShieldAlert,
  ChevronRight, Calendar, Info, RefreshCw, FileCheck, Check,
  User, MapPin, IndianRupee, Activity, HelpCircle,
  Zap, Percent, Shield, CreditCard, BarChart3, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const COLORS = ['#82A094', '#6F8A9D', '#CE9F6B', '#E17F70', '#546A7A'];

interface PMSchedule {
  id: number;
  pmNumber: 1 | 2 | 3 | 4;
  range: string;
  status: 'Completed' | 'Pending' | 'Not Applicable';
}

interface Contract {
  id: number;
  contractNumber: string;
  customerName: string;
  place: string;
  poNo: string;
  poDate: string;
  mcType: string;
  noOfMachine: number;
  amount: number;
  noOfVisits: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  softwareSupport: boolean;
  pmSchedules: PMSchedule[];
  responsible: string;
  zoneName: string;
  bdCount: number;
  paymentTerms: string;
  scheduledMonth: string;
}

interface ContractsDashboardProps {
  role: string;
  view?: 'dashboard' | 'list';
}

export default function ContractsDashboard({ role, view = 'list' }: ContractsDashboardProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  // Fetch contracts
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await apiService.getContracts({
        search,
        zone: zoneFilter,
        status: statusFilter,
        tech: techFilter
      });
      setContracts(data);
    } catch (err: any) {
      console.error('Failed to fetch contracts', err);
      toast.error('Failed to load contracts from database');
    } finally {
      setLoading(false);
    }
  };

  // Fetch contracts when filters change
  useEffect(() => {
    fetchContracts();
  }, [search, statusFilter, zoneFilter, techFilter]);

  // Toggle PM Status
  const handleTogglePMStatus = async (pmId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    try {
      await apiService.updatePMSchedule(pmId, newStatus);
      toast.success('PM Visit status updated!');
      fetchContracts();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update PM schedule status');
    }
  };

  const uniqueTechnicians = useMemo(() => {
    const list = new Set<string>();
    contracts.forEach(c => {
      if (c.responsible) {
        c.responsible.split(/[\/,]+/).forEach(r => {
          const name = r.trim();
          if (name) list.add(name);
        });
      }
    });
    return Array.from(list).sort();
  }, [contracts]);

  // KPI calculations
  const stats = useMemo(() => {
    const totalCount = contracts.length;
    const totalActive = contracts.filter(c => c.status === 'Active' || c.status === 'Expiring Soon').length;
    const totalExpired = contracts.filter(c => c.status === 'Expired').length;
    const totalExpiringSoon = contracts.filter(c => c.status === 'Expiring Soon').length;
    const totalAmount = contracts.reduce((sum, c) => (c.status === 'Active' || c.status === 'Expiring Soon') ? sum + Number(c.amount) : sum, 0);
    const totalPMs = contracts.reduce((sum, c) => sum + c.pmSchedules.filter(p => p.status === 'Completed').length, 0);
    const totalExpectedPMs = contracts.reduce((sum, c) => sum + c.pmSchedules.filter(p => p.status !== 'Not Applicable').length, 0);
    const pmCompletionRate = totalExpectedPMs > 0 ? Math.round((totalPMs / totalExpectedPMs) * 100) : 0;
    const totalBDs = contracts.reduce((sum, c) => sum + (c.bdCount === 999 ? 0 : c.bdCount), 0);
    const totalMachines = contracts.reduce((sum, c) => sum + (c.noOfMachine || 0), 0);
    const avgContractValue = totalActive > 0 ? Math.round(totalAmount / totalActive) : 0;

    return {
      totalCount,
      totalActive,
      totalExpired,
      totalExpiringSoon,
      totalAmount,
      totalPMs,
      totalExpectedPMs,
      pmCompletionRate,
      totalBDs,
      totalMachines,
      avgContractValue
    };
  }, [contracts]);

  // Analytics helper calculations
  const mcTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    contracts.forEach(c => {
      if (c.mcType) {
        counts[c.mcType] = (counts[c.mcType] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [contracts]);

  const zoneValueData = useMemo(() => {
    const amounts: Record<string, number> = { North: 0, South: 0, East: 0, West: 0 };
    contracts.forEach(c => {
      if ((c.status === 'Active' || c.status === 'Expiring Soon') && amounts[c.zoneName] !== undefined) {
        amounts[c.zoneName] += Number(c.amount);
      }
    });
    return Object.entries(amounts).map(([name, value]) => ({ name, value }));
  }, [contracts]);

  const engineerWorkload = useMemo(() => {
    const counts: Record<string, number> = {};
    contracts.forEach(c => {
      if (c.responsible) {
        c.responsible.split(/[\/,]+/).forEach(r => {
          const name = r.trim();
          if (name) {
            counts[name] = (counts[name] || 0) + 1;
          }
        });
      } else {
        counts['Unassigned'] = (counts['Unassigned'] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [contracts]);

  const pmStatusDistribution = useMemo(() => {
    let completed = 0;
    let pending = 0;
    contracts.forEach(c => {
      c.pmSchedules.forEach(p => {
        if (p.status === 'Completed') completed++;
        if (p.status === 'Pending') pending++;
      });
    });
    return [
      { name: 'Completed', value: completed, color: '#82A094' },
      { name: 'Pending', value: pending, color: '#CE9F6B' }
    ];
  }, [contracts]);

  // Zone Performance Comparison Table calculation
  const zonePerformance = useMemo(() => {
    const zones = ['North', 'South', 'East', 'West'];
    return zones.map(zone => {
      const zoneContracts = contracts.filter(c => c.zoneName.toLowerCase() === zone.toLowerCase());
      const activeContracts = zoneContracts.filter(c => c.status === 'Active' || c.status === 'Expiring Soon').length;
      const totalVal = zoneContracts.reduce((sum, c) => sum + Number(c.amount), 0);
      const activeVal = zoneContracts.reduce((sum, c) => (c.status === 'Active' || c.status === 'Expiring Soon') ? sum + Number(c.amount) : sum, 0);
      const totalMachines = zoneContracts.reduce((sum, c) => sum + (c.noOfMachine || 0), 0);
      const totalBDs = zoneContracts.reduce((sum, c) => sum + (c.bdCount === 999 ? 0 : c.bdCount), 0);
      
      let pmTotal = 0;
      let pmCompleted = 0;
      zoneContracts.forEach(c => {
        c.pmSchedules.forEach(p => {
          if (p.status !== 'Not Applicable') {
            pmTotal++;
            if (p.status === 'Completed') pmCompleted++;
          }
        });
      });
      const pmRate = pmTotal > 0 ? Math.round((pmCompleted / pmTotal) * 100) : 0;
      
      return {
        name: zone,
        count: zoneContracts.length,
        activeCount: activeContracts,
        totalValue: totalVal,
        activeValue: activeVal,
        machines: totalMachines,
        bds: totalBDs,
        pmRate
      };
    });
  }, [contracts]);

  // Contract Expiry Tracker
  const expiringContracts = useMemo(() => {
    const now = new Date();
    return contracts
      .filter(c => c.status === 'Active' || c.status === 'Expiring Soon')
      .map(c => {
        const end = new Date(c.endDate);
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...c, daysRemaining: diffDays };
      })
      .filter(c => c.daysRemaining > 0 && c.daysRemaining <= 90)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [contracts]);

  // Customer Concentration (Top 5 Customers)
  const customerConcentration = useMemo(() => {
    const counts: Record<string, { value: number; count: number }> = {};
    contracts.forEach(c => {
      if (!counts[c.customerName]) {
        counts[c.customerName] = { value: 0, count: 0 };
      }
      counts[c.customerName].value += Number(c.amount);
      counts[c.customerName].count += 1;
    });
    const totalPortfolio = contracts.reduce((sum, c) => sum + Number(c.amount), 0);
    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.count,
        percentage: totalPortfolio > 0 ? Math.round((data.value / totalPortfolio) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [contracts]);

  // Payment Terms Breakdown
  const paymentTermsData = useMemo(() => {
    const counts: Record<string, number> = {};
    contracts.forEach(c => {
      const term = c.paymentTerms || 'Not Specified';
      counts[term] = (counts[term] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [contracts]);

  // Software Support Coverage
  const softwareSupportStats = useMemo(() => {
    const total = contracts.length;
    const covered = contracts.filter(c => c.softwareSupport).length;
    const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;
    return { covered, notCovered: total - covered, percentage };
  }, [contracts]);

  // Monthly Scheduled Maintenance Workload Calendar
  const monthlyMaintenanceLoad = useMemo(() => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const counts: Record<string, number> = {};
    months.forEach(m => { counts[m] = 0; });
    
    contracts.forEach(c => {
      if (c.scheduledMonth && months.includes(c.scheduledMonth)) {
        counts[c.scheduledMonth] += 1;
      } else if (c.startDate) {
        const mIndex = new Date(c.startDate).getMonth();
        const mName = months[mIndex];
        if (mName) counts[mName] += 1;
      }
    });
    
    return months.map(name => ({ name, value: counts[name] }));
  }, [contracts]);

  const getStatusBadge = (status: Contract['status']) => {
    switch (status) {
      case 'Active':
        return 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/30';
      case 'Expiring Soon':
        return 'bg-[#CE9F6B]/15 text-[#976E44] border-[#CE9F6B]/30';
      case 'Expired':
        return 'bg-[#E17F70]/15 text-[#75242D] border-[#E17F70]/30';
      default:
        return 'bg-[#AEBFC3]/15 text-[#5D6E73] border-[#92A2A5]/30';
    }
  };

  const getSlaColor = (mcType: string) => {
    if (mcType.includes('Premium')) {
      return 'bg-[#546A7A] text-white shadow-sm';
    } else if (mcType.includes('Active')) {
      return 'bg-[#CE9F6B] text-white shadow-sm';
    }
    return 'bg-[#82A094] text-white shadow-sm';
  };

  // Format Date ISO helper
  const formatDateLabel = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3d4f5c] p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#82A094]/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-[#CE9F6B]/20 rounded-full blur-3xl" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#82A094]/15 border border-[#82A094]/30 mb-3">
              <Sparkles className="w-4 h-4 text-[#82A094]" />
              <span className="text-xs font-semibold text-[#82A094] tracking-wider uppercase">{role} Dashboard</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {view === 'dashboard' ? 'Contracts Analytics & Stats' : 'FSM Service Contracts'}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {view === 'dashboard' 
                ? 'Overview of active agreements, total portfolio values, PM compliance rates, and breakdown incidents.' 
                : 'Digital tracking replacement for PM Visit Cycles, PO Billings, and breakdown logs.'}
            </p>
          </div>
          {view !== 'dashboard' && (
            <button 
              onClick={() => router.push(`${getBaseRoute()}/contracts/new`)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#82A094] to-[#688579] hover:brightness-110 active:scale-[0.98] text-white font-semibold transition-all shadow-lg shadow-[#82A094]/25"
            >
              <Plus className="w-5 h-5" />
              <span>Add Agreement</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {view === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top Row: 6 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Card 1: Total Agreements */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Agreements</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</h3>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold text-slate-500">
                  <span className="text-emerald-600">{stats.totalActive} Active</span>
                  <span>•</span>
                  <span className="text-rose-600">{stats.totalExpired} Expired</span>
                </div>
              </div>
            </div>

            {/* Card 2: Active Portfolio Value */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portfolio Value</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-800">₹{stats.totalAmount.toLocaleString('en-IN')}</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-600">
                  <TrendingUp className="w-3 h-3" />
                  <span>Active Revenue</span>
                </div>
              </div>
            </div>

            {/* Card 3: PM Visit Completion */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PM Compliance</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-800">{stats.pmCompletionRate}%</h3>
                  <div className="text-[10px] font-semibold text-slate-400 mt-1">
                    {stats.totalPMs} / {stats.totalExpectedPMs}
                  </div>
                </div>
                <div className="w-8 h-8 relative flex items-center justify-center">
                  <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="13" fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
                    <circle
                      cx="16" cy="16" r="13" fill="none"
                      stroke={stats.pmCompletionRate >= 75 ? '#10b981' : stats.pmCompletionRate >= 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="2.5"
                      strokeDasharray={2 * Math.PI * 13}
                      strokeDashoffset={2 * Math.PI * 13 - (stats.pmCompletionRate / 100) * (2 * Math.PI * 13)}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 4: Breakdown Incidents */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Breakdowns</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-800">{stats.totalBDs} Incidents</h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-rose-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>SLA Active</span>
                </div>
              </div>
            </div>

            {/* Card 5: Machines Covered */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machines Covered</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-800">{stats.totalMachines} Units</h3>
                <div className="text-[10px] font-semibold text-slate-400 mt-1">
                  Active SLA Machines
                </div>
              </div>
            </div>

            {/* Card 6: Average Agreement Value */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Contract Value</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-800">₹{stats.avgContractValue.toLocaleString('en-IN')}</h3>
                <div className="text-[10px] font-semibold text-slate-400 mt-1">
                  Per Active Agreement
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Charts Grid (4 Charts) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-medium text-slate-800">
            {/* Chart 1: MC Type Care Levels */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Contract Care Levels</h3>
                <p className="text-xs text-slate-400">Distribution of agreement types across portfolio</p>
              </div>
              <div className="h-64 mt-4 relative">
                {mcTypeDistribution.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">No care levels logged.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mcTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {mcTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Contracts`, 'Care Level']} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Portfolio Value by Zone */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Portfolio Value by Zone</h3>
                <p className="text-xs text-slate-400">Active contract financial value distribution</p>
              </div>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={zoneValueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Portfolio Value']} />
                    <Bar dataKey="value" fill="#82A094" radius={[8, 8, 0, 0]}>
                      {zoneValueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'North' ? '#82A094' : entry.name === 'South' ? '#6F8A9D' : entry.name === 'East' ? '#CE9F6B' : '#E17F70'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Top Engineers Workload */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Top Engineers Workload</h3>
                <p className="text-xs text-slate-400">Number of active agreements managed by responsible engineers</p>
              </div>
              <div className="h-64 mt-4">
                {engineerWorkload.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">No active workload logs.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engineerWorkload} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={90} />
                      <Tooltip formatter={(value) => [`${value} Contracts`, 'Workload']} />
                      <Bar dataKey="value" fill="#6F8A9D" radius={[0, 8, 8, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 4: PM Status Gauge */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">PM Visits Distribution</h3>
                <p className="text-xs text-slate-400">Total completed vs pending visits comparison</p>
              </div>
              <div className="h-64 mt-4 relative">
                {pmStatusDistribution[0].value === 0 && pmStatusDistribution[1].value === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">No PM schedule status recorded.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pmStatusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pmStatusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Visits`, 'Status']} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Double Column Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Column 1: Customer Concentration & Payment Terms */}
            <div className="space-y-6">
              {/* Customer Concentration */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Top Customers</h3>
                  <p className="text-xs text-slate-400">Portfolio concentration by account value</p>
                </div>
                <div className="space-y-3.5">
                  {customerConcentration.length === 0 ? (
                    <p className="text-xs text-slate-400">No customer logs.</p>
                  ) : (
                    customerConcentration.map((cust, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700 truncate max-w-[160px]">{cust.name}</span>
                          <span className="text-slate-500">₹{cust.value.toLocaleString('en-IN')} ({cust.percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#82A094] rounded-full transition-all duration-500" 
                            style={{ width: `${cust.percentage}%` }} 
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 flex justify-between">
                          <span>{cust.count} Agreements</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Payment Terms Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Payment Terms Distribution</h3>
                  <p className="text-xs text-slate-400">Agreed commercial cycles</p>
                </div>
                <div className="max-h-[180px] overflow-y-auto space-y-2 text-xs">
                  {paymentTermsData.map((pt, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-600">{pt.name}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#82A094]/15 text-[#4F6A64] font-bold text-[10px]">
                        {pt.value} {pt.value === 1 ? 'Contract' : 'Contracts'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Contract Expiry Tracker */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[400px]">
              <div className="space-y-4 w-full">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Expiry Tracker (Next 90 Days)</h3>
                  <p className="text-xs text-slate-400">Agreements expiring soon, needing renewal attention</p>
                </div>
                
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {expiringContracts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                      <Shield className="w-8 h-8 stroke-1 text-slate-300" />
                      <p className="text-xs">No active agreements expiring within 90 days.</p>
                    </div>
                  ) : (
                    expiringContracts.map((c) => {
                      const days = c.daysRemaining;
                      const urgencyColor = days <= 30 
                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                        : days <= 60 
                          ? 'bg-amber-50 text-amber-700 border-amber-100' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100';

                      return (
                        <div 
                          key={c.id} 
                          className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-all bg-slate-50/50 flex flex-col justify-between gap-2 cursor-pointer"
                          onClick={() => router.push(`${getBaseRoute()}/contracts/${c.id}`)}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 truncate max-w-[160px]">{c.customerName}</h4>
                              <p className="text-[10px] text-slate-400">{c.contractNumber || 'No Contract ID'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${urgencyColor}`}>
                              {days} Days Left
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                            <span>End Date: {formatDateLabel(c.endDate)}</span>
                            <span className="font-semibold text-slate-700">₹{Number(c.amount).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Column 3: Software Support & Quick Actions */}
            <div className="space-y-6">
              {/* Software Support Coverage */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Software Support Coverage</h3>
                  <p className="text-xs text-slate-400">Contracts active with software maintenance agreements</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 relative flex items-center justify-center flex-shrink-0">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" strokeWidth="5.5" />
                      <circle
                        cx="32" cy="32" r="26" fill="none"
                        stroke="#6F8A9D" strokeWidth="5.5"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 - (softwareSupportStats.percentage / 100) * (2 * Math.PI * 26)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xs font-bold text-slate-700">{softwareSupportStats.percentage}%</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-700">{softwareSupportStats.covered} Agreements Covered</div>
                    <div className="text-[10px] text-slate-400 font-semibold">
                      Software SLA enabled • {softwareSupportStats.notCovered} Agreements not covered
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Agreements */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Quick Commands</h3>
                  <p className="text-xs text-slate-400">Perform direct service administrative tasks</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => router.push(`${getBaseRoute()}/contracts/new`)}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-[#82A094]/30 hover:bg-[#82A094]/5 transition-all text-center gap-1.5"
                  >
                    <Plus className="w-5 h-5 text-[#82A094]" />
                    <span className="text-[10px] font-bold text-slate-700">Add Agreement</span>
                  </button>
                  <button 
                    onClick={() => router.push(`${getBaseRoute()}/contracts`)}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-[#6F8A9D]/30 hover:bg-[#6F8A9D]/5 transition-all text-center gap-1.5"
                  >
                    <Search className="w-5 h-5 text-[#6F8A9D]" />
                    <span className="text-[10px] font-bold text-slate-700">Search contracts</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Section 4: Zone Performance Table */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Regional Zone Performance Comparison</h3>
              <p className="text-xs text-slate-400">Consolidated analytics metrics across administrative service zones</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-3">Service Zone</th>
                    <th className="p-3 text-center">Total Contracts</th>
                    <th className="p-3 text-center">Active Contracts</th>
                    <th className="p-3 text-right">Active Portfolio Value</th>
                    <th className="p-3 text-center">Machines Covered</th>
                    <th className="p-3 text-center">PM Compliance Rate</th>
                    <th className="p-3 text-center">Breakdown Incidents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zonePerformance.map((zp) => (
                    <tr key={zp.name} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-800">{zp.name} Zone</td>
                      <td className="p-3 text-center font-semibold text-slate-600">{zp.count}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                          {zp.activeCount} Active
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">₹{zp.activeValue.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-center font-medium text-slate-500">{zp.machines}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${zp.pmRate >= 75 ? 'bg-emerald-500' : zp.pmRate >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                              style={{ width: `${zp.pmRate}%` }} 
                            />
                          </div>
                          <span className="font-bold text-slate-700 text-[10px] w-8">{zp.pmRate}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full text-[10px]">
                          {zp.bds} Incidents
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Monthly Scheduled Maintenance Workload Calendar */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Monthly Scheduled Maintenance Workload</h3>
              <p className="text-xs text-slate-400">Total contracts scheduled to commence or have PM cycles in specific months</p>
            </div>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyMaintenanceLoad} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value} Contracts Scheduled`, 'Workload']} />
                  <Bar dataKey="value" fill="#6F8A9D" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* Search & Filters & Table */}
      {view === 'list' && (
        <>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filters & Search</h3>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto font-medium">
              <div className="relative w-full sm:max-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search contracts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#82A094]/30"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
              </select>

              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
              >
                <option value="all">All Zones</option>
                <option value="North">North Zone</option>
                <option value="South">South Zone</option>
                <option value="East">East Zone</option>
                <option value="West">West Zone</option>
              </select>

              <select
                value={techFilter}
                onChange={(e) => setTechFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
              >
                <option value="all">All Responsible</option>
                {uniqueTechnicians.map(tech => (
                  <option key={tech} value={tech}>{tech}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Consolidated Table Rendering */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
              <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading active agreements...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm overflow-hidden animate-in fade-in duration-200 font-medium text-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-4">Customer Details</th>
                      <th className="p-4">Agreement Details</th>
                      <th className="p-4">PO & Billing Details</th>
                      <th className="p-4">PM Visit Cycles (Click to Toggle)</th>
                      <th className="p-4 text-center">Incidents</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contracts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">No agreements matching filters.</td>
                      </tr>
                    ) : (
                      contracts.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => router.push(`${getBaseRoute()}/contracts/${c.id}`)}>
                          {/* Customer Details */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="font-extrabold text-slate-800 text-sm">{c.customerName}</div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span>{c.place}</span>
                                <span>•</span>
                                <span className="font-semibold text-slate-500">{c.zoneName} Zone</span>
                              </div>
                            </div>
                          </td>

                          {/* Agreement Details */}
                          <td className="p-4">
                            <div className="space-y-1 text-[11px]">
                              <div className="flex gap-1.5 items-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getSlaColor(c.mcType)}`}>
                                  {c.mcType}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500 font-semibold">{c.noOfMachine} units</span>
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                Sched Month: <span className="font-bold text-slate-700">{c.scheduledMonth || 'N/A'}</span>
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                Eng: <span className="font-semibold text-slate-600">{c.responsible}</span>
                              </div>
                            </div>
                          </td>

                          {/* PO & Billing Details */}
                          <td className="p-4">
                            <div className="space-y-1 text-[11px]">
                              <div className="font-bold text-slate-800 text-xs">₹{Number(c.amount).toLocaleString('en-IN')}</div>
                              <div className="text-[10px] text-slate-400 leading-none">
                                PO: <span className="font-mono font-semibold text-slate-600">{c.poNo}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 leading-none">
                                Date: <span className="text-slate-500 font-semibold">{formatDateLabel(c.poDate)}</span>
                              </div>
                              {c.softwareSupport && (
                                <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                  SW Support
                                </span>
                              )}
                            </div>
                          </td>

                          {/* PM Visit Cycles */}
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-1.5 items-center max-w-[280px]">
                              {Array.from({ length: c.noOfVisits || c.pmSchedules.length || 3 }, (_, idx) => idx + 1).map(num => {
                                const pm = c.pmSchedules.find(p => p.pmNumber === num);
                                if (!pm || pm.status === 'Not Applicable') {
                                  return (
                                    <span 
                                      key={num} 
                                      className="w-8 h-8 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center text-[9px] font-bold border border-slate-100"
                                      title={`PM ${num}: Not Applicable`}
                                    >
                                      N/A
                                    </span>
                                  );
                                }
                                const isCompleted = pm.status === 'Completed';
                                return (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleTogglePMStatus(pm.id, pm.status)}
                                    title={`PM ${num}: ${pm.status} (${pm.range}). Click to toggle.`}
                                    className={`w-8 h-8 rounded-xl flex flex-col items-center justify-center text-[9px] font-bold transition-all hover:scale-105 active:scale-95 border ${
                                      isCompleted 
                                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border-emerald-500/20 shadow-sm' 
                                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border-amber-500/20 shadow-sm'
                                    }`}
                                  >
                                    <span className="text-[8px] text-slate-400 block -mb-0.5 leading-none">PM{num}</span>
                                    <span className="text-[10px]">{isCompleted ? '✓' : '•'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* Incidents */}
                          <td className="p-4 text-center font-bold text-rose-600 text-sm">
                            {c.bdCount === 999 ? 'Unlimited' : c.bdCount}
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(c.status)}`}>
                              {c.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => router.push(`${getBaseRoute()}/contracts/${c.id}`)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 hover:text-slate-800 font-bold transition-colors"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
