export interface DateRange {
  from: Date;
  to: Date;
}

export interface ReportFilters {
  dateRange: DateRange | undefined;
  zoneId?: string;
  reportType: string;
  customerId?: string;
  assetId?: string;
  productType?: string;
  stage?: string;
  search?: string;
  // Target report specific filters
  targetPeriod?: string;
  periodType?: 'MONTHLY' | 'YEARLY';
}

export interface ReportData {
  summary: any;
  statusDistribution?: Record<string, number>;
  stageDistribution?: Record<string, number>;
  priorityDistribution?: Record<string, number>;
  productTypeDistribution?: Record<string, number>;
  zonePerformance?: Array<{
    zoneId: number;
    zoneName: string;
    count: number;
    offerValue: number;
    poValue: number;
  }>;
  customerPerformance?: Array<{
    customerId: number;
    customerName: string;
    count: number;
    offerValue: number;
    poValue: number;
  }>;
  assigneePerformance?: Array<{
    assigneeId: number;
    assigneeName: string;
    count: number;
    offerValue: number;
  }>;
  dailyTrends?: Array<{
    date: string;
    created: number;
    won: number;
    lost: number;
    quoted: number;
  }>;
  recentOffers?: Array<{
    id: number;
    offerReferenceNumber: string;
    title: string | null;
    status: string;
    stage: string;
    priority: string | null;
    productType: string | null;
    offerValue: number;
    customerName: string;
    zoneName: string;
    assigneeName: string;
    createdAt: Date;
  }>;
  // Zone Performance Report
  zones?: Array<{
    zoneId: number;
    zoneName: string;
    totalOffers: number;
    activeOffers: number;
    wonOffers: number;
    lostOffers: number;
    totalValue: number;
    wonValue: number;
    avgOfferValue: number;
    winRate: number;
    totalUsers: number;
    totalCustomers: number;
  }>;
  // User Productivity Report
  users?: Array<{
    userId: number;
    userName: string;
    email: string;
    role: string;
    zones: string[];
    createdOffersCount: number;
    assignedOffersCount: number;
    totalOffers: number;
    wonOffers: number;
    lostOffers: number;
    totalValue: number;
    wonValue: number;
    winRate: number;
  }>;
  // Customer Analysis Report
  customers?: Array<{
    customerId: number;
    customerName: string;
    location: string | null;
    industry: string | null;
    zoneName: string;
    totalOffers: number;
    activeOffers: number;
    wonOffers: number;
    lostOffers: number;
    totalValue: number;
    wonValue: number;
    avgOfferValue: number;
    winRate: number;
  }>;
  // Product Type Analysis Report
  productTypes?: Array<{
    productType: string;
    totalOffers: number;
    activeOffers: number;
    wonOffers: number;
    lostOffers: number;
    totalValue: number;
    wonValue: number;
    avgOfferValue: number;
    winRate: number;
  }>;
  // Executive Summary Report
  offerSummary?: {
    totalOffers: number;
    wonOffers: number;
    lostOffers: number;
    activeOffers: number;
    totalValue: number;
    wonValue: number;
    winRate: number;
  };
  zoneSummary?: Array<{
    zoneName: string;
    offerCount: number;
    totalValue: number;
  }>;
  userSummary?: Array<{
    userName: string;
    offerCount: number;
    totalValue: number;
  }>;
  customerSummary?: Array<{
    customerName: string;
    offerCount: number;
    totalValue: number;
  }>;
  productSummary?: Array<{
    productType: string;
    offerCount: number;
    totalValue: number;
  }>;
  dateRange?: {
    from: string;
    to: string;
    days: number;
  };
}

