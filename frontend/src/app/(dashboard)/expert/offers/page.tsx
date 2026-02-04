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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import dynamic from 'next/dynamic'
import { apiService } from '@/services/api'
import { toast } from 'sonner'

const DynamicOfferStats = dynamic(() => import('@/components/offers/OfferStats'), {
  loading: () => <div className="h-32 w-full animate-pulse bg-gray-100 rounded-2xl mb-6" />,
  ssr: false
})

const DynamicEditOfferDialog = dynamic(() => import('@/components/offers/EditOfferDialog'), {
  ssr: false
})

// Note: PO_RECEIVED leads directly to WON (ORDER_BOOKED stage removed)
const stages = ['All Stage', 'INITIAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'PO_RECEIVED', 'WON', 'LOST']
const productTypes = ['All Product Types', 'RELOCATION', 'CONTRACT', 'SPP', 'UPGRADE_KIT', 'SOFTWARE', 'BD_CHARGES', 'BD_SPARE', 'MIDLIFE_UPGRADE', 'RETROFIT_KIT']

export default function OfferManagement() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  // Initialize all state hooks BEFORE any conditional returns
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
  
  // Protect this page - EXPERT_HELPDESK and ADMIN can access
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login?callbackUrl=' + encodeURIComponent('/expert/offers'))
        return
      }
      if (user?.role !== UserRole.EXPERT_HELPDESK && user?.role !== UserRole.ADMIN) {
        router.push('/expert/dashboard')
        return
      }
    }
  }, [authLoading, isAuthenticated, user?.role, router])

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

  // Don't render if not authenticated or not EXPERT_HELPDESK/ADMIN
  if (!isAuthenticated || (user?.role !== UserRole.EXPERT_HELPDESK && user?.role !== UserRole.ADMIN)) {
    return null
  }

  const fetchZones = async () => {
    try {
      const response = await apiService.getZones()
      const zonesData = response?.data?.zones || response?.zones || response?.data || response || []
      setZones(Array.isArray(zonesData) ? zonesData : [])
    } catch (error: any) {
      console.error('Failed to fetch zones:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch zones')
      setZones([])
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiService.getUsers({ isActive: 'true' })
      // Handle both response formats: { data: { users: [...] } } and direct array
      const usersData = response.data?.users || response.users || response.data || response || []
      const filteredUsers = Array.isArray(usersData) 
        ? usersData.filter((u: any) => u.role === UserRole.ZONE_USER || u.role === UserRole.ZONE_MANAGER)
        : []
      setUsers(filteredUsers)
    } catch (error: any) {
      console.error('Failed to fetch users:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch users')
      setUsers([])
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
        const zid = parseInt(selectedZone)
        if (!isNaN(zid)) params.zoneId = zid
      }
      if (selectedStage !== 'All Stage') params.stage = selectedStage
      if (selectedUser !== 'All Users') {
        params.createdById = parseInt(selectedUser)
      }
      if (selectedProductType !== 'All Product Types') params.productType = selectedProductType

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
        <DynamicOfferStats stats={stats} />

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

              {/* Zone Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#976E44]" />
                  Zone
                </Label>
                <Select value={selectedZone} onValueChange={setSelectedZone} disabled={loading}>
                  <SelectTrigger className="h-11 border-[#92A2A5] focus:border-orange-500 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="All Zones">All Zones</SelectItem>
                    {zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id?.toString?.() ?? String(zone.id)}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* User Filter */}
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
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="relative">
                          <div className="h-16 w-16 rounded-full bg-[#96AEC2]/20 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-[#546A7A]" />
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
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="h-16 w-16 rounded-full bg-[#AEBFC3]/20 flex items-center justify-center">
                          <Package className="h-8 w-8 text-[#979796]" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-[#546A7A]">No offers found</p>
                          <p className="text-sm text-[#AEBFC3]0 mt-1">Try adjusting your filters or create a new offer</p>
                        </div>
                        <Button onClick={() => router.push('/expert/offers/new')} className="mt-4">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Offer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedOffers.map((offer: any) => (
                  <tr key={offer.id} className="border-b border-[#AEBFC3]/20 hover:bg-gradient-to-r hover:from-[#96AEC2]/10/50 hover:via-indigo-50/30 hover:to-[#96AEC2]/10/20 transition-all duration-200 group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/expert/offers/${offer.id}`)}
                          className="text-[#546A7A] hover:text-[#546A7A] font-semibold hover:underline transition-colors"
                        >
                          {offer.offerReferenceNumber}
                        </button>
                        {offer.stage === 'INITIAL' && (
                          <Badge variant="secondary" className="bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]">
                            Initial
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#82A094] via-[#82A094] to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-emerald-100 group-hover:scale-110 transition-transform">
                          {(offer.customer?.companyName || offer.company || 'U')?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#546A7A]">{offer.customer?.companyName || offer.company}</p>
                          <p className="text-xs text-[#AEBFC3]0">{offer.customer?.contactPerson || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={`${
                        offer.productType === 'SPP' ? 'bg-gradient-to-r from-orange-100 to-[#EEC1BF]/10 text-[#976E44] border-[#CE9F6B] shadow-sm' :
                        offer.productType === 'CONTRACT' ? 'bg-gradient-to-r from-emerald-100 to-[#A2B9AF]/10 text-[#4F6A64] border-emerald-300 shadow-sm' :
                        offer.productType === 'RELOCATION' ? 'bg-gradient-to-r from-[#96AEC2]/20 to-[#96AEC2]/10 text-[#546A7A] border-[#96AEC2] shadow-sm' :
                        offer.productType === 'UPGRADE_KIT' ? 'bg-gradient-to-r from-[#96AEC2]/20 to-[#96AEC2]/10 text-[#546A7A] border-[#6F8A9D] shadow-sm' :
                        offer.productType === 'SOFTWARE' ? 'bg-gradient-to-r from-[#96AEC2]/20 to-[#96AEC2]/10 text-[#546A7A] border-indigo-300 shadow-sm' :
                        offer.productType === 'BD_CHARGES' ? 'bg-gradient-to-r from-amber-100 to-[#EEC1BF]/10 text-[#976E44] border-amber-300 shadow-sm' :
                        offer.productType === 'BD_SPARE' ? 'bg-gradient-to-r from-rose-100 to-[#EEC1BF]/10 text-[#75242D] border-rose-300 shadow-sm' :
                        offer.productType === 'MIDLIFE_UPGRADE' ? 'bg-gradient-to-r from-cyan-100 to-[#96AEC2]/10 text-[#546A7A] border-cyan-300 shadow-sm' :
                        offer.productType === 'RETROFIT_KIT' ? 'bg-gradient-to-r from-teal-100 to-[#A2B9AF]/10 text-[#4F6A64] border-teal-300 shadow-sm' :
                        'bg-gradient-to-r from-gray-100 to-gray-50 text-[#546A7A] border-[#92A2A5] shadow-sm'
                      } font-semibold px-3 py-1`}>
                        {offer.productType?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#96AEC2]/100"></div>
                        <span className="text-[#546A7A] font-medium">{offer.zone?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {offer.offerValue ? (
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-[#82A094]/20 flex items-center justify-center">
                            <IndianRupee className="h-4 w-4 text-[#4F6A64]" />
                          </div>
                          <span className="text-[#546A7A] font-bold text-lg">{formatCurrency(Number(offer.offerValue))}</span>
                        </div>
                      ) : (
                        offer.stage === 'INITIAL' ? (
                          <Badge variant="outline" className="text-[#AEBFC3]0 border-dashed">TBD</Badge>
                        ) : (
                          <span className="text-[#979796]">-</span>
                        )
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={`${
                        offer.stage === 'INITIAL' ? 'bg-gradient-to-r from-[#96AEC2]/20 to-[#96AEC2]/10 text-[#546A7A] border-[#96AEC2] shadow-sm' :
                        offer.stage === 'WON' ? 'bg-gradient-to-r from-emerald-100 to-[#A2B9AF]/10 text-[#4F6A64] border-emerald-300 shadow-sm' :
                        offer.stage === 'LOST' ? 'bg-gradient-to-r from-red-100 to-red-50 text-[#75242D] border-[#E17F70] shadow-sm' :
                        offer.stage === 'PROPOSAL_SENT' ? 'bg-gradient-to-r from-[#96AEC2]/20 to-[#96AEC2]/10 text-[#546A7A] border-[#6F8A9D] shadow-sm' :
                        offer.stage === 'NEGOTIATION' ? 'bg-gradient-to-r from-amber-100 to-[#EEC1BF]/10 text-[#976E44] border-amber-300 shadow-sm' :
                        offer.stage === 'PO_RECEIVED' ? 'bg-gradient-to-r from-[#96AEC2]/20 to-[#96AEC2]/10 text-[#546A7A] border-indigo-300 shadow-sm' :
                        'bg-gradient-to-r from-slate-100 to-[#AEBFC3]/10 text-[#546A7A] border-[#92A2A5] shadow-sm'
                      } font-semibold px-3 py-1.5`}>
                        {offer.stage?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[#5D6E73] font-semibold text-xs">
                          {offer.createdBy?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="text-[#5D6E73] font-medium">{offer.createdBy?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[#5D6E73]">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium">{new Date(offer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="hover:bg-gradient-to-r hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/10 transition-all rounded-xl">
                            <MoreHorizontal className="h-4 w-4 text-[#5D6E73]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-[#92A2A5]">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => router.push(`/expert/offers/${offer.id}`)}
                            className="cursor-pointer rounded-lg hover:bg-[#96AEC2]/10"
                          >
                            <Eye className="h-4 w-4 mr-2 text-[#546A7A]" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => router.push(`/expert/offers/${offer.id}/edit`)}
                            className="cursor-pointer rounded-lg hover:bg-[#6F8A9D]/10"
                          >
                            <Edit className="h-4 w-4 mr-2 text-[#546A7A]" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteOffer(offer.id)}
                            className="text-[#9E3B47] cursor-pointer rounded-lg hover:bg-[#E17F70]/10"
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

        {/* Edit Dialog */}
        <DynamicEditOfferDialog 
          open={showEditDialog} 
          onOpenChange={setShowEditDialog} 
          editingOffer={editingOffer} 
        />
      </div>
    </div>
  )
}
