import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Parse user agent string to get device info
 */
const parseUserAgent = (userAgent?: string): string => {
    if (!userAgent) return 'Unknown';

    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    else if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'Opera';

    // Detect OS
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

    return `${browser} on ${os}`;
};

/**
 * Get IP address from request
 */
const getIpFromRequest = (req: Request): string | null => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        req.ip ||
        null;
};

/**
 * Log user activity to AuditLog
 */
export const logUserActivity = async (params: {
    action: string;
    userId: number;
    userName?: string | null;
    userEmail?: string | null;
    userRole?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    entityType?: string;
    entityId?: number;
    details?: any;
    module?: string;
}) => {
    try {
        await prisma.auditLog.create({
            data: {
                action: params.action,
                entityType: params.entityType || 'User',
                entityId: params.entityId || params.userId,
                userId: params.userId,
                performedById: params.userId,
                ipAddress: params.ipAddress || null,
                userAgent: params.userAgent || null,
                deviceInfo: parseUserAgent(params.userAgent || undefined),
                module: params.module || 'SYSTEM',
                details: params.details || {},
                updatedAt: new Date()
            }
        });
    } catch (error) {
        // Log error but don't throw - activity logging should not break main operations

    }
};

/**
 * Action type configuration for UI display
 */
const ACTION_CONFIG: Record<string, {
    label: string;
    category: 'auth' | 'ticket' | 'offer' | 'other';
    color: string;
}> = {
    // Auth actions
    'USER_LOGIN': { label: 'User Login', category: 'auth', color: 'green' },
    'USER_LOGOUT': { label: 'User Logout', category: 'auth', color: 'gray' },
    'LOGIN_FAILED': { label: 'Login Failed', category: 'auth', color: 'red' },

    // Ticket actions
    'TICKET_CREATED': { label: 'Ticket Created', category: 'ticket', color: 'green' },
    'TICKET_UPDATED': { label: 'Ticket Updated', category: 'ticket', color: 'blue' },
    'STATUS_CHANGE': { label: 'Status Changed', category: 'ticket', color: 'purple' },
    'TICKET_ASSIGNED': { label: 'Ticket Assigned', category: 'ticket', color: 'orange' },
    'TICKET_ESCALATED': { label: 'Ticket Escalated', category: 'ticket', color: 'red' },
    'PO_REQUESTED': { label: 'PO Requested', category: 'ticket', color: 'yellow' },
    'PO_APPROVED': { label: 'PO Approved', category: 'ticket', color: 'green' },
    'NOTE_ADDED': { label: 'Note Added', category: 'ticket', color: 'blue' },
    'SCHEDULED': { label: 'Activity Scheduled', category: 'ticket', color: 'orange' },
    'REPORT_UPLOADED': { label: 'Report Uploaded', category: 'ticket', color: 'blue' },
    'TICKET_CLOSED': { label: 'Ticket Closed', category: 'ticket', color: 'green' },
    'UPDATE_SPARE_PARTS_STATUS': { label: 'Spare Parts Updated', category: 'ticket', color: 'blue' },
    'ASSIGNMENT_ACCEPTED': { label: 'Assignment Accepted', category: 'ticket', color: 'green' },
    'ASSIGNMENT_REJECTED': { label: 'Assignment Rejected', category: 'ticket', color: 'red' },
    'ONSITE_VISIT_STARTED': { label: 'Onsite Visit Started', category: 'ticket', color: 'blue' },
    'ONSITE_VISIT_REACHED': { label: 'Onsite Visit Reached', category: 'ticket', color: 'green' },
    'ONSITE_VISIT_COMPLETED': { label: 'Onsite Visit Completed', category: 'ticket', color: 'green' },

    // Offer actions
    'OFFER_CREATED': { label: 'Offer Created', category: 'offer', color: 'green' },
    'OFFER_UPDATED': { label: 'Offer Updated', category: 'offer', color: 'blue' },
    'OFFER_STATUS_UPDATED': { label: 'Stage Changed', category: 'offer', color: 'purple' },
    'SPARE_PART_ADDED': { label: 'Spare Part Added', category: 'offer', color: 'teal' },
    'SPARE_PART_UPDATED': { label: 'Spare Part Updated', category: 'offer', color: 'teal' },
    'REMARK_ADDED': { label: 'Remark Added', category: 'offer', color: 'blue' },

    // Spare Part Management (Global)
    'SPARE_PART_CREATED': { label: 'Spare Part Created', category: 'offer', color: 'green' },
    'SPARE_PART_DELETED': { label: 'Spare Part Deleted', category: 'offer', color: 'red' },
    'BULK_PRICE_UPDATED': { label: 'Bulk Price Updated', category: 'offer', color: 'orange' },

    // Target actions
    'ZONE_TARGET_SET': { label: 'Zone Target Set', category: 'offer', color: 'green' },
    'USER_TARGET_SET': { label: 'User Target Set', category: 'offer', color: 'green' },
    'ZONE_TARGET_UPDATED': { label: 'Zone Target Updated', category: 'offer', color: 'blue' },
    'USER_TARGET_UPDATED': { label: 'User Target Updated', category: 'offer', color: 'blue' },
    'ZONE_TARGET_DELETED': { label: 'Zone Target Deleted', category: 'offer', color: 'red' },
    'USER_TARGET_DELETED': { label: 'User Target Deleted', category: 'offer', color: 'red' },
};

