'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  MapPin,
  AlertTriangle,
  Clock,
  Shield,
  Calendar,
  IndianRupee,
  User,
  Eye,
  RefreshCw,
  Plus,
  Filter,
  X,
  Cpu,
  BarChart3,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle,
  Timer,
  Upload,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { getCustomerColorClass, extractDepartmentFromCustomer } from '@/lib/utils';

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
  customerId: number | null;
  customerClass: string | null;
  place: string | null;
  department: string | null;
  zoneName: string;
  engineerName: string | null;
  unitType: string | null;
  controlType: string | null;
  serialNumber: string;
  modelNumber: string | null;
  machineDetails: string | null;
  softwareName: string | null;
  installationYear: string | null;
  contractType: string | null;
  mcPoNumber: string | null;
  poDate: string | null;
  mcStartDate: string | null;
  mcEndDate: string | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  softwarePoNo: string | null;
  softwareStartDate: string | null;
  softwareEndDate: string | null;
  remoteSupportStartDate: string | null;
  remoteSupportEndDate: string | null;
  pmVisitsCount: number;
  bdVisitsCount: number;
  mcValue: number | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  mcExpiry: ExpiryInfo;
  warrantyExpiry: ExpiryInfo;
  softwareExpiry: ExpiryInfo;
  remoteSupportExpiry: ExpiryInfo;
}

interface CustomerGroup {
  customerName: string;
  customerId: number | null;
  customerClass: string | null;
  place: string | null;
  zoneName: string;
  engineerName: string | null;
  totalMachines: number;
  totalMCValue: number;
  totalPMVisits: number;
  totalBDVisits: number;
  machines: DetailedMachine[];
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

interface DetailedContractTrackingProps {
  role: string;
  basePath?: string;
}

// ============================
// Helpers
// ============================
const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return '—';
  return '₹' + Number(val).toLocaleString('en-IN');
};

const formatCurrencyCompact = (value: number | null) => {
  if (!value) return '₹0';
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }
  return formatCurrency(value);
};

