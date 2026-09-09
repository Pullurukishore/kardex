import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../middleware/auth.middleware';
import { serializeBigInts } from '../utils/bigint';
import { differenceInMinutes } from 'date-fns';
import prisma from '../config/db';
import { calculateBusinessHoursInMinutes, calculateTravelMinutes } from '../utils/dateUtils';

// Custom type definitions to replace problematic Prisma exports
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'IN_PROCESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  customerId: number;
  contactId: number;
  assetId: number;
  ownerId: number;
  subOwnerId?: number;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  assignedToId?: number;
  zoneId: number;
  dueDate?: Date;
  estimatedResolutionTime?: number;
  actualResolutionTime?: number;
  resolutionSummary?: string;
  isCritical: boolean;
  isEscalated: boolean;
  escalatedAt?: Date;
  escalatedBy?: number;
  escalatedReason?: string;
  lastStatusChange?: Date;
  timeInStatus?: number;
  totalTimeOpen?: number;
  relatedMachineIds?: string;
  errorDetails?: string;
  proofImages?: string;
  visitPlannedDate?: Date;
  visitCompletedDate?: Date;
  sparePartsDetails?: string;
  poNumber?: string;
  poApprovedAt?: Date;
  poApprovedById?: number;
}

// Type for raw query results
interface QueryResult<T = any> {
  [key: string]: T;
}

// Extend the Express Request type to include user
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

interface TicketCount {
  status: string;
  _count: number;
}

interface ServicePersonZoneWithCount {
  user: any;
  _count: {
    assignedTickets: number;
  };
}

interface TopIssue {
  priority: Priority | null;
  _count: number;
}

// Helper functions for zone metrics



