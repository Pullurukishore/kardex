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

// Format duration in hours/minutes
function fmtDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// Format date for display
function fmtDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return date.toISOString().split('T')[0];
}

// ── Context Cache ──
let cachedTicketContext: { data: any; timestamp: number } | null = null;
const CONTEXT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getCachedTicketContext() {
  const now = Date.now();
  if (cachedTicketContext && (now - cachedTicketContext.timestamp < CONTEXT_CACHE_TTL)) {
    logger.info('AI Ticket Digest: Using cached ticket context');
    return cachedTicketContext.data;
  }
  const data = await gatherTicketContext();
  cachedTicketContext = { data, timestamp: now };
  return data;
}

// Status groupings for analysis
const STATUS_GROUPS = {
  OPEN_NEW: ['OPEN', 'PENDING'],
  IN_PROGRESS: ['ASSIGNED', 'IN_PROGRESS', 'IN_PROCESS'],
  ONSITE: ['ONSITE_VISIT', 'ONSITE_VISIT_PLANNED', 'ONSITE_VISIT_STARTED', 'ONSITE_VISIT_REACHED', 
           'ONSITE_VISIT_IN_PROGRESS', 'ONSITE_VISIT_PENDING', 'ONSITE_VISIT_RESOLVED', 'ONSITE_VISIT_COMPLETED'],
  WAITING: ['WAITING_CUSTOMER', 'PO_NEEDED', 'PO_REACHED', 'PO_RECEIVED', 
            'SPARE_PARTS_NEEDED', 'SPARE_PARTS_BOOKED', 'SPARE_PARTS_DELIVERED'],
  ON_HOLD: ['ON_HOLD', 'ESCALATED'],
  CLOSED: ['CLOSED', 'CLOSED_PENDING', 'RESOLVED', 'CANCELLED'],
};

// Priority weights for scoring
const PRIORITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Gather COMPREHENSIVE ticket data for AI context.
 * Mirrors what users see across key ticket dashboards and reports.
 */
