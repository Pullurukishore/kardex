import { Response } from 'express';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as aiService from '../services/ai.service';

// Helper to convert Decimal / BigInt to number
function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

// Format value in Lakhs/Crores for readability (INR)
function fmtVal(val: number): string {
  if (val === 0) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toFixed(0)}`;
}

// ── Context Cache ──
let cachedOfferContext: { data: any; timestamp: number } | null = null;
const CONTEXT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getCachedOfferContext() {
  const now = Date.now();
  if (cachedOfferContext && (now - cachedOfferContext.timestamp < CONTEXT_CACHE_TTL)) {
    logger.info('AI Digest: Using cached offer context');
    return cachedOfferContext.data;
  }
  const data = await gatherOfferContext();
  cachedOfferContext = { data, timestamp: now };
  return data;
}

/**
 * Gather COMPREHENSIVE offer data for AI context.
 *
 * This mirrors what the user sees across ALL key pages:
 *   - Forecast Zone Summary (zone-wise pipeline, orders, open funnel, BU targets)
 *   - Growth Pillar (target vs offer vs won, monthly trends, product-wise)
 *   - Offer Summary Report (stage breakdown, conversion)
 *   - Targets (yearly/quarterly targets per zone and product type)
 */
async function gatherOfferContext() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // =====================================================
  // 1. ALL OFFERS FOR THE YEAR
  // =====================================================
  const allOffers = await prisma.offer.findMany({
    where: { createdAt: { gte: yearStart, lte: yearEnd } },
    select: {
      id: true,
      offerReferenceNumber: true,
      company: true,
      offerValue: true,
      poValue: true,
      stage: true,
      productType: true,
      probabilityPercentage: true,
      openFunnel: true,
      offerMonth: true,
      poExpectedMonth: true,
      poReceivedMonth: true,
      lead: true,
      createdAt: true,
      updatedAt: true,
      zone: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // =====================================================
  // 2. ZONES & TARGETS
  // =====================================================
  const zones = await prisma.serviceZone.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  // Yearly targets per zone (overall + product-specific)
  const allZoneTargets = await prisma.zoneTarget.findMany({
    where: {
      targetPeriod: String(currentYear),
      periodType: 'YEARLY',
    },
  });

  // User targets for sales person analysis
  const allUserTargets = await prisma.userTarget.findMany({
    where: {
      targetPeriod: String(currentYear),
      periodType: 'YEARLY',
      productType: null,
    },
    include: { user: { select: { name: true } } },
  });

  // Recent stage remarks for qualitative analysis
  const recentRemarks = await prisma.stageRemark.findMany({
    where: {
      offer: { createdAt: { gte: yearStart } }
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: {
      remarks: true,
      stage: true,
      offer: { select: { offerReferenceNumber: true, company: true } },
      createdAt: true
    }
  });

  // =====================================================
  // 3. ZONE-WISE ANALYSIS (Forecast Summary)
  // =====================================================
  interface ZoneAnalysis {
    name: string;
    offerCount: number;
    offersValue: number;
    ordersReceived: number;
    openFunnel: number;
    orderBookingThisMonth: number;
    expectedRevenue: number;
    weightedPipeline: number;
    hitRatePercent: number;
    yearlyTarget: number;
    balanceBU: number;
    achievementPercent: number;
    wonCount: number;
    lostCount: number;
    stagnantCount: number;
    avgAgingDays: number;
  }

  const zoneAnalysis: ZoneAnalysis[] = [];

  for (const zone of zones) {
    const zoneOffers = allOffers.filter(o => o.zone?.id === zone.id);
    const offersValue = zoneOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
    const offerCount = zoneOffers.length;

    const wonOffers = allOffers.filter(o =>
      o.zone?.id === zone.id &&
      (o.stage === 'WON' || o.stage === 'PO_RECEIVED')
    );
    const ordersReceived = wonOffers.reduce((sum, o) => {
      const effectiveMonth = o.poReceivedMonth || o.offerMonth;
      if (effectiveMonth && effectiveMonth.startsWith(String(currentYear))) {
        return sum + toNum(o.poValue || o.offerValue);
      }
      return sum;
    }, 0);

    const lostOffers = zoneOffers.filter(o => o.stage === 'LOST');
    const openFunnelOffers = zoneOffers.filter(o => o.openFunnel && !['WON', 'LOST'].includes(o.stage));
    const openFunnel = offersValue - ordersReceived;
    const stagnantCount = openFunnelOffers.filter(o => o.updatedAt < thirtyDaysAgo).length;

    const thisMonthWon = wonOffers.filter(o => o.poReceivedMonth === currentMonthStr);
    const orderBookingThisMonth = thisMonthWon.reduce((s, o) => s + toNum(o.poValue || o.offerValue), 0);

    const expectedRevenue = openFunnelOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
    const weightedPipeline = openFunnelOffers.reduce((s, o) => {
      const prob = o.probabilityPercentage || 0;
      return s + (toNum(o.offerValue) * (prob / 100));
    }, 0);

    const zoneYearlyTargets = allZoneTargets.filter(t => t.serviceZoneId === zone.id);
    const overallTarget = zoneYearlyTargets.find(t => t.productType === null);
    const productTargets = zoneYearlyTargets.filter(t => t.productType !== null);
    const yearlyTarget = overallTarget
      ? toNum(overallTarget.targetValue)
      : productTargets.reduce((s, t) => s + toNum(t.targetValue), 0);

    const balanceBU = yearlyTarget - ordersReceived;
    const hitRate = offersValue > 0 ? (ordersReceived / offersValue) * 100 : 0;
    const achievement = yearlyTarget > 0 ? (ordersReceived / yearlyTarget) * 100 : 0;

    zoneAnalysis.push({
      name: zone.name,
      offerCount,
      offersValue,
      ordersReceived,
      openFunnel,
      orderBookingThisMonth,
      expectedRevenue,
      weightedPipeline,
      hitRatePercent: Math.round(hitRate),
      yearlyTarget,
      balanceBU,
      achievementPercent: Math.round(achievement * 10) / 10,
      wonCount: wonOffers.length,
      lostCount: lostOffers.length,
      stagnantCount,
      avgAgingDays: openFunnelOffers.length > 0 
        ? Math.round(openFunnelOffers.reduce((s, o) => s + (now.getTime() - o.updatedAt.getTime()) / (1000 * 60 * 60 * 24), 0) / openFunnelOffers.length)
        : 0
    });
  }

  // =====================================================
  // 3.5 CUSTOMER CONCENTRATION
  // =====================================================
  const customerPipeline: Record<string, { value: number; count: number }> = {};
  allOffers.filter(o => o.openFunnel).forEach(o => {
    const cust = o.company || 'Unknown';
    if (!customerPipeline[cust]) customerPipeline[cust] = { value: 0, count: 0 };
    customerPipeline[cust].value += toNum(o.offerValue);
    customerPipeline[cust].count += 1;
  });
  const topCustomerRisks = Object.entries(customerPipeline)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 5)
    .map(([name, stats]) => ({ name, ...stats }));

  // =====================================================
  // 3.7 PROBABILITY BRACKETS (Funnel Quality)
  // =====================================================
  const openOffers = allOffers.filter(o => o.openFunnel && !['WON', 'LOST'].includes(o.stage));
  const brackets = {
    COMMIT: { count: 0, value: 0 },    // > 75%
    BEST_CASE: { count: 0, value: 0 }, // 50-75%
    PIPELINE: { count: 0, value: 0 },  // < 50%
  };

  openOffers.forEach(o => {
    const prob = o.probabilityPercentage || 0;
    const val = toNum(o.offerValue);
    if (prob > 75) {
      brackets.COMMIT.count++;
      brackets.COMMIT.value += val;
    } else if (prob >= 50) {
      brackets.BEST_CASE.count++;
      brackets.BEST_CASE.value += val;
    } else {
      brackets.PIPELINE.count++;
      brackets.PIPELINE.value += val;
    }
  });

  // =====================================================
  // 4. STAGE BREAKDOWN
  // =====================================================
  const byStage: Record<string, { count: number; value: number }> = {};
  allOffers.forEach(o => {
    if (!byStage[o.stage]) byStage[o.stage] = { count: 0, value: 0 };
    byStage[o.stage].count += 1;
    byStage[o.stage].value += toNum(o.offerValue);
  });

  const byLead: Record<string, number> = {};
  allOffers.forEach(o => {
    const l = (o as any).lead || 'UNSPECIFIED';
    byLead[l] = (byLead[l] || 0) + 1;
  });

  // =====================================================
  // 5. PRODUCT TYPE ANALYSIS (Growth Pillar)
  // =====================================================
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

  interface ProductAnalysis {
    productType: string;
    label: string;
    offerCount: number;
    offerValue: number;
    wonValue: number;
    wonCount: number;
    target: number;
    achievementPercent: number;
    hitRatePercent: number;
  }

  const productAnalysis: ProductAnalysis[] = [];
  for (const pt of productTypes) {
    const ptOffers = allOffers.filter(o => o.productType === pt.key);
    const offerValue = ptOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
    const wonOffers = ptOffers.filter(o => o.stage === 'WON' || o.stage === 'PO_RECEIVED');
    const wonValue = wonOffers.reduce((s, o) => s + toNum(o.poValue || o.offerValue), 0);

    const ptTarget = allZoneTargets
      .filter(t => t.productType === pt.key)
      .reduce((s, t) => s + toNum(t.targetValue), 0);

    const achievement = ptTarget > 0 ? (wonValue / ptTarget) * 100 : 0;
    const hitRate = offerValue > 0 ? (wonValue / offerValue) * 100 : 0;

    if (ptOffers.length > 0 || ptTarget > 0) {
      productAnalysis.push({
        productType: pt.key,
        label: pt.label,
        offerCount: ptOffers.length,
        offerValue,
        wonValue,
        wonCount: wonOffers.length,
        target: ptTarget,
        achievementPercent: Math.round(achievement * 10) / 10,
        hitRatePercent: Math.round(hitRate * 10) / 10,
      });
    }
  }

  // =====================================================
  // 6. MONTHLY TRENDS & FORWARD FORECAST
  // =====================================================
  const monthlyTrends = [];
  const _yearlyBU = allZoneTargets.filter(t => t.productType === null).reduce((s, t) => s + toNum(t.targetValue), 0);
  const monthlyBU = _yearlyBU / 12; // Flat monthly target
  for (let m = 1; m <= 12; m++) {
    const monthStr = `${currentYear}-${String(m).padStart(2, '0')}`;
    const monthOffers = allOffers.filter(o => o.offerMonth === monthStr);
    const wonThisMonth = allOffers.filter(o => (o.poReceivedMonth || o.offerMonth) === monthStr && (o.stage === 'WON' || o.stage === 'PO_RECEIVED'));
    
    // Growth calculation (MoM)
    let growthPercent = null;
    let wonValue = wonThisMonth.reduce((s, o) => s + toNum(o.poValue || o.offerValue), 0);
    
    if (m > 1) {
      const prevMonthStr = `${currentYear}-${String(m - 1).padStart(2, '0')}`;
      const wonPrevMonth = allOffers.filter(o => (o.poReceivedMonth || o.offerMonth) === prevMonthStr && (o.stage === 'WON' || o.stage === 'PO_RECEIVED'));
      const prevWonValue = wonPrevMonth.reduce((s, o) => s + toNum(o.poValue || o.offerValue), 0);
      
      if (prevWonValue > 0) {
        growthPercent = Math.round(((wonValue - prevWonValue) / prevWonValue) * 100);
      }
    }

    const offerValue = monthOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
    const hitRate = offerValue > 0 ? Math.round((wonValue / offerValue) * 100) : 0;
    const achievement = monthlyBU > 0 ? Math.round((wonValue / monthlyBU) * 100) : 0;

    monthlyTrends.push({
      month: m,
      monthLabel: monthNames[m - 1],
      offerCount: monthOffers.length,
      offerValue,
      wonValue,
      hitRate,
      achievement,
      growthPercent,
      target: monthlyBU
    });
  }

  const forwardForecast = [];
  for (let i = 0; i < 4; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const futureMonthStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;
    const futureOffers = allOffers.filter(o => o.poExpectedMonth === futureMonthStr && !['WON', 'LOST', 'PO_RECEIVED'].includes(o.stage));
    
    forwardForecast.push({
      monthLabel: monthNames[futureDate.getMonth()],
      offerCount: futureOffers.length,
      value: futureOffers.reduce((s, o) => s + toNum(o.offerValue), 0),
      weighted: futureOffers.reduce((s, o) => s + (toNum(o.offerValue) * (o.probabilityPercentage || 0) / 100), 0)
    });
  }

  // =====================================================
  // 7. QUARTERLY ANALYSIS
  // =====================================================
  const quarters = [
    { name: 'Q1', months: ['01', '02', '03'] },
    { name: 'Q2', months: ['04', '05', '06'] },
    { name: 'Q3', months: ['07', '08', '09'] },
    { name: 'Q4', months: ['10', '11', '12'] }
  ].map(q => {
    const qWon = allOffers.filter(o => q.months.some(m => (o.poReceivedMonth || o.offerMonth) === `${currentYear}-${m}`) && (o.stage === 'WON' || o.stage === 'PO_RECEIVED'));
    const qPipeline = allOffers.filter(o => q.months.some(m => o.offerMonth === `${currentYear}-${m}`) && !['WON', 'LOST', 'PO_RECEIVED'].includes(o.stage));
    const wonValue = qWon.reduce((s, o) => s + toNum(o.poValue || o.offerValue), 0);
    const pipelineValue = qPipeline.reduce((s, o) => s + toNum(o.offerValue), 0);
    const bu = allZoneTargets.reduce((s, t) => s + toNum(t.targetValue), 0) / 4;
    const deviation = bu > 0 ? Math.round(((wonValue - bu) / bu) * 100) : 0;
    
    return { name: q.name, wonValue, pipelineValue, bu, deviation };
  });

  // =====================================================
  // 8. SALES PERSON PERFORMANCE (Detailed Pipeline)
  // =====================================================
  const userPerformanceMap: Record<number, { name: string; target: number; openFunnel: number; wonValue: number; monthly: Record<number, { w: number, o: number }> }> = {};
  
  // Initialize users with targets
  allUserTargets.forEach(u => {
    userPerformanceMap[u.userId] = { name: u.user.name || 'Unknown', target: toNum(u.targetValue), openFunnel: 0, wonValue: 0, monthly: {} };
  });

  // Add info from all offers
  allOffers.forEach(o => {
    const userId = o.assignedTo?.id;
    const userName = o.assignedTo?.name || 'Unassigned';
    if (!userId) return;

    if (!userPerformanceMap[userId]) {
      userPerformanceMap[userId] = { name: userName, target: 0, openFunnel: 0, wonValue: 0, monthly: {} };
    }

    if (o.stage === 'WON' || o.stage === 'PO_RECEIVED') {
      userPerformanceMap[userId].wonValue += toNum(o.poValue || o.offerValue);
      // Track Monthly Won
      const wMonthStr = o.poReceivedMonth || o.offerMonth;
      if (wMonthStr && wMonthStr.startsWith(String(currentYear))) {
        const mNode = parseInt(wMonthStr.split('-')[1], 10);
        if (!userPerformanceMap[userId].monthly[mNode]) userPerformanceMap[userId].monthly[mNode] = { w: 0, o: 0 };
        userPerformanceMap[userId].monthly[mNode].w += toNum(o.poValue || o.offerValue);
      }
    } else if (o.openFunnel && o.stage !== 'LOST') {
      userPerformanceMap[userId].openFunnel += toNum(o.offerValue);
      // Track Monthly Pipeline
      const oMonthStr = o.poExpectedMonth;
      if (oMonthStr && oMonthStr.startsWith(String(currentYear))) {
        const mNode = parseInt(oMonthStr.split('-')[1], 10);
        if (!userPerformanceMap[userId].monthly[mNode]) userPerformanceMap[userId].monthly[mNode] = { w: 0, o: 0 };
        userPerformanceMap[userId].monthly[mNode].o += toNum(o.offerValue);
      }
    }
  });

  const salesPersonPerformance = Object.values(userPerformanceMap).map(u => {
    const achievement = u.target > 0 ? Math.round((u.wonValue / u.target) * 100) : 0;
    
    // Format monthly string
    const monthlyStr = Object.keys(u.monthly).length > 0 
      ? Object.entries(u.monthly)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([m, val]) => `${monthNames[Number(m)-1]}: W=${fmtVal(val.w)} O=${fmtVal(val.o)}`)
          .join(', ')
      : 'No activity';
      
    return { ...u, achievement, monthlyStr };
  }).sort((a, b) => b.wonValue - a.wonValue);

  // =====================================================
  // 9. HIGH VALUE PIPELINE & TOP WON
  // =====================================================
  const highValuePipeline = allOffers
    .filter(o => !['WON', 'LOST', 'PO_RECEIVED'].includes(o.stage))
    .sort((a, b) => toNum(b.offerValue) - toNum(a.offerValue))
    .slice(0, 10)
    .map(o => ({
      ref: o.offerReferenceNumber,
      company: o.company || 'Unknown',
      value: toNum(o.offerValue),
      stage: o.stage,
      probability: o.probabilityPercentage || 0,
      isStagnant: o.updatedAt < thirtyDaysAgo
    }));

  const topWonOffers = allOffers
    .filter(o => o.stage === 'WON' || o.stage === 'PO_RECEIVED')
    .sort((a, b) => toNum(b.poValue || b.offerValue) - toNum(a.poValue || a.offerValue))
    .slice(0, 5)
    .map(o => ({
      ref: o.offerReferenceNumber,
      company: o.company || 'Unknown',
      value: toNum(o.poValue || o.offerValue),
      zone: o.zone?.name || 'Unknown'
    }));

  const totalYearlyTarget = allZoneTargets
    .filter(t => t.productType === null)
    .reduce((s, t) => s + toNum(t.targetValue), 0);

  const totalOfferValue = allOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
  const totalWonValue = zoneAnalysis.reduce((s, z) => s + z.ordersReceived, 0);
  const totalOpenFunnel = zoneAnalysis.reduce((s, z) => s + z.openFunnel, 0);
  const totalWeightedPipeline = zoneAnalysis.reduce((s, z) => s + z.weightedPipeline, 0);
  const totalStagnant = zoneAnalysis.reduce((s, z) => s + z.stagnantCount, 0);
  const totalOffers = allOffers.length;
  const totalWonCount = allOffers.filter(o => o.stage === 'WON' || o.stage === 'PO_RECEIVED').length;
  const totalLostCount = allOffers.filter(o => o.stage === 'LOST').length;
  const closedCount = totalWonCount + totalLostCount;
  const winRate = closedCount > 0 ? Math.round((totalWonCount / closedCount) * 100) : 0;
  const hitRate = totalOfferValue > 0 ? Math.round((totalWonValue / totalOfferValue) * 100) : 0;
  const overallAchievement = totalYearlyTarget > 0 ? Math.round((totalWonValue / totalYearlyTarget) * 100) : 0;

  const recentOffers = allOffers.slice(0, 10).map(o => ({
    ref: o.offerReferenceNumber,
    company: o.company || 'Unknown',
    value: toNum(o.offerValue),
    stage: o.stage,
    zone: o.zone?.name || 'Unknown',
    date: o.createdAt.toISOString().split('T')[0],
  }));

  return {
    currentYear, currentMonth, currentMonthStr,
    totalOffers, totalOfferValue, totalWonValue, totalOpenFunnel,
    totalWeightedPipeline, totalStagnant,
    totalWonCount, totalLostCount, winRate, hitRate,
    totalYearlyTarget, overallAchievement,
    zoneAnalysis,
    byStage, byLead,
    productAnalysis,
    monthlyTrends,
    forwardForecast,
    quarters,
    topWonOffers,
    highValuePipeline,
    salesPersonPerformance,
    recentOffers,
    recentRemarks,
    topCustomerRisks,
    brackets
  };
}

/**
 * Build a COMPREHENSIVE system prompt that mirrors all key pages:
 * Growth Pillar, Forecast, Offer Summary, Targets
 */
function buildSystemPrompt(ctx: Awaited<ReturnType<typeof gatherOfferContext>>): string {
  return `You are a senior business intelligence analyst for **Kardex Remstar India**, a company that sells warehouse automation solutions (vertical lifts, carousels) and provides after-sales services.

