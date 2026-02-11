import { Request, Response } from 'express';
import { ARInvoiceStatus } from '@prisma/client';
import prisma from '../../config/db';
import { logInvoiceActivity, getUserFromRequest, getIpFromRequest, logFieldChanges } from './arActivityLog.controller';
import { calculateDaysBetween } from '../../utils/dateUtils';


// Get all invoices with filters
export const getAllInvoices = async (req: Request, res: Response) => {
    try {
        const {
            search,
            status,
            customerId,
            fromDate,
            toDate,
            overdueOnly,
            invoiceType, // NEW: Filter by invoice type (REGULAR, PREPAID, CREDIT_NOTE)
            page = 1,
            limit = 20
        } = req.query;

        const where: any = {};

        if (search) {
            where.OR = [
                { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
                { bpCode: { contains: String(search), mode: 'insensitive' } },
                { customerName: { contains: String(search), mode: 'insensitive' } },
                { poNo: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        if (status) {
            where.status = status;
        }

        if (customerId) {
            where.bpCode = customerId;
        }

        if (fromDate || toDate) {
            where.invoiceDate = {};
            if (fromDate) where.invoiceDate.gte = new Date(String(fromDate));
            if (toDate) where.invoiceDate.lte = new Date(String(toDate));
        }

        if (overdueOnly === 'true') {
            where.status = 'OVERDUE';
        }

        // Filter by invoice type (REGULAR, PREPAID, CREDIT_NOTE)
        if (invoiceType) {
            where.invoiceType = String(invoiceType);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [invoices, total] = await Promise.all([
            prisma.aRInvoice.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { invoiceDate: 'desc' },
                select: {
                    id: true,
                    invoiceNumber: true,
                    bpCode: true,
                    customerName: true,
                    poNo: true,
                    totalAmount: true,
                    invoiceDate: true,
                    dueDate: true,
                    balance: true,
                    status: true,
                    riskClass: true,
                    region: true,
                    invoiceType: true,
                    totalReceipts: true,
                    advanceReceivedDate: true,
                    deliveryDueDate: true,
                    prepaidStatus: true,
                    type: true,
                    grnDate: true,
                    bgDate: true,
                    othersDate: true,
                    agingMilestone: true,
                }
            }),
            prisma.aRInvoice.count({ where })
        ]);

        // Fetch payment modes for these invoices manually (since it's a loose relation)
        const invoiceIds = invoices.map(inv => inv.id);
        const paymentModes = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, paymentMode: true }
        });

        // Group payment modes by invoiceId
        const paymentModesMap = paymentModes.reduce((acc: any, curr: any) => {
            if (!acc[curr.invoiceId]) acc[curr.invoiceId] = [];
            acc[curr.invoiceId].push({ paymentMode: curr.paymentMode });
            return acc;
        }, {});

        // Calculate days overdue for each invoice and attach payment history
        const invoicesWithOverdue = invoices.map(invoice => {
            const today = new Date();
            let dueByDays = 0;
            let isOverdue = false;

            if (invoice.invoiceType === 'PREPAID' && invoice.agingMilestone) {
                let baseDate = null;
                switch (invoice.agingMilestone) {
                    case 'ADVANCE': baseDate = invoice.advanceReceivedDate; break;
                    case 'INVOICE': baseDate = invoice.invoiceDate; break;
                    case 'GRN': baseDate = invoice.grnDate; break;
                    case 'BG': baseDate = invoice.bgDate; break;
                    case 'OTHERS': baseDate = invoice.othersDate; break;
                }

                if (baseDate) {
                    // For prepaids, aging usually means "days since milestone"
                    // If baseDate is Jan 1 and today is Jan 10, aging is +9
                    dueByDays = calculateDaysBetween(new Date(baseDate), today);
                    // For consistency with regular invoices where positive means overdue,
                    // aging here is also positive (days since milestone).
                    isOverdue = false; // Prepaid aging isn't necessarily "overdue" in the same sense
                }
            } else if (invoice.dueDate) {
                // calculateDaysBetween should handle Date objects
                dueByDays = calculateDaysBetween(new Date(invoice.dueDate), today);
                isOverdue = dueByDays > 0 && invoice.status !== 'PAID';
            }

            return {
                ...invoice,
                paymentHistory: paymentModesMap[invoice.id] || [],
                dueByDays,
                isOverdue
            };
        });

        res.json({
            data: invoicesWithOverdue,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch invoices', message: error.message });
    }
};

// Get invoice by ID or Invoice Number with full details
export const getInvoiceById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        let invoice: any;
        if (id.length === 36) { // Likely UUID
            invoice = await prisma.aRInvoice.findUnique({
                where: { id },
                include: {
                    linkedFromPrepaids: true,
                    linkedInvoice: true
                }
            });
        } else {
            invoice = await prisma.aRInvoice.findUnique({
                where: { invoiceNumber: id },
                include: {
                    linkedFromPrepaids: true,
                    linkedInvoice: true
                }
            });
        }

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Fetch payment history for the main invoice
        const paymentHistory = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: invoice.id },
            orderBy: { paymentDate: 'desc' }
        });

        // Fetch payment history for linked prepaids
        if (invoice.linkedFromPrepaids && invoice.linkedFromPrepaids.length > 0) {
            invoice.linkedFromPrepaids = await Promise.all(invoice.linkedFromPrepaids.map(async (prepaid: any) => {
                const payments = await prisma.aRPaymentHistory.findMany({
                    where: { invoiceId: prepaid.id },
                    orderBy: { paymentDate: 'desc' }
                });
                return { ...prepaid, paymentHistory: payments };
            }));
        }

        // Fetch payment history for linked regular invoice (if this is a prepaid)
        if (invoice.linkedInvoice) {
            const payments = await prisma.aRPaymentHistory.findMany({
                where: { invoiceId: invoice.linkedInvoice.id },
                orderBy: { paymentDate: 'desc' }
            });
            invoice.linkedInvoice = { ...invoice.linkedInvoice, paymentHistory: payments };
        }

        // Calculate days dynamically: positive = overdue, negative = days remaining
        const today = new Date();
        let dueByDays = 0;
        let isOverdue = false;

        if (invoice.invoiceType === 'PREPAID' && invoice.agingMilestone) {
            let baseDate = null;
            switch (invoice.agingMilestone) {
                case 'ADVANCE': baseDate = invoice.advanceReceivedDate; break;
                case 'INVOICE': baseDate = invoice.invoiceDate; break;
                case 'GRN': baseDate = invoice.grnDate; break;
                case 'BG': baseDate = invoice.bgDate; break;
                case 'OTHERS': baseDate = invoice.othersDate; break;
            }

            if (baseDate) {
                dueByDays = calculateDaysBetween(new Date(baseDate), today);
                isOverdue = false;
            }
        } else if (invoice.dueDate) {
            dueByDays = calculateDaysBetween(invoice.dueDate, today);
            isOverdue = dueByDays > 0 && invoice.status !== 'PAID';
        }

        res.json({
            ...invoice,
            paymentHistory,
            dueByDays,
            isOverdue
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch invoice', message: error.message });
    }
};

