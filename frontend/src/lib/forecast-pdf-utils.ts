/**
 * Forecast PDF Generation Utility — Kardex Brand Design
 * Generates premium analytics PDF reports using jsPDF + autoTable
 * Supports: Zone-wise, Zone Users-wise reports
 *
 * Design: Clean professional using official Kardex company color palette
 * Blues, Greens, Greys, Silvers, Reds, Sands — no non-brand colors
 * Note: jsPDF default Helvetica does NOT support Unicode (₹, emojis).
 *       All text uses ASCII-safe characters only.
 */

// ============ Color Scheme — Official Kardex Brand Palette ============
const COLORS = {
    // Primary Blues — headers, primary actions, links
    headerBg: [84, 106, 122] as [number, number, number],       // Blue 3 #546A7A
    headerLight: [111, 138, 157] as [number, number, number],   // Blue 2 #6F8A9D
    accentCyan: [150, 174, 194] as [number, number, number],    // Blue 1 #96AEC2
    accentElectric: [111, 138, 157] as [number, number, number],// Blue 2 #6F8A9D
    accentNeon: [130, 160, 148] as [number, number, number],    // Green 2 #82A094
    accentAmber: [206, 159, 107] as [number, number, number],   // Sand 2 #CE9F6B
    accentOrange: [151, 110, 68] as [number, number, number],   // Sand 3 #976E44
    accentRed: [225, 127, 112] as [number, number, number],     // Red 1 #E17F70
    // Kardex brand tones
    kardexDark: [84, 106, 122] as [number, number, number],     // Blue 3 #546A7A
    kardexMid: [111, 138, 157] as [number, number, number],     // Blue 2 #6F8A9D
    kardexLight: [150, 174, 194] as [number, number, number],   // Blue 1 #96AEC2
    kardexGreen: [79, 106, 100] as [number, number, number],    // Green 3 #4F6A64
    kardexSilver: [146, 162, 165] as [number, number, number],  // Silver 2 #92A2A5
    // Card surfaces — clean white/light
    cardBg: [255, 255, 255] as [number, number, number],        // white cards
    cardBorder: [210, 220, 226] as [number, number, number],    // subtle border
    gridLine: [220, 228, 233] as [number, number, number],      // chart grid
    darkTrack: [230, 236, 240] as [number, number, number],     // progress track
    // Neutrals
    white: [255, 255, 255] as [number, number, number],
    offWhite: [248, 250, 252] as [number, number, number],
    lightGray: [241, 245, 249] as [number, number, number],
    midGray: [203, 213, 225] as [number, number, number],
    textDark: [84, 106, 122] as [number, number, number],       // Blue 3 for headings
    textBody: [93, 110, 115] as [number, number, number],       // Silver 3 #5D6E73
    textMuted: [146, 162, 165] as [number, number, number],     // Silver 2 #92A2A5
    textLight: [174, 191, 195] as [number, number, number],     // Grey 1 #AEBFC3
    // Status — using Kardex semantic colors
    positive: [130, 160, 148] as [number, number, number],      // Green 2 #82A094
    warning: [206, 159, 107] as [number, number, number],       // Sand 2 #CE9F6B
    negative: [225, 127, 112] as [number, number, number],      // Red 1 #E17F70
    // Zone colors — exactly matching dashboard UI
    zoneWest: [111, 138, 157] as [number, number, number],      // Blue 2 #6F8A9D
    zoneSouth: [79, 106, 100] as [number, number, number],      // Green 3 #4F6A64
    zoneNorth: [206, 159, 107] as [number, number, number],     // Sand 2 #CE9F6B
    zoneEast: [84, 106, 122] as [number, number, number],       // Blue 3 #546A7A
}

const filterLabels: Record<string, string> = {
    'zone-wise': 'Zone-wise Analysis',
    'zone-users': 'Zone Users Analysis',
}

const ZONE_COLORS: [number, number, number][] = [
    COLORS.zoneWest,
    COLORS.zoneSouth,
    COLORS.zoneNorth,
    COLORS.zoneEast,
    [0, 190, 180],
    [220, 120, 50],
    [80, 140, 230],
    [200, 80, 150],
]

const getZoneColor = (name: string, idx: number = 0): [number, number, number] => {
    const map: Record<string, [number, number, number]> = {
        WEST: COLORS.zoneWest,
        SOUTH: COLORS.zoneSouth,
        NORTH: COLORS.zoneNorth,
        EAST: COLORS.zoneEast,
    }
    return map[name.toUpperCase()] || ZONE_COLORS[idx % ZONE_COLORS.length]
}

// ============ Types ============
export interface ForecastPdfZone {
    zoneId: number
    zoneName: string
    noOfOffers: number
    offersValue: number
    ordersReceived: number
    openFunnel: number
    orderBooking: number
    uForBooking: number
    hitRatePercent: number
    balanceBU: number
    yearlyTarget: number
}

export interface ForecastPdfTotals {
    noOfOffers: number
    offersValue: number
    ordersReceived: number
    openFunnel: number
    orderBooking: number
    uForBooking: number
    yearlyTarget: number
    balanceBU: number
    hitRatePercent: number
}

export interface ForecastPdfMonthlyData {
    month: string
    monthLabel: string
    noOfOffers?: number
    offersValue: number
    orderReceived: number
    ordersBooked?: number
    devORvsBooked?: number
    ordersInHand: number
    buMonthly: number
    bookedVsBU?: number | null
    percentDev: number | null
    offerBUMonth: number
    offerBUMonthDev: number | null
}

export interface ForecastPdfZoneMonthly {
    zoneId: number
    zoneName: string
    hitRate: number
    yearlyTarget: number
    monthlyData: ForecastPdfMonthlyData[]
    productBreakdown?: ForecastPdfProductMonthly[]
    totals: {
        offersValue: number
        orderReceived: number
        ordersBooked?: number
        ordersInHand: number
        buMonthly: number
        offerBUMonth: number
    }
}

export interface ForecastPdfProductMonthly {
    productType: string
    productLabel: string
    yearlyTarget: number
    hitRate: number
    monthlyData: ForecastPdfMonthlyData[]
    totals: {
        offersValue: number
        orderReceived: number
        ordersInHand: number
        buMonthly: number
        offerBUMonth: number
    }
}

export interface ForecastPdfUserMonthly {
    userId: number
    userName: string
    userShortForm: string | null
    zoneName: string
    hitRate: number
    yearlyTarget: number
    monthlyData: ForecastPdfMonthlyData[]
    productBreakdown?: ForecastPdfProductMonthly[]
    totals: {
        offersValue: number
        orderReceived: number
        ordersInHand: number
        buMonthly: number
        offerBUMonth: number
    }
}

export interface ForecastPdfData {
    year: number
    zones: ForecastPdfZone[]
    totals: ForecastPdfTotals
    zoneMonthly: ForecastPdfZoneMonthly[]
    userMonthly: ForecastPdfUserMonthly[]
    productTotals?: {
        productType: string
        productLabel: string
        offersValue: number
        orderReceived: number
        ordersInHand: number
        yearlyTarget: number
        hitRate: number
    }[]
}

export type ForecastReportFilter = 'zone-wise' | 'zone-users'

