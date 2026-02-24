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
      {/* Desktop Header with Gradient - Vibrant Coral & Green */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#E17F70] via-[#82A094] to-[#4F6A64] p-6 text-white">
        <div className="absolute inset-0 bg-black/5"></div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 drop-shadow-md">Service Zones</h1>
            <p className="text-white/90">
              Manage service zones for organizing customer locations
            </p>
          </div>
          <Link href="/admin/service-zones/new">
            <Button className="bg-white text-[#9E3B47] hover:bg-[#EEC1BF] hover:text-[#75242D] shadow-lg font-semibold">
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
          <Link href="/admin/service-zones/new">
            <Button className="bg-[#E17F70] hover:bg-[#9E3B47] text-white shadow-lg">
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
