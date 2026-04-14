'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, FileText, Download, FileDown, BarChart3, Info, Trophy, CheckCircle2, DollarSign, Package, Percent, Award } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { UserRole } from '@/types/user.types';
import type { ReportFilters, ReportData, ReportType } from '@/types/reports';
import { REPORT_TYPES, TICKET_REPORT_TYPES, SALES_REPORT_TYPES } from '@/types/reports';
import dynamic from 'next/dynamic';

const ReportsTable = dynamic(() => import('./ReportsTable'), {
  loading: () => <div className="p-4 animate-pulse bg-gray-50 rounded-lg h-32" />,
  ssr: false
});

const OfferDetailsDialog = dynamic(() => import('./OfferDetailsDialog'), {
  ssr: false
});

const ZoneTargetDetailsDialog = dynamic(() => import('./ZoneTargetDetailsDialog'), {
  ssr: false
});

const UserTargetDetailsDialog = dynamic(() => import('./UserTargetDetailsDialog'), {
  ssr: false
});

import ReportsFilters from './ReportsFilters';
// Dynamic imports for heavy report components (lazy loaded for better performance)
import {
  DynamicAdvancedTicketSummaryReport as AdvancedTicketSummaryReport,

  DynamicAdvancedMachineAnalyticsReport as AdvancedMachineAnalyticsReport,
  DynamicAdvancedZonePerformanceReport as AdvancedZonePerformanceReport,
  DynamicServicePersonPerformanceReport as ServicePersonPerformanceReport,
  DynamicServicePersonAttendanceReport as ServicePersonAttendanceReport,
  DynamicProductTypeAnalysisReport as ProductTypeAnalysisReport,
  DynamicCustomerPerformanceReport as CustomerPerformanceReport,
  DynamicTargetReportAnalytics as TargetReportAnalytics,
} from './DynamicReportComponents';
import ReportErrorBoundary from './ReportErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Target, TrendingUp, TrendingDown, Users, MapPin, Eye } from 'lucide-react';
 
import { formatCrLakh, formatINRFull } from '@/lib/format';

interface Offer {
  id: number;
  offerReferenceNumber: string;
  offerReferenceDate: string | null;
  title: string | null;
  description: string | null;
  productType: string | null;
  lead: string | null;
  company: string | null;
  location: string | null;
  department: string | null;
  registrationDate: string | null;
  contactPersonName: string | null;
  contactNumber: string | null;
  email: string | null;
  machineSerialNumber: string | null;
  status: string;
  stage: string;
  priority: string;
  offerValue: number | null;
  offerMonth: string | null;
  poExpectedMonth: string | null;
  probabilityPercentage: number | null;
  poNumber: string | null;
  poDate: string | null;
  poValue: number | null;
  poReceivedMonth: string | null;
  openFunnel: boolean;
  remarks: string | null;
  bookingDateInSap: string | null;
  offerEnteredInCrm: string | null;
  offerClosedInCrm: string | null;
  customer: {
    id: number;
    companyName: string;
    location: string | null;
    department: string | null;
  };
  contact?: {
    id: number;
    contactPersonName: string;
    contactNumber: string | null;
    email: string | null;
  } | null;
  zone: {
    id: number;
    name: string;
    shortForm: string;
  };
  assignedTo: {
    id: number;
    name: string;
    email: string;
  } | null;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
  updatedBy: {
    id: number;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ReportsClientProps {
  initialFilters: ReportFilters;
  initialReportData: ReportData | null;
  zones: Array<{ id: number; name: string }>;
  customers: Array<{ id: number; companyName: string }>;
  isZoneUser: boolean;
  reportTypes?: ReportType[]; // Allow custom report types
}

const ReportsClient: React.FC<ReportsClientProps> = ({
  initialFilters,
  initialReportData,
  zones: initialZones,
  customers: initialCustomers,
  isZoneUser,
  reportTypes = REPORT_TYPES,
}) => {
  // State for zones and customers (fetched client-side)
  const [zones, setZones] = useState<Array<{ id: number; name: string }>>(initialZones || []);
  const [customers, setCustomers] = useState<Array<{ id: number; companyName: string }>>(initialCustomers || []);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Local KPICard component for better organization and reuse
  const KPICard = ({ title, value, subtitle, icon: Icon, color, trend, valueTitle }: {
    title: string; value: string | number; subtitle?: React.ReactNode;
    icon: React.ElementType; color: string; trend?: number | null; valueTitle?: string;
  }) => (
    <div className="relative overflow-hidden rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[60px] opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white" title={valueTitle}>{value}</p>
          {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>}
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {Math.abs(trend).toFixed(1)}% vs prev
        </div>
      )}
    </div>
  );

  // Fetch zones and customers on mount
  useEffect(() => {
    // Skip if already fetched (React Strict Mode protection)
    if (hasInitialCustomersFetched.current) {
      return;
    }
    
    const fetchInitialData = async () => {
      // Fetch zones
      if (!zones || zones.length === 0) {
        setIsLoadingZones(true);
        try {
          const response = await apiService.getZones();
          const zonesData = Array.isArray(response) ? response : (response.data || []);
          setZones(zonesData);
        } catch (error) {
          console.error('Error fetching zones:', error);
          setZones([]);
        } finally {
          setIsLoadingZones(false);
        }
      }

      // Fetch customers (only if not already fetching)
      if ((!customers || customers.length === 0) && !isCustomersFetching.current) {
        isCustomersFetching.current = true;
        setIsLoadingCustomers(true);
        try {
          const response = await apiService.getCustomers({ isActive: 'true', limit: 1000 });
          const customersData = Array.isArray(response) ? response : (response.data || response.customers || []);
          setCustomers(customersData);
        } catch (error) {
          console.error('Error fetching customers:', error);
          setCustomers([]);
        } finally {
          setIsLoadingCustomers(false);
          isCustomersFetching.current = false;
        }
      }

      // Fetch users for "Created By" filter
      if (!isZoneUser && users.length === 0) {
        setIsLoadingUsers(true);
        try {
          const response = await apiService.getUsers({ isActive: 'true', limit: 1000 });
          const usersData = response.data?.users || response.users || response.data || response || [];
          const filteredUsers = Array.isArray(usersData)
            ? usersData.filter((u: any) => 
                u.role === UserRole.ZONE_USER || 
                u.role === UserRole.ZONE_MANAGER || 
                u.role === UserRole.ADMIN || 
                u.role === UserRole.EXPERT_HELPDESK
              )
            : [];
          setUsers(filteredUsers);
        } catch (error) {
          console.error('Error fetching users:', error);
          setUsers([]);
        } finally {
          setIsLoadingUsers(false);
        }
      }

      hasInitialCustomersFetched.current = true;
    };

    fetchInitialData();
  }, []);

