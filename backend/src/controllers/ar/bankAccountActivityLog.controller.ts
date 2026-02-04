import { Request, Response } from 'express';
import prisma from '../../config/db';

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT ACTIVITY LOG
// Comprehensive audit trail for compliance and fraud prevention
// ═══════════════════════════════════════════════════════════════════════════

// Action types for Bank Account Activity Log
export type BankAccountActivityAction =
    | 'BANK_ACCOUNT_CREATED'
    | 'BANK_ACCOUNT_UPDATED'
    | 'BANK_ACCOUNT_DELETED'
    | 'BANK_ACCOUNT_ACTIVATED'
    | 'BANK_ACCOUNT_DEACTIVATED'
    | 'CHANGE_REQUEST_CREATED'
    | 'CHANGE_REQUEST_APPROVED'
    | 'CHANGE_REQUEST_REJECTED'
    | 'ATTACHMENT_UPLOADED'
    | 'ATTACHMENT_DELETED'
    | 'USER_LOGIN'
    | 'USER_LOGOUT'
    | 'IMPORTED';

interface LogActivityParams {
    bankAccountId?: string | null;
    action: BankAccountActivityAction;
    description: string;
    fieldName?: string;
    oldValue?: string | null;
    newValue?: string | null;
    performedById?: number | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, any>;
}

/**
 * Log an activity for a Bank Account
 * Call this function whenever an action is performed on a bank account
 */
export const logBankAccountActivity = async (params: LogActivityParams) => {
    try {
        await prisma.bankAccountActivityLog.create({
            data: {
                bankAccountId: params.bankAccountId || null,
                action: params.action,
                description: params.description,
                fieldName: params.fieldName || null,
                oldValue: params.oldValue || null,
                newValue: params.newValue || null,
                performedById: params.performedById || null,
                performedBy: params.performedBy || null,
                ipAddress: params.ipAddress || null,
                userAgent: params.userAgent || null,
                metadata: params.metadata
            }
        });
    } catch (error) {
        // Log error but don't throw - activity logging should not break main operations
        console.error('Failed to log bank account activity:', error);
    }
};

/**
 * Helper to extract user info from request
 */
export const getUserFromRequest = (req: Request): { id: number | null; name: string | null } => {
    const user = (req as any).user;
    return {
        id: user?.id || null,
        name: user?.name || user?.email || null
    };
};

/**
 * Helper to get IP address from request
 */
export const getIpFromRequest = (req: Request): string | null => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        null;
};

/**
 * Helper to log field changes
 * Compares old and new values and logs each changed field
 */
export const logBankAccountFieldChanges = async (
    bankAccountId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    req: Request,
    fieldsToTrack: string[]
) => {
    const user = getUserFromRequest(req);
    const ipAddress = getIpFromRequest(req);
    const userAgent = req.headers['user-agent'] || null;

    for (const field of fieldsToTrack) {
        const oldValue = oldData[field];
        const newValue = newData[field];

        // Skip if values are the same
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;

        await logBankAccountActivity({
            bankAccountId,
            action: 'BANK_ACCOUNT_UPDATED',
            description: `${formatFieldName(field)} changed`,
            fieldName: field,
            oldValue: formatValue(oldValue),
            newValue: formatValue(newValue),
            performedById: user.id,
            performedBy: user.name,
            ipAddress,
            userAgent
        });
    }
};

/**
 * Format field name for display
 */
const formatFieldName = (field: string): string => {
    const fieldMap: Record<string, string> = {
        vendorName: 'Vendor Name',
        beneficiaryBankName: 'Beneficiary Bank Name',
        beneficiaryName: 'Beneficiary Name',
        accountNumber: 'Account Number',
        ifscCode: 'IFSC Code',
        emailId: 'Email ID',
        nickName: 'Nick Name',
        gstNumber: 'GST Number',
        panNumber: 'PAN Number',
        isMSME: 'MSME Status',
        udyamRegNum: 'Udyam Registration Number',
        currency: 'Currency',
        isActive: 'Active Status',
        USER_LOGIN: 'User Login',
        USER_LOGOUT: 'User Logout'
    };
    return fieldMap[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
};

/**
 * Format value for display
 */
const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

// ═══════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get activity logs for a specific bank account
 */
export const getActivityLogs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const logs = await prisma.bankAccountActivityLog.findMany({
            where: { bankAccountId: id },
            orderBy: { createdAt: 'desc' },
            take: Math.min(Number(limit), 100),
            skip: Number(offset)
        });

        const total = await prisma.bankAccountActivityLog.count({
            where: { bankAccountId: id }
        });

        res.json({ logs, total });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch activity logs', message: error.message });
    }
};

/**
 * Get recent activities across all bank accounts (ADMIN)
 */
export const getRecentActivities = async (req: Request, res: Response) => {
    try {
        const { limit = 50, action } = req.query;

        const where: any = {};
        if (action) {
            where.action = action;
        }

        const logs = await prisma.bankAccountActivityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Math.min(Number(limit), 100)
        });

        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch recent activities', message: error.message });
    }
};

/**
 * Get activity statistics
 */
export const getActivityStats = async (req: Request, res: Response) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Number(days));

        const [total, byAction] = await Promise.all([
            prisma.bankAccountActivityLog.count({
                where: { createdAt: { gte: startDate } }
            }),
            prisma.bankAccountActivityLog.groupBy({
                by: ['action'],
                where: { createdAt: { gte: startDate } },
                _count: { action: true }
            })
        ]);

        res.json({
            total,
            byAction: byAction.reduce((acc, item) => {
                acc[item.action] = item._count.action;
                return acc;
            }, {} as Record<string, number>)
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch activity stats', message: error.message });
    }
};
