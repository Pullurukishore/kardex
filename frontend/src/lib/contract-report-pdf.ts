/**
 * Contract Reports PDF Generation Utility — Kardex Brand Design
 * Generates an executive, customer-grouped PDF using jsPDF + autoTable
 * Tailored for PM planning, technician assignments, and visit execution
 */
import {
    kardexBlue,
    kardexGreen,
    kardexGrey,
    kardexSilver,
    kardexRed,
    kardexSand
} from './kardex-colors';
import { normalizeEngineerNames, formatEngineerDisplayName } from './utils';

// ============ Color Helpers ============
const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
};

// ============ Kardex Brand Color Palette ============
const COLORS = {
    headerBg: hexToRgb(kardexBlue[3]),      // [84, 106, 122] - #546A7A
    headerLight: hexToRgb(kardexBlue[2]),   // [111, 138, 157] - #6F8A9D
    accentCyan: hexToRgb(kardexBlue[1]),    // [150, 174, 194] - #96AEC2
    kardexGreen: hexToRgb(kardexGreen[2]),  // [130, 160, 148] - #82A094
    kardexGreenDark: hexToRgb(kardexGreen[3]), // [79, 106, 100] - #4F6A64
    kardexSand: hexToRgb(kardexSand[2]),    // [206, 159, 107] - #CE9F6B
    kardexRed: hexToRgb(kardexRed[1]),      // [225, 127, 112] - #E17F70
    kardexSilver: hexToRgb(kardexSilver[1]),// [171, 172, 169]
    // Surfaces
    cardBg: [255, 255, 255] as [number, number, number],
    cardBorder: [226, 232, 240] as [number, number, number],
    offWhite: [248, 250, 252] as [number, number, number],
    // Text
    white: [255, 255, 255] as [number, number, number],
    textDark: [30, 41, 59] as [number, number, number],
    textBody: [71, 85, 105] as [number, number, number],
    textMuted: [148, 163, 184] as [number, number, number],
};

// Curated Kardex brand color palette for customer header banners
const CUSTOMER_HEADER_COLORS: [number, number, number][] = [
    hexToRgb(kardexBlue[3]),    // [84, 106, 122] - Kardex Dark Blue
    hexToRgb(kardexGreen[3]),   // [79, 106, 100] - Kardex Dark Green
    hexToRgb(kardexSand[3]),    // [151, 110, 68] - Kardex Dark Sand
    hexToRgb(kardexBlue[2]),    // [111, 138, 157] - Kardex Slate Blue
    hexToRgb(kardexGreen[2]),   // [130, 160, 148] - Kardex Teal Green
    hexToRgb(kardexRed[2]),     // [158, 59, 71]  - Kardex Wine Red
];

// ============ Formatting Helpers ============
// Use standard ASCII suffix "Rs." instead of unicode "₹" to avoid character encoding issues in standard PDF fonts
const fmtCurrency = (v: number | null | undefined): string => {
    if (v === null || v === undefined || v === 0) return '0 Rs.';
    return `${Number(v).toLocaleString('en-IN')} Rs.`;
};

