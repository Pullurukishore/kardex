import { Request, Response } from 'express';
import prisma from '../../config/db';

// ═══════════════════════════════════════════════════════════════════════════
// AR Reports Controller - Full Implementation
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// INVOICE DETAIL REPORT
// Returns all REGULAR invoices with payments, aging, and summary KPIs
// ───────────────────────────────────────────────────────────────────────────
export const getInvoiceDetailReport = async (req: Request, res: Response) => {
    try {
        const {
            status,
            riskClass,
            customer,
            fromDate,
            toDate,
            region,
            type,
            agingBucket,
            search,
            tsp,
            personInCharge,
            forecastDate,
            paymentMode,
            guarantees,
        } = req.query;

        const today = new Date();
        const where: any = { invoiceType: 'REGULAR' };

        if (status) {
            if (status === 'OVERDUE') {
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
            } else if (status === 'PENDING' || status === 'PARTIAL') {
                where.status = String(status);
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
                where.status = String(status);
            }
        }
        if (riskClass) where.riskClass = String(riskClass);
        if (region) where.region = { contains: String(region), mode: 'insensitive' };
        if (type) where.type = String(type);
        if (guarantees) {
            if (guarantees === 'HAS_ABG') where.hasAPG = true;
            else if (guarantees === 'HAS_PBG') where.hasPBG = true;
            else if (guarantees === 'BOTH') {
                where.hasAPG = true;
                where.hasPBG = true;
            } else if (guarantees === 'NONE') {
                where.hasAPG = false;
                where.hasPBG = false;
            }
        }

        // Combined Personnel Filter
        const personnel = personInCharge || tsp;
        if (personnel) {
            const personnelClauses = [
                { personInCharge: String(personnel) },
                { mailToTSP: String(personnel) }
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: personnelClauses }];
                delete where.OR;
            } else {
                where.OR = personnelClauses;
            }
        }

        if (customer) {
            where.OR = [
                { customerName: { contains: String(customer), mode: 'insensitive' } },
                { bpCode: { contains: String(customer), mode: 'insensitive' } },
            ];
        }

        if (search) {
            const searchClauses = [
                { invoiceNumber: { contains: String(search), mode: 'insensitive' as const } },
                { customerName: { contains: String(search), mode: 'insensitive' as const } },
                { bpCode: { contains: String(search), mode: 'insensitive' as const } },
                { poNo: { contains: String(search), mode: 'insensitive' as const } },
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchClauses }];
                delete where.OR;
            } else {
                where.OR = searchClauses;
            }
        }

        if (fromDate || toDate) {
            where.invoiceDate = {};
            if (fromDate) where.invoiceDate.gte = new Date(String(fromDate));
            if (toDate) where.invoiceDate.lte = new Date(String(toDate));
        }

        const invoices = await prisma.aRInvoice.findMany({
            where,
            orderBy: { invoiceDate: 'desc' },
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
                receipts: true,
                adjustments: true,
                totalReceipts: true,
                status: true,
                riskClass: true,
                region: true,
                type: true,
                actualPaymentTerms: true,
                deliveryStatus: true,
                modeOfDelivery: true,
                sentHandoverDate: true,
                impactDate: true,
                comments: true,
                mailToTSP: true,
                hasAPG: true,
                apgDraftDate: true,
                apgDraftNote: true,
                apgDraftSteps: true,
                apgSignedDate: true,
                apgSignedNote: true,
                apgSignedSteps: true,
                hasPBG: true,
                pbgDraftDate: true,
                pbgDraftNote: true,
                pbgDraftSteps: true,
                pbgSignedDate: true,
                pbgSignedNote: true,
                pbgSignedSteps: true,
                createdAt: true,
            }
        });

        // Fetch payment history for all these invoices
        const invoiceIds = invoices.map((inv: any) => inv.id);
        const payments = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: {
                invoiceId: true,
                amount: true,
                paymentMode: true,
                paymentDate: true,
                referenceNo: true,
                referenceBank: true,
            }
        });

        // Group payments by invoiceId
        const paymentMap: Record<string, any[]> = {};
        payments.forEach((p: any) => {
            if (!paymentMap[p.invoiceId]) paymentMap[p.invoiceId] = [];
            paymentMap[p.invoiceId].push(p);
        });

        // Fetch remarks for these invoices
        const remarks = await prisma.aRInvoiceRemark.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, content: true, createdAt: true, createdBy: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        const remarkMap: Record<string, any[]> = {};
        remarks.forEach((r: any) => {
            if (!remarkMap[r.invoiceId]) remarkMap[r.invoiceId] = [];
            remarkMap[r.invoiceId].push(r);
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Build enriched invoice list
        const enrichedInvoices = invoices.map((invoice: any) => {
            const invPayments = paymentMap[invoice.id] || [];
            const invRemarks = remarkMap[invoice.id] || [];

            // Compute accurate totals from actual payments
            let computedReceipts = 0;
            let computedAdjustments = 0;
            invPayments.forEach((p: any) => {
                const amt = Number(p.amount);
                const mode = (p.paymentMode || '').toUpperCase();
                if (mode === 'ADJUSTMENT' || mode === 'CREDIT_NOTE' || mode === 'TDS' || mode === 'LD') {
                    computedAdjustments += amt;
                } else {
                    computedReceipts += amt;
                }
            });
            const computedTotalReceipts = computedReceipts + computedAdjustments;
            const computedBalance = Number(invoice.totalAmount) - computedTotalReceipts;

            // Calculate aging
            let daysOverdue = 0;
            let agingBucketLabel = 'Current';
            if (invoice.dueDate) {
                const dueDate = new Date(invoice.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                daysOverdue = Math.floor((todayStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysOverdue <= 0) agingBucketLabel = 'Current';
                else if (daysOverdue <= 30) agingBucketLabel = '1-30 Days';
                else if (daysOverdue <= 60) agingBucketLabel = '31-60 Days';
                else if (daysOverdue <= 90) agingBucketLabel = '61-90 Days';
                else agingBucketLabel = '90+ Days';
            }

            // Determine accurate status
            let computedStatus = invoice.status;
            if (invoice.status !== 'CANCELLED') {
                if (computedBalance <= 0 && computedTotalReceipts > 0) computedStatus = 'PAID';
                else if (computedTotalReceipts > 0) computedStatus = 'PARTIAL';
                else if (daysOverdue > 0) computedStatus = 'OVERDUE';
            }

            // Collection %
            const totalAmt = Number(invoice.totalAmount) || 1;
            const collectionPercentage = Math.min(100, (computedTotalReceipts / totalAmt) * 100);

            // Payment count & last payment
            const lastPayment = invPayments.length > 0
                ? invPayments.sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0]
                : null;

            return {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                bpCode: invoice.bpCode,
                customerName: invoice.customerName,
                poNo: invoice.poNo,
                totalAmount: Number(invoice.totalAmount),
                netAmount: Number(invoice.netAmount),
                taxAmount: Number(invoice.taxAmount || 0),
                invoiceDate: invoice.invoiceDate,
                dueDate: invoice.dueDate,
                totalReceipts: computedTotalReceipts,
                balance: computedBalance,
                status: computedStatus,
                riskClass: invoice.riskClass,
                region: invoice.region,
                type: invoice.type,
                actualPaymentTerms: invoice.actualPaymentTerms,
                deliveryStatus: invoice.deliveryStatus,
                daysOverdue: Math.max(0, daysOverdue),
                dueByDays: daysOverdue,
                agingBucket: agingBucketLabel,
                collectionPercentage: Math.round(collectionPercentage * 100) / 100,
                paymentCount: invPayments.length,
                lastPaymentDate: lastPayment?.paymentDate || null,
                lastPaymentMode: lastPayment?.paymentMode || null,
                paymentHistory: invPayments.sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
                remarks: invRemarks,
                mailToTSP: invoice.mailToTSP,
                hasAPG: invoice.hasAPG,
                apgDraftDate: invoice.apgDraftDate,
                apgDraftNote: invoice.apgDraftNote,
                apgDraftSteps: invoice.apgDraftSteps,
                apgSignedDate: invoice.apgSignedDate,
                apgSignedNote: invoice.apgSignedNote,
                apgSignedSteps: invoice.apgSignedSteps,
                hasPBG: invoice.hasPBG,
                pbgDraftDate: invoice.pbgDraftDate,
                pbgDraftNote: invoice.pbgDraftNote,
                pbgDraftSteps: invoice.pbgDraftSteps,
                pbgSignedDate: invoice.pbgSignedDate,
                pbgSignedNote: invoice.pbgSignedNote,
                pbgSignedSteps: invoice.pbgSignedSteps,
                createdAt: invoice.createdAt,
            };
        });

        // Apply filters
        let filteredInvoices = enrichedInvoices;

        if (paymentMode) {
            filteredInvoices = filteredInvoices.filter((inv: any) =>
                inv.paymentHistory.some((p: any) => p.paymentMode === paymentMode)
            );
        }

        if (forecastDate) {
            const target = new Date(String(forecastDate));
            target.setHours(23, 59, 59, 999);
            filteredInvoices = filteredInvoices.filter((inv: any) => {
                if (inv.balance > 0 && inv.dueDate && new Date(inv.dueDate) <= target) {
                    inv.forecastAmount = Math.max(0, inv.balance);
                    return true;
                }
                return false;
            });
        }

        // Apply aging bucket filter if specified
        if (agingBucket) {
            const bucket = String(agingBucket);
            filteredInvoices = enrichedInvoices.filter((inv: any) => {
                const days = inv.daysOverdue;
                switch (bucket) {
                    case 'current': return days <= 0;
                    case '1-30': return days >= 1 && days <= 30;
                    case '31-60': return days >= 31 && days <= 60;
                    case '61-90': return days >= 61 && days <= 90;
                    case '90+': return days > 90;
                    default: return true;
                }
            });
        }

        // Summary KPIs
        const summary = {
            totalInvoices: filteredInvoices.length,
            totalAmount: filteredInvoices.reduce((s: number, i: any) => s + i.totalAmount, 0),
            totalCollected: filteredInvoices.reduce((s: number, i: any) => s + i.totalReceipts, 0),
            totalOutstanding: filteredInvoices.reduce((s: number, i: any) => s + (i.forecastAmount !== undefined ? i.forecastAmount : Math.max(0, i.balance)), 0),
            paidCount: filteredInvoices.filter((i: any) => i.status === 'PAID').length,
            partialCount: filteredInvoices.filter((i: any) => i.status === 'PARTIAL').length,
            overdueCount: filteredInvoices.filter((i: any) => i.status === 'OVERDUE').length,
            pendingCount: filteredInvoices.filter((i: any) => i.status === 'PENDING').length,
            collectionRate: filteredInvoices.length > 0
                ? Math.round(
                    (filteredInvoices.reduce((s: number, i: any) => s + i.totalReceipts, 0) /
                        Math.max(1, filteredInvoices.reduce((s: number, i: any) => s + i.totalAmount, 0))) * 10000
                ) / 100
                : 0,
            // Aging distribution
            agingDistribution: {
                current: { count: 0, amount: 0 },
                '1-30': { count: 0, amount: 0 },
                '31-60': { count: 0, amount: 0 },
                '61-90': { count: 0, amount: 0 },
                '90+': { count: 0, amount: 0 },
            },
            // Risk distribution
            riskDistribution: {
                LOW: { count: 0, amount: 0 },
                MEDIUM: { count: 0, amount: 0 },
                HIGH: { count: 0, amount: 0 },
                CRITICAL: { count: 0, amount: 0 },
            },
            // Top customers by outstanding
            topCustomers: [] as any[],
        };

        // Calculate distributions
        filteredInvoices.forEach((inv: any) => {
            // Aging
            const bucket = inv.daysOverdue <= 0 ? 'current'
                : inv.daysOverdue <= 30 ? '1-30'
                    : inv.daysOverdue <= 60 ? '31-60'
                        : inv.daysOverdue <= 90 ? '61-90'
                            : '90+';
            (summary.agingDistribution as any)[bucket].count += 1;
            (summary.agingDistribution as any)[bucket].amount += Math.max(0, inv.balance);

            // Risk
            const risk = inv.riskClass || 'LOW';
            if ((summary.riskDistribution as any)[risk]) {
                (summary.riskDistribution as any)[risk].count += 1;
                (summary.riskDistribution as any)[risk].amount += Math.max(0, inv.balance);
            }
        });

        // Top customers
        const customerAgg: Record<string, { customerName: string; bpCode: string; outstanding: number; count: number }> = {};
        filteredInvoices.forEach((inv: any) => {
            const key = inv.bpCode || inv.customerName;
            if (!customerAgg[key]) customerAgg[key] = { customerName: inv.customerName, bpCode: inv.bpCode, outstanding: 0, count: 0 };
            customerAgg[key].outstanding += Math.max(0, inv.balance);
            customerAgg[key].count += 1;
        });
        summary.topCustomers = Object.values(customerAgg)
            .sort((a, b) => b.outstanding - a.outstanding)
            .slice(0, 10);

        res.json({ data: filteredInvoices, summary });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate invoice detail report', message: error.message });
    }
};

// ───────────────────────────────────────────────────────────────────────────
// MILESTONE DETAIL REPORT
// Returns all MILESTONE invoices with term-level aging and collection analytics
// ───────────────────────────────────────────────────────────────────────────
export const getMilestoneDetailReport = async (req: Request, res: Response) => {
    try {
        const {
            status,
            milestoneStatus,
            accountingStatus,
            customer,
            fromDate,
            toDate,
            type,
            search,
            tsp,
            personInCharge,
            forecastDate,
            paymentMode,
            guarantees,
        } = req.query;

        const where: any = { invoiceType: 'MILESTONE' };
        let filterStatusInMemory: string | null = null;

        if (status) {
            if (['OVERDUE', 'PENDING', 'PARTIAL'].includes(String(status))) {
                where.status = { not: 'CANCELLED' };
                filterStatusInMemory = String(status);
            } else {
                where.status = String(status);
            }
        }
        if (milestoneStatus) where.milestoneStatus = String(milestoneStatus);
        if (accountingStatus) where.accountingStatus = String(accountingStatus);
        if (type) where.type = String(type);
        if (guarantees) {
            if (guarantees === 'HAS_ABG') where.hasAPG = true;
            else if (guarantees === 'HAS_PBG') where.hasPBG = true;
            else if (guarantees === 'BOTH') {
                where.hasAPG = true;
                where.hasPBG = true;
            } else if (guarantees === 'NONE') {
                where.hasAPG = false;
                where.hasPBG = false;
            }
        }

        // Combined Personnel Filter
        const personnel = personInCharge || tsp;
        if (personnel) {
            const personnelClauses = [
                { personInCharge: String(personnel) },
                { mailToTSP: String(personnel) }
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: personnelClauses }];
                delete where.OR;
            } else {
                where.OR = personnelClauses;
            }
        }

        if (customer) {
            where.OR = [
                { customerName: { contains: String(customer), mode: 'insensitive' } },
                { bpCode: { contains: String(customer), mode: 'insensitive' } },
            ];
        }

        if (search) {
            const searchClauses = [
                { invoiceNumber: { contains: String(search), mode: 'insensitive' as const } },
                { customerName: { contains: String(search), mode: 'insensitive' as const } },
                { bpCode: { contains: String(search), mode: 'insensitive' as const } },
                { soNo: { contains: String(search), mode: 'insensitive' as const } },
                { poNo: { contains: String(search), mode: 'insensitive' as const } },
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchClauses }];
                delete where.OR;
            } else {
                where.OR = searchClauses;
            }
        }

        if (fromDate || toDate) {
            where.invoiceDate = {};
            if (fromDate) where.invoiceDate.gte = new Date(String(fromDate));
            if (toDate) where.invoiceDate.lte = new Date(String(toDate));
        }

        const invoices = await prisma.aRInvoice.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                invoiceNumber: true,
                bpCode: true,
                customerName: true,
                poNo: true,
                soNo: true,
                totalAmount: true,
                netAmount: true,
                taxAmount: true,
                invoiceDate: true,
                dueDate: true,
                balance: true,
                totalReceipts: true,
                status: true,
                riskClass: true,
                region: true,
                type: true,
                milestoneStatus: true,
                milestoneTerms: true,
                accountingStatus: true,
                bookingMonth: true,
                mailToTSP: true,
                advanceReceivedDate: true,
                deliveryDueDate: true,
                linkedMilestoneId: true,
                actualPaymentTerms: true,
                hasAPG: true,
                apgDraftDate: true,
                apgDraftNote: true,
                apgDraftSteps: true,
                apgSignedDate: true,
                apgSignedNote: true,
                apgSignedSteps: true,
                hasPBG: true,
                pbgDraftDate: true,
                pbgDraftNote: true,
                pbgDraftSteps: true,
                pbgSignedDate: true,
                pbgSignedNote: true,
                pbgSignedSteps: true,
                createdAt: true,
            }
        });

        // Fetch all payments for these invoices
        const invoiceIds = invoices.map((inv: any) => inv.id);
        const payments = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: {
                invoiceId: true,
                amount: true,
                paymentMode: true,
                paymentDate: true,
                milestoneTerm: true,
            }
        });

        const paymentMap: Record<string, any[]> = {};
        payments.forEach((p: any) => {
            if (!paymentMap[p.invoiceId]) paymentMap[p.invoiceId] = [];
            paymentMap[p.invoiceId].push(p);
        });

        const milestoneRemarks = await prisma.aRInvoiceRemark.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, content: true, createdAt: true, createdBy: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        const milestoneRemarkMap: Record<string, any[]> = {};
        milestoneRemarks.forEach((r: any) => {
            if (!milestoneRemarkMap[r.invoiceId]) milestoneRemarkMap[r.invoiceId] = [];
            milestoneRemarkMap[r.invoiceId].push(r);
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const enrichedMilestones = invoices.map((invoice: any) => {
            const invPayments = paymentMap[invoice.id] || [];
            const invRemarks = milestoneRemarkMap[invoice.id] || [];
            const terms: any[] = invoice.milestoneTerms || [];
            const netAmount = Number(invoice.netAmount || 0);

            // Compute totals
            let computedTotalReceipts = 0;
            invPayments.forEach((p: any) => { computedTotalReceipts += Number(p.amount); });
            const computedBalance = Number(invoice.totalAmount) - computedTotalReceipts;

            // Determine status
            let computedStatus = invoice.status;
            if (invoice.status !== 'CANCELLED') {
                if (computedBalance <= 0 && computedTotalReceipts > 0) computedStatus = 'PAID';
                else if (computedTotalReceipts > 0) computedStatus = 'PARTIAL';
            }

            // Build per-term analysis
            const paymentsByTarget: Record<string, number> = {};
            let genericPool = 0;
            invPayments.forEach((p: any) => {
                if (p.milestoneTerm) {
                    paymentsByTarget[p.milestoneTerm] = (paymentsByTarget[p.milestoneTerm] || 0) + Number(p.amount);
                } else {
                    genericPool += Number(p.amount);
                }
            });

            let maxOverdueDays = 0;
            let overdueTermCount = 0;
            let completedTermCount = 0;
            let totalAllocated = 0;

            const initialTerms = terms.sort((a: any, b: any) =>
                new Date(a.termDate).getTime() - new Date(b.termDate).getTime()
            ).map((term: any) => {
                const pct = term.percentage || 0;
                const taxPct = term.taxPercentage || 0;
                const isNetBasis = term.calculationBasis !== 'TOTAL_AMOUNT';
                const termId = `${term.termType}-${term.termDate}-${pct}-${taxPct}`;

                let allocatedAmount = 0;
                if (isNetBasis) {
                    allocatedAmount = (netAmount * pct) / 100;
                } else {
                    allocatedAmount = (netAmount * pct) / 100 + (Number(invoice.taxAmount || 0) * taxPct) / 100;
                }
                totalAllocated += allocatedAmount;

                let collected = (paymentsByTarget[termId] || 0) + (paymentsByTarget[term.termType] || 0);
                if (paymentsByTarget[termId]) delete paymentsByTarget[termId];
                if (paymentsByTarget[term.termType]) delete paymentsByTarget[term.termType];

                if (collected > allocatedAmount) {
                    genericPool += (collected - allocatedAmount);
                    collected = allocatedAmount;
                }

                return {
                    term,
                    allocatedAmount,
                    collected,
                };
            });

            // Add orphan payments to generic pool
            Object.values(paymentsByTarget).forEach(amt => { genericPool += amt; });

            const termAnalysis = initialTerms.map((t: any) => {
                const { term, allocatedAmount } = t;
                let { collected } = t;

                // Apply generic pool
                const gap = Math.max(0, allocatedAmount - collected);
                const fromGeneric = Math.min(gap, genericPool);
                collected += fromGeneric;
                genericPool -= fromGeneric;

                const pending = Math.max(0, allocatedAmount - collected);
                const isPaid = pending < 0.01;

                const deadlineDate = new Date(term.termDate);
                deadlineDate.setHours(0, 0, 0, 0);
                const aging = Math.floor((today.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = aging > 0 && !isPaid && term.status === 'COMPLETED' && invoice.milestoneStatus !== 'FULLY_DELIVERED' && term.status !== 'CANCELLED';

                if (isOverdue) {
                    overdueTermCount++;
                    maxOverdueDays = Math.max(maxOverdueDays, aging);
                }
                if (isPaid) completedTermCount++;

                return {
                    termType: term.termType,
                    customLabel: term.customLabel,
                    percentage: term.percentage || 0,
                    termDate: term.termDate,
                    allocated: Math.round(allocatedAmount * 100) / 100,
                    collected: Math.round(collected * 100) / 100,
                    pending: Math.round(pending * 100) / 100,
                    collectionPercent: allocatedAmount > 0 ? Math.round((collected / allocatedAmount) * 10000) / 100 : 0,
                    aging,
                    isOverdue,
                    isPaid,
                };
            });

            return {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                bpCode: invoice.bpCode,
                customerName: invoice.customerName,
                poNo: invoice.poNo,
                soNo: invoice.soNo,
                totalAmount: Number(invoice.totalAmount),
                netAmount,
                taxAmount: Number(invoice.taxAmount || 0),
                invoiceDate: invoice.invoiceDate,
                totalReceipts: computedTotalReceipts,
                balance: computedBalance,
                status: computedStatus,
                riskClass: invoice.riskClass,
                region: invoice.region,
                type: invoice.type,
                mailToTSP: invoice.mailToTSP,
                milestoneStatus: invoice.milestoneStatus,
                accountingStatus: invoice.accountingStatus,
                actualPaymentTerms: invoice.actualPaymentTerms,
                bookingMonth: invoice.bookingMonth,
                termCount: terms.length,
                completedTerms: completedTermCount,
                overdueTerms: overdueTermCount,
                maxOverdueDays,
                collectionPercentage: Number(invoice.totalAmount) > 0
                    ? Math.round((computedTotalReceipts / Number(invoice.totalAmount)) * 10000) / 100
                    : 0,
                paymentCount: invPayments.length,
                paymentHistory: invPayments.sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
                remarks: invRemarks,
                milestoneTerms: invoice.milestoneTerms,
                terms: termAnalysis,
                hasAPG: invoice.hasAPG,
                apgDraftDate: invoice.apgDraftDate,
                apgDraftNote: invoice.apgDraftNote,
                apgDraftSteps: invoice.apgDraftSteps,
                apgSignedDate: invoice.apgSignedDate,
                apgSignedNote: invoice.apgSignedNote,
                apgSignedSteps: invoice.apgSignedSteps,
                hasPBG: invoice.hasPBG,
                pbgDraftDate: invoice.pbgDraftDate,
                pbgDraftNote: invoice.pbgDraftNote,
                pbgDraftSteps: invoice.pbgDraftSteps,
                pbgSignedDate: invoice.pbgSignedDate,
                pbgSignedNote: invoice.pbgSignedNote,
                pbgSignedSteps: invoice.pbgSignedSteps,
                createdAt: invoice.createdAt,
            };
        });

        let filteredMilestones = enrichedMilestones;

        if (paymentMode) {
            filteredMilestones = filteredMilestones.filter((ms: any) =>
                ms.paymentHistory.some((p: any) => p.paymentMode === paymentMode)
            );
        }

        if (forecastDate) {
            const target = new Date(String(forecastDate));
            target.setHours(23, 59, 59, 999);
            filteredMilestones = filteredMilestones.filter((ms: any) => {
                if (!ms.balance || ms.balance <= 0) return false;

                let forecastAmount = 0;
                let isMatch = false;
                ms.terms.forEach((t: any) => {
                    if (t.pending > 0.01 && new Date(t.termDate) <= target) {
                        isMatch = true;
                        forecastAmount += t.pending;
                    }
                });

                if (isMatch) {
                    ms.forecastAmount = forecastAmount;
                    return true;
                }
                return false;
            });
        }

        // Summary KPIs
        const summary = {
            totalMilestones: filteredMilestones.length,
            totalAmount: filteredMilestones.reduce((s: number, i: any) => s + i.totalAmount, 0),
            totalCollected: filteredMilestones.reduce((s: number, i: any) => s + i.totalReceipts, 0),
            totalOutstanding: filteredMilestones.reduce((s: number, i: any) => s + (i.forecastAmount !== undefined ? i.forecastAmount : Math.max(0, i.balance)), 0),
            collectionRate: filteredMilestones.length > 0
                ? Math.round(
                    (filteredMilestones.reduce((s: number, i: any) => s + i.totalReceipts, 0) /
                        Math.max(1, filteredMilestones.reduce((s: number, i: any) => s + i.totalAmount, 0))) * 10000
                ) / 100
                : 0,
            // Status breakdown
            statusBreakdown: {
                paid: filteredMilestones.filter((i: any) => i.status === 'PAID').length,
                partial: filteredMilestones.filter((i: any) => i.status === 'PARTIAL').length,
                pending: filteredMilestones.filter((i: any) => i.status === 'PENDING').length,
                overdue: filteredMilestones.filter((i: any) => i.status === 'OVERDUE').length,
            },
            // Milestone status breakdown
            milestoneStatusBreakdown: {
                awaitingDelivery: filteredMilestones.filter((i: any) => i.milestoneStatus === 'AWAITING_DELIVERY').length,
                partiallyDelivered: filteredMilestones.filter((i: any) => i.milestoneStatus === 'PARTIALLY_DELIVERED').length,
                fullyDelivered: filteredMilestones.filter((i: any) => i.milestoneStatus === 'FULLY_DELIVERED').length,
                linked: filteredMilestones.filter((i: any) => i.milestoneStatus === 'LINKED').length,
                expired: filteredMilestones.filter((i: any) => i.milestoneStatus === 'EXPIRED').length,
            },
            // Accounting status
            accountingBreakdown: {
                revenueRecognised: filteredMilestones.filter((i: any) => i.accountingStatus === 'REVENUE_RECOGNISED').length,
                backlog: filteredMilestones.filter((i: any) => i.accountingStatus === 'BACKLOG').length,
            },
            // Term-level stats
            totalTerms: filteredMilestones.reduce((s: number, i: any) => s + i.termCount, 0),
            completedTerms: filteredMilestones.reduce((s: number, i: any) => s + i.completedTerms, 0),
            overdueTerms: filteredMilestones.reduce((s: number, i: any) => s + i.overdueTerms, 0),
            // By type
            typeBreakdown: {} as Record<string, { count: number; amount: number; outstanding: number }>,
            // Top customers
            topCustomers: [] as any[],
        };

        // Type breakdown
        filteredMilestones.forEach((inv: any) => {
            const t = inv.type || 'Other';
            if (!summary.typeBreakdown[t]) summary.typeBreakdown[t] = { count: 0, amount: 0, outstanding: 0 };
            summary.typeBreakdown[t].count += 1;
            summary.typeBreakdown[t].amount += inv.totalAmount;
            summary.typeBreakdown[t].outstanding += Math.max(0, inv.balance);
        });

        // Top customers
        const custAgg: Record<string, { customerName: string; bpCode: string; outstanding: number; count: number }> = {};
        filteredMilestones.forEach((inv: any) => {
            const key = inv.bpCode || inv.customerName;
            if (!custAgg[key]) custAgg[key] = { customerName: inv.customerName, bpCode: inv.bpCode, outstanding: 0, count: 0 };
            custAgg[key].outstanding += Math.max(0, inv.balance);
            custAgg[key].count += 1;
        });
        summary.topCustomers = Object.values(custAgg)
            .sort((a, b) => b.outstanding - a.outstanding)
            .slice(0, 10);

        res.json({ data: filteredMilestones, summary });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate milestone detail report', message: error.message });
    }
};


// ═══════════════════════════════════════════════════════════════════════════
// AGING SUMMARY REPORT
// Shows AR outstanding broken down by aging buckets across all invoices
// ═══════════════════════════════════════════════════════════════════════════
export const getAgingSummary = async (req: Request, res: Response) => {
    try {
        const { type, region } = req.query;
        const where: any = { invoiceType: 'REGULAR' };
        if (type) where.type = String(type);
        if (region) where.region = { contains: String(region), mode: 'insensitive' };

        const invoices = await prisma.aRInvoice.findMany({
            where,
            select: {
                id: true, invoiceNumber: true, bpCode: true, customerName: true,
                totalAmount: true, dueDate: true, status: true, riskClass: true,
                region: true, type: true,
            }
        });

        const invoiceIds = invoices.map((inv: any) => inv.id);
        const payments = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, amount: true, paymentMode: true }
        });

        const payTotals: Record<string, number> = {};
        payments.forEach((p: any) => {
            payTotals[p.invoiceId] = (payTotals[p.invoiceId] || 0) + Number(p.amount);
        });

        const today = new Date(); today.setHours(0, 0, 0, 0);

        const buckets: Record<string, { count: number; amount: number; invoices: any[] }> = {
            current: { count: 0, amount: 0, invoices: [] },
            '1-30': { count: 0, amount: 0, invoices: [] },
            '31-60': { count: 0, amount: 0, invoices: [] },
            '61-90': { count: 0, amount: 0, invoices: [] },
            '90+': { count: 0, amount: 0, invoices: [] },
        };

        // By type breakdown within each bucket
        const byType: Record<string, Record<string, { count: number; amount: number }>> = {};
        // By region breakdown
        const byRegion: Record<string, { count: number; amount: number; outstanding: number }> = {};

        let totalOutstanding = 0;
        let totalInvoiced = 0;
        let totalCollected = 0;

        invoices.forEach((inv: any) => {
            const total = Number(inv.totalAmount);
            const paid = payTotals[inv.id] || 0;
            const balance = Math.max(0, total - paid);
            totalInvoiced += total;
            totalCollected += paid;
            totalOutstanding += balance;

            let daysOverdue = 0;
            if (inv.dueDate) {
                const due = new Date(inv.dueDate); due.setHours(0, 0, 0, 0);
                daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            }

            const bucket = daysOverdue <= 0 ? 'current'
                : daysOverdue <= 30 ? '1-30'
                    : daysOverdue <= 60 ? '31-60'
                        : daysOverdue <= 90 ? '61-90' : '90+';

            buckets[bucket].count++;
            buckets[bucket].amount += balance;
            if (balance > 0) {
                buckets[bucket].invoices.push({
                    invoiceNumber: inv.invoiceNumber, customerName: inv.customerName,
                    bpCode: inv.bpCode, totalAmount: total, balance, daysOverdue: Math.max(0, daysOverdue),
                    type: inv.type, region: inv.region, riskClass: inv.riskClass,
                });
            }

            // By type
            const t = inv.type || 'Other';
            if (!byType[t]) byType[t] = { current: { count: 0, amount: 0 }, '1-30': { count: 0, amount: 0 }, '31-60': { count: 0, amount: 0 }, '61-90': { count: 0, amount: 0 }, '90+': { count: 0, amount: 0 } };
            byType[t][bucket].count++;
            byType[t][bucket].amount += balance;

            // By region
            const r = inv.region || 'Unknown';
            if (!byRegion[r]) byRegion[r] = { count: 0, amount: 0, outstanding: 0 };
            byRegion[r].count++;
            byRegion[r].amount += total;
            byRegion[r].outstanding += balance;
        });

        // Sort invoices within each bucket by balance desc
        Object.values(buckets).forEach(b => b.invoices.sort((a: any, b2: any) => b2.balance - a.balance));

        res.json({
            buckets,
            byType,
            byRegion: Object.entries(byRegion)
                .map(([region, data]) => ({ region, ...data }))
                .sort((a, b) => b.outstanding - a.outstanding),
            summary: {
                totalInvoices: invoices.length,
                totalInvoiced,
                totalCollected,
                totalOutstanding,
                collectionRate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 10000) / 100 : 0,
                weightedAvgDays: totalOutstanding > 0 ? Math.round(
                    invoices.reduce((sum: number, inv: any) => {
                        const paid = payTotals[inv.id] || 0;
                        const balance = Math.max(0, Number(inv.totalAmount) - paid);
                        let days = 0;
                        if (inv.dueDate) { const d = new Date(inv.dueDate); d.setHours(0, 0, 0, 0); days = Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))); }
                        return sum + (balance * days);
                    }, 0) / totalOutstanding
                ) : 0,
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate aging summary', message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION TRENDS REPORT
// Monthly collection trends with invoiced vs collected comparison
// ═══════════════════════════════════════════════════════════════════════════
export const getCollectionTrends = async (req: Request, res: Response) => {
    try {
        const { months = 12, type } = req.query;
        const monthCount = Math.min(24, Number(months) || 12);

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthCount);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const invoiceWhere: any = { invoiceType: 'REGULAR', invoiceDate: { gte: startDate } };
        if (type) invoiceWhere.type = String(type);

        // Get invoices created in the period
        const invoices = await prisma.aRInvoice.findMany({
            where: invoiceWhere,
            select: { id: true, totalAmount: true, invoiceDate: true, type: true }
        });

        // Get all payments in the period
        const allPayments = await prisma.aRPaymentHistory.findMany({
            where: { paymentDate: { gte: startDate } },
            select: { amount: true, paymentDate: true, paymentMode: true }
        });

        // Build monthly aggregation
        const monthlyMap: Record<string, { month: string; invoiced: number; invoiceCount: number; collected: number; paymentCount: number }> = {};

        // Initialize all months
        for (let i = 0; i < monthCount; i++) {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap[key] = { month: key, invoiced: 0, invoiceCount: 0, collected: 0, paymentCount: 0 };
        }

        invoices.forEach((inv: any) => {
            if (!inv.invoiceDate) return;
            const d = new Date(inv.invoiceDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyMap[key]) {
                monthlyMap[key].invoiced += Number(inv.totalAmount);
                monthlyMap[key].invoiceCount++;
            }
        });

        allPayments.forEach((p: any) => {
            const d = new Date(p.paymentDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyMap[key]) {
                monthlyMap[key].collected += Number(p.amount);
                monthlyMap[key].paymentCount++;
            }
        });

        const trends = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

        // Calculate DSO for each month (simplified: outstanding / daily revenue)
        const trendsWithDSO = trends.map(t => ({
            ...t,
            collectionEfficiency: t.invoiced > 0 ? Math.round((t.collected / t.invoiced) * 10000) / 100 : 0,
            netCashflow: t.collected - t.invoiced,
        }));

        const totalInvoiced = trends.reduce((s, t) => s + t.invoiced, 0);
        const totalCollected = trends.reduce((s, t) => s + t.collected, 0);

        res.json({
            trends: trendsWithDSO,
            summary: {
                totalInvoiced,
                totalCollected,
                totalInvoices: trends.reduce((s, t) => s + t.invoiceCount, 0),
                totalPayments: trends.reduce((s, t) => s + t.paymentCount, 0),
                overallEfficiency: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 10000) / 100 : 0,
                avgMonthlyCollection: trends.length > 0 ? Math.round(totalCollected / trends.length) : 0,
                bestMonth: trends.reduce((best, t) => t.collected > best.collected ? t : best, trends[0]),
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate collection trends', message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT MODE ANALYSIS
// Shows payment distribution by mode (NEFT/RTGS/Cheque/Cash) and bank
// ═══════════════════════════════════════════════════════════════════════════
export const getPaymentModeAnalysis = async (req: Request, res: Response) => {
    try {
        const { months = 12 } = req.query;
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - Number(months));

        const payments = await prisma.aRPaymentHistory.findMany({
            where: { paymentDate: { gte: startDate } },
            select: {
                amount: true, paymentMode: true, paymentDate: true,
                referenceBank: true, referenceNo: true,
            }
        });

        // Group by payment mode
        const modeMap: Record<string, { mode: string; count: number; totalAmount: number; avgAmount: number; lastPayment: Date | null }> = {};
        // Group by bank
        const bankMap: Record<string, { bank: string; count: number; totalAmount: number }> = {};
        // Monthly by mode
        const monthlyModes: Record<string, Record<string, number>> = {};

        payments.forEach((p: any) => {
            const amt = Number(p.amount);
            const mode = p.paymentMode || 'OTHER';
            const bank = p.referenceBank || 'Unknown';
            const d = new Date(p.paymentDate);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            // Mode aggregation
            if (!modeMap[mode]) modeMap[mode] = { mode, count: 0, totalAmount: 0, avgAmount: 0, lastPayment: null };
            modeMap[mode].count++;
            modeMap[mode].totalAmount += amt;
            if (!modeMap[mode].lastPayment || d > modeMap[mode].lastPayment!) modeMap[mode].lastPayment = d;

            // Bank aggregation
            if (!bankMap[bank]) bankMap[bank] = { bank, count: 0, totalAmount: 0 };
            bankMap[bank].count++;
            bankMap[bank].totalAmount += amt;

            // Monthly modes
            if (!monthlyModes[monthKey]) monthlyModes[monthKey] = {};
            monthlyModes[monthKey][mode] = (monthlyModes[monthKey][mode] || 0) + amt;
        });

        // Calculate averages
        Object.values(modeMap).forEach(m => { m.avgAmount = m.count > 0 ? Math.round(m.totalAmount / m.count) : 0; });

        const modes = Object.values(modeMap).sort((a, b) => b.totalAmount - a.totalAmount);
        const banks = Object.values(bankMap).sort((a, b) => b.totalAmount - a.totalAmount);
        const totalAmount = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);

        // Add percentage to modes
        const modesWithPct = modes.map(m => ({
            ...m,
            percentage: totalAmount > 0 ? Math.round((m.totalAmount / totalAmount) * 10000) / 100 : 0,
        }));

        const monthlyTrend = Object.entries(monthlyModes)
            .map(([month, modes]) => ({ month, ...modes }))
            .sort((a, b) => a.month.localeCompare(b.month));

        res.json({
            modes: modesWithPct,
            banks,
            monthlyTrend,
            summary: {
                totalPayments: payments.length,
                totalAmount,
                uniqueModes: modes.length,
                uniqueBanks: banks.length,
                avgPaymentSize: payments.length > 0 ? Math.round(totalAmount / payments.length) : 0,
                dominantMode: modes[0]?.mode || 'N/A',
                dominantBank: banks[0]?.bank || 'N/A',
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate payment mode analysis', message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER OUTSTANDING REPORT
// Per-customer outstanding with aging breakdown and collection metrics
// ═══════════════════════════════════════════════════════════════════════════
export const getTopOutstandingCustomers = async (req: Request, res: Response) => {
    try {
        const { limit, type, region, search } = req.query;
        // 1. Get all customers from master list
        const customerWhere: any = {};
        if (region) customerWhere.region = { contains: String(region), mode: 'insensitive' };
        if (search) {
            customerWhere.OR = [
                { customerName: { contains: String(search), mode: 'insensitive' } },
                { bpCode: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const masterCustomers = await prisma.aRCustomer.findMany({
            where: customerWhere,
            select: {
                bpCode: true, customerName: true, region: true, riskClass: true, creditLimit: true
            }
        });

        const totalMasterCount = masterCustomers.length;

        // 2. Build map and where clause for invoices
        const custMap: Record<string, any> = {};
        masterCustomers.forEach(c => {
            custMap[c.bpCode] = {
                bpCode: c.bpCode, customerName: c.customerName, region: c.region,
                riskClass: c.riskClass, creditLimit: Number(c.creditLimit || 0),
                totalInvoiced: 0, totalCollected: 0, outstanding: 0,
                invoiceCount: 0, regularCount: 0, milestoneCount: 0,
                overdueCount: 0, paidCount: 0, maxDaysOverdue: 0,
                lastPaymentDate: null,
                aging: { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
                invoices: [], // NEW: Collect detailed invoices for drill-down
            };
        });

        // Use bpCodes from found customers to restrict invoice search
        const foundBpCodes = masterCustomers.map(c => c.bpCode);
        const invoiceWhere: any = {
            bpCode: { in: foundBpCodes },
            status: { not: 'CANCELLED' },
            invoiceType: 'REGULAR', // EXCLUSIVE: Only regular invoices, no milestones
        };
        if (type) invoiceWhere.type = String(type);

        const invoices = await prisma.aRInvoice.findMany({
            where: invoiceWhere,
            select: {
                id: true, bpCode: true, customerName: true, totalAmount: true,
                invoiceDate: true, dueDate: true, status: true, riskClass: true,
                region: true, type: true, invoiceType: true, creditLimit: true,
                invoiceNumber: true, poNo: true, soNo: true,
            }
        });

        const invoiceIds = invoices.map((inv: any) => inv.id);
        const payments = await prisma.aRPaymentHistory.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, amount: true, paymentDate: true }
        });

        const payTotals: Record<string, number> = {};
        const lastPayDates: Record<string, Date> = {};
        payments.forEach((p: any) => {
            payTotals[p.invoiceId] = (payTotals[p.invoiceId] || 0) + Number(p.amount);
            const d = new Date(p.paymentDate);
            if (!lastPayDates[p.invoiceId] || d > lastPayDates[p.invoiceId]) lastPayDates[p.invoiceId] = d;
        });

        const today = new Date(); today.setHours(0, 0, 0, 0);

        // 3. Process invoices into customer map

        invoices.forEach((inv: any) => {
            const key = inv.bpCode;
            const total = Number(inv.totalAmount);
            const paid = payTotals[inv.id] || 0;
            const balance = Math.max(0, total - paid);
            let daysOverdue = 0;
            if (inv.dueDate) {
                const due = new Date(inv.dueDate); due.setHours(0, 0, 0, 0);
                daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
            }

            // If customer not in master list (e.g. orphan invoice), skip or handle
            if (!custMap[key]) return;

            const c = custMap[key];
            c.totalInvoiced += total;
            c.totalCollected += paid;
            c.outstanding += balance;
            c.invoiceCount++;
            if (inv.invoiceType === 'REGULAR') c.regularCount++;
            else c.milestoneCount++;
            if (balance <= 0 && paid > 0) c.paidCount++;
            if (daysOverdue > 0 && balance > 0) c.overdueCount++;
            c.maxDaysOverdue = Math.max(c.maxDaysOverdue, daysOverdue);

            // Add to detailed invoices list if there is a balance
            if (balance > 0.01) {
                c.invoices.push({
                    id: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    invoiceDate: inv.invoiceDate,
                    dueDate: inv.dueDate,
                    totalAmount: total,
                    balance: balance,
                    status: balance > 0 && daysOverdue > 0 ? 'OVERDUE' : (balance > 0 && paid > 0 ? 'PARTIAL' : 'PENDING'),
                    daysOverdue,
                    poNo: inv.poNo,
                    soNo: inv.soNo,
                    type: inv.type
                });
            }

            // Last payment
            const lpd = lastPayDates[inv.id];
            if (lpd && (!c.lastPaymentDate || lpd > c.lastPaymentDate)) c.lastPaymentDate = lpd;

            // Aging bucket
            if (balance > 0) {
                const bucket = daysOverdue <= 0 ? 'current'
                    : daysOverdue <= 30 ? '1-30'
                        : daysOverdue <= 60 ? '31-60'
                            : daysOverdue <= 90 ? '61-90' : '90+';
                c.aging[bucket] += balance;
            }

            // Upgrade risk class to highest
            const riskOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
            if ((riskOrder[inv.riskClass] || 0) > (riskOrder[c.riskClass] || 0)) c.riskClass = inv.riskClass;
        });

        // Sort each customer's invoice list by date
        Object.values(custMap).forEach((c: any) => {
            c.invoices.sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
        });

        let customers = Object.values(custMap).map((c: any) => ({
            ...c,
            collectionRate: c.totalInvoiced > 0 ? Math.round((c.totalCollected / c.totalInvoiced) * 10000) / 100 : 0,
            creditUtilization: c.creditLimit > 0 ? Math.round((c.outstanding / c.creditLimit) * 10000) / 100 : null,
        }));

        customers.sort((a: any, b: any) => b.outstanding - a.outstanding);

        // Calculate summary from the FULL list before slicing by limit
        const totalOutstanding = customers.reduce((s: number, c: any) => s + c.outstanding, 0);
        const totalInvoiced = customers.reduce((s: number, c: any) => s + c.totalInvoiced, 0);
        const totalCollected = customers.reduce((s: number, c: any) => s + c.totalCollected, 0);
        const top5Concentration = totalOutstanding > 0
            ? Math.round((customers.slice(0, 5).reduce((s: number, c: any) => s + c.outstanding, 0) / totalOutstanding) * 10000) / 100
            : 0;

        // Now apply limit if provided
        if (limit) customers = customers.slice(0, Number(limit));

        res.json({
            customers,
            summary: {
                totalCustomers: totalMasterCount,
                totalOutstanding,
                totalInvoiced,
                totalCollected,
                collectionRate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 10000) / 100 : 0,
                customersWithOverdue: Object.values(custMap).filter((c: any) => c.overdueCount > 0).length,
                top5Concentration,
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate customer outstanding report', message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// Remaining Stubs (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export const getDetailedAgingReport = async (req: Request, res: Response) => {
    res.json({ data: [], summary: {} });
};

export const getCustomerAgingReport = async (req: Request, res: Response) => {
    res.json({ customers: [], summary: {} });
};

export const getRiskAgingReport = async (req: Request, res: Response) => {
    res.json({ risks: [], total: {} });
};

export const getBankwiseCollections = async (req: Request, res: Response) => {
    res.json({ banks: [], total: {} });
};

export const getDSOReport = async (req: Request, res: Response) => {
    res.json({ monthly: [], current: {} });
};

export const getCustomerRiskReport = async (req: Request, res: Response) => {
    res.json({ distribution: [], summary: {} });
};

export const getInvoiceStatusSummary = async (req: Request, res: Response) => {
    res.json({ statuses: [], summary: {} });
};

export const getMilestoneAnalysisReport = async (req: Request, res: Response) => {
    res.json({ byType: [], milestoneStatuses: [], summary: {} });
};

export const getDeliveryStatusReport = async (req: Request, res: Response) => {
    res.json({ statuses: [], summary: {} });
};

export const getAgingReport = async (req: Request, res: Response) => {
    res.json({});
};

export const getCollectionEfficiency = async (req: Request, res: Response) => {
    res.json({});
};

export const getUniqueTSPs = async (req: Request, res: Response) => {
    try {
        const tsps = await prisma.aRInvoice.findMany({
            where: {
                AND: [
                    { mailToTSP: { not: null } },
                    { mailToTSP: { not: '' } }
                ]
            },
            distinct: ['mailToTSP'],
            select: {
                mailToTSP: true
            }
        });
        res.json(tsps.map(t => t.mailToTSP).filter(Boolean).sort());
    } catch (error) {
        console.error('Error fetching unique TSPs:', error);
        res.status(500).json({ error: 'Failed to fetch TSPs' });
    }
};

export const getReportFilters = async (req: Request, res: Response) => {
    try {
        const [paymentModes, hasAPG, hasPBG] = await Promise.all([
            prisma.aRPaymentHistory.findMany({
                distinct: ['paymentMode'],
                select: { paymentMode: true }
            }),
            prisma.aRInvoice.findFirst({
                where: { hasAPG: true },
                select: { id: true }
            }),
            prisma.aRInvoice.findFirst({
                where: { hasPBG: true },
                select: { id: true }
            })
        ]);

        res.json({
            paymentModes: paymentModes.map((m: any) => m.paymentMode).filter(Boolean).sort(),
            hasAPG: !!hasAPG,
            hasPBG: !!hasPBG
        });
    } catch (error) {
        console.error('Error fetching report filters:', error);
        res.status(500).json({ error: 'Failed to fetch filters' });
    }
};
