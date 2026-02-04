'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { 
  Filter, 
  Calendar, 
  User, 
  Building2, 
  Activity, 
  RotateCcw,
  Sparkles,
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ServicePerson, ServiceZone, STATUS_CONFIG } from '@/lib/constants/attendance'

interface AttendanceFiltersProps {
  dateRange: string;
  setDateRange: (v: 'today' | 'yesterday' | 'specific') => void;
  selectedDate: Date | undefined;
  setSelectedDate: (d: Date | undefined) => void;
  selectedUser: string;
  setSelectedUser: (v: string) => void;
  selectedStatus: string;
  setSelectedStatus: (v: string) => void;
  selectedZone: string;
  setSelectedZone: (v: string) => void;
  selectedActivityType: string;
  setSelectedActivityType: (v: string) => void;
  servicePersons: ServicePerson[];
  serviceZones: ServiceZone[];
  statusBreakdown: Record<string, number>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  hasActiveFilters: boolean;
  resetFilters: () => void;
  loading: boolean;
}

export default function AttendanceFilters({
  dateRange,
  setDateRange,
  selectedDate,
  setSelectedDate,
  selectedUser,
  setSelectedUser,
  selectedStatus,
  setSelectedStatus,
  selectedZone,
  setSelectedZone,
  selectedActivityType,
  setSelectedActivityType,
  servicePersons,
  serviceZones,
  statusBreakdown,
  searchQuery,
  setSearchQuery,
  hasActiveFilters,
  resetFilters,
  loading
}: AttendanceFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Quick Status Chips */}
      {!loading && Object.keys(statusBreakdown).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#6F8A9D] uppercase tracking-wider mr-1">Status:</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(statusBreakdown).map(([status, count]) => {
              const config = STATUS_CONFIG[status] || { label: status, color: 'bg-[#AEBFC3]/20 text-[#546A7A]' };
              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(selectedStatus === status ? 'all' : status)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
                    selectedStatus === status 
                      ? 'ring-1 ring-[#6F8A9D] shadow-sm' 
                      : 'opacity-70 hover:opacity-100'
                  } ${config.color}`}
                >
                  {config.label}
                  <span className="bg-black/10 px-1.5 py-0.5 rounded text-[9px] tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
          {hasActiveFilters && (
            <Button
              onClick={resetFilters}
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-[10px] font-bold text-[#9E3B47] hover:bg-[#E17F70]/10 rounded-lg"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Main Filters Card - Compact */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md rounded-2xl hidden md:block border border-[#AEBFC3]/20 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="h-4 w-4 text-[#546A7A]" />
            <span className="text-sm font-bold text-[#546A7A]">Filters</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#6F8A9D] uppercase tracking-wider">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#AEBFC3]" />
                <Input
                  placeholder="Name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm border-[#AEBFC3]/30 rounded-xl bg-white focus:ring-1 focus:ring-[#96AEC2]/30"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#6F8A9D] uppercase tracking-wider">Date</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                <SelectTrigger className="border-[#AEBFC3]/30 rounded-xl h-9 text-sm bg-white focus:ring-1 focus:ring-[#96AEC2]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#AEBFC3]/30 shadow-lg">
                  <SelectItem value="today" className="rounded-lg text-sm">Today</SelectItem>
                  <SelectItem value="yesterday" className="rounded-lg text-sm">Yesterday</SelectItem>
                  <SelectItem value="specific" className="rounded-lg text-sm">Pick a Date</SelectItem>
                </SelectContent>
              </Select>
              {dateRange === 'specific' && (
                <Input
                  type="date"
                  value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : undefined)}
                  className="h-9 text-sm border-[#AEBFC3]/30 rounded-xl bg-white focus:ring-1 focus:ring-[#96AEC2]/30"
                />
              )}
            </div>

            {/* Service Person */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#6F8A9D] uppercase tracking-wider">Person</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="border-[#AEBFC3]/30 rounded-xl h-9 text-sm bg-white focus:ring-1 focus:ring-[#96AEC2]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64 rounded-xl border-[#AEBFC3]/30 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-sm font-medium">All</SelectItem>
                  {servicePersons.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()} className="rounded-lg text-sm">
                      {p.name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#6F8A9D] uppercase tracking-wider">Zone</Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="border-[#AEBFC3]/30 rounded-xl h-9 text-sm bg-white focus:ring-1 focus:ring-[#96AEC2]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#AEBFC3]/30 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-sm font-medium">All</SelectItem>
                  {serviceZones.map((z) => (
                    <SelectItem key={z.id} value={z.id.toString()} className="rounded-lg text-sm">{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#6F8A9D] uppercase tracking-wider">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="border-[#AEBFC3]/30 rounded-xl h-9 text-sm bg-white focus:ring-1 focus:ring-[#96AEC2]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#AEBFC3]/30 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-sm font-medium">All</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key} className="rounded-lg text-sm">{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Activity Type */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#6F8A9D] uppercase tracking-wider">Type</Label>
              <Select value={selectedActivityType} onValueChange={setSelectedActivityType}>
                <SelectTrigger className="border-[#AEBFC3]/30 rounded-xl h-9 text-sm bg-white focus:ring-1 focus:ring-[#96AEC2]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#AEBFC3]/30 shadow-lg max-h-64">
                  <SelectItem value="all" className="rounded-lg text-sm font-medium">All</SelectItem>
                  <SelectItem value="TICKET_WORK" className="rounded-lg text-sm">Ticket Work</SelectItem>
                  <SelectItem value="BD_VISIT" className="rounded-lg text-sm">BD Visit</SelectItem>
                  <SelectItem value="PO_DISCUSSION" className="rounded-lg text-sm">PO Discussion</SelectItem>
                  <SelectItem value="SPARE_REPLACEMENT" className="rounded-lg text-sm">Spare Replacement</SelectItem>
                  <SelectItem value="TRAVEL" className="rounded-lg text-sm">Travel</SelectItem>
                  <SelectItem value="TRAINING" className="rounded-lg text-sm">Training</SelectItem>
                  <SelectItem value="MEETING" className="rounded-lg text-sm">Meeting</SelectItem>
                  <SelectItem value="MAINTENANCE" className="rounded-lg text-sm">Maintenance</SelectItem>
                  <SelectItem value="MAINTENANCE_PLANNED" className="rounded-lg text-sm">Planned Maintenance</SelectItem>
                  <SelectItem value="INSTALLATION" className="rounded-lg text-sm">Installation</SelectItem>
                  <SelectItem value="RELOCATION" className="rounded-lg text-sm">Relocation</SelectItem>
                  <SelectItem value="REVIEW_MEETING" className="rounded-lg text-sm">Review Meeting</SelectItem>
                  <SelectItem value="DOCUMENTATION" className="rounded-lg text-sm">Documentation</SelectItem>
                  <SelectItem value="WORK_FROM_HOME" className="rounded-lg text-sm">Work from Home</SelectItem>
                  <SelectItem value="OTHER" className="rounded-lg text-sm">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