// Get all login/logout action types
const AUTH_ACTIONS = ['USER_LOGIN', 'USER_LOGOUT', 'LOGIN_FAILED'];

/**
 * Get Ticket Activity Logs
 * Returns all ticket-related activities plus login/logout events (shown in both logs)
 */
export const getTicketActivityLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const {
            page = '1',
            limit = '50',
            startDate,
            endDate,
            action,
            userId,
            search
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build where clause
        const where: any = {
            OR: [
                { entityType: { in: ['Ticket', 'TICKET'] } },
                { action: { in: AUTH_ACTIONS } }
            ]
        };

        // Date range filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate as string);
            }
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        // Action filter
        if (action) {
            const actions = (action as string).split(',');
            where.AND = [
                where.AND || {},
                { action: { in: actions } }
            ];
        }

        // User filter
        if (userId) {
            where.performedById = parseInt(userId as string);
        }

        // Search filter
        if (search) {
            where.OR = [
                ...(where.OR || []),
                { action: { contains: search as string, mode: 'insensitive' } },
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

        // Fetch activities
        const [activities, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    action: true,
                    entityType: true,
                    entityId: true,
                    details: true,
                    ipAddress: true,
                    userAgent: true,
                    createdAt: true,
                    performedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    User_AuditLog_userIdToUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    ticket: {
                        select: {
                            id: true,
                            ticketNumber: true,
                            title: true
                        }
                    }
                }
            }),
            prisma.auditLog.count({ where })
        ]);

        // Transform activities
        const transformedActivities = activities.map(activity => ({
            id: activity.id,
            action: activity.action,
            actionLabel: ACTION_CONFIG[activity.action]?.label || activity.action.replace(/_/g, ' '),
            actionColor: ACTION_CONFIG[activity.action]?.color || 'gray',
            entityType: activity.entityType,
            entityId: activity.entityId,
            description: getActivityDescription(activity),
            details: activity.details,
            ipAddress: activity.ipAddress,
            deviceInfo: (activity as any).deviceInfo || (activity.details as any)?.deviceInfo || null,
            module: (activity as any).module || (activity.details as any)?.module || null,
            performedBy: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser) ? {
                id: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).id,
                name: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).name,
                email: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).email,
                role: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).role
            } : null,
            ticket: activity.ticket ? {
                id: activity.ticket.id,
                ticketNumber: activity.ticket.ticketNumber,
                title: activity.ticket.title
            } : null,
            createdAt: activity.createdAt
        }));

        const totalPages = Math.ceil(total / limitNum);

        res.json({
            success: true,
            activities: transformedActivities,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: totalPages
            }
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket activity logs'
        });
    }
};

