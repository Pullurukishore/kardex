'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  ArrowLeft,
  Download,
  Printer,
  Loader2,
  Pencil as Edit,
  Save,
  Upload,
  X,
  FileText
} from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import { format } from 'date-fns'

// ==================== Constants ====================
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  RELOCATION: 'Relocation',
  CONTRACT: 'Contract',
  SPARE_PARTS: 'Spare Parts',
  KARDEX_CONNECT: 'Kardex Connect',
  UPGRADE_KIT: 'Optilife Upgrade',
  SOFTWARE: 'Software',
  OTHERS: 'Repairs & Others',
  BD_SPARE: 'BD Spare',
  RETROFIT_KIT: 'Retrofit Kit'
}

// ==================== Types ====================
interface Customer {
  companyName?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  contacts?: Array<{
    contactPersonName: string
    role: string
  }>
}

interface OfferItem {
  id: number
  partNo: string
  description: string
  hsnCode: string
  unitPrice: string
  quantity: number
  total?: string
}

interface OfferSparePart {
  id: number
  quantity: number
  unitPrice: string
  totalPrice: string
  notes?: string
  sparePart: {
    id: number
    name: string
    partNumber: string
    description?: string
    category?: string
  }
}

interface OfferAsset {
  id: number
  asset: {
    id: number
    assetName: string
    machineSerialNumber?: string
    model?: string
    manufacturer?: string
    location?: string
    customer?: {
      companyName: string
    }
  }
}

interface MachineDetails {
  model: string
  serialNumber: string
  owner: string
  department: string
}

interface Offer {
  offerReferenceNumber: string
  title?: string
  description?: string
  subject?: string
  introduction?: string
  offerValue?: string
  remarks?: string
  contactPersonName?: string
  contactPersonPhone?: string
  contactPersonEmail?: string
  contactNumber?: string
  email?: string
  company?: string
  productType?: string
  machineSerialNumber?: string
  location?: string
  department?: string
  customer?: Customer
  contact?: {
    contactPersonName: string
    contactNumber?: string
    email?: string
  }
  items?: OfferItem[]
  machineDetails?: MachineDetails
  offerSpareParts?: OfferSparePart[]
  offerAssets?: OfferAsset[]
}

interface EditableData {
  companyName: string
  companyAddress: string
  companyCity: string
  companyPhone: string
  companyFax: string
  companyEmail: string
  companyWebsite: string
  gstNumber: string
  arnNumber: string
  title: string
  description: string
  subject: string
  introduction: string
  offerValue: string
  gstRate: number
  remarks: string
  contactPersonName: string
  contactPersonPhone: string
  contactPersonEmail: string
  signatureImage: string | null
  items: OfferItem[]
  machineDetails: MachineDetails
  // Customer details for the quote
  customerName: string
  customerAddress: string
  customerCity: string
  customerState: string
}

// ==================== Constants ====================
const DEFAULT_COMPANY_INFO = {
  companyName: 'Kardex India Pvt Ltd',
  companyAddress: 'Brigade Rubix, 602, 6th Floor, HMT Watch Factory Road',
  companyCity: 'Bengaluru, Karnataka – 560 022 (INDIA)',
  companyPhone: '+91 80 29724450',
  companyFax: '+91 80 29724460',
  companyEmail: 'info@kardex.com',
  companyWebsite: 'www.kardex.com',
  gstNumber: '29AADCK5377L1ZW',
  arnNumber: 'AA2903170325554',
} as const

const QUOTE_VALIDITY_DAYS = 30
const DEFAULT_GST_RATE = 18
const DEFAULT_ITEM: OfferItem = {
  id: 1,
  partNo: '',
  description: '',
  hsnCode: '',
  unitPrice: '',
  quantity: 1,
  total: ''
}

const DEFAULT_MACHINE_DETAILS: MachineDetails = {
  model: '',
  serialNumber: '',
  owner: '',
  department: ''
}

