'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the growth pillar dashboard component
const GrowthPillarDashboard = dynamic(
  () => import('@/components/reports/GrowthReportDashboard'),
  { 
    loading: () => <GrowthPillarSkeleton />,
    ssr: false 
  }
)

function GrowthPillarSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-60 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="grid grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  )
}

export default function GrowthPillarPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10 to-[#A2B9AF]/10 p-4 md:p-6 lg:p-8">
      <title>Growth Pillar | Kardex Remstar</title>
      
      <Suspense fallback={<GrowthPillarSkeleton />}>
        <GrowthPillarDashboard />
      </Suspense>
    </div>
  )
}
