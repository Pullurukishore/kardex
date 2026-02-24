import { cookies } from 'next/headers';
import { Zone, Customer, Asset, ReportData } from '@/components/reports/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
    cache: 'no-store', // Ensure fresh data
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }

  return response.json();
}

export async function getZones(): Promise<Zone[]> {
  try {
    const response = await makeServerRequest('/service-zones?isActive=true');
    return Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    return [];
  }
}

export async function getCustomers(zoneId?: string): Promise<Customer[]> {
  try {
    const params = new URLSearchParams({ isActive: 'true' });
    if (zoneId) {
      params.append('serviceZoneId', zoneId);
    }

    const response = await makeServerRequest(`/customers?${params.toString()}`);
    return Array.isArray(response)
      ? response
      : (response.data || response.customers || []);
  } catch (error) {
    return [];
  }
}

export async function getAssets(customerId?: string): Promise<Asset[]> {
  if (!customerId) return [];

  try {
    const response = await makeServerRequest(`/assets?customerId=${customerId}&isActive=true`);
    return Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    return [];
  }
}

export async function generateReport(filters: {
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  zoneId?: string;
  customerId?: string;
  assetId?: string;
  reportType: string;
}): Promise<ReportData | null> {
  try {
    const searchParams = new URLSearchParams();

    // Add report type
    if (filters.reportType) {
      searchParams.append('reportType', filters.reportType);
    }

    // Add date range
    if (filters.dateRange?.from) {
      searchParams.append('from', filters.dateRange.from.toISOString().split('T')[0]);
      searchParams.append('startDate', filters.dateRange.from.toISOString());
    }
    if (filters.dateRange?.to) {
      searchParams.append('to', filters.dateRange.to.toISOString().split('T')[0]);
      searchParams.append('endDate', filters.dateRange.to.toISOString());
    }

    // Add optional filters
    if (filters.zoneId) {
      searchParams.append('zoneId', filters.zoneId);
    }
    if (filters.customerId) {
      searchParams.append('customerId', filters.customerId);
    }
    if (filters.assetId) {
      searchParams.append('assetId', filters.assetId);
    }

    const response = await makeServerRequest(`/reports/generate?${searchParams.toString()}`);

    // Handle different response structures
    const data = response?.data || response || {};
    return data;
  } catch (error) {
    return null;
  }
}

// Service Person Report Types
export interface PersonalReportData {
  summary: {
    totalWorkingDays: number;
    totalHours: number;
    absentDays: number;
    autoCheckouts: number;
    activitiesLogged: number;
    averageHoursPerDay: number;
  };
  flags: Array<{
    type: string;
    count: number;
    message: string;
  }>;
  dayWiseBreakdown: Array<{
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    totalHours: number;
    attendanceStatus: string;
    activityCount: number;
    flags: Array<{
      type: string;
      message: string;
    }>;
    activities: Array<{
      id: number;
      activityType: string;
      title: string;
      startTime: string;
      endTime: string | null;
      duration: number | null;
      location: string | null;
      ticketId: number | null;
      ticket: any;
    }>;
  }>;
}

export interface ReportsSummary {
  totalCheckIns: number;
  totalAbsentees: number;
  totalServicePersons: number;
  averageHoursPerDay: number;
  totalActivitiesLogged: number;
  mostActiveUser: {
    name: string;
    email: string;
    activityCount: number;
  } | null;
}

export async function getServicePersonReports(params: {
  fromDate: string;
  toDate: string;
  limit?: number;
}): Promise<PersonalReportData | null> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append('fromDate', params.fromDate);
    searchParams.append('toDate', params.toDate);
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    const response = await makeServerRequest(`/service-person-reports?${searchParams.toString()}`);

    // Extract current user's report data
    if (response?.success && response.data?.reports?.length > 0) {
      return response.data.reports[0];
    }

    return null;
  } catch (error) {
    return null;
  }
}

export async function getServicePersonReportsSummary(params: {
  fromDate: string;
  toDate: string;
}): Promise<ReportsSummary | null> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append('fromDate', params.fromDate);
    searchParams.append('toDate', params.toDate);

    const response = await makeServerRequest(`/service-person-reports/summary?${searchParams.toString()}`);

    if (response?.success) {
      return response.data;
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Get zone user's zone information
export async function getUserZone(): Promise<{ id: number; name: string } | null> {
  try {
    const response = await makeServerRequest('/zone-dashboard');
    if (response?.zone) {
      return {
        id: response.zone.id,
        name: response.zone.name
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}
