'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ChevronDown, ChevronRight, Users, TrendingUp, IndianRupee, Calendar, Target } from 'lucide-react'
import { apiService } from '@/services/api'

interface UserMonthlyData {
  userId: number
  userName: string
  monthlyValues: { [month: string]: number }
  total: number
}

interface ZonePOData {
  zoneId: number
  zoneName: string
  users: UserMonthlyData[]
  monthlyTotals: { [month: string]: number }
  grandTotal: number
}

interface POExpectedResponse {
  year: number
  zones: ZonePOData[]
  overallTotals: { monthlyTotals: { [month: string]: number }; grandTotal: number }
  months: string[]
}

// Zone colors
const zoneStyles: Record<string, { bg: string; border: string; text: string; light: string }> = {
  WEST: { bg: 'bg-gradient-to-r from-[#546A7A] to-[#546A7A]', border: 'border-[#6F8A9D]', text: 'text-[#546A7A]', light: 'bg-[#96AEC2]/10' },
  SOUTH: { bg: 'bg-gradient-to-r from-[#4F6A64] to-[#4F6A64]', border: 'border-[#82A094]', text: 'text-[#4F6A64]', light: 'bg-[#82A094]/10' },
  NORTH: { bg: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]', border: 'border-[#CE9F6B]', text: 'text-[#976E44]', light: 'bg-[#CE9F6B]/10' },
  EAST: { bg: 'bg-gradient-to-r from-[#546A7A] to-[#546A7A]', border: 'border-[#6F8A9D]', text: 'text-[#546A7A]', light: 'bg-[#6F8A9D]/10' },
}

const getZoneStyle = (name: string) => zoneStyles[name.toUpperCase()] || { bg: 'bg-gradient-to-r from-slate-600 to-slate-700', border: 'border-slate-500', text: 'text-[#5D6E73]', light: 'bg-[#AEBFC3]/10' }

interface Props {
  year: number
  minProbability?: number
  zoneId?: number
  userId?: number
}

// Month full names
const monthFullNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function POExpectedMonthTab({ year, minProbability = 0, zoneId, userId }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<POExpectedResponse | null>(null)
  const [activeView, setActiveView] = useState<'zone' | 'month'>('month')
  const [expandedZones, setExpandedZones] = useState<Set<number>>(new Set())

  const isFetching = useRef(false)

  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return
    isFetching.current = true

    try {
      setLoading(true)
      const response = await apiService.getPOExpectedMonthBreakdown({ year, minProbability, zoneId, userId })
      setData(response)
      if (response.zones) {
        setExpandedZones(new Set(response.zones.map((z: ZonePOData) => z.zoneId)))
      }
    } catch (error) {
      console.error('Failed to fetch PO Expected Month data:', error)
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [year, minProbability, zoneId, userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatValue = (value: number) => {
    if (value === 0) return '-'
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
  }

  const formatCrore = (value: number) => {
    if (value === 0) return '₹0'
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`
  }

  const toggleZone = (zoneId: number) => {
    const newSet = new Set(expandedZones)
    if (newSet.has(zoneId)) newSet.delete(zoneId)
    else newSet.add(zoneId)
    setExpandedZones(newSet)
  }

  // Get quarterly data from backend response (or calculate fallback)
  const getQuarterlyData = () => {
    if (!data) return []
    
    // Use quarterly data from backend if available
    const backendData = (data as any).quarterlyData
    if (backendData && Array.isArray(backendData)) {
      return backendData.map((q: any) => ({
        name: q.name,
        label: q.label,
        total: q.forecast,
        bu: q.bu,
        dev: q.deviation,
      }))
    }
    
    // Fallback: calculate locally if backend doesn't provide it
    const quarterlyBU = (data as any).quarterlyBU || 0
    const quarters = [
      { name: 'Q1', months: ['JAN', 'FEB', 'MAR'], label: 'Q1 Forecast' },
      { name: 'Q2', months: ['APR', 'MAY', 'JUN'], label: 'Q2 Forecast' },
      { name: 'Q3', months: ['JUL', 'AUG', 'SEP'], label: 'Q3 Forecast' },
      { name: 'Q4', months: ['OCT', 'NOV', 'DEC'], label: 'Q4 Forecast' },
    ]

    return quarters.map(q => {
      const total = q.months.reduce((sum, m) => sum + (data.overallTotals.monthlyTotals[m] || 0), 0)
      const bu = quarterlyBU
      const dev = bu > 0 ? ((total - bu) / bu) * 100 : 0
      return { ...q, total, bu, dev }
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#96AEC2] border-t-blue-600 rounded-full animate-spin" />
        </div>
        <p className="text-[#5D6E73] font-medium animate-pulse">Loading PO Expected Month...</p>
      </div>
    )
  }

  if (!data) return null

  const months = data.months
  const quarters = getQuarterlyData()

  return (
    <div className="space-y-6">
      {/* Header with Filter and View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#546A7A] rounded-xl shadow-md border border-[#92A2A5] dark:border-[#5D6E73]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#546A7A] dark:text-white">PO Expected Month - {year}</h2>
            <p className="text-xs text-[#757777]">Forecast by Zone and Month</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-[#AEBFC3]/20 dark:bg-[#546A7A] p-0.5">
            <button
              onClick={() => setActiveView('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeView === 'month' 
                  ? 'bg-white dark:bg-[#5D6E73] text-[#546A7A] shadow-sm' 
                  : 'text-[#757777] hover:text-[#5D6E73]'
              }`}
            >
              📊 Month
            </button>
            <button
              onClick={() => setActiveView('zone')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeView === 'zone' 
                  ? 'bg-white dark:bg-[#5D6E73] text-[#4F6A64] shadow-sm' 
                  : 'text-[#757777] hover:text-[#5D6E73]'
              }`}
            >
              🏢 Zone
            </button>
          </div>
        </div>
      </div>

      {/* Month View - Matches Excel Format */}
      {activeView === 'month' && (
        <Card className="overflow-hidden border-0 shadow-xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                {/* Header */}
                <thead>
                  <tr className="bg-gradient-to-r from-yellow-400 to-yellow-500">
                    <th colSpan={2} className="px-2 py-2 text-left text-xs font-bold text-[#546A7A] border-r border-yellow-600">
                      <span className="underline">Forecast</span>
                    </th>
                    {data.zones.map(zone => (
                      <th key={zone.zoneId} className="px-2 py-2 text-center text-xs font-bold text-[#546A7A] border-r border-yellow-600 min-w-[80px]">
                        {zone.zoneName}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-bold text-[#546A7A] border-r border-yellow-600 min-w-[60px]">
                      {/* Empty for spacing */}
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-bold text-[#546A7A] border-r border-[#92A2A5] min-w-[80px]" title="Quarterly Forecast: Sum of 3 months">
                      Qtr Fcst
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-bold text-[#546A7A] border-r border-[#92A2A5] min-w-[80px]" title="Quarterly BU Target">
                      Qtr BU
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-bold text-[#546A7A] min-w-[60px]" title="% Deviation from target">
                      Dev
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthFullNames.map((monthName, idx) => {
                    const monthKey = months[idx]
                    const rowTotal = data.zones.reduce((sum, z) => sum + (z.monthlyTotals[monthKey] || 0), 0)
                    const isQuarterEnd = (idx + 1) % 3 === 0
                    const quarterIdx = Math.floor(idx / 3)
                    const quarter = quarters[quarterIdx]
                    
                    return (
                      <tr 
                        key={monthKey} 
                        className={`border-b border-[#92A2A5] dark:border-[#5D6E73] ${
                          idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]' : 'bg-[#AEBFC3]/10 dark:bg-[#546A7A]/50'
                        } hover:bg-[#96AEC2]/10 dark:hover:bg-[#5D6E73]/50 transition-colors`}
                      >
                        <td className="px-2 py-1.5 font-semibold text-[#5D6E73] dark:text-[#92A2A5] border-r border-[#92A2A5] dark:border-[#5D6E73] w-[100px]">
                          {monthName}
                        </td>
                        <td className="px-2 py-1.5 font-mono font-bold text-[#546A7A] dark:text-white border-r border-[#92A2A5] dark:border-[#5D6E73] bg-[#EEC1BF]/10 dark:bg-[#976E44]/20">
                          {formatValue(rowTotal)}
                        </td>
                        {data.zones.map(zone => (
                          <td key={zone.zoneId} className="px-2 py-1.5 text-right font-mono text-[#5D6E73] dark:text-[#979796] border-r border-[#92A2A5] dark:border-[#5D6E73]">
                            {formatValue(zone.monthlyTotals[monthKey] || 0)}
                          </td>
                        ))}
                        <td className="border-r border-[#92A2A5] dark:border-[#5D6E73]"></td>
                        
                        {/* Quarterly columns - only show on quarter end months */}
                        {isQuarterEnd ? (
                          <>
                            <td className="px-2 py-1.5 text-right font-mono font-semibold text-[#5D6E73] dark:text-[#92A2A5] border-r border-[#92A2A5] dark:border-[#5D6E73] bg-[#AEBFC3]/20 dark:bg-[#546A7A]">
                              <div className="text-[10px] text-[#757777]">{quarter.label}</div>
                              {formatValue(quarter.total)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono font-semibold text-[#5D6E73] dark:text-[#92A2A5] border-r border-[#92A2A5] dark:border-[#5D6E73] bg-[#AEBFC3]/20 dark:bg-[#546A7A]">
                              <div className="text-[10px] text-[#757777]">{quarter.name} BU</div>
                              {formatValue(quarter.bu)}
                            </td>
                            <td className={`px-2 py-1.5 text-right font-mono font-bold ${
                              quarter.dev >= 0 ? 'text-[#4F6A64] bg-[#82A094]/10 dark:bg-[#4F6A64]/30' : 'text-[#9E3B47] bg-[#EEC1BF]/10 dark:bg-[#9E3B47]/30'
                            }`}>
                              {quarter.dev >= 0 ? '+' : ''}{quarter.dev.toFixed(0)}%
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="border-r border-[#92A2A5] dark:border-[#5D6E73]"></td>
                            <td className="border-r border-[#92A2A5] dark:border-[#5D6E73]"></td>
                            <td></td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                {/* Grand Total Row */}
                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-800 to-[#5D6E73] text-white font-bold">
                    <td className="px-2 py-2 border-r border-[#5D6E73]">Total</td>
                    <td className="px-2 py-2 font-mono text-sm border-r border-[#5D6E73] bg-[#976E44]">
                      {formatValue(data.overallTotals.grandTotal)}
                    </td>
                    {data.zones.map(zone => (
                      <td key={zone.zoneId} className="px-2 py-2 text-right font-mono border-r border-[#5D6E73]">
                        {formatValue(zone.grandTotal)}
                      </td>
                    ))}
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone View - User Breakdown */}
      {activeView === 'zone' && (
        <div className="space-y-3">
          {data.zones.map((zone) => {
            const style = getZoneStyle(zone.zoneName)
            const isExpanded = expandedZones.has(zone.zoneId)

            return (
              <Card key={zone.zoneId} className={`overflow-hidden border-0 shadow-lg transition-all duration-300 ${isExpanded ? 'ring-1 ' + style.border : ''}`}>
                <div 
                  className={`${style.bg} px-4 py-2.5 cursor-pointer transition-all duration-300 hover:opacity-95`}
                  onClick={() => toggleZone(zone.zoneId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-white" /> : <ChevronRight className="h-4 w-4 text-white" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{zone.zoneName}</h3>
                        <p className="text-white/70 text-xs">{zone.users.length} members</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-white/70 text-[10px] uppercase tracking-wider">Total</p>
                        <p className="text-lg font-bold text-white">{formatCrore(zone.grandTotal)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/10">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#AEBFC3]/20 dark:bg-[#546A7A]">
                            <th className="sticky left-0 z-10 bg-[#AEBFC3]/20 dark:bg-[#546A7A] px-2 py-2 text-left text-xs font-bold text-[#5D6E73] dark:text-[#92A2A5] uppercase tracking-wider min-w-[140px] border-r border-[#92A2A5] dark:border-[#5D6E73]">
                              Member
                            </th>
                            {months.map((month) => (
                              <th key={month} className="px-2 py-2 text-center text-xs font-bold text-[#757777] dark:text-[#979796] uppercase tracking-wider min-w-[60px]">
                                {month}
                              </th>
                            ))}
                            <th className="px-2 py-2 text-center text-xs font-bold text-[#5D6E73] dark:text-slate-200 uppercase tracking-wider min-w-[80px] bg-[#92A2A5]/30/50 dark:bg-[#5D6E73]/50">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {zone.users.map((user, idx) => (
                            <tr 
                              key={user.userId} 
                              className={`transition-colors hover:bg-[#96AEC2]/10/50 dark:hover:bg-[#5D6E73]/30 ${
                                idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/30'
                              }`}
                            >
                              <td className="sticky left-0 z-10 bg-inherit px-4 py-3 border-r border-[#AEBFC3]/30 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${style.bg}`}>
                                    {user.userName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-[#546A7A] dark:text-slate-200">{user.userName}</span>
                                </div>
                              </td>
                              {months.map((month) => {
                                const value = user.monthlyValues[month] || 0
                                return (
                                  <td key={month} className={`px-3 py-3 text-center font-mono text-sm ${
                                    value > 0 ? 'text-[#5D6E73] dark:text-[#92A2A5] font-medium' : 'text-[#979796]'
                                  }`}>
                                    {formatValue(value)}
                                  </td>
                                )
                              })}
                              <td className={`px-4 py-3 text-center font-mono font-bold bg-[#AEBFC3]/20/70 dark:bg-[#5D6E73]/50 ${
                                user.total > 0 ? style.text : 'text-[#979796]'
                              }`}>
                                {formatValue(user.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={`${style.bg} text-white font-bold`}>
                            <td className="sticky left-0 z-10 px-4 py-3 border-r border-white/20" style={{ background: 'inherit' }}>
                              Zone Total
                            </td>
                            {months.map((month) => (
                              <td key={month} className="px-3 py-3 text-center font-mono">
                                {formatValue(zone.monthlyTotals[month] || 0)}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-center font-mono text-lg bg-black/20">
                              {formatValue(zone.grandTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Grand Total Summary */}
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-[#5D6E73] via-slate-800 to-[#5D6E73]">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow">
                <IndianRupee className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider">Grand Total</p>
                <p className="text-xl font-bold text-white">{formatCrore(data.overallTotals.grandTotal)}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {data.zones.map(zone => {
                const style = getZoneStyle(zone.zoneName)
                return (
                  <div key={zone.zoneId} className={`px-2.5 py-1.5 rounded-lg ${style.light} border ${style.border}`}>
                    <p className={`text-[10px] font-bold ${style.text} uppercase`}>{zone.zoneName}</p>
                    <p className="text-sm font-bold text-[#546A7A]">{formatCrore(zone.grandTotal)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
