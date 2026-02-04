'use client'

import { Card, CardContent } from '@/components/ui/card'
import { 
  Package, 
  Sparkles, 
  TrendingUp, 
  Tag 
} from 'lucide-react'
import { formatCurrency, SparePart } from '@/lib/constants/spare-parts'

interface SparePartsStatsProps {
  total: number;
  spareParts: SparePart[];
  loading: boolean;
}

export default function SparePartsStats({ total, spareParts, loading }: SparePartsStatsProps) {
  const activeCount = spareParts.filter(p => p.status === 'ACTIVE').length;
  const avgPrice = spareParts.length > 0 
    ? spareParts.reduce((sum, p) => sum + Number(p.basePrice), 0) / spareParts.length 
    : 0;
  const categoriesCount = new Set(spareParts.map(p => p.category).filter(Boolean)).size;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      <StatCard 
        label="Total Parts" 
        value={total} 
        icon={<Package className="h-6 w-6 text-white" />} 
        colorClass="from-[#6F8A9D] to-[#6F8A9D]" 
        borderColor="hover:border-[#96AEC2]"
      />
      <StatCard 
        label="Active Parts" 
        value={activeCount} 
        icon={<Sparkles className="h-6 w-6 text-white" />} 
        colorClass="from-[#82A094] to-[#82A094]" 
        borderColor="hover:border-[#A2B9AF]/40"
      />
      <StatCard 
        label="Avg. Price" 
        value={formatCurrency(avgPrice)} 
        icon={<TrendingUp className="h-6 w-6 text-white" />} 
        colorClass="from-[#CE9F6B] to-[#976E44]" 
        borderColor="hover:border-[#CE9F6B]/40"
      />
      <StatCard 
        label="Categories" 
        value={categoriesCount} 
        icon={<Tag className="h-6 w-6 text-white" />} 
        colorClass="from-[#6F8A9D] to-[#6F8A9D]" 
        borderColor="hover:border-[#6F8A9D]"
      />
    </div>
  )
}

function StatCard({ label, value, icon, colorClass, borderColor }: any) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl transition-all duration-500 border border-[#AEBFC3]/20 ${borderColor}`}>
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-100 to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-bold text-[#5D6E73] uppercase tracking-widest mb-1">{label}</p>
            <p className="text-4xl font-black text-[#546A7A]">{value}</p>
          </div>
          <div className={`p-3 bg-gradient-to-br ${colorClass} rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  )
}