// Add payment record
export const addPaymentRecord = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, paymentDate, paymentTime, paymentMode, referenceNo, referenceBank, notes } = req.body;

        // Get current user name from request (outside transaction)
        const recordedBy = (req as any).user?.name || (req as any).user?.email || 'System';
        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;
        const parsedAmount = parseFloat(amount);

        // Wrap all DB operations in a transaction to prevent race conditions
        const result = await prisma.$transaction(async (tx) => {
            // Read invoice within transaction for isolation
            const invoice = await tx.aRInvoice.findUnique({ where: { id } });
            if (!invoice) {
                throw new Error('INVOICE_NOT_FOUND');
            }

            // Create payment record
            const payment = await tx.aRPaymentHistory.create({
                data: {
                    invoiceId: id,
                    amount: parsedAmount,
                    paymentDate: new Date(paymentDate),
                    paymentTime: paymentTime || null,
                    paymentMode,
                    referenceNo,
                    referenceBank,
                    notes,
                    recordedBy
                }
            });

            // Calculate updated totals
            const receipts = Number(invoice.receipts || 0);
            const adjustments = Number(invoice.adjustments || 0);

            let newReceipts = receipts;
            let newAdjustments = adjustments;

            if (paymentMode === 'ADJUSTMENT' || paymentMode === 'CREDIT_NOTE') {
                newAdjustments += parsedAmount;
            } else {
                newReceipts += parsedAmount;
            }

            const totalReceipts = newReceipts + newAdjustments;
            const balance = Number(invoice.totalAmount) - totalReceipts;

            let status = invoice.status;
            if (balance <= 0) status = 'PAID';
            else if (totalReceipts > 0) status = 'PARTIAL';

            // Update invoice within same transaction
            await tx.aRInvoice.update({
                where: { id },
                data: {
                    receipts: newReceipts,
                    adjustments: newAdjustments,
                    totalReceipts,
                    balance,
                    status
                }
            });

            return { payment, balance, status };
        });

        // Log payment activity (outside transaction - non-critical)
        await logInvoiceActivity({
            invoiceId: id,
            action: 'PAYMENT_RECORDED',
            description: `Payment of ₹${parsedAmount.toLocaleString()} recorded via ${paymentMode}${referenceNo ? ` (Ref: ${referenceNo})` : ''}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress,
            userAgent,
            metadata: { amount: parsedAmount, paymentMode, referenceNo, newBalance: result.balance, newStatus: result.status }
        });

        res.json(result.payment);
    } catch (error: any) {

        if (error.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.status(500).json({ error: 'Failed to add payment', message: error.message });
    }
};

// Update payment record
export const updatePaymentRecord = async (req: Request, res: Response) => {
    try {
        const { id, paymentId } = req.params;
        const { amount, paymentDate, paymentMode, referenceBank, notes } = req.body;

        const user = getUserFromRequest(req);
        const parsedAmount = parseFloat(amount);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch the payment to be updated
            const existingPayment = await tx.aRPaymentHistory.findUnique({
                where: { id: paymentId }
            });

            if (!existingPayment || existingPayment.invoiceId !== id) {
                throw new Error('PAYMENT_NOT_FOUND');
            }

            // 2. Update the payment
            const updatedPayment = await tx.aRPaymentHistory.update({
                where: { id: paymentId },
                data: {
                    amount: parsedAmount,
                    paymentDate: new Date(paymentDate),
                    paymentMode,
                    referenceBank,
                    notes
                }
            });

            // 3. Recalculate invoice totals
            const invoicePayments = await tx.aRPaymentHistory.findMany({
                where: { invoiceId: id }
            });

            const invoice = await tx.aRInvoice.findUnique({ where: { id } });
            if (!invoice) throw new Error('INVOICE_NOT_FOUND');

            let newReceipts = 0;
            let newAdjustments = 0;

            invoicePayments.forEach(p => {
                const amt = Number(p.amount);
                if (p.paymentMode === 'ADJUSTMENT' || p.paymentMode === 'CREDIT_NOTE') {
                    newAdjustments += amt;
                } else {
                    newReceipts += amt;
                }
            });

            const totalReceipts = newReceipts + newAdjustments;
            const balance = Number(invoice.totalAmount) - totalReceipts;

            let status = invoice.status;
            if (balance <= 0) status = 'PAID';
            else if (totalReceipts > 0) status = 'PARTIAL';
            else status = 'PENDING';

            await tx.aRInvoice.update({
                where: { id },
                data: {
                    receipts: newReceipts,
                    adjustments: newAdjustments,
                    totalReceipts,
                    balance,
                    status
                }
            });

            return { updatedPayment, balance, status };
        });

        // Log activity
        await logInvoiceActivity({
            invoiceId: id,
            action: 'PAYMENT_UPDATED',
            description: `Payment updated: ₹${parsedAmount.toLocaleString()} via ${paymentMode}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { paymentId, amount: parsedAmount, paymentMode }
        });

        res.json(result.updatedPayment);
    } catch (error: any) {
        if (error.message === 'PAYMENT_NOT_FOUND') return res.status(404).json({ error: 'Payment not found' });
        if (error.message === 'INVOICE_NOT_FOUND') return res.status(404).json({ error: 'Invoice not found' });
        res.status(500).json({ error: 'Failed to update payment', message: error.message });
    }
};


