import { Response } from 'express';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export interface ColumnDefinition {
    key: string;
    header: string;
    format?: (value: any, item?: any) => string | number;
    dataType?: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'duration';
    width?: number;
}

// Professional color scheme matching Kardex Remstar branding
const COLORS = {
    // Primary brand colors
    brandPrimary: '1E3A8A',    // Deep blue
    brandSecondary: '3B82F6',  // Bright blue
    brandAccent: 'DC2626',     // Red accent (Kardex red)

    // UI colors
    headerBg: '1E3A8A',
    headerText: 'FFFFFF',
    titleBg: 'EFF6FF',
    titleText: '1E40AF',

    // Table colors
    tableHeader: '1E40AF',
    tableHeaderText: 'FFFFFF',
    rowEven: 'F8FAFC',
    rowOdd: 'FFFFFF',
    borderLight: 'E2E8F0',
    borderDark: 'CBD5E1',

    // Text colors
    textDark: '1E293B',
    textMedium: '475569',
    textLight: '64748B',

    // Status colors
    success: '059669',
    warning: 'D97706',
    danger: 'DC2626',
    info: '0284C7',
};

// Status color mapping for conditional formatting in the Status column
const STATUS_CELL_COLORS: Record<string, { bg: string; text: string }> = {
    'OPEN': { bg: 'DBEAFE', text: '1E40AF' },
    'ASSIGNED': { bg: 'EDE9FE', text: '6D28D9' },
    'IN_PROGRESS': { bg: 'FEF3C7', text: '92400E' },
    'IN_PROCESS': { bg: 'FEF3C7', text: '92400E' },
    'RESOLVED': { bg: 'D1FAE5', text: '065F46' },
    'CLOSED': { bg: 'F3F4F6', text: '374151' },
    'ESCALATED': { bg: 'FEE2E2', text: '991B1B' },
    'CANCELLED': { bg: 'F3F4F6', text: '6B7280' },
    'REOPENED': { bg: 'FEE2E2', text: 'B91C1C' },
    'ONSITE_VISIT_STARTED': { bg: 'CFFAFE', text: '155E75' },
    'ONSITE_VISIT_REACHED': { bg: 'CCFBF1', text: '134E4A' },
    'ONSITE_VISIT_IN_PROGRESS': { bg: 'FEF9C3', text: '713F12' },
    'ONSITE_VISIT_RESOLVED': { bg: 'D1FAE5', text: '065F46' },
    'ONSITE_VISIT_COMPLETED': { bg: 'D1FAE5', text: '047857' },
    'ONSITE_VISIT_PLANNED': { bg: 'E0F2FE', text: '0C4A6E' },
    'SPARE_PARTS_NEEDED': { bg: 'F3E8FF', text: '6B21A8' },
    'SPARE_PARTS_BOOKED': { bg: 'F3E8FF', text: '7C3AED' },
    'SPARE_PARTS_DELIVERED': { bg: 'EDE9FE', text: '5B21B6' },
    'PO_NEEDED': { bg: 'FCE7F3', text: '9D174D' },
    'PO_RECEIVED': { bg: 'FCE7F3', text: 'BE185D' },
    'WAITING_CUSTOMER': { bg: 'FEF3C7', text: '78350F' },
    'ON_HOLD': { bg: 'FFEDD5', text: '9A3412' },
};

// Priority color mapping
const PRIORITY_CELL_COLORS: Record<string, { bg: string; text: string }> = {
    'LOW': { bg: 'D1FAE5', text: '065F46' },
    'MEDIUM': { bg: 'FEF3C7', text: '92400E' },
    'HIGH': { bg: 'FEE2E2', text: '991B1B' },
    'CRITICAL': { bg: 'FDE8E8', text: '7C2D12' },
};

// Helper to safely format values
function formatExcelValue(value: any, column: ColumnDefinition, item?: any): any {
    if (value === null || value === undefined || value === '') return '-';

    if (column.format) {
        try {
            const result = column.format(value, item);
            return result === null || result === undefined ? '-' : result;
        } catch (e) {
            return String(value);
        }
    }

    switch (column.dataType) {
        case 'number':
            const numValue = Number(value);
            return isNaN(numValue) ? String(value) : numValue;
        case 'currency':
            const currValue = Number(value);
            return isNaN(currValue) ? String(value) : currValue;
        case 'percentage':
            const pctValue = Number(value);
            return isNaN(pctValue) ? String(value) : pctValue / 100;
        case 'duration':
            // Format minutes as "Xh Xm"
            const minutes = Number(value);
            if (isNaN(minutes) || minutes <= 0) return '-';
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
            if (hours > 0) return `${hours}h`;
            return `${mins}m`;
        case 'date':
            if (value instanceof Date) return value;
            if (typeof value === 'string' && !isNaN(Date.parse(value))) {
                return new Date(value);
            }
            return String(value);
        default:
            return String(value);
    }
}

