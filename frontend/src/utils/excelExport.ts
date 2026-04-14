/**
 * Excel Export Utility for Forecast Dashboard
 * Uses ExcelJS library for professionally styled Excel workbook generation
 * Comprehensive export with ALL fields from Zone Summary, Monthly, User Monthly, and PO Expected APIs
 */

import ExcelJS from 'exceljs';

// ============ Color Scheme ============

const COLORS = {
    // Primary colors
    headerBg: '1E3A8A',    // Deep blue (matching dashboard slate-900/blue-900)
    headerText: 'FFFFFF',  // White
    titleBg: 'EFF6FF',
    titleText: '1E40AF',

    // Zone colors (matching dashboard exactly)
    zoneBg: {
        WEST: 'DBEAFE',    // Blue light (bg-[#96AEC2]/10)
        SOUTH: 'D1FAE5',   // Emerald light (bg-[#82A094]/10)
        NORTH: 'FEF3C7',   // Amber light (bg-[#CE9F6B]/10)
        EAST: 'EDE9FE',    // Purple light (bg-[#6F8A9D]/10)
    },
    zoneAccent: {
        WEST: '3B82F6',    // Blue-500
        SOUTH: '10B981',   // Emerald-500
        NORTH: 'F59E0B',   // Amber-500
        EAST: '8B5CF6',    // Purple-500
    },

    // Column-specific colors (matching dashboard data cells)
    colOffers: '2563EB',      // Blue-600 (text-[#546A7A])
    colOffersBg: 'DBEAFE',    // Blue-50 light background
    colOrders: '059669',      // Emerald-600 (text-[#4F6A64])
    colOrdersBg: 'D1FAE5',    // Emerald-50 light background
    colFunnel: 'D97706',      // Amber-600 (text-[#976E44])
    colFunnelBg: 'FEF3C7',    // Amber-50 light background
    colBU: '7C3AED',          // Purple-600 (BU/Monthly)
    colBUBg: 'F3E8FF',        // Purple-50 light background
    colOfferBU: '4F46E5',     // Indigo-600 (OfferBU)
    colOfferBUBg: 'E0E7FF',   // Indigo-50 light background

    // Status colors (matching dashboard deviation badges)
    positive: '059669',    // Emerald-600 (green for positive)
    negative: 'DC2626',    // Red-600 (red for negative)
    neutral: 'F59E0B',     // Amber-500 (amber for neutral)
    positiveBg: 'D1FAE5',  // Emerald-50 background
    negativeBg: 'FEE2E2',  // Red-50 background
    neutralBg: 'FEF3C7',   // Amber-50 background

    // Table colors
    rowEven: 'F8FAFC',     // Slate-50
    rowOdd: 'FFFFFF',      // White
    borderLight: 'E2E8F0', // Slate-200
    totalRowBg: 'E0E7FF',  // Indigo-100
    grandTotalBg: '1E3A8A', // Deep blue (matching header)
    subHeaderBg: '64748B', // Slate-500
    productHeaderBg: 'FFF7ED', // Orange-50
    productAccent: 'EA580C',   // Orange-600

    // Text
    textDark: '1E293B',    // Slate-800
    textLight: '64748B',   // Slate-500

    // Target column
    targetBg: 'F0F9FF',    // Sky-50
    targetText: '0369A1',  // Sky-700
} as const;

// ============ Type Definitions ============

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

interface SummaryTotals {
    noOfOffers: number;
    offersValue: number;
    ordersReceived: number;
    openFunnel: number;
    orderBooking: number;
    uForBooking: number;
    yearlyTarget: number;
    balanceBU: number;
    hitRatePercent: number;
}

interface MonthlyData {
    month: string;
    monthLabel: string;
    noOfOffers?: number;
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

/** Shared shape for product-level monthly data (zone & user sheets) */
interface ProductMonthlyData {
    month: string;
    monthLabel: string;
    noOfOffers?: number;
    offersValue: number;
    orderReceived: number;
    ordersInHand: number;
    buMonthly: number;
    percentDev: number | null;
    offerBUMonth: number;
    offerBUMonthDev: number | null;
}

/** Shared shape for product-level totals */
interface ProductTotals {
    offersValue: number;
    orderReceived: number;
    ordersInHand: number;
    buMonthly: number;
    offerBUMonth: number;
}

/** Shared shape for product breakdown entries */
interface ProductBreakdownEntry {
    productType: string;
    productLabel: string;
    yearlyTarget: number;
    hitRate: number;
    monthlyData: ProductMonthlyData[];
    totals: ProductTotals;
}

interface ZoneMonthlyBreakdown {
    zoneId: number;
    zoneName: string;
    hitRate: number;
    yearlyTarget: number;
    monthlyData: MonthlyData[];
    productBreakdown?: ProductBreakdownEntry[];
    totals: {
        offersValue: number;
        orderReceived: number;
        ordersBooked: number;
        ordersInHand: number;
        buMonthly: number;
        offerBUMonth: number;
    };
}

interface UserMonthlyData {
    month: string;
    monthLabel: string;
    noOfOffers?: number;
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
    productBreakdown?: ProductBreakdownEntry[];
    totals: {
        offersValue: number;
        orderReceived: number;
        ordersInHand: number;
        buMonthly: number;
        offerBUMonth: number;
    };
}

/** PO Expected Month data structures */
interface POExpectedUser {
    userName: string;
    monthlyValues?: Record<string, number>;
    total?: number;
}

interface POExpectedZone {
    zoneName: string;
    grandTotal: number;
    users?: POExpectedUser[];
    monthlyTotals?: Record<string, number>;
}

interface POExpectedData {
    zones: POExpectedZone[];
    months?: string[];
    overallTotals?: {
        monthlyTotals?: Record<string, number>;
        grandTotal?: number;
    };
}

/** Product × User × Zone data structures */
interface ProductMatrixRow {
    productType: string;
    productLabel?: string;
    total?: number;
    userValues?: Record<number, number>;
}

interface PUZUser {
    id: number;
    name: string;
}

interface PUZZone {
    zoneName: string;
    zoneTotalValue?: number;
    users?: PUZUser[];
    productMatrix?: ProductMatrixRow[];
    userTotals?: Record<number, number>;
}

interface ProductTypeEntry {
    key: string;
    label: string;
}

interface ProductUserZoneData {
    zones: PUZZone[];
    productTypes?: ProductTypeEntry[];
}

/** Product-wise Forecast data structures */
interface PWFProduct {
    productType: string;
    productLabel?: string;
    total?: number;
    monthlyValues?: Record<string, number>;
}

interface PWFUser {
    userName: string;
    grandTotal?: number;
    monthlyTotals?: Record<string, number>;
    products?: PWFProduct[];
}

interface PWFZone {
    zoneName: string;
    grandTotal?: number;
    monthlyTotals?: Record<string, number>;
    users?: PWFUser[];
}

interface ProductWiseForecastData {
    zones: PWFZone[];
    months?: string[];
}

// ============ Helper Functions ============

/**
 * Format currency values exactly like the dashboard:
 * - ≥ 1 Crore (10,000,000): Shows as "₹X.XXCr"
 * - ≥ 1 Lakh (100,000): Shows as "₹X.XXL"
 * - Below 1 Lakh: Shows as formatted number
 */
const formatCurrencyCompact = (value: number): string => {
    if (value === 0) return '-';
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
};

// Keep formatInLakhs for backwards compatibility in some places
const formatInLakhs = (value: number): string => {
    if (value === 0) return '-';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
};

const getZoneColor = (zoneName: string): { bg: string; accent: string } => {
    const upper = zoneName.toUpperCase();
    return {
        bg: COLORS.zoneBg[upper as keyof typeof COLORS.zoneBg] || 'F8FAFC',
        accent: COLORS.zoneAccent[upper as keyof typeof COLORS.zoneAccent] || '64748B',
    };
};

// ============ Reusable Cell Styling Helpers ============

const applyHeaderStyle = (cell: ExcelJS.Cell): void => {
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
        top: { style: 'thin', color: { argb: COLORS.headerBg } },
        left: { style: 'thin', color: { argb: COLORS.headerBg } },
        bottom: { style: 'thin', color: { argb: COLORS.headerBg } },
        right: { style: 'thin', color: { argb: COLORS.headerBg } },
    };
};

