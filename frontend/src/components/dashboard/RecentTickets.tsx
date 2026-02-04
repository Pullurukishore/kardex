"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Ticket,
  Clock,
  Eye,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Building2,
  Cpu,
  Zap
} from "lucide-react";
import type { DashboardData } from "./types";

interface RecentTicketsProps {
  dashboardData: Partial<DashboardData>;
  loading: boolean;
}

// Enhanced status colors with subtle gradients - covers all backend statuses
const getStatusStyles = (status: string) => {
  const statusLower = status.toLowerCase();
  
  const styles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    // Basic statuses
    'open': { 
      bg: 'bg-[#96AEC2]/10', 
      text: 'text-[#546A7A]', 
      border: 'border-[#96AEC2]',
      dot: 'bg-[#96AEC2]/100'
    },
    'assigned': { 
      bg: 'bg-[#6F8A9D]/10', 
      text: 'text-[#546A7A]', 
      border: 'border-[#6F8A9D]',
      dot: 'bg-[#6F8A9D]/100'
    },
    'in_progress': { 
      bg: 'bg-[#CE9F6B]/10', 
      text: 'text-[#976E44]', 
      border: 'border-[#CE9F6B]/50',
      dot: 'bg-[#CE9F6B]/100'
    },
    'in_process': { 
      bg: 'bg-[#CE9F6B]/10', 
      text: 'text-[#976E44]', 
      border: 'border-[#CE9F6B]/50',
      dot: 'bg-[#CE9F6B]/100'
    },
    'waiting_customer': { 
      bg: 'bg-[#CE9F6B]/10', 
      text: 'text-[#976E44]', 
      border: 'border-[#CE9F6B]',
      dot: 'bg-[#CE9F6B]/100'
    },
    'pending': { 
      bg: 'bg-[#EEC1BF]/10', 
      text: 'text-[#976E44]', 
      border: 'border-[#CE9F6B]',
      dot: 'bg-[#EEC1BF]/100'
    },
    'on_hold': { 
      bg: 'bg-[#AEBFC3]/10', 
      text: 'text-[#5D6E73]', 
      border: 'border-[#92A2A5]',
      dot: 'bg-[#AEBFC3]/100'
    },
    'reopened': { 
      bg: 'bg-[#EEC1BF]/10', 
      text: 'text-[#9E3B47]', 
      border: 'border-[#EEC1BF]/50',
      dot: 'bg-[#EEC1BF]/100'
    },
    
    // Resolution statuses
    'resolved': { 
      bg: 'bg-[#82A094]/10', 
      text: 'text-[#4F6A64]', 
      border: 'border-[#82A094]/50',
      dot: 'bg-[#82A094]/100'
    },
    'closed': { 
      bg: 'bg-[#A2B9AF]/10', 
      text: 'text-[#4F6A64]', 
      border: 'border-[#A2B9AF]',
      dot: 'bg-[#A2B9AF]/100'
    },
    'closed_pending': { 
      bg: 'bg-[#82A094]/10', 
      text: 'text-[#4F6A64]', 
      border: 'border-[#82A094]/50',
      dot: 'bg-[#82A094]/100'
    },
    'escalated': { 
      bg: 'bg-[#E17F70]/10', 
      text: 'text-[#75242D]', 
      border: 'border-[#E17F70]',
      dot: 'bg-[#E17F70]/100'
    },
    
    // Onsite visit statuses
    'onsite_visit': { 
      bg: 'bg-[#96AEC2]/10', 
      text: 'text-[#546A7A]', 
      border: 'border-[#96AEC2]/50',
      dot: 'bg-[#96AEC2]/100'
    },
    'onsite_visit_planned': { 
      bg: 'bg-sky-50', 
      text: 'text-sky-700', 
      border: 'border-sky-200',
      dot: 'bg-sky-500'
    },
    'onsite_visit_started': { 
      bg: 'bg-[#546A7A]/10', 
      text: 'text-[#546A7A]', 
      border: 'border-[#546A7A]',
      dot: 'bg-[#546A7A]/100'
    },
    'onsite_visit_reached': { 
      bg: 'bg-[#6F8A9D]/10', 
      text: 'text-[#546A7A]', 
      border: 'border-[#6F8A9D]/50',
      dot: 'bg-[#6F8A9D]'
    },
    'onsite_visit_in_progress': { 
      bg: 'bg-[#EEC1BF]/10', 
      text: 'text-fuchsia-700', 
      border: 'border-fuchsia-200',
      dot: 'bg-[#E17F70]'
    },
    'onsite_visit_resolved': { 
      bg: 'bg-[#82A094]/10', 
      text: 'text-[#4F6A64]', 
      border: 'border-[#82A094]/50',
      dot: 'bg-[#82A094]/100'
    },
    'onsite_visit_pending': { 
      bg: 'bg-[#EEC1BF]/10', 
      text: 'text-[#976E44]', 
      border: 'border-[#CE9F6B]',
      dot: 'bg-[#EEC1BF]/100'
    },
    'onsite_visit_completed': { 
      bg: 'bg-[#A2B9AF]/10', 
      text: 'text-[#4F6A64]', 
      border: 'border-[#A2B9AF]',
      dot: 'bg-[#A2B9AF]/100'
    },
    
    // PO statuses
    'po_needed': { 
      bg: 'bg-[#EEC1BF]/10', 
      text: 'text-[#9E3B47]', 
      border: 'border-[#EEC1BF]/50',
      dot: 'bg-[#EEC1BF]/100'
    },
    'po_received': { 
      bg: 'bg-[#EEC1BF]/10', 
      text: 'text-[#9E3B47]', 
      border: 'border-[#EEC1BF]/50',
      dot: 'bg-[#EEC1BF]/100'
    },
    'po_reached': { 
      bg: 'bg-lime-50', 
      text: 'text-lime-700', 
      border: 'border-lime-200',
      dot: 'bg-lime-500'
    },
    
    // Spare parts statuses
    'spare_parts_needed': { 
      bg: 'bg-[#CE9F6B]/10', 
      text: 'text-[#976E44]', 
      border: 'border-[#CE9F6B]',
      dot: 'bg-[#CE9F6B]/100'
    },
    'spare_parts_booked': { 
      bg: 'bg-[#CE9F6B]/10', 
      text: 'text-[#976E44]', 
      border: 'border-[#CE9F6B]/50',
      dot: 'bg-[#CE9F6B]/100'
    },
    'spare_parts_delivered': { 
      bg: 'bg-lime-50', 
      text: 'text-lime-700', 
      border: 'border-lime-200',
      dot: 'bg-lime-500'
    }
  };

  return styles[statusLower] || { 
    bg: 'bg-[#AEBFC3]/10', 
    text: 'text-[#5D6E73]', 
    border: 'border-[#92A2A5]',
    dot: 'bg-[#AEBFC3]/100'
  };
};

