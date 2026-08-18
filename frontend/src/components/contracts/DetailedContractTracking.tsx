'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Building2, MapPin, ChevronRight, ChevronDown, ChevronUp,
  AlertTriangle, Clock, Shield, Calendar, IndianRupee, User, Eye,
  TrendingUp, ShieldCheck, RefreshCw, Plus, Filter, X,
  Cpu, Settings2, Wrench, BarChart3, Layers, FileText,
  AlertCircle, CheckCircle, Timer, Upload, Sparkles, Phone, Mail,
  Pencil, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

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
}

// ============================
// Helpers
// ============================
const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return '—';
  return '₹' + Number(val).toLocaleString('en-IN');
};

const formatDate = (val: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getExpiryBadge = (expiry: ExpiryInfo) => {
  if (!expiry || expiry.bucket === 'na') return <span className="text-xs text-slate-400">—</span>;

  const daysText = expiry.daysLeft !== null
    ? (expiry.daysLeft < 0 ? `${Math.abs(expiry.daysLeft)}d overdue` : `${expiry.daysLeft}d left`)
    : '';

  switch (expiry.bucket) {
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30 shadow-sm">
          <AlertCircle className="w-3 h-3" />
          {daysText || 'Expired'}
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30 shadow-sm">
          <AlertTriangle className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#CE9F6B]/15 text-[#B8874E] border border-[#CE9F6B]/30 shadow-sm">
          <Clock className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'attention':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30 shadow-sm">
          <Timer className="w-3 h-3" />
          {daysText}
        </span>
      );
    case 'healthy':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#82A094]/15 text-[#4E7D6D] border border-[#82A094]/30 shadow-sm">
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${colors[cls] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      Class {cls}
    </span>
  );
};

// ============================
// Component
// ============================
export default function DetailedContractTracking({ role }: DetailedContractTrackingProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'customer' | 'flat'>('customer');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<DetailedMachine | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = role === 'Admin' || role === 'Zone Manager';

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (zoneFilter !== 'all') params.zone = zoneFilter;
      if (classFilter !== 'all') params.customerClass = classFilter;

      const [groupedRes, statsRes] = await Promise.all([
        apiService.getDetailedContractsCustomerGrouped({ ...params, search, expiryBucket: expiryFilter }),
        apiService.getDetailedContractStats(params),
      ]);

      setCustomers(groupedRes.data || []);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to fetch detailed contracts:', error);
      toast.error('Failed to load detailed contracts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [zoneFilter, classFilter, expiryFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 350);
    return () => clearTimeout(timer);
  }, [search]);

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

  // Flat machine list for flat view mode
  const allMachines = useMemo(() => {
    return customers.flatMap(c => c.machines);
  }, [customers]);

  return (
    <div className="space-y-6">
      {/* ─── Kardex Hero Header ────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3D4F5C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#82A094]/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-[#CE9F6B]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-[#E17F70]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 mb-3 backdrop-blur-md">
              <Layers className="w-3.5 h-3.5 text-[#82A094]" />
              <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                Annual Machine Contracts
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Machine Contracts & Expiry Tracker
            </h1>
            <p className="text-sm text-white/80 mt-1.5 max-w-2xl font-medium">
              Customer-wise annual maintenance agreements, machine asset lifecycle, and multi-tier expiration monitoring.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchData}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm backdrop-blur-sm"
            >
              <RefreshCw className="w-4 h-4 text-[#82A094]" />
              <span>Refresh</span>
            </button>

            {canEdit && (
              <a
                href={`${getBaseRoute()}/contracts/detailed/new`}
                className="px-5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm backdrop-blur-sm"
              >
                <Plus className="w-4 h-4 text-[#82A094]" />
                <span>New Contract</span>
              </a>
            )}

            <a
              href={`${getBaseRoute()}/contracts/detailed-import`}
              className="px-5 py-2.5 rounded-2xl bg-[#82A094] hover:bg-[#6e8a7f] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg transform active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Import Excel</span>
            </a>
          </div>
        </div>
      </div>

      {/* ─── Executive KPI Cards ───────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <KPICard
            icon={<Cpu className="w-5 h-5" />}
            label="Total Machines"
            value={stats.totalMachines}
            color="text-[#546A7A]"
            bgColor="bg-[#546A7A]/10"
            border="border-[#546A7A]/20"
          />
          <KPICard
            icon={<Building2 className="w-5 h-5" />}
            label="Customers"
            value={stats.totalCustomers}
            color="text-[#6F8A9D]"
            bgColor="bg-[#6F8A9D]/10"
            border="border-[#6F8A9D]/20"
          />
          <KPICard
            icon={<IndianRupee className="w-5 h-5" />}
            label="Total MC Value"
            value={formatCurrency(stats.totalMCValue)}
            color="text-[#82A094]"
            bgColor="bg-[#82A094]/15"
            border="border-[#82A094]/30"
          />
          <KPICard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Expiring ≤ 30d"
            value={stats.expiring30}
            color="text-[#E17F70]"
            bgColor="bg-[#E17F70]/15"
            border="border-[#E17F70]/30"
            urgent={stats.expiring30 > 0}
          />
          <KPICard
            icon={<Clock className="w-5 h-5" />}
            label="Expiring 31-90d"
            value={stats.expiring60 + stats.expiring90}
            color="text-[#CE9F6B]"
            bgColor="bg-[#CE9F6B]/15"
            border="border-[#CE9F6B]/30"
          />
          <KPICard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Expired"
            value={stats.expired}
            color="text-rose-600"
            bgColor="bg-rose-50"
            border="border-rose-200"
          />
        </div>
      )}

      {/* ─── Filters & Controls Bar ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6F8A9D]" />
          <input
            type="text"
            placeholder="Search customer, serial no, engineer, place, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Zone Selector */}
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D] transition-all cursor-pointer"
        >
          <option value="all">All Zones</option>
          {['North', 'South', 'East', 'West'].map((z) => (
            <option key={z} value={z}>{z} Zone</option>
          ))}
        </select>

        {/* Category / Class Filter */}
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D] transition-all cursor-pointer"
        >
          <option value="all">All Classes (A/B/C)</option>
          <option value="A">Class A</option>
          <option value="B">Class B</option>
          <option value="C">Class C</option>
        </select>

        {/* Expiry Bucket Filter */}
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D] transition-all cursor-pointer"
        >
          <option value="all">All Expiry Lifecycles</option>
          <option value="critical">Critical (≤ 30 Days)</option>
          <option value="warning">Warning (31 - 60 Days)</option>
          <option value="attention">Upcoming (61 - 90 Days)</option>
          <option value="healthy">Active Healthy (&gt; 90 Days)</option>
          <option value="expired">Expired Contracts</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 ml-auto">
          <button
            onClick={() => setViewMode('customer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'customer'
                ? 'bg-[#546A7A] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Customer View
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'flat'
                ? 'bg-[#546A7A] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Machines List
          </button>
        </div>
      </div>

      {/* ─── Loading State ──────────────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
          <div className="w-10 h-10 border-3 border-[#82A094]/30 border-t-[#82A094] rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-700">Loading Annual Machine Contracts...</p>
        </div>
      )}

      {/* ─── Empty State ────────────────────────────────────── */}
      {!loading && customers.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#546A7A]/10 text-[#546A7A] flex items-center justify-center mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-800">No Annual Machine Contracts Found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1 mb-6">
            Upload your machine details Excel sheet or create a contract manually to track customer lifecycles.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {canEdit && (
              <a
                href={`${getBaseRoute()}/contracts/detailed/new`}
                className="px-6 py-3 rounded-2xl bg-[#546A7A] hover:bg-[#445663] text-white font-bold text-sm flex items-center gap-2 shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Contract</span>
              </a>
            )}
            <a
              href={`${getBaseRoute()}/contracts/detailed-import`}
              className="px-6 py-3 rounded-2xl bg-[#82A094] hover:bg-[#6e8a7f] text-white font-bold text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Import Excel Sheet</span>
            </a>
          </div>
        </div>
      )}

      {/* ─── Customer Grouped View ─────────────────────────── */}
      {!loading && viewMode === 'customer' && customers.length > 0 && (
        <div className="space-y-4">
          {customers.map((cust) => {
            const isExpanded = expandedCustomer === cust.customerName;
            return (
              <div
                key={cust.customerName}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                  isExpanded ? 'border-[#6F8A9D]/60 ring-2 ring-[#6F8A9D]/10' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => setExpandedCustomer(isExpanded ? null : cust.customerName)}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white flex items-center justify-center font-extrabold text-sm shadow-sm flex-shrink-0">
                      {cust.totalMachines}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-800 text-sm sm:text-base">
                          {cust.customerName}
                        </span>
                        {getClassBadge(cust.customerClass)}
                        {getExpiryBadge(
                          cust.daysToEarliestExpiry !== null
                            ? { status: cust.expiryStatus, daysLeft: cust.daysToEarliestExpiry, bucket: cust.expiryBucket }
                            : { status: 'N/A', daysLeft: null, bucket: 'na' }
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
                        <span className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-[#82A094]" />
                          <span className="font-semibold text-slate-700">{cust.zoneName} Zone</span>
                        </span>
                        {cust.engineerName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-[#546A7A]" />
                              <span className="font-medium text-slate-600">Eng: {cust.engineerName}</span>
                            </span>
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

                {/* Expanded Machine Table with Actions */}
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
                            <th className="px-3 py-2.5 text-left">Department</th>
                            <th className="px-3 py-2.5 text-center">Install Year</th>
                            <th className="px-3 py-2.5 text-center">Type</th>
                            <th className="px-3 py-2.5 text-left">MC Period</th>
                            <th className="px-3 py-2.5 text-center">MC Expiry</th>
                            <th className="px-3 py-2.5 text-right">MC Value</th>
                            <th className="px-3 py-2.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cust.machines.map((m, idx) => (
                            <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-2.5 font-bold text-slate-400">{m.slNo || idx + 1}</td>
                              <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                                {m.serialNumber}
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-800">{m.unitType || '—'}</td>
                              <td className="px-3 py-2.5 font-medium text-slate-600">{m.controlType || '—'}</td>
                              <td className="px-3 py-2.5 text-slate-600">{m.department || '—'}</td>
                              <td className="px-3 py-2.5 text-center font-medium text-slate-600">
                                {m.installationYear || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
                                  {m.contractType || 'UMC'}
                                </span>
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

                              {/* Row Action Buttons */}
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <a
                                    href={`${getBaseRoute()}/contracts/detailed/${m.id}`}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#546A7A] text-slate-600 hover:text-white transition-colors"
                                    title="View Contract Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </a>

                                  {canEdit && (
                                    <>
                                      <a
                                        href={`${getBaseRoute()}/contracts/detailed/${m.id}/edit`}
                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#82A094] text-slate-600 hover:text-white transition-colors"
                                        title="Edit Contract"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </a>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTarget(m);
                                        }}
                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white transition-colors"
                                        title="Delete Contract"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
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

      {/* ─── Flat Machines List View ────────────────────────── */}
      {!loading && viewMode === 'flat' && allMachines.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#546A7A] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#82A094]" />
              All Machine Contracts ({allMachines.length} Records)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-left">Customer</th>
                  <th className="px-3 py-3 text-left">Class</th>
                  <th className="px-3 py-3 text-left">Location / Zone</th>
                  <th className="px-3 py-3 text-left">Engineer</th>
                  <th className="px-3 py-3 text-left">Serial No</th>
                  <th className="px-3 py-3 text-left">Unit / Model</th>
                  <th className="px-3 py-3 text-left">Control</th>
                  <th className="px-3 py-3 text-center">Type</th>
                  <th className="px-3 py-3 text-left">MC Period</th>
                  <th className="px-3 py-3 text-center">MC Expiry</th>
                  <th className="px-3 py-3 text-right">MC Value</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allMachines.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-extrabold text-slate-800 max-w-[180px] truncate">
                      {m.customerName}
                    </td>
                    <td className="px-3 py-2.5">{getClassBadge(m.customerClass)}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <p className="font-medium text-slate-800">{m.place || '—'}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{m.zoneName} Zone</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 font-medium">{m.engineerName || '—'}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{m.serialNumber}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{m.unitType || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{m.controlType || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
                        {m.contractType || 'UMC'}
                      </span>
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

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={`${getBaseRoute()}/contracts/detailed/${m.id}`}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#546A7A] text-slate-600 hover:text-white transition-colors"
                          title="View Contract Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>

                        {canEdit && (
                          <>
                            <a
                              href={`${getBaseRoute()}/contracts/detailed/${m.id}/edit`}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#82A094] text-slate-600 hover:text-white transition-colors"
                              title="Edit Contract"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </a>

                            <button
                              onClick={() => setDeleteTarget(m)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white transition-colors"
                              title="Delete Contract"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ───────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Delete Machine Contract?</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Are you sure you want to delete the contract for machine{' '}
                <span className="font-bold text-slate-700">{deleteTarget.serialNumber}</span> ({deleteTarget.customerName})? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================
// KPI Card sub-component
// ============================
function KPICard({
  icon,
  label,
  value,
  color,
  bgColor,
  border,
  urgent
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
  border?: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border ${border || 'border-slate-100'} p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
        urgent ? 'ring-2 ring-[#E17F70]/30' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {urgent && (
          <span className="w-2 h-2 rounded-full bg-[#E17F70] animate-ping" />
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-lg sm:text-xl font-extrabold ${urgent ? 'text-[#E17F70]' : 'text-slate-800'} tracking-tight mt-0.5`}>
          {value}
        </p>
      </div>
    </div>
  );
}
