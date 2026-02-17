'use client';

import SparePartsListPage from '@/components/spare-parts/SparePartsListPage'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminSparePartsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return <SparePartsListPage readOnly={!isAdmin} />
}
