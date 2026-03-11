'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Filter, X } from 'lucide-react';
import { TicketStatus, Priority } from '@/types/ticket';
import { formatEnumValue } from '@/lib/utils';

interface TicketFiltersProps {
  searchParams: {
    status?: string;
    priority?: string;
    search?: string;
    view?: 'all' | 'unassigned' | 'assigned-to-zone' | 'assigned-to-service-person';
  };
}

export default function TicketFilters({ searchParams }: TicketFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(params.toString());
    
    if (value && value !== 'all') {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    
    router.push(`?${newParams.toString()}`);
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams(params.toString());
    newParams.delete('status');
    newParams.delete('priority');
    newParams.delete('search');
    router.push(`?${newParams.toString()}`);
  };

  const hasActiveFilters = searchParams.status || searchParams.priority || searchParams.search;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#979796] h-4 w-4" />
            <Input
              placeholder="Search tickets..."
              value={searchParams.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={searchParams.status || ''}
            onValueChange={(value) => updateFilter('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.values(TicketStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {formatEnumValue(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select
            value={searchParams.priority || ''}
            onValueChange={(value) => updateFilter('priority', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {Object.values(Priority).map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
