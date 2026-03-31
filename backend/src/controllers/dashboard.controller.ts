import { Request, Response } from 'express';
import { Prisma, OnsiteVisitEvent } from '@prisma/client';
import { subDays, startOfDay, endOfDay, differenceInMinutes, format, getDay, setHours, setMinutes, setSeconds, setMilliseconds, addDays, isBefore, isAfter } from 'date-fns';
import { calculateBusinessHoursInMinutes, calculateTicketResolutionMinutes, calculateTravelMinutes, calculateOnsiteResolutionMinutes, BUSINESS_MINUTES_PER_DAY, formatMinutesToBusinessDH } from '../utils/dateUtils';

import prisma from '../config/db';

// Helper to safely parse imported Excel metadata from relatedMachineIds JSON field
function parseTicketMetadata(relatedMachineIds: string | null): Record<string, any> {
  if (!relatedMachineIds) return {};
  try {
    const parsed = JSON.parse(relatedMachineIds);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

interface DashboardStats {
  openTickets: { count: number; change: number };
  unassignedTickets: { count: number; critical: boolean };
  inProgressTickets: { count: number; change: number };
  avgResponseTime: { hours: number; minutes: number; change: number; isPositive: boolean };
  avgResolutionTime: { days: number; hours: number; minutes: number; change: number; isPositive: boolean };
  avgDowntime: { hours: number; minutes: number; change: number; isPositive: boolean };
  avgTravelTime: { hours: number; minutes: number; change: number; isPositive: boolean };
  avgOnsiteResolutionTime: { hours: number; minutes: number; change: number; isPositive: boolean };
  monthlyTickets: { count: number; change: number };
  activeMachines: { count: number; change: number };
  ticketDistribution: {
    byStatus: Array<{ name: string; value: number }>;
    byPriority: Array<{ name: string; value: number }>;
  };
  kpis: {
    totalTickets: { value: number; change: string; isPositive: boolean };
    slaCompliance: { value: number; change: number; isPositive: boolean };
    avgResponseTime: { value: string; unit: string; change: number; isPositive: boolean };
    avgResolutionTime: { value: string; unit: string; change: number; isPositive: boolean };
    unassignedTickets: { value: number; critical: boolean };
    activeCustomers: { value: number; change: number };
    activeServicePersons: { value: number; change: number };
  };
}

interface DashboardData {
  stats: DashboardStats;
  adminStats: {
    totalCustomers: number;
    totalServicePersons: number;
    totalServiceZones: number;
    totalZoneUsers: number;
    totalZoneManagers: number;
    ticketStatusDistribution: Record<string, number>;
    ticketTrends: Array<{ date: string; count: number; status: string }>;
    zoneWiseTickets: Array<{
      id: number;
      name: string;
      totalTickets: number;
      servicePersonCount: number;
      zoneManagerCount: number;
      zoneUserCount: number;
      customerCount: number;
      assetCount: number;
      avgResolutionTimeHours: number;
    }>;
  };
  recentTickets: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    customer: { id: number; companyName: string };
    asset?: { id: number; model: string };
  }>;
}



export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // Get date ranges (support "all"/"total" = all-time)
    const today = new Date();
    const rangeParam = (req.query.range as string) || 'all';
    const isAllRange = ['all', 'total'].includes(rangeParam.toLowerCase());
    const thirtyDaysAgo = subDays(today, 30);
    const sixtyDaysAgo = subDays(today, 60);

    // Current period
    const currentPeriodStart = isAllRange ? new Date(0) : thirtyDaysAgo;
    const currentPeriodEnd = today;

    // Previous period (not meaningful for all-time; use zeros later for change)
    const previousPeriodStart = isAllRange ? new Date(0) : sixtyDaysAgo;
    const previousPeriodEnd = isAllRange ? new Date(0) : thirtyDaysAgo;

    // Execute all queries in parallel for better performance
    const [
      // Current period counts
      openTicketsCurrent,
      unassignedTicketsCurrent,
      inProgressTicketsCurrent,
      monthlyTicketsCurrent,
      activeMachinesCurrent,

      // Previous period counts for comparison
      openTicketsPrevious,
      unassignedTicketsPrevious,
      inProgressTicketsPrevious,
      monthlyTicketsPrevious,
      activeMachinesPrevious,

      // Time-based metrics
      responseTimeData,
      resolutionTimeData,
      downtimeData,
      travelTimeData,
      onsiteResolutionTimeData,

      // Distribution data
      statusDistribution,
      priorityDistribution,

      // Admin stats
      totalCustomers,
      totalServicePersons,
      totalServiceZones,
      totalZoneUsers,
      totalZoneManagers,
      zoneWiseData,

      // Recent tickets
      recentTickets,

      // Additional metrics for KPIs
      totalTicketsCount,
      slaCompliantTickets,
      activeCustomersCount,
      activeServicePersonsCount
    ] = await Promise.all([
      // Current period counts
      prisma.ticket.count({
        where: {
          status: {
            in: [
              'OPEN',
              'ASSIGNED',
              'IN_PROGRESS',
              'IN_PROCESS', // Support legacy/alternate status
              'WAITING_CUSTOMER',
              'ONSITE_VISIT',
              'ONSITE_VISIT_PLANNED',
              'PO_NEEDED',
              'PO_RECEIVED',
              'SPARE_PARTS_NEEDED',
              'SPARE_PARTS_BOOKED',
              'SPARE_PARTS_DELIVERED',
              'REOPENED',
              'ON_HOLD',
              'ESCALATED',
              'PENDING'
            ]
          }
        }
      }),

      prisma.ticket.count({
        where: {
          assignedToId: null,
          status: {
            in: [
              'OPEN',
              'ASSIGNED',
              'IN_PROGRESS',
              'IN_PROCESS', // Support legacy/alternate status
              'WAITING_CUSTOMER',
              'ONSITE_VISIT_PLANNED',
              'PO_NEEDED',
              'SPARE_PARTS_NEEDED',
              'REOPENED',
              'ON_HOLD',
              'PENDING'
            ]
          }
        }
      }),

      prisma.ticket.count({
        where: {
          status: {
            in: [
              'IN_PROGRESS',
              'IN_PROCESS', // Support legacy/alternate status
              'ONSITE_VISIT',
              'SPARE_PARTS_BOOKED',
              'SPARE_PARTS_DELIVERED'
            ]
          }
        }
      }),

      prisma.ticket.count({
        where: {
          createdAt: {
            gte: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
            lte: endOfDay(today)
          }
        }
      }),

      // Get active machines count
      prisma.asset.count({
        where: {
          status: { in: ["ACTIVE", "active", "Active"] }
        }
      }),

      // Previous period counts for comparison
      prisma.ticket.count({
        where: {
          status: {
            in: [
              'OPEN',
              'ASSIGNED',
              'IN_PROGRESS',
              'WAITING_CUSTOMER',
              'ONSITE_VISIT',
              'ONSITE_VISIT_PLANNED',
              'PO_NEEDED',
              'PO_RECEIVED',
              'SPARE_PARTS_NEEDED',
              'SPARE_PARTS_BOOKED',
              'SPARE_PARTS_DELIVERED',
              'REOPENED',
              'ON_HOLD',
              'ESCALATED',
              'PENDING'
            ]
          },
          createdAt: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        }
      }),

      prisma.ticket.count({
        where: {
          assignedToId: null,
          status: {
            in: [
              'OPEN',
              'ASSIGNED',
              'IN_PROGRESS',
              'WAITING_CUSTOMER',
              'ONSITE_VISIT_PLANNED',
              'PO_NEEDED',
              'SPARE_PARTS_NEEDED',
              'REOPENED',
              'ON_HOLD',
              'PENDING'
            ]
          },
          createdAt: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        }
      }),

      prisma.ticket.count({
        where: {
          status: {
            in: [
              'IN_PROGRESS',
              'ONSITE_VISIT',
              'SPARE_PARTS_BOOKED',
              'SPARE_PARTS_DELIVERED'
            ]
          },
          createdAt: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        }
      }),

      prisma.ticket.count({
        where: {
          createdAt: {
            gte: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)),
            lte: endOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 0))
          }
        }
      }),

      // Get active machines count (previous period)
      prisma.asset.count({
        where: {
          status: { in: ["ACTIVE", "active", "Active"] }
        }
      }),

      // Calculate average response time (ticket open to in progress)
      calculateAverageResponseTime(currentPeriodStart, currentPeriodEnd),

      // Calculate average resolution time (ticket open to closed)
      calculateAverageResolutionTime(currentPeriodStart, currentPeriodEnd),

      // Calculate average downtime
      calculateAverageDowntime(currentPeriodStart, currentPeriodEnd),

      // Calculate average travel time
      calculateAverageTravelTime(currentPeriodStart, currentPeriodEnd),

      // Calculate average onsite resolution time
      calculateAverageOnsiteResolutionTime(currentPeriodStart, currentPeriodEnd),

      // Get status distribution
      prisma.ticket.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      }),

      // Get priority distribution
      prisma.ticket.groupBy({
        by: ['priority'],
        where: {
          createdAt: {
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          }
        },
        _count: {
          priority: true
        }
      }),

      // Admin stats
      prisma.customer.count({
        where: { isActive: true }
      }),

      prisma.user.count({
        where: {
          role: 'SERVICE_PERSON',
          isActive: true
        }
      }),

      prisma.serviceZone.count({
        where: { isActive: true }
      }),

      // Zone users count (ZONE_USER role only)
      prisma.user.count({
        where: {
          role: 'ZONE_USER',
          isActive: true
        }
      }),

      // Zone managers count (ZONE_MANAGER role only)
      prisma.user.count({
        where: {
          role: 'ZONE_MANAGER',
          isActive: true
        }
      }),

      // Zone-wise data
      getZoneWiseTicketData(currentPeriodStart, currentPeriodEnd),

      // Recent tickets
      prisma.ticket.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, companyName: true }
          },
          asset: {
            select: { id: true, model: true }
          }
        }
      }),

      // Total tickets count
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          }
        }
      }),

      // SLA compliant tickets
      calculateSLACompliance(currentPeriodStart, currentPeriodEnd),

      // Active customers
      prisma.customer.count({
        where: {
          isActive: true,
          tickets: {
            some: {
              status: {
                in: [
                  'OPEN',
                  'ASSIGNED',
                  'IN_PROGRESS',
                  'IN_PROCESS', // Support legacy/alternate status
                  'WAITING_CUSTOMER',
                  'ONSITE_VISIT',
                  'ONSITE_VISIT_PLANNED',
                  'ONSITE_VISIT_STARTED',
                  'ONSITE_VISIT_REACHED',
                  'ONSITE_VISIT_IN_PROGRESS',
                  'ONSITE_VISIT_RESOLVED',
                  'ONSITE_VISIT_PENDING',
                  'ONSITE_VISIT_COMPLETED',
                  'PO_NEEDED',
                  'PO_RECEIVED',
                  'SPARE_PARTS_NEEDED',
                  'SPARE_PARTS_BOOKED',
                  'SPARE_PARTS_DELIVERED',
                  'REOPENED',
                  'ON_HOLD',
                  'ESCALATED',
                  'PENDING'
                ]
              }
            }
          }
        }
      }),

      // Active service persons
      prisma.user.count({
        where: {
          role: 'SERVICE_PERSON',
          isActive: true,
          assignedTickets: {
            some: {
              status: {
                in: [
                  'ASSIGNED',
                  'IN_PROGRESS',
                  'IN_PROCESS', // Support legacy/alternate status
                  'ONSITE_VISIT',
                  'ONSITE_VISIT_PLANNED',
                  'ONSITE_VISIT_STARTED',
                  'ONSITE_VISIT_REACHED',
                  'ONSITE_VISIT_IN_PROGRESS',
                  'ONSITE_VISIT_RESOLVED',
                  'ONSITE_VISIT_PENDING',
                  'ONSITE_VISIT_COMPLETED',
                  'SPARE_PARTS_BOOKED',
                  'SPARE_PARTS_DELIVERED',
                  'WAITING_CUSTOMER',
                  'ON_HOLD',
                  'PENDING'
                ]
              }
            }
          }
        }
      })
    ]);

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const openTicketsChange = isAllRange ? 0 : calculateChange(openTicketsCurrent, openTicketsPrevious);
    const inProgressTicketsChange = isAllRange ? 0 : calculateChange(inProgressTicketsCurrent, inProgressTicketsPrevious);
    const monthlyTicketsChange = isAllRange ? 0 : calculateChange(monthlyTicketsCurrent, monthlyTicketsPrevious);
    const activeMachinesChange = isAllRange ? 0 : calculateChange(activeMachinesCurrent, activeMachinesPrevious);

    // Prepare status distribution
    const statusDistributionFormatted = statusDistribution.map((item: any) => ({
      name: item.status,
      value: item._count.status
    }));

    // Prepare priority distribution
    const priorityDistributionFormatted = priorityDistribution.map((item: any) => ({
      name: item.priority,
      value: item._count.priority
    }));

    // Prepare dashboard data
    const dashboardData: DashboardData = {
      stats: {
        openTickets: {
          count: openTicketsCurrent,
          change: openTicketsChange
        },
        unassignedTickets: {
          count: unassignedTicketsCurrent,
          critical: unassignedTicketsCurrent > 5 // Critical if more than 5 unassigned tickets
        },
        inProgressTickets: {
          count: inProgressTicketsCurrent,
          change: inProgressTicketsChange
        },
        avgResponseTime: responseTimeData,
        avgResolutionTime: resolutionTimeData,
        avgDowntime: downtimeData,
        avgTravelTime: travelTimeData,
        avgOnsiteResolutionTime: onsiteResolutionTimeData,
        monthlyTickets: {
          count: monthlyTicketsCurrent,
          change: monthlyTicketsChange
        },
        activeMachines: {
          count: activeMachinesCurrent,
          change: activeMachinesChange
        },
        ticketDistribution: {
          byStatus: statusDistributionFormatted,
          byPriority: priorityDistributionFormatted
        },
        kpis: {
          totalTickets: {
            value: totalTicketsCount,
            change: (isAllRange ? 0 : calculateChange(totalTicketsCount, 0)).toString(),
            isPositive: false // More tickets is generally not positive
          },
          slaCompliance: {
            value: slaCompliantTickets.percentage,
            change: 0, // You might want to calculate this compared to previous period
            isPositive: slaCompliantTickets.percentage >= 90
          },
          avgResponseTime: {
            value: `${responseTimeData.hours}h ${responseTimeData.minutes}m`,
            unit: 'hours',
            change: 0, // You might want to calculate this compared to previous period
            isPositive: responseTimeData.isPositive
          },
          avgResolutionTime: {
            value: `${resolutionTimeData.days}d ${resolutionTimeData.hours}h`,
            unit: 'days',
            change: 0, // You might want to calculate this compared to previous period
            isPositive: resolutionTimeData.isPositive
          },
          unassignedTickets: {
            value: unassignedTicketsCurrent,
            critical: unassignedTicketsCurrent > 5
          },
          activeCustomers: {
            value: activeCustomersCount,
            change: 0 // You might want to calculate this compared to previous period
          },
          activeServicePersons: {
            value: activeServicePersonsCount,
            change: 0 // You might want to calculate this compared to previous period
          }
        }
      },
      adminStats: {
        totalCustomers,
        totalServicePersons,
        totalServiceZones,
        totalZoneUsers,
        totalZoneManagers,
        ticketStatusDistribution: statusDistributionFormatted.reduce((acc: any, item: any) => {
          acc[item.name] = item.value;
          return acc;
        }, {} as Record<string, number>),
        ticketTrends: await getTicketTrends(30),
        zoneWiseTickets: zoneWiseData
      },
      recentTickets: recentTickets.map((ticket: any) => ({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt.toISOString(),
        customer: {
          id: ticket.customer.id,
          companyName: ticket.customer.companyName
        },
        asset: ticket.asset ? {
          id: ticket.asset.id,
          model: ticket.asset.model || 'Unknown'
        } : undefined
      }))
    };

    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to calculate average response time
