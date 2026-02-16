'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Clock,
  MapPin,
  CheckCircle,
  LogIn,
  LogOut,
  Loader2,
  AlertCircle,
  RotateCcw,
  Navigation,
  X
} from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';
import EnhancedLocationCapture from '@/components/activity/EnhancedLocationCapture';
import { LocationData as EnhancedLocationData } from '@/hooks/useEnhancedLocation';

export interface AttendanceData {
  isCheckedIn: boolean;
  attendance?: {
    id: number;
    checkInAt: string;
    checkOutAt?: string;
    checkInAddress?: string;
    checkOutAddress?: string;
    totalHours?: number;
    status: 'CHECKED_IN' | 'CHECKED_OUT' | 'EARLY_CHECKOUT';
  };
}

interface AttendanceStats {
  totalHours: number;
  avgHoursPerDay: number;
  totalDaysWorked: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
  timestamp: string;
}

// Enhanced location data from our new system
interface AttendanceLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  timestamp: number;
  source: 'gps' | 'manual' | 'network';
}

interface CleanAttendanceWidgetProps {
  onStatusChange?: (data?: AttendanceData) => void;
  initialData?: AttendanceData;
}

interface LocationCaptureState {
  isCapturing: boolean;
  capturedLocation: LocationData | null;
  error: string | null;
}

interface EnhancedLocationCaptureState {
  isCapturing: boolean;
  capturedLocation: AttendanceLocationData | null;
  error: string | null;
  showLocationCapture: boolean;
}