/**
 * Get Ticket Activity Stats
 */
export const getTicketActivityStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalActivities,
            loginsToday,
            ticketUpdatesToday,
            statusChangesToday,
            activeUsersToday
        ] = await Promise.all([
            // Total ticket-related activities
            prisma.auditLog.count({
                where: {
                    OR: [
                        { entityType: { in: ['Ticket', 'TICKET'] } },
                        { action: { in: AUTH_ACTIONS } }
                    ]
                }
            }),
            // Logins today
            prisma.auditLog.count({
                where: {
                    action: 'USER_LOGIN',
                    createdAt: { gte: today }
                }
            }),
            // Ticket updates today
            prisma.auditLog.count({
                where: {
                    entityType: { in: ['Ticket', 'TICKET'] },
                    createdAt: { gte: today }
                }
            }),
            // Status changes today
            prisma.auditLog.count({
                where: {
                    action: 'STATUS_CHANGE',
                    createdAt: { gte: today }
                }
            }),
            // Active users today (distinct users who logged in)
            prisma.auditLog.groupBy({
                by: ['performedById'],
                where: {
                    action: 'USER_LOGIN',
                    createdAt: { gte: today },
                    performedById: { not: null }
                }
            })
        ]);

        res.json({
            success: true,
            stats: {
                totalActivities,
                loginsToday,
                ticketUpdatesToday,
                statusChangesToday,
                activeUsersToday: activeUsersToday.length
            }
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket activity stats'
        });
    }
};

/**
 * Get Offer Activity Logs
 * Returns all offer-related activities plus login/logout events (shown in both logs)
 */
export const getOfferActivityLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const {
            page = '1',
            limit = '50',
            startDate,
            endDate,
            action,
            userId,
            search
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Base conditions: What constitutes an "Offer" related activity
        const baseConditions = [
            { entityType: 'Offer' },
            { entityType: 'SparePart' },
            { entityType: 'ZoneTarget' },
            { entityType: 'UserTarget' },
            { offerId: { not: null } },
            { action: { in: AUTH_ACTIONS } }
        ];

        // Build where clause using AND to combine different filter types
        const andConditions: any[] = [{ OR: baseConditions }];

        // Date range filter
        if (startDate || endDate) {
            const dateCond: any = {};
            if (startDate) {
                dateCond.gte = new Date(startDate as string);
            }
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                dateCond.lte = end;
            }
            andConditions.push({ createdAt: dateCond });
        }

        // Action filter
        if (action) {
            const actions = (action as string).split(',');
            andConditions.push({ action: { in: actions } });
        }

        // User filter
        if (userId) {
            andConditions.push({ performedById: parseInt(userId as string) });
        }

        // Search filter
        if (search) {
            andConditions.push({
                OR: [
                    { action: { contains: search as string, mode: 'insensitive' } },
                    { description: { contains: search as string, mode: 'insensitive' } },
                    {
                        performedBy: {
                            OR: [
                                { name: { contains: search as string, mode: 'insensitive' } },
                                { email: { contains: search as string, mode: 'insensitive' } }
                            ]
                        }
                    },
                    {
                        offer: {
                            offerReferenceNumber: { contains: search as string, mode: 'insensitive' }
                        }
                    }
                ]
            });
        }

        const where = { AND: andConditions };

        // Fetch activities
        const [activities, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    action: true,
                    entityType: true,
                    entityId: true,
                    details: true,
                    ipAddress: true,
                    userAgent: true,
                    createdAt: true,
                    performedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    User_AuditLog_userIdToUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    offer: {
                        select: {
                            id: true,
                            offerReferenceNumber: true,
                            title: true,
                            stage: true
                        }
                    }
                }
            }),
            prisma.auditLog.count({ where })
        ]);

        // Transform activities
        const transformedActivities = activities.map(activity => ({
            id: activity.id,
            action: activity.action,
            actionLabel: ACTION_CONFIG[activity.action]?.label || activity.action.replace(/_/g, ' '),
            actionColor: ACTION_CONFIG[activity.action]?.color || 'gray',
            entityType: activity.entityType,
            entityId: activity.entityId,
            description: getActivityDescription(activity),
            details: activity.details,
            ipAddress: activity.ipAddress,
            deviceInfo: (activity as any).deviceInfo || (activity.details as any)?.deviceInfo || null,
            module: (activity as any).module || (activity.details as any)?.module || null,
            performedBy: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser) ? {
                id: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).id,
                name: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).name,
                email: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).email,
                role: (activity.performedBy || (activity as any).User_AuditLog_userIdToUser).role
            } : null,
            offer: activity.offer ? {
                id: activity.offer.id,
                offerReferenceNumber: activity.offer.offerReferenceNumber,
                title: activity.offer.title,
                stage: activity.offer.stage
            } : null,
            createdAt: activity.createdAt
        }));

        const totalPages = Math.ceil(total / limitNum);

        res.json({
            success: true,
            activities: transformedActivities,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: totalPages
            }
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch offer activity logs'
        });
    }
};

