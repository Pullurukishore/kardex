import { Request, Response } from 'express';
import prisma from '../../config/db';
import { calculateDaysBetween } from '../../utils/dateUtils';

// ═══════════════════════════════════════════════════════════════════════════
// AGING REPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get Detailed Aging Report - Invoice-level aging with all details
 */
export const getDetailedAgingReport = async (req: Request, res: Response) => {
    try {
        const { status, riskClass, customer, fromDate, toDate, bucket } = req.query;
        const today = new Date();

        const where: any = { status: { not: 'PAID' } };

        if (status && status !== 'ALL') where.status = status;
        if (riskClass) where.riskClass = riskClass;
        if (customer) where.customerName = { contains: String(customer), mode: 'insensitive' };
        if (fromDate) where.invoiceDate = { ...where.invoiceDate, gte: new Date(String(fromDate)) };
        if (toDate) where.invoiceDate = { ...where.invoiceDate, lte: new Date(String(toDate)) };
        
        // Exclude linked milestones to prevent overcounting in reports
        where.NOT = { milestoneStatus: 'LINKED' };

        const invoices = await prisma.aRInvoice.findMany({
            where,
            select: {
                id: true,
                invoiceNumber: true,
                bpCode: true,
                customerName: true,
                totalAmount: true,
                netAmount: true,
                balance: true,
                dueDate: true,
                invoiceDate: true,
                riskClass: true,
                status: true,
                invoiceType: true,
                region: true,
                poNo: true,
                soNo: true
            },
            orderBy: { dueDate: 'asc' }
        });

        const report = invoices.map(inv => {
            const daysOverdue = inv.dueDate ? calculateDaysBetween(inv.dueDate, today) : 0;
            const agingBucket =
                daysOverdue <= 0 ? 'Current' :
                    daysOverdue <= 30 ? '1-30 Days' :
                        daysOverdue <= 60 ? '31-60 Days' :
                            daysOverdue <= 90 ? '61-90 Days' : 'Over 90 Days';

            return {
                ...inv,
                totalAmount: Number(inv.totalAmount),
                netAmount: Number(inv.netAmount),
                balance: Number(inv.balance || 0),
                daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
                agingBucket
            };
        }).filter(inv => !bucket || inv.agingBucket === bucket);

        res.json({
            data: report,
            summary: {
                totalInvoices: report.length,
                totalAmount: report.reduce((sum, inv) => sum + inv.totalAmount, 0),
                totalBalance: report.reduce((sum, inv) => sum + inv.balance, 0)
            }
        });
    } catch (error: any) {
        console.error('Detailed aging report error:', error);
        res.status(500).json({ error: 'Failed to generate detailed aging report' });
    }
};

/**
 * Get Aging Summary - Aggregated by aging buckets
 */
export const getAgingSummary = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        const invoices = await prisma.aRInvoice.findMany({
            where: { 
                status: { not: 'PAID' },
                NOT: { milestoneStatus: 'LINKED' }
            },
            select: {
                balance: true,
                dueDate: true
            }
        });

        const buckets = {
            current: { count: 0, amount: 0, label: 'Current' },
            days1to30: { count: 0, amount: 0, label: '1-30 Days' },
            days31to60: { count: 0, amount: 0, label: '31-60 Days' },
            days61to90: { count: 0, amount: 0, label: '61-90 Days' },
            over90: { count: 0, amount: 0, label: 'Over 90 Days' }
        };

        invoices.forEach(inv => {
            const daysOverdue = inv.dueDate ? calculateDaysBetween(inv.dueDate, today) : 0;
            const balance = Number(inv.balance || 0);

            if (daysOverdue <= 0) {
                buckets.current.count++;
                buckets.current.amount += balance;
            } else if (daysOverdue <= 30) {
                buckets.days1to30.count++;
                buckets.days1to30.amount += balance;
            } else if (daysOverdue <= 60) {
                buckets.days31to60.count++;
                buckets.days31to60.amount += balance;
            } else if (daysOverdue <= 90) {
                buckets.days61to90.count++;
                buckets.days61to90.amount += balance;
            } else {
                buckets.over90.count++;
                buckets.over90.amount += balance;
            }
        });

        const totalAmount = Object.values(buckets).reduce((sum, b) => sum + b.amount, 0);
        const bucketsWithPercentage = Object.entries(buckets).map(([key, value]) => ({
            key,
            ...value,
            percentage: totalAmount > 0 ? ((value.amount / totalAmount) * 100).toFixed(1) : '0'
        }));

        res.json({
            buckets: bucketsWithPercentage,
            total: {
                count: invoices.length,
                amount: totalAmount
            }
        });
    } catch (error: any) {
        console.error('Aging summary error:', error);
        res.status(500).json({ error: 'Failed to generate aging summary' });
    }
};

