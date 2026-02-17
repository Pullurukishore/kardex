'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Activity,
  Clock,
  User,
  FileText,
  Pencil as EditIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  LogIn,
  LogOut,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  Globe,
  Monitor,
  Filter,
  Search,
  UserPlus,
  Ticket,
  MapPin,
  Wrench,
  Package,
  MessageSquare,
  Box
} from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import { format, formatDistanceToNow, subDays } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Activity {
  id: number
  action: string
  actionLabel: string
  actionColor: string
  entityType: string | null
  entityId: number | null
  description: string
  details: any
  ipAddress: string | null
  userAgent: string | null
  deviceInfo: string | null
  module: string | null
  performedBy: {
    id: number
    name: string | null
    email: string
    role: string | null
  } | null
  ticket: {
    id: number
    ticketNumber: number | null
    title: string
  } | null
  createdAt: string
}

interface Stats {
  totalActivities: number
  loginsToday: number
  ticketUpdatesToday: number
  statusChangesToday: number
  activeUsersToday: number
}

interface FilterUser {
  id: number
  name: string | null
  email: string
  role: string | null
}

// Activity action configuration with icons and colors
const ACTION_CONFIG: Record<string, {
  icon: any
  color: string
  bgColor: string
}> = {
  'USER_LOGIN': { icon: LogIn, color: 'text-[#4F6A64]', bgColor: 'bg-[#A2B9AF]/20' },
  'USER_LOGOUT': { icon: LogOut, color: 'text-[#5D6E73]', bgColor: 'bg-[#AEBFC3]/20' },
  'LOGIN_FAILED': { icon: XCircle, color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/20' },
  'TICKET_CREATED': { icon: Ticket, color: 'text-[#4F6A64]', bgColor: 'bg-[#A2B9AF]/20' },
  'TICKET_UPDATED': { icon: EditIcon, color: 'text-[#546A7A]', bgColor: 'bg-[#96AEC2]/20' },
  'STATUS_CHANGE': { icon: TrendingUp, color: 'text-[#976E44]', bgColor: 'bg-[#CE9F6B]/20' },
  'TICKET_ASSIGNED': { icon: UserPlus, color: 'text-[#546A7A]', bgColor: 'bg-[#6F8A9D]/20' },
  'TICKET_ESCALATED': { icon: AlertTriangle, color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/20' },
  'PO_REQUESTED': { icon: Package, color: 'text-[#976E44]', bgColor: 'bg-[#CE9F6B]/20' },
  'PO_APPROVED': { icon: CheckCircle, color: 'text-[#4F6A64]', bgColor: 'bg-[#A2B9AF]/20' },
  'NOTE_ADDED': { icon: MessageSquare, color: 'text-[#546A7A]', bgColor: 'bg-[#96AEC2]/20' },
  'SCHEDULED': { icon: Calendar, color: 'text-[#976E44]', bgColor: 'bg-[#CE9F6B]/20' },
  'REPORT_UPLOADED': { icon: FileText, color: 'text-[#546A7A]', bgColor: 'bg-[#96AEC2]/20' },
  'ONSITE_VISIT_STARTED': { icon: MapPin, color: 'text-[#546A7A]', bgColor: 'bg-[#6F8A9D]/20' },
  'ONSITE_VISIT_REACHED': { icon: MapPin, color: 'text-[#4F6A64]', bgColor: 'bg-[#A2B9AF]/20' },
  'ONSITE_VISIT_COMPLETED': { icon: CheckCircle, color: 'text-[#4F6A64]', bgColor: 'bg-[#A2B9AF]/20' },
  'TICKET_CLOSED': { icon: CheckCircle, color: 'text-[#4F6A64]', bgColor: 'bg-[#A2B9AF]/20' },
  'UPDATE_SPARE_PARTS_STATUS': { icon: Box, color: 'text-[#546A7A]', bgColor: 'bg-[#96AEC2]/20' },
  'ASSIGNMENT_ACCEPTED': { icon: CheckCircle, color: 'text-[#4F6A64]', bgColor: 'bg-[#A2B9AF]/20' },
  'ASSIGNMENT_REJECTED': { icon: XCircle, color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/20' },
}

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
]

const ACTION_FILTERS = [
  { value: 'all', label: 'All Actions' },
  { value: 'USER_LOGIN,USER_LOGOUT', label: 'Login/Logout' },
  { value: 'TICKET_CREATED', label: 'Ticket Created' },
  { value: 'TICKET_UPDATED', label: 'Ticket Updated' },
  { value: 'STATUS_CHANGE', label: 'Status Changes' },
  { value: 'TICKET_ASSIGNED,ASSIGNMENT_ACCEPTED,ASSIGNMENT_REJECTED', label: 'Assignments' },
  { value: 'SCHEDULED,ONSITE_VISIT_STARTED,ONSITE_VISIT_REACHED,ONSITE_VISIT_COMPLETED', label: 'Onsite Visits' },
  { value: 'PO_REQUESTED,PO_APPROVED', label: 'PO Actions' },
  { value: 'NOTE_ADDED', label: 'Notes' },
  { value: 'REPORT_UPLOADED', label: 'Reports' },
  { value: 'TICKET_CLOSED', label: 'Closures' },
]

export default function TicketActivityLogPage() {
  const router = useRouter()

  const [activities, setActivities] = useState<Activity[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<FilterUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set())

  // Filters
  const [dateFilter, setDateFilter] = useState('7days')
  const [actionFilter, setActionFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })

  const fetchActivities = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      else setRefreshing(true)

      // Build params
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      }

      // Date filter
      if (dateFilter === 'today') {
        params.startDate = format(new Date(), 'yyyy-MM-dd')
      } else if (dateFilter === '7days') {
        params.startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd')
      } else if (dateFilter === '30days') {
        params.startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      }

      // Action filter
      if (actionFilter !== 'all') {
        params.action = actionFilter
      }

      // User filter
      if (userFilter !== 'all') {
        params.userId = userFilter
      }

      // Search
      if (searchQuery) {
        params.search = searchQuery
      }

      const response = await apiService.getTicketActivityLogs(params)

      if (response.success) {
        setActivities(response.activities || [])
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0,
          pages: response.pagination?.pages || 0
        }))
      }
    } catch (error: any) {
      console.error('Failed to fetch activities:', error)
      toast.error('Failed to load activity log')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [pagination.page, pagination.limit, dateFilter, actionFilter, userFilter, searchQuery])

  const fetchStats = async () => {
    try {
      const response = await apiService.getTicketActivityStats()
      if (response.success) {
        setStats(response.stats)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiService.getActivityLogUsers()
      if (response.success) {
        setUsers(response.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  useEffect(() => {
    fetchActivities()
    fetchStats()
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const handleRefresh = () => {
    fetchActivities(false)
    fetchStats()
  }

  const toggleActivity = (activityId: number) => {
    const newExpanded = new Set(expandedActivities)
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId)
    } else {
      newExpanded.add(activityId)
    }
    setExpandedActivities(newExpanded)
  }

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || {
      icon: Activity,
      color: 'text-[#5D6E73]',
      bgColor: 'bg-[#AEBFC3]/20'
    }
  }

  const renderActivityDetails = (activity: Activity) => {
    const config = getActionConfig(activity.action)
    const ActionIcon = config.icon
    const isExpanded = expandedActivities.has(activity.id)
    const hasDetails = activity.details && Object.keys(activity.details).length > 0

    return (
      <div key={activity.id} className="group">
        <div
          className={`flex items-start gap-4 p-4 rounded-xl border bg-white hover:shadow-md hover:border-[#979796]/50 transition-all ${hasDetails ? 'cursor-pointer' : ''
            }`}
          onClick={() => hasDetails && toggleActivity(activity.id)}
        >
          {/* Icon */}
          <div className={`${config.bgColor} ${config.color} p-3 rounded-xl shrink-0`}>
            <ActionIcon className="h-5 w-5" />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[#546A7A]">{activity.actionLabel}</h3>
                  {activity.ticket && (
                    <Badge variant="outline" className="text-xs font-mono">
                      #{activity.ticket.ticketNumber || activity.ticket.id}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-[#5D6E73] mb-2">{activity.description}</p>

                {/* User info */}
                {activity.performedBy && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white font-semibold text-xs">
                      {(activity.performedBy.name || activity.performedBy.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-[#5D6E73]">
                      {activity.performedBy.name || activity.performedBy.email}
                    </span>
                    {activity.performedBy.role && (
                      <Badge variant="secondary" className="text-xs">
                        {activity.performedBy.role.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Device info for login/logout */}
                {(activity.action === 'USER_LOGIN' || activity.action === 'USER_LOGOUT') && activity.deviceInfo && (
                  <div className="flex items-center gap-4 text-xs text-[#92A2A5]">
                    <span className="flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      {activity.deviceInfo}
                    </span>
                    {activity.ipAddress && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {activity.ipAddress}
                      </span>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-[#92A2A5] mt-2">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(activity.createdAt), 'dd MMM yyyy, hh:mm a')}</span>
                  <span className="text-[#AEBFC3]">•</span>
                  <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                </div>
              </div>

              {hasDetails && (
                <Button variant="ghost" size="sm" className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {/* Expanded Details */}
            {isExpanded && hasDetails && (
              <div className="mt-4 pt-4 border-t">
                <div className="p-3 bg-[#AEBFC3]/10 rounded-lg">
                  <pre className="text-xs text-[#5D6E73] overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(activity.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#546A7A] mb-4" />
          <p className="text-[#5D6E73]">Loading activity log...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10">
      <div className="container mx-auto py-8 px-4">
        {/* Premium Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/dashboard')}
            className="mb-4 hover:bg-white/80 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Ticket className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    Ticket Activity Log
                  </h1>
                  <p className="text-[#96AEC2] mt-1">
                    Complete audit trail of all ticket activities and user sessions
                  </p>
                </div>
              </div>

              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={refreshing}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white overflow-hidden">
              <CardContent className="pt-6 relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-[#96AEC2] mb-1">Total Activities</p>
                    <p className="text-3xl font-bold">{stats.totalActivities.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Activity className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-[#4F6A64] to-[#4F6A64] text-white overflow-hidden">
              <CardContent className="pt-6 relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-[#A2B9AF] mb-1">Logins Today</p>
                    <p className="text-3xl font-bold">{stats.loginsToday}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <LogIn className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white overflow-hidden">
              <CardContent className="pt-6 relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-[#96AEC2] mb-1">Ticket Updates</p>
                    <p className="text-3xl font-bold">{stats.ticketUpdatesToday}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Ticket className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-[#976E44] to-[#CE9F6B] text-white overflow-hidden">
              <CardContent className="pt-6 relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-amber-100 mb-1">Status Changes</p>
                    <p className="text-3xl font-bold">{stats.statusChangesToday}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white overflow-hidden">
              <CardContent className="pt-6 relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-[#A2B9AF] mb-1">Active Users</p>
                    <p className="text-3xl font-bold">{stats.activeUsersToday}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <User className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#92A2A5]" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[150px]">
                  <Calendar className="h-4 w-4 mr-2 text-[#92A2A5]" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FILTERS.map(filter => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Action Filter */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2 text-[#92A2A5]" />
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_FILTERS.map(filter => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* User Filter */}
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[180px]">
                  <User className="h-4 w-4 mr-2 text-[#92A2A5]" />
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/5">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#546A7A]" />
              Activity Timeline
            </CardTitle>
            <CardDescription>
              Showing {activities.length} of {pagination.total} activities
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {activities.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#AEBFC3]/20 rounded-full mb-4">
                  <Activity className="h-8 w-8 text-[#979796]" />
                </div>
                <h3 className="text-lg font-medium text-[#546A7A] mb-2">No activities found</h3>
                <p className="text-[#5D6E73] max-w-md mx-auto">
                  Try adjusting your filters or check back later for new activity.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative">
                    {/* Timeline connector */}
                    {index !== activities.length - 1 && (
                      <div className="absolute left-[26px] top-[60px] w-0.5 h-full bg-[#92A2A5]/30 -z-10" />
                    )}
                    {renderActivityDetails(activity)}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <p className="text-sm text-[#5D6E73]">
                  Page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.pages}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.pages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
