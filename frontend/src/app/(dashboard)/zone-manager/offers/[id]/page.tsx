'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft, 
  Pencil as Edit, 
  CheckCircle, 
  Clock, 
  FileText, 
  DollarSign,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Package,
  TrendingUp,
  AlertCircle,
  Loader2,
  Wrench,
  IndianRupee,
  Image as ImageIcon
} from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'

// Main progression stages (excludes LOST as it's a separate outcome)
// Note: PO_RECEIVED leads directly to WON (ORDER_BOOKED stage removed)
const STAGES = [
  { key: 'INITIAL', label: 'Initial', icon: FileText },
  { key: 'PROPOSAL_SENT', label: 'Proposal Sent', icon: FileText },
  { key: 'NEGOTIATION', label: 'Negotiation', icon: TrendingUp },
  { key: 'PO_RECEIVED', label: 'PO Received', icon: Package },
  { key: 'WON', label: 'Won', icon: CheckCircle }
]

// LOST is a separate outcome, not part of linear progression
const LOST_STAGE = { key: 'LOST', label: 'Lost', icon: AlertCircle }

// All stages for selection dropdown
const ALL_STAGES = [...STAGES, LOST_STAGE]

// Stage-specific context and requirements
const STAGE_INFO: Record<string, { description: string; color: string; icon: string; requiresAllFields: boolean }> = {
  'INITIAL': {
    description: 'Initial stage - Basic offer information setup',
    color: 'blue',
    icon: '📝',
    requiresAllFields: false
  },
  'PROPOSAL_SENT': {
    description: 'Proposal has been sent to customer - Ensure all offer details are finalized before sending',
    color: 'indigo',
    icon: '📨',
    requiresAllFields: true
  },
  'NEGOTIATION': {
    description: 'In active negotiations - Document key discussion points, pricing changes, objections, and customer concerns',
    color: 'amber',
    icon: '💬',
    requiresAllFields: true
  },
  'PO_RECEIVED': {
    description: 'Purchase Order received - Capture PO details and complete the order. PO received means WON!',
    color: 'green',
    icon: '📄',
    requiresAllFields: true
  },
  'WON': {
    description: 'Deal successfully closed! Ensure all PO and order details are complete',
    color: 'green',
    icon: '🎉',
    requiresAllFields: true
  },
  'LOST': {
    description: 'Deal lost - Document the reason for loss to improve future proposals',
    color: 'red',
    icon: '❌',
    requiresAllFields: false
  }
}

