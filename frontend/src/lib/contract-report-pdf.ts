/**
 * Contract Reports PDF Generation Utility — Kardex Brand Design
 * Generates premium contracts analytics PDF using jsPDF + autoTable
 * Matches the design language and template of growth-report-pdf.ts
 */
import { 
    kardexBlue, 
    kardexGreen, 
    kardexGrey, 
    kardexSilver, 
    kardexRed, 
    kardexSand
} from './kardex-colors'

// ============ Color Helpers ============
const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return [r, g, b]
}

// ============ Kardex Brand Color Palette ============
const COLORS = {
    headerBg: hexToRgb(kardexBlue[3]),
    headerLight: hexToRgb(kardexBlue[2]),
    accentCyan: hexToRgb(kardexBlue[1]),
    kardexGreen: hexToRgb(kardexGreen[3]),
    kardexSilver: hexToRgb(kardexSilver[2]),
    // Status
    positive: hexToRgb(kardexGreen[2]),
    warning: hexToRgb(kardexSand[2]),
    negative: hexToRgb(kardexRed[1]),
    // Surfaces
    cardBg: [255, 255, 255] as [number, number, number],
    cardBorder: hexToRgb(kardexSilver[1]),
    offWhite: [248, 250, 252] as [number, number, number],
    lightGray: [241, 245, 249] as [number, number, number],
    // Text
    white: [255, 255, 255] as [number, number, number],
    textDark: hexToRgb(kardexBlue[3]),
    textBody: hexToRgb(kardexGrey[3]),
    textMuted: hexToRgb(kardexGrey[3]),
}

// ============ Formatting Helpers ============
const fmtVal = (v: number): string => {
    if (v === 0) return '0'
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : ''
    if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)} Cr`
    if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)} L`
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} K`
    return `${sign}${abs.toFixed(0)}`
}

const fmtCurrency = (v: number): string => {
    if (v === 0) return 'Rs. 0'
    return `Rs. ${fmtVal(v)}`
}

// ============ PDF Drawing Helpers ============
async function loadLogoBase64(): Promise<string | null> {
    try {
        const response = await fetch('/kardex.png')
        const blob = await response.blob()
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
        })
    } catch {
        return null
    }
}

function drawGradientHeader(doc: any, pageW: number) {
    doc.setFillColor(...COLORS.headerBg)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setFillColor(...COLORS.headerLight)
    doc.rect(0, 24, pageW, 4, 'F')
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(0, 28, pageW, 1.5, 'F')
    doc.setFillColor(...COLORS.cardBorder)
    doc.rect(0, 29.5, pageW, 0.5, 'F')
}

function drawHeader(doc: any, filters: any, logoBase64: string | null): number {
    const pageW = doc.internal.pageSize.getWidth()
    drawGradientHeader(doc, pageW)

    // Logo
    const logoRectW = 48, logoRectH = 16, logoX = 10, logoY = 5
    doc.setFillColor(...COLORS.white)
    doc.roundedRect(logoX, logoY, logoRectW, logoRectH, 1.5, 1.5, 'F')
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', logoX + 5, logoY + 3, logoRectW - 10, logoRectH - 6)
        } catch {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...COLORS.textDark)
            doc.text('KARDEX', logoX + logoRectW / 2, logoY + logoRectH / 2 + 1, { align: 'center' })
        }
    } else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...COLORS.textDark)
        doc.text('KARDEX', logoX + logoRectW / 2, logoY + logoRectH / 2 + 1, { align: 'center' })
    }

    // Title
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...COLORS.white)
    doc.text('Customer Contract Portfolio', 62, 13)

    // Subtitle
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.accentCyan)
    const subtitle = `Zone: ${filters.zone || 'All'}  |  Status: ${filters.status || 'All'}  |  Responsible: ${filters.responsible || 'All'}`
    doc.text(subtitle, 62, 21)

    // Date badge
    const badgeW = 55, badgeX = pageW - 65, badgeH = 16, badgeY = 5
    doc.setFillColor(...COLORS.headerLight)
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.white)
    const genDate = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    doc.text(genDate, badgeX + badgeW / 2, badgeY + 7, { align: 'center' })
    doc.setFontSize(6)
    doc.text(`Run at: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, badgeX + badgeW / 2, badgeY + 13, { align: 'center' })

    return 34
}

