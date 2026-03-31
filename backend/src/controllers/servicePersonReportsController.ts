import { Request, Response } from 'express';
import { format as formatDate, subDays, eachDayOfInterval, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { calculateTicketResolutionMinutes, BUSINESS_MINUTES_PER_DAY, calculateBusinessHoursInMinutes } from '../utils/dateUtils';
import { generatePdf, getPdfColumns } from '../utils/pdfGenerator';
import { AuthUser, AuthenticatedRequest } from '../types/express';
import prisma from '../config/db';

interface ServicePersonReport {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  serviceZones: Array<{ id: number; name: string }>;
  summary: {
    totalWorkingDays: number;
    totalHours: number;
    absentDays: number;
    autoCheckouts: number;
    activitiesLogged: number;
    averageHoursPerDay: number;
    // Performance metrics
    totalTickets: number;
    ticketsResolved: number;
    averageResolutionTimeHours: number;
    averageTravelTimeHours: number;
    averageOnsiteTimeHours: number;
    performanceScore: number;
  };
  dayWiseBreakdown: any[];
  flags: any[];
}

export const servicePersonReportsController = {
  // Get comprehensive service person reports with date range filtering
  async getServicePersonReports(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!userRole || !['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'SERVICE_PERSON', 'EXPERT_HELPDESK'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      const {
        fromDate,
        toDate,
        from,
        to,
        servicePersonIds,
        zoneId,
        status,
        search,
        page = 1,
        limit = 50,
      } = req.query;
      // Debug: Check total service persons in database
      const totalServicePersonsInDb = await prisma.user.count({
        where: { role: 'SERVICE_PERSON' }
      });
      const activeServicePersonsInDb = await prisma.user.count({
        where: { role: 'SERVICE_PERSON', isActive: true }
      });
      // Parse date range
      const startDate = (fromDate || from) ? new Date((fromDate || from) as string) : subDays(new Date(), 30);
      const endDate = (toDate || to) ? new Date((toDate || to) as string) : new Date();

      // Set to start/end of day for proper filtering
      const fromDateTime = startOfDay(startDate);
      const toDateTime = endOfDay(endDate);
      const skip = (Number(page) - 1) * Number(limit);

      // Build service person filter
      const servicePersonWhere: any = {
        role: 'SERVICE_PERSON',
        isActive: true,
      };

      // For SERVICE_PERSON role, only show their own data
      if (userRole === 'SERVICE_PERSON') {
        servicePersonWhere.id = userId;
      }

      // Zone filtering for ZONE_USER and ZONE_MANAGER
      if (userRole === 'ZONE_USER' || userRole === 'ZONE_MANAGER' || zoneId) {
        const zoneFilter = zoneId || (req.user as AuthUser)?.zoneIds?.[0];
        if (zoneFilter) {
          servicePersonWhere.serviceZones = {
            some: {
              serviceZoneId: parseInt(zoneFilter as string),
            },
          };
        }
      }

      // Service person filtering (only for ADMIN, ZONE_USER, and ZONE_MANAGER)
      if (userRole !== 'SERVICE_PERSON' && servicePersonIds && servicePersonIds !== 'all') {
        const personIds = Array.isArray(servicePersonIds)
          ? (servicePersonIds as string[]).map((id) => parseInt(id as string))
          : (servicePersonIds as string).split(',').map((id) => parseInt(id.trim()));
        servicePersonWhere.id = { in: personIds };
      }

      // Search filtering
      if (search) {
        servicePersonWhere.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Get all service persons matching criteria with their activity and attendance counts
      const servicePersons = await prisma.user.findMany({
        where: servicePersonWhere,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          serviceZones: {
            include: {
              serviceZone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip: skip,
        take: Number(limit),
      });
      // Process each service person's report
      const uniqueTicketIds = new Set<number>();
      const uniqueResolvedTicketIds = new Set<number>();

      const servicePersonReports = await Promise.all(
        servicePersons.map(async (person) => {
          // Get attendance records for the date range
          const attendanceRecords = await prisma.attendance.findMany({
            where: {
              userId: person.id,
              OR: [
                {
                  checkInAt: {
                    gte: fromDateTime,
                    lte: toDateTime,
                  },
                },
                {
                  checkOutAt: {
                    gte: fromDateTime,
                    lte: toDateTime,
                  },
                },
              ],
            },
            orderBy: {
              checkInAt: 'asc',
            },
          });
          // Get activities for the date range
          const activities = await prisma.dailyActivityLog.findMany({
            where: {
              userId: person.id,
              startTime: {
                gte: fromDateTime,
                lte: toDateTime,
              },
            },
            include: {
              ticket: {
                include: {
                  customer: true,
                },
              },
            },
            orderBy: {
              startTime: 'asc',
            },
          });
          // Get ticket performance metrics for this service person
          const ticketMetrics = await calculateServicePersonTicketMetrics(person.id, fromDateTime, toDateTime);
          
          ticketMetrics.ticketIds.forEach(id => uniqueTicketIds.add(id));
          ticketMetrics.resolvedTicketIds.forEach(id => uniqueResolvedTicketIds.add(id));

          // Process day-wise breakdown - only include Monday to Saturday (working days)
          const daysInRange = eachDayOfInterval({
            start: fromDateTime,
            end: toDateTime,
          }).filter(day => {
            const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            return dayOfWeek !== 0; // Exclude Sundays
          });

          const dayWiseBreakdown = daysInRange.map((day) => {
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);
            const dayKey = formatDate(day, 'yyyy-MM-dd');

            // Find ALL attendance records for this day (handle multiple check-ins)
            const dayAttendances = attendanceRecords.filter((att) => {
              const checkInDay = att.checkInAt ? formatDate(att.checkInAt, 'yyyy-MM-dd') : null;
              return checkInDay === dayKey;
            });

            // Find activities for this day
            const dayActivities = activities.filter((activity: any) => {
              const activityDay = formatDate(activity.startTime, 'yyyy-MM-dd');
              return activityDay === dayKey;
            });

            // Calculate total hours for the day - sum all sessions
            let totalHours = 0;
            let hasAutoCheckout = false;
            let hasOpenSession = false;

            dayAttendances.forEach(att => {
              if (att.checkInAt && att.checkOutAt) {
                const checkIn = new Date(att.checkInAt);
                const checkOut = new Date(att.checkOutAt);
                let sessionHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

                // Cap session hours at 24 hours max (prevent multi-day session issues)
                // If someone is checked in for > 24 hours, it's likely a data quality issue
                if (sessionHours > 24) {
                  sessionHours = 24;
                  hasAutoCheckout = true; // Flag as problematic
                } else if (sessionHours >= 12) {
                  // Check if this session was auto-checkout (>= 12 hours)
                  hasAutoCheckout = true;
                } else if (sessionHours < 0) {
                  // Handle negative hours (data issue)
                  return; // Skip this session
                }

                totalHours += sessionHours;
              } else if (att.checkInAt) {
                hasOpenSession = true;
              }
            });

            // Determine attendance status based on all sessions
            let attendanceStatus = 'ABSENT';
            if (dayAttendances.length > 0) {
              if (hasOpenSession) {
                attendanceStatus = 'CHECKED_IN';
              } else {
                attendanceStatus = 'CHECKED_OUT';
              }
            }

            // Check for flags
            const flags: any[] = [];
            if (hasAutoCheckout) {
              flags.push({
                type: 'AUTO_CHECKOUT',
                message: 'Auto-checked out by system',
              });
            }

            return {
              date: dayKey,
              checkInTime: dayAttendances.length > 0 ? dayAttendances[0].checkInAt : null,
              checkOutTime: dayAttendances.length > 0 ? dayAttendances[dayAttendances.length - 1].checkOutAt : null,
              totalHours,
              attendanceStatus,
              activityCount: dayActivities.length,
              flags,
              activities: dayActivities.map((act: any) => ({
                id: act.id,
                activityType: act.activityType,
                title: act.title || 'No title',
                startTime: act.startTime,
                endTime: act.endTime,
                duration: act.duration || 0,
                location: act.location || 'Location not specified',
                ticketId: act.ticketId,
                ticket: act.ticket ? {
                  id: act.ticket.id,
                  title: act.ticket.title,
                  status: act.ticket.status,
                  customer: act.ticket.customer ? {
                    companyName: act.ticket.customer.companyName || 'No company',
                  } : { companyName: 'No company' },
                } : null,
              })),
            };
          });

          // Calculate summary - count unique days with check-ins, not total records
          const uniqueCheckInDays = new Set(
            attendanceRecords
              .filter(att => att.checkInAt)
              .map(att => {
                const checkInDate = new Date(att.checkInAt!);
                return formatDate(checkInDate, 'yyyy-MM-dd');
              })
          ).size;
          const presentDays = uniqueCheckInDays;
          const absentDays = dayWiseBreakdown.length - presentDays;
          const autoCheckouts = dayWiseBreakdown.filter(
            (day) => day.flags.some((f) => f.type === 'AUTO_CHECKOUT')
          ).length;
          const totalHours = dayWiseBreakdown.reduce(
            (sum, day) => sum + (day.totalHours || 0),
            0
          );
          const activitiesLogged = dayWiseBreakdown.reduce(
            (sum, day) => sum + day.activityCount,
            0
          );

          // Check for late check-ins
          const lateCheckIns = dayWiseBreakdown.filter((day) => {
            if (!day.checkInTime) return false;
            const checkInHour = new Date(day.checkInTime).getHours();
            return checkInHour >= 10; // After 10 AM is considered late
          }).length;

          // Initialize flags array for this service person
          const servicePersonFlags: any[] = [];

          // Add late check-in flag if applicable
          if (lateCheckIns > 0) {
            servicePersonFlags.push({
              type: 'LATE',
              message: `${lateCheckIns} late check-in(s) detected`,
            });
          }

          // Calculate average hours per day (only for present days)
          const averageHoursPerDay = presentDays > 0 ? (totalHours / presentDays) : 0;

          // Construct the report for this service person
          return {
            id: person.id,
            name: person.name,
            email: person.email,
            phone: person.phone,
            serviceZones: person.serviceZones.map((sz: any) => ({
              id: sz.serviceZone.id,
              name: sz.serviceZone.name,
            })),
            dayWiseBreakdown,
            summary: {
              totalWorkingDays: presentDays,
              totalDays: dayWiseBreakdown.length,
              presentDays,
              absentDays,
              totalHours: parseFloat(totalHours.toFixed(2)),
              totalActivities: activitiesLogged,
              autoCheckouts,
              lateCheckIns,
              averageHoursPerDay: parseFloat(averageHoursPerDay.toFixed(2)),
              // Performance metrics
              totalTickets: ticketMetrics.totalTickets,
              ticketsResolved: ticketMetrics.ticketsResolved,
              averageResolutionTimeHours: ticketMetrics.averageResolutionTimeHours,
              averageTravelTimeHours: ticketMetrics.averageTravelTimeHours,
              averageOnsiteTimeHours: ticketMetrics.averageOnsiteTimeHours,
              performanceScore: ticketMetrics.performanceScore,
            },
            flags: servicePersonFlags,
          };
        })
      );

      // Get total count for pagination
      const totalCount = await prisma.user.count({
        where: servicePersonWhere,
      });

      // Return the response
      return res.json({
        success: true,
        data: {
          servicePersonReports,
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          uniqueMetrics: {
            totalTickets: uniqueTicketIds.size,
            ticketsResolved: uniqueResolvedTicketIds.size,
          }
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  // Get summary statistics for reports dashboard
  async getReportsSummary(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userRole || !['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'SERVICE_PERSON', 'EXPERT_HELPDESK'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { fromDate, toDate, zoneId } = req.query;

      // Set default date range (last 30 days)
      const endDate = toDate ? new Date(toDate as string) : new Date();
      const startDate = fromDate ? new Date(fromDate as string) : subDays(endDate, 30);

      // Build where clause based on user role and filters
      let userWhereClause: any = {};

      if (userRole === 'ZONE_USER' || userRole === 'ZONE_MANAGER') {
        const zoneUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { serviceZones: true },
        });

        if (!zoneUser?.serviceZones?.length) {
          return res.status(403).json({ error: 'No zones assigned to user' });
        }

        userWhereClause.serviceZones = {
          some: {
            serviceZoneId: { in: zoneUser.serviceZones.map(z => z.serviceZoneId) }
          }
        };
      } else if (userRole === 'SERVICE_PERSON') {
        userWhereClause.id = userId;
      }

      if (zoneId) {
        userWhereClause.serviceZones = {
          some: { serviceZoneId: parseInt(zoneId as string) }
        };
      }

      // Get total service persons count
      const totalServicePersons = await prisma.user.count({
        where: {
          role: 'SERVICE_PERSON',
          ...userWhereClause,
        },
      });

      // Get active service persons (those with attendance in date range)
      const activeServicePersons = await prisma.user.count({
        where: {
          role: 'SERVICE_PERSON',
          ...userWhereClause,
          attendance: {
            some: {
              checkInAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
      });

      // Get total working hours - calculate manually with 24h cap (matching individual reports)
      const allAttendanceForHours = await prisma.attendance.findMany({
        where: {
          user: {
            role: 'SERVICE_PERSON',
            ...userWhereClause,
          },
          checkInAt: {
            gte: startDate,
            lte: endDate,
          },
          checkOutAt: { not: null },
        },
        select: {
          checkInAt: true,
          checkOutAt: true,
          userId: true,
        },
      });

      // Calculate hours with 24h cap per session (prevent multi-day session inflation)
      let totalHoursSum = 0;
      allAttendanceForHours.forEach(att => {
        if (att.checkInAt && att.checkOutAt) {
          const checkIn = new Date(att.checkInAt);
          const checkOut = new Date(att.checkOutAt);
          let sessionHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

          // Apply 24h cap (same as individual reports)
          if (sessionHours > 24) {
            sessionHours = 24;
          } else if (sessionHours < 0) {
            sessionHours = 0; // Skip negative hours
          }

          totalHoursSum += sessionHours;
        }
      });

      const totalHoursResult = { _sum: { totalHours: totalHoursSum } };

      // Get total activities logged
      const totalActivities = await prisma.dailyActivityLog.count({
        where: {
          user: {
            role: 'SERVICE_PERSON',
            ...userWhereClause,
          },
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get total check-ins (attendance records in date range)
      const totalCheckIns = await prisma.attendance.count({
        where: {
          user: {
            role: 'SERVICE_PERSON',
            ...userWhereClause,
          },
          checkInAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Calculate total absentees (service persons with no attendance in date range)
      const totalAbsentees = totalServicePersons - activeServicePersons;

      // Get most active user (user with most activities in date range)
      const mostActiveUserResult = await prisma.dailyActivityLog.groupBy({
        by: ['userId'],
        where: {
          user: {
            role: 'SERVICE_PERSON',
            ...userWhereClause,
          },
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 1,
      });

      let mostActiveUser = null;
      if (mostActiveUserResult.length > 0) {
        const mostActiveUserId = mostActiveUserResult[0].userId;
        const activityCount = mostActiveUserResult[0]._count.id;

        const userDetails = await prisma.user.findUnique({
          where: { id: mostActiveUserId },
          select: {
            name: true,
            email: true,
          },
        });

        if (userDetails) {
          mostActiveUser = {
            name: userDetails.name,
            email: userDetails.email,
            activityCount,
          };
        }
      }

      // Calculate average hours per person per day - use SAME records as hours calculation
      // (only closed sessions with checkOutAt, matching individual reports)
      const allAttendanceRecords = allAttendanceForHours; // Reuse the same query results

      // Count unique WORKING days per person (Monday-Saturday only, exclude Sundays)
      const userPresentDays = new Map<number, Set<string>>();
      allAttendanceRecords.forEach(att => {
        if (att.checkInAt) {
          const checkInDate = new Date(att.checkInAt);
          const dayOfWeek = checkInDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

          // Skip Sundays (matching individual report logic)
          if (dayOfWeek === 0) {
            return; // Skip this record
          }

          const dateKey = formatDate(att.checkInAt, 'yyyy-MM-dd');
          if (!userPresentDays.has(att.userId)) {
            userPresentDays.set(att.userId, new Set());
          }
          userPresentDays.get(att.userId)!.add(dateKey);
        }
      });

      // Sum unique days across all persons
      let totalUniquePresentDays = 0;
      userPresentDays.forEach(daysSet => {
        totalUniquePresentDays += daysSet.size;
      });

      const averageHoursPerDay = totalUniquePresentDays > 0
        ? Number((Number(totalHoursResult._sum.totalHours || 0) / totalUniquePresentDays).toFixed(2))
        : 0;

      res.json({
        success: true,
        data: {
          totalCheckIns,
          totalAbsentees,
          totalServicePersons,
          averageHoursPerDay,
          totalActivitiesLogged: totalActivities,
          mostActiveUser,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get service persons list for filter dropdown
  async getServicePersons(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userRole || !['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'SERVICE_PERSON', 'EXPERT_HELPDESK'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Build where clause based on user role
      let whereClause: any = { role: 'SERVICE_PERSON' };

      if (userRole === 'ZONE_USER' || userRole === 'ZONE_MANAGER') {
        const zoneUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { serviceZones: true },
        });

        if (!zoneUser?.serviceZones?.length) {
          return res.status(403).json({ error: 'No zones assigned to user' });
        }

        whereClause.serviceZones = {
          some: {
            serviceZoneId: { in: zoneUser.serviceZones.map(z => z.serviceZoneId) }
          }
        };
      } else if (userRole === 'SERVICE_PERSON') {
        whereClause.id = userId;
      }

      const servicePersons = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          serviceZones: {
            include: {
              serviceZone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Transform the data to include zone names
      const transformedServicePersons = servicePersons.map(person => ({
        id: person.id,
        name: person.name,
        email: person.email,
        zones: person.serviceZones.map(sz => ({
          id: sz.serviceZone.id,
          name: sz.serviceZone.name,
        })),
      }));

      res.json({
        success: true,
        data: transformedServicePersons,
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get service zones for filter dropdown
  async getServiceZones(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userRole || !['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'SERVICE_PERSON', 'EXPERT_HELPDESK'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      let whereClause: any = {};

      if (userRole === 'ZONE_USER' || userRole === 'ZONE_MANAGER') {
        const zoneUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { serviceZones: true },
        });

        if (!zoneUser?.serviceZones?.length) {
          return res.status(403).json({ error: 'No zones assigned to user' });
        }

        whereClause.id = { in: zoneUser.serviceZones.map(z => z.serviceZoneId) };
      } else if (userRole === 'SERVICE_PERSON') {
        // Service person can only see their assigned zones
        const servicePerson = await prisma.user.findUnique({
          where: { id: userId },
          include: { serviceZones: true },
        });

        if (!servicePerson?.serviceZones?.length) {
          return res.json({ success: true, data: [] });
        }

        whereClause.id = { in: servicePerson.serviceZones.map(z => z.serviceZoneId) };
      }

      const serviceZones = await prisma.serviceZone.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: serviceZones,
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Export service person reports (handles both performance and attendance based on reportType query param)
  async exportServicePersonReports(req: Request, res: Response) {
    try {
      const { reportType = 'performance' } = req.query;

      // Route to appropriate export function based on reportType
      if (reportType === 'attendance') {
        return await servicePersonReportsController.exportServicePersonAttendanceReports(req, res);
      } else {
        return await servicePersonReportsController.exportServicePersonPerformanceReports(req, res);
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Export service person performance reports to PDF
  async exportServicePersonPerformanceReports(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userRole || !['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'SERVICE_PERSON', 'EXPERT_HELPDESK'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { fromDate, toDate, servicePersonIds, zoneId, status, search, format = 'pdf' } = req.query;

      // Parse date range
      const startDate = fromDate ? new Date(fromDate as string) : subDays(new Date(), 30);
      const endDate = toDate ? new Date(toDate as string) : new Date();

      const fromDateTime = startOfDay(startDate);
      const toDateTime = endOfDay(endDate);

      // Build where clause for filtering
      const servicePersonWhere: any = {
        role: 'SERVICE_PERSON',
        isActive: true,
      };

      // For SERVICE_PERSON role, only show their own data
      if (userRole === 'SERVICE_PERSON') {
        servicePersonWhere.id = userId;
      }

      // Zone filtering for ZONE_USER and ZONE_MANAGER
      if (userRole === 'ZONE_USER' || userRole === 'ZONE_MANAGER' || zoneId) {
        const zoneFilter = zoneId || (req.user as AuthUser)?.zoneIds?.[0];
        if (zoneFilter) {
          servicePersonWhere.serviceZones = {
            some: {
              serviceZoneId: parseInt(zoneFilter as string),
            },
          };
        }
      }

      // Service person filtering (only for ADMIN, ZONE_USER, and ZONE_MANAGER)
      if (userRole !== 'SERVICE_PERSON' && servicePersonIds && servicePersonIds !== 'all') {
        const personIds = Array.isArray(servicePersonIds)
          ? servicePersonIds.map(id => parseInt(id as string))
          : (servicePersonIds as string).split(',').map(id => parseInt(id.trim()));
        servicePersonWhere.id = { in: personIds };
      }

      // Search filtering
      if (search) {
        servicePersonWhere.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Get all service persons matching criteria
      const servicePersons = await prisma.user.findMany({
        where: servicePersonWhere,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          serviceZones: {
            include: {
              serviceZone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Process each service person to get performance summary data
      const performanceData = await Promise.all(
        servicePersons.map(async (person) => {
          // Get attendance records for the date range
          const attendanceRecords = await prisma.attendance.findMany({
            where: {
              userId: person.id,
              OR: [
                {
                  checkInAt: {
                    gte: fromDateTime,
                    lte: toDateTime,
                  },
                },
                {
                  checkOutAt: {
                    gte: fromDateTime,
                    lte: toDateTime,
                  },
                },
              ],
            },
            orderBy: {
              checkInAt: 'asc',
            },
          });

          // Get activities for the date range
          const activities = await prisma.dailyActivityLog.findMany({
            where: {
              userId: person.id,
              startTime: {
                gte: fromDateTime,
                lte: toDateTime,
              },
            },
            orderBy: {
              startTime: 'asc',
            },
          });

          // Get ticket performance metrics
          const ticketMetrics = await calculateServicePersonTicketMetrics(person.id, fromDateTime, toDateTime);

          // Calculate summary metrics - count unique days with check-ins, not total records
          const uniqueCheckInDays = new Set(
            attendanceRecords
              .filter(att => att.checkInAt)
              .map(att => {
                const checkInDate = new Date(att.checkInAt!);
                return formatDate(checkInDate, 'yyyy-MM-dd');
              })
          ).size;
          const presentDays = uniqueCheckInDays;
          const totalHours = attendanceRecords.reduce((sum, att) => sum + (Number(att.totalHours) || 0), 0);
          const activitiesLogged = activities.length;
          const autoCheckouts = attendanceRecords.filter(att => att.notes?.includes('Auto-checkout')).length;
          const averageHoursPerDay = presentDays > 0 ? (totalHours / presentDays) : 0;

          // Calculate flags
          const flags: any[] = [];
          const lateCheckIns = attendanceRecords.filter(att => {
            if (!att.checkInAt) return false;
            const checkInHour = new Date(att.checkInAt).getHours();
            return checkInHour >= 10;
          }).length;

          if (lateCheckIns > 0) {
            flags.push({ type: 'LATE', message: `${lateCheckIns} late check-in(s)` });
          }
          if (autoCheckouts > 0) {
            flags.push({ type: 'AUTO_CHECKOUT', message: `${autoCheckouts} auto checkout(s)` });
          }

          return {
            name: person.name,
            email: person.email,
            zones: person.serviceZones.map(sz => sz.serviceZone.name),
            summary: {
              totalWorkingDays: presentDays,
              presentDays,
              totalHours: parseFloat(totalHours.toFixed(2)),
              totalTickets: ticketMetrics.totalTickets,
              ticketsResolved: ticketMetrics.ticketsResolved,
              averageResolutionTimeHours: ticketMetrics.averageResolutionTimeHours,
              averageTravelTimeHours: ticketMetrics.averageTravelTimeHours,
              averageOnsiteTimeHours: ticketMetrics.averageOnsiteTimeHours,
              performanceScore: ticketMetrics.performanceScore,
              totalActivities: activitiesLogged,
              autoCheckouts,
              averageHoursPerDay: parseFloat(averageHoursPerDay.toFixed(2)),
            },
            flags,
          };
        })
      );

      const filters = {
        from: fromDate as string,
        to: toDate as string,
        reportType: 'service-person-performance'
      };

      // Get the appropriate columns for the report type
      const columns = getPdfColumns('service-person-performance');

      // Generate PDF or Excel based on format
      if (format === 'excel') {
        const { generateExcel, getExcelColumns } = await import('../utils/excelGenerator');
        const excelColumns = getExcelColumns('service-person-performance');

        if (!performanceData || !Array.isArray(performanceData)) {
          throw new Error('Performance data is undefined or not an array');
        }

        await generateExcel(res, performanceData, excelColumns, 'Service Person Performance Report', filters);
      } else {
        await generatePdf(res, performanceData, columns, 'Service Person Performance Report', filters);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate Excel report', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  // Export service person attendance reports to PDF/Excel
  async exportServicePersonAttendanceReports(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userRole || !['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'SERVICE_PERSON'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { fromDate, toDate, servicePersonIds, zoneId, status, search, format = 'pdf' } = req.query;

      // Parse date range
      const startDate = fromDate ? new Date(fromDate as string) : subDays(new Date(), 30);
      const endDate = toDate ? new Date(toDate as string) : new Date();

      const fromDateTime = startOfDay(startDate);
      const toDateTime = endOfDay(endDate);

      // Build where clause for filtering (same as performance report)
      const servicePersonWhere: any = {
        role: 'SERVICE_PERSON',
        isActive: true,
      };

      if (userRole === 'SERVICE_PERSON') {
        servicePersonWhere.id = userId;
      }

      if (userRole === 'ZONE_USER' || zoneId) {
        const zoneFilter = zoneId || (req.user as AuthUser)?.zoneIds?.[0];
        if (zoneFilter) {
          servicePersonWhere.serviceZones = {
            some: {
              serviceZoneId: parseInt(zoneFilter as string),
            },
          };
        }
      }

      if (userRole !== 'SERVICE_PERSON' && servicePersonIds && servicePersonIds !== 'all') {
        const personIds = Array.isArray(servicePersonIds)
          ? servicePersonIds.map(id => parseInt(id as string))
          : (servicePersonIds as string).split(',').map(id => parseInt(id.trim()));
        servicePersonWhere.id = { in: personIds };
      }

      if (search) {
        servicePersonWhere.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Get all service persons matching criteria
      const servicePersons = await prisma.user.findMany({
        where: servicePersonWhere,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          serviceZones: {
            include: {
              serviceZone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Process each service person to get attendance summary data
      const attendanceData = await Promise.all(
        servicePersons.map(async (person) => {
          // Get attendance records for the date range
          const attendanceRecords = await prisma.attendance.findMany({
            where: {
              userId: person.id,
              OR: [
                {
                  checkInAt: {
                    gte: fromDateTime,
                    lte: toDateTime,
                  },
                },
                {
                  checkOutAt: {
                    gte: fromDateTime,
                    lte: toDateTime,
                  },
                },
              ],
            },
            orderBy: {
              checkInAt: 'asc',
            },
          });

          // Get activities for the date range
          const activities = await prisma.dailyActivityLog.findMany({
            where: {
              userId: person.id,
              startTime: {
                gte: fromDateTime,
                lte: toDateTime,
              },
            },
            orderBy: {
              startTime: 'asc',
            },
          });

          // Generate date range for analysis - exclude Sundays (working days only)
          const daysInRange = eachDayOfInterval({
            start: fromDateTime,
            end: toDateTime,
          }).filter(day => {
            const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            return dayOfWeek !== 0; // Exclude Sundays
          });

          // Calculate summary metrics - count unique days with check-ins, not total records
          const uniqueCheckInDays = new Set(
            attendanceRecords
              .filter(att => att.checkInAt)
              .map(att => {
                const checkInDate = new Date(att.checkInAt!);
                const dayOfWeek = checkInDate.getDay();
                // Only count Monday-Saturday
                if (dayOfWeek === 0) return null;
                return formatDate(checkInDate, 'yyyy-MM-dd');
              })
              .filter(date => date !== null)
          ).size;
          const presentDays = uniqueCheckInDays;
          const absentDays = daysInRange.length - presentDays;
          const totalHours = attendanceRecords.reduce((sum, att) => sum + (Number(att.totalHours) || 0), 0);
          const activitiesLogged = activities.length;
          const autoCheckouts = attendanceRecords.filter(att => att.notes?.includes('Auto-checkout')).length;
          const averageHoursPerDay = presentDays > 0 ? (totalHours / presentDays) : 0;

          // Calculate flags
          const flags: any[] = [];
          const lateCheckIns = attendanceRecords.filter(att => {
            if (!att.checkInAt) return false;
            const checkInHour = new Date(att.checkInAt).getHours();
            return checkInHour >= 10;
          }).length;

          if (lateCheckIns > 0) {
            flags.push({ type: 'LATE', message: `${lateCheckIns} late check-in(s)` });
          }
          if (autoCheckouts > 0) {
            flags.push({ type: 'AUTO_CHECKOUT', message: `${autoCheckouts} auto checkout(s)` });
          }
          if (absentDays > 0) {
            flags.push({ type: 'ABSENT', message: `${absentDays} absent day(s)` });
          }

          return {
            name: person.name,
            email: person.email,
            zones: person.serviceZones.map(sz => sz.serviceZone.name),
            summary: {
              totalWorkingDays: presentDays,
              presentDays,
              absentDays,
              totalHours: parseFloat(totalHours.toFixed(2)),
              averageHoursPerDay: parseFloat(averageHoursPerDay.toFixed(2)),
              totalActivities: activitiesLogged,
              autoCheckouts,
            },
            flags,
          };
        })
      );

      const filters = {
        from: fromDate as string,
        to: toDate as string,
        reportType: 'service-person-attendance'
      };

      // Get the appropriate columns for the report type
      const columns = getPdfColumns('service-person-attendance');

      // Generate PDF or Excel based on format
      if (format === 'excel') {
        const { generateExcel, getExcelColumns } = await import('../utils/excelGenerator');
        const excelColumns = getExcelColumns('service-person-attendance');
        await generateExcel(res, attendanceData, excelColumns, 'Service Person Attendance Report', filters);
      } else {
        await generatePdf(res, attendanceData, columns, 'Service Person Attendance Report', filters);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      res.status(500).json({ error: 'Failed to generate attendance report', details: errorMessage });
    }
  },

  // Export detailed individual service person report with daily breakdown
  async exportDetailedPersonReport(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { fromDate, toDate, servicePersonId, format: exportFormat = 'pdf' } = req.query;

      if (!servicePersonId) {
        return res.status(400).json({ error: 'servicePersonId is required' });
      }

      // Parse date range
      const startDate = fromDate ? new Date(fromDate as string) : subDays(new Date(), 30);
      const endDate = toDate ? new Date(toDate as string) : new Date();

      const fromDateTime = startOfDay(startDate);
      const toDateTime = endOfDay(endDate);

      // Get the full report for this person (includes dayWiseBreakdown)
      const person = await prisma.user.findUnique({
        where: { id: parseInt(servicePersonId as string) },
        include: {
          serviceZones: {
            include: {
              serviceZone: true
            }
          }
        }
      });

      if (!person) {
        return res.status(404).json({ error: 'Service person not found' });
      }

      // Get attendance records
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          userId: person.id,
          OR: [
            { checkInAt: { gte: fromDateTime, lte: toDateTime } },
            { checkOutAt: { gte: fromDateTime, lte: toDateTime } }
          ],
        },
        orderBy: { checkInAt: 'asc' },
      });

      // Get activities
      const activities = await prisma.dailyActivityLog.findMany({
        where: {
          userId: person.id,
          startTime: { gte: fromDateTime, lte: toDateTime },
        },
        orderBy: { startTime: 'asc' },
      });

      // Build day-wise breakdown
      const daysInRange = eachDayOfInterval({ start: fromDateTime, end: toDateTime })
        .filter(day => day.getDay() !== 0); // Exclude Sundays

      const dayWiseData = daysInRange.map((day) => {
        const dayKey = formatDate(day, 'yyyy-MM-dd');

        const dayAttendances = attendanceRecords.filter(att => {
          const checkInDay = att.checkInAt ? formatDate(att.checkInAt, 'yyyy-MM-dd') : null;
          return checkInDay === dayKey;
        });

        const dayActivities = activities.filter(activity => {
          const activityDay = formatDate(activity.startTime, 'yyyy-MM-dd');
          return activityDay === dayKey;
        });

        // Calculate hours (sum all sessions, cap at 24h per session)
        let totalHours = 0;
        let hasAutoCheckout = false;
        dayAttendances.forEach(att => {
          if (att.checkInAt && att.checkOutAt) {
            let sessionHours = (new Date(att.checkOutAt).getTime() - new Date(att.checkInAt).getTime()) / (1000 * 60 * 60);
            if (sessionHours > 24) sessionHours = 24;
            totalHours += sessionHours;
            if (sessionHours >= 12) hasAutoCheckout = true;
          }
        });

        const checkInTime = dayAttendances[0]?.checkInAt || null;
        const checkOutTime = dayAttendances[dayAttendances.length - 1]?.checkOutAt || null;
        const status = dayAttendances.length > 0 ? (checkOutTime ? 'Present' : 'Checked In') : 'Absent';

        return {
          date: dayKey,
          dayName: formatDate(day, 'EEE'),
          checkIn: checkInTime ? formatDate(new Date(checkInTime), 'HH:mm') : '-',
          checkOut: checkOutTime ? formatDate(new Date(checkOutTime), 'HH:mm') : '-',
          hours: totalHours.toFixed(1),
          status,
          activities: dayActivities.length,
          activitiesDetail: dayActivities.map(a => ({
            type: a.activityType,
            title: a.title || 'No title',
            time: formatDate(new Date(a.startTime), 'HH:mm')
          })),
          flags: hasAutoCheckout ? 'Auto-checkout' : ''
        };
      });

      const reportData = {
        person: {
          name: person.name || 'Unknown',
          email: person.email,
          phone: person.phone || '',
          zones: person.serviceZones.map(sz => sz.serviceZone.name).join(', ')
        },
        period: {
          from: formatDate(fromDateTime, 'MMM dd, yyyy'),
          to: formatDate(toDateTime, 'MMM dd, yyyy')
        },
        summary: {
          totalDays: daysInRange.length,
          presentDays: dayWiseData.filter(d => d.status !== 'Absent').length,
          totalHours: dayWiseData.reduce((sum, d) => sum + parseFloat(d.hours), 0).toFixed(1),
          totalActivities: dayWiseData.reduce((sum, d) => sum + d.activities, 0)
        },
        dailyBreakdown: dayWiseData
      };

      // Generate detailed PDF or Excel
      if (exportFormat === 'excel') {
        const { generateDetailedPersonExcel } = await import('../utils/detailedExportGenerator');
        await generateDetailedPersonExcel(res, reportData);
      } else {
        const { generateDetailedPersonPdf } = await import('../utils/detailedExportGenerator');
        await generateDetailedPersonPdf(res, reportData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to generate detailed report', details: errorMessage });
    }
  },

  // Get detailed activity logs for a specific service person and date
  async getActivityDetails(req: Request, res: Response) {
    const authReq = req as unknown as AuthenticatedRequest;
    try {
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userRole || !['ADMIN', 'ZONE_USER'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { servicePersonId, date } = req.params;

      const targetDate = new Date(date);
      const startOfTargetDate = startOfDay(targetDate);
      const endOfTargetDate = endOfDay(targetDate);

      // Get service person details
      const servicePerson = await prisma.user.findUnique({
        where: { id: parseInt(servicePersonId) },
        select: {
          id: true,
          name: true,
          email: true,
          serviceZones: {
            include: {
              serviceZone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!servicePerson) {
        return res.status(404).json({ error: 'Service person not found' });
      }

      // Get attendance record for the date
      const attendance = await prisma.attendance.findFirst({
        where: {
          userId: parseInt(servicePersonId),
          checkInAt: {
            gte: startOfTargetDate,
            lte: endOfTargetDate,
          },
        },
      });

      // Get activity logs for the date
      const activities = await prisma.dailyActivityLog.findMany({
        where: {
          userId: parseInt(servicePersonId),
          startTime: {
            gte: startOfTargetDate,
            lte: endOfTargetDate,
          },
        },
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              customer: {
                select: {
                  companyName: true,
                },
              },
            },
          },
        },
        orderBy: { startTime: 'asc' },
      });

      res.json({
        success: true,
        data: {
          servicePerson,
          date: formatDate(targetDate, 'yyyy-MM-dd'),
          attendance,
          activities,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

// Helper function to calculate comprehensive ticket performance metrics for a service person
async function calculateServicePersonTicketMetrics(
  servicePersonId: number,
  fromDate: Date,
  toDate: Date
): Promise<{
  totalTickets: number;
  ticketsResolved: number;
  averageResolutionTimeHours: number;
  averageTravelTimeHours: number;
  averageOnsiteTimeHours: number;
  performanceScore: number;
  ticketIds: number[];
  resolvedTicketIds: number[];
}> {
  try {
    // Get all tickets assigned to this service person in the date range
    const ticketsDb = await prisma.ticket.findMany({
      where: {
        OR: [
          { assignedToId: servicePersonId },
          { subOwnerId: servicePersonId },
          { relatedMachineIds: { contains: servicePersonId.toString() } },
        ],
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        statusHistory: {
          orderBy: {
            changedAt: 'asc',
          },
        },
      },
    });

    // Exact match filter to avoid "12" matching "123" inside stringified JSON
    const tickets = ticketsDb.filter(t => {
      if (t.assignedToId === servicePersonId || t.subOwnerId === servicePersonId) return true;
      if (t.relatedMachineIds) {
        try {
          const meta = JSON.parse(t.relatedMachineIds);
          if (meta.allAssigneeIds && Array.isArray(meta.allAssigneeIds)) {
            return meta.allAssigneeIds.includes(servicePersonId);
          }
        } catch { return false; }
      }
      return false;
    });

    const totalTickets = tickets.length;
    const resolvedTicketsItems = tickets.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED');
    const ticketsResolved = resolvedTicketsItems.length;

    if (totalTickets === 0) {
      return {
        totalTickets: 0,
        ticketsResolved: 0,
        averageResolutionTimeHours: 0,
        averageTravelTimeHours: 0,
        averageOnsiteTimeHours: 0,
        performanceScore: 0,
        ticketIds: [],
        resolvedTicketIds: [],
      };
    }

    // Calculate average resolution time (creation to CLOSED/RESOLVED)
    const resolutionTimes: number[] = [];
    const travelTimes: number[] = [];
    const onsiteTimes: number[] = [];

    for (const ticket of tickets) {
      // Parse imported metadata
      let importedMetadata: any = null;
      if (ticket.relatedMachineIds) {
        try {
          importedMetadata = JSON.parse(ticket.relatedMachineIds);
        } catch { /* ignore */ }
      }

      // Resolution time calculation using unified logic
      if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
        const resMins = calculateTicketResolutionMinutes(
          ticket.actualResolutionTime,
          ticket.relatedMachineIds,
          ticket.createdAt,
          ticket.updatedAt,
          ticket.visitCompletedDate
        );
        if (resMins > 0) resolutionTimes.push(resMins);
      }

      // Travel and onsite time calculations from status history
      const statusHistory = ticket.statusHistory || [];
      let travelTimeFromHistory = 0;
      let onsiteTimeFromHistory = 0;

      if (statusHistory.length > 0) {
        const goingStart = statusHistory.find(h => h.status === 'ONSITE_VISIT_STARTED');
        const goingEnd = statusHistory.find(h => h.status === 'ONSITE_VISIT_REACHED');
        const returnStart = statusHistory.find(h => h.status === 'ONSITE_VISIT_RESOLVED');
        const returnEnd = statusHistory.find(h => h.status === 'ONSITE_VISIT_COMPLETED');

        if (goingStart && goingEnd && goingStart.changedAt < goingEnd.changedAt) {
          travelTimeFromHistory += differenceInMinutes(new Date(goingEnd.changedAt), new Date(goingStart.changedAt));
        }
        if (returnStart && returnEnd && returnStart.changedAt < returnEnd.changedAt) {
          travelTimeFromHistory += differenceInMinutes(new Date(returnEnd.changedAt), new Date(returnStart.changedAt));
        }

        const onsiteStart = statusHistory.find(h => h.status === 'ONSITE_VISIT_IN_PROGRESS');
        const onsiteEnd = statusHistory.find(h => h.status === 'ONSITE_VISIT_RESOLVED' || h.status === 'RESOLVED' || h.status === 'CLOSED');
        if (onsiteStart && onsiteEnd && onsiteStart.changedAt < onsiteEnd.changedAt) {
          onsiteTimeFromHistory = differenceInMinutes(new Date(onsiteEnd.changedAt), new Date(onsiteStart.changedAt));
        }
      }

      // Prioritize imported metadata if history is missing or zero
      const finalTravelTime = travelTimeFromHistory > 0 ? travelTimeFromHistory : (importedMetadata?.travelHourMinutes || 0);
      const finalOnsiteTime = onsiteTimeFromHistory > 0 ? onsiteTimeFromHistory : (importedMetadata?.workHourMinutes || 0);

      if (finalTravelTime > 0) travelTimes.push(finalTravelTime);
      if (finalOnsiteTime > 0) onsiteTimes.push(finalOnsiteTime);
    }

    // Calculate averages in hours (rounded to 1 decimal place)
    const averageResolutionTimeHours = resolutionTimes.length > 0
      ? Math.round((resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length) / 60 * 10) / 10
      : 0;

    const averageTravelTimeHours = travelTimes.length > 0
      ? Math.round((travelTimes.reduce((sum, time) => sum + time, 0) / travelTimes.length) / 60 * 10) / 10
      : 0;

    const averageOnsiteTimeHours = onsiteTimes.length > 0
      ? Math.round((onsiteTimes.reduce((sum, time) => sum + time, 0) / onsiteTimes.length) / 60 * 10) / 10
      : 0;

    // Calculate performance score (0-100)
    const resolutionRate = totalTickets > 0 ? (ticketsResolved / totalTickets) * 100 : 0;

    // Speed score: scaling 8h to 72h
    // <= 8 hours: 100%
    // > 72 hours: drops to 0%
    const speedScore = averageResolutionTimeHours > 0
      ? Math.max(0, Math.min(100, 100 - (averageResolutionTimeHours - 8) * (100 / 64)))
      : (totalTickets > 0 ? 100 : 0); // If no time data exists, assume good speed rather than penalizing

    const totalWorkTimeHours = averageTravelTimeHours + averageOnsiteTimeHours;
    let performanceScore = 0;

    if (totalWorkTimeHours > 0) {
      // Efficiency score: scaling 4h to 16h
      // <= 4 hours: 100%
      // > 16 hours: drops to 0%
      const efficiencyScore = Math.max(0, Math.min(100, 100 - (totalWorkTimeHours - 4) * (100 / 12)));
      
      // Weights: Resolution (40%), Speed (30%), Efficiency/Time (30%)
      performanceScore = Math.round((resolutionRate * 0.4) + (speedScore * 0.3) + (efficiencyScore * 0.3));
    } else {
      // If Travel/Onsite data is entirely missing, don't penalize. Reallocate weight.
      // Weights: Resolution (60%), Speed (40%)
      performanceScore = Math.round((resolutionRate * 0.6) + (speedScore * 0.4));
    }

    return {
      totalTickets,
      ticketsResolved,
      averageResolutionTimeHours,
      averageTravelTimeHours,
      averageOnsiteTimeHours,
      performanceScore: Math.max(0, Math.min(100, performanceScore)),
      ticketIds: tickets.map((t: { id: number }) => t.id),
      resolvedTicketIds: resolvedTicketsItems.map((t: { id: number }) => t.id),
    };
  } catch (error) {
    return {
      totalTickets: 0,
      ticketsResolved: 0,
      averageResolutionTimeHours: 0,
      averageTravelTimeHours: 0,
      averageOnsiteTimeHours: 0,
      performanceScore: 0,
      ticketIds: [],
      resolvedTicketIds: [],
    };
  }
}