// Helper to get nested object values
function getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return '';
    return path.split('.').reduce((current, key) => {
        if (current && typeof current === 'object' && key in current) {
            return current[key];
        }
        return '';
    }, obj);
}

// Helper to convert column number to Excel letter (1=A, 27=AA, etc.)
function getColumnLetter(colNum: number): string {
    let letter = '';
    while (colNum > 0) {
        const mod = (colNum - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        colNum = Math.floor((colNum - 1) / 26);
    }
    return letter;
}

// ======================================================================
// TICKET SUMMARY - Clean detail-only Excel (no headers/summaries/footers)
// ======================================================================
async function generateTicketExcel(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    data: any[],
    columns: ColumnDefinition[],
    title: string,
    filters: { [key: string]: any },
): Promise<void> {

    const validColumns = columns.length > 0 ? columns : getExcelColumns('ticket-summary');
    const colCount = validColumns.length;

    // ── Row 1: Column headers directly ──
    const headerRowNum = 1;
    const headerRow = worksheet.getRow(headerRowNum);
    headerRow.height = 30;

    validColumns.forEach((column, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = column.header;
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.tableHeader }
        };
        cell.font = { bold: true, color: { argb: COLORS.tableHeaderText }, size: 10, name: 'Calibri' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.headerBg } },
            left: { style: 'thin', color: { argb: COLORS.headerBg } },
            bottom: { style: 'medium', color: { argb: COLORS.brandPrimary } },
            right: { style: 'thin', color: { argb: COLORS.headerBg } }
        };

        // Set column width
        const col = worksheet.getColumn(index + 1);
        col.width = column.width || 15;
    });

    // ── Data rows starting from row 2 ──
    if (data.length === 0) {
        const lastColLetter = getColumnLetter(colCount);
        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const noDataCell = worksheet.getCell('A2');
        noDataCell.value = 'No data available for the selected criteria';
        noDataCell.font = { size: 11, color: { argb: COLORS.textMedium }, italic: true };
        noDataCell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
        data.forEach((item, rowIndex) => {
            const currentRow = rowIndex + 2; // data starts at row 2
            const dataRow = worksheet.getRow(currentRow);
            dataRow.height = 22;
            const isEven = rowIndex % 2 === 0;

            validColumns.forEach((column, colIndex) => {
                const cell = dataRow.getCell(colIndex + 1);

                // Handle S.No column
                if (column.key === '_sno') {
                    cell.value = rowIndex + 1;
                } else {
                    const rawValue = getNestedValue(item, column.key);
                    const formattedValue = formatExcelValue(rawValue, column, item);
                    cell.value = formattedValue;
                    
                    // Format status nicely (remove underscores)
                    if (column.key === 'status') {
                        cell.value = String(rawValue || '').replace(/_/g, ' ');
                    }
                }

                // Clean data formatting - no background colors for ticket details
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isEven ? COLORS.rowEven : COLORS.rowOdd }
                };

                // Number formatting
                switch (column.dataType) {
                    case 'currency':
                        cell.numFmt = '"₹"#,##0.00';
                        break;
                    case 'percentage':
                        cell.numFmt = '0.00%';
                        break;
                    case 'date':
                        cell.numFmt = 'dd-mmm-yyyy hh:mm';
                        break;
                    case 'number':
                        cell.numFmt = '#,##0';
                        break;
                }

                // Borders
                cell.border = {
                    top: { style: 'thin', color: { argb: COLORS.borderLight } },
                    left: { style: 'thin', color: { argb: COLORS.borderLight } },
                    bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
                    right: { style: 'thin', color: { argb: COLORS.borderLight } }
                };

                // Alignment based on data type
                cell.alignment = {
                    horizontal: column.key === '_sno' ? 'center' :
                        column.dataType === 'currency' || column.dataType === 'number' ? 'right' :
                            column.dataType === 'date' ? 'center' :
                                column.dataType === 'duration' ? 'center' :
                                    column.key === 'status' || column.key === 'priority' ? 'center' : 'left',
                    vertical: 'middle',
                    wrapText: false
                };
                cell.font = { size: 9, color: { argb: COLORS.textDark }, name: 'Calibri' };
            });
        });
    }

    // ── Freeze header row (row 1) ──
    if (data.length > 0) {
        worksheet.views = [{
            state: 'frozen',
            ySplit: 1,
            xSplit: 0, 
            topLeftCell: 'A2',
            activeCell: 'A2',
            zoomScale: 100,
            zoomScaleNormal: 100
        }];

        // Auto-filter on the header row
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: validColumns.length }
        };
    }

    // No headers or footers
    worksheet.headerFooter.oddHeader = '';
    worksheet.headerFooter.oddFooter = '';
}

