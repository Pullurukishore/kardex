import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

export interface ExternalUser {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  role: 'EXTERNAL_USER';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  customerId?: number;
  customer?: {
    id: number;
    companyName: string;
  };
}

export interface ExternalUserStats {
  total: number;
  active: number;
  inactive: number;
  recentlyActive: number;
}

export interface GetExternalUsersResponse {
  data: ExternalUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetExternalUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

async function makeServerRequest(endpoint: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;

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

export async function getExternalUsers(params: GetExternalUsersParams = {}): Promise<GetExternalUsersResponse> {
  try {
    const { page = 1, limit = 20, search } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      role: 'EXTERNAL_USER', // Only fetch users with EXTERNAL_USER role
      ...(search && { search }),
    });

    const data = await makeServerRequest(`/admin/users?${queryParams.toString()}`);

    return {
      data: data.data?.users || data.users || [],
      pagination: data.data?.pagination || data.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    };
  } catch (error) {
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    };
  }
}

export async function getExternalUserStats(externalUsers: ExternalUser[]): Promise<ExternalUserStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats: ExternalUserStats = {
    total: externalUsers.length,
    active: externalUsers.filter(user => user.isActive).length,
    inactive: externalUsers.filter(user => !user.isActive).length,
    recentlyActive: externalUsers.filter(user => {
      if (!user.lastActiveAt) return false;
      const lastActive = new Date(user.lastActiveAt);
      return lastActive >= sevenDaysAgo;
    }).length
  };

  return stats;
}

export async function getExternalUserById(id: number): Promise<ExternalUser | null> {
  try {
    const data = await makeServerRequest(`/admin/${id}`);
    // Backend returns { user: userData }, so we need to extract the user
    return data.user || data;
  } catch (error) {
    return null;
  }
}