const applySubHeaderStyle = (cell: ExcelJS.Cell): void => {
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.productAccent } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
        top: { style: 'thin', color: { argb: COLORS.productAccent } },
        left: { style: 'thin', color: { argb: COLORS.productAccent } },
        bottom: { style: 'thin', color: { argb: COLORS.productAccent } },
        right: { style: 'thin', color: { argb: COLORS.productAccent } },
    };
};

const applyDataCellStyle = (cell: ExcelJS.Cell, bgColor: string, isNumber = false): void => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderLight } },
        left: { style: 'thin', color: { argb: COLORS.borderLight } },
        bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
        right: { style: 'thin', color: { argb: COLORS.borderLight } },
    };
    cell.alignment = { horizontal: isNumber ? 'right' : 'left', vertical: 'middle' };
};

const applyTotalRowStyle = (cell: ExcelJS.Cell, isGrand = false): void => {
    cell.font = { bold: true, color: { argb: isGrand ? COLORS.headerText : COLORS.textDark } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isGrand ? COLORS.grandTotalBg : COLORS.totalRowBg } };
    cell.border = {
        top: { style: 'medium', color: { argb: COLORS.headerBg } },
        left: { style: 'thin', color: { argb: COLORS.headerBg } },
        bottom: { style: 'medium', color: { argb: COLORS.headerBg } },
        right: { style: 'thin', color: { argb: COLORS.headerBg } },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
};

const applyProductTotalStyle = (cell: ExcelJS.Cell): void => {
    cell.font = { bold: true, color: { argb: COLORS.productAccent }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.productHeaderBg } };
    cell.border = {
        top: { style: 'medium', color: { argb: COLORS.productAccent } },
        left: { style: 'thin', color: { argb: COLORS.productAccent } },
        bottom: { style: 'medium', color: { argb: COLORS.productAccent } },
        right: { style: 'thin', color: { argb: COLORS.productAccent } },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
};

// ============ Reusable Sheet-Building Helpers ============

/**
 * Write a sheet title row with full-width merge and dark background.
 * Returns the next row number to write to.
 */
const writeSheetTitle = (ws: ExcelJS.Worksheet, row: number, text: string, lastCol: string): number => {
    ws.mergeCells(`A${row}:${lastCol}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = text;
    cell.font = { size: 16, bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(row).height = 30;
    return row + 2;
};

/**
 * Write a section header (zone, user, etc.) with a colored background.
 * Returns the next row number.
 */
const writeSectionHeader = (
    ws: ExcelJS.Worksheet,
    row: number,
    text: string,
    lastCol: string,
    bgColor: string,
    options?: { fontSize?: number; height?: number }
): number => {
    ws.mergeCells(`A${row}:${lastCol}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = text;
    cell.font = { size: options?.fontSize ?? 12, bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(row).height = options?.height ?? 28;
    return row + 1;
};

/**
 * Write a row of column headers and return the next row number.
 */
const writeColumnHeaders = (
    ws: ExcelJS.Worksheet,
    row: number,
    headers: string[],
    styleFn: (cell: ExcelJS.Cell) => void = applyHeaderStyle,
    height = 22
): number => {
    headers.forEach((h, idx) => {
        const cell = ws.getCell(row, idx + 1);
        cell.value = h;
        styleFn(cell);
    });
    ws.getRow(row).height = height;
    return row + 1;
};

/**
 * Write a deviation cell (±X%) with conditional green/red coloring.
 */
const writeDeviationCell = (
    cell: ExcelJS.Cell,
    value: number | null,
    bgFallback: string,
    fontSize = 10
): void => {
    if (value !== null) {
        cell.value = `${value >= 0 ? '+' : ''}${value}%`;
        const isPositive = value >= 0;
        cell.font = { bold: true, size: fontSize, color: { argb: isPositive ? COLORS.positive : COLORS.negative } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isPositive ? COLORS.positiveBg : COLORS.negativeBg } };
    } else {
        cell.value = '-';
        cell.font = { size: fontSize, color: { argb: COLORS.textLight } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFallback } };
    }
    cell.alignment = { horizontal: 'center' };
};

/**
 * Write a single monthly data row for the 9-column layout:
 * [Month, NoOfOffers, OffersValue, OrdersReceived, OpenFunnel, BU/MO, %Dev, OfferBU, %Dev]
 *
 * Used identically by zone monthly, user monthly, and product breakdown sections.
 * Returns the next row number.
 */
