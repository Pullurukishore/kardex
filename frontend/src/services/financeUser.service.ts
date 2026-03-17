import { apiClient } from '@/lib/api';

export type FinanceRoleType = 'FINANCE_ADMIN' | 'FINANCE_USER' | 'FINANCE_VIEWER' | 'FINANCE_APPROVER';

export interface FinanceUser {
    id: number;
    email: string;
    name?: string | null;
    phone?: string | null;
    financeRole: FinanceRoleType;
    arRole?: FinanceRoleType | null;
    vendorRole?: FinanceRoleType | null;
    isActive: boolean;
    lastLoginAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateFinanceUserPayload {
    email: string;
    name?: string;
    phone?: string;
    password: string;
    financeRole: FinanceRoleType;
    arRole?: FinanceRoleType | null;
    vendorRole?: FinanceRoleType | null;
}

export interface UpdateFinanceUserPayload {
    email?: string;
    name?: string;
    phone?: string;
    password?: string;
    financeRole?: FinanceRoleType;
    arRole?: FinanceRoleType | null;
    vendorRole?: FinanceRoleType | null;
    isActive?: boolean;
}

export interface FinanceUsersResponse {
    success: boolean;
    data: FinanceUser[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats?: {
        total: number;
        active: number;
        inactive: number;
        admins: number;
        regularUsers: number;
        viewers: number;
    };
}

export interface FinanceUserResponse {
    success: boolean;
    data: FinanceUser;
    message?: string;
}

export interface FinanceUserStats {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    regularUsers: number;
    viewers: number;
}

export const getFinanceUsers = async (params?: {
    page?: number;
    limit?: number;
    search?: string;
}): Promise<FinanceUsersResponse> => {
    try {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.search) queryParams.append('search', params.search);

        const response = await apiClient.get(`/ar/finance-users?${queryParams}`);

        // Handle different response structures
        if (response.success !== undefined) {
            return response as FinanceUsersResponse;
        }

        if (response.data) {
            return response.data as FinanceUsersResponse;
        }

        // If the response is an array, wrap it
        if (Array.isArray(response)) {
            return {
                success: true,
                data: response,
                pagination: {
                    page: 1,
                    limit: response.length,
                    total: response.length,
                    totalPages: 1
                }
            };
        }

        return { success: true, data: [], pagination: undefined };
    } catch (error) {
        console.error('Error fetching finance users:', error);
        throw error;
    }
};

export const getFinanceUser = async (id: number): Promise<FinanceUser> => {
    try {
        const response = await apiClient.get(`/ar/finance-users/${id}`);

        // Handle different response structures
        // If response has data property with the user object
        if (response.data && typeof response.data === 'object' && 'email' in response.data) {
            return response.data as FinanceUser;
        }

        // If response is the user object directly
        if (response && typeof response === 'object' && 'email' in response && 'id' in response) {
            return response as unknown as FinanceUser;
        }

        throw new Error('Finance user not found');
    } catch (error) {
        console.error('Error fetching finance user:', error);
        throw error;
    }
};

export const createFinanceUser = async (data: CreateFinanceUserPayload): Promise<FinanceUser> => {
    try {
        const response = await apiClient.post('/ar/finance-users', data);

        // Handle different response structures
        if (response.data && typeof response.data === 'object' && 'email' in response.data) {
            return response.data as FinanceUser;
        }

        if (response && typeof response === 'object' && 'email' in response && 'id' in response) {
            return response as unknown as FinanceUser;
        }

        throw new Error('Failed to create finance user');
    } catch (error) {
        console.error('Error creating finance user:', error);
        throw error;
    }
};

export const updateFinanceUser = async (id: number, data: UpdateFinanceUserPayload): Promise<FinanceUser> => {
    try {
        const response = await apiClient.put(`/ar/finance-users/${id}`, data);

        // Handle different response structures
        if (response.data && typeof response.data === 'object' && 'email' in response.data) {
            return response.data as FinanceUser;
        }

        if (response && typeof response === 'object' && 'email' in response && 'id' in response) {
            return response as unknown as FinanceUser;
        }

        throw new Error('Failed to update finance user');
    } catch (error) {
        console.error('Error updating finance user:', error);
        throw error;
    }
};

export const deleteFinanceUser = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/ar/finance-users/${id}`);
    } catch (error) {
        console.error('Error deleting finance user:', error);
        throw error;
    }
};

export const getFinanceUserStats = async (): Promise<FinanceUserStats> => {
    try {
        const response = await apiClient.get('/ar/finance-users/stats');

        // Handle response with data property
        if (response.data && typeof response.data === 'object' && 'total' in response.data) {
            return response.data as FinanceUserStats;
        }

        // Handle direct response
        if (response && typeof response === 'object' && 'total' in response) {
            return response as unknown as FinanceUserStats;
        }

        // Return default stats if no valid response
        return {
            total: 0,
            active: 0,
            inactive: 0,
            admins: 0,
            regularUsers: 0,
            viewers: 0,
        };
    } catch (error) {
        console.error('Error fetching finance user stats:', error);
        throw error;
    }
};

// Helper function to get role display name
export const getFinanceRoleDisplayName = (role: FinanceRoleType): string => {
    const roleNames: Record<FinanceRoleType, string> = {
        FINANCE_ADMIN: 'Finance Admin',
        FINANCE_USER: 'Finance User',
        FINANCE_VIEWER: 'Finance Viewer',
        FINANCE_APPROVER: 'Finance Approver',
    };
    return roleNames[role] || role;
};

// Helper function to get role badge color
export const getFinanceRoleBadgeColor = (role: FinanceRoleType): string => {
    const colors: Record<FinanceRoleType, string> = {
        FINANCE_ADMIN: 'bg-[#E17F70]/20 text-[#9E3B47] border-[#E17F70]',
        FINANCE_USER: 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]',
        FINANCE_VIEWER: 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]',
        FINANCE_APPROVER: 'bg-purple-100 text-purple-700 border-purple-300',
    };
    return colors[role] || 'bg-gray-100 text-gray-600 border-gray-300';
};
