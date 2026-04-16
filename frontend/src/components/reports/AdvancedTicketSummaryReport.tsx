'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportData } from './types';
import { 
  BarChart, Bar, PieChart, Pie, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, 
  Users, Target, Award, Activity, Zap, Calendar, BarChart3,
  MapPin, Wrench, Navigation
} from 'lucide-react';

interface AdvancedTicketSummaryReportProps {
  reportData: ReportData;
}

// Color schemes for charts - All 28 ticket statuses from Prisma schema
const STATUS_COLORS: Record<string, string> = {
  // Initial/Open States
  'OPEN': '#3B82F6',                    // Blue
  'ASSIGNED': '#8B5CF6',                 // Purple
  
  // In Progress States
  'IN_PROCESS': '#F59E0B',               // Amber
  'IN_PROGRESS': '#F97316',              // Orange
  
  // Onsite Visit States
  'ONSITE_VISIT': '#06B6D4',             // Cyan
  'ONSITE_VISIT_PLANNED': '#0891B2',     // Cyan-600
  'ONSITE_VISIT_STARTED': '#0E7490',     // Cyan-700
  'ONSITE_VISIT_REACHED': '#155E75',     // Cyan-800
  'ONSITE_VISIT_IN_PROGRESS': '#164E63', // Cyan-900
  'ONSITE_VISIT_RESOLVED': '#0D9488',    // Teal-600
  'ONSITE_VISIT_PENDING': '#14B8A6',     // Teal-500
  'ONSITE_VISIT_COMPLETED': '#2DD4BF',   // Teal-400
  
  // Waiting/Pending States
  'WAITING_CUSTOMER': '#FBBF24',         // Yellow-400
  'ON_HOLD': '#FB923C',                  // Orange-400
  
  // Spare Parts States
  'SPARE_PARTS_NEEDED': '#A855F7',       // Purple-500
  'SPARE_PARTS_BOOKED': '#9333EA',       // Purple-600
  'SPARE_PARTS_DELIVERED': '#7C3AED',    // Purple-700
  
  // Purchase Order States
  'PO_NEEDED': '#EC4899',                // Pink-500
  'PO_RECEIVED': '#DB2777',              // Pink-600
  'PO_REACHED': '#BE185D',               // Pink-700
  
  // Resolution States
  'RESOLVED': '#10B981',                 // Emerald-500
  'CLOSED_PENDING': '#84CC16',           // Lime-500
  'CLOSED': '#6B7280',                   // Gray-500
  
  // Issue/Problem States
  'ESCALATED': '#EF4444',                // Red-500
  'CANCELLED': '#9CA3AF',                // Gray-400
  'REOPENED': '#F87171'                  // Red-400
};

const PRIORITY_COLORS = {
  'LOW': '#10B981',
  'MEDIUM': '#F59E0B',
  'HIGH': '#EF4444',
  'CRITICAL': '#7C3AED'
};

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1'];

