// Server-side component - charts replaced with static summaries

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportData } from './types';

interface TicketSummaryReportProps {
  reportData: ReportData;
}

export function TicketSummaryReport({ reportData }: TicketSummaryReportProps) {
  const { 
    statusDistribution, 
    callTypeDistribution, 
    zoneDistribution,
    customerDistribution,
    customerPerformanceMetrics,
    summary,
    insights
  } = reportData;

  if (!summary || !statusDistribution) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Summary Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No ticket data available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  // Helper function to format minutes to hours and minutes
  const formatMinutesToHoursAndMinutes = (totalMinutes: number): { hours: number; minutes: number; formatted: string } => {
    if (!totalMinutes || totalMinutes <= 0) {
      return { hours: 0, minutes: 0, formatted: '0h 0m' };
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return { 
        hours, 
        minutes, 
        formatted: minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
      };
    } else {
      return { 
        hours: 0, 
        minutes, 
        formatted: `${minutes}m`
      };
    }
  };

  // Use the processed data from the server
  const statusCounts = statusDistribution || {};
  const callTypeCounts = callTypeDistribution || {};
  const totalTickets = summary.totalTickets || 0;

  // Helper function to get status color - Kardex Colors
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'OPEN': 'bg-[#96AEC2]',           // Blue 1
      'IN_PROGRESS': 'bg-[#EEC18F]',    // Sand 1
      'ASSIGNED': 'bg-[#6F8A9D]',       // Blue 2
      'RESOLVED': 'bg-[#82A094]',       // Green 2
      'CLOSED': 'bg-[#979796]',         // Grey 3
      'ESCALATED': 'bg-[#E17F70]'       // Red 1
    };
    return colors[status] || 'bg-[#979796]';
  };

  // Helper function to get priority color - Kardex Colors
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-[#A2B9AF]',            // Green 1
      'MEDIUM': 'bg-[#EEC18F]',         // Sand 1
      'HIGH': 'bg-[#CE9F6B]',           // Sand 2
      'CRITICAL': 'bg-[#E17F70]'        // Red 1
    };
    return colors[priority] || 'bg-[#979796]';
  };

  return (
    <div className="space-y-6">
      {/* Ticket Summary - Always show summary cards */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket Summary Report</CardTitle>
          <CardDescription>Overview of ticket performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#546A7A]">
                  {summary.totalTickets || 0}
                </div>
                <div className="text-sm text-[#6F8A9D]">Total Tickets</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#82A094]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#4F6A64]">
                  {summary.resolvedTickets || 0}
                </div>
                <div className="text-sm text-[#82A094]">Resolved Tickets</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-[#EEC18F]/10 to-[#CE9F6B]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#976E44]">
                  {formatMinutesToHoursAndMinutes(summary.averageResolutionTime || 0).formatted}
                </div>
                <div className="text-sm text-[#CE9F6B]">Avg Resolution Time (Business Hours)</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-[#6F8A9D]/10 to-[#546A7A]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#546A7A]">
                  {summary.resolutionRate || 0}%
                </div>
                <div className="text-sm text-[#6F8A9D]">Resolution Rate</div>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Card className="bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#9E3B47]">
                  {summary.criticalTickets || 0}
                </div>
                <div className="text-sm text-[#E17F70]">Critical Tickets</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#976E44]">
                  {summary.highPriorityTickets || 0}
                </div>
                <div className="text-sm text-[#CE9F6B]">High Priority</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-[#EEC18F]/10 to-[#CE9F6B]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#976E44]">
                  {summary.overdueTickets || 0}
                </div>
                <div className="text-sm text-[#EEC18F]">Overdue Tickets</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-[#979796]/10 to-[#757777]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#757777]">
                  {summary.unassignedTickets || 0}
                </div>
                <div className="text-sm text-[#979796]">Unassigned</div>
              </CardContent>
            </Card>
          </div>

          {/* Time Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card className="bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/20">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#546A7A]">
                  {formatMinutesToHoursAndMinutes(summary.averageFirstResponseTime || 0).formatted}
                </div>
                <div className="text-sm text-[#546A7A]">Avg First Response (Business Hours)</div>
              </CardContent>
            </Card>
            {summary.avgOnsiteTravelTime > 0 && (
              <Card className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#546A7A]">
                    {formatMinutesToHoursAndMinutes(summary.avgOnsiteTravelTime || 0).formatted}
                  </div>
                  <div className="text-sm text-[#546A7A]">Avg Travel Time (Real-time)</div>
                </CardContent>
              </Card>
            )}
            {summary.totalOnsiteVisits > 0 && (
              <Card className="bg-gradient-to-r from-[#82A094]/10 to-[#82A094]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#4F6A64]">
                    {summary.totalOnsiteVisits || 0}
                  </div>
                  <div className="text-sm text-[#4F6A64]">Onsite Visits</div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Customer Satisfaction */}
          {summary.averageCustomerRating > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#4F6A64]">
                    {summary.averageCustomerRating}/5
                  </div>
                  <div className="text-sm text-[#4F6A64]">Average Rating</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-lime-50 to-lime-100">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-lime-900">
                    {summary.totalRatings || 0}
                  </div>
                  <div className="text-sm text-lime-700">Total Ratings</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#4F6A64]">
                    {summary.ticketsWithFeedback || 0}
                  </div>
                  <div className="text-sm text-[#4F6A64]">With Feedback</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Show message when no tickets */}
          {(!summary.totalTickets || summary.totalTickets === 0) && (
            <div className="mt-6 text-center py-8">
              <div className="text-[#4F6A64] mb-2">
                <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-[#4F6A64] mb-1">Excellent Service!</h3>
              <p className="text-[#4F6A64] text-sm">
                No tickets found for the selected period. All systems are running smoothly.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Distribution */}
      {statusDistribution && Object.keys(statusDistribution).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Breakdown of tickets by current status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(statusCounts).map(([status, count]) => {
                const percentage = totalTickets > 0 ? ((count / totalTickets) * 100).toFixed(1) : '0';
                return (
                  <div key={status} className="text-center p-4 bg-[#AEBFC3]/10 rounded-lg">
                    <div className="text-2xl font-bold text-[#546A7A]">{count}</div>
                    <div className="text-sm text-[#5D6E73] capitalize">{status.replace('_', ' ')}</div>
                    <div className="text-xs text-[#AEBFC3]0">{percentage}%</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Type Analytics */}
      {callTypeDistribution && Object.keys(callTypeDistribution).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Call Type Analytics</CardTitle>
            <CardDescription>Breakdown of tickets by call type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(callTypeCounts).map(([type, count]) => {
                const percentage = totalTickets > 0 ? ((count / totalTickets) * 100).toFixed(1) : '0';
                return (
                  <div key={type} className="text-center p-4 bg-[#AEBFC3]/10 rounded-lg">
                    <div className="text-2xl font-bold text-[#546A7A]">{count}</div>
                    <div className="text-sm text-[#5D6E73] capitalize">{type.replace('_', ' ')}</div>
                    <div className="text-xs text-[#AEBFC3]0">{percentage}%</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone Distribution */}
      {zoneDistribution && zoneDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zone-wise Distribution</CardTitle>
            <CardDescription>Top zones by ticket volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {zoneDistribution.slice(0, 5).map((zone: any) => (
                <div key={zone.zoneId} className="flex items-center justify-between p-3 bg-[#AEBFC3]/10 rounded-lg">
                  <span className="font-medium">{zone.zoneName}</span>
                  <div className="text-right">
                    <span className="font-bold text-[#6F8A9D]">{zone.count}</span>
                    <span className="text-sm text-[#AEBFC3]0 ml-1">tickets</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Customers */}
      {customerDistribution && customerDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>Customers with highest ticket volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerDistribution.slice(0, 5).map((customer: any) => (
                <div key={customer.customerId} className="flex items-center justify-between p-3 bg-[#AEBFC3]/10 rounded-lg">
                  <span className="font-medium">{customer.customerName}</span>
                  <div className="text-right">
                    <span className="font-bold text-[#82A094]">{customer.count}</span>
                    <span className="text-sm text-[#AEBFC3]0 ml-1">tickets</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
