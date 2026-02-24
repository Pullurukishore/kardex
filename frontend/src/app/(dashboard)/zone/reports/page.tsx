import ReportsClient from '@/components/reports/ReportsClient';
import type { ReportFilters } from '@/types/reports';
import { ZONE_USER_REPORT_TYPES, SALES_REPORT_TYPES } from '@/types/reports';
import { subDays, parse } from 'date-fns';
import { getZones, getCustomers, getUserZone } from '@/lib/server/reports';

// Ticket-only report types for zone user (exclude offer-related)
const ZONE_USER_TICKET_REPORT_TYPES = ZONE_USER_REPORT_TYPES.filter(r => 
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

export default async function ReportsPage({ params, searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  // Fetch zone user's zone and customers for that zone
  let userZone: { id: number; name: string } | null = null;
  let zones: { id: number; name: string }[] = [];
  let customers: any[] = [];
  
  try {
    userZone = await getUserZone();
    zones = userZone ? [userZone] : [];
    customers = userZone ? await getCustomers(userZone.id.toString()) : [];
  } catch (error) {
    console.error('Error fetching zone data:', error);
    // Return empty data if zone fetch fails
    zones = [];
    customers = [];
  }
  
  // Convert customer types from string id to number id
  const customersData = customers.map(c => ({
    id: typeof c.id === 'string' ? parseInt(c.id) : c.id,
    companyName: c.companyName
  }));

  // Determine module based on reportType
  const module = searchParams.reportType === 'offer-summary' ? 'offers' : 'tickets';
  const reportTypes = module === 'offers' ? SALES_REPORT_TYPES : ZONE_USER_TICKET_REPORT_TYPES;

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
    zoneId: userZone?.id.toString(),
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <ReportsClient
        initialFilters={initialFilters}
        initialReportData={null}
        zones={zones}
        customers={customersData}
        isZoneUser={true}
        reportTypes={reportTypes}
      />
    </div>
  );
}

