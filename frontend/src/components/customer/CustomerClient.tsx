'use client';

import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api/axios';
import { Customer, CustomerStats as CustomerStatsType } from '@/types/customer';
import { calculateCustomerStats } from '@/lib/utils/customerStats';
import CustomerStats from './CustomerStats';
import CustomerFilters from './CustomerFilters';
import CustomerTable from './CustomerTable';

interface CustomerClientProps {
  initialCustomers: Customer[];
  initialStats: CustomerStatsType;
  searchParams: {
    search?: string;
    status?: string;
    page?: string;
  };
  readOnly?: boolean;
}

const CustomerClient = memo(function CustomerClient({
  initialCustomers,
  initialStats,
  searchParams,
  readOnly = false
}: CustomerClientProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [stats, setStats] = useState<CustomerStatsType>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadComplete = useRef(false);
  const lastSearchParams = useRef<string>('');

  const fetchCustomerData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (searchParams.search) params.append('search', searchParams.search);
      if (searchParams.status && searchParams.status !== 'all') params.append('status', searchParams.status);
      if (searchParams.page) params.append('page', searchParams.page);
      params.append('limit', '25');

      const response = await api.get(`/customers?${params.toString()}`);
      const customerData = response.data || [];
      
      setCustomers(customerData);
      
      // Calculate stats using shared utility function
      const newStats = calculateCustomerStats(customerData);
      setStats(newStats);
      
      return true;
    } catch (err) {
      setError('Failed to load customer data. Please try again.');
      toast.error('Failed to refresh customer data');
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [searchParams]);

  useEffect(() => {
    // Create a string representation of current search params
    const currentSearchParams = JSON.stringify(searchParams);
    
    // Only fetch data if search params have actually changed (not on initial mount)
    if (initialLoadComplete.current && currentSearchParams !== lastSearchParams.current) {
      fetchCustomerData();
    } else if (!initialLoadComplete.current) {
      // Mark initial load as complete without fetching (we already have server-side data)
      initialLoadComplete.current = true;
    }
    
    // Update the last search params reference
    lastSearchParams.current = currentSearchParams;
  }, [searchParams.search, searchParams.status, searchParams.page]);

  const handleRefresh = useCallback(async () => {
    await fetchCustomerData();
  }, [fetchCustomerData]);

  // Memoize customer count to prevent unnecessary recalculations
  const customerCount = useMemo(() => customers.length, [customers.length]);

  // Memoize stats to prevent unnecessary recalculations
  const memoizedStats = useMemo(() => stats, [stats]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10 to-[#6F8A9D]/20 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl w-full text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E17F70]/20">
            <svg className="h-6 w-6 text-[#9E3B47]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-[#546A7A]">Failed to load customers</h3>
          <p className="mt-1 text-sm text-[#AEBFC3]0">{error}</p>
          <div className="mt-6">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#6F8A9D] hover:bg-[#546A7A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#96AEC2]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading skeleton only during actual data fetching (not initial load)
  if (isRefreshing && initialLoadComplete.current) {
    return (
      <div className="space-y-6">
        {/* Loading State */}
        <div className="flex justify-end">
          <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#92A2A5]/30 text-[#AEBFC3]0">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Refreshing...
          </div>
        </div>

        {/* Stats Loading Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
              <div className="h-4 bg-[#92A2A5]/30 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-[#92A2A5]/30 rounded w-1/2"></div>
            </div>
          ))}
        </div>

        {/* Table Loading Skeleton */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex space-x-4">
                  <div className="h-4 bg-[#92A2A5]/30 rounded w-1/4"></div>
                  <div className="h-4 bg-[#92A2A5]/30 rounded w-1/4"></div>
                  <div className="h-4 bg-[#92A2A5]/30 rounded w-1/4"></div>
                  <div className="h-4 bg-[#92A2A5]/30 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${
            isRefreshing 
              ? 'bg-[#92A2A5]/30 text-[#AEBFC3]0 cursor-not-allowed' 
              : 'bg-white text-[#5D6E73] hover:bg-[#AEBFC3]/10 border border-[#92A2A5]'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Stats Cards */}
      <CustomerStats stats={memoizedStats} />

      {/* Filters */}
      <CustomerFilters 
        search={searchParams.search}
        status={searchParams.status}
        totalResults={customerCount}
        filteredResults={customerCount}
      />

      {/* Customer Table */}
      <CustomerTable 
        customers={customers}
        readOnly={readOnly}
      />
    </div>
  );
});

CustomerClient.displayName = 'CustomerClient';

export default CustomerClient;
