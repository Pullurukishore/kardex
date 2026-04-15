'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'

const AIOfferInsights = dynamic(() => import('@/components/admin/AIOfferInsights'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#96AEC2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#5D6E73] font-medium">Loading AI Intelligence...</p>
      </div>
    </div>
  )
})

export default function AIInsightsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  // Protect this page - only ADMIN can access
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login?callbackUrl=' + encodeURIComponent('/admin/ai-insights'))
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
          <div className="w-12 h-12 border-4 border-[#96AEC2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center shadow-lg shadow-[#546A7A]/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
                <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
                <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
                <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
                <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
                <path d="M6 18a4 4 0 0 1-1.967-.516"/>
                <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
              </svg>
            </div>
            <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#82A094] border-2 border-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#546A7A]">AI Offer Intelligence</h1>
            <p className="text-sm text-[#92A2A5]">AI-powered analysis of your sales pipeline • Powered by Google Gemini</p>
          </div>
        </div>

        {/* AI Insights Component - expanded by default on dedicated page */}
        <AIOfferInsights defaultExpanded={true} />
      </div>
    </div>
  )
}
