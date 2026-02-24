import { Suspense } from 'react';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary';
import DashboardErrorFallback from '@/components/dashboard/DashboardErrorFallback';
import { getAllDashboardData } from '@/lib/server/dashboard';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { 
  DashboardData,
  StatusDistribution,
  TrendsData 
} from '@/components/dashboard/types';
import DashboardClient from '@/components/dashboard/DashboardClient';


// Server Component - renders the shell instantly, data is fetched client-side for performance
export default async function DashboardPage() {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const refreshToken = cookieStore.get('refreshToken')?.value;
    const accessToken = cookieStore.get('accessToken')?.value;
    const token = cookieStore.get('token')?.value;

    if (!userRole || (!accessToken && !token && !refreshToken)) {
      redirect('/auth/login');
    }

    // Define empty initial states - DashboardClient will handle the actual fetching
    // This removes the 10-second server-side blocking delay
    const emptyDashboardData: DashboardData = {
      stats: {
        openTickets: { count: 0, change: 0 },
        unassignedTickets: { count: 0, critical: false },
        inProgressTickets: { count: 0, change: 0 },
        avgResponseTime: { hours: 0, minutes: 0, change: 0, isPositive: true },
        avgResolutionTime: { days: 0, hours: 0, minutes: 0, change: 0, isPositive: true },
        avgDowntime: { hours: 0, minutes: 0, change: 0, isPositive: true },
        avgTravelTime: { hours: 0, minutes: 0, change: 0, isPositive: true },
        avgOnsiteResolutionTime: { hours: 0, minutes: 0, change: 0, isPositive: true },
        monthlyTickets: { count: 0, change: 0 },
        activeMachines: { count: 0, change: 0 },
        ticketDistribution: {
          byStatus: [],
          byPriority: []
        },
        kpis: {
          totalTickets: { value: 0, change: '0%', isPositive: true },
          slaCompliance: { value: 0, change: 0, isPositive: true },
          avgResponseTime: { value: '0h 0m', unit: 'h', change: 0, isPositive: true },
          avgResolutionTime: { value: '0h 0m', unit: 'h', change: 0, isPositive: true },
          unassignedTickets: { value: 0, critical: false },
          activeCustomers: { value: 0, change: 0 },
          activeServicePersons: { value: 0, change: 0 }
        }
      },
      adminStats: {
        totalCustomers: 0,
        totalServicePersons: 0,
        totalServiceZones: 0,
        totalZoneUsers: 0,
        totalZoneManagers: 0,
        ticketStatusDistribution: {},
        ticketTrends: [],
        zoneWiseTickets: []
      },
      recentTickets: []
    };

    return (
      <div className="overflow-x-hidden">
        <DashboardErrorBoundary fallback={DashboardErrorFallback}>
          <DashboardClient 
            initialDashboardData={emptyDashboardData}
            initialStatusDistribution={{ distribution: [] }}
            initialTicketTrends={{ trends: [] }}
          />
        </DashboardErrorBoundary>
      </div>
    );
  } catch (error) {

    // Handle authentication errors
    if (error instanceof Error && 
        (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      redirect('/auth/login');
      return null;
    }

    // Return error state with premium Kardex-branded design
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#96AEC2]/10 p-4">
        {/* Premium animated background with Kardex colors */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {/* Primary floating orbs with Kardex signature colors */}
          <div className="absolute top-10 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-[#E17F70]/25 via-[#9E3B47]/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[350px] bg-gradient-to-br from-[#96AEC2]/30 via-[#6F8A9D]/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-[#82A094]/20 via-[#A2B9AF]/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(150,174,194,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(150,174,194,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>
        
        {/* Error card with Kardex glassmorphism */}
        <div className="relative z-10 text-center bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-[#E17F70]/10 p-8 sm:p-10 md:p-12 max-w-lg mx-4 border border-[#96AEC2]/20">
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
            <h2 className="text-2xl sm:text-3xl font-bold text-[#546A7A] mb-4">Dashboard Unavailable</h2>
            
            {/* Description */}
            <p className="text-base sm:text-lg text-[#5D6E73] mb-8 leading-relaxed max-w-sm mx-auto">
              We encountered an issue loading your dashboard. Please refresh to try again.
            </p>
            
            {/* Retry button with Kardex blue gradient */}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-[#6F8A9D] via-[#546A7A] to-[#6F8A9D] bg-size-200 hover:bg-pos-100 focus:outline-none focus:ring-4 focus:ring-[#96AEC2]/30 transition-all duration-500 shadow-xl shadow-[#6F8A9D]/25 hover:shadow-2xl hover:shadow-[#6F8A9D]/35 hover:-translate-y-1 active:translate-y-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Dashboard
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
}