Your role is to analyse the **complete sales pipeline data** and provide deep, qualitative and quantitative insights - matching the level of detail shown in the Growth Pillar, Forecast Dashboard, and Offer Summary Reports.

**Key Business Terms:**
- "Offer" = a sales opportunity / deal with value, stage, probability
- Stage flow: INITIAL > PROPOSAL_SENT > NEGOTIATION > PO_RECEIVED > WON (or LOST at any stage)
- "Open Funnel" = active offers not yet won or lost
- "PO" = Purchase Order (when customer confirms)
- "BU" = Business Unit target = Quarterly target (Yearly / 4)
- "Balance BU" = Yearly Target - Orders Received (remaining gap)
- "Hit Rate" = Orders Received / Offers Value (value conversion rate)
- "Win Rate" = Won deals / (Won + Lost deals) (count-based)
- "U for Booking" = Expected revenue from pipeline (probability-weighted)
- "Stagnant" = Active offers not updated in > 30 days (High Risk)
- Zone = geographic sales territory
- Product types: CONTRACT (CON), BD_SPARE, SPARE_PARTS (SSP), KARDEX_CONNECT (KCN), RELOCATION (REL), SOFTWARE (SFT), OTHERS, RETROFIT_KIT, UPGRADE_KIT (Optilife)
- Currency: INR. Format: Lakhs (L) or Crores (Cr).