const writeMonthlyDataRow = (
    ws: ExcelJS.Worksheet,
    row: number,
    m: { monthLabel: string; noOfOffers?: number; offersValue: number; orderReceived: number; ordersInHand: number; buMonthly: number; percentDev: number | null; offerBUMonth: number; offerBUMonthDev: number | null },
    bgColor: string,
    fontSize = 10,
    monthSlice?: number
): number => {
    const label = monthSlice ? m.monthLabel.slice(0, monthSlice) : m.monthLabel;

    // Col 1: Month
    const monthCell = ws.getCell(row, 1);
    monthCell.value = label;
    monthCell.font = { bold: true, size: fontSize, color: { argb: COLORS.textDark } };
    monthCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    monthCell.alignment = { horizontal: 'left' };

    // Col 2: No of Offers
    const noOfOffersCell = ws.getCell(row, 2);
    noOfOffersCell.value = m.noOfOffers || 0;
    noOfOffersCell.font = { bold: true, size: fontSize, color: { argb: COLORS.textDark } };
    noOfOffersCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    noOfOffersCell.alignment = { horizontal: 'right' };

    // Col 3: Offers Value (Blue)
    const offersCell = ws.getCell(row, 3);
    offersCell.value = formatCurrencyCompact(m.offersValue);
    offersCell.font = { bold: true, size: fontSize, color: { argb: COLORS.colOffers } };
    offersCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    offersCell.alignment = { horizontal: 'right' };

    // Col 4: Orders Received (Emerald)
    const ordersCell = ws.getCell(row, 4);
    ordersCell.value = formatCurrencyCompact(m.orderReceived);
    ordersCell.font = { bold: true, size: fontSize, color: { argb: COLORS.colOrders } };
    ordersCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    ordersCell.alignment = { horizontal: 'right' };

    // Col 5: Open Funnel (Amber)
    const funnelCell = ws.getCell(row, 5);
    funnelCell.value = formatCurrencyCompact(m.ordersInHand);
    funnelCell.font = { bold: true, size: fontSize, color: { argb: COLORS.colFunnel } };
    funnelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    funnelCell.alignment = { horizontal: 'right' };

    // Col 6: BU/MO (Purple with purple background)
    const buCell = ws.getCell(row, 6);
    buCell.value = formatCurrencyCompact(m.buMonthly);
    buCell.font = { bold: true, size: fontSize, color: { argb: COLORS.colBU } };
    buCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colBUBg } };
    buCell.alignment = { horizontal: 'right' };

    // Col 7: %Dev (Green/Red badge)
    writeDeviationCell(ws.getCell(row, 7), m.percentDev, bgColor, fontSize);

    // Col 8: OfferBU (Indigo with indigo background)
    const offerBuCell = ws.getCell(row, 8);
    offerBuCell.value = formatCurrencyCompact(m.offerBUMonth);
    offerBuCell.font = { bold: true, size: fontSize, color: { argb: COLORS.colOfferBU } };
    offerBuCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colOfferBUBg } };
    offerBuCell.alignment = { horizontal: 'right' };

    // Col 9: %Dev 2 (Green/Red badge)
    writeDeviationCell(ws.getCell(row, 9), m.offerBUMonthDev, bgColor, fontSize);

    // Bottom border for all columns
    for (let col = 1; col <= 9; col++) {
        ws.getCell(row, col).border = {
            bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
        };
    }

    return row + 1;
};

/**
 * Write the dark total row for the 9-column monthly layout.
 * Returns the next row number.
 */
const writeDarkTotalRow = (
    ws: ExcelJS.Worksheet,
    row: number,
    totalNoOfOffers: number,
    totals: { offersValue: number; orderReceived: number; ordersInHand: number; buMonthly: number; offerBUMonth: number }
): number => {
    const bg = '1E293B'; // Dark slate matching dashboard

    const setDarkCell = (col: number, value: string | number) => {
        const cell = ws.getCell(row, col);
        cell.value = value;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (col !== 1) {
            cell.alignment = { horizontal: col === 7 || col === 9 ? 'center' : 'right' };
        }
    };

    setDarkCell(1, '↗ Total');
    setDarkCell(2, totalNoOfOffers);
    setDarkCell(3, formatCurrencyCompact(totals.offersValue));
    setDarkCell(4, formatCurrencyCompact(totals.orderReceived));
    setDarkCell(5, formatCurrencyCompact(totals.ordersInHand));
    setDarkCell(6, formatCurrencyCompact(totals.buMonthly));
    setDarkCell(7, '—');
    setDarkCell(8, formatCurrencyCompact(totals.offerBUMonth));
    setDarkCell(9, '—');

    ws.getRow(row).height = 24;
    return row + 1;
};

/**
 * Write a product breakdown section (used by both zone monthly and user monthly sheets).
 * Returns the next row number.
 */
const writeProductBreakdown = (
    ws: ExcelJS.Worksheet,
    row: number,
    products: ProductBreakdownEntry[],
    sectionLabel: string,
    lastCol: string
): number => {
    // Product section header
    ws.mergeCells(`A${row}:${lastCol}${row}`);
    const sectionHeader = ws.getCell(`A${row}`);
    sectionHeader.value = `📦 PRODUCT TYPE BREAKDOWN - ${sectionLabel} (${products.length} types)`;
    sectionHeader.font = { size: 10, bold: true, color: { argb: COLORS.productAccent } };
    sectionHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.productHeaderBg } };
    sectionHeader.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(row).height = 22;
    row++;

    const prodHeaders = ['MONTH', 'NO OF OFFERS', 'OFFERS VALUE', 'ORDERS RECEIVED', 'OPEN FUNNEL', 'BU/MO', '%DEV', 'OFFERBU', '%DEV'];

    for (const product of products) {
        // Product header row
        ws.mergeCells(`A${row}:${lastCol}${row}`);
        const prodHeader = ws.getCell(`A${row}`);
        prodHeader.value = `  📦 ${product.productLabel}  |  Target: ${formatCurrencyCompact(product.yearlyTarget)}  |  Hit Rate: ${product.hitRate}%  |  Offers: ${formatCurrencyCompact(product.totals.offersValue)}  |  Orders: ${formatCurrencyCompact(product.totals.orderReceived)}  |  Funnel: ${formatCurrencyCompact(product.totals.ordersInHand)}`;
        prodHeader.font = { size: 9, bold: true, color: { argb: COLORS.productAccent } };
        prodHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.productHeaderBg } };
        prodHeader.alignment = { horizontal: 'left', vertical: 'middle' };
        ws.getRow(row).height = 20;
        row++;

        // Product column headers
        row = writeColumnHeaders(ws, row, prodHeaders, applySubHeaderStyle, 18);

        // Product monthly data
        product.monthlyData.forEach((m, idx) => {
            const isEven = idx % 2 === 0;
            const bgColor = isEven ? COLORS.productHeaderBg : COLORS.rowOdd;
            row = writeMonthlyDataRow(ws, row, m, bgColor, 9, 3);
        });

        // Product total row
        const ptData = [
            'Total',
            product.monthlyData.reduce((s, m) => s + (m.noOfOffers || 0), 0),
            formatCurrencyCompact(product.totals.offersValue),
            formatCurrencyCompact(product.totals.orderReceived),
            formatCurrencyCompact(product.totals.ordersInHand),
            formatCurrencyCompact(product.totals.buMonthly),
            '—',
            formatCurrencyCompact(product.totals.offerBUMonth),
            '—',
        ];
        ptData.forEach((val, colIdx) => {
            const cell = ws.getCell(row, colIdx + 1);
            cell.value = val;
            applyProductTotalStyle(cell);
            if (colIdx > 0) cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
        row += 2;
    }

    return row;
};

/**
 * Trigger file download from a workbook buffer.
 */
const triggerDownload = async (workbook: ExcelJS.Workbook, filename: string): Promise<void> => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

// ============ Sheet 1: Zone Summary (All Fields) ============

