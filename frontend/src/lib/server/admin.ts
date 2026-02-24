import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

interface ServicePerson {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  isActive: boolean;
  serviceZones: {
    serviceZone: {
      id: number;
      name: string;
    };
  }[];
}

interface ServiceZone {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    servicePersons?: number;
    customers?: number;
    tickets?: number;
  };
}

interface ZoneUser {
  id: number;
  email: string;
  role: string;
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

// Service Persons Functions
export async function getServicePersons(params: {
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

    const endpoint = `/service-persons?${searchParams}`;
    const response = await serverFetch(endpoint);
    // Handle both response.data and direct response like other working functions
    const servicePersons = response.data || response || [];
    // Ensure isActive is properly set for each person
    const processedData = servicePersons.map((person: ServicePerson) => ({
      ...person,
      isActive: person.isActive ?? true // Default to true if undefined
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

export async function getServicePersonStats(servicePersons: ServicePerson[]) {
  return {
    total: servicePersons.length,
    active: servicePersons.filter(p => p.isActive).length,
    inactive: servicePersons.filter(p => !p.isActive).length,
    totalZoneAssignments: servicePersons.reduce((acc, person) => acc + person.serviceZones.length, 0)
  };
}

// Service Zones Functions
export async function getServiceZones(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedResponse<ServiceZone>> {
  try {
    const { page = 1, limit = 20, search } = params;
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });

    const response = await serverFetch(`/service-zones?${searchParams}`);

    return {
      data: response.data || [],
      pagination: response.pagination || {
        page,
        limit,
        total: (response.data || []).length,
        totalPages: Math.ceil((response.data || []).length / limit)
      }
    };
  } catch (error) {
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    };
  }
}

export async function getServiceZoneStats(zones: ServiceZone[]) {
  return {
    total: zones.length,
    active: zones.filter(z => z.isActive).length,
    inactive: zones.filter(z => !z.isActive).length,
    totalServicePersons: zones.reduce((acc, zone) => acc + (zone._count?.servicePersons || 0), 0),
    totalCustomers: zones.reduce((acc, zone) => acc + (zone._count?.customers || 0), 0),
    totalTickets: zones.reduce((acc, zone) => acc + (zone._count?.tickets || 0), 0)
  };
}

// Zone Users Functions
export async function getZoneUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedResponse<ZoneUser>> {
  try {
    const { page = 1, limit = 10, search } = params;
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });

    const response = await serverFetch(`/zone-users?${searchParams}`);

    // Handle the response structure from our new admin endpoint
    const responseData = response.data || response;
    const zoneUsers = responseData.zoneUsers || responseData || [];

    return {
      data: zoneUsers,
      pagination: responseData.pagination || response.pagination || {
        page,
        limit,
        total: zoneUsers.length,
        totalPages: Math.ceil(zoneUsers.length / limit)
      }
    };
  } catch (error) {
    return {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
    };
  }
}

export async function getZoneUserStats(zoneUsers: ZoneUser[]) {
  return {
    total: zoneUsers.length,
    active: zoneUsers.filter(u => u.isActive).length,
    inactive: zoneUsers.filter(u => !u.isActive).length,
    totalZoneAssignments: zoneUsers.reduce((acc, user) => acc + user.serviceZones.length, 0),
    admin: zoneUsers.filter(u => u.role === 'ADMIN').length,
    zoneUsers: zoneUsers.filter(u => u.role === 'ZONE_USER').length
  };
}

// Delete functions
export async function deleteServicePerson(id: number): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;

  // Check for either accessToken or token (based on authentication inconsistencies)
  const authToken = accessToken || token;

  if (!authToken) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/service-persons/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete service person');
  }
}

export async function deleteServiceZone(id: number): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;

  // Check for either accessToken or token (based on authentication inconsistencies)
  const authToken = accessToken || token;

  if (!authToken) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/service-zones/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete service zone');
  }
}

export async function deleteZoneUser(id: number): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;

  // Check for either accessToken or token (based on authentication inconsistencies)
  const authToken = accessToken || token;

  if (!authToken) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/zone-users/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete zone user');
  }
}

// Admin Users Functions
export interface Admin {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
}

export async function getAdmins(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedResponse<Admin>> {
  try {
    const { page = 1, limit = 50, search } = params;
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      role: 'ADMIN',
      ...(search && { search }),
    });

    const response = await serverFetch(`/admin/users?${searchParams}`);

    return {
      data: response.users || [],
      pagination: response.pagination || {
        page,
        limit,
        total: (response.users || []).length,
        totalPages: Math.ceil((response.users || []).length / limit)
      }
    };
  } catch (error) {
    return {
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
    };
  }
}

export async function getAdminStats(admins: Admin[]) {
  return {
    total: admins.length,
    active: admins.filter(a => a.isActive).length,
    inactive: admins.filter(a => !a.isActive).length,
    recentlyActive: admins.filter(a => {
      if (!a.lastActiveAt) return false;
      const lastActive = new Date(a.lastActiveAt);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return lastActive > sevenDaysAgo;
    }).length
  };
}

// Get admin by ID
export async function getAdminById(id: string): Promise<Admin | null> {
  try {
    const data = await serverFetch(`/admin/${id}`);
    // Backend returns { user: adminData }, so we need to extract the user
    return data.user || data;
  } catch (error) {
    // Return null if fetch fails (e.g. 404 or auth error), consistent with other getById functions returning null on failure
    return null;
  }
}
