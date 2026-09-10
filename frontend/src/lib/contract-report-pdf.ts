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
import { normalizeEngineerNames, formatEngineerDisplayName, extractDepartmentFromCustomer } from './utils';

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

// Extracts the PM visit end date from range string (e.g. "11/08/2026 TO 31/08/2026" -> 31/08/2026)
const getPMEndDate = (pmRange: string | null | undefined): Date | null => {
    if (!pmRange) return null;
    const parts = pmRange.split(/\s+(?:TO|to|-)\s+/);
    const endStr = parts.length >= 2 ? parts[parts.length - 1]?.trim() : parts[0]?.trim();
    return parseDateObj(endStr);
};

// Checks if the PM visit ENDS between dateFrom and dateTo
const isPMEndDateInRange = (pmRange: string | null | undefined, dateFrom?: string, dateTo?: string): boolean => {
    if (!dateFrom && !dateTo) return true;
    const endObj = getPMEndDate(pmRange);
    if (!endObj) return false;

    if (dateFrom) {
        const fromObj = new Date(dateFrom);
        fromObj.setHours(0, 0, 0, 0);
        if (endObj < fromObj) return false;
    }

    if (dateTo) {
        const toObj = new Date(dateTo);
        toObj.setHours(23, 59, 59, 999);
        if (endObj > toObj) return false;
    }

    return true;
};

