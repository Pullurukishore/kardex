'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Clock,
  Users,
  MapPin,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';

interface AttendanceRecord {
  id: number;
  checkInAt: string;
  checkOutAt?: string;
  checkInAddress?: string;
  checkOutAddress?: string;
  totalHours?: number;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | 'EARLY_CHECKOUT';
  notes?: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    serviceZones?: Array<{
      serviceZone: {
        id: number;
        name: string;
      };
    }>;
  };
}

interface LiveTrackingData {
  liveTracking: AttendanceRecord[];
  totalActive: number;
  lastUpdated: string;
}

const STATUS_CONFIG = {
  CHECKED_IN: { label: 'Checked In', color: 'bg-[#A2B9AF]/20 text-[#4F6A64]', icon: CheckCircle },
  CHECKED_OUT: { label: 'Checked Out', color: 'bg-[#AEBFC3]/20 text-[#546A7A]', icon: XCircle },
  EARLY_CHECKOUT: { label: 'Early Checkout', color: 'bg-[#CE9F6B]/20 text-[#976E44]', icon: AlertTriangle },
};

export function AttendanceDashboard() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [liveTracking, setLiveTracking] = useState<LiveTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    zoneId: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAttendanceData();
    loadLiveTracking();
    
    // Set up auto-refresh for live tracking every 30 seconds
    const interval = setInterval(() => {
      loadLiveTracking();
    }, 30000);

    return () => clearInterval(interval);
  }, [filters, pagination.page]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      };

      const response = await apiClient.get('/attendance/all', { params });
      setAttendanceRecords(response.data.attendance);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination,
      }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load attendance data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLiveTracking = async () => {
    try {
      setRefreshing(true);
      const response = await apiClient.get('/attendance/live-tracking');
      setLiveTracking(response.data);
    } catch (error) {
      } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: '',
      zoneId: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && attendanceRecords.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#546A7A]">Attendance Dashboard</h1>
          <p className="text-[#5D6E73] mt-1">Monitor and manage team attendance</p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={loadLiveTracking} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Live Tracking Summary */}
      {liveTracking && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Currently Active</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#4F6A64]">{liveTracking.totalActive}</div>
              <p className="text-xs text-muted-foreground">
                Service persons checked in
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
              <p className="text-xs text-muted-foreground">
                Attendance records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {new Date(liveTracking.lastUpdated).toLocaleTimeString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Live tracking data
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                  <SelectItem value="CHECKED_OUT">Checked Out</SelectItem>
                  <SelectItem value="EARLY_CHECKOUT">Early Checkout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={clearFilters} variant="outline" className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Tracking */}
      {liveTracking && liveTracking.liveTracking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Live Tracking - Currently Active
            </CardTitle>
            <CardDescription>
              Service persons currently checked in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {liveTracking.liveTracking.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg bg-[#A2B9AF]/10">
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 bg-[#A2B9AF]/100 rounded-full animate-pulse"></div>
                    <div>
                      <h4 className="font-medium">{record.user.name}</h4>
                      <p className="text-sm text-[#5D6E73]">{record.user.email}</p>
                      {record.user.serviceZones && record.user.serviceZones.length > 0 && (
                        <p className="text-xs text-[#AEBFC3]0">
                          Zone: {record.user.serviceZones[0].serviceZone.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      Since {new Date(record.checkInAt).toLocaleTimeString()}
                    </p>
                    {record.checkInAddress && (
                      <p className="text-xs text-[#AEBFC3]0 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {record.checkInAddress}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Records
          </CardTitle>
          <CardDescription>
            Complete attendance history with filtering options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {attendanceRecords.map((record) => {
              const StatusIcon = STATUS_CONFIG[record.status].icon;
              return (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#AEBFC3]/10">
                  <div className="flex items-center space-x-4">
                    <StatusIcon className="h-5 w-5 text-[#AEBFC3]0" />
                    <div>
                      <h4 className="font-medium">{record.user.name}</h4>
                      <p className="text-sm text-[#5D6E73]">{record.user.email}</p>
                      {record.user.serviceZones && record.user.serviceZones.length > 0 && (
                        <p className="text-xs text-[#AEBFC3]0">
                          Zone: {record.user.serviceZones[0].serviceZone.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <Badge className={STATUS_CONFIG[record.status].color}>
                      {STATUS_CONFIG[record.status].label}
                    </Badge>
                    <p className="text-xs text-[#AEBFC3]0 mt-1">
                      {formatDateTime(record.checkInAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    {record.totalHours && (
                      <p className="text-sm font-medium">
                        {formatDuration(record.totalHours)}
                      </p>
                    )}
                    {record.checkOutAt && (
                      <p className="text-xs text-[#AEBFC3]0">
                        Out: {new Date(record.checkOutAt).toLocaleTimeString()}
                      </p>
                    )}
                    {record.checkInAddress && (
                      <p className="text-xs text-[#AEBFC3]0 flex items-center justify-end mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        Location tracked
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-[#5D6E73]">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
              </p>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
