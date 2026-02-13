'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, ComposedChart
} from 'recharts'
// Add Button import
import { Button } from '@/components/ui/button'

import { 
  FileText, MapPin, Users, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  Loader2, Package, Activity, Eye, Percent, BarChart3, Calendar, Target,
  XCircle, Award, CheckCircle, Clock, Zap, ShoppingCart, RefreshCw
} from 'lucide-react'
import { apiService } from '@/services/api'

interface DashboardStats {
  totalOffers: number
  activeOffers: number
  wonOffers: number
  lostOffers: number
  closedOffers: number
  totalValue: number
  wonValue: number
  avgOfferValue: number
  wonThisMonth: number
  wonLastMonth: number
  wonLastYear: number
  winRate: number
  conversionRate: number
  momGrowth: number
  yoyGrowth: number
  valueGrowth: number
  last7DaysOffers: number
  last30DaysOffers: number
  avgDealTime: number
  totalZones: number
  activeUsers: number
  wonValueThisMonth: number
  totalTargetValue: number
  targetAchievement: number
}

interface ProductTypePerformance {
  productType: string
  count: number
  value: number
  wonValue: number
  targetValue: number | null
  targetOfferCount: number | null
  achievement: number | null
}

interface DashboardData {
  stats: DashboardStats
  recentOffers: any[]
  offersByStage: Array<{ stage: string; count: number }>
  offersByZone: Array<{ name: string; offers: number; value: number }>
  offersByProductType: Array<{ productType: string; count: number; value: number }>
  topCustomers: Array<{ customer: string; count: number }>
  monthlyTrend: Array<{ month: string; offers: number; value: number }>
  productTypePerformance: ProductTypePerformance[]
  zoneProductTypeBreakdown: any[]
  zones: Array<{ id: number; name: string }>
  velocityMetrics: Array<{ stage: string; count: number; avgValue: number }>
  currentMonthTargets?: {
    period: string
    zones: Array<{ id: number; zoneId: number; zone: string; targetValue: number; targetOfferCount: number | null }>
    users: Array<{ id: number; userId: number; user: string; targetValue: number; targetOfferCount: number | null }>
    productTypes: Array<{ id: number; zoneId: number; zone: string; productType: string; targetValue: number; targetOfferCount: number | null }>
  }
  myOffersByStage?: Array<{ stage: string; count: number }>
  myOffersByProductType?: Array<{ productType: string; count: number; value: number }>
  myMonthlyTrend?: Array<{ month: string; offers: number; value: number }>
  myRecentOffers?: any[]
  myProductTypePerformance?: Array<{ productType: string; count: number; value: number; wonValue: number }>
  myTarget?: { period: string; targetValue: number; achievement: number; actualValue: number }
  myYearlyTarget?: { period: string; targetValue: number; achievement: number; actualValue: number }
  zoneTarget?: { zoneName: string; period: string; targetValue: number; achievement: number; actualValue: number }
  zoneYearlyTarget?: { zoneName: string; period: string; targetValue: number; achievement: number; actualValue: number }
}

interface UnifiedDashboardClientProps {
  mode: 'admin' | 'zoneManager' | 'zoneUser'
}

