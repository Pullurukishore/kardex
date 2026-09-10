/**
 * Contract Reports Excel Export Utility — Official Kardex Brand Design
 * Generates an executive, single-sheet Excel workbook using ExcelJS.
 * Features:
 * - Dynamic PM handling (handles any number of PMs: 1, 2, 4, 6, 7, 12)
 * - Customer Grouping & Portfolio Summary
 * - Clean Contract Row with PO details and financial totals
 * - Nested PM Visit Schedules beneath each contract with exact dates & completion status
 * - Subtotals per customer & Grand Total at bottom
 */
import {
    kardexBlue,
    kardexGreen,
    kardexGrey,
    kardexSilver,
    kardexRed,
    kardexSand,
} from './kardex-colors';
import { normalizeEngineerNames, extractDepartmentFromCustomer } from './utils';

// ============ Types ============
interface PMSchedule {
    id: number;
    pmNumber: number;
    range: string;
    status: 'Completed' | 'Pending' | 'Not Applicable';
    completedAt?: string;
}

interface Contract {
    id: number;
    contractNumber: string;
    customerName: string;
    place: string;
    poNo: string;
    poDate: string;
    mcType: string;
    noOfMachine: number;
    amount: number;
    noOfVisits: number;
    startDate: string;
    endDate: string;
    status: 'Active' | 'Expiring Soon' | 'Expired';
    softwareSupport: boolean;
    pmSchedules: PMSchedule[];
    responsible: string;
    zoneName: string;
    bdCount: number;
    paymentTerms: string;
    scheduledMonth: string;
    customerId?: number;
    zoneId?: number;
}

interface CustomerSummary {
    customerId: number;
    customerName: string;
    place: string;
    zoneName: string;
    totalContracts: number;
    activeContracts: number;
    expiringSoonContracts: number;
    expiredContracts: number;
    totalValue: number;
    totalMachines: number;
    pmCompleted: number;
    pmTotal: number;
    pmOverdue: number;
    pmPercentage: number;
    hasSoftwareSupport: boolean;
    contracts: Contract[];
}

interface OverallSummary {
    totalCustomers: number;
    totalContracts: number;
    active: number;
    expired: number;
    expiring: number;
    totalValue: number;
    totalMachines: number;
    pmCompleted: number;
    pmTotal: number;
    pmOverdue: number;
    pmPct: number;
}

interface ContractExcelFilters {
    zone?: string;
    status?: string;
    responsible?: string;
    mcType?: string;
    dateFrom?: string;
    dateTo?: string;
}

// ============ Color Helpers ============
const c = (hex: string) => hex.replace('#', '');
const solid = (hex: string) => 'FF' + c(hex);

// ============ Official Kardex Brand Color Scheme ============
const COLORS = {
    // Kardex Core Blues
    kardexBlueDark: solid(kardexBlue[3]),    // #546A7A - Executive Header & Grand Totals
    kardexBlueMedium: solid(kardexBlue[2]),  // #6F8A9D - Table Headers
    kardexBlueLight: solid(kardexBlue[1]),   // #96AEC2 - PM sub-headers
    kardexBlueTint: 'FFF0F4F8',             // Soft Ice Blue tint

    // Kardex Green Accent
    kardexGreenMedium: solid(kardexGreen[2]),// #82A094 - Active / Success Accent
    kardexGreenDark: solid(kardexGreen[3]),  // #4F6A64 - Deep Green Text
    kardexGreenTint: 'FFF2F8F5',             // Soft green tint for completed PMs

    // Kardex Sand Accent (Warm)
    kardexSandMedium: solid(kardexSand[2]),  // #CE9F6B - Warning / Value Accent
    kardexSandDark: solid(kardexSand[3]),    // #976E44 - Warm Sand Text
    kardexSandTint: 'FFFCF9F2',              // Soft sand tint for pending PMs

    // Kardex Red (Alerts / Overdue)
    kardexRedDark: solid(kardexRed[2]),      // #9E3B47 - Overdue Text
    kardexRedTint: 'FFFDF2F2',              // Soft red tint for overdue PMs

    // Neutral Surfaces & Borders
    white: 'FFFFFFFF',
    cardHeaderBg: 'FFEBF1F6',                // Kardex soft blue-gray
    subtotalBg: 'FFEAF1F6',                  // Soft Kardex subtotal background
    borderLight: 'FFD5DFE6',                 // Soft Slate Border
    borderMedium: solid(kardexBlue[1]),      // #96AEC2 Accent Border

    // Typography
    textDark: 'FF1E293B',                    // Slate-900 (High contrast)
    textBody: 'FF475569',                    // Slate-600
    textMuted: 'FF64748B',                   // Slate-500
    textWhite: 'FFFFFFFF',
};

