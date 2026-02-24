import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import { getExternalUsers, getExternalUserStats } from '@/lib/server/external';
import ExternalUserClient from '@/components/admin/ExternalUserClient';
import Link from 'next/link';

interface ManageExternalUsersPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

// Disable caching for this page to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManageExternalUsersPage({ params, searchParams }: ManageExternalUsersPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const search = resolvedSearchParams.search || '';

  // Server-side data fetching with cache revalidation
  const response = await getExternalUsers({
    page: currentPage,
    limit: 20,
    search: search || undefined,
  });

  const externalUsers = response.data;
  const pagination = response.pagination;
  const stats = await getExternalUserStats(externalUsers);

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-indigo-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Manage External Users</h1>
            <p className="text-[#6F8A9D]">
              Manage external user accounts and customer access
            </p>
          </div>
          <Link href="/admin/manage-external/new">
            <Button className="bg-white text-[#546A7A] hover:bg-[#546A7A]/10 shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Add External User
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Manage External Users"
          description="Manage external user accounts and customer access"
          action={
            <Link href="/admin/manage-external/new">
              <Button className="bg-[#546A7A] hover:bg-[#546A7A] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </Link>
          }
        />
      </div>

      {/* Client Component for API calls */}
      <ExternalUserClient 
        initialExternalUsers={externalUsers}
        initialStats={stats}
        initialPagination={pagination}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}