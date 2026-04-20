import { Request, Response } from 'express';
import prisma from '../../config/db';
import { calculateDaysBetween } from '../../utils/dateUtils';

// ═══════════════════════════════════════════════════════════════════════════
// SAFE QUERY HELPERS - Prevent crashes
// ═══════════════════════════════════════════════════════════════════════════

const safeAggregate = async <T>(query: Promise<T>, fallback: T): Promise<T> => {
    try { return await query; }
    catch (e) { return fallback; }
};

const safeFindMany = async <T>(query: Promise<T[]>): Promise<T[]> => {
    try { return await query; }
    catch (e) { return []; }
};

const safeCount = async (query: Promise<number>): Promise<number> => {
    try { return await query; }
    catch (e) { return 0; }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENDPOINT: Essential Dashboard with Performance Indicators
// GET /ar/dashboard/essential
// ═══════════════════════════════════════════════════════════════════════════

export const getEssentialDashboard = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Parallel queries for all data
        const [
            totalBalance,
            overdueBalance,
            pendingCount,
            paidCount,
            partialCount,
            overdueCount,
            allInvoicesTotal,
            standardPaid,
            allUnpaidInvoices,
            criticalOverdue,
            totalInvoicesThisMonth,
            paidThisMonth,
            milestoneAgg,
            allMilestoneInvoices
        ] = await Promise.all([
            // Total Balance (what's owed) - Strictly REGULAR
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    where: {
                        status: { not: 'CANCELLED' },
                        invoiceType: 'REGULAR'
                    },
                    _sum: { balance: true },
                    _count: true
                }),
                { _sum: { balance: null }, _count: 0 }
            ),
            // Overdue Balance - Strictly REGULAR (Dynamic)
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    where: {
                        invoiceType: 'REGULAR',
                        OR: [
                            { status: 'OVERDUE' },
                            {
                                status: { in: ['PENDING', 'PARTIAL'] },
                                dueDate: { lt: today }
                            }
                        ]
                    },
                    _sum: { balance: true }
                }),
                { _sum: { balance: null } }
            ),
            // Pending Count - Strictly REGULAR (Dynamic: not yet due)
            safeCount(prisma.aRInvoice.count({
                where: {
                    status: 'PENDING',
                    invoiceType: 'REGULAR',
                    OR: [
                        { dueDate: { gte: today } },
                        { dueDate: null }
                    ]
                }
            })),
            // Status Counts - Strictly REGULAR
            safeCount(prisma.aRInvoice.count({ where: { status: 'PAID', invoiceType: 'REGULAR' } })),
            safeCount(prisma.aRInvoice.count({
                where: {
                    status: 'PARTIAL',
                    invoiceType: 'REGULAR',
                    OR: [
                        { dueDate: { gte: today } },
                        { dueDate: null }
                    ]
                }
            })),
            safeCount(prisma.aRInvoice.count({
                where: {
                    invoiceType: 'REGULAR',
                    OR: [
                        { status: 'OVERDUE' },
                        {
                            status: { in: ['PENDING', 'PARTIAL'] },
                            dueDate: { lt: today }
                        }
                    ]
                }
            })),

            // Total Amount (Standard only)
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    where: {
                        invoiceType: 'REGULAR',
                        status: { not: 'CANCELLED' }
                    },
                    _sum: { totalAmount: true },
                    _count: true
                }),
                { _sum: { totalAmount: null }, _count: 0 }
            ),
            // Total Collected (Sum totalReceipts of REGULAR invoices)
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    where: {
                        invoiceType: 'REGULAR',
                        status: { not: 'CANCELLED' }
                    },
                    _sum: { totalReceipts: true },
                    _count: true
                }),
                { _sum: { totalReceipts: null }, _count: 0 }
            ),
            // All unpaid invoices for aging - Strictly REGULAR
            safeFindMany(prisma.aRInvoice.findMany({
                where: {
                    status: { notIn: ['PAID', 'CANCELLED'] },
                    invoiceType: 'REGULAR'
                },
                select: {
                    dueDate: true,
                    balance: true,
                    totalAmount: true,
                    invoiceType: true,
                    milestoneTerms: true,
                    advanceReceivedDate: true,
                    invoiceDate: true
                }
            })),
            // Critical overdue (top 5) - Strictly REGULAR (Dynamic)
            safeFindMany(prisma.aRInvoice.findMany({
                where: {
                    invoiceType: 'REGULAR',
                    OR: [
                        { status: 'OVERDUE' },
                        {
                            status: { in: ['PENDING', 'PARTIAL'] },
                            dueDate: { lt: today }
                        }
                    ]
                },
                orderBy: { balance: 'desc' },
                take: 5,
                select: {
                    id: true,
                    invoiceNumber: true,
                    customerName: true,
                    balance: true,
                    dueDate: true,
                    invoiceType: true,
                    milestoneTerms: true,
                    advanceReceivedDate: true,
                    invoiceDate: true,
                    soNo: true
                }
            })),
            // Invoices created this month (for rate)
            safeCount(prisma.aRInvoice.count({ where: { invoiceDate: { gte: startOfMonth }, invoiceType: 'REGULAR' } })),
            // Paid this month
            safeCount(prisma.aRInvoice.count({ where: { status: 'PAID', updatedAt: { gte: startOfMonth }, invoiceType: 'REGULAR' } })),
            // ═══ MILESTONE-SPECIFIC QUERIES ═══
            // Milestone Total Value
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    where: { invoiceType: 'MILESTONE' },
                    _sum: { totalAmount: true, totalReceipts: true, balance: true },
                    _count: true
                }),
                { _sum: { totalAmount: null, totalReceipts: null, balance: null }, _count: 0 }
            ),
            // All milestone invoices (for milestones section)
            safeFindMany(prisma.aRInvoice.findMany({
                where: { 
                    invoiceType: 'MILESTONE',
                    status: { notIn: ['PAID', 'CANCELLED'] }
                },
                select: {
                    id: true,
                    soNo: true,
                    poNo: true,
                    customerName: true,
                    bpCode: true,
                    totalAmount: true,
                    totalReceipts: true,
                    balance: true,
                    milestoneTerms: true,
                    milestoneStatus: true,
                    status: true,
                    netAmount: true
                },
                orderBy: { totalAmount: 'desc' }
            }))
        ]);

        // Secondary query for MTD Collections (filtered by Regular vs Milestone)
        const regularInvoiceIds = await prisma.aRInvoice.findMany({
            where: { invoiceType: 'REGULAR' },
            select: { id: true }
        }).then(list => list.map(inv => inv.id));

        const collectionsMTD = await safeAggregate(
            prisma.aRPaymentHistory.aggregate({
                where: {
                    paymentDate: { gte: startOfMonth },
                    invoiceId: { in: regularInvoiceIds }
                },
                _sum: { amount: true },
                _count: true
            }),
            { _sum: { amount: null }, _count: 0 }
        );

        // Calculate aging buckets
        const aging = {
            current: { count: 0, amount: 0 },
            days1to30: { count: 0, amount: 0 },
            days31to60: { count: 0, amount: 0 },
            days61to90: { count: 0, amount: 0 },
            over90: { count: 0, amount: 0 }
        };

        allUnpaidInvoices.forEach(inv => {
            const daysOverdue = calculateDaysBetween(inv.dueDate, today);
            const amount = Number(inv.balance ?? inv.totalAmount ?? 0);

            if (daysOverdue <= 0) { aging.current.count++; aging.current.amount += amount; }
            else if (daysOverdue <= 30) { aging.days1to30.count++; aging.days1to30.amount += amount; }
            else if (daysOverdue <= 60) { aging.days31to60.count++; aging.days31to60.amount += amount; }
            else if (daysOverdue <= 90) { aging.days61to90.count++; aging.days61to90.amount += amount; }
            else { aging.over90.count++; aging.over90.amount += amount; }
        });

        // Calculate critical overdue with days
        const criticalWithDays = criticalOverdue.map(inv => {
            return {
                ...inv,
                daysOverdue: inv.dueDate ? Math.max(0, calculateDaysBetween(inv.dueDate, today)) : 0
            };
        });

        // ═══════════════════════════════════════════════════════════════════════════
        // MILESTONE CALCULATIONS
        // ═══════════════════════════════════════════════════════════════════════════

        let overdueMilestoneTerms = 0;
        let overdueMilestoneAmount = 0;

        const milestoneAging = {
            current: { count: 0, amount: 0 },
            days1to30: { count: 0, amount: 0 },
            days31to60: { count: 0, amount: 0 },
            days61to90: { count: 0, amount: 0 },
            over90: { count: 0, amount: 0 }
        };

        const milestoneStatusCounts = {
            pending: 0,
            partial: 0,
            paid: 0,
            overdue: 0,
            cancelled: 0,
            total: allMilestoneInvoices.length
        };

        const milestoneStages = {
            advance: { pending: 0, overdue: 0, paid: 0 },
            dispatch: { pending: 0, overdue: 0, paid: 0 },
            installation: { pending: 0, overdue: 0, paid: 0 },
            others: { pending: 0, overdue: 0, paid: 0 }
        };

        const processedMilestones = allMilestoneInvoices.map(inv => {
            const terms = (inv.milestoneTerms as any[]) || [];
            const sortedTerms = [...terms].sort((a, b) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime());

            let invOverdueTerms = 0;
            let worstAging = 0;
            let earliestOverdueTermDate: Date | null = null;
            let totalPendingOverdueForInv = 0;

            // Allocate Receipts to Terms (matching frontend logic)
            const tAmt = Number(inv.totalAmount || 0);
            const nAmt = Number(inv.netAmount || 0);
            let remainingReceipts = Number(inv.totalReceipts || 0);

            sortedTerms.forEach(term => {
                const termDate = new Date(term.termDate);
                const percentage = term.percentage || 0;
                const isNetBasis = term.calculationBasis !== 'TOTAL_AMOUNT';
                const baseAmount = isNetBasis ? nAmt : tAmt;
                const allocatedAmount = (baseAmount * percentage) / 100;

                const collectedForTerm = Math.min(allocatedAmount, Math.max(0, remainingReceipts));
                remainingReceipts -= collectedForTerm;

                const pendingForTerm = Math.max(0, allocatedAmount - collectedForTerm);
                const isPaid = pendingForTerm < 0.01;

                // Track Stages Breakdown
                const label = (term.label || term.termType || '').toLowerCase();
                let category: 'advance' | 'dispatch' | 'installation' | 'others' = 'others';
                if (label.includes('advance')) category = 'advance';
                else if (label.includes('dispatch')) category = 'dispatch';
                else if (label.includes('install')) category = 'installation';

                if (isPaid) {
                    milestoneStages[category].paid++;
                } else if (termDate < today) {
                    milestoneStages[category].overdue++;
                } else {
                    milestoneStages[category].pending++;
                }

                // Track Overdue Terms for Aging
                if (termDate < today && !isPaid && inv.milestoneStatus !== 'FULLY_DELIVERED') {
                    const agingDays = calculateDaysBetween(termDate, today);
                    if (agingDays > 0) {
                        invOverdueTerms++;
                        totalPendingOverdueForInv += pendingForTerm;
                        if (agingDays > worstAging) worstAging = agingDays;
                        if (!earliestOverdueTermDate || termDate < earliestOverdueTermDate) {
                            earliestOverdueTermDate = termDate;
                        }
                    }
                }
            });

            // 2. Aggregate Totals
            overdueMilestoneTerms += invOverdueTerms;
            if (invOverdueTerms > 0) {
                // We add the actual pending amount that is overdue, 
                // but usually the balance of the whole invoice is shown if it's considered an "overdue milestone"
                // To match the frontend's "ON TRACK" vs "OVERDUE", we use invOverdueTerms > 0.
                overdueMilestoneAmount += totalPendingOverdueForInv;
            }

            // 3. Milestone Aging Buckets
            const invBalance = Number(inv.balance || 0);
            if (!earliestOverdueTermDate) {
                milestoneAging.current.count++;
                milestoneAging.current.amount += invBalance;
            } else {
                const agingDays = calculateDaysBetween(earliestOverdueTermDate, today);
                if (agingDays <= 30) { milestoneAging.days1to30.count++; milestoneAging.days1to30.amount += invBalance; }
                else if (agingDays <= 60) { milestoneAging.days31to60.count++; milestoneAging.days31to60.amount += invBalance; }
                else if (agingDays <= 90) { milestoneAging.days61to90.count++; milestoneAging.days61to90.amount += invBalance; }
                else { milestoneAging.over90.count++; milestoneAging.over90.amount += invBalance; }
            }

            // 4. Milestone Status Counts
            if (inv.status === 'CANCELLED') milestoneStatusCounts.cancelled++;
            else if (inv.status === 'PAID') milestoneStatusCounts.paid++;
            else if (invOverdueTerms > 0) milestoneStatusCounts.overdue++;
            else if (inv.status === 'PARTIAL') milestoneStatusCounts.partial++;
            else milestoneStatusCounts.pending++;

            return {
                id: inv.id,
                soNo: inv.soNo,
                poNo: inv.poNo,
                customerName: inv.customerName,
                bpCode: inv.bpCode,
                totalAmount: tAmt,
                totalReceipts: Number(inv.totalReceipts || 0),
                balance: invBalance,
                overdueTerms: invOverdueTerms,
                worstAging,
                milestoneStatus: inv.milestoneStatus,
                status: inv.status
            };
        });

        const criticalMilestones = processedMilestones
            .filter(m => m.overdueTerms > 0)
            .sort((a, b) => b.worstAging - a.worstAging || b.overdueTerms - a.overdueTerms)
            .slice(0, 5);

        // ═══════════════════════════════════════════════════════════════════════════
        // PERFORMANCE INDICATORS (Good/Bad Percentages)
        // ═══════════════════════════════════════════════════════════════════════════

        const totalInvoices = pendingCount + partialCount + paidCount + overdueCount;
        const totalInvoicedAmount = Number(allInvoicesTotal._sum?.totalAmount ?? 0);
        const totalCollectedAmount = Number(standardPaid._sum?.totalReceipts ?? 0);

        // 1. Collection Rate: % of AMOUNT collected vs invoiced (amount-based, not count-based)
        const collectionRate = totalInvoicedAmount > 0 ? Math.round((totalCollectedAmount / totalInvoicedAmount) * 100) : 0;
        const collectionStatus = collectionRate >= 70 ? 'GOOD' : collectionRate >= 50 ? 'AVERAGE' : 'BAD';

        // 2. Overdue Rate: % of invoices that are overdue (lower is better)
        const overdueRate = totalInvoices > 0 ? Math.round((overdueCount / totalInvoices) * 100) : 0;
        const overdueStatus = overdueRate <= 10 ? 'GOOD' : overdueRate <= 25 ? 'AVERAGE' : 'BAD';

        // 3. On-Time Rate: % of invoices NOT overdue (higher is better)
        const onTimeRate = 100 - overdueRate;
        const onTimeStatus = onTimeRate >= 90 ? 'GOOD' : onTimeRate >= 75 ? 'AVERAGE' : 'BAD';

        // 4. Current Invoices Rate: % of balance in "Current" aging (not yet due)
        const totalAgingAmount = aging.current.amount + aging.days1to30.amount + aging.days31to60.amount + aging.days61to90.amount + aging.over90.amount;
        const currentRate = totalAgingAmount > 0 ? Math.round((aging.current.amount / totalAgingAmount) * 100) : 0;
        const currentStatus = currentRate >= 60 ? 'GOOD' : currentRate >= 40 ? 'AVERAGE' : 'BAD';

        // ═══════════════════════════════════════════════════════════════════════════
        // MILESTONE PERFORMANCE INDICATORS
        // ═══════════════════════════════════════════════════════════════════════════

        const totalMilestonesCount = allMilestoneInvoices.length;
        const milestoneTotalAmt = Number(milestoneAgg._sum?.totalAmount ?? 0);
        const milestoneCollectedAmt = Number(milestoneAgg._sum?.totalReceipts ?? 0);

        // 1. Milestone Collection Rate
        const milestoneCollectionRate = milestoneTotalAmt > 0 ? Math.round((milestoneCollectedAmt / milestoneTotalAmt) * 100) : 0;
        const milestoneCollectionStatus = milestoneCollectionRate >= 70 ? 'GOOD' : milestoneCollectionRate >= 50 ? 'AVERAGE' : 'BAD';

        // 2. Milestone Overdue Rate
        const milestoneOverdueCount = processedMilestones.filter(m => m.overdueTerms > 0 || m.status === 'OVERDUE').length;
        const milestoneOverdueRate = totalMilestonesCount > 0 ? Math.round((milestoneOverdueCount / totalMilestonesCount) * 100) : 0;
        const milestoneOverdueStatus = milestoneOverdueRate <= 10 ? 'GOOD' : milestoneOverdueRate <= 25 ? 'AVERAGE' : 'BAD';

        // 3. Milestone On-Time Rate
        const milestoneOnTimeRate = 100 - milestoneOverdueRate;
        const milestoneOnTimeStatus = milestoneOnTimeRate >= 90 ? 'GOOD' : milestoneOnTimeRate >= 75 ? 'AVERAGE' : 'BAD';

        // 4. Milestone Current Rate
        const totalMilestoneAgingAmount = milestoneAging.current.amount + milestoneAging.days1to30.amount + milestoneAging.days31to60.amount + milestoneAging.days61to90.amount + milestoneAging.over90.amount;
        const milestoneCurrentRate = totalMilestoneAgingAmount > 0 ? Math.round((milestoneAging.current.amount / totalMilestoneAgingAmount) * 100) : 0;
        const milestoneCurrentStatus = milestoneCurrentRate >= 60 ? 'GOOD' : milestoneCurrentRate >= 40 ? 'AVERAGE' : 'BAD';

        res.json({
            kpis: {
                totalAmount: totalInvoicedAmount,
                totalAllInvoices: allInvoicesTotal._count ?? 0,
                totalCollected: totalCollectedAmount,
                totalPayments: standardPaid._count ?? 0,
                totalBalance: totalInvoicedAmount - totalCollectedAmount,
                totalInvoices: totalBalance._count ?? 0,
                overdueAmount: Number(overdueBalance._sum?.balance ?? 0),
                pendingCount,
                collectionsMTD: Number(collectionsMTD._sum?.amount ?? 0),
                paymentsCount: collectionsMTD._count ?? 0
            },
            milestoneKpis: {
                totalValue: Number(milestoneAgg._sum?.totalAmount ?? 0),
                totalCollected: Number(milestoneAgg._sum?.totalReceipts ?? 0),
                totalOutstanding: Number(milestoneAgg._sum?.balance ?? 0),
                overdueAmount: overdueMilestoneAmount,
                overdueTermsCount: overdueMilestoneTerms,
                totalMilestones: milestoneAgg._count ?? 0,
                statusCounts: milestoneStatusCounts,
                aging: milestoneAging,
                stages: milestoneStages,
                performance: {
                    collectionRate: { value: milestoneCollectionRate, status: milestoneCollectionStatus, label: 'Collection Rate' },
                    overdueRate: { value: milestoneOverdueRate, status: milestoneOverdueStatus, label: 'Overdue Rate' },
                    onTimeRate: { value: milestoneOnTimeRate, status: milestoneOnTimeStatus, label: 'On-Time Rate' },
                    currentRate: { value: milestoneCurrentRate, status: milestoneCurrentStatus, label: 'Current (Not Due)' }
                }
            },
            statusCounts: {
                pending: pendingCount,
                partial: partialCount,
                paid: paidCount,
                overdue: overdueCount,
                total: totalInvoices
            },
            performance: {
                collectionRate: { value: collectionRate, status: collectionStatus, label: 'Collection Rate' },
                overdueRate: { value: overdueRate, status: overdueStatus, label: 'Overdue Rate' },
                onTimeRate: { value: onTimeRate, status: onTimeStatus, label: 'On-Time Rate' },
                currentRate: { value: currentRate, status: currentStatus, label: 'Current (Not Due)' }
            },
            aging,
            criticalOverdue: criticalWithDays,
            criticalMilestones
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to load dashboard', message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY ENDPOINTS (Keep for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export const getDashboardKPIs = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [totalOutstanding, overdueData, pendingCount, collectionsMTD, allInvoices] = await Promise.all([
            safeAggregate(prisma.aRInvoice.aggregate({ where: { status: { not: 'PAID' } }, _sum: { balance: true }, _count: true }), { _sum: { balance: null }, _count: 0 }),
            safeAggregate(prisma.aRInvoice.aggregate({ where: { status: 'OVERDUE' }, _sum: { balance: true }, _count: true }), { _sum: { balance: null }, _count: 0 }),
            safeCount(prisma.aRInvoice.count({ where: { status: 'PENDING' } })),
            safeAggregate(prisma.aRPaymentHistory.aggregate({ where: { paymentDate: { gte: startOfMonth } }, _sum: { amount: true }, _count: true }), { _sum: { amount: null }, _count: 0 }),
            safeFindMany(prisma.aRInvoice.findMany({ select: { totalAmount: true } }))
        ]);

        const totalReceivable = Number(totalOutstanding._sum?.balance ?? 0);
        const totalSales = allInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
        const dso = totalSales > 0 ? Math.round((totalReceivable / totalSales) * 90) : 0;

        res.json({
            totalOutstanding: totalReceivable,
            totalInvoices: totalOutstanding._count ?? 0,
            overdueAmount: Number(overdueData._sum?.balance ?? 0),
            overdueCount: overdueData._count ?? 0,
            pendingCount,
            collectionsMTD: Number(collectionsMTD._sum?.amount ?? 0),
            paymentsCount: collectionsMTD._count ?? 0,
            dso
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch KPIs', message: error.message });
    }
};

