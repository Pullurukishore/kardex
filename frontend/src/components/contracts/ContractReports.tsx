'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, FileText, Search, Download, Calendar,
  CheckCircle, AlertTriangle, Clock, MapPin,
  Building2, IndianRupee, ShieldCheck,
  TrendingUp, ChevronDown, ChevronUp,
  ArrowUpDown, ExternalLink, X,
  Settings2, RefreshCw
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
  status: 'Active' | 'Expired';
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

  // Filters
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [pmFilter, setPmFilter] = useState('all');
  const [mcTypeFilter, setMcTypeFilter] = useState('all');
  const [swFilter, setSwFilter] = useState('all');

  // Date range filter (default: today  →  today + 4 weeks)
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

  // Extracts the PM visit start date from range string
  const getPMStartDate = (pmRange: string | null | undefined): Date | null => {
    if (!pmRange) return null;
    const parts = pmRange.split(/\s+(?:TO|to|-)\s+/);
    return parseDateObj(parts[0]?.trim());
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

  // Checks if the PM visit ENDS between dateFrom and dateTo (strictly based on PM end date)
  const isPMInRange = (pm: PMSchedule, dFrom?: string, dTo?: string): boolean => {
    return isPMEndDateInRange(pm.range, dFrom, dTo);
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
      const inRange = applicable.filter(p => isPMInRange(p, dFrom, dTo));
      const completed = inRange.filter(p => p.status === 'Completed').length;
      const total = inRange.length;
      const pending = total - completed;
      const overdue = inRange.filter(p => p.status !== 'Completed' && p.range && isRangeOverdue(p.range)).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        completed,
        total,
        pending,
        overdue,
        pct
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

  const formatPeriodDate = (iso: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString('en-IN', { month: 'short' });
      const year = String(d.getFullYear()).slice(-2);
      return `${day} ${month} '${year}`;
    } catch {
      return '—';
    }
  };

  const formatCompactDate = (dStr: string | null | undefined) => {
    if (!dStr || dStr === '—') return '—';
    const trimmed = dStr.trim();
    const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-]20(\d{2})$/);
    if (m) return `${m[1]}/${m[2]}/${m[3]}`;
    const m2 = trimmed.match(/^20(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;
    const m3 = trimmed.match(/^(\d{1,2}\s+[A-Za-z]{3})\s+20(\d{2})$/);
    if (m3) return `${m3[1]} '${m3[2]}`;
    return trimmed;
  };

  const formatCurrency = (val: number) => `\u20B9${Number(val || 0).toLocaleString('en-IN')}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
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
        // 1. Check PM Visit match in range
        const applicablePMs = (c.pmSchedules || []).filter(p => p.status !== 'Not Applicable');
        const hasPMMatch = applicablePMs.some(p => isPMInRange(p, dateFrom, dateTo));

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
      filtered = filtered.filter(c => {
        if (!c.responsible) return false;
        const normalizedList = normalizeEngineerNames(c.responsible);
        return normalizedList.includes(techFilter);
      });
    }
    if (mcTypeFilter !== 'all') filtered = filtered.filter(c => c.mcType === mcTypeFilter);
    if (swFilter === 'yes') filtered = filtered.filter(c => c.softwareSupport);
    if (swFilter === 'no') filtered = filtered.filter(c => !c.softwareSupport);

    if (pmFilter !== 'all') {
      filtered = filtered.filter(c => {
        const { pct, overdue, pending } = getPMStats(c.pmSchedules, dateFrom, dateTo);
        if (pmFilter === 'pending') return pending > 0;
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
    let active = 0, expired = 0;
    let pmCompleted = 0, pmTotal = 0, pmOverdue = 0;

    customerSummaries.forEach(cs => {
      totalValue += cs.totalValue;
      totalMachines += cs.totalMachines;
      totalContracts += cs.totalContracts;
      active += cs.activeContracts;
      expired += cs.expiredContracts;
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
    <div className="w-full space-y-4 print:space-y-3">
      {/* === REPORT GENERATION CONTROLS — Card Layout (Matches Annual Contract Reports) === */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        {/* Card Header — Title + Generate + Export Buttons */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Report Filters</h2>
              <p className="text-sm text-slate-500 mt-1">Configure parameters for contract portfolios and PM schedule report</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={fetchContracts}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#6F8A9D] hover:bg-[#546A7A] text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                <BarChart3 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={exporting || loading || customerSummaries.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[#4F6A64] text-[#4F6A64] hover:bg-[#A2B9AF]/10 font-semibold text-sm transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                  Export Excel
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exporting || loading || customerSummaries.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[#9E3B47] text-[#9E3B47] hover:bg-[#E17F70]/10 font-semibold text-sm transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4" />
                  Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card Content — Filters */}
        <div className="px-6 py-5 space-y-4">
          {/* Date Range Row */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  Contract Date Range
                </label>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 px-2">Basis:</span>
                  {(['both', 'pm', 'expiry'] as const).map(basis => (
                    <button
                      key={basis}
                      type="button"
                      onClick={() => setDateFilterBasis(basis)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${dateFilterBasis === basis
                          ? 'bg-[#546A7A] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {basis === 'both' ? 'Both' : basis === 'pm' ? 'PM Schedule' : 'Contract Expiry'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400 mr-1">Quick ranges:</span>
                <button
                  type="button"
                  onClick={() => applyDatePreset('4_weeks')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-[#6F8A9D]/15 hover:text-[#546A7A] text-slate-600 transition-colors"
                >
                  4 Weeks
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('today')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-[#6F8A9D]/15 hover:text-[#546A7A] text-slate-600 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('this_month')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-[#6F8A9D]/15 hover:text-[#546A7A] text-slate-600 transition-colors"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('next_month')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-[#6F8A9D]/15 hover:text-[#546A7A] text-slate-600 transition-colors"
                >
                  Next Month
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('this_quarter')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-[#6F8A9D]/15 hover:text-[#546A7A] text-slate-600 transition-colors"
                >
                  This Quarter
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('all')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  All Time
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-400 pointer-events-none">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full pl-14 pr-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium text-slate-700"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-400 pointer-events-none">To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Filter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Customer, PO, place..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Zone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Zone</label>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Zones</option>
                {uniqueZones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>

            {/* Contract Status */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Contract Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            {/* Responsible Engineer */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Responsible Engineer</label>
              <select
                value={techFilter}
                onChange={(e) => setTechFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Engineers</option>
                {uniqueTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Machine Type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Machine Model / Type</label>
              <select
                value={mcTypeFilter}
                onChange={(e) => setMcTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Machine Types</option>
                {uniqueMcTypes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* PM Status */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">PM Status</label>
              <select
                value={pmFilter}
                onChange={(e) => setPmFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All PM Statuses</option>
                <option value="pending">Only Pending PMs</option>
                <option value="overdue">Overdue PMs</option>
                <option value="completed">100% Completed</option>
                <option value="on-track">On Track (&ge; 50%)</option>
                <option value="behind">Behind (&lt;50%)</option>
                <option value="not-started">Not Started (0%)</option>
              </select>
            </div>

            {/* SW Support */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Software Support</label>
              <select
                value={swFilter}
                onChange={(e) => setSwFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All (With & Without SW)</option>
                <option value="yes">With Software Support</option>
                <option value="no">Without Software Support</option>
              </select>
            </div>
          </div>

          {/* Reset Controls & Active Filter Badges */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#546A7A]/10 text-[#546A7A] text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#546A7A]" />
                  {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* === NOT GENERATED STATE === */}
      {!hasGenerated && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#546A7A]/10 text-[#546A7A] flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-800">Ready to Generate Report</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Configure your filters above and click &quot;Generate Report&quot; to compile comprehensive contract portfolios and schedule analytics.
          </p>
          <button
            onClick={fetchContracts}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-[#6F8A9D] hover:bg-[#546A7A] text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
          >
            <BarChart3 className="w-5 h-5" />
            Generate Report
          </button>
        </div>
      )}

      {/* === KPI STRIP + TABLE (ONLY AFTER GENERATING) === */}
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
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active / Expired</p>
                <p className="text-base font-extrabold text-slate-800">
                  {selectedSummary.active} <span className="text-rose-500 text-xs font-bold">/ {selectedSummary.expired}</span>
                </p>
              </div>
            </div>
            <div
              onClick={() => setPmFilter(pmFilter === 'pending' ? 'all' : 'pending')}
              className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-2.5 cursor-pointer transition-all hover:border-amber-400 hover:shadow-md ${pmFilter === 'pending' ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/20' : 'border-slate-100'
                }`}
              title="Click to toggle filter: Only Pending PMs"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>{(dateFrom || dateTo) ? 'Pending PMs' : 'PM Done'}</span>
                  {pmFilter === 'pending' && <span className="text-[8px] bg-amber-600 text-white px-1 py-0.2 rounded font-bold">Active</span>}
                </p>
                <p className="text-base font-extrabold text-amber-600">
                  {(dateFrom || dateTo) ? selectedSummary.pmTotal - selectedSummary.pmCompleted : `${selectedSummary.pmPct}%`}
                </p>
              </div>
            </div>
            <div
              onClick={() => setPmFilter(pmFilter === 'overdue' ? 'all' : 'overdue')}
              className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-2.5 cursor-pointer transition-all hover:border-rose-400 hover:shadow-md ${pmFilter === 'overdue' ? 'ring-2 ring-rose-500 border-rose-400 bg-rose-50/20' : 'border-slate-100'
                }`}
              title="Click to toggle filter: Overdue PMs"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedSummary.pmOverdue > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 text-slate-400'
                }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Overdue</span>
                  {pmFilter === 'overdue' && <span className="text-[8px] bg-rose-600 text-white px-1 py-0.2 rounded font-bold">Active</span>}
                </p>
                <p className={`text-base font-extrabold ${selectedSummary.pmOverdue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {selectedSummary.pmOverdue}
                </p>
              </div>
            </div>
          </div>

          {/* === MAIN TABLE — FLAT DETAILED VIEW === */}
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
          ) : (() => {
            const flatContracts = customerSummaries.flatMap(cs =>
              cs.contracts.map(c => ({ ...c, _customer: cs }))
            );

            return (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
                {/* Table Toolbar */}
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#546A7A] text-white text-[11px] font-bold">
                      {flatContracts.length}
                    </span>
                    <span className="font-semibold text-slate-700">Contracts</span>
                    <span className="text-slate-300 font-bold">&bull;</span>
                    <span>
                      <strong className="text-slate-800">{customerSummaries.length}</strong> Customers
                    </span>
                    <span className="text-slate-300 font-bold">&bull;</span>
                    <span>
                      <strong className="text-slate-800">{selectedSummary.totalMachines}</strong> Machines
                    </span>
                    <span className="text-slate-300 font-bold">&bull;</span>
                    <span>
                      Value: <strong className="text-slate-900">{formatCurrency(selectedSummary.totalValue)}</strong>
                    </span>
                  </div>

                  {/* Quick PM Status Filters */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden md:inline">PM:</span>
                    <button
                      type="button"
                      onClick={() => setPmFilter('all')}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${pmFilter === 'all'
                          ? 'bg-[#546A7A] text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      All PMs
                    </button>
                    <button
                      type="button"
                      onClick={() => setPmFilter(pmFilter === 'pending' ? 'all' : 'pending')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${pmFilter === 'pending'
                          ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/50'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-amber-400'
                        }`}
                    >
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>Only Pending</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPmFilter(pmFilter === 'overdue' ? 'all' : 'overdue')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${pmFilter === 'overdue'
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/50'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-rose-400'
                        }`}
                    >
                      <AlertTriangle className="w-3 h-3 text-rose-500" />
                      <span>Overdue</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPmFilter(pmFilter === 'completed' ? 'all' : 'completed')}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${pmFilter === 'completed'
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-emerald-400'
                        }`}
                    >
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      <span>Done</span>
                    </button>
                  </div>
                </div>

                {/* Flat Detailed Table */}
                {/* Flat Detailed Table - Single View (No Side Scroll) */}
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-[#546A7A] text-white text-[10px] font-bold uppercase tracking-wider select-none border-b border-[#435562]">
                        <th className="py-1 px-1 text-center w-6 text-white/80">#</th>
                        <th
                          className="py-1 px-2 cursor-pointer hover:bg-white/10 transition-colors group"
                          onClick={() => handleSort('customerName')}
                        >
                          <div className="flex items-center gap-1">
                            <span>Customer</span>
                            <SortIcon col="customerName" />
                          </div>
                        </th>
                        <th className="py-1 px-1 text-center whitespace-nowrap w-20">PO No</th>
                        <th
                          className="py-1 px-1 text-center cursor-pointer hover:bg-white/10 transition-colors group w-14"
                          onClick={() => handleSort('zoneName')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>Zone</span>
                            <SortIcon col="zoneName" />
                          </div>
                        </th>
                        <th className="py-1 px-1 text-center whitespace-nowrap w-16">MC Type</th>
                        <th
                          className="py-1 px-1 text-center cursor-pointer hover:bg-white/10 transition-colors group w-10"
                          onClick={() => handleSort('totalMachines')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>MC</span>
                            <SortIcon col="totalMachines" />
                          </div>
                        </th>
                        <th className="py-1 px-1 text-center whitespace-nowrap w-12" title="Total PM Visits for this contract">
                          Visits
                        </th>
                        <th className="py-1 px-1 whitespace-nowrap w-28">Contract Period</th>
                        <th
                          className="py-1 px-1.5 text-right cursor-pointer hover:bg-white/10 transition-colors group w-28"
                          onClick={() => handleSort('totalValue')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Amount / PM Value</span>
                            <SortIcon col="totalValue" />
                          </div>
                        </th>
                        <th className="py-1 px-1.5 whitespace-nowrap" title={dateFrom || dateTo ? `Showing visits between ${dateFrom || 'start'} and ${dateTo || 'end'}` : 'All PM visits'}>
                          PM Visits ({selectedSummary.pmTotal}) {dateFrom || dateTo ? '(In Range)' : ''}
                        </th>
                        <th className="py-1 px-1 text-center whitespace-nowrap w-16">Status</th>
                        <th className="py-1 px-1 whitespace-nowrap w-24">Engineer</th>
                        <th className="py-1 px-0.5 text-center w-6"></th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {flatContracts.map((contract, idx) => {
                        const cs = contract._customer;
                        const daysLeft = getDaysRemaining(contract.endDate);
                        const dept = extractDepartmentFromCustomer(contract.customerName, cs.customerName);
                        const applicablePMs = contract.pmSchedules.filter(p => p.status !== 'Not Applicable');
                        const totalContractVisits = contract.noOfVisits || applicablePMs.length || 0;
                        const perPmVal = totalContractVisits > 0 ? Math.round(Number(contract.amount || 0) / totalContractVisits) : Number(contract.amount || 0);

                        let displayedPMs = (dateFrom || dateTo)
                          ? applicablePMs.filter(p => isPMInRange(p, dateFrom, dateTo))
                          : applicablePMs;

                        if (pmFilter === 'pending') {
                          displayedPMs = displayedPMs.filter(p => p.status !== 'Completed');
                        } else if (pmFilter === 'completed') {
                          displayedPMs = displayedPMs.filter(p => p.status === 'Completed');
                        } else if (pmFilter === 'overdue') {
                          displayedPMs = displayedPMs.filter(p => p.status !== 'Completed' && p.range && isRangeOverdue(p.range));
                        }

                        return (
                          <tr
                            key={`flat-${contract.id}-${idx}`}
                            className={`group hover:bg-[#82A094]/[0.04] transition-colors duration-100 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                              }`}
                          >
                            {/* # */}
                            <td className="py-1 px-1 text-center font-bold text-slate-400 text-[10px]">
                              {idx + 1}
                            </td>

                            {/* Customer + Dept + Location */}
                            <td className="py-1 px-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <div className={`w-5 h-5 rounded bg-gradient-to-br ${getCustomerColorClass(cs.customerName)} flex items-center justify-center text-white text-[9px] font-extrabold flex-shrink-0 mt-0.5`}>
                                  {(cs.customerName || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start gap-1 min-w-0">
                                    <span
                                      className="font-bold text-slate-900 text-[11px] leading-snug break-words flex-1 min-w-0"
                                      title={cs.customerName}
                                    >
                                      {cs.customerName || 'Unassigned'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`${getBaseRoute()}/customers/${cs.customerId}`);
                                      }}
                                      className="text-slate-300 hover:text-[#82A094] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                                      title="Open Customer"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5 flex-wrap min-w-0">
                                    {dept && dept !== '—' && !cs.customerName?.toLowerCase().includes(dept.toLowerCase()) && (
                                      <span
                                        className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[8px] font-semibold truncate max-w-[90px]"
                                        title={`Department: ${dept}`}
                                      >
                                        {dept}
                                      </span>
                                    )}
                                    {cs.place && cs.place !== '—' && (
                                      <div className="flex items-center gap-0.5 text-[9px] text-slate-400 min-w-0">
                                        <MapPin className="w-2 h-2 flex-shrink-0" />
                                        <span className="truncate max-w-[120px]">{cs.place}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* PO No */}
                            <td className="py-1 px-1 text-center whitespace-nowrap">
                              <span className="text-[10px] text-slate-600 font-mono bg-slate-50 border border-slate-200/80 px-1 py-0.5 rounded">{contract.poNo || '—'}</span>
                            </td>

                            {/* Zone */}
                            <td className="py-1 px-1 text-center whitespace-nowrap">
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                {contract.zoneName || '—'}
                              </span>
                            </td>

                            {/* MC Type */}
                            <td className="py-1 px-1 text-center whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSlaColor(contract.mcType)}`}>
                                {contract.mcType || '—'}
                              </span>
                            </td>

                            {/* Machines */}
                            <td className="py-1 px-1 text-center whitespace-nowrap">
                              <span className="font-extrabold text-slate-800 text-[11px]">{contract.noOfMachine}</span>
                            </td>

                            {/* Total PM Visits Count (Contract-wise) */}
                            <td className="py-1 px-1 text-center whitespace-nowrap">
                              <div className="inline-flex flex-col items-center">
                                <span className="font-extrabold text-slate-800 text-[11px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded min-w-[22px]" title={`Total PM Visits: ${totalContractVisits}`}>
                                  {totalContractVisits}
                                </span>
                                {applicablePMs.length > 0 && (
                                  <span className="text-[8px] text-slate-400 font-bold mt-0.5 whitespace-nowrap">
                                    {applicablePMs.filter(p => p.status === 'Completed').length}/{applicablePMs.length} Done
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Contract Period + Days Left */}
                            <td className="py-1 px-1 whitespace-nowrap">
                              <div className="text-[10px] text-slate-700 font-medium">
                                <span>{formatPeriodDate(contract.startDate)}</span> <span className="text-slate-400 font-bold mx-0.5">&rarr;</span> <span>{formatPeriodDate(contract.endDate)}</span>
                              </div>
                              <div className="mt-0.5">
                                <span className={`inline-flex px-1.5 py-0.2 rounded-full text-[8px] font-bold ${daysLeft < 0
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : daysLeft <= 30
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                                </span>
                              </div>
                            </td>

                            {/* Amount & Per PM Visit Value */}
                            <td className="py-1 px-1.5 text-right whitespace-nowrap">
                              <div className="font-bold text-slate-900 font-mono text-[11px]">
                                {formatCurrency(contract.amount)}
                              </div>
                              {totalContractVisits > 0 && (
                                <div
                                  className="text-[9px] text-[#976E44] font-bold font-mono mt-0.5"
                                  title={`PM Visit Value: ${formatCurrency(perPmVal)} per visit (${totalContractVisits} PM visits)`}
                                >
                                  {formatCurrency(perPmVal)} / PM
                                </div>
                              )}
                            </td>

                            {/* PM Visits (Start & End) */}
                            <td className="py-1 px-1.5">
                              <div className="flex flex-col gap-0.5 py-0.5">
                                {displayedPMs.map((p, pidx) => {
                                  const done = p.status === 'Completed';
                                  const isOverdue = !done && p.range && isRangeOverdue(p.range);
                                  const { startDate, endDate } = parseRangeDates(p.range);
                                  const startFmt = formatCompactDate(startDate);
                                  const endFmt = formatCompactDate(endDate);
                                  return (
                                    <div
                                      key={pidx}
                                      className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[9px] border leading-tight ${done
                                          ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                                          : isOverdue
                                            ? 'bg-rose-50/70 border-rose-200/80 text-rose-900'
                                            : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
                                        }`}
                                      title={`PM ${p.pmNumber}: ${p.status}\nRange: ${p.range || 'N/A'}\nPM Value: ${formatCurrency(perPmVal)}${done && p.completedAt ? `\nCompleted: ${formatDate(p.completedAt)}` : ''}`}
                                    >
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className={`font-extrabold text-[8px] uppercase px-1 py-0.2 rounded ${done ? 'bg-emerald-200/70 text-emerald-800' : isOverdue ? 'bg-rose-200/70 text-rose-800' : 'bg-amber-200/70 text-amber-800'
                                          }`}>
                                          PM{p.pmNumber}
                                        </span>
                                        <span className="font-semibold text-slate-700 whitespace-nowrap text-[9px]">
                                          {startFmt} <span className="text-slate-400 font-bold">&rarr;</span> {endFmt}
                                        </span>
                                      </div>
                                      <span className={`text-[8px] font-bold px-1 py-0.2 rounded whitespace-nowrap ${done
                                          ? 'text-emerald-700 bg-emerald-100/90'
                                          : isOverdue
                                            ? 'text-rose-700 bg-rose-100/90'
                                            : 'text-amber-700 bg-amber-100/90'
                                        }`}>
                                        {done ? '✓ Done' : isOverdue ? 'Overdue' : 'Pending'}
                                      </span>
                                    </div>
                                  );
                                })}
                                {displayedPMs.length === 0 && (
                                  <span className="text-[9px] text-slate-400 italic">
                                    {applicablePMs.length > 0 ? 'No PM in range' : '—'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-1 px-1 text-center whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${getStatusBadge(contract.status)}`}>
                                {contract.status}
                              </span>
                            </td>

                            {/* Engineer + SW Support */}
                            <td className="py-1 px-1">
                              <div className="text-[10px] text-slate-700 font-medium truncate max-w-[110px] lg:max-w-[130px]" title={contract.responsible || '—'}>
                                {formatEngineerDisplayName(contract.responsible) || '—'}
                              </div>
                              {contract.softwareSupport && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1 py-0.2 rounded mt-0.5 whitespace-nowrap" title="Software Support Included">
                                  <ShieldCheck className="w-2.5 h-2.5" />
                                  <span>SW Support</span>
                                </span>
                              )}
                            </td>

                            {/* Open */}
                            <td className="py-1 px-0.5 text-center">
                              <button
                                type="button"
                                onClick={() => router.push(`${getBaseRoute()}/contracts/${contract.id}`)}
                                className="p-1 rounded border border-slate-200 hover:bg-slate-100 hover:border-[#82A094] text-slate-500 hover:text-[#546A7A] transition-colors"
                                title="Open Contract"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Footer Totals */}
                    <tfoot className="bg-[#546A7A] text-white border-t border-[#435562] text-xs font-bold select-none">
                      <tr>
                        <td className="py-1.5 px-1 text-center font-bold text-white/70">Total</td>
                        <td className="py-1.5 px-1.5 font-bold text-white whitespace-nowrap" colSpan={2}>
                          TOTAL &mdash; {customerSummaries.length} Customers &bull; {flatContracts.length} Contracts
                        </td>
                        <td className="py-1.5 px-1 text-center text-white/50">—</td>
                        <td className="py-1.5 px-1 text-center text-white/50">—</td>
                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                          <span className="font-extrabold text-white text-xs">{selectedSummary.totalMachines}</span>
                        </td>
                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                          <span className="font-extrabold text-white text-xs">{selectedSummary.pmTotal}</span>
                        </td>
                        <td className="py-1.5 px-1 text-center text-white/50">—</td>
                        <td className="py-1.5 px-1.5 text-right whitespace-nowrap">
                          <span className="font-extrabold text-white text-xs font-mono">{formatCurrency(selectedSummary.totalValue)}</span>
                        </td>
                        <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                          {(dateFrom || dateTo) ? (
                            <div>
                              <span className="font-bold text-white text-[10px]">{selectedSummary.pmTotal} Pending</span>
                              {selectedSummary.pmOverdue > 0 && (
                                <span className="text-rose-300 text-[9px] block font-bold">{selectedSummary.pmOverdue} OD</span>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-white text-[10px]">{selectedSummary.pmCompleted}/{selectedSummary.pmTotal}</span>
                              {selectedSummary.pmOverdue > 0 && (
                                <span className="text-rose-300 text-[9px] block font-bold">{selectedSummary.pmOverdue} OD</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                          <div className="text-[10px] font-bold">
                            <span className="text-emerald-300">{selectedSummary.active} Active</span>
                            {selectedSummary.expired > 0 && <span className="text-rose-300 ml-1">{selectedSummary.expired} Exp</span>}
                          </div>
                        </td>
                        <td className="py-1.5 px-0.5 text-white/50 text-center" colSpan={2}>—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
