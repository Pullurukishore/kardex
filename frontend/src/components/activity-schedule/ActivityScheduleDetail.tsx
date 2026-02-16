'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader,
  ArrowLeft,
  Pencil as Edit2,
  Trash2,
  CheckCheck,
  X,
  Activity,
  Timer,
  Layers,
  ArrowRight,
  FileText,
  Clock as ClockIcon,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ActivityScheduleDetailProps {
  schedule: any;
  onBack?: () => void;
  onEdit?: () => void;
  onRefresh?: () => void;
}

export default function ActivityScheduleDetail({
  schedule,
  onBack,
  onEdit,
  onRefresh,
}: ActivityScheduleDetailProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]';
      case 'ACCEPTED':
        return 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094]';
      case 'COMPLETED':
        return 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]';
      case 'REJECTED':
        return 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]';
      case 'CANCELLED':
        return 'bg-[#AEBFC3]/20 text-[#546A7A] border-[#92A2A5]';
      default:
        return 'bg-[#AEBFC3]/20 text-[#546A7A] border-[#92A2A5]';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-[#E17F70]/20 text-[#75242D]';
      case 'HIGH':
        return 'bg-[#CE9F6B]/20 text-[#976E44]';
      case 'MEDIUM':
        return 'bg-[#96AEC2]/20 text-[#546A7A]';
      case 'LOW':
        return 'bg-[#A2B9AF]/20 text-[#4F6A64]';
      default:
        return 'bg-[#AEBFC3]/20 text-[#546A7A]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <AlertCircle className="h-5 w-5" />;
      case 'ACCEPTED':
        return <CheckCircle className="h-5 w-5" />;
      case 'COMPLETED':
        return <CheckCheck className="h-5 w-5" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5" />;
      case 'CANCELLED':
        return <X className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatSimpleDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDurationMinutes = (start: string, end?: string) => {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) return '';
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      const response = await apiClient.patch(`/activity-schedule/${schedule.id}/complete`);

      if (response.success) {
        toast.success('Schedule marked as completed');
        setShowCompleteDialog(false);
        onRefresh?.();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.patch(`/activity-schedule/${schedule.id}/cancel`, {
        reason: cancelReason,
      });

      if (response.success) {
        toast.success('Schedule cancelled');
        setShowCancelDialog(false);
        setCancelReason('');
        onRefresh?.();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEdit = schedule.status === 'PENDING';
  const canComplete = schedule.status === 'ACCEPTED';
  const canCancel = schedule.status === 'PENDING';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-[#546A7A]">{schedule.title}</h1>
            <p className="text-[#5D6E73] mt-1">Activity Schedule Details</p>
          </div>
        </div>
        <Badge className={`${getStatusColor(schedule.status)} border`}>
          {getStatusIcon(schedule.status)}
          <span className="ml-2">{schedule.status}</span>
        </Badge>
      </div>

      {/* Main Content - Consolidated Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - All Details in One Card */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 border-b">
              <CardTitle className="text-xl font-semibold text-[#546A7A] flex items-center gap-3">
                <div className="p-2 bg-[#6F8A9D] rounded-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                Schedule Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#546A7A] border-b pb-2">Basic Information</h3>
                {schedule.description && (
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Description</label>
                    <p className="text-[#546A7A] mt-1">{schedule.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Activity Type</label>
                    <p className="text-[#546A7A] mt-1 font-medium">{schedule.activityType.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Priority</label>
                    <Badge className={getPriorityColor(schedule.priority)} style={{ marginTop: '0.25rem' }}>
                      {schedule.priority}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Status</label>
                    <div className="mt-1">
                      <Badge className={`${getStatusColor(schedule.status)} border`}>
                        {getStatusIcon(schedule.status)}
                        <span className="ml-2">{schedule.status}</span>
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2 border-b pb-2">
                  <Calendar className="h-5 w-5" />
                  Schedule Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Scheduled Date & Time</label>
                    <p className="text-[#546A7A] mt-1">{formatDate(schedule.scheduledDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Estimated Duration</label>
                    <p className="text-[#546A7A] mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {schedule.estimatedDuration ? (
                        <>
                          {schedule.estimatedDuration >= 1
                            ? `${Math.floor(schedule.estimatedDuration)} hour${Math.floor(schedule.estimatedDuration) !== 1 ? 's' : ''} ${(schedule.estimatedDuration % 1) * 60 > 0 ? `${Math.round((schedule.estimatedDuration % 1) * 60)} min` : ''}`
                            : `${Math.round(schedule.estimatedDuration * 60)} minutes`
                          }
                        </>
                      ) : (
                        <span className="text-[#AEBFC3]0">Not specified</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Section */}
              {schedule.location && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2 border-b pb-2">
                    <MapPin className="h-5 w-5" />
                    Location
                  </h3>
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Address</label>
                    <p className="text-[#546A7A] mt-1">{schedule.location}</p>
                  </div>
                  {schedule.latitude && schedule.longitude && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-[#5D6E73]">Latitude</label>
                        <p className="text-[#546A7A] mt-1 font-mono text-sm">{schedule.latitude}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-[#5D6E73]">Longitude</label>
                        <p className="text-[#546A7A] mt-1 font-mono text-sm">{schedule.longitude}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Zone, Customer & Assets Section - Combined */}
              {((schedule.zone || schedule.customer) || (schedule.assets && schedule.assets.length > 0)) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#546A7A] border-b pb-2">Zone, Customer & Assets</h3>

                  {/* Zone & Customer Cards */}
                  {(schedule.zone || schedule.customer) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schedule.zone && (
                        <div className="p-3 bg-[#CE9F6B]/10 rounded-lg border border-[#CE9F6B]">
                          <label className="text-sm font-medium text-[#5D6E73]">Service Zone</label>
                          <p className="text-[#546A7A] mt-1 font-medium">{schedule.zone.name}</p>
                        </div>
                      )}
                      {schedule.customer && (
                        <div className="p-3 bg-[#CE9F6B]/10 rounded-lg border border-[#CE9F6B]/50">
                          <label className="text-sm font-medium text-[#5D6E73]">Customer</label>
                          <p className="text-[#546A7A] mt-1 font-medium">{schedule.customer.companyName}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assets */}
                  {(schedule.assets?.length > 0 || schedule.ticket?.asset || schedule.activityType === 'TICKET_WORK') && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-[#5D6E73] flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        {schedule.activityType === 'TICKET_WORK' ? 'Work Assets' : 'Assets'} ({
                          (schedule.assets?.length || 0) + (schedule.ticket?.asset ? (schedule.assets?.some((a: any) => a.id === schedule.ticket.asset.id) ? 0 : 1) : 0)
                        })
                      </h4>

                      {(() => {
                        const displayAssets = [...(schedule.assets || [])];
                        if (schedule.ticket?.asset) {
                          const ticketAssetId = schedule.ticket.asset.id;
                          if (!displayAssets.some((a: any) => a.id === ticketAssetId)) {
                            displayAssets.push(schedule.ticket.asset);
                          }
                        }

                        if (displayAssets.length > 0) {
                          return displayAssets.map((asset: any) => (
                            <div key={asset.id} className="p-4 bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 rounded-lg border border-[#A2B9AF]">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-[#4F6A64] rounded-lg">
                                      <Layers className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-[#546A7A]">{asset.model}</p>
                                      <p className="text-sm text-[#5D6E73]">Serial: {asset.serialNo}</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                    <div>
                                      <label className="text-xs font-medium text-[#AEBFC3]0">Serial Number</label>
                                      <p className="text-sm font-mono text-[#546A7A] mt-1">{asset.serialNo}</p>
                                    </div>
                                    {asset.location && (
                                      <div>
                                        <label className="text-xs font-medium text-[#AEBFC3]0">Asset Location</label>
                                        <p className="text-sm text-[#546A7A] mt-1 flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {asset.location}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ));
                        } else {
                          return (
                            <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                              <p className="text-[#AEBFC3]0 text-sm">No asset assigned</p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Legacy Asset IDs */}
              {(!schedule.assets || schedule.assets.length === 0) && schedule.assetIds && schedule.assetIds.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#546A7A] border-b pb-2">Legacy Assets</h3>
                  <div className="space-y-2">
                    {schedule.assetIds.map((assetId: any, index: number) => (
                      <div key={index} className="p-3 bg-[#A2B9AF]/10 rounded-lg border border-[#A2B9AF]">
                        <p className="text-[#546A7A] font-medium">Asset ID: {assetId}</p>
                        <p className="text-sm text-[#5D6E73] mt-1">Note: Asset details not available</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* Right Column - People & Actions in One Card */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/10 border-b">
              <CardTitle className="text-xl font-semibold text-[#546A7A] flex items-center gap-3">
                <div className="p-2 bg-[#546A7A] rounded-lg">
                  <User className="h-5 w-5 text-white" />
                </div>
                People & Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Service Person Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#546A7A] flex items-center gap-2 border-b pb-2">
                  <User className="h-5 w-5" />
                  Service Person
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Name</label>
                    <p className="text-[#546A7A] font-semibold mt-1">{schedule.servicePerson.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Email</label>
                    <a href={`mailto:${schedule.servicePerson.email}`} className="text-[#546A7A] hover:text-[#546A7A] mt-1 block">
                      {schedule.servicePerson.email}
                    </a>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Phone</label>
                    <a href={`tel:${schedule.servicePerson.phone}`} className="text-[#546A7A] hover:text-[#546A7A] mt-1 block">
                      {schedule.servicePerson.phone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Scheduled By Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#546A7A] border-b pb-2">Scheduled By</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Name</label>
                    <p className="text-[#546A7A] font-semibold mt-1">{schedule.scheduledBy.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#5D6E73]">Email</label>
                    <a href={`mailto:${schedule.scheduledBy.email}`} className="text-[#546A7A] hover:text-[#546A7A] mt-1 block">
                      {schedule.scheduledBy.email}
                    </a>
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#546A7A] border-b pb-2">Actions</h3>
                <div className="space-y-3">
                  {canEdit && onEdit && (
                    <Button
                      onClick={onEdit}
                      className="w-full bg-[#6F8A9D] hover:bg-[#546A7A]"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Schedule
                    </Button>
                  )}

                  {canComplete && (
                    <Button
                      onClick={() => setShowCompleteDialog(true)}
                      className="w-full bg-[#4F6A64] hover:bg-[#4F6A64]"
                    >
                      <CheckCheck className="h-4 w-4 mr-2" />
                      Mark as Completed
                    </Button>
                  )}

                  {canCancel && (
                    <Button
                      onClick={() => setShowCancelDialog(true)}
                      variant="destructive"
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Schedule
                    </Button>
                  )}

                  {/* Show status if no actions available */}
                  {!canEdit && !canComplete && !canCancel && (
                    <div className="text-center py-4">
                      <p className="text-[#AEBFC3]0 text-sm">No actions available</p>
                      <p className="text-[#979796] text-xs mt-1">Schedule status: {schedule.status}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Timeline Card */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 border-b">
              <CardTitle className="text-xl font-semibold text-[#546A7A] flex items-center gap-3">
                <div className="p-2 bg-[#6F8A9D] rounded-lg">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                Status Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {/* Created */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-[#96AEC2]/100 rounded-full mt-1.5"></div>
                    <div className="w-0.5 h-12 bg-[#92A2A5]/30 mt-2"></div>
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-[#546A7A]">Created</p>
                    <p className="text-sm text-[#5D6E73]">{formatDate(schedule.createdAt)}</p>
                  </div>
                </div>

                {/* Accepted */}
                {schedule.acceptedAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-[#A2B9AF]/100 rounded-full mt-1.5"></div>
                      <div className="w-0.5 h-12 bg-[#92A2A5]/30 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <p className="font-medium text-[#546A7A]">Accepted</p>
                      <p className="text-sm text-[#5D6E73]">{formatDate(schedule.acceptedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Rejected */}
                {schedule.rejectedAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-[#E17F70]/100 rounded-full mt-1.5"></div>
                      <div className="w-0.5 h-12 bg-[#92A2A5]/30 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <p className="font-medium text-[#546A7A]">Rejected</p>
                      <p className="text-sm text-[#5D6E73]">{formatDate(schedule.rejectedAt)}</p>
                      {schedule.rejectionReason && (
                        <p className="text-sm text-[#5D6E73] mt-1">Reason: {schedule.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {schedule.completedAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-[#96AEC2]/100 rounded-full mt-1.5"></div>
                    </div>
                    <div>
                      <p className="font-medium text-[#546A7A]">Completed</p>
                      <p className="text-sm text-[#5D6E73]">{formatDate(schedule.completedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Field Execution - Activities & Stages - Full Width Card */}
      {schedule.relatedActivities && schedule.relatedActivities.length > 0 && (
        <Card className="border-0 shadow-lg w-full">
          <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 border-b">
            <CardTitle className="text-xl font-semibold text-[#546A7A] flex items-center gap-3">
              <div className="p-2 bg-[#6F8A9D] rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              Field Execution - Activities & Stages
            </CardTitle>
            <p className="text-sm text-[#5D6E73]">
              Complete timeline of all activities logged against this schedule, including location, GPS quality and photos.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {schedule.relatedActivities.map((activity: any) => (
                <Card
                  key={activity.id}
                  className="border border-[#96AEC2]/30 bg-[#96AEC2]/10/40 w-full"
                >
                  <CardHeader className="pb-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-2 rounded-lg bg-[#6F8A9D] text-white flex-shrink-0">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#546A7A] truncate">
                            {activity.title || activity.activityType?.replace(/_/g, ' ') || 'Activity'}
                          </p>
                          <p className="text-xs text-[#AEBFC3]0 truncate">
                            Type: {activity.activityType?.replace(/_/g, ' ') || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-[#AEBFC3]0 flex flex-col items-end">
                        <span>{formatSimpleDate(activity.startTime)}</span>
                        <span className="flex items-center gap-1 mt-1">
                          <Timer className="h-3 w-3" />
                          {formatDurationMinutes(activity.startTime, activity.endTime)}
                        </span>
                      </div>
                    </div>
                    {activity.ticket && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-[#546A7A]">Ticket #{activity.ticket.id}</span>
                        <Badge className="bg-[#96AEC2]/20 text-[#546A7A]">
                          {activity.ticket.status}
                        </Badge>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 pb-4">
                    {activity.ActivityStage && activity.ActivityStage.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-[#5D6E73] mb-3">
                          Stage Flow
                        </p>
                        <div className="space-y-3">
                          {activity.ActivityStage.map((stage: any, index: number) => {
                            const meta = stage.metadata || {};
                            const locationSource = meta.locationSource as string | undefined;
                            const accuracyRaw = (meta.accuracy as any) ?? undefined;
                            const accuracy = typeof accuracyRaw === 'number'
                              ? accuracyRaw
                              : accuracyRaw
                                ? parseFloat(accuracyRaw)
                                : undefined;
                            const photos = Array.isArray(meta.photos) ? meta.photos : [];

                            return (
                              <div key={stage.id} className="flex gap-3">
                                <div className="flex flex-col items-center mt-1">
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#96AEC2]/100" />
                                  {index < activity.ActivityStage.length - 1 && (
                                    <div className="w-0.5 flex-1 bg-[#92A2A5]/30 mt-1" />
                                  )}
                                </div>
                                <div className="flex-1 pb-3 border-b border-dashed border-[#92A2A5] last:border-b-0">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                      <Badge className="bg-white text-[#546A7A] border-[#92A2A5] text-xs">
                                        {stage.stage?.replace(/_/g, ' ') || 'Stage'}
                                      </Badge>
                                      {locationSource === 'manual' && (
                                        <Badge className="bg-[#96AEC2]/10 text-[#546A7A] border-[#96AEC2] text-[10px]">
                                          Manual Location
                                        </Badge>
                                      )}
                                      {locationSource === 'gps' && typeof accuracy === 'number' && (
                                        <Badge className="bg-[#A2B9AF]/10 text-[#4F6A64] border-[#A2B9AF] text-[10px]">
                                          GPS ±{Math.round(accuracy)}m
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-right text-[11px] text-[#AEBFC3]0 flex flex-col items-end">
                                      <span>
                                        {formatTime(stage.startTime)}
                                        {stage.endTime && ` → ${formatTime(stage.endTime)}`}
                                      </span>
                                      <span className="flex items-center gap-1 mt-0.5">
                                        <Timer className="h-3 w-3" />
                                        {formatDurationMinutes(stage.startTime, stage.endTime)}
                                      </span>
                                    </div>
                                  </div>
                                  {stage.location && (
                                    <div className="mt-2 flex items-start gap-1.5">
                                      <MapPin className="h-3 w-3 text-[#AEBFC3]0 mt-0.5" />
                                      <p className="text-xs text-[#5D6E73] break-words">
                                        {stage.location}
                                      </p>
                                    </div>
                                  )}
                                  {stage.notes && (
                                    <p className="mt-1 text-xs text-[#5D6E73]">
                                      Notes: {stage.notes}
                                    </p>
                                  )}
                                  {photos.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-[11px] font-medium text-[#5D6E73] mb-3">
                                        Photos ({photos.length})
                                      </p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {photos.map((photo: any, photoIndex: number) => (
                                          <div
                                            key={photoIndex}
                                            className="relative group"
                                          >
                                            <div className="aspect-square rounded-lg overflow-hidden border border-[#92A2A5] bg-[#AEBFC3]/20">
                                              {photo.dataUrl ? (
                                                <img
                                                  src={photo.dataUrl}
                                                  alt={photo.filename || `Photo ${photoIndex + 1}`}
                                                  className="w-full h-full object-cover"
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                  <span className="text-sm text-[#AEBFC3]0">
                                                    No preview
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                            {/* Overlay with actions */}
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={() => {
                                                    window.open(photo.dataUrl, '_blank');
                                                  }}
                                                  className="p-2 bg-white rounded-full shadow-lg hover:bg-[#AEBFC3]/20 transition-colors"
                                                  title="View full size"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                  </svg>
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = photo.dataUrl;
                                                    link.download = photo.filename || `photo-${photoIndex + 1}.jpg`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                  }}
                                                  className="p-2 bg-white rounded-full shadow-lg hover:bg-[#AEBFC3]/20 transition-colors"
                                                  title="Download"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                  </svg>
                                                </button>
                                              </div>
                                            </div>
                                            {/* Photo info */}
                                            <div className="mt-2">
                                              <p className="text-xs text-[#5D6E73] truncate">
                                                {photo.filename || `Photo ${photoIndex + 1}`}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#AEBFC3]0 mt-2">
                        No stage data recorded for this activity yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Schedule as Completed</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this schedule as completed?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg p-4">
              <p className="text-sm text-[#546A7A]">
                This will mark the schedule as completed and update the status.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="flex-1 bg-[#4F6A64] hover:bg-[#4F6A64]"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Complete'
                )}
              </Button>
              <Button
                onClick={() => setShowCompleteDialog(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this schedule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#E17F70]/10 border border-[#E17F70] rounded-lg p-4">
              <p className="text-sm text-[#75242D]">
                This will cancel the schedule and update the status to CANCELLED.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleCancel}
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Cancel Schedule'
                )}
              </Button>
              <Button
                onClick={() => setShowCancelDialog(false)}
                variant="outline"
              >
                Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
