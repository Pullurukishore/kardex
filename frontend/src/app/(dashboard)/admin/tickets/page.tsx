'use client'

import { Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TicketsListPage from '@/components/tickets/TicketsListPage'

function AdminTicketsContent() {
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

export default function AdminTicketsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-[#9E3B47] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AdminTicketsContent />
    </Suspense>
  )
}
