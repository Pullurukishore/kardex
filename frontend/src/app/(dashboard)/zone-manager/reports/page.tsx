import ReportsClient from '@/components/reports/ReportsClient';
import type { ReportFilters } from '@/types/reports';
import { ZONE_MANAGER_REPORT_TYPES, SALES_REPORT_TYPES } from '@/types/reports';
import { subDays, parse } from 'date-fns';

// Ticket-only report types for zone manager (exclude offer-related)
const ZONE_MANAGER_TICKET_REPORT_TYPES = ZONE_MANAGER_REPORT_TYPES.filter(r => 
  r.value !== 'offer-summary' && r.value !== 'zone-user-offer-summary'
);

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<any>;
  searchParams: Promise<{
    reportType?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function ZoneManagerReportsPage({ params, searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  // Determine module based on reportType
  const module = searchParams.reportType === 'offer-summary' ? 'offers' : 'tickets';
  const reportTypes = module === 'offers' ? SALES_REPORT_TYPES : ZONE_MANAGER_TICKET_REPORT_TYPES;

  const initialFilters: ReportFilters = {
    dateRange: {
      from: searchParams.from 
        ? parse(searchParams.from, 'yyyy-MM-dd', new Date())
        : subDays(new Date(), 90),
      to: searchParams.to
        ? parse(searchParams.to, 'yyyy-MM-dd', new Date())
        : new Date(),
    },
    reportType: searchParams.reportType || (module === 'offers' ? 'offer-summary' : 'ticket-summary'),
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <ReportsClient
        initialFilters={initialFilters}
        initialReportData={null}
        zones={[]}
        customers={[]}
        isZoneUser={true}
        reportTypes={reportTypes}
      />
    </div>
  );
}
