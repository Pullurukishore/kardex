'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// Removed apiClient usage to avoid auth/shape mismatch for zones fetch
import { toast } from 'sonner';
import { Form } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api/axios';
import { Priority } from '@/types';
import { Customer, Contact } from '@/types/customer';
import { Asset } from '@/types/asset';
import { TicketFormHeader } from '@/components/tickets/TicketFormHeader';
import { TicketBasicInfoForm } from '@/components/tickets/TicketBasicInfoForm';
import { CustomerSelectionForm } from '@/components/tickets/CustomerSelectionForm';
import { TicketFormActions } from '@/components/tickets/TicketFormActions';
import dynamic from 'next/dynamic';

// Dynamically import dialogs to reduce initial bundle size
const AddContactDialog = dynamic(() => import('@/components/tickets/AddContactDialog').then(mod => mod.AddContactDialog), {
  loading: () => null,
  ssr: false
});

const AddAssetDialog = dynamic(() => import('@/components/tickets/AddAssetDialog').then(mod => mod.AddAssetDialog), {
  loading: () => null,
  ssr: false
});

const formSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  callType: z.enum(['UNDER_MAINTENANCE_CONTRACT', 'NOT_UNDER_CONTRACT'], {
    required_error: 'Call type is required',
  }),
  customerId: z.string().min(1, 'Customer is required'),
  contactId: z.string().min(1, 'Contact person is required'),
  assetId: z.string().min(1, 'Asset is required'),
  zoneId: z.union([
    z.number({
      required_error: 'Zone is required',
      invalid_type_error: 'Please select a zone'
    }),
    z.literal('all')
  ]),
  errorDetails: z.string().optional(),
  relatedMachineIds: z.string().optional(),
});

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
});

const assetSchema = z.object({
  model: z.string().min(2, 'Model must be at least 2 characters'),
  serialNo: z.string().min(3, 'Serial number must be at least 3 characters'),
});

type FormValues = z.infer<typeof formSchema>;
type ContactFormValues = z.infer<typeof contactSchema>;
type AssetFormValues = z.infer<typeof assetSchema>;