const generateZoneSummarySheet = (
    workbook: ExcelJS.Workbook,
    zones: ZoneSummary[],
    totals: SummaryTotals,
    year: number
): void => {
    const ws = workbook.addWorksheet('Zone Summary', {
        properties: { tabColor: { argb: COLORS.headerBg } },
    });

    let row = writeSheetTitle(ws, 1, `ZONE-WISE SUMMARY REPORT (${year})`, 'L');

    // Generation info
    ws.getCell(`A${row}`).value = `Generated: ${new Date().toLocaleString('en-IN')}`;
    ws.getCell(`A${row}`).font = { size: 10, italic: true, color: { argb: COLORS.textLight } };
    row += 2;

    // ALL HEADERS matching the dashboard table exactly
    const headers = [
        'Zone', '# Offers', 'Offers Value', 'Orders Received',
        'Open Funnel', 'Order Booking', 'U for Booking',
        'Hit Rate %', 'Yearly Target', '% Dev', 'Balance BU', 'Achievement %'
    ];

    headers.forEach((h, idx) => {
        const cell = ws.getCell(row, idx + 1);
        cell.value = h;
        applyHeaderStyle(cell);
        // Special styles for Target and %Dev columns
        if (h === 'Yearly Target') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.targetText } };
        }
    });
    ws.getRow(row).height = 26;
    row++;

    // Zone data rows with ALL fields
    zones.forEach((zone) => {
        const colors = getZoneColor(zone.zoneName);
        const achievement = zone.yearlyTarget > 0
            ? parseFloat(((zone.ordersReceived / zone.yearlyTarget) * 100).toFixed(1))
            : 0;
        const deviationPercent = zone.yearlyTarget > 0
            ? parseFloat(((zone.ordersReceived / zone.yearlyTarget) * 100 - 100).toFixed(0))
            : 0;

        const rowData = [
            zone.zoneName,
            zone.noOfOffers,
            formatInLakhs(zone.offersValue),
            formatInLakhs(zone.ordersReceived),
            formatInLakhs(zone.openFunnel),
            formatInLakhs(zone.orderBooking),
            formatInLakhs(zone.uForBooking),
            zone.hitRatePercent,
            formatInLakhs(zone.yearlyTarget),
            deviationPercent,
            formatInLakhs(zone.balanceBU),
            achievement,
        ];

        rowData.forEach((val, colIdx) => {
            const cell = ws.getCell(row, colIdx + 1);
            if (colIdx === 7 || colIdx === 11) {
                cell.value = `${val}%`;
            } else if (colIdx === 9) {
                cell.value = `${(val as number) >= 0 ? '+' : ''}${val}%`;
            } else {
                cell.value = val;
            }
            applyDataCellStyle(cell, colors.bg, colIdx > 0);

            if (colIdx === 7) { // Hit Rate
                const rate = typeof val === 'number' ? val : 0;
                cell.font = { bold: true, color: { argb: rate >= 50 ? COLORS.positive : rate >= 30 ? COLORS.neutral : COLORS.negative } };
            }
            if (colIdx === 8) { // Target - sky color
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.targetBg } };
                cell.font = { color: { argb: COLORS.targetText } };
            }
            if (colIdx === 9) { // %Dev
                const dev = typeof val === 'number' ? val : 0;
                cell.font = { bold: true, color: { argb: dev >= 0 ? COLORS.positive : COLORS.negative } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dev >= 0 ? COLORS.positiveBg : COLORS.negativeBg } };
            }
            if (colIdx === 11) { // Achievement
                const ach = typeof val === 'number' ? val : 0;
                cell.font = { bold: true, color: { argb: ach >= 100 ? COLORS.positive : ach >= 50 ? COLORS.neutral : COLORS.negative } };
            }
            if (colIdx === 10) { // Balance (negative is good)
                const balNum = typeof zone.balanceBU === 'number' ? zone.balanceBU : 0;
                cell.font = { color: { argb: balNum <= 0 ? COLORS.positive : COLORS.negative } };
            }
        });
        row++;
    });


    // Total row
    const totalAchievement = totals.yearlyTarget > 0
        ? parseFloat(((totals.ordersReceived / totals.yearlyTarget) * 100).toFixed(1))
        : 0;
    const totalDeviation = totals.yearlyTarget > 0
        ? parseFloat(((totals.ordersReceived / totals.yearlyTarget) * 100 - 100).toFixed(0))
        : 0;

    const totalData = [
        'TOTAL',
        totals.noOfOffers,
        formatInLakhs(totals.offersValue),
        formatInLakhs(totals.ordersReceived),
        formatInLakhs(totals.openFunnel),
        formatInLakhs(totals.orderBooking),
        formatInLakhs(totals.uForBooking),
        `${totals.hitRatePercent}%`,
        formatInLakhs(totals.yearlyTarget),
        `${totalDeviation >= 0 ? '+' : ''}${totalDeviation}%`,
        formatInLakhs(totals.balanceBU),
        `${totalAchievement}%`,
    ];

    totalData.forEach((val, colIdx) => {
        const cell = ws.getCell(row, colIdx + 1);
        cell.value = val;
        applyTotalRowStyle(cell, true);
    });

    // Set column widths
    ws.columns = [
        { width: 12 }, { width: 10 }, { width: 16 }, { width: 18 },
        { width: 16 }, { width: 16 }, { width: 16 },
        { width: 12 }, { width: 16 }, { width: 10 }, { width: 16 }, { width: 14 },
    ];
};

// ============ Sheet 2: Zone Monthly (Matching Dashboard Format with No of Offers) ============

const MONTHLY_HEADERS = ['MONTH', 'NO OF OFFERS', 'OFFERS VALUE', 'ORDERS RECEIVED', 'OPEN FUNNEL', 'BU/MO', '%DEV', 'OFFERBU', '%DEV'];

/** Lightweight header style for monthly sub-headers (not full dark header) */
const applyMonthlySubHeaderStyle = (cell: ExcelJS.Cell): void => {
    cell.font = { bold: true, size: 10, color: { argb: COLORS.textLight } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    cell.alignment = { horizontal: Number(cell.col) === 1 ? 'left' : 'right', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: COLORS.borderLight } } };
    // Highlight BU columns
    const val = cell.value as string;
    if (val === 'BU/MO' || val === 'OFFERBU') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colBUBg } };
        cell.font = { bold: true, size: 10, color: { argb: COLORS.colBU } };
    }
};

const generateZoneMonthlySheet = (
    workbook: ExcelJS.Workbook,
    zones: ZoneMonthlyBreakdown[],
    year: number
): void => {
    const ws = workbook.addWorksheet('Zone Monthly', {
        properties: { tabColor: { argb: '3B82F6' } },
    });

    let row = writeSheetTitle(ws, 1, `ZONE-WISE MONTHLY BREAKDOWN (${year})`, 'J');

    // For each zone, create a complete section matching dashboard
    for (const zone of zones) {
        const colors = getZoneColor(zone.zoneName);

        // Zone header (matching dashboard: Zone Name | Hit Rate | Target)
        row = writeSectionHeader(
            ws, row,
            `${zone.zoneName} Zone  |  HIT RATE: ${zone.hitRate}%  |  TARGET: ${formatCurrencyCompact(zone.yearlyTarget)}`,
            'J', colors.accent
        );

        // Column headers (matching dashboard exactly - now includes No of offers)
        row = writeColumnHeaders(ws, row, MONTHLY_HEADERS, applyMonthlySubHeaderStyle);

        // Monthly data rows (matching dashboard)
        zone.monthlyData.forEach((m, idx) => {
            const bgColor = idx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;
            row = writeMonthlyDataRow(ws, row, m, bgColor);
        });

        // Total row (dark background like dashboard)
        const totalNoOfOffers = zone.monthlyData.reduce((sum, m) => sum + (m.noOfOffers || 0), 0);
        row = writeDarkTotalRow(ws, row, totalNoOfOffers, zone.totals);

        // ---- Product Breakdown Section (matches dashboard expandable product section) ----
        if (zone.productBreakdown && zone.productBreakdown.length > 0) {
            row++; // spacer
            row = writeProductBreakdown(ws, row, zone.productBreakdown, zone.zoneName, 'J');
        }

        row += 2; // Space before next zone
    }

    // Set column widths matching dashboard proportions
    ws.columns = [
        { width: 12 },  // Month
        { width: 12 },  // No of Offers
        { width: 14 },  // Offers Value
        { width: 16 },  // Orders Received
        { width: 14 },  // Open Funnel
        { width: 12 },  // BU/MO
        { width: 10 },  // %Dev
        { width: 14 },  // OfferBU
        { width: 10 },  // %Dev
    ];
};

