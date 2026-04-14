'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Package, Users, BarChart3, TrendingUp } from 'lucide-react'
import { apiService } from '@/services/api'

interface ProductUserZoneResponse {
  year: number
  productTypes: { key: string; label: string }[]
  zones: {
    zoneId: number
    zoneName: string
    users: { id: number; name: string }[]
    productMatrix: {
      productType: string
      productLabel: string
      userValues: { [userId: number]: number }
      total: number
    }[]
    userTotals: { [userId: number]: number }
    zoneTotalValue: number
  }[]
}

// Zone colors
const zoneColors: Record<string, { bg: string; text: string; light: string; border: string }> = {
  WEST: { bg: 'bg-[#6F8A9D]', text: 'text-[#546A7A]', light: 'bg-[#96AEC2]/10', border: 'border-[#96AEC2]' },
  SOUTH: { bg: 'bg-[#4F6A64]', text: 'text-[#4F6A64]', light: 'bg-[#82A094]/10', border: 'border-[#82A094]/50' },
  NORTH: { bg: 'bg-[#CE9F6B]/100', text: 'text-[#976E44]', light: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]/50' },
  EAST: { bg: 'bg-[#546A7A]', text: 'text-[#546A7A]', light: 'bg-[#6F8A9D]/10', border: 'border-[#6F8A9D]' },
}

const getZoneColor = (name: string) => zoneColors[name.toUpperCase()] || { bg: 'bg-[#5D6E73]', text: 'text-[#5D6E73]', light: 'bg-[#AEBFC3]/10', border: 'border-[#92A2A5]' }

interface Props {
  year: number
  minProbability?: number
  zoneId?: number
  userId?: number
}

