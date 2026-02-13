import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { ActivityController } from './activityController';

/**
 * Helper function to properly convert Prisma Decimal to JavaScript number
 * Avoids floating point precision issues by using string conversion and smart rounding
 */
function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  // Convert to string first to avoid precision issues, then parse
  const stringValue = value.toString();
  const parsed = parseFloat(stringValue);
  if (isNaN(parsed)) return 0;

  // For large numbers (>= 1000), check if it's very close to a whole number
  // This handles precision issues like 29999999.96 -> 30000000
  const rounded = Math.round(parsed);
  if (Math.abs(parsed) >= 1000 && Math.abs(parsed - rounded) < 0.5) {
    return rounded;
  }

  // For smaller numbers or those with significant decimals, round to 2 decimal places
  return Math.round(parsed * 100) / 100;
}

/**
 * TargetController - Handles target management for zones, users, and product types
 * Accessible only by ADMIN users (Director functionality)
 */
export class TargetController {
  // Wrapper methods for routes without authentication
  static async setZoneTargetWrapper(req: any, res: Response) {
    return TargetController.setZoneTarget(req as AuthenticatedRequest, res);
  }

  static async getZoneTargetsWrapper(req: any, res: Response) {
    return TargetController.getZoneTargets(req as AuthenticatedRequest, res);
  }

  static async updateZoneTargetWrapper(req: any, res: Response) {
    return TargetController.updateZoneTarget(req as AuthenticatedRequest, res);
  }

  static async deleteZoneTargetWrapper(req: any, res: Response) {
    return TargetController.deleteZoneTarget(req as AuthenticatedRequest, res);
  }

  static async setUserTargetWrapper(req: any, res: Response) {
    return TargetController.setUserTarget(req as AuthenticatedRequest, res);
  }

  static async getUserTargetsWrapper(req: any, res: Response) {
    return TargetController.getUserTargets(req as AuthenticatedRequest, res);
  }

  static async updateUserTargetWrapper(req: any, res: Response) {
    return TargetController.updateUserTarget(req as AuthenticatedRequest, res);
  }

  static async deleteUserTargetWrapper(req: any, res: Response) {
    return TargetController.deleteUserTarget(req as AuthenticatedRequest, res);
  }

  static async getZoneTargetDetailsWrapper(req: any, res: Response) {
    return TargetController.getZoneTargetDetails(req as AuthenticatedRequest, res);
  }

  static async getUserTargetDetailsWrapper(req: any, res: Response) {
    return TargetController.getUserTargetDetails(req as AuthenticatedRequest, res);
  }

  static async getTargetDashboardWrapper(req: any, res: Response) {
    return TargetController.getTargetDashboard(req as AuthenticatedRequest, res);
  }

  static async getTargetsSummaryWrapper(req: any, res: Response) {
    return TargetController.getTargetsSummary(req as AuthenticatedRequest, res);
  }

