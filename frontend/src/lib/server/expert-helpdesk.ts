import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

export interface ExpertHelpdesk {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  role: 'EXPERT_HELPDESK';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  specialization?: string;
  department?: string;
}

export interface ExpertHelpdeskStats {
  total: number;
  active: number;
  inactive: number;
  recentlyActive: number;
}

export interface GetExpertHelpdeskResponse {
  data: ExpertHelpdesk[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetExpertHelpdeskParams {
  page?: number;
  limit?: number;
  search?: string;
}

async function makeServerRequest(endpoint: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;

  const authToken = accessToken || token;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function getExpertHelpdesk(params: GetExpertHelpdeskParams = {}): Promise<GetExpertHelpdeskResponse> {
  try {
    const { page = 1, limit = 20, search } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      role: 'EXPERT_HELPDESK',
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

export async function getExpertHelpdeskStats(experts: ExpertHelpdesk[]): Promise<ExpertHelpdeskStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats: ExpertHelpdeskStats = {
    total: experts.length,
    active: experts.filter(user => user.isActive).length,
    inactive: experts.filter(user => !user.isActive).length,
    recentlyActive: experts.filter(user => {
      if (!user.lastActiveAt) return false;
      const lastActive = new Date(user.lastActiveAt);
      return lastActive >= sevenDaysAgo;
    }).length
  };

  return stats;
}

export async function getExpertHelpdeskById(id: number): Promise<ExpertHelpdesk | null> {
  try {
    const data = await makeServerRequest(`/admin/${id}`);
    return data.user || data;
  } catch (error) {
    return null;
  }
}
