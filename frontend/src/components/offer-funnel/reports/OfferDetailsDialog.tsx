'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Building2, User, MapPin, Phone, Mail, Calendar, DollarSign, FileText, Package, Settings } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatCrLakh, formatINRFull, formatDateSafe } from '@/lib/format';
import { STATUS_COLORS, STAGE_COLORS, PRODUCT_TYPE_COLORS } from '@/types/reports';

interface OfferDetailsDialogProps {
  offerId: number;
  open: boolean;
  onClose: () => void;
}

interface FullOfferDetails {
  id: number;
  offerReferenceNumber: string;
  offerReferenceDate: string | null;
  title: string | null;
  description: string | null;
  productType: string | null;
  lead: string | null;
  company: string | null;
  location: string | null;
  department: string | null;
  registrationDate: string | null;
  contactPersonName: string | null;
  contactNumber: string | null;
  email: string | null;
  machineSerialNumber: string | null;
  status: string;
  stage: string;
  priority: string;
  offerValue: number | null;
  offerMonth: string | null;
  poExpectedMonth: string | null;
  probabilityPercentage: number | null;
  poNumber: string | null;
  poDate: string | null;
  poValue: number | null;
  poReceivedMonth: string | null;
  openFunnel: boolean;
  remarks: string | null;
  bookingDateInSap: string | null;
  offerEnteredInCrm: string | null;
  offerClosedInCrm: string | null;
  customer: {
    id: number;
    companyName: string;
    location: string | null;
    department: string | null;
    contacts?: Array<{
      id: number;
      contactPersonName: string;
      contactNumber: string | null;
      email: string | null;
    }>;
  };
  contact: {
    id: number;
    contactPersonName: string;
    contactNumber: string | null;
    email: string | null;
    designation: string | null;
  };
  zone: {
    id: number;
    name: string;
    shortForm: string;
  };
  assignedTo: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
  } | null;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
  updatedBy: {
    id: number;
    name: string;
    email: string;
  };
  offerSpareParts?: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes: string | null;
    sparePart: {
      id: number;
      name: string;
      partNumber: string;
      description: string | null;
      category: string | null;
      basePrice: number;
    };
  }>;
  offerAssets?: Array<{
    id: number;
    asset: {
      id: number;
      machineId: string;
      serialNo: string | null;
      model: string | null;
      location: string | null;
      customer: {
        id: number;
        companyName: string;
      };
    };
  }>;
  stageRemarks?: Array<{
    id: number;
    stage: string;
    remarks: string;
    createdAt: string;
    createdBy: {
      id: number;
      name: string;
      email: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

const OfferDetailsDialog: React.FC<OfferDetailsDialogProps> = ({
  offerId,
  open,
  onClose,
}) => {
  const [offer, setOffer] = useState<FullOfferDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && offerId) {
      fetchOfferDetails();
    } else {
      setOffer(null);
      setError(null);
    }
  }, [open, offerId]);

  const fetchOfferDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getOffer(offerId);
      if (response.success && response.data?.offer) {
        setOffer(response.data.offer);
      } else if (response?.offer) {
        // Handle direct offer response format
        setOffer(response.offer);
      } else {
        setError('Failed to load offer details');
        toast.error('Failed to load offer details');
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to load offer details';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  // Show error state
  if (error && !loading) {
    return (
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Error Loading Offer</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-[#5D6E73] mb-4">{error}</p>
            <button 
              onClick={() => fetchOfferDetails()}
              className="px-4 py-2 bg-[#6F8A9D] text-white rounded hover:bg-[#546A7A]"
            >
              Retry
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusColor = offer ? (STATUS_COLORS[offer.status] || '#9CA3AF') : '#9CA3AF';
  const stageColor = offer ? (STAGE_COLORS[offer.stage] || '#9CA3AF') : '#9CA3AF';
  const productColor = offer?.productType 
    ? (PRODUCT_TYPE_COLORS[offer.productType] || '#9CA3AF') 
    : '#9CA3AF';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">
            Offer Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 py-4 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#546A7A]" />
              </div>
            ) : offer ? (
              <>
                {/* Header Section with Stage Prominently */}
                <div className="bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 p-6 rounded-lg border border-[#96AEC2]/30 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-[#5D6E73]">Offer Reference</div>
                      <div className="font-bold text-xl text-[#546A7A]">{offer.offerReferenceNumber}</div>
                      {offer.offerReferenceDate && (
                        <div className="text-xs text-[#AEBFC3]0 mt-1">
                          📅 {formatDateSafe(offer.offerReferenceDate)}
                        </div>
                      )}
                      {offer.title && (
                        <div className="text-sm text-[#5D6E73] mt-2">{offer.title}</div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-[#5D6E73] mb-2">Current Stage</div>
                        <Badge 
                          style={{ backgroundColor: stageColor, color: 'white' }}
                          className="text-sm px-4 py-2 font-semibold shadow-lg"
                        >
                          ⚡ {offer.stage}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer & Contact Information */}
                <div className="bg-white rounded-lg border border-[#92A2A5] overflow-hidden">
                  <div className="bg-gradient-to-r from-[#4F6A64] to-[#4F6A64] text-white p-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Customer & Contact Information
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Company Details */}
                      <div className="bg-gradient-to-br from-[#A2B9AF]/10 to-[#A2B9AF]/10 rounded-lg p-4 border border-[#A2B9AF]/30">
                        <h4 className="font-bold text-[#4F6A64] mb-3 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Company Details
                        </h4>
                        <dl className="space-y-2">
                          <div>
                            <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Company Name</dt>
                            <dd className="text-base font-bold text-[#546A7A]">{offer.company || offer.customer?.companyName || 'N/A'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Location</dt>
                            <dd className="text-base font-medium text-[#5D6E73] flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-[#4F6A64]" />
                              {offer.location || offer.customer?.location || 'N/A'}
                            </dd>
                          </div>
                          {offer.department && (
                            <div>
                              <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Department</dt>
                              <dd className="text-base font-medium text-[#5D6E73]">{offer.department}</dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Zone</dt>
                            <dd className="text-base font-medium">
                              <Badge className="bg-[#82A094]/20 text-[#4F6A64] border-[#82A094] border">
                                {offer.zone?.name}
                              </Badge>
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Contact Person */}
                      <div className="bg-gradient-to-br from-[#96AEC2]/10 to-[#6F8A9D]/10 rounded-lg p-4 border border-[#96AEC2]/30">
                        <h4 className="font-bold text-[#546A7A] mb-3 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Contact Person
                        </h4>
                        <dl className="space-y-2">
                          <div>
                            <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Name</dt>
                            <dd className="text-base font-bold text-[#546A7A]">{offer.contactPersonName || offer.contact?.contactPersonName || 'N/A'}</dd>
                          </div>
                          {(offer.contactNumber || offer.contact?.contactNumber) && (
                            <div>
                              <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Phone</dt>
                              <dd className="text-base font-medium text-[#5D6E73] flex items-center gap-1">
                                <Phone className="h-4 w-4 text-[#546A7A]" />
                                {offer.contactNumber || offer.contact?.contactNumber}
                              </dd>
                            </div>
                          )}
                          {(offer.email || offer.contact?.email) && (
                            <div>
                              <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Email</dt>
                              <dd className="text-base font-medium flex items-center gap-1">
                                <Mail className="h-4 w-4 text-[#546A7A]" />
                                <a href={`mailto:${offer.email || offer.contact?.email}`} className="text-[#546A7A] hover:underline">
                                  {offer.email || offer.contact?.email}
                                </a>
                              </dd>
                            </div>
                          )}
                          {offer.contact?.designation && (
                            <div>
                              <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase">Designation</dt>
                              <dd className="text-base font-medium text-[#5D6E73]">{offer.contact.designation}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="bg-white rounded-lg border border-[#92A2A5] overflow-hidden">
                  <div className="bg-gradient-to-r from-[#546A7A] to-[#9E3B47] text-white p-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Financial Information
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-lg p-4 text-white shadow-lg">
                        <div className="text-sm font-semibold text-[#96AEC2] mb-1">Offer Value</div>
                        <div className="text-2xl font-bold">{offer.offerValue ? `₹${(offer.offerValue / 100000).toFixed(2)}L` : 'TBD'}</div>
                      </div>
                      <div className="bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-lg p-4 text-white shadow-lg">
                        <div className="text-sm font-semibold text-[#A2B9AF] mb-1">PO Value</div>
                        <div className="text-2xl font-bold">{offer.poValue ? `₹${(offer.poValue / 100000).toFixed(2)}L` : '-'}</div>
                      </div>
                      <div className="bg-gradient-to-br from-[#6F8A9D] to-[#9E3B47] rounded-lg p-4 text-white shadow-lg">
                        <div className="text-sm font-semibold text-[#6F8A9D] mb-1">Win Probability</div>
                        <div className="text-2xl font-bold">{offer.probabilityPercentage ? `${offer.probabilityPercentage}%` : '-'}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-[#AEBFC3]/10 rounded-lg p-3 border border-[#92A2A5]">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Offer Month</dt>
                        <dd className="text-base font-bold text-[#546A7A] flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-[#546A7A]" />
                          {offer.offerMonth || '-'}
                        </dd>
                      </div>
                      <div className="bg-[#AEBFC3]/10 rounded-lg p-3 border border-[#92A2A5]">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">PO Expected Month</dt>
                        <dd className="text-base font-bold text-[#546A7A] flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-[#4F6A64]" />
                          {offer.poExpectedMonth || '-'}
                        </dd>
                      </div>
                      <div className="bg-[#AEBFC3]/10 rounded-lg p-3 border border-[#92A2A5]">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">PO Number</dt>
                        <dd className="text-base font-bold text-[#546A7A]">{offer.poNumber || '-'}</dd>
                      </div>
                    </div>
                    {offer.poDate && (
                      <div className="bg-[#AEBFC3]/10 rounded-lg p-3 border border-[#92A2A5]">
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">PO Date</dt>
                        <dd className="text-base font-bold text-[#546A7A] flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-[#546A7A]" />
                          {formatDateSafe(offer.poDate)}
                        </dd>
                      </div>
                    )}
                  </div>
                </div>

                {/* Offer Details */}
                <div className="bg-white rounded-lg border border-[#92A2A5] overflow-hidden">
                  <div className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] text-white p-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Offer Details
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Title</dt>
                        <dd className="text-base font-medium text-[#546A7A]">{offer.title || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Product Type</dt>
                        <dd>
                          <Badge style={{ backgroundColor: productColor, color: 'white' }}>
                            {offer.productType || 'N/A'}
                          </Badge>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Lead</dt>
                        <dd className="text-base font-medium text-[#546A7A]">{offer.lead || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Priority</dt>
                        <dd className="text-base font-medium text-[#546A7A]">{offer.priority}</dd>
                      </div>
                    </div>
                    {offer.description && (
                      <div>
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Description</dt>
                        <dd className="text-base font-medium text-[#5D6E73] bg-[#AEBFC3]/10 p-3 rounded border border-[#92A2A5]">{offer.description}</dd>
                      </div>
                    )}
                    {offer.machineSerialNumber && (
                      <div>
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Machine Serial Number</dt>
                        <dd className="text-base font-medium text-[#546A7A]">{offer.machineSerialNumber}</dd>
                      </div>
                    )}
                    {offer.remarks && (
                      <div>
                        <dt className="text-xs text-[#AEBFC3]0 font-semibold uppercase mb-1">Remarks</dt>
                        <dd className="text-base font-medium text-[#5D6E73] bg-[#AEBFC3]/10 p-3 rounded border border-[#92A2A5]">{offer.remarks}</dd>
                      </div>
                    )}
                  </div>
                </div>

                {/* Spare Parts */}
                {offer.offerSpareParts && offer.offerSpareParts.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Spare Parts ({offer.offerSpareParts.length})
                    </h3>
                    <div className="space-y-3">
                      {offer.offerSpareParts.map((part) => (
                        <div key={part.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">{part.sparePart?.name || 'Unnamed Part'}</div>
                              <div className="text-sm text-[#AEBFC3]0">{part.sparePart?.partNumber || 'No Part Number'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">₹{(part.totalPrice || 0).toLocaleString()}</div>
                              <div className="text-xs text-[#AEBFC3]0">
                                {part.quantity || 0} × ₹{(part.unitPrice || 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {part.notes && (
                            <div className="text-sm text-[#5D6E73] mt-2">{part.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assets */}
                {offer.offerAssets && offer.offerAssets.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Linked Machines ({offer.offerAssets.length})
                    </h3>
                    <div className="space-y-3">
                      {offer.offerAssets.map((asset) => (
                        <div key={asset.id} className="border rounded-lg p-4">
                          {asset.asset?.serialNo && (
                            <div className="text-sm mt-1">
                              <span className="font-semibold text-[#546A7A]">Serial No:</span> <span className="text-[#5D6E73]">{asset.asset.serialNo}</span>
                            </div>
                          )}
                          {asset.asset?.model && (
                            <div className="text-sm mt-1">
                              <span className="font-semibold text-[#546A7A]">Model:</span> <span className="text-[#5D6E73]">{asset.asset.model}</span>
                            </div>
                          )}
                          {asset.asset?.customer?.companyName && (
                            <div className="text-sm mt-1">
                              <span className="font-semibold text-[#546A7A]">Customer:</span> <span className="text-[#5D6E73]">{asset.asset.customer.companyName}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage Remarks */}
                {offer.stageRemarks && offer.stageRemarks.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-lg mb-4">Stage Remarks</h3>
                    <div className="space-y-3">
                      {offer.stageRemarks.map((remark) => (
                        <div key={remark.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <Badge>{remark.stage}</Badge>
                            <div className="text-xs text-[#AEBFC3]0">
                              {formatDateSafe(remark.createdAt, 'MMM dd, yyyy HH:mm')}
                            </div>
                          </div>
                          <div className="text-sm text-[#5D6E73] mt-2">{remark.remarks}</div>
                          <div className="text-xs text-[#AEBFC3]0 mt-2">
                            By: {remark.createdBy?.name || 'Unknown'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assignment & Tracking */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-lg mb-4">Assignment & Tracking</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-[#AEBFC3]0">Zone</div>
                      <div className="font-medium">{offer.zone?.name || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-[#AEBFC3]0">Created By</div>
                      <div className="font-medium">{offer.createdBy?.name || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-[#AEBFC3]0">Created At</div>
                      <div className="font-medium">
                        {formatDateSafe(offer.createdAt, 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                {offer.remarks && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-lg mb-4">Remarks</h3>
                    <div className="text-sm text-[#5D6E73] bg-[#AEBFC3]/10 p-4 rounded-lg">
                      {offer.remarks}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-[#AEBFC3]0">
                No offer details found
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default OfferDetailsDialog;

