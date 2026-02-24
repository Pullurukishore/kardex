import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { getZoneUsers, getZoneUserStats } from '@/lib/server/admin';
import ZoneUserClient from '@/components/admin/ZoneUserClient';

interface ZoneUsersPageProps {
  params: Promise<any>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function ZoneUsersPage({ params, searchParams }: ZoneUsersPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const search = resolvedSearchParams.search || '';

  // Server-side data fetching
  const response = await getZoneUsers({
    page: currentPage,
    limit: 20,
    search: search || undefined,
  });

  const zoneUsers = response.data;
  const pagination = response.pagination;
  const stats = await getZoneUserStats(zoneUsers);

  const initialStats = {
    total: stats.total,
    active: stats.active,
    admin: stats.admin,
    totalZoneAssignments: stats.totalZoneAssignments
  };

  // Convert server ZoneUser types to client types
  const clientZoneUsers = zoneUsers.map(user => ({
    ...user,
    id: user.id.toString(),
    serviceZones: user.serviceZones.map(zone => ({
      serviceZone: {
        id: zone.serviceZone.id.toString(),
        name: zone.serviceZone.name
      }
    }))
  }));

  // Convert pagination format
  const clientPagination = {
    currentPage: pagination.page,
    totalPages: pagination.totalPages,
    totalItems: pagination.total,
    itemsPerPage: pagination.limit
  };

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-cyan-600 via-[#6F8A9D] to-cyan-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Zone Users</h1>
            <p className="text-cyan-100">
              Manage users assigned to service zones and their permissions
            </p>
          </div>
          <Link href="/expert/zone-users/new">
            <Button className="bg-white text-[#546A7A] hover:bg-[#96AEC2]/10 shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Zone User
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Zone Users"
          description="Manage users assigned to service zones and their permissions"
          action={
            <Link href="/expert/zone-users/new">
              <Button className="bg-[#546A7A] hover:bg-[#546A7A] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </Link>
          }
        />
      </div>

      {/* Client Component for API calls */}
      <ZoneUserClient 
        initialZoneUsers={clientZoneUsers}
        initialStats={initialStats}
        initialPagination={clientPagination}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