// Delete payment record
export const deletePaymentRecord = async (req: Request, res: Response) => {
    try {
        const { id, paymentId } = req.params;
        const user = getUserFromRequest(req);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch payment info before deletion
            const payment = await tx.aRPaymentHistory.findUnique({
                where: { id: paymentId }
            });

            if (!payment || payment.invoiceId !== id) {
                throw new Error('PAYMENT_NOT_FOUND');
            }

            const amountDeleted = Number(payment.amount);
            const modeDeleted = payment.paymentMode;

            // 2. Delete the payment
            await tx.aRPaymentHistory.delete({
                where: { id: paymentId }
            });

            // 3. Recalculate invoice totals
            const invoicePayments = await tx.aRPaymentHistory.findMany({
                where: { invoiceId: id }
            });

            const invoice = await tx.aRInvoice.findUnique({ where: { id } });
            if (!invoice) throw new Error('INVOICE_NOT_FOUND');

            let newReceipts = 0;
            let newAdjustments = 0;

            invoicePayments.forEach(p => {
                const amt = Number(p.amount);
                if (p.paymentMode === 'ADJUSTMENT' || p.paymentMode === 'CREDIT_NOTE') {
                    newAdjustments += amt;
                } else {
                    newReceipts += amt;
                }
            });

            const totalReceipts = newReceipts + newAdjustments;
            const balance = Number(invoice.totalAmount) - totalReceipts;

            let status = invoice.status;
            if (balance <= 0) status = 'PAID';
            else if (totalReceipts > 0) status = 'PARTIAL';
            else status = 'PENDING';

            await tx.aRInvoice.update({
                where: { id },
                data: {
                    receipts: newReceipts,
                    adjustments: newAdjustments,
                    totalReceipts,
                    balance,
                    status
                }
            });

            return { amountDeleted, modeDeleted, balance, status };
        });

        // Log activity
        await logInvoiceActivity({
            invoiceId: id,
            action: 'PAYMENT_DELETED',
            description: `Payment of ₹${result.amountDeleted.toLocaleString()} via ${result.modeDeleted} deleted`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { paymentId, amount: result.amountDeleted }
        });

        res.json({ message: 'Payment deleted successfully' });
    } catch (error: any) {
        if (error.message === 'PAYMENT_NOT_FOUND') return res.status(404).json({ error: 'Payment not found' });
        if (error.message === 'INVOICE_NOT_FOUND') return res.status(404).json({ error: 'Invoice not found' });
        res.status(500).json({ error: 'Failed to delete payment', message: error.message });
    }
};

