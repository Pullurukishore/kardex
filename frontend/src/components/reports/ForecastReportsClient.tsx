'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Download, FileText, BarChart3, Users, Building2,
  Calendar, Target, TrendingUp, TrendingDown, Activity,
  ChevronRight, Sparkles, PieChart, Award, IndianRupee,
  Filter, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
} from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import type {
  ForecastPdfData, ForecastReportFilter, ForecastPdfZone, ForecastPdfTotals,
  ForecastPdfZoneMonthly, ForecastPdfUserMonthly,
} from '@/lib/forecast-pdf-utils'

interface Zone {
  id: number
  name: string
}

export default function ForecastReportsClient({ zones: initialZones }: { zones: Zone[] }) {
  const [zones, setZones] = useState<Zone[]>(initialZones || [])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedFilter, setSelectedFilter] = useState<ForecastReportFilter>('zone-wise')
  const [selectedZoneId, setSelectedZoneId] = useState<number | undefined>(undefined)
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(new Date().getMonth())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewData, setPreviewData] = useState<ForecastPdfData | null>(null)
  const hasFetched = useRef(false)

  const years = Array.from({ length: 11 }, (_, i) => 2030 - i)

  // Fetch zones if not available
  useEffect(() => {
    if (zones.length === 0 && !hasFetched.current) {
      hasFetched.current = true
      apiService.getZones().then((res: any) => {
        const z = Array.isArray(res) ? res : res.data || []
        setZones(z.map((zone: any) => ({ id: zone.id, name: zone.name })))
      }).catch(() => {})
    }
  }, [zones.length])

  const fetchForecastData = useCallback(async (): Promise<ForecastPdfData | null> => {
    try {
      setLoading(true)

      // Fetch all forecast data in parallel
      const zoneIds = zones.map(z => z.id)
      const [summaryRes, monthlyRes, productRes, ...userDataByZone] = await Promise.all([
        apiService.getForecastSummary({ year: selectedYear }),
        apiService.getForecastMonthly({ year: selectedYear }),
        apiService.getProductWiseForecast({ year: selectedYear }),
        ...zoneIds.map(zoneId =>
          apiService.getUserMonthlyBreakdown({ year: selectedYear, zoneId }).catch(() => null)
        ),
      ])

      const allUsers = userDataByZone
        .filter(Boolean)
        .flatMap((data: any) => data?.users || [])

      // Process product totals for global analysis
      const prodTotalsMap: Record<string, any> = {}
      
      // If productRes is available, it might have a more exhaustive list of products
      // otherwise we aggregate from monthlyRes
      const zonesWithProducts = monthlyRes?.zones || []
      zonesWithProducts.forEach((z: any) => {
        if (z.productBreakdown) {
          z.productBreakdown.forEach((p: any) => {
            if (!prodTotalsMap[p.productType]) {
              prodTotalsMap[p.productType] = {
                productType: p.productType,
                productLabel: p.productLabel,
                offersValue: 0,
                orderReceived: 0,
                ordersInHand: 0,
                yearlyTarget: 0,
                hitRate: 0
              }
            }
            const pt = prodTotalsMap[p.productType]
            pt.offersValue += p.totals?.offersValue || 0
            pt.orderReceived += p.totals?.orderReceived || 0
            pt.ordersInHand += p.totals?.ordersInHand || 0
            pt.yearlyTarget += p.yearlyTarget || 0
          })
        }
      })

      // Calculate hit rates for product totals
      Object.values(prodTotalsMap).forEach((p: any) => {
        p.hitRate = p.offersValue > 0 ? (p.orderReceived / p.offersValue) * 100 : 0
      })

      const monthKeys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
      const monthLabels = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

      const zoneMonthlyWithProducts = (monthlyRes?.zones || []).map((zm: any) => {
        if (zm.productBreakdown && zm.productBreakdown.length > 0) return zm

        const prodData = productRes?.zones?.find((pz: any) => pz.zoneId === zm.zoneId)
        if (prodData) {
          // Aggregate product monthly data for the zone (summing across users)
          const zoneProductMatrix: Record<string, any> = {}
          prodData.users.forEach((u: any) => {
            u.products.forEach((p: any) => {
              if (!zoneProductMatrix[p.productType]) {
                zoneProductMatrix[p.productType] = {
                  productType: p.productType,
                  productLabel: p.productLabel,
                  monthlyValues: {} as Record<string, number>,
                  total: 0
                }
              }
              zoneProductMatrix[p.productType].total += p.total || 0
              Object.keys(p.monthlyValues || {}).forEach(m => {
                zoneProductMatrix[p.productType].monthlyValues[m] = (zoneProductMatrix[p.productType].monthlyValues[m] || 0) + (p.monthlyValues[m] || 0)
              })
            })
          })

          zm.productBreakdown = Object.values(zoneProductMatrix).map((p: any) => ({
            productType: p.productType,
            productLabel: p.productLabel,
            yearlyTarget: 0,
            hitRate: 0,
            monthlyData: monthKeys.map((mKey, idx) => ({
              month: mKey,
              monthLabel: monthLabels[idx],
              offersValue: 0,
              orderReceived: p.monthlyValues[mKey] || 0,
              ordersInHand: 0,
              buMonthly: 0,
              percentDev: null,
              offerBUMonth: 0,
              offerBUMonthDev: null
            })),
            totals: {
              offersValue: 0,
              orderReceived: p.total || 0,
              ordersInHand: 0,
              buMonthly: 0,
              offerBUMonth: 0
            }
          }))
        }
        return zm
      })

      const usersWithProducts = allUsers.map((u: any) => {
        if (u.productBreakdown && u.productBreakdown.length > 0) return u

        const zoneProdData = productRes?.zones?.find((pz: any) => 
          pz.zoneName.toUpperCase() === u.zoneName.toUpperCase()
        )
        const userProdData = zoneProdData?.users?.find((pu: any) => pu.userId === u.userId)
        
        if (userProdData) {
          u.productBreakdown = userProdData.products.map((p: any) => ({
            productType: p.productType,
            productLabel: p.productLabel,
            yearlyTarget: 0,
            hitRate: 0,
            monthlyData: monthKeys.map((mKey, idx) => ({
              month: mKey,
              monthLabel: monthLabels[idx],
              offersValue: 0,
              orderReceived: p.monthlyValues?.[mKey] || 0,
              ordersInHand: 0,
              buMonthly: 0,
              percentDev: null,
              offerBUMonth: 0,
              offerBUMonthDev: null
            })),
            totals: {
              offersValue: 0,
              orderReceived: p.total || 0,
              ordersInHand: 0,
              buMonthly: 0,
              offerBUMonth: 0
            }
          }))
        }
        return u
      })

      const pdfData: ForecastPdfData = {
        year: selectedYear,
        zones: summaryRes?.zones || [],
        totals: summaryRes?.totals || {
          noOfOffers: 0, offersValue: 0, ordersReceived: 0, openFunnel: 0,
          orderBooking: 0, uForBooking: 0, yearlyTarget: 0, balanceBU: 0, hitRatePercent: 0,
        },
        zoneMonthly: zoneMonthlyWithProducts,
        userMonthly: usersWithProducts,
        productTotals: Object.values(prodTotalsMap)
      }

      setPreviewData(pdfData)
      return pdfData
    } catch (err: any) {
      console.error('Failed to fetch forecast data:', err)
      toast.error('Failed to load forecast data')
      return null
    } finally {
      setLoading(false)
    }
  }, [selectedYear, zones])

  const handlePreview = useCallback(async () => {
    await fetchForecastData()
    toast.success('Preview loaded! Check the analytics below.')
  }, [fetchForecastData])

  const handleDownloadPdf = useCallback(async () => {
    try {
      setGenerating(true)
      let data = previewData
      if (!data) {
        data = await fetchForecastData()
      }
      if (!data) {
        toast.error('No data available for PDF generation')
        return
      }

      // Dynamic import the pdf utility
      const { generateForecastPdf } = await import('@/lib/forecast-pdf-utils')
      await generateForecastPdf(data, selectedFilter, selectedZoneId, undefined, selectedMonth)
      toast.success('PDF downloaded successfully!')
    } catch (err: any) {
      console.error('Failed to generate PDF:', err)
      toast.error('Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }, [previewData, selectedFilter, selectedZoneId, selectedMonth, fetchForecastData])

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (v: number) => new Intl.NumberFormat('en-IN').format(v)

  const filterOptions: { value: ForecastReportFilter; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'zone-wise', label: 'Zone Wise Report', icon: <Building2 className="w-4 h-4" />, desc: 'Detailed per-zone analysis with monthly performance breakdown' },
    { value: 'zone-users', label: 'Zone Users Report', icon: <Users className="w-4 h-4" />, desc: 'Individual user performance within each zone' },
  ]

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const getAchievementColor = (ach: number) => {
    if (ach >= 100) return 'text-emerald-600 dark:text-emerald-400'
    if (ach >= 75) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-500 dark:text-red-400'
  }

  const getAchievementBg = (ach: number) => {
    if (ach >= 100) return 'bg-emerald-500'
    if (ach >= 75) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getStatusIcon = (ach: number) => {
    if (ach >= 100) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    if (ach >= 75) return <AlertTriangle className="h-4 w-4 text-amber-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5D6E73] via-[#546A7A] to-[#4F6A64] p-6 md:p-8 shadow-2xl border border-white/5">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(150,174,194,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(162,185,175,0.15),transparent_50%)]" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#96AEC2]/15 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        </div>

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    Forecast Reports
                  </h1>
                  <p className="text-[#96AEC2]/80 text-sm mt-1">
                    Generate beautifully designed PDF analytics reports
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Year Selector */}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                <Calendar className="h-4 w-4 text-white/70" />
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-[110px] border-0 bg-transparent text-white font-semibold focus:ring-0 focus:ring-offset-0 h-auto p-0">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl">
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)} className="font-medium">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Month Selector */}
              {(selectedFilter === 'zone-wise' || selectedFilter === 'zone-users') && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <Activity className="h-4 w-4 text-white/70" />
                  <Select 
                    value={selectedMonth === undefined ? "all" : String(selectedMonth)} 
                    onValueChange={(v) => setSelectedMonth(v === "all" ? undefined : parseInt(v))}
                  >
                    <SelectTrigger className="w-[130px] border-0 bg-transparent text-white font-semibold focus:ring-0 focus:ring-offset-0 h-auto p-0">
                      <SelectValue placeholder="Full Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl">
                      <SelectItem value="all" className="font-medium">Full Year</SelectItem>
                      {months.map((m, idx) => (
                        <SelectItem key={m} value={String(idx)} className="font-medium">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Preview Button */}
              <Button
                onClick={handlePreview}
                disabled={loading}
                className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm font-semibold rounded-xl px-5 transition-all duration-300 hover:scale-105"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {loading ? 'Loading...' : 'Load Preview'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelectedFilter(opt.value)}
            className={`group relative overflow-hidden p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
              selectedFilter === opt.value
                ? 'border-[#546A7A] bg-gradient-to-br from-[#546A7A]/10 to-[#96AEC2]/10 shadow-lg shadow-[#546A7A]/10 scale-[1.02]'
                : 'border-[#92A2A5]/30 bg-white dark:bg-[#546A7A]/30 hover:border-[#92A2A5] hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl transition-colors ${
                selectedFilter === opt.value
                  ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-md'
                  : 'bg-[#AEBFC3]/20 text-[#5D6E73] dark:text-[#92A2A5] group-hover:bg-[#AEBFC3]/30'
              }`}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${
                  selectedFilter === opt.value ? 'text-[#546A7A] dark:text-white' : 'text-[#5D6E73] dark:text-[#AEBFC3]'
                }`}>
                  {opt.label}
                </p>
                <p className="text-xs text-[#757777] dark:text-[#979796] mt-0.5 line-clamp-2">
                  {opt.desc}
                </p>
              </div>
            </div>
            {selectedFilter === opt.value && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Zone Filter (for zone-wise and zone-users) */}
      {(selectedFilter === 'zone-wise' || selectedFilter === 'zone-users') && (
        <Card className="overflow-hidden border border-[#92A2A5]/40 dark:border-[#5D6E73]/40 shadow-md rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#5D6E73]" />
                <span className="text-sm font-semibold text-[#5D6E73] dark:text-[#AEBFC3]">Filter by Zone:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedZoneId(undefined)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    !selectedZoneId
                      ? 'bg-gradient-to-r from-[#546A7A] to-[#5D6E73] text-white shadow-md'
                      : 'bg-[#AEBFC3]/20 text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/30'
                  }`}
                >
                  All Zones
                </button>
                {zones.map(z => (
                  <button
                    key={z.id}
                    onClick={() => setSelectedZoneId(z.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      selectedZoneId === z.id
                        ? 'bg-gradient-to-r from-[#546A7A] to-[#5D6E73] text-white shadow-md'
                        : 'bg-[#AEBFC3]/20 text-[#5D6E73] dark:text-[#92A2A5] hover:bg-[#AEBFC3]/30'
                    }`}
                  >
                    {z.name}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download Button */}
      <div className="flex items-center justify-center">
        <Button
          onClick={handleDownloadPdf}
          disabled={generating || loading}
          size="lg"
          className="bg-gradient-to-r from-[#546A7A] via-[#5D6E73] to-[#4F6A64] hover:from-[#4F6A64] hover:via-[#546A7A] hover:to-[#5D6E73] text-white font-bold rounded-2xl px-10 py-6 text-base shadow-xl shadow-[#546A7A]/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
        >
          {generating ? (
            <Loader2 className="h-5 w-5 mr-3 animate-spin" />
          ) : (
            <Download className="h-5 w-5 mr-3" />
          )}
          {generating ? 'Generating PDF...' : `Download ${filterOptions.find(f => f.value === selectedFilter)?.label || 'Report'} PDF`}
        </Button>
      </div>

      {/* Preview Section */}
      {previewData && (
        <div className="space-y-5">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Offers */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#6F8A9D]/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">Total Offers</p>
                    <p className="text-2xl font-black text-[#546A7A] dark:text-white tracking-tight">
                      {formatNumber(previewData.totals.noOfOffers)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Offers Value */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#82A094]/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">Offers Value</p>
                    <p className="text-xl font-black text-[#546A7A] dark:text-[#6F8A9D] tracking-tight">
                      {formatCurrency(previewData.totals.offersValue)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <IndianRupee className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orders Won */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">Orders Won</p>
                    <p className="text-xl font-black text-[#4F6A64] dark:text-[#82A094] tracking-tight">
                      {formatCurrency(previewData.totals.ordersReceived)}
                    </p>
                    {previewData.totals.yearlyTarget > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-[#92A2A5]/30 rounded-full overflow-hidden max-w-[50px]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getAchievementBg(
                              (previewData.totals.ordersReceived / previewData.totals.yearlyTarget) * 100
                            )}`}
                            style={{ width: `${Math.min((previewData.totals.ordersReceived / previewData.totals.yearlyTarget) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold ${getAchievementColor(
                          (previewData.totals.ordersReceived / previewData.totals.yearlyTarget) * 100
                        )}`}>
                          {((previewData.totals.ordersReceived / previewData.totals.yearlyTarget) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#6F8A9D] to-[#9E3B47] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <Award className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Yearly Target */}
            <Card className="group relative overflow-hidden bg-white dark:bg-[#546A7A] border border-[#92A2A5]/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#757777] dark:text-[#979796] uppercase tracking-wider">Yearly Target</p>
                    <p className="text-xl font-black text-[#976E44] dark:text-[#CE9F6B] tracking-tight">
                      {formatCurrency(previewData.totals.yearlyTarget)}
                    </p>
                    <p className="text-[10px] text-[#757777]">
                      Hit Rate: {previewData.totals.hitRatePercent?.toFixed(1) ?? '0'}%
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-xl shadow-md group-hover:scale-110 transition-transform">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Zone Summary Table */}
          <Card className="overflow-hidden border border-[#92A2A5]/60 shadow-lg bg-white dark:bg-[#546A7A] rounded-xl">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-[#5D6E73] py-3 px-4 border-b border-[#5D6E73]/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#96AEC2]/20 rounded-lg">
                    <Building2 className="h-4 w-4 text-[#96AEC2]" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white">Zone Performance Preview</CardTitle>
                    <p className="text-[#979796] text-xs">Data preview for {selectedYear} • Will be included in PDF</p>
                  </div>
                </div>
                <Badge className="bg-[#96AEC2]/20 text-[#96AEC2] border-[#6F8A9D]/30 font-bold px-2 py-0.5 text-[10px]">
                  {previewData.zones.length} Zones
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#AEBFC3]/10 dark:bg-[#546A7A]/80 border-b border-[#92A2A5]">
                      <th className="px-3 py-2 text-left font-bold text-[#5D6E73] dark:text-slate-200 uppercase tracking-wide">Zone</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Offers</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Offers Value</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Orders Won</th>
                      <th className="px-2 py-2 text-right font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Open Funnel</th>
                      <th className="px-2 py-2 text-right font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wide bg-sky-50/50 dark:bg-sky-900/20">Target</th>
                      <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Hit Rate</th>
                      <th className="px-2 py-2 text-center font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wide">Achievement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {previewData.zones.map((zone, idx) => {
                      const ach = zone.yearlyTarget > 0 ? (zone.ordersReceived / zone.yearlyTarget) * 100 : 0
                      return (
                        <tr key={zone.zoneId}
                          className={`hover:bg-[#AEBFC3]/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]/50' : 'bg-[#AEBFC3]/5 dark:bg-[#546A7A]/20'}`}
                        >
                          <td className="px-3 py-2">
                            <span className="font-bold text-[#546A7A] dark:text-white text-xs">{zone.zoneName}</span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-bold text-[#5D6E73]">{zone.noOfOffers}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-[#6F8A9D]">{formatCurrency(zone.offersValue)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#4F6A64] dark:text-[#82A094]">{formatCurrency(zone.ordersReceived)}</td>
                          <td className="px-2 py-2 text-right font-mono text-[#976E44] dark:text-[#CE9F6B]">{formatCurrency(zone.openFunnel)}</td>
                          <td className="px-2 py-2 text-right bg-sky-50/30 dark:bg-sky-900/10 font-mono text-sky-700 dark:text-sky-400">{formatCurrency(zone.yearlyTarget)}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              zone.hitRatePercent >= 50
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : zone.hitRatePercent >= 30
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {zone.hitRatePercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5 justify-center">
                              <div className="flex-1 h-1.5 bg-[#92A2A5]/30 rounded-full overflow-hidden max-w-[40px]">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${getAchievementBg(ach)}`}
                                  style={{ width: `${Math.min(ach, 100)}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-bold ${getAchievementColor(ach)}`}>
                                {ach.toFixed(0)}%
                              </span>
                              {getStatusIcon(ach)}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-800 to-[#5D6E73] text-white">
                      <td className="px-3 py-2 font-bold text-sm">Total</td>
                      <td className="px-2 py-2 text-right font-mono font-bold">{previewData.totals.noOfOffers}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[#96AEC2]">{formatCurrency(previewData.totals.offersValue)}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[#82A094]">{formatCurrency(previewData.totals.ordersReceived)}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[#EEC1BF]">{formatCurrency(previewData.totals.openFunnel)}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-sky-300">{formatCurrency(previewData.totals.yearlyTarget)}</td>
                      <td className="px-2 py-2 text-center font-bold">{previewData.totals.hitRatePercent?.toFixed(1) ?? '0'}%</td>
                      <td className="px-2 py-2 text-center font-bold">
                        {previewData.totals.yearlyTarget > 0
                          ? ((previewData.totals.ordersReceived / previewData.totals.yearlyTarget) * 100).toFixed(1)
                          : '0'}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Users Preview (for zone-users filter) */}
          {selectedFilter === 'zone-users' && previewData.userMonthly.length > 0 && (
            <Card className="overflow-hidden border border-[#92A2A5]/60 shadow-lg bg-white dark:bg-[#546A7A] rounded-xl">
              <CardHeader className="bg-gradient-to-r from-[#4F6A64] to-[#5D6E73] py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white">User Performance Preview</CardTitle>
                    <p className="text-white/60 text-xs">{previewData.userMonthly.length} users across all zones</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#AEBFC3]/10 border-b border-[#92A2A5]">
                        <th className="px-3 py-2 text-left font-bold text-[#5D6E73] uppercase">User</th>
                        <th className="px-2 py-2 text-center font-bold text-[#5D6E73] uppercase">Zone</th>
                        <th className="px-2 py-2 text-right font-bold text-[#5D6E73] uppercase">Offers Value</th>
                        <th className="px-2 py-2 text-right font-bold text-[#5D6E73] uppercase">Orders Won</th>
                        <th className="px-2 py-2 text-right font-bold text-[#5D6E73] uppercase">Target</th>
                        <th className="px-2 py-2 text-center font-bold text-[#5D6E73] uppercase">Hit Rate</th>
                        <th className="px-2 py-2 text-center font-bold text-[#5D6E73] uppercase">Achievement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.userMonthly
                        .filter(u => !selectedZoneId || previewData.zones.find(z => z.zoneId === selectedZoneId)?.zoneName === u.zoneName)
                        .map((user, idx) => {
                          const ach = user.yearlyTarget > 0 ? (user.totals.orderReceived / user.yearlyTarget) * 100 : 0
                          return (
                            <tr key={user.userId} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#AEBFC3]/5'}>
                              <td className="px-3 py-2 font-bold text-[#546A7A]">{user.userName}</td>
                              <td className="px-2 py-2 text-center">
                                <Badge variant="outline" className="text-[10px] font-bold">{user.zoneName}</Badge>
                              </td>
                              <td className="px-2 py-2 text-right font-mono">{formatCurrency(user.totals.offersValue)}</td>
                              <td className="px-2 py-2 text-right font-mono text-[#4F6A64]">{formatCurrency(user.totals.orderReceived)}</td>
                              <td className="px-2 py-2 text-right font-mono">{formatCurrency(user.yearlyTarget)}</td>
                              <td className="px-2 py-2 text-center font-bold">{user.hitRate.toFixed(1)}%</td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-1.5 justify-center">
                                  <span className={`text-[10px] font-bold ${getAchievementColor(ach)}`}>
                                    {ach.toFixed(1)}%
                                  </span>
                                  {getStatusIcon(ach)}
                                </div>
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

          {/* Info Banner */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#96AEC2]/10 to-[#A2B9AF]/10 rounded-2xl border border-[#96AEC2]/20">
            <div className="p-2 bg-[#96AEC2]/20 rounded-xl">
              <FileText className="h-5 w-5 text-[#546A7A]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#546A7A] dark:text-[#AEBFC3]">
                PDF Ready to Download
              </p>
              <p className="text-xs text-[#757777]">
                Your report will include KPI cards, zone performance tables, {selectedFilter === 'zone-users' ? 'user performance data, ' : ''}bar charts, pie charts, and detailed analytics — all in a premium, print-ready design.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
