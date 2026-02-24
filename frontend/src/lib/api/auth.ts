import { cookies } from 'next/headers';
import { UserRole } from '@/types/user.types';

export interface AuthResponseUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // Add other user properties as needed
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';

export async function getCurrentUser(): Promise<AuthResponseUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value || cookieStore.get('token')?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token is invalid or expired
        return null;
      }
      throw new Error('Failed to fetch user data');
    }

    const userData = await response.json();
    return userData;
  } catch (error: any) {
    throw error;
  }
}
