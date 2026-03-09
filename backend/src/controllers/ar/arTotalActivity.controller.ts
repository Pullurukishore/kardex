import { Request, Response } from 'express';
import prisma from '../../config/db';

// Combined activity type for frontend
interface CombinedActivity {
    id: string;
    type: 'INVOICE' | 'SESSION';
    action: string;
    description?: string;
    // Invoice-specific
    invoiceId?: string;
    invoiceNumber?: string;
    customerName?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    // Session-specific
    userId?: number;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    financeRole?: string;
    deviceInfo?: string;
    // Common
    performedBy?: string;
    performedById?: number;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
    createdAt: Date;
}

/**
 * Get all activities (invoices + sessions) with filters
 * GET /ar/activities
 */
export const getAllActivities = async (req: Request, res: Response) => {
    try {
        const {
            fromDate,
            toDate,
            action,
            activityType, // 'INVOICE', 'SESSION', or 'ALL'
            userId,
            invoiceId,
            search,
            page = 1,
            limit = 50
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Build date filter
        const dateFilter: any = {};
        if (fromDate) {
            dateFilter.gte = new Date(String(fromDate));
        }
        if (toDate) {
            const endDate = new Date(String(toDate));
            endDate.setHours(23, 59, 59, 999);
            dateFilter.lte = endDate;
        }

        // Define session action types
        const sessionActions = ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'SESSION_EXPIRED', 'PASSWORD_RESET'];
        const isSessionAction = action ? sessionActions.includes(String(action)) : null;
        const isInvoiceAction = action ? !sessionActions.includes(String(action)) : null;

        // Fetch invoice activities
        // Skip fetching invoice activities if a session-specific action is selected
        let invoiceActivities: CombinedActivity[] = [];
        const shouldFetchInvoice = (!activityType || activityType === 'ALL' || activityType === 'INVOICE') && !isSessionAction;

        if (shouldFetchInvoice) {
            const invoiceWhere: any = {};

            if (Object.keys(dateFilter).length > 0) {
                invoiceWhere.createdAt = dateFilter;
            }
            if (action && isInvoiceAction) {
                invoiceWhere.action = String(action);
            }
            if (userId) {
                invoiceWhere.performedById = Number(userId);
            }
            if (invoiceId) {
                invoiceWhere.invoiceId = String(invoiceId);
            }
            if (search) {
                invoiceWhere.OR = [
                    { description: { contains: String(search), mode: 'insensitive' } },
                    { performedBy: { contains: String(search), mode: 'insensitive' } }
                ];
            }

            const rawInvoiceActivities = await prisma.aRInvoiceActivityLog.findMany({
                where: invoiceWhere,
                orderBy: { createdAt: 'desc' },
                take: take * 2, // Fetch more to account for combining
                select: {
                    id: true,
                    action: true,
                    description: true,
                    invoiceId: true,
                    fieldName: true,
                    oldValue: true,
                    newValue: true,
                    performedBy: true,
                    performedById: true,
                    ipAddress: true,
                    userAgent: true,
                    metadata: true,
                    createdAt: true
                }
            });

            // Get invoice details for each activity
            const invoiceIds = [...new Set(rawInvoiceActivities.map(a => a.invoiceId).filter((id): id is string => id !== null))];
            const invoices = await prisma.aRInvoice.findMany({
                where: { id: { in: invoiceIds } },
                select: { id: true, invoiceNumber: true, customerName: true }
            });
            const invoiceMap = new Map(invoices.map(i => [i.id, i]));

            invoiceActivities = rawInvoiceActivities.map(a => {
                const inv = a.invoiceId ? invoiceMap.get(a.invoiceId) : null;
                return {
                    id: a.id,
                    type: 'INVOICE' as const,
                    action: a.action,
                    description: a.description,
                    invoiceId: a.invoiceId || undefined,
                    invoiceNumber: inv?.invoiceNumber || 'Deleted Invoice',
                    customerName: inv?.customerName || '',
                    fieldName: a.fieldName || undefined,
                    oldValue: a.oldValue || undefined,
                    newValue: a.newValue || undefined,
                    performedBy: a.performedBy || undefined,
                    performedById: a.performedById || undefined,
                    ipAddress: a.ipAddress || undefined,
                    userAgent: a.userAgent || undefined,
                    metadata: a.metadata,
                    createdAt: a.createdAt
                };
            });
        }

        // Fetch session activities
        // Skip fetching session activities if an invoice-specific action is selected
        let sessionActivities: CombinedActivity[] = [];
        const shouldFetchSession = (!activityType || activityType === 'ALL' || activityType === 'SESSION') && !isInvoiceAction;

        if (shouldFetchSession) {
            const sessionWhere: any = {
                financeRole: { not: null }
            };

            if (Object.keys(dateFilter).length > 0) {
                sessionWhere.createdAt = dateFilter;
            }
            if (action && isSessionAction) {
                sessionWhere.action = String(action);
            }
            if (userId) {
                sessionWhere.userId = Number(userId);
            }
            if (search) {
                sessionWhere.OR = [
                    { userName: { contains: String(search), mode: 'insensitive' } },
                    { userEmail: { contains: String(search), mode: 'insensitive' } }
                ];
            }

            const rawSessionActivities = await prisma.aRSessionActivityLog.findMany({
                where: sessionWhere,
                orderBy: { createdAt: 'desc' },
                take: take * 2,
                select: {
                    id: true,
                    action: true,
                    userId: true,
                    userName: true,
                    userEmail: true,
                    userRole: true,
                    financeRole: true,
                    deviceInfo: true,
                    ipAddress: true,
                    userAgent: true,
                    metadata: true,
                    createdAt: true
                }
            });

            sessionActivities = rawSessionActivities.map(a => ({
                id: a.id,
                type: 'SESSION' as const,
                action: a.action,
                description: getSessionDescription(a.action, a.userName, a.deviceInfo),
                userId: a.userId || undefined,
                userName: a.userName || undefined,
                userEmail: a.userEmail || undefined,
                userRole: a.userRole || undefined,
                financeRole: a.financeRole || undefined,
                deviceInfo: a.deviceInfo || undefined,
                performedBy: a.userName || undefined,
                performedById: a.userId || undefined,
                ipAddress: a.ipAddress || undefined,
                userAgent: a.userAgent || undefined,
                metadata: a.metadata,
                createdAt: a.createdAt
            }));
        }

        // Combine and sort by createdAt
        const combined = [...invoiceActivities, ...sessionActivities]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(skip, skip + take);

        // Get total counts
        const [invoiceCount, sessionCount] = await Promise.all([
            !activityType || activityType === 'ALL' || activityType === 'INVOICE'
                ? prisma.aRInvoiceActivityLog.count()
                : Promise.resolve(0),
            !activityType || activityType === 'ALL' || activityType === 'SESSION'
                ? prisma.aRSessionActivityLog.count({ where: { financeRole: { not: null } } })
                : Promise.resolve(0)
        ]);

        const total = invoiceCount + sessionCount;

        res.json({
            data: combined,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch activities', message: error.message });
    }
};

/**
 * Get activity statistics
 * GET /ar/activities/stats
 */
export const getActivityStats = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get counts by action type
        const [
            totalInvoiceActivities,
            totalSessionActivities,
            todayInvoice,
            todaySession,
            thisWeekInvoice,
            thisWeekSession,
            thisMonthInvoice,
            thisMonthSession,
            invoiceByAction,
            sessionByAction
        ] = await Promise.all([
            prisma.aRInvoiceActivityLog.count(),
            prisma.aRSessionActivityLog.count({ where: { financeRole: { not: null } } }),
            prisma.aRInvoiceActivityLog.count({ where: { createdAt: { gte: today } } }),
            prisma.aRSessionActivityLog.count({ where: { createdAt: { gte: today }, financeRole: { not: null } } }),
            prisma.aRInvoiceActivityLog.count({ where: { createdAt: { gte: thisWeekStart } } }),
            prisma.aRSessionActivityLog.count({ where: { createdAt: { gte: thisWeekStart }, financeRole: { not: null } } }),
            prisma.aRInvoiceActivityLog.count({ where: { createdAt: { gte: thisMonthStart } } }),
            prisma.aRSessionActivityLog.count({ where: { createdAt: { gte: thisMonthStart }, financeRole: { not: null } } }),
            prisma.aRInvoiceActivityLog.groupBy({
                by: ['action'],
                _count: { action: true }
            }),
            prisma.aRSessionActivityLog.groupBy({
                by: ['action'],
                _count: { action: true },
                where: { financeRole: { not: null } }
            })
        ]);

        // Format action counts
        const actionCounts: Record<string, number> = {};
        invoiceByAction.forEach(item => {
            actionCounts[item.action] = item._count.action;
        });
        sessionByAction.forEach(item => {
            actionCounts[item.action] = item._count.action;
        });

        res.json({
            total: totalInvoiceActivities + totalSessionActivities,
            today: todayInvoice + todaySession,
            thisWeek: thisWeekInvoice + thisWeekSession,
            thisMonth: thisMonthInvoice + thisMonthSession,
            byType: {
                invoice: totalInvoiceActivities,
                session: totalSessionActivities
            },
            byAction: actionCounts,
            todayBreakdown: {
                invoice: todayInvoice,
                session: todaySession
            }
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
    }
};

/**
 * Get recent activities for dashboard widget
 * GET /ar/activities/recent
 */
export const getRecentActivities = async (req: Request, res: Response) => {
    try {
        const { limit = 10 } = req.query;

        const [invoiceActivities, sessionActivities] = await Promise.all([
            prisma.aRInvoiceActivityLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                select: {
                    id: true,
                    action: true,
                    description: true,
                    invoiceId: true,
                    performedBy: true,
                    createdAt: true
                }
            }),
            prisma.aRSessionActivityLog.findMany({
                where: { financeRole: { not: null } },
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                select: {
                    id: true,
                    action: true,
                    userName: true,
                    deviceInfo: true,
                    createdAt: true
                }
            })
        ]);

        // Get invoice details
        const invoiceIds = [...new Set(invoiceActivities.map(a => a.invoiceId).filter((id): id is string => id !== null))];
        const invoices = await prisma.aRInvoice.findMany({
            where: { id: { in: invoiceIds } },
            select: { id: true, invoiceNumber: true, customerName: true }
        });
        const invoiceMap = new Map(invoices.map(i => [i.id, i]));

        const combined = [
            ...invoiceActivities.map(a => {
                const inv = a.invoiceId ? invoiceMap.get(a.invoiceId) : null;
                return {
                    id: a.id,
                    type: 'INVOICE' as const,
                    action: a.action,
                    description: a.description,
                    invoiceNumber: inv?.invoiceNumber,
                    customerName: inv?.customerName,
                    performedBy: a.performedBy,
                    createdAt: a.createdAt
                };
            }),
            ...sessionActivities.map(a => ({
                id: a.id,
                type: 'SESSION' as const,
                action: a.action,
                description: getSessionDescription(a.action, a.userName, a.deviceInfo),
                userName: a.userName,
                performedBy: a.userName,
                createdAt: a.createdAt
            }))
        ]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, Number(limit));

        res.json(combined);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch activities', message: error.message });
    }
};

/**
 * Helper to generate human-readable description for session events
 */
function getSessionDescription(action: string, userName?: string | null, deviceInfo?: string | null): string {
    const user = userName || 'Unknown user';
    const device = deviceInfo ? ` from ${deviceInfo}` : '';

    switch (action) {
        case 'LOGIN':
            return `${user} logged in${device}`;
        case 'LOGOUT':
            return `${user} logged out`;
        case 'LOGIN_FAILED':
            return `Failed login attempt for ${user}${device}`;
        case 'SESSION_EXPIRED':
            return `Session expired for ${user}`;
        case 'PASSWORD_RESET':
            return `Password reset for ${user}`;
        default:
            return `${action} by ${user}`;
    }
}