// Prefers imported Excel "Respond time" value, falls back to status history calculation
async function calculateAverageResponseTime(startDate: Date, endDate: Date) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate }
      },
      take: 2000,
      select: {
        id: true,
        createdAt: true,
        relatedMachineIds: true,
        statusHistory: {
          orderBy: { changedAt: 'asc' },
          select: { status: true, changedAt: true }
        }
      }
    });

    const responseTimes = tickets
      .map((ticket: any) => {
        // Priority 1: Use imported Excel respond time (in minutes)
        const metadata = parseTicketMetadata(ticket.relatedMachineIds);
        if (metadata.respondTimeMinutes && metadata.respondTimeMinutes > 0) {
          return metadata.respondTimeMinutes;
        }

        // Priority 2: Calculate from status history (first transition from OPEN)
        const firstResponse = ticket.statusHistory?.find((h: any) => h.status !== 'OPEN');
        if (firstResponse) {
          return calculateBusinessHoursInMinutes(ticket.createdAt, firstResponse.changedAt);
        }
        return null;
      })
      .filter((time: number | null): time is number => 
        time !== null && time > 0 && time <= (3 * BUSINESS_MINUTES_PER_DAY)
      );

    if (responseTimes.length === 0) {
      return { hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    const averageMinutes = responseTimes.reduce((sum: number, time: number) => sum + time, 0) / responseTimes.length;
    const hours = Math.floor(averageMinutes / 60);
    const minutes = Math.round(averageMinutes % 60);
    const isPositive = averageMinutes < (2 * 60); // 2 hours

    return { hours, minutes, change: 0, isPositive };
  } catch (error) {
    return { hours: 0, minutes: 0, change: 0, isPositive: true };
  }
}