---

## 🏗️ ANALYTICAL FRAMEWORK
When answering, structure your analysis using the same logic seen on the Growth Report and Forecast Dashboards:
1. **Performance Summary**: Use Achievement % and Balance BU to decide if the area is AHEAD, ON_TRACK, or NEEDS_ATTENTION.
2. **Growth Analysis**: Compare Product-wise achievement. Identify "Growth Drivers" (high achievement) vs "Gaps" (low achievement).
3. **Pipeline Health**: Use Stagnant counts, Average Aging, and Customer Concentration to identify risks.
4. **Actionable Recommendations**: Give 3-5 specific bullet points on how to close the BU gap.

---

## 📊 OVERALL PERFORMANCE (${ctx.currentYear})

- **Total Offers:** ${ctx.totalOffers}
- **Total Offer Value:** ${fmtVal(ctx.totalOfferValue)}
- **Orders Received (Won):** ${fmtVal(ctx.totalWonValue)} (${ctx.totalWonCount} deals)
- **Open Funnel:** ${fmtVal(ctx.totalOpenFunnel)}
- **Weighted Pipeline (U for Booking):** ${fmtVal(ctx.totalWeightedPipeline)}
- **Stagnant Offers:** ${ctx.totalStagnant} ⚠️
- **Win Rate:** ${ctx.winRate}% | Hit Rate: ${ctx.hitRate}%
- **Yearly Target:** ${fmtVal(ctx.totalYearlyTarget)}
- **Achievement:** ${ctx.overallAchievement}%
- **Balance BU (Gap):** ${fmtVal(ctx.totalYearlyTarget - ctx.totalWonValue)}

