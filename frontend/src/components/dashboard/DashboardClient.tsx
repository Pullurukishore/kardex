'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

// Import lightweight components directly
import ExecutiveHeader from './ExecutiveHeader';
import ExecutiveSummaryCards from './ExecutiveSummaryCards';
import RecentTickets from './RecentTickets';

// Import heavy components dynamically
import {
  DynamicAdvancedAnalytics,
  DynamicZonePerformanceAnalytics,
} from './DynamicDashboardComponents';

// Import types
import type { DashboardData, StatusDistribution, TrendsData } from '@/components/dashboard/types';
import api from '@/lib/api/axios';

interface DashboardClientProps {
  initialDashboardData: Partial<DashboardData>;
  initialStatusDistribution: StatusDistribution;
  initialTicketTrends: TrendsData;
}

export default function DashboardClient({
  initialDashboardData,
  initialStatusDistribution,
  initialTicketTrends,
}: DashboardClientProps) {
  const [dashboardData, setDashboardData] = useState<Partial<DashboardData>>(initialDashboardData);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution>(initialStatusDistribution);
  const [ticketTrends, setTicketTrends] = useState<TrendsData>(initialTicketTrends);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  // Refs to prevent duplicate API calls (Strict Mode / double render protection)
  const hasInitialized = useRef(false);
  const isFetching = useRef(false);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Memoized fetch function with deduplication
  const fetchDashboardData = useCallback(async (showToast: boolean = true) => {
    // Prevent duplicate concurrent fetches
    if (isFetching.current) {
      return false;
    }
    
    try {
      isFetching.current = true;
      setIsRefreshing(true);
      setError(null);
      
      const [dashboardRes, statusRes, trendsRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/dashboard/status-distribution'),
        api.get('/dashboard/ticket-trends')
      ]);
      
      setDashboardData(dashboardRes.data || {});
      setStatusDistribution(statusRes.data || { distribution: [] });
      setTicketTrends(trendsRes.data || { trends: [] });
      
      if (showToast) {
        toast.success('Dashboard data refreshed');
      }
      return true;
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      toast.error('Failed to refresh dashboard data');
      return false;
    } finally {
      isFetching.current = false;
      setIsRefreshing(false);
    }
  }, []);

  // Initial data fetch - with strict mode protection
  useEffect(() => {
    // Skip if already initialized (React Strict Mode protection)
    if (hasInitialized.current) {
      return;
    }
    
    // Only skip if we have actual operational data (e.g. totalCustomers > 0 or tickets exist)
    const hasValidInitialData = 
      initialDashboardData && 
      initialDashboardData.stats && 
      (initialDashboardData.adminStats?.totalCustomers ?? 0) > 0;
    
    // Always fetch if no valid initial data (like totalCustomers) was provided from server
    if (!hasValidInitialData) {
      hasInitialized.current = true;
      fetchDashboardData(false); // Don't show toast on initial load
    } else {
      hasInitialized.current = true;
    }
  }, [initialDashboardData, fetchDashboardData]);

  // Auto-refresh every 5 minutes - separate effect for clarity
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (isOnline && !isFetching.current) {
        fetchDashboardData(false); // Silent refresh
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [isOnline, fetchDashboardData]);

  const handleRefresh = async () => {
    await fetchDashboardData();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#96AEC2]/10 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
        {/* Premium animated background with Kardex colors */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-[#E17F70]/25 via-[#9E3B47]/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[350px] bg-gradient-to-br from-[#96AEC2]/30 via-[#6F8A9D]/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-[#82A094]/20 via-[#A2B9AF]/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(150,174,194,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(150,174,194,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <div className="relative overflow-hidden bg-white/90 backdrop-blur-2xl p-8 sm:p-10 md:p-12 rounded-3xl shadow-2xl shadow-[#E17F70]/10 max-w-lg w-full text-center border border-[#96AEC2]/20">
          {/* Decorative gradient top bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#82A094] rounded-t-3xl" />
          
          {/* Background decorations */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-[#E17F70]/15 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-gradient-to-br from-[#96AEC2]/15 to-transparent rounded-full blur-3xl" />
          
          <div className="relative z-10">
            {/* Icon with Kardex coral gradient */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E17F70] via-[#E17F70] to-[#9E3B47] shadow-xl shadow-[#E17F70]/30 mb-8">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            
            {/* Title with Kardex blue */}
            <h3 className="text-2xl sm:text-3xl font-bold text-[#546A7A] mb-4">Error Loading Dashboard</h3>
            
            {/* Description */}
            <p className="text-base sm:text-lg text-[#5D6E73] leading-relaxed mb-8 max-w-sm mx-auto">{error}</p>
            
            {/* Retry button with Kardex blue gradient */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#6F8A9D] bg-size-200 hover:bg-pos-100 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-[#6F8A9D]/25 hover:shadow-2xl hover:shadow-[#6F8A9D]/35 disabled:opacity-50 transition-all duration-500 hover:-translate-y-1 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-[#96AEC2]/30"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </>
              )}
            </button>
            
            {/* Help text */}
            <p className="mt-6 text-sm text-[#92A2A5]">
              If the problem persists, please contact support
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 overflow-x-hidden w-full selection:bg-[#6F8A9D]/30">
      {/* Optimized background elements - static or very subtle */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-[#E17F70]/5 rounded-full blur-[100px] transform-gpu" />
        <div className="absolute top-[20%] right-[-5%] w-[450px] h-[450px] bg-[#96AEC2]/8 rounded-full blur-[120px] transform-gpu" />
        <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-[#82A094]/5 rounded-full blur-[100px] transform-gpu" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(111,138,157,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(111,138,157,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative z-10 w-full max-w-full overflow-x-hidden">
        {/* Connection Status Indicator with Kardex red */}
        {!isOnline && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#9E3B47] text-white px-6 py-3 rounded-full shadow-xl shadow-[#9E3B47]/30 border border-[#E17F70]/40">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-bold tracking-wide">Offline Mode</span>
            </div>
          </div>
        )}

        {/* Refresh Indicator with Kardex blue accent */}
        {isRefreshing && (
          <div className="fixed top-4 right-4 z-50">
            <div className="flex items-center gap-3 bg-white/95 backdrop-blur-2xl px-5 py-3 rounded-full shadow-xl shadow-[#96AEC2]/20 border border-[#96AEC2]/30">
              <RefreshCw className="w-4 h-4 animate-spin text-[#6F8A9D]" />
              <span className="text-sm font-semibold text-[#546A7A]">Syncing...</span>
            </div>
          </div>
        )}

        {/* Executive Header */}
        <ExecutiveHeader 
          onRefresh={handleRefresh} 
          isRefreshing={isRefreshing}
          stats={{
            totalCustomers: dashboardData?.adminStats?.totalCustomers,
            totalServicePersons: dashboardData?.adminStats?.totalServicePersons,
            totalServiceZones: dashboardData?.adminStats?.totalServiceZones,
            totalZoneUsers: dashboardData?.adminStats?.totalZoneUsers,
            totalZoneManagers: dashboardData?.adminStats?.totalZoneManagers,
          }}
        />

        {/* Executive Summary Cards - All metrics consolidated here */}
        <ExecutiveSummaryCards 
          dashboardData={dashboardData} 
        />

        {/* Advanced Analytics - Status Distribution & Trends */}
        <div className="mb-8 sm:mb-10">
          <DynamicAdvancedAnalytics 
            dashboardData={dashboardData}
            statusDistribution={statusDistribution}
            ticketTrends={ticketTrends}
            loading={isRefreshing}
          />
        </div>

        {/* Recent Tickets */}
        <div className="mb-8 sm:mb-10">
          <RecentTickets 
            dashboardData={dashboardData} 
            loading={isRefreshing}
          />
        </div>

        {/* Zone Performance Analytics */}
        <div className="mb-8 sm:mb-10">
          <DynamicZonePerformanceAnalytics 
            dashboardData={dashboardData} 
            onRefresh={handleRefresh} 
            isRefreshing={isRefreshing} 
          />
        </div>

        {/* Footer Spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
