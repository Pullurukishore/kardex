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

    // Embed Kardex Brand Logo directly on the header (no rectangle box)
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', 10, 5, 30, 14)
        } catch {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(12)
            doc.setTextColor(...COLORS.white)
            doc.text('KARDEX', 12, 15)
        }
    } else {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...COLORS.white)
        doc.text('KARDEX', 12, 15)
    }

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...COLORS.white)
    doc.text('Forecast Analytics Report', 45, 13)

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
    doc.setFontSize(9.5)
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

    // Top accent bar — full width, thicker
    doc.setFillColor(...accentColor)
    doc.rect(x, y, w, 3, 'F')

    // Label — muted text, larger
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(label.toUpperCase(), x + 6, y + 12)

    // Value — dark Kardex blue, much larger
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...COLORS.textDark)
    doc.text(value, x + 6, y + 26)

    // SubLabel — accent color, larger
    if (subLabel) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...accentColor)
        doc.text(subLabel, x + 6, y + 33)
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
    doc.roundedRect(x - 4, y - 10, w + 8, h + 20, 3, 3, 'F')
    doc.setDrawColor(...COLORS.cardBorder)
    doc.setLineWidth(0.3)
    doc.roundedRect(x - 4, y - 10, w + 8, h + 20, 3, 3, 'S')

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.textDark)
    doc.text(title, x, y)
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(x, y + 2, 28, 0.6, 'F')

    const chartY = y + 10
    const chartH = h - 18
    const maxVal = Math.max(...data.map(d => d.value), 1)
    const barGap = 5
    const totalGap = (data.length - 1) * barGap
    const barW = Math.min((w - totalGap) / data.length, 25)
    const startX = x + (w - (data.length * barW + totalGap)) / 2

    // Horizontal grid lines
    doc.setDrawColor(...COLORS.gridLine)
    doc.setLineWidth(0.15)
    for (let g = 1; g <= 4; g++) {
        const gy = chartY + chartH - (g / 5) * (chartH - 10)
        doc.line(x, gy, x + w, gy)
        // Grid value labels
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5)
        doc.setTextColor(...COLORS.textLight)
        doc.text(fmtCrLakh(maxVal * g / 5), x - 2, gy + 1, { align: 'right' })
    }

    data.forEach((item, i) => {
        const bx = startX + i * (barW + barGap)
        const barH = Math.max((item.value / maxVal) * (chartH - 10), 2)
        const by = chartY + chartH - barH

        // Bar with rounded top
        doc.setFillColor(...item.color)
        doc.roundedRect(bx, by, barW, barH, 2, 2, 'F')

        // Value on top
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.textDark)
        doc.text(fmtCrLakh(item.value), bx + barW / 2, by - 2.5, { align: 'center' })

        // Label at bottom - angled for better fit
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(...COLORS.textBody)
        let label = item.label
        if (label.length > 20) label = label.substring(0, 18) + '..'

        // Use rotation if more than 5 items
        if (data.length > 5) {
            doc.text(label, bx + barW / 2, chartY + chartH + 3.5, { angle: -25 })
        } else {
            doc.text(label, bx + barW / 2, chartY + chartH + 5, { align: 'center' })
        }
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
    const rowH = 11.5

    // Background
    doc.setFillColor(...COLORS.offWhite)
    doc.roundedRect(x, y, w, rowH, 1.5, 1.5, 'F')

    // Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.textDark)
    doc.text(label, x + 5, y + rowH / 2 + 1)

    // Mini Achievement Bar
    const barX = x + 40
    const barW = 35
    const barH = 2.5
    doc.setFillColor(...COLORS.darkTrack)
    doc.roundedRect(barX, y + rowH / 2 - 1.25, barW, barH, 1.25, 1.25, 'F')

    const fillW = Math.max(Math.min(percentage / 100, 1) * barW, 0)
    if (fillW > 0) {
        doc.setFillColor(...color)
        doc.roundedRect(barX, y + rowH / 2 - 1.25, fillW, barH, 1.25, 1.25, 'F')
    }

    doc.setFontSize(5.5)
    doc.setTextColor(...color)
    doc.text(`${percentage.toFixed(1)}%`, barX + barW + 2, y + rowH / 2 + 1)

    // Metrics Columns
    const metricStartX = x + 90
    const colGap = 22
    metrics.forEach((m, minx) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5)
        doc.setTextColor(...COLORS.textMuted)
        doc.text(m.label.toUpperCase(), metricStartX + minx * colGap, y + 4)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...COLORS.textDark)
        doc.text(m.value, metricStartX + minx * colGap, y + 9)
    })
}

/**
 * High-density horizontal row for product performance
 * Shows all 8 fields in a clean grid-aligned layout
 */
function drawProductPerformanceRow(
    doc: any,
    x: number, y: number, w: number,
    label: string,
    data: {
        noOfOffers: string;
        offersValue: string;
        target: string;
        orderReceived: string;
        ordersInHand: string;
        buMonthly: string;
        percentDev: string;
        offerBUMonth: string;
        offerBUMonthDev: string;
    },
    achPct: number,
    color: [number, number, number]
) {
    const rho = 12.5
    // Card background
    doc.setFillColor(...COLORS.offWhite)
    doc.roundedRect(x, y, w, rho, 1.5, 1.5, 'F')

    // Left Accent line
    doc.setFillColor(...color)
    doc.rect(x + 0.5, y + 0.8, 1.2, rho - 1.6, 'F')

    // Category Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.textDark)
    doc.text(label.substring(0, 24), x + 4, y + 4.5)

    // Achievement Mini Bar
    const barX = x + 4
    const barW = 45
    const barH = 2.2
    doc.setFillColor(...COLORS.darkTrack)
    doc.roundedRect(barX, y + 7.5, barW, barH, 1.1, 1.1, 'F')
    const fillW = Math.max(Math.min(achPct / 100, 1) * barW, 0)
    if (fillW > 0) {
        doc.setFillColor(...color)
        doc.roundedRect(barX, y + 7.5, fillW, barH, 1.1, 1.1, 'F')
    }
    doc.setFontSize(5)
    doc.setTextColor(...color)
    doc.text(`${achPct.toFixed(0)}%`, barX + barW + 2, y + 9.3)

    // Metrics Columns - Expanded horizontally to fit 9 fields
    const startX = x + 58
    const colGap = 23
    const fields = [
        { l: 'OFF', v: data.noOfOffers },
        { l: 'VAL', v: data.offersValue },
        { l: 'TAR', v: data.target },
        { l: 'WON', v: data.orderReceived },
        { l: 'FUN', v: data.ordersInHand },
        { l: 'BU/M', v: data.buMonthly },
        { l: '% DEV', v: data.percentDev },
        { l: 'O-BU', v: data.offerBUMonth },
        { l: '% DEV', v: data.offerBUMonthDev }
    ]

    fields.forEach((f, fi) => {
        const fx = startX + fi * colGap

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(4.5)
        doc.setTextColor(...COLORS.textMuted)
        doc.text(f.l, fx, y + 4.5)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)

        // Color coding for percentages
        if (f.l.includes('%') || f.l.includes('DV')) {
            if (f.v.startsWith('+')) doc.setTextColor(...COLORS.positive)
            else if (f.v.startsWith('-')) doc.setTextColor(...COLORS.negative)
            else doc.setTextColor(...COLORS.textDark)
        } else {
            doc.setTextColor(...COLORS.textDark)
        }

        doc.text(f.v, fx, y + 10)
    })
}

