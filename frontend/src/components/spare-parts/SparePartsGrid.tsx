'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { 
  Edit, 
  Trash2, 
  Package, 
  Tag 
} from 'lucide-react'
import { 
  SparePart, 
  getStatusColor, 
  getCategoryColor, 
  formatCurrency 
} from '@/lib/constants/spare-parts'

interface SparePartsGridProps {
  spareParts: SparePart[];
  selectedParts: number[];
  handleSelectPart: (id: number) => void;
  handleEditPart: (part: SparePart) => void;
  handleDeletePart: (id: number) => void;
  getImageUrl: (url: string) => string;
}

export default function SparePartsGrid({
  spareParts,
  selectedParts,
  handleSelectPart,
  handleEditPart,
  handleDeletePart,
  getImageUrl
}: SparePartsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {spareParts.map((part) => (
        <Card key={part.id} className="group hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 hover:border-[#6F8A9D] bg-white rounded-2xl relative">
          {/* Checkbox Overlay */}
          <div className="absolute top-4 left-4 z-20">
            <div className="p-1 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm">
              <Checkbox
                checked={selectedParts.includes(part.id)}
                onCheckedChange={() => handleSelectPart(part.id)}
              />
            </div>
          </div>

          <CardContent className="p-0">
            {/* Image Section */}
            <div className="relative h-48 bg-slate-100 overflow-hidden">
              {part.imageUrl ? (
                <img 
                  src={getImageUrl(part.imageUrl)} 
                  alt={part.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package className="h-20 w-20" />
                </div>
              )}
              
              {/* Actions Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleEditPart(part)}
                  className="rounded-xl"
                >
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeletePart(part.id)}
                  className="rounded-xl"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Content Section */}
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <h3 className="font-bold text-[#546A7A] line-clamp-1 h-6">
                  {part.name}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                    #{part.partNumber}
                  </p>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(part.status)}`}>
                    {part.status}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm uppercase ${getCategoryColor(part.category)}`}>
                  <Tag className="h-3 w-3 mr-1" />
                  {part.category}
                </span>
              </div>
              
              <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Price</span>
                <span className="text-xl font-black text-[#546A7A]">
                  {formatCurrency(Number(part.basePrice))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
