/**
 * Growth Pillar Excel Export Utility — Kardex Brand Design
 * Generates professionally styled multi-sheet Excel workbook using ExcelJS
 * with Summary, Monthly Breakdown, Product-wise, and Insights sheets.
 *
 * Data shape matches GrowthPillarPdfData from growth-report-pdf.ts
 */

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

// ============ Color Scheme (ARGB Hex without FF prefix – ExcelJS adds it) ============
const COLORS = {
    headerBg: '1E3A8A',      // Deep blue
    headerText: 'FFFFFF',
    titleBg: 'EFF6FF',
    titleText: '1E40AF',

    // KPI accent
    kpiTarget: '6366F1',     // Indigo
    kpiOffer: 'F59E0B',      // Amber
    kpiWon: '10B981',        // Emerald
    kpiAchieve: '06B6D4',    // Cyan
    kpiHitRate: '8B5CF6',    // Purple

    // Status
    positive: '059669',
    positiveBg: 'D1FAE5',
    warning: 'D97706',
    warningBg: 'FEF3C7',
    negative: 'DC2626',
    negativeBg: 'FEE2E2',

    // Table
    rowEven: 'F8FAFC',
    rowOdd: 'FFFFFF',
    borderLight: 'E2E8F0',
    totalRowBg: 'E0E7FF',
    grandTotalBg: '1E3A8A',

    // Product accent palette
    product: ['6366F1', 'EC4899', 'F59E0B', '10B981', '06B6D4', '8B5CF6', 'EF4444', '14B8A6', 'F97316'],

    // Text
    textDark: '1E293B',
    textLight: '64748B',

    // Insight types
    success: '059669',
    successBg: 'D1FAE5',
    info: '2563EB',
    infoBg: 'DBEAFE',
    error: 'DC2626',
    errorBg: 'FEE2E2',
    action: '4F46E5',
    actionBg: 'E0E7FF',
}

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
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}  |  Generated: ${new Date().toLocaleString('en-IN')}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textLight } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
    row += 2

    // KPI Row
    const kpis = [
        { label: 'Total Target', value: data.totals.target, sub: `${data.totals.offerCount} offers`, accent: COLORS.kpiTarget, isPercent: false },
        { label: 'Offer Value', value: data.totals.offerValue, sub: `${data.totals.offerCount} offers created`, accent: COLORS.kpiOffer, isPercent: false },
        { label: 'Won Value', value: data.totals.wonValue, sub: `${data.totals.wonCount} orders won`, accent: COLORS.kpiWon, isPercent: false },
        { label: 'Achievement', value: data.totals.achievementPercent / 100, sub: 'Won / Target', accent: COLORS.kpiAchieve, isPercent: true },
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
        cell.font = { size: 8, italic: true, color: { argb: kpi.accent } }
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

        const prodHeaders = ['Product', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achievement %', 'Hit Rate %']
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
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textLight } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
    row += 2

    // Headers
    const headers = ['Month', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achievement %', 'Hit Rate %', 'MoM Growth']
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
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textLight } }
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
        prodHeader.value = `${product.productLabel}  |  Target: ${fmtCurrency(product.target)}  |  Won: ${fmtCurrency(product.wonValue)}  |  Achievement: ${product.achievementPercent}%  |  Hit Rate: ${product.hitRatePercent}%`
        prodHeader.font = { size: 11, bold: true, color: { argb: COLORS.headerText } }
        prodHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pColor } }
        prodHeader.alignment = { horizontal: 'left', vertical: 'middle' }
        ws.getRow(row).height = 26
        row++

        // Column headers
        const headers = ['Month', 'Target', 'Offer Value', 'Won Value', 'Offers', 'Won', 'Achievement %', 'Growth']
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
    subCell.value = `${MONTH_NAMES[data.fromMonth - 1]} – ${MONTH_NAMES[data.toMonth - 1]} ${data.year}  |  ${zoneName}${userName ? `  |  ${userName}` : ''}`
    subCell.font = { size: 10, italic: true, color: { argb: COLORS.textLight } }
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
            cell.font = { bold: true, size: 9, color: { argb: COLORS.textLight } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }
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
    const filename = `${userLabel}${zoneLabel}_Growth_Pillar_${data.year}_${fromM}-${toM}_${dateStr}.xlsx`

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
