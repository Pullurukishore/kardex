import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getCustomers, getCustomerStats } from '@/lib/server/customer';
import CustomerClient from '@/components/customer/CustomerClient';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';

interface SearchParams {
  search?: string;
  status?: string;
  page?: string;
}

export default async function CustomersPage({
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
                Manage your organization's customers and their business relationships
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/expert/customers/new">
                <Button className="bg-white text-[#546A7A] hover:bg-[#96AEC2]/10 shadow-lg">
                  <Plus className="mr-2 h-4 w-4" /> Add Customer
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden">
          <MobilePageHeader
            title="Customers"
            description="Manage your organization's customers and their business relationships"
            action={
              <Link href="/expert/customers/new">
                <Button className="bg-[#6F8A9D] hover:bg-[#546A7A] text-white shadow-lg">
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </Link>
            }
          />
        </div>

        {/* Client Component for API calls */}
        <CustomerClient 
          initialCustomers={allCustomers}
          initialStats={stats}
          searchParams={resolvedSearchParams}
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
          <Link href="/expert/customers">
            <Button variant="outline">
              Retry
            </Button>
          </Link>
        </div>
      </div>
    );
  }
}
