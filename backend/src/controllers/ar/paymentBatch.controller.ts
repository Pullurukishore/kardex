import { Request, Response } from 'express';
import prisma from '../../config/db';
import { sendEmail } from '../../utils/email';
import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT BATCH OPERATIONS
// FINANCE_USER submits payment batches
// FINANCE_ADMIN approves/rejects individual items
// ═══════════════════════════════════════════════════════════════════════════

// Generate next batch number: PB-YYYY-NNN
const generateBatchNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `PB-${year}-`;

    const lastBatch = await prisma.paymentBatch.findFirst({
        where: { batchNumber: { startsWith: prefix } },
        orderBy: { batchNumber: 'desc' },
        select: { batchNumber: true }
    });

    let nextNum = 1;
    if (lastBatch) {
        const lastNum = parseInt(lastBatch.batchNumber.replace(prefix, ''), 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }

    return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

// ───────────────────────────────────────────────────────────────────────────
// POST /payment-batches — Submit a payment batch (FINANCE_USER+)
// ───────────────────────────────────────────────────────────────────────────
export const submitBatch = async (req: Request, res: Response) => {
    try {
        const { items, exportFormat, currency, notes } = req.body;
        const userId = (req as any).user?.id || 1;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'At least one payment item is required' });
        }

        // Validate each item
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.vendorName || !item.accountNumber || !item.ifscCode || !item.bankName) {
                return res.status(400).json({ error: `Item ${i + 1}: Missing required fields (vendorName, accountNumber, ifscCode, bankName)` });
            }
            if (!item.amount || parseFloat(item.amount) <= 0) {
                return res.status(400).json({ error: `Item ${i + 1}: Invalid amount` });
            }
            if (!item.transactionMode) {
                return res.status(400).json({ error: `Item ${i + 1}: Transaction mode is required` });
            }
        }

        const batchNumber = await generateBatchNumber();
        const totalAmount = items.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);

        const batch = await prisma.paymentBatch.create({
            data: {
                batchNumber,
                currency: currency || 'INR',
                exportFormat: exportFormat || null,
                totalAmount: new Decimal(totalAmount),
                totalItems: items.length,
                notes: notes || null,
                requestedById: userId,
                items: {
                    create: items.map((item: any) => ({
                        bankAccountId: item.bankAccountId || null,
                        isManual: item.isManual === true || !item.bankAccountId,
                        vendorName: item.vendorName,
                        accountNumber: item.accountNumber,
                        ifscCode: item.ifscCode,
                        bankName: item.bankName,
                        bpCode: item.bpCode || null,
                        emailId: item.emailId || null,
                        accountType: item.accountType || null,
                        amount: new Decimal(parseFloat(item.amount)),
                        transactionMode: item.transactionMode,
                        valueDate: new Date(item.valueDate || new Date()),
                    }))
                }
            },
            include: {
                items: true,
                requestedBy: { select: { id: true, name: true, email: true } }
            }
        });

        res.status(201).json({
            message: 'Payment batch submitted for approval',
            batch
        });

        // ── Email: Notify FINANCE_ADMINs and FINANCE_APPROVERs (fire-and-forget) ──
        prisma.user.findMany({
            where: {
                financeRole: { in: ['FINANCE_ADMIN', 'FINANCE_APPROVER'] },
                isActive: true
            },
            select: { email: true, name: true }
        }).then(async (approvers) => {
            for (const approver of approvers) {
                await sendEmail({
                    to: approver.email,
                    subject: `Kardex: Batch ${batchNumber} Submitted for Review`,
                    template: 'payment-batch-submitted',
                    context: {
                        approverName: approver.name || 'Admin',
                        batchNumber,
                        totalItems: items.length,
                        totalAmount: totalAmount.toFixed(2),
                        currency: currency || 'INR',
                        submittedBy: batch.requestedBy?.name || 'Unknown',
                        submittedByEmail: batch.requestedBy?.email || '',
                        submittedAt: new Date().toLocaleString('en-IN'),
                        actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/finance/bank-accounts/payment-batches/${batch.id}`,
                        items: items.slice(0, 10).map(item => ({
                            vendorName: item.vendorName,
                            amount: parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                            bankName: item.bankName,
                            accountNumber: item.accountNumber,
                            ifscCode: item.ifscCode,
                            bpCode: item.bpCode,
                            transactionMode: item.transactionMode
                        })),
                        hasMoreItems: items.length > 10,
                        currentYear: new Date().getFullYear()
                    }
                });
            }
        }).catch((emailError: any) => {
            console.error('[Email] Failed to send payment batch submission notification:', emailError);
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to submit payment batch', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /payment-batches/pending — List pending batches (FINANCE_ADMIN)
// ───────────────────────────────────────────────────────────────────────────
export const getPendingBatches = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        const where: any = {};
        const statusFilter = Array.isArray(status) ? status[0] : status;

        if (!statusFilter) {
            where.status = 'PENDING';
        } else if (statusFilter !== 'ALL') {
            where.status = statusFilter;
        }

        const batches = await prisma.paymentBatch.findMany({
            where,
            orderBy: { requestedAt: 'desc' },
            include: {
                items: {
                    select: { id: true, vendorName: true, amount: true, status: true }
                },
                requestedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } }
            }
        });

        res.json(batches);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch pending batches', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /payment-batches — List user's own batches (FINANCE_USER+)
// ───────────────────────────────────────────────────────────────────────────
export const getMyBatches = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || 1;

        const batches = await prisma.paymentBatch.findMany({
            where: { requestedById: userId },
            orderBy: { requestedAt: 'desc' },
            include: {
                items: {
                    select: { id: true, vendorName: true, amount: true, status: true }
                },
                reviewedBy: { select: { id: true, name: true, email: true } }
            }
        });

        res.json(batches);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch batches', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /payment-batches/stats — Batch statistics
// ───────────────────────────────────────────────────────────────────────────
export const getBatchStats = async (req: Request, res: Response) => {
    try {
        const [pending, approved, rejected] = await Promise.all([
            prisma.paymentBatch.count({ where: { status: 'PENDING' } }),
            prisma.paymentBatch.count({ where: { status: 'APPROVED' } }),
            prisma.paymentBatch.count({ where: { status: 'REJECTED' } }),
        ]);

        res.json({
            pending,
            approved,
            rejected,
            total: pending + approved + rejected
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch batch stats', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /payment-batches/:id — Single batch with all items
// ───────────────────────────────────────────────────────────────────────────
export const getBatchById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const batch = await prisma.paymentBatch.findUnique({
            where: { id },
            include: {
                items: { orderBy: { vendorName: 'asc' } },
                requestedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } }
            }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        // Lookup nickNames from bank accounts for each item
        const bankAccountIds = [...new Set(batch.items.map(i => i.bankAccountId).filter((id): id is string => Boolean(id)))];
        const bankAccounts = await prisma.bankAccount.findMany({
            where: { id: { in: bankAccountIds } },
            select: { id: true, nickName: true }
        });
        const nickNameMap = new Map(bankAccounts.map(ba => [ba.id, ba.nickName]));

        const batchWithNickNames = {
            ...batch,
            items: batch.items.map(item => ({
                ...item,
                nickName: item.bankAccountId ? (nickNameMap.get(item.bankAccountId) || '') : ''
            }))
        };

        res.json(batchWithNickNames);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch batch', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// PUT /payment-batches/:id/review — Review batch (FINANCE_ADMIN)
// Accepts per-item decisions: { items: [{ id, status, rejectReason }], reviewNotes }
// ───────────────────────────────────────────────────────────────────────────
export const reviewBatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { items: itemDecisions, reviewNotes } = req.body;
        const userId = (req as any).user?.id || 1;

        if (!itemDecisions || !Array.isArray(itemDecisions) || itemDecisions.length === 0) {
            return res.status(400).json({ error: 'Item decisions are required' });
        }

        const batch = await prisma.paymentBatch.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        if (batch.status !== 'PENDING') {
            return res.status(400).json({ error: 'Batch has already been reviewed' });
        }

        // Validate decisions match batch items
        const batchItemIds = new Set(batch.items.map(i => i.id));
        for (const decision of itemDecisions) {
            if (!batchItemIds.has(decision.id)) {
                return res.status(400).json({ error: `Item ${decision.id} does not belong to this batch` });
            }
            if (!['APPROVED', 'REJECTED'].includes(decision.status)) {
                return res.status(400).json({ error: `Invalid status for item ${decision.id}. Must be APPROVED or REJECTED` });
            }
            if (decision.status === 'REJECTED' && !decision.rejectReason) {
                return res.status(400).json({ error: `Reject reason is required for item ${decision.id}` });
            }
        }

        // Apply decisions in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update each item
            for (const decision of itemDecisions) {
                await tx.paymentBatchItem.update({
                    where: { id: decision.id },
                    data: {
                        status: decision.status,
                        rejectReason: decision.status === 'REJECTED' ? decision.rejectReason : null
                    }
                });
            }

            // Re-fetch items to calculate totals
            const updatedItems = await tx.paymentBatchItem.findMany({
                where: { batchId: id }
            });

            const approvedItems = updatedItems.filter(i => i.status === 'APPROVED');
            const rejectedItems = updatedItems.filter(i => i.status === 'REJECTED');
            const approvedAmount = approvedItems.reduce(
                (sum, i) => sum.add(i.amount), new Decimal(0)
            );

            // Determine batch status
            let batchStatus: any;
            if (approvedItems.length === 0) {
                batchStatus = 'REJECTED';
            } else if (rejectedItems.length === 0) {
                batchStatus = 'APPROVED';
            } else {
                batchStatus = 'PARTIALLY_APPROVED' as any;
            }

            // Update batch
            const updatedBatch = await tx.paymentBatch.update({
                where: { id },
                data: {
                    status: batchStatus,
                    approvedAmount,
                    approvedItems: approvedItems.length,
                    reviewedById: userId,
                    reviewedAt: new Date(),
                    reviewNotes: reviewNotes || null
                } as any,
                include: {
                    items: { orderBy: { vendorName: 'asc' } },
                    requestedBy: { select: { id: true, name: true, email: true } },
                    reviewedBy: { select: { id: true, name: true, email: true } }
                }
            });

            return updatedBatch;
        });

        res.json({
            message: `Batch reviewed: ${result.approvedItems}/${result.totalItems} items approved`,
            batch: result
        });

        // ── Email: Notify the requester about the review outcome (fire-and-forget) ──
        prisma.user.findUnique({
            where: { id: result.requestedById },
            select: { email: true, name: true }
        }).then(async (requester) => {
            if (!requester?.email) return;
            const isApproved = result.status === 'APPROVED' && result.approvedItems === result.totalItems;
            const isPartial = result.status === 'APPROVED' && result.approvedItems! < result.totalItems;
            const isRejected = result.status === 'REJECTED';
            await sendEmail({
                to: requester.email,
                subject: `Kardex: Batch ${result.batchNumber} Review Complete`,
                template: 'payment-batch-reviewed',
                context: {
                    requesterName: requester.name || 'User',
                    batchNumber: result.batchNumber,
                    batchStatus: result.status,
                    approvedItems: result.approvedItems,
                    totalItems: result.totalItems,
                    approvedAmount: result.approvedAmount?.toString() || '0',
                    currency: result.currency,
                    reviewNotes: result.reviewNotes || '',
                    isApproved,
                    isPartial,
                    isRejected,
                    currentYear: new Date().getFullYear()
                }
            });
        }).catch((emailError: any) => {
            console.error('[Email] Failed to send payment batch review notification:', emailError);
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to review batch', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// GET /payment-batches/:id/download — Get approved items for download
// ───────────────────────────────────────────────────────────────────────────
export const downloadBatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const batch = await prisma.paymentBatch.findUnique({
            where: { id },
            include: {
                items: {
                    where: { status: 'APPROVED' },
                    orderBy: { vendorName: 'asc' }
                }
            }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        if (batch.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Batch has no approved items to download' });
        }

        // Lookup nickNames from bank accounts for each item
        const bankAccountIds = [...new Set(batch.items.map(i => i.bankAccountId).filter((id): id is string => Boolean(id)))];
        const bankAccounts = await prisma.bankAccount.findMany({
            where: { id: { in: bankAccountIds } },
            select: { id: true, nickName: true }
        });
        const nickNameMap = new Map(bankAccounts.map(ba => [ba.id, ba.nickName]));

        // Mark as downloaded (keep status as APPROVED)
        await prisma.paymentBatch.update({
            where: { id },
            data: { downloadedAt: new Date() }
        });

        res.json({
            batchNumber: batch.batchNumber,
            exportFormat: batch.exportFormat,
            currency: batch.currency,
            approvedItems: batch.items.map(item => ({
                vendorName: item.vendorName,
                accountNumber: item.accountNumber,
                ifscCode: item.ifscCode,
                bankName: item.bankName,
                bpCode: item.bpCode,
                nickName: item.bankAccountId ? (nickNameMap.get(item.bankAccountId) || '') : '',
                emailId: item.emailId,
                accountType: item.accountType,
                amount: item.amount,
                transactionMode: item.transactionMode,
                valueDate: item.valueDate,
            }))
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to download batch', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// PUT /payment-batches/:id/resubmit — Re-request rejected items (FINANCE_USER)
// Resets all REJECTED items back to PENDING and puts batch back in queue
// ───────────────────────────────────────────────────────────────────────────
export const resubmitRejectedItems = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 1;

        const batch = await prisma.paymentBatch.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        if (!['PARTIALLY_APPROVED', 'REJECTED'].includes(batch.status)) {
            return res.status(400).json({ error: 'Only partially approved or rejected batches can be re-submitted' });
        }

        // Ensure the requester is the one who originally submitted
        if (batch.requestedById !== userId) {
            return res.status(403).json({ error: 'Only the original requester can re-submit rejected items' });
        }

        const rejectedItems = batch.items.filter(i => i.status === 'REJECTED');
        const { items: updatedItemsData } = req.body;

        // Reset rejected items to PENDING in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update items if data provided
            if (updatedItemsData && Array.isArray(updatedItemsData)) {
                for (const updatedItem of updatedItemsData) {
                    const existingItem = batch.items.find(i => i.id === updatedItem.id);
                    if (!existingItem) {
                        throw new Error(`Item ${updatedItem.id} does not belong to this batch`);
                    }

                    await tx.paymentBatchItem.update({
                        where: { id: updatedItem.id },
                        data: {
                            amount: updatedItem.amount !== undefined ? new Decimal(updatedItem.amount) : existingItem.amount,
                            valueDate: updatedItem.valueDate ? new Date(updatedItem.valueDate) : existingItem.valueDate,
                            transactionMode: updatedItem.transactionMode || existingItem.transactionMode,
                            status: 'PENDING',
                            rejectReason: null
                        }
                    });
                }
            }

            // Also reset any rejected items NOT included in the update list back to PENDING
            const updatedIds = new Set((updatedItemsData || []).map((i: any) => i.id));
            const remainingToReset = rejectedItems.filter(i => !updatedIds.has(i.id));

            if (remainingToReset.length > 0) {
                await tx.paymentBatchItem.updateMany({
                    where: {
                        id: { in: remainingToReset.map(i => i.id) }
                    },
                    data: {
                        status: 'PENDING',
                        rejectReason: null
                    }
                });
            }

            // Reset batch status to PENDING for re-review
            const updatedBatch = await tx.paymentBatch.update({
                where: { id },
                data: {
                    status: 'PENDING',
                    reviewedById: null,
                    reviewedAt: null,
                    reviewNotes: null,
                    // Recalculate approvedAmount and approvedItems will happen on next review
                },
                include: {
                    items: { orderBy: { vendorName: 'asc' } },
                    requestedBy: { select: { id: true, name: true, email: true } },
                    reviewedBy: { select: { id: true, name: true, email: true } }
                }
            });

            return updatedBatch;
        });

        res.json({
            message: `${rejectedItems.length} item(s) re-submitted for approval`,
            batch: result
        });

        // ── Email: Notify approvers about re-submission (fire-and-forget) ──
        prisma.user.findMany({
            where: {
                financeRole: { in: ['FINANCE_ADMIN', 'FINANCE_APPROVER'] },
                isActive: true
            },
            select: { email: true, name: true }
        }).then(async (approvers) => {
            for (const approver of approvers) {
                await sendEmail({
                    to: approver.email,
                    subject: `Kardex: Batch ${result.batchNumber} Re-Submitted`,
                    template: 'payment-batch-submitted',
                    context: {
                        approverName: approver.name || 'Admin',
                        batchNumber: result.batchNumber,
                        totalItems: result.totalItems,
                        totalAmount: result.totalAmount.toString(),
                        currency: result.currency,
                        submittedBy: result.requestedBy?.name || 'Unknown',
                        submittedByEmail: result.requestedBy?.email || '',
                        submittedAt: new Date().toLocaleString('en-IN'),
                        actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/finance/bank-accounts/payment-batches/${result.id}`,
                        items: result.items.slice(0, 10).map(item => ({
                            vendorName: item.vendorName,
                            amount: parseFloat(item.amount.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                            bankName: item.bankName,
                            accountNumber: item.accountNumber,
                            ifscCode: item.ifscCode,
                            bpCode: item.bpCode,
                            transactionMode: item.transactionMode
                        })),
                        hasMoreItems: result.items.length > 10,
                        currentYear: new Date().getFullYear()
                    }
                });
            }
        }).catch((emailError: any) => {
            console.error('[Email] Failed to send re-submission notification:', emailError);
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to re-submit rejected items', message: error.message });
    }
};
// ───────────────────────────────────────────────────────────────────────────
// DELETE /payment-batches/:id/items/:itemId — Remove an item from batch
// ───────────────────────────────────────────────────────────────────────────
export const deleteBatchItem = async (req: Request, res: Response) => {
    try {
        const { id, itemId } = req.params;
        const userId = (req as any).user?.id || 1;

        const batch = await prisma.paymentBatch.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        const userRole = (req as any).user?.financeRole;
        if (userRole === 'FINANCE_ADMIN' || userRole === 'FINANCE_APPROVER') {
            return res.status(403).json({ error: 'Admins and approvers cannot delete items from pending batches. Please reject the item during review instead.' });
        }

        if (batch.requestedById !== userId && userRole !== 'FINANCE_USER') {
            return res.status(403).json({ error: 'Only the original requester or a Finance User can modify this batch' });
        }

        if (!['PENDING', 'PARTIALLY_APPROVED', 'REJECTED'].includes(batch.status)) {
            return res.status(400).json({ error: 'Cannot remove items from an approved batch' });
        }

        const item = batch.items.find(i => i.id === itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found in this batch' });
        }

        await prisma.$transaction(async (tx) => {
            // Delete the item
            await tx.paymentBatchItem.delete({ where: { id: itemId } });

            // Re-fetch remaining items to update totals
            const remainingItems = await tx.paymentBatchItem.findMany({
                where: { batchId: id }
            });

            if (remainingItems.length === 0) {
                // If no items left, delete the batch
                await tx.paymentBatch.delete({ where: { id } });
                return { deletedBatch: true };
            }

            const totalAmount = remainingItems.reduce((sum, i) => sum.add(i.amount), new Decimal(0));
            const approvedItems = remainingItems.filter(i => i.status === 'APPROVED');
            const rejectedItems = remainingItems.filter(i => i.status === 'REJECTED');
            const approvedAmount = approvedItems.reduce((sum, i) => sum.add(i.amount), new Decimal(0));

            // Update status based on remaining items
            let newStatus = batch.status;
            if (approvedItems.length === remainingItems.length) {
                newStatus = 'APPROVED';
            } else if (rejectedItems.length === remainingItems.length) {
                newStatus = 'REJECTED';
            } else if (approvedItems.length > 0) {
                newStatus = 'PARTIALLY_APPROVED';
            }

            await tx.paymentBatch.update({
                where: { id },
                data: {
                    totalItems: remainingItems.length,
                    totalAmount,
                    approvedItems: approvedItems.length,
                    approvedAmount,
                    status: newStatus as any
                }
            });

            return { deletedBatch: false };
        });

        res.json({ message: 'Item removed from batch' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to remove item', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// PUT /payment-batches/:id — Update a pending payment batch (Requester / Admin)
// ───────────────────────────────────────────────────────────────────────────
export const updatePendingBatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 1;
        const userRole = (req as any).user?.financeRole;
        if (userRole === 'FINANCE_ADMIN' || userRole === 'FINANCE_APPROVER') {
            return res.status(403).json({ error: 'Admins and approvers cannot edit pending batches. Only Finance Users can edit before approval.' });
        }

        const batch = await prisma.paymentBatch.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        if (batch.status !== 'PENDING') {
            return res.status(400).json({ error: 'Only pending batches can be edited directly before approval' });
        }

        if (batch.requestedById !== userId && userRole !== 'FINANCE_USER') {
            return res.status(403).json({ error: 'Only the original requester or a Finance User can edit this batch' });
        }

        const { items: updatedItemsData, notes } = req.body;

        const updatedBatch = await prisma.$transaction(async (tx) => {
            // Update items if provided
            if (updatedItemsData && Array.isArray(updatedItemsData)) {
                for (const updatedItem of updatedItemsData) {
                    const existingItem = batch.items.find(i => i.id === updatedItem.id);
                    if (!existingItem) {
                        throw new Error(`Item ${updatedItem.id} does not belong to this batch`);
                    }

                    if (updatedItem.amount !== undefined && parseFloat(updatedItem.amount) <= 0) {
                        throw new Error(`Invalid amount for item ${existingItem.vendorName}`);
                    }

                    await tx.paymentBatchItem.update({
                        where: { id: updatedItem.id },
                        data: {
                            amount: updatedItem.amount !== undefined ? new Decimal(updatedItem.amount) : existingItem.amount,
                            valueDate: updatedItem.valueDate ? new Date(updatedItem.valueDate) : existingItem.valueDate,
                            transactionMode: updatedItem.transactionMode || existingItem.transactionMode,
                            emailId: updatedItem.emailId !== undefined ? updatedItem.emailId : existingItem.emailId,
                            vendorName: updatedItem.vendorName || existingItem.vendorName,
                            accountNumber: updatedItem.accountNumber || existingItem.accountNumber,
                            ifscCode: updatedItem.ifscCode || existingItem.ifscCode,
                            bankName: updatedItem.bankName || existingItem.bankName,
                        }
                    });
                }
            }

            // Re-fetch all items for the batch to recalculate totals
            const currentItems = await tx.paymentBatchItem.findMany({
                where: { batchId: id }
            });

            if (currentItems.length === 0) {
                throw new Error('Batch cannot have 0 items. Please cancel the batch instead.');
            }

            const totalAmount = currentItems.reduce((sum, item) => sum.add(item.amount), new Decimal(0));

            return await tx.paymentBatch.update({
                where: { id },
                data: {
                    totalAmount,
                    totalItems: currentItems.length,
                    notes: notes !== undefined ? notes : batch.notes,
                },
                include: {
                    items: { orderBy: { vendorName: 'asc' } },
                    requestedBy: { select: { id: true, name: true, email: true } },
                    reviewedBy: { select: { id: true, name: true, email: true } }
                }
            });
        });

        res.json({
            message: 'Payment batch updated successfully',
            batch: updatedBatch
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update payment batch', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// DELETE /payment-batches/:id — Cancel & delete an entire pending batch
// ───────────────────────────────────────────────────────────────────────────
export const cancelBatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 1;
        const userRole = (req as any).user?.financeRole;
        if (userRole === 'FINANCE_ADMIN' || userRole === 'FINANCE_APPROVER') {
            return res.status(403).json({ error: 'Admins and approvers cannot cancel pending batches. Only Finance Users can cancel their request.' });
        }

        const batch = await prisma.paymentBatch.findUnique({
            where: { id }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        if (batch.status !== 'PENDING') {
            return res.status(400).json({ error: 'Only pending batches can be cancelled or recalled' });
        }

        if (batch.requestedById !== userId && userRole !== 'FINANCE_USER') {
            return res.status(403).json({ error: 'Only the original requester or a Finance User can cancel this batch' });
        }

        await prisma.paymentBatch.delete({
            where: { id }
        });

        res.json({ message: `Batch ${batch.batchNumber} cancelled successfully` });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to cancel batch', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// POST /payment-batches/:id/items — Add an item to an existing pending batch
// ───────────────────────────────────────────────────────────────────────────
export const addBatchItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 1;
        const userRole = (req as any).user?.financeRole;
        if (userRole === 'FINANCE_ADMIN' || userRole === 'FINANCE_APPROVER') {
            return res.status(403).json({ error: 'Admins and approvers cannot add items to pending batches. Only Finance Users can edit before approval.' });
        }

        const batch = await prisma.paymentBatch.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!batch) {
            return res.status(404).json({ error: 'Payment batch not found' });
        }

        if (batch.status !== 'PENDING') {
            return res.status(400).json({ error: 'Items can only be added to pending batches' });
        }

        if (batch.requestedById !== userId && userRole !== 'FINANCE_USER') {
            return res.status(403).json({ error: 'Only the original requester or a Finance User can modify this batch' });
        }

        const {
            bankAccountId,
            isManual,
            vendorName,
            accountNumber,
            ifscCode,
            bankName,
            bpCode,
            emailId,
            accountType,
            amount,
            transactionMode,
            valueDate
        } = req.body;

        if (!vendorName || !accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({ error: 'Missing required payee fields (vendorName, accountNumber, ifscCode, bankName)' });
        }

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        if (!transactionMode) {
            return res.status(400).json({ error: 'Transaction mode is required' });
        }

        const updatedBatch = await prisma.$transaction(async (tx) => {
            await tx.paymentBatchItem.create({
                data: {
                    batchId: id,
                    bankAccountId: bankAccountId || null,
                    isManual: isManual === true || !bankAccountId,
                    vendorName,
                    accountNumber,
                    ifscCode,
                    bankName,
                    bpCode: bpCode || null,
                    emailId: emailId || null,
                    accountType: accountType || null,
                    amount: new Decimal(parseFloat(amount)),
                    transactionMode,
                    valueDate: new Date(valueDate || new Date()),
                    status: 'PENDING'
                }
            });

            const currentItems = await tx.paymentBatchItem.findMany({
                where: { batchId: id }
            });

            const totalAmount = currentItems.reduce((sum, item) => sum.add(item.amount), new Decimal(0));

            return await tx.paymentBatch.update({
                where: { id },
                data: {
                    totalAmount,
                    totalItems: currentItems.length
                },
                include: {
                    items: { orderBy: { vendorName: 'asc' } },
                    requestedBy: { select: { id: true, name: true, email: true } },
                    reviewedBy: { select: { id: true, name: true, email: true } }
                }
            });
        });

        res.status(201).json({
            message: 'Item added to batch successfully',
            batch: updatedBatch
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to add item to batch', message: error.message });
    }
};
