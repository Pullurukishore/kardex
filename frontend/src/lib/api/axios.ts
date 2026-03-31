import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getCookie, setCookie, deleteCookie } from 'cookies-next';

// Standard cookie options for consistency across the app
const COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && !window.location.hostname.includes('172.28.91.10') && !window.location.hostname.includes('10.91.1.12') && !window.location.hostname.includes('10.91.1.48') && !window.location.hostname.includes('10.91.1.49') && !window.location.hostname.includes('10.91.1.21') && window.location.hostname !== 'localhost'
};

import { isTokenExpired } from '../auth-utils';
import { API_BASE_URL } from '../constants';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30 second timeout to prevent hanging requests
});

// Track refresh promise to prevent multiple simultaneous refresh attempts
let refreshTokenPromise: Promise<string> | null = null;
let retryCount = 0;
const maxRetries = 3;
let isBackendDown = false;

// Request interceptor to add auth token and handle token refresh
api.interceptors.request.use(
  async (config) => {
    // Skip token refresh for auth endpoints
    if (config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/refresh-token')) {
      return config;
    }

    // Check localStorage first (where tokens are typically stored after login)
    // Then fallback to cookies - matching the pattern in AuthContext.tsx
    let authToken: string | null = null;

    if (typeof window !== 'undefined') {
      // Check all possible localStorage locations (matching AuthContext.tsx)
      // 1. Direct localStorage keys
      authToken = localStorage.getItem('accessToken') || localStorage.getItem('token');

      // 2. Development mode keys (AuthContext uses these in dev)
      if (!authToken) {
        authToken = localStorage.getItem('dev_accessToken');
      }

      // 3. Cookie fallback keys stored in localStorage
      if (!authToken) {
        authToken = localStorage.getItem('cookie_accessToken');
      }

      // 4. Finally check actual cookies
      if (!authToken) {
        authToken = getCookie('accessToken') || getCookie('token') || null;
      }
    } else {
      // Server-side: only check cookies
      authToken = getCookie('accessToken') || getCookie('token') || null;
    }

    if (authToken) {
      // Check if token is expired or about to expire (within 5 minutes)
      if (isTokenExpired(authToken)) {
        try {
          // Reuse existing refresh promise if one is in flight
          if (!refreshTokenPromise) {
            refreshTokenPromise = (async () => {
              try {
                const response = await axios.post(
                  `${API_BASE_URL}/auth/refresh-token`,
                  {},
                  { withCredentials: true }
                );

                if (response.data?.success && response.data.accessToken) {
                  const newToken = response.data.accessToken;
                  setCookie('accessToken', newToken);
                  setCookie('token', newToken);

                  // Update localStorage to prevent infinite refresh loops
                  // The request interceptor checks localStorage first, so it MUST be updated
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('accessToken', newToken);
                    localStorage.setItem('token', newToken);

                    // Also update development keys if they exist
                    if (localStorage.getItem('dev_accessToken')) {
                      localStorage.setItem('dev_accessToken', newToken);
                    }
                    if (localStorage.getItem('cookie_accessToken')) {
                      localStorage.setItem('cookie_accessToken', newToken);
                    }
                  }

                  // Update refresh token if rotated
                  if (response.data.refreshToken) {
                    setCookie('refreshToken', response.data.refreshToken, COOKIE_OPTIONS);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('refreshToken', response.data.refreshToken);
                    }
                  }

                  // Set userRole cookie if provided in response
                  if (response.data.user) {
                    const displayRole = response.data.user.financeRole || response.data.user.role;
                    if (displayRole) {
                      setCookie('userRole', displayRole, COOKIE_OPTIONS);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('userRole', displayRole);
                      }
                    }
                  }

                  return response.data.accessToken;
                } else {
                  throw new Error('No access token in refresh response');
                }
              } finally {
                // Clear the promise after completion (success or failure)
                refreshTokenPromise = null;
              }
            })();
          } else {
          }

          // Wait for the refresh to complete
          const newToken = await refreshTokenPromise;
          config.headers.Authorization = `Bearer ${newToken}`;

        } catch (error: any) {
          // Clear tokens on refresh failure
          deleteCookie('accessToken', COOKIE_OPTIONS);
          deleteCookie('token', COOKIE_OPTIONS);
          deleteCookie('refreshToken', COOKIE_OPTIONS);
          deleteCookie('userRole', COOKIE_OPTIONS);

          // Check if backend is down
          if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
            isBackendDown = true;
            // Don't redirect immediately when backend is down
            return Promise.reject(error);
          }

          // Redirect to login (client-side only)
          if (typeof window !== 'undefined' && window.location.pathname !== '/auth/login') {
            const errorCode = error?.response?.data?.code;
            const expiredParam = errorCode === 'REFRESH_TOKEN_EXPIRED' ? '?expired=true' : '';
            window.location.href = `/auth/login${expiredParam}`;
          }

          return Promise.reject(error);
        }
      } else {
        // Token is still valid, use it
        config.headers.Authorization = `Bearer ${authToken}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add global type for refresh flag
declare global {
  interface Window {
    __isRefreshing: boolean;
  }
}

// Initialize refresh flag
if (typeof window !== 'undefined') {
  window.__isRefreshing = false;
}

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Reset backend down flag and retry count on successful response
    isBackendDown = false;
    retryCount = 0;
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Don't intercept if the request is for login or refresh-token endpoints
    if (originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh-token')) {
      return Promise.reject(error);
    }

    // Check if backend is down before attempting refresh
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
      isBackendDown = true;
      return Promise.reject(error);
    }

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we're already on the login page, don't try to refresh (client-side only)
      if (typeof window !== 'undefined' && window.location.pathname === '/auth/login') {
        return Promise.reject(error);
      }

      // Check retry count to prevent infinite loops
      if (retryCount >= maxRetries) {
        // Max retries reached, clear tokens and redirect
        if (typeof window !== 'undefined') {
          deleteCookie('accessToken', COOKIE_OPTIONS);
          deleteCookie('token', COOKIE_OPTIONS);
          deleteCookie('refreshToken', COOKIE_OPTIONS);
          deleteCookie('userRole', COOKIE_OPTIONS);

          if (window.location.pathname !== '/auth/login') {
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      retryCount++;

      try {
        // Implement exponential backoff ONLY for subsequent retries (retryCount > 1)
        // First retry (retryCount === 1) should be immediate for better UX
        if (retryCount > 1) {
          const delay = Math.min(500 * Math.pow(2, retryCount - 2), 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Reuse the refresh token promise if one is in flight
        if (!refreshTokenPromise) {
          refreshTokenPromise = (async () => {
            try {
              const response = await axios.post(
                `${API_BASE_URL}/auth/refresh-token`,
                {},
                {
                  withCredentials: true,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (response.data?.success && response.data.accessToken) {
                const newToken = response.data.accessToken;
                setCookie('accessToken', newToken, COOKIE_OPTIONS);
                setCookie('token', newToken, COOKIE_OPTIONS);

                // Update localStorage to prevent infinite refresh loops
                if (typeof window !== 'undefined') {
                  localStorage.setItem('accessToken', newToken);
                  localStorage.setItem('token', newToken);

                  // Also update development keys if they exist
                  if (localStorage.getItem('dev_accessToken')) {
                    localStorage.setItem('dev_accessToken', newToken);
                  }
                  if (localStorage.getItem('cookie_accessToken')) {
                    localStorage.setItem('cookie_accessToken', newToken);
                  }
                }

                // Update refresh token if rotated
                if (response.data.refreshToken) {
                  setCookie('refreshToken', response.data.refreshToken, COOKIE_OPTIONS);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                  }
                }

                // Set userRole cookie if provided, prioritizing financeRole
                if (response.data.user) {
                  const displayRole = response.data.user.financeRole || response.data.user.role;
                  if (displayRole) {
                    setCookie('userRole', displayRole, COOKIE_OPTIONS);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('userRole', displayRole);
                    }
                  }
                }

                // Reset retry count on success
                retryCount = 0;
                return response.data.accessToken;
              }
              throw new Error('No access token in refresh response');
            } finally {
              // Clear the promise after completion (success or failure)
              refreshTokenPromise = null;
            }
          })();
        } else {
        }

        const newToken = await refreshTokenPromise;

        // Update the authorization header for the original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // Retry the original request with new token
        return api(originalRequest);

      } catch (refreshError: any) {
        // Clear any existing tokens (client-side only)
        if (typeof window !== 'undefined') {
          deleteCookie('accessToken');
          deleteCookie('token');
          deleteCookie('refreshToken');

          // Also clear from localStorage
          localStorage.removeItem('accessToken');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('dev_accessToken');
          localStorage.removeItem('cookie_accessToken');

          // Check error code for user-friendly messaging
          const errorCode = refreshError?.response?.data?.code;
          if (errorCode === 'REFRESH_TOKEN_EXPIRED' || errorCode === 'NO_REFRESH_TOKEN') {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('sessionExpired', 'true');
              sessionStorage.setItem('sessionExpiredReason', errorCode);
            }
          }

          // Only redirect to login if not already there
          if (window.location.pathname !== '/auth/login') {
            window.location.href = '/auth/login';
          }
        }

        return Promise.reject(refreshError);
      }
    }

    // For 403 Forbidden, do NOT auto-redirect; allow callers to surface errors
    // This prevents losing context (e.g., while generating reports)

    return Promise.reject(error);
  }
);

export default api;
