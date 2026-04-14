'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ChevronDown, ChevronRight, Package, Calendar } from 'lucide-react'
import { apiService } from '@/services/api'

interface ProductMonthlyData {
  productType: string
  productLabel: string
  monthlyValues: { [month: string]: number }
  total: number
}

interface UserData {
  userId: number
  userName: string
  monthlyTotals: { [month: string]: number }
  grandTotal: number
  products: ProductMonthlyData[]
}

interface ZoneData {
  zoneId: number
  zoneName: string
  users: UserData[]
  monthlyTotals: { [month: string]: number }
  grandTotal: number
}

interface ProductWiseForecastResponse {
  year: number
  months: string[]
  productTypes: { key: string; label: string }[]
  zones: ZoneData[]
}

// Zone colors
const zoneColors: Record<string, { bg: string; text: string; light: string; gradient: string; label: string }> = {
  WEST: { bg: 'bg-[#6F8A9D]', text: 'text-[#96AEC2]', light: 'bg-[#96AEC2]/20', gradient: 'from-[#6F8A9D] to-[#546A7A]', label: 'text-[#96AEC2]' },
  SOUTH: { bg: 'bg-[#4F6A64]', text: 'text-[#A2B9AF]', light: 'bg-[#A2B9AF]/20', gradient: 'from-[#82A094] to-[#4F6A64]', label: 'text-[#A2B9AF]' },
  NORTH: { bg: 'bg-[#CE9F6B]', text: 'text-[#EEC18F]', light: 'bg-[#EEC18F]/20', gradient: 'from-[#CE9F6B] to-[#976E44]', label: 'text-[#EEC18F]' },
  EAST: { bg: 'bg-[#546A7A]', text: 'text-[#92A2A5]', light: 'bg-[#92A2A5]/20', gradient: 'from-[#6F8A9D] to-[#546A7A]', label: 'text-[#92A2A5]' },
}

const getZoneColor = (name: string) => zoneColors[name.toUpperCase()] || { bg: 'bg-[#5D6E73]', text: 'text-[#AEBFC3]', light: 'bg-[#AEBFC3]/10', gradient: 'from-[#757777] to-[#5D6E73]', label: 'text-[#AEBFC3]' }

interface Props {
  year: number
  minProbability?: number
  zoneId?: number
  userId?: number
}

