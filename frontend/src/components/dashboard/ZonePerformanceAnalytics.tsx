"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin,
  Building2,
  Users,
  Ticket,
  Activity,
  Globe,
  RefreshCw,
  Award,
  Star,
  Clock,
  Timer,
  TrendingUp,
  BarChart3,
  Sparkles,
  Zap,
  Target,
  Server
} from "lucide-react";
import { formatNumber } from "./utils";
import type { DashboardData } from "./types";

interface ZonePerformanceAnalyticsProps {
  dashboardData: Partial<DashboardData>;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
}

// Helper function to get real zone-specific resolution time from backend data
const getZoneResolutionTime = (zone: any) => {
  return zone.avgResolutionTimeHours || 0;
};

// Helper function to format resolution time
const formatResolutionTime = (hours: number) => {
  if (hours === 0) return '0h';
  
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes % (24 * 60);
  const displayHours = Math.floor(remainingMinutes / 60);
  const displayMinutes = remainingMinutes % 60;
  
  if (days > 0) {
    if (displayHours > 0) return `${days}d ${displayHours}h`;
    return `${days}d`;
  }
  
  if (displayHours > 0) {
    if (displayMinutes > 0) return `${displayHours}h ${displayMinutes}m`;
    return `${displayHours}h`;
  }
  
  return `${displayMinutes}m`;
};

// Helper function to get resolution time performance level
const getResolutionTimePerformance = (hours: number) => {
  if (hours === 0) return { level: 'No Data', color: 'from-[#92A2A5] to-[#757777]', textClass: 'text-[#5D6E73]', bgClass: 'bg-[#AEBFC3]/20', dotColor: 'bg-[#92A2A5]' };
  if (hours <= 24) return { level: 'Excellent', color: 'from-[#82A094] to-[#82A094]', textClass: 'text-[#4F6A64]', bgClass: 'bg-[#82A094]/20', dotColor: 'bg-[#82A094]/100' };
  if (hours <= 48) return { level: 'Good', color: 'from-[#CE9F6B] to-[#CE9F6B]', textClass: 'text-[#976E44]', bgClass: 'bg-[#CE9F6B]/20', dotColor: 'bg-[#CE9F6B]/100' };
  return { level: 'Needs Work', color: 'from-rose-400 to-[#E17F70]', textClass: 'text-[#9E3B47]', bgClass: 'bg-[#EEC1BF]/20', dotColor: 'bg-[#EEC1BF]/100' };
};

// Zone card gradient colors
const zoneGradients = [
  'from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D]',
  'from-[#82A094] via-[#82A094] to-[#6F8A9D]',
  'from-[#CE9F6B] via-rose-500 to-[#E17F70]',
  'from-[#6F8A9D] via-[#6F8A9D] to-[#E17F70]',
  'from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D]',
  'from-[#E17F70] via-pink-500 to-[#6F8A9D]',
];

