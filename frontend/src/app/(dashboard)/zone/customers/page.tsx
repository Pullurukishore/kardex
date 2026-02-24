import { getCustomers, getCustomerStats } from '@/lib/server/customer';
import CustomerClient from '@/components/customer/CustomerClient';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';

interface SearchParams {
  search?: string;
  status?: string;
  page?: string;
}

export default async function ZoneCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<any>;
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams.search || '';
  const status = resolvedSearchParams.status || 'all';
  const page = parseInt(resolvedSearchParams.page || '1');

  try {
    // Fetch data server-side
    const allCustomers = await getCustomers({ search, status, page, limit: 100 });
    const stats = await getCustomerStats(allCustomers);

    return (
      <div className="space-y-6">
        {/* Desktop Header with Gradient */}
        <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-blue-800 p-6 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Customers</h1>
              <p className="text-[#96AEC2]">
                View customers within your assigned service zones
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden">
          <MobilePageHeader
            title="Customers"
            description="View customers within your assigned service zones"
          />
        </div>

        {/* Client Component for API calls - read-only mode */}
        <CustomerClient 
          initialCustomers={allCustomers}
          initialStats={stats}
          searchParams={resolvedSearchParams}
          readOnly={true}
        />
      </div>
    );
  } catch (error) {
    return (
      <div>
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-red-100 to-red-100 flex items-center justify-center mb-4">
            <div className="h-12 w-12 text-[#E17F70]">⚠️</div>
          </div>
          <h3 className="text-lg font-semibold text-[#546A7A] mb-2">Error loading customers</h3>
          <p className="text-[#AEBFC3]0 mb-6">
            Failed to load customers. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}