// Helper function to calculate average resolution time
// Prefers imported Excel "Downtime" value, falls back to date-based calculation
async function calculateAverageResolutionTime(startDate: Date, endDate: Date): Promise<{ days: number, hours: number, minutes: number, change: number, isPositive: boolean }> {
  try {
    // Get tickets that are CLOSED or RESOLVED
    const closedTickets = await prisma.ticket.findMany({
      where: {
        OR: [
          {
            status: { in: ['CLOSED', 'RESOLVED'] },
            createdAt: { gte: startDate, lte: endDate }
          },
          {
            status: { in: ['CLOSED', 'RESOLVED'] },
            updatedAt: { gte: startDate, lte: endDate }
          }
        ]
      },
      select: {
        createdAt: true,
        updatedAt: true,
        status: true,
        actualResolutionTime: true,
        visitCompletedDate: true,
        relatedMachineIds: true
      }
    });

    const resolutionTimes = closedTickets
      .map((ticket: any) => {
        return calculateTicketResolutionMinutes(
          ticket.actualResolutionTime,
          ticket.relatedMachineIds,
          ticket.createdAt,
          ticket.updatedAt,
          ticket.visitCompletedDate
        );
      })
      .filter((time: any) => time > 0);

    if (resolutionTimes.length === 0) {
      return { days: 0, hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    const averageMinutes = resolutionTimes.reduce((sum: number, time: number) => sum + time, 0) / resolutionTimes.length;
    const { days, hours, minutes } = formatMinutesToBusinessDH(averageMinutes);
    const isPositive = averageMinutes < (2 * BUSINESS_MINUTES_PER_DAY);

    return { days, hours, minutes, change: 0, isPositive };
  } catch (error) {
    return { days: 0, hours: 0, minutes: 0, change: 0, isPositive: true };
  }
}

// Helper function to calculate average downtime (Machine Downtime)
// Prefers imported Excel "Downtime" value, falls back to status history calculation
async function calculateAverageDowntime(startDate: Date, endDate: Date): Promise<{ hours: number, minutes: number, change: number, isPositive: boolean }> {
  try {
    // First: Get tickets with imported Excel downtime data (actualResolutionTime or metadata)
    const ticketsInPeriod = await prisma.ticket.findMany({
      where: {
        OR: [
          {
            createdAt: { gte: startDate, lte: endDate },
            status: { in: ['CLOSED', 'RESOLVED', 'CLOSED_PENDING'] }
          },
          {
            updatedAt: { gte: startDate, lte: endDate },
            status: { in: ['CLOSED', 'RESOLVED', 'CLOSED_PENDING'] }
          }
        ]
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        actualResolutionTime: true,
        visitCompletedDate: true,
        relatedMachineIds: true
      }
    });

    const downtimes: number[] = ticketsInPeriod.map((ticket: any) => {
      return calculateTicketResolutionMinutes(
        ticket.actualResolutionTime,
        ticket.relatedMachineIds,
        ticket.createdAt,
        ticket.updatedAt,
        ticket.visitCompletedDate
      );
    }).filter(time => time > 0);

    if (downtimes.length === 0) {
      // If no closed tickets with downtime, check open tickets
      const openTickets = await prisma.ticket.findMany({
        where: {
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ONSITE_VISIT', 'WAITING_CUSTOMER'] },
          createdAt: { gte: startDate, lte: endDate }
        },
        select: { createdAt: true }
      });

      if (openTickets.length > 0) {
        const now = new Date();
        const avgDowntime = openTickets.reduce((sum: number, ticket: any) => {
          return sum + calculateBusinessHoursInMinutes(new Date(ticket.createdAt), now);
        }, 0) / openTickets.length;
        const hours = Math.floor(avgDowntime / 60);
        const minutes = Math.round(avgDowntime % 60);
        return { hours, minutes, change: 0, isPositive: avgDowntime < 240 };
      }
      return { hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    const averageMinutes = downtimes.reduce((sum, time) => sum + time, 0) / downtimes.length;
    const hours = Math.floor(averageMinutes / 60);
    const minutes = Math.round(averageMinutes % 60);
    const isPositive = averageMinutes < 240;

    return { hours, minutes, change: 0, isPositive };
  } catch (error) {
    return { hours: 0, minutes: 0, change: 0, isPositive: true };
  }
}

// Helper function to calculate SLA compliance
async function calculateSLACompliance(startDate: Date, endDate: Date) {
  try {
    // Get all tickets in the period
    const tickets = await prisma.ticket.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      take: 2000, // Safety limit
      include: {
        statusHistory: true
      }
    });

    // SLA target: 1 business day (8.5 hours with 9 AM - 5:30 PM schedule)
    // In a real scenario, you would check against SLA policies based on priority
    const compliantTickets = tickets.filter((ticket: any) => {
      if (!['CLOSED', 'RESOLVED', 'CLOSED_PENDING'].includes(ticket.status)) return false;

      const openedAt = ticket.createdAt;
      const closedAt = ticket.updatedAt;
      const resolutionTime = calculateBusinessHoursInMinutes(openedAt, closedAt);

      return resolutionTime <= 510; // 1 business day = 8.5 hours * 60 = 510 minutes (9 AM - 5:30 PM)
    });

    const percentage = tickets.length > 0
      ? Math.round((compliantTickets.length / tickets.length) * 100)
      : 100;

    return {
      count: compliantTickets.length,
      total: tickets.length,
      percentage
    };
  } catch (error) {
    return { count: 0, total: 0, percentage: 0 };
  }
}

// Significantly optimized helper function to get zone-wise ticket data without N+1 queries
async function getZoneWiseTicketData(startDate: Date, endDate: Date) {
  try {
    // 1. Fetch all active zones with basic counts in one go
    const zones = await prisma.serviceZone.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            tickets: {
              where: {
                OR: [
                  { createdAt: { gte: startDate, lte: endDate } },
                  { updatedAt: { gte: startDate, lte: endDate } }
                ],
                status: {
                  notIn: ['CANCELLED'] as any
                }
              }
            },
            customers: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    // 2. Fetch all closed/resolved tickets for all zones from the selected period
    const allCompletedTickets = await prisma.ticket.findMany({
      where: {
        status: { in: ['CLOSED', 'RESOLVED'] },
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { updatedAt: { gte: startDate, lte: endDate } }
        ],
        zoneId: { in: zones.map(z => z.id) }
      },
      select: {
        id: true,
        zoneId: true,
        createdAt: true,
        updatedAt: true,
        actualResolutionTime: true,
        visitCompletedDate: true,
        relatedMachineIds: true
      }
    });

    // Group completed tickets by zone for average calculation
    const completedTicketsByZone = new Map<number, any[]>();
    allCompletedTickets.forEach(t => {
      if (!completedTicketsByZone.has(t.zoneId)) completedTicketsByZone.set(t.zoneId, []);
      completedTicketsByZone.get(t.zoneId)!.push(t);
    });

    // 3. Fetch all active users for these zones in ONE query
    const allZoneUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { zoneId: { in: zones.map(z => String(z.id)) } },
          { serviceZones: { some: { serviceZoneId: { in: zones.map(z => z.id) } } } }
        ]
      },
      select: {
        id: true,
        role: true,
        zoneId: true,
        serviceZones: { select: { serviceZoneId: true } }
      }
    });

    // 4. Fetch asset counts for all zone customers in ONE query
    const assetCountsByZone = await prisma.asset.groupBy({
      by: ['customerId'],
      where: {
        status: { in: ['ACTIVE', 'active', 'Active'] },
        customer: {
          serviceZoneId: { in: zones.map(z => z.id) }
        }
      },
      _count: {
        id: true
      }
    });

    // Get customer-to-zone mapping
    const customerZoneMapping = await prisma.customer.findMany({
      where: {
        serviceZoneId: { in: zones.map(z => z.id) }
      },
      select: {
        id: true,
        serviceZoneId: true
      }
    });

    // Group asset counts by zone
    const assetsByZone = new Map<number, number>();
    assetCountsByZone.forEach(item => {
      const customer = customerZoneMapping.find(c => c.id === item.customerId);
      if (customer && customer.serviceZoneId) {
        const currentCount = assetsByZone.get(customer.serviceZoneId) || 0;
        const assetCount = typeof item._count === 'object' ? item._count.id : 0;
        assetsByZone.set(customer.serviceZoneId, currentCount + assetCount);
      }
    });

    // 5. Map everything together
    return zones.map((zone: any) => {
      const completedTickets = completedTicketsByZone.get(zone.id) || [];
      let avgResolutionTimeHours = 0;

      if (completedTickets.length > 0) {
        let totalResolutionMins = 0;
        let validTicketCount = 0;

        completedTickets.forEach(t => {
          const resolutionTime = calculateTicketResolutionMinutes(
            t.actualResolutionTime,
            t.relatedMachineIds,
            t.createdAt,
            t.updatedAt,
            t.visitCompletedDate
          );
          
          if (resolutionTime && resolutionTime > 0) {
            totalResolutionMins += resolutionTime;
            validTicketCount++;
          }
        });

        // Convert to Business Hours average for consistency (only dividing by valid tickets)
        if (validTicketCount > 0) {
          avgResolutionTimeHours = Math.round((totalResolutionMins / validTicketCount / 60) * 10) / 10;
        }
      }

      // Filter users for this specific zone
      const usersInZone = allZoneUsers.filter(u =>
        u.zoneId === String(zone.id) ||
        u.serviceZones.some((sz: any) => sz.serviceZoneId === zone.id)
      );

      return {
        id: zone.id,
        name: zone.name,
        totalTickets: zone._count?.tickets || 0,
        customerCount: zone._count?.customers || 0,
        assetCount: assetsByZone.get(zone.id) || 0,
        servicePersonCount: usersInZone.filter(u => u.role === 'SERVICE_PERSON').length,
        zoneManagerCount: usersInZone.filter(u => u.role === 'ZONE_MANAGER').length,
        zoneUserCount: usersInZone.filter(u => u.role === 'ZONE_USER').length,
        avgResolutionTimeHours
      };
    });
  } catch (error) {

    return [];
  }
}

