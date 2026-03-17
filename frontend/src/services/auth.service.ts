import { UserRole, FinanceRole } from '@/types/user.types';
import { isTokenExpired } from '@/lib/auth-utils';
import api from '@/lib/api/axios';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
  role: UserRole;
  financeRole?: FinanceRole;
  companyName?: string;
  zoneId?: string;
}

export interface AuthResponseUser {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  financeRole?: FinanceRole;
  arRole?: FinanceRole | null;
  vendorRole?: FinanceRole | null;
  phone?: string | null;
  zoneId?: string | null;
  customerId?: string | null;
  companyName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
  isActive?: boolean;
  refreshToken?: string | null;
  refreshTokenExpires?: string | null;
  tokenVersion?: string;
  otp?: string | null;
  otpExpiresAt?: string | null;
  failedLoginAttempts?: number;
  accountLockedUntil?: string | null;
  lastFailedLogin?: string | null;
  lastPasswordChange?: string;
  passwordResetToken?: string | null;
  passwordResetExpires?: string | null;
  lastActiveAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  customer?: any | null;
  token?: string;
  accessToken?: string;
}

export interface AuthResponse {
  user: AuthResponseUser;
  accessToken: string;
  refreshToken?: string;
}


export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', userData);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<AuthResponseUser> => {
    const { data } = await api.get<AuthResponseUser>('/auth/me');

    // Ensure consistent name handling with better validation
    let userName = data.name?.trim();

    // Check if name is valid and not a placeholder
    if (!userName || userName === '' || userName === 'null' || userName === 'undefined' || userName === 'User') {
      userName = data.email?.split('@')[0] || 'User';
    }

    const processedUser = {
      ...data,
      name: userName,
      isActive: data.isActive ?? true,
      tokenVersion: data.tokenVersion || '0',
      lastPasswordChange: data.lastPasswordChange || new Date().toISOString()
    };

    return processedUser;
  },

  refreshToken: (): Promise<{ accessToken: string }> => {
    return new Promise((resolve, reject) => {
      api.post<{ accessToken: string }>('/auth/refresh-token', {}, { withCredentials: true })
        .then(response => {
          if (response.data?.accessToken) {
            resolve(response.data);
          } else {
            throw new Error('No access token in response');
          }
        })
        .catch(error => {
          // Don't automatically redirect here - let the axios interceptor handle it
          // The interceptor has better logic for handling refresh failures
          // and will only redirect after exhausting all retry attempts
          reject(error);
        });
    });
  },
};

export default authService;
