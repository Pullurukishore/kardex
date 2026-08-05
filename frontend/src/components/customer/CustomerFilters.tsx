'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface CustomerFiltersProps {
  search?: string;
  status?: string;
  hasAssets?: string;
  totalResults: number;
  filteredResults: number;
}

export default function CustomerFilters({
  search = '',
  status = 'all',
  hasAssets = 'true',
  totalResults,
  filteredResults
}: CustomerFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);
  const [statusValue, setStatusValue] = useState(status);
  const [hasAssetsValue, setHasAssetsValue] = useState(hasAssets || searchParams.get('hasAssets') || 'true');

  // Custom debounce hook
  const useDebounce = (callback: Function, delay: number) => {
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    const debouncedCallback = useCallback((...args: any[]) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      const newTimer = setTimeout(() => {
        callback(...args);
      }, delay);
      setDebounceTimer(newTimer);
    }, [callback, delay, debounceTimer]);

    return debouncedCallback;
  };

  // Function to update URL parameters
  const updateFilters = useCallback((newSearch: string, newStatus: string, newHasAssets: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update search parameter
    if (newSearch.trim()) {
      params.set('search', newSearch.trim());
    } else {
      params.delete('search');
    }
    
    // Update status parameter
    if (newStatus && newStatus !== 'all') {
      params.set('status', newStatus);
    } else {
      params.delete('status');
    }

    // Update hasAssets parameter
    if (newHasAssets && newHasAssets !== 'all') {
      params.set('hasAssets', newHasAssets);
    } else {
      params.delete('hasAssets');
    }
    
    // Reset to page 1 when filters change
    params.delete('page');
    
    // Navigate with new parameters
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    const pathname = window.location.pathname;
    router.push(`${pathname}${newUrl}`, { scroll: false });
  }, [router, searchParams]);

  // Debounced search function
  const debouncedSearch = useDebounce((searchTerm: string) => {
    updateFilters(searchTerm, statusValue, hasAssetsValue);
  }, 500);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  // Handle status change (immediate)
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStatusValue(value);
    updateFilters(searchValue, value, hasAssetsValue);
  };

  // Handle hasAssets change (immediate)
  const handleHasAssetsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setHasAssetsValue(value);
    updateFilters(searchValue, statusValue, value);
  };

  // Update local state when props change (for browser back/forward)
  useEffect(() => {
    setSearchValue(search);
    setStatusValue(status);
    setHasAssetsValue(searchParams.get('hasAssets') || hasAssets || 'true');
  }, [search, status, hasAssets, searchParams]);

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20 rounded-t-lg">
        <CardTitle className="text-[#546A7A]">Search & Filter</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#979796]" />
              <input
                type="search"
                placeholder="Search customers..."
                value={searchValue}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 border border-[#92A2A5] rounded-md focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D]"
              />
            </div>

            <select
              value={hasAssetsValue}
              onChange={handleHasAssetsChange}
              className="w-full sm:w-[180px] px-3 py-2 border border-[#92A2A5] rounded-md focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] font-medium text-xs text-[#546A7A]"
            >
              <option value="true">With Assets (Hide Dummy)</option>
              <option value="all">All Customers</option>
              <option value="false">0 Assets (Dummy Only)</option>
            </select>
            
            <select
              value={statusValue}
              onChange={handleStatusChange}
              className="w-full sm:w-[140px] px-3 py-2 border border-[#92A2A5] rounded-md focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] text-xs text-[#546A7A]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <div className="text-sm text-[#5D6E73]">
            {filteredResults > 0 && (
              <span>
                Showing <span className="font-semibold">{filteredResults}</span> of{' '}
                <span className="font-semibold">{totalResults}</span> customers
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