  // ==================== ZONE TARGETS ====================
  /**
   * Set or update zone target
   */
  static async setZoneTarget(req: AuthenticatedRequest, res: Response) {
    try {
      const { serviceZoneId, targetPeriod, periodType, targetValue, targetOfferCount, productType } = req.body;

      if (!serviceZoneId || !targetPeriod || !periodType || targetValue === undefined || targetValue === null) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID, target period, period type, and target value are required'
        });
      }

      // Check if user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Check if target already exists (with optional product type)
      // Use findFirst when productType is null/undefined because Prisma doesn't support null in findUnique composite keys
      let existingTarget;
      if (productType) {
        existingTarget = await prisma.zoneTarget.findFirst({
          where: {
            serviceZoneId: parseInt(serviceZoneId),
            targetPeriod,
            periodType,
            productType: productType
          }
        });
      } else {
        existingTarget = await prisma.zoneTarget.findFirst({
          where: {
            serviceZoneId: parseInt(serviceZoneId),
            targetPeriod,
            periodType,
            productType: null
          }
        });
      }

      let target;
      if (existingTarget) {
        // Update existing target
        target = await prisma.zoneTarget.update({
          where: { id: existingTarget.id },
          data: {
            targetValue: new Prisma.Decimal(targetValue),
            targetOfferCount: targetOfferCount || null,
            productType: productType || null,
            updatedById: req.user.id
          },
          include: {
            serviceZone: {
              select: { id: true, name: true }
            }
          }
        });
      } else {
        // Create new target
        target = await prisma.zoneTarget.create({
          data: {
            serviceZoneId: parseInt(serviceZoneId),
            targetPeriod,
            periodType,
            productType: productType || null,
            targetValue: new Prisma.Decimal(targetValue),
            targetOfferCount: targetOfferCount || null,
            createdById: req.user.id,
            updatedById: req.user.id
          },
          include: {
            serviceZone: {
              select: { id: true, name: true }
            }
          }
        });
      }

      logger.info(`Zone target ${existingTarget ? 'updated' : 'created'} for zone ${serviceZoneId} by ${req.user?.email}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: existingTarget ? 'ZONE_TARGET_UPDATED' : 'ZONE_TARGET_SET',
        entityType: 'ZoneTarget',
        entityId: target.id.toString(),
        details: {
          zoneId: serviceZoneId,
          zoneName: target.serviceZone.name,
          period: targetPeriod,
          periodType,
          productType,
          value: targetValue
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: `Target ${existingTarget ? 'updated' : 'created'} successfully`,
        target
      });
    } catch (error) {
      logger.error('Set zone target error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to set zone target'
      });
    }
  }

  /**
   * Get all zone targets with actual performance - shows ALL zones regardless of targets
   */
  static async getZoneTargets(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetPeriod, periodType, grouped, actualValuePeriod, zoneId } = req.query;

      if (!targetPeriod || !periodType) {
        return res.status(400).json({
          success: false,
          message: 'Target period and period type are required'
        });
      }

      // Get ALL zones first
      const whereZones: any = { isActive: true };

      // For zone users, only show their zone
      if ((req.user?.role === 'ZONE_USER' || req.user?.role === 'ZONE_MANAGER') && req.user?.zoneId) {
        whereZones.id = parseInt(req.user.zoneId.toString());
      } else if (zoneId && zoneId !== 'all') {
        // For admin users, filter by selected zone if provided
        whereZones.id = parseInt(zoneId as string);
      }

      const allZones = await prisma.serviceZone.findMany({
        where: whereZones,
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      });

      // Get existing targets for the period
      const whereTargets: any = {
        targetPeriod: targetPeriod as string,
        periodType: periodType as any
      };

      if ((req.user?.role === 'ZONE_USER' || req.user?.role === 'ZONE_MANAGER') && req.user?.zoneId) {
        whereTargets.serviceZoneId = parseInt(req.user.zoneId.toString());
      }

      const existingTargets = await prisma.zoneTarget.findMany({
        where: whereTargets,
        include: {
          serviceZone: {
            select: { id: true, name: true }
          }
        }
      });

      // Create a map of existing targets by zone ID
      const targetsByZone = new Map();
      existingTargets.forEach(target => {
        const key = target.serviceZoneId;
        if (!targetsByZone.has(key)) {
          targetsByZone.set(key, []);
        }
        targetsByZone.get(key).push(target);
      });

      // Build complete list with actual performance for ALL zones
      const targetsWithActuals = await Promise.all(
        allZones.map(async (zone: any) => {
          const zoneTargets = targetsByZone.get(zone.id) || [];

          // Calculate actual performance for this zone
          // Use actualValuePeriod for monthly view, otherwise use targetPeriod
          const actualPeriod = actualValuePeriod as string || targetPeriod as string;
          const actualPeriodType = actualValuePeriod ? 'MONTHLY' : periodType as string;

          // Skip if trying to use yearly period with monthly period type
          if (actualPeriodType === 'MONTHLY' && !actualPeriod.includes('-')) {
            return {
              id: null,
              serviceZoneId: zone.id,
              targetPeriod: targetPeriod as string,
              periodType: periodType as string,
              serviceZone: zone,
              targetValue: 0,
              actualValue: 0,
              actualOfferCount: 0,
              targetOfferCount: 0,
              achievement: 0,
              targetCount: 0
            };
          }

          const actual = await TargetController.getZoneActualPerformance(
            zone.id,
            actualPeriod,
            actualPeriodType,
            undefined // Overall performance (no product filter)
          );

          const totalOffers = await TargetController.getZoneTotalOffers(
            zone.id,
            actualPeriod,
            actualPeriodType,
            undefined // Overall performance (no product filter)
          );

          // If zone has targets, determine the total target value
          if (zoneTargets.length > 0) {
            // Check if there's an overall target (productType is null)
            const overallTarget = zoneTargets.find((t: any) => t.productType === null || t.productType === undefined);
            const productSpecificTargets = zoneTargets.filter((t: any) => t.productType !== null && t.productType !== undefined);

            // Use overall target if it exists, otherwise sum product-specific targets
            // This prevents double-counting when both overall and product-specific targets exist
            let totalTargetValue: number;
            if (overallTarget) {
              totalTargetValue = toNumber(overallTarget.targetValue);
            } else {
              totalTargetValue = productSpecificTargets.reduce((sum: number, t: any) => sum + toNumber(t.targetValue), 0);
            }

            const isMonthlyView = actualValuePeriod && String(actualValuePeriod).includes('-');
            return {
              id: overallTarget?.id || zoneTargets[0].id, // Prefer overall target's ID
              serviceZoneId: zone.id,
              targetPeriod: isMonthlyView ? (actualValuePeriod as string) : (targetPeriod as string),
              periodType: isMonthlyView ? 'MONTHLY' : (periodType as string),
              serviceZone: zone,
              targetValue: totalTargetValue, // Keep yearly value, will divide in grouped response if needed
              actualValue: actual.value,
              actualOfferCount: actual.count,
              totalOffers: totalOffers,
              targetOfferCount: zoneTargets.reduce((sum: number, t: any) => sum + (t.targetOfferCount || 0), 0),
              achievement: totalTargetValue > 0 ? (actual.value / totalTargetValue) * 100 : 0,
              targetCount: zoneTargets.length,
              hasOverallTarget: !!overallTarget,
              hasProductTargets: productSpecificTargets.length > 0
            };
          } else {
            // Zone has no targets - show with 0 target value
            return {
              id: null,
              serviceZoneId: zone.id,
              targetPeriod: targetPeriod as string,
              periodType: periodType as string,
              serviceZone: zone,
              targetValue: 0,
              actualValue: actual.value,
              actualOfferCount: actual.count,
              totalOffers: totalOffers,
              targetOfferCount: 0,
              achievement: 0, // No target = 0% achievement
              targetCount: 0
            };
          }
        })
      );

      // If grouped, aggregate by zone
      if (grouped === 'true') {
        const groupedTargets: any = {};

        targetsWithActuals.forEach((target) => {
          const key = target.serviceZoneId;
          if (!groupedTargets[key]) {
            groupedTargets[key] = {
              id: target.id,
              serviceZoneId: target.serviceZoneId,
              targetPeriod: target.targetPeriod,
              periodType: target.periodType,
              serviceZone: target.serviceZone,
              targetValue: 0,
              actualValue: 0,
              targetOfferCount: 0,
              actualOfferCount: 0,
              totalOffers: 0,
              targetCount: 0
            };
          }
          groupedTargets[key].targetValue += target.targetValue;
          groupedTargets[key].actualValue += target.actualValue;
          groupedTargets[key].targetOfferCount += (target.targetOfferCount || 0);
          groupedTargets[key].actualOfferCount += target.actualOfferCount;
          groupedTargets[key].totalOffers += (target.totalOffers || 0);
          groupedTargets[key].targetCount += 1;
        });

        const result = await Promise.all(Object.values(groupedTargets).map(async (t: any) => {
          // For monthly view, divide target by 12
          const isMonthlyView = t.periodType === 'MONTHLY';
          const displayTargetValue = isMonthlyView ? Math.round(t.targetValue / 12) : t.targetValue;
          const variance = t.actualValue - displayTargetValue;
          const variancePercentage = displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0;

          // Get comprehensive metrics for this zone
          const metrics = await TargetController.getZoneMetrics(
            t.serviceZoneId,
            t.targetPeriod,
            t.periodType
          );

          // Calculate achievement percentages
          const achievement = displayTargetValue > 0 ? (t.actualValue / displayTargetValue) * 100 : 0;
          const expectedAchievement = displayTargetValue > 0 ? (metrics.expectedOffers / displayTargetValue) * 100 : 0;

          return {
            id: t.id,
            serviceZoneId: t.serviceZoneId,
            targetPeriod: t.targetPeriod,
            periodType: t.periodType,
            serviceZone: t.serviceZone,
            targetValue: displayTargetValue,
            actualValue: t.actualValue,
            targetOfferCount: t.targetOfferCount,
            actualOfferCount: t.actualOfferCount,
            totalOffers: t.totalOffers,
            targetCount: t.targetCount,
            achievement: achievement,
            expectedAchievement: expectedAchievement,
            variance: variance,
            variancePercentage: variancePercentage,
            // New comprehensive metrics
            metrics: {
              noOfOffers: metrics.totalOffers,
              offersValue: metrics.totalOffersValue,
              ordersReceived: metrics.ordersReceived,
              expectedOffers: metrics.expectedOffers,
              openFunnel: metrics.openFunnel,
              orderBooking: metrics.orderBooking,
              balanceBU: displayTargetValue - t.actualValue
            }
          };
        }));

        return res.json({
          success: true,
          targets: result
        });
      }

      // If not grouped, return individual targets with their actual performance
      const individualTargets = await Promise.all(
        existingTargets.map(async (target: any) => {
          // Use actualValuePeriod for monthly view, otherwise use target's period
          const actualPeriod = actualValuePeriod as string || target.targetPeriod;
          const actualPeriodType = actualValuePeriod ? 'MONTHLY' : target.periodType;

          // Skip if trying to use yearly period with monthly period type
          if (actualPeriodType === 'MONTHLY' && !actualPeriod.includes('-')) {
            const isMonthlyView = actualValuePeriod && String(actualValuePeriod).includes('-');
            // Use toNumber helper for proper Decimal conversion
            const displayTargetValue = isMonthlyView ? Math.round(toNumber(target.targetValue) / 12) : toNumber(target.targetValue);
            const variance = 0 - displayTargetValue;
            return {
              id: target.id,
              serviceZoneId: target.serviceZoneId,
              targetPeriod: target.targetPeriod,
              periodType: target.periodType,
              productType: target.productType,
              targetValue: displayTargetValue,
              targetOfferCount: target.targetOfferCount,
              actualValue: 0,
              actualOfferCount: 0,
              achievement: 0,
              variance: variance,
              variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0,
              serviceZone: target.serviceZone
            };
          }

          const actual = await TargetController.getZoneActualPerformance(
            target.serviceZoneId,
            actualPeriod,
            actualPeriodType,
            target.productType // Include product type filter for individual targets
          );

          // For monthly view, divide target by 12 before calculating variance
          const isMonthlyView = actualValuePeriod && String(actualValuePeriod).includes('-');
          // Use toNumber helper for proper Decimal conversion
          const displayTargetValue = isMonthlyView ? Math.round(toNumber(target.targetValue) / 12) : toNumber(target.targetValue);
          const variance = actual.value - displayTargetValue;
          return {
            id: target.id,
            serviceZoneId: target.serviceZoneId,
            targetPeriod: target.targetPeriod,
            periodType: target.periodType,
            productType: target.productType,
            targetValue: displayTargetValue,
            targetOfferCount: target.targetOfferCount,
            actualValue: actual.value,
            actualOfferCount: actual.count,
            achievement: displayTargetValue > 0 ? (actual.value / displayTargetValue) * 100 : 0,
            variance: variance,
            variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0,
            serviceZone: target.serviceZone
          };
        })
      );

      return res.json({
        success: true,
        targets: individualTargets
      });
    } catch (error) {
      logger.error('Get zone targets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch zone targets'
      });
    }
  }

  /**
   * Update zone target by ID
   */
  static async updateZoneTarget(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetId } = req.params;
      const { targetValue, targetOfferCount } = req.body;

      if (!targetValue) {
        return res.status(400).json({
          success: false,
          message: 'Target value is required'
        });
      }

      // Update the target
      const target = await prisma.zoneTarget.update({
        where: { id: parseInt(targetId) },
        data: {
          targetValue: new Prisma.Decimal(targetValue),
          targetOfferCount: targetOfferCount || null,
          updatedById: req.user!.id
        },
        include: {
          serviceZone: {
            select: { id: true, name: true }
          }
        }
      });

      logger.info(`Zone target ${targetId} updated by ${req.user?.email}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'ZONE_TARGET_UPDATED',
        entityType: 'ZoneTarget',
        entityId: targetId,
        details: {
          zoneId: target.serviceZoneId,
          zoneName: target.serviceZone.name,
          targetValue,
          targetOfferCount
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'Target updated successfully',
        target
      });
    } catch (error) {
      logger.error('Update zone target error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update zone target'
      });
    }
  }

  /**
   * Delete zone target
   */
  static async deleteZoneTarget(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetId } = req.params;

      await prisma.zoneTarget.delete({
        where: { id: parseInt(targetId) }
      });

      logger.info(`Zone target ${targetId} deleted by ${req.user?.email}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'ZONE_TARGET_DELETED',
        entityType: 'ZoneTarget',
        entityId: targetId,
        details: {
          targetId
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'Target deleted successfully'
      });
    } catch (error) {
      logger.error('Delete zone target error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete zone target'
      });
    }
  }

  // ==================== USER TARGETS ====================

  /**
   * Set or update user target
   */
  static async setUserTarget(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, targetPeriod, periodType, targetValue, targetOfferCount, productType } = req.body;

      if (!userId || !targetPeriod || !periodType || targetValue === undefined || targetValue === null) {
        return res.status(400).json({
          success: false,
          message: 'User ID, target period, period type, and target value are required'
        });
      }

      // Check if user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Check if target already exists (with optional product type)
      // Use findFirst when productType is null/undefined because Prisma doesn't support null in findUnique composite keys
      let existingTarget;
      if (productType) {
        existingTarget = await prisma.userTarget.findFirst({
          where: {
            userId: parseInt(userId),
            targetPeriod,
            periodType,
            productType: productType
          }
        });
      } else {
        existingTarget = await prisma.userTarget.findFirst({
          where: {
            userId: parseInt(userId),
            targetPeriod,
            periodType,
            productType: null
          }
        });
      }

      let target;
      if (existingTarget) {
        // Update existing target
        target = await prisma.userTarget.update({
          where: { id: existingTarget.id },
          data: {
            targetValue: new Prisma.Decimal(targetValue),
            targetOfferCount: targetOfferCount || null,
            productType: productType || null,
            updatedById: req.user.id
          },
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        });
      } else {
        // Create new target
        target = await prisma.userTarget.create({
          data: {
            userId: parseInt(userId),
            targetPeriod,
            periodType,
            productType: productType || null,
            targetValue: new Prisma.Decimal(targetValue),
            targetOfferCount: targetOfferCount || null,
            createdById: req.user.id,
            updatedById: req.user.id
          },
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        });
      }

      logger.info(`User target ${existingTarget ? 'updated' : 'created'} for user ${userId} by ${req.user?.email}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: existingTarget ? 'USER_TARGET_UPDATED' : 'USER_TARGET_SET',
        entityType: 'UserTarget',
        entityId: target.id.toString(),
        details: {
          targetUserId: userId,
          targetUserName: target.user.name,
          period: targetPeriod,
          periodType,
          productType,
          value: targetValue
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: `Target ${existingTarget ? 'updated' : 'created'} successfully`,
        target
      });
    } catch (error) {
      logger.error('Set user target error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to set user target'
      });
    }
  }

  /**
   * Get all user targets with actual performance - shows ALL users regardless of targets
   */
  static async getUserTargets(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetPeriod, periodType, grouped, actualValuePeriod, zoneId } = req.query;

      if (!targetPeriod || !periodType) {
        return res.status(400).json({
          success: false,
          message: 'Target period and period type are required'
        });
      }

      // Get ALL active zone users and zone managers
      const whereUsers: any = {
        isActive: true,
        role: { in: ['ZONE_USER', 'ZONE_MANAGER'] }
      };

      // For zone managers viewing their zone, also include zone manager targets
      if ((req.user?.role === 'ZONE_USER' || req.user?.role === 'ZONE_MANAGER') && req.user?.zoneId) {
        whereUsers.serviceZones = {
          some: {
            serviceZoneId: parseInt(req.user.zoneId.toString())
          }
        };
      } else if (zoneId && zoneId !== 'all') {
        // For admin users, filter by selected zone if provided
        whereUsers.serviceZones = {
          some: {
            serviceZoneId: parseInt(zoneId as string)
          }
        };
      }

      const allUsers = await prisma.user.findMany({
        where: whereUsers,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          serviceZones: {
            select: {
              serviceZone: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      // Get existing targets for the period
      const whereTargets: any = {
        targetPeriod: targetPeriod as string,
        periodType: periodType as any
      };

      if ((req.user?.role === 'ZONE_USER' || req.user?.role === 'ZONE_MANAGER') && req.user?.zoneId) {
        whereTargets.user = {
          serviceZones: {
            some: {
              serviceZoneId: parseInt(req.user.zoneId.toString())
            }
          }
        };
      }

      const existingTargets = await prisma.userTarget.findMany({
        where: whereTargets,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              serviceZones: {
                select: {
                  serviceZone: {
                    select: { id: true, name: true }
                  }
                }
              }
            }
          }
        }
      });

      // Create a map of existing targets by user ID
      const targetsByUser = new Map();
      existingTargets.forEach(target => {
        const key = target.userId;
        if (!targetsByUser.has(key)) {
          targetsByUser.set(key, []);
        }
        targetsByUser.get(key).push(target);
      });

      // Build complete list with actual performance for ALL users
      const targetsWithActuals = await Promise.all(
        allUsers.map(async (user: any) => {
          const userTargets = targetsByUser.get(user.id) || [];

          // Calculate actual performance for this user
          // Use actualValuePeriod for monthly view, otherwise use targetPeriod
          const actualPeriod = actualValuePeriod as string || targetPeriod as string;
          const actualPeriodType = actualValuePeriod ? 'MONTHLY' : periodType as string;

          // Skip if trying to use yearly period with monthly period type
          if (actualPeriodType === 'MONTHLY' && !actualPeriod.includes('-')) {
            return {
              id: null,
              userId: user.id,
              targetPeriod: targetPeriod as string,
              periodType: periodType as string,
              user: user,
              targetValue: 0,
              actualValue: 0,
              actualOfferCount: 0,
              targetOfferCount: 0,
              achievement: 0,
              targetCount: 0
            };
          }

          const actual = await TargetController.getUserActualPerformance(
            user.id,
            actualPeriod,
            actualPeriodType,
            undefined // Overall performance (no product filter)
          );

          const totalOffers = await TargetController.getUserTotalOffers(
            user.id,
            actualPeriod,
            actualPeriodType,
            undefined // Overall performance (no product filter)
          );

          // If user has targets, determine the total target value
          if (userTargets.length > 0) {
            // Check if there's an overall target (productType is null)
            const overallTarget = userTargets.find((t: any) => t.productType === null || t.productType === undefined);
            const productSpecificTargets = userTargets.filter((t: any) => t.productType !== null && t.productType !== undefined);

            // Use overall target if it exists, otherwise sum product-specific targets
            // This prevents double-counting when both overall and product-specific targets exist
            let totalTargetValue: number;
            if (overallTarget) {
              totalTargetValue = toNumber(overallTarget.targetValue);
            } else {
              totalTargetValue = productSpecificTargets.reduce((sum: number, t: any) => sum + toNumber(t.targetValue), 0);
            }

            const isMonthlyView = actualValuePeriod && String(actualValuePeriod).includes('-');
            return {
              id: overallTarget?.id || userTargets[0].id, // Prefer overall target's ID
              userId: user.id,
              targetPeriod: isMonthlyView ? (actualValuePeriod as string) : (targetPeriod as string),
              periodType: isMonthlyView ? 'MONTHLY' : (periodType as string),
              user: user,
              targetValue: totalTargetValue, // Keep yearly value, will divide in grouped response if needed
              actualValue: actual.value,
              actualOfferCount: actual.count,
              totalOffers: totalOffers,
              targetOfferCount: userTargets.reduce((sum: number, t: any) => sum + (t.targetOfferCount || 0), 0),
              achievement: totalTargetValue > 0 ? (actual.value / totalTargetValue) * 100 : 0,
              targetCount: userTargets.length,
              hasOverallTarget: !!overallTarget,
              hasProductTargets: productSpecificTargets.length > 0
            };
          } else {
            // User has no targets - show with 0 target value
            return {
              id: null,
              userId: user.id,
              targetPeriod: targetPeriod as string,
              periodType: periodType as string,
              user: user,
              targetValue: 0,
              actualValue: actual.value,
              actualOfferCount: actual.count,
              totalOffers: totalOffers,
              targetOfferCount: 0,
              achievement: 0, // No target = 0% achievement
              targetCount: 0
            };
          }
        })
      );

      // If grouped, aggregate by user
      if (grouped === 'true') {
        const groupedTargets: any = {};

        targetsWithActuals.forEach((target) => {
          const key = target.userId;
          if (!groupedTargets[key]) {
            groupedTargets[key] = {
              id: target.id,
              userId: target.userId,
              targetPeriod: target.targetPeriod,
              periodType: target.periodType,
              user: target.user,
              targetValue: 0,
              actualValue: 0,
              targetOfferCount: 0,
              actualOfferCount: 0,
              totalOffers: 0,
              targetCount: 0
            };
          }
          groupedTargets[key].targetValue += target.targetValue;
          groupedTargets[key].actualValue += target.actualValue;
          groupedTargets[key].targetOfferCount += (target.targetOfferCount || 0);
          groupedTargets[key].actualOfferCount += target.actualOfferCount;
          groupedTargets[key].totalOffers += (target.totalOffers || 0);
          groupedTargets[key].targetCount += 1;
        });

        const result = await Promise.all(Object.values(groupedTargets).map(async (t: any) => {
          const isMonthlyView = t.periodType === 'MONTHLY';
          const displayTargetValue = isMonthlyView ? Math.round(t.targetValue / 12) : t.targetValue;
          const variance = t.actualValue - displayTargetValue;
          const variancePercentage = displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0;

          // Get comprehensive metrics for this user
          const metrics = await TargetController.getUserMetrics(
            t.userId,
            t.targetPeriod,
            t.periodType
          );

          // Calculate achievement percentage (user-specific only)
          const achievement = displayTargetValue > 0 ? (t.actualValue / displayTargetValue) * 100 : 0;
          const expectedAchievement = displayTargetValue > 0 ? (metrics.expectedOffers / displayTargetValue) * 100 : 0;

          return {
            id: t.id,
            userId: t.userId,
            targetPeriod: t.targetPeriod,
            periodType: t.periodType,
            user: t.user,
            targetValue: displayTargetValue,
            actualValue: t.actualValue,
            targetOfferCount: t.targetOfferCount,
            actualOfferCount: t.actualOfferCount,
            totalOffers: t.totalOffers,
            targetCount: t.targetCount,
            achievement: achievement,
            expectedAchievement: expectedAchievement,
            variance: variance,
            variancePercentage: variancePercentage,
            // User-specific comprehensive metrics
            metrics: {
              noOfOffers: metrics.totalOffers,
              offersValue: metrics.totalOffersValue,
              ordersReceived: metrics.ordersReceived,
              expectedOffers: metrics.expectedOffers,
              openFunnel: metrics.openFunnel,
              orderBooking: metrics.orderBooking,
              balanceBU: displayTargetValue - t.actualValue
            }
          };
        }));

        return res.json({
          success: true,
          targets: result
        });
      }

      // If not grouped, return individual targets with their actual performance
      const individualTargets = await Promise.all(
        existingTargets.map(async (target: any) => {
          // Use actualValuePeriod for monthly view, otherwise use target's period
          const actualPeriod = actualValuePeriod as string || target.targetPeriod;
          const actualPeriodType = actualValuePeriod ? 'MONTHLY' : target.periodType;

          // Skip if trying to use yearly period with monthly period type
          if (actualPeriodType === 'MONTHLY' && !actualPeriod.includes('-')) {
            const isMonthlyView = actualValuePeriod && String(actualValuePeriod).includes('-');
            const displayTargetValue = isMonthlyView ? Math.round(toNumber(target.targetValue) / 12) : toNumber(target.targetValue);
            const variance = 0 - displayTargetValue;
            return {
              id: target.id,
              userId: target.userId,
              targetPeriod: target.targetPeriod,
              periodType: target.periodType,
              productType: target.productType,
              targetValue: displayTargetValue,
              targetOfferCount: target.targetOfferCount,
              actualValue: 0,
              actualOfferCount: 0,
              achievement: 0,
              variance: variance,
              variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0,
              user: target.user
            };
          }

          const actual = await TargetController.getUserActualPerformance(
            target.userId,
            actualPeriod,
            actualPeriodType,
            target.productType // Include product type filter for individual targets
          );

          // For monthly view, divide target by 12 before calculating variance
          const isMonthlyView = actualValuePeriod && String(actualValuePeriod).includes('-');
          const displayTargetValue = isMonthlyView ? Math.round(toNumber(target.targetValue) / 12) : toNumber(target.targetValue);
          const variance = actual.value - displayTargetValue;
          return {
            id: target.id,
            userId: target.userId,
            targetPeriod: target.targetPeriod,
            periodType: target.periodType,
            productType: target.productType,
            targetValue: displayTargetValue,
            targetOfferCount: target.targetOfferCount,
            actualValue: actual.value,
            actualOfferCount: actual.count,
            achievement: displayTargetValue > 0 ? (actual.value / displayTargetValue) * 100 : 0,
            variance: variance,
            variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0,
            user: target.user
          };
        })
      );

      return res.json({
        success: true,
        targets: individualTargets
      });
    } catch (error) {
      logger.error('Get user targets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user targets'
      });
    }
  }

  /**
   * Update user target by ID
   */
  static async updateUserTarget(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetId } = req.params;
      const { targetValue, targetOfferCount } = req.body;

      if (!targetValue) {
        return res.status(400).json({
          success: false,
          message: 'Target value is required'
        });
      }

      // Update the target
      const target = await prisma.userTarget.update({
        where: { id: parseInt(targetId) },
        data: {
          targetValue: new Prisma.Decimal(targetValue),
          targetOfferCount: targetOfferCount || null,
          updatedById: req.user!.id
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      logger.info(`User target ${targetId} updated by ${req.user?.email}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'USER_TARGET_UPDATED',
        entityType: 'UserTarget',
        entityId: targetId,
        details: {
          targetUserId: target.userId,
          targetUserName: target.user.name,
          targetValue,
          targetOfferCount
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'Target updated successfully',
        target
      });
    } catch (error) {
      logger.error('Update user target error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user target'
      });
    }
  }

  /**
   * Delete user target
   */
  static async deleteUserTarget(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetId } = req.params;

      await prisma.userTarget.delete({
        where: { id: parseInt(targetId) }
      });

      logger.info(`User target ${targetId} deleted by ${req.user?.email}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'USER_TARGET_DELETED',
        entityType: 'UserTarget',
        entityId: targetId,
        details: {
          targetId
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'Target deleted successfully'
      });
    } catch (error) {
      logger.error('Delete user target error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user target'
      });
    }
  }

  // ==================== PRODUCT TYPE TARGETS ====================

  // ==================== ANALYTICS & DASHBOARD ====================

  /**
   * Get detailed zone target breakdown by product type
   */
  static async getZoneTargetDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { zoneId } = req.params;
      const { targetPeriod, periodType } = req.query;

      if (!zoneId || !targetPeriod || !periodType) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID, target period, and period type are required'
        });
      }

      const serviceZoneId = parseInt(zoneId as string);

      // Get zone info
      const zone = await prisma.serviceZone.findUnique({
        where: { id: serviceZoneId },
        select: { id: true, name: true, shortForm: true }
      });

      if (!zone) {
        return res.status(404).json({
          success: false,
          message: 'Zone not found'
        });
      }

      // Enforce access for zone roles: can only access their own zone
      if ((req.user?.role === 'ZONE_USER' || req.user?.role === 'ZONE_MANAGER') && req.user?.zoneId) {
        const userZoneId = parseInt(req.user.zoneId.toString());
        if (serviceZoneId !== userZoneId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }

      // Get all targets for this zone (including product-specific)
      const allTargets = await prisma.zoneTarget.findMany({
        where: {
          serviceZoneId,
          targetPeriod: targetPeriod as string,
          periodType: periodType as 'MONTHLY' | 'YEARLY'
        }
      });

      // Get all product types from the system
      const dateFilter = TargetController.buildDateFilter(targetPeriod as string, periodType as string);

      // All possible product types from the enum
      const allPossibleProductTypes = [
        'RELOCATION',
        'CONTRACT',
        'SPARE_PARTS',
        'KARDEX_CONNECT',
        'UPGRADE_KIT',
        'SOFTWARE',
        'OTHERS',
        'BD_SPARE',
        'RETROFIT_KIT'
      ];

      // Get product types from offers in this zone
      const offerProductTypes = await prisma.offer.findMany({
        where: {
          zoneId: serviceZoneId,
          stage: { in: ['WON', 'PO_RECEIVED'] },
          OR: [
            { poDate: { gte: dateFilter.gte, lte: dateFilter.lte } },
            { bookingDateInSap: { gte: dateFilter.gte, lte: dateFilter.lte } },
            { offerClosedInCrm: { gte: dateFilter.gte, lte: dateFilter.lte } },
            { createdAt: { gte: dateFilter.gte, lte: dateFilter.lte } }
          ]
        },
        select: { productType: true },
        distinct: ['productType']
      });

      // Get product types from targets for this zone
      const targetProductTypes = allTargets
        .filter(t => t.productType)
        .map(t => ({ productType: t.productType }));

      // Combine all product types and deduplicate
      const allProductTypesSet = new Set<string | null>();
      allPossibleProductTypes.forEach(pt => allProductTypesSet.add(pt));
      offerProductTypes.forEach(pt => allProductTypesSet.add(pt.productType));
      targetProductTypes.forEach(pt => allProductTypesSet.add(pt.productType));

      const allProductTypes = Array.from(allProductTypesSet)
        .sort((a, b) => {
          // Sort with 'Overall' first, then alphabetically
          if (a === null) return -1;
          if (b === null) return 1;
          return (a || '').localeCompare(b || '');
        })
        .map(pt => ({ productType: pt }));

      // Build target details for each product type
      const targetDetails = await Promise.all(
        allProductTypes.map(async (pt) => {
          const productType = pt.productType || undefined;
          const target = allTargets.find(t => t.productType === productType);
          const actual = await TargetController.getZoneActualPerformance(
            serviceZoneId,
            targetPeriod as string,
            periodType as string,
            productType
          );

          const targetValue = target ? Number(target.targetValue) : 0;
          const isMonthlyView = (periodType as string) === 'MONTHLY' || (targetPeriod as string).includes('-');
          const displayTargetValue = isMonthlyView ? Math.round(targetValue / 12) : targetValue;
          const variance = actual.value - displayTargetValue;

          return {
            productType: productType || 'Overall',
            targetValue: displayTargetValue,
            actualValue: actual.value,
            actualOfferCount: actual.count,
            targetOfferCount: target?.targetOfferCount || 0,
            achievement: displayTargetValue > 0 ? (actual.value / displayTargetValue) * 100 : 0,
            variance: variance,
            variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0
          };
        })
      );

      // Also include overall target if exists
      const overallTarget = allTargets.find(t => !t.productType);
      if (overallTarget && !targetDetails.some(t => t.productType === 'Overall')) {
        const actual = await TargetController.getZoneActualPerformance(
          serviceZoneId,
          targetPeriod as string,
          periodType as string,
          undefined
        );

        const targetValue = Number(overallTarget.targetValue);
        const isMonthlyView = (periodType as string) === 'MONTHLY' || (targetPeriod as string).includes('-');
        const displayTargetValue = isMonthlyView ? Math.round(targetValue / 12) : targetValue;
        const variance = actual.value - displayTargetValue;

        targetDetails.unshift({
          productType: 'Overall',
          targetValue: displayTargetValue,
          actualValue: actual.value,
          actualOfferCount: actual.count,
          targetOfferCount: overallTarget.targetOfferCount || 0,
          achievement: displayTargetValue > 0 ? (actual.value / displayTargetValue) * 100 : 0,
          variance: variance,
          variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0
        });
      }

      // Calculate summary
      const summary = {
        totalTargets: targetDetails.length,
        totalTargetValue: targetDetails.reduce((sum, t) => sum + t.targetValue, 0),
        totalActualValue: targetDetails.reduce((sum, t) => sum + t.actualValue, 0),
        totalAchievement: 0
      };
      summary.totalAchievement = summary.totalTargetValue > 0
        ? (summary.totalActualValue / summary.totalTargetValue) * 100
        : 0;

      return res.json({
        success: true,
        data: {
          zone,
          targets: targetDetails,
          summary,
          period: { targetPeriod, periodType }
        }
      });
    } catch (error) {
      logger.error('Get zone target details error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch zone target details'
      });
    }
  }

  /**
   * Get detailed user target breakdown by product type
   */
  static async getUserTargetDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { targetPeriod, periodType } = req.query;

      if (!userId || !targetPeriod || !periodType) {
        return res.status(400).json({
          success: false,
          message: 'User ID, target period, and period type are required'
        });
      }

      const uid = parseInt(userId as string);

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: {
          id: true,
          name: true,
          email: true,
          serviceZones: {
            select: {
              serviceZone: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Enforce access for zone roles: can only access users within their zone
      if ((req.user?.role === 'ZONE_USER' || req.user?.role === 'ZONE_MANAGER') && req.user?.zoneId) {
        const userZoneId = parseInt(req.user.zoneId.toString());
        const belongsToZone = user.serviceZones?.some(sz => sz.serviceZone?.id === userZoneId);
        if (!belongsToZone) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }

      // Get all targets for this user (including product-specific)
      const allTargets = await prisma.userTarget.findMany({
        where: {
          userId: uid,
          targetPeriod: targetPeriod as string,
          periodType: periodType as 'MONTHLY' | 'YEARLY'
        }
      });

      // Get all product types from the system
      const dateFilter = TargetController.buildDateFilter(targetPeriod as string, periodType as string);

      // All possible product types from the enum
      const allPossibleProductTypes = [
        'RELOCATION',
        'CONTRACT',
        'SPARE_PARTS',
        'KARDEX_CONNECT',
        'UPGRADE_KIT',
        'SOFTWARE',
        'OTHERS',
        'BD_SPARE',
        'RETROFIT_KIT'
      ];

      // Get product types from offers created by this user
      const offerProductTypes = await prisma.offer.findMany({
        where: {
          createdById: uid,
          stage: { in: ['WON', 'PO_RECEIVED'] },
          OR: [
            { poDate: { gte: dateFilter.gte, lte: dateFilter.lte } },
            { bookingDateInSap: { gte: dateFilter.gte, lte: dateFilter.lte } },
            { offerClosedInCrm: { gte: dateFilter.gte, lte: dateFilter.lte } },
            { createdAt: { gte: dateFilter.gte, lte: dateFilter.lte } }
          ]
        },
        select: { productType: true },
        distinct: ['productType']
      });

      // Get product types from targets for this user
      const targetProductTypes = allTargets
        .filter(t => t.productType)
        .map(t => ({ productType: t.productType }));

      // Combine all product types and deduplicate
      const allProductTypesSet = new Set<string | null>();
      allPossibleProductTypes.forEach(pt => allProductTypesSet.add(pt));
      offerProductTypes.forEach(pt => allProductTypesSet.add(pt.productType));
      targetProductTypes.forEach(pt => allProductTypesSet.add(pt.productType));

      const allProductTypes = Array.from(allProductTypesSet)
        .sort((a, b) => {
          // Sort with 'Overall' first, then alphabetically
          if (a === null) return -1;
          if (b === null) return 1;
          return (a || '').localeCompare(b || '');
        })
        .map(pt => ({ productType: pt }));

      // Build target details for each product type
      const targetDetails = await Promise.all(
        allProductTypes.map(async (pt) => {
          const productType = pt.productType || undefined;
          const target = allTargets.find(t => t.productType === productType);
          const actual = await TargetController.getUserActualPerformance(
            uid,
            targetPeriod as string,
            periodType as string,
            productType
          );

          const targetValue = target ? Number(target.targetValue) : 0;
          const isMonthlyView = (periodType as string) === 'MONTHLY' || (targetPeriod as string).includes('-');
          const displayTargetValue = isMonthlyView ? Math.round(targetValue / 12) : targetValue;
          const variance = actual.value - displayTargetValue;

          return {
            productType: productType || 'Overall',
            targetValue: displayTargetValue,
            actualValue: actual.value,
            actualOfferCount: actual.count,
            targetOfferCount: target?.targetOfferCount || 0,
            achievement: displayTargetValue > 0 ? (actual.value / displayTargetValue) * 100 : 0,
            variance: variance,
            variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0
          };
        })
      );

      // Also include overall target if exists
      const overallTarget = allTargets.find(t => !t.productType);
      if (overallTarget && !targetDetails.some(t => t.productType === 'Overall')) {
        const actual = await TargetController.getUserActualPerformance(
          uid,
          targetPeriod as string,
          periodType as string,
          undefined
        );

        const targetValue = Number(overallTarget.targetValue);
        const isMonthlyView = (periodType as string) === 'MONTHLY' || (targetPeriod as string).includes('-');
        const displayTargetValue = isMonthlyView ? Math.round(targetValue / 12) : targetValue;
        const variance = actual.value - displayTargetValue;

        targetDetails.unshift({
          productType: 'Overall',
          targetValue: displayTargetValue,
          actualValue: actual.value,
          actualOfferCount: actual.count,
          targetOfferCount: overallTarget.targetOfferCount || 0,
          achievement: displayTargetValue > 0 ? (actual.value / displayTargetValue) * 100 : 0,
          variance: variance,
          variancePercentage: displayTargetValue > 0 ? (variance / displayTargetValue) * 100 : 0
        });
      }

      // Calculate summary
      const summary = {
        totalTargets: targetDetails.length,
        totalTargetValue: targetDetails.reduce((sum, t) => sum + t.targetValue, 0),
        totalActualValue: targetDetails.reduce((sum, t) => sum + t.actualValue, 0),
        totalAchievement: 0
      };
      summary.totalAchievement = summary.totalTargetValue > 0
        ? (summary.totalActualValue / summary.totalTargetValue) * 100
        : 0;

      return res.json({
        success: true,
        data: {
          user,
          targets: targetDetails,
          summary,
          period: { targetPeriod, periodType }
        }
      });
    } catch (error) {
      logger.error('Get user target details error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user target details'
      });
    }
  }

  /**
   * Get comprehensive target dashboard
   */
  static async getTargetDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetPeriod, periodType } = req.query;

      if (!targetPeriod || !periodType) {
        return res.status(400).json({
          success: false,
          message: 'Target period and period type are required'
        });
      }

      // Fetch all targets for the period
      const [zoneTargets, userTargets] = await Promise.all([
        prisma.zoneTarget.findMany({
          where: { targetPeriod: targetPeriod as string, periodType: periodType as any },
          include: { serviceZone: { select: { id: true, name: true } } }
        }),
        prisma.userTarget.findMany({
          where: { targetPeriod: targetPeriod as string, periodType: periodType as any },
          include: { user: { select: { id: true, name: true, email: true } } }
        })
      ]);

      // Calculate actuals for each category
      const zonePerformance = await Promise.all(
        zoneTargets.map(async (target: any) => {
          const actual = await TargetController.getZoneActualPerformance(
            target.serviceZoneId,
            target.targetPeriod,
            target.periodType,
            target.productType
          );
          return {
            id: target.id,
            name: target.serviceZone.name,
            targetValue: Number(target.targetValue),
            actualValue: actual.value,
            targetOfferCount: target.targetOfferCount,
            actualOfferCount: actual.count,
            achievement: Number(target.targetValue) > 0 ? (actual.value / Number(target.targetValue)) * 100 : 0
          };
        })
      );

      const userPerformance = await Promise.all(
        userTargets.map(async (target: any) => {
          const actual = await TargetController.getUserActualPerformance(
            target.userId,
            target.targetPeriod,
            target.periodType,
            target.productType
          );
          return {
            id: target.id,
            name: target.user.name || target.user.email,
            targetValue: Number(target.targetValue),
            actualValue: actual.value,
            targetOfferCount: target.targetOfferCount,
            actualOfferCount: actual.count,
            achievement: Number(target.targetValue) > 0 ? (actual.value / Number(target.targetValue)) * 100 : 0
          };
        })
      );

      // Calculate overall statistics
      const totalTargetValue =
        zonePerformance.reduce((sum, z) => sum + z.targetValue, 0) +
        userPerformance.reduce((sum, u) => sum + u.targetValue, 0);

      const totalActualValue =
        zonePerformance.reduce((sum, z) => sum + z.actualValue, 0) +
        userPerformance.reduce((sum, u) => sum + u.actualValue, 0);

      const overallAchievement = totalTargetValue > 0 ? (totalActualValue / totalTargetValue) * 100 : 0;

      return res.json({
        success: true,
        dashboard: {
          period: targetPeriod,
          periodType,
          overall: {
            totalTargetValue,
            totalActualValue,
            achievement: overallAchievement
          },
          zones: zonePerformance,
          users: userPerformance
        }
      });
    } catch (error) {
      logger.error('Get target dashboard error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch target dashboard'
      });
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get total offers count for a zone
   */
  static async getZoneTotalOffers(
    serviceZoneId: number,
    targetPeriod: string,
    periodType: string,
    productType?: string
  ): Promise<number> {
    try {
      const dateFilter = TargetController.buildDateFilter(targetPeriod, periodType);
      const startDate: Date = dateFilter.gte;
      const endDate: Date = dateFilter.lte;

      const whereClause: any = {
        zoneId: serviceZoneId,
        createdAt: { gte: startDate, lte: endDate },
        ...(productType ? { productType } : {}),
      };

      const count = await prisma.offer.count({
        where: whereClause,
      });

      return count;
    } catch (error) {
      logger.error('Get zone total offers error:', error);
      return 0;
    }
  }

  /**
   * Get actual performance for a zone
   */
  static async getZoneActualPerformance(
    serviceZoneId: number,
    targetPeriod: string,
    periodType: string,
    productType?: string
  ): Promise<{ value: number; count: number }> {
    try {
      const dateFilter = TargetController.buildDateFilter(targetPeriod, periodType);
      const startDate: Date = dateFilter.gte;
      const endDate: Date = dateFilter.lte;

      // Build where clause using correct period fields
      const whereClause: any = {
        zoneId: serviceZoneId,
        stage: { in: ['WON', 'PO_RECEIVED'] },
        ...(productType ? { productType } : {}),
        OR: [
          // PO-based stages: use poDate
          {
            AND: [
              { stage: 'PO_RECEIVED' },
              { poDate: { gte: startDate, lte: endDate } },
            ],
          },
          // WON stage: use offerClosedInCrm
          {
            AND: [
              { stage: 'WON' },
              { offerClosedInCrm: { gte: startDate, lte: endDate } },
            ],
          },
          // Fallback: if above dates missing, use createdAt
          {
            AND: [
              {
                OR: [
                  { poDate: null },
                  { offerClosedInCrm: null },
                  { bookingDateInSap: null },
                ]
              },
              { createdAt: { gte: startDate, lte: endDate } },
            ],
          },
        ],
      };

      const offers = await prisma.offer.findMany({
        where: whereClause,
        select: {
          id: true,
          stage: true,
          poValue: true,
          offerValue: true,
          createdAt: true,
          offerClosedInCrm: true,
          poDate: true,
          bookingDateInSap: true,
        },
      });

      // Filter and calculate actual performance
      let totalValue = 0;
      let count = 0;

      for (const offer of offers) {
        const value = offer.poValue ? Number(offer.poValue) : (offer.offerValue ? Number(offer.offerValue) : 0);
        if (value > 0) {
          totalValue += value;
          count++;
        }
      }

      return {
        value: totalValue,
        count: count
      };
    } catch (error: any) {
      logger.error(`Error getting zone actual performance: ${error.message}`, { serviceZoneId, targetPeriod, periodType, productType });
      return { value: 0, count: 0 };
    }
  }

  /**
   * Get total offers count for a user
   */
  static async getUserTotalOffers(
    userId: number,
    targetPeriod: string,
    periodType: string,
    productType?: string
  ): Promise<number> {
    try {
      const dateFilter = TargetController.buildDateFilter(targetPeriod, periodType);
      const startDate: Date = dateFilter.gte;
      const endDate: Date = dateFilter.lte;

      const whereClause: any = {
        createdById: userId,
        createdAt: { gte: startDate, lte: endDate },
        ...(productType ? { productType } : {}),
      };

      const count = await prisma.offer.count({
        where: whereClause,
      });

      return count;
    } catch (error) {
      logger.error('Get user total offers error:', error);
      return 0;
    }
  }

  /**
   * Get actual performance for a user
   */
  static async getUserActualPerformance(
    userId: number,
    targetPeriod: string,
    periodType: string,
    productType?: string
  ): Promise<{ value: number; count: number }> {
    try {
      const dateFilter = TargetController.buildDateFilter(targetPeriod, periodType);
      const startDate: Date = dateFilter.gte;
      const endDate: Date = dateFilter.lte;

      const whereClause: any = {
        createdById: userId,
        stage: { in: ['WON', 'PO_RECEIVED'] },
        ...(productType ? { productType } : {}),
        OR: [
          {
            AND: [
              { stage: 'PO_RECEIVED' },
              { poDate: { gte: startDate, lte: endDate } },
            ],
          },
          {
            AND: [
              { stage: 'WON' },
              { offerClosedInCrm: { gte: startDate, lte: endDate } },
            ],
          },
          {
            AND: [
              {
                OR: [
                  { poDate: null },
                  { offerClosedInCrm: null },
                  { bookingDateInSap: null },
                ]
              },
              { createdAt: { gte: startDate, lte: endDate } },
            ],
          },
        ],
      };

      const offers = await prisma.offer.findMany({
        where: whereClause,
        select: {
          id: true,
          stage: true,
          poValue: true,
          offerValue: true,
          createdAt: true,
          offerClosedInCrm: true,
          poDate: true,
          bookingDateInSap: true
        }
      });

      // Filter and calculate actual performance
      let totalValue = 0;
      let count = 0;

      for (const offer of offers) {
        // Only count offers that are in successful stages
        if (['WON', 'PO_RECEIVED'].includes(offer.stage)) {
          // Use poValue if available, otherwise use offerValue (but not both)
          const value = offer.poValue ? Number(offer.poValue) :
            (offer.offerValue ? Number(offer.offerValue) : 0);

          if (value > 0) {
            totalValue += value;
            count++;
          }
        }
      }

      return {
        value: totalValue,
        count: count
      };
    } catch (error: any) {
      logger.error(`Error getting user actual performance: ${error.message}`, { userId, targetPeriod, periodType, productType });
      return { value: 0, count: 0 };
    }
  }

  /**
   * Build date filter based on period type
   */
  static buildDateFilter(targetPeriod: string, periodType: string): any {
    if (periodType === 'MONTHLY') {
      // Format: "YYYY-MM"
      if (!targetPeriod || !targetPeriod.includes('-')) {
        logger.error(`Invalid monthly period format: ${targetPeriod}. Expected YYYY-MM`);
        throw new Error(`Invalid monthly period format: ${targetPeriod}. Expected YYYY-MM`);
      }

      const parts = targetPeriod.split('-');
      if (parts.length !== 2) {
        logger.error(`Invalid monthly period format: ${targetPeriod}. Expected YYYY-MM`);
        throw new Error(`Invalid monthly period format: ${targetPeriod}. Expected YYYY-MM`);
      }

      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 1900 || year > 2100) {
        logger.error(`Invalid date values: year=${year}, month=${month} from period=${targetPeriod}`);
        throw new Error(`Invalid date values in period: ${targetPeriod}`);
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Validate the created dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        logger.error(`Failed to create valid dates from period: ${targetPeriod}`);
        throw new Error(`Failed to create valid dates from period: ${targetPeriod}`);
      }

      return {
        gte: startDate,
        lte: endDate
      };
    } else {
      // Format: "YYYY"
      const year = parseInt(targetPeriod);

      if (isNaN(year) || year < 1900 || year > 2100) {
        logger.error(`Invalid yearly period: ${targetPeriod}. Expected YYYY`);
        throw new Error(`Invalid yearly period: ${targetPeriod}. Expected YYYY`);
      }

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      // Validate the created dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        logger.error(`Failed to create valid dates from year: ${year}`);
        throw new Error(`Failed to create valid dates from year: ${year}`);
      }

      return {
        gte: startDate,
        lte: endDate
      };
    }
  }

  /**
   * Get comprehensive zone metrics for target report
   */
  static async getZoneMetrics(
    serviceZoneId: number,
    targetPeriod: string,
    periodType: string
  ): Promise<any> {
    try {
      const dateFilter = TargetController.buildDateFilter(targetPeriod, periodType);
      const startDate: Date = dateFilter.gte;
      const endDate: Date = dateFilter.lte;


      // Get all offers for this zone in the period
      // For expectedOffers, we need offers from ANY time that have poExpectedMonth matching the period
      const offers = await prisma.offer.findMany({
        where: {
          zoneId: serviceZoneId,
          createdAt: { gte: startDate, lte: endDate }
        },
        select: {
          id: true,
          stage: true,
          offerValue: true,
          poValue: true,
          poDate: true,
          bookingDateInSap: true,
          probabilityPercentage: true,
          poExpectedMonth: true
        }
      });

      // Get offers with expected PO month matching the period (for expectedOffers calculation)
      // For YEARLY: match all months in the year (e.g., "2025-01" to "2025-12" for period "2025")
      // For MONTHLY: match exact month (e.g., "2025-11" for period "2025-11")
      let expectedMonthFilter: any;

      if (periodType === 'YEARLY') {
        // For yearly, match all months starting with the year (e.g., "2025-")
        expectedMonthFilter = {
          poExpectedMonth: {
            startsWith: targetPeriod + '-'
          }
        };
      } else {
        // For monthly, match exact month
        expectedMonthFilter = {
          poExpectedMonth: targetPeriod
        };
      }

      const offersWithExpectedMonth = await prisma.offer.findMany({
        where: {
          zoneId: serviceZoneId,
          ...expectedMonthFilter
        },
        select: {
          id: true,
          offerValue: true,
          probabilityPercentage: true,
          poExpectedMonth: true
        }
      });


      // Calculate metrics
      const totalOffers = offers.length;
      const totalOffersValue = offers.reduce((sum, o) => sum + (Number(o.offerValue) || 0), 0);

      // Orders Received = WON stage offers (count)
      const ordersReceived = offers.filter(o => o.stage === 'WON').length;

      // Orders Received Value = Sum of WON stage offer values
      const ordersReceivedValue = offers
        .filter(o => o.stage === 'WON')
        .reduce((sum, o) => sum + (Number(o.offerValue) || 0), 0);

      // Open Funnel = Offers Value – Orders Received Value (CORRECT FORMULA)
      const openFunnel = totalOffersValue - ordersReceivedValue;

      // Expected Offers = Sum of (Offer Value × Probability / 100) WHERE Probability > 50% AND poExpectedMonth matches period
      const offersWithHighProbability = offersWithExpectedMonth.filter(o => (o.probabilityPercentage || 0) > 50);
      const expectedOffers = offersWithHighProbability
        .reduce((sum, o) => sum + (Number(o.offerValue) || 0) * ((Number(o.probabilityPercentage) || 0) / 100), 0);

      // YTD (Year-to-Date) - orders booked in current year
      const currentYear = new Date().getFullYear();
      const ytdStart = new Date(currentYear, 0, 1);
      const ytdEnd = new Date(currentYear, 11, 31, 23, 59, 59);
      const orderBookingYTD = offers.filter(o =>
        (o.stage === 'WON' || o.stage === 'PO_RECEIVED') &&
        o.poDate &&
        new Date(o.poDate) >= ytdStart &&
        new Date(o.poDate) <= ytdEnd
      ).length;

      return {
        totalOffers,
        totalOffersValue: Number(totalOffersValue),
        ordersReceived: Number(ordersReceivedValue),
        openFunnel: Number(openFunnel),
        expectedOffers: Number(expectedOffers),
        orderBooking: orderBookingYTD,
        periodType,
        targetPeriod
      };
    } catch (error) {
      logger.error('Get zone metrics error:', error);
      return {
        totalOffers: 0,
        totalOffersValue: 0,
        ordersReceived: 0,
        openFunnel: 0,
        expectedOffers: 0,
        orderBooking: 0
      };
    }
  }

  /**
   * Get comprehensive user metrics for target report
   */
  static async getUserMetrics(
    userId: number,
    targetPeriod: string,
    periodType: string
  ): Promise<any> {
    try {
      const dateFilter = TargetController.buildDateFilter(targetPeriod, periodType);
      const startDate: Date = dateFilter.gte;
      const endDate: Date = dateFilter.lte;

      // Get all offers created by this user in the period
      const offers = await prisma.offer.findMany({
        where: {
          createdById: userId,
          createdAt: { gte: startDate, lte: endDate }
        },
        select: {
          id: true,
          stage: true,
          offerValue: true,
          poValue: true,
          poDate: true,
          bookingDateInSap: true,
          probabilityPercentage: true,
          poExpectedMonth: true
        }
      });

      // Get offers with expected PO month matching the period (for expectedOffers calculation)
      let expectedMonthFilter: any;

      if (periodType === 'YEARLY') {
        // For yearly, match all months starting with the year (e.g., "2025-")
        expectedMonthFilter = {
          poExpectedMonth: {
            startsWith: targetPeriod + '-'
          }
        };
      } else {
        // For monthly, match exact month
        expectedMonthFilter = {
          poExpectedMonth: targetPeriod
        };
      }

      const offersWithExpectedMonth = await prisma.offer.findMany({
        where: {
          createdById: userId,
          ...expectedMonthFilter
        },
        select: {
          id: true,
          offerValue: true,
          probabilityPercentage: true,
          poExpectedMonth: true
        }
      });

      // Calculate metrics
      const totalOffers = offers.length;
      const totalOffersValue = offers.reduce((sum, o) => sum + (Number(o.offerValue) || 0), 0);

      // Orders Received = WON stage offers (count)
      const ordersReceived = offers.filter(o => o.stage === 'WON').length;

      // Orders Received Value = Sum of WON stage offer values
      const ordersReceivedValue = offers
        .filter(o => o.stage === 'WON')
        .reduce((sum, o) => sum + (Number(o.offerValue) || 0), 0);

      // Open Funnel = Offers Value – Orders Received Value
      const openFunnel = totalOffersValue - ordersReceivedValue;

      // Expected Offers = Sum of (Offer Value × Probability / 100) WHERE Probability > 50% AND poExpectedMonth matches period
      const offersWithHighProbability = offersWithExpectedMonth.filter(o => (o.probabilityPercentage || 0) > 50);
      const expectedOffers = offersWithHighProbability
        .reduce((sum, o) => sum + (Number(o.offerValue) || 0) * ((Number(o.probabilityPercentage) || 0) / 100), 0);

      // YTD (Year-to-Date) - orders booked in current year
      const currentYear = new Date().getFullYear();
      const ytdStart = new Date(currentYear, 0, 1);
      const ytdEnd = new Date(currentYear, 11, 31, 23, 59, 59);
      const orderBookingYTD = offers.filter(o =>
        (o.stage === 'WON' || o.stage === 'PO_RECEIVED') &&
        o.poDate &&
        new Date(o.poDate) >= ytdStart &&
        new Date(o.poDate) <= ytdEnd
      ).length;

      return {
        totalOffers,
        totalOffersValue: Number(totalOffersValue),
        ordersReceived: Number(ordersReceivedValue),
        openFunnel: Number(openFunnel),
        expectedOffers: Number(expectedOffers),
        orderBooking: orderBookingYTD,
        periodType,
        targetPeriod
      };
    } catch (error) {
      logger.error('Get user metrics error:', error);
      return {
        totalOffers: 0,
        totalOffersValue: 0,
        ordersReceived: 0,
        openFunnel: 0,
        expectedOffers: 0,
        orderBooking: 0
      };
    }
  }

  /**
   * Get dashboard targets summary - shows total and monthly targets with actual performance
   * Used by admin dashboard to display target overview
   */
  static async getTargetsSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonthPeriod = `${currentYear}-${currentMonth}`;
      const currentYearPeriod = String(currentYear);

      // Get all active zones
      const allZones = await prisma.serviceZone.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      });

      // ==================== MONTHLY TARGETS ====================
      const monthlyTargets = await prisma.zoneTarget.findMany({
        where: {
          targetPeriod: currentMonthPeriod,
          periodType: 'MONTHLY'
        },
        include: {
          serviceZone: { select: { id: true, name: true } }
        }
      });

      // Also fetch yearly targets as fallback for monthly view
      const yearlyTargetsForMonthly = await prisma.zoneTarget.findMany({
        where: {
          targetPeriod: currentYearPeriod,
          periodType: 'YEARLY'
        },
        include: {
          serviceZone: { select: { id: true, name: true } }
        }
      });

      // Calculate monthly actual performance for each zone
      const monthlyByZone = await Promise.all(
        allZones.map(async (zone) => {
          // First try monthly targets, then fall back to yearly/12
          const monthlyZoneTargets = monthlyTargets.filter(t => t.serviceZoneId === zone.id);
          let totalTarget = monthlyZoneTargets.reduce((sum, t) => sum + Number(t.targetValue), 0);

          // If no monthly targets, use yearly targets divided by 12
          if (totalTarget === 0) {
            const yearlyZoneTargets = yearlyTargetsForMonthly.filter(t => t.serviceZoneId === zone.id);
            totalTarget = yearlyZoneTargets.reduce((sum, t) => sum + Math.round(Number(t.targetValue) / 12), 0);
          }

          const actual = await TargetController.getZoneActualPerformance(
            zone.id,
            currentMonthPeriod,
            'MONTHLY'
          );

          return {
            zoneId: zone.id,
            zoneName: zone.name,
            monthlyTarget: totalTarget,
            monthlyActual: actual.value,
            monthlyOfferCount: actual.count,
            monthlyAchievement: totalTarget > 0 ? (actual.value / totalTarget) * 100 : 0
          };
        })
      );

      const monthlyTotalTarget = monthlyByZone.reduce((sum, z) => sum + z.monthlyTarget, 0);
      const monthlyTotalActual = monthlyByZone.reduce((sum, z) => sum + z.monthlyActual, 0);
      const monthlyTotalOffers = monthlyByZone.reduce((sum, z) => sum + z.monthlyOfferCount, 0);

      // ==================== YEARLY TARGETS ====================
      const yearlyTargets = await prisma.zoneTarget.findMany({
        where: {
          targetPeriod: currentYearPeriod,
          periodType: 'YEARLY'
        },
        include: {
          serviceZone: { select: { id: true, name: true } }
        }
      });

      // Calculate yearly actual performance for each zone
      const yearlyByZone = await Promise.all(
        allZones.map(async (zone) => {
          const zoneTargets = yearlyTargets.filter(t => t.serviceZoneId === zone.id);
          const totalTarget = zoneTargets.reduce((sum, t) => sum + Number(t.targetValue), 0);

          const actual = await TargetController.getZoneActualPerformance(
            zone.id,
            currentYearPeriod,
            'YEARLY'
          );

          return {
            zoneId: zone.id,
            zoneName: zone.name,
            yearlyTarget: totalTarget,
            yearlyActual: actual.value,
            yearlyOfferCount: actual.count,
            yearlyAchievement: totalTarget > 0 ? (actual.value / totalTarget) * 100 : 0
          };
        })
      );

      const yearlyTotalTarget = yearlyByZone.reduce((sum, z) => sum + z.yearlyTarget, 0);
      const yearlyTotalActual = yearlyByZone.reduce((sum, z) => sum + z.yearlyActual, 0);
      const yearlyTotalOffers = yearlyByZone.reduce((sum, z) => sum + z.yearlyOfferCount, 0);

      // ==================== PRODUCT TYPE BREAKDOWN ====================
      // Get all product types from monthly targets
      const monthlyProductTypes = await prisma.zoneTarget.findMany({
        where: {
          targetPeriod: currentMonthPeriod,
          periodType: 'MONTHLY',
          productType: { not: null }
        },
        select: { productType: true },
        distinct: ['productType']
      });

      const allProductTypes = [
        'RELOCATION',
        'CONTRACT',
        'SPARE_PARTS',
        'KARDEX_CONNECT',
        'UPGRADE_KIT',
        'SOFTWARE',
        'OTHERS',
        'BD_SPARE',
        'RETROFIT_KIT'
      ];

      const byProductType = await Promise.all(
        allProductTypes.map(async (productType) => {
          // Monthly - with fallback to yearly/12
          const monthlyTargetsForPT = monthlyTargets.filter(t => t.productType === productType);
          let monthlyTargetValue = monthlyTargetsForPT.reduce((sum, t) => sum + Number(t.targetValue), 0);

          // If no monthly targets, use yearly targets divided by 12
          if (monthlyTargetValue === 0) {
            const yearlyTargetsForPTFallback = yearlyTargets.filter(t => t.productType === productType);
            monthlyTargetValue = yearlyTargetsForPTFallback.reduce((sum, t) => sum + Math.round(Number(t.targetValue) / 12), 0);
          }

          const monthlyActualPT = await Promise.all(
            allZones.map(zone =>
              TargetController.getZoneActualPerformance(zone.id, currentMonthPeriod, 'MONTHLY', productType)
            )
          );
          const monthlyActualValue = monthlyActualPT.reduce((sum, a) => sum + a.value, 0);
          const monthlyOfferCountPT = monthlyActualPT.reduce((sum, a) => sum + a.count, 0);

          // Yearly
          const yearlyTargetsForPT = yearlyTargets.filter(t => t.productType === productType);
          const yearlyTargetValue = yearlyTargetsForPT.reduce((sum, t) => sum + Number(t.targetValue), 0);

          const yearlyActualPT = await Promise.all(
            allZones.map(zone =>
              TargetController.getZoneActualPerformance(zone.id, currentYearPeriod, 'YEARLY', productType)
            )
          );
          const yearlyActualValue = yearlyActualPT.reduce((sum, a) => sum + a.value, 0);
          const yearlyOfferCountPT = yearlyActualPT.reduce((sum, a) => sum + a.count, 0);

          return {
            productType,
            monthlyTarget: monthlyTargetValue,
            monthlyActual: monthlyActualValue,
            monthlyOfferCount: monthlyOfferCountPT,
            monthlyAchievement: monthlyTargetValue > 0 ? (monthlyActualValue / monthlyTargetValue) * 100 : 0,
            yearlyTarget: yearlyTargetValue,
            yearlyActual: yearlyActualValue,
            yearlyOfferCount: yearlyOfferCountPT,
            yearlyAchievement: yearlyTargetValue > 0 ? (yearlyActualValue / yearlyTargetValue) * 100 : 0
          };
        })
      );

      // Merge zone data (monthly + yearly)
      const zoneData = allZones.map(zone => {
        const monthly = monthlyByZone.find(z => z.zoneId === zone.id) || {
          zoneId: zone.id,
          zoneName: zone.name,
          monthlyTarget: 0,
          monthlyActual: 0,
          monthlyOfferCount: 0,
          monthlyAchievement: 0
        };
        const yearly = yearlyByZone.find(z => z.zoneId === zone.id) || {
          zoneId: zone.id,
          zoneName: zone.name,
          yearlyTarget: 0,
          yearlyActual: 0,
          yearlyOfferCount: 0,
          yearlyAchievement: 0
        };

        return {
          zoneId: zone.id,
          zoneName: zone.name,
          monthlyTarget: monthly.monthlyTarget,
          monthlyActual: monthly.monthlyActual,
          monthlyOfferCount: monthly.monthlyOfferCount,
          monthlyAchievement: monthly.monthlyAchievement,
          yearlyTarget: yearly.yearlyTarget,
          yearlyActual: yearly.yearlyActual,
          yearlyOfferCount: yearly.yearlyOfferCount,
          yearlyAchievement: yearly.yearlyAchievement
        };
      });

      // ==================== USER TARGETS BY ZONE ====================
      // Fetch all active users with their zone assignments
      const allUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          serviceZones: {
            select: {
              serviceZone: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      // Fetch monthly user targets
      const monthlyUserTargets = await prisma.userTarget.findMany({
        where: {
          targetPeriod: currentMonthPeriod,
          periodType: 'MONTHLY'
        }
      });

      // Fetch yearly user targets
      const yearlyUserTargets = await prisma.userTarget.findMany({
        where: {
          targetPeriod: currentYearPeriod,
          periodType: 'YEARLY'
        }
      });

      // Build user targets by zone
      const usersByZone = allZones.map(zone => {
        const zoneUsers = allUsers.filter(user =>
          user.serviceZones?.some(sz => sz.serviceZone?.id === zone.id)
        );

        const userTargets = zoneUsers.map(async (user) => {
          // Monthly targets
          const monthlyUserTargetsForUser = monthlyUserTargets.filter(t => t.userId === user.id);
          let monthlyTarget = monthlyUserTargetsForUser.reduce((sum, t) => sum + Number(t.targetValue), 0);

          // Fallback to yearly/12 if no monthly targets
          if (monthlyTarget === 0) {
            const yearlyUserTargetsForUser = yearlyUserTargets.filter(t => t.userId === user.id);
            monthlyTarget = yearlyUserTargetsForUser.reduce((sum, t) => sum + Math.round(Number(t.targetValue) / 12), 0);
          }

          const monthlyActual = await TargetController.getUserActualPerformance(
            user.id,
            currentMonthPeriod,
            'MONTHLY'
          );

          // Yearly targets
          const yearlyUserTargetsForUser = yearlyUserTargets.filter(t => t.userId === user.id);
          const yearlyTarget = yearlyUserTargetsForUser.reduce((sum, t) => sum + Number(t.targetValue), 0);

          const yearlyActual = await TargetController.getUserActualPerformance(
            user.id,
            currentYearPeriod,
            'YEARLY'
          );

          return {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            monthlyTarget,
            monthlyActual: monthlyActual.value,
            monthlyOfferCount: monthlyActual.count,
            monthlyAchievement: monthlyTarget > 0 ? (monthlyActual.value / monthlyTarget) * 100 : 0,
            yearlyTarget,
            yearlyActual: yearlyActual.value,
            yearlyOfferCount: yearlyActual.count,
            yearlyAchievement: yearlyTarget > 0 ? (yearlyActual.value / yearlyTarget) * 100 : 0
          };
        });

        return Promise.all(userTargets).then(targets => ({
          zoneId: zone.id,
          zoneName: zone.name,
          users: targets
        }));
      });

      const userTargetsByZone = await Promise.all(usersByZone);

      return res.json({
        success: true,
        data: {
          currentMonth: {
            period: currentMonthPeriod,
            totalTargetValue: monthlyTotalTarget,
            totalActualValue: monthlyTotalActual,
            totalOfferCount: monthlyTotalOffers,
            achievement: monthlyTotalTarget > 0 ? (monthlyTotalActual / monthlyTotalTarget) * 100 : 0
          },
          currentYear: {
            period: currentYearPeriod,
            totalTargetValue: yearlyTotalTarget,
            totalActualValue: yearlyTotalActual,
            totalOfferCount: yearlyTotalOffers,
            achievement: yearlyTotalTarget > 0 ? (yearlyTotalActual / yearlyTotalTarget) * 100 : 0
          },
          byZone: zoneData,
          byProductType: byProductType,
          usersByZone: userTargetsByZone
        }
      });
    } catch (error) {
      logger.error('Get targets summary error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch targets summary'
      });
    }
  }
}
