import { cookies } from 'next/headers';
import type { DashboardData, StatusDistribution, TrendsData } from '@/components/dashboard/types';
import { API_BASE_URL } from '@/lib/constants';

// Zone dashboard types
export interface ZoneDashboardData {
  zone: {
    id: number;
    name: string;
    description: string;
    totalCustomers?: number;
    totalTechnicians?: number;
    totalZoneUsers?: number;
    totalZoneManagers?: number;
    totalAssets?: number;
  };
  stats: {
    openTickets: { count: number; change: number };
    unassignedTickets: { count: number; critical: boolean };
    inProgressTickets: { count: number; change: number };
    avgResponseTime: { hours: number; minutes: number; change: number; isPositive: boolean };
    avgResolutionTime: { days: number; hours: number; minutes: number; change: number; isPositive: boolean };
    avgDowntime: { hours: number; minutes: number; change: number; isPositive: boolean };
    monthlyTickets: { count: number; change: number };
    activeMachines: { count: number; change: number };
  };
  metrics: {
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    technicianEfficiency: number;
    avgTravelTime: number;
    partsAvailability: number;
    equipmentUptime: number;
    firstCallResolutionRate: number;
    customerSatisfactionScore: number;
    avgResponseTime?: number;
    avgResolutionTime?: number;
  };
  trends: {
    resolvedTickets: Array<{
      date: string;
      count: number;
    }>;
  };
  topIssues?: Array<{
    title: string;
    count: number;
    priority?: string;
    avgResolutionTime?: number;
  }>;
  technicians?: Array<{
    id: number;
    name: string;
    activeTickets: number;
    efficiency: number;
    rating: number;
  }>;
  recentActivities?: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
    priority: string;
    technician?: string;
  }>;
}



async function makeServerRequest(endpoint: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;

  // Check for either accessToken or token (based on authentication inconsistencies)
  const authToken = accessToken || token;

  if (!authToken) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 60 }, // Cache for 60 seconds to improve performance
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText} (${response.status})`);
  }

  return response.json();
}

export async function getDashboardData(): Promise<Partial<DashboardData>> {
  try {
    return await makeServerRequest('/dashboard');
  } catch (error) {
    return {};
  }
}

export async function getStatusDistribution(): Promise<StatusDistribution> {
  try {
    const data = await makeServerRequest('/dashboard/status-distribution');
    return data || { distribution: [] };
  } catch (error) {
    return { distribution: [] };
  }
}

export async function getTicketTrends(): Promise<TrendsData> {
  try {
    const data = await makeServerRequest('/dashboard/ticket-trends');
    return data || { trends: [] };
  } catch (error) {
    return { trends: [] };
  }
}

export async function getAllDashboardData() {
  try {
    const [dashboardData, statusDistribution, ticketTrends] = await Promise.all([
      getDashboardData(),
      getStatusDistribution(),
      getTicketTrends(),
    ]);

    return {
      dashboardData,
      statusDistribution,
      ticketTrends,
    };
  } catch (error) {
    return {
      dashboardData: {},
      statusDistribution: { distribution: [] },
      ticketTrends: { trends: [] },
    };
  }
}

export async function getAllZoneDashboardData() {
  try {
    const [zoneDashboardData] = await Promise.all([
      getZoneDashboardData(),
    ]);

    return {
      zoneDashboardData,
    };
  } catch (error) {
    return {
      zoneDashboardData: null,
    };
  }
}

export async function getZoneDashboardData(): Promise<ZoneDashboardData | null> {
  try {
    return await makeServerRequest('/zone-dashboard');
  } catch (error) {
    return null;
  }
}
