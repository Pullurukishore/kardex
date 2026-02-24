import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import { getAdmins, getAdminStats } from '@/lib/server/admin';
import AdminClient from '@/components/admin/AdminClientSimple';
import Link from 'next/link';

interface ManageAdminsPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

// Disable caching for this page to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManageAdminsPage({ params, searchParams }: ManageAdminsPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const search = resolvedSearchParams.search || '';

  // Server-side data fetching with cache revalidation
  const response = await getAdmins({
    page: currentPage,
    limit: 20,
    search: search || undefined,
  });

  const admins = response.data;
  const pagination = response.pagination;
  const stats = await getAdminStats(admins);

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient - Kardex Colors */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#96AEC2] via-[#6F8A9D] to-[#546A7A] p-6 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Manage Admins</h1>
            <p className="text-white/80">
              Manage administrator accounts and permissions
            </p>
          </div>
          <Link href="/admin/manage-admins/new">
            <Button className="bg-white text-[#546A7A] hover:bg-[#96AEC2]/20 shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Manage Admins"
          description="Manage administrator accounts and permissions"
          action={
            <Link href="/admin/manage-admins/new">
              <Button className="bg-[#6F8A9D] hover:bg-[#546A7A] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </Link>
          }
        />
      </div>

      {/* Client Component for API calls */}
      <AdminClient 
        initialAdmins={admins}
        initialStats={stats}
        initialPagination={pagination}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
