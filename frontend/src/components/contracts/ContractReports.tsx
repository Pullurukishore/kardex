'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  BarChart3, FileText, Search, Download, Calendar,
  CheckCircle, AlertTriangle, Clock, MapPin,
  Building2, IndianRupee, ShieldCheck,
  TrendingUp, ChevronDown, ChevronUp,
  ArrowUpDown, ExternalLink, X,
  Layers, Settings2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { getCustomerColorClass, normalizeEngineerNames, formatEngineerDisplayName, extractDepartmentFromCustomer } from '@/lib/utils';
import { generateContractReportPdf } from '@/lib/contract-report-pdf';
import { generateContractReportExcel } from '@/lib/contract-report-excel';

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

type SortKey = 'customerName' | 'totalValue' | 'totalContracts' | 'totalMachines' | 'pmPercentage' | 'zoneName';
type SortDir = 'asc' | 'desc';

export default function ContractReports({ role }: ContractReportsProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string | number>>(new Set());
  const [showFilters, setShowFilters] = useState(true);

  const toggleExpand = (id: string | number) => {
    setExpandedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandedCustomerIds.size === customerSummaries.length) {
      setExpandedCustomerIds(new Set());
    } else {
      setExpandedCustomerIds(new Set(customerSummaries.map(cs => cs.customerId || cs.customerName)));
    }
  };

  // Filters
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [pmFilter, setPmFilter] = useState('all');
  const [mcTypeFilter, setMcTypeFilter] = useState('all');
  const [swFilter, setSwFilter] = useState('all');

  // Date range filter (default: today → today + 4 weeks)
  const [dateFilterBasis, setDateFilterBasis] = useState<'both' | 'pm' | 'expiry'>('pm');
  const [dateFrom, setDateFrom] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    fetchContracts();
  }, []);

  // Quick Date Range Presets
  const applyDatePreset = (preset: '4_weeks' | 'today' | 'this_month' | 'next_month' | 'this_quarter' | 'all') => {
    const now = new Date();
    if (preset === '4_weeks') {
      const todayStr = now.toISOString().slice(0, 10);
      const d = new Date();
      d.setDate(d.getDate() + 28);
      setDateFrom(todayStr);
      setDateTo(d.toISOString().slice(0, 10));
    } else if (preset === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'this_month') {
      const y = now.getFullYear(), m = now.getMonth();
      setDateFrom(new Date(y, m, 1).toISOString().slice(0, 10));
      setDateTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
    } else if (preset === 'next_month') {
      const y = now.getFullYear(), m = now.getMonth() + 1;
      setDateFrom(new Date(y, m, 1).toISOString().slice(0, 10));
      setDateTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
    } else if (preset === 'this_quarter') {
      const y = now.getFullYear(), q = Math.floor(now.getMonth() / 3);
      setDateFrom(new Date(y, q * 3, 1).toISOString().slice(0, 10));
      setDateTo(new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10));
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const filters = {
        zone: zoneFilter !== 'all' ? zoneFilter : 'All',
        status: statusFilter !== 'all' ? statusFilter : 'All',
        responsible: techFilter !== 'all' ? techFilter : 'All',
        mcType: mcTypeFilter !== 'all' ? mcTypeFilter : 'All',
        dateFrom,
        dateTo
      };

      if (format === 'pdf') {
        await generateContractReportPdf(customerSummaries, selectedSummary, filters);
        toast.success('Contract Schedule PDF Report exported successfully!');
      } else {
        await generateContractReportExcel(customerSummaries, selectedSummary, filters);
        toast.success('Contract Portfolio Excel Report exported successfully!');
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error(`Failed to export ${format.toUpperCase()} report`);
    } finally {
      setExporting(false);
    }
  };

  // Sorting for Customers
  const [sortKey, setSortKey] = useState<SortKey>('customerName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Fetch contracts
  const fetchContracts = async () => {
    setLoading(true);
    setHasGenerated(true);
    try {
      const params: any = { limit: 10000 };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      params.dateFilterType = dateFilterBasis;
      const data = await apiService.getContracts(params);
      const list = Array.isArray(data) ? data : (data?.contracts || data?.data || []);
      setContracts(list);
    } catch (err: any) {
      console.error('Failed to fetch contracts', err);
      toast.error('Failed to load contracts data');
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  const parseDateObj = (str: string): Date | null => {
    if (!str) return null;
    str = str.trim();

    // Check DD/MM/YYYY or DD.MM.YYYY
    const slashDot = str.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/);
    if (slashDot) {
      const d = parseInt(slashDot[1], 10);
      const m = parseInt(slashDot[2], 10) - 1;
      let y = parseInt(slashDot[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, m, d);
    }

    // Check YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    // Check DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (dmyMatch) {
      let y = parseInt(dmyMatch[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    }

    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  };

  // Extracts the PM visit end date from range string (e.g. "11/08/2026 TO 31/08/2026" -> 31/08/2026)
  const getPMEndDate = (pmRange: string | null | undefined): Date | null => {
    if (!pmRange) return null;
    const parts = pmRange.split(/\s+(?:TO|to|-)\s+/);
    const endStr = parts.length >= 2 ? parts[parts.length - 1]?.trim() : parts[0]?.trim();
    return parseDateObj(endStr);
  };

  // Checks if the PM visit ENDS between dateFrom and dateTo
  const isPMEndDateInRange = (pmRange: string | null | undefined, dateFrom?: string, dateTo?: string): boolean => {
    if (!dateFrom && !dateTo) return true;
    const endObj = getPMEndDate(pmRange);
    if (!endObj) return false;

    if (dateFrom) {
      const fromObj = new Date(dateFrom);
      fromObj.setHours(0, 0, 0, 0);
      if (endObj < fromObj) return false;
    }

    if (dateTo) {
      const toObj = new Date(dateTo);
      toObj.setHours(23, 59, 59, 999);
      if (endObj > toObj) return false;
    }

    return true;
  };

  const isRangeOverdue = (range: string): boolean => {
    try {
      const endObj = getPMEndDate(range);
      if (!endObj) return false;
      return endObj < now;
    } catch { return false; }
  };

  const parseRangeDates = (range: string | null | undefined): { startDate: string; endDate: string } => {
    if (!range) return { startDate: '—', endDate: '—' };
    const parts = range.split(/\s+(?:TO|to|-)\s+/);
    if (parts.length >= 2) {
      return {
        startDate: parts[0]?.trim() || '—',
        endDate: parts[parts.length - 1]?.trim() || '—'
      };
    }
    return { startDate: range.trim(), endDate: '—' };
  };

  const getPMStats = (pmSchedules: PMSchedule[], dFrom?: string, dTo?: string) => {
    const applicable = pmSchedules.filter(p => p.status !== 'Not Applicable');
    if (dFrom || dTo) {
      const pendingInRange = applicable.filter(p => p.status !== 'Completed' && isPMEndDateInRange(p.range, dFrom, dTo));
      const overdue = pendingInRange.filter(p => p.range && isRangeOverdue(p.range)).length;
      return {
        completed: 0,
        total: pendingInRange.length,
        pending: pendingInRange.length,
        overdue,
        pct: 0
      };
    }
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
    const set = new Set<string>();
    contracts.forEach(c => {
      normalizeEngineerNames(c.responsible).forEach(name => set.add(name));
    });
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
    <span className="inline-flex items-center ml-1">
      {sortKey === col ? (
        sortDir === 'asc' ? (
          <ChevronUp className="w-3.5 h-3.5 text-white" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-white" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 text-white/40 group-hover:text-white/80 transition-colors" />
      )}
    </span>
  );

  // 1. CUSTOMER PORTFOLIO DATA
  const customerSummaries = useMemo(() => {
    let filtered = [...contracts];

    // Date range filter on PM schedule dates AND/OR contract expiry
    if (dateFrom || dateTo) {
      filtered = filtered.filter(c => {
        // 1. Check PM Visit match in range (only pending visits whose window ends in range)
        const applicablePMs = (c.pmSchedules || []).filter(p => p.status !== 'Not Applicable');
        const hasPMMatch = applicablePMs.some(p => p.status !== 'Completed' && isPMEndDateInRange(p.range, dateFrom, dateTo));

        // 2. Check Contract Expiry match in range
        let hasExpiryMatch = false;
        if (c.endDate) {
          const end = new Date(c.endDate);
          if (!isNaN(end.getTime())) {
            let fromOk = true;
            let toOk = true;
            if (dateFrom) {
              const from = new Date(dateFrom);
              from.setHours(0, 0, 0, 0);
              fromOk = end >= from;
            }
            if (dateTo) {
              const to = new Date(dateTo);
              to.setHours(23, 59, 59, 999);
              toOk = end <= to;
            }
            hasExpiryMatch = fromOk && toOk;
          }
        }

        if (dateFilterBasis === 'pm') return hasPMMatch;
        if (dateFilterBasis === 'expiry') return hasExpiryMatch;
        return hasPMMatch || hasExpiryMatch; // 'both'
      });
    }

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
    if (techFilter !== 'all') {
      const tf = techFilter.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.responsible && (
          c.responsible.toLowerCase().includes(tf) ||
          c.responsible.split(/[\/,]+/).map(r => r.trim().toLowerCase()).includes(tf)
        )
      );
    }
    if (mcTypeFilter !== 'all') filtered = filtered.filter(c => c.mcType === mcTypeFilter);
    if (swFilter === 'yes') filtered = filtered.filter(c => c.softwareSupport);
    if (swFilter === 'no') filtered = filtered.filter(c => !c.softwareSupport);

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

      const stats = getPMStats(c.pmSchedules, dateFrom, dateTo);
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
        case 'totalMachines':
          av = a.totalMachines;
          bv = b.totalMachines;
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
  }, [contracts, search, zoneFilter, statusFilter, techFilter, mcTypeFilter, swFilter, pmFilter, sortKey, sortDir, dateFrom, dateTo, dateFilterBasis]);



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

  const activeFilterCount = [
    zoneFilter !== 'all',
    statusFilter !== 'all',
    techFilter !== 'all',
    pmFilter !== 'all',
    mcTypeFilter !== 'all',
    swFilter !== 'all',
    !!search,
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setSearch('');
    setZoneFilter('all');
    setStatusFilter('all');
    setTechFilter('all');
    setPmFilter('all');
    setMcTypeFilter('all');
    setSwFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-4 print:space-y-2">
      {/* ═══ COMPACT TOOLBAR: Generate + Filters Toggle + Export ═══ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm print:hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={fetchContracts}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-[#546A7A] hover:bg-[#435562] text-white font-bold py-2.5 px-5 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <BarChart3 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Generate'}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                showFilters
                  ? 'bg-slate-100 border-slate-300 text-slate-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#546A7A] text-white text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting || loading || customerSummaries.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#4F6A64] text-[#4F6A64] hover:bg-[#4F6A64]/5 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting || loading || customerSummaries.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#9E3B47] text-[#9E3B47] hover:bg-[#9E3B47]/5 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="px-5 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Date Range Row */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date Basis
                  </label>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
                    {(['both', 'pm', 'expiry'] as const).map(basis => (
                      <button
                        key={basis}
                        type="button"
                        onClick={() => setDateFilterBasis(basis)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          dateFilterBasis === basis
                            ? 'bg-[#546A7A] text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {basis === 'both' ? 'Both' : basis === 'pm' ? 'PM' : 'Expiry'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 bg-white font-medium w-[145px]"
                  />
                  <span className="text-slate-300 text-xs">→</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 bg-white font-medium w-[145px]"
                  />
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="flex items-center gap-1 flex-wrap pb-0.5">
                {[
                  { key: '4_weeks' as const, label: '4 Weeks' },
                  { key: 'this_month' as const, label: 'This Month' },
                  { key: 'next_month' as const, label: 'Next Month' },
                  { key: 'this_quarter' as const, label: 'Quarter' },
                  { key: 'all' as const, label: 'All' },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyDatePreset(p.key)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      p.key === 'all' && !dateFrom && !dateTo
                        ? 'bg-[#546A7A] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => applyDatePreset('all')}
                    className="text-[11px] text-slate-400 hover:text-rose-500 font-medium ml-1 flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
              {/* Search */}
              <div className="space-y-0.5 col-span-2 sm:col-span-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Customer, PO..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#82A094]/30"
                  />
                </div>
              </div>

              {/* Zone */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Zone</label>
                <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                  <option value="all">All</option>
                  {uniqueZones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>

              {/* Status */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                  <option value="all">All</option>
                  <option value="Active">Active</option>
                  <option value="Expiring Soon">Expiring</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              {/* Engineer */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Engineer</label>
                <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                  <option value="all">All</option>
                  {uniqueTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* MC Type */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">MC Type</label>
                <select value={mcTypeFilter} onChange={(e) => setMcTypeFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                  <option value="all">All</option>
                  {uniqueMcTypes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* PM Status */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">PM Status</label>
                <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                  <option value="all">All</option>
                  <option value="completed">100% Done</option>
                  <option value="on-track">On Track (≥50%)</option>
                  <option value="behind">Behind (&lt;50%)</option>
                  <option value="overdue">Overdue</option>
                  <option value="not-started">Not Started</option>
                </select>
              </div>

              {/* SW Support */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">SW</label>
                <select value={swFilter} onChange={(e) => setSwFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                  <option value="all">All</option>
                  <option value="yes">With SW</option>
                  <option value="no">Without SW</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ NOT GENERATED STATE ═══ */}
      {!hasGenerated && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-xl bg-[#546A7A]/10 text-[#546A7A] flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Ready to Generate</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Set your filters above and click &quot;Generate&quot; to view contract analytics.
          </p>
          <button
            onClick={fetchContracts}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-[#546A7A] hover:bg-[#435562] text-white font-bold py-2.5 px-5 rounded-lg shadow-sm transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      )}

      {/* ═══ KPI STRIP + TABLE (ONLY AFTER GENERATING) ═══ */}
      {hasGenerated && (
        <>
          {/* Compact KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#82A094]/10 flex items-center justify-center text-[#82A094] flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Customers</p>
                <p className="text-base font-extrabold text-slate-800">{selectedSummary.totalCustomers}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Agreements</p>
                <p className="text-base font-extrabold text-slate-800">{selectedSummary.totalContracts}</p>
                <span className="text-[9px] text-emerald-600 font-bold">{selectedSummary.active} Active</span>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                <IndianRupee className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Value</p>
                <p className="text-base font-extrabold text-slate-800">{formatCurrency(selectedSummary.totalValue || 0)}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active / Expiring</p>
                <p className="text-base font-extrabold text-slate-800">
                  {selectedSummary.active} <span className="text-amber-600 text-xs font-bold">/ {selectedSummary.expiring}</span>
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 flex-shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {(dateFrom || dateTo) ? 'Pending PMs' : 'PM Done'}
                </p>
                <p className="text-base font-extrabold text-indigo-600">
                  {(dateFrom || dateTo) ? selectedSummary.pmTotal : `${selectedSummary.pmPct}%`}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                selectedSummary.pmOverdue > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 text-slate-400'
              }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Overdue</p>
                <p className={`text-base font-extrabold ${selectedSummary.pmOverdue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {selectedSummary.pmOverdue}
                </p>
              </div>
            </div>
          </div>

          {/* ═══ MAIN TABLE ═══ */}
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm">
              <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-semibold">Loading contract analytics...</p>
            </div>
          ) : customerSummaries.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-slate-500 text-sm font-medium">No contracts match current filters.</p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Table Toolbar */}
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#546A7A] text-white text-[11px] font-bold">
                    {customerSummaries.length}
                  </span>
                  <span className="font-semibold text-slate-700">Accounts</span>
                  <span className="text-slate-300">•</span>
                  <span>
                    <strong className="text-slate-800">{selectedSummary.totalContracts}</strong> Agreements
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    <strong className="text-slate-800">{selectedSummary.totalMachines}</strong> Machines
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Value: <strong className="text-slate-900">{formatCurrency(selectedSummary.totalValue)}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all shadow-xs flex-shrink-0"
                  title={expandedCustomerIds.size === customerSummaries.length ? 'Collapse All' : 'Expand All'}
                >
                  <Layers className="w-3.5 h-3.5 text-[#546A7A]" />
                  {expandedCustomerIds.size === customerSummaries.length ? 'Collapse All' : 'Expand All'}
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1050px]">
                  <thead>
                    <tr className="bg-[#546A7A] text-white text-[11px] font-bold uppercase tracking-wider select-none border-b border-[#435562]">
                      <th className="py-2.5 px-3 text-center w-10 text-white/80">#</th>
                      <th
                        className="py-2.5 px-4 cursor-pointer hover:bg-white/10 transition-colors group"
                        onClick={() => handleSort('customerName')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Customer</span>
                          <SortIcon col="customerName" />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 text-center w-20 cursor-pointer hover:bg-white/10 transition-colors group"
                        onClick={() => handleSort('zoneName')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Zone</span>
                          <SortIcon col="zoneName" />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 text-center w-24 cursor-pointer hover:bg-white/10 transition-colors group"
                        onClick={() => handleSort('totalContracts')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Contracts</span>
                          <SortIcon col="totalContracts" />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 text-center w-24 cursor-pointer hover:bg-white/10 transition-colors group"
                        onClick={() => handleSort('totalMachines')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Machines</span>
                          <SortIcon col="totalMachines" />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-4 text-right w-32 cursor-pointer hover:bg-white/10 transition-colors group"
                        onClick={() => handleSort('totalValue')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Value</span>
                          <SortIcon col="totalValue" />
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-4 text-center w-40 cursor-pointer hover:bg-white/10 transition-colors group"
                        onClick={() => handleSort('pmPercentage')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>{(dateFrom || dateTo) ? 'Pending PMs' : 'PM %'}</span>
                          <SortIcon col="pmPercentage" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-left w-40 text-white/90">Engineers</th>
                      <th className="py-2.5 px-2 text-center w-12 text-white/80"></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {customerSummaries.map((cs, idx) => {
                      const custId = cs.customerId || cs.customerName;
                      const isExpanded = expandedCustomerIds.has(custId);
                      const engNames = Array.from(new Set(cs.contracts.flatMap(c => normalizeEngineerNames(c.responsible)))).filter(Boolean);
                      const engText = engNames.join(', ');
                      const uniqueSlas = Array.from(new Set(cs.contracts.map(c => c.mcType).filter(Boolean)));
                      const expiringCount = cs.contracts.filter(c => c.status === 'Expiring Soon').length;
                      const expiredCount = cs.contracts.filter(c => c.status === 'Expired').length;

                      return (
                        <Fragment key={`cust-${custId}-${idx}`}>
                          {/* Customer Row */}
                          <tr
                            onClick={() => toggleExpand(custId)}
                            className={`group cursor-pointer transition-colors duration-150 ${
                              isExpanded
                                ? 'bg-[#546A7A]/[0.04] font-medium border-l-[3px] border-l-[#82A094]'
                                : idx % 2 === 1
                                ? 'bg-slate-50/50 hover:bg-[#82A094]/[0.04]'
                                : 'bg-white hover:bg-[#82A094]/[0.04]'
                            }`}
                          >
                            <td className="py-3 px-3 text-center font-bold text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Customer */}
                            <td className="py-3 px-4 min-w-[220px]">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${getCustomerColorClass(cs.customerName)} flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0`}>
                                  {(cs.customerName || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 text-xs hover:text-[#546A7A] transition-colors truncate max-w-[200px]">
                                      {cs.customerName || 'Unassigned'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`${getBaseRoute()}/customers/${cs.customerId}`);
                                      }}
                                      className="text-slate-300 hover:text-[#82A094] p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Open Customer"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span className="truncate">{cs.place || '—'}</span>
                                    {uniqueSlas.length > 0 && (
                                      <>
                                        <span className="text-slate-200">|</span>
                                        {uniqueSlas.map(sla => (
                                          <span key={sla} className={`px-1 py-px rounded text-[8px] font-bold ${getSlaColor(sla)}`}>
                                            {sla}
                                          </span>
                                        ))}
                                      </>
                                    )}
                                    {cs.hasSoftwareSupport && (
                                      <span className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        <ShieldCheck className="w-2 h-2" />SW
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Zone */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                {cs.zoneName || '—'}
                              </span>
                            </td>

                            {/* Contracts */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="font-extrabold text-slate-800 text-sm">{cs.totalContracts}</span>
                              <div className="flex items-center justify-center gap-1 text-[9px] font-bold mt-0.5">
                                <span className="text-emerald-600">{cs.activeContracts}A</span>
                                {expiringCount > 0 && <span className="text-amber-600">{expiringCount}E</span>}
                                {expiredCount > 0 && <span className="text-rose-600">{expiredCount}X</span>}
                              </div>
                            </td>

                            {/* Machines */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="font-extrabold text-slate-800 text-sm">{cs.totalMachines}</span>
                            </td>

                            {/* Value */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="font-extrabold text-slate-900 text-xs font-mono">
                                {formatCurrency(cs.totalValue)}
                              </div>
                              <div className="text-[9px] text-slate-400">
                                {selectedSummary.totalValue > 0
                                  ? `${((cs.totalValue / selectedSummary.totalValue) * 100).toFixed(1)}%`
                                  : '—'}
                              </div>
                            </td>

                            {/* PM */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {(dateFrom || dateTo) ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-bold text-[#546A7A] text-xs">
                                    {cs.pmTotal} Pending
                                  </span>
                                  {cs.pmOverdue > 0 && (
                                    <span className="text-[9px] text-rose-600 font-bold">{cs.pmOverdue} Overdue</span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className={`font-extrabold text-xs ${
                                    cs.pmPercentage >= 75 ? 'text-emerald-600' : cs.pmPercentage >= 40 ? 'text-amber-600' : 'text-rose-600'
                                  }`}>
                                    {cs.pmPercentage}%
                                  </span>
                                  <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${cs.pmPercentage}%`,
                                        background: cs.pmPercentage >= 75 ? '#10b981' : cs.pmPercentage >= 40 ? '#f59e0b' : '#ef4444',
                                      }}
                                    />
                                  </div>
                                  {cs.pmOverdue > 0 && (
                                    <span className="text-[9px] text-rose-600 font-bold">!{cs.pmOverdue}</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Engineers */}
                            <td className="py-3 px-3 text-left">
                              <span className="text-xs text-slate-600 font-medium truncate block max-w-[150px]" title={engText}>
                                {engText || '—'}
                              </span>
                            </td>

                            {/* Chevron */}
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                                  isExpanded
                                    ? 'bg-[#546A7A] text-white border-[#546A7A]'
                                    : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Sub-Table */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                              <td colSpan={9} className="p-3 sm:p-4">
                                <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden animate-in fade-in duration-200">
                                  <div className="px-4 py-2 bg-gradient-to-r from-slate-100 via-slate-50 to-white border-b border-slate-200 flex items-center justify-between">
                                    <h4 className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-[#82A094]" />
                                      <span className="text-[#546A7A]">{cs.customerName}</span> — {cs.contracts.length} agreements
                                    </h4>
                                    <button
                                      type="button"
                                      onClick={() => router.push(`${getBaseRoute()}/customers/${cs.customerId}`)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#546A7A] hover:text-[#82A094] transition-colors"
                                    >
                                      Account <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100/90 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                          <th className="py-2 px-3 text-center w-8">#</th>
                                          <th className="py-2 px-3">Contract / PO</th>
                                          <th className="py-2 px-3">Dept</th>
                                          <th className="py-2 px-3 text-center">MC Type</th>
                                          <th className="py-2 px-3">Period</th>
                                          <th className="py-2 px-3 text-center">MC</th>
                                          <th className="py-2 px-3 text-right">Amount</th>
                                          <th className="py-2 px-3">PM Cycles</th>
                                          <th className="py-2 px-3 text-center">Status</th>
                                          <th className="py-2 px-3">Engineer</th>
                                          <th className="py-2 px-3 text-center w-14"></th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {cs.contracts.map((contract, cIdx) => {
                                          const daysLeft = getDaysRemaining(contract.endDate);
                                          const dept = extractDepartmentFromCustomer(contract.customerName, cs.customerName);
                                          return (
                                            <tr key={contract.id} className="hover:bg-slate-50/80 transition-colors">
                                              <td className="py-2 px-3 text-center font-bold text-slate-400 text-[10px]">
                                                {cIdx + 1}
                                              </td>
                                              <td className="py-2 px-3">
                                                <div className="font-bold text-slate-800 text-[11px]">
                                                  {contract.contractNumber}
                                                </div>
                                                {contract.poNo && (
                                                  <div className="text-[10px] text-slate-400">PO: {contract.poNo}</div>
                                                )}
                                              </td>
                                              <td className="py-2 px-3">
                                                {dept && dept !== '—' ? (
                                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold">
                                                    {dept}
                                                  </span>
                                                ) : <span className="text-slate-400">—</span>}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSlaColor(contract.mcType)}`}>
                                                  {contract.mcType}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 whitespace-nowrap">
                                                <div className="text-[11px] text-slate-700">
                                                  {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                                                </div>
                                                <span className={`text-[9px] font-bold ${
                                                  daysLeft < 0 ? 'text-rose-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-emerald-600'
                                                }`}>
                                                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-center font-bold text-slate-700">
                                                {contract.noOfMachine}
                                              </td>
                                              <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono text-[11px]">
                                                {formatCurrency(contract.amount)}
                                              </td>
                                              <td className="py-2 px-3">
                                                <div className="flex flex-wrap gap-0.5 items-center">
                                                  {contract.pmSchedules.map((p, pidx) => {
                                                    if (p.status === 'Not Applicable') return null;
                                                    const done = p.status === 'Completed';
                                                    const overdue = !done && p.range && isRangeOverdue(p.range);
                                                    return (
                                                      <span
                                                        key={pidx}
                                                        className={`px-1 py-px rounded text-[8px] font-bold border ${
                                                          done
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : overdue
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}
                                                        title={`PM ${p.pmNumber}: ${p.status}\n${p.range || 'N/A'}`}
                                                      >
                                                        {done ? `${p.pmNumber}✓` : overdue ? `${p.pmNumber}!` : `${p.pmNumber}⏳`}
                                                      </span>
                                                    );
                                                  })}
                                                </div>
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${getStatusBadge(contract.status)}`}>
                                                  {contract.status}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-slate-600 text-[11px]">
                                                {formatEngineerDisplayName(contract.responsible) || '—'}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <button
                                                  type="button"
                                                  onClick={() => router.push(`${getBaseRoute()}/contracts/${contract.id}`)}
                                                  className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-600 transition-colors"
                                                >
                                                  Open
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>

                  {/* Footer Totals */}
                  <tfoot className="bg-[#546A7A] text-white border-t border-[#435562] text-xs font-bold select-none">
                    <tr>
                      <td className="py-3 px-3 text-center font-bold text-white/70">Σ</td>
                      <td className="py-3 px-4 font-bold text-white">
                        TOTAL ({customerSummaries.length} Accounts)
                      </td>
                      <td className="py-3 px-3 text-center text-white/50">—</td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-extrabold text-white text-sm">{selectedSummary.totalContracts}</div>
                        <div className="text-[9px] text-emerald-300">{selectedSummary.active} Active</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-extrabold text-white text-sm">{selectedSummary.totalMachines}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-extrabold text-white text-sm font-mono">{formatCurrency(selectedSummary.totalValue)}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {(dateFrom || dateTo) ? (
                          <div>
                            <span className="font-bold text-white text-xs">{selectedSummary.pmTotal} Pending</span>
                            {selectedSummary.pmOverdue > 0 && (
                              <span className="text-rose-300 text-[9px] block font-bold">{selectedSummary.pmOverdue} Overdue</span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-white text-xs">{selectedSummary.pmCompleted}/{selectedSummary.pmTotal} ({selectedSummary.pmPct}%)</span>
                            {selectedSummary.pmOverdue > 0 && (
                              <span className="text-rose-300 text-[9px] block font-bold">{selectedSummary.pmOverdue} Overdue</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-white/50">—</td>
                      <td className="py-3 px-2 text-center text-white/50"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
