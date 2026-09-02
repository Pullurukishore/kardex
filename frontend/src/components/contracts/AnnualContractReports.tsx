'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Search, Download, Calendar,
  AlertTriangle, Clock, MapPin, Building2, IndianRupee,
  RefreshCw, Filter, FileText, AlertCircle, CheckCircle,
  Cpu, Layers, ChevronDown, ChevronUp, ArrowUpDown, X,
  BookmarkPlus, Save, Trash2, Zap, CalendarClock, User, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { generateAnnualContractReportPdf } from '@/lib/annual-contract-report-pdf';
import { normalizeEngineerNames, formatEngineerDisplayName } from '@/lib/utils';

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

// ============================
// Helpers
// ============================
const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return '—';
  return '₹' + Number(val).toLocaleString('en-IN');
};

const getExpiryBadge = (expiry: ExpiryInfo) => {
  if (!expiry || expiry.bucket === 'na') return <span className="text-xs text-slate-400">—</span>;

  const daysText = expiry.daysLeft !== null
    ? (expiry.daysLeft < 0 ? `${Math.abs(expiry.daysLeft)}d overdue` : `${expiry.daysLeft}d left`)
    : '';

  switch (expiry.bucket) {
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30">
          <AlertCircle className="w-3 h-3" />
          {daysText || 'Expired'}
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30">
          <AlertTriangle className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#CE9F6B]/15 text-[#B8874E] border border-[#CE9F6B]/30">
          <Clock className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'attention':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
          <Clock className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'healthy':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#82A094]/15 text-[#4E7D6D] border border-[#82A094]/30">
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border shadow-xs ${colors[cls] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      Class {cls}
    </span>
  );
};

const getCustomerTheme = (name: string) => {
  if (!name) return { gradient: 'from-[#546A7A] to-[#6F8A9D]', border: 'border-[#546A7A]/30', lightBg: 'bg-[#546A7A]/5', accent: '#546A7A' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const themes = [
    { gradient: 'from-[#546A7A] to-[#6F8A9D]', border: 'border-[#546A7A]/30', lightBg: 'bg-[#546A7A]/5', accent: '#546A7A' },
    { gradient: 'from-[#4F6A64] to-[#82A094]', border: 'border-[#82A094]/30', lightBg: 'bg-[#82A094]/5', accent: '#82A094' },
    { gradient: 'from-[#976E44] to-[#CE9F6B]', border: 'border-[#CE9F6B]/30', lightBg: 'bg-[#CE9F6B]/5', accent: '#CE9F6B' },
    { gradient: 'from-[#5D6E73] to-[#92A2A5]', border: 'border-[#92A2A5]/30', lightBg: 'bg-[#92A2A5]/5', accent: '#5D6E73' },
    { gradient: 'from-[#75242D] to-[#E17F70]', border: 'border-[#E17F70]/30', lightBg: 'bg-[#E17F70]/5', accent: '#E17F70' },
    { gradient: 'from-[#3F6158] to-[#6E9E90]', border: 'border-[#6E9E90]/30', lightBg: 'bg-[#6E9E90]/5', accent: '#6E9E90' },
  ];
  return themes[Math.abs(hash) % themes.length];
};

const formatDate = (val: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getUnitTypeBadge = (unitType: string | null, modelNumber?: string | null) => {
  if (!unitType) return <span className="text-slate-400 font-medium">—</span>;
  const upper = unitType.toUpperCase();
  const label = modelNumber ? `${unitType} / ${modelNumber}` : unitType;

  if (upper.includes('SHUTTLE')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30 shadow-xs">
        <Cpu className="w-3 h-3 text-[#6F8A9D]" />
        {label}
      </span>
    );
  }
  if (upper.includes('LEKTRIVER') || upper.includes('MEGAMAT')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/30 shadow-xs">
        <Cpu className="w-3 h-3 text-[#82A094]" />
        {label}
      </span>
    );
  }
  if (upper.includes('ELEMENT') || upper.includes('TOWER')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30 shadow-xs">
        <Cpu className="w-3 h-3 text-[#CE9F6B]" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#92A2A5]/15 text-[#5D6E73] border border-[#92A2A5]/30 shadow-xs">
      <Cpu className="w-3 h-3 text-[#92A2A5]" />
      {label}
    </span>
  );
};

const getControlTypeBadge = (controlType: string | null) => {
  if (!controlType) return <span className="text-slate-400 font-medium">—</span>;
  const upper = controlType.toUpperCase();
  if (upper.includes('C3000') || upper.includes('C2000') || upper.includes('C1000')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
        {controlType}
      </span>
    );
  }
  if (upper.includes('T88') || upper.includes('T3')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/30">
        {controlType}
      </span>
    );
  }
  if (upper.includes('LC100') || upper.includes('OP3000')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30">
        {controlType}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
      {controlType}
    </span>
  );
};

