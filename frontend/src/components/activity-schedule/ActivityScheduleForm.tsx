'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, AlertCircle, Loader, Search, X, Building2, Settings } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { getServicePersons } from '@/services/user.service';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api/axios';

interface ServicePerson {
  id: number;
  name: string | null;
  email: string;
  phone?: string;
}

interface Ticket {
  id: number;
  ticketNumber?: number;
  title: string;
  status: string;
  assignmentStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  // Scalar IDs from the ticket
  customerId?: number;
  zoneId?: number;
  assetId?: number;
  // Nested relations
  customer?: {
    id?: number;
    companyName?: string;
    address?: string;
  };
  zone?: {
    id?: number;
    name?: string;
  };
  asset?: {
    id?: number;
    model?: string;
    serialNo?: string;
  };
}

interface ActivityScheduleFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: any;
  isEditing?: boolean;
}

const ACTIVITY_TYPES = [
  'TICKET_WORK',
  'BD_VISIT',
  'PO_DISCUSSION',
  'SPARE_REPLACEMENT',
  'TRAVEL',
  'TRAINING',
  'MEETING',
  'MAINTENANCE',
  'DOCUMENTATION',
  'OTHER',
  'WORK_FROM_HOME',
  'INSTALLATION',
  'MAINTENANCE_PLANNED',
  'REVIEW_MEETING',
  'RELOCATION',
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function ActivityScheduleForm({
  onSuccess,
  onCancel,
  initialData,
  isEditing = false,
}: ActivityScheduleFormProps) {
  const { user } = useAuth();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // Determine role from user object first, fallback to pathname
  const isAdmin = user?.role === 'ADMIN' || pathname.includes('/admin/');
  const isZone = user?.role === 'ZONE_MANAGER' || user?.role === 'ZONE_USER' || pathname.includes('/zone/');
  const isExpert = user?.role === 'EXPERT_HELPDESK' || pathname.includes('/expert/');

  const [formData, setFormData] = useState({
    servicePersonIds: initialData?.servicePersonIds || (initialData?.servicePersonId ? [initialData.servicePersonId] : []),
    description: initialData?.description || '',
    activityType: initialData?.activityType || 'TICKET_WORK',
    priority: initialData?.priority || 'MEDIUM',
    scheduledDate: initialData?.scheduledDate ? new Date(initialData.scheduledDate).toISOString().slice(0, 16) : '',
    estimatedDuration: initialData?.estimatedDuration || 1,
    location: initialData?.location || '',
    ticketId: initialData?.ticketId ? String(initialData.ticketId) : '',
    notes: initialData?.notes || '',
    // Convert zoneId and customerId to strings for Select components
    zoneId: initialData?.zoneId != null ? String(initialData.zoneId) : '',
    customerId: initialData?.customerId != null ? String(initialData.customerId) : '',
    assetIds: initialData?.assetIds ? initialData.assetIds.map((id: any) => typeof id === 'string' ? id : String(id)) : [],
  });

  const [servicePersons, setServicePersons] = useState<ServicePerson[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(initialData?.ticket || null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Pre-seed zones, customers, assets from initialData so they display immediately
  const [zones, setZones] = useState<any[]>(initialData?.zone ? [initialData.zone] : []);
  const [customers, setCustomers] = useState<any[]>(initialData?.customer ? [{
    ...initialData.customer,
    assets: initialData?.assets || []
  }] : []);
  const [assets, setAssets] = useState<any[]>(initialData?.assets || []);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);

  // Fetch initial data (service persons and zones)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        console.log('Fetching initial data, isAdmin:', isAdmin);

        // Fetch service persons
        const personsResponse = await getServicePersons();
        let persons: ServicePerson[] = [];
        const responseData = personsResponse as any;

        if (responseData.success && responseData.data) {
          persons = responseData.data;
        } else if (Array.isArray(responseData.users)) {
          persons = responseData.users;
        } else if (Array.isArray(personsResponse.data)) {
          persons = personsResponse.data;
        } else if (responseData.data?.users && Array.isArray(responseData.data.users)) {
          persons = responseData.data.users;
        } else if (responseData.data?.data && Array.isArray(responseData.data.data)) {
          persons = responseData.data.data;
        }

        console.log('Fetched service persons:', persons);
        setServicePersons(persons);

        // Fetch zones - for admin, zone users, zone managers, expert helpdesk, or when editing
        if (isAdmin || isZone || isExpert || isEditing) {
          console.log('Fetching zones...');
          const zonesResponse = await api.get('/service-zones', { params: { limit: 100 } });
          console.log('Zones response:', zonesResponse);
          const zonesData = zonesResponse.data?.data || [];
          console.log('Zones data:', zonesData);
          setZones(zonesData);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [isAdmin, isZone, isExpert, isEditing, user]);

  // Handle initial data when editing
  useEffect(() => {
    if (isEditing && initialData) {
      console.log('Editing mode, initial data:', initialData);

      // Set zone, customer, and assets from initial data
      if (initialData.zoneId && formData.zoneId !== initialData.zoneId.toString()) {
        setFormData(prev => ({
          ...prev,
          zoneId: initialData.zoneId.toString(),
        }));
      }

      if (initialData.customerId && formData.customerId !== initialData.customerId.toString()) {
        setFormData(prev => ({
          ...prev,
          customerId: initialData.customerId.toString(),
        }));
      }

      // Ensure zones list contains the initial zone (so Select has an option to show)
      if (initialData.zone && initialData.zone.id) {
        setZones(prev => {
          if (prev.some((z: any) => z.id === initialData.zone.id)) return prev;
          return [...prev, initialData.zone];
        });
      }

      // Ensure customers list contains the initial customer (for editing)
      if (initialData.customer && initialData.customer.id) {
        setCustomers(prev => {
          if (prev.some((c: any) => c.id === initialData.customer.id)) return prev;
          return [
            ...prev,
            {
              ...initialData.customer,
              // Attach assets from detail response if available
              assets: Array.isArray(initialData.assets) ? initialData.assets : [],
            },
          ];
        });
      }

      // Seed assets list directly from detail response when editing
      if (Array.isArray(initialData.assets) && initialData.assets.length > 0) {
        setAssets(prev => (prev && prev.length > 0 ? prev : initialData.assets));
      }

      // Normalize assetIds from backend into string array for the checkbox logic
      if (Array.isArray(initialData.assetIds) && initialData.assetIds.length > 0) {
        setFormData(prev => ({
          ...prev,
          assetIds: initialData.assetIds.map((id: any) =>
            typeof id === 'string' ? id : id != null ? String(id) : id
          ),
        }));
      }
    }
  }, [isEditing, initialData]);

  // Fetch customers when zone changes or when initial data is loaded
  useEffect(() => {
    const fetchZoneCustomers = async () => {
      console.log('Zone changed to:', formData.zoneId);

      if (!formData.zoneId) {
        console.log('No zone selected, clearing customers');
        // Don't clear if we have initial data (editing mode)
        if (!isEditing || !initialData?.customerId) {
          setCustomers([]);
          setAssets([]);
        }
        return;
      }

      try {
        setCustomersLoading(true);
        console.log('Fetching customers for zone:', formData.zoneId);

        let customersRes;
        if (formData.zoneId === 'all') {
          // Fetch all customers from all zones
          customersRes = await api.get('/customers?include=contacts,assets');
        } else {
          // Use the customers endpoint with zone filter
          customersRes = await api.get(`/customers?serviceZoneId=${formData.zoneId}&include=contacts,assets`);
        }

        console.log('Customers API response:', customersRes);

        // API returns array directly, not wrapped in data property
        let customersData = Array.isArray(customersRes.data) ? customersRes.data : customersRes.data?.data || [];

        console.log('Formatted customers data:', customersData);

        // Map the API response to match our expected format
        let formattedCustomers = customersData.map((customer: any) => ({
          ...customer,
          contacts: customer.contacts || [],
          assets: customer.assets || []
        }));

        // When editing, ensure the initial customer is in the list and has the correct assets
        if (isEditing && initialData?.customer && initialData.customer.id) {
          const initialCustomerIndex = formattedCustomers.findIndex((c: any) => c.id === initialData.customer.id);
          const initialAssets = Array.isArray(initialData.assets) ? initialData.assets : [];

          if (initialCustomerIndex === -1) {
            // Customer not in list, add it with initial assets
            formattedCustomers = [
              {
                ...initialData.customer,
                assets: initialAssets,
              },
              ...formattedCustomers
            ];
          } else {
            // Customer exists in list - merge initial assets with fetched assets
            // Prioritize initial assets to ensure selected assets are available
            const existingCustomer = formattedCustomers[initialCustomerIndex];
            const existingAssets = existingCustomer.assets || [];

            // Combine initial assets with fetched assets, avoiding duplicates
            const mergedAssets = [...initialAssets];
            existingAssets.forEach((asset: any) => {
              if (!mergedAssets.some((a: any) => a.id === asset.id)) {
                mergedAssets.push(asset);
              }
            });

            formattedCustomers[initialCustomerIndex] = {
              ...existingCustomer,
              assets: mergedAssets,
            };
          }
        }

        console.log('Setting customers:', formattedCustomers);
        setCustomers(formattedCustomers);

        // Only clear assets if not editing or if zone actually changed from initial
        if (!isEditing || (initialData?.zoneId && formData.zoneId !== initialData.zoneId.toString())) {
          setAssets([]);
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error(formData.zoneId === 'all'
          ? 'Failed to load customers from all zones'
          : 'Failed to load customers for selected zone');
        // Don't clear customers if we have initial data
        if (!isEditing || !initialData?.customerId) {
          setCustomers([]);
        }
      } finally {
        setCustomersLoading(false);
      }
    };

    fetchZoneCustomers();
  }, [formData.zoneId, isEditing, initialData?.zoneId, initialData?.customerId, initialData?.customer, initialData?.assets]);

  // Update assets when customer changes
  useEffect(() => {
    if (!formData.customerId) {
      // Don't clear assets if editing and we have initial assets
      if (!isEditing || !initialData?.assetIds?.length) {
        setAssets([]);
        setFormData(prev => ({
          ...prev,
          assetIds: [],
        }));
      }
      return;
    }

    const isInitialCustomer = isEditing && initialData?.customerId?.toString() === formData.customerId;
    const selectedCustomer = customers.find(c => c.id.toString() === formData.customerId);

    // Determine which assets to use
    let assetsToUse: any[] = [];

    if (isInitialCustomer && initialData?.assets?.length) {
      // When editing and customer hasn't changed, always use initial assets
      // This ensures the backend-fetched asset details are preserved
      assetsToUse = initialData.assets;
    } else if (selectedCustomer?.assets?.length) {
      // Use selected customer's assets from the fetched customers list
      assetsToUse = selectedCustomer.assets;
    } else if (isEditing && isInitialCustomer) {
      // Fallback for editing mode: use initial assets if available
      assetsToUse = initialData?.assets || [];
    }

    setAssets(assetsToUse);

    // Preserve initial asset IDs when editing and customer hasn't changed
    if (isInitialCustomer && initialData?.assetIds?.length) {
      setFormData(prev => ({
        ...prev,
        assetIds: initialData.assetIds.map((id: any) => typeof id === 'string' ? id : String(id)),
      }));
    } else if (!isInitialCustomer) {
      // Customer changed from initial - clear asset selection
      setFormData(prev => ({
        ...prev,
        assetIds: [],
      }));
    }
  }, [formData.customerId, customers, isEditing, initialData?.customerId, initialData?.assets, initialData?.assetIds]);

  // Fetch tickets based on activity type - only shows tickets assigned to the current user
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        if (formData.activityType === 'TICKET_WORK') {
          // API uses role-based filtering - for Zone Users/Zone Managers/Service Persons,
          // it returns only tickets assigned to them
          const response: any = await apiClient.get('/tickets?limit=100');
          let ticketData: Ticket[] = [];

          if (response.data && Array.isArray(response.data)) {
            ticketData = response.data;
          } else if (Array.isArray(response)) {
            ticketData = response;
          } else if (response.tickets && Array.isArray(response.tickets)) {
            ticketData = response.tickets;
          }

          // Filter tickets:
          // 1. Must be ACCEPTED (user has accepted the assignment)
          // 2. Must not be CLOSED or CANCELLED
          ticketData = ticketData.filter((ticket: any) =>
            ticket.assignmentStatus === 'ACCEPTED' &&
            !['CLOSED', 'CANCELLED'].includes(ticket.status)
          );

          setTickets(ticketData);
        } else {
          setTickets([]);
          setFormData(prev => ({
            ...prev,
            ticketId: ''
          }));
        }
      } catch (error) {
        console.error('Error fetching tickets:', error);
        toast.error('Failed to load tickets');
      }
    };

    fetchTickets();
  }, [formData.activityType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value,
      };

      // When a ticket is selected in TICKET_WORK mode, auto-populate zone, customer, asset
      if (name === 'ticketId' && value && prev.activityType === 'TICKET_WORK') {
        const ticket = tickets.find(t => t.id.toString() === value);
        if (ticket) {
          setSelectedTicket(ticket);
          // Auto-populate zone - use scalar zoneId or nested zone.id
          const ticketZoneId = ticket.zoneId || ticket.zone?.id;
          if (ticketZoneId) {
            newData.zoneId = ticketZoneId.toString();
          }
          // Auto-populate customer - use scalar customerId or nested customer.id
          const ticketCustomerId = ticket.customerId || ticket.customer?.id;
          if (ticketCustomerId) {
            newData.customerId = ticketCustomerId.toString();
          }
          // Auto-populate asset - use scalar assetId or nested asset.id
          const ticketAssetId = ticket.assetId || ticket.asset?.id;
          if (ticketAssetId) {
            newData.assetIds = [ticketAssetId.toString()];
          }
          // Auto-populate location from customer address if available
          if (ticket.customer?.address && !newData.location) {
            newData.location = ticket.customer.address;
          }
        }
      }

      // When activity type changes from TICKET_WORK, clear selected ticket
      if (name === 'activityType' && value !== 'TICKET_WORK') {
        setSelectedTicket(null);
        newData.ticketId = '';
      }

      if (name === 'zoneId' && !selectedTicket) {
        newData.customerId = '';
        newData.assetIds = [];
      }

      if (name === 'customerId' && !selectedTicket) {
        newData.assetIds = [];
      }

      return newData;
    });
  };

  const handleServicePersonToggle = (id: number) => {
    setFormData(prev => {
      const ids = prev.servicePersonIds as number[];
      if (ids.includes(id)) {
        return {
          ...prev,
          servicePersonIds: ids.filter(spId => spId !== id),
        };
      } else {
        return {
          ...prev,
          servicePersonIds: [...ids, id],
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.servicePersonIds.length === 0) {
      toast.error('Please select at least one service person');
      return;
    }
    if (!formData.scheduledDate) {
      toast.error('Please select scheduled date and time');
      return;
    }
    if (formData.activityType === 'TICKET_WORK' && !formData.ticketId) {
      toast.error('Please select a ticket for Ticket Work activity');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        servicePersonIds: formData.servicePersonIds,
        description: formData.description || undefined,
        activityType: formData.activityType,
        priority: formData.priority,
        scheduledDate: new Date(formData.scheduledDate).toISOString(),
        estimatedDuration: formData.estimatedDuration ? parseFloat(formData.estimatedDuration) : undefined,
        location: formData.location || undefined,
        ticketId: formData.ticketId ? parseInt(formData.ticketId) : undefined,
        notes: formData.notes || undefined,
        zoneId: formData.zoneId ? parseInt(formData.zoneId) : undefined,
        customerId: formData.customerId ? parseInt(formData.customerId) : undefined,
        assetIds: formData.assetIds && formData.assetIds.length > 0 ? formData.assetIds : undefined,
      };

      let response;
      if (isEditing && initialData?.id) {
        response = await apiClient.patch(`/activity-schedule/${initialData.id}`, payload);
      } else {
        response = await apiClient.post('/activity-schedule', payload);
      }

      if (response.success) {
        toast.success(isEditing ? 'Schedule updated successfully' : 'Schedule created successfully');
        onSuccess?.();
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error.message || 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedServicePersons = servicePersons.filter(sp => (formData.servicePersonIds as number[]).includes(sp.id));

  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full">
      {/* SECTION 1: Service Person Selection */}
      <div className="space-y-4 pb-8 border-b-2 border-[#96AEC2]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-[#546A7A] to-[#546A7A] bg-clip-text text-transparent">Service Person Assignment</h3>
            <p className="text-sm text-[#AEBFC3]0 mt-1">Select one or more service persons to assign this activity</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Service Persons * (Select one or more)
          </Label>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#6F8A9D]" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-10 h-11 border-2 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-2 focus:ring-[#96AEC2]/50 rounded-lg transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#E17F70] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {(formData.servicePersonIds as number[]).length > 0 && (
            <div className="flex flex-wrap gap-2 p-4 bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 rounded-xl border-2 border-[#96AEC2]">
              <div className="w-full text-xs text-[#546A7A] font-medium mb-2">
                {(formData.servicePersonIds as number[]).length} selected
              </div>
              {selectedServicePersons.map(sp => (
                <div key={sp.id} className="flex items-center gap-2 bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white px-4 py-2 rounded-full text-sm font-medium shadow-md hover:shadow-lg transition-shadow">
                  <span>{sp.name || 'Unknown'}</span>
                  <button
                    type="button"
                    onClick={() => handleServicePersonToggle(sp.id)}
                    className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Count indicator */}
          <div className="flex items-center justify-between text-xs text-[#AEBFC3]0 px-1">
            <span>
              {servicePersons.filter(sp =>
                (sp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                sp.email.toLowerCase().includes(searchQuery.toLowerCase())
              ).length} of {servicePersons.length} service persons
              {searchQuery && ' (filtered)'}
            </span>
            {servicePersons.length > 30 && !searchQuery && (
              <span className="text-[#6F8A9D]">💡 Use search to find quickly</span>
            )}
          </div>

          <div className="border-2 border-[#92A2A5] rounded-xl p-4 max-h-[400px] overflow-y-auto space-y-2 bg-gradient-to-b from-white to-[#AEBFC3]/10 shadow-sm">
            {loading ? (
              <div className="text-center py-8 text-[#AEBFC3]0">
                <Loader className="h-5 w-5 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading service persons...</p>
              </div>
            ) : servicePersons.filter(sp =>
              (sp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              sp.email.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 ? (
              <div className="text-center py-8 text-[#979796]">
                <p className="text-sm">{searchQuery ? '🔍 No matching service persons found' : '👥 No service persons found'}</p>
              </div>
            ) : (
              servicePersons
                .filter(sp =>
                  (sp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  sp.email.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(sp => (
                  <label key={sp.id} className="flex items-center gap-3 p-4 hover:bg-[#96AEC2]/20 hover:bg-opacity-50 rounded-lg cursor-pointer transition-all border border-transparent hover:border-[#96AEC2]">
                    <input
                      type="checkbox"
                      checked={(formData.servicePersonIds as number[]).includes(sp.id)}
                      onChange={() => handleServicePersonToggle(sp.id)}
                      className="w-5 h-5 rounded border-2 border-[#92A2A5] cursor-pointer accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#546A7A]">{sp.name || 'Unknown'}</div>
                      <div className="text-xs text-[#AEBFC3]0 truncate">{sp.email}</div>
                      {sp.phone && <div className="text-xs text-[#979796] mt-1">📱 {sp.phone}</div>}
                    </div>
                    {(formData.servicePersonIds as number[]).includes(sp.id) && (
                      <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-full flex items-center justify-center shadow-md">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                  </label>
                ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Activity Details */}
      <div className="space-y-4 pb-8 border-b-2 border-[#6F8A9D]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#6F8A9D] to-[#E17F70] rounded-xl">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-[#546A7A] to-[#9E3B47] bg-clip-text text-transparent">Activity Details</h3>
            <p className="text-sm text-[#AEBFC3]0 mt-1">Provide information about the activity to be scheduled</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-[#5D6E73] font-semibold">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Additional details about the activity..."
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="border-2 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-2 focus:ring-purple-200 rounded-lg transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="activityType" className="text-[#5D6E73] font-semibold">Activity Type *</Label>
            <Select value={formData.activityType} onValueChange={(value) => handleSelectChange('activityType', value)}>
              <SelectTrigger id="activityType" className="border-2 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-2 focus:ring-purple-200 h-11 rounded-lg transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority" className="text-[#5D6E73] font-semibold">Priority *</Label>
            <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
              <SelectTrigger id="priority" className="border-2 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-2 focus:ring-purple-200 h-11 rounded-lg transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(priority => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Related Ticket - only shown for TICKET_WORK activity type */}
        {formData.activityType === 'TICKET_WORK' && (
          <div className="space-y-2">
            <Label htmlFor="ticketId" className="text-[#5D6E73] font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Related Ticket *
            </Label>
            <Select value={formData.ticketId} onValueChange={(value) => handleSelectChange('ticketId', value)}>
              <SelectTrigger id="ticketId" className="border-2 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-2 focus:ring-purple-200 h-11 rounded-lg transition-all">
                <SelectValue placeholder="Select a ticket (required for Ticket Work)" />
              </SelectTrigger>
              <SelectContent>
                {tickets.length === 0 ? (
                  <div className="py-4 px-2 text-center text-[#AEBFC3]0 text-sm">
                    No assigned tickets found
                  </div>
                ) : (
                  tickets.map(ticket => (
                    <SelectItem key={ticket.id} value={ticket.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{ticket.ticketNumber ?? ticket.id}</span>
                        <span className="text-[#5D6E73]">-</span>
                        <span className="truncate max-w-[200px]">{ticket.title}</span>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${ticket.status === 'ASSIGNED' ? 'bg-[#96AEC2]/20 text-[#546A7A]' :
                            ticket.status === 'OPEN' ? 'bg-[#CE9F6B]/20 text-[#976E44]' :
                              ticket.status === 'IN_PROGRESS' ? 'bg-[#6F8A9D]/20 text-[#546A7A]' :
                                'bg-[#AEBFC3]/20 text-[#5D6E73]'
                          }`}>
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* SECTION 3: Scheduling Details */}
      <div className="space-y-4 pb-8 border-b-2 border-[#A2B9AF]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#82A094] to-[#82A094] rounded-xl">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-[#4F6A64] to-[#4F6A64] bg-clip-text text-transparent">Scheduling Details</h3>
            <p className="text-sm text-[#AEBFC3]0 mt-1">Set when and where the activity should take place</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="scheduledDate" className="text-[#5D6E73] font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Date & Time *
            </Label>
            <Input
              id="scheduledDate"
              name="scheduledDate"
              type="datetime-local"
              value={formData.scheduledDate}
              onChange={handleInputChange}
              required
              className="border-2 border-[#92A2A5] focus:border-[#82A094] focus:ring-2 focus:ring-[#A2B9AF]/50 h-11 rounded-lg transition-all"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedDuration" className="text-[#5D6E73] font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Estimated Duration (hours)
            </Label>
            <Input
              id="estimatedDuration"
              name="estimatedDuration"
              type="number"
              min="0.5"
              step="0.5"
              value={formData.estimatedDuration}
              onChange={handleInputChange}
              className="border-2 border-[#92A2A5] focus:border-[#82A094] focus:ring-2 focus:ring-[#A2B9AF]/50 h-11 rounded-lg transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-[#5D6E73] font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </Label>
          <Input
            id="location"
            name="location"
            placeholder="e.g., Customer Office, Bangalore"
            value={formData.location}
            onChange={handleInputChange}
            className="border-2 border-[#92A2A5] focus:border-[#82A094] focus:ring-2 focus:ring-[#A2B9AF]/50 h-11 rounded-lg transition-all"
          />
        </div>
      </div>

      {/* SECTION 4: Zone & Customer Information - Only show for non-TICKET_WORK or when no ticket is selected */}
      {formData.activityType === 'TICKET_WORK' && selectedTicket ? (
        // Show read-only ticket info when a ticket is selected
        <div className="space-y-4 pb-8 border-b-2 border-[#CE9F6B]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#CE9F6B] to-[#CE9F6B] rounded-xl">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-[#976E44] to-[#976E44] bg-clip-text text-transparent">Ticket Information</h3>
              <p className="text-sm text-[#AEBFC3]0 mt-1">Auto-populated from selected ticket</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Zone */}
            <div className="p-4 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-xl border-2 border-[#CE9F6B]">
              <div className="flex items-center gap-2 text-[#976E44] text-xs font-medium mb-1">
                <MapPin className="h-3 w-3" />
                Zone
              </div>
              <div className="font-semibold text-[#546A7A]">
                {selectedTicket.zone?.name || 'Not assigned'}
              </div>
            </div>

            {/* Customer */}
            <div className="p-4 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-xl border-2 border-[#CE9F6B]">
              <div className="flex items-center gap-2 text-[#976E44] text-xs font-medium mb-1">
                <Building2 className="h-3 w-3" />
                Customer
              </div>
              <div className="font-semibold text-[#546A7A]">
                {selectedTicket.customer?.companyName || 'Not assigned'}
              </div>
              {selectedTicket.customer?.address && (
                <div className="text-xs text-[#AEBFC3]0 mt-1">
                  📍 {selectedTicket.customer.address}
                </div>
              )}
            </div>

            {/* Asset */}
            <div className="p-4 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-xl border-2 border-[#CE9F6B] md:col-span-2">
              <div className="flex items-center gap-2 text-[#976E44] text-xs font-medium mb-1">
                <Settings className="h-3 w-3" />
                {formData.activityType === 'TICKET_WORK' ? 'Work Asset' : 'Asset'}
              </div>
              <div className="font-semibold text-[#546A7A]">
                {selectedTicket.asset ? (
                  <span>
                    {selectedTicket.asset.model || 'Unknown Model'}
                    {selectedTicket.asset.serialNo && ` - ${selectedTicket.asset.serialNo}`}
                  </span>
                ) : 'No asset assigned'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Show editable dropdowns for non-TICKET_WORK activities
        <div className="space-y-4 pb-8 border-b-2 border-[#CE9F6B]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#CE9F6B] to-[#CE9F6B] rounded-xl">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-[#976E44] to-[#976E44] bg-clip-text text-transparent">Zone & Customer Information</h3>
              <p className="text-sm text-[#AEBFC3]0 mt-1">Select the zone and customer for this activity</p>
            </div>
          </div>

          {(isAdmin || isZone || isExpert || isEditing) && (
            <div className="space-y-2">
              <Label htmlFor="zoneId" className="text-[#5D6E73] font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Zone {isAdmin && '*'}
              </Label>
              <Select
                value={formData.zoneId}
                onValueChange={(value) => handleSelectChange('zoneId', value)}
                disabled={loading}
              >
                <SelectTrigger id="zoneId" className="border-2 border-[#92A2A5] focus:border-[#CE9F6B] focus:ring-2 focus:ring-orange-200 h-11 rounded-lg transition-all disabled:opacity-50">
                  <SelectValue placeholder={loading ? 'Loading zones...' : 'Select a zone'} />
                </SelectTrigger>
                <SelectContent>
                  {zones.map(zone => (
                    <SelectItem key={zone.id} value={zone.id.toString()}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customerId" className="text-[#5D6E73] font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Customer
            </Label>
            <Select
              value={formData.customerId}
              onValueChange={(value) => handleSelectChange('customerId', value)}
              disabled={customersLoading || (!isAdmin && !isEditing && !formData.zoneId)}
            >
              <SelectTrigger id="customerId" className="border-2 border-[#92A2A5] focus:border-[#CE9F6B] focus:ring-2 focus:ring-orange-200 h-11 rounded-lg transition-all disabled:opacity-50">
                <SelectValue placeholder={
                  customersLoading ? 'Loading customers...' :
                    (!isAdmin && !isEditing && !formData.zoneId) ? 'Select a zone first' :
                      'Select a customer'
                } />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    {customer.companyName || customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* SECTION 5: Assets - Only show for non-TICKET_WORK activities */}
      {formData.activityType !== 'TICKET_WORK' && (
        <div className="space-y-4 pb-8 border-b-2 border-[#E17F70]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#E17F70] to-[#E17F70] rounded-xl">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-[#9E3B47] to-[#9E3B47] bg-clip-text text-transparent">
                Assets
              </h3>
              <p className="text-sm text-[#AEBFC3]0 mt-1">
                Select assets for this activity
              </p>
            </div>
          </div>

          {/* Show asset selection only when customer is selected */}
          {formData.customerId && (
            <div className="space-y-2">
              <Label className="text-[#5D6E73] font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Assets (Select multiple)
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-[#92A2A5] rounded-lg p-4 bg-gradient-to-b from-white to-[#AEBFC3]/10">
                {assetsLoading ? (
                  <div className="flex items-center gap-2 justify-center py-4">
                    <Loader className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading assets...</span>
                  </div>
                ) : assets.length === 0 ? (
                  <p className="text-sm text-[#AEBFC3]0 text-center py-4">No assets found for this customer</p>
                ) : (
                  assets.map(asset => (
                    <label key={asset.id} className="flex items-center gap-3 p-2 hover:bg-[#E17F70]/10 rounded cursor-pointer transition-colors">
                      <Checkbox
                        id={`asset-${asset.id}`}
                        checked={formData.assetIds?.includes(asset.id.toString()) || formData.assetIds?.includes(asset.id)}
                        onCheckedChange={() => {
                          const assetIds = [...(formData.assetIds || [])];
                          const assetIdStr = asset.id.toString();
                          if (assetIds.includes(assetIdStr) || assetIds.includes(asset.id)) {
                            setFormData(prev => ({
                              ...prev,
                              assetIds: assetIds.filter(id => id !== assetIdStr && id !== asset.id),
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              assetIds: [...assetIds, assetIdStr],
                            }));
                          }
                        }}
                      />
                      <Label htmlFor={`asset-${asset.id}`} className="text-sm cursor-pointer">
                        {asset.model || 'Unknown Model'} - {asset.serialNo || asset.serialNumber || 'No Serial'}
                      </Label>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 6: Additional Notes */}
      <div className="space-y-4 pb-8 border-b-2 border-[#546A7A]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] rounded-xl">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-[#546A7A] to-[#546A7A] bg-clip-text text-transparent">Additional Notes</h3>
            <p className="text-sm text-[#AEBFC3]0 mt-1">Add any extra notes or instructions</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-[#5D6E73] font-semibold">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Additional notes for the service person..."
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="border-2 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-2 focus:ring-indigo-200 rounded-lg transition-all resize-none"
          />
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-8 border-t-2 border-[#92A2A5]">
        <Button
          type="submit"
          disabled={submitting || loading}
          className="flex-1 bg-gradient-to-r from-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:to-[#546A7A] text-white font-semibold h-12 rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          {submitting ? (
            <>
              <Loader className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>{isEditing ? '✏️ Update Schedule' : '✨ Create Schedule'}</>
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="px-8 h-12 border-2 border-[#92A2A5] hover:border-[#979796] hover:bg-[#AEBFC3]/10 font-semibold rounded-lg transition-all"
          >
            ✕ Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