export interface ReportType {
  value: string;
  label: string;
  description: string;
  icon: string;
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

export const REPORT_TYPES: ReportType[] = [
  {
    value: 'ticket-summary',
    label: 'Ticket Analytics Report',
    description: 'Comprehensive ticket analytics with status, priority trends, and resolution metrics',
    icon: 'BarChart3',
    color: 'from-[#96AEC2] to-[#6F8A9D]' // Blue 1 to Blue 2
  },

  {
    value: 'industrial-data',
    label: 'Machine Reports',
    description: 'Machine downtime analysis, equipment performance tracking, and maintenance efficiency metrics',
    icon: 'Settings',
    color: 'from-[#A2B9AF] to-[#82A094]' // Green 1 to Green 2
  },
  {
    value: 'zone-performance',
    label: 'Zone Performance Report',
    description: 'Service zone efficiency, resource utilization, and performance benchmarks',
    icon: 'Target',
    color: 'from-[#6F8A9D] to-[#546A7A]' // Blue 2 to Blue 3
  },
  {
    value: 'agent-productivity',
    label: 'Service Person Performance Report',
    description: 'Comprehensive performance analytics for all service persons including productivity, resolution rates, and efficiency metrics',
    icon: 'Users',
    color: 'from-[#82A094] to-[#4F6A64]' // Green 2 to Green 3
  },

  {
    value: 'sla-performance',
    label: 'Service Person Attendance Report',
    description: 'Comprehensive attendance tracking with date ranges, activity logs, and performance metrics',
    icon: 'UserCheck',
    color: 'from-[#92A2A5] to-[#5D6E73]' // Silver 2 to Silver 3
  },
  {
    value: 'offer-summary',
    label: 'Offer Summary Report',
    description: 'Comprehensive offer analytics with status, stage, priority trends, daily trends, top customers, and detailed offer information',
    icon: 'FileText',
    color: 'from-[#96AEC2] to-[#6F8A9D]', // Blue 1 to Blue 2
  },
];

// Ticket-specific report types (matching backend implementation)
export const TICKET_REPORT_TYPES: ReportType[] = [
  {
    value: 'ticket-summary',
    label: 'Ticket Summary Report',
    description: 'Comprehensive ticket analytics with status distribution, priority trends, resolution times, and performance metrics',
    icon: 'Ticket',
    color: 'from-[#6F8A9D] to-[#546A7A]', // Blue 2 to Blue 3
  },
  {
    value: 'sla-performance',
    label: 'SLA Performance Report',
    description: 'SLA compliance analysis with breach rates, response times, and resolution performance metrics',
    icon: 'Clock',
    color: 'from-[#E17F70] to-[#9E3B47]', // Red 1 to Red 2
  },
  {
    value: 'zone-performance',
    label: 'Zone Performance Report',
    description: 'Zone-wise performance analysis with ticket handling metrics, resolution rates, and comparative performance',
    icon: 'MapPin',
    color: 'from-[#96AEC2] to-[#6F8A9D]', // Blue 1 to Blue 2
  },
  {
    value: 'agent-productivity',
    label: 'Agent Productivity Report',
    description: 'Service agent performance analysis with ticket handling metrics, resolution rates, and productivity trends',
    icon: 'Users',
    color: 'from-[#CE9F6B] to-[#976E44]', // Sand 2 to Sand 3
  },
  {
    value: 'industrial-data',
    label: 'Industrial Data Report',
    description: 'Equipment and asset performance analysis with downtime metrics, maintenance schedules, and operational insights',
    icon: 'Activity',
    color: 'from-[#EEC18F] to-[#CE9F6B]', // Sand 1 to Sand 2
  },
  {
    value: 'executive-summary',
    label: 'Executive Summary Report',
    description: 'High-level overview of key metrics, trends, and performance indicators for management reporting',
    icon: 'BarChart3',
    color: 'from-[#82A094] to-[#4F6A64]', // Green 2 to Green 3
  },
  {
    value: 'her-analysis',
    label: 'HER Analysis Report',
    description: 'Detailed analysis of ticket resolution patterns, response times, and efficiency metrics',
    icon: 'TrendingUp',
    color: 'from-[#92A2A5] to-[#5D6E73]', // Silver 2 to Silver 3
  },
];

// Sales-specific report types
export const SALES_REPORT_TYPES: ReportType[] = [
  {
    value: 'offer-summary',
    label: 'Offer Summary Report',
    description: 'Comprehensive offer analytics with status, stage, priority trends, daily trends, top customers, and detailed offer information',
    icon: 'FileText',
    color: 'from-[#96AEC2] to-[#6F8A9D]', // Blue 1 to Blue 2
  },
];

// Zone User specific report types - same as REPORT_TYPES but with offer-summary replaced by zone-user-offer-summary
export const ZONE_USER_REPORT_TYPES: ReportType[] = [
  {
    value: 'ticket-summary',
    label: 'Ticket Analytics Report',
    description: 'Comprehensive ticket analytics with status, priority trends, and resolution metrics',
    icon: 'BarChart3',
    color: 'from-[#96AEC2] to-[#6F8A9D]' // Blue 1 to Blue 2
  },
  {
    value: 'industrial-data',
    label: 'Machine Reports',
    description: 'Machine downtime analysis, equipment performance tracking, and maintenance efficiency metrics',
    icon: 'Settings',
    color: 'from-[#A2B9AF] to-[#82A094]' // Green 1 to Green 2
  },
  {
    value: 'zone-performance',
    label: 'Zone Performance Report',
    description: 'Service zone efficiency, resource utilization, and performance benchmarks',
    icon: 'Target',
    color: 'from-[#6F8A9D] to-[#546A7A]' // Blue 2 to Blue 3
  },
  {
    value: 'agent-productivity',
    label: 'Service Person Performance Report',
    description: 'Comprehensive performance analytics for all service persons including productivity, resolution rates, and efficiency metrics',
    icon: 'Users',
    color: 'from-[#82A094] to-[#4F6A64]' // Green 2 to Green 3
  },
  {
    value: 'sla-performance',
    label: 'Service Person Attendance Report',
    description: 'Comprehensive attendance tracking with date ranges, activity logs, and performance metrics',
    icon: 'UserCheck',
    color: 'from-[#92A2A5] to-[#5D6E73]' // Silver 2 to Silver 3
  },
  {
    value: 'zone-user-offer-summary',
    label: 'My Offers Summary',
    description: 'View and analyze all offers you have created or been assigned to. Includes status, stage, value, and performance metrics for your offers only.',
    icon: 'FileText',
    color: 'from-[#EEC18F] to-[#CE9F6B]', // Sand 1 to Sand 2
  },
];

// Zone Manager specific report types - includes offer-summary to see ALL zone offers
export const ZONE_MANAGER_REPORT_TYPES: ReportType[] = [
  {
    value: 'offer-summary',
    label: 'Zone Offer Summary',
    description: 'View and analyze ALL offers in your zone. Comprehensive offer analytics with status, stage, value, and performance metrics.',
    icon: 'FileText',
    color: 'from-[#96AEC2] to-[#6F8A9D]', // Blue 1 to Blue 2
  },
  {
    value: 'ticket-summary',
    label: 'Ticket Analytics Report',
    description: 'Comprehensive ticket analytics with status, priority trends, and resolution metrics',
    icon: 'BarChart3',
    color: 'from-[#96AEC2] to-[#6F8A9D]' // Blue 1 to Blue 2
  },
  {
    value: 'industrial-data',
    label: 'Machine Reports',
    description: 'Machine downtime analysis, equipment performance tracking, and maintenance efficiency metrics',
    icon: 'Settings',
    color: 'from-[#A2B9AF] to-[#82A094]' // Green 1 to Green 2
  },
  {
    value: 'zone-performance',
    label: 'Zone Performance Report',
    description: 'Service zone efficiency, resource utilization, and performance benchmarks',
    icon: 'Target',
    color: 'from-[#6F8A9D] to-[#546A7A]' // Blue 2 to Blue 3
  },
  {
    value: 'agent-productivity',
    label: 'Service Person Performance Report',
    description: 'Comprehensive performance analytics for all service persons including productivity, resolution rates, and efficiency metrics',
    icon: 'Users',
    color: 'from-[#82A094] to-[#4F6A64]' // Green 2 to Green 3
  },
  {
    value: 'sla-performance',
    label: 'Service Person Attendance Report',
    description: 'Comprehensive attendance tracking with date ranges, activity logs, and performance metrics',
    icon: 'UserCheck',
    color: 'from-[#92A2A5] to-[#5D6E73]' // Silver 2 to Silver 3
  },
];

// Kardex Company Colors for Charts
export const COLORS = ['#96AEC2', '#A2B9AF', '#6F8A9D', '#82A094', '#546A7A', '#4F6A64', '#EEC18F', '#E17F70'];

export const PRIORITY_COLORS = {
  LOW: '#A2B9AF',      // Green 1
  MEDIUM: '#EEC18F',   // Sand 1
  HIGH: '#E17F70',     // Red 1
  CRITICAL: '#9E3B47', // Red 2
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#979796',      // Grey 3
  OPEN: '#96AEC2',       // Blue 1
  IN_PROGRESS: '#EEC18F', // Sand 1
  QUOTED: '#6F8A9D',     // Blue 2
  NEGOTIATION: '#CE9F6B', // Sand 2
  WON: '#82A094',        // Green 2
  LOST: '#E17F70',       // Red 1
  ON_HOLD: '#757777',    // Silver 1
  CANCELLED: '#979796',  // Grey 3
};

export const STAGE_COLORS: Record<string, string> = {
  INITIAL: '#96AEC2',      // Blue 1
  PROPOSAL_SENT: '#6F8A9D', // Blue 2
  NEGOTIATION: '#EEC18F',   // Sand 1
  PO_RECEIVED: '#92A2A5',   // Silver 2
  WON: '#82A094',           // Green 2
  LOST: '#E17F70',          // Red 1
};

export const PRODUCT_TYPE_COLORS: Record<string, string> = {
  RELOCATION: '#96AEC2',     // Blue 1
  CONTRACT: '#A2B9AF',       // Green 1
  SPARE_PARTS: '#EEC18F',    // Sand 1
  KARDEX_CONNECT: '#6F8A9D', // Blue 2
  UPGRADE_KIT: '#82A094',    // Green 2
  SOFTWARE: '#546A7A',       // Blue 3
  OTHERS: '#E17F70',         // Red 1
  BD_SPARE: '#4F6A64',       // Green 3
  RETROFIT_KIT: '#92A2A5',   // Silver 2
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  RELOCATION: 'Relocation',
  CONTRACT: 'Contract',
  SPARE_PARTS: 'Spare Parts',
  KARDEX_CONNECT: 'Kardex Connect',
  UPGRADE_KIT: 'Optilife Upgrade',
  SOFTWARE: 'Software',
  OTHERS: 'Repairs & Others',
  BD_SPARE: 'BD Spare',
  RETROFIT_KIT: 'Retrofit Kit',
};

export const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS);