export default function ZonePerformanceAnalytics({ 
  dashboardData, 
  isRefreshing, 
  onRefresh 
}: ZonePerformanceAnalyticsProps) {

  if (!dashboardData?.adminStats?.zoneWiseTickets?.length) {
    return null;
  }

  const zones = dashboardData.adminStats.zoneWiseTickets;
  const totalZoneTickets = zones.reduce((sum, zone) => sum + zone.totalTickets, 0);
  const totalZoneStaff = zones.reduce((sum, zone) => sum + zone.servicePersonCount, 0);
  const avgTicketsPerZone = zones.length > 0 ? Math.round(totalZoneTickets / zones.length) : 0;
  const staffedZones = zones.filter(z => z.servicePersonCount > 0).length;

  // Sort zones by resolution time (fastest first)
  const sortedByResolution = [...zones]
    .filter(z => z.servicePersonCount > 0 && getZoneResolutionTime(z) > 0)
    .sort((a, b) => getZoneResolutionTime(a) - getZoneResolutionTime(b));

  return (
      <Card className="relative overflow-hidden bg-white border border-[#96AEC2]/20 shadow-xl rounded-2xl sm:rounded-3xl">
        {/* Simplified Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#96AEC2]/5 rounded-full blur-3xl transform-gpu" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-[#CE9F6B]/5 rounded-full blur-3xl transform-gpu" />
        </div>
        
        <CardHeader className="relative z-10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold">
                <div className="relative">
                  <div className="p-3 bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-[#546A7A] rounded-2xl shadow-lg shadow-[#96AEC2]/30">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  {/* Pulse effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-2xl animate-ping opacity-20" />
                </div>
                <span className="bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
                  Zone Analytics
                </span>
              </CardTitle>
              <CardDescription className="text-sm sm:text-base mt-2 text-[#757777] ml-[52px]">
                Geographic performance and service coverage insights
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 ml-[52px] sm:ml-0">
              <Badge className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-0 px-3 py-1.5 text-xs font-semibold shadow-lg shadow-cyan-500/25">
                <Globe className="w-3 h-3 mr-1.5" />
                {zones.length} Zones
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRefresh} 
                disabled={isRefreshing}
                className="bg-white hover:bg-[#96AEC2]/10 border-[#96AEC2] text-[#546A7A] hover:border-[#96AEC2] shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="relative z-10 space-y-8">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Tickets in Zones */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-2xl p-4 shadow-lg shadow-[#6F8A9D]/20 group hover:shadow-xl hover:shadow-[#96AEC2]/30 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Ticket className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-medium text-white/80">Zone Tickets</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{totalZoneTickets}</p>
                <p className="text-xs text-white/60 mt-1">across all zones</p>
              </div>
            </div>
            
            {/* Avg per Zone */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-2xl p-4 shadow-lg shadow-violet-500/20 group hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-medium text-white/80">Avg/Zone</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{avgTicketsPerZone}</p>
                <p className="text-xs text-white/60 mt-1">tickets per zone</p>
              </div>
            </div>
            
            {/* Zone Staff */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-2xl p-4 shadow-lg shadow-[#82A094]/20 group hover:shadow-xl hover:shadow-[#82A094]/30 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-medium text-white/80">Zone Staff</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{totalZoneStaff}</p>
                <p className="text-xs text-white/60 mt-1">technicians</p>
              </div>
            </div>
            
            {/* Coverage */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#CE9F6B] to-[#9E3B47] rounded-2xl p-4 shadow-lg shadow-orange-500/20 group hover:shadow-xl hover:shadow-[#CE9F6B]/30 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-medium text-white/80">Coverage</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{staffedZones}/{zones.length}</p>
                <p className="text-xs text-white/60 mt-1">zones staffed</p>
              </div>
            </div>
          </div>

          {/* Zone Cards Grid */}
          <div>
            <h4 className="font-bold text-lg text-[#546A7A] mb-4 flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-lg">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              Zone Details
              <Badge className="bg-[#96AEC2]/20 text-[#546A7A] border-0 text-xs ml-2">
                {zones.length} zones
              </Badge>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((zone, idx) => {
                const resolutionTime = getZoneResolutionTime(zone);
                const performance = getResolutionTimePerformance(resolutionTime);
                const gradientColor = zoneGradients[idx % zoneGradients.length];
                
                return (
                  <div 
                    key={zone.id} 
                    className="relative bg-white rounded-2xl border border-[#92A2A5]/60 overflow-hidden hover:shadow-xl hover:border-transparent transition-all duration-500 group"
                  >
                    {/* Gradient top border */}
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientColor}`} />
                    
                    {/* Hover gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                    
                    <div className="relative p-5">
                      {/* Zone Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 bg-gradient-to-br ${gradientColor} rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                            <MapPin className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h5 className="font-bold text-[#546A7A] group-hover:text-[#546A7A] transition-colors">{zone.name}</h5>
                            <p className="text-xs text-[#979796]">Zone #{zone.id}</p>
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${zone.totalTickets > 0 ? 'bg-[#96AEC2]/20 text-[#546A7A]' : 'bg-[#AEBFC3]/20 text-[#757777]'}`}>
                          {zone.totalTickets > 0 ? (
                            <><Zap className="w-2.5 h-2.5 mr-1" />Active</>
                          ) : 'Idle'}
                        </Badge>
                      </div>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/10/50 rounded-xl p-3 text-center border border-[#AEBFC3]/30">
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Ticket className="w-3.5 h-3.5 text-[#6F8A9D]" />
                          </div>
                          <p className="text-xl font-bold text-[#546A7A]">{zone.totalTickets}</p>
                          <p className="text-[10px] font-medium text-[#757777]">Tickets</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#AEBFC3]/10 to-[#A2B9AF]/10/50 rounded-xl p-3 text-center border border-[#AEBFC3]/30">
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Clock className="w-3.5 h-3.5 text-[#82A094]" />
                          </div>
                          <p className="text-xl font-bold text-[#546A7A]">{formatResolutionTime(resolutionTime)}</p>
                          <p className="text-[10px] font-medium text-[#757777]">Avg Resolve</p>
                        </div>
                      </div>
                      
                      {/* Details - Zone Manager, Zone Users, Service Persons */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between py-1.5 px-3 bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/10 rounded-lg border border-[#6F8A9D]/30/50">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#6F8A9D]/100 rounded">
                              <Users className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-[#546A7A]">Zone Manager</span>
                          </div>
                          <span className="text-sm font-bold text-[#546A7A]">{zone.zoneManagerCount || 0}</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-1.5 px-3 bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 rounded-lg border border-[#96AEC2]/30/50">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#96AEC2]/100 rounded">
                              <Users className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-[#546A7A]">Zone Users</span>
                          </div>
                          <span className="text-sm font-bold text-[#546A7A]">{zone.zoneUserCount || 0}</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-1.5 px-3 bg-gradient-to-r from-[#A2B9AF]/10 to-[#82A094]/10 rounded-lg border border-[#A2B9AF]/30/50">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#82A094]/100 rounded">
                              <Users className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-[#4F6A64]">Service Persons</span>
                          </div>
                          <span className="text-sm font-bold text-[#4F6A64]">{zone.servicePersonCount || 0}</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-1.5 px-3 bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/10 rounded-lg border border-[#EEC1BF]/30/50">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#CE9F6B]/100 rounded">
                              <Building2 className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-[#976E44]">Customers</span>
                          </div>
                          <span className="text-sm font-bold text-[#976E44]">{zone.customerCount || 0}</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-1.5 px-3 bg-gradient-to-r from-[#96AEC2]/10 to-sky-50 rounded-lg border border-cyan-100/50">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#96AEC2]/100 rounded">
                              <Server className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-[#546A7A]">Assets</span>
                          </div>
                          <span className="text-sm font-bold text-[#546A7A]">{zone.assetCount || 0}</span>
                        </div>
                      </div>
                      
                      {/* Performance Bar */}
                      <div className="pt-3 border-t border-[#AEBFC3]/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[#757777]">Resolution Speed</span>
                          <Badge className={`text-[10px] font-semibold ${performance.bgClass} ${performance.textClass} border-0 px-2`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${performance.dotColor} mr-1.5`} />
                            {performance.level}
                          </Badge>
                        </div>
                        <div className="relative h-2 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                          <div 
                            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${performance.color} rounded-full transition-all duration-500`}
                            style={{ width: `${resolutionTime === 0 ? 0 : Math.max(15, 100 - Math.min(85, (resolutionTime / 72) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Performers Section */}
          {zones.length > 1 && sortedByResolution.length > 0 && (
            <div className="relative overflow-hidden bg-gradient-to-br from-[#82A094] via-[#82A094] to-cyan-600 rounded-2xl p-6 shadow-xl shadow-[#82A094]/20">
              {/* Background decorations */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
              
              <div className="relative">
                <h4 className="font-bold text-lg text-white mb-5 flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  Fastest Resolution Zones
                  <Badge className="bg-white/20 text-white border-0 text-xs backdrop-blur-sm">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Top Performers
                  </Badge>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {sortedByResolution.slice(0, 3).map((zone, i) => {
                    const resolutionHours = getZoneResolutionTime(zone);
                    const medals = ['🥇', '🥈', '🥉'];
                    const bgStyles = [
                      'bg-gradient-to-br from-yellow-400/30 to-amber-400/20 border-[#CE9F6B]/50',
                      'bg-gradient-to-br from-slate-300/30 to-[#92A2A5]/50/20 border-[#92A2A5]/50',
                      'bg-gradient-to-br from-orange-400/30 to-amber-400/20 border-[#CE9F6B]/50'
                    ];
                    
                    return (
                      <div 
                        key={zone.id} 
                        className={`${bgStyles[i]} border backdrop-blur-sm rounded-xl p-4 flex items-center gap-4 hover:scale-105 transition-transform duration-300`}
                      >
                        <div className="text-3xl drop-shadow-lg">{medals[i]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white truncate">{zone.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Timer className="w-3.5 h-3.5 text-white/70" />
                            <span className="text-sm font-semibold text-white/90">
                              {formatResolutionTime(resolutionHours)}
                            </span>
                          </div>
                        </div>
                        {i === 0 && <Star className="w-5 h-5 text-[#CE9F6B] animate-pulse" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Live Indicator */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#AEBFC3]/10 rounded-full border border-[#92A2A5]">
              <div className="w-2 h-2 bg-[#82A094]/100 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-[#757777]">Live Data</span>
              <Activity className="w-3 h-3 text-[#979796]" />
            </div>
          </div>
        </CardContent>
      </Card>
  );
}
