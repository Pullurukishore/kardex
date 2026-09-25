/**
 * Annual Machine Contracts Excel Export Utility — Official Kardex Brand Design
 * Generates a clean, professional, single-sheet Excel workbook using ExcelJS.
 * Pure tabular structure (Table Only):
 * - Row 1: Standard Table Header with Kardex styling & AutoFilter enabled
 * - Rows 2..N: Data rows with individual machine contract records (no merged customer banners)
 * - Row N+1: Grand Total row
 * - Frozen header row for smooth scrolling
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
    kardexBlueDark: solid(kardexBlue[3]),    // #546A7A - Table Header & Grand Totals
    kardexBlueMedium: solid(kardexBlue[2]),  // #6F8A9D - Table Borders & Accents
    kardexBlueLight: solid(kardexBlue[1]),   // #96AEC2 - Highlights
    kardexBlueTint: 'FFF8FAFC',             // Very light slate tint for alternating rows

    // Kardex Green Accent
    kardexGreenMedium: solid(kardexGreen[2]),// #82A094 - Active / Success Accent
    kardexGreenDark: solid(kardexGreen[3]),  // #4F6A64 - Deep Green Text

    // Kardex Sand Accent (Warm)
    kardexSandMedium: solid(kardexSand[2]),  // #CE9F6B - Warning / Value Accent
    kardexSandDark: solid(kardexSand[3]),    // #976E44 - Warm Sand Text

    // Kardex Red (Alerts / Overdue)
    kardexRedLight: solid(kardexRed[1]),     // #E17F70 - Overdue Accent
    kardexRedDark: solid(kardexRed[2]),      // #9E3B47 - Overdue Text

    // Neutral Surfaces & Borders
    white: 'FFFFFFFF',
    borderLight: 'FFE2E8F0',                 // Slate-200 border
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
    cell.font = { bold: true, color: { argb: COLORS.textWhite }, size: 9.5 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder(COLORS.kardexBlueMedium);
};

const applyDataCell = (
    cell: any,
    bgColor: string,
    opts: { bold?: boolean; isNumber?: boolean; fontColor?: string; align?: 'left' | 'center' | 'right' } = {}
): void => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.border = thinBorder();
    cell.alignment = { horizontal: opts.align || (opts.isNumber ? 'right' : 'left'), vertical: 'middle', wrapText: true };
    cell.font = { size: 9, color: { argb: opts.fontColor || COLORS.textDark }, bold: opts.bold || false };
};

// ============ Pure Tabular Columns Definition ============
const ANNUAL_TABLE_COLUMNS = [
    { header: '#', key: 'slNo', width: 6, align: 'center' as const },
    { header: 'Customer Name', key: 'customerName', width: 28, align: 'left' as const },
    { header: 'Class', key: 'customerClass', width: 10, align: 'center' as const },
    { header: 'Place', key: 'place', width: 16, align: 'left' as const },
    { header: 'Zone', key: 'zoneName', width: 14, align: 'center' as const },
    { header: 'Serial Number', key: 'serialNumber', width: 18, align: 'center' as const },
    { header: 'Unit Type', key: 'unitType', width: 16, align: 'left' as const },
    { header: 'Model Number', key: 'modelNumber', width: 16, align: 'left' as const },
    { header: 'Control Type', key: 'controlType', width: 14, align: 'center' as const },
    { header: 'Department', key: 'department', width: 16, align: 'left' as const },
    { header: 'Responsible Engineer', key: 'engineerName', width: 24, align: 'left' as const },
    { header: 'Install Year', key: 'installationYear', width: 12, align: 'center' as const },
    { header: 'Contract Type', key: 'contractType', width: 14, align: 'center' as const },
    { header: 'MC PO Number', key: 'mcPoNumber', width: 18, align: 'center' as const },
    { header: 'PO Date', key: 'poDate', width: 14, align: 'center' as const },
    { header: 'MC Start Date', key: 'mcStartDate', width: 14, align: 'center' as const },
    { header: 'MC End Date', key: 'mcEndDate', width: 14, align: 'center' as const },
    { header: 'MC Value (₹)', key: 'mcValue', width: 18, align: 'right' as const },
    { header: 'MC Expiry Status', key: 'mcExpiryStatus', width: 16, align: 'center' as const },
    { header: 'Days Left', key: 'mcExpiryDays', width: 12, align: 'center' as const },
    { header: 'PM Visits', key: 'pmVisitsCount', width: 10, align: 'center' as const },
    { header: 'BD Visits', key: 'bdVisitsCount', width: 10, align: 'center' as const },
    { header: 'Warranty End Date', key: 'warrantyEndDate', width: 16, align: 'center' as const },
    { header: 'Software End Date', key: 'softwareEndDate', width: 16, align: 'center' as const },
    { header: 'Remote Support End Date', key: 'remoteSupportEndDate', width: 18, align: 'center' as const },
    { header: 'Notes', key: 'notes', width: 26, align: 'left' as const },
];

// ============ Main Tabular Generator ============
export async function generateAnnualContractReportExcel(
    customers: CustomerGroup[],
    _stats: Stats | null,
    _filters: ExcelFilters
): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kardex Remstar';
    workbook.lastModifiedBy = 'KardexCare System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const ws = workbook.addWorksheet('Annual Contracts', {
        properties: { tabColor: { argb: COLORS.kardexBlueDark } },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }],
    });

    const totalCols = ANNUAL_TABLE_COLUMNS.length;
    const lastCol = numToCol(totalCols);

    // Set Column Widths
    ANNUAL_TABLE_COLUMNS.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width;
    });

    // ── Row 1: Standard Table Header ──
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    ANNUAL_TABLE_COLUMNS.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        applyHeaderStyle(cell);
    });

    // Enable Excel AutoFilter across the table headers
    ws.autoFilter = `A1:${lastCol}1`;

    let currentRow = 1;
    let recordIndex = 0;
    let totalValueSum = 0;
    let totalPMVisitsSum = 0;
    let totalBDVisitsSum = 0;
    const uniqueCustomers = new Set<string>();

    // ── Rows 2..N: Machine Contract Data Records ──
    customers.forEach(cust => {
        uniqueCustomers.add(cust.customerName);
        const machines = cust.machines || [];

        machines.forEach(m => {
            recordIndex++;
            currentRow++;
            const r = currentRow;
            const isOdd = recordIndex % 2 === 1;
            const bg = isOdd ? COLORS.white : COLORS.kardexBlueTint;

            const engName = normalizeEngineerNames(m.engineerName || cust.engineerName).join(', ') || '—';
            const mcVal = Number(m.mcValue ?? 0);
            const pmVisits = Number(m.pmVisitsCount || 0);
            const bdVisits = Number(m.bdVisitsCount || 0);

            totalValueSum += mcVal;
            totalPMVisitsSum += pmVisits;
            totalBDVisitsSum += bdVisits;

            const rowData: (string | number)[] = [
                recordIndex,
                cust.customerName,
                m.customerClass || cust.customerClass || '—',
                m.place || cust.place || '—',
                m.zoneName || cust.zoneName || '—',
                m.serialNumber || '—',
                m.unitType || '—',
                m.modelNumber || '—',
                m.controlType || '—',
                m.department || '—',
                engName,
                m.installationYear || '—',
                m.contractType || 'UMC',
                m.mcPoNumber || '—',
                fmtDate(m.poDate),
                fmtDate(m.mcStartDate),
                fmtDate(m.mcEndDate),
                mcVal,
                fmtExpiryStatus(m.mcExpiry),
                m.mcExpiry?.daysLeft ?? '',
                pmVisits,
                bdVisits,
                fmtDate(m.warrantyEndDate),
                fmtDate(m.softwareEndDate),
                fmtDate(m.remoteSupportEndDate),
                m.notes || '—',
            ];

            const row = ws.getRow(r);
            row.height = 20;

            rowData.forEach((val, colIdx) => {
                const cell = row.getCell(colIdx + 1);
                cell.value = val;
                const colDef = ANNUAL_TABLE_COLUMNS[colIdx];

                const isNumeric = colDef.key === 'mcValue' || colDef.key === 'pmVisitsCount' ||
                    colDef.key === 'bdVisitsCount' || colDef.key === 'mcExpiryDays';

                let fontColor: string | undefined;
                if (colDef.key === 'mcExpiryStatus') {
                    fontColor = getExpiryColor(m.mcExpiry?.bucket);
                }

                applyDataCell(cell, bg, {
                    bold: colDef.key === 'serialNumber' || colDef.key === 'customerName' || colDef.key === 'mcValue',
                    isNumber: isNumeric,
                    align: colDef.align,
                    fontColor,
                });

                if (colDef.key === 'mcValue' && typeof val === 'number') {
                    cell.numFmt = '₹#,##0';
                }
            });
        });
    });

    // ── Row N+1: Grand Total Row ──
    if (recordIndex > 0) {
        currentRow++;
        const grandRow = currentRow;
        const totalRow = ws.getRow(grandRow);
        totalRow.height = 24;

        // Find relevant column indexes (1-based)
        const mcEndDateColIdx = ANNUAL_TABLE_COLUMNS.findIndex(c => c.key === 'mcEndDate') + 1;
        const mcValColIdx = ANNUAL_TABLE_COLUMNS.findIndex(c => c.key === 'mcValue') + 1;
        const pmVisitsColIdx = ANNUAL_TABLE_COLUMNS.findIndex(c => c.key === 'pmVisitsCount') + 1;
        const bdVisitsColIdx = ANNUAL_TABLE_COLUMNS.findIndex(c => c.key === 'bdVisitsCount') + 1;

        // Label merged across columns 1..17
        ws.mergeCells(`A${grandRow}:${numToCol(mcEndDateColIdx)}${grandRow}`);
        const labelCell = ws.getCell(`A${grandRow}`);
        labelCell.value = `GRAND TOTAL (${recordIndex} Machines, ${uniqueCustomers.size} Customers):`;
        labelCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        labelCell.border = thinBorder(COLORS.kardexBlueDark);

        // MC Value total
        const amtCell = totalRow.getCell(mcValColIdx);
        amtCell.value = totalValueSum;
        amtCell.numFmt = '₹#,##0';
        amtCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        amtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        amtCell.alignment = { horizontal: 'right', vertical: 'middle' };
        amtCell.border = thinBorder(COLORS.kardexBlueDark);

        // Fill non-aggregated columns between MC Value and PM Visits
        for (let i = mcValColIdx + 1; i < pmVisitsColIdx; i++) {
            const cell = totalRow.getCell(i);
            cell.value = '';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
            cell.border = thinBorder(COLORS.kardexBlueDark);
        }

        // PM Visits total
        const pmCell = totalRow.getCell(pmVisitsColIdx);
        pmCell.value = totalPMVisitsSum;
        pmCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        pmCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        pmCell.alignment = { horizontal: 'center', vertical: 'middle' };
        pmCell.border = thinBorder(COLORS.kardexBlueDark);

        // BD Visits total
        const bdCell = totalRow.getCell(bdVisitsColIdx);
        bdCell.value = totalBDVisitsSum;
        bdCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        bdCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        bdCell.alignment = { horizontal: 'center', vertical: 'middle' };
        bdCell.border = thinBorder(COLORS.kardexBlueDark);

        // Fill remaining columns
        for (let i = bdVisitsColIdx + 1; i <= totalCols; i++) {
            const cell = totalRow.getCell(i);
            cell.value = '';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
            cell.border = thinBorder(COLORS.kardexBlueDark);
        }
    }

    // Generate & download Excel file
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