// ============ Sheet 3: User Monthly (All Fields with Product Breakdown) ============

const generateUserMonthlySheet = (
    workbook: ExcelJS.Workbook,
    users: UserMonthlyBreakdown[],
    year: number
): void => {
    const ws = workbook.addWorksheet('User Monthly', {
        properties: { tabColor: { argb: '8B5CF6' } },
    });

    let row = writeSheetTitle(ws, 1, `USER-WISE MONTHLY BREAKDOWN (${year})`, 'L');

    // Group users by zone
    const usersByZone: { [zoneName: string]: UserMonthlyBreakdown[] } = {};
    users.forEach(user => {
        const zone = user.zoneName || 'Unknown';
        if (!usersByZone[zone]) usersByZone[zone] = [];
        usersByZone[zone].push(user);
    });

    // For each zone, create user sections
    for (const [zoneName, zoneUsers] of Object.entries(usersByZone)) {
        const colors = getZoneColor(zoneName);

        // Zone header
        row = writeSectionHeader(ws, row, `📍 ${zoneName} ZONE`, 'L', colors.accent, { fontSize: 14 });
        row++;

        // For each user in this zone
        for (const user of zoneUsers) {
            // User info row
            ws.mergeCells(`A${row}:L${row}`);
            const userHeader = ws.getCell(`A${row}`);
            userHeader.value = `👤 ${user.userName} (${user.userShortForm || 'N/A'}) | Hit Rate: ${user.hitRate}% | Target: ₹${formatInLakhs(user.yearlyTarget)}`;
            userHeader.font = { size: 11, bold: true, color: { argb: COLORS.titleText } };
            userHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
            userHeader.alignment = { horizontal: 'left', vertical: 'middle' };
            ws.getRow(row).height = 24;
            row++;

            // Column headers (now includes No of Offers)
            const headers = [
                'Month', 'No of Offers', 'Offers Value', 'Orders Received', 'Open Funnel',
                'BU/Monthly', '% Deviation', 'Offer BU Month', 'Offer BU Dev %'
            ];
            row = writeColumnHeaders(ws, row, headers);

            // Monthly data
            user.monthlyData.forEach((m, idx) => {
                const isEven = idx % 2 === 0;
                const bgColor = isEven ? COLORS.rowEven : COLORS.rowOdd;

                const rowData = [
                    m.monthLabel,
                    m.noOfOffers || 0,
                    formatInLakhs(m.offersValue),
                    formatInLakhs(m.orderReceived),
                    formatInLakhs(m.ordersInHand),
                    formatInLakhs(m.buMonthly),
                    m.percentDev !== null ? `${m.percentDev}%` : '-',
                    formatInLakhs(m.offerBUMonth),
                    m.offerBUMonthDev !== null ? `${m.offerBUMonthDev}%` : '-',
                ];

                rowData.forEach((val, colIdx) => {
                    const cell = ws.getCell(row, colIdx + 1);
                    cell.value = val;
                    applyDataCellStyle(cell, bgColor, colIdx > 0);

                    // Color deviation columns
                    if (colIdx === 6 && m.percentDev !== null) {
                        cell.font = { bold: true, color: { argb: m.percentDev >= 0 ? COLORS.positive : COLORS.negative } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: m.percentDev >= 0 ? COLORS.positiveBg : COLORS.negativeBg } };
                    }
                    if (colIdx === 8 && m.offerBUMonthDev !== null) {
                        cell.font = { bold: true, color: { argb: m.offerBUMonthDev >= 0 ? COLORS.positive : COLORS.negative } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: m.offerBUMonthDev >= 0 ? COLORS.positiveBg : COLORS.negativeBg } };
                    }
                    // BU columns
                    if (colIdx === 5) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colBUBg } };
                        cell.font = { color: { argb: COLORS.colBU } };
                    }
                    if (colIdx === 7) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colOfferBUBg } };
                        cell.font = { color: { argb: COLORS.colOfferBU } };
                    }
                });
                row++;
            });

            // User totals
            const achievement = user.yearlyTarget > 0
                ? parseFloat(((user.totals.orderReceived / user.yearlyTarget) * 100).toFixed(1))
                : 0;

            const userTotalData = [
                'USER TOTAL',
                user.monthlyData.reduce((s, m) => s + (m.noOfOffers || 0), 0),
                formatInLakhs(user.totals.offersValue),
                formatInLakhs(user.totals.orderReceived),
                formatInLakhs(user.totals.ordersInHand),
                formatInLakhs(user.totals.buMonthly),
                `${achievement}%`,
                formatInLakhs(user.totals.offerBUMonth),
                '-',
            ];

            userTotalData.forEach((val, colIdx) => {
                const cell = ws.getCell(row, colIdx + 1);
                cell.value = val;
                applyTotalRowStyle(cell, false);
            });
            row++;

            // ---- User Product Breakdown Section (matches dashboard) ----
            if (user.productBreakdown && user.productBreakdown.length > 0) {
                row++; // spacer
                row = writeProductBreakdown(ws, row, user.productBreakdown, user.userName, 'L');
            }

            row += 2;
        }

        row += 2; // Extra space before next zone
    }

    // Set column widths
    ws.columns = [
        { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 14 },
        { width: 14 }, { width: 12 }, { width: 16 }, { width: 14 },
    ];
};

// ============ Sheet 4: Consolidated Monthly Comparison ============

/**
 * Write a consolidated zone × month grid for a single metric.
 * Returns the next row number after writing the section.
 */
