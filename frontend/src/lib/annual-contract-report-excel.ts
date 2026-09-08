/**
 * Annual Machine Contracts Excel Export Utility — Official Kardex Brand Design
 * Generates an executive, single-sheet Excel workbook using ExcelJS.
 * Beautifully styled with official Kardex Blue (#546A7A, #6F8A9D, #96AEC2),
 * Kardex Green (#82A094, #4F6A64), and Kardex Sand (#CE9F6B) palette.
 */
import {
    kardexBlue,
    kardexGreen,
    kardexGrey,
    kardexSilver,
    kardexRed,
    kardexSand,
} from './kardex-colors';
import { normalizeEngineerNames } from './utils';

// ============ Types ============
interface ExpiryInfo {
    status: string;
    daysLeft: number | null;
    bucket: string;
}

interface DetailedMachine {
    id: number;
    slNo: number | null;
    customerName: string;
    customerClass: string | null;
    place: string | null;
    zoneName: string;
    engineerName: string | null;
    serialNumber: string;
    unitType: string | null;
    modelNumber: string | null;
    controlType: string | null;
    department: string | null;
    installationYear: string | null;
    contractType: string | null;
    mcPoNumber: string | null;
    poDate: string | null;
    mcStartDate: string | null;
    mcEndDate: string | null;
    mcValue: number | null;
    pmVisitsCount: number;
    bdVisitsCount: number;
    warrantyEndDate: string | null;
    softwareEndDate: string | null;
    remoteSupportEndDate: string | null;
    notes: string | null;
    mcExpiry: ExpiryInfo;
    warrantyExpiry: ExpiryInfo;
    softwareExpiry: ExpiryInfo;
    remoteSupportExpiry: ExpiryInfo;
}

interface CustomerGroup {
    customerName: string;
    customerId?: number;
    customerClass: string | null;
    place: string | null;
    zoneName: string;
    engineerName: string | null;
    totalMachines: number;
    totalMCValue: number;
    totalPMVisits: number;
    totalBDVisits: number;
    machines: DetailedMachine[];
    earliestMCExpiry: string | null;
    expiryStatus: string;
    expiryBucket: string;
    daysToEarliestExpiry: number | null;
}

interface Stats {
    totalMachines: number;
    totalCustomers: number;
    totalMCValue: number;
    expiring30: number;
    expiring60: number;
    expiring90: number;
    expired: number;
    active: number;
    warrantyExpiring30: number;
    classA: number;
    classB: number;
    classC: number;
}

interface ExcelFilters {
    zone?: string;
    customerClass?: string;
    contractType?: string;
    unitType?: string;
    engineer?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
    expiryBucket?: string;
    search?: string;
}

// ============ Color Helpers ============
const c = (hex: string) => hex.replace('#', '');
const solid = (hex: string) => 'FF' + c(hex);

