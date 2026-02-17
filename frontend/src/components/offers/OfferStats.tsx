'use client'

import { Button } from '@/components/ui/button'
import { Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface OfferStatsProps {
  stats: {
    total: number
    won: number
    conversionRate: number
    totalValue: number
  }
  createPath?: string
  onImport?: () => void
}

export default function OfferStats({ stats, createPath = '/expert/offers/new', onImport }: OfferStatsProps) {
  const router = useRouter()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const valueStr = formatCurrency(stats.totalValue)
  const isValueLong = valueStr.length > 12

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#E17F70] via-[#CE9F6B] to-[#82A094] rounded-2xl shadow-xl p-3 sm:p-5 text-white mb-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#4F6A64]/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4"></div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-2.5 bg-white/25 backdrop-blur-sm rounded-xl ring-2 ring-white/40 shadow-lg">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold drop-shadow-md">Offer Management</h1>
            <p className="text-white/90 text-xs sm:text-sm mt-0.5">Track, manage, and convert offers to orders</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white/20 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/30 text-center shadow-sm min-w-[70px] sm:min-w-[90px]">
              <p className="text-white/90 text-[10px] font-medium uppercase tracking-wider">Total</p>
              <p className="text-base sm:text-xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-[#82A094]/40 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/30 text-center shadow-sm min-w-[70px] sm:min-w-[90px]">
              <p className="text-white/90 text-[10px] font-medium uppercase tracking-wider">Won</p>
              <p className="text-base sm:text-xl font-bold">{stats.won}</p>
            </div>
            <div className="bg-[#CE9F6B]/40 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/30 text-center shadow-sm min-w-[70px] sm:min-w-[90px]">
              <p className="text-white/90 text-[10px] font-medium uppercase tracking-wider">Win Rate</p>
              <p className="text-base sm:text-xl font-bold">{stats.conversionRate.toFixed(0)}%</p>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/30 text-center shadow-sm min-w-[100px] sm:min-w-[140px]">
              <p className="text-white/90 text-[10px] font-medium uppercase tracking-wider">Value</p>
              <p className={`${isValueLong ? 'text-xs sm:text-sm' : 'text-sm sm:text-lg'} font-bold whitespace-nowrap overflow-hidden text-ellipsis`} title={valueStr}>
                {valueStr}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {onImport && (
              <Button
                onClick={onImport}
                variant="outline"
                className="bg-white/10 text-white border-white/40 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] shadow-lg transition-all flex-1 sm:flex-none font-bold h-9 sm:h-10 text-xs sm:text-sm px-4"
              >
                <Plus className="h-4 w-4 mr-1.5 rotate-45" />
                Import
              </Button>
            )}
            <Button
              onClick={() => router.push(createPath)}
              className="bg-white text-[#9E3B47] hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg transition-all flex-1 sm:flex-none font-bold h-9 sm:h-10 text-xs sm:text-sm px-4"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create New
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
