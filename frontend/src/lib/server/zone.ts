import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

interface ServicePerson {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive: boolean;
  serviceZones: {
    serviceZone: {
      id: number;
      name: string;
    };
  }[];
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function serverFetch(endpoint: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;
  const userRole = cookieStore.get('userRole')?.value;

  // Check for either accessToken or token (based on authentication inconsistencies)
  const authToken = accessToken || token;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'Content-Type': 'application/json',
    },
    cache: 'no-store', // Ensure fresh data
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Zone Service Persons Functions
export async function getZoneServicePersons(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedResponse<ServicePerson>> {
  try {
    const { page = 1, limit = 30, search } = params;
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });

    const endpoint = `/zone-dashboard/service-persons?${searchParams}`;

    const response = await serverFetch(endpoint);

    // Handle both response.data and direct response
    const servicePersons = response.data || response || [];

    // Process service persons data (preserve actual isActive status)
    const processedData = servicePersons.map((person: ServicePerson) => ({
      ...person
    }));

    return {
      data: processedData,
      pagination: response.pagination || {
        page,
        limit,
        total: processedData.length,
        totalPages: Math.ceil(processedData.length / limit)
      }
    };
  } catch (error) {
    return {
      data: [],
      pagination: { page: 1, limit: 30, total: 0, totalPages: 0 }
    };
  }
}

export async function getZoneServicePersonStats(servicePersons: ServicePerson[]) {
  return {
    total: servicePersons.length,
    active: servicePersons.filter(p => p.isActive).length,
    inactive: servicePersons.filter(p => !p.isActive).length,
    totalZoneAssignments: servicePersons.reduce((acc, person) => acc + person.serviceZones.length, 0)
  };
}
