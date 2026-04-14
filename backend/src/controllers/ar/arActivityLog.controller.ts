import { Request } from 'express';
import prisma from '../../config/db';

// Action types for AR Invoice Activity Log
export type ARActivityAction =
    | 'INVOICE_CREATED'
    | 'INVOICE_UPDATED'
    | 'INVOICE_DELETED'
    | 'PAYMENT_RECORDED'
    | 'PAYMENT_UPDATED'
    | 'PAYMENT_DELETED'
    | 'STATUS_CHANGED'
    | 'DELIVERY_UPDATED'
    | 'REMARK_ADDED'
    | 'REMARK_UPDATED'
    | 'REMARK_DELETED'
    | 'INVOICE_IMPORTED'
    | 'MILESTONE_LINKED'      // When a milestone payment is linked to a regular invoice
    | 'LINKED_TO_INVOICE'    // When a milestone is linked (logged on the milestone payment)
    | 'CUSTOMER_UPDATED'     // When customer info (denormalized) is updated
    | 'CUSTOMER_IMPORTED'    // When customer info is updated via bulk import
    | 'PAYMENT_TERM_CREATED' // When a new payment term is added
    | 'PAYMENT_TERM_UPDATED' // When a payment term is modified
    | 'PAYMENT_TERM_DELETED' // When a payment term is removed
    | 'CUSTOMER_CREATED'     // When a new customer master is manually created
    | 'CUSTOMER_DELETED'     // When a customer master record is deleted (if allowed)
    | 'INVOICE_CANCELLED'   // When an invoice is cancelled
    | 'INVOICE_RESTORED'    // When an invoice is restored
    | 'BULK_PAYMENT_IMPORTED'; // When payments are imported via bulk Excel

interface LogActivityParams {
    invoiceId?: string | null;
    action: ARActivityAction;
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
 * Log an activity for an AR Invoice
 * Call this function whenever an action is performed on an invoice
 */
export const logInvoiceActivity = async (params: LogActivityParams) => {
    try {
        await prisma.aRInvoiceActivityLog.create({
            data: {
                invoiceId: params.invoiceId || null,
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
export const logFieldChanges = async (
    invoiceId: string,
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

        await logInvoiceActivity({
            invoiceId,
            action: 'INVOICE_UPDATED',
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
        invoiceNumber: 'Invoice Number',
        bpCode: 'BP Code',
        customerName: 'Customer Name',
        totalAmount: 'Total Amount',
        netAmount: 'Net Amount',
        taxAmount: 'Tax Amount',
        dueDate: 'Due Date',
        invoiceDate: 'Invoice Date',
        status: 'Status',
        deliveryStatus: 'Delivery Status',
        modeOfDelivery: 'Mode of Delivery',
        sentHandoverDate: 'Sent/Handover Date',
        impactDate: 'Impact Date',
        comments: 'Comments',
        poNo: 'PO Number',
        invoiceType: 'Invoice Type',
        milestoneStatus: 'Milestone Status',
        advanceReceivedDate: 'Advance Received Date',
        deliveryDueDate: 'Delivery Due Date',
        receipts: 'Receipts',
        adjustments: 'Adjustments',
        balance: 'Balance'
    };
    return fieldMap[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
};

/**
 * Format value for display
 */
const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};
