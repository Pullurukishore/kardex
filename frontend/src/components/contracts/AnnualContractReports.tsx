'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  BarChart3, Search, Download, Calendar,
  AlertTriangle, Clock, MapPin, Building2, IndianRupee,
  RefreshCw, FileText, AlertCircle, CheckCircle,
  Cpu, Layers, ChevronDown, ChevronUp, ArrowUpDown, X,
  BookmarkPlus, Save, Trash2, Zap, User, Shield, ExternalLink,
  Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { generateAnnualContractReportPdf } from '@/lib/annual-contract-report-pdf';
import { generateAnnualContractReportExcel } from '@/lib/annual-contract-report-excel';
import { normalizeEngineerNames, formatEngineerDisplayName, getCustomerColorClass, extractDepartmentFromCustomer } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================
// Types
// ============================
interface ExpiryInfo {
  status: string;
  daysLeft: number | null;
  bucket: string;
}

interface DetailedMachine {
  id: number;
  slNo: number | null;
  customerName: string;
  customerClass: string | null;
  place: string | null;
  zoneName: string;
  engineerName: string | null;
  serialNumber: string;
  unitType: string | null;
  modelNumber: string | null;
  controlType: string | null;
  department: string | null;
  installationYear: string | null;
  contractType: string | null;
  mcPoNumber: string | null;
  poDate: string | null;
  mcStartDate: string | null;
  mcEndDate: string | null;
  mcValue: number | null;
  pmVisitsCount: number;
  bdVisitsCount: number;
  warrantyStartDate?: string | null;
  warrantyEndDate: string | null;
  softwareEndDate: string | null;
  remoteSupportEndDate: string | null;
  notes: string | null;
  mcExpiry: ExpiryInfo;
  warrantyExpiry: ExpiryInfo;
  softwareExpiry: ExpiryInfo;
  remoteSupportExpiry: ExpiryInfo;
}

interface CustomerGroup {
  customerName: string;
  customerId?: number;
  customerClass: string | null;
  place: string | null;
  zoneName: string;
  engineerName: string | null;
  totalMachines: number;
  totalMCValue: number;
  totalPMVisits: number;
  totalBDVisits: number;
  machines: DetailedMachine[];
  earliestMCExpiry: string | null;
  expiryStatus: string;
  expiryBucket: string;
  daysToEarliestExpiry: number | null;
}

interface Stats {
  totalMachines: number;
  totalCustomers: number;
  totalMCValue: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  active: number;
  warrantyExpiring30: number;
  classA: number;
  classB: number;
  classC: number;
}

interface AnnualContractReportsProps {
  role: string;
}

type SortKey = 'customerName' | 'totalMachines' | 'totalMCValue' | 'zoneName' | 'earliestMCExpiry';
type SortDir = 'asc' | 'desc';

// ============================
// Helpers
// ============================
const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return '₹' + Number(val).toLocaleString('en-IN');
};

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const renderDateRange = (startDate: string | null | undefined, endDate: string | null | undefined) => {
  if (!startDate && !endDate) {
    return <span className="text-slate-400 font-medium text-xs">—</span>;
  }
  return (
    <div className="flex flex-col text-[10.5px] leading-tight whitespace-nowrap">
      <span className="font-bold text-slate-800">{formatDate(startDate)}</span>
      <span className="text-[9.5px] text-slate-400 font-medium">to {formatDate(endDate)}</span>
    </div>
  );
};

const getMachineStatus = (m: DetailedMachine): 'Active' | 'Expired' => {
  if (m.mcExpiry?.bucket === 'expired') return 'Expired';
  if (m.mcExpiry?.daysLeft !== null && m.mcExpiry?.daysLeft !== undefined && m.mcExpiry.daysLeft < 0) return 'Expired';
  if (m.mcEndDate) {
    const end = new Date(m.mcEndDate);
    if (!isNaN(end.getTime()) && end.getTime() < new Date().setHours(0, 0, 0, 0)) {
      return 'Expired';
    }
  }
  return 'Active';
};

const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20';
    case 'Expired':
      return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getExpiryBadge = (expiry: ExpiryInfo) => {
  if (!expiry || expiry.bucket === 'na') return <span className="text-[10.5px] text-slate-400">—</span>;

  const daysText = expiry.daysLeft !== null
    ? (expiry.daysLeft < 0 ? `${Math.abs(expiry.daysLeft)}d overdue` : `${expiry.daysLeft}d left`)
    : '';

  switch (expiry.bucket) {
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30 shadow-2xs">
          <AlertCircle className="w-3 h-3" />
          {daysText || 'Expired'}
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30 shadow-2xs">
          <AlertTriangle className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#CE9F6B]/15 text-[#B8874E] border border-[#CE9F6B]/30 shadow-2xs">
          <Clock className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'attention':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30 shadow-2xs">
          <Clock className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'healthy':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#82A094]/15 text-[#4E7D6D] border border-[#82A094]/30 shadow-2xs">
          <CheckCircle className="w-3 h-3" />
          {daysText || 'Active'}
        </span>
      );
  }
};

