'use client';

import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { STAGE_COLORS, PRODUCT_TYPE_COLORS } from '@/types/reports';
import { formatCrLakh, formatINRFull, formatDateSafe } from '@/lib/format';

interface Offer {
  id: number;
  offerReferenceNumber: string;
  offerReferenceDate: string | null;
  title: string | null;
  productType: string | null;
  company: string | null;
  location: string | null;
  contactPersonName: string | null;
  contactNumber: string | null;
  email: string | null;
  status: string;
  stage: string;
  priority: string;
  offerValue: number | null;
  probabilityPercentage: number | null;
  poNumber: string | null;
  poReceivedMonth: string | null;
  poValue: number | null;
  contact?: {
    id: number;
    contactPersonName: string;
    contactNumber: string | null;
    email: string | null;
  } | null;
  zone: {
    id: number;
    name: string;
    shortForm: string;
  };
  assignedTo?: {
    id: number;
    name: string;
  } | null;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
  updatedBy: {
    id: number;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Kardex Company Priority Colors
const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#A2B9AF',      // Green 1
  MEDIUM: '#EEC18F',   // Sand 1
  HIGH: '#E17F70',     // Red 1
  CRITICAL: '#9E3B47', // Red 2
};

interface ReportsTableProps {
  offers: Offer[];
  loading: boolean;
  onViewOffer: (offerId: number) => void;
  currentPage: number;
  totalPages: number;
  totalOffers: number;
  onPageChange: (page: number) => void;
}

const OfferRow = memo(({ offer, onViewOffer }: { offer: Offer; onViewOffer: (id: number) => void }) => {
  const stageColor = useMemo(() => STAGE_COLORS[offer.stage] || '#9CA3AF', [offer.stage]);
  const productColor = useMemo(() => 
    offer.productType ? (PRODUCT_TYPE_COLORS[offer.productType] || '#9CA3AF') : '#9CA3AF',
    [offer.productType]
  );

  return (
    <tr className="hover:bg-[#96AEC2]/10 transition-all duration-200 border-b border-[#AEBFC3]/30 group">
      <td className="py-3.5 px-4">
        <button 
          onClick={() => onViewOffer(offer.id)}
          className="text-left hover:underline focus:outline-none group/link"
        >
          <div className="font-semibold text-[#6F8A9D] hover:text-[#546A7A] text-sm group-hover/link:underline">
            {offer.offerReferenceNumber}
          </div>
          {offer.title && (
            <div className="text-xs text-[#AEBFC3]0 mt-1 line-clamp-1">{offer.title}</div>
          )}
        </button>
      </td>
      <td className="py-3.5 px-4">
        <div className="text-sm font-medium text-[#546A7A]">{offer.company || 'N/A'}</div>
        {offer.location && (
          <div className="text-xs text-[#AEBFC3]0 mt-1">{offer.location}</div>
        )}
      </td>
      <td className="py-3.5 px-4">
        <div className="text-sm text-[#546A7A]">{offer.contact?.contactPersonName || offer.contactPersonName || 'N/A'}</div>
        {(offer.contact?.contactNumber || offer.contactNumber) && (
          <div className="text-xs text-[#AEBFC3]0 mt-1">{offer.contact?.contactNumber || offer.contactNumber}</div>
        )}
      </td>
      <td className="py-3.5 px-4">
        <Badge 
          style={{ backgroundColor: productColor, color: 'white' }}
          className="text-xs font-medium shadow-sm"
        >
          {offer.productType || 'N/A'}
        </Badge>
      </td>
      <td className="py-3.5 px-4">
        <Badge 
          style={{ backgroundColor: stageColor, color: 'white' }}
          className="text-xs font-medium shadow-sm"
        >
          {offer.stage}
        </Badge>
      </td>
      <td className="py-3.5 px-4">
        <div className="text-sm font-semibold text-[#546A7A]" title={offer.offerValue ? formatINRFull(offer.offerValue) : undefined}>
          {offer.offerValue ? formatCrLakh(offer.offerValue) : 'N/A'}
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="text-sm text-[#5D6E73] font-medium">{offer.zone.name}</div>
      </td>
      <td className="py-3.5 px-4">
        <div className="text-sm font-medium text-[#546A7A] flex items-center gap-1.5">
          {offer.probabilityPercentage ? (
            <Badge className={`${
              offer.probabilityPercentage >= 70 ? 'bg-emerald-500' : 
              offer.probabilityPercentage >= 40 ? 'bg-amber-500' : 'bg-red-500'
            } text-white px-1.5 py-0 h-5 text-[10px] font-bold`}>
              {offer.probabilityPercentage}%
            </Badge>
          ) : (
            <span className="text-[#AEBFC3]">-</span>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="text-sm text-[#546A7A] font-semibold">{offer.assignedTo?.name || offer.createdBy.name}</div>
        {offer.assignedTo && offer.assignedTo.name !== offer.createdBy.name && (
          <div className="text-[10px] text-[#AEBFC3] mt-0.5">Created by {offer.createdBy.name}</div>
        )}
        <div className="text-[10px] text-[#979796] mt-0.5" title="Offer Date">
          {formatDateSafe(offer.offerReferenceDate || offer.createdAt, 'MMM dd, yyyy')}
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="text-sm text-[#546A7A] font-medium">
          {offer.poNumber || 'N/A'}
        </div>
        <div className="flex flex-col gap-0.5 mt-0.5">
          {offer.poValue && (
            <div className="text-xs font-semibold text-[#4F6A64]" title={formatINRFull(offer.poValue)}>
              {formatCrLakh(offer.poValue)}
            </div>
          )}
          {offer.poReceivedMonth && (
            <div className="text-[10px] text-[#AEBFC3] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Won: {offer.poReceivedMonth}
            </div>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="text-xs text-[#AEBFC3]">
          {formatDateSafe(offer.updatedAt, 'MMM dd, yyyy')}
        </div>
        <div className="text-xs text-[#979796] mt-0.5">
          by {offer.updatedBy.name}
        </div>
      </td>
      <td className="py-3.5 px-4 text-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewOffer(offer.id)}
          className="h-8 px-3 text-[#6F8A9D] border-[#96AEC2]/50 hover:bg-[#96AEC2]/10 hover:border-[#6F8A9D] hover:text-[#546A7A] transition-all duration-200 shadow-sm"
          title="View details"
        >
          <Eye className="h-4 w-4 mr-1.5" />
          <span className="text-xs font-medium">View</span>
        </Button>
      </td>
    </tr>
  );
});

OfferRow.displayName = 'OfferRow';

const ReportsTable: React.FC<ReportsTableProps> = ({
  offers,
  loading,
  onViewOffer,
  currentPage,
  totalPages,
  totalOffers,
  onPageChange,
}) => {
  if (loading && offers.length === 0) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#96AEC2]/30 border-t-[#6F8A9D]"></div>
            <p className="mt-4 text-[#5D6E73] font-medium">Loading offers...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (offers.length === 0) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20 border-b border-[#92A2A5]">
          <CardTitle className="text-lg font-bold text-[#546A7A]">Offers</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#AEBFC3]/20 rounded-full flex items-center justify-center">
              <Eye className="h-8 w-8 text-[#979796]" />
            </div>
            <p className="text-[#5D6E73] font-medium">No offers found matching your filters.</p>
            <p className="text-sm text-[#979796] mt-1">Try adjusting your search criteria</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20 border-b border-[#92A2A5] py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-[#546A7A] flex items-center gap-2">
            <div className="p-1.5 bg-[#96AEC2]/20 rounded-lg">
              <Eye className="h-4 w-4 text-[#6F8A9D]" />
            </div>
            Offers 
            <span className="px-2.5 py-0.5 bg-[#6F8A9D] text-white text-sm rounded-full font-semibold">
              {totalOffers}
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20 border-b-2 border-[#92A2A5]">
              <tr>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[150px]">
                  Offer Ref
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[150px]">
                  Company
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[140px]">
                  Contact
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[120px]">
                  Product Type
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[110px]">
                  Stage
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[100px]">
                  Offer Value
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[100px]">
                  Zone
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[80px]">
                  Prob%
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[130px]">
                  Assigned To
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[120px]">
                  PO Number
                </th>
                <th className="text-left py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider min-w-[120px]">
                  Last Updated
                </th>
                <th className="text-center py-3.5 px-4 font-semibold text-[#5D6E73] text-xs uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} onViewOffer={onViewOffer} />
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-[#92A2A5] bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/10">
            <div className="text-sm text-[#5D6E73] font-medium">
              Showing <span className="text-[#546A7A] font-semibold">{((currentPage - 1) * 500) + 1}</span> to <span className="text-[#546A7A] font-semibold">{Math.min(currentPage * 500, totalOffers)}</span> of <span className="text-[#6F8A9D] font-semibold">{totalOffers}</span> offers
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-9 px-3 border-[#92A2A5] hover:bg-[#AEBFC3]/20 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium text-[#5D6E73] px-3 py-1.5 bg-white rounded-lg border border-[#92A2A5] shadow-sm">
                Page <span className="text-[#6F8A9D]">{currentPage}</span> of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-9 px-3 border-[#92A2A5] hover:bg-[#AEBFC3]/20 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportsTable;

