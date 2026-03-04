// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

// Authentication
const isProduction = process.env.NODE_ENV === 'production';
export const AUTH_CONFIG = {
  // Cookie names
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_ROLE: 'userRole',

  // Cookie options
  COOKIE_OPTIONS: {
    path: '/',
    secure: isProduction, // Only send over HTTPS in production
    sameSite: 'lax',
    httpOnly: false, // Must be false for client-side access
    maxAge: 60 * 60 * 24 * 30, // 30 days for refresh token
  },

  // Token expiration times (in seconds)
  TOKEN_EXPIRY: {
    ACCESS: 7 * 24 * 60 * 60, // 7 days (matches backend)
    REFRESH: 30 * 24 * 60 * 60, // 30 days (matches backend)
  },

  // API endpoints
  ENDPOINTS: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh-token',
    PROFILE: '/auth/me',
  },
} as const;

// User Roles
export const ROLES = {
  ADMIN: 'ADMIN',
  ZONE_USER: 'ZONE_USER',
  SERVICE_PERSON: 'SERVICE_PERSON',
  CUSTOMER_OWNER: 'CUSTOMER_OWNER',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Role-based access control (RBAC)
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    name: 'Administrator',
    description: 'Full access to all features',
    routes: ['/admin', '/zone', '/service', '/customer'],
  },
  [ROLES.ZONE_USER]: {
    name: 'Zone User',
    description: 'Can manage tickets in assigned zones',
    routes: ['/zone'],
  },
  [ROLES.SERVICE_PERSON]: {
    name: 'Service Person',
    description: 'Can view and update assigned tickets',
    routes: ['/service'],
  },
  [ROLES.CUSTOMER_OWNER]: {
    name: 'Customer',
    description: 'Can view and manage their own tickets',
    routes: ['/customer'],
  },
} as const;

// Ticket Status
export const TICKET_STATUS = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  WAITING_CUSTOMER: 'waiting_customer',
  CLOSED_PENDING: 'closed_pending',
  CLOSED: 'closed',
} as const;

export type TicketStatus = keyof typeof TICKET_STATUS;

// Ticket Priority
export const TICKET_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type TicketPriority = keyof typeof TICKET_PRIORITY;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  RESET_PASSWORD: '/auth/reset-password',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',

  // Role-based routes
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    REPORTS: '/admin/reports',
  },
  ZONE: {
    DASHBOARD: '/zone/dashboard',
    TICKETS: '/zone/tickets',
    ASSETS: '/zone/assets',
  },
  SERVICE: {
    TICKETS: '/service/tickets',
    ASSIGNED: '/service/assigned',
    COMPLETED: '/service/completed',
  },
  CUSTOMER: {
    DASHBOARD: '/customer/dashboard',
    TICKETS: '/customer/tickets',
    NEW_TICKET: '/customer/tickets/new',
  },
} as const;