const getClassBadge = (cls: string | null) => {
  if (!cls) return null;
  const colors: Record<string, string> = {
    'A': 'bg-[#82A094]/15 text-[#4E7D6D] border-[#82A094]/40',
    'B': 'bg-[#6F8A9D]/15 text-[#546A7A] border-[#6F8A9D]/40',
    'C': 'bg-[#CE9F6B]/15 text-[#B8874E] border-[#CE9F6B]/40',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] font-extrabold border shadow-2xs ${colors[cls] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      Class {cls}
    </span>
  );
};

const getUnitTypeBadge = (unitType: string | null, modelNumber?: string | null) => {
  if (!unitType) return <span className="text-slate-400 font-medium text-[11px]">—</span>;
  const upper = unitType.toUpperCase();
  const label = modelNumber ? `${unitType} / ${modelNumber}` : unitType;

  if (upper.includes('SHUTTLE')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
        <Cpu className="w-3 h-3 text-[#6F8A9D]" />
        <span className="truncate max-w-[130px]">{label}</span>
      </span>
    );
  }
  if (upper.includes('LEKTRIVER') || upper.includes('MEGAMAT')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/30">
        <Cpu className="w-3 h-3 text-[#82A094]" />
        <span className="truncate max-w-[130px]">{label}</span>
      </span>
    );
  }
  if (upper.includes('ELEMENT') || upper.includes('TOWER')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30">
        <Cpu className="w-3 h-3 text-[#CE9F6B]" />
        <span className="truncate max-w-[130px]">{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#92A2A5]/15 text-[#5D6E73] border border-[#92A2A5]/30">
      <Cpu className="w-3 h-3 text-[#92A2A5]" />
      <span className="truncate max-w-[130px]">{label}</span>
    </span>
  );
};

const getControlTypeBadge = (controlType: string | null) => {
  if (!controlType) return <span className="text-slate-400 font-medium text-[11px]">—</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
      {controlType}
    </span>
  );
};

const getContractTypeBadge = (type: string | null) => {
  if (!type) return <span className="inline-flex px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">UMC</span>;
  const upper = type.toUpperCase();
  if (upper === 'UMC') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
        UMC
      </span>
    );
  }
  if (upper === 'AMC') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/30">
        AMC
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30">
      {type}
    </span>
  );
};

