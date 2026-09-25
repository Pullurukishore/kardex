'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Loader2,
  Eye,
  Building2,
  MapPin,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Calendar,
  Sparkles,
  Users,
  Upload,
  CheckCircle,
  Clock,
  AlertTriangle,
  Layers,
  ShieldCheck,
  BarChart3,
  FileText,
  Pencil,
  Trash2,
  MoreHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
  Printer
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
import {
  getCustomerColorClass,
  extractDepartmentFromCustomer,
  formatEngineerDisplayName
} from '@/lib/utils';

export interface PMSchedule {
  id: number;
  pmNumber: number;
  range: string;
  status: 'Completed' | 'Pending' | 'Not Applicable';
  completedAt?: string;
}

export interface Contract {
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
  createdAt?: string;
}

interface ContractsListPageProps {
  role?: string;
  basePath?: string;
}

export default function ContractsListPage({
  role = 'Admin',
  basePath
}: ContractsListPageProps) {
  const router = useRouter();

  const resolvedBasePath = useMemo(() => {
    if (basePath) return basePath;
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  }, [basePath, role]);

  // Main state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMcType, setSelectedMcType] = useState('all');
  const [selectedTech, setSelectedTech] = useState('all');
  const [quickTab, setQuickTab] = useState<'all' | 'Active' | 'Expiring Soon' | 'Expired' | 'software'>('all');

  // Sorting
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Dialog states
  const [pmModalContract, setPmModalContract] = useState<Contract | null>(null);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingPmId, setUpdatingPmId] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch contracts
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getContracts({
        search: debouncedSearch,
        zone: selectedZone !== 'all' ? selectedZone : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        tech: selectedTech !== 'all' ? selectedTech : undefined
      });
      setContracts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch contracts', err);
      toast.error('Failed to load contracts');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedZone, selectedStatus, selectedTech]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Fetch zones for dropdown
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await apiService.getZones();
        const zonesData = response?.data?.zones || response?.zones || response?.data || response || [];
        setZones(Array.isArray(zonesData) ? zonesData : []);
      } catch (error) {
        console.error('Failed to fetch zones', error);
      }
    };
    fetchZones();
  }, []);

  // Compute dynamic filter options
  const uniqueTechnicians = useMemo(() => {
    const list = new Set<string>();
    contracts.forEach(c => {
      if (c.responsible) {
        const names = formatEngineerDisplayName(c.responsible);
        if (names && names !== '—') {
          names.split(',').forEach(n => {
            const trimmed = n.trim();
            if (trimmed) list.add(trimmed);
          });
        }
      }
    });
    return Array.from(list).sort();
  }, [contracts]);

  const uniqueMcTypes = useMemo(() => {
    const list = new Set<string>();
    contracts.forEach(c => {
      if (c.mcType) {
        const trimmed = c.mcType.trim();
        if (trimmed) list.add(trimmed);
      }
    });
    return Array.from(list).sort();
  }, [contracts]);

  // Handle PM visit completion toggle
  const handleTogglePMStatus = async (pmId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    setUpdatingPmId(pmId);
    try {
      await apiService.updatePMSchedule(pmId, newStatus);
      toast.success(`PM Visit marked as ${newStatus}`);

      // Optimistically update local state
      setContracts(prev =>
        prev.map(c => {
          const hasPm = c.pmSchedules?.some(p => p.id === pmId);
          if (!hasPm) return c;
          return {
            ...c,
            pmSchedules: c.pmSchedules.map(p =>
              p.id === pmId
                ? {
                    ...p,
                    status: newStatus as any,
                    completedAt: newStatus === 'Completed' ? new Date().toISOString() : undefined
                  }
                : p
            )
          };
        })
      );

      // Also update pmModalContract if open
      if (pmModalContract) {
        setPmModalContract(prev => {
          if (!prev) return null;
          return {
            ...prev,
            pmSchedules: prev.pmSchedules.map(p =>
              p.id === pmId
                ? {
                    ...p,
                    status: newStatus as any,
                    completedAt: newStatus === 'Completed' ? new Date().toISOString() : undefined
                  }
                : p
            )
          };
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update PM visit status');
    } finally {
      setUpdatingPmId(null);
    }
  };

  // Handle contract deletion
  const handleDeleteContract = async () => {
    if (!contractToDelete) return;
    setIsDeleting(true);
    try {
      await apiService.deleteContract(contractToDelete.id);
      toast.success(`Contract for ${contractToDelete.customerName} deleted successfully`);
      setContracts(prev => prev.filter(c => c.id !== contractToDelete.id));
      setContractToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete contract', err);
      toast.error(err?.response?.data?.error || 'Failed to delete contract');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper date & formatting
  const formatDateLabel = (isoStr: string) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatCurrencyCompact = (value: number) => {
    if (!value) return '₹0';
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return formatCurrency(value);
  };

  const getDaysRemaining = (endDateStr: string) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20';
      case 'Expiring Soon':
        return 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20';
      case 'Expired':
        return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getSlaBadgeStyle = (mcType: string) => {
    if (!mcType) return 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/30';
    const lower = mcType.toLowerCase();
    if (lower.includes('premium')) return 'bg-[#546A7A]/15 text-[#546A7A] border-[#546A7A]/30 font-semibold';
    if (lower.includes('active')) return 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]/30 font-semibold';
    if (lower.includes('full')) return 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]/30 font-semibold';
    return 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/30 font-semibold';
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

  // Clear filters
  const clearFilters = () => {
    setSearch('');
    setSelectedZone('all');
    setSelectedStatus('all');
    setSelectedMcType('all');
    setSelectedTech('all');
    setQuickTab('all');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    selectedZone !== 'all' ||
    selectedStatus !== 'all' ||
    selectedMcType !== 'all' ||
    selectedTech !== 'all' ||
    quickTab !== 'all';

  // Overall Statistics (computed from raw fetched contracts)
  const stats = useMemo(() => {
    const total = contracts.length;
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let swSupportCount = 0;
    let totalValue = 0;
    let totalPMs = 0;
    let completedPMs = 0;

    contracts.forEach(c => {
      if (c.status === 'Active') active++;
      else if (c.status === 'Expiring Soon') expiring++;
      else if (c.status === 'Expired') expired++;

      if (c.softwareSupport) swSupportCount++;
      totalValue += Number(c.amount) || 0;

      c.pmSchedules?.forEach(pm => {
        if (pm.status !== 'Not Applicable') {
          totalPMs++;
          if (pm.status === 'Completed') completedPMs++;
        }
      });
    });

    const pmRate = totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0;

    return {
      total,
      active,
      expiring,
      expired,
      swSupportCount,
      totalValue,
      pmRate,
      completedPMs,
      totalPMs
    };
  }, [contracts]);

  // Filtered & Sorted contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      // Quick tab filter
      if (quickTab === 'Active' && c.status !== 'Active') return false;
      if (quickTab === 'Expiring Soon' && c.status !== 'Expiring Soon') return false;
      if (quickTab === 'Expired' && c.status !== 'Expired') return false;
      if (quickTab === 'software' && !c.softwareSupport) return false;

      // Status dropdown filter
      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;

      // Zone filter
      if (selectedZone !== 'all') {
        const matches = (c.zoneName || '').toLowerCase().includes(selectedZone.toLowerCase());
        if (!matches) return false;
      }

      // MC Type filter
      if (selectedMcType !== 'all') {
        if ((c.mcType || '').trim().toLowerCase() !== selectedMcType.trim().toLowerCase()) return false;
      }

      // Technician filter
      if (selectedTech !== 'all') {
        const formattedTech = formatEngineerDisplayName(c.responsible).toLowerCase();
        if (!formattedTech.includes(selectedTech.toLowerCase())) return false;
      }

      // Text search
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        const numMatch = (c.contractNumber || '').toLowerCase().includes(s);
        const poMatch = (c.poNo || '').toLowerCase().includes(s);
        const custMatch = (c.customerName || '').toLowerCase().includes(s);
        const placeMatch = (c.place || '').toLowerCase().includes(s);
        const zoneMatch = (c.zoneName || '').toLowerCase().includes(s);
        const respMatch = (c.responsible || '').toLowerCase().includes(s);
        const typeMatch = (c.mcType || '').toLowerCase().includes(s);

        if (!numMatch && !poMatch && !custMatch && !placeMatch && !zoneMatch && !respMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [contracts, quickTab, selectedStatus, selectedZone, selectedMcType, selectedTech, debouncedSearch]);

  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      let aVal: any = a[sortField as keyof Contract];
      let bVal: any = b[sortField as keyof Contract];

      if (sortField === 'id') {
        aVal = a.id;
        bVal = b.id;
      } else if (sortField === 'contractNumber') {
        aVal = (a.contractNumber || '').toLowerCase();
        bVal = (b.contractNumber || '').toLowerCase();
      } else if (sortField === 'customerName') {
        aVal = (a.customerName || '').toLowerCase();
        bVal = (b.customerName || '').toLowerCase();
      } else if (sortField === 'zoneName') {
        aVal = (a.zoneName || '').toLowerCase();
        bVal = (b.zoneName || '').toLowerCase();
      } else if (sortField === 'mcType') {
        aVal = (a.mcType || '').toLowerCase();
        bVal = (b.mcType || '').toLowerCase();
      } else if (sortField === 'amount') {
        aVal = Number(a.amount) || 0;
        bVal = Number(b.amount) || 0;
      } else if (sortField === 'noOfMachine') {
        aVal = Number(a.noOfMachine) || 0;
        bVal = Number(b.noOfMachine) || 0;
      } else if (sortField === 'bdCount') {
        aVal = Number(a.bdCount) || 0;
        bVal = Number(b.bdCount) || 0;
      } else if (sortField === 'startDate') {
        aVal = new Date(a.startDate || 0).getTime();
        bVal = new Date(b.startDate || 0).getTime();
      } else if (sortField === 'endDate') {
        aVal = new Date(a.endDate || 0).getTime();
        bVal = new Date(b.endDate || 0).getTime();
      } else if (sortField === 'status') {
        aVal = (a.status || '').toLowerCase();
        bVal = (b.status || '').toLowerCase();
      } else if (sortField === 'responsible') {
        aVal = (a.responsible || '').toLowerCase();
        bVal = (b.responsible || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredContracts, sortField, sortDirection]);

  // Group contracts by customer
  const customerGroups = useMemo(() => {
    const groupsMap = new Map<string, {
      customerId?: number;
      customerName: string;
      place: string;
      zoneName: string;
      contracts: Contract[];
      totalAmount: number;
      totalMachines: number;
      totalBdCount: number;
      activeCount: number;
      latestId: number;
    }>();

    sortedContracts.forEach(contract => {
      const custName = (contract.customerName || 'Unknown Customer').trim();
      const zoneName = (contract.zoneName || '').trim();
      const place = (contract.place || '').trim();

      // Separate customer-wise by Customer Name + Zone + Place
      const key = `${custName.toLowerCase()}__${zoneName.toLowerCase()}__${place.toLowerCase()}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          customerId: contract.customerId,
          customerName: custName,
          place: place,
          zoneName: zoneName,
          contracts: [],
          totalAmount: 0,
          totalMachines: 0,
          totalBdCount: 0,
          activeCount: 0,
          latestId: contract.id || 0,
        });
      }
      const g = groupsMap.get(key)!;
      g.contracts.push(contract);
      g.totalAmount += Number(contract.amount) || 0;
      g.totalMachines += Number(contract.noOfMachine) || 0;
      g.totalBdCount += Number(contract.bdCount) || 0;
      if (contract.status === 'Active') g.activeCount += 1;
      if (contract.id > g.latestId) g.latestId = contract.id;
    });

    const groups = Array.from(groupsMap.values());

    // Sort customer groups
    groups.sort((a, b) => {
      let aVal: any = a.customerName.toLowerCase();
      let bVal: any = b.customerName.toLowerCase();

      if (sortField === 'customerName') {
        aVal = a.customerName.toLowerCase();
        bVal = b.customerName.toLowerCase();
        if (aVal === bVal) {
          const aSub = `${a.zoneName.toLowerCase()} ${a.place.toLowerCase()}`;
          const bSub = `${b.zoneName.toLowerCase()} ${b.place.toLowerCase()}`;
          return aSub.localeCompare(bSub);
        }
      } else if (sortField === 'zoneName') {
        aVal = a.zoneName.toLowerCase();
        bVal = b.zoneName.toLowerCase();
        if (aVal === bVal) {
          aVal = a.customerName.toLowerCase();
          bVal = b.customerName.toLowerCase();
        }
      } else if (sortField === 'amount') {
        aVal = a.totalAmount;
        bVal = b.totalAmount;
      } else if (sortField === 'noOfMachine') {
        aVal = a.totalMachines;
        bVal = b.totalMachines;
      } else if (sortField === 'bdCount') {
        aVal = a.totalBdCount;
        bVal = b.totalBdCount;
      } else if (sortField === 'id') {
        aVal = a.latestId;
        bVal = b.latestId;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return groups;
  }, [sortedContracts, sortField, sortDirection]);

  // Paginated customer groups
  const totalPages = Math.ceil(customerGroups.length / pageSize) || 1;
  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return customerGroups.slice(startIndex, startIndex + pageSize);
  }, [customerGroups, currentPage, pageSize]);



  return (
    <div className="space-y-4">
      {/* ─── COMPACT HERO HEADER BANNER ─── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#75242D] via-[#9E3B47] to-[#546A7A] rounded-xl shadow-md p-3 sm:p-4 text-white space-y-3">
        {/* Top Row: Title on Left, Action Buttons on Right */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Info */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg ring-1 ring-white/30 shadow-xs flex-shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight">
                  Service Contracts
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-bold uppercase tracking-wider text-white">
                  {role}
                </span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-white/80 text-[11px] sm:text-xs hidden sm:block">
                Track and manage service agreements, PM visit cycles, and breakdown visits
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`${resolvedBasePath}/contracts/reports`)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs font-semibold h-8 px-2.5 shadow-xs"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Reports
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`${resolvedBasePath}/contracts/import`)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs font-semibold h-8 px-2.5 shadow-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`${resolvedBasePath}/contracts/new`)}
              className="bg-white text-[#9E3B47] hover:bg-white/90 text-xs font-bold h-8 px-3 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Contract
            </Button>
          </div>
        </div>

        {/* Bottom Row: Compact Stats Cards (Zero Overlap) */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-white/15">
          {/* Total */}
          <div
            onClick={() => { setQuickTab('all'); setCurrentPage(1); }}
            className="bg-white/10 hover:bg-white/20 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-white/15 text-center flex items-center justify-between sm:flex-col sm:justify-center"
          >
            <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Total</span>
            <span className="text-sm sm:text-base font-extrabold">{stats.total}</span>
          </div>

          {/* Active */}
          <div
            onClick={() => { setQuickTab('Active'); setCurrentPage(1); }}
            className="bg-emerald-500/25 hover:bg-emerald-500/35 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-emerald-400/30 text-center flex items-center justify-between sm:flex-col sm:justify-center"
          >
            <span className="text-emerald-100 text-[10px] uppercase font-bold tracking-wider">Active</span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-200">{stats.active}</span>
          </div>

          {/* Expiring Soon */}
          <div
            onClick={() => { setQuickTab('Expiring Soon'); setCurrentPage(1); }}
            className="bg-amber-500/25 hover:bg-amber-500/35 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-amber-400/30 text-center flex items-center justify-between sm:flex-col sm:justify-center"
          >
            <span className="text-amber-100 text-[10px] uppercase font-bold tracking-wider">Expiring</span>
            <span className="text-sm sm:text-base font-extrabold text-amber-200">{stats.expiring}</span>
          </div>

          {/* Expired */}
          <div
            onClick={() => { setQuickTab('Expired'); setCurrentPage(1); }}
            className="bg-rose-500/25 hover:bg-rose-500/35 transition-colors cursor-pointer rounded-lg px-2.5 py-1.5 border border-rose-400/30 text-center flex items-center justify-between sm:flex-col sm:justify-center"
          >
            <span className="text-rose-100 text-[10px] uppercase font-bold tracking-wider">Expired</span>
            <span className="text-sm sm:text-base font-extrabold text-rose-200">{stats.expired}</span>
          </div>

          {/* PM Rate */}
          <div className="bg-[#82A094]/30 rounded-lg px-2.5 py-1.5 border border-white/15 text-center flex items-center justify-between sm:flex-col sm:justify-center">
            <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">PM Done</span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-300">{stats.pmRate}%</span>
          </div>

          {/* Portfolio Value */}
          <div
            className="bg-white/10 rounded-lg px-2.5 py-1.5 border border-white/15 text-center flex items-center justify-between sm:flex-col sm:justify-center"
            title={formatCurrency(stats.totalValue)}
          >
            <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Value</span>
            <span className="text-xs sm:text-sm font-extrabold text-amber-200 truncate">
              {formatCurrencyCompact(stats.totalValue)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── QUICK FILTER TABS & VIEW TOGGLE (Tickets / Offers Style) ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Quick Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'All Contracts', count: stats.total, color: 'bg-[#546A7A] hover:bg-[#5D6E73] text-white' },
            { id: 'Active', label: 'Active', count: stats.active, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
            { id: 'Expiring Soon', label: 'Expiring Soon', count: stats.expiring, color: 'bg-amber-600 hover:bg-amber-700 text-white' },
            { id: 'Expired', label: 'Expired', count: stats.expired, color: 'bg-rose-600 hover:bg-rose-700 text-white' },
            { id: 'software', label: 'Software Support', count: stats.swSupportCount, color: 'bg-indigo-600 hover:bg-indigo-700 text-white' }
          ].map(tab => {
            const isActive = quickTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setQuickTab(tab.id as any);
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
                  <CardTitle className="text-sm font-bold text-slate-800">Search & Filter Contracts</CardTitle>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* Search */}
                <div className="space-y-1.5">
                  <Label htmlFor="contract-search" className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 text-[#82A094]" />
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="contract-search"
                      placeholder="Contract #, Customer, PO..."
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

                {/* Zone Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Zone
                  </Label>
                  <Select
                    value={selectedZone}
                    onValueChange={val => {
                      setSelectedZone(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200">
                      <SelectValue placeholder="All Zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {zones.length > 0 ? (
                        zones.map(z => (
                          <SelectItem key={z.id} value={z.name || String(z.id)}>
                            {z.name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="North">North Zone</SelectItem>
                          <SelectItem value="South">South Zone</SelectItem>
                          <SelectItem value="East">East Zone</SelectItem>
                          <SelectItem value="West">West Zone</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#CE9F6B]" />
                    Status
                  </Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={val => {
                      setSelectedStatus(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* MC Type / Care Level */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-[#9E3B47]" />
                    Care Level / MC Type
                  </Label>
                  <Select
                    value={selectedMcType}
                    onValueChange={val => {
                      setSelectedMcType(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200">
                      <SelectValue placeholder="All Care Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Care Levels</SelectItem>
                      {uniqueMcTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Responsible / Service Engineer */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#546A7A]" />
                    Responsible Engineer
                  </Label>
                  <Select
                    value={selectedTech}
                    onValueChange={val => {
                      setSelectedTech(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-200">
                      <SelectValue placeholder="All Responsible" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      <SelectItem value="all">All Responsible</SelectItem>
                      {uniqueTechnicians.map(tech => (
                        <SelectItem key={tech} value={tech}>
                          {tech}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── CONTRACTS TABLE (Offers / Tickets Premium Design) ─── */}
          <Card className="border-0 shadow-xl overflow-hidden bg-white rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#75242D] via-[#9E3B47] to-[#546A7A] text-white text-[11px] select-none">
                    {/* Sl/No */}
                    <th
                      className="px-2 py-3 text-center font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-12"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>#</span>
                        {sortField === 'id' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Agreement / PO */}
                    <th
                      className="px-2 py-3 text-left font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors"
                      onClick={() => handleSort('customerName')}
                    >
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-[#A2B9AF]" />
                        <span>PO / Agreement</span>
                        {sortField === 'customerName' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Zone */}
                    <th
                      className="px-1.5 py-3 text-center font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-16"
                      onClick={() => handleSort('zoneName')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <MapPin className="h-3 w-3 text-[#6F8A9D]" />
                        <span>Zone</span>
                        {sortField === 'zoneName' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Care Level */}
                    <th
                      className="px-1.5 py-3 text-center font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-20"
                      onClick={() => handleSort('mcType')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Layers className="h-3 w-3 text-[#CE9F6B]" />
                        <span>Care</span>
                        {sortField === 'mcType' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Machines */}
                    <th
                      className="px-1 py-3 text-center font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-16"
                      onClick={() => handleSort('noOfMachine')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Machines</span>
                        {sortField === 'noOfMachine' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* BD Visits */}
                    <th
                      className="px-1.5 py-3 text-center font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-20"
                      onClick={() => handleSort('bdCount')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>BD Visits</span>
                        {sortField === 'bdCount' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Value */}
                    <th
                      className="px-2 py-3 text-right font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-24"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <IndianRupee className="h-3 w-3 text-[#82A094]" />
                        <span>Value</span>
                        {sortField === 'amount' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Period / Expiry */}
                    <th
                      className="px-2 py-3 text-left font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors"
                      onClick={() => handleSort('endDate')}
                    >
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-[#CE9F6B]" />
                        <span>Period</span>
                        {sortField === 'endDate' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* PM Progress */}
                    <th className="px-1.5 py-3 text-center font-bold uppercase tracking-wider w-20">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle className="h-3 w-3 text-emerald-400" />
                        <span>PM Visits</span>
                      </div>
                    </th>

                    {/* Status */}
                    <th
                      className="px-1.5 py-3 text-center font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-20"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        {sortField === 'status' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Responsible */}
                    <th
                      className="px-2 py-3 text-left font-bold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition-colors w-28"
                      onClick={() => handleSort('responsible')}
                    >
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-cyan-300" />
                        <span>Responsible</span>
                        {sortField === 'responsible' && (
                          <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Actions */}
                    <th className="px-1 py-3 text-center font-bold uppercase tracking-wider w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-20 text-center bg-slate-50/50">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#9E3B47] to-[#546A7A] flex items-center justify-center shadow-lg">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-800">Loading contracts...</p>
                            <p className="text-xs text-slate-400 mt-0.5">Fetching latest service agreements</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedGroups.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-16 text-center bg-slate-50/40">
                        <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                          <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <FileText className="h-8 w-8" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-800">No service contracts found</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {hasActiveFilters
                                ? 'No contracts matched your filter criteria. Try adjusting or clearing your filters.'
                                : 'No service contracts have been recorded yet.'}
                            </p>
                          </div>
                          {hasActiveFilters ? (
                            <Button
                              variant="outline"
                              onClick={clearFilters}
                              className="mt-2 text-xs font-semibold text-slate-700"
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Clear All Filters
                            </Button>
                          ) : (
                            <Button
                              onClick={() => router.push(`${resolvedBasePath}/contracts/new`)}
                              className="mt-2 bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white text-xs font-bold shadow-md"
                            >
                              <Plus className="h-4 w-4 mr-1" />
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

                      return (
                        <Fragment key={`${group.customerName}_${group.zoneName}_${group.place}_${groupIndex}`}>
                          {/* ─── CUSTOMER HEADER BAND ─── */}
                          <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100/90 border-t-2 border-b border-slate-200">
                            <td colSpan={12} className="py-2 px-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded bg-[#546A7A] text-white flex items-center justify-center text-[11px] font-black shadow-xs flex-shrink-0">
                                    {customerSlNo}
                                  </span>
                                  <div
                                    className={`w-6 h-6 rounded-md bg-gradient-to-br ${getCustomerColorClass(
                                      group.customerName
                                    )} flex items-center justify-center text-white text-[11px] font-black shadow-xs flex-shrink-0`}
                                  >
                                    {(group.customerName || 'C').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                                      {group.customerName}
                                    </span>
                                    {dept && dept !== '—' && (
                                      <span className="px-1.5 py-0.2 rounded bg-white text-slate-600 font-bold text-[9px] border border-slate-200 shadow-2xs">
                                        {dept}
                                      </span>
                                    )}
                                    {group.place && (
                                      <span className="text-[10px] text-slate-500 font-medium">
                                        • {group.place}
                                      </span>
                                    )}
                                    {group.zoneName && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-white text-slate-700 text-[9px] font-bold border border-slate-200 shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#6F8A9D]" />
                                        {group.zoneName}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#9E3B47]/10 text-[#9E3B47] text-[9px] font-extrabold border border-[#9E3B47]/20 flex items-center gap-1">
                                      <FileText className="w-2.5 h-2.5" />
                                      {group.contracts.length} {group.contracts.length === 1 ? 'Contract' : 'Contracts'}
                                    </span>
                                  </div>
                                </div>

                                {/* Right side summary KPIs for this customer */}
                                <div className="flex items-center gap-2 text-xs font-semibold flex-shrink-0">
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs text-[10px]">
                                    <span className="text-slate-400">Total Units:</span>
                                    <span className="font-bold text-slate-800">{group.totalMachines} M/C</span>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-2xs text-[10px]">
                                    <span className="text-emerald-600 font-medium">Total Value:</span>
                                    <span className="font-black">{formatCurrency(group.totalAmount)}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* ─── CUSTOMER'S CONTRACT ROWS ─── */}
                          {group.contracts.map((contract, cIdx) => {
                            const daysRemaining = getDaysRemaining(contract.endDate);
                            const totalPMs = contract.pmSchedules?.filter(p => p.status !== 'Not Applicable').length || 0;
                            const completedPMs = contract.pmSchedules?.filter(p => p.status === 'Completed').length || 0;
                            const pmPercentage = totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0;

                            return (
                              <tr
                                key={contract.id}
                                onClick={() => router.push(`${resolvedBasePath}/contracts/${contract.id}`)}
                                className={`
                                  ${cIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}
                                  hover:bg-gradient-to-r hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/20
                                  transition-all duration-150 cursor-pointer group border-b border-slate-100/70
                                `}
                              >
                                {/* Sub-index */}
                                <td className="px-2 py-2 text-center w-12">
                                  <span className="font-mono text-slate-400 text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                    #{cIdx + 1}
                                  </span>
                                </td>

                                {/* PO & Agreement */}
                                <td className="px-2 py-2">
                                  <div className="flex flex-col min-w-0 max-w-[150px]">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span
                                        className="font-mono font-bold text-slate-900 group-hover:text-[#9E3B47] text-[11px] leading-tight break-all line-clamp-2 transition-colors"
                                        title={contract.poNo || '—'}
                                      >
                                        {contract.poNo ? `PO: ${contract.poNo}` : '—'}
                                      </span>
                                      {contract.softwareSupport && (
                                        <span
                                          title="Active Software Support License"
                                          className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 flex-shrink-0"
                                        >
                                          SW
                                        </span>
                                      )}
                                    </div>
                                    {contract.poDate && (
                                      <span className="text-[9px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
                                        PO Date: {formatDateLabel(contract.poDate)}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Zone */}
                                <td className="px-1.5 py-2 text-center w-16">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 whitespace-nowrap">
                                    {contract.zoneName || '—'}
                                  </span>
                                </td>

                                {/* Care Level */}
                                <td className="px-1.5 py-2 text-center w-20" onClick={e => e.stopPropagation()}>
                                  <span
                                    className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded border whitespace-nowrap ${getSlaBadgeStyle(
                                      contract.mcType
                                    )}`}
                                  >
                                    {contract.mcType || 'Standard'}
                                  </span>
                                </td>

                                {/* Machines */}
                                <td className="px-1 py-2 text-center w-16">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-extrabold border border-slate-200 whitespace-nowrap">
                                    {contract.noOfMachine || 1} M/C
                                  </span>
                                </td>

                                {/* BD Visits */}
                                <td className="px-1.5 py-2 text-center w-20">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-extrabold border whitespace-nowrap ${
                                      contract.bdCount === 999
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : contract.bdCount > 0
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    {contract.bdCount === 999 ? 'Unlimited' : `${contract.bdCount || 0} Visits`}
                                  </span>
                                </td>

                                {/* Value */}
                                <td className="px-2 py-2 text-right w-24 whitespace-nowrap">
                                  <div className="font-extrabold text-slate-900 text-[11px] leading-tight">
                                    {formatCurrency(contract.amount)}
                                  </div>
                                  {contract.paymentTerms && (
                                    <div
                                      className="text-[8px] text-slate-400 font-medium truncate max-w-[85px] ml-auto"
                                      title={contract.paymentTerms}
                                    >
                                      {contract.paymentTerms}
                                    </div>
                                  )}
                                </td>

                                {/* Period / Expiry */}
                                <td className="px-2 py-2 whitespace-nowrap">
                                  <div className="flex flex-col text-[10px] leading-tight">
                                    <div className="flex items-center gap-1 font-semibold text-slate-800 whitespace-nowrap">
                                      <span>{formatDateLabel(contract.startDate)}</span>
                                      <span className="text-slate-400 font-normal">→</span>
                                      <span>{formatDateLabel(contract.endDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      {daysRemaining !== null && (
                                        daysRemaining < 0 ? (
                                          <span className="text-[9px] font-bold text-rose-600">
                                            Expired {Math.abs(daysRemaining)}d ago
                                          </span>
                                        ) : daysRemaining <= 30 ? (
                                          <span className="text-[9px] font-bold text-amber-600">
                                            {daysRemaining}d left
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-medium text-slate-400">
                                            {daysRemaining}d left
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* PM Visits (Interactive) */}
                                <td
                                  className="px-1.5 py-2 text-center w-20"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setPmModalContract(contract);
                                  }}
                                >
                                  <div className="flex flex-col items-center gap-0.5 cursor-pointer group/pm" title="Click to view/update PM cycles">
                                    <div className="flex items-center gap-0.5 flex-wrap justify-center max-w-[70px]">
                                      {(contract.pmSchedules || []).length > 0 ? (
                                        contract.pmSchedules.map(pm => {
                                          if (pm.status === 'Not Applicable') {
                                            return (
                                              <span
                                                key={pm.id}
                                                className="w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-bold bg-slate-100 text-slate-400"
                                                title={`Visit ${pm.pmNumber}: N/A`}
                                              >
                                                —
                                              </span>
                                            );
                                          }
                                          const isDone = pm.status === 'Completed';
                                          return (
                                            <span
                                              key={pm.id}
                                              className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold border transition-transform group-hover/pm:scale-110 ${
                                                isDone
                                                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                                              }`}
                                              title={`Visit ${pm.pmNumber}: ${pm.status} (${pm.range})`}
                                            >
                                              {isDone ? '✓' : '•'}
                                            </span>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[9px] text-slate-400 italic">No PM</span>
                                      )}
                                    </div>
                                    {totalPMs > 0 && (
                                      <span className="text-[9px] font-bold text-slate-600 group-hover/pm:text-[#9E3B47] whitespace-nowrap">
                                        {completedPMs}/{totalPMs} ({pmPercentage}%)
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="px-1.5 py-2 text-center w-20">
                                  <span
                                    className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-extrabold border whitespace-nowrap ${getStatusBadgeStyle(
                                      contract.status
                                    )}`}
                                  >
                                    {contract.status}
                                  </span>
                                </td>

                                {/* Responsible */}
                                <td className="px-2 py-2 w-28">
                                  <div className="flex items-center gap-1 min-w-0" title={contract.responsible}>
                                    <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 text-[8px]">
                                      <Users className="h-2.5 w-2.5" />
                                    </div>
                                    <span
                                      className="text-[10px] font-medium text-slate-700 truncate max-w-[85px]"
                                    >
                                      {formatEngineerDisplayName(contract.responsible)}
                                    </span>
                                  </div>
                                </td>

                                {/* Actions */}
                                <td className="px-1 py-2 text-center w-10" onClick={e => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                                      >
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 shadow-lg rounded-xl">
                                      <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-wider">
                                        Actions
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem
                                        onClick={() => router.push(`${resolvedBasePath}/contracts/${contract.id}`)}
                                        className="text-xs font-semibold text-slate-700 cursor-pointer"
                                      >
                                        <Eye className="h-3.5 w-3.5 mr-2 text-[#546A7A]" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => router.push(`${resolvedBasePath}/contracts/${contract.id}/edit`)}
                                        className="text-xs font-semibold text-slate-700 cursor-pointer"
                                      >
                                        <Pencil className="h-3.5 w-3.5 mr-2 text-[#CE9F6B]" />
                                        Edit Contract
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => setPmModalContract(contract)}
                                        className="text-xs font-semibold text-slate-700 cursor-pointer"
                                      >
                                        <CheckCircle className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                        Manage PM Visits
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setContractToDelete(contract)}
                                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-2 text-rose-500" />
                                        Delete Contract
                                      </DropdownMenuItem>
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

            {/* ─── PAGINATION BAR (Offers & Tickets Style) ─── */}
            {!loading && customerGroups.length > 0 && (
              <div className="px-4 py-3.5 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>
                    Showing{' '}
                    <span className="font-extrabold text-slate-800">
                      {(currentPage - 1) * pageSize + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-extrabold text-slate-800">
                      {Math.min(currentPage * pageSize, customerGroups.length)}
                    </span>{' '}
                    of{' '}
                    <span className="font-extrabold text-slate-800">{customerGroups.length}</span> customers{' '}
                    <span className="text-slate-400 font-medium">({sortedContracts.length} contracts)</span>
                  </span>

                  <div className="flex items-center gap-1.5 ml-4">
                    <span className="text-[11px] text-slate-400">Rows:</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={val => {
                        setPageSize(Number(val));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Page Navigation Buttons */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0 border-slate-200 disabled:opacity-40"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0 border-slate-200 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0 border-slate-200 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0 border-slate-200 disabled:opacity-40"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

      {/* ─── QUICK PM VISITS MANAGEMENT DIALOG ─── */}
      <Dialog open={Boolean(pmModalContract)} onOpenChange={open => !open && setPmModalContract(null)}>
        <DialogContent className="max-w-md bg-white border-slate-200 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-800">
                  PM Visit Cycles
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {pmModalContract?.customerName}
                  {pmModalContract?.poNo ? ` • PO: ${pmModalContract.poNo}` : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-500 font-semibold">Validity:</span>
              <span className="font-mono text-slate-700">
                {pmModalContract && formatDateLabel(pmModalContract.startDate)} —{' '}
                {pmModalContract && formatDateLabel(pmModalContract.endDate)}
              </span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {pmModalContract?.pmSchedules?.map(pm => {
                const isCompleted = pm.status === 'Completed';
                const isNA = pm.status === 'Not Applicable';
                const isUpdating = updatingPmId === pm.id;

                if (isNA) {
                  return (
                    <div
                      key={pm.id}
                      className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex justify-between items-center opacity-60 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-500 block text-[11px]">
                          Visit {pm.pmNumber}
                        </span>
                        <span className="text-slate-400 text-[10px] italic">Not Applicable</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-bold">
                        N/A
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={pm.id}
                    className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                      isCompleted ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold text-xs uppercase tracking-wider ${
                            isCompleted ? 'text-emerald-700' : 'text-slate-700'
                          }`}
                        >
                          Visit {pm.pmNumber}
                        </span>
                        {isCompleted && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                            Done
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 block">
                        {pm.range || 'Scheduled Cycle'}
                      </span>
                      {isCompleted && pm.completedAt && (
                        <span className="text-[10px] text-emerald-600 font-semibold block">
                          Completed on: {formatDateLabel(pm.completedAt)}
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => handleTogglePMStatus(pm.id, pm.status)}
                      className={`text-xs font-bold h-8 px-3 rounded-lg border transition-all ${
                        isCompleted
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isCompleted ? (
                        '✓ Done'
                      ) : (
                        '• Pending'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="mt-4 sm:justify-between border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pmModalContract) {
                  router.push(`${resolvedBasePath}/contracts/${pmModalContract.id}`);
                }
              }}
              className="text-xs text-slate-600"
            >
              Open Full Contract
            </Button>
            <Button
              size="sm"
              onClick={() => setPmModalContract(null)}
              className="bg-[#546A7A] hover:bg-[#435562] text-white text-xs font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION DIALOG ─── */}
      <Dialog open={Boolean(contractToDelete)} onOpenChange={open => !open && setContractToDelete(null)}>
        <DialogContent className="max-w-md bg-white border-slate-200 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-800">
                  Delete Service Contract?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to delete contract for{' '}
                  <span className="font-bold text-slate-700">
                    {contractToDelete?.customerName}
                  </span>
                  {contractToDelete?.poNo && (
                    <span className="font-mono text-slate-600">
                      {' '}(PO: {contractToDelete.poNo})
                    </span>
                  )}
                  ? This will also remove associated PM cycles and cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="mt-5 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setContractToDelete(null)}
              className="text-xs text-slate-600"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteContract}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