async function calculateAverageResponseTime(zoneId: number): Promise<{ hours: number; minutes: number; change: number; isPositive: boolean }> {
  try {
    // Get tickets that have moved from OPEN to ASSIGNED status (no date filter - match admin dashboard)
    const ticketsWithStatusHistory = await prisma.ticket.findMany({
      where: {
        customer: {
          serviceZoneId: zoneId
        }
      },
      select: {
        id: true,
        createdAt: true,
        statusHistory: {
          where: {
            status: 'ASSIGNED'
          },
          orderBy: {
            changedAt: 'asc'
          },
          select: {
            status: true,
            changedAt: true
          }
        }
      }
    });

    // Calculate response times (time from ticket creation to ASSIGNED - first response)
    const responseTimes = ticketsWithStatusHistory
      .map((ticket: any) => {
        const assignedAt = ticket.statusHistory[0]?.changedAt;
        if (assignedAt) {
          return calculateBusinessHoursInMinutes(ticket.createdAt, assignedAt);
        }
        return 0;
      })
      .filter((time: number) => time > 0); // Filter out negative times

    if (responseTimes.length === 0) {
      return { hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    const avgMinutes = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    return {
      hours: Math.floor(avgMinutes / 60),
      minutes: Math.round(avgMinutes % 60),
      change: 0, // Zone dashboard doesn't calculate change
      isPositive: true
    };
  } catch (error) {
    return { hours: 0, minutes: 0, change: 0, isPositive: true };
  }
}

async function calculateAverageResolutionTime(zoneId: number): Promise<{ days: number; hours: number; change: number; isPositive: boolean }> {
  try {
    // Get tickets that are CLOSED (final resolution) - no date filter to match admin dashboard
    const closedTickets = await prisma.ticket.findMany({
      where: {
        status: 'CLOSED',
        customer: {
          serviceZoneId: zoneId
        }
      },
      select: {
        createdAt: true,
        updatedAt: true,
        status: true
      }
    });

    // Calculate resolution times (business hours from ticket open to CLOSED)
    const resolutionTimes = closedTickets
      .map((ticket: any) => {
        return calculateBusinessHoursInMinutes(ticket.createdAt, ticket.updatedAt);
      })
      .filter((time: any) => time > 0); // Filter out negative times

    if (resolutionTimes.length === 0) {
      // If no resolved tickets, check for any tickets that might be resolved
      const allTickets = await prisma.ticket.findMany({
        where: {
          customer: {
            serviceZoneId: zoneId
          }
        },
        select: {
          createdAt: true,
          updatedAt: true
        }
      });

      const allResolutionTimes = allTickets
        .map((ticket: any) => {
          return calculateBusinessHoursInMinutes(ticket.createdAt, ticket.updatedAt);
        })
        .filter((time: any) => time > 0);

      if (allResolutionTimes.length === 0) {
        return { days: 0, hours: 0, change: 0, isPositive: true };
      }

      const avgMinutes = allResolutionTimes.reduce((sum, time) => sum + time, 0) / allResolutionTimes.length;
      const businessHoursPerDay = 8.5 * 60; // 510 minutes per business day (8.5 hours)
      const days = Math.floor(avgMinutes / businessHoursPerDay);
      const remainingMinutes = avgMinutes % businessHoursPerDay;
      const hours = remainingMinutes / 60;

      return { days, hours: Math.round(hours * 10) / 10, change: 0, isPositive: true };
    }

    const avgMinutes = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
    const businessHoursPerDay = 8.5 * 60; // 510 minutes per business day (8.5 hours)
    const days = Math.floor(avgMinutes / businessHoursPerDay);
    const remainingMinutes = avgMinutes % businessHoursPerDay;
    const hours = remainingMinutes / 60;

    return { days, hours: Math.round(hours * 10) / 10, change: 0, isPositive: true };
  } catch (error) {
    return { days: 0, hours: 0, change: 0, isPositive: true };
  }
}

async function calculateAverageDowntime(zoneId: number): Promise<{ hours: number; minutes: number; change: number; isPositive: boolean }> {
  try {
    // Calculate machine downtime using status history (ticket open to CLOSED_PENDING/RESOLVED/CLOSED)
    // Find tickets that reached CLOSED_PENDING status in the period
    const closedStatusHistory = await prisma.ticketStatusHistory.findMany({
      where: {
        status: {
          in: ['CLOSED_PENDING', 'RESOLVED', 'CLOSED']
        },
        ticket: {
          customer: {
            serviceZoneId: zoneId
          }
        }
      },
      include: {
        ticket: {
          select: {
            createdAt: true,
            id: true
          }
        }
      },
      orderBy: {
        changedAt: 'asc'
      }
    });

    if (closedStatusHistory.length === 0) {
      // If no closed tickets, calculate based on currently open tickets
      const openTickets = await prisma.ticket.findMany({
        where: {
          customer: {
            serviceZoneId: zoneId
          },
          status: {
            in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ONSITE_VISIT', 'WAITING_CUSTOMER']
          }
        },
        select: {
          createdAt: true,
          updatedAt: true
        }
      });

      if (openTickets.length > 0) {
        // Use current age of open tickets as downtime (business hours)
        const now = new Date();
        const avgDowntime = openTickets.reduce((sum: any, ticket: any) => {
          return sum + calculateBusinessHoursInMinutes(ticket.createdAt, now);
        }, 0) / openTickets.length;

        const hours = Math.floor(avgDowntime / 60);
        const minutes = Math.round(avgDowntime % 60);
        const isPositive = avgDowntime < 240; // Less than 4 hours is positive

        return { hours, minutes, change: 0, isPositive };
      }

      return { hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    // Group by ticket ID and find first closure time for each ticket
    const ticketClosureTimes = new Map<number, Date>();
    closedStatusHistory.forEach(history => {
      if (!ticketClosureTimes.has(history.ticketId)) {
        ticketClosureTimes.set(history.ticketId, history.changedAt);
      }
    });

    // Calculate downtime for each ticket (creation to first closure)
    const downtimes = Array.from(ticketClosureTimes.entries()).map(([ticketId, closedAt]) => {
      const ticket = closedStatusHistory.find(h => h.ticketId === ticketId)?.ticket;
      if (!ticket) return 0;
      return calculateBusinessHoursInMinutes(ticket.createdAt, closedAt);
    }).filter((time: number) => time > 0);

    if (downtimes.length === 0) {
      return { hours: 0, minutes: 0, change: 0, isPositive: true };
    }

    const averageMinutes = downtimes.reduce((sum: number, time: number) => sum + time, 0) / downtimes.length;

    // Convert to hours and minutes
    const hours = Math.floor(averageMinutes / 60);
    const minutes = Math.round(averageMinutes % 60);

    const isPositive = averageMinutes < 240; // Positive if less than 4 hours

    return { hours, minutes, change: 0, isPositive };
  } catch (error) {
    return { hours: 0, minutes: 0, change: 0, isPositive: true };
  }
}

async function calculateTechnicianEfficiency(zoneId: number): Promise<number> {
  try {
    const result = await prisma.$queryRaw<Array<{ avg_efficiency: number | null }>>`
      SELECT AVG(efficiency) as avg_efficiency
      FROM (
        SELECT 
          t."assignedToId",
          COUNT(DISTINCT CASE WHEN t.status = 'RESOLVED' THEN t.id END) * 100.0 / 
          NULLIF(COUNT(DISTINCT t.id), 0) as efficiency
        FROM "Ticket" t
        JOIN "Customer" c ON t."customerId" = c.id
        WHERE c."serviceZoneId" = ${zoneId}
        AND t."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY t."assignedToId"
      ) as tech_efficiency
    `;
    return Number(result[0]?.avg_efficiency) || 0;
  } catch (error) {
    return 0;
  }
}

async function calculateAverageTravelTime(zoneId: number): Promise<{ hours: number; minutes: number; change: number; isPositive: boolean }> {
  try {
    // Get all tickets for this zone (ignoring PHONE_CALL tickets)
    const tickets = await prisma.ticket.findMany({
      where: {
        customer: {
          serviceZoneId: zoneId
        },
        supportMode: {
          not: 'PHONE_CALL'
        }
      },
      select: {
        relatedMachineIds: true,
        statusHistory: {
          orderBy: {
            changedAt: 'asc',
          },
        },
        visitStartedAt: true,
        visitReachedAt: true,
        visitInProgressAt: true,
        supportMode: true
      },
    });

    const travelTimes: number[] = [];

    for (const ticket of tickets) {
      if (ticket.supportMode === 'PHONE_CALL') continue;

      const travelMins = calculateTravelMinutes(
        ticket.relatedMachineIds,
        ticket.statusHistory,
        ticket.visitStartedAt,
        ticket.visitReachedAt,
        ticket.visitInProgressAt,
        ticket.supportMode
      );

      if (travelMins > 0 && travelMins <= 480) {
        travelTimes.push(travelMins);
      }
    }

    if (travelTimes.length === 0) {
      return {
        hours: 0,
        minutes: 0,
        change: 0,
        isPositive: true
      };
    }

    const avgMinutes = travelTimes.reduce((sum, time) => sum + time, 0) / travelTimes.length;

    return {
      hours: Math.floor(avgMinutes / 60),
      minutes: Math.round(avgMinutes % 60),
      change: 0,
      isPositive: true
    };
  } catch (error) {
    return {
      hours: 0,
      minutes: 0,
      change: 0,
      isPositive: true
    };
  }
}

async function calculatePartsAvailability(zoneId: number): Promise<number> {
  try {
    // Calculate parts availability based on tickets that have spare parts details vs those that need parts
    const result = await prisma.$queryRaw<Array<{ parts_availability: number | null }>>`
      SELECT 
        COUNT(DISTINCT CASE WHEN t."sparePartsDetails" IS NOT NULL AND t."sparePartsDetails" != '' THEN t.id END) * 100.0 /
        NULLIF(COUNT(DISTINCT CASE WHEN t.status IN ('IN_PROGRESS', 'ASSIGNED') THEN t.id END), 0) as parts_availability
      FROM "Ticket" t
      JOIN "Customer" c ON t."customerId" = c.id
      WHERE c."serviceZoneId" = ${zoneId}
      AND t."createdAt" >= NOW() - INTERVAL '30 days'
      AND t.status IN ('IN_PROGRESS', 'ASSIGNED', 'RESOLVED', 'CLOSED')
    `;

    const availability = Number(result[0]?.parts_availability) || 0;

    return availability;
  } catch (error) {
    return 0;
  }
}

async function calculateEquipmentUptime(zoneId: number): Promise<number> {
  try {
    // Calculate uptime based on ticket resolution rate for assets
    const result = await prisma.$queryRaw<Array<{ uptime_percentage: number | null }>>`
      SELECT 
        COUNT(CASE WHEN t.status IN ('RESOLVED', 'CLOSED') THEN 1 END) * 100.0 /
        NULLIF(COUNT(*), 0) as uptime_percentage
      FROM "Asset" a
      JOIN "Ticket" t ON a.id = t."assetId"
      JOIN "Customer" c ON a."customerId" = c.id
      WHERE c."serviceZoneId" = ${zoneId}
    `;
    return Number(result[0]?.uptime_percentage) || 0;
  } catch (error) {
    return 0;
  }
}

async function calculateFirstCallResolutionRate(zoneId: number): Promise<number> {
  try {
    const result = await prisma.$queryRaw<Array<{ first_call_resolution_rate: number | null }>>`
      WITH resolved_tickets AS (
        SELECT 
          t.id,
          COUNT(DISTINCT CASE WHEN n.content ILIKE '%first time fix%' THEN n.id END) > 0 as first_time_fix
        FROM "Ticket" t
        JOIN "Customer" c ON t."customerId" = c.id
        LEFT JOIN "TicketNote" n ON t.id = n."ticketId"
        WHERE c."serviceZoneId" = ${zoneId}
        AND t.status = 'RESOLVED'
        AND t."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY t.id
      )
      SELECT 
        COUNT(CASE WHEN first_time_fix = true THEN id END) * 100.0 /
        NULLIF(COUNT(*), 0) as first_call_resolution_rate
      FROM resolved_tickets
    `;
    return Number(result[0]?.first_call_resolution_rate) || 0;
  } catch (error) {
    return 0;
  }
}

async function calculateCustomerSatisfactionScore(zoneId: number): Promise<number> {
  try {
    const result = await prisma.$queryRaw<Array<{ avg_satisfaction_score: number | null }>>`
      SELECT AVG(f."rating") as avg_satisfaction_score
      FROM "TicketFeedback" f
      JOIN "Ticket" t ON f."ticketId" = t.id
      JOIN "Customer" c ON t."customerId" = c.id
      WHERE c."serviceZoneId" = ${zoneId}
      AND f."submittedAt" >= NOW() - INTERVAL '30 days'
    `;
    // Convert to percentage (assuming rating is 1-5 scale)
    const score = result[0]?.avg_satisfaction_score;
    return score ? (Number(score) / 5) * 100 : 0;
  } catch (error) {
    return 0;
  }
}

// Lightweight zone info endpoint for ticket creation
export const getZoneInfo = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the zone this user is assigned to
    const userWithZone = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        customer: {
          include: {
            serviceZone: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        },
        serviceZones: {
          include: {
            serviceZone: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        }
      }
    });

    if (!userWithZone) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Try to get zone from service person assignment first, then customer assignment
    let zone = null;

    // Check if user is a service person assigned to zones
    if (userWithZone.serviceZones && userWithZone.serviceZones.length > 0) {
      zone = userWithZone.serviceZones[0].serviceZone;
    }
    // Check if user is associated with a customer that has a zone
    else if (userWithZone.customer && userWithZone.customer.serviceZone) {
      zone = userWithZone.customer.serviceZone;
    }

    if (!zone) {
      return res.status(404).json({ error: 'No zone assigned to user' });
    }

    return res.json({ zone });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch zone info' });
  }
};

export const getZoneDashboardData = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the zone this user is assigned to (either through customer or direct assignment)
    const userWithZone = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        customer: {
          include: {
            serviceZone: true
          }
        },
        serviceZones: {
          include: {
            serviceZone: true
          }
        }
      }
    });

    if (!userWithZone) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Try to get zone from service person assignment first, then customer assignment
    let zone = null;

    // Check if user is a service person/zone user assigned to zones
    if (userWithZone.serviceZones && userWithZone.serviceZones.length > 0) {
      zone = userWithZone.serviceZones[0].serviceZone;
    }
    // Check if user is associated with a customer that has a zone
    else if (userWithZone.customer && userWithZone.customer.serviceZone) {
      zone = userWithZone.customer.serviceZone;
    }
    // Check if user has a direct zoneId assignment (for ZONE_MANAGER)
    else if (userWithZone.zoneId) {
      zone = await prisma.serviceZone.findUnique({
        where: { id: parseInt(userWithZone.zoneId.toString()) }
      });
    }

    if (!zone) {
      return res.status(404).json({ error: 'No service zone found for this user' });
    }

    // Calculate all metrics in parallel
    const [
      technicianEfficiency,
      avgTravelTime,
      partsAvailability,
      equipmentUptime,
      firstCallResolutionRate,
      customerSatisfactionScore,
      avgResponseTime,
      avgResolutionTime,
      avgDowntime
    ] = await Promise.all([
      calculateTechnicianEfficiency(zone.id),
      calculateAverageTravelTime(zone.id),
      calculatePartsAvailability(zone.id),
      calculateEquipmentUptime(zone.id),
      calculateFirstCallResolutionRate(zone.id),
      calculateCustomerSatisfactionScore(zone.id),
      calculateAverageResponseTime(zone.id),
      calculateAverageResolutionTime(zone.id),
      calculateAverageDowntime(zone.id)
    ]);

    // Get ticket counts by status
    const ticketCounts = await (prisma.ticket as any).groupBy({
      by: ['status'],
      where: {
        customer: { serviceZoneId: zone.id },
        OR: [
          { status: 'OPEN' },
          { status: 'IN_PROGRESS' },
          { status: 'IN_PROCESS' as any }, // Handle both IN_PROCESS and IN_PROGRESS
          { status: 'RESOLVED' }
        ]
      },
      _count: true
    });

    const openTickets = ticketCounts.find((t: any) => t.status === 'OPEN' as TicketStatus)?._count || 0;
    // Handle both 'IN_PROGRESS' and 'IN_PROCESS' statuses
    const inProgressTickets =
      (ticketCounts.find((t: any) => t.status === 'IN_PROGRESS' as TicketStatus)?._count || 0) +
      (ticketCounts.find((t: any) => t.status === 'IN_PROCESS' as any)?._count || 0);

    // Get resolved tickets for trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const resolvedTickets = await prisma.ticket.findMany({
      where: {
        customer: { serviceZoneId: zone.id },
        status: 'RESOLVED' as TicketStatus,
        updatedAt: { gte: thirtyDaysAgo }
      },
      orderBy: { updatedAt: 'asc' },
      include: {
        customer: true,
        assignedTo: true
      }
    });

    // Calculate trends
    const resolvedTicketsData = resolvedTickets.map((ticket: any) => ({
      date: ticket.updatedAt.toISOString().split('T')[0],
      count: 1
    }));

    // Group by date
    const ticketsByDate = resolvedTicketsData.reduce((acc: Record<string, number>, { date }: { date: string }) => {
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Format for chart
    const resolvedTicketsTrend = Object.entries(ticketsByDate).map(([date, count]) => ({
      date,
      count: count as number
    }));

    // Get zone technicians (only SERVICE_PERSON role)
    const zoneTechnicians = await prisma.user.findMany({
      where: {
        role: 'SERVICE_PERSON',
        isActive: true,
        serviceZones: {
          some: {
            serviceZoneId: zone.id
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            assignedTickets: true
          }
        }
      },
      take: 10
    });

    // Get recent activities
    const recentActivities = await prisma.ticket.findMany({
      where: {
        customer: { serviceZoneId: zone.id },
        updatedAt: { gte: thirtyDaysAgo }
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        assignedTo: {
          select: { name: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    // Get top issues
    const topIssues = await prisma.ticket.groupBy({
      by: ['title'],
      where: {
        customer: { serviceZoneId: zone.id },
        status: 'RESOLVED' as TicketStatus,
        updatedAt: { gte: thirtyDaysAgo }
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });

    // Get zone users (ZONE_USER role) assigned to this zone
    // User.zoneId is stored as String, so we need to compare as string
    const zoneIdString = zone.id.toString();

    const zoneUserCount = await prisma.user.count({
      where: {
        role: 'ZONE_USER',
        isActive: true,
        OR: [
          { zoneId: zoneIdString },
          { serviceZones: { some: { serviceZoneId: zone.id } } }
        ]
      }
    });

    // Get zone managers (ZONE_MANAGER role) assigned to this zone
    const zoneManagerCount = await prisma.user.count({
      where: {
        role: 'ZONE_MANAGER',
        isActive: true,
        OR: [
          { zoneId: zoneIdString },
          { serviceZones: { some: { serviceZoneId: zone.id } } }
        ]
      }
    });

    // Format response with comprehensive data like admin dashboard
    const response = {
      zone: {
        id: zone.id,
        name: zone.name,
        description: zone.description || '',
        totalCustomers: await prisma.customer.count({ where: { serviceZoneId: zone.id } }),
        totalTechnicians: zoneTechnicians.length,
        totalZoneUsers: zoneUserCount,
        totalZoneManagers: zoneManagerCount,
        totalAssets: await prisma.asset.count({
          where: { customer: { serviceZoneId: zone.id } }
        })
      },
      stats: {
        openTickets: { count: openTickets, change: 0 },
        unassignedTickets: {
          count: await prisma.ticket.count({
            where: {
              customer: { serviceZoneId: zone.id },
              assignedToId: null,
              status: { in: ['OPEN', 'IN_PROGRESS'] }
            }
          }),
          critical: false
        },
        inProgressTickets: { count: inProgressTickets, change: 0 },
        avgResponseTime: {
          hours: avgResponseTime.hours,
          minutes: avgResponseTime.minutes,
          change: avgResponseTime.change || 0,
          isPositive: avgResponseTime.isPositive ?? true
        },
        avgResolutionTime: {
          days: avgResolutionTime.days,
          hours: avgResolutionTime.hours,
          minutes: 0,
          change: avgResolutionTime.change || 0,
          isPositive: avgResolutionTime.isPositive ?? true
        },
        avgDowntime: {
          hours: avgDowntime.hours,
          minutes: avgDowntime.minutes,
          change: avgDowntime.change || 0,
          isPositive: avgDowntime.isPositive ?? true
        },
        avgTravelTime: {
          hours: avgTravelTime.hours,
          minutes: avgTravelTime.minutes,
          change: avgTravelTime.change || 0,
          isPositive: avgTravelTime.isPositive ?? true
        },
        monthlyTickets: { count: resolvedTickets.length, change: 0 },
        activeMachines: {
          count: await prisma.asset.count({
            where: {
              customer: { serviceZoneId: zone.id },
              status: 'ACTIVE'
            }
          }),
          change: 0
        }
      },
      metrics: {
        openTickets: Number(openTickets) || 0,
        inProgressTickets: Number(inProgressTickets) || 0,
        resolvedTickets: Number(resolvedTickets.length) || 0,
        technicianEfficiency: Number(technicianEfficiency) || 0,
        avgTravelTime: Number(avgTravelTime.hours * 60 + avgTravelTime.minutes) || 0, // Total minutes
        avgDowntime: Number(avgDowntime.hours * 60 + avgDowntime.minutes) || 0, // Total minutes
        partsAvailability: Number(partsAvailability) || 0,
        equipmentUptime: Number(equipmentUptime) || 0,
        firstCallResolutionRate: Number(firstCallResolutionRate) || 0,
        customerSatisfactionScore: Number((customerSatisfactionScore || 0) / 20) || 0, // Convert to 5.0 scale
        avgResponseTime: Number(avgResponseTime.hours * 60 + avgResponseTime.minutes) || 0, // Total minutes
        avgResolutionTime: Number(avgResolutionTime.days * 24 + avgResolutionTime.hours) || 0 // Total hours
      },
      trends: {
        resolvedTickets: resolvedTicketsTrend
      },
      topIssues: topIssues.map((issue: any) => ({
        title: issue.title,
        count: issue._count._all,
        priority: 'MEDIUM',
        avgResolutionTime: 0
      })),
      technicians: zoneTechnicians.map((tech: any) => ({
        id: tech.id,
        name: tech.name || 'Unknown',
        activeTickets: tech._count.assignedTickets,
        efficiency: 0, // Will be calculated based on actual data
        rating: 0 // Will be calculated based on actual data
      })),
      recentActivities: recentActivities.map((activity: any) => ({
        id: activity.id,
        type: 'ticket_update',
        description: `${activity.title} - ${activity.status}`,
        timestamp: activity.updatedAt.toISOString(),
        priority: activity.priority,
        technician: activity.assignedTo?.name
      }))
    };

    return res.json(serializeBigInts(response));
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Extend JwtPayload to include zoneId
interface ExtendedJwtPayload extends JwtPayload {
  zoneId?: string | number;
  [key: string]: any; // Allow any other properties
}

// Get FSA (Field Service Analytics) data
export const getFSAData = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as ExtendedJwtPayload;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get zone ID from request params first, then fall back to user's zone ID
    const zoneId = Number(req.params.zoneId) || Number(user.zoneId);
    if (!zoneId || isNaN(zoneId)) {
      return res.status(400).json({ message: 'Zone ID is required and must be a number' });
    }


    // Calculate all metrics in parallel
    const [
      efficiency,
      travelTime,
      partsAvailability,
      firstCallResolution,
      serviceReports,
      efficiencyTrend,
      serviceDistribution
    ] = await Promise.all([
      calculateTechnicianEfficiency(zoneId).catch(e => {
        return 0;
      }),
      calculateAverageTravelTime(zoneId).catch(e => {
        return { hours: 0, minutes: 0, change: 0, isPositive: true };
      }),
      calculatePartsAvailability(zoneId).catch(e => {
        return 0;
      }),
      calculateFirstCallResolutionRate(zoneId).catch(e => {
        return 0;
      }),
      getRecentServiceReports(zoneId).catch(e => {
        return [];
      }),
      getEfficiencyTrend(zoneId).catch(e => {
        return [];
      }),
      getServiceDistribution(zoneId).catch(e => {
        return [];
      })
    ]);

    const responseData = {
      kpis: {
        efficiency: Math.round(efficiency * 10) / 10, // 1 decimal place
        travelTime: Math.round((travelTime.hours * 60 + travelTime.minutes) * 10) / 10,
        partsAvailability: Math.round(partsAvailability * 10) / 10,
        firstCallResolution: Math.round(firstCallResolution * 10) / 10,
      },
      serviceReports,
      efficiencyTrend,
      serviceDistribution
    };

    res.json(serializeBigInts(responseData));
  } catch (error: any) {
    res.status(500).json({
      message: 'Error fetching FSA data',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

// Helper function to get recent service reports
async function getRecentServiceReports(zoneId: number) {
  return await prisma.ticket.findMany({
    where: {
      customer: {
        serviceZone: { id: zoneId }
      },
      status: { in: ['CLOSED', 'RESOLVED'] }
    },
    select: {
      id: true,
      title: true,
      assignedTo: {
        select: { name: true }
      },
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          companyName: true,
          address: true
        }
      },
      _count: true
    },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });
}

// Helper function to get efficiency trend data
async function getEfficiencyTrend(zoneId: number) {
  const result = await prisma.$queryRaw<Array<{ month: string; efficiency: string }>>`
    SELECT 
      TO_CHAR(t."updatedAt", 'Mon') as month,
      AVG(CASE 
        WHEN t.status = 'CLOSED' AND t."actualResolutionTime" IS NOT NULL 
        THEN 100 
        ELSE 0 
      END) as efficiency
    FROM "Ticket" t
    JOIN "Customer" c ON t."customerId" = c.id
    WHERE c."serviceZoneId" = ${zoneId}
      AND t."updatedAt" >= NOW() - INTERVAL '6 months'
      AND t.status IN ('CLOSED', 'RESOLVED')
    GROUP BY TO_CHAR(t."updatedAt", 'Mon'), EXTRACT(MONTH FROM t."updatedAt")
    ORDER BY EXTRACT(MONTH FROM t."updatedAt")
  `;

  return result.map((r: any) => ({
    month: r.month,
    efficiency: parseFloat(r.efficiency) || 0
  }));
}

// Helper function to get service distribution
async function getServiceDistribution(zoneId: number) {
  const result = await prisma.ticket.groupBy({
    by: ['title'],
    where: {
      customer: {
        serviceZone: { id: zoneId }
      },
      status: { in: ['CLOSED', 'RESOLVED'] },
      title: { not: '' }
    },
    _count: true
  });

  const total = result.reduce((sum: number, item: any) => sum + (item._count as number || 0), 0);

  return result.map((item: any) => ({
    name: (item.title as string) || 'Other',
    value: total > 0 ? Math.round(((item._count as number || 0) / total) * 100) : 0
  }));
}

// Get zone customers and assets for ticket creation
export const getZoneCustomersAssets = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the zone this user is assigned to
    const userWithZone = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        customer: {
          include: {
            serviceZone: true
          }
        },
        serviceZones: {
          include: {
            serviceZone: true
          }
        }
      }
    });

    if (!userWithZone) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Try to get zone from service person assignment first, then customer assignment
    let zone = null;

    // Check if user is a service person assigned to zones
    if (userWithZone.serviceZones && userWithZone.serviceZones.length > 0) {
      zone = userWithZone.serviceZones[0].serviceZone;
    }
    // Check if user is associated with a customer that has a zone
    else if (userWithZone.customer && userWithZone.customer.serviceZone) {
      zone = userWithZone.customer.serviceZone;
    }

    if (!zone) {
      return res.status(404).json({ error: 'No zone assigned to user' });
    }

    // Get customers in this zone with their contacts and assets
    const customers = await prisma.customer.findMany({
      where: { serviceZoneId: zone.id },
      select: {
        id: true,
        companyName: true,
        address: true,
        industry: true,
        contacts: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true
          }
        },
        assets: {
          select: {
            id: true,
            machineId: true,
            model: true,
            serialNo: true,
            location: true,
            status: true
          }
        }
      }
    });

    return res.json({ customers });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch zone customers and assets' });
  }
};

// Get service persons by zone
export const getZoneServicePersons = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user as ExtendedJwtPayload;

    // Get the first service zone ID from user's zoneIds array
    const zoneId = user.zoneIds?.[0];

    if (!zoneId) {
      return res.status(400).json({ error: 'User is not assigned to any service zone' });
    }

    const servicePersons = await prisma.user.findMany({
      where: {
        role: 'SERVICE_PERSON',
        // Include both active and inactive users for admin management
        serviceZones: {
          some: {
            serviceZoneId: Number(zoneId)
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        serviceZones: {
          where: {
            serviceZoneId: Number(zoneId)
          },
          include: {
            serviceZone: true
          }
        }
      }
    });

    return res.json({
      data: servicePersons,
      pagination: {
        page: 1,
        limit: servicePersons.length,
        total: servicePersons.length,
        totalPages: 1
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch service persons for the zone' });
  }
}

// Get zone status distribution
export const getZoneStatusDistribution = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the zone this user is assigned to
    const userWithZone = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        customer: {
          include: {
            serviceZone: true
          }
        },
        serviceZones: {
          include: {
            serviceZone: true
          }
        }
      }
    });

    if (!userWithZone) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get zone
    let zone = null;
    if (userWithZone.serviceZones && userWithZone.serviceZones.length > 0) {
      zone = userWithZone.serviceZones[0].serviceZone;
    } else if (userWithZone.customer && userWithZone.customer.serviceZone) {
      zone = userWithZone.customer.serviceZone;
    }

    if (!zone) {
      return res.status(404).json({ error: 'No service zone found for this user' });
    }

    // Get ticket status distribution
    const statusDistribution = await prisma.ticket.groupBy({
      by: ['status'],
      where: {
        customer: { serviceZoneId: zone.id }
      },
      _count: {
        _all: true
      }
    });

    const distribution = statusDistribution.map((item: any) => ({
      status: item.status,
      count: item._count._all
    }));

    return res.json({ distribution });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch status distribution' });
  }
};

