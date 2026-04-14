'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, FileText, Download, FileDown, BarChart3, Info, Trophy, CheckCircle2, DollarSign, Package } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { UserRole } from '@/types/user.types';
import type { ReportFilters, ReportData } from '@/types/reports';
import { REPORT_TYPES } from '@/types/reports';
import ReportsTable from './ReportsTable';
import OfferDetailsDialog from './OfferDetailsDialog';
import ZoneTargetDetailsDialog from './ZoneTargetDetailsDialog';
import UserTargetDetailsDialog from './UserTargetDetailsDialog';
import ProductTypeAnalysisReport from './ProductTypeAnalysisReport';
import CustomerPerformanceReport from './CustomerPerformanceReport';
import ReportsFilters from './ReportsFilters';
import TargetReportAnalytics from './TargetReportAnalytics';
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
}

const ReportsClient: React.FC<ReportsClientProps> = ({
  initialFilters,
  initialReportData,
  zones: initialZones,
  customers: initialCustomers,
  isZoneUser,
}) => {
  // State for zones and customers (fetched client-side)
  const [zones, setZones] = useState<Array<{ id: number; name: string }>>(initialZones || []);
  const [customers, setCustomers] = useState<Array<{ id: number; companyName: string }>>(initialCustomers || []);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Refs to prevent duplicate API calls (React StrictMode protection)
  const hasInitialCustomersFetched = useRef(false);
  const isCustomersFetching = useRef(false);

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
  
  // Function to fetch customers for a specific zone
  const fetchCustomersForZone = useCallback(async (zoneId?: string) => {
    if (!zoneId) {
      // Reset to all customers
      try {
        const response = await apiService.getCustomers({ isActive: 'true', limit: 1000 });
        const customersData = Array.isArray(response) ? response : (response.data || response.customers || []);
        setCustomers(customersData);
      } catch (error) {
        console.error('Error fetching all customers:', error);
        setCustomers([]);
      }
      return;
    }
    
    setIsLoadingCustomers(true);
    try {
      const response = await apiService.getCustomers({ isActive: 'true', zoneId, limit: 1000 });
      const customersData = Array.isArray(response) ? response : (response.data || response.customers || []);
      setCustomers(customersData);
      // Clear customer filter when zone changes
      setFilters(prev => ({ ...prev, customerId: undefined }));
    } catch (error) {
      console.error('Error fetching customers for zone:', error);
      setCustomers([]);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      
      // Handle target report differently
      if (filters.reportType === 'target-report') {
        const params: any = {
          reportType: 'target-report',
          targetPeriod: filters.targetPeriod,
          periodType: filters.periodType || 'MONTHLY',
        };

        if (filters.zoneId && filters.zoneId !== 'all') {
          params.zoneId = filters.zoneId;
        }

        const response = await apiService.generateReport(params);
        
        if (response.success && response.data) {
          let zt = response.data.zoneTargets || [];
          let ut = response.data.userTargets || [];
          const forcedZoneId = isZoneUser ? (filters.zoneId ? parseInt(filters.zoneId) : (zones?.[0]?.id)) : undefined;
          if (forcedZoneId) {
            zt = (zt || []).filter((t: any) => t?.serviceZoneId === forcedZoneId);
            ut = (ut || []).filter((t: any) => t?.user?.serviceZones?.some?.((sz: any) => sz?.serviceZone?.id === forcedZoneId));
          }
          setZoneTargets(zt);
          setUserTargets(ut);
          setTargetSummary(response.data.summary || {});
          // Clear offer report data
          setOffers([]);
          setReportData(null);
        } else {
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
        if (response.success && response.data) {
          setProductTypeAnalysisData(response.data);
          setOffers([]);
          setReportData(null);
          setZoneTargets([]);
          setUserTargets([]);
          setTargetSummary(null);
        } else {
          toast.error('Failed to load product type analysis');
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
        if (response.success && response.data) {
          let data = response.data;
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
          toast.error('Failed to load customer performance');
        }
      }
      // Handle standard Offer Summary Report
      else {
        const params: any = {
          reportType: reportType,
          page: currentPage,
          limit: 500,
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
        if (filters.search) {
          params.search = filters.search;
        }

        const response = await apiService.generateReport(params);
        
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
        } else {
          toast.error('Failed to load report data');
        }
      }
    } catch (error: any) {
      console.error('Error fetching report:', error);
      toast.error(error?.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage]);

  // Don't auto-fetch on mount - wait for Generate Report button
  // useEffect(() => {
  //   fetchReport();
  // }, [fetchReport]);

  // Fetch customers when zone changes
  useEffect(() => {
    fetchCustomersForZone(filters.zoneId);
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
      link.href = exportUrl;
      link.download = `offer-report-${exportFormat === 'pdf' ? 'pdf' : 'xlsx'}`;
      
      // Get token - check localStorage first (matching axios.ts logic), then cookies
      let token = localStorage.getItem('accessToken') || 
                  localStorage.getItem('token') || 
                  localStorage.getItem('dev_accessToken') || '';
      
      // Fallback to cookies if not in localStorage
      if (!token) {
        token = document.cookie
          .split('; ')
          .find(row => row.startsWith('accessToken=') || row.startsWith('token='))
          ?.split('=')[1] || '';
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

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      link.href = url;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`${exportFormat.toUpperCase()} export started`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to export report');
    }
  }, [filters]);

  const summary = useMemo(() => reportData?.summary || {}, [reportData]);
  const selectedReportType = REPORT_TYPES.find(type => type.value === filters.reportType);

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
                  disabled={(!reportData && !targetSummary) || loading}
                  variant="outline"
                  className="w-full sm:w-auto min-h-[44px] border-[#4F6A64] text-[#4F6A64] hover:bg-[#A2B9AF]/10"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  {loading ? 'Exporting...' : 'Export Excel'}
                </Button>
                <Button 
                  onClick={() => handleExport('pdf')} 
                  disabled={(!reportData && !targetSummary) || loading}
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
                            <span className="font-semibold text-[#546A7A]">{target.serviceZone?.name || 'N/A'}</span>
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
                          <Badge className={`${getAchievementColor(target.achievement)} text-xs font-bold`}>
                            {target.achievement?.toFixed(1) || 0}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`${getAchievementColor(target.expectedAchievement)} text-xs font-bold`}>
                            {target.expectedAchievement?.toFixed(1) || 0}%
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
      {filters.reportType === 'offer-summary' && reportData && offers.length > 0 && (
        <div className="space-y-6">
          {/* Summary Cards - Enhanced Design */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Offers Card */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-[#5D6E73]">Total Offers</CardTitle>
                  <Package className="h-5 w-5 text-[#6F8A9D]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-[#546A7A]">
                    {totalOffers}
                  </div>
                  <p className="text-xs text-[#AEBFC3]0">
                    Total offers found matching current filters
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total Offer Value Card */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-[#5D6E73]">Total Offer Value</CardTitle>
                  <DollarSign className="h-5 w-5 text-[#CE9F6B]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-[#976E44]" title={formatINRFull(summary.totalOfferValue || 0)}>
                    {formatCrLakh(summary.totalOfferValue || 0)}
                  </div>
                  <p className="text-xs text-[#AEBFC3]0">
                    Avg: <span className="font-semibold text-[#5D6E73]">
                      {formatCrLakh((summary.totalOfferValue || 0) / Math.max(summary.totalOffers || 0, 1))}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total PO Value Card */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-[#5D6E73]">Total PO Value</CardTitle>
                  <CheckCircle2 className="h-5 w-5 text-[#82A094]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-[#4F6A64]" title={formatINRFull(summary.totalPoValue || 0)}>
                    {formatCrLakh(summary.totalPoValue || 0)}
                  </div>
                  <p className="text-xs text-[#AEBFC3]0">
                    Conversion: <span className="font-semibold text-[#5D6E73]">
                      {(summary.conversionRate || 0).toFixed(1)}%
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Won Offers Card */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-[#A2B9AF]/10 to-[#A2B9AF]/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-[#5D6E73]">Won Offers</CardTitle>
                  <Trophy className="h-5 w-5 text-[#CE9F6B]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-[#4F6A64]">
                    {summary.wonOffers || 0}
                  </div>
                  <p className="text-xs text-[#5D6E73]">
                    Success Rate: <span className="font-semibold text-[#4F6A64]">
                      {(summary.successRate || 0).toFixed(1)}%
                    </span>
                    <span className="text-[#AEBFC3]0 ml-1 italic">
                      (out of {totalOffers} total offers)
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Won Offers Details Section */}
          {(summary.wonOffers || 0) > 0 && (
            <Card className="border-0 shadow-md bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-6 w-6 text-[#CE9F6B]" />
                    <div>
                      <CardTitle className="text-lg">Won Offers Summary</CardTitle>
                      <CardDescription>Detailed breakdown of successfully won offers</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-[#A2B9AF]">
                    <p className="text-sm text-[#5D6E73] font-medium">Won Offers Count</p>
                    <p className="text-2xl font-bold text-[#4F6A64] mt-2">
                      {summary.wonOffers || 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-[#A2B9AF]">
                    <p className="text-sm text-[#5D6E73] font-medium">Won Offer Value</p>
                    <p className="text-2xl font-bold text-[#4F6A64] mt-2" title={formatINRFull(summary.wonOfferValue || 0)}>
                      {formatCrLakh(summary.wonOfferValue || 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-[#A2B9AF]">
                    <p className="text-sm text-[#5D6E73] font-medium">Won PO Value</p>
                    <p className="text-2xl font-bold text-[#4F6A64] mt-2" title={formatINRFull(summary.wonPoValue || 0)}>
                      {formatCrLakh(summary.wonPoValue || 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-[#A2B9AF]">
                    <p className="text-sm text-[#5D6E73] font-medium">Success Rate</p>
                    <p className="text-2xl font-bold text-[#4F6A64] mt-2">
                      {(summary.successRate || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
        <ProductTypeAnalysisReport data={productTypeAnalysisData} />
      )}

      {/* Customer Performance Report */}
      {filters.reportType === 'customer-performance' && customerPerformanceData && (
        <CustomerPerformanceReport data={customerPerformanceData} />
      )}

      {/* Empty State */}
      {((filters.reportType === 'offer-summary' && !reportData) || 
        (filters.reportType === 'target-report' && !targetSummary) ||
        (filters.reportType === 'product-type-analysis' && !productTypeAnalysisData) ||
        (filters.reportType === 'customer-performance' && !customerPerformanceData)) && (
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

