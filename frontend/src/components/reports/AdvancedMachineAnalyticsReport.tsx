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
  Users, Target, Award, Activity, Zap, Settings, BarChart3, Factory,
  Monitor, Cpu
} from 'lucide-react';

interface AdvancedMachineAnalyticsReportProps {
  reportData: ReportData;
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1'];

export function AdvancedMachineAnalyticsReport({ reportData }: AdvancedMachineAnalyticsReportProps) {
  const { machineDowntime, summary } = reportData;

  if (!summary || !machineDowntime) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Advanced Machine Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No machine data available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  const totalMachines = summary.totalMachines || machineDowntime.length || 0;
  const totalMachinesWithIssues = summary.totalMachinesWithDowntime || machineDowntime.filter(m => (m.incidents || 0) > 0).length || 0;
  const totalMachinesWithoutIssues = summary.totalMachinesWithoutIssues || (totalMachines - totalMachinesWithIssues);
  // Backend may return totalDowntimeHours as hours or totalDowntimeMinutes as minutes
  const totalDowntimeHours = summary.totalDowntimeHours || (summary.totalDowntimeMinutes ? summary.totalDowntimeMinutes / 60 : 0);
  const avgDowntimePerMachine = summary.averageDowntimePerMachine || (totalMachinesWithIssues > 0 ? totalDowntimeHours / totalMachinesWithIssues : 0);
  const totalIncidents = summary.totalIncidents || machineDowntime.reduce((sum: number, m: any) => sum + (m.incidents || 0), 0);
  const totalOpenIncidents = summary.totalOpenIncidents || machineDowntime.reduce((sum: number, m: any) => sum + (m.openIncidents || 0), 0);
  const totalResolvedIncidents = summary.totalResolvedIncidents || machineDowntime.reduce((sum: number, m: any) => sum + (m.resolvedIncidents || 0), 0);
  const resolutionRate = totalIncidents > 0 ? ((totalResolvedIncidents / totalIncidents) * 100).toFixed(1) : '100';

  const machinesByCustomer = machineDowntime.reduce((acc: any, machine: any) => {
    const customerName = machine.customer || 'Unknown Customer';
    if (!acc[customerName]) acc[customerName] = [];
    acc[customerName].push(machine);
    return acc;
  }, {});

  const customerNames = Object.keys(machinesByCustomer).sort();
  const customerChartData = customerNames.map((customerName) => {
    const machines = machinesByCustomer[customerName];
    const totalDowntime = machines.reduce((sum: number, m: any) => sum + (m.totalDowntimeMinutes || 0), 0);
    return {
      name: customerName.length > 20 ? customerName.substring(0, 20) + '...' : customerName,
      fullName: customerName,
      value: totalDowntime,
      machineCount: machines.length
    };
  }).sort((a, b) => b.value - a.value);

  // Filter machines with issues for visualizations
  const machinesWithIssues = machineDowntime.filter(m => (m.incidents || 0) > 0);
  const machinesWithoutIssues = machineDowntime.filter(m => (m.incidents || 0) === 0);

  const downtimeRanges = [
    { range: '0h (No Issues)', min: 0, max: 0 },
    { range: '0-2h', min: 0.01, max: 120 }, 
    { range: '2-5h', min: 120, max: 300 },
    { range: '5-10h', min: 300, max: 600 }, 
    { range: '10-20h', min: 600, max: 1200 },
    { range: '20h+', min: 1200, max: Infinity }
  ];

  const downtimeDistribution = downtimeRanges.map((range, idx) => ({
    name: range.range,
    value: range.min === 0 && range.max === 0 
      ? machinesWithoutIssues.length
      : machineDowntime.filter(m => (m.totalDowntimeMinutes || 0) >= range.min && (m.totalDowntimeMinutes || 0) < range.max).length,
    color: CHART_COLORS[idx]
  })).filter(item => item.value > 0);

  const topMachines = [...machinesWithIssues]
    .sort((a, b) => (b.totalDowntimeMinutes || 0) - (a.totalDowntimeMinutes || 0))
    .map(m => ({
      name: `${m.model || 'N/A'} - ${m.serialNo?.substring(0, 8) || 'N/A'}`,
      fullName: `${m.model || 'N/A'} (${m.serialNo || 'N/A'})`,
      downtime: (m.totalDowntimeMinutes || 0) / 60,
      incidents: m.incidents || 0,
      customer: m.customer
    }));

  const healthScoreRanges = [
    { range: 'Excellent (0-1h)', min: 0, max: 60, count: 0 },
    { range: 'Good (1-3h)', min: 60, max: 180, count: 0 },
    { range: 'Fair (3-6h)', min: 180, max: 360, count: 0 },
    { range: 'Poor (6-12h)', min: 360, max: 720, count: 0 },
    { range: 'Critical (12h+)', min: 720, max: Infinity, count: 0 }
  ];

  machineDowntime.forEach(machine => {
    const downtime = machine.totalDowntimeMinutes || 0;
    const range = healthScoreRanges.find(r => downtime >= r.min && downtime < r.max);
    if (range) range.count++;
  });

  const healthScoreData = healthScoreRanges.filter(r => r.count > 0).map((r, idx) => ({
    name: r.range, value: r.count, color: CHART_COLORS[idx]
  }));

  const performanceData = [
    { metric: 'Uptime', value: Math.min(100 - (totalDowntimeHours / (totalMachines * 24 * 30) * 100), 100), fullMark: 100 },
    { metric: 'Resolution Rate', value: parseFloat(resolutionRate), fullMark: 100 },
    { metric: 'MTBF', value: totalIncidents > 0 ? Math.min((totalMachines * 24 * 30 / totalIncidents) * 2, 100) : 100, fullMark: 100 },
    { metric: 'Incident Response', value: totalOpenIncidents > 0 ? Math.max(100 - (totalOpenIncidents / totalIncidents * 100), 0) : 100, fullMark: 100 },
    { metric: 'Equipment Health', value: avgDowntimePerMachine > 0 ? Math.max(100 - (avgDowntimePerMachine / 24 * 100), 0) : 100, fullMark: 100 }
  ];

  const totalCustomerDowntime = customerChartData.reduce((sum, item) => sum + item.value, 0);
  const renderPercentageLabel = (entry: any, total: number) => {
    const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0';
    return `${percent}%`;
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#96AEC2] text-sm font-medium">Total Machines</p>
                <p className="text-3xl font-bold mt-2">{totalMachines}</p>
                <p className="text-[#96AEC2] text-xs mt-1">All assets tracked</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Settings className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#A2B9AF] text-sm font-medium">Healthy</p>
                <p className="text-3xl font-bold mt-2">{totalMachinesWithoutIssues}</p>
                <p className="text-[#A2B9AF] text-xs mt-1">No issues</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><CheckCircle className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#E17F70] to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#E17F70] text-sm font-medium">With Issues</p>
                <p className="text-3xl font-bold mt-2">{totalMachinesWithIssues}</p>
                <p className="text-[#E17F70] text-xs mt-1">{totalIncidents} incidents</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><AlertCircle className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#EEC1BF] text-sm font-medium">Total Downtime</p>
                <p className="text-3xl font-bold mt-2">{totalDowntimeHours.toFixed(1)}h</p>
                <p className="text-[#EEC1BF] text-xs mt-1">Business hours</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Clock className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#6F8A9D] text-sm font-medium">Resolution Rate</p>
                <p className="text-3xl font-bold mt-2">{resolutionRate}%</p>
                <p className="text-[#6F8A9D] text-xs mt-1">{totalResolvedIncidents} resolved</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Activity className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Downtime Distribution and Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#546A7A]" />
              Downtime Distribution by Severity
            </CardTitle>
            <CardDescription>Breakdown of machines by total downtime hours</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={downtimeDistribution} cx="50%" cy="50%" labelLine={false}
                  label={(entry) => renderPercentageLabel(entry, machineDowntime.length)}
                  outerRadius={100} fill="#8884d8" dataKey="value">
                  {downtimeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} machines`, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {downtimeDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 bg-[#AEBFC3]/10 rounded">
                  <span className="text-sm text-[#5D6E73]">{item.name}</span>
                  <span className="font-semibold text-[#546A7A]">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#4F6A64]" />
              Machine Health Distribution
            </CardTitle>
            <CardDescription>Health status based on downtime performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={healthScoreData} cx="50%" cy="50%" labelLine={false}
                  label={(entry) => renderPercentageLabel(entry, totalMachines)}
                  outerRadius={100} fill="#8884d8" dataKey="value" innerRadius={60}>
                  {healthScoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} machines`, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {healthScoreData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 bg-[#AEBFC3]/10 rounded">
                  <span className="text-sm text-[#5D6E73]">{item.name}</span>
                  <span className="font-semibold text-[#546A7A]">{item.value} machines</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Customer Performance */}
      {customerChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-[#546A7A]" />
              Customer Downtime Analysis
            </CardTitle>
            <CardDescription>Total downtime hours by customer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-[#96AEC2]/10 rounded-lg">
                <p className="text-sm text-[#546A7A] font-medium">Total Customers</p>
                <p className="text-3xl font-bold text-[#546A7A]">{customerNames.length}</p>
              </div>
              <div className="p-4 bg-[#E17F70]/10 rounded-lg">
                <p className="text-sm text-[#9E3B47] font-medium">Total Downtime</p>
                <p className="text-3xl font-bold text-[#75242D]">{(totalCustomerDowntime / 60).toFixed(1)}h</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={customerChartData.slice(0, 8)} cx="50%" cy="50%" labelLine={false}
                  label={(entry) => renderPercentageLabel(entry, totalCustomerDowntime)}
                  outerRadius={100} fill="#8884d8" dataKey="value">
                  {customerChartData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${(value / 60).toFixed(1)} hours`, 'Downtime']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-[#5D6E73] mb-3">All Customers Breakdown</h4>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {customerChartData.map((customer, index) => {
                  const percentage = totalCustomerDowntime > 0 ? ((customer.value / totalCustomerDowntime) * 100).toFixed(1) : '0';
                  const machines = (machinesByCustomer[customer.fullName] || [])
                    .filter((m: any) => (m.incidents || 0) > 0)
                    .sort((a: any, b: any) => (b.totalDowntimeMinutes || 0) - (a.totalDowntimeMinutes || 0));

                  if (machines.length === 0) return null;

                  return (
                    <div key={customer.fullName} className="mb-8 last:mb-0">
                      {/* Customer Header */}
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-t-lg shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full bg-white/20" />
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-lg">{customer.fullName}</span>
                            <span className="text-xs text-white/70">{customer.machineCount} machines tracked</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-white text-sm font-medium pr-4">{percentage}% share</span>
                          <span className="bg-white/20 text-white px-3 py-1 rounded text-sm font-bold">
                            Total: {(customer.value / 60).toFixed(1)}h
                          </span>
                        </div>
                      </div>

                      {/* Machine Wise Detailed List */}
                      <div className="bg-white border-x border-b border-[#AEBFC3]/20 rounded-b-lg overflow-hidden">
                        <table className="w-100 border-collapse">
                          <thead>
                            <tr className="bg-[#AEBFC3]/5 border-b border-[#AEBFC3]/10">
                              <th className="text-left py-3 px-4 text-xs font-semibold text-[#5D6E73] uppercase tracking-wider">Machine Model & S/N</th>
                              <th className="text-center py-3 px-4 text-xs font-semibold text-[#5D6E73] uppercase tracking-wider">Incidents</th>
                              <th className="text-right py-3 px-4 text-xs font-semibold text-[#5D6E73] uppercase tracking-wider">Downtime (Hours)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#AEBFC3]/10">
                            {machines.map((m: any, mIdx: number) => (
                              <tr key={mIdx} className="hover:bg-[#96AEC2]/5 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-[#546A7A]/10 p-2 rounded">
                                      <Monitor className="h-4 w-4 text-[#546A7A]" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-[#546A7A]">{m.model || 'N/A'}</span>
                                      <span className="text-[11px] font-medium text-[#AEBFC3]0">SN: {m.serialNo || 'N/A'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.incidents > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                    {m.incidents || 0}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex flex-col items-end">
                                    <span className="text-sm font-bold text-[#9E3B47]">{(m.totalDowntimeMinutes / 60).toFixed(1)}h</span>
                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                      <div 
                                        className="h-full bg-[#9E3B47]" 
                                        style={{ width: `${Math.min((m.totalDowntimeMinutes / customer.value) * 100, 100)}%` }} 
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Radar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#546A7A]" />
            Overall Machine Performance Metrics
          </CardTitle>
          <CardDescription>360° view of equipment performance and reliability</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={performanceData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Performance Score" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#A2B9AF]/10 rounded-lg">
              <p className="text-sm text-[#4F6A64] font-medium">Strengths</p>
              <ul className="mt-2 space-y-1">
                <li className="text-sm text-[#4F6A64]">✓ {totalMachinesWithoutIssues} machines running perfectly</li>
                <li className="text-sm text-[#4F6A64]">✓ High resolution rate ({resolutionRate}%)</li>
                <li className="text-sm text-[#4F6A64]">✓ {totalMachines} total assets tracked</li>
              </ul>
            </div>
            <div className="p-4 bg-[#EEC1BF]/10 rounded-lg">
              <p className="text-sm text-[#976E44] font-medium">Areas to Improve</p>
              <ul className="mt-2 space-y-1">
                <li className="text-sm text-[#976E44]">→ {totalMachinesWithIssues} machines need attention</li>
                {totalOpenIncidents > 0 && <li className="text-sm text-[#976E44]">→ Close {totalOpenIncidents} open incidents</li>}
                {avgDowntimePerMachine > 0 && <li className="text-sm text-[#976E44]">→ Reduce avg downtime ({avgDowntimePerMachine.toFixed(1)}h)</li>}
              </ul>
            </div>
            <div className="p-4 bg-[#96AEC2]/10 rounded-lg">
              <p className="text-sm text-[#546A7A] font-medium">Recommendations</p>
              <ul className="mt-2 space-y-1">
                <li className="text-sm text-[#546A7A]">• Preventive maintenance schedule</li>
                <li className="text-sm text-[#546A7A]">• Equipment health monitoring</li>
                <li className="text-sm text-[#546A7A]">• Regular asset performance reviews</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Key Insights */}
      <Card className="border-t-4 border-t-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[#546A7A]" />
            Key Insights
          </CardTitle>
          <CardDescription>Automated insights from your machine performance data</CardDescription>
        </CardHeader>
        <CardContent>
          {topMachines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-[#E17F70]/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-[#9E3B47] mt-0.5" />
                <div>
                  <p className="font-medium text-[#75242D]">Highest Downtime Machine</p>
                  <p className="text-sm text-[#75242D] mt-1">
                    {topMachines[0].fullName} - {topMachines[0].downtime.toFixed(1)} hours
                  </p>
                </div>
              </div>
              {customerChartData.length > 0 && customerChartData[0].value > 0 && (
                <div className="flex items-start gap-3 p-4 bg-[#96AEC2]/10 rounded-lg">
                  <Factory className="h-5 w-5 text-[#546A7A] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#546A7A]">Most Affected Customer</p>
                    <p className="text-sm text-[#546A7A] mt-1">
                      {customerChartData[0].fullName} - {(customerChartData[0].value / 60).toFixed(1)} hours downtime
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-4 bg-[#A2B9AF]/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-[#4F6A64] mt-0.5" />
                <div>
                  <p className="font-medium text-[#4F6A64]">Resolution Success</p>
                  <p className="text-sm text-[#4F6A64] mt-1">
                    {resolutionRate}% of incidents resolved successfully
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-[#CE9F6B]/10 rounded-lg">
                <Clock className="h-5 w-5 text-[#976E44] mt-0.5" />
                <div>
                  <p className="font-medium text-[#976E44]">Fleet Health</p>
                  <p className="text-sm text-[#976E44] mt-1">
                    {totalMachinesWithoutIssues} of {totalMachines} machines ({((totalMachinesWithoutIssues / totalMachines) * 100).toFixed(1)}%) running perfectly
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="bg-[#A2B9AF]/20 p-4 rounded-full">
                  <CheckCircle className="h-12 w-12 text-[#4F6A64]" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-[#4F6A64] mb-2">Excellent Performance!</h3>
              <p className="text-[#4F6A64] mb-4">
                All {totalMachines} machines are operating optimally with no incidents reported in the selected period.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-[#A2B9AF]/10 rounded-lg">
                  <p className="text-2xl font-bold text-[#4F6A64]">{totalMachines}</p>
                  <p className="text-sm text-[#4F6A64]">Total Machines</p>
                </div>
                <div className="p-4 bg-[#96AEC2]/10 rounded-lg">
                  <p className="text-2xl font-bold text-[#546A7A]">0</p>
                  <p className="text-sm text-[#546A7A]">Incidents</p>
                </div>
                <div className="p-4 bg-[#6F8A9D]/10 rounded-lg">
                  <p className="text-2xl font-bold text-[#546A7A]">100%</p>
                  <p className="text-sm text-[#546A7A]">Uptime</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