/**
 * Get Customer-wise Aging Report
 */
export const getCustomerAgingReport = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        const { limit = 20, sortBy = 'balance' } = req.query;

        const invoices = await prisma.aRInvoice.findMany({
            where: { 
                status: { not: 'PAID' },
                NOT: { milestoneStatus: 'LINKED' }
            },
            select: {
                bpCode: true,
                customerName: true,
                balance: true,
                dueDate: true,
                riskClass: true
            }
        });

        // Group by customer
        const customerMap = new Map<string, {
            bpCode: string;
            customerName: string;
            invoiceCount: number;
            totalBalance: number;
            riskClass: string;
            currentAmount: number;
            overdueAmount: number;
            maxDaysOverdue: number;
        }>();

        invoices.forEach(inv => {
            const key = inv.bpCode;
            const daysOverdue = inv.dueDate ? calculateDaysBetween(inv.dueDate, today) : 0;
            const balance = Number(inv.balance || 0);

            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    bpCode: inv.bpCode,
                    customerName: inv.customerName,
                    invoiceCount: 0,
                    totalBalance: 0,
                    riskClass: inv.riskClass,
                    currentAmount: 0,
                    overdueAmount: 0,
                    maxDaysOverdue: 0
                });
            }

            const customer = customerMap.get(key)!;
            customer.invoiceCount++;
            customer.totalBalance += balance;
            customer.maxDaysOverdue = Math.max(customer.maxDaysOverdue, daysOverdue > 0 ? daysOverdue : 0);

            if (daysOverdue <= 0) {
                customer.currentAmount += balance;
            } else {
                customer.overdueAmount += balance;
            }
        });

        let result = Array.from(customerMap.values());

        // Sort
        if (sortBy === 'balance') {
            result.sort((a, b) => b.totalBalance - a.totalBalance);
        } else if (sortBy === 'overdue') {
            result.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue);
        }

        // Limit
        result = result.slice(0, Number(limit));

        res.json({
            customers: result,
            summary: {
                totalCustomers: customerMap.size,
                totalBalance: result.reduce((sum, c) => sum + c.totalBalance, 0),
                totalOverdue: result.reduce((sum, c) => sum + c.overdueAmount, 0)
            }
        });
    } catch (error: any) {
        console.error('Customer aging report error:', error);
        res.status(500).json({ error: 'Failed to generate customer aging report' });
    }
};

/**
 * Get Risk-based Aging Report
 */