/**
 * Get Offer Activity Stats
 */
export const getOfferActivityStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalActivities,
            loginsToday,
            offerUpdatesToday,
            stageChangesToday,
            activeUsersToday
        ] = await Promise.all([
            // Total offer-related activities
            prisma.auditLog.count({
                where: {
                    OR: [
                        { entityType: 'Offer' },
                        { offerId: { not: null } },
                        { action: { in: AUTH_ACTIONS } }
                    ]
                }
            }),
            // Logins today
            prisma.auditLog.count({
                where: {
                    action: 'USER_LOGIN',
                    createdAt: { gte: today }
                }
            }),
            // Offer updates today
            prisma.auditLog.count({
                where: {
                    OR: [
                        { entityType: 'Offer' },
                        { offerId: { not: null } }
                    ],
                    createdAt: { gte: today }
                }
            }),
            // Stage changes today
            prisma.auditLog.count({
                where: {
                    action: 'OFFER_STATUS_UPDATED',
                    createdAt: { gte: today }
                }
            }),
            // Active users today (distinct users who logged in)
            prisma.auditLog.groupBy({
                by: ['performedById'],
                where: {
                    action: 'USER_LOGIN',
                    createdAt: { gte: today },
                    performedById: { not: null }
                }
            })
        ]);

        res.json({
            success: true,
            stats: {
                totalActivities,
                loginsToday,
                offerUpdatesToday,
                stageChangesToday,
                activeUsersToday: activeUsersToday.length
            }
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch offer activity stats'
        });
    }
};

/**
 * Helper function to generate activity description
 */
