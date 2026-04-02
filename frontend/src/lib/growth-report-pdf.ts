/**
 * Growth Pillar PDF Generation Utility — Kardex Brand Design
 * Generates premium growth analytics PDF using jsPDF + autoTable
 * Matches the design language from forecast-pdf-utils.ts
 *
 * Note: jsPDF default Helvetica does NOT support Unicode.
 *       All text uses ASCII-safe characters only (Rs. instead of ₹).
 */

// ============ Kardex Brand Color Palette ============
const COLORS = {
    headerBg: [84, 106, 122] as [number, number, number],
    headerLight: [111, 138, 157] as [number, number, number],
    accentCyan: [150, 174, 194] as [number, number, number],
    kardexGreen: [79, 106, 100] as [number, number, number],
    kardexSilver: [146, 162, 165] as [number, number, number],
    // Status
    positive: [130, 160, 148] as [number, number, number],
    warning: [206, 159, 107] as [number, number, number],
    negative: [225, 127, 112] as [number, number, number],
    // Surfaces
    cardBg: [255, 255, 255] as [number, number, number],
    cardBorder: [210, 220, 226] as [number, number, number],
    offWhite: [248, 250, 252] as [number, number, number],
    lightGray: [241, 245, 249] as [number, number, number],
    darkTrack: [230, 236, 240] as [number, number, number],
    // Text
    white: [255, 255, 255] as [number, number, number],
    textDark: [84, 106, 122] as [number, number, number],
    textBody: [93, 110, 115] as [number, number, number],
    textMuted: [146, 162, 165] as [number, number, number],
    textLight: [174, 191, 195] as [number, number, number],
    // Product colors
    product: [
        [84, 106, 122],   // Blue 3
        [79, 106, 100],   // Green 3
        [206, 159, 107],  // Sand 2
        [150, 174, 194],  // Blue 1
        [111, 138, 157],  // Blue 2
        [130, 160, 148],  // Green 2
        [225, 127, 112],  // Red 1
        [146, 162, 165],  // Silver 2
        [151, 110, 68],   // Sand 3
    ] as [number, number, number][],
}

// ============ Types ============
interface MonthData {
    month: number
    monthLabel: string
    monthStr: string
    target: number
    offerValue: number
    wonValue: number
    offerCount: number
    wonCount: number
    achievementPercent: number
    hitRatePercent: number
    growthPercent: number | null
}

interface ProductData {
    productType: string
    productLabel: string
    target: number
    offerValue: number
    wonValue: number
    offerCount: number
    wonCount: number
    achievementPercent: number
    hitRatePercent: number
    monthlyData: MonthData[]
}

interface InsightItem {
    text: string
    type: string
}

interface GrowthInsights {
    performance: {
        status: string
        statusColor: string
        points: InsightItem[]
    }
    trends: InsightItem[]
    products: InsightItem[]
    conversion: InsightItem[]
    recommendations: InsightItem[]
}

export interface GrowthPillarPdfData {
    year: number
    fromMonth: number
    toMonth: number
    filters: {
        zoneId: number | null
        userId: number | null
        zones: { id: number; name: string }[]
        users: { id: number; name: string }[]
    }
    totals: {
        target: number
        offerValue: number
        wonValue: number
        offerCount: number
        wonCount: number
        achievementPercent: number
        hitRatePercent: number
    }
    monthlyData: MonthData[]
    productData: ProductData[]
    insights: GrowthInsights
}

