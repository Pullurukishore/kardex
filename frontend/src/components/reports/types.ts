import { DateRange } from 'react-day-picker';

export interface ReportFilters {
  dateRange: DateRange | undefined;
  zoneId?: string;
  reportType: string;
  customerId?: string;
  assetId?: string;
}

export interface MachineDowntime {
  machineId: string;
  model: string;
  serialNo: string;
  customer: string;
  totalDowntimeMinutes: number;
  incidents: number;
  openIncidents: number;
  resolvedIncidents: number;
}

export interface DetailedDowntime extends MachineDowntime {
  zone: string;
  ticketId: number;
  ticketTitle: string;
  status: string;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
  downtimeMinutes: number;
  assignedTo: string;
}

export interface ServicePersonReport {
  id: number;
  name: string;
  email: string;
  phone?: string;
  zones: Array<{ id: number; name: string }>;
  summary: {
    totalWorkingDays?: number; // Legacy field for compatibility
    presentDays?: number; // New field from backend
    totalHours: number;
    absentDays: number;
    autoCheckouts: number;
    activitiesLogged?: number; // Legacy field for compatibility
    totalActivities?: number; // New field from backend
    averageHoursPerDay: number;
    // Performance metrics
    totalTickets: number;
    ticketsResolved: number;
    averageResolutionTimeHours: number;
    averageTravelTimeHours: number;
    averageOnsiteTimeHours: number;
    performanceScore: number;
  };
  flags: Array<{
    type: string;
    count: number;
    message: string;
  }>;
  dayWiseBreakdown: Array<{
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    totalHours: number;
    attendanceStatus: string;
    activityCount: number;
    flags: Array<{
      type: string;
      message: string;
    }>;
    activities: Array<{
      id: number;
      activityType: string;
      title: string;
      startTime: string;
      endTime: string | null;
      duration: number | null;
      location: string | null;
      ticketId: number | null;
      ticket: any;
    }>;
  }>;
}

export interface ReportData {
  summary: any;
  statusDistribution?: Record<string, number>;
  priorityDistribution?: Record<string, number>;
  callTypeDistribution?: Record<string, number>;
  slaDistribution?: Record<string, number>;
  zoneDistribution?: Array<{
    zoneId: number;
    zoneName: string;
    count: number;
  }>;
  customerDistribution?: Array<{
    customerId: number;
    customerName: string;
    count: number;
  }>;
  assigneeDistribution?: Array<{
    assigneeId: number;
    assigneeName: string;
    count: number;
  }>;
  dailyTrends?: Array<{
    date: string;
    created: number;
    resolved: number;
    escalated?: number;
    assigned?: number;
  }>;
  recentTickets?: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    customerName: string;
    zoneName: string;
    assigneeName: string;
    isEscalated: boolean;
    slaStatus: string;
    hasRating: boolean;
    rating: number | null;
  }>;
  customerPerformanceMetrics?: Array<{
    customerId: number;
    customerName: string;
    totalTickets: number;
    criticalIssues: number;
    highPriorityIssues: number;
    escalatedIssues: number;
    repeatIssues: number;
    avgResolutionTimeMinutes: number;
    avgResolutionTimeHours: number;
    machineHealthScore: number;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  insights?: {
    topPerformingZone: string;
    mostActiveCustomer: string;
    topAssignee: string;
    worstPerformingCustomer: string;
    avgTravelTimeFormatted: string;
  };
  ratingDistribution?: Record<number, number>;
  customerRatings?: Record<string, any>;
  zones?: Array<any>;
  totalZones?: number;
  agents?: Array<any>;
  breachedTickets?: Array<any>;
  recentFeedbacks?: Array<any>;
  performanceMetrics?: any;
  overallStats?: any;
  machineDowntime?: MachineDowntime[];
  detailedDowntime?: DetailedDowntime[];
  trends?: Array<{
    date: string;
    ticketsCreated: number;
    ticketsResolved: number;
    avgRating: number;
  }>;
  zonePerformance?: Array<{
    name: string;
    efficiency: number;
    ticketCount: number;
    customerCount: number;
  }>;
  kpis?: {
    firstCallResolution: number;
    slaCompliance: number;
    customerRetention: number;
    operationalEfficiency: number;
  };
  // Service Person Reports specific properties
  reports?: ServicePersonReport[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  dateRange?: {
    from: string;
    to: string;
    totalDays: number;
  };
}

export interface ReportType {
  value: string;
  label: string;
  description: string;
  icon: any;
  color: string;
}

export interface Zone {
  id: number;
  name: string;
}

export interface Customer {
  id: number;
  companyName: string;
}

export interface Asset {
  id: string;
  name?: string;
  machineId?: string;
  model?: string;
  serialNo?: string;
}

export const REPORT_TYPES: ReportType[] = [
  {
    value: 'ticket-summary',
    label: 'Ticket Analytics Report',
    description: 'Comprehensive ticket analytics with status, priority trends, and resolution metrics',
    icon: 'BarChart3',
    color: 'from-[#6F8A9D] to-[#546A7A]'
  },

  {
    value: 'industrial-data',
    label: 'Machine Reports',
    description: 'Machine downtime analysis, equipment performance tracking, and maintenance efficiency metrics',
    icon: 'Settings',
    color: 'from-[#82A094] to-[#4F6A64]'
  },
  /*
  {
    value: 'zone-performance',
    label: 'Zone Performance Report',
    description: 'Service zone efficiency, resource utilization, and performance benchmarks',
    icon: 'Target',
    color: 'from-[#6F8A9D] to-[#546A7A]'
  },
  */
  {
    value: 'service-person-reports',
    label: 'Service Person Performance Report',
    description: 'Comprehensive performance analytics for all service persons and zone users including productivity, resolution rates, and efficiency metrics',
    icon: 'Users',
    color: 'from-[#6F8A9D] to-[#546A7A]'
  },
  /*
  {
    value: 'service-person-attendance',
    label: 'Service Person Attendance Report',
    description: 'Comprehensive attendance tracking with date ranges, activity logs, and performance metrics',
    icon: 'UserCheck',
    color: 'from-[#82A094] to-[#4F6A64]'
  }
  */
];

export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#4ECDC4', '#45B7D1'];

export const PRIORITY_COLORS = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  CRITICAL: '#7C3AED'
};

