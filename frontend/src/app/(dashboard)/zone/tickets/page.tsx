'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TicketsListPage from '@/components/tickets/TicketsListPage'

export default function ZoneTicketsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (user?.role !== UserRole.ZONE_USER && user?.role !== UserRole.ZONE_MANAGER))) {
      router.push('/auth/login?callbackUrl=' + encodeURIComponent('/zone/tickets'))
    }
  }, [authLoading, isAuthenticated, user?.role, router])

  if (authLoading || !isAuthenticated || (user?.role !== UserRole.ZONE_USER && user?.role !== UserRole.ZONE_MANAGER)) {
    return null
  }

  return (
    <TicketsListPage 
      role={user.role as UserRole} 
      basePath="/zone/tickets" 
      detailPathSuffix=""
    />
  )
}