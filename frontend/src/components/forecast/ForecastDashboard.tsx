'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, RefreshCw, TrendingUp, TrendingDown, Target, Calendar, 
  BarChart3, Zap, Award, ChevronRight, ChevronDown, Building2, IndianRupee,
  ArrowUpRight, ArrowDownRight, Sparkles, Activity, PieChart,
  CheckCircle2, AlertTriangle, XCircle, User, Users, Package, Download, FileSpreadsheet
} from 'lucide-react'
import { apiService } from '@/services/api'
import { exportForecastToExcel } from '@/utils/excelExport'
import POExpectedMonthTab from './POExpectedMonthTab'
import ProductUserZoneTab from './ProductUserZoneTab'
import ProductWiseForecastTab from './ProductWiseForecastTab'

interface ZoneSummary {
  zoneId: number
  zoneName: string
  noOfOffers: number
  offersValue: number
  ordersReceived: number
  openFunnel: number
  orderBooking: number
  uForBooking: number
  hitRatePercent: number
  balanceBU: number
  yearlyTarget: number
}

interface SummaryTotals {
  noOfOffers: number
  offersValue: number
  ordersReceived: number
  openFunnel: number
  orderBooking: number
  uForBooking: number
  yearlyTarget: number
  balanceBU: number
  hitRatePercent: number
}

interface MonthlyData {
  month: string
  monthLabel: string
  noOfOffers: number
  offersValue: number
  orderReceived: number
  ordersBooked: number
  devORvsBooked: number
  ordersInHand: number
  buMonthly: number
  bookedVsBU: number | null
  percentDev: number | null
  offerBUMonth: number
  offerBUMonthDev: number | null
}

interface ZoneMonthlyBreakdown {
  zoneId: number
  zoneName: string
  hitRate: number
  yearlyTarget: number
  monthlyData: MonthlyData[]
  productBreakdown?: {
    productType: string
    productLabel: string
    yearlyTarget: number
    hitRate: number
    monthlyData: {
      month: string
      monthLabel: string
      offersValue: number
      orderReceived: number
      ordersInHand: number
      buMonthly: number
      percentDev: number | null
      offerBUMonth: number
      offerBUMonthDev: number | null
    }[]
    totals: {
      offersValue: number
      orderReceived: number
      ordersInHand: number
      buMonthly: number
      offerBUMonth: number
    }
  }[]
  totals: {
    offersValue: number
    orderReceived: number
    ordersBooked: number
    ordersInHand: number
    buMonthly: number
    offerBUMonth: number
  }
}

interface UserMonthlyData {
  month: string
  monthLabel: string
  noOfOffers: number
  offersValue: number
  orderReceived: number
  ordersInHand: number
  buMonthly: number
  percentDev: number | null
  offerBUMonth: number
  offerBUMonthDev: number | null
}

interface UserMonthlyBreakdown {
  userId: number
  userName: string
  userShortForm: string | null
  zoneName: string
  hitRate: number
  yearlyTarget: number
  monthlyData: UserMonthlyData[]
  productBreakdown?: {
    productType: string
    productLabel: string
    yearlyTarget: number
    hitRate: number
    monthlyData: {
      month: string
      monthLabel: string
      offersValue: number
      orderReceived: number
      ordersInHand: number
      buMonthly: number
      percentDev: number | null
      offerBUMonth: number
      offerBUMonthDev: number | null
    }[]
    totals: {
      offersValue: number
      orderReceived: number
      ordersInHand: number
      buMonthly: number
      offerBUMonth: number
    }
  }[]
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

interface SummaryResponse {
  year: number
  zones: ZoneSummary[]
  totals: SummaryTotals
}

interface MonthlyResponse {
  year: number
  zones: ZoneMonthlyBreakdown[]
}

// Zone colors for visual distinction with Kardex company colors
const zoneColors: Record<string, { gradient: string; badge: string; ring: string; light: string; glow: string }> = {
  WEST: { gradient: 'from-[#96AEC2] via-[#6F8A9D] to-[#546A7A]', badge: 'bg-[#96AEC2]', ring: 'ring-[#96AEC2]/30', light: 'bg-[#96AEC2]/10', glow: 'shadow-[#96AEC2]/30' },
  SOUTH: { gradient: 'from-[#A2B9AF] via-[#82A094] to-[#4F6A64]', badge: 'bg-[#A2B9AF]', ring: 'ring-[#A2B9AF]/30', light: 'bg-[#A2B9AF]/10', glow: 'shadow-[#A2B9AF]/30' },
  NORTH: { gradient: 'from-[#EEC18F] via-[#CE9F6B] to-[#976E44]', badge: 'bg-[#EEC18F]', ring: 'ring-[#EEC18F]/30', light: 'bg-[#EEC18F]/10', glow: 'shadow-[#EEC18F]/30' },
  EAST: { gradient: 'from-[#6F8A9D] via-[#546A7A] to-[#5D6E73]', badge: 'bg-[#6F8A9D]', ring: 'ring-[#6F8A9D]/30', light: 'bg-[#6F8A9D]/10', glow: 'shadow-[#6F8A9D]/30' },
}

const getZoneColor = (zoneName: string) => {
  const upperName = zoneName.toUpperCase()
  return zoneColors[upperName] || { gradient: 'from-[#92A2A5] to-[#5D6E73]', badge: 'bg-[#AEBFC3]/100', ring: 'ring-[#92A2A5]/30', light: 'bg-[#AEBFC3]/10 dark:bg-[#5D6E73]/30', glow: 'shadow-[#92A2A5]/30' }
}

// Progress bar component - Kardex colors
const ProgressBar = ({ value, max, color = 'blue' }: { value: number; max: number; color?: string }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const colorClasses: Record<string, string> = {
    blue: 'bg-gradient-to-r from-[#96AEC2] to-[#6F8A9D]',
    emerald: 'bg-gradient-to-r from-[#A2B9AF] to-[#82A094]',
    amber: 'bg-gradient-to-r from-[#EEC18F] to-[#CE9F6B]',
    purple: 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]',
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

export default function ForecastDashboard() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyResponse | null>(null)
  const [userMonthlyData, setUserMonthlyData] = useState<UserMonthlyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeZoneTab, setActiveZoneTab] = useState<number | null>(null)
  const [activeUserTab, setActiveUserTab] = useState<number | null>(null)
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'po-expected' | 'product-user-zone' | 'product-wise'>('overview')
  const [selectedProbability, setSelectedProbability] = useState<number | 'all'>('all')
  const [showProductBreakdown, setShowProductBreakdown] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [showUserProductBreakdown, setShowUserProductBreakdown] = useState(false)
  const [expandedUserProducts, setExpandedUserProducts] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  // Refs to prevent duplicate API calls (React StrictMode protection)
  const hasFetchedInitialData = useRef(false)
  const hasFetchedUserData = useRef(false)
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
      const [summaryRes, monthlyRes] = await Promise.all([
        apiService.getForecastSummary({ year: selectedYear, minProbability: minProb }),
        apiService.getForecastMonthly({ year: selectedYear }),
      ])

