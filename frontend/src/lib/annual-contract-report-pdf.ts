/**
 * Annual Machine Contracts PDF Generation Utility — Kardex Brand Design
 * Generates an executive, customer-grouped PDF using jsPDF + autoTable
 * Tailored for customer agreements, machine inventory, and multi-tier expiry tracking
 */
import {
    kardexBlue,
    kardexGreen,
    kardexGrey,
    kardexSilver,
    kardexRed,
    kardexSand
} from './kardex-colors';
import { normalizeEngineerNames } from './utils';

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
    customerHeaderBg: [84, 106, 122] as [number, number, number],
    customerSubBg: [241, 245, 249] as [number, number, number],
    // Text
    white: [255, 255, 255] as [number, number, number],
    textDark: [30, 41, 59] as [number, number, number],
    textBody: [71, 85, 105] as [number, number, number],
    textMuted: [148, 163, 184] as [number, number, number],
};

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

const fmtInstallDatePdf = (val: string | null | undefined): string => {
    if (!val) return '—';
    const s = String(val).trim();
    if (/^\d{4}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return s;
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

function drawHeader(doc: any, filters: any, logoBase64: string | null, totalRecords: number): number {
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
    doc.text('ANNUAL MACHINE CONTRACTS & ASSET REPORT', 60, 12);

    // Subtitle / Filters
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.accentCyan);
    const filterParts: string[] = [];
    if (filters.zone && filters.zone !== 'all') filterParts.push(`Zone: ${filters.zone}`);
    if (filters.customerClass && filters.customerClass !== 'all') filterParts.push(`Class: ${filters.customerClass}`);
    if (filters.contractType && filters.contractType !== 'all') filterParts.push(`Type: ${filters.contractType}`);
    if (filters.unitType && filters.unitType !== 'all') filterParts.push(`Model: ${filters.unitType}`);
    if (filters.engineer && filters.engineer !== 'all') filterParts.push(`Eng: ${filters.engineer}`);
    if (filters.department && filters.department !== 'all') filterParts.push(`Dept: ${filters.department}`);
    if (filters.expiryBucket && filters.expiryBucket !== 'all') filterParts.push(`Expiry: ${filters.expiryBucket}`);
    if (filters.dateFrom || filters.dateTo) filterParts.push(`Window: ${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}`);
    if (filters.search) filterParts.push(`Search: "${filters.search}"`);
    const subtitle = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Zones & Customer Portfolios';
    doc.text(subtitle, 60, 19);

    // Date badge on top right
    const badgeW = 62, badgeX = pageW - 72, badgeH = 16, badgeY = 5;
    doc.setFillColor(...COLORS.headerLight);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...COLORS.white);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, badgeX + badgeW / 2, badgeY + 6, { align: 'center' });
    doc.setFontSize(6); doc.setTextColor(...COLORS.accentCyan);
    doc.text(`${totalRecords} Machines  |  Confidential`, badgeX + badgeW / 2, badgeY + 12, { align: 'center' });

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
    doc.text('Kardex  |  Annual Machine Contracts & Asset Lifecycle Report  |  Confidential', 12, pageH - 3);
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

// Curated Kardex brand color palette for customer header banners
const CUSTOMER_HEADER_COLORS: [number, number, number][] = [
    hexToRgb(kardexBlue[3]),    // [84, 106, 122] - Kardex Dark Blue
    hexToRgb(kardexGreen[3]),   // [79, 106, 100] - Kardex Dark Green
    hexToRgb(kardexSand[3]),    // [151, 110, 68] - Kardex Dark Sand
    hexToRgb(kardexBlue[2]),    // [111, 138, 157] - Kardex Slate Blue
    hexToRgb(kardexGreen[2]),   // [130, 160, 148] - Kardex Teal Green
    hexToRgb(kardexRed[2]),     // [158, 59, 71]  - Kardex Wine Red
];

