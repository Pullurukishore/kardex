'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
  useRef,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCookie, deleteCookie, setCookie } from 'cookies-next';
import { toast } from 'sonner';
import { authService } from '@/services/auth.service';
import { UserRole, FinanceRole, type User } from '@/types/user.types';
import { isBrowser, safeLocalStorage, safeSessionStorage } from '@/lib/browser';
import {
  manualGetCookie,
  manualSetCookie,
  getDevToken,
  coerceOptionalNumber,
  getSafeUser
} from '@/lib/auth-utils';
import { getRoleBasedRedirect } from '@/lib/utils/navigation';

export type LoginResponse = {
  success: boolean;
  user?: User;
  error?: string;
};

export type AuthContextType = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  register: (userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    financeRole?: FinanceRole;
    companyName?: string;
    zoneId?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const authCheckInProgress = useRef(false);
  const initialAuthCheck = useRef(false);
  const lastValidUser = useRef<User | null>(null);
  const isInitializing = useRef(true);
  const lastAuthCheckTime = useRef(0);
  // Refs to read current state without adding to effect dependencies
  const userRef = useRef<User | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  const loadUser = useCallback(async (currentPath?: string): Promise<User | null> => {
    const pathToCheck = currentPath || pathname;
    if (pathToCheck.startsWith('/auth/')) return null;

    try {
      // SECURITY: In production, accessToken is httpOnly and cannot be read by JavaScript
      // We check for role cookies to determine if user might be authenticated
      // The actual auth happens when API client makes requests with withCredentials: true
      const role = getCookie('userRole') || manualGetCookie('userRole');
      const financeRole = getCookie('financeRole') || manualGetCookie('financeRole');

      // Development fallback: check localStorage tokens
      const hasDevToken = process.env.NODE_ENV === 'development' && (
        localStorage.getItem('accessToken') ||
        localStorage.getItem('token') ||
        getDevToken()
      );

      // If no role cookies and no dev token, user is not authenticated
      if (!role && !financeRole && !hasDevToken) return null;

      // Make API call - cookies (including httpOnly accessToken) are sent automatically
      const userData = await authService.getCurrentUser();
      if (!userData || !userData.email) return null;

      const safeUser = getSafeUser(userData);

      setUser(safeUser);
      // Don't set accessToken in state in production - it's httpOnly
      if (process.env.NODE_ENV === 'development' && hasDevToken) {
        setAccessToken(hasDevToken as string);
      }

      // Update role cookies from server response
      setCookie('userRole', safeUser.role, {
        path: '/',
        secure: process.env.NODE_ENV === 'production' && !window.location.hostname.includes('172.28.91.10') && !window.location.hostname.includes('10.91.1.12') && !window.location.hostname.includes('10.91.1.48') && !window.location.hostname.includes('10.91.1.49') && window.location.hostname !== 'localhost',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });

      if (safeUser.financeRole) {
        setCookie('financeRole', safeUser.financeRole, {
          path: '/',
          secure: process.env.NODE_ENV === 'production' && !window.location.hostname.includes('172.28.91.10') && !window.location.hostname.includes('10.91.1.12') && !window.location.hostname.includes('10.91.1.48') && !window.location.hostname.includes('10.91.1.49') && window.location.hostname !== 'localhost',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
        });
      }

      return safeUser;
    } catch (err) {
      throw err;
    }
  }, [pathname]);

  const clearAuthState = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    setError(null);
    lastValidUser.current = null;

    deleteCookie('accessToken');
    deleteCookie('refreshToken');
    deleteCookie('userRole');
    deleteCookie('financeRole');

    safeLocalStorage.removeItem('auth_token');
    safeLocalStorage.removeItem('refresh_token');
    safeLocalStorage.removeItem('cookie_accessToken');
    safeLocalStorage.removeItem('cookie_refreshToken');
    safeLocalStorage.removeItem('cookie_userRole');
    safeLocalStorage.removeItem('cookie_financeRole');
    safeLocalStorage.removeItem('accessToken');
    safeLocalStorage.removeItem('refreshToken');
    safeLocalStorage.removeItem('token');
    safeLocalStorage.removeItem('userRole');
    safeLocalStorage.removeItem('financeRole');
    safeLocalStorage.removeItem('pinAccessSession');
    safeLocalStorage.removeItem('tokenExpiry');
    safeLocalStorage.removeItem('selectedModule');
    safeLocalStorage.removeItem('selectedSubModule');
    safeSessionStorage.removeItem('currentUser');

    if (process.env.NODE_ENV === 'development') {
      safeLocalStorage.removeItem('dev_accessToken');
      safeLocalStorage.removeItem('dev_userRole');
      safeLocalStorage.removeItem('dev_rememberMe');
      safeLocalStorage.removeItem('dev_tokenExpiry');
    }
  }, []);

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize
  useEffect(() => {
    setIsMounted(true);
    if (!isBrowser) {
      isInitializing.current = false;
      return;
    }

    // Restore state from storage on mount to avoid hydration mismatch
    const role = getCookie('userRole') || manualGetCookie('userRole');
    const financeRole = getCookie('financeRole') || manualGetCookie('financeRole');

    // Development fallback
    const devToken = process.env.NODE_ENV === 'development' ? getDevToken() : null;

    if (role || financeRole || devToken) {
      const cachedUser = safeSessionStorage.getItem('currentUser');
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          if (parsedUser && parsedUser.email && (parsedUser.role === role || parsedUser.financeRole === financeRole)) {
            setUser(parsedUser);
            if (devToken) setAccessToken(devToken);
            lastValidUser.current = parsedUser;
            setIsLoading(false);
          }
        } catch (e) { }
      }
      if (devToken) setAccessToken(devToken);
    } else {
      // If no auth indicators, we know we're not loading unless we're on a non-auth page
      if (pathname.startsWith('/auth/')) {
        setIsLoading(false);
      }
    }

    setIsOnline(navigator.onLine);

    // Tiny delay to ensure refs are set before checkAuth runs
    setTimeout(() => {
      isInitializing.current = false;
    }, 10);
  }, []);

  // Auth check effect - uses refs for user/accessToken to avoid re-triggering on state changes
  useEffect(() => {
    const checkAuth = async () => {
      if (isInitializing.current) {
        setTimeout(checkAuth, 100);
        return;
      }

      if (!isOnline || authCheckInProgress.current) return;

      const now = Date.now();
      if (now - lastAuthCheckTime.current < 2000) return;
      lastAuthCheckTime.current = now;

      // Read current values from refs to avoid stale closures without adding to deps
      const currentUser = userRef.current;
      const currentAccessToken = accessTokenRef.current;

      try {
        authCheckInProgress.current = true;

        if (currentUser && currentUser.email && initialAuthCheck.current && !pathname.startsWith('/auth/')) {
          setIsLoading(false);
          return;
        }

        // SECURITY: accessToken is httpOnly, so we check role cookies for auth state
        const role = getCookie('userRole') || manualGetCookie('userRole');
        const financeRole = getCookie('financeRole') || manualGetCookie('financeRole');

        // Development fallback
        const hasDevToken = process.env.NODE_ENV === 'development' && getDevToken();

        if (!role && !financeRole && !hasDevToken) {
          if (currentUser || currentAccessToken) await clearAuthState();
          setIsLoading(false);
          initialAuthCheck.current = true;
          return;
        }

        // Only show loading if we really don't have enough data to show the page
        if (!pathname.startsWith('/auth/') && !currentUser && !initialAuthCheck.current) {
          setIsLoading(true);
        }

        if (currentUser && currentUser.role === role && !pathname.startsWith('/auth/')) {
          setIsLoading(false);
          initialAuthCheck.current = true;
          return;
        }

        try {
          const userData = await loadUser(pathname);
          if (userData) {
            lastValidUser.current = userData;
            safeSessionStorage.setItem('currentUser', JSON.stringify(userData));
          } else {
            // Fall back to cached user if we have role cookies (user might still be valid)
            if (lastValidUser.current && (role || hasDevToken)) {
              setUser(lastValidUser.current);
            } else {
              await clearAuthState();
            }
          }
        } catch (err) {
          const response = (err as any).response;
          if (response?.status === 401 || response?.status === 403) {
            await clearAuthState();
          } else if (lastValidUser.current) {
            setUser(lastValidUser.current);
          }
        }
        initialAuthCheck.current = true;
      } catch (error) {
        if (!currentUser) await clearAuthState();
        initialAuthCheck.current = true;
      } finally {
        setIsLoading(false);
        authCheckInProgress.current = false;
      }
    };

    if (isBrowser && !pathname.startsWith('/auth/')) {
      const timer = setTimeout(checkAuth, 50);
      const safetyTimer = setTimeout(() => { setIsLoading(false); initialAuthCheck.current = true; }, 3000);
      return () => { clearTimeout(timer); clearTimeout(safetyTimer); };
    } else {
      setIsLoading(false);
      initialAuthCheck.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isOnline, clearAuthState, loadUser]);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login({ email, password });
      const safeUser = getSafeUser(response.user);

      // SECURITY: accessToken and refreshToken are set by the backend with httpOnly flag
      // Frontend should NOT set these cookies as it would make them accessible to JavaScript (XSS risk)

      // Only set role cookies for UI purposes (non-sensitive, read by client for routing)
      const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
      const roleOptions = {
        path: '/',
        secure: process.env.NODE_ENV === 'production' && !window.location.hostname.includes('172.28.91.10') && !window.location.hostname.includes('10.91.1.12') && !window.location.hostname.includes('10.91.1.48') && !window.location.hostname.includes('10.91.1.49') && window.location.hostname !== 'localhost',
        sameSite: 'lax' as const,
        maxAge
      };

      // Set role cookies (non-sensitive, needed for client-side routing)
      setCookie('userRole', safeUser.role, roleOptions);
      if (safeUser.financeRole) setCookie('financeRole', safeUser.financeRole, roleOptions);

      // Fallback for development or when cookies are blocked
      manualSetCookie('userRole', safeUser.role, roleOptions);
      if (safeUser.financeRole) manualSetCookie('financeRole', safeUser.financeRole, roleOptions);

      // Store user in state and session storage (for fast access, not for auth)
      setUser(safeUser);
      setAccessToken(response.accessToken); // Keep in memory for API calls
      lastValidUser.current = safeUser;
      safeSessionStorage.setItem('currentUser', JSON.stringify(safeUser));

      toast.success(`Welcome back, ${safeUser.name}!`);

      // Note: Redirect is handled by the calling component (login page) to allow for module-specific redirects

      return { success: true, user: safeUser };
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) { } finally {
      await clearAuthState();
      if (typeof window !== 'undefined') window.location.href = '/auth/login';
    }
  };

  const register = async (userData: any) => {
    setIsLoading(true);
    try {
      const res = await authService.register(userData);
      const regUser: User = { ...res.user, name: res.user.name || 'User' };
      setUser(regUser);
      toast.success('Account created!');
      router.replace(getRoleBasedRedirect(res.user.role, res.user.financeRole));
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Registration failed';
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    return Array.isArray(requiredRole) ? requiredRole.includes(user.role) : user.role === requiredRole;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        hasPermission,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthProvider;
