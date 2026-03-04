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
            collectionsMTD,
            paidCount,
            partialCount,
            overdueCount,
            allUnpaidInvoices,
            criticalOverdue,
            totalInvoicesThisMonth,
            paidThisMonth,
            allInvoicesTotal,
            totalPaid
        ] = await Promise.all([
            // Total Balance (what's owed) - EXCLUDE milestone (already paid, not receivable)
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    where: {
                        status: { not: 'PAID' },
                        invoiceType: { not: 'MILESTONE' }  // Exclude milestone - already collected
                    },
                    _sum: { balance: true },
                    _count: true
                }),
                { _sum: { balance: null }, _count: 0 }
            ),
            // Overdue Balance
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    where: { status: 'OVERDUE' },
                    _sum: { balance: true }
                }),
                { _sum: { balance: null } }
            ),
            // Pending Count
            safeCount(prisma.aRInvoice.count({ where: { status: 'PENDING' } })),
            // Collections MTD
            safeAggregate(
                prisma.aRPaymentHistory.aggregate({
                    where: { paymentDate: { gte: startOfMonth } },
                    _sum: { amount: true },
                    _count: true
                }),
                { _sum: { amount: null }, _count: 0 }
            ),
            // Status Counts
            safeCount(prisma.aRInvoice.count({ where: { status: 'PAID' } })),
            safeCount(prisma.aRInvoice.count({ where: { status: 'PARTIAL' } })),
            safeCount(prisma.aRInvoice.count({ where: { status: 'OVERDUE' } })),
            // All unpaid invoices for aging
            safeFindMany(prisma.aRInvoice.findMany({
                where: { status: { not: 'PAID' } },
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
            // Critical overdue (top 5)
            safeFindMany(prisma.aRInvoice.findMany({
                where: { status: 'OVERDUE' },
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
            // Invoices created this month (for collection rate)
            safeCount(prisma.aRInvoice.count({ where: { invoiceDate: { gte: startOfMonth } } })),
            // Paid this month
            safeCount(prisma.aRInvoice.count({ where: { status: 'PAID', updatedAt: { gte: startOfMonth } } })),
            // Total Amount (all invoices - for reference)
            safeAggregate(
                prisma.aRInvoice.aggregate({
                    _sum: { totalAmount: true },
                    _count: true
                }),
                { _sum: { totalAmount: null }, _count: 0 }
            ),
            // Total Collected (sum of ALL payments - includes partial payments)
            safeAggregate(
                prisma.aRPaymentHistory.aggregate({
                    _sum: { amount: true },
                    _count: true
                }),
                { _sum: { amount: null }, _count: 0 }
            )
        ]);

        // Calculate aging buckets
        const aging = {
            current: { count: 0, amount: 0 },
            days1to30: { count: 0, amount: 0 },
            days31to60: { count: 0, amount: 0 },
            days61to90: { count: 0, amount: 0 },
            over90: { count: 0, amount: 0 }
        };

        allUnpaidInvoices.forEach(inv => {
            let daysOverdue = 0;
            if (inv.invoiceType === 'MILESTONE' && inv.milestoneTerms) {
                // For milestone invoices, use the earliest term date for aging
                const terms = inv.milestoneTerms as any[];
                if (Array.isArray(terms) && terms.length > 0) {
                    const earliestTerm = terms.reduce((earliest: any, term: any) => {
                        if (!earliest || new Date(term.termDate) < new Date(earliest.termDate)) return term;
                        return earliest;
                    }, null);
                    if (earliestTerm?.termDate) {
                        daysOverdue = calculateDaysBetween(new Date(earliestTerm.termDate), today);
                    }
                }
            } else {
                daysOverdue = calculateDaysBetween(inv.dueDate, today);
            }

            const amount = Number(inv.balance ?? inv.totalAmount ?? 0);

            if (daysOverdue <= 0) { aging.current.count++; aging.current.amount += amount; }
            else if (daysOverdue <= 30) { aging.days1to30.count++; aging.days1to30.amount += amount; }
            else if (daysOverdue <= 60) { aging.days31to60.count++; aging.days31to60.amount += amount; }
            else if (daysOverdue <= 90) { aging.days61to90.count++; aging.days61to90.amount += amount; }
            else { aging.over90.count++; aging.over90.amount += amount; }
        });

        // Calculate critical overdue with days
        const criticalWithDays = criticalOverdue.map(inv => {
            let daysOverdue = 0;
            if (inv.invoiceType === 'MILESTONE' && inv.milestoneTerms) {
                const terms = inv.milestoneTerms as any[];
                if (Array.isArray(terms) && terms.length > 0) {
                    const earliestTerm = terms.reduce((earliest: any, term: any) => {
                        if (!earliest || new Date(term.termDate) < new Date(earliest.termDate)) return term;
                        return earliest;
                    }, null);
                    if (earliestTerm?.termDate) {
                        daysOverdue = calculateDaysBetween(new Date(earliestTerm.termDate), today);
                    }
                }
            } else if (inv.dueDate) {
                daysOverdue = Math.max(0, calculateDaysBetween(inv.dueDate, today));
            }

            return {
                ...inv,
                daysOverdue
            };
        });

        // ═══════════════════════════════════════════════════════════════════════════
        // PERFORMANCE INDICATORS (Good/Bad Percentages)
        // ═══════════════════════════════════════════════════════════════════════════

        const totalInvoices = pendingCount + partialCount + paidCount + overdueCount;
        const totalInvoicedAmount = Number(allInvoicesTotal._sum?.totalAmount ?? 0);
        const totalCollectedAmount = Number(totalPaid._sum?.amount ?? 0);

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

        res.json({
            kpis: {
                totalAmount: Number(allInvoicesTotal._sum?.totalAmount ?? 0),
                totalAllInvoices: allInvoicesTotal._count ?? 0,
                totalCollected: Number(totalPaid._sum?.amount ?? 0),
                totalPayments: totalPaid._count ?? 0,
                totalBalance: Number(totalBalance._sum?.balance ?? 0),
                totalInvoices: totalBalance._count ?? 0,
                overdueAmount: Number(overdueBalance._sum?.balance ?? 0),
                pendingCount,
                collectionsMTD: Number(collectionsMTD._sum?.amount ?? 0),
                paymentsCount: collectionsMTD._count ?? 0
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
            criticalOverdue: criticalWithDays
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
