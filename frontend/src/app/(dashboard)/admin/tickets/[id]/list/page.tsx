"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  FileText, 
  MessageSquare, 
  Activity,
  MapPin,
  CheckCircle,
  UserPlus,
  Wrench,
  Pencil,
  Upload,
  Camera,
  ArrowLeft,
  Clock,
  User,
  Phone,
  Mail,
  Building2,
  Hash,
  Sparkles,
  Shield,
  History,
  ChevronRight,
  AlertCircle,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { Ticket } from '@/types/ticket';
import api from '@/lib/api/axios';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import dynamic from 'next/dynamic';

// Heavy components loaded dynamically
const TicketActivity = dynamic(() => import('@/components/tickets/TicketActivity').then(mod => mod.TicketActivity), {
  loading: () => <div className="p-4 animate-pulse bg-gray-50 rounded-lg h-32" />,
  ssr: false
});

const ActivityLogTimeline = dynamic(() => import('@/components/activity/ActivityLogTimeline').then(mod => mod.ActivityLogTimeline), {
  loading: () => <div className="p-4 animate-pulse bg-gray-50 rounded-lg h-32" />,
  ssr: false
});

const TicketComments = dynamic(() => import('@/components/tickets/TicketComments').then(mod => mod.TicketComments), {
  loading: () => <div className="p-4 animate-pulse bg-gray-50 rounded-lg h-32" />,
  ssr: false
});

const TicketDetails = dynamic(() => import('@/components/tickets/TicketDetails').then(mod => mod.TicketDetails), {
  loading: () => <div className="p-4 animate-pulse bg-gray-50 rounded-lg h-32" />,
  ssr: false
});

const AssignTicketDialog = dynamic(() => import('@/components/tickets/AssignTicketDialog').then(mod => mod.AssignTicketDialog), {
  ssr: false
});

const StatusChangeDialog = dynamic(() => import('@/components/tickets/StatusChangeDialog').then(mod => mod.StatusChangeDialog), {
  ssr: false
});

const TicketReports = dynamic(() => import('@/components/tickets/TicketReports').then(mod => mod.TicketReports), {
  loading: () => <div className="p-4 animate-pulse bg-gray-50 rounded-lg h-32" />,
  ssr: false
});