const writeConsolidatedSection = (
    ws: ExcelJS.Worksheet,
    row: number,
    title: string,
    zones: ZoneMonthlyBreakdown[],
    months: string[],
    headers: string[],
    extractValue: (m: MonthlyData) => number
): number => {
    // Section title
    ws.mergeCells(`A${row}:O${row}`);
    const sectionTitle = ws.getCell(`A${row}`);
    sectionTitle.value = title;
    sectionTitle.font = { size: 12, bold: true, color: { argb: COLORS.titleText } };
    sectionTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
    row += 2;

    // Headers
    row = writeColumnHeaders(ws, row, headers);

    // Zone data rows
    const grandTotals: number[] = new Array(12).fill(0);

    zones.forEach((zone) => {
        const colors = getZoneColor(zone.zoneName);
        let zoneTotal = 0;

        const zoneCell = ws.getCell(row, 1);
        zoneCell.value = zone.zoneName;
        zoneCell.font = { bold: true };
        zoneCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        zoneCell.border = { left: { style: 'medium', color: { argb: colors.accent } } };

        zone.monthlyData.forEach((m, idx) => {
            const cell = ws.getCell(row, idx + 2);
            const val = extractValue(m);
            cell.value = formatInLakhs(val);
            cell.numFmt = '#,##0.00';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
            cell.alignment = { horizontal: 'right' };
            zoneTotal += val;
            grandTotals[idx] += val;
        });

        const totalCell = ws.getCell(row, 14);
        totalCell.value = formatInLakhs(zoneTotal);
        totalCell.numFmt = '#,##0.00';
        totalCell.font = { bold: true };
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
        totalCell.alignment = { horizontal: 'right' };

        row++;
    });

    // Grand total row
    const grandTotalCell = ws.getCell(row, 1);
    grandTotalCell.value = 'GRAND TOTAL';
    applyTotalRowStyle(grandTotalCell, true);

    grandTotals.forEach((val, idx) => {
        const cell = ws.getCell(row, idx + 2);
        cell.value = formatInLakhs(val);
        cell.numFmt = '#,##0.00';
        applyTotalRowStyle(cell, true);
        cell.alignment = { horizontal: 'right' };
    });

    const grandTotal = grandTotals.reduce((a, b) => a + b, 0);
    const grandTotalValCell = ws.getCell(row, 14);
    grandTotalValCell.value = formatInLakhs(grandTotal);
    grandTotalValCell.numFmt = '#,##0.00';
    applyTotalRowStyle(grandTotalValCell, true);
    grandTotalValCell.alignment = { horizontal: 'right' };

    return row + 3;
};

const generateConsolidatedMonthlySheet = (
    workbook: ExcelJS.Workbook,
    zones: ZoneMonthlyBreakdown[],
    year: number
): void => {
    const ws = workbook.addWorksheet('Consolidated Monthly', {
        properties: { tabColor: { argb: '10B981' } },
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const headers = ['Zone', ...months, 'TOTAL'];

    let row = writeSheetTitle(ws, 1, `CONSOLIDATED MONTHLY COMPARISON (${year})`, 'O');

    // Orders Received section
    row = writeConsolidatedSection(ws, row, '📊 ORDERS RECEIVED BY ZONE (Monthly)', zones, months, headers, (m) => m.orderReceived);

    // Offers Value section
    row = writeConsolidatedSection(ws, row, '📊 OFFERS VALUE BY ZONE (Monthly)', zones, months, headers, (m) => m.offersValue);

    // Open Funnel section
    writeConsolidatedSection(ws, row, '📊 OPEN FUNNEL BY ZONE (Monthly)', zones, months, headers, (m) => m.ordersInHand);

    // Set column widths
    ws.columns = [
        { width: 12 },
        ...months.map(() => ({ width: 10 })),
        { width: 12 },
    ];

    // Freeze first row and column
    ws.views = [{ state: 'frozen' as const, ySplit: 4, xSplit: 1 }];
};

// ============ Sheet 5: PO Expected Month (Zone-wise with User breakdown) ============

const generatePOExpectedSheet = (
    workbook: ExcelJS.Workbook,
    data: POExpectedData,
    year: number
): void => {
    if (!data || !data.zones) return;

    const ws = workbook.addWorksheet('PO Expected Month', {
        properties: { tabColor: { argb: 'F59E0B' } },
    });

    const months = data.months || ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    let row = writeSheetTitle(ws, 1, `PO EXPECTED MONTH BREAKDOWN (${year}) - All Values in ₹ Lakhs`, 'O');

    // For each zone
    for (const zone of data.zones) {
        const colors = getZoneColor(zone.zoneName);

        // Zone header
        row = writeSectionHeader(
            ws, row,
            `📍 ${zone.zoneName} ZONE | Total: ₹${formatInLakhs(zone.grandTotal)}L`,
            'O', colors.accent, { fontSize: 13, height: 26 }
        );
        row++;

        // Headers
        const poHeaders = ['User', ...months, 'TOTAL'];
        row = writeColumnHeaders(ws, row, poHeaders);

        // User data rows
        (zone.users || []).forEach((user, idx) => {
            const isEven = idx % 2 === 0;
            const bgColor = isEven ? COLORS.rowEven : COLORS.rowOdd;

            const userCell = ws.getCell(row, 1);
            userCell.value = user.userName;
            userCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

            months.forEach((m, mIdx) => {
                const cell = ws.getCell(row, mIdx + 2);
                const val = user.monthlyValues?.[m] || 0;
                cell.value = formatInLakhs(val);
                cell.numFmt = '#,##0.00';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { horizontal: 'right' };
            });

            const totalCell = ws.getCell(row, months.length + 2);
            totalCell.value = formatInLakhs(user.total || 0);
            totalCell.numFmt = '#,##0.00';
            totalCell.font = { bold: true };
            totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
            totalCell.alignment = { horizontal: 'right' };

            row++;
        });

        // Zone total row
        const zoneTotalCell = ws.getCell(row, 1);
        zoneTotalCell.value = `${zone.zoneName} TOTAL`;
        applyTotalRowStyle(zoneTotalCell, false);

        months.forEach((m, mIdx) => {
            const cell = ws.getCell(row, mIdx + 2);
            cell.value = formatInLakhs(zone.monthlyTotals?.[m] || 0);
            cell.numFmt = '#,##0.00';
            applyTotalRowStyle(cell, false);
            cell.alignment = { horizontal: 'right' };
        });

        const poGrandTotalCell = ws.getCell(row, months.length + 2);
        poGrandTotalCell.value = formatInLakhs(zone.grandTotal || 0);
        poGrandTotalCell.numFmt = '#,##0.00';
        applyTotalRowStyle(poGrandTotalCell, true);

        row += 3;
    }

    // Overall Grand Total Section
    if (data.overallTotals) {
        ws.mergeCells(`A${row}:O${row}`);
        const gtHeader = ws.getCell(`A${row}`);
        gtHeader.value = '📊 OVERALL GRAND TOTAL';
        gtHeader.font = { size: 12, bold: true, color: { argb: COLORS.headerText } };
        gtHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grandTotalBg } };
        gtHeader.alignment = { horizontal: 'left', vertical: 'middle' };
        row++;

        const gtLabel = ws.getCell(row, 1);
        gtLabel.value = 'ALL ZONES';
        applyTotalRowStyle(gtLabel, true);

        months.forEach((m, mIdx) => {
            const cell = ws.getCell(row, mIdx + 2);
            cell.value = formatInLakhs(data.overallTotals!.monthlyTotals?.[m] || 0);
            applyTotalRowStyle(cell, true);
            cell.alignment = { horizontal: 'right' };
        });

        const overallCell = ws.getCell(row, months.length + 2);
        overallCell.value = formatInLakhs(data.overallTotals.grandTotal || 0);
        applyTotalRowStyle(overallCell, true);
        overallCell.alignment = { horizontal: 'right' };

        row += 2;
    }

    // Set column widths
    ws.columns = [
        { width: 18 },
        ...months.map(() => ({ width: 10 })),
        { width: 12 },
    ];
};