export const getAgingAnalysis = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        const invoices = await safeFindMany(prisma.aRInvoice.findMany({
            where: { status: { not: 'PAID' } },
            select: { dueDate: true, balance: true, totalAmount: true }
        }));

        const aging = { current: { count: 0, amount: 0 }, days1to30: { count: 0, amount: 0 }, days31to60: { count: 0, amount: 0 }, days61to90: { count: 0, amount: 0 }, over90: { count: 0, amount: 0 } };

        invoices.forEach(inv => {
            const daysOverdue = calculateDaysBetween(inv.dueDate, today);
            const amount = Number(inv.balance ?? inv.totalAmount ?? 0);
            if (daysOverdue <= 0) { aging.current.count++; aging.current.amount += amount; }
            else if (daysOverdue <= 30) { aging.days1to30.count++; aging.days1to30.amount += amount; }
            else if (daysOverdue <= 60) { aging.days31to60.count++; aging.days31to60.amount += amount; }
            else if (daysOverdue <= 90) { aging.days61to90.count++; aging.days61to90.amount += amount; }
            else { aging.over90.count++; aging.over90.amount += amount; }
        });

        res.json(aging);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch aging', message: error.message });
    }
};

export const getCollectionTrend = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        const payments = await safeFindMany(prisma.aRPaymentHistory.findMany({
            where: { paymentDate: { gte: sixMonthsAgo } },
            select: { paymentDate: true, amount: true }
        }));

        const monthlyData: { [key: string]: number } = {};
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            monthlyData[date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })] = 0;
        }
        payments.forEach(p => {
            const key = new Date(p.paymentDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            if (monthlyData[key] !== undefined) monthlyData[key] += Number(p.amount ?? 0);
        });

        res.json(Object.entries(monthlyData).map(([month, amount]) => ({ month, amount })));
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch trend', message: error.message });
    }
};