// ============ Main Generator ============
export async function generateAnnualContractReportPdf(
    customers: any[],
    stats: any,
    filters: any
): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any;
    const logoBase64 = await loadLogoBase64();
    const pageW = doc.internal.pageSize.getWidth();
    const pageNum = { val: 1 };

    // Total machines across all customers
    const totalMachinesCount = customers.reduce((sum: number, c: any) => sum + (c.machines?.length || 0), 0);
    let y = drawHeader(doc, filters, logoBase64, totalMachinesCount);

    // ── 5 Executive KPI Cards (ASCII safe: no ₹, no ≤) ──
    const cardGap = 4;
    const totalCards = 5;
    const cardW = (pageW - 20 - (totalCards - 1) * cardGap) / totalCards;
    const cardH = 24;

    drawKPICard(
        doc,
        10 + 0 * (cardW + cardGap), y, cardW, cardH,
        'Total Machines',
        String(stats?.totalMachines ?? totalMachinesCount),
        COLORS.headerLight,
        `${customers.length} Accounts`
    );

    drawKPICard(
        doc,
        10 + 1 * (cardW + cardGap), y, cardW, cardH,
        'Total Customers',
        String(stats?.totalCustomers ?? customers.length),
        COLORS.kardexGreen,
        'Active Portfolios'
    );

    drawKPICard(
        doc,
        10 + 2 * (cardW + cardGap), y, cardW, cardH,
        'Total MC Value',
        fmtCurrency(stats?.totalMCValue),
        COLORS.kardexSand,
        'Annual Contract Value'
    );

    const expiring30 = stats?.expiring30 ?? 0;
    const expiredCount = stats?.expired ?? 0;
    drawKPICard(
        doc,
        10 + 3 * (cardW + cardGap), y, cardW, cardH,
        'Expiring <= 30d / Overdue',
        `${expiring30} / ${expiredCount}`,
        (expiring30 > 0 || expiredCount > 0) ? COLORS.kardexRed : COLORS.kardexGreen,
        `${expiring30 + expiredCount} Action Required`
    );

    drawKPICard(
        doc,
        10 + 4 * (cardW + cardGap), y, cardW, cardH,
        'Active Healthy',
        String(stats?.active ?? (totalMachinesCount - expiredCount)),
        COLORS.kardexGreen,
        '> 90 Days Remaining'
    );

    y += cardH + 6;

    // ── Prepare Customer-by-Customer Grouped Rows ──
    const head = [
        ['#', 'Serial Number', 'Unit / Model', 'Control', 'Department', 'Install Year', 'Type', 'MC Period', 'MC Expiry', 'MC Value']
    ];

    const body: any[] = [];

    customers.forEach((cust: any, custIdx: number) => {
        const machines = cust.machines || [];
        const overdueCount = machines.filter((m: any) =>
            m.mcExpiry && (
                (m.mcExpiry.daysLeft !== null && m.mcExpiry.daysLeft < 0) ||
                m.mcExpiry.bucket === 'expired'
            )
        ).length;

        // Pick distinct Kardex brand color for this customer
        const customerColor = CUSTOMER_HEADER_COLORS[custIdx % CUSTOMER_HEADER_COLORS.length];

        const classText = cust.customerClass ? `Class ${cust.customerClass}` : '—';
        const placeText = cust.place ? `${cust.place}, ${cust.zoneName} Zone` : `${cust.zoneName} Zone`;
        const engNames = Array.from(new Set(
            [cust.engineerName, ...(machines.map((m: any) => m.engineerName))]
                .flatMap((n: any) => normalizeEngineerNames(n))
        )).join(', ');
        const engText = engNames ? `Eng: ${engNames}` : 'Eng: Unassigned';
        const valueText = fmtCurrency(cust.totalMCValue || 0);
        const statusText = overdueCount > 0
            ? `[ ${overdueCount} Machine${overdueCount > 1 ? 's' : ''} Overdue ]`
            : (cust.daysToEarliestExpiry !== null ? (cust.daysToEarliestExpiry < 0 ? `[ Overdue ]` : `[ ${cust.daysToEarliestExpiry}d left ]`) : '[ Active ]');
        const visitsText = `${cust.totalPMVisits || 0} PM | ${cust.totalBDVisits || 0} BD`;

        body.push([
            {
                content: `${custIdx + 1}.  ${cust.customerName.toUpperCase()}   •   ${classText}   •   ${placeText}   •   ${engText}   •   ${visitsText}   •   Total Value: ${valueText}   •   ${statusText}`,
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

        if (machines.length === 0) {
            body.push([
                {
                    content: 'No machines registered for this customer contract.',
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
            machines.forEach((m: any, mIdx: number) => {
                const expiry = m.mcExpiry;
                let expiryText = '—';
                if (expiry) {
                    if (expiry.daysLeft !== null) {
                        expiryText = expiry.daysLeft < 0 ? `${Math.abs(expiry.daysLeft)}d overdue` : `${expiry.daysLeft}d left`;
                    } else if (expiry.status) {
                        expiryText = expiry.status;
                    }
                }

                const mcPeriodText = (m.mcStartDate || m.mcEndDate)
                    ? `${fmtDatePdf(m.mcStartDate)} to ${fmtDatePdf(m.mcEndDate)}`
                    : '—';

                const unitModel = `${m.unitType || '—'}${m.modelNumber ? ` / ${m.modelNumber}` : ''}`;

                body.push([
                    String(mIdx + 1),
                    m.serialNumber || '—',
                    unitModel,
                    m.controlType || '—',
                    m.department || '—',
                    fmtInstallDatePdf(m.installationYear),
                    m.contractType || 'UMC',
                    mcPeriodText,
                    expiryText,
                    fmtCurrency(m.mcValue)
                ]);
            });
        }

        if (custIdx < customers.length - 1) {
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
        head,
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
        headStyles: {
            fillColor: [71, 85, 105],
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
            valign: 'middle',
        },
        alternateRowStyles: {
            fillColor: COLORS.offWhite,
        },
        columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 28, fontStyle: 'bold', textColor: COLORS.textDark },
            2: { cellWidth: 36 },
            3: { cellWidth: 17, halign: 'center' },
            4: { cellWidth: 26 },
            5: { cellWidth: 24, halign: 'center' },
            6: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
            7: { cellWidth: 52, halign: 'center' },
            8: { cellWidth: 32, halign: 'center' },
            9: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: COLORS.textDark },
        },
        willDrawCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.cell.raw === '') {
                hookData.cell.styles.lineWidth = 0;
                hookData.cell.styles.fillColor = [255, 255, 255];
                return;
            }

            // Style Expiry column (index 8) for overdue/critical machines
            if (hookData.section === 'body' && hookData.column.index === 8 && typeof hookData.cell.raw === 'string') {
                const text = String(hookData.cell.raw || '');
                if (text.includes('overdue')) {
                    hookData.cell.styles.textColor = [225, 127, 112]; // Kardex Red
                    hookData.cell.styles.fontStyle = 'bold';
                } else if (text.includes('left') && parseInt(text, 10) <= 30) {
                    hookData.cell.styles.textColor = [206, 159, 107]; // Kardex Sand
                    hookData.cell.styles.fontStyle = 'bold';
                } else if (text.includes('left') || text.includes('Active')) {
                    hookData.cell.styles.textColor = [79, 106, 100]; // Kardex Green Dark
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
    doc.save(`Annual_Contract_Report_${timestamp}.pdf`);
}
