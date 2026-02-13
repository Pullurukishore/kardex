'use client'

import { useState, useEffect } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Save, Loader2, Plus, Users, HardDrive, Search, X, Building2, MapPin, FileText, Calendar, DollarSign, Target, MessageSquare, Image, Package, TrendingUp, Sparkles } from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import { PRODUCT_TYPE_LABELS } from '@/types/reports'
import { useAuth } from '@/contexts/AuthContext'


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
  
  // Dialog states
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false)
  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [isCreatingAsset, setIsCreatingAsset] = useState(false)
  
  // New contact/asset form data
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '' })
  const [newAsset, setNewAsset] = useState({ assetName: '', machineSerialNumber: '', model: '' })
  
  // Search states for dropdowns
  const [customerSearch, setCustomerSearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [assetSearch, setAssetSearch] = useState('')
  
  
  // Filtered lists based on search
  const filteredCustomers = customers.filter(customer =>
    customer.companyName?.toLowerCase().includes(customerSearch.toLowerCase())
  )
  
  const filteredContacts = contacts.filter(contact => {
    const contactName = contact.name || contact.contactPersonName || ''
    const contactPhone = contact.phone || contact.contactNumber || ''
    return contactName.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contact.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contactPhone.includes(contactSearch)
  })
  
  const filteredAssets = assets.filter(asset => {
    const assetName = asset.serialNo || asset.machineId || asset.assetName || ''
    const model = asset.model || ''
    return assetName.toLowerCase().includes(assetSearch.toLowerCase()) ||
      model.toLowerCase().includes(assetSearch.toLowerCase())
  })
  
  
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

  // Initialize zone manager's assigned zone on mount
  useEffect(() => {
    const initZone = async () => {
      try {
        setLoadingZones(true)
        const me = await apiService.getMe()
        const user = me?.user ?? me

        // Prefer zones array, else fall back to zoneId
        const zoneFromArray = Array.isArray(user?.zones) && user.zones.length > 0 ? user.zones[0] : null
        const zoneId = zoneFromArray?.id ?? user?.zoneId
        const zoneName = zoneFromArray?.name ?? user?.zone?.name ?? undefined

        if (zoneId) {
          const zone = { id: zoneId, name: zoneName || 'Your Zone' }
          setZones([zone])
          setFormData(prev => ({ ...prev, zoneId: String(zone.id) }))
        } else {
          toast.error('No zone assigned to your account')
        }
      } catch (error: any) {
        toast.error('Failed to load your zone')
      } finally {
        setLoadingZones(false)
      }
    }
    initZone()
  }, [])

  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    const zoneFromArray = Array.isArray((user as any).zones) && (user as any).zones.length > 0 ? (user as any).zones[0] : null
    const zoneId = zoneFromArray?.id ?? (user as any).zoneId
    const zoneName = zoneFromArray?.name ?? (user as any).zone?.name
    if (zoneId) {
      setZones([{ id: zoneId, name: zoneName || 'Your Zone' }])
      setFormData(prev => ({ ...prev, zoneId: String(zoneId) }))
    }
  }, [user])

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
  }, [formData.customerId, customers])

  const fetchZones = async () => {
    try {
      setLoadingZones(true)
      const response = await apiService.getZones()
      console.log('🔍 Zones fetched:', response.data?.length || 0)
      setZones(response.data || [])
    } catch (error: any) {
      console.error('Failed to fetch zones:', error)
      toast.error('Failed to fetch zones')
    } finally {
      setLoadingZones(false)
    }
  }

  const fetchCustomersByZone = async (zoneId: number) => {
    try {
      setLoadingCustomers(true)
      // Request all customers for the zone (no pagination limit)
      const response = await apiService.getCustomers({ 
        zoneId, 
        limit: 1000, // High limit to get all customers
        include: 'contacts,assets' // Request full data
      })
      
      // apiService.getCustomers returns an array directly, not { customers: [...] }
      const customersArray = Array.isArray(response) ? response : (response.customers || response.data || [])
      
      setCustomers(customersArray)
      
      // Reset customer-dependent fields
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
      console.error('Failed to fetch customer data:', error)
      toast.error('Failed to load customer details')
    }
  }

  const fetchSpareParts = async () => {
    try {
      setLoadingSpareParts(true)
      const response = await apiService.getSpareParts({ status: 'ACTIVE', limit: 1000 })
      setSpareParts(response.spareParts || [])
    } catch (error: any) {
      console.error('Failed to fetch spare parts:', error)
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
          email: newContact.email || undefined,
          role: 'CONTACT' // Default role
        }
      )
      
      // Backend returns: { message: "...", data: { contact: {...}, user: null } }
      const createdContact = response?.data?.contact || response?.contact || response
      
      if (!createdContact || !createdContact.id) {
        throw new Error('Invalid response from server')
      }
      
      setContacts(prev => [...prev, createdContact])
      setFormData(prev => ({ ...prev, contactId: String(createdContact.id) }))
      
      // Reset form and close dialog
      setNewContact({ name: '', email: '', phone: '' })
      setIsAddContactOpen(false)
      toast.success('Contact created successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to create contact')
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
      console.error('Failed to create asset:', error)
      toast.error(error.response?.data?.error || 'Failed to create asset')
    } finally {
      setIsCreatingAsset(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

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
            return asset?.machineSerialNumber || asset?.assetName;
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
      router.push('/zone-manager/offers')
    } catch (error: any) {
      console.error('Failed to create offer:', error)
      toast.error(error.response?.data?.error || 'Failed to create offer')
    } finally {
      setLoading(false)
    }
  }

  if (loadingZones) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-[#546A7A] mb-2">Loading Form Data</h3>
            <p className="text-[#AEBFC3]0">Preparing offer creation form...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50 to-[#96AEC2]/10">
      <div className="container mx-auto px-4 py-8">
        {/* Premium Gradient Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="mb-4 hover:bg-white/80 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] rounded-2xl p-6 shadow-xl mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Plus className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Create New Offer</h1>
                  <p className="text-[#96AEC2] mt-1">Quick setup with essential details • Add more info later</p>
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm">
                <FileText className="h-5 w-5 text-white/80" />
                <span className="text-white font-medium">Initial Stage</span>
              </div>
            </div>
          </div>

          {/* Quick Info Card */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#96AEC2]/30 flex items-start gap-4">
            <div className="p-2 bg-[#96AEC2]/20 rounded-lg">
              <Target className="h-5 w-5 text-[#546A7A]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#546A7A]">Initial Offer Setup</h3>
              <p className="text-sm text-[#5D6E73] mt-1">
                Start by selecting Zone → Customer → Contact → Asset(s) → Product Type. 
                You can add financial details, quotes, and documents after the offer is created.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer & Contact Information */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 rounded-t-xl border-b border-[#A2B9AF]/20">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-[#A2B9AF]/20 rounded-lg">
                <Building2 className="h-5 w-5 text-[#4F6A64]" />
              </div>
              Customer & Contact Information
            </CardTitle>
            <CardDescription className="text-[#5D6E73] ml-12">Select customer and contact person</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Zone Selection - Locked to Zone Manager's Zone */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="zoneId" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#976E44]" />
                  Your Zone
                </Label>
                <div className="p-4 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 border-2 border-[#CE9F6B] rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-[#976E44]">
                        {
                          (zones.length > 0 && zones[0]?.name)
                          || ((user as any)?.zones?.[0]?.name)
                          || ((user as any)?.zone?.name)
                          || ((loadingZones) ? 'Loading...' : 'Your Zone')
                        }
                      </p>
                      <p className="text-xs text-[#976E44] mt-1 font-medium">Your assigned zone cannot be changed</p>
                    </div>
                    <div className="text-2xl">🔒</div>
                  </div>
                </div>
              </div>

              {/* Customer Selection */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerId" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#82A094]" />
                  Customer *
                  {loadingCustomers && <Loader2 className="h-3 w-3 animate-spin text-[#82A094]" />}
                </Label>
                <Select 
                  value={formData.customerId} 
                  onValueChange={(value) => handleInputChange('customerId', value)}
                  disabled={!formData.zoneId || loadingCustomers}
                >
                  <SelectTrigger className="focus:ring-2 focus:ring-[#82A094] focus:border-[#82A094]">
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
                  <SelectContent className="max-h-80">
                    <div className="sticky top-0 bg-white border-b p-2 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[#979796] h-4 w-4" />
                        <Input
                          placeholder="Search customers..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pl-8 pr-8 h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {customerSearch && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomerSearch('');
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#5D6E73]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-3 w-3 text-[#82A094]" />
                              <div className="flex flex-col">
                                <span className="font-medium">{customer.companyName}</span>
                                {customer.location && (
                                  <span className="text-xs text-[#AEBFC3]0 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {customer.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-[#AEBFC3]0 text-center">
                          {customerSearch ? 'No customers found matching your search' : 'No customers available'}
                        </div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Selection with Add Button */}
              <div className="space-y-2">
                <Label htmlFor="contactId" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#6F8A9D]" />
                  Contact Person *
                </Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.contactId} 
                    onValueChange={(value) => handleInputChange('contactId', value)}
                    disabled={!formData.customerId || contacts.length === 0}
                  >
                    <SelectTrigger className="flex-1 focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D]">
                      <SelectValue placeholder={
                        !formData.customerId 
                          ? 'Select a customer first' 
                          : contacts.length === 0 
                            ? 'No contacts available' 
                            : 'Select contact person'
                      } />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <div className="sticky top-0 bg-white border-b p-2 z-10">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[#979796] h-4 w-4" />
                          <Input
                            placeholder="Search contacts..."
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="pl-8 pr-8 h-8 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {contactSearch && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setContactSearch('');
                              }}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#5D6E73]"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id.toString()}>
                              <div className="flex items-center space-x-2">
                                <Users className="h-3 w-3 text-[#6F8A9D]" />
                                <div className="flex flex-col">
                                  <span className="font-medium">{contact.name || contact.contactPersonName}</span>
                                  <div className="flex items-center space-x-2 text-xs text-[#AEBFC3]0">
                                    {(contact.phone || contact.contactNumber) && <span>{contact.phone || contact.contactNumber}</span>}
                                    {contact.email && <span>{contact.email}</span>}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-[#AEBFC3]0 text-center">
                            {contactSearch ? 'No contacts found matching your search' : 'No contacts available'}
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddContactOpen(true)}
                    disabled={!formData.customerId}
                    className="flex-shrink-0 border-[#6F8A9D] text-[#546A7A] hover:bg-[#6F8A9D]/10 hover:border-[#6F8A9D]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                  </Button>
                </div>
              </div>

              {/* Asset Selection with Add Button - Multiple Selection */}
              <div className="space-y-2">
                <Label htmlFor="assetIds" className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-[#546A7A]" />
                  Assets *
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    {/* Selected Assets Display */}
                    {formData.assetIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.assetIds.map((assetId) => {
                          const asset = assets.find(a => a.id === parseInt(assetId));
                          return (
                            <div key={assetId} className="flex items-center gap-1 bg-[#546A7A]/10 text-[#546A7A] px-2 py-1 rounded-md text-sm">
                              <HardDrive className="h-3 w-3" />
                              <span>{asset?.serialNo || asset?.machineId || 'Unknown'}{asset?.model ? ` - ${asset.model}` : ''}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newAssetIds = formData.assetIds.filter(id => id !== assetId);
                                  handleInputChange('assetIds', newAssetIds);
                                }}
                                className="ml-1 text-[#546A7A] hover:text-[#546A7A]"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Asset Selection Dropdown */}
                    <Select 
                      value="" 
                      onValueChange={(value) => {
                        if (value && !formData.assetIds.includes(value)) {
                          handleInputChange('assetIds', [...formData.assetIds, value]);
                        }
                      }}
                      disabled={!formData.customerId}
                    >
                      <SelectTrigger className="focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D]">
                        <SelectValue placeholder={
                          !formData.customerId 
                            ? 'Select a customer first' 
                            : assets.length === 0 
                              ? 'No assets available - Add one below' 
                              : formData.assetIds.length === 0
                                ? 'Select assets (required)'
                                : 'Add more assets'
                        } />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        <div className="sticky top-0 bg-white border-b p-2 z-10">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[#979796] h-4 w-4" />
                            <Input
                              placeholder="Search assets..."
                              value={assetSearch}
                              onChange={(e) => setAssetSearch(e.target.value)}
                              className="pl-8 pr-8 h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            {assetSearch && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssetSearch('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#979796] hover:text-[#5D6E73]"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredAssets.length > 0 ? (
                            filteredAssets
                              .filter(asset => !formData.assetIds.includes(asset.id.toString()))
                              .map((asset) => (
                                <SelectItem key={asset.id} value={asset.id.toString()}>
                                  <div className="flex items-center space-x-2">
                                    <HardDrive className="h-3 w-3 text-[#546A7A]" />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{asset.serialNo || asset.machineId || 'Unknown'}</span>
                                      <span className="text-xs text-[#AEBFC3]0">
                                        {asset.model ? `Model: ${asset.model}` : 'No model info'}
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))
                          ) : assets.length > 0 ? (
                            <div className="p-2 text-sm text-[#AEBFC3]0 text-center">
                              {formData.assetIds.length === assets.length 
                                ? 'All assets selected' 
                                : 'No assets found matching your search'}
                            </div>
                          ) : null}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddAssetOpen(true)}
                    disabled={!formData.customerId}
                    className="flex-shrink-0 border-[#546A7A] text-[#546A7A] hover:bg-[#546A7A]/10 hover:border-indigo-300"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Essential Information */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 rounded-t-xl border-b border-[#96AEC2]/30">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-[#96AEC2]/20 rounded-lg">
                <FileText className="h-5 w-5 text-[#546A7A]" />
              </div>
              Essential Information
            </CardTitle>
            <CardDescription className="text-[#5D6E73] ml-12">Basic details for initial offer stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productType" className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#6F8A9D]" />
                  Product Type *
                </Label>
                <Select value={formData.productType} onValueChange={(value) => handleInputChange('productType', value)}>
                  <SelectTrigger className="focus:ring-2 focus:ring-[#96AEC2]">
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RELOCATION">Relocation</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="SPARE_PARTS">Spare Parts</SelectItem>
                    <SelectItem value="KARDEX_CONNECT">Kardex Connect</SelectItem>
                    <SelectItem value="UPGRADE_KIT">Optilife Upgrade</SelectItem>
                    <SelectItem value="SOFTWARE">Software</SelectItem>
                    <SelectItem value="OTHERS">Repairs & Others</SelectItem>
                    <SelectItem value="BD_SPARE">BD Spare</SelectItem>
                    <SelectItem value="RETROFIT_KIT">Retrofit Kit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#82A094]" />
                  Lead Status *
                </Label>
                <Select value={formData.lead} onValueChange={(value) => handleInputChange('lead', value)}>
                  <SelectTrigger className="focus:ring-2 focus:ring-[#96AEC2]">
                    <SelectValue placeholder="Select lead status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spare Parts Section - Only for SPARE_PARTS */}
        {formData.productType === 'SPARE_PARTS' && (
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-[#EEC1BF]/10 to-red-50 rounded-t-xl border-b border-[#EEC1BF]/20">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-[#CE9F6B]/20 rounded-lg">
                  <Target className="h-5 w-5 text-[#976E44]" />
                </div>
                Spare Parts Information
              </CardTitle>
              <CardDescription className="text-[#5D6E73] ml-12">Add spare parts details for SPARE_PARTS product type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Selected Spare Parts Display */}
                {formData.spareParts.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Selected Spare Parts:</Label>
                    {formData.spareParts.map((part, index) => {
                      const sparePart = spareParts.find(sp => sp.id === parseInt(part.name)) || {};
                      return (
                        <div key={index} className="p-4 border border-[#CE9F6B] rounded-lg bg-[#CE9F6B]/10/50">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              {sparePart.imageUrl && (
                                <img 
                                  src={sparePart.imageUrl} 
                                  alt={sparePart.name}
                                  className="w-12 h-12 object-cover rounded-lg border"
                                />
                              )}
                              <div>
                                <h4 className="font-medium text-[#976E44]">{sparePart.name}</h4>
                                <p className="text-sm text-[#976E44]">#{sparePart.partNumber}</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newParts = formData.spareParts.filter((_, i) => i !== index);
                                handleInputChange('spareParts', newParts);
                              }}
                              className="text-[#9E3B47] border-[#E17F70] hover:bg-[#E17F70]/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1 text-sm">
                                <Package className="h-3 w-3 text-[#AEBFC3]0" />
                                Quantity
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentQty = parseInt(part.quantity || '1') || 1;
                                    if (currentQty > 1) {
                                      const newParts = [...formData.spareParts];
                                      const newQty = currentQty - 1;
                                      newParts[index].quantity = newQty.toString();
                                      const unitPrice = parseFloat(newParts[index].price) || 0;
                                      newParts[index].total = (unitPrice * newQty).toString();
                                      handleInputChange('spareParts', newParts);
                                    }
                                  }}
                                  className="h-10 w-10 p-0 text-lg font-bold border-[#CE9F6B] hover:bg-[#CE9F6B]/10"
                                >
                                  −
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={part.quantity || '1'}
                                  onChange={(e) => {
                                    const newParts = [...formData.spareParts];
                                    const value = e.target.value;
                                    newParts[index].quantity = value;
                                    const unitPrice = parseFloat(newParts[index].price) || 0;
                                    const quantity = parseInt(value) || 1;
                                    newParts[index].total = (unitPrice * quantity).toString();
                                    handleInputChange('spareParts', newParts);
                                  }}
                                  onBlur={(e) => {
                                    // Ensure minimum value of 1 on blur
                                    const newParts = [...formData.spareParts];
                                    const value = parseInt(e.target.value) || 1;
                                    const finalValue = Math.max(1, value);
                                    newParts[index].quantity = finalValue.toString();
                                    const unitPrice = parseFloat(newParts[index].price) || 0;
                                    newParts[index].total = (unitPrice * finalValue).toString();
                                    handleInputChange('spareParts', newParts);
                                  }}
                                  className="w-20 text-center focus:ring-2 focus:ring-orange-500 font-medium"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentQty = parseInt(part.quantity || '1') || 1;
                                    const newParts = [...formData.spareParts];
                                    const newQty = currentQty + 1;
                                    newParts[index].quantity = newQty.toString();
                                    const unitPrice = parseFloat(newParts[index].price) || 0;
                                    newParts[index].total = (unitPrice * newQty).toString();
                                    handleInputChange('spareParts', newParts);
                                  }}
                                  className="h-10 w-10 p-0 text-lg font-bold border-[#CE9F6B] hover:bg-[#CE9F6B]/10 text-[#976E44]"
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1 text-sm text-[#5D6E73]">
                                <DollarSign className="h-3 w-3 text-[#979796]" />
                                Unit Price (₹)
                                <span className="text-xs text-[#979796] ml-1">(Fixed)</span>
                              </Label>
                              <div className="h-10 px-3 py-2 bg-[#AEBFC3]/20 border border-[#92A2A5] rounded-md flex items-center text-[#5D6E73] font-medium">
                                ₹{parseFloat(part.price || '0').toLocaleString('en-IN')}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1 text-sm text-[#976E44] font-medium">
                                <TrendingUp className="h-3 w-3 text-[#CE9F6B]" />
                                Line Total
                              </Label>
                              <div className="h-10 px-3 py-2 bg-[#CE9F6B]/20 border border-[#CE9F6B] rounded-md flex items-center text-[#976E44] font-bold">
                                ₹{parseFloat(part.total || '0').toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Add Spare Part Dropdown */}
                <div className="space-y-2">
                  <Label>Add Spare Part</Label>
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
                        }
                      }
                    }}
                    disabled={loadingSpareParts}
                  >
                    <SelectTrigger className="focus:ring-2 focus:ring-orange-500">
                      <SelectValue placeholder={
                        loadingSpareParts 
                          ? 'Loading spare parts...' 
                          : spareParts.length === 0 
                            ? 'No spare parts available' 
                            : 'Select spare part to add'
                      } />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <div className="max-h-60 overflow-y-auto">
                        {spareParts
                          .filter(sp => !formData.spareParts.find(p => p.name === sp.id.toString()))
                          .map((sparePart) => (
                            <SelectItem key={sparePart.id} value={sparePart.id.toString()}>
                              <div className="flex items-center space-x-3 py-2">
                                {sparePart.imageUrl && (
                                  <img 
                                    src={sparePart.imageUrl} 
                                    alt={sparePart.name}
                                    className="w-8 h-8 object-cover rounded border"
                                  />
                                )}
                                <div className="flex flex-col">
                                  <span className="font-medium">{sparePart.name}</span>
                                  <div className="flex items-center space-x-2 text-xs text-[#AEBFC3]0">
                                    <span>#{sparePart.partNumber}</span>
                                    <span>•</span>
                                    <span>₹{sparePart.basePrice}</span>
                                    {sparePart.category && (
                                      <>
                                        <span>•</span>
                                        <span>{sparePart.category}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        }
                      </div>
                      {spareParts.filter(sp => !formData.spareParts.find(p => p.name === sp.id.toString())).length === 0 && (
                        <div className="p-4 text-sm text-[#AEBFC3]0 text-center">
                          {formData.spareParts.length === spareParts.length 
                            ? 'All available spare parts have been added' 
                            : 'No spare parts available'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.spareParts.length === 0 && (
                  <div className="text-center py-8 text-[#AEBFC3]0">
                    <Target className="h-12 w-12 mx-auto mb-3 text-[#92A2A5]" />
                    <p>No spare parts selected yet. Use the dropdown above to add spare parts.</p>
                    <p className="text-xs mt-2">Spare parts are managed by admin and include predefined pricing.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

          {/* Form Actions */}
          <div className="bg-white rounded-2xl shadow-lg border border-[#92A2A5]/60 p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.back()} 
                disabled={loading}
                className="px-8 py-3 text-base font-medium border-[#92A2A5] hover:border-slate-400 hover:bg-[#AEBFC3]/10 transition-all duration-200"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="px-8 py-3 text-base font-medium bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A] shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
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

      {/* Add Contact Dialog */}
      <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#546A7A]" />
              Add New Contact
            </DialogTitle>
            <DialogDescription>
              Create a new contact for {selectedCustomer?.companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Name *</Label>
              <Input
                id="contactName"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Enter contact name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="contact@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone *</Label>
              <Input
                id="contactPhone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddContactOpen(false)
                setNewContact({ name: '', email: '', phone: '' })
              }}
              disabled={isCreatingContact}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateContact}
              disabled={isCreatingContact}
            >
              {isCreatingContact ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Contact
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Asset Dialog */}
      <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-[#546A7A]" />
              Add New Asset
            </DialogTitle>
            <DialogDescription>
              Create a new asset for {selectedCustomer?.companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assetName">Asset Name *</Label>
              <Input
                id="assetName"
                value={newAsset.assetName}
                onChange={(e) => setNewAsset({ ...newAsset, assetName: e.target.value })}
                placeholder="Enter asset name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="machineSerialNumber">Serial Number *</Label>
              <Input
                id="machineSerialNumber"
                value={newAsset.machineSerialNumber}
                onChange={(e) => setNewAsset({ ...newAsset, machineSerialNumber: e.target.value })}
                placeholder="Enter serial number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetModel">Model</Label>
              <Input
                id="assetModel"
                value={newAsset.model}
                onChange={(e) => setNewAsset({ ...newAsset, model: e.target.value })}
                placeholder="Enter model (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddAssetOpen(false)
                setNewAsset({ assetName: '', machineSerialNumber: '', model: '' })
              }}
              disabled={isCreatingAsset}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateAsset}
              disabled={isCreatingAsset}
            >
              {isCreatingAsset ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Asset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