export const getStatusDistribution = async (req: Request, res: Response) => {
    try {
        const [pending, partial, paid, overdue, cancelled] = await Promise.all([
            safeCount(prisma.aRInvoice.count({ where: { status: 'PENDING' } })),
            safeCount(prisma.aRInvoice.count({ where: { status: 'PARTIAL' } })),
            safeCount(prisma.aRInvoice.count({ where: { status: 'PAID' } })),
            safeCount(prisma.aRInvoice.count({ where: { status: 'OVERDUE' } })),
            safeCount(prisma.aRInvoice.count({ where: { status: 'CANCELLED' } }))
        ]);
        res.json({ pending, partial, paid, overdue, cancelled, total: pending + partial + paid + overdue + cancelled });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch status', message: error.message });
    }
};

export const getRiskDistribution = async (req: Request, res: Response) => {
    try {
        const invoices = await safeFindMany(prisma.aRInvoice.findMany({
            where: { status: { not: 'PAID' } },
            select: { riskClass: true, balance: true, totalAmount: true }
        }));

        const dist = { LOW: { count: 0, amount: 0 }, MEDIUM: { count: 0, amount: 0 }, HIGH: { count: 0, amount: 0 }, CRITICAL: { count: 0, amount: 0 } };
        invoices.forEach(inv => {
            const key = inv.riskClass || 'LOW';
            if (dist[key]) { dist[key].count++; dist[key].amount += Number(inv.balance ?? inv.totalAmount ?? 0); }
        });
        res.json(dist);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch risk', message: error.message });
    }
};

