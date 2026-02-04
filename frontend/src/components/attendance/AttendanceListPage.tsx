'use client'

import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import { 
  Plus, 
  RotateCcw, 
  ChevronDown, 
  RefreshCw,
  LayoutGrid,
  List,
  Eye,
  Pencil,
  PlusCircle,
  Users,
  Calendar,
  Clock as ClockIcon,
  Timer,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { apiClient } from '@/lib/api/api-client'
import { useRouter } from 'next/navigation'
import { 
  format, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  isToday, 
  isYesterday 
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import dynamic from 'next/dynamic'
import { 
  AttendanceRecord, 
  AttendanceStats, 
  ServicePerson, 
  ServiceZone,
  STATUS_CONFIG 
} from '@/lib/constants/attendance'

// Lazy load complex components
const AttendanceFilters = dynamic(() => import('./AttendanceFilters'), {
  loading: () => <div className="h-64 w-full bg-white/50 animate-pulse rounded-xl" />
})

const AttendanceTable = dynamic(() => import('./AttendanceTable'), {
  loading: () => <div className="h-96 w-full bg-white/50 animate-pulse rounded-2xl" />
})

interface AttendanceListPageProps {
  role: 'admin' | 'zone';
  basePath: string;
}

const AttendanceListPage = memo(function AttendanceListPage({ role, basePath }: AttendanceListPageProps) {
  const { toast } = useToast()
  const router = useRouter()
  
  // State
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [servicePersons, setServicePersons] = useState<ServicePerson[]>([])
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([])
  
  // Filters
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'specific'>('today')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedActivityType, setSelectedActivityType] = useState<string>('all')
  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  const isFetching = useRef(false)

  const getDateRange = useCallback(() => {
    let start, end;
    
    if (dateRange === 'today') {
      start = startOfDay(new Date());
      end = endOfDay(new Date());
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      start = startOfDay(yesterday);
      end = endOfDay(yesterday);
    } else if (selectedDate) {
      start = startOfDay(selectedDate);
      end = endOfDay(selectedDate);
    } else {
      start = startOfDay(new Date());
      end = endOfDay(new Date());
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  }, [dateRange, selectedDate]);

  const fetchAttendanceData = useCallback(async (refresh = false) => {
    if (isFetching.current) return;
    
    try {
      isFetching.current = true;
      if (refresh) setIsRefreshing(true);
      else setLoading(true);

      const { startDate, endDate } = getDateRange();
      const params: any = {
        startDate,
        endDate,
        page: currentPage,
        limit: 20
      };

      if (selectedUser !== 'all') params.userId = selectedUser;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedActivityType !== 'all') params.activityType = selectedActivityType;
      if (selectedZone !== 'all') params.zoneId = selectedZone;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const apiPath = role === 'admin' ? '/admin/attendance' : '/zone/attendance';

      const [attendanceRes, statsRes, personsRes, zonesRes] = await Promise.allSettled([
        apiClient.get(apiPath, { params }),
        apiClient.get(`${apiPath}/stats`, { params: { startDate, endDate } }),
        apiClient.get(`${apiPath}/service-persons`),
        apiClient.get(`${apiPath}/service-zones`)
      ]);

      if (attendanceRes.status === 'fulfilled' && (attendanceRes.value as any).success) {
        setAttendanceRecords((attendanceRes.value as any).data.attendance || []);
        setTotalPages((attendanceRes.value as any).data.pagination?.totalPages || 1);
      }
      
      if (statsRes.status === 'fulfilled' && (statsRes.value as any).success) {
        setStats((statsRes.value as any).data);
      }

      if (personsRes.status === 'fulfilled' && (personsRes.value as any).success) {
        setServicePersons((personsRes.value as any).data || []);
      }

      if (zonesRes.status === 'fulfilled' && (zonesRes.value as any).success) {
        setServiceZones((zonesRes.value as any).data || []);
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load attendance data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isFetching.current = false;
    }
  }, [currentPage, dateRange, selectedDate, selectedUser, selectedStatus, selectedActivityType, selectedZone, searchQuery, role, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAttendanceData();
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, dateRange, selectedDate, selectedUser, selectedStatus, selectedActivityType, selectedZone, searchQuery]);

  const processedRecords = useMemo(() => {
    return attendanceRecords.map(record => ({
      ...record,
      statusConfig: STATUS_CONFIG[record.status] || { label: record.status, color: 'bg-gray-100', icon: List }
    }));
  }, [attendanceRecords]);

  const resetFilters = () => {
    setDateRange('today');
    setSelectedDate(new Date());
    setSelectedUser('all');
    setSelectedStatus('all');
    setSelectedActivityType('all');
    setSelectedZone('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = useMemo(() => 
    !!(dateRange !== 'today' || 
    selectedUser !== 'all' || 
    selectedStatus !== 'all' || 
    selectedActivityType !== 'all' || 
    selectedZone !== 'all' || 
    searchQuery.trim() !== ''),
    [dateRange, selectedUser, selectedStatus, selectedActivityType, selectedZone, searchQuery]
  );

  return (
    <div className="min-h-screen bg-[#AEBFC3]/10">
      <div className="w-full p-2 sm:p-3 lg:p-4 space-y-6">
        {/* Compact Header with Stats */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] rounded-2xl shadow-xl p-4 sm:p-6 text-white">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full -ml-24 -mb-24 blur-xl"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30 shadow-lg">
                <Users className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter drop-shadow-md">Attendance</h1>
                <p className="text-white/80 text-sm sm:text-base font-bold uppercase tracking-[0.2em] mt-1">Service Person Check-in & Check-out</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white/15 backdrop-blur-md rounded-xl p-2.5 border border-white/20 shadow-sm">
                  <p className="text-white/70 text-[10px] uppercase font-black tracking-widest leading-none mb-1">Total</p>
                  <p className="text-xl font-black">{stats?.totalRecords || attendanceRecords.length}</p>
                </div>
                <div className="bg-[#A2B9AF]/30 backdrop-blur-md rounded-xl p-2.5 border border-white/20 shadow-sm">
                  <p className="text-white/80 text-[10px] uppercase font-black tracking-widest leading-none mb-1">On Duty</p>
                  <p className="text-xl font-black text-white">{stats?.statusBreakdown?.CHECKED_IN || 0}</p>
                </div>
                <div className="bg-[#96AEC2]/30 backdrop-blur-md rounded-xl p-2.5 border border-white/20 shadow-sm">
                  <p className="text-white/80 text-[10px] uppercase font-black tracking-widest leading-none mb-1">Avg Hours</p>
                  <p className="text-xl font-black text-white">{stats?.averageHours?.toFixed(1) || '0.0'}</p>
                </div>
                <div className="bg-[#E17F70]/30 backdrop-blur-md rounded-xl p-2.5 border border-white/20 shadow-sm">
                  <p className="text-white/80 text-[10px] uppercase font-black tracking-widest leading-none mb-1">Late/Absent</p>
                  <p className="text-xl font-black text-white">
                    {(stats?.statusBreakdown?.LATE || 0) + (stats?.statusBreakdown?.ABSENT || 0)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => fetchAttendanceData(true)} 
                  disabled={isRefreshing}
                  className="bg-white text-[#546A7A] hover:bg-[#F8FAFC] shadow-lg font-black uppercase text-[10px] tracking-widest px-6 h-12 rounded-xl border-0"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        <AttendanceFilters 
          dateRange={dateRange}
          setDateRange={(v) => { setDateRange(v); setCurrentPage(1); }}
          selectedDate={selectedDate}
          setSelectedDate={(d) => { setSelectedDate(d); setCurrentPage(1); }}
          selectedUser={selectedUser}
          setSelectedUser={(v) => { setSelectedUser(v); setCurrentPage(1); }}
          selectedStatus={selectedStatus}
          setSelectedStatus={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
          selectedZone={selectedZone}
          setSelectedZone={(v) => { setSelectedZone(v); setCurrentPage(1); }}
          selectedActivityType={selectedActivityType}
          setSelectedActivityType={(v) => { setSelectedActivityType(v); setCurrentPage(1); }}
          servicePersons={servicePersons}
          serviceZones={serviceZones}
          statusBreakdown={stats?.statusBreakdown || {}}
          searchQuery={searchQuery}
          setSearchQuery={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          hasActiveFilters={hasActiveFilters}
          resetFilters={resetFilters}
          loading={loading}
        />

        <AttendanceTable 
          loading={loading}
          attendanceRecords={attendanceRecords}
          processedRecords={processedRecords}
          onViewDetails={(record) => {
            router.push(`${basePath}/${record.id}/view`);
          }}
          onEdit={(record) => {
            router.push(`${basePath}/${record.id}/view`);
          }}
          onAddActivity={(record) => {
            router.push(`${basePath}/${record.id}/view?tab=activities&action=add`);
          }}
        />

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4">
            <span className="text-sm text-[#5D6E73] font-medium">
              Page <span className="font-bold text-[#546A7A]">{currentPage}</span> of <span className="font-bold text-[#546A7A]">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-10 rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-10 rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default AttendanceListPage;