export function AdvancedTicketSummaryReport({ reportData }: AdvancedTicketSummaryReportProps) {
  const { 
    statusDistribution, 
    callTypeDistribution, 
    zoneDistribution,
    customerDistribution,
    dailyTrends,
    summary,
    insights
  } = reportData;

  if (!summary || !statusDistribution) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Advanced Ticket Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No ticket data available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  // Helper function to format minutes to hours and minutes
  const formatMinutesToHoursAndMinutes = (totalMinutes: number): string => {
    if (!totalMinutes || totalMinutes <= 0) return '0h 0m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`;
  };

  // Prepare data for pie charts
  const statusChartData = Object.entries(statusDistribution || {}).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
    color: STATUS_COLORS[name as keyof typeof STATUS_COLORS] || '#6B7280'
  }));

  const callTypeChartData = Object.entries(callTypeDistribution || {}).map(([name, value], idx) => ({
    name: name.replace('_', ' '),
    value: value as number,
    color: CHART_COLORS[idx % CHART_COLORS.length]
  }));

  // Prepare zone data for bar chart
  const zoneChartData = (zoneDistribution || []).slice(0, 10).map((zone: any) => ({
    name: zone.zoneName,
    tickets: zone.count
  }));

  // Prepare customer data for bar chart
  const customerChartData = (customerDistribution || []).slice(0, 10).map((customer: any) => ({
    name: customer.customerName.length > 20 ? customer.customerName.substring(0, 20) + '...' : customer.customerName,
    tickets: customer.count
  }));

  // Prepare daily trends data
  const trendsChartData = (dailyTrends || []).map((day: any) => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    created: day.created || 0,
    resolved: day.resolved || 0,
    escalated: day.escalated || 0
  }));

  // Calculate performance metrics
  const totalTickets = summary.totalTickets || 0;
  const resolvedTickets = summary.resolvedTickets || 0;
  const resolutionRate = totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100).toFixed(1) : '0';
  const avgResolutionTime = formatMinutesToHoursAndMinutes(summary.averageResolutionTime || 0);
  const avgFirstResponse = formatMinutesToHoursAndMinutes(summary.averageFirstResponseTime || 0);
  const avgTravelTime = formatMinutesToHoursAndMinutes(summary.avgOnsiteTravelTime || 0);
  const avgOnsiteResolution = formatMinutesToHoursAndMinutes(summary.averageOnsiteResolutionTime || 0);
  const totalOnsiteVisits = summary.totalOnsiteVisits || 0;

  // Prepare radar chart data for performance overview
  const performanceData = [
    {
      metric: 'Resolution Rate',
      value: parseFloat(resolutionRate),
      fullMark: 100
    },
    {
      metric: 'Response Time',
      value: summary.averageFirstResponseTime ? Math.min((1440 / (summary.averageFirstResponseTime + 1)) * 100, 100) : 0,
      fullMark: 100
    },
    {
      metric: 'Travel Efficiency',
      value: summary.avgOnsiteTravelTime ? Math.min(Math.max(100 - (summary.avgOnsiteTravelTime / 480 * 100), 0), 100) : 50,
      fullMark: 100
    },
    {
      metric: 'Onsite Efficiency',
      value: summary.averageOnsiteResolutionTime ? Math.min(Math.max(100 - (summary.averageOnsiteResolutionTime / 480 * 100), 0), 100) : 50,
      fullMark: 100
    },
    {
      metric: 'Critical Issues',
      value: totalTickets > 0 ? Math.max(100 - ((summary.criticalTickets || 0) / totalTickets) * 100, 0) : 100,
      fullMark: 100
    },
    {
      metric: 'Onsite Visit Rate',
      value: totalTickets > 0 ? Math.min((totalOnsiteVisits / totalTickets) * 100, 100) : 0,
      fullMark: 100
    }
  ];

  // Calculate totals for percentage calculations
  const totalStatusCount = statusChartData.reduce((sum, item) => sum + item.value, 0);
  const totalCallTypeCount = callTypeChartData.reduce((sum, item) => sum + item.value, 0);

  // Custom label for status pie chart
  const renderStatusLabel = (entry: any) => {
    const percent = totalStatusCount > 0 ? ((entry.value / totalStatusCount) * 100).toFixed(0) : '0';
    return `${percent}%`;
  };

  // Custom label for call type pie chart
  const renderCallTypeLabel = (entry: any) => {
    const percent = totalCallTypeCount > 0 ? ((entry.value / totalCallTypeCount) * 100).toFixed(0) : '0';
    return `${percent}%`;
  };

  // Prepare time breakdown data for chart
  const timeBreakdownData = [
    {
      name: 'Avg Resolution',
      minutes: summary.averageResolutionTime || 0,
      formatted: avgResolutionTime,
      color: '#CE9F6B'
    },
    {
      name: 'Avg Travel',
      minutes: summary.avgOnsiteTravelTime || 0,
      formatted: avgTravelTime,
      color: '#6F8A9D'
    },
    {
      name: 'Avg Onsite Work',
      minutes: summary.averageOnsiteResolutionTime || 0,
      formatted: avgOnsiteResolution,
      color: '#82A094'
    },
    {
      name: 'First Response',
      minutes: summary.averageFirstResponseTime || 0,
      formatted: avgFirstResponse,
      color: '#546A7A'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#96AEC2] text-sm font-medium">Total Tickets</p>
                <p className="text-3xl font-bold mt-2">{totalTickets}</p>
                <p className="text-[#96AEC2] text-xs mt-1">In selected period</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <BarChart3 className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#A2B9AF] text-sm font-medium">Resolved</p>
                <p className="text-3xl font-bold mt-2">{resolvedTickets}</p>
                <p className="text-[#A2B9AF] text-xs mt-1">{resolutionRate}% success rate</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <CheckCircle className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#EEC1BF] text-sm font-medium">Avg Resolution</p>
                <p className="text-3xl font-bold mt-2">{avgResolutionTime}</p>
                <p className="text-[#EEC1BF] text-xs mt-1">Business hours</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <Clock className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#96AEC2] text-sm font-medium">First Response</p>
                <p className="text-3xl font-bold mt-2">{avgFirstResponse}</p>
                <p className="text-[#96AEC2] text-xs mt-1">Average time</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <Zap className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executive Summary Cards - Row 2: Travel & Onsite Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-[#96AEC2] to-[#6F8A9D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Avg Travel Time</p>
                <p className="text-3xl font-bold mt-2">{avgTravelTime}</p>
                <p className="text-white/70 text-xs mt-1">Per onsite visit (real-time)</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <Navigation className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#A2B9AF] to-[#82A094] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Avg Onsite Resolution</p>
                <p className="text-3xl font-bold mt-2">{avgOnsiteResolution}</p>
                <p className="text-white/70 text-xs mt-1">Work time at customer site</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <Wrench className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#92A2A5] to-[#5D6E73] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Total Onsite Visits</p>
                <p className="text-3xl font-bold mt-2">{totalOnsiteVisits}</p>
                <p className="text-white/70 text-xs mt-1">
                  {totalTickets > 0 ? `${((totalOnsiteVisits / totalTickets) * 100).toFixed(0)}% of tickets` : 'No tickets'}
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <MapPin className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Analytics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#546A7A]" />
            Time Analytics Breakdown
          </CardTitle>
          <CardDescription>Comparison of average time metrics across the service lifecycle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time Breakdown Bar Chart */}
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeBreakdownData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'Minutes', position: 'insideBottom', offset: -5 }} />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-semibold text-[#546A7A]">{data.name}</p>
                            <p className="text-sm text-[#5D6E73]">{data.formatted}</p>
                            <p className="text-xs text-[#92A2A5]">{data.minutes} minutes</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="minutes" radius={[0, 8, 8, 0]}>
                    {timeBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Time Metrics Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#CE9F6B]/10 rounded-lg border-l-4 border-[#CE9F6B]">
                <p className="text-xs font-medium text-[#976E44] uppercase tracking-wide">Total Resolution</p>
                <p className="text-2xl font-bold text-[#976E44] mt-2">{avgResolutionTime}</p>
                <p className="text-xs text-[#976E44]/70 mt-1">End-to-end (business hours)</p>
              </div>
              <div className="p-4 bg-[#6F8A9D]/10 rounded-lg border-l-4 border-[#6F8A9D]">
                <p className="text-xs font-medium text-[#546A7A] uppercase tracking-wide">Travel Time</p>
                <p className="text-2xl font-bold text-[#546A7A] mt-2">{avgTravelTime}</p>
                <p className="text-xs text-[#546A7A]/70 mt-1">Start → Reached (real-time)</p>
              </div>
              <div className="p-4 bg-[#A2B9AF]/10 rounded-lg border-l-4 border-[#82A094]">
                <p className="text-xs font-medium text-[#4F6A64] uppercase tracking-wide">Onsite Work</p>
                <p className="text-2xl font-bold text-[#4F6A64] mt-2">{avgOnsiteResolution}</p>
                <p className="text-xs text-[#4F6A64]/70 mt-1">In-progress → Resolved</p>
              </div>
              <div className="p-4 bg-[#546A7A]/10 rounded-lg border-l-4 border-[#546A7A]">
                <p className="text-xs font-medium text-[#546A7A] uppercase tracking-wide">First Response</p>
                <p className="text-2xl font-bold text-[#546A7A] mt-2">{avgFirstResponse}</p>
                <p className="text-xs text-[#546A7A]/70 mt-1">Open → First action</p>
              </div>
            </div>
          </div>

          {/* Service Lifecycle Info */}
          <div className="mt-6 p-4 bg-gradient-to-r from-[#96AEC2]/10 to-[#A2B9AF]/10 rounded-lg">
            <h4 className="font-semibold text-[#546A7A] mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Service Lifecycle Breakdown
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1.5 bg-[#546A7A]/10 text-[#546A7A] rounded-full font-medium">🎫 Ticket Created</span>
              <span className="text-[#92A2A5]">→</span>
              <span className="px-3 py-1.5 bg-[#546A7A]/10 text-[#546A7A] rounded-full font-medium">⚡ First Response ({avgFirstResponse})</span>
              <span className="text-[#92A2A5]">→</span>
              <span className="px-3 py-1.5 bg-[#6F8A9D]/10 text-[#546A7A] rounded-full font-medium">🚗 Travel ({avgTravelTime})</span>
              <span className="text-[#92A2A5]">→</span>
              <span className="px-3 py-1.5 bg-[#A2B9AF]/10 text-[#4F6A64] rounded-full font-medium">🔧 Onsite Work ({avgOnsiteResolution})</span>
              <span className="text-[#92A2A5]">→</span>
              <span className="px-3 py-1.5 bg-[#82A094]/10 text-[#4F6A64] rounded-full font-medium">✅ Resolved</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row 1: Status and Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#546A7A]" />
              Status Distribution
            </CardTitle>
            <CardDescription>Breakdown of tickets by current status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderStatusLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} tickets`, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Status breakdown list */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(statusDistribution || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-2 bg-[#AEBFC3]/10 rounded">
                  <span className="text-sm text-[#5D6E73] capitalize">{status.replace('_', ' ')}</span>
                  <span className="font-semibold text-[#546A7A]">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Call Type Analytics Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#546A7A]" />
              Call Type Analytics
            </CardTitle>
            <CardDescription>Breakdown of tickets by call type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={callTypeChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCallTypeLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  innerRadius={60}
                >
                  {callTypeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} tickets`, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            {/* Call type breakdown list */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(callTypeDistribution || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 bg-[#AEBFC3]/10 rounded">
                  <span className="text-sm text-[#5D6E73] capitalize">{type.replace('_', ' ')}</span>
                  <span className="font-semibold text-[#546A7A]">{count as React.ReactNode}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends for Last Year */}
      {dailyTrends && dailyTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#546A7A]" />
              Monthly Ticket Analysis - Last 12 Months
            </CardTitle>
            <CardDescription>Year-over-year ticket volume and resolution performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={(() => {
                  // Group daily trends by month
                  const monthlyData: Record<string, any> = {};
                  
                  dailyTrends.forEach((day: any) => {
                    const date = new Date(day.date);
                    const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    
                    if (!monthlyData[monthKey]) {
                      monthlyData[monthKey] = {
                        month: monthKey,
                        created: 0,
                        resolved: 0,
                        escalated: 0,
                        pending: 0
                      };
                    }
                    
                    monthlyData[monthKey].created += day.created || 0;
                    monthlyData[monthKey].resolved += day.resolved || 0;
                    monthlyData[monthKey].escalated += day.escalated || 0;
                    monthlyData[monthKey].pending = monthlyData[monthKey].created - monthlyData[monthKey].resolved;
                  });
                  
                  return Object.values(monthlyData).slice(-12); // Last 12 months
                })()}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="#3B82F6" name="Created" />
                <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
                <Bar dataKey="pending" fill="#F59E0B" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
            
            {/* Monthly summary stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-[#96AEC2]/10 rounded-lg">
                <p className="text-sm text-[#546A7A] font-medium">Avg Monthly Created</p>
                <p className="text-2xl font-bold text-[#546A7A]">
                  {dailyTrends.length > 0 ? Math.round(dailyTrends.reduce((sum: number, d: any) => sum + (d.created || 0), 0) / Math.max(1, Math.ceil(dailyTrends.length / 30))) : 0}
                </p>
              </div>
              <div className="text-center p-3 bg-[#A2B9AF]/10 rounded-lg">
                <p className="text-sm text-[#4F6A64] font-medium">Avg Monthly Resolved</p>
                <p className="text-2xl font-bold text-[#4F6A64]">
                  {dailyTrends.length > 0 ? Math.round(dailyTrends.reduce((sum: number, d: any) => sum + (d.resolved || 0), 0) / Math.max(1, Math.ceil(dailyTrends.length / 30))) : 0}
                </p>
              </div>
              <div className="text-center p-3 bg-[#6F8A9D]/10 rounded-lg">
                <p className="text-sm text-[#546A7A] font-medium">Peak Month</p>
                <p className="text-lg font-bold text-[#546A7A]">
                  {(() => {
                    const monthlyTotals: Record<string, number> = {};
                    dailyTrends.forEach((d: any) => {
                      const month = new Date(d.date).toLocaleDateString('en-US', { month: 'short' });
                      monthlyTotals[month] = (monthlyTotals[month] || 0) + (d.created || 0);
                    });
                    const maxMonth = Object.entries(monthlyTotals).sort((a, b) => b[1] - a[1])[0];
                    return maxMonth ? maxMonth[0] : 'N/A';
                  })()}
                </p>
              </div>
              <div className="text-center p-3 bg-[#CE9F6B]/10 rounded-lg">
                <p className="text-sm text-[#976E44] font-medium">Resolution Rate</p>
                <p className="text-2xl font-bold text-[#976E44]">{resolutionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Trends Line Chart */}
      {dailyTrends && dailyTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#4F6A64]" />
              Daily Ticket Trends
            </CardTitle>
            <CardDescription>Day-by-day ticket creation and resolution patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={trendsChartData}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEscalated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="created" 
                  stroke="#3B82F6" 
                  fillOpacity={1} 
                  fill="url(#colorCreated)"
                  name="Created"
                />
                <Area 
                  type="monotone" 
                  dataKey="resolved" 
                  stroke="#10B981" 
                  fillOpacity={1} 
                  fill="url(#colorResolved)"
                  name="Resolved"
                />
                {trendsChartData.some((d: any) => d.escalated > 0) && (
                  <Area 
                    type="monotone" 
                    dataKey="escalated" 
                    stroke="#EF4444" 
                    fillOpacity={1} 
                    fill="url(#colorEscalated)"
                    name="Escalated"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Zone and Customer Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* All Zones Analytics Summary */}
        {zoneDistribution && zoneDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#546A7A]" />
                All Zones Performance Summary
              </CardTitle>
              <CardDescription>Aggregated analytics across all service zones</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Zone summary metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-[#96AEC2]/10 rounded-lg">
                  <p className="text-sm text-[#546A7A] font-medium">Total Zones</p>
                  <p className="text-3xl font-bold text-[#546A7A]">{zoneDistribution.length}</p>
                </div>
                <div className="p-4 bg-[#A2B9AF]/10 rounded-lg">
                  <p className="text-sm text-[#4F6A64] font-medium">Total Tickets</p>
                  <p className="text-3xl font-bold text-[#4F6A64]">
                    {zoneDistribution.reduce((sum, z: any) => sum + z.count, 0)}
                  </p>
                </div>
                <div className="p-4 bg-[#6F8A9D]/10 rounded-lg">
                  <p className="text-sm text-[#546A7A] font-medium">Avg per Zone</p>
                  <p className="text-3xl font-bold text-[#546A7A]">
                    {Math.round(zoneDistribution.reduce((sum, z: any) => sum + z.count, 0) / zoneDistribution.length)}
                  </p>
                </div>
                <div className="p-4 bg-[#CE9F6B]/10 rounded-lg">
                  <p className="text-sm text-[#976E44] font-medium">Most Active</p>
                  <p className="text-xl font-bold text-[#976E44] truncate">
                    {zoneDistribution.sort((a: any, b: any) => b.count - a.count)[0]?.zoneName.substring(0, 12) || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Zone distribution pie chart */}
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={zoneDistribution.slice(0, 8).map((zone: any) => ({
                      name: zone.zoneName,
                      value: zone.count
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => {
                      const total = zoneDistribution.reduce((sum, z: any) => sum + z.count, 0);
                      const percent = ((entry.value / total) * 100).toFixed(0);
                      return `${percent}%`;
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {zoneDistribution.slice(0, 8).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} tickets`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>

              {/* Detailed Zone Breakdown List */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-[#5D6E73] mb-3">All Zones Breakdown</h4>
                <div className="space-y-2">
                  {zoneDistribution.map((zone: any, index: number) => {
                    const totalZoneTickets = zoneDistribution.reduce((sum, z: any) => sum + z.count, 0);
                    const percentage = totalZoneTickets > 0 ? ((zone.count / totalZoneTickets) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={zone.zoneId} 
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-[#96AEC2]/10 to-transparent rounded-lg hover:from-[#96AEC2]/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="font-medium text-[#546A7A]">{zone.zoneName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-[#AEBFC3]0">{percentage}%</span>
                          <span className="font-bold text-[#546A7A] min-w-[60px] text-right">
                            {zone.count} tickets
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Debug info */}
                {zoneDistribution.length < 4 && (
                  <div className="mt-4 p-3 bg-[#EEC1BF]/10 border border-[#CE9F6B] rounded-lg">
                    <p className="text-sm text-[#976E44]">
                      ⚠️ Note: Showing {zoneDistribution.length} zone(s). If you have 4 zones but only see {zoneDistribution.length}, 
                      the other zones may not have any tickets in the selected date range.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Customers Analytics Summary */}
        {customerDistribution && customerDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[#4F6A64]" />
                All Customers Performance Summary
              </CardTitle>
              <CardDescription>Aggregated ticket analytics across all customers</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Customer summary metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-[#A2B9AF]/10 rounded-lg">
                  <p className="text-sm text-[#4F6A64] font-medium">Total Customers</p>
                  <p className="text-3xl font-bold text-[#4F6A64]">{customerDistribution.length}</p>
                </div>
                <div className="p-4 bg-[#96AEC2]/10 rounded-lg">
                  <p className="text-sm text-[#546A7A] font-medium">Total Tickets</p>
                  <p className="text-3xl font-bold text-[#546A7A]">
                    {customerDistribution.reduce((sum, c: any) => sum + c.count, 0)}
                  </p>
                </div>
                <div className="p-4 bg-[#6F8A9D]/10 rounded-lg">
                  <p className="text-sm text-[#546A7A] font-medium">Avg per Customer</p>
                  <p className="text-3xl font-bold text-[#546A7A]">
                    {Math.round(customerDistribution.reduce((sum, c: any) => sum + c.count, 0) / customerDistribution.length)}
                  </p>
                </div>
                <div className="p-4 bg-[#CE9F6B]/10 rounded-lg">
                  <p className="text-sm text-[#976E44] font-medium">Most Active</p>
                  <p className="text-xl font-bold text-[#976E44] truncate">
                    {customerDistribution.sort((a: any, b: any) => b.count - a.count)[0]?.customerName.substring(0, 15) || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Top 10 customers bar chart */}
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerDistribution.slice(0, 10).map((c: any) => ({
                  name: c.customerName.length > 20 ? c.customerName.substring(0, 20) + '...' : c.customerName,
                  tickets: c.count
                }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#10B981" radius={[0, 8, 8, 0]}>
                    {customerDistribution.slice(0, 10).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Detailed Customer Breakdown List */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-[#5D6E73] mb-3">All Customers Breakdown</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {customerDistribution.map((customer: any, index: number) => {
                    const totalCustomerTickets = customerDistribution.reduce((sum, c: any) => sum + c.count, 0);
                    const percentage = totalCustomerTickets > 0 ? ((customer.count / totalCustomerTickets) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={customer.customerId} 
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-[#A2B9AF]/10 to-transparent rounded-lg hover:from-[#A2B9AF]/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="font-medium text-[#546A7A]">{customer.customerName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-[#AEBFC3]0">{percentage}%</span>
                          <span className="font-bold text-[#4F6A64] min-w-[60px] text-right">
                            {customer.count} tickets
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Info message */}
                <div className="mt-4 p-3 bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg">
                  <p className="text-sm text-[#546A7A]">
                    ℹ️ Showing all {customerDistribution.length} customers. Customers with 0 tickets are included to provide complete visibility.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#546A7A]" />
            Overall Performance Radar
          </CardTitle>
          <CardDescription>360° view of service desk performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={performanceData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar 
                name="Performance Score" 
                dataKey="value" 
                stroke="#8B5CF6" 
                fill="#8B5CF6" 
                fillOpacity={0.6} 
              />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
          
          {/* Performance insights */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#A2B9AF]/10 rounded-lg">
              <p className="text-sm text-[#4F6A64] font-medium">Strengths</p>
              <ul className="mt-2 space-y-1">
                {parseFloat(resolutionRate) >= 70 && <li className="text-sm text-[#4F6A64]">✓ High resolution rate ({resolutionRate}%)</li>}
                {(summary.avgOnsiteTravelTime || 0) > 0 && (summary.avgOnsiteTravelTime || 0) <= 120 && <li className="text-sm text-[#4F6A64]">✓ Efficient travel time ({avgTravelTime})</li>}
                {(summary.averageOnsiteResolutionTime || 0) > 0 && (summary.averageOnsiteResolutionTime || 0) <= 240 && <li className="text-sm text-[#4F6A64]">✓ Quick onsite resolution ({avgOnsiteResolution})</li>}
                {(summary.averageFirstResponseTime || 0) > 0 && (summary.averageFirstResponseTime || 0) <= 60 && <li className="text-sm text-[#4F6A64]">✓ Fast first response ({avgFirstResponse})</li>}
              </ul>
            </div>
            <div className="p-4 bg-[#EEC1BF]/10 rounded-lg">
              <p className="text-sm text-[#976E44] font-medium">Areas to Improve</p>
              <ul className="mt-2 space-y-1">
                {(summary.avgOnsiteTravelTime || 0) > 120 && <li className="text-sm text-[#976E44]">→ Reduce travel time ({avgTravelTime})</li>}
                {(summary.averageOnsiteResolutionTime || 0) > 240 && <li className="text-sm text-[#976E44]">→ Optimize onsite resolution ({avgOnsiteResolution})</li>}
                {parseFloat(resolutionRate) < 70 && <li className="text-sm text-[#976E44]">→ Improve resolution rate ({resolutionRate}%)</li>}
                {(summary.criticalTickets || 0) > totalTickets * 0.1 && <li className="text-sm text-[#976E44]">→ Reduce critical tickets ({summary.criticalTickets})</li>}
              </ul>
            </div>
            <div className="p-4 bg-[#96AEC2]/10 rounded-lg">
              <p className="text-sm text-[#546A7A] font-medium">Recommendations</p>
              <ul className="mt-2 space-y-1">
                {(summary.avgOnsiteTravelTime || 0) > 120 && <li className="text-sm text-[#546A7A]">• Optimize route planning</li>}
                {(summary.averageOnsiteResolutionTime || 0) > 240 && <li className="text-sm text-[#546A7A]">• Improve parts availability</li>}
                <li className="text-sm text-[#546A7A]">• Proactive monitoring</li>
                {totalOnsiteVisits > 0 && totalOnsiteVisits < totalTickets * 0.3 && <li className="text-sm text-[#546A7A]">• Increase remote resolution</li>}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Insights and Recommendations */}
      {insights && (
        <Card className="border-t-4 border-t-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[#546A7A]" />
              Key Insights
            </CardTitle>
            <CardDescription>Automated insights from your ticket data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.topPerformingZone && (
                <div className="flex items-start gap-3 p-4 bg-[#A2B9AF]/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-[#4F6A64] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#4F6A64]">Top Performing Zone</p>
                    <p className="text-sm text-[#4F6A64] mt-1">{insights.topPerformingZone}</p>
                  </div>
                </div>
              )}
              {insights.mostActiveCustomer && (
                <div className="flex items-start gap-3 p-4 bg-[#96AEC2]/10 rounded-lg">
                  <Users className="h-5 w-5 text-[#546A7A] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#546A7A]">Most Active Customer</p>
                    <p className="text-sm text-[#546A7A] mt-1">{insights.mostActiveCustomer}</p>
                  </div>
                </div>
              )}
              {insights.topAssignee && (
                <div className="flex items-start gap-3 p-4 bg-[#6F8A9D]/10 rounded-lg">
                  <Award className="h-5 w-5 text-[#546A7A] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#546A7A]">Top Assignee</p>
                    <p className="text-sm text-[#546A7A] mt-1">{insights.topAssignee}</p>
                  </div>
                </div>
              )}
              {insights.worstPerformingCustomer && (
                <div className="flex items-start gap-3 p-4 bg-[#E17F70]/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-[#9E3B47] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#75242D]">Attention Needed</p>
                    <p className="text-sm text-[#75242D] mt-1">{insights.worstPerformingCustomer}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