// Create invoice
export const createInvoice = async (req: Request, res: Response) => {
    try {
        const {
            invoiceNumber,
            docNo,
            installmentNo,
            soNo,
            poNo,
            customerRefNo,
            customerId,
            paymentTermsId,
            productId,
            invoiceDate,
            documentDate,
            postingDate,
            dueDate,
            totalAmount,
            netAmount,
            taxAmount,
            originalAmount,
            amountReceived,
            actualPaymentTerms,
            // Prepaid fields
            invoiceType,
            advanceReceivedDate,
            deliveryDueDate,
            type,
            grnDate,
            bgDate,
            othersDate,
            agingMilestone
        } = req.body;

        if (!invoiceNumber || !customerId || !invoiceDate || !totalAmount) {
            return res.status(400).json({
                error: 'Invoice Number, Customer, Invoice Date, and Total Amount are required'
            });
        }

        const paymentPending = parseFloat(totalAmount) - (parseFloat(amountReceived) || 0);

        let status: ARInvoiceStatus = 'PENDING';
        if (paymentPending <= 0) {
            status = 'PAID';
        } else if (parseFloat(amountReceived) > 0) {
            status = 'PARTIAL';
        } else if (dueDate && new Date(dueDate) < new Date()) {
            status = 'OVERDUE';
        }

        // Calculate due date: use provided or default to 30 days from invoice date
        const calculatedDueDate = dueDate ? new Date(dueDate) : new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000);

        const invoice = await prisma.aRInvoice.create({
            data: {
                invoiceNumber,
                bpCode: customerId,
                customerName: req.body.customerName || '',
                poNo,
                soNo: soNo || null,  // Sales Order Number for prepaid invoices
                invoiceDate: new Date(invoiceDate),
                dueDate: calculatedDueDate,
                totalAmount: parseFloat(totalAmount),
                netAmount: netAmount ? parseFloat(netAmount) : parseFloat(totalAmount),
                taxAmount: taxAmount ? parseFloat(taxAmount) : null,
                actualPaymentTerms,
                status,
                // Prepaid fields
                invoiceType: invoiceType || 'REGULAR',
                advanceReceivedDate: advanceReceivedDate ? new Date(advanceReceivedDate) : null,
                deliveryDueDate: deliveryDueDate ? new Date(deliveryDueDate) : null,
                prepaidStatus: invoiceType === 'PREPAID' ? 'AWAITING_DELIVERY' : null,
                type: type || null,
                grnDate: grnDate ? new Date(grnDate) : null,
                bgDate: bgDate ? new Date(bgDate) : null,
                othersDate: othersDate ? new Date(othersDate) : null,
                agingMilestone: agingMilestone || null
            }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logInvoiceActivity({
            invoiceId: invoice.id,
            action: 'INVOICE_CREATED',
            description: `Invoice ${invoiceNumber} created for ${req.body.customerName || customerId} - Amount: ₹${parseFloat(totalAmount).toLocaleString()}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { invoiceType: invoiceType || 'REGULAR', totalAmount: parseFloat(totalAmount) }
        });

        res.status(201).json(invoice);
    } catch (error: any) {

        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Invoice with this number already exists' });
        }
        res.status(500).json({ error: 'Failed to create invoice', message: error.message });
    }
};


// Update invoice
export const updateInvoice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        // Prepare user info outside transaction
        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        // Convert date strings to Date objects
        if (updateData.dueDate) {
            updateData.dueDate = new Date(updateData.dueDate);
        }
        if (updateData.invoiceDate) {
            updateData.invoiceDate = new Date(updateData.invoiceDate);
        }
        if (updateData.sentHandoverDate) {
            updateData.sentHandoverDate = new Date(updateData.sentHandoverDate);
        }
        if (updateData.impactDate) {
            updateData.impactDate = new Date(updateData.impactDate);
        }
        if (updateData.advanceReceivedDate) {
            updateData.advanceReceivedDate = new Date(updateData.advanceReceivedDate);
        }
        if (updateData.deliveryDueDate) {
            updateData.deliveryDueDate = new Date(updateData.deliveryDueDate);
        }
        if (updateData.grnDate) {
            updateData.grnDate = new Date(updateData.grnDate);
        }
        if (updateData.bgDate) {
            updateData.bgDate = new Date(updateData.bgDate);
        }
        if (updateData.othersDate) {
            updateData.othersDate = new Date(updateData.othersDate);
        }

        // Convert numeric strings to numbers
        if (updateData.receipts !== undefined) {
            updateData.receipts = parseFloat(updateData.receipts) || 0;
        }
        if (updateData.adjustments !== undefined) {
            updateData.adjustments = parseFloat(updateData.adjustments) || 0;
        }
        if (updateData.totalReceipts !== undefined) {
            updateData.totalReceipts = parseFloat(updateData.totalReceipts) || 0;
        }
        if (updateData.balance !== undefined) {
            updateData.balance = parseFloat(updateData.balance) || 0;
        }

        // Wrap DB operations in transaction to prevent race conditions
        const result = await prisma.$transaction(async (tx) => {
            // Fetch existing invoice within transaction for isolation
            const existingInvoice = await tx.aRInvoice.findUnique({ where: { id } });
            if (!existingInvoice) {
                throw new Error('INVOICE_NOT_FOUND');
            }

            // Recalculate balance and status if amounts changed
            if (updateData.totalAmount !== undefined || updateData.totalReceipts !== undefined) {
                const totalAmount = updateData.totalAmount !== undefined
                    ? parseFloat(updateData.totalAmount)
                    : Number(existingInvoice.totalAmount);
                const totalReceipts = updateData.totalReceipts !== undefined
                    ? parseFloat(updateData.totalReceipts)
                    : Number(existingInvoice.totalReceipts || 0);

                updateData.balance = totalAmount - totalReceipts;

                if (updateData.balance <= 0) {
                    updateData.status = 'PAID';
                } else if (totalReceipts > 0) {
                    updateData.status = 'PARTIAL';
                }
            }

            const invoice = await tx.aRInvoice.update({
                where: { id },
                data: updateData
            });

            return { invoice, existingInvoice };
        });

        // Log detailed activity for each changed field (outside transaction - non-critical)
        const fieldLabels: Record<string, string> = {
            actualPaymentTerms: 'Payment Terms',
            dueDate: 'Due Date',
            status: 'Status',
            deliveryStatus: 'Delivery Status',
            poNo: 'PO Number',
            totalAmount: 'Total Amount',
            netAmount: 'Net Amount',
            taxAmount: 'Tax Amount',
            balance: 'Balance',
            receipts: 'Receipts',
            adjustments: 'Adjustments',
            riskClass: 'Risk Class',
            invoiceType: 'Invoice Type',
            modeOfDelivery: 'Mode of Delivery',
            comments: 'Comments',
            prepaidStatus: 'Prepaid Status',
            grnDate: 'GRN Date',
            bgDate: 'BG Date',
            othersDate: 'Others Date',
            agingMilestone: 'Aging Milestone'
        };

        // Build detailed change description
        const changes: string[] = [];
        for (const key of Object.keys(updateData)) {
            if (key === 'updatedAt') continue;
            const oldVal = (result.existingInvoice as any)[key];
            const newVal = updateData[key];

            // Compare values (handle dates and numbers)
            const oldStr = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : String(oldVal ?? 'N/A');
            const newStr = newVal instanceof Date ? newVal.toISOString().split('T')[0] : String(newVal ?? 'N/A');

            if (oldStr !== newStr) {
                const label = fieldLabels[key] || key;
                changes.push(`${label}: ${oldStr} → ${newStr}`);
            }
        }

        const description = changes.length > 0
            ? `Invoice updated:\n• ${changes.join('\n• ')}`
            : 'Invoice updated (no changes detected)';

        await logInvoiceActivity({
            invoiceId: id,
            action: 'INVOICE_UPDATED',
            description,
            performedById: user.id,
            performedBy: user.name,
            ipAddress,
            userAgent,
            metadata: { changes, updateData }
        });

        res.json(result.invoice);
    } catch (error: any) {

        if (error.message === 'INVOICE_NOT_FOUND' || error.code === 'P2025') {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.status(500).json({ error: 'Failed to update invoice', message: error.message });
    }

};



// Update delivery tracking (updates delivery fields on the invoice directly)
export const updateDeliveryTracking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { deliveryStatus, modeOfDelivery, sentHandoverDate, impactDate } = req.body;

        const invoice = await prisma.aRInvoice.update({
            where: { id },
            data: {
                deliveryStatus,
                modeOfDelivery,
                sentHandoverDate: sentHandoverDate ? new Date(sentHandoverDate) : null,
                impactDate: impactDate ? new Date(impactDate) : null
            }
        });

        // Log delivery update activity
        const user = getUserFromRequest(req);
        await logInvoiceActivity({
            invoiceId: id,
            action: 'DELIVERY_UPDATED',
            description: `Delivery status updated to ${deliveryStatus}${modeOfDelivery ? ` via ${modeOfDelivery}` : ''}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { deliveryStatus, modeOfDelivery, sentHandoverDate, impactDate }
        });

        res.json(invoice);
    } catch (error: any) {

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.status(500).json({ error: 'Failed to update delivery tracking', message: error.message });
    }
};


// Delete invoice
export const deleteInvoice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get invoice details before deletion for logging
        const invoiceToDelete = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { invoiceNumber: true, customerName: true, totalAmount: true }
        });

        // Delete associated payment history first (since there's no cascade constraint)
        // This prevents orphaned payment records from appearing in dashboard
        await prisma.aRPaymentHistory.deleteMany({
            where: { invoiceId: id }
        });

        await prisma.aRInvoice.delete({
            where: { id }
        });

        // Log deletion (note: this won't be visible in invoice view since invoice is deleted,
        // but useful for audit purposes if we have a global activity log)
        const user = getUserFromRequest(req);
        await logInvoiceActivity({
            invoiceId: id,
            action: 'INVOICE_DELETED',
            description: `Invoice ${invoiceToDelete?.invoiceNumber || id} deleted - Customer: ${invoiceToDelete?.customerName}, Amount: ₹${invoiceToDelete?.totalAmount}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { deletedInvoice: invoiceToDelete }
        });

        res.json({ message: 'Invoice deleted successfully' });
    } catch (error: any) {

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.status(500).json({ error: 'Failed to delete invoice', message: error.message });
    }
};


// Update overdue status for all invoices (batch job)
export const updateOverdueStatus = async (req: Request, res: Response) => {
    try {
        const today = new Date();

        // Update status to OVERDUE for past due invoices that aren't paid
        const result = await prisma.aRInvoice.updateMany({
            where: {
                dueDate: { lt: today },
                status: { in: ['PENDING', 'PARTIAL'] }
            },
            data: {
                status: 'OVERDUE'
            }
        });

        res.json({ message: `Updated ${result.count} invoices to OVERDUE status` });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to update overdue status', message: error.message });
    }
};

// Get invoice remarks
export const getInvoiceRemarks = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Resolve invoice ID - support both UUID and invoice number
        let invoiceId = id;

        // Try to find by UUID first, then by invoice number
        let invoice = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!invoice) {
            invoice = await prisma.aRInvoice.findUnique({
                where: { invoiceNumber: id },
                select: { id: true }
            });
        }

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        invoiceId = invoice.id;

        const remarks = await prisma.aRInvoiceRemark.findMany({
            where: { invoiceId },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(remarks);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch remarks', message: error.message });
    }
};

// Add invoice remark
export const addInvoiceRemark = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = (req as any).user?.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Resolve invoice ID - support both UUID and invoice number
        let invoice = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!invoice) {
            invoice = await prisma.aRInvoice.findUnique({
                where: { invoiceNumber: id },
                select: { id: true }
            });
        }

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const remark = await prisma.aRInvoiceRemark.create({
            data: {
                invoiceId: invoice.id,
                content: content.trim(),
                createdById: userId
            },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        // Log remark activity
        await logInvoiceActivity({
            invoiceId: invoice.id,
            action: 'REMARK_ADDED',
            description: `Remark added: "${content.trim().substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            performedById: userId,
            performedBy: remark.createdBy?.name || null,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null
        });

        res.status(201).json(remark);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to add remark', message: error.message });
    }
};


