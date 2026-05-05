/**
 * Growth Pillar Excel Export Utility — Kardex Brand Design
 * Generates professionally styled multi-sheet Excel workbook using ExcelJS
 * with Summary, Monthly Breakdown, Product-wise, and Insights sheets.
 *
 * Data shape matches GrowthPillarPdfData from growth-report-pdf.ts
 */
import { 
    kardexBlue, 
    kardexGreen, 
    kardexGrey, 
    kardexSilver, 
    kardexRed, 
    kardexSand,
    chartColors
} from './kardex-colors'

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

export interface GrowthPillarExcelData {
    year: number
    fromMonth: number
    toMonth: number
    filters: {
        zoneId: number | null
        userId: number | null
        probability?: number | 'all'
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
    forecastData?: {
        po?: any
        puz?: any
        pwf?: any
    }
}

// ============ Color Helpers ============
const c = (hex: string) => hex.replace('#', '')
const solid = (hex: string) => 'FF' + c(hex)
const alpha = (hex: string, a: string) => a + c(hex)

// ============ Color Scheme (ARGB Hex: AARRGGBB) ============
const COLORS = {
    headerBg: solid(kardexBlue[3]),      // Dark blue
    headerText: 'FFFFFFFF',
    titleBg: alpha(kardexBlue[1], '33'), // Light blue (20% opacity)
    titleText: solid(kardexBlue[3]),

    // KPI accent
    kpiTarget: solid(kardexBlue[2]),     
    kpiOffer: solid(kardexSand[2]),      
    kpiWon: solid(kardexGreen[2]),        
    kpiAchieve: solid(kardexBlue[1]),    
    kpiHitRate: solid(kardexGrey[3]),    

    // Status
    positive: solid(kardexGreen[3]),
    positiveBg: solid(kardexGreen[1]),
    warning: solid(kardexSand[3]),
    warningBg: solid(kardexSand[1]),
    negative: solid(kardexRed[2]),
    negativeBg: solid(kardexRed[1]),

    // Table
    rowEven: 'FFF8FAFC',
    rowOdd: 'FFFFFFFF',
    borderLight: solid(kardexSilver[1]),
    totalRowBg: alpha(kardexBlue[1], '4D'), // 30% opacity
    grandTotalBg: solid(kardexBlue[3]),

    // Product accent palette from design system
    product: chartColors.map(hex => solid(hex)),

    // Text
    textDark: solid(kardexBlue[3]),
    textLight: solid(kardexGrey[3]), // Darker for better contrast

    // Insight types
    success: solid(kardexGreen[2]),
    successBg: alpha(kardexGreen[1], '33'),
    info: solid(kardexBlue[2]),
    infoBg: alpha(kardexBlue[1], '33'),
    error: solid(kardexRed[2]),
    errorBg: alpha(kardexRed[1], '33'),
    action: solid(kardexSand[2]),
    actionBg: alpha(kardexSand[1], '33'),
}

// Distinct colors for each zone in Forecast Pipeline using brand colors
const ZONE_COLORS = [
    { bg: solid(kardexBlue[3]), light: solid(kardexBlue[2]), name: 'Kardex Blue' },
    { bg: solid(kardexGreen[3]), light: solid(kardexGreen[2]), name: 'Kardex Green' },
    { bg: solid(kardexSand[3]), light: solid(kardexSand[2]), name: 'Kardex Sand' },
    { bg: solid(kardexGrey[3]), light: solid(kardexGrey[2]), name: 'Kardex Grey' },
    { bg: solid(kardexBlue[2]), light: solid(kardexBlue[1]), name: 'Sky Blue' },
    { bg: solid(kardexGreen[2]), light: solid(kardexGreen[1]), name: 'Pale Green' },
    { bg: solid(kardexSand[2]), light: solid(kardexSand[1]), name: 'Warm Sand' },
    { bg: solid(kardexGrey[2]), light: solid(kardexGrey[1]), name: 'Silver Grey' },
]

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

// ============ Formatting Helpers ============
const fmtCurrency = (v: number): string => {
    if (v === 0) return '₹0'
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : ''
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)} K`
    return `${sign}₹${abs.toFixed(0)}`
}

// ============ Style Helpers ============
const thinBorder = (color = COLORS.borderLight) => ({
    top: { style: 'thin' as const, color: { argb: color } },
    left: { style: 'thin' as const, color: { argb: color } },
    bottom: { style: 'thin' as const, color: { argb: color } },
    right: { style: 'thin' as const, color: { argb: color } },
})

const applyHeaderStyle = (cell: any): void => {
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = thinBorder(COLORS.headerBg)
}

const applyDataCell = (cell: any, bgColor: string, isNumber = false, isCurrency = false, isPercent = false): void => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
    cell.border = thinBorder()
    cell.alignment = { horizontal: isNumber ? 'right' : 'left', vertical: 'middle' }
    if (typeof cell.value === 'number') {
        if (isPercent) cell.numFmt = '0.0%'
        else if (isCurrency) cell.numFmt = '[$₹-en-IN]#,##0'
        else cell.numFmt = '#,##0'
    }
}

const applyTotalRow = (cell: any, isGrand = false, isCurrency = false, isPercent = false): void => {
    cell.font = { bold: true, color: { argb: isGrand ? COLORS.headerText : COLORS.textDark }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isGrand ? COLORS.grandTotalBg : COLORS.totalRowBg } }
    cell.border = {
        top: { style: 'medium' as const, color: { argb: COLORS.headerBg } },
        left: { style: 'thin' as const, color: { argb: COLORS.headerBg } },
        bottom: { style: 'medium' as const, color: { argb: COLORS.headerBg } },
        right: { style: 'thin' as const, color: { argb: COLORS.headerBg } },
    }
    cell.alignment = { horizontal: isCurrency || isPercent || typeof cell.value === 'number' ? 'right' : 'center', vertical: 'middle' }
    if (typeof cell.value === 'number') {
        if (isPercent) cell.numFmt = '0.0%'
        else if (isCurrency) cell.numFmt = '[$₹-en-IN]#,##0'
        else cell.numFmt = '#,##0'
    }
}

// ============ Sheet 1: KPI Summary ============
function generateSummarySheet(workbook: any, data: GrowthPillarExcelData): void {
    const ws = workbook.addWorksheet('Summary', {
        properties: { tabColor: { argb: COLORS.headerBg } },
    })

    let row = 1

    // Title
    ws.mergeCells(`A${row}:I${row}`)
    const titleCell = ws.getCell(`A${row}`)
    titleCell.value = `GROWTH PILLAR — PERFORMANCE SUMMARY (${data.year})`
    titleCell.font = { size: 16, bold: true, color: { argb: COLORS.headerText } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 32
    row++

    // Subtitle
    ws.mergeCells(`A${row}:I${row}`)
    const subCell = ws.getCell(`A${row}`)
    const zoneName = data.filters.zoneId
        ? data.filters.zones.find(z => z.id === data.filters.zoneId)?.name || 'Zone'
        : 'All Zones'
    const userName = data.filters.userId
        ? data.filters.users.find(u => u.id === data.filters.userId)?.name || ''
        : ''
    const probLabel = data.filters.probability === 'all' ? 'All' : `>= ${data.filters.probability}%`
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}  |  Probability: ${probLabel}  |  Generated: ${new Date().toLocaleString('en-IN')}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textDark } } // Using textDark for visibility
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
    row += 2

    // KPI Row
    const kpis = [
        { label: 'Total Target', value: data.totals.target, sub: `${data.totals.offerCount} offers`, accent: COLORS.kpiTarget, isPercent: false },
        { label: 'Offer Value', value: data.totals.offerValue, sub: `${data.totals.offerCount} offers created`, accent: COLORS.kpiOffer, isPercent: false },
        { label: 'Won Value', value: data.totals.wonValue, sub: `${data.totals.wonCount} orders won`, accent: COLORS.kpiWon, isPercent: false },
        { label: 'Achieved', value: data.totals.achievementPercent / 100, sub: 'Won / Target', accent: COLORS.kpiAchieve, isPercent: true },
        { label: 'Hit Rate', value: data.totals.hitRatePercent / 100, sub: 'Won / Offer Value', accent: COLORS.kpiHitRate, isPercent: true },
    ]

    // KPI labels
    kpis.forEach((kpi, i) => {
        const cell = ws.getCell(row, i * 2 + 1)
        ws.mergeCells(row, i * 2 + 1, row, i * 2 + 2)
        cell.value = kpi.label.toUpperCase()
        cell.font = { bold: true, size: 9, color: { argb: COLORS.headerText } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.accent } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        // Ensure white text is readable, or use dark text for light accents
        if (kpi.accent === COLORS.kpiAchieve || kpi.accent === COLORS.kpiTarget) {
            cell.font.color = { argb: COLORS.textDark }
        }
    })
    ws.getRow(row).height = 22
    row++

    // KPI values
    kpis.forEach((kpi, i) => {
        const cell = ws.getCell(row, i * 2 + 1)
        ws.mergeCells(row, i * 2 + 1, row, i * 2 + 2)
        cell.value = kpi.value
        cell.font = { bold: true, size: 18, color: { argb: COLORS.textDark } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rowEven } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = thinBorder()
        if (typeof kpi.value === 'number') {
            cell.numFmt = kpi.isPercent ? '0.0%' : '[$₹-en-IN]#,##0'
        }
    })
    ws.getRow(row).height = 32
    row++

    // KPI subtitles
    kpis.forEach((kpi, i) => {
        const cell = ws.getCell(row, i * 2 + 1)
        ws.mergeCells(row, i * 2 + 1, row, i * 2 + 2)
        cell.value = kpi.sub
        cell.font = { size: 8, italic: true, color: { argb: COLORS.textDark } } // High contrast for small text
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rowEven } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = thinBorder()
    })
    ws.getRow(row).height = 18
    row += 2

    // Product-wise Summary Section
    if (data.productData.length > 0) {
        ws.mergeCells(`A${row}:I${row}`)
        const prodTitle = ws.getCell(`A${row}`)
        prodTitle.value = 'PRODUCT-WISE PERFORMANCE'
        prodTitle.font = { size: 12, bold: true, color: { argb: COLORS.headerText } }
        prodTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.kpiWon } }
        prodTitle.alignment = { horizontal: 'center', vertical: 'middle' }
        ws.getRow(row).height = 26
        row++

        const prodHeaders = ['Product', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achieved %', 'Hit Rate %']
        prodHeaders.forEach((h, idx) => {
            const cell = ws.getCell(row, idx + 1)
            cell.value = h
            applyHeaderStyle(cell)
        })
        ws.getRow(row).height = 24
        row++

        data.productData.forEach((p, idx) => {
            const bgColor = idx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd
            const pColor = COLORS.product[idx % COLORS.product.length]
            const rowData: (string | number | null)[] = [
                p.productLabel,
                p.target,
                p.offerValue,
                p.wonValue,
                p.offerCount,
                p.wonCount,
                p.achievementPercent / 100,
                p.hitRatePercent / 100,
            ]
            rowData.forEach((val, colIdx) => {
                const cell = ws.getCell(row, colIdx + 1)
                cell.value = val === null ? '—' : val
                const isCurrency = colIdx >= 1 && colIdx <= 3
                const isPercent = colIdx === 6 || colIdx === 7
                applyDataCell(cell, bgColor, colIdx > 0, isCurrency, isPercent)
                if (colIdx === 0) {
                    cell.font = { bold: true, color: { argb: pColor } }
                }
                if (colIdx === 6) {
                    const ach = p.achievementPercent
                    cell.font = { bold: true, color: { argb: ach >= 100 ? COLORS.positive : ach >= 50 ? COLORS.warning : COLORS.negative } }
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                }
                if (colIdx === 7) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                }
            })
            row++
        })
    }

    // Column widths
    ws.columns = [
        { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 },
        { width: 12 }, { width: 12 }, { width: 16 }, { width: 14 },
        { width: 14 }, { width: 14 },
    ]
}

// ============ Sheet 2: Monthly Breakdown ============
function generateMonthlySheet(workbook: any, data: GrowthPillarExcelData): void {
    const ws = workbook.addWorksheet('Monthly Breakdown', {
        properties: { tabColor: { argb: COLORS.kpiAchieve } },
    })

    let row = 1

    // Title
    ws.mergeCells(`A${row}:I${row}`)
    const titleCell = ws.getCell(`A${row}`)
    titleCell.value = `MONTHLY BREAKDOWN — FY ${data.year}`
    titleCell.font = { size: 16, bold: true, color: { argb: COLORS.headerText } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 30
    row++

    // Subtitle
    ws.mergeCells(`A${row}:I${row}`)
    const subCell = ws.getCell(`A${row}`)
    const zoneName = data.filters.zoneId ? data.filters.zones.find(z => z.id === data.filters.zoneId)?.name || 'Zone' : 'All Zones'
    const userName = data.filters.userId ? data.filters.users.find(u => u.id === data.filters.userId)?.name || '' : ''
    const probLabel = data.filters.probability === 'all' ? 'All' : `>= ${data.filters.probability}%`
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}  |  Probability: ${probLabel}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textDark } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
    row += 2

    // Headers
    const headers = ['Month', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achieved %', 'Hit Rate %', 'MoM Growth']
    headers.forEach((h, idx) => {
        const cell = ws.getCell(row, idx + 1)
        cell.value = h
        applyHeaderStyle(cell)
    })
    ws.getRow(row).height = 26
    row++

    // Monthly data rows
    data.monthlyData.forEach((d, idx) => {
        const bgColor = idx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd
        const rowData: (string | number | null)[] = [
            d.monthLabel,
            d.target,
            d.offerValue,
            d.wonValue,
            d.offerCount,
            d.wonCount,
            d.achievementPercent / 100,
            d.hitRatePercent / 100,
            d.growthPercent !== null ? d.growthPercent / 100 : null,
        ]

        rowData.forEach((val, colIdx) => {
            const cell = ws.getCell(row, colIdx + 1)
            cell.value = val === null ? '—' : val
            const isCurrency = colIdx >= 1 && colIdx <= 3
            const isPercent = colIdx >= 6 && colIdx <= 8
            applyDataCell(cell, bgColor, colIdx > 0, isCurrency, isPercent)

            if (colIdx === 0) cell.font = { bold: true, color: { argb: COLORS.textDark } }

            // Achievement color
            if (colIdx === 6) {
                const ach = d.achievementPercent
                cell.font = { bold: true, color: { argb: ach >= 100 ? COLORS.positive : ach >= 50 ? COLORS.warning : COLORS.negative } }
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
            }

            // Growth color
            if (colIdx === 8 && d.growthPercent !== null) {
                cell.font = { bold: true, color: { argb: d.growthPercent >= 0 ? COLORS.positive : COLORS.negative } }
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
            }

            // Center align percentage columns
            if (colIdx === 7 || colIdx === 8) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
            }
        })
        row++
    })

    // Totals row
    const totalData: (string | number | null)[] = [
        'TOTAL',
        data.totals.target,
        data.totals.offerValue,
        data.totals.wonValue,
        data.totals.offerCount,
        data.totals.wonCount,
        data.totals.achievementPercent / 100,
        data.totals.hitRatePercent / 100,
        null,
    ]

    totalData.forEach((val, colIdx) => {
        const cell = ws.getCell(row, colIdx + 1)
        cell.value = val === null ? '—' : val
        const isCurrency = colIdx >= 1 && colIdx <= 3
        const isPercent = colIdx >= 6 && colIdx <= 8
        applyTotalRow(cell, true, isCurrency, isPercent)
    })
    ws.getRow(row).height = 26

    // Column widths
    ws.columns = [
        { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 },
        { width: 10 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 14 },
    ]
}

// ============ Sheet 3: Product × Month Detail ============
function generateProductMonthlySheet(workbook: any, data: GrowthPillarExcelData): void {
    if (data.productData.length === 0) return

    const ws = workbook.addWorksheet('Product Monthly', {
        properties: { tabColor: { argb: COLORS.kpiWon } },
    })

    let row = 1

    // Title
    ws.mergeCells(`A${row}:H${row}`)
    const titleCell = ws.getCell(`A${row}`)
    titleCell.value = `PRODUCT-WISE MONTHLY DETAIL — FY ${data.year}`
    titleCell.font = { size: 16, bold: true, color: { argb: COLORS.headerText } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 30
    row++

    // Subtitle
    ws.mergeCells(`A${row}:H${row}`)
    const subCell = ws.getCell(`A${row}`)
    const zoneName = data.filters.zoneId ? data.filters.zones.find(z => z.id === data.filters.zoneId)?.name || 'Zone' : 'All Zones'
    const userName = data.filters.userId ? data.filters.users.find(u => u.id === data.filters.userId)?.name || '' : ''
    const probLabel = data.filters.probability === 'all' ? 'All' : `>= ${data.filters.probability}%`
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}  |  Probability: ${probLabel}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textDark } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
    row += 2

    // For each product
    data.productData.forEach((product, pi) => {
        const pColor = COLORS.product[pi % COLORS.product.length]

        // Product header bar
        ws.mergeCells(`A${row}:H${row}`)
        const prodHeader = ws.getCell(`A${row}`)
        prodHeader.value = `${product.productLabel}  |  Target: ${fmtCurrency(product.target)}  |  Won: ${fmtCurrency(product.wonValue)}  |  Achieved: ${product.achievementPercent}%  |  Hit Rate: ${product.hitRatePercent}%`
        prodHeader.font = { size: 11, bold: true, color: { argb: COLORS.headerText } }
        prodHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pColor } }
        prodHeader.alignment = { horizontal: 'left', vertical: 'middle' }
        ws.getRow(row).height = 26
        row++

        // Column headers
        const headers = ['Month', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achieved %', 'Growth']
        headers.forEach((h, idx) => {
            const cell = ws.getCell(row, idx + 1)
            cell.value = h
            cell.font = { bold: true, size: 9, color: { argb: COLORS.headerText } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pColor } }
            cell.alignment = { horizontal: idx === 0 ? 'left' : 'center', vertical: 'middle' }
            cell.border = thinBorder(pColor)
        })
        ws.getRow(row).height = 22
        row++

        // Monthly rows
        product.monthlyData.forEach((m, idx) => {
            const bgColor = idx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd
            const rowData: (string | number | null)[] = [
                m.monthLabel.slice(0, 3),
                m.target,
                m.offerValue,
                m.wonValue,
                m.offerCount,
                m.wonCount,
                m.achievementPercent / 100,
                m.growthPercent !== null ? m.growthPercent / 100 : null,
            ]

            rowData.forEach((val, colIdx) => {
                const cell = ws.getCell(row, colIdx + 1)
                cell.value = val === null ? '—' : val
                const isCurrency = colIdx >= 1 && colIdx <= 3
                const isPercent = colIdx === 6 || colIdx === 7
                applyDataCell(cell, bgColor, colIdx > 0, isCurrency, isPercent)

                if (colIdx === 0) cell.font = { bold: true, color: { argb: COLORS.textDark } }
                if (colIdx === 6) {
                    const ach = m.achievementPercent
                    cell.font = { bold: true, color: { argb: ach >= 100 ? COLORS.positive : ach >= 50 ? COLORS.warning : COLORS.negative } }
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                }
                if (colIdx === 7 && m.growthPercent !== null) {
                    cell.font = { bold: true, color: { argb: m.growthPercent >= 0 ? COLORS.positive : COLORS.negative } }
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                }
            })
            row++
        })

        // Product total row
        const productTotal: (string | number | null)[] = [
            'TOTAL',
            product.target,
            product.offerValue,
            product.wonValue,
            product.offerCount,
            product.wonCount,
            product.achievementPercent / 100,
            null,
        ]
        productTotal.forEach((val, colIdx) => {
            const cell = ws.getCell(row, colIdx + 1)
            cell.value = val === null ? '—' : val
            const isCurrency = colIdx >= 1 && colIdx <= 3
            const isPercent = colIdx === 6 || colIdx === 7
            applyTotalRow(cell, false, isCurrency, isPercent)
        })
        ws.getRow(row).height = 24
        row += 2 // gap between products
    })

    // Column widths
    ws.columns = [
        { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 },
        { width: 10 }, { width: 10 }, { width: 16 }, { width: 14 },
    ]
}

// ============ Sheet 4: Growth Insights ============
function generateInsightsSheet(workbook: any, data: GrowthPillarExcelData): void {
    const ws = workbook.addWorksheet('Insights', {
        properties: { tabColor: { argb: COLORS.kpiHitRate } },
    })

    let row = 1

    // Title
    ws.mergeCells(`A${row}:C${row}`)
    const titleCell = ws.getCell(`A${row}`)
    titleCell.value = 'GROWTH INSIGHTS & ANALYSIS'
    titleCell.font = { size: 16, bold: true, color: { argb: COLORS.headerText } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 30
    row++

    // Subtitle
    ws.mergeCells(`A${row}:C${row}`)
    const subCell = ws.getCell(`A${row}`)
    const zoneName = data.filters.zoneId ? data.filters.zones.find(z => z.id === data.filters.zoneId)?.name || 'Zone' : 'All Zones'
    const userName = data.filters.userId ? data.filters.users.find(u => u.id === data.filters.userId)?.name || '' : ''
    const probLabel = data.filters.probability === 'all' ? 'All' : `>= ${data.filters.probability}%`
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}  |  Probability: ${probLabel}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textDark } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
    row += 2

    const insightSections: { title: string; items: InsightItem[]; color: string }[] = [
        { title: `PERFORMANCE SUMMARY — ${data.insights.performance.status.replace(/_/g, ' ')}`, items: data.insights.performance.points, color: COLORS.headerBg },
        { title: 'MONTHLY TRENDS', items: data.insights.trends, color: COLORS.kpiAchieve },
        { title: 'PRODUCT ANALYSIS', items: data.insights.products, color: COLORS.kpiWon },
        { title: 'PIPELINE & CONVERSION', items: data.insights.conversion, color: COLORS.kpiOffer },
        { title: 'RECOMMENDATIONS & ACTION ITEMS', items: data.insights.recommendations, color: COLORS.kpiHitRate },
    ]

    for (const section of insightSections) {
        if (section.items.length === 0) continue

        // Section header
        ws.mergeCells(`A${row}:C${row}`)
        const sectionHeader = ws.getCell(`A${row}`)
        sectionHeader.value = section.title
        sectionHeader.font = { size: 12, bold: true, color: { argb: COLORS.headerText } }
        sectionHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: section.color } }
        sectionHeader.alignment = { horizontal: 'left', vertical: 'middle' }
        ws.getRow(row).height = 26
        row++

        // Headers
        const headers = ['Type', 'Insight', 'Priority']
        headers.forEach((h, idx) => {
            const cell = ws.getCell(row, idx + 1)
            cell.value = h
            cell.font = { bold: true, size: 9, color: { argb: COLORS.textDark } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
            cell.alignment = { horizontal: idx === 1 ? 'left' : 'center', vertical: 'middle' }
            cell.border = { bottom: { style: 'thin' as const, color: { argb: COLORS.borderLight } } }
        })
        ws.getRow(row).height = 20
        row++

        // Items
        section.items.forEach((item, idx) => {
            const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
                success: { label: '✓ Success', color: COLORS.success, bg: COLORS.successBg },
                info: { label: 'ℹ Info', color: COLORS.info, bg: COLORS.infoBg },
                warning: { label: '⚠ Warning', color: COLORS.warning, bg: COLORS.warningBg },
                error: { label: '✗ Error', color: COLORS.error, bg: COLORS.errorBg },
                action: { label: '→ Action', color: COLORS.action, bg: COLORS.actionBg },
            }
            const cfg = typeConfig[item.type] || typeConfig.info
            const bgColor = idx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd

            // Type column
            const typeCell = ws.getCell(row, 1)
            typeCell.value = cfg.label
            typeCell.font = { bold: true, size: 9, color: { argb: cfg.color } }
            typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cfg.bg } }
            typeCell.alignment = { horizontal: 'center', vertical: 'middle' }
            typeCell.border = thinBorder()

            // Insight text
            const textCell = ws.getCell(row, 2)
            textCell.value = item.text
            textCell.font = { size: 10, color: { argb: COLORS.textDark } }
            textCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
            textCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
            textCell.border = thinBorder()

            // Priority
            const priorityCell = ws.getCell(row, 3)
            const priority = item.type === 'error' ? 'HIGH' : item.type === 'warning' ? 'MEDIUM' : item.type === 'action' ? 'HIGH' : 'INFO'
            priorityCell.value = priority
            priorityCell.font = { bold: true, size: 9, color: { argb: priority === 'HIGH' ? COLORS.negative : priority === 'MEDIUM' ? COLORS.warning : COLORS.info } }
            priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
            priorityCell.alignment = { horizontal: 'center', vertical: 'middle' }
            priorityCell.border = thinBorder()

            ws.getRow(row).height = 22
            row++
        })

        row++ // gap between sections
    }

    // Column widths
    ws.columns = [
        { width: 14 },  // Type
        { width: 80 },  // Insight
        { width: 12 },  // Priority
    ]
}

// ============ Sheet 5: Forecast Pipeline + Product Breakdown (Combined) ============
function generateForecastPipelineSheet(workbook: any, data: GrowthPillarExcelData): void {
    const poData = data.forecastData?.po
    if (!poData || !poData.zones || poData.zones.length === 0) return

    const ws = workbook.addWorksheet('Forecast Pipeline', {
        properties: { tabColor: { argb: COLORS.headerBg } },
    })

    const months = poData.months || []
    const colCount = months.length + 3
    const rightOffset = colCount + 1 // 1-column gap
    const probLabel = data.filters.probability === 'all' ? 'All' : `>= ${data.filters.probability}%`

    // ── Helper: Apply header style with custom color ──
    const applyZoneHeaderStyle = (cell: any, bgColor: string): void => {
        cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = thinBorder(bgColor)
    }

    // ══════════════════════════════════════════════════════════════
    //  PART 1: EXECUTIVE-WISE PIPELINE (RIGHT SIDE)
    // ══════════════════════════════════════════════════════════════
    let rowRight = 1

    // Title
    ws.mergeCells(rowRight, rightOffset + 1, rowRight, rightOffset + colCount)
    const titleCellRight = ws.getCell(rowRight, rightOffset + 1)
    titleCellRight.value = `FORECAST PIPELINE — EXECUTIVE PERFORMANCE (${data.year})`
    titleCellRight.font = { size: 14, bold: true, color: { argb: COLORS.headerText } }
    titleCellRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    titleCellRight.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(rowRight).height = 30
    rowRight++

    // Subtitle
    ws.mergeCells(rowRight, rightOffset + 1, rowRight, rightOffset + colCount)
    const subCellRight = ws.getCell(rowRight, rightOffset + 1)
    subCellRight.value = `Values represent Expected PO Amount | Probability: ${probLabel}`
    subCellRight.font = { size: 10, italic: true, color: { argb: COLORS.textDark } }
    subCellRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCellRight.alignment = { horizontal: 'center', vertical: 'middle' }
    rowRight += 2

    // Loop through zones
    poData.zones.forEach((zone: any, zIdx: number) => {
        const zColor = ZONE_COLORS[zIdx % ZONE_COLORS.length]

        // Zone Title Row
        ws.mergeCells(rowRight, rightOffset + 1, rowRight, rightOffset + colCount)
        const zoneCell = ws.getCell(rowRight, rightOffset + 1)
        zoneCell.value = `ZONE: ${zone.zoneName} (Total: ${fmtCurrency(zone.grandTotal)})`
        zoneCell.font = { bold: true, size: 11, color: { argb: COLORS.headerText } }
        zoneCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zColor.bg } }
        ws.getRow(rowRight).height = 26
        rowRight++

        // Headers
        const headers = ['Executive', ...months, 'Total', 'Share %']
        headers.forEach((h, i) => {
            const cell = ws.getCell(rowRight, rightOffset + i + 1)
            cell.value = h
            applyZoneHeaderStyle(cell, zColor.light)
        })
        ws.getRow(rowRight).height = 22
        rowRight++

        // User rows
        zone.users?.forEach((user: any, uIdx: number) => {
            const bgColor = uIdx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd
            const share = zone.grandTotal > 0 ? user.total / zone.grandTotal : 0

            const nameCell = ws.getCell(rowRight, rightOffset + 1)
            nameCell.value = user.userName
            applyDataCell(nameCell, bgColor)
            nameCell.font = { bold: true, color: { argb: zColor.bg } }

            months.forEach((m: string, mIdx: number) => {
                const valCell = ws.getCell(rowRight, rightOffset + mIdx + 2)
                valCell.value = user.monthlyValues[m] || 0
                applyDataCell(valCell, bgColor, true, true)
            })

            const totalCell = ws.getCell(rowRight, rightOffset + months.length + 2)
            totalCell.value = user.total
            applyDataCell(totalCell, bgColor, true, true)
            totalCell.font = { bold: true, color: { argb: zColor.bg } }

            const shareCell = ws.getCell(rowRight, rightOffset + months.length + 3)
            shareCell.value = share
            applyDataCell(shareCell, bgColor, true, false, true)
            rowRight++
        })

        // Zone Totals row
        const totals = ['ZONE TOTAL', ...months.map((m: string) => zone.monthlyTotals[m] || 0), zone.grandTotal, 1]
        totals.forEach((val, i) => {
            const cell = ws.getCell(rowRight, rightOffset + i + 1)
            cell.value = val
            cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zColor.bg } }
            cell.border = {
                top: { style: 'medium' as const, color: { argb: zColor.bg } },
                left: { style: 'thin' as const, color: { argb: zColor.bg } },
                bottom: { style: 'medium' as const, color: { argb: zColor.bg } },
                right: { style: 'thin' as const, color: { argb: zColor.bg } },
            }
            cell.alignment = { horizontal: i === 0 ? 'center' : 'right', vertical: 'middle' }
            if (typeof val === 'number') {
                if (i === totals.length - 1) cell.numFmt = '0.0%'
                else cell.numFmt = '[$₹-en-IN]#,##0'
            }
        })
        ws.getRow(rowRight).height = 24
        rowRight += 2
    })

    // ══════════════════════════════════════════════════════════════
    //  PART 2: PRODUCT-WISE FORECAST BREAKDOWN (LEFT SIDE)
    // ══════════════════════════════════════════════════════════════
    let rowLeft = 1
    const pwfData = data.forecastData?.pwf
    if (pwfData && pwfData.zones && pwfData.zones.length > 0) {
        const pwfMonths = pwfData.months || months

        const productLabels = {
            'CONTRACT': 'Contract',
            'BD_SPARE': 'BD Spare',
            'SPARE_PARTS': 'Spare Parts',
            'KARDEX_CONNECT': 'Kardex Connect',
            'RELOCATION': 'Relocation',
            'SOFTWARE': 'Software',
            'OTHERS': 'Repairs & Others',
            'RETROFIT_KIT': 'Retrofit Kit',
            'UPGRADE_KIT': 'Optilife Upgrade',
            'TRAINING': 'Training'
        } as Record<string, string>

        const dataLabels = data.forecastData?.puz?.productTypes || data.forecastData?.pwf?.productTypes || []
        dataLabels.forEach((p: any) => {
            if (p.key && p.label) productLabels[p.key] = p.label
        })

        const dataProductKeys = new Set<string>()
        pwfData.zones.forEach((z: any) => {
            z.users?.forEach((u: any) => {
                u.products?.forEach((p: any) => {
                    if (p.productType) dataProductKeys.add(p.productType)
                })
            })
        })
        const activeProducts = Array.from(new Set([...Object.keys(productLabels), ...Array.from(dataProductKeys)])).sort()

        // Title
        ws.mergeCells(rowLeft, 1, rowLeft, colCount)
        const titleCellLeft = ws.getCell(rowLeft, 1)
        titleCellLeft.value = `PRODUCT-WISE FORECAST BREAKDOWN — ${data.year}`
        titleCellLeft.font = { size: 14, bold: true, color: { argb: COLORS.headerText } }
        titleCellLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
        titleCellLeft.alignment = { horizontal: 'center', vertical: 'middle' }
        ws.getRow(rowLeft).height = 30
        rowLeft++

        // Subtitle
        ws.mergeCells(rowLeft, 1, rowLeft, colCount)
        const subCellLeft = ws.getCell(rowLeft, 1)
        subCellLeft.value = `Segmented breakdown across regions | Probability: ${probLabel}`
        subCellLeft.font = { size: 10, italic: true, color: { argb: COLORS.textDark } }
        subCellLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
        subCellLeft.alignment = { horizontal: 'center', vertical: 'middle' }
        rowLeft += 2

        activeProducts.forEach((pType, pIdx) => {
            const pLabel = productLabels[pType] || pType
            const pColor = COLORS.product[pIdx % COLORS.product.length]

            ws.mergeCells(rowLeft, 1, rowLeft, colCount)
            const pCell = ws.getCell(rowLeft, 1)
            pCell.value = `PRODUCT: ${pLabel.toUpperCase()}`
            pCell.font = { bold: true, size: 11, color: { argb: COLORS.headerText } }
            pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pColor } }
            ws.getRow(rowLeft).height = 24
            rowLeft++

            const pHeaders = ['Zone', ...pwfMonths, 'Total', 'Share %']
            pHeaders.forEach((h: string, i: number) => {
                const cell = ws.getCell(rowLeft, i + 1)
                cell.value = h
                applyZoneHeaderStyle(cell, pColor)
            })
            ws.getRow(rowLeft).height = 22
            rowLeft++

            let productGrandTotal = 0
            const zoneRows: any[] = []

            pwfData.zones.forEach((zone: any) => {
                const monthlyTotals = pwfMonths.reduce((acc: any, m: string) => { acc[m] = 0; return acc }, {} as any)
                let zoneProductTotal = 0
                zone.users?.forEach((u: any) => {
                    const prodData = u.products?.find((p: any) => p.productType === pType)
                    if (prodData) {
                        zoneProductTotal += prodData.total
                        pwfMonths.forEach((m: string) => {
                            monthlyTotals[m] += prodData.monthlyValues[m] || 0
                        })
                    }
                })
                zoneRows.push({ name: zone.zoneName, totals: monthlyTotals, total: zoneProductTotal })
                productGrandTotal += zoneProductTotal
            })

            zoneRows.forEach((zRow, zIdx) => {
                const zBgColor = zIdx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd
                const zNameCell = ws.getCell(rowLeft, 1)
                zNameCell.value = zRow.name
                applyDataCell(zNameCell, zBgColor)
                zNameCell.font = { bold: true, color: { argb: COLORS.textDark } }

                pwfMonths.forEach((m: string, mIdx: number) => {
                    const mCell = ws.getCell(rowLeft, mIdx + 2)
                    mCell.value = zRow.totals[m]
                    applyDataCell(mCell, zBgColor, true, true)
                })

                const zTotalCell = ws.getCell(rowLeft, pwfMonths.length + 2)
                zTotalCell.value = zRow.total
                applyDataCell(zTotalCell, zBgColor, true, true)
                zTotalCell.font = { bold: true, color: { argb: pColor } }

                const zShareCell = ws.getCell(rowLeft, pwfMonths.length + 3)
                zShareCell.value = productGrandTotal > 0 ? zRow.total / productGrandTotal : 0
                applyDataCell(zShareCell, zBgColor, true, false, true)
                rowLeft++

                const pwfZone = pwfData.zones.find((z: any) => z.zoneName === zRow.name)
                const usersForZone = pwfZone?.users || []
                usersForZone.forEach((user: any) => {
                    const uProduct = user.products?.find((p: any) => p.productType === pType) || { total: 0, monthlyValues: {} }
                    const uBgColor = COLORS.rowOdd
                    const uNameCell = ws.getCell(rowLeft, 1)
                    uNameCell.value = `    • ${user.userName}`
                    applyDataCell(uNameCell, uBgColor)
                    uNameCell.font = { italic: true, size: 9, color: { argb: COLORS.textLight } }

                    pwfMonths.forEach((m: string, mIdx: number) => {
                        const umCell = ws.getCell(rowLeft, mIdx + 2)
                        umCell.value = uProduct.monthlyValues?.[m] || 0
                        applyDataCell(umCell, uBgColor, true, true)
                        umCell.font = { size: 9, color: { argb: COLORS.textLight } }
                    })

                    const utCell = ws.getCell(rowLeft, pwfMonths.length + 2)
                    utCell.value = uProduct.total || 0
                    applyDataCell(utCell, uBgColor, true, true)
                    utCell.font = { size: 9, italic: true, color: { argb: COLORS.textLight } }

                    const usCell = ws.getCell(rowLeft, pwfMonths.length + 3)
                    usCell.value = zRow.total > 0 ? (uProduct.total || 0) / zRow.total : 0
                    applyDataCell(usCell, uBgColor, true, false, true)
                    usCell.font = { size: 8, color: { argb: COLORS.textLight } }
                    rowLeft++
                })
            })

            if (zoneRows.length > 0) {
                ws.getCell(rowLeft, 1).value = `${pLabel} TOTAL`
                pwfMonths.forEach((m: string, i: number) => {
                    ws.getCell(rowLeft, i + 2).value = zoneRows.reduce((s, z) => s + z.totals[m], 0)
                })
                ws.getCell(rowLeft, pwfMonths.length + 2).value = productGrandTotal
                ws.getCell(rowLeft, pwfMonths.length + 3).value = 1
                for (let i = 1; i <= pwfMonths.length + 3; i++) {
                    applyTotalRow(ws.getCell(rowLeft, i), true, i > 1 && i < pwfMonths.length + 3, i === pwfMonths.length + 3)
                }
                ws.getRow(rowLeft).height = 24
                rowLeft += 2
            }
        })
    }

    // ── Column widths ──
    // Left side
    ws.getColumn(1).width = 25
    months.forEach((_: any, i: number) => ws.getColumn(i + 2).width = 15)
    ws.getColumn(months.length + 2).width = 16
    ws.getColumn(months.length + 3).width = 12

    // Gap
    ws.getColumn(rightOffset).width = 4

    // Right side
    ws.getColumn(rightOffset + 1).width = 25
    months.forEach((_: any, i: number) => ws.getColumn(rightOffset + i + 2).width = 15)
    ws.getColumn(rightOffset + months.length + 2).width = 16
    ws.getColumn(rightOffset + months.length + 3).width = 12
}

// ============ Sheet 6: Forecast By Product × Zone ============
function generateForecastProductZoneSheet(workbook: any, data: GrowthPillarExcelData): void {
    const pwfData = data.forecastData?.pwf
    if (!pwfData || !pwfData.zones) return

    const ws = workbook.addWorksheet('Forecast Product Breakdown', {
        properties: { tabColor: { argb: COLORS.kpiWon } },
    })

    const months = pwfData.months || []
    let row = 1

    // Product labels map (could come from pwf or puz)
    const productLabels = {
        'CONTRACT': 'Contract',
        'BD_SPARE': 'BD Spare',
        'SPARE_PARTS': 'Spare Parts',
        'KARDEX_CONNECT': 'Kardex Connect',
        'RELOCATION': 'Relocation',
        'SOFTWARE': 'Software',
        'OTHERS': 'Repairs & Others',
        'RETROFIT_KIT': 'Retrofit Kit',
        'UPGRADE_KIT': 'Optilife Upgrade',
        'TRAINING': 'Training'
    } as Record<string, string>

    // Merge labels from forecast data if available to ensure sync with dashboard 'page names'
    const dataLabels = data.forecastData?.puz?.productTypes || data.forecastData?.pwf?.productTypes || []
    dataLabels.forEach((p: any) => {
        if (p.key && p.label) productLabels[p.key] = p.label
    })

    // Get all product types from the actual data + standard ones
    const dataProductKeys = new Set<string>()
    pwfData.zones.forEach((z: any) => {
        z.users?.forEach((u: any) => {
            u.products?.forEach((p: any) => {
                if (p.productType) dataProductKeys.add(p.productType)
            })
        })
    })

    // Combine standard products (to ensure they shown even if 0) and data products
    const activeProducts = Array.from(new Set([...Object.keys(productLabels), ...Array.from(dataProductKeys)])).sort()

    // Title
    ws.mergeCells(row, 1, row, months.length + 3)
    const titleCell = ws.getCell(row, 1)
    titleCell.value = `PRODUCT × ZONE FORECAST ANALYSIS (${data.year})`
    titleCell.font = { size: 16, bold: true, color: { argb: COLORS.headerText } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 30
    row++

    // Subtitle
    ws.mergeCells(row, 1, row, months.length + 3)
    const subCell = ws.getCell(row, 1)
    const probLabel = data.filters.probability === 'all' ? 'All' : `>= ${data.filters.probability}%`
    subCell.value = `Segmented breakdown of pipeline across all products and regions | Probability: ${probLabel}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textDark } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    row += 2

    // Process products one by one
    activeProducts.forEach((pType, pIdx) => {
        const pLabel = productLabels[pType] || pType
        const pColor = COLORS.product[pIdx % COLORS.product.length]

        // Product Header
        ws.mergeCells(row, 1, row, months.length + 3)
        const pCell = ws.getCell(row, 1)
        pCell.value = `PRODUCT: ${pLabel.toUpperCase()}`
        pCell.font = { bold: true, color: { argb: COLORS.headerText } }
        pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pColor } }
        row++

        // Table Headers
        const headers = ['Zone', ...months, 'Total', 'Product Share %']
        headers.forEach((h: string, i: number) => {
            const cell = ws.getCell(row, i + 1)
            cell.value = h
            applyHeaderStyle(cell)
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pColor } }
        })
        row++

        // Calculate product grand total across all zones
        let productGrandTotal = 0
        const zoneRows: any[] = []

        pwfData.zones.forEach((zone: any) => {
            const monthlyTotals = months.reduce((acc: any, m: string) => { acc[m] = 0; return acc }, {} as any)
            let zoneProductTotal = 0

            zone.users?.forEach((u: any) => {
                const prodData = u.products?.find((p: any) => p.productType === pType)
                if (prodData) {
                    zoneProductTotal += prodData.total
                    months.forEach((m: string) => {
                        monthlyTotals[m] += prodData.monthlyValues[m] || 0
                    })
                }
            })

            // Add all zones even if 0
            zoneRows.push({ name: zone.zoneName, totals: monthlyTotals, total: zoneProductTotal })
            productGrandTotal += zoneProductTotal
        })

        // Add Zone and User rows
        zoneRows.forEach((zRow, zIdx) => {
            const zBgColor = zIdx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd

            // Zone Row
            const zNameCell = ws.getCell(row, 1)
            zNameCell.value = zRow.name
            applyDataCell(zNameCell, zBgColor)
            zNameCell.font = { bold: true, color: { argb: COLORS.textDark } }

            months.forEach((m: string, mIdx: number) => {
                const mCell = ws.getCell(row, mIdx + 2)
                mCell.value = zRow.totals[m]
                applyDataCell(mCell, zBgColor, true, true)
            })

            const zTotalCell = ws.getCell(row, months.length + 2)
            zTotalCell.value = zRow.total
            applyDataCell(zTotalCell, zBgColor, true, true)
            zTotalCell.font = { bold: true, color: { argb: pColor } }

            const zShareCell = ws.getCell(row, months.length + 3)
            zShareCell.value = productGrandTotal > 0 ? zRow.total / productGrandTotal : 0
            applyDataCell(zShareCell, zBgColor, true, false, true)
            row++

            // Add ALL User rows for this zone and product
            const pwfZone = pwfData.zones.find((z: any) => z.zoneName === zRow.name)
            const usersForZone = pwfZone?.users || []

            usersForZone.forEach((user: any) => {
                const uProduct = user.products?.find((p: any) => p.productType === pType) || { total: 0, monthlyValues: {} }
                const uBgColor = COLORS.rowOdd

                // Indented User Row
                const uNameCell = ws.getCell(row, 1)
                uNameCell.value = `    • ${user.userName}`
                applyDataCell(uNameCell, uBgColor)
                uNameCell.font = { italic: true, size: 9, color: { argb: COLORS.textLight } }

                months.forEach((m: string, mIdx: number) => {
                    const umCell = ws.getCell(row, mIdx + 2)
                    umCell.value = uProduct.monthlyValues?.[m] || 0
                    applyDataCell(umCell, uBgColor, true, true)
                    umCell.font = { size: 9, color: { argb: COLORS.textLight } }
                })

                const utCell = ws.getCell(row, months.length + 2)
                utCell.value = uProduct.total || 0
                applyDataCell(utCell, uBgColor, true, true)
                utCell.font = { size: 9, italic: true, color: { argb: COLORS.textLight } }

                const usCell = ws.getCell(row, months.length + 3)
                usCell.value = zRow.total > 0 ? (uProduct.total || 0) / zRow.total : 0
                applyDataCell(usCell, uBgColor, true, false, true)
                usCell.font = { size: 8, color: { argb: COLORS.textLight } }

                row++
            })
        })

        // Product total row
        if (zoneRows.length > 0) {
            ws.getCell(row, 1).value = `${pLabel} TOTAL`
            months.forEach((m: string, i: number) => {
                ws.getCell(row, i + 2).value = zoneRows.reduce((s, z) => s + z.totals[m], 0)
            })
            ws.getCell(row, months.length + 2).value = productGrandTotal
            ws.getCell(row, months.length + 3).value = 1

            for (let i = 1; i <= months.length + 3; i++) {
                applyTotalRow(ws.getCell(row, i), true, i > 1 && i < months.length + 3, i === months.length + 3)
            }
            row += 2
        }
    })

    // Column widths
    ws.getColumn(1).width = 18
    ws.getColumn(months.length + 2).width = 16
    ws.getColumn(months.length + 3).width = 16
    months.forEach((_: any, i: number) => ws.getColumn(i + 2).width = 14)
}

