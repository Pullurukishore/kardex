import { UserRole, FinanceRole } from '@/types/user.types';

export function getRoleBasedRedirect(role?: UserRole | string, financeRole?: FinanceRole | string): string {
  // If user has both FSM and Finance roles, let them choose via module-select
  if (role && financeRole && Object.values(UserRole).includes(role as UserRole)) {
    return '/module-select';
  }

  // If user only has a finance role
  if (financeRole && (!role || !Object.values(UserRole).includes(role as UserRole))) {
    // Finance Approver goes directly to payment approvals
    if (financeRole === FinanceRole.FINANCE_APPROVER) {
      return '/finance/bank-accounts/payment-batches';
    }
    return '/finance/select';
  }

  switch (role) {
    case UserRole.SERVICE_PERSON:
      return '/service-person/dashboard';
    case UserRole.EXTERNAL_USER:
      return '/external/tickets';
    case UserRole.ADMIN:
    case UserRole.ZONE_MANAGER:
    case UserRole.ZONE_USER:
    case UserRole.EXPERT_HELPDESK:
      return '/fsm/select';
    default:
      // Fallback: if we have any finance role, go to finance select
      if (financeRole) return '/finance/select';
      return '/module-select';
  }
}

export function isRouteAccessible(route: string, userRole?: UserRole | string, financeRole?: FinanceRole | string): boolean {
  // Public routes accessible to everyone
  const publicRoutes = ['/auth/login', '/auth/reset-password', '/pin-access'];
  if (publicRoutes.includes(route)) return true;

  // Normalize roles (handle string "undefined" from cookies)
  const normalizedUserRole = (userRole === 'undefined' || !userRole) ? null : userRole;
  const normalizedFinanceRole = (financeRole === 'undefined' || !financeRole) ? null : financeRole;

  // If no role at all is provided, only public routes are accessible
  if (!normalizedUserRole && !normalizedFinanceRole) return false;

  // Common routes accessible to all authenticated users
  const commonAuthenticatedRoutes = ['/module-select', '/fsm', '/finance', '/pin-access'];
  if (commonAuthenticatedRoutes.some(prefix => route.startsWith(prefix))) {
    // Specifically block FINANCE_APPROVER from AR routes
    if (normalizedFinanceRole === 'FINANCE_APPROVER' && route.startsWith('/finance/ar')) {
      return false;
    }
    return true;
  }

  // Role-based route access
  const roleRoutes: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: ['/admin', '/api/admin', '/admin/FSA', '/api/assets', '/api/customers', '/api/zone-users', '/api/tickets', '/api/offers', '/api/quote'],
    [UserRole.ZONE_MANAGER]: ['/zone-manager', '/api/zone-manager', '/zone', '/api/zone', '/api/tickets', '/api/offers', '/api/quote'],
    [UserRole.SERVICE_PERSON]: ['/service-person', '/api/service-person', '/api/tickets'],
    [UserRole.ZONE_USER]: ['/zone', '/api/zone', '/api/tickets', '/api/quote'],
    [UserRole.EXPERT_HELPDESK]: ['/expert', '/api/expert', '/api/tickets', '/api/offers', '/api/quote'],
    [UserRole.EXTERNAL_USER]: ['/external', '/api/external', '/api/tickets'],
  };

  // Get allowed routes for the user's role
  const allowedRoutes = roleRoutes[normalizedUserRole as UserRole] || [];

  // Check if the route starts with any of the allowed paths for the user's role
  return allowedRoutes.some(prefix => route.startsWith(prefix));
}

export function shouldRedirectToLogin(route: string): boolean {
  // Exact-match routes that are public
  const exactPublicRoutes = ['/pin-access'];
  if (exactPublicRoutes.includes(route) || route === '/') return false;

  // Prefix-match routes that are public (multi-segment paths)
  const prefixPublicRoutes = ['/auth/', '/_next/', '/favicon.ico', '/api/auth', '/pin-access/'];
  if (prefixPublicRoutes.some(prefix => route.startsWith(prefix))) return false;

  return true;
}
