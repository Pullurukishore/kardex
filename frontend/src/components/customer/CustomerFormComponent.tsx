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
import { ArrowLeft, Building2, Contact, Loader2, MapPin, Phone, Mail, Globe, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
        // Fetch all service zones with a high limit to get all records
        const response = await getServiceZones(1, 100);
        const zones = response.data || [];
        setServiceZones(zones);

        // Auto-select first zone if none is selected and we have zones
        const currentZoneId = form.getValues('serviceZoneId');
        if ((!currentZoneId || currentZoneId === 0) && zones.length > 0) {
          form.setValue('serviceZoneId', zones[0].id, { shouldValidate: true });
        }

        // If no service zones were found, show a warning
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

      // Convert status to isActive for the backend (Prisma uses isActive: Boolean)
      const isActive = data.status === 'ACTIVE';

      // Prepare request data with all fields
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

      if (customer && customerId) {
        await updateCustomer(customerId, requestData);
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

      const currentPath = window.location.pathname;
      if (currentPath.includes('/expert/')) {
        router.push('/expert/customers');
      } else {
        router.push('/admin/customers');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to process customer. Please try again.';

      setFormError(errorMessage);

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-semibold">
                  {customer ? 'Edit Customer' : 'Add New Customer'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {customer ? 'Update the customer details' : 'Enter the customer details below'}
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {formError && (
              <div className="rounded-lg border border-[#E17F70] bg-[#E17F70]/10 p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-[#9E3B47]" />
                  <div>
                    <h3 className="text-sm font-medium text-[#75242D]">
                      {customer ? 'Error Updating Customer' : 'Error Creating Customer'}
                    </h3>
                    <p className="text-sm text-[#75242D] mt-1">{formError}</p>
                  </div>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card className="overflow-hidden border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 border-b">
                    <CardTitle className="flex items-center space-x-2 text-[#546A7A]">
                      <Building2 className="h-5 w-5" />
                      <span>Company Information</span>
                    </CardTitle>
                    <CardDescription className="text-[#546A7A]">
                      Enter the basic company details and contact information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Company Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter company name"
                                {...field}
                                className="transition-all duration-200 focus:ring-2 focus:ring-[#96AEC2]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Industry *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Technology, Healthcare"
                                {...field}
                                className="transition-all duration-200 focus:ring-2 focus:ring-[#96AEC2]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Address *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter complete address"
                              {...field}
                              className="transition-all duration-200 focus:ring-2 focus:ring-[#96AEC2]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serviceZoneId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Service Zone *</FormLabel>
                          <Select
                            value={field.value ? String(field.value) : ''}
                            onValueChange={(val) => field.onChange(Number(val))}
                          >
                            <FormControl>
                              <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-[#96AEC2]">
                                <SelectValue placeholder="Select a service zone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {serviceZones.length > 0 ? (
                                serviceZones.map((zone) => (
                                  <SelectItem key={zone.id} value={zone.id.toString()}>
                                    {zone.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No service zones available
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                          {serviceZones.length === 0 && (
                            <p className="text-xs text-[#E17F70] mt-1">
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
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-[#96AEC2]">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ACTIVE">
                                <Badge variant="default" className="bg-[#A2B9AF]/20 text-[#4F6A64]">
                                  Active
                                </Badge>
                              </SelectItem>
                              <SelectItem value="INACTIVE">
                                <Badge variant="secondary" className="bg-[#AEBFC3]/20 text-[#546A7A]">
                                  Inactive
                                </Badge>
                              </SelectItem>
                              <SelectItem value="SUSPENDED">
                                <Badge variant="destructive" className="bg-[#E17F70]/20 text-[#75242D]">
                                  Suspended
                                </Badge>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 border-b">
                    <CardTitle className="flex items-center space-x-2 text-[#4F6A64]">
                      <Contact className="h-5 w-5" />
                      <span>Contact Information</span>
                    </CardTitle>
                    <CardDescription className="text-[#4F6A64]">
                      Enter the primary contact person details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Contact Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Full name"
                                {...field}
                                className="transition-all duration-200 focus:ring-2 focus:ring-[#96AEC2]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Contact Phone *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Phone number"
                                {...field}
                                maxLength={10}
                                className="transition-all duration-200 focus:ring-2 focus:ring-[#96AEC2]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="h-11 px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="min-w-[140px] h-11 bg-gradient-to-r from-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:to-blue-800 shadow-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {customer ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {customer ? 'Update Customer' : 'Create Customer'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
