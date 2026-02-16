'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  Shield,
  MapPin,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  Building2,
  Wrench,
  X,
  Badge as BadgeIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient } from '@/lib/api';

// Local helper type to handle either wrapped or raw responses
type ApiResponse<T> = { success?: boolean; data?: T } | T;

interface ServiceZone {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

interface ServiceZoneRef {
  id: number;
  name: string;
}

interface ServicePerson {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  isActive: boolean;
  serviceZones: Array<{
    serviceZone: ServiceZoneRef;
  }>;
}

type ServicePersonResponse = ServicePerson;

const updateServicePersonSchema = z.object({
  id: z.number(),
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional(),
  serviceZoneIds: z.array(z.number()).optional(),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UpdateServicePersonForm = z.infer<typeof updateServicePersonSchema>;

export default function EditZoneServicePersonPage() {
  const params = useParams();
  const router = useRouter();
  const servicePersonId = Number(params.id);

  const [servicePerson, setServicePerson] = useState<ServicePerson | null>(null);
  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [selectedZones, setSelectedZones] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<UpdateServicePersonForm>({
    resolver: zodResolver(updateServicePersonSchema),
    defaultValues: {
      id: servicePersonId,
      email: '',
      name: '',
      phone: '',
      password: '',
      confirmPassword: '',
      serviceZoneIds: [],
    },
  });

  const loadZones = async () => {
    try {
      // Use zone-specific endpoint to get only zones the current user has access to
      const response = await apiClient.get('/zone/attendance/service-zones');
      const zones = Array.isArray(response.data)
        ? response.data
        : response.data.data || [];

      setZones(zones);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load service zones for your zone',
        variant: 'destructive',
      });
    }
  };

  const loadServicePerson = async (id: number) => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<ApiResponse<ServicePerson>>(`/service-persons/${id}`);
      // Unwrap response: handle both raw object and { data: object }
      const unwrapped: any = (response && (response as any).data !== undefined)
        ? (response as any).data
        : (response as any);

      if (!unwrapped || typeof unwrapped !== 'object') {
        setServicePerson(null);
        return;
      }

      // Use a strongly typed variable for the rest of the function
      const sp: ServicePerson = unwrapped as ServicePerson;
      setServicePerson(sp);

      // Extract service zones, handling different possible structures
      const serviceZones: any[] = (sp as any).serviceZones || [];
      // Extract zone IDs from serviceZones array
      const zoneIds: number[] = serviceZones
        .map((zoneItem: any): number | null => {
          if (!zoneItem) return null;
          // Handle different possible zone object structures
          if (zoneItem.serviceZone?.id) return zoneItem.serviceZone.id;
          if ('id' in zoneItem) return (zoneItem as any).id;
          return null;
        })
        .filter((id: number | null): id is number => id !== null);

      // Reset form with service person data
      reset({
        id: sp.id,
        email: sp.email || '',
        name: sp.name || '',
        phone: sp.phone || '',
        password: '',
        confirmPassword: '',
        serviceZoneIds: zoneIds,
      });

      // Set selected zones based on the service person's zones
      setSelectedZones(zoneIds);
      setValue('serviceZoneIds', zoneIds);

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load service person details',
        variant: 'destructive',
      });
      setServicePerson(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([loadZones(), loadServicePerson(servicePersonId)]);
    };

    if (servicePersonId) {
      fetchData();
    }
  }, [servicePersonId]);

  const handleZoneToggle = (zoneId: number) => {
    setSelectedZones((prevSelected) => {
      // Single selection: if clicking the same zone, deselect it; otherwise select only this zone
      const newSelectedZones = prevSelected.includes(zoneId) ? [] : [zoneId];

      setValue('serviceZoneIds', newSelectedZones, { shouldValidate: false, shouldDirty: true });
      return newSelectedZones;
    });
  };

  const onSubmit = async (data: UpdateServicePersonForm) => {
    // Validate required fields
    if (!data.email || !data.email.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Email address is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    // Validate password if provided
    if (data.password && data.password.length > 0) {
      if (data.password.length < 6) {
        toast({
          title: 'Validation Error',
          description: 'Password must be at least 6 characters long',
          variant: 'destructive',
        });
        return;
      }

      if (data.password !== data.confirmPassword) {
        toast({
          title: 'Validation Error',
          description: 'Passwords do not match',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setLoading(true);

      // Prepare update data
      const updateData = {
        email: data.email,
        name: data.name,
        phone: data.phone,
        password: data.password && data.password.length > 0 ? data.password : undefined,
        serviceZoneIds: data.serviceZoneIds,
      };

      // Use general service person update endpoint (backend will handle zone restrictions)
      const response = await apiClient.put(`/service-persons/${servicePersonId}`, updateData);

      if (response.data && !response.data.success && response.data.error) {
        throw new Error(response.data.error || 'Failed to update service person');
      }

      toast({
        title: 'Success!',
        description: 'Service person updated successfully',
      });

      // Redirect to zone service persons list after a short delay
      setTimeout(() => {
        router.push('/zone/service-persons');
        router.refresh();
      }, 1500);

    } catch (error: any) {
      let errorMessage = 'Failed to update service person';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!servicePerson) {
    return (
      <div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Service person not found</h2>
          <p className="text-[#AEBFC3]0 mt-2">The requested service person could not be loaded or is not in your zone.</p>
          <Button className="mt-4" onClick={() => router.push('/zone/service-persons')}>
            Back to Zone Service Persons
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-indigo-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/zone/service-persons')}
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Zone Service Persons
            </Button>
            <Badge
              variant={servicePerson.isActive ? 'default' : 'secondary'}
              className={servicePerson.isActive
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'bg-[#5D6E73] text-[#AEBFC3] hover:bg-[#5D6E73]'
              }
            >
              {servicePerson.isActive ? (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Active
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Inactive
                </>
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
              {(servicePerson.name || servicePerson.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Edit Zone Service Person</h1>
              <p className="text-[#96AEC2] flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                {servicePerson.name || servicePerson.email} - Zone Service Management
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/zone/service-persons')}
            className="text-[#5D6E73] hover:text-[#546A7A]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Badge
            variant={servicePerson.isActive ? 'default' : 'secondary'}
            className={servicePerson.isActive
              ? 'bg-[#A2B9AF]/20 text-[#4F6A64]'
              : 'bg-[#AEBFC3]/20 text-[#5D6E73]'
            }
          >
            {servicePerson.isActive ? (
              <>
                <CheckCircle className="mr-1 h-3 w-3" />
                Active
              </>
            ) : (
              <>
                <XCircle className="mr-1 h-3 w-3" />
                Inactive
              </>
            )}
          </Badge>
        </div>
        <MobilePageHeader
          title="Edit Zone Service Person"
          description={`${servicePerson.name || servicePerson.email} - Zone Service Management`}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Enhanced Service Person Profile Edit Card */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-[#AEBFC3]/10 to-[#AEBFC3]/20">
          <CardHeader className="bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20 rounded-t-lg border-b">
            <CardTitle className="text-[#546A7A] flex items-center gap-2">
              <Wrench className="h-5 w-5 text-[#546A7A]" />
              Zone Service Person Profile
            </CardTitle>
            <CardDescription>
              Update the service person's profile information and settings in your zone
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Hidden ID field */}
            <input
              type="hidden"
              {...register('id')}
            />

            {/* Email Field */}
            <div className="space-y-3">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                <Mail className="h-4 w-4 text-[#546A7A]" />
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                {...register('email')}
                className={`h-12 text-base transition-all duration-200 ${errors.email
                    ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50'
                    : 'border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-indigo-200'
                  }`}
              />
              {errors.email && (
                <p className="text-sm text-[#E17F70] flex items-center gap-1">
                  <BadgeIcon className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Name and Phone Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <User className="h-4 w-4 text-[#546A7A]" />
                  Full Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter full name"
                  {...register('name')}
                  className={`h-12 text-base transition-all duration-200 ${errors.name
                      ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50'
                      : 'border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-indigo-200'
                    }`}
                />
                {errors.name && (
                  <p className="text-sm text-[#E17F70] flex items-center gap-1">
                    <BadgeIcon className="h-3 w-3" />
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Phone className="h-4 w-4 text-[#546A7A]" />
                  Phone Number *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  {...register('phone')}
                  className={`h-12 text-base transition-all duration-200 ${errors.phone
                      ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50'
                      : 'border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-indigo-200'
                    }`}
                />
                {errors.phone && (
                  <p className="text-sm text-[#E17F70] flex items-center gap-1">
                    <BadgeIcon className="h-3 w-3" />
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Shield className="h-4 w-4 text-[#976E44]" />
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current password"
                    {...register('password')}
                    className={`h-12 text-base pr-12 transition-all duration-200 ${errors.password
                        ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50'
                        : 'border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-indigo-200'
                      }`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#AEBFC3]/20"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-[#5D6E73]">
                  Leave blank to keep the current password
                </p>
                {errors.password && (
                  <p className="text-sm text-[#E17F70] flex items-center gap-1">
                    <BadgeIcon className="h-3 w-3" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Shield className="h-4 w-4 text-[#976E44]" />
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    {...register('confirmPassword')}
                    className={`h-12 text-base pr-12 transition-all duration-200 ${errors.confirmPassword
                        ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50'
                        : 'border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-indigo-200'
                      }`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#AEBFC3]/20"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-[#E17F70] flex items-center gap-1">
                    <BadgeIcon className="h-3 w-3" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            {/* Status Display */}
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border">
              <div className="h-10 w-10 rounded-full bg-[#546A7A]/20 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-[#546A7A]" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-[#AEBFC3]0 uppercase tracking-wide">Account Status</label>
                <div className="mt-1">
                  <Badge
                    variant={servicePerson.isActive ? 'default' : 'secondary'}
                    className={servicePerson.isActive
                      ? 'bg-[#A2B9AF]/20 text-[#4F6A64] hover:bg-[#82A094]/30'
                      : 'bg-[#AEBFC3]/20 text-[#5D6E73] hover:bg-[#92A2A5]/30'
                    }
                  >
                    {servicePerson.isActive ? (
                      <>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Active User
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1 h-3 w-3" />
                        Inactive User
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Zone Assignment Form */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/20">
          <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/20 rounded-t-lg border-b">
            <CardTitle className="text-[#546A7A] flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#546A7A]" />
              Zone Service Assignment
            </CardTitle>
            <CardDescription>
              Select the service zone that this person should be assigned to manage within your zone (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-semibold text-[#546A7A]">Available Service Zones</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-[#546A7A]/10 text-[#546A7A] border-[#546A7A]">
                  {selectedZones.length} selected
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedZones([]);
                    setValue('serviceZoneIds', [], { shouldValidate: false, shouldDirty: true });
                  }}
                  className="text-[#9E3B47] border-[#E17F70] hover:bg-[#E17F70]/10"
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {zones.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-[#96AEC2]/20 to-[#96AEC2]/20 flex items-center justify-center mb-4">
                    <MapPin className="h-8 w-8 text-[#546A7A]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#546A7A] mb-2">No Service Zones Available</h3>
                  <p className="text-[#AEBFC3]0">
                    No active service zones are currently available for assignment in your zone.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {zones
                    .filter((z) => z.isActive)
                    .map((zone) => (
                      <div
                        key={zone.id}
                        className={`relative p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${selectedZones.includes(zone.id)
                            ? 'border-[#6F8A9D] bg-[#546A7A]/10 shadow-sm'
                            : 'border-[#92A2A5] bg-white hover:border-indigo-300'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`zone-${zone.id}`}
                            checked={selectedZones.includes(zone.id)}
                            onCheckedChange={() => handleZoneToggle(zone.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center text-white font-semibold text-sm">
                                {zone.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-semibold text-[#546A7A]">{zone.name}</h4>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-[#A2B9AF]/10 text-[#4F6A64] border-[#A2B9AF]"
                                >
                                  <CheckCircle className="mr-1 h-2 w-2" />
                                  Active
                                </Badge>
                              </div>
                            </div>
                            {zone.description && (
                              <p className="text-sm text-[#5D6E73] leading-relaxed">
                                {zone.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedZones.includes(zone.id) && (
                          <div className="absolute top-2 right-2">
                            <div className="h-6 w-6 rounded-full bg-[#546A7A]/100 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <p className="text-sm text-[#5D6E73] mt-4">
              Select a service zone to assign to this person. Service persons can manage tickets and activities within their assigned zone.
            </p>
          </CardContent>
        </Card>

        {/* Enhanced Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#92A2A5]">
          <div className="flex items-center gap-2 text-sm text-[#5D6E73]">
            <MapPin className="h-4 w-4" />
            <span>
              {selectedZones.length === 0
                ? 'No zone selected (can be assigned later)'
                : `${selectedZones.length} zone selected`
              }
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/zone/service-persons">
              <Button
                type="button"
                variant="outline"
                className="border-[#92A2A5] text-[#5D6E73] hover:bg-[#AEBFC3]/10"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A] shadow-lg min-w-[120px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}