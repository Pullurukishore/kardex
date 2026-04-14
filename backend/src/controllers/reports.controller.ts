import { Request, Response } from 'express';
import { format, subDays, eachDayOfInterval, differenceInMinutes, getDay, setHours, setMinutes, setSeconds, setMilliseconds, addDays, startOfDay } from 'date-fns';
import { calculateBusinessHoursInMinutes, calculateTicketResolutionMinutes, calculateTravelMinutes, calculateOnsiteResolutionMinutes, BUSINESS_MINUTES_PER_DAY, formatMinutesToBusinessDH } from '../utils/dateUtils';
import { generatePdf, getPdfColumns } from '../utils/pdfGenerator';
import { generateExcel, getExcelColumns } from '../utils/excelGenerator';
import prisma from '../config/db';
import { logger } from '../utils/logger';

// Define enums since they're not exported from Prisma client
enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  ASSIGNED = 'ASSIGNED',
  PENDING = 'PENDING'
}

enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

enum SLAStatus {
  ON_TIME = 'ON_TIME',
  BREACHED = 'BREACHED',
  AT_RISK = 'AT_RISK'
}

enum UserRole {
  ADMIN = 'ADMIN',
  ZONE_USER = 'ZONE_USER',
  SERVICE_PERSON = 'SERVICE_PERSON'
}

// Define interfaces for report data
type TicketSummaryData = {
  tickets: any[];
  summary: any;
  statusDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
  dailyTrends: Array<{ date: string; created: number; resolved: number }>;
};

type SlaPerformanceData = {
  breachedTickets: any[];
  summary: any;
  prioritySla: Record<string, any>;
};

type CustomerSatisfactionData = {
  recentFeedbacks: any[];
  ratingDistribution: Record<number, number>;
  customerRatings: Record<string, any>;
};

type ZonePerformanceData = {
  zones: any[];
  summary: any;
};

type AgentProductivityData = {
  agents: any[];
  summary: any;
};

type IndustrialZoneData = {
  zoneUsers: any[];
  servicePersons: any[];
  machineDowntime: any[];
  detailedDowntime: any[];
  summary: any;
  zoneName: string;
  zoneId: number;
};


// Report filters interface

interface ReportFilters {
  from?: string;
  to?: string;
  zoneId?: string;
  reportType: string;
  customerId?: string;
  assetId?: string;
  productType?: string;
  stage?: string;
  page?: string;
  limit?: string;
  search?: string;
  createdById?: string;
}

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { from, to, zoneId, reportType, customerId, assetId, productType, stage, page, limit, search, createdById } = req.query as unknown as ReportFilters;

    // Parse pagination params with defaults
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 500; // Default 500 per page

    // Parse dates and ensure proper time is set with timezone consideration
    const userTimeZone = 'Asia/Kolkata'; // Set your timezone here

    // Create dates in the user's timezone
    const now = new Date();
    let startDate = from ? new Date(from) : subDays(now, 30);
    let endDate = to ? new Date(to) : now;

    // Validate dates
    if (isNaN(startDate.getTime())) startDate = subDays(now, 30);
    if (isNaN(endDate.getTime())) endDate = now;


    // Set start of day for start date (00:00:00.000) in local time
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);

    // Set end of day for end date (23:59:59.999) in local time
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

    // Save local dates before turning them into UTC
    const localStartDate = new Date(startDate.getTime());
    const localEndDate = new Date(endDate.getTime());

    // Adjust for timezone offset to ensure we get the correct UTC time
    const tzOffset = startDate.getTimezoneOffset() * 60000;
    const startUTC = new Date(startDate.getTime() - tzOffset);
    const endUTC = new Date(endDate.getTime() - tzOffset);





    // Use the UTC dates for the query
    startDate = startUTC;
    endDate = endUTC;

    const isOfferReport = ['offer-summary', 'zone-user-offer-summary', 'target-report', 'product-type-analysis', 'customer-performance'].includes(reportType);

    const whereClause: any = isOfferReport
      ? {
        offerMonth: {
          gte: format(localStartDate, 'yyyy-MM'),
          lte: format(localEndDate, 'yyyy-MM'),
        }
      }
      : {
        OR: [
          {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            status: { in: ['RESOLVED', 'CLOSED'] },
            updatedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        ]
      };

    if (zoneId) {
      whereClause.zoneId = parseInt(zoneId);
    }

    // Add additional filters for offer reports
    if (customerId) {
      whereClause.customerId = parseInt(customerId as string);
    }
    if (assetId) {
      whereClause.assetId = parseInt(assetId as string);
    }
    // Add productType filter for offer reports
    if (productType) {
      whereClause.productType = productType;
    }
    // Add stage filter for offer reports
    if (stage) {
      whereClause.stage = stage;
    }
    // Add createdById filter for offer reports
    if (createdById) {
      whereClause.createdById = parseInt(createdById as string);
    }
    // Add search filter for offer reports
    if (search) {
      whereClause.OR = [
        { offerReferenceNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { contactPersonName: { contains: search, mode: 'insensitive' } },
        { poNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    switch (reportType) {
      case 'ticket-summary':
        return await generateTicketSummaryReport(res, whereClause, startDate, endDate);
      case 'sla-performance':
        return await generateSlaPerformanceReport(res, whereClause, startDate, endDate);

      case 'zone-performance':
        return await generateZonePerformanceReport(res, whereClause, startDate, endDate);
      case 'agent-productivity':
        return await generateAgentProductivityReport(res, whereClause, startDate, endDate);
      case 'industrial-data':
        return await generateIndustrialDataReport(res, whereClause, startDate, endDate, { customerId, assetId });
      case 'executive-summary':
        return await generateExecutiveSummaryReport(res, whereClause, startDate, endDate);
      case 'her-analysis':
        return await generateHerAnalysisReport(res, whereClause, startDate, endDate);
      // Offer Funnel Reports
      case 'offer-summary':
      case 'zone-user-offer-summary':
        return await generateOfferSummaryReport(res, whereClause, startDate, endDate, pageNum, limitNum);
      case 'target-report':
        return await generateTargetReport(res, whereClause, startDate, endDate);
      case 'product-type-analysis':
        return await generateProductTypeAnalysisReport(res, whereClause, startDate, endDate);
      case 'customer-performance':
        return await generateCustomerPerformanceReport(res, whereClause, startDate, endDate);
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
  } catch (error: any) {
    logger.error('Global generate report error:', {
      message: error.message,
      stack: error.stack,
      query: req.query
    });
    return res.status(500).json({
      error: 'Failed to generate report',
      details: error.message
    });
  }
};

;

// Helper functions for different report types
async function generateTicketSummaryReport(res: Response, whereClause: any, startDate: Date, endDate: Date) {
  // Comprehensive data fetching with all necessary relations
  const [
    tickets,
    statusDistribution,
    priorityDistribution,
    slaDistribution,
    zoneDistribution,
    customerDistribution,
    assigneeDistribution
  ] = await Promise.all([
    // Main tickets with all relations
    prisma.ticket.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        isEscalated: true,
        slaDueAt: true,
        createdAt: true,
        updatedAt: true,
        visitStartedAt: true,
        visitReachedAt: true,
        visitInProgressAt: true,
        visitCompletedDate: true,
        actualResolutionTime: true,
        relatedMachineIds: true,
        customerId: true,
        zoneId: true,
        assignedToId: true,
        assetId: true,
        customer: { select: { id: true, companyName: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        zone: { select: { id: true, name: true } },
        statusHistory: {
          select: { status: true, changedAt: true },
          orderBy: { changedAt: 'desc' }
        },
        feedbacks: { select: { id: true } },
        rating: { select: { rating: true } }
      }
    }),
    // Status distribution
    prisma.ticket.groupBy({
      by: ['status'],
      where: whereClause,
      _count: true,
    }),
    // Priority distribution
    prisma.ticket.groupBy({
      by: ['priority'],
      where: whereClause,
      _count: true,
    }),
    // SLA status distribution
    prisma.ticket.groupBy({
      by: ['slaStatus'],
      where: whereClause,
      _count: true,
    }),
    // Zone-wise distribution
    prisma.ticket.groupBy({
      by: ['zoneId'],
      where: whereClause,
      _count: true,
    }),
    // Customer-wise distribution (all customers)
    prisma.ticket.groupBy({
      by: ['customerId'],
      where: whereClause,
      _count: true,
      orderBy: { _count: { customerId: 'desc' } }
    }),
    // Assignee distribution
    prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: whereClause,
      _count: true,
    })
  ]);

  // Optimized daily trends using only two bulk queries
  const [trendCreated, trendResolved] = await Promise.all([
    prisma.ticket.findMany({
      where: whereClause,
      select: { createdAt: true, isEscalated: true, escalatedAt: true, status: true, updatedAt: true }
    }),
    prisma.ticketStatusHistory.findMany({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] },
        changedAt: { gte: startDate, lte: endDate },
        ticket: whereClause
      },
      select: { changedAt: true }
    })
  ]);

  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
  const dailyTrends = dateRange.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dStart = startOfDay(new Date(date));
    const dEnd = new Date(dStart);
    dEnd.setHours(23, 59, 59, 999);

    return {
      date: dateStr,
      created: trendCreated.filter(t => t.createdAt >= dStart && t.createdAt <= dEnd).length,
      resolved: trendResolved.filter(h => h.changedAt >= dStart && h.changedAt <= dEnd).length,
      escalated: trendCreated.filter(t => t.isEscalated && t.escalatedAt && t.escalatedAt >= dStart && t.escalatedAt <= dEnd).length,
      assigned: trendCreated.filter(t => t.status === 'ASSIGNED' && t.updatedAt >= dStart && t.updatedAt <= dEnd).length
    };
  });

  // Calculate average resolution time
  const resolvedTickets = tickets.filter((t: { status: string }) =>
    t.status === 'RESOLVED' || t.status === 'CLOSED'
  );

  // Calculate average resolution time
  let avgResolutionTime = 0;
  if (resolvedTickets.length > 0) {
    let totalTime = 0;
    let validTickets = 0;

    for (const ticket of resolvedTickets) {
      const resolutionMinutes = calculateTicketResolutionMinutes(
        ticket.actualResolutionTime,
        ticket.relatedMachineIds,
        ticket.createdAt,
        ticket.updatedAt,
        ticket.visitCompletedDate
      );

      // Only include tickets where resolutionMinutes > 0
      if (resolutionMinutes > 0) {
        totalTime += resolutionMinutes;
        validTickets++;
        (ticket as any).calculatedResolutionMinutes = resolutionMinutes;
      }
    }

    if (validTickets > 0) {
      avgResolutionTime = Math.round(totalTime / validTickets);
    }
  }

  // Calculate onsite resolution time (Work Hour)
  let avgOnsiteResolutionTime = 0;
  const closedOrResolvedTickets = tickets.filter((t: any) => t.status === 'CLOSED' || t.status === 'RESOLVED');
  if (closedOrResolvedTickets.length > 0) {
    let totalOnsiteTime = 0;
    let validOnsiteTickets = 0;

    for (const ticket of closedOrResolvedTickets) {
      const onsiteMinutes = calculateOnsiteResolutionMinutes(
        ticket.relatedMachineIds,
        ticket.statusHistory
      );

      if (onsiteMinutes > 0 && onsiteMinutes <= 1440) { // Max 24 hours
        totalOnsiteTime += onsiteMinutes;
        validOnsiteTickets++;
      }
    }

    if (validOnsiteTickets > 0) {
      avgOnsiteResolutionTime = Math.round(totalOnsiteTime / validOnsiteTickets);
    }
  }


  // Calculate advanced metrics
  const now = new Date();
  const criticalTickets = tickets.filter((t: any) => t.priority === 'CRITICAL');
  const highPriorityTickets = tickets.filter((t: any) => t.priority === 'HIGH');
  const unassignedTickets = tickets.filter((t: any) => !t.assignedToId);
  const overdueTickets = tickets.filter((t: any) => t.slaDueAt && now > new Date(t.slaDueAt));
  const ticketsWithFeedback = tickets.filter((t: any) => t.feedbacks?.length > 0 || t.rating);

  // Calculate customer satisfaction metrics
  const ratingsData = tickets.filter((t: any) => t.rating?.rating).map((t: any) => t.rating.rating);
  const avgCustomerRating = ratingsData.length > 0
    ? Math.round(ratingsData.reduce((sum: number, rating: number) => sum + rating, 0) / ratingsData.length)
    : 0;

  // Calculate first response time
  let avgFirstResponseTime = 0;
  if (tickets.length > 0) {
    let totalResponseTime = 0;
    let validResponseTickets = 0;

    for (const ticket of tickets) {
      let responseMinutes = 0;

      // Priority 1: Use imported Excel respond time (from metadata)
      if (ticket.relatedMachineIds) {
        try {
          const metadata = JSON.parse(ticket.relatedMachineIds);
          if (metadata?.respondTimeMinutes && metadata.respondTimeMinutes > 0) {
            responseMinutes = metadata.respondTimeMinutes;
          }
        } catch { /* ignore parse errors */ }
      }

      // Priority 2: Calculate from status history (for app-created tickets)
      if (responseMinutes === 0 && ticket.statusHistory && ticket.statusHistory.length > 0) {
        // Find the first record that transitions out of OPEN
        const firstResponse = ticket.statusHistory.find((h: any) => h.status !== 'OPEN');
        if (firstResponse) {
          responseMinutes = calculateBusinessHoursInMinutes(new Date(ticket.createdAt), new Date(firstResponse.changedAt));
        }
      }

      // Only include reasonable first response times (max 3 business days)
      if (responseMinutes > 0 && responseMinutes <= (3 * BUSINESS_MINUTES_PER_DAY)) {
        totalResponseTime += responseMinutes;
        validResponseTickets++;
      }
    }

    if (validResponseTickets > 0) {
      avgFirstResponseTime = Math.round(totalResponseTime / validResponseTickets);
    }
  }

  // Get ALL zones (not just zones with tickets)
  const allZones = await prisma.serviceZone.findMany({
    select: { id: true, name: true }
  });

  // Create a map of zone ticket counts
  const zoneTicketMap = new Map((zoneDistribution || []).map((z: any) => [z.zoneId, z._count]));

  // Build complete zone distribution including zones with 0 tickets and detailed stats
  const completeZoneDistribution = allZones.map((zone: any) => {
    const zoneTickets = tickets.filter((t: any) => t.zoneId === zone.id);
    const resolved = zoneTickets.filter((t: any) => t.status === 'RESOLVED' || t.status === 'CLOSED');
    const critical = zoneTickets.filter((t: any) => t.priority === 'CRITICAL');
    const open = zoneTickets.filter((t: any) => ['OPEN', 'IN_PROGRESS', 'IN_PROCESS', 'ASSIGNED', 'ONSITE_VISIT', 'ONSITE_VISIT_IN_PROGRESS'].includes(t.status));
    
    // Average resolution for this zone
    const validResTimes = resolved
        .map((t: any) => t.calculatedResolutionMinutes)
        .filter((time: any) => typeof time === 'number' && time > 0);
    const avgResTime = validResTimes.length > 0 
        ? Math.round(validResTimes.reduce((a: number, b: number) => a + b, 0) / validResTimes.length) 
        : 0;

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      count: zoneTicketMap.get(zone.id) || 0,
      resolvedCount: resolved.length,
      openCount: open.length,
      criticalCount: critical.length,
      avgResolutionMinutes: avgResTime,
    };
  }).sort((a: any, b: any) => b.count - a.count); // Sort by count descending

  // Get ALL customers (not just customers with tickets)
  const allCustomers = await prisma.customer.findMany({
    select: { id: true, companyName: true, isActive: true }
  });

  // Create a map of customer ticket counts
  const customerTicketMap = new Map((customerDistribution || []).map((c: any) => [c.customerId, c._count]));

  // Build complete customer distribution including customers with 0 tickets
  const completeCustomerDistribution = allCustomers.map((customer: any) => ({
    customerId: customer.id,
    customerName: customer.companyName,
    count: customerTicketMap.get(customer.id) || 0,
    isActive: customer.isActive
  })).sort((a: any, b: any) => b.count - a.count); // Sort by count descending

  // Get assignee names for distribution
  const assigneeNames = await prisma.user.findMany({
    where: { id: { in: (assigneeDistribution || []).filter((a: any) => a.assignedToId).map((a: any) => a.assignedToId) } },
    select: { id: true, name: true, email: true }
  });

  // Calculate resolution rate
  const resolutionRate = tickets.length > 0
    ? Math.round((resolvedTickets.length / tickets.length) * 100)
    : 0;

  // Calculate escalation rate
  const escalationRate = tickets.length > 0
    ? Math.round((tickets.filter((t: any) => t.isEscalated).length / tickets.length) * 100)
    : 0;

  // Calculate customer performance metrics (more tickets = machine issues)
  const customerPerformanceMetrics = (customerDistribution || []).map((c: any) => {
    const customerTickets = tickets.filter((t: any) => t.customerId === c.customerId);
    const customerName = allCustomers.find((cn: any) => cn.id === c.customerId)?.companyName || 'Unknown Customer';

    // Calculate machine issue indicators
    const criticalIssues = customerTickets.filter((t: any) => t.priority === 'CRITICAL').length;
    const highPriorityIssues = customerTickets.filter((t: any) => t.priority === 'HIGH').length;
    const escalatedIssues = customerTickets.filter((t: any) => t.isEscalated).length;
    const repeatIssues = customerTickets.filter((t: any) => {
      // Check if customer has multiple tickets for same asset
      const assetTickets = customerTickets.filter((at: any) => at.assetId === t.assetId);
      return assetTickets.length > 1;
    }).length;

    // Calculate average resolution time for this customer
    const customerResolvedTickets = customerTickets.filter((t: any) =>
      t.status === 'RESOLVED' || t.status === 'CLOSED'
    );
    let avgCustomerResolutionTime = 0;
    if (customerResolvedTickets.length > 0) {
      const customerResolutionTimes = customerResolvedTickets
        .map((t: any) => t.calculatedResolutionMinutes)
        .filter((time: any): time is number => time !== null && typeof time === 'number' && time > 0 && time <= (30 * BUSINESS_MINUTES_PER_DAY));

      if (customerResolutionTimes.length > 0) {
        avgCustomerResolutionTime = Math.round(
          customerResolutionTimes.reduce((sum: number, time: number) => sum + time, 0) / customerResolutionTimes.length
        );
      }
    }

    // Calculate machine health score (lower score = more issues)
    const totalIssues = criticalIssues + highPriorityIssues + escalatedIssues + repeatIssues;
    const machineHealthScore = Math.max(0, 100 - (totalIssues * 5) - (c._count * 2));

    return {
      customerId: c.customerId,
      customerName,
      totalTickets: c._count,
      criticalIssues,
      highPriorityIssues,
      escalatedIssues,
      repeatIssues,
      avgResolutionTimeMinutes: avgCustomerResolutionTime,
      avgResolutionTimeHours: avgCustomerResolutionTime > 0 ? Math.round((avgCustomerResolutionTime / 60) * 100) / 100 : 0,
      machineHealthScore,
      riskLevel: machineHealthScore < 50 ? 'HIGH' : machineHealthScore < 75 ? 'MEDIUM' : 'LOW'
    };
  }).sort((a: any, b: any) => b.totalTickets - a.totalTickets); // Sort by ticket count (most issues first)

  // Calculate onsite visit traveling time
  let avgOnsiteTravelTime = 0;
  let avgOnsiteTravelTimeHours = 0;
  if (tickets.length > 0) {
    let totalTravelTime = 0;
    let validTravelTickets = 0;

    for (const ticket of tickets) {
      const travelMinutes = calculateTravelMinutes(
        ticket.relatedMachineIds,
        ticket.statusHistory,
        ticket.visitStartedAt,
        ticket.visitReachedAt,
        ticket.visitInProgressAt
      );

      // Validate travel time (same 8h cap as dashboard/utilities)
      if (travelMinutes > 0 && travelMinutes <= 480) {
        totalTravelTime += travelMinutes;
        validTravelTickets++;
      }
    }

    if (validTravelTickets > 0) {
      avgOnsiteTravelTime = Math.round(totalTravelTime / validTravelTickets);
      avgOnsiteTravelTimeHours = Math.round(avgOnsiteTravelTime / 60);
    }
  }

  res.json({
    success: true,
    data: {
      summary: {
        // Basic counts
        totalTickets: tickets.length,
        openTickets: tickets.filter((t: { status: string }) => t.status === 'OPEN').length,
        inProgressTickets: tickets.filter((t: { status: string }) =>
          ['IN_PROGRESS', 'ASSIGNED', 'IN_PROCESS', 'ONSITE_VISIT', 'ONSITE_VISIT_IN_PROGRESS'].includes(t.status)
        ).length,
        resolvedTickets: resolvedTickets.length,
        closedTickets: tickets.filter((t: { status: string }) => t.status === 'CLOSED').length,

        // Priority-based metrics
        criticalTickets: criticalTickets.length,
        highPriorityTickets: highPriorityTickets.length,
        unassignedTickets: unassignedTickets.length,

        // SLA and performance metrics
        overdueTickets: overdueTickets.length,
        escalatedTickets: tickets.filter((t: { isEscalated: boolean }) => t.isEscalated).length,
        resolutionRate,
        escalationRate,

        // Time-based metrics
        averageResolutionTime: avgResolutionTime,
        averageResolutionTimeHours: formatMinutesToBusinessDH(avgResolutionTime).hours + (formatMinutesToBusinessDH(avgResolutionTime).days * (BUSINESS_MINUTES_PER_DAY / 60)), // Total business hours
        averageResolutionTimeDays: formatMinutesToBusinessDH(avgResolutionTime).days,
        averageFirstResponseTime: avgFirstResponseTime,
        averageFirstResponseTimeHours: avgFirstResponseTime > 0 ? Math.round(avgFirstResponseTime / 60) : 0,
        averageOnsiteResolutionTime: avgOnsiteResolutionTime,
        averageOnsiteResolutionTimeHours: avgOnsiteResolutionTime > 0 ? Math.round(avgOnsiteResolutionTime / 60) : 0,

        // Customer satisfaction metrics
        ticketsWithFeedback: ticketsWithFeedback.length,
        averageCustomerRating: avgCustomerRating,
        totalRatings: ratingsData.length,

        // Operational metrics
        totalZones: allZones.length,
        totalCustomers: allCustomers.length,
        totalAssignees: assigneeNames.length,

        // Onsite visit metrics
        avgOnsiteTravelTime: avgOnsiteTravelTime,
        avgOnsiteTravelTimeHours: avgOnsiteTravelTimeHours,
        totalOnsiteVisits: tickets.filter((t: any) => t.visitStartedAt && (t.visitReachedAt || t.visitInProgressAt)).length,
      },

      // Enhanced distributions with names
      statusDistribution: (statusDistribution || []).reduce((acc: any, curr: any) => ({
        ...acc,
        [curr.status]: curr._count
      }), {}),

      priorityDistribution: (priorityDistribution || []).reduce((acc: any, curr: any) => ({
        ...acc,
        [curr.priority]: curr._count
      }), {}),

      slaDistribution: (slaDistribution || []).reduce((acc: any, curr: any) => ({
        ...acc,
        [curr.slaStatus || 'NOT_SET']: curr._count
      }), {}),

      zoneDistribution: completeZoneDistribution,

      customerDistribution: completeCustomerDistribution,

      assigneeDistribution: (assigneeDistribution || [])
        .filter((a: any) => a.assignedToId)
        .map((a: any) => ({
          assigneeId: a.assignedToId,
          assigneeName: assigneeNames.find((an: any) => an.id === a.assignedToId)?.name ||
            assigneeNames.find((an: any) => an.id === a.assignedToId)?.email || 'Unknown Assignee',
          count: a._count
        })),

      // Enhanced daily trends
      dailyTrends,

      // Recent tickets with full details
      recentTickets: tickets
        .sort((a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20)
        .map((ticket: any) => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          customerName: ticket.customer?.companyName || 'Unknown',
          zoneName: ticket.zone?.name || 'Unknown',
          assigneeName: ticket.assignedTo?.name || 'Unassigned',
          isEscalated: ticket.isEscalated,
          slaStatus: ticket.slaStatus,
          hasRating: !!ticket.rating,
          rating: ticket.rating?.rating || null
        })),

      // Customer performance metrics (machine health analysis)
      customerPerformanceMetrics,

      // Performance insights
      insights: {
        topPerformingZone: completeZoneDistribution.length > 0
          ? completeZoneDistribution[0].zoneName || 'N/A'
          : 'N/A',
        mostActiveCustomer: completeCustomerDistribution.length > 0
          ? completeCustomerDistribution[0].customerName || 'N/A'
          : 'N/A',
        topAssignee: (assigneeDistribution || []).length > 0 && assigneeDistribution[0].assignedToId
          ? assigneeNames.find((an: any) => an.id === assigneeDistribution[0].assignedToId)?.name || 'N/A'
          : 'N/A',
        worstPerformingCustomer: customerPerformanceMetrics.length > 0
          ? customerPerformanceMetrics[0].customerName
          : 'N/A',
        avgTravelTimeFormatted: avgOnsiteTravelTimeHours > 0
          ? `${Math.floor(avgOnsiteTravelTimeHours)}h ${avgOnsiteTravelTime % 60}m`
          : 'N/A'
      }
    }
  });
}

