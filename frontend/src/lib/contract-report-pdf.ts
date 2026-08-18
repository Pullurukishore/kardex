/**
 * Contract Reports PDF Generation Utility — Kardex Brand Design
 * Generates straightforward, schedule-focused PDF using jsPDF + autoTable
 * Tailored for PM planning, technician assignments, and visit execution
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

// ============ Date / Formatting Helpers ============
const fmtDatePdf = (iso: string): string => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const parseRangeDates = (range: string | null | undefined): { startDate: string; endDate: string } => {
    if (!range) return { startDate: '—', endDate: '—' }
    const parts = range.split(/\s+(?:TO|to|-)\s+/)
    if (parts.length >= 2) {
        return {
            startDate: parts[0]?.trim() || '—',
            endDate: parts[parts.length - 1]?.trim() || '—'
        }
    }
    return { startDate: range.trim(), endDate: '—' }
}

const fmtDateBadge = (dStr?: string) => {
    if (!dStr) return ''
    const d = new Date(dStr)
    if (isNaN(d.getTime())) return dStr
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const parseDateObj = (str: string): Date | null => {
    if (!str) return null
    str = str.trim()

    // Check DD/MM/YYYY or DD.MM.YYYY
    const slashDot = str.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/)
    if (slashDot) {
        const d = parseInt(slashDot[1], 10)
        const m = parseInt(slashDot[2], 10) - 1
        let y = parseInt(slashDot[3], 10)
        if (y < 100) y += 2000
        return new Date(y, m, d)
    }

    // Check YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10))
    }

    // Check DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
    if (dmyMatch) {
        let y = parseInt(dmyMatch[3], 10)
        if (y < 100) y += 2000
        return new Date(y, parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10))
    }

    // Check DD-MMM-YYYY or DD MMM YYYY (e.g. 15-Oct-2026, 15 Oct 2026)
    const wordMatch = str.match(/^(\d{1,2})[-\s]+([A-Za-z]+)[-\s]+(\d{2,4})$/)
    if (wordMatch) {
        const d = parseInt(wordMatch[1], 10)
        const mStr = wordMatch[2].toLowerCase().slice(0, 3)
        const m = months.indexOf(mStr)
        let y = parseInt(wordMatch[3], 10)
        if (y < 100) y += 2000
        if (m >= 0) return new Date(y, m, d)
    }

    // Check 'Month YYYY' (e.g. October 2026)
    const monthYearMatch = str.match(/^([A-Za-z]+)[-\s]+(\d{2,4})$/)
    if (monthYearMatch) {
        const mStr = monthYearMatch[1].toLowerCase().slice(0, 3)
        const m = months.indexOf(mStr)
        let y = parseInt(monthYearMatch[2], 10)
        if (y < 100) y += 2000
        if (m >= 0) return new Date(y, m, 1)
    }

    const fallback = new Date(str)
    return isNaN(fallback.getTime()) ? null : fallback
}

const isPMInRange = (pmRange: string | null | undefined, dateFrom?: string, dateTo?: string, status?: string): boolean => {
    if (!dateFrom && !dateTo) return true
    if (!pmRange) return true

    const parts = pmRange.split(/\s+(?:TO|to|-)\s+/)
    const startObj = parseDateObj(parts[0])
    const endObj = parts.length >= 2 ? parseDateObj(parts[parts.length - 1]) : startObj

    // If dateTo is provided: Any PM scheduled AFTER dateTo must be EXCLUDED!
    if (dateTo) {
        const toObj = new Date(dateTo)
        toObj.setHours(23, 59, 59, 999)
        if (startObj && startObj > toObj) return false
        if (!startObj && endObj && endObj > toObj) return false
    }

    // If dateFrom is provided: Completed PMs done before dateFrom are excluded.
    // Active / Pending / Overdue PMs due up to dateTo are kept.
    if (dateFrom && status === 'Completed') {
        const fromObj = new Date(dateFrom)
        fromObj.setHours(0, 0, 0, 0)
        if (endObj && endObj < fromObj) return false
    }

    return true
}

const isRangeOverdue = (range: string): boolean => {
    try {
        const parts = range.split(/\s+(?:TO|to|-)\s+/)
        const endStr = parts[parts.length - 1]?.trim()
        if (!endStr) return false
        const now = new Date()
        const endDateObj = parseDateObj(endStr)
        return endDateObj ? endDateObj < now : false
    } catch { return false }
}

const getDaysRemainingPdf = (endDate: string): number => {
    if (!endDate) return 0
    return Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

const fmtCurrency = (v: number): string => {
    if (v === 0) return '₹0'
    return `₹${Number(v).toLocaleString('en-IN')}`
}

// ============ PDF Header / Footer Drawing Helpers ============
async function loadLogoBase64(): Promise<string | null> {
    try {
        const response = await fetch('/kardex-only.png')
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
    doc.rect(0, 0, pageW, 26, 'F')
    doc.setFillColor(...COLORS.headerLight)
    doc.rect(0, 22, pageW, 3, 'F')
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(0, 25, pageW, 1, 'F')
}

function drawHeader(doc: any, filters: any, logoBase64: string | null): number {
    const pageW = doc.internal.pageSize.getWidth()
    drawGradientHeader(doc, pageW)

    // Logo
    const logoRectW = 45, logoRectH = 15, logoX = 10, logoY = 5
    doc.setFillColor(...COLORS.white)
    doc.roundedRect(logoX, logoY, logoRectW, logoRectH, 1.5, 1.5, 'F')
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', logoX + 5, logoY + 3.5, 35, 8)
        } catch {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...COLORS.textDark)
            doc.text('KARDEX', logoX + logoRectW / 2, logoY + logoRectH / 2 + 1, { align: 'center' })
        }
    } else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...COLORS.textDark)
        doc.text('KARDEX', logoX + logoRectW / 2, logoY + logoRectH / 2 + 1, { align: 'center' })
    }

    // Title
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...COLORS.white)
    doc.text('PREVENTIVE MAINTENANCE & CONTRACT SCHEDULE REPORT', 60, 12)

    // Subtitle / Filters
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.accentCyan)
    const filterParts: string[] = []
    if (filters.responsible && filters.responsible !== 'All') filterParts.push(`Responsible: ${filters.responsible}`)
    if (filters.zone && filters.zone !== 'All') filterParts.push(`Zone: ${filters.zone}`)
    if (filters.status && filters.status !== 'All') filterParts.push(`Status: ${filters.status}`)
    if (filters.mcType && filters.mcType !== 'All') filterParts.push(`MC Type: ${filters.mcType}`)
    if (filters.dateFrom || filters.dateTo) {
        filterParts.push(`Date Filter: ${fmtDateBadge(filters.dateFrom)} to ${fmtDateBadge(filters.dateTo)}`)
    }
    const subtitle = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Contracts & PM Visits'
    doc.text(subtitle, 60, 19)

    // Date badge on top right
    const badgeW = 62, badgeX = pageW - 72, badgeH = 16, badgeY = 5
    doc.setFillColor(...COLORS.headerLight)
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...COLORS.white)
    if (filters.dateFrom && filters.dateTo) {
        doc.text(`${fmtDateBadge(filters.dateFrom)} – ${fmtDateBadge(filters.dateTo)}`, badgeX + badgeW / 2, badgeY + 6, { align: 'center' })
    } else {
        doc.text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, badgeX + badgeW / 2, badgeY + 6, { align: 'center' })
    }
    doc.setFontSize(6); doc.setTextColor(...COLORS.accentCyan)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, badgeX + badgeW / 2, badgeY + 12, { align: 'center' })

    return 30
}

function drawFooter(doc: any, pageNum: number) {
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...COLORS.headerBg)
    doc.rect(0, pageH - 8, pageW, 8, 'F')
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(0, pageH - 8, pageW, 0.4, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...COLORS.accentCyan)
    doc.text('Kardex  |  Preventive Maintenance & Scheduling Report  |  Confidential', 12, pageH - 3)
    doc.setTextColor(...COLORS.white)
    doc.text(`Page ${pageNum}`, pageW - 20, pageH - 3)
}

function drawKPICard(doc: any, x: number, y: number, w: number, h: number, label: string, value: string, accentColor: [number, number, number], subLabel?: string) {
    doc.setFillColor(...COLORS.cardBg)
    doc.roundedRect(x, y, w, h, 2, 2, 'F')
    doc.setDrawColor(...COLORS.cardBorder); doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, 2, 2, 'S')
    doc.setFillColor(...accentColor)
    doc.rect(x, y, w, 2.5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...COLORS.textMuted)
    doc.text(label.toUpperCase(), x + 4, y + 8.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...COLORS.textDark)
    doc.text(value, x + 4, y + 17.5)
    if (subLabel) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...accentColor)
        doc.text(subLabel, x + 4, y + 22.5)
    }
}

// ============ Main Scheduling PDF Generator ============
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
    const pageNum = { val: 1 }

    let y = drawHeader(doc, filters, logoBase64)

    // ── Calculate Scheduling KPIs from Filtered Data ──
    let totalPMs = 0
    let completedPMs = 0
    let pendingPMs = 0
    let overduePMs = 0
    let totalContractsCount = 0
    let totalMachinesCount = 0

    // Flatten all PM schedules from filtered data
    const pmScheduleRows: any[] = []

    data.forEach(cust => {
        (cust.contracts || []).forEach((c: any) => {
            const applicablePMs = (c.pmSchedules || []).filter((p: any) => p.status !== 'Not Applicable')

            // Filter PMs by date range if dateFrom/dateTo is provided
            const matchingPMs = applicablePMs.filter((pm: any) => isPMInRange(pm.range, filters.dateFrom, filters.dateTo, pm.status))
            if (matchingPMs.length === 0) return

            totalContractsCount++
            totalMachinesCount += (c.noOfMachine || 1)

            matchingPMs.forEach((pm: any) => {
                totalPMs++
                const isDone = pm.status === 'Completed'
                const isOverdue = !isDone && pm.range && isRangeOverdue(pm.range)

                if (isDone) completedPMs++
                else if (isOverdue) overduePMs++
                else pendingPMs++

                const { startDate: pmStart, endDate: pmEnd } = parseRangeDates(pm.range)
                const hasDept = c.customerName && c.customerName !== cust.customerName
                const customerDisplay = hasDept ? `${cust.customerName} (${c.customerName})` : cust.customerName

                pmScheduleRows.push({
                    customerName: customerDisplay,
                    place: cust.place || c.place || '—',
                    zoneName: cust.zoneName || c.zoneName || '—',
                    contractNumber: c.contractNumber || '—',
                    mcType: c.mcType || '—',
                    pmNumber: `PM ${pm.pmNumber}`,
                    pmStartDate: pmStart,
                    pmEndDate: pmEnd,
                    range: pm.range || '—',
                    status: isDone ? 'Completed' : isOverdue ? 'Overdue' : 'Pending',
                    completedAt: pm.completedAt ? fmtDatePdf(pm.completedAt) : '—',
                    responsible: c.responsible || '—',
                    endDate: fmtDatePdf(c.endDate),
                    daysLeft: getDaysRemainingPdf(c.endDate)
                })
            })
        })
    })

    // ── Draw 5 Clean KPI Cards ──
    const cardW = (pageW - 40) / 5
    const kpis = [
        { label: 'Total PM Visits', value: String(totalPMs), sub: `${totalContractsCount} contracts (${totalMachinesCount} machines)`, color: COLORS.headerBg },
        { label: 'Completed PMs', value: String(completedPMs), sub: totalPMs > 0 ? `${Math.round((completedPMs / totalPMs) * 100)}% execution` : '0%', color: COLORS.positive },
        { label: 'Pending PMs', value: String(pendingPMs), sub: 'Scheduled & upcoming', color: COLORS.warning },
        { label: 'Overdue PMs', value: String(overduePMs), sub: overduePMs > 0 ? 'Requires attention!' : 'On schedule', color: overduePMs > 0 ? COLORS.negative : COLORS.positive },
        { label: 'Portfolio Value', value: fmtCurrency(summary?.totalValue || 0), sub: `${data.length} customers in view`, color: COLORS.accentCyan }
    ]

    kpis.forEach((kpi, i) => {
        drawKPICard(doc, 10 + i * (cardW + 5), y, cardW, 25, kpi.label, kpi.value, kpi.color, kpi.sub)
    })
    y += 29

    // ── Master PM Scheduling Table ──
    if (pmScheduleRows.length > 0) {
        const tableHeaders = [
            'S.No', 'Customer Name', 'Place', 'Zone',
            'MC Type', 'PM Visit', 'PM Start Date', 'PM End Date', 'Status',
            'Responsible', 'Contract Expiry'
        ]

        const tableBody = pmScheduleRows.map((row, idx) => {
            return [
                String(idx + 1),
                row.customerName,
                row.place,
                row.zoneName,
                row.mcType,
                row.pmNumber,
                row.pmStartDate,
                row.pmEndDate,
                row.status,
                row.responsible,
                row.endDate
            ]
        })

        autoTable(doc, {
            startY: y,
            head: [tableHeaders],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.headerBg,
                textColor: COLORS.white,
                fontSize: 7,
                fontStyle: 'bold',
                halign: 'center',
                cellPadding: 2,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            bodyStyles: {
                fontSize: 6.8,
                textColor: COLORS.textBody,
                halign: 'center',
                cellPadding: 2,
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },                               // S.No
                1: { cellWidth: 52, halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark }, // Customer Name
                2: { cellWidth: 25, halign: 'left' },                                 // Place
                3: { cellWidth: 16, halign: 'center' },                               // Zone
                4: { cellWidth: 22, halign: 'center' },                               // MC Type
                5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },            // PM Visit
                6: { cellWidth: 26, halign: 'center' },                               // PM Start Date
                7: { cellWidth: 26, halign: 'center' },                               // PM End Date
                8: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },            // Status
                9: { cellWidth: 34, halign: 'left' },                                 // Responsible
                10: { cellWidth: 26, halign: 'center' },                              // Contract Expiry
            },
            willDrawCell: (hookData: any) => {
                // Highlight Status Column (Index 8)
                if (hookData.section === 'body' && hookData.column.index === 8) {
                    const val = hookData.cell.raw
                    if (val === 'Completed') {
                        hookData.cell.styles.textColor = hexToRgb(kardexGreen[2])
                        hookData.cell.styles.fontStyle = 'bold'
                    } else if (val === 'Overdue') {
                        hookData.cell.styles.textColor = hexToRgb(kardexRed[1])
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
            margin: { left: 10, right: 10, bottom: 12 },
        })
    } else {
        // Empty state message
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...COLORS.textMuted)
        doc.text('No PM schedules found matching the selected filters.', pageW / 2, y + 20, { align: 'center' })
        drawFooter(doc, pageNum.val)
    }

    // Save PDF with clean short filename
    doc.save('Contract_Schedule_Report.pdf')
}