// ============ Sheet 6: Product × User × Zone ============

const generateProductUserZoneSheet = (
    workbook: ExcelJS.Workbook,
    data: ProductUserZoneData,
    year: number
): void => {
    if (!data || !data.zones) return;

    const ws = workbook.addWorksheet('Product User Zone', {
        properties: { tabColor: { argb: '8B5CF6' } },
    });

    let row = writeSheetTitle(ws, 1, `PRODUCT × USER × ZONE BREAKDOWN (${year})`, 'H');

    // All Zones Summary Table (matches dashboard "All Zones Summary" section)
    if (data.zones.length > 1 && data.productTypes) {
        ws.mergeCells(`A${row}:${String.fromCharCode(65 + data.zones.length + 1)}${row}`);
        const summaryHeader = ws.getCell(`A${row}`);
        summaryHeader.value = '📊 ALL ZONES PRODUCT SUMMARY';
        summaryHeader.font = { size: 12, bold: true, color: { argb: COLORS.titleText } };
        summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
        row += 2;

        const summaryHeaders = ['Product', ...data.zones.map((z) => z.zoneName), 'TOTAL'];
        row = writeColumnHeaders(ws, row, summaryHeaders);

        (data.productTypes || []).forEach((product, idx) => {
            const isEven = idx % 2 === 0;
            const bgColor = isEven ? COLORS.rowEven : COLORS.rowOdd;
            let productTotal = 0;

            const productCell = ws.getCell(row, 1);
            productCell.value = product.label;
            productCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

            data.zones.forEach((zone, zIdx) => {
                const cell = ws.getCell(row, zIdx + 2);
                const productRow = zone.productMatrix?.find((p) => p.productType === product.key);
                const val = productRow?.total || 0;
                productTotal += val;
                cell.value = val > 0 ? formatInLakhs(val) : '-';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { horizontal: 'right' };
            });

            const totalCell = ws.getCell(row, data.zones.length + 2);
            totalCell.value = formatInLakhs(productTotal);
            totalCell.font = { bold: true };
            totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
            totalCell.alignment = { horizontal: 'right' };

            row++;
        });

        // Grand total
        const gtLabel = ws.getCell(row, 1);
        gtLabel.value = 'GRAND TOTAL';
        applyTotalRowStyle(gtLabel, true);

        data.zones.forEach((zone, zIdx) => {
            const cell = ws.getCell(row, zIdx + 2);
            cell.value = formatInLakhs(zone.zoneTotalValue || 0);
            applyTotalRowStyle(cell, true);
            cell.alignment = { horizontal: 'right' };
        });

        const overallTotal = data.zones.reduce((s, z) => s + (z.zoneTotalValue || 0), 0);
        const gtCell = ws.getCell(row, data.zones.length + 2);
        gtCell.value = formatInLakhs(overallTotal);
        applyTotalRowStyle(gtCell, true);
        gtCell.alignment = { horizontal: 'right' };

        row += 3;
    }

    // For each zone - detailed breakdown
    for (const zone of data.zones) {
        const colors = getZoneColor(zone.zoneName);
        const users = zone.users || [];

        // Zone header
        const lastCol = Math.max(users.length + 2, 3);
        ws.mergeCells(`A${row}:${String.fromCharCode(64 + lastCol)}${row}`);
        const zoneHeader = ws.getCell(`A${row}`);
        zoneHeader.value = `📍 ${zone.zoneName} ZONE | Total: ₹${formatInLakhs(zone.zoneTotalValue || 0)}L`;
        zoneHeader.font = { size: 13, bold: true, color: { argb: COLORS.headerText } };
        zoneHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } };
        ws.getRow(row).height = 26;
        row += 2;

        // Headers
        const zoneHeaders = ['Product', ...users.map((u) => u.name?.split(' ')[0] || 'User'), 'TOTAL'];
        row = writeColumnHeaders(ws, row, zoneHeaders);

        // Product rows
        (zone.productMatrix || []).forEach((product, idx) => {
            const isEven = idx % 2 === 0;
            const bgColor = isEven ? COLORS.rowEven : COLORS.rowOdd;

            const productCell = ws.getCell(row, 1);
            productCell.value = product.productLabel || product.productType?.replace(/_/g, ' ');
            productCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

            users.forEach((user, uIdx) => {
                const cell = ws.getCell(row, uIdx + 2);
                const val = product.userValues?.[user.id] || 0;
                cell.value = val > 0 ? formatInLakhs(val) : '-';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { horizontal: 'right' };
            });

            const totalCell = ws.getCell(row, users.length + 2);
            totalCell.value = formatInLakhs(product.total || 0);
            totalCell.font = { bold: true };
            totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
            totalCell.alignment = { horizontal: 'right' };

            row++;
        });

        // User totals row
        const totalLabel = ws.getCell(row, 1);
        totalLabel.value = 'USER TOTAL';
        applyTotalRowStyle(totalLabel, true);

        users.forEach((user, uIdx) => {
            const cell = ws.getCell(row, uIdx + 2);
            cell.value = formatInLakhs(zone.userTotals?.[user.id] || 0);
            applyTotalRowStyle(cell, true);
            cell.alignment = { horizontal: 'right' };
        });

        const puzGrandTotalCell = ws.getCell(row, users.length + 2);
        puzGrandTotalCell.value = formatInLakhs(zone.zoneTotalValue || 0);
        applyTotalRowStyle(puzGrandTotalCell, true);

        row += 3;
    }

    // Set column widths
    ws.columns = [{ width: 16 }];
};

// ============ Sheet 7: Product-wise Forecast (Zone → User → Product × Month) ============