export default function CreateTicketPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
  const [customers, setCustomers] = useState<Array<{
    id: number;
    name: string;
    companyName: string;
    serviceZoneId: number;
    contacts: Array<{id: number, name: string, email: string, phone: string}>;
    assets: Array<{id: number, model?: string, serialNo?: string, serialNumber?: string}>;
  }>>([]);
  const [contacts, setContacts] = useState<Array<{id: number, name: string, email: string, phone: string}>>([]);
  const [assets, setAssets] = useState<Array<{id: number, model?: string, serialNo?: string, serialNumber?: string}>>([]);
  // Define the zone type with proper servicePersons structure
  type ZoneType = {
    id: number;
    name: string;
    description?: string;
    isActive: boolean;
    servicePersons: Array<{
      id: number;
      user: {
        id: number;
        email: string;
      };
    }>;
  };

  const [zones, setZones] = useState<ZoneType[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priority: 'MEDIUM',
    },
  });

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      phone: '',
    },
  });

  const assetForm = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      model: '',
      serialNo: '',
    },
  });

  // Fetch zones on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        // Use the shared axios instance that carries cookies and handles refresh
        const response = await api.get('/service-zones', {
          params: {
            limit: 100
          }
        });

        // Backend returns { data: ZoneType[], pagination: {...} }
        const zonesData: ZoneType[] = response.data?.data || [];
        setZones(zonesData);
      } catch (error) {
        toast.error('Failed to load service zones. Please try again.');
        setZones([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch customers when zone changes
  const zoneId = form.watch('zoneId');
  useEffect(() => {
    const fetchZoneCustomers = async () => {
      if (zoneId === undefined || zoneId === null) {
        setCustomers([]);
        setContacts([]);
        setAssets([]);
        form.setValue('customerId', '');
        form.setValue('contactId', '');
        form.setValue('assetId', '');
        return;
      }

      try {
        setIsLoadingCustomers(true);
        
        let customersRes;
        if (zoneId === 'all') {
          // Fetch all customers with assets
          customersRes = await api.get('/customers?hasAssets=true');
        } else {
          // Use the customers endpoint with zone filter and hasAssets=true
          customersRes = await api.get(`/customers?serviceZoneId=${zoneId}&hasAssets=true`);
        }
        
        const leanCustomers = customersRes.data.map((customer: any) => ({
          ...customer,
          contacts: customer.contacts || [],
          assets: customer.assets || []
        }));
        
        setCustomers(leanCustomers);
        
        // Reset customer-dependent fields
        form.setValue('customerId', '');
        form.setValue('contactId', '');
        form.setValue('assetId', '');
        setContacts([]);
        setAssets([]);
      } catch (error) {
        toast.error(zoneId === 'all' 
          ? 'Failed to load customers. Please try again.'
          : 'Failed to load customers for selected zone. Please try again.');
        setCustomers([]);
      } finally {
        setIsLoadingCustomers(false);
      }
    };

    fetchZoneCustomers();
  }, [zoneId]);

  // Watch additional required fields for validation
  const title = form.watch('title');
  const description = form.watch('description');
  const callType = form.watch('callType');
  const priority = form.watch('priority');
  const customerId = form.watch('customerId');
  const contactId = form.watch('contactId');
  const assetId = form.watch('assetId');

  // Check if all required fields are filled
  const isFormValid = Boolean(
    title && title.length >= 3 &&
    description && description.length >= 10 &&
    callType &&
    priority &&
    zoneId &&
    customerId &&
    contactId &&
    assetId
  );

  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Update contacts and assets when customer changes - Lazy load details
  useEffect(() => {
    const fetchCustomerDetails = async () => {
      if (!customerId) {
        setContacts([]);
        setAssets([]);
        form.setValue('contactId', '');
        form.setValue('assetId', '');
        return;
      }
      
      try {
        setIsLoadingDetails(true);
        // Fetch full customer details including contacts and assets
        const response = await api.get(`/customers/${customerId}?includeAssets=true`);
        const customerDetails = response.data;
        
        if (customerDetails) {
          const freshContacts = customerDetails.contacts || [];
          const freshAssets = customerDetails.assets || [];
          
          setContacts(freshContacts);
          setAssets(freshAssets);
          form.setValue('contactId', '');
          form.setValue('assetId', '');
          
          // If there's only one contact, auto-select it
          if (freshContacts.length === 1) {
            form.setValue('contactId', freshContacts[0].id.toString());
          }
          
          // If there's only one asset, auto-select it
          if (freshAssets.length === 1) {
            form.setValue('assetId', freshAssets[0].id.toString());
          }
        }
      } catch (error) {
        console.error('Failed to fetch customer details:', error);
        toast.error('Failed to load customer contacts and assets');
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchCustomerDetails();
  }, [customerId]);

  // Handle asset creation
  const handleCreateAsset = async (values: AssetFormValues) => {
    if (!customerId) {
      toast.error('Please select a customer first');
      return;
    }

    try {
      setIsCreatingAsset(true);
      
      const payload = {
        ...values,
        customerId: parseInt(customerId),
      };

      const response = await api.post('/assets', payload);
      const newAsset = response.data;
      
      // Update the assets list
      setAssets(prev => [...prev, newAsset]);
      
      // Update the customers array to include the new asset
      setCustomers(prev => prev.map(customer => 
        customer.id.toString() === customerId 
          ? { ...customer, assets: [...customer.assets, newAsset] }
          : customer
      ));
      
      // Auto-select the newly created asset
      form.setValue('assetId', newAsset.id.toString());
      
      // Reset the asset form and close dialog
      assetForm.reset();
      setIsAddAssetOpen(false);
      
      toast.success(`Asset "${newAsset.model}" has been created and selected.`);
    } catch (error: any) {
      let errorMessage = 'Failed to create asset. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsCreatingAsset(false);
    }
  };

  // Handle contact creation
  const handleCreateContact = async (values: ContactFormValues) => {
    if (!customerId) {
      toast.error('Please select a customer first');
      return;
    }

    try {
      setIsCreatingContact(true);
      
      const payload = {
        ...values,
        customerId: parseInt(customerId),
      };

      const response = await api.post('/contacts', payload);
      const newContact = response.data;
      
      // Update the contacts list
      setContacts(prev => [...prev, newContact]);
      
      // Update the customers array to include the new contact
      setCustomers(prev => prev.map(customer => 
        customer.id.toString() === customerId 
          ? { ...customer, contacts: [...customer.contacts, newContact] }
          : customer
      ));
      
      // Auto-select the newly created contact
      form.setValue('contactId', newContact.id.toString());
      
      // Reset the contact form and close dialog
      contactForm.reset();
      setIsAddContactOpen(false);
      
      toast.success(`Contact "${newContact.name}" has been created and selected.`);
    } catch (error: any) {
      let errorMessage = 'Failed to create contact. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsCreatingContact(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      
      // If "All Zones" is selected, use the customer's actual zone ID
      let actualZoneId = values.zoneId;
      if (values.zoneId === 'all') {
        const selectedCustomer = customers.find(c => c.id === parseInt(values.customerId));
        if (selectedCustomer) {
          actualZoneId = selectedCustomer.serviceZoneId;
        } else {
          throw new Error('Customer not found. Please select a valid customer.');
        }
      }
      
      const response = await api.post('/tickets', {
        ...values,
        // Convert string IDs to numbers for the API
        customerId: parseInt(values.customerId),
        contactId: parseInt(values.contactId),
        assetId: parseInt(values.assetId),
        // Use the actual zone ID (either selected zone or customer's zone)
        zoneId: actualZoneId,
        relatedMachineIds: values.relatedMachineIds 
          ? values.relatedMachineIds.split(',').map((id: string) => id.trim())
          : undefined,
      });

      const ticketData = response.data;
      
      // Get customer and zone names for better success message
      const selectedCustomer = customers.find(c => c.id === parseInt(values.customerId));
      let zoneName = 'selected zone';
      if (values.zoneId === 'all') {
        const customerZone = zones.find(z => z.id === selectedCustomer?.serviceZoneId);
        zoneName = customerZone?.name || 'customer\'s zone';
      } else {
        const selectedZone = zones.find(z => z.id === values.zoneId);
        zoneName = selectedZone?.name || 'selected zone';
      }
      
      // Show success toast
      toast.success(`🎉 Ticket #${ticketData?.ticketNumber ?? ticketData?.id} created for ${selectedCustomer?.companyName || 'customer'} in ${zoneName}`);
      
      // Reset form to allow creating another ticket if needed
      form.reset({
        priority: 'MEDIUM',
      });
      
      // Redirect to tickets page
      setTimeout(() => {
        router.push('/admin/tickets');
        router.refresh();
      }, 1500);
    } catch (error: any) {
      let errorMessage = 'Failed to create ticket. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(`❌ Error Creating Ticket: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#AEBFC3]/10 via-red-50/30 to-[#EEC1BF]/10/30"></div>
        <div className="absolute top-20 right-20 w-72 h-72 bg-[#E17F70]/30/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-[#CE9F6B]/30/30 rounded-full blur-3xl animate-pulse delay-300"></div>
        
        <div className="relative z-10 flex flex-col items-center space-y-6">
          {/* Loading icon with animation */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] rounded-2xl blur-xl opacity-40 animate-pulse"></div>
            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-[#E17F70] via-[#CE9F6B] to-[#9E3B47] flex items-center justify-center shadow-2xl">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-[#546A7A]">Loading Form Data</h3>
            <p className="text-[#AEBFC3]0 max-w-md">Preparing the ticket creation form. Please wait...</p>
          </div>
          
          {/* Loading skeleton preview */}
          <div className="w-full max-w-md space-y-3 mt-4">
            <div className="h-3 bg-[#92A2A5]/30/80 rounded-full w-3/4 mx-auto animate-pulse"></div>
            <div className="h-3 bg-[#92A2A5]/30/80 rounded-full w-1/2 mx-auto animate-pulse delay-75"></div>
            <div className="h-3 bg-[#92A2A5]/30/80 rounded-full w-2/3 mx-auto animate-pulse delay-150"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-gray-50 to-[#AEBFC3]/20">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
        <TicketFormHeader 
          onBack={() => router.back()}
          isSubmitting={isSubmitting}
        />
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TicketBasicInfoForm 
              control={form.control}
              zones={zones}
              isSubmitting={isSubmitting}
            />
            
            <CustomerSelectionForm 
              control={form.control}
              customers={customers}
              contacts={contacts}
              assets={assets}
              zoneId={zoneId === 'all' ? 'all' : (zoneId !== undefined ? Number(zoneId) : undefined)}
              customerId={customerId}
              isSubmitting={isSubmitting}
              isLoadingCustomers={isLoadingCustomers || isLoadingDetails}
              onAddContactClick={() => setIsAddContactOpen(true)}
              onAddAssetClick={() => setIsAddAssetOpen(true)}
            />
            
            <TicketFormActions 
              isSubmitting={isSubmitting}
              onCancel={() => router.back()}
              isFormValid={isFormValid}
            />
          </form>
        </Form>

        <AddContactDialog 
          open={isAddContactOpen}
          onOpenChange={setIsAddContactOpen}
          onSubmit={handleCreateContact}
          isCreating={isCreatingContact}
        />

        <AddAssetDialog 
          open={isAddAssetOpen}
          onOpenChange={setIsAddAssetOpen}
          onSubmit={handleCreateAsset}
          isCreating={isCreatingAsset}
        />
      </div>
    </div>
  );
}