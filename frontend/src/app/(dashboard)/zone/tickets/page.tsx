'use client'

import { Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TicketsListPage from '@/components/tickets/TicketsListPage'

function ZoneTicketsContent() {
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

export default function ZoneTicketsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-[#9E3B47] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ZoneTicketsContent />
    </Suspense>
  )
}