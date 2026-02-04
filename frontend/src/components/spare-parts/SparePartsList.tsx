'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Upload, 
  RefreshCw, 
  Package, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Grid3x3,
  List
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { SparePart, formatCurrency } from '@/lib/constants/spare-parts'

// Lazy load children
const SparePartsStats = dynamic(() => import('./SparePartsStats'), {
  loading: () => <div className="h-32 w-full bg-slate-100 animate-pulse rounded-2xl" />
})

const SparePartsFilters = dynamic(() => import('./SparePartsFilters'), {
  loading: () => <div className="h-64 w-full bg-slate-100 animate-pulse rounded-2xl" />
})

const SparePartsTable = dynamic(() => import('./SparePartsTable'), {
  loading: () => <div className="h-96 w-full bg-slate-100 animate-pulse rounded-2xl" />
})

const SparePartsGrid = dynamic(() => import('./SparePartsGrid'), {
  loading: () => <div className="h-96 w-full bg-slate-100 animate-pulse rounded-2xl" />
})

const SparePartFormModal = dynamic(() => import('./SparePartFormModal'))
const SparePartsBulkPriceModal = dynamic(() => import('./SparePartsBulkPriceModal'))
const SparePartsImportModal = dynamic(() => import('./SparePartsImportModal'))

interface SparePartsListProps {
  defaultView?: 'grid' | 'list';
  readOnly?: boolean;
}

