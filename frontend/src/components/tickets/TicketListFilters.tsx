'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Filter, X, Search, MapPin, TrendingUp, Flag } from 'lucide-react'
import { TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/constants/tickets'

interface TicketListFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedZone: string;
  setSelectedZone: (value: string) => void;
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  selectedPriority: string;
  setSelectedPriority: (value: string) => void;
  zones: any[];
  showZoneFilter: boolean;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  loading: boolean;
}

export default function TicketListFilters({
  searchTerm,
  setSearchTerm,
  selectedZone,
  setSelectedZone,
  selectedStatus,
  setSelectedStatus,
  selectedPriority,
  setSelectedPriority,
  zones,
  showZoneFilter,
  hasActiveFilters,
  clearFilters,
  loading
}: TicketListFiltersProps) {
  return (
    <Card className="border-0 shadow-lg bg-white">
      <CardHeader className="bg-white border-b border-[#92A2A5]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[#9E3B47]" />
            <CardTitle className="text-lg font-semibold">Search & Filter</CardTitle>
            {hasActiveFilters && <Badge variant="secondary" className="ml-2">Active</Badge>}
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#9E3B47] hover:text-[#75242D]">
              <X className="h-4 w-4 mr-1" /> Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
              <Search className="h-4 w-4 text-[#9E3B47]" /> Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#979796]" />
              <Input
                placeholder="Search by ticket #, title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-[#92A2A5]"
              />
            </div>
          </div>

          {showZoneFilter && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#976E44]" /> Zone
              </Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="h-11 border-[#92A2A5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Zones">All Zones</SelectItem>
                  {zones.map(zone => (
                    <SelectItem key={zone.id} value={zone.id.toString()}>{zone.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#546A7A]" /> Status
            </Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-11 border-[#92A2A5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
              <Flag className="h-4 w-4 text-[#9E3B47]" /> Priority
            </Label>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="h-11 border-[#92A2A5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map(priority => (
                  <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
