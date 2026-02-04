'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  Filter, 
  X, 
  RefreshCw, 
  Grid3x3, 
  List 
} from 'lucide-react'
import { SPARE_PART_STATUSES, SPARE_PART_CATEGORIES } from '@/lib/constants/spare-parts'

interface SparePartsFiltersProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  selectedStatus: string;
  setSelectedStatus: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  pageSize: number;
  handlePageSizeChange: (v: number) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (v: 'grid' | 'list') => void;
  clearFilters: () => void;
  total: number;
  showAll: boolean;
  page: number;
}

export default function SparePartsFilters({
  searchTerm,
  setSearchTerm,
  selectedStatus,
  setSelectedStatus,
  selectedCategory,
  setSelectedCategory,
  pageSize,
  handlePageSizeChange,
  viewMode,
  setViewMode,
  clearFilters,
  total,
  showAll,
  page
}: SparePartsFiltersProps) {
  const hasActiveFilters = searchTerm || selectedStatus !== 'All Status' || selectedCategory !== 'All Categories';

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-[#AEBFC3]/10 to-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[#546A7A]" />
            <CardTitle className="text-lg">Search & Filters</CardTitle>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#546A7A] hover:bg-red-50 hover:text-red-600 transition-colors">
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-semibold text-[#5D6E73]">Search Parts</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#979796]" />
              <Input
                id="search"
                placeholder="Search by name or part number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-[#92A2A5] focus:border-[#6F8A9D] transition-all"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#5D6E73]">Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-11 border-[#92A2A5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPARE_PART_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#5D6E73]">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-11 border-[#92A2A5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPARE_PART_CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t gap-4">
          <div className="flex items-center gap-4">
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${showAll ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
              {showAll ? `All ${total} items` : `Items ${((page - 1) * pageSize) + 1}-${Math.min(page * pageSize, total)} of ${total}`}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[#5D6E73] font-bold uppercase tracking-wider">Per page</Label>
              <Select value={showAll ? "9999" : pageSize.toString()} onValueChange={(val) => handlePageSizeChange(Number(val))}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="9999">✨ All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 border border-[#92A2A5] rounded-xl p-1 bg-white shadow-sm">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 rounded-lg"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 rounded-lg"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters} className="h-10 rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
