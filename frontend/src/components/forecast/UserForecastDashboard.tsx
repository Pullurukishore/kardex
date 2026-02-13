'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  Target,
  IndianRupee,
  Calendar,
  Loader2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  CalendarRange,
} from 'lucide-react'
import { apiService } from '@/services/api'
import { exportForecastToExcel } from '@/utils/excelExport'

// Interfaces
interface UserMonthlyData {
  month: string
  monthLabel: string
  offersValue: number
  orderReceived: number
  ordersInHand: number
  buMonthly: number
  percentDev: number | null
  offerBUMonth: number
  offerBUMonthDev: number | null
}

interface ProductBreakdown {
  productType: string
  productLabel: string
  yearlyTarget: number
  monthlyData: UserMonthlyData[]
  totals: {
    offersValue: number
    orderReceived: number
    ordersInHand: number
    buMonthly: number
    offerBUMonth: number
  }
}

interface UserMonthlyBreakdown {
  userId: number
  userName: string
  userShortForm: string | null
  zoneName: string
  hitRate: number
  yearlyTarget: number
  monthlyData: UserMonthlyData[]
  productBreakdown?: ProductBreakdown[]
  totals: {
    offersValue: number
    orderReceived: number
    ordersInHand: number
    buMonthly: number
    offerBUMonth: number
  }
}

interface UserMonthlyResponse {
  year: number
  zoneId: number | null
  users: UserMonthlyBreakdown[]
}

interface Props {
  userId: number
  userName: string
  zoneName: string
}

