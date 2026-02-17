'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Package
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  SparePart,
  getStatusColor,
  getCategoryColor,
  formatCurrency
} from '@/lib/constants/spare-parts'

interface SparePartsTableProps {
  spareParts: SparePart[];
  selectedParts: number[];
  handleSelectPart: (id: number) => void;
  handleSelectAll: () => void;
  handleEditPart: (part: SparePart) => void;
  handleDeletePart: (id: number) => void;
  getImageUrl: (url: string) => string;
  readOnly?: boolean;
}

export default function SparePartsTable({
  spareParts,
  selectedParts,
  handleSelectPart,
  handleSelectAll,
  handleEditPart,
  handleDeletePart,
  getImageUrl,
  readOnly = false
}: SparePartsTableProps) {
  return (
    <Card className="shadow-2xl border-0 overflow-hidden rounded-2xl bg-white/50 backdrop-blur-md">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-100 to-gray-50 border-b-2 border-slate-200">
              <tr>
                {!readOnly && (
                  <th className="px-6 py-4 text-left">
                    <Checkbox
                      checked={selectedParts.length === spareParts.length && spareParts.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Image</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Part Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Base Price</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Status</th>
                {!readOnly && <th className="px-6 py-4 text-left text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {spareParts.map((part) => (
                <tr key={part.id} className="hover:bg-blue-50/50 transition-colors group">
                  {!readOnly && (
                    <td className="px-6 py-4">
                      <Checkbox
                        checked={selectedParts.includes(part.id)}
                        onCheckedChange={() => handleSelectPart(part.id)}
                      />
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {part.imageUrl ? (
                      <img
                        src={getImageUrl(part.imageUrl)}
                        alt={part.name}
                        className="w-14 h-14 object-cover rounded-xl border border-slate-200 shadow-sm transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#546A7A]">{part.name}</p>
                      <p className="text-[10px] text-[#546A7A] font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                        #{part.partNumber}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm uppercase ${getCategoryColor(part.category)}`}>
                      {part.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-[#546A7A]">
                      {formatCurrency(Number(part.basePrice))}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getStatusColor(part.status)}`}>
                      {part.status}
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => handleEditPart(part)} className="cursor-pointer">
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeletePart(part.id)}
                            className="text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