// ============ Official Kardex Brand Color Scheme ============
const COLORS = {
    // Kardex Core Blues
    kardexBlueDark: solid(kardexBlue[3]),    // #546A7A - Executive Header & Grand Totals
    kardexBlueMedium: solid(kardexBlue[2]),  // #6F8A9D - Table Headers & Sub-sections
    kardexBlueLight: solid(kardexBlue[1]),   // #96AEC2 - Subtle Accents & Highlights
    kardexBlueTint: 'FFF0F4F8',             // Very soft Ice Blue tint for alternating rows

    // Kardex Green Accent
    kardexGreenMedium: solid(kardexGreen[2]),// #82A094 - Active / Success Accent
    kardexGreenDark: solid(kardexGreen[3]),  // #4F6A64 - Deep Green Text
    kardexGreenTint: 'FFF0F7F4',             // Soft green tint

    // Kardex Sand Accent (Warm)
    kardexSandMedium: solid(kardexSand[2]),  // #CE9F6B - Warning / Value Accent
    kardexSandDark: solid(kardexSand[3]),    // #976E44 - Warm Sand Text
    kardexSandTint: 'FFFCF8F2',              // Soft sand tint

    // Kardex Red (Alerts / Overdue)
    kardexRedLight: solid(kardexRed[1]),     // #E17F70 - Overdue Accent
    kardexRedDark: solid(kardexRed[2]),      // #9E3B47 - Overdue Text

    // Neutral Surfaces & Borders
    white: 'FFFFFFFF',
    cardBg: 'FFFFFFFF',
    cardHeaderBg: 'FFEBF1F6',                // Kardex soft blue-gray
    customerBannerBg: solid(kardexBlue[3]),  // #546A7A - Distinct Customer Bar
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

const fmtExpiryStatus = (expiry: ExpiryInfo | null | undefined): string => {
    if (!expiry || expiry.bucket === 'na') return '—';
    if (expiry.daysLeft !== null) {
        return expiry.daysLeft < 0
            ? `${Math.abs(expiry.daysLeft)}d overdue`
            : `${expiry.daysLeft}d left`;
    }
    return expiry.status || '—';
};

const getExpiryColor = (bucket: string | null | undefined): string => {
    switch (bucket) {
        case 'expired': return COLORS.kardexRedDark;
        case 'critical': return COLORS.kardexRedDark;
        case 'warning': return COLORS.kardexSandDark;
        case 'attention': return COLORS.kardexBlueMedium;
        case 'healthy': return COLORS.kardexGreenDark;
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

// ============ Column Definitions ============
const ANNUAL_COLUMNS = [
    { header: '#', key: 'slNo', width: 6, align: 'center' as const },
    { header: 'Serial Number', key: 'serialNumber', width: 18, align: 'center' as const },
    { header: 'Unit / Model', key: 'unitModel', width: 22, align: 'left' as const },
    { header: 'Control Type', key: 'controlType', width: 14, align: 'center' as const },
    { header: 'Responsible Engineer', key: 'engineerName', width: 22, align: 'left' as const },
    { header: 'Department', key: 'department', width: 16, align: 'left' as const },
    { header: 'Install Year', key: 'installationYear', width: 12, align: 'center' as const },
    { header: 'Contract Type', key: 'contractType', width: 14, align: 'center' as const },
    { header: 'MC PO Number', key: 'mcPoNumber', width: 16, align: 'center' as const },
    { header: 'PO Date', key: 'poDate', width: 14, align: 'center' as const },
    { header: 'MC Start Date', key: 'mcStartDate', width: 14, align: 'center' as const },
    { header: 'MC End Date', key: 'mcEndDate', width: 14, align: 'center' as const },
    { header: 'MC Value (₹)', key: 'mcValue', width: 16, align: 'right' as const },
    { header: 'MC Expiry Status', key: 'mcExpiryStatus', width: 16, align: 'center' as const },
    { header: 'Days Left', key: 'mcExpiryDays', width: 10, align: 'center' as const },
    { header: 'PM Visits', key: 'pmVisitsCount', width: 10, align: 'center' as const },
    { header: 'BD Visits', key: 'bdVisitsCount', width: 10, align: 'center' as const },
];

// ============ Main Single-Sheet Generator ============
export async function generateAnnualContractReportExcel(
    customers: CustomerGroup[],
    stats: Stats | null,
    filters: ExcelFilters
): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kardex Remstar';
    workbook.lastModifiedBy = 'KardexCare System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const ws = workbook.addWorksheet('Annual Contract Report', {
        properties: { tabColor: { argb: COLORS.kardexBlueDark } },
    });

    const totalCols = ANNUAL_COLUMNS.length;
    const lastCol = numToCol(totalCols);

    // Set Column Widths
    ANNUAL_COLUMNS.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width;
    });

    // ── Row 1: Executive Title (Kardex Blue #546A7A) ──
    ws.mergeCells(`A1:${lastCol}1`);
    const titleCell = ws.getCell('A1');
    titleCell.value = 'KARDEX — ANNUAL MACHINE CONTRACTS & ASSET REPORT';
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
    if (filters.zone && filters.zone !== 'all') filterParts.push(`Zone: ${filters.zone}`);
    if (filters.customerClass && filters.customerClass !== 'all') filterParts.push(`Class: ${filters.customerClass}`);
    if (filters.contractType && filters.contractType !== 'all') filterParts.push(`Type: ${filters.contractType}`);
    if (filters.unitType && filters.unitType !== 'all') filterParts.push(`Model: ${filters.unitType}`);
    if (filters.engineer && filters.engineer !== 'all') filterParts.push(`Engineer: ${filters.engineer}`);
    if (filters.department && filters.department !== 'all') filterParts.push(`Dept: ${filters.department}`);
    if (filters.expiryBucket && filters.expiryBucket !== 'all') filterParts.push(`Expiry: ${filters.expiryBucket}`);
    if (filters.dateFrom || filters.dateTo) filterParts.push(`Period: ${filters.dateFrom || 'Start'} → ${filters.dateTo || 'End'}`);
    if (filters.search) filterParts.push(`Search: "${filters.search}"`);
    const filterStr = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Zones & Customer Portfolios';

    const totalMachinesCount = stats?.totalMachines ?? customers.reduce((s, c) => s + (c.machines?.length || 0), 0);
    const totalCustomersCount = stats?.totalCustomers ?? customers.length;
    const totalValCount = stats?.totalMCValue ?? customers.reduce((s, c) => s + (c.totalMCValue || 0), 0);

    infoCell.value = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}  |  ${totalMachinesCount} Machines  |  ${totalCustomersCount} Accounts  |  ${filterStr}`;
    infoCell.font = { size: 9, color: { argb: COLORS.kardexBlueDark }, italic: true };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueTint } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 20;

    // ── Rows 5-6: Executive Kardex KPI Cards ──
    const expiring30 = stats?.expiring30 ?? 0;
    const expiredCount = stats?.expired ?? 0;
    const activeCount = stats?.active ?? (totalMachinesCount - expiredCount);

    const kpis = [
        { label: 'TOTAL MACHINES', value: String(totalMachinesCount), accent: COLORS.kardexBlueDark, span: 3 },
        { label: 'TOTAL CUSTOMERS', value: String(totalCustomersCount), accent: COLORS.kardexBlueMedium, span: 3 },
        { label: 'TOTAL MC VALUE', value: fmtCurrency(totalValCount), accent: COLORS.kardexSandDark, span: 4 },
        { label: 'EXPIRING ≤30D / OVERDUE', value: `${expiring30} / ${expiredCount}`, accent: (expiring30 > 0 || expiredCount > 0) ? COLORS.kardexRedDark : COLORS.kardexGreenDark, span: 4 },
        { label: 'ACTIVE HEALTHY', value: String(activeCount), accent: COLORS.kardexGreenDark, span: 3 },
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
    secCell.value = 'CUSTOMER PORTFOLIO & MACHINE INVENTORY';
    secCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
    secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    secCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(currentRow).height = 22;

    // ── Customer Grouped Blocks ──
    customers.forEach((cust, custIdx) => {
        currentRow += 1;
        const machines = cust.machines || [];

        const overdueCount = machines.filter(m =>
            m.mcExpiry && ((m.mcExpiry.daysLeft !== null && m.mcExpiry.daysLeft < 0) || m.mcExpiry.bucket === 'expired')
        ).length;

        const classText = cust.customerClass ? `Class ${cust.customerClass}` : '—';
        const placeText = cust.place ? `${cust.place}, ${cust.zoneName} Zone` : `${cust.zoneName} Zone`;
        const engNames = Array.from(new Set(
            [cust.engineerName, ...(machines.map(m => m.engineerName))]
                .flatMap(n => normalizeEngineerNames(n))
        )).join(', ');
        const engText = engNames ? `Eng: ${engNames}` : 'Eng: Unassigned';
        const statusText = overdueCount > 0
            ? `[ ${overdueCount} Overdue ]`
            : (cust.daysToEarliestExpiry !== null ? (cust.daysToEarliestExpiry < 0 ? `[ Overdue ]` : `[ ${cust.daysToEarliestExpiry}d left ]`) : '[ Active ]');
        const visitsText = `${cust.totalPMVisits || 0} PM | ${cust.totalBDVisits || 0} BD`;

        // 1. Customer Kardex Blue Banner Row (#546A7A)
        const bannerRow = currentRow;
        ws.mergeCells(`A${bannerRow}:${lastCol}${bannerRow}`);
        const banner = ws.getCell(`A${bannerRow}`);
        banner.value = `${custIdx + 1}.  ${cust.customerName.toUpperCase()}   •   ${classText}   •   ${placeText}   •   ${engText}   •   Machines: ${cust.totalMachines}   •   Total Value: ${fmtCurrency(cust.totalMCValue)}   •   ${statusText}   •   ${visitsText}`;
        banner.font = { bold: true, color: { argb: COLORS.textWhite }, size: 9.5 };
        banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        banner.alignment = { horizontal: 'left', vertical: 'middle' };
        banner.border = thinBorder(COLORS.kardexBlueDark);
        ws.getRow(bannerRow).height = 22;

        // 2. Table Header Row for this Customer (Kardex Blue Medium #6F8A9D)
        currentRow += 1;
        const tableHeaderRow = currentRow;
        ws.getRow(tableHeaderRow).height = 20;
        ANNUAL_COLUMNS.forEach((col, i) => {
            const cell = ws.getCell(tableHeaderRow, i + 1);
            cell.value = col.header;
            applyHeaderStyle(cell);
        });

        // 3. Machine Rows for this Customer (White / Soft Kardex Ice Blue Alternating)
        if (machines.length === 0) {
            currentRow += 1;
            ws.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
            const emptyCell = ws.getCell(`A${currentRow}`);
            emptyCell.value = 'No machines registered for this customer contract.';
            emptyCell.font = { italic: true, size: 9, color: { argb: COLORS.textMuted } };
            emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(currentRow).height = 18;
        } else {
            machines.forEach((m, mIdx) => {
                currentRow += 1;
                const r = currentRow;
                const bg = mIdx % 2 === 0 ? COLORS.white : COLORS.kardexBlueTint;

                const unitModel = `${m.unitType || '—'}${m.modelNumber ? ` / ${m.modelNumber}` : ''}`;
                const engName = normalizeEngineerNames(m.engineerName || cust.engineerName).join(', ') || '—';

                const vals: (string | number)[] = [
                    mIdx + 1,
                    m.serialNumber || '—',
                    unitModel,
                    m.controlType || '—',
                    engName,
                    m.department || '—',
                    m.installationYear || '—',
                    m.contractType || 'UMC',
                    m.mcPoNumber || '—',
                    fmtDate(m.poDate),
                    fmtDate(m.mcStartDate),
                    fmtDate(m.mcEndDate),
                    m.mcValue ?? 0,
                    fmtExpiryStatus(m.mcExpiry),
                    m.mcExpiry?.daysLeft ?? '',
                    m.pmVisitsCount || 0,
                    m.bdVisitsCount || 0,
                ];

                vals.forEach((v, i) => {
                    const cell = ws.getCell(r, i + 1);
                    cell.value = v;
                    const col = ANNUAL_COLUMNS[i];
                    applyDataCell(cell, bg, {
                        bold: col.key === 'serialNumber',
                        isNumber: typeof v === 'number' || col.key === 'mcValue',
                        align: col.align,
                        fontColor: col.key === 'mcExpiryStatus' ? getExpiryColor(m.mcExpiry?.bucket) : undefined,
                    });

                    if (col.key === 'mcValue' && typeof v === 'number') {
                        cell.numFmt = '₹#,##0';
                    }
                });

                ws.getRow(r).height = 18;
            });
        }

        // 4. Customer Subtotal Row (Soft Kardex Blue Tint)
        currentRow += 1;
        const subtotalRow = currentRow;
        const mcValueColIdx = ANNUAL_COLUMNS.findIndex(c => c.key === 'mcValue') + 1;
        const pmVisitsColIdx = ANNUAL_COLUMNS.findIndex(c => c.key === 'pmVisitsCount') + 1;
        const bdVisitsColIdx = ANNUAL_COLUMNS.findIndex(c => c.key === 'bdVisitsCount') + 1;

        ws.mergeCells(`A${subtotalRow}:${numToCol(mcValueColIdx - 1)}${subtotalRow}`);
        const subLabel = ws.getCell(`A${subtotalRow}`);
        subLabel.value = `Total for ${cust.customerName} (${machines.length} Units):`;
        subLabel.font = { bold: true, size: 9, color: { argb: COLORS.kardexBlueDark } };
        subLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subtotalBg } };
        subLabel.alignment = { horizontal: 'right', vertical: 'middle' };
        subLabel.border = thinBorder(COLORS.borderMedium);

        const subAmtCell = ws.getCell(subtotalRow, mcValueColIdx);
        subAmtCell.value = cust.totalMCValue || 0;
        subAmtCell.numFmt = '₹#,##0';
        subAmtCell.font = { bold: true, size: 9, color: { argb: COLORS.kardexBlueDark } };
        subAmtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subtotalBg } };
        subAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };
        subAmtCell.border = thinBorder(COLORS.borderMedium);

        for (let i = mcValueColIdx + 1; i <= totalCols; i++) {
            const cell = ws.getCell(subtotalRow, i);
            if (i === pmVisitsColIdx) {
                cell.value = cust.totalPMVisits || 0;
                cell.font = { bold: true, size: 9, color: { argb: COLORS.kardexBlueDark } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (i === bdVisitsColIdx) {
                cell.value = cust.totalBDVisits || 0;
                cell.font = { bold: true, size: 9, color: { argb: COLORS.kardexBlueDark } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.value = '';
            }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subtotalBg } };
            cell.border = thinBorder(COLORS.borderMedium);
        }
        ws.getRow(subtotalRow).height = 19;

        // Subtle spacing row
        currentRow += 1;
        ws.getRow(currentRow).height = 6;
    });

    // ── Final Grand Total Row (Kardex Blue #546A7A) ──
    currentRow += 1;
    const grandRow = currentRow;
    const mcValueColIdx = ANNUAL_COLUMNS.findIndex(c => c.key === 'mcValue') + 1;
    const pmVisitsColIdx = ANNUAL_COLUMNS.findIndex(c => c.key === 'pmVisitsCount') + 1;
    const bdVisitsColIdx = ANNUAL_COLUMNS.findIndex(c => c.key === 'bdVisitsCount') + 1;

    ws.mergeCells(`A${grandRow}:${numToCol(mcValueColIdx - 1)}${grandRow}`);
    const grandLabel = ws.getCell(`A${grandRow}`);
    grandLabel.value = `GRAND TOTAL (${totalCustomersCount} Accounts, ${totalMachinesCount} Machines):`;
    grandLabel.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
    grandLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    grandLabel.alignment = { horizontal: 'right', vertical: 'middle' };
    grandLabel.border = thinBorder(COLORS.kardexBlueDark);

    const grandAmt = ws.getCell(grandRow, mcValueColIdx);
    grandAmt.value = totalValCount || 0;
    grandAmt.numFmt = '₹#,##0';
    grandAmt.font = { bold: true, size: 10, color: { argb: COLORS.textWhite } };
    grandAmt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    grandAmt.alignment = { horizontal: 'right', vertical: 'middle' };
    grandAmt.border = thinBorder(COLORS.kardexBlueDark);

    const totalPMs = customers.reduce((s, c) => s + (c.totalPMVisits || 0), 0);
    const totalBDs = customers.reduce((s, c) => s + (c.totalBDVisits || 0), 0);

    for (let i = mcValueColIdx + 1; i <= totalCols; i++) {
        const cell = ws.getCell(grandRow, i);
        if (i === pmVisitsColIdx) {
            cell.value = totalPMs;
            cell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (i === bdVisitsColIdx) {
            cell.value = totalBDs;
            cell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
            cell.value = '';
        }
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
    link.download = `Annual_Contract_Report_${timestamp}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