export default function ProductWiseForecastTab({ year, minProbability = 0, zoneId, userId }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProductWiseForecastResponse | null>(null)
  const [selectedZone, setSelectedZone] = useState<number | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set())

  const isFetching = useRef(false)

  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return
    isFetching.current = true

    try {
      setLoading(true)
      const response: ProductWiseForecastResponse = await apiService.getProductWiseForecast({ year, minProbability, zoneId, userId })
      setData(response)
      if (response.zones?.length > 0) {
        const initialZoneId = zoneId || response.zones[0].zoneId
        setSelectedZone(initialZoneId)
        // Expand first user of selected zone by default
        const selectedZoneData = response.zones.find(z => z.zoneId === initialZoneId) || response.zones[0]
        if (selectedZoneData.users?.length > 0) {
          setExpandedUsers(new Set([selectedZoneData.users[0].userId]))
        }
      }
    } catch (error) {
      console.error('Failed to fetch Product-wise Forecast data:', error)
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [year, minProbability, zoneId, userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Sync selectedZone state with zoneId prop
  useEffect(() => {
    if (zoneId) {
      setSelectedZone(zoneId)
    }
  }, [zoneId])

  // When zone changes, expand first user
  useEffect(() => {
    if (data && selectedZone) {
      const zone = data.zones.find(z => z.zoneId === selectedZone)
      if (zone && zone.users && zone.users.length > 0) {
        setExpandedUsers(new Set([zone.users[0].userId]))
      }
    }
  }, [selectedZone, data])

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

  const toggleUser = (userId: number) => {
    const newSet = new Set(expandedUsers)
    if (newSet.has(userId)) newSet.delete(userId)
    else newSet.add(userId)
    setExpandedUsers(newSet)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#546A7A]" />
        <p className="text-sm text-[#5D6E73]">Loading data...</p>
      </div>
    )
  }

  if (!data) return null

  const months = data.months
  const activeZone = data.zones.find(z => z.zoneId === selectedZone) || data.zones[0]

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#546A7A] rounded-xl shadow-sm border border-[#92A2A5] dark:border-[#5D6E73]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#546A7A] dark:text-white">Product-wise Monthly Forecast</h2>
            <p className="text-xs text-[#757777]">{year} • Zone → User → Product × Month</p>
          </div>
        </div>
        
      </div>

      {/* Zone Tabs */}
      {!zoneId && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.zones.map(zone => {
            const color = getZoneColor(zone.zoneName)
            const isActive = zone.zoneId === selectedZone
            return (
              <button
                key={zone.zoneId}
                onClick={() => setSelectedZone(zone.zoneId)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isActive 
                    ? `bg-gradient-to-r ${color.gradient} text-white shadow-md`
                    : 'bg-white dark:bg-[#546A7A] text-[#5D6E73] dark:text-[#979796] border border-[#92A2A5] dark:border-[#5D6E73] hover:border-[#92A2A5]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{zone.zoneName}</span>
                  <span className={`text-xs ${isActive ? 'text-white/80' : 'text-[#979796]'}`}>
                    {formatCrore(zone.grandTotal)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Active Zone Content */}
      {activeZone && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className={`py-2 px-4 bg-gradient-to-r ${getZoneColor(activeZone.zoneName).gradient}`}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white">
                {activeZone.zoneName} Zone • {activeZone.users.length} Users
              </CardTitle>
              <span className="text-sm font-bold text-white">{formatCrore(activeZone.grandTotal)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
            {activeZone.users.map(user => {
              const isExpanded = expandedUsers.has(user.userId)
              const color = getZoneColor(activeZone.zoneName)
              
              return (
                <div key={user.userId}>
                  {/* User Header - Always Visible */}
                  <button
                    onClick={() => toggleUser(user.userId)}
                    className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-[#AEBFC3]/10 dark:hover:bg-[#546A7A]/50 transition-colors ${
                      isExpanded ? 'bg-[#AEBFC3]/10 dark:bg-[#546A7A]/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[#979796]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#979796]" />
                      )}
                      <div className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center`}>
                        <span className="text-xs font-bold text-white">{user.userName.charAt(0)}</span>
                      </div>
                      <span className="font-semibold text-sm text-[#546A7A] dark:text-white">{user.userName}</span>
                    </div>
                    <span className="font-bold text-sm text-[#546A7A] dark:text-white">{formatCrore(user.grandTotal)}</span>
                  </button>

                  {/* User Details - Expandable */}
                  {isExpanded && (
                    <div className="bg-white dark:bg-[#546A7A] border-t border-[#AEBFC3]/30 dark:border-slate-800">
                      {/* Monthly Totals Row */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#96AEC2]/20 dark:bg-[#5D6E73]/50">
                              <th className="px-3 py-2 text-left font-bold text-[#546A7A] dark:text-white sticky left-0 bg-[#E8EEF1] dark:bg-[#4A5D69] z-10 min-w-[120px] border-r border-[#92A2A5]/50 dark:border-[#5D6E73]/50 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                Monthly Total
                              </th>
                              {months.map(month => (
                                <th key={month} className="px-2 py-2 text-center font-bold text-[#546A7A] dark:text-[#92A2A5] min-w-[55px] border-r border-[#92A2A5]/20">
                                  {month}
                                </th>
                              ))}
                              <th className={`px-3 py-2 text-right font-bold text-white min-w-[70px] ${color.bg}`}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="bg-white dark:bg-[#5D6E73]/20 font-bold border-b border-[#92A2A5]/30">
                              <td className="px-3 py-2 sticky left-0 bg-white dark:bg-[#4A5D69] z-10 border-r border-[#92A2A5]/50 dark:border-[#5D6E73]/50 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                <span className="text-[#4F6A64] dark:text-[#A2B9AF]">All Products</span>
                              </td>
                              {months.map(month => (
                                <td key={month} className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-white border-r border-[#92A2A5]/10">
                                  {formatValue(user.monthlyTotals[month] || 0)}
                                </td>
                              ))}
                              <td className={`px-3 py-2 text-right font-mono font-bold text-white ${color.bg} bg-opacity-90`}>
                                {formatValue(user.grandTotal)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Product Breakdown */}
                      <div className="overflow-x-auto border-t border-[#AEBFC3]/30 dark:border-slate-800">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#AEBFC3]/20 dark:bg-[#546A7A]">
                              <th className="px-3 py-1.5 text-left font-bold text-[#5D6E73] dark:text-[#92A2A5] sticky left-0 bg-[#F4F7F8] dark:bg-[#546A7A] z-10 min-w-[120px] border-r border-[#92A2A5]/40 dark:border-[#5D6E73]/40">
                                Product
                              </th>
                              {months.map(month => (
                                <th key={month} className="px-2 py-1.5 text-center font-semibold text-[#546A7A] dark:text-[#92A2A5] min-w-[55px] border-r border-[#92A2A5]/10">
                                  {month}
                                </th>
                              ))}
                              <th className="px-3 py-1.5 text-right font-bold text-[#546A7A] dark:text-white min-w-[70px] bg-[#AEBFC3]/30 dark:bg-[#5D6E73]">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {user.products.map((product, idx) => (
                              <tr 
                                key={product.productType}
                                className={`${idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]' : 'bg-[#AEBFC3]/10/30 dark:bg-[#546A7A]/20'} hover:bg-[#96AEC2]/10/50 dark:hover:bg-[#546A7A]/50 transition-colors`}
                              >
                                <td className="px-3 py-1.5 font-bold text-[#546A7A] dark:text-white sticky left-0 bg-inherit z-10 border-r border-[#92A2A5]/40 dark:border-[#5D6E73]/40">
                                  {product.productLabel}
                                </td>
                                {months.map(month => {
                                  const value = product.monthlyValues[month] || 0
                                  return (
                                    <td key={month} className={`px-2 py-1.5 text-right font-mono border-r border-[#92A2A5]/10 ${value > 0 ? 'text-[#546A7A] dark:text-white' : 'text-[#92A2A5] dark:text-[#5D6E73]'}`}>
                                      {formatValue(value)}
                                    </td>
                                  )
                                })}
                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-[#546A7A] dark:text-white bg-[#AEBFC3]/20/50 dark:bg-[#5D6E73]/30">
                                  {formatValue(product.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Grand Total Footer */}
      {!zoneId && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-800 to-[#5D6E73] rounded-xl">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-white" />
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wider">Grand Total</p>
              <p className="text-lg font-bold text-white">
                {formatCrore(data.zones.reduce((sum, z) => sum + z.grandTotal, 0))}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {data.zones.map(zone => {
              const color = getZoneColor(zone.zoneName)
              return (
                <div key={zone.zoneId} className={`px-2.5 py-1.5 rounded-lg ${color.light} border border-white/10 backdrop-blur-sm`}>
                  <p className={`text-[10px] font-bold ${color.label} uppercase opacity-90`}>{zone.zoneName}</p>
                  <p className="text-xs font-bold text-white/90">{formatCrore(zone.grandTotal)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
