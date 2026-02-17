'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import {
  Package,
  Camera,
  Save,
  X,
  RefreshCw
} from 'lucide-react'
import {
  SparePart,
  SPARE_PART_STATUSES,
  SPARE_PART_CATEGORIES
} from '@/lib/constants/spare-parts'

interface SparePartFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: SparePart | null;
  onSubmit: (data: any) => Promise<void>;
  onImageUpload: (file: File) => Promise<string>;
  getImageUrl: (url: string) => string;
}

export default function SparePartFormModal({
  open,
  onOpenChange,
  part,
  onSubmit,
  onImageUpload,
  getImageUrl
}: SparePartFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState<any>({
    name: '',
    partNumber: '',
    description: '',
    category: 'Hardware',
    basePrice: '',
    status: 'ACTIVE',
    imageUrl: ''
  })

  useEffect(() => {
    if (part) {
      setFormData({
        ...part,
        basePrice: part.basePrice.toString()
      })
    } else {
      setFormData({
        name: '',
        partNumber: '',
        description: '',
        category: 'Hardware',
        basePrice: '',
        status: 'ACTIVE',
        imageUrl: ''
      })
    }
  }, [part, open])

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await onImageUpload(file)
      handleInputChange('imageUrl', url)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({
        ...formData,
        basePrice: parseFloat(formData.basePrice)
      })
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white rounded-3xl overflow-hidden p-0 border-0 shadow-2xl">
        <DialogHeader className="bg-slate-50 p-8 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <div className="p-2 bg-[#6F8A9D]/10 rounded-xl">
              <Package className="w-6 h-6 text-[#6F8A9D]" />
            </div>
            {part ? 'Edit Spare Part' : 'Add New Spare Part'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {part ? `Updating record for ${part.name}` : 'Create a new inventory record for spare parts.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Image Upload Area */}
              <div className="w-full md:w-64 space-y-4">
                <Label className="text-[#5D6E73] font-bold uppercase text-[10px] tracking-widest">Part Image</Label>
                <div className="relative aspect-square rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden group">
                  {formData.imageUrl ? (
                    <>
                      <img
                        src={getImageUrl(formData.imageUrl)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInputChange('imageUrl', '');
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Camera className="w-10 h-10" />
                      <p className="text-[10px] uppercase font-bold">Upload Image</p>
                    </div>
                  )}
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-[#6F8A9D]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Fields Area */}
              <div className="flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-500 font-bold">Part Number</Label>
                    <Input
                      required
                      placeholder="e.g. KX-90210"
                      value={formData.partNumber}
                      onChange={(e) => handleInputChange('partNumber', e.target.value)}
                      className="rounded-xl border-[#92A2A5] h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-500 font-bold">Base Price (INR)</Label>
                    <Input
                      required
                      type="number"
                      placeholder="0.00"
                      value={formData.basePrice}
                      onChange={(e) => handleInputChange('basePrice', e.target.value)}
                      className="rounded-xl border-[#92A2A5] h-11 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-500 font-bold">Part Name</Label>
                  <Input
                    required
                    placeholder="e.g. Heavy Duty Gear Shaft"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="rounded-xl border-[#92A2A5] h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-500 font-bold">Category</Label>
                    <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                      <SelectTrigger className="rounded-xl border-[#92A2A5] h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPARE_PART_CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-500 font-bold">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                      <SelectTrigger className="rounded-xl border-[#92A2A5] h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPARE_PART_STATUSES.filter(s => s !== 'All Status').map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-500 font-bold">Detailed Description</Label>
                  <Textarea
                    placeholder="Enter technical specifications and usage details..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="rounded-xl border-[#92A2A5] min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-8 pt-0 gap-3 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-12 flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-xl h-12 flex-1 bg-[#546A7A] hover:bg-[#6F8A9D] shadow-lg font-bold">
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (
                <><Save className="w-5 h-5 mr-2" /> {part ? 'Update Part' : 'Save New Part'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