  // Initialize zone for zone managers - ensure it's set from either initialFilters or first zone
  const getInitialZoneId = () => {
    if (initialFilters.zoneId) return initialFilters.zoneId;
    if (isZoneUser && zones && zones.length > 0) {
      return zones[0].id.toString();
    }
    return undefined;
  };

  const [filters, setFilters] = useState<ReportFilters>({
    ...initialFilters,
    zoneId: getInitialZoneId(),
    // Initialize target report filters if not present
    targetPeriod: initialFilters.targetPeriod || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })(),
    periodType: initialFilters.periodType || 'MONTHLY',
  });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(initialReportData);
  // Target report specific state
  const [zoneTargets, setZoneTargets] = useState<any[]>([]);
  const [userTargets, setUserTargets] = useState<any[]>([]);
  const [targetSummary, setTargetSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isZoneDetailsOpen, setIsZoneDetailsOpen] = useState(false);
  const [selectedZoneDetails, setSelectedZoneDetails] = useState<{ zoneId: number; targetPeriod: string; periodType: string } | null>(null);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<{ userId: number; targetPeriod: string; periodType: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOffers, setTotalOffers] = useState(0);
  
  // New report types state
  const [productTypeAnalysisData, setProductTypeAnalysisData] = useState<any>(null);
  const [customerPerformanceData, setCustomerPerformanceData] = useState<any>(null);
  
  // Core Reports state
  const [ticketSummaryData, setTicketSummaryData] = useState<any>(null);

  const [industrialDataReport, setIndustrialDataReport] = useState<any>(null);
  const [zonePerformanceData, setZonePerformanceData] = useState<any>(null);
  const [servicePersonPerformanceData, setServicePersonPerformanceData] = useState<any>(null);
  const [servicePersonAttendanceData, setServicePersonAttendanceData] = useState<any>(null);
  
  // Refs for preventing duplicate fetches and handling retries
  const isFetching = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 2;
  const hasInitialCustomersFetched = useRef(false);
  const isCustomersFetching = useRef(false);

  // Function to fetch customers for a specific zone
  const fetchCustomersForZone = useCallback(async (zoneId?: string, isZoneChange: boolean = false) => {
    // Prevent duplicate concurrent fetches
    if (isCustomersFetching.current) {
      console.log('Customers fetch already in progress, skipping...');
      return;
    }
    
    // Skip if this is from zone change effect but initial customers already fetched
    if (isZoneChange && !hasInitialCustomersFetched.current) {
      // Don't run zone change effect until initial fetch is done
      return;
    }
    
    try {
      isCustomersFetching.current = true;
      
      if (!zoneId) {
        // Reset to all customers
        const response = await apiService.getCustomers({ isActive: 'true', limit: 1000 });
        const customersData = Array.isArray(response) ? response : (response.data || response.customers || []);
        setCustomers(customersData);
        return;
      }
      
      setIsLoadingCustomers(true);
      const response = await apiService.getCustomers({ isActive: 'true', zoneId, limit: 1000 });
      const customersData = Array.isArray(response) ? response : (response.data || response.customers || []);
      setCustomers(customersData);
      // Clear customer filter when zone changes
      setFilters(prev => ({ ...prev, customerId: undefined }));
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    } finally {
      isCustomersFetching.current = false;
      setIsLoadingCustomers(false);
    }
  }, []);

  const fetchReport = useCallback(async (isRetry: boolean = false) => {
    // Prevent duplicate concurrent fetches (but allow retries)
    if (isFetching.current && !isRetry) {
      console.log('Fetch already in progress, skipping...');
      return;
    }
    
    try {
      isFetching.current = true;
      setLoading(true);
      
      // Handle target report differently
      if (filters.reportType === 'target-report') {
        const params: any = {
          targetPeriod: filters.targetPeriod,
          periodType: filters.periodType || 'MONTHLY',
          grouped: 'true'
        };

        if (filters.zoneId && filters.zoneId !== 'all') {
          params.zoneId = filters.zoneId;
        }

        try {
          // Fetch zone targets and user targets from actual endpoints
          const [zoneResponse, userResponse] = await Promise.all([
            apiService.getZoneTargets(params),
            apiService.getUserTargets(params)
          ]);
          
          console.log('Zone targets response:', zoneResponse);
          console.log('User targets response:', userResponse);
          
          let zt = (zoneResponse?.success && zoneResponse?.data) ? zoneResponse.data : (zoneResponse?.targets || []);
          let ut = (userResponse?.success && userResponse?.data) ? userResponse.data : (userResponse?.targets || []);
          
          const forcedZoneId = isZoneUser ? (filters.zoneId ? parseInt(filters.zoneId) : (zones?.[0]?.id)) : undefined;
          if (forcedZoneId) {
            zt = (zt || []).filter((t: any) => t?.serviceZoneId === forcedZoneId);
            ut = (ut || []).filter((t: any) => t?.user?.serviceZones?.some?.((sz: any) => sz?.serviceZone?.id === forcedZoneId));
          }
          
          setZoneTargets(zt);
          setUserTargets(ut);
          
          // Calculate summary
          const totalTargets = (zt?.length || 0) + (ut?.length || 0);
          const totalTargetValue = (zt || []).reduce((sum: number, t: any) => sum + (Number(t.targetValue) || 0), 0) + 
                                  (ut || []).reduce((sum: number, t: any) => sum + (Number(t.targetValue) || 0), 0);
          const totalActualValue = (zt || []).reduce((sum: number, t: any) => sum + (Number(t.actualValue) || 0), 0) + 
                                  (ut || []).reduce((sum: number, t: any) => sum + (Number(t.actualValue) || 0), 0);
          const overallAchievement = totalTargetValue > 0 ? (totalActualValue / totalTargetValue) * 100 : 0;
          
          setTargetSummary({
            totalTargets,
            totalTargetValue,
            totalActualValue,
            overallAchievement
          });
          
          // Clear offer report data
          setOffers([]);
          setReportData(null);
        } catch (error) {
          console.error('Failed to fetch target report:', error);
          toast.error('Failed to load target report');
        }
        return;
      }

      // Handle offer summary report
      const reportType = filters.reportType || 'offer-summary';
      
      // Handle Product Type Analysis Report
      if (reportType === 'product-type-analysis') {
        const params: any = {};
        if (filters.dateRange?.from) {
          params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
        }
        if (filters.dateRange?.to) {
          params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
        }
        if (filters.zoneId) {
          params.zoneId = filters.zoneId;
        }
        
        const response = await apiService.getProductTypeAnalysis(params);
        console.log('Product type analysis response:', response);
        let analysisData = (response.success && response.data) ? response.data : (response.analysis ? response : null);
        // Additional check: if data exists but doesn't have required fields, try to extract from response
        if (!analysisData && response && (response.analysis || response.totals)) {
          analysisData = response;
        }
        console.log('Product type analysis data to display:', analysisData);
        if (analysisData) {
          setProductTypeAnalysisData(analysisData);
          setOffers([]);
          setReportData(null);
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
        } else {
          console.error('Failed to parse product type analysis response');
        }
      }
      // Handle Customer Performance Report
      else if (reportType === 'customer-performance') {
        const params: any = {};
        if (filters.dateRange?.from) {
          params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
        }
        if (filters.dateRange?.to) {
          params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
        }
        if (filters.zoneId) {
          params.zoneId = filters.zoneId;
        }
        
        const response = await apiService.getCustomerPerformance(params);
        console.log('Customer performance response:', response);
        let data = (response.success && response.data) ? response.data : (response.topCustomers ? response : null);
        // Additional check: if data exists but doesn't have required fields, try to extract from response
        if (!data && response && (response.topCustomers || response.allCustomers || response.totals)) {
          data = response;
        }
        console.log('Customer performance data to display:', data);
        if (data) {
          const forcedZoneId = isZoneUser ? (filters.zoneId ? parseInt(filters.zoneId) : (zones?.[0]?.id)) : undefined;
          if (forcedZoneId) {
            const filterByZone = (arr: any[]) => (arr || []).filter((c: any) => c?.zone?.id === forcedZoneId);
            data = {
              ...data,
              topCustomers: filterByZone(data.topCustomers),
              allCustomers: filterByZone(data.allCustomers),
              // totals remain as server-reported; optional: recompute if needed
            };
          }
          setCustomerPerformanceData(data);
          setOffers([]);
          setReportData(null);
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
        } else {
          console.error('Failed to parse customer performance response');
        }
      }
      // Handle Core Reports
      else if (reportType === 'ticket-summary') {
        const params: any = {
          reportType: 'ticket-summary'
        };
        if (filters.dateRange?.from) {
          params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
        }
        if (filters.dateRange?.to) {
          params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
        }
        if (filters.zoneId) {
          params.zoneId = filters.zoneId;
        }
        if (filters.customerId) {
          params.customerId = filters.customerId;
        }
        if (filters.reportType) {
          params.reportType = filters.reportType;
        }
        
        console.log('Fetching ticket-summary report with params:', params);
        // Use zone report endpoint for zone users, generate for admins
        const response = isZoneUser 
          ? await apiService.generateZoneReport(params)
          : await apiService.generateReport(params);
        console.log('Ticket-summary response:', response);
        
        // Handle both response formats:
        // 1. New format: { success: true, data: { summary, statusDistribution, ... } }
        // 2. Old format: { summary, statusDistribution, ... }
        let reportData = null;
        if (response.success && response.data) {
          reportData = response.data;
        } else if (response.summary || response.statusDistribution) {
          // Old format - data is at root level
          reportData = response;
        }
        
        if (reportData) {
          console.log('Setting ticketSummaryData:', reportData);
          setTicketSummaryData(reportData);
          setOffers([]);
          setReportData(null);
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
        } else {
          console.error('Ticket-summary report failed:', { success: response.success, data: response.data, response });
          toast.error('Failed to load ticket summary report');
        }
      }

      else if (reportType === 'industrial-data') {
        const params: any = {
          reportType: 'industrial-data'
        };
        if (filters.dateRange?.from) {
          params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
        }
        if (filters.dateRange?.to) {
          params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
        }
        if (filters.zoneId) {
          params.zoneId = filters.zoneId;
        }
        if (filters.customerId) {
          params.customerId = filters.customerId;
        }
        if (filters.assetId) {
          params.assetId = filters.assetId;
        }
        if (filters.reportType) {
          params.reportType = filters.reportType;
        }
        
        const response = isZoneUser 
          ? await apiService.generateZoneReport(params)
          : await apiService.generateReport(params);
        console.log('Industrial data response:', response);
        const industrialData = (response.success && response.data) ? response.data : (response.machineDowntime ? response : null);
        console.log('Industrial data to display:', industrialData);
        if (industrialData) {
          setIndustrialDataReport(industrialData);
          setOffers([]);
          setReportData(null);
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
        } else {
          console.error('Failed to parse industrial data response');
        }
      }
      else if (reportType === 'zone-performance') {
        const params: any = {
          reportType: 'zone-performance'
        };
        if (filters.dateRange?.from) {
          params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
        }
        if (filters.dateRange?.to) {
          params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
        }
        
        const response = isZoneUser 
          ? await apiService.generateZoneReport(params)
          : await apiService.generateReport(params);
        const zoneData = (response.success && response.data) ? response.data : (response.zones ? response : null);
        if (zoneData) {
          setZonePerformanceData(zoneData);
          setOffers([]);
          setReportData(null);
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
        }
      }
      else if (reportType === 'agent-productivity') {
        const params: any = {};
        
        // For zone users, we'll use the zone report endpoint which has the correct permissions
        if (isZoneUser) {
          // Zone users can only see their own zone's data
          if (filters.zoneId) {
            params.zoneId = filters.zoneId;
          }
          
          // Add report type and date range if specified
          if (filters.reportType) {
            params.reportType = filters.reportType;
          }
          if (filters.dateRange?.from) {
            params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
          }
          if (filters.dateRange?.to) {
            params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
          }
          
          console.log('Fetching agent-productivity report for zone user with params:', params);
          const response = await apiService.generateZoneReport(params);
          console.log('Agent-productivity zone response:', response);
          
          // Handle the response format from the zone report endpoint
          const backendData = response.success ? response.data : response;
          if (backendData) {
            // Transform backend data structure to match frontend expectations
            const transformedData = {
              reports: (backendData.agents || []).map((agent: any) => ({
                id: agent.agentId,
                name: agent.agentName,
                email: agent.email,
                phone: agent.phone || '',
                zones: (agent.zones || []).map((zone: string, index: number) => ({ id: index + 1, name: zone })),
                summary: {
                  totalWorkingDays: 0, // Not available in agent-productivity report
                  presentDays: 0, // Not available in agent-productivity report
                  totalHours: 0, // Not available in agent-productivity report
                  absentDays: 0, // Not available in agent-productivity report
                  autoCheckouts: 0, // Not available in agent-productivity report
                  activitiesLogged: 0, // Not available in agent-productivity report
                  totalActivities: 0, // Not available in agent-productivity report
                  averageHoursPerDay: 0, // Not available in agent-productivity report
                  // Performance metrics from agent data
                  totalTickets: agent.totalTickets || 0,
                  ticketsResolved: agent.resolvedTickets || 0,
                  averageResolutionTimeHours: agent.averageResolutionTime || 0,
                  averageTravelTimeHours: agent.averageTravelTime || 0,
                  averageOnsiteTimeHours: agent.averageOnsiteTime || 0,
                  performanceScore: agent.performanceScore || 0
                },
                flags: agent.flags || [],
                dayWiseBreakdown: agent.dayWiseBreakdown || []
              })),
              summary: {
                totalServicePersons: backendData.totalAgents || 0,
                totalCheckIns: 0, // Not available in agent-productivity report
                averageHoursPerDay: 0, // Not available in agent-productivity report
                totalAbsentees: 0, // Not available in agent-productivity report
                totalActivitiesLogged: 0, // Not available in agent-productivity report
                mostActiveUser: backendData.performanceMetrics?.topPerformer ? {
                  name: backendData.performanceMetrics.topPerformer.agentName,
                  email: backendData.performanceMetrics.topPerformer.email,
                  activityCount: backendData.performanceMetrics.topPerformer.totalTickets
                } : null
              },
              dateRange: {
                from: filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : '',
                to: filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : '',
                totalDays: 0
              }
            };
            
            setServicePersonPerformanceData(transformedData);
            setOffers([]);
            setReportData(null);
            setZoneTargets([]);
            setUserTargets([]);
            setTargetSummary(null);
          }
        }
        // All users (including admin) use the dedicated service person reports endpoint
        else {
          // For all users, use the dedicated service person reports endpoint
          if (filters.dateRange?.from) {
            params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
          }
          if (filters.dateRange?.to) {
            params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
          }
          if (filters.zoneId) {
            params.zoneId = filters.zoneId;
          }
          
          console.log('Fetching agent-productivity report with params:', params);
          // Use dedicated service person reports endpoint
          const response = await apiService.getServicePersonReports(params);
          console.log('Agent-productivity response:', response);
          
          // Handle the response format from the service person reports endpoint
          const agentData = (response.success && response.data) ? response.data : (response.servicePersonReports ? response : response);
          if (agentData) {
            // Transform the data structure to match what the component expects
            const transformedReports = (agentData.servicePersonReports || []).map((person: any) => ({
              ...person,
              zones: person.serviceZones || [] // Transform serviceZones to zones
            }));
            
            const transformedData = {
              reports: transformedReports,
              summary: {
                totalServicePersons: agentData.servicePersonReports?.length || 0,
                totalCheckIns: agentData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.presentDays || 0), 0),
                averageHoursPerDay: agentData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.averageHoursPerDay || 0), 0) / (agentData.servicePersonReports?.length || 1),
                totalAbsentees: agentData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.absentDays || 0), 0),
                totalActivitiesLogged: agentData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.totalActivities || 0), 0),
                mostActiveUser: agentData.servicePersonReports?.reduce((max: any, person: any) => 
                  (person.summary?.totalActivities || 0) > (max?.summary?.totalActivities || 0) ? person : max, null),
                uniqueMetrics: agentData.uniqueMetrics || null
              },
              dateRange: {
                from: filters.dateRange?.from || '',
                to: filters.dateRange?.to || '',
                totalDays: agentData.servicePersonReports?.[0]?.summary?.totalDays || 0
              }
            };
            
            setServicePersonPerformanceData(transformedData);
            setOffers([]);
            setReportData(null);
            setZoneTargets([]);
            setUserTargets([]);
            setTargetSummary(null);
          }
        }
      }
      else if (reportType === 'sla-performance') {
        const params: any = {};
        if (filters.dateRange?.from) {
          params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
        }
        if (filters.dateRange?.to) {
          params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
        }
        if (filters.zoneId) {
          params.zoneId = filters.zoneId;
        }
        
        // Use dedicated service person reports endpoint for attendance data
        const response = await apiService.getServicePersonReports(params);
        console.log('Service person attendance response:', response);
        
        // Handle the response format from the service person reports endpoint
        const attendanceData = (response.success && response.data) ? response.data : (response.reports ? response : response);
        if (attendanceData) {
          // Transform the data structure to match what the component expects
          const transformedReports = (attendanceData.servicePersonReports || []).map((person: any) => ({
            ...person,
            zones: person.serviceZones || [] // Transform serviceZones to zones
          }));
          
          const transformedData = {
            reports: transformedReports,
            summary: {
              totalServicePersons: attendanceData.servicePersonReports?.length || 0,
              totalCheckIns: attendanceData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.presentDays || 0), 0),
              averageHoursPerDay: attendanceData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.averageHoursPerDay || 0), 0) / (attendanceData.servicePersonReports?.length || 1),
              totalAbsentees: attendanceData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.absentDays || 0), 0),
              totalActivitiesLogged: attendanceData.servicePersonReports?.reduce((sum: number, person: any) => sum + (person.summary?.totalActivities || 0), 0),
              mostActiveUser: attendanceData.servicePersonReports?.reduce((max: any, person: any) => 
                (person.summary?.totalActivities || 0) > (max?.summary?.totalActivities || 0) ? person : max, null)
            },
            dateRange: {
              from: filters.dateRange?.from || '',
              to: filters.dateRange?.to || '',
              totalDays: attendanceData.servicePersonReports?.[0]?.summary?.totalDays || 0
            }
          };
          
          setServicePersonAttendanceData(transformedData);
          setOffers([]);
          setReportData(null);
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
        }
      }
      // Handle standard Offer Summary Report and Zone User Offer Summary Report
      else if (reportType === 'offer-summary' || reportType === 'zone-user-offer-summary') {
        const params: any = {
          reportType: 'offer-summary', // Use the same backend report type
          page: currentPage,
          limit: 500,
        };

        // For zone-user-offer-summary, add myOffers=true to filter only user's offers
        if (reportType === 'zone-user-offer-summary') {
          params.myOffers = 'true';
        }

        if (filters.dateRange?.from) {
          params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
        }
        if (filters.dateRange?.to) {
          params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
        }
        if (filters.zoneId) {
          params.zoneId = filters.zoneId;
        }
        if (filters.customerId) {
          params.customerId = filters.customerId;
        }
        if (filters.productType) {
          params.productType = filters.productType;
        }
        if (filters.stage) {
          params.stage = filters.stage;
        }
        if (filters.search) {
          params.search = filters.search;
        }
        if (filters.createdById) {
          params.createdById = filters.createdById;
        }

        // Use zone report endpoint for zone users, generate for admins
        const response = isZoneUser 
          ? await apiService.generateZoneReport(params)
          : await apiService.generateReport(params);
        
        if (response.success && response.data) {
          const forcedZoneId = isZoneUser ? (filters.zoneId ? parseInt(filters.zoneId) : (zones?.[0]?.id)) : undefined;
          let offersData = response.data.offers || [];
          if (forcedZoneId) {
            offersData = (offersData || []).filter((o: any) => o?.zone?.id === forcedZoneId);
          }
          setOffers(offersData);
          setTotalOffers(response.data.pagination?.total || 0);
          setTotalPages(response.data.pagination?.pages || 1);
          
          setReportData({
            summary: response.data.summary || {},
            statusDistribution: response.data.statusDistribution || {},
            stageDistribution: response.data.stageDistribution || {},
            productTypeDistribution: response.data.productTypeDistribution || {},
          });
          // Clear other report data
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
          setProductTypeAnalysisData(null);
          setCustomerPerformanceData(null);
          // Clear Core Reports data
          setTicketSummaryData(null);

          setIndustrialDataReport(null);
          setZonePerformanceData(null);
          setServicePersonPerformanceData(null);
          setServicePersonAttendanceData(null);
        } else {
          // Error will be handled by catch block if it's not a 401
        }
      }
    } catch (error: any) {
      console.error('Error fetching report:', error);
      
      // Handle 401 with automatic retry logic (token refresh case)
      if (error?.response?.status === 401) {
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`Token refresh detected, retrying (attempt ${retryCountRef.current}/${maxRetries})...`);
          
          // Wait for token refresh to complete (the axios interceptor handles this)
          // and then retry the request
          setTimeout(() => {
            fetchReport(true); // Pass true to indicate this is a retry
          }, 1000 * retryCountRef.current); // Exponential backoff: 1s, 2s
          return;
        }
        // Max retries reached, let user know
        toast.error('Session expired. Please refresh the page or log in again.');
        retryCountRef.current = 0;
        return;
      }
      
      toast.error(error?.response?.data?.error || 'Failed to load report');
    } finally {
      isFetching.current = false;
      setLoading(false);
      // Reset retry count on successful completion
      if (retryCountRef.current > 0) {
        retryCountRef.current = 0;
      }
    }
  }, [filters, currentPage]);

  // Don't auto-fetch on mount - wait for Generate Report button
  // useEffect(() => {
  //   fetchReport();
  // }, [fetchReport]);

  // Fetch customers when zone changes (but not on initial mount - that's handled separately)
  useEffect(() => {
    // Only fetch if initial customers were already loaded (prevents duplicate on mount)
    if (hasInitialCustomersFetched.current) {
      fetchCustomersForZone(filters.zoneId, true);
    }
  }, [filters.zoneId, fetchCustomersForZone]);

  // Client-side filtering for search and stage (live filter without API call)
  const filteredOffers = useMemo(() => {
    if (!offers.length) return [];

    return offers.filter((offer) => {
      // Filter by stage
      if (filters.stage && offer.stage !== filters.stage) {
        return false;
      }

      // Filter by search term
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchableText = [
          offer.offerReferenceNumber,
          offer.title,
          offer.company,
          offer.contactPersonName,
          offer.contact?.contactPersonName,
          offer.poNumber,
          offer.machineSerialNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [offers, filters.search, filters.stage]);


  const handleFilterChange = useCallback((newFilters: Partial<ReportFilters>) => {
    const prevReportType = filters.reportType;
    const newReportType = newFilters.reportType || filters.reportType;
    
    // Clear report data when switching report types
    if (prevReportType !== newReportType) {
      setReportData(null);
      setOffers([]);
      setTotalOffers(0);
      setTotalPages(1);
      setCurrentPage(1);
      setZoneTargets([]);
      setUserTargets([]);
      setTargetSummary(null);
      setProductTypeAnalysisData(null);
      setCustomerPerformanceData(null);
      // Clear Core Reports data
      setTicketSummaryData(null);

      setIndustrialDataReport(null);
      setZonePerformanceData(null);
      setServicePersonPerformanceData(null);
      setServicePersonAttendanceData(null);
      
      // Initialize target report filters if switching to target-report
      if (newReportType === 'target-report') {
        const now = new Date();
        newFilters.targetPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        newFilters.periodType = 'MONTHLY';
      }
    }
    
    // Clear target report data when target filters change
    if (newReportType === 'target-report' && (
      newFilters.targetPeriod !== undefined || 
      newFilters.periodType !== undefined || 
      newFilters.zoneId !== undefined
    )) {
      setZoneTargets([]);
      setUserTargets([]);
      setTargetSummary(null);
    }
    
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  }, [filters.reportType]);

  const handleViewOffer = useCallback((offerId: number) => {
    setSelectedOfferId(offerId);
    setIsDetailsOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setSelectedOfferId(null);
  }, []);

  const handleOpenZoneDetails = useCallback((target: any) => {
    setSelectedZoneDetails({
      zoneId: target.serviceZoneId,
      targetPeriod: target.targetPeriod,
      periodType: target.periodType,
    });
    setIsZoneDetailsOpen(true);
  }, []);

  const handleOpenUserDetails = useCallback((target: any) => {
    setSelectedUserDetails({
      userId: target.userId,
      targetPeriod: target.targetPeriod,
      periodType: target.periodType,
    });
    setIsUserDetailsOpen(true);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleExport = useCallback(async (exportFormat: 'pdf' | 'excel') => {
    try {
      // ── CLIENT-SIDE PDF GENERATION for supported report types ──
      const pdfSupportedTypes = ['ticket-summary', 'agent-productivity'];
      if (exportFormat === 'pdf' && pdfSupportedTypes.includes(filters.reportType)) {
        toast.info('Generating premium PDF report...');
        const { generateReportPdf } = await import('@/lib/reports-pdf');
        await generateReportPdf(filters.reportType, {
          ticketSummaryData,
          servicePersonPerformanceData,
        }, {
          filters,
          zones,
          customers,
        });
        toast.success('PDF report downloaded successfully');
        return;
      }

      // ── BACKEND EXPORT (Excel + unsupported PDF types) ──
      const params: any = {
        reportType: filters.reportType || 'offer-summary',
        format: exportFormat,
      };

      if (filters.dateRange?.from) {
        params.from = format(filters.dateRange.from, 'yyyy-MM-dd');
      }
      if (filters.dateRange?.to) {
        params.to = format(filters.dateRange.to, 'yyyy-MM-dd');
      }
      if (filters.zoneId) {
        params.zoneId = filters.zoneId;
      }
      if (filters.customerId) {
        params.customerId = filters.customerId;
      }
      if (filters.productType) {
        params.productType = filters.productType;
      }
      if (filters.stage) {
        params.stage = filters.stage;
      }
      if (filters.createdById) {
        params.createdById = filters.createdById;
      }

      // Build query string
      const queryString = new URLSearchParams(params).toString();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
      const exportUrl = `${apiUrl}/reports/export?${queryString}`;

      // Create a temporary link to trigger download
      const link = document.createElement('a');
      
      // Get token - check localStorage first (matching axios.ts logic), then cookies
      let token = localStorage.getItem('accessToken') || 
                  localStorage.getItem('token') || 
                  localStorage.getItem('dev_accessToken') || '';
      
      // Fallback to cookies if not in localStorage
      if (!token) {
        const getCookieValue = (name: string): string | null => {
          const cookie = document.cookie
            .split('; ')
            .find(row => row.startsWith(`${name}=`));
          if (!cookie) return null;
          const eqIndex = cookie.indexOf('=');
          return eqIndex > -1 ? cookie.substring(eqIndex + 1) : null;
        };
        token = getCookieValue('accessToken') || getCookieValue('token') || '';
      }

      // Use fetch to download with auth
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Automatically determine filename from response headers or fallback
      let filename = `${filters.reportType || 'report'}.${exportFormat === 'pdf' ? 'pdf' : 'xlsx'}`;
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`${exportFormat.toUpperCase()} export started`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to export report');
    }
  }, [filters, ticketSummaryData, servicePersonPerformanceData, zones, customers]);

  const summary = useMemo(() => reportData?.summary || {}, [reportData]);
  const selectedReportType = reportTypes.find(type => type.value === filters.reportType) || REPORT_TYPES.find(type => type.value === filters.reportType);

  // Check if any report data is available for enabling export buttons
  const hasReportData = useMemo(() => {
    return !!(
      reportData ||
      targetSummary ||
      ticketSummaryData ||
      industrialDataReport ||
      zonePerformanceData ||
      servicePersonPerformanceData ||
      servicePersonAttendanceData ||
      productTypeAnalysisData ||
      customerPerformanceData ||
      offers.length > 0
    );
  }, [
    reportData,
    targetSummary,
    ticketSummaryData,
    industrialDataReport,
    zonePerformanceData,
    servicePersonPerformanceData,
    servicePersonAttendanceData,
    productTypeAnalysisData,
    customerPerformanceData,
    offers
  ]);

  // Helper function for achievement color
  const getAchievementColor = (achievement: number) => {
    if (achievement >= 100) return 'bg-[#A2B9AF]/20 text-[#4F6A64]';
    if (achievement >= 80) return 'bg-[#96AEC2]/20 text-[#546A7A]';
    if (achievement >= 50) return 'bg-[#CE9F6B]/20 text-[#976E44]';
    return 'bg-[#E17F70]/20 text-[#75242D]';
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#546A7A] mb-2">Reports</h1>
            <p className="text-sm sm:text-base text-[#5D6E73]">
              Generate and view detailed reports for your offer operations
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="text-xs sm:text-sm text-[#5D6E73] bg-[#AEBFC3]/20 px-3 py-2 rounded-lg">
              Report Type: <span className="font-medium">{selectedReportType?.label || filters.reportType}</span>
            </div>
            {reportData && (
              <div className="text-xs sm:text-sm text-[#4F6A64] bg-[#A2B9AF]/10 px-3 py-2 rounded-lg">
                ✓ Generated
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Generation Controls */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">Report Filters</CardTitle>
              <CardDescription className="text-sm sm:text-base mt-1">
                Configure your report parameters
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button 
                onClick={() => fetchReport()} 
                disabled={loading}
                className="w-full sm:w-auto bg-[#6F8A9D] hover:bg-[#546A7A] text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                <BarChart3 className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button 
                  onClick={() => handleExport('excel')} 
                  disabled={!hasReportData || loading}
                  variant="outline"
                  className="w-full sm:w-auto min-h-[44px] border-[#4F6A64] text-[#4F6A64] hover:bg-[#A2B9AF]/10"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  {loading ? 'Exporting...' : 'Export Excel'}
                </Button>
                <Button 
                  onClick={() => handleExport('pdf')} 
                  disabled={!hasReportData || loading}
                  variant="outline"
                  className="w-full sm:w-auto min-h-[44px] border-[#9E3B47] text-[#9E3B47] hover:bg-[#E17F70]/10"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {loading ? 'Exporting...' : 'Export PDF'}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ReportsFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            zones={zones}
            customers={customers}
            isZoneUser={isZoneUser}
            isLoadingCustomers={isLoadingCustomers}
            users={users}
            reportTypes={reportTypes}
          />
          {selectedReportType && (
            <div className="mt-4 p-4 bg-[#96AEC2]/10 rounded-lg border border-[#96AEC2]">
              <h4 className="font-medium text-[#546A7A]">{selectedReportType.label}</h4>
              <p className="text-sm text-[#546A7A] mt-1">{selectedReportType.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Report Results */}
      {filters.reportType === 'target-report' && targetSummary && (zoneTargets.length > 0 || userTargets.length > 0) && (
        <div className="space-y-6">
          <ReportErrorBoundary onRetry={() => fetchReport()}>
            <TargetReportAnalytics
              zoneTargets={zoneTargets as any}
              userTargets={userTargets as any}
              summary={targetSummary}
              targetPeriod={(filters.targetPeriod || '') as string}
              periodType={(filters.periodType || 'MONTHLY') as 'MONTHLY' | 'YEARLY'}
              zones={zones}
              isZoneUser={isZoneUser}
              onOpenZoneDetails={(zoneId, tp, pt) => {
                setSelectedZoneDetails({ zoneId, targetPeriod: tp, periodType: pt });
                setIsZoneDetailsOpen(true);
              }}
              onOpenUserDetails={(userId, tp, pt) => {
                setSelectedUserDetails({ userId, targetPeriod: tp, periodType: pt });
                setIsUserDetailsOpen(true);
              }}
            />
          </ReportErrorBoundary>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-[#6F8A9D]/10 to-[#96AEC2]/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#546A7A]">Zone Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-[#546A7A]">{targetSummary.totalZoneTargets || 0}</div>
                <div className="text-sm text-[#546A7A] mt-2 font-medium">
                  Achievement: {targetSummary.totalZoneAchievement?.toFixed(2) || 0}%
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#546A7A]">Zone Target Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#546A7A]" title={formatINRFull(targetSummary.totalZoneTargetValue || 0)}>
                  {formatCrLakh(targetSummary.totalZoneTargetValue || 0)}
                </div>
                <div className="text-sm text-[#546A7A] mt-2 font-medium">
                  <span title={formatINRFull(targetSummary.totalZoneActualValue || 0)}>Actual: {formatCrLakh(targetSummary.totalZoneActualValue || 0)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-[#6F8A9D]/10 to-[#EEC1BF]/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#546A7A]">User Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-[#546A7A]">{targetSummary.totalUserTargets || 0}</div>
                <div className="text-sm text-[#546A7A] mt-2 font-medium">
                  Achievement: {targetSummary.totalUserAchievement?.toFixed(2) || 0}%
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-[#A2B9AF]/10 to-[#82A094]/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#4F6A64]">User Target Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#4F6A64]" title={formatINRFull(targetSummary.totalUserTargetValue || 0)}>
                  {formatCrLakh(targetSummary.totalUserTargetValue || 0)}
                </div>
                <div className="text-sm text-[#4F6A64] mt-2 font-medium">
                  <span title={formatINRFull(targetSummary.totalUserActualValue || 0)}>Actual: {formatCrLakh(targetSummary.totalUserActualValue || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Zone Targets Table */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-[#546A7A]" />
              <h2 className="text-xl font-bold text-[#546A7A]">Zone Targets ({zoneTargets.length})</h2>
            </div>
            <div className="bg-white rounded-xl border border-[#92A2A5] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/20 border-b border-[#92A2A5]">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#5D6E73]">Zone</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73]">No. Offers</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Sum of all offer values in the period">
                        Offers Value
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Sum of WON stage offer values">
                        Orders Received
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Sum of (Offer Value × Probability %) for offers with probability > 50%">
                        Expected Offers
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Offers Value - Orders Received (pending opportunities)">
                        Open Funnel
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Count of WON/PO_RECEIVED stage offers in current year">
                        Order Booking
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73]">Target BU</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="(Orders Received / Target BU) × 100">
                        Achievement
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="(Expected Offers / Target BU) × 100">
                        Expected Ach %
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Target BU - Orders Received (remaining to achieve)">
                        Balance BU
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-[#5D6E73]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {zoneTargets.map((target: any, idx: number) => (
                      <tr key={`zone-${target.serviceZoneId}-${idx}`} className="hover:bg-[#96AEC2]/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[#6F8A9D]"></div>
                            <span className="font-semibold text-[#546A7A]">{target.serviceZone?.name || 'Unknown Zone'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{target.metrics?.noOfOffers || 0}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{formatCrLakh(target.metrics?.offersValue || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#4F6A64]">{formatCrLakh(target.metrics?.ordersReceived || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{formatCrLakh(target.metrics?.expectedOffers || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#976E44]">{formatCrLakh(target.metrics?.openFunnel || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{target.metrics?.orderBooking || 0}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{formatCrLakh(target.targetValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`${getAchievementColor(target.achievement || 0)} text-xs font-bold`}>
                            {(target.achievement || 0).toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`${getAchievementColor(target.expectedAchievement || 0)} text-xs font-bold`}>
                            {(target.expectedAchievement || 0).toFixed(1)}%
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold ${
                          (target.metrics?.balanceBU || 0) >= 0 ? 'text-[#4F6A64]' : 'text-[#75242D]'
                        }`}>
                          {formatCrLakh(target.metrics?.balanceBU || 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenZoneDetails(target)}
                            className="h-8 w-8 p-0 text-[#546A7A] hover:bg-[#96AEC2]/20 hover:text-[#546A7A]"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {zoneTargets.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <MapPin className="h-12 w-12 text-[#92A2A5] mx-auto mb-3" />
                  <p className="text-[#AEBFC3]0 font-medium">No zone targets found</p>
                </div>
              )}
            </div>
          </div>

          {/* Zone User Targets Table */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-[#546A7A]" />
              <h2 className="text-xl font-bold text-[#546A7A]">Zone User Targets ({userTargets.length})</h2>
            </div>
            <div className="bg-white rounded-xl border border-[#92A2A5] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#6F8A9D]/10 to-[#EEC1BF]/20 border-b border-[#92A2A5]">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#5D6E73]">User</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#5D6E73]">Zone</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73]">No. Offers</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Sum of all offer values in the period">
                        Offers Value
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Sum of WON stage offer values">
                        Orders Received
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Sum of (Offer Value × Probability %) for offers with probability > 50%">
                        Expected Offers
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Offers Value - Orders Received (pending opportunities)">
                        Open Funnel
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Count of WON/PO_RECEIVED stage offers in current year">
                        Order Booking
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73]">Target BU</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="(Orders Received / Target BU) × 100">
                        Achievement
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="(Expected Offers / Target BU) × 100">
                        Expected Ach %
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[#5D6E73] cursor-help" title="Target BU - Orders Received (remaining to achieve)">
                        Balance BU
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-[#5D6E73]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {userTargets.map((target: any, idx: number) => (
                      <tr key={`user-${target.userId}-${idx}`} className="hover:bg-[#6F8A9D]/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[#546A7A]"></div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#546A7A] truncate">{target.user?.name || target.user?.email}</div>
                              <div className="text-xs text-[#AEBFC3]0 truncate">{target.user?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#5D6E73]">
                          {target.user?.serviceZones && target.user?.serviceZones.length > 0 
                            ? target.user.serviceZones.map((sz: any) => sz.serviceZone?.name || 'Unknown').join(', ')
                            : 'N/A'
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{target.metrics?.noOfOffers || 0}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{formatCrLakh(target.metrics?.offersValue || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#4F6A64]">{formatCrLakh(target.metrics?.ordersReceived || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{formatCrLakh(target.metrics?.expectedOffers || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#976E44]">{formatCrLakh(target.metrics?.openFunnel || 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{target.metrics?.orderBooking || 0}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#546A7A]">{formatCrLakh(target.targetValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`${getAchievementColor(target.achievement || 0)} text-xs font-bold`}>
                            {(target.achievement || 0).toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`${getAchievementColor(target.expectedAchievement || 0)} text-xs font-bold`}>
                            {(target.expectedAchievement || 0).toFixed(1)}%
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold ${
                          (target.metrics?.balanceBU || 0) >= 0 ? 'text-[#4F6A64]' : 'text-[#75242D]'
                        }`}>
                          {formatCrLakh(target.metrics?.balanceBU || 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenUserDetails(target)}
                            className="h-8 w-8 p-0 text-[#546A7A] hover:bg-[#6F8A9D]/20 hover:text-[#546A7A]"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {userTargets.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <Users className="h-12 w-12 text-[#92A2A5] mx-auto mb-3" />
                  <p className="text-[#AEBFC3]0 font-medium">No user targets found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Offer Report Results */}
      {(filters.reportType === 'offer-summary' || filters.reportType === 'zone-user-offer-summary') && reportData && offers.length > 0 && (
        <div className="space-y-6">
          {/* Summary Cards - Growth Pillar Style */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard 
              title="Total Target" 
              value={formatCrLakh(summary.totalTarget || 0)} 
              valueTitle={formatINRFull(summary.totalTarget || 0)}
              subtitle={`${summary.totalOffers || 0} offers`} 
              icon={Target} 
              color="#6366F1" 
            />

            <KPICard 
              title="Offer Value" 
              value={formatCrLakh(summary.totalOfferValue || 0)} 
              valueTitle={formatINRFull(summary.totalOfferValue || 0)}
              subtitle={`${summary.totalOffers || 0} offers created`} 
              icon={DollarSign} 
              color="#F59E0B" 
            />

            <KPICard 
              title="Won Value" 
              value={formatCrLakh(summary.wonValue || 0)} 
              valueTitle={formatINRFull(summary.wonValue || 0)}
              subtitle={`${summary.wonOffers || 0} orders won`} 
              icon={Award} 
              color="#10B981" 
            />

            <KPICard 
              title="Achievement" 
              value={`${(summary.achievementPercent || 0).toFixed(1)}%`} 
              subtitle="Won / Target" 
              icon={TrendingUp} 
              color="#06B6D4" 
            />

            <KPICard 
              title="Hit Rate" 
              value={`${(summary.hitRatePercent || 0).toFixed(1)}%`} 
              subtitle="Won / Offer Value" 
              icon={Percent} 
              color="#8B5CF6" 
            />
          </div>



          {/* Search Bar Above Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Search & Filter Offers</Label>
                <Input
                  type="text"
                  placeholder="Search by offer #, title, company, contact, PO #, serial number... (instant filter)"
                  value={filters.search || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({ search: e.target.value || undefined })}
                  className="w-full"
                />
                {filters.search && (
                  <p className="text-xs text-[#4F6A64] mt-2">
                    ✓ Showing {filteredOffers.length} result{filteredOffers.length !== 1 ? 's' : ''} for "{filters.search}"
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Offers Table */}
          <ReportsTable
            offers={filteredOffers}
            loading={loading}
            onViewOffer={handleViewOffer}
            currentPage={currentPage}
            totalPages={totalPages}
            totalOffers={totalOffers}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Product Type Analysis Report */}
      {filters.reportType === 'product-type-analysis' && productTypeAnalysisData && (
        <ReportErrorBoundary onRetry={() => fetchReport()}>
          <ProductTypeAnalysisReport data={productTypeAnalysisData} />
        </ReportErrorBoundary>
      )}

      {/* Customer Performance Report */}
      {filters.reportType === 'customer-performance' && customerPerformanceData && (
        <ReportErrorBoundary onRetry={() => fetchReport()}>
          <CustomerPerformanceReport data={customerPerformanceData} />
        </ReportErrorBoundary>
      )}

      {/* Advanced/New Reports */}
      {/* Advanced Ticket Summary Report */}
      {filters.reportType === 'ticket-summary' && ticketSummaryData && (
        <ReportErrorBoundary onRetry={() => fetchReport()}>
          <AdvancedTicketSummaryReport reportData={ticketSummaryData} />
        </ReportErrorBoundary>
      )}



      {/* Advanced Machine Analytics Report */}
      {filters.reportType === 'industrial-data' && industrialDataReport && (
        <ReportErrorBoundary onRetry={() => fetchReport()}>
          <AdvancedMachineAnalyticsReport reportData={industrialDataReport} />
        </ReportErrorBoundary>
      )}

      {/* Advanced Zone Performance Report */}
      {filters.reportType === 'zone-performance' && zonePerformanceData && (
        <ReportErrorBoundary onRetry={() => fetchReport()}>
          <AdvancedZonePerformanceReport reportData={zonePerformanceData} />
        </ReportErrorBoundary>
      )}

      {/* Service Person Performance Report */}
      {filters.reportType === 'agent-productivity' && servicePersonPerformanceData && (
        <ReportErrorBoundary onRetry={() => fetchReport()}>
          <ServicePersonPerformanceReport reportData={servicePersonPerformanceData} />
        </ReportErrorBoundary>
      )}

      {/* Service Person Attendance Report */}
      {filters.reportType === 'sla-performance' && servicePersonAttendanceData && (
        <ReportErrorBoundary onRetry={() => fetchReport()}>
          <ServicePersonAttendanceReport reportData={servicePersonAttendanceData} />
        </ReportErrorBoundary>
      )}

      {/* Empty State */}
      {(((filters.reportType === 'offer-summary' || filters.reportType === 'zone-user-offer-summary') && !reportData) || 
        (filters.reportType === 'target-report' && !targetSummary) ||
        (filters.reportType === 'product-type-analysis' && !productTypeAnalysisData) ||
        (filters.reportType === 'customer-performance' && !customerPerformanceData) ||
        (filters.reportType === 'ticket-summary' && !ticketSummaryData) ||
        (filters.reportType === 'industrial-data' && !industrialDataReport) ||
        (filters.reportType === 'zone-performance' && !zonePerformanceData) ||
        (filters.reportType === 'agent-productivity' && !servicePersonPerformanceData) ||
        (filters.reportType === 'sla-performance' && !servicePersonAttendanceData)) && (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-[#979796]" />
            <h3 className="text-lg font-medium text-[#546A7A] mb-2">No Report Generated</h3>
            <p className="text-[#AEBFC3]0 mb-4">
              Select your report parameters and click "Generate Report" to view analytics
            </p>
          </CardContent>
        </Card>
      )}

      {/* Offer Details Dialog */}
      {selectedOfferId && (
        <OfferDetailsDialog
          offerId={selectedOfferId}
          open={isDetailsOpen}
          onClose={handleCloseDetails}
        />
      )}

      {/* Zone Target Details Dialog */}
      {selectedZoneDetails && (
        <ZoneTargetDetailsDialog
          open={isZoneDetailsOpen}
          onClose={() => {
            setIsZoneDetailsOpen(false);
            setSelectedZoneDetails(null);
          }}
          zoneId={selectedZoneDetails.zoneId}
          targetPeriod={selectedZoneDetails.targetPeriod}
          periodType={selectedZoneDetails.periodType as 'MONTHLY' | 'YEARLY'}
        />
      )}

      {/* User Target Details Dialog */}
      {selectedUserDetails && (
        <UserTargetDetailsDialog
          open={isUserDetailsOpen}
          onClose={() => {
            setIsUserDetailsOpen(false);
            setSelectedUserDetails(null);
          }}
          userId={selectedUserDetails.userId}
          targetPeriod={selectedUserDetails.targetPeriod}
          periodType={selectedUserDetails.periodType as 'MONTHLY' | 'YEARLY'}
        />
      )}

    </>
  );
};

export default ReportsClient;