// Get invoice activity log
export const getInvoiceActivityLog = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Resolve invoice ID - support both UUID and invoice number
        let invoice = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!invoice) {
            invoice = await prisma.aRInvoice.findUnique({
                where: { invoiceNumber: id },
                select: { id: true }
            });
        }

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const activityLogs = await prisma.aRInvoiceActivityLog.findMany({
            where: { invoiceId: invoice.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                action: true,
                description: true,
                fieldName: true,
                oldValue: true,
                newValue: true,
                performedBy: true,
                createdAt: true,
                metadata: true
            }
        });

        res.json(activityLogs);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch activity log', message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// PREPAID INVOICE LINKING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get matching prepaid invoices for a regular invoice based on PO number
export const getMatchingPrepaids = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get the regular invoice
        const invoice = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { id: true, poNo: true, invoiceType: true, linkedPrepaidId: true }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        if (!invoice.poNo) {
            return res.json({ prepaids: [], message: 'No PO number on this invoice' });
        }

        // Extract base PO number (first part before any space, "Dtd:", or date suffix)
        // Examples: "3791225209 Dtd:7/2/2025" -> "3791225209", "PO-12345" -> "PO-12345"
        const basePO = invoice.poNo.split(/[\s,]+/)[0].trim();


        // Find prepaid invoices with matching PO number
        // Use contains for flexible matching - either invoice might have date suffix
        const matchingPrepaids = await prisma.aRInvoice.findMany({
            where: {
                invoiceType: 'PREPAID',
                OR: [
                    { poNo: basePO },  // Exact match on base PO
                    { poNo: { startsWith: basePO } },  // Prepaid PO starts with base PO
                    { poNo: { contains: basePO } },  // Prepaid PO contains base PO
                    { poNo: invoice.poNo }  // Exact full match
                ]
                // Note: linkedInvoiceId and prepaidStatus filters removed for flexibility
                // The UI will handle showing only relevant prepaids
            },
            select: {
                id: true,
                invoiceNumber: true,
                soNo: true,
                poNo: true,
                totalAmount: true,
                netAmount: true,
                receipts: true,
                totalReceipts: true,
                balance: true,
                advanceReceivedDate: true,
                prepaidStatus: true,
                customerName: true,
                bpCode: true,
                invoiceDate: true,
                status: true,
                linkedInvoiceId: true
            },
            orderBy: { invoiceDate: 'desc' }
        });

        // For each prepaid, get payment history and check for already-transferred payments
        const prepaidsWithPayments = await Promise.all(
            matchingPrepaids.map(async (prepaid) => {
                const payments = await prisma.aRPaymentHistory.findMany({
                    where: { invoiceId: prepaid.id },
                    select: {
                        id: true,
                        amount: true,
                        paymentDate: true,
                        paymentMode: true,
                        referenceNo: true,
                        createdAt: true
                    },
                    orderBy: { paymentDate: 'desc' }
                });

                // If this prepaid is linked to the current invoice, check for already transferred payments
                let transferredPaymentIds: string[] = [];
                let untransferredPayments = 0;
                let untransferredAmount = 0;

                if (prepaid.linkedInvoiceId === id) {
                    // Find payments on the regular invoice that came from this prepaid
                    const transferredPayments = await prisma.aRPaymentHistory.findMany({
                        where: {
                            invoiceId: id,
                            notes: { contains: `[From Prepaid ${prepaid.invoiceNumber}]` }
                        },
                        select: { amount: true, paymentDate: true }
                    });

                    // Calculate total transferred amount
                    const totalTransferred = transferredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                    const totalOnPrepaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

                    // Check if there are new payments (more on prepaid than transferred)
                    if (totalOnPrepaid > totalTransferred) {
                        untransferredAmount = totalOnPrepaid - totalTransferred;
                        // Estimate count by comparing totals (rough estimate)
                        untransferredPayments = payments.length - transferredPayments.length;
                        if (untransferredPayments < 0) untransferredPayments = 1;
                    }
                }

                return {
                    ...prepaid,
                    payments,
                    totalPayments: payments.reduce((sum, p) => sum + Number(p.amount), 0),
                    untransferredPayments,
                    untransferredAmount
                };
            })
        );

        res.json({
            prepaids: prepaidsWithPayments,
            hasLinkedPrepaid: !!invoice.linkedPrepaidId,
            invoicePoNo: invoice.poNo
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch matching prepaids', message: error.message });
    }
};