function drawPieChart(
    doc: any,
    centerX: number, centerY: number, radius: number,
    data: { label: string; value: number; color: [number, number, number] }[],
    title: string
) {
    // White card background - dynamic height for legends
    const itemsPerCol = 7
    const cols = Math.ceil(data.length / itemsPerCol)
    const colW = 38
    const cardW = radius * 2 + (cols * colW) + 15
    const cardH = Math.max(radius * 2 + 20, (Math.min(data.length, itemsPerCol) * 8.5) + 20)

    doc.setFillColor(...COLORS.cardBg)
    doc.roundedRect(centerX - radius - 8, centerY - radius - 16, cardW, cardH, 3, 3, 'F')
    doc.setDrawColor(...COLORS.cardBorder)
    doc.setLineWidth(0.3)
    doc.roundedRect(centerX - radius - 8, centerY - radius - 16, cardW, cardH, 3, 3, 'S')

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.textDark)
    doc.text(title, centerX - radius, centerY - radius - 7)
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(centerX - radius, centerY - radius - 5, 26, 0.5, 'F')

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
    doc.circle(centerX, centerY, radius * 0.52, 'F')

    // Center label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.textDark)
    doc.text('Total', centerX, centerY - 2, { align: 'center' })
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.headerBg)
    doc.text(fmtCrLakh(total), centerX, centerY + 5, { align: 'center' })

    // Legend
    const legendX = centerX + radius + 8
    data.forEach((item, idx) => {
        const col = Math.floor(idx / itemsPerCol)
        const row = idx % itemsPerCol
        const lx = legendX + col * colW
        const ly = centerY - radius + 8 + row * 8.5

        doc.setFillColor(...item.color)
        doc.roundedRect(lx, ly - 2.5, 5, 5, 1, 1, 'F')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.textBody)
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'

        // Truncate labels if too long
        let label = item.label
        if (label.length > 18) label = label.substring(0, 16) + '..'

        doc.text(`${label} (${pct}%)`, lx + 7, ly + 2)
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
    const cardH = 36
    const cardGap = 5
    const cardStartX = 15

    drawKPICard(doc, cardStartX, y, cardW, cardH,
        'Total Offers',
        fmtNum(displayTotals.noOfOffers),
        COLORS.accentCyan,
        `Funnel: ${fmtCrLakh(displayTotals.offersValue)}`
    )

    drawKPICard(doc, cardStartX + cardW + cardGap, y, cardW, cardH,
        'Orders Won',
        fmtCrLakh(displayTotals.ordersReceived),
        COLORS.accentNeon,
        `${achPct.toFixed(1)}% of Target Achieved`
    )

    drawKPICard(doc, cardStartX + 2 * (cardW + cardGap), y, cardW, cardH,
        'Open Funnel',
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
    y += cardH + 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.textDark)
    doc.text('Target Achievement', 15, y)

    const achColor: [number, number, number] = achPct >= 100 ? COLORS.positive : achPct >= 75 ? COLORS.warning : COLORS.negative
    doc.setTextColor(...achColor)
    doc.text(`${achPct.toFixed(1)}%`, pageW - 15, y, { align: 'right' })

    y += 3
    drawProgressBar(doc, 15, y, pageW - 30, 4, achPct, achColor)

    y += 4

    // ===== Zone Performance Cards =====
    if (filter === 'zone-wise') {
        y = drawSectionTitle(doc, y, 'ZONE PERFORMANCE SUMMARY')
        y += 2

        const zonesToShow = selectedZoneId
            ? data.zones.filter(z => z.zoneId === selectedZoneId)
            : data.zones

        // Calculate zone data (same logic as before)
        const zoneCardData = zonesToShow.map(z => {
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
            const zBalance = zTarget - zOrdersReceived

            return { zone: z, zNoOfOffers, zOffersValue, zOrdersReceived, zOpenFunnel, zTarget, zAch, zBalance }
        })

        // ===== Premium Zone Performance Leaderboard =====
        const rowH = 15
        const headerH = 8
        const tableW = pageW - 30

        // Draw Table Header
        doc.setFillColor(...COLORS.headerBg)
        doc.roundedRect(15, y, tableW, headerH, 1, 1, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.white)

        const colTitleX = [22, 60, 118, 168, 225]
        const colTitles = ['ZONE', 'ACHIEVEMENT', 'OFFER PIPELINE', 'PERFORMANCE', 'TARGET']
        colTitles.forEach((title, i) => {
            doc.text(title, colTitleX[i], y + 5.5)
        })

        y += headerH + 1.5

        zoneCardData.forEach((zd, idx) => {
            // Page break check — use a temporary array to avoid comma operator issues in some environments
            const pageBreakCheck: [number, number] = needsNewPage(doc, y, rowH + 5, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64);
            y = pageBreakCheck[0];
            pageNum.val = pageBreakCheck[1];
            if (y === drawHeader(doc, data.year, filterLabels[filter], selectedZone?.zoneName, logoBase64)) {
                // Redraw header on new page
                doc.setFillColor(...COLORS.headerBg)
                doc.roundedRect(15, y, tableW, headerH, 1, 1, 'F')
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.white)
                colTitles.forEach((title, i) => doc.text(title, colTitleX[i], y + 5.5))
                y += headerH + 1.5
            }

            const zColor = getZoneColor(zd.zone.zoneName, idx)
            const achColor: [number, number, number] = zd.zAch >= 100 ? COLORS.positive : zd.zAch >= 75 ? COLORS.warning : COLORS.negative

            // Row Background (zebra striping) - Kardex brand off-white
            if (idx % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(15, y, tableW, rowH, 0.5, 0.5, 'F');
            }

            // Left Status Rail — wider for impact
            doc.setFillColor(...zColor);
            doc.rect(15, y, 2, rowH, 'F');

            // 1. Zone Info
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10); // Slightly smaller
            doc.setTextColor(...COLORS.textDark);
            doc.text(zd.zone.zoneName, 22, y + 9);

            // 2. Achievement Mini-Dashboard
            const barW: number = 32;
            const barX: number = 60;
            const barY: number = y + 9.5;

            // Progress Track
            doc.setFillColor(...COLORS.darkTrack);
            doc.roundedRect(barX, barY - 1, barW, 3, 1.5, 1.5, 'F'); // Thicker bar

            // Progress Fill
            const fillW: number = Math.max(Math.min(zd.zAch / 100, 1) * barW, 0);
            if (fillW > 0) {
                doc.setFillColor(...achColor);
                doc.roundedRect(barX, barY - 1, fillW, 3, 1.5, 1.5, 'F');
            }

            // Pct Text
            doc.setFontSize(9); // Slightly smaller
            doc.setTextColor(...achColor);
            doc.text(`${zd.zAch.toFixed(1)}%`, barX + barW + 4, barY + 1.2);

            // 3. Offer Pipeline & Performance Data Points
            const drawDataPoint = (lbl: string, val: string, mx: number, vCol?: [number, number, number]) => {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.setTextColor(...COLORS.textLight);
                doc.text(lbl, mx, y + 5);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(...(vCol || COLORS.textDark));
                doc.text(val, mx, y + 10.5);
            };

            // Column Mapping: No of offers (118), Offers value (142)
            drawDataPoint('No of offers', zd.zNoOfOffers.toString(), 118);
            drawDataPoint('Offers value', fmtCrLakh(zd.zOffersValue), 142);

            // Column Mapping: Won (168), Funnel (195)
            drawDataPoint('WON', fmtCrLakh(zd.zOrdersReceived), 168, COLORS.positive);
            drawDataPoint('FUNNEL', fmtCrLakh(zd.zOpenFunnel), 195, COLORS.accentOrange);

            // Column Mapping: Target (225)
            drawDataPoint('TARGET', fmtCrLakh(zd.zTarget), 225, COLORS.accentAmber);

            // Row Separator
            doc.setDrawColor(...COLORS.cardBorder);
            doc.setLineWidth(0.12);
            doc.line(15, y + rowH, 15 + tableW, y + rowH);

            y += rowH;
        })

        y += 1; // Tighter gap

        // Totals summary strip (if showing all zones)
        if (!selectedZoneId && zonesToShow.length > 1) {
            const totalDevPct = displayTotals.yearlyTarget > 0 ? ((displayTotals.ordersReceived / displayTotals.yearlyTarget) * 100 - 100) : 0
            const totalBalance = displayTotals.yearlyTarget - displayTotals.ordersReceived
            const tAch = displayTotals.yearlyTarget > 0 ? (displayTotals.ordersReceived / displayTotals.yearlyTarget) * 100 : 0

            const totalBarH: number = 14;
            // Prevent Grand Total from jumping to a new page unless strictly necessary
            const pageH = doc.internal.pageSize.getHeight();
            if (y + totalBarH > pageH - 10) { // Slightly looser check to fit on Page 1
                const totalPageResult: [number, number] = needsNewPage(doc, y, totalBarH + 5, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64);
                y = totalPageResult[0];
                pageNum.val = totalPageResult[1];
            }

            // Totals bar background
            doc.setFillColor(...COLORS.headerBg)
            doc.roundedRect(15, y, pageW - 30, totalBarH, 1.5, 1.5, 'F')

            // Top accent line
            doc.setFillColor(...COLORS.accentCyan)
            doc.rect(15, y, pageW - 30, 0.4, 'F')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            doc.setTextColor(...COLORS.white)
            doc.text('GRAND TOTAL', 22, y + 10);

            const tColX = [118, 142, 168, 195, 225, 248, 272];
            const drawTotalMetric = (label: string, value: string, tx: number) => {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5); // Increased for consistency
                doc.setTextColor(...COLORS.accentCyan);
                doc.text(label, tx, y + 6, { align: 'center' });

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5); // Clear bold values
                doc.setTextColor(...COLORS.white);
                doc.text(value, tx, y + 12, { align: 'center' });
            };

            drawTotalMetric('No of offers', displayTotals.noOfOffers.toString(), tColX[0])
            drawTotalMetric('Offers value', fmtCrLakh(displayTotals.offersValue), tColX[1])
            drawTotalMetric('Orders Won', fmtCrLakh(displayTotals.ordersReceived), tColX[2])
            drawTotalMetric('Open Funnel', fmtCrLakh(displayTotals.openFunnel), tColX[3])
            drawTotalMetric('Target', fmtCrLakh(displayTotals.yearlyTarget), tColX[4])
            drawTotalMetric('% DEV', fmtPct(totalDevPct, 0), tColX[5])
            drawTotalMetric('BALANCE', totalBalance > 0 ? fmtCrLakh(totalBalance) : `SURPLUS ${fmtCrLakh(Math.abs(totalBalance))}`, tColX[6])

            y += totalBarH + 10
        }

        // ===== ANALYTICS PAGE =====
        if (!selectedZoneId && data.zones.length > 1) {
            // Always start analytics on a fresh page for clean layout
            drawFooter(doc, pageNum.val)
            pageNum.val++
            doc.addPage()
            let aY = drawHeader(doc, data.year, filterLabels[filter], undefined, logoBase64)

            aY = drawSectionTitle(doc, aY, 'VISUAL ANALYTICS DASHBOARD')
            aY += 15

            // --- Row 1: Bar chart (Orders Won) + Donut chart (Offers Distribution) ---
            const chartHalfW = (pageW - 50) / 2
            const barData = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.ordersReceived,
                color: getZoneColor(z.zoneName, i),
            }))
            drawBarChart(doc, 18, aY, chartHalfW - 5, 110, barData, 'Orders Won by Zone')

            const pieData = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.offersValue,
                color: getZoneColor(z.zoneName, i),
            }))
            drawPieChart(doc, pageW / 2 + 50, aY + 48, 28, pieData, 'Offers Value Distribution')

            aY += 135

                // --- Row 2: Achievement Progress Ring Cards ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 95, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = drawSectionTitle(doc, aY, 'TARGET ACHIEVEMENT BY ZONE', COLORS.kardexGreen)
            aY += 4

            const ringCardW = (pageW - 30 - (Math.min(data.zones.length, 4) - 1) * 5) / Math.min(data.zones.length, 4)
            const ringCardH = 90
            const ringR = 18

            data.zones.slice(0, 4).forEach((zone, i) => {
                const cardX = 15 + i * (ringCardW + 5)
                const cx = cardX + ringCardW / 2
                const cy = aY + 32
                const pct = zone.yearlyTarget > 0 ? (zone.ordersReceived / zone.yearlyTarget) * 100 : 0
                const gColor: [number, number, number] = pct >= 100 ? COLORS.positive : pct >= 75 ? COLORS.warning : COLORS.negative
                const balance = zone.yearlyTarget - zone.ordersReceived

                // Card background
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(cardX, aY, ringCardW, ringCardH, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.roundedRect(cardX, aY, ringCardW, ringCardH, 3, 3, 'S')

                // Top colored accent strip
                doc.setFillColor(...gColor)
                doc.rect(cardX, aY, ringCardW, 2.5, 'F')

                // Zone name at top
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(9)
                doc.setTextColor(...COLORS.textDark)
                doc.text(zone.zoneName, cx, aY + 10, { align: 'center' })

                // Full circle progress ring — track
                const totalSegs = 60
                doc.setDrawColor(...COLORS.darkTrack)
                doc.setLineWidth(3.5)
                for (let s = 0; s < totalSegs; s++) {
                    const a1 = -Math.PI / 2 + (s / totalSegs) * 2 * Math.PI
                    const a2 = -Math.PI / 2 + ((s + 1) / totalSegs) * 2 * Math.PI
                    doc.line(
                        cx + ringR * Math.cos(a1), cy + ringR * Math.sin(a1),
                        cx + ringR * Math.cos(a2), cy + ringR * Math.sin(a2)
                    )
                }

                // Full circle progress ring — filled portion
                const fillSegs = Math.floor(Math.min(pct / 100, 1) * totalSegs)
                doc.setDrawColor(...gColor)
                doc.setLineWidth(3.5)
                for (let s = 0; s < fillSegs; s++) {
                    const a1 = -Math.PI / 2 + (s / totalSegs) * 2 * Math.PI
                    const a2 = -Math.PI / 2 + ((s + 1) / totalSegs) * 2 * Math.PI
                    doc.line(
                        cx + ringR * Math.cos(a1), cy + ringR * Math.sin(a1),
                        cx + ringR * Math.cos(a2), cy + ringR * Math.sin(a2)
                    )
                }

                // Percentage in center of ring
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(16)
                doc.setTextColor(...gColor)
                doc.text(`${pct.toFixed(0)}%`, cx, cy + 2, { align: 'center' })

                // Subtitle below ring
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text('Achievement', cx, cy + 7, { align: 'center' })

                // Stats below the ring — in a mini table format
                const statsY = cy + ringR + 6
                const statLeftX = cardX + 4
                const statRightX = cardX + ringCardW - 4

                // Row: Target
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text('Target', statLeftX, statsY)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(...COLORS.textDark)
                doc.text(fmtCrLakh(zone.yearlyTarget), statRightX, statsY, { align: 'right' })

                // Divider line
                doc.setDrawColor(...COLORS.gridLine)
                doc.setLineWidth(0.15)
                doc.line(statLeftX, statsY + 2, statRightX, statsY + 2)

                // Row: Won
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(...COLORS.textMuted)
                doc.text('Won', statLeftX, statsY + 7)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(...COLORS.positive)
                doc.text(fmtCrLakh(zone.ordersReceived), statRightX, statsY + 7, { align: 'right' })

                // Divider
                doc.line(statLeftX, statsY + 9, statRightX, statsY + 9)

                // Row: Balance / Surplus
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(...COLORS.textMuted)
                doc.text(balance > 0 ? 'Balance' : 'Surplus', statLeftX, statsY + 14)
                doc.setFont('helvetica', 'bold')
                const balColor: [number, number, number] = balance > 0 ? COLORS.negative : COLORS.positive
                doc.setTextColor(...balColor)
                doc.text(fmtCrLakh(Math.abs(balance)), statRightX, statsY + 14, { align: 'right' })
            })

            aY += ringCardH + 6

                // --- Row 3: Grouped Vertical Bar Chart (Offers vs Orders vs Target) ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 100, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = drawSectionTitle(doc, aY, 'ZONE COMPARISON: OFFERS vs ORDERS vs TARGET', COLORS.accentCyan)
            aY += 15

            // Full-width card for grouped bar chart
            const gcH = 110
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15, aY - 4, pageW - 30, gcH + 12, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.setLineWidth(0.3)
            doc.roundedRect(15, aY - 4, pageW - 30, gcH + 12, 3, 3, 'S')

            // Legend — top right
            const gcLegendItems = [
                { label: 'Offers Value', color: COLORS.kardexLight },
                { label: 'Orders Won', color: COLORS.accentNeon },
                { label: 'Target', color: COLORS.accentAmber },
            ]
            const gcLegendX = pageW - 130
            gcLegendItems.forEach((item, li) => {
                doc.setFillColor(...item.color)
                doc.roundedRect(gcLegendX + li * 38, aY - 2, 5, 4, 1, 1, 'F')
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(item.label, gcLegendX + li * 38 + 7, aY + 1.5)
            })

            // Chart area
            const gcChartX = 30
            const gcChartW = pageW - 60
            const gcChartY = aY + 6
            const gcChartH = gcH - 12
            const gcMaxVal = Math.max(...data.zones.flatMap(z => [z.offersValue, z.ordersReceived, z.yearlyTarget]), 1)

            // Y-axis grid lines + labels
            doc.setDrawColor(...COLORS.gridLine)
            doc.setLineWidth(0.15)
            for (let g = 1; g <= 4; g++) {
                const gy = gcChartY + gcChartH - (g / 4) * gcChartH
                doc.line(gcChartX, gy, gcChartX + gcChartW, gy)
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5)
                doc.setTextColor(...COLORS.textLight)
                doc.text(fmtCrLakh(gcMaxVal * g / 4), gcChartX - 2, gy + 1.5, { align: 'right' })
            }
            // Baseline
            doc.setDrawColor(...COLORS.midGray)
            doc.setLineWidth(0.2)
            doc.line(gcChartX, gcChartY + gcChartH, gcChartX + gcChartW, gcChartY + gcChartH)

            // Grouped bars — 3 bars per zone
            const nZones = data.zones.length
            const groupGap = 12
            const totalGroupGap = (nZones - 1) * groupGap
            const groupW = Math.min((gcChartW - totalGroupGap) / nZones, 50)
            const singleBarW = (groupW - 4) / 3
            const gcStartX = gcChartX + (gcChartW - (nZones * groupW + totalGroupGap)) / 2

            data.zones.forEach((zone, zi) => {
                const groupX = gcStartX + zi * (groupW + groupGap)
                const bars = [
                    { value: zone.offersValue, color: COLORS.kardexLight },
                    { value: zone.ordersReceived, color: COLORS.accentNeon },
                    { value: zone.yearlyTarget, color: COLORS.accentAmber },
                ]

                bars.forEach((bar, bi) => {
                    const bx = groupX + bi * (singleBarW + 1.5)
                    const bh = Math.max((bar.value / gcMaxVal) * gcChartH, 1.5)
                    const by = gcChartY + gcChartH - bh

                    doc.setFillColor(...bar.color)
                    doc.roundedRect(bx, by, singleBarW, bh, 1, 1, 'F')

                    // Value on top of each bar
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(5)
                    doc.setTextColor(...COLORS.textDark)
                    doc.text(fmtCrLakh(bar.value), bx + singleBarW / 2, by - 1.5, { align: 'center' })
                })

                // Zone label under the group
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textDark)
                doc.text(zone.zoneName, groupX + groupW / 2, gcChartY + gcChartH + 6, { align: 'center' })
            })

            aY += gcH + 20

                // --- Row 4: Hit Rate Comparison + Orders Pie ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 70, pageNum, data, filter, filterLabels, undefined, logoBase64)
            aY = drawSectionTitle(doc, aY, 'HIT RATE ANALYSIS & ORDERS DISTRIBUTION', COLORS.kardexMid)
            aY += 15

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
            drawPieChart(doc, pageW / 2 + 52, aY + 35, 22, ordPieData, 'Orders Won Distribution')

            aY += Math.max(data.zones.length * 11 + 18, 78)


                // --- Row 6: Open Funnel Bar chart ---
                ;[aY, pageNum.val] = needsNewPage(doc, aY, 75, pageNum, data, filter, filterLabels, undefined, logoBase64)

            const funnelData = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.openFunnel,
                color: getZoneColor(z.zoneName, i),
            }))
            drawBarChart(doc, 18, aY, chartHalfW - 5, 110, funnelData, 'Open Funnel by Zone')

            // Offers count pie
            const offersCountPie = data.zones.map((z, i) => ({
                label: z.zoneName,
                value: z.noOfOffers,
                color: getZoneColor(z.zoneName, i),
            }))
            drawPieChart(doc, pageW / 2 + 50, aY + 48, 28, offersCountPie, 'Number of Offers Distribution')
            aY += 135
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
                const cx = pageW / 5 + 5
                const cy = dAY + 42
                const gr = 30
                doc.setFillColor(...COLORS.cardBg)
                doc.roundedRect(cx - 45, dAY, 90, 90, 3, 3, 'F')
                doc.setDrawColor(...COLORS.cardBorder)
                doc.setLineWidth(0.3)
                doc.roundedRect(cx - 45, dAY, 90, 90, 3, 3, 'S')

                const segments = 50
                doc.setDrawColor(...COLORS.darkTrack)
                doc.setLineWidth(5)
                for (let s = 0; s < segments; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(cx + gr * Math.cos(a1), cy + gr * Math.sin(a1), cx + gr * Math.cos(a2), cy + gr * Math.sin(a2))
                }
                const fillSegs = Math.floor(Math.min(pct / 100, 1) * segments)
                const gColor: [number, number, number] = pct >= 100 ? COLORS.positive : pct >= 75 ? COLORS.warning : COLORS.negative
                doc.setDrawColor(...gColor)
                doc.setLineWidth(5)
                for (let s = 0; s < fillSegs; s++) {
                    const a1 = Math.PI + (s / segments) * Math.PI
                    const a2 = Math.PI + ((s + 1) / segments) * Math.PI
                    doc.line(cx + gr * Math.cos(a1), cy + gr * Math.sin(a1), cx + gr * Math.cos(a2), cy + gr * Math.sin(a2))
                }
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(20)
                doc.setTextColor(...gColor)
                doc.text(`${pct.toFixed(0)}%`, cx, cy + 3, { align: 'center' })
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(9)
                doc.setTextColor(...COLORS.textDark)
                doc.text(`${zone.zoneName} Achievement`, cx, cy + gr + 12, { align: 'center' })
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`Target: ${fmtCrLakh(zone.yearlyTarget)}  |  Won: ${fmtCrLakh(zone.ordersReceived)}`, cx, cy + gr + 18, { align: 'center' })
                doc.text(`Hit Rate: ${zone.hitRatePercent.toFixed(1)}%`, cx, cy + gr + 23, { align: 'center' })

                // --- Product Breakdown Bar Chart on Right ---
                const zm = data.zoneMonthly.find(z => z.zoneId === selectedZoneId)
                if (zm && zm.productBreakdown) {
                    const prodBarData = zm.productBreakdown.map((pb, i) => ({
                        label: pb.productLabel,
                        value: pb.totals.orderReceived,
                        color: getZoneColor(pb.productLabel, i + 3)
                    }))
                    const barX = cx + 55
                    const barW = pageW - barX - 25
                    drawBarChart(doc, barX, dAY + 10, barW, 80, prodBarData, `${zone.zoneName} - Product Category Won`)
                }

                y = dAY + 100
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
            // For individual zone, continue on same page with tighter spacing
            y = (doc as any).lastAutoTable?.finalY || y + 8
            y += 6
        }

        y = drawSectionTitle(doc, y, 'MONTHLY PERFORMANCE BREAKDOWN')
        y += 2

        const zoneMonthlyToShow = selectedZoneId
            ? data.zoneMonthly.filter(z => z.zoneId === selectedZoneId)
            : data.zoneMonthly


        zoneMonthlyToShow.forEach((zone, zoneIdx) => {
            if (zoneIdx > 0) y += 5;

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
                y += 6;
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

                if (npy === y) pY += 6
                pY = drawSectionTitle(doc, pY, 'PRODUCT CATEGORY PERFORMANCE ANALYSIS', COLORS.kardexDark)
                pY += 15

                // Row 1: Graphical Distribution
                const prodChartHalfW = (pageW - 40) / 2
                const prodBarData = aggregatedProducts.map((p, i) => ({
                    label: p.label,
                    value: p.ordersReceived,
                    color: getZoneColor(p.label, i + 5) // Use shifted colors for variety
                }))
                drawBarChart(doc, 18, pY, prodChartHalfW - 5, 110, prodBarData, 'Orders Won by Product Category')

                const prodPieData = aggregatedProducts.map((p, i) => ({
                    label: p.label,
                    value: p.ordersReceived,
                    color: getZoneColor(p.label, i + 5)
                }))
                drawPieChart(doc, pageW / 2 + 50, pY + 48, 28, prodPieData, 'Product Distribution (Value)')

                pY += 135

                    // Row 2: Product Performance Visual List
                    ;[pY, pageNum.val] = needsNewPage(doc, pY, aggregatedProducts.length * 16 + 10, pageNum, data, filter, filterLabels, undefined, logoBase64)

                aggregatedProducts.forEach((p, pi) => {
                    const ach = p.target > 0 ? (p.ordersReceived / p.target) * 100 : 0
                    const pRowY = pY + pi * 16

                    drawPerformanceStrip(doc, 15, pRowY, pageW - 30,
                        p.label,
                        [
                            { label: 'Orders Won', value: fmtCrLakh(p.ordersReceived) },
                            { label: 'Offers Value', value: fmtCrLakh(p.offersValue) },
                            { label: 'Open Funnel', value: fmtCrLakh(p.ordersInHand) },
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

        // ===== User Performance Summary (Page 1 Overview) =====
        y = drawSectionTitle(doc, y, 'USER PERFORMANCE SUMMARY')
        y += 2

        const userCardData = usersToShow.map(u => {
            const uFilteredMonths = selectedMonth !== undefined
                ? u.monthlyData.filter(m => {
                    const targetMonthKey = monthName?.substring(0, 3).toLowerCase()
                    return (m.monthLabel && m.monthLabel.toLowerCase().includes(monthName!.toLowerCase())) ||
                        (m.month && m.month.toLowerCase().includes(targetMonthKey!))
                })
                : u.monthlyData

            const uNoOfOffers = uFilteredMonths.reduce((sum, m) => sum + (m.noOfOffers || 0), 0)
            const uOffersValue = uFilteredMonths.reduce((sum, m) => sum + (m.offersValue || 0), 0)
            const uOrdersReceived = uFilteredMonths.reduce((sum, m) => sum + (m.orderReceived || 0), 0)
            const uOrdersInHand = uFilteredMonths.reduce((sum, m) => sum + (m.ordersInHand || 0), 0)
            const uTarget = selectedMonth !== undefined ? (u.yearlyTarget / 12) : u.yearlyTarget

            const uAch = uTarget > 0 ? ((uOrdersReceived / uTarget) * 100) : 0
            const uBalance = uTarget - uOrdersReceived

            return { user: u, uNoOfOffers, uOffersValue, uOrdersReceived, uOrdersInHand, uTarget, uAch, uBalance }
        })

        const rowH = 15
        const headerH = 8
        const tableW = pageW - 30

        doc.setFillColor(...COLORS.headerBg)
        doc.roundedRect(15, y, tableW, headerH, 1, 1, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.white)

        const colTitleX = [22, 60, 118, 168, 225]
        const colTitles = ['USER', 'ACHIEVEMENT', 'OFFER PIPELINE', 'PERFORMANCE', 'TARGET']
        colTitles.forEach((title, i) => {
            doc.text(title, colTitleX[i], y + 5.5)
        })

        y += headerH + 1.5

        userCardData.forEach((ud) => {
            const [ny, npn] = needsNewPage(doc, y, rowH + 5, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64);
            y = ny;
            pageNum.val = npn;

            if (y === drawHeader(doc, data.year, filterLabels[filter] + (monthName ? ` (${monthName})` : ''), selectedZone?.zoneName, logoBase64)) {
                doc.setFillColor(...COLORS.headerBg)
                doc.roundedRect(15, y, tableW, headerH, 1, 1, 'F')
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.white)
                colTitles.forEach((title, i) => doc.text(title, colTitleX[i], y + 5.5))
                y += headerH + 1.5
            }

            // User Name & Zone
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.setTextColor(...COLORS.textDark)
            doc.text(ud.user.userName, 22, y + 6.5)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(5.5)
            doc.setTextColor(...COLORS.textMuted)
            doc.text(ud.user.zoneName, 22, y + 10)

            // Achievement Mini Bar
            const uBarW = 35
            const uBarY = y + 6.5
            doc.setFillColor(...COLORS.darkTrack)
            doc.roundedRect(60, uBarY, uBarW, 2.5, 1.25, 1.25, 'F')
            const uFillW = Math.max(Math.min(ud.uAch / 100, 1) * uBarW, 0)
            const uAColor = ud.uAch >= 100 ? COLORS.positive : ud.uAch >= 75 ? COLORS.warning : COLORS.negative
            if (uFillW > 0) {
                doc.setFillColor(...uAColor)
                doc.roundedRect(60, uBarY, uFillW, 2.5, 1.25, 1.25, 'F')
            }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7)
            doc.setTextColor(...uAColor)
            doc.text(`${ud.uAch.toFixed(1)}%`, 60 + uBarW + 2, uBarY + 2.2)

            // Data Points
            const drawUserMetric = (lbl: string, val: string, mx: number, vCol?: [number, number, number]) => {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.setTextColor(...COLORS.textLight);
                doc.text(lbl, mx, y + 5);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(...(vCol || COLORS.textDark));
                doc.text(val, mx, y + 10.5);
            };

            drawUserMetric('No of offers', ud.uNoOfOffers.toString(), 118);
            drawUserMetric('Offers value', fmtCrLakh(ud.uOffersValue), 142);
            drawUserMetric('Orders Won', ud.uOrdersReceived === 0 ? '0' : fmtCrLakh(ud.uOrdersReceived), 168, COLORS.positive);
            drawUserMetric('Open Funnel', ud.uOrdersInHand === 0 ? '0' : fmtCrLakh(ud.uOrdersInHand), 195, COLORS.accentOrange);
            drawUserMetric('Target', fmtCrLakh(ud.uTarget), 225, COLORS.accentAmber);

            doc.setDrawColor(...COLORS.cardBorder);
            doc.setLineWidth(0.12);
            doc.line(15, y + rowH, 15 + tableW, y + rowH);
            y += rowH;
        })

        // ===== Zone Users Breakdown (One User Per Page) =====
        usersToShow.forEach((user, userIdx) => {
            drawFooter(doc, pageNum.val)
            pageNum.val++
            doc.addPage()
            y = drawHeader(doc, data.year, filterLabels[filter] + (monthName ? ` (${monthName})` : ''), selectedZone?.zoneName || user.zoneName, logoBase64)

            // ===== User Highlight Section (instead of header) =====
            doc.setFillColor(...COLORS.headerBg)
            doc.roundedRect(15, 34, pageW - 30, 14, 2, 2, 'F')
            doc.setFillColor(...COLORS.accentCyan)
            doc.rect(15, 34, 4, 14, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(11)
            doc.setTextColor(...COLORS.white)
            doc.text(user.userName.toUpperCase(), 25, 43.5)
            doc.setFontSize(7)
            doc.setTextColor(...COLORS.accentCyan)
            doc.text('PERFORMANCE PROFILE', 25, 39)

            y = 52

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
            const cardH = 36
            const cardGap = 5
            const cardStartX = 15

            drawKPICard(doc, cardStartX, y, cardW, cardH,
                'Total Offers',
                userNoOfOffers.toString(),
                COLORS.accentCyan,
                `Value: ${fmtCrLakh(userOffersValue)}`
            )

            drawKPICard(doc, cardStartX + cardW + cardGap, y, cardW, cardH,
                'Orders Won',
                fmtCrLakh(userOrdersReceived),
                COLORS.accentNeon,
                `${userAchPct.toFixed(1)}% of Target`
            )

            drawKPICard(doc, cardStartX + 2 * (cardW + cardGap), y, cardW, cardH,
                'Open Funnel',
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
            y += cardH + 5
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(...COLORS.textDark)
            doc.text(monthName ? 'Monthly Achievement' : 'Yearly Achievement', 15, y)

            const achColor: [number, number, number] = userAchPct >= 100 ? COLORS.positive : userAchPct >= 75 ? COLORS.warning : COLORS.negative
            doc.setTextColor(...achColor)
            doc.text(`${userAchPct.toFixed(1)}%`, pageW - 15, y, { align: 'right' })

            y += 3
            drawProgressBar(doc, 15, y, pageW - 30, 4, userAchPct, achColor)

            y += 6

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

            y = drawSectionTitle(doc, y, monthName ? `PERFORMANCE SUMMARY - ${monthName.toUpperCase()}` : `${user.userName.toUpperCase()} - PERFORMANCE BREAKDOWN`, COLORS.kardexGreen)
            y += 2

            const zColor = getZoneColor(user.zoneName, userIdx)

            autoTable(doc, {
                startY: y,
                head: [['Month', 'No of offers', 'Offers value', 'Orders Won', 'Open Funnel', 'BU/Mo', '% Dev', 'OfferBU', '% Dev']],
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
                const productCategories = data.productTotals?.map(pt => pt.productLabel) || user.productBreakdown.map(pb => pb.productLabel)
                const uniqueCategories = Array.from(new Set(productCategories))

                // Force section to stay together: calculate total height (14mm per row + 20mm title/padding)
                const totalSectionH = uniqueCategories.length * 14 + 20
                    ;[y, pageNum.val] = needsNewPage(doc, y, totalSectionH, pageNum, data, filter, filterLabels, user.zoneName, logoBase64)

                y = drawSectionTitle(doc, y + 4, 'PRODUCT PERFORMANCE ANALYSIS', COLORS.kardexMid)
                y += 2

                uniqueCategories.forEach((catLabel) => {
                    const p = user.productBreakdown?.find(pb => pb.productLabel === catLabel)

                    let rowData: any
                    let achPct = 0

                    if (!p) {
                        rowData = {
                            noOfOffers: '0',
                            offersValue: '0',
                            target: '0',
                            orderReceived: '0',
                            ordersInHand: '0',
                            buMonthly: '0',
                            percentDev: '-',
                            offerBUMonth: '0',
                            offerBUMonthDev: '-'
                        }
                    } else {
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

                        const pTarget = monthName ? p.yearlyTarget / 12 : p.yearlyTarget
                        achPct = pTarget > 0 ? (pOrderReceived / pTarget) * 100 : 0

                        rowData = {
                            noOfOffers: pNoOfOffers.toString(),
                            offersValue: fmtCrLakh(pOffersValue),
                            target: fmtCrLakh(pTarget),
                            orderReceived: fmtCrLakh(pOrderReceived),
                            ordersInHand: fmtCrLakh(pOrdersInHand),
                            buMonthly: fmtCrLakh(pBUMonthly),
                            percentDev: pFilteredMonths.length === 1 && pFilteredMonths[0].percentDev !== null ? fmtPct(pFilteredMonths[0].percentDev) : '-',
                            offerBUMonth: fmtCrLakh(pOfferBUMonth),
                            offerBUMonthDev: pFilteredMonths.length === 1 && pFilteredMonths[0].offerBUMonthDev !== null ? fmtPct(pFilteredMonths[0].offerBUMonthDev) : '-',
                        }
                    }

                    drawProductPerformanceRow(doc, 15, y, pageW - 30, catLabel, rowData, achPct, COLORS.kardexMid)
                    y += 14
                })

                y += 5
            }
        })

        // ===== Zone Users Global Analytics =====
        if (usersToShow.length > 1) {
            drawFooter(doc, pageNum.val)
            pageNum.val++
            doc.addPage()
            let uAY = drawHeader(doc, data.year, filterLabels[filter], selectedZone?.zoneName, logoBase64)

            uAY += 5

            uAY = drawSectionTitle(doc, uAY, 'USER PERFORMANCE ANALYTICS')
            uAY += 15

            // Bar chart — orders by user
            const userChartHalfW = (pageW - 50) / 2
            const userBarData = usersToShow.map((u, i) => ({
                label: u.userName,
                value: u.totals.orderReceived,
                color: getZoneColor(u.zoneName, i),
            }))
            drawBarChart(doc, 18, uAY, userChartHalfW - 5, 110, userBarData, 'Orders Won by User')

            // Pie — offers value by user (Group 'Others' if > 12)
            let userPieData = usersToShow.map((u, i) => ({
                label: u.userName,
                value: u.totals.offersValue,
                color: getZoneColor(u.zoneName, i),
            }))
            if (userPieData.length > 12) {
                const topItems = userPieData.slice(0, 11)
                const othersValue = userPieData.slice(11).reduce((sum, item) => sum + item.value, 0)
                userPieData = [...topItems, { label: 'Others', value: othersValue, color: [150, 150, 150] }]
            }
            drawPieChart(doc, pageW / 2 + 30, uAY + 48, 28, userPieData, 'Offers Value by User')

            uAY += 135

                // ===== User Achievement Gauge Meters =====
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 60, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'USER ACHIEVEMENT GAUGES', COLORS.kardexGreen)
            uAY += 2

            const sortedUsersForGauges = [...usersToShow].sort((a, b) => {
                const achA = a.yearlyTarget > 0 ? a.totals.orderReceived / a.yearlyTarget : 0
                const achB = b.yearlyTarget > 0 ? b.totals.orderReceived / b.yearlyTarget : 0
                return achB - achA
            })

            const gaugesPerRow = 6
            const gaugeW = (pageW - 30) / gaugesPerRow
            const gaugeR = 17
            const cardH = gaugeR * 2 + 28
            const rowH = cardH + 4

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
                doc.setFontSize(11)
                doc.setTextColor(...gColor)
                doc.text(`${pct.toFixed(0)}%`, cx, cy + 2, { align: 'center' })

                // User name
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(5.5)
                doc.setTextColor(...COLORS.textDark)
                doc.text(user.userName.substring(0, 18), cx, cy + gaugeR + 6, { align: 'center' })

                // Target value
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(4.5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(`T: ${fmtCrLakh(user.yearlyTarget)}`, cx, cy + gaugeR + 10, { align: 'center' })
                doc.text(`W: ${fmtCrLakh(user.totals.orderReceived)}`, cx, cy + gaugeR + 14, { align: 'center' })
            })

            uAY += rowH + 10

                // ===== Offers vs Orders Comparison =====
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 65, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'USER COMPARISON: OFFERS vs ORDERS vs TARGET', COLORS.accentCyan)
            uAY += 2

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

            usersToShow.forEach((user) => {
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 13, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)

                // User label
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.textDark)
                doc.text(user.userName, 20, uAY + 4)

                const barStartX = 48
                const barH = 3

                // Offers bar
                const offersW = (user.totals.offersValue / hBarMaxVal) * hBarW
                doc.setFillColor(...COLORS.kardexLight)
                doc.roundedRect(barStartX, uAY, Math.max(offersW, 1), barH, 1, 1, 'F')

                // Orders bar
                const ordersW = (user.totals.orderReceived / hBarMaxVal) * hBarW
                doc.setFillColor(...COLORS.accentNeon)
                doc.roundedRect(barStartX, uAY + 4, Math.max(ordersW, 1), barH, 1, 1, 'F')

                // Target marker
                const targetX = barStartX + (user.yearlyTarget / hBarMaxVal) * hBarW
                if (user.yearlyTarget > 0) {
                    doc.setDrawColor(...COLORS.accentAmber)
                    doc.setLineWidth(0.8)
                    doc.line(targetX, uAY - 1, targetX, uAY + 9)
                    doc.setFillColor(...COLORS.accentAmber)
                    doc.triangle(targetX - 1.5, uAY - 1, targetX + 1.5, uAY - 1, targetX, uAY + 0.5, 'F')
                }

                // Values
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5)
                doc.setTextColor(...COLORS.textMuted)
                doc.text(fmtCrLakh(user.totals.offersValue), barStartX + Math.max(offersW, 1) + 2, uAY + 3)
                doc.text(fmtCrLakh(user.totals.orderReceived), barStartX + Math.max(ordersW, 1) + 2, uAY + 7)

                uAY += 13
            })

                // ===== Hit Rate Analysis =====
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 60, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            const startUay = uAY
            uAY = drawSectionTitle(doc, uAY, 'HIT RATE ANALYSIS & FUNNEL DISTRIBUTION', COLORS.kardexMid)
            uAY += 2

            // Hit rate horizontal bars (left half) — dark card
            const hrCardW = (pageW - 40) / 2
            const hrCardH = usersToShow.length * 11 + 22
            doc.setFillColor(...COLORS.cardBg)
            doc.roundedRect(15, uAY, hrCardW, hrCardH, 3, 3, 'F')
            doc.setDrawColor(...COLORS.cardBorder)
            doc.setLineWidth(0.3)
            doc.roundedRect(15, uAY, hrCardW, hrCardH, 3, 3, 'S')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(...COLORS.textDark)
            doc.text('Hit Rate by User', 20, uAY + 7)

            uAY += 10 // Prevent overlap with first user row

            usersToShow.forEach((user) => {
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, 11, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)

                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                doc.setTextColor(...COLORS.textDark)
                doc.text(user.userName, 20, uAY + 4)

                const maxHr = Math.max(...usersToShow.map(u => u.hitRate), 100)
                const hrBarW = hrCardW - 65
                const filled = (user.hitRate / maxHr) * hrBarW
                const hrColor: [number, number, number] = user.hitRate >= 50 ? COLORS.positive : user.hitRate >= 30 ? COLORS.warning : COLORS.negative

                doc.setFillColor(...COLORS.darkTrack)
                doc.roundedRect(55, uAY + 1, hrBarW, 4, 2, 2, 'F')
                doc.setFillColor(...hrColor)
                doc.roundedRect(55, uAY + 1, Math.max(filled, 1), 4, 2, 2, 'F')

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6)
                doc.setTextColor(...hrColor)
                doc.text(`${user.hitRate.toFixed(1)}%`, 55 + hrBarW + 3, uAY + 5)

                uAY += 11
            })

            // Open Funnel Pie Chart (right half)
            let funnelPieData = usersToShow.map((u, i) => ({
                label: u.userName,
                value: u.totals.ordersInHand,
                color: getZoneColor(u.zoneName, i),
            }))
            if (funnelPieData.length > 12) {
                const topItems = funnelPieData.slice(0, 11)
                const othersValue = funnelPieData.slice(11).reduce((sum, item) => sum + item.value, 0)
                funnelPieData = [...topItems, { label: 'Others', value: othersValue, color: [150, 150, 150] }]
            }
            drawPieChart(doc, pageW / 2 + 30, startUay + 35, 22, funnelPieData, 'Open Funnel Distribution')

            uAY = Math.max(uAY, startUay + 72)


            // User achievement visual list
            // Dynamic section height: (11.5mm row + 1.5mm gap) per user + title overhead
            const uAchSectionH = usersToShow.length * 13 + 15
                ;[uAY, pageNum.val] = needsNewPage(doc, uAY, uAchSectionH, pageNum, data, filter, filterLabels, selectedZone?.zoneName, logoBase64)
            uAY = drawSectionTitle(doc, uAY, 'USER ACHIEVEMENT COMPARISON', COLORS.kardexGreen)
            uAY += 2

            usersToShow.forEach((user) => {
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

                drawPerformanceStrip(doc, 15, uAY, pageW - 30,
                    user.userName,
                    [
                        { label: 'Orders Won', value: fmtCrLakh(sOrdersReceived) },
                        { label: 'Offers Value', value: fmtCrLakh(sOffersValue) },
                        { label: 'Open Funnel', value: fmtCrLakh(sOrdersInHand) },
                        { label: 'Target', value: fmtCrLakh(sTarget) },
                        { label: 'Hit Rate', value: `${user.hitRate.toFixed(1)}%` }
                    ],
                    uAch,
                    uColor
                )
                uAY += 13
            })
            uAY += 8
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