### 🛡️ Pipeline Quality (Brackets):
- **Commit (>75%):** ${ctx.brackets.COMMIT.count} deals | ${fmtVal(ctx.brackets.COMMIT.value)}
- **Best Case (50-75%):** ${ctx.brackets.BEST_CASE.count} deals | ${fmtVal(ctx.brackets.BEST_CASE.value)}
- **Pipeline (<50%):** ${ctx.brackets.PIPELINE.count} deals | ${fmtVal(ctx.brackets.PIPELINE.value)}

---

## 🗺️ ZONE-WISE PERFORMANCE (Forecast Summary)

${ctx.zoneAnalysis.map(z => `**${z.name}:**
  Offers: ${z.offerCount} | Value: ${fmtVal(z.offersValue)} | Won: ${fmtVal(z.ordersReceived)}
  Open Funnel: ${fmtVal(z.openFunnel)} | Weighted: ${fmtVal(z.weightedPipeline)}
  Target: ${fmtVal(z.yearlyTarget)} | Achievement: ${z.achievementPercent}%
  Stagnant: ${z.stagnantCount} ⚠️`).join('\n\n')}

---

## 🌱 PRODUCT-WISE ANALYSIS (Growth Pillar)

${ctx.productAnalysis.map(p => `**${p.label}:**
  Offers: ${p.offerCount} | Won: ${fmtVal(p.wonValue)} | Target: ${fmtVal(p.target)} | Acc: ${p.achievementPercent}%`).join('\n')}

