'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TicketsListPage from '@/components/tickets/TicketsListPage'

export default function AdminTicketsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== UserRole.ADMIN)) {
      router.push('/auth/login?callbackUrl=' + encodeURIComponent('/admin/tickets'))
    }
  }, [authLoading, isAuthenticated, user?.role, router])

  if (authLoading || !isAuthenticated || user?.role !== UserRole.ADMIN) {
    return null
  }

  return (
    <TicketsListPage 
      role={UserRole.ADMIN} 
      basePath="/admin/tickets" 
      showZoneFilter={true} 
      showViews={true}
    />
  )
}
