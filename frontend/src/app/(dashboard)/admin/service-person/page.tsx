import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { getServicePersons, getServicePersonStats } from '@/lib/server/admin';
import ServicePersonClient from '@/components/admin/ServicePersonClient';

interface ServicePersonsPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

// Disable caching for this page to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ServicePersonsPage({ params, searchParams }: ServicePersonsPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const search = resolvedSearchParams.search || '';

  // Server-side data fetching
  const response = await getServicePersons({
    page: currentPage,
    limit: 30,
    search: search || undefined,
  });

  const servicePersons = response.data;
  const pagination = response.pagination;
  const stats = await getServicePersonStats(servicePersons);

  // Calculate stats
  const totalPersons = servicePersons.length;
  const activePersons = servicePersons.filter(p => p.isActive).length;
  const inactivePersons = totalPersons - activePersons;
  const totalZoneAssignments = servicePersons.reduce((acc, person) => acc + person.serviceZones.length, 0);

  const initialStats = {
    total: totalPersons,
    active: activePersons,
    inactive: inactivePersons,
    totalZoneAssignments
  };

  // Convert server ServicePerson types to client types by adding createdAt
  const clientServicePersons = servicePersons.map(person => ({
    ...person,
    createdAt: new Date().toISOString() // Add missing createdAt field
  }));

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient - Vibrant Sand & Coral */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70] p-6 text-white">
        <div className="absolute inset-0 bg-black/5"></div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 drop-shadow-md">Service Personnel</h1>
            <p className="text-white/90">
              Manage service personnel and their zone assignments
            </p>
          </div>
          <Link href="/admin/service-person/new">
            <Button className="bg-white text-[#976E44] hover:bg-[#EEC1BF] hover:text-[#9E3B47] shadow-lg font-semibold">
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
          <Link href="/admin/service-person/new">
            <Button className="bg-[#CE9F6B] hover:bg-[#976E44] text-white shadow-lg">
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </Link>
          }
        />
      </div>

      {/* Client Component for API calls */}
      <ServicePersonClient 
        initialServicePersons={clientServicePersons}
        initialStats={initialStats}
        initialPagination={pagination}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}