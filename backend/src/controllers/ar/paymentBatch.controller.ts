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
            if (!item.bankAccountId || !item.vendorName || !item.accountNumber || !item.ifscCode || !item.bankName) {
                return res.status(400).json({ error: `Item ${i + 1}: Missing required fields (bankAccountId, vendorName, accountNumber, ifscCode, bankName)` });
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
                        bankAccountId: item.bankAccountId,
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
                    subject: `[Action Required] Payment Batch ${batchNumber} Submitted for Approval`,
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
        const [pending, approved, partiallyApproved, rejected, downloaded] = await Promise.all([
            prisma.paymentBatch.count({ where: { status: 'PENDING' } }),
            prisma.paymentBatch.count({ where: { status: 'APPROVED' } }),
            prisma.paymentBatch.count({ where: { status: 'PARTIALLY_APPROVED' } }),
            prisma.paymentBatch.count({ where: { status: 'REJECTED' } }),
            prisma.paymentBatch.count({ where: { status: 'DOWNLOADED' } }),
        ]);

        res.json({
            pending,
            approved,
            partiallyApproved,
            rejected,
            downloaded,
            total: pending + approved + partiallyApproved + rejected + downloaded
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

        res.json(batch);
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
            let batchStatus: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
            if (approvedItems.length === 0) {
                batchStatus = 'REJECTED';
            } else if (rejectedItems.length === 0) {
                batchStatus = 'APPROVED';
            } else {
                batchStatus = 'PARTIALLY_APPROVED';
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
            message: `Batch reviewed: ${result.approvedItems}/${result.totalItems} items approved`,
            batch: result
        });

        // ── Email: Notify the requester about the review outcome (fire-and-forget) ──
        prisma.user.findUnique({
            where: { id: result.requestedById },
            select: { email: true, name: true }
        }).then(async (requester) => {
            if (!requester?.email) return;
            const isApproved = result.status === 'APPROVED';
            const isPartial = result.status === 'PARTIALLY_APPROVED';
            const isRejected = result.status === 'REJECTED';
            await sendEmail({
                to: requester.email,
                subject: `Payment Batch ${result.batchNumber} Review Complete`,
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

        if (!['APPROVED', 'PARTIALLY_APPROVED', 'DOWNLOADED'].includes(batch.status)) {
            return res.status(400).json({ error: 'Batch has no approved items to download' });
        }

        // Mark as downloaded
        await prisma.paymentBatch.update({
            where: { id },
            data: { downloadedAt: new Date(), status: 'DOWNLOADED' }
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
