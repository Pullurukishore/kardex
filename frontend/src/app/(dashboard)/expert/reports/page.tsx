import { subDays, parse, format } from 'date-fns';
import { getZones, getCustomers, getAssets, generateReport } from '@/lib/server/reports';
import ReportsClient from '@/components/reports/ReportsClient';
import type { ReportFilters as ReportFiltersType } from '@/types/reports';
import { REPORT_TYPES, SALES_REPORT_TYPES } from '@/types/reports';

// Ticket-only report types (exclude offer-summary)
const TICKET_ONLY_REPORT_TYPES = REPORT_TYPES.filter(r => r.value !== 'offer-summary');

interface ReportsPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    zoneId?: string;
    customerId?: string;
    assetId?: string;
    reportType?: string;
  }>;
}

export default async function ReportsPage({ params, searchParams: searchParamsPromise }: ReportsPageProps) {
  const searchParams = await searchParamsPromise;
  // Determine module based on reportType
  const module = searchParams.reportType === 'offer-summary' ? 'offers' : 'tickets';
  const reportTypes = module === 'offers' ? SALES_REPORT_TYPES : TICKET_ONLY_REPORT_TYPES;

  // Parse search params to create filters
  const filters: ReportFiltersType = {
    dateRange: {
      from: searchParams.from 
        ? parse(searchParams.from, 'yyyy-MM-dd', new Date())
        : subDays(new Date(), 30),
      to: searchParams.to 
        ? parse(searchParams.to, 'yyyy-MM-dd', new Date())
        : new Date(),
    },
    reportType: searchParams.reportType || (module === 'offers' ? 'offer-summary' : 'ticket-summary'),
    zoneId: searchParams.zoneId,
    customerId: searchParams.customerId,
  };

  // Fetch all required data server-side
  const [zones, customers, assets] = await Promise.all([
    getZones(),
    filters.reportType === 'industrial-data' ? getCustomers() : Promise.resolve([]),
    filters.customerId ? getAssets(filters.customerId) : Promise.resolve([])
  ]);
  
  // Don't auto-generate - let client handle it with proper logic for all report types
  const reportData = null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50 to-[#96AEC2]/20 p-4 sm:p-6 lg:p-8">
      {/* Client Component for API calls */}
      <ReportsClient 
        initialFilters={filters}
        initialReportData={reportData}
        zones={zones.map(z => ({ id: z.id, name: z.name }))}
        customers={customers.map(c => ({ id: c.id, companyName: c.companyName }))}
        isZoneUser={false}
        reportTypes={reportTypes}
      />
    </div>
  );
}

