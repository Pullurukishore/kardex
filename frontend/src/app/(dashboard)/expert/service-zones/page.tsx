import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { getServiceZones, getServiceZoneStats } from '@/lib/server/admin';
import ServiceZoneClient from '@/components/admin/ServiceZoneClient';

interface ServiceZonesPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function ServiceZonesPage({ params, searchParams }: ServiceZonesPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const search = resolvedSearchParams.search || '';

  // Server-side data fetching
  const response = await getServiceZones({
    page: currentPage,
    limit: 20,
    search: search || undefined,
  });

  const zones = response.data;
  const pagination = response.pagination;
  const stats = await getServiceZoneStats(zones);

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#82A094] via-[#82A094] to-green-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Service Zones</h1>
            <p className="text-[#A2B9AF]">
              Manage service zones for organizing customer locations
            </p>
          </div>
          <Link href="/expert/service-zones/new">
            <Button className="bg-white text-[#4F6A64] hover:bg-[#A2B9AF]/10 shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Service Zone
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Service Zones"
          description="Manage service zones for organizing customer locations"
          action={
            <Link href="/expert/service-zones/new">
              <Button className="bg-[#4F6A64] hover:bg-[#4F6A64] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </Link>
          }
        />
      </div>

      {/* Client Component for API calls */}
      <ServiceZoneClient 
        initialZones={zones}
        initialStats={stats}
        initialPagination={pagination}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