---

## 📈 MONTHLY TRENDS & MoM GROWTH (Growth Report Match)

${ctx.monthlyTrends.filter(m => m.offerCount > 0 || m.wonValue > 0).map(m => `**${m.monthLabel}:** Target ${fmtVal(m.target)} | Won ${fmtVal(m.wonValue)} | Acc ${m.achievement}% | Hit Rate ${m.hitRate}% | MoM Growth ${m.growthPercent !== null ? (m.growthPercent > 0 ? '+' : '') + m.growthPercent + '%' : '-'}`).join('\n')}

---

## 🔮 FORWARD FORECAST (PO Expected Month)

${ctx.forwardForecast.map(f => `**${f.monthLabel}:** ${f.offerCount} offers | Expected: ${fmtVal(f.value)} | Weighted: ${fmtVal(f.weighted)}`).join('\n')}

---

## 📅 QUARTERLY ANALYSIS (Forecast Quarterly)

${ctx.quarters.map(q => `${q.name}: Won ${fmtVal(q.wonValue)} | Pipeline ${fmtVal(q.pipelineValue)} | BU Target ${fmtVal(q.bu)} | Deviation ${q.deviation > 0 ? '+' : ''}${q.deviation}%`).join('\n')}

---

## 🏆 SALES PERSON ACHIEVEMENT (Expanded & Monthly Breakdown)

