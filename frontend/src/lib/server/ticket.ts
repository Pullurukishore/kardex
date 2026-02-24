import { cookies } from 'next/headers';
import { Ticket, TicketStatus, Priority, TicketStats } from '@/types/ticket';
import { calculateTicketStats as calculateStats } from '@/lib/utils/ticketStats';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

type ApiResponse = {
  data: Ticket[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type TicketFilters = {
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
  view?: 'all' | 'unassigned' | 'assigned-to-zone' | 'assigned-to-service-person';
};

async function makeServerRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET', body?: any) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const token = cookieStore.get('token')?.value;

  // Check for either accessToken or token (based on authentication inconsistencies)
  const authToken = accessToken || token;

  if (!authToken) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    ...(body && { body: JSON.stringify(body) }),
    cache: 'no-store', // Ensure fresh data
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }

  // Return empty object for DELETE requests with no content
  if (method === 'DELETE' && response.status === 204) {
    return {};
  }

  return response.json();
}

export async function getTickets(filters: TicketFilters = {}): Promise<ApiResponse> {
  const queryParams = new URLSearchParams();

  // Add filters to query params
  if (filters.page) queryParams.set('page', filters.page.toString());
  if (filters.limit) queryParams.set('limit', filters.limit.toString());
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.priority) queryParams.set('priority', filters.priority);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.view && filters.view !== 'all') {
    queryParams.set('view', filters.view);
  }

  try {
    const data = await makeServerRequest(`/tickets?${queryParams.toString()}`);
    return data;
  } catch (error) {
    throw error;
  }
}

export async function getTicketById(id: string): Promise<Ticket> {
  try {
    const data = await makeServerRequest(`/tickets/${id}`);
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Update ticket status using proper HTTP PATCH method
 */
export async function updateTicketStatus(ticketId: number, status: TicketStatus): Promise<void> {
  try {
    await makeServerRequest(`/tickets/${ticketId}/status`, 'PATCH', { status });
  } catch (error) {
    throw error;
  }
}

/**
 * Calculate ticket statistics (wrapper using shared utility)
 * Uses shared calculateStats utility to avoid duplication
 */
export function calculateTicketStats(tickets: Ticket[]): TicketStats {
  return calculateStats(tickets);
}