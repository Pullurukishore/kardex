import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { UserRole } from '@/types/user.types';
import { isRouteAccessible, shouldRedirectToLogin } from './lib/utils/navigation';

import { getRoleBasedRedirect } from './lib/utils/navigation';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets (images, fonts, etc.)
  // These were being caught and redirected, causing floods of extra page requests
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|otf|map)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('accessToken')?.value;
  const token = request.cookies.get('token')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const userRole = request.cookies.get('userRole')?.value as UserRole | undefined;

  // Use fallback token logic like other parts of the app
  const authToken = accessToken || token;

  if (pathname.startsWith('/api/')) {
    // Avoid reading request body in middleware as it's an expensive operation

    // Skip authentication check for PIN auth endpoints
    const pinAuthEndpoints = [
      '/api/auth/validate-pin',
      '/api/auth/pin-status',
      '/api/auth/generate-pin'
    ];

    const isPinAuthEndpoint = pinAuthEndpoints.some(endpoint => pathname === endpoint);

    // Block access to API routes if not authenticated (except PIN auth endpoints)
    if (!isPinAuthEndpoint && (!authToken || !refreshToken)) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has access to the API route (skip for PIN auth endpoints)
    const financeRole = request.cookies.get('financeRole')?.value as any;
    if (!isPinAuthEndpoint && !isRouteAccessible(pathname, userRole, financeRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to access this resource' },
        { status: 403 }
      );
    }

    // Add CORS headers for API routes
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }

  // If user is already authenticated and tries to visit any auth page (login, reset-password, etc.),
  // redirect them to the appropriate dashboard instead of showing the auth page
  if (pathname.startsWith('/auth/') && authToken) {
    // If we have an auth token but no role cookies, this is a stale session
    // (e.g., after logout cleared role cookies but httpOnly accessToken persists)
    // Clear the stale cookies and let them proceed to the login page
    if (!userRole && !request.cookies.get('financeRole')?.value) {
      const response = NextResponse.next();
      // Clear stale httpOnly auth cookies that the client couldn't remove
      response.cookies.delete('accessToken');
      response.cookies.delete('token');
      response.cookies.delete('refreshToken');
      return response;
    }
    const financeRoleForRedirect = request.cookies.get('financeRole')?.value as any;
    const redirectPath = getRoleBasedRedirect(userRole, financeRoleForRedirect);
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  // Handle public routes - allow them to load without interference
  if (!shouldRedirectToLogin(pathname)) {
    return NextResponse.next();
  }

  // Require authentication for protected routes
  // Only redirect if both access token AND refresh token are missing
  // If we have a valid access token, allow the request even without refresh token
  if (!authToken) {
    // No access token at all - check if we have refresh token to try refreshing
    if (!refreshToken) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Has refresh token but no access token - let the page load and the client will refresh
  }

  // Check if user has access to the requested route
  const financeRole = request.cookies.get('financeRole')?.value as any;
  if (!isRouteAccessible(pathname, userRole, financeRole)) {
    // If no role is available at all, this is likely a stale session after logout
    // Redirect to login and clear stale auth cookies to prevent infinite loops
    if (!userRole && !financeRole) {
      const loginUrl = new URL('/auth/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      // Clear stale httpOnly auth cookies that the client couldn't remove
      response.cookies.delete('accessToken');
      response.cookies.delete('token');
      response.cookies.delete('refreshToken');
      return response;
    }
    const redirectPath = getRoleBasedRedirect(userRole, financeRole);
    // Prevent self-redirect loop: if we'd redirect to the same path, go to login instead
    if (redirectPath === pathname) {
      const loginUrl = new URL('/auth/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('accessToken');
      response.cookies.delete('token');
      response.cookies.delete('refreshToken');
      return response;
    }
    // Add a small delay header to prevent conflicts with client-side redirects
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.headers.set('X-Redirect-Reason', 'role-access');
    return response;
  }

  return NextResponse.next();
}

// Configure which routes should be processed by this middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf)$).*)',
    '/api/:path*',
  ],
};
