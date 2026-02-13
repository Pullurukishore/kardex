'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import dynamic from 'next/dynamic'

const AddContactDialog = dynamic(() => import('@/components/offers/AddContactDialog'), {
  ssr: false
})

const AddAssetDialog = dynamic(() => import('@/components/offers/AddAssetDialog'), {
  ssr: false
})
import { ArrowLeft, Save, Loader2, Plus, Users, HardDrive, Search, X, Building2, MapPin, FileText, Calendar, DollarSign, Target, MessageSquare, Image } from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import { PRODUCT_TYPE_LABELS } from '@/types/reports'


export default function NewOfferPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingZones, setLoadingZones] = useState(true)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [zones, setZones] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [spareParts, setSpareParts] = useState<any[]>([])
  const [loadingSpareParts, setLoadingSpareParts] = useState(false)
  const [sparePartSearch, setSparePartSearch] = useState('')
  const [sparePartCategories, setSparePartCategories] = useState<string[]>([])
  
  // Dialog states
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false)
  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [isCreatingAsset, setIsCreatingAsset] = useState(false)
  
  // New contact/asset form data
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [newAsset, setNewAsset] = useState({ assetName: '', machineSerialNumber: '', model: '' })
  
  // Search states for dropdowns
  const [customerSearch, setCustomerSearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [assetSearch, setAssetSearch] = useState('')
  
  // Filtered lists based on search - memoized to prevent recalculation on every render
  const filteredCustomers = useMemo(() => 
    customers.filter(customer =>
      customer.companyName?.toLowerCase().includes(customerSearch.toLowerCase())
    ), [customers, customerSearch])
  
  const filteredContacts = useMemo(() => 
    contacts.filter(contact =>
      (contact.name || contact.contactPersonName)?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contact.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      (contact.phone || contact.contactNumber)?.includes(contactSearch)
    ), [contacts, contactSearch])
  
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const assetName = asset.serialNo || asset.machineId || asset.assetName || ''
      const model = asset.model || ''
      return assetName.toLowerCase().includes(assetSearch.toLowerCase()) ||
        model.toLowerCase().includes(assetSearch.toLowerCase())
    })
  }, [assets, assetSearch])
  
  
  const [formData, setFormData] = useState({
    // Essential Information for Initial Stage
    productType: '',
    lead: '',
    
    // Relations
    customerId: '',
    contactId: '',
    assetIds: [] as string[], // Changed to array for multiple assets
    zoneId: '',
    
    // Spare Parts for SPARE_PARTS (only if productType is SPARE_PARTS)
    spareParts: [] as Array<{
      name: string;
      photo: string;
      price: string;
      quantity?: string;
      total?: string;
    }>,
  })

  // Fetch zones on mount
  useEffect(() => {
    fetchZones()
  }, [])

  // Fetch spare parts when product type changes to SPARE_PARTS
  useEffect(() => {
    if (formData.productType === 'SPARE_PARTS') {
      fetchSpareParts()
    }
  }, [formData.productType])

  // Fetch customers when zone changes
  useEffect(() => {
    if (formData.zoneId) {
      fetchCustomersByZone(parseInt(formData.zoneId))
    } else {
      setCustomers([])
      setContacts([])
      setAssets([])
      setFormData(prev => ({ ...prev, customerId: '', contactId: '', assetIds: [], spareParts: [] }))
    }
  }, [formData.zoneId])

  // Update contacts and assets when customer changes
  useEffect(() => {
    if (formData.customerId) {
      const customer = customers.find(c => c.id === parseInt(formData.customerId))
      setSelectedCustomer(customer)
      if (customer) {
        fetchCustomerData(customer.id)
      }
    } else {
      setSelectedCustomer(null)
      setContacts([])
      setAssets([])
      setFormData(prev => ({ ...prev, contactId: '', assetIds: [], spareParts: [] }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.customerId])

  const fetchZones = async () => {
    try {
      setLoadingZones(true)
      const response = await apiService.getZones()
      setZones(response.data || [])
    } catch (error: any) {
      toast.error('Failed to fetch zones')
    } finally {
      setLoadingZones(false)
    }
  }

  const fetchCustomersByZone = async (zoneId: number) => {
    try {
      setLoadingCustomers(true)
      const customers = await apiService.getCustomers({ 
        zoneId, 
        limit: 100,
        include: 'contacts,assets'
      })
      
      setCustomers(Array.isArray(customers) ? customers : [])
      
      setFormData(prev => ({ ...prev, customerId: '', contactId: '', assetIds: [], spareParts: [] }))
      setContacts([])
      setAssets([])
    } catch (error: any) {
      toast.error(`Failed to fetch customers: ${error.response?.data?.message || error.message}`)
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }

  const fetchCustomerData = async (customerId: number) => {
    try {
      const response = await apiService.getCustomer(customerId)
      const customerData = response.customer || response
      setContacts(customerData?.contacts || [])
      setAssets(customerData?.assets || [])
      
      // Auto-select if only one option
      if (customerData?.contacts?.length === 1) {
        setFormData(prev => ({ ...prev, contactId: customerData.contacts[0].id.toString() }))
      }
    } catch (error: any) {
      toast.error('Failed to load customer details')
    }
  }

  const fetchSpareParts = async () => {
    try {
      setLoadingSpareParts(true)
      // Fetch all spare parts without pagination limit
      const response = await apiService.getSpareParts({ status: 'ACTIVE', limit: 1000 })
      const parts = response.spareParts || []
      setSpareParts(parts)
      
      // Extract unique categories
      const categories = [...new Set(parts.map((p: any) => p.category).filter(Boolean))] as string[]
      setSparePartCategories(categories)
    } catch (error: any) {
      toast.error('Failed to fetch spare parts')
    } finally {
      setLoadingSpareParts(false)
    }
  }

  const handleCreateContact = async () => {
    if (!formData.customerId) {
      toast.error('Please select a customer first')
      return
    }
    
    if (!newContact.name || !newContact.phone) {
      toast.error('Contact name and phone are required')
      return
    }

    try {
      setIsCreatingContact(true)
      const response = await apiService.createCustomerContact(
        parseInt(formData.customerId),
        {
          name: newContact.name,
          phone: newContact.phone,
          email: newContact.email || undefined // Only include if not empty
        }
      )
      
      // The API returns the created contact directly in response.data
      const createdContact = response.data;
      
      if (!createdContact || !createdContact.id) {
        console.error('Invalid contact creation response:', response);
        throw new Error('Failed to create contact: Invalid server response');
      }
      
      setContacts(prev => [...prev, createdContact]);
      setFormData(prev => ({ ...prev, contactId: createdContact.id.toString() }));
      
      // Reset form and close dialog
      setNewContact({ name: '', email: '', phone: '' })
      setIsAddContactOpen(false)
      toast.success('Contact created successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create contact')
    } finally {
      setIsCreatingContact(false)
    }
  }

  const handleCreateAsset = async () => {
    if (!formData.customerId) {
      toast.error('Please select a customer first')
      return
    }
    
    if (!newAsset.assetName || !newAsset.machineSerialNumber) {
      toast.error('Asset name and serial number are required')
      return
    }

    try {
      setIsCreatingAsset(true)
      const response = await apiService.createCustomerAsset(
        parseInt(formData.customerId),
        {
          ...newAsset,
          customerId: parseInt(formData.customerId)
        }
      )
      
      const createdAsset = response.asset || response
      setAssets(prev => [...prev, createdAsset])
      setFormData(prev => ({ ...prev, assetIds: [createdAsset.id.toString()] }))
      
      // Reset form and close dialog
      setNewAsset({ assetName: '', machineSerialNumber: '', model: '' })
      setIsAddAssetOpen(false)
      toast.success('Asset created successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create asset')
    } finally {
      setIsCreatingAsset(false)
    }
  }

  const handleInputChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation - Only essential fields for initial stage
    if (!formData.zoneId) {
      toast.error('Service zone is required')
      return
    }
    if (!formData.customerId) {
      toast.error('Customer is required')
      return
    }
    if (!formData.contactId) {
      toast.error('Contact person is required')
      return
    }
    if (formData.assetIds.length === 0) {
      toast.error('At least one asset is required')
      return
    }
    if (!formData.productType) {
      toast.error('Product type is required')
      return
    }
    if (!formData.lead) {
      toast.error('Lead status is required')
      return
    }
    
    // Validate spare parts if product type is SPARE_PARTS
    if (formData.productType === 'SPARE_PARTS' && formData.spareParts.length === 0) {
      toast.error('At least one spare part is required for SPARE_PARTS product type')
      return
    }
    
    if (formData.productType === 'SPARE_PARTS') {
      for (const part of formData.spareParts) {
        if (!part.name.trim()) {
          toast.error('All spare parts must have a name')
          return
        }
        if (!part.price || parseFloat(part.price) <= 0) {
          toast.error('All spare parts must have a valid price')
          return
        }
      }
    }

    setLoading(true)
    try {
      // Prepare data for API - Initial stage only
      const payload: any = {
        // Essential fields only
        productType: formData.productType,
        lead: formData.lead,
        customerId: parseInt(formData.customerId),
        contactId: parseInt(formData.contactId),
        assetIds: formData.assetIds.map(id => parseInt(id)),
        zoneId: parseInt(formData.zoneId),
        
        // Auto-generate title based on customer and product type
        title: `${PRODUCT_TYPE_LABELS[formData.productType] || formData.productType} - ${selectedCustomer?.companyName}`,
        
        // Add customer/contact/asset info for easy access
        company: selectedCustomer?.companyName,
        location: selectedCustomer?.location,
        department: selectedCustomer?.department,
        contactPersonName: contacts.find(c => c.id === parseInt(formData.contactId))?.name,
        contactNumber: contacts.find(c => c.id === parseInt(formData.contactId))?.phone,
        email: contacts.find(c => c.id === parseInt(formData.contactId))?.email,
        machineSerialNumber: formData.assetIds.length > 0 ? 
          formData.assetIds.map(assetId => {
            const asset = assets.find(a => a.id === parseInt(assetId));
            // Asset model uses serialNo, not machineSerialNumber
            return asset?.serialNo || asset?.machineId || asset?.assetName;
          }).filter(Boolean).join(', ') : null,
          
        // Include spare parts if SPARE_PARTS
        ...(formData.productType === 'SPARE_PARTS' && {
          spareParts: formData.spareParts.map(part => ({
            ...part,
            price: parseFloat(part.price)
          }))
        }),
        
        // Mark as initial stage
        stage: 'INITIAL',
        status: 'DRAFT'
      }

      await apiService.createOffer(payload)
      toast.success('Initial offer created successfully! You can add more details later.')
      router.push('/admin/offers')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create offer')
    } finally {
      setLoading(false)
    }
  }

  if (loadingZones) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/30"></div>
        <div className="absolute top-20 right-20 w-72 h-72 bg-[#96AEC2]/30/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-[#6F8A9D]/30/30 rounded-full blur-3xl animate-pulse delay-300"></div>
        
        <div className="relative z-10 flex flex-col items-center space-y-6">
          {/* Loading icon with animation */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] rounded-2xl blur-xl opacity-40 animate-pulse"></div>
            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-2xl">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-[#546A7A]">Loading Offer Form</h3>
            <p className="text-[#AEBFC3]0 max-w-md">Preparing zones and customers data. Please wait...</p>
          </div>
          
          {/* Loading skeleton preview */}
          <div className="w-full max-w-md space-y-3 mt-4">
            <div className="h-3 bg-[#92A2A5]/30/80 rounded-full w-3/4 mx-auto animate-pulse"></div>
            <div className="h-3 bg-[#92A2A5]/30/80 rounded-full w-1/2 mx-auto animate-pulse delay-75"></div>
            <div className="h-3 bg-[#92A2A5]/30/80 rounded-full w-2/3 mx-auto animate-pulse delay-150"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/30">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Premium Gradient Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="mb-4 hover:bg-white/80 backdrop-blur-sm transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] rounded-2xl p-8 shadow-2xl mb-6 transform hover:scale-[1.01] transition-transform duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-lg">
                  <Plus className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">Create New Offer</h1>
                  <p className="text-[#96AEC2]">Quick setup with essential details • Add more info later</p>
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm">
                <FileText className="h-5 w-5 text-white/80" />
                <span className="text-white font-medium">Initial Stage</span>
              </div>
            </div>
          </div>

          {/* Quick Info Card */}
          <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-[#6F8A9D] hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#96AEC2]/10 rounded-lg">
                <Target className="h-6 w-6 text-[#546A7A]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[#546A7A] text-lg mb-1">Initial Offer Setup</h3>
                <p className="text-sm text-[#5D6E73] leading-relaxed">
                  Start by selecting <span className="font-semibold text-[#546A7A]">Zone → Customer → Contact → Asset(s) → Product Type</span>. 
                  You can add financial details, quotes, and documents after the offer is created.
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer & Contact Information */}
        <Card className="shadow-xl border-0 bg-white overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#82A094] via-emerald-500 to-[#82A094]"></div>
          
          <CardHeader className="bg-gradient-to-br from-[#A2B9AF]/10 via-emerald-50/50 to-[#A2B9AF]/10/30 border-b border-[#A2B9AF]/20/50 pb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#82A094] to-[#82A094] flex items-center justify-center shadow-lg ring-2 ring-green-100">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-[#CE9F6B] to-[#CE9F6B] flex items-center justify-center shadow ring-2 ring-white">
                  <span className="text-xs font-bold text-white">1</span>
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-[#546A7A]">Customer & Contact Information</CardTitle>
                <CardDescription className="text-[#AEBFC3]0 mt-1">Select customer and contact person for this offer</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Zone Selection - First */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="zoneId" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <div className="p-1.5 bg-[#96AEC2]/10 rounded-lg">
                    <MapPin className="h-4 w-4 text-[#546A7A]" />
                  </div>
                  Service Zone <span className="text-[#E17F70]">*</span>
                </Label>
                <Select value={formData.zoneId} onValueChange={(value) => handleInputChange('zoneId', value)}>
                  <SelectTrigger className="h-12 border-2 hover:border-[#96AEC2] focus:border-[#6F8A9D] focus:ring-[#96AEC2]/20 transition-all bg-white shadow-sm">
                    <SelectValue placeholder="Select service zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id.toString()} className="h-11 rounded-lg mb-1 focus:bg-[#96AEC2]/10">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#6F8A9D]" />
                          <span className="font-medium text-[#546A7A]">{zone.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Selection */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerId" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <div className="p-1.5 bg-[#A2B9AF]/10 rounded-lg">
                    <Building2 className="h-4 w-4 text-[#82A094]" />
                  </div>
                  Customer <span className="text-[#E17F70]">*</span>
                  {loadingCustomers && <Loader2 className="h-4 w-4 animate-spin text-[#82A094]" />}
                </Label>
                <Select 
                  value={formData.customerId} 
                  onValueChange={(value) => handleInputChange('customerId', value)}
                  disabled={!formData.zoneId || loadingCustomers}
                >
                  <SelectTrigger className="h-12 border-2 hover:border-[#A2B9AF] focus:border-[#82A094] focus:ring-[#82A094]/20 transition-all bg-white shadow-sm">
                    <SelectValue placeholder={
                      !formData.zoneId 
                        ? "Select a service zone first" 
                        : loadingCustomers 
                          ? "Loading customers..." 
                          : customers.length === 0 
                            ? "No customers available in this zone" 
                            : "Select customer"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-96 w-[var(--radix-select-trigger-width)]">
                    <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b p-3 z-10">
                      <div className="relative group/search">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#979796] h-4 w-4 group-focus-within/search:text-[#82A094] transition-colors" />
                        <Input
                          placeholder="Search customers by name..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pl-9 pr-9 h-10 text-sm border-[#AEBFC3]/30 bg-[#AEBFC3]/10/50 focus:bg-white transition-all"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {customerSearch && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomerSearch('');
                            }}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#E17F70] transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()} className="rounded-lg mb-1 focus:bg-[#A2B9AF]/10 transition-colors">
                            <div className="flex items-center space-x-3 py-1">
                              <div className="h-9 w-9 rounded-lg bg-[#A2B9AF]/20 flex items-center justify-center flex-shrink-0">
                                <Building2 className="h-5 w-5 text-[#4F6A64]" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-[#546A7A] truncate">{customer.companyName}</span>
                                <div className="flex items-center gap-2 text-xs text-[#AEBFC3]0">
                                  {customer.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {customer.location}
                                    </span>
                                  )}
                                  {customer.department && (
                                    <span className="flex items-center gap-1 before:content-['•'] before:mr-1">
                                      {customer.department}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-8 text-center bg-[#AEBFC3]/10/50 rounded-xl m-2">
                          <Building2 className="h-8 w-8 text-[#92A2A5] mx-auto mb-2" />
                          <p className="text-sm font-medium text-[#5D6E73]">No customers found</p>
                          <p className="text-xs text-[#979796] mt-1">Try a different search term or check the zone</p>
                        </div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Selection with Add Button */}
              <div className="space-y-2">
                <Label htmlFor="contactId" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <div className="p-1.5 bg-[#6F8A9D]/10 rounded-lg">
                    <Users className="h-4 w-4 text-[#546A7A]" />
                  </div>
                  Contact Person <span className="text-[#E17F70]">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.contactId} 
                    onValueChange={(value) => handleInputChange('contactId', value)}
                    disabled={!formData.customerId || (loadingCustomers && contacts.length === 0)}
                  >
                    <SelectTrigger className="flex-1 h-12 border-2 hover:border-[#6F8A9D] focus:border-[#6F8A9D] focus:ring-[#6F8A9D]/20 transition-all bg-white shadow-sm">
                      <SelectValue placeholder={
                        !formData.customerId 
                          ? 'Select a customer first' 
                          : contacts.length === 0 
                            ? 'No contacts available' 
                            : 'Select contact person'
                      } />
                    </SelectTrigger>
                    <SelectContent className="max-h-96 w-[var(--radix-select-trigger-width)]">
                      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b p-3 z-10">
                        <div className="relative group/search">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#979796] h-4 w-4 group-focus-within/search:text-[#6F8A9D] transition-colors" />
                          <Input
                            placeholder="Search contacts..."
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="pl-9 pr-9 h-10 text-sm border-[#AEBFC3]/30 bg-[#AEBFC3]/10/50 focus:bg-white transition-all"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {contactSearch && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setContactSearch('');
                              }}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#E17F70] transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto p-1 custom-scrollbar">
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id.toString()} className="rounded-lg mb-1 focus:bg-[#6F8A9D]/10 transition-colors">
                              <div className="flex items-center space-x-3 py-1">
                                <div className="h-9 w-9 rounded-lg bg-[#6F8A9D]/20 flex items-center justify-center flex-shrink-0">
                                  <Users className="h-5 w-5 text-[#546A7A]" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-[#546A7A] truncate">{contact.name || contact.contactPersonName}</span>
                                  <div className="flex items-center gap-3 text-xs text-[#AEBFC3]0">
                                    {contact.phone && (
                                      <span className="flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-[#92A2A5]"></span>
                                        {contact.phone}
                                      </span>
                                    )}
                                    {contact.email && (
                                      <span className="flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-[#92A2A5]"></span>
                                        {contact.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-8 text-center bg-[#AEBFC3]/10/50 rounded-xl m-2">
                            <Users className="h-8 w-8 text-[#92A2A5] mx-auto mb-2" />
                            <p className="text-sm font-medium text-[#5D6E73]">No contacts found</p>
                            <p className="text-xs text-[#979796] mt-1">Add a new contact using the button below</p>
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddContactOpen(true)}
                    disabled={!formData.customerId}
                    className="h-12 px-5 border-2 border-[#96AEC2]/20 text-[#546A7A] hover:bg-[#6F8A9D]/10 hover:border-[#6F8A9D] hover:shadow-md transition-all duration-200 group"
                  >
                    <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                    Add New
                  </Button>
                </div>
              </div>

              {/* Asset Selection with Add Button - Multiple Selection */}
              <div className="space-y-2">
                <Label htmlFor="assetIds" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <div className="p-1.5 bg-[#546A7A]/10 rounded-lg">
                    <HardDrive className="h-4 w-4 text-[#546A7A]" />
                  </div>
                  Assets <span className="text-[#E17F70]">*</span>
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-3">
                    {/* Selected Assets Display - Improved List View */}
                    {formData.assetIds.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 p-4 bg-[#546A7A]/10/50 rounded-xl border-2 border-dashed border-[#96AEC2]/20 transition-all">
                        {formData.assetIds.map((assetId) => {
                          const asset = assets.find(a => a.id === parseInt(assetId));
                          return (
                            <div key={assetId} className="flex items-center justify-between gap-3 bg-white text-[#546A7A] p-2.5 rounded-lg shadow-sm border border-[#546A7A] group/asset hover:border-[#96AEC2] transition-all animate-in fade-in zoom-in duration-200">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded-md bg-[#546A7A]/20 flex items-center justify-center flex-shrink-0">
                                  <HardDrive className="h-4 w-4 text-[#546A7A]" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold truncate">{asset?.serialNo || asset?.machineId || 'Unknown'}</span>
                                  {asset?.model && <span className="text-[10px] text-[#546A7A] uppercase tracking-wider font-semibold">{asset.model}</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newAssetIds = formData.assetIds.filter(id => id !== assetId);
                                  handleInputChange('assetIds', newAssetIds);
                                }}
                                className="p-1.5 rounded-md text-[#979796] hover:text-[#E17F70] hover:bg-[#E17F70]/10 transition-all opacity-0 group-hover/asset:opacity-100"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-10 flex items-center px-4 bg-[#AEBFC3]/10 rounded-lg border-2 border-dashed border-[#92A2A5] text-xs text-[#979796]">
                         No assets selected yet
                      </div>
                    )}
                    
                    {/* Asset Selection Dropdown - Improved Design */}
                    <Select 
                      value="" 
                      onValueChange={(value) => {
                        if (value && !formData.assetIds.includes(value)) {
                          handleInputChange('assetIds', [...formData.assetIds, value]);
                        }
                      }}
                      disabled={!formData.customerId}
                    >
                      <SelectTrigger className="h-12 border-2 hover:border-[#546A7A] focus:border-[#6F8A9D] focus:ring-[#6F8A9D]/20 transition-all bg-white shadow-sm">
                        <SelectValue placeholder={
                          !formData.customerId 
                            ? 'Select a customer first' 
                            : assets.length === 0 
                              ? 'No assets available - Add one below' 
                              : formData.assetIds.length === 0
                                ? 'Search and select assets...'
                                : 'Add another asset...'
                        } />
                      </SelectTrigger>
                      <SelectContent className="max-h-96 w-[var(--radix-select-trigger-width)]">
                        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b p-3 z-10">
                          <div className="relative group/search">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#979796] h-4 w-4 group-focus-within/search:text-[#546A7A] transition-colors" />
                            <Input
                              placeholder="Search assets by serial or model..."
                              value={assetSearch}
                              onChange={(e) => setAssetSearch(e.target.value)}
                              className="pl-9 pr-9 h-10 text-sm border-[#AEBFC3]/30 bg-[#AEBFC3]/10/50 focus:bg-white transition-all"
                              onClick={(e) => e.stopPropagation()}
                            />
                            {assetSearch && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssetSearch('');
                                }}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#E17F70] transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-1 custom-scrollbar">
                          {(() => {
                            const availableAssets = filteredAssets.filter(asset => !formData.assetIds.includes(asset.id.toString()));
                            
                            if (availableAssets.length > 0) {
                              return availableAssets.map((asset) => (
                                <SelectItem key={asset.id} value={asset.id.toString()} className="rounded-lg mb-1 focus:bg-[#546A7A]/10 transition-colors">
                                  <div className="flex items-center space-x-3 py-1">
                                    <div className="h-9 w-9 rounded-lg bg-[#546A7A]/20 flex items-center justify-center flex-shrink-0">
                                      <HardDrive className="h-5 w-5 text-[#546A7A]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-semibold text-[#546A7A] truncate">
                                        {asset.serialNo || asset.machineId || 'Unknown Asset'}
                                      </span>
                                      <span className="text-xs text-[#546A7A] font-medium tracking-tight">
                                        {asset.model ? `Model: ${asset.model}` : 'Generic Asset'}
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              ));
                            }
                            
                            return (
                              <div className="p-8 text-center bg-[#AEBFC3]/10/50 rounded-xl m-2">
                                <HardDrive className="h-8 w-8 text-[#92A2A5] mx-auto mb-2" />
                                <p className="text-sm font-medium text-[#5D6E73]">
                                  {assets.length === 0 ? 'No assets found' : 'All assets selected'}
                                </p>
                                <p className="text-xs text-[#979796] mt-1">
                                  {assets.length === 0 ? 'Add a new asset using the button below' : 'Remove an asset above to re-select'}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddAssetOpen(true)}
                    disabled={!formData.customerId}
                    className="h-12 px-5 border-2 border-[#96AEC2]/20 text-[#546A7A] hover:bg-[#546A7A]/10 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group self-start"
                  >
                    <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                    Add New
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Essential Information */}
        <Card className="shadow-xl border-0 bg-white overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D]"></div>
          
          <CardHeader className="bg-gradient-to-br from-[#96AEC2]/10 via-indigo-50/50 to-[#96AEC2]/10/30 border-b border-[#96AEC2]/30/50 pb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-lg ring-2 ring-blue-100">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-[#CE9F6B] to-[#CE9F6B] flex items-center justify-center shadow ring-2 ring-white">
                  <span className="text-xs font-bold text-white">2</span>
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-[#546A7A]">Essential Information</CardTitle>
                <CardDescription className="text-[#AEBFC3]0 mt-1">Select product type and lead status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Type */}
              <div className="space-y-3 bg-gradient-to-br from-[#96AEC2]/10/50 to-[#96AEC2]/10/30 p-6 rounded-2xl border border-[#96AEC2]/30 shadow-sm transition-all hover:shadow-md">
                <Label htmlFor="productType" className="flex items-center gap-2 text-base font-bold text-[#546A7A]">
                  <div className="h-8 w-8 rounded-lg bg-[#96AEC2]/20 flex items-center justify-center">
                    <Target className="h-5 w-5 text-[#546A7A]" />
                  </div>
                  Product Type <span className="text-[#E17F70]">*</span>
                </Label>
                <Select value={formData.productType} onValueChange={(value) => handleInputChange('productType', value)}>
                  <SelectTrigger className="h-14 text-base bg-white border-2 border-[#96AEC2]/20 hover:border-[#96AEC2] focus:ring-4 focus:ring-[#96AEC2]/10 focus:border-[#6F8A9D] transition-all rounded-xl shadow-sm">
                    <SelectValue placeholder="Choose a product type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px] rounded-xl border-2 border-[#96AEC2]/20 shadow-2xl p-1">
                    <SelectItem value="RELOCATION" className="py-3 rounded-lg focus:bg-[#6F8A9D]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#6F8A9D]/20 flex items-center justify-center text-[#546A7A] font-bold shadow-sm">RE</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Relocation</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Equipment relocation services</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="CONTRACT" className="py-3 rounded-lg focus:bg-[#A2B9AF]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#A2B9AF]/20 flex items-center justify-center text-[#4F6A64] font-bold shadow-sm">CO</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Contract</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Service contract agreement</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="SPARE_PARTS" className="py-3 rounded-lg focus:bg-[#CE9F6B]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#CE9F6B]/20 flex items-center justify-center text-[#976E44] font-bold shadow-sm">SP</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Spare Parts</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Spare parts package</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="KARDEX_CONNECT" className="py-3 rounded-lg focus:bg-[#6F8A9D]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#6F8A9D]/20 flex items-center justify-center text-[#546A7A] font-bold shadow-sm">KC</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Kardex Connect</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Kardex Connect services</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="UPGRADE_KIT" className="py-3 rounded-lg focus:bg-[#96AEC2]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#96AEC2]/20 flex items-center justify-center text-[#546A7A] font-bold shadow-sm">UK</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Optilife Upgrade</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Hardware upgrade package</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="SOFTWARE" className="py-3 rounded-lg focus:bg-[#546A7A]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#546A7A]/20 flex items-center justify-center text-[#546A7A] font-bold shadow-sm">SW</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Software</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Software license or update</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="OTHERS" className="py-3 rounded-lg focus:bg-[#E17F70]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#E17F70]/20 flex items-center justify-center text-[#9E3B47] font-bold shadow-sm">OT</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Repairs & Others</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Other service charges</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="BD_SPARE" className="py-3 rounded-lg focus:bg-[#EEC1BF]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#EEC1BF]/20 flex items-center justify-center text-[#9E3B47] font-bold shadow-sm">BS</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">BD Spare</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Breakdown spare parts</p>
                        </div>
                      </div>
                    </SelectItem>

                    <SelectItem value="RETROFIT_KIT" className="py-3 rounded-lg focus:bg-[#82A094]/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#82A094]/20 flex items-center justify-center text-[#4F6A64] font-bold shadow-sm">RK</div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Retrofit Kit</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Retrofit installation kit</p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formData.productType && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 rounded-lg border border-[#96AEC2]/30 w-fit">
                    <div className="w-2 h-2 rounded-full bg-[#96AEC2]/100 animate-pulse"></div>
                    <span className="text-xs font-bold text-[#546A7A] uppercase tracking-wider">{formData.productType.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>

              {/* Lead Status */}
              <div className="space-y-3 bg-gradient-to-br from-[#96AEC2]/10/50 to-[#EEC1BF]/10/30 p-6 rounded-2xl border border-[#96AEC2]/20 shadow-sm transition-all hover:shadow-md">
                <Label htmlFor="lead" className="flex items-center gap-2 text-base font-bold text-[#546A7A]">
                  <div className="h-8 w-8 rounded-lg bg-[#6F8A9D]/20 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-[#546A7A]" />
                  </div>
                  Lead Status <span className="text-[#E17F70]">*</span>
                </Label>
                <Select value={formData.lead} onValueChange={(value) => handleInputChange('lead', value)}>
                  <SelectTrigger className="h-14 text-base bg-white border-2 border-purple-50 hover:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 focus:border-[#6F8A9D] transition-all rounded-xl shadow-sm">
                    <SelectValue placeholder="Is this a lead?" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 border-purple-50 shadow-2xl p-1">
                    <SelectItem value="YES" className="py-3 rounded-lg focus:bg-[#A2B9AF]/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#A2B9AF]/20 flex items-center justify-center shadow-sm">
                          <span className="text-[#4F6A64] font-bold text-lg">✓</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#546A7A]">Yes - This is a Lead</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Originated from sales pipeline</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="NO" className="py-3 rounded-lg focus:bg-[#AEBFC3]/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#AEBFC3]/20 flex items-center justify-center shadow-sm">
                          <span className="text-[#5D6E73] font-bold text-lg">—</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#546A7A]">No - Direct Request</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Standard customer inquiry</p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formData.lead && (
                   <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border w-fit ${formData.lead === 'YES' ? 'bg-[#A2B9AF]/10 border-[#A2B9AF]/20 text-[#4F6A64]' : 'bg-[#AEBFC3]/10 border-[#AEBFC3]/30 text-[#5D6E73]'}`}>
                    <div className={`w-2 h-2 rounded-full ${formData.lead === 'YES' ? 'bg-[#A2B9AF]/100 animate-pulse' : 'bg-[#979796]'}`}></div>
                    <span className="text-xs font-bold uppercase tracking-wider">{formData.lead === 'YES' ? 'Active Lead' : 'Direct Inquiry'}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {formData.productType === 'SPARE_PARTS' && (
          <Card className="shadow-xl border-0 bg-white overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#CE9F6B] via-red-500 to-[#E17F70]"></div>
            
            <CardHeader className="bg-gradient-to-br from-[#EEC1BF]/10 via-red-50/50 to-[#EEC1BF]/10/30 border-b border-[#EEC1BF]/20/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-red-600 flex items-center justify-center shadow-lg ring-2 ring-orange-100">
                      <Target className="h-7 w-7 text-white" />
                    </div>
                    {formData.spareParts.length > 0 && (
                      <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-[#82A094] flex items-center justify-center shadow ring-2 ring-white">
                        <span className="text-xs font-bold text-white">{formData.spareParts.length}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-[#546A7A]">Spare Parts Selection</CardTitle>
                    <CardDescription className="text-[#AEBFC3]0 mt-1">
                      {loadingSpareParts ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading spare parts catalog...
                        </span>
                      ) : (
                        <span>{spareParts.length} parts available in catalog</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                
                {/* Grand Total Badge */}
                {formData.spareParts.length > 0 && (
                  <div className="hidden md:flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-[#82A094] to-[#82A094] rounded-xl shadow-lg">
                    <DollarSign className="h-5 w-5 text-white" />
                    <div className="text-white">
                      <span className="text-xs font-medium opacity-90">Total Value</span>
                      <p className="text-xl font-bold">
                        ₹{formData.spareParts.reduce((sum, p) => sum + (parseFloat(p.total || '0') || 0), 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              {/* Add Spare Part Section */}
              <div className="bg-gradient-to-br from-[#EEC1BF]/10/50 to-red-50/30 p-5 rounded-xl border border-[#EEC1BF]/20">
                <Label className="flex items-center gap-2 text-base font-semibold text-[#5D6E73] mb-3">
                  <div className="h-7 w-7 rounded-lg bg-[#CE9F6B]/20 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-[#976E44]" />
                  </div>
                  Add Spare Parts
                  {!loadingSpareParts && spareParts.length > 0 && (
                    <span className="text-sm font-normal text-[#AEBFC3]0 ml-2">
                      ({spareParts.length - formData.spareParts.length} available)
                    </span>
                  )}
                </Label>
                
                <Select 
                  value="" 
                  onValueChange={(value) => {
                    if (value && !formData.spareParts.find(p => p.name === value)) {
                      const selectedPart = spareParts.find(sp => sp.id === parseInt(value));
                      if (selectedPart) {
                        const newPart = {
                          name: value,
                          photo: selectedPart.imageUrl || '',
                          price: selectedPart.basePrice?.toString() || '',
                          quantity: '1',
                          total: selectedPart.basePrice?.toString() || ''
                        };
                        handleInputChange('spareParts', [...formData.spareParts, newPart]);
                        setSparePartSearch('');
                      }
                    }
                  }}
                  disabled={loadingSpareParts}
                >
                  <SelectTrigger className="h-14 text-base bg-white border-2 border-[#EEC1BF]/20 hover:border-[#CE9F6B] focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all rounded-xl shadow-sm">
                    <SelectValue placeholder={
                      loadingSpareParts 
                        ? 'Loading spare parts catalog...' 
                        : spareParts.length === 0 
                          ? 'No spare parts available' 
                          : `Search and add from ${spareParts.length} parts...`
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-[500px] w-[var(--radix-select-trigger-width)] rounded-xl shadow-2xl border-orange-50 p-0">
                    {/* Search Header */}
                    <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b p-4 z-10">
                      <div className="relative group/search">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#979796] h-5 w-5 group-focus-within/search:text-[#CE9F6B] transition-colors" />
                        <Input
                          placeholder="Search by name, part number, or category..."
                          value={sparePartSearch}
                          onChange={(e) => setSparePartSearch(e.target.value)}
                          className="pl-10 pr-10 h-11 text-sm border-[#AEBFC3]/30 bg-[#AEBFC3]/10 focus:bg-white transition-all rounded-lg"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                        />
                        {sparePartSearch && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSparePartSearch(''); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#E17F70] p-1.5 rounded-full hover:bg-[#E17F70]/10 transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Parts List */}
                    <div className="max-h-[350px] overflow-y-auto p-2 custom-scrollbar">
                      {(() => {
                        const availableParts = spareParts
                          .filter(sp => !formData.spareParts.find(p => p.name === sp.id.toString()))
                          .filter(sp => {
                            if (!sparePartSearch) return true;
                            const s = sparePartSearch.toLowerCase();
                            return sp.name?.toLowerCase().includes(s) || sp.partNumber?.toLowerCase().includes(s) || sp.category?.toLowerCase().includes(s);
                          });

                        if (availableParts.length === 0) {
                          return (
                            <div className="p-10 text-center">
                              <div className="h-16 w-16 bg-[#AEBFC3]/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[#92A2A5]">
                                <Target className="h-8 w-8 text-[#92A2A5]" />
                              </div>
                              <p className="text-sm font-bold text-[#5D6E73]">
                                {sparePartSearch ? `No results for "${sparePartSearch}"` : 'All parts selected'}
                              </p>
                              <p className="text-xs text-[#979796] mt-1">
                                {sparePartSearch ? 'Try a different search term' : 'Remove some parts to re-add them'}
                              </p>
                            </div>
                          );
                        }

                        return availableParts.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id.toString()} className="py-3 px-3 rounded-lg focus:bg-[#CE9F6B]/10 transition-colors mb-1 cursor-pointer">
                            <div className="flex items-center gap-4 w-full">
                              <div className="flex-shrink-0">
                                {sp.imageUrl ? (
                                  <img src={sp.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-[#AEBFC3]/30 shadow-sm" />
                                ) : (
                                  <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center border-2 border-orange-50 shadow-sm">
                                    <Image className="h-6 w-6 text-[#CE9F6B]" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="font-bold text-[#546A7A] truncate">{sp.name}</p>
                                  <span className="font-black text-[#4F6A64] flex-shrink-0">
                                    ₹{parseFloat(sp.basePrice).toLocaleString('en-IN')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#AEBFC3]/20 text-[#AEBFC3]0 border border-[#92A2A5] uppercase tracking-tight">#{sp.partNumber}</span>
                                  {sp.category && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#CE9F6B]/20 text-[#976E44] border border-[#CE9F6B] uppercase tracking-tight">
                                      {sp.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ));
                      })()}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Parts Table */}
              {formData.spareParts.length > 0 && (
                <div className="border-2 border-[#92A2A5] rounded-xl overflow-hidden shadow-sm">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20 text-sm font-semibold text-[#5D6E73] border-b">
                    <div className="col-span-5 flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#CE9F6B]" />
                      Part Details
                    </div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-2 text-center">Unit Price</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                    <div className="col-span-1"></div>
                  </div>
                  
                  {/* Table Rows */}
                  {formData.spareParts.map((part, index) => {
                    const sp: any = spareParts.find(s => s.id === parseInt(part.name)) || {};
                    return (
                      <div key={index} className="grid grid-cols-12 gap-3 px-4 py-4 items-center border-b last:border-b-0 hover:bg-[#CE9F6B]/10/50 transition-all duration-200 group">
                        <div className="col-span-5 flex items-center gap-3">
                          {sp.imageUrl ? (
                            <img src={sp.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border-2 border-[#AEBFC3]/30 shadow-sm group-hover:border-[#CE9F6B] transition-colors" />
                          ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:from-orange-200 group-hover:to-red-200 transition-colors">
                              <Image className="h-6 w-6 text-[#CE9F6B]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-[#546A7A] truncate">{sp.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-[#AEBFC3]0">#{sp.partNumber}</span>
                              {sp.category && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-[#AEBFC3]/20 text-[#5D6E73]">
                                  {sp.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <Input
                            type="number"
                            min="1"
                            value={part.quantity || 1}
                            onChange={(e) => {
                              const newParts = [...formData.spareParts];
                              newParts[index].quantity = e.target.value;
                              const qty = parseInt(e.target.value) || 1;
                              const price = parseFloat(newParts[index].price) || 0;
                              newParts[index].total = (price * qty).toString();
                              handleInputChange('spareParts', newParts);
                            }}
                            className="h-10 w-20 text-center text-sm font-medium border-2 border-[#92A2A5] focus:border-orange-500 focus:ring-orange-500"
                          />
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-medium text-[#5D6E73]">
                            ₹{parseFloat(part.price || '0').toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="font-bold text-[#4F6A64]">
                            ₹{parseFloat(part.total || '0').toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const newParts = formData.spareParts.filter((_, i) => i !== index);
                              handleInputChange('spareParts', newParts);
                            }}
                            className="p-2 text-[#979796] hover:text-[#E17F70] hover:bg-[#E17F70]/10 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Grand Total Row */}
                  <div className="grid grid-cols-12 gap-3 px-4 py-4 bg-gradient-to-r from-[#82A094] via-emerald-500 to-[#82A094] text-white">
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <span className="font-bold text-lg">Grand Total</span>
                        <p className="text-[#A2B9AF] text-sm">
                          {formData.spareParts.length} items • {formData.spareParts.reduce((s, p) => s + (parseInt(p.quantity || '1') || 1), 0)} units
                        </p>
                      </div>
                    </div>
                    <div className="col-span-4"></div>
                    <div className="col-span-2 text-right flex items-center justify-end">
                      <span className="text-2xl font-bold">
                        ₹{formData.spareParts.reduce((sum, p) => sum + (parseFloat(p.total || '0') || 0), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                </div>
              )}
              
              {/* Empty State */}
              {formData.spareParts.length === 0 && !loadingSpareParts && (
                <div className="text-center py-12 bg-gradient-to-br from-[#AEBFC3]/10 to-[#EEC1BF]/10/30 rounded-xl border-2 border-dashed border-[#CE9F6B]">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-[#CE9F6B]/20 flex items-center justify-center">
                    <Target className="h-8 w-8 text-[#CE9F6B]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#5D6E73] mb-2">No Spare Parts Selected</h3>
                  <p className="text-sm text-[#AEBFC3]0 max-w-md mx-auto">
                    Use the dropdown above to search and add spare parts from the catalog. 
                    Each part can be customized with quantity.
                  </p>
                </div>
              )}
              
              {/* Loading State */}
              {loadingSpareParts && formData.spareParts.length === 0 && (
                <div className="text-center py-12 bg-gradient-to-br from-[#AEBFC3]/10 to-[#EEC1BF]/10/30 rounded-xl border-2 border-dashed border-[#CE9F6B]">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-[#CE9F6B]/20 flex items-center justify-center animate-pulse">
                    <Loader2 className="h-8 w-8 text-[#CE9F6B] animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#5D6E73] mb-2">Loading Spare Parts</h3>
                  <p className="text-sm text-[#AEBFC3]0">Fetching catalog from server...</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

          {/* Form Actions */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#92A2A5] p-8 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.back()} 
                disabled={loading}
                className="px-8 py-3 h-12 text-base font-medium border-2 border-[#92A2A5] hover:border-slate-400 hover:bg-[#AEBFC3]/10 transition-all duration-200"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="px-8 py-3 h-12 text-base font-semibold bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A] shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Initial Offer...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Create Initial Offer
                  </>
                )}
              </Button>
            </div>
          </div>
      </form>


      <AddContactDialog
        open={isAddContactOpen}
        onOpenChange={setIsAddContactOpen}
        selectedCustomerName={selectedCustomer?.companyName}
        newContact={newContact}
        setNewContact={setNewContact}
        onConfirm={handleCreateContact}
        isCreating={isCreatingContact}
      />

      <AddAssetDialog
        open={isAddAssetOpen}
        onOpenChange={setIsAddAssetOpen}
        selectedCustomerName={selectedCustomer?.companyName}
        newAsset={newAsset}
        setNewAsset={setNewAsset}
        onConfirm={handleCreateAsset}
        isCreating={isCreatingAsset}
      />
      </div>
    </div>
  )
}
