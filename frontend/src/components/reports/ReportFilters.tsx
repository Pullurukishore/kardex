import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { RefreshCw, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import type { ReportFilters as ReportFiltersType } from './types';
import { REPORT_TYPES, Zone, Customer, Asset } from './types';

interface ReportFiltersProps {
  filters: ReportFiltersType;
  zones: Zone[];
  customers: Customer[];
  assets: Asset[];
  onFiltersChange?: (filters: ReportFiltersType) => void;
  isLoadingCustomers?: boolean;
  isLoadingAssets?: boolean;
  isZoneUser?: boolean;
}

export function ReportFilters({
  filters,
  zones,
  customers,
  assets,
  onFiltersChange,
  isLoadingCustomers = false,
  isLoadingAssets = false,
  isZoneUser = false
}: ReportFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ReportFiltersType>(filters);

  const handleFilterChange = (key: keyof ReportFiltersType, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const newDateRange = { 
      ...localFilters.dateRange,
      [field]: value ? new Date(value) : undefined
    };
    handleFilterChange('dateRange', newDateRange);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Report Type</label>
        <Select 
          value={localFilters.reportType}
          onValueChange={(value) => handleFilterChange('reportType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select report type" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">From Date</label>
        <Input
          type="date"
          value={localFilters.dateRange?.from ? format(localFilters.dateRange.from, 'yyyy-MM-dd') : ''}
          onChange={(e) => handleDateChange('from', e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">To Date</label>
        <Input
          type="date"
          value={localFilters.dateRange?.to ? format(localFilters.dateRange.to, 'yyyy-MM-dd') : ''}
          onChange={(e) => handleDateChange('to', e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          Zone
          {isZoneUser && (
            <span className="text-xs font-normal text-[#546A7A] bg-[#96AEC2]/10 px-2 py-0.5 rounded">
              Your Zone
            </span>
          )}
        </label>
        <Select 
          value={localFilters.zoneId || ''}
          onValueChange={(value) => handleFilterChange('zoneId', value === 'all' ? undefined : value)}
          disabled={isZoneUser}
        >
          <SelectTrigger className={isZoneUser ? 'bg-[#AEBFC3]/10 cursor-not-allowed' : ''}>
            <SelectValue placeholder="All zones" />
          </SelectTrigger>
          <SelectContent>
            {!isZoneUser && <SelectItem value="all">All zones</SelectItem>}
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={String(zone.id)}>
                {zone.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {localFilters.reportType === 'industrial-data' && (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Customer</label>
            <SearchableSelect
              options={customers.map((customer) => ({
                id: String(customer.id),
                label: customer.companyName,
                searchText: customer.companyName
              }))}
              value={localFilters.customerId || ''}
              onValueChange={(value) => handleFilterChange('customerId', value || undefined)}
              placeholder="Select customer..."
              emptyText={isLoadingCustomers ? "Loading customers..." : "No customers found for selected zone"}
              loading={isLoadingCustomers}
              disabled={isLoadingCustomers}
              maxHeight="250px"
            />
          </div>

          {localFilters.customerId && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Asset</label>
              <SearchableSelect
                options={assets.map((asset) => ({
                  id: asset.id,
                  label: asset.serialNo || asset.name || `Asset ${asset.id}`,
                  searchText: `${asset.serialNo || ''}  || ${asset.name || ''} ${asset.model || ''}`.trim()
                }))}
                value={localFilters.assetId || ''}
                onValueChange={(value) => handleFilterChange('assetId', value || undefined)}
                placeholder="Select asset..."
                emptyText={isLoadingAssets ? "Loading assets..." : "No assets found for selected customer"}
                loading={isLoadingAssets}
                disabled={isLoadingAssets}
                maxHeight="250px"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