// ============ Helpers ============
function numToCol(n: number): string {
    let s = '';
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - m) / 26);
    }
    return s || 'A';
}

const fmtCurrency = (v: number | null | undefined): string => {
    if (v === null || v === undefined || v === 0) return '₹0';
    return '₹' + Number(v).toLocaleString('en-IN');
};

const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'Active': return COLORS.kardexGreenDark;
        case 'Expiring Soon': return COLORS.kardexSandDark;
        case 'Expired': return COLORS.kardexRedDark;
        default: return COLORS.textDark;
    }
};

const thinBorder = (color = COLORS.borderLight) => ({
    top: { style: 'thin' as const, color: { argb: color } },
    left: { style: 'thin' as const, color: { argb: color } },
    bottom: { style: 'thin' as const, color: { argb: color } },
    right: { style: 'thin' as const, color: { argb: color } },
});

const applyHeaderStyle = (cell: any): void => {
    cell.font = { bold: true, color: { argb: COLORS.textWhite }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueMedium } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder(COLORS.kardexBlueDark);
};

const applyDataCell = (cell: any, bgColor: string, opts: { bold?: boolean; isNumber?: boolean; fontColor?: string; align?: 'left' | 'center' | 'right' } = {}): void => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.border = thinBorder();
    cell.alignment = { horizontal: opts.align || (opts.isNumber ? 'right' : 'left'), vertical: 'middle', wrapText: true };
    cell.font = { size: 9, color: { argb: opts.fontColor || COLORS.textDark }, bold: opts.bold || false };
};

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const parseDateObj = (str: string | null | undefined): Date | null => {
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

// ============ Column Definitions (Without Payment Terms) ============
const MAIN_COLUMNS = [
    { header: '#', key: 'slNo', width: 6, align: 'center' as const },
    { header: 'PO Number', key: 'poNo', width: 18, align: 'center' as const },
    { header: 'PO Date', key: 'poDate', width: 14, align: 'center' as const },
    { header: 'Department', key: 'department', width: 18, align: 'center' as const },
    { header: 'MC Type', key: 'mcType', width: 14, align: 'center' as const },
    { header: 'Machines', key: 'noOfMachine', width: 10, align: 'center' as const },
    { header: 'Amount (₹)', key: 'amount', width: 16, align: 'right' as const },
    { header: 'Contract Period', key: 'period', width: 24, align: 'center' as const },
    { header: 'Status', key: 'status', width: 14, align: 'center' as const },
    { header: 'Responsible Engineer', key: 'responsible', width: 22, align: 'left' as const },
    { header: 'Total Visits', key: 'noOfVisits', width: 12, align: 'center' as const },
    { header: 'PM Progress', key: 'pmProgress', width: 16, align: 'center' as const },
    { header: 'SW Support', key: 'softwareSupport', width: 12, align: 'center' as const },
];

// ============ Main Single-Sheet Generator ============
export async function generateContractReportExcel(
    customerSummaries: CustomerSummary[],
    overall: OverallSummary,
    filters: ContractExcelFilters
): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kardex Remstar';
    workbook.lastModifiedBy = 'KardexCare System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const ws = workbook.addWorksheet('Contract Report', {
        properties: { tabColor: { argb: COLORS.kardexBlueDark } },
    });

    const totalCols = MAIN_COLUMNS.length;
    const lastCol = numToCol(totalCols);

    // Set Column Widths
    MAIN_COLUMNS.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width;
    });

    const isDateFiltered = Boolean(filters.dateFrom || filters.dateTo);
    const now = new Date();

    // ── Filter to only customers & contracts with PENDING visits that END between dateFrom and dateTo ──
    const filteredCustomerList: CustomerSummary[] = [];

    customerSummaries.forEach(cs => {
        const matchingContracts = cs.contracts.filter(ct => {
            const applicablePMs = (ct.pmSchedules || []).filter(p => p.status !== 'Not Applicable');
            const pendingEndingInRange = applicablePMs.filter(p => {
                if (p.status === 'Completed' || p.status === 'Not Applicable') return false;
                if (isDateFiltered) return isPMEndDateInRange(p.range, filters.dateFrom, filters.dateTo);
                return true;
            });
            return pendingEndingInRange.length > 0;
        });

        if (matchingContracts.length > 0) {
            const totalVal = matchingContracts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            const totalMach = matchingContracts.reduce((sum, c) => sum + Number(c.noOfMachine || 0), 0);

            filteredCustomerList.push({
                ...cs,
                contracts: matchingContracts,
                totalContracts: matchingContracts.length,
                totalValue: totalVal,
                totalMachines: totalMach,
            });
        }
    });

    // Compute effective totals from filtered accounts
    let effTotalContracts = 0;
    let effTotalCustomers = filteredCustomerList.length;
    let effTotalValue = 0;
    let effTotalMachines = 0;
    let effActive = 0;
    let effExpiring = 0;
    let effExpired = 0;
    let effPendingVisitsCount = 0;

    filteredCustomerList.forEach(cs => {
        effTotalContracts += cs.contracts.length;
        effTotalValue += cs.totalValue;
        effTotalMachines += cs.totalMachines;
        cs.contracts.forEach(c => {
            if (c.status === 'Active') effActive++;
            else if (c.status === 'Expiring Soon') effExpiring++;
            else if (c.status === 'Expired') effExpired++;

            const pending = (c.pmSchedules || []).filter(p => {
                if (p.status === 'Completed' || p.status === 'Not Applicable') return false;
                if (isDateFiltered) return isPMEndDateInRange(p.range, filters.dateFrom, filters.dateTo);
                return true;
            });
            effPendingVisitsCount += pending.length;
        });
    });

    // ── Row 1: Executive Title (Kardex Blue #546A7A) ──
    ws.mergeCells(`A1:${lastCol}1`);
    const titleCell = ws.getCell('A1');
    titleCell.value = 'KARDEX - CONTRACT REPORT (PENDING PM VISITS)';
    titleCell.font = { bold: true, size: 13, color: { argb: COLORS.textWhite } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    // ── Row 2: Kardex Green Accent Stripe (#82A094) ──
    ws.mergeCells(`A2:${lastCol}2`);
    ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexGreenMedium } };
    ws.getRow(2).height = 3.5;

    // ── Row 3: Filter Info Bar ──
    ws.mergeCells(`A3:${lastCol}3`);
    const infoCell = ws.getCell('A3');
    const filterParts: string[] = [];
    if (filters.zone && filters.zone !== 'All') filterParts.push(`Zone: ${filters.zone}`);
    if (filters.status && filters.status !== 'All') filterParts.push(`Status: ${filters.status}`);
    if (filters.responsible && filters.responsible !== 'All') filterParts.push(`Responsible: ${filters.responsible}`);
    if (filters.mcType && filters.mcType !== 'All') filterParts.push(`MC Type: ${filters.mcType}`);
    if (filters.dateFrom || filters.dateTo) filterParts.push(`Period: ${filters.dateFrom || 'Start'} → ${filters.dateTo || 'End'}`);
    const filterStr = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Zones & Statuses';
    infoCell.value = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}  |  ${effTotalCustomers} Customer Accounts (${effPendingVisitsCount} Pending Visits)  |  ${filterStr}`;
    infoCell.font = { size: 9, color: { argb: COLORS.kardexBlueDark }, italic: true };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueTint } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 20;

    // ── Rows 5-6: Executive Kardex KPI Cards ──
    const kpis = [
        { label: 'TOTAL CONTRACTS', value: String(effTotalContracts), accent: COLORS.kardexBlueDark, span: 2 },
        { label: 'TOTAL CUSTOMERS', value: String(effTotalCustomers), accent: COLORS.kardexBlueMedium, span: 2 },
        { label: 'TOTAL MC VALUE', value: fmtCurrency(effTotalValue), accent: COLORS.kardexSandDark, span: 3 },
        { label: 'ACTIVE / EXPIRING / EXPIRED', value: `${effActive} / ${effExpiring} / ${effExpired}`, accent: COLORS.kardexGreenDark, span: 3 },
        { label: 'TOTAL MACHINES', value: String(effTotalMachines), accent: COLORS.kardexBlueDark, span: 1 },
        { label: 'PENDING VISITS', value: String(effPendingVisitsCount), accent: COLORS.kardexSandDark, span: 2 },
    ];

    const kpiLabelRow = 5;
    const kpiValRow = 6;
    ws.getRow(kpiLabelRow).height = 18;
    ws.getRow(kpiValRow).height = 24;

    let colCursor = 1;
    kpis.forEach(kpi => {
        const startCol = colCursor;
        const endCol = Math.min(colCursor + kpi.span - 1, totalCols);
        colCursor = endCol + 1;

        const startLetter = numToCol(startCol);
        const endLetter = numToCol(endCol);

        // Label Cell
        ws.mergeCells(`${startLetter}${kpiLabelRow}:${endLetter}${kpiLabelRow}`);
        const labelCell = ws.getCell(`${startLetter}${kpiLabelRow}`);
        labelCell.value = kpi.label;
        labelCell.font = { bold: true, size: 8, color: { argb: COLORS.textMuted } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.cardHeaderBg } };
        labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
        labelCell.border = thinBorder();

        // Value Cell
        ws.mergeCells(`${startLetter}${kpiValRow}:${endLetter}${kpiValRow}`);
        const valCell = ws.getCell(`${startLetter}${kpiValRow}`);
        valCell.value = kpi.value;
        valCell.font = { bold: true, size: 11, color: { argb: kpi.accent } };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
        valCell.alignment = { horizontal: 'center', vertical: 'middle' };
        valCell.border = thinBorder();
    });

    // ── Row 8: Section Header ──
    let currentRow = 8;
    ws.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const secCell = ws.getCell(`A${currentRow}`);
    secCell.value = 'CUSTOMER-WISE AGREEMENTS & PENDING PREVENTIVE MAINTENANCE SCHEDULES';
    secCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
    secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    secCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(currentRow).height = 22;

    // ── Customer Grouped Blocks ──
    if (filteredCustomerList.length === 0) {
        currentRow += 1;
        ws.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
        const emptyCell = ws.getCell(`A${currentRow}`);
        emptyCell.value = 'No pending PM visits found ending within the selected filter period.';
        emptyCell.font = { italic: true, size: 10, color: { argb: COLORS.textMuted } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(currentRow).height = 28;
    } else {
        filteredCustomerList.forEach((cs, custIdx) => {
            currentRow += 1;

            // Count pending visits for this customer ending in date range
            const custPendingVisits = cs.contracts.flatMap(c =>
                (c.pmSchedules || []).filter(p => {
                    if (p.status === 'Completed' || p.status === 'Not Applicable') return false;
                    if (isDateFiltered) return isPMEndDateInRange(p.range, filters.dateFrom, filters.dateTo);
                    return true;
                })
            ).length;

            // 1. Customer Kardex Blue Banner Row (#546A7A)
            const bannerRow = currentRow;
            ws.mergeCells(`A${bannerRow}:${lastCol}${bannerRow}`);
            const banner = ws.getCell(`A${bannerRow}`);
            const placeStr = cs.place ? `${cs.place}, ${cs.zoneName}` : cs.zoneName;
            banner.value = `${custIdx + 1}.  ${cs.customerName.toUpperCase()}   •   ${placeStr}   •   Agreements: ${cs.contracts.length}   •   Machines: ${cs.totalMachines}   •   Total Value: ${fmtCurrency(cs.totalValue)}   •   Pending Visits in Period: ${custPendingVisits}`;
            banner.font = { bold: true, color: { argb: COLORS.textWhite }, size: 9.5 };
            banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
            banner.alignment = { horizontal: 'left', vertical: 'middle' };
            banner.border = thinBorder(COLORS.kardexBlueDark);
            ws.getRow(bannerRow).height = 24;

            // 2. Table Header Row for this Customer (Kardex Blue Medium #6F8A9D)
            currentRow += 1;
            const tableHeaderRow = currentRow;
            ws.getRow(tableHeaderRow).height = 22;
            MAIN_COLUMNS.forEach((col, i) => {
                const cell = ws.getCell(tableHeaderRow, i + 1);
                cell.value = col.header;
                applyHeaderStyle(cell);
            });

            // 3. Contract Rows & PM Sub-rows for this Customer
            cs.contracts.forEach((ct, cIdx) => {
                currentRow += 1;
                const r = currentRow;
                const engNames = normalizeEngineerNames(ct.responsible).join(', ') || '—';

                const applicablePMs = (ct.pmSchedules || []).filter(p => p.status !== 'Not Applicable');
                const pmDone = applicablePMs.filter(p => p.status === 'Completed').length;
                const pmTot = applicablePMs.length;
                const pmProgStr = pmTot > 0 ? `${pmDone}/${pmTot} (${Math.round((pmDone / pmTot) * 100)}%)` : '—';
                const periodStr = `${fmtDate(ct.startDate)} → ${fmtDate(ct.endDate)}`;
                const deptVal = extractDepartmentFromCustomer(ct.customerName, cs.customerName);

                // Main Contract Data Row
                const vals: (string | number)[] = [
                    cIdx + 1,
                    ct.poNo || '—',
                    fmtDate(ct.poDate),
                    deptVal,
                    ct.mcType || '—',
                    ct.noOfMachine || 0,
                    ct.amount || 0,
                    periodStr,
                    ct.status || '—',
                    engNames,
                    ct.noOfVisits || pmTot || 0,
                    pmProgStr,
                    ct.softwareSupport ? 'Yes' : 'No',
                ];

                vals.forEach((v, i) => {
                    const cell = ws.getCell(r, i + 1);
                    cell.value = v;
                    const col = MAIN_COLUMNS[i];
                    applyDataCell(cell, 'FFF8FAFC', {
                        bold: col.key === 'poNo' || col.key === 'amount',
                        isNumber: typeof v === 'number' || col.key === 'amount',
                        align: col.align,
                        fontColor: col.key === 'status' ? getStatusColor(String(v)) : undefined,
                    });

                    if (col.key === 'amount' && typeof v === 'number') {
                        cell.numFmt = '₹#,##0';
                    }
                });
                ws.getRow(r).height = 22;

                // ── PM Sub-Rows: ONLY PENDING VISITS WHOSE WINDOW ENDS BETWEEN DATE FILTER ──
                const pendingVisitsToShow = applicablePMs.filter(pm => {
                    if (pm.status === 'Completed' || pm.status === 'Not Applicable') return false;
                    if (isDateFiltered) {
                        return isPMEndDateInRange(pm.range, filters.dateFrom, filters.dateTo);
                    }
                    return true;
                });

                if (pendingVisitsToShow.length > 0) {
                    const totalVisitsCount = ct.noOfVisits || applicablePMs.length || 1;
                    const pmVisitAmount = (totalVisitsCount > 0 && ct.amount) ? Math.round(ct.amount / totalVisitsCount) : 0;

                    pendingVisitsToShow.forEach(pm => {
                        currentRow += 1;
                        const pmR = currentRow;

                        // Check overdue against today
                        let isOverdue = false;
                        if (pm.range) {
                            try {
                                const endObj = getPMEndDate(pm.range);
                                if (endObj && endObj < now) isOverdue = true;
                            } catch { /* ignore */ }
                        }

                        const statusText = isOverdue ? `! Overdue` : `⏳ Pending`;
                        const completionDetails = isOverdue ? `Pending Execution (Overdue)` : `Pending Execution`;

                        const statusBg = isOverdue ? COLORS.kardexRedTint : COLORS.kardexSandTint;
                        const statusColor = isOverdue ? COLORS.kardexRedDark : COLORS.kardexSandDark;

                        // Column A (1): blank indentation
                        const cellA = ws.getCell(pmR, 1);
                        cellA.value = '';
                        cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
                        cellA.border = thinBorder();

                        // Column B & C (2..3): PM Cycle Name
                        ws.mergeCells(`B${pmR}:C${pmR}`);
                        const cellB = ws.getCell(pmR, 2);
                        cellB.value = `    ↳  PM Cycle ${pm.pmNumber}`;
                        cellB.font = { bold: true, size: 8.5, color: { argb: COLORS.kardexBlueDark } };
                        cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
                        cellB.alignment = { horizontal: 'left', vertical: 'middle' };
                        cellB.border = thinBorder();

                        // Column D, E & F (4..6): Scheduled Period Range
                        ws.mergeCells(`D${pmR}:F${pmR}`);
                        const cellD = ws.getCell(pmR, 4);
                        cellD.value = `Window: ${pm.range || 'N/A'}`;
                        cellD.font = { size: 8.5, color: { argb: COLORS.textDark }, italic: true };
                        cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
                        cellD.alignment = { horizontal: 'left', vertical: 'middle' };
                        cellD.border = thinBorder();

                        // Column G (7): PM Visit Amount (Directly under main Amount column!)
                        const cellG = ws.getCell(pmR, 7);
                        cellG.value = pmVisitAmount;
                        cellG.numFmt = '₹#,##0';
                        cellG.font = { bold: true, size: 8.5, color: { argb: COLORS.kardexBlueDark } };
                        cellG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
                        cellG.alignment = { horizontal: 'right', vertical: 'middle' };
                        cellG.border = thinBorder();

                        // Column H (8): Status Pill
                        const cellH = ws.getCell(pmR, 8);
                        cellH.value = statusText;
                        cellH.font = { bold: true, size: 8.5, color: { argb: statusColor } };
                        cellH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
                        cellH.alignment = { horizontal: 'center', vertical: 'middle' };
                        cellH.border = thinBorder();

                        // Column I to lastCol (9..13): Execution Details
                        ws.mergeCells(`I${pmR}:${lastCol}${pmR}`);
                        const cellI = ws.getCell(pmR, 9);
                        cellI.value = completionDetails;
                        cellI.font = { size: 8.5, color: { argb: COLORS.textBody }, italic: true };
                        cellI.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
                        cellI.alignment = { horizontal: 'left', vertical: 'middle' };
                        cellI.border = thinBorder();

                        ws.getRow(pmR).height = 18;
                    });
                }
            });

            // 4. Customer Subtotal Row (Soft Kardex Blue Tint)
            currentRow += 1;
            const subtotalRow = currentRow;
            const amountColIdx = MAIN_COLUMNS.findIndex(c => c.key === 'amount') + 1;
            const machinesColIdx = MAIN_COLUMNS.findIndex(c => c.key === 'noOfMachine') + 1;

            ws.mergeCells(`A${subtotalRow}:${numToCol(machinesColIdx - 1)}${subtotalRow}`);
            const subLabel = ws.getCell(`A${subtotalRow}`);
            subLabel.value = `Total for ${cs.customerName}:`;
            subLabel.font = { bold: true, size: 9, color: { argb: COLORS.kardexBlueDark } };
            subLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subtotalBg } };
            subLabel.alignment = { horizontal: 'right', vertical: 'middle' };
            subLabel.border = thinBorder(COLORS.borderMedium);

            const machCell = ws.getCell(subtotalRow, machinesColIdx);
            machCell.value = cs.totalMachines;
            machCell.font = { bold: true, size: 9, color: { argb: COLORS.kardexBlueDark } };
            machCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subtotalBg } };
            machCell.alignment = { horizontal: 'center', vertical: 'middle' };
            machCell.border = thinBorder(COLORS.borderMedium);

            const amtCell = ws.getCell(subtotalRow, amountColIdx);
            amtCell.value = cs.totalValue || 0;
            amtCell.numFmt = '₹#,##0';
            amtCell.font = { bold: true, size: 9, color: { argb: COLORS.kardexBlueDark } };
            amtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subtotalBg } };
            amtCell.alignment = { horizontal: 'right', vertical: 'middle' };
            amtCell.border = thinBorder(COLORS.borderMedium);

            for (let i = amountColIdx + 1; i <= totalCols; i++) {
                const cell = ws.getCell(subtotalRow, i);
                cell.value = '';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subtotalBg } };
                cell.border = thinBorder(COLORS.borderMedium);
            }
            ws.getRow(subtotalRow).height = 20;

            // Comfortable spacing row between customer accounts
            currentRow += 1;
            ws.getRow(currentRow).height = 10;
        });
    }

    // ── Final Grand Total Row (Kardex Blue #546A7A) ──
    currentRow += 1;
    const grandRow = currentRow;
    const amountColIdx = MAIN_COLUMNS.findIndex(c => c.key === 'amount') + 1;
    const machinesColIdx = MAIN_COLUMNS.findIndex(c => c.key === 'noOfMachine') + 1;

    ws.mergeCells(`A${grandRow}:${numToCol(machinesColIdx - 1)}${grandRow}`);
    const grandLabel = ws.getCell(`A${grandRow}`);
    grandLabel.value = `GRAND TOTAL (${effTotalCustomers} Customers, ${effTotalContracts} Contracts, ${effPendingVisitsCount} Pending Visits):`;
    grandLabel.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
    grandLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    grandLabel.alignment = { horizontal: 'right', vertical: 'middle' };
    grandLabel.border = thinBorder(COLORS.kardexBlueDark);

    const grandMach = ws.getCell(grandRow, machinesColIdx);
    grandMach.value = effTotalMachines;
    grandMach.font = { bold: true, size: 10, color: { argb: COLORS.textWhite } };
    grandMach.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    grandMach.alignment = { horizontal: 'center', vertical: 'middle' };
    grandMach.border = thinBorder(COLORS.kardexBlueDark);

    const grandAmt = ws.getCell(grandRow, amountColIdx);
    grandAmt.value = effTotalValue || 0;
    grandAmt.numFmt = '₹#,##0';
    grandAmt.font = { bold: true, size: 10, color: { argb: COLORS.textWhite } };
    grandAmt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    grandAmt.alignment = { horizontal: 'right', vertical: 'middle' };
    grandAmt.border = thinBorder(COLORS.kardexBlueDark);

    for (let i = amountColIdx + 1; i <= totalCols; i++) {
        const cell = ws.getCell(grandRow, i);
        cell.value = '';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        cell.border = thinBorder(COLORS.kardexBlueDark);
    }
    ws.getRow(grandRow).height = 24;

    // Freeze panes at row 8
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8, activeCell: 'A9' }];

    // Generate & download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Contract_Report_${timestamp}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
