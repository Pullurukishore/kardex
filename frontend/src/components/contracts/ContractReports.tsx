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

  // Active Report Type Selector
  const [reportType, setReportType] = useState<'customer-portfolio' | 'pm-overview' | 'expiring-contracts' | 'zone-summary' | 'technician-pm'>('customer-portfolio');

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

  // 2. PM VISIT SCHEDULE DATA
  const pmOverviewRows = useMemo(() => {
    let filteredContracts = [...contracts];
    if (search) {
      const s = search.toLowerCase();
      filteredContracts = filteredContracts.filter(c =>
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.place || '').toLowerCase().includes(s) ||
        (c.contractNumber || '').toLowerCase().includes(s) ||
        (c.poNo || '').toLowerCase().includes(s) ||
        (c.responsible || '').toLowerCase().includes(s)
      );
    }
    if (zoneFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.zoneName === zoneFilter);
    if (statusFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.status === statusFilter);
    if (techFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.responsible === techFilter);
    if (mcTypeFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.mcType === mcTypeFilter);
    if (swFilter === 'yes') filteredContracts = filteredContracts.filter(c => c.softwareSupport);
    if (swFilter === 'no') filteredContracts = filteredContracts.filter(c => !c.softwareSupport);

    if (expiryFilter !== 'all') {
      const days = Number(expiryFilter);
      filteredContracts = filteredContracts.filter(c => {
        const rem = getDaysRemaining(c.endDate);
        return rem >= 0 && rem <= days;
      });
    }

    const rows: any[] = [];
    filteredContracts.forEach(c => {
      c.pmSchedules.forEach(pm => {
        if (pm.status === 'Not Applicable') return;
        const done = pm.status === 'Completed';
        const overdue = !done && pm.range && isRangeOverdue(pm.range);
        const pmStatus = done ? 'Completed' : overdue ? 'Overdue' : 'Pending';

        if (pmFilter === 'completed' && pmStatus !== 'Completed') return;
        if (pmFilter === 'overdue' && pmStatus !== 'Overdue') return;
        if (pmFilter === 'not-started' && pmStatus !== 'Pending') return;

        rows.push({
          id: pm.id,
          contractNumber: c.contractNumber,
          contractId: c.id,
          customerName: c.customerName,
          place: c.place,
          zoneName: c.zoneName,
          pmNumber: pm.pmNumber,
          range: pm.range,
          pmStatus,
          completedAt: pm.completedAt,
          responsible: c.responsible,
          mcType: c.mcType,
          amount: c.amount
        });
      });
    });

    rows.sort((a, b) => {
      const statusWeight = (s: string) => s === 'Overdue' ? 0 : s === 'Pending' ? 1 : 2;
      return statusWeight(a.pmStatus) - statusWeight(b.pmStatus);
    });

    return rows;
  }, [contracts, search, zoneFilter, statusFilter, techFilter, mcTypeFilter, swFilter, expiryFilter, pmFilter]);

  // 3. EXPIRING CONTRACTS DATA
  const expiringContractsRows = useMemo(() => {
    let filteredContracts = [...contracts];
    if (search) {
      const s = search.toLowerCase();
      filteredContracts = filteredContracts.filter(c =>
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.place || '').toLowerCase().includes(s) ||
        (c.contractNumber || '').toLowerCase().includes(s) ||
        (c.poNo || '').toLowerCase().includes(s) ||
        (c.responsible || '').toLowerCase().includes(s)
      );
    }
    if (zoneFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.zoneName === zoneFilter);
    if (statusFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.status === statusFilter);
    if (techFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.responsible === techFilter);
    if (mcTypeFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.mcType === mcTypeFilter);
    if (swFilter === 'yes') filteredContracts = filteredContracts.filter(c => c.softwareSupport);
    if (swFilter === 'no') filteredContracts = filteredContracts.filter(c => !c.softwareSupport);

    if (pmFilter !== 'all') {
      filteredContracts = filteredContracts.filter(c => {
        const { pct, overdue } = getPMStats(c.pmSchedules);
        if (pmFilter === 'completed') return pct === 100;
        if (pmFilter === 'overdue') return overdue > 0;
        if (pmFilter === 'not-started') return pct === 0;
        return true;
      });
    }

    const rows = filteredContracts.map(c => {
      const daysRemaining = getDaysRemaining(c.endDate);
      const urgency = daysRemaining <= 0 ? 'Expired' : daysRemaining <= 30 ? 'Critical' : daysRemaining <= 60 ? 'Warning' : 'Notice';
      const pmStats = getPMStats(c.pmSchedules);

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        customerName: c.customerName,
        place: c.place,
        zoneName: c.zoneName,
        endDate: c.endDate,
        daysRemaining,
        urgency,
        pmPercentage: pmStats.pct,
        amount: c.amount,
        responsible: c.responsible
      };
    }).filter(row => row.daysRemaining <= 90);

    rows.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return rows;
  }, [contracts, search, zoneFilter, statusFilter, techFilter, mcTypeFilter, swFilter, pmFilter]);

  // 4. ZONE CONTRACT SUMMARY
  const zoneSummaryRows = useMemo(() => {
    let filteredContracts = [...contracts];
    if (search) {
      const s = search.toLowerCase();
      filteredContracts = filteredContracts.filter(c =>
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.place || '').toLowerCase().includes(s) ||
        (c.contractNumber || '').toLowerCase().includes(s) ||
        (c.poNo || '').toLowerCase().includes(s) ||
        (c.responsible || '').toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.status === statusFilter);
    if (techFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.responsible === techFilter);
    if (mcTypeFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.mcType === mcTypeFilter);
    if (swFilter === 'yes') filteredContracts = filteredContracts.filter(c => c.softwareSupport);
    if (swFilter === 'no') filteredContracts = filteredContracts.filter(c => !c.softwareSupport);

    if (expiryFilter !== 'all') {
      const days = Number(expiryFilter);
      filteredContracts = filteredContracts.filter(c => {
        const rem = getDaysRemaining(c.endDate);
        return rem >= 0 && rem <= days;
      });
    }

    const zonesMap: Record<string, any> = {};
    filteredContracts.forEach(c => {
      const zone = c.zoneName || 'Unassigned';
      if (!zonesMap[zone]) {
        zonesMap[zone] = {
          zoneName: zone,
          totalContracts: 0,
          activeContracts: 0,
          expiringContracts: 0,
          expiredContracts: 0,
          totalValue: 0,
          totalMachines: 0,
          pmCompleted: 0,
          pmTotal: 0,
          technicians: new Set<string>()
        };
      }

      zonesMap[zone].totalContracts++;
      if (c.status === 'Active') zonesMap[zone].activeContracts++;
      else if (c.status === 'Expiring Soon') zonesMap[zone].expiringContracts++;
      else if (c.status === 'Expired') zonesMap[zone].expiredContracts++;

      zonesMap[zone].totalValue += Number(c.amount);
      zonesMap[zone].totalMachines += c.noOfMachine;
      if (c.responsible) zonesMap[zone].technicians.add(c.responsible);

      const pmStats = getPMStats(c.pmSchedules);
      zonesMap[zone].pmCompleted += pmStats.completed;
      zonesMap[zone].pmTotal += pmStats.total;
    });

    const rows = Object.values(zonesMap).map((z: any) => ({
      ...z,
      pmPercentage: z.pmTotal > 0 ? Math.round((z.pmCompleted / z.pmTotal) * 100) : 0,
      technicianCount: z.technicians.size
    }));

    if (zoneFilter !== 'all') {
      return rows.filter(z => z.zoneName === zoneFilter);
    }

    rows.sort((a, b) => b.totalValue - a.totalValue);
    return rows;
  }, [contracts, search, zoneFilter, statusFilter, techFilter, mcTypeFilter, swFilter, expiryFilter]);

  // 5. TECHNICIAN PERFORMANCE DATA
  const technicianPmRows = useMemo(() => {
    let filteredContracts = [...contracts];
    if (search) {
      const s = search.toLowerCase();
      filteredContracts = filteredContracts.filter(c =>
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.place || '').toLowerCase().includes(s) ||
        (c.contractNumber || '').toLowerCase().includes(s) ||
        (c.poNo || '').toLowerCase().includes(s) ||
        (c.responsible || '').toLowerCase().includes(s)
      );
    }
    if (zoneFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.zoneName === zoneFilter);
    if (statusFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.status === statusFilter);
    if (mcTypeFilter !== 'all') filteredContracts = filteredContracts.filter(c => c.mcType === mcTypeFilter);
    if (swFilter === 'yes') filteredContracts = filteredContracts.filter(c => c.softwareSupport);
    if (swFilter === 'no') filteredContracts = filteredContracts.filter(c => !c.softwareSupport);

    if (expiryFilter !== 'all') {
      const days = Number(expiryFilter);
      filteredContracts = filteredContracts.filter(c => {
        const rem = getDaysRemaining(c.endDate);
        return rem >= 0 && rem <= days;
      });
    }

    const techMap: Record<string, any> = {};
    filteredContracts.forEach(c => {
      const tech = c.responsible || 'Unassigned';
      if (!techMap[tech]) {
        techMap[tech] = {
          technician: tech,
          assignedContracts: 0,
          totalPMs: 0,
          completedPMs: 0,
          pendingPMs: 0,
          overduePMs: 0,
          totalMachines: 0,
          totalValue: 0,
          zones: new Set<string>()
        };
      }

      techMap[tech].assignedContracts++;
      techMap[tech].totalMachines += c.noOfMachine;
      techMap[tech].totalValue += Number(c.amount);
      if (c.zoneName) techMap[tech].zones.add(c.zoneName);

      c.pmSchedules.forEach(pm => {
        if (pm.status === 'Not Applicable') return;
        techMap[tech].totalPMs++;
        if (pm.status === 'Completed') {
          techMap[tech].completedPMs++;
        } else {
          const overdue = pm.range && isRangeOverdue(pm.range);
          if (overdue) techMap[tech].overduePMs++;
          else techMap[tech].pendingPMs++;
        }
      });
    });

    const rows = Object.values(techMap).map((t: any) => ({
      ...t,
      completionPercentage: t.totalPMs > 0 ? Math.round((t.completedPMs / t.totalPMs) * 100) : 0,
      zones: Array.from(t.zones)
    }));

    if (techFilter !== 'all') {
      return rows.filter(t => t.technician === techFilter);
    }

    rows.sort((a, b) => b.completionPercentage - a.completionPercentage);
    return rows;
  }, [contracts, search, zoneFilter, statusFilter, techFilter, mcTypeFilter, swFilter, expiryFilter]);

  // Overall KPI summaries
  const selectedSummary = useMemo(() => {
    if (reportType === 'customer-portfolio') {
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
    }

    if (reportType === 'pm-overview') {
      const totalPMs = pmOverviewRows.length;
      const completedPMs = pmOverviewRows.filter(r => r.pmStatus === 'Completed').length;
      const overduePMs = pmOverviewRows.filter(r => r.pmStatus === 'Overdue').length;
      const pendingPMs = totalPMs - completedPMs;
      const completionPercentage = totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0;
      const totalContracts = new Set(pmOverviewRows.map(r => r.contractNumber)).size;

      return {
        totalPMs,
        completedPMs,
        overduePMs,
        pendingPMs,
        completionPercentage,
        totalContracts
      };
    }

    if (reportType === 'expiring-contracts') {
      const totalExpiring = expiringContractsRows.length;
      const critical = expiringContractsRows.filter(r => r.urgency === 'Critical' || r.urgency === 'Expired').length;
      const warning = expiringContractsRows.filter(r => r.urgency === 'Warning').length;
      const notice = expiringContractsRows.filter(r => r.urgency === 'Notice').length;
      const totalValue = expiringContractsRows.reduce((sum, r) => sum + Number(r.amount), 0);

      return {
        totalExpiring,
        critical,
        warning,
        notice,
        totalValue
      };
    }

    if (reportType === 'zone-summary') {
      const totalZones = zoneSummaryRows.length;
      const totalContracts = zoneSummaryRows.reduce((sum, r) => sum + r.totalContracts, 0);
      const totalValue = zoneSummaryRows.reduce((sum, r) => sum + r.totalValue, 0);
      const totalMachines = zoneSummaryRows.reduce((sum, r) => sum + r.totalMachines, 0);
      const pmCompleted = zoneSummaryRows.reduce((sum, r) => sum + r.pmCompleted, 0);
      const pmTotal = zoneSummaryRows.reduce((sum, r) => sum + r.pmTotal, 0);
      const pmPercentage = pmTotal > 0 ? Math.round((pmCompleted / pmTotal) * 100) : 0;

      return {
        totalZones,
        totalContracts,
        totalValue,
        totalMachines,
        pmCompleted,
        pmTotal,
        pmPercentage
      };
    }

    if (reportType === 'technician-pm') {
      const totalTechnicians = technicianPmRows.length;
      const totalPMs = technicianPmRows.reduce((sum, r) => sum + r.totalPMs, 0);
      const completedPMs = technicianPmRows.reduce((sum, r) => sum + r.completedPMs, 0);
      const pendingPMs = technicianPmRows.reduce((sum, r) => sum + r.pendingPMs, 0);
      const overduePMs = technicianPmRows.reduce((sum, r) => sum + r.overduePMs, 0);
      const avgCompletion = totalTechnicians > 0
        ? Math.round(technicianPmRows.reduce((sum, r) => sum + r.completionPercentage, 0) / totalTechnicians)
        : 0;

      return {
        totalTechnicians,
        totalPMs,
        completedPMs,
        pendingPMs,
        overduePMs,
        avgCompletion
      };
    }

    return {};
  }, [reportType, customerSummaries, pmOverviewRows, expiringContractsRows, zoneSummaryRows, technicianPmRows]);

  // Export combined reports
  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const params: any = { reportType: 'all', format };
      if (zoneFilter !== 'all') params.zone = zoneFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (techFilter !== 'all') params.responsible = techFilter;
      if (search) params.search = search;

      const blob = await apiService.exportContractReport(params);
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const fileExt = format === 'pdf' ? 'pdf' : 'xlsx';

      const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `KardexCare-Combined-Contract-Reports-${Date.now()}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${format === 'pdf' ? 'Combined PDF Package' : 'Combined Excel Workbook'} exported successfully!`);
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error(`Failed to export ${format} report`);
    } finally {
      setExporting(false);
    }
  };

  const reportTypes = [
    { id: 'customer-portfolio', label: 'Customer Portfolio', icon: Building2 },
    { id: 'pm-overview', label: 'PM Visit Schedule', icon: Calendar },
    { id: 'expiring-contracts', label: 'Expiring Contracts', icon: Clock },
    { id: 'zone-summary', label: 'Zone Summary', icon: MapPin },
    { id: 'technician-pm', label: 'Technician PM', icon: User }
  ];

  const getFilterHeaderCount = () => {
    if (reportType === 'customer-portfolio') return `${customerSummaries.length} customers`;
    if (reportType === 'pm-overview') return `${pmOverviewRows.length} PM visits`;
    if (reportType === 'expiring-contracts') return `${expiringContractsRows.length} contracts`;
    if (reportType === 'zone-summary') return `${zoneSummaryRows.length} zones`;
    return `${technicianPmRows.length} technicians`;
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

      {/* ═══ REPORT TYPE TABS ═══ */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit print:hidden">
        {reportTypes.map((tab) => {
          const Icon = tab.icon;
          const active = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setReportType(tab.id as any);
                setExpandedCustomerId(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                active
                  ? "bg-[#546A7A] text-white shadow-md shadow-[#546A7A]/25"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-55"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
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

        {reportType === 'pm-overview' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Scheduled PMs</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalPMs}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-650 flex-shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Completed Visits</p>
                <p className="text-lg font-extrabold text-emerald-600">{selectedSummary.completedPMs}</p>
                <span className="text-[10px] text-slate-400 font-medium block">{selectedSummary.pendingPMs} Pending</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-650 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Overdue Visits</p>
                <p className="text-lg font-extrabold text-rose-600">{selectedSummary.overduePMs}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-650 flex-shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PM Progress</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.completionPercentage}%</p>
              </div>
            </div>
          </>
        )}

        {reportType === 'expiring-contracts' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expiring Contracts</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalExpiring}</p>
                <span className="text-[10px] text-slate-400 font-medium block">Within 90 Days</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-650 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Critical (≤30 Days)</p>
                <p className="text-lg font-extrabold text-rose-600">{selectedSummary.critical}</p>
                <span className="text-[10px] text-slate-400 font-medium block">Includes Expired</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-650 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Warnings (31-60 Days)</p>
                <p className="text-lg font-extrabold text-amber-600">{selectedSummary.warning}</p>
                <span className="text-[10px] text-slate-400 font-medium block">{selectedSummary.notice} Notice (61-90)</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-650 flex-shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expiring Value</p>
                <p className="text-lg font-extrabold text-slate-800">{formatCurrency(selectedSummary.totalValue || 0)}</p>
              </div>
            </div>
          </>
        )}

        {reportType === 'zone-summary' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#82A094]/10 flex items-center justify-center text-[#82A094] flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Service Zones</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalZones}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Contracts</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalContracts}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-650 flex-shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Portfolio Value</p>
                <p className="text-lg font-extrabold text-slate-800">{formatCurrency(selectedSummary.totalValue || 0)}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-650 flex-shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PM Completion Rate</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.pmPercentage}%</p>
              </div>
            </div>
          </>
        )}

        {reportType === 'technician-pm' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#82A094]/10 flex items-center justify-center text-[#82A094] flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Technicians</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalTechnicians}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#546A7A]/10 flex items-center justify-center text-[#546A7A] flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Assigned PM Visits</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.totalPMs}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-650 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Overdue Visits</p>
                <p className="text-lg font-extrabold text-rose-605">{selectedSummary.overduePMs}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-650 flex-shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Avg Completion %</p>
                <p className="text-lg font-extrabold text-slate-800">{selectedSummary.avgCompletion}%</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ PM COMPLETION OVERVIEW BAR ═══ */}
      {(reportType === 'customer-portfolio' || reportType === 'pm-overview' || reportType === 'zone-summary') && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                <circle
                  cx="32" cy="32" r="26" fill="none"
                  stroke={Number(selectedSummary.pmPercentage || selectedSummary.pmPct || 0) >= 75 ? '#10b981' : Number(selectedSummary.pmPercentage || selectedSummary.pmPct || 0) >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={2 * Math.PI * 26 - (Number(selectedSummary.pmPercentage || selectedSummary.pmPct || 0) / 100) * 2 * Math.PI * 26}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute text-xs font-extrabold text-slate-700">{selectedSummary.pmPercentage || selectedSummary.pmPct || 0}%</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Preventive Maintenance Overview</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Across all filtered records: {selectedSummary.pmCompleted || selectedSummary.completedPMs || 0} of {selectedSummary.pmTotal || selectedSummary.totalPMs || 0} PM visits completed • {selectedSummary.pmOverdue || selectedSummary.overduePMs || 0} overdue
            </p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${selectedSummary.pmPercentage || selectedSummary.pmPct || 0}%`,
                  background: Number(selectedSummary.pmPercentage || selectedSummary.pmPct || 0) >= 75 ? '#10b981' : Number(selectedSummary.pmPercentage || selectedSummary.pmPct || 0) >= 40 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        </div>
      )}

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
          {reportType !== 'zone-summary' && reportType !== 'technician-pm' && (
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
            </select>
          )}

          {/* Responsible */}
          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
            <option value="all">All Responsible</option>
            {uniqueTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* MC Type */}
          {reportType !== 'zone-summary' && reportType !== 'technician-pm' && (
            <select value={mcTypeFilter} onChange={(e) => setMcTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
              <option value="all">All MC Types</option>
              {uniqueMcTypes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}

          {/* PM Progress */}
          {(reportType === 'customer-portfolio' || reportType === 'pm-overview') && (
            <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
              <option value="all">All PM Status</option>
              <option value="completed">100% Completed</option>
              <option value="on-track">On Track (≥50%)</option>
              <option value="behind">Behind (&lt;50%)</option>
              <option value="overdue">Has Overdue PMs</option>
              <option value="not-started">Not Started (0%)</option>
            </select>
          )}

          {/* Expiry Window */}
          {reportType !== 'expiring-contracts' && (
            <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
              <option value="all">All Expiry</option>
              <option value="30">Expiring in 30 Days</option>
              <option value="60">Expiring in 60 Days</option>
              <option value="90">Expiring in 90 Days</option>
            </select>
          )}

          {/* SW Support */}
          {reportType !== 'zone-summary' && reportType !== 'technician-pm' && (
            <select value={swFilter} onChange={(e) => setSwFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none font-medium">
              <option value="all">SW Support</option>
              <option value="yes">With SW</option>
              <option value="no">Without SW</option>
            </select>
          )}
        </div>
      </div>

      {/* ═══ TABLE / LIST CONTAINER ═══ */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading reports data...</p>
        </div>
      ) : reportType === 'customer-portfolio' && customerSummaries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No customers match the current filter criteria.</p>
        </div>
      ) : reportType === 'pm-overview' && pmOverviewRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm space-y-3">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No PM visits match the current filter criteria.</p>
        </div>
      ) : reportType === 'expiring-contracts' && expiringContractsRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm space-y-3">
          <Clock className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No expiring contracts match the current filter criteria.</p>
        </div>
      ) : reportType === 'zone-summary' && zoneSummaryRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm space-y-3">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No zone summaries match the current filter criteria.</p>
        </div>
      ) : reportType === 'technician-pm' && technicianPmRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm space-y-3">
          <User className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No technician summaries match the current filter criteria.</p>
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
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#6e897e] flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0 shadow-sm">
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

          {/* 2. PM VISIT SCHEDULE LAYOUT */}
          {reportType === 'pm-overview' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#546A7A] text-white font-bold select-none">
                      <th className="p-4 text-center">Contract No</th>
                      <th className="p-4">Customer Details</th>
                      <th className="p-4 text-center">PM Visit</th>
                      <th className="p-4 text-center">Scheduled Window</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Completed</th>
                      <th className="p-4">Responsible</th>
                      <th className="p-4 text-center">MC Type</th>
                      <th className="p-4 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {pmOverviewRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-center font-extrabold text-slate-700">
                          <button
                            onClick={() => router.push(`${getBaseRoute()}/contracts/${row.contractId}`)}
                            className="hover:underline text-[#546A7A]"
                          >
                            {row.contractNumber}
                          </button>
                        </td>
                        <td className="p-4 min-w-[180px]">
                          <span className="font-extrabold block text-slate-800">{row.customerName}</span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {row.place || '—'} • {row.zoneName}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                            PM {row.pmNumber}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-slate-500 text-[10px]">
                          {row.range || '—'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.pmStatus === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : row.pmStatus === 'Overdue'
                              ? 'bg-rose-500/10 text-rose-700'
                              : 'bg-amber-500/10 text-amber-700'
                          }`}>
                            {row.pmStatus === 'Completed' ? '✓ Completed' : row.pmStatus === 'Overdue' ? '! Overdue' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-4 text-center text-slate-500">
                          {formatDate(row.completedAt)}
                        </td>
                        <td className="p-4 text-slate-700 font-semibold">
                          {row.responsible || '—'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSlaColor(row.mcType)}`}>
                            {row.mcType || 'Standard'}
                          </span>
                        </td>
                        <td className="p-4 text-right text-slate-800 font-extrabold">
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. EXPIRING CONTRACTS LAYOUT */}
          {reportType === 'expiring-contracts' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#546A7A] text-white font-bold select-none">
                      <th className="p-4 text-center">Contract No</th>
                      <th className="p-4">Customer Details</th>
                      <th className="p-4 text-center">Expiry Date</th>
                      <th className="p-4 text-center">Days Left</th>
                      <th className="p-4 text-center">Urgency</th>
                      <th className="p-4 text-center">PM Done %</th>
                      <th className="p-4 text-right">Value</th>
                      <th className="p-4">Responsible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {expiringContractsRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-center font-extrabold text-slate-700">
                          <button
                            onClick={() => router.push(`${getBaseRoute()}/contracts/${row.id}`)}
                            className="hover:underline text-[#546A7A]"
                          >
                            {row.contractNumber}
                          </button>
                        </td>
                        <td className="p-4 min-w-[180px]">
                          <span className="font-extrabold block text-slate-800">{row.customerName}</span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {row.place || '—'} • {row.zoneName}
                          </span>
                        </td>
                        <td className="p-4 text-center font-semibold text-slate-700">
                          {formatDate(row.endDate)}
                        </td>
                        <td className="p-4 text-center font-extrabold">
                          <span className={row.daysRemaining <= 0 ? 'text-rose-600' : row.daysRemaining <= 30 ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                            {row.daysRemaining < 0 ? `Overdue by ${Math.abs(row.daysRemaining)} Days` : `${row.daysRemaining} Days`}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            row.urgency === 'Expired' || row.urgency === 'Critical'
                              ? 'bg-rose-500/10 text-rose-700'
                              : row.urgency === 'Warning'
                              ? 'bg-amber-500/10 text-amber-700'
                              : 'bg-[#546A7A]/10 text-[#546A7A]'
                          }`}>
                            {row.urgency}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 justify-center">
                            <span className="font-bold text-slate-700">{row.pmPercentage}%</span>
                            <div className="w-12 bg-slate-200 h-1 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${row.pmPercentage}%`,
                                  background: row.pmPercentage >= 75 ? '#10b981' : row.pmPercentage >= 40 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right text-slate-800 font-extrabold">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-4 text-slate-700 font-semibold">
                          {row.responsible || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. ZONE SUMMARY LAYOUT */}
          {reportType === 'zone-summary' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#546A7A] text-white font-bold select-none">
                      <th className="p-4">Zone Name</th>
                      <th className="p-4 text-center">Total Contracts</th>
                      <th className="p-4 text-center">Active</th>
                      <th className="p-4 text-center">Expiring</th>
                      <th className="p-4 text-center">Expired</th>
                      <th className="p-4 text-right">Total Value</th>
                      <th className="p-4 text-center">Total Machines</th>
                      <th className="p-4 text-center">PM Progress %</th>
                      <th className="p-4 text-center">Technicians Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {zoneSummaryRows.map((row, idx) => (
                      <tr key={`z-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-[#82A094]/15 text-[#546A7A] font-extrabold text-[11px]">
                            {row.zoneName}
                          </span>
                        </td>
                        <td className="p-4 text-center text-slate-800 font-bold">
                          {row.totalContracts}
                        </td>
                        <td className="p-4 text-center text-emerald-600 font-bold">
                          {row.activeContracts}
                        </td>
                        <td className="p-4 text-center text-amber-600 font-bold">
                          {row.expiringContracts}
                        </td>
                        <td className="p-4 text-center text-rose-600 font-bold">
                          {row.expiredContracts}
                        </td>
                        <td className="p-4 text-right text-slate-800 font-extrabold">
                          {formatCurrency(row.totalValue)}
                        </td>
                        <td className="p-4 text-center text-slate-500 font-semibold">
                          {row.totalMachines}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 justify-center">
                            <span className="font-bold text-slate-700">{row.pmPercentage}%</span>
                            <div className="w-12 bg-slate-200 h-1 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${row.pmPercentage}%`,
                                  background: row.pmPercentage >= 75 ? '#10b981' : row.pmPercentage >= 40 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center text-slate-500 font-semibold">
                          {row.technicianCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. TECHNICIAN PM PERFORMANCE LAYOUT */}
          {reportType === 'technician-pm' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#546A7A] text-white font-bold select-none">
                      <th className="p-4">Technician Name</th>
                      <th className="p-4 text-center">Assigned Contracts</th>
                      <th className="p-4 text-center">Total PMs</th>
                      <th className="p-4 text-center">Completed</th>
                      <th className="p-4 text-center">Pending</th>
                      <th className="p-4 text-center">Overdue</th>
                      <th className="p-4 text-center">Completion %</th>
                      <th className="p-4 text-center">Machines</th>
                      <th className="p-4 text-right">Value Portfolio</th>
                      <th className="p-4">Zones Serviced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {technicianPmRows.map((row, idx) => (
                      <tr key={`t-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-extrabold text-slate-800">
                          {row.technician}
                        </td>
                        <td className="p-4 text-center text-slate-700 font-semibold">
                          {row.assignedContracts}
                        </td>
                        <td className="p-4 text-center text-slate-500">
                          {row.totalPMs}
                        </td>
                        <td className="p-4 text-center text-emerald-600 font-bold">
                          {row.completedPMs}
                        </td>
                        <td className="p-4 text-center text-amber-600 font-semibold">
                          {row.pendingPMs}
                        </td>
                        <td className="p-4 text-center text-rose-600 font-bold">
                          {row.overduePMs}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 justify-center">
                            <span className={`font-extrabold ${row.completionPercentage >= 75 ? 'text-emerald-650' : row.completionPercentage >= 40 ? 'text-amber-650' : 'text-rose-655'}`}>
                              {row.completionPercentage}%
                            </span>
                            <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${row.completionPercentage}%`,
                                  background: row.completionPercentage >= 75 ? '#10b981' : row.completionPercentage >= 40 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center text-slate-500 font-semibold">
                          {row.totalMachines}
                        </td>
                        <td className="p-4 text-right text-slate-800 font-extrabold">
                          {formatCurrency(row.totalValue)}
                        </td>
                        <td className="p-4 min-w-[150px]">
                          <div className="flex flex-wrap gap-1">
                            {row.zones.map((z: string) => (
                              <span key={z} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[9px]">
                                {z}
                              </span>
                            ))}
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
      )}

      {/* ═══ FOOTER INFO ═══ */}
      <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/50 flex gap-2 items-center text-xs text-slate-500 print:hidden">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
        {reportType === 'customer-portfolio' && (
          <p>This report groups contracts by customer. Click any customer row to expand and view individual agreements and detailed PM schedules.</p>
        )}
        {reportType === 'pm-overview' && (
          <p>This schedule layout shows a flat list of individual Preventive Maintenance cycles. Click any Contract No to inspect the detailed agreement record.</p>
        )}
        {reportType === 'expiring-contracts' && (
          <p>This dashboard highlights contracts expiring within the next 90 days. Check the urgency column to identify immediate critical renewals.</p>
        )}
        {reportType === 'zone-summary' && (
          <p>This zone sheet aggregates key contract volumes, value distribution, and PM schedule tracking across the active servicing zones.</p>
        )}
        {reportType === 'technician-pm' && (
          <p>This layout shows Preventive Maintenance visit stats assigned per technician. Check completion percentages and overdue cycles to monitor workflow balance.</p>
        )}
      </div>
    </div>
  );
}
