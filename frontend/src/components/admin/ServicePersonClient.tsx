'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Users, UserCheck, UserX, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileCard, MobileTable } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { ServicePersonFilters } from '@/components/admin/ServicePersonFilters';
import { ServicePersonPagination } from '@/components/admin/ServicePersonPagination';
import { ServicePersonActions } from '@/components/admin/ServicePersonActions';

interface ServicePerson {
  id: number;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  serviceZones: Array<{
    serviceZone: {
      id: number;
      name: string;
    };
  }>;
}

interface ServicePersonStats {
  total: number;
  active: number;
  inactive: number;
  totalZoneAssignments: number;
}

interface ServicePersonClientProps {
  initialServicePersons: ServicePerson[];
  initialStats: ServicePersonStats;
  initialPagination: any;
  searchParams: {
    search?: string;
    page?: string;
  };
}

// Mobile service person card component
const ServicePersonMobileCard = ({ person, onRefresh }: { person: ServicePerson; onRefresh: () => Promise<void> }) => {
  return (
    <MobileCard className="hover:shadow-md transition-shadow duration-200">
      <div className="space-y-4">
        {/* Header with avatar and email */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
            {person.email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/admin/service-person/${person.id}`} className="block hover:text-[#546A7A] transition-colors">
              <div className="font-semibold text-lg text-[#546A7A] break-all hover:text-[#546A7A]">{person.email}</div>
              {(person.name || person.firstName || person.lastName) && (
                <div className="text-sm text-[#5D6E73] mt-1 hover:text-[#6F8A9D]">
                  {person.name || [person.firstName, person.lastName].filter(Boolean).join(' ')}
                </div>
              )}
            </Link>
          </div>
          <div className="flex-shrink-0">
            <Badge 
              variant={person.isActive ? 'default' : 'secondary'}
              className={person.isActive 
                ? 'bg-[#A2B9AF]/20 text-[#4F6A64]' 
                : 'bg-[#AEBFC3]/20 text-[#5D6E73]'
              }
            >
              {person.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Contact Information */}
        {person.phone && (
          <div className="flex items-center text-sm text-[#5D6E73]">
            <Users className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{person.phone}</span>
          </div>
        )}

        {/* Assigned Zones */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-[#5D6E73]">Assigned Zones:</div>
          <div className="flex flex-wrap gap-2">
            {person.serviceZones.length > 0 ? (
              person.serviceZones.map((zone) => (
                <Badge 
                  key={zone.serviceZone.id} 
                  variant="outline"
                  className="bg-[#96AEC2]/10 text-[#546A7A] border-[#96AEC2]"
                >
                  {zone.serviceZone.name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-[#979796] italic">No zones assigned</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-[#AEBFC3]/30">
          <ServicePersonActions person={person} onRefresh={onRefresh} />
        </div>
      </div>
    </MobileCard>
  );
};

export default function ServicePersonClient({
  initialServicePersons,
  initialStats,
  initialPagination,
  searchParams
}: ServicePersonClientProps) {
  const [servicePersons, setServicePersons] = useState<ServicePerson[]>(initialServicePersons);
  const [stats, setStats] = useState<ServicePersonStats>(initialStats);
  const [pagination, setPagination] = useState(initialPagination);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPage = parseInt(searchParams.page || '1');
  const search = searchParams.search || '';

  const fetchServicePersonData = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '100');
      if (search) params.append('search', search);

      const response = await api.get(`/service-persons?${params.toString()}`);
      const personData = response.data?.data || [];
      
      setServicePersons(personData);
      setPagination(response.data?.pagination || initialPagination);
      
      // Calculate stats
      const totalPersons = personData.length;
      const activePersons = personData.filter((p: ServicePerson) => p.isActive).length;
      const inactivePersons = totalPersons - activePersons;
      const totalZoneAssignments = personData.reduce((acc: number, person: ServicePerson) => acc + person.serviceZones.length, 0);
      
      const newStats = {
        total: totalPersons,
        active: activePersons,
        inactive: inactivePersons,
        totalZoneAssignments
      };
      setStats(newStats);
      
      return true;
    } catch (err) {
      setError('Failed to load service personnel. Please try again.');
      toast.error('Failed to refresh service personnel data');
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Fetch fresh data when component mounts or search params change
    fetchServicePersonData();
  }, [searchParams.search, searchParams.page]);

  const handleRefresh = async () => {
    await fetchServicePersonData();
  };

  // Function to refresh data (to be passed to child components)
  const refreshData = async () => {
    await fetchServicePersonData();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10 to-[#6F8A9D]/20 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl w-full text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E17F70]/20">
            <svg className="h-6 w-6 text-[#9E3B47]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-[#546A7A]">Failed to load service personnel</h3>
          <p className="mt-1 text-sm text-[#AEBFC3]0">{error}</p>
          <div className="mt-6">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#6F8A9D] hover:bg-[#546A7A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#96AEC2]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${
            isRefreshing 
              ? 'bg-[#92A2A5]/30 text-[#AEBFC3]0 cursor-not-allowed' 
              : 'bg-white text-[#5D6E73] hover:bg-[#AEBFC3]/10 border border-[#92A2A5]'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/20 border-[#96AEC2]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#546A7A]">Total Personnel</p>
                <p className="text-2xl font-bold text-[#546A7A]">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#96AEC2]/100 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#A2B9AF]/10 to-[#A2B9AF]/20 border-[#A2B9AF]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#4F6A64]">Active</p>
                <p className="text-2xl font-bold text-[#4F6A64]">{stats.active}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#A2B9AF]/100 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#EEC1BF]/10 to-[#EEC1BF]/20 border-[#CE9F6B]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#976E44]">Inactive</p>
                <p className="text-2xl font-bold text-[#976E44]">{stats.inactive}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#CE9F6B]/100 flex items-center justify-center">
                <UserX className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#6F8A9D]/10 to-[#6F8A9D]/20 border-[#6F8A9D]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#546A7A]">Zone Assignments</p>
                <p className="text-2xl font-bold text-[#546A7A]">{stats.totalZoneAssignments}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#6F8A9D]/100 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search and Filters */}
      <ServicePersonFilters searchParams={searchParams} />

      {/* Desktop Table View */}
      <Card className="shadow-lg hidden md:block">
        <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 rounded-t-lg">
          <CardTitle className="text-[#546A7A] flex items-center gap-2">
            <Users className="h-5 w-5 text-[#546A7A]" />
            Service Personnel ({servicePersons.length})
          </CardTitle>
          <CardDescription>
            Manage service personnel and their zone assignments
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {servicePersons.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/20 flex items-center justify-center mb-4">
                <Users className="h-12 w-12 text-[#6F8A9D]" />
              </div>
              <h3 className="text-lg font-semibold text-[#546A7A] mb-2">No service personnel found</h3>
              <p className="text-[#AEBFC3]0 mb-6">
                Get started by adding your first service person to the system.
              </p>
              <Link href="/admin/service-person/new">
                <Button className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:to-[#546A7A] shadow-lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service Person
                </Button>
              </Link>
            </div>
          ) : (
            <MobileTable>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#AEBFC3]/10">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-[#5D6E73] min-w-[250px]">Personnel</th>
                      <th className="text-left py-4 px-6 font-semibold text-[#5D6E73] w-24">Status</th>
                      <th className="text-left py-4 px-6 font-semibold text-[#5D6E73] min-w-[200px]">Assigned Zones</th>
                      <th className="text-right py-4 px-6 font-semibold text-[#5D6E73] w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {servicePersons.map((person) => (
                      <tr key={person.id} className="hover:bg-gradient-to-r hover:from-[#96AEC2]/10/50 hover:to-[#6F8A9D]/10/50 transition-all duration-200">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white font-semibold">
                              {person.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <Link href={`/admin/service-person/${person.id}`} className="block hover:text-[#546A7A] transition-colors">
                                <div className="font-semibold text-[#546A7A] break-all hover:text-[#546A7A]">{person.email}</div>
                                {(person.name || person.firstName || person.lastName) && (
                                  <div className="text-sm text-[#5D6E73] mt-1 hover:text-[#6F8A9D]">
                                    {person.name || [person.firstName, person.lastName].filter(Boolean).join(' ')}
                                  </div>
                                )}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <Badge 
                            variant={person.isActive ? 'default' : 'secondary'}
                            className={person.isActive 
                              ? 'bg-[#A2B9AF]/20 text-[#4F6A64] hover:bg-[#82A094]/30' 
                              : 'bg-[#AEBFC3]/20 text-[#5D6E73] hover:bg-[#92A2A5]/30'
                            }
                          >
                            {person.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1">
                            {person.serviceZones.length > 0 ? (
                              person.serviceZones.map((zone) => (
                                <Badge 
                                  key={zone.serviceZone.id} 
                                  variant="outline"
                                  className="bg-[#96AEC2]/10 text-[#546A7A] border-[#96AEC2] hover:bg-[#96AEC2]/20"
                                >
                                  {zone.serviceZone.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-[#979796] italic">No zones assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <ServicePersonActions person={person} onRefresh={refreshData} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MobileTable>
          )}
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-[#546A7A]" />
          <h2 className="text-lg font-semibold text-[#546A7A]">
            Service Personnel ({servicePersons.length})
          </h2>
        </div>
        {servicePersons.length === 0 ? (
          <MobileCard className="text-center py-8">
            <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/20 flex items-center justify-center mb-4">
              <Users className="h-10 w-10 text-[#6F8A9D]" />
            </div>
            <h3 className="text-lg font-semibold text-[#546A7A] mb-2">No service personnel found</h3>
            <p className="text-[#AEBFC3]0 mb-6 text-sm">
              Get started by adding your first service person to the system.
            </p>
            <Link href="/admin/service-person/new">
              <Button className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:to-[#546A7A] shadow-lg w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Service Person
              </Button>
            </Link>
          </MobileCard>
        ) : (
          <div className="space-y-4">
            {servicePersons.map((person) => (
              <ServicePersonMobileCard key={person.id} person={person} onRefresh={refreshData} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <ServicePersonPagination 
        currentPage={currentPage}
        totalPages={pagination.totalPages}
        searchParams={searchParams}
      />
    </div>
  );
}