${ctx.salesPersonPerformance.map((u, i) => `${i + 1}. ${u.name}: Target ${fmtVal(u.target)} | Won ${fmtVal(u.wonValue)} (${u.achievement}%) | Open Funnel ${fmtVal(u.openFunnel)}
    - Monthly: ${u.monthlyStr}`).join('\n')}

---

## 📈 LEAD STATUS (Source Sentiment)

${Object.entries(ctx.byLead).map(([status, count]) => `${status}: ${count} offers`).join('\n')}

---

## 💬 RECENT QUALITATIVE REMARKS

${ctx.recentRemarks.map(r => `-${r.offer.offerReferenceNumber} (${r.offer.company}) @${r.stage}: "${r.remarks}"`).join('\n')}

---

## ⚖️ HIGH-VALUE PIPELINE (Active & Risks)

${ctx.highValuePipeline.map((o, i) => `${i + 1}. ${o.ref} - ${o.company} - ${fmtVal(o.value)} - ${o.stage} (${o.probability}% prob) - ${o.isStagnant ? 'STAGNANT ⚠️' : 'Active'}`).join('\n')}

---

## 🏢 CUSTOMER CONCENTRATION (Top Pipeline Risks)

${ctx.topCustomerRisks.map((c, i) => `${i + 1}. ${c.name}: ${fmtVal(c.value)} (${c.count} offers)`).join('\n')}