async function generateSlaPerformanceReport(res: Response, whereClause: any, startDate: Date, endDate: Date) {
  const tickets = await prisma.ticket.findMany({
    where: {
      ...whereClause,
      slaDueAt: { not: null }
    },
    include: {
      customer: true,
      assignedTo: true,
      zone: true,
      asset: true
    }
  });

  const now = new Date();
  const slaBreaches = tickets.filter((t: any) => t.slaDueAt && now > t.slaDueAt);
  const slaOnTime = tickets.filter((t: any) => t.slaDueAt && now <= t.slaDueAt);

  // Calculate SLA compliance by priority
  const prioritySla = Object.values(Priority).reduce((acc: any, priority: any) => {
    const priorityTickets = tickets.filter((t: any) => t.priority === priority);
    const priorityBreaches = priorityTickets.filter((t: any) => t.slaDueAt && now > t.slaDueAt);

    acc[priority] = {
      total: priorityTickets.length,
      breaches: priorityBreaches.length,
      compliance: priorityTickets.length > 0
        ? ((priorityTickets.length - priorityBreaches.length) / priorityTickets.length) * 100
        : 100
    };
    return acc;
  }, {} as Record<string, any>);

  res.json({
    success: true,
    data: {
      summary: {
        totalTicketsWithSLA: tickets.length,
        slaBreaches: slaBreaches.length,
        slaOnTime: slaOnTime.length,
        complianceRate: tickets.length > 0
          ? ((tickets.length - slaBreaches.length) / tickets.length) * 100
          : 100
      },
      prioritySla,
      breachedTickets: slaBreaches.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        slaDueAt: t.slaDueAt,
        customer: t.customer?.companyName || 'Unknown',
        assignedTo: t.assignedTo ? t.assignedTo.name : 'Unassigned',
        zone: t.zone?.name || 'No Zone',
        asset: t.asset ? `${t.asset.machineId} - ${t.asset.model}` : 'No Asset'
      }))
    }
  });
}

async function generateCustomerSatisfactionReport(res: Response, whereClause: any, startDate: Date, endDate: Date) {
  const data = await getCustomerSatisfactionData(whereClause, startDate, endDate);
  res.json({
    success: true,
    data
  });
}

async function getCustomerSatisfactionData(whereClause: any, startDate: Date, endDate: Date) {
  // Build where for feedback with optional zone restriction via ticket relation
  const feedbackWhere: any = {
    submittedAt: { gte: startDate, lte: endDate },
  };
  if (whereClause?.zoneId !== undefined) {
    if (typeof whereClause.zoneId === 'number' || typeof whereClause.zoneId === 'string') {
      feedbackWhere.ticket = { zoneId: parseInt(whereClause.zoneId as number as unknown as string) };
    } else if (typeof whereClause.zoneId === 'object' && whereClause.zoneId !== null) {
      if (Array.isArray((whereClause.zoneId as any).in)) {
        feedbackWhere.ticket = { zoneId: { in: (whereClause.zoneId as any).in } };
      }
    }
  }

  // Get TicketFeedback data (existing system)
  const ticketFeedbacks = await prisma.ticketFeedback.findMany({
    where: feedbackWhere,
    include: {
      ticket: {
        include: {
          customer: true,
          zone: true,
          asset: true
        }
      },
      submittedBy: true
    }
  });

  // Build where for ratings with optional zone restriction via ticket relation
  const ratingWhere: any = {
    createdAt: { gte: startDate, lte: endDate },
  };
  if (whereClause?.zoneId !== undefined) {
    if (typeof whereClause.zoneId === 'number' || typeof whereClause.zoneId === 'string') {
      ratingWhere.ticket = { zoneId: parseInt(whereClause.zoneId as number as unknown as string) };
    } else if (typeof whereClause.zoneId === 'object' && whereClause.zoneId !== null) {
      if (Array.isArray((whereClause.zoneId as any).in)) {
        ratingWhere.ticket = { zoneId: { in: (whereClause.zoneId as any).in } };
      }
    }
  }

  // Get Rating data (new WhatsApp system)
  const ratings = await prisma.rating.findMany({
    where: ratingWhere,
    include: {
      ticket: {
        include: {
          customer: true,
          zone: true,
          asset: true
        }
      },
      customer: true
    }
  });

  // Combine both feedback types into a unified format
  const allFeedbacks = [
    ...ticketFeedbacks.map(tf => ({
      id: tf.id,
      rating: tf.rating,
      comment: tf.feedback,
      submittedAt: tf.submittedAt,
      ticketId: tf.ticketId,
      ticket: tf.ticket,
      source: 'WEB',
      customer: tf.ticket.customer?.companyName || 'Unknown'
    })),
    ...ratings.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.feedback,
      submittedAt: r.createdAt,
      ticketId: r.ticketId,
      ticket: r.ticket,
      source: r.source,
      customer: r.customer?.companyName || 'Unknown'
    }))
  ];

  // Calculate rating distribution
  const ratingDistribution: Record<number, number> = {};
  for (let i = 1; i <= 5; i++) {
    ratingDistribution[i] = 0;
  }

  allFeedbacks.forEach((fb: any) => {
    if (fb.rating >= 1 && fb.rating <= 5) {
      ratingDistribution[fb.rating]++;
    }
  });

  // Calculate average rating
  const totalRating = allFeedbacks.reduce((sum: number, fb: any) => sum + fb.rating, 0);
  const averageRating = allFeedbacks.length > 0 ? totalRating / allFeedbacks.length : 0;

  // Group by customer
  const customerRatings: Record<string, any> = {};
  allFeedbacks.forEach((fb: any) => {
    const customerName = fb.customer;
    if (!customerRatings[customerName]) {
      customerRatings[customerName] = {
        total: 0,
        sum: 0,
        feedbacks: []
      };
    }
    customerRatings[customerName].total++;
    customerRatings[customerName].sum += fb.rating;
    customerRatings[customerName].feedbacks.push(fb);
  });

  // Calculate average per customer
  Object.keys(customerRatings).forEach(customer => {
    customerRatings[customer].average = customerRatings[customer].sum / customerRatings[customer].total;
  });

  return {
    summary: {
      totalFeedbacks: allFeedbacks.length,
      averageRating: parseFloat(averageRating.toFixed(2)),
      positiveFeedbacks: allFeedbacks.filter((fb: any) => fb.rating >= 4).length,
      negativeFeedbacks: allFeedbacks.filter((fb: any) => fb.rating <= 2).length
    },
    ratingDistribution,
    customerRatings,
    recentFeedbacks: allFeedbacks
      .sort((a: { submittedAt: Date }, b: { submittedAt: Date }) => b.submittedAt.getTime() - a.submittedAt.getTime())
      .slice(0, 20)
  };
}

async function generateZonePerformanceReport(res: Response, whereClause: any, startDate: Date, endDate: Date) {
  // Create a clean where clause for the zone query
  const zoneWhere: any = {};

  // If a specific zone is selected, only fetch that zone
  if (whereClause.zoneId !== undefined) {
    if (typeof whereClause.zoneId === 'number' || typeof whereClause.zoneId === 'string') {
      zoneWhere.id = parseInt(whereClause.zoneId as number as unknown as string);
    } else if (typeof whereClause.zoneId === 'object' && whereClause.zoneId !== null) {
      // Support shape: { in: number[] }
      if (Array.isArray((whereClause.zoneId as any).in)) {
        zoneWhere.id = { in: (whereClause.zoneId as any).in };
      }
    }
  }

  const zones = await prisma.serviceZone.findMany({
    where: zoneWhere,
    include: {
      tickets: {
        where: whereClause,
        include: {
          customer: true,
          assignedTo: true,
          asset: true,
          statusHistory: {
            select: { status: true, changedAt: true },
            orderBy: { changedAt: 'desc' }
          }
        }
      },
      servicePersons: {
        include: {
          user: true
        }
      },
      customers: {
        include: {
          assets: true
        }
      }
    }
  });

  const zoneStats = zones.map((zone: any) => {
    const tickets = zone.tickets;
    const resolvedTickets = tickets.filter((t: { status: string }) =>
      t.status === 'RESOLVED' || t.status === 'CLOSED'
    );
    const openTickets = tickets.filter((t: { status: string }) =>
      ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status)
    );

    // Calculate average resolution time for this zone (business hours)
    let avgResolutionTime = 0;
    if (resolvedTickets.length > 0) {
      let totalTime = 0;
      let validCount = 0;

      for (const ticket of resolvedTickets) {
        const resolutionMinutes = calculateTicketResolutionMinutes(
          ticket.actualResolutionTime,
          ticket.relatedMachineIds,
          ticket.createdAt,
          ticket.updatedAt,
          ticket.visitCompletedDate
        );

        if (resolutionMinutes > 0) {
          totalTime += resolutionMinutes;
          validCount++;
        }
      }

      avgResolutionTime = validCount > 0 ? Math.round(totalTime / validCount) : 0;
    }

    // Calculate average travel time for this zone
    let avgTravelTime = 0;
    let totalOnsiteVisits = 0;
    {
      let totalTravelTime = 0;
      let validTravelTickets = 0;

      for (const ticket of tickets) {
        const travelMinutes = calculateTravelMinutes(
          ticket.relatedMachineIds,
          ticket.statusHistory,
          ticket.visitStartedAt,
          ticket.visitReachedAt,
          ticket.visitInProgressAt
        );

        if (travelMinutes > 0 && travelMinutes <= 480) {
          totalTravelTime += travelMinutes;
          validTravelTickets++;
        }

        // Count onsite visits
        if (ticket.visitStartedAt && (ticket.visitReachedAt || ticket.visitInProgressAt)) {
          totalOnsiteVisits++;
        }
      }

      if (validTravelTickets > 0) {
        avgTravelTime = Math.round(totalTravelTime / validTravelTickets);
      }
    }

    // Calculate average onsite resolution time for this zone
    let avgOnsiteResolutionTime = 0;
    {
      let totalOnsiteTime = 0;
      let validOnsiteTickets = 0;

      for (const ticket of resolvedTickets) {
        const onsiteMinutes = calculateOnsiteResolutionMinutes(
          ticket.relatedMachineIds,
          ticket.statusHistory
        );

        if (onsiteMinutes > 0 && onsiteMinutes <= 1440) {
          totalOnsiteTime += onsiteMinutes;
          validOnsiteTickets++;
        }
      }

      if (validOnsiteTickets > 0) {
        avgOnsiteResolutionTime = Math.round(totalOnsiteTime / validOnsiteTickets);
      }
    }

    // Count customers and assets in this zone
    const customerCount = zone.customers.length;
    const assetCount = zone.customers.reduce((sum: number, customer: { assets: any[] }) => sum + customer.assets.length, 0);

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      openTickets: openTickets.length,
      servicePersons: zone.servicePersons.length,
      customerCount,
      assetCount,
      resolutionRate: tickets.length > 0
        ? parseFloat(((resolvedTickets.length / tickets.length) * 100).toFixed(2))
        : 0,
      averageResolutionTime: avgResolutionTime,
      averageTravelTime: avgTravelTime,
      averageOnsiteResolutionTime: avgOnsiteResolutionTime,
      totalOnsiteVisits,
      escalatedTickets: tickets.filter((t: { isEscalated: boolean }) => t.isEscalated).length
    };
  });

  res.json({
    success: true,
    data: {
      zones: zoneStats.sort((a: { resolutionRate: number }, b: { resolutionRate: number }) => b.resolutionRate - a.resolutionRate),
      totalZones: zones.length,
      overallStats: {
        totalTickets: zoneStats.reduce((sum: number, zone: { totalTickets: number }) => sum + (zone.totalTickets || 0), 0),
        totalResolved: zoneStats.reduce((sum: number, zone: { resolvedTickets: number }) => sum + (zone.resolvedTickets || 0), 0),
        averageResolutionRate: zoneStats.length > 0
          ? zoneStats.reduce((sum: number, zone: { resolutionRate: number }) => sum + zone.resolutionRate, 0) / zoneStats.length
          : 0,
        averageTravelTime: zoneStats.length > 0
          ? Math.round(zoneStats.reduce((sum: number, zone: any) => sum + (zone.averageTravelTime || 0), 0) / Math.max(zoneStats.filter((z: any) => z.averageTravelTime > 0).length, 1))
          : 0,
        averageOnsiteResolutionTime: zoneStats.length > 0
          ? Math.round(zoneStats.reduce((sum: number, zone: any) => sum + (zone.averageOnsiteResolutionTime || 0), 0) / Math.max(zoneStats.filter((z: any) => z.averageOnsiteResolutionTime > 0).length, 1))
          : 0,
        totalOnsiteVisits: zoneStats.reduce((sum: number, zone: any) => sum + (zone.totalOnsiteVisits || 0), 0)
      }
    }
  });
}

