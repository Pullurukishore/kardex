import { Request, Response } from 'express';
import prisma from '../../config/db';

/**
 * Get Vendor Master Audit Report
 * Returns all bank account details enriched with attachment counts and status
 */
export const getVendorMasterAudit = async (req: Request, res: Response) => {
    try {
        const { search, activeOnly, msmeOnly } = req.query;

        const where: any = {};
        if (activeOnly === 'true') where.isActive = true;
        if (msmeOnly === 'true') where.isMSME = true;
        if (search) {
            where.OR = [
                { vendorName: { contains: String(search), mode: 'insensitive' } },
                { bpCode: { contains: String(search), mode: 'insensitive' } },
                { beneficiaryBankName: { contains: String(search), mode: 'insensitive' } },
                { accountNumber: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const accounts = await prisma.bankAccount.findMany({
            where,
            orderBy: { vendorName: 'asc' },
            include: {
                attachments: {
                    select: {
                        id: true,
                        filename: true,
                        mimeType: true,
                        vendorType: true,
                        createdAt: true
                    }
                },
                _count: {
                    select: {
                        changeRequests: true,
                        attachments: true
                    }
                }
            }
        });

        const reportData = accounts.map((acc: any) => ({
            ...acc,
            kycStatus: acc.attachments && acc.attachments.length > 0 ? 'VERIFIED' : 'PENDING',
            hasMSME: acc.isMSME ? 'Yes' : 'No',
            documentCount: acc._count?.attachments || 0
        }));

        res.json({
            data: reportData,
            summary: {
                totalAccounts: reportData.length,
                verifiedAccounts: reportData.filter(a => a.kycStatus === 'VERIFIED').length,
                pendingAccounts: reportData.filter(a => a.kycStatus === 'PENDING').length,
                msmeAccounts: reportData.filter(a => a.isMSME).length
            }
        });
    } catch (error: any) {
        console.error('Vendor master audit error:', error);
        res.status(500).json({ error: 'Failed to generate vendor master audit report', message: error.message });
    }
};

/**
 * Get Compliance & Data Health Metrics
 */
export const getComplianceMetrics = async (req: Request, res: Response) => {
    try {
        const [total, verified, msme, domestic, international] = await Promise.all([
            prisma.bankAccount.count(),
            prisma.bankAccount.count({ where: { attachments: { some: {} } } }),
            prisma.bankAccount.count({ where: { isMSME: true } }),
            prisma.bankAccount.count({ where: { accountCategory: 'DOMESTIC' } }),
            prisma.bankAccount.count({ where: { accountCategory: 'INTERNATIONAL' } })
        ]);

        const totalInR = await prisma.bankAccount.count({ where: { currency: 'INR' } });
        
        // Data completeness checks
        const missingBpCode = await prisma.bankAccount.count({ where: { bpCode: null } });
        const missingTaxId = await prisma.bankAccount.count({ 
            where: { 
                OR: [
                    { panNumber: null },
                    { gstNumber: null }
                ],
                currency: 'INR',
                accountCategory: { not: 'INTERNATIONAL' }
            } 
        });

        res.json({
            compliance: {
                kycRate: total > 0 ? ((verified / total) * 100).toFixed(1) : '0',
                msmeRate: total > 0 ? ((msme / total) * 100).toFixed(1) : '0',
                total,
                verified,
                pending: total - verified
            },
            distribution: {
                domestic,
                international,
                msme,
                nonMsme: total - msme,
                inr: totalInR,
                otherCurrency: total - totalInR
            },
            health: {
                missingBpCode,
                missingTaxId,
                totalIssues: missingBpCode + missingTaxId
            }
        });
    } catch (error: any) {
        console.error('Compliance metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch compliance metrics' });
    }
};

/**
 * Get Payment Volume Insights
 */
export const getPaymentVolumeInsights = async (req: Request, res: Response) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Number(days));

        const batchItems = await prisma.paymentBatchItem.findMany({
            where: {
                status: 'APPROVED',
                batch: { requestedAt: { gte: startDate } }
            },
            select: {
                amount: true,
                bankName: true,
                transactionMode: true,
                batch: { select: { requestedAt: true } }
            }
        });

        // Group by Bank
        const bankMap = new Map<string, { name: string; amount: number; count: number }>();
        const modeMap = new Map<string, { mode: string; amount: number; count: number }>();

        batchItems.forEach(item => {
            const amount = Number(item.amount);
            
            // Bank aggregation
            const bank = item.bankName || 'Unknown Bank';
            if (!bankMap.has(bank)) bankMap.set(bank, { name: bank, amount: 0, count: 0 });
            const bData = bankMap.get(bank)!;
            bData.amount += amount;
            bData.count++;

            // Mode aggregation
            const mode = item.transactionMode || 'OTHER';
            if (!modeMap.has(mode)) modeMap.set(mode, { mode, amount: 0, count: 0 });
            const mData = modeMap.get(mode)!;
            mData.amount += amount;
            mData.count++;
        });

        res.json({
            banks: Array.from(bankMap.values()).sort((a, b) => b.amount - a.amount),
            modes: Array.from(modeMap.values()).sort((a, b) => b.amount - a.amount),
            summary: {
                totalAmount: batchItems.reduce((sum, i) => sum + Number(i.amount), 0),
                totalItems: batchItems.length
            }
        });
    } catch (error: any) {
        console.error('Payment volume insights error:', error);
        res.status(500).json({ error: 'Failed to fetch payment volume insights' });
    }
};
