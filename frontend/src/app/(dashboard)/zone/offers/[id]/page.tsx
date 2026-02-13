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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import dynamic from 'next/dynamic'

const OfferUpdateDialog = dynamic(() => import('@/components/offers/OfferUpdateDialog'), {
  ssr: false
})
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
          <Button onClick={() => router.push('/zone/offers')} className="mt-4">
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/zone/offers')}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#546A7A] truncate">{offer.offerReferenceNumber}</h1>
            <p className="text-[#5D6E73] mt-1 text-sm sm:text-base truncate">{offer.title || offer.customer?.companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button onClick={() => router.push(`/zone/offers/${offer.id}/edit`)} className="w-full sm:w-auto">
            <Edit className="h-4 w-4 mr-2" />
            Edit Offer
          </Button>
        </div>
      </div>

      {/* Stage Progress - Modern Design */}
      <Card className="shadow-xl overflow-hidden border-0">
        <CardHeader className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] text-white border-b-0 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-white mb-2">Offer Progress Journey</CardTitle>
              <CardDescription className="text-[#96AEC2] text-sm">
                Track your offer through each milestone - WON or LOST outcomes after Negotiation
              </CardDescription>
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30 self-start sm:self-auto">
              <p className="text-xs sm:text-sm font-semibold text-white">
                Stage {currentStageIndex + 1} of {STAGES.length}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 sm:pt-10 pb-6 sm:pb-10 bg-gradient-to-br from-[#AEBFC3]/10 to-white">
          {/* Check if current stage is LOST */}
          {offer.stage === 'LOST' ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12">
              <div className="relative">
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-red-100 to-red-200 border-4 border-[#9E3B47] flex items-center justify-center mb-4 sm:mb-6 shadow-2xl">
                  <AlertCircle className="h-10 w-10 sm:h-14 sm:w-14 text-[#9E3B47]" />
                </div>
                <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-8 h-8 sm:w-12 sm:h-12 bg-[#E17F70]/100 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-xl sm:text-2xl">❌</span>
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#9E3B47] mb-2 sm:mb-3 text-center">Deal Lost</h3>
              <p className="text-[#5D6E73] text-center max-w-sm sm:max-w-md mb-4 sm:mb-6 text-sm sm:text-lg">
                This offer did not convert into a sale
              </p>
              <Badge className="bg-gradient-to-r from-[#E17F70] to-red-600 text-white border-0 text-sm sm:text-base px-5 sm:px-6 py-2 sm:py-3 shadow-lg">
                Status: Lost
              </Badge>
            </div>
          ) : (
            <div className="relative px-2 sm:px-4">
              {/* Desktop Progress View (Horizontal) */}
              <div className="hidden md:block relative mb-16">
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
                
                {/* Stage Steps (Horizontal) */}
                <div className="relative flex justify-between" style={{ zIndex: 1 }}>
                  {STAGES.map((stage, index) => {
                    const isPast = index < currentStageIndex
                    const isCurrent = index === currentStageIndex
                    const isWon = stage.key === 'WON' && offer.stage === 'WON'
                    const Icon = stage.icon
                    const stageInfo = STAGE_INFO[stage.key] || {}
                    
                    const stageColors = {
                      blue: { bg: 'from-[#6F8A9D] to-[#6F8A9D]', border: 'border-[#6F8A9D]', ring: 'ring-[#96AEC2]/50', shadow: 'shadow-blue-500/50', text: 'text-[#546A7A]', badge: 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]' },
                      indigo: { bg: 'from-[#6F8A9D] to-[#6F8A9D]', border: 'border-[#6F8A9D]', ring: 'ring-indigo-200', shadow: 'shadow-indigo-500/50', text: 'text-[#546A7A]', badge: 'bg-[#546A7A]/20 text-[#546A7A] border-indigo-300' },
                      amber: { bg: 'from-[#CE9F6B] to-[#976E44]', border: 'border-[#CE9F6B]', ring: 'ring-amber-200', shadow: 'shadow-amber-500/50', text: 'text-[#976E44]', badge: 'bg-[#CE9F6B]/20 text-[#976E44] border-amber-300' },
                      purple: { bg: 'from-[#6F8A9D] to-[#6F8A9D]', border: 'border-[#6F8A9D]', ring: 'ring-purple-200', shadow: 'shadow-purple-500/50', text: 'text-[#546A7A]', badge: 'bg-[#6F8A9D]/20 text-[#546A7A] border-[#6F8A9D]' },
                      green: { bg: 'from-[#82A094] to-[#82A094]', border: 'border-[#82A094]', ring: 'ring-[#A2B9AF]/50', shadow: 'shadow-green-500/50', text: 'text-[#4F6A64]', badge: 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094]' },
                      teal: { bg: 'from-[#82A094] to-[#82A094]', border: 'border-teal-500', ring: 'ring-teal-200', shadow: 'shadow-teal-500/50', text: 'text-[#4F6A64]', badge: 'bg-[#82A094]/20 text-[#4F6A64] border-teal-300' },
                      red: { bg: 'from-[#E17F70] to-red-600', border: 'border-[#9E3B47]', ring: 'ring-[#E17F70]/50', shadow: 'shadow-red-500/50', text: 'text-[#75242D]', badge: 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]' }
                    }
                    
                    const color = stageColors[stageInfo.color as keyof typeof stageColors] || stageColors.blue
                    
                    return (
                      <div key={stage.key} className="flex flex-col items-center group" style={{ flex: 1 }}>
                        <div className="relative">
                          <div className={`
                              relative w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all duration-300 transform
                              ${(isPast || isCurrent) && !isWon ? `${color.border} bg-gradient-to-br ${color.bg} shadow-lg ${color.shadow}` : ''}
                              ${isCurrent && !isWon ? `ring-8 ${color.ring} shadow-2xl scale-110 animate-pulse` : ''}
                              ${isWon ? 'border-[#82A094] bg-gradient-to-br from-[#82A094] to-[#82A094] ring-8 ring-[#A2B9AF]/50 shadow-2xl shadow-green-500/50 scale-110' : ''}
                              ${!isPast && !isCurrent && !isWon ? 'border-[#92A2A5] bg-white shadow-md hover:scale-105' : ''}
                              group-hover:scale-110
                            `}>
                            <Icon className={`h-7 w-7 transition-all ${(isPast || isCurrent || isWon) ? 'text-white' : 'text-[#979796]'}`} />
                          </div>
                          {isPast && !isCurrent && !isWon && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#A2B9AF]/100 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                              <CheckCircle className="h-4 w-4 text-white" />
                            </div>
                          )}
                          {isWon && (
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#CE9F6B] rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
                              <span className="text-lg">🎉</span>
                            </div>
                          )}
                        </div>
                        <p className={`mt-4 text-sm font-bold text-center max-w-[100px] transition-all
                          ${isCurrent && !isWon ? `${color.text} scale-105` : ''}
                          ${isWon ? 'text-[#4F6A64] scale-105' : ''}
                          ${!isPast && !isCurrent && !isWon ? 'text-[#AEBFC3]' : color.text}
                        `}>
                          {stage.label}
                        </p>
                        {isCurrent && !isWon && (
                          <Badge className={`mt-2 bg-gradient-to-r ${color.bg} text-white border-0 shadow-lg px-3 py-1 animate-pulse`}>
                            ⚡ Current
                          </Badge>
                        )}
                        {isWon && (
                          <Badge className="mt-2 bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-0 shadow-lg px-3 py-1">
                            ✨ Success!
                          </Badge>
                        )}
                        {isPast && !isCurrent && !isWon && (
                          <Badge className={`mt-2 ${color.badge} border px-2 py-0.5 text-xs`}>
                             ✓ Done
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mobile Progress View (Vertical) */}
              <div className="md:hidden relative space-y-8 pl-0 py-2">
                {/* Vertical Progress Line Background */}
                <div className="absolute left-6 top-4 bottom-4 w-1 bg-[#AEBFC3]/30 rounded-full" style={{ zIndex: 0 }}></div>
                
                {/* Vertical Progress Line Active */}
                <div 
                  className={`absolute left-6 top-4 w-1 transition-all duration-700 ease-out rounded-full ${
                    offer.stage === 'WON' 
                      ? 'bg-gradient-to-b from-green-400 to-[#82A094]' 
                      : 'bg-gradient-to-b from-[#96AEC2] to-[#6F8A9D]'
                  }`}
                  style={{ 
                    height: `${(currentStageIndex / (STAGES.length - 1)) * 100}%`,
                    zIndex: 0 
                  }}
                ></div>

                {STAGES.map((stage, index) => {
                  const isPast = index < currentStageIndex
                  const isCurrent = index === currentStageIndex
                  const isWon = stage.key === 'WON' && offer.stage === 'WON'
                  const Icon = stage.icon
                  const stageInfo = STAGE_INFO[stage.key] || {}
                  
                  const stageColors = {
                    blue: { bg: 'from-[#6F8A9D] to-[#6F8A9D]', border: 'border-[#6F8A9D]', ring: 'ring-[#96AEC2]/50', shadow: 'shadow-blue-500/50', text: 'text-[#546A7A]', badge: 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]' },
                    indigo: { bg: 'from-[#6F8A9D] to-[#6F8A9D]', border: 'border-[#6F8A9D]', ring: 'ring-indigo-200', shadow: 'shadow-indigo-500/50', text: 'text-[#546A7A]', badge: 'bg-[#546A7A]/20 text-[#546A7A] border-indigo-300' },
                    amber: { bg: 'from-[#CE9F6B] to-[#976E44]', border: 'border-[#CE9F6B]', ring: 'ring-amber-200', shadow: 'shadow-amber-500/50', text: 'text-[#976E44]', badge: 'bg-[#CE9F6B]/20 text-[#976E44] border-amber-300' },
                    purple: { bg: 'from-[#6F8A9D] to-[#6F8A9D]', border: 'border-[#6F8A9D]', ring: 'ring-purple-200', shadow: 'shadow-purple-500/50', text: 'text-[#546A7A]', badge: 'bg-[#6F8A9D]/20 text-[#546A7A] border-[#6F8A9D]' },
                    green: { bg: 'from-[#82A094] to-[#82A094]', border: 'border-[#82A094]', ring: 'ring-[#A2B9AF]/50', shadow: 'shadow-green-500/50', text: 'text-[#4F6A64]', badge: 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094]' },
                    teal: { bg: 'from-[#82A094] to-[#82A094]', border: 'border-teal-500', ring: 'ring-teal-200', shadow: 'shadow-teal-500/50', text: 'text-[#4F6A64]', badge: 'bg-[#82A094]/20 text-[#4F6A64] border-teal-300' },
                    red: { bg: 'from-[#E17F70] to-red-600', border: 'border-[#9E3B47]', ring: 'ring-[#E17F70]/50', shadow: 'shadow-red-500/50', text: 'text-[#75242D]', badge: 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]' }
                  }
                  
                  const color = stageColors[stageInfo.color as keyof typeof stageColors] || stageColors.blue

                  return (
                    <div key={stage.key} className="flex items-center gap-4 group relative" style={{ zIndex: 1 }}>
                      <div className="relative shrink-0">
                        <div className={`
                            relative w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all
                            ${(isPast || isCurrent) && !isWon ? `${color.border} bg-gradient-to-br ${color.bg} shadow-lg` : ''}
                            ${isCurrent && !isWon ? `ring-4 ${color.ring}` : ''}
                            ${isWon ? 'border-[#82A094] bg-gradient-to-br from-[#82A094] to-[#82A094] ring-4 ring-[#A2B9AF]/50' : ''}
                            ${!isPast && !isCurrent && !isWon ? 'border-[#92A2A5] bg-white' : ''}
                          `}>
                          <Icon className={`h-5 w-5 ${(isPast || isCurrent || isWon) ? 'text-white' : 'text-[#979796]'}`} />
                        </div>
                        {isPast && !isCurrent && !isWon && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#A2B9AF] rounded-full flex items-center justify-center border-2 border-white">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {isWon && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#CE9F6B] rounded-full flex items-center justify-center border-2 border-white">
                            <span className="text-xs">🎉</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-sm font-bold ${isCurrent && !isWon ? color.text : (!isPast && !isCurrent ? 'text-[#AEBFC3]' : color.text)}`}>
                            {stage.label}
                          </h4>
                          {isCurrent && !isWon && (
                            <Badge className={`bg-gradient-to-r ${color.bg} text-white border-0 text-[10px] px-2 py-0 animate-pulse`}>
                              ⚡ Current
                            </Badge>
                          )}
                          {isWon && (
                            <Badge className="bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-0 text-[10px] px-2 py-0">
                              ✨ Success!
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-[#5D6E73] mt-0.5">{stageInfo.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Alternative outcome indicator */}
              {currentStageIndex >= 3 && offer.stage !== 'WON' && offer.stage !== 'LOST' && (
                <div className="mt-8 sm:mt-10 pt-6 border-t-2 border-dashed border-[#92A2A5]">
                  <div className="flex flex-col sm:flex-row items-center sm:justify-center gap-3 p-4 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-xl border-2 border-[#CE9F6B]/40">
                    <AlertCircle className="h-5 w-5 text-[#976E44] flex-shrink-0" />
                    <p className="text-sm text-[#5D6E73] font-medium text-center sm:text-left">
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
            <CardHeader className="bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-b-0 py-4 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                Customer & Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#A2B9AF]/20 hover:shadow-md transition-all">
                  <h4 className="font-bold text-[#4F6A64] mb-4 flex items-center gap-2 text-base sm:text-lg">
                    <div className="p-2 bg-[#82A094]/10 rounded-lg">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#4F6A64]" />
                    </div>
                    Company Details
                  </h4>
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#82A094] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Company Name</dt>
                        <dd className="text-sm sm:text-base font-bold text-[#546A7A] mt-0.5 break-words">{offer.customer?.companyName || offer.company}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#82A094] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Location</dt>
                        <dd className="text-sm sm:text-base font-medium text-[#5D6E73] mt-0.5 flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-[#4F6A64] shrink-0" />
                          <span className="truncate">{offer.location || offer.customer?.city}</span>
                        </dd>
                      </div>
                    </div>
                    {offer.department && (
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-[#82A094] rounded-full mt-2 shrink-0"></div>
                        <div className="min-w-0 flex-1">
                          <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Department</dt>
                          <dd className="text-sm sm:text-base font-medium text-[#5D6E73] mt-0.5">{offer.department}</dd>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#82A094] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Zone</dt>
                        <dd className="text-sm sm:text-base font-medium text-[#5D6E73] mt-1">
                          <Badge className="bg-[#82A094]/10 text-[#4F6A64] border-[#82A094]/30 border text-[10px] sm:text-xs">
                            {offer.zone?.name}
                          </Badge>
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#96AEC2]/20 hover:shadow-md transition-all">
                  <h4 className="font-bold text-[#546A7A] mb-4 flex items-center gap-2 text-base sm:text-lg">
                    <div className="p-2 bg-[#96AEC2]/10 rounded-lg">
                      <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#546A7A]" />
                    </div>
                    Contact Person
                  </h4>
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#96AEC2] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Name</dt>
                        <dd className="text-sm sm:text-base font-bold text-[#546A7A] mt-0.5 break-words">{offer.contactPersonName || offer.contact?.contactPersonName}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#96AEC2] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Phone</dt>
                        <dd className="text-sm sm:text-base font-medium text-[#5D6E73] mt-0.5 flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-[#546A7A] shrink-0" />
                          <span className="truncate">{offer.contactNumber || offer.contact?.contactNumber}</span>
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-[#96AEC2] rounded-full mt-2 shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Email</dt>
                        <dd className="text-sm sm:text-base font-medium text-[#5D6E73] mt-0.5 flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-[#546A7A] shrink-0" />
                          <span className="truncate break-all">{offer.email || offer.contact?.email}</span>
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
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#9E3B47] text-white border-b-0 py-4 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/10 to-white p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-[#96AEC2]" />
                      <p className="text-xs sm:text-sm text-[#96AEC2] font-semibold">Offer Value</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white truncate">
                      {offer.offerValue ? formatCurrency(Number(offer.offerValue)) : 'TBD'}
                    </p>
                  </div>
                </div>
                <div className="relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-[#82A094] to-[#82A094] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-[#A2B9AF]" />
                      <p className="text-xs sm:text-sm text-[#A2B9AF] font-semibold">PO Value</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white truncate">
                      {offer.poValue ? formatCurrency(Number(offer.poValue)) : '-'}
                    </p>
                  </div>
                </div>
                <div className="relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-[#6F8A9D] to-[#9E3B47] rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-[#6F8A9D]" />
                      <p className="text-xs sm:text-sm text-[#6F8A9D] font-semibold">Win Probability</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white">
                      {offer.probabilityPercentage ? `${offer.probabilityPercentage}%` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider mb-2">Offer Month</dt>
                  <dd className="text-sm sm:text-base font-bold text-[#546A7A] flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#546A7A]" />
                    {offer.offerMonth || '-'}
                  </dd>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider mb-2">PO Expected Month</dt>
                  <dd className="text-sm sm:text-base font-bold text-[#546A7A] flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#4F6A64]" />
                    {offer.poExpectedMonth || '-'}
                  </dd>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider mb-2">PO Number</dt>
                  <dd className="text-sm sm:text-base font-bold text-[#546A7A]">{offer.poNumber || '-'}</dd>
                </div>
              </div>

              {offer.poDate && (
                <div className="mt-4 bg-white rounded-lg p-4 shadow-md border border-[#92A2A5]">
                  <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider mb-2">PO Date</dt>
                  <dd className="text-sm sm:text-base font-bold text-[#546A7A] flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#546A7A]" />
                    {new Date(offer.poDate).toLocaleDateString('en-IN')}
                  </dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product & Assets */}
          <Card className="shadow-xl overflow-hidden border-0">
            <CardHeader className="bg-gradient-to-r from-[#976E44] to-[#976E44] text-white border-b-0 py-4 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                Product & Asset Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#CE9F6B]/20 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-[#CE9F6B]/10 rounded-lg">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-[#976E44]" />
                    </div>
                    <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Product Type</dt>
                  </div>
                  <dd>
                    <Badge className={`
                      text-xs sm:text-sm px-3 py-1.5 font-bold shadow-sm
                      ${offer.productType === 'SPARE_PARTS' ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-0' : ''}
                      ${offer.productType === 'KARDEX_CONNECT' ? 'bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg' : ''}
                      ${offer.productType === 'CONTRACT' ? 'bg-gradient-to-r from-[#82A094] to-[#82A094] text-white border-0' : ''}
                      ${offer.productType === 'RELOCATION' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-0' : ''}
                      ${offer.productType === 'UPGRADE_KIT' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-0' : ''}
                      ${offer.productType === 'SOFTWARE' ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] text-white border-0' : ''}
                      ${offer.productType === 'RETROFIT_KIT' ? 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white border-0' : ''}
                      ${offer.productType === 'OTHERS' ? 'bg-gradient-to-r from-[#6F8A9D] to-cyan-600 text-white border-0' : ''}
                      ${offer.productType === 'BD_SPARE' ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-0' : ''}
                    `}>
                      {offer.productType?.replace(/_/g, ' ')}
                    </Badge>
                  </dd>
                </div>
                {offer.title && (
                  <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#96AEC2]/20 hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-[#6F8A9D]/10 rounded-lg">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-[#546A7A]" />
                      </div>
                      <dt className="text-[10px] sm:text-xs text-[#AEBFC3] font-semibold uppercase tracking-wider">Offer Title</dt>
                    </div>
                    <dd className="text-sm sm:text-base font-bold text-[#546A7A] line-clamp-2">{offer.title}</dd>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Linked Assets Section */}
          {offer.offerAssets && offer.offerAssets.length > 0 && (
            <Card className="shadow-xl overflow-hidden border-0">
              <CardHeader className="bg-gradient-to-r from-cyan-600 to-[#6F8A9D] text-white border-b-0 py-4 sm:py-6">
                <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                  <Wrench className="h-5 w-5 sm:h-6 sm:w-6" />
                  Linked Assets
                  <Badge className="bg-white/20 text-white border-white/30 ml-2 text-[10px] sm:text-xs">
                    {offer.offerAssets.length} {offer.offerAssets.length === 1 ? 'Asset' : 'Assets'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {offer.offerAssets.map((oa: any, index: number) => {
                    const asset = oa.asset;
                    return (
                      <div 
                        key={oa.id || index} 
                        className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#E2E8F0] hover:shadow-md transition-all relative overflow-hidden group border-l-4 border-l-cyan-600"
                      >
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-cyan-600/5 to-transparent rounded-bl-full translate-x-4 -translate-y-4"></div>
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-cyan-600 to-[#6F8A9D] rounded-xl flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                            <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <h4 className="font-bold text-[#546A7A] text-base sm:text-lg truncate">
                                {asset?.serialNo || 'Serial Not Available'}
                              </h4>
                              {asset?.status && (
                                <Badge 
                                  className={`text-[9px] sm:text-[10px] px-2 py-0 h-4 sm:h-5 shrink-0 ${
                                    asset.status === 'ACTIVE' 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                                  }`}
                                  variant="outline"
                                >
                                  {asset.status}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1.5 mt-2">
                              {asset?.model && (
                                <p className="text-xs sm:text-sm font-medium text-[#5D6E73] flex items-center gap-2">
                                  <span className="text-gray-400 font-bold text-[10px] uppercase">Model:</span> 
                                  <span className="truncate">{asset.model}</span>
                                </p>
                              )}
                              {asset?.location && (
                                <p className="text-xs sm:text-sm text-[#5D6E73] flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                                  <span className="truncate">{asset.location}</span>
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
            <Card className={`shadow-xl overflow-hidden border-0 ${offer.productType === 'SPARE_PARTS' ? 'ring-2 ring-[#CE9F6B]/50' : ''}`}>
              <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-b-0 py-4 sm:py-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                      <Wrench className="h-5 w-5 sm:h-6 sm:w-6" />
                      Spare Parts
                      {offer.offerSpareParts && offer.offerSpareParts.length > 0 && (
                        <Badge className="bg-white/20 text-white border-white/30 text-[10px] sm:text-xs">
                          {offer.offerSpareParts.length} {offer.offerSpareParts.length === 1 ? 'Item' : 'Items'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-white/70 text-xs sm:text-sm mt-1">
                      {offer.productType === 'SPARE_PARTS' 
                        ? 'Spare parts configured for this SPARE PARTS offer' 
                        : 'Items included in this offer'}
                    </CardDescription>
                  </div>
                  {offer.productType === 'SPARE_PARTS' && (
                    <Badge className="bg-white text-[#976E44] border-0 self-start sm:self-center font-bold text-[10px] sm:text-xs px-3 py-1">
                      SPARE PARTS Product
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 pb-6 sm:pb-8 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
                {(!offer.offerSpareParts || offer.offerSpareParts.length === 0) && offer.productType === 'SPARE_PARTS' ? (
                  <div className="text-center py-10 sm:py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#CE9F6B]/10 mb-4 sm:mb-6">
                      <Wrench className="h-8 w-8 sm:h-10 sm:w-10 text-[#976E44]" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-[#546A7A] mb-2">No Spare Parts Added Yet</h3>
                    <p className="text-[#5D6E73] mb-8 max-sm mx-auto text-sm">
                      This is a SPARE PARTS offer. Please add spare parts to complete the offer details.
                    </p>
                    <Button 
                      onClick={() => router.push(`/zone/offers/${offer.id}/edit`)}
                      className="bg-[#976E44] hover:bg-[#754E29] text-white shadow-lg px-6"
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Add Spare Parts
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {offer.offerSpareParts?.map((offerPart: any, index: number) => {
                        const part = offerPart.sparePart;
                        return (
                          <div 
                            key={offerPart.id || index} 
                            className="bg-white rounded-xl overflow-hidden border border-[#AEBFC3]/30 hover:shadow-xl transition-all group flex flex-col h-full"
                          >
                            {/* Image Container */}
                            <div className="relative w-full aspect-video bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                              {part?.imageUrl ? (
                                <img 
                                  src={part.imageUrl} 
                                  alt={part.name || 'Spare Part'}
                                  className="w-full h-full object-contain p-2 transition-transform group-hover:scale-110"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={part?.imageUrl ? 'hidden' : 'flex flex-col items-center justify-center text-gray-300'}>
                                <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 mb-2" />
                                <span className="text-[10px] sm:text-xs font-medium">No Image Available</span>
                              </div>
                              {/* Quantity Badge Over Image */}
                              <div className="absolute top-2 right-2 bg-[#546A7A] text-white px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold shadow-md">
                                Qty: {offerPart.quantity}
                              </div>
                            </div>

                            {/* Part Content */}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                              <div className="space-y-2">
                                <h4 className="font-bold text-[#546A7A] text-sm sm:text-base line-clamp-2 leading-snug h-10 sm:h-12">
                                  {part?.name || 'Unnamed Part'}
                                </h4>

                                <div className="flex flex-wrap items-center gap-2">
                                  {part?.partNumber && (
                                    <Badge variant="outline" className="text-[10px] bg-gray-50 text-[#546A7A] border-gray-200">
                                      #{part.partNumber}
                                    </Badge>
                                  )}
                                  {part?.category && (
                                    <Badge variant="secondary" className="text-[10px] bg-[#96AEC2]/10 text-[#546A7A] border-0">
                                      {part.category}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-end justify-between">
                                  <div>
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Total Value</p>
                                    <div className="flex items-center gap-1 font-bold text-[#4F6A64]">
                                      <IndianRupee className="h-4 w-4 shrink-0" />
                                      <span className="text-base sm:text-xl truncate max-w-[120px]">
                                        {offerPart.totalPrice ? 
                                          formatCurrency(Number(offerPart.totalPrice)) : 
                                          <span className="text-gray-300">TBD</span>
                                        }
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] text-gray-400 font-medium">Unit: {offerPart.unitPrice ? formatCurrency(Number(offerPart.unitPrice)) : 'TBD'}</p>
                                  </div>
                                </div>

                                {offerPart.notes && (
                                  <div className="mt-3 flex items-start gap-1.5 p-2 bg-amber-50 rounded-md border border-amber-100">
                                    <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-700 line-clamp-2 leading-tight">
                                      {offerPart.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total Summary */}
                    {offer.offerSpareParts && offer.offerSpareParts.some((op: any) => op.totalPrice) && (
                      <div className="mt-8 p-5 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-xl shadow-lg border-0 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
                        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                              <DollarSign className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Total Combined Parts Value</p>
                              <h3 className="text-white text-xl sm:text-2xl font-black mt-0.5">Summary</h3>
                            </div>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 text-center sm:text-right w-full sm:w-auto">
                            <p className="text-white/60 text-[10px] font-bold uppercase mb-1">Grand Total</p>
                            <div className="flex items-center justify-center sm:justify-end gap-2 text-white">
                              <IndianRupee className="h-6 w-6" />
                              <span className="text-2xl sm:text-3xl font-black tracking-tight">
                                {formatCurrency(
                                  offer.offerSpareParts.reduce((sum: number, offerPart: any) => {
                                    return sum + Number(offerPart.totalPrice || 0);
                                  }, 0)
                                )}
                              </span>
                            </div>
                          </div>
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
            <Card className="shadow-xl overflow-hidden border-0">
              <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-b-0 py-4 sm:py-6">
                <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                  Stage Activity Timeline
                </CardTitle>
                <CardDescription className="text-white/70 text-xs sm:text-sm">
                  Complete history of remarks and notes across all stages
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-8 bg-gradient-to-br from-[#AEBFC3]/5 to-white p-4 sm:p-6">
                <div className="relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#6F8A9D]/30 via-[#82A094]/30 to-[#9E3B47]/30"></div>
                  
                  <div className="space-y-8">
                    {offer.stageRemarks.map((remark: any, index: number) => {
                      const stageInfo = STAGE_INFO[remark.stage] || {};
                      const stageName = ALL_STAGES.find(s => s.key === remark.stage)?.label || remark.stage;
                      
                      const colorClasses = {
                        blue: 'bg-[#6F8A9D] ring-[#6F8A9D]/30',
                        indigo: 'bg-[#546A7A] ring-[#546A7A]/30',
                        amber: 'bg-[#CE9F6B] ring-[#CE9F6B]/30',
                        purple: 'bg-[#6F8A9D] ring-[#6F8A9D]/30',
                        green: 'bg-[#82A094] ring-[#82A094]/30',
                        teal: 'bg-[#82A094] ring-[#82A094]/30',
                        red: 'bg-[#E17F70] ring-[#E17F70]/30'
                      };
                      
                      const bgClasses = {
                        blue: 'from-[#6F8A9D]/5 to-white',
                        indigo: 'from-[#546A7A]/5 to-white',
                        amber: 'from-[#CE9F6B]/5 to-white',
                        purple: 'from-[#6F8A9D]/5 to-white',
                        green: 'from-[#82A094]/5 to-white',
                        teal: 'from-[#82A094]/5 to-white',
                        red: 'from-[#E17F70]/5 to-white'
                      };
                      
                      const textClasses = {
                        blue: 'text-[#6F8A9D]',
                        indigo: 'text-[#546A7A]',
                        amber: 'text-[#976E44]',
                        purple: 'text-[#6F8A9D]',
                        green: 'text-[#4F6A64]',
                        teal: 'text-[#4F6A64]',
                        red: 'text-[#9E3B47]'
                      };
                      
                      const color = stageInfo.color || 'blue';
                      
                      return (
                        <div key={remark.id} className="relative pl-12 sm:pl-16 group">
                          {/* Timeline dot */}
                          <div className={`absolute left-[1.375rem] top-4 w-4 h-4 rounded-full ${colorClasses[color as keyof typeof colorClasses] || 'bg-[#AEBFC3] ring-gray-200'} ring-4 shadow-sm z-10 transition-transform group-hover:scale-125`}></div>
                          
                          {/* Content card */}
                          <div className={`bg-white rounded-xl p-4 shadow-sm border border-[#AEBFC3]/30 hover:shadow-md transition-all relative overflow-hidden`}>
                            <div className={`absolute top-0 left-0 w-1 h-full ${colorClasses[color as keyof typeof colorClasses]?.split(' ')[0]}`}></div>
                            
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-gradient-to-br ${bgClasses[color as keyof typeof bgClasses]}`}>
                                  <span className="text-xl">{stageInfo.icon || '📝'}</span>
                                </div>
                                <div>
                                  <h4 className={`font-bold text-sm sm:text-base ${textClasses[color as keyof typeof textClasses] || 'text-[#5D6E73]'}`}>
                                    {stageName}
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Calendar className="h-3 w-3 text-[#AEBFC3]" />
                                    <p className="text-[10px] sm:text-xs text-[#5D6E73] font-medium">
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
                                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 self-start sm:self-center">
                                  <User className="h-3 w-3 text-[#AEBFC3]" />
                                  <span className="text-[10px] sm:text-xs font-semibold text-[#546A7A]">
                                    {remark.createdBy.name}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Remarks content */}
                            <div className="bg-gray-50/50 rounded-lg p-3 sm:p-4 border border-gray-100">
                              <p className="text-xs sm:text-sm text-[#546A7A] leading-relaxed whitespace-pre-wrap">
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
                onClick={() => router.push(`/zone/offers/${params.id}/quote`)}
              >
                <FileText className="h-4 w-4 mr-2 text-[#546A7A]" />
                Generate Quote
              </Button>
              <Button 
                className="w-full bg-white hover:bg-[#AEBFC3]/10 text-[#546A7A] border-2 border-[#92A2A5] hover:border-[#6F8A9D] shadow-md hover:shadow-lg transition-all font-semibold py-5"
                onClick={() => router.push(`/zone/offers/${params.id}/activity`)}
              >
                <Clock className="h-4 w-4 mr-2 text-[#546A7A]" />
                View Activity History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <OfferUpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        offer={offer}
        updateData={updateData}
        setUpdateData={setUpdateData}
        onUpdate={handleUpdateOffer}
        updating={updating}
        allStages={ALL_STAGES}
        stageInfo={STAGE_INFO}
      />
    </div>
  )
}