// ============================
// Main Component
// ============================
export default function AnnualContractReports({ role }: AnnualContractReportsProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [contractTypeFilter, setContractTypeFilter] = useState('all');
  const [unitTypeFilter, setUnitTypeFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('customerName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filter Presets
  interface FilterPreset {
    id: string;
    name: string;
    filters: {
      zone: string; customerClass: string; contractType: string; unitType: string;
      engineer: string; department: string; expiry: string; search: string;
      dateFrom: string; dateTo: string;
    };
    createdAt: string;
  }
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  const [allEngineers, setAllEngineers] = useState<string[]>([]);
  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  // Load presets & master filters on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kardex-annual-report-filter-presets');
      if (saved) setFilterPresets(JSON.parse(saved));
    } catch { /* ignore */ }

    const loadMasterFilters = async () => {
      try {
        const res = await apiService.getDetailedContractsCustomerGrouped({});
        const list = res.data || [];
        const engs = new Set<string>();
        const deps = new Set<string>();
        list.forEach((c: CustomerGroup) => {
          normalizeEngineerNames(c.engineerName).forEach(e => engs.add(e));
          (c.machines || []).forEach(m => {
            normalizeEngineerNames(m.engineerName).forEach(e => engs.add(e));
            if (m.department && m.department.trim()) {
              deps.add(m.department.trim());
            }
          });
        });
        setAllEngineers(Array.from(engs).sort());
        setAllDepartments(Array.from(deps).sort());
      } catch (err) {
        console.error('Failed to load master filters:', err);
      }
    };
    loadMasterFilters();
  }, []);

  const savePreset = () => {
    if (!presetName.trim()) { toast.error('Enter a preset name'); return; }
    const preset: FilterPreset = {
      id: `annual-preset-${Date.now()}`,
      name: presetName.trim(),
      filters: {
        zone: zoneFilter, customerClass: classFilter, contractType: contractTypeFilter, unitType: unitTypeFilter,
        engineer: techFilter, department: departmentFilter, expiry: expiryFilter, search,
        dateFrom, dateTo
      },
      createdAt: new Date().toISOString()
    };
    const updated = [...filterPresets, preset];
    setFilterPresets(updated);
    try { localStorage.setItem('kardex-annual-report-filter-presets', JSON.stringify(updated)); } catch { /* ignore */ }
    setPresetName('');
    setShowPresetSave(false);
    toast.success(`Preset "${preset.name}" saved!`);
  };

  const applyPreset = (preset: FilterPreset) => {
    setZoneFilter(preset.filters.zone);
    setClassFilter(preset.filters.customerClass);
    setContractTypeFilter(preset.filters.contractType);
    setUnitTypeFilter(preset.filters.unitType);
    setTechFilter(preset.filters.engineer);
    setDepartmentFilter(preset.filters.department);
    setExpiryFilter(preset.filters.expiry);
    setSearch(preset.filters.search);
    setDateFrom(preset.filters.dateFrom || '');
    setDateTo(preset.filters.dateTo || '');
    toast.info(`Applied preset: ${preset.name}`);
  };

  const deletePreset = (id: string) => {
    const updated = filterPresets.filter(p => p.id !== id);
    setFilterPresets(updated);
    try { localStorage.setItem('kardex-annual-report-filter-presets', JSON.stringify(updated)); } catch { /* ignore */ }
    toast.success('Preset removed');
  };

  // Quick Date Range Presets
  const applyDatePreset = (preset: '1_month' | 'today' | 'this_month' | 'next_month' | 'this_quarter' | 'all') => {
    const now = new Date();
    if (preset === '1_month') {
      const todayStr = now.toISOString().slice(0, 10);
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
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

  const resetFilters = () => {
    setSearch('');
    setZoneFilter('all');
    setClassFilter('all');
    setContractTypeFilter('all');
    setUnitTypeFilter('all');
    setTechFilter('all');
    setDepartmentFilter('all');
    setExpiryFilter('all');
    const now = new Date();
    setDateFrom(now.toISOString().slice(0, 10));
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    setDateTo(d.toISOString().slice(0, 10));
    toast.info('Filters reset to default');
  };

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setHasGenerated(true);
    try {
      const params: any = {};
      if (zoneFilter !== 'all') params.zone = zoneFilter;
      if (classFilter !== 'all') params.customerClass = classFilter;
      if (contractTypeFilter !== 'all') params.contractType = contractTypeFilter;
      if (unitTypeFilter !== 'all') params.unitType = unitTypeFilter;
      if (techFilter !== 'all') params.engineer = techFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const [groupedRes, statsRes] = await Promise.all([
        apiService.getDetailedContractsCustomerGrouped({ ...params, search, expiryBucket: expiryFilter }),
        apiService.getDetailedContractStats(params),
      ]);

      setCustomers(groupedRes.data || []);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to fetch annual contracts:', error);
      toast.error('Failed to load annual contracts');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch data on initial mount and whenever any filter / search changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [zoneFilter, classFilter, contractTypeFilter, unitTypeFilter, techFilter, departmentFilter, expiryFilter, dateFrom, dateTo, search]);

  // Sorted Customer Groups
  const sortedCustomerGroups = useMemo(() => {
    const list = [...customers];
    list.sort((a, b) => {
      let av: any = 0;
      let bv: any = 0;
      switch (sortKey) {
        case 'customerName':
          av = (a.customerName || '').toLowerCase();
          bv = (b.customerName || '').toLowerCase();
          break;
        case 'totalMachines':
          av = Number(a.totalMachines) || 0;
          bv = Number(b.totalMachines) || 0;
          break;
        case 'totalMCValue':
          av = Number(a.totalMCValue) || 0;
          bv = Number(b.totalMCValue) || 0;
          break;
        case 'zoneName':
          av = (a.zoneName || '').toLowerCase();
          bv = (b.zoneName || '').toLowerCase();
          break;
        case 'earliestMCExpiry':
          av = new Date(a.earliestMCExpiry || 0).getTime();
          bv = new Date(b.earliestMCExpiry || 0).getTime();
          break;
        default:
          av = (a.customerName || '').toLowerCase();
          bv = (b.customerName || '').toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [customers, sortKey, sortDir]);

  // Overall KPI summaries
  const summaryKPIs = useMemo(() => {
    let totalMachines = 0;
    let totalValue = 0;
    let activeCount = 0;
    let expiredCount = 0;
    let criticalCount = 0;

    customers.forEach(c => {
      totalMachines += c.machines?.length || 0;
      totalValue += Number(c.totalMCValue) || 0;
      (c.machines || []).forEach(m => {
        const status = getMachineStatus(m);
        if (status === 'Active') activeCount++;
        else expiredCount++;
        if (m.mcExpiry?.bucket === 'critical' || (m.mcExpiry?.daysLeft !== null && m.mcExpiry?.daysLeft !== undefined && m.mcExpiry.daysLeft >= 0 && m.mcExpiry.daysLeft <= 30)) {
          criticalCount++;
        }
      });
    });

    return {
      totalCustomers: customers.length,
      totalMachines,
      totalValue,
      activeCount,
      expiredCount,
      criticalCount,
    };
  }, [customers]);

  // Dynamic filter options
  const uniqueEngineers = useMemo(() => {
    const engs = new Set<string>(allEngineers);
    customers.forEach(c => {
      normalizeEngineerNames(c.engineerName).forEach(e => engs.add(e));
      (c.machines || []).forEach(m => {
        normalizeEngineerNames(m.engineerName).forEach(e => engs.add(e));
      });
    });
    return Array.from(engs).sort();
  }, [allEngineers, customers]);

  const uniqueDepartments = useMemo(() => {
    const deps = new Set<string>(allDepartments);
    customers.forEach(c => {
      (c.machines || []).forEach(m => {
        if (m.department && m.department.trim()) deps.add(m.department.trim());
      });
    });
    return Array.from(deps).sort();
  }, [allDepartments, customers]);

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

  const activeFilterCount = [
    zoneFilter !== 'all',
    classFilter !== 'all',
    contractTypeFilter !== 'all',
    unitTypeFilter !== 'all',
    techFilter !== 'all',
    departmentFilter !== 'all',
    expiryFilter !== 'all',
    !!search,
    !!dateFrom || !!dateTo,
  ].filter(Boolean).length;

  // Export handler
  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const filters = {
        zone: zoneFilter,
        customerClass: classFilter,
        contractType: contractTypeFilter,
        unitType: unitTypeFilter,
        engineer: techFilter,
        department: departmentFilter,
        dateFrom,
        dateTo,
        expiryBucket: expiryFilter,
        search
      };

      if (format === 'pdf') {
        await generateAnnualContractReportPdf(customers, stats, filters);
        toast.success('Annual Contract PDF Report exported successfully!');
      } else {
        await generateAnnualContractReportExcel(customers, stats, filters);
        toast.success('Annual Contract Excel Report exported successfully!');
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error(`Failed to export ${format.toUpperCase()} report`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full space-y-4 print:space-y-3">
      {/* ═══ REPORT GENERATION CONTROLS — Card Layout (Matches Contract Reports) ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        {/* Card Header — Title + Generate + Export Buttons */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Annual Contract Report Filters</h2>
              <p className="text-sm text-slate-500 mt-1">Configure parameters for customer-wise annual machine maintenance agreements and asset lifecycle</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 bg-[#6F8A9D] hover:bg-[#546A7A] text-white font-bold h-9 px-3.5 rounded-lg shadow-xs hover:shadow transition-all text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BarChart3 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
              <button
                onClick={() => handleExport('excel')}
                disabled={exporting || loading || summaryKPIs.totalMachines === 0}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-[#4F6A64]/40 text-[#4F6A64] hover:bg-[#A2B9AF]/10 font-bold text-xs transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />
                Export Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting || loading || summaryKPIs.totalMachines === 0}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-[#9E3B47]/40 text-[#9E3B47] hover:bg-[#E17F70]/10 font-bold text-xs transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* Card Content — Filters */}
        <div className="px-6 py-5 space-y-4">
          {/* Date Range Row */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" />
                Contract Expiry Date Range
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400 mr-1">Quick ranges:</span>
                <button
                  type="button"
                  onClick={() => applyDatePreset('1_month')}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#6F8A9D]/15 text-[#546A7A] hover:bg-[#6F8A9D]/25 transition-colors"
                >
                  1 Month
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
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold text-slate-600">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Customer, serial, model, engineer..."
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
                {['North', 'South', 'East', 'West'].map(z => <option key={z} value={z}>{z} Zone</option>)}
              </select>
            </div>

            {/* Customer Class */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Customer Class</label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Classes (A/B/C)</option>
                <option value="A">Class A</option>
                <option value="B">Class B</option>
                <option value="C">Class C</option>
              </select>
            </div>

            {/* Contract Type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Contract Agreement Type</label>
              <select
                value={contractTypeFilter}
                onChange={(e) => setContractTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Contract Types</option>
                <option value="UMC">UMC (Comprehensive)</option>
                <option value="AMC">AMC (Annual Maintenance)</option>
                <option value="Flex Care">Flex Care</option>
                <option value="Full Care">Full Care</option>
                <option value="Non-Comprehensive">Non-Comprehensive</option>
              </select>
            </div>

            {/* Unit Type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Machine Unit / Model</label>
              <select
                value={unitTypeFilter}
                onChange={(e) => setUnitTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Machine Models</option>
                <option value="Shuttle">Shuttle XP / NT</option>
                <option value="Megamat">Megamat RS</option>
                <option value="Lektriver">Lektriver</option>
                <option value="Element">Element</option>
                <option value="Towermat">Towermat / Intermat</option>
                <option value="Compact">Compact / Miniload</option>
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
                <option value="all">All Responsible Engineers</option>
                {uniqueEngineers.map(eng => <option key={eng} value={eng}>{eng}</option>)}
              </select>
            </div>

            {/* Department */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Departments</option>
                {uniqueDepartments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
              </select>
            </div>

            {/* Expiry Lifecycle */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Expiry Lifecycle</label>
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium"
              >
                <option value="all">All Expiry Lifecycles</option>
                <option value="critical">Critical (≤ 30 Days Left)</option>
                <option value="warning">Warning (31 - 60 Days Left)</option>
                <option value="attention">Upcoming (61 - 90 Days Left)</option>
                <option value="healthy">Active Healthy (&gt; 90 Days Left)</option>
                <option value="expired">Expired Contracts</option>
              </select>
            </div>
          </div>

          {/* Filter Presets Bar & Reset Controls */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowPresetSave(!showPresetSave)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white hover:bg-slate-50 font-medium text-slate-600 flex items-center gap-1.5 transition-colors"
                title="Save current filters as a preset"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-[#82A094]" />
                Save Preset
              </button>

              {filterPresets.map(preset => (
                <div key={preset.id} className="inline-flex items-center gap-1 group">
                  <button
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#546A7A]/10 hover:bg-[#546A7A]/20 text-[10px] font-bold text-[#546A7A] transition-colors flex items-center gap-1"
                    title={`Zone: ${preset.filters.zone} | Class: ${preset.filters.customerClass}`}
                  >
                    <Zap className="w-2.5 h-2.5" />
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePreset(preset.id)}
                    className="p-0.5 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {activeFilterCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#546A7A]/10 text-[#546A7A] text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#546A7A]" />
                  {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>

          {/* Preset Save Form */}
          {showPresetSave && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 duration-150">
              <Save className="w-4 h-4 text-[#82A094] flex-shrink-0" />
              <input
                type="text"
                placeholder="Enter preset name (e.g. 'South Critical Expiry')"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePreset()}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#82A094]/30"
              />
              <button
                type="button"
                onClick={savePreset}
                className="px-3 py-1.5 rounded-lg bg-[#82A094] text-white text-xs font-bold hover:bg-[#6d9181] transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setShowPresetSave(false); setPresetName(''); }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ NOT GENERATED STATE ═══ */}
      {!hasGenerated && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#546A7A]/10 text-[#546A7A] flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-800">Ready to Generate Annual Contract Report</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Configure your filters above and click &quot;Generate Report&quot; to compile comprehensive customer-wise annual machine contract asset lifecycle and expiration analytics.
          </p>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-[#6F8A9D] hover:bg-[#546A7A] text-white font-bold h-9 px-4 rounded-lg shadow-sm hover:shadow transition-all text-xs"
          >
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      )}

      {/* ═══ KPI STRIP + TABLE (ONLY AFTER GENERATING) ═══ */}
      {hasGenerated && (
        <>
          {/* Compact 6-Metric KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#82A094]/10 flex items-center justify-center text-[#82A094] flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Customers</p>
                <p className="text-base font-extrabold text-slate-800">{summaryKPIs.totalCustomers}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Machines</p>
                <p className="text-base font-extrabold text-slate-800">{summaryKPIs.totalMachines}</p>
                <span className="text-[9px] text-emerald-600 font-bold">{summaryKPIs.activeCount} Active</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                <IndianRupee className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Value</p>
                <p className="text-base font-extrabold text-slate-800">{formatCurrency(summaryKPIs.totalValue)}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active / Expired</p>
                <p className="text-base font-extrabold text-slate-800">
                  {summaryKPIs.activeCount} <span className="text-rose-500 text-xs font-bold">/ {summaryKPIs.expiredCount}</span>
                </p>
              </div>
            </div>

            <div
              onClick={() => setExpiryFilter(expiryFilter === 'critical' ? 'all' : 'critical')}
              className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-2.5 cursor-pointer transition-all hover:border-amber-400 hover:shadow-md ${expiryFilter === 'critical' ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/20' : 'border-slate-100'
                }`}
              title="Click to toggle filter: Expiring in ≤30 days"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Expiring ≤30d</span>
                  {expiryFilter === 'critical' && <span className="text-[8px] bg-amber-600 text-white px-1 py-0.2 rounded font-bold">Active</span>}
                </p>
                <p className="text-base font-extrabold text-amber-600">
                  {summaryKPIs.criticalCount}
                </p>
              </div>
            </div>

            <div
              onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
              className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-2.5 cursor-pointer transition-all hover:border-rose-400 hover:shadow-md ${expiryFilter === 'expired' ? 'ring-2 ring-rose-500 border-rose-400 bg-rose-50/20' : 'border-slate-100'
                }`}
              title="Click to toggle filter: Expired Contracts"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${summaryKPIs.expiredCount > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 text-slate-400'
                }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Expired</span>
                  {expiryFilter === 'expired' && <span className="text-[8px] bg-rose-600 text-white px-1 py-0.2 rounded font-bold">Active</span>}
                </p>
                <p className={`text-base font-extrabold ${summaryKPIs.expiredCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {summaryKPIs.expiredCount}
                </p>
              </div>
            </div>
          </div>

          {/* ═══ MAIN TABLE — CUSTOMER BAND + MACHINE ROWS (Matches Annual Contracts Page) ═══ */}
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm">
              <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-semibold">Loading annual contract analytics...</p>
            </div>
          ) : sortedCustomerGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-3">
              <Layers className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-slate-500 text-sm font-medium">No machine contracts match current filters.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-0 shadow-xl overflow-hidden w-full">
              {/* Table Toolbar */}
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#546A7A] text-white text-[11px] font-bold">
                    {summaryKPIs.totalMachines}
                  </span>
                  <span className="font-semibold text-slate-700">Machines</span>
                  <span className="text-slate-300 font-bold">&bull;</span>
                  <span>
                    <strong className="text-slate-800">{sortedCustomerGroups.length}</strong> Customers
                  </span>
                  <span className="text-slate-300 font-bold">&bull;</span>
                  <span>
                    Value: <strong className="text-slate-900">{formatCurrency(summaryKPIs.totalValue)}</strong>
                  </span>
                  <span className="text-slate-300 font-bold">&bull;</span>
                  <span className="text-emerald-700 font-bold">
                    {summaryKPIs.activeCount} Active
                  </span>
                </div>

                {/* Quick Expiry Status Filters */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden md:inline">Expiry:</span>
                  <button
                    type="button"
                    onClick={() => setExpiryFilter('all')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${expiryFilter === 'all'
                        ? 'bg-[#546A7A] text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiryFilter(expiryFilter === 'critical' ? 'all' : 'critical')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${expiryFilter === 'critical'
                        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/50'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-amber-400'
                      }`}
                  >
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>Critical (≤30d)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiryFilter(expiryFilter === 'warning' ? 'all' : 'warning')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${expiryFilter === 'warning'
                        ? 'bg-[#CE9F6B] text-white shadow-sm ring-2 ring-[#CE9F6B]/50'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-[#CE9F6B]'
                      }`}
                  >
                    <span>Warning (31-60d)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiryFilter(expiryFilter === 'healthy' ? 'all' : 'healthy')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${expiryFilter === 'healthy'
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-emerald-400'
                      }`}
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span>Healthy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${expiryFilter === 'expired'
                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/50'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-rose-400'
                      }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                    <span>Expired</span>
                  </button>
                </div>
              </div>

              {/* Customer Band + Machine Rows Table (Matches Annual Contract Page) */}
              <div className="w-full overflow-x-auto relative">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-30 shadow-sm">
                    <tr className="bg-gradient-to-r from-[#75242D] via-[#9E3B47] to-[#546A7A] text-white text-[11px] sm:text-xs font-extrabold uppercase tracking-wide select-none">
                      {/* Sl/No */}
                      <th
                        className="px-2 py-2.5 text-center cursor-pointer hover:bg-black/10 transition-colors w-11 sticky top-0"
                        onClick={() => handleSort('totalMachines')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>#</span>
                        </div>
                      </th>

                      {/* Serial No / Customer */}
                      <th
                        className="px-2.5 py-2.5 text-left cursor-pointer hover:bg-black/10 transition-colors"
                        onClick={() => handleSort('customerName')}
                      >
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-[#A2B9AF]" />
                          <span>Machine Serial / Agreement</span>
                          <SortIcon col="customerName" />
                        </div>
                      </th>

                      {/* Unit / Model */}
                      <th className="px-2 py-2.5 text-left">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-[#82A094]" />
                          <span>Unit Type / Model</span>
                        </div>
                      </th>

                      {/* Control & Type */}
                      <th className="px-1.5 py-2.5 text-center w-26 sticky top-0">
                        <span>Control / Type</span>
                      </th>

                      {/* Department / Year */}
                      <th className="px-2 py-2.5 text-left w-22 sticky top-0">
                        <span>Department</span>
                      </th>

                      {/* MC Period */}
                      <th
                        className="px-2.5 py-2.5 text-left w-32 sticky top-0 cursor-pointer hover:bg-black/10 transition-colors"
                        onClick={() => handleSort('earliestMCExpiry')}
                      >
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#CE9F6B]" />
                          <span>MC Period</span>
                          <SortIcon col="earliestMCExpiry" />
                        </div>
                      </th>

                      {/* Warranty Period */}
                      <th className="px-2.5 py-2.5 text-left w-28 sticky top-0">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-[#82A094]" />
                          <span>Warranty</span>
                        </div>
                      </th>

                      {/* Status */}
                      <th className="px-1.5 py-2.5 text-center w-20 sticky top-0">
                        <div className="flex items-center justify-center gap-1">
                          <span>Status</span>
                        </div>
                      </th>

                      {/* MC Value */}
                      <th
                        className="px-2.5 py-2.5 text-right cursor-pointer hover:bg-black/10 transition-colors w-26 sticky top-0"
                        onClick={() => handleSort('totalMCValue')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <IndianRupee className="h-3.5 w-3.5 text-[#82A094]" />
                          <span>MC Value</span>
                          <SortIcon col="totalMCValue" />
                        </div>
                      </th>

                      {/* Engineer */}
                      <th className="px-2 py-2.5 text-left w-26 sticky top-0">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-cyan-300" />
                          <span>Engineer</span>
                        </div>
                      </th>

                      {/* Actions */}
                      <th className="px-1.5 py-2.5 text-center w-10 sticky top-0">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {sortedCustomerGroups.map((group, groupIndex) => {
                      const customerSlNo = groupIndex + 1;
                      const dept = extractDepartmentFromCustomer(group.customerName);
                      const activeCount = (group.machines || []).filter(m => getMachineStatus(m) === 'Active').length;
                      const expiredCount = (group.machines || []).filter(m => getMachineStatus(m) === 'Expired').length;

                      return (
                        <Fragment key={`${group.customerName}_${group.zoneName}_${group.place}_${groupIndex}`}>
                          {/* ─── CUSTOMER HEADER BAND ─── */}
                          <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100/90 border-t-2 border-b border-slate-200">
                            <td colSpan={11} className="py-2 px-3 sm:px-4">
                              <div className="flex items-center justify-between flex-wrap gap-2.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-6 h-6 rounded-md bg-[#546A7A] text-white flex items-center justify-center text-[11px] font-black shadow-xs flex-shrink-0">
                                    {customerSlNo}
                                  </span>
                                  <div
                                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getCustomerColorClass(
                                      group.customerName
                                    )} flex items-center justify-center text-white text-xs font-black shadow-xs flex-shrink-0`}
                                  >
                                    {(group.customerName || 'C').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="font-extrabold text-slate-900 text-sm sm:text-[15px] truncate">
                                      {group.customerName}
                                    </span>
                                    {getClassBadge(group.customerClass)}
                                    {dept && dept !== '—' && (
                                      <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 font-bold text-[11px] border border-slate-200 shadow-2xs">
                                        {dept}
                                      </span>
                                    )}
                                    {group.place && (
                                      <span className="text-xs text-slate-600 font-medium">
                                        • {group.place}
                                      </span>
                                    )}
                                    {group.zoneName && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-slate-700 text-[11px] font-bold border border-slate-200 shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#6F8A9D]" />
                                        {group.zoneName} Zone
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-full bg-[#9E3B47]/10 text-[#9E3B47] text-[11px] font-extrabold border border-[#9E3B47]/20 flex items-center gap-1">
                                      <Cpu className="w-3 h-3" />
                                      {group.machines.length} {group.machines.length === 1 ? 'Machine' : 'Machines'}
                                    </span>
                                  </div>
                                </div>

                                {/* Right side summary KPIs for this customer */}
                                <div className="flex items-center gap-2 text-xs font-semibold flex-shrink-0">
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                                    <span className="px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-200 text-[10.5px]">
                                      {activeCount} Active
                                    </span>
                                    {expiredCount > 0 && (
                                      <span className="px-2 py-0.2 rounded-full bg-rose-50 text-rose-700 font-extrabold border border-rose-200 text-[10.5px]">
                                        {expiredCount} Expired
                                      </span>
                                    )}
                                  </div>
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-2xs">
                                    <span className="text-emerald-600 font-medium">Total Value:</span>
                                    <span className="font-black font-mono">{formatCurrency(group.totalMCValue)}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* ─── CUSTOMER'S MACHINE CONTRACT ROWS ─── */}
                          {(group.machines || []).map((m, mIdx) => {
                            const machineStatus = getMachineStatus(m);

                            return (
                              <tr
                                key={m.id}
                                onClick={() => router.push(`${getBaseRoute()}/contracts/detailed/${m.id}?from=${encodeURIComponent(`${getBaseRoute()}/contracts/annual-reports`)}`)}
                                className={`
                                  ${mIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}
                                  hover:bg-gradient-to-r hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/20
                                  transition-all duration-150 cursor-pointer group border-b border-slate-100/70 text-xs sm:text-[12.5px]
                                `}
                              >
                                {/* Sub-index */}
                                <td className="px-2 py-2 text-center w-11">
                                  <span className="font-mono text-slate-500 text-[10.5px] font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                    #{mIdx + 1}
                                  </span>
                                </td>

                                {/* Serial No & PO */}
                                <td className="px-2.5 py-2">
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-mono font-bold text-slate-900 group-hover:text-[#9E3B47] text-xs sm:text-[12.5px] transition-colors flex items-center gap-1">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10.5px] font-bold">
                                        {m.serialNumber}
                                      </span>
                                    </span>
                                    {m.mcPoNumber && (
                                      <span className="text-[9.5px] text-slate-500 font-mono mt-0.5 truncate" title={`PO: ${m.mcPoNumber}`}>
                                        PO: {m.mcPoNumber}
                                      </span>
                                    )}
                                    {m.poDate && (
                                      <span className="text-[9.5px] text-slate-400 font-mono whitespace-nowrap mt-0.5" title={`PO Date: ${formatDate(m.poDate)}`}>
                                        PO Date: {formatDate(m.poDate)}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Unit / Model */}
                                <td className="px-2 py-2">
                                  {getUnitTypeBadge(m.unitType, m.modelNumber)}
                                </td>

                                {/* Control & Type */}
                                <td className="px-1.5 py-2 text-center w-26">
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    {getControlTypeBadge(m.controlType)}
                                    {getContractTypeBadge(m.contractType)}
                                  </div>
                                </td>

                                {/* Department / Installation Year */}
                                <td className="px-2 py-2 w-22">
                                  <div className="flex flex-col text-[10.5px] leading-tight">
                                    <span className="text-slate-800 font-semibold truncate max-w-[85px]" title={m.department || ''}>
                                      {m.department || '—'}
                                    </span>
                                    {m.installationYear && (
                                      <span className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                                        Inst: {m.installationYear}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* MC Period + Expiry */}
                                <td className="px-2.5 py-2 whitespace-nowrap w-32">
                                  <div className="flex flex-col gap-0.5">
                                    {renderDateRange(m.mcStartDate, m.mcEndDate)}
                                    <div>
                                      {getExpiryBadge(m.mcExpiry)}
                                    </div>
                                  </div>
                                </td>

                                {/* Warranty Period */}
                                <td className="px-2.5 py-2 whitespace-nowrap w-28">
                                  {renderDateRange(m.warrantyStartDate, m.warrantyEndDate)}
                                </td>

                                {/* Status (Active / Expired) */}
                                <td className="px-1.5 py-2 text-center w-20">
                                  <span
                                    className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold border shadow-2xs whitespace-nowrap ${getStatusBadgeStyle(
                                      machineStatus
                                    )}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${machineStatus === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                        }`}
                                    />
                                    {machineStatus}
                                  </span>
                                </td>

                                {/* MC Value */}
                                <td className="px-2.5 py-2 text-right w-26 whitespace-nowrap">
                                  <div className="font-extrabold text-slate-900 text-xs sm:text-[12.5px] font-mono leading-tight">
                                    {formatCurrency(m.mcValue)}
                                  </div>
                                </td>

                                {/* Engineer */}
                                <td className="px-2 py-2 w-26">
                                  {m.engineerName || group.engineerName ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-medium truncate max-w-[90px]" title={m.engineerName || group.engineerName || ''}>
                                      <User className="w-3 h-3 text-[#546A7A] shrink-0" />
                                      <span className="truncate">{formatEngineerDisplayName(m.engineerName || group.engineerName)}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="px-1 py-2 text-center w-10" onClick={e => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`${getBaseRoute()}/contracts/detailed/${m.id}?from=${encodeURIComponent(`${getBaseRoute()}/contracts/annual-reports`)}`)}
                                    className="h-6 w-6 p-0 hover:bg-slate-100 text-slate-600 rounded-md"
                                    title="View Machine Contract"
                                  >
                                    <Eye className="h-3 w-3 text-[#546A7A]" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
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
