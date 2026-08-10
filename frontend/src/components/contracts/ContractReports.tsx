'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, FileText, Filter, Search, Download, Calendar,
  CheckCircle, AlertTriangle, Clock, MapPin,
  User, Building2, IndianRupee, ShieldCheck,
  TrendingUp, RefreshCw, ChevronDown, ChevronUp, Info,
  ArrowUpDown, ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { getCustomerColorClass } from '@/lib/utils';
import { generateContractReportPdf } from '@/lib/contract-report-pdf';

interface PMSchedule {
  id: number;
  pmNumber: number;
  range: string;
  status: 'Completed' | 'Pending' | 'Not Applicable';
  completedAt?: string;
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
  expiringSoonContracts: number;
  expiredContracts: number;
  totalValue: number;
  totalMachines: number;
  pmCompleted: number;
  pmTotal: number;
  pmOverdue: number;
  pmPercentage: number;
  hasSoftwareSupport: boolean;
  contracts: Contract[];
}

interface ContractReportsProps {
  role: string;
}

type SortKey = 'customerName' | 'totalValue' | 'totalContracts' | 'pmPercentage' | 'zoneName';
type SortDir = 'asc' | 'desc';

export default function ContractReports({ role }: ContractReportsProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | number | null>(null);

  const reportType = 'customer-portfolio';

  // Filters
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [pmFilter, setPmFilter] = useState('all'); // all | completed | on-track | behind | overdue
  const [mcTypeFilter, setMcTypeFilter] = useState('all');
  const [swFilter, setSwFilter] = useState('all'); // all | yes | no
  const [expiryFilter, setExpiryFilter] = useState('all'); // all | 30 | 60 | 90

  // Sorting for Customers
  const [sortKey, setSortKey] = useState<SortKey>('customerName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Fetch contracts
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await apiService.getContracts();
      setContracts(data);
    } catch (err: any) {
      console.error('Failed to fetch contracts', err);
      toast.error('Failed to load contracts data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const now = new Date();

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  const isRangeOverdue = (range: string): boolean => {
    try {
      const parts = range.split(' TO ');
      if (parts.length !== 2) return false;
      const endStr = parts[1].trim();
      const [day, month, year] = endStr.split('/').map(Number);
      return new Date(year, month - 1, day) < now;
    } catch { return false; }
  };

  const getPMStats = (pmSchedules: PMSchedule[]) => {
    const applicable = pmSchedules.filter(p => p.status !== 'Not Applicable');
    const completed = applicable.filter(p => p.status === 'Completed').length;
    const total = applicable.length;
    const pending = total - completed;
    const overdue = applicable.filter(p => p.status === 'Pending' && p.range && isRangeOverdue(p.range)).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, pending, overdue, pct };
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (val: number) => `₹${Number(val).toLocaleString('en-IN')}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      case 'Expiring Soon': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'Expired': return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getSlaColor = (mcType: string) => {
    if (!mcType) return 'bg-slate-400 text-white';
    if (mcType.includes('Premium')) return 'bg-[#546A7A] text-white';
    if (mcType.includes('Active')) return 'bg-[#CE9F6B] text-white';
    return 'bg-[#82A094] text-white';
  };

  // Unique values for filters
  const uniqueZones = useMemo(() => {
    const set = new Set(contracts.map(c => c.zoneName).filter(Boolean));
    return Array.from(set).sort();
  }, [contracts]);

  const uniqueTechnicians = useMemo(() => {
    const set = new Set(contracts.map(c => c.responsible).filter(Boolean));
    return Array.from(set).sort();
  }, [contracts]);

  const uniqueMcTypes = useMemo(() => {
    const set = new Set(contracts.map(c => c.mcType).filter(Boolean));
    return Array.from(set).sort();
  }, [contracts]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortKey === col ? 'text-white' : 'text-white/40'}`} />
  );

  // 1. CUSTOMER PORTFOLIO DATA
  const customerSummaries = useMemo(() => {
    let filtered = [...contracts];

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(c =>
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.place || '').toLowerCase().includes(s) ||
        (c.contractNumber || '').toLowerCase().includes(s) ||
        (c.poNo || '').toLowerCase().includes(s) ||
        (c.responsible || '').toLowerCase().includes(s)
      );
    }
    if (zoneFilter !== 'all') filtered = filtered.filter(c => c.zoneName === zoneFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);
    if (techFilter !== 'all') filtered = filtered.filter(c => c.responsible === techFilter);
    if (mcTypeFilter !== 'all') filtered = filtered.filter(c => c.mcType === mcTypeFilter);
    if (swFilter === 'yes') filtered = filtered.filter(c => c.softwareSupport);
    if (swFilter === 'no') filtered = filtered.filter(c => !c.softwareSupport);

    if (expiryFilter !== 'all') {
      const days = Number(expiryFilter);
      filtered = filtered.filter(c => {
        const rem = getDaysRemaining(c.endDate);
        return rem >= 0 && rem <= days;
      });
    }

    if (pmFilter !== 'all') {
      filtered = filtered.filter(c => {
        const { pct, overdue } = getPMStats(c.pmSchedules);
        if (pmFilter === 'completed') return pct === 100;
        if (pmFilter === 'on-track') return pct >= 50 && pct < 100;
        if (pmFilter === 'behind') return pct < 50 && pct > 0;
        if (pmFilter === 'overdue') return overdue > 0;
        if (pmFilter === 'not-started') return pct === 0;
        return true;
      });
    }

    const grouped: Record<string, CustomerSummary> = {};

    filtered.forEach(c => {
      const key = c.customerId ? String(c.customerId) : c.customerName;
      if (!grouped[key]) {
        grouped[key] = {
          customerId: c.customerId || 0,
          customerName: c.customerName,
          place: c.place,
          zoneName: c.zoneName,
          totalContracts: 0,
          activeContracts: 0,
          expiringSoonContracts: 0,
          expiredContracts: 0,
          totalValue: 0,
          totalMachines: 0,
          pmCompleted: 0,
          pmTotal: 0,
          pmOverdue: 0,
          pmPercentage: 0,
          hasSoftwareSupport: false,
          contracts: []
        };
      }

      grouped[key].totalContracts++;
      if (c.status === 'Active') grouped[key].activeContracts++;
      else if (c.status === 'Expiring Soon') grouped[key].expiringSoonContracts++;
      else if (c.status === 'Expired') grouped[key].expiredContracts++;

      grouped[key].totalValue += Number(c.amount);
      grouped[key].totalMachines += c.noOfMachine;
      if (c.softwareSupport) grouped[key].hasSoftwareSupport = true;

      const stats = getPMStats(c.pmSchedules);
      grouped[key].pmCompleted += stats.completed;
      grouped[key].pmTotal += stats.total;
      grouped[key].pmOverdue += stats.overdue;
      grouped[key].contracts.push(c);
    });

    const result = Object.values(grouped).map(cs => ({
      ...cs,
      pmPercentage: cs.pmTotal > 0 ? Math.round((cs.pmCompleted / cs.pmTotal) * 100) : 0
    }));

    result.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'customerName':
          av = (a.customerName || '').toLowerCase();
          bv = (b.customerName || '').toLowerCase();
          break;
        case 'totalValue':
          av = a.totalValue;
          bv = b.totalValue;
          break;
        case 'totalContracts':
          av = a.totalContracts;
          bv = b.totalContracts;
          break;
        case 'pmPercentage':
          av = a.pmPercentage;
          bv = b.pmPercentage;
          break;
        case 'zoneName':
          av = (a.zoneName || '').toLowerCase();
          bv = (b.zoneName || '').toLowerCase();
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [contracts, search, zoneFilter, statusFilter, techFilter, mcTypeFilter, swFilter, expiryFilter, pmFilter, sortKey, sortDir]);



  // Overall KPI summaries
  const selectedSummary = useMemo(() => {
    let totalValue = 0, totalMachines = 0, totalContracts = 0;
    let active = 0, expired = 0, expiring = 0;
    let pmCompleted = 0, pmTotal = 0, pmOverdue = 0;

    customerSummaries.forEach(cs => {
      totalValue += cs.totalValue;
      totalMachines += cs.totalMachines;
      totalContracts += cs.totalContracts;
      active += cs.activeContracts;
      expired += cs.expiredContracts;
      expiring += cs.expiringSoonContracts;
      pmCompleted += cs.pmCompleted;
      pmTotal += cs.pmTotal;
      pmOverdue += cs.pmOverdue;
    });

    const pmPct = pmTotal > 0 ? Math.round((pmCompleted / pmTotal) * 100) : 0;

    return {
      totalCustomers: customerSummaries.length,
      totalContracts,
      active,
      expired,
      expiring,
      totalValue,
      totalMachines,
      pmCompleted,
      pmTotal,
      pmOverdue,
      pmPct
    };
  }, [customerSummaries]);

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      if (format === 'pdf') {
        const filters = {
          zone: zoneFilter !== 'all' ? zoneFilter : 'All',
          status: statusFilter !== 'all' ? statusFilter : 'All',
          responsible: techFilter !== 'all' ? techFilter : 'All'
        };
        await generateContractReportPdf(customerSummaries, selectedSummary, filters);
        toast.success('Customer Portfolio PDF Report exported successfully!');
        return;
      }

      const params: any = { reportType: 'customer-portfolio', format };
      if (zoneFilter !== 'all') params.zone = zoneFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (techFilter !== 'all') params.responsible = techFilter;
      if (search) params.search = search;

      const blob = await apiService.exportContractReport(params);
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const fileExt = 'xlsx';

      const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `KardexCare-Customer-Portfolio-Report-${Date.now()}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Customer Portfolio Excel Report exported successfully!');
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error(`Failed to export ${format} report`);
    } finally {
      setExporting(false);
    }
  };

  const getFilterHeaderCount = () => {
    return `${customerSummaries.length} customers`;
  };

  return (
    <div className="space-y-5 print:space-y-3">
      {/* ═══ HEADER BANNER ═══ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3d4f5c] p-6 text-white shadow-xl print:rounded-none print:shadow-none print:p-4">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#82A094]/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-[#CE9F6B]/20 rounded-full blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#82A094]/15 border border-[#82A094]/30 mb-3">
              <BarChart3 className="w-4 h-4 text-[#82A094]" />
              <span className="text-xs font-semibold text-[#82A094] tracking-wider uppercase">{role} • Contract Reports</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Contract & PM Schedule Reports</h1>
            <p className="text-white/60 text-sm mt-1">
              Access comprehensive dashboards, expiring warnings, PM visits status, service zones, and technician summaries.
            </p>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={fetchContracts}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-sm font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#82A094] to-[#688579] hover:brightness-110 active:scale-[0.98] text-white font-semibold transition-all shadow-lg shadow-[#82A094]/25 disabled:opacity-50 text-xs"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] hover:brightness-110 active:scale-[0.98] text-white font-semibold transition-all shadow-lg shadow-[#546A7A]/25 disabled:opacity-50 text-xs"
            >
              <FileText className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>



      {/* ═══ DYNAMIC SUMMARY KPI CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {reportType === 'customer-portfolio' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#82A094]/10 flex items-center justify-center text-[#82A094] flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Customers</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalCustomers}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Agreements</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalContracts}</p>
                <span className="text-[10px] text-emerald-600 font-bold block">{selectedSummary.active} Active</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Portfolio Value</p>
                <p className="text-lg font-extrabold text-slate-800">{formatCurrency(selectedSummary.totalValue || 0)}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-650 flex-shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PM Done %</p>
                <p className="text-lg font-extrabold text-indigo-600">{selectedSummary.pmPct}%</p>
                <span className="text-[10px] text-rose-600 font-bold block">{selectedSummary.pmOverdue} Overdue</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ PM COMPLETION OVERVIEW BAR ═══ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="5" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={Number(selectedSummary.pmPct || 0) >= 75 ? '#10b981' : Number(selectedSummary.pmPct || 0) >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={2 * Math.PI * 26 - (Number(selectedSummary.pmPct || 0) / 100) * 2 * Math.PI * 26}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <span className="absolute text-xs font-extrabold text-slate-700">{selectedSummary.pmPct || 0}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800">Preventive Maintenance Overview</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Across all filtered records: {selectedSummary.pmCompleted || 0} of {selectedSummary.pmTotal || 0} PM visits completed • {selectedSummary.pmOverdue || 0} overdue
          </p>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${selectedSummary.pmPct || 0}%`,
                background: Number(selectedSummary.pmPct || 0) >= 75 ? '#10b981' : Number(selectedSummary.pmPct || 0) >= 40 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>
      </div>

      {/* ═══ FILTERS BAR ═══ */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filters</h3>
          <span className="ml-auto text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">
            Showing {getFilterHeaderCount()}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative w-full sm:max-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search customer, contract, PO, place..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#82A094]/30"
            />
          </div>

          {/* Zone */}
          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">All Zones</option>
            {uniqueZones.map(z => <option key={z} value={z}>{z} Zone</option>)}
          </select>

          {/* Status */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Expired">Expired</option>
          </select>

          {/* Responsible */}
          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">All Responsible</option>
            {uniqueTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* MC Type */}
          <select value={mcTypeFilter} onChange={(e) => setMcTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">All MC Types</option>
            {uniqueMcTypes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* PM Progress */}
          <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">All PM Status</option>
            <option value="completed">100% Completed</option>
            <option value="on-track">On Track (≥50%)</option>
            <option value="behind">Behind (&lt;50%)</option>
            <option value="overdue">Has Overdue PMs</option>
            <option value="not-started">Not Started (0%)</option>
          </select>

          {/* Expiry Window */}
          <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">All Expiry</option>
            <option value="30">Expiring in 30 Days</option>
            <option value="60">Expiring in 60 Days</option>
            <option value="90">Expiring in 90 Days</option>
          </select>

          {/* SW Support */}
          <select value={swFilter} onChange={(e) => setSwFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">SW Support</option>
            <option value="yes">With SW</option>
            <option value="no">Without SW</option>
          </select>
        </div>
      </div>

      {/* ═══ TABLE / LIST CONTAINER ═══ */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading reports data...</p>
        </div>
      ) : customerSummaries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No customers match the current filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 1. CUSTOMER PORTFOLIO LAYOUT */}
          {reportType === 'customer-portfolio' && (
            <>
              {/* Header Row */}
              <div className="bg-[#546A7A] text-white rounded-t-2xl px-5 py-3 text-xs font-bold flex items-center justify-between shadow-sm select-none">
                <div className="flex-1 cursor-pointer" onClick={() => handleSort('customerName')}>
                  Customer Details <SortIcon col="customerName" />
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="w-24 cursor-pointer text-center" onClick={() => handleSort('zoneName')}>
                    Zone <SortIcon col="zoneName" />
                  </div>
                  <div className="w-24 cursor-pointer text-center" onClick={() => handleSort('totalContracts')}>
                    Contracts <SortIcon col="totalContracts" />
                  </div>
                  <div className="w-32 cursor-pointer text-center" onClick={() => handleSort('pmPercentage')}>
                    PM Done <SortIcon col="pmPercentage" />
                  </div>
                  <div className="w-32 cursor-pointer text-right" onClick={() => handleSort('totalValue')}>
                    Total Portfolio <SortIcon col="totalValue" />
                  </div>
                  <div className="w-8"></div>
                </div>
              </div>

              {/* Customer Rows */}
              {customerSummaries.map((cs, idx) => {
                const isExpanded = expandedCustomerId === (cs.customerId || cs.customerName);
                return (
                  <div
                    key={`cust-${cs.customerId || idx}`}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    <div
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer"
                      onClick={() => setExpandedCustomerId(isExpanded ? null : (cs.customerId || cs.customerName))}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${getCustomerColorClass(cs.customerName)} flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0 shadow-sm`}>
                          {(cs.customerName || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-850 text-sm truncate flex items-center gap-2">
                            {cs.customerName || 'Unassigned'}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`${getBaseRoute()}/customers/${cs.customerId}`);
                              }}
                              className="text-slate-400 hover:text-[#82A094] p-0.5"
                              title="Open Customer Account"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{cs.place || '—'}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {Array.from(new Set(cs.contracts.map(c => c.mcType).filter(Boolean))).map(sla => (
                              <span key={sla} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSlaColor(sla)}`}>
                                {sla}
                              </span>
                            ))}

                            {cs.hasSoftwareSupport && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-650 border border-indigo-100">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                SW Support
                              </span>
                            )}

                            {cs.contracts.filter(c => c.status === 'Expiring Soon').length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {cs.contracts.filter(c => c.status === 'Expiring Soon').length} Expiring Soon
                              </span>
                            )}
                            {cs.contracts.filter(c => c.status === 'Expired').length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                <Clock className="w-2.5 h-2.5" />
                                {cs.contracts.filter(c => c.status === 'Expired').length} Expired
                              </span>
                            )}

                            {cs.contracts.some(c => c.responsible) && (
                              <span className="text-[10px] text-slate-400 font-medium ml-1">
                                • Resp: {Array.from(new Set(cs.contracts.map(c => c.responsible).filter(Boolean))).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold flex-shrink-0">
                        <div className="w-24 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#82A094]/15 text-[#546A7A] text-[10px] font-bold">
                            {cs.zoneName || '—'}
                          </span>
                        </div>

                        <div className="w-24 text-center">
                          <span className="text-slate-700 font-extrabold">{cs.totalContracts}</span>
                          {cs.activeContracts > 0 && (
                            <span className="text-emerald-600 text-[10px] block font-bold">{cs.activeContracts} Active</span>
                          )}
                        </div>

                        <div className="w-32 flex flex-col items-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <span className={`font-extrabold ${cs.pmPercentage >= 75 ? 'text-emerald-600' : cs.pmPercentage >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {cs.pmPercentage}%
                            </span>
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
                          {cs.pmOverdue > 0 && (
                            <span className="text-rose-600 font-bold text-[9px] mt-0.5 uppercase tracking-wider">{cs.pmOverdue} Overdue</span>
                          )}
                        </div>

                        <div className="w-32 text-right">
                          <span className="text-sm font-extrabold text-slate-800">{formatCurrency(cs.totalValue)}</span>
                          <span className="text-[10px] text-slate-400 block font-medium">{cs.totalMachines} Machine{cs.totalMachines !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="w-8 flex justify-center">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#82A094]" />
                          Contracts details for {cs.customerName} ({cs.contracts.length})
                        </h4>
                        <div className="space-y-3">
                          {cs.contracts.map((contract, cIdx) => {
                            const daysLeft = getDaysRemaining(contract.endDate);
                            return (
                              <div key={`c-${contract.id}`} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center text-white text-xs font-bold">
                                      {cIdx + 1}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-extrabold text-slate-800 text-xs">{contract.contractNumber}</span>
                                        {contract.poNo && <span className="text-[10px] font-semibold text-slate-400">(PO: {contract.poNo})</span>}
                                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getStatusBadge(contract.status)}`}>
                                          {contract.status}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getSlaColor(contract.mcType)}`}>
                                          {contract.mcType}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-400 mt-1 flex gap-3">
                                        <span>End Date: <strong className="text-slate-600 font-semibold">{formatDate(contract.endDate)}</strong></span>
                                        <span>•</span>
                                        <span className={daysLeft <= 0 ? 'text-rose-600 font-bold' : daysLeft <= 30 ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                                          {daysLeft < 0 ? `Overdue by ${Math.abs(daysLeft)} Days` : `${daysLeft} Days Remaining`}
                                        </span>
                                        <span>•</span>
                                        <span>Responsible: <strong className="text-slate-600 font-semibold">{contract.responsible || '—'}</strong></span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 justify-between lg:justify-end">
                                    <div className="flex gap-1 items-center">
                                      {contract.pmSchedules.map((p, pidx) => {
                                        if (p.status === 'Not Applicable') return null;
                                        const done = p.status === 'Completed';
                                        const overdue = !done && p.range && isRangeOverdue(p.range);
                                        return (
                                          <div
                                            key={pidx}
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold border transition-all ${
                                              done
                                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                                                : overdue
                                                ? 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                                                : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                                            }`}
                                            title={`PM Visit ${p.pmNumber}: ${p.status}\nRange: ${p.range}`}
                                          >
                                            {done ? '✓' : overdue ? '!' : p.pmNumber}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="text-right">
                                      <div className="text-xs font-extrabold text-slate-800">{formatCurrency(contract.amount)}</div>
                                      <div className="text-[10px] text-slate-400 font-medium">{contract.noOfMachine} Machine{contract.noOfMachine !== 1 ? 's' : ''}</div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => router.push(`${getBaseRoute()}/contracts/${contract.id}`)}
                                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-55 text-[10px] font-bold text-slate-600 transition-colors"
                                    >
                                      Open Agreement
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {contract.pmSchedules.map((p, pidx) => {
                                    if (p.status === 'Not Applicable') return null;
                                    const done = p.status === 'Completed';
                                    const overdue = !done && p.range && isRangeOverdue(p.range);
                                    return (
                                      <div
                                        key={pidx}
                                        className={`px-3 py-2 rounded-xl border flex justify-between items-center text-[11px] ${
                                          done
                                            ? 'bg-emerald-500/5 border-emerald-500/15'
                                            : overdue
                                            ? 'bg-rose-500/5 border-rose-500/15'
                                            : 'bg-slate-50/50 border-slate-100'
                                        }`}
                                      >
                                        <div className="min-w-0">
                                          <span className={`font-bold block text-[9px] uppercase tracking-wider ${
                                            done ? 'text-emerald-700' : overdue ? 'text-rose-700' : 'text-slate-400'
                                          }`}>
                                            PM Cycle {p.pmNumber}
                                          </span>
                                          <span className="font-mono text-slate-500 text-[10px] truncate block">{p.range}</span>
                                          {done && p.completedAt && (
                                            <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">
                                              Done: {formatDate(p.completedAt)}
                                            </span>
                                          )}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${
                                          done
                                            ? 'bg-emerald-500/10 text-emerald-700'
                                            : overdue
                                            ? 'bg-rose-500/10 text-rose-700'
                                            : 'bg-amber-500/10 text-amber-700'
                                        }`}>
                                          {done ? '✓ Done' : overdue ? '! Overdue' : 'Pending'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ═══ FOOTER INFO ═══ */}
      <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/50 flex gap-2 items-center text-xs text-slate-500 print:hidden">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p>This report groups contracts by customer. Click any customer row to expand and view individual agreements and detailed PM schedules.</p>
      </div>
    </div>
  );
}