// Optimized helper function to get ticket trends in a single query
async function getTicketTrends(days: number = 30) {
  try {
    const startDate = subDays(startOfDay(new Date()), days - 1);

    // Group tickets by day using Prisma's queryRaw for performance on large datasets
    // This avoids the N+1 count calls for each day
    const results = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC('day', "createdAt") as day,
        COUNT(*) as count
      FROM "Ticket"
      WHERE "createdAt" >= ${startDate}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    // Map results for quick lookup
    const trendsMap = new Map();
    results.forEach(r => {
      // Handle potential differences in date format from Raw Query
      const dateKey = format(new Date(r.day), 'yyyy-MM-dd');
      trendsMap.set(dateKey, Number(r.count));
    });

    const trends = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      trends.push({
        date: dateStr,
        count: trendsMap.get(dateStr) || 0,
        status: 'ALL'
      });
    }

    return trends;
  } catch (error) {

    return [];
  }
}

// Helper function to calculate average travel time
// Prefers imported Excel "Travel Hour" (Leg A + Leg B), falls back to status history
async function calculateAverageTravelTime(startDate: Date, endDate: Date) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate }
      },
      take: 2000,
      select: {
        relatedMachineIds: true,
        statusHistory: true,
        visitStartedAt: true,
        visitReachedAt: true,
        visitInProgressAt: true
      }
    });

    const travelTimes: number[] = [];

    for (const ticket of tickets) {
      const travelMins = calculateTravelMinutes(
        ticket.relatedMachineIds,
        ticket.statusHistory,
        ticket.visitStartedAt,
        ticket.visitReachedAt,
        ticket.visitInProgressAt
      );

      // Validate travel time (same 8h cap as reports)
      if (travelMins > 0 && travelMins <= 480) {
        travelTimes.push(travelMins);
      }
    }

    if (travelTimes.length === 0) {
      return { hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    const avgMinutes = Math.round(travelTimes.reduce((sum, time) => sum + time, 0) / travelTimes.length);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return { hours, minutes, change: 0, isPositive: true };
  } catch (error) {
    return { hours: 0, minutes: 0, change: 0, isPositive: true };
  }
}

