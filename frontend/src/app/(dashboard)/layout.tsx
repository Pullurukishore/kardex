import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UserRole } from '@/types/user.types';

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the auth token from cookies - just check existence, don't fetch user
  // Full auth validation happens client-side in AuthContext
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken') || cookieStore.get('token');
  const refreshToken = cookieStore.get('refreshToken');
  
  // Only redirect if BOTH tokens are missing. 
  if (!accessToken?.value && !refreshToken?.value) {
    redirect('/auth/login');
  }

  // Get role from cookie for initial render (client will validate fully)
  const roleCookie = cookieStore.get('userRole');
  const userRole = (roleCookie?.value as UserRole) || UserRole.ZONE_USER;

  return (
    <TooltipProvider>
      <DashboardLayout userRole={userRole}>
        {children}
      </DashboardLayout>
    </TooltipProvider>
  );
}