export default function ProductUserZoneTab({ year, minProbability = 0, zoneId, userId }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProductUserZoneResponse | null>(null)
  const [selectedZone, setSelectedZone] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'product' | 'user'>('product')

  const isFetching = useRef(false)

  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return
    isFetching.current = true

    try {
      setLoading(true)
      const response = await apiService.getProductUserZoneBreakdown({ year, minProbability, zoneId, userId })
      setData(response)
      if (response.zones?.length > 0) {
        setSelectedZone(zoneId || response.zones[0].zoneId)
      }
    } catch (error) {
      console.error('Failed to fetch Product × User × Zone data:', error)
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#546A7A]" />
        <p className="text-sm text-[#5D6E73]">Loading data...</p>
      </div>
    )
  }

  if (!data) return null

  const activeZone = data.zones.find(z => z.zoneId === selectedZone) || data.zones[0]

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#546A7A] rounded-xl shadow-sm border border-[#92A2A5] dark:border-[#5D6E73]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]">
            <Package className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#546A7A] dark:text-white">Product × User × Zone</h2>
            <p className="text-xs text-[#757777]">{year} • {data.productTypes.length} Products</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg bg-[#AEBFC3]/20 dark:bg-[#546A7A] p-0.5">
            <button
              onClick={() => setViewMode('product')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'product' 
                  ? 'bg-white dark:bg-[#5D6E73] text-[#546A7A] shadow-sm' 
                  : 'text-[#757777] hover:text-[#5D6E73]'
              }`}
            >
              By Product
            </button>
            <button
              onClick={() => setViewMode('user')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'user' 
                  ? 'bg-white dark:bg-[#5D6E73] text-[#546A7A] shadow-sm' 
                  : 'text-[#757777] hover:text-[#5D6E73]'
              }`}
            >
              By User
            </button>
          </div>
        </div>
      </div>

      {/* Zone Totals Summary */}
      {!zoneId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.zones.map(zone => {
            const color = getZoneColor(zone.zoneName)
            const isActive = zone.zoneId === selectedZone
            return (
              <button
                key={zone.zoneId}
                onClick={() => setSelectedZone(zone.zoneId)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  isActive 
                    ? `${color.light} ${color.border} ring-2 ring-offset-1 ring-${zone.zoneName.toLowerCase()}-400`
                    : 'bg-white dark:bg-[#546A7A] border-[#92A2A5] dark:border-[#5D6E73] hover:border-[#92A2A5]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${color.bg}`}></div>
                  <span className={`text-xs font-bold uppercase ${isActive ? color.text : 'text-[#5D6E73]'}`}>
                    {zone.zoneName}
                  </span>
                </div>
                <p className={`text-lg font-bold ${isActive ? 'text-[#546A7A]' : 'text-[#5D6E73]'}`}>
                  {formatCrore(zone.zoneTotalValue)}
                </p>
                <p className="text-[10px] text-[#757777]">{zone.users.length} Users</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Active Zone Detail */}
      {activeZone && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className={`py-2 px-4 ${getZoneColor(activeZone.zoneName).bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-white" />
                <CardTitle className="text-sm font-bold text-white">{activeZone.zoneName} Zone Breakdown</CardTitle>
              </div>
              <span className="text-sm font-bold text-white">{formatCrore(activeZone.zoneTotalValue)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {viewMode === 'product' ? (
              /* Product-wise View - Simple Table */
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#AEBFC3]/10 dark:bg-[#546A7A]">
                      <th className="px-3 py-2 text-left font-bold text-[#5D6E73] dark:text-[#92A2A5] sticky left-0 bg-[#AEBFC3]/10 dark:bg-[#546A7A] z-10">Product</th>
                      {activeZone.users.map(user => (
                        <th key={user.id} className="px-2 py-2 text-right font-medium text-[#5D6E73] dark:text-[#979796] min-w-[70px]">
                          {user.name.split(' ')[0]}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-bold text-[#546A7A] dark:text-white bg-[#AEBFC3]/20 dark:bg-[#5D6E73]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeZone.productMatrix.map((product, idx) => (
                      <tr key={product.productType} className={idx % 2 === 0 ? 'bg-white dark:bg-[#546A7A]' : 'bg-[#AEBFC3]/10/50 dark:bg-[#546A7A]/30'}>
                        <td className="px-3 py-2 font-medium text-[#5D6E73] dark:text-[#92A2A5] sticky left-0 bg-inherit z-10">
                          {product.productLabel}
                        </td>
                        {activeZone.users.map(user => {
                          const value = product.userValues[user.id] || 0
                          return (
                            <td key={user.id} className={`px-2 py-2 text-right font-mono ${value > 0 ? 'text-[#5D6E73] dark:text-[#92A2A5]' : 'text-[#92A2A5] dark:text-[#5D6E73]'}`}>
                              {formatValue(value)}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right font-mono font-bold text-[#546A7A] dark:text-white bg-[#AEBFC3]/20/50 dark:bg-[#5D6E73]/50">
                          {formatValue(product.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#92A2A5]/30 dark:bg-[#5D6E73] font-bold">
                      <td className="px-3 py-2 text-[#546A7A] dark:text-white sticky left-0 bg-[#92A2A5]/30 dark:bg-[#5D6E73] z-10">Total</td>
                      {activeZone.users.map(user => (
                        <td key={user.id} className="px-2 py-2 text-right font-mono text-[#546A7A] dark:text-white">
                          {formatValue(activeZone.userTotals[user.id] || 0)}
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right font-mono text-white ${getZoneColor(activeZone.zoneName).bg}`}>
                        {formatValue(activeZone.zoneTotalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              /* User-wise View - Cards */
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeZone.users.map(user => {
                  const userTotal = activeZone.userTotals[user.id] || 0
                  const userProducts = activeZone.productMatrix
                    .map(p => ({ label: p.productLabel, value: p.userValues[user.id] || 0 }))
                    .filter(p => p.value > 0)
                    .sort((a, b) => b.value - a.value)
                  
                  return (
                    <div key={user.id} className="p-3 rounded-lg bg-[#AEBFC3]/10 dark:bg-[#546A7A] border border-[#92A2A5] dark:border-[#5D6E73]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${getZoneColor(activeZone.zoneName).bg} flex items-center justify-center`}>
                            <span className="text-xs font-bold text-white">{user.name.charAt(0)}</span>
                          </div>
                          <span className="font-semibold text-sm text-[#546A7A] dark:text-white">{user.name}</span>
                        </div>
                        <span className="text-sm font-bold text-[#546A7A] dark:text-white">{formatCrore(userTotal)}</span>
                      </div>
                      {userProducts.length > 0 ? (
                        <div className="space-y-1">
                          {userProducts.slice(0, 4).map(p => (
                            <div key={p.label} className="flex justify-between text-xs">
                              <span className="text-[#5D6E73] dark:text-[#979796] truncate max-w-[60%]">{p.label}</span>
                              <span className="font-mono text-[#5D6E73] dark:text-[#92A2A5]">{formatValue(p.value)}</span>
                            </div>
                          ))}
                          {userProducts.length > 4 && (
                            <p className="text-[10px] text-[#757777]">+{userProducts.length - 4} more</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[#979796] italic">No products</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Product Summary - All Zones */}
      {!zoneId && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="py-2 px-4 bg-gradient-to-r from-yellow-400 to-[#CE9F6B]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#546A7A]" />
              <CardTitle className="text-sm font-bold text-[#546A7A]">All Zones Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#AEBFC3]/10 dark:bg-[#546A7A]">
                    <th className="px-3 py-2 text-left font-bold text-[#5D6E73]">Product</th>
                    {data.zones.map(zone => (
                      <th key={zone.zoneId} className={`px-3 py-2 text-right font-bold ${getZoneColor(zone.zoneName).text}`}>
                        {zone.zoneName}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-bold text-[#546A7A] bg-[#CE9F6B]/20">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.productTypes.map((product, idx) => {
                    const productTotal = data.zones.reduce((sum, zone) => {
                      const row = zone.productMatrix.find(p => p.productType === product.key)
                      return sum + (row?.total || 0)
                    }, 0)
                    
                    return (
                      <tr key={product.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#AEBFC3]/10/50'}>
                        <td className="px-3 py-2 font-medium text-[#5D6E73]">{product.label}</td>
                        {data.zones.map(zone => {
                          const row = zone.productMatrix.find(p => p.productType === product.key)
                          const value = row?.total || 0
                          return (
                            <td key={zone.zoneId} className={`px-3 py-2 text-right font-mono ${value > 0 ? 'text-[#5D6E73]' : 'text-[#92A2A5]'}`}>
                              {formatValue(value)}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right font-mono font-bold text-[#546A7A] bg-[#EEC1BF]/10">
                          {formatValue(productTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#546A7A] text-white font-bold">
                    <td className="px-3 py-2">Grand Total</td>
                    {data.zones.map(zone => (
                      <td key={zone.zoneId} className="px-3 py-2 text-right font-mono">
                        {formatValue(zone.zoneTotalValue)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono bg-[#EEC1BF]/100 text-[#546A7A]">
                      {formatValue(data.zones.reduce((sum, z) => sum + z.zoneTotalValue, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
