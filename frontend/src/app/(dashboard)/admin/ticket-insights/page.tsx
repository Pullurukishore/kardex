'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'

const AITicketInsights = dynamic(() => import('@/components/admin/AITicketInsights'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#9E3B47] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#5D6E73] font-medium">Loading AI Intelligence...</p>
      </div>
    </div>
  )
})

export default function TicketInsightsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  // Protect this page - only ADMIN can access
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login?callbackUrl=' + encodeURIComponent('/admin/ticket-insights'))
        return
      }
      if (user?.role !== UserRole.ADMIN) {
        router.push('/admin/dashboard')
        return
      }
    }
  }, [authLoading, isAuthenticated, user?.role, router])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#9E3B47] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5D6E73] font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== UserRole.ADMIN) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#AEBFC3]/10">
      <div className="w-full p-2 sm:p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#9E3B47] to-[#E17F70] flex items-center justify-center shadow-lg shadow-[#9E3B47]/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M2 9a3 3 0 0 1 0 6"/>
                <path d="M22 9a3 3 0 0 0 0 6"/>
                <path d="M13 6a3 3 0 0 0 0 6"/>
                <path d="M13 12a3 3 0 0 0 0 6"/>
                <path d="M13 3a3 3 0 0 0 0 6"/>
                <path d="M13 15a3 3 0 0 0 0 6"/>
                <path d="M5 6h8"/>
                <path d="M5 18h8"/>
                <path d="M11 12h8"/>
              </svg>
            </div>
            <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#82A094] border-2 border-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#546A7A]">AI Ticket Intelligence</h1>
            <p className="text-sm text-[#92A2A5]">AI-powered analysis of your service operations - Powered by Google Gemini</p>
          </div>
        </div>

        {/* AI Insights Component - expanded by default on dedicated page */}
        <AITicketInsights defaultExpanded={true} />
      </div>
    </div>
  )
}