const isRangeOverdue = (range: string): boolean => {
    try {
        const endObj = getPMEndDate(range);
        if (!endObj) return false;
        const now = new Date();
        return endObj < now;
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
    const title = (filters.dateFrom || filters.dateTo)
        ? 'PENDING PREVENTIVE MAINTENANCE VISITS REPORT'
        : 'PREVENTIVE MAINTENANCE & CONTRACT REPORT';
    doc.text(title, 60, 12);

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
    const pmCountLabel = (filters.dateFrom || filters.dateTo) ? 'Pending PMs' : 'PMs';
    doc.text(`${totalCustomers} Customers (${totalPMs} ${pmCountLabel})  |  Confidential`, badgeX + badgeW / 2, badgeY + 12, { align: 'center' });

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

    // Calculate total PM stats across filtered customers
    const isDateFiltered = Boolean(filters.dateFrom || filters.dateTo);
    const now = new Date();

    // Filter to only customers & contracts with PENDING visits that END between dateFrom and dateTo
    const filteredCustomerList: any[] = [];

    data.forEach((cust: any) => {
        const matchingContracts = (cust.contracts || []).filter((ct: any) => {
            const applicablePMs = (ct.pmSchedules || []).filter((p: any) => p.status !== 'Not Applicable');
            const pendingEndingInRange = applicablePMs.filter((p: any) => {
                if (p.status === 'Completed' || p.status === 'Not Applicable') return false;
                if (isDateFiltered) return isPMEndDateInRange(p.range, filters.dateFrom, filters.dateTo);
                return true;
            });
            return pendingEndingInRange.length > 0;
        });

        if (matchingContracts.length > 0) {
            const totalVal = matchingContracts.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
            const totalMach = matchingContracts.reduce((sum: number, c: any) => sum + Number(c.noOfMachine || 0), 0);

            filteredCustomerList.push({
                ...cust,
                contracts: matchingContracts,
                totalContracts: matchingContracts.length,
                totalValue: totalVal,
                totalMachines: totalMach,
            });
        }
    });

    // Compute effective totals from filtered accounts
    let totalPendingPMs = 0;
    let overduePMs = 0;
    let totalContractsCount = 0;
    let totalMachinesCount = 0;
    let totalPortfolioValue = 0;

    filteredCustomerList.forEach(cust => {
        totalContractsCount += cust.contracts.length;
        totalMachinesCount += (cust.totalMachines || 0);
        totalPortfolioValue += (cust.totalValue || 0);
        cust.contracts.forEach((c: any) => {
            const applicablePMs = (c.pmSchedules || []).filter((p: any) => p.status !== 'Not Applicable');
            const matchingPending = applicablePMs.filter((p: any) => {
                if (p.status === 'Completed' || p.status === 'Not Applicable') return false;
                if (isDateFiltered) return isPMEndDateInRange(p.range, filters.dateFrom, filters.dateTo);
                return true;
            });
            totalPendingPMs += matchingPending.length;
            matchingPending.forEach((pm: any) => {
                const endObj = getPMEndDate(pm.range);
                if (endObj && endObj < now) overduePMs += 1;
            });
        });
    });

    let y = drawHeader(doc, filters, logoBase64, filteredCustomerList.length, totalPendingPMs);

    // ── 5 Executive KPI Cards (ASCII safe: no ₹, no ≤) ──
    const cardGap = 4;
    const totalCards = 5;
    const cardW = (pageW - 20 - (totalCards - 1) * cardGap) / totalCards;
    const cardH = 24;

    drawKPICard(
        doc,
        10 + 0 * (cardW + cardGap), y, cardW, cardH,
        'Pending PM Visits',
        String(totalPendingPMs),
        COLORS.headerLight,
        `${totalContractsCount} Agreements in Scope`
    );

    drawKPICard(
        doc,
        10 + 1 * (cardW + cardGap), y, cardW, cardH,
        'Overdue PMs',
        String(overduePMs),
        overduePMs > 0 ? COLORS.kardexRed : COLORS.kardexGreen,
        overduePMs > 0 ? `${overduePMs} Action Required` : 'On Schedule'
    );

    drawKPICard(
        doc,
        10 + 2 * (cardW + cardGap), y, cardW, cardH,
        'Customer Accounts',
        String(filteredCustomerList.length),
        COLORS.kardexSand,
        'Accounts with Pending PMs'
    );

    drawKPICard(
        doc,
        10 + 3 * (cardW + cardGap), y, cardW, cardH,
        'Covered Machines',
        String(totalMachinesCount),
        COLORS.headerLight,
        'Equipment Units'
    );

    drawKPICard(
        doc,
        10 + 4 * (cardW + cardGap), y, cardW, cardH,
        'Portfolio Value',
        fmtCurrency(totalPortfolioValue),
        COLORS.kardexSand,
        'Filtered Agreements Value'
    );

    y += cardH + 6;

    // ── Prepare Customer-by-Customer Grouped Rows ──
    const columnHeaderRow = [
        { content: '#', styles: { halign: 'center' } },
        { content: 'PM Visit', styles: { halign: 'center' } },
        { content: 'PM Schedule Window', styles: { halign: 'center' } },
        { content: 'PM Status', styles: { halign: 'center' } },
        { content: 'Timeline / Due', styles: { halign: 'center' } },
        { content: 'MC Type / SLA', styles: { halign: 'center' } },
        { content: 'Responsible Engineer', styles: { halign: 'left' } },
        { content: 'PO Number', styles: { halign: 'center' } },
        { content: 'Department', styles: { halign: 'center' } },
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

    filteredCustomerList.forEach((cust: any, custIdx: number) => {
        const contracts = cust.contracts || [];
        const customerPmRows: any[] = [];

        contracts.forEach((c: any) => {
            const applicablePMs = (c.pmSchedules || []).filter((p: any) => p.status !== 'Not Applicable');
            const matchingPMs = applicablePMs.filter((pm: any) => {
                if (pm.status === 'Completed' || pm.status === 'Not Applicable') return false;
                if (isDateFiltered) return isPMEndDateInRange(pm.range, filters.dateFrom, filters.dateTo);
                return true;
            });

            const daysLeft = getDaysRemainingPdf(c.endDate);
            const daysRemainingText = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`;
            const expiryText = c.endDate ? `${fmtDatePdf(c.endDate)} (${daysRemainingText})` : '—';
            const deptVal = extractDepartmentFromCustomer(c.customerName, cust.customerName);

            matchingPMs.forEach((pm: any) => {
                const endObj = getPMEndDate(pm.range);
                const isOverdue = endObj ? endObj < now : false;
                const { startDate: pmStart, endDate: pmEnd } = parseRangeDatesFormatted(pm.range);

                let pmDaysDueText = '—';
                if (endObj) {
                    const days = Math.ceil((endObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    pmDaysDueText = days < 0 ? `${Math.abs(days)}d overdue` : (days === 0 ? 'Due today' : `Due in ${days}d`);
                }

                customerPmRows.push({
                    pmNumber: `PM ${pm.pmNumber}`,
                    schedulePeriod: (pmStart !== '—' || pmEnd !== '—') ? `${pmStart} to ${pmEnd}` : (pm.range || '—'),
                    status: isOverdue ? 'Overdue' : 'Pending',
                    dueIn: pmDaysDueText,
                    mcType: c.mcType || '—',
                    responsible: formatEngineerDisplayName(c.responsible),
                    poNo: c.poNo || '—',
                    department: deptVal,
                    expiryWithDays: expiryText,
                    amount: c.amount || 0
                });
            });
        });

        if (customerPmRows.length === 0) return;

        // Pick distinct Kardex brand color for this customer
        const customerColor = CUSTOMER_HEADER_COLORS[custIdx % CUSTOMER_HEADER_COLORS.length];

        const placeText = cust.place ? `${cust.place}, ${cust.zoneName || ''} Zone` : `${cust.zoneName || ''} Zone`;
        const valueText = fmtCurrency(cust.totalValue || 0);
        const machinesText = `${cust.totalMachines || 0} Machine${cust.totalMachines !== 1 ? 's' : ''}`;
        const pmPendingCount = customerPmRows.length;
        const overdueCount = customerPmRows.filter((r: any) => r.status === 'Overdue').length;
        const pmProgress = `${pmPendingCount} Pending Visit${pmPendingCount !== 1 ? 's' : ''}`;
        const overdueText = overdueCount > 0 ? `[ ${overdueCount} Overdue ]` : `[ On Track ]`;

        const mcTypes = Array.from(new Set(contracts.map((c: any) => c.mcType).filter(Boolean))).join(', ');
        const mcTypesText = mcTypes ? `   •   SLA: ${mcTypes}` : '';
        const swText = cust.hasSoftwareSupport ? '   •   SW Support: Yes' : '';
        const poNumbers = Array.from(new Set(contracts.map((c: any) => c.poNo).filter(Boolean))).join(', ');
        const poText = poNumbers ? `   •   PO: ${poNumbers}` : '';
        const resp = Array.from(new Set(contracts.flatMap((c: any) => normalizeEngineerNames(c.responsible)))).join(', ');
        const respText = resp ? `   •   Eng: ${resp}` : '';

        // 1. Customer Main Banner Row (Span 11 columns)
        body.push([
            {
                content: `${custIdx + 1}.  ${cust.customerName.toUpperCase()}   •   ${placeText}${respText}${mcTypesText}${swText}${poText}   •   ${machinesText}   •   Value: ${valueText}   •   ${pmProgress}   •   ${overdueText}`,
                colSpan: 11,
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

        // 3. PM Rows for this Customer
        customerPmRows.forEach((row: any, rIdx: number) => {
            body.push([
                String(rIdx + 1),
                row.pmNumber,
                row.schedulePeriod,
                row.status,
                row.dueIn,
                row.mcType,
                row.responsible,
                row.poNo,
                row.department,
                row.expiryWithDays,
                fmtCurrency(row.amount)
            ]);
        });

        // Customer Subtotal Row
        const customerTotalVal = contracts.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
        body.push([
            {
                content: `Customer Total: ${customerPmRows.length} Pending PM Visit${customerPmRows.length !== 1 ? 's' : ''} across ${contracts.length} Agreement${contracts.length !== 1 ? 's' : ''}`,
                colSpan: 10,
                styles: {
                    fillColor: [241, 245, 249],
                    textColor: COLORS.textDark,
                    fontStyle: 'bold',
                    fontSize: 7,
                    halign: 'right',
                    cellPadding: 2
                }
            },
            {
                content: fmtCurrency(customerTotalVal),
                styles: {
                    fillColor: [241, 245, 249],
                    textColor: COLORS.textDark,
                    fontStyle: 'bold',
                    fontSize: 7,
                    halign: 'right',
                    cellPadding: 2
                }
            }
        ]);

        // Spacing Gap between customers
        if (custIdx < filteredCustomerList.length - 1) {
            body.push([
                {
                    content: '',
                    colSpan: 11,
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

    // Grand Total Row
    if (filteredCustomerList.length > 0) {
        body.push([
            {
                content: `GRAND TOTAL: ${filteredCustomerList.length} Customer Accounts  |  ${totalContractsCount} Agreements  |  ${totalPendingPMs} Pending PM Visits`,
                colSpan: 10,
                styles: {
                    fillColor: COLORS.headerBg,
                    textColor: COLORS.white,
                    fontStyle: 'bold',
                    fontSize: 7.5,
                    halign: 'right',
                    cellPadding: 2.5
                }
            },
            {
                content: fmtCurrency(totalPortfolioValue),
                styles: {
                    fillColor: COLORS.headerBg,
                    textColor: COLORS.white,
                    fontStyle: 'bold',
                    fontSize: 7.5,
                    halign: 'right',
                    cellPadding: 2.5
                }
            }
        ]);
    } else {
        body.push([
            {
                content: 'No pending PM visits ending within the selected date filter range.',
                colSpan: 11,
                styles: {
                    fillColor: COLORS.offWhite,
                    textColor: COLORS.textMuted,
                    fontStyle: 'italic',
                    fontSize: 8,
                    halign: 'center',
                    cellPadding: 5
                }
            }
        ]);
    }

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
            0: { cellWidth: 8, halign: 'center' },                                // # (S.No)
            1: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },            // PM Visit (PM 1, PM 2)
            2: { cellWidth: 44, halign: 'center' },                              // PM Schedule Window
            3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },            // PM Status
            4: { cellWidth: 22, halign: 'center' },                              // Completed Date
            5: { cellWidth: 20, halign: 'center' },                              // MC Type / SLA
            6: { cellWidth: 32, halign: 'left' },                                // Responsible Engineer
            7: { cellWidth: 24, halign: 'center' },                              // PO Number
            8: { cellWidth: 28, halign: 'center' },                              // Department
            9: { cellWidth: 38, halign: 'center' },                              // Contract Expiry
            10: { cellWidth: 29, halign: 'right', fontStyle: 'bold', textColor: COLORS.textDark }, // Agreement Value
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