**Response Guidelines:**
1. Always use specific numbers from the data - never make up data.
2. Compare Actual vs Target for Zones/Sales Persons.
3. Highlight **Stagnant Offers** as immediate risks for follow-up.
4. Use the **Recent Remarks** to provide qualitative context on WHY deals are moving or stuck.
5. Use the **Forward Forecast** to discuss future revenue visibility.
6. Provide actionable recommendations based on gap analysis.
7. Currency in ₹, formatted in Lakhs (L) or Crores (Cr).`;
}

/**
 * POST /api/admin/ai/chat
 */
export async function offerAIChat(req: AuthenticatedRequest, res: Response) {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({ error: 'AI service not configured', message: 'Please add API keys to .env' });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ctx = await getCachedOfferContext();
    const systemPrompt = buildSystemPrompt(ctx);
    const sessionId = `admin-offers-${req.user!.id}`;
    const aiResponse = await aiService.chat(sessionId, systemPrompt, message.trim());

    return res.json({ success: true, response: aiResponse, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logger.error('AI chat error:', error.message);
    return res.status(500).json({ error: 'AI chat failed', message: error.message });
  }
}

/**
 * POST /api/admin/ai/chat/clear
 */
export async function clearOfferAIChat(req: AuthenticatedRequest, res: Response) {
  const sessionId = `admin-offers-${req.user!.id}`;
  aiService.clearChatSession(sessionId);
  // Also clear context cache to force refresh on next interaction
  cachedOfferContext = null;
  return res.json({ success: true, message: 'Chat session cleared' });
}

/**
 * GET /api/admin/ai/status
 */
export async function getOfferAIStatus(req: AuthenticatedRequest, res: Response) {
  return res.json({
    configured: aiService.isConfigured(),
    providers: {
      gemini: { configured: !!process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash' },
      groq: { configured: !!process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
    },
    fallback: 'Gemini > Groq (automatic)',
  });
}
