'use client'

import { useState } from 'react'
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
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle 
} from 'lucide-react'
import { formatCurrency, SparePart } from '@/lib/constants/spare-parts'

interface SparePartsBulkPriceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedParts: number[];
  spareParts: SparePart[];
  onSubmit: (updates: any[]) => Promise<void>;
}

export default function SparePartsBulkPriceModal({
  open,
  onOpenChange,
  selectedParts,
  spareParts,
  onSubmit
}: SparePartsBulkPriceModalProps) {
  const [loading, setLoading] = useState(false)
  const [bulkPriceType, setBulkPriceType] = useState<'percentage' | 'fixed' | 'individual'>('percentage')
  const [bulkPriceOperation, setBulkPriceOperation] = useState<'increase' | 'decrease' | 'set'>('increase')
  const [bulkPriceValue, setBulkPriceValue] = useState('')
  const [individualPrices, setIndividualPrices] = useState<Record<number, string>>({})

  const calculateNewPrice = (currentPrice: number): number => {
    const value = parseFloat(bulkPriceValue)
    if (isNaN(value)) return currentPrice

    if (bulkPriceType === 'percentage') {
      if (bulkPriceOperation === 'increase') return currentPrice * (1 + value / 100)
      if (bulkPriceOperation === 'decrease') return currentPrice * (1 - value / 100)
    } else if (bulkPriceType === 'fixed') {
      if (bulkPriceOperation === 'increase') return currentPrice + value
      if (bulkPriceOperation === 'decrease') return currentPrice - value
      if (bulkPriceOperation === 'set') return value
    }
    return currentPrice
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      let updates: any[] = []
      if (bulkPriceType === 'individual') {
        updates = Object.entries(individualPrices).map(([id, price]) => ({
          id: parseInt(id),
          basePrice: parseFloat(price)
        }))
      } else {
        updates = selectedParts.map(partId => {
          const part = spareParts.find(p => p.id === partId)
          if (!part) return null
          const newPrice = calculateNewPrice(part.basePrice)
          return { id: partId, basePrice: Math.max(0, newPrice) }
        }).filter(Boolean)
      }
      await onSubmit(updates)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-[#96AEC2]/30 shadow-2xl rounded-3xl overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white p-8 -m-6 mb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[#CE9F6B]" />
            Bulk Price Update
          </DialogTitle>
          <DialogDescription className="text-blue-100 text-base">
            Update prices for {selectedParts.length} selected items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#5D6E73] font-bold">Update Strategy</Label>
              <Select value={bulkPriceType} onValueChange={(v: any) => setBulkPriceType(v)}>
                <SelectTrigger className="h-12 rounded-xl border-[#92A2A5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">📈 Percentage (%)</SelectItem>
                  <SelectItem value="fixed">💰 Fixed Amount (Auto)</SelectItem>
                  <SelectItem value="individual">🖐️ Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkPriceType !== 'individual' && (
              <div className="space-y-2">
                <Label className="text-[#5D6E73] font-bold">Operation</Label>
                <Select value={bulkPriceOperation} onValueChange={(v: any) => setBulkPriceOperation(v)}>
                  <SelectTrigger className="h-12 rounded-xl border-[#92A2A5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">➕ Increase</SelectItem>
                    <SelectItem value="decrease">➖ Decrease</SelectItem>
                    {bulkPriceType === 'fixed' && <SelectItem value="set">🎯 Set Fixed Price</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {bulkPriceType !== 'individual' ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-6">
              <div className="flex-1 space-y-2">
                <Label className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                  Value ({bulkPriceType === 'percentage' ? '%' : '₹'})
                </Label>
                <Input
                  type="number"
                  placeholder="Enter adjustment..."
                  value={bulkPriceValue}
                  onChange={(e) => setBulkPriceValue(e.target.value)}
                  className="h-12 rounded-xl border-[#92A2A5] font-black text-xl"
                />
              </div>
              <div className="w-px h-16 bg-slate-200" />
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Impact Example</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 line-through text-sm">₹1,000</span>
                  <span className="text-2xl font-black text-[#82A094]">
                    {formatCurrency(calculateNewPrice(1000))}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-64 rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="space-y-3">
                {selectedParts.map(id => {
                  const part = spareParts.find(p => p.id === id)
                  return (
                    <div key={id} className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold text-slate-700 truncate">{part?.name}</p>
                        <p className="text-[10px] text-slate-400">Current: {formatCurrency(part?.basePrice || 0)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">₹</span>
                        <Input
                          type="number"
                          className="w-24 h-9 rounded-lg"
                          value={individualPrices[id] || ''}
                          onChange={(e) => setIndividualPrices(prev => ({ ...prev, [id]: e.target.value }))}
                          placeholder="New"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}

          <div className="bg-orange-50/50 p-4 border border-orange-100 rounded-2xl flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-800 leading-relaxed">
              <strong>Caution:</strong> This action will update pricing records in the production database. Ensure your calculations are verified before applying.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-8 gap-3 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-12 flex-1">Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (bulkPriceType !== 'individual' && !bulkPriceValue)}
            className="rounded-xl h-12 flex-1 bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] hover:opacity-90 shadow-lg"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Confirm Pricing Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
