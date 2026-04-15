import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import prisma from '../config/db';
import {
  getFSADashboard,
  exportFSAData
} from '../controllers/fsaController';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserStatus,
  getUserById
} from '../controllers/admin.controller';
import {
  getTicketActivityLogs,
  getTicketActivityStats,
  getOfferActivityLogs,
  getOfferActivityStats,
  getActivityLogUsers
} from '../controllers/activityLog.controller';
import {
  chatAboutOffers,
  clearChat,
  getAIStatus
} from '../controllers/aiOffers.controller';
import {
  chatAboutTickets,
  clearTicketChat,
  getTicketAIStatus
} from '../controllers/aiTickets.controller';

const router = express.Router();

// AI Offer Intelligence Routes (Admin only)
router.get('/ai/status', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  return getAIStatus(req as any, res).catch(next);
});



router.post('/ai/chat', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  return chatAboutOffers(req as any, res).catch(next);
});

router.post('/ai/chat/clear', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  return clearChat(req as any, res).catch(next);
});

// AI Ticket Intelligence Routes (Admin only)
router.get('/ai/ticket-status', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  return getTicketAIStatus(req as any, res).catch(next);
});



router.post('/ai/ticket-chat', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  return chatAboutTickets(req as any, res).catch(next);
});

router.post('/ai/ticket-chat/clear', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  return clearTicketChat(req as any, res).catch(next);
});

// FSA Routes (Admin only)
router.get('/fsa', authMiddleware(['ADMIN']), getFSADashboard);
router.post('/fsa/export', authMiddleware(['ADMIN']), exportFSAData);

// Zone Users Routes (Admin only)
router.get('/zone-users', authMiddleware(['ADMIN']), async (req, res) => {
  try {
    const { page = 1, search = '', limit = 10 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      role: { in: ['ZONE_USER', 'SERVICE_PERSON'] }
    };

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [zoneUsers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        include: {
          serviceZones: {
            include: {
              serviceZone: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(total / take);

    res.json({
      success: true,
      data: {
        zoneUsers: zoneUsers.map((user: any) => ({
          ...user,
          id: user.id.toString()
        })),
        pagination: {
          currentPage: parseInt(page as string),
          totalPages,
          totalItems: total,
          itemsPerPage: take
        },
        stats: {
          totalUsers: total,
          activeUsers: zoneUsers.filter((u: any) => u.isActive).length,
          inactiveUsers: zoneUsers.filter((u: any) => !u.isActive).length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch zone users'
    });
  }
});

// User Management Routes (Admin only)
// IMPORTANT: Put specific routes before parameterized routes to avoid conflicts
// Get users with optional role filter - this must come before /:id route
router.get('/users', authenticate, requireRole(['ADMIN', 'EXPERT_HELPDESK']), (req, res, next) => {
  const authReq = req as any;
  return getUsers(authReq, res).catch(next);
});

// Create user
router.post('/users', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  const authReq = req as any;
  return createUser(authReq, res).catch(next);
});

// Activity Log Routes (Admin, Zone Manager, Expert Helpdesk)
// These must come BEFORE /:id routes
router.get('/ticket-activity-log', authenticate, requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']), (req, res, next) => {
  const authReq = req as any;
  return getTicketActivityLogs(authReq, res).catch(next);
});

router.get('/ticket-activity-log/stats', authenticate, requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']), (req, res, next) => {
  const authReq = req as any;
  return getTicketActivityStats(authReq, res).catch(next);
});

router.get('/offer-activity-log', authenticate, requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']), (req, res, next) => {
  const authReq = req as any;
  return getOfferActivityLogs(authReq, res).catch(next);
});

router.get('/offer-activity-log/stats', authenticate, requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']), (req, res, next) => {
  const authReq = req as any;
  return getOfferActivityStats(authReq, res).catch(next);
});

router.get('/activity-log/users', authenticate, requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']), (req, res, next) => {
  const authReq = req as any;
  return getActivityLogUsers(authReq, res).catch(next);
});

router.get('/:id', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  const authReq = req as any;
  return getUserById(authReq, res).catch(next);
});

// Update user by ID
router.put('/:id', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  const authReq = req as any;
  return updateUser(authReq, res).catch(next);
});

// Delete user by ID
router.delete('/:id', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  const authReq = req as any;
  return deleteUser(authReq, res).catch(next);
});

// Reset user password by ID
router.post('/:id/reset-password', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  const authReq = req as any;
  return resetUserPassword(authReq, res).catch(next);
});

// Toggle user status by ID
router.patch('/:id/toggle-status', authenticate, requireRole(['ADMIN']), (req, res, next) => {
  const authReq = req as any;
  return toggleUserStatus(authReq, res).catch(next);
});

export default router;
