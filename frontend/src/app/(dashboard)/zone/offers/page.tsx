'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import dynamic from 'next/dynamic'

const EditOfferDialog = dynamic(() => import('@/components/offers/EditOfferDialog'), {
  ssr: false
})
import { 
  Search, 
  MoreHorizontal, 
  Pencil as Edit, 
  Trash2, 
  Plus,
  RefreshCw,
  Loader2,
  Eye,
  Building2,
  TrendingUp,
  Package,
  MapPin,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Award,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Percent,
  Calendar,
  Sparkles,
  Users
} from 'lucide-react'
import OfferStats from '@/components/offers/OfferStats'
import { apiService } from '@/services/api'
import { toast } from 'sonner'

// Note: PO_RECEIVED leads directly to WON (ORDER_BOOKED stage removed)
const stages = ['All Stage', 'INITIAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'PO_RECEIVED', 'WON', 'LOST']
const productTypes = ['All Product Types', 'RELOCATION', 'CONTRACT', 'SPARE_PARTS', 'KARDEX_CONNECT', 'UPGRADE_KIT', 'SOFTWARE', 'OTHERS', 'BD_SPARE', 'RETROFIT_KIT']

export default function OfferManagement() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  // Protect this page - ZONE_USER or ADMIN can access
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login?callbackUrl=' + encodeURIComponent('/zone/offers'))
        return
      }
      if (user?.role !== UserRole.ZONE_USER && user?.role !== UserRole.ADMIN) {
        router.push('/zone/dashboard')
        return
      }
    }
  }, [authLoading, isAuthenticated, user?.role, router])

  const [offers, setOffers] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOffer, setEditingOffer] = useState<any>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, pages: 0 })
  const [summary, setSummary] = useState<any>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedZone, setSelectedZone] = useState('All Zones')
  const [selectedStage, setSelectedStage] = useState('All Stage')
  const [selectedUser, setSelectedUser] = useState('All Users')
  const [selectedProductType, setSelectedProductType] = useState('All Product Types')
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Debounce search to prevent excessive API calls
  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    const timeoutId = setTimeout(() => {
      fetchOffers()
    }, searchTerm ? 500 : 0) // 500ms delay for search, immediate for other filters

    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedZone, selectedStage, selectedUser, selectedProductType, pagination.page, authLoading, isAuthenticated])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    fetchZones()
    fetchUsers()
  }, [authLoading, isAuthenticated])

  // Sort offers
  const sortedOffers = useMemo(() => {
    if (!sortField) return offers
    
    return [...offers].sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]
      
      // Handle nested properties
      if (sortField === 'customer') {
        aValue = a.customer?.companyName || a.company || ''
        bValue = b.customer?.companyName || b.company || ''
      } else if (sortField === 'zone') {
        aValue = a.zone?.name || ''
        bValue = b.zone?.name || ''
      } else if (sortField === 'createdBy') {
        aValue = a.createdBy?.name || ''
        bValue = b.createdBy?.name || ''
      } else if (sortField === 'offerValue') {
        aValue = Number(a.offerValue || 0)
        bValue = Number(b.offerValue || 0)
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [offers, sortField, sortDirection])

  // Show loading state while auth is being checked
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#6F8A9D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5D6E73] font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated or not ZONE_USER/ADMIN
  if (!isAuthenticated || (user?.role !== UserRole.ZONE_USER && user?.role !== UserRole.ADMIN)) {
    return null
  }
  
  const fetchZones = async () => {
    try {
      const response = await apiService.getZones()
      // Backend returns { data: [...], pagination: {...} }
      const zonesData = response.data || response || []
      const zonesArray = Array.isArray(zonesData) ? zonesData : []
      setZones(zonesArray)
      console.log('Zones fetched:', zonesArray)
      console.log('User zoneId:', user?.zoneId)
      console.log('User serviceZones:', user?.serviceZones)
      
      // For ZONE_USER, try to get zoneId from serviceZones if zoneId is null
      if (user?.role === UserRole.ZONE_USER && !user?.zoneId && user?.serviceZones && user.serviceZones.length > 0) {
        const firstZoneId = user.serviceZones[0]?.serviceZoneId
        console.log('Extracted zoneId from serviceZones:', firstZoneId)
      }
      
      if (zonesArray.length > 0 && user?.zoneId) {
        const userZone = zonesArray.find(z => z.id === parseInt(String(user.zoneId)))
        console.log('User zone found:', userZone?.name)
      }
    } catch (error: any) {
      console.error('Failed to fetch zones:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch zones')
    }
  }

  const fetchUsers = async () => {
    // Only fetch users for ADMIN - ZONE_USER doesn't need this filter
    if (user?.role !== UserRole.ADMIN) {
      setUsers([])
      return
    }
    
    try {
      const response = await apiService.getUsers({ isActive: 'true' }) // Get only active users
      const usersData = response.data?.users || response.users || []
      const filteredUsers = Array.isArray(usersData) 
        ? usersData.filter((u: any) => u.role === UserRole.ZONE_USER || u.role === UserRole.ZONE_MANAGER)
        : []
      setUsers(filteredUsers)
    } catch (error: any) {
      console.error('Failed to fetch users:', error)
      // Don't show error toast for ZONE_USER since they don't need users list
      if (user?.role === UserRole.ADMIN) {
        toast.error(error.response?.data?.message || 'Failed to fetch users')
      }
    }
  }

  const fetchOffers = async () => {
    setLoading(true)
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      }
      
      if (searchTerm) params.search = searchTerm
      if (selectedZone !== 'All Zones') {
        const zone = zones.find(z => z.name === selectedZone)
        if (zone) params.zoneId = zone.id
      }
      if (selectedStage !== 'All Stage') params.stage = selectedStage
      if (selectedUser !== 'All Users') {
        params.createdById = parseInt(selectedUser)
      }
      if (selectedProductType !== 'All Product Types') params.productType = selectedProductType

      // For ZONE_USER, only show their own offers
      if (user?.role === UserRole.ZONE_USER) {
        params.createdById = user.id
        
        // Also set zoneId from user data
        let zoneId = user?.zoneId ? parseInt(String(user.zoneId)) : null
        if (!zoneId && user?.serviceZones && user.serviceZones.length > 0) {
          zoneId = user.serviceZones[0]?.serviceZoneId
        }
        if (zoneId) {
          params.zoneId = zoneId
        }
      }

      const response = await apiService.getOffers(params)
      setOffers(response.offers || [])
      setPagination(response.pagination || { page: 1, limit: 100, total: 0, pages: 0 })
      setSummary(response.summary || null)
    } catch (error: any) {
      console.error('Failed to fetch offers:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch offers')
      setOffers([])
    } finally {
      setLoading(false)
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

  const handleEditOffer = (offer: any) => {
    setEditingOffer(offer)
    setShowEditDialog(true)
  }

  const handleDeleteOffer = async (offerId: number) => {
    if (confirm('Are you sure you want to delete this offer?')) {
      try {
        await apiService.deleteOffer(offerId)
        toast.success('Offer deleted successfully')
        fetchOffers()
      } catch (error: any) {
        console.error('Failed to delete offer:', error)
        toast.error(error.response?.data?.error || 'Failed to delete offer')
      }
    }
  }


  const clearFilters = () => {
    setSearchTerm('')
    setSelectedZone('All Zones')
    setSelectedStage('All Stage')
    setSelectedUser('All Users')
    setSelectedProductType('All Product Types')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const hasActiveFilters = searchTerm || selectedZone !== 'All Zones' || selectedStage !== 'All Stage' || selectedUser !== 'All Users' || selectedProductType !== 'All Product Types'

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Calculate statistics
  const stats = {
    total: summary?.totalCount || pagination.total,
    active: summary ? (summary.totalCount - summary.wonCount - summary.lostCount) : offers.filter(o => !['WON', 'LOST'].includes(o.stage)).length,
    won: summary ? summary.wonCount : offers.filter(o => o.stage === 'WON').length,
    lost: summary ? summary.lostCount : offers.filter(o => o.stage === 'LOST').length,
    totalValue: summary ? summary.totalValue : offers.reduce((sum, o) => sum + (Number(o.offerValue) || 0), 0),
    avgValue: summary ? (summary.totalCount > 0 ? summary.totalValue / summary.totalCount : 0) : (offers.length > 0 ? offers.reduce((sum, o) => sum + (Number(o.offerValue) || 0), 0) / offers.filter(o => o.offerValue).length : 0),
    conversionRate: (summary?.totalCount || pagination.total) > 0 ? (((summary ? summary.wonCount : offers.filter(o => o.stage === 'WON').length) / (summary?.totalCount || pagination.total)) * 100) : 0
  }

  return (
    <div className="min-h-screen bg-[#AEBFC3]/10">
      <div className="w-full p-2 sm:p-4 lg:p-4 space-y-6">
        {/* Compact Header with Stats */}
        <OfferStats stats={stats} createPath="/zone/offers/new" />

        {/* Filters */}
        <Card className="border-0 shadow-lg bg-white" style={{backgroundColor: 'white'}}>
          <CardHeader className="bg-white border-b border-[#92A2A5]" style={{backgroundColor: 'white'}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-[#546A7A]" />
                <CardTitle className="text-lg">Search & Filter</CardTitle>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">Active</Badge>
                )}
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#546A7A] hover:text-[#546A7A] hover:bg-[#546A7A]/10">
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 bg-white" style={{backgroundColor: 'white'}}>
            <div className={`grid ${user?.role === UserRole.ZONE_USER ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5'} gap-4`}>
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#4F6A64]" />
                  Search Offers
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-[#979796]" />
                  <Input
                    id="search"
                    placeholder="Search by offer #, customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={loading}
                    className="pl-10 h-11 border-[#92A2A5] focus:border-[#82A094] focus:ring-[#82A094] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Zone Filter - Read-only for ZONE_USER */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#976E44]" />
                  Zone
                </Label>
                {user?.role === UserRole.ZONE_USER ? (
                  <div className="h-11 border border-[#92A2A5] rounded-md px-3 py-2 bg-[#AEBFC3]/10 flex items-center text-[#5D6E73] font-semibold">
                    {(() => {
                      // Try to get zoneId from user.zoneId first
                      let zoneId = user?.zoneId ? parseInt(String(user.zoneId)) : null
                      
                      // If zoneId is null, try to get it from serviceZones
                      if (!zoneId && user?.serviceZones && user.serviceZones.length > 0) {
                        zoneId = user.serviceZones[0]?.serviceZoneId
                      }
                      
                      // Find the zone in the zones array
                      if (zones.length > 0 && zoneId) {
                        const zone = zones.find(z => z.id === zoneId)
                        return zone?.name || 'Loading...'
                      }
                      
                      return zones.length === 0 ? 'Loading...' : 'Zone'
                    })()}
                  </div>
                ) : (
                  <Select value={selectedZone} onValueChange={setSelectedZone} disabled={loading}>
                    <SelectTrigger className="h-11 border-[#92A2A5] focus:border-orange-500 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="All Zones">All Zones</SelectItem>
                      {zones.map(zone => (
                        <SelectItem key={zone.id} value={zone.name}>{zone.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Stage Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#546A7A]" />
                  Stage
                </Label>
                <Select value={selectedStage} onValueChange={setSelectedStage} disabled={loading}>
                  <SelectTrigger className="h-11 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#6F8A9D] disabled:opacity-50 disabled:cursor-not-allowed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {stages.map(stage => (
                      <SelectItem key={stage} value={stage}>{stage.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter - Hidden for ZONE_USER */}
              {user?.role !== UserRole.ZONE_USER && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#4F6A64]" />
                    Created By
                  </Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser} disabled={loading}>
                    <SelectTrigger className="h-11 border-[#92A2A5] focus:border-teal-500 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="All Users">All Users</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name ? `${user.name} (${user.email})` : user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Product Type Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#9E3B47]" />
                  Product Type
                </Label>
                <Select value={selectedProductType} onValueChange={setSelectedProductType} disabled={loading}>
                  <SelectTrigger className="h-11 border-[#92A2A5] focus:border-pink-500 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {productTypes.map(type => (
                      <SelectItem key={type} value={type}>{type === 'All Product Types' ? type : type.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offers Table - Premium Design */}
        <Card className="border-0 shadow-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('offerReferenceNumber')}>
                    <div className="flex items-center gap-1.5">
                      Offer Ref
                      {sortField === 'offerReferenceNumber' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('customer')}>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[#A2B9AF]" />
                      Customer
                      {sortField === 'customer' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('productType')}>
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-[#CE9F6B]" />
                      Type
                      {sortField === 'productType' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('zone')}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#6F8A9D]" />
                      Zone
                      {sortField === 'zone' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('offerValue')}>
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="h-3.5 w-3.5 text-[#82A094]" />
                      Value
                      {sortField === 'offerValue' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('probabilityPercentage')}>
                    <div className="flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-[#CE9F6B]" />
                      Prob
                      {sortField === 'probabilityPercentage' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('stage')}>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-[#6F8A9D]" />
                      Stage
                      {sortField === 'stage' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('createdBy')}>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-cyan-400" />
                      Owner
                      {sortField === 'createdBy' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#5D6E73]/50 transition-colors" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-pink-400" />
                      Date
                      {sortField === 'createdAt' && (
                        <span className="text-[#A2B9AF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/10/30">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="relative">
                          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-lg">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-[#546A7A]">Loading offers...</p>
                          <p className="text-sm text-[#AEBFC3]0 mt-1">Please wait while we fetch the data</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : offers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/10/30">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#AEBFC3]/40 to-[#AEBFC3]/60 flex items-center justify-center">
                          <Package className="h-8 w-8 text-[#AEBFC3]0" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-[#546A7A]">No offers found</p>
                          <p className="text-sm text-[#AEBFC3]0 mt-1">Try adjusting your filters or create a new offer</p>
                        </div>
                        <Button onClick={() => router.push('/zone/offers/new')} className="mt-4 bg-gradient-to-r from-[#82A094] to-[#82A094]">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Offer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedOffers.map((offer: any, index: number) => (
                  <tr 
                    key={offer.id} 
                    className={`
                      ${index % 2 === 0 ? 'bg-white' : 'bg-[#AEBFC3]/10/50'}
                      hover:bg-gradient-to-r hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/10/50 
                      transition-all duration-200 cursor-pointer group
                    `}
                    onClick={() => router.push(`/zone/offers/${offer.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#546A7A] group-hover:text-[#546A7A] text-sm">
                          {offer.offerReferenceNumber}
                        </span>
                        {offer.stage === 'INITIAL' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#96AEC2]/20 text-[#546A7A] rounded">NEW</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#82A094] to-[#82A094] flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
                          {(offer.customer?.companyName || offer.company || 'U')?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#546A7A] text-sm truncate max-w-[160px]">{offer.customer?.companyName || offer.company}</p>
                          {offer.location && <p className="text-xs text-[#979796] truncate max-w-[160px]">{offer.location}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <span className={`
                        inline-flex px-2 py-1 text-xs font-bold rounded-md
                        ${offer.productType === 'SPARE_PARTS' ? 'bg-[#CE9F6B]/20 text-[#976E44]' :
                          offer.productType === 'KARDEX_CONNECT' ? 'bg-[#96AEC2]/20 text-[#546A7A]' :
                          offer.productType === 'CONTRACT' ? 'bg-[#82A094]/20 text-[#4F6A64]' :
                          offer.productType === 'RELOCATION' ? 'bg-[#96AEC2]/20 text-[#546A7A]' :
                          offer.productType === 'UPGRADE_KIT' ? 'bg-[#6F8A9D]/20 text-[#546A7A]' :
                          offer.productType === 'SOFTWARE' ? 'bg-[#546A7A]/20 text-[#546A7A]' :
                          offer.productType === 'OTHERS' ? 'bg-[#CE9F6B]/20 text-[#976E44]' :
                          offer.productType === 'BD_SPARE' ? 'bg-[#EEC1BF]/20 text-[#9E3B47]' :
                          offer.productType === 'RETROFIT_KIT' ? 'bg-[#82A094]/20 text-[#4F6A64]' :
                          'bg-[#AEBFC3]/20 text-[#5D6E73]'}
                      `}>
                        {offer.productType?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[#96AEC2]/100 flex-shrink-0"></div>
                        <span className="text-[#5D6E73] text-sm font-medium">{offer.zone?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {offer.offerValue ? (
                        <span className="font-bold text-[#546A7A]">{formatCurrency(Number(offer.offerValue))}</span>
                      ) : (
                        <span className="text-[#979796] text-sm italic">TBD</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {offer.probabilityPercentage != null ? (
                        <div className="flex items-center gap-1.5">
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                            ${offer.probabilityPercentage >= 70 ? 'bg-gradient-to-br from-[#82A094] to-[#82A094]' :
                              offer.probabilityPercentage >= 40 ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44]' :
                              'bg-gradient-to-br from-red-400 to-[#E17F70]'}`}
                          >
                            {offer.probabilityPercentage}
                          </div>
                          <span className="text-xs text-[#AEBFC3]0">%</span>
                        </div>
                      ) : (
                        <span className="text-[#979796] text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <span className={`
                        inline-flex px-2.5 py-1 text-xs font-bold rounded-full shadow-sm
                        ${offer.stage === 'INITIAL' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white' :
                          offer.stage === 'WON' ? 'bg-gradient-to-r from-[#82A094] to-[#82A094] text-white' :
                          offer.stage === 'LOST' ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white' :
                          offer.stage === 'PROPOSAL_SENT' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white' :
                          offer.stage === 'NEGOTIATION' ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white' :
                          offer.stage === 'FINAL_APPROVAL' ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white' :
                          offer.stage === 'PO_RECEIVED' ? 'bg-gradient-to-r from-[#82A094] to-cyan-600 text-white' :
                          'bg-gradient-to-r from-slate-400 to-[#AEBFC3]/100 text-white'}
                      `}>
                        {offer.stage?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[#5D6E73] font-semibold text-[10px] flex-shrink-0">
                          {offer.createdBy?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="text-[#5D6E73] text-sm truncate max-w-[80px]">{offer.createdBy?.name?.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#AEBFC3]0 text-sm">{new Date(offer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-[#92A2A5]/30 rounded-lg">
                            <MoreHorizontal className="h-4 w-4 text-[#5D6E73]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-xl border-[#92A2A5]">
                          <DropdownMenuItem 
                            onClick={() => router.push(`/zone/offers/${offer.id}`)}
                            className="cursor-pointer rounded-lg"
                          >
                            <Eye className="h-4 w-4 mr-2 text-[#546A7A]" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => router.push(`/zone/offers/${offer.id}/edit`)}
                            className="cursor-pointer rounded-lg"
                          >
                            <Edit className="h-4 w-4 mr-2 text-[#546A7A]" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteOffer(offer.id)}
                            className="text-[#9E3B47] cursor-pointer rounded-lg"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!loading && offers.length > 0 && (
            <div className="bg-gradient-to-r from-[#AEBFC3]/10 via-blue-50 to-[#96AEC2]/10/30 px-6 py-4 border-t border-[#92A2A5]">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[#5D6E73] font-medium">
                  Showing <span className="font-bold text-[#546A7A]">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-semibold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-semibold">{pagination.total}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-50 rounded-xl transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-[#5D6E73] font-medium px-3">
                    Page <span className="font-bold text-[#546A7A]">{pagination.page}</span> of <span className="font-semibold">{pagination.pages}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-50 rounded-xl transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        <EditOfferDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          editingOffer={editingOffer}
        />
      </div>
    </div>
  )
}
