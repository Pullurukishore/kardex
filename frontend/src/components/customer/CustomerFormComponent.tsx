"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { createCustomer, updateCustomer } from '@/services/customer.service';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { getServiceZones } from '@/services/zone.service';
import { ServiceZone } from '@/types/zone';
import {
  ArrowLeft,
  Building2,
  Contact,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle2,
  Users,
  Sparkles,
  UserPlus,
  Factory,
  FileText,
  Shield,
  BadgeCheck,
  CircleDot,
  User,
  Hash,
  Badge as BadgeIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const customerFormSchema = z.object({
  // Company Information
  companyName: z.string().min(2, 'Company name is required'),
  industry: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  serviceZoneId: z.number().min(1, 'Service zone is required'),

  // Contact Information
  contactName: z.string().min(2, 'Contact name is required'),
  contactPhone: z.string().regex(/^\d{10}$/, 'Contact phone must be exactly 10 digits'),
  contactEmail: z.string().email('Valid email is required').optional().or(z.literal('')),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormComponentProps {
  customer?: {
    companyName: string;
    industry?: string;
    address?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    serviceZoneId: number;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
  };
  customerId?: number;
}

export default function CustomerFormComponent({ customer, customerId }: CustomerFormComponentProps) {
  const router = useRouter();
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const isEditing = !!customer && !!customerId;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    mode: 'onChange',
    defaultValues: customer ? {
      companyName: customer.companyName,
      industry: customer.industry || '',
      address: customer.address || '',
      status: customer.status || 'ACTIVE',
      serviceZoneId: customer.serviceZoneId,
      contactName: customer.contactName,
      contactPhone: customer.contactPhone,
      contactEmail: customer.contactEmail || '',
    } : {
      companyName: '',
      industry: '',
      address: '',
      status: 'ACTIVE',
      serviceZoneId: 0,
      contactName: '',
      contactPhone: '',
      contactEmail: ''
    }
  });

  useEffect(() => {
    const loadServiceZones = async () => {
      try {
        const response = await getServiceZones(1, 100);
        const zones = response.data || [];
        setServiceZones(zones);

        const currentZoneId = form.getValues('serviceZoneId');
        if ((!currentZoneId || currentZoneId === 0) && zones.length > 0) {
          form.setValue('serviceZoneId', zones[0].id, { shouldValidate: true });
        }

        if (zones.length === 0) {
          toast.warning('No Service Zones', {
            description: 'No service zones found. Please create service zones first.',
          });
        }
      } catch (error) {
        console.error('Error loading service zones:', error);
        toast.error('Error loading service zones', {
          description: 'Failed to load service zones. Please try again later.',
        });
      }
    };

    loadServiceZones();
  }, [form]);

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      setFormError(null);
      setIsLoading(true);

      const isActive = data.status === 'ACTIVE';

      const requestData = {
        companyName: data.companyName,
        address: data.address,
        industry: data.industry,
        isActive,
        serviceZoneId: data.serviceZoneId,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
      };

      if (isEditing) {
        await updateCustomer(customerId!, requestData);
        toast.success('Customer updated successfully', {
          description: 'The customer details have been updated.',
          icon: <CheckCircle2 className="h-5 w-5 text-[#82A094]" />,
        });
      } else {
        await createCustomer(requestData);
        toast.success('Customer created successfully', {
          description: 'The customer and their contact have been registered.',
          icon: <CheckCircle2 className="h-5 w-5 text-[#82A094]" />,
        });
      }

      if (!isEditing) {
        setCreated(true);
      } else {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/expert/')) {
          router.push('/expert/customers');
        } else {
          router.push('/admin/customers');
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to process customer. Please try again.';
      setFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (created) {
      const timeoutId = setTimeout(() => {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/expert/')) {
          router.push('/expert/customers');
        } else {
          router.push('/admin/customers');
        }
        router.refresh();
      }, 2500);
      return () => clearTimeout(timeoutId);
    }
  }, [created, router]);

  const handleImmediateRedirect = () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/expert/')) {
      router.push('/expert/customers');
    } else {
      router.push('/admin/customers');
    }
  };

  const backHref = typeof window !== 'undefined' && window.location.pathname.includes('/expert/')
    ? '/expert/customers'
    : '/admin/customers';

  // Success Screen
  if (created) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <Card className="text-center shadow-2xl border-0 bg-gradient-to-br from-[#A2B9AF]/10 to-[#96AEC2]/20 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-gradient-to-r from-[#4F6A64] to-[#6F8A9D] flex items-center justify-center shadow-lg animate-in zoom-in duration-500">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-[#CE9F6B] flex items-center justify-center animate-in spin-in duration-700">
                  <Sparkles className="h-3 w-3 text-[#976E44]" />
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-[#546A7A]">Customer Created Successfully!</CardTitle>
            <CardDescription className="text-[#5D6E73] mt-2">
              The new customer and primary contact have been registered. Redirecting automatically...
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={handleImmediateRedirect}
                className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] hover:from-[#3d5260] hover:to-[#546A7A] shadow-lg"
              >
                <Users className="mr-2 h-4 w-4" />
                Go to Customers
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
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A] p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        <div className="absolute top-1/2 right-16 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <Link href={backHref}>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 hover:text-white border border-white/30"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Customers
              </Button>
            </Link>
            <Badge className="bg-white/20 text-white hover:bg-white/30 border-white/30 text-xs">
              <Building2 className="mr-1 h-3 w-3" />
              {isEditing ? 'Edit Customer' : 'New Customer'}
            </Badge>
          </div>
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
              <Building2 className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {isEditing ? 'Edit Customer' : 'Register New Customer'}
              </h1>
              <p className="text-white/70 flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                {isEditing
                  ? 'Update company details and contact information'
                  : 'Enter company details and primary contact information'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden mb-2 px-1">
        <div className="flex items-center justify-between mb-4">
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#5D6E73] hover:text-[#546A7A]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <Badge className="bg-[#546A7A]/15 text-[#546A7A] border-[#546A7A]/30">
            <Building2 className="mr-1 h-3 w-3" />
            {isEditing ? 'Edit' : 'New'}
          </Badge>
        </div>
        <div className="ml-1">
          <h1 className="text-2xl font-bold text-[#546A7A]">
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </h1>
          <p className="text-sm text-[#5D6E73] mt-1">
            {isEditing
              ? 'Update company details and contact information'
              : 'Enter company details and primary contact'}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {formError && (
        <div className="rounded-xl border border-[#E17F70]/40 bg-gradient-to-r from-[#E17F70]/10 to-[#E17F70]/5 p-4 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#E17F70]/20 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-[#9E3B47]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#75242D]">
                {isEditing ? 'Error Updating Customer' : 'Error Creating Customer'}
              </h3>
              <p className="text-sm text-[#9E3B47] mt-0.5">{formError}</p>
            </div>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* ── Company Information Card ── */}
          <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white to-[#AEBFC3]/5">
            <CardHeader className="bg-gradient-to-r from-slate-100 to-gray-200 border-b border-[#92A2A5]/40 p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] flex items-center justify-center shadow-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-[#546A7A]">Company Information</CardTitle>
                  <CardDescription className="text-[#5D6E73]">
                    Enter the basic company details and service zone
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Company Name and Industry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                        <Building2 className="h-4 w-4 text-[#546A7A]" />
                        Company Name *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter company name"
                          {...field}
                          className={cn(
                            "h-12 text-base transition-all duration-200",
                            form.formState.errors.companyName
                              ? "border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50"
                              : "border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30"
                          )}
                        />
                      </FormControl>
                      <FormMessage className="text-[#E17F70] flex items-center gap-1 text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                        <Factory className="h-4 w-4 text-[#546A7A]" />
                        Industry
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Manufacturing, Healthcare"
                          {...field}
                          className="h-12 text-base border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30 transition-all duration-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                      <MapPin className="h-4 w-4 text-[#546A7A]" />
                      Address
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter complete company address"
                        {...field}
                        className="min-h-[100px] text-base border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30 transition-all duration-200 resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Service Zone and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="serviceZoneId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                        <MapPin className="h-4 w-4 text-[#4F6A64]" />
                        Service Zone *
                      </FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(val) => field.onChange(Number(val))}
                      >
                        <FormControl>
                          <SelectTrigger className={cn(
                            "h-12 text-base transition-all duration-200",
                            form.formState.errors.serviceZoneId
                              ? "border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50"
                              : "border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30"
                          )}>
                            <SelectValue placeholder="Select a service zone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {serviceZones.length > 0 ? (
                            serviceZones.map((zone) => (
                              <SelectItem key={zone.id} value={zone.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-[#A2B9AF]"></div>
                                  {zone.name}
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-sm text-[#5D6E73] text-center">
                              <MapPin className="h-5 w-5 mx-auto mb-2 text-[#92A2A5]" />
                              No service zones available
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[#E17F70]" />
                      {serviceZones.length === 0 && (
                        <p className="text-xs text-[#CE9F6B] bg-[#CE9F6B]/10 border border-[#CE9F6B]/30 rounded-lg p-2 flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3" />
                          No service zones found. Please create service zones first.
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                        <CircleDot className="h-4 w-4 text-[#546A7A]" />
                        Status
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30 transition-all duration-200">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#4F6A64]"></div>
                              <span className="font-medium text-[#4F6A64]">Active</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="INACTIVE">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#92A2A5]"></div>
                              <span className="font-medium text-[#546A7A]">Inactive</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="SUSPENDED">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#E17F70]"></div>
                              <span className="font-medium text-[#9E3B47]">Suspended</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Contact Information Card ── */}
          <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white to-[#A2B9AF]/5">
            <CardHeader className="bg-gradient-to-r from-[#A2B9AF]/15 to-[#82A094]/10 border-b border-[#A2B9AF]/30 p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-[#4F6A64] to-[#82A094] flex items-center justify-center shadow-lg">
                  <Contact className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-[#4F6A64]">Primary Contact</CardTitle>
                  <CardDescription className="text-[#5D6E73]">
                    Enter the primary contact person details for this customer
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                        <User className="h-4 w-4 text-[#4F6A64]" />
                        Contact Name *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter full name"
                          {...field}
                          className={cn(
                            "h-12 text-base transition-all duration-200",
                            form.formState.errors.contactName
                              ? "border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50"
                              : "border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30"
                          )}
                        />
                      </FormControl>
                      <FormMessage className="text-[#E17F70] flex items-center gap-1 text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                        <Phone className="h-4 w-4 text-[#4F6A64]" />
                        Contact Phone *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter 10-digit phone number"
                          {...field}
                          maxLength={10}
                          className={cn(
                            "h-12 text-base transition-all duration-200",
                            form.formState.errors.contactPhone
                              ? "border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50"
                              : "border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30"
                          )}
                        />
                      </FormControl>
                      <FormMessage className="text-[#E17F70] flex items-center gap-1 text-xs" />
                      <p className="text-xs text-[#5D6E73] bg-[#96AEC2]/10 p-2.5 rounded-lg border border-[#96AEC2]/30 flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-[#546A7A]" />
                        Phone number is used for WhatsApp notifications and alerts
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact Email */}
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                      <Mail className="h-4 w-4 text-[#4F6A64]" />
                      Contact Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@company.com"
                        {...field}
                        className="h-12 text-base border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/30 transition-all duration-200"
                      />
                    </FormControl>
                    <FormMessage className="text-[#E17F70]" />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Action Buttons ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-[#92A2A5]/30">
            <div className="flex items-center gap-3 text-sm text-[#5D6E73]">
              <div className="h-8 w-8 rounded-lg bg-[#AEBFC3]/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-[#5D6E73]" />
              </div>
              <span className="font-medium">
                {isEditing
                  ? 'Review the changes before saving'
                  : 'All required fields must be completed'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Link href={backHref}>
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
                disabled={isLoading}
                className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] hover:from-[#3d5260] hover:to-[#546A7A] shadow-lg h-12 px-8 min-w-[180px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isEditing ? 'Update Customer' : 'Create Customer'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
