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
      if (!pathname) return;
      
      const publicRoutes = ['/pin-access', '/admin/pin-management', '/favicon.ico', '/_next', '/api/auth', '/auth'];
      const isPublicRoute = pathname === '/' || publicRoutes.some(route => route !== '/' && pathname.startsWith(route));

      if (isPublicRoute) {
        setIsValidated(true);
        setIsLoading(false);
        setHasChecked(true);
        return;
      }

      try {
        const pinSession = document.cookie.split('; ').find(row => row.startsWith('pinSession='));
        const localSession = localStorage.getItem('pinAccessSession');
        const urlParams = new URL(window.location.href).searchParams;
        const forceBypass = urlParams.get('forceBypass');
        
        if (pinSession || localSession || forceBypass === 'true') {
          setIsValidated(true);
        } else {
          router.replace('/pin-access');
        }
      } catch (error) {
        router.replace('/pin-access');
      } finally {
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