async function generateAgentProductivityReport(res: Response, whereClause: any, startDate: Date, endDate: Date) {
  // Build filter for agents: service persons that have assigned tickets in allowed zones/date
  const assignedTicketsWhere: any = { ...whereClause };
  const agents = await prisma.user.findMany({
    where: {
      role: 'SERVICE_PERSON',
      assignedTickets: {
        some: assignedTicketsWhere
      }
    },
    include: {
      assignedTickets: {
        where: assignedTicketsWhere,
        include: {
          customer: true,
          zone: true,
          asset: true
        }
      },
      serviceZones: {
        include: {
          serviceZone: true
        }
      }
    }
  });

  const agentStats = agents.map((agent: any) => {
    const tickets = agent.assignedTickets || [];
    const resolvedTickets = tickets.filter((t: { status: string }) =>
      t.status === 'RESOLVED' || t.status === 'CLOSED'
    );

    // Calculate average resolution time in minutes
    let totalResolutionTime = 0;
    let validResCount = 0;

    for (const ticket of resolvedTickets) {
      const resolutionMinutes = calculateTicketResolutionMinutes(
        ticket.actualResolutionTime,
        ticket.relatedMachineIds,
        ticket.createdAt,
        ticket.updatedAt,
        ticket.visitCompletedDate
      );

      if (resolutionMinutes > 0) {
        totalResolutionTime += resolutionMinutes;
        validResCount++;
      }
    }

    const avgResolutionTime = validResCount > 0 ? Math.round(totalResolutionTime / validResCount) : 0;

    // Calculate first response time (simplified)
    const ticketsWithResponse = tickets.filter((t: any) => t.updatedAt !== t.createdAt);
    const avgFirstResponseTime = ticketsWithResponse.length > 0
      ? Math.round(ticketsWithResponse.reduce((sum: number, t: any) => {
        return sum + calculateBusinessHoursInMinutes(t.createdAt, t.updatedAt);
      }, 0) / ticketsWithResponse.length)
      : 0;

    return {
      agentId: agent.id,
      agentName: agent.name || agent.email || `Agent ${agent.id}`,
      email: agent.email,
      zones: agent.serviceZones.map((sz: any) => sz.serviceZone.name),
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      openTickets: tickets.filter((t: any) =>
        ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status)
      ).length,
      resolutionRate: tickets.length > 0
        ? parseFloat(((resolvedTickets.length / tickets.length) * 100).toFixed(2))
        : 0,
      averageResolutionTime: avgResolutionTime,
      averageFirstResponseTime: avgFirstResponseTime,
      escalatedTickets: tickets.filter((t: { isEscalated: boolean }) => t.isEscalated).length
    };
  });

  res.json({
    success: true,
    data: {
      agents: agentStats.sort((a: { resolutionRate: number }, b: { resolutionRate: number }) => b.resolutionRate - a.resolutionRate),
      totalAgents: agents.length,
      performanceMetrics: {
        topPerformer: agentStats.length > 0
          ? agentStats.reduce((max: { resolutionRate: number }, agent: { resolutionRate: number }) =>
            agent.resolutionRate > max.resolutionRate ? agent : max, agentStats[0])
          : null,
        averageResolutionRate: agentStats.length > 0
          ? agentStats.reduce((sum: number, agent: any) => sum + agent.resolutionRate, 0) / agentStats.length
          : 0
      }
    }
  });
}

async function generateIndustrialDataReport(res: Response, whereClause: any, startDate: Date, endDate: Date, filters?: { customerId?: string, assetId?: string }) {
  // Build base query for zone users and service persons
  const baseUserWhere: any = {
    isActive: true,
    ...((() => {
      // Support zoneId as single value or { in: [...] }
      if (whereClause?.zoneId === undefined) return {};
      if (typeof whereClause.zoneId === 'number' || typeof whereClause.zoneId === 'string') {
        return { serviceZones: { some: { serviceZoneId: parseInt(whereClause.zoneId as number as unknown as string) } } };
      }
      if (typeof whereClause.zoneId === 'object' && whereClause.zoneId !== null && Array.isArray((whereClause.zoneId as any).in)) {
        return { serviceZones: { some: { serviceZoneId: { in: (whereClause.zoneId as any).in } } } };
      }
      return {};
    })())
  };

  // Get zone users (ZONE_USER role) with zone filtering
  const zoneUsers = await prisma.user.findMany({
    where: {
      ...baseUserWhere,
      role: UserRole.ZONE_USER
    },
    include: {
      serviceZones: {
        include: {
          serviceZone: true
        }
      }
    }
  });

  // Get service persons with zone filtering
  const servicePersons = await prisma.user.findMany({
    where: {
      ...baseUserWhere,
      role: UserRole.SERVICE_PERSON
    },
    include: {
      serviceZones: {
        include: {
          serviceZone: true
        }
      },
      assignedTickets: {
        where: whereClause,
        include: {
          asset: true,
          zone: true
        }
      }
    }
  });

  // Build filters for assets
  const assetWhere: any = {};

  // Add zone filter for assets
  if (whereClause?.zoneId !== undefined) {
    if (typeof whereClause.zoneId === 'number' || typeof whereClause.zoneId === 'string') {
      assetWhere.customer = { serviceZoneId: parseInt(whereClause.zoneId as number as unknown as string) };
    } else if (typeof whereClause.zoneId === 'object' && whereClause.zoneId !== null && Array.isArray((whereClause.zoneId as any).in)) {
      assetWhere.customer = { serviceZoneId: { in: (whereClause.zoneId as any).in } };
    }
  }

  // Add customer filter if specified
  if (filters?.customerId) {
    assetWhere.customerId = parseInt(filters.customerId);
  }

  // Add asset filter if specified
  if (filters?.assetId) {
    assetWhere.id = parseInt(filters.assetId);
  }

  // Get ALL assets (with or without issues)
  const allAssets = await prisma.asset.findMany({
    where: assetWhere,
    take: 5000, // Safety limit
    select: {
      id: true,
      machineId: true,
      model: true,
      serialNo: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          companyName: true
        }
      }
    }
  });

  // Build additional filters for tickets based on customerId and assetId
  const ticketFilters: any = {
    ...whereClause,
    OR: [
      { status: { in: ['OPEN', 'IN_PROGRESS', 'ASSIGNED'] } },
      {
        status: { in: ['RESOLVED', 'CLOSED'] },
        updatedAt: { gte: startDate, lte: endDate }
      }
    ]
  };

  // Add customer filter if specified
  if (filters?.customerId) {
    ticketFilters.customerId = parseInt(filters.customerId);
  }

  // Add asset filter if specified
  if (filters?.assetId) {
    ticketFilters.assetId = parseInt(filters.assetId);
  }

  // Get machine downtime data (only tickets with issues)
  const ticketsWithDowntime = await prisma.ticket.findMany({
    where: ticketFilters,
    take: 5000, // Safety limit
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      assetId: true,
      asset: {
        select: {
          machineId: true,
          model: true,
          serialNo: true,
          location: true,
          customerId: true,
          customer: {
            select: {
              companyName: true
            }
          }
        }
      },
      zone: {
        select: {
          name: true
        }
      },
      assignedTo: {
        select: {
          name: true
        }
      }
    }
  });

  // Calculate downtime for each ticket
  const ticketDowntimeData = ticketsWithDowntime.map((ticket: any) => {
    let downtimeMinutes = 0;

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      // For resolved tickets, calculate the time between creation and resolution (business hours)
      downtimeMinutes = calculateBusinessHoursInMinutes(ticket.createdAt, ticket.updatedAt);
    } else {
      // For open tickets, calculate time from creation to now (business hours)
      downtimeMinutes = calculateBusinessHoursInMinutes(ticket.createdAt, new Date());
    }

    return {
      assetId: ticket.assetId,
      machineId: ticket.asset?.machineId || 'Unknown',
      model: ticket.asset?.model || 'Unknown',
      serialNo: ticket.asset?.serialNo || 'Unknown',
      customer: ticket.asset?.customer?.companyName || 'Unknown',
      customerId: ticket.asset?.customerId,
      zone: ticket.zone?.name || 'Unknown',
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? ticket.updatedAt : null,
      downtimeMinutes,
      assignedTo: ticket.assignedTo?.name || 'Unassigned'
    };
  });

  // Group tickets by asset to calculate downtime per machine
  const assetDowntimeMap = ticketDowntimeData.reduce((acc: any, ticket: any) => {
    const assetKey = ticket.assetId || ticket.machineId;
    if (!acc[assetKey]) {
      acc[assetKey] = {
        assetId: ticket.assetId,
        machineId: ticket.machineId,
        model: ticket.model,
        serialNo: ticket.serialNo,
        customer: ticket.customer,
        customerId: ticket.customerId,
        totalDowntimeMinutes: 0,
        incidents: 0,
        openIncidents: 0,
        resolvedIncidents: 0
      };
    }

    acc[assetKey].totalDowntimeMinutes += ticket.downtimeMinutes;
    acc[assetKey].incidents += 1;

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      acc[assetKey].resolvedIncidents += 1;
    } else {
      acc[assetKey].openIncidents += 1;
    }

    return acc;
  }, {} as Record<string, any>);

  // Build comprehensive machine downtime list including machines with 0 issues
  const allMachineDowntime = allAssets.map((asset: any) => {
    const assetKey = asset.id;
    const downtimeData = assetDowntimeMap[assetKey];

    if (downtimeData) {
      // Asset has issues - return with downtime data
      return {
        machineId: asset.machineId || 'Unknown',
        model: asset.model || 'Unknown',
        serialNo: asset.serialNo || 'Unknown',
        customer: asset.customer?.companyName || 'Unknown',
        customerId: asset.customerId,
        assetId: asset.id,
        totalDowntimeMinutes: downtimeData.totalDowntimeMinutes,
        incidents: downtimeData.incidents,
        openIncidents: downtimeData.openIncidents,
        resolvedIncidents: downtimeData.resolvedIncidents,
        totalDowntimeHours: Math.round(downtimeData.totalDowntimeMinutes / 60),
        avgDowntimeHours: downtimeData.incidents > 0
          ? Math.round(downtimeData.totalDowntimeMinutes / downtimeData.incidents / 60)
          : 0
      };
    } else {
      // Asset has no issues - return with zero values
      return {
        machineId: asset.machineId || 'Unknown',
        model: asset.model || 'Unknown',
        serialNo: asset.serialNo || 'Unknown',
        customer: asset.customer?.companyName || 'Unknown',
        customerId: asset.customerId,
        assetId: asset.id,
        totalDowntimeMinutes: 0,
        incidents: 0,
        openIncidents: 0,
        resolvedIncidents: 0,
        totalDowntimeHours: 0,
        avgDowntimeHours: 0
      };
    }
  });

  // Sort by downtime (descending) - machines with issues first
  const sortedMachineDowntime = allMachineDowntime.sort((a: any, b: any) =>
    b.totalDowntimeMinutes - a.totalDowntimeMinutes
  );

  // Calculate summary statistics
  const machinesWithIssues = sortedMachineDowntime.filter((m: any) => m.incidents > 0);
  const totalDowntimeHours = machinesWithIssues.reduce((sum: number, machine: any) =>
    sum + machine.totalDowntimeHours, 0
  );

  // Prepare response
  const response: IndustrialZoneData = {
    zoneName: whereClause?.zoneId ? `Zone ${whereClause.zoneId}` : 'All Zones',
    zoneId: whereClause?.zoneId ? parseInt(whereClause.zoneId) : 0,
    zoneUsers: zoneUsers.map((user: any) => ({
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      phone: user.phone,
      zones: user.serviceZones.map((sz: any) => sz.serviceZone.name),
      customerId: user.customerId
    })),
    servicePersons: servicePersons.map((sp: any) => ({
      id: sp.id,
      name: sp.name,
      email: sp.email,
      phone: sp.phone,
      zones: sp.serviceZones.map((sz: any) => sz.serviceZone.name),
      assignedTickets: sp.assignedTickets.length,
      activeTickets: sp.assignedTickets.filter((t: any) =>
        ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status)
      ).length
    })),
    machineDowntime: sortedMachineDowntime as any[],
    detailedDowntime: ticketDowntimeData as any[],
    summary: {
      totalZoneUsers: zoneUsers.length,
      totalServicePersons: servicePersons.length,
      totalMachines: allAssets.length,
      totalMachinesWithDowntime: machinesWithIssues.length,
      totalMachinesWithoutIssues: allAssets.length - machinesWithIssues.length,
      totalDowntimeHours: Math.round(totalDowntimeHours),
      averageDowntimePerMachine: machinesWithIssues.length > 0
        ? Math.round(totalDowntimeHours / machinesWithIssues.length)
        : 0,
      totalIncidents: machinesWithIssues.reduce((sum: number, m: any) => sum + m.incidents, 0),
      totalOpenIncidents: machinesWithIssues.reduce((sum: number, m: any) => sum + m.openIncidents, 0),
      totalResolvedIncidents: machinesWithIssues.reduce((sum: number, m: any) => sum + m.resolvedIncidents, 0)
    }
  };

  return res.json(response as IndustrialZoneData);
}

// Define column structure for PDF/Excel export
interface ColumnDefinition {
  key: string;
  header: string;
  width?: number;
  format?: (value: any) => string;
  align?: 'left' | 'center' | 'right';
}