export default function OfferDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [offer, setOffer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateData, setUpdateData] = useState({
    offerReferenceDate: '',
    title: '',
    offerValue: '',
    offerMonth: '',
    probabilityPercentage: '',
    poExpectedMonth: '',
    stage: '',
    remarks: '',
    poNumber: '',
    poDate: '',
    poValue: '',
    bookingDateInSap: ''
  })

  useEffect(() => {
    if (params.id) {
      fetchOffer()
    }
  }, [params.id])

  const fetchOffer = async () => {
    try {
      setLoading(true)
      const response = await apiService.getOffer(parseInt(params.id as string))
      setOffer(response.offer)
      // Initialize update data
      setUpdateData({
        offerReferenceDate: response.offer.offerReferenceDate ? new Date(response.offer.offerReferenceDate).toISOString().split('T')[0] : '',
        title: response.offer.title || '',
        offerValue: response.offer.offerValue || '',
        offerMonth: response.offer.offerMonth || '',
        probabilityPercentage: response.offer.probabilityPercentage || '',
        poExpectedMonth: response.offer.poExpectedMonth || '',
        stage: response.offer.stage,
        remarks: '', // Always start with empty remarks field - stage remarks are shown separately
        poNumber: response.offer.poNumber || '',
        poDate: response.offer.poDate ? new Date(response.offer.poDate).toISOString().split('T')[0] : '',
        poValue: response.offer.poValue || '',
        bookingDateInSap: response.offer.bookingDateInSap ? new Date(response.offer.bookingDateInSap).toISOString().split('T')[0] : ''
      })
    } catch (error: any) {
      console.error('Failed to fetch offer:', error)
      toast.error('Failed to load offer details')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateOffer = async () => {
    try {
      // Validation
      if (!updateData.stage) {
        toast.error('Stage is required')
        return
      }

      if (!updateData.title || !updateData.title.trim()) {
        toast.error('Offer title is required')
        return
      }

      if (updateData.probabilityPercentage) {
        const prob = parseInt(updateData.probabilityPercentage)
        if (prob < 1 || prob > 100) {
          toast.error('Win probability must be between 1 and 100')
          return
        }
      }

      if (updateData.offerValue && parseFloat(updateData.offerValue) < 0) {
        toast.error('Offer value cannot be negative')
        return
      }

      // Check if stage requires all fields
      const stageInfo = STAGE_INFO[updateData.stage]
      if (stageInfo && stageInfo.requiresAllFields) {
        const fieldLabels: Record<string, string> = {
          offerReferenceDate: 'Offer Reference Date',
          offerValue: 'Offer Value',
          offerMonth: 'Offer Month',
          probabilityPercentage: 'Win Probability',
          poExpectedMonth: 'PO Expected Month'
        }
        
        const requiredFields = ['offerReferenceDate', 'offerValue', 'offerMonth', 'probabilityPercentage', 'poExpectedMonth']
        
        for (const field of requiredFields) {
          const value = updateData[field as keyof typeof updateData]
          if (!value || (typeof value === 'string' && !value.trim())) {
            toast.error(`${fieldLabels[field]} is required for ${ALL_STAGES.find(s => s.key === updateData.stage)?.label} stage`)
            return
          }
        }
      }

      // PO_RECEIVED stage specific validations (PO_RECEIVED = deal won!)
      if ((updateData.stage === 'PO_RECEIVED' || updateData.stage === 'WON')) {
        if (!updateData.poNumber || !updateData.poNumber.trim()) {
          toast.error('PO Number is required for this stage')
          return
        }
        if (!updateData.poDate) {
          toast.error('PO Date is required for this stage')
          return
        }
        if (!updateData.poValue) {
          toast.error('PO Value is required for this stage')
          return
        }
        if (parseFloat(updateData.poValue) <= 0) {
          toast.error('PO Value must be greater than zero')
          return
        }
      }

      // LOST stage specific validation - require reason for loss
      if (updateData.stage === 'LOST') {
        if (!updateData.remarks || !updateData.remarks.trim()) {
          toast.error('Please provide a reason for losing this deal')
          return
        }
      }

      setUpdating(true)
      const payload: any = {
        offerReferenceDate: updateData.offerReferenceDate ? new Date(updateData.offerReferenceDate).toISOString() : null,
        title: updateData.title.trim(),
        offerValue: updateData.offerValue ? parseFloat(updateData.offerValue) : null,
        offerMonth: updateData.offerMonth || null,
        probabilityPercentage: updateData.probabilityPercentage ? parseInt(updateData.probabilityPercentage) : null,
        poExpectedMonth: updateData.poExpectedMonth || null,
        stage: updateData.stage,
        remarks: updateData.remarks?.trim() || null,
        poNumber: updateData.poNumber?.trim() || null,
        poDate: updateData.poDate ? new Date(updateData.poDate).toISOString() : null,
        poValue: updateData.poValue ? parseFloat(updateData.poValue) : null,
        bookingDateInSap: updateData.bookingDateInSap ? new Date(updateData.bookingDateInSap).toISOString() : null
      }

      await apiService.updateOffer(offer.id, payload)
      toast.success('Offer updated successfully')
      setShowUpdateDialog(false)
      
      // Clear remarks field after successful update since it's now saved in StageRemark
      setUpdateData(prev => ({ ...prev, remarks: '' }))
      
      fetchOffer()
    } catch (error: any) {
      console.error('Failed to update offer:', error)
      toast.error(error.response?.data?.message || 'Failed to update offer')
    } finally {
      setUpdating(false)
    }
  }

  const handleMoveToStage = (stage: string) => {
    setUpdateData(prev => ({ ...prev, stage }))
    setShowUpdateDialog(true)
  }

  const getCurrentStageIndex = () => {
    return STAGES.findIndex(s => s.key === offer?.stage)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#546A7A] mx-auto" />
          <p className="mt-4 text-[#5D6E73]">Loading offer details...</p>
        </div>
      </div>
    )
  }

  if (!offer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-[#E17F70] mx-auto mb-4" />
          <p className="text-[#5D6E73]">Offer not found</p>
          <Button onClick={() => router.push('/zone-manager/offers')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const currentStageIndex = getCurrentStageIndex()

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/zone-manager/offers')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-[#546A7A]">{offer.offerReferenceNumber}</h1>
            <p className="text-[#5D6E73] mt-1">{offer.title || offer.customer?.companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push(`/zone-manager/offers/${offer.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Offer
          </Button>
        </div>
      </div>

      {/* Stage Progress - Modern Design */}
      <Card className="shadow-xl overflow-hidden border-0">
        <CardHeader className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] text-white border-b-0 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white mb-2">Offer Progress Journey</CardTitle>
              <CardDescription className="text-[#96AEC2]">
                Track your offer through each milestone - WON or LOST outcomes after Negotiation
              </CardDescription>
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30">
              <p className="text-sm font-semibold text-white">
                Stage {currentStageIndex + 1} of {STAGES.length}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-10 pb-10 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
          {/* Check if current stage is LOST */}
          {offer.stage === 'LOST' ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-red-100 to-red-200 border-4 border-[#9E3B47] flex items-center justify-center mb-6 shadow-2xl">
                  <AlertCircle className="h-14 w-14 text-[#9E3B47]" />
                </div>
                <div className="absolute -top-2 -right-2 w-12 h-12 bg-[#E17F70]/100 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-2xl">❌</span>
                </div>
              </div>
              <h3 className="text-3xl font-bold text-[#9E3B47] mb-3">Deal Lost</h3>
              <p className="text-[#5D6E73] text-center max-w-md mb-6 text-lg">
                This offer did not convert into a sale
              </p>
              <Badge className="bg-gradient-to-r from-[#E17F70] to-red-600 text-white border-0 text-base px-6 py-3 shadow-lg">
                Status: Lost
              </Badge>
            </div>
          ) : (
            <div className="relative px-4">
              {/* Progress Line Background */}
              <div className="absolute top-8 left-0 right-0 h-2 bg-gradient-to-r from-[#AEBFC3]/40 to-[#AEBFC3]/60 rounded-full" style={{ zIndex: 0 }}></div>
              
              {/* Progress Line Active */}
              <div 
                className={`absolute top-8 left-0 h-2 transition-all duration-700 ease-out rounded-full ${
                  offer.stage === 'WON' 
                    ? 'bg-gradient-to-r from-green-400 via-[#82A094] to-[#82A094] shadow-lg shadow-green-500/50' 
                    : 'bg-gradient-to-r from-[#96AEC2] via-[#6F8A9D] to-[#6F8A9D] shadow-lg shadow-blue-500/50'
                }`}
                style={{ 
                  width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%`,
                  zIndex: 0 
                }}
              ></div>
              
              {/* Stage Steps */}
              <div className="relative flex justify-between" style={{ zIndex: 1 }}>
                {STAGES.map((stage, index) => {
                  const isPast = index < currentStageIndex
                  const isCurrent = index === currentStageIndex
                  const isWon = stage.key === 'WON' && offer.stage === 'WON'
                  const Icon = stage.icon
                  const stageInfo = STAGE_INFO[stage.key] || {}
                  
                  // Color mapping for each stage
                  const stageColors = {
                    blue: { 
                      bg: 'from-[#6F8A9D] to-[#6F8A9D]', 
                      border: 'border-[#6F8A9D]', 
                      ring: 'ring-[#96AEC2]/50', 
                      shadow: 'shadow-blue-500/50',
                      text: 'text-[#546A7A]',
                      badge: 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]'
                    },
                    indigo: { 
                      bg: 'from-[#6F8A9D] to-[#6F8A9D]', 
                      border: 'border-[#6F8A9D]', 
                      ring: 'ring-indigo-200', 
                      shadow: 'shadow-indigo-500/50',
                      text: 'text-[#546A7A]',
                      badge: 'bg-[#546A7A]/20 text-[#546A7A] border-indigo-300'
                    },
                    amber: { 
                      bg: 'from-[#CE9F6B] to-[#976E44]', 
                      border: 'border-[#CE9F6B]', 
                      ring: 'ring-amber-200', 
                      shadow: 'shadow-amber-500/50',
                      text: 'text-[#976E44]',
                      badge: 'bg-[#CE9F6B]/20 text-[#976E44] border-amber-300'
                    },
                    purple: { 
                      bg: 'from-[#6F8A9D] to-[#6F8A9D]', 
                      border: 'border-[#6F8A9D]', 
                      ring: 'ring-purple-200', 
                      shadow: 'shadow-purple-500/50',
                      text: 'text-[#546A7A]',
                      badge: 'bg-[#6F8A9D]/20 text-[#546A7A] border-[#6F8A9D]'
                    },
                    green: { 
                      bg: 'from-[#82A094] to-[#82A094]', 
                      border: 'border-[#82A094]', 
                      ring: 'ring-[#A2B9AF]/50', 
                      shadow: 'shadow-green-500/50',
                      text: 'text-[#4F6A64]',
                      badge: 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094]'
                    },
                    teal: { 
                      bg: 'from-[#82A094] to-[#82A094]', 
                      border: 'border-teal-500', 
                      ring: 'ring-teal-200', 
                      shadow: 'shadow-teal-500/50',
                      text: 'text-[#4F6A64]',
                      badge: 'bg-[#82A094]/20 text-[#4F6A64] border-teal-300'
                    },
                    red: { 
                      bg: 'from-[#E17F70] to-red-600', 
                      border: 'border-[#9E3B47]', 
                      ring: 'ring-[#E17F70]/50', 
                      shadow: 'shadow-red-500/50',
                      text: 'text-[#75242D]',
                      badge: 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]'
                    }
                  }
                  
                  const color = stageColors[stageInfo.color as keyof typeof stageColors] || stageColors.blue
                  
                  return (
                    <div key={stage.key} className="flex flex-col items-center group" style={{ flex: 1 }}>
                      {/* Stage Circle */}
                      <div className="relative">
                        <div 
                          className={`
                            relative w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all duration-300 transform
                            ${(isPast || isCurrent) && !isWon ? `${color.border} bg-gradient-to-br ${color.bg} shadow-lg ${color.shadow}` : ''}
                            ${isCurrent && !isWon ? `ring-8 ${color.ring} shadow-2xl scale-110 animate-pulse` : ''}
                            ${isWon ? 'border-[#82A094] bg-gradient-to-br from-[#82A094] to-[#82A094] ring-8 ring-[#A2B9AF]/50 shadow-2xl shadow-green-500/50 scale-110' : ''}
                            ${!isPast && !isCurrent && !isWon ? 'border-[#92A2A5] bg-white shadow-md hover:scale-105' : ''}
                            ${isPast && !isCurrent && !isWon ? 'scale-100' : ''}
                            group-hover:scale-110
                          `}
                        >
                          <Icon 
                            className={`h-7 w-7 transition-all ${(isPast || isCurrent || isWon) ? 'text-white' : 'text-[#979796]'}`} 
                          />
                        </div>
                        
                        {/* Checkmark for completed stages */}
                        {isPast && !isCurrent && !isWon && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#A2B9AF]/100 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                        )}
                        
                        {/* Success icon for WON */}
                        {isWon && (
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#CE9F6B] rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
                            <span className="text-lg">🎉</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Stage Label */}
                      <p className={`
                        mt-4 text-sm font-bold text-center max-w-[100px] transition-all
                        ${isCurrent && !isWon ? `${color.text} scale-105` : ''}
                        ${isWon ? 'text-[#4F6A64] scale-105' : ''}
                        ${isPast && !isCurrent && !isWon ? color.text : ''}
                        ${!isPast && !isCurrent && !isWon ? 'text-[#AEBFC3]0' : ''}
                      `}>
                        {stage.label}
                      </p>
                      
                      {/* Current Badge */}
                      {isCurrent && !isWon && (
                        <Badge className={`mt-2 bg-gradient-to-r ${color.bg} text-white border-0 shadow-lg px-3 py-1 animate-pulse`}>
                          ⚡ Current
                        </Badge>
                      )}
                      
                      {/* Success Badge */}
                      {isWon && (
                        <Badge className="mt-2 bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-0 shadow-lg px-3 py-1">
                          ✨ Success!
                        </Badge>
                      )}
                      
                      {/* Completed Badge */}
                      {isPast && !isCurrent && !isWon && (
                        <Badge className={`mt-2 ${color.badge} border px-2 py-0.5 text-xs`}>
                          ✓ Done
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Alternative outcome indicator */}
              {currentStageIndex >= 3 && offer.stage !== 'WON' && offer.stage !== 'LOST' && (
                <div className="mt-10 pt-6 border-t-2 border-dashed border-[#92A2A5]">
                  <div className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-xl border-2 border-[#CE9F6B]/40">
                    <AlertCircle className="h-5 w-5 text-[#976E44] flex-shrink-0" />
                    <p className="text-sm text-[#5D6E73] font-medium">
                      Deal can be marked as <span className="font-bold text-[#9E3B47] bg-[#E17F70]/20 px-2 py-0.5 rounded">LOST</span> at any stage if it doesn't close
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Contact Info */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-b-0">
              <CardTitle className="flex items-center gap-2 text-white">
                <Building2 className="h-6 w-6" />
                Customer & Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-5 shadow-md border border-[#A2B9AF]/20 hover:shadow-lg transition-shadow">
                  <h4 className="font-bold text-[#4F6A64] mb-4 flex items-center gap-2 text-lg">
                    <div className="p-2 bg-[#82A094]/20 rounded-lg">
                      <Building2 className="h-5 w-5 text-[#4F6A64]" />
                    </div>
                    Company Details
                  </h4>
                  <dl className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-[#82A094]/100 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Company Name</dt>
                        <dd className="text-base font-bold text-[#546A7A] mt-1">{offer.customer?.companyName || offer.company}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-[#82A094]/100 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Location</dt>
                        <dd className="text-base font-medium text-[#5D6E73] mt-1 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#4F6A64]" />
                          {offer.location || offer.customer?.city}
                        </dd>
                      </div>
                    </div>
                    {offer.department && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-[#82A094]/100 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Department</dt>
                          <dd className="text-base font-medium text-[#5D6E73] mt-1">{offer.department}</dd>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-[#82A094]/100 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Zone</dt>
                        <dd className="text-base font-medium text-[#5D6E73] mt-1">
                          <Badge className="bg-[#82A094]/20 text-[#4F6A64] border-emerald-300 border">
                            {offer.zone?.name}
                          </Badge>
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-md border border-[#96AEC2]/30 hover:shadow-lg transition-shadow">
                  <h4 className="font-bold text-[#546A7A] mb-4 flex items-center gap-2 text-lg">
                    <div className="p-2 bg-[#96AEC2]/20 rounded-lg">
                      <User className="h-5 w-5 text-[#546A7A]" />
                    </div>
                    Contact Person
                  </h4>
                  <dl className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-[#96AEC2]/100 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Name</dt>
                        <dd className="text-base font-bold text-[#546A7A] mt-1">{offer.contactPersonName || offer.contact?.contactPersonName}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-[#96AEC2]/100 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Phone</dt>
                        <dd className="text-base font-medium text-[#5D6E73] mt-1 flex items-center gap-2">
                          <Phone className="h-4 w-4 text-[#546A7A]" />
                          {offer.contactNumber || offer.contact?.contactNumber}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-[#96AEC2]/100 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Email</dt>
                        <dd className="text-base font-medium text-[#5D6E73] mt-1 flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[#546A7A]" />
                          {offer.email || offer.contact?.email}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#9E3B47] text-white border-b-0">
              <CardTitle className="flex items-center gap-2 text-white">
                <IndianRupee className="h-6 w-6" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative overflow-hidden p-6 bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-[#96AEC2]" />
                      <p className="text-sm text-[#96AEC2] font-semibold">Offer Value</p>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {offer.offerValue ? formatCurrency(Number(offer.offerValue)) : 'TBD'}
                    </p>
                  </div>
                </div>
                <div className="relative overflow-hidden p-6 bg-gradient-to-br from-[#82A094] to-[#82A094] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-5 w-5 text-[#A2B9AF]" />
                      <p className="text-sm text-[#A2B9AF] font-semibold">PO Value</p>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {offer.poValue ? formatCurrency(Number(offer.poValue)) : '-'}
                    </p>
                  </div>
                </div>
                <div className="relative overflow-hidden p-6 bg-gradient-to-br from-[#6F8A9D] to-[#9E3B47] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-[#6F8A9D]" />
                      <p className="text-sm text-[#6F8A9D] font-semibold">Win Probability</p>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {offer.probabilityPercentage ? `${offer.probabilityPercentage}%` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide mb-2">Offer Month</dt>
                  <dd className="text-base font-bold text-[#546A7A] flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#546A7A]" />
                    {offer.offerMonth || '-'}
                  </dd>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide mb-2">PO Expected Month</dt>
                  <dd className="text-base font-bold text-[#546A7A] flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#4F6A64]" />
                    {offer.poExpectedMonth || '-'}
                  </dd>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide mb-2">PO Number</dt>
                  <dd className="text-base font-bold text-[#546A7A]">{offer.poNumber || '-'}</dd>
                </div>
              </div>

              {offer.poDate && (
                <div className="mt-4 bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide mb-2">PO Date</dt>
                  <dd className="text-base font-bold text-[#546A7A] flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#546A7A]" />
                    {new Date(offer.poDate).toLocaleDateString('en-IN')}
                  </dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product & Assets */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#976E44] to-red-600 text-white border-b-0">
              <CardTitle className="flex items-center gap-2 text-white">
                <Package className="h-6 w-6" />
                Product & Asset Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-5 shadow-md border border-[#EEC1BF]/20 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-[#CE9F6B]/20 rounded-lg">
                      <Package className="h-5 w-5 text-[#976E44]" />
                    </div>
                    <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Product Type</dt>
                  </div>
                  <dd>
                    <Badge className={`
                      text-sm px-3 py-1.5 font-bold
                      ${offer.productType === 'SPARE_PARTS' ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'KARDEX_CONNECT' ? 'bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'CONTRACT' ? 'bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'RELOCATION' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'UPGRADE_KIT' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'SOFTWARE' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'RETROFIT_KIT' ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'OTHERS' ? 'bg-gradient-to-r from-[#6F8A9D] to-cyan-600 text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'BD_SPARE' ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-0 shadow-lg' : ''}
                    `}>
                      {offer.productType?.replace(/_/g, ' ')}
                    </Badge>
                  </dd>
                </div>
                
                {offer.title && (
                  <div className="bg-white rounded-xl p-5 shadow-md border border-[#96AEC2]/20 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-[#6F8A9D]/20 rounded-lg">
                        <FileText className="h-5 w-5 text-[#546A7A]" />
                      </div>
                      <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Offer Title</dt>
                    </div>
                    <dd className="text-base font-bold text-[#546A7A]">{offer.title}</dd>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Linked Assets Section */}
          {offer.offerAssets && offer.offerAssets.length > 0 && (
            <Card className="shadow-xl overflow-hidden border-0">
              <CardHeader className="bg-gradient-to-r from-cyan-600 to-[#6F8A9D] text-white border-b-0">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Wrench className="h-6 w-6" />
                  Linked Assets
                  <Badge className="bg-white/20 text-white border-white/30 ml-2">
                    {offer.offerAssets.length} {offer.offerAssets.length === 1 ? 'Asset' : 'Assets'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {offer.offerAssets.map((oa: any, index: number) => {
                    const asset = oa.asset;
                    return (
                      <div 
                        key={oa.id || index} 
                        className="bg-white rounded-xl p-5 shadow-sm border border-[#E2E8F0] hover:shadow-md transition-all relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#6F8A9D]/10 to-transparent rounded-bl-full translate-x-4 -translate-y-4"></div>
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                            <Wrench className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-[#546A7A] text-lg">
                                {asset?.serialNo || 'Serial Not Available'}
                              </h4>
                              {asset?.status && (
                                <Badge 
                                  className={`text-[10px] px-2 py-0 h-4 ${
                                    asset.status === 'ACTIVE' 
                                      ? 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094]' 
                                      : 'bg-[#AEBFC3]/20 text-[#5D6E73] border-[#92A2A5]'
                                  }`}
                                >
                                  {asset.status}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              {asset?.model && (
                                <p className="text-sm font-medium text-[#5D6E73] flex items-center gap-2">
                                  <span className="text-[#AEBFC3]0">Model:</span> {asset.model}
                                </p>
                              )}
                              {asset?.location && (
                                <p className="text-sm text-[#5D6E73] flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-[#96AEC2]" />
                                  {asset.location}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spare Parts - Show for SPARE_PARTS or if parts exist */}
          {(offer.productType === 'SPARE_PARTS' || (offer.offerSpareParts && offer.offerSpareParts.length > 0)) && (
            <Card className={`shadow-lg ${offer.productType === 'SPARE_PARTS' ? 'ring-2 ring-amber-200' : ''}`}>
              <CardHeader className="bg-gradient-to-r from-[#EEC1BF]/10 via-yellow-50 to-[#EEC1BF]/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-[#976E44]" />
                      Spare Parts
                      {offer.offerSpareParts && offer.offerSpareParts.length > 0 && (
                        <Badge className="bg-[#976E44] text-white">
                          {offer.offerSpareParts.length} {offer.offerSpareParts.length === 1 ? 'Item' : 'Items'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {offer.productType === 'SPARE_PARTS' 
                        ? 'Spare parts configured for this SPARE PARTS offer' 
                        : 'Items included in this offer'}
                    </CardDescription>
                  </div>
                  {offer.productType === 'SPARE_PARTS' && (
                    <Badge variant="outline" className="bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]">
                      SPARE PARTS Product
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {(!offer.offerSpareParts || offer.offerSpareParts.length === 0) && offer.productType === 'SPARE_PARTS' ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#CE9F6B]/20 mb-4">
                      <Wrench className="h-8 w-8 text-[#976E44]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#546A7A] mb-2">No Spare Parts Added Yet</h3>
                    <p className="text-[#5D6E73] mb-6 max-w-md mx-auto">
                      This is a SPARE PARTS offer. Add spare parts to complete the offer details.
                    </p>
                    <Button 
                      onClick={() => router.push(`/zone-manager/offers/${offer.id}/edit`)}
                      className="bg-[#976E44] hover:bg-[#976E44]"
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Add Spare Parts
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {offer.offerSpareParts?.map((offerPart: any, index: number) => {
                        const part = offerPart.sparePart;
                        return (
                          <div 
                            key={offerPart.id || index} 
                            className="border border-[#92A2A5] rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                          >
                        {/* Image */}
                        <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                          {part?.imageUrl ? (
                            <img 
                              src={part.imageUrl} 
                              alt={part.name || 'Spare Part'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={part?.imageUrl ? 'hidden' : 'flex flex-col items-center justify-center text-[#979796]'}>
                            <ImageIcon className="h-12 w-12 mb-2" />
                            <span className="text-xs">No Image</span>
                          </div>
                        </div>

                        {/* Part Details */}
                        <div className="space-y-2">
                          {/* Part Name */}
                          <h4 className="font-semibold text-[#546A7A] text-base line-clamp-2">
                            {part?.name || 'Unnamed Part'}
                          </h4>

                          {/* Part Number */}
                          {part?.partNumber && (
                            <p className="text-xs text-[#AEBFC3]0">
                              Part #: {part.partNumber}
                            </p>
                          )}

                          {/* Category */}
                          {part?.category && (
                            <Badge variant="outline" className="text-xs">
                              {part.category}
                            </Badge>
                          )}

                          {/* Quantity */}
                          {offerPart.quantity && (
                            <p className="text-sm text-[#5D6E73]">
                              Qty: <span className="font-medium">{offerPart.quantity}</span>
                            </p>
                          )}

                          {/* Price */}
                          <div className="pt-2 border-t border-[#AEBFC3]/30">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-[#AEBFC3]0">Unit Price</span>
                              <div className="flex items-center gap-1">
                                <IndianRupee className="h-4 w-4 text-[#4F6A64]" />
                                <span className="text-lg font-bold text-[#4F6A64]">
                                  {offerPart.unitPrice ? 
                                    formatCurrency(Number(offerPart.unitPrice)) : 
                                    <span className="text-sm text-[#979796]">TBD</span>
                                  }
                                </span>
                              </div>
                            </div>
                            
                            {/* Total Price */}
                            {offerPart.totalPrice && (
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-[#AEBFC3]0">Total</span>
                                <span className="text-sm font-semibold text-[#546A7A]">
                                  {formatCurrency(Number(offerPart.totalPrice))}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notes if available */}
                          {offerPart.notes && (
                            <p className="text-xs text-[#5D6E73] line-clamp-2 pt-2">
                              {offerPart.notes}
                            </p>
                          )}

                          {/* Description if available */}
                          {part?.description && (
                            <p className="text-xs text-[#AEBFC3]0 line-clamp-2 pt-1">
                              {part.description}
                            </p>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>

                    {/* Total Summary */}
                    {offer.offerSpareParts && offer.offerSpareParts.some((op: any) => op.totalPrice) && (
                      <div className="mt-6 p-4 bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 rounded-lg border border-[#A2B9AF]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#5D6E73]">Total Parts Value</span>
                          <span className="text-xl font-bold text-[#4F6A64]">
                            {formatCurrency(
                              offer.offerSpareParts.reduce((sum: number, offerPart: any) => {
                                return sum + Number(offerPart.totalPrice || 0);
                              }, 0)
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stage-wise Remarks History - Timeline Design */}
          {offer.stageRemarks && offer.stageRemarks.length > 0 && (
            <Card className="shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 via-purple-50 to-[#EEC1BF]/10 border-b border-[#96AEC2]/20">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#546A7A]" />
                  Stage Activity Timeline
                </CardTitle>
                <CardDescription>
                  Complete history of remarks and notes across all stages
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-8">
                <div className="relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-purple-200 to-pink-200"></div>
                  
                  <div className="space-y-6">
                    {offer.stageRemarks.map((remark: any, index: number) => {
                      const stageInfo = STAGE_INFO[remark.stage] || {};
                      const stageName = ALL_STAGES.find(s => s.key === remark.stage)?.label || remark.stage;
                      
                      // Color mapping for stages
                      const colorClasses = {
                        blue: 'bg-[#96AEC2]/100 ring-[#96AEC2]/50',
                        indigo: 'bg-[#546A7A]/100 ring-indigo-200',
                        amber: 'bg-[#CE9F6B]/100 ring-amber-200',
                        purple: 'bg-[#6F8A9D]/100 ring-purple-200',
                        green: 'bg-[#A2B9AF]/100 ring-[#A2B9AF]/50',
                        teal: 'bg-[#82A094]/100 ring-teal-200',
                        red: 'bg-[#E17F70]/100 ring-[#E17F70]/50'
                      };
                      
                      const bgClasses = {
                        blue: 'from-[#96AEC2]/10 to-[#96AEC2]/20/50',
                        indigo: 'from-[#96AEC2]/10 to-[#96AEC2]/20/50',
                        amber: 'from-[#EEC1BF]/10 to-[#EEC1BF]/20/50',
                        purple: 'from-[#96AEC2]/10 to-[#96AEC2]/20/50',
                        green: 'from-[#A2B9AF]/10 to-[#A2B9AF]/20/50',
                        teal: 'from-[#A2B9AF]/10 to-[#A2B9AF]/20/50',
                        red: 'from-[#E17F70]/10 to-red-100/50'
                      };
                      
                      const textClasses = {
                        blue: 'text-[#546A7A]',
                        indigo: 'text-[#546A7A]',
                        amber: 'text-[#976E44]',
                        purple: 'text-[#546A7A]',
                        green: 'text-[#4F6A64]',
                        teal: 'text-[#4F6A64]',
                        red: 'text-[#75242D]'
                      };
                      
                      const color = stageInfo.color || 'blue';
                      
                      return (
                        <div key={remark.id} className="relative pl-16">
                          {/* Timeline dot */}
                          <div className={`absolute left-3.5 top-3 w-5 h-5 rounded-full ${colorClasses[color as keyof typeof colorClasses] || 'bg-[#AEBFC3]/100 ring-gray-200'} ring-4 shadow-md`}></div>
                          
                          {/* Content card */}
                          <div className={`bg-gradient-to-br ${bgClasses[color as keyof typeof bgClasses] || 'from-[#AEBFC3]/10 to-[#AEBFC3]/20/50'} rounded-lg p-4 shadow-sm border border-[#92A2A5] hover:shadow-md transition-shadow`}>
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{stageInfo.icon || '📝'}</span>
                                <div>
                                  <h4 className={`font-bold text-base ${textClasses[color as keyof typeof textClasses] || 'text-[#5D6E73]'}`}>
                                    {stageName}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-3 w-3 text-[#AEBFC3]0" />
                                    <p className="text-xs text-[#5D6E73] font-medium">
                                      {new Date(remark.createdAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {remark.createdBy?.name && (
                                <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-full border border-[#92A2A5]">
                                  <User className="h-3 w-3 text-[#AEBFC3]0" />
                                  <span className="text-xs font-medium text-[#5D6E73]">
                                    {remark.createdBy.name}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Remarks content */}
                            <div className="bg-white rounded-md p-4 shadow-sm border border-[#92A2A5]">
                              <p className="text-sm text-[#546A7A] leading-relaxed whitespace-pre-wrap">
                                {remark.remarks}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Legacy Remarks - Show if no stage remarks but has old remarks field */}
          {(!offer.stageRemarks || offer.stageRemarks.length === 0) && offer.remarks && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Remarks & Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#AEBFC3]/10 p-4 rounded-lg whitespace-pre-wrap text-sm">
                  {offer.remarks}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Summary & Actions */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-b-0">
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
              <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5] hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Priority</p>
                  <AlertCircle className="h-4 w-4 text-[#979796]" />
                </div>
                <Badge className={`
                  text-sm px-3 py-1.5 font-bold
                  ${offer.priority === 'CRITICAL' ? 'bg-gradient-to-r from-[#E17F70] to-red-600 text-white border-0 shadow-lg' : ''}
                  ${offer.priority === 'HIGH' ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-0 shadow-lg' : ''}
                  ${offer.priority === 'MEDIUM' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-0 shadow-lg' : ''}
                  ${offer.priority === 'LOW' ? 'bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-0 shadow-lg' : ''}
                `}>
                  {offer.priority}
                </Badge>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5] hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Lead Status</p>
                  <User className="h-4 w-4 text-[#979796]" />
                </div>
                <Badge className={`text-sm px-3 py-1.5 font-bold ${
                  offer.lead === 'YES' 
                    ? 'bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-0 shadow-lg' 
                    : 'bg-[#92A2A5]/30 text-[#5D6E73] border border-[#92A2A5]'
                }`}>
                  {offer.lead === 'YES' ? '✓ Yes' : 'No'}
                </Badge>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5] hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Open Funnel</p>
                  <Package className="h-4 w-4 text-[#979796]" />
                </div>
                <Badge className={`text-sm px-3 py-1.5 font-bold ${
                  offer.openFunnel 
                    ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-0 shadow-lg' 
                    : 'bg-[#92A2A5]/30 text-[#5D6E73] border border-[#92A2A5]'
                }`}>
                  {offer.openFunnel ? '✓ Active' : 'Closed'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-cyan-600 to-[#6F8A9D] text-white border-b-0">
              <CardTitle className="flex items-center gap-2 text-white">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
              <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-[#6F8A9D] hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-[#96AEC2]/20 rounded-full">
                    <Calendar className="h-3.5 w-3.5 text-[#546A7A]" />
                  </div>
                  <p className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Created</p>
                </div>
                <p className="text-base font-bold text-[#546A7A]">
                  {new Date(offer.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
                {offer.createdBy?.name && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <User className="h-3 w-3 text-[#979796]" />
                    <p className="text-xs text-[#5D6E73] font-medium">{offer.createdBy.name}</p>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-[#82A094] hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-[#A2B9AF]/20 rounded-full">
                    <Clock className="h-3.5 w-3.5 text-[#4F6A64]" />
                  </div>
                  <p className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Last Updated</p>
                </div>
                <p className="text-base font-bold text-[#546A7A]">
                  {new Date(offer.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
              {offer.offerReferenceDate && (
                <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-[#6F8A9D] hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-[#6F8A9D]/20 rounded-full">
                      <FileText className="h-3.5 w-3.5 text-[#546A7A]" />
                    </div>
                    <p className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Offer Reference</p>
                  </div>
                  <p className="text-base font-bold text-[#546A7A]">
                    {new Date(offer.offerReferenceDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
              )}
              {offer.registrationDate && (
                <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-[#CE9F6B]/20 rounded-full">
                      <Building2 className="h-3.5 w-3.5 text-[#976E44]" />
                    </div>
                    <p className="text-xs text-[#AEBFC3]0 font-semibold uppercase tracking-wide">Registration</p>
                  </div>
                  <p className="text-base font-bold text-[#546A7A]">
                    {new Date(offer.registrationDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#9E3B47] text-white border-b-0">
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
              <Button 
                className="w-full bg-gradient-to-r from-[#82A094] to-[#82A094] hover:from-[#82A094] hover:to-[#4F6A64] text-white border-0 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 font-semibold py-6" 
                onClick={() => {
                  const nextStageIndex = currentStageIndex + 1
                  if (nextStageIndex < STAGES.length) {
                    handleMoveToStage(STAGES[nextStageIndex].key)
                  }
                }}
                disabled={currentStageIndex >= STAGES.length - 1}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Move to Next Stage
              </Button>
              <Button 
                className="w-full bg-white hover:bg-[#AEBFC3]/10 text-[#546A7A] border-2 border-[#92A2A5] hover:border-[#6F8A9D] shadow-md hover:shadow-lg transition-all font-semibold py-5" 
                onClick={() => setShowUpdateDialog(true)}
              >
                <Edit className="h-4 w-4 mr-2 text-[#546A7A]" />
                Update Stage Details
              </Button>
              <Button 
                className="w-full bg-white hover:bg-[#AEBFC3]/10 text-[#546A7A] border-2 border-[#92A2A5] hover:border-[#6F8A9D] shadow-md hover:shadow-lg transition-all font-semibold py-5"
                onClick={() => router.push(`/zone-manager/offers/${params.id}/quote`)}
              >
                <FileText className="h-4 w-4 mr-2 text-[#546A7A]" />
                Generate Quote
              </Button>
              <Button 
                className="w-full bg-white hover:bg-[#AEBFC3]/10 text-[#546A7A] border-2 border-[#92A2A5] hover:border-[#6F8A9D] shadow-md hover:shadow-lg transition-all font-semibold py-5"
                onClick={() => router.push(`/zone-manager/offers/${params.id}/activity`)}
              >
                <Clock className="h-4 w-4 mr-2 text-[#546A7A]" />
                View Activity History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Offer Details</DialogTitle>
            <DialogDescription>
              Update offer information for {offer?.offerReferenceNumber}
            </DialogDescription>
          </DialogHeader>
          
          {/* Stage-specific context banner */}
          {updateData.stage && STAGE_INFO[updateData.stage] && (
            <div className={`
              p-4 rounded-lg border-l-4 mb-4
              ${STAGE_INFO[updateData.stage].color === 'blue' ? 'bg-[#96AEC2]/10 border-[#6F8A9D]' : ''}
              ${STAGE_INFO[updateData.stage].color === 'indigo' ? 'bg-[#546A7A]/10 border-[#6F8A9D]' : ''}
              ${STAGE_INFO[updateData.stage].color === 'amber' ? 'bg-[#CE9F6B]/10 border-[#CE9F6B]' : ''}
              ${STAGE_INFO[updateData.stage].color === 'purple' ? 'bg-[#6F8A9D]/10 border-[#6F8A9D]' : ''}
              ${STAGE_INFO[updateData.stage].color === 'green' ? 'bg-[#A2B9AF]/10 border-[#82A094]' : ''}
              ${STAGE_INFO[updateData.stage].color === 'teal' ? 'bg-[#82A094]/10 border-teal-500' : ''}
              ${STAGE_INFO[updateData.stage].color === 'red' ? 'bg-[#E17F70]/10 border-[#9E3B47]' : ''}
            `}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{STAGE_INFO[updateData.stage].icon}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-[#546A7A] mb-1">
                    {STAGES.find(s => s.key === updateData.stage)?.label} Stage
                  </h4>
                  <p className="text-sm text-[#5D6E73]">
                    {STAGE_INFO[updateData.stage].description}
                  </p>
                  {STAGE_INFO[updateData.stage].requiresAllFields && (
                    <p className="text-xs text-[#9E3B47] mt-2 font-medium">
                      ⚠️ All fields marked with * are required for this stage
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {/* Stage */}
            <div className="space-y-2">
              <Label className="text-[#9E3B47]">Stage *</Label>
              <Select 
                value={updateData.stage} 
                onValueChange={(value) => setUpdateData(prev => ({ ...prev, stage: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STAGES.map(stage => (
                    <SelectItem key={stage.key} value={stage.key}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Offer Title */}
            <div className="space-y-2">
              <Label className="text-[#9E3B47]">Offer Title *</Label>
              <Input 
                value={updateData.title}
                onChange={(e) => setUpdateData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter offer title"
              />
            </div>

            {/* Offer Reference Date */}
            <div className="space-y-2">
              <Label className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields ? 'text-[#9E3B47]' : ''}>
                Offer Reference Date {updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && '*'}
              </Label>
              <Input 
                type="date"
                value={updateData.offerReferenceDate}
                onChange={(e) => setUpdateData(prev => ({ ...prev, offerReferenceDate: e.target.value }))}
                className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && !updateData.offerReferenceDate ? 'border-[#E17F70]' : ''}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Offer Value */}
              <div className="space-y-2">
                <Label className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields ? 'text-[#9E3B47]' : ''}>
                  Offer Value (₹) {updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && '*'}
                </Label>
                <Input 
                  type="number"
                  value={updateData.offerValue}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, offerValue: e.target.value }))}
                  placeholder="Enter amount"
                  className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && !updateData.offerValue ? 'border-[#E17F70]' : ''}
                />
              </div>

              {/* Win Probability */}
              <div className="space-y-2">
                <Label className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields ? 'text-[#9E3B47]' : ''}>
                  Win Probability (%) {updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && '*'}
                </Label>
                <Select
                  value={updateData.probabilityPercentage}
                  onValueChange={(value) => setUpdateData(prev => ({ ...prev, probabilityPercentage: value }))}
                >
                  <SelectTrigger className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && !updateData.probabilityPercentage ? 'border-[#E17F70]' : ''}>
                    <SelectValue placeholder="Select probability" />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
                      <SelectItem key={value} value={value.toString()}>{value}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Offer Month */}
              <div className="space-y-2">
                <Label className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields ? 'text-[#9E3B47]' : ''}>
                  Offer Month {updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && '*'}
                </Label>
                <Input 
                  type="month"
                  value={updateData.offerMonth}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, offerMonth: e.target.value }))}
                  className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && !updateData.offerMonth ? 'border-[#E17F70]' : ''}
                />
              </div>

              {/* PO Expected Month */}
              <div className="space-y-2">
                <Label className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields ? 'text-[#9E3B47]' : ''}>
                  PO Expected Month {updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && '*'}
                </Label>
                <Input 
                  type="month"
                  value={updateData.poExpectedMonth}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, poExpectedMonth: e.target.value }))}
                  className={updateData.stage && STAGE_INFO[updateData.stage]?.requiresAllFields && !updateData.poExpectedMonth ? 'border-[#E17F70]' : ''}
                />
              </div>
            </div>
            
            {/* PO Details Section - For PO_RECEIVED and WON stages */}
            {(updateData.stage === 'PO_RECEIVED' || updateData.stage === 'WON') && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-[#4F6A64]" />
                  <h3 className="font-semibold text-[#546A7A]">Purchase Order Details</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* PO Number */}
                  <div className="space-y-2">
                    <Label className="text-[#9E3B47]">PO Number *</Label>
                    <Input 
                      value={updateData.poNumber}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, poNumber: e.target.value }))}
                      placeholder="Enter PO number"
                      className={!updateData.poNumber ? 'border-[#E17F70]' : ''}
                    />
                  </div>

                  {/* PO Date */}
                  <div className="space-y-2">
                    <Label className="text-[#9E3B47]">PO Date *</Label>
                    <Input 
                      type="date"
                      value={updateData.poDate}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, poDate: e.target.value }))}
                      className={!updateData.poDate ? 'border-[#E17F70]' : ''}
                    />
                  </div>
                </div>

                {/* PO Value */}
                <div className="space-y-2">
                  <Label className="text-[#9E3B47]">PO Value (₹) *</Label>
                  <Input 
                    type="number"
                    value={updateData.poValue}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, poValue: e.target.value }))}
                    placeholder="Enter PO value"
                    className={!updateData.poValue ? 'border-[#E17F70]' : ''}
                  />
                  <p className="text-xs text-[#AEBFC3]0">
                    Actual purchase order value received from customer
                  </p>
                </div>
              </div>
            )}
            

            
            {/* Loss Reason Section - For LOST stage */}
            {updateData.stage === 'LOST' && (
              <div className="space-y-3 pt-4 border-t-4 border-[#E17F70] bg-[#E17F70]/10 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-[#9E3B47] mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-[#75242D] font-semibold text-base">
                      ❌ Reason for Loss *
                    </Label>
                    <p className="text-xs text-[#9E3B47] mt-1">
                      This deal can be marked as LOST from any stage (Proposal Sent, Negotiation) if PO is not received
                    </p>
                  </div>
                </div>
                <Textarea
                  value={updateData.remarks}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Document why the deal was lost: competitor won, pricing issues, customer delayed, requirements changed, budget constraints, etc."
                  rows={5}
                  className="resize-none border-[#E17F70] focus:border-[#9E3B47]"
                />
                <p className="text-xs text-[#75242D] font-medium bg-[#E17F70]/20 p-2 rounded">
                  ⚠️ Important: Documenting loss reasons helps improve future proposals and understand customer objections
                </p>
              </div>
            )}
            
            {/* Remarks/Notes Section - Especially for Negotiation */}
            {(updateData.stage === 'NEGOTIATION' || updateData.stage === 'FINAL_APPROVAL' || updateData.stage === 'PROPOSAL_SENT') && (
              <div className="space-y-3 pt-4 border-t-2 border-[#96AEC2]/20">
                {/* Show previous stage remarks if any */}
                {offer.stageRemarks && offer.stageRemarks.filter((r: any) => r.stage === updateData.stage).length > 0 && (
                  <div className="mb-4 p-4 bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/10 border-2 border-[#546A7A] rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-[#546A7A]" />
                      <p className="text-sm font-bold text-[#546A7A]">Previous Activity for {ALL_STAGES.find(s => s.key === updateData.stage)?.label}</p>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {offer.stageRemarks
                        .filter((r: any) => r.stage === updateData.stage)
                        .slice(0, 5)
                        .map((r: any) => (
                          <div key={r.id} className="bg-white p-3 rounded-lg border border-[#96AEC2]/20 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-[#546A7A]" />
                                <p className="text-xs text-[#546A7A] font-semibold">
                                  {new Date(r.createdAt).toLocaleDateString('en-IN', { 
                                    day: 'numeric', 
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </p>
                              </div>
                              {r.createdBy?.name && (
                                <div className="flex items-center gap-1 bg-[#546A7A]/20 px-2 py-0.5 rounded-full">
                                  <User className="h-3 w-3 text-[#546A7A]" />
                                  <span className="text-xs font-medium text-[#546A7A]">{r.createdBy.name}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-[#5D6E73] leading-relaxed line-clamp-3">{r.remarks}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                <div className="bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/10 p-4 rounded-xl border-2 border-[#96AEC2]">
                  <Label className="text-[#546A7A] font-bold text-base flex items-center gap-2 mb-2">
                    {updateData.stage === 'NEGOTIATION' && (
                      <>
                        <span className="text-xl">💬</span>
                        Add New Negotiation Notes
                      </>
                    )}
                    {updateData.stage === 'FINAL_APPROVAL' && (
                      <>
                        <span className="text-xl">✅</span>
                        Add New Approval Notes & Conditions
                      </>
                    )}
                    {updateData.stage === 'PROPOSAL_SENT' && (
                      <>
                        <span className="text-xl">📋</span>
                        Add Proposal Notes
                      </>
                    )}
                  </Label>
                  <Textarea
                    value={updateData.remarks}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder={
                      updateData.stage === 'NEGOTIATION' 
                        ? 'Document discussion points, pricing negotiations, customer objections, competitor info, etc.'
                        : updateData.stage === 'FINAL_APPROVAL'
                        ? 'Document decision makers, approval timeline, final terms, conditions, commitments, etc.'
                        : 'Add any notes about this stage...'
                    }
                    rows={5}
                    className="resize-none bg-white border-[#96AEC2] focus:border-[#6F8A9D] focus:ring-[#96AEC2] shadow-sm"
                  />
                  <div className="flex items-start gap-2 mt-2 p-2 bg-[#96AEC2]/20 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-[#546A7A] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-[#546A7A] leading-relaxed">
                      {updateData.stage === 'NEGOTIATION' && 'Each update creates a new timeline entry. All previous negotiation notes are preserved in the activity history.'}
                      {updateData.stage === 'FINAL_APPROVAL' && 'Each update creates a new timeline entry. All previous approval notes are preserved in the activity history.'}
                      {updateData.stage === 'PROPOSAL_SENT' && 'Optional notes about the proposal. These will be saved in the activity timeline.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOffer} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Offer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
