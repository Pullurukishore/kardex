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

// Loading component for Suspense boundary - Enhanced skeleton UI
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50 to-[#96AEC2]/20 p-2 md:p-4">
      <div className="w-full max-w-full">
        {/* Header skeleton */}
        <div className="mb-6 sm:mb-8">
          <div className="h-12 sm:h-16 bg-white/60 rounded-lg animate-pulse mb-2" />
          <div className="h-6 bg-white/40 rounded-lg animate-pulse w-2/3" />
        </div>
        
        {/* Executive summary cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/60 rounded-xl p-4 sm:p-6 animate-pulse">
              <div className="h-4 bg-[#92A2A5]/30 rounded w-1/2 mb-3" />
              <div className="h-8 bg-[#92A2A5]/30 rounded w-3/4 mb-2" />
              <div className="h-3 bg-[#92A2A5]/30 rounded w-1/3" />
            </div>
          ))}
        </div>

        {/* Analytics section skeleton */}
        <div className="bg-white/60 rounded-xl p-4 sm:p-6 mb-6 animate-pulse">
          <div className="h-6 bg-[#92A2A5]/30 rounded w-1/4 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 bg-[#92A2A5]/30 rounded" />
            <div className="h-64 bg-[#92A2A5]/30 rounded" />
          </div>
        </div>

        {/* Recent tickets skeleton */}
        <div className="bg-white/60 rounded-xl p-4 sm:p-6 animate-pulse">
          <div className="h-6 bg-[#92A2A5]/30 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-[#92A2A5]/30 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Error component for error boundaries
function DashboardError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="bg-[#E17F70]/10 rounded-lg p-6 max-w-2xl mx-auto my-8">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="p-3 bg-[#E17F70]/20 rounded-full">
          <div className="w-8 h-8 text-[#9E3B47]">!</div>
        </div>
        <h3 className="text-lg font-medium text-[#75242D]">Failed to load dashboard</h3>
        <p className="text-[#75242D]">{error}</p>
        <button
          onClick={retry}
          className="px-4 py-2 border border-[#E17F70] text-[#75242D] rounded-md hover:bg-[#E17F70]/10 mt-2 flex items-center gap-2"
        >
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}

// Server Component - runs on the server for initial data fetching
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

    // For performance, we render the shell instantly and fetch data on the client
    // This removes the server-side blocking delay on page reloads
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
      <>
        <div className="overflow-x-hidden">
          <DashboardErrorBoundary fallback={DashboardErrorFallback}>
            <Suspense fallback={<DashboardLoading />}>
              <DashboardClient 
                initialDashboardData={emptyDashboardData}
                initialStatusDistribution={{ distribution: [] }}
                initialTicketTrends={{ trends: [] }}
              />
            </Suspense>
          </DashboardErrorBoundary>
        </div>
      </>
    );
  } catch (error) {

    // Handle authentication errors
    if (error instanceof Error && 
        (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      redirect('/auth/login');
      return null;
    }

    // Return error state with retry button
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50 to-[#96AEC2]/20">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E17F70]/20 mb-4">
            <svg
              className="h-6 w-6 text-[#9E3B47]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[#9E3B47] mb-2">Failed to load dashboard</h2>
          <p className="text-[#5D6E73] mb-6">There was an error loading the dashboard. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#546A7A] hover:bg-[#546A7A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6F8A9D] transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      </div>
    );
  }
}