export const STATUS_COLORS: Record<string, string> = {
  // Initial/Open States
  OPEN: '#3B82F6',                    // Blue
  ASSIGNED: '#8B5CF6',                 // Purple

  // In Progress States
  IN_PROCESS: '#F59E0B',               // Amber
  IN_PROGRESS: '#F97316',              // Orange

  // Onsite Visit States
  ONSITE_VISIT: '#06B6D4',             // Cyan
  ONSITE_VISIT_PLANNED: '#0891B2',     // Cyan-600
  ONSITE_VISIT_STARTED: '#0E7490',     // Cyan-700
  ONSITE_VISIT_REACHED: '#155E75',     // Cyan-800
  ONSITE_VISIT_IN_PROGRESS: '#164E63', // Cyan-900
  ONSITE_VISIT_RESOLVED: '#0D9488',    // Teal-600
  ONSITE_VISIT_PENDING: '#14B8A6',     // Teal-500
  ONSITE_VISIT_COMPLETED: '#2DD4BF',   // Teal-400

  // Waiting/Pending States
  WAITING_CUSTOMER: '#FBBF24',         // Yellow-400
  ON_HOLD: '#FB923C',                  // Orange-400

  // Spare Parts States
  SPARE_PARTS_NEEDED: '#A855F7',       // Purple-500
  SPARE_PARTS_BOOKED: '#9333EA',       // Purple-600
  SPARE_PARTS_DELIVERED: '#7C3AED',    // Purple-700

  // Purchase Order States
  PO_NEEDED: '#EC4899',                // Pink-500
  PO_RECEIVED: '#DB2777',              // Pink-600
  PO_REACHED: '#BE185D',               // Pink-700

  // Resolution States
  RESOLVED: '#10B981',                 // Emerald-500
  CLOSED_PENDING: '#84CC16',           // Lime-500
  CLOSED: '#6B7280',                   // Gray-500

  // Issue/Problem States
  ESCALATED: '#EF4444',                // Red-500
  CANCELLED: '#9CA3AF',                // Gray-400
  REOPENED: '#F87171'                  // Red-400
};