// Helper function to calculate average onsite resolution time
// Prefers imported Excel "Work Hour" value, falls back to status history
async function calculateAverageOnsiteResolutionTime(startDate: Date, endDate: Date) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate }
      },
      take: 2000,
      select: {
        relatedMachineIds: true,
        statusHistory: true
      }
    });

    const onsiteTimes: number[] = [];

    for (const ticket of tickets) {
      const onsiteMins = calculateOnsiteResolutionMinutes(
        ticket.relatedMachineIds,
        ticket.statusHistory
      );

      // Standardize cap (same 24h cap as reports)
      if (onsiteMins > 0 && onsiteMins <= 1440) {
        onsiteTimes.push(onsiteMins);
      }
    }

    if (onsiteTimes.length === 0) {
      return { hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    const avgMinutes = Math.round(onsiteTimes.reduce((sum, time) => sum + time, 0) / onsiteTimes.length);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return { hours, minutes, change: 0, isPositive: true };
  } catch (error) {
    return { hours: 0, minutes: 0, change: 0, isPositive: true };
  }
}

// Old implementation kept for reference - ONSITE_VISIT_LOG based
async function calculateAverageOnsiteResolutionTime_OLD(startDate: Date, endDate: Date) {
  try {
    // First try: Use OnsiteVisitLog (WORK_STARTED -> WORK_COMPLETED|RESOLVED|ENDED)
    try {
      const endLogCandidates = await prisma.onsiteVisitLog.findMany({
        where: {
          event: { in: [OnsiteVisitEvent.WORK_COMPLETED, OnsiteVisitEvent.RESOLVED, OnsiteVisitEvent.ENDED] },
          createdAt: { gte: startDate, lte: endDate }
        },
        select: { ticketId: true },
        distinct: ['ticketId']
      });
      if (endLogCandidates.length > 0) {
        const ticketIdsForLogs = endLogCandidates.map((e: any) => e.ticketId);
        const fullLogs = await prisma.onsiteVisitLog.findMany({
          where: {
            ticketId: { in: ticketIdsForLogs },
            event: {
              in: [
                OnsiteVisitEvent.WORK_STARTED,
                OnsiteVisitEvent.WORK_PAUSED,
                OnsiteVisitEvent.WORK_RESUMED,
                OnsiteVisitEvent.WORK_COMPLETED,
                OnsiteVisitEvent.RESOLVED,
                OnsiteVisitEvent.ENDED
              ]
            }
          },
          orderBy: { createdAt: 'asc' }
        });

        const logMap = new Map<number, any[]>();
        for (const l of fullLogs) {
          if (!logMap.has(l.ticketId)) logMap.set(l.ticketId, []);
          logMap.get(l.ticketId)!.push(l);
        }

        const perTicketMinutes = new Map<number, number>();
        let segmentCount = 0;
        let filteredOutliers = 0;
        const MAX_ONSITE_MIN = 12 * 60; // 12h sanity cap per segment

        for (const [ticketId, logs] of logMap) {
          logs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          let ticketMinutes = 0;
          for (let i = 0; i < logs.length; i++) {
            const e: any = logs[i];
            // End inside window -> pair with nearest preceding WORK_STARTED by same user
            if ((e.event === OnsiteVisitEvent.WORK_COMPLETED || e.event === OnsiteVisitEvent.RESOLVED || e.event === OnsiteVisitEvent.ENDED)
              && e.createdAt >= startDate && e.createdAt <= endDate) {
              let start: any = null;
              for (let j = i - 1; j >= 0; j--) {
                if (logs[j].event === OnsiteVisitEvent.WORK_STARTED && logs[j].userId === e.userId) { start = logs[j]; break; }
              }
              if (start && start.createdAt < e.createdAt) {
                const mins = differenceInMinutes(new Date(e.createdAt), new Date(start.createdAt));
                if (mins > 0) { ticketMinutes += mins; segmentCount++; }
              }
            }
          }
          if (ticketMinutes > 0) perTicketMinutes.set(ticketId, ticketMinutes);
        }

        if (perTicketMinutes.size > 0) {
          const total = Array.from(perTicketMinutes.values()).reduce((a, b) => a + b, 0);
          const avgMinutesFromLogs = Math.round(total / perTicketMinutes.size);
          const hoursFromLogs = Math.floor(avgMinutesFromLogs / 60);
          const minutesFromLogs = avgMinutesFromLogs % 60;
          if (filteredOutliers > 0)
            return { hours: hoursFromLogs, minutes: minutesFromLogs, change: 0, isPositive: true };
        }
      }
    } catch (e) {
    }

    // Fallback: Find tickets that had onsite in-progress/resolved changes during the window
    const statusHistoryEntries = await prisma.ticketStatusHistory.findMany({
      where: {
        status: {
          in: ['ONSITE_VISIT_IN_PROGRESS', 'ONSITE_VISIT_RESOLVED']
        },
        changedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        ticketId: true,
        status: true,
        changedAt: true
      },
      orderBy: {
        changedAt: 'asc'
      }
    });

    if (statusHistoryEntries.length === 0) {
      return {
        hours: 0,
        minutes: 0, // No data = show 0
        change: 0,
        isPositive: true
      };
    }

    // Step 2: Load full relevant status history for those tickets (to handle boundary conditions)
    const ticketIds = Array.from(new Set(statusHistoryEntries.map((e: any) => e.ticketId)));
    const fullHistory = await prisma.ticketStatusHistory.findMany({
      where: {
        ticketId: { in: ticketIds },
        status: {
          in: ['ONSITE_VISIT_IN_PROGRESS', 'ONSITE_VISIT_RESOLVED']
        }
      },
      orderBy: {
        changedAt: 'asc'
      }
    });

    // Group by ticket ID
    const ticketStatusMap = new Map<number, any[]>();
    for (const entry of fullHistory) {
      if (!ticketStatusMap.has(entry.ticketId)) {
        ticketStatusMap.set(entry.ticketId, []);
      }
      ticketStatusMap.get(entry.ticketId)!.push(entry);
    }

    let totalMinutes = 0;
    let validTickets = 0;
    let filteredTickets = 0;
    let ticketOnsiteDetails: any[] = [];
    const MAX_ONSITE_MIN_FALLBACK = 12 * 60; // 12h sanity cap

    for (const [ticketId, statusHistory] of ticketStatusMap) {
      // Ensure chronological
      statusHistory.sort((a: any, b: any) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

      // For each RESOLVED event that ends within the window, pair with the nearest preceding IN_PROGRESS
      for (let i = 0; i < statusHistory.length; i++) {
        const e: any = statusHistory[i];
        if (e.status === 'ONSITE_VISIT_RESOLVED' && e.changedAt >= startDate && e.changedAt <= endDate) {
          // Find previous IN_PROGRESS
          let startStatus: any = null;
          for (let j = i - 1; j >= 0; j--) {
            if (statusHistory[j].status === 'ONSITE_VISIT_IN_PROGRESS') {
              startStatus = statusHistory[j];
              break;
            }
          }

          if (startStatus && startStatus.changedAt < e.changedAt) {
            // Use real elapsed minutes for onsite duration
            const durationMinutes = differenceInMinutes(new Date(e.changedAt), new Date(startStatus.changedAt));
            if (durationMinutes > 0) {
              totalMinutes += durationMinutes;
              validTickets++;
              ticketOnsiteDetails.push({ ticketId, onsiteMinutes: durationMinutes });
            }
          }
        }
      }
    }

    if (validTickets === 0) {
      return {
        hours: 0,
        minutes: 0, // No data = show 0
        change: 0,
        isPositive: true
      };
    }

    const avgMinutes = Math.round(totalMinutes / validTickets);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return {
      hours,
      minutes,
      change: 0, // You could calculate this compared to previous period
      isPositive: true // Lower resolution time is better
    };
  } catch (error) {
    return {
      hours: 0,
      minutes: 0, // Error = show 0
      change: 0,
      isPositive: true
    };
  }
}

// Additional endpoint for status distribution
export const getStatusDistribution = async (req: Request, res: Response) => {
  try {
    const distribution = await prisma.ticket.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    res.json({
      distribution: distribution.map((item: any) => ({
        status: item.status,
        count: item._count.status
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status distribution' });
  }
};

// Additional endpoint for ticket trends
export const getTicketTrendsData = async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trends = await getTicketTrends(days);

    res.json({ trends });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket trends' });
  }
};

// Endpoint to fetch team members (zone users and service technicians)
export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    // Fetch zone users (ZONE_USER and ZONE_MANAGER roles)
    const zoneUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ZONE_USER', 'ZONE_MANAGER']
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        lastActiveAt: true,
        createdAt: true,
        serviceZones: {
          include: {
            serviceZone: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        // Get count of assigned offers for zone users
        assignedOffers: {
          where: {
            status: {
              notIn: ['WON', 'LOST', 'CANCELLED']
            }
          },
          select: {
            id: true
          }
        },
        createdOffers: {
          where: {
            status: {
              notIn: ['WON', 'LOST', 'CANCELLED']
            }
          },
          select: {
            id: true
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ]
    });

    // Fetch service technicians (SERVICE_PERSON role)
    const serviceTechnicians = await prisma.user.findMany({
      where: {
        role: 'SERVICE_PERSON',
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        lastActiveAt: true,
        createdAt: true,
        serviceZones: {
          include: {
            serviceZone: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        // Get count of active tickets assigned to this technician
        assignedTickets: {
          where: {
            status: {
              in: [
                'ASSIGNED',
                'IN_PROGRESS',
                'ONSITE_VISIT',
                'ONSITE_VISIT_PLANNED',
                'ONSITE_VISIT_STARTED',
                'ONSITE_VISIT_REACHED',
                'ONSITE_VISIT_IN_PROGRESS',
                'SPARE_PARTS_NEEDED',
                'SPARE_PARTS_BOOKED',
                'SPARE_PARTS_DELIVERED',
                'WAITING_CUSTOMER',
                'ON_HOLD',
                'PENDING'
              ]
            }
          },
          select: {
            id: true,
            status: true,
            priority: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform zone users data
    const transformedZoneUsers = zoneUsers.map((user: any) => ({
      id: user.id,
      name: user.name || 'Unknown',
      email: user.email,
      phone: user.phone,
      role: user.role,
      roleLabel: user.role === 'ZONE_MANAGER' ? 'Zone Manager' : 'Zone User',
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      zones: user.serviceZones.map((sz: any) => ({
        id: sz.serviceZone.id,
        name: sz.serviceZone.name
      })),
      activeOffers: user.assignedOffers.length + user.createdOffers.length
    }));

    // Transform service technicians data
    const transformedTechnicians = serviceTechnicians.map((user: any) => ({
      id: user.id,
      name: user.name || 'Unknown',
      email: user.email,
      phone: user.phone,
      role: user.role,
      roleLabel: 'Service Technician',
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      zones: user.serviceZones.map((sz: any) => ({
        id: sz.serviceZone.id,
        name: sz.serviceZone.name
      })),
      activeTickets: user.assignedTickets.length,
      ticketsByPriority: {
        critical: user.assignedTickets.filter((t: any) => t.priority === 'CRITICAL').length,
        high: user.assignedTickets.filter((t: any) => t.priority === 'HIGH').length,
        medium: user.assignedTickets.filter((t: any) => t.priority === 'MEDIUM').length,
        low: user.assignedTickets.filter((t: any) => t.priority === 'LOW').length
      }
    }));

    res.json({
      zoneUsers: transformedZoneUsers,
      serviceTechnicians: transformedTechnicians,
      summary: {
        totalZoneUsers: transformedZoneUsers.length,
        totalZoneManagers: transformedZoneUsers.filter((u: any) => u.role === 'ZONE_MANAGER').length,
        totalZoneUserOnly: transformedZoneUsers.filter((u: any) => u.role === 'ZONE_USER').length,
        totalServiceTechnicians: transformedTechnicians.length,
        techniciansWithActiveTickets: transformedTechnicians.filter((t: any) => t.activeTickets > 0).length
      }
    });
  } catch (error) {

    res.status(500).json({ error: 'Failed to fetch team members' });
  }
};