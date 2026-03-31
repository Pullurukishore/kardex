'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  UserCheck,
  UserX,
  Zap,
  Clock3,
  Info,
  TrendingUp,
  BarChart3,
  Users,
  FileText,
  Ticket,
  Target,
  Award,
  Clock4,
  MapPin as TravelIcon,
  Wrench
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ReportData, ServicePersonReport } from './types';

interface ServicePersonPerformanceReportProps {
  reportData: ReportData;
}

const FLAG_CONFIG = {
  LATE: { color: 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]', icon: AlertTriangle, severity: 'warning' },
  EARLY_CHECKOUT: { color: 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]', icon: Clock3, severity: 'warning' },
  LONG_DAY: { color: 'bg-[#6F8A9D]/20 text-[#546A7A] border-[#6F8A9D]', icon: Timer, severity: 'warning' },
  AUTO_CHECKOUT: { color: 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]', icon: Zap, severity: 'info' },
  NO_ACTIVITY: { color: 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]', icon: XCircle, severity: 'error' },
  MISSING_CHECKOUT: { color: 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]', icon: AlertTriangle, severity: 'error' },
  MULTIPLE_SESSIONS: { color: 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]', icon: Info, severity: 'info' },
  ABSENT: { color: 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]', icon: UserX, severity: 'error' },
};