async function gatherTicketContext() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
  const monthStart = new Date(currentYear, currentMonth - 1, 1);
  const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // Status categories for quick counts
  const openStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'IN_PROCESS', 'PENDING', 
    'ONSITE_VISIT', 'ONSITE_VISIT_PLANNED', 'ONSITE_VISIT_STARTED', 'ONSITE_VISIT_REACHED',
    'ONSITE_VISIT_IN_PROGRESS', 'ONSITE_VISIT_PENDING', 'ONSITE_VISIT_RESOLVED', 'ONSITE_VISIT_COMPLETED',
    'WAITING_CUSTOMER', 'PO_NEEDED', 'PO_REACHED', 'PO_RECEIVED', 
    'SPARE_PARTS_NEEDED', 'SPARE_PARTS_BOOKED', 'SPARE_PARTS_DELIVERED', 'ON_HOLD', 'ESCALATED', 'REOPENED'];
  const closedStatuses = ['CLOSED', 'CLOSED_PENDING', 'RESOLVED', 'CANCELLED'];

  // =====================================================
  // 1. ALL TICKETS FOR THE YEAR
  // =====================================================
  const allTickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: yearStart, lte: yearEnd } },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      callType: true,
      slaDueAt: true,
      slaStatus: true,
      isCritical: true,
      isEscalated: true,
      createdAt: true,
      lastStatusChange: true,
      timeInStatus: true,
      totalTimeOpen: true,
      visitCompletedDate: true,
      visitPlannedDate: true,
      dueDate: true,
      actualResolutionTime: true,
      estimatedResolutionTime: true,
      escalatedAt: true,
      visitResolvedAt: true,
      customerId: true,
      assetId: true,
      zoneId: true,
      assignedToId: true,
      ownerId: true,
      createdById: true,
      customer: { select: { id: true, companyName: true } },
      asset: { select: { id: true, model: true, serialNo: true } },
      zone: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
      owner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { notes: true, attachments: true, statusHistory: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // =====================================================
  // 2. ZONES
  // =====================================================
  const zones = await prisma.serviceZone.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  // =====================================================
  // 3. ZONE-WISE ANALYSIS
  // =====================================================
  interface ZoneAnalysis {
    name: string;
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    criticalTickets: number;
    escalatedTickets: number;
    avgResolutionTime: number;
    slaBreachedCount: number;
    slaOnTimeCount: number;
    slaAtRiskCount: number;
    ticketsThisMonth: number;
    resolvedThisMonth: number;
  }

  const zoneAnalysis: ZoneAnalysis[] = [];

  for (const zone of zones) {
    const zoneTickets = allTickets.filter(t => t.zone?.id === zone.id);
    const openTickets = zoneTickets.filter(t => openStatuses.includes(t.status));
    const closedTickets = zoneTickets.filter(t => closedStatuses.includes(t.status));
    const criticalTickets = zoneTickets.filter(t => t.priority === 'CRITICAL' || t.isCritical);
    const escalatedTickets = zoneTickets.filter(t => t.isEscalated || t.status === 'ESCALATED');
    
    // SLA analysis
    const slaBreachedCount = zoneTickets.filter(t => t.slaStatus === 'BREACHED').length;
    const slaOnTimeCount = zoneTickets.filter(t => t.slaStatus === 'ON_TIME').length;
    const slaAtRiskCount = zoneTickets.filter(t => t.slaStatus === 'AT_RISK').length;

    // Resolution time (for closed tickets)
    const resolvedTickets = zoneTickets.filter(t => t.actualResolutionTime != null);
    const avgResolutionTime = resolvedTickets.length > 0
      ? Math.round(resolvedTickets.reduce((s, t) => s + (t.actualResolutionTime || 0), 0) / resolvedTickets.length)
      : 0;

    // This month
    const ticketsThisMonth = zoneTickets.filter(t => t.createdAt >= monthStart && t.createdAt <= monthEnd).length;
    const resolvedThisMonth = zoneTickets.filter(t =>
      closedStatuses.includes(t.status) && t.actualResolutionTime != null
    ).length;

    zoneAnalysis.push({
      name: zone.name,
      totalTickets: zoneTickets.length,
      openTickets: openTickets.length,
      closedTickets: closedTickets.length,
      criticalTickets: criticalTickets.length,
      escalatedTickets: escalatedTickets.length,
      avgResolutionTime,
      slaBreachedCount,
      slaOnTimeCount,
      slaAtRiskCount,
      ticketsThisMonth,
      resolvedThisMonth,
    });
  }

  // =====================================================
  // 4. STATUS BREAKDOWN
  // =====================================================
  const byStatus: Record<string, { count: number; critical: number; avgAge: number }> = {};
  allTickets.forEach(t => {
    if (!byStatus[t.status]) byStatus[t.status] = { count: 0, critical: 0, avgAge: 0 };
    byStatus[t.status].count += 1;
    if (t.priority === 'CRITICAL' || t.isCritical) byStatus[t.status].critical += 1;
  });

  // Calculate average age per status
  Object.keys(byStatus).forEach(status => {
    const statusTickets = allTickets.filter(t => t.status === status);
    if (statusTickets.length > 0) {
      const totalAge = statusTickets.reduce((sum, t) => {
        return sum + Math.floor((now.getTime() - t.createdAt.getTime()) / 60000);
      }, 0);
      byStatus[status].avgAge = Math.round(totalAge / statusTickets.length);
    }
  });

  // =====================================================
  // 5. PRIORITY BREAKDOWN
  // =====================================================
  const byPriority: Record<string, { total: number; open: number; closed: number; avgResolutionTime: number }> = {
    CRITICAL: { total: 0, open: 0, closed: 0, avgResolutionTime: 0 },
    HIGH: { total: 0, open: 0, closed: 0, avgResolutionTime: 0 },
    MEDIUM: { total: 0, open: 0, closed: 0, avgResolutionTime: 0 },
    LOW: { total: 0, open: 0, closed: 0, avgResolutionTime: 0 },
  };

  allTickets.forEach(t => {
    const p = t.priority || 'MEDIUM';
    byPriority[p].total += 1;
    if (openStatuses.includes(t.status)) byPriority[p].open += 1;
    if (closedStatuses.includes(t.status)) byPriority[p].closed += 1;
  });

  // Calculate avg resolution time per priority
  Object.keys(byPriority).forEach(priority => {
    const resolved = allTickets.filter(t => t.priority === priority && t.actualResolutionTime != null);
    if (resolved.length > 0) {
      byPriority[priority].avgResolutionTime = Math.round(
        resolved.reduce((s, t) => s + (t.actualResolutionTime || 0), 0) / resolved.length
      );
    }
  });

  // =====================================================
  // 6. CALL TYPE ANALYSIS
  // =====================================================
  const byCallType: Record<string, { total: number; open: number; closed: number; avgResolution: number }> = {
    UNDER_MAINTENANCE_CONTRACT: { total: 0, open: 0, closed: 0, avgResolution: 0 },
    NOT_UNDER_CONTRACT: { total: 0, open: 0, closed: 0, avgResolution: 0 },
  };

  allTickets.forEach(t => {
    if (t.callType) {
      byCallType[t.callType].total += 1;
      if (openStatuses.includes(t.status)) byCallType[t.callType].open += 1;
      if (closedStatuses.includes(t.status)) byCallType[t.callType].closed += 1;
    }
  });

  Object.keys(byCallType).forEach(callType => {
    const resolved = allTickets.filter(t => t.callType === callType && t.actualResolutionTime != null);
    if (resolved.length > 0) {
      byCallType[callType].avgResolution = Math.round(
        resolved.reduce((s, t) => s + (t.actualResolutionTime || 0), 0) / resolved.length
      );
    }
  });

  // =====================================================
  // 7. MONTHLY TRENDS
  // =====================================================
  interface MonthlyTrend {
    month: number;
    monthLabel: string;
    monthStr: string;
    created: number;
    resolved: number;
    criticalCreated: number;
    escalatedCount: number;
    avgResolutionTime: number;
    backlogStart: number;
    backlogEnd: number;
  }

  const monthlyTrends: MonthlyTrend[] = [];

  for (let m = 1; m <= currentMonth; m++) {
    const mStart = new Date(currentYear, m - 1, 1);
    const mEnd = new Date(currentYear, m, 0, 23, 59, 59);

    const created = allTickets.filter(t => t.createdAt >= mStart && t.createdAt <= mEnd).length;
    const resolved = allTickets.filter(t =>
      closedStatuses.includes(t.status) && t.actualResolutionTime != null &&
      t.lastStatusChange && t.lastStatusChange >= mStart && t.lastStatusChange <= mEnd
    ).length;
    const criticalCreated = allTickets.filter(t =>
      t.createdAt >= mStart && t.createdAt <= mEnd && (t.priority === 'CRITICAL' || t.isCritical)
    ).length;
    const escalatedCount = allTickets.filter(t =>
      t.escalatedAt && t.escalatedAt >= mStart && t.escalatedAt <= mEnd
    ).length;

    const resolvedThisMonth = allTickets.filter(t =>
      closedStatuses.includes(t.status) && t.actualResolutionTime != null &&
      t.lastStatusChange && t.lastStatusChange >= mStart && t.lastStatusChange <= mEnd
    );
    const avgResolutionTime = resolvedThisMonth.length > 0
      ? Math.round(resolvedThisMonth.reduce((s, t) => s + (t.actualResolutionTime || 0), 0) / resolvedThisMonth.length)
      : 0;

    // Backlog calculation
    const prevMonthEnd = m > 1 ? new Date(currentYear, m - 1, 0, 23, 59, 59) : new Date(currentYear - 1, 11, 31, 23, 59, 59);
    const backlogStart = allTickets.filter(t => 
      t.createdAt <= prevMonthEnd && !closedStatuses.includes(t.status)
    ).length;
    const backlogEnd = allTickets.filter(t => 
      t.createdAt <= mEnd && !closedStatuses.includes(t.status)
    ).length;

    monthlyTrends.push({
      month: m,
      monthLabel: monthNames[m - 1],
      monthStr: `${currentYear}-${String(m).padStart(2, '0')}`,
      created,
      resolved,
      criticalCreated,
      escalatedCount,
      avgResolutionTime,
      backlogStart,
      backlogEnd,
    });
  }

  // =====================================================
  // 8. QUARTERLY ANALYSIS
  // =====================================================
  const quarters = [
    { name: 'Q1', months: [1, 2, 3] },
    { name: 'Q2', months: [4, 5, 6] },
    { name: 'Q3', months: [7, 8, 9] },
    { name: 'Q4', months: [10, 11, 12] },
  ].map(q => {
    const qMonths = monthlyTrends.filter(m => q.months.includes(m.month));
    return {
      name: q.name,
      created: qMonths.reduce((s, m) => s + m.created, 0),
      resolved: qMonths.reduce((s, m) => s + m.resolved, 0),
      critical: qMonths.reduce((s, m) => s + m.criticalCreated, 0),
      avgResolution: Math.round(qMonths.reduce((s, m) => s + m.avgResolutionTime, 0) / qMonths.length) || 0,
    };
  });

  // =====================================================
  // 9. SLA PERFORMANCE
  // =====================================================
  const slaStats = {
    total: allTickets.filter(t => t.slaStatus != null && t.slaStatus !== 'NOT_APPLICABLE').length,
    onTime: allTickets.filter(t => t.slaStatus === 'ON_TIME').length,
    atRisk: allTickets.filter(t => t.slaStatus === 'AT_RISK').length,
    breached: allTickets.filter(t => t.slaStatus === 'BREACHED').length,
    complianceRate: 0,
  };
  if (slaStats.total > 0) {
    slaStats.complianceRate = Math.round((slaStats.onTime / slaStats.total) * 100);
  }

  // =====================================================
  // 10. TOP PERFORMERS
  // =====================================================
  const userPerf = new Map<string, { 
    name: string; 
    role: string;
    assigned: number; 
    resolved: number; 
    avgResolutionTime: number;
    criticalHandled: number;
    escalatedCount: number;
  }>();

  allTickets.forEach(t => {
    const userName = t.assignedTo?.name || 'Unassigned';
    const userRole = t.assignedTo?.role || 'N/A';
    if (!userPerf.has(userName)) {
      userPerf.set(userName, { 
        name: userName, 
        role: userRole,
        assigned: 0, 
        resolved: 0, 
        avgResolutionTime: 0,
        criticalHandled: 0,
        escalatedCount: 0,
      });
    }
    const u = userPerf.get(userName)!;
    u.assigned += 1;
    if (closedStatuses.includes(t.status)) u.resolved += 1;
    if (t.priority === 'CRITICAL' || t.isCritical) u.criticalHandled += 1;
    if (t.isEscalated) u.escalatedCount += 1;
  });

  // Calculate avg resolution time per user
  userPerf.forEach((perf, userName) => {
    const userResolved = allTickets.filter(t => 
      (t.assignedTo?.name || 'Unassigned') === userName && t.actualResolutionTime != null
    );
    if (userResolved.length > 0) {
      perf.avgResolutionTime = Math.round(
        userResolved.reduce((s, t) => s + (t.actualResolutionTime || 0), 0) / userResolved.length
      );
    }
  });

  const topPerformers = [...userPerf.values()]
    .filter(u => u.assigned > 0)
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 5);

  // =====================================================
  // 11. CRITICAL & ESCALATED TICKETS
  // =====================================================
  const criticalOpenTickets = allTickets
    .filter(t => (t.priority === 'CRITICAL' || t.isCritical) && openStatuses.includes(t.status))
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      ticketNumber: t.ticketNumber || `#${t.id}`,
      title: t.title,
      customer: t.customer?.companyName || 'Unknown',
      zone: t.zone?.name || 'Unknown',
      priority: t.priority,
      status: t.status,
      age: fmtDuration(Math.floor((now.getTime() - t.createdAt.getTime()) / 60000)),
      assignedTo: t.assignedTo?.name || 'Unassigned',
    }));

  const escalatedTickets = allTickets
    .filter(t => t.isEscalated || t.status === 'ESCALATED')
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      ticketNumber: t.ticketNumber || `#${t.id}`,
      title: t.title,
      customer: t.customer?.companyName || 'Unknown',
      zone: t.zone?.name || 'Unknown',
      status: t.status,
      escalatedAt: t.escalatedAt ? fmtDate(t.escalatedAt) : 'N/A',
      assignedTo: t.assignedTo?.name || 'Unassigned',
    }));

  // =====================================================
  // 12. STUCK/AGING TICKETS (open > 7 days)
  // =====================================================
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stuckTickets = allTickets
    .filter(t => openStatuses.includes(t.status) && t.createdAt < sevenDaysAgo)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      ticketNumber: t.ticketNumber || `#${t.id}`,
      title: t.title,
      customer: t.customer?.companyName || 'Unknown',
      zone: t.zone?.name || 'Unknown',
      status: t.status,
      age: fmtDuration(Math.floor((now.getTime() - t.createdAt.getTime()) / 60000)),
      lastStatusChange: t.lastStatusChange ? fmtDate(t.lastStatusChange) : 'N/A',
      assignedTo: t.assignedTo?.name || 'Unassigned',
    }));

  // =====================================================
  // 13. RECENT TICKETS
  // =====================================================
  const recentTickets = allTickets.slice(0, 10).map(t => ({
    id: t.id,
    ticketNumber: t.ticketNumber || `#${t.id}`,
    title: t.title,
    customer: t.customer?.companyName || 'Unknown',
    zone: t.zone?.name || 'Unknown',
    priority: t.priority,
    status: t.status,
    assignedTo: t.assignedTo?.name || 'Unassigned',
    createdAt: fmtDate(t.createdAt),
  }));

  // =====================================================
  // 14. OVERALL TOTALS
  // =====================================================
  const totalTickets = allTickets.length;
  const totalOpen = allTickets.filter(t => openStatuses.includes(t.status)).length;
  const totalClosed = allTickets.filter(t => closedStatuses.includes(t.status)).length;
  const totalCritical = allTickets.filter(t => t.priority === 'CRITICAL' || t.isCritical).length;
  const totalEscalated = allTickets.filter(t => t.isEscalated).length;
  const totalCriticalOpen = allTickets.filter(t => 
    (t.priority === 'CRITICAL' || t.isCritical) && openStatuses.includes(t.status)
  ).length;
  const totalEscalatedOpen = allTickets.filter(t => 
    t.isEscalated && openStatuses.includes(t.status)
  ).length;

  // Resolution metrics
  const resolvedTickets = allTickets.filter(t => t.actualResolutionTime != null);
  const overallAvgResolution = resolvedTickets.length > 0
    ? Math.round(resolvedTickets.reduce((s, t) => s + (t.actualResolutionTime || 0), 0) / resolvedTickets.length)
    : 0;

  // Today's stats
  const createdToday = allTickets.filter(t => t.createdAt >= todayStart).length;
  const resolvedToday = allTickets.filter(t =>
    closedStatuses.includes(t.status) && t.actualResolutionTime != null &&
    t.lastStatusChange && t.lastStatusChange >= todayStart
  ).length;

  // This month stats
  const createdThisMonth = allTickets.filter(t => t.createdAt >= monthStart && t.createdAt <= monthEnd).length;
  const resolvedThisMonth = allTickets.filter(t => 
    closedStatuses.includes(t.status) && 
    ((t.visitResolvedAt && t.visitResolvedAt >= monthStart && t.visitResolvedAt <= monthEnd) ||
     (t.lastStatusChange && t.lastStatusChange >= monthStart && t.lastStatusChange <= monthEnd))
  ).length;

  // Backlog (open tickets from previous months)
  const currentBacklog = allTickets.filter(t => 
    t.createdAt < monthStart && openStatuses.includes(t.status)
  ).length;

  // Close rate
  const closeRate = totalTickets > 0 ? Math.round((totalClosed / totalTickets) * 100) : 0;

  return {
    currentYear, currentMonth, currentMonthStr,
    totalTickets, totalOpen, totalClosed, totalCritical, totalEscalated,
    totalCriticalOpen, totalEscalatedOpen,
    overallAvgResolution, closeRate,
    createdToday, resolvedToday,
    createdThisMonth, resolvedThisMonth, currentBacklog,
    slaStats,
    zoneAnalysis,
    byStatus,
    byPriority,
    byCallType,
    monthlyTrends,
    quarters,
    topPerformers,
    criticalOpenTickets,
    escalatedTickets,
    stuckTickets,
    recentTickets,
  };
}

