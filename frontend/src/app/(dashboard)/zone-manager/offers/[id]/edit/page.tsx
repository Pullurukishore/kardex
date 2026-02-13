'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiService } from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Building2, 
  FileText, 
  Calendar, 
  DollarSign, 
  Target, 
  MessageSquare,
  Package,
  TrendingUp,
  User,
  Phone,
  Mail,
  Sparkles,
  IndianRupee,
  Wrench,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  Trash2,
  Image,
  X,
  MapPin,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'

const PRODUCT_TYPES = ['RELOCATION', 'CONTRACT', 'SPARE_PARTS', 'KARDEX_CONNECT', 'UPGRADE_KIT', 'SOFTWARE', 'OTHERS', 'BD_SPARE', 'RETROFIT_KIT']
const STAGES = ['INITIAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'PO_RECEIVED', 'WON', 'LOST']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'INITIAL': { bg: 'bg-[#96AEC2]/10', text: 'text-[#546A7A]', border: 'border-[#96AEC2]' },
  'PROPOSAL_SENT': { bg: 'bg-[#546A7A]/10', text: 'text-[#546A7A]', border: 'border-[#546A7A]' },
  'NEGOTIATION': { bg: 'bg-[#CE9F6B]/10', text: 'text-[#976E44]', border: 'border-[#CE9F6B]/40' },
  'PO_RECEIVED': { bg: 'bg-[#82A094]/10', text: 'text-[#4F6A64]', border: 'border-[#A2B9AF]/40' },
  'WON': { bg: 'bg-[#A2B9AF]/10', text: 'text-[#4F6A64]', border: 'border-[#A2B9AF]' },
  'LOST': { bg: 'bg-[#E17F70]/10', text: 'text-[#75242D]', border: 'border-[#E17F70]' }
}

interface SparePart {
  id: number
  name: string
  partNumber: string
  basePrice: number
  imageUrl?: string
  category?: string
}

interface OfferSparePart {
  id: number
  sparePartId: number
  quantity: number
  unitPrice: number
  totalPrice: number
  sparePart: SparePart
}

export default function EditOfferPage() {
  const router = useRouter()
  const params = useParams()
  const offerId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offer, setOffer] = useState<any>(null)
  
  // Spare parts state
  const [spareParts, setSpareParts] = useState<SparePart[]>([])
  const [loadingSpareParts, setLoadingSpareParts] = useState(false)
  const [sparePartSearch, setSparePartSearch] = useState('')
  const [selectedSpareParts, setSelectedSpareParts] = useState<Array<{
    sparePartId: number
    name: string
    partNumber: string
    imageUrl?: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    productType: '',
    lead: '',
    stage: '',
    priority: '',
    offerValue: '',
    offerMonth: '',
    poExpectedMonth: '',
    probabilityPercentage: '',
    poNumber: '',
    poDate: '',
    poValue: '',
    poReceivedMonth: '',
    remarks: '',
    openFunnel: false,
    company: '',
    location: '',
    department: '',
    contactPersonName: '',
    contactNumber: '',
    email: '',
    machineSerialNumber: ''
  })

  useEffect(() => {
    fetchOffer()
  }, [offerId])

  useEffect(() => {
    if (formData.productType === 'SPARE_PARTS') {
      fetchSpareParts()
    }
  }, [formData.productType])

  const fetchOffer = async () => {
    try {
      setLoading(true)
      const response = await apiService.getOffer(parseInt(offerId))
      const offerData = response.offer || response
      setOffer(offerData)
      
      // Populate form with existing data
      setFormData({
        title: offerData.title || '',
        description: offerData.description || '',
        productType: offerData.productType || '',
        lead: offerData.lead || '',
        stage: offerData.stage || '',
        priority: offerData.priority || '',
        offerValue: offerData.offerValue || '',
        offerMonth: offerData.offerMonth || '',
        poExpectedMonth: offerData.poExpectedMonth || '',
        probabilityPercentage: offerData.probabilityPercentage || '',
        poNumber: offerData.poNumber || '',
        poDate: offerData.poDate ? offerData.poDate.split('T')[0] : '',
        poValue: offerData.poValue || '',
        poReceivedMonth: offerData.poReceivedMonth || '',
        remarks: '',
        openFunnel: offerData.openFunnel || false,
        company: offerData.company || offerData.customer?.companyName || '',
        location: offerData.location || offerData.customer?.city || '',
        department: offerData.department || '',
        contactPersonName: offerData.contactPersonName || offerData.contact?.contactPersonName || '',
        contactNumber: offerData.contactNumber || offerData.contact?.contactNumber || '',
        email: offerData.email || offerData.contact?.email || '',
        machineSerialNumber: offerData.machineSerialNumber || ''
      })

      // Load existing spare parts
      if (offerData.offerSpareParts && Array.isArray(offerData.offerSpareParts)) {
        setSelectedSpareParts(offerData.offerSpareParts.map((osp: OfferSparePart) => ({
          sparePartId: osp.sparePartId,
          name: osp.sparePart.name,
          partNumber: osp.sparePart.partNumber,
          imageUrl: osp.sparePart.imageUrl,
          quantity: osp.quantity,
          unitPrice: parseFloat(osp.unitPrice.toString()),
          totalPrice: parseFloat(osp.totalPrice.toString())
        })))
      }
    } catch (error: any) {
      console.error('Failed to fetch offer:', error)
      toast.error('Failed to load offer details')
      router.push('/zone-manager/offers')
    } finally {
      setLoading(false)
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addSparePart = (sparePartId: string) => {
    const sp = spareParts.find(s => s.id === parseInt(sparePartId))
    if (!sp) return
    
    if (selectedSpareParts.find(s => s.sparePartId === sp.id)) {
      toast.error('This spare part is already added')
      return
    }

    setSelectedSpareParts(prev => [...prev, {
      sparePartId: sp.id,
      name: sp.name,
      partNumber: sp.partNumber,
      imageUrl: sp.imageUrl,
      quantity: 1,
      unitPrice: parseFloat(sp.basePrice.toString()),
      totalPrice: parseFloat(sp.basePrice.toString())
    }])
    setSparePartSearch('')
  }

  const updateSparePartQuantity = (index: number, quantity: number) => {
    setSelectedSpareParts(prev => {
      const updated = [...prev]
      updated[index].quantity = quantity
      updated[index].totalPrice = quantity * updated[index].unitPrice
      return updated
    })
  }

  const removeSparePartByIndex = (index: number) => {
    setSelectedSpareParts(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)

      const updateData: any = {
        title: formData.title || null,
        description: formData.description || null,
        productType: formData.productType || null,
        lead: formData.lead || null,
        stage: formData.stage || null,
        priority: formData.priority || null,
        offerValue: formData.offerValue ? parseFloat(formData.offerValue) : null,
        offerMonth: formData.offerMonth || null,
        poExpectedMonth: formData.poExpectedMonth || null,
        probabilityPercentage: formData.probabilityPercentage ? parseFloat(formData.probabilityPercentage) : null,
        poNumber: formData.poNumber || null,
        poDate: formData.poDate || null,
        poValue: formData.poValue ? parseFloat(formData.poValue) : null,
        poReceivedMonth: formData.poReceivedMonth || null,
        remarks: formData.remarks || null,
        openFunnel: formData.openFunnel,
        company: formData.company || null,
        location: formData.location || null,
        department: formData.department || null,
        contactPersonName: formData.contactPersonName || null,
        contactNumber: formData.contactNumber || null,
        email: formData.email || null,
        machineSerialNumber: formData.machineSerialNumber || null,
        spareParts: formData.productType === 'SPARE_PARTS' ? selectedSpareParts.map(sp => ({
          sparePartId: sp.sparePartId,
          quantity: sp.quantity,
          unitPrice: sp.unitPrice,
          totalPrice: sp.totalPrice
        })) : undefined
      }

      await apiService.updateOffer(parseInt(offerId), updateData)
      toast.success('Offer updated successfully!')
      router.push(`/zone-manager/offers/${offerId}`)
    } catch (error: any) {
      console.error('Failed to update offer:', error)
      toast.error(error.response?.data?.error || 'Failed to update offer')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const getStageProgress = (stage: string) => {
    const stageIndex = STAGES.indexOf(stage)
    if (stage === 'LOST') return 0
    if (stage === 'WON') return 100
    return Math.round((stageIndex / (STAGES.length - 2)) * 100)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#96AEC2]/10 via-indigo-50 to-[#96AEC2]/10 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center mx-auto shadow-2xl shadow-[#6F8A9D]/30">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#CE9F6B] rounded-full flex items-center justify-center animate-bounce shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-[#5D6E73] font-semibold text-lg mt-6">Loading offer details...</p>
          <p className="text-[#AEBFC3]0 text-sm mt-1">Please wait a moment</p>
        </div>
      </div>
    )
  }

  const sparePartsTotal = selectedSpareParts.reduce((sum, sp) => sum + sp.totalPrice, 0)
  const stageColor = STAGE_COLORS[formData.stage] || STAGE_COLORS['INITIAL']

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/40">
      <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/zone-manager/offers/${offerId}`)}
            className="mb-4 text-[#5D6E73] hover:text-[#546A7A] hover:bg-white/70"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Offer
          </Button>

          {/* Hero Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] rounded-2xl shadow-xl p-6 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#6F8A9D]/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">Edit Offer</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                      {offer?.offerReferenceNumber}
                    </span>
                    {offer?.productType && (
                      <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                        {offer.productType.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {formData.stage && (
                <div className={`px-4 py-2 rounded-xl ${stageColor.bg} ${stageColor.border} border backdrop-blur-sm`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-4 w-4 ${stageColor.text}`} />
                    <span className={`font-semibold ${stageColor.text}`}>
                      {formData.stage.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border border-[#96AEC2]/30 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#96AEC2]/20 rounded-lg">
                <IndianRupee className="h-5 w-5 text-[#546A7A]" />
              </div>
              <div>
                <p className="text-xs text-[#AEBFC3]0 font-medium">Offer Value</p>
                <p className="text-lg font-bold text-[#546A7A]">
                  {formData.offerValue ? formatCurrency(Number(formData.offerValue)) : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#A2B9AF]/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#82A094]/20 rounded-lg">
                <Target className="h-5 w-5 text-[#4F6A64]" />
              </div>
              <div>
                <p className="text-xs text-[#AEBFC3]0 font-medium">Win Probability</p>
                <p className="text-lg font-bold text-[#546A7A]">
                  {formData.probabilityPercentage ? `${formData.probabilityPercentage}%` : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#96AEC2]/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#6F8A9D]/20 rounded-lg">
                <Calendar className="h-5 w-5 text-[#546A7A]" />
              </div>
              <div>
                <p className="text-xs text-[#AEBFC3]0 font-medium">PO Expected</p>
                <p className="text-lg font-bold text-[#546A7A]">
                  {formData.poExpectedMonth || '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#EEC1BF]/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#CE9F6B]/20 rounded-lg">
                <Clock className="h-5 w-5 text-[#976E44]" />
              </div>
              <div>
                <p className="text-xs text-[#AEBFC3]0 font-medium">Progress</p>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#CE9F6B] to-[#CE9F6B] transition-all duration-300"
                      style={{ width: `${getStageProgress(formData.stage)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-[#5D6E73]">{getStageProgress(formData.stage)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white py-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription className="text-[#96AEC2]">Core offer details and classification</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 bg-gradient-to-b from-[#96AEC2]/10/30 to-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Offer title"
                    className="h-10 border-[#92A2A5] focus:border-[#6F8A9D] focus:ring-blue-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productType" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-[#CE9F6B]" />
                    Product Type
                  </Label>
                  <Select value={formData.productType} onValueChange={(value) => handleInputChange('productType', value)}>
                    <SelectTrigger className="h-10 border-[#92A2A5] focus:border-[#6F8A9D]">
                      <SelectValue placeholder="Select product type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stage" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Current Stage
                  </Label>
                  <Select value={formData.stage} onValueChange={(value) => handleInputChange('stage', value)}>
                    <SelectTrigger className="h-10 border-[#92A2A5] focus:border-[#6F8A9D]">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map(stage => (
                        <SelectItem key={stage} value={stage}>
                          {stage.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-[#E17F70]" />
                    Priority
                  </Label>
                  <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                    <SelectTrigger className="h-10 border-[#92A2A5] focus:border-red-400">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(priority => (
                        <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lead" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#82A094]" />
                    Lead Status
                  </Label>
                  <Select value={formData.lead} onValueChange={(value) => handleInputChange('lead', value)}>
                    <SelectTrigger className="h-10 border-[#92A2A5] focus:border-green-400">
                      <SelectValue placeholder="Select lead status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">Yes</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-[#546A7A]" />
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed offer description"
                    rows={3}
                    className="border-[#92A2A5] focus:border-[#96AEC2] focus:ring-indigo-400"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spare Parts Section - Only for SPARE_PARTS */}
          {formData.productType === 'SPARE_PARTS' && (
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Package className="h-5 w-5" />
                      Spare Parts
                    </CardTitle>
                    <CardDescription className="text-orange-100">
                      {loadingSpareParts ? 'Loading...' : `${spareParts.length} available`}
                      {selectedSpareParts.length > 0 && ` • ${selectedSpareParts.length} selected`}
                    </CardDescription>
                  </div>
                  {selectedSpareParts.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                      <IndianRupee className="h-4 w-4" />
                      <span className="text-sm font-bold">
                        {formatCurrency(sparePartsTotal)}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 bg-gradient-to-b from-[#EEC1BF]/10/30 to-white">
                <Select value="" onValueChange={addSparePart} disabled={loadingSpareParts}>
                  <SelectTrigger className="h-10 border-2 border-dashed border-[#CE9F6B] bg-[#CE9F6B]/10/50 hover:border-[#CE9F6B] hover:bg-[#CE9F6B]/10">
                    <div className="flex items-center gap-2 text-[#976E44]">
                      <Plus className="h-4 w-4" />
                      <span>{loadingSpareParts ? 'Loading...' : 'Add spare part'}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="sticky top-0 bg-white border-b p-2 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#979796] h-4 w-4" />
                        <Input
                          placeholder="Search spare parts..."
                          value={sparePartSearch}
                          onChange={(e) => setSparePartSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {sparePartSearch && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSparePartSearch(''); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#979796] hover:text-[#5D6E73]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {spareParts
                        .filter(sp => !selectedSpareParts.find(s => s.sparePartId === sp.id))
                        .filter(sp => {
                          if (!sparePartSearch) return true
                          const search = sparePartSearch.toLowerCase()
                          return sp.name.toLowerCase().includes(search) || 
                                 sp.partNumber.toLowerCase().includes(search) ||
                                 sp.category?.toLowerCase().includes(search)
                        })
                        .map(sp => (
                          <SelectItem key={sp.id} value={sp.id.toString()}>
                            <div className="flex items-center gap-2">
                              {sp.imageUrl ? (
                                <img src={sp.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
                              ) : (
                                <div className="w-6 h-6 bg-[#CE9F6B]/20 rounded flex items-center justify-center">
                                  <Image className="h-3 w-3 text-[#CE9F6B]" />
                                </div>
                              )}
                              <div className="flex-1">
                                <span className="font-medium text-sm">{sp.name}</span>
                                <span className="text-xs text-[#AEBFC3]0 ml-2">#{sp.partNumber}</span>
                              </div>
                              <span className="text-xs font-medium text-[#5D6E73]">
                                {formatCurrency(parseFloat(sp.basePrice.toString()))}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </div>
                  </SelectContent>
                </Select>

                {selectedSpareParts.length > 0 && (
                  <div className="border border-[#CE9F6B] rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-[#CE9F6B]/10 border-b border-[#CE9F6B]">
                        <tr>
                          <th className="text-left text-xs font-semibold text-[#976E44] px-4 py-3">Part</th>
                          <th className="text-center text-xs font-semibold text-[#976E44] px-4 py-3 w-24">Qty</th>
                          <th className="text-right text-xs font-semibold text-[#976E44] px-4 py-3 w-28">Price</th>
                          <th className="text-right text-xs font-semibold text-[#976E44] px-4 py-3 w-28">Total</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSpareParts.map((sp, index) => (
                          <tr key={index} className="border-b border-[#EEC1BF]/20 last:border-b-0 hover:bg-[#CE9F6B]/10/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {sp.imageUrl ? (
                                  <img src={sp.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-[#CE9F6B]" />
                                ) : (
                                  <div className="w-10 h-10 bg-[#CE9F6B]/20 rounded-lg flex items-center justify-center">
                                    <Image className="h-4 w-4 text-[#CE9F6B]" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-sm text-[#546A7A]">{sp.name}</p>
                                  <p className="text-xs text-[#AEBFC3]0">#{sp.partNumber}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="1"
                                value={sp.quantity}
                                onChange={(e) => updateSparePartQuantity(index, parseInt(e.target.value) || 1)}
                                className="h-8 w-16 text-center text-sm mx-auto border-[#CE9F6B] focus:border-[#CE9F6B]"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm text-[#5D6E73]">{formatCurrency(sp.unitPrice)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-sm text-[#976E44]">{formatCurrency(sp.totalPrice)}</span>
                            </td>
                            <td className="px-2 py-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSparePartByIndex(index)}
                                className="h-8 w-8 p-0 text-[#979796] hover:text-[#E17F70] hover:bg-[#E17F70]/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] text-white">
                        <tr>
                          <td className="px-4 py-3" colSpan={3}>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              <span className="font-medium">
                                Total ({selectedSpareParts.length} items, {selectedSpareParts.reduce((s, p) => s + p.quantity, 0)} units)
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-lg font-bold">{formatCurrency(sparePartsTotal)}</span>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {selectedSpareParts.length === 0 && !loadingSpareParts && (
                  <div className="text-center py-8 border-2 border-dashed border-[#CE9F6B] rounded-xl bg-[#CE9F6B]/10/50">
                    <Package className="h-10 w-10 mx-auto mb-2 text-orange-300" />
                    <p className="text-sm font-medium text-[#976E44]">No spare parts selected</p>
                    <p className="text-xs text-[#CE9F6B] mt-1">Use the dropdown above to add parts</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Financial Information */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#82A094] to-[#82A094] text-white py-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <IndianRupee className="h-5 w-5" />
                Financial Information
              </CardTitle>
              <CardDescription className="text-emerald-100">Pricing, value details, and PO information</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 bg-gradient-to-b from-[#A2B9AF]/10/30 to-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="offerValue" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Offer Value (₹)
                  </Label>
                  <Input
                    id="offerValue"
                    type="number"
                    value={formData.offerValue}
                    onChange={(e) => handleInputChange('offerValue', e.target.value)}
                    placeholder="0.00"
                    className="h-10 border-[#92A2A5] focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poValue" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-[#82A094]" />
                    PO Value (₹)
                  </Label>
                  <Input
                    id="poValue"
                    type="number"
                    value={formData.poValue}
                    onChange={(e) => handleInputChange('poValue', e.target.value)}
                    placeholder="0.00"
                    className="h-10 border-[#92A2A5] focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="probabilityPercentage" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Win Probability (%)
                  </Label>
                  <Select
                    value={formData.probabilityPercentage}
                    onValueChange={(value) => handleInputChange('probabilityPercentage', value)}
                  >
                    <SelectTrigger className="h-10 border-[#92A2A5] focus:border-emerald-400">
                      <SelectValue placeholder="Select probability" />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
                        <SelectItem key={value} value={value.toString()}>{value}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poNumber" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#546A7A]" />
                    PO Number
                  </Label>
                  <Input
                    id="poNumber"
                    value={formData.poNumber}
                    onChange={(e) => handleInputChange('poNumber', e.target.value)}
                    placeholder="Purchase order number"
                    className="h-10 border-[#92A2A5] focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poDate" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#CE9F6B]" />
                    PO Date
                  </Label>
                  <Input
                    id="poDate"
                    type="date"
                    value={formData.poDate}
                    onChange={(e) => handleInputChange('poDate', e.target.value)}
                    className="h-10 border-[#92A2A5] focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offerMonth" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Offer Month
                  </Label>
                  <Input
                    id="offerMonth"
                    value={formData.offerMonth}
                    onChange={(e) => handleInputChange('offerMonth', e.target.value)}
                    placeholder="e.g., Jan-2025"
                    className="h-10 border-[#92A2A5] focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poExpectedMonth" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#CE9F6B]" />
                    PO Expected Month
                  </Label>
                  <Input
                    id="poExpectedMonth"
                    value={formData.poExpectedMonth}
                    onChange={(e) => handleInputChange('poExpectedMonth', e.target.value)}
                    placeholder="e.g., Feb-2025"
                    className="h-10 border-[#92A2A5] focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poReceivedMonth" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#82A094]" />
                    PO Received Month
                  </Label>
                  <Input
                    id="poReceivedMonth"
                    value={formData.poReceivedMonth}
                    onChange={(e) => handleInputChange('poReceivedMonth', e.target.value)}
                    placeholder="e.g., Mar-2025"
                    className="h-10 border-[#92A2A5] focus:border-emerald-400"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer & Contact Information */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#CE9F6B] text-white py-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5" />
                Customer Information
              </CardTitle>
              <CardDescription className="text-amber-100">Customer and contact details</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 bg-gradient-to-b from-[#EEC1BF]/10/30 to-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#CE9F6B]" />
                    Company Name
                  </Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    placeholder="Company name"
                    className="h-10 border-[#92A2A5] focus:border-amber-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#E17F70]" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="City, State"
                    className="h-10 border-[#92A2A5] focus:border-amber-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Department
                  </Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    placeholder="Department"
                    className="h-10 border-[#92A2A5] focus:border-amber-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPersonName" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[#6F8A9D]" />
                    Contact Person
                  </Label>
                  <Input
                    id="contactPersonName"
                    value={formData.contactPersonName}
                    onChange={(e) => handleInputChange('contactPersonName', e.target.value)}
                    placeholder="Contact person name"
                    className="h-10 border-[#92A2A5] focus:border-amber-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[#82A094]" />
                    Contact Number
                  </Label>
                  <Input
                    id="contactNumber"
                    value={formData.contactNumber}
                    onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="h-10 border-[#92A2A5] focus:border-amber-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[#546A7A]" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@example.com"
                    className="h-10 border-[#92A2A5] focus:border-amber-400"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="machineSerialNumber" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-[#AEBFC3]0" />
                    Machine Serial Number
                  </Label>
                  <Input
                    id="machineSerialNumber"
                    value={formData.machineSerialNumber}
                    onChange={(e) => handleInputChange('machineSerialNumber', e.target.value)}
                    placeholder="Serial number"
                    className="h-10 border-[#92A2A5] focus:border-amber-400"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Settings */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white py-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <MessageSquare className="h-5 w-5" />
                Notes & Settings
              </CardTitle>
              <CardDescription className="text-[#6F8A9D]">Add remarks and configure settings</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 bg-gradient-to-b from-[#96AEC2]/10/30 to-white">
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[#546A7A] shadow-sm hover:shadow-md transition-shadow">
                <Checkbox
                  id="openFunnel"
                  checked={formData.openFunnel}
                  onCheckedChange={(checked) => handleInputChange('openFunnel', checked)}
                  className="h-5 w-5 text-[#546A7A]"
                />
                <div className="flex-1">
                  <Label htmlFor="openFunnel" className="font-medium text-[#5D6E73] cursor-pointer">
                    Open Funnel
                  </Label>
                  <p className="text-sm text-[#AEBFC3]0">Mark this offer as part of the open funnel pipeline</p>
                </div>
                {formData.openFunnel && (
                  <Badge className="bg-[#82A094]/20 text-[#4F6A64] border-0">Active</Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks" className="text-sm font-medium text-[#5D6E73] flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-[#546A7A]" />
                  Stage Remarks
                  {formData.stage === 'LOST' && <span className="text-[#E17F70] text-xs ml-2">(Required for LOST stage)</span>}
                </Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  placeholder={formData.stage === 'LOST' ? 'Please explain why this deal was lost...' : 'Additional notes about decision, pricing, or any concerns...'}
                  rows={3}
                  className="border-[#92A2A5] focus:border-[#96AEC2] focus:ring-indigo-400"
                />
                <p className="text-xs text-[#979796]">Remarks are saved per stage and tracked in the offer history.</p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 sticky bottom-4">
            <div className="flex gap-3 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-[#92A2A5]">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/zone-manager/offers/${offerId}`)}
                disabled={saving}
                className="min-w-[120px] h-11 border-[#92A2A5] hover:bg-[#AEBFC3]/10"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="min-w-[160px] h-11 bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A] text-white shadow-lg hover:shadow-xl transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
