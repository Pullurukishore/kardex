'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { format } from 'date-fns';
import type { ReportFilters, DateRange, ReportType } from '@/types/reports';
import { REPORT_TYPES, TICKET_REPORT_TYPES, SALES_REPORT_TYPES, PRODUCT_TYPE_LABELS } from '@/types/reports';

interface ReportsFiltersProps {
  filters: ReportFilters;
  onFilterChange: (filters: Partial<ReportFilters>) => void;
  zones: Array<{ id: number; name: string }>;
  customers: Array<{ id: number; companyName: string }>;
  isZoneUser: boolean;
  isLoadingCustomers?: boolean;
  users?: Array<{ id: number; name: string; email: string }>;
  reportTypes?: ReportType[]; // Allow custom report types
}

const PRODUCT_TYPES = Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const OFFER_STAGES = [
  { value: 'INITIAL', label: 'Initial' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'PO_RECEIVED', label: 'PO Received' },
  // Note: ORDER_BOOKED removed - PO_RECEIVED leads directly to WON
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
];

const ReportsFilters: React.FC<ReportsFiltersProps> = ({
  filters,
  onFilterChange,
  zones,
  customers,
  isZoneUser,
  isLoadingCustomers = false,
  users = [],
  reportTypes = REPORT_TYPES,
}) => {
  const isOfferSummary = filters.reportType === 'offer-summary' || filters.reportType === 'zone-user-offer-summary';

  // State calculations for Year/Month selectors (default current year, Jan-Dec)
  const currentYear = filters.dateRange?.from ? filters.dateRange.from.getFullYear() : new Date().getFullYear();
  const fromMonth = filters.dateRange?.from ? filters.dateRange.from.getMonth() + 1 : 1;
  const toMonth = filters.dateRange?.to ? filters.dateRange.to.getMonth() + 1 : 12;

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handleYearMonthChange = (y: number, fM: number, tM: number) => {
    // Update dateRange to match selected year and months
    const from = new Date(y, fM - 1, 1);
    const to = new Date(y, tM, 0); // Last day of toMonth
    
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    
    onFilterChange({ dateRange: { from, to } });
  };

  return (
    <div className="space-y-4">
      {/* Filter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Report Type */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Report Type</Label>
          <Select
            value={filters.reportType || reportTypes[0]?.value || 'offer-summary'}
            onValueChange={(value) => onFilterChange({ reportType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto">
              {reportTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      {/* Date Filters - Adaptive based on report type */}
      {filters.reportType !== 'target-report' && (
        isOfferSummary ? (
          <>
            {/* Year */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">Year</Label>
              <Select
                value={currentYear.toString()}
                onValueChange={(value) => handleYearMonthChange(Number(value), fromMonth, toMonth)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* From Month */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">From Month</Label>
              <Select
                value={fromMonth.toString()}
                onValueChange={(value) => {
                  const v = Number(value);
                  handleYearMonthChange(currentYear, v, Math.max(v, toMonth));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* To Month */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">To Month</Label>
              <Select
                value={toMonth.toString()}
                onValueChange={(value) => handleYearMonthChange(currentYear, fromMonth, Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString()} disabled={i + 1 < fromMonth}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            {/* Date Range - From */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">From Date</Label>
              <Input
                type="date"
                value={filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const newFrom = e.target.value ? new Date(e.target.value) : undefined;
                  const existingTo = filters.dateRange?.to;
                  const newDateRange = (newFrom && existingTo)
                    ? ({ from: newFrom, to: existingTo } as DateRange)
                    : undefined;
                  onFilterChange({ dateRange: newDateRange });
                }}
                className="w-full"
              />
            </div>

            {/* Date Range - To */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">To Date</Label>
              <Input
                type="date"
                value={filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const newTo = e.target.value ? new Date(e.target.value) : undefined;
                  const existingFrom = filters.dateRange?.from;
                  const newDateRange = (existingFrom && newTo)
                    ? ({ from: existingFrom, to: newTo } as DateRange)
                    : undefined;
                  onFilterChange({ dateRange: newDateRange });
                }}
                className="w-full"
              />
            </div>
          </>
        )
      )}

      {/* Zone Filter */}
      <div className="space-y-1">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          Zone
          {isZoneUser && (
            <span className="text-xs font-normal text-[#546A7A] bg-[#96AEC2]/10 px-2 py-0.5 rounded">
              Your Zone
            </span>
          )}
        </Label>
        {isZoneUser ? (
          // Read-only display for zone managers
          <div className="w-full px-3 py-2 border border-[#92A2A5] rounded-md bg-[#AEBFC3]/10 text-[#5D6E73] text-sm font-medium cursor-not-allowed flex items-center">
            {zones && zones.length > 0 
              ? (zones.find(z => z.id.toString() === filters.zoneId)?.name || zones[0]?.name || 'No Zone')
              : 'No Zone'
            }
          </div>
        ) : (
          // Changeable dropdown for admins
          <Select
            value={filters.zoneId || 'all'}
            onValueChange={(value) => onFilterChange({ zoneId: value === 'all' ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id.toString()}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Customer Filter - show for offer-summary and ticket-summary */}
      {(filters.reportType === 'offer-summary' || filters.reportType === 'zone-user-offer-summary' || filters.reportType === 'ticket-summary' || filters.reportType === 'industrial-data') && (
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Customer</Label>
          <SearchableSelect
            options={customers.map((customer) => ({
              id: customer.id.toString(),
              label: customer.companyName,
              searchText: customer.companyName
            }))}
            value={filters.customerId || ''}
            onValueChange={(value) => onFilterChange({ customerId: value || undefined })}
            placeholder="Select customer..."
            emptyText={isLoadingCustomers ? "Loading customers..." : "No customers found"}
            loading={isLoadingCustomers}
            disabled={isLoadingCustomers}
            maxHeight="250px"
          />
        </div>
      )}

      {/* Asset Filter - only show for industrial-data or ticket-summary */}
      {(filters.reportType === 'industrial-data' || filters.reportType === 'ticket-summary') && (
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Machine / Asset</Label>
          <SearchableSelect
            options={customers
              .filter(c => !filters.customerId || c.id.toString() === filters.customerId)
              .flatMap(c => (c as any).assets || [])
              .map((asset: any) => ({
                id: asset.id.toString(),
                label: `${asset.machineId} - ${asset.model}`,
                searchText: `${asset.machineId} ${asset.model}`
              }))}
            value={filters.assetId || ''}
            onValueChange={(value) => onFilterChange({ assetId: value || undefined })}
            placeholder="Select machine..."
            emptyText="No machines found"
            maxHeight="250px"
          />
        </div>
      )}

      {/* Product Type Filter - only show for offer-summary */}
      {(filters.reportType === 'offer-summary' || filters.reportType === 'zone-user-offer-summary') && (
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Product Type</Label>
          <Select
            value={filters.productType || 'all'}
            onValueChange={(value) => onFilterChange({ productType: value === 'all' ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All product types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All product types</SelectItem>
              {PRODUCT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stage Filter - only show for offer-summary */}
      {(filters.reportType === 'offer-summary' || filters.reportType === 'zone-user-offer-summary') && (
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Stage</Label>
          <Select
            value={filters.stage || 'all'}
            onValueChange={(value) => onFilterChange({ stage: value === 'all' ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {OFFER_STAGES.map((stageOption) => (
                <SelectItem key={stageOption.value} value={stageOption.value}>
                  {stageOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Created By Filter - only show for offer-summary */}
      {(filters.reportType === 'offer-summary' || filters.reportType === 'zone-user-offer-summary') && !isZoneUser && (
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Created By</Label>
          <SearchableSelect
            options={users?.filter((u: any) => {
                if (!filters.zoneId || filters.zoneId === 'all') return true;
                return u.serviceZones?.some((sz: any) => sz.serviceZone?.id?.toString() === filters.zoneId?.toString());
              }).map((u: any) => {
                const zoneNames = u.serviceZones?.map((sz: any) => sz.serviceZone?.name).filter(Boolean).join(', ');
                const label = `${u.name || u.email}${zoneNames ? ` (${zoneNames})` : ''}`;
                return {
                  id: u.id.toString(),
                  label: label,
                  searchText: label.toLowerCase()
                };
              }) || []}
            value={filters.createdById || ''}
            onValueChange={(value) => onFilterChange({ createdById: value || undefined })}
            placeholder="Select user..."
            emptyText="No users found"
            maxHeight="300px"
          />
        </div>
      )}

      {/* Target Report Specific Filters */}
      {filters.reportType === 'target-report' && (
        <>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-foreground">Target Period</Label>
            <Input
              type={filters.periodType === 'YEARLY' ? 'number' : 'month'}
              value={filters.periodType === 'YEARLY' 
                ? (filters.targetPeriod?.split('-')[0] || '') 
                : (filters.targetPeriod || '')}
              onChange={(e) => {
                const value = e.target.value;
                onFilterChange({ targetPeriod: value });
              }}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-foreground">Period Type</Label>
            <Select
              value={filters.periodType || 'MONTHLY'}
              onValueChange={(value: 'MONTHLY' | 'YEARLY') => {
                const now = new Date();
                const targetPeriod = value === 'YEARLY' 
                  ? now.getFullYear().toString()
                  : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                onFilterChange({ periodType: value, targetPeriod });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default ReportsFilters;