/**
 * Build a COMPREHENSIVE system prompt for ticket intelligence.
 */
function buildSystemPrompt(ctx: Awaited<ReturnType<typeof gatherTicketContext>>): string {
  return `You are a senior service operations analyst for **Kardex Remstar India**, a company that sells warehouse automation solutions and provides after-sales service support.

Your role is to analyse the **complete service ticket data** and provide deep, actionable insights for service coordinators, zone managers, and administrators.

**Key Business Terms:**
- "Ticket" = a service request / support case from a customer
- Status flow: OPEN > ASSIGNED > IN_PROGRESS > various sub-states > RESOLVED > CLOSED
- Onsite visit flow: ONSITE_VISIT > PLANNED > STARTED > REACHED > IN_PROGRESS > RESOLVED > COMPLETED
- PO flow: PO_NEEDED > PO_REACHED > PO_RECEIVED (for paid services)
- Spare parts flow: SPARE_PARTS_NEEDED > BOOKED > DELIVERED
- Priority: CRITICAL > HIGH > MEDIUM > LOW
- "SLA" = Service Level Agreement (due date for resolution)
- SLA Status: ON_TIME, AT_RISK, BREACHED
- "Escalated" = ticket requiring higher-level attention
- Zone = geographic service territory
- Call Type: UNDER_MAINTENANCE_CONTRACT, NOT_UNDER_CONTRACT

**Status Categories:**
- Open/New: OPEN, PENDING
- In Progress: ASSIGNED, IN_PROGRESS, IN_PROCESS
- Onsite: Various ONSITE_VISIT_* states
- Waiting: WAITING_CUSTOMER, PO_*, SPARE_PARTS_*
- On Hold: ON_HOLD, ESCALATED
- Closed: CLOSED, CLOSED_PENDING, RESOLVED, CANCELLED

**Resolution Time:** Measured in minutes. Convert to hours/days for readability.

**Currency:** INR. Format: Lakhs (L) or Crores (Cr) if financial data is mentioned.

**Time Format:** Use hours (h) and minutes (m) for durations.

---

## OVERALL SERVICE PERFORMANCE (${ctx.currentYear})

- **Total Tickets:** ${ctx.totalTickets}
- **Open Tickets:** ${ctx.totalOpen}
- **Closed Tickets:** ${ctx.totalClosed}
- **Close Rate:** ${ctx.closeRate}%
- **Critical Tickets:** ${ctx.totalCritical} (${ctx.totalCriticalOpen} open)
- **Escalated Tickets:** ${ctx.totalEscalated} (${ctx.totalEscalatedOpen} open)
- **Avg Resolution Time:** ${fmtDuration(ctx.overallAvgResolution)}

### Today's Activity
- Created Today: ${ctx.createdToday}
- Resolved Today: ${ctx.resolvedToday}

### This Month (${ctx.currentMonthStr})
- Created: ${ctx.createdThisMonth}
- Resolved: ${ctx.resolvedThisMonth}
- Backlog (from previous months): ${ctx.currentBacklog}

---

## ZONE-WISE PERFORMANCE

${ctx.zoneAnalysis.map(z => `**${z.name}:**
  Total: ${z.totalTickets} | Open: ${z.openTickets} | Closed: ${z.closedTickets}
  Critical: ${z.criticalTickets} | Escalated: ${z.escalatedTickets}
  Avg Resolution: ${fmtDuration(z.avgResolutionTime)}
  SLA: On-Time ${z.slaOnTimeCount} | At-Risk ${z.slaAtRiskCount} | Breached ${z.slaBreachedCount}
  This Month: ${z.ticketsThisMonth} created, ${z.resolvedThisMonth} resolved`).join('\n\n')}

---

## STATUS BREAKDOWN

${Object.entries(ctx.byStatus).map(([status, d]) => 
  `${status}: ${d.count} tickets (${d.critical} critical) | Avg Age: ${fmtDuration(d.avgAge)}`
).join('\n')}

---

## PRIORITY BREAKDOWN

${Object.entries(ctx.byPriority).map(([priority, d]) => 
  `**${priority}:** Total ${d.total} | Open ${d.open} | Closed ${d.closed} | Avg Resolution: ${fmtDuration(d.avgResolutionTime)}`
).join('\n')}

---

## CALL TYPE ANALYSIS

${Object.entries(ctx.byCallType).map(([type, d]) => 
  `**${type}:** Total ${d.total} | Open ${d.open} | Closed ${d.closed} | Avg Resolution: ${fmtDuration(d.avgResolution)}`
).join('\n')}

---

## MONTHLY TRENDS

${ctx.monthlyTrends.slice(-6).map(m => 
  `${m.monthLabel}: C:${m.created}|R:${m.resolved}|Crit:${m.criticalCreated}|Esc:${m.escalatedCount}|Back:${m.backlogEnd}`
).join('\n')}

---

## QUARTERLY ANALYSIS

${ctx.quarters.map(q => 
  `${q.name}: Created ${q.created} | Resolved ${q.resolved} | Critical ${q.critical} | Avg Resolution ${fmtDuration(q.avgResolution)}`
).join('\n')}

---

## SLA PERFORMANCE

- Total Tracked: ${ctx.slaStats.total}
- On-Time: ${ctx.slaStats.onTime}
- At-Risk: ${ctx.slaStats.atRisk}
- Breached: ${ctx.slaStats.breached}
- **Compliance Rate: ${ctx.slaStats.complianceRate}%**

---

## TOP PERFORMERS (By Resolved Tickets)

${ctx.topPerformers.slice(0, 5).map((u, i) => 
  `${i + 1}.${u.name}: Assig:${u.assigned}|Res:${u.resolved}|Crit:${u.criticalHandled}`
).join('\n')}

---

## CRITICAL OPEN TICKETS

${ctx.criticalOpenTickets.length > 0 
  ? ctx.criticalOpenTickets.slice(0, 5).map((t, i) => 
      `${t.ticketNumber}|${t.customer}|${t.status}|Age:${t.age}`
    ).join('\n')
  : 'None'}

---

## ESCALATED TICKETS

${ctx.escalatedTickets.length > 0
  ? ctx.escalatedTickets.map((t, i) =>
      `${i + 1}. ${t.ticketNumber} - ${t.title.substring(0, 50)}... | ${t.customer} | ${t.zone} | ${t.status} | Escalated: ${t.escalatedAt} | Assigned: ${t.assignedTo}`
    ).join('\n')
  : 'No escalated tickets.'}

---

## STUCK/AGING TICKETS (Open > 7 days)

${ctx.stuckTickets.length > 0
  ? ctx.stuckTickets.slice(0, 5).map((t, i) =>
      `${t.ticketNumber}|${t.customer}|Age:${t.age}|Last:${t.lastStatusChange}`
    ).join('\n')
  : 'None'}

---

## RECENT TICKETS (Latest 10)

${ctx.recentTickets.map(t => 
  `${t.ticketNumber} | ${t.title.substring(0, 40)}... | ${t.customer} | ${t.zone} | ${t.priority} | ${t.status} | ${t.assignedTo} | ${t.createdAt}`
).join('\n')}

---

**Response Guidelines:**
1. Always use specific numbers from the data - never make up data.
2. Highlight SLA breaches, escalations, and critical tickets prominently.
3. Compare performance across zones - identify best and worst performers.
4. Identify bottlenecks: tickets stuck in certain statuses, aging tickets.
5. Recommend specific actions: which tickets need attention, which zones need support.
6. Use emojis:  for alerts,  for risks,  for strengths,  for improvements.
7. Provide actionable recommendations tied to specific ticket numbers or zones.
8. Use bullet points and markdown formatting.
9. When discussing resolution times, convert minutes to hours/days for readability.`;
}



