'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  User,
  Mail,
  Phone,
  Shield,
  MapPin,
  UserPlus,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  Building2,
  Badge as BadgeIcon,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { MobileContainer, MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient } from '@/lib/api';

interface ServiceZone {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

const createServicePersonSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  serviceZoneIds: z.array(z.number()).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateServicePersonForm = z.infer<typeof createServicePersonSchema>;

export default function NewServicePersonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([]);
  const [selectedZones, setSelectedZones] = useState<number[]>([]);
  const [created, setCreated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<CreateServicePersonForm>({
    resolver: zodResolver(createServicePersonSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      serviceZoneIds: [],
    },
  });

  // Fetch available service zones
  useEffect(() => {
    const fetchServiceZones = async () => {
      try {
        const response = await apiClient.get('/service-zones', {
          params: {
            limit: 100,
            includeInactive: true
          }
        });

        if (response?.data) {
          // The API returns { data: [...], pagination: {...} }
          const zones = Array.isArray(response.data)
            ? response.data
            : response.data.data || [];

          setServiceZones(zones);
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch service zones',
          variant: 'destructive',
        });
      }
    };

    fetchServiceZones();
  }, []);

  const handleZoneToggle = (zoneId: number) => {
    setSelectedZones((prevSelected) => {
      // Single selection: if clicking the same zone, deselect it; otherwise select only this zone
      const newSelectedZones = prevSelected.includes(zoneId) ? [] : [zoneId];

      setValue('serviceZoneIds', newSelectedZones, { shouldValidate: false, shouldDirty: true });
      return newSelectedZones;
    });
  };