const getPriorityStyles = (priority: string) => {
  const priorityLower = priority.toLowerCase();
  
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    'critical': { bg: 'bg-[#E17F70]/10', text: 'text-[#75242D]', border: 'border-[#E17F70]' },
    'high': { bg: 'bg-[#CE9F6B]/10', text: 'text-[#976E44]', border: 'border-[#CE9F6B]' },
    'medium': { bg: 'bg-[#CE9F6B]/10', text: 'text-[#976E44]', border: 'border-[#CE9F6B]/50' },
    'low': { bg: 'bg-[#A2B9AF]/10', text: 'text-[#4F6A64]', border: 'border-[#A2B9AF]' }
  };

  return styles[priorityLower] || { bg: 'bg-[#AEBFC3]/10', text: 'text-[#5D6E73]', border: 'border-[#92A2A5]' };
};

const formatStatus = (status: string) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatPriority = (priority: string) => {
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
};

export default function RecentTickets({ dashboardData, loading }: RecentTicketsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const getTicketsRoute = (ticketId?: string) => {
    const basePath = pathname.startsWith('/zone') 
      ? '/zone' 
      : pathname.startsWith('/service-person') 
        ? '/service-person' 
        : '/admin';
    
    return ticketId ? `${basePath}/tickets/${ticketId}` : `${basePath}/tickets`;
  };

  const tickets = dashboardData?.recentTickets?.slice(0, 6) || [];

  return (
    <Card className="relative overflow-hidden bg-white border-0 shadow-xl rounded-2xl sm:rounded-3xl">
      {/* Background decorations */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#CE9F6B]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#96AEC2]/5 rounded-full blur-3xl pointer-events-none" />
      
      <CardHeader className="relative z-10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold">
              <div className="relative">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-[#CE9F6B] via-rose-500 to-[#E17F70] rounded-xl sm:rounded-2xl shadow-lg shadow-orange-500/25">
                  <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
              <span className="text-[#546A7A]">Recent Activity</span>
            </CardTitle>
            <CardDescription className="text-sm sm:text-base mt-2 text-[#757777] ml-14 sm:ml-16">
              Latest support requests and ticket updates
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap ml-14 sm:ml-0">
            <Badge className="bg-[#CE9F6B]/20 text-[#976E44] border border-[#CE9F6B]/50 px-3 py-1.5 text-xs font-semibold">
              <div className="w-1.5 h-1.5 bg-[#CE9F6B]/100 rounded-full mr-2 animate-pulse" />
              <Zap className="w-3 h-3 mr-1" />
              Live
            </Badge>
            
            <Button 
              variant="outline" 
              onClick={() => router.push(getTicketsRoute())}
              className="bg-white hover:bg-[#CE9F6B]/10 border-[#CE9F6B] text-[#976E44] hover:text-[#976E44] flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-300 rounded-xl"
              size="sm"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View All</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10 pt-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <div className="p-4 bg-gradient-to-br from-orange-100 to-[#EEC1BF]/20 rounded-2xl">
                <RefreshCw className="h-8 w-8 animate-spin text-[#CE9F6B]" />
              </div>
            </div>
            <span className="text-[#757777] font-medium">Loading tickets...</span>
          </div>
        ) : tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map((ticket, index) => {
              const statusStyles = getStatusStyles(ticket.status);
              const priorityStyles = getPriorityStyles(ticket.priority);
              
              return (
                <div 
                  key={ticket.id} 
                  className="group relative p-4 sm:p-5 bg-gradient-to-r from-white to-[#AEBFC3]/10/50 border border-[#92A2A5]/60 rounded-xl sm:rounded-2xl hover:border-[#CE9F6B]/60 hover:shadow-lg hover:shadow-orange-100/50 transition-all duration-300 cursor-pointer"
                  onClick={() => router.push(getTicketsRoute(ticket.id.toString()))}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Status indicator line */}
                  <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${statusStyles.dot} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  
                  <div className="flex items-start sm:items-center gap-4 ml-3">
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
                      {/* Title and badges row */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-0">
                          <h4 className="font-semibold text-[#546A7A] text-sm sm:text-base group-hover:text-[#976E44] transition-colors truncate max-w-[200px] sm:max-w-none">
                            {ticket.title}
                          </h4>
                          
                          {/* Badges - responsive layout */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={`${statusStyles.bg} ${statusStyles.text} ${statusStyles.border} border text-[10px] sm:text-xs font-medium px-2 py-0.5`}>
                              {formatStatus(ticket.status)}
                            </Badge>
                            <Badge className={`${priorityStyles.bg} ${priorityStyles.text} ${priorityStyles.border} border text-[10px] sm:text-xs font-medium px-2 py-0.5`}>
                              {formatPriority(ticket.priority)}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Info row */}
                        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[#757777]">
                          <span className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-[#979796]" />
                            <span className="truncate max-w-[120px] sm:max-w-[200px]">{ticket.customer.companyName}</span>
                          </span>
                          
                          {ticket.asset && (
                            <span className="flex items-center gap-1.5">
                              <Cpu className="w-3 h-3 text-[#979796]" />
                              <span className="truncate max-w-[80px] sm:max-w-[120px]">{ticket.asset.model}</span>
                            </span>
                          )}
                          
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#979796]" />
                            {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Arrow button */}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex-shrink-0 text-[#979796] hover:text-[#976E44] hover:bg-[#CE9F6B]/10 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300"
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-4">
            <div className="relative inline-flex">
              <div className="p-5 bg-gradient-to-br from-[#AEBFC3]/20 to-slate-200 rounded-2xl">
                <Ticket className="h-10 w-10 text-[#979796]" />
              </div>
              <div className="absolute -top-1 -right-1 p-2 bg-[#82A094]/20 rounded-full border-2 border-white">
                <Sparkles className="w-4 h-4 text-[#4F6A64]" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-[#5D6E73]">All caught up!</p>
              <p className="text-sm text-[#757777]">No recent tickets found</p>
            </div>
            <Button 
              onClick={() => router.push(getTicketsRoute())}
              className="bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] hover:from-[#976E44] hover:to-[#9E3B47] text-white font-semibold mt-2 rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all"
            >
              <Eye className="w-4 h-4 mr-2" />
              Browse All Tickets
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