// ======================================================================
// STANDARD REPORT - Full branded Excel with header/summary/footer
// ======================================================================
async function generateStandardExcel(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    data: any[],
    columns: ColumnDefinition[],
    title: string,
    filters: { [key: string]: any },
    summaryData?: any
): Promise<void> {

    const validColumns = columns.length > 0 ? columns : getExcelColumns('default');
    const colCount = validColumns.length;
    const lastColLetter = getColumnLetter(colCount);

    let currentRow = 1;

    // ==================================================
    // HEADER SECTION - Logo and Company Info
    // ==================================================
    const logoPath = path.join(__dirname, '..', 'assets', 'kardex-logo.png');
    const frontendLogoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'kardex.png');

    let logoAdded = false;
    for (const logoFile of [logoPath, frontendLogoPath]) {
        if (fs.existsSync(logoFile)) {
            try {
                const imageId = workbook.addImage({
                    filename: logoFile,
                    extension: 'png',
                });
                worksheet.addImage(imageId, {
                    tl: { col: 0, row: 0 },
                    ext: { width: 150, height: 45 }
                });
                logoAdded = true;
                break;
            } catch (e) { /* ignore */ }
        }
    }

    worksheet.getRow(currentRow).height = 35;
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const companyCell = worksheet.getCell(`A${currentRow}`);
    if (!logoAdded) {
        companyCell.value = 'KARDEX REMSTAR';
        companyCell.font = { size: 20, bold: true, color: { argb: COLORS.brandPrimary } };
    }
    companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow++;

    // Tagline with generation date
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const taglineCell = worksheet.getCell(`A${currentRow}`);
    taglineCell.value = `Service Management System | Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`;
    taglineCell.font = { size: 10, color: { argb: COLORS.textMedium }, italic: true };
    taglineCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // ==================================================
    // REPORT TITLE SECTION
    // ==================================================
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = title.toUpperCase();
    titleCell.font = { size: 16, bold: true, color: { argb: COLORS.titleText } };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.titleBg }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = {
        top: { style: 'medium', color: { argb: COLORS.brandPrimary } },
        bottom: { style: 'medium', color: { argb: COLORS.brandPrimary } }
    };
    worksheet.getRow(currentRow).height = 28;
    currentRow += 2;

    // ==================================================
    // FILTERS SECTION
    // ==================================================
    if (filters.from && filters.to) {
        const fromDate = format(new Date(filters.from), 'dd MMM yyyy');
        const toDate = format(new Date(filters.to), 'dd MMM yyyy');
        worksheet.getCell(`A${currentRow}`).value = 'Report Period:';
        worksheet.getCell(`A${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
        worksheet.getCell(`B${currentRow}`).value = `${fromDate} to ${toDate}`;
        worksheet.getCell(`B${currentRow}`).font = { size: 10, color: { argb: COLORS.brandPrimary } };
        currentRow++;
    }

    if (filters.zoneName || filters.zone) {
        worksheet.getCell(`A${currentRow}`).value = 'Zone:';
        worksheet.getCell(`A${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
        worksheet.getCell(`B${currentRow}`).value = filters.zoneName || filters.zone || 'All Zones';
        worksheet.getCell(`B${currentRow}`).font = { size: 10, color: { argb: COLORS.textDark } };
        currentRow++;
    }

    if (filters.reportType) {
        worksheet.getCell(`A${currentRow}`).value = 'Report Type:';
        worksheet.getCell(`A${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
        worksheet.getCell(`B${currentRow}`).value = filters.reportType.replace(/-/g, ' ').toUpperCase();
        worksheet.getCell(`B${currentRow}`).font = { size: 10, color: { argb: COLORS.textDark } };
        currentRow++;
    }

    if (filters.productType) {
        worksheet.getCell(`A${currentRow}`).value = 'Product Type:';
        worksheet.getCell(`A${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
        worksheet.getCell(`B${currentRow}`).value = filters.productType;
        worksheet.getCell(`B${currentRow}`).font = { size: 10, color: { argb: COLORS.textDark } };
        currentRow++;
    }

    if (filters.stage) {
        worksheet.getCell(`A${currentRow}`).value = 'Stage:';
        worksheet.getCell(`A${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
        worksheet.getCell(`B${currentRow}`).value = filters.stage;
        worksheet.getCell(`B${currentRow}`).font = { size: 10, color: { argb: COLORS.textDark } };
        currentRow++;
    }

    if (filters.createdBy) {
        worksheet.getCell(`A${currentRow}`).value = 'Created By:';
        worksheet.getCell(`A${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
        worksheet.getCell(`B${currentRow}`).value = filters.createdBy;
        worksheet.getCell(`B${currentRow}`).font = { size: 10, color: { argb: COLORS.textDark } };
        currentRow++;
    }
    currentRow++;

    // ==================================================
    // SUMMARY STATISTICS SECTION
    // ==================================================
    if (summaryData && Object.keys(summaryData).length > 0) {
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        const summaryTitle = worksheet.getCell(`A${currentRow}`);
        summaryTitle.value = '📊 SUMMARY STATISTICS';
        summaryTitle.font = { size: 12, bold: true, color: { argb: COLORS.titleText } };
        summaryTitle.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.titleBg }
        };
        summaryTitle.alignment = { horizontal: 'left', vertical: 'middle' };
        summaryTitle.border = {
            bottom: { style: 'medium', color: { argb: COLORS.brandSecondary } }
        };
        worksheet.getRow(currentRow).height = 24;
        currentRow++;

        const summaryMetrics: Array<{ label: string; value: string | number; color?: string }> = [];

        if (summaryData.totalTickets !== undefined) summaryMetrics.push({ label: 'Total Tickets', value: summaryData.totalTickets, color: COLORS.brandPrimary });
        if (summaryData.resolvedTickets !== undefined) summaryMetrics.push({ label: 'Resolved Tickets', value: summaryData.resolvedTickets, color: COLORS.success });
        if (summaryData.openTickets !== undefined) summaryMetrics.push({ label: 'Open Tickets', value: summaryData.openTickets, color: COLORS.warning });
        if (summaryData.closedTickets !== undefined) summaryMetrics.push({ label: 'Closed Tickets', value: summaryData.closedTickets, color: COLORS.textMedium });
        if (summaryData.inProgressTickets !== undefined) summaryMetrics.push({ label: 'In Progress', value: summaryData.inProgressTickets, color: COLORS.info });
        if (summaryData.escalatedTickets !== undefined) summaryMetrics.push({ label: 'Escalated Tickets', value: summaryData.escalatedTickets, color: COLORS.danger });
        if (summaryData.averageResolutionTime !== undefined) {
            const hours = Math.floor(summaryData.averageResolutionTime / 60);
            const mins = Math.round(summaryData.averageResolutionTime % 60);
            const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            summaryMetrics.push({ label: 'Avg Resolution Time', value: timeStr, color: COLORS.brandSecondary });
        }
        if (summaryData.totalOffers !== undefined) summaryMetrics.push({ label: 'Total Offers', value: summaryData.totalOffers, color: COLORS.brandPrimary });
        if (summaryData.totalOfferValue !== undefined) {
            const value = summaryData.totalOfferValue;
            let formattedValue: string;
            if (value >= 10000000) formattedValue = `₹${(value / 10000000).toFixed(2)} Cr`;
            else if (value >= 100000) formattedValue = `₹${(value / 100000).toFixed(2)} Lakh`;
            else formattedValue = `₹${value.toLocaleString('en-IN')}`;
            summaryMetrics.push({ label: 'Total Offer Value', value: formattedValue, color: COLORS.warning });
        }
        if (summaryData.totalPoValue !== undefined) {
            const value = summaryData.totalPoValue;
            let formattedValue: string;
            if (value >= 10000000) formattedValue = `₹${(value / 10000000).toFixed(2)} Cr`;
            else if (value >= 100000) formattedValue = `₹${(value / 100000).toFixed(2)} Lakh`;
            else formattedValue = `₹${value.toLocaleString('en-IN')}`;
            summaryMetrics.push({ label: 'Total PO Value', value: formattedValue, color: COLORS.success });
        }
        if (summaryData.wonOffers !== undefined) summaryMetrics.push({ label: 'Won Offers', value: summaryData.wonOffers, color: COLORS.success });
        if (summaryData.lostOffers !== undefined) summaryMetrics.push({ label: 'Lost Offers', value: summaryData.lostOffers, color: COLORS.danger });

        // Generic summary metrics
        Object.entries(summaryData).forEach(([key, value]) => {
            if (!['totalTickets', 'resolvedTickets', 'openTickets', 'closedTickets', 'inProgressTickets', 'escalatedTickets', 'averageResolutionTime', 'totalOffers', 'totalOfferValue', 'totalPoValue', 'wonOffers', 'lostOffers'].includes(key)) {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                if (typeof value === 'number' || typeof value === 'string') {
                    summaryMetrics.push({ label, value: value as string | number });
                }
            }
        });

        for (let i = 0; i < summaryMetrics.length; i += 2) {
            const metric1 = summaryMetrics[i];
            const metric2 = summaryMetrics[i + 1];
            worksheet.getCell(`A${currentRow}`).value = metric1.label + ':';
            worksheet.getCell(`A${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
            worksheet.getCell(`B${currentRow}`).value = metric1.value;
            worksheet.getCell(`B${currentRow}`).font = { size: 11, bold: true, color: { argb: metric1.color || COLORS.textDark } };
            if (metric2) {
                worksheet.getCell(`C${currentRow}`).value = metric2.label + ':';
                worksheet.getCell(`C${currentRow}`).font = { size: 10, bold: true, color: { argb: COLORS.textMedium } };
                worksheet.getCell(`D${currentRow}`).value = metric2.value;
                worksheet.getCell(`D${currentRow}`).font = { size: 11, bold: true, color: { argb: metric2.color || COLORS.textDark } };
            }
            currentRow++;
        }
        currentRow++;
    }

    // ==================================================
    // DATA TABLE SECTION
    // ==================================================
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const tableHeader = worksheet.getCell(`A${currentRow}`);
    tableHeader.value = `DATA (${data.length} Records)`;
    tableHeader.font = { size: 11, bold: true, color: { argb: COLORS.headerText } };
    tableHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.headerBg }
    };
    tableHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 22;
    currentRow++;

    // Column headers
    const headerRowNum = currentRow;
    const headerRow = worksheet.getRow(currentRow);
    headerRow.height = 26;

    validColumns.forEach((column, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = column.header;
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.tableHeader }
        };
        cell.font = { bold: true, color: { argb: COLORS.tableHeaderText }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.headerBg } },
            left: { style: 'thin', color: { argb: COLORS.headerBg } },
            bottom: { style: 'thin', color: { argb: COLORS.headerBg } },
            right: { style: 'thin', color: { argb: COLORS.headerBg } }
        };
        const col = worksheet.getColumn(index + 1);
        col.width = column.width || 15;
    });
    currentRow++;

    // Data rows
    if (data.length === 0) {
        worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
        const noDataCell = worksheet.getCell(`A${currentRow}`);
        noDataCell.value = 'No data available for the selected criteria';
        noDataCell.font = { size: 11, color: { argb: COLORS.textMedium }, italic: true };
        noDataCell.alignment = { horizontal: 'center', vertical: 'middle' };
        noDataCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.rowEven }
        };
        worksheet.getRow(currentRow).height = 30;
        currentRow++;
    } else {
        data.forEach((item, rowIndex) => {
            const dataRow = worksheet.getRow(currentRow);
            dataRow.height = 20;
            const isEven = rowIndex % 2 === 0;

            validColumns.forEach((column, colIndex) => {
                const cell = dataRow.getCell(colIndex + 1);

                if (column.key === '_sno') {
                    cell.value = rowIndex + 1;
                } else {
                    const rawValue = getNestedValue(item, column.key);
                    const formattedValue = formatExcelValue(rawValue, column, item);
                    cell.value = formattedValue;
                }

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isEven ? COLORS.rowEven : COLORS.rowOdd }
                };

                switch (column.dataType) {
                    case 'currency': cell.numFmt = '"₹"#,##0.00'; break;
                    case 'percentage': cell.numFmt = '0.00%'; break;
                    case 'date': cell.numFmt = 'dd-mmm-yyyy'; break;
                    case 'number': cell.numFmt = '#,##0'; break;
                }

                cell.border = {
                    top: { style: 'thin', color: { argb: COLORS.borderLight } },
                    left: { style: 'thin', color: { argb: COLORS.borderLight } },
                    bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
                    right: { style: 'thin', color: { argb: COLORS.borderLight } }
                };

                cell.alignment = {
                    horizontal: column.key === '_sno' ? 'center' :
                        column.dataType === 'currency' || column.dataType === 'number' ? 'right' :
                            column.dataType === 'date' ? 'center' : 'left',
                    vertical: 'middle',
                    wrapText: column.key === 'remarks'
                };

                cell.font = { size: 9, color: { argb: COLORS.textDark } };
            });
            currentRow++;
        });
    }

    // ==================================================
    // FOOTER SECTION
    // ==================================================
    currentRow++;
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const footerCell = worksheet.getCell(`A${currentRow}`);
    footerCell.value = `© ${new Date().getFullYear()} Kardex Remstar India Pvt. Ltd. | This report is confidential.`;
    footerCell.font = { size: 8, color: { argb: COLORS.textLight }, italic: true };
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ==================================================
    // EXCEL FEATURES
    // ==================================================
    if (data.length > 0) {
        worksheet.views = [{
            state: 'frozen',
            ySplit: headerRowNum,
            xSplit: 0,
            topLeftCell: 'A' + (headerRowNum + 1),
            activeCell: 'A' + (headerRowNum + 1),
            zoomScale: 85,
            zoomScaleNormal: 85
        }];
        worksheet.autoFilter = {
            from: { row: headerRowNum, column: 1 },
            to: { row: headerRowNum, column: validColumns.length }
        };
    } else {
        worksheet.views = [{
            state: 'normal',
            zoomScale: 100,
            zoomScaleNormal: 100
        }];
    }

    worksheet.headerFooter.oddFooter = '&C&8Page &P of &N | Generated by KardexCare';
}

// ======================================================================
// MAIN EXPORT FUNCTION - Routes to either ticket or standard Excel
// ======================================================================
export const generateExcel = async (
    res: Response,
    data: any[],
    columns: ColumnDefinition[],
    title: string,
    filters: { [key: string]: any },
    summaryData?: any
): Promise<void> => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'KardexCare System';
        workbook.lastModifiedBy = 'KardexCare Reports';
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.properties.date1904 = false;

        const isTicketReport = filters.reportType === 'ticket-summary' || filters.reportType === 'industrial-data';

        const worksheet = workbook.addWorksheet(isTicketReport ? 'Ticket Details' : 'Report', {
            properties: {
                tabColor: { argb: COLORS.brandPrimary },
                defaultRowHeight: 18
            },
            pageSetup: {
                paperSize: 9,
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: {
                    left: 0.5,
                    right: 0.5,
                    top: 0.75,
                    bottom: 0.75,
                    header: 0.3,
                    footer: 0.3
                }
            }
        });

        if (isTicketReport) {
            // DATA-ONLY MODE: No headers, no summaries, no logos. 
            // Just the clean table starting from Row 1.
            await generateTicketExcel(workbook, worksheet, data, columns, title, filters);
        } else {
            // BRANDED MODE: Full report with headers and summaries
            await generateStandardExcel(workbook, worksheet, data, columns, title, filters, summaryData);
        }

        // Set response headers
        const filename = `KardexCare-${title.replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate Excel report' });
        }
    }
};

// Column definitions for all report types
export const getExcelColumns = (reportType: string): ColumnDefinition[] => {
    const columns: Record<string, ColumnDefinition[]> = {
        'offer-summary': [
            { key: '_sno', header: 'S.No', width: 6, format: (value: any, item: any) => '', dataType: 'number' },
            { key: 'offerReferenceNumber', header: 'Offer Ref #', width: 18 },
            { key: 'offerReferenceDate', header: 'Offer Date', width: 13, dataType: 'date' },
            { key: 'zone.name', header: 'Zone', width: 14 },
            { key: 'customer.companyName', header: 'Customer', width: 24, format: (value: any, item: any) => item?.customer?.companyName || item?.company || '-' },
            { key: 'location', header: 'Location', width: 16 },
            { key: 'contactPersonName', header: 'Contact Person', width: 18 },
            {
                key: 'productType', header: 'Product Type', width: 16, format: (value: any) => {
                    const labels: Record<string, string> = {
                        'RELOCATION': 'Relocation', 'CONTRACT': 'Contract', 'SPARE_PARTS': 'Spare Parts',
                        'KARDEX_CONNECT': 'Kardex Connect', 'UPGRADE_KIT': 'Upgrade Kit', 'SOFTWARE': 'Software',
                        'OTHERS': 'Others', 'BD_SPARE': 'BD Spare', 'RETROFIT_KIT': 'Retrofit Kit', 'SSP': 'SSP'
                    };
                    return labels[value] || (value ? String(value).replace(/_/g, ' ') : '-');
                }
            },
            {
                key: 'lead', header: 'Lead', width: 10, format: (value: any) => {
                    const labels: Record<string, string> = { 'YES': 'Yes', 'NO': 'No' };
                    return labels[value] || value || '-';
                }
            },
            {
                key: 'stage', header: 'Stage', width: 16, format: (value: any) => {
                    const labels: Record<string, string> = {
                        'INITIAL': 'Initial', 'PROPOSAL_SENT': 'Proposal Sent', 'NEGOTIATION': 'Negotiation',
                        'PO_RECEIVED': 'PO Received', 'WON': 'Won', 'LOST': 'Lost'
                    };
                    return labels[value] || (value ? String(value).replace(/_/g, ' ') : '-');
                }
            },
            {
                key: 'status', header: 'Status', width: 10, format: (value: any) => {
                    const labels: Record<string, string> = { 'OPEN': 'Open', 'CLOSED': 'Closed', 'WON': 'Won', 'LOST': 'Lost' };
                    return labels[value] || (value ? String(value).replace(/_/g, ' ') : '-');
                }
            },
            {
                key: 'priority', header: 'Priority', width: 10, format: (value: any) => {
                    const labels: Record<string, string> = { 'LOW': 'Low', 'MEDIUM': 'Medium', 'HIGH': 'High', 'CRITICAL': 'Critical' };
                    return labels[value] || value || '-';
                }
            },
            { key: 'offerValue', header: 'Offer Value (₹)', width: 16, dataType: 'currency' },
            { key: 'offerMonth', header: 'Offer Month', width: 13 },
            {
                key: 'probabilityPercentage', header: 'Prob %', width: 10, dataType: 'number', format: (value: any) => {
                    const num = Number(value);
                    return isNaN(num) ? '-' : num;
                }
            },
            { key: 'poExpectedMonth', header: 'PO Expected', width: 13 },
            { key: 'poNumber', header: 'PO Number', width: 16 },
            { key: 'poDate', header: 'PO Date', width: 13, dataType: 'date' },
            { key: 'poValue', header: 'PO Value (₹)', width: 16, dataType: 'currency' },
            { key: 'poReceivedMonth', header: 'PO Received', width: 13 },
            { key: 'assignedTo.name', header: 'Assigned To', width: 16 },
            { key: 'createdBy.name', header: 'Created By', width: 16 },
            { key: 'openFunnel', header: 'Open Funnel', width: 12, format: (value: any) => value === true || value === 'true' ? 'Yes' : value === false || value === 'false' ? 'No' : '-' },
            { key: 'remarks', header: 'Remarks', width: 28 },
            { key: 'bookingDateInSap', header: 'SAP Booking', width: 13, dataType: 'date' },
            { key: 'createdAt', header: 'Created', width: 13, dataType: 'date' },
        ],
        'ticket-summary': [
            { key: '_sno', header: 'S.No', width: 6, format: (value: any, item: any) => '', dataType: 'number' },
            { key: 'ticketNumber', header: 'Ticket #', width: 12 },
            { key: 'createdAt', header: 'Created Date', width: 18, dataType: 'date' },
            { key: 'customer.companyName', header: 'Company Name', width: 28 },
            { key: 'customer.address', header: 'Customer Address', width: 32 },
            { key: 'asset.serialNo', header: 'Serial Number', width: 18 },
            { key: 'asset.model', header: 'Model', width: 16 },
            { key: 'callType', header: 'Call Type', width: 16 },
            { key: 'priority', header: 'Priority', width: 12 },
            { key: 'title', header: 'Title', width: 28 },
            { key: 'contact.name', header: 'Contact Person', width: 18 },
            { key: 'contact.phone', header: 'Contact Phone', width: 16 },
            { key: 'assignedTo.name', header: 'Assigned To', width: 18 },
            { key: 'zone.name', header: 'Zone', width: 14 },
            { key: 'visitPlannedDate', header: 'Scheduled Date', width: 18, dataType: 'date' },
            { key: 'visitStartedAt', header: 'Visit Started', width: 18, dataType: 'date' },
            { key: 'visitReachedAt', header: 'Visit Reached', width: 18, dataType: 'date' },
            { key: 'visitResolvedAt', header: 'Visit Resolved', width: 18, dataType: 'date' },
            { key: 'visitCompletedDate', header: 'Completed Date', width: 18, dataType: 'date' },
            { key: 'travelTime', header: 'Travel Time', width: 14, dataType: 'duration' },
            { key: 'onsiteWorkingTime', header: 'Onsite Time', width: 14, dataType: 'duration' },
            { key: 'totalResolutionTime', header: 'Resolution Time', width: 16, dataType: 'duration' },
            { key: 'status', header: 'Status', width: 22 },
        ],
        'target-report': [
            { key: 'zone.name', header: 'Zone', width: 16 },
            { key: 'userName', header: 'User', width: 18 },
            { key: 'targetPeriod', header: 'Period', width: 12 },
            { key: 'periodType', header: 'Type', width: 10 },
            { key: 'targetValue', header: 'Target', width: 14, dataType: 'currency' },
            { key: 'actualValue', header: 'Actual', width: 14, dataType: 'currency' },
            { key: 'achievement', header: 'Achievement', width: 12, dataType: 'percentage' },
        ],
        'zone-performance': [
            { key: 'name', header: 'Zone', width: 16 },
            { key: 'totalTickets', header: 'Total Tickets', width: 12, dataType: 'number' },
            { key: 'resolvedTickets', header: 'Resolved', width: 12, dataType: 'number' },
            { key: 'pendingTickets', header: 'Pending', width: 12, dataType: 'number' },
            { key: 'resolutionRate', header: 'Resolution %', width: 12, dataType: 'percentage' },
            { key: 'avgResolutionTime', header: 'Avg Time (hrs)', width: 14, dataType: 'number' },
        ],
        'agent-productivity': [
            { key: 'name', header: 'Agent Name', width: 20 },
            { key: 'email', header: 'Email', width: 24 },
            { key: 'totalTickets', header: 'Total Tickets', width: 12, dataType: 'number' },
            { key: 'resolvedTickets', header: 'Resolved', width: 12, dataType: 'number' },
            { key: 'avgResolutionTime', header: 'Avg Time (hrs)', width: 14, dataType: 'number' },
            { key: 'performanceScore', header: 'Score', width: 10, dataType: 'percentage' },
        ],
        'industrial-data': [
            { key: '_sno', header: 'S.No', width: 6, format: (value: any, item: any) => '', dataType: 'number' },
            { key: 'model', header: 'Model', width: 22 },
            { key: 'serialNo', header: 'Serial Number', width: 22 },
            { key: 'customer', header: 'Customer', width: 28 },
            { key: 'totalDowntimeMinutes', header: 'Total Downtime', width: 18, dataType: 'duration' },
            { key: 'incidents', header: 'Total Incidents', width: 14, dataType: 'number' },
            { key: 'openIncidents', header: 'Open Incidents', width: 14, dataType: 'number' },
            { key: 'resolvedIncidents', header: 'Resolved Incidents', width: 14, dataType: 'number' },
        ],
        'customer-performance': [
            { key: 'companyName', header: 'Customer', width: 24 },
            { key: 'totalTickets', header: 'Total Tickets', width: 12, dataType: 'number' },
            { key: 'totalOfferValue', header: 'Offer Value', width: 14, dataType: 'currency' },
            { key: 'totalPOValue', header: 'PO Value', width: 14, dataType: 'currency' },
            { key: 'zone.name', header: 'Zone', width: 12 },
        ],
        'product-type-analysis': [
            { key: 'productType', header: 'Product Type', width: 18 },
            { key: 'offerCount', header: 'Offers', width: 10, dataType: 'number' },
            { key: 'totalOfferValue', header: 'Offer Value', width: 14, dataType: 'currency' },
            { key: 'poCount', header: 'POs', width: 10, dataType: 'number' },
            { key: 'totalPOValue', header: 'PO Value', width: 14, dataType: 'currency' },
            { key: 'conversionRate', header: 'Conversion %', width: 12, dataType: 'percentage' },
        ],
        'default': [
            { key: 'id', header: 'ID', width: 10 },
            { key: 'name', header: 'Name', width: 20 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'value', header: 'Value', width: 14, dataType: 'currency' },
            { key: 'createdAt', header: 'Created', width: 12, dataType: 'date' },
        ]
    };

    return columns[reportType] || columns['default'];
};
