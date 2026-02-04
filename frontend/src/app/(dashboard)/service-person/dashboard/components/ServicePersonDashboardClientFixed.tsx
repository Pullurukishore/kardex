'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api/api-client';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

// Dynamic imports to reduce initial bundle size
const CleanAttendanceWidget = dynamic(() => import('@/components/attendance/CleanAttendanceWidget'), {
  loading: () => (
    <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-[#AEBFC3]/30">
      <div className="bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-6 w-32 bg-white/20 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-white/15 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="h-14 bg-[#AEBFC3]/20 rounded-xl animate-pulse"></div>
      </div>
    </div>
  ),
  ssr: false
});

const TicketStatusDialogWithLocation = dynamic(() => import('@/components/tickets/TicketStatusDialogWithLocation'), {
  loading: () => null,
  ssr: false
});

const ActivityLogger = dynamic(() => import('@/components/activity/ActivityLogger'), {
  loading: () => <div className="p-8 text-center animate-pulse text-[#AEBFC3]">Loading Activity Logger...</div>,
  ssr: false
});

const ActivityStatusManager = dynamic(() => import('@/components/activity/ActivityStatusManager'), {
  loading: () => null,
  ssr: false
});

const ServicePersonSchedules = dynamic(() => import('@/components/service-person/ServicePersonSchedules'), {
  loading: () => <div className="p-8 text-center animate-pulse text-[#AEBFC3]">Loading Schedules...</div>,
  ssr: false
});
import { LocationResult } from '@/services/LocationService';
import { 
  Calendar, 
  CheckCircle2, 
  Activity, 
  ChevronDown, 
  PlayCircle,
  CalendarCheck,
  RefreshCw,
  Briefcase,
  Bell
} from 'lucide-react';

// Types
interface DashboardStats {
  activeActivities: number;
  pendingSchedules: number;
  acceptedSchedules: number;
  completedToday: number;
}

interface ActivityStage {
  id: number;
  stage: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  location?: string;
  notes?: string;
}

interface Activity {
  id: number;
  activityType: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  ticketId?: number;
  ticket?: {
    id: number;
    title: string;
    status: string;
    priority: string;
  };
  ActivityStage?: ActivityStage[];
}

interface Ticket {
  id: number;
  title: string;
  status: string;
  priority: string;
  customer?: {
    companyName: string;
    address?: string;
  };
  asset?: {
    serialNo: string;
    model: string;
    location?: string;
  };
  createdAt: string;
  dueDate?: string;
}

interface ServicePersonDashboardClientProps {
  initialLocation?: LocationResult | null;
  initialAttendanceData?: any;
}

export default function ServicePersonDashboardClientFixed({ initialLocation, initialAttendanceData }: ServicePersonDashboardClientProps) {
  const { user } = useAuth();
  
  // Prevent horizontal scrolling on mobile
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.maxWidth = '100vw';
    document.documentElement.style.maxWidth = '100vw';
    
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
      document.body.style.maxWidth = '';
      document.documentElement.style.maxWidth = '';
    };
  }, []);
  
  // State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeActivities: 0,
    pendingSchedules: 0,
    acceptedSchedules: 0,
    completedToday: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<any>(initialAttendanceData || null);
  const [isLoading, setIsLoading] = useState(!initialAttendanceData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef<boolean>(Boolean(initialAttendanceData));
  const loadErrorShownRef = useRef<boolean>(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    activities: false,
    createActivity: false,
    schedules: false,
  });

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      // Fetch all data in parallel
      const [activitiesResponse, schedulesResponse, attendanceResponse] = await Promise.allSettled([
        apiClient.get('/activities?limit=50&includeStages=true&includeTicket=true'),
        apiClient.get('/activity-schedule?status=PENDING,ACCEPTED'),
        apiClient.get('/attendance/status'),
      ]);

      // Handle activities response
      let activitiesData = [];
      if (activitiesResponse.status === 'fulfilled') {
        const responseData = activitiesResponse.value as any;
        if (responseData?.activities) {
          activitiesData = responseData.activities;
        } else if (Array.isArray(responseData)) {
          activitiesData = responseData;
        }
      }
      setActivities(activitiesData);

      // Handle schedules response
      let schedulesData: any[] = [];
      if (schedulesResponse.status === 'fulfilled') {
        const schedulesResponseData = schedulesResponse.value as any;
        if (schedulesResponseData?.data) {
          schedulesData = schedulesResponseData.data;
        } else if (Array.isArray(schedulesResponseData)) {
          schedulesData = schedulesResponseData;
        }
      }
      setSchedules(schedulesData);

      // Handle attendance response
      if (attendanceResponse.status === 'fulfilled') {
        const attendanceData = attendanceResponse.value as any;
        setAttendanceStatus((prev: any) => {
          const newData = attendanceData ? JSON.parse(JSON.stringify(attendanceData)) : null;
          if (JSON.stringify(prev) !== JSON.stringify(newData)) {
            return newData;
          }
          return prev;
        });
      }

      // Calculate stats
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const activeActivities = activitiesData.filter((a: any) => !a.endTime).length;
      const completedToday = activitiesData.filter((a: any) => {
        if (!a.endTime) return false;
        const end = new Date(a.endTime);
        return end >= startOfToday && end <= endOfToday;
      }).length;
      
      // Count pending and accepted schedules
      const pendingSchedules = schedulesData.filter((s: any) => s.status === 'PENDING').length;
      const acceptedSchedules = schedulesData.filter((s: any) => s.status === 'ACCEPTED').length;

      setDashboardStats({
        activeActivities,
        pendingSchedules,
        acceptedSchedules,
        completedToday,
      });

    } catch (error) {
      if (!loadErrorShownRef.current) {
        toast.error('Failed to load dashboard data');
        loadErrorShownRef.current = true;
      }
    } finally {
      if (!hasLoadedRef.current) {
        setIsLoading(false);
        hasLoadedRef.current = true;
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleActivityChange = useCallback(async () => {
    setTimeout(async () => {
      try {
        await fetchDashboardData();
      } catch (error) {}
    }, 1000);
  }, [fetchDashboardData]);

  const handleAttendanceChange = useCallback(async (newStatus?: any) => {
    if (newStatus) {
      setAttendanceStatus(newStatus);
    }
    await fetchDashboardData();
  }, [fetchDashboardData]);

  const handleStatusDialogClose = () => {
    setSelectedTicket(null);
    setShowStatusDialog(false);
  };

  const handleStatusUpdate = async () => {
    await fetchDashboardData();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Loading state - Mobile optimized
  if (isLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-6 relative overflow-hidden" role="status" aria-label="Loading dashboard">
        {/* Background elements */}
        <div className="fixed inset-0 bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/20"></div>
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.08),_transparent_50%)]"></div>
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.08),_transparent_50%)]"></div>
        
        {/* Floating orbs - smaller on mobile */}
        <div className="fixed top-20 left-4 w-48 sm:w-72 h-48 sm:h-72 bg-gradient-to-br from-[#96AEC2]/15 to-[#6F8A9D]/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="fixed bottom-20 right-4 w-56 sm:w-96 h-56 sm:h-96 bg-gradient-to-br from-[#E17F70]/15 to-[#EEC1BF]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="text-center relative z-10 w-full max-w-sm mx-auto">
          <div className="relative mb-6 sm:mb-8">
            {/* Animated spinner - larger touch target on mobile */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#96AEC2] border-r-[#6F8A9D] animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#A2B9AF] border-l-[#82A094] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-[#546A7A] border-r-[#4F6A64] animate-spin" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl flex items-center justify-center shadow-lg shadow-[#96AEC2]/30">
                  <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 px-4">
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#4F6A64] bg-clip-text text-transparent">
              Loading Dashboard
            </h2>
            <p className="text-[#5D6E73] animate-pulse font-medium text-sm sm:text-base">Preparing your workspace...</p>
            <div className="flex items-center justify-center space-x-3 mt-4 sm:mt-6">
              <div className="w-3 h-3 sm:w-2.5 sm:h-2.5 bg-[#96AEC2] rounded-full animate-bounce shadow-lg shadow-[#96AEC2]/50"></div>
              <div className="w-3 h-3 sm:w-2.5 sm:h-2.5 bg-[#6F8A9D] rounded-full animate-bounce shadow-lg shadow-[#6F8A9D]/50" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 sm:w-2.5 sm:h-2.5 bg-[#546A7A] rounded-full animate-bounce shadow-lg shadow-[#546A7A]/50" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe pb-6 overflow-x-hidden w-full max-w-full relative touch-pan-y bg-[#AEBFC3]/10">
      {/* Premium Background - Subtle mesh gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#AEBFC3]/15 via-[#96AEC2]/10 to-[#AEBFC3]/15 -z-10"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(158,59,71,0.05),_transparent_40%)] -z-10"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(206,159,107,0.05),_transparent_40%)] -z-10"></div>
      
      {/* Subtle grid pattern overlay */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:24px_24px] -z-10"></div>
      
      {/* Premium Header - Enhanced Coral Gradient */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#8B2E38] via-[#D6705E] to-[#C4915F] text-white shadow-xl shadow-[#9E3B47]/20">
        {/* Premium background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/8 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-white/8 rounded-full blur-3xl"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent"></div>
        </div>
        
        <div className="relative z-10 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Mobile Layout */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">Service Dashboard</h1>
                    <p className="text-white/60 text-xs">Hi, <span className="text-white/90 font-medium">{user?.name?.split(' ')[0] || 'Engineer'}</span></p>
                  </div>
                </div>
                {attendanceStatus && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md border text-xs font-bold ${
                    attendanceStatus.isCheckedIn 
                      ? 'bg-[#82A094]/20 border-[#82A094]/40 text-[#A2B9AF]' 
                      : 'bg-white/10 border-white/20 text-white/80'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${attendanceStatus.isCheckedIn ? 'bg-[#82A094] animate-pulse' : 'bg-white/50'}`}></div>
                    <span>{attendanceStatus.isCheckedIn ? 'Active' : 'Off'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-lg">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-white tracking-tight">Service Dashboard</h1>
                    {attendanceStatus && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border text-sm font-semibold ${
                        attendanceStatus.isCheckedIn 
                          ? 'bg-[#82A094]/20 border-[#82A094]/40 text-[#A2B9AF]' 
                          : 'bg-white/10 border-white/20 text-white/70'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${attendanceStatus.isCheckedIn ? 'bg-[#82A094] animate-pulse' : 'bg-white/50'}`}></div>
                        <span>{attendanceStatus.isCheckedIn ? 'On Duty' : 'Off Duty'}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-white/70 text-sm mt-0.5">
                    Welcome back, <span className="text-white font-medium">{user?.name?.split(' ')[0] || 'Service Person'}</span>
                  </p>
                </div>
              </div>
              
              {/* Date Badge */}
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 border border-white/15">
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold text-sm">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-white/60 text-xs">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <div className="relative z-30 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {/* Active */}
            <button 
              onClick={() => {
                setExpandedSections(prev => ({ ...prev, createActivity: true }));
                setTimeout(() => document.getElementById('create-activity-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
              className="group bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[#AEBFC3]/80 shadow-sm hover:shadow-md hover:border-[#92A2A5] transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex flex-col items-center sm:items-start gap-1 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#96AEC2] to-[#6F8A9D] rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[9px] sm:text-xs text-[#5D6E73] font-medium uppercase tracking-wider">Active</p>
                  <p className="text-lg sm:text-2xl font-bold text-[#546A7A]">{dashboardStats.activeActivities}</p>
                </div>
              </div>
            </button>

            {/* Pending */}
            <button 
              onClick={() => {
                setExpandedSections(prev => ({ ...prev, schedules: true }));
                setTimeout(() => document.getElementById('schedules-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
              className="group bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[#AEBFC3]/80 shadow-sm hover:shadow-md hover:border-[#CE9F6B] transition-all duration-200 active:scale-[0.98] relative"
            >
              {dashboardStats.pendingSchedules > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-[#CE9F6B] rounded-full flex items-center justify-center shadow-lg animate-bounce">
                  <span className="text-[8px] sm:text-[10px] text-white font-bold">{dashboardStats.pendingSchedules}</span>
                </div>
              )}
              <div className="flex flex-col items-center sm:items-start gap-1 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[9px] sm:text-xs text-[#5D6E73] font-medium uppercase tracking-wider">Pending</p>
                  <p className="text-lg sm:text-2xl font-bold text-[#546A7A]">{dashboardStats.pendingSchedules}</p>
                </div>
              </div>
            </button>

            {/* Accepted */}
            <button 
              onClick={() => {
                setExpandedSections(prev => ({ ...prev, schedules: true }));
                setTimeout(() => document.getElementById('schedules-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
              className="group bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[#AEBFC3]/80 shadow-sm hover:shadow-md hover:border-[#92A2A5] transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex flex-col items-center sm:items-start gap-1 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[9px] sm:text-xs text-[#5D6E73] font-medium uppercase tracking-wider">Accepted</p>
                  <p className="text-lg sm:text-2xl font-bold text-[#546A7A]">{dashboardStats.acceptedSchedules}</p>
                </div>
              </div>
            </button>

            {/* Done */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[#AEBFC3]/80 shadow-sm">
              <div className="flex flex-col items-center sm:items-start gap-1 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-lg flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[9px] sm:text-xs text-[#5D6E73] font-medium uppercase tracking-wider">Done</p>
                  <p className="text-lg sm:text-2xl font-bold text-[#546A7A]">{dashboardStats.completedToday}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          
          {/* New Assignment Alert Banner - More prominent on mobile */}
          {dashboardStats.pendingSchedules > 0 && (
            <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] p-4 sm:p-5 shadow-lg shadow-[#CE9F6B]/20">
              <div className="absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              </div>
              
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base sm:text-lg">
                      {dashboardStats.pendingSchedules} New Assignment{dashboardStats.pendingSchedules > 1 ? 's' : ''}
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm">Awaiting response</p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setExpandedSections(prev => ({ ...prev, schedules: true }));
                    setTimeout(() => document.getElementById('schedules-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-white text-[#976E44] rounded-lg font-semibold text-sm hover:bg-[#EEC1BF]/20 transition-all shadow-md active:scale-[0.98]"
                >
                  Review
                </button>
              </div>
            </div>
          )}
          {/* Attendance Widget */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-[#AEBFC3]/80 shadow-sm overflow-hidden">
            <CleanAttendanceWidget 
              onStatusChange={handleAttendanceChange}
              initialData={attendanceStatus}
            />
          </div>

          {/* Create Activity Section */}
          <div id="create-activity-section" className="bg-white rounded-xl sm:rounded-2xl border border-[#AEBFC3]/80 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection('createActivity')}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#AEBFC3]/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl flex items-center justify-center shadow-sm">
                  <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-base sm:text-lg font-semibold text-[#546A7A]">Create Activity</h3>
                  <p className="text-xs sm:text-sm text-[#5D6E73]">Start tracking a task</p>
                </div>
              </div>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 bg-[#AEBFC3]/30 rounded-lg flex items-center justify-center transition-transform duration-200 ${expandedSections.createActivity ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#5D6E73]" />
              </div>
            </button>
            
            <div className={`transition-all duration-300 ease-in-out ${expandedSections.createActivity ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="border-t border-[#AEBFC3]/30 p-4 sm:p-6 space-y-6">
                {activities.filter(a => !a.endTime && a.ActivityStage?.some((stage: ActivityStage) => !stage.endTime)).length > 0 && (
                  <div className="bg-[#96AEC2]/10 rounded-xl p-4 border border-[#96AEC2]/30">
                    <h4 className="text-sm sm:text-base font-semibold text-[#546A7A] mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#6F8A9D]" />
                      Active Activities
                      <span className="px-2 py-0.5 bg-[#96AEC2]/20 text-[#546A7A] text-xs font-bold rounded-full">
                        {activities.filter(a => !a.endTime && a.ActivityStage?.some((stage: ActivityStage) => !stage.endTime)).length}
                      </span>
                    </h4>
                    <ActivityStatusManager 
                      activities={activities.filter(a => !a.endTime && a.ActivityStage?.some((stage: ActivityStage) => !stage.endTime))}
                      onActivityChange={handleActivityChange}
                    />
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-[#546A7A] mb-3 flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-[#82A094]" />
                    New Activity
                  </h4>
                  <ActivityLogger 
                    activities={activities}
                    onActivityChange={handleActivityChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Activities Section */}
          <div id="schedules-section" className="bg-white rounded-xl sm:rounded-2xl border border-[#AEBFC3]/80 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection('schedules')}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#AEBFC3]/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl flex items-center justify-center shadow-sm">
                  <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-semibold text-[#546A7A]">My Schedules</h3>
                    {(dashboardStats.pendingSchedules > 0 || dashboardStats.acceptedSchedules > 0) && (
                      <span className="px-2 py-0.5 bg-[#6F8A9D]/20 text-[#546A7A] text-xs font-bold rounded-full">
                        {dashboardStats.pendingSchedules + dashboardStats.acceptedSchedules}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[#5D6E73]">View scheduled tasks</p>
                </div>
              </div>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 bg-[#AEBFC3]/30 rounded-lg flex items-center justify-center transition-transform duration-200 ${expandedSections.schedules ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#5D6E73]" />
              </div>
            </button>
            
            <div className={`transition-all duration-300 ease-in-out ${expandedSections.schedules ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="border-t border-[#AEBFC3]/30 p-4 sm:p-6">
                <ServicePersonSchedules />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Refreshing Overlay */}
      {isRefreshing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-white rounded-full shadow-xl border border-[#AEBFC3] px-4 py-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#5D6E73] animate-spin" />
            <span className="text-sm text-[#5D6E73] font-medium">Updating...</span>
          </div>
        </div>
      )}

      {/* Ticket Status Dialog */}
      <TicketStatusDialogWithLocation
        ticket={selectedTicket ? {
          id: selectedTicket.id,
          title: selectedTicket.title,
          status: selectedTicket.status,
          priority: selectedTicket.priority,
          customer: selectedTicket.customer ? {
            companyName: selectedTicket.customer.companyName
          } : undefined,
          asset: selectedTicket.asset ? {
            serialNumber: selectedTicket.asset.serialNo || 'N/A',
            model: selectedTicket.asset.model || 'N/A'
          } : undefined
        } : null}
        isOpen={showStatusDialog}
        onClose={handleStatusDialogClose}
        onStatusUpdate={handleStatusUpdate}
        accuracyThreshold={50}
      />

      {/* Custom animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