export const getRiskAgingReport = async (req: Request, res: Response) => {
    try {
        const invoices = await prisma.aRInvoice.findMany({
            where: { 
                status: { not: 'PAID' },
                NOT: { milestoneStatus: 'LINKED' }
            },
            select: {
                riskClass: true,
                balance: true,
                totalAmount: true
            }
        });

        const riskBuckets = {
            LOW: { count: 0, balance: 0, totalAmount: 0 },
            MEDIUM: { count: 0, balance: 0, totalAmount: 0 },
            HIGH: { count: 0, balance: 0, totalAmount: 0 },
            CRITICAL: { count: 0, balance: 0, totalAmount: 0 }
        };

        invoices.forEach(inv => {
            const risk = inv.riskClass as keyof typeof riskBuckets;
            if (riskBuckets[risk]) {
                riskBuckets[risk].count++;
                riskBuckets[risk].balance += Number(inv.balance || 0);
                riskBuckets[risk].totalAmount += Number(inv.totalAmount);
            }
        });

        const totalBalance = Object.values(riskBuckets).reduce((sum, b) => sum + b.balance, 0);
        const result = Object.entries(riskBuckets).map(([risk, data]) => ({
            riskClass: risk,
            ...data,
            percentage: totalBalance > 0 ? ((data.balance / totalBalance) * 100).toFixed(1) : '0'
        }));

        res.json({
            risks: result,
            total: {
                count: invoices.length,
                balance: totalBalance
            }
        });
    } catch (error: any) {
        console.error('Risk aging report error:', error);
        res.status(500).json({ error: 'Failed to generate risk aging report' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION REPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get Collection Trends - Monthly/Weekly collection amounts
 */
export const getCollectionTrends = async (req: Request, res: Response) => {
    try {
        const { months = 6, groupBy = 'month' } = req.query;
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - Number(months));

        const payments = await prisma.aRPaymentHistory.findMany({
            where: {
                paymentDate: { gte: startDate }
            },
            select: {
                amount: true,
                paymentDate: true,
                paymentMode: true
            },
            orderBy: { paymentDate: 'asc' }
        });

        // Group by month or week
        const trends = new Map<string, { period: string; amount: number; count: number }>();

        payments.forEach(payment => {
            const date = new Date(payment.paymentDate);
            let key: string;
            let period: string;

            if (groupBy === 'week') {
                const weekNum = Math.ceil(date.getDate() / 7);
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${weekNum}`;
                period = `Week ${weekNum}, ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                period = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            }

            if (!trends.has(key)) {
                trends.set(key, { period, amount: 0, count: 0 });
            }
            const trend = trends.get(key)!;
            trend.amount += Number(payment.amount);
            trend.count++;
        });

        const result = Array.from(trends.values());
        const totalCollected = result.reduce((sum, t) => sum + t.amount, 0);
        const avgCollection = result.length > 0 ? totalCollected / result.length : 0;

        res.json({
            trends: result,
            summary: {
                totalCollected,
                avgCollection,
                totalPayments: payments.length,
                periods: result.length
            }
        });
    } catch (error: any) {
        console.error('Collection trends error:', error);
        res.status(500).json({ error: 'Failed to generate collection trends' });
    }
};

/**
 * Get Payment Mode Analysis
 */
export const getPaymentModeAnalysis = async (req: Request, res: Response) => {
    try {
        const { fromDate, toDate } = req.query;
        const where: any = {};

        if (fromDate || toDate) {
            where.paymentDate = {};
            if (fromDate) where.paymentDate.gte = new Date(String(fromDate));
            if (toDate) where.paymentDate.lte = new Date(String(toDate));
        }

        const payments = await prisma.aRPaymentHistory.findMany({
            where,
            select: {
                amount: true,
                paymentMode: true
            }
        });

        const modeMap = new Map<string, { mode: string; count: number; amount: number }>();

        payments.forEach(payment => {
            const mode = payment.paymentMode || 'OTHER';
            if (!modeMap.has(mode)) {
                modeMap.set(mode, { mode, count: 0, amount: 0 });
            }
            const data = modeMap.get(mode)!;
            data.count++;
            data.amount += Number(payment.amount);
        });

        const result = Array.from(modeMap.values());
        const totalAmount = result.reduce((sum, m) => sum + m.amount, 0);

        const modesWithPercentage = result.map(m => ({
            ...m,
            percentage: totalAmount > 0 ? ((m.amount / totalAmount) * 100).toFixed(1) : '0'
        })).sort((a, b) => b.amount - a.amount);

        res.json({
            modes: modesWithPercentage,
            total: {
                count: payments.length,
                amount: totalAmount
            }
        });
    } catch (error: any) {
        console.error('Payment mode analysis error:', error);
        res.status(500).json({ error: 'Failed to generate payment mode analysis' });
    }
};

/**
 * Get Bank-wise Collections
 */
export const getBankwiseCollections = async (req: Request, res: Response) => {
    try {
        const { fromDate, toDate } = req.query;
        const where: any = {};

        if (fromDate || toDate) {
            where.paymentDate = {};
            if (fromDate) where.paymentDate.gte = new Date(String(fromDate));
            if (toDate) where.paymentDate.lte = new Date(String(toDate));
        }

        const payments = await prisma.aRPaymentHistory.findMany({
            where,
            select: {
                amount: true,
                referenceBank: true,
                paymentDate: true
            }
        });

        const bankMap = new Map<string, { bank: string; count: number; amount: number }>();

        payments.forEach(payment => {
            const bank = payment.referenceBank || 'Not Specified';
            if (!bankMap.has(bank)) {
                bankMap.set(bank, { bank, count: 0, amount: 0 });
            }
            const data = bankMap.get(bank)!;
            data.count++;
            data.amount += Number(payment.amount);
        });

        const result = Array.from(bankMap.values()).sort((a, b) => b.amount - a.amount);
        const totalAmount = result.reduce((sum, b) => sum + b.amount, 0);

        const banksWithPercentage = result.map(b => ({
            ...b,
            percentage: totalAmount > 0 ? ((b.amount / totalAmount) * 100).toFixed(1) : '0'
        }));

        res.json({
            banks: banksWithPercentage,
            total: {
                count: payments.length,
                amount: totalAmount
            }
        });
    } catch (error: any) {
        console.error('Bank-wise collections error:', error);
        res.status(500).json({ error: 'Failed to generate bank-wise collections' });
    }
};

/**
 * Get DSO (Days Sales Outstanding) Report
 */
export const getDSOReport = async (req: Request, res: Response) => {
    try {
        const { months = 6 } = req.query;
        const today = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - Number(months));

        // Get invoices created in the period
        const invoices = await prisma.aRInvoice.findMany({
            where: {
                invoiceDate: { gte: startDate },
                NOT: { milestoneStatus: 'LINKED' }
            },
            select: {
                totalAmount: true,
                balance: true,
                invoiceDate: true,
                status: true
            }
        });

        // Group by month
        const monthlyData = new Map<string, {
            period: string;
            totalSales: number;
            endingReceivables: number;
            dso: number;
        }>();

        invoices.forEach(inv => {
            const date = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const period = date.toLocaleString('default', { month: 'short', year: 'numeric' });

            if (!monthlyData.has(key)) {
                monthlyData.set(key, { period, totalSales: 0, endingReceivables: 0, dso: 0 });
            }
            const data = monthlyData.get(key)!;
            data.totalSales += Number(inv.totalAmount);
            if (inv.status !== 'PAID') {
                data.endingReceivables += Number(inv.balance || 0);
            }
        });

        // Calculate DSO for each month (DSO = (Receivables / Sales) * Days in Period)
        const result = Array.from(monthlyData.values()).map(data => {
            data.dso = data.totalSales > 0 ? Math.round((data.endingReceivables / data.totalSales) * 30) : 0;
            return data;
        });

        // Current overall DSO
        const totalReceivables = result.reduce((sum, d) => sum + d.endingReceivables, 0);
        const avgMonthlySales = result.length > 0 ? result.reduce((sum, d) => sum + d.totalSales, 0) / result.length : 0;
        const currentDSO = avgMonthlySales > 0 ? Math.round((totalReceivables / avgMonthlySales) * 30) : 0;

        res.json({
            monthly: result,
            current: {
                dso: currentDSO,
                totalReceivables,
                avgMonthlySales,
                status: currentDSO <= 30 ? 'GOOD' : currentDSO <= 60 ? 'AVERAGE' : 'BAD'
            }
        });
    } catch (error: any) {
        console.error('DSO report error:', error);
        res.status(500).json({ error: 'Failed to generate DSO report' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER REPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get Top Outstanding Customers
 */
export const getTopOutstandingCustomers = async (req: Request, res: Response) => {
    try {
        const { limit = 10 } = req.query;

        const invoices = await prisma.aRInvoice.findMany({
            where: { 
                status: { not: 'PAID' },
                NOT: { milestoneStatus: 'LINKED' }
            },
            select: {
                bpCode: true,
                customerName: true,
                balance: true,
                riskClass: true,
                region: true
            }
        });

        // Group by customer
        const customerMap = new Map<string, {
            bpCode: string;
            customerName: string;
            invoiceCount: number;
            totalBalance: number;
            riskClass: string;
            region: string | null;
        }>();

        invoices.forEach(inv => {
            const key = inv.bpCode;
            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    bpCode: inv.bpCode,
                    customerName: inv.customerName,
                    invoiceCount: 0,
                    totalBalance: 0,
                    riskClass: inv.riskClass,
                    region: inv.region
                });
            }
            const customer = customerMap.get(key)!;
            customer.invoiceCount++;
            customer.totalBalance += Number(inv.balance || 0);
        });

        const result = Array.from(customerMap.values())
            .sort((a, b) => b.totalBalance - a.totalBalance)
            .slice(0, Number(limit));

        const totalBalance = result.reduce((sum, c) => sum + c.totalBalance, 0);
        const overallTotal = Array.from(customerMap.values()).reduce((sum, c) => sum + c.totalBalance, 0);

        res.json({
            customers: result.map((c, i) => ({
                rank: i + 1,
                ...c,
                percentage: overallTotal > 0 ? ((c.totalBalance / overallTotal) * 100).toFixed(1) : '0'
            })),
            summary: {
                topCustomersBalance: totalBalance,
                totalOutstanding: overallTotal,
                concentration: overallTotal > 0 ? ((totalBalance / overallTotal) * 100).toFixed(1) : '0'
            }
        });
    } catch (error: any) {
        console.error('Top outstanding customers error:', error);
        res.status(500).json({ error: 'Failed to generate top outstanding customers report' });
    }
};

/**
 * Get Customer Risk Distribution Report
 */
export const getCustomerRiskReport = async (req: Request, res: Response) => {
    try {
        const invoices = await prisma.aRInvoice.findMany({
            where: { 
                status: { not: 'PAID' },
                NOT: { milestoneStatus: 'LINKED' }
            },
            select: {
                bpCode: true,
                customerName: true,
                balance: true,
                riskClass: true
            }
        });

        // Group by customer with highest risk
        const customerMap = new Map<string, {
            bpCode: string;
            customerName: string;
            riskClass: string;
            totalBalance: number;
        }>();

        const riskPriority = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

        invoices.forEach(inv => {
            const key = inv.bpCode;
            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    bpCode: inv.bpCode,
                    customerName: inv.customerName,
                    riskClass: inv.riskClass,
                    totalBalance: 0
                });
            }
            const customer = customerMap.get(key)!;
            customer.totalBalance += Number(inv.balance || 0);

            // Update to highest risk
            const currentPriority = riskPriority[customer.riskClass as keyof typeof riskPriority] || 1;
            const newPriority = riskPriority[inv.riskClass as keyof typeof riskPriority] || 1;
            if (newPriority > currentPriority) {
                customer.riskClass = inv.riskClass;
            }
        });

        // Group by risk class
        const riskDistribution = {
            LOW: { count: 0, balance: 0, customers: [] as string[] },
            MEDIUM: { count: 0, balance: 0, customers: [] as string[] },
            HIGH: { count: 0, balance: 0, customers: [] as string[] },
            CRITICAL: { count: 0, balance: 0, customers: [] as string[] }
        };

        customerMap.forEach(customer => {
            const risk = customer.riskClass as keyof typeof riskDistribution;
            if (riskDistribution[risk]) {
                riskDistribution[risk].count++;
                riskDistribution[risk].balance += customer.totalBalance;
                if (riskDistribution[risk].customers.length < 5) {
                    riskDistribution[risk].customers.push(customer.customerName);
                }
            }
        });

        const totalBalance = Object.values(riskDistribution).reduce((sum, r) => sum + r.balance, 0);

        res.json({
            distribution: Object.entries(riskDistribution).map(([risk, data]) => ({
                riskClass: risk,
                ...data,
                percentage: totalBalance > 0 ? ((data.balance / totalBalance) * 100).toFixed(1) : '0'
            })),
            summary: {
                totalCustomers: customerMap.size,
                highRiskCount: riskDistribution.HIGH.count + riskDistribution.CRITICAL.count,
                highRiskBalance: riskDistribution.HIGH.balance + riskDistribution.CRITICAL.balance,
                totalBalance
            }
        });
    } catch (error: any) {
        console.error('Customer risk report error:', error);
        res.status(500).json({ error: 'Failed to generate customer risk report' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE REPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get Invoice Status Summary
 */
export const getInvoiceStatusSummary = async (req: Request, res: Response) => {
    try {
        const { fromDate, toDate } = req.query;
        const where: any = {};

        if (fromDate || toDate) {
            where.invoiceDate = {};
            if (fromDate) where.invoiceDate.gte = new Date(String(fromDate));
            if (toDate) where.invoiceDate.lte = new Date(String(toDate));
        }

        const invoices = await prisma.aRInvoice.findMany({
            where: {
                ...where,
                NOT: { milestoneStatus: 'LINKED' }
            },
            select: {
                status: true,
                totalAmount: true,
                balance: true
            }
        });

        const statusMap = {
            PENDING: { count: 0, totalAmount: 0, balance: 0 },
            PARTIAL: { count: 0, totalAmount: 0, balance: 0 },
            PAID: { count: 0, totalAmount: 0, balance: 0 },
            OVERDUE: { count: 0, totalAmount: 0, balance: 0 },
            CANCELLED: { count: 0, totalAmount: 0, balance: 0 }
        };

        invoices.forEach(inv => {
            const status = inv.status as keyof typeof statusMap;
            if (statusMap[status]) {
                statusMap[status].count++;
                statusMap[status].totalAmount += Number(inv.totalAmount);
                statusMap[status].balance += Number(inv.balance || 0);
            }
        });

        const totalCount = invoices.length;
        const totalAmount = Object.values(statusMap).reduce((sum, s) => sum + s.totalAmount, 0);

        res.json({
            statuses: Object.entries(statusMap).map(([status, data]) => ({
                status,
                ...data,
                countPercentage: totalCount > 0 ? ((data.count / totalCount) * 100).toFixed(1) : '0',
                amountPercentage: totalAmount > 0 ? ((data.totalAmount / totalAmount) * 100).toFixed(1) : '0'
            })),
            summary: {
                totalInvoices: totalCount,
                totalAmount,
                paidAmount: statusMap.PAID.totalAmount,
                pendingAmount: statusMap.PENDING.balance + statusMap.PARTIAL.balance,
                collectionRate: totalAmount > 0 ? ((statusMap.PAID.totalAmount / totalAmount) * 100).toFixed(1) : '0'
            }
        });
    } catch (error: any) {
        console.error('Invoice status summary error:', error);
        res.status(500).json({ error: 'Failed to generate invoice status summary' });
    }
};

/**
 * Get Milestone Analysis Report
 */
export const getMilestoneAnalysisReport = async (req: Request, res: Response) => {
    try {
        const invoices = await prisma.aRInvoice.findMany({
            select: {
                invoiceType: true,
                milestoneStatus: true,
                totalAmount: true,
                balance: true,
                status: true
            }
        });

        const typeAnalysis = {
            REGULAR: { count: 0, totalAmount: 0, balance: 0, paid: 0 },
            MILESTONE: { count: 0, totalAmount: 0, balance: 0, paid: 0 }
        };

        const milestoneStatusAnalysis = {
            AWAITING_DELIVERY: { count: 0, amount: 0 },
            PARTIALLY_DELIVERED: { count: 0, amount: 0 },
            FULLY_DELIVERED: { count: 0, amount: 0 },
            EXPIRED: { count: 0, amount: 0 },
            LINKED: { count: 0, amount: 0 }
        };

        invoices.forEach(inv => {
            const type = inv.invoiceType as keyof typeof typeAnalysis;
            if (typeAnalysis[type]) {
                typeAnalysis[type].count++;
                typeAnalysis[type].totalAmount += Number(inv.totalAmount);
                typeAnalysis[type].balance += Number(inv.balance || 0);
                if (inv.status === 'PAID') {
                    typeAnalysis[type].paid++;
                }
            }

            if (inv.invoiceType === 'MILESTONE' && inv.milestoneStatus) {
                const status = inv.milestoneStatus as keyof typeof milestoneStatusAnalysis;
                if (milestoneStatusAnalysis[status]) {
                    milestoneStatusAnalysis[status].count++;
                    milestoneStatusAnalysis[status].amount += Number(inv.totalAmount);
                }
            }
        });

        res.json({
            byType: Object.entries(typeAnalysis).map(([type, data]) => ({
                type,
                ...data,
                paidPercentage: data.count > 0 ? ((data.paid / data.count) * 100).toFixed(1) : '0'
            })),
            milestoneStatuses: Object.entries(milestoneStatusAnalysis).map(([status, data]) => ({
                status,
                ...data
            })).filter(s => s.count > 0),
            summary: {
                totalInvoices: invoices.length,
                regularCount: typeAnalysis.REGULAR.count,
                milestoneCount: typeAnalysis.MILESTONE.count,
                milestonePercentage: invoices.length > 0 ? ((typeAnalysis.MILESTONE.count / invoices.length) * 100).toFixed(1) : '0'
            }
        });
    } catch (error: any) {
        console.error('Milestone analysis error:', error);
        res.status(500).json({ error: 'Failed to generate milestone analysis report' });
    }
};

/**
 * Get Delivery Status Report
 */
export const getDeliveryStatusReport = async (req: Request, res: Response) => {
    try {
        const invoices = await prisma.aRInvoice.findMany({
            where: { status: { not: 'PAID' } },
            select: {
                deliveryStatus: true,
                totalAmount: true,
                balance: true,
                customerName: true
            }
        });

        const deliveryMap = {
            PENDING: { count: 0, amount: 0 },
            SENT: { count: 0, amount: 0 },
            DELIVERED: { count: 0, amount: 0 },
            ACKNOWLEDGED: { count: 0, amount: 0 }
        };

        invoices.forEach(inv => {
            const status = inv.deliveryStatus as keyof typeof deliveryMap;
            if (deliveryMap[status]) {
                deliveryMap[status].count++;
                deliveryMap[status].amount += Number(inv.balance || 0);
            }
        });

        const totalCount = invoices.length;
        const totalAmount = Object.values(deliveryMap).reduce((sum, d) => sum + d.amount, 0);

        res.json({
            statuses: Object.entries(deliveryMap).map(([status, data]) => ({
                status,
                ...data,
                percentage: totalCount > 0 ? ((data.count / totalCount) * 100).toFixed(1) : '0'
            })),
            summary: {
                totalPending: deliveryMap.PENDING.count,
                totalDelivered: deliveryMap.DELIVERED.count + deliveryMap.ACKNOWLEDGED.count,
                pendingAmount: deliveryMap.PENDING.amount + deliveryMap.SENT.amount,
                deliveredAmount: deliveryMap.DELIVERED.amount + deliveryMap.ACKNOWLEDGED.amount
            }
        });
    } catch (error: any) {
        console.error('Delivery status report error:', error);
        res.status(500).json({ error: 'Failed to generate delivery status report' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export const getAgingReport = getDetailedAgingReport;

export const getCollectionEfficiency = async (req: Request, res: Response) => {
    try {
        const { fromDate, toDate } = req.query;
        const where: any = {};
        if (fromDate || toDate) {
            where.paymentDate = {};
            if (fromDate) where.paymentDate.gte = new Date(String(fromDate));
            if (toDate) where.paymentDate.lte = new Date(String(toDate));
        }

        const payments = await prisma.aRPaymentHistory.findMany({
            where,
            orderBy: { paymentDate: 'desc' }
        });

        res.json(payments);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate collection report' });
    }
};
