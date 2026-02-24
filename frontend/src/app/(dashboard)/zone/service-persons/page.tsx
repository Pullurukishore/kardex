import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { getZoneServicePersons, getZoneServicePersonStats } from '@/lib/server/zone';
import ZoneServicePersonClient from '@/components/zone/ServicePersonClient';

interface ZoneServicePersonsPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

// Disable caching for this page to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ZoneServicePersonsPage({ params, searchParams }: ZoneServicePersonsPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const search = resolvedSearchParams.search || '';

  // Server-side data fetching
  const response = await getZoneServicePersons({
    page: currentPage,
    limit: 30,
    search: search || undefined,
  });

  const servicePersons = response.data;
  const pagination = response.pagination;
  const stats = await getZoneServicePersonStats(servicePersons);

  // Convert server ServicePerson types to client types by adding createdAt and preserving isActive status
  const clientServicePersons = servicePersons.map(person => ({
    ...person,
    // Preserve the actual isActive status from backend, don't default to true
    isActive: person.isActive ?? false, // Default to false if undefined for safety
    createdAt: new Date().toISOString() // Add missing createdAt field
  }));

  // Calculate stats using the actual data
  const totalPersons = clientServicePersons.length;
  const activePersons = clientServicePersons.filter(p => p.isActive).length;
  const inactivePersons = clientServicePersons.filter(p => !p.isActive).length;
  const totalZoneAssignments = clientServicePersons.reduce((acc, person) => acc + (person.serviceZones?.length || 0), 0);

  const initialStats = {
    total: totalPersons,
    active: activePersons,
    inactive: inactivePersons,
    totalZoneAssignments
  };

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-blue-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Service Personnel</h1>
            <p className="text-[#96AEC2]">
              Manage service personnel and their zone assignments
            </p>
          </div>
          <Link href="/zone/service-persons/new">
            <Button className="bg-white text-[#546A7A] hover:bg-[#96AEC2]/10 shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Service Person
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Service Personnel"
          description="Manage service personnel and their zone assignments"
          action={
            <Link href="/zone/service-persons/new">
              <Button className="bg-[#6F8A9D] hover:bg-[#546A7A] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </Link>
          }
        />
      </div>

      {/* Client Component for API calls */}
      <ZoneServicePersonClient 
        initialServicePersons={clientServicePersons}
        initialStats={initialStats}
        initialPagination={pagination}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