// ============ Formatting Helpers (ASCII-safe) ============
const fmtVal = (v: number): string => {
    if (v === 0) return '0'
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : ''
    if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)} Cr`
    if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)} L`
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} K`
    return `${sign}${abs.toFixed(0)}`
}

const fmtPct = (v: number | null): string => {
    if (v === null || v === undefined || isNaN(v)) return '-'
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

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

function drawHeader(doc: any, data: GrowthPillarPdfData, logoBase64: string | null): number {
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
    doc.text('Growth Pillar Analytics', 62, 13)

    // Subtitle
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.accentCyan)
    const zoneName = data.filters.zoneId ? data.filters.zones.find(z => z.id === data.filters.zoneId)?.name : 'All Zones'
    const userName = data.filters.userId ? data.filters.users.find(u => u.id === data.filters.userId)?.name : null
    let subtitle = `${MONTH_NAMES[data.fromMonth - 1]} - ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}`
    if (userName) subtitle += `  |  ${userName}`
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
    doc.text('Kardex Remstar  |  Growth Pillar Analytics  |  Confidential', 15, pageH - 4)
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

function ensurePage(doc: any, y: number, needed: number, pageNum: { val: number }, data: GrowthPillarPdfData, logoBase64: string | null): number {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        drawFooter(doc, pageNum.val)
        pageNum.val++
        doc.addPage()
        return drawHeader(doc, data, logoBase64)
    }
    return y
}

// ============ Main PDF Generator ============
export async function generateGrowthPillarPdf(data: GrowthPillarPdfData): Promise<void> {
    const { default: jsPDF } = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = autoTableModule.default || autoTableModule

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any
    const logoBase64 = await loadLogoBase64()
    const pageW = doc.internal.pageSize.getWidth()
    const pageNum = { val: 1 }

    let y = drawHeader(doc, data, logoBase64)

    // ── PAGE 1: KPI Cards ──
    y = drawSectionTitle(doc, y, 'OVERALL PERFORMANCE SUMMARY')
    const cardW = (pageW - 50) / 5
    const kpis = [
        { label: 'Total Target', value: fmtVal(data.totals.target), sub: `${data.totals.offerCount} offers`, color: COLORS.headerBg },
        { label: 'Offer Value', value: fmtVal(data.totals.offerValue), sub: `${data.totals.offerCount} created`, color: COLORS.warning },
        { label: 'Won Value', value: fmtVal(data.totals.wonValue), sub: `${data.totals.wonCount} orders won`, color: COLORS.positive },
        { label: 'Achievement', value: `${data.totals.achievementPercent}%`, sub: 'Won / Target', color: COLORS.accentCyan },
        { label: 'Hit Rate', value: `${data.totals.hitRatePercent}%`, sub: 'Won / Offer Value', color: COLORS.kardexGreen },
    ]
    kpis.forEach((kpi, i) => {
        drawKPICard(doc, 20 + i * (cardW + 2.5), y, cardW, 34, kpi.label, kpi.value, kpi.color, kpi.sub)
    })
    y += 40

    // ── MONTHLY BREAKDOWN TABLE ──
    y = ensurePage(doc, y, 60, pageNum, data, logoBase64)
    y = drawSectionTitle(doc, y, 'MONTHLY BREAKDOWN')

    autoTable(doc, {
        startY: y,
        head: [['Month', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achievement %', 'Hit Rate %', 'MoM Growth']],
        body: [
            ...data.monthlyData.map(d => [
                d.monthLabel,
                fmtVal(d.target),
                fmtVal(d.offerValue),
                fmtVal(d.wonValue),
                String(d.offerCount),
                String(d.wonCount),
                `${d.achievementPercent}%`,
                `${d.hitRatePercent}%`,
                d.growthPercent !== null ? fmtPct(d.growthPercent) : '-',
            ]),
            // Totals row
            [
                'TOTAL',
                fmtVal(data.totals.target),
                fmtVal(data.totals.offerValue),
                fmtVal(data.totals.wonValue),
                String(data.totals.offerCount),
                String(data.totals.wonCount),
                `${data.totals.achievementPercent}%`,
                `${data.totals.hitRatePercent}%`,
                '-',
            ],
        ],
        theme: 'grid',
        headStyles: {
            fillColor: COLORS.headerBg,
            textColor: COLORS.white,
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center',
        },
        bodyStyles: {
            fontSize: 7,
            textColor: COLORS.textBody,
            halign: 'center',
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark },
        },
        willDrawCell: (hookData: any) => {
            // Color code achievement column
            if (hookData.section === 'body' && hookData.column.index === 6) {
                const val = parseFloat(hookData.cell.text[0])
                if (val >= 100) hookData.cell.styles.textColor = COLORS.positive
                else if (val >= 50) hookData.cell.styles.textColor = COLORS.warning
                else hookData.cell.styles.textColor = COLORS.negative
                hookData.cell.styles.fontStyle = 'bold'
            }
            // Color code growth column
            if (hookData.section === 'body' && hookData.column.index === 8) {
                const text = hookData.cell.text[0]
                if (text.startsWith('+')) hookData.cell.styles.textColor = COLORS.positive
                else if (text.startsWith('-')) hookData.cell.styles.textColor = COLORS.negative
            }
            // Bold totals row
            if (hookData.section === 'body' && hookData.row.index === data.monthlyData.length) {
                hookData.cell.styles.fontStyle = 'bold'
                hookData.cell.styles.textColor = COLORS.textDark
                hookData.cell.styles.fillColor = COLORS.lightGray
            }
        },
        margin: { left: 15, right: 15 },
    })

    y = (doc as any).lastAutoTable.finalY + 8

    // ── PRODUCT-WISE TABLE ──
    if (data.productData.length > 0) {
        y = ensurePage(doc, y, 60, pageNum, data, logoBase64)
        y = drawSectionTitle(doc, y, 'PRODUCT-WISE PERFORMANCE', COLORS.kardexGreen)

        autoTable(doc, {
            startY: y,
            head: [['Product', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achievement %', 'Hit Rate %']],
            body: data.productData.map(p => [
                p.productLabel,
                fmtVal(p.target),
                fmtVal(p.offerValue),
                fmtVal(p.wonValue),
                String(p.offerCount),
                String(p.wonCount),
                `${p.achievementPercent}%`,
                `${p.hitRatePercent}%`,
            ]),
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.kardexGreen,
                textColor: COLORS.white,
                fontSize: 7,
                fontStyle: 'bold',
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 7,
                textColor: COLORS.textBody,
                halign: 'center',
            },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark },
            },
            willDrawCell: (hookData: any) => {
                if (hookData.section === 'body' && hookData.column.index === 6) {
                    const val = parseFloat(hookData.cell.text[0])
                    if (val >= 100) hookData.cell.styles.textColor = COLORS.positive
                    else if (val >= 50) hookData.cell.styles.textColor = COLORS.warning
                    else hookData.cell.styles.textColor = COLORS.negative
                    hookData.cell.styles.fontStyle = 'bold'
                }
            },
            margin: { left: 15, right: 15 },
        })

        y = (doc as any).lastAutoTable.finalY + 8
    }

    // ── PRODUCT MONTHLY DETAIL (each product) ──
    for (let pi = 0; pi < data.productData.length; pi++) {
        const product = data.productData[pi]
        if (product.monthlyData.every(m => m.offerCount === 0 && m.wonCount === 0)) continue

        y = ensurePage(doc, y, 50, pageNum, data, logoBase64)
        const pColor = COLORS.product[pi % COLORS.product.length]

        // Product sub-header
        doc.setFillColor(...pColor)
        doc.roundedRect(15, y, pageW - 30, 8, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COLORS.white)
        doc.text(`${product.productLabel}  |  Target: ${fmtVal(product.target)}  |  Won: ${fmtVal(product.wonValue)}  |  Achievement: ${product.achievementPercent}%`, 20, y + 5.5)
        y += 11

        autoTable(doc, {
            startY: y,
            head: [['Month', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achievement %', 'Growth']],
            body: product.monthlyData.map(m => [
                m.monthLabel.substring(0, 3),
                fmtVal(m.target),
                fmtVal(m.offerValue),
                fmtVal(m.wonValue),
                String(m.offerCount),
                String(m.wonCount),
                `${m.achievementPercent}%`,
                m.growthPercent !== null ? fmtPct(m.growthPercent) : '-',
            ]),
            theme: 'grid',
            headStyles: {
                fillColor: pColor,
                textColor: COLORS.white,
                fontSize: 6.5,
                fontStyle: 'bold',
                halign: 'center',
            },
            bodyStyles: { fontSize: 6.5, textColor: COLORS.textBody, halign: 'center' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
            willDrawCell: (hookData: any) => {
                if (hookData.section === 'body' && hookData.column.index === 6) {
                    const val = parseFloat(hookData.cell.text[0])
                    if (val >= 100) hookData.cell.styles.textColor = COLORS.positive
                    else if (val >= 50) hookData.cell.styles.textColor = COLORS.warning
                    else hookData.cell.styles.textColor = COLORS.negative
                    hookData.cell.styles.fontStyle = 'bold'
                }
                if (hookData.section === 'body' && hookData.column.index === 7) {
                    const text = hookData.cell.text[0]
                    if (text.startsWith('+')) hookData.cell.styles.textColor = COLORS.positive
                    else if (text.startsWith('-')) hookData.cell.styles.textColor = COLORS.negative
                }
            },
            margin: { left: 20, right: 20 },
        })

        y = (doc as any).lastAutoTable.finalY + 6
    }

    // ── INSIGHTS PAGE ──
    drawFooter(doc, pageNum.val)
    pageNum.val++
    doc.addPage()
    y = drawHeader(doc, data, logoBase64)

    y = drawSectionTitle(doc, y, 'GROWTH INSIGHTS & ANALYSIS')

    const insightSections: { title: string; items: InsightItem[]; color: [number, number, number] }[] = [
        { title: `PERFORMANCE SUMMARY  [${data.insights.performance.status.replace(/_/g, ' ')}]`, items: data.insights.performance.points, color: COLORS.headerBg },
        { title: 'MONTHLY TRENDS', items: data.insights.trends, color: COLORS.accentCyan },
        { title: 'PRODUCT ANALYSIS', items: data.insights.products, color: COLORS.kardexGreen },
        { title: 'PIPELINE & CONVERSION', items: data.insights.conversion, color: COLORS.warning },
        { title: 'RECOMMENDATIONS & ACTION ITEMS', items: data.insights.recommendations, color: [130, 100, 180] },
    ]

    for (const section of insightSections) {
        if (section.items.length === 0) continue

        y = ensurePage(doc, y, 30, pageNum, data, logoBase64)

        // Section sub-header
        doc.setFillColor(...section.color)
        doc.roundedRect(15, y, pageW - 30, 8, 1.5, 1.5, 'F')
        doc.setFillColor(...COLORS.accentCyan)
        doc.rect(15, y, 2.5, 8, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COLORS.white)
        doc.text(section.title, 22, y + 5.5)
        y += 11

        for (const item of section.items) {
            y = ensurePage(doc, y, 10, pageNum, data, logoBase64)

            // Item row background
            const itemColor = item.type === 'success' ? COLORS.positive
                : item.type === 'warning' ? COLORS.warning
                    : item.type === 'error' ? COLORS.negative
                        : item.type === 'action' ? [130, 100, 180] as [number, number, number]
                            : COLORS.accentCyan

            doc.setFillColor(...COLORS.offWhite)
            doc.roundedRect(20, y, pageW - 40, 8, 1, 1, 'F')

            // Left color indicator
            doc.setFillColor(...itemColor)
            doc.roundedRect(20, y, 2, 8, 0.5, 0.5, 'F')

            // Type badge
            const badge = item.type === 'success' ? 'OK' : item.type === 'warning' ? '!!' : item.type === 'error' ? 'XX' : item.type === 'action' ? '>>' : 'ii'
            doc.setFillColor(...itemColor)
            doc.roundedRect(24, y + 1.5, 8, 5, 1, 1, 'F')
            doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...COLORS.white)
            doc.text(badge, 28, y + 5, { align: 'center' })

            // Clean the text aggressively: default jsPDF Helvetica only supports ASCII.
            // Remove any Unicode characters (long dashes, smart quotes, emojis, etc.)
            const cleanText = item.text
                .replace(/[\u2013\u2014]/g, '-') // replace long dashes
                .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // replace smart single quotes
                .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // replace smart double quotes
                .replace(/[^\x20-\x7E]/g, '') // remove all other non-ASCII
                .trim()

            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.textDark)

            // Word wrap if text is very long
            const maxTextW = pageW - 80
            const lines = doc.splitTextToSize(cleanText, maxTextW)
            const lineHeight = 4
            const rowHeight = 8 + (lines.length > 1 ? (lines.length - 1) * lineHeight : 0)

            // Item row background (re-calculate for multi-line)
            doc.setFillColor(...COLORS.offWhite)
            doc.roundedRect(20, y, pageW - 40, rowHeight, 1, 1, 'F')

            // Left color indicator
            doc.setFillColor(...itemColor)
            doc.roundedRect(20, y, 2, rowHeight, 0.5, 0.5, 'F')

            // Render lines
            doc.setTextColor(...COLORS.textDark)
            doc.text(lines, 35, y + 5)

            y += rowHeight + 2
        }

        y += 3
    }

    // Final footer
    drawFooter(doc, pageNum.val)

    // Save
    const zoneName = data.filters.zoneId ? data.filters.zones.find(z => z.id === data.filters.zoneId)?.name?.replace(/\s+/g, '_') : 'All_Zones'
    const fileName = `Growth_Pillar_${data.year}_${MONTH_NAMES[data.fromMonth - 1].substring(0, 3)}-${MONTH_NAMES[data.toMonth - 1].substring(0, 3)}_${zoneName}.pdf`
    doc.save(fileName)
}