export const getCriticalOverdue = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const invoices = await safeFindMany(prisma.aRInvoice.findMany({
            where: { status: 'OVERDUE' },
            orderBy: { balance: 'desc' },
            take: limit,
            select: { id: true, invoiceNumber: true, bpCode: true, customerName: true, totalAmount: true, balance: true, dueDate: true, riskClass: true, status: true, soNo: true }
        }));

        const today = new Date();
        res.json(invoices.map(inv => ({
            ...inv,
            daysOverdue: Math.max(0, calculateDaysBetween(inv.dueDate, today))
        })));
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch overdue', message: error.message });
    }
};

export const getTopCustomers = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 5;
        const invoices = await safeFindMany(prisma.aRInvoice.findMany({
            where: { status: { not: 'PAID' } },
            select: { bpCode: true, customerName: true, balance: true, totalAmount: true }
        }));

        const map: { [key: string]: { bpCode: string; customerName: string; outstanding: number; invoiceCount: number } } = {};
        invoices.forEach(inv => {
            if (!map[inv.bpCode]) map[inv.bpCode] = { bpCode: inv.bpCode, customerName: inv.customerName, outstanding: 0, invoiceCount: 0 };
            map[inv.bpCode].outstanding += Number(inv.balance ?? inv.totalAmount ?? 0);
            map[inv.bpCode].invoiceCount++;
        });

        const sorted = Object.values(map).sort((a, b) => b.outstanding - a.outstanding).slice(0, limit);
        const total = sorted.reduce((s, c) => s + c.outstanding, 0);
        res.json(sorted.map(c => ({ ...c, percentage: total > 0 ? Math.round((c.outstanding / total) * 100) : 0 })));
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch customers', message: error.message });
    }
};

export const getRecentPayments = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const payments = await safeFindMany(prisma.aRPaymentHistory.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                invoiceId: true,
                amount: true,
                paymentMode: true,
                paymentDate: true,
                createdAt: true
            }
        }));

        // Fetch related invoices in one batch query to avoid N+1
        const invoiceIds = [...new Set(payments.map(p => p.invoiceId))];
        const invoices = await prisma.aRInvoice.findMany({
            where: { id: { in: invoiceIds } },
            select: { id: true, invoiceNumber: true, customerName: true }
        });

        // Map invoices back to payments
        const result = payments.map(p => ({
            ...p,
            invoice: invoices.find(inv => inv.id === p.invoiceId) || null
        }));

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch payments', message: error.message });
    }
};