function drawFooter(doc: any, pageNum: number) {
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...COLORS.headerBg)
    doc.rect(0, pageH - 10, pageW, 10, 'F')
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(0, pageH - 10, pageW, 0.4, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...COLORS.accentCyan)
    doc.text('Kardex Remstar  |  Customer Contract Portfolio Report  |  Confidential', 15, pageH - 4)
    doc.setTextColor(...COLORS.white)
    doc.text(`Page ${pageNum}`, pageW - 25, pageH - 4)
}

function drawSectionTitle(doc: any, y: number, title: string, color?: [number, number, number]): number {
    const pageW = doc.internal.pageSize.getWidth()
    const c = color || COLORS.headerBg
    doc.setFillColor(...c)
    doc.roundedRect(15, y, pageW - 30, 10, 2, 2, 'F')
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(15, y, 3, 10, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...COLORS.white)
    doc.text(title, 23, y + 7)
    return y + 14
}

function drawKPICard(doc: any, x: number, y: number, w: number, h: number, label: string, value: string, accentColor: [number, number, number], subLabel?: string) {
    doc.setFillColor(...COLORS.cardBg)
    doc.roundedRect(x, y, w, h, 3, 3, 'F')
    doc.setDrawColor(...COLORS.cardBorder); doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, 3, 3, 'S')
    doc.setFillColor(...accentColor)
    doc.rect(x, y, w, 3, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...COLORS.textMuted)
    doc.text(label.toUpperCase(), x + 5, y + 11)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...COLORS.textDark)
    doc.text(value, x + 5, y + 23)
    if (subLabel) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...accentColor)
        doc.text(subLabel, x + 5, y + 30)
    }
}