const fmtDatePdf = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateBadge = (dStr?: string) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const parseDateObj = (str: string): Date | null => {
    if (!str) return null;
    str = str.trim();

    // Check DD/MM/YYYY or DD.MM.YYYY
    const slashDot = str.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/);
    if (slashDot) {
        const d = parseInt(slashDot[1], 10);
        const m = parseInt(slashDot[2], 10) - 1;
        let y = parseInt(slashDot[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, m, d);
    }

    // Check YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    // Check DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (dmyMatch) {
        let y = parseInt(dmyMatch[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    }

    // Check DD-MMM-YYYY or DD MMM YYYY (e.g. 15-Oct-2026, 15 Oct 2026)
    const wordMatch = str.match(/^(\d{1,2})[-\s]+([A-Za-z]+)[-\s]+(\d{2,4})$/);
    if (wordMatch) {
        const d = parseInt(wordMatch[1], 10);
        const mStr = wordMatch[2].toLowerCase().slice(0, 3);
        const m = months.indexOf(mStr);
        let y = parseInt(wordMatch[3], 10);
        if (y < 100) y += 2000;
        if (m >= 0) return new Date(y, m, d);
    }

    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
};

const parseRangeDatesFormatted = (range: string | null | undefined): { startDate: string; endDate: string } => {
    if (!range) return { startDate: '—', endDate: '—' };
    const parts = range.split(/\s+(?:TO|to|-)\s+/);
    if (parts.length >= 2) {
        const d1 = parseDateObj(parts[0]?.trim());
        const d2 = parseDateObj(parts[parts.length - 1]?.trim());
        return {
            startDate: d1 ? fmtDatePdf(d1.toISOString()) : (parts[0]?.trim() || '—'),
            endDate: d2 ? fmtDatePdf(d2.toISOString()) : (parts[parts.length - 1]?.trim() || '—')
        };
    }
    const d = parseDateObj(range.trim());
    return {
        startDate: d ? fmtDatePdf(d.toISOString()) : range.trim(),
        endDate: '—'
    };
};

const isPMInRange = (pmRange: string | null | undefined, dateFrom?: string, dateTo?: string, status?: string): boolean => {
    if (!dateFrom && !dateTo) return true;
    if (!pmRange) return true;

    const parts = pmRange.split(/\s+(?:TO|to|-)\s+/);
    const startObj = parseDateObj(parts[0]);
    const endObj = parts.length >= 2 ? parseDateObj(parts[parts.length - 1]) : startObj;

    // If dateTo is provided: Any PM scheduled AFTER dateTo must be EXCLUDED!
    if (dateTo) {
        const toObj = new Date(dateTo);
        toObj.setHours(23, 59, 59, 999);
        if (startObj && startObj > toObj) return false;
        if (!startObj && endObj && endObj > toObj) return false;
    }

    // If dateFrom is provided: Completed PMs done before dateFrom are excluded.
    if (dateFrom && status === 'Completed') {
        const fromObj = new Date(dateFrom);
        fromObj.setHours(0, 0, 0, 0);
        if (endObj && endObj < fromObj) return false;
    }

    return true;
};

const isRangeOverdue = (range: string): boolean => {
    try {
        const parts = range.split(/\s+(?:TO|to|-)\s+/);
        const endStr = parts[parts.length - 1]?.trim();
        if (!endStr) return false;
        const now = new Date();
        const endDateObj = parseDateObj(endStr);
        return endDateObj ? endDateObj < now : false;
    } catch { return false; }
};

const getDaysRemainingPdf = (endDate: string): number => {
    if (!endDate) return 0;
    return Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
};

async function loadLogoBase64(): Promise<string | null> {
    try {
        const response = await fetch('/kardex-only.png');
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

function drawGradientHeader(doc: any, pageW: number) {
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setFillColor(...COLORS.headerLight);
    doc.rect(0, 22, pageW, 3, 'F');
    doc.setFillColor(...COLORS.kardexGreen);
    doc.rect(0, 25, pageW, 1, 'F');
}

function drawHeader(doc: any, filters: any, logoBase64: string | null, totalCustomers: number, totalPMs: number): number {
    const pageW = doc.internal.pageSize.getWidth();
    drawGradientHeader(doc, pageW);

    // Logo
    const logoRectW = 45, logoRectH = 15, logoX = 10, logoY = 5;
    doc.setFillColor(...COLORS.white);
    doc.roundedRect(logoX, logoY, logoRectW, logoRectH, 1.5, 1.5, 'F');
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', logoX + 5, logoY + 3.5, 35, 8);
        } catch {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...COLORS.textDark);
            doc.text('KARDEX', logoX + logoRectW / 2, logoY + logoRectH / 2 + 1, { align: 'center' });
        }
    } else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...COLORS.textDark);
        doc.text('KARDEX', logoX + logoRectW / 2, logoY + logoRectH / 2 + 1, { align: 'center' });
    }

    // Title
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...COLORS.white);
    doc.text('PREVENTIVE MAINTENANCE & CONTRACT REPORT', 60, 12);

    // Subtitle / Filters
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.accentCyan);
    const filterParts: string[] = [];
    if (filters.responsible && filters.responsible !== 'All' && filters.responsible !== 'all') filterParts.push(`Responsible: ${filters.responsible}`);
    if (filters.zone && filters.zone !== 'All' && filters.zone !== 'all') filterParts.push(`Zone: ${filters.zone}`);
    if (filters.status && filters.status !== 'All' && filters.status !== 'all') filterParts.push(`Status: ${filters.status}`);
    if (filters.mcType && filters.mcType !== 'All' && filters.mcType !== 'all') filterParts.push(`MC Type: ${filters.mcType}`);
    if (filters.dateFrom || filters.dateTo) {
        filterParts.push(`Date Filter: ${fmtDateBadge(filters.dateFrom)} to ${fmtDateBadge(filters.dateTo)}`);
    }
    const subtitle = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Contracts & PM Portfolios';
    doc.text(subtitle, 60, 19);

    // Date badge on top right
    const badgeW = 62, badgeX = pageW - 72, badgeH = 16, badgeY = 5;
    doc.setFillColor(...COLORS.headerLight);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...COLORS.white);
    if (filters.dateFrom && filters.dateTo) {
        doc.text(`${fmtDateBadge(filters.dateFrom)} – ${fmtDateBadge(filters.dateTo)}`, badgeX + badgeW / 2, badgeY + 6, { align: 'center' });
    } else {
        doc.text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, badgeX + badgeW / 2, badgeY + 6, { align: 'center' });
    }
    doc.setFontSize(6); doc.setTextColor(...COLORS.accentCyan);
    doc.text(`${totalCustomers} Customers (${totalPMs} PMs)  |  Confidential`, badgeX + badgeW / 2, badgeY + 12, { align: 'center' });

    return 30;
}