// Get zone ticket trends
export const getZoneTicketTrends = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the zone this user is assigned to
    const userWithZone = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        customer: {
          include: {
            serviceZone: true
          }
        },
        serviceZones: {
          include: {
            serviceZone: true
          }
        }
      }
    });

    if (!userWithZone) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get zone
    let zone = null;
    if (userWithZone.serviceZones && userWithZone.serviceZones.length > 0) {
      zone = userWithZone.serviceZones[0].serviceZone;
    } else if (userWithZone.customer && userWithZone.customer.serviceZone) {
      zone = userWithZone.customer.serviceZone;
    }

    if (!zone) {
      return res.status(404).json({ error: 'No service zone found for this user' });
    }

    // Get ticket trends for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const tickets = await prisma.ticket.findMany({
      where: {
        customer: { serviceZoneId: zone.id },
        createdAt: { gte: sevenDaysAgo }
      },
      select: {
        createdAt: true,
        status: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by date
    const trendsByDate: Record<string, { date: string; open: number; resolved: number; total: number }> = {};

    tickets.forEach((ticket: any) => {
      const date = ticket.createdAt.toISOString().split('T')[0];
      if (!trendsByDate[date]) {
        trendsByDate[date] = { date, open: 0, resolved: 0, total: 0 };
      }
      trendsByDate[date].total++;
      if (ticket.status === 'OPEN') {
        trendsByDate[date].open++;
      } else if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        trendsByDate[date].resolved++;
      }
    });

    const trends = Object.values(trendsByDate);

    return res.json({ trends });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch ticket trends' });
  }
};
