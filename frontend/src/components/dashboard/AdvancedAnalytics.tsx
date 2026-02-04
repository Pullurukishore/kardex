"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  RefreshCw, 
  PieChart, 
  TrendingUp, 
  CheckCircle, 
  BarChart3, 
  Filter,
  Calendar,
  Sparkles
} from "lucide-react";
import type { DashboardData, StatusDistribution, TrendsData } from "./types";
import StatusPieChart from "./charts/StatusPieChart";
import TrendLineChart from "./charts/TrendLineChart";
import DrillDownModal from "./DrillDownModal";

interface AdvancedAnalyticsProps {
  dashboardData: Partial<DashboardData>;
  statusDistribution: StatusDistribution;
  ticketTrends: TrendsData;
  loading: boolean;
}

export default function AdvancedAnalytics({ 
  dashboardData, 
  statusDistribution, 
  ticketTrends, 
  loading 
}: AdvancedAnalyticsProps) {
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showClosedTickets, setShowClosedTickets] = useState(false);

  // Status color mapping - Kardex branded colors
  const colorMap: { [key: string]: string } = {
    'open': '#6F8A9D',           // Kardex blue
    'reopened': '#546A7A',       // Kardex dark blue
    'assigned': '#96AEC2',       // Kardex light blue
    'in_progress': '#CE9F6B',    // Kardex sand
    'in_process': '#CE9F6B',     // Kardex sand
    'onsite_visit': '#976E44',   // Kardex dark sand
    'onsite_visit_planned': '#CE9F6B',
    'onsite_visit_started': '#976E44',
    'onsite_visit_reached': '#82A094',
    'onsite_visit_in_progress': '#CE9F6B',
    'onsite_visit_resolved': '#4F6A64',
    'onsite_visit_pending': '#EEC1BF',
    'onsite_visit_completed': '#82A094',
    'spare_parts_needed': '#E17F70', // Kardex coral
    'spare_parts_booked': '#EEC1BF',
    'spare_parts_delivered': '#A2B9AF',
    'po_needed': '#9E3B47',      // Kardex burgundy
    'po_received': '#E17F70',
    'po_reached': '#82A094',
    'waiting_customer': '#E17F70',
    'pending': '#CE9F6B',
    'on_hold': '#9E3B47',
    'escalated': '#9E3B47',      // Kardex burgundy
    'resolved': '#82A094',       // Kardex green
    'closed_pending': '#4F6A64',
    'closed': '#A2B9AF',         // Kardex light green
    'cancelled': '#AEBFC3',      // Kardex gray
  };

  // Transform status distribution data for pie chart
  const statusChartData = useMemo(() => {
    if (!statusDistribution?.distribution?.length) return [];
    
    const isCompletedStatus = (status: string) => {
      const statusLower = status.toLowerCase();
      return statusLower === 'closed' || statusLower === 'cancelled';
    };
    
    const filteredDistribution = showClosedTickets 
      ? statusDistribution.distribution
      : statusDistribution.distribution.filter(item => !isCompletedStatus(item.status));

    return filteredDistribution.map(item => ({
      status: item.status.replace('_', ' '),
      count: item.count,
      color: colorMap[item.status.toLowerCase()] || '#6b7280'
    }));
  }, [statusDistribution, showClosedTickets]);

  // Transform trends data for line chart
  const trendsChartData = useMemo(() => {
    if (!ticketTrends?.trends?.length) return [];
    return ticketTrends.trends.slice(-14).map(trend => ({
      date: trend.date,
      count: trend.count
    }));
  }, [ticketTrends]);

  const handleStatusClick = (status: string) => {
    setSelectedStatus(status);
    setDrillDownOpen(true);
  };

  // Mock ticket data for drill-down
  const mockTickets = dashboardData?.recentTickets?.slice(0, 10).map(ticket => ({
    id: String(ticket.id),
    ticketNumber: `TKT-${ticket.id}`,
    title: ticket.title || 'Untitled',
    status: ticket.status || 'open',
    priority: ticket.priority || 'medium',
    customerName: ticket.customer?.companyName,
    assignedTo: (ticket as any).assignedTo || undefined,
    location: (ticket as any).location || ticket.customer?.companyName,
    createdAt: ticket.createdAt || new Date().toISOString(),
    updatedAt: (ticket as any).updatedAt,
    responseTime: (ticket as any).responseTime,
    resolutionTime: (ticket as any).resolutionTime,
  })) || [];

  return (
    <div className="mb-6">
      <Card className="relative overflow-hidden bg-white border border-[#96AEC2]/20 shadow-lg rounded-2xl">
        {/* Background decorations with Kardex colors */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#E17F70]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#82A094]/5 rounded-full blur-3xl pointer-events-none" />
        
        <CardHeader className="relative z-10 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2.5 text-lg sm:text-xl font-bold">
                <div className="p-2 bg-gradient-to-br from-[#E17F70] to-[#9E3B47] rounded-xl shadow-md shadow-[#E17F70]/20">
                  <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-[#546A7A]">Analytics Dashboard</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1 text-[#757777] ml-10 sm:ml-11">
                Ticket distribution patterns and volume trends
              </CardDescription>
            </div>
            <Badge className="bg-[#82A094]/20 text-[#4F6A64] border border-[#82A094]/40 px-2.5 py-1 text-[10px] font-bold ml-10 sm:ml-0">
              <Sparkles className="w-2.5 h-2.5 mr-1" />
              Visual Insights
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="relative z-10 pt-0">
          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#96AEC2]/15 p-1 rounded-lg h-9">
              <TabsTrigger value="status" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#546A7A] h-7">
                <PieChart className="w-3.5 h-3.5 mr-1.5" />
                Status Distribution
              </TabsTrigger>
              <TabsTrigger value="trends" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#546A7A] h-7">
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                Volume Trends
              </TabsTrigger>
            </TabsList>
            
            {/* STATUS DISTRIBUTION TAB */}
            <TabsContent value="status" className="mt-4">
              <div className="space-y-4">
                {/* Filter Toggle - Compact */}
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#96AEC2]/10 to-[#82A094]/10 rounded-lg border border-[#96AEC2]/20">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#6F8A9D]/20 rounded-md">
                      <Filter className="w-3.5 h-3.5 text-[#546A7A]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#546A7A]">Show Archived</p>
                      <p className="text-[10px] text-[#757777]">
                        {showClosedTickets ? 'All statuses' : 'Hiding closed & cancelled'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${showClosedTickets ? 'bg-[#6F8A9D]/15 text-[#546A7A] border-[#6F8A9D]/40' : 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/40'}`}>
                      {showClosedTickets ? 'All' : 'Active'}
                    </Badge>
                    <Switch 
                      checked={showClosedTickets}
                      onCheckedChange={setShowClosedTickets}
                      className="data-[state=checked]:bg-[#6F8A9D] scale-90"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="h-[280px] flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#6F8A9D] mx-auto" />
                      <p className="text-xs text-[#757777]">Loading analytics...</p>
                    </div>
                  </div>
                ) : statusChartData.length === 0 && !showClosedTickets ? (
                  <div className="h-[280px] flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-[#82A094]/20 to-[#A2B9AF]/15 rounded-xl">
                      <CheckCircle className="w-10 h-10 text-[#4F6A64]" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-[#546A7A]">All Clear! 🎉</p>
                      <p className="text-xs text-[#757777] mt-0.5">No active tickets in queue</p>
                      <button
                        onClick={() => setShowClosedTickets(true)}
                        className="mt-3 px-4 py-1.5 bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white rounded-lg hover:shadow-md transition-all text-xs font-semibold"
                      >
                        View Archived
                      </button>
                    </div>
                  </div>
                ) : statusDistribution?.distribution?.length ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Pie Chart - Enhanced Card */}
                    <div className="bg-gradient-to-br from-white via-white to-[#96AEC2]/10 rounded-xl p-4 border border-[#96AEC2]/20 shadow-sm hover:shadow-md transition-shadow">
                      <StatusPieChart 
                        data={statusChartData}
                        title="Status Distribution"
                        onSegmentClick={handleStatusClick}
                      />
                    </div>
                    
                    {/* Status Breakdown List - Enhanced */}
                    <div className="bg-gradient-to-br from-white via-white to-[#82A094]/10 rounded-xl p-4 border border-[#82A094]/20 shadow-sm">
                      <h4 className="font-semibold text-sm text-[#546A7A] mb-3 flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-lg">
                          <BarChart3 className="w-3.5 h-3.5 text-white" />
                        </div>
                        Status Breakdown
                      </h4>
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {statusChartData.map((chartItem, i) => {
                          const item = statusDistribution.distribution.find(
                            d => d.status.toLowerCase() === chartItem.status.toLowerCase().replace(' ', '_')
                          );
                          if (!item) return null;
                          const total = statusDistribution.distribution.reduce((sum, d) => sum + d.count, 0);
                          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                          const statusColor = statusChartData[i]?.color || '#6b7280';
                          
                          return (
                            <div 
                              key={i} 
                              className="p-2.5 bg-white rounded-lg border-l-3 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 cursor-pointer group"
                              style={{ borderLeftWidth: '3px', borderLeftColor: statusColor }}
                              onClick={() => handleStatusClick(item.status)}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: statusColor }}
                                  />
                                  <span className="font-medium text-xs text-[#5D6E73] capitalize">
                                    {item.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base font-bold" style={{ color: statusColor }}>
                                    {item.count}
                                  </span>
                                  <Badge 
                                    className="text-[9px] px-1.5 py-0.5 font-bold"
                                    style={{ 
                                      backgroundColor: `${statusColor}20`,
                                      color: statusColor,
                                    }}
                                  >
                                    {percentage}%
                                  </Badge>
                                </div>
                              </div>
                              <div className="relative h-1 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                                <div 
                                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 group-hover:opacity-80"
                                  style={{ 
                                    width: `${percentage}%`,
                                    backgroundColor: statusColor,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center">
                    <p className="text-sm text-[#757777]">No status data available</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* TRENDS TAB */}
            <TabsContent value="trends" className="mt-6">
              <div className="space-y-6">
                {loading ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <RefreshCw className="h-8 w-8 animate-spin text-[#6F8A9D] mx-auto" />
                      <p className="text-sm text-[#757777]">Loading trends...</p>
                    </div>
                  </div>
                ) : ticketTrends?.trends?.length ? (
                  <>
                    {/* Trend Chart */}
                    <div className="bg-gradient-to-br from-white to-[#96AEC2]/10/30 rounded-2xl p-5 border border-[#AEBFC3]/30 shadow-sm">
                      <TrendLineChart 
                        data={trendsChartData}
                        title="14-Day Ticket Volume"
                        description="Daily ticket creation patterns"
                        dataKey="count"
                        color="#3b82f6"
                        showArea={true}
                        showComparison={true}
                      />
                    </div>
                    
                    {/* Weekly Summary Cards */}
                    <div className="bg-gradient-to-br from-white to-[#AEBFC3]/10 rounded-2xl p-5 border border-[#AEBFC3]/30 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-[#546A7A] flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#546A7A]" />
                          Last 7 Days
                        </h4>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-[#96AEC2]/20 text-[#546A7A] border-0">
                            {ticketTrends.trends.slice(-7).reduce((sum, t) => sum + t.count, 0)} Total
                          </Badge>
                          <Badge className="bg-[#82A094]/20 text-[#4F6A64] border-0">
                            ~{Math.round(ticketTrends.trends.slice(-7).reduce((sum, t) => sum + t.count, 0) / 7)}/day
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-2">
                        {ticketTrends.trends.slice(-7).map((trend, i) => {
                          const maxCount = Math.max(...ticketTrends.trends.slice(-7).map(t => t.count));
                          const percentage = maxCount > 0 ? (trend.count / maxCount) * 100 : 0;
                          const isHighest = trend.count === maxCount && maxCount > 0;
                          
                          return (
                            <div 
                              key={i} 
                              className={`p-3 rounded-xl text-center transition-all duration-300 hover:shadow-md ${
                                isHighest 
                                  ? 'bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/20 border border-[#96AEC2]' 
                                  : 'bg-white border border-[#AEBFC3]/30'
                              }`}
                            >
                              <p className="text-[10px] font-medium text-[#757777] mb-1">
                                {new Date(trend.date).toLocaleDateString('en-US', { weekday: 'short' })}
                              </p>
                              <p className={`text-xl font-bold ${isHighest ? 'text-[#546A7A]' : 'text-[#546A7A]'}`}>
                                {trend.count}
                              </p>
                              {isHighest && (
                                <p className="text-[10px] text-[#546A7A] font-medium mt-0.5">Peak</p>
                              )}
                              <div className="mt-2 h-1 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${isHighest ? 'bg-[#96AEC2]/100' : 'bg-[#92A2A5]'}`}
                                  style={{ width: `${Math.max(10, percentage)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[350px] flex items-center justify-center">
                    <p className="text-[#757777]">No trends data available</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Drill-Down Modal */}
      <DrillDownModal 
        isOpen={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        title={selectedStatus ? `${selectedStatus.replace('_', ' ')} Tickets` : 'Ticket Details'}
        description={`Detailed view of all ${selectedStatus ? selectedStatus.replace('_', ' ').toLowerCase() : ''} tickets`}
        tickets={mockTickets}
        statusFilter={selectedStatus || undefined}
      />
    </div>
  );
}