function drawFooter(doc: any, pageNum: number) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(0, pageH - 8, pageW, 8, 'F');
    doc.setFillColor(...COLORS.kardexGreen);
    doc.rect(0, pageH - 8, pageW, 0.4, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...COLORS.accentCyan);
    doc.text('Kardex  |  Preventive Maintenance & Scheduling Report  |  Confidential', 12, pageH - 3);
    doc.setTextColor(...COLORS.white);
    doc.text(`Page ${pageNum}`, pageW - 20, pageH - 3);
}

function drawKPICard(
    doc: any,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    accentColor: [number, number, number],
    subLabel?: string
) {
    doc.setFillColor(...COLORS.cardBg);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setDrawColor(...COLORS.cardBorder); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, 'S');
    doc.setFillColor(...accentColor);
    doc.rect(x, y, w, 2.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...COLORS.textMuted);
    doc.text(label.toUpperCase(), x + 4, y + 8.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...COLORS.textDark);
    doc.text(value, x + 4, y + 16.5);
    if (subLabel) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...accentColor);
        doc.text(subLabel, x + 4, y + 21.5);
    }
}

// ============ Main Scheduling PDF Generator ============
export async function generateContractReportPdf(
    data: any[],
    summary: any,
    filters: any
): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any;
    const logoBase64 = await loadLogoBase64();
    const pageW = doc.internal.pageSize.getWidth();
    const pageNum = { val: 1 };

    // Calculate total PM stats across all filtered customers
    let totalPMs = 0;
    let completedPMs = 0;
    let pendingPMs = 0;
    let overduePMs = 0;
    let totalContractsCount = 0;
    let totalMachinesCount = 0;

    data.forEach(cust => {
        totalContractsCount += (cust.totalContracts || cust.contracts?.length || 0);
        totalMachinesCount += (cust.totalMachines || 0);
        completedPMs += (cust.pmCompleted || 0);
        overduePMs += (cust.pmOverdue || 0);
        totalPMs += (cust.pmTotal || 0);
    });
    pendingPMs = totalPMs - completedPMs;

    let y = drawHeader(doc, filters, logoBase64, data.length, totalPMs);

    // ── 5 Executive KPI Cards (ASCII safe: no ₹, no ≤) ──
    const cardGap = 4;
    const totalCards = 5;
    const cardW = (pageW - 20 - (totalCards - 1) * cardGap) / totalCards;
    const cardH = 24;

    const pmPct = totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0;

    drawKPICard(
        doc,
        10 + 0 * (cardW + cardGap), y, cardW, cardH,
        'Total PM Visits',
        String(totalPMs),
        COLORS.headerLight,
        `${totalContractsCount} Agreements (${totalMachinesCount} Machines)`
    );

    drawKPICard(
        doc,
        10 + 1 * (cardW + cardGap), y, cardW, cardH,
        'Completed PMs',
        String(completedPMs),
        COLORS.kardexGreen,
        `${pmPct}% Execution Rate`
    );

    drawKPICard(
        doc,
        10 + 2 * (cardW + cardGap), y, cardW, cardH,
        'Pending PMs',
        String(pendingPMs),
        COLORS.kardexSand,
        'Scheduled & Upcoming'
    );

    drawKPICard(
        doc,
        10 + 3 * (cardW + cardGap), y, cardW, cardH,
        'Overdue PMs',
        String(overduePMs),
        overduePMs > 0 ? COLORS.kardexRed : COLORS.kardexGreen,
        overduePMs > 0 ? `${overduePMs} Action Required` : 'On Schedule'
    );

    drawKPICard(
        doc,
        10 + 4 * (cardW + cardGap), y, cardW, cardH,
        'Portfolio Value',
        fmtCurrency(summary?.totalValue || 0),
        COLORS.kardexSand,
        `${data.length} Accounts in View`
    );

    y += cardH + 6;

    // ── Prepare Customer-by-Customer Grouped Rows ──
    const columnHeaderRow = [
        { content: '#', styles: { halign: 'center' } },
        { content: 'PM Visit', styles: { halign: 'center' } },
        { content: 'PM Schedule Window', styles: { halign: 'center' } },
        { content: 'PM Status', styles: { halign: 'center' } },
        { content: 'Completed Date', styles: { halign: 'center' } },
        { content: 'MC Type / SLA', styles: { halign: 'center' } },
        { content: 'Responsible Engineer', styles: { halign: 'left' } },
        { content: 'PO Number', styles: { halign: 'center' } },
        { content: 'Contract Expiry', styles: { halign: 'center' } },
        { content: 'Agreement Value', styles: { halign: 'right' } }
    ].map(col => ({
        ...col,
        styles: {
            fillColor: [71, 85, 105], // Slate-600
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 7,
            valign: 'middle',
            cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
            ...col.styles
        }
    }));

    const body: any[] = [];

    data.forEach((cust: any, custIdx: number) => {
        const contracts = cust.contracts || [];

        // Flatten PMs or contracts for this customer
        const customerPmRows: any[] = [];

        contracts.forEach((c: any) => {
            const applicablePMs = (c.pmSchedules || []).filter((p: any) => p.status !== 'Not Applicable');
            const matchingPMs = applicablePMs.filter((pm: any) => isPMInRange(pm.range, filters.dateFrom, filters.dateTo, pm.status));
            const daysLeft = getDaysRemainingPdf(c.endDate);
            const daysRemainingText = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`;
            const expiryText = c.endDate ? `${fmtDatePdf(c.endDate)} (${daysRemainingText})` : '—';

            if (matchingPMs.length > 0) {
                matchingPMs.forEach((pm: any) => {
                    const isDone = pm.status === 'Completed';
                    const isOverdue = !isDone && pm.range && isRangeOverdue(pm.range);
                    const { startDate: pmStart, endDate: pmEnd } = parseRangeDatesFormatted(pm.range);

                    customerPmRows.push({
                        pmNumber: `PM ${pm.pmNumber}`,
                        schedulePeriod: (pmStart !== '—' || pmEnd !== '—') ? `${pmStart} to ${pmEnd}` : (pm.range || '—'),
                        status: isDone ? 'Completed' : (isOverdue ? 'Overdue' : 'Pending'),
                        completedAt: pm.completedAt ? fmtDatePdf(pm.completedAt) : '—',
                        mcType: c.mcType || '—',
                        responsible: formatEngineerDisplayName(c.responsible),
                        poNo: c.poNo || '—',
                        expiryWithDays: expiryText,
                        amount: c.amount || 0
                    });
                });
            } else {
                // If no specific PMs matched but contract exists, list contract line
                customerPmRows.push({
                    pmNumber: `${c.noOfVisits || 0} Visits`,
                    schedulePeriod: `${fmtDatePdf(c.startDate)} to ${fmtDatePdf(c.endDate)}`,
                    status: c.status || 'Active',
                    completedAt: '—',
                    mcType: c.mcType || '—',
                    responsible: formatEngineerDisplayName(c.responsible),
                    poNo: c.poNo || '—',
                    expiryWithDays: expiryText,
                    amount: c.amount || 0
                });
            }
        });

        // Pick distinct Kardex brand color for this customer
        const customerColor = CUSTOMER_HEADER_COLORS[custIdx % CUSTOMER_HEADER_COLORS.length];

        const placeText = cust.place ? `${cust.place}, ${cust.zoneName || ''} Zone` : `${cust.zoneName || ''} Zone`;
        const valueText = fmtCurrency(cust.totalValue || 0);
        const machinesText = `${cust.totalMachines || 0} Machine${cust.totalMachines !== 1 ? 's' : ''}`;
        const pmProgress = `PM Done: ${cust.pmCompleted || 0}/${cust.pmTotal || 0} (${cust.pmPercentage || 0}%)`;
        const overdueText = (cust.pmOverdue || 0) > 0 ? `[ ${cust.pmOverdue} Overdue ]` : `[ On Track ]`;

        const mcTypes = Array.from(new Set(contracts.map((c: any) => c.mcType).filter(Boolean))).join(', ');
        const mcTypesText = mcTypes ? `   •   SLA: ${mcTypes}` : '';
        const swText = cust.hasSoftwareSupport ? '   •   SW Support: Yes' : '';
        const poNumbers = Array.from(new Set(contracts.map((c: any) => c.poNo).filter(Boolean))).join(', ');
        const poText = poNumbers ? `   •   PO: ${poNumbers}` : '';
        const resp = Array.from(new Set(contracts.flatMap((c: any) => normalizeEngineerNames(c.responsible)))).join(', ');
        const respText = resp ? `   •   Eng: ${resp}` : '';

        // 1. Customer Main Banner Row (Span 10 columns) with distinct Kardex color & rich page details
        body.push([
            {
                content: `${custIdx + 1}.  ${cust.customerName.toUpperCase()}   •   ${placeText}${respText}${mcTypesText}${swText}${poText}   •   ${machinesText}   •   Total Value: ${valueText}   •   ${pmProgress}   •   ${overdueText}`,
                colSpan: 10,
                styles: {
                    fillColor: customerColor,
                    textColor: COLORS.white,
                    fontStyle: 'bold',
                    fontSize: 7.5,
                    cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
                    halign: 'left',
                    valign: 'middle'
                }
            }
        ]);

        // 2. Table Column Headers for this Customer
        body.push(columnHeaderRow);

        // 3. PM / Contract Rows for this Customer
        if (customerPmRows.length === 0) {
            body.push([
                {
                    content: 'No PM visits scheduled for this customer in selected period.',
                    colSpan: 10,
                    styles: {
                        fillColor: COLORS.offWhite,
                        textColor: COLORS.textMuted,
                        fontStyle: 'italic',
                        fontSize: 6.5,
                        halign: 'center',
                        cellPadding: 2.5
                    }
                }
            ]);
        } else {
            customerPmRows.forEach((row: any, rIdx: number) => {
                body.push([
                    String(rIdx + 1),
                    row.pmNumber,
                    row.schedulePeriod,
                    row.status,
                    row.completedAt,
                    row.mcType,
                    row.responsible,
                    row.poNo,
                    row.expiryWithDays,
                    fmtCurrency(row.amount)
                ]);
            });
        }

        // 4. Spacing Gap between customers
        if (custIdx < data.length - 1) {
            body.push([
                {
                    content: '',
                    colSpan: 10,
                    styles: {
                        minCellHeight: 4,
                        fillColor: [255, 255, 255],
                        cellPadding: 0,
                        lineWidth: 0
                    }
                }
            ]);
        }
    });

    autoTable(doc, {
        body,
        startY: y,
        margin: { left: 10, right: 10, bottom: 12 },
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 6.8,
            cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
            textColor: COLORS.textDark,
            lineColor: [226, 232, 240],
            lineWidth: 0.15,
            valign: 'middle',
            overflow: 'linebreak',
        },
        alternateRowStyles: {
            fillColor: COLORS.offWhite,
        },
        columnStyles: {
            0: { cellWidth: 12, halign: 'center' },                               // # (S.No)
            1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },            // PM Visit (PM 1, PM 2)
            2: { cellWidth: 52, halign: 'center' },                              // PM Schedule Window (expanded from 46mm to 52mm)
            3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },            // PM Status (Completed, Overdue, Pending)
            4: { cellWidth: 26, halign: 'center' },                              // Completed Date
            5: { cellWidth: 22, halign: 'center' },                              // MC Type / SLA (Flex Care)
            6: { cellWidth: 35, halign: 'left' },                                // Responsible Engineer
            7: { cellWidth: 22, halign: 'center' },                              // PO Number
            8: { cellWidth: 36, halign: 'center' },                              // Contract Expiry (with days left/overdue)
            9: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: COLORS.textDark }, // Agreement Value
        },
        willDrawCell: (hookData: any) => {
            // If spacer row, don't draw border lines
            if (hookData.section === 'body' && hookData.cell.raw === '') {
                hookData.cell.styles.lineWidth = 0;
                hookData.cell.styles.fillColor = [255, 255, 255];
                return;
            }

            // Highlight PM Status Column (Index 3)
            if (hookData.section === 'body' && hookData.column.index === 3 && typeof hookData.cell.raw === 'string') {
                const val = hookData.cell.raw;
                if (val === 'Completed' || val === 'Active') {
                    hookData.cell.styles.textColor = [79, 106, 100]; // Kardex Green Dark
                    hookData.cell.styles.fontStyle = 'bold';
                } else if (val === 'Overdue' || val === 'Expired') {
                    hookData.cell.styles.textColor = [225, 127, 112]; // Kardex Red
                    hookData.cell.styles.fontStyle = 'bold';
                } else if (val === 'Pending' || val === 'Expiring Soon') {
                    hookData.cell.styles.textColor = [206, 159, 107]; // Kardex Sand
                    hookData.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: () => {
            drawFooter(doc, pageNum.val);
            pageNum.val++;
        }
    });

    // Save PDF
    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`Contract_Schedule_Report_${timestamp}.pdf`);
}