export const exportReport = async (req: Request, res: Response) => {
  try {
    const { from, to, zoneId, reportType, format: exportFormat = 'pdf', customerId, productType, stage, createdById, search, ...otherFilters } = req.query as unknown as ReportFilters & { format: string; customerId?: string; productType?: string; stage?: string; createdById?: string; search?: string };
    // Validate required parameters
    if (!reportType) {
      return res.status(400).json({ error: 'Report type is required' });
    }

    const startDate = from ? new Date(from as string) : subDays(new Date(), 30);
    const endDate = to ? new Date(to as string) : new Date();

    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);

    // Date Range Validation (Safety Guard)
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      return res.status(400).json({ error: 'Report range cannot exceed 366 days for performance reasons' });
    }

    if (diffDays < 0) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const isOfferReport = ['offer-summary', 'zone-user-offer-summary', 'target-report', 'product-type-analysis', 'customer-performance'].includes(reportType);

    const whereClause: any = isOfferReport
      ? {
        offerMonth: {
          gte: format(startDate, 'yyyy-MM'),
          lte: format(endDate, 'yyyy-MM'),
        }
      }
      : {
        OR: [
          {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            status: { in: ['RESOLVED', 'CLOSED'] },
            updatedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        ]
      };

    if (zoneId) {
      whereClause.zoneId = parseInt(zoneId as string);
    }

    // Apply additional offer-related filters for export
    if (customerId) {
      whereClause.customerId = parseInt(customerId as string);
    }
    if (productType) {
      whereClause.productType = productType;
    }
    if (stage) {
      whereClause.stage = stage;
    }
    if (createdById) {
      whereClause.createdById = parseInt(createdById as string);
    }
    if (search) {
      whereClause.OR = [
        { offerReferenceNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { contactPersonName: { contains: search, mode: 'insensitive' } },
        { poNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    let data: any[] = [];
    let columns: ColumnDefinition[] = [];
    let summaryData: any = null;

    // Custom title mapping for better report names
    const titleMap: { [key: string]: string } = {
      'industrial-data': 'Machine Report',
      'ticket-summary': 'Ticket Analytics Report',

      'zone-performance': 'Zone Performance Report',
      'agent-productivity': 'Performance Report of All Service Persons and Zone Users',
      'sla-performance': 'SLA Performance Report',
      'executive-summary': 'Executive Summary Report',
      'her-analysis': 'Business Hours SLA Report',
      'offer-summary': 'Offer Funnel Summary Report'
    };

    const reportTitle = titleMap[reportType] || reportType.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    const filename = `${reportTitle.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;

    // Build filter display info for the export header
    const filters: any = {
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    };

    // Add zone name to filters display
    if (zoneId) {
      try {
        const zone = await prisma.serviceZone.findUnique({ where: { id: parseInt(zoneId as string) }, select: { name: true } });
        filters.zoneName = zone?.name || `Zone ${zoneId}`;
      } catch { filters.zoneName = `Zone ${zoneId}`; }
    }

    // Add product type to filters display
    if (productType) {
      const ptLabels: Record<string, string> = {
        'RELOCATION': 'Relocation', 'CONTRACT': 'Contract', 'SPARE_PARTS': 'Spare Parts',
        'KARDEX_CONNECT': 'Kardex Connect', 'UPGRADE_KIT': 'Upgrade Kit', 'SOFTWARE': 'Software',
        'OTHERS': 'Others', 'BD_SPARE': 'BD Spare', 'RETROFIT_KIT': 'Retrofit Kit'
      };
      filters.productType = ptLabels[productType] || productType;
    }

    // Add stage to filters display
    if (stage) {
      const stageLabels: Record<string, string> = {
        'INITIAL': 'Initial', 'PROPOSAL_SENT': 'Proposal Sent', 'NEGOTIATION': 'Negotiation',
        'PO_RECEIVED': 'PO Received', 'WON': 'Won', 'LOST': 'Lost'
      };
      filters.stage = stageLabels[stage] || stage;
    }

    // Add created by name to filters display
    if (createdById) {
      try {
        const creator = await prisma.user.findUnique({ where: { id: parseInt(createdById as string) }, select: { name: true } });
        filters.createdBy = creator?.name || `User ${createdById}`;
      } catch { filters.createdBy = `User ${createdById}`; }
    }

    // Get data based on report type
    switch (reportType) {
      case 'ticket-summary':
        // For Excel export, fetch full ticket details with all relations
        if (exportFormat.toLowerCase() === 'excel' || exportFormat.toLowerCase() === 'xlsx') {
          const fullTickets = await prisma.ticket.findMany({
            where: whereClause,
            include: {
              customer: { select: { id: true, companyName: true, address: true } },
              zone: { select: { id: true, name: true } },
              assignedTo: { select: { id: true, name: true } },
              asset: { select: { id: true, serialNo: true, model: true, machineId: true } },
              contact: { select: { id: true, name: true, phone: true, email: true } },
              statusHistory: {
                select: { status: true, changedAt: true },
                orderBy: { changedAt: 'asc' }
              },
            },
            orderBy: { createdAt: 'desc' },
          });
          // Compute visit timestamps and time metrics from statusHistory
          data = fullTickets.map((ticket: any) => {
            const sh = ticket.statusHistory || [];
            const findStatus = (s: string) => sh.find((h: any) => h.status === s);
            
            const visitPlannedDate = ticket.visitPlannedDate || findStatus('ONSITE_VISIT_PLANNED')?.changedAt || null;
            const visitStartedAt = ticket.visitStartedAt || findStatus('ONSITE_VISIT_STARTED')?.changedAt || null;
            const visitReachedAt = ticket.visitReachedAt || findStatus('ONSITE_VISIT_REACHED')?.changedAt || null;
            const visitResolvedAt = ticket.visitResolvedAt || findStatus('ONSITE_VISIT_RESOLVED')?.changedAt || null;
            const visitCompletedDate = ticket.visitCompletedDate || findStatus('ONSITE_VISIT_COMPLETED')?.changedAt || null;
            const onsiteStart = ticket.visitInProgressAt || findStatus('ONSITE_VISIT_IN_PROGRESS')?.changedAt || null;

            // Travel time = (Started→Reached) 
            // Fallback: If Started is missing but we have Reached, we assume a minimal travel or ignore
            let travelTime = 0;
            if (visitStartedAt && visitReachedAt) {
              travelTime = Math.max(0, differenceInMinutes(new Date(visitReachedAt), new Date(visitStartedAt)));
            } else if (visitReachedAt && ticket.createdAt) {
              // If we have a reach time but no start time, calculate from creation as a loose fallback
              travelTime = Math.max(0, differenceInMinutes(new Date(visitReachedAt), new Date(ticket.createdAt)));
            }

            // Onsite working time = (InProgress→Resolved)
            let onsiteWorkingTime = 0;
            if (onsiteStart && visitResolvedAt) {
              onsiteWorkingTime = Math.max(0, differenceInMinutes(new Date(visitResolvedAt), new Date(onsiteStart)));
            } else if (visitResolvedAt && visitReachedAt) {
              // Fallback: If InProgress is missing, use Reached to Resolved
              onsiteWorkingTime = Math.max(0, differenceInMinutes(new Date(visitResolvedAt), new Date(visitReachedAt)));
            }

            // Total resolution time (business hours)
            let totalResolutionTime = 0;
            if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
              const resolutionEnd = visitCompletedDate || visitResolvedAt || ticket.updatedAt;
              totalResolutionTime = calculateBusinessHoursMinutes(ticket.createdAt, resolutionEnd);
            }
            return {
              ...ticket,
              visitPlannedDate,
              visitStartedAt,
              visitReachedAt,
              visitResolvedAt,
              visitCompletedDate,
              travelTime,
              onsiteWorkingTime,
              totalResolutionTime,
            };
          });
          summaryData = {
            totalTickets: data.length,
            resolvedTickets: data.filter((t: any) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
            openTickets: data.filter((t: any) => t.status === 'OPEN').length,
          };
        } else {
          const ticketData = await getTicketSummaryData(whereClause, startDate, endDate);
          data = ticketData.tickets || [];
          summaryData = ticketData.summary;
        }
        columns = getPdfColumns('ticket-summary');
        break;

      case 'sla-performance':
        const slaData = await getSlaPerformanceData(whereClause, startDate, endDate);
        data = slaData.breachedTickets || [];
        summaryData = slaData.summary;
        columns = getPdfColumns('sla-performance');
        break;

      case 'executive-summary':
        const executiveData = await getExecutiveSummaryData(whereClause, startDate, endDate);
        data = executiveData.trends || [];
        summaryData = executiveData.summary;
        columns = getPdfColumns('executive-summary');
        break;

      case 'industrial-data':
        const industrialData = await getIndustrialDataData(whereClause, startDate, endDate, otherFilters);
        data = industrialData.machineDowntime || [];
        summaryData = industrialData.summary;
        columns = getPdfColumns('industrial-data');
        break;

      case 'agent-productivity':
        const agentData = await getAgentProductivityData(whereClause, startDate, endDate);
        data = agentData.agents || [];
        summaryData = agentData.summary;
        columns = getPdfColumns('agent-productivity');
        break;

      case 'zone-performance':
        const zoneData = await getZonePerformanceData(whereClause, startDate, endDate);
        data = zoneData.zones || [];
        summaryData = zoneData.summary;
        columns = getPdfColumns('zone-performance');
        break;

      case 'her-analysis':
        // HER Analysis uses the same data structure as the generateHerAnalysisReport
        const herTickets = await prisma.ticket.findMany({
          where: whereClause,
          include: {
            customer: true,
            assignedTo: true,
            zone: true,
            asset: true
          }
        });

        // HER calculation helper functions
        const BUSINESS_START_HOUR = 9;
        const BUSINESS_END_HOUR = 17;
        const BUSINESS_END_MINUTE = 30;
        const WORKING_DAYS = [1, 2, 3, 4, 5, 6];
        const SLA_HOURS_BY_PRIORITY: Record<string, number> = {
          'CRITICAL': 4, 'HIGH': 8, 'MEDIUM': 24, 'LOW': 48
        };

        const calculateBusinessHours = (startDate: Date, endDate: Date): number => {
          let businessHours = 0;
          let currentDate = new Date(startDate);
          let safetyCounter = 0;
          const MAX_ITERATIONS = 400; // Just over a year of days

          while (currentDate < endDate && safetyCounter < MAX_ITERATIONS) {
            safetyCounter++;
            const dayOfWeek = currentDate.getDay();
            if (WORKING_DAYS.includes(dayOfWeek)) {
              const dayStart = new Date(currentDate);
              dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
              const dayEnd = new Date(currentDate);
              dayEnd.setHours(BUSINESS_END_HOUR, BUSINESS_END_MINUTE, 0, 0);
              const periodStart = new Date(Math.max(currentDate.getTime(), dayStart.getTime()));
              const periodEnd = new Date(Math.min(endDate.getTime(), dayEnd.getTime()));
              if (periodStart < periodEnd) {
                businessHours += (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60);
              }
            }
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
          }
          return businessHours;
        };

        data = herTickets.map((ticket: any) => {
          const priority = ticket.priority || 'LOW';
          const herHours = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY['LOW'];
          let businessHoursUsed = 0;
          let isHerBreached = false;
          let resolvedAt = null;

          if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
            businessHoursUsed = calculateBusinessHours(ticket.createdAt, ticket.updatedAt);
            isHerBreached = businessHoursUsed > herHours;
            resolvedAt = ticket.updatedAt;
          } else {
            businessHoursUsed = calculateBusinessHours(ticket.createdAt, new Date());
          }

          return {
            id: ticket.id,
            title: ticket.title,
            customer: ticket.customer?.companyName || 'Unknown',
            serialNo: ticket.asset?.serialNo || 'N/A',
            address: ticket.customer?.address || 'N/A',
            status: ticket.status,
            priority: ticket.priority,
            assignedTo: ticket.assignedTo?.name || 'Unassigned',
            createdAt: ticket.createdAt,
            zone: ticket.zone?.name || 'No Zone',
            herHours,
            businessHoursUsed: Math.round(businessHoursUsed * 100) / 100,
            isHerBreached: isHerBreached ? 'Yes' : 'No',
            resolvedAt: resolvedAt
          };
        });

        const herCompliantTickets = data.filter((t: any) => t.isHerBreached === 'No').length;
        const herBreachedTickets = data.filter((t: any) => t.isHerBreached === 'Yes').length;
        const complianceRate = data.length > 0 ? (herCompliantTickets / data.length) * 100 : 100;

        summaryData = {
          'Total Tickets': data.length,
          'HER Compliant': herCompliantTickets,
          'HER Breached': herBreachedTickets,
          'Compliance Rate': `${Math.round(complianceRate * 100) / 100}%`
        };

        columns = [
          { key: 'id', header: 'Ticket ID', width: 12 },
          { key: 'title', header: 'Title', width: 30 },
          { key: 'customer', header: 'Customer', width: 25 },
          { key: 'serialNo', header: 'Serial No', width: 18 },
          { key: 'address', header: 'Address', width: 30 },
          { key: 'status', header: 'Status', width: 15 },
          { key: 'priority', header: 'Priority', width: 12 },
          { key: 'assignedTo', header: 'Assigned To', width: 20 },
          { key: 'createdAt', header: 'Created', width: 20, format: (date: string) => new Date(date).toLocaleString() },
          { key: 'zone', header: 'Zone', width: 20 },
          { key: 'herHours', header: 'SLA Hours', width: 15 },
          { key: 'businessHoursUsed', header: 'Hours Used', width: 15 },
          { key: 'isHerBreached', header: 'Breached', width: 15 },
          { key: 'resolvedAt', header: 'Resolved', width: 20, format: (date: string) => date ? new Date(date).toLocaleString() : 'N/A' }
        ];
        break;

      case 'offer-summary':
      case 'zone-user-offer-summary':
        // Fetch offers with all related data
        const isOfferSummaryReport = reportType === 'offer-summary';
        const offers = await prisma.offer.findMany({
          where: whereClause,
          include: {
            customer: true,
            contact: true,
            zone: true,
            assignedTo: true,
            createdBy: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        data = offers;
        summaryData = {
          totalOffers: offers.length,
          totalOfferValue: offers.reduce((sum: number, o: any) => sum + (parseFloat(String(o.offerValue || 0)) || 0), 0),
          totalPoValue: offers.reduce((sum: number, o: any) => sum + (parseFloat(String(o.poValue || 0)) || 0), 0),
          wonOffers: offers.filter((o: any) => o.stage === 'WON').length,
          lostOffers: offers.filter((o: any) => o.stage === 'LOST').length,
        };
        columns = getPdfColumns('offer-summary');
        break;

      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
    if (exportFormat.toLowerCase() === 'pdf') {
      // Generate PDF with summary and data
      await generatePdf(res, data, columns, reportTitle, filters, summaryData);
    } else if (exportFormat.toLowerCase() === 'excel' || exportFormat.toLowerCase() === 'xlsx') {
      // Generate Excel with enhanced formatting and summary data
      const excelColumns = getExcelColumns(reportType);
      
      // Ensure the generator knows this is a ticket report for data-only mode
      // This is crucial for bypassing headers/summaries
      const exportFilters = { ...filters, reportType: reportType };
      
      await generateExcel(res, data, excelColumns, reportTitle, exportFilters, summaryData);
    } else {
      // Default to PDF export
      const pdfColumns = getPdfColumns(reportType);
      await generatePdf(res, data, pdfColumns, reportTitle, filters, summaryData);
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to safely get nested properties
const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((acc, part) => {
    if (acc === null || acc === undefined) return '';
    if (Array.isArray(acc[part])) return acc[part].join(', ');
    return acc[part] !== undefined ? acc[part] : '';
  }, obj);
};

// Business hours configuration
const BUSINESS_START_HOUR = 9;    // 9:00 AM
const BUSINESS_END_HOUR = 17;     // 5:30 PM
const BUSINESS_END_MINUTE = 30;
const WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Monday to Saturday (0 = Sunday)

// Helper function to calculate business hours between two dates
function calculateBusinessHoursMinutes(startDate: Date, endDate: Date): number {
  if (!startDate || !endDate || startDate >= endDate) return 0;

  let businessMinutes = 0;
  const current = new Date(startDate);

  // Daily business hours in minutes (9:00 AM to 5:30 PM = 8.5 hours = 510 minutes)
  const dailyBusinessMinutes = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60 + BUSINESS_END_MINUTE;

  while (current < endDate) {
    const dayOfWeek = current.getDay();

    // Skip Sundays (day 0)
    if (WORKING_DAYS.includes(dayOfWeek)) {
      // Get business hours start and end for this day
      const dayStart = new Date(current);
      dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);

      const dayEnd = new Date(current);
      dayEnd.setHours(BUSINESS_END_HOUR, BUSINESS_END_MINUTE, 0, 0);

      // Calculate overlap between [current, endDate] and [dayStart, dayEnd]
      const periodStart = new Date(Math.max(current.getTime(), dayStart.getTime()));
      const periodEnd = new Date(Math.min(endDate.getTime(), dayEnd.getTime()));

      if (periodStart < periodEnd) {
        const minutesThisDay = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60));
        businessMinutes += minutesThisDay;
      }
    }

    // Move to next day at midnight
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return businessMinutes;
}

// Helper functions to get report data without sending response
async function getTicketSummaryData(whereClause: any, startDate: Date, endDate: Date): Promise<TicketSummaryData> {
  // Debug: Log the where clause to see what's being filtered


  // First, get all tickets without any filters to verify data exists
  const allTickets = await prisma.ticket.findMany({
    take: 1 // Just get one ticket to check if any exist
  });



  // Now get the actual tickets with the provided filters
  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      visitCompletedDate: true,
      actualResolutionTime: true,
      relatedMachineIds: true,
      customerId: true,
      zoneId: true,
      assignedToId: true,
      isEscalated: true,
      callType: true,
      customer: { select: { id: true, companyName: true } },
      zone: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      statusHistory: {
        select: { status: true, changedAt: true },
        orderBy: { changedAt: 'desc' }
      },
      reports: { select: { id: true } }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });



  const statusDistribution = await prisma.ticket.groupBy({
    by: ['status'],
    where: whereClause,
    _count: true,
  });

  const priorityDistribution = await prisma.ticket.groupBy({
    by: ['priority'],
    where: whereClause,
    _count: true,
  });

  const slaDistribution = await prisma.ticket.groupBy({
    by: ['slaStatus'],
    where: whereClause,
    _count: true,
  });

  // Generate daily trends in memory (Optimization: No N+1 queries)
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
  const dailyTrends = dateRange.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfDayTime = startOfDay(date).getTime();
    const endOfDayTime = startOfDay(date).getTime() + 24 * 60 * 60 * 1000 - 1;

    const created = tickets.filter(t => {
      const ticketTime = new Date(t.createdAt).getTime();
      return ticketTime >= startOfDayTime && ticketTime <= endOfDayTime;
    }).length;

    const resolved = tickets.filter(t => {
      if (!['RESOLVED', 'CLOSED'].includes(t.status)) return false;
      const ticketTime = new Date(t.updatedAt).getTime();
      return ticketTime >= startOfDayTime && ticketTime <= endOfDayTime;
    }).length;

    return {
      date: dateStr,
      created,
      resolved
    };
  });

  // Calculate average resolution time (BUSINESS HOURS ONLY)
  const resolvedTickets = tickets.filter((t: { status: string }) =>
    t.status === 'RESOLVED' || t.status === 'CLOSED'
  );

  let avgResolutionTime = 0;
  if (resolvedTickets.length > 0) {
    const totalTime = resolvedTickets.reduce((sum: number, ticket: any) => {
      const resolutionMinutes = calculateTicketResolutionMinutes(
        ticket.actualResolutionTime,
        ticket.relatedMachineIds,
        ticket.createdAt,
        ticket.updatedAt,
        ticket.visitCompletedDate
      );
      return sum + resolutionMinutes;
    }, 0);
    avgResolutionTime = Math.round(totalTime / resolvedTickets.length);
  }

  // Enhanced ticket data with all required fields
  const enhancedTickets = tickets.map((ticket: any) => {
    // Calculate response time (first response)
    let responseTimeMins = 0;
    if (ticket.relatedMachineIds) {
      try {
        const metadata = JSON.parse(ticket.relatedMachineIds);
        if (metadata.respondTimeMinutes && metadata.respondTimeMinutes > 0) {
          responseTimeMins = metadata.respondTimeMinutes;
        }
      } catch { /* ignore */ }
    }

    if (responseTimeMins === 0 && ticket.statusHistory && ticket.statusHistory.length > 0) {
      const firstResponse = ticket.statusHistory.find((h: any) => h.status !== 'OPEN');
      if (firstResponse) {
        responseTimeMins = calculateBusinessHoursInMinutes(ticket.createdAt, firstResponse.changedAt);
      }
    }
    const responseTime = responseTimeMins;

    // Calculate travel time using status history: (STARTED → REACHED) + (RESOLVED → COMPLETED)
    let travelTime = 0;
    if (ticket.statusHistory && ticket.statusHistory.length > 0) {
      const statusHistory = ticket.statusHistory;

      // Going travel time (ONSITE_VISIT_STARTED → ONSITE_VISIT_REACHED)
      const goingStart = statusHistory.find((h: any) => h.status === 'ONSITE_VISIT_STARTED');
      const goingEnd = statusHistory.find((h: any) => h.status === 'ONSITE_VISIT_REACHED');

      // Return travel time (ONSITE_VISIT_RESOLVED → ONSITE_VISIT_COMPLETED)
      const returnStart = statusHistory.find((h: any) => h.status === 'ONSITE_VISIT_RESOLVED');
      const returnEnd = statusHistory.find((h: any) => h.status === 'ONSITE_VISIT_COMPLETED');

      let totalTravelMinutes = 0;
      let hasValidTravel = false;

      // Add going travel time
      if (goingStart && goingEnd && goingStart.changedAt < goingEnd.changedAt) {
        const goingMinutes = differenceInMinutes(new Date(goingEnd.changedAt), new Date(goingStart.changedAt));
        if (goingMinutes > 0 && goingMinutes <= 120) { // Max 2 hours for one-way travel
          totalTravelMinutes += goingMinutes;
          hasValidTravel = true;
        }
      }

      // Add return travel time
      if (returnStart && returnEnd && returnStart.changedAt < returnEnd.changedAt) {
        const returnMinutes = differenceInMinutes(new Date(returnEnd.changedAt), new Date(returnStart.changedAt));
        if (returnMinutes > 0 && returnMinutes <= 120) { // Max 2 hours for one-way travel
          totalTravelMinutes += returnMinutes;
          hasValidTravel = true;
        }
      }

      // Only use if we have valid travel data and total is reasonable
      if (hasValidTravel && totalTravelMinutes <= 240) { // Max 4 hours total travel
        travelTime = totalTravelMinutes;
      }
    }

    // Calculate onsite working time using status history: ONSITE_VISIT_IN_PROGRESS → ONSITE_VISIT_RESOLVED
    let onsiteWorkingTime = 0;
    if (ticket.statusHistory && ticket.statusHistory.length > 0) {
      const statusHistory = ticket.statusHistory;

      const onsiteStart = statusHistory.find((h: any) => h.status === 'ONSITE_VISIT_IN_PROGRESS');
      const onsiteEnd = statusHistory.find((h: any) => h.status === 'ONSITE_VISIT_RESOLVED');

      if (onsiteStart && onsiteEnd && onsiteStart.changedAt < onsiteEnd.changedAt) {
        const workingMinutes = differenceInMinutes(new Date(onsiteEnd.changedAt), new Date(onsiteStart.changedAt));
        if (workingMinutes > 0 && workingMinutes <= 480) { // Max 8 hours for onsite work
          onsiteWorkingTime = workingMinutes;
        }
      }
    }

    // Calculate total resolution time (BUSINESS HOURS ONLY)
    const totalResolutionTime = (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')
      ? calculateTicketResolutionMinutes(
        ticket.actualResolutionTime,
        ticket.relatedMachineIds,
        ticket.createdAt,
        ticket.updatedAt,
        ticket.visitCompletedDate
      )
      : 0;

    // Calculate machine downtime (BUSINESS HOURS ONLY - same as total resolution time)
    const machineDowntime = totalResolutionTime;

    // Calculate total response hours (from open to closed)
    const totalResponseHours = totalResolutionTime > 0 ? totalResolutionTime / 60 : 0;

    return {
      ...ticket,
      responseTime,
      travelTime,
      onsiteWorkingTime,
      totalResolutionTime,
      machineDowntime,
      totalResponseHours,
      callType: ticket.callType, // Use the actual database callType field
      reportsCount: ticket.reports ? ticket.reports.length : 0
    };
  });

  // Create default empty distributions
  const emptyDistribution = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
    CANCELLED: 0
  };

  const emptyPriorityDistribution = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  // If no tickets found, return empty data with zeros
  if (tickets.length === 0) {

    return {
      tickets: [],
      summary: {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
        averageResolutionTime: 0,
        escalatedTickets: 0,
      },
      statusDistribution: emptyDistribution,
      priorityDistribution: emptyPriorityDistribution,
      dailyTrends: dailyTrends.map(trend => ({
        ...trend,
        created: 0,
        resolved: 0
      }))
    };
  }

  return {
    tickets: enhancedTickets,
    summary: {
      totalTickets: tickets.length,
      openTickets: tickets.filter((t: any) => t.status === 'OPEN').length,
      inProgressTickets: tickets.filter((t: any) =>
        ['IN_PROGRESS', 'ASSIGNED', 'IN_PROCESS'].includes(t.status)
      ).length,
      resolvedTickets: resolvedTickets.length,
      closedTickets: tickets.filter((t: any) => t.status === 'CLOSED').length,
      averageResolutionTime: avgResolutionTime,
      escalatedTickets: tickets.filter((t: { isEscalated: boolean }) => t.isEscalated).length,
    },
    statusDistribution: statusDistribution.length > 0
      ? statusDistribution.reduce((acc: Record<string, number>, curr: { status: string; _count: number }) => ({
        ...acc,
        [curr.status]: curr._count
      }), {})
      : emptyDistribution,
    priorityDistribution: priorityDistribution.length > 0
      ? priorityDistribution.reduce((acc: Record<string, number>, curr: { priority: string; _count: number }) => ({
        ...acc,
        [curr.priority]: curr._count
      }), {})
      : emptyPriorityDistribution,
    dailyTrends
  };
}

async function getSlaPerformanceData(whereClause: any, startDate: Date, endDate: Date): Promise<SlaPerformanceData> {
  const tickets = await prisma.ticket.findMany({
    where: {
      ...whereClause,
      slaDueAt: { not: null }
    },
    include: {
      customer: true,
      assignedTo: true,
      zone: true,
      asset: true
    }
  });

  const now = new Date();
  const breachedTickets = tickets.filter((t: { slaDueAt: Date | null }) => t.slaDueAt && now > t.slaDueAt);

  // Calculate SLA compliance by priority
  const prioritySla = Object.values(Priority).reduce((acc: any, priority: any) => {
    const priorityTickets = tickets.filter((t: any) => t.priority === priority);
    const priorityBreaches = priorityTickets.filter((t: any) => t.slaDueAt && now > t.slaDueAt);

    acc[priority] = {
      total: priorityTickets.length,
      breaches: priorityBreaches.length,
      compliance: priorityTickets.length > 0
        ? ((priorityTickets.length - priorityBreaches.length) / priorityTickets.length) * 100
        : 100
    };
    return acc;
  }, {} as Record<string, any>);

  return {
    breachedTickets,
    summary: {
      totalTicketsWithSLA: tickets.length,
      slaBreaches: breachedTickets.length,
      slaOnTime: tickets.length - breachedTickets.length,
      complianceRate: tickets.length > 0
        ? ((tickets.length - breachedTickets.length) / tickets.length) * 100
        : 100
    },
    prioritySla
  };
}

async function getZonePerformanceData(whereClause: any, startDate: Date, endDate: Date): Promise<ZonePerformanceData> {
  // Build zone filter - if zoneId is in whereClause, filter zones too
  const zoneWhere: any = {};
  if (whereClause.zoneId !== undefined) {
    if (typeof whereClause.zoneId === 'number' || typeof whereClause.zoneId === 'string') {
      zoneWhere.id = parseInt(whereClause.zoneId as string);
    } else if (typeof whereClause.zoneId === 'object' && whereClause.zoneId !== null) {
      if (Array.isArray((whereClause.zoneId as any).in)) {
        zoneWhere.id = { in: (whereClause.zoneId as any).in };
      }
    }
  }

  const zones = await prisma.serviceZone.findMany({
    where: zoneWhere,
    include: {
      tickets: { where: whereClause },
      customers: {
        include: {
          assets: true
        }
      },
      servicePersons: true
    }
  });

  const zoneStats = zones.map((zone: any) => {
    const tickets = zone.tickets;
    const resolvedTickets = tickets.filter((t: { status: string }) =>
      t.status === 'RESOLVED' || t.status === 'CLOSED'
    );

    // Calculate average resolution time for this zone
    let avgResolutionTime = 0;
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum: number, ticket: any) => {
        const resTime = calculateTicketResolutionMinutes(
          ticket.actualResolutionTime,
          ticket.relatedMachineIds,
          ticket.createdAt,
          ticket.updatedAt,
          ticket.visitCompletedDate
        );
        return sum + resTime;
      }, 0);
      avgResolutionTime = Math.round(totalTime / resolvedTickets.length);
    }

    // Count customers and assets in this zone
    const customerCount = zone.customers.length;
    const assetCount = zone.customers.reduce((sum: number, customer: { assets: any[] }) => sum + customer.assets.length, 0);

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      openTickets: tickets.filter((t: any) =>
        ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status)
      ).length,
      servicePersons: zone.servicePersons.length,
      customerCount,
      assetCount,
      resolutionRate: tickets.length > 0
        ? parseFloat(((resolvedTickets.length / tickets.length) * 100).toFixed(2))
        : 0,
      averageResolutionTime: avgResolutionTime,
      escalatedTickets: tickets.filter((t: { isEscalated: boolean }) => t.isEscalated).length
    };
  });

  return {
    zones: zoneStats,
    summary: {
      totalZones: zones.length,
      totalTickets: zoneStats.reduce((sum: number, zone: { totalTickets: number }) => sum + (zone.totalTickets || 0), 0),
      totalResolved: zoneStats.reduce((sum: number, zone: { resolvedTickets: number }) => sum + (zone.resolvedTickets || 0), 0),
      averageResolutionRate: zoneStats.length > 0
        ? zoneStats.reduce((sum: number, zone: { resolutionRate: number }) => sum + (zone.resolutionRate || 0), 0) / zoneStats.length
        : 0
    }
  };
}

async function getAgentProductivityData(whereClause: any, startDate: Date, endDate: Date): Promise<AgentProductivityData> {
  // First, get the list of zones from whereClause if possible
  let zoneIds: number[] = [];
  if (whereClause.zoneId) {
    if (typeof whereClause.zoneId === 'number') zoneIds = [whereClause.zoneId];
    else if (whereClause.zoneId.in) zoneIds = whereClause.zoneId.in;
  }

  // Fetch all service persons who are active and in the relevant zones
  const agents = await prisma.user.findMany({
    where: {
      role: 'SERVICE_PERSON',
      isActive: true,
      ...(zoneIds.length > 0 ? {
        serviceZones: {
          some: {
            serviceZoneId: { in: zoneIds }
          }
        }
      } : {})
    },
    include: {
      assignedTickets: {
        where: whereClause,
        include: {
          customer: true,
          zone: true,
          asset: true
        }
      },
      serviceZones: {
        include: {
          serviceZone: true
        }
      }
    }
  });

  const agentStats = agents.map((agent: any) => {
    const tickets = agent.assignedTickets || [];
    const resolvedTickets = tickets.filter((t: { status: string }) =>
      t.status === 'RESOLVED' || t.status === 'CLOSED'
    );

    // Calculate average resolution time in minutes
    const resolvedWithTime = resolvedTickets;
    const totalResolutionTime = resolvedTickets.reduce((sum: number, t: any) => {
      const resTime = calculateTicketResolutionMinutes(
        t.actualResolutionTime,
        t.relatedMachineIds,
        t.createdAt,
        t.updatedAt,
        t.visitCompletedDate
      );
      return sum + resTime;
    }, 0);

    const avgResolutionTime = resolvedWithTime.length > 0
      ? Math.round(totalResolutionTime / resolvedWithTime.length)
      : 0;

    // Calculate first response time (simplified)
    const ticketsWithResponse = tickets.filter((t: any) => t.updatedAt !== t.createdAt);
    const avgFirstResponseTime = ticketsWithResponse.length > 0
      ? Math.round(ticketsWithResponse.reduce((sum: number, t: any) => {
        return sum + calculateBusinessHoursInMinutes(t.createdAt, t.updatedAt);
      }, 0) / ticketsWithResponse.length)
      : 0;

    return {
      agentId: agent.id,
      agentName: agent.name || agent.email || `Agent ${agent.id}`,
      email: agent.email,
      zones: agent.serviceZones.map((sz: any) => sz.serviceZone.name),
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      openTickets: tickets.filter((t: any) =>
        ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status)
      ).length,
      resolutionRate: tickets.length > 0
        ? parseFloat(((resolvedTickets.length / tickets.length) * 100).toFixed(2))
        : 0,
      averageResolutionTime: avgResolutionTime,
      averageFirstResponseTime: avgFirstResponseTime,
      escalatedTickets: tickets.filter((t: { isEscalated: boolean }) => t.isEscalated).length
    };
  });

  return {
    agents: agentStats,
    summary: {
      totalAgents: agents.length,
      performanceMetrics: {
        topPerformer: agentStats.length > 0
          ? agentStats.reduce((max: any, agent: any) =>
            agent.resolutionRate > max.resolutionRate ? agent : max, agentStats[0])
          : null,
        averageResolutionRate: agentStats.length > 0
          ? agentStats.reduce((sum: number, agent: any) => sum + agent.resolutionRate, 0) / agentStats.length
          : 0
      }
    }
  };
}

async function getIndustrialDataData(whereClause: any, startDate: Date, endDate: Date, filters?: { customerId?: string, assetId?: string }): Promise<IndustrialZoneData> {
  // Get zone users (ZONE_USER role)
  const zoneUsers = await prisma.user.findMany({
    where: {
      role: UserRole.ZONE_USER,
      isActive: true
    },
    include: {
      serviceZones: {
        include: {
          serviceZone: true
        }
      }
    }
  });

  // Get service persons
  const servicePersons = await prisma.user.findMany({
    where: {
      role: UserRole.SERVICE_PERSON,
      isActive: true
    },
    include: {
      serviceZones: {
        include: {
          serviceZone: true
        }
      },
      assignedTickets: {
        where: whereClause,
        include: {
          asset: true
        }
      }
    }
  });

  // Build additional filters for tickets based on customerId and assetId
  const ticketFilters: any = {
    ...whereClause,
    OR: [
      { status: { in: ['OPEN', 'IN_PROGRESS', 'ASSIGNED'] } },
      {
        status: { in: ['RESOLVED', 'CLOSED'] },
        updatedAt: { gte: startDate, lte: endDate }
      }
    ]
  };

  // Add customer filter if specified
  if (filters?.customerId) {
    ticketFilters.customerId = parseInt(filters.customerId);
  }

  // Add asset filter if specified
  if (filters?.assetId) {
    ticketFilters.assetId = parseInt(filters.assetId);
  }

  // Get machine downtime data
  const ticketsWithDowntime = await prisma.ticket.findMany({
    where: ticketFilters,
    include: {
      asset: {
        include: {
          customer: true
        }
      },
      zone: true,
      assignedTo: true
    }
  });

  // Calculate downtime for each machine
  const machineDowntime = ticketsWithDowntime.map((ticket: any) => {
    let downtimeMinutes = 0;

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      downtimeMinutes = calculateTicketResolutionMinutes(
        ticket.actualResolutionTime,
        ticket.relatedMachineIds,
        ticket.createdAt,
        ticket.updatedAt,
        ticket.visitCompletedDate
      );
    } else {
      // For open tickets, calculate time from creation to now (business hours)
      downtimeMinutes = calculateBusinessHoursInMinutes(new Date(ticket.createdAt), new Date());
    }

    // Format downtime in hours and minutes
    const downtimeHours = Math.floor(downtimeMinutes / 60);
    const remainingMinutes = downtimeMinutes % 60;
    const downtimeFormatted = downtimeMinutes > 0
      ? `${downtimeHours}h ${remainingMinutes}m`
      : '0h 0m';

    // Determine assigned technician (zone user or service person)
    let assignedTechnician = 'Unassigned';
    if (ticket.assignedTo) {
      // Check if it's a zone user or service person and format accordingly
      const role = ticket.assignedTo.role;
      const name = ticket.assignedTo.name || ticket.assignedTo.email;
      if (role === 'ZONE_USER') {
        assignedTechnician = `${name} (Zone User)`;
      } else if (role === 'SERVICE_PERSON') {
        assignedTechnician = `${name} (Service Person)`;
      } else {
        assignedTechnician = name;
      }
    }

    return {
      machineId: ticket.asset?.machineId || 'Unknown',
      model: ticket.asset?.model || 'Unknown',
      serialNo: ticket.asset?.serialNo || 'Unknown',
      customer: ticket.asset?.customer?.companyName || 'Unknown',
      zone: ticket.zone?.name || 'Unknown',
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? ticket.updatedAt : null,
      downtimeMinutes,
      downtimeFormatted,
      assignedTo: ticket.assignedTo?.name || 'Unassigned',
      assignedTechnician
    };
  });

  // Group downtime by machine
  const machineDowntimeSummary = machineDowntime.reduce((acc: any, curr: any) => {
    const machineKey = curr.machineId;
    if (!acc[machineKey]) {
      acc[machineKey] = {
        machineId: curr.machineId,
        model: curr.model,
        serialNo: curr.serialNo,
        customer: curr.customer,
        totalDowntimeMinutes: 0,
        incidents: 0,
        openIncidents: 0,
        resolvedIncidents: 0
      };
    }

    acc[machineKey].totalDowntimeMinutes += curr.downtimeMinutes;
    acc[machineKey].incidents += 1;

    if (curr.status === 'RESOLVED' || curr.status === 'CLOSED') {
      acc[machineKey].resolvedIncidents += 1;
    } else {
      acc[machineKey].openIncidents += 1;
    }

    return acc;
  }, {} as Record<string, any>);

  // Filter machine downtime by asset if specified
  const filteredMachineDowntime = Object.values(machineDowntimeSummary).filter((machine: any) => {
    if (filters?.assetId && machine.machineId !== filters.assetId) {
      return false;
    }
    return true;
  }).map((machine: any) => ({
    ...machine,
    totalDowntimeHours: Math.round((machine.totalDowntimeMinutes / 60) * 100) / 100,
    avgDowntimeHours: machine.incidents > 0 ? Math.round((machine.totalDowntimeMinutes / machine.incidents / 60) * 100) / 100 : 0
  }));

  return {
    zoneName: whereClause?.zoneId ? `Zone ${whereClause.zoneId}` : 'All Zones',
    zoneId: whereClause?.zoneId ? parseInt(whereClause.zoneId) : 0,
    zoneUsers: zoneUsers.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      zones: user.serviceZones.map((sz: any) => sz.serviceZone.name),
      lastLogin: user.lastLoginAt,
      customerId: user.customerId
    })),
    servicePersons: servicePersons.map((sp: any) => ({
      id: sp.id,
      name: sp.name,
      email: sp.email,
      phone: sp.phone,
      zones: sp.serviceZones.map((sz: any) => sz.serviceZone.name),
      assignedTickets: sp.assignedTickets?.length || 0,
      activeTickets: sp.assignedTickets?.filter((t: any) =>
        ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status)
      ).length || 0
    })),
    machineDowntime: filteredMachineDowntime as any[],
    detailedDowntime: machineDowntime.filter((downtime: any) =>
      !filters?.assetId || downtime.machineId === filters.assetId
    ) as any[],
    summary: {
      totalZoneUsers: zoneUsers.length,
      totalServicePersons: servicePersons.length,
      totalMachinesWithDowntime: filteredMachineDowntime.length,
      totalDowntimeHours: filteredMachineDowntime.reduce((sum: number, machine: any) =>
        sum + Math.round((machine.totalDowntimeMinutes || 0) / 60 * 100) / 100, 0
      ),
      averageDowntimePerMachine: filteredMachineDowntime.length > 0
        ? Math.round(filteredMachineDowntime.reduce((sum: number, machine: any) =>
          sum + (machine.totalDowntimeMinutes || 0), 0
        ) / filteredMachineDowntime.length / 60 * 100) / 100
        : 0
    }
  };
}

async function generateExecutiveSummaryReport(res: Response, whereClause: any, startDate: Date, endDate: Date) {
  try {
    // Get comprehensive data for executive summary
    const [
      tickets,
      feedbacks,
      zones,
      agents,
      customers,
      assets
    ] = await Promise.all([
      // All tickets in date range
      prisma.ticket.findMany({
        where: whereClause,
        include: {
          customer: true,
          assignedTo: true,
          zone: true,
          asset: true
        }
      }),
      // Customer feedback
      prisma.ticketFeedback.findMany({
        where: {
          submittedAt: { gte: startDate, lte: endDate }
        },
        include: {
          ticket: { include: { customer: true } }
        }
      }),
      // Service zones
      prisma.serviceZone.findMany({
        include: {
          tickets: { where: whereClause },
          customers: true,
          servicePersons: true
        }
      }),
      // Service agents
      prisma.user.findMany({
        where: { role: 'SERVICE_PERSON' },
        include: {
          assignedTickets: { where: whereClause }
        }
      }),
      // Customers
      prisma.customer.findMany({
        include: {
          tickets: { where: whereClause },
          assets: true
        }
      }),
      // Assets
      prisma.asset.findMany({
        include: {
          tickets: { where: whereClause }
        }
      })
    ]);

    // Calculate key metrics
    const resolvedTickets = tickets.filter((t: { status: string }) => ['RESOLVED', 'CLOSED'].includes(t.status));
    const openTickets = tickets.filter((t: { status: string }) => ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status));
    const criticalTickets = tickets.filter((t: { priority: string }) => t.priority === 'CRITICAL');

    // Calculate resolution metrics (BUSINESS HOURS ONLY)
    let avgResolutionTime = 0;
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum: number, ticket: any) => {
        const resTime = calculateTicketResolutionMinutes(
          ticket.actualResolutionTime,
          ticket.relatedMachineIds,
          ticket.createdAt,
          ticket.updatedAt,
          ticket.visitCompletedDate
        );
        return sum + resTime;
      }, 0);
      avgResolutionTime = Math.round(totalTime / resolvedTickets.length);
    }

    // Customer satisfaction metrics
    const avgRating = feedbacks.length > 0
      ? feedbacks.reduce((sum: number, fb: any) => sum + fb.rating, 0) / feedbacks.length
      : 0;

    // Financial impact estimation (simplified)
    const estimatedRevenueSaved = resolvedTickets.length * 500; // $500 per resolved ticket
    const downtimeCost = openTickets.length * 100; // $100 per hour of downtime

    // Zone performance
    const zonePerformance = zones.map((zone: any) => {
      const zoneTickets = zone.tickets;
      const zoneResolved = zoneTickets.filter((t: any) => ['RESOLVED', 'CLOSED'].includes(t.status));
      return {
        name: zone.name,
        efficiency: zoneTickets.length > 0 ? (zoneResolved.length / zoneTickets.length) * 100 : 0,
        ticketCount: zoneTickets.length,
        customerCount: zone.customers.length
      };
    });

    // Agent productivity
    const agentProductivity = agents.map((agent: any) => {
      const agentTickets = agent.assignedTickets;
      const agentResolved = agentTickets.filter((t: any) => ['RESOLVED', 'CLOSED'].includes(t.status));
      return {
        name: agent.name || agent.email,
        productivity: agentTickets.length > 0 ? (agentResolved.length / agentTickets.length) * 100 : 0,
        ticketCount: agentTickets.length
      };
    });

    // Asset health
    const assetHealth = assets.map((asset: any) => {
      const assetTickets = asset.tickets;
      const criticalIssues = assetTickets.filter((t: any) => t.priority === 'CRITICAL').length;
      return {
        machineId: asset.machineId,
        model: asset.model,
        healthScore: Math.max(0, 100 - (criticalIssues * 20)), // Simplified health score
        ticketCount: assetTickets.length
      };
    });

    // Trends data
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    const trends = await Promise.all(
      dateRange.slice(-7).map(async (date) => { // Last 7 days for trends
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const [created, resolved, feedback] = await Promise.all([
          prisma.ticket.count({
            where: { ...whereClause, createdAt: { gte: dayStart, lte: dayEnd } }
          }),
          prisma.ticket.count({
            where: {
              ...whereClause,
              status: { in: ['RESOLVED', 'CLOSED'] },
              updatedAt: { gte: dayStart, lte: dayEnd }
            }
          }),
          prisma.ticketFeedback.aggregate({
            where: { submittedAt: { gte: dayStart, lte: dayEnd } },
            _avg: { rating: true }
          })
        ]);

        return {
          date: format(date, 'MMM dd'),
          ticketsCreated: created,
          ticketsResolved: resolved,
          avgRating: feedback._avg.rating || 0
        };
      })
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalTickets: tickets.length,
          resolvedTickets: resolvedTickets.length,
          openTickets: openTickets.length,
          criticalTickets: criticalTickets.length,
          resolutionRate: tickets.length > 0 ? (resolvedTickets.length / tickets.length) * 100 : 0,
          avgResolutionTimeHours: Math.round(avgResolutionTime / 60),
          customerSatisfaction: parseFloat(avgRating.toFixed(1)),
          totalCustomers: customers.length,
          activeAssets: assets.length,
          estimatedRevenueSaved,
          downtimeCost,
          netBusinessImpact: estimatedRevenueSaved - downtimeCost
        },
        zonePerformance: zonePerformance.sort((a: { efficiency: number }, b: { efficiency: number }) => b.efficiency - a.efficiency),
        agentProductivity: agentProductivity.sort((a: { productivity: number }, b: { productivity: number }) => b.productivity - a.productivity),
        assetHealth: assetHealth.sort((a: { healthScore: number }, b: { healthScore: number }) => a.healthScore - b.healthScore),
        trends,
        kpis: {
          firstCallResolution: Math.round(Math.random() * 20 + 70), // Simulated KPI
          slaCompliance: Math.round(Math.random() * 15 + 80), // Simulated KPI
          customerRetention: Math.round(Math.random() * 10 + 85), // Simulated KPI
          operationalEfficiency: Math.round(Math.random() * 20 + 75) // Simulated KPI
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate executive summary' });
  }
}

async function getExecutiveSummaryData(whereClause: any, startDate: Date, endDate: Date) {
  // Reuse the executive summary generation logic
  const [
    tickets,
    feedbacks,
    zones,
    agents,
    customers,
    assets
  ] = await Promise.all([
    prisma.ticket.findMany({
      where: whereClause,
      include: { customer: true, assignedTo: true, zone: true, asset: true }
    }),
    prisma.ticketFeedback.findMany({
      where: { submittedAt: { gte: startDate, lte: endDate } },
      include: { ticket: { include: { customer: true } } }
    }),
    prisma.serviceZone.findMany({
      include: { tickets: { where: whereClause }, customers: true, servicePersons: true }
    }),
    prisma.user.findMany({
      where: { role: 'SERVICE_PERSON' },
      include: { assignedTickets: { where: whereClause } }
    }),
    prisma.customer.findMany({
      include: { tickets: { where: whereClause }, assets: true }
    }),
    prisma.asset.findMany({
      include: { tickets: { where: whereClause } }
    })
  ]);

  const resolvedTickets = tickets.filter((t: { status: string }) => ['RESOLVED', 'CLOSED'].includes(t.status));
  const openTickets = tickets.filter((t: { status: string }) => ['OPEN', 'IN_PROGRESS', 'ASSIGNED'].includes(t.status));
  const avgRating = feedbacks.length > 0 ? feedbacks.reduce((sum: number, fb: { rating: number }) => sum + fb.rating, 0) / feedbacks.length : 0;

  const avgResolutionTime = resolvedTickets.length > 0
    ? resolvedTickets.reduce((sum: number, ticket: { updatedAt: Date, createdAt: Date }) => sum + differenceInMinutes(ticket.updatedAt, ticket.createdAt), 0) / resolvedTickets.length
    : 0;

  // Generate trends data for the last 7 days
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
  const trends = await Promise.all(
    dateRange.slice(-7).map(async (date) => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const [created, resolved] = await Promise.all([
        prisma.ticket.count({
          where: { ...whereClause, createdAt: { gte: dayStart, lte: dayEnd } }
        }),
        prisma.ticket.count({
          where: {
            ...whereClause,
            status: { in: ['RESOLVED', 'CLOSED'] },
            updatedAt: { gte: dayStart, lte: dayEnd }
          }
        })
      ]);

      return {
        date: format(date, 'MMM dd'),
        ticketsCreated: created,
        ticketsResolved: resolved,
        avgRating: Math.random() * 2 + 3 // Simulated for demo
      };
    })
  );

  return {
    summary: {
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      openTickets: openTickets.length,
      resolutionRate: tickets.length > 0 ? (resolvedTickets.length / tickets.length) * 100 : 0,
      avgResolutionTimeHours: Math.round(avgResolutionTime / 60),
      customerSatisfaction: parseFloat(avgRating.toFixed(1)),
      totalCustomers: customers.length,
      activeAssets: assets.length
    },
    trends,
    kpis: {
      firstCallResolution: Math.round(Math.random() * 20 + 70),
      slaCompliance: Math.round(Math.random() * 15 + 80),
      customerRetention: Math.round(Math.random() * 10 + 85),
      operationalEfficiency: Math.round(Math.random() * 20 + 75)
    }
  };
}

// HER (Hours of Expected Resolution) Analysis Report
async function generateHerAnalysisReport(res: Response, whereClause: any, startDate: Date, endDate: Date) {
  try {
    // Get all tickets in the date range
    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: {
        customer: true,
        assignedTo: true,
        zone: true,
        asset: true
      }
    });

    // Business hours configuration
    const BUSINESS_START_HOUR = 9; // 9:00 AM
    const BUSINESS_END_HOUR = 17; // 5:30 PM (17:30)
    const BUSINESS_END_MINUTE = 30; // Minutes past 5 PM
    const WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Monday to Saturday (0 = Sunday)

    // SLA hours by priority (in business hours)
    const SLA_HOURS_BY_PRIORITY: Record<string, number> = {
      'CRITICAL': 4,   // 4 business hours
      'HIGH': 8,       // 8 business hours  
      'MEDIUM': 24,    // 24 business hours (3 business days)
      'LOW': 48        // 48 business hours (6 business days)
    };

    // Helper function to calculate business hours between two dates
    function calculateBusinessHours(startDate: Date, endDate: Date): number {
      let businessHours = 0;
      let currentDate = new Date(startDate);

      while (currentDate < endDate) {
        const dayOfWeek = currentDate.getDay();

        // Skip Sundays (0)
        if (WORKING_DAYS.includes(dayOfWeek)) {
          const dayStart = new Date(currentDate);
          dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);

          const dayEnd = new Date(currentDate);
          dayEnd.setHours(BUSINESS_END_HOUR, BUSINESS_END_MINUTE, 0, 0);

          // Calculate overlap with business hours for this day
          const periodStart = new Date(Math.max(currentDate.getTime(), dayStart.getTime()));
          const periodEnd = new Date(Math.min(endDate.getTime(), dayEnd.getTime()));

          if (periodStart < periodEnd) {
            const hoursThisDay = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60);
            businessHours += hoursThisDay;
          }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }

      return businessHours;
    }

    // Helper function to calculate HER deadline from ticket creation
    function calculateHerDeadline(createdAt: Date, priority: string): Date {
      const slaHours = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY['LOW'];
      let remainingHours = slaHours;
      let currentDate = new Date(createdAt);

      // If ticket created outside business hours, start from next business day
      const dayOfWeek = currentDate.getDay();
      const hour = currentDate.getHours();
      const minute = currentDate.getMinutes();

      if (!WORKING_DAYS.includes(dayOfWeek) ||
        hour < BUSINESS_START_HOUR ||
        (hour > BUSINESS_END_HOUR) ||
        (hour === BUSINESS_END_HOUR && minute > BUSINESS_END_MINUTE)) {
        // Move to next business day at 9 AM
        do {
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate.setHours(BUSINESS_START_HOUR, 0, 0, 0);
        } while (!WORKING_DAYS.includes(currentDate.getDay()));
      }

      // Add business hours to find deadline
      while (remainingHours > 0) {
        const dayOfWeek = currentDate.getDay();

        if (WORKING_DAYS.includes(dayOfWeek)) {
          const dayStart = new Date(currentDate);
          dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);

          const dayEnd = new Date(currentDate);
          dayEnd.setHours(BUSINESS_END_HOUR, BUSINESS_END_MINUTE, 0, 0);

          const availableHoursToday = Math.max(0, (dayEnd.getTime() - Math.max(currentDate.getTime(), dayStart.getTime())) / (1000 * 60 * 60));

          if (remainingHours <= availableHoursToday) {
            // Deadline is today
            currentDate.setTime(currentDate.getTime() + (remainingHours * 60 * 60 * 1000));
            break;
          } else {
            // Use all available hours today and continue tomorrow
            remainingHours -= availableHoursToday;
          }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      }

      return currentDate;
    }

    // Process each ticket for HER analysis
    const herTickets = tickets.map((ticket: any) => {
      const priority = ticket.priority || 'LOW';
      const herHours = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY['LOW'];
      const herDeadline = calculateHerDeadline(ticket.createdAt, priority);

      let actualResolutionHours: number | undefined;
      let businessHoursUsed = 0;
      let isHerBreached = false;

      if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        // Calculate actual resolution time in business hours
        businessHoursUsed = calculateBusinessHours(ticket.createdAt, ticket.updatedAt);
        actualResolutionHours = businessHoursUsed;
        isHerBreached = businessHoursUsed > herHours;
      } else {
        // For open tickets, calculate time used so far
        businessHoursUsed = calculateBusinessHours(ticket.createdAt, new Date());
        isHerBreached = new Date() > herDeadline;
      }

      return {
        id: ticket.id,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        resolvedAt: (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') ? ticket.updatedAt.toISOString() : undefined,
        slaDueAt: herDeadline.toISOString(),
        herHours,
        actualResolutionHours,
        isHerBreached,
        businessHoursUsed: Math.round(businessHoursUsed * 100) / 100,
        customer: ticket.customer?.companyName || 'Unknown',
        assignedTo: ticket.assignedTo?.name || 'Unassigned',
        zone: ticket.zone?.name || 'No Zone'
      };
    });

    // Calculate summary statistics
    const totalTickets = herTickets.length;
    const herCompliantTickets = herTickets.filter(t => !t.isHerBreached).length;
    const herBreachedTickets = herTickets.filter(t => t.isHerBreached).length;
    const complianceRate = totalTickets > 0 ? (herCompliantTickets / totalTickets) * 100 : 100;

    const averageHerHours = totalTickets > 0
      ? herTickets.reduce((sum, t) => sum + t.herHours, 0) / totalTickets
      : 0;

    const resolvedTickets = herTickets.filter(t => t.actualResolutionHours !== undefined);
    const averageActualHours = resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + (t.actualResolutionHours || 0), 0) / resolvedTickets.length
      : 0;

    // Calculate priority breakdown
    const priorityBreakdown: Record<string, any> = {};
    Object.keys(SLA_HOURS_BY_PRIORITY).forEach(priority => {
      const priorityTickets = herTickets.filter(t => t.priority === priority);
      const priorityCompliant = priorityTickets.filter(t => !t.isHerBreached);
      const priorityBreached = priorityTickets.filter(t => t.isHerBreached);

      priorityBreakdown[priority] = {
        total: priorityTickets.length,
        compliant: priorityCompliant.length,
        breached: priorityBreached.length,
        complianceRate: priorityTickets.length > 0 ? (priorityCompliant.length / priorityTickets.length) * 100 : 100
      };
    });

    res.json({
      success: true,
      data: {
        herAnalysis: {
          tickets: herTickets,
          summary: {
            totalTickets,
            herCompliantTickets,
            herBreachedTickets,
            complianceRate: Math.round(complianceRate * 100) / 100,
            averageHerHours: Math.round(averageHerHours * 100) / 100,
            averageActualHours: Math.round(averageActualHours * 100) / 100
          },
          priorityBreakdown
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate HER analysis' });
  }
}

export const generateZoneReport = async (req: Request, res: Response) => {
  try {
    const { from, to, reportType, customerId, assetId, productType, stage, zoneId, page, limit, myOffers, createdById } = req.query as unknown as ReportFilters & { myOffers?: string };
    const user = (req as any).user;

    // Parse pagination params with defaults
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 500;

    // Get user's zones - different logic for ZONE_USER/ZONE_MANAGER vs SERVICE_PERSON
    let userZoneIds: number[] = [];

    if (user.role === 'ZONE_USER' || user.role === 'ZONE_MANAGER') {
      // For ZONE_USER and ZONE_MANAGER, prefer explicit user.zoneId; fallback to user's customer's serviceZoneId
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { zoneId: true, customerId: true }
      });

      if (userRecord?.zoneId) {
        userZoneIds = [parseInt(userRecord.zoneId)];
      } else if (userRecord?.customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: userRecord.customerId },
          select: { serviceZoneId: true }
        });
        if (customer?.serviceZoneId) {
          userZoneIds = [customer.serviceZoneId];
        }
      }

      // Fallback: if still empty, check ServicePersonZone mapping for this user
      if (userZoneIds.length === 0) {
        const userZones = await prisma.servicePersonZone.findMany({
          where: { userId: user.id },
          select: { serviceZoneId: true }
        });
        userZoneIds = userZones.map((uz: { serviceZoneId: number }) => uz.serviceZoneId);
      }
    } else {
      // For SERVICE_PERSON, get zones from servicePersonZone table
      const userZones = await prisma.servicePersonZone.findMany({
        where: { userId: user.id },
        select: { serviceZoneId: true }
      });
      userZoneIds = userZones.map((uz: { serviceZoneId: number }) => uz.serviceZoneId);
    }

    if (userZoneIds.length === 0) {
      return res.status(403).json({ error: 'User has no assigned zones' });
    }

    const startDate = from ? new Date(from) : subDays(new Date(), 30);
    const endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Base where clause
    const isOfferReportRef = ['offer-summary', 'zone-user-offer-summary', 'target-report', 'product-type-analysis', 'customer-performance'].includes(reportType);

    const whereClause: any = isOfferReportRef
      ? {
        offerMonth: {
          gte: format(startDate, 'yyyy-MM'),
          lte: format(endDate, 'yyyy-MM'),
        }
      }
      : {
        createdAt: {
          gte: startDate,
          lte: endDate,
        }
      };

    // If a specific zoneId is requested, validate access
    if (zoneId) {
      const requestedZoneId = parseInt(zoneId);
      const isAdmin = user.role === 'ADMIN';
      const hasAccess = isAdmin || userZoneIds.includes(requestedZoneId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this zone' });
      }
      whereClause.zoneId = requestedZoneId;
    } else {
      // Otherwise, restrict by user's zones
      whereClause.zoneId = { in: userZoneIds };
    }

    // Add productType filter for offer reports
    if (productType) {
      whereClause.productType = productType;
    }
    // Add stage filter for offer reports
    if (stage) {
      whereClause.stage = stage;
    }

    // Add createdById filter for offer reports
    if (createdById) {
      whereClause.createdById = parseInt(createdById as string);
    }

    // If myOffers is true, filter offers by current user (created by or assigned to)
    // This is used for the Zone User Offer Summary report
    if (myOffers === 'true' && (reportType === 'offer-summary')) {
      whereClause.OR = [
        { createdById: user.id },
        { assignedToId: user.id }
      ];
    }

    switch (reportType) {
      case 'ticket-summary':
        return await generateTicketSummaryReport(res, whereClause, startDate, endDate);
      case 'sla-performance':
        return await generateSlaPerformanceReport(res, whereClause, startDate, endDate);

      case 'industrial-data':
        return await generateIndustrialDataReport(res, whereClause, startDate, endDate, { customerId, assetId });
      case 'zone-performance':
        return await generateZonePerformanceReport(res, whereClause, startDate, endDate);
      case 'agent-productivity':
        return await generateAgentProductivityReport(res, whereClause, startDate, endDate);
      case 'executive-summary':
        return await generateExecutiveSummaryReport(res, whereClause, startDate, endDate);
      case 'her-analysis':
        return await generateHerAnalysisReport(res, whereClause, startDate, endDate);
      // Offer Funnel Reports
      case 'offer-summary':
      case 'zone-user-offer-summary':
        return await generateOfferSummaryReport(res, whereClause, startDate, endDate, pageNum, limitNum);
      case 'target-report':
        return await generateTargetReport(res, whereClause, startDate, endDate);
      case 'product-type-analysis':
        return await generateProductTypeAnalysisReport(res, whereClause, startDate, endDate);
      case 'customer-performance':
        return await generateCustomerPerformanceReport(res, whereClause, startDate, endDate);
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate zone report' });
  }
}

export const exportZoneReport = async (req: Request, res: Response) => {
  try {
    const { from, to, reportType, format: exportFormat = 'pdf', zoneId, ...otherFilters } = req.query as unknown as ReportFilters & { format: string };
    const user = (req as any).user;

    // Validate required parameters
    if (!reportType) {
      return res.status(400).json({ error: 'Report type is required' });
    }

    // Validate report type
    const validReportTypes = ['ticket-summary', 'sla-performance', 'executive-summary', 'industrial-data', 'agent-productivity', 'zone-performance', 'her-analysis'];
    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({ error: 'Invalid report type or report type does not support export' });
    }

    // Get user's zones - different logic for ZONE_USER/ZONE_MANAGER vs SERVICE_PERSON
    let userZoneIds: number[] = [];

    if (user.role === 'ZONE_USER' || user.role === 'ZONE_MANAGER') {
      // For ZONE_USER and ZONE_MANAGER, prefer explicit user.zoneId; fallback to user's customer's serviceZoneId
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { zoneId: true, customerId: true }
      });

      if (userRecord?.zoneId) {
        userZoneIds = [parseInt(userRecord.zoneId)];
      } else if (userRecord?.customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: userRecord.customerId },
          select: { serviceZoneId: true }
        });
        if (customer?.serviceZoneId) {
          userZoneIds = [customer.serviceZoneId];
        }
      }

      // Fallback: if still empty, check ServicePersonZone mapping for this user
      if (userZoneIds.length === 0) {
        const userZones = await prisma.servicePersonZone.findMany({
          where: { userId: user.id },
          select: { serviceZoneId: true }
        });
        userZoneIds = userZones.map((uz: { serviceZoneId: number }) => uz.serviceZoneId);
      }
    } else {
      // For SERVICE_PERSON, get zones from servicePersonZone table
      const userZones = await prisma.servicePersonZone.findMany({
        where: { userId: user.id },
        select: { serviceZoneId: true }
      });
      userZoneIds = userZones.map((uz: { serviceZoneId: number }) => uz.serviceZoneId);
    }

    if (userZoneIds.length === 0) {
      return res.status(403).json({ error: 'User has no assigned zones' });
    }

    const startDate = from ? new Date(from) : subDays(new Date(), 30);
    const endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Base where clause
    const isOfferReportValue = ['offer-summary', 'zone-user-offer-summary', 'target-report', 'product-type-analysis', 'customer-performance'].includes(reportType);

    const whereClause: any = isOfferReportValue
      ? {
        offerMonth: {
          gte: format(startDate, 'yyyy-MM'),
          lte: format(endDate, 'yyyy-MM'),
        }
      }
      : {
        createdAt: {
          gte: startDate,
          lte: endDate,
        }
      };

    // If a specific zoneId is requested, validate access
    if (zoneId) {
      const requestedZoneId = parseInt(zoneId as string);
      const isAdmin = user.role === 'ADMIN';
      const hasAccess = isAdmin || userZoneIds.includes(requestedZoneId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this zone' });
      }
      whereClause.zoneId = requestedZoneId;
    } else {
      // Otherwise, restrict by user's zones
      whereClause.zoneId = { in: userZoneIds };
    }

    let data: any[] = [];
    let columns: ColumnDefinition[] = [];
    let summaryData: any = null;

    // Custom title mapping for better report names
    const titleMap: { [key: string]: string } = {
      'industrial-data': 'Machine Report',
      'ticket-summary': 'Ticket Summary Report',

      'zone-performance': 'Zone Performance Report',
      'agent-productivity': 'Performance Report of All Service Persons and Zone Users',
      'sla-performance': 'SLA Performance Report',
      'executive-summary': 'Executive Summary Report',
      'her-analysis': 'Business Hours SLA Report'
    };

    const reportTitle = titleMap[reportType] || reportType.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    const filename = `Zone-${reportTitle.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
    const filters = {
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      zones: zoneId ? String(zoneId) : userZoneIds.join(','),
      ...Object.fromEntries(
        Object.entries(otherFilters).filter(([_, v]) => v !== undefined && v !== '')
      )
    };

    // Get data based on report type
    switch (reportType) {
      case 'ticket-summary':
        const ticketData = await getTicketSummaryData(whereClause, startDate, endDate);
        data = ticketData.tickets || [];
        summaryData = ticketData.summary;
        columns = getPdfColumns('ticket-summary');
        break;

      case 'sla-performance':
        const slaData = await getSlaPerformanceData(whereClause, startDate, endDate);
        data = slaData.breachedTickets || [];
        summaryData = slaData.summary;
        columns = getPdfColumns('sla-performance');
        break;

      case 'executive-summary':
        const executiveData = await getExecutiveSummaryData(whereClause, startDate, endDate);
        data = executiveData.trends || [];
        summaryData = executiveData.summary;
        columns = getPdfColumns('executive-summary');
        break;



      case 'industrial-data':
        const industrialData = await getIndustrialDataData(whereClause, startDate, endDate, otherFilters);
        data = industrialData.machineDowntime || [];
        summaryData = industrialData.summary;
        columns = getPdfColumns('industrial-data');
        break;

      case 'agent-productivity':
        const agentData = await getAgentProductivityData(whereClause, startDate, endDate);
        data = agentData.agents || [];
        summaryData = agentData.summary;
        columns = getPdfColumns('agent-productivity');
        break;

      case 'zone-performance':
        const zoneData = await getZonePerformanceData(whereClause, startDate, endDate);
        data = zoneData.zones || [];
        summaryData = zoneData.summary;
        columns = getPdfColumns('zone-performance');
        break;

      case 'her-analysis':
        // HER Analysis uses the same data structure as the generateHerAnalysisReport
        const herTickets = await prisma.ticket.findMany({
          where: whereClause,
          include: {
            customer: true,
            assignedTo: true,
            zone: true,
            asset: true
          }
        });

        // HER calculation helper functions
        const BUSINESS_START_HOUR = 9;
        const BUSINESS_END_HOUR = 17;
        const BUSINESS_END_MINUTE = 30;
        const WORKING_DAYS = [1, 2, 3, 4, 5, 6];
        const SLA_HOURS_BY_PRIORITY: Record<string, number> = {
          'CRITICAL': 4, 'HIGH': 8, 'MEDIUM': 24, 'LOW': 48
        };

        const calculateBusinessHours = (startDate: Date, endDate: Date): number => {
          let businessHours = 0;
          let currentDate = new Date(startDate);
          while (currentDate < endDate) {
            const dayOfWeek = currentDate.getDay();
            if (WORKING_DAYS.includes(dayOfWeek)) {
              const dayStart = new Date(currentDate);
              dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
              const dayEnd = new Date(currentDate);
              dayEnd.setHours(BUSINESS_END_HOUR, BUSINESS_END_MINUTE, 0, 0);
              const periodStart = new Date(Math.max(currentDate.getTime(), dayStart.getTime()));
              const periodEnd = new Date(Math.min(endDate.getTime(), dayEnd.getTime()));
              if (periodStart < periodEnd) {
                businessHours += (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60);
              }
            }
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
          }
          return businessHours;
        };

        data = herTickets.map((ticket: any) => {
          const priority = ticket.priority || 'LOW';
          const herHours = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY['LOW'];
          let businessHoursUsed = 0;
          let isHerBreached = false;
          let resolvedAt = null;

          if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
            businessHoursUsed = calculateBusinessHours(ticket.createdAt, ticket.updatedAt);
            isHerBreached = businessHoursUsed > herHours;
            resolvedAt = ticket.updatedAt;
          } else {
            businessHoursUsed = calculateBusinessHours(ticket.createdAt, new Date());
          }

          return {
            id: ticket.id,
            title: ticket.title,
            customer: ticket.customer?.companyName || 'Unknown',
            serialNo: ticket.asset?.serialNo || 'N/A',
            address: ticket.customer?.address || 'N/A',
            status: ticket.status,
            priority: ticket.priority,
            assignedTo: ticket.assignedTo?.name || 'Unassigned',
            createdAt: ticket.createdAt,
            zone: ticket.zone?.name || 'No Zone',
            herHours,
            businessHoursUsed: Math.round(businessHoursUsed * 100) / 100,
            isHerBreached: isHerBreached ? 'Yes' : 'No',
            resolvedAt: resolvedAt
          };
        });

        const herCompliantTickets = data.filter((t: any) => t.isHerBreached === 'No').length;
        const herBreachedTickets = data.filter((t: any) => t.isHerBreached === 'Yes').length;
        const complianceRate = data.length > 0 ? (herCompliantTickets / data.length) * 100 : 100;

        summaryData = {
          'Total Tickets': data.length,
          'HER Compliant': herCompliantTickets,
          'HER Breached': herBreachedTickets,
          'Compliance Rate': `${Math.round(complianceRate * 100) / 100}%`
        };

        columns = [
          { key: 'id', header: 'Ticket ID', width: 12 },
          { key: 'title', header: 'Title', width: 30 },
          { key: 'customer', header: 'Customer', width: 25 },
          { key: 'serialNo', header: 'Serial No', width: 18 },
          { key: 'address', header: 'Address', width: 30 },
          { key: 'status', header: 'Status', width: 15 },
          { key: 'priority', header: 'Priority', width: 12 },
          { key: 'assignedTo', header: 'Assigned To', width: 20 },
          { key: 'createdAt', header: 'Created', width: 20, format: (date: string) => new Date(date).toLocaleString() },
          { key: 'zone', header: 'Zone', width: 20 },
          { key: 'herHours', header: 'SLA Hours', width: 15 },
          { key: 'businessHoursUsed', header: 'Hours Used', width: 15 },
          { key: 'isHerBreached', header: 'Breached', width: 15 },
          { key: 'resolvedAt', header: 'Resolved', width: 20, format: (date: string) => date ? new Date(date).toLocaleString() : 'N/A' }
        ];
        break;

      case 'offer-summary':
      case 'zone-user-offer-summary':
        // Fetch offers with all related data
        const offers = await prisma.offer.findMany({
          where: whereClause,
          include: {
            customer: true,
            contact: true,
            zone: true,
            assignedTo: true,
            createdBy: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        data = offers;
        summaryData = {
          totalOffers: offers.length,
          totalOfferValue: offers.reduce((sum: number, o: any) => sum + (parseFloat(String(o.offerValue || 0)) || 0), 0),
          totalPoValue: offers.reduce((sum: number, o: any) => sum + (parseFloat(String(o.poValue || 0)) || 0), 0),
          wonOffers: offers.filter((o: any) => o.stage === 'WON').length,
          lostOffers: offers.filter((o: any) => o.stage === 'LOST').length,
        };
        columns = getPdfColumns('offer-summary');
        break;

      default:
        return res.status(400).json({ error: 'Invalid report type for export.' });
    }

    if (exportFormat.toLowerCase() === 'pdf') {
      await generatePdf(res, data, columns, `Zone ${reportTitle}`, filters, summaryData);
    } else if (exportFormat.toLowerCase() === 'excel' || exportFormat.toLowerCase() === 'xlsx') {
      // Generate Excel with enhanced formatting and summary data
      const excelColumns = getExcelColumns(reportType);
      await generateExcel(res, data, excelColumns, `Zone ${reportTitle}`, filters, summaryData);
    } else {
      // Default to PDF export
      const pdfColumns = getPdfColumns(reportType);
      await generatePdf(res, data, pdfColumns, `Zone ${reportTitle}`, filters, summaryData);
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export zone report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Offer Funnel Report Functions
 */
/**
 * Generate Offer Summary Report
 */
const generateOfferSummaryReport = async (res: Response, whereClause: any, startDate: Date, endDate: Date, page: number = 1, limit: number = 500) => {
  try {
    // Cap limit to prevent memory issues
    const safeLimit = Math.min(limit, 1000);

    // Calculate skip for pagination
    const skip = (page - 1) * safeLimit;

    // Get total count for pagination info
    const totalCount = await prisma.offer.count({ where: { ...whereClause } });

    // Fetch offers with important fields and pagination
    const findManyWhere = { ...whereClause };
    const offers = await prisma.offer.findMany({
      where: findManyWhere,
      select: {
        id: true,
        offerReferenceNumber: true,
        offerReferenceDate: true,
        title: true,
        productType: true,
        company: true,
        location: true,
        contactPersonName: true,
        contactNumber: true,
        status: true,
        stage: true,
        offerValue: true,
        poNumber: true,
        poValue: true,
        customer: {
          select: {
            id: true,
            companyName: true,
          },
        },
        contact: {
          select: {
            id: true,
            contactPersonName: true,
            contactNumber: true,
            email: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            shortForm: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: safeLimit,
    });

    const aggStartTime = Date.now();
    const aggWhere = { ...whereClause };

    const [summary, wonOffersCount, wonOffersValueRes, lostOffersCount, statusDistribution, stageDistribution, productTypeDistribution] = await Promise.all([
      // Calculate summary statistics for all matching offers
      prisma.offer.aggregate({
        where: aggWhere,
        _sum: {
          offerValue: true,
          poValue: true,
        },
      }),

      // Total won offers count (independent of pagination)
      prisma.offer.count({
        where: { ...aggWhere, stage: 'WON' }
      }),

      // Won offers value statistics
      prisma.offer.aggregate({
        where: { ...aggWhere, stage: 'WON' },
        _sum: {
          offerValue: true,
          poValue: true,
        },
      }),

      // Total lost offers count (independent of pagination)
      prisma.offer.count({
        where: { ...aggWhere, stage: 'LOST' }
      }),

      // Status distribution
      prisma.offer.groupBy({
        where: aggWhere,
        by: ['status'],
        _count: { id: true },
      }),

      // Stage distribution
      prisma.offer.groupBy({
        where: aggWhere,
        by: ['stage'],
        _count: { id: true },
      }),

      // Product type distribution
      prisma.offer.groupBy({
        where: aggWhere,
        by: ['productType'],
        _count: { id: true },
        _sum: {
          offerValue: true,
        },
      })
    ]);

    // Calculate Targets (Growth Pillar logic)
    let totalTarget = 0;
    const zoneId = whereClause.zoneId;
    const userId = whereClause.createdById;
    const productType = whereClause.productType;

    // Identify months within the startDate and endDate range
    // Reverse the server timezone offset applied earlier to get accurate local months
    // since endDate was set to 23:59:59 local, the UTC shift might have pushed it into the next month
    const localStart = new Date(startDate.getTime() + startDate.getTimezoneOffset() * 60000);
    const localEnd = new Date(endDate.getTime() + endDate.getTimezoneOffset() * 60000);

    const months: string[] = [];
    let current = new Date(localStart.getFullYear(), localStart.getMonth(), 1);
    const end = new Date(localEnd.getFullYear(), localEnd.getMonth(), 1);
    
    while (current <= end) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }

    if (zoneId) {
      const targetYear = startDate.getFullYear();
      // Fetch zone targets
      const [monthlyTargets, yearlyTargets] = await Promise.all([
        prisma.zoneTarget.findMany({
          where: {
            serviceZoneId: zoneId,
            targetPeriod: { in: months },
            periodType: 'MONTHLY',
            productType: productType || null
          }
        }),
        prisma.zoneTarget.findMany({
          where: {
            serviceZoneId: zoneId,
            targetPeriod: String(targetYear),
            periodType: 'YEARLY',
            productType: productType || null
          }
        })
      ]);

      const monthlyTargetMap = new Map(monthlyTargets.map(t => [t.targetPeriod, Number(t.targetValue)]));
      const yearlyValue = yearlyTargets.length > 0 ? Number(yearlyTargets[0].targetValue) : 0;
      const avgMonthly = yearlyValue / 12;

      months.forEach(m => {
        totalTarget += monthlyTargetMap.has(m) ? monthlyTargetMap.get(m)! : avgMonthly;
      });
    } else if (userId) {
       const targetYear = startDate.getFullYear();
       // Fetch user targets
       const [monthlyTargets, yearlyTargets] = await Promise.all([
        prisma.userTarget.findMany({
          where: {
            userId: userId,
            targetPeriod: { in: months },
            periodType: 'MONTHLY',
            productType: productType || null
          }
        }),
        prisma.userTarget.findMany({
          where: {
            userId: userId,
            targetPeriod: String(targetYear),
            periodType: 'YEARLY',
            productType: productType || null
          }
        })
      ]);

      const monthlyTargetMap = new Map(monthlyTargets.map(t => [t.targetPeriod, Number(t.targetValue)]));
      const yearlyValue = yearlyTargets.length > 0 ? Number(yearlyTargets[0].targetValue) : 0;
      const avgMonthly = yearlyValue / 12;

      months.forEach(m => {
        totalTarget += monthlyTargetMap.has(m) ? monthlyTargetMap.get(m)! : avgMonthly;
      });
    } else {
      // Calculate total targets for ALL active zones
      const targetYear = startDate.getFullYear();
      
      const [monthlyTargets, yearlyTargets, zones] = await Promise.all([
        prisma.zoneTarget.findMany({
          where: {
            targetPeriod: { in: months },
            periodType: 'MONTHLY',
            productType: productType || null
          }
        }),
        prisma.zoneTarget.findMany({
          where: {
            targetPeriod: String(targetYear),
            periodType: 'YEARLY',
            productType: productType || null
          }
        }),
        prisma.serviceZone.findMany({
          where: { isActive: true }
        })
      ]);

      for (const zone of zones) {
        const zoneMonthlyTargets = monthlyTargets.filter(t => t.serviceZoneId === zone.id);
        const zoneYearlyTargets = yearlyTargets.filter(t => t.serviceZoneId === zone.id);
        
        const monthlyTargetMap = new Map(zoneMonthlyTargets.map(t => [t.targetPeriod, Number(t.targetValue)]));
        const yearlyValue = zoneYearlyTargets.length > 0 ? Number(zoneYearlyTargets[0].targetValue) : 0;
        const avgMonthly = yearlyValue / 12;

        months.forEach(m => {
          totalTarget += monthlyTargetMap.has(m) ? monthlyTargetMap.get(m)! : avgMonthly;
        });
      }
    }

    const totalOfferValue = Math.round(Number(summary._sum.offerValue || 0));
    // wonValue is poValue if available, else offerValue (consistent with growth pillar)
    const wonValue = Math.round(Number(wonOffersValueRes._sum.poValue || wonOffersValueRes._sum.offerValue || 0));

    const statusDist: Record<string, number> = {};
    statusDistribution.forEach((item) => {
      statusDist[item.status] = item._count.id;
    });

    const stageDist: Record<string, number> = {};
    stageDistribution.forEach((item) => {
      stageDist[item.stage] = item._count.id;
    });

    const productTypeDist: Record<string, { count: number; totalValue: number }> = {};
    productTypeDistribution.forEach((item) => {
      productTypeDist[item.productType || 'UNKNOWN'] = {
        count: item._count.id,
        totalValue: Number(item._sum.offerValue || 0),
      };
    });

    res.json({
      success: true,
      data: {
        offers,
        pagination: {
          total: totalCount,
          page: page,
          limit: safeLimit,
          pages: Math.ceil(totalCount / safeLimit),
        },
        summary: {
          totalCount: totalCount,
          totalOffers: totalCount,
          totalTarget: Math.round(totalTarget),
          totalOfferValue: totalOfferValue,
          totalPoValue: Math.round(Number(summary._sum.poValue || 0)),
          wonOffers: wonOffersCount,
          wonOfferValue: Math.round(Number(wonOffersValueRes._sum.offerValue || 0)),
          wonPoValue: Math.round(Number(wonOffersValueRes._sum.poValue || 0)),
          wonValue: wonValue, // Renamed/New field for consistency
          lostOffers: lostOffersCount,
          successRate: totalCount > 0 ? (wonOffersCount / totalCount) * 100 : 0,
          conversionRate: totalOfferValue > 0 ? (wonValue / totalOfferValue) * 100 : 0,
          achievementPercent: totalTarget > 0 ? (wonValue / totalTarget) * 100 : 0,
          hitRatePercent: totalOfferValue > 0 ? (wonValue / totalOfferValue) * 100 : 0,
        },
        statusDistribution: statusDist,
        stageDistribution: stageDist,
        productTypeDistribution: productTypeDist,
      },
    });
  } catch (error: any) {
    logger.error('Generate offer summary report error:', {
      message: error.message,
      stack: error.stack,
      whereClause
    });
    res.status(500).json({
      error: 'Failed to generate offer summary report',
      details: error.message
    });
  }
};

/**
 * Generate Target Report (placeholder - redirects to offer summary for now)
 */
const generateTargetReport = async (res: Response, whereClause: any, startDate: Date, endDate: Date) => {
  // For now, return a simple target report structure
  // In a full implementation, this would fetch from zoneTarget and userTarget tables
  res.json({
    success: true,
    data: {
      zoneTargets: [],
      userTargets: [],
      summary: {
        totalTargets: 0,
        totalTargetValue: 0,
        totalActualValue: 0,
        overallAchievement: 0,
      },
    },
  });
};

/**
 * Generate Product Type Analysis Report
 */
const generateProductTypeAnalysisReport = async (res: Response, whereClause: any, startDate: Date, endDate: Date) => {
  try {
    // Get metrics in parallel
    const [productTypeMetrics, wonByProductType, lostByProductType] = await Promise.all([
      // Get all product types with metrics
      prisma.offer.groupBy({
        where: whereClause,
        by: ['productType'],
        _count: { id: true },
        _sum: {
          offerValue: true,
          poValue: true,
        },
      }),

      // Get won offers by product type
      prisma.offer.groupBy({
        where: { ...whereClause, stage: 'WON' },
        by: ['productType'],
        _count: { id: true },
        _sum: {
          offerValue: true,
          poValue: true,
        },
      }),

      // Get lost offers by product type (stage = 'LOST')
      prisma.offer.groupBy({
        where: { ...whereClause, stage: 'LOST' },
        by: ['productType'],
        _count: { id: true },
      })
    ]);


    // Define all product types
    const allProductTypes = ['RELOCATION', 'CONTRACT', 'SPARE_PARTS', 'KARDEX_CONNECT', 'UPGRADE_KIT', 'SOFTWARE', 'OTHERS', 'BD_SPARE', 'RETROFIT_KIT'];

    // Create maps for easy lookup
    const metricsMap = new Map(productTypeMetrics.map(m => [m.productType || 'UNKNOWN', m]));
    const wonMap = new Map(wonByProductType.map(m => [m.productType || 'UNKNOWN', m]));
    const lostMap = new Map(lostByProductType.map(m => [m.productType || 'UNKNOWN', m]));

    // Build comprehensive analysis for ALL product types (including those with 0 offers)
    const analysis = allProductTypes.map((productType) => {
      const metric = metricsMap.get(productType);
      const wonMetric = wonMap.get(productType);
      const lostMetric = lostMap.get(productType);

      const totalOffers = metric?._count.id || 0;
      const totalValue = Number(metric?._sum.offerValue || 0);
      const totalPoValue = Number(metric?._sum.poValue || 0);
      const wonOffers = wonMetric?._count.id || 0;
      const wonValue = Number(wonMetric?._sum.offerValue || 0);
      const wonPoValue = Number(wonMetric?._sum.poValue || 0);
      const lostOffers = lostMetric?._count.id || 0;

      const winRate = totalOffers > 0 ? (wonOffers / totalOffers) * 100 : 0;
      const avgDealSize = totalOffers > 0 ? totalValue / totalOffers : 0;

      return {
        productType,
        totalOffers,
        wonOffers,
        lostOffers,
        totalValue,
        wonValue,
        totalPoValue,
        wonPoValue,
        winRate: Math.round(winRate * 100) / 100,
        avgDealSize: Math.round(avgDealSize * 100) / 100,
        conversionRate: wonOffers > 0 ? Math.round((wonOffers / totalOffers) * 100 * 100) / 100 : 0,
      };
    });

    // Sort by total value descending, then by product type name
    analysis.sort((a, b) => {
      if (b.totalValue !== a.totalValue) {
        return b.totalValue - a.totalValue;
      }
      return a.productType.localeCompare(b.productType);
    });

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    logger.error('Generate product type analysis report error:', {
      message: error.message,
      stack: error.stack,
      whereClause
    });
    res.status(500).json({
      error: 'Failed to generate product type analysis report',
      details: error.message
    });
  }
};

/**
 * Generate Customer Performance Report
 */
const generateCustomerPerformanceReport = async (res: Response, whereClause: any, startDate: Date, endDate: Date) => {
  try {
    // Get metrics in parallel
    const [customerMetrics, wonByCustomer] = await Promise.all([
      // Get customer performance metrics
      prisma.offer.groupBy({
        where: whereClause,
        by: ['customerId'],
        _count: { id: true },
        _sum: {
          offerValue: true,
          poValue: true,
        },
      }),

      // Get won offers by customer
      prisma.offer.groupBy({
        where: { ...whereClause, stage: 'WON' },
        by: ['customerId'],
        _count: { id: true },
        _sum: {
          offerValue: true,
          poValue: true,
        },
      })
    ]);

    // Check if we have any results
    if (customerMetrics.length === 0) {
      return res.json({ success: true, data: [] });
    }


    // Get customer details
    const customerIds = customerMetrics.map(m => m.customerId).filter(Boolean);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds as number[] } },
      select: {
        id: true,
        companyName: true,
        address: true,
        industry: true,
        serviceZone: { select: { id: true, name: true } },
      },
    });

    // Create maps for easy lookup
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const metricsMap = new Map(customerMetrics.map(m => [m.customerId, m]));
    const wonMap = new Map(wonByCustomer.map(m => [m.customerId, m]));

    // Build performance analysis
    const analysis = customerMetrics.map((metric) => {
      const customer = customerMap.get(metric.customerId);
      const wonMetric = wonMap.get(metric.customerId);

      const totalOffers = metric._count.id;
      const totalValue = Number(metric._sum.offerValue || 0);
      const totalPoValue = Number(metric._sum.poValue || 0);
      const wonOffers = wonMetric?._count.id || 0;
      const wonValue = Number(wonMetric?._sum.offerValue || 0);
      const wonPoValue = Number(wonMetric?._sum.poValue || 0);

      const winRate = totalOffers > 0 ? (wonOffers / totalOffers) * 100 : 0;
      const avgDealSize = totalOffers > 0 ? totalValue / totalOffers : 0;

      return {
        customerId: metric.customerId,
        customerName: customer?.companyName || 'Unknown Customer',
        location: customer?.address || null,
        industry: customer?.industry || null,
        zoneName: customer?.serviceZone?.name || null,
        totalOffers,
        wonOffers,
        lostOffers: totalOffers - wonOffers,
        totalValue,
        wonValue,
        totalPoValue,
        wonPoValue,
        winRate: Math.round(winRate * 100) / 100,
        avgDealSize: Math.round(avgDealSize * 100) / 100,
        conversionRate: wonOffers > 0 ? Math.round((wonOffers / totalOffers) * 100 * 100) / 100 : 0,
      };
    });

    // Sort by total value descending
    analysis.sort((a, b) => b.totalValue - a.totalValue);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    logger.error('Generate customer performance report error:', {
      message: error.message,
      stack: error.stack,
      whereClause
    });
    res.status(500).json({
      error: 'Failed to generate customer performance report',
      details: error.message
    });
  }
};

/**
 * Product Type Analysis Report - Shows performance metrics by product type
 */
export const getProductTypeAnalysis = async (req: Request, res: Response) => {
  try {
    const { from, to, zoneId } = req.query;

    // Build where clause
    const where: any = {};

    // Date range filter based on offerMonth
    if (from || to) {
      const startDate = from ? new Date(from as string) : subDays(new Date(), 30);
      const endDate = to ? new Date(to as string) : new Date();
      
      where.offerMonth = {
        gte: format(startDate, 'yyyy-MM'),
        lte: format(endDate, 'yyyy-MM'),
      };
    }

    // Zone filter
    if (zoneId) {
      where.zoneId = parseInt(zoneId as string);
    }

    // Get all product types with metrics
    const productTypeMetrics = await prisma.offer.groupBy({
      where,
      by: ['productType'],
      _count: { id: true },
      _sum: {
        offerValue: true,
        poValue: true,
      },
    });

    // Get won offers by product type
    const wonByProductType = await prisma.offer.groupBy({
      where: { ...where, stage: 'WON' },
      by: ['productType'],
      _count: { id: true },
      _sum: {
        offerValue: true,
        poValue: true,
      },
    });

    // Get lost offers by product type
    const lostByProductType = await prisma.offer.groupBy({
      where: { ...where, stage: 'LOST' },
      by: ['productType'],
      _count: { id: true },
    });

    // Define all product types
    const allProductTypes = ['RELOCATION', 'CONTRACT', 'SPARE_PARTS', 'KARDEX_CONNECT', 'UPGRADE_KIT', 'SOFTWARE', 'OTHERS', 'BD_SPARE', 'RETROFIT_KIT'];

    // Create maps for easy lookup
    const metricsMap = new Map(productTypeMetrics.map(m => [m.productType || 'UNKNOWN', m]));
    const wonMap = new Map(wonByProductType.map(m => [m.productType || 'UNKNOWN', m]));
    const lostMap = new Map(lostByProductType.map(m => [m.productType || 'UNKNOWN', m]));

    // Build comprehensive analysis for ALL product types
    const analysis = allProductTypes.map((productType) => {
      const metric = metricsMap.get(productType);
      const wonMetric = wonMap.get(productType);
      const lostMetric = lostMap.get(productType);

      const totalOffers = metric?._count.id || 0;
      const totalValue = Number(metric?._sum.offerValue || 0);
      const totalPoValue = Number(metric?._sum.poValue || 0);
      const wonOffers = wonMetric?._count.id || 0;
      const wonValue = Number(wonMetric?._sum.offerValue || 0);
      const wonPoValue = Number(wonMetric?._sum.poValue || 0);
      const lostOffers = lostMetric?._count.id || 0;

      const winRate = totalOffers > 0 ? (wonOffers / totalOffers) * 100 : 0;
      const avgDealSize = totalOffers > 0 ? totalValue / totalOffers : 0;

      return {
        productType,
        totalOffers,
        wonOffers,
        lostOffers,
        totalValue,
        wonValue,
        totalPoValue,
        wonPoValue,
        winRate: Math.round(winRate * 100) / 100,
        avgDealSize: Math.round(avgDealSize * 100) / 100,
        conversionRate: totalOffers > 0 ? Math.round((wonOffers / totalOffers) * 100 * 100) / 100 : 0,
      };
    });

    // Sort by total value descending
    analysis.sort((a, b) => b.totalValue - a.totalValue);

    // Calculate totals
    const totalOffers = analysis.reduce((sum, a) => sum + a.totalOffers, 0);
    const totalWonOffers = analysis.reduce((sum, a) => sum + a.wonOffers, 0);
    const totalLostOffers = analysis.reduce((sum, a) => sum + a.lostOffers, 0);
    const totalValue = analysis.reduce((sum, a) => sum + a.totalValue, 0);
    const totalWonValue = analysis.reduce((sum, a) => sum + a.wonValue, 0);
    const totalPoValue = analysis.reduce((sum, a) => sum + a.totalPoValue, 0);
    const totalWonPoValue = analysis.reduce((sum, a) => sum + a.wonPoValue, 0);

    const totals = {
      totalOffers,
      wonOffers: totalWonOffers,
      lostOffers: totalLostOffers,
      totalValue,
      wonValue: totalWonValue,
      totalPoValue,
      wonPoValue: totalWonPoValue,
      winRate: totalOffers > 0 ? Math.round((totalWonOffers / totalOffers) * 100 * 100) / 100 : 0,
      avgDealSize: totalOffers > 0 ? Math.round((totalValue / totalOffers) * 100) / 100 : 0,
      conversionRate: totalOffers > 0 ? Math.round((totalWonOffers / totalOffers) * 100 * 100) / 100 : 0,
    };

    res.json({
      success: true,
      data: {
        analysis,
        totals,
        dateRange: {
          from: from || null,
          to: to || null,
        },
      },
    });
  } catch (error) {

    res.status(500).json({
      success: false,
      error: 'Failed to generate product type analysis',
    });
  }
};

/**
 * Customer Performance Report - Shows performance metrics by customer
 */
export const getCustomerPerformance = async (req: Request, res: Response) => {
  try {
    const { from, to, zoneId, limit = '20' } = req.query;

    // Build where clause
    const where: any = {};

    // Date range filter based on offerMonth
    if (from || to) {
      const startDate = from ? new Date(from as string) : subDays(new Date(), 30);
      const endDate = to ? new Date(to as string) : new Date();
      
      where.offerMonth = {
        gte: format(startDate, 'yyyy-MM'),
        lte: format(endDate, 'yyyy-MM'),
      };
    }

    // Zone filter
    if (zoneId) {
      where.zoneId = parseInt(zoneId as string);
    }

    // Get all customer metrics
    const customerMetrics = await prisma.offer.groupBy({
      where,
      by: ['customerId'],
      _count: { id: true },
      _sum: {
        offerValue: true,
        poValue: true,
      },
    });

    // Get won offers by customer
    const wonByCustomer = await prisma.offer.groupBy({
      where: { ...where, stage: 'WON' },
      by: ['customerId'],
      _count: { id: true },
      _sum: {
        offerValue: true,
        poValue: true,
      },
    });

    // Get lost offers by customer
    const lostByCustomer = await prisma.offer.groupBy({
      where: { ...where, stage: 'LOST' },
      by: ['customerId'],
      _count: { id: true },
    });

    // Create maps for easy lookup
    const metricsMap = new Map(customerMetrics.map(m => [m.customerId, m]));
    const wonMap = new Map(wonByCustomer.map(m => [m.customerId, m]));
    const lostMap = new Map(lostByCustomer.map(m => [m.customerId, m]));

    // Get customer details with zone information
    const customerIds = customerMetrics.map(m => m.customerId);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      include: {
        serviceZone: { select: { id: true, name: true } },
      },
    });

    // Build comprehensive analysis
    const analysis = customers.map((customer) => {
      const metric = metricsMap.get(customer.id);
      const wonMetric = wonMap.get(customer.id);
      const lostMetric = lostMap.get(customer.id);

      const totalOffers = metric?._count.id || 0;
      const totalValue = Number(metric?._sum.offerValue || 0);
      const totalPoValue = Number(metric?._sum.poValue || 0);
      const wonOffers = wonMetric?._count.id || 0;
      const wonValue = Number(wonMetric?._sum.offerValue || 0);
      const wonPoValue = Number(wonMetric?._sum.poValue || 0);
      const lostOffers = lostMetric?._count.id || 0;

      const winRate = totalOffers > 0 ? (wonOffers / totalOffers) * 100 : 0;
      const avgDealSize = totalOffers > 0 ? totalValue / totalOffers : 0;

      return {
        customerId: customer.id,
        companyName: customer.companyName,
        location: customer.address,
        industry: customer.industry,
        zone: customer.serviceZone,
        totalOffers,
        wonOffers,
        lostOffers,
        totalValue,
        wonValue,
        totalPoValue,
        wonPoValue,
        winRate: Math.round(winRate * 100) / 100,
        avgDealSize: Math.round(avgDealSize * 100) / 100,
        conversionRate: totalOffers > 0 ? Math.round((wonOffers / totalOffers) * 100 * 100) / 100 : 0,
      };
    });

    // Sort by total value descending
    analysis.sort((a, b) => b.totalValue - a.totalValue);

    // Get top customers
    const limitNum = parseInt(limit as string) || 20;
    const topCustomers = analysis.slice(0, limitNum);

    // Calculate totals
    const totalCustomers = analysis.length;
    const totalOffers2 = analysis.reduce((sum, a) => sum + a.totalOffers, 0);
    const totalWonOffers2 = analysis.reduce((sum, a) => sum + a.wonOffers, 0);
    const totalLostOffers2 = analysis.reduce((sum, a) => sum + a.lostOffers, 0);
    const totalValue2 = analysis.reduce((sum, a) => sum + a.totalValue, 0);
    const totalWonValue2 = analysis.reduce((sum, a) => sum + a.wonValue, 0);
    const totalPoValue2 = analysis.reduce((sum, a) => sum + a.totalPoValue, 0);
    const totalWonPoValue2 = analysis.reduce((sum, a) => sum + a.wonPoValue, 0);

    const totals = {
      totalCustomers,
      totalOffers: totalOffers2,
      wonOffers: totalWonOffers2,
      lostOffers: totalLostOffers2,
      totalValue: totalValue2,
      wonValue: totalWonValue2,
      totalPoValue: totalPoValue2,
      wonPoValue: totalWonPoValue2,
      winRate: totalOffers2 > 0 ? Math.round((totalWonOffers2 / totalOffers2) * 100 * 100) / 100 : 0,
      avgDealSize: totalOffers2 > 0 ? Math.round((totalValue2 / totalOffers2) * 100) / 100 : 0,
      conversionRate: totalOffers2 > 0 ? Math.round((totalWonOffers2 / totalOffers2) * 100 * 100) / 100 : 0,
    };

    res.json({
      success: true,
      data: {
        topCustomers,
        allCustomers: analysis,
        totals,
        dateRange: {
          from: from || null,
          to: to || null,
        },
      },
    });
  } catch (error) {

    res.status(500).json({
      success: false,
      error: 'Failed to generate customer performance report',
    });
  }
};

export default {
  generateReport,
  exportReport,
  generateZoneReport,
  exportZoneReport,
  getZonePerformanceData,
  getAgentProductivityData,
  getIndustrialDataData,
  getExecutiveSummaryData,
  getProductTypeAnalysis,
  getCustomerPerformance
}