      setSummaryData(summaryRes)
      setMonthlyData(monthlyRes)
      
      if (monthlyRes.zones.length > 0 && activeZoneTab === null) {
        setActiveZoneTab(monthlyRes.zones[0].zoneId)
      }
    } catch (err: any) {
      console.error('Failed to fetch forecast data:', err)
      setError(err.message || 'Failed to load forecast data')
    } finally {
      setLoading(false)
      setRefreshing(false)
      isFetching.current = false
    }
  }, [selectedYear, activeZoneTab, selectedProbability])

  // Fetch user data separately when zone or year changes
  const fetchUserData = useCallback(async () => {
    if (activeZoneTab === null) return
    
    try {
      const userMonthlyRes = await apiService.getUserMonthlyBreakdown({ 
        year: selectedYear,
        zoneId: activeZoneTab 
      })
      setUserMonthlyData(userMonthlyRes)
      
      if (userMonthlyRes.users.length > 0) {
        setActiveUserTab(userMonthlyRes.users[0].userId)
      } else {
        setActiveUserTab(null)
      }
    } catch (err: any) {
      console.error('Failed to fetch user data:', err)
    }
  }, [selectedYear, activeZoneTab])

  useEffect(() => {
    fetchData()
  }, [selectedYear, selectedProbability])

  // Refetch user data when zone changes
  useEffect(() => {
    // Skip duplicate initial fetch
    if (!hasFetchedUserData.current) {
      hasFetchedUserData.current = true
    }
    fetchUserData()
  }, [fetchUserData])

  const handleRefresh = () => {
    fetchData(true)
    fetchUserData()
  }

  // Excel Export Handler - Fetches all data and exports to multi-sheet workbook
  const handleExportExcel = async () => {
    try {
      setExporting(true)
      
      const minProb = selectedProbability === 'all' ? undefined : selectedProbability
      
      // Get all zone IDs from monthly data
      const zoneIds = monthlyData?.zones?.map(z => z.zoneId) || []
      
      // Fetch all data in parallel for comprehensive export
      const [poExpectedData, productUserZoneData, productWiseForecastData, ...userDataByZone] = await Promise.all([
        apiService.getPOExpectedMonthBreakdown({ year: selectedYear, minProbability: minProb }).catch(() => null),
        apiService.getProductUserZoneBreakdown({ year: selectedYear, minProbability: minProb }).catch(() => null),
        apiService.getProductWiseForecast({ year: selectedYear, minProbability: minProb }).catch(() => null),
        // Fetch user data for each zone
        ...zoneIds.map(zoneId => 
          apiService.getUserMonthlyBreakdown({ year: selectedYear, zoneId }).catch(() => null)
        )
      ])
      
      // Combine all user data by zone
      const allUserData = userDataByZone.filter(Boolean).flatMap((data: any) => data?.users || [])
      
      // Export all data to Excel
      await exportForecastToExcel({
        year: selectedYear,
        probability: selectedProbability,
        summaryData,
        monthlyData,
        userMonthlyData: allUserData,
        poExpectedData,
        productUserZoneData,
        productWiseForecastData,
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

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-IN').format(value)
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

  const getHitRateBadge = (rate: number) => {
    if (rate >= 50) return 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/30'
    if (rate >= 30) return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/30'
    return 'bg-gradient-to-r from-[#E17F70] to-red-600 text-white shadow-lg shadow-rose-500/30'
  }

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <CheckCircle2 className="h-5 w-5 text-[#82A094]" />
    if (percentage >= 75) return <AlertTriangle className="h-5 w-5 text-[#CE9F6B]" />
    return <XCircle className="h-5 w-5 text-[#E17F70]" />
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
              Loading Forecast Dashboard
            </p>
            <p className="text-sm text-[#757777] dark:text-[#979796] max-w-xs">
              Analyzing offer data and calculating performance metrics...
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
                onClick={() => fetchData()} 
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

  const activeZone = monthlyData?.zones.find(z => z.zoneId === activeZoneTab)
  const activeUser = userMonthlyData?.users.find(u => u.userId === activeUserTab)
  const totalAchievement = summaryData && summaryData.totals.yearlyTarget > 0 
    ? (summaryData.totals.ordersReceived / summaryData.totals.yearlyTarget) * 100 
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10/30 to-[#6F8A9D]/10/50 dark:from-[#5D6E73] dark:via-slate-900 dark:to-[#5D6E73]">
      <div className="max-w-[1900px] mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Premium Header with Stats */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5D6E73] via-[#546A7A] to-[#546A7A] p-6 md:p-8 shadow-2xl shadow-blue-900/40 border border-white/5">
          {/* Animated background pattern */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(147,51,234,0.15),transparent_50%)]" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#6F8A9D]/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-[#6F8A9D]/20 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
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
                      Offer Funnel Forecast
                    </h1>
                    <p className="text-[#96AEC2]/80 text-sm md:text-base mt-1">
                      Real-time Performance Analytics & Deviations for {selectedYear}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <Calendar className="h-4 w-4 text-white/70" />
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-[110px] border-0 bg-transparent text-white font-semibold focus:ring-0 focus:ring-offset-0 h-auto p-0">
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
                
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <Target className="h-4 w-4 text-white/70" />
                  <Select value={String(selectedProbability)} onValueChange={(v) => setSelectedProbability(v === 'all' ? 'all' : parseInt(v))}>
                    <SelectTrigger className="w-[130px] border-0 bg-transparent text-white font-semibold focus:ring-0 focus:ring-offset-0 h-auto p-0">
                      <SelectValue placeholder="Probability" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl">
                      <SelectItem value="all" className="font-medium">All Probability</SelectItem>
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                        <SelectItem key={p} value={String(p)} className="font-medium">
                          ≥ {p}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  variant="secondary"
                  size="default"
                  onClick={handleExportExcel}
                  disabled={exporting || loading}
                  className="bg-gradient-to-r from-[#82A094]/20 to-[#82A094]/20 hover:from-[#82A094]/30 hover:to-[#82A094]/30 text-white border border-emerald-400/30 backdrop-blur-sm font-semibold rounded-xl px-5 transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-500/10"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  {exporting ? 'Exporting...' : 'Download Excel'}
                </Button>
                
                <Button
                  variant="secondary"
                  size="default"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm font-semibold rounded-xl px-5 transition-all duration-300 hover:scale-105"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Overall Achievement Banner */}
            {summaryData && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-4 md:gap-8">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-white/60" />
                    <span className="text-white/80 text-sm font-medium">Overall Achievement</span>
                  </div>
                  <div className="flex-1 min-w-[200px] max-w-md">
                    <div className="relative h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#82A094] via-green-400 to-[#82A094] rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(totalAchievement, 100)}%` }}
                      />
                      {totalAchievement > 100 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">{totalAchievement.toFixed(1)}%</span>
                    {getStatusIcon(totalAchievement)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex gap-2 flex-wrap p-1.5 bg-white/80 dark:bg-[#546A7A]/80 backdrop-blur-sm rounded-2xl shadow-lg border border-[#92A2A5]/50 dark:border-[#5D6E73]/50">
          <button
            onClick={() => setActiveMainTab('overview')}
            className={`px-5 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeMainTab === 'overview'
                ? 'bg-gradient-to-r from-[#546A7A] to-[#546A7A] text-white shadow-lg shadow-[#96AEC2]/30 scale-[1.02]'
                : 'text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/20 dark:hover:bg-[#5D6E73]/50'
            }`}
          >
            <span className="text-lg">📊</span>
            <span className="hidden sm:inline">Overview Dashboard</span>
            <span className="sm:hidden">Overview</span>
          </button>
          <button
            onClick={() => setActiveMainTab('po-expected')}
            className={`px-5 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeMainTab === 'po-expected'
                ? 'bg-gradient-to-r from-[#4F6A64] to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/30 scale-[1.02]'
                : 'text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/20 dark:hover:bg-[#5D6E73]/50'
            }`}
          >
            <span className="text-lg">📅</span>
            <span className="hidden sm:inline">PO Expected Month</span>
            <span className="sm:hidden">PO Month</span>
          </button>
          <button
            onClick={() => setActiveMainTab('product-user-zone')}
            className={`px-5 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeMainTab === 'product-user-zone'
                ? 'bg-gradient-to-r from-[#546A7A] to-[#9E3B47] text-white shadow-lg shadow-[#6F8A9D]/30 scale-[1.02]'
                : 'text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/20 dark:hover:bg-[#5D6E73]/50'
            }`}
          >
            <span className="text-lg">📦</span>
            <span className="hidden sm:inline">Product × User × Zone</span>
            <span className="sm:hidden">Product</span>
          </button>
          <button
            onClick={() => setActiveMainTab('product-wise')}
            className={`px-5 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeMainTab === 'product-wise'
                ? 'bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white shadow-lg shadow-[#CE9F6B]/30 scale-[1.02]'
                : 'text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/20 dark:hover:bg-[#5D6E73]/50'
            }`}
          >
            <span className="text-lg">📋</span>
            <span className="hidden sm:inline">Product-wise Forecast</span>
            <span className="sm:hidden">Forecast</span>
          </button>
        </div>

        {/* Conditional Content Based on Tab */}
        {activeMainTab === 'po-expected' ? (
          <POExpectedMonthTab year={selectedYear} minProbability={selectedProbability === 'all' ? undefined : selectedProbability} />
        ) : activeMainTab === 'product-user-zone' ? (
          <ProductUserZoneTab year={selectedYear} minProbability={selectedProbability === 'all' ? undefined : selectedProbability} />
        ) : activeMainTab === 'product-wise' ? (
          <ProductWiseForecastTab year={selectedYear} minProbability={selectedProbability === 'all' ? undefined : selectedProbability} />
        ) : (
          <>
        {/* Quick Stats Cards - Compact Premium */}
        {summaryData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Offers */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 dark:border-[#5D6E73]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#6F8A9D]/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">
                      Total Offers
                    </p>
                    <p className="text-2xl font-black text-[#546A7A] dark:text-white tracking-tight">
                      {formatNumber(summaryData.totals.noOfOffers)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Offers Value */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 dark:border-[#5D6E73]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#82A094]/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">
                      Offers Value
                    </p>
                    <p className="text-xl font-black text-[#546A7A] dark:text-[#6F8A9D] tracking-tight">
                      {formatCurrencyCompact(summaryData.totals.offersValue)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <IndianRupee className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orders Won */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 dark:border-[#5D6E73]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#6F8A9D]/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">
                      Orders Won
                    </p>
                    <p className="text-xl font-black text-[#4F6A64] dark:text-[#82A094] tracking-tight">
                      {formatCurrencyCompact(summaryData.totals.ordersReceived)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-[#92A2A5]/30 dark:bg-[#5D6E73] rounded-full overflow-hidden max-w-[50px]">
                        <div 
                          className="h-full bg-gradient-to-r from-[#82A094] to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(totalAchievement, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[#4F6A64]">{totalAchievement.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#6F8A9D] to-[#9E3B47] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <Award className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Open Funnel */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 dark:border-[#5D6E73]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#CE9F6B]/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">
                      Open Funnel
                    </p>
                    <p className="text-xl font-black text-[#976E44] dark:text-[#CE9F6B] tracking-tight">
                      {formatCurrencyCompact(summaryData.totals.openFunnel)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Zone Summary Table - Compact Premium Design */}
        {summaryData && (
          <Card className="overflow-hidden border border-[#92A2A5]/60 dark:border-[#5D6E73]/60 shadow-lg bg-white dark:bg-[#546A7A] rounded-xl">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-[#5D6E73] py-3 px-4 border-b border-[#5D6E73]/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#96AEC2]/100/20 rounded-lg">
                    <Building2 className="h-4 w-4 text-[#96AEC2]" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white">Zone Performance Summary</CardTitle>
                    <p className="text-[#979796] text-xs">Breakdown by region for {selectedYear}</p>
                  </div>
                </div>
                <Badge className="bg-[#96AEC2]/100/20 text-[#96AEC2] border-[#6F8A9D]/30 font-bold px-2 py-0.5 text-[10px]">
                  {summaryData.zones.length} Zones
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#AEBFC3]/10 dark:bg-[#546A7A]/80 border-b border-[#92A2A5] dark:border-[#5D6E73]">
                      <th className="px-3 py-2 text-left font-bold text-[#5D6E73] dark:text-slate-200 uppercase tracking-wide">Zone</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">No of offers</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Offers value</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Orders received</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Open offer funnel</th>
                      <th className="px-2 py-2 text-right font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wide bg-sky-50/50 dark:bg-sky-900/20">Target</th>
                      <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">%Dev</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Balance</th>
                      <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {summaryData.zones.map((zone, idx) => {
                      const colors = getZoneColor(zone.zoneName)
                      const deviationPercent = zone.yearlyTarget > 0 
                        ? ((zone.ordersReceived / zone.yearlyTarget) * 100 - 100).toFixed(0)
                        : '0'
                      const achievementPercent = zone.yearlyTarget > 0 
                        ? (zone.ordersReceived / zone.yearlyTarget) * 100 
                        : 0
                      return (
                        <tr 
                          key={zone.zoneId} 
                          className={`group hover:bg-[#AEBFC3]/10/80 dark:hover:bg-[#546A7A]/50 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]/50' : 'bg-[#AEBFC3]/10/30 dark:bg-[#546A7A]/20'}`}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-sm`}>
                                <span className="text-white font-bold text-xs">{zone.zoneName.charAt(0)}</span>
                              </div>
                              <span className="font-bold text-[#546A7A] dark:text-white text-xs">{zone.zoneName}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className="font-mono font-bold text-[#5D6E73] dark:text-[#92A2A5]">{zone.noOfOffers}</span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className="font-mono font-medium text-[#546A7A] dark:text-[#6F8A9D]">{formatCurrencyCompact(zone.offersValue)}</span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className="font-mono font-medium text-[#4F6A64] dark:text-[#82A094]">{formatCurrencyCompact(zone.ordersReceived)}</span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className="font-mono font-medium text-[#976E44] dark:text-[#CE9F6B]">{formatCurrencyCompact(zone.openFunnel)}</span>
                          </td>
                          <td className="px-2 py-2 text-right bg-sky-50/30 dark:bg-sky-900/10">
                            <span className="font-mono font-medium text-sky-700 dark:text-sky-400">{formatCurrencyCompact(zone.yearlyTarget)}</span>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              parseFloat(deviationPercent) >= 0 
                                ? 'bg-[#82A094]/20 text-[#4F6A64] dark:bg-[#4F6A64]/40 dark:text-[#82A094]' 
                                : 'bg-[#EEC1BF]/20 text-[#9E3B47] dark:bg-[#9E3B47]/40 dark:text-[#E17F70]'
                            }`}>
                              {parseFloat(deviationPercent) >= 0 ? '+' : ''}{deviationPercent}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            {(() => {
                              const bal = zone.yearlyTarget - zone.ordersReceived
                              return (
                                <span className={`font-mono font-medium ${
                                  bal <= 0 ? 'text-[#4F6A64] dark:text-[#82A094]' : 'text-[#9E3B47] dark:text-[#E17F70]'
                                }`}>
                                  {bal <= 0 ? `Surplus ${formatCurrencyCompact(Math.abs(bal))}` : formatCurrencyCompact(bal)}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 min-w-[40px]">
                                <div className="h-1.5 bg-[#92A2A5]/30 dark:bg-[#5D6E73] rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      achievementPercent >= 100 ? 'bg-[#82A094]/100' :
                                      achievementPercent >= 75 ? 'bg-[#CE9F6B]/100' :
                                      'bg-[#EEC1BF]/100'
                                    }`}
                                    style={{ width: `${Math.min(achievementPercent, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-[#5D6E73] dark:text-[#979796] w-7">
                                {achievementPercent.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-800 to-[#5D6E73] text-white">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <PieChart className="h-4 w-4" />
                          <span className="font-bold text-sm">Total</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-bold">{summaryData.totals.noOfOffers}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[#96AEC2]">{formatCurrencyCompact(summaryData.totals.offersValue)}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[#82A094]">{formatCurrencyCompact(summaryData.totals.ordersReceived)}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[#EEC1BF]">{formatCurrencyCompact(summaryData.totals.openFunnel)}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-sky-300">{formatCurrencyCompact(summaryData.totals.yearlyTarget)}</td>
                      <td className="px-1 py-2 text-center">
                        {(() => {
                          const totalDeviation = summaryData.totals.yearlyTarget > 0 
                            ? ((summaryData.totals.ordersReceived / summaryData.totals.yearlyTarget) * 100 - 100).toFixed(0)
                            : '0'
                          return (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              parseFloat(totalDeviation) >= 0 
                                ? 'bg-[#82A094]/100/30 text-[#82A094]' 
                                : 'bg-[#EEC1BF]/100/30 text-rose-300'
                            }`}>
                              {parseFloat(totalDeviation) >= 0 ? '+' : ''}{totalDeviation}%
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-bold">
                        {(() => {
                          const totalBal = summaryData.totals.yearlyTarget - summaryData.totals.ordersReceived
                          return (
                            <span className={totalBal <= 0 ? 'text-[#82A094]' : 'text-[#E17F70]'}>
                              {totalBal <= 0 ? `Surplus ${formatCurrencyCompact(Math.abs(totalBal))}` : formatCurrencyCompact(totalBal)}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-[40px]">
                            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#82A094] to-green-400 rounded-full"
                                style={{ width: `${Math.min(totalAchievement, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-white/80 w-7">
                            {totalAchievement.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zone Monthly Breakdown */}
        {monthlyData && (
          <div className="space-y-3">
            {/* Zone Tabs - Compact */}
            <div className="flex flex-wrap gap-2">
              {monthlyData.zones.map((zone) => {
                const colors = getZoneColor(zone.zoneName)
                const isActive = activeZoneTab === zone.zoneId
                return (
                  <button
                    key={zone.zoneId}
                    onClick={() => setActiveZoneTab(zone.zoneId)}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      isActive 
                        ? `bg-gradient-to-r ${colors.gradient} text-white shadow-lg scale-102` 
                        : 'bg-white dark:bg-[#546A7A] text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/10 dark:hover:bg-[#5D6E73] shadow border border-[#92A2A5]/50 dark:border-[#5D6E73]/50'
                    }`}
                  >
                    <span>{zone.zoneName}</span>
                    <Badge className={`${isActive ? 'bg-white/20 text-white border-white/20' : getHitRateBadge(zone.hitRate)} text-[10px] font-bold px-1.5 py-0`}>
                      {zone.hitRate}% HR
                    </Badge>
                    {isActive && <ChevronRight className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>

            {/* Active Zone Card - Compact */}
            {activeZone && (
              <Card className="overflow-hidden border-0 shadow-lg bg-white/90 dark:bg-[#546A7A]/90 backdrop-blur-sm rounded-xl">
                <CardHeader className={`bg-gradient-to-r ${getZoneColor(activeZone.zoneName).gradient} py-3 px-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/15 rounded-lg">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white">{activeZone.zoneName} Zone</CardTitle>
                        <p className="text-white/70 text-xs">Monthly Breakdown</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowProductBreakdown(!showProductBreakdown)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          showProductBreakdown 
                            ? 'bg-white text-[#546A7A] shadow' 
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Products
                        {showProductBreakdown ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <div className="text-right px-3 py-1 bg-white/10 rounded-lg">
                        <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">Hit Rate</p>
                        <p className="text-lg font-extrabold text-white">{activeZone.hitRate}%</p>
                      </div>
                      <div className="text-right px-3 py-1 bg-white/10 rounded-lg">
                        <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">Target</p>
                        <p className="text-base font-bold text-white">{formatCurrencyCompact(activeZone.yearlyTarget)}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95 shadow-sm">
                          <th className="px-2 py-2 text-left font-bold text-[#5D6E73] dark:text-slate-200 uppercase tracking-wide sticky left-0 bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95 z-20">Month</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="NUMBER OF OFFERS: Count of offers created in this month">No of offers</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="OFFERS VALUE: Total value of all offers created in this month (based on offerMonth)">Offers value</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="ORDERS RECEIVED: PO value of WON offers where PO received in this month (poReceivedMonth)">Orders received</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="OPEN FUNNEL: Value of offers created in this month that are currently OPEN (pending in pipeline)">Open offer funnel</th>
                          <th className="px-2 py-2 text-right font-bold text-[#546A7A] dark:text-[#6F8A9D] uppercase tracking-wide bg-[#6F8A9D]/10/50 dark:bg-[#546A7A]/20 cursor-help" title="BU/MONTHLY: Yearly Zone Target ÷ 12 = Monthly booking target">BU/Mo</th>
                          <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="% DEV (Orders): ((Orders - BU/Mo) / BU/Mo) × 100. Negative = below target, Positive = above target">%Dev</th>
                          <th className="px-2 py-2 text-right font-bold text-[#546A7A] dark:text-[#6F8A9D] uppercase tracking-wide bg-[#546A7A]/10/50 dark:bg-[#546A7A]/20 cursor-help" title="OFFER BU MONTH: BU/Mo × 4 = Pipeline coverage target (4x for healthy funnel)">OfferBU</th>
                          <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="% DEV (Offers): ((Offers - OfferBU) / OfferBU) × 100. Negative = below target, Positive = above target">%Dev</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {activeZone.monthlyData.map((month, idx) => (
                          <tr 
                            key={month.month} 
                            className={`hover:bg-[#96AEC2]/10/50 dark:hover:bg-[#546A7A]/40 transition-colors ${
                              idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]/50' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/20'
                            }`}
                          >
                            <td className="px-2 py-1.5 sticky left-0 bg-inherit">
                              <span className="font-semibold text-[#546A7A] dark:text-slate-200">{month.monthLabel.slice(0, 3)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-bold text-[#5D6E73] dark:text-[#92A2A5]">{month.noOfOffers || 0}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-medium text-[#546A7A] dark:text-[#6F8A9D]">{formatCurrencyCompact(month.offersValue)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-medium text-[#4F6A64] dark:text-[#82A094]">{formatCurrencyCompact(month.orderReceived)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-medium text-[#976E44] dark:text-[#CE9F6B]">{formatCurrencyCompact(month.ordersInHand)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right bg-[#6F8A9D]/10/30 dark:bg-[#546A7A]/10">
                              <span className="font-mono font-medium text-[#546A7A] dark:text-[#6F8A9D]">{formatCurrencyCompact(month.buMonthly)}</span>
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.percentDev)} ${getDeviationColor(month.percentDev)}`}>
                                {month.percentDev !== null ? (
                                  <>{month.percentDev > 0 ? '+' : ''}{month.percentDev}%</>
                                ) : <span className="text-[#979796]">-</span>}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right bg-[#546A7A]/10/30 dark:bg-[#546A7A]/10">
                              <span className="font-mono font-medium text-[#546A7A] dark:text-[#96AEC2]">{formatCurrencyCompact(month.offerBUMonth)}</span>
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.offerBUMonthDev)} ${getDeviationColor(month.offerBUMonthDev)}`}>
                                {month.offerBUMonthDev !== null ? (
                                  <>{month.offerBUMonthDev > 0 ? '+' : ''}{month.offerBUMonthDev}%</>
                                ) : <span className="text-[#979796]">-</span>}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 font-bold">
                          <td className="px-2 py-2 text-[#546A7A] dark:text-white sticky left-0 bg-[#92A2A5]/30 dark:bg-[#546A7A]">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Total
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-white">{activeZone.monthlyData.reduce((sum, m) => sum + (m.noOfOffers || 0), 0)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-[#96AEC2]">{formatCurrencyCompact(activeZone.totals.offersValue)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#4F6A64] dark:text-[#82A094]">{formatCurrencyCompact(activeZone.totals.orderReceived)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#976E44] dark:text-[#CE9F6B]">{formatCurrencyCompact(activeZone.totals.ordersInHand)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-[#6F8A9D] bg-[#6F8A9D]/20/50 dark:bg-[#546A7A]/30">{formatCurrencyCompact(activeZone.totals.buMonthly)}</td>
                          <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-[#6F8A9D] bg-[#546A7A]/20/50 dark:bg-[#546A7A]/30">{formatCurrencyCompact(activeZone.totals.offerBUMonth)}</td>
                          <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Product Breakdown Section - Expandable */}
                  {showProductBreakdown && activeZone.productBreakdown && activeZone.productBreakdown.length > 0 && (
                    <div className="border-t border-[#92A2A5] dark:border-[#5D6E73] mt-2">
                      <div className="px-4 py-2 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 dark:from-orange-900/20 dark:to-amber-900/20">
                        <h4 className="text-xs font-bold text-[#976E44] dark:text-orange-300 uppercase tracking-wider flex items-center gap-2">
                          <Package className="h-3.5 w-3.5" />
                          Product Type Breakdown ({activeZone.productBreakdown.length} types)
                        </h4>
                      </div>
                      <div className="space-y-1 p-2">
                        {activeZone.productBreakdown.map((product: any) => {
                          const isExpanded = expandedProducts.has(product.productType)
                          return (
                            <div key={product.productType} className="border border-[#CE9F6B] dark:border-orange-800 rounded-lg overflow-hidden">
                              {/* Product Header - Clickable */}
                              <button
                                onClick={() => {
                                  const newSet = new Set(expandedProducts)
                                  if (isExpanded) {
                                    newSet.delete(product.productType)
                                  } else {
                                    newSet.add(product.productType)
                                  }
                                  setExpandedProducts(newSet)
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 bg-[#CE9F6B]/10 dark:bg-[#976E44]/30 hover:bg-[#CE9F6B]/20 dark:hover:bg-[#976E44]/50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="h-4 w-4 text-[#976E44]" /> : <ChevronRight className="h-4 w-4 text-[#976E44]" />}
                                  <Package className="h-4 w-4 text-[#976E44]" />
                                  <span className="font-semibold text-[#546A7A] dark:text-white">{product.productLabel}</span>
                                  {product.yearlyTarget > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-[#6F8A9D]/20 dark:bg-[#546A7A] text-[#546A7A] dark:text-[#6F8A9D] rounded-full">
                                      Target: {formatCurrencyCompact(product.yearlyTarget)}
                                    </span>
                                  )}
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    product.hitRate >= 50 ? 'bg-[#82A094]/20 dark:bg-[#4F6A64] text-[#4F6A64] dark:text-[#82A094]' : 
                                    product.hitRate >= 25 ? 'bg-[#CE9F6B]/20 dark:bg-[#976E44] text-[#976E44] dark:text-[#CE9F6B]' : 
                                    'bg-[#AEBFC3]/20 dark:bg-[#5D6E73] text-[#5D6E73] dark:text-[#92A2A5]'
                                  }`}>
                                    Hit: {product.hitRate}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-[#546A7A]">Offers: {formatCurrencyCompact(product.totals.offersValue)}</span>
                                  <span className="text-[#4F6A64]">Orders: {formatCurrencyCompact(product.totals.orderReceived)}</span>
                                  <span className="text-[#976E44]">Funnel: {formatCurrencyCompact(product.totals.ordersInHand)}</span>
                                </div>
                              </button>
                              
                              {/* Expanded Monthly Table */}
                              {isExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95">
                                        <th className="px-2 py-2 text-left font-bold text-[#5D6E73] uppercase tracking-wide sticky left-0 bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95">Month</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#5D6E73]">No of offers</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#546A7A]">Offers value</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#4F6A64]">Orders received</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#976E44]">Open offer funnel</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#546A7A] bg-[#6F8A9D]/10/50 dark:bg-[#546A7A]/20">BU/Mo</th>
                                        <th className="px-2 py-2 text-center font-bold text-[#5D6E73]">%Dev</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#546A7A] bg-[#546A7A]/10/50 dark:bg-[#546A7A]/20">OfferBU</th>
                                        <th className="px-2 py-2 text-center font-bold text-[#5D6E73]">%Dev</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                      {product.monthlyData.map((month: any, idx: number) => (
                                        <tr key={month.month} className={idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]/50' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/20'}>
                                          <td className="px-2 py-1.5 sticky left-0 bg-inherit font-semibold text-[#546A7A]">{month.monthLabel.slice(0, 3)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono font-bold text-[#5D6E73]">{month.noOfOffers || 0}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(month.offersValue)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#4F6A64]">{formatCurrencyCompact(month.orderReceived)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#976E44]">{formatCurrencyCompact(month.ordersInHand)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#546A7A] bg-[#6F8A9D]/10/30 dark:bg-[#546A7A]/10">{formatCurrencyCompact(month.buMonthly)}</td>
                                          <td className="px-1 py-1.5 text-center">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.percentDev)} ${getDeviationColor(month.percentDev)}`}>
                                              {month.percentDev !== null ? (<>{month.percentDev > 0 ? '+' : ''}{month.percentDev}%</>) : <span className="text-[#979796]">-</span>}
                                            </span>
                                          </td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#546A7A] bg-[#546A7A]/10/30 dark:bg-[#546A7A]/10">{formatCurrencyCompact(month.offerBUMonth)}</td>
                                          <td className="px-1 py-1.5 text-center">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.offerBUMonthDev)} ${getDeviationColor(month.offerBUMonthDev)}`}>
                                              {month.offerBUMonthDev !== null ? (<>{month.offerBUMonthDev > 0 ? '+' : ''}{month.offerBUMonthDev}%</>) : <span className="text-[#979796]">-</span>}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-gradient-to-r from-orange-100 to-[#EEC1BF]/20 dark:from-orange-900/30 dark:to-amber-900/30 font-bold">
                                        <td className="px-2 py-2 text-[#546A7A] dark:text-white sticky left-0 bg-[#CE9F6B]/20 dark:bg-[#976E44]/30">Total</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A]">{product.monthlyData.reduce((sum: number, m: any) => sum + (m.noOfOffers || 0), 0)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(product.totals.offersValue)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#4F6A64]">{formatCurrencyCompact(product.totals.orderReceived)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#976E44]">{formatCurrencyCompact(product.totals.ordersInHand)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A] bg-[#6F8A9D]/20/50">{formatCurrencyCompact(product.totals.buMonthly)}</td>
                                        <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A] bg-[#546A7A]/20/50">{formatCurrencyCompact(product.totals.offerBUMonth)}</td>
                                        <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* User Monthly Breakdown - Compact */}
        {userMonthlyData && userMonthlyData.users.length > 0 && (
          <div className="space-y-3">
            {/* User Section Header - Compact */}
            <div className="flex items-center gap-2 pt-2">
              <div className="p-1.5 bg-gradient-to-br from-[#6F8A9D]/20 to-[#6F8A9D]/20 rounded-lg">
                <Users className="h-4 w-4 text-[#546A7A] dark:text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#546A7A] dark:text-white">User Performance</h3>
                <p className="text-xs text-[#757777] dark:text-[#979796]">{userMonthlyData.users.length} users</p>
              </div>
            </div>

            {/* User Tabs - Compact */}
            <div className="flex flex-wrap gap-2">
              {userMonthlyData.users.slice(0, 10).map((user) => {
                const isActive = activeUserTab === user.userId
                return (
                  <button
                    key={user.userId}
                    onClick={() => setActiveUserTab(user.userId)}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      isActive 
                        ? 'bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#546A7A] text-white shadow-lg scale-102' 
                        : 'bg-white dark:bg-[#546A7A] text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/10 dark:hover:bg-[#5D6E73] shadow border border-[#92A2A5]/50 dark:border-[#5D6E73]/50'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${
                      isActive ? 'bg-white/20' : 'bg-[#96AEC2]/20 dark:bg-[#546A7A]/30'
                    }`}>
                      <User className={`h-3 w-3 ${isActive ? 'text-white' : 'text-[#546A7A] dark:text-cyan-400'}`} />
                    </div>
                    <span className="text-xs">{user.userName}</span>
                    {isActive && <ChevronRight className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>

            {/* Active User Card - Compact */}
            {activeUser && (
              <Card className="overflow-hidden border-0 shadow-lg bg-white/90 dark:bg-[#546A7A]/90 backdrop-blur-sm rounded-xl">
                <CardHeader className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#546A7A] py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/15 rounded-lg">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white">{activeUser.userName}</CardTitle>
                        <p className="text-white/70 text-xs">
                          <span className="text-white/90 font-medium">{activeUser.zoneName}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowUserProductBreakdown(!showUserProductBreakdown)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          showUserProductBreakdown 
                            ? 'bg-white text-[#546A7A] shadow' 
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Products
                        {showUserProductBreakdown ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <div className="text-right px-3 py-1 bg-white/10 rounded-lg">
                        <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">Hit Rate</p>
                        <p className="text-lg font-extrabold text-white">{activeUser.hitRate}%</p>
                      </div>
                      <div className="text-right px-3 py-1 bg-white/10 rounded-lg">
                        <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">Target</p>
                        <p className="text-base font-bold text-white">{formatCurrencyCompact(activeUser.yearlyTarget)}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95 shadow-sm">
                          <th className="px-2 py-2 text-left font-bold text-[#5D6E73] dark:text-slate-200 uppercase tracking-wide sticky left-0 bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95 z-20">Month</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="NUMBER OF OFFERS: Count of offers created by this user in this month">No of offers</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="OFFERS VALUE: Total value of all offers created by this user in this month">Offers value</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="ORDERS RECEIVED: PO value of WON offers created by this user in this month">Orders received</th>
                          <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="OPEN FUNNEL: Offers Value - Orders Received (pending offers in pipeline)">Open offer funnel</th>
                          <th className="px-2 py-2 text-right font-bold text-[#546A7A] dark:text-[#6F8A9D] uppercase tracking-wide bg-[#6F8A9D]/10/50 dark:bg-[#546A7A]/20 cursor-help" title="BU/MONTHLY: User's Yearly Target ÷ 12 = Monthly booking target">BU/Mo</th>
                          <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="% DEV (Orders): ((Orders - BU/Mo) / BU/Mo) × 100. Negative = below target, Positive = above target">%Dev</th>
                          <th className="px-2 py-2 text-right font-bold text-[#546A7A] dark:text-[#6F8A9D] uppercase tracking-wide bg-[#546A7A]/10/50 dark:bg-[#546A7A]/20 cursor-help" title="OFFER BU MONTH: BU/Mo × 4 = Monthly offer target (4x pipeline coverage)">OfferBU</th>
                          <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide cursor-help" title="% DEV (Offers): ((Offers - OfferBU) / OfferBU) × 100. Negative = below target, Positive = above target">%Dev</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {activeUser.monthlyData.map((month, idx) => (
                          <tr 
                            key={month.month} 
                            className={`hover:bg-[#96AEC2]/10/50 dark:hover:bg-[#546A7A]/40 transition-colors ${
                              idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]/50' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/20'
                            }`}
                          >
                            <td className="px-2 py-1.5 sticky left-0 bg-inherit">
                              <span className="font-semibold text-[#546A7A] dark:text-slate-200">{month.monthLabel.slice(0, 3)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-bold text-[#5D6E73] dark:text-[#92A2A5]">{month.noOfOffers || 0}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-medium text-[#546A7A] dark:text-[#6F8A9D]">{formatCurrencyCompact(month.offersValue)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-medium text-[#4F6A64] dark:text-[#82A094]">{formatCurrencyCompact(month.orderReceived)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-medium text-[#976E44] dark:text-[#CE9F6B]">{formatCurrencyCompact(month.ordersInHand)}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right bg-[#6F8A9D]/10/30 dark:bg-[#546A7A]/10">
                              <span className="font-mono font-medium text-[#546A7A] dark:text-[#6F8A9D]">{formatCurrencyCompact(month.buMonthly)}</span>
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.percentDev)} ${getDeviationColor(month.percentDev)}`}>
                                {month.percentDev !== null ? (
                                  <>{month.percentDev > 0 ? '+' : ''}{month.percentDev}%</>
                                ) : <span className="text-[#979796]">-</span>}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right bg-[#546A7A]/10/30 dark:bg-[#546A7A]/10">
                              <span className="font-mono font-medium text-[#546A7A] dark:text-[#96AEC2]">{formatCurrencyCompact(month.offerBUMonth)}</span>
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.offerBUMonthDev)} ${getDeviationColor(month.offerBUMonthDev)}`}>
                                {month.offerBUMonthDev !== null ? (
                                  <>{month.offerBUMonthDev > 0 ? '+' : ''}{month.offerBUMonthDev}%</>
                                ) : <span className="text-[#979796]">-</span>}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 font-bold">
                          <td className="px-2 py-2 text-[#546A7A] dark:text-white sticky left-0 bg-[#92A2A5]/30 dark:bg-[#546A7A]">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Total
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-white">{activeUser.monthlyData.reduce((sum, m) => sum + (m.noOfOffers || 0), 0)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-[#96AEC2]">{formatCurrencyCompact(activeUser.totals.offersValue)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#4F6A64] dark:text-[#82A094]">{formatCurrencyCompact(activeUser.totals.orderReceived)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#976E44] dark:text-[#CE9F6B]">{formatCurrencyCompact(activeUser.totals.ordersInHand)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-[#6F8A9D] bg-[#6F8A9D]/20/50 dark:bg-[#546A7A]/30">{formatCurrencyCompact(activeUser.totals.buMonthly)}</td>
                          <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-[#6F8A9D] bg-[#546A7A]/20/50 dark:bg-[#546A7A]/30">{formatCurrencyCompact(activeUser.totals.offerBUMonth)}</td>
                          <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* User Product Breakdown Section - Expandable */}
                  {showUserProductBreakdown && activeUser.productBreakdown && activeUser.productBreakdown.length > 0 && (
                    <div className="border-t border-[#92A2A5] dark:border-[#5D6E73] mt-2">
                      <div className="px-4 py-2 bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 dark:from-cyan-900/20 dark:to-[#546A7A]/20">
                        <h4 className="text-xs font-bold text-[#546A7A] dark:text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                          <Package className="h-3.5 w-3.5" />
                          Product Type Breakdown ({activeUser.productBreakdown.length} types)
                        </h4>
                      </div>
                      <div className="space-y-1 p-2">
                        {activeUser.productBreakdown.map((product: any) => {
                          const isExpanded = expandedUserProducts.has(product.productType)
                          return (
                            <div key={product.productType} className="border border-[#96AEC2]/50 dark:border-cyan-800 rounded-lg overflow-hidden">
                              {/* Product Header - Clickable */}
                              <button
                                onClick={() => {
                                  const newSet = new Set(expandedUserProducts)
                                  if (isExpanded) {
                                    newSet.delete(product.productType)
                                  } else {
                                    newSet.add(product.productType)
                                  }
                                  setExpandedUserProducts(newSet)
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 bg-[#96AEC2]/10 dark:bg-[#546A7A]/30 hover:bg-[#96AEC2]/20 dark:hover:bg-[#546A7A]/50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="h-4 w-4 text-[#546A7A]" /> : <ChevronRight className="h-4 w-4 text-[#546A7A]" />}
                                  <Package className="h-4 w-4 text-[#546A7A]" />
                                  <span className="font-semibold text-[#546A7A] dark:text-white">{product.productLabel}</span>
                                  {product.yearlyTarget > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-[#6F8A9D]/20 dark:bg-[#546A7A] text-[#546A7A] dark:text-[#6F8A9D] rounded-full">
                                      Target: {formatCurrencyCompact(product.yearlyTarget)}
                                    </span>
                                  )}
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    product.hitRate >= 50 ? 'bg-[#82A094]/20 dark:bg-[#4F6A64] text-[#4F6A64] dark:text-[#82A094]' : 
                                    product.hitRate >= 25 ? 'bg-[#CE9F6B]/20 dark:bg-[#976E44] text-[#976E44] dark:text-[#CE9F6B]' : 
                                    'bg-[#AEBFC3]/20 dark:bg-[#5D6E73] text-[#5D6E73] dark:text-[#92A2A5]'
                                  }`}>
                                    Hit: {product.hitRate}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-[#546A7A]">Offers: {formatCurrencyCompact(product.totals.offersValue)}</span>
                                  <span className="text-[#4F6A64]">Orders: {formatCurrencyCompact(product.totals.orderReceived)}</span>
                                  <span className="text-[#976E44]">Funnel: {formatCurrencyCompact(product.totals.ordersInHand)}</span>
                                </div>
                              </button>
                              
                              {/* Expanded Monthly Table */}
                              {isExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95">
                                        <th className="px-2 py-2 text-left font-bold text-[#5D6E73] uppercase tracking-wide sticky left-0 bg-[#AEBFC3]/20/95 dark:bg-[#546A7A]/95">Month</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#5D6E73]">No of offers</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#546A7A]">Offers value</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#4F6A64]">Orders received</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#976E44]">Open offer funnel</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#546A7A] bg-[#6F8A9D]/10/50 dark:bg-[#546A7A]/20">BU/Mo</th>
                                        <th className="px-2 py-2 text-center font-bold text-[#5D6E73]">%Dev</th>
                                        <th className="px-2 py-2 text-right font-bold text-[#546A7A] bg-[#546A7A]/10/50 dark:bg-[#546A7A]/20">OfferBU</th>
                                        <th className="px-2 py-2 text-center font-bold text-[#5D6E73]">%Dev</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                      {product.monthlyData.map((month: any, idx: number) => (
                                        <tr key={month.month} className={idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]/50' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/20'}>
                                          <td className="px-2 py-1.5 sticky left-0 bg-inherit font-semibold text-[#546A7A]">{month.monthLabel.slice(0, 3)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono font-bold text-[#5D6E73]">{month.noOfOffers || 0}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(month.offersValue)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#4F6A64]">{formatCurrencyCompact(month.orderReceived)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#976E44]">{formatCurrencyCompact(month.ordersInHand)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#546A7A] bg-[#6F8A9D]/10/30 dark:bg-[#546A7A]/10">{formatCurrencyCompact(month.buMonthly)}</td>
                                          <td className="px-1 py-1.5 text-center">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.percentDev)} ${getDeviationColor(month.percentDev)}`}>
                                              {month.percentDev !== null ? (<>{month.percentDev > 0 ? '+' : ''}{month.percentDev}%</>) : <span className="text-[#979796]">-</span>}
                                            </span>
                                          </td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[#546A7A] bg-[#546A7A]/10/30 dark:bg-[#546A7A]/10">{formatCurrencyCompact(month.offerBUMonth)}</td>
                                          <td className="px-1 py-1.5 text-center">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(month.offerBUMonthDev)} ${getDeviationColor(month.offerBUMonthDev)}`}>
                                              {month.offerBUMonthDev !== null ? (<>{month.offerBUMonthDev > 0 ? '+' : ''}{month.offerBUMonthDev}%</>) : <span className="text-[#979796]">-</span>}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-gradient-to-r from-cyan-100 to-[#96AEC2]/20 dark:from-cyan-900/30 dark:to-[#546A7A]/30 font-bold">
                                        <td className="px-2 py-2 text-[#546A7A] dark:text-white sticky left-0 bg-[#96AEC2]/20 dark:bg-[#546A7A]/30">Total</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A]">{product.monthlyData.reduce((sum: number, m: any) => sum + (m.noOfOffers || 0), 0)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A]">{formatCurrencyCompact(product.totals.offersValue)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#4F6A64]">{formatCurrencyCompact(product.totals.orderReceived)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#976E44]">{formatCurrencyCompact(product.totals.ordersInHand)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A] bg-[#6F8A9D]/20/50">{formatCurrencyCompact(product.totals.buMonthly)}</td>
                                        <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                                        <td className="px-2 py-2 text-right font-mono text-[#546A7A] bg-[#546A7A]/20/50">{formatCurrencyCompact(product.totals.offerBUMonth)}</td>
                                        <td className="px-1 py-2 text-center"><span className="text-[#979796]">—</span></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Legend Footer - Compact */}
        <Card className="border-0 shadow-md bg-white/70 dark:bg-[#546A7A]/70 backdrop-blur-sm rounded-xl">
          <CardContent className="py-2 px-4">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#82A094]" />
                <span className="text-[#5D6E73] dark:text-[#979796]">100%+</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#CE9F6B]" />
                <span className="text-[#5D6E73] dark:text-[#979796]">75-99%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-[#E17F70]" />
                <span className="text-[#5D6E73] dark:text-[#979796]">&lt;75%</span>
              </div>
              <div className="h-3 w-px bg-[#92A2A5] dark:bg-[#5D6E73]" />
              <div className="flex items-center gap-1.5">
                <span className="px-1 py-0.5 rounded bg-[#82A094]/20 dark:bg-[#4F6A64]/30 text-[#4F6A64] text-[10px] font-bold">+%</span>
                <span className="text-[#5D6E73] dark:text-[#979796]">Above Target</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1 py-0.5 rounded bg-[#EEC1BF]/20 dark:bg-[#9E3B47]/30 text-[#9E3B47] text-[10px] font-bold">-%</span>
                <span className="text-[#5D6E73] dark:text-[#979796]">Below Target</span>
              </div>
            </div>
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </div>
  )
}