// ==================== Helper Functions ====================
const calculateItemTotal = (unitPrice: string, quantity: number): number => {
  const cleanPrice = typeof unitPrice === 'string' ? unitPrice.replace(/,/g, '') : unitPrice
  const price = parseFloat(cleanPrice as string) || 0
  return price * quantity
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

const getValidUntilDate = (): Date => {
  const date = new Date()
  date.setDate(date.getDate() + QUOTE_VALIDITY_DAYS)
  return date
}

// ==================== Sub-Components ====================
interface LogoProps {
  className?: string
}

const KardexLogo = ({ className = 'h-7' }: LogoProps) => (
  <div className="flex justify-between items-start mb-4 border-b pb-2">
    <img 
      src="/kardex.png" 
      alt="Kardex Remstar" 
      className={className}
      onError={(e) => { 
        e.currentTarget.style.display = 'none'
        console.error('Logo not found')
      }}
    />
  </div>
)

interface PageFooterProps {
  pageNumber: number
  totalPages?: number
  productType?: string
}

const PageFooter = ({ pageNumber, totalPages = 11, productType }: PageFooterProps) => (
  <div className="page-footer">
    <div className="footer-content">
      <span>{pageNumber} / {totalPages}</span>
      <span>{productType ? (PRODUCT_TYPE_LABELS[productType] || productType.replace(/_/g, ' ')) : 'Service Care Contract'}</span>
      <span>{format(new Date(), 'dd/MM/yyyy')}</span>
    </div>
  </div>
)

interface ItemRowProps {
  item: OfferItem
  index: number
  isEditMode: boolean
  onUpdate: (id: number, field: keyof OfferItem, value: string | number) => void
  onRemove: (id: number) => void
  canRemove: boolean
}

const ItemRow = ({ item, index, isEditMode, onUpdate, onRemove, canRemove }: ItemRowProps) => (
  <tr>
    <td className="text-center">{index + 1}</td>
    <td>
      {isEditMode ? (
        <Input
          value={item.partNo}
          onChange={(e) => onUpdate(item.id, 'partNo', e.target.value)}
          placeholder="Part No"
          className="h-7 text-xs w-full"
          aria-label={`Part number for item ${index + 1}`}
        />
      ) : (
        item.partNo || '-'
      )}
    </td>
    <td>
      {isEditMode ? (
        <Input
          value={item.description}
          onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
          placeholder="Description"
          className="h-7 text-xs w-full"
          aria-label={`Description for item ${index + 1}`}
        />
      ) : (
        item.description || '-'
      )}
    </td>
    <td>
      {isEditMode ? (
        <Input
          value={item.hsnCode}
          onChange={(e) => onUpdate(item.id, 'hsnCode', e.target.value)}
          placeholder="HSN"
          className="h-7 text-xs w-full"
          aria-label={`HSN code for item ${index + 1}`}
        />
      ) : (
        item.hsnCode || '-'
      )}
    </td>
    <td className="text-right">
      {isEditMode ? (
        <Input
          type="number"
          value={item.unitPrice}
          onChange={(e) => onUpdate(item.id, 'unitPrice', e.target.value)}
          placeholder="0"
          className="h-7 text-xs w-full text-right"
          aria-label={`Unit price for item ${index + 1}`}
        />
      ) : (
        item.unitPrice ? parseFloat(item.unitPrice).toLocaleString('en-IN') : '-'
      )}
    </td>
    <td className="text-right">
      {isEditMode ? (
        <Input
          type="number"
          value={item.quantity}
          onChange={(e) => onUpdate(item.id, 'quantity', parseInt(e.target.value) || 1)}
          placeholder="1"
          min="1"
          className="h-7 text-xs w-full text-right"
          aria-label={`Quantity for item ${index + 1}`}
        />
      ) : (
        (item.partNo || item.description) ? item.quantity : '-'
      )}
    </td>
    <td className="text-right font-medium">
      {formatCurrency(calculateItemTotal(item.unitPrice, item.quantity))}
    </td>
    {isEditMode && (
      <td className="text-center print:hidden">
        <Button
          onClick={() => onRemove(item.id)}
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-[#E17F70] hover:text-[#75242D] hover:bg-[#E17F70]/10"
          disabled={!canRemove}
          aria-label={`Remove item ${index + 1}`}
          title={canRemove ? 'Remove item' : 'Cannot remove last item'}
        >
          ×
        </Button>
      </td>
    )}
  </tr>
)

// ==================== Main Component ====================
export default function QuoteGenerationPage() {
  const params = useParams()
  const router = useRouter()
  const offerId = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  // ==================== State Management ====================
  const [offer, setOffer] = useState<Offer | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editableData, setEditableData] = useState<EditableData>({
    ...DEFAULT_COMPANY_INFO,
    title: '',
    description: '',
    subject: '',
    introduction: '',
    offerValue: '',
    gstRate: DEFAULT_GST_RATE,
    remarks: '',
    contactPersonName: '',
    contactPersonPhone: '',
    contactPersonEmail: '',
    signatureImage: null,
    items: [DEFAULT_ITEM],
    machineDetails: DEFAULT_MACHINE_DETAILS,
    customerName: '',
    customerAddress: '',
    customerCity: '',
    customerState: ''
  })

  // ==================== Data Fetching ====================
  const fetchOffer = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching offer with ID:', offerId)
      
      // Try admin endpoint first, fall back to zone endpoint if admin fails
      let response;
      try {
        response = await apiService.getOfferForQuoteAdmin(parseInt(offerId))
      } catch (error: any) {
        if (error.response?.status === 403) {
          // Zone manager accessing admin quote page - use zone endpoint
          console.log('📍 Using zone quote endpoint for zone manager')
          response = await apiService.getOfferForQuote(parseInt(offerId))
        } else {
          throw error;
        }
      }
      
      console.log('✅ Offer data received:', response)
      const offerData: Offer = response.offer
      setOffer(offerData)
      
      // Map spare parts to items format
      const mappedItems: OfferItem[] = offerData.offerSpareParts && offerData.offerSpareParts.length > 0
        ? offerData.offerSpareParts.map((osp, index) => ({
            id: index + 1,
            partNo: osp.sparePart.partNumber,
            description: osp.sparePart.name || osp.sparePart.description || '',
            hsnCode: osp.sparePart.category || '',
            unitPrice: osp.unitPrice.toString(),
            quantity: osp.quantity,
            total: osp.totalPrice.toString()
          }))
        : [DEFAULT_ITEM];

      // Get machine details from assets
      const firstAsset = offerData.offerAssets && offerData.offerAssets.length > 0 
        ? offerData.offerAssets[0].asset 
        : null;

      // Determine machine owner (ACCOUNT_OWNER contact name)
      const accountOwner = offerData.customer?.contacts?.find(c => c.role === 'ACCOUNT_OWNER');
      const machineOwner = accountOwner?.contactPersonName || '';

      // Try to parse saved quote data from remarks field
      let storedQuoteData: any = null
      if (offerData.remarks) {
        try {
          const parsed = JSON.parse(offerData.remarks)
          storedQuoteData = parsed.quoteData
          console.log('📦 Loaded saved quote data:', storedQuoteData)
        } catch (e) {
          // remarks is not JSON, it's just plain text
          console.log('📝 Remarks is plain text, not quote data')
        }
      }

      // Initialize editable data, prioritizing saved quote data over default values
      setEditableData({
        // Company info: use saved or default
        companyName: storedQuoteData?.companyInfo?.companyName || DEFAULT_COMPANY_INFO.companyName,
        companyAddress: storedQuoteData?.companyInfo?.companyAddress || DEFAULT_COMPANY_INFO.companyAddress,
        companyCity: storedQuoteData?.companyInfo?.companyCity || DEFAULT_COMPANY_INFO.companyCity,
        companyPhone: storedQuoteData?.companyInfo?.companyPhone || DEFAULT_COMPANY_INFO.companyPhone,
        companyFax: storedQuoteData?.companyInfo?.companyFax || DEFAULT_COMPANY_INFO.companyFax,
        companyEmail: storedQuoteData?.companyInfo?.companyEmail || DEFAULT_COMPANY_INFO.companyEmail,
        companyWebsite: storedQuoteData?.companyInfo?.companyWebsite || DEFAULT_COMPANY_INFO.companyWebsite,
        gstNumber: storedQuoteData?.gstNumber || DEFAULT_COMPANY_INFO.gstNumber,
        arnNumber: storedQuoteData?.arnNumber || DEFAULT_COMPANY_INFO.arnNumber,
        
        // Offer fields
        title: offerData.title || '',
        description: offerData.description || '',
        
        // Quote-specific fields from saved data
        subject: storedQuoteData?.subject || offerData.subject || '',
        introduction: storedQuoteData?.introduction || offerData.introduction || '',
        
        offerValue: offerData.offerValue?.toString() || '',
        gstRate: storedQuoteData?.gstRate || DEFAULT_GST_RATE,
        
        // Plain text remarks (only if not JSON)
        remarks: storedQuoteData ? '' : (offerData.remarks || ''),
        
        // Contact details
        contactPersonName: offerData.contact?.contactPersonName || offerData.contactPersonName || '',
        contactPersonPhone: offerData.contact?.contactNumber || offerData.contactNumber || '',
        contactPersonEmail: offerData.contact?.email || offerData.email || '',
        
        // Signature from saved data
        signatureImage: storedQuoteData?.signatureImage || null,
        
        // Items: prioritize saved quote items over spare parts mapping
        items: storedQuoteData?.quoteItems?.length > 0 
          ? storedQuoteData.quoteItems.map((item: any, index: number) => ({
              id: index + 1,
              partNo: item.partNo || '',
              description: item.description || '',
              hsnCode: item.hsnCode || '',
              unitPrice: item.unitPrice || '',
              quantity: item.quantity || 1,
              total: ''
            }))
          : mappedItems,
        
        // Machine details: prioritize saved data
        machineDetails: storedQuoteData?.machineDetails || {
          model: firstAsset?.model || '',
          serialNumber: firstAsset?.machineSerialNumber || offerData.machineSerialNumber || '',
          owner: machineOwner,
          department: offerData.department || offerData.location || ''
        },
        
        // Customer details: prioritize saved data over offer data
        customerName: storedQuoteData?.customerInfo?.customerName || offerData.customer?.companyName || offerData.company || '',
        customerAddress: storedQuoteData?.customerInfo?.customerAddress || offerData.customer?.address || '',
        customerCity: storedQuoteData?.customerInfo?.customerCity || offerData.customer?.city || '',
        customerState: storedQuoteData?.customerInfo?.customerState || offerData.customer?.state || ''
      })
    } catch (error: any) {
      console.error('❌ Failed to fetch offer:', error)
      console.error('❌ Error response:', error.response?.data)
      console.error('❌ Error status:', error.response?.status)
      
      if (error.response?.status === 403) {
        toast.error('Access denied: You do not have permission to view this offer')
      } else if (error.response?.status === 404) {
        toast.error('Offer not found')
      } else {
        toast.error('Failed to load offer details')
      }
    } finally {
      setLoading(false)
    }
  }, [offerId])

  // ==================== Effects ====================
  // Ref to prevent duplicate API calls (React StrictMode protection)
  const hasFetchedOffer = useRef(false)

  useEffect(() => {
    if (hasFetchedOffer.current) return
    hasFetchedOffer.current = true
    fetchOffer()
  }, [fetchOffer])

  // ==================== Event Handlers ====================
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleDownloadPDF = useCallback(() => {
    window.print()
    toast.success('Use your browser\'s print dialog to save as PDF')
  }, [])



  // Save Quote Changes to Backend
  const saveQuoteChanges = useCallback(async () => {
    if (!offer) return false
    
    try {
      setSaving(true)
      
      // Calculate the total offer value from items
      const calculatedOfferValue = editableData.items.reduce((sum, item) => {
        return sum + calculateItemTotal(item.unitPrice, item.quantity)
      }, 0)
      
      // Build the update payload with fields that exist in the Offer model
      // Note: subject and introduction are quote-specific, we'll combine them into description/remarks
      const updatePayload: any = {
        // Title and description from editable data
        title: editableData.title || offer.title || null,
        description: editableData.description || offer.description || null,
        
        // Combine subject and introduction into a structured remarks format for quote context
        // Format: [QUOTE_DATA]subject|introduction|gstNumber|arnNumber|machineDetails[/QUOTE_DATA]
        remarks: JSON.stringify({
          quoteData: {
            subject: editableData.subject,
            introduction: editableData.introduction,
            gstNumber: editableData.gstNumber,
            arnNumber: editableData.arnNumber,
            machineDetails: editableData.machineDetails,
            companyInfo: {
              companyName: editableData.companyName,
              companyAddress: editableData.companyAddress,
              companyCity: editableData.companyCity,
              companyPhone: editableData.companyPhone,
              companyFax: editableData.companyFax,
              companyEmail: editableData.companyEmail,
              companyWebsite: editableData.companyWebsite,
            },
            customerInfo: {
              customerName: editableData.customerName,
              customerAddress: editableData.customerAddress,
              customerCity: editableData.customerCity,
              customerState: editableData.customerState,
            },
            gstRate: editableData.gstRate,
            signatureImage: editableData.signatureImage,
            // Store items as part of quote context since spare parts may not cover all scenarios
            quoteItems: editableData.items.map(item => ({
              partNo: item.partNo,
              description: item.description,
              hsnCode: item.hsnCode,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
            })),
          }
        }),
        
        // Update offer value from calculated items
        offerValue: calculatedOfferValue > 0 ? calculatedOfferValue : (parseFloat(editableData.offerValue) || null),
        
        // Contact details
        contactPersonName: editableData.contactPersonName || null,
        contactNumber: editableData.contactPersonPhone || null,
        email: editableData.contactPersonEmail || null,
        
        // Machine details
        machineSerialNumber: editableData.machineDetails.serialNumber || null,
        department: editableData.machineDetails.department || null,
      }
      
      console.log('📝 Saving quote changes:', updatePayload)
      
      // Call the API to update the offer
      await apiService.updateOffer(parseInt(offerId), updatePayload)
      
      toast.success('Quote changes saved successfully!')
      return true
    } catch (error: any) {
      console.error('❌ Failed to save quote changes:', error)
      toast.error(error.response?.data?.error || 'Failed to save quote changes')
      return false
    } finally {
      setSaving(false)
    }
  }, [offer, offerId, editableData])

  const handleToggleEditMode = useCallback(async () => {
    if (isEditMode) {
      // Exiting edit mode - save changes first
      const saved = await saveQuoteChanges()
      if (saved) {
        setIsEditMode(false)
      }
      // If save failed, stay in edit mode so user can fix issues
    } else {
      // Entering edit mode
      setIsEditMode(true)
    }
  }, [isEditMode, saveQuoteChanges])

  // Cancel editing without saving
  const handleCancelEdit = useCallback(() => {
    // Reset editable data to original offer data
    if (offer) {
      const mappedItems: OfferItem[] = offer.offerSpareParts && offer.offerSpareParts.length > 0
        ? offer.offerSpareParts.map((osp, index) => ({
            id: index + 1,
            partNo: osp.sparePart.partNumber,
            description: osp.sparePart.name || osp.sparePart.description || '',
            hsnCode: osp.sparePart.category || '',
            unitPrice: osp.unitPrice.toString(),
            quantity: osp.quantity,
            total: osp.totalPrice.toString()
          }))
        : [DEFAULT_ITEM]
      
      const firstAsset = offer.offerAssets && offer.offerAssets.length > 0 
        ? offer.offerAssets[0].asset 
        : null
      
      const accountOwner = offer.customer?.contacts?.find(c => c.role === 'ACCOUNT_OWNER')
      const machineOwner = accountOwner?.contactPersonName || ''
      
      // Try to parse stored quote data from remarks
      let storedQuoteData: any = null
      if (offer.remarks) {
        try {
          const parsed = JSON.parse(offer.remarks)
          storedQuoteData = parsed.quoteData
        } catch (e) {
          // remarks is not JSON, ignore
        }
      }
      
      setEditableData({
        ...DEFAULT_COMPANY_INFO,
        ...(storedQuoteData?.companyInfo || {}),
        title: offer.title || '',
        description: offer.description || '',
        subject: storedQuoteData?.subject || offer.subject || '',
        introduction: storedQuoteData?.introduction || offer.introduction || '',
        offerValue: offer.offerValue?.toString() || '',
        gstRate: storedQuoteData?.gstRate || DEFAULT_GST_RATE,
        gstNumber: storedQuoteData?.gstNumber || DEFAULT_COMPANY_INFO.gstNumber,
        arnNumber: storedQuoteData?.arnNumber || DEFAULT_COMPANY_INFO.arnNumber,
        remarks: typeof offer.remarks === 'string' && !offer.remarks.startsWith('{') ? offer.remarks : '',
        contactPersonName: offer.contact?.contactPersonName || offer.contactPersonName || '',
        contactPersonPhone: offer.contact?.contactNumber || offer.contactNumber || '',
        contactPersonEmail: offer.contact?.email || offer.email || '',
        signatureImage: storedQuoteData?.signatureImage || null,
        items: storedQuoteData?.quoteItems?.length > 0 
          ? storedQuoteData.quoteItems.map((item: any, index: number) => ({
              id: index + 1,
              ...item
            }))
          : mappedItems,
        machineDetails: storedQuoteData?.machineDetails || {
          model: firstAsset?.model || '',
          serialNumber: firstAsset?.machineSerialNumber || offer.machineSerialNumber || '',
          owner: machineOwner,
          department: offer.department || offer.location || ''
        },
        customerName: storedQuoteData?.customerInfo?.customerName || offer.customer?.companyName || offer.company || '',
        customerAddress: storedQuoteData?.customerInfo?.customerAddress || offer.customer?.address || '',
        customerCity: storedQuoteData?.customerInfo?.customerCity || offer.customer?.city || '',
        customerState: storedQuoteData?.customerInfo?.customerState || offer.customer?.state || ''
      })
    }
    setIsEditMode(false)
    toast.info('Changes discarded')
  }, [offer])

  // ==================== Computed Values ====================
  const quoteDate = useMemo(() => new Date(), [])
  const validUntil = useMemo(() => getValidUntilDate(), [])

  // ==================== Calculations ====================
  const subtotal = useMemo(() => {
    return editableData.items.reduce((sum, item) => {
      return sum + calculateItemTotal(item.unitPrice, item.quantity)
    }, 0)
  }, [editableData.items])

  // ==================== Signature Upload ====================
  const handleSignatureUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a valid image file (JPG, PNG, GIF)')
        return
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size should be less than 2MB')
        return
      }
      
      // Convert to base64 for preview
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64String = e.target?.result as string
        setEditableData(prev => ({
          ...prev,
          signatureImage: base64String
        }))
        toast.success('Signature uploaded successfully!')
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const removeSignature = useCallback(() => {
    setEditableData(prev => ({
      ...prev,
      signatureImage: null
    }))
    toast.success('Signature removed')
  }, [])

  // ==================== Item Management ====================
  const addNewItem = useCallback(() => {
    setEditableData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...DEFAULT_ITEM,
          id: prev.items.length + 1
        }
      ]
    }))
  }, [])

  const removeItem = useCallback((id: number) => {
    setEditableData(prev => {
      if (prev.items.length <= 1) return prev
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== id)
      }
    })
  }, [])

  const updateItem = useCallback((id: number, field: keyof OfferItem, value: string | number) => {
    setEditableData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }))
  }, [])

  // ==================== Render Helpers ====================
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#546A7A] mb-4" />
          <p className="text-[#5D6E73]">Loading quotation...</p>
        </div>
      </div>
    )
  }

  if (!offer) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-[#5D6E73]">Offer not found</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/80 print:bg-white">
      {/* Action Buttons - Hidden on print */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E2E8F0] px-4 py-3 print:hidden mb-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/offers/${offerId}`)}
              aria-label="Go back to offer details"
              className="hover:bg-cyan-50 text-[#546A7A]"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Offer</span>
            </Button>
            <div className="h-6 w-[1px] bg-[#E2E8F0] hidden sm:block"></div>
            <div>
              <p className="text-[10px] sm:text-xs text-[#64748B] font-medium uppercase tracking-wider">
                Quotation Generation
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#1E293B]">
                Ref: {offer.offerReferenceNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isEditMode && (
              <Button 
                onClick={handleCancelEdit}
                variant="outline"
                disabled={saving}
                className="bg-white"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button 
              onClick={handleToggleEditMode}
              variant={isEditMode ? "default" : "outline"}
              className={isEditMode ? "bg-[#4472C4] hover:bg-[#365ba3]" : "bg-white"}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEditMode ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Quote
                </>
              )}
            </Button>
            <Button onClick={handlePrint} variant="outline" disabled={isEditMode || saving} className="bg-white">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline" disabled={isEditMode || saving} className="bg-white">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Quotation Document Wrapper */}
      <div className="max-w-[1200px] mx-auto pb-20 print:pb-0">
        <div ref={printRef} className="quotation-document">
          <div className="document-container">
            {/* Page 1 - Main Quote */}
            <div className="page page-1 shadow-2xl print:shadow-none mb-10 print:mb-0">
            {/* Logo */}
            <KardexLogo />

            <div className="page-content">
              {/* Title - Elegant and Branded */}
              <div className="page-title mt-8 mb-12">
                <h1 className="text-center">
                  <span className="bg-[#4472C4] text-white px-8 py-3 rounded-sm shadow-md border-b-4 border-[#365ba3] uppercase tracking-widest text-lg font-bold">
                    {offer?.productType ? `${PRODUCT_TYPE_LABELS[offer.productType] || offer.productType.replace(/_/g, ' ')} Quotation` : 'Quotation'}
                  </span>
                </h1>
              </div>

              {/* Header Info - Reference and GST */}
              <div className="quote-header-simple" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px'}}>
                <div className="quote-ref-info" style={{textAlign: 'left'}}>
                  <p><strong>Ref: {offer.offerReferenceNumber}</strong></p>
                  <p>Dated: {format(quoteDate, 'dd/MM/yyyy')}</p>
                </div>
                <div className="quote-gst-info" style={{textAlign: 'right'}}>
                  {isEditMode ? (
                    <div className="space-y-1">
                      <Input
                        value={editableData.gstNumber}
                        onChange={(e) => setEditableData({...editableData, gstNumber: e.target.value})}
                        className="text-right text-xs h-7"
                        placeholder="GST Number"
                      />
                      <Input
                        value={editableData.arnNumber}
                        onChange={(e) => setEditableData({...editableData, arnNumber: e.target.value})}
                        className="text-right text-xs h-7"
                        placeholder="ARN Number"
                      />
                    </div>
                  ) : (
                    <>
                      <p>GST – {editableData.gstNumber}</p>
                      <p>ARN – {editableData.arnNumber}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Customer Details - Simple Format */}
              <div className="customer-details-simple">
                {isEditMode ? (
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="font-bold mr-2">M/s</span>
                      <Input
                        value={editableData.customerName}
                        onChange={(e) => setEditableData({...editableData, customerName: e.target.value})}
                        placeholder="Customer/Company Name"
                        className="flex-1"
                      />
                    </div>
                    <Input
                      value={editableData.customerAddress}
                      onChange={(e) => setEditableData({...editableData, customerAddress: e.target.value})}
                      placeholder="Customer Address"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={editableData.customerCity}
                        onChange={(e) => setEditableData({...editableData, customerCity: e.target.value})}
                        placeholder="City"
                        className="flex-1"
                      />
                      <Input
                        value={editableData.customerState}
                        onChange={(e) => setEditableData({...editableData, customerState: e.target.value})}
                        placeholder="State"
                        className="flex-1"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="customer-name"><strong>M/s {editableData.customerName.startsWith('M/s') ? editableData.customerName.replace(/^M\/s\s*/, '') : (editableData.customerName || offer?.customer?.companyName || offer?.company || '')}</strong></p>
                    {(editableData.customerAddress || offer.customer?.address) && <p className="customer-address">{editableData.customerAddress || offer.customer?.address}</p>}
                    {(editableData.customerCity || editableData.customerState || offer.customer?.city || offer.customer?.state) && (
                      <p className="customer-location">
                        {[editableData.customerCity || offer.customer?.city, editableData.customerState || offer.customer?.state].filter(Boolean).join(' - ')}.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Kind Attention - Blue color like screenshot */}
              <div className="kind-attention-section">
                {isEditMode ? (
                  <div className="flex items-center">
                    <span className="font-bold mr-2" style={{color: '#1e5f8b'}}>Kind Attn:</span>
                    <Input
                      value={editableData.contactPersonName}
                      onChange={(e) => setEditableData({...editableData, contactPersonName: e.target.value})}
                      placeholder="Contact Person Name"
                      className="flex-1"
                    />
                  </div>
                ) : (
                  <p className="kind-attention-text" style={{color: '#1e5f8b'}}><strong>Kind Attn: {editableData.contactPersonName || offer.contactPersonName || '[Contact Person Name]'}.</strong></p>
                )}
              </div>

              {/* Subject */}
              <div className="subject-section-simple">
                {isEditMode ? (
                  <Input
                    value={editableData.subject}
                    onChange={(e) => setEditableData({...editableData, subject: e.target.value})}
                    placeholder="Subject"
                    className="font-semibold"
                  />
                ) : (
                  editableData.subject && <p><strong>Sub: {editableData.subject}</strong></p>
                )}
              </div>

              {/* Introduction */}
              <div className="introduction-section-simple">
                {isEditMode ? (
                  <Textarea
                    value={editableData.introduction}
                    onChange={(e) => setEditableData({...editableData, introduction: e.target.value})}
                    placeholder="Introduction paragraph"
                    rows={3}
                  />
                ) : (
                  editableData.introduction && <p><strong>Kardex India Pvt Ltd</strong> (hereby referred to as <strong>KIPL</strong>) {editableData.introduction}</p>
                )}
              </div>

              {/* Machine Details */}
              <div className="machine-details-section">
                <p className="section-label"><strong>Machine Details:</strong></p>
                <table className="data-table machine-table">
                  <thead>
                    <tr>
                      <th style={{width: '60px'}}>Sr. No</th>
                      <th>Machine Model</th>
                      <th>Machine Sr. No</th>
                      <th>Machine Owner</th>
                      <th>Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>
                        {isEditMode ? (
                          <Input
                            value={editableData.machineDetails.model}
                            onChange={(e) => setEditableData({...editableData, machineDetails: {...editableData.machineDetails, model: e.target.value}})}
                            placeholder="Machine Model"
                            className="h-7 text-xs"
                          />
                        ) : (
                          editableData.machineDetails.model || '-'
                        )}
                      </td>
                      <td>
                        {isEditMode ? (
                          <Input
                            value={editableData.machineDetails.serialNumber}
                            onChange={(e) => setEditableData({...editableData, machineDetails: {...editableData.machineDetails, serialNumber: e.target.value}})}
                            placeholder="Serial Number"
                            className="h-7 text-xs"
                          />
                        ) : (
                          editableData.machineDetails.serialNumber || '-'
                        )}
                      </td>
                      <td>
                        {isEditMode ? (
                          <Input
                            value={editableData.machineDetails.owner}
                            onChange={(e) => setEditableData({...editableData, machineDetails: {...editableData.machineDetails, owner: e.target.value}})}
                            placeholder="Owner"
                            className="h-7 text-xs"
                          />
                        ) : (
                          editableData.machineDetails.owner || '-'
                        )}
                      </td>
                      <td>
                        {isEditMode ? (
                          <Input
                            value={editableData.machineDetails.department}
                            onChange={(e) => setEditableData({...editableData, machineDetails: {...editableData.machineDetails, department: e.target.value}})}
                            placeholder="Department"
                            className="h-7 text-xs"
                          />
                        ) : (
                          editableData.machineDetails.department || '-'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Parts/Items Table */}
              <div className="items-section">
                <div className="section-header">
                  <p className="section-label"><strong>Emergency Parts</strong></p>
                  {isEditMode && (
                    <Button onClick={addNewItem} size="sm" variant="outline" className="print:hidden">
                      Add Item
                    </Button>
                  )}
                </div>
                <div className="table-container">
                <table className="data-table items-table">
                  <thead>
                    <tr>
                      <th style={{width: '40px'}}>S.N</th>
                      <th style={{width: '100px'}}>Part No</th>
                      <th>Description</th>
                      <th style={{width: '80px'}}>HSN Code</th>
                      <th style={{width: '90px'}} className="text-right">Unit Price</th>
                      <th style={{width: '50px'}} className="text-right">Qty</th>
                      <th style={{width: '100px'}} className="text-right">Total Price</th>
                      {isEditMode && <th style={{width: '60px'}} className="print:hidden">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {editableData.items.map((item, index) => (
                      <ItemRow
                        key={`${item.id}-${index}`}
                        item={item}
                        index={index}
                        isEditMode={isEditMode}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                        canRemove={editableData.items.length > 1}
                      />
                    ))}
                    <tr className="total-row">
                      <td colSpan={6} className="text-right font-semibold">SUB TOTAL</td>
                      <td className="text-right font-semibold">
                        {formatCurrency(subtotal)}
                      </td>
                      {isEditMode && <td className="print:hidden"></td>}
                    </tr>
                    <tr className="tax-row-display">
                      <td colSpan={6} className="text-right text-xs">GST ({editableData.gstRate}%)</td>
                      <td className="text-right text-xs">
                        {formatCurrency(subtotal * (editableData.gstRate / 100))}
                      </td>
                      {isEditMode && <td className="print:hidden"></td>}
                    </tr>
                    <tr className="grand-total-row bg-[#4472C4]/5">
                      <td colSpan={6} className="text-right font-bold text-[#4472C4] py-3">GRAND TOTAL</td>
                      <td className="text-right font-bold text-[#4472C4] py-3">
                        {formatCurrency(subtotal * (1 + editableData.gstRate / 100))}
                      </td>
                      {isEditMode && <td className="print:hidden"></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

              {/* Page 1 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={1} />
            </div>
          </div>

          {/* Page 2 - Terms and Conditions - ENHANCED */}
          <div className="page page-2 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content">
              {/* TERMS AND CONDITIONS */}
              <div className="page2-terms-section">
                <h3 className="premium-section-header">
                  <span className="header-icon text-[#4472C4]">📋</span>
                  Terms and Conditions
                </h3>
                <div className="terms-card-premium">
                  <ul className="terms-grid-premium">
                    <li><span className="bullet">■</span> <strong>GST:</strong> {editableData.gstRate}% to be paid extra on all items.</li>
                    <li><span className="bullet">■</span> <strong>Validity:</strong> Quotation validity is 30 days from the date of issue.</li>
                    <li><span className="bullet">■</span> <strong>Delivery:</strong> Ex-Works Bangalore, within 14 to 18 weeks from PO date.</li>
                    <li><span className="bullet">■</span> <strong>Warranty:</strong> 3 months for Electronic parts from the date of delivery.</li>
                    <li><span className="bullet">■</span> <strong>Payment:</strong> N30 (Net 30 days) from the date of delivery.</li>
                  </ul>
                </div>
              </div>

              {/* OTHER TERMS & CONDITIONS */}
              <div className="other-terms-highlight">
                <p><strong>NOTE:</strong> OTHER TERMS & CONDITIONS AS PER THE ANNEXURE ATTACHED</p>
              </div>

              {/* Please Note Section */}
              <div className="important-notes-section">
                <h3 className="premium-section-header">
                  <span className="header-icon text-[#d97706]">💡</span>
                  Please Note
                </h3>
                <div className="notes-grid-premium">
                  <div className="note-item-premium">
                    <span className="note-num">1</span>
                    <p>PO should contain Customer GST number of the place where delivery/services are requesting.</p>
                  </div>
                  <div className="note-item-premium text-slate-600">
                    <span className="note-num">2</span>
                    <p>If delivery address is different than the Invoice address, then we need Delivery address GST details.</p>
                  </div>
                  <div className="note-item-premium">
                    <span className="note-num">3</span>
                    <p>PO should be on address as mentioned in quotation and contain reference <strong>{offer.offerReferenceNumber}</strong>.</p>
                  </div>
                  <div className="note-item-premium">
                    <span className="note-num">4</span>
                    <p>PO should contain Kardex Ident Number and all line items as per the quotation.</p>
                  </div>
                   <div className="note-item-premium">
                    <span className="note-num">5</span>
                    <p>PO should contain delivery address, contact person's details, and company seal signature.</p>
                  </div>
                </div>
              </div>

              {/* Company Assurance */}
              <div className="assurance-card-premium">
                <div className="assurance-icon">🤝</div>
                <div className="assurance-text">
                  <p>We assure you of our best services at all times and we shall not give you any room for complaint. We shall spare no effort to ensure a professional first-class after-sales service.</p>
                </div>
              </div>

              {/* Order Release Box */}
              <div className="order-release-premium">
                <p className="release-title">Kindly release the purchase order to:</p>
                <div className="company-info-premium">
                  <p className="company-name-large">M/s. {editableData.companyName.toUpperCase()}</p>
                  <p className="company-address-text">{editableData.companyAddress}, {editableData.companyCity}</p>
                  <div className="company-contact-row">
                    <span><strong>Tel:</strong> {editableData.companyPhone}</span>
                    {editableData.companyFax && <span><strong>Fax:</strong> {editableData.companyFax}</span>}
                    <span><strong>Web:</strong> <a href={`https://${editableData.companyWebsite}`} className="text-[#4472C4]">{editableData.companyWebsite}</a></span>
                  </div>
                </div>
              </div>

              {/* Signature Section - Contact Person */}
              <div className="signature-footer-premium">
                <p className="undertime-text">If you need any clarifications, please contact the undersigned.</p>
                <p className="faithfully-text">Yours faithfully,</p>
                
                {isEditMode ? (
                  <div className="edit-signature-controls print:hidden mt-4">
                     <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                           <Input value={editableData.contactPersonName} onChange={(e) => setEditableData({...editableData, contactPersonName: e.target.value})} placeholder="Name" />
                           <Input value={editableData.contactPersonPhone} onChange={(e) => setEditableData({...editableData, contactPersonPhone: e.target.value})} placeholder="Phone" />
                           <Input value={editableData.contactPersonEmail} onChange={(e) => setEditableData({...editableData, contactPersonEmail: e.target.value})} placeholder="Email" />
                        </div>
                        <div className="w-1/3">
                           {editableData.signatureImage ? (
                             <div className="relative border rounded p-2">
                               <img src={editableData.signatureImage} className="h-20 object-contain mx-auto" />
                               <Button onClick={removeSignature} variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6"><X className="h-3 w-3"/></Button>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center justify-center border-2 border-dashed h-full rounded p-4 text-slate-400">
                               <input type="file" id="sig-up" className="hidden" onChange={handleSignatureUpload} />
                               <label htmlFor="sig-up" className="cursor-pointer text-center">
                                 <Upload className="mx-auto h-6 w-6 mb-1" />
                                 <span className="text-[10px]">Upload Sign</span>
                               </label>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="signature-display-premium">
                    <div className="sig-image-container">
                      {editableData.signatureImage ? (
                        <img src={editableData.signatureImage} alt="Signature" className="sig-img" />
                      ) : (
                        <div className="sig-placeholder">Please Sign Here</div>
                      )}
                    </div>
                    <div className="sig-details">
                      <p className="sig-name">{editableData.contactPersonName || '[Name]'}</p>
                      <p className="sig-contact">{editableData.contactPersonPhone}</p>
                      <p className="sig-email">{editableData.contactPersonEmail}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Page 2 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={2} />
          </div>

          {/* Page 3 - Service Products - ENHANCED */}
          <div className="page page-3-premium shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content">
              <div className="premium-page-header mb-8">
                <h2 className="premium-main-title">KARDEX Service Products</h2>
                <div className="premium-title-underline"></div>
              </div>
            
              <div className="service-products-container">
                {/* 1) VLM Box */}
                <div className="service-product-card-premium">
                   <div className="service-card-image">
                     <img 
                       src="/Picture1.jpg" 
                       alt="Kardex VLM Box" 
                       onError={(e) => { e.currentTarget.style.display = 'none'; }}
                     />
                     <div className="service-card-badge">Capacity +25%</div>
                   </div>
                   <div className="service-card-content">
                      <h3 className="service-card-title">1) VLM Box</h3>
                      <p className="service-card-intro">Increase your stock capacity by 20-25% while maintaining a tidy and organized environment.</p>
                      <p className="service-card-description">
                        Our Kardex VLM BOX is an adjustable bin system designed for the Vertical Lift Module Kardex Remstar XP. 
                        It provides extreme flexibility in height, width, and depth to create over 300 location types from just one box.
                      </p>
                   </div>
                </div>

                {/* 2) Relocations, Upgrades & Retrofits */}
                <div className="service-product-card-premium">
                   <div className="service-card-image">
                     <img 
                       src="/Picture2.jpg" 
                       alt="Relocations & Upgrades" 
                       onError={(e) => { e.currentTarget.style.display = 'none'; }}
                     />
                     <div className="service-card-badge">Expert Service</div>
                   </div>
                   <div className="service-card-content">
                      <h3 className="service-card-title">2) Relocations, Upgrades & Retrofits</h3>
                      <p className="service-card-intro">Modernize your systems to ensure they are always used optimally.</p>
                      <div className="services-list-premium">
                        <div className="service-list-item"><span>•</span> Height changes</div>
                        <div className="service-list-item"><span>•</span> Improve storage capacity</div>
                        <div className="service-list-item"><span>•</span> Security/Component upgrades</div>
                        <div className="service-list-item"><span>•</span> Relocation of Kardex System</div>
                        <div className="service-list-item"><span>•</span> Modernizations</div>
                        <div className="service-list-item"><span>•</span> Picking device replacement</div>
                      </div>
                   </div>
                </div>

                {/* 3) Remote Support */}
                <div className="service-product-card-premium">
                   <div className="service-card-image">
                     <img 
                       src="/Picture3.jpg" 
                       alt="Remote Support" 
                       onError={(e) => { e.currentTarget.style.display = 'none'; }}
                     />
                     <div className="service-card-badge">24/7 Connectivity</div>
                   </div>
                   <div className="service-card-content">
                      <h3 className="service-card-title">3) Remote Support</h3>
                      <p className="service-card-intro">Don't let unplanned equipment downtime cost your company money.</p>
                      <p className="service-card-description">
                        Access machines and perform proactive maintenance or resolve breakdowns instantly. 
                        Request technical help directly from the equipment panel for rapid resolution.
                      </p>
                   </div>
                </div>
              </div>
            </div>

            <PageFooter productType={offer?.productType} pageNumber={3} />
          </div>

          {/* Page 4 - Service Package - ENHANCED */}
          <div className="page page-4-premium shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content">
              <div className="premium-page-header mb-8">
                <h2 className="premium-main-title">Service Package</h2>
                <p className="premium-subtitle">Find the best service package for your requirements and ensure maximum efficiency.</p>
                <div className="premium-title-underline"></div>
              </div>

              <div className="package-hero-section">
                <div className="package-diagram-container">
                   <div className="diagram-wrapper">
                     <img 
                       src="/Picture4.jpg" 
                       alt="Service Package" 
                       className="main-diagram-img"
                       onError={(e) => { e.currentTarget.style.display = 'none'; }}
                     />
                   </div>
                </div>
                <div className="package-highlights">
                   <div className="highlight-item productivity">
                      <span className="highlight-number">01</span>
                      <div className="highlight-text-pkg">
                        <span className="package-highlight-title">Productivity</span>
                        <p className="package-highlight-desc">Optimize operations</p>
                      </div>
                   </div>
                   <div className="highlight-item reliability">
                      <span className="highlight-number">02</span>
                      <div className="highlight-text-pkg">
                        <span className="package-highlight-title">Reliability</span>
                        <p className="package-highlight-desc">Maximum uptime</p>
                      </div>
                   </div>
                   <div className="highlight-item sustainability">
                      <span className="highlight-number">03</span>
                      <div className="highlight-text-pkg">
                        <span className="package-highlight-title">Sustainability</span>
                        <p className="package-highlight-desc">Lifecycle extension</p>
                      </div>
                   </div>
                </div>
              </div>

              <div className="package-features-grid-premium">
                <div className="feature-card-premium productivity">
                  <div className="feature-icon-wrapper">🚀</div>
                  <h4>Productivity</h4>
                  <div className="card-divider"></div>
                  <p>Maximize your operational throughput with optimized picking processes and reduced downtime.</p>
                </div>
                <div className="feature-card-premium reliability">
                  <div className="feature-icon-wrapper">🛡️</div>
                  <h4>Reliability & Safety</h4>
                  <div className="card-divider"></div>
                  <p>Ensure maximum uptime and safe operation of your equipment with regular professional maintenance and safety tests.</p>
                </div>
                <div className="feature-card-premium sustainability">
                  <div className="feature-icon-wrapper">🌱</div>
                  <h4>Sustainability</h4>
                  <div className="card-divider"></div>
                  <p>Extend the lifecycle of your storage systems and reduce energy consumption through modern upgrades and retrofits.</p>
                </div>
              </div>
            </div>

            <PageFooter productType={offer?.productType} pageNumber={4} />
          </div>

          {/* Page 5 - General Terms */}
          <div className="page page-5 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content terms-page">
              <h2 className="terms-main-title">
                <span className="terms-header-badge">General Terms and Conditions</span>
              </h2>
              
              <div className="terms-content">
              <p className="mb-4">These Terms and Conditions (T&C) are structured as follows:</p>
              <ul className="list-disc list-inside space-y-1 mb-4">
                <li>- <strong>Part A (general provisions)</strong> applies to all transactions, except where a provision of the applicable parts B and C contains deviating regulation (other than merely adding further details), which then takes precedence;</li>
                <li>- <strong>Parts B</strong> and <strong>C</strong> contain the applicable specific provisions for supply of products and software programming services with or without installation (Part B), and <strong>individual service orders</strong> and <strong>service contracts</strong> (Part C);</li>
              </ul>
              
              <p className="mb-4">
                These T&C are provided in German, English and other languages. Only the German and English texts are legally binding and authoritative. 
                They are of equal status. Translations of these T&C into other languages are solely for convenience and are not legally binding.
              </p>

              {/* Part A: General Provisions */}
              <div className="terms-part-header part-a">
                <h3>PART A: GENERAL PROVISIONS</h3>
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-2">1. Scope of the T&C</h4>
                <p className="mb-1"><strong>1.1.</strong> These T&C apply to all transactions between <strong>KARDEX INDIA STORAGE SOLUTIONS PRIVATE LIMITED</strong> and the customer, unless expressly otherwise agreed in writing.</p>
                <p className="mb-1"><strong>1.2.</strong> On placement of a purchase order by the customer, these T&C are deemed to be acknowledged, and will also apply for future transactions with the customer.</p>
                <p className="mb-1"><strong>1.3.</strong> Any deviating, contradictory or supplemental terms and conditions of the customer apply only if expressly accepted by KARDEX in writing.</p>
                <p className="mb-1"><strong>1.4.</strong> Any amendments of and additions to the contract must be made in writing. All agreements and legally binding declarations of the parties require written confirmation by KARDEX.</p>
                <p className="mb-1"><strong>1.5.</strong> KARDEX is entitled to amend the T&C at any time. The version current at the time of the purchase order applies. In the case of continuing contractual relationships, the draft of the amended T&C will be sent to the customer in writing no later than one month before the proposed date of their entry into force. The customer is deemed to have given its consent to the amendments if it has not rejected them by the planned date for entry into force. The amended T&C will then apply to any further transactions between the parties.</p>
                <p className="mb-1"><strong>1.6.</strong> The general provisions of these T&C (Part A) apply to all transactions and legal relations between the parties unless otherwise stated in the specific provisions (Parts B and C) or agreed in writing.</p>
                <p><strong>1.7.</strong> The term "<strong>Product(s)</strong>" used in Part A is individually defined for each of Parts B and C. The meaning of this term in Part A shall therefore have the meaning as defined in the applicable Part B and C.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">2. Offers from KARDEX</h4>
                <p className="mb-1"><strong>2.1.</strong> Unless expressly otherwise agreed, offers from KARDEX are nonbinding; otherwise, the offers are valid for 60 days. A statement by the customer is deemed to be an acceptance only if it is fully consistent with the KARDEX offer.</p>
                <p className="mb-1"><strong>2.2.</strong> A contract is only validly concluded if KARDEX (i) confirms the order in writing or (ii) starts to perform the contract by delivering the Products or by rendering the service.</p>
                <p className="mb-1"><strong>2.3.</strong> Under no circumstances shall silence by KARDEX with respect to a counter-offer from the customer be construed as a declaration of acceptance.</p>
                <p><strong>2.4.</strong> The documents relating to offers and order confirmations, such as illustrations, drawings, and weight and measurement details, are binding only if this has been expressly agreed in writing. Unless otherwise agreed in writing, brochures and catalogues are not binding.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">3. Provided Documents</h4>
                <p>Each party retains all rights to plans and technical documents that it has provided to the other party. The receiving party acknowledges these rights, and shall not make such documents available, in full or in part, to any third party without the prior written consent of the other party, or use them outside of the scope of the purpose for which they were provided for. This also applies after termination of the business relationship as well as in the event that no contract is concluded between the parties.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">4. Prices and Payment Conditions</h4>
                <p className="mb-1"><strong>4.1.</strong> All prices are excluding GST</p>
                <p className="mb-1"><strong>4.2.</strong> Unless otherwise agreed in writing or specified in the subsequent specific provisions, invoices from KARDEX are payable within 30 days net from the invoice date, without any deduction. Advance and prepayments are payable within 10 days from the invoice date without any deduction.</p>
                <p className="mb-1"><strong>4.3.</strong> A customer failing to pay by the due date is in default without a reminder, and KARDEX is entitled to charge monthly default interest in the amount of 1%, except where a different default interest rate has been specified in the contract or in the offer.</p>
                <p className="mb-1"><strong>4.4.</strong> In the event of customer default, KARDEX is entitled to withdraw from the contract and claim back any Products already supplied and/or enter the site and render Products unusable. In addition, KARDEX is also entitled to claim direct damages and/or provide outstanding deliveries or services only against advance payment or the provision of collateral, or suspend the provision of services under other orders or service agreements for which payment has already been made.</p>
                <p><strong>4.5.</strong> If KARDEX becomes aware of circumstances casting doubt on the solvency of the customer, KARDEX shall have the right to demand full payment in advance or the provision of collateral.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">5. Set-off and Assignment</h4>
                <p className="mb-1"><strong>5.1.</strong> Set-off against any counterclaims of the customer is not permitted.</p>
                <p className="mb-1"><strong>5.2.</strong> Claims of the customer against KARDEX may be assigned only with consent from KARDEX.</p>
                <p><strong>5.3.</strong> The transfer of any rights and obligations under or in connection with a contract between the parties is permitted only with the other contracting party's written consent.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">6. Liability</h4>
                <p className="mb-1"><strong>6.1.</strong> The contractual and non-contractual liability of KARDEX both for its own actions and for the actions of its auxiliary persons is limited, to the extent permitted by law, to immediate and direct damages and to a total of 20% of the contractually agreed remuneration per delivery or service concerned. In the case of continuing obligations (e.g. service contracts under Part C), liability is limited, to the extent legally permitted, per contract year, to immediate and direct damages and to the amount of 50% of the annual remuneration payable for the product or service affected by the damage. In case the liability cap in accordance with the above calculations is below EUR 10,000 in individual cases, a liability cap of EUR 10,000 applies.</p>
                <p className="mb-1"><strong>6.2.</strong> If KARDEX or its auxiliary persons unlawfully and culpably damage items owned by the customer, KARDEX's liability shall, in deviation from section A.6.1., be governed exclusively by the provisions of article 41 et seqq. of the Swiss Code of Obligations (CO) and shall be limited, to the extent permitted by law, to EUR 500,000 per claim. KARDEX's liability for damages to the product itself or to product accessories is exclusively governed by section A.6.1.</p>
                <p className="mb-1"><strong>6.3.</strong> Further claims not expressly mentioned in this provision and these T&C for any legal reason, in particular but not limited to claims for compensation of indirect and/or consequential damages not incurred on the product itself as well as damages due to loss of production, capacity and data including their consequences, loss of use, loss of orders, loss of profit, damage to reputation and punitive damages are excluded.</p>
                <p className="mb-1"><strong>6.4.</strong> The contractual and non-contractual liability of KARDEX is also excluded for damages which are due to (i) incorrect information about operational and technical conditions or about the chemical and physical conditions for the use of the products provided by the customer, auxiliary persons and/or its advisors, or (ii) other actions, omissions of the customer, his auxiliary persons, advisors or third parties or other circumstances within the responsibility of the customer.</p>
                <p className="mb-1"><strong>6.5.</strong> The above limitations and exclusions of liability do not apply (i) in cases of injury to life, body or health, (ii) in cases of intent or gross negligence on the part of KARDEX or its auxiliary persons, and (iii) for claims from product liability under product liability laws to the extent these laws are mandatory to the legal relationship between the parties.</p>
                <p><strong>6.6.</strong> If third parties are injured by the customer's actions or omissions or if objects of third parties are damaged or third parties are otherwise damaged</p>
              </div>

              </div>
            </div>

            {/* Page 5 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={5} />
          </div>

          {/* Page 6 - General Terms Continued */}
          <div className="page page-6 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content terms-page">
              <div className="terms-content">
              
              {/* Continuation from previous page */}
              <p className="mb-1">and KARDEX is held liable for this, KARDEX has a right of recourse to the customer.</p>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">7. Intellectual Property</h4>
                <p className="mb-1"><strong>7.1.</strong> The customer may not use the intellectual property of KARDEX (in particular technical protective rights, brands and other signs, designs, knowhow, copyright to software and other works) for any purposes other than those expressly agreed between the parties.</p>
                <p className="mb-1"><strong>7.2.</strong> Without the express permission of KARDEX, the customer may not transfer or otherwise provide KARDEX Products to third parties without the attached brands.</p>
                <p><strong>7.3.</strong> Where KARDEX supplies software to the customer, the customer only acquires a simple, non-exclusive and non-transferrable right of use. The customer is not granted any right to edit the software.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">8. Data Protection</h4>
                <p className="mb-1"><strong>8.1.</strong> The protection of personal data is an important priority for KARDEX. KARDEX and the customer undertake to comply at all times with the applicable legal provisions on data protection. In particular, the customer assures that KARDEX is permitted to use personal data provided to them by the customer in accordance with this section A.8., and indemnifies and holds KARDEX fully harmless from any claims by the persons affected.</p>
                <p className="mb-1"><strong>8.2.</strong> KARDEX collects, processes and uses the customer's personal data for the performance of the contract. The customer's data will further be used for the purposes of future customer service, in which context the customer has the right to object in writing at any time. In addition, the customer's machines and operational data may be used and evaluated in anonymised form and user information on the customer's employees may be used in pseudonymized form for diagnosis and analysis purposes, and in anonymized form for the further development of KARDEX products and services (e.g. preventive maintenance). All data deriving from such analysis and diagnosis shall belong to KARDEX and may be freely used by KARDEX.</p>
                <p className="mb-1"><strong>8.3.</strong> The personal data of the customer will only be passed on to other companies (e.g. the transport company entrusted with the delivery) within the scope of contract processing and the provision of information technology and other administrative support activities. Otherwise, personal data will not be passed on to third parties. KARDEX ensures that companies that process personal data on behalf of KARDEX comply with the applicable legal provisions on data protection and that a comparable level of data protection is guaranteed, especially in the case of transfer abroad.</p>
                <p className="mb-1"><strong>8.4.</strong> The customer may contact KARDEX free of charge with any queries regarding the collection, processing or use of its personal data.</p>
                <p><strong>8.5.</strong> When using web-based products of KARDEX (such as customer portal, remote portal) personal data will be recorded. The collection, processing and use of such data can, upon customer's request, be governed by a separate data processing agreement.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">9. Confidentiality</h4>
                <p className="mb-1"><strong>9.1.</strong> Each of the parties undertakes to keep confidential all trade secrets and confidential information brought to their knowledge by the other party, in particular, all information on customer relationships and their details, other important information such as plans, service descriptions, product specifications, information on production processes and any other confidential information made available to it and/or otherwise disclosed by the other party in written or other form, and, in particular, not to make direct or indirect use thereof in business dealings and/or for competitive purposes, and/or pass it on to third parties in business dealings and/or for competitive purposes, and/or otherwise bring it directly or indirectly to the attention of third parties, either itself or through third parties.</p>
                <p className="mb-1"><strong>9.2.</strong> The confidentiality agreement does not apply where the information is publicly known, was already known to the other party when received, has been made available by third parties without any breach of a party's confidentiality obligation, or whose disclosure is mandatory under legal provisions, official orders or court orders, in particular judgments. The party wishing to invoke these exceptions bears the burden of proof in this regard.</p>
                <p><strong>9.3.</strong> The parties will place all persons whose services they use for providing services or who otherwise come into contact with confidential information as per section A.9.1 under a confidentiality obligation in accordance with sections A.9.1. and A.9.2.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">10. Severability</h4>
                <p>If any provision of the contract, including these T&C, are or become fully or partially unenforceable or invalid under applicable law, such provision shall be ineffective only to the extent of such unenforceability or invalidity and the remaining provisions of the contract or the T&C, respectively, shall continue to be binding and in full force and effect. Such unenforceable or invalid provision shall be replaced by such a valid and enforceable provision, which the parties consider, in good faith, to match as closely as possible the invalid or unenforceable provision and attaining the same or a similar economic effect. The same applies in case a gap (<em>Lücke</em>) becomes evident.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">11. Office Hours</h4>
                <p>Office hours are the usual working hours Monday - Friday, 9:00 a.m. - 6:00 p.m., with the exception of the public holidays at the registered office of KARDEX.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">12. Governing Law and Jurisdiction</h4>
                <p className="mb-1"><strong>12.1.</strong> These T&C and the entire legal relationship between the parties shall be governed by, and construed in accordance with, Swiss law, with exclusion of the United Nations Convention on Contracts for the International Sale of Goods.</p>
                <p><strong>12.2.</strong> Any dispute, controversy or claim arising out or in connection with the contract between the parties and/or these T&C, including their conclusion, validity, binding effect, breach, termination or rescission, shall be resolved by arbitration in accordance with the Swiss Rules of International Arbitration of the Swiss Chambers' Arbitration Institution. Regarding the time for service of initiation pleadings, the current text of the Rules of International Arbitration applies. The venue of the arbitration procedure is the city of Zurich, Switzerland. The language of the arbitration procedure is English or German.</p>
              </div>

              {/* Part B */}
              <div className="terms-part-header part-b mt-6">
                <h3>PART B: SPECIFIC PROVISIONS FOR DELIVERIES</h3>
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-2">1. Delivery</h4>
                <p className="mb-1"><strong>1.1.</strong> The subject-matter of delivery contracts is the delivery of systems, machines and/or software products and individually customised software in accordance with the specifications in the order confirmation handed over to the customer by KARDEX (each individually or collectively "<strong>Product(s)</strong>").</p>
                <p className="mb-1"><strong>1.2.</strong> Only the characteristics listed in the order confirmation are guaranteed features. Public statements, promotions and advertisements do not constitute guaranteed features of the Products. It is the customer's responsibility to assess whether or not the ordered Products are suitable for their intended purpose.</p>
                <p className="mb-1"><strong>1.3.</strong> Any quality guarantees in addition to features guaranteed in the order confirmation must be confirmed by KARDEX in writing.</p>
                <p><strong>1.4.</strong> KARDEX reserves the right to make design and/or shape changes to the Products if the Product thereafter deviates only insignificantly from the agreed quality and the changes are reasonable for the customer or if the customer agrees to the change of the agreed quality.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">2. Delivery Time</h4>
                <p className="mb-1"><strong>2.1.</strong> Delivery times are non-binding unless expressly confirmed as binding by KARDEX in writing.</p>
                <p className="mb-1"><strong>2.2.</strong> Delivery periods start with the dispatch of the order confirmation or receipt of the order in case there is no order confirmation, but not before the receipt of any advance payment or collateral to be provided by the customer.</p>
                <p className="mb-1"><strong>2.3.</strong> If subsequent change requests by the customer are accepted, the delivery period and delivery date are extended and postponed at least by the time required for implementation of the requested changes.</p>
                <p><strong>2.4.</strong> Delivery periods and delivery dates are met if on their expiry the Product has left the factory or notification of readiness for dispatch has been given. In the case of installation of Products, the delivery period is met by timely handover or acceptance of the installed Product. Delays beyond the control of KARDEX (e.g. failure by the customer to provide ancillary services, such as the provision of documents, permits and/or clearances to be obtained by the customer, ensuring the availability of a suitable lifting platform or opening the building) will at least result in a corresponding extension of the delivery period. KARDEX has the right to charge incurred cost from such delays.</p>
              </div>

              </div>
            </div>

            {/* Page 6 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={6} />
          </div>

          {/* Pages 7-11 - Terms Sections */}
          <div className="page page-7 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content terms-page">
              <div className="terms-content">
              {/* Part B Continued */}
              <div className="mb-4">
                <h4 className="font-semibold mb-2">2. Delivery Time (continued)</h4>
                <p className="mb-1"><strong>2.5.</strong> Force majeure, strikes, lockouts and other impediments beyond the control of KARDEX will extend and postpone agreed delivery periods and delivery dates by no more than the duration of the impediment, to the extent that such impediments can be proven to have a significant impact on completion or delivery of the Products or associated services. The same applies where the impediments to performance occur in the operations of KARDEX' upstream suppliers. KARDEX will further not be accountable for the above circumstances if they arise during an already existing delay. KARDEX will notify the customer without delay of the beginning and end of such impediments.</p>
                <p className="mb-1"><strong>2.6.</strong> If the dispatch of the Products is delayed at the customer's request, the customer will be invoiced as from one month after the notification of readiness for shipment issued by KARDEX for the resulting storage costs; in the case of storage in the factory, KARDEX may claim a storage fee in accordance with normal local rates. KARDEX is, however, entitled, after setting a reasonable deadline that has expired without effect, to use the Product otherwise, and to supply the customer with a similar product within a new delivery period.</p>
                <p><strong>2.7.</strong> Partial deliveries are permitted.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">3. Late Delivery</h4>
                <p className="mb-1"><strong>3.1.</strong> The customer's entitlement to compensation for damages caused by delay is dependent on prior notification of the delay in writing by the customer to KARDEX, and provision of proof of damage incurred as a result of the delay. The damages caused by delay will in any case be limited to a maximum of 0.1% of the consideration per expired week of delay, and to a maximum of 5% of the total consideration. Further compensation claims by the customer due to delay are excluded; this does not apply in the case of willful misconduct or gross negligence by KARDEX.</p>
                <p className="mb-1"><strong>3.2.</strong> The customer can only waive delivery and withdraw from the contract if, after the agreed delivery date has passed or the agreed delivery period has expired, (i) the customer sets KARDEX in writing two grace periods of reasonable length, whereby each grace period shall at least be 10 weeks, (ii) these two grace periods expire without success, and (iii) the customer, immediately after expiry of the second grace period, declares in writing that it waives delivery or withdraws from the contract.</p>
                <p><strong>3.3.</strong> To the extent permitted by law, all further claims and rights of the customer due to or in relation with the delay, in particular with respect to any further damages, are excluded.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">4. Place of Delivery; Transfer of Risk; Inspection Obligation</h4>
                <p className="mb-1"><strong>4.1.</strong> Unless expressly agreed otherwise, the Product will be delivered "FCA KARDEX factory" (Incoterms 2010).</p>
                <p className="mb-1"><strong>4.2.</strong> If an installation of the Product has been agreed, the Product will be delivered "DDP customer's factory" (Incoterms 2010), unless expressly agreed otherwise. In this case, the risk passes to the customer at the latest at the arrival of the Product at the customer's premises.</p>
                <p className="mb-1"><strong>4.3.</strong> If shipment is delayed in the situation according to section B.4.1. due to circumstances beyond the control of KARDEX, the use and risk of the Products will pass to the customer when the goods are ready for dispatch.</p>
                <p><strong>4.4.</strong> In the situation according to section B.4.2., the customer is required to inspect the Product for externally visible damage immediately upon its delivery and, if a transport damage is suspected, to provide a written and photographically documented report of the damage in due course so that the deadlines for making insurance claims can be met.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">5. Inspection and Acceptance</h4>
                <p className="mb-1"><strong>5.1.</strong> The customer is required to inspect the quality and quantity of the Product supplied immediately upon receipt. Any defects or incorrect deliveries must be reported immediately, but in any event within 10 days from receipt of the Product (or from detection in case of hidden defects), in detail in writing and with photographic documentation. If the report is submitted late, the deliveries will be deemed accepted and no warranty will apply.</p>
                <p className="mb-1"><strong>5.2.</strong> If an installation of the Product has been agreed, the customer is obliged to carry out an inspection and acceptance procedure on the Product as soon as KARDEX notifies the customer that the Products are ready for inspection. Defects must be recorded in a written report (customer acceptance certificate). Immediately after the acceptance inspection, KARDEX is to be sent a copy of the customer acceptance certificate and KARDEX is to be notified about any defects in a detailed written report. If the customer fails to meet this complaint notification obligation, all warranty claims will lapse.</p>
                <p className="mb-1"><strong>5.3.</strong> If acceptance is delayed for reasons beyond the control of KARDEX, the Product is deemed to be accepted 14 days after the receipt of the Products or, if it is a delivery with installation, the notification that the Products are ready for inspection. The Product is further deemed to be accepted if it is in productive use by the customer.</p>
                <p className="mb-1"><strong>5.4.</strong> If the Product shows only minor defects in the acceptance inspection, the customer may not refuse acceptance; instead, in this case the Product is deemed to be accepted.</p>
                <p><strong>5.5.</strong> With acceptance, KARDEX is no longer liable for any defects which could have been discovered on normal inspection and which are not listed in the customer acceptance certificate.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">6. Warranty</h4>
                <p className="mb-1"><strong>6.1.</strong> KARDEX warrants the delivery of Products free from defects. Products shall be deemed defective if (i) they are demonstrably afflicted with defects at the time of passing of risk which cancel or significantly reduce their value or (ii) guaranteed characteristics are not met.</p>
                <p className="mb-1"><strong>6.2.</strong> In the event of breach of warranty by KARDEX, KARDEX shall have the right and the duty to rectify the defect (<em>Nachbesserung</em>) within a reasonable deadline. If KARDEX's first attempt to rectify the defect is unsuccessful or if KARDEX does not take any action, the customer has to grant KARDEX a second reasonable deadline to rectify the defect. If the second attempt to rectify is unsuccessful or if KARDEX allows this second reasonable deadline to expire without taking any action, KARDEX, at its own discretion, shall offer the customer either replacement delivery or repair without charge.</p>
                <p className="mb-1"><strong>6.3.</strong> KARDEX is obliged to bear all costs necessary to rectify, repair or replace a defective Product, in particular costs for transport, labor and materials, unless such costs are increased due to the fact that the Product has been moved to a location other than the agreed place of delivery.</p>
                <p className="mb-1"><strong>6.4.</strong> If the rectification, replacement delivery or repair ultimately fails, the customer may claim a price reduction (<em>Minderung</em>). Only if the Product has physical defects that render it unsuitable for the intended purpose may the customer alternatively rescind the contract (<em>Wandelung</em>).</p>
                <p className="mb-1"><strong>6.5.</strong> If KARDEX has guaranteed a specified level of performance (throughput) or a specified availability of a device and, at the time of acceptance by the customer, the shortfall with respect to the guaranteed performance or availability is no more than 15%, the customer, to the extent permitted by law, shall not have the right to rescind the contract, request a replacement delivery or claim damages. As a remedy, KARDEX, at its own choice, shall offer the customer either rectification or a price reduction.</p>
                <p className="mb-1"><strong>6.6.</strong> If (a) KARDEX has guaranteed a specified level of performance (throughput) or availability of a device, (b) the customer subsequently changes the device specification or places additional orders, and (c) this reduces the performance or availability, the guaranteed values shall be deemed adjusted accordingly.</p>
                <p className="mb-1"><strong>6.7.</strong> The customer's warranty rights in case of supply of Products not in accordance with the contract become time-barred on the expiry of 12 months after delivery to the customer.</p>
                <p><strong>6.8.</strong> Warranty claims expire early if any attempted repairs or modification are carried out by untrained or uncertified personnel of the customer or untrained or uncertified third parties, if the Product is operated or maintained inappropriately or contrary to the manufacturer's instructions, or if the Product is moved by the customer to another location without the involvement of KARDEX.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">7. Prices and Payment Conditions</h4>
                <p className="mb-1"><strong>7.1.</strong> If the legal or regulatory requirements for the Product change after conclusion of the contract and this makes it significantly more difficult for KARDEX to deliver the Products in accordance with the contract, KARDEX may charge a reasonable increase of the consideration. An agreed delivery period, where applicable, will be extended by the delay resulting from the change.</p>
                <p><strong>7.2.</strong> In deviation from section A.4.2., the purchase price will be due for payment as follows: if KARDEX has undertaken to install the Product, 50% is payable upon placement of the order, 40% upon delivery (or no later than 30 days after notification of delivery) and 10% within 30 days of acceptance. If KARDEX has not undertaken to install the Product, the full purchase price is payable 30 days after supply and invoicing, without deduction. Advance</p>
              </div>

              </div>
            </div>

            {/* Page 7 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={7} />
          </div>

          {/* Page 8 - Part B Continued + Part C Start */}
          <div className="page page-8 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content terms-page">
              <div className="terms-content">
              
              {/* Continuation from previous page */}
              <p className="mb-1">and prepayments are payable within 10 days from date of the invoice without deduction.</p>
              <p className="mb-1"><strong>7.3.</strong> If the purchase price is specified in a currency other than in Euro, KARDEX is entitled to additionally charge the customer for any currency effects occurring between the order confirmation and the final invoice.</p>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">8. Spare Parts; Wear Parts; Maintenance Commitment</h4>
                <p className="mb-1"><strong>8.1.</strong> KARDEX gives the customer an assurance of the availability of non-electronic spare and wear parts ("Parts") for a period of 10 years, and electronic Parts for a period of 6 years, from the delivery of the Machine.</p>
                <p><strong>8.2.</strong> With respect to software, the maintenance commitment of KARDEX is subject to any maintenance contract concluded between KARDEX and the customer.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">9. Technical Support by the Customer</h4>
                <p className="mb-1"><strong>9.1.</strong> If the installation of the Product has been agreed, the customer is obliged to provide technical support at its own expense. This includes in particular:</p>
                <p className="mb-1">a) Any necessary underpinning or plugging of the steel framework and laying of the underfloor (screed flooring) after installation. The customer is to provide the installation surface for the Product at the new location in well-swept condition.</p>
                <p className="mb-1">b) Provision of and, if and to the extent requested by KARDEX in each particular case, operation and maintenance of the necessary equipment and heavy tools (e.g. scissor lift) as agreed with KARDEX, and the required auxiliary items and materials (e.g. underrays, wedges, lubricants, fuel, etc.).</p>
                <p className="mb-1">c) Provision of heating, lighting, site energy supply, water, including the necessary connections.</p>
                <p className="mb-1">d) Provision of suitable, burglar-proof personnel rooms and work rooms with heating, lighting, washing facilities and sanitary facilities, and first aid for the installation personnel.</p>
                <p className="mb-1">e) Transport of installation parts to the installation location, protection of the installation location and installation materials from harmful effects of all kinds, cleaning of the installation location.</p>
                <p className="mb-1">f) Provision of materials and carrying out any other actions required for initial adjustment of the Product and carrying out testing as specified in the contract.</p>
                <p className="mb-1">g) Ensuring the floor load capacity at the installation location, and providing an installation surface that is robust, level on all sides and horizontal.</p>
                <p className="mb-1">h) Prior to the start of installation, provide at the location of the machine as per relevant regulations the required energy supply, internet and data connection in accordance with KARDEX specifications.</p>
                <p className="mb-1">i) Providing the structural prerequisites for correct, problem-free installation (for example, moving of ventilation ducts, batten light fittings, water pipes, if these obstruct the installation of the Product).</p>
                <p className="mb-1"><strong>9.2.</strong> The technical support provided by the customer must be such as to ensure that the work on the providing services can begin immediately on the arrival of the KARDEX technician and can be carried out without delay until acceptance by the customer. The technician should be able to work at optimum capacity between 7:00 a.m. and 6:00 p.m. If special plans or instructions from KARDEX are needed for the installation, KARDEX will supply these to the customer sufficiently in advance.</p>
                <p className="mb-1"><strong>9.3.</strong> The customer will provide, when needed, assistance to the KARDEX technician on site with its own personnel to the best of its ability; this applies in particular where work is to be carried out that a single person cannot reasonably be expected to perform, or that cannot be carried out safely by a single person. KARDEX cannot be charged for such assistance. The customer is to confirm the work carried out by the KARDEX technician by signing off the technician's work report.</p>
                <p><strong>9.4.</strong> If the customer fails to meet its obligations, KARDEX, after issuing a non-compliance notice, is entitled, but not obliged, to carry out the actions incumbent on the customer in the customer's place, and at customer's expense, or have them carried out by third parties. In addition, there can be no delay on the part of KARDEX to the extent and for as long as the customer has failed to meet its obligations.</p>
              </div>

              {/* Part C */}
              <div className="terms-part-header part-c mt-6">
                <h3>PART C: PROVISIONS FOR LIFE CYCLE SERVICES</h3>
              </div>
              
              <p className="mb-2">The terms and conditions for Life Cycle services are arranged in three major parts. Part C1 contains general definitions, Part C2 describes the terms and conditions for individual services and Part C3 outlines the terms and conditions for service contracts.</p>

              <h4 className="font-semibold mb-2 mt-4">C1: General Definitions</h4>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-2">1. Individual Service Orders</h4>
                <p className="mb-1"><strong>1.1.</strong> Subject matter of individual service orders is the provision of individual services, such as repairs, installations and commissioning without delivery of a system, relocation of a system, maintenance, modifications, retrofits and upgrades of any Product as delivered under Part B (hereinafter referred to individually or collectively as "<strong>Individual Service(s)</strong>" or "<strong>Individual Order</strong>").</p>
                <p><strong>1.2.</strong> The scope of services is determined in the subsequent provisions as well as in the order confirmation, which specify (a) the services to be provided, (b) the system, machine and/or software (hereinafter referred to individually or collectively as "<strong>Product(s)</strong>") for which the services are to be provided, (c) place of delivery and delivery times, and (d) the remuneration owed therefor.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">2. Service Contract</h4>
                <p className="mb-1"><strong>2.1.</strong> The subject matter of a service contract is the performance of maintenance, repair work or other services ("<strong>Maintenance</strong>" or "<strong>Service(s)</strong>") on Products over several years.</p>
                <p><strong>2.2.</strong> The scope of the services is determined by the service contract, specifying (a) the chosen service package (BASE, FLEX or FULL Care), (b) the Products for which Maintenance is to be provided, and (c) the remuneration payable as the annual fee.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">3. Response Times</h4>
                <p>"<strong>Helpdesk Reaction Time</strong>" is defined as the time from when the customer's fault report is received by the KARDEX Central Call Desk ("CCD") to when KARDEX Remote Support or telephone-based service begins. "<strong>OnSite Reaction Time</strong>" is defined as the time from when the customer's fault report is received by the CCD to the service technician's arrival on site. Only the reaction time during normal office hours is relevant, with continuation on the next working day, where applicable. Times outside normal office hours will not be taken into account when calculating the response time, unless an extended "Onsite & Helpdesk support" is agreed upon in the corresponding service contract. KARDEX guarantees to the customer that it will meet response times as described in the service contract.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">4. Fault Reports</h4>
                <p className="mb-1"><strong>4.1.</strong> All faults must be reported to KARDEX by telephone, online or using the Remote Help Request button, so that recording and classification of the fault can be undertaken within the Helpdesk Reaction Time, and so that the necessary arrangements can be initiated without delay.</p>
                <p className="mb-1"><strong>4.2.</strong> The elimination of the fault is carried out by telephone support, Remote Support (if agreed) or an on-site callout of a technician. The choice of the suitable measure(s) is at the sole discretion of KARDEX.</p>
                <p className="mb-1"><strong>4.3.</strong> If a customer submits fault reports outside the contractually agreed On-site & Helpdesk support hours, KARDEX is not obligated to initiate a service intervention such as telephone support, Remote Support or an on-site callout. If an on-site callout does, however, take place, the customer will be charged at double the applicable hourly rate of the KARDEX customer service.</p>
                <p className="mb-1"><strong>4.4.</strong> KARDEX is obliged to investigate a fault only if it has been properly reported by the customer, and if the fault at the client's location is reproducible or can be demonstrated by machine-generated outputs.</p>
                <p className="mb-1"><strong>4.5.</strong> For software fault special conditions apply. A software fault is present only if the use of core functions of the software is impossible or severely impaired, and/or</p>
                <ul className="list-disc pl-6 mb-1">
                  <li>the software produces incorrect results, which cannot be attributed to operating errors by the customer; or</li>
                  <li>there is an uncontrolled interruption of the running of the software that is not caused by a program interface; or</li>
                  <li>use of the software is severely impaired or prevented in another manner contrary to correct functionality.</li>
                </ul>
              </div>

              </div>
            </div>

            {/* Page 8 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={8} />
          </div>

          {/* Page 9 - C2 Individual Services */}
          <div className="page page-9 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content terms-page">
              <div className="terms-content">
              
              {/* Continuation from previous page */}
              <p className="mb-1"><strong>1.1.</strong> A software fault is not present in the case of problems for which the cause cannot be attributed to software supplied by KARDEX, but in particular rather to the software of other manufacturers, the customer's hardware or operating system, the database or a parameterisation error on the part of the customer.</p>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">5. Timing / Agreement on Dates</h4>
                <p className="mb-1"><strong>5.1.</strong> If the customer cancels or postpones a service intervention arranged less than 48 hours before the start of the intervention, the customer is required to bear the costs associated therewith at the usual KARDEX rates.</p>
                <p><strong>5.2.</strong> KARDEX is entitled to invoice the costs for unnecessary travel to the customer's location or on-site waiting times in excess of 30 minutes separately at the usual KARDEX customer service hourly rates applicable at the time of the scheduled intervention.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">6. Liability</h4>
                <p className="mb-1"><strong>6.1.</strong> To the extent permitted by law, KARDEX will not be liable for damage resulting from incorrect use of the Products, telephone or electronic transmission failures, faulty execution of support instructions by the customer, attempted repairs carried out by the customer itself or third parties, service parts not being available on site, untrained or unauthorised staff of the customer or third parties, or delay in reaching the on-duty service technician because of being engaged in another service intervention. Nor will KARDEX be liable for the consequences of any loss of data.</p>
                <p><strong>6.2.</strong> To the extent permitted by law, any liability for merchandise and goods stored in the Products is excluded.</p>
              </div>

              <div className="terms-part-header part-c-sub mt-4">
                <h3>C2: INDIVIDUAL SERVICES</h3>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">1. Individual Services Contain the Following Services</h4>
                <p className="mb-1"><strong>1.1.</strong> Installation and Commissioning Service to install newly and/or rebuild the Product by skilled technicians. This may include operation and/or maintenance training of customer personnel.</p>
                <p className="mb-1"><strong>1.2.</strong> On-site support intervention for repair and recommissioning after a break down or loss of productivity. On-Site Services include the provision of labor by skilled technicians, materials such as spare parts, wear parts and consumables, travel costs and fees for daily allowance, as well as special fees for outside office hours call outs.</p>
                <p className="mb-1"><strong>1.3.</strong> Remote Support or telephone support interventions are designed to enable the customer to bring back its system to normal operation in a short period of time and to therefore increase the operating time. The continuous monitoring via Remote Support can even prevent downtimes.</p>
                <p className="mb-1"><strong>1.4.</strong> Relocation Service of KARDEX offers its customers the relocation and moving of the products manufactured by KARDEX, either within the same or to a different site, within domestic territory or abroad ("<strong>Relocation Service</strong>"). The Relocation Service comprises the dismantling of the Product at the old location, transport of the components from the old to the new location (if so agreed), interim storage of the components (if so agreed), installation at the new location, and commissioning of the Product. The relocation service does not include the rectification of defects and the replacement of wear parts, both of which require the placement of a separate order against a separate fee to be executed and handled independently from the relocation service. If the new location is in a different country than the old location, the customer is required to perform all the actions necessary for transportation to the other country and also the operation in the other country. The customer bears all the costs arising in this context (necessary modification of the Product, customs, clearance fees, etc.). Necessary modifications to the Product require a separate order for Individual Services (for a separate fee). The customer has to remove all the contents (goods in storage) from the Product, before relocation can take place.</p>
                <p className="mb-1"><strong>1.5.</strong> Training services are designed to empower the customer's staff to operate the system according to its intended use, to increase the adherence to safe working methods and to positively influence the system's overall availability and performance.</p>
                <p className="mb-1"><strong>1.6.</strong> Maintenance and Safety Tests are intended to maintain the system's reliability, to prevent unexpected break downs, to ensure the testing of safety equipment on a regular and professional basis as well as to reduce premature loss of the system's value.</p>
                <p className="mb-1"><strong>1.7.</strong> Modification services are intended to adapt the system to the changes implied by the customer's business operation in mechanics and software to ensure that it meets changed operational requirements.</p>
                <p className="mb-1"><strong>1.8.</strong> Upgrade and Retrofit Services are intended to bring the system up-to-date with the latest technology, with regards to mechanics and software.</p>
                <p><strong>1.9.</strong> The Spare Part Delivery Service is intended to enable the customer to purchase single parts to be fitted into the customer's systems or spare part packages with carefully selected assortments of parts which are stored at the customer's premises to ensure their availability in case of an on-site intervention.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">2. Use of Third Party Sub-Contractors</h4>
                <p>In order to meet its obligations under Individual Services, KARDEX may make use of the services of third parties. KARDEX is not obliged to perform the Individual Service itself. If KARDEX makes use of a third party, KARDEX will by means of suitable contractual provisions with such party that the obligations of KARDEX under the Individual Service are fulfilled by the third party.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">3. Unauthorized Intervention in Kardex Systems</h4>
                <p>The customer is obliged to inform KARDEX before KARDEX commences its work about any external or internal work or renewal of parts carried out on the Product by the customer or third parties, whereby KARDEX is entitled to request a thorough chargeable inspection of such amended or renewed Product or decline to perform the Individual Service.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">4. Technical Support by the Customer</h4>
                <p>The customer is obliged to provide technical support to KARDEX for the performance of the Individual Service at its own expense. Section B.10. applies accordingly in the case of an installation order or relocation order.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">5. Acceptance</h4>
                <p className="mb-1"><strong>5.1.</strong> As soon as KARDEX notifies the customer of the completion of the Individual Service, the customer must carry out an acceptance inspection of the performed services and/or delivered products. The results of such acceptance inspection including a detailed report of any defects are to be recorded in writing in a customer acceptance certificate, a signed copy of which must be immediately handed over/sent to KARDEX. If the customer fails to meet this complaint notification obligation, the respective warranty claims will lapse.</p>
                <p className="mb-1"><strong>5.2.</strong> If acceptance is delayed for reasons beyond the control of KARDEX, the Products are deemed to be accepted 14 days after notification of completion by KARDEX. KARDEX is entitled to invoice the cost incurred from such delays.</p>
                <p className="mb-1"><strong>5.3.</strong> If only minor defects are found in the acceptance inspection, the customer may not refuse acceptance. In such case, the Individual Service shall be deemed accepted.</p>
                <p><strong>5.4.</strong> With acceptance, KARDEX is no longer liable for any defects which could have been discovered on normal inspection and which are not listed in the customer acceptance certificate.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">6. Warranty</h4>
                <p className="mb-1"><strong>6.1.</strong> KARDEX warrants the faultless provision of the services in accordance with the legal regulations, the applicable norms and directives as well as the recognized rules of technology.</p>
                <p className="mb-1"><strong>6.2.</strong> In the event of breach of warranty by KARDEX, KARDEX shall have the right and the duty to rectify the defect (<em>Nachbesserung</em>) within a reasonable deadline. If KARDEX' first attempt to rectify the defect is unsuccessful or if KARDEX does not take any action, the customer has to grant KARDEX a second reasonable deadline to rectify the defect. If the second attempt to rectify is unsuccessful or if KARDEX allows this second reasonable deadline to expire without taking any action, the customer is entitled to claim a reduction of the remuneration (<em>Minderung</em>). The customer is also entitled to claim a reduction of the remuneration if KARDEX seriously and ultimately refuses to carry out the rectification from the outset. However, the customer may only withdraw from the contract if the services carried out by KARDEX repeatedly show serious defects and if KARDEX repeatedly fails to remedy breaches of warranty in accordance with this provision.</p>
                <p className="mb-1"><strong>6.3.</strong> The customer's warranty rights expire 6 months after acceptance.</p>
                <p><strong>6.4.</strong> Warranty is voided in case of: (a) improper or unintended use, (b) faulty installation or commissioning by the customer or a third party, (c)</p>
              </div>

              </div>
            </div>

            {/* Page 9 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={9} />
          </div>

          {/* Page 10 - C2 Continued, C3 Service Contracts */}
          <div className="page page-10 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content terms-page">
              <div className="terms-content">
              
              {/* Continuation from previous page */}
              <p className="mb-1">modification, maintenance, repair or relocation of the Product by the customer or a third party, (d) excessive wear and tear due to circumstances within the customer's control, (e) faulty operation or negligent treatment of the Products, (f) use of inappropriate service fluids or replacement materials, (g) faulty construction or unsuitable soil on the customer's premises, (h) chemical or electronic effects, if these are not due to fault of KARDEX, (i) untrue indications by the customer or its advisors on the operational and technical conditions for the use of the products, and (j) cases of force majeure such as natural disasters, acts of war or acts of terrorism.</p>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">7. Remuneration</h4>
                <p className="mb-1"><strong>7.1.</strong> The remuneration for Individual Services will be charged on a time and material basis according to KARDEX's current price list, unless a lump sum fee has been expressly agreed.</p>
                <p className="mb-1"><strong>7.2.</strong> KARDEX has the right to charge the customer any costs for unnecessary travel to the customer or if the Individual Service could not be performed for reasons for which the customer is responsible.</p>
                <p><strong>7.3.</strong> Any waiting times caused by the customer's lack of support can be charged by KARDEX to the customer.</p>
              </div>

              <div className="terms-part-header part-c-sub mt-6">
                <h3>C3: SPECIFIC PROVISIONS FOR SERVICE CONTRACTS</h3>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">1. Service Packages</h4>
                <p className="mb-1"><strong>1.1.</strong> The services provided by KARDEX in the context of service contracts are determined by the product and service descriptions of the Service Contract, the technical requirements, the specified maintenance intervals as well as the defined software upgrades, service releases and software updates. Such services can include all products delivered under Part B. Unless otherwise specified, the scope of service does not include the performance of all work and the installation of spare parts required for restoration of normal operational readiness of the Product in accordance with a professional assessment and the recognised code of practice.</p>
                <p className="mb-1"><strong>1.2.</strong> In general, KARDEX will carry out maintenance work during normal office hours. To have access to services outside normal office hours, the customer can opt for the "FLEX Care" or "FULL Care" service packages, which must be ordered separately.</p>
                <p className="mb-1"><strong>1.3.</strong> Without prejudice to the warranty under delivery contracts, KARDEX does not provide any warranty that the Product will remain free of defects and/or will function without interruption during the term of the service contract. The warranty for services provided by KARDEX is based on section C3.4.</p>
                <p className="mb-1"><strong>1.4.</strong> The inclusion of a Product in a service contract requires that the Product and its components are in a technically perfect condition and that the customer has acquired a right to use the current version of the software. Products for which the warranty commencing on delivery has already expired will only be included in the service contract after they have been subjected to an inspection by KARDEX. The costs for the inspection and any expenses incurred for bringing the Product to be included back into a proper condition shall be borne by the customer, according to the applicable rates and price lists.</p>
                <p><strong>1.5.</strong> The KARDEX remote support portal ("<strong>KARDEX Remote Support</strong>") allows the condition of the product to be monitored by the assessment of technical data from the control unit. All personal data and customer related data exchanged in the context of the services will be used exclusively for the purposes defined in these terms of use. A connection to the KARDEX Remote Support does not guarantee that malfunctions can be diagnosed or eliminated by means of the KARDEX Remote Support. If the malfunction cannot be solved by means of KARDEX Remote Support, KARDEX will send a service technician to the concerned Product to eliminate the malfunction and will separately charge its services pursuant to the applicable rates and price lists.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">2. Customer Obligations</h4>
                <p className="mb-1"><strong>2.1.</strong> The customer shall treat and use the Product in accordance with KARDEX operating recommendations. The customer shall enable KARDEX to eliminate malfunctions arising due to incorrect operation, at the customer's expense.</p>
                <p className="mb-1"><strong>2.2.</strong> Faults are to be reported solely by the customer authorised person commissioned with operating the machine in accordance with the KARDEX operator manual to the on-duty KARDEX service technician. The fault report must be submitted from the location of the Product concerned using a suitable means of communication, specifying the Product name, the model and series or license number and the best possible description of the fault. The disclosure of KARDEX contact details or premises access codes to any third parties is expressly prohibited in the interests of ease of access. The customer is obliged to keep his technical equipment available in such a way that the support by KARDEX via telephone or KARDEX Support Portal is possible. Connection costs shall be borne by the customer.</p>
                <p className="mb-1"><strong>2.3.</strong> With the conclusion of a KARDEX Remote Support contract, the customer undertakes to provide a functional data transmission device (remote connection for KARDEX Remote Support), sufficiently protected against unauthorized third-party access, to allow KARDEX appropriate access to the customer's system for support tasks. As a prerequisite for this, the customer must provide KARDEX the required authorisations. Remote support is carried out via a suitable separate remote service software application, such as the KARDEX Remote Support application, or in exceptional cases, TeamViewer. Any data transmission costs incurred and any other costs arising from remote service are borne by the customer. Further details on this may be provided in the support contract. If the customer does not have data transmission facilities as defined above available, the customer shall reimburse KARDEX for the resulting increased expense. KARDEX is relieved from its duty to perform remote service, if – for reasons for which KARDEX is not responsible – no connection can be established from the system.</p>
                <p className="mb-1"><strong>2.4.</strong> When required, the customer will support the KARDEX service technician on site with its own personnel to the best of its ability and to a reasonable extent; this applies in particular if the work to be carried out is beyond what a single person can reasonably be expected to do, or can do safely. There is no reimbursement claim against KARDEX for this. The customer will sign off the work done by the KARDEX service technical on the technician's work report, as the basis for invoicing.</p>
                <p className="mb-1"><strong>2.5.</strong> The customer must ensure that the Products are exclusively available at the agreed timeslot to the KARDEX service technician executing the service, and that they can be shut down from operation for this purpose.</p>
                <p className="mb-1"><strong>2.6.</strong> During the term of the service contract, the customer is obliged to have all maintenance and repairs on the Products carried out solely by KARDEX or an authorised subcontractor of KARDEX. Where applicable, it is to inform KARDEX of any prior work on the Products itself or parts replacements carried out by the customer itself or third parties, before the work starts. In such cases, KARDEX is entitled to require a thorough check of the Products in question or otherwise to decline to perform the service.</p>
                <p className="mb-1"><strong>2.7.</strong> The customer will not change the location of the Product without prior written notice to KARDEX. Upon request, and at the customer's expense, KARDEX will carry out or supervise the relocation. If the customer does not have the relocation carried out or supervised by KARDEX, KARDEX services under the service contract will be suspended during the relocation and KARDEX will perform a system audit to ensure the correct and safe functionality of the Products before reinstating the services. Such a system audit will be charged separately according to the applicable rates and price lists. Any damages caused by an improper relocation will not be covered by the service packages.</p>
                <p className="mb-1"><strong>2.8.</strong> The customer undertakes to actively accompany and support KARDEX in case of a maintenance issue in fault diagnosis and elimination conducted in the context of the KARDEX Remote Support. The customer notifies to KARDEX in writing qualified employees educated by KARDEX as contact persons authorized to perform and take all actions and decisions for the customer which are necessary in connection with the ordinary use. The contact person remains with the Product during the whole process of remote service ready to intervene, where appropriate, e.g. by operating the emergency shutdown. The customer is solely responsible for taking the necessary safety precautions to ensure that persons and property are not endangered during maintenance.</p>
                <p><strong>2.9.</strong> Employees of the customer require a password for the use of the KARDEX Remote Support. Every person, legitimating him or herself via password, is deemed to be authorized towards KARDEX, and all entries and instructions based on a formally error free legitimization will be attributed to the customer.</p>
              </div>

              </div>
            </div>

            {/* Page 10 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={10} />
          </div>

          {/* Page 11 - C3 Remuneration, Warranty, Termination */}
          <div className="page page-11 shadow-2xl print:shadow-none mb-10 print:mb-0">
            <KardexLogo />

            <div className="page-content terms-page">
              <div className="terms-content">
              <div className="mb-4">
                <h4 className="font-semibold mb-2">3. Remuneration for Service Contracts</h4>
                <p className="mb-1"><strong>3.1.</strong> An annual fee is charged for the services specified in the service contract, the amount of which depends on the selected service packages (BASE, FLEX, or FULL Care).</p>
                <p className="mb-1"><strong>3.2.</strong> The first annual fee is invoiced on the signing of the service contract, and thereafter before the start of each contract year.</p>
                <p className="mb-1"><strong>3.3.</strong> KARDEX reserves the right to increase or decrease the annual fee. If the increase is more than 5% of the agreed annual fee, the customer has an extraordinary right of termination for cause. The customer may then terminate the contract early, within one month of receiving the invoice for the increased annual fee, to take effect for the first contract year to which the increased annual fee applies.</p>
                <p className="mb-1"><strong>3.4.</strong> KARDEX is entitled to charge the customer for unnecessary travel to the customer's location or if the service or part of the service cannot be performed on site if the customer is responsible for the impediment. If the customer, according to the service contract, has undertaken to keep certain parts in stock or if the customer failed to order from KARDEX the parts necessary for the service as specified by KARDEX, the customer may be charged for any waiting times caused by the required service parts not being available on site.</p>
                <p><strong>3.5.</strong> Additional inspections following the repair of Products or the replacement of missing technical documents or service booklets are not included in the annual fee and will be invoiced separately at the hourly rates of KARDEX customer service applicable the time.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">4. Warranty</h4>
                <p className="mb-1"><strong>4.1.</strong> KARDEX warrants the faultless provision of the Services in accordance with the relevant rules of law, the applicable norms and regulations and the recognised rules of technology.</p>
                <p className="mb-1"><strong>4.2.</strong> In the event of breach of warranty by KARDEX, KARDEX shall have the right and the duty to rectify the defect (<em>Nachbesserung</em>) within a reasonable deadline. If KARDEX's first attempt to rectify the defect is unsuccessful or if KARDEX does not take any action, the customer has to grant KARDEX a second reasonable deadline to rectify the defect. If the second attempt to rectify is unsuccessful or if KARDEX allows said reasonable deadlines to expire without taking any action, the customer is entitled to claim a reduction of the remuneration for the improperly rendered service (<em>Minderung</em>). The customer is also entitled to claim a reduction of the remuneration if KARDEX seriously and ultimately refuses to carry out the rectification from the outset. The customer has a right to withdraw from the contract only if the services carried out by KARDEX repeatedly show serious defects and if KARDEX repeatedly fails to remedy breaches of warranty in accordance with this provision.</p>
                <p className="mb-1"><strong>4.3.</strong> The warranty runs as from acceptance of the service. The customer is obliged to immediately inspect and accept any service performed for defects and to immediately notify KARDEX in writing of any defects. The customer's warranty claims are forfeited to the extent that it fails to meet this obligation to raise a complaint.</p>
                <p className="mb-1"><strong>4.4.</strong> The customer's warranty rights expire 6 months after acceptance.</p>
                <p className="mb-1"><strong>4.5.</strong> The warranty is excluded if work or attempted repairs are carried out on the Products by maintenance companies not approved by KARDEX, unless KARDEX has genuinely and definitively refused to remedy the defect.</p>
                <p><strong>4.6.</strong> Unless explicitly agreed otherwise, KARDEX does not warrant that maintenance and inspections will be carried out within a particular time frame. KARDEX further does not warrant that in the case of KARDEX Remote Support a third party does not gain unauthorized access to the Products.</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">5. Term and Termination of the Service Contract</h4>
                <p className="mb-1"><strong>5.1.</strong> The service contract enters into force at the time specified in the service contract and has an initial term of 2 years.</p>
                <p className="mb-1"><strong>5.2.</strong> It will be extended by further periods of one year in each case unless terminated in writing by either party, with at least 3 months' notice to the end of the respective contractual period.</p>
                <p className="mb-1"><strong>5.3.</strong> The service contract may be terminated in writing for cause by either party with immediate effect if one of the contracting parties has significantly breached its obligations under the service contract and fails to remedy the breach, in spite of a compliance notice from the other party giving it a deadline of 2 weeks to do so. Section C3.4 shall apply to breaches of duty in connection to warranty claims.</p>
                <p><strong>5.4.</strong> KARDEX may demand that individual Products be excluded from the service contract after a notice period of 3 months, if the Products concerned can no longer be properly maintained because of excessive wear and tear, excessive efforts and lack of availability of spare parts or obsolescence (section B.9.).</p>
              </div>

              </div>
            </div>

            {/* Page 11 Footer */}
            <PageFooter productType={offer?.productType} pageNumber={11} />
          </div>

      {/* Modern PDF/Word-friendly Styles */}
      <style jsx global>{`
        /* ==================== DOCUMENT CONTAINER ==================== */
        .quotation-document {
          max-width: 100%;
          background: white;
          font-family: 'Arial', 'Helvetica', sans-serif;
        }

        .document-container {
          max-width: 210mm; /* A4 width */
          margin: 0 auto;
          background: transparent;
        }

        /* ==================== PAGE STRUCTURE ==================== */
        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 20mm;
          margin: 0 auto;
          background: white;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Full-width for premium pages */
        .page-2, .page-3-premium, .page-4-premium {
          padding: 12mm 8mm !important;
        }

        .page + .page {
          page-break-before: always;
          break-before: page;
        }

        .page-content {
          flex: 1;
          padding-bottom: 15mm; /* Space for footer */
        }

        /* Page 2 specific - reduce bottom padding */
        .page-2 .page-content {
          flex: 0 1 auto;
          padding-bottom: 2mm;
        }

        /* Page 5 specific - reduce padding for two-column layout */
        .page-5 .page-content {
          padding-bottom: 10mm;
        }

        /* ==================== PAGE 1 - ENHANCED STYLING ==================== */
        .quote-title-section {
          text-align: center;
          margin-bottom: 20px;
        }

        .quote-main-title {
          margin: 0;
        }

        .quote-title-badge {
          display: inline-block;
          background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%);
          color: white;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 12px rgba(68, 114, 196, 0.3);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Simple underlined blue title - matches document */
        .quote-title-underlined {
          color: #1e5f8b;
          font-size: 18px;
          font-weight: 400;
          text-decoration: underline;
        }

        /* Simple header layout - Reference on left, GST on right */
        .quote-header-simple {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          font-size: 12px;
        }

        .quote-ref-info {
          text-align: left;
        }

        .quote-ref-info p,
        .quote-gst-info p {
          margin: 2px 0;
          font-size: 11px;
        }

        .quote-gst-info {
          text-align: right;
        }

        /* Simple customer details */
        .customer-details-simple {
          margin-bottom: 12px;
          font-size: 11px;
        }

        .customer-details-simple p {
          margin: 2px 0;
        }

        /* Kind attention section - blue color */
        .kind-attention-section {
          margin-bottom: 12px;
        }

        .kind-attention-text {
          color: #1e5f8b;
          font-size: 11px;
          margin: 0;
        }

        /* Simple subject section */
        .subject-section-simple {
          margin-bottom: 12px;
          font-size: 11px;
        }

        .subject-section-simple p {
          margin: 0;
        }

        /* Simple introduction section */
        .introduction-section-simple {
          margin-bottom: 16px;
          font-size: 11px;
        }

        .introduction-section-simple p {
          margin: 0;
          line-height: 1.5;
        }

        /* Section labels */
        .section-label {
          font-size: 11px;
          margin: 0 0 8px 0;
        }

        .quote-header {
          margin-bottom: 16px;
        }

        .quote-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .quote-info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .quote-info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 12px;
        }

        .quote-info-row:last-child {
          margin-bottom: 0;
        }

        .quote-label {
          color: #64748b;
          font-weight: 500;
        }

        .quote-value {
          color: #1e293b;
          font-weight: 600;
        }

        .quote-tax-info {
          text-align: right;
        }

        .tax-details {
          background: #f1f5f9;
          border-radius: 8px;
          padding: 10px 14px;
          display: inline-block;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .tax-row {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 11px;
        }

        .tax-row:last-child {
          margin-bottom: 0;
        }

        .tax-label {
          background: #75242D;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 10px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .tax-value {
          color: #374151;
          font-weight: 500;
        }

        /* Customer Details Card */
        .customer-details-card {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          border-left: 4px solid #4472C4;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 16px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .customer-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px dashed #cbd5e1;
        }

        .customer-icon {
          font-size: 16px;
        }

        .customer-label {
          font-size: 11px;
          font-weight: 600;
          color: #4472C4;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .customer-content {
          font-size: 12px;
          color: #374151;
        }

        .customer-name {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .customer-address,
        .customer-location {
          margin-bottom: 2px;
          color: #4b5563;
        }

        .customer-contact {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #cbd5e1;
        }

        .contact-label {
          font-weight: 600;
          color: #64748b;
        }

        .contact-name {
          font-weight: 600;
          color: #1e293b;
        }

        /* ==================== PAGE 2 - PREMIUM STYLING ==================== */
        .premium-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 12px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 6px;
        }

        .header-icon {
          font-size: 18px;
        }

        .terms-card-premium {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .terms-grid-premium {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .terms-grid-premium li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12px;
          color: #334155;
          line-height: 1.4;
        }

        .terms-grid-premium .bullet {
          color: #4472C4;
          font-size: 8px;
          margin-top: 4px;
        }

        .other-terms-highlight {
          background: #eff6ff;
          border: 1px dashed #3b82f6;
          padding: 10px;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 20px;
          font-size: 11px;
          color: #1e40af;
        }

        .notes-grid-premium {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .note-item-premium {
          display: flex;
          gap: 12px;
          background: white;
          border: 1px solid #f1f5f9;
          padding: 10px;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .note-num {
          background: #fef3c7;
          color: #d97706;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-weight: 700;
          font-size: 11px;
          flex-shrink: 0;
        }

        .note-item-premium p {
          font-size: 10.5px;
          line-height: 1.4;
          margin: 0;
          color: #475569;
        }

        .assurance-card-premium {
          background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%);
          color: white;
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(68, 114, 196, 0.2);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .assurance-icon {
          font-size: 32px;
        }

        .assurance-text p {
          font-size: 12px;
          margin: 0;
          line-height: 1.5;
          font-style: italic;
          opacity: 0.95;
        }

        .order-release-premium {
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .release-title {
          font-size: 11px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
        }

        .company-name-large {
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;
          margin: 0 0 4px 0;
        }

        .company-address-text {
          font-size: 12px;
          color: #475569;
          margin-bottom: 8px;
        }

        .company-contact-row {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: #64748b;
        }

        .signature-footer-premium {
          border-top: 2px solid #f1f5f9;
          padding-top: 16px;
        }

        .undertime-text {
          font-size: 11px;
          font-style: italic;
          color: #64748b;
          margin-bottom: 4px;
        }

        .faithfully-text {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 12px;
        }

        .signature-display-premium {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .sig-image-container {
          width: 200px;
          height: 60px;
          border-bottom: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sig-img {
          max-width: 100%;
          max-height: 100%;
          object-contain: true;
        }

        .sig-placeholder {
          font-size: 10px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .sig-details p {
          margin: 0;
          line-height: 1.3;
        }

        .sig-name {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }

        .sig-contact, .sig-email {
          font-size: 11px;
          color: #64748b;
        }

        .company-info {
          margin-top: 8px;
          font-size: 11px;
        }

        .company-info p {
          margin: 2px 0;
        }

        .important-notes-section {
          margin-bottom: 12px;
        }

        .notes-card {
          background: linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%);
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 10px 14px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .notes-list-enhanced {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .notes-list-enhanced li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 10px;
          color: #374151;
          margin-bottom: 5px;
          line-height: 1.35;
        }

        .notes-list-enhanced li:last-child {
          margin-bottom: 0;
        }

        .note-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: #d97706;
          color: white;
          font-size: 9px;
          font-weight: 700;
          border-radius: 50%;
          flex-shrink: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .highlight-text {
          background: #fde047;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          color: #92400e;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ==================== PAGE 3 & 4 PREMIUM REDESIGN ==================== */
        .premium-page-header {
          text-align: center;
          position: relative;
        }

        .premium-main-title {
          font-size: 22px;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .premium-subtitle {
          font-size: 13px;
          color: #64748b;
          max-width: 800px;
          margin: 0 auto;
        }

        .premium-title-underline {
          width: 60px;
          height: 4px;
          background: #4472C4;
          margin: 12px auto 0;
          border-radius: 2px;
        }

        /* Page 3 Styles */
        .service-products-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .service-product-card-premium {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 40px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.08);
          page-break-inside: avoid;
        }

        .service-card-image {
          position: relative;
          height: 100%;
          min-height: 160px;
          background: #f1f5f9;
        }

        .service-card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .service-card-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(30, 41, 59, 0.8);
          backdrop-filter: blur(4px);
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .service-card-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .service-card-title {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .service-card-intro {
          font-size: 13px;
          font-weight: 600;
          color: #4472C4;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .service-card-description {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }

        .services-list-premium {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .service-list-item {
          font-size: 11px;
          color: #475569;
          display: flex;
          gap: 6px;
          align-items: flex-start;
        }

        .service-list-item span {
          color: #4472C4;
          font-weight: bold;
        }

        /* Page 4 Styles */
        .package-hero-section {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 40px;
          align-items: center;
          margin-bottom: 30px;
          background: #f1f5f9;
          padding: 30px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
        }

        .package-diagram-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .diagram-wrapper {
          width: 100%;
          max-width: 520px;
          background: white;
          padding: 15px;
          border-radius: 50%;
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1);
        }

        .main-diagram-img {
          width: 100%;
          height: auto;
          display: block;
        }

        .package-highlights {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .highlight-item {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .highlight-number {
          font-size: 20px;
          font-weight: 800;
          color: #cbd5e1;
        }

        .highlight-text-pkg {
          display: flex;
          flex-direction: column;
        }

        .package-highlight-title {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
        }

        .package-highlight-desc {
          margin: 0;
          font-size: 11px;
          color: #64748b;
        }

        .highlight-item.productivity { border-left: 4px solid #f59e0b; }
        .highlight-item.reliability { border-left: 4px solid #3b82f6; }
        .highlight-item.sustainability { border-left: 4px solid #10b981; }

        .package-features-grid-premium {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .feature-card-premium {
          padding: 24px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          text-align: center;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        .feature-icon-wrapper {
          width: 48px;
          height: 48px;
          background: #f1f5f9;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin: 0 auto 16px;
        }

        .feature-card-premium h4 {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 12px;
        }

        .card-divider {
          width: 30px;
          height: 2px;
          background: #e2e8f0;
          margin: 0 auto 12px;
        }

        .feature-card-premium p {
          font-size: 11px;
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }

        .feature-card-premium.productivity .feature-icon-wrapper { background: #fffbeb; color: #d97706; }
        .feature-card-premium.reliability .feature-icon-wrapper { background: #eff6ff; color: #2563eb; }
        .feature-card-premium.sustainability .feature-icon-wrapper { background: #f0fdf4; color: #16a34a; }

        .assurance-section {
          font-size: 11px;
          color: #374151;
        }

        .assurance-message {
          margin-bottom: 10px;
          line-height: 1.4;
        }

        .assurance-message p {
          margin-bottom: 4px;
        }

        .order-release {
          margin-bottom: 10px;
        }

        .release-text {
          margin-bottom: 6px;
          font-weight: 500;
        }

        .company-card {
          background: #f1f5f9;
          border-left: 3px solid #4472C4;
          padding: 10px 14px;
          border-radius: 0 6px 6px 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .company-card p {
          margin-bottom: 2px;
        }

        .company-title {
          font-weight: 700;
          color: #1e293b;
          font-size: 12px;
        }

        .website-link {
          color: #2563eb;
          text-decoration: none;
        }

        .clarification-text {
          margin-bottom: 4px;
        }

        .faithfully-text {
          font-weight: 600;
          color: #1e293b;
        }

        /* ==================== LEGACY HEADERS & TITLES ==================== */
        .page-title h1 {
          text-align: center;
          font-size: 18px;
          font-weight: normal;
          color: #4a5568;
          border-bottom: 2px solid #a0a0a0;
          padding-bottom: 8px;
          margin: 20px 0 30px 0;
          display: inline-block;
          width: 100%;
        }

        .page-title-secondary {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          color: #2d3748;
          margin: 0 0 24px 0;
        }

        /* Page 3 specific - reduce title margin */
        .page-3 .page-title-secondary {
          margin: 0 0 16px 0;
        }

        .customer-details {
          margin-bottom: 16px;
          font-size: 14px;
        }

        .subject-section {
          margin-bottom: 16px;
          font-size: 14px;
        }

        .introduction-section {
          margin-bottom: 16px;
          font-size: 14px;
          color: #4a5568;
        }

        /* ==================== SECTIONS ==================== */
        .machine-details-section,
        .items-section {
          margin-bottom: 20px;
        }

        .machine-details-section h3,
        .items-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        /* ==================== DATA TABLES ==================== */
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-bottom: 16px;
        }

        .data-table th {
          background-color: #4472C4 !important;
          color: white !important;
          font-weight: 600;
          padding: 8px;
          text-align: left;
          border: 1px solid #374151;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .data-table th.text-right {
          text-align: right;
        }

        .data-table td {
          padding: 8px;
          border: 1px solid #d1d5db;
          text-align: left;
        }

        .data-table td.text-right {
          text-align: right;
        }

        .total-row {
          background-color: #f9fafb;
          font-weight: bold;
        }

        .total-row td {
          background-color: #f9fafb !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ==================== TERMS & CONDITIONS ==================== */
        .terms-section {
          margin-bottom: 6px;
        }

        .terms-section h3 {
          font-size: 10px;
          font-weight: 700;
          color: #1e5f8b;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .terms-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .terms-list li {
          font-size: 12px;
          color: #4a5568;
          margin-bottom: 2px;
          padding-left: 10px;
          position: relative;
          line-height: 1.25;
        }

        .terms-list li::before {
          content: "•";
          position: absolute;
          left: 0;
          color: #4a5568;
          font-size: 12px;
        }

        .note-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .note-list li {
          font-size: 12px;
          color: #4a5568;
          margin-bottom: 2px;
          line-height: 1.25;
        }

        .other-terms {
          margin-bottom: 4px;
        }

        .other-terms .section-subtitle {
          font-size: 12px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .please-note-section {
          margin-bottom: 6px;
        }

        .please-note-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .company-assurance {
          font-size: 12px;
          color: #4a5568;
          margin-bottom: 4px;
          line-height: 1.2;
        }

        .company-assurance p {
          margin-bottom: 0.1rem;
        }

        /* ==================== SERVICE PRODUCTS - ENHANCED ==================== */
        .service-header-badge {
          display: inline-block;
          background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%);
          color: white;
          padding: 8px 24px;
          border-radius: 6px;
          font-weight: 600;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(68, 114, 196, 0.3);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .service-product {
          margin-bottom: 16px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .service-product-card {
          background: #fafbfc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .service-product-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .service-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%);
          color: white;
          font-size: 12px;
          font-weight: 700;
          border-radius: 50%;
          flex-shrink: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .service-product-header h3 {
          font-size: 14px;
          font-weight: 600;
          color: #1a365d;
          margin: 0;
        }

        /* Page 3 specific - ultra compact layout */
        .page-3 .service-product {
          margin-bottom: 6px;
        }

        .page-3 .service-product-card {
          padding: 8px;
          margin-bottom: 8px;
          border-radius: 6px;
        }

        .page-3 .service-product-card {
           display: grid !important;
           grid-template-columns: 180px 1fr !important;
           gap: 12px !important;
           padding: 10px !important;
           align-items: start !important;
        }

        .page-3 .service-section-title {
           grid-column: 1 / -1 !important;
           margin-bottom: 4px !important;
        }

        .page-3 .service-image {
          height: 100px !important; 
          width: 180px !important;
          margin-bottom: 0 !important;
        }

        .service-image {
          width: 100%;
          height: 75px; 
          margin-bottom: 8px;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
          border: 1px solid #e2e8f0;
        }

        .service-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 6px;
        }

        .service-product-content {
          padding: 0 4px;
        }

        .service-product-content p {
          font-size: 11px;
          color: #4a5568;
          margin-bottom: 5px;
          line-height: 1.4;
        }

        .service-highlight {
          font-size: 11px !important;
          color: #2d3748 !important;
          font-weight: 500;
          background: linear-gradient(90deg, #ebf4ff 0%, transparent 100%);
          padding: 4px 8px;
          border-left: 2px solid #4472C4;
          border-radius: 0 4px 4px 0;
          margin-bottom: 6px !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .services-features-grid {
          display: grid;
          grid-template-columns: 1fr; /* Stacked for side-by-side layout compatibility */
          gap: 4px;
          margin: 4px 0;
        }

        .services-feature-column {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .service-feature-item {
          font-size: 9.5px;
          color: #2d3748;
          padding: 2px 4px;
          background: transparent;
          border-radius: 0;
          border: none;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .page-3 .service-product-content p {
          font-size: 10.5px;
          line-height: 1.3;
          margin-bottom: 3px;
        }

        .service-feature-item::before {
          color: #48bb78;
          font-weight: bold;
        }

        .services-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 8px 0;
          font-size: 12px;
          color: #4a5568;
        }

        .services-grid p {
          margin-bottom: 2px;
        }

        /* ==================== SERVICE PACKAGE - ENHANCED ==================== */
        .service-package-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .service-package-title {
          font-size: 16px;
          font-weight: normal;
          color: #4a5568;
          margin-bottom: 12px;
        }

        .service-package-subtitle {
          font-size: 12px;
          color: #718096;
          max-width: 80%;
          margin: 0 auto 16px auto;
          line-height: 1.5;
        }

        .service-package-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .feature-card {
          text-align: center;
          padding: 12px 8px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .feature-card .feature-icon {
          font-size: 24px;
          margin-bottom: 6px;
        }

        .feature-card h4 {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #2d3748;
        }

        .feature-card p {
          font-size: 10px;
          color: #718096;
          margin: 0;
          line-height: 1.3;
        }

        .feature-productivity {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #f59e0b;
        }

        .feature-reliability {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-color: #3b82f6;
        }

        .feature-sustainability {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          border-color: #10b981;
        }

        .service-package-diagram {
          width: 100%;
          height: 380px; /* Reduced to fit feature cards */
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 5px;
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        /* Page 4 specific - reduce padding */
        .page-4 .page-content {
          padding-bottom: 2mm;
        }

        .service-package-diagram img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }


        /* ==================== SIGNATURE SECTION ==================== */
        .signature-section {
          margin-top: 4px;
          font-size: 12px;
        }

        .signature-container {
          margin-bottom: 3px;
        }

        .signature-image {
          width: 90px;
          height: 45px;
          object-fit: contain;
        }

        .signature-placeholder {
          width: 90px;
          height: 45px;
          background-color: #f7fafc;
          border: 1px dashed #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          color: #9ca3af;
        }

        .contact-info {
          line-height: 1.2;
        }

        .contact-info p {
          margin-bottom: 0.1rem;
        }

        .contact-info .contact-name {
          font-weight: 600;
        }

        .contact-info .contact-email {
          color: #3182ce;
        }

        /* ==================== SIGNATURE UPLOAD (EDIT MODE) ==================== */
        .signature-upload {
          margin-top: 16px;
        }

        .upload-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #4a5568;
          margin-bottom: 8px;
        }

        .signature-preview {
          position: relative;
          display: inline-block;
        }

        .remove-signature {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          padding: 0;
          border-radius: 50%;
          background-color: #fed7d7;
          color: #c53030;
        }

        .remove-signature:hover {
          background-color: #fbb6ce;
        }

        .upload-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .upload-button {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 12px;
          background-color: white;
          color: #4a5568;
          transition: background-color 0.2s;
        }

        .upload-button:hover {
          background-color: #f7fafc;
        }

        .upload-hint {
          font-size: 12px;
          color: #9ca3af;
        }

        /* ==================== TERMS PAGES LAYOUT - CLEAN & PREMIUM ==================== */
        .terms-main-title {
          text-align: center;
          margin: 0 0 15px 0;
        }

        .terms-header-badge {
          display: inline-block;
          background: linear-gradient(135deg, #1e5f8b 0%, #2c7da0 100%);
          color: white;
          padding: 8px 32px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 10px rgba(30, 95, 139, 0.2);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .terms-page .terms-content {
          column-count: 2 !important;
          column-gap: 24px !important;
          column-rule: 1px solid #edf2f7 !important;
          font-size: 8.2px !important;
          line-height: 1.35 !important;
          text-align: justify;
          display: block !important;
          color: #4a5568;
        }

        .terms-part-header {
          column-span: all;
          margin: 15px 0 10px 0;
          padding: 6px 15px;
          border-radius: 4px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .terms-part-header h3 {
          margin: 0 !important;
          padding: 0 !important;
          background: none !important;
          border: none !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          color: white !important;
          letter-spacing: 1px !important;
          text-transform: uppercase !important;
          text-align: center !important;
        }

        /* Part Specific Header Colors */
        .part-a { background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%); }
        .part-b { background: linear-gradient(135deg, #1e5f8b 0%, #154566 100%); }
        .part-c { background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); }
        
        .part-c-sub { 
          background: #f1f5f9; 
          color: #1e5f8b; 
          border-left: 4px solid #1e5f8b;
          text-align: left;
        }
        .part-c-sub h3 { 
          color: #1e5f8b !important; 
          text-align: left !important;
          letter-spacing: 0.5px !important;
        }

        .terms-page h4 {
          font-size: 9px;
          font-weight: 700;
          color: #2d3748;
          margin: 8px 0 4px 0;
          break-after: avoid;
        }

        .terms-page p {
          margin-bottom: 4px;
        }

        .terms-page ul {
          margin: 4px 0;
          padding-left: 15px;
        }

        .terms-page li {
          margin-bottom: 2px;
        }

        /* Specific padding for Terms pages to prevent footer overlap */
        .page-5 .page-content,
        .page-6 .page-content,
        .page-7 .page-content,
        .page-8 .page-content,
        .page-9 .page-content,
        .page-10 .page-content, 
        .page-11 .page-content {
          padding-bottom: 12mm;
        }

        .page-6 .terms-content .mt-4,
        .page-7 .terms-content .mt-4,
        .page-8 .terms-content .mt-4,
        .page-9 .terms-content .mt-4,
        .page-10 .terms-content .mt-4,
        .page-11 .terms-content .mt-4 {
          margin-top: 0 !important;
        }

        .page-6 .terms-content .mt-6,
        .page-7 .terms-content .mt-6,
        .page-8 .terms-content .mt-6,
        .page-9 .terms-content .mt-6,
        .page-10 .terms-content .mt-6,
        .page-11 .terms-content .mt-6 {
          margin-top: 1px !important;
        }

        .page-6 .terms-content ul,
        .page-7 .terms-content ul,
        .page-8 .terms-content ul,
        .page-9 .terms-content ul,
        .page-10 .terms-content ul,
        .page-11 .terms-content ul {
          margin: 0 !important;
          padding-left: 12px;
        }

        .page-6 .terms-content li,
        .page-7 .terms-content li,
        .page-8 .terms-content li,
        .page-9 .terms-content li,
        .page-10 .terms-content li,
        .page-11 .terms-content li {
          margin-bottom: 0 !important;
        }

        .page-6 .page-content,
        .page-7 .page-content,
        .page-8 .page-content,
        .page-9 .page-content,
        .page-10 .page-content,
        .page-11 .page-content {
          padding-bottom: 4mm;
          padding-top: 2mm;
        }

        .page-6 .terms-content .space-y-1,
        .page-7 .terms-content .space-y-1,
        .page-8 .terms-content .space-y-1,
        .page-9 .terms-content .space-y-1,
        .page-10 .terms-content .space-y-1,
        .page-11 .terms-content .space-y-1 {
          gap: 0 !important;
        }

        .page-6 .terms-content .space-y-1 li,
        .page-7 .terms-content .space-y-1 li,
        .page-8 .terms-content .space-y-1 li,
        .page-9 .terms-content .space-y-1 li,
        .page-10 .terms-content .space-y-1 li,
        .page-11 .terms-content .space-y-1 li {
          margin-bottom: 1px;
        }

        /* Pages 10-11 specific - SINGLE COLUMN for long paragraphs */
        .page-10 .terms-content,
        .page-11 .terms-content {
          display: block !important;
          column-count: 1 !important;
          font-size: 7.5px !important;
          line-height: 1.2 !important;
        }

        .page-10 .terms-content h4,
        .page-11 .terms-content h4 {
          font-size: 9px !important;
          font-weight: 700 !important;
          margin-bottom: 3px !important;
          margin-top: 6px !important;
          color: #1a365d !important;
          border-bottom: 1px solid #e2e8f0 !important;
          padding-bottom: 2px !important;
        }

        .page-10 .terms-content p,
        .page-11 .terms-content p {
          margin-bottom: 2px !important;
          text-align: justify !important;
        }

        /* ==================== MOBILE RESPONSIVENESS ==================== */
        @media (max-width: 768px) {
          .container {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }

          .quotation-document {
            padding: 0 !important;
            width: 100% !important;
          }

          .document-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }

          .page {
            width: 100% !important;
            min-height: auto !important;
            padding: 1rem !important;
            margin-bottom: 1rem !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
            border-radius: 0.5rem !important;
          }

          .page-content {
            padding: 0 !important;
          }

          .quote-header-simple {
            flex-direction: column !important;
            gap: 1rem !important;
          }

          .quote-gst-info {
            text-align: left !important;
          }

          .machine-details-section,
          .items-section {
            width: 100% !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .data-table {
            min-width: 600px !important; /* Force internal scrolling for tables */
          }

          .services-features-grid {
            grid-template-columns: 1fr !important;
          }

          .service-image {
            height: auto !important;
            max-height: 200px !important;
          }

          .service-package-diagram img {
            width: 100% !important;
            height: auto !important;
          }

          .signature-section {
            flex-direction: column !important;
            gap: 1.5rem !important;
          }

          .signature-display {
            text-align: left !important;
          }

          .customer-name {
            font-size: 1.125rem !important;
          }
          
          .page-footer {
            position: relative !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            margin-top: 2rem !important;
            padding: 1rem 0 !important;
            width: 100% !important;
          }
        }

        /* ==================== PAGE FOOTER ==================== */
        .page-footer {
          position: absolute;
          bottom: 12mm;
          left: 20mm;
          right: 20mm;
          border-top: 1px solid #d1d5db;
          padding-top: 8px;
          z-index: 10;
        }

        .footer-content {
          display: flex !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          align-items: center !important;
          width: 100% !important;
          font-size: 10px;
          color: #6b7280;
        }

        .footer-content span {
          flex: 1;
        }

        .footer-content span:nth-child(2) {
          text-align: center;
          flex: 2;
        }

        .footer-content span:last-child {
          text-align: right;
        }

        /* Page structure - global style */
        .page {
          background: white;
          width: 210mm;
          min-height: 297mm;
          padding: 20mm;
          margin: 0 auto 30px auto;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          position: relative;
          color: #374151;
        }

        /* ==================== PRINT STYLES - ENHANCED ==================== */
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          /* Base print setup - prevent extra margins causing blank pages */
          * {
            margin: 0;
            padding: 0;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          *::-webkit-scrollbar {
            display: none !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            width: 210mm !important;
            height: auto !important;
          }

          .quotation-document {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            background: white !important;
          }

          .document-container {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            overflow: visible !important;
            background: white !important;
          }

          .page {
            margin: 0 !important;
            padding: 15mm 20mm 20mm 20mm !important; /* Accurate A4 Padding */
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            position: relative !important;
            background: white !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }

          .page + .page {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Global Page Setup - FULL WIDTH FIX */
          html, body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .quotation-document {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .document-container {
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .page {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 15mm 15mm !important; /* Balanced margins */
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
          }

          /* Prevent blank trailing page after the last page */
          .page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Ensure content uses full width within page */
          .page-content {
            width: 100% !important;
            flex: 1 !important;
          }

          /* Targeted reset for Dashboard Layout wrappers to prevent gaps */
          #__next, .min-h-screen, 
          [class*="flex flex-col h-screen"], 
          [class*="flex-1 overflow-y-auto"],
          main, .flex-1 {
            overflow: visible !important;
            height: auto !important;
            position: static !important;
            display: block !important;
            width: 210mm !important;
          }

          /* Header badges - preserve colors */
          .quote-title-badge {
            background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%) !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .service-header-badge {
            background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%) !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .terms-header-badge {
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%) !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Page 1 elements */
          .quote-info-card {
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .tax-details {
            background: #f1f5f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .tax-label {
            background: #4472C4 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .customer-details-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
            border-left: 4px solid #4472C4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Simplified Page 1 layout for print - COMPACTED */
          .quote-header-simple {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            margin-bottom: 10px !important; /* Reduced from 20px */
            font-size: 11px !important;
          }

          .quote-ref-info p, .quote-gst-info p {
            margin-bottom: 2px !important;
          }

          .quote-ref-info {
            text-align: left !important;
          }

          .quote-gst-info {
            text-align: right !important;
          }
          
          .customer-details-simple p {
             font-size: 11px !important;
             margin-bottom: 2px !important;
             line-height: 1.2 !important;
          }
          
          .customer-details-simple {
             margin-bottom: 10px !important;
          }

          .kind-attention-section {
             margin-bottom: 10px !important;
          }

          .quote-title-underlined {
            color: #1e5f8b !important;
            text-decoration: underline !important;
            font-size: 18px !important; /* Slightly smaller title */
          }
          
          .quote-title-section {
             margin-bottom: 10px !important;
          }

          .kind-attention-text {
            color: #1e5f8b !important;
            font-size: 11px !important;
          }
          
          .subject-section-simple {
             margin-bottom: 8px !important;
             font-size: 11px !important;
          }
          
          .introduction-section-simple {
             margin-bottom: 15px !important;
             font-size: 11px !important;
             line-height: 1.3 !important;
          }
          
          .machine-details-section {
             margin-bottom: 15px !important;
          }
          
          .machine-details-section .section-label {
             margin-bottom: 4px !important;
             font-size: 11px !important;
          }
          
          .machine-table td, .machine-table th {
             padding: 4px 6px !important;
             font-size: 10px !important;
          }
          
          .items-section .section-label {
             margin-bottom: 4px !important;
             font-size: 11px !important;
          }
          
          .items-table td, .items-table th {
             padding: 4px 6px !important;
             font-size: 10px !important;
          }

          /* Simplified Page 2 styles for print */
          .terms-list-simple {
            display: block !important;
          }

          .terms-list-simple li {
            display: block !important;
            margin-bottom: 4px !important;
          }

          .notes-content {
            display: block !important;
          }

          .notes-content p {
            display: block !important;
            margin: 4px 0 !important;
          }

          /* Page 2 elements */
          .terms-card {
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .other-terms-badge {
            background: linear-gradient(90deg, #dbeafe 0%, #eff6ff 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .notes-card {
            background: linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .note-number {
            background: #d97706 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .highlight-text {
            background: #fde047 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .company-card {
            background: #f1f5f9 !important;
            border-left: 3px solid #4472C4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Service number badges */
          .service-number {
            background: linear-gradient(135deg, #4472C4 0%, #2e5aa8 100%) !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Service product cards */
          .service-product-card {
            background: #fafbfc !important;
            border: 1px solid #e2e8f0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Service highlight */
          .service-highlight {
            background: linear-gradient(90deg, #ebf4ff 0%, transparent 100%) !important;
            border-left: 3px solid #4472C4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Feature cards for Page 4 */
          .feature-productivity {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
            border-color: #f59e0b !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .feature-reliability {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%) !important;
            border-color: #3b82f6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .feature-sustainability {
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%) !important;
            border-color: #10b981 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Terms section headers */
          .terms-page .terms-content h3 {
            background: linear-gradient(90deg, #e2e8f0 0%, transparent 100%) !important;
            border-left: 3px solid #4472C4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ensure tables break properly */
          .data-table {
            page-break-inside: auto !important;
          }

          .data-table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          .data-table thead {
            display: table-header-group !important;
          }

          .data-table tbody {
            display: table-row-group !important;
          }

          /* Table header colors */
          .data-table th {
            background-color: #4472C4 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .total-row td {
            background-color: #f9fafb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ensure service products don't break */
          .service-product,
          .service-product-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Footer positioning */
          .page-footer {
            position: absolute !important;
            bottom: 12mm !important;
            left: 20mm !important;
            right: 20mm !important;
            z-index: 100 !important;
            display: flex !important;
            background: white !important;
            border-top: 1px solid #d1d5db !important;
            padding-top: 8px !important;
          }

          /* Hide screen-only elements */
          .signature-upload,
          .upload-controls,
          .remove-signature {
            display: none !important;
          }

          /* Service images */
          .service-image {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Service package diagram container */
          .service-package-diagram {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* General PDF Layout Tweaks */
          .page-content {
            padding-bottom: 15mm !important;
          }

          /* Ensure Terms Headers look correct in PDF */
          .terms-part-header {
            break-after: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Prevent weird column breaks inside sections */
          .terms-page h4, 
          .terms-page p {
            break-inside: avoid !important;
          }
        }
      `}</style>
        </div>
      </div>
    </div>
  </div>
)
}
