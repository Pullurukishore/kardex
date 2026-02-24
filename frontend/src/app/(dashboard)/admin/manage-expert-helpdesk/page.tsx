import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import { getExpertHelpdesk, getExpertHelpdeskStats } from '@/lib/server/expert-helpdesk';
import ExpertHelpdeskClient from '@/components/admin/ExpertHelpdeskClient';
import Link from 'next/link';

interface ManageExpertHelpdeskPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManageExpertHelpdeskPage({ params, searchParams }: ManageExpertHelpdeskPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const search = resolvedSearchParams.search || '';

  const response = await getExpertHelpdesk({
    page: currentPage,
    limit: 20,
    search: search || undefined,
  });

  const experts = response.data;
  const pagination = response.pagination;
  const stats = await getExpertHelpdeskStats(experts);

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#6F8A9D] via-cyan-600 to-blue-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Manage Expert Helpdesk</h1>
            <p className="text-[#96AEC2]">
              Manage expert helpdesk users and support team access
            </p>
          </div>
          <Link href="/admin/manage-expert-helpdesk/new">
            <Button className="bg-white text-[#546A7A] hover:bg-[#96AEC2]/10 shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Expert
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Manage Expert Helpdesk"
          description="Manage expert helpdesk users and support team access"
          action={
            <Link href="/admin/manage-expert-helpdesk/new">
              <Button className="bg-[#6F8A9D] hover:bg-[#546A7A] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </Link>
          }
        />
      </div>

      {/* Client Component for API calls */}
      <ExpertHelpdeskClient 
        initialExperts={experts}
        initialStats={stats}
        initialPagination={pagination}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