export default function CleanAttendanceWidget({
  onStatusChange,
  initialData
}: CleanAttendanceWidgetProps) {
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(initialData || null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEarlyCheckoutConfirm, setShowEarlyCheckoutConfirm] = useState(false);
  const [earlyCheckoutData, setEarlyCheckoutData] = useState<any>(null);
  const [locationState, setLocationState] = useState<LocationCaptureState>({
    isCapturing: false,
    capturedLocation: null,
    error: null
  });

  // Enhanced location state
  const [enhancedLocationState, setEnhancedLocationState] = useState<EnhancedLocationCaptureState>({
    isCapturing: false,
    capturedLocation: null,
    error: null,
    showLocationCapture: false
  });

  const [lastKnownLocation, setLastKnownLocation] = useState<AttendanceLocationData | null>(null);
  const { toast } = useToast();

  // Fetch attendance status
  const fetchAttendanceStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/attendance/status');
      const data = response.data || response;
      setAttendanceData(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch attendance status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch attendance stats
  const fetchAttendanceStats = useCallback(async () => {
    try {
      const response = await apiClient.get('/attendance/stats');
      const data = response.data || response;
      setStats(data);
    } catch (error) {
    }
  }, []);

  // Initialize data
  useEffect(() => {
    if (!initialData) {
      fetchAttendanceStatus();
    }
    fetchAttendanceStats();
  }, [initialData, fetchAttendanceStatus, fetchAttendanceStats]);

  // Update when initial data changes
  useEffect(() => {
    if (initialData) {
      setAttendanceData(initialData);
    }
  }, [initialData]);

  // Enhanced location capture handler
  const handleEnhancedLocationCapture = (location: EnhancedLocationData) => {
    const attendanceLocation: AttendanceLocationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      address: location.address,
      timestamp: location.timestamp,
      source: location.source === 'network' ? 'gps' : location.source
    };

    setEnhancedLocationState(prev => ({
      ...prev,
      capturedLocation: attendanceLocation,
      error: null,
      showLocationCapture: false
    }));

    setLastKnownLocation(attendanceLocation);
  };

  // Legacy location capture (keeping for backward compatibility)
  const getCurrentLocation = async (): Promise<LocationData> => {
    setLocationState({
      isCapturing: true,
      capturedLocation: null,
      error: null
    });

    try {
      // Take multiple GPS readings to handle intermittent issues
      const readings: LocationData[] = [];
      const maxReadings = 3;
      const readingDelay = 2000; // 2 seconds between readings

      for (let i = 0; i < maxReadings; i++) {
        try {
          const reading = await getSingleLocationReading();
          readings.push(reading);

          // If we get a very accurate reading early, we can use it
          if (reading.accuracy <= 50 && i > 0) {
            break;
          }

          // Wait before next reading (except for last one)
          if (i < maxReadings - 1) {
            await new Promise(resolve => setTimeout(resolve, readingDelay));
          }
        } catch (error) {
        }
      }

      if (readings.length === 0) {
        throw new Error('All GPS readings failed');
      }

      const bestReading = selectBestLocationReading(readings);

      setLocationState({
        isCapturing: false,
        capturedLocation: bestReading,
        error: null
      });

      return bestReading;

    } catch (error: any) {
      setLocationState({
        isCapturing: false,
        capturedLocation: null,
        error: error.message || 'Failed to get consistent GPS location'
      });
      throw error;
    }
  };

  const selectBestLocationReading = (readings: LocationData[]): LocationData => {
    if (readings.length === 1) return readings[0];
    const excellentReadings = readings.filter(r => r.accuracy <= 50);
    if (excellentReadings.length > 0) {
      return excellentReadings.reduce((best, current) => current.accuracy < best.accuracy ? current : best);
    }
    const consistentReadings = findConsistentReadings(readings);
    if (consistentReadings.length > 0) {
      return consistentReadings.reduce((best, current) => current.accuracy < best.accuracy ? current : best);
    }
    return readings.reduce((best, current) => current.accuracy < best.accuracy ? current : best);
  };

  const findConsistentReadings = (readings: LocationData[]): LocationData[] => {
    if (readings.length < 2) return readings;
    const CONSISTENCY_THRESHOLD = 500;
    const consistent: LocationData[] = [];
    for (let i = 0; i < readings.length; i++) {
      let consistentCount = 1;
      for (let j = 0; j < readings.length; j++) {
        if (i !== j) {
          const distance = calculateDistance(readings[i].latitude, readings[i].longitude, readings[j].latitude, readings[j].longitude);
          if (distance <= CONSISTENCY_THRESHOLD) consistentCount++;
        }
      }
      if (consistentCount > 1) consistent.push(readings[i]);
    }
    return consistent;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getSingleLocationReading = async (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by this browser';
        setLocationState({ isCapturing: false, capturedLocation: null, error });
        reject(new Error(error));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          if (accuracy > 100) {
            setLocationState(prev => ({ ...prev, error: `Poor GPS signal (±${Math.round(accuracy)}m).` }));
          }
          let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          try {
            const response = await apiClient.get(`/geocoding/reverse?latitude=${latitude}&longitude=${longitude}`);
            if (response.data?.address) address = response.data.address;
            else if (response.data?.success && response.data?.data?.address) address = response.data.data.address;
          } catch (error) { }
          const locationData = { latitude, longitude, accuracy, address, timestamp: new Date().toISOString() };
          setLocationState({ isCapturing: false, capturedLocation: locationData, error: null });
          resolve(locationData);
        },
        (error) => {
          const errorMessage = `Location error: ${error.message}`;
          setLocationState({ isCapturing: false, capturedLocation: null, error: errorMessage });
          reject(new Error(errorMessage));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!enhancedLocationState.capturedLocation) {
      setEnhancedLocationState(prev => ({ ...prev, showLocationCapture: true, error: null }));
      toast({ title: "Location Required", description: "Please capture your location for check-in.", variant: "destructive" });
      return;
    }
    const location = enhancedLocationState.capturedLocation;
    if (location.source === 'gps' && location.accuracy > 2000) {
      toast({ title: "GPS Accuracy Too Poor", description: `GPS accuracy is ±${Math.round(location.accuracy)}m (requires ≤2000m).`, variant: "destructive" });
      setEnhancedLocationState(prev => ({ ...prev, showLocationCapture: true }));
      return;
    }

    setActionLoading(true);
    try {
      const checkInData = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        accuracy: location.accuracy,
        locationSource: location.source,
        timestamp: new Date(location.timestamp).toISOString()
      };

      const response = await apiClient.post('/attendance/checkin', checkInData);
      const result = (response.data || response) as any;
      const newData: AttendanceData = {
        isCheckedIn: true,
        attendance: result.attendance ? {
          id: result.attendance.id,
          checkInAt: result.attendance.checkInAt,
          checkInAddress: result.attendance.checkInAddress || location.address,
          status: 'CHECKED_IN'
        } : {
          id: 0,
          checkInAt: new Date().toISOString(),
          checkInAddress: location.address,
          status: 'CHECKED_IN'
        }
      };

      setAttendanceData(newData);
      if (onStatusChange) onStatusChange(newData);

      setActionLoading(false);
      setEnhancedLocationState({ isCapturing: false, capturedLocation: null, error: null, showLocationCapture: false });
      fetchAttendanceStats().catch(() => { });
    } catch (error: any) {
      setActionLoading(false);
      let errorMessage = 'Failed to check in. Please try again.';
      if (error.response?.data?.message) errorMessage = error.response.data.message;
      else if (error.response?.status === 400) errorMessage = 'Invalid location data.';
      toast({ title: 'Check-in Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLegacyCheckIn = async () => {
    setActionLoading(true);
    try {
      const location = await getCurrentLocation();
      const response = await apiClient.post('/attendance/checkin', {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
      });
      const result = response.data || response;
      const newData: AttendanceData = {
        isCheckedIn: true,
        attendance: result.attendance ? {
          id: result.attendance.id,
          checkInAt: result.attendance.checkInAt,
          checkInAddress: result.attendance.checkInAddress || location.address,
          status: 'CHECKED_IN'
        } : {
          id: 0,
          checkInAt: new Date().toISOString(),
          checkInAddress: location.address,
          status: 'CHECKED_IN'
        }
      };
      setAttendanceData(newData);
      if (onStatusChange) onStatusChange(newData);
      await fetchAttendanceStatus();
      await fetchAttendanceStats();
    } catch (error: any) {
      if (error.response?.status === 400 &&
        (error.response?.data?.error === 'Already checked in' ||
          error.response?.data?.message?.includes('already checked in'))) {
        toast({ title: 'Already Checked In', description: 'Refreshing status...', variant: 'destructive' });
        await fetchAttendanceStatus();
      } else {
        toast({ title: 'Check-in Failed', description: error.response?.data?.message || 'Failed to check in', variant: 'destructive' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!attendanceData?.isCheckedIn || !attendanceData?.attendance?.id) {
      toast({ title: "Cannot Check Out", description: "You are not currently checked in.", variant: "destructive" });
      await fetchAttendanceStatus();
      return;
    }
    if (!enhancedLocationState.capturedLocation) {
      setEnhancedLocationState(prev => ({ ...prev, showLocationCapture: true, error: null }));
      toast({ title: "Location Required", description: "Please capture location.", variant: "destructive" });
      return;
    }
    const location = enhancedLocationState.capturedLocation;
    if (location.source === 'gps' && location.accuracy > 2000) {
      toast({ title: "GPS Accuracy Too Poor", description: "GPS Accuracy Too Poor", variant: "destructive" });
      setEnhancedLocationState(prev => ({ ...prev, showLocationCapture: true }));
      return;
    }
    const checkOutData = {
      attendanceId: attendanceData.attendance.id,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
      locationSource: location.source
    };
    setActionLoading(true);
    try {
      const response = await apiClient.post('/attendance/checkout', checkOutData);
      const result = (response.data || response) as any;
      const newData: AttendanceData = {
        isCheckedIn: false,
        attendance: result.attendance
      };
      setAttendanceData(newData);
      if (onStatusChange) onStatusChange(newData);
      setActionLoading(false);
      setEnhancedLocationState({ isCapturing: false, capturedLocation: null, error: null, showLocationCapture: false });
      fetchAttendanceStats().catch(() => { });
    } catch (error: any) {
      setActionLoading(false);
      if (error.response?.status === 400 && error.response.data?.requiresConfirmation) {
        setEarlyCheckoutData({ location, confirmationData: error.response.data });
        setShowEarlyCheckoutConfirm(true);
        setActionLoading(false);
        return;
      }
      toast({ title: 'Check-out Failed', description: error.response?.data?.message || 'Failed to check out', variant: 'destructive' });
      setActionLoading(false);
    }
  };

  const handleReCheckIn = async () => {
    if (!enhancedLocationState.capturedLocation) {
      setEnhancedLocationState(prev => ({ ...prev, showLocationCapture: true, error: null }));
      toast({ title: "Location Required", description: "Please capture location.", variant: "destructive" });
      return;
    }
    const location = enhancedLocationState.capturedLocation;
    if (location.source === 'gps' && location.accuracy > 2000) {
      toast({ title: "GPS Accuracy Too Poor", description: "GPS Accuracy Too Poor", variant: "destructive" });
      setEnhancedLocationState(prev => ({ ...prev, showLocationCapture: true }));
      return;
    }
    setActionLoading(true);
    try {
      const reCheckInData = {
        attendanceId: attendanceData?.attendance?.id,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        accuracy: location.accuracy,
        locationSource: location.source,
        timestamp: new Date(location.timestamp).toISOString()
      };
      const response = await apiClient.post('/attendance/re-checkin', reCheckInData);
      const result = response.data || response;
      const newData: AttendanceData = {
        isCheckedIn: true,
        attendance: result.attendance ? {
          id: result.attendance.id,
          checkInAt: result.attendance.checkInAt,
          checkInAddress: result.attendance.checkInAddress || location.address,
          status: 'CHECKED_IN'
        } : {
          id: 0,
          checkInAt: new Date().toISOString(),
          checkInAddress: location.address,
          status: 'CHECKED_IN'
        }
      };
      setAttendanceData(newData);
      if (onStatusChange) onStatusChange(newData);
      setActionLoading(false);
      setEnhancedLocationState({ isCapturing: false, capturedLocation: null, error: null, showLocationCapture: false });
      fetchAttendanceStats().catch(() => { });
    } catch (error: any) {
      setActionLoading(false);
      toast({ title: 'Re-Check-in Failed', description: error.response?.data?.message || 'Failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEarlyCheckoutConfirm = async (confirmed: boolean) => {
    setShowEarlyCheckoutConfirm(false);
    if (!confirmed || !earlyCheckoutData) {
      setEarlyCheckoutData(null);
      setActionLoading(false);
      return;
    }
    setActionLoading(true);
    try {
      const { location } = earlyCheckoutData;
      const response = await apiClient.post('/attendance/checkout', {
        attendanceId: attendanceData?.attendance?.id,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        locationSource: location.source,
        confirmEarlyCheckout: true
      });
      const result = response.data || response;
      const newData: AttendanceData = {
        isCheckedIn: false,
        attendance: result.attendance
      };
      setAttendanceData(newData);
      if (onStatusChange) onStatusChange(newData);
      setEnhancedLocationState({ isCapturing: false, capturedLocation: null, error: null, showLocationCapture: false });
      fetchAttendanceStatus();
      fetchAttendanceStats();
    } catch (error: any) {
      toast({ title: 'Check-out Failed', description: error.response?.data?.message || 'Failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setEarlyCheckoutData(null);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatHours = (hours: string | number | undefined, decimals: number = 2): string => {
    if (!hours) return '0';
    const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
    return isNaN(numHours) ? '0' : numHours.toFixed(decimals);
  };

  const renderActionButton = () => {
    if (loading || !attendanceData) {
      return (
        <Button disabled className="w-full h-12 rounded-xl text-sm font-semibold bg-[#AEBFC3]/20 text-[#979796]">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Loading...
        </Button>
      );
    }
    const isCheckedIn = attendanceData.isCheckedIn;
    const hasAttendanceToday = attendanceData.attendance && (attendanceData.attendance.status === 'CHECKED_OUT' || attendanceData.attendance.status === 'EARLY_CHECKOUT');

    if (isCheckedIn) {
      return (
        <Button onClick={handleCheckOut} disabled={actionLoading} className="w-full h-14 min-h-[56px] bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform">
          {actionLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogOut className="w-5 h-5 mr-2" />}
          {actionLoading ? 'Checking Out...' : 'Check Out'}
        </Button>
      );
    } else if (hasAttendanceToday) {
      return (
        <div className="space-y-3">
          <div className="text-center text-xs text-[#546A7A] font-semibold bg-[#96AEC2]/10 py-2.5 px-4 rounded-xl border border-[#96AEC2]">
            Checked out today • Tap to resume work
          </div>
          <Button onClick={handleReCheckIn} disabled={actionLoading} className="w-full h-14 min-h-[56px] bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform">
            {actionLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogIn className="w-5 h-5 mr-2" />}
            {actionLoading ? 'Re-Checking In...' : 'Re-Check In'}
          </Button>
        </div>
      );
    } else {
      return (
        <Button onClick={handleCheckIn} disabled={actionLoading} className="w-full h-14 min-h-[56px] bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform">
          {actionLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogIn className="w-5 h-5 mr-2" />}
          {actionLoading ? 'Checking In...' : 'Check In'}
        </Button>
      );
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-[#AEBFC3]/30">
      {/* Premium Header with decorative elements */}
      <div className="relative bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] p-6 text-white overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/8 rounded-full blur-xl"></div>
          <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/5 rounded-full blur-lg"></div>
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg shadow-black/10">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter leading-none">Attendance</h2>
                <div className="flex flex-col">
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mt-1">Operational Telemetry</p>
                  {attendanceData?.attendance && (
                    <p className="text-white/40 text-[9px] font-bold truncate max-w-[150px] mt-0.5 flex items-center gap-1">
                      <div className={`w-1 h-1 rounded-full ${attendanceData.isCheckedIn ? 'bg-[#A2B9AF]' : 'bg-[#E17F70]'}`}></div>
                      {attendanceData.isCheckedIn
                        ? (attendanceData.attendance.checkInAddress || 'Checked In')
                        : (attendanceData.attendance.checkOutAddress || 'Checked Out')}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className={`px-5 py-2.5 rounded-2xl border-2 backdrop-blur-xl font-black text-[10px] uppercase tracking-widest transition-all ${attendanceData?.isCheckedIn
              ? 'bg-[#82A094]/30 border-[#A2B9AF]/60 text-white shadow-2xl animate-pulse'
              : 'bg-white/10 border-white/40 text-white/90 shadow-xl'
              }`}>
              <span className="flex items-center gap-2">
                {attendanceData?.isCheckedIn ? 'Status: Active' : 'Status: Off Duty'}
              </span>
            </div>
          </div>

          {/* Check-in time display */}
          {attendanceData?.attendance?.checkInAt && (
            <div className="mt-5 pt-4 border-t border-white/20">
              <div className="bg-white/15 backdrop-blur-md p-5 rounded-2xl border border-white/20 shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Check-in Details */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">Shift Commencement</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-3xl font-black tracking-tighter">{formatTime(attendanceData.attendance.checkInAt)}</p>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">In</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/10 border border-white/10 group hover:bg-white/20 transition-all duration-300">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-white/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Check-in Location</p>
                        <p className="text-[11px] text-white/90 leading-tight font-medium break-words">
                          {attendanceData.attendance.checkInAddress || 'Address not captured'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Check-out Details (Only shown if checked out) */}
                  {attendanceData.attendance.checkOutAt && (
                    <div className="space-y-3 pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-white/10 md:pl-6">
                      <div>
                        <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">Shift Conclusion</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <p className="text-3xl font-black tracking-tighter tracking-tighter text-[#E17F70]">{formatTime(attendanceData.attendance.checkOutAt)}</p>
                          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Out</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E17F70]/10 border border-[#E17F70]/20 group hover:bg-[#E17F70]/20 transition-all duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[#E17F70]/20 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-[#E17F70]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-black text-[#E17F70]/60 uppercase tracking-widest mb-0.5">Check-out Location</p>
                          <p className="text-[11px] text-white/90 leading-tight font-medium break-words">
                            {attendanceData.attendance.checkOutAddress || 'Address not captured'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Duration/Total Hours Banner (if checked out) */}
                {attendanceData.attendance.checkOutAt && attendanceData.attendance.totalHours && (
                  <div className="mt-5 flex items-center justify-center border-t border-white/10 pt-4">
                    <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-3">
                      <Clock className="w-4 h-4 text-white/40" />
                      <p className="text-xs font-black uppercase tracking-widest text-white/60">
                        Total Shift Duration: <span className="text-white text-sm ml-1">{formatHours(attendanceData.attendance.totalHours)} hrs</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-6">
        {enhancedLocationState.showLocationCapture && (
          <div className="mb-4 p-4 bg-[#96AEC2]/10 border border-[#96AEC2]/30 rounded-2xl">
            <EnhancedLocationCapture
              onLocationCapture={handleEnhancedLocationCapture}
              required={true}
              enableJumpDetection={true}
              autoCapture={true}
            />
          </div>
        )}

        {/* Captured Location Preview */}
        {enhancedLocationState.capturedLocation && !enhancedLocationState.showLocationCapture && (
          <div className="mb-4 bg-gradient-to-br from-[#A2B9AF]/15 to-[#82A094]/10 border-2 border-[#82A094]/40 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-[#82A094]/30">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-[#546A7A] uppercase tracking-widest flex items-center gap-2">
                    Security Telemetry Validated
                    <div className="w-4 h-4 rounded-full bg-[#82A094] flex items-center justify-center">
                      <CheckCircle className="w-2.5 h-2.5 text-white" />
                    </div>
                  </p>
                  <p className="text-xs text-[#5D6E73] mt-1 line-clamp-2 leading-relaxed pr-2">
                    {enhancedLocationState.capturedLocation.address || `${enhancedLocationState.capturedLocation.latitude.toFixed(6)}, ${enhancedLocationState.capturedLocation.longitude.toFixed(6)}`}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-[10px] bg-white/70 px-2.5 py-1 rounded-full text-[#5D6E73] font-semibold border border-[#AEBFC3]/30">
                      Accuracy: ±{Math.round(enhancedLocationState.capturedLocation.accuracy)}m
                    </span>
                    <span className="text-[10px] bg-white/70 px-2.5 py-1 rounded-full text-[#5D6E73] font-semibold border border-[#AEBFC3]/30">
                      Source: {enhancedLocationState.capturedLocation.source?.toUpperCase() || 'GPS'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 ml-2">
                {/* Recapture button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEnhancedLocationState(prev => ({ ...prev, showLocationCapture: true }));
                    toast({
                      title: "Recapture Location",
                      description: "Capturing a new location..."
                    });
                  }}
                  className="h-10 w-10 min-h-[44px] min-w-[44px] text-[#6F8A9D] hover:bg-[#96AEC2]/20 rounded-xl transition-colors"
                  title="Recapture location"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                {/* Clear button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEnhancedLocationState(prev => ({
                      ...prev,
                      capturedLocation: null,
                      showLocationCapture: false
                    }));
                    setLastKnownLocation(null);
                    toast({
                      title: "Location Cleared",
                      description: "Please capture location again before check-in/out.",
                      variant: "destructive"
                    });
                  }}
                  className="h-10 w-10 min-h-[44px] min-w-[44px] text-[#E17F70] hover:bg-[#E17F70]/10 rounded-xl transition-colors"
                  title="Clear location"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {renderActionButton()}
        <Button
          variant="ghost"
          onClick={() => { fetchAttendanceStatus(); fetchAttendanceStats(); }}
          className="w-full mt-4 text-[#5D6E73] hover:bg-[#AEBFC3]/15 rounded-xl h-11 border border-transparent hover:border-[#AEBFC3]/30 transition-all"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Refresh Status
        </Button>
      </div>

      {showEarlyCheckoutConfirm && earlyCheckoutData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl border border-[#AEBFC3]/30">
            <div className="w-14 h-14 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#CE9F6B]/30">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[#546A7A] text-center">Confirm Early Checkout</h3>
            <p className="text-[#5D6E73] mb-6 text-center text-sm">{earlyCheckoutData.confirmationData.message}</p>
            <div className="flex gap-3">
              <Button onClick={() => handleEarlyCheckoutConfirm(false)} variant="outline" className="flex-1 h-12 rounded-xl border-2 border-[#AEBFC3] hover:bg-[#AEBFC3]/10 font-semibold">Cancel</Button>
              <Button onClick={() => handleEarlyCheckoutConfirm(true)} className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#CE9F6B] to-[#976E44] hover:from-[#976E44] hover:to-[#976E44] font-semibold shadow-lg shadow-[#CE9F6B]/30">Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
