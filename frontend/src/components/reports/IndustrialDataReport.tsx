// Server-side component - charts replaced with static summaries

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ReportData } from './types';

interface IndustrialDataReportProps {
  reportData: ReportData;
}

export function IndustrialDataReport({ reportData }: IndustrialDataReportProps) {
  if (!reportData) return null;

  // Group machines by customer for customer-wise display
  const machinesByCustomer = reportData.machineDowntime?.reduce((acc: any, machine: any) => {
    const customerName = machine.customer || 'Unknown Customer';
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(machine);
    return acc;
  }, {}) || {};

  const customerNames = Object.keys(machinesByCustomer).sort();
  
  return (
    <div className="space-y-6">
      {/* Machine Downtime Summary - Always show summary cards */}
      <Card>
          <CardHeader>
            <CardTitle>Machine Downtime Summary</CardTitle>
            <CardDescription>Overview of machine downtime metrics grouped by customer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#546A7A]">
                    {reportData.summary?.totalMachinesWithDowntime || 0}
                  </div>
                  <div className="text-sm text-[#546A7A]">Total Machines</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#4F6A64]">
                    {Math.round(reportData.summary?.totalDowntimeHours * 10) / 10 || 0} hrs
                  </div>
                  <div className="text-sm text-[#4F6A64]">Total Downtime</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-[#EEC1BF]/10 to-[#EEC1BF]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#976E44]">
                    {reportData.summary?.averageDowntimePerMachine?.toFixed(1) || '0.0'} hrs
                  </div>
                  <div className="text-sm text-[#976E44]">Avg. Downtime/Machine</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-[#546A7A]">
                    {customerNames.length}
                  </div>
                  <div className="text-sm text-[#546A7A]">Customers Affected</div>
                </CardContent>
              </Card>
            </div>
            
            {/* Customer-wise Machine Downtime - Only show if there's data */}
            {reportData.machineDowntime && reportData.machineDowntime.length > 0 ? (
              <div className="mt-6 space-y-6">
                <h3 className="text-lg font-medium">Machine Downtime by Customer</h3>
                
                {customerNames.map((customerName) => {
                const customerMachines = machinesByCustomer[customerName];
                const totalCustomerDowntime = customerMachines.reduce((sum: number, machine: any) => 
                  sum + (machine.totalDowntimeMinutes || 0), 0
                );
                const totalCustomerIncidents = customerMachines.reduce((sum: number, machine: any) => 
                  sum + (machine.incidents || 0), 0
                );

                return (
                  <Card key={customerName} className="border-l-4 border-l-[#6F8A9D]">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <CardTitle className="text-lg">{customerName}</CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-[#96AEC2]/20 text-[#546A7A]">
                            {customerMachines.length} Machine{customerMachines.length !== 1 ? 's' : ''}
                          </Badge>
                          <Badge variant="secondary" className="bg-[#CE9F6B]/20 text-[#976E44]">
                            {(totalCustomerDowntime / 60).toFixed(1)} hrs downtime
                          </Badge>
                          <Badge variant="secondary" className="bg-[#E17F70]/20 text-[#75242D]">
                            {totalCustomerIncidents} incident{totalCustomerIncidents !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-white z-10">
                              <TableRow>
                                <TableHead className="min-w-[100px]">Model</TableHead>
                                <TableHead className="min-w-[120px]">Serial Number</TableHead>
                                <TableHead className="min-w-[120px]">Total Downtime</TableHead>
                                <TableHead className="min-w-[80px]">Incidents</TableHead>
                                <TableHead className="min-w-[120px]">MTTR</TableHead>
                                <TableHead className="min-w-[80px]">Open</TableHead>
                                <TableHead className="min-w-[80px]">Resolved</TableHead>
                                <TableHead className="min-w-[100px]">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {customerMachines.map((machine: any, index: number) => (
                                <TableRow key={`${machine.machineId || machine.serialNo}-${index}`}>
                                  <TableCell>
                                    {machine.model || 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-mono text-sm">
                                      {machine.serialNo || 'N/A'}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {(machine.totalDowntimeMinutes / 60).toFixed(1)} hrs
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {machine.totalDowntimeMinutes} min
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="bg-[#AEBFC3]/10">
                                      {machine.incidents || 0}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium text-[#976E44]">
                                        {machine.incidents > 0 ? ((machine.totalDowntimeMinutes / machine.incidents) / 60).toFixed(1) : '0.0'} hrs
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {machine.incidents > 0 ? Math.round(machine.totalDowntimeMinutes / machine.incidents) : 0} min/incident
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="destructive" className={machine.openIncidents > 0 ? '' : 'bg-[#92A2A5]/30 text-[#5D6E73]'}>
                                      {machine.openIncidents || 0}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="default" className="bg-[#A2B9AF]/20 text-[#4F6A64]">
                                      {machine.resolvedIncidents || 0}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {(machine.incidents || 0) <= 1 ? (
                                      <Badge className="bg-[#A2B9AF]/20 text-[#4F6A64] border border-[#A2B9AF]/40">
                                        GOOD
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-[#EEC1BF]/20 text-[#9E3B47] border border-[#EEC1BF]/40">
                                        NEED ATTENTION
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
                })}
              </div>
            ) : (
              <div className="mt-6 text-center py-8">
                <div className="text-[#4F6A64] mb-2">
                  <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-[#4F6A64] mb-1">Excellent Performance!</h3>
                <p className="text-[#4F6A64] text-sm">
                  No machine downtime incidents found for the selected period. All machines are operating optimally.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

    </div>
  );
}
