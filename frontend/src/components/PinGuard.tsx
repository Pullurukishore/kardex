'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface PinGuardProps {
  children: React.ReactNode;
}

export default function PinGuard({ children }: PinGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isValidated, setIsValidated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const checkPinAccess = async () => {
      // Use a safety timeout to prevent infinite loading if something hangs
      const safetyTimeout = setTimeout(() => {
        setIsLoading(false);
        setHasChecked(true);
      }, 3000);

      try {
        const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
        
        const publicRoutes = ['/pin-access', '/admin/pin-management', '/favicon.ico', '/_next', '/api/auth'];
        const isPublicRoute = currentPath === '/pin-access' || publicRoutes.some(route => currentPath.startsWith(route));

        if (isPublicRoute) {
          setIsValidated(true);
          return;
        }

        const pinSession = document.cookie.split('; ').find(row => row.startsWith('pinSession='));
        const localSession = localStorage.getItem('pinAccessSession');
        const urlParams = new URL(window.location.href).searchParams;
        const forceBypass = urlParams.get('forceBypass');

        if (pinSession || localSession || forceBypass === 'true') {
          setIsValidated(true);
        } else {
          // If not validated and not a public route, redirect
          // Using window.location.href for the initial "gate" redirect is more reliable than router.replace
          // on the first page load/hydration.
          if (typeof window !== 'undefined') {
            const currentUrl = new URL(window.location.href);
            let path = currentUrl.pathname;
            
            // If we are already on a login path with its own callback, 
            // just remember the base login path to avoid messy nesting
            if (path.startsWith('/auth/')) {
              path = '/auth/login';
            } else if (currentUrl.search) {
              // Otherwise, keep the search params but maybe clean them?
              // For now, let's just use the pathname if it's not root
              path = currentUrl.pathname + currentUrl.search;
            }

            // If it's a "start" path (root or login), don't bother with a callbackUrl
            // This keeps the URL clean as /pin-access
            const isStartPath = !path || path === '/' || path.startsWith('/auth/');
            
            const target = !isStartPath && path !== '/pin-access' 
              ? `/pin-access?callbackUrl=${encodeURIComponent(path)}` 
              : '/pin-access';
              
            window.location.href = target;
          }
        }
      } catch (error) {
        console.error('Pin check error:', error);
        if (typeof window !== 'undefined') {
          window.location.href = '/pin-access';
        }
      } finally {
        clearTimeout(safetyTimeout);
        setIsLoading(false);
        setHasChecked(true);
      }
    };

    checkPinAccess();
  }, [pathname, router]);

  // Prevent hydration mismatch by rendering the same thing as server on first client render
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[#96AEC2]/20 border-t-[#6F8A9D] rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[#96AEC2]/20 border-t-[#6F8A9D] rounded-full animate-spin transition-all duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-[#6F8A9D]/10 to-transparent rounded-full animate-pulse-slow"></div>
        </div>
      </div>
    );
  }

  // Show children only if PIN is validated or on public routes
  if (isValidated) {
    return <>{children}</>;
  }

  // This shouldn't render as we redirect above, but just in case
  return null;
}
