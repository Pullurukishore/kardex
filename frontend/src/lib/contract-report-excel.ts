/**
 * Contract Reports Excel Export Utility — Official Kardex Brand Design
 * Generates a clean, professional, single-sheet Excel workbook using ExcelJS.
 * Pure tabular structure (Table Only):
 * - Row 1: Standard Table Header with Kardex styling & AutoFilter enabled
 * - Rows 2..N: Data rows with individual contract records (no merged banners or nested sub-rows)
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
    kardexBlueLight: solid(kardexBlue[1]),   // #96AEC2 - Accents
    kardexBlueTint: 'FFF8FAFC',             // Very light slate tint for alternating rows

    // Kardex Green Accent
    kardexGreenMedium: solid(kardexGreen[2]),// #82A094 - Active / Success Accent
    kardexGreenDark: solid(kardexGreen[3]),  // #4F6A64 - Deep Green Text

    // Kardex Sand Accent (Warm)
    kardexSandMedium: solid(kardexSand[2]),  // #CE9F6B - Warning / Value Accent
    kardexSandDark: solid(kardexSand[3]),    // #976E44 - Warm Sand Text

    // Kardex Red (Alerts / Overdue)
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

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const parseDateObj = (str: string | null | undefined): Date | null => {
    if (!str) return null;
    str = str.trim();

    const slashDot = str.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/);
    if (slashDot) {
        const d = parseInt(slashDot[1], 10);
        const m = parseInt(slashDot[2], 10) - 1;
        let y = parseInt(slashDot[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, m, d);
    }

    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (dmyMatch) {
        let y = parseInt(dmyMatch[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    }

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

const getPMEndDate = (pmRange: string | null | undefined): Date | null => {
    if (!pmRange) return null;
    const parts = pmRange.split(/\s+(?:TO|to|-)\s+/);
    const endStr = parts.length >= 2 ? parts[parts.length - 1]?.trim() : parts[0]?.trim();
    return parseDateObj(endStr);
};

// ============ Pure Tabular Columns Definition ============
const CONTRACT_TABLE_COLUMNS = [
    { header: '#', key: 'slNo', width: 6, align: 'center' as const },
    { header: 'Customer Name', key: 'customerName', width: 28, align: 'left' as const },
    { header: 'Department', key: 'department', width: 18, align: 'left' as const },
    { header: 'Place', key: 'place', width: 16, align: 'left' as const },
    { header: 'Zone', key: 'zoneName', width: 14, align: 'center' as const },
    { header: 'Contract Number', key: 'contractNumber', width: 18, align: 'center' as const },
    { header: 'PO Number', key: 'poNo', width: 18, align: 'center' as const },
    { header: 'PO Date', key: 'poDate', width: 14, align: 'center' as const },
    { header: 'MC Type', key: 'mcType', width: 14, align: 'center' as const },
    { header: 'Machines', key: 'noOfMachine', width: 10, align: 'center' as const },
    { header: 'Contract Value (₹)', key: 'amount', width: 18, align: 'right' as const },
    { header: 'Start Date', key: 'startDate', width: 14, align: 'center' as const },
    { header: 'End Date', key: 'endDate', width: 14, align: 'center' as const },
    { header: 'Status', key: 'status', width: 14, align: 'center' as const },
    { header: 'Responsible Engineer', key: 'responsible', width: 24, align: 'left' as const },
    { header: 'Total PM Visits', key: 'noOfVisits', width: 14, align: 'center' as const },
    { header: 'PM Completed', key: 'pmCompleted', width: 14, align: 'center' as const },
    { header: 'PM Pending', key: 'pmPending', width: 12, align: 'center' as const },
    { header: 'PM Overdue', key: 'pmOverdue', width: 12, align: 'center' as const },
    { header: 'PM Progress', key: 'pmProgress', width: 14, align: 'center' as const },
    { header: 'Pending PM Window', key: 'pendingWindow', width: 28, align: 'left' as const },
    { header: 'BD Visits', key: 'bdCount', width: 12, align: 'center' as const },
    { header: 'SW Support', key: 'softwareSupport', width: 12, align: 'center' as const },
    { header: 'Payment Terms', key: 'paymentTerms', width: 16, align: 'left' as const },
];

// ============ Main Tabular Generator ============
export async function generateContractReportExcel(
    customerSummaries: CustomerSummary[],
    _overall: OverallSummary,
    _filters: ContractExcelFilters
): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kardex Remstar';
    workbook.lastModifiedBy = 'KardexCare System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const ws = workbook.addWorksheet('Contracts', {
        properties: { tabColor: { argb: COLORS.kardexBlueDark } },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }],
    });

    const totalCols = CONTRACT_TABLE_COLUMNS.length;
    const lastCol = numToCol(totalCols);

    // Set Column Widths
    CONTRACT_TABLE_COLUMNS.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width;
    });

    // ── Row 1: Standard Table Header ──
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    CONTRACT_TABLE_COLUMNS.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        applyHeaderStyle(cell);
    });

    // Enable Excel AutoFilter across the table headers
    ws.autoFilter = `A1:${lastCol}1`;

    const now = new Date();
    let currentRow = 1;
    let recordIndex = 0;
    let totalMachinesSum = 0;
    let totalValueSum = 0;
    let totalPMVisitsSum = 0;
    let totalPMDoneSum = 0;
    let totalPMPendingSum = 0;
    let totalPMOverdueSum = 0;
    const uniqueCustomers = new Set<string>();

    // ── Rows 2..N: Contract Data Records ──
    customerSummaries.forEach(cs => {
        uniqueCustomers.add(cs.customerName);
        const contracts = cs.contracts || [];

        contracts.forEach(ct => {
            recordIndex++;
            currentRow++;
            const r = currentRow;
            const isOdd = recordIndex % 2 === 1;
            const bg = isOdd ? COLORS.white : COLORS.kardexBlueTint;

            const applicablePMs = (ct.pmSchedules || []).filter(p => p.status !== 'Not Applicable');
            const pmDone = applicablePMs.filter(p => p.status === 'Completed').length;
            const pmPending = applicablePMs.filter(p => p.status === 'Pending').length;
            const totalPMs = ct.noOfVisits || applicablePMs.length;

            const pmOverdue = applicablePMs.filter(p => {
                if (p.status === 'Completed') return false;
                const end = getPMEndDate(p.range);
                return end && end < now;
            }).length;

            const pmProgStr = applicablePMs.length > 0
                ? `${Math.round((pmDone / applicablePMs.length) * 100)}%`
                : '—';

            const nextPending = applicablePMs.find(p => p.status !== 'Completed');
            const pendingWindowStr = nextPending
                ? `PM ${nextPending.pmNumber}: ${nextPending.range || 'Scheduled'}`
                : (applicablePMs.length > 0 ? 'All Completed' : '—');

            const bdLabel = ct.bdCount === 999 ? 'Unlimited' : (ct.bdCount ?? 0);
            const deptVal = extractDepartmentFromCustomer(ct.customerName, cs.customerName) || '—';
            const engNames = normalizeEngineerNames(ct.responsible).join(', ') || '—';

            const machineCount = Number(ct.noOfMachine || 0);
            const contractAmount = Number(ct.amount || 0);

            totalMachinesSum += machineCount;
            totalValueSum += contractAmount;
            totalPMVisitsSum += totalPMs;
            totalPMDoneSum += pmDone;
            totalPMPendingSum += pmPending;
            totalPMOverdueSum += pmOverdue;

            const rowData: (string | number)[] = [
                recordIndex,
                cs.customerName,
                deptVal,
                ct.place || cs.place || '—',
                ct.zoneName || cs.zoneName || '—',
                ct.contractNumber || '—',
                ct.poNo || '—',
                fmtDate(ct.poDate),
                ct.mcType || '—',
                machineCount,
                contractAmount,
                fmtDate(ct.startDate),
                fmtDate(ct.endDate),
                ct.status || '—',
                engNames,
                totalPMs,
                pmDone,
                pmPending,
                pmOverdue,
                pmProgStr,
                pendingWindowStr,
                bdLabel,
                ct.softwareSupport ? 'Yes' : 'No',
                ct.paymentTerms || '—',
            ];

            const row = ws.getRow(r);
            row.height = 20;

            rowData.forEach((val, colIdx) => {
                const cell = row.getCell(colIdx + 1);
                cell.value = val;
                const colDef = CONTRACT_TABLE_COLUMNS[colIdx];

                const isNumeric = colDef.key === 'amount' || colDef.key === 'noOfMachine' ||
                    colDef.key === 'noOfVisits' || colDef.key === 'pmCompleted' ||
                    colDef.key === 'pmPending' || colDef.key === 'pmOverdue';

                let fontColor: string | undefined;
                if (colDef.key === 'status') {
                    fontColor = getStatusColor(String(val));
                } else if (colDef.key === 'pmOverdue' && Number(val) > 0) {
                    fontColor = COLORS.kardexRedDark;
                }

                applyDataCell(cell, bg, {
                    bold: colDef.key === 'poNo' || colDef.key === 'customerName' || colDef.key === 'amount',
                    isNumber: isNumeric,
                    align: colDef.align,
                    fontColor,
                });

                if (colDef.key === 'amount' && typeof val === 'number') {
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
        const mcColIdx = CONTRACT_TABLE_COLUMNS.findIndex(c => c.key === 'mcType') + 1;
        const machColIdx = CONTRACT_TABLE_COLUMNS.findIndex(c => c.key === 'noOfMachine') + 1;
        const amtColIdx = CONTRACT_TABLE_COLUMNS.findIndex(c => c.key === 'amount') + 1;
        const totPmColIdx = CONTRACT_TABLE_COLUMNS.findIndex(c => c.key === 'noOfVisits') + 1;
        const pmDoneColIdx = CONTRACT_TABLE_COLUMNS.findIndex(c => c.key === 'pmCompleted') + 1;
        const pmPendColIdx = CONTRACT_TABLE_COLUMNS.findIndex(c => c.key === 'pmPending') + 1;
        const pmOverColIdx = CONTRACT_TABLE_COLUMNS.findIndex(c => c.key === 'pmOverdue') + 1;

        // Label merged across columns 1..9
        ws.mergeCells(`A${grandRow}:${numToCol(mcColIdx)}${grandRow}`);
        const labelCell = ws.getCell(`A${grandRow}`);
        labelCell.value = `GRAND TOTAL (${recordIndex} Contracts, ${uniqueCustomers.size} Customers):`;
        labelCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        labelCell.border = thinBorder(COLORS.kardexBlueDark);

        // Machine total
        const machCell = totalRow.getCell(machColIdx);
        machCell.value = totalMachinesSum;
        machCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        machCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        machCell.alignment = { horizontal: 'center', vertical: 'middle' };
        machCell.border = thinBorder(COLORS.kardexBlueDark);

        // Value total
        const amtCell = totalRow.getCell(amtColIdx);
        amtCell.value = totalValueSum;
        amtCell.numFmt = '₹#,##0';
        amtCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        amtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        amtCell.alignment = { horizontal: 'right', vertical: 'middle' };
        amtCell.border = thinBorder(COLORS.kardexBlueDark);

        // Fill non-aggregated columns between Amount and Total PM Visits
        for (let i = amtColIdx + 1; i < totPmColIdx; i++) {
            const cell = totalRow.getCell(i);
            cell.value = '';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
            cell.border = thinBorder(COLORS.kardexBlueDark);
        }

        // PM Visits total
        const totPmCell = totalRow.getCell(totPmColIdx);
        totPmCell.value = totalPMVisitsSum;
        totPmCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        totPmCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        totPmCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totPmCell.border = thinBorder(COLORS.kardexBlueDark);

        // PM Done total
        const pmDoneCell = totalRow.getCell(pmDoneColIdx);
        pmDoneCell.value = totalPMDoneSum;
        pmDoneCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        pmDoneCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        pmDoneCell.alignment = { horizontal: 'center', vertical: 'middle' };
        pmDoneCell.border = thinBorder(COLORS.kardexBlueDark);

        // PM Pending total
        const pmPendCell = totalRow.getCell(pmPendColIdx);
        pmPendCell.value = totalPMPendingSum;
        pmPendCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        pmPendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        pmPendCell.alignment = { horizontal: 'center', vertical: 'middle' };
        pmPendCell.border = thinBorder(COLORS.kardexBlueDark);

        // PM Overdue total
        const pmOverCell = totalRow.getCell(pmOverColIdx);
        pmOverCell.value = totalPMOverdueSum;
        pmOverCell.font = { bold: true, size: 9.5, color: { argb: COLORS.textWhite } };
        pmOverCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kardexBlueDark } };
        pmOverCell.alignment = { horizontal: 'center', vertical: 'middle' };
        pmOverCell.border = thinBorder(COLORS.kardexBlueDark);

        // Fill remaining columns
        for (let i = pmOverColIdx + 1; i <= totalCols; i++) {
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
    link.download = `Contract_Report_${timestamp}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
