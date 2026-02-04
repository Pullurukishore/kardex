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
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const search = searchParams.search || '';
  const status = searchParams.status || 'all';
  const page = parseInt(searchParams.page || '1');

  try {
    // Fetch data server-side
    const allCustomers = await getCustomers({ search, status, page, limit: 25 });
    const stats = await getCustomerStats(allCustomers);

    return (
      <div className="space-y-6">
        {/* Desktop Header with Gradient - Vibrant Coral & Blue */}
        <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#CE9F6B] via-[#E17F70] to-[#6F8A9D] p-6 text-white">
          <div className="absolute inset-0 bg-black/5"></div>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 drop-shadow-md">Customers</h1>
              <p className="text-white/90">
                Manage your organization's customers and their business relationships
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/admin/customers/new">
                <Button className="bg-white text-[#9E3B47] hover:bg-[#EEC1BF] hover:text-[#75242D] shadow-lg font-semibold">
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
            <Link href="/admin/customers/new">
              <Button className="bg-[#E17F70] hover:bg-[#9E3B47] text-white shadow-lg">
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
          searchParams={searchParams}
        />
      </div>
    );
  } catch (error) {
    return (
      <div>
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/20 flex items-center justify-center mb-4">
            <div className="h-12 w-12 text-[#E17F70]">⚠️</div>
          </div>
          <h3 className="text-lg font-semibold text-[#546A7A] mb-2">Error loading customers</h3>
          <p className="text-[#AEBFC3]0 mb-6">
            Failed to load customers. Please try again later.
          </p>
          <Link href="/admin/customers">
            <Button variant="outline">
              Retry
            </Button>
          </Link>
        </div>
      </div>
    );
  }
}