export default function UnifiedDashboardClient({ mode }: UnifiedDashboardClientProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [targetsSummary, setTargetsSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'ALL' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH'>('ALL')
  const [ptSortBy, setPtSortBy] = useState<'value' | 'count' | 'wonValue' | 'wonShare'>('value')
  const [ptSortDir, setPtSortDir] = useState<'desc' | 'asc'>('desc')
  const [heatmapView, setHeatmapView] = useState<'zone' | 'user'>('zone')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Refs to prevent duplicate API calls (React Strict Mode protection)
  const hasInitialized = useRef(false)
  const isFetching = useRef(false)


  const getDateParams = () => {
    const now = new Date()
    if (range === 'ALL') return {}
    if (range === 'LAST_7') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { startDate: start.toISOString(), endDate: now.toISOString() }
    }
    if (range === 'LAST_30') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { startDate: start.toISOString(), endDate: now.toISOString() }
    }
    if (range === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: start.toISOString(), endDate: now.toISOString() }
    }
    return {}
  }

  useEffect(() => {
    // Prevent duplicate fetches (React Strict Mode protection)
    if (isFetching.current) {
      return
    }

    const fetchDashboardData = async () => {
      // Mark as fetching to prevent concurrent calls
      isFetching.current = true
      
      try {
        setLoading(true)
        const params = getDateParams()
        let dashData: any
        if (mode === 'admin') {
          dashData = await apiService.getAdminDashboard(params)
        } else if (mode === 'zoneManager') {
          dashData = await apiService.getZoneManagerDashboard(params)
        } else {
          dashData = await apiService.getZoneDashboard(params)
        }
        setDashboardData(dashData)

        // Optional targets summary (admin-only; others may 403)
        try {
          const ts = await apiService.getTargetsSummary()
          if (ts?.data) setTargetsSummary(ts.data)
        } catch {}
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err)
        if (err?.response?.status === 400 && err?.response?.data?.message) {
          setError(err.response.data.message)
        } else {
          setError('Failed to load dashboard data')
        }
      } finally {
        isFetching.current = false
        setLoading(false)
        setIsRefreshing(false)
        hasInitialized.current = true
      }
    }

    fetchDashboardData()
  }, [range, mode])

  const handleRefresh = async () => {
    // Prevent duplicate refreshes
    if (isFetching.current) {
      return
    }
    
    try {
      isFetching.current = true
      setIsRefreshing(true)
      const params = getDateParams()
      let dashData: any
      if (mode === 'admin') {
        dashData = await apiService.getAdminDashboard(params)
      } else if (mode === 'zoneManager') {
        dashData = await apiService.getZoneManagerDashboard(params)
      } else {
        dashData = await apiService.getZoneDashboard(params)
      }
      setDashboardData(dashData)

      // Optional targets summary
      try {
        const ts = await apiService.getTargetsSummary()
        if (ts?.data) setTargetsSummary(ts.data)
      } catch {}
    } catch (err: any) {
      console.error('Failed to refresh dashboard data:', err)
    } finally {
      isFetching.current = false
      setIsRefreshing(false)
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

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'INITIAL': 'text-[#546A7A] bg-[#96AEC2]/10',
      'PROPOSAL_SENT': 'text-[#546A7A] bg-[#546A7A]/10',
      'NEGOTIATION': 'text-[#546A7A] bg-[#6F8A9D]/10',
      'PO_RECEIVED': 'text-[#546A7A] bg-[#96AEC2]/10',
      'WON': 'text-[#4F6A64] bg-[#A2B9AF]/10',
      'LOST': 'text-[#9E3B47] bg-[#E17F70]/10',
    }
    return colors[stage] || 'text-[#5D6E73] bg-[#AEBFC3]/10'
  }

  const formatStage = (stage: string) => {
    return stage.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-4 w-4 text-[#4F6A64]" />
    if (value < 0) return <ArrowDownRight className="h-4 w-4 text-[#9E3B47]" />
    return null
  }

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-[#4F6A64]'
    if (value < 0) return 'text-[#9E3B47]'
    return 'text-[#5D6E73]'
  }

  // Memoize expensive data calculations
  const productTypeData = useMemo(() => {
    const breakdown = dashboardData?.zoneProductTypeBreakdown || []
    const pivotByZone = Object.values((breakdown as any[]).reduce((acc: any, item: any) => {
      const key = item.zoneName
      if (!acc[key]) acc[key] = { zoneName: key }
      acc[key][item.productType || 'UNKNOWN'] = (item.value ? Number(item.value) : 0)
      return acc
    }, {} as Record<string, any>))

    const ALL_PRODUCT_TYPES = [
      'RELOCATION',
      'CONTRACT',
      'SPARE_PARTS',
      'KARDEX_CONNECT',
      'UPGRADE_KIT',
      'SOFTWARE',
      'OTHERS',
      'BD_SPARE',
      'RETROFIT_KIT',
    ]
    
    const offersByPT = dashboardData?.offersByProductType || []
    const perfByPT = dashboardData?.productTypePerformance || []
    const offersByPTMap = new Map((offersByPT as any[]).map((p: any) => [p.productType, p]))
    const perfByPTMap = new Map((perfByPT as any[]).map((p: any) => [p.productType, p]))
    
    const normalizedProductTypes = ALL_PRODUCT_TYPES.map((pt) => {
      const base: any = offersByPTMap.get(pt) || {}
      const perf: any = perfByPTMap.get(pt) || {}
      return {
        productType: pt,
        count: Number(base.count || 0),
        value: Number(base.value || 0),
        wonValue: Number(perf.wonValue || 0),
        targetValue: perf.targetValue != null ? Number(perf.targetValue) : null,
        targetOfferCount: perf.targetOfferCount ?? null,
        achievement: perf.achievement != null ? Number(perf.achievement) : null,
      }
    })

    const productTypesForStack: string[] = ALL_PRODUCT_TYPES
    const productStackColors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#84CC16', '#F97316']
    const productTypeColorMap = new Map<string, string>(productTypesForStack.map((pt, idx) => [pt, productStackColors[idx % productStackColors.length]]))
    const ptEnriched = normalizedProductTypes.map((p) => ({ ...p, wonShare: p.value > 0 ? p.wonValue / p.value : 0 }))
    const ptMaxValue = Math.max(0, ...ptEnriched.map((p) => Number(p.value || 0)))
    const ptMaxWon = Math.max(0, ...ptEnriched.map((p) => Number(p.wonValue || 0)))

    return {
      pivotByZone,
      ALL_PRODUCT_TYPES,
      normalizedProductTypes,
      productTypesForStack,
      productStackColors,
      productTypeColorMap,
      ptEnriched,
      ptMaxValue,
      ptMaxWon
    }
  }, [dashboardData])

  const getSortKey = (p: any) => {
    if (ptSortBy === 'wonShare') return p.wonShare
    return Number(p[ptSortBy] || 0)
  }

  const ptSorted = useMemo(() => {
    return [...productTypeData.ptEnriched].sort((a, b) => {
      const av = getSortKey(a)
      const bv = getSortKey(b)
      return ptSortDir === 'desc' ? (bv - av) : (av - bv)
    })
  }, [productTypeData.ptEnriched, ptSortBy, ptSortDir])

  const toggleSort = (key: 'value' | 'count' | 'wonValue' | 'wonShare') => {
    if (ptSortBy === key) {
      setPtSortDir(ptSortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setPtSortBy(key)
      setPtSortDir('desc')
    }
  }

  const zoneMatrixData = useMemo(() => {
    const pivotMatrixData = (productTypeData.pivotByZone as any[]).map((row: any) => {
      const filled: any = { ...row }
      productTypeData.productTypesForStack.forEach((pt) => {
        if (filled[pt] == null) filled[pt] = 0
      })
      return filled
    })

    const backendZoneNames = (dashboardData?.zones || []).map(z => z.name)
    const DEFAULT_ZONES = ['North', 'South', 'East', 'West']
    const zoneNames = Array.from(new Set([...DEFAULT_ZONES, ...backendZoneNames]))
    const zoneColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#14B8A6']
    const zoneColorMap = new Map<string, string>(zoneNames.map((z, i) => [z, zoneColors[i % zoneColors.length]]))
    const existingZoneNames = new Set(pivotMatrixData.map((r: any) => String(r.zoneName).trim().toLowerCase()))
    
    const zeroRowFor = (name: string) => {
      const row: any = { zoneName: name }
      productTypeData.productTypesForStack.forEach((pt) => { row[pt] = 0 })
      return row
    }

    const ensuredMatrixData = [
      ...pivotMatrixData,
      ...zoneNames.filter(z => !existingZoneNames.has(String(z).trim().toLowerCase())).map(z => zeroRowFor(z))
    ]

    return {
      pivotMatrixData,
      zoneNames,
      zoneColors,
      zoneColorMap,
      ensuredMatrixData
    }
  }, [productTypeData, dashboardData])

  const getLast12Months = () => {
    const arr: { key: string; label: string }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('en-US', { month: 'short' })
      arr.push({ key, label })
    }
    return arr
  }

  const toShortMonthLabel = (raw: string): string | null => {
    if (!raw) return null
    const s = String(raw).trim()
    let d = new Date(s)
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('en-US', { month: 'short' })
    }
    const m = s.match(/^(\d{4})[-/](\d{1,2})$/)
    if (m) {
      d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1)
      return d.toLocaleString('en-US', { month: 'short' })
    }
    return s.slice(0, 3).charAt(0).toUpperCase() + s.slice(1, 3).toLowerCase()
  }

  const RenderMonthTick = (props: any) => {
    const { x, y, payload } = props
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" fill="#64748b" fontSize={12} transform="rotate(-35)">{payload.value}</text>
      </g>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Premium Background */}
        <div className="fixed inset-0 bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10/30 to-[#6F8A9D]/10/20"></div>
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.08),_transparent_50%)]"></div>
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.08),_transparent_50%)]"></div>
        
        {/* Floating orbs */}
        <div className="fixed top-20 left-10 w-72 h-72 bg-gradient-to-br from-[#96AEC2]/15 to-indigo-400/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="fixed bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-purple-400/15 to-[#EEC1BF]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="fixed top-1/2 left-1/3 w-64 h-64 bg-gradient-to-br from-indigo-400/10 to-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        
        <div className="text-center relative z-10">
          <div className="relative mb-8">
            {/* Premium animated spinner */}
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-indigo-500 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-purple-400 border-l-blue-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-indigo-300 border-r-purple-300 animate-spin" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl flex items-center justify-center shadow-lg shadow-[#96AEC2]/30">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 via-blue-800 to-purple-800 bg-clip-text text-transparent">
              Loading Offer Analytics
            </h2>
            <p className="text-[#5D6E73] animate-pulse font-medium">Preparing your dashboard...</p>
            <div className="flex items-center justify-center space-x-2 mt-6">
              <div className="w-2.5 h-2.5 bg-[#96AEC2]/100 rounded-full animate-bounce shadow-lg shadow-blue-500/50"></div>
              <div className="w-2.5 h-2.5 bg-[#546A7A]/100 rounded-full animate-bounce shadow-lg shadow-indigo-500/50" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2.5 h-2.5 bg-[#6F8A9D]/100 rounded-full animate-bounce shadow-lg shadow-purple-500/50" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-[#9E3B47] mx-auto mb-4" />
          <p className="text-[#5D6E73] font-medium">{error || 'No data available'}</p>
        </div>
      </div>
    )
  }

  const { stats } = dashboardData
  const isZoneUser = mode === 'zoneUser'
  const statsAny: any = (dashboardData as any)?.stats || {}
  const myWinRate = (statsAny.myOffers || 0) > 0 ? (Number(statsAny.myWonOffers || 0) / Number(statsAny.myOffers || 0)) * 100 : 0
  const myTotalValue = (statsAny.myOffers || 0) > 0 ? (Number(statsAny.myWonValue || 0) + Number(statsAny.myActiveValue || 0)) : 0
  const myAvgOfferValue = (statsAny.myOffers || 0) > 0 ? (Number(statsAny.myWonValue || 0) / Number(statsAny.myWonOffers || 1)) : 0
  const recentOffersData = isZoneUser ? (((dashboardData as any)?.myRecentOffers) || []) : (dashboardData?.recentOffers || [])
  const conversionRateDisplay = isZoneUser
    ? (typeof (stats as any)?.conversionRate === 'number' && (stats as any).conversionRate > 0
        ? (stats as any).conversionRate
        : myWinRate)
    : stats.conversionRate

  return (
    <div className="min-h-screen pb-safe overflow-x-hidden w-full max-w-full relative">
      {/* Premium Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10/40 to-[#6F8A9D]/10/30 -z-10"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.06),_transparent_50%)] -z-10"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.06),_transparent_50%)] -z-10"></div>
      
      {/* Floating decorative orbs */}
      <div className="fixed top-20 left-10 w-64 h-64 bg-gradient-to-br from-[#96AEC2]/10 to-indigo-400/10 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-32 right-10 w-80 h-80 bg-gradient-to-br from-purple-400/10 to-[#EEC1BF]/10 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }}></div>
      <div className="fixed top-1/2 left-1/3 w-72 h-72 bg-gradient-to-br from-indigo-400/5 to-blue-400/5 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '0.5s' }}></div>

      {/* Premium Header Banner */}
      <header className="relative bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] text-white overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCA0IDYuMjY4IDE0IDE0LTYuMjY4IDE0LTE0IDE0eiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-50"></div>
        </div>
        
        <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Header Left Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-xl group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white tracking-tight">
                      Offer Analytics Dashboard
                    </h1>
                    <p className="text-white/70 text-sm lg:text-base mt-1">
                      Real-time Operations & Field Service Intelligence
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date().toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Clock className="w-4 h-4" />
                    <span>Updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    {isRefreshing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  </div>
                </div>
              </div>

              {/* Header Right Section - Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => window.location.href = mode === 'admin' ? '/admin/offers' : mode === 'zoneUser' ? '/zone/offers' : '/zone-manager/offers'}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  New Offer
                </Button>
                <Button
                  onClick={handleRefresh}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Overall Performance */}
        <Card className="group overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 bg-gradient-to-br from-[#6F8A9D]/10 via-white to-[#6F8A9D]/10 hover:from-[#6F8A9D]/10 hover:to-[#6F8A9D]/20 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-[#546A7A]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="bg-transparent border-b border-violet-100">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Award className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#546A7A]">Overall Performance</h3>
                  <p className="text-[#5D6E73] text-sm flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-[#757777]" />
                    All-time totals across offers and value
                  </p>
                </div>
              </div>
              <div className="text-center lg:text-right">
                <div className="text-5xl lg:text-6xl font-extrabold mb-1 bg-gradient-to-r from-[#546A7A] to-[#546A7A] bg-clip-text text-transparent">{formatCurrency(isZoneUser ? Number(statsAny.myWonValueThisMonth || 0) : stats.wonValue)}</div>
                <div className="flex items-center justify-center lg:justify-end gap-2 text-[#5D6E73]">
                  <DollarSign className="h-4 w-4 text-[#6F8A9D]" />
                  <p className="text-sm font-medium">Total Won Value</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 relative">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="group/card rounded-xl p-5 bg-gradient-to-br from-[#A2B9AF]/10 to-[#A2B9AF]/10/50 border border-[#A2B9AF]/30 hover:border-[#82A094] hover:shadow-lg transition-all duration-300 hover:bg-[#82A094]/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-[#82A094]/20 rounded-lg group-hover/card:scale-110 transition-transform duration-300">
                    <CheckCircle className="h-5 w-5 text-[#4F6A64]" />
                  </div>
                  <p className="text-[#4F6A64] text-sm font-semibold uppercase tracking-wide">Total Won Value</p>
                </div>
                <p className="text-3xl font-bold text-[#546A7A] mb-1">{formatCurrency(isZoneUser ? Number(statsAny.myWonValueThisMonth || 0) : stats.wonValue)}</p>
                <p className="text-xs text-[#4F6A64] font-medium">{isZoneUser ? (statsAny.myWonOffers || 0) : stats.wonOffers} offers won</p>
                <div className="h-1 w-full bg-[#82A094]/20 rounded-full overflow-hidden mt-3">
                  <div 
                    className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-full"
                    style={{ width: `${Math.min(100, (Number(isZoneUser ? (statsAny.myWonOffers || 0) : stats.wonOffers) / Number(isZoneUser ? (statsAny.myOffers || 1) : (stats.totalOffers || 1))) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="group/card rounded-xl p-5 bg-gradient-to-br from-[#EEC1BF]/10 to-[#EEC1BF]/10/50 border border-[#EEC1BF]/30 hover:border-[#CE9F6B] hover:shadow-lg transition-all duration-300 hover:bg-[#CE9F6B]/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-[#CE9F6B]/20 rounded-lg group-hover/card:scale-110 transition-transform duration-300">
                    <Target className="h-5 w-5 text-[#976E44]" />
                  </div>
                  <p className="text-[#976E44] text-sm font-semibold uppercase tracking-wide">Total Offers</p>
                </div>
                <p className="text-3xl font-bold text-[#546A7A] mb-1">{isZoneUser ? (statsAny.myOffers || 0) : stats.totalOffers}</p>
                <p className="text-xs text-[#976E44] font-medium">in system</p>
                <div className="h-1 w-full bg-[#CE9F6B]/20 rounded-full overflow-hidden mt-3">
                  <div 
                    className="h-full bg-gradient-to-r from-[#CE9F6B] to-[#976E44] rounded-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div className="group/card rounded-xl p-5 bg-gradient-to-br from-[#82A094]/10 to-[#82A094]/10/50 border border-[#82A094]/30 hover:border-teal-300 hover:shadow-lg transition-all duration-300 hover:bg-[#82A094]/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-[#82A094]/20 rounded-lg group-hover/card:scale-110 transition-transform duration-300">
                    <DollarSign className="h-5 w-5 text-[#4F6A64]" />
                  </div>
                  <p className="text-[#4F6A64] text-sm font-semibold uppercase tracking-wide">Pipeline Value</p>
                </div>
                <p className="text-3xl font-bold text-[#546A7A] mb-1">{formatCurrency(isZoneUser ? myTotalValue : stats.totalValue)}</p>
                <p className="text-xs text-[#4F6A64] font-medium">{isZoneUser ? 'Your pipeline' : 'Active pipeline'}</p>
                <div className="h-1 w-full bg-[#82A094]/20 rounded-full overflow-hidden mt-3">
                  <div 
                    className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div className="group/card rounded-xl p-5 bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/10/50 border border-cyan-100 hover:border-cyan-300 hover:shadow-lg transition-all duration-300 hover:bg-[#96AEC2]/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-[#96AEC2]/20 rounded-lg group-hover/card:scale-110 transition-transform duration-300">
                    <Percent className="h-5 w-5 text-[#546A7A]" />
                  </div>
                  <p className="text-[#546A7A] text-sm font-semibold uppercase tracking-wide">Win Rate</p>
                </div>
                <p className="text-3xl font-bold text-[#546A7A] mb-1">{isZoneUser ? ((statsAny.myOffers || 0) === 0 ? 'N/A' : `${myWinRate.toFixed(1)}%`) : (stats.closedOffers === 0 ? 'N/A' : `${stats.winRate.toFixed(1)}%`)}</p>
                <p className="text-xs text-[#546A7A] font-medium">{isZoneUser ? `${statsAny.myWonOffers || 0}W` : `${stats.wonOffers}W / ${stats.lostOffers}L`}</p>
                <div className="h-1 w-full bg-[#96AEC2]/20 rounded-full overflow-hidden mt-3">
                  <div 
                    className="h-full bg-gradient-to-r from-[#6F8A9D] to-cyan-600 rounded-full"
                    style={{ width: `${isZoneUser ? Math.min(100, myWinRate) : stats.winRate}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-[#6F8A9D]/10 via-white to-[#6F8A9D]/10 hover:from-[#6F8A9D]/10 hover:to-[#6F8A9D]/20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-[#546A7A]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="p-5 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#546A7A] uppercase tracking-wider mb-1">Conversion Rate</p>
                      <p className="text-3xl font-bold text-[#546A7A]">{conversionRateDisplay.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-[#6F8A9D]/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <Zap className="h-6 w-6 text-[#546A7A]" />
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-[#6F8A9D]/20 rounded-full overflow-hidden mt-3">
                    <div 
                      className="h-full bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] rounded-full"
                      style={{ width: `${Math.min(100, conversionRateDisplay)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-[#6F8A9D]/10 via-white to-[#6F8A9D]/10 hover:from-[#6F8A9D]/10 hover:to-[#6F8A9D]/20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-[#546A7A]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="p-5 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#546A7A] uppercase tracking-wide mb-1">Avg Deal Size</p>
                      <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency(isZoneUser ? myAvgOfferValue : stats.avgOfferValue)}</p>
                    </div>
                    <div className="p-3 bg-[#546A7A]/20 rounded-xl">
                      <ShoppingCart className="h-6 w-6 text-[#546A7A]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-[#96AEC2]/10 via-white to-[#96AEC2]/10 hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="p-5 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#546A7A] uppercase tracking-wide mb-1">Total Offers</p>
                      <p className="text-3xl font-bold text-[#546A7A]">{isZoneUser ? (statsAny.myOffers || 0) : stats.totalOffers}</p>
                    </div>
                    <div className="p-3 bg-[#96AEC2]/20 rounded-xl">
                      <FileText className="h-6 w-6 text-[#546A7A]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!isZoneUser && (
                <Card className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-[#A2B9AF]/10 via-white to-[#A2B9AF]/10 hover:from-[#A2B9AF]/10 hover:to-[#A2B9AF]/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#82A094]/5 to-[#4F6A64]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="p-5 relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-[#4F6A64] uppercase tracking-wide mb-1">Active Zones</p>
                        <p className="text-3xl font-bold text-[#546A7A]">{stats.totalZones}</p>
                      </div>
                      <div className="p-3 bg-[#A2B9AF]/20 rounded-xl">
                        <MapPin className="h-6 w-6 text-[#4F6A64]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!isZoneUser && (
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-[#EEC1BF]/10 to-white">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-[#976E44] uppercase tracking-wide mb-1">Active Users</p>
                        <p className="text-3xl font-bold text-[#546A7A]">{stats.activeUsers}</p>
                      </div>
                      <div className="p-3 bg-[#CE9F6B]/20 rounded-xl">
                        <Users className="h-6 w-6 text-[#976E44]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Zone Targets (Zone User only) - Monthly & Yearly */}
        {isZoneUser && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Zone Monthly Target Card */}
              {(dashboardData as any)?.zoneTarget && (
                <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-[#96AEC2]/10 via-white to-[#96AEC2]/10 hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="bg-transparent border-b border-[#96AEC2]/30">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-[#6F8A9D] to-cyan-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#546A7A]">{(dashboardData as any)?.zoneTarget?.zoneName} Zone - Monthly</h3>
                        <p className="text-xs text-[#5D6E73]">{(dashboardData as any)?.zoneTarget?.period}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 relative">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#96AEC2]/10 rounded-lg p-4">
                          <p className="text-xs text-[#546A7A] font-semibold uppercase tracking-wide mb-1">Target</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).zoneTarget?.targetValue || 0)}</p>
                        </div>
                        <div className="bg-[#82A094]/10 rounded-lg p-4">
                          <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Actual</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).zoneTarget?.actualValue || 0)}</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-[#5D6E73]">Achievement</p>
                          <span className={`text-lg font-bold ${((dashboardData as any).zoneTarget?.achievement || 0) >= 100 ? 'text-[#4F6A64]' : ((dashboardData as any).zoneTarget?.achievement || 0) >= 80 ? 'text-[#4F6A64]' : ((dashboardData as any).zoneTarget?.achievement || 0) >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'}`}>{(Number((dashboardData as any).zoneTarget?.achievement || 0)).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full bg-[#96AEC2]/20 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#6F8A9D] to-cyan-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Number((dashboardData as any).zoneTarget?.achievement || 0))}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {(dashboardData as any)?.zoneYearlyTarget && (
                <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-[#A2B9AF]/10 via-white to-[#A2B9AF]/10 hover:from-[#A2B9AF]/10 hover:to-[#A2B9AF]/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#82A094]/5 to-[#4F6A64]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="bg-transparent border-b border-[#A2B9AF]/30">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#546A7A]">{(dashboardData as any)?.zoneYearlyTarget?.zoneName} Zone - Annual</h3>
                        <p className="text-xs text-[#5D6E73]">{(dashboardData as any)?.zoneYearlyTarget?.period}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 relative">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#82A094]/10 rounded-lg p-4">
                          <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Target</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).zoneYearlyTarget?.targetValue || 0)}</p>
                        </div>
                        <div className="bg-[#A2B9AF]/10 rounded-lg p-4">
                          <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Actual</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).zoneYearlyTarget?.actualValue || 0)}</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-[#5D6E73]">Achievement</p>
                          <span className={`text-lg font-bold ${((dashboardData as any).zoneYearlyTarget?.achievement || 0) >= 100 ? 'text-[#4F6A64]' : ((dashboardData as any).zoneYearlyTarget?.achievement || 0) >= 80 ? 'text-[#4F6A64]' : ((dashboardData as any).zoneYearlyTarget?.achievement || 0) >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'}`}>{(Number((dashboardData as any).zoneYearlyTarget?.achievement || 0)).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full bg-[#82A094]/20 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Number((dashboardData as any).zoneYearlyTarget?.achievement || 0))}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {!(dashboardData as any)?.zoneTarget && !(dashboardData as any)?.zoneYearlyTarget && (
                <Card className="col-span-full border-0 shadow-xl bg-gradient-to-br from-[#AEBFC3]/10 to-[#AEBFC3]/20">
                  <CardContent className="p-8 text-center">
                    <Target className="h-12 w-12 text-[#979796] mx-auto mb-3" />
                    <p className="text-[#5D6E73] font-medium">No zone targets set for this period</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* My Targets (Zone User only) - Monthly & Yearly */}
        {isZoneUser && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Monthly Target Card */}
              {(dashboardData as any)?.myTarget && (
                <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-[#96AEC2]/10 via-white to-[#96AEC2]/10 hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="bg-transparent border-b border-[#96AEC2]/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-[#6F8A9D] to-cyan-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[#546A7A]">My Monthly Target</h3>
                          <p className="text-xs text-[#5D6E73]">{(dashboardData as any)?.myTarget?.period}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 relative">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#96AEC2]/10 rounded-lg p-4">
                          <p className="text-xs text-[#546A7A] font-semibold uppercase tracking-wide mb-1">Target</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).myTarget?.targetValue || 0)}</p>
                        </div>
                        <div className="bg-[#82A094]/10 rounded-lg p-4">
                          <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Actual</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).myTarget?.actualValue || 0)}</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-[#5D6E73]">Achievement</p>
                          <span className={`text-lg font-bold ${
                            ((dashboardData as any).myTarget?.achievement || 0) >= 100 ? 'text-[#4F6A64]' :
                            ((dashboardData as any).myTarget?.achievement || 0) >= 80 ? 'text-[#4F6A64]' :
                            ((dashboardData as any).myTarget?.achievement || 0) >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'
                          }`}>
                            {(Number((dashboardData as any).myTarget?.achievement || 0)).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[#96AEC2]/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#6F8A9D] to-cyan-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Number((dashboardData as any).myTarget?.achievement || 0))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Yearly Target Card */}
              {(dashboardData as any)?.myYearlyTarget && (
                <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-[#A2B9AF]/10 via-white to-[#A2B9AF]/10 hover:from-[#A2B9AF]/10 hover:to-[#A2B9AF]/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#82A094]/5 to-[#4F6A64]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="bg-transparent border-b border-[#A2B9AF]/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[#546A7A]">My Annual Target</h3>
                          <p className="text-xs text-[#5D6E73]">{(dashboardData as any)?.myYearlyTarget?.period}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 relative">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#82A094]/10 rounded-lg p-4">
                          <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Target</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).myYearlyTarget?.targetValue || 0)}</p>
                        </div>
                        <div className="bg-[#A2B9AF]/10 rounded-lg p-4">
                          <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Actual</p>
                          <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency((dashboardData as any).myYearlyTarget?.actualValue || 0)}</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-[#5D6E73]">Achievement</p>
                          <span className={`text-lg font-bold ${
                            ((dashboardData as any).myYearlyTarget?.achievement || 0) >= 100 ? 'text-[#4F6A64]' :
                            ((dashboardData as any).myYearlyTarget?.achievement || 0) >= 80 ? 'text-[#4F6A64]' :
                            ((dashboardData as any).myYearlyTarget?.achievement || 0) >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'
                          }`}>
                            {(Number((dashboardData as any).myYearlyTarget?.achievement || 0)).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[#82A094]/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Number((dashboardData as any).myYearlyTarget?.achievement || 0))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {!(dashboardData as any)?.myTarget && !(dashboardData as any)?.myYearlyTarget && (
                <Card className="col-span-full border-0 shadow-xl bg-gradient-to-br from-[#AEBFC3]/10 to-[#AEBFC3]/20">
                  <CardContent className="p-8 text-center">
                    <Target className="h-12 w-12 text-[#979796] mx-auto mb-3" />
                    <p className="text-[#5D6E73] font-medium">No personal targets set for this period</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Target Summary (Admin/Zone Manager only) */}
        {mode !== 'zoneUser' && targetsSummary && (
          <div className="space-y-6">
            {/* Monthly & Yearly Target Cards */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Monthly Target Card */}
              <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-[#96AEC2]/10 via-white to-[#96AEC2]/10 hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="bg-transparent border-b border-[#96AEC2]/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-[#6F8A9D] to-cyan-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#546A7A]">Monthly Target</h3>
                        <p className="text-xs text-[#5D6E73]">{targetsSummary.currentMonth?.period}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 relative">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#96AEC2]/10 rounded-lg p-4">
                        <p className="text-xs text-[#546A7A] font-semibold uppercase tracking-wide mb-1">Target</p>
                        <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency(targetsSummary.currentMonth?.totalTargetValue || 0)}</p>
                      </div>
                      <div className="bg-[#82A094]/10 rounded-lg p-4">
                        <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Actual</p>
                        <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency(targetsSummary.currentMonth?.totalActualValue || 0)}</p>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-[#5D6E73]">Achievement</p>
                        <span className={`text-lg font-bold ${
                          (targetsSummary.currentMonth?.achievement || 0) >= 100 ? 'text-[#4F6A64]' :
                          (targetsSummary.currentMonth?.achievement || 0) >= 80 ? 'text-[#4F6A64]' :
                          (targetsSummary.currentMonth?.achievement || 0) >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'
                        }`}>
                          {(targetsSummary.currentMonth?.achievement || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#96AEC2]/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#6F8A9D] to-cyan-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, targetsSummary.currentMonth?.achievement || 0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#5D6E73] mt-2">{targetsSummary.currentMonth?.totalOfferCount || 0} offers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Yearly Target Card */}
              <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-[#A2B9AF]/10 via-white to-[#A2B9AF]/10 hover:from-[#A2B9AF]/10 hover:to-[#A2B9AF]/20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#82A094]/5 to-[#4F6A64]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="bg-transparent border-b border-[#A2B9AF]/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#546A7A]">Annual Target</h3>
                        <p className="text-xs text-[#5D6E73]">{targetsSummary.currentYear?.period}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 relative">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#82A094]/10 rounded-lg p-4">
                        <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Target</p>
                        <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency(targetsSummary.currentYear?.totalTargetValue || 0)}</p>
                      </div>
                      <div className="bg-[#A2B9AF]/10 rounded-lg p-4">
                        <p className="text-xs text-[#4F6A64] font-semibold uppercase tracking-wide mb-1">Actual</p>
                        <p className="text-2xl font-bold text-[#546A7A]">{formatCurrency(targetsSummary.currentYear?.totalActualValue || 0)}</p>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-[#5D6E73]">Achievement</p>
                        <span className={`text-lg font-bold ${
                          (targetsSummary.currentYear?.achievement || 0) >= 100 ? 'text-[#4F6A64]' :
                          (targetsSummary.currentYear?.achievement || 0) >= 80 ? 'text-[#4F6A64]' :
                          (targetsSummary.currentYear?.achievement || 0) >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'
                        }`}>
                          {(targetsSummary.currentYear?.achievement || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#82A094]/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, targetsSummary.currentYear?.achievement || 0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#5D6E73] mt-2">{targetsSummary.currentYear?.totalOfferCount || 0} offers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Heatmap */}
            {targetsSummary.byZone && targetsSummary.byZone.length > 0 && (
              <Card className="border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-[#AEBFC3]/10 to-white border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-[#546A7A] to-[#546A7A] rounded-lg">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Performance Heatmap</CardTitle>
                        <CardDescription className="text-base mt-1">
                          {heatmapView === 'zone' 
                            ? 'Monthly & Yearly target achievement across all zones' 
                            : 'Zone-wise user performance metrics'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const allowUserView = true
                        return (
                          <div className="flex gap-2 bg-[#AEBFC3]/20 p-1 rounded-lg">
                            <button
                              onClick={() => setHeatmapView('zone')}
                              className={`px-4 py-2 rounded-md font-medium transition-all ${
                                heatmapView === 'zone'
                                  ? 'bg-white text-[#546A7A] shadow-md'
                                  : 'text-[#5D6E73] hover:text-[#546A7A]'
                              }`}
                            >
                              📍 Zone-wise
                            </button>
                            {allowUserView && (
                              <button
                                onClick={() => setHeatmapView('user')}
                                className={`px-4 py-2 rounded-md font-medium transition-all ${
                                  heatmapView === 'user'
                                    ? 'bg-white text-[#546A7A] shadow-md'
                                    : 'text-[#5D6E73] hover:text-[#546A7A]'
                                }`}
                              >
                                👥 User-wise
                              </button>
                            )}
                          </div>
                        )
                      })()}
                      {(() => {
                        const zoneIdSet = new Set((dashboardData?.zones || []).map(z => z.id))
                        const zoneNameSet = new Set((dashboardData?.zones || []).map(z => String(z.name).trim().toLowerCase()))
                        const byZoneSource = targetsSummary.byZone || []
                        const displayByZone = mode === 'admin' ? byZoneSource : byZoneSource.filter((z: any) => zoneIdSet.has(z.zoneId) || zoneNameSet.has(String(z.zoneName).trim().toLowerCase()))
                        const usersByZoneSource = targetsSummary.usersByZone || []
                        const displayUsersByZone = (mode === 'admin' || mode === 'zoneManager')
                          ? usersByZoneSource.filter((zb: any) => zoneIdSet.has(zb.zoneId) || zoneNameSet.has(String(zb.zoneName).trim().toLowerCase()))
                          : []
                        const count = heatmapView === 'zone' ? displayByZone.length : displayUsersByZone.reduce((sum: number, zb: any) => sum + (zb.users?.length || 0), 0)
                        const label = heatmapView === 'zone' ? 'zones' : 'users'
                        return (
                          <span className="text-sm font-semibold text-[#5D6E73] bg-[#AEBFC3]/20 px-3 py-1.5 rounded-full">
                            {count} {label}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Column Headers */}
                    <div className="grid grid-cols-12 gap-3 mb-4 px-4">
                      <div className="col-span-2">
                        <p className="text-xs font-bold text-[#5D6E73] uppercase tracking-wide">{heatmapView === 'zone' ? 'Zone' : 'User'}</p>
                      </div>
                      <div className="col-span-5">
                        <p className="text-xs font-bold text-[#5D6E73] uppercase tracking-wide">📅 Monthly Progress</p>
                      </div>
                      <div className="col-span-5">
                        <p className="text-xs font-bold text-[#5D6E73] uppercase tracking-wide">📈 Yearly Progress</p>
                      </div>
                    </div>

                    {(() => {
                      const zoneIdSet = new Set((dashboardData?.zones || []).map(z => z.id))
                      const zoneNameSet = new Set((dashboardData?.zones || []).map(z => String(z.name).trim().toLowerCase()))
                      const byZoneSource = targetsSummary.byZone || []
                      const displayByZone = mode === 'admin' ? byZoneSource : byZoneSource.filter((z: any) => zoneIdSet.has(z.zoneId) || zoneNameSet.has(String(z.zoneName).trim().toLowerCase()))
                      if (!(heatmapView === 'zone')) return null
                      return displayByZone.map((zone: any) => {
                        const monthlyAch = Math.min(100, (zone.monthlyActual / (zone.monthlyTarget || 1)) * 100)
                        const yearlyAch = Math.min(100, (zone.yearlyActual / (zone.yearlyTarget || 1)) * 100)

                        const getAchievementColor = (achievement: number) => {
                          if (achievement >= 100) return 'from-green-400 to-[#82A094]'
                          if (achievement >= 80) return 'from-[#82A094] to-[#82A094]'
                          if (achievement >= 60) return 'from-[#CE9F6B] to-[#CE9F6B]'
                          return 'from-red-400 to-[#E17F70]'
                        }

                        const getAchievementBg = (achievement: number) => {
                          if (achievement >= 100) return 'bg-[#A2B9AF]/10 border-[#A2B9AF]/30'
                          if (achievement >= 80) return 'bg-[#82A094]/10 border-[#A2B9AF]/30'
                          if (achievement >= 60) return 'bg-[#CE9F6B]/10 border-[#EEC1BF]/30'
                          return 'bg-[#E17F70]/10 border-red-100'
                        }

                        const getStatusEmoji = (achievement: number) => {
                          if (achievement >= 100) return '✨'
                          if (achievement >= 80) return '🎯'
                          if (achievement >= 60) return '⚠️'
                          return '❌'
                        }

                        return (
                          <div key={zone.zoneId} className={`group grid grid-cols-12 gap-3 p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${getAchievementBg(monthlyAch)}`}>
                            {/* Zone Name */}
                            <div className="col-span-2 flex items-center">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getAchievementColor(monthlyAch)}`} />
                                <span className="font-bold text-[#546A7A]">{zone.zoneName}</span>
                              </div>
                            </div>

                            {/* Monthly Progress */}
                            <div className="col-span-5 flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-[#5D6E73]">{formatCurrency(zone.monthlyTarget)} → {formatCurrency(zone.monthlyActual)}</span>
                                    <div className="flex items-center gap-1">
                                      <span className={`text-lg font-bold ${monthlyAch >= 100 ? 'text-[#4F6A64]' : monthlyAch >= 80 ? 'text-[#4F6A64]' : monthlyAch >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'}`}>
                                        {monthlyAch.toFixed(1)}%
                                      </span>
                                      <div className={`w-2 h-2 rounded-full ${monthlyAch >= 100 ? 'bg-[#A2B9AF]/100' : monthlyAch >= 80 ? 'bg-[#82A094]/100' : monthlyAch >= 60 ? 'bg-[#CE9F6B]/100' : 'bg-[#E17F70]/100'}`} />
                                    </div>
                                  </div>
                                  <span className="text-xl">{getStatusEmoji(monthlyAch)}</span>
                                </div>
                                <div className="relative h-2.5 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full bg-gradient-to-r ${getAchievementColor(monthlyAch)} transition-all duration-500`}
                                    style={{ width: `${monthlyAch}%` }}
                                  />
                                  <div 
                                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 rounded-full shadow-md transition-all duration-500"
                                    style={{ 
                                      left: `${monthlyAch}%`,
                                      borderColor: monthlyAch >= 100 ? '#16a34a' : monthlyAch >= 80 ? '#10b981' : monthlyAch >= 60 ? '#f59e0b' : '#ef4444',
                                      transform: 'translate(-50%, -50%)',
                                      opacity: 0.25
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-[#5D6E73] mt-1">{zone.monthlyOfferCount} offers • {zone.monthlyAchievement?.toFixed?.(1)}% achievement</p>
                              </div>
                            </div>

                            {/* Yearly Progress */}
                            <div className="col-span-5 flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-[#5D6E73]">{formatCurrency(zone.yearlyTarget)} → {formatCurrency(zone.yearlyActual)}</span>
                                    <div className="flex items-center gap-1">
                                      <span className={`text-lg font-bold ${yearlyAch >= 100 ? 'text-[#4F6A64]' : yearlyAch >= 80 ? 'text-[#4F6A64]' : yearlyAch >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'}`}>
                                        {yearlyAch.toFixed(1)}%
                                      </span>
                                      <div className={`w-2 h-2 rounded-full ${yearlyAch >= 100 ? 'bg-[#A2B9AF]/100' : yearlyAch >= 80 ? 'bg-[#82A094]/100' : yearlyAch >= 60 ? 'bg-[#CE9F6B]/100' : 'bg-[#E17F70]/100'}`} />
                                    </div>
                                  </div>
                                  <span className="text-xl">{getStatusEmoji(yearlyAch)}</span>
                                </div>
                                <div className="relative h-2.5 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full bg-gradient-to-r ${getAchievementColor(yearlyAch)} transition-all duration-500`}
                                    style={{ width: `${yearlyAch}%` }}
                                  />
                                  <div 
                                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 rounded-full shadow-md transition-all duration-500"
                                    style={{ 
                                      left: `${yearlyAch}%`,
                                      borderColor: yearlyAch >= 100 ? '#16a34a' : yearlyAch >= 80 ? '#10b981' : yearlyAch >= 60 ? '#f59e0b' : '#ef4444',
                                      transform: 'translate(-50%, -50%)',
                                      opacity: 0.25
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-[#5D6E73] mt-1">{zone.yearlyOfferCount} offers • {zone.yearlyAchievement?.toFixed?.(1)}% achievement</p>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}

                    {(() => {
                      const zoneIdSet = new Set((dashboardData?.zones || []).map(z => z.id))
                      const zoneNameSet = new Set((dashboardData?.zones || []).map(z => String(z.name).trim().toLowerCase()))
                      const usersByZoneSource = targetsSummary?.usersByZone || []
                      const displayUsersByZone = (mode === 'admin' || mode === 'zoneManager')
                        ? usersByZoneSource.filter((zb: any) => zoneIdSet.has(zb.zoneId) || zoneNameSet.has(String(zb.zoneName).trim().toLowerCase()))
                        : []
                      if (!(heatmapView === 'user') || displayUsersByZone.length === 0) return null
                      return displayUsersByZone.map((zoneData: any) => {
                        return zoneData.users?.map((user: any) => {
                          const monthlyAch = user.monthlyTarget > 0 ? user.monthlyAchievement : 0
                          const yearlyAch = user.yearlyTarget > 0 ? user.yearlyAchievement : 0

                          const getAchievementColor = (achievement: number) => {
                            if (achievement >= 100) return 'from-green-400 to-[#82A094]'
                            if (achievement >= 80) return 'from-[#82A094] to-[#82A094]'
                            if (achievement >= 60) return 'from-[#CE9F6B] to-[#CE9F6B]'
                            return 'from-red-400 to-[#E17F70]'
                          }

                          const getAchievementBg = (achievement: number) => {
                            if (achievement >= 100) return 'bg-[#A2B9AF]/10 border-[#A2B9AF]/30'
                            if (achievement >= 80) return 'bg-[#82A094]/10 border-[#A2B9AF]/30'
                            if (achievement >= 60) return 'bg-[#CE9F6B]/10 border-[#EEC1BF]/30'
                            return 'bg-[#E17F70]/10 border-red-100'
                          }

                          const getStatusEmoji = (achievement: number) => {
                            if (achievement >= 100) return '✨'
                            if (achievement >= 80) return '🎯'
                            if (achievement >= 60) return '⚠️'
                            return '❌'
                          }

                          return (
                            <div key={`${zoneData.zoneId}-${user.userId}`} className={`group grid grid-cols-12 gap-3 p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${getAchievementBg(monthlyAch)}`}>
                              {/* User Name */}
                              <div className="col-span-2 flex items-center">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getAchievementColor(monthlyAch)}`} />
                                  <div>
                                    <p className="font-bold text-[#546A7A] text-sm">{user.userName}</p>
                                    <p className="text-xs text-[#5D6E73]">{zoneData.zoneName}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Monthly Progress */}
                              <div className="col-span-5 flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-[#5D6E73]">{formatCurrency(user.monthlyTarget)} → {formatCurrency(user.monthlyActual)}</span>
                                      <div className="flex items-center gap-1">
                                        <span className={`text-lg font-bold ${monthlyAch >= 100 ? 'text-[#4F6A64]' : monthlyAch >= 80 ? 'text-[#4F6A64]' : monthlyAch >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'}`}>
                                          {monthlyAch.toFixed(1)}%
                                        </span>
                                        <div className={`w-2 h-2 rounded-full ${monthlyAch >= 100 ? 'bg-[#A2B9AF]/100' : monthlyAch >= 80 ? 'bg-[#82A094]/100' : monthlyAch >= 60 ? 'bg-[#CE9F6B]/100' : 'bg-[#E17F70]/100'}`} />
                                      </div>
                                    </div>
                                    <span className="text-xl">{getStatusEmoji(monthlyAch)}</span>
                                  </div>
                                  <div className="relative h-2.5 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full bg-gradient-to-r ${getAchievementColor(monthlyAch)} transition-all duration-500`}
                                      style={{ width: `${Math.min(100, monthlyAch)}%` }}
                                    />
                                    <div 
                                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 rounded-full shadow-md transition-all duration-500"
                                      style={{ 
                                        left: `${Math.min(100, monthlyAch)}%`,
                                        borderColor: monthlyAch >= 100 ? '#16a34a' : monthlyAch >= 80 ? '#10b981' : monthlyAch >= 60 ? '#f59e0b' : '#ef4444',
                                        transform: 'translate(-50%, -50%)',
                                        opacity: 0.25
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-[#5D6E73] mt-1">{user.monthlyOfferCount} offers</p>
                                </div>
                              </div>

                              {/* Yearly Progress */}
                              <div className="col-span-5 flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-[#5D6E73]">{formatCurrency(user.yearlyTarget)} → {formatCurrency(user.yearlyActual)}</span>
                                      <div className="flex items-center gap-1">
                                        <span className={`text-lg font-bold ${yearlyAch >= 100 ? 'text-[#4F6A64]' : yearlyAch >= 80 ? 'text-[#4F6A64]' : yearlyAch >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]'}`}>
                                          {yearlyAch.toFixed(1)}%
                                        </span>
                                        <div className={`w-2 h-2 rounded-full ${yearlyAch >= 100 ? 'bg-[#A2B9AF]/100' : yearlyAch >= 80 ? 'bg-[#82A094]/100' : yearlyAch >= 60 ? 'bg-[#CE9F6B]/100' : 'bg-[#E17F70]/100'}`} />
                                      </div>
                                    </div>
                                    <span className="text-xl">{getStatusEmoji(yearlyAch)}</span>
                                  </div>
                                  <div className="relative h-2.5 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full bg-gradient-to-r ${getAchievementColor(yearlyAch)} transition-all duration-500`}
                                      style={{ width: `${Math.min(100, yearlyAch)}%` }}
                                    />
                                    <div 
                                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 rounded-full shadow-md transition-all duration-500"
                                      style={{ 
                                        left: `${Math.min(100, yearlyAch)}%`,
                                        borderColor: yearlyAch >= 100 ? '#16a34a' : yearlyAch >= 80 ? '#10b981' : yearlyAch >= 60 ? '#f59e0b' : '#ef4444',
                                        transform: 'translate(-50%, -50%)',
                                        opacity: 0.25
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-[#5D6E73] mt-1">{user.yearlyOfferCount} offers • {user.userEmail}</p>
                                </div>
                              </div>
                            </div>
                          )
                        }) || []
                      }).flat()
                    })()}

                    {heatmapView === 'user' && (!targetsSummary?.usersByZone || targetsSummary.usersByZone.length === 0 || targetsSummary.usersByZone.every((z: any) => !z.users || z.users.length === 0)) && (
                      <div className="text-center py-8">
                        <p className="text-[#5D6E73]">No user targets data available</p>
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="mt-6 pt-6 border-t border-[#92A2A5] flex flex-wrap gap-4 justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-[#82A094]" />
                      <span className="text-sm font-medium text-[#5D6E73]">✨ Exceeding (≥100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#82A094] to-[#82A094]" />
                      <span className="text-sm font-medium text-[#5D6E73]">🎯 On Track (≥80%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#CE9F6B] to-[#CE9F6B]" />
                      <span className="text-sm font-medium text-[#5D6E73]">⚠️ Needs Attention (≥60%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-[#E17F70]" />
                      <span className="text-sm font-medium text-[#5D6E73]">❌ Below Target (&lt;60%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Type Performance */}
            {(dashboardData?.productTypePerformance?.length ?? 0) > 0 && (
              <Card className="border-0 shadow-xl">
                <CardHeader className="bg-white border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3 text-2xl">
                        <div className="p-2 bg-[#546A7A] rounded-xl">
                          <Package className="h-6 w-6 text-white" />
                        </div>
                        Product Type Performance
                      </CardTitle>
                      <CardDescription className="mt-2 text-base">
                        All-time performance by product type
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#AEBFC3]/10">
                        <tr className="text-left text-[#5D6E73]">
                          <th className="px-3 py-2 font-semibold">Product Type</th>
                          <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('count')}>Offers</th>
                          <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('value')}>Total Value</th>
                          <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('wonValue')}>Won Value</th>
                          <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('wonShare')}>Won Share%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ptSorted.map((p) => {
                          const color = productTypeData.productTypeColorMap.get(p.productType) || '#8B5CF6'
                          const valuePct = productTypeData.ptMaxValue > 0 ? Math.round((p.value / productTypeData.ptMaxValue) * 100) : 0
                          const wonPct = productTypeData.ptMaxWon > 0 ? Math.round((p.wonValue / productTypeData.ptMaxWon) * 100) : 0
                          return (
                            <tr key={p.productType} className="align-middle">
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="font-medium text-[#546A7A]">{p.productType}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">{p.count}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-40 h-2 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                    <div className="h-2 rounded-full" style={{ width: `${valuePct}%`, backgroundColor: color }} />
                                  </div>
                                  <span className="tabular-nums font-medium">{formatCurrency(p.value)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-40 h-2 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                    <div className="h-2 rounded-full" style={{ width: `${wonPct}%`, backgroundColor: color }} />
                                  </div>
                                  <span className="tabular-nums">{formatCurrency(p.wonValue)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold`} style={{ color: color, backgroundColor: `${color}22` }}>
                                  {(p.wonShare * 100).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Charts Row */}
        {mode !== 'zoneUser' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Stage Distribution Pie Chart */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-white border-b">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-[#6F8A9D] rounded-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                Offer Stage Distribution
              </CardTitle>
              <CardDescription className="text-base">
                Breakdown of offers by current stage
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart margin={{ top: 0, right: 0, bottom: 60, left: 0 }}>
                  <Pie
                    data={(dashboardData?.offersByStage || []).map(s => ({
                      name: formatStage(s.stage),
                      value: s.count,
                      color: s.stage === 'WON' ? '#10B981' : s.stage === 'LOST' ? '#EF4444' : '#3B82F6'
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    paddingAngle={2}
                    outerRadius={105}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(dashboardData?.offersByStage || []).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.stage === 'WON' ? '#10B981' : entry.stage === 'LOST' ? '#EF4444' : entry.stage === 'NEGOTIATION' ? '#8B5CF6' : entry.stage === 'PROPOSAL_SENT' ? '#3B82F6' : '#6366F1'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '12px', 
                      border: 'none',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ paddingTop: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Zone Performance Bar Chart */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-white border-b">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-[#4F6A64] rounded-lg">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                Zone Performance
              </CardTitle>
              <CardDescription className="text-base">
                Offer value by zone
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={dashboardData?.offersByZone || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis 
                    tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(Number(value)), 'Value']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '12px', 
                      border: 'none',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {(dashboardData?.offersByZone || []).map((entry: any, idx: number) => (
                      <Cell key={`zone-cell-${entry.name}-${idx}`} fill={zoneMatrixData.zoneColorMap.get(entry.name) || '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        )}

        {isZoneUser && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* My Stage Distribution Pie Chart */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-white border-b">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-[#6F8A9D] rounded-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                Offer Stage Distribution
              </CardTitle>
              <CardDescription className="text-base">
                Breakdown of offers by current stage
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart margin={{ top: 0, right: 0, bottom: 60, left: 0 }}>
                  <Pie
                    data={((((dashboardData as any)?.myOffersByStage) || []) as any[]).map((s: any) => ({
                      name: formatStage(s.stage),
                      value: s.count,
                      color: s.stage === 'WON' ? '#10B981' : s.stage === 'LOST' ? '#EF4444' : '#3B82F6'
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    paddingAngle={2}
                    outerRadius={105}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {((((dashboardData as any)?.myOffersByStage) || []) as any[]).map((entry: any, index: number) => (
                      <Cell 
                        key={`my-cell-${index}`} 
                        fill={entry.stage === 'WON' ? '#10B981' : entry.stage === 'LOST' ? '#EF4444' : entry.stage === 'NEGOTIATION' ? '#8B5CF6' : entry.stage === 'PROPOSAL_SENT' ? '#3B82F6' : '#6366F1'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '12px', 
                      border: 'none',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ paddingTop: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* My 12-Month Offers Trend */}
          {(() => {
            const last12 = getLast12Months()
            const trendMap = new Map<string, { offers: number; value: number }>()
            ;((((dashboardData as any)?.myMonthlyTrend) || []) as any[]).forEach((m: any) => {
              const label = toShortMonthLabel(m.month)
              if (!label) return
              trendMap.set(label, { offers: Number(m.offers || 0), value: Number(m.value || 0) })
            })
            const normalizedMonthlyTrend = last12.map(m => {
              const item = trendMap.get(m.label)
              return { month: m.label, offers: item?.offers || 0, value: item?.value || 0 }
            })
            return (
              <Card className="border-0 shadow-xl">
                <CardHeader className="bg-white border-b">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 bg-[#546A7A] rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    12-Month Offers & Revenue Trend
                  </CardTitle>
                  <CardDescription className="text-base">
                    Personal offers and revenue trend
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={normalizedMonthlyTrend} margin={{ bottom: 20, left: 10, right: 10 }}>
                      <defs>
                        <linearGradient id="colorOffersUser" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorValueUser" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        interval={0}
                        minTickGap={0}
                        tickMargin={12}
                        tick={<RenderMonthTick />}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        height={80}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        tickFormatter={(value) => `₹${(Number(value) / 100000).toFixed(0)}L`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                          borderRadius: '12px', 
                          border: 'none',
                          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                          padding: '12px'
                        }}
                        labelStyle={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '6px' }}
                        formatter={(value: any, name: string) => {
                          if (name === 'value') {
                            return [formatCurrency(Number(value)), 'Revenue']
                          }
                          return [value, 'Offers']
                        }}
                      />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="offers" 
                        stroke="#06B6D4" 
                        strokeWidth={3}
                        fill="url(#colorOffersUser)"
                        name="Offers Count"
                        dot={{ fill: '#06B6D4', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 7, strokeWidth: 2 }}
                      />
                      <Area 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8B5CF6" 
                        strokeWidth={3}
                        fill="url(#colorValueUser)"
                        name="Revenue Value"
                        dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 7, strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )
          })()}
        </div>
        )}

        {/* Zone × Product Type Breakdown (Stacked) */}
        {mode !== 'zoneUser' && productTypeData.pivotByZone.length > 0 && productTypeData.productTypesForStack.length > 0 && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-white border-b">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-[#4F6A64] rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                Zone × Product Type Mix
              </CardTitle>
              <CardDescription className="text-base">
                Stacked breakdown of offer value by product type
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={zoneMatrixData.ensuredMatrixData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="zoneName" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tickFormatter={(value) => `₹${(Number(value) / 100000).toFixed(0)}L`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(Number(value)), 'Value']}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                  {productTypeData.productTypesForStack.map((pt: string, idx: number) => (
                    <Bar 
                      key={pt} 
                      dataKey={pt} 
                      name={pt.replace(/_/g, ' ')} 
                      stackId="a" 
                      fill={productTypeData.productStackColors[idx % productTypeData.productStackColors.length]} 
                      radius={[6,6,0,0]} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {isZoneUser && (() => {
          const myPerf: any[] = ((((dashboardData as any)?.myProductTypePerformance) || []) as any[])
          if (!myPerf || myPerf.length === 0) return null
          const myPerfMap = new Map<string, any>(myPerf.map((p: any) => [p.productType, p]))
          const myNormalized = productTypeData.ALL_PRODUCT_TYPES.map((pt: string) => {
            const base: any = myPerfMap.get(pt) || {}
            return {
              productType: pt,
              count: Number(base.count || 0),
              value: Number(base.value || 0),
              wonValue: Number(base.wonValue || 0),
              wonShare: Number(base.value || 0) > 0 ? Number(base.wonValue || 0) / Number(base.value || 0) : 0,
            }
          })
          const myMaxValue = Math.max(0, ...myNormalized.map(p => Number(p.value || 0)))
          const myMaxWon = Math.max(0, ...myNormalized.map(p => Number(p.wonValue || 0)))
          const getKey = (p: any) => {
            if (ptSortBy === 'wonShare') return p.wonShare
            return Number(p[ptSortBy] || 0)
          }
          const mySorted = [...myNormalized].sort((a, b) => {
            const av = getKey(a)
            const bv = getKey(b)
            return ptSortDir === 'desc' ? (bv - av) : (av - bv)
          })
          return (
            <Card className="border-0 shadow-xl">
              <CardHeader className="bg-white border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <div className="p-2 bg-[#546A7A] rounded-xl">
                        <Package className="h-6 w-6 text-white" />
                      </div>
                      My Product Type Performance
                    </CardTitle>
                    <CardDescription className="mt-2 text-base">
                      This month performance by product type
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#AEBFC3]/10">
                      <tr className="text-left text-[#5D6E73]">
                        <th className="px-3 py-2 font-semibold">Product Type</th>
                        <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('count')}>Offers</th>
                        <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('value')}>Total Value</th>
                        <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('wonValue')}>Won Value</th>
                        <th className="px-3 py-2 font-semibold cursor-pointer" onClick={() => toggleSort('wonShare')}>Won Share%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mySorted.map((p) => {
                        const color = productTypeData.productTypeColorMap.get(p.productType) || '#8B5CF6'
                        const valuePct = myMaxValue > 0 ? Math.round((p.value / myMaxValue) * 100) : 0
                        const wonPct = myMaxWon > 0 ? Math.round((p.wonValue / myMaxWon) * 100) : 0
                        return (
                          <tr key={p.productType} className="align-middle">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-medium text-[#546A7A]">{p.productType}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">{p.count}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-40 h-2 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                  <div className="h-2 rounded-full" style={{ width: `${valuePct}%`, backgroundColor: color }} />
                                </div>
                                <span className="tabular-nums font-medium">{formatCurrency(p.value)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-40 h-2 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                  <div className="h-2 rounded-full" style={{ width: `${wonPct}%`, backgroundColor: color }} />
                                </div>
                                <span className="tabular-nums">{formatCurrency(p.wonValue)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold`} style={{ color: color, backgroundColor: `${color}22` }}>
                                {(p.wonShare * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* Recent Offers */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-white border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 bg-[#546A7A] rounded-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  Recent Offers
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Latest offers added by users
                </CardDescription>
              </div>
              <button className="px-3 py-2 text-sm font-medium text-[#546A7A] bg-[#546A7A]/20 rounded-lg hover:bg-[#6F8A9D]/30 transition-colors flex items-center gap-2">
                <Eye className="h-4 w-4" />
                View All
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {recentOffersData.map((offer: any, index: number) => (
                <div 
                  key={offer.id} 
                  className="group flex items-center justify-between p-4 bg-gradient-to-r from-[#AEBFC3]/10 to-white rounded-xl border border-[#92A2A5] hover:border-violet-300 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-lg text-white font-bold shadow-md">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-[#546A7A]">{offer.customer?.companyName || 'Unknown'}</p>
                        <span className="px-2 py-0.5 text-xs font-medium text-[#5D6E73] bg-[#92A2A5]/30 rounded-full flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {offer.zone?.name || 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-[#5D6E73] flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Added by {offer.createdBy?.name || offer.createdBy?.email || offer.assignedTo?.name || 'N/A'} 
                        <span className="mx-1">•</span>
                        <Clock className="h-3 w-3" />
                        {new Date(offer.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-[#5D6E73] mb-1">Value</p>
                      <p className="font-bold text-[#546A7A] text-lg">{formatCurrency(offer.offerValue || 0)}</p>
                    </div>
                    <div className={`px-3 py-2 rounded-xl text-xs font-semibold ${getStageColor(offer.stage)}`}>
                      {formatStage(offer.stage)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 12-Month Offers Trend */}
        {mode !== 'zoneUser' && (() => {
          const last12 = getLast12Months()
          const trendMap = new Map<string, { offers: number; value: number }>()
          ;(dashboardData?.monthlyTrend || []).forEach((m: any) => {
            const label = toShortMonthLabel(m.month)
            if (!label) return
            trendMap.set(label, { offers: Number(m.offers || 0), value: Number(m.value || 0) })
          })
          const normalizedMonthlyTrend = last12.map(m => {
            const item = trendMap.get(m.label)
            return { month: m.label, offers: item?.offers || 0, value: item?.value || 0 }
          })

          return (
            <Card className="border-0 shadow-2xl">
              <CardHeader className="bg-white border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <div className="p-3 bg-gradient-to-br from-cyan-600 to-[#546A7A] rounded-xl shadow-lg">
                        <TrendingUp className="h-7 w-7 text-white" />
                      </div>
                      12-Month Offers & Revenue Trend
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      Year-over-year performance analysis with offer count and revenue tracking
                    </CardDescription>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D]"></div>
                      <span className="text-sm font-medium text-[#5D6E73]">Offers</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D]"></div>
                      <span className="text-sm font-medium text-[#5D6E73]">Revenue</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <ResponsiveContainer width="100%" height={450}>
                  <ComposedChart data={normalizedMonthlyTrend} margin={{ bottom: 20, left: 10, right: 10 }}>
                    <defs>
                      <linearGradient id="colorOffersLarge" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorValueLarge" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      interval={0}
                      minTickGap={0}
                      tickMargin={12}
                      tick={<RenderMonthTick />}
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                      tickLine={{ stroke: '#cbd5e1' }}
                      height={80}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                      tickLine={{ stroke: '#cbd5e1' }}
                      label={{ value: 'Number of Offers', angle: -90, position: 'insideLeft', style: { fill: '#475569', fontWeight: 600 } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                      tickLine={{ stroke: '#cbd5e1' }}
                      tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                      label={{ value: 'Revenue Value', angle: 90, position: 'insideRight', style: { fill: '#475569', fontWeight: 600 } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                        borderRadius: '16px', 
                        border: 'none',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                        padding: '16px'
                      }}
                      labelStyle={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', marginBottom: '8px' }}
                      formatter={(value: any, name: string) => {
                        if (name === 'value') {
                          return [formatCurrency(Number(value)), 'Revenue']
                        }
                        return [value, 'Offers']
                      }}
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="offers" 
                      stroke="#06B6D4" 
                      strokeWidth={4}
                      fill="url(#colorOffersLarge)"
                      name="Offers Count"
                      dot={{ fill: '#06B6D4', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 8, strokeWidth: 2 }}
                    />
                    <Area 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="value" 
                      stroke="#8B5CF6" 
                      strokeWidth={4}
                      fill="url(#colorValueLarge)"
                      name="Revenue Value"
                      dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 8, strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )
        })()}
      </div>

      {/* Refreshing Overlay */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#92A2A5]/50 px-5 py-3 flex items-center gap-3">
            <div className="relative">
              <RefreshCw className="w-5 h-5 text-[#546A7A] animate-spin" />
            </div>
            <span className="text-sm text-[#5D6E73] font-semibold">Updating...</span>
          </div>
        </div>
      )}

      {/* Custom animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