// ============ Main Export Function ============
export async function exportGrowthPillarToExcel(data: GrowthPillarExcelData): Promise<void> {
    // Dynamic imports for bundle optimization
    const ExcelJSModule = await import('exceljs')
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'KardexCare Growth Pillar Dashboard'
    workbook.lastModifiedBy = 'KardexCare System'
    workbook.created = new Date()
    workbook.modified = new Date()

    // Generate all sheets
    generateSummarySheet(workbook, data)
    generateMonthlySheet(workbook, data)
    generateProductMonthlySheet(workbook, data)
    generateForecastPipelineSheet(workbook, data)
    generateInsightsSheet(workbook, data)

    // Generate filename
    const zoneLabel = data.filters.zoneId
        ? data.filters.zones.find(z => z.id === data.filters.zoneId)?.name?.replace(/\s+/g, '_') || 'Zone'
        : 'All_Zones'
    const userLabel = data.filters.userId
        ? `${data.filters.users.find(u => u.id === data.filters.userId)?.name?.replace(/\s+/g, '_')}_`
        : ''
    const dateStr = new Date().toISOString().split('T')[0]
    const fromM = MONTH_NAMES[data.fromMonth - 1].substring(0, 3)
    const toM = MONTH_NAMES[data.toMonth - 1].substring(0, 3)
    const filename = `${userLabel}${zoneLabel}_Growth_Report_${data.year}_${fromM}-${toM}_${dateStr}.xlsx`

    // Write buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
}