const getContractTypeBadge = (type: string | null) => {
  if (!type) return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">UMC</span>;
  const upper = type.toUpperCase();
  if (upper === 'UMC') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
        UMC
      </span>
    );
  }
  if (upper === 'AMC') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/30">
        AMC
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30">
      {type}
    </span>
  );
};

// ============================
// Component
// ============================
export default function AnnualContractReports({ role }: AnnualContractReportsProps) {
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

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

  // Load presets from localStorage & load initial master engineers/departments
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
        console.error('Failed to load initial master filter options:', err);
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
  const applyDatePreset = (preset: 'today' | 'this_month' | 'next_month' | 'this_quarter' | 'all') => {
    const now = new Date();
    if (preset === 'today') {
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
    setDateFrom('');
    setDateTo('');
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

  // Flat machine list
  const allMachines = useMemo(() => {
    return customers.flatMap(c => c.machines);
  }, [customers]);

  // Dynamic filter options extracted from master + active dataset
  const uniqueEngineers = useMemo(() => {
    const engs = new Set<string>(allEngineers);
    customers.forEach(c => {
      normalizeEngineerNames(c.engineerName).forEach(e => engs.add(e));
      c.machines.forEach(m => {
        normalizeEngineerNames(m.engineerName).forEach(e => engs.add(e));
      });
    });
    return Array.from(engs).sort();
  }, [allEngineers, customers]);

  const uniqueDepartments = useMemo(() => {
    const deps = new Set<string>(allDepartments);
    customers.forEach(c => {
      c.machines.forEach(m => {
        if (m.department && m.department.trim()) deps.add(m.department.trim());
      });
    });
    return Array.from(deps).sort();
  }, [allDepartments, customers]);

  // Export handler
  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      if (format === 'pdf') {
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
        await generateAnnualContractReportPdf(customers, stats, filters);
        toast.success('Annual Contract PDF Report exported successfully!');
        return;
      }

      const params: any = {};
      if (zoneFilter !== 'all') params.zone = zoneFilter;
      if (classFilter !== 'all') params.customerClass = classFilter;
      if (contractTypeFilter !== 'all') params.contractType = contractTypeFilter;
      if (unitTypeFilter !== 'all') params.unitType = unitTypeFilter;
      if (techFilter !== 'all') params.engineer = techFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (expiryFilter !== 'all') params.expiryBucket = expiryFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (search) params.search = search;
      params.format = format;

      const data = await apiService.exportDetailedContracts(params);

      // If it's a blob, download it
      if (data instanceof Blob) {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Annual_Contract_Report.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const machines = Array.isArray(data) ? data : (data.data || []);
        if (machines.length === 0) {
          toast.error('No data to export');
          return;
        }

        const headers = [
          'Sl No', 'Customer Name', 'Class', 'Place', 'Zone', 'Engineer',
          'Serial Number', 'Unit Type', 'Model', 'Control Type', 'Department',
          'Installation Year', 'Contract Type', 'MC PO Number', 'PO Date',
          'MC Start Date', 'MC End Date', 'MC Value', 'MC Expiry Status',
          'PM Visits', 'BD Visits'
        ];

        const rows = machines.map((m: any, idx: number) => [
          idx + 1,
          m.customerName || '',
          m.customerClass || '',
          m.place || '',
          m.zoneName || '',
          m.engineerName || '',
          m.serialNumber || '',
          m.unitType || '',
          m.modelNumber || '',
          m.controlType || '',
          m.department || '',
          m.installationYear || '',
          m.contractType || '',
          m.mcPoNumber || '',
          m.poDate || '',
          m.mcStartDate || '',
          m.mcEndDate || '',
          m.mcValue || 0,
          m.mcExpiry?.bucket || '',
          m.pmVisitsCount || 0,
          m.bdVisitsCount || 0
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Annual_Contract_Report.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
      toast.success(`Annual Contract ${format.toUpperCase()} Report exported successfully!`);
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error(`Failed to export ${format} report`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 print:space-y-3">
      {/* ═══ REPORT GENERATION CONTROLS — Card Layout ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        {/* Card Header — Title + Generate + Export Buttons */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Report Filters</h2>
              <p className="text-sm text-slate-500 mt-1">Configure parameters for annual machine contract report</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={fetchData}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#6F8A9D] hover:bg-[#546A7A] text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                <BarChart3 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={exporting || loading || allMachines.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[#4F6A64] text-[#4F6A64] hover:bg-[#A2B9AF]/10 font-semibold text-sm transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                  Export Excel
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exporting || loading || allMachines.length === 0}
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
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" />
                Contract Expiry Date Range
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400 mr-1">Quick ranges:</span>
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
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold text-slate-600">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Customer, serial no, engineer, model..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#82A094]/30"
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Zone</label>
              <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                <option value="all">All Zones</option>
                {['North', 'South', 'East', 'West'].map(z => <option key={z} value={z}>{z} Zone</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Customer Class</label>
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                <option value="all">All Classes (A/B/C)</option>
                <option value="A">Class A</option>
                <option value="B">Class B</option>
                <option value="C">Class C</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Contract Agreement Type</label>
              <select value={contractTypeFilter} onChange={(e) => setContractTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                <option value="all">All Contract Types</option>
                <option value="UMC">UMC (Comprehensive)</option>
                <option value="AMC">AMC (Annual Maintenance)</option>
                <option value="Flex Care">Flex Care</option>
                <option value="Full Care">Full Care</option>
                <option value="Non-Comprehensive">Non-Comprehensive</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Machine Unit / Model</label>
              <select value={unitTypeFilter} onChange={(e) => setUnitTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                <option value="all">All Machine Models</option>
                <option value="Shuttle">Shuttle XP / NT</option>
                <option value="Megamat">Megamat RS</option>
                <option value="Lektriver">Lektriver</option>
                <option value="Element">Element</option>
                <option value="Towermat">Towermat / Intermat</option>
                <option value="Compact">Compact / Miniload</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Responsible Engineer</label>
              <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                <option value="all">All Responsible Engineers</option>
                {uniqueEngineers.map(eng => <option key={eng} value={eng}>{eng}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Department</label>
              <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
                <option value="all">All Departments</option>
                {uniqueDepartments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Expiry Lifecycle</label>
              <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 font-medium">
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
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
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
          <h3 className="text-lg sm:text-xl font-bold text-slate-800">Ready to Generate Report</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Configure your filters above and click &quot;Generate Report&quot; to view customer-wise annual machine contracts and expiry status.
          </p>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-[#6F8A9D] hover:bg-[#546A7A] text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <BarChart3 className="w-5 h-5" />
            Generate Report
          </button>
        </div>
      )}

      {/* ═══ REPORT CONTENT (ONLY AFTER GENERATING) ═══ */}
      {hasGenerated && (
        <>
          {/* ═══ DYNAMIC SUMMARY KPI CARDS ═══ */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Machines</p>
                  <p className="text-lg font-extrabold text-slate-800">{stats.totalMachines}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#82A094]/10 flex items-center justify-center text-[#82A094] flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Customers</p>
                  <p className="text-lg font-extrabold text-slate-800">{stats.totalCustomers}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#CE9F6B]/10 flex items-center justify-center text-[#CE9F6B] flex-shrink-0">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total MC Value</p>
                  <p className="text-lg font-extrabold text-slate-800">{formatCurrency(stats.totalMCValue)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stats.expired > 0 ? 'bg-[#E17F70]/10 text-[#E17F70]' : 'bg-[#82A094]/10 text-[#82A094]'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expiring ≤30d / Expired</p>
                  <p className="text-lg font-extrabold text-slate-800">{stats.expiring30} / {stats.expired}</p>
                  <span className="text-[10px] text-emerald-600 font-bold block">{stats.active} Active</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LOADING STATE ═══ */}
          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
              <div className="w-10 h-10 border-3 border-[#82A094]/30 border-t-[#82A094] rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-700">Loading Annual Machine Contracts...</p>
            </div>
          )}

          {/* ═══ EMPTY STATE ═══ */}
          {!loading && allMachines.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#546A7A]/10 text-[#546A7A] flex items-center justify-center mb-4">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">No Annual Machine Contracts Found</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1">
                Adjust your filters or import machine contract data to see annual contract reports.
              </p>
            </div>
          )}

          {/* ═══ CUSTOMER GROUPED REPORT TABLE ═══ */}
          {!loading && customers.length > 0 && (
            <div className="space-y-3">
              {/* Results header */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {customers.length} Customers • {allMachines.length} Machines
                </p>
              </div>

          {customers.map((cust) => {
            const custZoneKey = `${cust.customerName}::${cust.zoneName}`;
            const isExpanded = expandedCustomer === custZoneKey;
            const theme = getCustomerTheme(cust.customerName);
            const overdueMachines = cust.machines.filter(m =>
              m.mcExpiry && (
                (m.mcExpiry.daysLeft !== null && m.mcExpiry.daysLeft < 0) ||
                m.mcExpiry.bucket === 'expired'
              )
            );

            return (
              <div
                key={custZoneKey}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                  isExpanded ? `${theme.border} ring-2 ring-[#6F8A9D]/15` : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => setExpandedCustomer(isExpanded ? null : custZoneKey)}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${theme.gradient} text-white flex items-center justify-center font-extrabold text-sm shadow-sm flex-shrink-0`}>
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-800 text-sm sm:text-base">
                          {cust.customerName}
                        </span>
                        {getClassBadge(cust.customerClass)}
                        {overdueMachines.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30">
                            <AlertCircle className="w-3 h-3" />
                            {overdueMachines.length} {overdueMachines.length === 1 ? 'Machine' : 'Machines'} Overdue
                          </span>
                        ) : cust.daysToEarliestExpiry !== null ? (
                          getExpiryBadge({ status: cust.expiryStatus, daysLeft: cust.daysToEarliestExpiry, bucket: cust.expiryBucket })
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#82A094]/15 text-[#4E7D6D] border border-[#82A094]/30">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        {cust.place && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#6F8A9D]" />
                            <span className="font-medium text-slate-600">{cust.place}</span>
                          </span>
                        )}
                        <span>•</span>
                        <span className="font-semibold text-slate-700">{cust.zoneName} Zone</span>
                        {cust.engineerName && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-slate-600">Eng: {formatEngineerDisplayName(cust.engineerName)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 self-end lg:self-center">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value</p>
                      <p className="text-sm sm:text-base font-extrabold text-slate-800">
                        {formatCurrency(cust.totalMCValue)}
                      </p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PM / BD</p>
                      <p className="text-xs font-bold text-slate-700">
                        {cust.totalPMVisits} PM · {cust.totalBDVisits} BD
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Machine Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 overflow-x-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#546A7A] flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-[#82A094]" />
                        Machine Inventory ({cust.machines.length} Units)
                      </h4>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                            <th className="px-3 py-2.5 text-left">#</th>
                            <th className="px-3 py-2.5 text-left">Serial No</th>
                            <th className="px-3 py-2.5 text-left">Unit / Model</th>
                            <th className="px-3 py-2.5 text-left">Control</th>
                            <th className="px-3 py-2.5 text-left">Responsible Engineer</th>
                            <th className="px-3 py-2.5 text-left">Department</th>
                            <th className="px-3 py-2.5 text-center">Install Year</th>
                            <th className="px-3 py-2.5 text-center">Type</th>
                            <th className="px-3 py-2.5 text-left">MC Period</th>
                            <th className="px-3 py-2.5 text-center">MC Expiry</th>
                            <th className="px-3 py-2.5 text-right">MC Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cust.machines.map((m, idx) => (
                            <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono">
                                  {m.serialNumber}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">{getUnitTypeBadge(m.unitType, m.modelNumber)}</td>
                              <td className="px-3 py-2.5">{getControlTypeBadge(m.controlType)}</td>
                              <td className="px-3 py-2.5 text-slate-700 font-medium">
                                {m.engineerName || cust.engineerName ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold">
                                    <User className="w-3 h-3 text-[#6F8A9D]" />
                                    {formatEngineerDisplayName(m.engineerName || cust.engineerName)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 font-medium">{m.department || '—'}</td>
                              <td className="px-3 py-2.5 text-center font-medium text-slate-600">
                                {m.installationYear || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {getContractTypeBadge(m.contractType)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                {m.mcStartDate || m.mcEndDate ? (
                                  <span className="font-medium">
                                    {formatDate(m.mcStartDate)} → {formatDate(m.mcEndDate)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center">{getExpiryBadge(m.mcExpiry)}</td>
                              <td className="px-3 py-2.5 text-right font-extrabold text-slate-800">
                                {formatCurrency(m.mcValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