  const onSubmit = async (data: CreateServicePersonForm) => {
    try {
      setLoading(true);

      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        password: data.password,
        serviceZoneIds: selectedZones,
      };

      const response = await apiClient.post('/service-persons', payload);

      // Check if the response indicates success
      if (response && (response.success !== false)) {
        toast({
          title: 'Success',
          description: 'Service person created successfully',
        });

        // Show success screen, then redirect shortly after
        setCreated(true);
      } else {
        throw new Error(response?.error || 'Failed to create service person');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create service person',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (created) {
      const timeoutId = setTimeout(() => {
        router.push('/admin/service-person');
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [created, router]);

  const handleImmediateRedirect = () => {
    router.push('/admin/service-person');
  };

  if (created) {
    return (
      <MobileContainer>
        <div className="max-w-lg mx-auto py-12">
          <Card className="text-center shadow-2xl border-0 bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/20">
            <CardHeader className="pb-4">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-lg">
                    <CheckCircle className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-[#CE9F6B] flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-[#976E44]" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-[#546A7A]">Service Person Created Successfully!</CardTitle>
              <CardDescription className="text-[#5D6E73] mt-2">
                The new service person has been added to the system and will be redirected automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={handleImmediateRedirect}
                  className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A] shadow-lg"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Go to Service Persons
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="border-[#96AEC2] text-[#546A7A] hover:bg-[#96AEC2]/10"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-indigo-800 p-8 text-white mb-8 shadow-2xl">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <Link href="/admin/service-person">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 hover:text-white border border-white/30"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Service Persons
              </Button>
            </Link>
            <Badge className="bg-white/20 text-white hover:bg-white/30 border-white/30">
              <Wrench className="mr-1 h-3 w-3" />
              New Service Person
            </Badge>
          </div>
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
              <Wrench className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Create New Service Person</h1>
              <p className="text-[#96AEC2] flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Add a new service person and assign service zones
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/admin/service-person">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#5D6E73] hover:text-[#546A7A]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <Badge className="bg-[#546A7A]/20 text-[#546A7A]">
            <Wrench className="mr-1 h-3 w-3" />
            New
          </Badge>
        </div>
        <MobilePageHeader
          title="Create Service Person"
          description="Add a new service person and assign zones"
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Enhanced User Profile Card */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-[#AEBFC3]/10 to-[#AEBFC3]/20 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-100 to-gray-200 border-b border-[#92A2A5]">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-[#546A7A]">Service Person Profile</CardTitle>
                <CardDescription className="text-[#5D6E73]">
                  Enter the basic profile details for the new service person
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {/* Name and Email Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <User className="h-4 w-4 text-[#546A7A]" />
                  Full Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter service person's full name"
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
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Mail className="h-4 w-4 text-[#4F6A64]" />
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
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
            </div>

            {/* Phone Number */}
            <div className="space-y-3">
              <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                <Phone className="h-4 w-4 text-[#546A7A]" />
                Phone Number *
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter phone number (e.g., 9876543210)"
                {...register('phone')}
                className={`h-12 text-base transition-all duration-200 ${errors.phone
                    ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50'
                    : 'border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-indigo-200'
                  }`}
              />
              <p className="text-sm text-[#5D6E73] bg-[#96AEC2]/10 p-3 rounded-lg border border-[#96AEC2]">
                <Phone className="h-4 w-4 inline mr-2 text-[#546A7A]" />
                Phone number is required for WhatsApp notifications and system alerts
              </p>
              {errors.phone && (
                <p className="text-sm text-[#E17F70] flex items-center gap-1">
                  <BadgeIcon className="h-3 w-3" />
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Shield className="h-4 w-4 text-[#976E44]" />
                  Password *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter a strong password"
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
                  Password must be at least 6 characters long
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
                  Confirm Password *
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm the password"
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
          </CardContent>
        </Card>

        {/* Enhanced Zone Assignment Card */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/20 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#96AEC2]/20 to-indigo-200 border-b border-indigo-300">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-lg">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-[#546A7A]">Service Zone Assignments</CardTitle>
                <CardDescription className="text-[#5D6E73]">
                  Select the service zones that this service person will be assigned to (optional)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {serviceZones.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-[#96AEC2]/20 to-indigo-200 flex items-center justify-center mb-6 shadow-lg">
                  <MapPin className="h-10 w-10 text-[#546A7A]" />
                </div>
                <h3 className="text-xl font-semibold text-[#546A7A] mb-3">No Service Zones Available</h3>
                <p className="text-[#5D6E73] mb-6 max-w-md mx-auto">
                  No active service zones are currently available for assignment. Please create service zones first.
                </p>
                <Link href="/admin/service-zones/new">
                  <Button className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A] shadow-lg">
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Service Zone
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[#546A7A]">Available Service Zones</h3>
                    <Badge variant="outline" className="bg-[#96AEC2]/10 text-[#546A7A] border-[#96AEC2]">
                      {serviceZones.length} zones available
                    </Badge>
                  </div>
                  {selectedZones.length > 0 && (
                    <Badge className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white">
                      {selectedZones.length} selected
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serviceZones
                    .filter((zone) => zone.isActive)
                    .map((zone) => (
                      <div
                        key={zone.id}
                        className={`relative p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg ${selectedZones.includes(zone.id)
                            ? 'border-[#6F8A9D] bg-[#546A7A]/10 shadow-md ring-2 ring-indigo-200'
                            : 'border-[#92A2A5] bg-white hover:border-indigo-300 hover:bg-[#546A7A]/10/50'
                          }`}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            id={`zone-${zone.id}`}
                            checked={selectedZones.includes(zone.id)}
                            onCheckedChange={() => handleZoneToggle(zone.id)}
                            className="mt-1 data-[state=checked]:bg-[#546A7A] data-[state=checked]:border-[#6F8A9D]"
                            disabled={!zone.isActive}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {zone.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-semibold text-[#546A7A] text-base">{zone.name}</h4>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-[#96AEC2]/10 text-[#546A7A] border-[#96AEC2] mt-1"
                                >
                                  <CheckCircle className="mr-1 h-2 w-2" />
                                  Active Zone
                                </Badge>
                              </div>
                            </div>
                            {zone.description && (
                              <p className="text-sm text-[#5D6E73] leading-relaxed bg-[#AEBFC3]/10 p-3 rounded-lg">
                                {zone.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedZones.includes(zone.id) && (
                          <div className="absolute top-3 right-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-lg">
                              <CheckCircle className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>

                {selectedZones.length > 0 && (
                  <div className="mt-6 p-6 bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 rounded-2xl border border-[#546A7A]">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-[#546A7A] flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <h4 className="font-semibold text-[#546A7A]">
                        {selectedZones.length} Zone{selectedZones.length === 1 ? '' : 's'} Selected
                      </h4>
                    </div>
                    <p className="text-sm text-[#546A7A] ml-11">
                      The service person will be assigned to the selected zones and can manage tickets and service operations within these areas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-[#92A2A5]">
          <div className="flex items-center gap-3 text-sm text-[#5D6E73]">
            <div className="h-8 w-8 rounded-lg bg-[#AEBFC3]/20 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-[#5D6E73]" />
            </div>
            <span className="font-medium">
              {selectedZones.length === 0
                ? 'No zones selected (service person can be assigned zones later)'
                : `${selectedZones.length} zone${selectedZones.length === 1 ? '' : 's'} selected for assignment`
              }
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/admin/service-person">
              <Button
                type="button"
                variant="outline"
                className="border-[#92A2A5] text-[#5D6E73] hover:bg-[#AEBFC3]/10 h-12 px-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A] shadow-lg h-12 px-8 min-w-[180px]"
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Create Service Person
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </MobileContainer>
  );
}
