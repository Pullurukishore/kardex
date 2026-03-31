'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportData } from './types';
import { 
  BarChart, Bar, PieChart, Pie, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { 
  MapPin, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, 
  Users, Target, Award, Activity, Zap, BarChart3, Navigation, Wrench
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AdvancedZonePerformanceReportProps {
  reportData: ReportData;
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1'];

export function AdvancedZonePerformanceReport({ reportData }: AdvancedZonePerformanceReportProps) {
  const { zones, totalZones, overallStats } = reportData;

  if (!zones || zones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Advanced Zone Performance Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No zone data available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate metrics
  const totalTickets = overallStats?.totalTickets || zones.reduce((sum, z) => sum + (z.totalTickets || 0), 0);
  const totalResolved = overallStats?.totalResolved || zones.reduce((sum, z) => sum + (z.resolvedTickets || 0), 0);
  const totalOpen = zones.reduce((sum, z) => sum + (z.openTickets || 0), 0);
  const totalServicePersons = zones.reduce((sum, z) => sum + (z.servicePersons || 0), 0);
  const totalCustomers = zones.reduce((sum, z) => sum + (z.customerCount || 0), 0);
  const totalAssets = zones.reduce((sum, z) => sum + (z.assetCount || 0), 0);
  const avgResolutionRate = overallStats?.averageResolutionRate || 
    (zones.length > 0 ? zones.reduce((sum, z) => sum + (z.resolutionRate || 0), 0) / zones.length : 0);
  const avgTravelTime = overallStats?.averageTravelTime || 0;
  const avgOnsiteResolutionTime = overallStats?.averageOnsiteResolutionTime || 0;
  const totalOnsiteVisitsCount = overallStats?.totalOnsiteVisits || zones.reduce((sum, z) => sum + (z.totalOnsiteVisits || 0), 0);

  // Sort zones by different metrics
  const zonesByTickets = [...zones].sort((a, b) => (b.totalTickets || 0) - (a.totalTickets || 0));
  const zonesByResolution = [...zones].sort((a, b) => (b.resolutionRate || 0) - (a.resolutionRate || 0));
  const zonesByOpenTickets = [...zones].sort((a, b) => (b.openTickets || 0) - (a.openTickets || 0));

  // Top and bottom performers
  const topPerformer = zonesByResolution[0];
  const bottomPerformer = zonesByResolution[zones.length - 1];
  const busiestZone = zonesByTickets[0];
  const mostProblematicZone = zonesByOpenTickets[0];

  // Performance distribution
  const performanceRanges = [
    { range: '90-100%', min: 90, max: 100, color: '#10B981' },
    { range: '75-90%', min: 75, max: 90, color: '#3B82F6' },
    { range: '50-75%', min: 50, max: 75, color: '#F59E0B' },
    { range: '25-50%', min: 25, max: 50, color: '#EF4444' },
    { range: '0-25%', min: 0, max: 25, color: '#7C3AED' }
  ];

  const performanceDistribution = performanceRanges.map(range => ({
    name: range.range,
    value: zones.filter(z => (z.resolutionRate || 0) >= range.min && (z.resolutionRate || 0) < range.max).length,
    color: range.color
  })).filter(item => item.value > 0);

  // Workload distribution
  const workloadData = zones.map(zone => ({
    name: zone.zoneName?.length > 15 ? zone.zoneName.substring(0, 15) + '...' : zone.zoneName,
    fullName: zone.zoneName,
    tickets: zone.totalTickets || 0,
    resolved: zone.resolvedTickets || 0,
    open: zone.openTickets || 0,
    servicePersons: zone.servicePersons || 0
  })).sort((a, b) => b.tickets - a.tickets);

  // Get zones for workload chart (limit to actual count, max 10)
  const displayZones = workloadData.slice(0, Math.min(zones.length, 10));
  const zoneCountLabel = zones.length <= 10 ? `All ${zones.length} Zones` : `Top 10 of ${zones.length} Zones`;

  // Resolution rate comparison
  const resolutionComparison = zones.map(zone => ({
    name: zone.zoneName?.length > 12 ? zone.zoneName.substring(0, 12) + '...' : zone.zoneName,
    fullName: zone.zoneName,
    rate: zone.resolutionRate || 0,
    tickets: zone.totalTickets || 0
  })).sort((a, b) => b.rate - a.rate);

  // Resource utilization
  const resourceData = zones.map(zone => ({
    name: zone.zoneName?.length > 12 ? zone.zoneName.substring(0, 12) + '...' : zone.zoneName,
    fullName: zone.zoneName,
    servicePersons: zone.servicePersons || 0,
    customers: zone.customerCount || 0,
    assets: zone.assetCount || 0,
    tickets: zone.totalTickets || 0,
    ticketsPerPerson: zone.servicePersons > 0 ? Math.round((zone.totalTickets || 0) / zone.servicePersons) : 0
  }));

  // Performance radar data
  const radarData = zones.slice(0, 6).map(zone => ({
    zone: zone.zoneName?.length > 10 ? zone.zoneName.substring(0, 10) + '...' : zone.zoneName,
    fullName: zone.zoneName,
    resolutionRate: zone.resolutionRate || 0,
    efficiency: zone.averageResolutionTime > 0 ? Math.max(0, 100 - (zone.averageResolutionTime / 480 * 100)) : 50,
    workload: Math.min((zone.totalTickets || 0) / 10, 100),
    resources: Math.min((zone.servicePersons || 0) * 20, 100),
    coverage: Math.min((zone.customerCount || 0) * 10, 100)
  }));

  const renderPercentageLabel = (entry: any, total: number) => {
    const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0';
    return `${percent}%`;
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#96AEC2] text-sm font-medium">Total Zones</p>
                <p className="text-3xl font-bold mt-2">{totalZones || zones.length}</p>
                <p className="text-[#96AEC2] text-xs mt-1">Service zones tracked</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><MapPin className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#6F8A9D] text-sm font-medium">Total Tickets</p>
                <p className="text-3xl font-bold mt-2">{totalTickets}</p>
                <p className="text-[#6F8A9D] text-xs mt-1">{totalResolved} resolved</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Activity className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#A2B9AF] text-sm font-medium">Avg Resolution Rate</p>
                <p className="text-3xl font-bold mt-2">{avgResolutionRate.toFixed(1)}%</p>
                <p className="text-[#A2B9AF] text-xs mt-1">Across all zones</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Target className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#EEC1BF] text-sm font-medium">Service Team</p>
                <p className="text-3xl font-bold mt-2">{totalServicePersons}</p>
                <p className="text-[#EEC1BF] text-xs mt-1">Service persons</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Users className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Metrics Summary - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-[#96AEC2] to-[#6F8A9D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Avg Travel Time</p>
                <p className="text-3xl font-bold mt-2">
                  {avgTravelTime > 0 ? `${Math.floor(avgTravelTime / 60)}h ${avgTravelTime % 60}m` : '0h 0m'}
                </p>
                <p className="text-white/70 text-xs mt-1">Across all zones</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Navigation className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#A2B9AF] to-[#82A094] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Avg Onsite Resolution</p>
                <p className="text-3xl font-bold mt-2">
                  {avgOnsiteResolutionTime > 0 ? `${Math.floor(avgOnsiteResolutionTime / 60)}h ${avgOnsiteResolutionTime % 60}m` : '0h 0m'}
                </p>
                <p className="text-white/70 text-xs mt-1">Work time at customer site</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Wrench className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#92A2A5] to-[#5D6E73] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Total Onsite Visits</p>
                <p className="text-3xl font-bold mt-2">{totalOnsiteVisitsCount}</p>
                <p className="text-white/70 text-xs mt-1">
                  {totalTickets > 0 ? `${((totalOnsiteVisitsCount / totalTickets) * 100).toFixed(0)}% of total tickets` : 'No tickets'}
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><MapPin className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#4F6A64]" />
            Zone Performance Overview
          </CardTitle>
          <CardDescription>
            {zones.length <= 5 
              ? `Resolution rate and ticket volume for all ${zones.length} zones`
              : 'Zones grouped by resolution rate ranges'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {zones.length <= 5 ? (
            // For 5 or fewer zones, show enhanced list view with all details
            <div className="space-y-4">
              {zones.map((zone: any, index: number) => {
                const rate = zone.resolutionRate || 0;
                let bgClass = 'bg-[#E17F70]/10';
                let borderClass = 'border-[#9E3B47]';
                let textClass = 'text-[#75242D]';
                
                if (rate >= 90) {
                  bgClass = 'bg-[#A2B9AF]/10';
                  borderClass = 'border-[#82A094]';
                  textClass = 'text-[#4F6A64]';
                } else if (rate >= 75) {
                  bgClass = 'bg-[#96AEC2]/10';
                  borderClass = 'border-[#6F8A9D]';
                  textClass = 'text-[#546A7A]';
                } else if (rate >= 50) {
                  bgClass = 'bg-[#CE9F6B]/10';
                  borderClass = 'border-[#CE9F6B]';
                  textClass = 'text-[#976E44]';
                }
                
                return (
                  <div key={zone.zoneId} className={`p-4 rounded-lg border-l-4 ${bgClass} ${borderClass}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-[#546A7A] text-lg">{zone.zoneName}</p>
                        <p className="text-sm text-[#5D6E73] mt-1">
                          {zone.resolvedTickets} of {zone.totalTickets} tickets resolved
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-3xl font-bold ${textClass}`}>{rate.toFixed(1)}%</p>
                        <p className="text-xs text-[#5D6E73]">Resolution Rate</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-4 pt-3 border-t border-[#92A2A5]">
                      <div className="text-center">
                        <p className="text-xl font-semibold text-[#546A7A]">{zone.totalTickets}</p>
                        <p className="text-xs text-[#5D6E73]">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-semibold text-[#4F6A64]">{zone.resolvedTickets}</p>
                        <p className="text-xs text-[#5D6E73]">Resolved</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-semibold text-[#546A7A]">
                          {(zone.averageTravelTime || 0) > 0 
                            ? `${Math.floor((zone.averageTravelTime || 0) / 60)}h ${(zone.averageTravelTime || 0) % 60}m` 
                            : 'N/A'}
                        </p>
                        <p className="text-xs text-[#5D6E73]">Avg Travel</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-semibold text-[#4F6A64]">
                          {(zone.averageOnsiteResolutionTime || 0) > 0 
                            ? `${Math.floor((zone.averageOnsiteResolutionTime || 0) / 60)}h ${(zone.averageOnsiteResolutionTime || 0) % 60}m` 
                            : 'N/A'}
                        </p>
                        <p className="text-xs text-[#5D6E73]">Avg Onsite</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-semibold text-[#546A7A]">{zone.servicePersons}</p>
                        <p className="text-xs text-[#5D6E73]">Team</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // For more than 5 zones, show charts in a grid
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={performanceDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => renderPercentageLabel(entry, zones.length)}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {performanceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} zones`, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {performanceDistribution.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-2 bg-[#AEBFC3]/10 rounded">
                      <span className="text-sm text-[#5D6E73]">{item.name}</span>
                      <span className="font-semibold text-[#546A7A]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayZones} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded-lg shadow-lg">
                              <p className="font-semibold">{data.fullName}</p>
                              <p className="text-sm text-[#546A7A]">Total: {data.tickets}</p>
                              <p className="text-sm text-[#4F6A64]">Resolved: {data.resolved}</p>
                              <p className="text-sm text-[#9E3B47]">Open: {data.open}</p>
                              <p className="text-sm text-[#5D6E73]">Team: {data.servicePersons} persons</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="tickets" fill="#3B82F6" radius={[0, 8, 8, 0]}>
                      {displayZones.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Rate Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[#4F6A64]" />
            Zone Resolution Rate Comparison
          </CardTitle>
          <CardDescription>Resolution performance across all zones</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={resolutionComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis domain={[0, 100]} label={{ value: 'Resolution Rate (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg">
                        <p className="font-semibold">{data.fullName}</p>
                        <p className="text-sm text-[#4F6A64]">Resolution Rate: {data.rate.toFixed(1)}%</p>
                        <p className="text-sm text-[#5D6E73]">Total Tickets: {data.tickets}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="rate" fill="#10B981" radius={[8, 8, 0, 0]}>
                {resolutionComparison.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.rate >= 90 ? '#10B981' : entry.rate >= 75 ? '#3B82F6' : entry.rate >= 50 ? '#F59E0B' : '#EF4444'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resource Utilization and Performance Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#546A7A]" />
              Resource Utilization
            </CardTitle>
            <CardDescription>Service coverage and team distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary metrics */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-[#96AEC2]/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-[#546A7A]">{totalServicePersons}</p>
                  <p className="text-sm text-[#546A7A]">Service Persons</p>
                </div>
                <div className="p-4 bg-[#A2B9AF]/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-[#4F6A64]">{totalCustomers}</p>
                  <p className="text-sm text-[#4F6A64]">Customers</p>
                </div>
                <div className="p-4 bg-[#6F8A9D]/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-[#546A7A]">{totalAssets}</p>
                  <p className="text-sm text-[#546A7A]">Assets</p>
                </div>
              </div>

              {/* Zone resource breakdown */}
              <div className="max-h-96 overflow-y-auto space-y-2">
                {resourceData.sort((a, b) => b.servicePersons - a.servicePersons).map((zone, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-[#6F8A9D]/10 to-transparent rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-medium text-[#546A7A]">{zone.fullName}</span>
                      <span className="text-xs text-[#AEBFC3]0">
                        {zone.servicePersons} persons • {zone.customers} customers • {zone.assets} assets
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-[#CE9F6B]/10">
                        {zone.ticketsPerPerson} tickets/person
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#546A7A]" />
              Multi-Dimensional Performance
            </CardTitle>
            <CardDescription>Comprehensive zone performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="zone" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                {radarData.length > 0 && radarData[0] && (
                  <Radar
                    name={radarData[0].fullName}
                    dataKey="resolutionRate"
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    fillOpacity={0.6}
                  />
                )}
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-[#6F8A9D]/10 rounded">
                <span className="font-medium">Resolution Rate:</span> Ticket closure %
              </div>
              <div className="p-2 bg-[#96AEC2]/10 rounded">
                <span className="font-medium">Efficiency:</span> Speed of resolution
              </div>
              <div className="p-2 bg-[#CE9F6B]/10 rounded">
                <span className="font-medium">Workload:</span> Ticket volume
              </div>
              <div className="p-2 bg-[#A2B9AF]/10 rounded">
                <span className="font-medium">Resources:</span> Team size
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Insights */}
      <Card className="border-t-4 border-t-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[#546A7A]" />
            Key Insights & Performance Highlights
          </CardTitle>
          <CardDescription>Automated insights from zone performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-[#A2B9AF]/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-[#4F6A64] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-[#4F6A64]">Top Performer</p>
                <p className="text-sm text-[#4F6A64] mt-1">
                  {topPerformer.zoneName} - {topPerformer.resolutionRate?.toFixed(1)}% resolution rate
                </p>
                <p className="text-xs text-[#4F6A64] mt-1">
                  {topPerformer.resolvedTickets} of {topPerformer.totalTickets} tickets resolved
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-[#96AEC2]/10 rounded-lg">
              <Activity className="h-5 w-5 text-[#546A7A] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-[#546A7A]">Busiest Zone</p>
                <p className="text-sm text-[#546A7A] mt-1">
                  {busiestZone.zoneName} - {busiestZone.totalTickets} tickets handled
                </p>
                <p className="text-xs text-[#546A7A] mt-1">
                  {busiestZone.servicePersons} service persons • {busiestZone.customerCount} customers
                </p>
              </div>
            </div>

            {bottomPerformer.resolutionRate < avgResolutionRate && (
              <div className="flex items-start gap-3 p-4 bg-[#CE9F6B]/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-[#976E44] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-[#976E44]">Needs Attention</p>
                  <p className="text-sm text-[#976E44] mt-1">
                    {bottomPerformer.zoneName} - {bottomPerformer.resolutionRate?.toFixed(1)}% resolution rate
                  </p>
                  <p className="text-xs text-[#976E44] mt-1">
                    {bottomPerformer.openTickets} open tickets need resolution
                  </p>
                </div>
              </div>
            )}

            {mostProblematicZone.openTickets > 0 && (
              <div className="flex items-start gap-3 p-4 bg-[#E17F70]/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-[#9E3B47] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-[#75242D]">Most Open Tickets</p>
                  <p className="text-sm text-[#75242D] mt-1">
                    {mostProblematicZone.zoneName} - {mostProblematicZone.openTickets} open tickets
                  </p>
                  <p className="text-xs text-[#9E3B47] mt-1">
                    Requires immediate team focus and resource allocation
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Performance recommendations */}
          <div className="mt-6 p-4 bg-gradient-to-r from-[#6F8A9D]/10 to-[#96AEC2]/10 rounded-lg">
            <h4 className="font-semibold text-[#546A7A] mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#546A7A]" />
              Recommendations
            </h4>
            <ul className="space-y-2 text-sm text-[#5D6E73]">
              <li className="flex items-start gap-2">
                <span className="text-[#546A7A] mt-1">•</span>
                <span>Focus on improving resolution rates in zones below {avgResolutionRate.toFixed(0)}% average</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A7A] mt-1">•</span>
                <span>Consider reallocating resources from lower-workload zones to busier zones</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4F6A64] mt-1">•</span>
                <span>Share best practices from {topPerformer.zoneName} with other zones</span>
              </li>
              {totalOpen > totalTickets * 0.3 && (
                <li className="flex items-start gap-2">
                  <span className="text-[#976E44] mt-1">•</span>
                  <span>High open ticket ratio ({((totalOpen / totalTickets) * 100).toFixed(0)}%) - prioritize ticket closure</span>
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
