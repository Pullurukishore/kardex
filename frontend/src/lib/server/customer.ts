import { cookies } from 'next/headers';
import { Customer, CustomerStats } from '@/types/customer';
import { calculateCustomerStats } from '@/lib/utils/customerStats';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

interface CustomerFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

async function makeServerRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) {
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

export async function getCustomers(filters: CustomerFilters = {}): Promise<Customer[]> {
  const { search = '', status = 'all', page = 1, limit = 10 } = filters;

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
  });

  try {
    const customers: Customer[] = await makeServerRequest(`/customers?${params}`);

    // Apply client-side filtering for status
    // TODO: Consider moving this to backend API for better performance with large datasets
    return customers.filter(customer => {
      const matchesStatus = status === 'all' ||
        (status === 'active' && customer.isActive) ||
        (status === 'inactive' && !customer.isActive);

      return matchesStatus;
    });
  } catch (error) {
    return [];
  }
}

/**
 * Get customer statistics (wrapper for backwards compatibility)
 * Uses shared calculateCustomerStats utility
 */
export async function getCustomerStats(customers: Customer[]): Promise<CustomerStats> {
  return calculateCustomerStats(customers);
}

// Removed getUniqueIndustries function as industry filtering is no longer needed

/**
 * Delete a customer by ID using proper HTTP DELETE method
 */
export async function deleteCustomerById(id: number): Promise<void> {
  try {
    await makeServerRequest(`/customers/${id}`, 'DELETE');
  } catch (error) {
    throw error;
  }
}