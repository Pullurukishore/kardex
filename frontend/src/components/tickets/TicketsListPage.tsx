'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
  basePath: string; // e.g., "/admin/tickets" or "/expert/tickets"
  showZoneFilter?: boolean;
  showViews?: boolean;
  customParams?: any;
  detailPathSuffix?: string; // e.g., "/list"
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
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  const [tickets, setTickets] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedZone, setSelectedZone] = useState('All Zones')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [selectedPriority, setSelectedPriority] = useState('All Priority')
  const [selectedView, setSelectedView] = useState('All')
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  const hasActiveFilters = useMemo(() => 
    !!(searchTerm || 
    selectedZone !== 'All Zones' || 
    selectedStatus !== 'All Status' || 
    selectedPriority !== 'All Priority' || 
    selectedView !== 'All'),
    [searchTerm, selectedZone, selectedStatus, selectedPriority, selectedView]
  )

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
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
      setPagination(response.pagination || { page: 1, limit: 100, total: 0, totalPages: 0 })
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
    
    const timeoutId = setTimeout(() => {
      fetchTickets()
    }, searchTerm ? 500 : 0)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedZone, selectedStatus, selectedPriority, selectedView, pagination.page, authLoading, isAuthenticated])

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
    setSearchTerm('')
    setSelectedZone('All Zones')
    setSelectedStatus('All Status')
    setSelectedPriority('All Priority')
    setSelectedView('All')
    setPagination(prev => ({ ...prev, page: 1 }))
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

  const stats = {
    total: pagination.total,
    open: tickets.filter(t => t.status === 'OPEN').length,
    inProgress: tickets.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'ONSITE_VISIT_PLANNED', 'ONSITE_VISIT'].includes(t.status)).length,
    closed: tickets.filter(t => ['CLOSED', 'CLOSED_PENDING'].includes(t.status)).length,
    critical: tickets.filter(t => t.priority === 'CRITICAL').length,
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
                  <p className="text-lg sm:text-2xl font-bold">{stats.inProgress}</p>
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
                onClick={() => setSelectedView(tab.id)}
                className={`flex-shrink-0 text-xs sm:text-sm ${selectedView === tab.id ? tab.color : 'hover:bg-[#96AEC2]/10'}`}
              >
                <tab.icon className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {tab.label}
              </Button>
            ))}
          </div>
        )}

        <TicketListFilters 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          selectedPriority={selectedPriority}
          setSelectedPriority={setSelectedPriority}
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
                        <div className="flex items-center gap-2">
                          {ticket.assignedTo ? (
                            <span className="text-[#5D6E73] text-sm">{ticket.assignedTo.name?.split(' ')[0]}</span>
                          ) : (
                            <span className="text-[#979796] text-xs italic">Unassigned</span>
                          )}
                        </div>
                      </td>
                      {(role === UserRole.ZONE_USER || role === UserRole.ZONE_MANAGER || role === UserRole.ADMIN || role === UserRole.EXPERT_HELPDESK) && (
                        <td className="px-4 py-3">
                          {ticket.assignmentStatus === 'PENDING' ? (
                            <Badge className="bg-[#CE9F6B]/20 text-[#976E44] border-amber-300 text-[10px] px-2 py-0.5 animate-pulse">Pending</Badge>
                          ) : ticket.assignmentStatus === 'ACCEPTED' ? (
                            <Badge className="bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094] text-[10px] px-2 py-0.5">✓ Accepted</Badge>
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
          
          {/* Pagination */}
          {!loading && tickets.length > 0 && (
            <div className="px-6 py-4 border-t border-[#92A2A5]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5D6E73]">
                  Showing <span className="font-bold">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-bold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of {pagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages}>
                    <ChevronRight className="h-4 w-4" />
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
