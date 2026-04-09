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
            invoiceType, // Filter by invoice type (REGULAR, MILESTONE)
            agingBucket, // Filter by aging bucket (current, 1-30, 31-60, 61-90, 90+)
            region,
            type: category,
            accountingStatus,
            bookingMonth,
            riskClass,
            tsp,
            personInCharge,
            minAmount,
            maxAmount,
            page = 1,
            limit = 20
        } = req.query;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const where: any = {};

        if (search) {
            where.OR = [
                { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
                { bpCode: { contains: String(search), mode: 'insensitive' } },
                { customerName: { contains: String(search), mode: 'insensitive' } },
                { poNo: { contains: String(search), mode: 'insensitive' } },
                { soNo: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        let filterStatusInMemory: string | null = null;

        if (status) {
            if (invoiceType === 'MILESTONE' && ['OVERDUE', 'PENDING', 'PARTIAL'].includes(String(status))) {
                where.status = { not: 'CANCELLED' };
                filterStatusInMemory = String(status);
            } else if (invoiceType === 'REGULAR' && status === 'OVERDUE') {
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { status: 'OVERDUE' },
                            {
                                status: { in: ['PENDING', 'PARTIAL'] },
                                dueDate: { lt: today }
                            }
                        ]
                    }
                ];
            } else if (invoiceType === 'REGULAR' && (status === 'PENDING' || status === 'PARTIAL')) {
                where.status = status;
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { dueDate: { gte: today } },
                            { dueDate: null }
                        ]
                    }
                ];
            } else {
                where.status = status;
            }
        } else {
            // Default: do not show cancelled invoices in the main list
            where.status = { not: 'CANCELLED' };
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
            if (invoiceType === 'MILESTONE') {
                where.status = { not: 'CANCELLED' };
                filterStatusInMemory = 'OVERDUE';
            } else {
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { status: 'OVERDUE' },
                            {
                                status: { in: ['PENDING', 'PARTIAL'] },
                                dueDate: { lt: today }
                            }
                        ]
                    }
                ];
            }
        }

        // Filter by invoice type (REGULAR, MILESTONE)
        if (invoiceType) {
            where.invoiceType = String(invoiceType);
        }

        if (region) {
            where.region = String(region);
        }

        if (category) {
            where.type = String(category);
        }

        if (accountingStatus) {
            where.accountingStatus = String(accountingStatus);
        }

        if (bookingMonth) {
            where.bookingMonth = String(bookingMonth);
        }

        if (riskClass) {
            where.riskClass = String(riskClass);
        }
        // Combined Personnel Filter (Checks both legacy mailToTSP and new personInCharge columns)
        const personnel = personInCharge || tsp;
        if (personnel) {
            const personnelClauses = [
                { personInCharge: String(personnel) },
                { mailToTSP: String(personnel) }
            ];

            if (where.OR) {
                // If search already populated OR, combine them with AND
                where.AND = [
                    ...(where.AND || []),
                    { OR: where.OR },
                    { OR: personnelClauses }
                ];
                delete where.OR;
            } else {
                where.OR = personnelClauses;
            }
        }

        if (minAmount || maxAmount) {
            where.totalAmount = {};
            if (minAmount) where.totalAmount.gte = parseFloat(String(minAmount));
            if (maxAmount) where.totalAmount.lte = parseFloat(String(maxAmount));
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [invoices, total] = await Promise.all([
            prisma.aRInvoice.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    invoiceNumber: true,
                    bpCode: true,
                    customerName: true,
                    poNo: true,
                    totalAmount: true,
                    netAmount: true,
                    taxAmount: true,
                    invoiceDate: true,
                    dueDate: true,
                    balance: true,
                    status: true,
                    riskClass: true,
                    region: true,
                    invoiceType: true,
                    totalReceipts: true,
                    linkedMilestoneId: true,
                    advanceReceivedDate: true,
                    deliveryDueDate: true,
                    milestoneStatus: true,
                    type: true,
                    soNo: true,
                    milestoneTerms: true,
                    accountingStatus: true,
                    mailToTSP: true,
                    bookingMonth: true,
                    createdAt: true,
                    remarks: {
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            createdBy: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.aRInvoice.count({ where })
        ]);

        // Fetch payment history for these invoices to calculate accurate totals
        const invoiceIds = invoices.map((inv: any) => inv.id);

        const payments = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, amount: true, paymentMode: true, milestoneTerm: true }
        });

        // Group payments by invoiceId and compute accurate totals
        const paymentsAggr = payments.reduce((acc: any, curr: any) => {
            if (!acc[curr.invoiceId]) acc[curr.invoiceId] = { total: 0, receipts: 0, adjustments: 0, modes: [] };
            const amt = Number(curr.amount);
            if (curr.paymentMode === 'ADJUSTMENT' || curr.paymentMode === 'CREDIT_NOTE') {
                acc[curr.invoiceId].adjustments += amt;
            } else {
                acc[curr.invoiceId].receipts += amt;
            }
            acc[curr.invoiceId].total += amt;
            acc[curr.invoiceId].modes.push({ paymentMode: curr.paymentMode, amount: curr.amount, milestoneTerm: curr.milestoneTerm });
            return acc;
        }, {});

        // Calculate days overdue for each invoice and attach aggregated payment data
        const invoicesWithOverdue = invoices.map((invoice: any) => {
            const today = new Date();
            let dueByDays = 0;
            let isOverdue = false;

            if (invoice.invoiceType === 'MILESTONE' && invoice.milestoneTerms) {
                // For milestone invoices, calculate aging from the earliest term date
                const terms = invoice.milestoneTerms as any[];
                if (Array.isArray(terms) && terms.length > 0) {
                    const earliestTerm = terms.reduce((earliest: any, term: any) => {
                        if (!earliest || new Date(term.termDate) < new Date(earliest.termDate)) return term;
                        return earliest;
                    }, null);
                    if (earliestTerm?.termDate) {
                        dueByDays = calculateDaysBetween(new Date(earliestTerm.termDate), today);
                    }

                    // Calculate if this milestone is dynamically overdue
                    let totalAllocatedUpToToday = 0;
                    const netAmount = Number(invoice.netAmount || 0);
                    const totalTax = Number(invoice.taxAmount || 0);

                    terms.forEach((term: any) => {
                        const termDate = new Date(term.termDate);
                        termDate.setHours(0, 0, 0, 0);
                        if (today.getTime() > termDate.getTime()) {
                            const isNetBasis = term.calculationBasis !== 'TOTAL_AMOUNT';
                            const percentage = term.percentage || 0;
                            const taxPercentage = term.taxPercentage || 0;
                            if (isNetBasis) {
                                totalAllocatedUpToToday += (netAmount * percentage) / 100;
                            } else {
                                totalAllocatedUpToToday += ((netAmount * percentage) / 100) + ((totalTax * taxPercentage) / 100);
                            }
                        }
                    });

                    const paymentDataForTotal = paymentsAggr[invoice.id] ? paymentsAggr[invoice.id].total : (Number(invoice.totalReceipts) || 0);
                    isOverdue = (totalAllocatedUpToToday - paymentDataForTotal) > 0.01;
                }
            } else if (invoice.dueDate) {
                // calculateDaysBetween should handle Date objects
                dueByDays = calculateDaysBetween(new Date(invoice.dueDate), today);
                isOverdue = dueByDays > 0 && invoice.status !== 'PAID';
            }

            // Use payment history totals for accurate display (overrides potentially stale stored values)
            const paymentData = paymentsAggr[invoice.id];
            const computedTotalReceipts = paymentData ? paymentData.total : Number(invoice.totalReceipts) || 0;
            const computedBalance = Number(invoice.totalAmount) - computedTotalReceipts;

            // Determine accurate status from computed values
            let computedStatus = invoice.status;
            if (invoice.status !== 'CANCELLED') {
                if (computedBalance <= 0 && computedTotalReceipts > 0) computedStatus = 'PAID';
                else if (isOverdue) computedStatus = 'OVERDUE';
                else if (computedTotalReceipts > 0) computedStatus = 'PARTIAL';
                else computedStatus = 'PENDING';
            }

            return {
                ...invoice,
                paymentHistory: paymentData?.modes || [],
                totalReceipts: computedTotalReceipts,
                balance: computedBalance,
                status: computedStatus,
                dueByDays,
                isOverdue
            };
        });

        // Filter by aging bucket if specified
        let filteredInvoices = invoicesWithOverdue;
        if (agingBucket) {
            const bucket = String(agingBucket);
            filteredInvoices = invoicesWithOverdue.filter((inv: any) => {
                const days = inv.dueByDays;
                switch (bucket) {
                    case 'current': return days <= 0; // Not yet due
                    case '1-30': return days >= 1 && days <= 30;
                    case '31-60': return days >= 31 && days <= 60;
                    case '61-90': return days >= 61 && days <= 90;
                    case '90+': return days > 90;
                    default: return true;
                }
            });
        }

        if (filterStatusInMemory) {
            filteredInvoices = filteredInvoices.filter((inv: any) => inv.status === filterStatusInMemory);
        }

        const shouldOverridePagination = agingBucket || filterStatusInMemory;

        res.json({
            data: shouldOverridePagination ? filteredInvoices : invoicesWithOverdue,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: shouldOverridePagination ? filteredInvoices.length : total,
                totalPages: shouldOverridePagination ? 1 : Math.ceil(total / Number(limit))
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
        const { type } = req.query; // Optional: 'REGULAR' or 'MILESTONE' to disambiguate when invoice numbers match

        let invoice: any;
        if (id.length === 36) { // Likely UUID
            invoice = await prisma.aRInvoice.findUnique({
                where: { id },
                include: {
                    linkedFromMilestones: true,
                    linkedInvoice: true
                }
            });
        } else {
            // When both REGULAR and MILESTONE invoices share the same invoice number,
            // use the `type` query parameter to return the correct one
            const whereClause: any = { invoiceNumber: id };
            if (type === 'MILESTONE' || type === 'REGULAR') {
                whereClause.invoiceType = type;
            }

            invoice = await prisma.aRInvoice.findFirst({
                where: whereClause,
                orderBy: { invoiceType: 'desc' }, // REGULAR first (R > M alphabetically in desc)
                include: {
                    linkedFromMilestones: true,
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
            orderBy: [
                { paymentDate: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        // Compute accurate totalReceipts and balance from payment history
        let computedReceipts = 0;
        let computedAdjustments = 0;
        paymentHistory.forEach((p: any) => {
            const amt = Number(p.amount);
            if (p.paymentMode === 'ADJUSTMENT' || p.paymentMode === 'CREDIT_NOTE') {
                computedAdjustments += amt;
            } else {
                computedReceipts += amt;
            }
        });
        const computedTotalReceipts = computedReceipts + computedAdjustments;
        const computedBalance = Number(invoice.totalAmount) - computedTotalReceipts;

        // Sync stored values if they differ from computed (auto-heal stale data)
        const storedTotalReceipts = Number(invoice.totalReceipts || 0);
        if (Math.abs(storedTotalReceipts - computedTotalReceipts) > 0.01) {
            // Determine accurate status
            let newStatus = invoice.status;
            if (invoice.status !== 'CANCELLED') {
                if (computedBalance <= 0 && computedTotalReceipts > 0) newStatus = 'PAID';
                else if (computedTotalReceipts > 0) newStatus = 'PARTIAL';
                else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) newStatus = 'OVERDUE';
                else newStatus = 'PENDING';
            }

            // Update stored values in DB (non-blocking, best-effort)
            prisma.aRInvoice.update({
                where: { id: invoice.id },
                data: {
                    receipts: computedReceipts,
                    adjustments: computedAdjustments,
                    totalReceipts: computedTotalReceipts,
                    balance: computedBalance,
                    status: newStatus
                }
            }).catch(() => { }); // Fire-and-forget, don't block response

            // Override invoice values for response
            invoice.receipts = computedReceipts;
            invoice.adjustments = computedAdjustments;
            invoice.totalReceipts = computedTotalReceipts;
            invoice.balance = computedBalance;
            invoice.status = newStatus;
        }

        // Fetch payment history for linked milestones
        if (invoice.linkedFromMilestones && invoice.linkedFromMilestones.length > 0) {
            invoice.linkedFromMilestones = await Promise.all(invoice.linkedFromMilestones.map(async (milestone: any) => {
                const payments = await prisma.aRPaymentHistory.findMany({
                    where: { invoiceId: milestone.id },
                    orderBy: [
                        { paymentDate: 'desc' },
                        { createdAt: 'desc' }
                    ]
                });
                return { ...milestone, paymentHistory: payments };
            }));
        }

        // Fetch payment history for linked regular invoice (if this is a milestone)
        if (invoice.linkedInvoice) {
            const payments = await prisma.aRPaymentHistory.findMany({
                where: { invoiceId: invoice.linkedInvoice.id },
                orderBy: [
                    { paymentDate: 'desc' },
                    { createdAt: 'desc' }
                ]
            });
            invoice.linkedInvoice = { ...invoice.linkedInvoice, paymentHistory: payments };
        }

        // Calculate days dynamically: positive = overdue, negative = days remaining
        const today = new Date();
        let dueByDays = 0;
        let isOverdue = false;

        if (invoice.invoiceType === 'MILESTONE' && invoice.milestoneTerms) {
            // For milestone invoices, calculate aging from the earliest term date
            const terms = invoice.milestoneTerms as any[];
            if (Array.isArray(terms) && terms.length > 0) {
                const earliestTerm = terms.reduce((earliest: any, term: any) => {
                    if (!earliest || new Date(term.termDate) < new Date(earliest.termDate)) return term;
                    return earliest;
                }, null);
                if (earliestTerm?.termDate) {
                    dueByDays = calculateDaysBetween(new Date(earliestTerm.termDate), today);
                    isOverdue = false;
                }
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
        const { amount, paymentDate, paymentTime, paymentMode, referenceNo, referenceBank, notes, milestoneTerm } = req.body;

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
                    milestoneTerm: milestoneTerm || null,
                    recordedBy
                }
            });

            // Recalculate totals from ALL payment history (prevents stale stored value drift)
            const allPayments = await tx.aRPaymentHistory.findMany({
                where: { invoiceId: id }
            });

            let newReceipts = 0;
            let newAdjustments = 0;
            allPayments.forEach((p: any) => {
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
            if (invoice.status !== 'CANCELLED') {
                if (balance <= 0 && totalReceipts > 0) status = 'PAID';
                else if (totalReceipts > 0) status = 'PARTIAL';
                else status = 'PENDING';
            }

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
            description: `Payment recorded${milestoneTerm ? ` for Stage: ${milestoneTerm}` : ''}${referenceNo ? ` (Ref: ${referenceNo})` : ''}`,
            fieldName: 'Payment Amount',
            newValue: `₹${parsedAmount.toLocaleString()} (${paymentMode})`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress,
            userAgent,
            metadata: { amount: parsedAmount, paymentMode, referenceNo, milestoneTerm: milestoneTerm || null, newBalance: result.balance, newStatus: result.status }
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
        const { amount, paymentDate, paymentMode, referenceBank, notes, milestoneTerm } = req.body;

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
                    notes,
                    milestoneTerm: milestoneTerm || null
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
            if (invoice.status !== 'CANCELLED') {
                if (balance <= 0 && totalReceipts > 0) status = 'PAID';
                else if (totalReceipts > 0) status = 'PARTIAL';
                else status = 'PENDING';
            }

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

            return { updatedPayment, existingPayment, balance, status };
        });

        const oldAmt = Number(result.existingPayment.amount);
        const newAmt = Number(result.updatedPayment.amount);

        let desc = 'Payment updated';
        let fName = undefined;
        let oVal = undefined;
        let nVal = undefined;

        if (oldAmt !== newAmt) {
            fName = 'Payment Amount';
            oVal = `₹${oldAmt.toLocaleString()}`;
            nVal = `₹${newAmt.toLocaleString()}`;
        } else if (result.existingPayment.paymentMode !== result.updatedPayment.paymentMode) {
            fName = 'Payment Mode';
            oVal = result.existingPayment.paymentMode;
            nVal = result.updatedPayment.paymentMode;
        } else if (result.existingPayment.milestoneTerm !== result.updatedPayment.milestoneTerm) {
            fName = 'Milestone Stage';
            oVal = result.existingPayment.milestoneTerm || 'None';
            nVal = result.updatedPayment.milestoneTerm || 'None';
        }

        // Log activity
        await logInvoiceActivity({
            invoiceId: id,
            action: 'PAYMENT_UPDATED',
            description: desc,
            fieldName: fName,
            oldValue: oVal,
            newValue: nVal,
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

            invoicePayments.forEach((p: any) => {
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
            if (invoice.status !== 'CANCELLED') {
                if (balance <= 0 && totalReceipts > 0) status = 'PAID';
                else if (totalReceipts > 0) status = 'PARTIAL';
                else status = 'PENDING';
            }

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
            description: `Payment deleted via ${result.modeDeleted}`,
            fieldName: 'Payment Amount',
            oldValue: `₹${result.amountDeleted.toLocaleString()}`,
            newValue: 'Deleted',
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
    const parseDate = (val: any) => {
        if (!val || val === '' || val === 'null') return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    };

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
            bpCode,
            actualPaymentTerms,
            // Milestone fields
            invoiceType,
            advanceReceivedDate,
            deliveryDueDate,
            type,
            milestoneTerms,
            accountingStatus,
            mailToTSP,
            bookingMonth,
            // Master Fields
            emailId,
            contactNo,
            region,
            department,
            personInCharge,
            pocName,
            // Guarantees Tracking
            hasAPG,
            apgDraftDate,
            apgDraftNote,
            apgDraftSteps,
            apgIntermediateSteps,
            apgSignedDate,
            apgSignedNote,
            apgSignedSteps,
            hasPBG,
            pbgDraftDate,
            pbgDraftNote,
            pbgDraftSteps,
            pbgIntermediateSteps,
            pbgSignedDate,
            pbgSignedNote,
            pbgSignedSteps,
            // Delivery Tracking
            deliveryStatus,
            modeOfDelivery,
            sentHandoverDate,
            impactDate
        } = req.body;

        const effectiveCustomerId = customerId || bpCode;

        if (!effectiveCustomerId || !totalAmount) {
            return res.status(400).json({
                error: 'Customer (customerId or bpCode) and Total Amount are required'
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

        // Calculate due date: use provided or null
        let calculatedDueDate = dueDate ? new Date(dueDate) : null;

        // Try to fetch remaining details from master if not provided
        let masterData = null;
        if (customerId && (!emailId || !contactNo || !region)) {
            masterData = await prisma.aRCustomer.findUnique({
                where: { bpCode: customerId }
            });
        }

        const invoice = await prisma.aRInvoice.create({
            data: {
                invoiceNumber: invoiceNumber || '',
                bpCode: effectiveCustomerId,
                customerName: req.body.customerName || '',
                poNo,
                soNo: soNo || null,  // Sales Order Number for milestone invoices
                invoiceDate: parseDate(invoiceDate),
                dueDate: calculatedDueDate,
                totalAmount: parseFloat(totalAmount) || 0,
                netAmount: parseFloat(netAmount) || parseFloat(totalAmount) || 0,
                taxAmount: taxAmount ? (parseFloat(taxAmount) || 0) : null,
                balance: parseFloat(totalAmount) || 0,
                actualPaymentTerms,
                status,
                // Milestone fields
                invoiceType: invoiceType || 'REGULAR',
                advanceReceivedDate: parseDate(advanceReceivedDate),
                deliveryDueDate: parseDate(deliveryDueDate),
                milestoneStatus: invoiceType === 'MILESTONE' ? 'AWAITING_DELIVERY' : null,
                type: type || null,
                milestoneTerms: milestoneTerms || null,
                accountingStatus: accountingStatus || null,
                mailToTSP: mailToTSP || null,
                bookingMonth: bookingMonth || null,
                // Master Fields
                emailId: emailId || masterData?.emailId || null,
                contactNo: contactNo || masterData?.contactNo || null,
                region: region || masterData?.region || null,
                department: department || masterData?.department || null,
                personInCharge: personInCharge || masterData?.personInCharge || null,
                pocName: pocName || masterData?.pocName || null,
                hasAPG: hasAPG || false,
                apgDraftDate: parseDate(apgDraftDate),
                apgDraftNote: apgDraftNote || null,
                apgDraftSteps: apgDraftSteps || null,
                apgIntermediateSteps: apgIntermediateSteps || null,
                apgSignedDate: parseDate(apgSignedDate),
                apgSignedNote: apgSignedNote || null,
                apgSignedSteps: apgSignedSteps || null,
                hasPBG: hasPBG || false,
                pbgDraftDate: parseDate(pbgDraftDate),
                pbgDraftNote: pbgDraftNote || null,
                pbgDraftSteps: pbgDraftSteps || null,
                pbgIntermediateSteps: pbgIntermediateSteps || null,
                pbgSignedDate: parseDate(pbgSignedDate),
                pbgSignedNote: pbgSignedNote || null,
                pbgSignedSteps: pbgSignedSteps || null,
                // Delivery Tracking
                deliveryStatus: deliveryStatus || 'PENDING',
                modeOfDelivery: modeOfDelivery || null,
                sentHandoverDate: parseDate(sentHandoverDate),
                impactDate: parseDate(impactDate)
            }
        });

        // ═══════════════════════════════════════════════════════════════════════════
        // AUTOMATIC CUSTOMER MASTER DISCOVERY
        // ═══════════════════════════════════════════════════════════════════════════
        // If this BP Code doesn't exist in Master, create it automatically
        await prisma.aRCustomer.upsert({
            where: { bpCode: effectiveCustomerId },
            create: {
                bpCode: effectiveCustomerId,
                customerName: req.body.customerName || '',
                emailId: emailId || masterData?.emailId || null,
                contactNo: contactNo || masterData?.contactNo || null,
                region: region || masterData?.region || null,
                department: department || masterData?.department || null,
                personInCharge: personInCharge || masterData?.personInCharge || null,
                pocName: pocName || masterData?.pocName || null,
                riskClass: 'LOW'
            },
            update: {
                // Optionally update name/details if it changed
                customerName: req.body.customerName || undefined,
                emailId: emailId || undefined,
                contactNo: contactNo || undefined,
                region: region || undefined,
                department: department || undefined,
                personInCharge: personInCharge || undefined,
                pocName: pocName || undefined
            }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logInvoiceActivity({
            invoiceId: invoice.id,
            action: 'INVOICE_CREATED',
            description: `${invoiceType === 'MILESTONE' ? 'Milestone Payment' : 'Invoice'} ${invoiceNumber} created for ${req.body.customerName || effectiveCustomerId} - Amount: ₹${parseFloat(totalAmount).toLocaleString()}`,
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
        const dateFields = [
            'dueDate',
            'invoiceDate',
            'sentHandoverDate',
            'impactDate',
            'advanceReceivedDate',
            'deliveryDueDate',
            'milestoneAcceptedAt',
            'apgDraftDate',
            'apgSignedDate',
            'pbgDraftDate',
            'pbgSignedDate'
        ];

        dateFields.forEach(field => {
            if (updateData[field] !== undefined) {
                // If it's an empty string or null, set to null
                // Otherwise convert to Date object
                updateData[field] = updateData[field] ? new Date(updateData[field]) : null;
            }
        });
        // milestoneTerms is a JSON array, no date conversion needed

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
            if (updateData.status === 'CANCELLED') {
                updateData.balance = 0;
                updateData.receipts = 0;
                updateData.adjustments = 0;
                updateData.totalReceipts = 0;
            } else if (updateData.totalAmount !== undefined || updateData.totalReceipts !== undefined) {
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
            milestoneStatus: 'Milestone Status',
            milestoneTerms: 'Milestone Terms',
            accountingStatus: 'Accounting Status',
            mailToTSP: 'Mail to TSP',
            bookingMonth: 'Booking Month',
            hasAPG: 'Has APG Guarantee',
            apgDraftDate: 'APG Draft Date',
            apgDraftNote: 'APG Draft Note',
            apgDraftSteps: 'APG Draft Steps',
            apgIntermediateSteps: 'APG Intermediate Steps',
            apgSignedDate: 'APG Signed Date',
            apgSignedNote: 'APG Signed Note',
            apgSignedSteps: 'APG Signed Steps',
            hasPBG: 'Has PBG Guarantee',
            pbgDraftDate: 'PBG Draft Date',
            pbgDraftNote: 'PBG Draft Note',
            pbgDraftSteps: 'PBG Draft Steps',
            pbgIntermediateSteps: 'PBG Intermediate Steps',
            pbgSignedDate: 'PBG Signed Date',
            pbgSignedNote: 'PBG Signed Note',
            pbgSignedSteps: 'PBG Signed Steps'
        };

        // Build detailed change description
        let hasChanges = false;
        const skipKeys = ['updatedAt', 'receipts', 'adjustments', 'totalReceipts', 'balance']; // Skip logging derived financial fields individually as they can be noisy
        for (const key of Object.keys(updateData)) {
            if (skipKeys.includes(key)) continue;
            const oldVal = (result.existingInvoice as any)[key];
            const newVal = updateData[key];

            // Handle JSON array serialization comparison (DETAILED)
            if (['milestoneTerms', 'apgIntermediateSteps', 'pbgIntermediateSteps', 'apgDraftSteps', 'apgSignedSteps', 'pbgDraftSteps', 'pbgSignedSteps'].includes(key)) {
                const oldArray = (Array.isArray(oldVal) ? oldVal : []) as any[];
                const newArray = (Array.isArray(newVal) ? newVal : []) as any[];

                if (JSON.stringify(oldArray) !== JSON.stringify(newArray)) {
                    hasChanges = true;
                    const label = fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                    let actionDesc = `Updated ${label}`;
                    let oldDisplay = `${oldArray.length} items`;
                    let newDisplay = `${newArray.length} items`;

                    // For tracking steps, try to identify added/removed/modified
                    if (key.toLowerCase().includes('steps')) {
                        // Use ID if available, otherwise composite key for legacy
                        const getStepKey = (s: any) => s.id || `${s.date}-${s.note}`;
                        const oldStepMap = new Map(oldArray.map(s => [getStepKey(s), s]));
                        const newStepMap = new Map(newArray.map(s => [getStepKey(s), s]));

                        const added = newArray.filter(s => !oldStepMap.has(getStepKey(s)));
                        const removed = oldArray.filter(s => !newStepMap.has(getStepKey(s)));
                        const modified = newArray.filter(s => {
                            const old = oldStepMap.get(getStepKey(s));
                            return old && JSON.stringify(old) !== JSON.stringify(s);
                        });

                        if (added.length === 1 && removed.length === 0 && modified.length === 0) {
                            actionDesc = `Added step to ${label}`;
                            newDisplay = `${added[0].date || 'No Date'}${added[0].note ? `: ${added[0].note}` : ''}`;
                            oldDisplay = `${oldArray.length} steps`;
                        } else if (removed.length === 1 && added.length === 0 && modified.length === 0) {
                            actionDesc = `Removed step from ${label}`;
                            oldDisplay = `${removed[0].date || 'No Date'}${removed[0].note ? `: ${removed[0].note}` : ''}`;
                            newDisplay = `${newArray.length} steps`;
                        } else if (modified.length === 1 && added.length === 0 && removed.length === 0) {
                            const step = modified[0];
                            const old = oldStepMap.get(getStepKey(step));
                            actionDesc = `Modified step in ${label}`;
                            oldDisplay = `${old.date || 'No Date'}${old.note ? `: ${old.note}` : ''}`;
                            newDisplay = `${step.date || 'No Date'}${step.note ? `: ${step.note}` : ''}`;
                        } else {
                            actionDesc = `Updated ${label}`;
                            oldDisplay = `${oldArray.length} steps`;
                            newDisplay = `${newArray.length} steps (${added.length} added, ${removed.length} removed, ${modified.length} modified)`;
                        }
                    } else if (key === 'milestoneTerms') {
                        actionDesc = `Updated Milestone Payment Terms`;
                        oldDisplay = `${oldArray.length} terms defined`;
                        newDisplay = `${newArray.length} terms defined`;
                    }

                    await logInvoiceActivity({
                        invoiceId: id,
                        action: 'INVOICE_UPDATED',
                        description: actionDesc,
                        fieldName: label,
                        oldValue: oldDisplay,
                        newValue: newDisplay,
                        performedById: user.id,
                        performedBy: user.name,
                        ipAddress,
                        userAgent
                    });
                }
                continue;
            }

            // Compare values (handle dates and numbers)
            const oldStr = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : String(oldVal ?? 'N/A');
            const newStr = newVal instanceof Date ? newVal.toISOString().split('T')[0] : String(newVal ?? 'N/A');

            if (oldStr !== newStr) {
                hasChanges = true;
                const label = fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                // Format output
                const outOld = (oldStr === 'N/A' || oldStr === 'null' || oldStr === '') ? 'None' : oldStr;
                const outNew = (newStr === 'N/A' || newStr === 'null' || newStr === '') ? 'None' : newStr;

                await logInvoiceActivity({
                    invoiceId: id,
                    action: 'INVOICE_UPDATED',
                    description: `Updated ${label}`,
                    fieldName: label,
                    oldValue: outOld,
                    newValue: outNew,
                    performedById: user.id,
                    performedBy: user.name,
                    ipAddress,
                    userAgent
                });
            }
        }

        if (!hasChanges) {
            await logInvoiceActivity({
                invoiceId: id,
                action: 'INVOICE_UPDATED',
                description: 'Invoice updated (no changes detected)',
                performedById: user.id,
                performedBy: user.name,
                ipAddress,
                userAgent
            });
        }

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

        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const result = await prisma.$transaction(async (tx) => {
            const existingInvoice = await tx.aRInvoice.findUnique({ where: { id } });
            if (!existingInvoice) {
                throw new Error('INVOICE_NOT_FOUND');
            }

            const invoice = await tx.aRInvoice.update({
                where: { id },
                data: {
                    deliveryStatus,
                    modeOfDelivery,
                    sentHandoverDate: sentHandoverDate ? new Date(sentHandoverDate) : null,
                    impactDate: impactDate ? new Date(impactDate) : null
                }
            });
            return { existingInvoice, invoice };
        });

        const updateData: any = { deliveryStatus, modeOfDelivery, sentHandoverDate: result.invoice.sentHandoverDate, impactDate: result.invoice.impactDate };
        let hasChanges = false;

        const fieldLabels: Record<string, string> = {
            deliveryStatus: 'Delivery Status',
            modeOfDelivery: 'Mode of Delivery',
            sentHandoverDate: 'Sent/Handover Date',
            impactDate: 'Impact Date'
        };

        for (const key of Object.keys(updateData)) {
            const oldVal = (result.existingInvoice as any)[key];
            const newVal = updateData[key];

            const oldStr = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : String(oldVal ?? 'N/A');
            const newStr = newVal instanceof Date ? newVal.toISOString().split('T')[0] : String(newVal ?? 'N/A');

            if (oldStr !== newStr) {
                hasChanges = true;
                const label = fieldLabels[key] || key;

                const outOld = (oldStr === 'N/A' || oldStr === 'null' || oldStr === '') ? 'None' : oldStr;
                const outNew = (newStr === 'N/A' || newStr === 'null' || newStr === '') ? 'None' : newStr;

                await logInvoiceActivity({
                    invoiceId: id,
                    action: 'DELIVERY_UPDATED',
                    description: `Updated ${label}`,
                    fieldName: label,
                    oldValue: outOld,
                    newValue: outNew,
                    performedById: user.id,
                    performedBy: user.name,
                    ipAddress,
                    userAgent
                });
            }
        }

        if (!hasChanges) {
            await logInvoiceActivity({
                invoiceId: id,
                action: 'DELIVERY_UPDATED',
                description: 'Delivery tracking updated (no changes detected)',
                performedById: user.id,
                performedBy: user.name,
                ipAddress,
                userAgent
            });
        }

        res.json(result.invoice);
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
            select: { invoiceNumber: true, customerName: true, totalAmount: true, status: true }
        });

        if (!invoiceToDelete) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        if (invoiceToDelete.status !== 'CANCELLED') {
            return res.status(400).json({ error: 'Only cancelled invoices can be deleted securely' });
        }

        // Delete associated records first (since there might be no cascade constraint)
        await prisma.aRPaymentHistory.deleteMany({
            where: { invoiceId: id }
        });

        await prisma.aRInvoiceRemark.deleteMany({
            where: { invoiceId: id }
        });

        // We do not delete aRActivityLog, as they are kept for audit history, or if we must:
        // await prisma.aRActivityLog.deleteMany({ where: { invoiceId: id } });

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


// Cancel invoice (Soft delete with status change)
export const cancelInvoice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Cancellation reason is required' });
        }

        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const result = await prisma.$transaction(async (tx) => {
            const invoice = await tx.aRInvoice.findUnique({ where: { id } });
            if (!invoice) throw new Error('INVOICE_NOT_FOUND');

            if (invoice.status === 'CANCELLED') {
                throw new Error('ALREADY_CANCELLED');
            }

            // Update invoice status and zero out financial fields
            const updatedInvoice = await tx.aRInvoice.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    balance: 0,
                    receipts: 0,
                    adjustments: 0,
                    totalReceipts: 0,
                    comments: reason ? `${invoice.comments ? invoice.comments + '\n' : ''}CANCELLED: ${reason}` : invoice.comments
                }
            });

            // Add cancellation remark officially
            await tx.aRInvoiceRemark.create({
                data: {
                    invoiceId: id,
                    content: `[CANCELLATION REASON]: ${reason}`,
                    createdById: user.id as number
                }
            });

            return { updatedInvoice, oldStatus: invoice.status };
        });

        // Log activity
        await logInvoiceActivity({
            invoiceId: id,
            action: 'INVOICE_CANCELLED',
            description: `Invoice ${result.updatedInvoice.invoiceNumber} cancelled. Reason: ${reason}`,
            fieldName: 'Status',
            oldValue: result.oldStatus,
            newValue: 'CANCELLED',
            performedById: user.id,
            performedBy: user.name,
            ipAddress,
            userAgent,
            metadata: { reason, previousStatus: result.oldStatus }
        });

        res.json({ message: 'Invoice cancelled successfully', invoice: result.updatedInvoice });
    } catch (error: any) {

        if (error.message === 'INVOICE_NOT_FOUND') return res.status(404).json({ error: 'Invoice not found' });
        if (error.message === 'ALREADY_CANCELLED') return res.status(400).json({ error: 'Invoice is already cancelled' });
        res.status(500).json({ error: 'Failed to cancel invoice', message: error.message });
    }
};

// Restore cancelled invoice
export const restoreInvoice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const result = await prisma.$transaction(async (tx) => {
            const invoice = await tx.aRInvoice.findUnique({
                where: { id }
            });

            if (!invoice) throw new Error('INVOICE_NOT_FOUND');
            if (invoice.status !== 'CANCELLED') {
                throw new Error('INVOICE_NOT_CANCELLED');
            }

            // Get payment history separately since it's a loose relation in schema
            const paymentHistory = await tx.aRPaymentHistory.findMany({
                where: { invoiceId: id }
            });

            // Recalculate totals from history
            const totalReceipts = paymentHistory.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
            const balance = Math.max(0, Number(invoice.totalAmount) - totalReceipts);

            // Determine new status
            let newStatus: any = 'PENDING';
            if (balance <= 0) {
                newStatus = 'PAID';
            } else if (totalReceipts > 0) {
                newStatus = 'PARTIAL';
            }

            // Also check for overdue status if pending/partial
            if (newStatus !== 'PAID' && invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
                newStatus = 'OVERDUE';
            }

            const updatedInvoice = await tx.aRInvoice.update({
                where: { id },
                data: {
                    status: newStatus,
                    balance,
                    totalReceipts,
                    receipts: totalReceipts, // Assuming receipts and totalReceipts are synced
                    comments: `${invoice.comments ? invoice.comments + '\n' : ''}RESTORED: Invoice restored on ${new Date().toLocaleDateString()}`
                }
            });

            // Add restoration remark
            await tx.aRInvoiceRemark.create({
                data: {
                    invoiceId: id,
                    content: `[RESTORATION]: Invoice restored to ${newStatus} status.`,
                    createdById: user.id as number
                }
            });

            return updatedInvoice;
        });

        // Log activity
        await logInvoiceActivity({
            invoiceId: id,
            action: 'INVOICE_RESTORED',
            description: `Invoice ${result.invoiceNumber} restored to ${result.status} status.`,
            fieldName: 'Status',
            oldValue: 'CANCELLED',
            newValue: result.status,
            performedById: user.id,
            performedBy: user.name,
            ipAddress,
            userAgent,
            metadata: { newStatus: result.status }
        });

        res.json({ message: 'Invoice restored successfully', invoice: result });
    } catch (error: any) {
        if (error.message === 'INVOICE_NOT_FOUND') return res.status(404).json({ error: 'Invoice not found' });
        if (error.message === 'INVOICE_NOT_CANCELLED') return res.status(400).json({ error: 'Invoice is not cancelled' });

        res.status(500).json({ error: 'Failed to restore invoice', message: error.message });
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
            invoice = await prisma.aRInvoice.findFirst({
                where: { invoiceNumber: id },
                orderBy: { invoiceType: 'desc' },
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
            invoice = await prisma.aRInvoice.findFirst({
                where: { invoiceNumber: id },
                orderBy: { invoiceType: 'desc' },
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
            description: `Remark added`,
            fieldName: 'Remark',
            newValue: `"${content.trim().substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
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

// Update invoice remark
export const updateInvoiceRemark = async (req: Request, res: Response) => {
    try {
        const { id, remarkId } = req.params;
        const { content } = req.body;
        const userId = (req as any).user?.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const existingRemark = await prisma.aRInvoiceRemark.findUnique({ where: { id: remarkId } });
        if (!existingRemark) {
            return res.status(404).json({ error: 'Remark not found' });
        }

        const remark = await prisma.aRInvoiceRemark.update({
            where: { id: remarkId },
            data: { content: content.trim() },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        // Log remark activity
        await logInvoiceActivity({
            invoiceId: id,
            action: 'REMARK_UPDATED',
            description: `Remark updated`,
            fieldName: 'Remark',
            oldValue: `"${existingRemark.content.substring(0, 50)}${existingRemark.content.length > 50 ? '...' : ''}"`,
            newValue: `"${content.trim().substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            performedById: userId,
            performedBy: remark.createdBy?.name || null,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null
        });

        res.json(remark);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Remark not found' });
        }
        res.status(500).json({ error: 'Failed to update remark', message: error.message });
    }
};

// Delete invoice remark
export const deleteInvoiceRemark = async (req: Request, res: Response) => {
    try {
        const { id, remarkId } = req.params;
        const userId = (req as any).user?.id;

        const remark = await prisma.aRInvoiceRemark.delete({
            where: { id: remarkId },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        // Log remark activity
        await logInvoiceActivity({
            invoiceId: id,
            action: 'REMARK_DELETED',
            description: `Remark deleted`,
            fieldName: 'Remark',
            oldValue: `"${remark.content.substring(0, 50)}${remark.content.length > 50 ? '...' : ''}"`,
            newValue: 'Deleted',
            performedById: userId,
            performedBy: remark.createdBy?.name || null,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null
        });

        res.json({ message: 'Remark deleted successfully' });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Remark not found' });
        }
        res.status(500).json({ error: 'Failed to delete remark', message: error.message });
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
            invoice = await prisma.aRInvoice.findFirst({
                where: { invoiceNumber: id },
                orderBy: { invoiceType: 'desc' },
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
// MILESTONE INVOICE LINKING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get matching milestone invoices for a regular invoice based on PO number
export const getMatchingMilestones = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get the regular invoice
        const invoice = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { id: true, poNo: true, invoiceNumber: true, invoiceType: true, linkedMilestoneId: true }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Build OR conditions for matching
        const orConditions: any[] = [];

        // Invoice Number-based matching (Strict matching)
        if (invoice.invoiceNumber) {
            orConditions.push({ invoiceNumber: invoice.invoiceNumber });
        }

        if (orConditions.length === 0) {
            return res.json({ milestones: [], message: 'No Invoice Number to match' });
        }

        // Find milestone invoices with matching PO number or Invoice Number
        const matchingMilestones = await prisma.aRInvoice.findMany({
            where: {
                invoiceType: 'MILESTONE',
                OR: orConditions
                // Note: linkedInvoiceId and milestoneStatus filters removed for flexibility
                // The UI will handle showing only relevant milestones
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
                milestoneStatus: true,
                customerName: true,
                bpCode: true,
                invoiceDate: true,
                status: true,
                linkedInvoiceId: true
            },
            orderBy: { invoiceDate: 'desc' }
        });

        // For each milestone, get payment history and check for already-transferred payments
        const milestonesWithPayments = await Promise.all(
            matchingMilestones.map(async (milestone) => {
                const payments = await prisma.aRPaymentHistory.findMany({
                    where: { invoiceId: milestone.id },
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

                // If this milestone is linked to the current invoice, check for already transferred payments
                let transferredPaymentIds: string[] = [];
                let untransferredPayments = 0;
                let untransferredAmount = 0;

                if (milestone.linkedInvoiceId === id) {
                    // Find payments on the regular invoice that came from this milestone
                    const transferredPayments = await prisma.aRPaymentHistory.findMany({
                        where: {
                            invoiceId: id,
                            notes: { contains: `[From Milestone ${milestone.invoiceNumber}]` }
                        },
                        select: { amount: true, paymentDate: true }
                    });

                    // Calculate total transferred amount
                    const totalTransferred = transferredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                    const totalOnMilestone = payments.reduce((sum, p) => sum + Number(p.amount), 0);

                    // Check if there are new payments (more on milestone than transferred)
                    if (totalOnMilestone > totalTransferred) {
                        untransferredAmount = totalOnMilestone - totalTransferred;
                        // Estimate count by comparing totals (rough estimate)
                        untransferredPayments = payments.length - transferredPayments.length;
                        if (untransferredPayments < 0) untransferredPayments = 1;
                    }
                }

                return {
                    ...milestone,
                    payments,
                    totalPayments: payments.reduce((sum, p) => sum + Number(p.amount), 0),
                    untransferredPayments,
                    untransferredAmount
                };
            })
        );

        res.json({
            milestones: milestonesWithPayments,
            hasLinkedMilestone: !!invoice.linkedMilestoneId,
            invoicePoNo: invoice.poNo
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch matching milestones', message: error.message });
    }
};

// Accept and link a milestone invoice to a regular invoice
export const acceptMilestone = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { milestoneId, transferPayments = true } = req.body;

        if (!milestoneId) {
            return res.status(400).json({ error: 'Milestone invoice ID is required' });
        }

        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const result = await prisma.$transaction(async (tx) => {
            const [regularInvoice, milestoneInvoice] = await Promise.all([
                tx.aRInvoice.findUnique({ where: { id } }),
                tx.aRInvoice.findUnique({ where: { id: milestoneId } })
            ]);

            if (!regularInvoice) throw new Error('Regular invoice not found');
            // Allow null or REGULAR invoiceType (older imports may have null)
            if (regularInvoice.invoiceType === 'MILESTONE') throw new Error('Target cannot be a MILESTONE invoice');
            if (!milestoneInvoice) throw new Error('Milestone invoice not found');
            if (milestoneInvoice.invoiceType !== 'MILESTONE') throw new Error('Source must be a MILESTONE invoice');

            // Allow linking ONLY when invoice numbers match exactly
            const invoiceNumbersMatch = regularInvoice.invoiceNumber && milestoneInvoice.invoiceNumber
                && regularInvoice.invoiceNumber === milestoneInvoice.invoiceNumber;

            if (!invoiceNumbersMatch) {
                throw new Error(`Invoice numbers do not match: ${regularInvoice.invoiceNumber} vs ${milestoneInvoice.invoiceNumber}`);
            }

            // Check if this is a re-link (already linked before)
            const isReLink = milestoneInvoice.linkedInvoiceId === id;

            const now = new Date();
            // Update milestone invoice (only if not already linked)
            if (!isReLink) {
                await tx.aRInvoice.update({
                    where: { id: milestoneId },
                    data: { linkedInvoiceId: id, milestoneStatus: 'LINKED', milestoneAcceptedAt: now }
                });

                await tx.aRInvoice.update({
                    where: { id },
                    data: { linkedMilestoneId: milestoneId }
                });
            }

            let totalTransferred = 0;

            if (transferPayments) {
                // Get all milestone payments ordered by creation to ensure logical transfer
                const milestonePayments = await tx.aRPaymentHistory.findMany({
                    where: { invoiceId: milestoneId },
                    orderBy: { createdAt: 'asc' }
                });

                // Get already transferred payments to avoid duplicates
                const alreadyTransferred = await tx.aRPaymentHistory.findMany({
                    where: {
                        invoiceId: id,
                        notes: { contains: `[From Milestone ${milestoneInvoice.invoiceNumber}]` }
                    },
                    orderBy: { createdAt: 'asc' },
                    select: { amount: true, paymentDate: true }
                });

                // Calculate already transferred total
                const alreadyTransferredTotal = alreadyTransferred.reduce((sum, p) => sum + Number(p.amount), 0);

                // Track running total to find which payments are new
                let runningTotal = 0;

                for (const payment of milestonePayments) {
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
                            referenceBank: payment.referenceBank,
                            notes: `[From Milestone ${milestoneInvoice.invoiceNumber}] ${payment.notes || ''}`.trim(),
                            recordedBy: user.name || 'System'
                        }
                    });
                    totalTransferred += Number(payment.amount);
                }

                // Support transferring imported milestone receipts when no payment history records exist
                if (milestonePayments.length === 0 && Number(milestoneInvoice.receipts || 0) > 0) {
                    const importedReceipts = Number(milestoneInvoice.receipts || 0);
                    if (alreadyTransferredTotal < importedReceipts) {
                        const amountToTransfer = importedReceipts - alreadyTransferredTotal;
                        await tx.aRPaymentHistory.create({
                            data: {
                                invoiceId: id,
                                amount: amountToTransfer,
                                paymentDate: invoiceNumbersMatch && milestoneInvoice.invoiceDate ? new Date(milestoneInvoice.invoiceDate) : new Date(),
                                paymentMode: 'ADJUSTMENT',
                                notes: `[From Milestone ${milestoneInvoice.invoiceNumber}] Imported Receipts Transfer`,
                                recordedBy: 'System'
                            }
                        });
                        totalTransferred += amountToTransfer;
                    }
                }

                // Recalculate invoice totals from ALL payment history (not stale stored values)
                const allInvoicePayments = await tx.aRPaymentHistory.findMany({
                    where: { invoiceId: id }
                });

                let newReceipts = 0;
                let newAdjustments = 0;
                allInvoicePayments.forEach((p: any) => {
                    const amt = Number(p.amount);
                    if (p.paymentMode === 'ADJUSTMENT' || p.paymentMode === 'CREDIT_NOTE') {
                        newAdjustments += amt;
                    } else {
                        newReceipts += amt;
                    }
                });

                const newTotalReceipts = newReceipts + newAdjustments;
                const newBalance = Number(regularInvoice.totalAmount) - newTotalReceipts;

                let newStatus: ARInvoiceStatus = regularInvoice.status;
                if (regularInvoice.status !== 'CANCELLED') {
                    if (newBalance <= 0 && newTotalReceipts > 0) newStatus = 'PAID';
                    else if (newTotalReceipts > 0) newStatus = 'PARTIAL';
                    else newStatus = 'PENDING';
                }

                await tx.aRInvoice.update({
                    where: { id },
                    data: { receipts: newReceipts, adjustments: newAdjustments, totalReceipts: newTotalReceipts, balance: newBalance, status: newStatus }
                });

                return { success: true, milestoneInvoiceNumber: milestoneInvoice.invoiceNumber, totalTransferred, newBalance, newStatus };
            }

            return { success: true, milestoneInvoiceNumber: milestoneInvoice.invoiceNumber, totalTransferred: 0 };
        });

        await Promise.all([
            logInvoiceActivity({
                invoiceId: id,
                action: 'MILESTONE_LINKED',
                description: `Milestone ${result.milestoneInvoiceNumber} linked. Transferred: ₹${result.totalTransferred.toLocaleString()}`,
                performedById: user.id,
                performedBy: user.name,
                ipAddress,
                userAgent,
                metadata: { milestoneId, totalTransferred: result.totalTransferred }
            }),
            logInvoiceActivity({
                invoiceId: milestoneId,
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
        res.status(500).json({ error: error.message || 'Failed to link milestone invoice' });
    }
};

// Get linked milestone details for an invoice
export const getLinkedMilestoneDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const invoice = await prisma.aRInvoice.findUnique({
            where: { id },
            select: { linkedMilestoneId: true }
        });

        if (!invoice || !invoice.linkedMilestoneId) {
            return res.json({ linkedMilestone: null });
        }

        const linkedMilestone = await prisma.aRInvoice.findUnique({
            where: { id: invoice.linkedMilestoneId },
            select: {
                id: true,
                invoiceNumber: true,
                soNo: true,
                poNo: true,
                totalAmount: true,
                totalReceipts: true,
                advanceReceivedDate: true,
                milestoneStatus: true,
                milestoneAcceptedAt: true,
                customerName: true
            }
        });

        const transferredPayments = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: id, notes: { contains: 'From Milestone' } },
            select: { id: true, amount: true, paymentDate: true, paymentMode: true, referenceNo: true, notes: true }
        });

        res.json({
            linkedMilestone,
            transferredPayments,
            totalTransferred: transferredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch linked milestone details', message: error.message });
    }
};
