'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Search, 
  MoreHorizontal, 
  Pencil as Edit, 
  Plus,
  Loader2,
  Eye,
  Building2,
  TrendingUp,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X,
  AlertCircle,
  Clock,
  Users,
  Wrench,
  Calendar,
  Flag,
  Ticket,
  Shield,
  Headphones,
  Download
} from 'lucide-react'
import Link from 'next/link'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { TICKET_STATUSES, TICKET_PRIORITIES, getStatusStyle, getPriorityStyle } from '@/lib/constants/tickets'
import dynamic from 'next/dynamic'

const TicketListFilters = dynamic(() => import('./TicketListFilters'), {
  loading: () => <div className="h-32 w-full bg-white/50 animate-pulse rounded-xl" />
})

const TicketTableActions = dynamic(() => import('./TicketTableActions'), {
  ssr: false
})

interface TicketsListPageProps {
  role: UserRole;
  basePath: string;
  showZoneFilter?: boolean;
  showViews?: boolean;
  customParams?: any;
  detailPathSuffix?: string;
}

// Default filter values
const FILTER_DEFAULTS = {
  page: '1',
  search: '',
  zone: 'All Zones',
  status: 'All Status',
  priority: 'All Priority',
  view: 'All',
}

export default function TicketsListPage({ 
  role, 
  basePath, 
  showZoneFilter = false, 
  showViews = false,
  customParams = {},
  detailPathSuffix = '/list'
}: TicketsListPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  const [tickets, setTickets] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 0 })
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [summary, setSummary] = useState<any>(null)
  const LIMIT = 100

  // --- Read state from URL (single source of truth) ---
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const searchTerm = searchParams.get('search') || ''
  const selectedZone = searchParams.get('zone') || 'All Zones'
  const selectedStatus = searchParams.get('status') || 'All Status'
  const selectedPriority = searchParams.get('priority') || 'All Priority'
  const selectedView = searchParams.get('view') || 'All'

  // --- URL update helper (replace so filter changes don't pollute history) ---
  const updateUrl = useCallback((updates: Record<string, string>) => {
    const current = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      const defaultVal = (FILTER_DEFAULTS as any)[key]
      if (value === defaultVal || !value) {
        current.delete(key)
      } else {
        current.set(key, value)
      }
    }
    const qs = current.toString()
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false })
  }, [searchParams, router, pathname])

  const hasActiveFilters = useMemo(() =>
    !!(searchTerm ||
      selectedZone !== 'All Zones' ||
      selectedStatus !== 'All Status' ||
      selectedPriority !== 'All Priority' ||
      selectedView !== 'All'),
    [searchTerm, selectedZone, selectedStatus, selectedPriority, selectedView]
  )

  // --- Debounced local search input (to avoid URL spam while typing) ---
  const [localSearch, setLocalSearch] = useState(searchTerm)
  // Sync localSearch when URL changes (e.g. back button)
  useEffect(() => { setLocalSearch(searchTerm) }, [searchTerm])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localSearch !== searchTerm) {
        updateUrl({ search: localSearch, page: '1' })
      }
    }, 400)
    return () => clearTimeout(timeoutId)
  }, [localSearch])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const params: any = {
        page: currentPage,
        limit: LIMIT,
        ...customParams
      }
      
      if (searchTerm) params.search = searchTerm
      if (selectedZone !== 'All Zones') {
        const zid = parseInt(selectedZone)
        if (!isNaN(zid)) params.zoneId = zid
      }
      if (selectedStatus !== 'All Status') params.status = selectedStatus
      if (selectedPriority !== 'All Priority') params.priority = selectedPriority
      
      if (showViews) {
        if (selectedView === 'Unassigned') params.view = 'unassigned'
        if (selectedView === 'Assigned to Zone') params.view = 'assigned-to-zone'
        if (selectedView === 'Assigned to Service Person') params.view = 'assigned-to-service-person'
        if (selectedView === 'Assigned to Zone Manager') params.view = 'assigned-to-zone-manager'
        if (selectedView === 'Assigned to Expert Helpdesk') params.view = 'assigned-to-expert-helpdesk'
      }

      const response = await apiService.getTickets(params)
      setTickets(response.data || [])
      const pg = response.pagination || { page: 1, limit: LIMIT, total: 0, totalPages: 0 }
      setPaginationMeta({ total: pg.total, totalPages: pg.totalPages })
      if (response.summary) setSummary(response.summary)
    } catch (error: any) {
      console.error('Failed to fetch tickets:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch tickets')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    fetchTickets()
  }, [searchTerm, selectedZone, selectedStatus, selectedPriority, selectedView, currentPage, authLoading, isAuthenticated])

  useEffect(() => {
    if (showZoneFilter && isAuthenticated) {
      const loadZones = async () => {
        try {
          const response = await apiService.getZones()
          const zonesData = response?.data?.zones || response?.zones || response?.data || response || []
          setZones(Array.isArray(zonesData) ? zonesData : [])
        } catch (error) {
          console.error('Failed to fetch zones:', error)
        }
      }
      loadZones()
    }
  }, [showZoneFilter, isAuthenticated])

  const clearFilters = () => {
    setLocalSearch('')
    router.replace(pathname, { scroll: false })
  }

  const sortedTickets = useMemo(() => {
    if (!sortField) return tickets
    return [...tickets].sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]
      if (sortField === 'customer') {
        aValue = a.customer?.companyName || ''
        bValue = b.customer?.companyName || ''
      } else if (sortField === 'zone') {
        aValue = a.zone?.name || ''
        bValue = b.zone?.name || ''
      } else if (sortField === 'assignedTo') {
        aValue = a.assignedTo?.name || ''
        bValue = b.assignedTo?.name || ''
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [tickets, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // --- Filter change handlers (reset to page 1 on filter change) ---
  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
  }
  const handleZoneChange = (value: string) => {
    updateUrl({ zone: value, page: '1' })
  }
  const handleStatusChange = (value: string) => {
    updateUrl({ status: value, page: '1' })
  }
  const handlePriorityChange = (value: string) => {
    updateUrl({ priority: value, page: '1' })
  }
  const handleViewChange = (value: string) => {
    updateUrl({ view: value, page: '1' })
  }
  const handlePageChange = (page: number) => {
    updateUrl({ page: page.toString() })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // --- Pagination page numbers ---
  const getPageNumbers = () => {
    const total = paginationMeta.totalPages
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    
    const pages: (number | 'ellipsis')[] = []
    pages.push(1)
    
    if (currentPage > 3) pages.push('ellipsis')
    
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(total - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    
    if (currentPage < total - 2) pages.push('ellipsis')
    
    if (total > 1) pages.push(total)
    return pages
  }

  const stats = {
    total: paginationMeta.total,
    open: summary ? summary.open : tickets.filter(t => t.status === 'OPEN').length,
    active: summary ? summary.active : tickets.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'ONSITE_VISIT_PLANNED', 'ONSITE_VISIT'].includes(t.status)).length,
    closed: summary ? summary.closed : tickets.filter(t => ['CLOSED', 'CLOSED_PENDING'].includes(t.status)).length,
    critical: summary ? summary.critical : tickets.filter(t => t.priority === 'CRITICAL').length,
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-[#9E3B47] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#AEBFC3]/10">
      <div className="w-full p-2 sm:p-3 lg:p-4 space-y-6">
        {/* Compact Header with Stats */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#9E3B47] via-[#E17F70] to-[#6F8A9D] rounded-2xl shadow-xl p-4 sm:p-6 text-white">
          <div className="relative z-10 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 bg-white/25 backdrop-blur-sm rounded-xl ring-2 ring-white/40 shadow-lg">
                <Ticket className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold drop-shadow-md">Support Tickets</h1>
                <p className="text-white/90 text-sm sm:text-base mt-1">Manage and track all support tickets</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 text-center">
                <div className="bg-white/20 backdrop-blur-md rounded-lg p-2 border border-white/30">
                  <p className="text-white/90 text-[10px] sm:text-xs">Total</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="bg-[#CE9F6B]/40 backdrop-blur-md rounded-lg p-2 border border-white/30">
                  <p className="text-white/90 text-[10px] sm:text-xs">Open</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.open}</p>
                </div>
                <div className="bg-[#6F8A9D]/40 backdrop-blur-md rounded-lg p-2 border border-white/30">
                  <p className="text-white/90 text-[10px] sm:text-xs">Active</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.active}</p>
                </div>
                <div className="bg-[#82A094]/40 backdrop-blur-md rounded-lg p-2 border border-white/30 hidden sm:block">
                  <p className="text-white/90 text-[10px] sm:text-xs">Closed</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.closed}</p>
                </div>
                <div className="bg-[#75242D]/50 backdrop-blur-md rounded-lg p-2 border border-white/30 hidden sm:block">
                  <p className="text-white/90 text-[10px] sm:text-xs">Critical</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.critical}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {role === UserRole.ADMIN && (
                  <Button onClick={() => router.push(`${basePath}/import`)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 shadow-lg font-semibold">
                    <Download className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                )}
                <Button onClick={() => router.push(`${basePath}/create`)} className="bg-white text-[#9E3B47] hover:bg-[#EEC1BF] hover:text-[#75242D] shadow-lg font-semibold">
                  <Plus className="h-4 w-4 mr-2" />
                  New Ticket
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        {showViews && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { id: 'All', label: 'All', icon: AlertCircle, color: 'bg-[#546A7A] hover:bg-[#5D6E73]' },
              { id: 'Unassigned', label: 'Unassigned', icon: Clock, color: 'bg-[#CE9F6B] hover:bg-[#976E44]' },
              { id: 'Assigned to Zone', label: 'Zone', icon: Users, color: 'bg-[#96AEC2] hover:bg-[#6F8A9D]' },
              { id: 'Assigned to Service Person', label: 'Service', icon: Wrench, color: 'bg-[#82A094] hover:bg-[#4F6A64]' },
              { id: 'Assigned to Zone Manager', label: 'Manager', icon: Shield, color: 'bg-[#6F8A9D] hover:bg-[#546A7A]' },
              { id: 'Assigned to Expert Helpdesk', label: 'Expert', icon: Headphones, color: 'bg-[#92A2A5] hover:bg-[#757777]' }
            ].map(tab => (
              <Button
                key={tab.id}
                variant={selectedView === tab.id ? 'default' : 'outline'}
                onClick={() => handleViewChange(tab.id)}
                className={`flex-shrink-0 text-xs sm:text-sm ${selectedView === tab.id ? tab.color : 'hover:bg-[#96AEC2]/10'}`}
              >
                <tab.icon className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {tab.label}
              </Button>
            ))}
          </div>
        )}

        <TicketListFilters 
          searchTerm={localSearch}
          setSearchTerm={handleSearchChange}
          selectedZone={selectedZone}
          setSelectedZone={handleZoneChange}
          selectedStatus={selectedStatus}
          setSelectedStatus={handleStatusChange}
          selectedPriority={selectedPriority}
          setSelectedPriority={handlePriorityChange}
          zones={zones}
          showZoneFilter={showZoneFilter}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          loading={loading}
        />

        {/* Table */}
        <Card className="border-0 shadow-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-[#75242D] via-[#9E3B47] to-[#546A7A] text-white">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => handleSort('id')}>
                    Ticket # {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => handleSort('title')}>
                    Title {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => handleSort('customer')}>
                    Customer {sortField === 'customer' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                    Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => handleSort('priority')}>
                    Priority {sortField === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => handleSort('assignedTo')}>
                    Assigned {sortField === 'assignedTo' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  {(role === UserRole.ZONE_USER || role === UserRole.ZONE_MANAGER || role === UserRole.ADMIN || role === UserRole.EXPERT_HELPDESK) && (
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Response</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => handleSort('createdAt')}>
                    Created {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-[#9E3B47]" />
                        <p className="mt-2 text-[#546A7A] font-semibold">Loading tickets...</p>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <Ticket className="h-12 w-12 text-[#AEBFC3] mx-auto mb-4" />
                      <p className="text-lg font-semibold text-[#546A7A]">No tickets found</p>
                    </td>
                  </tr>
                ) : (
                  sortedTickets.map((ticket: any) => (
                    <tr key={ticket.id} className="hover:bg-red-50/30 transition-colors group">
                      <td className="px-4 py-3">
                        <Link href={`${basePath}/${ticket.id}${detailPathSuffix}`} className="font-mono font-bold text-[#9E3B47] hover:underline text-sm">
                          #{ticket.ticketNumber ?? ticket.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <p className="font-semibold text-[#546A7A] text-sm">{ticket.title}</p>
                        {ticket.description && <p className="text-xs text-[#979796] truncate max-w-[200px]">{ticket.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#546A7A] text-sm">{ticket.customer?.companyName || 'N/A'}</p>
                        <p className="text-[10px] text-[#979796]">{ticket.zone?.name || 'No Zone'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full shadow-sm text-white ${getStatusStyle(ticket.status)}`}>
                          {ticket.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-md border ${getPriorityStyle(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          try {
                            const metadata = ticket.relatedMachineIds ? JSON.parse(ticket.relatedMachineIds) : {};
                            const teamMembers = metadata.teamMembers || [];
                            
                            if (teamMembers.length > 0) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  {teamMembers.map((name: string, idx: number) => (
                                    <span key={idx} className={`${idx === 0 ? 'text-[#5D6E73] font-medium text-sm' : 'text-[#979796] text-[10px]'} flex items-center`}>
                                      {idx > 0 && <Plus className="h-2 w-2 mr-1 flex-shrink-0" />}
                                      {name.split(' ')[0]}
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                          } catch (e) {
                            // Fallback to normal display if metadata is missing or invalid
                          }

                          return (
                            <div className="flex flex-col gap-0.5">
                              {ticket.assignedTo ? (
                                <span className="text-[#5D6E73] text-sm font-medium">{ticket.assignedTo.name?.split(' ')[0]}</span>
                              ) : (
                                <span className="text-[#979796] text-xs italic">Unassigned</span>
                              )}
                              {ticket.subOwner && (
                                <span className="text-[#979796] text-[10px] flex items-center">
                                  <Plus className="h-2 w-2 mr-1" />
                                  {ticket.subOwner.name?.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      {(role === UserRole.ZONE_USER || role === UserRole.ZONE_MANAGER || role === UserRole.ADMIN || role === UserRole.EXPERT_HELPDESK) && (
                        <td className="px-4 py-3">
                          {ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' || ticket.assignmentStatus === 'ACCEPTED' ? (
                            <Badge className="bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094] text-[10px] px-2 py-0.5">✓ Accepted</Badge>
                          ) : ticket.assignmentStatus === 'PENDING' ? (
                            <Badge className="bg-[#CE9F6B]/20 text-[#976E44] border-amber-300 text-[10px] px-2 py-0.5 animate-pulse">Pending</Badge>
                          ) : ticket.assignmentStatus === 'REJECTED' ? (
                            <Badge className="bg-[#E17F70]/20 text-[#75242D] border-[#E17F70] text-[10px] px-2 py-0.5">✗ Rejected</Badge>
                          ) : (
                            <span className="text-[#979796] text-xs">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="text-[#AEBFC3]0 text-xs">{ticket.createdAt ? format(new Date(ticket.createdAt), 'dd MMM') : '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TicketTableActions 
                          ticketId={ticket.id} 
                          basePath={basePath} 
                          detailPathSuffix={detailPathSuffix} 
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Enhanced Pagination */}
          {!loading && tickets.length > 0 && (
            <div className="bg-gradient-to-r from-[#AEBFC3]/10 via-white to-[#96AEC2]/10 px-4 sm:px-6 py-4 border-t border-[#92A2A5]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-[#5D6E73] font-medium">
                  Showing <span className="font-bold text-[#546A7A]">{((currentPage - 1) * LIMIT) + 1}</span> to <span className="font-bold text-[#546A7A]">{Math.min(currentPage * LIMIT, paginationMeta.total)}</span> of <span className="font-bold text-[#546A7A]">{paginationMeta.total}</span> results
                </div>
                <div className="flex items-center gap-1">
                  {/* First Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="h-9 w-9 p-0 hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-40 rounded-lg transition-all"
                    title="First page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  {/* Previous */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-9 w-9 p-0 hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-40 rounded-lg transition-all"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page Numbers */}
                  {getPageNumbers().map((pageNum, idx) =>
                    pageNum === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-[#979796] text-sm select-none">…</span>
                    ) : (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className={`h-9 w-9 p-0 rounded-lg text-sm font-semibold transition-all ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-br from-[#9E3B47] to-[#75242D] text-white shadow-md hover:from-[#75242D] hover:to-[#9E3B47] border-0'
                            : 'hover:bg-[#96AEC2]/15 hover:border-[#96AEC2] text-[#546A7A]'
                        }`}
                      >
                        {pageNum}
                      </Button>
                    )
                  )}

                  {/* Next */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === paginationMeta.totalPages}
                    className="h-9 w-9 p-0 hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-40 rounded-lg transition-all"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {/* Last Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(paginationMeta.totalPages)}
                    disabled={currentPage === paginationMeta.totalPages}
                    className="h-9 w-9 p-0 hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-40 rounded-lg transition-all"
                    title="Last page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