const PhotoGallery = dynamic(() => import('@/components/photo/PhotoGallery'), {
  loading: () => <div className="p-4 animate-pulse bg-gray-50 rounded-lg h-32" />,
  ssr: false
});

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'comments' | 'reports' | 'photos' | 'activitylog'>('details');
  const [activityLogData, setActivityLogData] = useState<any[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignmentStep, setAssignmentStep] = useState<'ZONE_USER' | 'SERVICE_PERSON' | 'EXPERT_HELPDESK'>('ZONE_USER');
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tickets/${id}`);
      setTicket(response.data);
    } catch (error) {
      toast.error('Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLog = async () => {
    try {
      setActivityLogLoading(true);
      const response = await api.get(`/tickets/${id}/activity`);
      setActivityLogData(response.data);
    } catch (error) {
      console.error('Failed to load activity log');
    } finally {
      setActivityLogLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activitylog' && id) {
      fetchActivityLog();
    }
  }, [activeTab, id]);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/tickets/${id}`);
        setTicket(response.data);
      } catch (error) {
        toast.error('Failed to load ticket details');
        router.push('/admin/tickets');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTicket();
    }
  }, [id, router]);

  const handleStatusChange = async (
    status: string, 
    comments?: string, 
    location?: { latitude: number; longitude: number; address?: string; timestamp: string; accuracy?: number; source?: 'gps' | 'manual' | 'network' },
    photos?: { photos: any[]; timestamp: string }
  ) => {
    if (!ticket) return;
    
    try {
      await api.patch(`/tickets/${ticket.id}/status`, { 
        status,
        comments: comments || `Status changed to ${status}`,
        location,
        photos
      });
      
      await fetchTicketDetails();
      
      toast.success('Ticket status updated successfully');
    } catch (error) {
      toast.error('Failed to update ticket status');
      throw error;
    }
  };

  const handleAssignToUser = async (userId: string, note: string) => {
    if (!ticket) return;
    
    try {
      await api.patch(`/tickets/${ticket.id}/assign`, { 
        assignedToId: parseInt(userId),
        note 
      });
      
      // Update ticket status to ASSIGNED if it's not already
      if (ticket.status !== 'ASSIGNED') {
        await api.patch(`/tickets/${ticket.id}/status`, { 
          status: 'ASSIGNED',
          comments: 'Ticket assigned to service person'
        });
      }
      
      // Refresh ticket data
      await fetchTicketDetails();
      
      toast.success('Ticket assigned successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to assign ticket';
      
      toast.error(errorMessage);
    }
  };

  if (loading || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/20">
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] opacity-20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-lg shadow-[#6F8A9D]/25">
                <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-[#546A7A]">{loading ? 'Loading ticket details...' : 'Ticket not found'}</p>
              <p className="text-sm text-[#757777] mt-1">Please wait while we fetch the information</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/20">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Premium Header with Glassmorphism */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-cyan-600 rounded-2xl shadow-2xl shadow-[#6F8A9D]/20 p-6 md:p-8">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#96AEC2]/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-[#6F8A9D]/10 rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => router.back()}
                  className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border border-white/20 transition-all duration-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30">
                    <Hash className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                      Ticket #{ticket.ticketNumber ?? ticket.id}
                    </h1>
                    <p className="text-[#96AEC2] mt-1 text-sm md:text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Created {formatDistanceToNow(new Date(ticket.createdAt))} ago
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setIsStatusDialogOpen(true)}
                    className="relative overflow-hidden bg-gradient-to-r from-[#CE9F6B] via-[#CE9F6B] to-[#E17F70] text-white hover:from-[#CE9F6B] hover:via-orange-400 hover:to-rose-400 border-0 shadow-xl shadow-orange-500/40 hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 font-semibold animate-pulse hover:animate-none"
                    size="default"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                    <Zap className="h-4 w-4 mr-2" />
                    Change Status
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Quick Stats Strip */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20">
                <p className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">Priority</p>
                <p className="text-white font-bold text-lg capitalize">{ticket.priority?.toLowerCase() || 'Normal'}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20">
                <p className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">Zone</p>
                <p className="text-white font-bold text-lg truncate">{ticket.zone?.name || 'Unassigned'}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20">
                <p className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">Call Type</p>
                <p className="text-white font-bold text-lg truncate">{ticket.callType === 'UNDER_MAINTENANCE_CONTRACT' ? 'Under Contract' : 'Not Under Contract'}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20">
                <p className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">Created On</p>
                <p className="text-white font-bold text-lg">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Main Ticket Info */}
        <div className="space-y-6">
          {/* Ticket Overview Card */}
          <Card className="border-0 shadow-xl bg-white overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4 bg-gradient-to-br from-[#AEBFC3]/10 via-white to-[#96AEC2]/10/30 border-b border-[#AEBFC3]/20/80 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] text-white shadow-lg shadow-[#6F8A9D]/25 group-hover:scale-105 transition-transform duration-300">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold text-[#546A7A] leading-tight">{ticket.title}</CardTitle>
                    <p className="text-sm text-[#757777] flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Created {formatDistanceToNow(new Date(ticket.createdAt))} ago
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Description */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#96AEC2]/100" />
                  <h3 className="font-semibold text-[#5D6E73] text-sm uppercase tracking-wide">Description</h3>
                </div>
                <p className="text-[#5D6E73] leading-relaxed pl-4 border-l-2 border-[#96AEC2]">{ticket.description}</p>
              </div>

              {ticket.callType && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#82A094]/100" />
                    <h3 className="font-semibold text-[#5D6E73] text-sm uppercase tracking-wide">Call Type</h3>
                  </div>
                  <div className="pl-4">
                    <Badge 
                      className={`${ticket.callType === 'UNDER_MAINTENANCE_CONTRACT' 
                        ? 'bg-gradient-to-r from-emerald-100 to-[#A2B9AF]/10 text-[#4F6A64] border-emerald-300' 
                        : 'bg-gradient-to-r from-amber-100 to-[#EEC1BF]/10 text-[#976E44] border-amber-300'} 
                        font-semibold px-4 py-1.5 shadow-sm`}
                    >
                      {ticket.callType === 'UNDER_MAINTENANCE_CONTRACT' 
                        ? '✓ Under Maintenance Contract' 
                        : '○ Not Under Contract'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {ticket.contact && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#6F8A9D]" />
                    <h3 className="font-semibold text-[#5D6E73] text-sm uppercase tracking-wide">Contact Information</h3>
                  </div>
                  <div className="pl-4 space-y-2.5">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20/50 hover:from-slate-100 hover:to-slate-150 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-[#96AEC2]/20 flex items-center justify-center">
                        <User className="h-4 w-4 text-[#6F8A9D]" />
                      </div>
                      <span className="text-[#5D6E73] font-medium">{ticket.contact.name}</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20/50 hover:from-slate-100 hover:to-slate-150 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-[#96AEC2]/20 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-[#546A7A]" />
                      </div>
                      <span className="text-[#5D6E73] font-medium break-all">{ticket.contact.email}</span>
                    </div>
                    {ticket.contact.phone && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/20/50 hover:from-slate-100 hover:to-slate-150 transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-[#82A094]/20 flex items-center justify-center">
                          <Phone className="h-4 w-4 text-[#4F6A64]" />
                        </div>
                        <span className="text-[#5D6E73] font-medium">{ticket.contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Asset Details */}
              {ticket.asset && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#CE9F6B]/100" />
                    <h3 className="font-semibold text-[#5D6E73] text-sm uppercase tracking-wide">Asset Details</h3>
                  </div>
                  <div className="pl-4 p-4 rounded-xl bg-gradient-to-br from-[#EEC1BF]/10/50 to-[#EEC1BF]/10/30 border border-[#EEC1BF]/20">
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[#757777] text-sm">Model</span>
                        <span className="font-semibold text-[#546A7A] bg-white px-3 py-1 rounded-lg shadow-sm">{ticket.asset.model}</span>
                      </div>
                      {(ticket.asset as any).serialNo && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#757777] text-sm">Serial Number</span>
                          <span className="font-mono font-semibold text-[#546A7A] bg-white px-3 py-1 rounded-lg shadow-sm text-sm">{(ticket.asset as any).serialNo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Card */}
          <Card className="border-0 shadow-xl bg-white overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] text-white p-5 border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30">
                    <Activity className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg font-bold">Activity Timeline</CardTitle>
                </div>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 overflow-hidden">
              <div className="max-w-full">
                <TicketActivity ticketId={ticket.id} ticket={ticket} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar Content */}
        <div className="space-y-6">
          {/* Assignment Card - Premium Design */}
          <Card className="border-0 shadow-xl bg-white overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-br from-[#82A094] via-[#82A094] to-cyan-600 text-white p-5 border-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Assignment Panel</CardTitle>
                  <p className="text-emerald-100 text-xs mt-0.5">Manage ticket assignments</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Assignment Rows */}
              <div className="space-y-3">
                {/* Parse Metadata and Categorize Assignees */}
                {(() => {
                  let metadata: any = {};
                  try {
                    metadata = (ticket as any).relatedMachineIds ? JSON.parse((ticket as any).relatedMachineIds) : {};
                  } catch (e) {}

                  const teamMembers = metadata.teamMembers || [];
                  const allAssigned = [ticket.assignedTo, ticket.subOwner].filter((u): u is any => !!u);
                  
                  const expertAssignees = allAssigned.filter(u => u.role === 'EXPERT_HELPDESK');
                  const zoneAssignees = allAssigned.filter(u => u.role === 'ZONE_USER' || u.role === 'ZONE_MANAGER');
                  const serviceAssignees = allAssigned.filter(u => u.role === 'SERVICE_PERSON');
                  
                  // Filter out names from teamMembers that are already shown in other sections
                  const displayedNames = new Set(allAssigned.map(u => (u.name || '').toLowerCase().trim()));
                  const filteredTeamMembers = teamMembers.filter((name: string) => !displayedNames.has(name.toLowerCase().trim()));

                  return (
                    <>
                      {/* Expert Helpdesk */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-[#96AEC2]/10/80 to-[#EEC1BF]/10/50 border border-[#96AEC2]/20 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#546A7A] uppercase tracking-wider">Expert Helpdesk</span>
                          {expertAssignees.length > 0 && (
                            <div className="h-2 w-2 rounded-full bg-[#6F8A9D]/100 animate-pulse" />
                          )}
                        </div>
                        <div className="space-y-3">
                          {expertAssignees.length > 0 ? (
                            expertAssignees.map((assignee) => (
                              <div key={assignee.id} className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 ring-2 ring-purple-200 shadow-md">
                                  <AvatarFallback className="bg-gradient-to-br from-[#6F8A9D] to-[#E17F70] text-white font-bold">
                                    {assignee.name?.charAt(0) || 'E'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <span className="font-semibold text-[#546A7A] block">{assignee.name || 'No name'}</span>
                                  {assignee.phone && (
                                    <span className="text-xs text-[#757777] flex items-center gap-1 mt-0.5">
                                      <Phone className="h-3 w-3" /> {assignee.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-[#979796] italic text-sm">Unassigned</span>
                          )}
                        </div>
                      </div>

                      {/* Zone Manager / Zone User */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-[#A2B9AF]/10/80 to-[#A2B9AF]/10/50 border border-[#A2B9AF]/20 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#4F6A64] uppercase tracking-wider">Zone Manager / Zone User</span>
                          {zoneAssignees.length > 0 && (
                            <div className="h-2 w-2 rounded-full bg-[#82A094]/100 animate-pulse" />
                          )}
                        </div>
                        <div className="space-y-3">
                          {zoneAssignees.length > 0 ? (
                            zoneAssignees.map((assignee) => (
                              <div key={assignee.id} className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 ring-2 ring-emerald-200 shadow-md">
                                  <AvatarFallback className={`${assignee.role === 'ZONE_MANAGER' ? 'bg-gradient-to-br from-[#CE9F6B] to-[#CE9F6B]' : 'bg-gradient-to-br from-[#82A094] to-[#82A094]'} text-white font-bold`}>
                                    {assignee.name?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <span className="font-semibold text-[#546A7A] block">{assignee.name || 'No name'}</span>
                                  <Badge className={`text-[10px] px-2 py-0 ${assignee.role === 'ZONE_MANAGER' ? 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]/40' : 'bg-[#82A094]/20 text-[#4F6A64] border-[#A2B9AF]/40'}`}>
                                    {assignee.role === 'ZONE_MANAGER' ? 'Zone Manager' : 'Zone User'}
                                  </Badge>
                                  {assignee.phone && (
                                    <span className="text-xs text-[#757777] flex items-center gap-1 mt-1">
                                      <Phone className="h-3 w-3" /> {assignee.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-[#979796] italic text-sm">Unassigned</span>
                          )}
                        </div>
                      </div>

                      {/* Service Person Block */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-[#82A094]/10/80 to-[#82A094]/10/50 border border-[#82A094]/20 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#4F6A64] uppercase tracking-wider">Service Person</span>
                        </div>
                        <div className="space-y-3">
                          {/* Combine explicit service assignees and filtered team members */}
                          {serviceAssignees.length === 0 && filteredTeamMembers.length === 0 ? (
                            <div className="flex flex-1 items-center justify-between">
                              <span className="text-[#979796] italic text-sm">Unassigned</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setAssignmentStep('SERVICE_PERSON');
                                  setIsAssignDialogOpen(true);
                                }}
                                className="text-[#82A094] hover:text-[#4F6A64] hover:bg-[#82A094]/10 h-8"
                              >
                                <UserPlus className="h-4 w-4 mr-1.5" />
                                Assign
                              </Button>
                            </div>
                          ) : (
                            <>
                              {serviceAssignees.map((assignee) => (
                                <div key={assignee.id} className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10 ring-2 ring-[#82A094]/20 shadow-md">
                                    <AvatarFallback className="bg-gradient-to-br from-[#82A094] to-[#AEBFC3] text-white font-bold text-sm">
                                      {assignee.name?.charAt(0) || 'S'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <span className="font-semibold text-[#546A7A] block">{assignee.name || 'No name'}</span>
                                    {assignee.phone && (
                                      <span className="text-xs text-[#757777] flex items-center gap-1 mt-1">
                                        <Phone className="h-3 w-3" /> {assignee.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {filteredTeamMembers.map((name: string, idx: number) => (
                                <div key={`team-${idx}`} className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 ring-2 ring-[#82A094]/10 shadow-sm">
                                    <AvatarFallback className="bg-gradient-to-br from-[#82A094] to-[#AEBFC3] text-white font-bold text-xs">
                                      {name.charAt(0) || 'S'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <span className="font-semibold text-[#546A7A] text-sm block">{name}</span>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

                {/* Zone & Created By Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#AEBFC3]/10 border border-[#AEBFC3]/20">
                    <div className="flex items-center gap-2 text-[#757777] text-xs mb-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Zone
                    </div>
                    <p className="font-semibold text-[#546A7A] truncate">{ticket.zone?.name || 'Unassigned'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#AEBFC3]/10 border border-[#AEBFC3]/20">
                    <div className="flex items-center gap-2 text-[#757777] text-xs mb-1">
                      <User className="h-3.5 w-3.5" />
                      Created By
                    </div>
                    <p className="font-semibold text-[#546A7A] truncate">{ticket.owner?.name || 'System'}</p>
                  </div>
                </div>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-[#AEBFC3]/20">
                <p className="text-xs font-semibold text-[#757777] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-[#CE9F6B]" />
                  Quick Actions
                </p>
                <div className="space-y-2.5">
                  <Button 
                    onClick={() => {
                      setAssignmentStep('EXPERT_HELPDESK');
                      setIsAssignDialogOpen(true);
                    }}
                    disabled={!ticket}
                    className="w-full justify-between h-12 bg-gradient-to-r from-[#6F8A9D] to-[#E17F70] hover:from-[#6F8A9D] hover:to-[#9E3B47] text-white shadow-lg shadow-[#6F8A9D]/25 hover:shadow-xl transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-white/20">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-sm">Assign to Expert Helpdesk</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={() => {
                      setAssignmentStep('ZONE_USER');
                      setIsAssignDialogOpen(true);
                    }}
                    disabled={!ticket}
                    className="w-full justify-between h-12 bg-gradient-to-r from-[#82A094] to-[#82A094] hover:from-[#82A094] hover:to-[#82A094] text-white shadow-lg shadow-[#82A094]/25 hover:shadow-xl transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-white/20">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-sm">Assign to Zone User</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={() => {
                      setAssignmentStep('SERVICE_PERSON');
                      setIsAssignDialogOpen(true);
                    }}
                    disabled={!ticket}
                    className="w-full justify-between h-12 bg-gradient-to-r from-[#9E3B47] to-[#CE9F6B] hover:from-[#9E3B47] hover:to-[#9E3B47]/90 text-white shadow-lg shadow-[#9E3B47]/25 hover:shadow-xl transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-white/20">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-sm">Assign to Service Person</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Tabs Card - Premium Design */}
          <Card className="border-0 shadow-xl bg-white overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-br from-[#CE9F6B] via-[#CE9F6B] to-[#E17F70] text-white p-5 border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30">
                    <FileText className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg font-bold">Ticket Information</CardTitle>
                </div>
              </div>
              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 mt-4">
                {[
                  { id: 'details', label: 'Details', icon: FileText },
                  { id: 'activitylog', label: 'Activity Log', icon: Activity },
                  { id: 'comments', label: 'Comments', icon: MessageSquare },
                  { id: 'reports', label: 'Reports', icon: Upload },
                  { id: 'photos', label: 'Photos', icon: Camera },
                ].map((tab) => (
                  <Button 
                    key={tab.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 h-9 rounded-xl transition-all duration-200 ${
                      activeTab === tab.id 
                        ? 'bg-white text-[#976E44] shadow-lg hover:bg-white' 
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    <tab.icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-5 overflow-hidden">
              <div className="max-w-full">
                {activeTab === 'details' ? (
                  <TicketDetails ticket={ticket} onStatusChange={async (status) => {
                    try {
                      await api.patch(`/tickets/${ticket.id}`, { status });
                      setTicket({ ...ticket, status });
                    } catch (error) {
                    }
                  }} />
                ) : activeTab === 'activitylog' ? (
                  <ActivityLogTimeline 
                    entityType="ticket" 
                    activities={activityLogData}
                    loading={activityLogLoading}
                    onRefresh={fetchActivityLog}
                    emptyMessage="No activity recorded yet"
                  />
                ) : activeTab === 'reports' ? (
                  <TicketReports ticketId={ticket.id.toString()} />
                ) : activeTab === 'photos' ? (
                  <PhotoGallery 
                    ticketId={ticket.id} 
                    title="Onsite Verification Photos"
                    showUploadTime={true}
                    className="border-0 bg-transparent"
                  />
                ) : (
                  <TicketComments ticketId={ticket.id} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status History Card - Premium Design */}
          <Card className="border-0 shadow-xl bg-white overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-[#E17F70] text-white p-5 border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30">
                    <History className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg font-bold">Status History</CardTitle>
                </div>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  {ticket.statusHistory?.length || 0} updates
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-4">
                {ticket.statusHistory?.length ? (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[19px] top-6 bottom-2 w-0.5 bg-gradient-to-b from-purple-200 via-purple-100 to-transparent" />
                    
                    <div className="space-y-4">
                      {ticket.statusHistory.map((history, index) => (
                        <div key={history.id} className="relative pl-12">
                          {/* Timeline dot */}
                          <div className={`absolute left-0 top-1 h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${
                            index === 0 
                              ? 'bg-gradient-to-br from-green-400 to-[#82A094] text-white ring-4 ring-green-100' 
                              : 'bg-white border-2 border-[#6F8A9D]'
                          }`}>
                            {index === 0 ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <div className="h-2.5 w-2.5 rounded-full bg-[#6F8A9D]" />
                            )}
                          </div>
                          
                          <div className="p-4 rounded-xl bg-gradient-to-r from-[#AEBFC3]/10 to-[#96AEC2]/10/30 border border-purple-50 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <StatusBadge status={history.status} />
                                  <span className="text-[#757777] text-xs">•</span>
                                  <span className="text-sm text-[#5D6E73] font-medium">
                                    by {history.changedBy?.name || history.changedBy?.email?.split('@')[0] || 'Unknown'}
                                  </span>
                                </div>
                                {history.notes && (
                                  <p className="text-sm text-[#757777] line-clamp-2">
                                    {history.notes.split('\n\n')[0]}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-[#979796] whitespace-nowrap bg-white px-2 py-1 rounded-lg shadow-sm">
                                {format(new Date(history.changedAt), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  ) : (
                  <div className="text-center py-8">
                    <div className="h-16 w-16 rounded-full bg-[#6F8A9D]/10 flex items-center justify-center mx-auto mb-4">
                      <History className="h-8 w-8 text-[#6F8A9D]" />
                    </div>
                    <p className="text-[#757777] font-medium">No status history available</p>
                    <p className="text-[#979796] text-sm mt-1">Status changes will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

      <AssignTicketDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        ticketId={ticket.id}
        onSuccess={fetchTicketDetails}
        zoneId={ticket.zone?.id}
        initialStep={assignmentStep}
        currentAssignedExpertHelpdesk={ticket.assignedTo && ticket.assignedTo.role === 'EXPERT_HELPDESK' ? {
          id: ticket.assignedTo.id.toString(),
          name: ticket.assignedTo.name || 'No name',
          email: ticket.assignedTo.email,
          phone: ticket.assignedTo.phone || undefined
        } : null}
        currentAssignedZoneUser={ticket.assignedTo && (ticket.assignedTo.role === 'ZONE_USER' || ticket.assignedTo.role === 'ZONE_MANAGER') ? {
          id: ticket.assignedTo.id.toString(),
          name: ticket.assignedTo.name || 'No name',
          email: ticket.assignedTo.email,
          phone: ticket.assignedTo.phone || undefined
        } : null}
        currentAssignedServicePerson={ticket.assignedTo && ticket.assignedTo.role === 'SERVICE_PERSON' ? {
          id: ticket.assignedTo.id.toString(),
          name: ticket.assignedTo.name || 'No name',
          email: ticket.assignedTo.email,
          phone: ticket.assignedTo.phone || undefined
        } : null}
      />
      
      <StatusChangeDialog
        isOpen={isStatusDialogOpen}
        onClose={() => setIsStatusDialogOpen(false)}
        currentStatus={ticket.status}
        ticketId={ticket.id}
        userRole={user?.role}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
