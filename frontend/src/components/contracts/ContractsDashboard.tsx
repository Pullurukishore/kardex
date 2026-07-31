'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, Search, Plus, Filter, Clock, CheckCircle, 
  AlertTriangle, X, TrendingUp, Sparkles, Building2, ShieldAlert,
  ChevronRight, Calendar, Info, RefreshCw, FileCheck, Check,
  User, MapPin, IndianRupee, Activity, HelpCircle
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  // Form dependencies loaded from DB
  const [customers, setCustomers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newPlace, setNewPlace] = useState('');
  const [newPoNo, setNewPoNo] = useState('');
  const [newPoDate, setNewPoDate] = useState('');
  const [newMcType, setNewMcType] = useState('Flex Care');
  const [newMachines, setNewMachines] = useState('1');
  const [newValue, setNewValue] = useState('');
  const [newVisits, setNewVisits] = useState('3');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newResponsible, setNewResponsible] = useState('Rahul');
  const [newZoneName, setNewZoneName] = useState('West');
  const [newBdCount, setNewBdCount] = useState('0');
  const [newPaymentTerms, setNewPaymentTerms] = useState('30 Days Net');
  const [newSoftwareSupport, setNewSoftwareSupport] = useState(false);

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

  // Load dependencies on mount
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const [cData, zData, uData] = await Promise.all([
          apiService.getCustomers({ limit: 1000 }),
          apiService.getZones(),
          apiService.getUsers()
        ]);
        setCustomers(cData);
        setZones(zData);
        setUsersList(uData.users || uData || []);
      } catch (err) {
        console.error('Failed to load form dependencies', err);
      }
    };
    loadDependencies();
  }, []);

  // Fetch contracts when filters change
  useEffect(() => {
    fetchContracts();
  }, [search, statusFilter, zoneFilter, techFilter]);

  // Handle customer dropdown selection
  const handleCustomerChange = (idStr: string) => {
    setSelectedCustomerId(idStr);
    const id = Number(idStr);
    const selectedCust = customers.find(c => c.id === id);
    if (selectedCust) {
      setNewCustName(selectedCust.companyName);
      setNewPlace(selectedCust.address || 'India');
      
      if (selectedCust.serviceZone) {
        setNewZoneName(selectedCust.serviceZone.name);
        setSelectedZoneId(String(selectedCust.serviceZoneId));
      }
    }
  };

  // Save new contract
  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !newPlace || !newPoNo || !newValue || !newStartDate || !newEndDate || !selectedZoneId) {
      toast.error('Please fill in all mandatory fields');
      return;
    }

    const val = parseFloat(newValue);
    const machines = parseInt(newMachines);
    const visits = parseInt(newVisits);
    const bds = parseInt(newBdCount);

    if (isNaN(val) || isNaN(machines) || isNaN(visits) || isNaN(bds)) {
      toast.error('Please enter valid numerical values');
      return;
    }

    try {
      await apiService.createContract({
        customerName: newCustName,
        place: newPlace,
        poNo: newPoNo,
        poDate: newPoDate || newStartDate,
        mcType: newMcType,
        noOfMachine: machines,
        amount: val,
        noOfVisits: visits,
        startDate: newStartDate,
        endDate: newEndDate,
        responsible: newResponsible,
        zoneName: newZoneName,
        bdCount: bds,
        paymentTerms: newPaymentTerms,
        softwareSupport: newSoftwareSupport,
        customerId: Number(selectedCustomerId),
        zoneId: Number(selectedZoneId)
      });

      setIsAddModalOpen(false);
      toast.success('Service Agreement created successfully!');
      
      // Reset fields
      setSelectedCustomerId('');
      setNewCustName('');
      setNewPlace('');
      setNewPoNo('');
      setNewPoDate('');
      setNewValue('');
      setNewSoftwareSupport(false);

      fetchContracts();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save agreement on database');
    }
  };

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

  // List of unique technicians for filter
  const uniqueTechnicians = useMemo(() => {
    const list = new Set(contracts.map(c => c.responsible).filter(Boolean));
    return Array.from(list);
  }, [contracts]);

  // KPI calculations
  const stats = useMemo(() => {
    const totalActive = contracts.filter(c => c.status === 'Active').length;
    const totalAmount = contracts.reduce((sum, c) => c.status === 'Active' ? sum + Number(c.amount) : sum, 0);
    const totalPMs = contracts.reduce((sum, c) => sum + c.pmSchedules.filter(p => p.status === 'Completed').length, 0);
    const totalExpectedPMs = contracts.reduce((sum, c) => sum + c.pmSchedules.filter(p => p.status !== 'Not Applicable').length, 0);
    const pmCompletionRate = totalExpectedPMs > 0 ? Math.round((totalPMs / totalExpectedPMs) * 100) : 0;
    const totalBDs = contracts.reduce((sum, c) => sum + c.bdCount, 0);
    return {
      totalActive,
      totalAmount,
      pmCompletionRate,
      totalBDs
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
      if (c.status === 'Active' && amounts[c.zoneName] !== undefined) {
        amounts[c.zoneName] += Number(c.amount);
      }
    });
    return Object.entries(amounts).map(([name, value]) => ({ name, value }));
  }, [contracts]);

  const engineerWorkload = useMemo(() => {
    const counts: Record<string, number> = {};
    contracts.forEach(c => {
      const name = c.responsible || 'Unassigned';
      counts[name] = (counts[name] || 0) + 1;
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
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'Pending', value: pending, color: '#F59E0B' }
    ];
  }, [contracts]);

  const getStatusBadge = (status: Contract['status']) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'Expiring Soon':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'Expired':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getSlaColor = (mcType: string) => {
    if (mcType.includes('Premium')) {
      return 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm';
    } else if (mcType.includes('Active')) {
      return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-sm';
    }
    return 'bg-gradient-to-r from-slate-400 to-slate-600 text-white shadow-sm';
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#82A094]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-[#E17F70]/10 rounded-full blur-3xl" />
        
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
              onClick={() => setIsAddModalOpen(true)}
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Agreements</p>
                <h3 className="text-2xl font-bold text-slate-700">{stats.totalActive}</h3>
                <span className="inline-flex items-center text-xs font-medium text-emerald-600 gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>SLA Persistent</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#82A094]/10 flex items-center justify-center text-[#82A094]">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Portfolio Value</p>
                <h3 className="text-2xl font-bold text-slate-700">₹{stats.totalAmount.toLocaleString('en-IN')}</h3>
                <span className="inline-flex items-center text-xs font-medium text-emerald-600 gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Direct revenue</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <IndianRupee className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">PM Visit Completion</p>
                <h3 className="text-2xl font-bold text-slate-700">{stats.pmCompletionRate}%</h3>
                <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.pmCompletionRate}%` }} />
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Breakdowns logged</p>
                <h3 className="text-2xl font-bold text-slate-700">{stats.totalBDs} Incidents</h3>
                <span className="inline-flex items-center text-xs font-medium text-rose-600 gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>SLA Response Active</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-medium text-slate-800">
            
            {/* Chart 1: MC Type Distribution */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
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
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {mcTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Contracts`, 'Care Level']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Zone Value Data */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Portfolio Value by Zone</h3>
                <p className="text-xs text-slate-400">Active contract financial value distribution</p>
              </div>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={zoneValueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
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

            {/* Chart 3: Engineer Workload */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Top Engineers Workload</h3>
                <p className="text-xs text-slate-400">Number of active agreements managed by responsible engineers</p>
              </div>
              <div className="h-64 mt-4">
                {engineerWorkload.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">No active workload logs.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engineerWorkload} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={80} />
                      <Tooltip formatter={(value) => [`${value} Contracts`, 'Workload']} />
                      <Bar dataKey="value" fill="#6F8A9D" radius={[0, 8, 8, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 4: PM Status Gauge / Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
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
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pmStatusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Visits`, 'Status']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
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
                            <div className="flex gap-1.5 items-center">
                              {[1, 2, 3, 4].map(num => {
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
                            {c.bdCount}
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

      {/* Add New Contract Dialog (Modal) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 relative border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Add Service Agreement</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddContract} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Select Customer *</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none"
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Place (Location) *</label>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Auto-filled from Customer"
                    value={newPlace}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">PO Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-12345"
                    value={newPoNo}
                    onChange={(e) => setNewPoNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">PO Date</label>
                  <input
                    type="date"
                    value={newPoDate}
                    onChange={(e) => setNewPoDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">MC Contract Type</label>
                  <select
                    value={newMcType}
                    onChange={(e) => setNewMcType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none"
                  >
                    <option value="Flex Care">Flex Care</option>
                    <option value="Active Care">Active Care</option>
                    <option value="Premium Care">Premium Care</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Service Zone</label>
                  <input
                    type="text"
                    readOnly
                    value={newZoneName}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Machines Covered</label>
                  <input
                    type="number"
                    min="1"
                    value={newMachines}
                    onChange={(e) => setNewMachines(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Contract Value Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 150000"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Number of Visits</label>
                  <select
                    value={newVisits}
                    onChange={(e) => setNewVisits(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none"
                  >
                    <option value="1">1 PM Visit</option>
                    <option value="2">2 PM Visits</option>
                    <option value="3">3 PM Visits</option>
                    <option value="4">4 PM Visits</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">BDs Logged / Incidents</label>
                  <input
                    type="number"
                    min="0"
                    value={newBdCount}
                    onChange={(e) => setNewBdCount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Contract Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Contract End Date *</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Responsible Eng</label>
                  <select
                    value={newResponsible}
                    onChange={(e) => setNewResponsible(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none"
                  >
                    {usersList.map((u: any) => (
                      <option key={u.id} value={u.name || u.email}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
                  <input
                    type="text"
                    value={newPaymentTerms}
                    onChange={(e) => setNewPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sw_support"
                  checked={newSoftwareSupport}
                  onChange={(e) => setNewSoftwareSupport(e.target.checked)}
                  className="w-4 h-4 text-[#82A094] border-slate-300 rounded focus:ring-[#82A094]"
                />
                <label htmlFor="sw_support" className="text-slate-600 font-bold select-none cursor-pointer">Include Software Support License</label>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 text-xs transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#82A094] hover:bg-[#6e897e] rounded-xl font-bold text-white text-xs transition-all active:scale-[0.98]"
                >
                  Save Agreement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