export default function SparePartsList({ defaultView = 'list', readOnly = false }: SparePartsListProps) {
  const [loading, setLoading] = useState(true)
  const [spareParts, setSpareParts] = useState<SparePart[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(defaultView)
  const [selectedParts, setSelectedParts] = useState<number[]>([])
  const [showAll, setShowAll] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  })

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null)
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  const fetchingRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchSpareParts = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const params: any = {
        page: pagination.page,
        limit: showAll ? 9999 : pageSize,
        search: debouncedSearchTerm,
        status: selectedStatus === 'All Status' ? undefined : selectedStatus,
        category: selectedCategory === 'All Categories' ? undefined : selectedCategory
      }
      const response = await apiService.getSpareParts(params)
      setSpareParts(response.spareParts || [])
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
        pages: response.pagination?.pages || 1
      }))
    } catch (error) {
      toast.error('Failed to load spare parts')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [pagination.page, pageSize, showAll, debouncedSearchTerm, selectedStatus, selectedCategory])

  useEffect(() => {
    fetchSpareParts()
  }, [fetchSpareParts])

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedStatus('All Status')
    setSelectedCategory('All Categories')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleSelectPart = (id: number) => {
    setSelectedParts(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectedParts(prev => 
      prev.length === spareParts.length ? [] : spareParts.map(p => p.id)
    )
  }

  const getImageUrl = (url: string) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'
    return `${baseUrl}${url}`
  }

  const handleImageUpload = async (file: File) => {
    const imageUrl = await apiService.uploadImage(file)
    return imageUrl
  }

  return (
    <div className="space-y-8 p-0 min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
              <Package className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white mb-1 flex items-center gap-3">
                Inventory Management
                <Sparkles className="w-6 h-6 text-[#CE9F6B]" />
              </h1>
              <p className="text-blue-100 opacity-80">Spare parts catalog and pricing control</p>
            </div>
          </div>
          
          {!readOnly && (
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setShowBulkPriceModal(true)} 
                disabled={selectedParts.length === 0}
                className="bg-white/10 hover:bg-white/20 text-white border-white/10 h-12 rounded-xl"
              >
                ₹ Bulk Pricing ({selectedParts.length})
              </Button>
              <Button 
                onClick={() => setShowImportModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/10 h-12 rounded-xl"
              >
                <Upload className="w-5 h-5 mr-2" /> Import
              </Button>
              <Button 
                onClick={() => { setSelectedPart(null); setShowFormModal(true); }}
                className="bg-white text-[#546A7A] hover:bg-blue-50 h-12 px-6 rounded-xl font-bold shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" /> Add Part
              </Button>
            </div>
          )}
        </div>
      </div>

      <SparePartsStats 
        total={pagination.total} 
        spareParts={spareParts} 
        loading={loading} 
      />

      <SparePartsFilters 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        pageSize={pageSize}
        handlePageSizeChange={(v) => { setPageSize(v); setShowAll(v === 9999); }}
        viewMode={viewMode}
        setViewMode={setViewMode}
        clearFilters={clearFilters}
        total={pagination.total}
        showAll={showAll}
        page={pagination.page}
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200">
          <RefreshCw className="h-12 w-12 animate-spin text-[#6F8A9D] mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Fetching Inventory Data...</p>
        </div>
      ) : spareParts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-xl">
          <Package className="h-20 w-20 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-700">No parts found</h3>
          <p className="text-slate-400 mt-2">Try adjusting your filters or search terms.</p>
        </div>
      ) : viewMode === 'list' ? (
        <SparePartsTable 
          spareParts={spareParts}
          selectedParts={selectedParts}
          handleSelectPart={handleSelectPart}
          handleSelectAll={handleSelectAll}
          handleEditPart={(p) => { 
            if (readOnly) return;
            setSelectedPart(p); 
            setShowFormModal(true); 
          }}
          handleDeletePart={async (id) => {
            if (readOnly) return;
            if (!confirm('Are you sure?')) return;
            await apiService.deleteSparePart(id);
            toast.success('Part deleted');
            fetchSpareParts();
          }}
          getImageUrl={getImageUrl}
        />
      ) : (
        <SparePartsGrid 
          spareParts={spareParts}
          selectedParts={selectedParts}
          handleSelectPart={handleSelectPart}
          handleEditPart={(p) => { 
            if (readOnly) return;
            setSelectedPart(p); 
            setShowFormModal(true); 
          }}
          handleDeletePart={async (id) => {
            if (readOnly) return;
            if (!confirm('Are you sure?')) return;
            await apiService.deleteSparePart(id);
            toast.success('Part deleted');
            fetchSpareParts();
          }}
          getImageUrl={getImageUrl}
        />
      )}

      {/* Pagination */}
      {!showAll && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-4 py-8">
          <Button
            variant="outline"
            onClick={() => setPagination(v => ({ ...v, page: Math.max(1, v.page - 1) }))}
            disabled={pagination.page === 1}
            className="rounded-xl h-12 w-12 p-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="bg-white px-6 py-2.5 rounded-2xl shadow-sm border border-slate-200 font-bold text-[#546A7A]">
            Page {pagination.page} <span className="text-slate-300 mx-2">of</span> {pagination.pages}
          </div>
          <Button
            variant="outline"
            onClick={() => setPagination(v => ({ ...v, page: Math.min(v.pages, v.page + 1) }))}
            disabled={pagination.page === pagination.pages}
            className="rounded-xl h-12 w-12 p-0"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Modals */}
      {!readOnly && (
        <>
          {showFormModal && (
            <SparePartFormModal 
              open={showFormModal}
              onOpenChange={setShowFormModal}
              part={selectedPart}
              onSubmit={async (data) => {
                if (selectedPart) {
                  await apiService.updateSparePart(selectedPart.id, data)
                  toast.success('Part updated successfully')
                } else {
                  await apiService.createSparePart(data)
                  toast.success('Part created successfully')
                }
                fetchSpareParts()
              }}
              onImageUpload={handleImageUpload}
              getImageUrl={getImageUrl}
            />
          )}

          {showBulkPriceModal && (
            <SparePartsBulkPriceModal 
              open={showBulkPriceModal}
              onOpenChange={setShowBulkPriceModal}
              selectedParts={selectedParts}
              spareParts={spareParts}
              onSubmit={async (updates) => {
                await apiService.bulkUpdateSparePartPrices(updates)
                toast.success('Prices updated successfully')
                setSelectedParts([])
                fetchSpareParts()
              }}
            />
          )}

          {showImportModal && (
            <SparePartsImportModal 
              open={showImportModal}
              onOpenChange={setShowImportModal}
              onDownloadTemplate={() => apiService.downloadSparePartImportTemplate()}
              onPreview={(file) => apiService.previewSparePartImport(file)}
              onExecute={(file) => apiService.bulkImportSpareParts(file)}
            />
          )}
        </>
      )}
    </div>
  )
}