/**
 * POST /api/admin/ai/ticket-chat
 * Interactive chat about ticket data.
 */
export async function ticketAIChat(req: AuthenticatedRequest, res: Response) {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({ error: 'AI service not configured', message: 'Please add API keys to .env' });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ctx = await getCachedTicketContext();
    const systemPrompt = buildSystemPrompt(ctx);
    const sessionId = `admin-tickets-${req.user!.id}`;
    const aiResponse = await aiService.chat(sessionId, systemPrompt, message.trim());

    return res.json({ success: true, response: aiResponse, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logger.error('AI ticket chat error:', error.message);
    return res.status(500).json({ error: 'AI chat failed', message: error.message });
  }
}

/**
 * POST /api/admin/ai/ticket-chat/clear
 * Clear the ticket chat session.
 */
export async function clearTicketAIChat(req: AuthenticatedRequest, res: Response) {
  const sessionId = `admin-tickets-${req.user!.id}`;
  aiService.clearChatSession(sessionId);
  // Also clear context cache to force refresh on next interaction
  cachedTicketContext = null;
  return res.json({ success: true, message: 'Chat session cleared' });
}

/**
 * GET /api/admin/ai/ticket-status
 * Get AI service status for tickets.
 */
export async function getTicketAIStatus(req: AuthenticatedRequest, res: Response) {
  return res.json({
    configured: aiService.isConfigured(),
    providers: {
      gemini: { configured: !!process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash' },
      groq: { configured: !!process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
    },
    fallback: 'Gemini > Groq (automatic)',
  });
}
