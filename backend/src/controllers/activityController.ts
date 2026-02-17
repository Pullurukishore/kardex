import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';

// Type alias for backward compatibility
type AuthRequest = AuthenticatedRequest;

/**
 * ActivityController - Handles all activity/audit logging and retrieval
 * Logs all important actions (create, update, delete, status changes) to AuditLog table
 */
export class ActivityController {
  /**
   * Get real-time activity stream (admin only)
   */
  static async getRealtimeActivities(req: AuthRequest, res: Response) {
    try {
      const { since } = req.query;
      const sinceDate = since ? new Date(since as string) : new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes

      const activities = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: sinceDate }
        },
        include: {
          performedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });

      res.json({
        success: true,
        activities: activities.map((activity) => ({
          ...activity,
          userName: activity.performedBy?.name || 'System',
          userEmail: activity.performedBy?.email
        })),
        count: activities.length,
        timestamp: new Date().toISOString()
      });
      return;
    } catch (error) {
      logger.error('Get realtime activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch realtime activities'
      });
      return;
    }
  }

  /**
   * Get activity heatmap data (admin only)
   */
  static async getActivityHeatmap(req: AuthRequest, res: Response) {
    try {
      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      const heatmapData = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', "createdAt") as date,
          EXTRACT(hour FROM "createdAt")::int as hour,
          COUNT(*)::int as activity_count
        FROM "AuditLog" 
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE_TRUNC('day', "createdAt"), EXTRACT(hour FROM "createdAt")
        ORDER BY date DESC, hour ASC
      `;

      res.json({
        success: true,
        heatmap: heatmapData,
        period: {
          days: parseInt(days as string),
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        }
      });
      return;
    } catch (error) {
      logger.error('Get activity heatmap error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activity heatmap'
      });
      return;
    }
  }
  /**
   * Get activity logs for a specific offer
   */
  static async getOfferActivities(req: AuthRequest, res: Response) {
    try {
      const { offerReferenceNumber, page = 1, limit = 50 } = req.query;

      if (!offerReferenceNumber || typeof offerReferenceNumber !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'A valid offer reference number is required.',
        });
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      // Get the offer to extract offerId
      const offer = await prisma.offer.findUnique({
        where: { offerReferenceNumber },
        select: { id: true }
      });

      if (!offer) {
        res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
        return;
      }

      const [activities, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: {
            offerId: offer.id
          },
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            User_AuditLog_userIdToUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take
        }),
        prisma.auditLog.count({
          where: {
            offerId: offer.id
          }
        })
      ]);

      res.json({
        success: true,
        activities: activities.map((activity) => {
          const user = activity.performedBy || (activity as any).User_AuditLog_userIdToUser;
          return {
            ...activity,
            performedBy: user ? {
              id: user.id,
              name: user.name,
              email: user.email
            } : null
          };
        }),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
      return;
    } catch (error) {
      logger.error('Get offer activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activities'
      });
      return;
    }
  }

  /**
   * Get all activities (admin only) with advanced filtering and analytics
   */
  static async getAllActivities(req: AuthRequest, res: Response) {
    try {
      const {
        entityType,
        action,
        userId,
        search,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        groupBy,
        timeframe = '7d' // 1d, 7d, 30d, 90d, 1y
      } = req.query;

      // Build where clause
      const where: any = {};

      // Timeframe filter (base time range)
      if (timeframe && !startDate && !endDate) {
        const now = new Date();
        let timeframeStart: Date;

        switch (timeframe) {
          case '1d':
            timeframeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            timeframeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            timeframeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case '1y':
            timeframeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        where.createdAt = { gte: timeframeStart };
      }

      // Date range filter (overrides timeframe)
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      // Action filter
      if (action && action !== 'All Actions') {
        where.action = action as string;
      }

      // User filter
      if (userId && userId !== 'All Users') {
        const userIdNum = parseInt(userId as string);
        if (!isNaN(userIdNum)) {
          where.userId = userIdNum;
        }
      }

      // Search filter (enhanced)
      if (search) {
        where.OR = [
          { entityId: { contains: search as string, mode: 'insensitive' } },
          { action: { contains: search as string, mode: 'insensitive' } },
          { entityType: { contains: search as string, mode: 'insensitive' } },
          {
            performedBy: {
              OR: [
                { name: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } }
              ]
            }
          }
        ];
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      // Get time ranges for analytics
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const [activities, total, todayCount, yesterdayCount, weekCount, monthCount, actionCounts, hourlyStats] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take
        }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.count({
          where: { createdAt: { gte: today } }
        }),
        prisma.auditLog.count({
          where: {
            createdAt: {
              gte: yesterday,
              lt: today
            }
          }
        }),
        prisma.auditLog.count({
          where: { createdAt: { gte: lastWeek } }
        }),
        prisma.auditLog.count({
          where: { createdAt: { gte: lastMonth } }
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          _count: true,
          orderBy: {
            _count: {
              action: 'desc'
            }
          }
        }),
        // Hourly activity for the last 24 hours
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('hour', "createdAt") as hour,
            COUNT(*)::int as count
          FROM "AuditLog" 
          WHERE "createdAt" >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
          GROUP BY DATE_TRUNC('hour', "createdAt")
          ORDER BY hour DESC
        `
      ]);

      // Get unique users with activity counts
      const uniqueUsers = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: { userId: { not: null } },
        _count: true,
        orderBy: {
          _count: {
            userId: 'desc'
          }
        },
        take: 20
      });

      // Fetch user details
      const userIds = uniqueUsers.map(u => u.userId).filter(Boolean) as number[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, role: true }
      });

      const usersWithActivity = uniqueUsers.map(activity => {
        const user = users.find(u => u.id === activity.userId);
        return {
          id: activity.userId,
          name: user?.name || 'Unknown',
          email: user?.email || 'Unknown',
          role: user?.role || 'Unknown',
          activityCount: activity._count
        };
      });

      // Calculate trends
      const todayVsYesterday = yesterdayCount > 0
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100
        : todayCount > 0 ? 100 : 0;

      // Get entity type distribution
      const entityTypeStats = await prisma.auditLog.groupBy({
        by: ['entityType'],
        _count: true,
        where: { createdAt: { gte: lastWeek } },
        orderBy: {
          _count: {
            entityType: 'desc'
          }
        }
      });

      // Get IP address stats (security monitoring)
      const ipStats = await prisma.auditLog.groupBy({
        by: ['ipAddress'],
        _count: true,
        where: {
          ipAddress: { not: null },
          createdAt: { gte: lastWeek }
        },
        orderBy: {
          _count: {
            ipAddress: 'desc'
          }
        },
        take: 10
      });

      res.json({
        success: true,
        activities: activities.map((activity) => ({
          ...activity,
          userName: activity.performedBy?.name || 'System',
          userEmail: activity.performedBy?.email
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string))
        },
        stats: {
          total,
          todayCount,
          yesterdayCount,
          weekCount,
          monthCount,
          todayVsYesterday,
          uniqueUsersCount: usersWithActivity.length,
          actionCounts: actionCounts.reduce((acc, item) => {
            acc[item.action] = item._count;
            return acc;
          }, {} as Record<string, number>),
          entityTypeStats: entityTypeStats.reduce((acc, item) => {
            const entityType = item.entityType || 'unknown';
            acc[entityType] = item._count;
            return acc;
          }, {} as Record<string, number>)
        },
        analytics: {
          hourlyActivity: hourlyStats,
          topUsers: usersWithActivity,
          entityTypes: entityTypeStats,
          ipAddresses: ipStats
        },
        uniqueUsers: usersWithActivity
      });
      return;
    } catch (error) {
      logger.error('Get all activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activities'
      });
      return;
    }
  }

  /**
   * Get activities for zone manager's zone only (zone manager + admin)
   */
  static async getZoneActivities(req: AuthRequest, res: Response) {
    try {
      const {
        entityType,
        action,
        userId,
        search,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        zoneId, // Optional: Admin can specify zoneId, zone manager can only see their zone
        timeframe = '7d' // 1d, 7d, 30d, 90d, 1y
      } = req.query;

      // Get user's zone information
      let targetZoneId: string | number | undefined;

      if (req.user?.role === 'ZONE_MANAGER') {
        // Zone managers can only see their own zone
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          include: {
            serviceZones: {
              include: {
                serviceZone: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        });

        if (!user || user.serviceZones.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'No zone assigned to this zone manager'
          });
        }

        // Use the first assigned zone (zone managers typically have one zone)
        targetZoneId = user.serviceZones[0].serviceZone.id;
      } else if (req.user?.role === 'ADMIN') {
        // Admins can specify a zoneId or see all zones
        targetZoneId = zoneId ? parseInt(zoneId as string) : undefined;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Build where clause
      const where: any = {};

      // Zone filter - filter activities by users in the target zone
      if (targetZoneId) {
        where.performedBy = {
          serviceZones: {
            some: {
              serviceZoneId: targetZoneId
            }
          }
        };
      }

      // Timeframe filter (base time range)
      if (timeframe && !startDate && !endDate) {
        const now = new Date();
        let timeframeStart: Date;

        switch (timeframe) {
          case '1d':
            timeframeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            timeframeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            timeframeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case '1y':
            timeframeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        where.createdAt = { gte: timeframeStart };
      }

      // Date range filter (overrides timeframe)
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      // Action filter
      if (action && action !== 'all') {
        where.action = action as string;
      }

      // User filter (only users within the same zone)
      if (userId && userId !== 'all') {
        const userIdNum = parseInt(userId as string);
        if (!isNaN(userIdNum)) {
          where.userId = userIdNum;
        }
      }

      // Search filter (enhanced)
      if (search) {
        where.OR = [
          { entityId: { contains: search as string, mode: 'insensitive' } },
          { action: { contains: search as string, mode: 'insensitive' } },
          { entityType: { contains: search as string, mode: 'insensitive' } },
          {
            performedBy: {
              OR: [
                { name: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } }
              ]
            }
          },
        ];
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      // Fetch activities with zone filtering
      const [activities, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                serviceZones: {
                  include: {
                    serviceZone: {
                      select: { id: true, name: true }
                    }
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take
        }),
        prisma.auditLog.count({ where })
      ]);

      res.json({
        success: true,
        activities,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string))
        },
        zoneInfo: {
          zoneId: targetZoneId,
          isZoneManager: req.user?.role === 'ZONE_MANAGER'
        }
      });
      return;
    } catch (error) {
      logger.error('Get zone activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch zone activities'
      });
      return;
    }
  }

  /**
   * Log a generic activity
   */
  static async logActivity(params: {
    action: string;
    entityType: string;
    entityId: string;
    offerId?: number;
    userId: number;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Only include offerId if it's provided and not null
      const data: any = {
        action: params.action,
        entityType: params.entityType,
        entityId: parseInt(params.entityId) || null,
        userId: params.userId,
        performedById: params.userId,
        details: params.details || {},
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        updatedAt: new Date()
      };

      // Only add offerId if provided (to avoid foreign key constraint issues on deletes)
      if (params.offerId) {
        data.offerId = params.offerId;
      }

      await prisma.auditLog.create({ data });
    } catch (error) {
      logger.error('Log activity error:', error);
      // Don't throw error to prevent blocking main operations
    }
  }

  /**
   * Log offer creation
   */
  static async logOfferCreate(params: {
    offerId: number;
    offerReferenceNumber: string;
    offerData: any;
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await ActivityController.logActivity({
      action: 'OFFER_CREATED',
      entityType: 'Offer',
      entityId: params.offerReferenceNumber,
      offerId: params.offerId,
      userId: params.userId,
      details: {
        title: params.offerData.title,
        productType: params.offerData.productType,
        company: params.offerData.company,
        offerValue: params.offerData.offerValue,
        status: params.offerData.status,
        stage: params.offerData.stage
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Log offer update with automatic change detection
   */
  static async logOfferUpdate(params: {
    offerId: number;
    offerReferenceNumber: string;
    oldData: any;
    newData: any;
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    // Detect changes
    const changes: any = {};
    const fieldsToTrack = [
      'title', 'description', 'productType', 'lead', 'status', 'stage',
      'priority', 'offerValue', 'offerMonth', 'poExpectedMonth',
      'probabilityPercentage', 'poNumber', 'poDate', 'poValue',
      'poReceivedMonth', 'assignedToId', 'remarks', 'openFunnel'
    ];

    const normalize = (val: any) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'number') return val.toString();
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'object' && val.toNumber) return val.toNumber().toString(); // Prisma Decimal
      return String(val);
    };

    for (const field of fieldsToTrack) {
      if (params.newData[field] === undefined) continue;

      const oldVal = params.oldData[field];
      const newVal = params.newData[field];

      if (normalize(oldVal) !== normalize(newVal)) {
        changes[field] = {
          from: oldVal,
          to: newVal
        };
      }
    }

    if (Object.keys(changes).length === 0) {
      return; // No changes to log
    }

    await ActivityController.logActivity({
      action: 'OFFER_UPDATED',
      entityType: 'Offer',
      entityId: params.offerReferenceNumber,
      offerId: params.offerId,
      userId: params.userId,
      details: { changes },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Log spare part update with automatic change detection
   */
  static async logSparePartUpdate(params: {
    sparePartId: number;
    partNumber: string;
    oldData: any;
    newData: any;
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    // Detect changes
    const changes: any = {};
    const fieldsToTrack = [
      'name', 'description', 'category', 'basePrice', 'imageUrl', 'specifications', 'status'
    ];

    const normalize = (val: any) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'object' && val.toNumber) return val.toNumber().toString(); // Prisma Decimal
      return String(val);
    };

    for (const field of fieldsToTrack) {
      if (params.newData[field] === undefined) continue;

      const oldVal = params.oldData[field];
      const newVal = params.newData[field];

      if (normalize(oldVal) !== normalize(newVal)) {
        changes[field] = {
          from: oldVal,
          to: newVal
        };
      }
    }

    if (Object.keys(changes).length === 0) {
      return; // No changes to log
    }

    await ActivityController.logActivity({
      action: 'SPARE_PART_UPDATED',
      entityType: 'SparePart',
      entityId: params.sparePartId.toString(),
      userId: params.userId,
      details: {
        partNumber: params.partNumber,
        changes
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Log offer status change
   */
  static async logOfferStatusChange(params: {
    offerId: number;
    offerReferenceNumber: string;
    fromStatus: string;
    toStatus: string;
    fromStage?: string;
    toStage?: string;
    notes?: string;
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await ActivityController.logActivity({
      action: 'OFFER_STATUS_UPDATED',
      entityType: 'Offer',
      entityId: params.offerReferenceNumber,
      offerId: params.offerId,
      userId: params.userId,
      details: {
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        fromStage: params.fromStage,
        toStage: params.toStage,
        notes: params.notes
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Log offer deletion
   */
  static async logOfferDelete(params: {
    offerId: number;
    offerReferenceNumber: string;
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await ActivityController.logActivity({
      action: 'OFFER_DELETED',
      entityType: 'Offer',
      entityId: params.offerReferenceNumber,
      offerId: params.offerId,
      userId: params.userId,
      details: { offerReferenceNumber: params.offerReferenceNumber },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Log offer note added
   */
  static async logOfferNoteAdded(params: {
    offerId: number;
    offerReferenceNumber: string;
    content: string;
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await ActivityController.logActivity({
      action: 'OFFER_NOTE_ADDED',
      entityType: 'Offer',
      entityId: params.offerReferenceNumber,
      offerId: params.offerId,
      userId: params.userId,
      details: { content: params.content },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Get user activity history (admin only)
   */
  static async getUserActivities(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const [activities, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: {
            userId: parseInt(userId)
          },
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take
        }),
        prisma.auditLog.count({
          where: {
            userId: parseInt(userId)
          }
        })
      ]);

      res.json({
        success: true,
        activities,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
      return;
    } catch (error) {
      logger.error('Get user activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user activities'
      });
      return;
    }
  }

  /**
   * Get comprehensive activity analytics (admin only)
   */
  static async getActivityStats(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, timeframe = '30d' } = req.query;

      const where: any = {};

      // Set default timeframe if no dates provided
      const now = new Date();
      if (!startDate && !endDate) {
        const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
        where.createdAt = {
          gte: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
        };
      } else {
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = new Date(startDate as string);
          if (endDate) where.createdAt.lte = new Date(endDate as string);
        }
      }

      const [
        totalActivities,
        offerCreated,
        offerUpdated,
        offerDeleted,
        statusChanged,
        activitiesByUser,
        dailyActivity,
        peakHours,
        riskActivities
      ] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.count({ where: { ...where, action: 'OFFER_CREATED' } }),
        prisma.auditLog.count({ where: { ...where, action: 'OFFER_UPDATED' } }),
        prisma.auditLog.count({ where: { ...where, action: 'OFFER_DELETED' } }),
        prisma.auditLog.count({ where: { ...where, action: 'OFFER_STATUS_UPDATED' } }),
        prisma.auditLog.groupBy({
          by: ['userId'],
          where,
          _count: true,
          orderBy: {
            _count: {
              userId: 'desc'
            }
          },
          take: 15
        }),
        // Daily activity trend
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', "createdAt") as date,
            COUNT(*)::int as count,
            COUNT(DISTINCT "userId")::int as unique_users
          FROM "AuditLog" 
          WHERE "createdAt" >= ${where.createdAt?.gte || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY date DESC
          LIMIT 30
        `,
        // Peak activity hours
        prisma.$queryRaw`
          SELECT 
            EXTRACT(hour FROM "createdAt")::int as hour,
            COUNT(*)::int as count
          FROM "AuditLog" 
          WHERE "createdAt" >= ${where.createdAt?.gte || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
          GROUP BY EXTRACT(hour FROM "createdAt")
          ORDER BY count DESC
        `,
        // Risk activities (multiple deletions, late night activities)
        prisma.auditLog.findMany({
          where: {
            ...where,
            OR: [
              { action: 'OFFER_DELETED' },
              {
                AND: [
                  { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
                  {
                    createdAt: {
                      gte: new Date(now.setHours(22, 0, 0, 0)),
                      lt: new Date(now.setHours(6, 0, 0, 0))
                    }
                  }
                ]
              }
            ]
          },
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 20
        })
      ]);

      // Fetch user details for top users
      const userIds = activitiesByUser.map(a => a.userId).filter(Boolean) as number[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, role: true }
      });

      const topUsers = activitiesByUser.map(activity => {
        const user = users.find(u => u.id === activity.userId);
        return {
          userId: activity.userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'Unknown',
          userRole: user?.role || 'Unknown',
          activityCount: activity._count
        };
      });

      // Calculate activity velocity (activities per day)
      const daysInPeriod = where.createdAt?.gte
        ? Math.ceil((now.getTime() - where.createdAt.gte.getTime()) / (24 * 60 * 60 * 1000))
        : 30;
      const avgActivitiesPerDay = totalActivities / Math.max(daysInPeriod, 1);

      res.json({
        success: true,
        stats: {
          totalActivities,
          offerCreated,
          offerUpdated,
          offerDeleted,
          statusChanged,
          avgActivitiesPerDay: Math.round(avgActivitiesPerDay * 100) / 100,
          topUsers,
          dailyTrend: dailyActivity,
          peakHours: peakHours,
          riskActivities: riskActivities.length,
          timeframeAnalysis: {
            period: daysInPeriod,
            velocity: avgActivitiesPerDay,
            efficiency: totalActivities > 0 ? ((offerCreated + offerUpdated) / totalActivities) * 100 : 0
          }
        },
        analytics: {
          dailyActivity,
          peakHours,
          riskActivities
        }
      });
      return;
    } catch (error) {
      logger.error('Get activity stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activity statistics'
      });
      return;
    }
  }

  /**
   * Get activity comparison between periods (admin only)
   */
  static async getActivityComparison(req: AuthRequest, res: Response) {
    try {
      const { period = 'week' } = req.query; // week, month, quarter, year

      const now = new Date();
      let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

      switch (period) {
        case 'week':
          currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          currentEnd = now;
          previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          previousEnd = currentStart;
          break;
        case 'month':
          currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
          currentEnd = now;
          previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
          currentEnd = now;
          previousStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
          previousEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
          break;
        case 'year':
          currentStart = new Date(now.getFullYear(), 0, 1);
          currentEnd = now;
          previousStart = new Date(now.getFullYear() - 1, 0, 1);
          previousEnd = new Date(now.getFullYear() - 1, 11, 31);
          break;
        default:
          currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          currentEnd = now;
          previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          previousEnd = currentStart;
      }

      const [currentPeriodStats, previousPeriodStats] = await Promise.all([
        prisma.auditLog.groupBy({
          by: ['action'],
          where: {
            createdAt: {
              gte: currentStart,
              lte: currentEnd
            }
          },
          _count: true
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where: {
            createdAt: {
              gte: previousStart,
              lte: previousEnd
            }
          },
          _count: true
        })
      ]);

      const [currentTotal, previousTotal, currentUsers, previousUsers] = await Promise.all([
        prisma.auditLog.count({
          where: {
            createdAt: {
              gte: currentStart,
              lte: currentEnd
            }
          }
        }),
        prisma.auditLog.count({
          where: {
            createdAt: {
              gte: previousStart,
              lte: previousEnd
            }
          }
        }),
        prisma.auditLog.findMany({
          where: {
            createdAt: {
              gte: currentStart,
              lte: currentEnd
            },
            userId: { not: null }
          },
          distinct: ['userId'],
          select: { userId: true }
        }),
        prisma.auditLog.findMany({
          where: {
            createdAt: {
              gte: previousStart,
              lte: previousEnd
            },
            userId: { not: null }
          },
          distinct: ['userId'],
          select: { userId: true }
        })
      ]);

      const comparison = {
        current: {
          total: currentTotal,
          uniqueUsers: currentUsers.length,
          byAction: currentPeriodStats.reduce((acc, item) => {
            acc[item.action] = item._count;
            return acc;
          }, {} as Record<string, number>)
        },
        previous: {
          total: previousTotal,
          uniqueUsers: previousUsers.length,
          byAction: previousPeriodStats.reduce((acc, item) => {
            acc[item.action] = item._count;
            return acc;
          }, {} as Record<string, number>)
        },
        changes: {
          totalChange: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0,
          userChange: previousUsers.length > 0 ? ((currentUsers.length - previousUsers.length) / previousUsers.length) * 100 : 0
        }
      };

      res.json({
        success: true,
        comparison,
        period: {
          type: period,
          current: { start: currentStart, end: currentEnd },
          previous: { start: previousStart, end: previousEnd }
        }
      });
      return;
    } catch (error) {
      logger.error('Get activity comparison error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activity comparison'
      });
      return;
    }
  }

  /**
   * Get activity summary by entity type (admin only)
   */
  static async getActivityByEntity(req: AuthRequest, res: Response) {
    try {
      const { timeframe = '30d' } = req.query;

      const now = new Date();
      const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const entityStats = await prisma.auditLog.groupBy({
        by: ['entityType', 'action'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: true,
        orderBy: {
          _count: {
            entityType: 'desc'
          }
        }
      });

      // Group by entity type
      const grouped = entityStats.reduce((acc, item) => {
        const entityType = item.entityType || 'unknown';
        const action = item.action || 'unknown';
        if (!acc[entityType]) {
          acc[entityType] = {
            total: 0,
            actions: {}
          };
        }
        acc[entityType].total += item._count;
        acc[entityType].actions[action] = item._count;
        return acc;
      }, {} as Record<string, { total: number; actions: Record<string, number> }>);

      res.json({
        success: true,
        entityStats: grouped,
        timeframe: {
          days: daysBack,
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      });
      return;
    } catch (error) {
      logger.error('Get activity by entity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activity by entity'
      });
      return;
    }
  }

  /**
   * Get user activity leaderboard (admin only)
   */
  static async getUserLeaderboard(req: AuthRequest, res: Response) {
    try {
      const { timeframe = '30d', limit = 20 } = req.query;

      const now = new Date();
      const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const userActivities = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: startDate },
          userId: { not: null }
        },
        _count: true,
        orderBy: {
          _count: {
            userId: 'desc'
          }
        },
        take: parseInt(limit as string)
      });

      // Get user details and action breakdown
      const userIds = userActivities.map(u => u.userId).filter(Boolean) as number[];
      const [users, actionBreakdown] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            lastLoginAt: true
          }
        }),
        Promise.all(userIds.map(userId =>
          prisma.auditLog.groupBy({
            by: ['action'],
            where: {
              userId,
              createdAt: { gte: startDate }
            },
            _count: true
          })
        ))
      ]);

      const leaderboard = userActivities.map((activity, index) => {
        const user = users.find(u => u.id === activity.userId);
        const actions = actionBreakdown[index].reduce((acc, item) => {
          acc[item.action] = item._count;
          return acc;
        }, {} as Record<string, number>);

        return {
          rank: index + 1,
          userId: activity.userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'Unknown',
          userRole: user?.role || 'Unknown',
          totalActivities: activity._count,
          actionBreakdown: actions,
          lastActive: user?.lastLoginAt
        };
      });

      res.json({
        success: true,
        leaderboard,
        timeframe: {
          days: daysBack,
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      });
      return;
    } catch (error) {
      logger.error('Get user leaderboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user leaderboard'
      });
      return;
    }
  }

  /**
   * Export activities to CSV (admin only)
   */
  static async exportActivities(req: AuthRequest, res: Response) {
    try {
      const {
        entityType,
        action,
        userId,
        startDate,
        endDate,
        format = 'csv'
      } = req.query;

      const where: any = {};

      if (entityType && entityType !== 'All') where.entityType = entityType;
      if (action && action !== 'All Actions') where.action = action;
      if (userId && userId !== 'All Users') where.userId = parseInt(userId as string);
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const activities = await prisma.auditLog.findMany({
        where,
        include: {
          performedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10000 // Limit export to 10k records
      });

      if (format === 'json') {
        res.json({
          success: true,
          activities,
          count: activities.length
        });
        return;
      }

      // CSV format
      const csvHeaders = ['Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Details'];
      const csvRows = activities.map(activity => [
        new Date(activity.createdAt).toISOString(),
        activity.performedBy?.name || activity.performedBy?.email || 'System',
        activity.performedBy?.role || 'N/A',
        activity.action || 'N/A',
        activity.entityType || 'N/A',
        activity.entityId || '',
        activity.ipAddress || '',
        JSON.stringify(activity.details || {})
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `\"${String(field).replace(/\"/g, '\"\"')}\"`).join(','))
      ].join('\\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=activities-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
      return;
    } catch (error) {
      logger.error('Export activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export activities'
      });
      return;
    }
  }

  /**
   * Get security alerts and suspicious activities (admin only)
   */
  static async getSecurityAlerts(req: AuthRequest, res: Response) {
    try {
      const { timeframe = '7d' } = req.query;

      const now = new Date();
      const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 7;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const [suspiciousActivities, failedLogins, unusualIPs, bulkOperations, offHoursActivities] = await Promise.all([
        // Suspicious activities (multiple deletions, rapid changes)
        prisma.auditLog.findMany({
          where: {
            createdAt: { gte: startDate },
            OR: [
              { action: { contains: 'DELETE' } },
              { action: { contains: 'BULK' } },
              { details: { path: ['changes'], not: {} } }
            ]
          },
          include: {
            performedBy: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        // Failed login attempts from auth controller (simulated)
        prisma.auditLog.findMany({
          where: {
            createdAt: { gte: startDate },
            action: 'LOGIN_FAILED'
          },
          include: {
            performedBy: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        }),
        // Unusual IP addresses
        prisma.$queryRaw`
          SELECT 
            "ipAddress",
            COUNT(*)::int as count,
            COUNT(DISTINCT "userId")::int as uniqueUsers,
            MAX("createdAt") as lastSeen
          FROM "AuditLog" 
          WHERE "createdAt" >= ${startDate}
            AND "ipAddress" IS NOT NULL
          GROUP BY "ipAddress"
          HAVING COUNT(*) > 10
          ORDER BY count DESC
          LIMIT 20
        `,
        // Bulk operations
        prisma.auditLog.findMany({
          where: {
            createdAt: { gte: startDate },
            OR: [
              { action: { contains: 'BULK' } },
              { details: { path: ['bulk'], equals: true } }
            ]
          },
          include: {
            performedBy: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 30
        }),
        // Off-hours activities (10 PM - 6 AM)
        prisma.auditLog.findMany({
          where: {
            createdAt: { gte: startDate },
            AND: [
              {
                createdAt: {
                  gte: new Date(now.setHours(22, 0, 0, 0))
                }
              },
              {
                createdAt: {
                  lt: new Date(now.setHours(6, 0, 0, 0))
                }
              }
            ]
          },
          include: {
            performedBy: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 30
        })
      ]);

      // Calculate risk scores
      const riskScore = Math.min(100,
        (suspiciousActivities.length * 10) +
        (failedLogins.length * 5) +
        ((unusualIPs as any[]).length * 3) +
        (bulkOperations.length * 7) +
        (offHoursActivities.length * 2)
      );

      res.json({
        success: true,
        securityAlerts: {
          riskScore,
          riskLevel: riskScore >= 80 ? 'HIGH' : riskScore >= 50 ? 'MEDIUM' : 'LOW',
          suspiciousActivities,
          failedLogins,
          unusualIPs,
          bulkOperations,
          offHoursActivities,
          summary: {
            totalAlerts: suspiciousActivities.length + failedLogins.length + bulkOperations.length + offHoursActivities.length,
            uniqueIPs: (unusualIPs as any[]).length,
            uniqueUsers: [...new Set([
              ...suspiciousActivities.map(a => a.userId),
              ...failedLogins.map(a => a.userId),
              ...bulkOperations.map(a => a.userId),
              ...offHoursActivities.map(a => a.userId)
            ])].filter(Boolean).length
          }
        },
        timeframe: {
          days: daysBack,
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      });
      return;
    } catch (error) {
      logger.error('Get security alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security alerts'
      });
      return;
    }
  }

  /**
   * Get workflow analysis and business process insights (admin only)
   */
  static async getWorkflowAnalysis(req: AuthRequest, res: Response) {
    try {
      const { timeframe = '30d' } = req.query;

      const now = new Date();
      const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 30;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const [offerWorkflow, customerWorkflow, userProductivity, bottlenecks] = await Promise.all([
        // Offer workflow analysis
        prisma.$queryRaw`
          SELECT 
            "stage",
            COUNT(*)::int as count,
            AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))/3600) as avgHoursInStage
          FROM "Offer" 
          WHERE "createdAt" >= ${startDate}
          GROUP BY "stage"
          ORDER BY count DESC
        `,
        // Customer workflow
        prisma.$queryRaw`
          SELECT 
            COUNT(*)::int as totalCustomers,
            COUNT(DISTINCT "zoneId")::int as zonesCovered,
            COUNT(DISTINCT "createdById")::int as uniqueCreators
          FROM "Customer" 
          WHERE "createdAt" >= ${startDate}
        `,
        // User productivity metrics
        prisma.$queryRaw`
          SELECT 
            u.id,
            u.name,
            u.email,
            u.role,
            COUNT(DISTINCT al."entityType")::int as entityTypesWorked,
            COUNT(*)::int as totalActivities,
            COUNT(DISTINCT DATE(al."createdAt"))::int as activeDays,
            COUNT(*)::float / NULLIF(COUNT(DISTINCT DATE(al."createdAt")), 0) as avgActivitiesPerDay
          FROM "AuditLog" al
          JOIN "User" u ON al."userId" = u.id
          WHERE al."createdAt" >= ${startDate}
            AND al."userId" IS NOT NULL
          GROUP BY u.id, u.name, u.email, u.role
          ORDER BY totalActivities DESC
          LIMIT 20
        `,
        // Process bottlenecks
        prisma.$queryRaw`
          SELECT 
            "entityType",
            "action",
            COUNT(*)::int as frequency,
            AVG(EXTRACT(EPOCH FROM (NOW() - "createdAt"))/3600) as avgHoursSince
          FROM "AuditLog" 
          WHERE "createdAt" >= ${startDate}
            AND "action" IN ('OFFER_CREATED', 'OFFER_UPDATED', 'CUSTOMER_CREATED', 'TARGET_SET')
          GROUP BY "entityType", "action"
          ORDER BY frequency DESC
        `
      ]);

      // Calculate efficiency metrics
      const totalActivities = await prisma.auditLog.count({
        where: { createdAt: { gte: startDate } }
      });

      const activeUsers = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: startDate },
          userId: { not: null }
        },
        _count: true
      });

      res.json({
        success: true,
        workflowAnalysis: {
          offerWorkflow,
          customerWorkflow: (customerWorkflow as any[])[0] || {},
          userProductivity,
          bottlenecks,
          efficiency: {
            totalActivities,
            activeUsers: activeUsers.length,
            avgActivitiesPerUser: activeUsers.length > 0 ? totalActivities / activeUsers.length : 0,
            productivityScore: Math.min(100, (totalActivities / daysBack) * 10)
          }
        },
        timeframe: {
          days: daysBack,
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      });
      return;
    } catch (error) {
      logger.error('Get workflow analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch workflow analysis'
      });
      return;
    }
  }

  /**
   * Get compliance and audit report (admin only)
   */
  static async getComplianceReport(req: AuthRequest, res: Response) {
    try {
      const { timeframe = '30d' } = req.query;

      const now = new Date();
      const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 30;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const [auditTrail, dataAccess] = await Promise.all([
        // Audit trail completeness
        prisma.$queryRaw`
          SELECT 
            "entityType",
            COUNT(*)::int as totalActions,
            COUNT(CASE WHEN "details" IS NOT NULL THEN 1 END)::int as withDetails,
            COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END)::int withUserId,
            COUNT(CASE WHEN "ipAddress" IS NOT NULL THEN 1 END)::int withIP,
            (COUNT(CASE WHEN "details" IS NOT NULL THEN 1 END)::float / COUNT(*)) * 100 as completenessScore
          FROM "AuditLog" 
          WHERE "createdAt" >= ${startDate}
          GROUP BY "entityType"
          ORDER BY totalActions DESC
        `,
        // Data access patterns
        prisma.$queryRaw`
          SELECT 
            u.role,
            al."entityType",
            al."action",
            COUNT(*)::int as accessCount,
            COUNT(DISTINCT al."userId")::int as uniqueUsers
          FROM "AuditLog" al
          JOIN "User" u ON al."userId" = u.id
          WHERE al."createdAt" >= ${startDate}
              AND al."ipAddress" IS NOT NULL
          GROUP BY u.role, al."entityType", al."action"
          ORDER BY accessCount DESC
        `,
      ]);

      // Calculate overall compliance score
      const totalAuditLogs = await prisma.auditLog.count({
        where: { createdAt: { gte: startDate } }
      });

      const compliantLogs = await prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate },
          AND: [
            { userId: { not: undefined } },
            { details: { not: undefined } },
            { ipAddress: { not: undefined } }
          ]
        }
      });

      const complianceScore = totalAuditLogs > 0 ? (compliantLogs / totalAuditLogs) * 100 : 100;

      res.json({
        success: true,
        complianceReport: {
          complianceScore,
          auditTrail,
          dataAccess,
          roleCompliance: [],
          exceptions: [],
          summary: {
            totalAuditLogs,
            compliantLogs,
            nonCompliantLogs: totalAuditLogs - compliantLogs,
            complianceLevel: complianceScore >= 95 ? 'EXCELLENT' : complianceScore >= 85 ? 'GOOD' : complianceScore >= 70 ? 'NEEDS_IMPROVEMENT' : 'POOR'
          }
        },
        timeframe: {
          days: daysBack,
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      });
      return;
    } catch (error) {
      logger.error('Get compliance report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch compliance report'
      });
      return;
    }
  }
}
