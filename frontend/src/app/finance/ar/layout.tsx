import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { FinanceClientWrapper } from '@/components/layout/FinanceClientWrapper';

export default async function FinanceARLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the auth tokens from cookies - check existence
  // Full auth validation happens client-side in AuthContext
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken') || cookieStore.get('token');
  const refreshToken = cookieStore.get('refreshToken');
  
  // If no token AND no refresh token, redirect to login
  // We allow rendering if we have a refresh token so AuthContext can refresh the session
  if (!token?.value && !refreshToken?.value) {
    redirect('/auth/login');
  }

  return (
    <FinanceClientWrapper>
      {children}
    </FinanceClientWrapper>
  );
}