const generateProductWiseForecastSheet = (
    workbook: ExcelJS.Workbook,
    data: ProductWiseForecastData,
    year: number
): void => {
    if (!data || !data.zones) return;

    const ws = workbook.addWorksheet('Product Wise Forecast', {
        properties: { tabColor: { argb: '10B981' } },
    });

    const months = data.months || ['MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB'];
    let row = writeSheetTitle(ws, 1, `PRODUCT-WISE MONTHLY FORECAST (${year}) - All Values in ₹ Lakhs`, 'P');

    // For each zone
    for (const zone of data.zones) {
        const colors = getZoneColor(zone.zoneName);

        // Zone header
        row = writeSectionHeader(
            ws, row,
            `📍 ${zone.zoneName} ZONE | Total: ₹${formatInLakhs(zone.grandTotal || 0)}L`,
            'P', colors.accent, { fontSize: 13, height: 26 }
        );
        row++;

        // For each user in zone
        for (const user of (zone.users || [])) {
            // User header
            ws.mergeCells(`A${row}:P${row}`);
            const userHeader = ws.getCell(`A${row}`);
            userHeader.value = `👤 ${user.userName} | Total: ₹${formatInLakhs(user.grandTotal || 0)}L`;
            userHeader.font = { size: 11, bold: true, color: { argb: COLORS.titleText } };
            userHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
            ws.getRow(row).height = 24;
            row++;

            // Headers
            const pwHeaders = ['Product', ...months, 'TOTAL'];
            row = writeColumnHeaders(ws, row, pwHeaders, applyHeaderStyle, 20);

            // Monthly totals row (All Products) - matching dashboard
            const allProdLabel = ws.getCell(row, 1);
            allProdLabel.value = 'All Products (Total)';
            allProdLabel.font = { bold: true, size: 10, color: { argb: COLORS.colOrders } };
            allProdLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colOrdersBg } };

            months.forEach((m, mIdx) => {
                const cell = ws.getCell(row, mIdx + 2);
                cell.value = formatInLakhs(user.monthlyTotals?.[m] || 0);
                cell.font = { bold: true, size: 10, color: { argb: COLORS.textDark } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colOrdersBg } };
                cell.alignment = { horizontal: 'right' };
            });

            const allProdTotal = ws.getCell(row, months.length + 2);
            allProdTotal.value = formatInLakhs(user.grandTotal || 0);
            allProdTotal.font = { bold: true, size: 10 };
            allProdTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.colOrdersBg } };
            allProdTotal.alignment = { horizontal: 'right' };
            row++;

            // Product rows
            (user.products || []).forEach((product, idx) => {
                const isEven = idx % 2 === 0;
                const bgColor = isEven ? COLORS.rowEven : COLORS.rowOdd;

                const productCell = ws.getCell(row, 1);
                productCell.value = product.productLabel || product.productType;
                productCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

                months.forEach((m, mIdx) => {
                    const cell = ws.getCell(row, mIdx + 2);
                    const val = product.monthlyValues?.[m] || 0;
                    cell.value = val > 0 ? formatInLakhs(val) : '-';
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                    cell.alignment = { horizontal: 'right' };
                });

                const totalCell = ws.getCell(row, months.length + 2);
                totalCell.value = formatInLakhs(product.total || 0);
                totalCell.font = { bold: true };
                totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
                totalCell.alignment = { horizontal: 'right' };

                row++;
            });

            row += 2;
        }

        // Zone total row
        const ztLabel = ws.getCell(row, 1);
        ztLabel.value = `${zone.zoneName} ZONE TOTAL`;
        applyTotalRowStyle(ztLabel, true);

        months.forEach((m, mIdx) => {
            const cell = ws.getCell(row, mIdx + 2);
            cell.value = formatInLakhs(zone.monthlyTotals?.[m] || 0);
            applyTotalRowStyle(cell, true);
            cell.alignment = { horizontal: 'right' };
        });

        const zoneGrandTotal = ws.getCell(row, months.length + 2);
        zoneGrandTotal.value = formatInLakhs(zone.grandTotal || 0);
        applyTotalRowStyle(zoneGrandTotal, true);
        zoneGrandTotal.alignment = { horizontal: 'right' };

        row += 3;
    }

    // Set column widths
    ws.columns = [
        { width: 16 },
        ...months.map(() => ({ width: 8 })),
        { width: 10 },
    ];
};

// ============ Main Export Function ============

export interface ForecastExportData {
    year: number;
    probability?: number | 'all';
    summaryData?: {
        zones: ZoneSummary[];
        totals: SummaryTotals;
    } | null;
    monthlyData?: {
        zones: ZoneMonthlyBreakdown[];
    } | null;
    userMonthlyData?: UserMonthlyBreakdown[] | null;
    poExpectedData?: POExpectedData | null;
    productUserZoneData?: ProductUserZoneData | null;
    productWiseForecastData?: ProductWiseForecastData | null;
}

/**
 * Export all forecast data to a comprehensive styled multi-sheet Excel workbook
 * Generates 7 sheets covering all dashboard tabs including product breakdowns
 */
export const exportForecastToExcel = async (
    data: ForecastExportData,
    filename?: string
): Promise<void> => {
    const { year, probability, summaryData, monthlyData, userMonthlyData, poExpectedData, productUserZoneData, productWiseForecastData } = data;

    // Create workbook with metadata
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KardexCare Forecast Dashboard';
    workbook.lastModifiedBy = 'KardexCare System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Sheet 1: Zone Summary (All Fields including %Dev)
    if (summaryData) {
        generateZoneSummarySheet(workbook, summaryData.zones, summaryData.totals, year);
    }

    // Sheet 2: Zone Monthly Breakdown (All Fields per Zone + Product Breakdowns)
    if (monthlyData?.zones && monthlyData.zones.length > 0) {
        generateZoneMonthlySheet(workbook, monthlyData.zones, year);
    }

    // Sheet 3: User Monthly Breakdown (All Fields per User + Product Breakdowns)
    if (userMonthlyData && userMonthlyData.length > 0) {
        generateUserMonthlySheet(workbook, userMonthlyData, year);
    }

    // Sheet 4: Consolidated Monthly Comparison (Orders, Offers, Funnel by Zone × Month)
    if (monthlyData?.zones && monthlyData.zones.length > 0) {
        generateConsolidatedMonthlySheet(workbook, monthlyData.zones, year);
    }

    // Sheet 5: PO Expected Month (Zone-wise with User breakdown)
    if (poExpectedData) {
        generatePOExpectedSheet(workbook, poExpectedData, year);
    }

    // Sheet 6: Product × User × Zone (with All Zones Summary)
    if (productUserZoneData) {
        generateProductUserZoneSheet(workbook, productUserZoneData, year);
    }

    // Sheet 7: Product-wise Forecast (Zone → User → Product × Month)
    if (productWiseForecastData) {
        generateProductWiseForecastSheet(workbook, productWiseForecastData, year);
    }

    // Generate filename
    const probabilityLabel = probability === 'all' ? 'All' : `${probability}pct`;
    const dateStr = new Date().toISOString().split('T')[0];
    const defaultFilename = `Forecast_Report_${year}_${probabilityLabel}_${dateStr}.xlsx`;

    await triggerDownload(workbook, filename || defaultFilename);
};

/**
 * Export only Overview tab data
 */
export const exportOverviewToExcel = async (
    data: ForecastExportData,
    filename?: string
): Promise<void> => {
    const { year, probability, summaryData, monthlyData } = data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KardexCare Forecast Dashboard';
    workbook.created = new Date();

    if (summaryData) {
        generateZoneSummarySheet(workbook, summaryData.zones, summaryData.totals, year);
    }

    if (monthlyData?.zones && monthlyData.zones.length > 0) {
        generateZoneMonthlySheet(workbook, monthlyData.zones, year);
        generateConsolidatedMonthlySheet(workbook, monthlyData.zones, year);
    }

    const probabilityLabel = probability === 'all' ? 'All' : `${probability}pct`;
    const dateStr = new Date().toISOString().split('T')[0];
    const defaultFilename = `Forecast_Overview_${year}_${probabilityLabel}_${dateStr}.xlsx`;

    await triggerDownload(workbook, filename || defaultFilename);
};