const formatDate = (val: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const renderDateRange = (startDate: string | null, endDate: string | null) => {
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
          <Timer className="w-3 h-3" />
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
export default function DetailedContractTracking({ role, basePath }: DetailedContractTrackingProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [quickTab, setQuickTab] = useState<'all' | 'active' | 'expiring30' | 'expired'>('all');

  // Sorting
  const [sortField, setSortField] = useState<string>('customerName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination (for customer groups)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<DetailedMachine | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = role === 'Admin' || role === 'Zone Manager';

  const resolvedBasePath = useMemo(() => {
    if (basePath) return basePath;
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  }, [basePath, role]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (zoneFilter !== 'all') params.zone = zoneFilter;
      if (classFilter !== 'all') params.customerClass = classFilter;

      let effectiveExpiry = expiryFilter;
      if (quickTab === 'active') effectiveExpiry = 'healthy';
      if (quickTab === 'expiring30') effectiveExpiry = 'critical';
      if (quickTab === 'expired') effectiveExpiry = 'expired';

      const [groupedRes, statsRes] = await Promise.all([
        apiService.getDetailedContractsCustomerGrouped({
          ...params,
          search: debouncedSearch,
          expiryBucket: effectiveExpiry !== 'all' ? effectiveExpiry : undefined
        }),
        apiService.getDetailedContractStats(params),
      ]);

      const data = groupedRes?.data || groupedRes || [];
      setCustomers(Array.isArray(data) ? data : []);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to fetch detailed contracts:', error);
      toast.error('Failed to load annual contracts');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [zoneFilter, classFilter, expiryFilter, debouncedSearch, quickTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete action
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiService.deleteDetailedContract(deleteTarget.id);
      toast.success(`Deleted contract for machine ${deleteTarget.serialNumber}`);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete contract:', err);
      toast.error('Failed to delete contract');
    } finally {
      setDeleting(false);
    }
  };

  // Sort handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorted Customer Groups
  const sortedCustomerGroups = useMemo(() => {
    const list = [...customers];
    list.sort((a, b) => {
      let aVal: any = a.customerName.toLowerCase();
      let bVal: any = b.customerName.toLowerCase();

      if (sortField === 'customerName') {
        aVal = a.customerName.toLowerCase();
        bVal = b.customerName.toLowerCase();
      } else if (sortField === 'zoneName') {
        aVal = (a.zoneName || '').toLowerCase();
        bVal = (b.zoneName || '').toLowerCase();
      } else if (sortField === 'totalMCValue') {
        aVal = a.totalMCValue || 0;
        bVal = b.totalMCValue || 0;
      } else if (sortField === 'totalMachines') {
        aVal = a.totalMachines || 0;
        bVal = b.totalMachines || 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [customers, sortField, sortDirection]);

  // Paginated Customer Groups
  const totalPages = Math.ceil(sortedCustomerGroups.length / pageSize) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedCustomerGroups.slice(start, start + pageSize);
  }, [sortedCustomerGroups, currentPage, pageSize]);

  // Total machines across all fetched groups
  const totalMachinesCount = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.machines?.length || 0), 0);
  }, [customers]);

  const clearFilters = () => {
    setSearch('');
    setZoneFilter('all');
    setClassFilter('all');
    setExpiryFilter('all');
    setQuickTab('all');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    zoneFilter !== 'all' ||
    classFilter !== 'all' ||
    expiryFilter !== 'all' ||
    quickTab !== 'all';

  return (
    <div className="space-y-4">
      {/* ─── COMPACT HERO HEADER BANNER (Light Theme) ─── */}
      <div className="relative overflow-hidden bg-white rounded-xl shadow-xs border border-slate-200/80 p-3 sm:p-4 space-y-3">
        {/* Top Row: Title on Left, Action Buttons on Right */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Info */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#9E3B47]/10 text-[#9E3B47] rounded-lg border border-[#9E3B47]/20 shadow-2xs flex-shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight text-slate-900">
                  Annual Machine Contracts
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold uppercase tracking-wider text-slate-700">
                  {role}
                </span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-slate-500 text-[11px] sm:text-xs hidden sm:block">
                Customer-wise annual maintenance agreements, machine asset lifecycle, and multi-tier expiration monitoring
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs font-semibold h-8 px-2.5 shadow-2xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`${resolvedBasePath}/contracts/annual-reports`)}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs font-semibold h-8 px-2.5 shadow-2xs"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-[#CE9F6B]" />
              Annual Reports
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`${resolvedBasePath}/contracts/detailed-import`)}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs font-semibold h-8 px-2.5 shadow-2xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5 text-[#546A7A]" />
              Import
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => router.push(`${resolvedBasePath}/contracts/detailed/new`)}
                className="bg-[#9E3B47] hover:bg-[#852f3a] text-white text-xs font-bold h-8 px-3 shadow-xs hover:shadow transition-all"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Contract
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Row: Compact Stats Bar */}
        {stats && (
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
            {/* Total Machines */}
            <div
              onClick={() => { setQuickTab('all'); setExpiryFilter('all'); setCurrentPage(1); }}
              className="bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-slate-200/80 text-center flex items-center justify-between sm:flex-col sm:justify-center"
            >
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total M/C</span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900">{stats.totalMachines}</span>
            </div>

            {/* Customers */}
            <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-lg px-2.5 py-1.5 border border-slate-200/80 text-center flex items-center justify-between sm:flex-col sm:justify-center">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Customers</span>
              <span className="text-sm sm:text-base font-extrabold text-[#546A7A]">{stats.totalCustomers}</span>
            </div>

            {/* Total Value */}
            <div
              className="bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-lg px-2.5 py-1.5 border border-slate-200/80 text-center flex items-center justify-between sm:flex-col sm:justify-center"
              title={formatCurrency(stats.totalMCValue)}
            >
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total Value</span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-700 truncate font-mono">
                {formatCurrencyCompact(stats.totalMCValue)}
              </span>
            </div>

            {/* Expiring ≤30d */}
            <div
              onClick={() => { setQuickTab('expiring30'); setExpiryFilter('critical'); setCurrentPage(1); }}
              className="bg-rose-50/80 hover:bg-rose-100/80 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-rose-200 text-center flex items-center justify-between sm:flex-col sm:justify-center"
            >
              <span className="text-rose-600 text-[10px] uppercase font-bold tracking-wider">≤ 30d Left</span>
              <span className="text-sm sm:text-base font-extrabold text-rose-700">{stats.expiring30}</span>
            </div>

            {/* Expiring 31-90d */}
            <div
              onClick={() => { setQuickTab('all'); setExpiryFilter('warning'); setCurrentPage(1); }}
              className="bg-amber-50/80 hover:bg-amber-100/80 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-amber-200 text-center flex items-center justify-between sm:flex-col sm:justify-center"
            >
              <span className="text-amber-700 text-[10px] uppercase font-bold tracking-wider">31-90d Left</span>
              <span className="text-sm sm:text-base font-extrabold text-amber-800">
                {stats.expiring60 + stats.expiring90}
              </span>
            </div>

            {/* Expired */}
            <div
              onClick={() => { setQuickTab('expired'); setExpiryFilter('expired'); setCurrentPage(1); }}
              className="bg-rose-50/90 hover:bg-rose-100/90 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-rose-300 text-center flex items-center justify-between sm:flex-col sm:justify-center"
            >
              <span className="text-rose-700 text-[10px] uppercase font-bold tracking-wider">Expired</span>
              <span className="text-sm sm:text-base font-extrabold text-rose-800">{stats.expired}</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── QUICK FILTER TABS ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'All Machine Contracts', count: stats?.totalMachines ?? totalMachinesCount, color: 'bg-[#546A7A] hover:bg-[#5D6E73] text-white' },
            { id: 'active', label: 'Active Healthy', count: stats?.active ?? 0, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
            { id: 'expiring30', label: 'Expiring ≤ 30d', count: stats?.expiring30 ?? 0, color: 'bg-amber-600 hover:bg-amber-700 text-white' },
            { id: 'expired', label: 'Expired', count: stats?.expired ?? 0, color: 'bg-rose-600 hover:bg-rose-700 text-white' },
          ].map(tab => {
            const isActive = quickTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setQuickTab(tab.id as any);
                  if (tab.id === 'all') setExpiryFilter('all');
                  if (tab.id === 'active') setExpiryFilter('healthy');
                  if (tab.id === 'expiring30') setExpiryFilter('critical');
                  if (tab.id === 'expired') setExpiryFilter('expired');
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                  isActive
                    ? `${tab.color} shadow-sm`
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── SEARCH & FILTERS CARD ─── */}
      <Card className="border border-slate-200/80 shadow-sm bg-white">
        <CardHeader className="py-3 px-4 sm:px-6 bg-slate-50/70 border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#546A7A]" />
              <CardTitle className="text-sm font-bold text-slate-800">Search & Filter Annual Contracts</CardTitle>
              {hasActiveFilters && (
                <Badge variant="secondary" className="bg-[#9E3B47]/10 text-[#9E3B47] text-[10px] font-bold">
                  Active Filters
                </Badge>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs text-[#9E3B47] hover:text-[#75242D] hover:bg-[#9E3B47]/10 px-2"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Search */}
            <div className="space-y-1.5">
              <Label htmlFor="detailed-contract-search" className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-[#82A094]" />
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="detailed-contract-search"
                  placeholder="Customer, serial no, engineer, place, model..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs border-slate-200 focus:border-[#82A094] focus:ring-[#82A094]"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Zone Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#6F8A9D]" />
                Zone
              </Label>
              <Select
                value={zoneFilter}
                onValueChange={val => {
                  setZoneFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs border-slate-200">
                  <SelectValue placeholder="All Zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="North">North Zone</SelectItem>
                  <SelectItem value="South">South Zone</SelectItem>
                  <SelectItem value="East">East Zone</SelectItem>
                  <SelectItem value="West">West Zone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Class Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#CE9F6B]" />
                Customer Classification
              </Label>
              <Select
                value={classFilter}
                onValueChange={val => {
                  setClassFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs border-slate-200">
                  <SelectValue placeholder="All Classes (A/B/C)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes (A/B/C)</SelectItem>
                  <SelectItem value="A">Class A</SelectItem>
                  <SelectItem value="B">Class B</SelectItem>
                  <SelectItem value="C">Class C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Expiry Lifecycle Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#9E3B47]" />
                Expiry Lifecycle
              </Label>
              <Select
                value={expiryFilter}
                onValueChange={val => {
                  setExpiryFilter(val);
                  if (val === 'all') setQuickTab('all');
                  else if (val === 'critical') setQuickTab('expiring30');
                  else if (val === 'expired') setQuickTab('expired');
                  else if (val === 'healthy') setQuickTab('active');
                  else setQuickTab('all');
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs border-slate-200">
                  <SelectValue placeholder="All Expiry Lifecycles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Expiry Lifecycles</SelectItem>
                  <SelectItem value="critical">Critical (≤ 30 Days)</SelectItem>
                  <SelectItem value="warning">Warning (31 - 60 Days)</SelectItem>
                  <SelectItem value="attention">Upcoming (61 - 90 Days)</SelectItem>
                  <SelectItem value="healthy">Active Healthy (&gt; 90 Days)</SelectItem>
                  <SelectItem value="expired">Expired Contracts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── UNIFIED CONTRACTS TABLE (Customer Band + Machine Rows Style) ─── */}
      <Card className="border-0 shadow-xl overflow-hidden bg-white rounded-2xl">
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
                    {sortField === 'customerName' && (
                      <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
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
                <th className="px-2.5 py-2.5 text-left w-32 sticky top-0">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#CE9F6B]" />
                    <span>MC Period</span>
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
                    {sortField === 'totalMCValue' && (
                      <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
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
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-20 text-center bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#9E3B47] to-[#546A7A] flex items-center justify-center shadow-lg">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-800">Loading annual machine contracts...</p>
                        <p className="text-xs text-slate-400 mt-0.5">Fetching latest machine maintenance records</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-16 text-center bg-slate-50/40">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Layers className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-800">No machine contracts found</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {hasActiveFilters
                            ? 'No contracts matched your filter criteria. Try adjusting or clearing your filters.'
                            : 'No annual machine contracts have been recorded yet.'}
                        </p>
                      </div>
                      {hasActiveFilters ? (
                        <Button
                          variant="outline"
                          onClick={clearFilters}
                          className="mt-2 text-xs font-semibold text-slate-700"
                        >
                          <X className="h-3.5 w-3.5 mr-1.5" />
                          Clear All Filters
                        </Button>
                      ) : (
                        <Button
                          onClick={() => router.push(`${resolvedBasePath}/contracts/detailed/new`)}
                          className="mt-2 bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white text-xs font-bold shadow-md h-8"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Create First Contract
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((group, groupIndex) => {
                  const customerSlNo = (currentPage - 1) * pageSize + groupIndex + 1;
                  const dept = extractDepartmentFromCustomer(group.customerName);
                  const activeCount = group.machines.filter(m => getMachineStatus(m) === 'Active').length;
                  const expiredCount = group.machines.filter(m => getMachineStatus(m) === 'Expired').length;

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
                      {group.machines.map((m, mIdx) => {
                        const machineStatus = getMachineStatus(m);

                        return (
                          <tr
                            key={m.id}
                            onClick={() => router.push(`${resolvedBasePath}/contracts/detailed/${m.id}`)}
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
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    machineStatus === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
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
                              {m.engineerName ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-medium truncate max-w-[90px]" title={m.engineerName}>
                                  <User className="w-3 h-3 text-[#546A7A] shrink-0" />
                                  <span className="truncate">{m.engineerName}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-1 py-2 text-center w-10" onClick={e => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-slate-100 text-slate-600 rounded-md"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 bg-white shadow-lg text-xs">
                                  <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase font-bold">
                                    Machine Actions
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`${resolvedBasePath}/contracts/detailed/${m.id}`)}
                                    className="cursor-pointer flex items-center gap-2 text-xs"
                                  >
                                    <Eye className="h-4 w-4 text-[#546A7A]" />
                                    View Details
                                  </DropdownMenuItem>
                                  {canEdit && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => router.push(`${resolvedBasePath}/contracts/detailed/${m.id}/edit`)}
                                        className="cursor-pointer flex items-center gap-2 text-xs"
                                      >
                                        <Pencil className="h-4 w-4 text-[#82A094]" />
                                        Edit Contract
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteTarget(m)}
                                        className="cursor-pointer flex items-center gap-2 text-xs text-rose-600 focus:text-rose-600"
                                      >
                                        <Trash2 className="h-4 w-4 text-rose-600" />
                                        Delete Contract
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── TABLE PAGINATION FOOTER ─── */}
        {!loading && sortedCustomerGroups.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 px-2 rounded border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#9E3B47]"
              >
                <option value={25}>25 customers</option>
                <option value={50}>50 customers</option>
                <option value={100}>100 customers</option>
              </select>
              <span>of {sortedCustomerGroups.length} total customers</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="h-7 w-7 p-0"
                title="First Page"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Prev
              </Button>
              <span className="text-xs font-semibold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="h-7 px-2 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="h-7 w-7 p-0"
                title="Last Page"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ─── DELETE MODAL DIALOG ─── */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Delete Machine Contract?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to delete the contract for machine{' '}
              <span className="font-bold text-slate-800">{deleteTarget?.serialNumber}</span>{' '}
              ({deleteTarget?.customerName})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