// ============ Date/Formatting Helpers for PDF ============
const fmtDatePdf = (iso: string): string => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getDaysRemainingPdf = (endDate: string): number => {
    if (!endDate) return 0
    return Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

// ============ Main PDF Generator ============
export async function generateContractReportPdf(
    data: any[],
    summary: any,
    filters: any
): Promise<void> {
    const { default: jsPDF } = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = autoTableModule.default || autoTableModule

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any
    const logoBase64 = await loadLogoBase64()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const pageNum = { val: 1 }

    let y = drawHeader(doc, filters, logoBase64)

    // ══════════════════════════════════════════════════════════
    // PAGE 1: PORTFOLIO SUMMARY + CUSTOMER TABLE
    // ══════════════════════════════════════════════════════════

    // ── overall summary kpi cards ──
    y = drawSectionTitle(doc, y, 'PORTFOLIO SUMMARY')
    const cardW = (pageW - 50) / 5
    const kpis = [
        { label: 'Total Customers', value: String(summary.totalCustomers || 0), sub: 'With contracts', color: COLORS.headerBg },
        { label: 'Agreements', value: String(summary.totalContracts || 0), sub: `${summary.active || 0} active | ${summary.expired || 0} expired`, color: COLORS.accentCyan },
        { label: 'Portfolio Value', value: fmtCurrency(summary.totalValue || 0), sub: 'Total value', color: COLORS.warning },
        { label: 'Machines', value: String(summary.totalMachines || 0), sub: 'Under SLA', color: COLORS.kardexGreen },
        { label: 'PM Done %', value: `${summary.pmPct || 0}%`, sub: `${summary.pmOverdue || 0} overdue`, color: COLORS.positive }
    ]

    kpis.forEach((kpi, i) => {
        drawKPICard(doc, 20 + i * (cardW + 2.5), y, cardW, 34, kpi.label, kpi.value, kpi.color, kpi.sub)
    })
    y += 40

    // ── contract detail records (ALL fields) ──
    y = drawSectionTitle(doc, y, 'CONTRACT DETAIL RECORDS — ALL FIELDS')

    // Flatten all contracts from all customers
    const allContracts: any[] = []
    data.forEach(cust => {
        (cust.contracts || []).forEach((c: any) => {
            allContracts.push({
                ...c,
                customerName: cust.customerName || '—',
                place: cust.place || '—',
                zoneName: cust.zoneName || '—',
            })
        })
    })

    if (allContracts.length > 0) {
        const detailHeaders = [
            'S.No', 'Contract #', 'Customer', 'Place', 'PO No',
            'MC Type', 'Machines', 'Amount', 'Start', 'End',
            'Status', 'Days Left', 'SW', 'Responsible', 'Zone',
            'BD', 'Visits', 'Payment Terms', 'Sch. Month'
        ]

        const detailBody = allContracts.map((c, idx) => {
            const daysLeft = getDaysRemainingPdf(c.endDate)
            return [
                String(idx + 1),
                c.contractNumber || '—',
                c.customerName,
                c.place,
                c.poNo || '—',
                c.mcType || '—',
                String(c.noOfMachine || 0),
                fmtCurrency(Number(c.amount) || 0),
                fmtDatePdf(c.startDate),
                fmtDatePdf(c.endDate),
                c.status || '—',
                daysLeft < 0 ? `${Math.abs(daysLeft)}d OD` : `${daysLeft}d`,
                c.softwareSupport ? 'Yes' : 'No',
                c.responsible || '—',
                c.zoneName,
                String(c.bdCount ?? 0),
                String(c.noOfVisits || 0),
                c.paymentTerms || '—',
                c.scheduledMonth || '—',
            ]
        })

        autoTable(doc, {
            startY: y,
            head: [detailHeaders],
            body: detailBody,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.headerBg,
                textColor: COLORS.white,
                fontSize: 5.5,
                fontStyle: 'bold',
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 5.5,
                textColor: COLORS.textBody,
                halign: 'center',
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },        // S.No
                1: { cellWidth: 18, halign: 'left' },         // Contract #
                2: { cellWidth: 28, halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark },  // Customer
                3: { cellWidth: 16, halign: 'left' },         // Place
                4: { cellWidth: 18, halign: 'left' },         // PO No
                5: { cellWidth: 14 },                         // MC Type
                6: { cellWidth: 10, halign: 'right' },        // Machines
                7: { cellWidth: 16, halign: 'right', fontStyle: 'bold' }, // Amount
                8: { cellWidth: 16 },                         // Start
                9: { cellWidth: 16 },                         // End
                10: { cellWidth: 14 },                        // Status
                11: { cellWidth: 12, halign: 'right' },       // Days Left
                12: { cellWidth: 8 },                         // SW
                13: { cellWidth: 16, halign: 'left' },        // Responsible
                14: { cellWidth: 10 },                        // Zone
                15: { cellWidth: 7 },                         // BD
                16: { cellWidth: 8 },                         // Visits
                17: { cellWidth: 16, halign: 'left' },        // Payment Terms
                18: { cellWidth: 12 },                        // Sch. Month
            },
            willDrawCell: (hookData: any) => {
                // Status color coding
                if (hookData.section === 'body' && hookData.column.index === 10) {
                    const val = hookData.cell.raw
                    if (val === 'Expired') {
                        hookData.cell.styles.textColor = hexToRgb(kardexRed[1])
                        hookData.cell.styles.fontStyle = 'bold'
                    } else if (val === 'Expiring Soon') {
                        hookData.cell.styles.textColor = hexToRgb(kardexSand[2])
                        hookData.cell.styles.fontStyle = 'bold'
                    } else if (val === 'Active') {
                        hookData.cell.styles.textColor = hexToRgb(kardexGreen[2])
                        hookData.cell.styles.fontStyle = 'bold'
                    }
                }
                // Days Left color coding
                if (hookData.section === 'body' && hookData.column.index === 11) {
                    const val = hookData.cell.raw
                    if (typeof val === 'string' && val.includes('OD')) {
                        hookData.cell.styles.textColor = hexToRgb(kardexRed[1])
                        hookData.cell.styles.fontStyle = 'bold'
                    }
                }
            },
            didDrawPage: () => {
                drawFooter(doc, pageNum.val)
                pageNum.val++
            },
            margin: { left: 10, right: 10, bottom: 15 },
        })
    }

    // ══════════════════════════════════════════════════════════
    // PAGE 3+: PM SCHEDULE DETAILS (per customer)
    // ══════════════════════════════════════════════════════════

    // Collect customers that have PM schedule data
    const customersWithPMs = data.filter(cust =>
        cust.contracts && cust.contracts.some((c: any) =>
            c.pmSchedules && c.pmSchedules.some((pm: any) => pm.status !== 'Not Applicable')
        )
    )

    if (customersWithPMs.length > 0) {
        doc.addPage()
        pageNum.val++
        y = drawHeader(doc, filters, logoBase64)
        y = drawSectionTitle(doc, y, 'PM SCHEDULE DETAILS BY CUSTOMER')

        customersWithPMs.forEach((cust, custIdx) => {
            // Check if we need a new page
            if (y > pageH - 50) {
                drawFooter(doc, pageNum.val)
                doc.addPage()
                pageNum.val++
                y = drawHeader(doc, filters, logoBase64)
                y = drawSectionTitle(doc, y, 'PM SCHEDULE DETAILS BY CUSTOMER (continued)')
            }

            // Customer sub-header
            doc.setFillColor(...COLORS.headerLight)
            doc.roundedRect(15, y, pageW - 30, 8, 1.5, 1.5, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.setTextColor(...COLORS.white)
            doc.text(`${custIdx + 1}. ${cust.customerName} — ${cust.place} (${cust.zoneName || '—'})`, 20, y + 5.5)
            y += 11

            // Build PM table for this customer
            const pmRows: any[] = []
            ;(cust.contracts || []).forEach((contract: any) => {
                const applicablePMs = (contract.pmSchedules || []).filter((pm: any) => pm.status !== 'Not Applicable')
                if (applicablePMs.length === 0) return

                applicablePMs.forEach((pm: any) => {
                    pmRows.push([
                        contract.contractNumber || '—',
                        contract.mcType || '—',
                        `PM ${pm.pmNumber}`,
                        pm.range || '—',
                        pm.status || '—',
                        pm.completedAt ? fmtDatePdf(pm.completedAt) : '—',
                        contract.responsible || '—',
                    ])
                })
            })

            if (pmRows.length > 0) {
                autoTable(doc, {
                    startY: y,
                    head: [['Contract #', 'MC Type', 'PM Visit', 'Date Range', 'Status', 'Completed', 'Responsible']],
                    body: pmRows,
                    theme: 'grid',
                    headStyles: {
                        fillColor: COLORS.kardexGreen,
                        textColor: COLORS.white,
                        fontSize: 6,
                        fontStyle: 'bold',
                        halign: 'center',
                    },
                    bodyStyles: {
                        fontSize: 6,
                        textColor: COLORS.textBody,
                        halign: 'center',
                    },
                    columnStyles: {
                        0: { cellWidth: 25, halign: 'left' },
                        1: { cellWidth: 22 },
                        2: { cellWidth: 15 },
                        3: { cellWidth: 45, halign: 'left', fontSize: 5.5 },
                        4: { cellWidth: 18 },
                        5: { cellWidth: 22 },
                        6: { cellWidth: 25, halign: 'left' },
                    },
                    willDrawCell: (hookData: any) => {
                        if (hookData.section === 'body' && hookData.column.index === 4) {
                            const val = hookData.cell.raw
                            if (val === 'Completed') {
                                hookData.cell.styles.textColor = hexToRgb(kardexGreen[2])
                                hookData.cell.styles.fontStyle = 'bold'
                            } else if (val === 'Pending') {
                                hookData.cell.styles.textColor = hexToRgb(kardexSand[2])
                                hookData.cell.styles.fontStyle = 'bold'
                            }
                        }
                    },
                    didDrawPage: () => {
                        drawFooter(doc, pageNum.val)
                        pageNum.val++
                    },
                    margin: { left: 20, right: 20, bottom: 15 },
                })

                y = (doc as any).lastAutoTable?.finalY + 6 || y + 30
            }
        })

        // Draw footer on the last PM page
        drawFooter(doc, pageNum.val)
    }

    // Save PDF
    doc.save(`KardexCare-Customer-Portfolio-Report-${Date.now()}.pdf`)
}
