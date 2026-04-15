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

// Format value in Lakhs/Crores for readability
function fmtVal(val: number): string {
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
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // ══════════════════════════════════════════════════
  // 1. ALL OFFERS FOR THE YEAR
  // ══════════════════════════════════════════════════
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
      poReceivedMonth: true,
      createdAt: true,
      zone: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ══════════════════════════════════════════════════
  // 2. ZONES & TARGETS (matching Forecast page)
  // ══════════════════════════════════════════════════
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
    include: { serviceZone: { select: { name: true } } },
  });

  // Monthly targets per zone
  const allMonthlyTargets = await prisma.zoneTarget.findMany({
    where: {
      targetPeriod: { startsWith: `${currentYear}-` },
      periodType: 'MONTHLY',
      productType: null,
    },
    include: { serviceZone: { select: { name: true } } },
  });

  // ══════════════════════════════════════════════════
  // 3. ZONE-WISE ANALYSIS (mirrors Forecast Zone Summary page)
  // ══════════════════════════════════════════════════
  interface ZoneAnalysis {
    name: string;
    offerCount: number;
    offersValue: number;
    ordersReceived: number;
    openFunnel: number;
    orderBookingThisMonth: number;
    expectedRevenue: number;
    hitRatePercent: number;
    yearlyTarget: number;
    balanceBU: number;
    achievementPercent: number;
    wonCount: number;
    lostCount: number;
  }

  const zoneAnalysis: ZoneAnalysis[] = [];

  for (const zone of zones) {
    const zoneOffers = allOffers.filter(o => o.zone?.id === zone.id);
    const offersValue = zoneOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
    const offerCount = zoneOffers.length;

    // Won offers using poReceivedMonth fallback logic (matching Growth Pillar)
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

    // This month's order booking
    const thisMonthWon = wonOffers.filter(o => o.poReceivedMonth === currentMonthStr);
    const orderBookingThisMonth = thisMonthWon.reduce((s, o) => s + toNum(o.poValue || o.offerValue), 0);

    // Expected revenue (weighted by probability)
    const expectedRevenue = openFunnelOffers.reduce((s, o) => {
      return s + toNum(o.offerValue);
    }, 0);

    // Target for this zone
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
      hitRatePercent: Math.round(hitRate),
      yearlyTarget,
      balanceBU,
      achievementPercent: Math.round(achievement * 10) / 10,
      wonCount: wonOffers.length,
      lostCount: lostOffers.length,
    });
  }

  // ══════════════════════════════════════════════════
  // 4. STAGE BREAKDOWN (mirrors Offers page)
  // ══════════════════════════════════════════════════
  const byStage: Record<string, { count: number; value: number }> = {};
  allOffers.forEach(o => {
    if (!byStage[o.stage]) byStage[o.stage] = { count: 0, value: 0 };
    byStage[o.stage].count += 1;
    byStage[o.stage].value += toNum(o.offerValue);
  });

  // ══════════════════════════════════════════════════
  // 5. PRODUCT TYPE ANALYSIS (mirrors Growth Pillar)
  // ══════════════════════════════════════════════════
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

    // Product-specific target (sum across zones)
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

  // ══════════════════════════════════════════════════
  // 6. MONTHLY TRENDS (mirrors Growth Pillar month-wise)
  // ══════════════════════════════════════════════════
  interface MonthlyTrend {
    month: number;
    monthLabel: string;
    monthStr: string;
    target: number;
    offerValue: number;
    wonValue: number;
    offerCount: number;
    wonCount: number;
    achievementPercent: number;
    growthPercent: number | null;
  }

  const monthlyTrends: MonthlyTrend[] = [];
  for (let m = 1; m <= currentMonth; m++) {
    const monthStr = `${currentYear}-${String(m).padStart(2, '0')}`;
    const monthOffers = allOffers.filter(o => o.offerMonth === monthStr);
    const offerValue = monthOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
    const offerCount = monthOffers.length;

    const wonThisMonth = allOffers.filter(o =>
      (o.stage === 'WON' || o.stage === 'PO_RECEIVED') &&
      ((o.poReceivedMonth && o.poReceivedMonth === monthStr) ||
        (!o.poReceivedMonth && o.offerMonth === monthStr))
    );
    const wonValue = wonThisMonth.reduce((s, o) => s + toNum(o.poValue || o.offerValue), 0);
    const wonCount = wonThisMonth.length;

    // Monthly target (sum across zones)
    const monthTarget = allMonthlyTargets
      .filter(t => t.targetPeriod === monthStr)
      .reduce((s, t) => s + toNum(t.targetValue), 0);

    // Fallback: yearly / 12
    const totalYearlyTarget = zoneAnalysis.reduce((s, z) => s + z.yearlyTarget, 0);
    const target = monthTarget > 0 ? monthTarget : totalYearlyTarget / 12;
    const achievement = target > 0 ? (wonValue / target) * 100 : 0;

    // MoM growth
    let growthPercent: number | null = null;
    if (m > 1) {
      const prevMonth = monthlyTrends[m - 2];
      if (prevMonth && prevMonth.wonValue > 0) {
        growthPercent = Math.round(((wonValue - prevMonth.wonValue) / prevMonth.wonValue) * 100);
      }
    }

    monthlyTrends.push({
      month: m,
      monthLabel: monthNames[m - 1],
      monthStr,
      target,
      offerValue,
      wonValue,
      offerCount,
      wonCount,
      achievementPercent: Math.round(achievement),
      growthPercent,
    });
  }

  // ══════════════════════════════════════════════════
  // 7. QUARTERLY ANALYSIS (mirrors Forecast quarterly)
  // ══════════════════════════════════════════════════
  const totalYearlyTarget = zoneAnalysis.reduce((s, z) => s + z.yearlyTarget, 0);
  const quarterlyBU = totalYearlyTarget / 4;
  const quarters = [
    { name: 'Q1', months: [1, 2, 3] },
    { name: 'Q2', months: [4, 5, 6] },
    { name: 'Q3', months: [7, 8, 9] },
    { name: 'Q4', months: [10, 11, 12] },
  ].map(q => {
    const qMonths = monthlyTrends.filter(m => q.months.includes(m.month));
    const wonValue = qMonths.reduce((s, m) => s + m.wonValue, 0);
    const offerValue = qMonths.reduce((s, m) => s + m.offerValue, 0);
    return {
      name: q.name,
      wonValue,
      offerValue,
      bu: quarterlyBU,
      deviation: quarterlyBU > 0 ? Math.round(((wonValue - quarterlyBU) / quarterlyBU) * 100) : 0,
    };
  });

  // ══════════════════════════════════════════════════
  // 8. TOP PERFORMERS & KEY OFFERS (mirrors Offer details page)
  // ══════════════════════════════════════════════════
  const topWonOffers = allOffers
    .filter(o => o.stage === 'WON' || o.stage === 'PO_RECEIVED')
    .sort((a, b) => toNum(b.poValue || b.offerValue) - toNum(a.poValue || a.offerValue))
    .slice(0, 5)
    .map(o => ({
      ref: o.offerReferenceNumber,
      company: o.company || 'Unknown',
      value: toNum(o.poValue || o.offerValue),
      zone: o.zone?.name || 'Unknown',
    }));

  const highValuePipeline = allOffers
    .filter(o => !['WON', 'LOST'].includes(o.stage))
    .sort((a, b) => toNum(b.offerValue) - toNum(a.offerValue))
    .slice(0, 5)
    .map(o => ({
      ref: o.offerReferenceNumber,
      company: o.company || 'Unknown',
      value: toNum(o.offerValue),
      stage: o.stage,
      probability: o.probabilityPercentage || 0,
      zone: o.zone?.name || 'Unknown',
    }));

  const recentOffers = allOffers.slice(0, 10).map(o => ({
    ref: o.offerReferenceNumber,
    company: o.company || 'Unknown',
    value: toNum(o.offerValue),
    stage: o.stage,
    zone: o.zone?.name || 'Unknown',
    date: o.createdAt.toISOString().split('T')[0],
  }));

  // ══════════════════════════════════════════════════
  // 9. SALES PERSON PERFORMANCE
  // ══════════════════════════════════════════════════
  const userPerf = new Map<string, { name: string; offers: number; wonValue: number; wonCount: number }>();
  allOffers.forEach(o => {
    const userName = o.assignedTo?.name || 'Unassigned';
    if (!userPerf.has(userName)) userPerf.set(userName, { name: userName, offers: 0, wonValue: 0, wonCount: 0 });
    const u = userPerf.get(userName)!;
    u.offers += 1;
    if (o.stage === 'WON' || o.stage === 'PO_RECEIVED') {
      u.wonValue += toNum(o.poValue || o.offerValue);
      u.wonCount += 1;
    }
  });
  const topSalesPersons = [...userPerf.values()]
    .sort((a, b) => b.wonValue - a.wonValue)
    .slice(0, 5);

  // ══════════════════════════════════════════════════
  // 10. OVERALL TOTALS
  // ══════════════════════════════════════════════════
  const totalOfferValue = allOffers.reduce((s, o) => s + toNum(o.offerValue), 0);
  const totalWonValue = zoneAnalysis.reduce((s, z) => s + z.ordersReceived, 0);
  const totalOpenFunnel = zoneAnalysis.reduce((s, z) => s + z.openFunnel, 0);
  const totalOffers = allOffers.length;
  const totalWonCount = allOffers.filter(o => o.stage === 'WON' || o.stage === 'PO_RECEIVED').length;
  const totalLostCount = allOffers.filter(o => o.stage === 'LOST').length;
  const closedCount = totalWonCount + totalLostCount;
  const winRate = closedCount > 0 ? Math.round((totalWonCount / closedCount) * 100) : 0;
  const hitRate = totalOfferValue > 0 ? Math.round((totalWonValue / totalOfferValue) * 100) : 0;
  const overallAchievement = totalYearlyTarget > 0 ? Math.round((totalWonValue / totalYearlyTarget) * 1000) / 10 : 0;

  return {
    currentYear, currentMonth, currentMonthStr,
    totalOffers, totalOfferValue, totalWonValue, totalOpenFunnel,
    totalWonCount, totalLostCount, winRate, hitRate,
    totalYearlyTarget, overallAchievement,
    zoneAnalysis,
    byStage,
    productAnalysis,
    monthlyTrends,
    quarters,
    topWonOffers,
    highValuePipeline,
    recentOffers,
    topSalesPersons,
  };
}