// ============ Currency & Number Formatting (ASCII-safe, no Rs.) ============
const fmtCrLakh = (value: number): string => {
    if (value === 0) return '0'
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)} Cr`
    if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)} L`
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} K`
    return `${sign}${abs.toFixed(0)}`
}

const fmtNum = (value: number): string => {
    return new Intl.NumberFormat('en-IN').format(value)
}

const fmtPct = (value: number | null | undefined, decimals: number = 1): string => {
    if (value === null || value === undefined || isNaN(value)) return '-'
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

// ============ PDF Drawing Helpers — Kardex Brand Design ============

function drawGradientHeader(doc: any, pageW: number) {
    // Kardex Blue gradient header
    doc.setFillColor(...COLORS.headerBg)
    doc.rect(0, 0, pageW, 28, 'F')

    // Secondary blue strip
    doc.setFillColor(...COLORS.headerLight)
    doc.rect(0, 24, pageW, 4, 'F')

    // Accent underline — Kardex Blue 1
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(0, 28, pageW, 1.5, 'F')

    // Subtle bottom border
    doc.setFillColor(...COLORS.cardBorder)
    doc.rect(0, 29.5, pageW, 0.5, 'F')
}

// Load Kardex logo as base64 for embedding in PDF
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

function drawHeader(doc: any, year: number, filterLabel: string, zoneName?: string, logoBase64?: string | null): number {
    const pageW = doc.internal.pageSize.getWidth()

    drawGradientHeader(doc, pageW)

    // Logo area — white box
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(10, 4, 28, 18, 2, 2, 'F')
    doc.setDrawColor(...COLORS.cardBorder)
    doc.setLineWidth(0.3)
    doc.roundedRect(10, 4, 28, 18, 2, 2, 'S')

    // Embed Kardex Brand Logo
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', 11.5, 6.5, 25, 11)
        } catch {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(...COLORS.headerBg)
            doc.text('KC', 18, 15)
        }
    } else {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...COLORS.headerBg)
        doc.text('KC', 18, 15)
    }

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...COLORS.white)
    doc.text('KARDEX  Forecast Analytics Report', 45, 13)

    // Subtitle
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.accentCyan)
    const subtitle = zoneName
        ? `${filterLabel}  |  ${zoneName}  |  FY ${year}`
        : `${filterLabel}  |  FY ${year}`
    doc.text(subtitle, 45, 21)

    // Date badge
    doc.setFillColor(...COLORS.headerLight)
    doc.roundedRect(pageW - 65, 6, 55, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.white)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageW - 62, 15)

    return 34
}

function drawFooter(doc: any, pageNum: number) {
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    // Footer bar — Kardex Blue
    doc.setFillColor(...COLORS.headerBg)
    doc.rect(0, pageH - 10, pageW, 10, 'F')

    // Top accent line
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(0, pageH - 10, pageW, 0.4, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...COLORS.accentCyan)
    doc.text('Kardex Remstar  |  Forecast Analytics Report  |  Confidential', 15, pageH - 4)
    doc.setTextColor(...COLORS.white)
    doc.text(`Page ${pageNum}`, pageW - 25, pageH - 4)
}

function drawSectionTitle(doc: any, y: number, title: string, color?: [number, number, number]): number {
    const pageW = doc.internal.pageSize.getWidth()
    const sectionColor = color || COLORS.headerBg

    // Section header bar
    doc.setFillColor(...sectionColor)
    doc.roundedRect(15, y, pageW - 30, 10, 2, 2, 'F')

    // Left accent bar — Blue 1
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(15, y, 3, 10, 'F')

    // Title text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLORS.white)
    doc.text(title, 23, y + 7)

    return y + 14
}

function drawKPICard(
    doc: any,
    x: number, y: number, w: number, h: number,
    label: string, value: string,
    accentColor: [number, number, number],
    subLabel?: string
) {
    // White card background
    doc.setFillColor(...COLORS.cardBg)
    doc.roundedRect(x, y, w, h, 3, 3, 'F')

    // Card border
    doc.setDrawColor(...COLORS.cardBorder)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, 3, 3, 'S')

    // Top accent bar
    doc.setFillColor(...accentColor)
    doc.rect(x + 4, y, w - 8, 2.5, 'F')

    // Label — muted text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(label.toUpperCase(), x + 6, y + 10)

    // Value — dark Kardex blue
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...COLORS.textDark)
    doc.text(value, x + 6, y + 22)

    // SubLabel — accent color
    if (subLabel) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...accentColor)
        doc.text(subLabel, x + 6, y + 28)
    }
}

function drawProgressBar(
    doc: any,
    x: number, y: number, w: number, h: number,
    percentage: number,
    color: [number, number, number]
) {
    // Light track
    doc.setFillColor(...COLORS.darkTrack)
    doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')

    // Fill bar
    const fillW = Math.max(Math.min(percentage / 100, 1) * w, 0)
    if (fillW > 0) {
        doc.setFillColor(...color)
        doc.roundedRect(x, y, fillW, h, h / 2, h / 2, 'F')
    }

    // Tick marks at 25%, 50%, 75%
    doc.setDrawColor(...COLORS.midGray)
    doc.setLineWidth(0.2)
    for (const pct of [0.25, 0.5, 0.75]) {
        const tx = x + pct * w
        doc.line(tx, y - 1, tx, y + h + 1)
    }
}

function drawBarChart(
    doc: any,
    x: number, y: number, w: number, h: number,
    data: { label: string; value: number; color: [number, number, number] }[],
    title: string
) {
    // White card background
    doc.setFillColor(...COLORS.cardBg)
    doc.roundedRect(x - 4, y - 8, w + 8, h + 16, 3, 3, 'F')
    doc.setDrawColor(...COLORS.cardBorder)
    doc.setLineWidth(0.3)
    doc.roundedRect(x - 4, y - 8, w + 8, h + 16, 3, 3, 'S')

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textDark)
    doc.text(title, x, y)
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(x, y + 1.5, 20, 0.4, 'F')

    const chartY = y + 8
    const chartH = h - 16
    const maxVal = Math.max(...data.map(d => d.value), 1)
    const barGap = 4
    const totalGap = (data.length - 1) * barGap
    const barW = Math.min((w - totalGap) / data.length, 25)
    const startX = x + (w - (data.length * barW + totalGap)) / 2

    // Horizontal grid lines
    doc.setDrawColor(...COLORS.gridLine)
    doc.setLineWidth(0.15)
    for (let g = 1; g <= 3; g++) {
        const gy = chartY + chartH - (g / 4) * (chartH - 8)
        doc.line(x, gy, x + w, gy)
    }

    data.forEach((item, i) => {
        const bx = startX + i * (barW + barGap)
        const barH = Math.max((item.value / maxVal) * (chartH - 8), 2)
        const by = chartY + chartH - barH

        // Bar with rounded top
        doc.setFillColor(...item.color)
        doc.roundedRect(bx, by, barW, barH, 1.5, 1.5, 'F')

        // Value on top
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5.5)
        doc.setTextColor(...COLORS.textDark)
        doc.text(fmtCrLakh(item.value), bx + barW / 2, by - 2, { align: 'center' })

        // Label at bottom
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(...COLORS.textMuted)
        doc.text(item.label.substring(0, 8), bx + barW / 2, chartY + chartH + 4, { align: 'center' })
    })
}

/**
 * Visual alternative to tables: A "Performance Strip" row
 * Shows a label, a compact mini-bar for achievement, and key metrics in columns
 */
function drawPerformanceStrip(
    doc: any,
    x: number, y: number, w: number,
    label: string,
    metrics: { label: string; value: string }[],
    percentage: number,
    color: [number, number, number]
) {
    const rowH = 14

    // Background
    doc.setFillColor(...COLORS.offWhite)
    doc.roundedRect(x, y, w, rowH, 2, 2, 'F')

    // Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.textDark)
    doc.text(label, x + 5, y + rowH / 2 + 1)

    // Mini Achievement Bar
    const barX = x + 50
    const barW = 40
    const barH = 3
    doc.setFillColor(...COLORS.darkTrack)
    doc.roundedRect(barX, y + rowH / 2 - 1.5, barW, barH, 1.5, 1.5, 'F')

    const fillW = Math.max(Math.min(percentage / 100, 1) * barW, 0)
    if (fillW > 0) {
        doc.setFillColor(...color)
        doc.roundedRect(barX, y + rowH / 2 - 1.5, fillW, barH, 1.5, 1.5, 'F')
    }

    doc.setFontSize(6)
    doc.setTextColor(...color)
    doc.text(`${percentage.toFixed(1)}%`, barX + barW + 3, y + rowH / 2 + 1)

    // Metrics Columns
    const metricStartX = x + 110
    const colGap = 22
    metrics.forEach((m, minx) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(...COLORS.textMuted)
        doc.text(m.label.toUpperCase(), metricStartX + minx * colGap, y + 5)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.textDark)
        doc.text(m.value, metricStartX + minx * colGap, y + 10)
    })
}

function drawPieChart(
    doc: any,
    centerX: number, centerY: number, radius: number,
    data: { label: string; value: number; color: [number, number, number] }[],
    title: string
) {
    // White card background - dynamic height for legends
    const itemsPerCol = 6
    const cols = Math.ceil(data.length / itemsPerCol)
    const cardW = radius * 2 + (cols > 1 ? 100 : 60)
    const cardH = Math.max(radius * 2 + 20, (Math.min(data.length, itemsPerCol) * 8) + 20)

    doc.setFillColor(...COLORS.cardBg)
    doc.roundedRect(centerX - radius - 6, centerY - radius - 14, cardW, cardH, 3, 3, 'F')
    doc.setDrawColor(...COLORS.cardBorder)
    doc.setLineWidth(0.3)
    doc.roundedRect(centerX - radius - 6, centerY - radius - 14, cardW, cardH, 3, 3, 'S')

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textDark)
    doc.text(title, centerX - radius, centerY - radius - 6)
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(centerX - radius, centerY - radius - 4.5, 18, 0.3, 'F')

    const total = data.reduce((sum, d) => sum + d.value, 0)
    if (total === 0) return

    let startAngle = -Math.PI / 2

    data.forEach((item) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI
        doc.setFillColor(...item.color)

        const steps = Math.max(Math.ceil(sliceAngle / 0.04), 4)
        for (let s = 0; s < steps; s++) {
            const a1 = startAngle + (s / steps) * sliceAngle
            const a2 = startAngle + ((s + 1) / steps) * sliceAngle
            doc.triangle(
                centerX, centerY,
                centerX + radius * Math.cos(a1), centerY + radius * Math.sin(a1),
                centerX + radius * Math.cos(a2), centerY + radius * Math.sin(a2),
                'F'
            )
        }
        startAngle += sliceAngle
    })

    // White center for donut effect
    doc.setFillColor(...COLORS.cardBg)
    doc.circle(centerX, centerY, radius * 0.55, 'F')

    // Center label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.textDark)
    doc.text('Total', centerX, centerY - 1, { align: 'center' })
    doc.setFontSize(6)
    doc.setTextColor(...COLORS.headerBg)
    doc.text(fmtCrLakh(total), centerX, centerY + 4, { align: 'center' })

    // Legend
    const legendX = centerX + radius + 10
    data.forEach((item, idx) => {
        const col = Math.floor(idx / itemsPerCol)
        const row = idx % itemsPerCol
        const lx = legendX + col * 45
        const ly = centerY - radius + 8 + row * 8

        doc.setFillColor(...item.color)
        doc.roundedRect(lx, ly - 2, 4, 4, 1, 1, 'F')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(...COLORS.textBody)
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'

        // Truncate labels if too long
        let label = item.label
        if (label.length > 18) label = label.substring(0, 16) + '..'

        doc.text(`${label} (${pct}%)`, lx + 6, ly + 1.5)
    })
}

function needsNewPage(doc: any, y: number, needed: number, pageNum: { val: number }, data: ForecastPdfData, filter: ForecastReportFilter, filterLabels: Record<string, string>, zoneName?: string, logoBase64?: string | null): [number, number] {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
        drawFooter(doc, pageNum.val)
        pageNum.val++
        doc.addPage()
        const newY = drawHeader(doc, data.year, filterLabels[filter], zoneName, logoBase64)
        return [newY, pageNum.val]
    }
    return [y, pageNum.val]
}

// ============ Main PDF Generator ============

export async function generateForecastPdf(
    data: ForecastPdfData,
    filter: ForecastReportFilter,
    selectedZoneId?: number,
    selectedUserId?: number,
    selectedMonth?: number
): Promise<void> {
    const { default: jsPDF } = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = autoTableModule.default || autoTableModule

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    }) as any

    // Load Kardex logo for embedding in headers
    const logoBase64 = await loadLogoBase64()

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const pageNum = { val: 1 }


    const selectedZone = selectedZoneId
        ? data.zones.find(z => z.zoneId === selectedZoneId)
        : undefined

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    const monthName = selectedMonth !== undefined ? monthNames[selectedMonth] : undefined

    let y = drawHeader(doc, data.year, filterLabels[filter] + (monthName ? ` (${monthName})` : ''), selectedZone?.zoneName, logoBase64)

    // Aggregation logic for month vs year
    let displayTotals: any;
    if (selectedMonth !== undefined) {
        const targetMonthKey = monthName?.substring(0, 3).toLowerCase()
        const zoneMonthlyData = data.zoneMonthly.filter(zm =>
            !selectedZoneId || zm.zoneId === selectedZoneId
        )

        const mNoOfOffers = zoneMonthlyData.reduce((sum, zm) => {
            const m = zm.monthlyData.find(md =>
                (md.monthLabel && md.monthLabel.toLowerCase().includes(monthName!.toLowerCase())) ||
                (md.month && md.month.toLowerCase().includes(targetMonthKey!))
            )
            return sum + (m?.noOfOffers || 0)
        }, 0)

        const mOffersValue = zoneMonthlyData.reduce((sum, zm) => {
            const m = zm.monthlyData.find(md =>
                (md.monthLabel && md.monthLabel.toLowerCase().includes(monthName!.toLowerCase())) ||
                (md.month && md.month.toLowerCase().includes(targetMonthKey!))
            )
            return sum + (m?.offersValue || 0)
        }, 0)

        const mOrdersReceived = zoneMonthlyData.reduce((sum, zm) => {
            const m = zm.monthlyData.find(md =>
                (md.monthLabel && md.monthLabel.toLowerCase().includes(monthName!.toLowerCase())) ||
                (md.month && md.month.toLowerCase().includes(targetMonthKey!))
            )
            return sum + (m?.orderReceived || 0)
        }, 0)

        const mOrdersInHand = zoneMonthlyData.reduce((sum, zm) => {
            const m = zm.monthlyData.find(md =>
                (md.monthLabel && md.monthLabel.toLowerCase().includes(monthName!.toLowerCase())) ||
                (md.month && md.month.toLowerCase().includes(targetMonthKey!))
            )
            return sum + (m?.ordersInHand || 0)
        }, 0)

        const mYearlyTarget = selectedZoneId
            ? (selectedZone?.yearlyTarget || 0) / 12
            : data.totals.yearlyTarget / 12

        displayTotals = {
            noOfOffers: mNoOfOffers,
            offersValue: mOffersValue,
            ordersReceived: mOrdersReceived,
            openFunnel: mOrdersInHand,
            yearlyTarget: mYearlyTarget,
            hitRatePercent: selectedZone ? selectedZone.hitRatePercent : data.totals.hitRatePercent
        }
    } else {
        displayTotals = selectedZone
            ? {
                noOfOffers: selectedZone.noOfOffers,
                offersValue: selectedZone.offersValue,
                ordersReceived: selectedZone.ordersReceived,
                openFunnel: selectedZone.openFunnel,
                yearlyTarget: selectedZone.yearlyTarget,
                hitRatePercent: selectedZone.hitRatePercent,
            }
            : data.totals
    }

    const achPct = displayTotals.yearlyTarget > 0
        ? ((displayTotals.ordersReceived / displayTotals.yearlyTarget) * 100)
        : 0

    const cardW = (pageW - 45) / 4
    const cardH = 30
    const cardGap = 5
    const cardStartX = 15

    drawKPICard(doc, cardStartX, y, cardW, cardH,
        'Total Offers',
        fmtNum(displayTotals.noOfOffers),
        COLORS.accentCyan,
        `Funnel: ${fmtCrLakh(displayTotals.offersValue)}`
    )

    drawKPICard(doc, cardStartX + cardW + cardGap, y, cardW, cardH,
        'Orders Received',
        fmtCrLakh(displayTotals.ordersReceived),
        COLORS.accentNeon,
        `${achPct.toFixed(1)}% of Target Achieved`
    )

    drawKPICard(doc, cardStartX + 2 * (cardW + cardGap), y, cardW, cardH,
        'Orders in Hand',
        fmtCrLakh(displayTotals.openFunnel),
        COLORS.accentOrange,
        'Active pipeline value'
    )

    drawKPICard(doc, cardStartX + 3 * (cardW + cardGap), y, cardW, cardH,
        selectedMonth !== undefined ? 'Monthly Target' : 'Yearly Target',
        fmtCrLakh(displayTotals.yearlyTarget),
        COLORS.accentAmber,
        `Hit Rate: ${displayTotals.hitRatePercent?.toFixed(1) ?? '0'}%`
    )

    // ===== Achievement Progress Bar =====
    y += cardH + 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.textDark)
    doc.text('Target Achievement', 15, y)

    const achColor: [number, number, number] = achPct >= 100 ? COLORS.positive : achPct >= 75 ? COLORS.warning : COLORS.negative
    doc.setTextColor(...achColor)
    doc.text(`${achPct.toFixed(1)}%`, pageW - 15, y, { align: 'right' })

    y += 3
    drawProgressBar(doc, 15, y, pageW - 30, 3.5, achPct, achColor)

    y += 8

    // ===== Zone Performance Table =====
    if (filter === 'zone-wise') {
        y = drawSectionTitle(doc, y, 'ZONE PERFORMANCE SUMMARY')

        const zonesToShow = selectedZoneId
            ? data.zones.filter(z => z.zoneId === selectedZoneId)
            : data.zones

        const tableBody = zonesToShow.map(z => {
            let zNoOfOffers = z.noOfOffers
            let zOffersValue = z.offersValue
            let zOrdersReceived = z.ordersReceived
            let zOpenFunnel = z.openFunnel
            let zTarget = z.yearlyTarget

            if (selectedMonth !== undefined) {
                const targetMonthKey = monthName?.substring(0, 3).toLowerCase()
                const zm = data.zoneMonthly.find(zm => zm.zoneId === z.zoneId)
                if (zm) {
                    const m = zm.monthlyData.find(md =>
                        (md.monthLabel && md.monthLabel.toLowerCase().includes(monthName!.toLowerCase())) ||
                        (md.month && md.month.toLowerCase().includes(targetMonthKey!))
                    )
                    zNoOfOffers = m?.noOfOffers || 0
                    zOffersValue = m?.offersValue || 0
                    zOrdersReceived = m?.orderReceived || 0
                    zOpenFunnel = m?.ordersInHand || 0
                    zTarget = z.yearlyTarget / 12
                }
            }

            const zAch = zTarget > 0 ? ((zOrdersReceived / zTarget) * 100) : 0
            const devPct = zTarget > 0 ? ((zOrdersReceived / zTarget) * 100 - 100) : 0
            const zBalance = zTarget - zOrdersReceived

            return [
                z.zoneName,
                zNoOfOffers.toString(),
                fmtCrLakh(zOffersValue),
                fmtCrLakh(zOrdersReceived),
                fmtCrLakh(zOpenFunnel),
                fmtCrLakh(zTarget),
                fmtPct(devPct, 0),
                fmtCrLakh(zBalance),
                `${zAch.toFixed(1)}%`,
            ]
        })

        // Add totals row
        if (!selectedZoneId) {
            const totalDevPct = displayTotals.yearlyTarget > 0 ? ((displayTotals.ordersReceived / displayTotals.yearlyTarget) * 100 - 100) : 0
            const totalBalance = displayTotals.yearlyTarget - displayTotals.ordersReceived
            tableBody.push([
                'TOTAL',
                displayTotals.noOfOffers.toString(),
                fmtCrLakh(displayTotals.offersValue),
                fmtCrLakh(displayTotals.ordersReceived),
                fmtCrLakh(displayTotals.openFunnel),
                fmtCrLakh(displayTotals.yearlyTarget),
                fmtPct(totalDevPct, 0),
                fmtCrLakh(totalBalance),
                `${achPct.toFixed(1)}%`,
            ])
        }

        autoTable(doc, {
            startY: y,
            head: [['Zone', 'No Offers', 'Offers Value', 'Orders Received', 'Orders in Hand', 'Target', '% Dev', 'Balance', 'Achievement']],
            body: tableBody,
            theme: 'grid',
            styles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                lineWidth: 0.1,
                lineColor: [220, 225, 230],
            },
            headStyles: {
                fillColor: COLORS.headerBg,
                textColor: COLORS.white,
                fontSize: 7,
                fontStyle: 'bold',
                halign: 'center' as const,
                cellPadding: 3,
            },
            bodyStyles: {
                textColor: COLORS.textBody,
            },
            alternateRowStyles: {
                fillColor: COLORS.offWhite,
            },
            columnStyles: {
                0: { fontStyle: 'bold' as const, halign: 'left' as const, cellWidth: 26 },
                1: { halign: 'center' as const, cellWidth: 16 },
                2: { halign: 'right' as const, cellWidth: 20 },
                3: { halign: 'right' as const, cellWidth: 20 },
                4: { halign: 'right' as const, cellWidth: 20 },
                5: { halign: 'right' as const, cellWidth: 20 },
                6: { halign: 'center' as const, cellWidth: 18 },
                7: { halign: 'right' as const, cellWidth: 20 },
                8: { halign: 'center' as const, cellWidth: 22 },
            },
            didParseCell: function (cellData: any) {
                // %Dev column color (index 6)
                if (cellData.section === 'body' && cellData.column.index === 6) {
                    const raw = String(cellData.cell.raw || '')
                    if (raw.startsWith('+')) cellData.cell.styles.textColor = COLORS.positive
                    else if (raw.startsWith('-')) cellData.cell.styles.textColor = COLORS.negative
                    cellData.cell.styles.fontStyle = 'bold'
                }
                // Achievement column color (index 8)
                if (cellData.section === 'body' && cellData.column.index === 8) {
                    const val = parseFloat(cellData.cell.raw || '0')
                    if (val >= 100) cellData.cell.styles.textColor = COLORS.positive
                    else if (val >= 75) cellData.cell.styles.textColor = [180, 130, 0]
                    else cellData.cell.styles.textColor = COLORS.negative
                    cellData.cell.styles.fontStyle = 'bold'
                }
                // Balance column — negative = red (index 7)
                if (cellData.section === 'body' && cellData.column.index === 7) {
                    const raw = String(cellData.cell.raw || '')
                    if (raw.includes('-')) {
                        cellData.cell.styles.textColor = COLORS.negative
                    } else {
                        cellData.cell.styles.textColor = COLORS.positive
                    }
                    cellData.cell.styles.fontStyle = 'bold'
                }
                // Style totals row
                if (cellData.section === 'body' && cellData.row.index === tableBody.length - 1 && !selectedZoneId) {
                    cellData.cell.styles.fillColor = COLORS.headerBg
                    cellData.cell.styles.textColor = COLORS.white
                    cellData.cell.styles.fontStyle = 'bold'
                }
            },
            margin: { left: 15, right: 15 },
        })

        y = (doc as any).lastAutoTable?.finalY || y + 40

        // ===== ANALYTICS PAGE =====
        if (!selectedZoneId && data.zones.length > 1) {
            let aY: number
            // Reduced threshold from 90 to 75 to keep more on one page if possible
            const [ny, npn] = needsNewPage(doc, y, 75, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = ny === y ? ny + 8 : ny
            pageNum.val = npn

            aY = drawSectionTitle(doc, aY, 'VISUAL ANALYTICS DASHBOARD')
            aY += 4

            // --- Row 1: Bar chart (Orders Won) + Donut chart (Offers Distribution) ---
            const barData = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.ordersReceived,
                color: getZoneColor(z.zoneName, i),
            }))
            drawBarChart(doc, 20, aY, (pageW - 50) / 2 - 5, 55, barData, 'Orders Received by Zone')

            const pieData = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.offersValue,
                color: getZoneColor(z.zoneName, i),
            }))
            drawPieChart(doc, pageW / 2 + 30, aY + 30, 18, pieData, 'Offers Value Distribution')

            aY += 75

                // --- Row 2: Gauge Meters (Target Achievement per Zone) ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 65, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = drawSectionTitle(doc, aY, 'TARGET ACHIEVEMENT GAUGES', COLORS.kardexGreen)
            aY += 4

            const gaugeW = (pageW - 30) / Math.min(data.zones.length, 4)
            const gaugeR = Math.min(gaugeW / 2 - 8, 16)

            data.zones.slice(0, 4).forEach((zone, i) => {
                const cx = 15 + i * gaugeW + gaugeW / 2
                const cy = aY + gaugeR + 8
                const pct = zone.yearlyTarget > 0 ? (zone.ordersReceived / zone.yearlyTarget) * 100 : 0

                // Dark card bg
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(15 + i * gaugeW + 2, aY, gaugeW - 4, gaugeR * 2 + 28, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.roundedRect(15 + i * gaugeW + 2, aY, gaugeW - 4, gaugeR * 2 + 28, 3, 3, 'S')

                // Outer ring decoration
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.circle(cx, cy, gaugeR + 2, 'S')

                // Track arc (dark)
                const segments = 40
                doc.setDrawColor(...COLORS.darkTrack)
                doc.setLineWidth(4)
                for (let s = 0; s < segments; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(
                        cx + gaugeR * Math.cos(a1), cy + gaugeR * Math.sin(a1),
                        cx + gaugeR * Math.cos(a2), cy + gaugeR * Math.sin(a2)
                    )
                }

                // Fill arc (colored, thicker)
                const fillPct = Math.min(pct / 100, 1)
                const fillSegs = Math.floor(fillPct * segments)
                const gColor: [number, number, number] = pct >= 100 ? COLORS.positive : pct >= 75 ? COLORS.warning : COLORS.negative
                doc.setDrawColor(...gColor)
                doc.setLineWidth(4)
                for (let s = 0; s < fillSegs; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(
                        cx + gaugeR * Math.cos(a1), cy + gaugeR * Math.sin(a1),
                        cx + gaugeR * Math.cos(a2), cy + gaugeR * Math.sin(a2)
                    )
                }

                // Percentage text in center
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(13)
                doc.setTextColor(...gColor)
                doc.text(`${pct.toFixed(0)}%`, cx, cy + 2, { align: 'center' })

                // Zone name — bright white
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textDark)
                doc.text(zone.zoneName, cx, cy + gaugeR + 8, { align: 'center' })

                // Target value — muted silver
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`Target: ${fmtCrLakh(zone.yearlyTarget)}`, cx, cy + gaugeR + 13, { align: 'center' })
                doc.text(`Won: ${fmtCrLakh(zone.ordersReceived)}`, cx, cy + gaugeR + 18, { align: 'center' })
            })

            aY += gaugeR * 2 + 42

                // --- Row 3: Horizontal bars (Offers vs Orders vs Target comparison) ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 65, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = drawSectionTitle(doc, aY, 'ZONE COMPARISON: OFFERS vs ORDERS vs TARGET', COLORS.accentCyan)
            aY += 4

            // Clean card bg
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15, aY, pageW - 30, data.zones.length * 13 + 14, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.setLineWidth(0.3)
            doc.roundedRect(15, aY, pageW - 30, data.zones.length * 13 + 14, 3, 3, 'S')

            // Legend
            const legendStartX = pageW - 120
            const legendItems = [
                { label: 'Offers Value', color: COLORS.kardexLight },
                { label: 'Orders Won', color: COLORS.accentNeon },
                { label: 'Target', color: COLORS.accentAmber },
            ]
            legendItems.forEach((item, li) => {
                doc.setFillColor(...item.color)
                doc.roundedRect(legendStartX + li * 38, aY + 2, 5, 4, 1, 1, 'F')
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(item.label, legendStartX + li * 38 + 7, aY + 5.5)
            })

            aY += 10
            const hBarMaxVal = Math.max(...data.zones.flatMap(z => [z.offersValue, z.ordersReceived, z.yearlyTarget]), 1)
            const hBarW = pageW - 90

            data.zones.forEach((zone, i) => {
                const rowY = aY + i * 13

                // Zone label — bright white on dark
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textDark)
                doc.text(zone.zoneName, 20, rowY + 4)

                const barStartX = 48
                const barH = 4.0

                // Offers bar
                const offersW = (zone.offersValue / hBarMaxVal) * hBarW
                doc.setFillColor(...COLORS.kardexLight)
                doc.roundedRect(barStartX, rowY, Math.max(offersW, 1), barH, 1, 1, 'F')

                // Orders bar
                const ordersW = (zone.ordersReceived / hBarMaxVal) * hBarW
                doc.setFillColor(...COLORS.accentNeon)
                doc.roundedRect(barStartX, rowY + 5.5, Math.max(ordersW, 1), barH, 1, 1, 'F')

                // Target marker — vertical flag-style marker with T indicator
                const targetX = barStartX + (zone.yearlyTarget / hBarMaxVal) * hBarW
                if (zone.yearlyTarget > 0) {
                    doc.setDrawColor(...COLORS.accentAmber)
                    doc.setLineWidth(0.4)
                    doc.line(targetX, rowY - 1.5, targetX, rowY + 11.5)

                    doc.setFillColor(...COLORS.accentAmber)
                    // Top indicator - larger triangle
                    doc.triangle(targetX - 2.2, rowY - 1.5, targetX + 2.2, rowY - 1.5, targetX, rowY + 1.2, 'F')

                    // Small "T" for clarity
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(5)
                    doc.text("T", targetX, rowY - 2.5, { align: 'center' })

                    // Bottom indicator - small dot
                    doc.circle(targetX, rowY + 11.5, 0.7, 'F')
                }

                // Values on right — aligned column
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5.5)
                doc.setTextColor(...COLORS.textMuted)
                const valueX = pageW - 20
                doc.text(`Off: ${fmtCrLakh(zone.offersValue)}`, valueX, rowY + 1.5, { align: 'right' })
                doc.text(`Ord: ${fmtCrLakh(zone.ordersReceived)}`, valueX, rowY + 5.5, { align: 'right' })
                doc.setTextColor(...COLORS.accentAmber)
                doc.setFont('helvetica', 'bold')
                doc.text(`Tgt: ${fmtCrLakh(zone.yearlyTarget)}`, valueX, rowY + 9.5, { align: 'right' })
            })

            aY += data.zones.length * 13 + 18

                // --- Row 4: Hit Rate Comparison + Orders Pie ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 60, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = drawSectionTitle(doc, aY, 'HIT RATE ANALYSIS & ORDERS DISTRIBUTION', COLORS.kardexMid)
            aY += 4

            // Hit rate horizontal bars (left half) — dark card
            const hrCardW = (pageW - 40) / 2
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15, aY, hrCardW, data.zones.length * 11 + 12, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.setLineWidth(0.3)
            doc.roundedRect(15, aY, hrCardW, data.zones.length * 11 + 12, 3, 3, 'S')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(...COLORS.textDark)
            doc.text('Hit Rate by Zone', 20, aY + 7)

            data.zones.forEach((zone, i) => {
                const rowY = aY + 12 + i * 11
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textDark)
                doc.text(zone.zoneName, 20, rowY + 4)

                const maxHr = Math.max(...data.zones.map(z => z.hitRatePercent), 100)
                const hrBarW = hrCardW - 65
                const filled = (zone.hitRatePercent / maxHr) * hrBarW
                const hrColor: [number, number, number] = zone.hitRatePercent >= 50 ? COLORS.positive : zone.hitRatePercent >= 30 ? COLORS.warning : COLORS.negative

                doc.setFillColor(...COLORS.darkTrack)
                doc.roundedRect(55, rowY + 1, hrBarW, 4, 2, 2, 'F')
                doc.setFillColor(...hrColor)
                doc.roundedRect(55, rowY + 1, Math.max(filled, 1), 4, 2, 2, 'F')

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6)
                doc.setTextColor(...hrColor)
                doc.text(`${zone.hitRatePercent.toFixed(1)}%`, 55 + hrBarW + 3, rowY + 5)
            })

            // Orders Won Pie Chart (right half)
            const ordPieData = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.ordersReceived,
                color: getZoneColor(z.zoneName, i),
            }))
            drawPieChart(doc, pageW / 2 + 45, aY + 30, 16, ordPieData, 'Orders Won Distribution')

            aY += Math.max(data.zones.length * 11 + 24, 72)

                // --- Row 5: Top Performers & Key Insights ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 50, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = drawSectionTitle(doc, aY, 'KEY INSIGHTS & RANKINGS', COLORS.accentOrange)
            aY += 4

            // Sorted zones by achievement
            const sortedByAch = [...data.zones].sort((a, b) => {
                const achA = a.yearlyTarget > 0 ? a.ordersReceived / a.yearlyTarget : 0
                const achB = b.yearlyTarget > 0 ? b.ordersReceived / b.yearlyTarget : 0
                return achB - achA
            })

            // Top performer card
            const insightCardW = (pageW - 40) / 3
            const insightH = 38

            // Card 1: Best Zone — dark glass
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15, aY, insightCardW, insightH, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.setLineWidth(0.3)
            doc.roundedRect(15, aY, insightCardW, insightH, 3, 3, 'S')
            doc.setFillColor(...COLORS.positive)
            doc.rect(15, aY, insightCardW, 2.5, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(6.5)
            doc.setTextColor(...COLORS.textMuted)
            doc.text('BEST PERFORMING ZONE', 20, aY + 9)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(11)
            doc.setTextColor(...COLORS.positive)
            doc.text(sortedByAch[0]?.zoneName || '-', 20, aY + 19)
            const bestAch = sortedByAch[0]?.yearlyTarget > 0 ? ((sortedByAch[0].ordersReceived / sortedByAch[0].yearlyTarget) * 100).toFixed(1) : '0'
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.setTextColor(...COLORS.textMuted)
            doc.text(`Achievement: ${bestAch}% | Orders: ${fmtCrLakh(sortedByAch[0]?.ordersReceived || 0)}`, 20, aY + 26)
            doc.text(`Hit Rate: ${sortedByAch[0]?.hitRatePercent?.toFixed(1) || '0'}%`, 20, aY + 32)

            // Card 2: Highest Funnel
            const sortedByFunnel = [...data.zones].sort((a, b) => b.openFunnel - a.openFunnel)
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15 + insightCardW + 5, aY, insightCardW, insightH, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.roundedRect(15 + insightCardW + 5, aY, insightCardW, insightH, 3, 3, 'S')
            doc.setFillColor(...COLORS.accentOrange)
            doc.rect(15 + insightCardW + 5, aY, insightCardW, 2.5, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(6.5)
            doc.setTextColor(...COLORS.textMuted)
            doc.text('HIGHEST OPEN FUNNEL', 20 + insightCardW + 5, aY + 9)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(11)
            doc.setTextColor(...COLORS.accentOrange)
            doc.text(sortedByFunnel[0]?.zoneName || '-', 20 + insightCardW + 5, aY + 19)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.setTextColor(...COLORS.textMuted)
            doc.text(`Funnel: ${fmtCrLakh(sortedByFunnel[0]?.openFunnel || 0)}`, 20 + insightCardW + 5, aY + 26)
            doc.text(`Offers: ${sortedByFunnel[0]?.noOfOffers || 0} | Value: ${fmtCrLakh(sortedByFunnel[0]?.offersValue || 0)}`, 20 + insightCardW + 5, aY + 32)

            // Card 3: Needs Attention
            const worst = sortedByAch[sortedByAch.length - 1]
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15 + 2 * (insightCardW + 5), aY, insightCardW, insightH, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.roundedRect(15 + 2 * (insightCardW + 5), aY, insightCardW, insightH, 3, 3, 'S')
            doc.setFillColor(...COLORS.negative)
            doc.rect(15 + 2 * (insightCardW + 5), aY, insightCardW, 2.5, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(6.5)
            doc.setTextColor(...COLORS.textMuted)
            doc.text('NEEDS ATTENTION', 20 + 2 * (insightCardW + 5), aY + 9)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(11)
            doc.setTextColor(...COLORS.negative)
            doc.text(worst?.zoneName || '-', 20 + 2 * (insightCardW + 5), aY + 19)
            const worstAch = worst?.yearlyTarget > 0 ? ((worst.ordersReceived / worst.yearlyTarget) * 100).toFixed(1) : '0'
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.setTextColor(...COLORS.textMuted)
            doc.text(`Achievement: ${worstAch}% | Balance: ${fmtCrLakh((worst?.yearlyTarget || 0) - (worst?.ordersReceived || 0))}`, 20 + 2 * (insightCardW + 5), aY + 26)
            doc.text(`Hit Rate: ${worst?.hitRatePercent?.toFixed(1) || '0'}%`, 20 + 2 * (insightCardW + 5), aY + 32)

            aY += insightH + 14

                // --- Row 6: Open Funnel Bar chart ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 60, pageNum, data, filter, filterLabels, undefined, logoBase64)

            const funnelData = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.openFunnel,
                color: getZoneColor(z.zoneName, i),
            }))
            drawBarChart(doc, 20, aY, (pageW - 50) / 2 - 5, 55, funnelData, 'Open Funnel by Zone')

            // Offers count pie
            const offersCountPie = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.noOfOffers,
                color: getZoneColor(z.zoneName, i),
            }))
            drawPieChart(doc, pageW / 2 + 30, aY + 30, 18, offersCountPie, 'Number of Offers Distribution')
            y = aY + 10
        } else if (selectedZoneId) {
            // Single zone analytics - dashboard style
            const zone = data.zones.find(z => z.zoneId === selectedZoneId)
            if (zone) {
                const [ay, npn] = needsNewPage(doc, y, 90, pageNum, data, filter, filterLabels, zone.zoneName, logoBase64)
                let dAY = ay
                pageNum.val = npn

                dAY = drawSectionTitle(doc, dAY, `${zone.zoneName.toUpperCase()} PERFORMANCE DASHBOARD`, COLORS.kardexGreen)
                dAY += 4

                const pct = zone.yearlyTarget > 0 ? (zone.ordersReceived / zone.yearlyTarget) * 100 : 0

                // Large gauge for single zone
                const cx = pageW / 4
                const cy = dAY + 35
                const gr = 22
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(cx - 35, dAY, 70, 75, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.roundedRect(cx - 35, dAY, 70, 75, 3, 3, 'S')

                const segments = 50
                doc.setDrawColor(...COLORS.darkTrack)
                doc.setLineWidth(4)
                for (let s = 0; s < segments; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(cx + gr * Math.cos(a1), cy + gr * Math.sin(a1), cx + gr * Math.cos(a2), cy + gr * Math.sin(a2))
                }
                const fillSegs = Math.floor(Math.min(pct / 100, 1) * segments)
                const gColor: [number, number, number] = pct >= 100 ? COLORS.positive : pct >= 75 ? COLORS.warning : COLORS.negative
                doc.setDrawColor(...gColor)
                doc.setLineWidth(4)
                for (let s = 0; s < fillSegs; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(cx + gr * Math.cos(a1), cy + gr * Math.sin(a1), cx + gr * Math.cos(a2), cy + gr * Math.sin(a2))
                }
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(16)
                doc.setTextColor(...gColor)
                doc.text(`${pct.toFixed(0)}%`, cx, cy + 3, { align: 'center' })
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(8)
                doc.setTextColor(...COLORS.textDark)
                doc.text(`${zone.zoneName} Achievement`, cx, cy + gr + 10, { align: 'center' })
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`Target: ${fmtCrLakh(zone.yearlyTarget)}  |  Won: ${fmtCrLakh(zone.ordersReceived)}  |  Hit Rate: ${zone.hitRatePercent.toFixed(1)}%`, cx, cy + gr + 16, { align: 'center' })

                y = dAY + 85
            }
        }

        // ===== Monthly Breakdown =====
        // Only start new page if viewing all zones, otherwise continue on same page
        if (!selectedZoneId) {
            drawFooter(doc, pageNum.val)
            pageNum.val++
            doc.addPage()
            y = drawHeader(doc, data.year, filterLabels[filter], selectedZone?.zoneName, logoBase64)
        } else {
            // For individual zone, continue on same page with spacing
            y = (doc as any).lastAutoTable?.finalY || y + 10
            y += 12
        }

        y = drawSectionTitle(doc, y, 'MONTHLY PERFORMANCE BREAKDOWN')
        y += 4

        const zoneMonthlyToShow = selectedZoneId
            ? data.zoneMonthly.filter(z => z.zoneId === selectedZoneId)
            : data.zoneMonthly


        zoneMonthlyToShow.forEach((zone, zoneIdx) => {
            if (zoneIdx > 0) y += 8;

            [y, pageNum.val] = needsNewPage(doc, y, 30, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)

            // Zone sub-header
            const zColor = getZoneColor(zone.zoneName, zoneIdx)
            doc.setFillColor(...zColor)
            doc.roundedRect(15, y, pageW - 30, 7, 1.5, 1.5, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(...COLORS.white)
            doc.text(`${zone.zoneName} Zone  |  Target: ${fmtCrLakh(zone.yearlyTarget)}  |  Hit Rate: ${zone.hitRate.toFixed(1)}%`, 20, y + 5)
            y += 12

            const filteredMonths = monthName
                ? zone.monthlyData.filter(m =>
                    m.monthLabel.toLowerCase().includes(monthName.toLowerCase()) ||
                    m.monthLabel.toLowerCase().includes(monthName.substring(0, 3).toLowerCase())
                )
                : zone.monthlyData

            const monthBody = filteredMonths.map(m => [
                m.monthLabel,
                (m.noOfOffers || 0).toString(),
                fmtCrLakh(m.offersValue),
                fmtCrLakh(m.orderReceived),
                fmtCrLakh(m.ordersInHand),
                fmtCrLakh(m.buMonthly),
                m.percentDev !== null ? fmtPct(m.percentDev) : '-',
                fmtCrLakh(m.offerBUMonth),
                m.offerBUMonthDev !== null ? fmtPct(m.offerBUMonthDev) : '-',
            ])

            // Add totals
            const totalNoOfOffers = filteredMonths.reduce((sum, m) => sum + (m.noOfOffers || 0), 0)
            const totalOffersValue = filteredMonths.reduce((sum, m) => sum + (m.offersValue || 0), 0)
            const totalOrderReceived = filteredMonths.reduce((sum, m) => sum + (m.orderReceived || 0), 0)
            const totalOrdersInHand = filteredMonths.reduce((sum, m) => sum + (m.ordersInHand || 0), 0)
            const totalBUMonthly = filteredMonths.reduce((sum, m) => sum + (m.buMonthly || 0), 0)
            const totalOfferBUMonth = filteredMonths.reduce((sum, m) => sum + (m.offerBUMonth || 0), 0)

            monthBody.push([
                'TOTAL',
                totalNoOfOffers.toString(),
                fmtCrLakh(totalOffersValue),
                fmtCrLakh(totalOrderReceived),
                fmtCrLakh(totalOrdersInHand),
                fmtCrLakh(totalBUMonthly),
                '-',
                fmtCrLakh(totalOfferBUMonth),
                '-',
            ])

            autoTable(doc, {
                startY: y,
                head: [['Month', 'No Offers', 'Offers Value', 'Orders Received', 'Orders in Hand', 'BU Monthly', '% Dev', 'Offer BU', 'Dev%']],
                body: monthBody,
                theme: 'grid',
                styles: {
                    fontSize: 7,
                    cellPadding: 2,
                    lineWidth: 0.1,
                    lineColor: [220, 225, 230],
                },
                headStyles: {
                    fillColor: COLORS.headerBg,
                    textColor: COLORS.white,
                    fontSize: 6.5,
                    fontStyle: 'bold',
                    halign: 'center' as const,
                    cellPadding: 2.5,
                },
                bodyStyles: {
                    textColor: COLORS.textBody,
                },
                alternateRowStyles: {
                    fillColor: [250, 252, 255],
                },
                columnStyles: {
                    0: { fontStyle: 'bold' as const, halign: 'left' as const, cellWidth: 22 },
                    1: { halign: 'center' as const, cellWidth: 16 },
                    2: { halign: 'right' as const, cellWidth: 20 },
                    3: { halign: 'right' as const, cellWidth: 20 },
                    4: { halign: 'right' as const, cellWidth: 20 },
                    5: { halign: 'right' as const, cellWidth: 20 },
                    6: { halign: 'center' as const, cellWidth: 18 },
                    7: { halign: 'right' as const, cellWidth: 18 },
                    8: { halign: 'center' as const, cellWidth: 18 },
                },
                didParseCell: function (cellData: any) {
                    // Color deviation columns (% Dev, Dev%)
                    if (cellData.section === 'body' && (cellData.column.index === 6 || cellData.column.index === 8)) {
                        const raw = String(cellData.cell.raw || '')
                        if (raw.startsWith('+')) cellData.cell.styles.textColor = COLORS.positive
                        else if (raw.startsWith('-')) cellData.cell.styles.textColor = COLORS.negative
                        cellData.cell.styles.fontStyle = 'bold'
                    }
                    // Totals row
                    if (cellData.section === 'body' && cellData.row.index === monthBody.length - 1) {
                        cellData.cell.styles.fillColor = zColor
                        cellData.cell.styles.textColor = COLORS.white
                        cellData.cell.styles.fontStyle = 'bold'
                    }
                },
                margin: { left: 15, right: 15 },
            })

            y = (doc as any).lastAutoTable?.finalY || y + 50

            // Product Breakdown for this zone
            if (zone.productBreakdown && zone.productBreakdown.length > 0) {
                y += 10;
                [y, pageNum.val] = needsNewPage(doc, y, 30, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7.5)
                doc.setTextColor(...COLORS.textDark)
                doc.text(`${zone.zoneName} - Product Performance Breakdown`, 18, y)
                y += 3

                const zoneProdBody = zone.productBreakdown.map(p => {
                    const pFilteredMonths = monthName
                        ? p.monthlyData.filter(m =>
                            m.monthLabel.toLowerCase().includes(monthName.toLowerCase()) ||
                            m.monthLabel.toLowerCase().includes(monthName.substring(0, 3).toLowerCase())
                        )
                        : p.monthlyData

                    const pNoOfOffers = pFilteredMonths.reduce((sum, m) => sum + (m.noOfOffers || 0), 0)
                    const pOffersValue = pFilteredMonths.reduce((sum, m) => sum + (m.offersValue || 0), 0)
                    const pOrderReceived = pFilteredMonths.reduce((sum, m) => sum + (m.orderReceived || 0), 0)
                    const pOrdersInHand = pFilteredMonths.reduce((sum, m) => sum + (m.ordersInHand || 0), 0)
                    const pBUMonthly = pFilteredMonths.reduce((sum, m) => sum + (m.buMonthly || 0), 0)
                    const pOfferBUMonth = pFilteredMonths.reduce((sum, m) => sum + (m.offerBUMonth || 0), 0)

                    return [
                        p.productLabel,
                        pNoOfOffers.toString(),
                        fmtCrLakh(pOffersValue),
                        fmtCrLakh(pOrderReceived),
                        fmtCrLakh(pOrdersInHand),
                        fmtCrLakh(pBUMonthly),
                        pFilteredMonths.length === 1 && pFilteredMonths[0].percentDev !== null ? fmtPct(pFilteredMonths[0].percentDev) : '-',
                        fmtCrLakh(pOfferBUMonth),
                        pFilteredMonths.length === 1 && pFilteredMonths[0].offerBUMonthDev !== null ? fmtPct(pFilteredMonths[0].offerBUMonthDev) : '-',
                    ]
                })

                autoTable(doc, {
                    startY: y,
                    head: [['Product Category', 'No Offers', 'Offers Value', 'Orders Received', 'Orders in Hand', 'BU Monthly', '% Dev', 'Offer BU', 'Dev%']],
                    body: zoneProdBody,
                    theme: 'grid',
                    styles: {
                        fontSize: 6.5,
                        cellPadding: 2,
                        lineWidth: 0.1,
                        lineColor: [220, 225, 230],
                    },
                    headStyles: {
                        fillColor: COLORS.kardexMid,
                        textColor: COLORS.white,
                        fontSize: 6.5,
                        fontStyle: 'bold',
                        halign: 'center' as const,
                        cellPadding: 2,
                    },
                    bodyStyles: {
                        textColor: COLORS.textBody,
                    },
                    alternateRowStyles: {
                        fillColor: [250, 252, 255],
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold' as const, halign: 'left' as const, cellWidth: 40 },
                        1: { halign: 'center' as const, cellWidth: 16 },
                        2: { halign: 'right' as const, cellWidth: 26 },
                        3: { halign: 'right' as const, cellWidth: 26 },
                        4: { halign: 'right' as const, cellWidth: 26 },
                        5: { halign: 'right' as const, cellWidth: 26 },
                        6: { halign: 'center' as const, cellWidth: 20 },
                        7: { halign: 'right' as const, cellWidth: 20 },
                        8: { halign: 'center' as const, cellWidth: 20 },
                    },
                    didParseCell: function (cellData: any) {
                        if (cellData.section === 'body' && (cellData.column.index === 6 || cellData.column.index === 8)) {
                            const raw = String(cellData.cell.raw || '')
                            if (raw.startsWith('+')) cellData.cell.styles.textColor = COLORS.positive
                            else if (raw.startsWith('-')) cellData.cell.styles.textColor = COLORS.negative
                            cellData.cell.styles.fontStyle = 'bold'
                        }
                    },
                    margin: { left: 15, right: 15 }
                })
                y = (doc as any).lastAutoTable?.finalY || y + 10
            }
        })

        // ===== Product-wise Analytical Analysis (New Section) =====
        if (data.productTotals && data.productTotals.length > 0) {
            // Aggregation Logic:
            // detailed product breakdown comes from data.zoneMonthly -> productBreakdown
            // We need to aggregate this based on selectedZoneId and selectedMonth

            const targetZones = selectedZoneId
                ? data.zoneMonthly.filter(zm => zm.zoneId === selectedZoneId)
                : data.zoneMonthly

            // Map to store aggregated stats per product
            const productStatsMap = new Map<string, {
                label: string
                ordersReceived: number
                offersValue: number
                ordersInHand: number
                target: number
            }>()

            // Initialize with product labels from global totals to ensure order
            data.productTotals.forEach(p => {
                productStatsMap.set(p.productLabel, {
                    label: p.productLabel,
                    ordersReceived: 0,
                    offersValue: 0,
                    ordersInHand: 0,
                    target: 0
                })
            })

            // Iterate over zones and sum up
            targetZones.forEach(z => {
                if (z.productBreakdown) {
                    z.productBreakdown.forEach(pb => {
                        let stats = productStatsMap.get(pb.productLabel)
                        if (!stats) {
                            stats = {
                                label: pb.productLabel,
                                ordersReceived: 0,
                                offersValue: 0,
                                ordersInHand: 0,
                                target: 0
                            }
                            productStatsMap.set(pb.productLabel, stats)
                        }

                        let pOrdersReceived = 0
                        let pOffersValue = 0
                        let pOrdersInHand = 0
                        let pTarget = 0

                        if (monthName) {
                            // Filter for specific month
                            const filteredMonths = pb.monthlyData.filter(m =>
                                (m.monthLabel && m.monthLabel.toLowerCase().includes(monthName.toLowerCase())) ||
                                (m.month && m.month.toLowerCase().includes(monthName.substring(0, 3).toLowerCase()))
                            )
                            pOrdersReceived = filteredMonths.reduce((sum, m) => sum + (m.orderReceived || 0), 0)
                            pOffersValue = filteredMonths.reduce((sum, m) => sum + (m.offersValue || 0), 0)
                            pOrdersInHand = filteredMonths.reduce((sum, m) => sum + (m.ordersInHand || 0), 0)
                            // Monthly target approximation
                            pTarget = pb.yearlyTarget / 12
                        } else {
                            // Full Year
                            pOrdersReceived = pb.totals.orderReceived
                            pOffersValue = pb.totals.offersValue
                            pOrdersInHand = pb.totals.ordersInHand
                            pTarget = pb.yearlyTarget
                        }

                        stats.ordersReceived += pOrdersReceived
                        stats.offersValue += pOffersValue
                        stats.ordersInHand += pOrdersInHand
                        stats.target += pTarget
                    })
                }
            })

            const aggregatedProducts = Array.from(productStatsMap.values()).map(p => {
                // Hit Rate = Orders Received / Offers Value
                const hitRate = p.offersValue > 0 ? (p.ordersReceived / p.offersValue) * 100 : 0
                return {
                    ...p,
                    hitRate
                }
            })

            // Only proceed if we have data
            if (aggregatedProducts.length > 0) {
                let pY: number
                // Reduced threshold from 95 to 80 to minimize white space
                const [npy, npn2] = needsNewPage(doc, y, 80, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
                pY = npy === y ? npy + 8 : npy
                pageNum.val = npn2

                if (npy === y) pY += 10
                pY = drawSectionTitle(doc, pY, 'PRODUCT CATEGORY PERFORMANCE ANALYSIS', COLORS.kardexDark)
                pY += 4

                // Row 1: Graphical Distribution
                const prodBarData = aggregatedProducts.map((p, i) => ({
                    label: p.label,
                    value: p.ordersReceived,
                    color: getZoneColor(p.label, i + 5) // Use shifted colors for variety
                }))
                drawBarChart(doc, 20, pY, (pageW - 50) / 2 - 5, 55, prodBarData, 'Orders Received by Product Category')

                const prodPieData = aggregatedProducts.map((p, i) => ({
                    label: p.label,
                    value: p.ordersReceived,
                    color: getZoneColor(p.label, i + 5)
                }))
                drawPieChart(doc, pageW / 2 + 30, pY + 30, 20, prodPieData, 'Product Distribution (Value)')

                pY += 85

                    // Row 2: Product Performance Visual List
                    ;[pY, pageNum.val] = needsNewPage(doc, pY, aggregatedProducts.length * 16 + 10, pageNum, data, filter, filterLabels, undefined, logoBase64)

                aggregatedProducts.forEach((p, pi) => {
                    const ach = p.target > 0 ? (p.ordersReceived / p.target) * 100 : 0
                    const pRowY = pY + pi * 16

                    drawPerformanceStrip(doc, 15, pRowY, pageW - 30,
                        p.label,
                        [
                            { label: 'Orders Received', value: fmtCrLakh(p.ordersReceived) },
                            { label: 'Offers Value', value: fmtCrLakh(p.offersValue) },
                            { label: 'Orders in Hand', value: fmtCrLakh(p.ordersInHand) },
                            { label: 'Target', value: fmtCrLakh(p.target) },
                            { label: 'Hit Rate', value: `${p.hitRate.toFixed(1)}%` }
                        ],
                        ach,
                        ach >= 100 ? COLORS.positive : ach >= 75 ? COLORS.warning : COLORS.negative
                    )
                })
                pY += aggregatedProducts.length * 16 + 10
            }
        }
    }

    // ===== Zone Users Breakdown =====
    if (filter === 'zone-users') {

        const usersToShow = selectedZoneId
            ? data.userMonthly.filter(u => {
                const zone = data.zones.find(z => z.zoneId === selectedZoneId)
                return zone ? u.zoneName.toUpperCase() === zone.zoneName.toUpperCase() : true
            })
            : selectedUserId
                ? data.userMonthly.filter(u => u.userId === selectedUserId)
                : data.userMonthly

        // ===== Zone Users Breakdown (One User Per Page) =====
        usersToShow.forEach((user, userIdx) => {
            drawFooter(doc, pageNum.val)
            pageNum.val++
            doc.addPage()
            y = drawHeader(doc, data.year, `${filterLabels[filter]} - ${user.userName}` + (monthName ? ` (${monthName})` : ''), selectedZone?.zoneName || user.zoneName, logoBase64)

            // Start content at a fixed position
            y = 40

            // ===== KPI Summary Cards for Individual User =====
            const filteredMonths = monthName
                ? user.monthlyData.filter(m =>
                    m.monthLabel.toLowerCase().includes(monthName.toLowerCase()) ||
                    m.monthLabel.toLowerCase().includes(monthName.substring(0, 3).toLowerCase())
                )
                : user.monthlyData

            const userNoOfOffers = filteredMonths.reduce((sum, m) => sum + (m.noOfOffers || 0), 0)
            const userOffersValue = filteredMonths.reduce((sum, m) => sum + (m.offersValue || 0), 0)
            const userOrdersReceived = filteredMonths.reduce((sum, m) => sum + (m.orderReceived || 0), 0)
            const userOrdersInHand = filteredMonths.reduce((sum, m) => sum + (m.ordersInHand || 0), 0)
            const totalUserBUMonthly = filteredMonths.reduce((sum, m) => sum + (m.buMonthly || 0), 0)
            const totalUserOfferBUMonth = filteredMonths.reduce((sum, m) => sum + (m.offerBUMonth || 0), 0)

            const userTarget = monthName ? (user.yearlyTarget / 12) : user.yearlyTarget
            const userAchPct = userTarget > 0 ? ((userOrdersReceived / userTarget) * 100) : 0

            const cardW = (pageW - 45) / 4
            const cardH = 30
            const cardGap = 5
            const cardStartX = 15

            drawKPICard(doc, cardStartX, y, cardW, cardH,
                'Total Offers',
                userNoOfOffers.toString(),
                COLORS.accentCyan,
                `Value: ${fmtCrLakh(userOffersValue)}`
            )

            drawKPICard(doc, cardStartX + cardW + cardGap, y, cardW, cardH,
                'Orders Received',
                fmtCrLakh(userOrdersReceived),
                COLORS.accentNeon,
                `${userAchPct.toFixed(1)}% of Target`
            )

            drawKPICard(doc, cardStartX + 2 * (cardW + cardGap), y, cardW, cardH,
                'Orders in Hand',
                fmtCrLakh(userOrdersInHand),
                COLORS.accentOrange,
                `Pipeline value`
            )

            drawKPICard(doc, cardStartX + 3 * (cardW + cardGap), y, cardW, cardH,
                monthName ? 'Monthly Target' : 'Yearly Target',
                fmtCrLakh(userTarget),
                COLORS.accentAmber,
                `Hit Rate: ${user.hitRate.toFixed(1)}%`
            )

            // ===== Achievement Progress Bar =====
            y += cardH + 10
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(...COLORS.textDark)
            doc.text(monthName ? 'Monthly Achievement' : 'Yearly Achievement', 15, y)

            const achColor: [number, number, number] = userAchPct >= 100 ? COLORS.positive : userAchPct >= 75 ? COLORS.warning : COLORS.negative
            doc.setTextColor(...achColor)
            doc.text(`${userAchPct.toFixed(1)}%`, pageW - 15, y, { align: 'right' })

            y += 3
            drawProgressBar(doc, 15, y, pageW - 30, 3.5, userAchPct, achColor)

            y += 8

            // Draw Section Title

            const userMonthBody = filteredMonths.map(m => [
                m.monthLabel,
                (m.noOfOffers || 0).toString(),
                fmtCrLakh(m.offersValue),
                fmtCrLakh(m.orderReceived),
                fmtCrLakh(m.ordersInHand),
                fmtCrLakh(m.buMonthly),
                m.percentDev !== null ? fmtPct(m.percentDev) : '-',
                fmtCrLakh(m.offerBUMonth),
                m.offerBUMonthDev !== null ? fmtPct(m.offerBUMonthDev) : '-',
            ])

            userMonthBody.push([
                'TOTAL',
                userNoOfOffers.toString(),
                fmtCrLakh(userOffersValue),
                fmtCrLakh(userOrdersReceived),
                fmtCrLakh(userOrdersInHand),
                fmtCrLakh(totalUserBUMonthly),
                '-',
                fmtCrLakh(totalUserOfferBUMonth),
                '-',
            ])

            y = drawSectionTitle(doc, y, monthName ? `PERFORMANCE SUMMARY - ${monthName.toUpperCase()}` : `${user.userName} - PERFORMANCE BREAKDOWN`, COLORS.kardexGreen)
            y += 2

            const zColor = getZoneColor(user.zoneName, userIdx)

            autoTable(doc, {
                startY: y,
                head: [['Month', 'No Offers', 'Offers Value', 'Orders Received', 'Orders in Hand', 'BU Monthly', '% Dev', 'Offer BU', 'Dev%']],
                body: userMonthBody,
                theme: 'grid',
                styles: {
                    fontSize: 6.5,
                    cellPadding: 2,
                    lineWidth: 0.1,
                    lineColor: [220, 225, 230],
                },
                headStyles: {
                    fillColor: zColor,
                    textColor: COLORS.white,
                    fontSize: 6.5,
                    fontStyle: 'bold',
                    halign: 'center' as const,
                    cellPadding: 2,
                },
                bodyStyles: {
                    textColor: COLORS.textBody,
                },
                alternateRowStyles: {
                    fillColor: [250, 252, 255],
                },
                columnStyles: {
                    0: { fontStyle: 'bold' as const, halign: 'left' as const, cellWidth: 22 },
                    1: { halign: 'center' as const, cellWidth: 16 },
                    2: { halign: 'right' as const, cellWidth: 20 },
                    3: { halign: 'right' as const, cellWidth: 20 },
                    4: { halign: 'right' as const, cellWidth: 20 },
                    5: { halign: 'right' as const, cellWidth: 20 },
                    6: { halign: 'center' as const, cellWidth: 18 },
                    7: { halign: 'right' as const, cellWidth: 18 },
                    8: { halign: 'center' as const, cellWidth: 18 },
                },
                didParseCell: function (cellData: any) {
                    if (cellData.section === 'body' && (cellData.column.index === 6 || cellData.column.index === 8)) {
                        const raw = String(cellData.cell.raw || '')
                        if (raw.startsWith('+')) cellData.cell.styles.textColor = COLORS.positive
                        else if (raw.startsWith('-')) cellData.cell.styles.textColor = COLORS.negative
                        cellData.cell.styles.fontStyle = 'bold'
                    }
                    if (cellData.section === 'body' && cellData.row.index === userMonthBody.length - 1) {
                        cellData.cell.styles.fillColor = COLORS.kardexDark
                        cellData.cell.styles.textColor = COLORS.white
                        cellData.cell.styles.fontStyle = 'bold'
                    }
                },
                margin: { left: 15, right: 15 },
            })

            y = (doc as any).lastAutoTable?.finalY || y + 5

            // Product breakdown for this user
            if (user.productBreakdown && user.productBreakdown.length > 0) {
                // Check if we can fit the product breakdown on the current page
                [y, pageNum.val] = needsNewPage(doc, y, 50, pageNum, data, filter, filterLabels, user.zoneName, logoBase64)

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7.5)
                doc.setTextColor(...COLORS.textDark)
                doc.text(`${user.userName} - Product Performance Analysis`, 15, y + 6)
                y += 10

                const userProdBody = user.productBreakdown.map(p => {
                    const pFilteredMonths = monthName
                        ? p.monthlyData.filter(m =>
                            m.monthLabel.toLowerCase().includes(monthName.toLowerCase()) ||
                            m.monthLabel.toLowerCase().includes(monthName.substring(0, 3).toLowerCase())
                        )
                        : p.monthlyData

                    const pNoOfOffers = pFilteredMonths.reduce((sum, m) => sum + (m.noOfOffers || 0), 0)
                    const pOffersValue = pFilteredMonths.reduce((sum, m) => sum + (m.offersValue || 0), 0)
                    const pOrderReceived = pFilteredMonths.reduce((sum, m) => sum + (m.orderReceived || 0), 0)
                    const pOrdersInHand = pFilteredMonths.reduce((sum, m) => sum + (m.ordersInHand || 0), 0)
                    const pBUMonthly = pFilteredMonths.reduce((sum, m) => sum + (m.buMonthly || 0), 0)
                    const pOfferBUMonth = pFilteredMonths.reduce((sum, m) => sum + (m.offerBUMonth || 0), 0)

                    return [
                        p.productLabel,
                        pNoOfOffers.toString(),
                        fmtCrLakh(pOffersValue),
                        fmtCrLakh(pOrderReceived),
                        fmtCrLakh(pOrdersInHand),
                        fmtCrLakh(pBUMonthly),
                        pFilteredMonths.length === 1 && pFilteredMonths[0].percentDev !== null ? fmtPct(pFilteredMonths[0].percentDev) : '-',
                        fmtCrLakh(pOfferBUMonth),
                        pFilteredMonths.length === 1 && pFilteredMonths[0].offerBUMonthDev !== null ? fmtPct(pFilteredMonths[0].offerBUMonthDev) : '-',
                    ]
                })

                autoTable(doc, {
                    startY: y,
                    head: [['Product Category', 'No Offers', 'Offers Value', 'Orders Received', 'Orders in Hand', 'BU Monthly', '% Dev', 'Offer BU', 'Dev%']],
                    body: userProdBody,
                    theme: 'grid',
                    styles: {
                        fontSize: 6.5,
                        cellPadding: 2,
                        lineWidth: 0.1,
                        lineColor: [220, 225, 230],
                    },
                    headStyles: {
                        fillColor: COLORS.kardexMid,
                        textColor: COLORS.white,
                        fontSize: 6.5,
                        fontStyle: 'bold',
                        halign: 'center' as const,
                        cellPadding: 2,
                    },
                    bodyStyles: {
                        textColor: COLORS.textBody,
                    },
                    alternateRowStyles: {
                        fillColor: [250, 252, 255],
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold' as const, halign: 'left' as const, cellWidth: 40 },
                        1: { halign: 'center' as const, cellWidth: 16 },
                        2: { halign: 'right' as const, cellWidth: 26 },
                        3: { halign: 'right' as const, cellWidth: 26 },
                        4: { halign: 'right' as const, cellWidth: 26 },
                        5: { halign: 'right' as const, cellWidth: 26 },
                        6: { halign: 'center' as const, cellWidth: 20 },
                        7: { halign: 'right' as const, cellWidth: 20 },
                        8: { halign: 'center' as const, cellWidth: 20 },
                    },
                    didParseCell: function (cellData: any) {
                        // Colored deviation columns (% Dev, Dev%)
                        if (cellData.section === 'body' && (cellData.column.index === 6 || cellData.column.index === 8)) {
                            const raw = String(cellData.cell.raw || '')
                            if (raw.startsWith('+')) cellData.cell.styles.textColor = COLORS.positive
                            else if (raw.startsWith('-')) cellData.cell.styles.textColor = COLORS.negative
                            cellData.cell.styles.fontStyle = 'bold'
                        }
                    },
                    margin: { left: 15, right: 15 }
                })
                y = (doc as any).lastAutoTable?.finalY || y + 8
            }
        })

        // ===== Zone Users Global Analytics =====
        if (usersToShow.length > 1) {
            drawFooter(doc, pageNum.val)
            pageNum.val++
            doc.addPage()
            let uAY = drawHeader(doc, data.year, filterLabels[filter], selectedZone?.zoneName, logoBase64)

            uAY = drawSectionTitle(doc, uAY, 'USER PERFORMANCE ANALYTICS')
            uAY += 4

            // Bar chart — orders by user
            const userBarData = usersToShow.slice(0, 8).map((u, i) => ({
                label: u.userName,
                value: u.totals.orderReceived,
                color: getZoneColor(u.zoneName, i),
            }))
            drawBarChart(doc, 20, uAY, (pageW - 50) / 2 - 5, 55, userBarData, 'Orders Received by User')

            // Pie — offers value by user
            const userPieData = usersToShow.slice(0, 8).map((u, i) => ({
                label: u.userName,
                value: u.totals.offersValue,
                color: getZoneColor(u.zoneName, i),
            }))
            drawPieChart(doc, pageW / 2 + 30, uAY + 30, 18, userPieData, 'Offers Value by User')

            uAY += 82

                // ===== User Achievement Gauge Meters =====
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 60, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'USER ACHIEVEMENT GAUGES', COLORS.kardexGreen)
            uAY += 4

            const sortedUsersForGauges = [...usersToShow].sort((a, b) => {
                const achA = a.yearlyTarget > 0 ? a.totals.orderReceived / a.yearlyTarget : 0
                const achB = b.yearlyTarget > 0 ? b.totals.orderReceived / b.yearlyTarget : 0
                return achB - achA
            })

            const gaugesPerRow = 4
            const gaugeW = (pageW - 30) / gaugesPerRow
            const gaugeR = 16
            const cardH = gaugeR * 2 + 28
            const rowH = cardH + 10

            sortedUsersForGauges.forEach((user, i) => {
                const col = i % gaugesPerRow

                // If we are starting a new row (but not the first row)
                if (col === 0 && i > 0) {
                    uAY += rowH
                    const [ny, npn] = needsNewPage(doc, uAY, rowH, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
                    if (ny < uAY) {
                        // We jumped to a new page
                        uAY = ny
                    }
                    pageNum.val = npn
                }

                const cx = 15 + col * gaugeW + gaugeW / 2
                const cy = uAY + gaugeR + 8
                const pct = user.yearlyTarget > 0 ? (user.totals.orderReceived / user.yearlyTarget) * 100 : 0

                // Dark card bg
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(15 + col * gaugeW + 2, uAY, gaugeW - 4, cardH, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.roundedRect(15 + col * gaugeW + 2, uAY, gaugeW - 4, cardH, 3, 3, 'S')

                // Outer ring decoration
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.circle(cx, cy, gaugeR + 2, 'S')

                // Track arc (dark)
                const segments = 40
                doc.setDrawColor(...COLORS.darkTrack)
                doc.setLineWidth(4)
                for (let s = 0; s < segments; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(
                        cx + gaugeR * Math.cos(a1), cy + gaugeR * Math.sin(a1),
                        cx + gaugeR * Math.cos(a2), cy + gaugeR * Math.sin(a2)
                    )
                }

                // Fill arc (colored, thicker)
                const fillPct = Math.min(pct / 100, 1)
                const fillSegs = Math.floor(fillPct * segments)
                const gColor: [number, number, number] = pct >= 100 ? COLORS.positive : pct >= 75 ? COLORS.warning : COLORS.negative
                doc.setDrawColor(...gColor)
                doc.setLineWidth(4)
                for (let s = 0; s < fillSegs; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(
                        cx + gaugeR * Math.cos(a1), cy + gaugeR * Math.sin(a1),
                        cx + gaugeR * Math.cos(a2), cy + gaugeR * Math.sin(a2)
                    )
                }

                // Percentage text in center
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(13)
                doc.setTextColor(...gColor)
                doc.text(`${pct.toFixed(0)}%`, cx, cy + 2, { align: 'center' })

                // User name
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textDark)
                doc.text(user.userName.substring(0, 20), cx, cy + gaugeR + 8, { align: 'center' })

                // Target value
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`Target: ${fmtCrLakh(user.yearlyTarget)}`, cx, cy + gaugeR + 13, { align: 'center' })
                doc.text(`Won: ${fmtCrLakh(user.totals.orderReceived)}`, cx, cy + gaugeR + 18, { align: 'center' })
            })

            uAY += rowH + 10

                // ===== Offers vs Orders Comparison =====
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 65, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'USER COMPARISON: OFFERS vs ORDERS vs TARGET', COLORS.accentCyan)
            uAY += 4

            // Dark card bg
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15, uAY, pageW - 30, usersToShow.length * 13 + 14, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.setLineWidth(0.3)
            doc.roundedRect(15, uAY, pageW - 30, usersToShow.length * 13 + 14, 3, 3, 'S')

            // Legend
            const legendStartX = pageW - 120
            const legendItems = [
                { label: 'Offers Value', color: COLORS.kardexLight },
                { label: 'Orders Received', color: COLORS.accentNeon },
                { label: 'Target', color: COLORS.accentAmber },
            ]
            legendItems.forEach((item, li) => {
                doc.setFillColor(...item.color)
                doc.roundedRect(legendStartX + li * 38, uAY + 2, 5, 4, 1, 1, 'F')
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(item.label, legendStartX + li * 38 + 7, uAY + 5.5)
            })

            uAY += 10
            const hBarMaxVal = Math.max(...usersToShow.flatMap(u => [u.totals.offersValue, u.totals.orderReceived, u.yearlyTarget]), 1)
            const hBarW = pageW - 90

            usersToShow.forEach((user, i) => {
                const rowY = uAY + i * 13

                // User label — bright white
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textDark)
                doc.text(user.userName, 20, rowY + 4)

                const barStartX = 48
                const barH = 3

                // Offers bar
                const offersW = (user.totals.offersValue / hBarMaxVal) * hBarW
                doc.setFillColor(...COLORS.kardexLight)
                doc.roundedRect(barStartX, rowY, Math.max(offersW, 1), barH, 1, 1, 'F')

                // Orders bar
                const ordersW = (user.totals.orderReceived / hBarMaxVal) * hBarW
                doc.setFillColor(...COLORS.accentNeon)
                doc.roundedRect(barStartX, rowY + 4, Math.max(ordersW, 1), barH, 1, 1, 'F')

                // Target marker — diamond shape
                const targetX = barStartX + (user.yearlyTarget / hBarMaxVal) * hBarW
                if (user.yearlyTarget > 0) {
                    doc.setDrawColor(...COLORS.accentAmber)
                    doc.setLineWidth(0.8)
                    doc.line(targetX, rowY - 1, targetX, rowY + 9)
                    doc.setFillColor(...COLORS.accentAmber)
                    doc.triangle(targetX - 1.5, rowY - 1, targetX + 1.5, rowY - 1, targetX, rowY + 0.5, 'F')
                }

                // Values on right — bright silver
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(fmtCrLakh(user.totals.offersValue), barStartX + Math.max(offersW, 1) + 2, rowY + 3)
                doc.text(fmtCrLakh(user.totals.orderReceived), barStartX + Math.max(ordersW, 1) + 2, rowY + 7)
            })

            uAY += usersToShow.length * 13 + 18

                // ===== Hit Rate Analysis =====
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 60, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'HIT RATE ANALYSIS & FUNNEL DISTRIBUTION', COLORS.kardexMid)
            uAY += 4

            // Hit rate horizontal bars (left half) — dark card
            const hrCardW = (pageW - 40) / 2
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15, uAY, hrCardW, usersToShow.length * 11 + 12, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.setLineWidth(0.3)
            doc.roundedRect(15, uAY, hrCardW, usersToShow.length * 11 + 12, 3, 3, 'S')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(...COLORS.textDark)
            doc.text('Hit Rate by User', 20, uAY + 7)

            usersToShow.forEach((user, i) => {
                const rowY = uAY + 12 + i * 11
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textDark)
                doc.text(user.userName, 20, rowY + 4)

                const maxHr = Math.max(...usersToShow.map(u => u.hitRate), 100)
                const hrBarW = hrCardW - 65
                const filled = (user.hitRate / maxHr) * hrBarW
                const hrColor: [number, number, number] = user.hitRate >= 50 ? COLORS.positive : user.hitRate >= 30 ? COLORS.warning : COLORS.negative

                doc.setFillColor(...COLORS.darkTrack)
                doc.roundedRect(55, rowY + 1, hrBarW, 4, 2, 2, 'F')
                doc.setFillColor(...hrColor)
                doc.roundedRect(55, rowY + 1, Math.max(filled, 1), 4, 2, 2, 'F')

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6)
                doc.setTextColor(...hrColor)
                doc.text(`${user.hitRate.toFixed(1)}%`, 55 + hrBarW + 3, rowY + 5)
            })

            // Open Funnel Pie Chart (right half)
            const funnelPieData = usersToShow.slice(0, 8).map((u, i) => ({
                label: u.userName,
                value: u.totals.ordersInHand,
                color: getZoneColor(u.zoneName, i),
            }))
            drawPieChart(doc, pageW / 2 + 45, uAY + 30, 16, funnelPieData, 'Open Funnel Distribution')

            uAY += Math.max(usersToShow.length * 11 + 24, 72)

                // Key Insights cards
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 50, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'KEY INSIGHTS & TOP PERFORMERS', COLORS.accentOrange)
            uAY += 4

            const sortedUsers = [...usersToShow].sort((a, b) => {
                const achA = a.yearlyTarget > 0 ? a.totals.orderReceived / a.yearlyTarget : 0
                const achB = b.yearlyTarget > 0 ? b.totals.orderReceived / b.yearlyTarget : 0
                return achB - achA
            })
            const insCardW = (pageW - 40) / 3
            const insH = 38

            // Best performer — dark glass
            const best = sortedUsers[0]
            if (best) {
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(15, uAY, insCardW, insH, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.roundedRect(15, uAY, insCardW, insH, 3, 3, 'S')
                doc.setFillColor(...COLORS.positive)
                doc.rect(15, uAY, insCardW, 2.5, 'F')
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text('TOP PERFORMER', 20, uAY + 9)
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(11)
                doc.setTextColor(...COLORS.positive)
                doc.text(best.userName.substring(0, 20), 20, uAY + 19)
                const bestAch = best.yearlyTarget > 0 ? ((best.totals.orderReceived / best.yearlyTarget) * 100).toFixed(1) : '0'
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`Achievement: ${bestAch}% | Zone: ${best.zoneName}`, 20, uAY + 26)
                doc.text(`Orders: ${fmtCrLakh(best.totals.orderReceived)} | Hit Rate: ${best.hitRate.toFixed(1)}%`, 20, uAY + 32)
            }

            // Highest offers — dark glass
            const sortedByOffers = [...usersToShow].sort((a, b) => b.totals.offersValue - a.totals.offersValue)
            const topOffer = sortedByOffers[0]
            if (topOffer) {
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(15 + insCardW + 5, uAY, insCardW, insH, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.roundedRect(15 + insCardW + 5, uAY, insCardW, insH, 3, 3, 'S')
                doc.setFillColor(...COLORS.accentCyan)
                doc.rect(15 + insCardW + 5, uAY, insCardW, 2.5, 'F')
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text('HIGHEST PIPELINE', 20 + insCardW + 5, uAY + 9)
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(11)
                doc.setTextColor(...COLORS.accentCyan)
                doc.text(topOffer.userName.substring(0, 20), 20 + insCardW + 5, uAY + 19)
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`Offers: ${fmtCrLakh(topOffer.totals.offersValue)} | Zone: ${topOffer.zoneName}`, 20 + insCardW + 5, uAY + 26)
                doc.text(`Funnel: ${fmtCrLakh(topOffer.totals.ordersInHand)}`, 20 + insCardW + 5, uAY + 32)
            }

            // Needs attention — dark glass
            const worst = sortedUsers[sortedUsers.length - 1]
            if (worst && sortedUsers.length > 1) {
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(15 + 2 * (insCardW + 5), uAY, insCardW, insH, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.roundedRect(15 + 2 * (insCardW + 5), uAY, insCardW, insH, 3, 3, 'S')
                doc.setFillColor(...COLORS.negative)
                doc.rect(15 + 2 * (insCardW + 5), uAY, insCardW, 2.5, 'F')
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text('NEEDS ATTENTION', 20 + 2 * (insCardW + 5), uAY + 9)
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(11)
                doc.setTextColor(...COLORS.negative)
                doc.text(worst.userName.substring(0, 20), 20 + 2 * (insCardW + 5), uAY + 19)
                const worstAch = worst.yearlyTarget > 0 ? ((worst.totals.orderReceived / worst.yearlyTarget) * 100).toFixed(1) : '0'
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`Achievement: ${worstAch}% | Zone: ${worst.zoneName}`, 20 + 2 * (insCardW + 5), uAY + 26)
                doc.text(`Balance: ${fmtCrLakh(worst.yearlyTarget - worst.totals.orderReceived)}`, 20 + 2 * (insCardW + 5), uAY + 32)
            }

            uAY += insH + 14

                // User achievement visual list
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, usersToShow.length * 16 + 10, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'USER ACHIEVEMENT COMPARISON', COLORS.kardexGreen)
            uAY += 4

            usersToShow.forEach((user, i) => {
                const uFilteredMonths = monthName
                    ? user.monthlyData.filter(m =>
                        m.monthLabel.toLowerCase().includes(monthName.toLowerCase()) ||
                        m.monthLabel.toLowerCase().includes(monthName.substring(0, 3).toLowerCase())
                    )
                    : user.monthlyData

                const sOrdersReceived = uFilteredMonths.reduce((sum, m) => sum + (m.orderReceived || 0), 0)
                const sOffersValue = uFilteredMonths.reduce((sum, m) => sum + (m.offersValue || 0), 0)
                const sOrdersInHand = uFilteredMonths.reduce((sum, m) => sum + (m.ordersInHand || 0), 0)
                const sTarget = monthName ? user.yearlyTarget / 12 : user.yearlyTarget

                const uAch = sTarget > 0 ? (sOrdersReceived / sTarget) * 100 : 0
                const uColor: [number, number, number] = uAch >= 100 ? COLORS.positive : uAch >= 75 ? COLORS.warning : COLORS.negative
                const userRowY = uAY + i * 16

                drawPerformanceStrip(doc, 15, userRowY, pageW - 30,
                    user.userName,
                    [
                        { label: 'Orders Received', value: fmtCrLakh(sOrdersReceived) },
                        { label: 'Offers Value', value: fmtCrLakh(sOffersValue) },
                        { label: 'Orders in Hand', value: fmtCrLakh(sOrdersInHand) },
                        { label: 'Target', value: fmtCrLakh(sTarget) },
                        { label: 'Hit Rate', value: `${user.hitRate.toFixed(1)}%` }
                    ],
                    uAch,
                    uColor
                )
            })
            uAY += usersToShow.length * 16 + 10
        }
    }

    // Final footer
    drawFooter(doc, pageNum.val)

    // Generate filename
    const filterSlug = filter.replace(/-/g, '_')
    const zoneSlug = selectedZone ? `_${selectedZone.zoneName}` : ''
    const filename = `Forecast_Report_${data.year}_${filterSlug}${zoneSlug}_${new Date().toISOString().slice(0, 10)}.pdf`

    doc.save(filename)
}