function getActivityDescription(activity: any): string {
    const user = activity.performedBy || activity.User_AuditLog_userIdToUser;
    const userName = user?.name ||
        user?.email?.split('@')[0] ||
        activity.details?.userName ||
        'Unknown user';

    switch (activity.action) {
        case 'USER_LOGIN':
            return `${userName} logged in`;
        case 'USER_LOGOUT':
            return `${userName} logged out`;
        case 'LOGIN_FAILED':
            return `Failed login attempt`;
        case 'TICKET_CREATED':
            return `${userName} created a new ticket`;
        case 'TICKET_UPDATED':
            return `${userName} updated ticket details`;
        case 'STATUS_CHANGE':
            const statusDetails = activity.details as any;
            if (statusDetails?.fromStatus && statusDetails?.toStatus) {
                return `${userName} changed status from ${statusDetails.fromStatus} to ${statusDetails.toStatus}`;
            }
            return `${userName} changed ticket status`;
        case 'TICKET_ASSIGNED':
            return `${userName} assigned the ticket`;
        case 'TICKET_ESCALATED':
            return `${userName} escalated the ticket`;
        case 'PO_REQUESTED':
            return `${userName} requested PO approval`;
        case 'PO_APPROVED':
            return `${userName} approved PO`;
        case 'NOTE_ADDED':
            return `${userName} added a note`;
        case 'SCHEDULED':
            return `${userName} scheduled an activity`;
        case 'TICKET_CLOSED':
            return `${userName} closed the ticket`;
        case 'UPDATE_SPARE_PARTS_STATUS':
            return `${userName} updated spare parts status`;
        case 'ASSIGNMENT_ACCEPTED':
            return `${userName} accepted the assignment`;
        case 'ASSIGNMENT_REJECTED':
            return `${userName} rejected the assignment`;
        case 'ONSITE_VISIT_STARTED':
            return `${userName} started onsite visit`;
        case 'ONSITE_VISIT_REACHED':
            return `${userName} reached onsite location`;
        case 'ONSITE_VISIT_COMPLETED':
            return `${userName} completed onsite visit`;
        case 'REPORT_UPLOADED':
            return `${userName} uploaded a report`;
        case 'OFFER_CREATED':
            return `${userName} created a new offer`;
        case 'OFFER_UPDATED':
            const changes = activity.details?.changes;
            const changeCount = changes ? Object.keys(changes).length : 0;
            return `${userName} updated offer (${changeCount} field${changeCount !== 1 ? 's' : ''})`;
        case 'OFFER_STATUS_UPDATED':
            const stageDetails = activity.details as any;
            if (stageDetails?.fromStage && stageDetails?.toStage) {
                return `${userName} changed stage from ${stageDetails.fromStage} to ${stageDetails.toStage}`;
            }
            return `${userName} updated offer status`;
        case 'SPARE_PART_ADDED':
            return `${userName} added a spare part`;
        case 'SPARE_PART_UPDATED':
            const spChanges = activity.details?.changes;
            const spChangeCount = spChanges ? Object.keys(spChanges).length : 0;
            return `${userName} updated spare part (${spChangeCount} field${spChangeCount !== 1 ? 's' : ''})`;
        case 'REMARK_ADDED':
            return `${userName} added a remark`;
        case 'SPARE_PART_CREATED':
            return `${userName} created global spare part ${activity.details?.partNumber || ''}`;
        case 'SPARE_PART_DELETED':
            return `${userName} deleted global spare part ${activity.details?.partNumber || ''}`;
        case 'BULK_PRICE_UPDATED':
            return `${userName} performed bulk price update for ${activity.details?.count || 0} spare parts`;
        case 'ZONE_TARGET_SET':
            return `${userName} set target for zone ${activity.details?.zoneName || ''}`;
        case 'ZONE_TARGET_UPDATED':
            return `${userName} updated target for zone ${activity.details?.zoneName || ''}`;
        case 'ZONE_TARGET_DELETED':
            return `${userName} deleted a zone target`;
        case 'USER_TARGET_SET':
            return `${userName} set target for user ${activity.details?.targetUserName || ''}`;
        case 'USER_TARGET_UPDATED':
            return `${userName} updated target for user ${activity.details?.targetUserName || ''}`;
        case 'USER_TARGET_DELETED':
            return `${userName} deleted a user target`;
        default:
            return `${userName} performed ${activity.action.replace(/_/g, ' ').toLowerCase()}`;
    }
}

/**
 * Get list of users for filter dropdown
 */
export const getActivityLogUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: { in: ['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'SERVICE_PERSON', 'EXPERT_HELPDESK'] }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            },
            orderBy: { name: 'asc' }
        });

        res.json({
            success: true,
            users
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
};

export { parseUserAgent, getIpFromRequest };