// Comprehensive Dashboard Types
export interface ComprehensiveDashboardData {
  summary: {
    totalOffers: number;
    totalOfferValue: number;
    totalOrdersReceived: number;
    totalOrderBooking: number;
    hitRate: number;
  };
  zoneData: Array<{
    zone: string;
    totalOffers: number;
    offerValue: number;
    ordersReceived: number;
    openFunnel: number;
    orderBooking: number;
    budgetFor2025: number;
    relativeRU: number;
    bookingPercentage: number;
  }>;
  monthData: Array<{
    monthName: string;
    totalOffers: number;
    offerValue: number;
    ordersReceived: number;
    orderBooking: number;
    ruTarget: number;
    devOnRuTarget: number;
    offerRuTarget: number;
    devOfferVsBooked: number;
    offerRuTarget2: number;
    devOfferVsBooked2: number;
  }>;
  productTypeData: Array<{
    productType: string;
    offerValue: number;
    count: number;
  }>;
  zoneOfferValues: Array<{
    zone: string;
    value: number;
  }>;
  monthZoneData: Array<{
    month: string;
    [key: string]: number | string;
  }>;
  filters: {
    zones: Array<{ id: number; name: string }>;
    users: Array<{ id: number; name: string }>;
    productTypes: string[];
  };
}
