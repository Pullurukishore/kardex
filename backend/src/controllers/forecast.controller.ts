import { Response } from 'express';
import { prisma } from '../config/db';
import { ProductType } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { toNumber } from '../utils/dateUtils';



interface ZoneSummary {
    zoneId: number;
    zoneName: string;
    noOfOffers: number;
    offersValue: number;
    ordersReceived: number;
    openFunnel: number;
    orderBooking: number;
    uForBooking: number;
    hitRatePercent: number;
    balanceBU: number;
    yearlyTarget: number;
}

interface MonthlyData {
    month: string;
    monthLabel: string;
    noOfOffers: number;
    offersValue: number;
    orderReceived: number;
    ordersBooked: number;
    devORvsBooked: number;
    ordersInHand: number;
    buMonthly: number;
    bookedVsBU: number | null;
    percentDev: number | null;
    offerBUMonth: number;
    offerBUMonthDev: number | null;
}

interface ZoneMonthlyBreakdown {
    zoneId: number;
    zoneName: string;
    hitRate: number;
    yearlyTarget: number;
    monthlyData: MonthlyData[];
    productBreakdown?: {
        productType: string;
        productLabel: string;
        monthlyData: {
            month: string;
            monthLabel: string;
            offersValue: number;
            orderReceived: number;
            ordersInHand: number;
        }[];
        totals: {
            offersValue: number;
            orderReceived: number;
            ordersInHand: number;
        };
    }[];
    totals: {
        offersValue: number;
        orderReceived: number;
        ordersBooked: number;
        ordersInHand: number;
        buMonthly: number;
        offerBUMonth: number;
    };
}

export class ForecastController {
    // Wrapper methods
    static async getZoneSummaryWrapper(req: any, res: Response) {
        return ForecastController.getZoneSummary(req as AuthenticatedRequest, res);
    }

    static async getMonthlyBreakdownWrapper(req: any, res: Response) {
        return ForecastController.getMonthlyBreakdown(req as AuthenticatedRequest, res);
    }

    static async getPOExpectedMonthWrapper(req: any, res: Response) {
        return ForecastController.getPOExpectedMonthBreakdown(req as AuthenticatedRequest, res);
    }

    /**
     * Get PO Expected Month Breakdown - Zone-wise and User-wise
     * Returns monthly data for each zone with user breakdown
     * Filters by probability percentage if specified
     */
    static async getPOExpectedMonthBreakdown(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, minProbability, maxProbability, zoneId, userId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const minProb = minProbability ? parseInt(minProbability as string) : 0;
            const maxProb = maxProbability ? parseInt(maxProbability as string) : 100;
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;
            const filterUserId = userId ? parseInt(userId as string) : null;

            const monthNames = [
                'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
            ];

            // Get zones
            const zones = await prisma.serviceZone.findMany({
                where: {
                    isActive: true,
                    ...(filterZoneId && { id: filterZoneId }),
                },
                orderBy: { name: 'asc' },
            });

            interface UserMonthlyData {
                userId: number;
                userName: string;
                monthlyValues: { [month: string]: number };
                total: number;
            }

            interface ZonePOData {
                zoneId: number;
                zoneName: string;
                users: UserMonthlyData[];
                monthlyTotals: { [month: string]: number };
                grandTotal: number;
            }

            const zoneData: ZonePOData[] = [];

            for (const zone of zones) {
                // Get users for this zone:
                // 1. ZONE_MANAGER and ZONE_USER linked via ServicePersonZone junction table
                // 2. ADMINs only if they have offers in this zone
                // Users without offers will still appear (initialized with zero values)
                const usersInZone = await prisma.user.findMany({
                    where: {
                        isActive: true,
                        OR: [
                            // Zone Managers and Zone Users linked via serviceZones junction table
                            {
                                role: { in: ['ZONE_MANAGER', 'ZONE_USER'] },
                                serviceZones: {
                                    some: {
                                        serviceZoneId: zone.id,
                                    }
                                }
                            },
                            // Admins only if they have created offers in this zone
                            {
                                role: 'ADMIN',
                                createdOffers: {
                                    some: {
                                        zoneId: zone.id,
                                    }
                                }
                            },
                            // Admins only if they are assigned offers in this zone
                            {
                                role: 'ADMIN',
                                assignedOffers: {
                                    some: {
                                        zoneId: zone.id,
                                    }
                                }
                            },
                        ],
                    },
                    select: {
                        id: true,
                        name: true,
                        shortForm: true,
                        role: true,
                    },
                    orderBy: { name: 'asc' },
                });

                // Get all offers for this zone with poExpectedMonth in target year
                const offers = await prisma.offer.findMany({
                    where: {
                        zoneId: zone.id,
                        poExpectedMonth: {
                            startsWith: `${targetYear}-`,
                        },
                        stage: { notIn: ['LOST'] }, // Exclude lost offers
                        // User filter - filter by assignedToId or createdById
                        ...(filterUserId && {
                            OR: [
                                { assignedToId: filterUserId },
                                { createdById: filterUserId }
                            ]
                        }),
                        // Probability filter
                        ...(minProb > 0 || maxProb < 100) && {
                            probabilityPercentage: {
                                gte: minProb,
                                lte: maxProb,
                            }
                        },
                    },
                    select: {
                        id: true,
                        offerValue: true,
                        poExpectedMonth: true,
                        assignedToId: true,
                        createdById: true,
                        probabilityPercentage: true,
                        stage: true,
                    },
                });

                // Group by user
                const userMap = new Map<number, UserMonthlyData>();
                const monthlyTotals: { [month: string]: number } = {};

                // Initialize monthly totals
                for (let m = 1; m <= 12; m++) {
                    const monthKey = monthNames[m - 1];
                    monthlyTotals[monthKey] = 0;
                }

                // Initialize ALL users in the zone with zero values (so they appear even without offers)
                for (const user of usersInZone) {
                    const monthlyValues: { [month: string]: number } = {};
                    for (let m = 1; m <= 12; m++) {
                        monthlyValues[monthNames[m - 1]] = 0;
                    }
                    userMap.set(user.id, {
                        userId: user.id,
                        userName: user.name || user.shortForm || `User ${user.id}`,
                        monthlyValues,
                        total: 0,
                    });
                }

                // Now add offer values to users
                for (const offer of offers) {
                    const userId = offer.assignedToId || offer.createdById;
                    const value = toNumber(offer.offerValue);

                    if (!offer.poExpectedMonth) continue;

                    // Extract month from poExpectedMonth (format: "YYYY-MM")
                    const monthNum = parseInt(offer.poExpectedMonth.split('-')[1]);
                    const monthKey = monthNames[monthNum - 1];

                    // If user not in zone but has offers (assigned from elsewhere), add them
                    if (!userMap.has(userId)) {
                        const monthlyValues: { [month: string]: number } = {};
                        for (let m = 1; m <= 12; m++) {
                            monthlyValues[monthNames[m - 1]] = 0;
                        }
                        userMap.set(userId, {
                            userId,
                            userName: `User ${userId}`,
                            monthlyValues,
                            total: 0,
                        });
                    }

                    const userData = userMap.get(userId)!;
                    userData.monthlyValues[monthKey] = (userData.monthlyValues[monthKey] || 0) + value;
                    userData.total += value;

                    // Add to monthly totals
                    monthlyTotals[monthKey] += value;
                }

                // Calculate grand total
                const grandTotal = Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0);

                // Sort users by name
                const usersArray = Array.from(userMap.values()).sort((a, b) =>
                    a.userName.localeCompare(b.userName)
                );

                zoneData.push({
                    zoneId: zone.id,
                    zoneName: zone.name,
                    users: usersArray,
                    monthlyTotals,
                    grandTotal,
                });
            }

            // Calculate overall totals
            const overallMonthlyTotals: { [month: string]: number } = {};
            for (let m = 1; m <= 12; m++) {
                const monthKey = monthNames[m - 1];
                overallMonthlyTotals[monthKey] = zoneData.reduce(
                    (sum, z) => sum + (z.monthlyTotals[monthKey] || 0), 0
                );
            }
            const overallGrandTotal = zoneData.reduce((sum, z) => sum + z.grandTotal, 0);

            // Calculate quarterly BU from yearly ZoneTarget (yearly target / 3)
            // Only use OVERALL targets (productType = null), NOT product-specific ones
            const yearlyTargets = await prisma.zoneTarget.findMany({
                where: {
                    targetPeriod: String(targetYear),
                    periodType: 'YEARLY',
                    productType: null, // Only overall targets, not product-specific
                    ...(filterZoneId && { serviceZoneId: filterZoneId }),
                },
                select: {
                    serviceZoneId: true,
                    targetValue: true,
                },
            });

            // Sum all overall yearly targets (no double counting with product targets)
            const totalYearlyTarget = yearlyTargets.reduce(
                (sum, t) => sum + Number(t.targetValue || 0), 0
            );

            // Quarterly BU = Yearly Target / 3
            const quarterlyBU = totalYearlyTarget / 3;

            // Calculate quarterly forecasts (sum of months in each quarter)
            const quarterlyData = [
                {
                    name: 'Q1',
                    label: 'Q1 Forecast',
                    months: ['JAN', 'FEB', 'MAR'],
                    forecast: (overallMonthlyTotals['JAN'] || 0) + (overallMonthlyTotals['FEB'] || 0) + (overallMonthlyTotals['MAR'] || 0),
                    bu: quarterlyBU,
                    deviation: 0,
                },
                {
                    name: 'Q2',
                    label: 'Q2 Forecast',
                    months: ['APR', 'MAY', 'JUN'],
                    forecast: (overallMonthlyTotals['APR'] || 0) + (overallMonthlyTotals['MAY'] || 0) + (overallMonthlyTotals['JUN'] || 0),
                    bu: quarterlyBU,
                    deviation: 0,
                },
                {
                    name: 'Q3',
                    label: 'Q3 Forecast',
                    months: ['JUL', 'AUG', 'SEP'],
                    forecast: (overallMonthlyTotals['JUL'] || 0) + (overallMonthlyTotals['AUG'] || 0) + (overallMonthlyTotals['SEP'] || 0),
                    bu: quarterlyBU,
                    deviation: 0,
                },
                {
                    name: 'Q4',
                    label: 'Q4 Forecast',
                    months: ['OCT', 'NOV', 'DEC'],
                    forecast: (overallMonthlyTotals['OCT'] || 0) + (overallMonthlyTotals['NOV'] || 0) + (overallMonthlyTotals['DEC'] || 0),
                    bu: quarterlyBU,
                    deviation: 0,
                },
            ];

            // Calculate deviation for each quarter
            quarterlyData.forEach(q => {
                q.deviation = q.bu > 0 ? ((q.forecast - q.bu) / q.bu) * 100 : 0;
            });