// Progress bar component
const ProgressBar = ({ value, max, color = 'blue' }: { value: number; max: number; color?: string }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const colorClasses: Record<string, string> = {
    blue: 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]',
    emerald: 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]',
    amber: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]',
    purple: 'bg-gradient-to-r from-[#6F8A9D] to-[#9E3B47]',
  }
  return (
    <div className="w-full h-2 bg-[#92A2A5]/30 dark:bg-[#5D6E73] rounded-full overflow-hidden">
      <div 
        className={`h-full ${colorClasses[color] || colorClasses.blue} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export default function UserForecastDashboard({ userId, userName, zoneName }: Props) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedProbability, setSelectedProbability] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userData, setUserData] = useState<UserMonthlyBreakdown | null>(null)
  const [poExpectedData, setPOExpectedData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showProductBreakdown, setShowProductBreakdown] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [showPOExpected, setShowPOExpected] = useState(true)

  // Refs to prevent duplicate API calls (React StrictMode protection)
  const hasFetchedInitialData = useRef(false)
  const isFetching = useRef(false)

  const years = useMemo(() => {
    const yrs = []
    for (let y = 2030; y >= 2020; y--) {
      yrs.push(y)
    }
    return yrs
  }, [])

  const fetchData = useCallback(async (showRefresh = false) => {
    // Prevent concurrent fetches (except for manual refresh)
    if (isFetching.current && !showRefresh) return
    isFetching.current = true

    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const minProb = selectedProbability === 'all' ? undefined : selectedProbability

      const [userMonthlyRes, poExpectedRes] = await Promise.all([
        apiService.getUserMonthlyBreakdown({ 
          year: selectedYear, 
          userId 
        }),
        apiService.getPOExpectedMonthBreakdown({
          year: selectedYear,
          minProbability: minProb,
          userId
        })
      ])

      // Find the current user's data
      const currentUserData = userMonthlyRes.users.find((u: any) => u.userId === userId)
      setUserData(currentUserData || null)
      setPOExpectedData(poExpectedRes)

    } catch (err: any) {
      console.error('Failed to fetch user forecast data:', err)
      setError(err.message || 'Failed to load forecast data')
    } finally {
      setLoading(false)
      setRefreshing(false)
      isFetching.current = false
    }
  }, [selectedYear, userId, selectedProbability])

  useEffect(() => {
    // Skip if already fetched (React Strict Mode protection)
    if (hasFetchedInitialData.current) return
    hasFetchedInitialData.current = true
    fetchData()
  }, [fetchData])

  // Refetch data when year or probability filter changes
  useEffect(() => {
    // Skip the initial fetch (handled by the effect above)
    if (!hasFetchedInitialData.current) return
    fetchData()
  }, [selectedYear, selectedProbability])

  const handleRefresh = () => {
    fetchData(true)
  }

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      
      const userMonthlyRes = await apiService.getUserMonthlyBreakdown({ year: selectedYear, userId })
      const filteredUsers = userMonthlyRes?.users?.filter((u: any) => u.userId === userId) || []
      
      await exportForecastToExcel({
        year: selectedYear,
        probability: 'all',
        summaryData: null,
        monthlyData: null,
        userMonthlyData: filteredUsers,
        poExpectedData: null,
        productUserZoneData: null,
        productWiseForecastData: null,
      })
    } catch (err: any) {
      console.error('Failed to export Excel:', err)
    } finally {
      setExporting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatCurrencyCompact = (value: number) => {
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`
    } else if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)}L`
    }
    return formatCurrency(value)
  }

  const getDeviationColor = (value: number | null) => {
    if (value === null) return 'text-[#979796]'
    if (value >= 0) return 'text-[#4F6A64] dark:text-[#82A094]'
    if (value >= -25) return 'text-[#976E44] dark:text-[#CE9F6B]'
    return 'text-[#9E3B47] dark:text-[#E17F70]'
  }

  const getDeviationBg = (value: number | null) => {
    if (value === null) return 'bg-[#AEBFC3]/20/80 dark:bg-[#546A7A]/80'
    if (value >= 0) return 'bg-[#82A094]/20/80 dark:bg-[#4F6A64]/40'
    if (value >= -25) return 'bg-[#CE9F6B]/20/80 dark:bg-[#976E44]/40'
    return 'bg-[#EEC1BF]/20/80 dark:bg-[#9E3B47]/40'
  }

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <CheckCircle2 className="h-5 w-5 text-[#82A094]" />
    if (percentage >= 75) return <AlertTriangle className="h-5 w-5 text-[#CE9F6B]" />
    return <XCircle className="h-5 w-5 text-[#E17F70]" />
  }

  const toggleProduct = (productType: string) => {
    const newSet = new Set(expandedProducts)
    if (newSet.has(productType)) {
      newSet.delete(productType)
    } else {
      newSet.add(productType)
    }
    setExpandedProducts(newSet)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#6F8A9D]/20 to-[#6F8A9D]/20 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#6F8A9D] to-[#546A7A] animate-spin flex items-center justify-center shadow-lg shadow-[#96AEC2]/30">
                <Loader2 className="h-8 w-8 text-white animate-spin" style={{ animationDirection: 'reverse' }} />
              </div>
            </div>
          </div>
          <div className="text-center space-y-3">
            <p className="text-2xl font-bold bg-gradient-to-r from-[#546A7A] to-[#546A7A] bg-clip-text text-transparent">
              Loading Your Forecast
            </p>
            <p className="text-sm text-[#757777] dark:text-[#979796] max-w-xs">
              Analyzing your offer data...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="max-w-md border-[#EEC1BF]/50 dark:border-rose-800 shadow-2xl shadow-rose-500/10">
          <CardContent className="pt-10 pb-8 px-8">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/40 dark:to-rose-800/40 flex items-center justify-center shadow-lg">
                <Zap className="h-10 w-10 text-[#E17F70]" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold text-[#9E3B47] dark:text-[#E17F70]">Error Loading Data</p>
                <p className="text-sm text-[#5D6E73] dark:text-[#979796] leading-relaxed">{error}</p>
              </div>
              <Button 
                onClick={() => handleRefresh()} 
                className="mt-4 bg-gradient-to-r from-[#E17F70] to-red-600 hover:from-[#9E3B47] hover:to-red-700 text-white shadow-lg shadow-rose-500/25"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-white dark:bg-[#546A7A] rounded-2xl shadow-xl">
          <BarChart3 className="h-12 w-12 text-[#979796] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#546A7A] dark:text-white mb-2">No Forecast Data</h2>
          <p className="text-[#5D6E73] dark:text-[#979796]">No forecast data found for your account.</p>
        </div>
      </div>
    )
  }

  const achievement = userData.yearlyTarget > 0 
    ? (userData.totals.orderReceived / userData.yearlyTarget) * 100 
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10/30 to-[#6F8A9D]/10/50 dark:from-[#5D6E73] dark:via-slate-900 dark:to-[#5D6E73]">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5D6E73] via-[#546A7A] to-[#546A7A] p-6 md:p-8 shadow-2xl shadow-blue-900/40 border border-white/5">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(147,51,234,0.15),transparent_50%)]" />
          </div>
          
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                    <BarChart3 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                      My Forecast
                    </h1>
                    <p className="text-[#96AEC2]/80 text-sm md:text-base mt-1">
                      {userName} • {zoneName} Zone
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Year Selector */}
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <Calendar className="h-4 w-4 text-white/70" />
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-[80px] border-0 bg-transparent text-white font-semibold focus:ring-0 focus:ring-offset-0 h-auto p-0">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl">
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)} className="font-medium">
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Probability Filter */}
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <Target className="h-4 w-4 text-white/70" />
                  <Select value={String(selectedProbability)} onValueChange={(v) => setSelectedProbability(v === 'all' ? 'all' : parseInt(v))}>
                    <SelectTrigger className="w-[110px] border-0 bg-transparent text-white font-semibold focus:ring-0 focus:ring-offset-0 h-auto p-0">
                      <SelectValue placeholder="Probability" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl">
                      <SelectItem value="all" className="font-medium">All Prob.</SelectItem>
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                        <SelectItem key={p} value={String(p)} className="font-medium">
                          ≥ {p}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Refresh Button */}
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>

                {/* Export Button */}
                <Button
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="bg-gradient-to-r from-[#82A094] to-[#4F6A64] hover:from-[#4F6A64] hover:to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/30"
                >
                  <FileSpreadsheet className={`h-4 w-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {/* Yearly Target */}
          <Card className="bg-white dark:bg-[#546A7A] border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Target className="h-5 w-5 text-[#6F8A9D]" />
                <span className="text-xs font-medium text-[#546A7A] bg-[#6F8A9D]/20 dark:bg-[#546A7A]/40 px-2 py-1 rounded-full">
                  Target
                </span>
              </div>
              <p className="text-2xl font-bold text-[#546A7A] dark:text-white">
                {formatCurrencyCompact(userData.yearlyTarget)}
              </p>
              <p className="text-sm text-[#757777] mt-1">Yearly Target</p>
            </CardContent>
          </Card>

          {/* Orders Received */}
          <Card className="bg-white dark:bg-[#546A7A] border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <IndianRupee className="h-5 w-5 text-[#82A094]" />
                <span className="text-xs font-medium text-[#4F6A64] bg-[#82A094]/20 dark:bg-[#4F6A64]/40 px-2 py-1 rounded-full">
                  Received
                </span>
              </div>
              <p className="text-2xl font-bold text-[#546A7A] dark:text-white">
                {formatCurrencyCompact(userData.totals.orderReceived)}
              </p>
              <p className="text-sm text-[#757777] mt-1">Orders Received</p>
            </CardContent>
          </Card>

          {/* Achievement */}
          <Card className="bg-white dark:bg-[#546A7A] border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                {getStatusIcon(achievement)}
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  achievement >= 100 ? 'text-[#4F6A64] bg-[#82A094]/20' :
                  achievement >= 75 ? 'text-[#976E44] bg-[#CE9F6B]/20' :
                  'text-[#9E3B47] bg-[#EEC1BF]/20'
                }`}>
                  {achievement.toFixed(0)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-[#546A7A] dark:text-white">
                {achievement.toFixed(1)}%
              </p>
              <p className="text-sm text-[#757777] mt-1">Achievement</p>
              <ProgressBar value={achievement} max={100} color={achievement >= 100 ? 'emerald' : achievement >= 75 ? 'amber' : 'blue'} />
            </CardContent>
          </Card>

          {/* Hit Rate */}
          <Card className="bg-white dark:bg-[#546A7A] border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="h-5 w-5 text-[#6F8A9D]" />
                <span className="text-xs font-medium text-[#546A7A] bg-[#96AEC2]/20 dark:bg-[#546A7A]/40 px-2 py-1 rounded-full">
                  Rate
                </span>
              </div>
              <p className="text-2xl font-bold text-[#546A7A] dark:text-white">
                {userData.hitRate}%
              </p>
              <p className="text-sm text-[#757777] mt-1">Hit Rate</p>
            </CardContent>
          </Card>
        </div>

        {/* PO Expected Month Breakdown */}
        {poExpectedData && (
          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader 
              className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] py-4 px-6 cursor-pointer"
              onClick={() => setShowPOExpected(!showPOExpected)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {showPOExpected ? <ChevronDown className="h-5 w-5 text-white" /> : <ChevronRight className="h-5 w-5 text-white" />}
                  <CalendarRange className="h-5 w-5 text-white" />
                  <CardTitle className="text-lg font-bold text-white">PO Expected Month</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  {selectedProbability !== 'all' && (
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full text-white">
                      ≥ {selectedProbability}%
                    </span>
                  )}
                  <span className="text-sm text-white/80">
                    Total: {formatCurrencyCompact(poExpectedData.overallTotals?.grandTotal || 0)}
                  </span>
                </div>
              </div>
            </CardHeader>
            
            {showPOExpected && poExpectedData.months && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#AEBFC3]/10 dark:bg-[#546A7A]/50">
                        <th className="px-4 py-3 text-left font-bold text-[#5D6E73] dark:text-[#92A2A5]">Month</th>
                        <th className="px-4 py-3 text-right font-bold text-[#976E44]">Expected PO Value</th>
                        <th className="px-4 py-3 text-right font-bold text-[#5D6E73]">Offers Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {poExpectedData.months.map((month: any, idx: number) => {
                        const monthValue = poExpectedData.overallTotals?.monthlyTotals?.[month.name] || 0
                        return (
                          <tr key={month.name} className={idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/30'}>
                            <td className="px-4 py-3 font-semibold text-[#5D6E73] dark:text-[#92A2A5]">{month.fullName}</td>
                            <td className="px-4 py-3 text-right font-mono text-[#976E44] font-bold">
                              {monthValue > 0 ? formatCurrencyCompact(monthValue) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-[#5D6E73]">
                              {/* Count could be calculated from zones data if available */}
                              -
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#546A7A] dark:bg-[#546A7A] text-white font-bold">
                        <td className="px-4 py-3">TOTAL</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrencyCompact(poExpectedData.overallTotals?.grandTotal || 0)}</td>
                        <td className="px-4 py-3 text-right">-</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Monthly Breakdown */}
        <Card className="border-0 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] py-4 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-white" />
                <CardTitle className="text-lg font-bold text-white">Monthly Breakdown</CardTitle>
              </div>
              <div className="flex items-center gap-4 text-sm text-white/80">
                <span>Open Funnel: {formatCurrencyCompact(userData.totals.ordersInHand)}</span>
                <span>Offers: {formatCurrencyCompact(userData.totals.offersValue)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#AEBFC3]/10 dark:bg-[#546A7A]/50">
                    <th className="px-4 py-3 text-left font-bold text-[#5D6E73] dark:text-[#92A2A5]">Month</th>
                    <th className="px-4 py-3 text-right font-bold text-[#546A7A]">Offers</th>
                    <th className="px-4 py-3 text-right font-bold text-[#4F6A64]">Orders</th>
                    <th className="px-4 py-3 text-right font-bold text-[#976E44]">Funnel</th>
                    <th className="px-4 py-3 text-right font-bold text-[#546A7A]">BU/Mo</th>
                    <th className="px-4 py-3 text-center font-bold text-[#5D6E73]">%Dev</th>
                    <th className="px-4 py-3 text-right font-bold text-[#546A7A]">OfferBU</th>
                    <th className="px-4 py-3 text-center font-bold text-[#5D6E73]">%Dev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {userData.monthlyData.map((m, idx) => (
                    <tr key={m.month} className={idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/30'}>
                      <td className="px-4 py-3 font-semibold text-[#5D6E73] dark:text-[#92A2A5]">{m.monthLabel}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(m.offersValue)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#4F6A64]">{formatCurrencyCompact(m.orderReceived)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#976E44]">{formatCurrencyCompact(m.ordersInHand)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#546A7A] bg-[#6F8A9D]/10/50 dark:bg-[#546A7A]/20">{formatCurrencyCompact(m.buMonthly)}</td>
                      <td className="px-4 py-3 text-center">
                        {m.percentDev !== null ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${getDeviationBg(m.percentDev)} ${getDeviationColor(m.percentDev)}`}>
                            {m.percentDev >= 0 ? '+' : ''}{m.percentDev}%
                          </span>
                        ) : (
                          <span className="text-[#979796]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#546A7A] bg-[#546A7A]/10/50 dark:bg-[#546A7A]/20">{formatCurrencyCompact(m.offerBUMonth)}</td>
                      <td className="px-4 py-3 text-center">
                        {m.offerBUMonthDev !== null ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${getDeviationBg(m.offerBUMonthDev)} ${getDeviationColor(m.offerBUMonthDev)}`}>
                            {m.offerBUMonthDev >= 0 ? '+' : ''}{m.offerBUMonthDev}%
                          </span>
                        ) : (
                          <span className="text-[#979796]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#546A7A] dark:bg-[#546A7A] text-white font-bold">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrencyCompact(userData.totals.offersValue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrencyCompact(userData.totals.orderReceived)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrencyCompact(userData.totals.ordersInHand)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrencyCompact(userData.totals.buMonthly)}</td>
                    <td className="px-4 py-3 text-center">—</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrencyCompact(userData.totals.offerBUMonth)}</td>
                    <td className="px-4 py-3 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Product Breakdown Toggle */}
        {userData.productBreakdown && userData.productBreakdown.length > 0 && (
          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader 
              className="bg-gradient-to-r from-[#546A7A] to-[#9E3B47] py-4 px-6 cursor-pointer"
              onClick={() => setShowProductBreakdown(!showProductBreakdown)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {showProductBreakdown ? <ChevronDown className="h-5 w-5 text-white" /> : <ChevronRight className="h-5 w-5 text-white" />}
                  <CardTitle className="text-lg font-bold text-white">Product-wise Breakdown</CardTitle>
                </div>
                <span className="text-sm text-white/80">{userData.productBreakdown.length} Products</span>
              </div>
            </CardHeader>
            
            {showProductBreakdown && (
              <CardContent className="p-4 space-y-4">
                {userData.productBreakdown.map(product => {
                  const productAchievement = product.yearlyTarget > 0 
                    ? ((product.totals.orderReceived / product.yearlyTarget) * 100).toFixed(1)
                    : '—'
                  return (
                  <div key={product.productType} className="border border-[#92A2A5] dark:border-[#5D6E73] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleProduct(product.productType)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-[#AEBFC3]/10 dark:bg-[#546A7A] hover:bg-[#AEBFC3]/20 dark:hover:bg-[#5D6E73] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expandedProducts.has(product.productType) ? (
                          <ChevronDown className="h-4 w-4 text-[#5D6E73]" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-[#5D6E73]" />
                        )}
                        <span className="font-semibold text-[#546A7A] dark:text-white">{product.productLabel}</span>
                        {product.yearlyTarget > 0 && (
                          <span className="text-xs text-[#757777] bg-[#92A2A5]/30 dark:bg-[#5D6E73] px-2 py-0.5 rounded-full">
                            Target: {formatCurrencyCompact(product.yearlyTarget)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#757777]">
                          Received: {formatCurrencyCompact(product.totals.orderReceived)}
                        </span>
                        {product.yearlyTarget > 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            Number(productAchievement) >= 100 ? 'bg-[#82A094]/20 text-[#4F6A64]' :
                            Number(productAchievement) >= 75 ? 'bg-[#CE9F6B]/20 text-[#976E44]' :
                            'bg-[#EEC1BF]/20 text-[#9E3B47]'
                          }`}>
                            {productAchievement}%
                          </span>
                        )}
                      </div>
                    </button>
                    
                    {expandedProducts.has(product.productType) && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#AEBFC3]/20 dark:bg-[#546A7A]/80">
                              <th className="px-3 py-2 text-left font-bold text-[#5D6E73]">Month</th>
                              <th className="px-3 py-2 text-right font-bold text-[#546A7A]">Offers</th>
                              <th className="px-3 py-2 text-right font-bold text-[#4F6A64]">Orders</th>
                              <th className="px-3 py-2 text-right font-bold text-[#976E44]">Funnel</th>
                              <th className="px-3 py-2 text-right font-bold text-[#546A7A]">BU/Mo</th>
                              <th className="px-3 py-2 text-center font-bold text-[#5D6E73]">%Dev</th>
                              <th className="px-3 py-2 text-right font-bold text-[#546A7A]">OfferBU</th>
                              <th className="px-3 py-2 text-center font-bold text-[#5D6E73]">%Dev</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {product.monthlyData.map((m, idx) => (
                              <tr key={m.month} className={idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/20'}>
                                <td className="px-3 py-2 font-medium text-[#5D6E73]">{m.monthLabel}</td>
                                <td className="px-3 py-2 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(m.offersValue)}</td>
                                <td className="px-3 py-2 text-right font-mono text-[#4F6A64]">{formatCurrencyCompact(m.orderReceived)}</td>
                                <td className="px-3 py-2 text-right font-mono text-[#976E44]">{formatCurrencyCompact(m.ordersInHand)}</td>
                                <td className="px-3 py-2 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(m.buMonthly)}</td>
                                <td className="px-3 py-2 text-center">
                                  {m.percentDev !== null ? (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold ${getDeviationBg(m.percentDev)} ${getDeviationColor(m.percentDev)}`}>
                                      {m.percentDev >= 0 ? '+' : ''}{m.percentDev}%
                                    </span>
                                  ) : (
                                    <span className="text-[#979796]">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(m.offerBUMonth)}</td>
                                <td className="px-3 py-2 text-center">
                                  {m.offerBUMonthDev !== null ? (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold ${getDeviationBg(m.offerBUMonthDev)} ${getDeviationColor(m.offerBUMonthDev)}`}>
                                      {m.offerBUMonthDev >= 0 ? '+' : ''}{m.offerBUMonthDev}%
                                    </span>
                                  ) : (
                                    <span className="text-[#979796]">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#92A2A5]/30 dark:bg-[#5D6E73] font-bold text-xs">
                              <td className="px-3 py-2 text-[#546A7A] dark:text-white">Total</td>
                              <td className="px-3 py-2 text-right font-mono text-[#546A7A] dark:text-white">{formatCurrencyCompact(product.totals.offersValue)}</td>
                              <td className="px-3 py-2 text-right font-mono text-[#546A7A] dark:text-white">{formatCurrencyCompact(product.totals.orderReceived)}</td>
                              <td className="px-3 py-2 text-right font-mono text-[#546A7A] dark:text-white">{formatCurrencyCompact(product.totals.ordersInHand)}</td>
                              <td className="px-3 py-2 text-right font-mono text-[#546A7A] dark:text-white">{formatCurrencyCompact(product.totals.buMonthly)}</td>
                              <td className="px-3 py-2 text-center text-[#757777]">—</td>
                              <td className="px-3 py-2 text-right font-mono text-[#546A7A] dark:text-white">{formatCurrencyCompact(product.totals.offerBUMonth)}</td>
                              <td className="px-3 py-2 text-center text-[#757777]">—</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                  )
                })}
              </CardContent>
            )}
          </Card>
        )}

        {/* Legend Footer */}
        <div className="flex flex-wrap items-center justify-center gap-6 p-4 bg-white/80 dark:bg-[#546A7A]/80 rounded-2xl text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#96AEC2]/100" />
            <span className="text-[#5D6E73] dark:text-[#979796]">Offers Value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#82A094]/100" />
            <span className="text-[#5D6E73] dark:text-[#979796]">Orders Received</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#CE9F6B]/100" />
            <span className="text-[#5D6E73] dark:text-[#979796]">Open Funnel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#6F8A9D]/100" />
            <span className="text-[#5D6E73] dark:text-[#979796]">BU/Monthly Target</span>
          </div>
        </div>
      </div>
    </div>
  )
}