export function ServicePersonPerformanceReport({ reportData }: ServicePersonPerformanceReportProps) {
  // Safety check - if no report data, show loading state
  if (!reportData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Service Person Performance Report...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please wait while we load the data.</p>
        </CardContent>
      </Card>
    );
  }

  const reports = Array.isArray(reportData?.reports) ? reportData.reports : [];
  
  // Debug logging to help identify data structure issues
  console.log('ServicePersonPerformanceReport - reportData:', reportData);
  console.log('ServicePersonPerformanceReport - reports:', reports);
  console.log('ServicePersonPerformanceReport - first report structure:', reports[0]);
  
  // Additional safety check - if reports is empty, show empty state
  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Person Performance Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-[#92A2A5] mb-4" />
            <h3 className="text-lg font-medium text-[#5D6E73] mb-2">No Reports Found</h3>
            <p className="text-[#AEBFC3]0">No service person reports available for the selected period.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Create safe summary object with proper type conversion
  const safeSummary = {
    totalServicePersons: Number(reportData.summary?.totalServicePersons || 0),
    totalCheckIns: Number(reportData.summary?.totalCheckIns || 0),
    averageHoursPerDay: Number(reportData.summary?.averageHoursPerDay || 0),
    totalAbsentees: Number(reportData.summary?.totalAbsentees || 0),
    totalActivitiesLogged: Number(reportData.summary?.totalActivitiesLogged || 0),
    mostActiveUser: reportData.summary?.mostActiveUser && typeof reportData.summary.mostActiveUser === 'object' ? {
      name: String(reportData.summary.mostActiveUser.name || ''),
      email: String(reportData.summary.mostActiveUser.email || ''),
      activityCount: Number(reportData.summary.mostActiveUser.activityCount || 0)
    } : null,
    uniqueMetrics: reportData.summary?.uniqueMetrics || null
  };
  
  const summary = safeSummary;
  const dateRange = reportData.dateRange || { from: '', to: '', totalDays: 0 };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Information Notice */}
      <div className="mb-6 p-4 bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg space-y-3">
        <div className="flex items-start gap-2 text-[#546A7A]">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Time calculations are based on business hours only (9 AM - 5:30 PM, Monday to Saturday). Travel times show actual elapsed time.
            </p>
            <div>
              <p className="text-sm font-semibold mb-1">Performance Score Calculation:</p>
              <ul className="text-xs list-disc pl-5 space-y-1">
                <li><span className="font-semibold">Resolution Rate (40%-60% weight):</span> Percentage of successfully resolved tickets vs assigned.</li>
                <li><span className="font-semibold">Speed Score (30%-40% weight):</span> Scales against average ticket resolution time. Perfect score if resolved under 8 hours (1 day); drops linearly to 0 by 72 hours (3 days).</li>
                <li><span className="font-semibold">Efficiency Score (30% weight):</span> Scales against actual physical labor (travel + onsite time) baseline. Perfect score if under 4 hours per ticket; slowly scales down. <span className="text-muted-foreground italic">Note: If Travel/Onsite data is blank, this weight is dynamically reallocated to Resolution and Speed to prevent unfair penalization.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-[#546A7A] mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-[#546A7A]" />
          Performance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.uniqueMetrics?.totalTickets ?? reports.reduce((sum, person) => sum + ((person.summary || {}).totalTickets || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all service persons
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-[#4F6A64]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#4F6A64]">
                {summary?.uniqueMetrics?.ticketsResolved ?? reports.reduce((sum, person) => sum + ((person.summary || {}).ticketsResolved || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
              <Clock4 className="h-4 w-4 text-[#546A7A]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#546A7A]">
                {(() => {
                  const totalHours = reports.reduce((sum, person) => {
                    const hours = (person.summary || {}).averageResolutionTimeHours || 0;
                    return sum + (hours > 0 ? hours : 0);
                  }, 0);
                  const validReports = reports.filter(p => ((p.summary || {}).averageResolutionTimeHours || 0) > 0).length;
                  const avgHours = validReports > 0 ? (totalHours / validReports) : 0;
                  return avgHours > 0 ? `${avgHours.toFixed(1)}h` : '0h';
                })()} 
              </div>
              <p className="text-xs text-muted-foreground">
                Per ticket average (business hours)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Travel Time</CardTitle>
              <TravelIcon className="h-4 w-4 text-[#976E44]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#976E44]">
                {(() => {
                  const totalHours = reports.reduce((sum, person) => {
                    const hours = (person.summary || {}).averageTravelTimeHours || 0;
                    return sum + (hours > 0 ? hours : 0);
                  }, 0);
                  const validReports = reports.filter(p => ((p.summary || {}).averageTravelTimeHours || 0) > 0).length;
                  const avgHours = validReports > 0 ? (totalHours / validReports) : 0;
                  return avgHours > 0 ? `${avgHours.toFixed(1)}h` : '0h';
                })()} 
              </div>
              <p className="text-xs text-muted-foreground">
                Per ticket travel (real-time)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Onsite Time</CardTitle>
              <Wrench className="h-4 w-4 text-[#546A7A]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#546A7A]">
                {(() => {
                  const totalHours = reports.reduce((sum, person) => {
                    const hours = (person.summary || {}).averageOnsiteTimeHours || 0;
                    return sum + (hours > 0 ? hours : 0);
                  }, 0);
                  const validReports = reports.filter(p => ((p.summary || {}).averageOnsiteTimeHours || 0) > 0).length;
                  const avgHours = validReports > 0 ? (totalHours / validReports) : 0;
                  return avgHours > 0 ? `${avgHours.toFixed(1)}h` : '0h';
                })()} 
              </div>
              <p className="text-xs text-muted-foreground">
                Per ticket onsite work (business hours)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Service Person Performance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Service Person Performance Report
              </CardTitle>
              <CardDescription>
                Performance metrics for {dateRange.from && dateRange.to 
                  ? `${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}`
                  : 'selected period'
                }
              </CardDescription>
            </div>
            <Badge variant="outline">
              {reports.length} persons
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-[#92A2A5] mb-4" />
              <h3 className="text-lg font-medium text-[#5D6E73] mb-2">No Reports Found</h3>
              <p className="text-[#AEBFC3]0">No service person reports available for the selected period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-[#AEBFC3]/10">
                    <th className="text-left p-3 font-medium text-[#546A7A]">Service Person</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Working Days</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Total Hours</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Tickets</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Resolution Rate</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Avg Resolution</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Avg Travel</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Avg Onsite</th>
                    <th className="text-left p-3 font-medium text-[#546A7A]">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((person) => {
                    // Ensure person.summary exists to prevent undefined errors
                    const personSummary = person.summary || {};
                    return (
                    <tr key={person.id} className="border-b hover:bg-[#AEBFC3]/10 transition-colors">
                      {/* Service Person */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-[#546A7A]">{person.name}</div>
                            <div className="text-sm text-[#5D6E73]">{person.email}</div>
                            {person.zones && person.zones.length > 0 && (
                              <div className="text-xs text-[#AEBFC3]0 bg-[#AEBFC3]/20 px-2 py-1 rounded mt-1">
                                {person.zones.map((zone, idx) => (
                                  <span key={idx}>
                                    {zone.name}
                                    {idx < person.zones.length - 1 && ', '}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Working Days */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Calendar className="h-3 w-3 text-[#4F6A64]" />
                          {personSummary.presentDays || personSummary.totalWorkingDays || 0}
                        </div>
                      </td>

                      {/* Total Hours */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Clock className="h-3 w-3 text-[#546A7A]" />
                          {Number(personSummary.totalHours || 0).toFixed(1)}h
                        </div>
                      </td>

                      {/* Tickets */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Ticket className="h-3 w-3 text-[#546A7A]" />
                            {personSummary.totalTickets || 0}
                          </div>
                          <div className="text-xs text-[#AEBFC3]0">
                            {personSummary.ticketsResolved || 0} resolved
                          </div>
                        </div>
                      </td>

                      {/* Resolution Rate */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          {(() => {
                            const total = personSummary.totalTickets || 0;
                            const resolved = personSummary.ticketsResolved || 0;
                            const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
                            const color = rate >= 80 ? 'text-[#4F6A64]' : rate >= 60 ? 'text-[#976E44]' : 'text-[#9E3B47]';
                            return (
                              <>
                                <Target className={`h-3 w-3 ${color}`} />
                                <span className={color}>{rate}%</span>
                              </>
                            );
                          })()} 
                        </div>
                      </td>

                      {/* Average Resolution Time */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Clock4 className="h-3 w-3 text-[#546A7A]" />
                          {(() => {
                            const hours = personSummary.averageResolutionTimeHours || 0;
                            return hours > 0 ? `${hours.toFixed(1)}h` : 'N/A';
                          })()} 
                        </div>
                      </td>

                      {/* Average Travel Time */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <TravelIcon className="h-3 w-3 text-[#976E44]" />
                          {(() => {
                            const hours = personSummary.averageTravelTimeHours || 0;
                            return hours > 0 ? `${hours.toFixed(1)}h` : 'N/A';
                          })()} 
                        </div>
                      </td>

                      {/* Average Onsite Time */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Wrench className="h-3 w-3 text-[#546A7A]" />
                          {(() => {
                            const hours = personSummary.averageOnsiteTimeHours || 0;
                            return hours > 0 ? `${hours.toFixed(1)}h` : 'N/A';
                          })()} 
                        </div>
                      </td>

                      {/* Performance Score */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const score = personSummary.performanceScore || 0;
                            let color = 'bg-[#AEBFC3]/20 text-[#546A7A]';
                            
                            if (score >= 80) {
                              color = 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#A2B9AF]';
                            } else if (score >= 60) {
                              color = 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]';
                            } else if (score > 0) {
                              color = 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]';
                            }
                            
                            return (
                              <Badge variant="outline" className={`${color} border font-medium`}>
                                <Award className="h-3 w-3 mr-1" />
                                {score}%
                              </Badge>
                            );
                          })()} 
                        </div>
                      </td>

                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
