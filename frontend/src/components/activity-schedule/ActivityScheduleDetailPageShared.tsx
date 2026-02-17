'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Activity,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pencil as Edit3,
  ExternalLink,
  Phone,
  Mail,
  Building2,
  Layers,
  Timer,
  FileText,
  CheckCheck,
  X,
  ChevronRight,
  Sparkles,
  Navigation,
  Camera,
  Download,
  RefreshCw,
  Zap,
  Target
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

export const dynamic = 'force-dynamic';

// Helper to resolve image URLs (handles local storage paths)
const resolveImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http')) return url;

  // Get backend base URL (strip /api if present)
  // Note: Backend runs on port 5003 as per terminal logs
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api';
  const baseUrl = rawApiUrl.replace(/\/(api)\/?$/, '');

  // Ensure url starts with /
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
};

export default function ActivityScheduleDetailPageShared() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const scheduleId = params.id as string;
  const isAdmin = pathname.includes('/admin/');
  const isZone = pathname.includes('/zone/');
  const isExpert = pathname.includes('/expert/');

  const [schedule, setSchedule] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleId) {
      fetchScheduleDetail();
    }
  }, [scheduleId]);

  const fetchScheduleDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/activity-schedule/${scheduleId}`);
      if (response.success) {
        setSchedule(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching schedule detail:', error);
      toast.error('Failed to load schedule details');
      router.push(`/${isAdmin ? 'admin' : isZone ? 'zone' : 'expert'}/activity-scheduling`);
    } finally {
      setLoading(false);
    }
  };

  const getBasePath = () => `/${isAdmin ? 'admin' : isZone ? 'zone' : 'expert'}`;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          gradient: 'from-[#CE9F6B] to-[#CE9F6B]',
          bg: 'bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10',
          borderColor: 'border-[#CE9F6B]/50',
          textColor: 'text-[#976E44]',
          icon: <AlertCircle className="h-4 w-4" />,
          label: 'Pending',
          iconBg: 'bg-[#CE9F6B]/100'
        };
      case 'ACCEPTED':
        return {
          gradient: 'from-[#6F8A9D] to-[#6F8A9D]',
          bg: 'bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10',
          borderColor: 'border-[#96AEC2]',
          textColor: 'text-[#546A7A]',
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Accepted',
          iconBg: 'bg-[#96AEC2]/100'
        };
      case 'COMPLETED':
        return {
          gradient: 'from-[#82A094] to-[#82A094]',
          bg: 'bg-gradient-to-r from-[#A2B9AF]/10 to-[#82A094]/10',
          borderColor: 'border-[#82A094]/50',
          textColor: 'text-[#4F6A64]',
          icon: <CheckCheck className="h-4 w-4" />,
          label: 'Completed',
          iconBg: 'bg-[#82A094]/100'
        };
      case 'REJECTED':
        return {
          gradient: 'from-[#E17F70] to-[#E17F70]',
          bg: 'bg-gradient-to-r from-[#EEC1BF]/10 to-[#E17F70]/10',
          borderColor: 'border-[#EEC1BF]/50',
          textColor: 'text-[#9E3B47]',
          icon: <XCircle className="h-4 w-4" />,
          label: 'Rejected',
          iconBg: 'bg-[#EEC1BF]/100'
        };
      case 'CANCELLED':
        return {
          gradient: 'from-[#AEBFC3]/100 to-[#AEBFC3]/100',
          bg: 'bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/10',
          borderColor: 'border-[#92A2A5]',
          textColor: 'text-[#5D6E73]',
          icon: <X className="h-4 w-4" />,
          label: 'Cancelled',
          iconBg: 'bg-[#AEBFC3]/100'
        };
      default:
        return {
          gradient: 'from-[#AEBFC3]/100 to-[#AEBFC3]/100',
          bg: 'bg-[#AEBFC3]/10',
          borderColor: 'border-[#92A2A5]',
          textColor: 'text-[#5D6E73]',
          icon: null,
          label: status,
          iconBg: 'bg-[#AEBFC3]/100'
        };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return {
          gradient: 'from-[#E17F70] to-red-600',
          bg: 'bg-gradient-to-r from-[#EEC1BF]/10 to-[#E17F70]/10',
          text: 'text-[#9E3B47]',
          border: 'border-[#EEC1BF]/50',
          icon: <Zap className="h-3.5 w-3.5" />
        };
      case 'HIGH':
        return {
          gradient: 'from-[#CE9F6B] to-[#CE9F6B]',
          bg: 'bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10',
          text: 'text-[#976E44]',
          border: 'border-[#CE9F6B]',
          icon: <Target className="h-3.5 w-3.5" />
        };
      case 'MEDIUM':
        return {
          gradient: 'from-[#6F8A9D] to-[#6F8A9D]',
          bg: 'bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10',
          text: 'text-[#546A7A]',
          border: 'border-[#96AEC2]',
          icon: <Activity className="h-3.5 w-3.5" />
        };
      case 'LOW':
        return {
          gradient: 'from-[#82A094] to-[#82A094]',
          bg: 'bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10',
          text: 'text-[#4F6A64]',
          border: 'border-[#82A094]/50',
          icon: <CheckCircle className="h-3.5 w-3.5" />
        };
      default:
        return {
          gradient: 'from-[#AEBFC3]/100 to-[#AEBFC3]/100',
          bg: 'bg-[#AEBFC3]/10',
          text: 'text-[#5D6E73]',
          border: 'border-[#92A2A5]',
          icon: null
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (hours: number) => {
    if (hours >= 1) {
      const h = Math.floor(hours);
      const m = Math.round((hours % 1) * 60);
      return m > 0 ? `${h}h ${m}m` : `${h} hour${h !== 1 ? 's' : ''}`;
    }
    return `${Math.round(hours * 60)} minutes`;
  };

  const formatDurationFromTimes = (start: string, end?: string) => {
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

  // Helper to get readable stage label for ticket status stages
  const getStageLabel = (stage: string, isTicketStatus?: boolean): string => {
    // Ticket work status progression labels
    const ticketStatusLabels: Record<string, string> = {
      'OPEN': 'Ticket Opened',
      'ASSIGNED': 'Assigned to Technician',
      'IN_PROGRESS': 'Work In Progress',
      'ONSITE_VISIT_STARTED': 'Traveling to Site',
      'ONSITE_VISIT_REACHED': 'Arrived at Site',
      'ONSITE_VISIT_IN_PROGRESS': 'Onsite Work In Progress',
      'ONSITE_VISIT_RESOLVED': 'Issue Resolved',
      'ONSITE_VISIT_COMPLETED': 'Onsite Visit Completed',
      'REMOTE_RESOLUTION_STARTED': 'Remote Support Started',
      'REMOTE_RESOLUTION_IN_PROGRESS': 'Remote Support In Progress',
      'REMOTE_RESOLUTION_RESOLVED': 'Remote Issue Resolved',
      'PARTS_ORDERED': 'Parts Ordered',
      'PARTS_RECEIVED': 'Parts Received',
      'AWAITING_PARTS': 'Awaiting Parts',
      'AWAITING_CUSTOMER': 'Awaiting Customer',
      'ESCALATED': 'Escalated',
      'ON_HOLD': 'On Hold',
      'RESOLVED': 'Resolved',
      'CLOSED': 'Closed',
      'CLOSED_PENDING': 'Closure Pending',
      'CANCELLED': 'Cancelled',
    };

    // Activity stage labels
    const activityStageLabels: Record<string, string> = {
      'STARTED': 'Started',
      'TRAVELING': 'Traveling',
      'ARRIVED': 'Arrived',
      'WORK_IN_PROGRESS': 'Work in Progress',
      'COMPLETED': 'Completed',
      'ASSESSMENT': 'Assessment',
      'PLANNING': 'Planning',
      'EXECUTION': 'Execution',
      'TESTING': 'Testing',
      'DOCUMENTATION': 'Documentation',
      'CUSTOMER_HANDOVER': 'Customer Handover',
      'PREPARATION': 'Preparation',
      'CLEANUP': 'Cleanup',
    };

    if (isTicketStatus) {
      return ticketStatusLabels[stage] || stage?.replace(/_/g, ' ') || 'Unknown';
    }
    return activityStageLabels[stage] || stage?.replace(/_/g, ' ') || 'Unknown';
  };

  // Helper to get stage styling based on type
  const getStageStyle = (stage: string, isTicketStatus?: boolean) => {
    // Ticket status styles with icons
    const ticketStatusStyles: Record<string, { bg: string; text: string; icon: string }> = {
      'ONSITE_VISIT_STARTED': { bg: 'from-[#96AEC2]/20 to-sky-100', text: 'text-[#546A7A]', icon: '🚗' },
      'ONSITE_VISIT_REACHED': { bg: 'from-[#A2B9AF]/20 to-[#A2B9AF]/20', text: 'text-[#4F6A64]', icon: '📍' },
      'ONSITE_VISIT_IN_PROGRESS': { bg: 'from-orange-100 to-[#EEC1BF]/20', text: 'text-[#976E44]', icon: '🔧' },
      'ONSITE_VISIT_RESOLVED': { bg: 'from-emerald-100 to-[#82A094]/20', text: 'text-[#4F6A64]', icon: '✅' },
      'ONSITE_VISIT_COMPLETED': { bg: 'from-[#6F8A9D]/20 to-violet-100', text: 'text-[#546A7A]', icon: '🎉' },
      'IN_PROGRESS': { bg: 'from-yellow-100 to-[#EEC1BF]/20', text: 'text-[#976E44]', icon: '⚡' },
      'PARTS_ORDERED': { bg: 'from-cyan-100 to-[#96AEC2]/20', text: 'text-[#546A7A]', icon: '📦' },
      'PARTS_RECEIVED': { bg: 'from-teal-100 to-[#96AEC2]/20', text: 'text-[#4F6A64]', icon: '✔️' },
      'RESOLVED': { bg: 'from-[#A2B9AF]/20 to-[#A2B9AF]/20', text: 'text-[#4F6A64]', icon: '🎯' },
      'CLOSED': { bg: 'from-[#AEBFC3]/20 to-[#AEBFC3]/20', text: 'text-[#5D6E73]', icon: '🔒' },
    };

    // Default style
    const defaultStyle = { bg: 'from-[#AEBFC3]/20 to-[#AEBFC3]/20', text: 'text-[#5D6E73]', icon: '📋' };

    if (isTicketStatus) {
      return ticketStatusStyles[stage] || defaultStyle;
    }
    return defaultStyle;
  };

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      const response = await apiClient.patch(`/activity-schedule/${schedule.id}/complete`);
      if (response.success) {
        toast.success('Schedule marked as completed');
        setShowCompleteDialog(false);
        fetchScheduleDetail();
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
        fetchScheduleDetail();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State with vibrant design
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#546A7A] via-[#546A7A] to-[#546A7A] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#6F8A9D]/20 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative text-center space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-white/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white animate-spin" />
            <div className="absolute inset-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Activity className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">Loading Schedule</h3>
            <p className="text-[#96AEC2] text-sm">Fetching details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!schedule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/20 to-slate-200 p-4 md:p-8">
        <div className="max-w-lg mx-auto mt-20">
          <Card className="shadow-xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-700 to-slate-800 p-8 text-center">
              <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">Schedule Not Found</h3>
              <p className="text-[#AEBFC3] mt-2">The schedule you're looking for doesn't exist.</p>
            </div>
            <CardContent className="p-6 text-center bg-white">
              <Button
                onClick={() => router.push(`${getBasePath()}/activity-scheduling`)}
                className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:to-[#546A7A] text-white shadow-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Schedules
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(schedule.status);
  const priorityConfig = getPriorityConfig(schedule.priority);
  const canComplete = schedule.status === 'ACCEPTED';
  const canCancel = schedule.status === 'PENDING';

  // Combine directly linked assets and ticket asset
  const displayAssets = [...(schedule.assets || [])];
  if (schedule.ticket?.asset) {
    const ticketAssetId = schedule.ticket.asset.id;
    if (!displayAssets.some((a: any) => a.id === ticketAssetId)) {
      displayAssets.push(schedule.ticket.asset);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10/30 to-[#6F8A9D]/10/50">
      {/* Vibrant Hero Header */}
      <div className="relative overflow-hidden">
        <div className={`bg-gradient-to-r ${statusConfig.gradient} py-10 px-4 md:px-8`}>
          {/* Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-black/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-white/70 text-sm mb-6">
              <button
                onClick={() => router.push(`${getBasePath()}/activity-scheduling`)}
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <Activity className="h-4 w-4" />
                Activity Scheduling
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-white font-medium">Schedule #{scheduleId}</span>
            </div>

            {/* Header Content */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-xl">
                  <Activity className="h-10 w-10 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                      {schedule.title || schedule.activityType.replace(/_/g, ' ')}
                    </h1>
                    <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                      #{schedule.id}
                    </Badge>
                  </div>
                  <p className="text-white/80 max-w-2xl text-lg">
                    {schedule.description || 'Scheduled activity for service operations'}
                  </p>

                  {/* Meta Info */}
                  <div className="flex flex-wrap items-center gap-4 mt-4">
                    <div className="flex items-center gap-2 text-white/90 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-medium">{formatDate(schedule.scheduledDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">{formatTime(schedule.scheduledDate)}</span>
                    </div>
                    {schedule.estimatedDuration && (
                      <div className="flex items-center gap-2 text-white/90 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <Timer className="h-4 w-4" />
                        <span className="text-sm font-medium">{formatDuration(schedule.estimatedDuration)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Priority Badges */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg">
                  {statusConfig.icon}
                  <span className="font-semibold text-white">{statusConfig.label}</span>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${priorityConfig.bg} ${priorityConfig.border} border shadow-lg`}>
                  {priorityConfig.icon}
                  <span className={`font-semibold ${priorityConfig.text}`}>{schedule.priority}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`${getBasePath()}/activity-scheduling`)}
                className="border-[#92A2A5] hover:bg-[#AEBFC3]/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchScheduleDetail}
                className="border-[#92A2A5] hover:bg-[#AEBFC3]/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>

              {schedule.ticket && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`${isAdmin ? '/admin' : '/zone'}/tickets/${schedule.ticket.id}`)}
                  className="border-[#96AEC2] text-[#546A7A] hover:bg-[#96AEC2]/10"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Ticket #{schedule.ticket.id}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Edit Button - Always visible */}
              <Button
                size="sm"
                onClick={() => router.push(`${getBasePath()}/activity-scheduling/${schedule.id}/edit`)}
                className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:to-[#546A7A] text-white shadow-md"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Schedule
              </Button>

              {canComplete && (
                <Button
                  size="sm"
                  onClick={() => setShowCompleteDialog(true)}
                  className="bg-gradient-to-r from-[#82A094] to-[#82A094] hover:from-[#4F6A64] hover:to-[#4F6A64] text-white shadow-md"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              )}

              {canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  className="border-[#EEC1BF]/50 text-[#9E3B47] hover:bg-[#EEC1BF]/10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Schedule
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Schedule Information */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] text-white p-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Calendar className="h-5 w-5" />
                  </div>
                  Schedule Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gradient-to-br from-[#96AEC2]/10 to-[#6F8A9D]/10 rounded-xl border border-[#96AEC2]/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#96AEC2]/100 rounded-lg text-white">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <label className="text-sm font-medium text-[#546A7A]">Scheduled Date</label>
                    </div>
                    <p className="text-[#546A7A] font-semibold ml-11">{formatDate(schedule.scheduledDate)}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-[#6F8A9D]/10 to-[#6F8A9D]/10 rounded-xl border border-[#6F8A9D]/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#546A7A]/100 rounded-lg text-white">
                        <Clock className="h-4 w-4" />
                      </div>
                      <label className="text-sm font-medium text-[#546A7A]">Scheduled Time</label>
                    </div>
                    <p className="text-[#546A7A] font-semibold ml-11">{formatTime(schedule.scheduledDate)}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-[#6F8A9D]/10 to-[#EEC1BF]/10 rounded-xl border border-[#6F8A9D]/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#6F8A9D]/100 rounded-lg text-white">
                        <Activity className="h-4 w-4" />
                      </div>
                      <label className="text-sm font-medium text-[#546A7A]">Activity Type</label>
                    </div>
                    <p className="text-[#546A7A] font-semibold ml-11">{schedule.activityType.replace(/_/g, ' ')}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-xl border border-[#EEC1BF]/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#CE9F6B]/100 rounded-lg text-white">
                        <Timer className="h-4 w-4" />
                      </div>
                      <label className="text-sm font-medium text-[#976E44]">Duration</label>
                    </div>
                    <p className="text-[#546A7A] font-semibold ml-11">
                      {schedule.estimatedDuration ? formatDuration(schedule.estimatedDuration) : '—'}
                    </p>
                  </div>
                </div>

                {schedule.location && (
                  <div className="mt-6 p-4 bg-gradient-to-br from-[#A2B9AF]/10 to-[#82A094]/10 rounded-xl border border-[#A2B9AF]/30">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[#82A094]/100 rounded-lg text-white">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-[#4F6A64] block mb-1">Location</label>
                        <p className="text-[#546A7A]">{schedule.location}</p>
                      </div>
                    </div>
                  </div>
                )}

                {schedule.notes && (
                  <div className="mt-6 p-4 bg-gradient-to-br from-[#AEBFC3]/10 to-[#AEBFC3]/10 rounded-xl border border-[#92A2A5]">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[#AEBFC3]/100 rounded-lg text-white">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-[#5D6E73] block mb-1">Notes</label>
                        <p className="text-[#5D6E73] whitespace-pre-wrap">{schedule.notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Zone, Customer & Assets */}
            {((schedule.zone || schedule.customer) || (displayAssets.length > 0)) && (
              <Card className="shadow-lg border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] text-white p-6">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Building2 className="h-5 w-5" />
                    </div>
                    Organization & Assets
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {(schedule.zone || schedule.customer) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schedule.zone && (
                        <div className="p-4 bg-gradient-to-br from-[#6F8A9D]/10 to-[#6F8A9D]/10 rounded-xl border border-violet-100">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[#6F8A9D] rounded-lg text-white">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <label className="text-sm font-medium text-[#546A7A]">Service Zone</label>
                          </div>
                          <p className="text-[#546A7A] font-semibold ml-11">{schedule.zone.name}</p>
                        </div>
                      )}
                      {schedule.customer && (
                        <div className="p-4 bg-gradient-to-br from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-xl border border-[#EEC1BF]/30">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[#EEC1BF]/100 rounded-lg text-white">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <label className="text-sm font-medium text-[#9E3B47]">Customer</label>
                          </div>
                          <p className="text-[#546A7A] font-semibold ml-11">{schedule.customer.companyName}</p>
                          {schedule.customer.address && (
                            <p className="text-[#AEBFC3]0 text-sm ml-11 mt-1">{schedule.customer.address}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {(displayAssets.length > 0 || schedule.activityType === 'TICKET_WORK') && (
                    <div>
                      <label className="text-sm font-medium text-[#5D6E73] mb-3 block flex items-center gap-2">
                        <Layers className="h-4 w-4 text-[#979796]" />
                        {schedule.activityType === 'TICKET_WORK' ? 'Work Assets' : 'Linked Assets'} ({displayAssets.length})
                      </label>
                      {displayAssets.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {displayAssets.map((asset: any) => (
                            <div key={asset.id} className="p-4 bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/10 rounded-xl border border-cyan-100">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] rounded-lg text-white">
                                  <Layers className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-semibold text-[#546A7A]">{asset.model}</p>
                                  <p className="text-sm text-[#AEBFC3]0 font-mono">S/N: {asset.serialNo}</p>
                                  {asset.location && (
                                    <p className="text-sm text-[#979796] mt-1">{asset.location}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                          <p className="text-[#AEBFC3]0 text-sm">No asset assigned</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Related Ticket */}
            {schedule.ticket && (
              <Card className="shadow-lg border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-sky-600 to-[#546A7A] text-white p-6">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                    Related Ticket
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-[#546A7A]">#{schedule.ticket.id}</span>
                        <Badge className="bg-sky-100 text-sky-700 border-sky-200 border">
                          {schedule.ticket.status}
                        </Badge>
                        {schedule.ticket.priority && (
                          <Badge className={`${getPriorityConfig(schedule.ticket.priority).bg} ${getPriorityConfig(schedule.ticket.priority).text} ${getPriorityConfig(schedule.ticket.priority).border} border`}>
                            {schedule.ticket.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[#5D6E73] text-lg">{schedule.ticket.title}</p>

                      {(schedule.ticket.customer || schedule.ticket.contact) && (
                        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-[#AEBFC3]0">
                          {schedule.ticket.customer && (
                            <span className="flex items-center gap-2 bg-[#AEBFC3]/20 px-3 py-1.5 rounded-full">
                              <Building2 className="h-4 w-4" />
                              {schedule.ticket.customer.companyName}
                            </span>
                          )}
                          {schedule.ticket.contact && (
                            <span className="flex items-center gap-2 bg-[#AEBFC3]/20 px-3 py-1.5 rounded-full">
                              <User className="h-4 w-4" />
                              {schedule.ticket.contact.name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => router.push(`${isAdmin ? '/admin' : '/zone'}/tickets/${schedule.ticket.id}`)}
                      className="bg-gradient-to-r from-sky-500 to-[#546A7A] hover:from-sky-600 hover:to-[#546A7A] text-white"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Ticket
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Field Execution Timeline */}
            {schedule.relatedActivities && schedule.relatedActivities.length > 0 && (
              <Card className="shadow-xl border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-[#4F6A64] to-[#546A7A] text-white p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      Field Execution Timeline
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-sm px-3 py-1.5">
                        {schedule.relatedActivities.reduce((count: number, a: any) => count + (a.ActivityStage?.length || 0), 0)} Stages
                      </Badge>
                      <Badge className="bg-white/25 text-white border-0 backdrop-blur-sm text-base px-4 py-1.5 font-semibold">
                        {schedule.relatedActivities.length} {schedule.relatedActivities.length === 1 ? 'Activity' : 'Activities'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {schedule.relatedActivities.map((activity: any, actIndex: number) => {
                    const totalStages = activity.ActivityStage?.length || 0;
                    const completedStages = activity.ActivityStage?.filter((s: any) => s.endTime).length || 0;
                    const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
                    const allPhotos = (activity.ActivityStage || []).reduce((acc: any[], s: any) => {
                      const meta = s.metadata || {};
                      const photos = Array.isArray(meta.photos) ? meta.photos : [];
                      return [...acc, ...photos];
                    }, []);

                    return (
                      <div
                        key={activity.id}
                        className="rounded-2xl border border-[#A2B9AF]/40 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* Activity Header - Gradient bar */}
                        <div className="bg-gradient-to-r from-[#82A094]/15 via-[#A2B9AF]/10 to-[#96AEC2]/10 p-5 border-b border-[#A2B9AF]/20">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div className="p-3 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl text-white shadow-lg">
                                  <Activity className="h-6 w-6" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow text-[10px] font-bold text-[#4F6A64]">
                                  {actIndex + 1}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-bold text-[#546A7A] text-lg leading-tight">
                                  {activity.title || activity.activityType?.replace(/_/g, ' ') || 'Activity'}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <span className="text-xs font-medium text-[#4F6A64] bg-[#82A094]/15 px-2.5 py-0.5 rounded-full">
                                    {activity.activityType?.replace(/_/g, ' ')}
                                  </span>
                                  {totalStages > 0 && (
                                    <span className="text-xs font-medium text-[#546A7A] bg-[#96AEC2]/15 px-2.5 py-0.5 rounded-full">
                                      {totalStages} {totalStages === 1 ? 'stage' : 'stages'}
                                    </span>
                                  )}
                                  {allPhotos.length > 0 && (
                                    <span className="text-xs font-medium text-[#976E44] bg-[#CE9F6B]/15 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                      <Camera className="h-3 w-3" />
                                      {allPhotos.length} {allPhotos.length === 1 ? 'photo' : 'photos'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-[#546A7A]">{formatDateTime(activity.startTime)}</p>
                              {formatDurationFromTimes(activity.startTime, activity.endTime) && (
                                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                  <div className="px-2.5 py-1 bg-[#4F6A64]/10 rounded-lg flex items-center gap-1.5">
                                    <Timer className="h-3.5 w-3.5 text-[#4F6A64]" />
                                    <span className="text-sm font-bold text-[#4F6A64]">{formatDurationFromTimes(activity.startTime, activity.endTime)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          {totalStages > 1 && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-[#5D6E73]">Stage Progress</span>
                                <span className="text-xs font-semibold text-[#4F6A64]">{completedStages}/{totalStages} completed</span>
                              </div>
                              <div className="h-2 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-full transition-all duration-500"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Activity Stages */}
                        {activity.ActivityStage && activity.ActivityStage.length > 0 && (
                          <div className="p-5">
                            <div className="relative pl-6 border-l-[3px] border-gradient-to-b border-[#82A094]/40 space-y-5">
                              {activity.ActivityStage.map((stage: any, stageIndex: number) => {
                                const meta = stage.metadata || {};
                                const isTicketStatus = meta.isTicketStatus === true;
                                const locationSource = stage.locationSource || meta.locationSource as string | undefined;
                                const accuracyRaw = stage.accuracy ?? (meta.accuracy as any) ?? undefined;
                                const accuracy = typeof accuracyRaw === 'number' ? accuracyRaw : accuracyRaw ? parseFloat(accuracyRaw) : undefined;
                                const photos = Array.isArray(meta.photos) ? meta.photos : [];
                                const stageStyle = getStageStyle(stage.stage, isTicketStatus);
                                const changedBy = meta.changedBy;
                                const isLast = stageIndex === activity.ActivityStage.length - 1;
                                const isFirst = stageIndex === 0;

                                return (
                                  <div key={stage.id} className="relative group">
                                    {/* Timeline dot with pulse on first/last */}
                                    <div className={`absolute -left-[33px] top-3 w-5 h-5 rounded-full border-[3px] border-white shadow-lg z-10 transition-transform group-hover:scale-110 ${isTicketStatus
                                      ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]'
                                      : isFirst
                                        ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64]'
                                        : isLast
                                          ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64]'
                                          : 'bg-gradient-to-br from-[#82A094] to-[#82A094]'
                                      }`}>
                                      {(isFirst || isLast) && !isTicketStatus && (
                                        <div className="absolute inset-0 rounded-full bg-[#82A094]/30 animate-ping" />
                                      )}
                                    </div>

                                    <div className={`rounded-xl p-4 ml-3 transition-all hover:shadow-md ${isTicketStatus
                                      ? `bg-gradient-to-br ${stageStyle.bg} border border-[#96AEC2]/40`
                                      : 'bg-white border border-[#A2B9AF]/25 hover:border-[#A2B9AF]/50'
                                      }`}>
                                      {/* Stage header row */}
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                          {isTicketStatus && (
                                            <span className="text-lg leading-none">{stageStyle.icon}</span>
                                          )}
                                          {!isTicketStatus && (
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm ${stage.endTime
                                              ? 'bg-[#82A094]/15 text-[#4F6A64]'
                                              : 'bg-[#CE9F6B]/15 text-[#976E44]'
                                              }`}>
                                              {stageIndex + 1}
                                            </div>
                                          )}
                                          <span className={`font-semibold text-[15px] ${isTicketStatus ? stageStyle.text : 'text-[#546A7A]'}`}>
                                            {getStageLabel(stage.stage, isTicketStatus)}
                                          </span>
                                          {stage.endTime && !isTicketStatus && (
                                            <CheckCircle className="h-4 w-4 text-[#82A094]" />
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                          {isTicketStatus && (
                                            <Badge className="bg-gradient-to-r from-[#96AEC2]/20 to-[#6F8A9D]/20 text-[#546A7A] border-[#96AEC2]/50 border text-[10px] px-2 py-0.5">
                                              Ticket Status
                                            </Badge>
                                          )}
                                          {!isTicketStatus && locationSource === 'gps' && typeof accuracy === 'number' && (
                                            <Badge className="bg-[#A2B9AF]/15 text-[#4F6A64] border-[#A2B9AF]/40 border text-[10px] px-2 py-0.5">
                                              <Navigation className="h-2.5 w-2.5 mr-1" />
                                              ±{Math.round(accuracy)}m
                                            </Badge>
                                          )}
                                          {!isTicketStatus && locationSource === 'manual' && (
                                            <Badge className="bg-[#96AEC2]/15 text-[#546A7A] border-[#96AEC2]/40 border text-[10px] px-2 py-0.5">
                                              Manual
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      {/* Time & duration row */}
                                      <div className="flex flex-wrap items-center gap-3 mt-2.5 text-sm text-[#5D6E73]">
                                        <span className="flex items-center gap-1.5 font-medium">
                                          <Clock className="h-3.5 w-3.5 text-[#92A2A5]" />
                                          {formatTime(stage.startTime)}
                                          {stage.endTime && (
                                            <>
                                              <span className="text-[#92A2A5]">→</span>
                                              {formatTime(stage.endTime)}
                                            </>
                                          )}
                                        </span>
                                        {formatDurationFromTimes(stage.startTime, stage.endTime) && (
                                          <span className="flex items-center gap-1 bg-[#4F6A64]/8 px-2 py-0.5 rounded-md text-[#4F6A64] font-semibold text-xs">
                                            <Timer className="h-3 w-3" />
                                            {formatDurationFromTimes(stage.startTime, stage.endTime)}
                                          </span>
                                        )}
                                        {isTicketStatus && changedBy?.name && (
                                          <span className="flex items-center gap-1 bg-[#96AEC2]/10 px-2 py-0.5 rounded-md text-[#546A7A] text-xs">
                                            <User className="h-3 w-3" />
                                            {changedBy.name}
                                          </span>
                                        )}
                                      </div>

                                      {/* Location */}
                                      {stage.location && (
                                        <div className="mt-3 flex items-start gap-2 bg-[#AEBFC3]/8 p-2.5 rounded-lg">
                                          <MapPin className="h-3.5 w-3.5 text-[#92A2A5] mt-0.5 flex-shrink-0" />
                                          <span className="text-xs text-[#5D6E73] leading-relaxed">{stage.location}</span>
                                        </div>
                                      )}

                                      {/* Notes */}
                                      {stage.notes && (
                                        <div className="mt-3 p-3 bg-gradient-to-r from-[#CE9F6B]/8 to-[#EEC1BF]/8 rounded-lg border border-[#CE9F6B]/20">
                                          <div className="flex items-start gap-2">
                                            <FileText className="h-3.5 w-3.5 text-[#CE9F6B] mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-[#976E44] leading-relaxed">{stage.notes}</p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Photos */}
                                      {photos.length > 0 && (
                                        <div className="mt-4">
                                          <p className="text-xs font-semibold text-[#5D6E73] mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
                                            <Camera className="h-3.5 w-3.5 text-[#82A094]" />
                                            Photos ({photos.length})
                                          </p>
                                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                            {photos.map((photo: any, photoIndex: number) => {
                                              const rawSrc = photo.url || photo.dataUrl || photo.thumbnailUrl || '';
                                              const imgSrc = resolveImageUrl(rawSrc);
                                              return (
                                                <div
                                                  key={photoIndex}
                                                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-[#AEBFC3]/20 bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/5 cursor-pointer hover:border-[#82A094] hover:shadow-lg transition-all duration-200 group"
                                                  onClick={() => imgSrc && setSelectedPhoto(imgSrc)}
                                                >
                                                  {imgSrc ? (
                                                    <>
                                                      <img
                                                        src={imgSrc}
                                                        alt={photo.filename || `Photo ${photoIndex + 1}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                      />
                                                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        <div className="absolute bottom-1.5 right-1.5 p-1 bg-white/90 rounded-md shadow-sm">
                                                          <ExternalLink className="h-3 w-3 text-[#546A7A]" />
                                                        </div>
                                                      </div>
                                                    </>
                                                  ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                                      <Camera className="h-6 w-6 text-[#92A2A5]" />
                                                      <span className="text-[9px] text-[#92A2A5]">No preview</span>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Service Person */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#546A7A] to-[#9E3B47] text-white p-6">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <User className="h-5 w-5" />
                  </div>
                  Service Person
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#6F8A9D] to-[#E17F70] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">
                      {schedule.servicePerson.name?.charAt(0).toUpperCase() || 'S'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#546A7A]">{schedule.servicePerson.name}</h3>
                  <p className="text-[#AEBFC3]0 text-sm">Assigned Technician</p>
                </div>

                <div className="space-y-3">
                  <a
                    href={`mailto:${schedule.servicePerson.email}`}
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#6F8A9D]/10 to-[#EEC1BF]/10 rounded-xl hover:shadow-md transition-all border border-[#6F8A9D]/30"
                  >
                    <div className="p-2 bg-gradient-to-br from-[#6F8A9D] to-[#E17F70] rounded-lg text-white">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="text-[#5D6E73] text-sm truncate">{schedule.servicePerson.email}</span>
                  </a>

                  {schedule.servicePerson.phone && (
                    <a
                      href={`tel:${schedule.servicePerson.phone}`}
                      className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#6F8A9D]/10 to-[#EEC1BF]/10 rounded-xl hover:shadow-md transition-all border border-[#6F8A9D]/30"
                    >
                      <div className="p-2 bg-gradient-to-br from-[#6F8A9D] to-[#E17F70] rounded-lg text-white">
                        <Phone className="h-4 w-4" />
                      </div>
                      <span className="text-[#5D6E73] text-sm">{schedule.servicePerson.phone}</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scheduled By */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] text-white p-5">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Users className="h-5 w-5" />
                  Scheduled By
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] rounded-full flex items-center justify-center shadow-md">
                    <span className="text-lg font-bold text-white">
                      {schedule.scheduledBy.name?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#546A7A]">{schedule.scheduledBy.name}</h4>
                    <a href={`mailto:${schedule.scheduledBy.email}`} className="text-sm text-[#546A7A] hover:underline">
                      {schedule.scheduledBy.email}
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Timeline */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-700 to-slate-800 text-white p-5">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Clock className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="relative pl-7 space-y-6">
                  <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-gray-400 to-gray-200" />

                  {/* Created */}
                  <div className="relative">
                    <div className="absolute -left-[22px] w-5 h-5 bg-gradient-to-br from-gray-600 to-slate-700 rounded-full border-4 border-white shadow-md" />
                    <div>
                      <p className="font-semibold text-[#546A7A]">Created</p>
                      <p className="text-sm text-[#AEBFC3]0">{formatDateTime(schedule.createdAt)}</p>
                    </div>
                  </div>

                  {/* Accepted */}
                  {schedule.acceptedAt && (
                    <div className="relative">
                      <div className="absolute -left-[22px] w-5 h-5 bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] rounded-full border-4 border-white shadow-md" />
                      <div>
                        <p className="font-semibold text-[#546A7A]">Accepted</p>
                        <p className="text-sm text-[#AEBFC3]0">{formatDateTime(schedule.acceptedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Rejected */}
                  {schedule.rejectedAt && (
                    <div className="relative">
                      <div className="absolute -left-[22px] w-5 h-5 bg-gradient-to-br from-[#E17F70] to-[#E17F70] rounded-full border-4 border-white shadow-md" />
                      <div>
                        <p className="font-semibold text-[#546A7A]">Rejected</p>
                        <p className="text-sm text-[#AEBFC3]0">{formatDateTime(schedule.rejectedAt)}</p>
                        {schedule.rejectionReason && (
                          <div className="mt-2 p-3 bg-[#EEC1BF]/10 rounded-lg border border-[#EEC1BF]/50">
                            <p className="text-sm text-[#9E3B47]">{schedule.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Completed */}
                  {schedule.completedAt && (
                    <div className="relative">
                      <div className="absolute -left-[22px] w-5 h-5 bg-gradient-to-br from-[#82A094] to-[#82A094] rounded-full border-4 border-white shadow-md" />
                      <div>
                        <p className="font-semibold text-[#546A7A]">Completed</p>
                        <p className="text-sm text-[#AEBFC3]0">{formatDateTime(schedule.completedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#82A094] to-[#82A094] p-6 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCheck className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-xl text-white">Mark as Completed</DialogTitle>
            <DialogDescription className="text-[#A2B9AF] mt-2">
              Confirm that all scheduled activities have been finished.
            </DialogDescription>
          </div>
          <div className="p-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCompleteDialog(false)}
              disabled={isSubmitting}
              className="flex-1 border-[#92A2A5]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-[#82A094] to-[#82A094] hover:from-[#4F6A64] hover:to-[#4F6A64] text-white"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Complete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#E17F70] to-[#E17F70] p-6 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-xl text-white">Cancel Schedule</DialogTitle>
            <DialogDescription className="text-rose-100 mt-2">
              Please provide a reason for cancellation.
            </DialogDescription>
          </div>
          <div className="p-6 space-y-4">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter reason for cancellation..."
              className="min-h-[100px] resize-none border-[#92A2A5]"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason('');
                }}
                disabled={isSubmitting}
                className="flex-1 border-[#92A2A5]"
              >
                Back
              </Button>
              <Button
                onClick={handleCancel}
                disabled={isSubmitting || !cancelReason.trim()}
                className="flex-1 bg-gradient-to-r from-[#E17F70] to-[#E17F70] hover:from-[#9E3B47] hover:to-red-600 text-white"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel Schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Lightbox */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-5xl p-0 bg-black/95 border-none">
          <div className="relative">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
            {selectedPhoto && (
              <img
                src={selectedPhoto}
                alt="Full size photo"
                className="w-full h-auto max-h-[85vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
