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
  sparePartId?: number
  discount?: number
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
    assetName?: string
    machineSerialNumber?: string
    model?: string
    manufacturer?: string
    location?: string
    machineId?: string
    serialNo?: string
    customer?: {
      companyName: string
    }
  }
}

interface MachineDetails {
  model: string
  serialNumber: string
  owner?: string
  department?: string
  control?: string
  yearOfManufacturing?: string
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
    name?: string
  }
  items?: OfferItem[]
  machineDetails?: MachineDetails
  offerSpareParts?: OfferSparePart[]
  offerAssets?: OfferAsset[]
  assignedTo?: {
    id: number
    name: string
    email?: string
    phone?: string
  }
  createdBy?: {
    id: number
    name: string
    email?: string
    phone?: string
  }
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
  companyAddress: 'Brigade Rubix, #604, 6th Floor, HMT Watch Factory Road',
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
  total: '',
  discount: 0
}

const DEFAULT_MACHINE_DETAILS: MachineDetails = {
  model: '',
  serialNumber: '',
  owner: '',
  department: '',
  control: '',
  yearOfManufacturing: ''
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

const KardexLogo = ({ className = 'h-10' }: LogoProps) => (
  <div className="flex justify-between items-start mb-6 border-b pb-4">
    <img
      src="/kardex-only.png"
      alt="Kardex"
      className={className}
      onError={(e) => {
        e.currentTarget.src = '/kardex.png'
        e.currentTarget.style.objectFit = 'cover'
        e.currentTarget.style.objectPosition = 'left'
        e.currentTarget.style.width = '48%'
      }}
    />
    <div className="text-[10px] text-gray-400 text-right uppercase tracking-widest font-semibold pt-2">
      Official Quotation
    </div>
  </div>
)

interface PageFooterProps {
  pageNumber: number
  totalPages?: number
  productType?: string
}

const PageFooter = ({ pageNumber, totalPages = 10, productType }: PageFooterProps) => {
  const displayTotal = 10;
  const displayPage = pageNumber + 1;

  return (
    <div className="page-footer">
      <table style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ width: '33%', textAlign: 'left', fontSize: '10px', color: '#6b7280', padding: 0, whiteSpace: 'nowrap' }}>
              {displayPage} / {displayTotal}
            </td>
            <td style={{ width: '34%', textAlign: 'center', fontSize: '10px', color: '#6b7280', padding: 0, whiteSpace: 'nowrap' }}>
              {productType ? (PRODUCT_TYPE_LABELS[productType] || productType.replace(/_/g, ' ')) : 'Service Care Contract'}
            </td>
            <td suppressHydrationWarning style={{ width: '33%', textAlign: 'right', fontSize: '10px', color: '#6b7280', padding: 0, whiteSpace: 'nowrap' }}>
              {format(new Date(), 'dd/MM/yyyy')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface ItemRowProps {
  item: OfferItem
  index: number
  isEditMode: boolean
  isSpareParts: boolean
  onUpdate: (id: number, field: keyof OfferItem, value: string | number) => void
  onRemove: (id: number) => void
  canRemove: boolean
}

const ItemRow = ({ item, index, isEditMode, isSpareParts, onUpdate, onRemove, canRemove }: ItemRowProps) => {
  const itemTotal = calculateItemTotal(item.unitPrice, item.quantity)
  const discount = parseFloat(item.discount as any) || 0
  const discountedPrice = itemTotal * (1 - discount / 100)

  return (
    <tr>
      <td className="text-center">{index + 1}</td>
      <td className="text-center">
        {isEditMode ? (
          <Input
            value={item.partNo}
            onChange={(e) => onUpdate(item.id, 'partNo', e.target.value)}
            placeholder="Part No"
            className="h-7 text-xs w-full text-center"
            aria-label={`Part number for item ${index + 1}`}
          />
        ) : (
          item.partNo || '-'
        )}
      </td>
      <td className="text-left">
        {isEditMode ? (
          <Input
            value={item.description}
            onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
            placeholder="Description"
            className="h-7 text-xs w-full text-left"
            aria-label={`Description for item ${index + 1}`}
          />
        ) : (
          item.description || '-'
        )}
      </td>
      <td className="text-center">
        {isEditMode ? (
          <Input
            value={item.hsnCode}
            onChange={(e) => onUpdate(item.id, 'hsnCode', e.target.value)}
            placeholder="HSN"
            className="h-7 text-xs w-full text-center"
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
      <td className="text-center">
        {isEditMode ? (
          <Input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate(item.id, 'quantity', parseInt(e.target.value) || 1)}
            placeholder="1"
            min="1"
            className="h-7 text-xs w-full text-center"
            aria-label={`Quantity for item ${index + 1}`}
          />
        ) : (
          (item.partNo || item.description) ? item.quantity : '-'
        )}
      </td>
      <td className="text-right font-medium">
        {formatCurrency(itemTotal)}
      </td>
      {isSpareParts && (
        <>
          {isEditMode && (
            <td className="text-center print:hidden">
              <Input
                type="number"
                value={item.discount !== undefined ? item.discount : ''}
                onChange={(e) => onUpdate(item.id, 'discount', parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                max="100"
                className="h-7 text-xs w-full text-center"
                aria-label={`Discount for item ${index + 1}`}
              />
            </td>
          )}
          <td className="text-right font-medium">
            {formatCurrency(discountedPrice)}
          </td>
        </>
      )}
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
}

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

      // Use zone endpoint for zone managers
      const response = await apiService.getOfferForQuote(parseInt(offerId))

      console.log('✅ Offer data received:', response)
      const offerData: Offer = response.offer
      setOffer(offerData)

      // Map spare parts to items format
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

      // Map spare parts to items format
      const mappedItems: OfferItem[] = offerData.offerSpareParts && offerData.offerSpareParts.length > 0
        ? offerData.offerSpareParts.map((osp, index) => ({
          id: index + 1,
          partNo: osp.sparePart.partNumber,
          description: osp.sparePart.name || osp.sparePart.description || '',
          hsnCode: osp.sparePart.category || '',
          unitPrice: osp.unitPrice.toString(),
          quantity: osp.quantity,
          total: osp.totalPrice.toString(),
          sparePartId: osp.sparePart.id,
          discount: 0
        }))
        : [DEFAULT_ITEM];

      // Get machine details from assets
      const firstAsset = offerData.offerAssets && offerData.offerAssets.length > 0
        ? offerData.offerAssets[0].asset
        : null;

      // Determine machine owner (ACCOUNT_OWNER contact name)
      const accountOwner = offerData.customer?.contacts?.find(c => c.role === 'ACCOUNT_OWNER');
      const machineOwner = accountOwner?.contactPersonName || '';

      // Initialize editable data, prioritizing saved quote data over default values
      setEditableData({
        // Company info: use saved or default
        companyName: storedQuoteData?.companyInfo?.companyName || DEFAULT_COMPANY_INFO.companyName,
        companyAddress: (storedQuoteData?.companyInfo?.companyAddress && storedQuoteData.companyInfo.companyAddress.includes('602'))
          ? storedQuoteData.companyInfo.companyAddress.replace('602', '#604')
          : (storedQuoteData?.companyInfo?.companyAddress || DEFAULT_COMPANY_INFO.companyAddress),
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

        // Contact details (salesperson / creator who added the offer, not the customer contact)
        contactPersonName: offerData.assignedTo?.name || offerData.createdBy?.name || '',
        contactPersonPhone: offerData.assignedTo?.phone || offerData.createdBy?.phone || '',
        contactPersonEmail: offerData.assignedTo?.email || offerData.createdBy?.email || '',

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
            total: '',
            sparePartId: item.sparePartId,
            discount: item.discount !== undefined ? item.discount : 0
          }))
          : mappedItems,

        // Machine details: prioritize saved data
        machineDetails: storedQuoteData?.machineDetails || {
          model: firstAsset?.model || '',
          serialNumber: firstAsset?.serialNo || offerData.machineSerialNumber || '',
          owner: machineOwner,
          department: offerData.department || offerData.location || '',
          control: (firstAsset as any)?.control || '',
          yearOfManufacturing: (firstAsset as any)?.yearOfManufacturing || ''
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


  const handleToggleEditMode = useCallback(() => {
    if (isEditMode) {
      toast.success('Changes saved!')
    }
    setIsEditMode(prev => !prev)
  }, [isEditMode])

  // ==================== Computed Values ====================
  const quoteDate = useMemo(() => new Date(), [])
  const validUntil = useMemo(() => getValidUntilDate(), [])
  const isOptilife = useMemo(() => offer?.productType === 'UPGRADE_KIT', [offer])
  const isSpareParts = useMemo(() => offer?.productType === 'SPARE_PARTS', [offer])
  const totalPages = 10

  // ==================== Calculations ====================
  const subtotal = useMemo(() => {
    return editableData.items.reduce((sum, item) => {
      return sum + calculateItemTotal(item.unitPrice, item.quantity)
    }, 0)
  }, [editableData.items])

  const discountedTotal = useMemo(() => {
    return editableData.items.reduce((sum, item) => {
      const total = calculateItemTotal(item.unitPrice, item.quantity)
      const discount = parseFloat(item.discount as any) || 0
      return sum + (total * (1 - discount / 100))
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
      <div className="container mx-auto py-6 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/zone-manager/offers/${offerId}`)}
            aria-label="Go back to offer details"
            className="hover:bg-white/80"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Offer
          </Button>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleToggleEditMode}
              variant={isEditMode ? "default" : "outline"}
              className={isEditMode ? "bg-[#4472C4] hover:bg-[#365ba3]" : "bg-white"}
            >
              {isEditMode ? (
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
            <Button onClick={handlePrint} variant="outline" disabled={isEditMode} className="bg-white">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline" disabled={isEditMode} className="bg-white">
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
            {/* Page 1 - Cover Page (Optilife Upgrade Only) */}
            {/* Page 1 - Cover Page */}
            <div className="page page-cover shadow-2xl print:shadow-none mb-10 print:mb-0">
              {/* Logo */}
              <KardexLogo />

              <div className="page-content">
                {/* Title - Centered and Underlined */}
                <div className="page-title mt-8 mb-12">
                  <h1 className="text-center">
                    <span className="page-title-text">
                      Kardex – {offer?.productType ? (PRODUCT_TYPE_LABELS[offer.productType] || offer.productType.replace(/_/g, ' ')) : 'Spare Parts'}
                    </span>
                  </h1>
                </div>

                {/* Header Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', width: '100%' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div className="flex gap-2 mb-1">
                      <span className="font-semibold">REF NO :</span>
                      <span>{offer.offerReferenceNumber}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold">Date :</span>
                      <span suppressHydrationWarning>{format(quoteDate, 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>GST – {editableData.gstNumber}</div>
                    <div>ARN – {editableData.arnNumber}</div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="customer-details">
                  <div className="font-semibold text-[#546A7A]">M/s {editableData.customerName.startsWith('M/s') ? editableData.customerName.replace(/^M\/s\s*/, '') : (editableData.customerName || offer?.customer?.companyName || offer?.company || '')}</div>
                  {offer.customer?.address && <div className="text-[#5D6E73]">{offer.customer.address}</div>}
                  {(offer.customer?.city || offer.customer?.state) && (
                    <div className="text-[#5D6E73]">
                      {[offer.customer?.city, offer.customer?.state].filter(Boolean).join(' - ')}
                    </div>
                  )}
                  {(offer.contact?.contactPersonName || offer.contact?.name || offer.contactPersonName) && (
                    <div className="text-[#5D6E73] mt-2">
                      <span className="font-medium">Kind Attn:</span> {offer.contact?.contactPersonName || offer.contact?.name || offer.contactPersonName}
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div className="subject-section my-4">
                  <div className="font-bold underline text-sm uppercase">
                    SUB: {isOptilife
                      ? 'OPTI-LIFE UPGRADE (REFURBISHMENT) OF KARDEX UNITS'
                      : (editableData.subject ? editableData.subject.toUpperCase() : 'QUOTATION FOR KARDEX UNITS')}
                  </div>
                </div>

                {/* Introduction */}
                <div className="introduction-section text-xs leading-relaxed text-[#4a5568] mb-6">
                  <p>
                    {isOptilife ? (
                      "We are pleased to offer the Opti-Life Upgrade (Refurbishment) for the Kardex systems installed at your premises. This upgrade will help keep your systems running smoothly and extend their service life. It's your opportunity to improve system performance, reduce the total cost of maintenance, and boost productivity – all through a scheduled, condition-based upgrade carried out by Kardex-certified service experts."
                    ) : (
                      editableData.introduction || `We are pleased to submit our quotation for ${PRODUCT_TYPE_LABELS[offer?.productType || ''] || 'Spare Parts'} for the Kardex systems installed at your premises.`
                    )}
                  </p>
                </div>

                {/* Graphics section */}
                <div className="optilife-graphic-container">
                  <img
                    src={isOptilife ? "/optilife.png" : "/Kardex_Shuttle.jpg"}
                    alt={isOptilife ? "Optilife Upgrade" : "Kardex Shuttle"}
                    className="optilife-hero-img"
                  />
                </div>
              </div>
              <PageFooter productType={offer?.productType} pageNumber={0} />
            </div>

            {/* Page 1 (or Page 2 if isOptilife) - Tables and Details */}
            <div className="page page-1 shadow-2xl print:shadow-none mb-10 print:mb-0">
              {/* Logo */}
              <KardexLogo />

              <div className="page-content">
                {/* Machine Details */}
                <div className="machine-details-section">
                  <h3>Machine Details:</h3>
                  <table className="data-table machine-table">
                    <thead>
                      {isOptilife || isSpareParts ? (
                        <tr>
                          <th style={{ width: '120px' }} className="text-center">S.N</th>
                          <th className="text-center">MACHINE MODEL</th>
                          <th className="text-center">MACHINE Sr.No</th>
                          <th className="text-center">CONTROL</th>
                          <th className="text-center">YEAR OF MANUFACTURING</th>
                        </tr>
                      ) : (
                        <tr>
                          <th style={{ width: '60px' }} className="text-center">Sr. No</th>
                          <th className="text-center">Machine Model</th>
                          <th className="text-center">Machine Sr. No</th>
                          <th className="text-center">Machine Owner</th>
                          <th className="text-center">Department</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {isOptilife ? (
                        offer?.offerAssets && offer.offerAssets.length > 0 ? (
                          offer.offerAssets.map((oa, index) => {
                            const asset = oa.asset;
                            const letters = ['X', 'Y', 'Z'];
                            const letterIndex = letters[index] || String.fromCharCode(65 + index);
                            const model = asset?.model || '-';
                            const serialNo = asset?.serialNo || '-';
                            const control = (asset as any).control || '-';
                            const year = (asset as any).yearOfManufacturing || '-';
                            const machineName = (!asset?.machineId || asset.machineId.startsWith('MACHINE_'))
                              ? `KARDEX-${letterIndex}`
                              : asset.machineId;
                            return (
                              <tr key={oa.id || index}>
                                <td className="font-semibold text-center">{machineName}</td>
                                <td className="text-left">{model}</td>
                                <td className="text-center">{serialNo}</td>
                                <td className="text-center">{control}</td>
                                <td className="text-center">{year}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <>
                            <tr>
                              <td className="font-semibold text-center">KARDEX-X</td>
                              <td className="text-left">SHUTTLE-NT-500-2800X863</td>
                              <td className="text-center">00.008461/001</td>
                              <td className="text-center">C2000</td>
                              <td className="text-center">2000</td>
                            </tr>
                            <tr>
                              <td className="font-semibold text-center">KARDEX-Y</td>
                              <td className="text-left">SHUTTLE-NT-500-2800X863</td>
                              <td className="text-center">00.008462/001</td>
                              <td className="text-center">C2000</td>
                              <td className="text-center">2000</td>
                            </tr>
                            <tr>
                              <td className="font-semibold text-center">KARDEX-Z</td>
                              <td className="text-left">SHUTTLE-XP-500- 2850X864</td>
                              <td className="text-center">06010093/001</td>
                              <td className="text-center">C2000</td>
                              <td className="text-center">2006</td>
                            </tr>
                          </>
                        )
                      ) : isSpareParts ? (
                        <tr>
                          <td className="font-semibold text-center">1</td>
                          <td className="text-left">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.model}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, model: e.target.value } })}
                                placeholder="Machine Model"
                                className="h-7 text-xs text-left"
                              />
                            ) : (
                              editableData.machineDetails.model || '-'
                            )}
                          </td>
                          <td className="text-center">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.serialNumber}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, serialNumber: e.target.value } })}
                                placeholder="Serial Number"
                                className="h-7 text-xs text-center"
                              />
                            ) : (
                              editableData.machineDetails.serialNumber || '-'
                            )}
                          </td>
                          <td className="text-center">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.control}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, control: e.target.value } })}
                                placeholder="Control (e.g., TIC)"
                                className="h-7 text-xs text-center"
                              />
                            ) : (
                              editableData.machineDetails.control || '-'
                            )}
                          </td>
                          <td className="text-center">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.yearOfManufacturing}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, yearOfManufacturing: e.target.value } })}
                                placeholder="Year of Manufacturing"
                                className="h-7 text-xs text-center"
                              />
                            ) : (
                              editableData.machineDetails.yearOfManufacturing || '-'
                            )}
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td className="text-center">1</td>
                          <td className="text-left">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.model}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, model: e.target.value } })}
                                placeholder="Machine Model"
                                className="h-7 text-xs text-left"
                              />
                            ) : (
                              editableData.machineDetails.model || '-'
                            )}
                          </td>
                          <td className="text-center">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.serialNumber}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, serialNumber: e.target.value } })}
                                placeholder="Serial Number"
                                className="h-7 text-xs text-center"
                              />
                            ) : (
                              editableData.machineDetails.serialNumber || '-'
                            )}
                          </td>
                          <td className="text-center">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.owner}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, owner: e.target.value } })}
                                placeholder="Owner"
                                className="h-7 text-xs text-center"
                              />
                            ) : (
                              editableData.machineDetails.owner || '-'
                            )}
                          </td>
                          <td className="text-center">
                            {isEditMode ? (
                              <Input
                                value={editableData.machineDetails.department}
                                onChange={(e) => setEditableData({ ...editableData, machineDetails: { ...editableData.machineDetails, department: e.target.value } })}
                                placeholder="Department"
                                className="h-7 text-xs text-center"
                              />
                            ) : (
                              editableData.machineDetails.department || '-'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Parts/Items Table */}
                <div className="items-section">
                  <div className="section-header">
                    <h3>{isOptilife ? 'E.O.L SPARE PARTS' : 'Parts / Items:'}</h3>
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
                          <th style={{ width: '35px' }} className="text-center">S.N</th>
                          <th style={{ width: '85px' }} className="text-center">Part No</th>
                          <th className="text-center">{isSpareParts ? 'Part Description' : 'Description'}</th>
                          <th style={{ width: '65px' }} className="text-center">HSN Code</th>
                          <th style={{ width: '80px' }} className="text-right">Unit Price</th>
                          <th style={{ width: '40px' }} className="text-center">Qty</th>
                          <th style={{ width: '90px' }} className="text-right">Total Price</th>
                          {isSpareParts && (
                            <>
                              {isEditMode && <th style={{ width: '70px' }} className="print:hidden text-center">Discount (%)</th>}
                              <th style={{ width: '95px' }} className="text-right">Discounted Price</th>
                            </>
                          )}
                          {isEditMode && <th style={{ width: '45px' }} className="print:hidden text-center">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {editableData.items.map((item, index) => (
                          <ItemRow
                            key={`${item.id}-${index}`}
                            item={item}
                            index={index}
                            isEditMode={isEditMode}
                            isSpareParts={isSpareParts}
                            onUpdate={updateItem}
                            onRemove={removeItem}
                            canRemove={editableData.items.length > 1}
                          />
                        ))}
                        <tr className="grand-total-row bg-[#4472C4]/5">
                          <td colSpan={6} className="text-right font-bold text-[#4472C4] py-3">GRAND TOTAL</td>
                          <td className="text-right font-bold text-[#4472C4] py-3">
                            {formatCurrency(subtotal)} INR
                          </td>
                          {isSpareParts && (
                            <>
                              {isEditMode && <td className="print:hidden"></td>}
                              <td className="text-right font-bold text-[#4472C4] py-3">
                                {formatCurrency(discountedTotal)} INR
                              </td>
                            </>
                          )}
                          {isEditMode && <td className="print:hidden"></td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {isOptilife && (
                    <div className="mt-6 text-xs text-[#2d3748] pl-2 leading-relaxed">
                      <p className="font-bold underline mb-2 uppercase text-[#546A7A]">
                        SH XP CONTROL UPGRADE C2000 - C3000 CONSISTING OF:
                      </p>
                      <ul className="list-none space-y-1 text-slate-700">
                        <li>- Unit control incl. control drawer</li>
                        <li>- Energy chain</li>
                        <li>- Shutter door controls</li>
                        <li>- Wiring sets</li>
                        <li>- Drive unit components</li>
                        <li>- OP0/ OP Logicontrol HMI</li>
                        <li>- Small parts, instructions etc.</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Page 1 Footer */}
                <PageFooter productType={offer?.productType} pageNumber={1} />
              </div>
            </div>

            {/* Page 2 - Terms and Conditions */}
            <div className="page page-2 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content text-[12px] text-slate-800 leading-relaxed pl-4 pr-4 flex flex-col justify-between pb-8">
                {/* TERMS AND CONDITIONS */}
                <div className="mb-3">
                  <h3 className="text-[#4472C4] font-bold text-[12px] underline mb-1.5 uppercase tracking-wide">
                    Terms and Conditions
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5 text-slate-700">
                    <li>GST ({editableData.gstRate}%) to be paid extra</li>
                    <li>Quotation validity up to 30 days</li>
                    <li>Delivery - Ex-Works Bangalore, within 18 to 20 weeks from the date of Purchase Order, packing included.</li>
                    <li>Warranty: 3 months from the date of delivery for Electronics parts only.</li>
                    <li>Payment: 100% advance along with the purchase order.</li>
                    <li>OTHER TERMS & CONDITIONS AS PER THE ANNEXURE ATTACHED</li>
                  </ul>
                </div>

                {/* KINDLY INCLUDE THE FOLLOWING POINTS IN THE PO */}
                <div className="mb-3">
                  <h3 className="text-[#4472C4] font-bold text-[12px] underline mb-1.5 uppercase tracking-wide">
                    Kindly include the following points in the PO: -
                  </h3>
                  <ul className="list-none pl-5 space-y-0.5 text-slate-700">
                    <li className="relative pl-4"><span className="absolute left-0">-</span> Quotation reference i.e. <strong>{offer.offerReferenceNumber}</strong></li>
                    <li className="relative pl-4"><span className="absolute left-0">-</span> Customer GST number of the place where delivery/services are requested.</li>
                    <li className="relative pl-4"><span className="absolute left-0">-</span> Kardex Ident Number as per the quotation</li>
                    <li className="relative pl-4"><span className="absolute left-0">-</span> HSN codes</li>
                    <li className="relative pl-4"><span className="absolute left-0">-</span> All line items mention in quotation, if more than one item.</li>
                    <li className="relative pl-4"><span className="absolute left-0">-</span> Delivery address and contact person's details.</li>
                    <li className="relative pl-4"><span className="absolute left-0">-</span> Kardex address as mentioned in quotation.</li>
                    <li className="relative pl-4"><span className="absolute left-0">-</span> Company seal signature.</li>
                  </ul>
                </div>

                {/* Assurance Paragraph */}
                <p className="mb-3 text-slate-700">
                  We assure you of our unwavering commitment to always providing the highest standards of service. We are dedicated to exceeding your expectations and leaving no room for any service-related concerns.
                </p>

                {/* Order Release Block */}
                <div className="mb-3">
                  <h3 className="text-[#4472C4] font-bold text-[12px] underline mb-1.5 uppercase tracking-wide">
                    We therefore would request you to kindly release the order on-
                  </h3>
                  <div className="pl-5 space-y-0 text-slate-700">
                    <p className="font-semibold text-slate-900">M/s, KARDEX INDIA PVT LTD</p>
                    <p>{editableData.companyAddress},</p>
                    <p>{editableData.companyCity}</p>
                    <p>Tel : {editableData.companyPhone} {editableData.companyFax && `Fax : ${editableData.companyFax}`}</p>
                    <p>Website : <a href={`https://${editableData.companyWebsite}`} className="text-[#4472C4] underline" target="_blank" rel="noopener noreferrer">{editableData.companyWebsite}</a></p>
                  </div>
                </div>

                {/* Signature footer */}
                <div className="mt-3">
                  <p className="mb-1 text-slate-700">If you need any clarifications/ information, please do contact the undersigned.</p>
                  <p className="font-semibold text-slate-900 mb-2">Yours faithfully</p>

                  {isEditMode ? (
                    <div className="edit-signature-controls print:hidden mt-2">
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                          <Input value={editableData.contactPersonName} onChange={(e) => setEditableData({ ...editableData, contactPersonName: e.target.value })} placeholder="Name" />
                          <Input value={editableData.contactPersonPhone} onChange={(e) => setEditableData({ ...editableData, contactPersonPhone: e.target.value })} placeholder="Phone" />
                          <Input value={editableData.contactPersonEmail} onChange={(e) => setEditableData({ ...editableData, contactPersonEmail: e.target.value })} placeholder="Email" />
                        </div>
                        <div className="w-1/3">
                          {editableData.signatureImage ? (
                            <div className="relative border rounded p-2">
                              <img src={editableData.signatureImage} className="h-20 object-contain mx-auto" />
                              <Button onClick={removeSignature} variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6"><X className="h-3 w-3" /></Button>
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
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="h-12 flex items-center justify-start pb-0.5 mb-1 w-48">
                        {editableData.signatureImage ? (
                          <img src={editableData.signatureImage} alt="Signature" className="max-h-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Please Sign Here</span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900">{editableData.contactPersonName || 'Amrender Prakash'}</p>
                      <p className="text-slate-600">LCC-India</p>
                      {editableData.contactPersonPhone && <p className="text-slate-600">Mobile : {editableData.contactPersonPhone}</p>}
                      {editableData.contactPersonEmail && <p className="text-slate-600"><a href={`mailto:${editableData.contactPersonEmail}`} className="text-[#4472C4] underline">{editableData.contactPersonEmail}</a></p>}
                    </div>
                  )}
                </div>

              </div>

              {/* Page 2 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={2} />
            </div>



            {/* Page 5 - General Terms */}
            <div className="page page-5 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content terms-page">
                <h2 className="page-title-secondary">General Terms and Conditions</h2>

                <div className="terms-content">
                  <p className="mb-4">These Terms and Conditions (T&C) are structured as follows:</p>
                  <ul className="list-disc list-inside space-y-1 mb-4">
                    <li>Part A (general provisions) applies to all transactions, except where a provision of the applicable parts B and C contains deviating regulation (other than merely adding further details), which then takes precedence;</li>
                    <li>Parts B and C contain the applicable specific provisions for supply of products and software programming services with or without installation (Part B), and individual service orders and service contracts (Part C);</li>
                  </ul>

                  <p className="mb-4">
                    These T&C are provided in German, English and other languages. Only the German and English texts are legally binding and authoritative.
                    They are of equal status. Translations of these T&C into other languages are solely for convenience and are not legally binding.
                  </p>

                  {/* Part A: General Provisions */}
                  <h3 className="text-sm font-bold text-[#546A7A] mt-6 mb-3">A. General Provisions</h3>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">1. Scope of the T&C</h4>
                    <p className="mb-1">1.1. These T&C apply to all transactions between KARDEX INDIA STORAGE SOLUTIONS PRIVATE LIMITED and the customer, unless expressly otherwise agreed in writing.</p>
                    <p className="mb-1">1.2. On placement of a purchase order by the customer, these T&C are deemed to be acknowledged, and will also apply for future transactions with the customer.</p>
                    <p className="mb-1">1.3. Any deviating, contradictory or supplemental terms and conditions of the customer apply only if expressly accepted by KARDEX in writing.</p>
                    <p className="mb-1">1.4. Any amendments of and additions to the contract must be made in writing. All agreements and legally binding declarations of the parties require written confirmation by KARDEX.</p>
                    <p className="mb-1">1.5. KARDEX is entitled to amend the T&C at any time. The version current at the time of the purchase order applies. In the case of continuing contractual relationships, the draft of the amended T&C will be sent to the customer in writing no later than one month before the proposed date of their entry into force. The customer is deemed to have given its consent to the amendments if it has not rejected them by the planned date for entry into force. The amended T&C will then apply to any further transactions between the parties.</p>
                    <p className="mb-1">1.6. The general provisions of these T&C (Part A) apply to all transactions and legal relations between the parties unless otherwise stated in the specific provisions (Parts B and C) or agreed in writing.</p>
                    <p>1.7. The term "Product(s)" used in Part A is individually defined for each of Parts B and C. The meaning of this term in Part A shall therefore have the meaning as defined in the applicable Part B and C.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">2. Offers from KARDEX</h4>
                    <p className="mb-1">2.1. Unless expressly otherwise agreed, offers from KARDEX are nonbinding; otherwise, the offers are valid for 60 days. A statement by the customer is deemed to be an acceptance only if it is fully consistent with the KARDEX offer.</p>
                    <p className="mb-1">2.2. A contract is only validly concluded if KARDEX (i) confirms the order in writing or (ii) starts to perform the contract by delivering the Products or by rendering the service.</p>
                    <p className="mb-1">2.3. Under no circumstances shall silence by KARDEX with respect to a counter-offer from the customer be construed as a declaration of acceptance.</p>
                    <p>2.4. The documents relating to offers and order confirmations, such as illustrations, drawings, and weight and measurement details, are binding only if this has been expressly agreed in writing. Unless otherwise agreed in writing, brochures and catalogues are not binding.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">3. Provided Documents</h4>
                    <p>Each party retains all rights to plans and technical documents that it has provided to the other party. The receiving party acknowledges these rights, and shall not make such documents available, in full or in part, to any third party without the prior written consent of the other party, or use them outside of the scope of the purpose for which they were provided for. This also applies after termination of the business relationship as well as in the event that no contract is concluded between the parties.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">4. Prices and Payment Conditions</h4>
                    <p className="mb-1">4.1. All prices are excluding GST</p>
                    <p className="mb-1">4.2. Unless otherwise agreed in writing or specified in the subsequent specific provisions, invoices from KARDEX are payable within 30 days net from the invoice date, without any deduction. Advance and prepayments are payable within 10 days from the invoice date without any deduction.</p>
                    <p className="mb-1">4.3. A customer failing to pay by the due date is in default without a reminder, and KARDEX is entitled to charge monthly default interest in the amount of 1%, except where a different default interest rate has been specified in the contract or in the offer.</p>
                    <p className="mb-1">4.4. In the event of customer default, KARDEX is entitled to withdraw from the contract and claim back any Products already supplied and/or enter the site and render Products unusable. In addition, KARDEX is also entitled to claim direct damages and/or provide outstanding deliveries or services only against advance payment or the provision of collateral, or suspend the provision of services under other orders or service agreements for which payment has already been made.</p>
                    <p>4.5. If KARDEX becomes aware of circumstances casting doubt on the solvency of the customer, KARDEX shall have the right to demand full payment in advance or the provision of collateral.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">5. Set-off and Assignment</h4>
                    <p className="mb-1">5.1. Set-off against any counterclaims of the customer is not permitted.</p>
                    <p className="mb-1">5.2. Claims of the customer against KARDEX may be assigned only with consent from KARDEX.</p>
                    <p>5.3. The transfer of any rights and obligations under or in connection with a contract between the parties is permitted only with the other contracting party's written consent.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">6. Liability</h4>
                    <p className="mb-1">6.1. The contractual and non-contractual liability of KARDEX both for its own actions and for the actions of its auxiliary persons is limited, to the extent permitted by law, to immediate and direct damages and to a total of 20% of the contractually agreed remuneration per delivery or service concerned. In the case of continuing obligations (e.g. service contracts under Part C), liability is limited, to the extent legally permitted, per contract year, to immediate and direct damages and to the amount of 50% of the annual remuneration payable for the product or service affected by the damage. In case the liability cap in accordance with the above calculations is below EUR 10,000 in individual cases, a liability cap of EUR 10,000 applies.</p>
                    <p className="mb-1">6.2. If KARDEX or its auxiliary persons unlawfully and culpably damage items owned by the customer, KARDEX's liability shall, in deviation from section A.6.1., be governed exclusively by the provisions of article 41 et seqq. of the Swiss Code of Obligations (CO) and shall be limited, to the extent permitted by law, to EUR 500,000 per claim. KARDEX's liability for damages to the product itself or to product accessories is exclusively governed by section A.6.1.</p>
                    <p className="mb-1">6.3. Further claims not expressly mentioned in this provision and these T&C for any legal reason, in particular but not limited to claims for compensation of indirect and/or consequential damages not incurred on the product itself as well as damages due to loss of production, capacity and data including their consequences, loss of use, loss of orders, loss of profit, damage to reputation and punitive damages are excluded.</p>
                    <p className="mb-1">6.4. The contractual and non-contractual liability of KARDEX is also excluded for damages which are due to (i) incorrect information about operational and technical conditions or about the chemical and physical conditions for the use of the products provided by the customer, auxiliary persons and/or its advisors, or (ii) other actions, omissions of the customer, his auxiliary persons, advisors or third parties or other circumstances within the responsibility of the customer.</p>
                    <p className="mb-1">6.5. The above limitations and exclusions of liability do not apply (i) in cases of injury to life, body or health, (ii) in cases of intent or gross negligence on the part of KARDEX or its auxiliary persons, and (iii) for claims from product liability under product liability laws to the extent these laws are mandatory to the legal relationship between the parties.</p>
                    <p>6.6. If third parties are injured by the customer's actions or omissions or if objects of third parties are damaged or third parties are otherwise damaged and KARDEX is held liable for this, KARDEX has a right of recourse to the customer.</p>
                  </div>

                </div>
              </div>

              {/* Page 5 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={3} />
            </div>

            {/* Page 6 - General Terms Continued */}
            <div className="page page-6 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content terms-page">
                <div className="terms-content grid grid-cols-2 gap-4">
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">7. Intellectual Property</h4>
                    <p className="mb-1">7.1. The customer may not use the intellectual property of KARDEX (in particular technical protective rights, brands and other signs, designs, knowhow, copyright to software and other works) for any purposes other than those expressly agreed between the parties.</p>
                    <p className="mb-1">7.2. Without the express permission of KARDEX, the customer may not transfer or otherwise provide KARDEX Products to third parties without the attached brands.</p>
                    <p>7.3. Where KARDEX supplies software to the customer, the customer only acquires a simple, non-exclusive and non-transferrable right of use. The customer is not granted any right to edit the software.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">8. Data Protection</h4>
                    <p className="mb-1">8.1. The protection of personal data is an important priority for KARDEX. KARDEX and the customer undertake to comply at all times with the applicable legal provisions on data protection. In particular, the customer assures that KARDEX is permitted to use personal data provided to them by the customer in accordance with this section A.8., and indemnifies and holds KARDEX fully harmless from any claims by the persons affected.</p>
                    <p className="mb-1">8.2. KARDEX collects, processes and uses the customer's personal data for the performance of the contract. The customer's data will further be used for the purposes of future customer service, in which context the customer has the right to object in writing at any time. In addition, the customer's machines and operational data may be used and evaluated in anonymised form and user information on the customer's employees may be used in pseudonymized form for diagnosis and analysis purposes, and in anonymized form for the further development of KARDEX products and services (e.g. preventive maintenance). All data deriving from such analysis and diagnosis shall belong to KARDEX and may be freely used by KARDEX.</p>
                    <p className="mb-1">8.3. The personal data of the customer will only be passed on to other companies (e.g. the transport company entrusted with the delivery) within the scope of contract processing and the provision of information technology and other administrative support activities. Otherwise, personal data will not be passed on to third parties. KARDEX ensures that companies that process personal data on behalf of KARDEX comply with the applicable legal provisions on data protection and that a comparable level of data protection is guaranteed, especially in the case of transfer abroad.</p>
                    <p className="mb-1">8.4. The customer may contact KARDEX free of charge with any queries regarding the collection, processing or use of its personal data.</p>
                    <p>8.5. When using web-based products of KARDEX (such as customer portal, remote portal) personal data will be recorded. The collection, processing and use of such data can, upon customer's request, be governed by a separate data processing agreement.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">9. Confidentiality</h4>
                    <p className="mb-1">9.1. Each of the parties undertakes to keep confidential all trade secrets and confidential information brought to their knowledge by the other party, in particular, all information on customer relationships and their details, other important information such as plans, service descriptions, product specifications, information on production processes and any other confidential information made available to it and/or otherwise disclosed by the other party in written or other form, and, in particular, not to make direct or indirect use thereof in business dealings and/or for competitive purposes, and/or pass it on to third parties in business dealings and/or for competitive purposes, and/or otherwise bring it directly or indirectly to the attention of third parties, either itself or through third parties.</p>
                    <p className="mb-1">9.2. The confidentiality agreement does not apply where the information is publicly known, was already known to the other party when received, has been made available by third parties without any breach of a party's confidentiality obligation, or whose disclosure is mandatory under legal provisions, official orders or court orders, in particular judgments. The party wishing to invoke these exceptions bears the burden of proof in this regard.</p>
                    <p>9.3. The parties will place all persons whose services they use for providing services or who otherwise come into contact with confidential information as per section A.9.1 under a confidentiality obligation in accordance with sections A.9.1. and A.9.2.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">10. Severability</h4>
                    <p>If any provision of the contract, including these T&C, are or become fully or partially unenforceable or invalid under applicable law, such provision shall be ineffective only to the extent of such unenforceability or invalidity and the remaining provisions of the contract or the T&C, respectively, shall continue to be binding and in full force and effect. Such unenforceable or invalid provision shall be replaced by such a valid and enforceable provision, which the parties consider, in good faith, to match as closely as possible the invalid or unenforceable provision and attaining the same or a similar economic effect. The same applies in case a gap (Lücke) becomes evident.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">11. Office Hours</h4>
                    <p>Office hours are the usual working hours Monday - Friday, 9:00 a.m. - 6:00 p.m., with the exception of the public holidays at the registered office of KARDEX.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">12. Governing Law and Jurisdiction</h4>
                    <p className="mb-1">12.1. These T&C and the entire legal relationship between the parties shall be governed by, and construed in accordance with, Swiss law, with exclusion of the United Nations Convention on Contracts for the International Sale of Goods.</p>
                    <p>12.2. Any dispute, controversy or claim arising out or in connection with the contract between the parties and/or these T&C, including their conclusion, validity, binding effect, breach, termination or rescission, shall be resolved by arbitration in accordance with the Swiss Rules of International Arbitration of the Swiss Chambers' Arbitration Institution. Regarding the time for service of initiation pleadings, the current text of the Rules of International Arbitration applies. The venue of the arbitration procedure is the city of Zurich, Switzerland. The language of the arbitration procedure is English or German.</p>
                  </div>

                </div>
              </div>

              {/* Page 6 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={4} />
            </div>

            {/* Page 3 - Service Products */}
            <div className="page page-3 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content terms-page">
                <div className="terms-content grid grid-cols-2 gap-4">
                  {/* Part B */}
                  <h3 className="text-sm font-bold text-[#546A7A] mt-6 mb-3">B. Specific Provisions for Deliveries</h3>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">1. Delivery</h4>
                    <p className="mb-1">1.1. The subject-matter of delivery contracts is the delivery of systems, machines and/or software products and individually customised software in accordance with the specifications in the order confirmation handed over to the customer by KARDEX (each individually or collectively "Product(s)").</p>
                    <p className="mb-1">1.2. Only the characteristics listed in the order confirmation are guaranteed features. Public statements, promotions and advertisements do not constitute guaranteed features of the Products. It is the customer's responsibility to assess whether or not the ordered Products are suitable for their intended purpose.</p>
                    <p className="mb-1">1.3. Any quality guarantees in addition to features guaranteed in the order confirmation must be confirmed by KARDEX in writing.</p>
                    <p>1.4. KARDEX reserves the right to make design and/or shape changes to the Products if the Product thereafter deviates only insignificantly from the agreed quality and the changes are reasonable for the customer or if the customer agrees to the change of the agreed quality.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">2. Delivery Time</h4>
                    <p className="mb-1">2.1. Delivery times are non-binding unless expressly confirmed as binding by KARDEX in writing.</p>
                    <p className="mb-1">2.2. Delivery periods start with the dispatch of the order confirmation or receipt of the order in case there is no order confirmation, but not before the receipt of any advance payment or collateral to be provided by the customer.</p>
                    <p className="mb-1">2.3. If subsequent change requests by the customer are accepted, the delivery period and delivery date are extended and postponed at least by the time required for implementation of the requested changes.</p>
                    <p className="mb-1">2.4. Delivery periods and delivery dates are met if on their expiry the Product has left the factory or notification of readiness for dispatch has been given. In the case of installation of Products, the delivery period is met by timely handover or acceptance of the installed Product. Delays beyond the control of KARDEX (e.g. failure by the customer to provide ancillary services, such as the provision of documents, permits and/or clearances to be obtained by the customer, ensuring the availability of a suitable lifting platform or opening the building) will at least result in a corresponding extension of the delivery period. KARDEX has the right to charge incurred cost from such delays.</p>
                    <p className="mb-1">2.5. Force majeure, strikes, lockouts and other impediments beyond the control of KARDEX will extend and postpone agreed delivery periods and delivery dates by no more than the duration of the impediment, to the extent that such impediments can be proven to have a significant impact on completion or delivery of the Products or associated services. The same applies where the impediments to performance occur in the operations of KARDEX' upstream suppliers. KARDEX will further not be accountable for the above circumstances if they arise during an already existing delay. KARDEX will notify the customer without delay of the beginning and end of such impediments.</p>
                    <p className="mb-1">2.6. If the dispatch of the Products is delayed at the customer's request, the customer will be invoiced as from one month after the notification of readiness for shipment issued by KARDEX for the resulting storage costs; in the case of storage in the factory, KARDEX may claim a storage fee in accordance with normal local rates. KARDEX is, however, entitled, after setting a reasonable deadline that has expired without effect, to use the Product otherwise, and to supply the customer with a similar product within a new delivery period.</p>
                    <p>2.7. Partial deliveries are permitted.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">3. Late Delivery</h4>
                    <p className="mb-1">3.1. Damages for delay limited to 0.1% per week, maximum 5% of total consideration.</p>
                    <p className="mb-1">3.2. Customer can withdraw only after two grace periods of 10 weeks each expire without success.</p>
                    <p>3.3. Further claims due to delay are excluded except in cases of willful misconduct or gross negligence.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">4. Place of Delivery; Transfer of Risk</h4>
                    <p className="mb-1">4.1. Unless agreed otherwise, Product delivered "FCA KARDEX factory" (Incoterms 2010).</p>
                    <p className="mb-1">4.2. If installation agreed, delivered "DDP customer's factory" (Incoterms 2010).</p>
                    <p className="mb-1">4.3. Delayed shipment passes risk to customer when goods ready for dispatch.</p>
                    <p>4.4. Customer must inspect for visible damage and provide documented report promptly.</p>
                  </div>

                </div>
              </div>

              {/* Page 7 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={5} />
            </div>

            {/* Page 8 - Part B Continued */}
            <div className="page page-8 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content terms-page">
                <div className="terms-content grid grid-cols-2 gap-4">
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">5. Inspection and Acceptance</h4>
                    <p className="mb-1">5.1. Customer must inspect quality and quantity immediately. Defects reported within 10 days.</p>
                    <p className="mb-1">5.2. If installation agreed, acceptance procedure required. Defects recorded in acceptance certificate.</p>
                    <p className="mb-1">5.3. Product deemed accepted 14 days after receipt or notification of readiness.</p>
                    <p className="mb-1">5.4. Minor defects do not permit refusal of acceptance.</p>
                    <p>5.5. With acceptance, KARDEX no longer liable for defects discoverable on normal inspection.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">6. Warranty</h4>
                    <p className="mb-1">6.1. KARDEX warrants delivery of Products free from defects.</p>
                    <p className="mb-1">6.2. KARDEX has right and duty to rectify defect within reasonable deadline.</p>
                    <p className="mb-1">6.3. KARDEX bears all costs necessary to rectify, repair or replace defective Product.</p>
                    <p className="mb-1">6.4. If rectification fails, customer may claim price reduction or rescind contract.</p>
                    <p className="mb-1">6.5. If shortfall in guaranteed performance less than or equal to 15%, no right to rescind or claim damages.</p>
                    <p className="mb-1">6.6. Guaranteed values adjusted if customer changes device specification.</p>
                    <p className="mb-1">6.7. Warranty rights expire 12 months after delivery.</p>
                    <p>6.8. Warranty expires if repairs by untrained personnel or inappropriate operation.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">7. Prices and Payment Conditions</h4>
                    <p className="mb-1">7.1. If legal requirements change, KARDEX may charge reasonable price increase.</p>
                    <p className="mb-1">7.2. If installation undertaken: 50% on order, 40% on delivery, 10% within 30 days of acceptance.</p>
                    <p>7.3. Currency effects may be additionally charged.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">8. Spare Parts; Maintenance Commitment</h4>
                    <p className="mb-1">8.1. Non-electronic spare parts available for 10 years, electronic parts for 6 years.</p>
                    <p>8.2. Software maintenance subject to maintenance contract.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">9. Technical Support by Customer</h4>
                    <p className="mb-1">9.1. If installation agreed, customer obliged to provide technical support at own expense including:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Installation surface in well-swept condition</li>
                      <li>Necessary equipment and heavy tools</li>
                      <li>Heating, lighting, site energy supply, water</li>
                      <li>Suitable personnel and work rooms</li>
                      <li>Transport of installation parts</li>
                      <li>Materials for initial adjustment and testing</li>
                      <li>Floor load capacity, level installation surface</li>
                      <li>Energy supply, internet and data connection</li>
                      <li>Structural prerequisites for installation</li>
                    </ul>
                    <p className="mb-1 mt-2">9.2. Technical support must ensure work begins immediately on technician arrival.</p>
                    <p className="mb-1">9.3. Customer provides assistance to KARDEX technician as needed.</p>
                    <p>9.4. If customer fails obligations, KARDEX entitled to perform at customer's expense.</p>
                  </div>

                </div>
              </div>

              {/* Page 8 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={6} />
            </div>

            {/* Page 9 - Part C */}
            <div className="page page-9 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content terms-page">
                <div className="terms-content grid grid-cols-2 gap-4">
                  {/* Part C */}
                  <h3 className="text-sm font-bold text-[#546A7A] mt-6 mb-3">C. Provisions for Life Cycle Services</h3>

                  <h4 className="font-semibold mb-2 mt-4">C1: General Definitions</h4>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">1. Individual Service Orders</h4>
                    <p className="mb-1">1.1. Subject matter: repairs, installations, commissioning, relocation, maintenance, modifications, retrofits and upgrades.</p>
                    <p>1.2. Scope determined in order confirmation specifying services, Products, place, times, remuneration.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">2. Service Contract</h4>
                    <p className="mb-1">2.1. Subject matter: maintenance, repair work or services on Products over several years.</p>
                    <p>2.2. Scope determined by service package (BASE, FLEX or FULL Care), Products, annual fee.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">3. Response Times</h4>
                    <p>"Helpdesk Reaction Time": time from fault report to KARDEX Remote Support or telephone service begins. "OnSite Reaction Time": time to service technician arrival on site. Only reaction time during normal office hours relevant.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">4. Fault Reports</h4>
                    <p className="mb-1">4.1. All faults must be reported by telephone, online or Remote Help Request button.</p>
                    <p className="mb-1">4.2. Elimination by telephone, Remote Support or on-site technician at KARDEX discretion.</p>
                    <p className="mb-1">4.3. Reports outside agreed hours: KARDEX not obligated. If intervention occurs, double hourly rate.</p>
                    <p className="mb-1">4.4. KARDEX investigates only if properly reported and fault reproducible.</p>
                    <p>4.5. Software fault exists only if core functions impossible or severely impaired due to KARDEX software.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">5. Timing / Agreement on Dates</h4>
                    <p className="mb-1">5.1. Cancel/postpone less than 48 hours: customer bears costs.</p>
                    <p>5.2. KARDEX may invoice unnecessary travel or waiting times exceeding 30 minutes.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">6. Liability</h4>
                    <p className="mb-1">6.1. KARDEX not liable for damage from incorrect use, transmission failures, faulty execution of support instructions, attempted repairs by customer/third parties, untrained staff, delay in reaching technician, data loss.</p>
                    <p>6.2. Liability for merchandise/goods stored in Products excluded.</p>
                  </div>

                </div>
              </div>

              {/* Page 9 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={7} />
            </div>

            {/* Page 10 - C2 Continued */}
            <div className="page page-10 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content terms-page">
                <div className="terms-content grid grid-cols-2 gap-4">
                  <h4 className="font-semibold mb-2 mt-4">C2: Individual Services</h4>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">1. Individual Services Include:</h4>
                    <p className="mb-1">1.1. Installation and Commissioning by skilled technicians.</p>
                    <p className="mb-1">1.2. On-site support for repair after breakdown.</p>
                    <p className="mb-1">1.3. Remote Support or telephone support to increase operating time.</p>
                    <p className="mb-1">1.4. Relocation Service: dismantling, transport, installation at new location.</p>
                    <p className="mb-1">1.5. Training services for customer staff.</p>
                    <p className="mb-1">1.6. Maintenance and Safety Tests to ensure reliability.</p>
                    <p className="mb-1">1.7. Modification services to adapt system to changes.</p>
                    <p className="mb-1">1.8. Upgrade and Retrofit Services for latest technology.</p>
                    <p>1.9. Spare Part Delivery Service for single parts or packages.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">2. Use of Third Party Sub-Contractors</h4>
                    <p>KARDEX may use third party services. KARDEX ensures obligations fulfilled by third party.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">3. Unauthorized Intervention</h4>
                    <p>Customer must inform KARDEX of external work before service. KARDEX may request inspection or decline service.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">4. Technical Support by Customer</h4>
                    <p>Customer obliged to provide technical support at own expense. Section B.10 applies for installation/relocation.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">5. Acceptance</h4>
                    <p className="mb-1">5.1. Customer must inspect upon completion. Results recorded in acceptance certificate.</p>
                    <p className="mb-1">5.2. Deemed accepted 14 days after completion notification.</p>
                    <p className="mb-1">5.3. Minor defects do not permit refusal.</p>
                    <p>5.4. With acceptance, no liability for defects discoverable on normal inspection.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">6. Warranty</h4>
                    <p className="mb-1">6.1. KARDEX warrants faultless provision per legal regulations and recognized rules.</p>
                    <p className="mb-1">6.2. KARDEX has right and duty to rectify defect within reasonable deadline.</p>
                    <p className="mb-1">6.3. Warranty expires 6 months after acceptance.</p>
                    <p>6.4. Warranty voided by: improper use, faulty installation by customer/third party, modification/maintenance/repair/relocation by customer/third party, excessive wear, faulty operation, inappropriate materials, faulty construction, chemical/electronic effects not due to KARDEX fault, untrue indications by customer, force majeure.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">7. Remuneration</h4>
                    <p className="mb-1">7.1. Charged on time and material basis per current price list unless lump sum agreed.</p>
                    <p className="mb-1">7.2. KARDEX may charge costs for unnecessary travel.</p>
                    <p>7.3. Waiting times caused by customer chargeable.</p>
                  </div>

                </div>
              </div>

              {/* Page 10 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={8} />
            </div>

            {/* Page 11 - C3 */}
            <div className="page page-11 shadow-2xl print:shadow-none mb-10 print:mb-0">
              <KardexLogo />

              <div className="page-content terms-page">
                <div className="terms-content grid grid-cols-2 gap-4">
                  <h4 className="font-semibold mb-2 mt-4">C3: Service Contracts</h4>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">1. Service Packages</h4>
                    <p className="mb-1">1.1. Services determined by product descriptions, technical requirements, maintenance intervals, software upgrades.</p>
                    <p className="mb-1">1.2. Maintenance during normal office hours. FLEX/FULL Care for extended hours.</p>
                    <p className="mb-1">1.3. No warranty that Product remains defect-free or functions without interruption.</p>
                    <p className="mb-1">1.4. Inclusion requires technically perfect condition. Expired warranty requires inspection first.</p>
                    <p>1.5. KARDEX Remote Support monitors Product condition. No guarantee malfunction solvable remotely.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">2. Customer Obligations</h4>
                    <p className="mb-1">2.1. Treat Product per KARDEX operating recommendations.</p>
                    <p className="mb-1">2.2. Faults reported solely by authorized person to KARDEX service technician.</p>
                    <p className="mb-1">2.3. Provide functional data transmission device for Remote Support.</p>
                    <p className="mb-1">2.4. Support technician on site with own personnel as needed.</p>
                    <p className="mb-1">2.5. Ensure Products available at agreed timeslot for service.</p>
                    <p className="mb-1">2.6. All maintenance/repairs carried out solely by KARDEX or authorized subcontractor.</p>
                    <p className="mb-1">2.7. Not change Product location without prior written notice. Upon request, KARDEX supervises relocation.</p>
                    <p className="mb-1">2.8. Actively support KARDEX in fault diagnosis via Remote Support.</p>
                    <p>2.9. Password required for Remote Support use.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">3. Remuneration for Service Contracts</h4>
                    <p className="mb-1">3.1. Annual fee depends on service package (BASE, FLEX, FULL Care).</p>
                    <p className="mb-1">3.2. First annual fee invoiced on signing, thereafter before each contract year.</p>
                    <p className="mb-1">3.3. KARDEX may increase/decrease fee. If increase exceeds 5%, customer has extraordinary termination right.</p>
                    <p className="mb-1">3.4. KARDEX may charge for unnecessary travel or if service cannot be performed due to customer.</p>
                    <p>3.5. Additional inspections invoiced separately at applicable hourly rates.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">4. Warranty</h4>
                    <p className="mb-1">4.1. KARDEX warrants faultless provision per relevant rules.</p>
                    <p className="mb-1">4.2. KARDEX has right and duty to rectify defect within reasonable deadline.</p>
                    <p className="mb-1">4.3. Customer must immediately inspect and notify defects. Warranty expires 6 months after acceptance.</p>
                    <p className="mb-1">4.4. Warranty excluded if work by non-approved maintenance companies.</p>
                    <p>4.5. No warrant for specific timeframe unless explicitly agreed. No warrant against unauthorized third-party access.</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">5. Term and Termination</h4>
                    <p className="mb-1">5.1. Initial term 2 years.</p>
                    <p className="mb-1">5.2. Extended by 1 year unless terminated with 3 months notice.</p>
                    <p className="mb-1">5.3. May be terminated for cause with immediate effect if significant breach not remedied within 2 weeks.</p>
                    <p>5.4. KARDEX may exclude individual Products after 3 months notice if no longer properly maintainable.</p>
                  </div>

                </div>
              </div>

              {/* Page 11 Footer */}
              <PageFooter productType={offer?.productType} pageNumber={9} />
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
          background: white;
        }

        /* ==================== PAGE STRUCTURE ==================== */
        .page {
          width: 100%;
          min-height: 297mm; /* A4 height */
          padding: 20mm;
          margin: 0;
          background: white;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          page-break-after: always;
          break-after: page;
          position: relative;
        }

        .page:last-child {
          page-break-after: avoid;
          break-after: avoid;
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

        /* ==================== HEADERS & TITLES ==================== */
        .page-title h1 {
          text-align: center;
          margin: 20px 0 30px 0;
        }

        .page-title-text {
          font-size: 22px;
          font-weight: 700;
          color: #546A7A;
          border-bottom: 2px solid #546A7A;
          padding-bottom: 4px;
          display: inline-block;
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

        /* ==================== QUOTE HEADER ==================== */
        .quote-header {
          margin-bottom: 24px;
        }

        .header-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
          font-size: 14px;
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
          background-color: #D9E1F2 !important; /* Light Gray-Blue */
          color: #000000 !important; /* Black text */
          font-weight: 700;
          padding: 6px 4px;
          text-align: center;
          border: 1px solid #000000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .data-table th.text-right {
          text-align: right;
        }

        .data-table td {
          padding: 6px 4px;
          border: 1px solid #000000;
          text-align: left;
          color: #1e293b;
        }

        .data-table td.text-right {
          text-align: right;
        }

        .data-table td input {
          padding-left: 4px !important;
          padding-right: 4px !important;
          height: 26px !important;
          font-size: 11px !important;
        }

        /* Hide spin-button for Chrome, Safari, Edge, Opera */
        .data-table td input::-webkit-outer-spin-button,
        .data-table td input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        /* Hide spin-button for Firefox */
        .data-table td input[type=number] {
          -moz-appearance: textfield;
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

        /* ==================== OPTILIFE COVER PAGE ==================== */
        .optilife-graphic-container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 30px;
          width: 100%;
        }

        .optilife-hero-img {
          max-width: 100%;
          width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          display: block;
        }

        /* ==================== TERMS & CONDITIONS ==================== */
        .terms-section {
          margin-bottom: 6px;
        }

        .terms-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 4px;
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

        /* ==================== SERVICE PRODUCTS ==================== */
        .service-product {
          margin-bottom: 16px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Page 3 specific - more compact layout */
        .page-3 .service-product {
          margin-bottom: 12px;
        }

        .service-product h3 {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .service-image {
          width: 100%;
          height: 100px;
          margin-bottom: 8px;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f7fafc;
        }

        .service-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 4px;
        }

        .service-product p {
          font-size: 12px;
          color: #4a5568;
          margin-bottom: 6px;
          line-height: 1.35;
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

        /* ==================== SERVICE PACKAGE ==================== */
        .service-package-title {
          font-size: 16px;
          font-weight: normal;
          color: #4a5568;
          margin-bottom: 16px;
        }

        .service-package-subtitle {
          font-size: 12px;
          color: #4a5568;
          margin-bottom: 20px;
        }

        .service-package-diagram {
          width: 100%;
          height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
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

        /* ==================== TERMS PAGES LAYOUT ==================== */
        .terms-page .terms-content {
          font-size: 9px;
          color: #4a5568;
          line-height: 1.2;
          text-align: justify;
        }

        /* Page 5 specific - two column layout */
        .page-5 .terms-content {
          column-count: 2;
          column-gap: 16px;
          column-fill: balance;
        }

        .page-5 .page-title-secondary {
          margin: 0 0 6px 0;
          font-size: 13px;
        }

        .page-5 .terms-content h3 {
          column-span: all;
          break-after: avoid;
          margin: 8px 0 4px 0 !important;
        }

        .page-5 .terms-content .mb-4 {
          margin-bottom: 4px;
        }

        .page-5 .terms-content p.mb-4 {
          margin-bottom: 3px;
        }

        .page-5 .terms-content ul {
          margin: 3px 0;
        }

        .page-5 .terms-content .space-y-1 {
          gap: 0;
        }

        .page-5 .terms-content .space-y-1 li {
          margin-bottom: 1px;
        }

        .terms-content h3 {
          font-size: 11px;
          font-weight: bold;
          color: #2d3748;
          margin: 10px 0 5px 0;
        }

        .terms-content h4 {
          font-size: 9px;
          font-weight: 600;
          color: #2d3748;
          margin: 6px 0 3px 0;
          break-after: avoid;
        }

        .terms-content p {
          margin-bottom: 3px;
        }

        .page-5 .terms-content p {
          margin-bottom: 2px;
        }

        .terms-content ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .terms-content li {
          margin-bottom: 4px;
        }

        .page-5 .terms-content li {
          margin-bottom: 1px;
        }

        .page-5 .terms-content ul {
          padding-left: 16px;
        }

        /* Pages 6-9 specific - SINGLE COLUMN COMPACT layout */
        .page-6 .terms-content,
        .page-7 .terms-content,
        .page-8 .terms-content,
        .page-9 .terms-content {
          font-size: 8.5px;
          line-height: 1.25;
          display: block;
        }

        /* Pages 10-11 specific */
        .page-10 .terms-content,
        .page-11 .terms-content {
          font-size: 8.5px;
          line-height: 1.25;
          display: block;
        }

        .page-6 .terms-content h3,
        .page-7 .terms-content h3,
        .page-8 .terms-content h3,
        .page-9 .terms-content h3,
        .page-10 .terms-content h3,
        .page-11 .terms-content h3 {
          grid-column: 1 / -1;
          font-size: 11px;
          margin: 4px 0 3px 0;
          font-weight: bold;
        }

        .page-6 .terms-content h4,
        .page-7 .terms-content h4,
        .page-8 .terms-content h4,
        .page-9 .terms-content h4,
        .page-10 .terms-content h4,
        .page-11 .terms-content h4 {
          font-size: 9.5px;
          margin: 3px 0 2px 0;
          font-weight: 600;
        }

        .page-6 .terms-content .mb-4,
        .page-7 .terms-content .mb-4,
        .page-8 .terms-content .mb-4,
        .page-9 .terms-content .mb-4,
        .page-10 .terms-content .mb-4,
        .page-11 .terms-content .mb-4 {
          margin-bottom: 4px;
        }

        .page-6 .terms-content p,
        .page-7 .terms-content p,
        .page-8 .terms-content p,
        .page-9 .terms-content p,
        .page-10 .terms-content p,
        .page-11 .terms-content p {
          margin-bottom: 2px;
        }

        .page-6 .terms-content .mb-1,
        .page-7 .terms-content .mb-1,
        .page-8 .terms-content .mb-1,
        .page-9 .terms-content .mb-1,
        .page-10 .terms-content .mb-1,
        .page-11 .terms-content .mb-1 {
          margin-bottom: 1.5px;
        }

        .page-6 .terms-content .mb-2,
        .page-7 .terms-content .mb-2,
        .page-8 .terms-content .mb-2,
        .page-9 .terms-content .mb-2,
        .page-10 .terms-content .mb-2,
        .page-11 .terms-content .mb-2 {
          margin-bottom: 2px;
        }

        .page-6 .terms-content .mt-4,
        .page-7 .terms-content .mt-4,
        .page-8 .terms-content .mt-4,
        .page-9 .terms-content .mt-4,
        .page-10 .terms-content .mt-4,
        .page-11 .terms-content .mt-4 {
          margin-top: 3px;
        }

        .page-6 .terms-content .mt-6,
        .page-7 .terms-content .mt-6,
        .page-8 .terms-content .mt-6,
        .page-9 .terms-content .mt-6,
        .page-10 .terms-content .mt-6,
        .page-11 .terms-content .mt-6 {
          margin-top: 4px;
        }

        .page-6 .terms-content ul,
        .page-7 .terms-content ul,
        .page-8 .terms-content ul,
        .page-9 .terms-content ul,
        .page-10 .terms-content ul,
        .page-11 .terms-content ul {
          margin: 2px 0;
          padding-left: 16px;
        }

        .page-6 .terms-content li,
        .page-7 .terms-content li,
        .page-8 .terms-content li,
        .page-9 .terms-content li,
        .page-10 .terms-content li,
        .page-11 .terms-content li {
          margin-bottom: 1.5px;
        }

        .page-6 .page-content,
        .page-7 .page-content,
        .page-8 .page-content,
        .page-9 .page-content,
        .page-10 .page-content,
        .page-11 .page-content {
          padding-bottom: 8mm;
        }

        .page-6 .terms-content .space-y-1,
        .page-7 .terms-content .space-y-1,
        .page-8 .terms-content .space-y-1,
        .page-9 .terms-content .space-y-1,
        .page-10 .terms-content .space-y-1,
        .page-11 .terms-content .space-y-1 {
          gap: 0;
        }

        .page-6 .terms-content .space-y-1 li,
        .page-7 .terms-content .space-y-1 li,
        .page-8 .terms-content .space-y-1 li,
        .page-9 .terms-content .space-y-1 li,
        .page-10 .terms-content .space-y-1 li,
        .page-11 .terms-content .space-y-1 li {
          margin-bottom: 1px;
        }

        /* ==================== PAGE FOOTER ==================== */
        .page-footer {
          position: absolute;
          bottom: 12mm;
          left: 0;
          right: 0;
          width: 100%;
          box-sizing: border-box;
          padding: 0 20mm;
          border-top: 1px solid #d1d5db;
          padding-top: 8px;
          z-index: 10;
        }

        .footer-content {
          display: block !important;
          width: 100% !important;
          font-size: 10px;
          color: #6b7280;
        }

        .footer-content span {
          display: inline-block !important;
          float: left !important;
          width: 33% !important;
          text-align: left !important;
          box-sizing: border-box !important;
        }

        .footer-content span:nth-child(2) {
          text-align: center !important;
          width: 34% !important;
        }

        .footer-content span:last-child {
          text-align: right !important;
          float: right !important;
          width: 33% !important;
        }

        /* ==================== PRINT STYLES ==================== */
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            width: 210mm !important;
          }

          .print\:hidden {
            display: none !important;
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
            padding: 15mm 20mm 20mm 20mm !important;
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

          /* Footer positioning */
          .page-footer {
            position: absolute !important;
            bottom: 12mm !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding-left: 20mm !important;
            padding-right: 20mm !important;
            z-index: 100 !important;
            background: white !important;
            border-top: 1px solid #d1d5db !important;
            padding-top: 8px !important;
          }
        }

        /* ==================== RESPONSIVE DESIGN ==================== */
        @media screen and (max-width: 768px) {
          .document-container {
            max-width: 100%;
            padding: 0 16px;
          }

          .page {
            padding: 16px;
            min-height: auto;
          }

          .header-info {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .services-grid {
            grid-template-columns: 1fr;
          }

          .data-table {
            font-size: 11px;
          }

          .data-table th,
          .data-table td {
            padding: 6px;
          }
        }
      `}</style>
          </div>
        </div>
      </div>
    </div>
  )
}