/**
 * Build a COMPREHENSIVE system prompt that mirrors all key pages:
 * Growth Pillar, Forecast, Offer Summary, Targets
 */
function buildSystemPrompt(ctx: Awaited<ReturnType<typeof gatherOfferContext>>): string {
  return `You are a senior business intelligence analyst for **Kardex Remstar India**, a company that sells warehouse automation solutions (vertical lifts, carousels) and provides after-sales services.

Your role is to analyse the **complete sales pipeline data** and provide deep, actionable insights — matching the level of detail shown in the Growth Pillar, Forecast Dashboard, and Offer Summary Reports.

**Key Business Terms:**
- "Offer" = a sales opportunity / deal with value, stage, probability
- Stage flow: INITIAL → PROPOSAL_SENT → NEGOTIATION → PO_RECEIVED → WON (or LOST at any stage)
- "Open Funnel" = active offers not yet won or lost
- "PO" = Purchase Order (when customer confirms)
- "BU" = Business Unit target = Quarterly target (Yearly / 4)
- "Balance BU" = Yearly Target - Orders Received (remaining gap)
- "Hit Rate" = Orders Received / Offers Value (value conversion rate)
- "Win Rate" = Won deals / (Won + Lost deals) (count-based)
- "U for Booking" = Expected revenue from pipeline (probability-weighted)
- Zone = geographic sales territory
- Product types: CONTRACT (CON), BD_SPARE, SPARE_PARTS (SSP), KARDEX_CONNECT (KCN), RELOCATION (REL), SOFTWARE (SFT), OTHERS, RETROFIT_KIT, UPGRADE_KIT (Optilife)
- Currency: INR. Format: Lakhs (L) or Crores (Cr).

═══════════════════════════════════════
📊 OVERALL PERFORMANCE (${ctx.currentYear})
═══════════════════════════════════════
- Total Offers: ${ctx.totalOffers}
- Total Offer Value: ${fmtVal(ctx.totalOfferValue)}
- Orders Received (Won): ${fmtVal(ctx.totalWonValue)} (${ctx.totalWonCount} deals)
- Open Funnel: ${fmtVal(ctx.totalOpenFunnel)}
- Lost: ${ctx.totalLostCount} offers
- Win Rate: ${ctx.winRate}% (count-based)
- Hit Rate: ${ctx.hitRate}% (value-based)
- Yearly Target: ${fmtVal(ctx.totalYearlyTarget)}
- Achievement: ${ctx.overallAchievement}%
- Balance BU (Gap): ${fmtVal(ctx.totalYearlyTarget - ctx.totalWonValue)}

═══════════════════════════════════════
🏢 ZONE-WISE PERFORMANCE (Forecast Summary)
═══════════════════════════════════════
${ctx.zoneAnalysis.map(z => `**${z.name}:**
  Offers: ${z.offerCount} | Value: ${fmtVal(z.offersValue)} | Won: ${fmtVal(z.ordersReceived)} (${z.wonCount} deals)
  Open Funnel: ${fmtVal(z.openFunnel)} | This Month Booking: ${fmtVal(z.orderBookingThisMonth)}
  Expected Revenue: ${fmtVal(z.expectedRevenue)} | Hit Rate: ${z.hitRatePercent}%
  Target: ${fmtVal(z.yearlyTarget)} | Achievement: ${z.achievementPercent}% | Balance BU: ${fmtVal(z.balanceBU)}
  Won: ${z.wonCount} | Lost: ${z.lostCount}`).join('\n\n')}

═══════════════════════════════════════
📦 PRODUCT-WISE ANALYSIS (Growth Pillar)
═══════════════════════════════════════
${ctx.productAnalysis.map(p => `**${p.label} (${p.productType}):**
  Offers: ${p.offerCount} | Value: ${fmtVal(p.offerValue)} | Won: ${fmtVal(p.wonValue)} (${p.wonCount} deals)
  Target: ${fmtVal(p.target)} | Achievement: ${p.achievementPercent}% | Hit Rate: ${p.hitRatePercent}%`).join('\n')}

═══════════════════════════════════════
${ctx.monthlyTrends.slice(-6).map(m => `${m.monthLabel}: T:${fmtVal(m.target)}|O:${fmtVal(m.offerValue)}|W:${fmtVal(m.wonValue)}|Acc:${m.achievementPercent}%`).join('\n')}

═══════════════════════════════════════
📈 QUARTERLY ANALYSIS (Forecast Quarterly)
═══════════════════════════════════════
${ctx.quarters.map(q => `${q.name}: Won ${fmtVal(q.wonValue)} | Pipeline ${fmtVal(q.offerValue)} | BU Target ${fmtVal(q.bu)} | Deviation ${q.deviation > 0 ? '+' : ''}${q.deviation}%`).join('\n')}

═══════════════════════════════════════
🔄 STAGE BREAKDOWN
═══════════════════════════════════════
${Object.entries(ctx.byStage).map(([stage, d]) => `${stage}: ${d.count} offers (${fmtVal(d.value)})`).join('\n')}

═══════════════════════════════════════
${ctx.topWonOffers.slice(0, 5).map((o, i) => `${i + 1}. ${o.ref}|${o.company}|${fmtVal(o.value)}|${o.zone}`).join('\n')}

═══════════════════════════════════════
💰 HIGH-VALUE PIPELINE (Active)
═══════════════════════════════════════
${ctx.highValuePipeline.map((o, i) => `${i + 1}. ${o.ref} — ${o.company} — ${fmtVal(o.value)} — ${o.stage} (${o.probability}% prob) — ${o.zone}`).join('\n')}

═══════════════════════════════════════
👤 SALES PERSON PERFORMANCE
═══════════════════════════════════════
${ctx.topSalesPersons.map((u, i) => `${i + 1}. ${u.name}: ${u.offers} offers, ${fmtVal(u.wonValue)} won (${u.wonCount} deals)`).join('\n')}

═══════════════════════════════════════
📝 RECENT OFFERS (Latest 10)
═══════════════════════════════════════
${ctx.recentOffers.map(o => `${o.ref} | ${o.company} | ${fmtVal(o.value)} | ${o.stage} | ${o.zone} | ${o.date}`).join('\n')}

**Response Guidelines:**
1. Always use specific numbers from the data — never make up data.
2. Currency in ₹, formatted in Lakhs (L) or Crores (Cr).
3. Compare performance across zones, products, months — highlight gaps.
4. Reference what the Growth Pillar, Forecast, and Offer Summary pages show.
5. When discussing targets, always show: Target vs Won vs Gap vs Achievement%.
6. Use ⚠️ for risks, ✅ for strengths, 📈 for growth, 📉 for decline.
7. Provide actionable recommendations tied to specific numbers.
8. Use bullet points and markdown formatting.`;
}



/**
 * POST /api/admin/ai/chat
 */
export async function chatAboutOffers(req: AuthenticatedRequest, res: Response) {
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
export async function clearChat(req: AuthenticatedRequest, res: Response) {
  const sessionId = `admin-offers-${req.user!.id}`;
  aiService.clearChatSession(sessionId);
  // Also clear context cache to force refresh on next interaction
  cachedOfferContext = null;
  return res.json({ success: true, message: 'Chat session cleared' });
}

/**
 * GET /api/admin/ai/status
 */
export async function getAIStatus(req: AuthenticatedRequest, res: Response) {
  return res.json({
    configured: aiService.isConfigured(),
    providers: {
      gemini: { configured: !!process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash' },
      groq: { configured: !!process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
    },
    fallback: 'Gemini → Groq (automatic)',
  });
}