            return res.json({
                year: targetYear,
                filters: {
                    minProbability: minProb,
                    maxProbability: maxProb,
                    zoneId: filterZoneId,
                },
                zones: zoneData,
                overallTotals: {
                    monthlyTotals: overallMonthlyTotals,
                    grandTotal: overallGrandTotal,
                },
                months: monthNames,
                // Quarterly data with BU from yearly targets
                quarterlyData,
                yearlyTarget: totalYearlyTarget,
                quarterlyBU,
            });
        } catch (error: any) {
            logger.error('Get PO Expected Month breakdown error:', error);
            return res.status(500).json({ error: 'Failed to fetch PO Expected Month data' });
        }
    }

    /**
     * Get Zone-wise Offers Summary (Offers Highlights section)
     * Returns: Zone, No. of Offers, Offers Value, Orders Received, Open Funnel,
     *          Order Booking, U for Booking, %, Balance BU
     */
    static async getZoneSummary(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, minProbability, zoneId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const minProb = minProbability ? parseInt(minProbability as string) : 0;
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;

            // Date range for the year
            const yearStart = new Date(targetYear, 0, 1);
            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);
            const currentMonth = new Date().getMonth() + 1;
            const currentMonthStr = `${targetYear}-${String(currentMonth).padStart(2, '0')}`;

            // Get zones (filtered by zoneId if provided)
            const zones = await prisma.serviceZone.findMany({
                where: {
                    isActive: true,
                    ...(filterZoneId && { id: filterZoneId }),
                },
                orderBy: { name: 'asc' },
            });

            const zoneSummaries: ZoneSummary[] = [];

            for (const zone of zones) {
                // Get all offers for this zone in the year
                const [
                    offerCount,
                    offersValueAgg,
                    wonValueAgg,
                    currentMonthBookingAgg,
                    weightedForecastAgg,
                    wonOffers,
                    lostOffers,
                    yearlyTarget,
                ] = await Promise.all([
                    // Count of offers
                    prisma.offer.count({
                        where: {
                            zoneId: zone.id,
                            createdAt: { gte: yearStart, lte: yearEnd },
                        },
                    }),
                    // Total offers value
                    prisma.offer.aggregate({
                        where: {
                            zoneId: zone.id,
                            createdAt: { gte: yearStart, lte: yearEnd },
                        },
                        _sum: { offerValue: true },
                    }),
                    // Orders received (WON and PO_RECEIVED offers) - fetch all to apply fallback logic
                    prisma.offer.findMany({
                        where: {
                            zoneId: zone.id,
                            stage: { in: ['WON', 'PO_RECEIVED'] },
                        },
                        select: {
                            poValue: true,
                            offerValue: true,
                            poReceivedMonth: true,
                            offerMonth: true,
                        },
                    }),
                    // Note: Open Funnel is calculated as (Offers Value - Orders Received) directly
                    // Current month order booking
                    prisma.offer.aggregate({
                        where: {
                            zoneId: zone.id,
                            stage: 'WON',
                            poReceivedMonth: currentMonthStr,
                        },
                        _sum: { poValue: true },
                    }),
                    // Weighted forecast (Expected Revenue) - filtered by probability
                    prisma.offer.findMany({
                        where: {
                            zoneId: zone.id,
                            openFunnel: true,
                            stage: { notIn: ['WON', 'LOST'] },
                            createdAt: { gte: yearStart, lte: yearEnd },
                            ...(minProb > 0 && { probabilityPercentage: { gte: minProb } }),
                        },
                        select: {
                            offerValue: true,
                            probabilityPercentage: true,
                        },
                    }),
                    // Won offers count
                    prisma.offer.count({
                        where: {
                            zoneId: zone.id,
                            stage: 'WON',
                            createdAt: { gte: yearStart, lte: yearEnd },
                        },
                    }),
                    // Lost offers count
                    prisma.offer.count({
                        where: {
                            zoneId: zone.id,
                            stage: 'LOST',
                            createdAt: { gte: yearStart, lte: yearEnd },
                        },
                    }),
                    // Yearly targets - fetch ALL (overall and product-specific)
                    prisma.zoneTarget.findMany({
                        where: {
                            serviceZoneId: zone.id,
                            targetPeriod: String(targetYear),
                            periodType: 'YEARLY',
                        },
                    }),
                ]);

                // Calculate yearly target: use overall if exists, else sum product-specific
                const overallTarget = (yearlyTarget as any[]).find(t => t.productType === null || t.productType === undefined);
                const productTargets = (yearlyTarget as any[]).filter(t => t.productType !== null && t.productType !== undefined);
                let yearlyTargetValue: number;
                if (overallTarget) {
                    yearlyTargetValue = toNumber(overallTarget.targetValue);
                } else {
                    yearlyTargetValue = productTargets.reduce((sum, t) => sum + toNumber(t.targetValue), 0);
                }

                const offersValue = toNumber(offersValueAgg._sum.offerValue);

                // Calculate ordersReceived with fallback logic:
                // 1. Use poReceivedMonth if set, otherwise fall back to offerMonth for the year filter
                // 2. Use poValue if available, otherwise fall back to offerValue
                const targetYearStr = String(targetYear);
                const ordersReceived = (wonValueAgg as any[]).reduce((sum, offer) => {
                    const effectiveMonth = offer.poReceivedMonth || offer.offerMonth;
                    // Check if the offer belongs to the target year
                    if (effectiveMonth && effectiveMonth.startsWith(targetYearStr)) {
                        const value = offer.poValue ? toNumber(offer.poValue) : toNumber(offer.offerValue);
                        return sum + value;
                    }
                    return sum;
                }, 0);

                // Open Funnel = Offers Value - Orders Received (simple subtraction)
                const openFunnel = offersValue - ordersReceived;
                const orderBooking = toNumber(currentMonthBookingAgg._sum.poValue);

                // Expected Revenue (U for Booking) - FULL value for offers meeting probability threshold
                // If minProbability is set, only offers with probability >= minProbability are included
                // The value shown is the FULL offer value, not weighted
                const uForBooking = weightedForecastAgg.reduce((sum, offer) => {
                    const value = toNumber(offer.offerValue);
                    // Include full value if probability meets threshold (or no threshold set)
                    return sum + value;
                }, 0);

                // Hit rate calculation
                const closedOffers = wonOffers + lostOffers;
                const hitRatePercent = offersValue > 0 ? (ordersReceived / offersValue) * 100 : 0;

                // Balance BU = Yearly Target - Orders Received
                const balanceBU = yearlyTargetValue - ordersReceived;

                // Log for debugging if balance seems wrong
                if (yearlyTargetValue > 0) {
                    logger.debug(`Zone ${zone.name}: Target=${yearlyTargetValue}, OrdersReceived=${ordersReceived}, BalanceBU=${balanceBU}`);
                }

                zoneSummaries.push({
                    zoneId: zone.id,
                    zoneName: zone.name,
                    noOfOffers: offerCount,
                    offersValue,
                    ordersReceived,
                    openFunnel,
                    orderBooking,
                    uForBooking,
                    hitRatePercent: Math.round(hitRatePercent),
                    balanceBU,
                    yearlyTarget: yearlyTargetValue,
                });
            }

            // Calculate totals
            const totals = {
                noOfOffers: zoneSummaries.reduce((sum, z) => sum + z.noOfOffers, 0),
                offersValue: zoneSummaries.reduce((sum, z) => sum + z.offersValue, 0),
                ordersReceived: zoneSummaries.reduce((sum, z) => sum + z.ordersReceived, 0),
                openFunnel: zoneSummaries.reduce((sum, z) => sum + z.openFunnel, 0),
                orderBooking: zoneSummaries.reduce((sum, z) => sum + z.orderBooking, 0),
                uForBooking: zoneSummaries.reduce((sum, z) => sum + z.uForBooking, 0),
                yearlyTarget: zoneSummaries.reduce((sum, z) => sum + z.yearlyTarget, 0),
                balanceBU: zoneSummaries.reduce((sum, z) => sum + z.balanceBU, 0),
            };

            const totalHitRate = totals.offersValue > 0
                ? (totals.ordersReceived / totals.offersValue) * 100
                : 0;

            return res.json({
                year: targetYear,
                zones: zoneSummaries,
                totals: {
                    ...totals,
                    hitRatePercent: Math.round(totalHitRate),
                },
            });
        } catch (error: any) {
            logger.error('Get forecast zone summary error:', error);
            return res.status(500).json({ error: 'Failed to fetch forecast summary' });
        }
    }

    /**
     * Get Monthly Breakdown for all zones
     * Returns monthly data with targets and deviations
     */
    static async getMonthlyBreakdown(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, productType, zoneId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const filterProductType = productType && productType !== 'ALL' ? productType as ProductType : null;
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;

            const yearStart = new Date(targetYear, 0, 1);
            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            // Get zones (filtered by zoneId if provided)
            const zones = await prisma.serviceZone.findMany({
                where: {
                    isActive: true,
                    ...(filterZoneId && { id: filterZoneId }),
                },
                orderBy: { name: 'asc' },
            });

            const zoneBreakdowns: ZoneMonthlyBreakdown[] = [];

            for (const zone of zones) {
                // Get ALL yearly targets (overall and product-specific)
                const yearlyTargets = await prisma.zoneTarget.findMany({
                    where: {
                        serviceZoneId: zone.id,
                        targetPeriod: String(targetYear),
                        periodType: 'YEARLY',
                    },
                });

                // Calculate yearly target: use overall if exists, else sum product-specific
                const overallTarget = yearlyTargets.find(t => t.productType === null);
                const productTargets = yearlyTargets.filter(t => t.productType !== null);
                let yearlyTargetValue: number;
                if (overallTarget) {
                    yearlyTargetValue = toNumber(overallTarget.targetValue);
                } else {
                    yearlyTargetValue = productTargets.reduce((sum, t) => sum + toNumber(t.targetValue), 0);
                }
                const monthlyBUTarget = yearlyTargetValue / 12;

                // Get monthly targets
                const monthlyTargets = await prisma.zoneTarget.findMany({
                    where: {
                        serviceZoneId: zone.id,
                        targetPeriod: { startsWith: `${targetYear}-` },
                        periodType: 'MONTHLY',
                        productType: null,
                    },
                });

                const monthlyTargetMap = new Map<string, number>();
                monthlyTargets.forEach(t => {
                    monthlyTargetMap.set(t.targetPeriod, Number(t.targetValue));
                });

                // Get all offers for this zone
                const offers = await prisma.offer.findMany({
                    where: {
                        zoneId: zone.id,
                        createdAt: { gte: yearStart, lte: yearEnd },
                        ...(filterProductType && { productType: filterProductType }),
                    },
                    select: {
                        id: true,
                        offerValue: true,
                        poValue: true,
                        stage: true,
                        openFunnel: true,
                        offerMonth: true,
                        poReceivedMonth: true,
                        probabilityPercentage: true,
                        productType: true,
                    },
                });

                // Calculate hit rate for this zone
                const wonOffers = offers.filter(o => o.stage === 'WON').length;
                const lostOffers = offers.filter(o => o.stage === 'LOST').length;
                const closedOffers = wonOffers + lostOffers;
                const totalWonValue = offers
                    .filter(o => o.stage === 'WON')
                    .reduce((sum, o) => sum + (o.poValue ? Number(o.poValue) : 0), 0);
                const totalOffersValue = offers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);
                const hitRate = totalOffersValue > 0 ? Math.round((totalWonValue / totalOffersValue) * 100) : 0;

                const monthlyData: MonthlyData[] = [];
                let totalNoOfOffers = 0;
                let totalOffersValueSum = 0;
                let totalOrderReceived = 0;
                let totalOrdersBooked = 0;
                let totalOrdersInHand = 0;
                let totalBUMonthly = 0;
                let totalOfferBUMonth = 0;

                // Calculate TOTAL offers value from ALL offers in zone (matching Zone Summary logic)
                // This ensures consistency between Zone Summary and Monthly Breakdown totals
                const allOffersValue = offers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                // Calculate total orders received for the zone
                // Use poReceivedMonth if set, otherwise fall back to offerMonth for year filter
                const targetYearStr = String(targetYear);
                const allOrdersReceived = offers
                    .filter(o => o.stage === 'WON')
                    .reduce((sum, o) => {
                        const effectiveMonth = o.poReceivedMonth || o.offerMonth;
                        if (effectiveMonth && effectiveMonth.startsWith(targetYearStr)) {
                            return sum + (o.poValue ? Number(o.poValue) : (o.offerValue ? Number(o.offerValue) : 0));
                        }
                        return sum;
                    }, 0);

                for (let month = 1; month <= 12; month++) {
                    const monthStr = `${targetYear}-${String(month).padStart(2, '0')}`;

                    // Offers for this month (by offerMonth)
                    const monthOffers = offers.filter(o => o.offerMonth === monthStr);
                    const noOfOffers = monthOffers.length;
                    const offersValue = monthOffers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                    // Orders received (won offers in this month)
                    // Use poReceivedMonth if set, otherwise fall back to offerMonth
                    const wonThisMonth = offers.filter(o =>
                        o.stage === 'WON' &&
                        ((o.poReceivedMonth && o.poReceivedMonth === monthStr) ||
                            (!o.poReceivedMonth && o.offerMonth === monthStr))
                    );
                    // Use poValue if available, otherwise fall back to offerValue
                    const orderReceived = wonThisMonth.reduce((sum, o) => {
                        const value = o.poValue ? Number(o.poValue) : (o.offerValue ? Number(o.offerValue) : 0);
                        return sum + value;
                    }, 0);

                    // Orders booked same as order received for now
                    const ordersBooked = orderReceived;

                    // Deviation OR vs Booked
                    const devORvsBooked = orderReceived - ordersBooked;

                    // Orders in hand (open funnel for this month)
                    // Logic: Count only offers created this month that are still OPEN
                    const ordersInHand = monthOffers
                        .filter(o => o.openFunnel === true)
                        .reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                    // Monthly target
                    const buMonthly = monthlyTargetMap.get(monthStr) || monthlyBUTarget;

                    // Booked vs BU (achievement %)
                    const bookedVsBU = buMonthly > 0 ? (ordersBooked / buMonthly) * 100 : null;

                    // % Deviation: ((Actual - Target) / Target) × 100
                    // Standard deviation formula - compares actual orders to monthly target
                    let percentDev: number | null = null;
                    if (buMonthly > 0) {
                        percentDev = ((orderReceived - buMonthly) / buMonthly) * 100;
                    }

                    // Offer BU Month = BU/Monthly × 4
                    const offerBUMonth = buMonthly * 4;

                    // Offer BU Month deviation: (Offers Value - Offer BU Month) / Offer BU Month × 100
                    // Positive = exceeded target, Negative = below target
                    // Only show deviation if there is a target set
                    const offerBUMonthDev = offerBUMonth > 0 ? ((offersValue - offerBUMonth) / offerBUMonth) * 100 : null;

                    monthlyData.push({
                        month: monthStr,
                        monthLabel: monthNames[month - 1],
                        noOfOffers,
                        offersValue,
                        orderReceived,
                        ordersBooked,
                        devORvsBooked,
                        ordersInHand,
                        buMonthly,
                        bookedVsBU: bookedVsBU !== null ? Math.round(bookedVsBU) : null,
                        percentDev: percentDev !== null ? Math.round(percentDev) : null,
                        offerBUMonth,
                        offerBUMonthDev: offerBUMonthDev !== null ? Math.round(offerBUMonthDev) : null,
                    });

                    totalNoOfOffers += noOfOffers;
                    totalOffersValueSum += offersValue;
                    totalOrderReceived += orderReceived;
                    totalOrdersBooked += ordersBooked;
                    totalOrdersInHand += ordersInHand;
                    totalBUMonthly += buMonthly;
                    totalOfferBUMonth += offerBUMonth;
                }

                // Calculate product type breakdown for this zone
                // Using actual ProductType enum values from Prisma schema
                const productTypes = [
                    { key: 'CONTRACT', label: 'Contract' },
                    { key: 'BD_SPARE', label: 'BD Spare' },
                    { key: 'SPARE_PARTS', label: 'Spare Parts' },
                    { key: 'KARDEX_CONNECT', label: 'Kardex Connect' },
                    { key: 'RELOCATION', label: 'Relocation' },
                    { key: 'SOFTWARE', label: 'Software' },
                    { key: 'OTHERS', label: 'Repairs & Others' },
                    { key: 'RETROFIT_KIT', label: 'Retrofit Kit' },
                    { key: 'UPGRADE_KIT', label: 'Optilife Upgrade' },
                ];

                const productBreakdown = await Promise.all(productTypes.map(async (productType) => {
                    const productOffers = offers.filter(o => o.productType === productType.key);

                    // Get product-specific yearly target for this zone
                    const productYearlyTarget = await prisma.zoneTarget.findFirst({
                        where: {
                            serviceZoneId: zone.id,
                            targetPeriod: String(targetYear),
                            periodType: 'YEARLY',
                            productType: productType.key as ProductType,
                        },
                    });
                    const productYearlyTargetValue = productYearlyTarget ? toNumber(productYearlyTarget.targetValue) : 0;
                    const productMonthlyBU = productYearlyTargetValue / 12;
                    const productOfferBU = productMonthlyBU * 4;

                    const productMonthlyData = [];
                    let totalOffersValue = 0;
                    let totalOrderReceived = 0;
                    let totalOrdersInHand = 0;
                    let totalBUMonthly = 0;
                    let totalOfferBUMonth = 0;

                    for (let month = 1; month <= 12; month++) {
                        const monthStr = `${targetYear}-${String(month).padStart(2, '0')}`;

                        // Offers for this month (by offerMonth)
                        const monthOffers = productOffers.filter(o => o.offerMonth === monthStr);
                        const noOfOffers = monthOffers.length;
                        const offersValue = monthOffers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                        // Orders received (won offers in this month)
                        const wonThisMonth = productOffers.filter(o =>
                            o.stage === 'WON' &&
                            ((o.poReceivedMonth && o.poReceivedMonth === monthStr) ||
                                (!o.poReceivedMonth && o.offerMonth === monthStr))
                        );
                        const orderReceived = wonThisMonth.reduce((sum, o) => {
                            const value = o.poValue ? Number(o.poValue) : Number(o.offerValue);
                            return sum + (isNaN(value) ? 0 : value);
                        }, 0);

                        // Open funnel for this month
                        const funnelThisMonth = productOffers.filter(o =>
                            o.openFunnel === true && o.offerMonth === monthStr
                        );
                        const ordersInHand = funnelThisMonth.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                        // Calculate deviations
                        const percentDev = productMonthlyBU > 0 ? ((orderReceived - productMonthlyBU) / productMonthlyBU) * 100 : null;
                        const offerBUMonthDev = productOfferBU > 0 ? ((offersValue - productOfferBU) / productOfferBU) * 100 : null;

                        productMonthlyData.push({
                            month: monthStr,
                            monthLabel: monthNames[month - 1],
                            noOfOffers,
                            offersValue,
                            orderReceived,
                            ordersInHand,
                            buMonthly: productMonthlyBU,
                            percentDev: percentDev !== null ? Math.round(percentDev) : null,
                            offerBUMonth: productOfferBU,
                            offerBUMonthDev: offerBUMonthDev !== null ? Math.round(offerBUMonthDev) : null,
                        });

                        totalOffersValue += offersValue;
                        totalOrderReceived += orderReceived;
                        totalOrdersInHand += ordersInHand;
                        totalBUMonthly += productMonthlyBU;
                        totalOfferBUMonth += productOfferBU;
                    }

                    // Calculate hit rate for this product type
                    const totalProductOffersValue = productOffers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);
                    const totalProductWonValue = productOffers
                        .filter(o => o.stage === 'WON')
                        .reduce((sum, o) => sum + (o.poValue ? Number(o.poValue) : Number(o.offerValue)), 0);
                    const productHitRate = totalProductOffersValue > 0 ? Math.round((totalProductWonValue / totalProductOffersValue) * 100) : 0;

                    return {
                        productType: productType.key,
                        productLabel: productType.label,
                        yearlyTarget: productYearlyTargetValue,
                        hitRate: productHitRate,
                        monthlyData: productMonthlyData,
                        totals: {
                            offersValue: totalOffersValue,
                            orderReceived: totalOrderReceived,
                            ordersInHand: totalOrdersInHand,
                            buMonthly: totalBUMonthly,
                            offerBUMonth: totalOfferBUMonth,
                        },
                    };
                }));

                // Filter to only show products with data
                const filteredProductBreakdown = productBreakdown.filter(p =>
                    p.totals.offersValue > 0 || p.totals.orderReceived > 0 || p.totals.ordersInHand > 0 || p.yearlyTarget > 0
                );

                zoneBreakdowns.push({
                    zoneId: zone.id,
                    zoneName: zone.name,
                    hitRate,
                    yearlyTarget: yearlyTargetValue,
                    monthlyData,
                    productBreakdown: filteredProductBreakdown,
                    totals: {
                        // Use allOffersValue and allOrdersReceived to match Zone Summary
                        // This includes offers without offerMonth set
                        offersValue: allOffersValue,
                        orderReceived: allOrdersReceived,
                        ordersBooked: allOrdersReceived, // Same as orderReceived
                        ordersInHand: offers
                            .filter(o => o.openFunnel === true)
                            .reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0),
                        buMonthly: totalBUMonthly,
                        offerBUMonth: totalOfferBUMonth,
                    },
                });
            }

            return res.json({
                year: targetYear,
                zones: zoneBreakdowns,
            });
        } catch (error: any) {
            logger.error('Get forecast monthly breakdown error:', error);
            return res.status(500).json({ error: 'Failed to fetch monthly breakdown' });
        }
    }

    /**
     * Wrapper for getUserMonthlyBreakdown
     */
    static async getUserMonthlyBreakdownWrapper(req: any, res: Response) {
        return ForecastController.getUserMonthlyBreakdown(req as AuthenticatedRequest, res);
    }

    /**
     * Get Monthly Breakdown for all users (similar to zone breakdown)
     * Returns user-wise monthly data with targets and deviations
     */
    static async getUserMonthlyBreakdown(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, zoneId, productType, userId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;
            const filterUserId = userId ? parseInt(userId as string) : null;
            const filterProductType = productType && productType !== 'ALL' ? productType as ProductType : null;

            const yearStart = new Date(targetYear, 0, 1);
            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            // Get all active users with zone assignments (only ZONE_USER and ZONE_MANAGER)
            const usersQuery: any = {
                isActive: true,
                role: { in: ['ZONE_MANAGER', 'ZONE_USER'] },
            };

            // If userId filter is provided, filter to specific user
            if (filterUserId) {
                usersQuery.id = filterUserId;
            }

            // If zoneId filter is provided, filter users by zone
            if (filterZoneId) {
                usersQuery.serviceZones = {
                    some: {
                        serviceZoneId: filterZoneId,
                    }
                };
            }

            const users = await prisma.user.findMany({
                where: usersQuery,
                select: {
                    id: true,
                    name: true,
                    shortForm: true,
                    role: true,
                    serviceZones: {
                        select: {
                            serviceZone: {
                                select: {
                                    id: true,
                                    name: true,
                                }
                            }
                        }
                    }
                },
                orderBy: { name: 'asc' },
            });

            interface UserMonthlyData {
                month: string;
                monthLabel: string;
                noOfOffers: number;
                offersValue: number;
                orderReceived: number;
                ordersInHand: number;
                buMonthly: number;
                percentDev: number | null;
                offerBUMonth: number;
                offerBUMonthDev: number | null;
            }

            interface UserMonthlyBreakdown {
                userId: number;
                userName: string;
                userShortForm: string | null;
                zoneName: string;
                hitRate: number;
                yearlyTarget: number;
                monthlyData: UserMonthlyData[];
                productBreakdown?: {
                    productType: string;
                    productLabel: string;
                    yearlyTarget: number;
                    monthlyData: {
                        month: string;
                        monthLabel: string;
                        noOfOffers: number;
                        offersValue: number;
                        orderReceived: number;
                        ordersInHand: number;
                        buMonthly: number;
                        percentDev: number | null;
                        offerBUMonth: number;
                        offerBUMonthDev: number | null;
                    }[];
                    totals: {
                        offersValue: number;
                        orderReceived: number;
                        ordersInHand: number;
                        buMonthly: number;
                        offerBUMonth: number;
                    };
                }[];
                totals: {
                    offersValue: number;
                    orderReceived: number;
                    ordersInHand: number;
                    buMonthly: number;
                    offerBUMonth: number;
                };
            }

            const userBreakdowns: UserMonthlyBreakdown[] = [];

            for (const user of users) {
                // Get the user's primary zone name
                const primaryZone = user.serviceZones[0]?.serviceZone;
                const zoneName = primaryZone?.name || 'No Zone';

                // Get yearly targets for this user
                const yearlyTargets = await prisma.userTarget.findMany({
                    where: {
                        userId: user.id,
                        targetPeriod: String(targetYear),
                        periodType: 'YEARLY',
                    },
                });

                // Calculate yearly target: use overall if exists, else sum product-specific
                const overallTarget = yearlyTargets.find(t => t.productType === null);
                const productTargets = yearlyTargets.filter(t => t.productType !== null);
                let yearlyTargetValue: number;
                if (overallTarget) {
                    yearlyTargetValue = toNumber(overallTarget.targetValue);
                } else {
                    yearlyTargetValue = productTargets.reduce((sum, t) => sum + toNumber(t.targetValue), 0);
                }
                const monthlyBUTarget = yearlyTargetValue / 12;

                // Get monthly targets
                const monthlyTargets = await prisma.userTarget.findMany({
                    where: {
                        userId: user.id,
                        targetPeriod: { startsWith: `${targetYear}-` },
                        periodType: 'MONTHLY',
                        productType: null,
                    },
                });

                const monthlyTargetMap = new Map<string, number>();
                monthlyTargets.forEach(t => {
                    monthlyTargetMap.set(t.targetPeriod, Number(t.targetValue));
                });

                // Get all offers created by this user
                const offers = await prisma.offer.findMany({
                    where: {
                        createdById: user.id,
                        createdAt: { gte: yearStart, lte: yearEnd },
                        ...(filterProductType && { productType: filterProductType }),
                    },
                    select: {
                        id: true,
                        offerValue: true,
                        poValue: true,
                        stage: true,
                        openFunnel: true,
                        offerMonth: true,
                        poReceivedMonth: true,
                        probabilityPercentage: true,
                        productType: true,
                    },
                });

                // Calculate hit rate for this user
                const wonOffers = offers.filter(o => o.stage === 'WON').length;
                const lostOffers = offers.filter(o => o.stage === 'LOST').length;
                const totalWonValue = offers
                    .filter(o => o.stage === 'WON')
                    .reduce((sum, o) => sum + (o.poValue ? Number(o.poValue) : 0), 0);
                const totalOffersValue = offers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);
                const hitRate = totalOffersValue > 0 ? Math.round((totalWonValue / totalOffersValue) * 100) : 0;

                const monthlyData: UserMonthlyData[] = [];
                let totalNoOfOffers = 0;
                let totalOffersValueSum = 0;
                let totalOrderReceived = 0;
                let totalOrdersInHand = 0;
                let totalBUMonthly = 0;
                let totalOfferBUMonth = 0;

                for (let month = 1; month <= 12; month++) {
                    const monthStr = `${targetYear}-${String(month).padStart(2, '0')}`;

                    // Offers for this month (by offerMonth)
                    const monthOffers = offers.filter(o => o.offerMonth === monthStr);
                    const noOfOffers = monthOffers.length;
                    const offersValue = monthOffers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                    // Orders received (won offers in this month)
                    const wonThisMonth = offers.filter(o =>
                        o.stage === 'WON' &&
                        ((o.poReceivedMonth && o.poReceivedMonth === monthStr) ||
                            (!o.poReceivedMonth && o.offerMonth === monthStr))
                    );
                    const orderReceived = wonThisMonth.reduce((sum, o) => {
                        const value = o.poValue ? Number(o.poValue) : (o.offerValue ? Number(o.offerValue) : 0);
                        return sum + value;
                    }, 0);

                    // Orders in hand (open funnel for this month)
                    // Logic: Count only offers created this month that are still OPEN
                    const ordersInHand = monthOffers
                        .filter(o => o.openFunnel === true)
                        .reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                    // Monthly target
                    const buMonthly = monthlyTargetMap.get(monthStr) || monthlyBUTarget;

                    // % Deviation: ((Actual - Target) / Target) × 100
                    // Standard deviation formula - compares actual orders to monthly target
                    let percentDev: number | null = null;
                    if (buMonthly > 0) {
                        percentDev = ((orderReceived - buMonthly) / buMonthly) * 100;
                    }

                    // Offer BU Month = BU/Monthly × 4
                    const offerBUMonth = buMonthly * 4;

                    // Offer BU Month deviation - only show if there is a target set
                    const offerBUMonthDev = offerBUMonth > 0 ? ((offersValue - offerBUMonth) / offerBUMonth) * 100 : null;

                    monthlyData.push({
                        month: monthStr,
                        monthLabel: monthNames[month - 1],
                        noOfOffers,
                        offersValue,
                        orderReceived,
                        ordersInHand,
                        buMonthly,
                        percentDev: percentDev !== null ? Math.round(percentDev) : null,
                        offerBUMonth,
                        offerBUMonthDev: offerBUMonthDev !== null ? Math.round(offerBUMonthDev) : null,
                    });

                    totalNoOfOffers += noOfOffers;
                    totalOffersValueSum += offersValue;
                    totalOrderReceived += orderReceived;
                    totalOrdersInHand += ordersInHand;
                    totalBUMonthly += buMonthly;
                    totalOfferBUMonth += offerBUMonth;
                }

                // Calculate product type breakdown for this user
                // Using actual ProductType enum values from Prisma schema
                const productTypes = [
                    { key: 'CONTRACT', label: 'Contract' },
                    { key: 'BD_SPARE', label: 'BD Spare' },
                    { key: 'SPARE_PARTS', label: 'Spare Parts' },
                    { key: 'KARDEX_CONNECT', label: 'Kardex Connect' },
                    { key: 'RELOCATION', label: 'Relocation' },
                    { key: 'SOFTWARE', label: 'Software' },
                    { key: 'OTHERS', label: 'Repairs & Others' },
                    { key: 'RETROFIT_KIT', label: 'Retrofit Kit' },
                    { key: 'UPGRADE_KIT', label: 'Optilife Upgrade' },
                ];

                const productBreakdown = await Promise.all(productTypes.map(async (productType) => {
                    const productOffers = offers.filter(o => o.productType === productType.key);

                    // Get product-specific yearly target for this user
                    const productYearlyTarget = await prisma.userTarget.findFirst({
                        where: {
                            userId: user.id,
                            targetPeriod: String(targetYear),
                            periodType: 'YEARLY',
                            productType: productType.key as ProductType,
                        },
                    });
                    const productYearlyTargetValue = productYearlyTarget ? toNumber(productYearlyTarget.targetValue) : 0;
                    const productMonthlyBU = productYearlyTargetValue / 12;
                    const productOfferBU = productMonthlyBU * 4;

                    const productMonthlyData = [];
                    let pTotalOffersValue = 0;
                    let pTotalOrderReceived = 0;
                    let pTotalOrdersInHand = 0;
                    let pTotalBUMonthly = 0;
                    let pTotalOfferBUMonth = 0;

                    for (let month = 1; month <= 12; month++) {
                        const monthStr = `${targetYear}-${String(month).padStart(2, '0')}`;

                        // Offers for this month (by offerMonth)
                        const monthOffers = productOffers.filter(o => o.offerMonth === monthStr);
                        const pNoOfOffers = monthOffers.length;
                        const pOffersValue = monthOffers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                        // Orders received (won offers in this month)
                        const wonThisMonth = productOffers.filter(o =>
                            o.stage === 'WON' &&
                            ((o.poReceivedMonth && o.poReceivedMonth === monthStr) ||
                                (!o.poReceivedMonth && o.offerMonth === monthStr))
                        );
                        const pOrderReceived = wonThisMonth.reduce((sum, o) => {
                            const value = o.poValue ? Number(o.poValue) : Number(o.offerValue);
                            return sum + (isNaN(value) ? 0 : value);
                        }, 0);

                        // Open funnel for this month
                        const funnelThisMonth = productOffers.filter(o =>
                            o.openFunnel === true && o.offerMonth === monthStr
                        );
                        const pOrdersInHand = funnelThisMonth.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);

                        // Calculate deviations
                        const pPercentDev = productMonthlyBU > 0 ? ((pOrderReceived - productMonthlyBU) / productMonthlyBU) * 100 : null;
                        const pOfferBUMonthDev = productOfferBU > 0 ? ((pOffersValue - productOfferBU) / productOfferBU) * 100 : null;

                        productMonthlyData.push({
                            month: monthStr,
                            monthLabel: monthNames[month - 1],
                            noOfOffers: pNoOfOffers,
                            offersValue: pOffersValue,
                            orderReceived: pOrderReceived,
                            ordersInHand: pOrdersInHand,
                            buMonthly: productMonthlyBU,
                            percentDev: pPercentDev !== null ? Math.round(pPercentDev) : null,
                            offerBUMonth: productOfferBU,
                            offerBUMonthDev: pOfferBUMonthDev !== null ? Math.round(pOfferBUMonthDev) : null,
                        });

                        pTotalOffersValue += pOffersValue;
                        pTotalOrderReceived += pOrderReceived;
                        pTotalOrdersInHand += pOrdersInHand;
                        pTotalBUMonthly += productMonthlyBU;
                        pTotalOfferBUMonth += productOfferBU;
                    }

                    // Calculate hit rate for this product type
                    const totalProductOffersValue = productOffers.reduce((sum, o) => sum + (o.offerValue ? Number(o.offerValue) : 0), 0);
                    const totalProductWonValue = productOffers
                        .filter(o => o.stage === 'WON')
                        .reduce((sum, o) => sum + (o.poValue ? Number(o.poValue) : Number(o.offerValue)), 0);
                    const productHitRate = totalProductOffersValue > 0 ? Math.round((totalProductWonValue / totalProductOffersValue) * 100) : 0;

                    return {
                        productType: productType.key,
                        productLabel: productType.label,
                        yearlyTarget: productYearlyTargetValue,
                        hitRate: productHitRate,
                        monthlyData: productMonthlyData,
                        totals: {
                            offersValue: pTotalOffersValue,
                            orderReceived: pTotalOrderReceived,
                            ordersInHand: pTotalOrdersInHand,
                            buMonthly: pTotalBUMonthly,
                            offerBUMonth: pTotalOfferBUMonth,
                        },
                    };
                }));

                // Filter to only show products with data
                const filteredProductBreakdown = productBreakdown.filter(p =>
                    p.totals.offersValue > 0 || p.totals.orderReceived > 0 || p.totals.ordersInHand > 0 || p.yearlyTarget > 0
                );

                userBreakdowns.push({
                    userId: user.id,
                    userName: user.name || `User ${user.id}`,
                    userShortForm: user.shortForm,
                    zoneName,
                    hitRate,
                    yearlyTarget: yearlyTargetValue,
                    monthlyData,
                    productBreakdown: filteredProductBreakdown,
                    totals: {
                        offersValue: totalOffersValueSum,
                        orderReceived: totalOrderReceived,
                        ordersInHand: totalOrdersInHand,
                        buMonthly: totalBUMonthly,
                        offerBUMonth: totalOfferBUMonth,
                    },
                });
            }

            // Sort users by total orders received (descending), then by name
            userBreakdowns.sort((a, b) => {
                if (b.totals.orderReceived !== a.totals.orderReceived) {
                    return b.totals.orderReceived - a.totals.orderReceived;
                }
                return a.userName.localeCompare(b.userName);
            });

            return res.json({
                year: targetYear,
                zoneId: filterZoneId,
                users: userBreakdowns,
            });
        } catch (error: any) {
            logger.error('Get user monthly breakdown error:', error);
            return res.status(500).json({ error: 'Failed to fetch user monthly breakdown' });
        }
    }

    /**
     * Get Product × User × Zone Breakdown
     * Shows product types as rows, users as columns, grouped by zone
     */
    static async getProductUserZoneBreakdownWrapper(req: any, res: Response) {
        return ForecastController.getProductUserZoneBreakdown(req as AuthenticatedRequest, res);
    }

    static async getProductWiseForecastWrapper(req: any, res: Response) {
        return ForecastController.getProductWiseForecast(req as AuthenticatedRequest, res);
    }

    static async getProductUserZoneBreakdown(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, minProbability, zoneId, userId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const minProb = minProbability ? parseInt(minProbability as string) : 0;
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;
            const filterUserId = userId ? parseInt(userId as string) : null;

            // All product types with proper labels
            const productTypes = [
                { key: 'CONTRACT', label: 'Contract' },
                { key: 'BD_SPARE', label: 'BD Spare' },
                { key: 'SPARE_PARTS', label: 'Spare Parts' },
                { key: 'KARDEX_CONNECT', label: 'Kardex Connect' },
                { key: 'RELOCATION', label: 'Relocation' },
                { key: 'SOFTWARE', label: 'Software' },
                { key: 'OTHERS', label: 'Repairs & Others' },
                { key: 'RETROFIT_KIT', label: 'Retrofit Kit' },
                { key: 'UPGRADE_KIT', label: 'Optilife Upgrade' }
            ];

            // Get zones (filtered by zoneId if provided)
            const zones = await prisma.serviceZone.findMany({
                where: {
                    isActive: true,
                    ...(filterZoneId && { id: filterZoneId }),
                },
                orderBy: { name: 'asc' },
            });

            const zoneBreakdowns: any[] = [];

            for (const zone of zones) {
                // Get users for this zone (Zone Users and Zone Managers)
                const usersInZone = await prisma.user.findMany({
                    where: {
                        isActive: true,
                        OR: [
                            {
                                role: { in: ['ZONE_MANAGER', 'ZONE_USER'] },
                                serviceZones: {
                                    some: { serviceZoneId: zone.id }
                                }
                            },
                            // Admins with offers in this zone
                            {
                                role: 'ADMIN',
                                createdOffers: {
                                    some: { zoneId: zone.id }
                                }
                            },
                        ],
                    },
                    select: {
                        id: true,
                        name: true,
                        shortForm: true,
                    },
                    orderBy: { name: 'asc' },
                });

                // Get all offers for this zone in the target year, filtered by probability
                const offers = await prisma.offer.findMany({
                    where: {
                        zoneId: zone.id,
                        poExpectedMonth: {
                            startsWith: `${targetYear}-`,
                        },
                        stage: { notIn: ['LOST'] },
                        ...(minProb > 0 && { probabilityPercentage: { gte: minProb } }),
                        // User filter
                        ...(filterUserId && {
                            OR: [
                                { assignedToId: filterUserId },
                                { createdById: filterUserId }
                            ]
                        }),
                    },
                    select: {
                        id: true,
                        offerValue: true,
                        productType: true,
                        poExpectedMonth: true,
                        assignedToId: true,
                        createdById: true,
                        probabilityPercentage: true,
                    },
                });

                // Build Product × User matrix
                const productUserMatrix: any[] = [];
                const userTotals: { [userId: number]: number } = {};
                let zoneTotalValue = 0;

                // Initialize user totals
                usersInZone.forEach(u => {
                    userTotals[u.id] = 0;
                });

                for (const product of productTypes) {
                    const row: any = {
                        productType: product.key,
                        productLabel: product.label,
                        userValues: {},
                        total: 0,
                    };

                    // Calculate value for each user
                    for (const user of usersInZone) {
                        const userOffers = offers.filter(o =>
                            o.productType === product.key &&
                            (o.assignedToId === user.id || o.createdById === user.id)
                        );
                        const value = userOffers.reduce((sum, o) => sum + toNumber(o.offerValue), 0);
                        row.userValues[user.id] = value;
                        row.total += value;
                        userTotals[user.id] += value;
                    }

                    zoneTotalValue += row.total;
                    productUserMatrix.push(row);
                }

                zoneBreakdowns.push({
                    zoneId: zone.id,
                    zoneName: zone.name,
                    users: usersInZone.map(u => ({
                        id: u.id,
                        name: u.name || u.shortForm || `User ${u.id}`,
                    })),
                    productMatrix: productUserMatrix,
                    userTotals,
                    zoneTotalValue,
                });
            }

            return res.json({
                year: targetYear,
                productTypes: productTypes,
                zones: zoneBreakdowns,
            });
        } catch (error: any) {
            logger.error('Get Product × User × Zone breakdown error:', error);
            return res.status(500).json({ error: 'Failed to fetch Product × User × Zone breakdown' });
        }
    }

    /**
     * Get Product-wise Forecast Breakdown
     * Structure: Zone → User → Product Type × Months
     * Matches Excel layout: User with total row, then each product type with monthly values
     */
    static async getProductWiseForecast(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, minProbability, zoneId, userId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const minProb = minProbability ? parseInt(minProbability as string) : 0;
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;
            const filterUserId = userId ? parseInt(userId as string) : null;

            const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            const monthNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Calendar year order

            // All product types
            const productTypes = [
                { key: 'CONTRACT', label: 'Contract' },
                { key: 'BD_SPARE', label: 'BD Spare' },
                { key: 'SPARE_PARTS', label: 'Spare Parts' },
                { key: 'KARDEX_CONNECT', label: 'Kardex Connect' },
                { key: 'RELOCATION', label: 'Relocation' },
                { key: 'SOFTWARE', label: 'Software' },
                { key: 'OTHERS', label: 'Others' },
                { key: 'RETROFIT_KIT', label: 'Retrofit kit' },
                { key: 'UPGRADE_KIT', label: 'Upgrade kit' },
                { key: 'TRAINING', label: 'Training' },
            ];

            // Get zones (filtered by zoneId if provided)
            const zones = await prisma.serviceZone.findMany({
                where: {
                    isActive: true,
                    ...(filterZoneId && { id: filterZoneId }),
                },
                orderBy: { name: 'asc' },
            });

            const zoneBreakdowns: any[] = [];

            for (const zone of zones) {
                // Get users for this zone (Zone Users and Zone Managers)
                const usersInZone = await prisma.user.findMany({
                    where: {
                        isActive: true,
                        OR: [
                            {
                                role: { in: ['ZONE_MANAGER', 'ZONE_USER'] },
                                serviceZones: {
                                    some: { serviceZoneId: zone.id }
                                }
                            },
                            // Admins with offers in this zone
                            {
                                role: 'ADMIN',
                                createdOffers: {
                                    some: { zoneId: zone.id }
                                }
                            },
                        ],
                    },
                    select: {
                        id: true,
                        name: true,
                        shortForm: true,
                    },
                    orderBy: { name: 'asc' },
                });

                // Get all offers for this zone in the target year, filtered by probability
                const offers = await prisma.offer.findMany({
                    where: {
                        zoneId: zone.id,
                        poExpectedMonth: {
                            startsWith: `${targetYear}-`,
                        },
                        stage: { notIn: ['LOST'] },
                        ...(minProb > 0 && { probabilityPercentage: { gte: minProb } }),
                        // User filter
                        ...(filterUserId && {
                            OR: [
                                { assignedToId: filterUserId },
                                { createdById: filterUserId }
                            ]
                        }),
                    },
                    select: {
                        id: true,
                        offerValue: true,
                        productType: true,
                        poExpectedMonth: true,
                        assignedToId: true,
                        createdById: true,
                        probabilityPercentage: true,
                    },
                });

                // Build User → Product × Months structure
                const userBreakdowns: any[] = [];

                for (const user of usersInZone) {
                    // Get user's offers
                    const userOffers = offers.filter(o =>
                        o.assignedToId === user.id || o.createdById === user.id
                    );

                    // Calculate monthly totals for user
                    const monthlyTotals: { [month: string]: number } = {};
                    monthNames.forEach(m => { monthlyTotals[m] = 0; });

                    // Calculate product-wise monthly values
                    const productData: any[] = [];

                    for (const product of productTypes) {
                        const monthlyValues: { [month: string]: number } = {};
                        monthNames.forEach(m => { monthlyValues[m] = 0; });

                        const productOffers = userOffers.filter(o => o.productType === product.key);

                        for (const offer of productOffers) {
                            if (!offer.poExpectedMonth) continue;
                            const monthNum = parseInt(offer.poExpectedMonth.split('-')[1]);
                            const monthIdx = monthNumbers.indexOf(monthNum);
                            if (monthIdx >= 0) {
                                const monthKey = monthNames[monthIdx];
                                const value = toNumber(offer.offerValue);
                                monthlyValues[monthKey] += value;
                                monthlyTotals[monthKey] += value;
                            }
                        }

                        const rowTotal = Object.values(monthlyValues).reduce((sum, v) => sum + v, 0);
                        productData.push({
                            productType: product.key,
                            productLabel: product.label,
                            monthlyValues,
                            total: rowTotal,
                        });
                    }

                    const userTotal = Object.values(monthlyTotals).reduce((sum, v) => sum + v, 0);

                    userBreakdowns.push({
                        userId: user.id,
                        userName: user.name || user.shortForm || `User ${user.id}`,
                        monthlyTotals,
                        grandTotal: userTotal,
                        products: productData,
                    });
                }

                // Calculate zone totals
                const zoneMonthlyTotals: { [month: string]: number } = {};
                monthNames.forEach(m => { zoneMonthlyTotals[m] = 0; });

                userBreakdowns.forEach(user => {
                    monthNames.forEach(m => {
                        zoneMonthlyTotals[m] += user.monthlyTotals[m] || 0;
                    });
                });

                const zoneGrandTotal = Object.values(zoneMonthlyTotals).reduce((sum, v) => sum + v, 0);

                zoneBreakdowns.push({
                    zoneId: zone.id,
                    zoneName: zone.name,
                    users: userBreakdowns,
                    monthlyTotals: zoneMonthlyTotals,
                    grandTotal: zoneGrandTotal,
                });
            }

            return res.json({
                year: targetYear,
                months: monthNames,
                productTypes,
                zones: zoneBreakdowns,
            });
        } catch (error: any) {
            logger.error('Get Product-wise Forecast error:', error);
            return res.status(500).json({ error: 'Failed to fetch Product-wise Forecast' });
        }
    }

    /**
     * Get Comprehensive Forecast Analytics
     * Returns detailed analytics data for the analytics dashboard tab
     */
    static async getForecastAnalyticsWrapper(req: any, res: Response) {
        return ForecastController.getForecastAnalytics(req as AuthenticatedRequest, res);
    }

    static async getForecastAnalytics(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, zoneId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;

            const yearStart = new Date(targetYear, 0, 1);
            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

            const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

            // Get all zones (filtered by zoneId if provided)
            const zones = await prisma.serviceZone.findMany({
                where: { 
                    isActive: true,
                    ...(filterZoneId && { id: filterZoneId }),
                },
                orderBy: { name: 'asc' },
            });

            // Basic zone metrics
            const zoneAnalytics: any[] = [];
            let totalOffers = 0;
            let totalValue = 0;
            let totalWon = 0;
            let totalLost = 0;
            let totalOpen = 0;
            let totalTarget = 0;

            // Monthly trends
            const monthlyTrends: { [month: string]: { offers: number; value: number; won: number; lost: number } } = {};
            monthNames.forEach(m => {
                monthlyTrends[m] = { offers: 0, value: 0, won: 0, lost: 0 };
            });

            // Product distribution
            const productDistribution: { [productType: string]: { count: number; value: number; won: number } } = {};

            // User performance
            const userPerformance: Map<number, { id: number; name: string; offers: number; value: number; won: number; conversion: number }> = new Map();

            for (const zone of zones) {
                // Get all offers for this zone
                const offers = await prisma.offer.findMany({
                    where: {
                        zoneId: zone.id,
                        createdAt: { gte: yearStart, lte: yearEnd },
                    },
                    select: {
                        id: true,
                        offerValue: true,
                        poValue: true,
                        stage: true,
                        openFunnel: true,
                        offerMonth: true,
                        poReceivedMonth: true,
                        productType: true,
                        assignedToId: true,
                        createdById: true,
                        probabilityPercentage: true,
                        assignedTo: {
                            select: { id: true, name: true, shortForm: true },
                        },
                    },
                });

                // Get yearly target
                const yearlyTargets = await prisma.zoneTarget.findMany({
                    where: {
                        serviceZoneId: zone.id,
                        targetPeriod: String(targetYear),
                        periodType: 'YEARLY',
                    },
                });

                const overallTarget = yearlyTargets.find(t => t.productType === null);
                const productTargets = yearlyTargets.filter(t => t.productType !== null);
                let zoneTarget: number;
                if (overallTarget) {
                    zoneTarget = toNumber(overallTarget.targetValue);
                } else {
                    zoneTarget = productTargets.reduce((sum, t) => sum + toNumber(t.targetValue), 0);
                }

                // Calculate zone metrics
                const zoneOfferCount = offers.length;
                const zoneOffersValue = offers.reduce((sum, o) => sum + toNumber(o.offerValue), 0);

                // Won offers with year filter
                const targetYearStr = String(targetYear);
                const wonOffers = offers.filter(o => {
                    if (o.stage !== 'WON') return false;
                    const effectiveMonth = o.poReceivedMonth || o.offerMonth;
                    return effectiveMonth && effectiveMonth.startsWith(targetYearStr);
                });
                const zoneWonValue = wonOffers.reduce((sum, o) => {
                    const value = o.poValue ? toNumber(o.poValue) : toNumber(o.offerValue);
                    return sum + value;
                }, 0);

                const lostOffers = offers.filter(o => o.stage === 'LOST');
                const zoneLostValue = lostOffers.reduce((sum, o) => sum + toNumber(o.offerValue), 0);

                const openOffers = offers.filter(o => o.openFunnel && o.stage !== 'WON' && o.stage !== 'LOST');
                const zoneOpenValue = openOffers.reduce((sum, o) => sum + toNumber(o.offerValue), 0);

                const zoneHitRate = zoneOffersValue > 0 ? (zoneWonValue / zoneOffersValue) * 100 : 0;
                const zoneAchievement = zoneTarget > 0 ? (zoneWonValue / zoneTarget) * 100 : 0;
                const zoneConversion = zoneOfferCount > 0 ? (wonOffers.length / zoneOfferCount) * 100 : 0;

                zoneAnalytics.push({
                    zoneId: zone.id,
                    zoneName: zone.name,
                    metrics: {
                        offers: zoneOfferCount,
                        offersValue: zoneOffersValue,
                        wonValue: zoneWonValue,
                        wonCount: wonOffers.length,
                        lostValue: zoneLostValue,
                        lostCount: lostOffers.length,
                        openValue: zoneOpenValue,
                        openCount: openOffers.length,
                        target: zoneTarget,
                        balance: zoneTarget - zoneWonValue,
                        hitRate: Math.round(zoneHitRate * 10) / 10,
                        achievement: Math.round(zoneAchievement * 10) / 10,
                        conversion: Math.round(zoneConversion * 10) / 10,
                    },
                });

                // Aggregate totals
                totalOffers += zoneOfferCount;
                totalValue += zoneOffersValue;
                totalWon += zoneWonValue;
                totalLost += zoneLostValue;
                totalOpen += zoneOpenValue;
                totalTarget += zoneTarget;

                // Monthly trends aggregation
                offers.forEach(o => {
                    if (!o.offerMonth) return;
                    const monthNum = parseInt(o.offerMonth.split('-')[1]);
                    const monthKey = monthNames[monthNum - 1];
                    if (monthKey) {
                        monthlyTrends[monthKey].offers += 1;
                        monthlyTrends[monthKey].value += toNumber(o.offerValue);
                        if (o.stage === 'WON') monthlyTrends[monthKey].won += toNumber(o.poValue || o.offerValue);
                        if (o.stage === 'LOST') monthlyTrends[monthKey].lost += toNumber(o.offerValue);
                    }
                });

                // Product distribution
                offers.forEach(o => {
                    const pt = o.productType || 'OTHER';
                    if (!productDistribution[pt]) {
                        productDistribution[pt] = { count: 0, value: 0, won: 0 };
                    }
                    productDistribution[pt].count += 1;
                    productDistribution[pt].value += toNumber(o.offerValue);
                    if (o.stage === 'WON') {
                        productDistribution[pt].won += toNumber(o.poValue || o.offerValue);
                    }
                });

                // User performance aggregation
                offers.forEach(o => {
                    const userId = o.assignedToId || o.createdById;
                    const userName = o.assignedTo?.name || o.assignedTo?.shortForm || `User ${userId}`;

                    if (!userPerformance.has(userId)) {
                        userPerformance.set(userId, { id: userId, name: userName, offers: 0, value: 0, won: 0, conversion: 0 });
                    }
                    const user = userPerformance.get(userId)!;
                    user.offers += 1;
                    user.value += toNumber(o.offerValue);
                    if (o.stage === 'WON') {
                        user.won += toNumber(o.poValue || o.offerValue);
                    }
                });
            }

            // Calculate user conversions and get top performers
            userPerformance.forEach(user => {
                user.conversion = user.offers > 0 ? Math.round((user.won / user.value) * 100) : 0;
            });
            const topPerformers = Array.from(userPerformance.values())
                .sort((a, b) => b.won - a.won)
                .slice(0, 10);

            // Quarterly summary
            const quarterlySummary = [
                { name: 'Q1', months: ['JAN', 'FEB', 'MAR'], value: 0, won: 0 },
                { name: 'Q2', months: ['APR', 'MAY', 'JUN'], value: 0, won: 0 },
                { name: 'Q3', months: ['JUL', 'AUG', 'SEP'], value: 0, won: 0 },
                { name: 'Q4', months: ['OCT', 'NOV', 'DEC'], value: 0, won: 0 },
            ];
            quarterlySummary.forEach(q => {
                q.months.forEach(m => {
                    q.value += monthlyTrends[m]?.value || 0;
                    q.won += monthlyTrends[m]?.won || 0;
                });
            });

            // Format product distribution for response
            const productStats = Object.entries(productDistribution)
                .map(([type, stats]) => ({
                    productType: type,
                    label: type.replace(/_/g, ' '),
                    ...stats,
                    hitRate: stats.value > 0 ? Math.round((stats.won / stats.value) * 100) : 0,
                }))
                .sort((a, b) => b.value - a.value);

            // Best and worst zones
            const sortedZones = [...zoneAnalytics].sort((a, b) => b.metrics.achievement - a.metrics.achievement);
            const bestZone = sortedZones[0];
            const worstZone = sortedZones[sortedZones.length - 1];

            // Overall metrics
            const overallMetrics = {
                totalOffers,
                totalValue,
                totalWon,
                totalLost,
                totalOpen,
                totalTarget,
                balance: totalTarget - totalWon,
                hitRate: totalValue > 0 ? Math.round((totalWon / totalValue) * 1000) / 10 : 0,
                achievement: totalTarget > 0 ? Math.round((totalWon / totalTarget) * 1000) / 10 : 0,
                avgOfferValue: totalOffers > 0 ? Math.round(totalValue / totalOffers) : 0,
            };

            return res.json({
                year: targetYear,
                overall: overallMetrics,
                zones: zoneAnalytics,
                monthlyTrends: monthNames.map(m => ({
                    month: m,
                    ...monthlyTrends[m],
                })),
                quarterly: quarterlySummary,
                products: productStats,
                topPerformers,
                highlights: {
                    bestZone: bestZone ? { name: bestZone.zoneName, achievement: bestZone.metrics.achievement } : null,
                    worstZone: worstZone ? { name: worstZone.zoneName, achievement: worstZone.metrics.achievement } : null,
                    highestValueProduct: productStats[0] || null,
                    totalUsers: userPerformance.size,
                },
            });
        } catch (error: any) {
            logger.error('Get Forecast Analytics error:', error);
            return res.status(500).json({ error: 'Failed to fetch Forecast Analytics' });
        }
    }

    // ==========================================
    // GROWTH REPORT
    // ==========================================

    static getGrowthReportWrapper(req: any, res: Response) {
        return ForecastController.getGrowthReport(req as AuthenticatedRequest, res);
    }

    /**
     * Growth Report API
     * Returns Target vs Offer Value vs Won with month-range & zone/user filters
     * Supports: All Zones, individual Zone, individual User, month-to-month range
     * Returns: total + product-wise breakdown, growth metrics, auto-generated insights
     */
    static async getGrowthReport(req: AuthenticatedRequest, res: Response) {
        try {
            const { year, fromMonth, toMonth, zoneId, userId } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const startMonth = fromMonth ? parseInt(fromMonth as string) : 1;
            const endMonth = toMonth ? parseInt(toMonth as string) : 12;
            const filterZoneId = zoneId ? parseInt(zoneId as string) : null;
            const filterUserId = userId ? parseInt(userId as string) : null;

            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            const productTypes = [
                { key: 'CONTRACT', label: 'Contract' },
                { key: 'BD_SPARE', label: 'BD Spare' },
                { key: 'SPARE_PARTS', label: 'Spare Parts' },
                { key: 'KARDEX_CONNECT', label: 'Kardex Connect' },
                { key: 'RELOCATION', label: 'Relocation' },
                { key: 'SOFTWARE', label: 'Software' },
                { key: 'OTHERS', label: 'Repairs & Others' },
                { key: 'RETROFIT_KIT', label: 'Retrofit Kit' },
                { key: 'UPGRADE_KIT', label: 'Optilife Upgrade' },
            ];

            const yearStart = new Date(targetYear, 0, 1);
            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);
            const targetYearStr = String(targetYear);

            // Get zones
            const zones = await prisma.serviceZone.findMany({
                where: {
                    isActive: true,
                    ...(filterZoneId && { id: filterZoneId }),
                },
                orderBy: { name: 'asc' },
            });

            // ---- Build monthly data ----
            interface MonthGrowthData {
                month: number;
                monthLabel: string;
                monthStr: string;
                target: number;
                offerValue: number;
                wonValue: number;
                offerCount: number;
                wonCount: number;
                achievementPercent: number;
                hitRatePercent: number;
                growthPercent: number | null; // MoM growth on wonValue
            }

            interface ProductGrowthData {
                productType: string;
                productLabel: string;
                target: number;
                offerValue: number;
                wonValue: number;
                offerCount: number;
                wonCount: number;
                achievementPercent: number;
                hitRatePercent: number;
                monthlyData: MonthGrowthData[];
            }

            const totalMonthlyData: MonthGrowthData[] = [];
            const productDataMap: Map<string, { target: number; offerValue: number; wonValue: number; offerCount: number; wonCount: number; monthlyData: Map<number, MonthGrowthData> }> = new Map();

            // Initialize product data map
            productTypes.forEach(pt => {
                const monthMap = new Map<number, MonthGrowthData>();
                for (let m = startMonth; m <= endMonth; m++) {
                    monthMap.set(m, {
                        month: m,
                        monthLabel: monthNames[m - 1],
                        monthStr: `${targetYear}-${String(m).padStart(2, '0')}`,
                        target: 0, offerValue: 0, wonValue: 0, offerCount: 0, wonCount: 0,
                        achievementPercent: 0, hitRatePercent: 0, growthPercent: null,
                    });
                }
                productDataMap.set(pt.key, { target: 0, offerValue: 0, wonValue: 0, offerCount: 0, wonCount: 0, monthlyData: monthMap });
            });

            // Get all offers across zones for filtered range
            for (const zone of zones) {
                // Get yearly targets (overall and product-specific)
                let yearlyTargets: any[];
                if (filterUserId) {
                    // Only fetch and add user target once to the total sum
                    if (zones.indexOf(zone) === 0) {
                        yearlyTargets = await prisma.userTarget.findMany({
                            where: {
                                userId: filterUserId,
                                targetPeriod: String(targetYear),
                                periodType: 'YEARLY',
                            },
                        });
                    } else {
                        yearlyTargets = [];
                    }
                } else {
                    yearlyTargets = await prisma.zoneTarget.findMany({
                        where: {
                            serviceZoneId: zone.id,
                            targetPeriod: String(targetYear),
                            periodType: 'YEARLY',
                        },
                    });
                }

                const overallTarget = yearlyTargets.find(t => t.productType === null);
                const productTargets = yearlyTargets.filter(t => t.productType !== null);
                let zoneYearlyTarget: number;
                if (overallTarget) {
                    zoneYearlyTarget = toNumber(overallTarget.targetValue);
                } else {
                    zoneYearlyTarget = productTargets.reduce((sum, t) => sum + toNumber(t.targetValue), 0);
                }

                // Build product target map for this zone
                const productTargetMap = new Map<string, number>();
                productTargets.forEach(t => {
                    if (t.productType) {
                        productTargetMap.set(t.productType, toNumber(t.targetValue));
                    }
                });

                // Monthly targets
                let monthlyTargets: any[];
                if (filterUserId) {
                    // Only fetch user monthly targets once
                    if (zones.indexOf(zone) === 0) {
                        monthlyTargets = await prisma.userTarget.findMany({
                            where: {
                                userId: filterUserId,
                                targetPeriod: { startsWith: `${targetYear}-` },
                                periodType: 'MONTHLY',
                                productType: null,
                            },
                        });
                    } else {
                        monthlyTargets = [];
                    }
                } else {
                    monthlyTargets = await prisma.zoneTarget.findMany({
                        where: {
                            serviceZoneId: zone.id,
                            targetPeriod: { startsWith: `${targetYear}-` },
                            periodType: 'MONTHLY',
                            productType: null,
                        },
                    });
                }
                const monthlyTargetMap = new Map<string, number>();
                monthlyTargets.forEach(t => monthlyTargetMap.set(t.targetPeriod, toNumber(t.targetValue)));

                const monthlyBUTarget = zoneYearlyTarget / 12;

                // Get all offers for this zone in the year
                const offers = await prisma.offer.findMany({
                    where: {
                        zoneId: zone.id,
                        createdAt: { gte: yearStart, lte: yearEnd },
                        ...(filterUserId && {
                            OR: [
                                { assignedToId: filterUserId },
                                { createdById: filterUserId },
                            ],
                        }),
                    },
                    select: {
                        id: true,
                        offerValue: true,
                        poValue: true,
                        stage: true,
                        offerMonth: true,
                        poReceivedMonth: true,
                        productType: true,
                        assignedToId: true,
                        createdById: true,
                    },
                });

                // Process each month in range
                for (let month = startMonth; month <= endMonth; month++) {
                    const monthStr = `${targetYear}-${String(month).padStart(2, '0')}`;
                    const buTarget = monthlyTargetMap.get(monthStr) || monthlyBUTarget;

                    // Offers for this month
                    const monthOffers = offers.filter(o => o.offerMonth === monthStr);
                    const offerValue = monthOffers.reduce((sum, o) => sum + toNumber(o.offerValue), 0);
                    const offerCount = monthOffers.length;

                    // Won offers for this month
                    const wonThisMonth = offers.filter(o =>
                        (o.stage === 'WON' || o.stage === 'PO_RECEIVED') &&
                        ((o.poReceivedMonth && o.poReceivedMonth === monthStr) ||
                            (!o.poReceivedMonth && o.offerMonth === monthStr))
                    );
                    const wonValue = wonThisMonth.reduce((sum, o) => {
                        const value = o.poValue ? toNumber(o.poValue) : toNumber(o.offerValue);
                        return sum + value;
                    }, 0);
                    const wonCount = wonThisMonth.length;

                    // Find or create total monthly entry
                    let totalEntry = totalMonthlyData.find(d => d.month === month);
                    if (!totalEntry) {
                        totalEntry = {
                            month, monthLabel: monthNames[month - 1], monthStr,
                            target: 0, offerValue: 0, wonValue: 0, offerCount: 0, wonCount: 0,
                            achievementPercent: 0, hitRatePercent: 0, growthPercent: null,
                        };
                        totalMonthlyData.push(totalEntry);
                    }
                    totalEntry.target += buTarget;
                    totalEntry.offerValue += offerValue;
                    totalEntry.wonValue += wonValue;
                    totalEntry.offerCount += offerCount;
                    totalEntry.wonCount += wonCount;

                    // Product-wise breakdown
                    for (const pt of productTypes) {
                        const ptOffers = monthOffers.filter(o => o.productType === pt.key);
                        const ptOfferValue = ptOffers.reduce((sum, o) => sum + toNumber(o.offerValue), 0);
                        const ptWonThisMonth = wonThisMonth.filter(o => o.productType === pt.key);
                        const ptWonValue = ptWonThisMonth.reduce((sum, o) => {
                            return sum + (o.poValue ? toNumber(o.poValue) : toNumber(o.offerValue));
                        }, 0);

                        const ptMonthlyTarget = (productTargetMap.get(pt.key) || 0) / 12;

                        const productData = productDataMap.get(pt.key)!;
                        const ptMonthEntry = productData.monthlyData.get(month)!;
                        ptMonthEntry.target += ptMonthlyTarget;
                        ptMonthEntry.offerValue += ptOfferValue;
                        ptMonthEntry.wonValue += ptWonValue;
                        ptMonthEntry.offerCount += ptOffers.length;
                        ptMonthEntry.wonCount += ptWonThisMonth.length;

                        productData.target += ptMonthlyTarget;
                        productData.offerValue += ptOfferValue;
                        productData.wonValue += ptWonValue;
                        productData.offerCount += ptOffers.length;
                        productData.wonCount += ptWonThisMonth.length;
                    }
                }
            }

            // Calculate percentages and MoM growth
            totalMonthlyData.sort((a, b) => a.month - b.month);
            for (let i = 0; i < totalMonthlyData.length; i++) {
                const d = totalMonthlyData[i];
                d.achievementPercent = d.target > 0 ? Math.round((d.wonValue / d.target) * 1000) / 10 : 0;
                d.hitRatePercent = d.offerValue > 0 ? Math.round((d.wonValue / d.offerValue) * 1000) / 10 : 0;
                if (i > 0) {
                    const prev = totalMonthlyData[i - 1];
                    if (prev.wonValue > 0) {
                        d.growthPercent = Math.round(((d.wonValue - prev.wonValue) / prev.wonValue) * 1000) / 10;
                    } else if (d.target > 0) {
                        // If previous month was zero, use current target as benchmark for "growth"
                        d.growthPercent = Math.round((d.wonValue / d.target) * 1000) / 10;
                    } else if (d.wonValue > 0) {
                        d.growthPercent = 100;
                    } else {
                        d.growthPercent = null;
                    }
                }
            }

            // Calculate product-wise percentages
            const productGrowthData: ProductGrowthData[] = [];
            for (const pt of productTypes) {
                const pData = productDataMap.get(pt.key)!;
                const monthlyArr = Array.from(pData.monthlyData.values()).sort((a, b) => a.month - b.month);

                // Calculate MoM growth and percentages for product months
                for (let i = 0; i < monthlyArr.length; i++) {
                    const d = monthlyArr[i];
                    d.achievementPercent = d.target > 0 ? Math.round((d.wonValue / d.target) * 1000) / 10 : 0;
                    d.hitRatePercent = d.offerValue > 0 ? Math.round((d.wonValue / d.offerValue) * 1000) / 10 : 0;
                    if (i > 0) {
                        const prev = monthlyArr[i - 1];
                        if (prev.wonValue > 0) {
                            d.growthPercent = Math.round(((d.wonValue - prev.wonValue) / prev.wonValue) * 1000) / 10;
                        } else if (d.target > 0) {
                            d.growthPercent = Math.round((d.wonValue / d.target) * 1000) / 10;
                        } else if (d.wonValue > 0) {
                            d.growthPercent = 100;
                        } else {
                            d.growthPercent = null;
                        }
                    }
                }

                // Only include products that have data
                if (pData.offerCount > 0 || pData.wonCount > 0 || pData.target > 0) {
                    productGrowthData.push({
                        productType: pt.key,
                        productLabel: pt.label,
                        target: pData.target,
                        offerValue: pData.offerValue,
                        wonValue: pData.wonValue,
                        offerCount: pData.offerCount,
                        wonCount: pData.wonCount,
                        achievementPercent: pData.target > 0 ? Math.round((pData.wonValue / pData.target) * 1000) / 10 : 0,
                        hitRatePercent: pData.offerValue > 0 ? Math.round((pData.wonValue / pData.offerValue) * 1000) / 10 : 0,
                        monthlyData: monthlyArr,
                    });
                }
            }

            // Totals
            const totalTarget = totalMonthlyData.reduce((s, d) => s + d.target, 0);
            const totalOfferValue = totalMonthlyData.reduce((s, d) => s + d.offerValue, 0);
            const totalWonValue = totalMonthlyData.reduce((s, d) => s + d.wonValue, 0);
            const totalOfferCount = totalMonthlyData.reduce((s, d) => s + d.offerCount, 0);
            const totalWonCount = totalMonthlyData.reduce((s, d) => s + d.wonCount, 0);

            // ── AUTO-GENERATED DETAILED INSIGHTS ────────────────────────
            const fmtVal = (v: number) => {
                if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
                if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
                if (v >= 1000) return `₹${(v / 1000).toFixed(1)} K`;
                return `₹${v.toFixed(0)}`;
            };

            const overallAchievement = totalTarget > 0 ? Math.round((totalWonValue / totalTarget) * 1000) / 10 : 0;
            const overallHitRate = totalOfferValue > 0 ? Math.round((totalWonValue / totalOfferValue) * 1000) / 10 : 0;
            const gap = totalTarget - totalWonValue;
            const monthsInRange = endMonth - startMonth + 1;
            const elapsedMonths = totalMonthlyData.filter(d => d.wonValue > 0 || d.offerCount > 0).length || 1;
            const remainingMonths = monthsInRange - elapsedMonths;
            const avgMonthlyWon = elapsedMonths > 0 ? totalWonValue / elapsedMonths : 0;
            const requiredMonthlyPace = remainingMonths > 0 && gap > 0 ? gap / remainingMonths : 0;

            // ── 1. PERFORMANCE SUMMARY
            const performance: { status: string; statusColor: string; points: { text: string; type: string }[] } = {
                status: overallAchievement >= 100 ? 'AHEAD' : overallAchievement >= 75 ? 'ON_TRACK' : overallAchievement >= 50 ? 'NEEDS_ATTENTION' : 'CRITICAL',
                statusColor: overallAchievement >= 100 ? 'emerald' : overallAchievement >= 75 ? 'blue' : overallAchievement >= 50 ? 'amber' : 'red',
                points: [],
            };

            if (overallAchievement >= 100) {
                performance.points.push({ text: `Target exceeded! Achievement stands at ${overallAchievement}% — surplus of ${fmtVal(Math.abs(gap))} over target`, type: 'success' });
            } else if (overallAchievement >= 75) {
                performance.points.push({ text: `Good progress at ${overallAchievement}% achievement. Remaining gap: ${fmtVal(gap)}`, type: 'info' });
            } else {
                performance.points.push({ text: `Behind target at ${overallAchievement}% achievement. Remaining gap: ${fmtVal(gap)}`, type: 'warning' });
            }

            performance.points.push({ text: `Average monthly order booking: ${fmtVal(avgMonthlyWon)} across ${elapsedMonths} active month(s)`, type: 'info' });

            if (gap > 0 && remainingMonths > 0) {
                performance.points.push({ text: `To meet target, need ${fmtVal(requiredMonthlyPace)}/month for the remaining ${remainingMonths} month(s) — ${requiredMonthlyPace > avgMonthlyWon * 1.5 ? 'aggressive ramp-up required' : requiredMonthlyPace > avgMonthlyWon ? 'moderate push needed' : 'achievable at current pace'}`, type: requiredMonthlyPace > avgMonthlyWon * 1.5 ? 'warning' : 'info' });
            }

            performance.points.push({ text: `Total pipeline generated: ${fmtVal(totalOfferValue)} across ${totalOfferCount} offers`, type: 'info' });
            performance.points.push({ text: `Conversion rate: ${overallHitRate}% of pipeline converted to orders (${totalWonCount} wins from ${totalOfferCount} offers)`, type: overallHitRate >= 30 ? 'success' : overallHitRate >= 15 ? 'info' : 'warning' });

            // ── 2. MONTHLY TRENDS
            const trends: { text: string; type: string }[] = [];
            const monthsWithGrowth = totalMonthlyData.filter(d => d.growthPercent !== null);

            // Best & worst months
            if (totalMonthlyData.length > 0) {
                const bestMonth = totalMonthlyData.reduce((best, d) => d.wonValue > best.wonValue ? d : best, totalMonthlyData[0]);
                const monthsWithWon = totalMonthlyData.filter(d => d.wonValue > 0);
                const worstMonth = monthsWithWon.length > 0 ? monthsWithWon.reduce((w, d) => d.wonValue < w.wonValue ? d : w, monthsWithWon[0]) : null;

                trends.push({ text: `🏆 Peak month: ${bestMonth.monthLabel} with ${fmtVal(bestMonth.wonValue)} won (${bestMonth.achievementPercent}% achievement)`, type: 'success' });
                if (worstMonth && worstMonth.month !== bestMonth.month) {
                    trends.push({ text: `📉 Lowest month: ${worstMonth.monthLabel} with ${fmtVal(worstMonth.wonValue)} won (${worstMonth.achievementPercent}% achievement)`, type: 'warning' });
                }

                // Months exceeding target
                const aboveTargetMonths = totalMonthlyData.filter(d => d.achievementPercent >= 100);
                const belowTargetMonths = totalMonthlyData.filter(d => d.achievementPercent < 100 && (d.wonValue > 0 || d.offerCount > 0));
                if (aboveTargetMonths.length > 0) {
                    trends.push({ text: `✅ Target met in ${aboveTargetMonths.length} of ${monthsInRange} months: ${aboveTargetMonths.map(m => m.monthLabel.slice(0, 3)).join(', ')}`, type: 'success' });
                }
                if (belowTargetMonths.length > 0) {
                    trends.push({ text: `⚠️ Target missed in ${belowTargetMonths.length} months: ${belowTargetMonths.map(m => `${m.monthLabel.slice(0, 3)} (${m.achievementPercent}%)`).join(', ')}`, type: 'warning' });
                }

                // Zero activity months
                const zeroMonths = totalMonthlyData.filter(d => d.wonValue === 0 && d.offerCount === 0);
                if (zeroMonths.length > 0) {
                    trends.push({ text: `🔴 No activity recorded in: ${zeroMonths.map(m => m.monthLabel.slice(0, 3)).join(', ')}`, type: 'error' });
                }
            }

            // Growth streak & trend direction
            if (monthsWithGrowth.length >= 2) {
                const avgGrowth = monthsWithGrowth.reduce((sum, d) => sum + (d.growthPercent || 0), 0) / monthsWithGrowth.length;
                // Consecutive growth streak
                let growthStreak = 0;
                let declineStreak = 0;
                for (let i = monthsWithGrowth.length - 1; i >= 0; i--) {
                    if ((monthsWithGrowth[i].growthPercent || 0) > 0) { growthStreak++; } else break;
                }
                for (let i = monthsWithGrowth.length - 1; i >= 0; i--) {
                    if ((monthsWithGrowth[i].growthPercent || 0) < 0) { declineStreak++; } else break;
                }

                if (growthStreak >= 3) {
                    trends.push({ text: `🔥 ${growthStreak}-month consecutive growth streak! Momentum is strong`, type: 'success' });
                } else if (growthStreak >= 2) {
                    trends.push({ text: `📈 ${growthStreak} consecutive months of positive growth`, type: 'success' });
                }
                if (declineStreak >= 3) {
                    trends.push({ text: `⚠️ ${declineStreak}-month decline streak — urgent attention needed`, type: 'error' });
                } else if (declineStreak >= 2) {
                    trends.push({ text: `📉 Declining for ${declineStreak} consecutive months`, type: 'warning' });
                }

                // Average growth
                if (avgGrowth > 10) {
                    trends.push({ text: `🚀 Strong avg. MoM growth: +${avgGrowth.toFixed(1)}% — accelerating trajectory`, type: 'success' });
                } else if (avgGrowth > 0) {
                    trends.push({ text: `📈 Positive avg. MoM growth: +${avgGrowth.toFixed(1)}%`, type: 'info' });
                } else if (avgGrowth < -10) {
                    trends.push({ text: `🔻 Steep avg. MoM decline: ${avgGrowth.toFixed(1)}% — needs immediate action`, type: 'error' });
                } else if (avgGrowth < 0) {
                    trends.push({ text: `📉 Negative avg. MoM growth: ${avgGrowth.toFixed(1)}%`, type: 'warning' });
                } else {
                    trends.push({ text: `➡️ Flat growth trend: ${avgGrowth.toFixed(1)}% average — look for new growth drivers`, type: 'info' });
                }

                // Volatility check
                const growthValues = monthsWithGrowth.map(d => d.growthPercent || 0);
                const variance = growthValues.reduce((sum, g) => sum + Math.pow(g - avgGrowth, 2), 0) / growthValues.length;
                const stdDev = Math.sqrt(variance);
                if (stdDev > 30) {
                    trends.push({ text: `⚡ High volatility in performance (σ=${stdDev.toFixed(0)}%) — results are inconsistent month to month`, type: 'warning' });
                }
            }

            // ── 3. PRODUCT ANALYSIS
            const products: { text: string; type: string }[] = [];
            if (productGrowthData.length > 0) {
                const sortedProducts = [...productGrowthData].sort((a, b) => b.wonValue - a.wonValue);
                const bestProduct = sortedProducts[0];
                const productsWithWon = sortedProducts.filter(p => p.wonValue > 0);

                products.push({ text: `🏅 Top product: ${bestProduct.productLabel} — ${fmtVal(bestProduct.wonValue)} won (${bestProduct.achievementPercent}% of target, ${bestProduct.hitRatePercent}% hit rate)`, type: 'success' });

                // Runners up
                if (productsWithWon.length >= 2) {
                    products.push({ text: `🥈 Second best: ${sortedProducts[1].productLabel} — ${fmtVal(sortedProducts[1].wonValue)} won (${sortedProducts[1].achievementPercent}% achievement)`, type: 'info' });
                }

                // Products exceeding target
                const overachievers = productGrowthData.filter(p => p.achievementPercent >= 100);
                if (overachievers.length > 0) {
                    products.push({ text: `✅ Target exceeded in: ${overachievers.map(p => `${p.productLabel} (${p.achievementPercent}%)`).join(', ')}`, type: 'success' });
                }

                // Products with high offers but low conversion
                const lowConversion = productGrowthData.filter(p => p.offerCount >= 3 && p.hitRatePercent < 10 && p.offerValue > 0);
                if (lowConversion.length > 0) {
                    products.push({ text: `🔍 Low conversion products (high offers, low wins): ${lowConversion.map(p => `${p.productLabel} (${p.hitRatePercent}% hit rate, ${p.offerCount} offers)`).join(', ')}`, type: 'warning' });
                }

                // Underperforming products (target set but very low achievement)
                const underperforming = productGrowthData.filter(p => p.target > 0 && p.achievementPercent < 25);
                if (underperforming.length > 0) {
                    products.push({ text: `⚠️ Significantly below target: ${underperforming.map(p => `${p.productLabel} (${p.achievementPercent}% of ${fmtVal(p.target)} target)`).join(', ')}`, type: 'error' });
                }

                // Zero-won products
                const zeroWon = productGrowthData.filter(p => p.wonValue === 0 && p.offerCount > 0);
                if (zeroWon.length > 0) {
                    products.push({ text: `🚫 No orders won yet in: ${zeroWon.map(p => `${p.productLabel} (${p.offerCount} offers pending)`).join(', ')}`, type: 'warning' });
                }

                // Product diversity
                if (productsWithWon.length >= 1 && totalWonValue > 0) {
                    const topShare = Math.round((bestProduct.wonValue / totalWonValue) * 100);
                    if (topShare > 70) {
                        products.push({ text: `⚡ Revenue concentration risk: ${bestProduct.productLabel} accounts for ${topShare}% of all won value — diversification recommended`, type: 'warning' });
                    } else if (productsWithWon.length >= 3) {
                        products.push({ text: `✅ Good product diversification: ${productsWithWon.length} product categories generating revenue`, type: 'success' });
                    }
                }
            }

            // ── 4. CONVERSION & PIPELINE
            const conversion: { text: string; type: string }[] = [];
            if (totalOfferCount > 0) {
                const avgDealSize = totalWonCount > 0 ? totalWonValue / totalWonCount : 0;
                const avgOfferSize = totalOfferValue / totalOfferCount;
                const pipelineCoverage = totalTarget > 0 ? Math.round((totalOfferValue / totalTarget) * 100) : 0;

                conversion.push({ text: `📊 Pipeline coverage: ${pipelineCoverage}% of target (${fmtVal(totalOfferValue)} pipeline vs ${fmtVal(totalTarget)} target) — ${pipelineCoverage >= 300 ? 'healthy pipeline' : pipelineCoverage >= 200 ? 'adequate coverage' : 'pipeline needs building'}`, type: pipelineCoverage >= 300 ? 'success' : pipelineCoverage >= 200 ? 'info' : 'warning' });
                conversion.push({ text: `💰 Average deal size: ${fmtVal(avgDealSize)} per won order | Average offer size: ${fmtVal(avgOfferSize)} per offer`, type: 'info' });

                if (totalWonCount > 0 && totalOfferCount > 0) {
                    const winRatio = `${totalWonCount}:${totalOfferCount}`;
                    conversion.push({ text: `🎯 Win ratio: ${winRatio} (${totalWonCount} won from ${totalOfferCount} offers = ${overallHitRate}%)`, type: overallHitRate >= 25 ? 'success' : 'info' });
                }

                // Offer value vs won value gap
                const funnelLeakage = totalOfferValue > 0 ? Math.round(((totalOfferValue - totalWonValue) / totalOfferValue) * 100) : 0;
                if (funnelLeakage > 0) {
                    conversion.push({ text: `🔄 Funnel efficiency: ${fmtVal(totalWonValue)} captured from ${fmtVal(totalOfferValue)} pipeline (${100 - funnelLeakage}% conversion, ${funnelLeakage}% still in funnel or lost)`, type: 'info' });
                }
            }

            // ── 5. RECOMMENDATIONS
            const recommendations: { text: string; type: string }[] = [];
            if (overallAchievement < 50) {
                recommendations.push({ text: `Increase pipeline generation significantly — current pipeline is insufficient to meet targets`, type: 'action' });
            }
            if (overallHitRate < 15 && totalOfferCount >= 5) {
                recommendations.push({ text: `Focus on improving offer quality and follow-ups — hit rate of ${overallHitRate}% indicates opportunity for better conversion`, type: 'action' });
            }
            if (totalOfferCount > 0 && totalWonCount === 0) {
                recommendations.push({ text: `No orders won yet in this period — prioritize closing pending offers`, type: 'action' });
            }

            const lowConvProducts = productGrowthData.filter(p => p.offerCount >= 3 && p.hitRatePercent < 10);
            if (lowConvProducts.length > 0) {
                recommendations.push({ text: `Review pricing and approach for ${lowConvProducts.map(p => p.productLabel).join(', ')} — high activity but low conversion`, type: 'action' });
            }

            const underperformingProducts = productGrowthData.filter(p => p.target > 0 && p.achievementPercent < 25);
            if (underperformingProducts.length > 0) {
                recommendations.push({ text: `Allocate more resources to ${underperformingProducts.map(p => p.productLabel).join(', ')} to close the target gap`, type: 'action' });
            }

            if (gap > 0 && requiredMonthlyPace > avgMonthlyWon * 2) {
                recommendations.push({ text: `Target gap of ${fmtVal(gap)} requires ${(requiredMonthlyPace / avgMonthlyWon).toFixed(1)}x current monthly pace — consider target reforecasting or exceptional measures`, type: 'action' });
            }

            if (recommendations.length === 0 && overallAchievement >= 100) {
                recommendations.push({ text: `Excellent performance! Consider setting stretch targets for continued growth`, type: 'action' });
                recommendations.push({ text: `Document successful strategies from this period for replication`, type: 'action' });
            }

            const insights = {
                performance,
                trends,
                products,
                conversion,
                recommendations,
            };

            // Get zone list for filter dropdown
            const allZones = await prisma.serviceZone.findMany({
                where: { isActive: true },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            });

            // Get users for filter dropdown (if zoneId is selected)
            let zoneUsers: { id: number; name: string }[] = [];
            if (filterZoneId) {
                const usersInZone = await prisma.user.findMany({
                    where: {
                        isActive: true,
                        OR: [
                            {
                                role: { in: ['ZONE_MANAGER', 'ZONE_USER'] },
                                serviceZones: { some: { serviceZoneId: filterZoneId } },
                            },
                            {
                                role: 'ADMIN',
                                createdOffers: { some: { zoneId: filterZoneId } },
                            },
                        ],
                    },
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
                });
                zoneUsers = usersInZone.map(u => ({ id: u.id, name: u.name || `User ${u.id}` }));
            }

            return res.json({
                year: targetYear,
                fromMonth: startMonth,
                toMonth: endMonth,
                filters: {
                    zoneId: filterZoneId,
                    userId: filterUserId,
                    zones: allZones,
                    users: zoneUsers,
                },
                totals: {
                    target: totalTarget,
                    offerValue: totalOfferValue,
                    wonValue: totalWonValue,
                    offerCount: totalOfferCount,
                    wonCount: totalWonCount,
                    achievementPercent: totalTarget > 0 ? Math.round((totalWonValue / totalTarget) * 1000) / 10 : 0,
                    hitRatePercent: totalOfferValue > 0 ? Math.round((totalWonValue / totalOfferValue) * 1000) / 10 : 0,
                },
                monthlyData: totalMonthlyData,
                productData: productGrowthData,
                insights,
            });
        } catch (error: any) {
            logger.error('Get Growth Report error:', error);
            return res.status(500).json({ error: 'Failed to fetch Growth Report data' });
        }
    }
}

