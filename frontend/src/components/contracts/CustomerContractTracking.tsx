'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Filter, Building2, MapPin, FileText, ChevronRight,
  ArrowLeft, CheckCircle, AlertTriangle, Activity, Clock,
  Shield, Calendar, IndianRupee, User, Sparkles, Eye,
  TrendingUp, ShieldCheck, Info, RefreshCw, Printer, X,
  ChevronDown, ChevronUp, Layers, BarChart3, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { getCustomerColorClass } from '@/lib/utils';

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
  customerId?: number;
  zoneId?: number;
}

interface CustomerSummary {
  customerId: number;
  customerName: string;
  place: string;
  zoneName: string;
  totalContracts: number;
  activeContracts: number;
  expiredContracts: number;
  totalValue: number;
  totalMachines: number;
  totalBDs: number;
  pmCompleted: number;
  pmTotal: number;
  pmPercentage: number;
  contracts: Contract[];
  hasSoftwareSupport: boolean;
}

interface CustomerContractTrackingProps {
  role: string;
}

export default function CustomerContractTracking({ role }: CustomerContractTrackingProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [expandedContractId, setExpandedContractId] = useState<number | null>(null);

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  const getBDValueLabel = (csContracts: Contract[]) => {
    const hasUnlimited = csContracts.some(c => c.bdCount === 999);
    const finiteBDs = csContracts
      .filter(c => c.bdCount !== 999)
      .reduce((sum, c) => sum + (c.bdCount || 0), 0);

    if (hasUnlimited && finiteBDs > 0) {
      return `Unlimited + ${finiteBDs}`;
    }
    if (hasUnlimited) {
      return 'Unlimited';
    }
    return String(finiteBDs);
  };

  // Fetch contracts
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await apiService.getContracts({
        zone: zoneFilter,
        status: statusFilter,
        tech: techFilter
      });
      setContracts(data);
    } catch (err: any) {
      console.error('Failed to fetch contracts', err);
      toast.error('Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [zoneFilter, statusFilter, techFilter]);

  // List of unique technicians for filter
  const uniqueTechnicians = useMemo(() => {
    const list = new Set(contracts.map(c => c.responsible).filter(Boolean));
    return Array.from(list);
  }, [contracts]);

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

  // Group contracts by customer
  const customerSummaries = useMemo(() => {
    const grouped: Record<string, CustomerSummary> = {};

    contracts.forEach(c => {
      const key = c.customerId ? String(c.customerId) : c.customerName;
      if (!grouped[key]) {
        grouped[key] = {
          customerId: c.customerId || 0,
          customerName: c.customerName,
          place: c.place,
          zoneName: c.zoneName,
          totalContracts: 0,
          activeContracts: 0,
          expiredContracts: 0,
          totalValue: 0,
          totalMachines: 0,
          totalBDs: 0,
          pmCompleted: 0,
          pmTotal: 0,
          pmPercentage: 0,
          contracts: [],
          hasSoftwareSupport: false,
        };
      }
      grouped[key].totalContracts++;
      if (c.status === 'Active') grouped[key].activeContracts++;
      if (c.status === 'Expired') grouped[key].expiredContracts++;
      grouped[key].totalValue += Number(c.amount);
      grouped[key].totalMachines += c.noOfMachine;
      grouped[key].totalBDs += c.bdCount;
      if (c.softwareSupport) grouped[key].hasSoftwareSupport = true;

      c.pmSchedules.forEach(pm => {
        if (pm.status !== 'Not Applicable') {
          grouped[key].pmTotal++;
          if (pm.status === 'Completed') grouped[key].pmCompleted++;
        }
      });

      grouped[key].contracts.push(c);
    });

    // Calculate PM percentage and apply search
    return Object.values(grouped)
      .map(cs => ({
        ...cs,
        pmPercentage: cs.pmTotal > 0 ? Math.round((cs.pmCompleted / cs.pmTotal) * 100) : 0,
      }))
      .filter(cs => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          cs.customerName.toLowerCase().includes(s) ||
          cs.place.toLowerCase().includes(s) ||
          cs.zoneName.toLowerCase().includes(s) ||
          cs.contracts.some(c => c.contractNumber.toLowerCase().includes(s))
        );
      })
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [contracts, search]);

  // Format date
  const formatDateLabel = (isoStr: string) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Status badge helper
  const getStatusBadge = (status: Contract['status']) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      case 'Expiring Soon':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'Expired':
        return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getSlaColor = (mcType: string) => {
    if (mcType.includes('Premium')) return 'bg-[#546A7A] text-white';
    if (mcType.includes('Active')) return 'bg-[#CE9F6B] text-white';
    return 'bg-[#82A094] text-white';
  };

  // PM ring visual
  const PMRing = ({ completed, total, percentage }: { completed: number; total: number; percentage: number }) => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const color = percentage >= 75 ? '#10b981' : percentage >= 40 ? '#f59e0b' : '#ef4444';

    return (
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
          <circle
            cx="32" cy="32" r={radius} fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-extrabold text-slate-700">{percentage}%</span>
        </div>
      </div>
    );
  };

  // ─── DETAIL VIEW ──────────────────────────────────────────
  if (selectedCustomer) {
    const cs = selectedCustomer;
    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
        {/* Detail Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3d4f5c] p-6 text-white shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#82A094]/25 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-[#CE9F6B]/20 rounded-full blur-3xl" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setSelectedCustomer(null); setExpandedContractId(null); }}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#82A094]/15 border border-[#82A094]/30 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-[#82A094]" />
                  <span className="text-[10px] font-semibold text-[#82A094] tracking-wider uppercase">Customer Tracking</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{cs.customerName}</h1>
                <div className="flex items-center gap-2 text-white/60 text-sm mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{cs.place}</span>
                  <span>•</span>
                  <span className="font-semibold text-white/70">{cs.zoneName} Zone</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-sm font-semibold transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Contracts', value: cs.totalContracts, icon: FileText, color: 'text-[#82A094]', bg: 'bg-[#82A094]/10' },
            { label: 'Active', value: cs.activeContracts, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
            { label: 'Expired', value: cs.expiredContracts, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-500/10' },
            { label: 'Portfolio Value', value: `₹${cs.totalValue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-amber-600', bg: 'bg-amber-500/10' },
            { label: 'Machines', value: cs.totalMachines, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                <p className="text-lg font-extrabold text-slate-800">{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* PM Overview Bar */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row items-center gap-4">
          <PMRing completed={cs.pmCompleted} total={cs.pmTotal} percentage={cs.pmPercentage} />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-800">Preventive Maintenance Overview</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {cs.pmCompleted} of {cs.pmTotal} PM visits completed across all contracts
            </p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${cs.pmPercentage}%`,
                  background: cs.pmPercentage >= 75 ? '#10b981' : cs.pmPercentage >= 40 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
          {cs.hasSoftwareSupport && (
            <span className="inline-flex px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> SW Support Active
            </span>
          )}
        </div>

        {/* Contract Cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-[#82A094]" />
            <span>All Contracts ({cs.contracts.length})</span>
          </h2>

          {cs.contracts.map((contract, index) => {
            const isExpanded = expandedContractId === contract.id;
            const totalPMs = contract.pmSchedules.filter(p => p.status !== 'Not Applicable').length;
            const completedPMs = contract.pmSchedules.filter(p => p.status === 'Completed').length;
            const pmPct = totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0;

            return (
              <div
                key={contract.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                {/* Contract Header Row */}
                <div
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setExpandedContractId(isExpanded ? null : contract.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {cs.contracts.length - index}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-800 text-sm">
                          PO: {contract.poNo || '—'}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          ({contract.contractNumber})
                        </span>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(contract.status)}`}>
                          {contract.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getSlaColor(contract.mcType)}`}>
                          {contract.mcType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateLabel(contract.startDate)} — {formatDateLabel(contract.endDate)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {contract.responsible}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Mini PM indicator */}
                    <div className="flex flex-wrap gap-1 items-center max-w-[200px]">
                      {Array.from({ length: contract.noOfVisits || contract.pmSchedules.length || 3 }, (_, idx) => idx + 1).map(num => {
                        const pm = contract.pmSchedules.find(p => p.pmNumber === num);
                        if (!pm || pm.status === 'Not Applicable') {
                          return (
                            <span key={num} className="w-6 h-6 rounded-lg bg-slate-50 text-slate-300 flex items-center justify-center text-[8px] font-bold border border-slate-100">
                              —
                            </span>
                          );
                        }
                        const done = pm.status === 'Completed';
                        return (
                          <span
                            key={num}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold border ${done
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                              }`}
                            title={`PM ${num}: ${pm.status}`}
                          >
                            {done ? '✓' : '•'}
                          </span>
                        );
                      })}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-slate-800">₹{Number(contract.amount).toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-400">{contract.noOfMachine} Machines</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`${getBaseRoute()}/contracts/${contract.id}`);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors"
                      >
                        Open
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
                    {/* Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div className="bg-white rounded-xl p-3.5 border border-slate-100 space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">PO Number</span>
                        <span className="font-mono font-bold text-slate-800">{contract.poNo}</span>
                      </div>
                      <div className="bg-white rounded-xl p-3.5 border border-slate-100 space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">PO Date</span>
                        <span className="font-semibold text-slate-700">{formatDateLabel(contract.poDate)}</span>
                      </div>
                      <div className="bg-white rounded-xl p-3.5 border border-slate-100 space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Payment Terms</span>
                        <span className="font-semibold text-slate-700">{contract.paymentTerms}</span>
                      </div>
                      <div className="bg-white rounded-xl p-3.5 border border-slate-100 space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Scheduled Month</span>
                        <span className="font-bold text-slate-800">{contract.scheduledMonth || 'N/A'}</span>
                      </div>
                    </div>

                    {/* PM Tracking Section */}
                    <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          PM Visit Cycles
                        </h4>
                        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 font-bold">
                          {completedPMs}/{totalPMs} Done ({pmPct}%)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {contract.pmSchedules.map((pm, idx) => {
                          if (pm.status === 'Not Applicable') {
                            return (
                              <div key={idx} className="p-3 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 flex justify-between items-center text-xs opacity-60">
                                <div>
                                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Visit {pm.pmNumber}</span>
                                  <span className="text-slate-400 italic text-[10px]">Not Applicable</span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 font-bold text-[10px]">N/A</span>
                              </div>
                            );
                          }

                          const isCompleted = pm.status === 'Completed';
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex justify-between items-center text-xs transition-all ${isCompleted
                                  ? 'bg-emerald-500/5 border-emerald-500/20'
                                  : 'bg-white border-slate-100 hover:border-slate-200'
                                }`}
                            >
                              <div className="space-y-0.5">
                                <span className={`font-bold block text-[10px] uppercase tracking-wider ${isCompleted ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  Visit {pm.pmNumber}
                                </span>
                                <span className="font-mono font-semibold text-slate-600 text-[10px]">{pm.range}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleTogglePMStatus(pm.id, pm.status)}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${isCompleted
                                    ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border-amber-500/20'
                                  }`}
                              >
                                {isCompleted ? '✓ Done' : '• Pending'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom row: Software Support */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Software Support</p>
                          <p className="text-sm font-bold text-slate-700">
                            {contract.softwareSupport ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                Active License
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-medium">Not Included</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Note */}
        <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/50 flex gap-2 items-center text-xs text-slate-500">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p>Click on any contract row to expand full tracking details. Use PM status buttons to toggle visit completion directly.</p>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ──────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3d4f5c] p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#82A094]/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-[#CE9F6B]/20 rounded-full blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#82A094]/15 border border-[#82A094]/30 mb-3">
              <BarChart3 className="w-4 h-4 text-[#82A094]" />
              <span className="text-xs font-semibold text-[#82A094] tracking-wider uppercase">{role} • FSM Service Contracts</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Service Contracts
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Manage, track, and monitor all service contracts grouped by customer. Click &quot;View&quot; to see complete details.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`${getBaseRoute()}/contracts/new`)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#82A094] to-[#688579] hover:brightness-110 active:scale-[0.98] text-white font-semibold transition-all shadow-lg shadow-[#82A094]/25"
            >
              <Plus className="w-5 h-5" />
              <span>Add Agreement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filters</h3>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto font-medium">
          <div className="relative w-full sm:max-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search customer, place, contract no..."
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

      {/* Customer List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading customer tracking data...</p>
        </div>
      ) : customerSummaries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No customers found matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customerSummaries.map((cs, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
            >
              <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Customer Info */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getCustomerColorClass(cs.customerName)} flex items-center justify-center text-white text-base font-extrabold flex-shrink-0 shadow-sm`}>
                    {cs.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-800 text-sm truncate">{cs.customerName}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{cs.place}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-500 flex-shrink-0">{cs.zoneName} Zone</span>
                    </div>
                  </div>
                </div>

                {/* Stats Pills */}
                <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                  {/* Contracts */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                    <FileText className="w-3.5 h-3.5 text-[#82A094]" />
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">Contracts</span>
                      <span className="text-sm font-extrabold text-slate-800">
                        {cs.activeContracts}<span className="text-slate-300 font-normal">/{cs.totalContracts}</span>
                      </span>
                    </div>
                  </div>

                  {/* PM Progress */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">PM Done</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-slate-800">{cs.pmPercentage}%</span>
                        <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${cs.pmPercentage}%`,
                              background: cs.pmPercentage >= 75 ? '#10b981' : cs.pmPercentage >= 40 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                    <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">Value</span>
                      <span className="text-sm font-extrabold text-slate-800">₹{cs.totalValue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>



                  {/* View Button */}
                  <button
                    onClick={() => setSelectedCustomer(cs)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#82A094] to-[#6e897e] hover:brightness-110 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm shadow-[#82A094]/20"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
