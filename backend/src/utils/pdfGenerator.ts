import { Response } from 'express';
import { format } from 'date-fns';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export interface ColumnDefinition {
    key: string;
    header: string;
    format?: (value: any, item?: any) => string;
    dataType?: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'duration';
    width?: number;
    align?: 'left' | 'center' | 'right';
}

// Professional color scheme matching Kardex Remstar branding
const COLORS = {
    // Primary brand colors
    brandPrimary: '#1E3A8A',
    brandSecondary: '#3B82F6',
    brandAccent: '#DC2626',

    // UI colors
    headerBg: '#1E3A8A',
    headerText: '#FFFFFF',
    titleBg: '#EFF6FF',
    titleText: '#1E40AF',

    // Table colors
    tableHeader: '#1E40AF',
    tableHeaderText: '#FFFFFF',
    rowEven: '#F8FAFC',
    rowOdd: '#FFFFFF',
    borderLight: '#E2E8F0',
    borderDark: '#CBD5E1',

    // Text colors
    textDark: '#1E293B',
    textMedium: '#475569',
    textLight: '#64748B',

    // Status colors
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0284C7',
};

// Helper to safely format values for PDF
function formatPdfValue(value: any, column: ColumnDefinition, item?: any): string {
    // If column has a custom format function, call it first (even for empty values)
    if (column.format) {
        try {
            const result = column.format(value, item);
            if (Array.isArray(result)) return result.join(', ');
            return result === null || result === undefined || result === '' ? '-' : String(result);
        } catch (e) {
            return value ? String(value) : '-';
        }
    }

    if (value === null || value === undefined || value === '') return '-';

    switch (column.dataType) {
        case 'number':
            const numValue = Number(value);
            return isNaN(numValue) ? String(value) : numValue.toLocaleString('en-IN');
        case 'currency':
            const currValue = Number(value);
            if (isNaN(currValue) || currValue === 0) return '-';
            if (currValue >= 10000000) {
                return `Rs. ${(currValue / 10000000).toFixed(2)} Cr`;
            } else if (currValue >= 100000) {
                return `Rs. ${(currValue / 100000).toFixed(2)} L`;
            }
            return `Rs. ${currValue.toLocaleString('en-IN')}`;
        case 'percentage':
            const pctValue = Number(value);
            return isNaN(pctValue) ? String(value) : `${pctValue.toFixed(1)}%`;
        case 'duration':
            const minutes = Number(value);
            if (isNaN(minutes) || minutes <= 0) return '-';
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
            if (hours > 0) return `${hours}h`;
            return `${mins}m`;
        case 'date':
            if (value instanceof Date) return format(value, 'dd MMM yyyy');
            if (typeof value === 'string' && !isNaN(Date.parse(value))) {
                return format(new Date(value), 'dd MMM yyyy');
            }
            return String(value);
        default:
            if (Array.isArray(value)) return value.join(', ');
            const str = String(value);
            return str.length > 30 ? str.substring(0, 27) + '...' : str;
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

// Main PDF generation function
export const generatePdf = async (
    res: Response,
    data: any[],
    columns: ColumnDefinition[],
    title: string,
    filters: { [key: string]: any },
    summaryData?: any
): Promise<void> => {
    try {
        const doc = new PDFDocument({
            margin: 40,
            size: 'A4',
            layout: 'landscape',
            bufferPages: true,
            info: {
                Title: `${title} - KardexCare Report`,
                Author: 'KardexCare System',
                Subject: 'Generated Report',
                Creator: 'KardexCare Reports v2.0',
                Producer: 'PDFKit',
                CreationDate: new Date()
            }
        });

        // Ensure we have valid columns
        const validColumns = columns.length > 0 ? columns : getPdfColumns('default');

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const contentWidth = pageWidth - 80;
        const leftMargin = 40;
        const rightMargin = pageWidth - 40;

        res.setHeader('Content-Type', 'application/pdf');
        const filename = `KardexCare-${title.replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // ==================================================
        // HEADER SECTION - Logo and Branding
        // ==================================================

        // Header background
        doc.save()
            .rect(0, 0, pageWidth, 70)
            .fill(COLORS.headerBg)
            .restore();

        // Try to add logo
        const logoPath = path.join(__dirname, '..', 'assets', 'kardex-logo.png');
        const frontendLogoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'kardex.png');

        let logoAdded = false;
        for (const logoFile of [logoPath, frontendLogoPath]) {
            if (fs.existsSync(logoFile)) {
                try {
                    doc.image(logoFile, leftMargin, 15, { height: 40 });
                    logoAdded = true;
                    break;
                } catch (e) {

                }
            }
        }

        // Company name (if no logo) - centered
        if (!logoAdded) {
            doc.fillColor(COLORS.headerText)
                .fontSize(20)
                .font('Helvetica-Bold')
                .text('KARDEX REMSTAR', leftMargin, 12, { width: contentWidth, align: 'left', lineBreak: false });

            doc.fillColor('#94A3B8')
                .fontSize(8)
                .font('Helvetica')
                .text('Service Management System', leftMargin, 36, { lineBreak: false });
        } else {
            // Tagline below logo
            doc.fillColor('#94A3B8')
                .fontSize(8)
                .font('Helvetica')
                .text('Service Management System', leftMargin, 48, { lineBreak: false });
        }

        // Report title - right side of header
        doc.fillColor(COLORS.headerText)
            .fontSize(13)
            .font('Helvetica-Bold')
            .text(title.toUpperCase(), pageWidth / 3, 20, { width: pageWidth / 2, align: 'center', lineBreak: false });

        // Generation timestamp
        doc.fillColor('#94A3B8')
            .fontSize(8)
            .font('Helvetica')
            .text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, rightMargin - 180, 45, { width: 170, align: 'right', lineBreak: false });

        let currentY = 80;

        // ==================================================
        // FILTERS SECTION
        // ==================================================
        const hasFilters = filters.from || filters.to || filters.zoneName || filters.zone || filters.reportType;
        const hasExtraFilters = filters.productType || filters.stage || filters.createdBy;
        const filterBoxHeight = hasExtraFilters ? 50 : 35;

        if (hasFilters || hasExtraFilters) {
            // Filter box background
            doc.save()
                .roundedRect(leftMargin, currentY, contentWidth, filterBoxHeight, 5)
                .fill(COLORS.titleBg)
                .restore();

            let filterX = leftMargin + 15;
            const filterY = currentY + 8;

            if (filters.from && filters.to) {
                doc.fillColor(COLORS.textMedium)
                    .fontSize(9)
                    .font('Helvetica-Bold')
                    .text('Period:', filterX, filterY, { lineBreak: false });
                filterX += 40;

                const fromDate = format(new Date(filters.from), 'dd MMM yyyy');
                const toDate = format(new Date(filters.to), 'dd MMM yyyy');
                doc.fillColor(COLORS.brandPrimary)
                    .fontSize(9)
                    .font('Helvetica')
                    .text(`${fromDate} - ${toDate}`, filterX, filterY, { lineBreak: false });
                filterX += 155;
            }

            if (filters.zoneName || filters.zone) {
                doc.fillColor(COLORS.textMedium)
                    .fontSize(9)
                    .font('Helvetica-Bold')
                    .text('Zone:', filterX, filterY, { lineBreak: false });
                filterX += 35;

                doc.fillColor(COLORS.brandPrimary)
                    .fontSize(9)
                    .font('Helvetica')
                    .text(filters.zoneName || filters.zone, filterX, filterY, { lineBreak: false });
                filterX += 100;
            }

            // Second row of filters
            if (hasExtraFilters) {
                let filterX2 = leftMargin + 15;
                const filterY2 = filterY + 18;

                if (filters.productType) {
                    doc.fillColor(COLORS.textMedium)
                        .fontSize(9)
                        .font('Helvetica-Bold')
                        .text('Product:', filterX2, filterY2, { lineBreak: false });
                    filterX2 += 48;
                    doc.fillColor(COLORS.brandPrimary)
                        .fontSize(9)
                        .font('Helvetica')
                        .text(filters.productType, filterX2, filterY2, { lineBreak: false });
                    filterX2 += 100;
                }

                if (filters.stage) {
                    doc.fillColor(COLORS.textMedium)
                        .fontSize(9)
                        .font('Helvetica-Bold')
                        .text('Stage:', filterX2, filterY2, { lineBreak: false });
                    filterX2 += 35;
                    doc.fillColor(COLORS.brandPrimary)
                        .fontSize(9)
                        .font('Helvetica')
                        .text(filters.stage, filterX2, filterY2, { lineBreak: false });
                    filterX2 += 100;
                }

                if (filters.createdBy) {
                    doc.fillColor(COLORS.textMedium)
                        .fontSize(9)
                        .font('Helvetica-Bold')
                        .text('Created By:', filterX2, filterY2, { lineBreak: false });
                    filterX2 += 60;
                    doc.fillColor(COLORS.brandPrimary)
                        .fontSize(9)
                        .font('Helvetica')
                        .text(filters.createdBy, filterX2, filterY2, { lineBreak: false });
                }
            }

            currentY += filterBoxHeight + 10;
        }

        // ==================================================
        // SUMMARY STATISTICS SECTION (if summaryData provided)
        // ==================================================
        if (summaryData && Object.keys(summaryData).length > 0) {
            // Summary section title
            doc.save()
                .rect(leftMargin, currentY, contentWidth, 20)
                .fill(COLORS.titleBg)
                .restore();

            doc.fillColor(COLORS.titleText)
                .fontSize(10)
                .font('Helvetica-Bold')
                .text('Summary Statistics', leftMargin + 10, currentY + 5, { lineBreak: false });
            currentY += 25;

            // Build summary metrics
            const summaryMetrics: Array<{ label: string; value: string; color: string }> = [];

            // Ticket-specific metrics
            if (summaryData.totalTickets !== undefined) {
                summaryMetrics.push({ label: 'Total Tickets', value: String(summaryData.totalTickets), color: COLORS.brandPrimary });
            }
            if (summaryData.resolvedTickets !== undefined) {
                summaryMetrics.push({ label: 'Resolved', value: String(summaryData.resolvedTickets), color: COLORS.success });
            }
            if (summaryData.openTickets !== undefined) {
                summaryMetrics.push({ label: 'Open', value: String(summaryData.openTickets), color: COLORS.warning });
            }
            if (summaryData.closedTickets !== undefined) {
                summaryMetrics.push({ label: 'Closed', value: String(summaryData.closedTickets), color: COLORS.textMedium });
            }
            if (summaryData.escalatedTickets !== undefined) {
                summaryMetrics.push({ label: 'Escalated', value: String(summaryData.escalatedTickets), color: COLORS.danger });
            }
            if (summaryData.averageResolutionTime !== undefined) {
                const hours = Math.floor(summaryData.averageResolutionTime / 60);
                const mins = Math.round(summaryData.averageResolutionTime % 60);
                const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                summaryMetrics.push({ label: 'Avg Resolution', value: timeStr, color: COLORS.info });
            }

            // Offer-specific metrics
            if (summaryData.totalOffers !== undefined) {
                summaryMetrics.push({ label: 'Total Offers', value: String(summaryData.totalOffers), color: COLORS.brandPrimary });
            }
            if (summaryData.totalOfferValue !== undefined) {
                const val = summaryData.totalOfferValue;
                const fmtVal = val >= 10000000 ? `Rs. ${(val / 10000000).toFixed(2)} Cr` : val >= 100000 ? `Rs. ${(val / 100000).toFixed(2)} L` : `Rs. ${val.toLocaleString('en-IN')}`;
                summaryMetrics.push({ label: 'Total Offer Value', value: fmtVal, color: COLORS.warning });
            }
            if (summaryData.totalPoValue !== undefined) {
                const val = summaryData.totalPoValue;
                const fmtVal = val >= 10000000 ? `Rs. ${(val / 10000000).toFixed(2)} Cr` : val >= 100000 ? `Rs. ${(val / 100000).toFixed(2)} L` : `Rs. ${val.toLocaleString('en-IN')}`;
                summaryMetrics.push({ label: 'Total PO Value', value: fmtVal, color: COLORS.success });
            }
            if (summaryData.wonOffers !== undefined) {
                summaryMetrics.push({ label: 'Won Offers', value: String(summaryData.wonOffers), color: COLORS.success });
            }
            if (summaryData.lostOffers !== undefined) {
                summaryMetrics.push({ label: 'Lost Offers', value: String(summaryData.lostOffers), color: COLORS.danger });
            }

            // Draw metrics boxes (up to 6 per row)
            const metricsPerRow = Math.min(summaryMetrics.length, 6);
            const boxWidth = (contentWidth - 10) / metricsPerRow;
            const boxHeight = 40;
            let metricX = leftMargin;

            summaryMetrics.slice(0, 6).forEach((metric, index) => {
                // Metric box background
                doc.save()
                    .roundedRect(metricX, currentY, boxWidth - 5, boxHeight, 4)
                    .fill('#F8FAFC')
                    .restore();

                // Metric label
                doc.fillColor(COLORS.textMedium)
                    .fontSize(7)
                    .font('Helvetica')
                    .text(metric.label, metricX + 3, currentY + 5, { width: boxWidth - 6, align: 'center', lineBreak: false });

                // Metric value
                doc.fillColor(metric.color)
                    .fontSize(12)
                    .font('Helvetica-Bold')
                    .text(metric.value, metricX + 3, currentY + 18, { width: boxWidth - 6, align: 'center', lineBreak: false });

                metricX += boxWidth;
            });
            currentY += boxHeight + 10;
        }

        // ==================================================
        // DATA TABLE SECTION
        // ==================================================

        // Table title bar
        doc.save()
            .rect(leftMargin, currentY, contentWidth, 22)
            .fill(COLORS.brandSecondary)
            .restore();

        doc.fillColor(COLORS.headerText)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`Data Records (${data.length} items)`, leftMargin + 10, currentY + 6, { lineBreak: false });
        currentY += 28;

        // Calculate column widths proportionally
        const totalRequestedWidth = validColumns.reduce((sum, col) => sum + (col.width || 100), 0);
        const scaleFactor = contentWidth / totalRequestedWidth;
        const colWidths = validColumns.map(col => (col.width || 100) * scaleFactor);

        // Function to draw table header
        const drawTableHeader = (y: number): number => {
            doc.save()
                .rect(leftMargin, y, contentWidth, 22)
                .fill(COLORS.tableHeader)
                .restore();

            let xPos = leftMargin;
            validColumns.forEach((column, index) => {
                doc.fillColor(COLORS.tableHeaderText)
                    .fontSize(8)
                    .font('Helvetica-Bold')
                    .text(column.header, xPos + 4, y + 7, {
                        width: colWidths[index] - 8,
                        align: 'center',
                        lineBreak: false
                    });
                xPos += colWidths[index];
            });

            return y + 22;
        };

        currentY = drawTableHeader(currentY);

        // Table rows
        const rowHeight = 18;
        const maxY = pageHeight - 50;

        if (data.length === 0) {
            // No data message
            doc.save()
                .rect(leftMargin, currentY, contentWidth, 30)
                .fill(COLORS.rowEven)
                .stroke(COLORS.borderLight)
                .restore();

            doc.fillColor(COLORS.textMedium)
                .fontSize(10)
                .font('Helvetica-Oblique')
                .text('No data available for the selected criteria', leftMargin, currentY + 10, {
                    width: contentWidth,
                    align: 'center',
                    lineBreak: false
                });
            currentY += 30;
        } else {
            data.forEach((item, rowIndex) => {
                // Check if we need a new page
                if (currentY + rowHeight > maxY) {
                    // Add footer to current page
                    addPageFooter(doc, pageWidth, pageHeight);

                    // New page
                    doc.addPage();
                    currentY = 50;

                    // Repeat header on new page
                    currentY = drawTableHeader(currentY);
                }

                const bgColor = rowIndex % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;

                // Row background
                doc.save()
                    .rect(leftMargin, currentY, contentWidth, rowHeight)
                    .fill(bgColor)
                    .restore();

                // Row border
                doc.save()
                    .rect(leftMargin, currentY, contentWidth, rowHeight)
                    .stroke(COLORS.borderLight)
                    .restore();

                // Cell data
                let xPos = leftMargin;
                validColumns.forEach((column, index) => {
                    const rawValue = getNestedValue(item, column.key);
                    const formattedValue = formatPdfValue(rawValue, column, item);

                    // Column separator
                    if (index > 0) {
                        doc.save()
                            .moveTo(xPos, currentY)
                            .lineTo(xPos, currentY + rowHeight)
                            .stroke(COLORS.borderLight)
                            .restore();
                    }

                    // Determine text color based on content
                    let textColor = COLORS.textDark;
                    if (column.key === 'status' || column.key === 'stage') {
                        const lowerValue = formattedValue.toLowerCase();
                        if (lowerValue.includes('won') || lowerValue.includes('resolved') || lowerValue.includes('closed') || lowerValue.includes('success')) {
                            textColor = COLORS.success;
                        } else if (lowerValue.includes('lost') || lowerValue.includes('cancelled') || lowerValue.includes('failed')) {
                            textColor = COLORS.danger;
                        } else if (lowerValue.includes('progress') || lowerValue.includes('negotiation') || lowerValue.includes('pending')) {
                            textColor = COLORS.warning;
                        }
                    }

                    // Cell text
                    doc.fillColor(textColor)
                        .fontSize(6)
                        .font('Helvetica')
                        .text(formattedValue, xPos + 2, currentY + 6, {
                            width: colWidths[index] - 4,
                            align: column.align || (column.dataType === 'currency' || column.dataType === 'number' ? 'right' : 'left'),
                            lineBreak: false
                        });

                    xPos += colWidths[index];
                });

                currentY += rowHeight;
            });
        }

        // ==================================================
        // FOOTER ON ALL PAGES
        // ==================================================
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            addPageFooter(doc, pageWidth, pageHeight, i + 1, pageCount);
        }

        doc.end();
    } catch (error) {

        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF report' });
        }
    }
};

// Helper function to add footer to a page
function addPageFooter(doc: PDFKit.PDFDocument, pageWidth: number, pageHeight: number, currentPage?: number, totalPages?: number) {
    const footerY = pageHeight - 35;

    // Footer line
    doc.save()
        .moveTo(40, footerY)
        .lineTo(pageWidth - 40, footerY)
        .stroke(COLORS.borderDark)
        .restore();

    // Left side - company info
    doc.fillColor(COLORS.textLight)
        .fontSize(7)
        .font('Helvetica')
        .text(`© ${new Date().getFullYear()} Kardex Remstar India Pvt. Ltd. | Confidential`, 40, footerY + 8, { lineBreak: false });

    // Right side - page number
    if (currentPage !== undefined && totalPages !== undefined) {
        doc.fillColor(COLORS.textLight)
            .fontSize(7)
            .font('Helvetica')
            .text(`Page ${currentPage} of ${totalPages}`, pageWidth - 100, footerY + 8, { width: 60, align: 'right', lineBreak: false });
    }
}

// Column definitions for all report types
export const getPdfColumns = (reportType: string): ColumnDefinition[] => {
    const columns: Record<string, ColumnDefinition[]> = {
        'offer-summary': [
            { key: 'offerReferenceNumber', header: 'Ref #', width: 68, align: 'left' },
            { key: 'zone.name', header: 'Zone', width: 42, align: 'center' },
            { key: 'customer.companyName', header: 'Customer', width: 110, align: 'left', format: (value: any, item: any) => item?.customer?.companyName || item?.company || '-' },
            { key: 'location', header: 'Location', width: 55, align: 'left' },
            { key: 'contactPersonName', header: 'Contact', width: 60, align: 'left' },
            {
                key: 'productType', header: 'Product', width: 65, align: 'center', format: (value: any) => {
                    const labels: Record<string, string> = {
                        'RELOCATION': 'Relocation', 'CONTRACT': 'Contract', 'SPARE_PARTS': 'Spare Parts',
                        'KARDEX_CONNECT': 'Kardex Connect', 'UPGRADE_KIT': 'Upgrade Kit', 'SOFTWARE': 'Software',
                        'OTHERS': 'Others', 'BD_SPARE': 'BD Spare', 'RETROFIT_KIT': 'Retrofit Kit', 'SSP': 'SSP'
                    };
                    return labels[value] || (value ? String(value).replace(/_/g, ' ') : '-');
                }
            },
            {
                key: 'stage', header: 'Stage', width: 65, align: 'center', format: (value: any) => {
                    const labels: Record<string, string> = {
                        'INITIAL': 'Initial', 'PROPOSAL_SENT': 'Prop Sent', 'NEGOTIATION': 'Negotiation',
                        'PO_RECEIVED': 'PO Recd', 'WON': 'Won', 'LOST': 'Lost'
                    };
                    return labels[value] || (value ? String(value).replace(/_/g, ' ') : '-');
                }
            },
            {
                key: 'status', header: 'Status', width: 38, align: 'center', format: (value: any) => {
                    const labels: Record<string, string> = { 'OPEN': 'Open', 'CLOSED': 'Closed', 'WON': 'Won', 'LOST': 'Lost' };
                    return labels[value] || (value ? String(value).replace(/_/g, ' ') : '-');
                }
            },
            { key: 'offerValue', header: 'Offer Val', width: 68, dataType: 'currency', align: 'right' },
            { key: 'probabilityPercentage', header: 'Prob %', width: 45, dataType: 'percentage', align: 'center' },
            { key: 'poNumber', header: 'PO #', width: 60, align: 'left' },
            { key: 'poValue', header: 'PO Val', width: 62, dataType: 'currency', align: 'right' },
            { key: 'offerMonth', header: 'Offer Month', width: 55, align: 'center' },
        ], 'ticket-summary': [
            { key: 'ticketNumber', header: 'Ticket', width: 40, align: 'center' },
            { key: 'customer.companyName', header: 'Company', width: 75, align: 'left' },
            { key: 'asset.serialNo', header: 'Serial No', width: 55, align: 'left' },
            { key: 'createdAt', header: 'Date', width: 45, dataType: 'date', align: 'center' },
            { key: 'callType', header: 'Call Type', width: 55, align: 'center' },
            { key: 'priority', header: 'Priority', width: 45, align: 'center' },
            { key: 'description', header: 'Issue', width: 90, align: 'left' },
            { key: 'assignedTo.name', header: 'Assigned', width: 60, align: 'left' },
            { key: 'zone.name', header: 'Zone', width: 45, align: 'center' },
            { key: 'visitCompletedDate', header: 'Closed', width: 45, dataType: 'date', align: 'center' },
            { key: 'travelTime', header: 'Travel', width: 40, dataType: 'duration', align: 'center' },
            { key: 'onsiteWorkingTime', header: 'Onsite', width: 40, dataType: 'duration', align: 'center' },
            { key: 'totalResolutionTime', header: 'Res Time', width: 50, dataType: 'duration', align: 'center' },
            { key: 'status', header: 'Status', width: 55, align: 'center' },
        ],
        'target-report': [
            { key: 'zone.name', header: 'Zone', width: 100, align: 'left' },
            { key: 'userName', header: 'User', width: 110, align: 'left' },
            { key: 'targetPeriod', header: 'Period', width: 80, align: 'center' },
            { key: 'targetValue', header: 'Target', width: 90, dataType: 'currency', align: 'right' },
            { key: 'actualValue', header: 'Actual', width: 90, dataType: 'currency', align: 'right' },
            { key: 'achievement', header: 'Achievement', width: 80, dataType: 'percentage', align: 'center' },
        ],
        'zone-performance': [
            { key: 'name', header: 'Zone', width: 100, align: 'left' },
            { key: 'totalTickets', header: 'Total', width: 70, dataType: 'number', align: 'center' },
            { key: 'resolvedTickets', header: 'Resolved', width: 70, dataType: 'number', align: 'center' },
            { key: 'pendingTickets', header: 'Pending', width: 70, dataType: 'number', align: 'center' },
            { key: 'resolutionRate', header: 'Resolution %', width: 80, dataType: 'percentage', align: 'center' },
            { key: 'avgResolutionTime', header: 'Avg Time', width: 80, dataType: 'number', align: 'center' },
        ],
        'agent-productivity': [
            { key: 'name', header: 'Agent', width: 120, align: 'left' },
            { key: 'totalTickets', header: 'Total', width: 60, dataType: 'number', align: 'center' },
            { key: 'resolvedTickets', header: 'Resolved', width: 60, dataType: 'number', align: 'center' },
            { key: 'avgResolutionTime', header: 'Avg Time', width: 80, dataType: 'number', align: 'center' },
            { key: 'performanceScore', header: 'Score', width: 70, dataType: 'percentage', align: 'center' },
        ],
        'customer-performance': [
            { key: 'companyName', header: 'Customer', width: 150, align: 'left' },
            { key: 'totalTickets', header: 'Tickets', width: 70, dataType: 'number', align: 'center' },
            { key: 'totalOfferValue', header: 'Offer Value', width: 100, dataType: 'currency', align: 'right' },
            { key: 'totalPOValue', header: 'PO Value', width: 100, dataType: 'currency', align: 'right' },
            { key: 'zone.name', header: 'Zone', width: 80, align: 'center' },
        ],
        'product-type-analysis': [
            { key: 'productType', header: 'Product Type', width: 120, align: 'left' },
            { key: 'offerCount', header: 'Offers', width: 60, dataType: 'number', align: 'center' },
            { key: 'totalOfferValue', header: 'Offer Value', width: 100, dataType: 'currency', align: 'right' },
            { key: 'poCount', header: 'POs', width: 60, dataType: 'number', align: 'center' },
            { key: 'totalPOValue', header: 'PO Value', width: 100, dataType: 'currency', align: 'right' },
            { key: 'conversionRate', header: 'Conv %', width: 70, dataType: 'percentage', align: 'center' },
        ],
        'default': [
            { key: 'id', header: 'ID', width: 60, align: 'center' },
            { key: 'name', header: 'Name', width: 150, align: 'left' },
            { key: 'status', header: 'Status', width: 80, align: 'center' },
            { key: 'value', header: 'Value', width: 100, dataType: 'currency', align: 'right' },
            { key: 'createdAt', header: 'Created', width: 80, dataType: 'date', align: 'center' },
        ]
    };

    return columns[reportType] || columns['default'];
};