// Accept and link a prepaid invoice to a regular invoice
export const acceptPrepaid = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { prepaidId, transferPayments = true } = req.body;

        if (!prepaidId) {
            return res.status(400).json({ error: 'Prepaid invoice ID is required' });
        }

        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const result = await prisma.$transaction(async (tx) => {
            const [regularInvoice, prepaidInvoice] = await Promise.all([
                tx.aRInvoice.findUnique({ where: { id } }),
                tx.aRInvoice.findUnique({ where: { id: prepaidId } })
            ]);

            if (!regularInvoice) throw new Error('Regular invoice not found');
            // Allow null or REGULAR invoiceType (older imports may have null)
            if (regularInvoice.invoiceType === 'PREPAID') throw new Error('Target cannot be a PREPAID invoice');
            if (!prepaidInvoice) throw new Error('Prepaid invoice not found');
            if (prepaidInvoice.invoiceType !== 'PREPAID') throw new Error('Source must be a PREPAID invoice');

            // Compare base PO numbers (ignoring date suffixes like "Dtd:7/2/2025")
            // Also allow matching by invoice number if prepaid's invoice number contains base PO
            const getBasePO = (po: string | null) => po ? po.split(/[\s,]+/)[0].trim() : '';
            const regularBasePO = getBasePO(regularInvoice.poNo);
            const prepaidBasePO = getBasePO(prepaidInvoice.poNo);

            // Allow linking if:
            // 1. Both POs match exactly
            // 2. Prepaid's invoice number contains the regular invoice's PO (e.g., "PRE-REF005" contains "REF005")
            // 3. PO fields contain each other (flexible matching)
            const invoiceNumberContainsPO = regularBasePO && prepaidInvoice.invoiceNumber.includes(regularBasePO);
            const posMatch = regularBasePO && prepaidBasePO && regularBasePO === prepaidBasePO;
            const posContainEachOther = regularBasePO && prepaidBasePO &&
                (regularBasePO.includes(prepaidBasePO) || prepaidBasePO.includes(regularBasePO));

            if (!posMatch && !posContainEachOther && !invoiceNumberContainsPO) {
                throw new Error(`PO numbers do not match: ${regularBasePO || '(empty)'} vs ${prepaidBasePO || '(empty)'}. Prepaid invoice number: ${prepaidInvoice.invoiceNumber}`);
            }

            // Check if this is a re-link (already linked before)
            const isReLink = prepaidInvoice.linkedInvoiceId === id;

            const now = new Date();
            // Update prepaid invoice (only if not already linked)
            if (!isReLink) {
                await tx.aRInvoice.update({
                    where: { id: prepaidId },
                    data: { linkedInvoiceId: id, prepaidStatus: 'LINKED', prepaidAcceptedAt: now }
                });

                await tx.aRInvoice.update({
                    where: { id },
                    data: { linkedPrepaidId: prepaidId }
                });
            }

            let totalTransferred = 0;

            if (transferPayments) {
                const prepaidPayments = await tx.aRPaymentHistory.findMany({
                    where: { invoiceId: prepaidId }
                });

                // Get already transferred payments to avoid duplicates
                const alreadyTransferred = await tx.aRPaymentHistory.findMany({
                    where: {
                        invoiceId: id,
                        notes: { contains: `[From Prepaid ${prepaidInvoice.invoiceNumber}]` }
                    },
                    select: { amount: true, paymentDate: true }
                });

                // Calculate already transferred total
                const alreadyTransferredTotal = alreadyTransferred.reduce((sum, p) => sum + Number(p.amount), 0);

                // Track running total to find which payments are new
                let runningTotal = 0;

                for (const payment of prepaidPayments) {
                    runningTotal += Number(payment.amount);

                    // Skip if this payment's running total is within already transferred amount
                    if (runningTotal <= alreadyTransferredTotal) {
                        continue;
                    }

                    await tx.aRPaymentHistory.create({
                        data: {
                            invoiceId: id,
                            amount: payment.amount,
                            paymentDate: payment.paymentDate,
                            paymentTime: payment.paymentTime,
                            paymentMode: payment.paymentMode,
                            referenceNo: payment.referenceNo,
                            notes: `[From Prepaid ${prepaidInvoice.invoiceNumber}] ${payment.notes || ''}`.trim(),
                            recordedBy: user.name || 'System'
                        }
                    });
                    totalTransferred += Number(payment.amount);
                }

                const currentReceipts = Number(regularInvoice.receipts || 0);
                const currentAdjustments = Number(regularInvoice.adjustments || 0);
                const newReceipts = currentReceipts + totalTransferred;
                const newTotalReceipts = newReceipts + currentAdjustments;
                const newBalance = Number(regularInvoice.totalAmount) - newTotalReceipts;

                let newStatus: ARInvoiceStatus = regularInvoice.status;
                if (newBalance <= 0) newStatus = 'PAID';
                else if (newTotalReceipts > 0) newStatus = 'PARTIAL';

                await tx.aRInvoice.update({
                    where: { id },
                    data: { receipts: newReceipts, totalReceipts: newTotalReceipts, balance: newBalance, status: newStatus }
                });

                return { success: true, prepaidInvoiceNumber: prepaidInvoice.invoiceNumber, totalTransferred, newBalance, newStatus };
            }

            return { success: true, prepaidInvoiceNumber: prepaidInvoice.invoiceNumber, totalTransferred: 0 };
        });

        await Promise.all([
            logInvoiceActivity({
                invoiceId: id,
                action: 'PREPAID_LINKED',
                description: `Prepaid ${result.prepaidInvoiceNumber} linked. Transferred: ₹${result.totalTransferred.toLocaleString()}`,
                performedById: user.id,
                performedBy: user.name,
                ipAddress,
                userAgent,
                metadata: { prepaidId, totalTransferred: result.totalTransferred }
            }),
            logInvoiceActivity({
                invoiceId: prepaidId,
                action: 'LINKED_TO_INVOICE',
                description: `Linked to invoice ${id}. Status: LINKED`,
                performedById: user.id,
                performedBy: user.name,
                ipAddress,
                userAgent,
                metadata: { linkedInvoiceId: id }
            })
        ]);

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to link prepaid invoice' });
    }
};

// Get linked prepaid details for an invoice
export const getLinkedPrepaidDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const invoice = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { linkedPrepaidId: true }
        });

        if (!invoice || !invoice.linkedPrepaidId) {
            return res.json({ linkedPrepaid: null });
        }

        const linkedPrepaid = await prisma.aRInvoice.findUnique({
            where: { id: invoice.linkedPrepaidId },
            select: {
                id: true,
                invoiceNumber: true,
                soNo: true,
                poNo: true,
                totalAmount: true,
                totalReceipts: true,
                advanceReceivedDate: true,
                prepaidStatus: true,
                prepaidAcceptedAt: true,
                customerName: true
            }
        });

        const transferredPayments = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: id, notes: { contains: 'From Prepaid' } },
            select: { id: true, amount: true, paymentDate: true, paymentMode: true, referenceNo: true, notes: true }
        });

        res.json({
            linkedPrepaid,
            transferredPayments,
            totalTransferred: transferredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch linked prepaid details', message: error.message });
    }
};
