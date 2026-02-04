'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TicketsListPage from '@/components/tickets/TicketsListPage'

export default function ExpertTicketsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== UserRole.EXPERT_HELPDESK)) {
      router.push('/auth/login?callbackUrl=' + encodeURIComponent('/expert/tickets'))
    }
  }, [authLoading, isAuthenticated, user?.role, router])

  if (authLoading || !isAuthenticated || user?.role !== UserRole.EXPERT_HELPDESK) {
    return null
  }

  return (
    <TicketsListPage 
      role={UserRole.EXPERT_HELPDESK} 
      basePath="/expert/tickets" 
    />
  )
}
