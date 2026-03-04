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
  poNumber: string | null;
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

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  CRITICAL: '#7C3AED',
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
    <tr className="hover:bg-[#96AEC2]/10/30 transition-colors duration-150 border-b border-[#AEBFC3]/30">
      <td className="py-3 px-4">
        <button 
          onClick={() => onViewOffer(offer.id)}
          className="text-left hover:underline focus:outline-none"
        >
          <div className="font-medium text-[#546A7A] hover:text-[#546A7A] text-sm">
            {offer.offerReferenceNumber}
          </div>
          {offer.title && (
            <div className="text-xs text-[#AEBFC3]0 mt-1">{offer.title}</div>
          )}
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-[#546A7A]">{offer.company || 'N/A'}</div>
        {offer.location && (
          <div className="text-xs text-[#AEBFC3]0 mt-1">{offer.location}</div>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-[#546A7A]">{offer.contact?.contactPersonName || offer.contactPersonName || 'N/A'}</div>
        {(offer.contact?.contactNumber || offer.contactNumber) && (
          <div className="text-xs text-[#AEBFC3]0 mt-1">{offer.contact?.contactNumber || offer.contactNumber}</div>
        )}
      </td>
      <td className="py-3 px-4">
        <Badge 
          style={{ backgroundColor: productColor, color: 'white' }}
          className="text-xs"
        >
          {offer.productType || 'N/A'}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <Badge 
          style={{ backgroundColor: stageColor, color: 'white' }}
          className="text-xs"
        >
          {offer.stage}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-[#546A7A]" title={offer.offerValue ? formatINRFull(offer.offerValue) : undefined}>
          {offer.offerValue ? formatCrLakh(offer.offerValue) : 'N/A'}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-[#5D6E73]">{offer.zone?.name || 'N/A'}</div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-[#546A7A]">{offer.createdBy?.name || 'N/A'}</div>
        <div className="text-xs text-[#AEBFC3]0 mt-0.5">
          {formatDateSafe(offer.createdAt)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-[#546A7A]">
          {offer.poNumber || 'N/A'}
        </div>
        {offer.poValue && (
          <div className="text-xs text-[#AEBFC3]0 mt-0.5" title={formatINRFull(offer.poValue)}>
            {formatCrLakh(offer.poValue)}
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="text-xs text-[#AEBFC3]0">
          {formatDateSafe(offer.updatedAt)}
        </div>
        <div className="text-xs text-[#979796] mt-0.5">
          by {offer.updatedBy?.name || 'Unknown'}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewOffer(offer.id)}
          className="h-8 w-8 p-0 text-[#979796] hover:text-[#5D6E73]"
          title="View details"
        >
          <Eye className="h-4 w-4" />
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
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#546A7A]"></div>
            <p className="mt-4 text-[#5D6E73]">Loading offers...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (offers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offers</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <p className="text-[#5D6E73]">No offers found matching your filters.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offers ({totalOffers})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#AEBFC3]/10">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[150px]">
                  Offer Ref
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[150px]">
                  Company
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[140px]">
                  Contact
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[120px]">
                  Product Type
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[110px]">
                  Stage
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[100px]">
                  Offer Value
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[100px]">
                  Zone
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[120px]">
                  Created By
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[120px]">
                  PO Number
                </th>
                <th className="text-left py-3 px-4 font-medium text-[#5D6E73] text-sm min-w-[120px]">
                  Last Updated
                </th>
                <th className="text-right py-3 px-4 font-medium text-[#5D6E73] text-sm w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} onViewOffer={onViewOffer} />
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#92A2A5]">
            <div className="text-sm text-[#5D6E73]">
              Showing {((currentPage - 1) * 500) + 1} to {Math.min(currentPage * 500, totalOffers)} of {totalOffers} offers
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm text-[#5D6E73]">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
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

