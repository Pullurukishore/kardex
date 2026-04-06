/**
 * Reports PDF Generation Utility — Kardex Brand Design
 * Generates premium analytics PDFs for all report types using jsPDF + autoTable
 * Matches the design language from growth-report-pdf.ts & forecast-pdf-utils.ts
 *
 * Currently supports:
 *   - Ticket Analytics (ticket-summary)
 *   - Service Person Performance (agent-productivity)
 *
 * Note: jsPDF default Helvetica does NOT support Unicode.
 *       All text uses ASCII-safe characters only (no ₹, etc.).
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
    // Section accent colors
    sectionBlue: [111, 138, 157] as [number, number, number],
    sectionGreen: [130, 160, 148] as [number, number, number],
    sectionSand: [206, 159, 107] as [number, number, number],
    sectionRed: [158, 59, 71] as [number, number, number],
    sectionPurple: [139, 92, 246] as [number, number, number],
}

// ============ Formatting Helpers (ASCII-safe) ============
const fmtNum = (v: number): string => {
    if (v === 0) return '0'
    return new Intl.NumberFormat('en-IN').format(v)
}

const fmtHoursMinutes = (totalMinutes: number): string => {
    if (!totalMinutes || totalMinutes <= 0) return '0h 0m'
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    return hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`
}

const fmtHours = (hours: number): string => {
    if (!hours || hours <= 0) return 'N/A'
    return `${hours.toFixed(1)}h`
}

const fmtPct = (v: number | null | undefined): string => {
    if (v === null || v === undefined || isNaN(v)) return '-'
    return `${v.toFixed(1)}%`
}

const cleanText = (text: string): string => {
    return text
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[^\x20-\x7E]/g, '')
        .trim()
}

const fmtDate = (d: Date | string): string => {
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

function drawHeader(doc: any, title: string, subtitle: string, logoBase64: string | null): number {
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
    doc.text(cleanText(title), 62, 13)

    // Subtitle
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.accentCyan)
    doc.text(cleanText(subtitle), 62, 21)

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

function drawFooter(doc: any, pageNum: number, reportTitle: string) {
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...COLORS.headerBg)
    doc.rect(0, pageH - 10, pageW, 10, 'F')
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(0, pageH - 10, pageW, 0.4, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...COLORS.accentCyan)
    doc.text(`Kardex Remstar  |  ${cleanText(reportTitle)}  |  Confidential`, 15, pageH - 4)
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
    doc.text(cleanText(title), 23, y + 7)
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
    doc.text(cleanText(label.toUpperCase()), x + 5, y + 11)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...COLORS.textDark)
    doc.text(cleanText(value), x + 5, y + 23)
    if (subLabel) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...accentColor)
        doc.text(cleanText(subLabel), x + 5, y + 30)
    }
}

function ensurePage(doc: any, y: number, needed: number, pageNum: { val: number }, title: string, subtitle: string, logoBase64: string | null, reportTitle: string): number {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        drawFooter(doc, pageNum.val, reportTitle)
        pageNum.val++
        doc.addPage()
        return drawHeader(doc, title, subtitle, logoBase64)
    }
    return y
}

function drawInsightRow(doc: any, x: number, y: number, w: number, text: string, type: string): number {
    const itemColor = type === 'success' ? COLORS.positive
        : type === 'warning' ? COLORS.warning
            : type === 'error' ? COLORS.negative
                : type === 'action' ? COLORS.sectionPurple
                    : COLORS.accentCyan

    const badge = type === 'success' ? 'OK' : type === 'warning' ? '!!' : type === 'error' ? 'XX' : type === 'action' ? '>>' : 'ii'

    const cleanedText = cleanText(text)
    const maxTextW = w - 40
    const lines = doc.splitTextToSize(cleanedText, maxTextW)
    const lineHeight = 4
    const rowHeight = 8 + (lines.length > 1 ? (lines.length - 1) * lineHeight : 0)

    doc.setFillColor(...COLORS.offWhite)
    doc.roundedRect(x, y, w, rowHeight, 1, 1, 'F')

    doc.setFillColor(...itemColor)
    doc.roundedRect(x, y, 2, rowHeight, 0.5, 0.5, 'F')

    doc.setFillColor(...itemColor)
    doc.roundedRect(x + 4, y + 1.5, 8, 5, 1, 1, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...COLORS.white)
    doc.text(badge, x + 8, y + 5, { align: 'center' })

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.textDark)
    doc.text(lines, x + 15, y + 5)

    return rowHeight + 2
}

// ============ TICKET ANALYTICS PDF ============
async function generateTicketAnalyticsPdf(
    doc: any, autoTable: any,
    data: any, filters: any, zones: any[],
    logoBase64: string | null
): Promise<void> {
    const pageW = doc.internal.pageSize.getWidth()
    const pageNum = { val: 1 }
    const reportTitle = 'Ticket Analytics Report'

    // Build subtitle
    const zoneName = filters.zoneId ? zones.find((z: any) => z.id?.toString() === filters.zoneId)?.name : 'All Zones'
    const dateFrom = filters.dateRange?.from ? fmtDate(filters.dateRange.from) : ''
    const dateTo = filters.dateRange?.to ? fmtDate(filters.dateRange.to) : ''
    const subtitle = `${dateFrom ? dateFrom + ' - ' + dateTo : 'All Time'}  |  ${zoneName || 'All Zones'}`

    let y = drawHeader(doc, reportTitle, subtitle, logoBase64)

    const summary = data.summary || {}
    const statusDistribution = data.statusDistribution || {}
    const priorityDistribution = data.priorityDistribution || {}
    const zoneDistribution = data.zoneDistribution || []
    const customerDistribution = data.customerDistribution || []
    const insights = data.insights || {}

    const totalTickets = summary.totalTickets || 0
    const resolvedTickets = summary.resolvedTickets || 0
    const resolutionRate = totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100) : 0
    const avgResolutionTime = fmtHoursMinutes(summary.averageResolutionTime || 0)
    const avgFirstResponse = fmtHoursMinutes(summary.averageFirstResponseTime || 0)
    const avgTravelTime = fmtHoursMinutes(summary.avgOnsiteTravelTime || 0)
    const avgOnsiteResolution = fmtHoursMinutes(summary.averageOnsiteResolutionTime || 0)
    const totalOnsiteVisits = summary.totalOnsiteVisits || 0

    // ── KPI CARDS ──
    y = drawSectionTitle(doc, y, 'EXECUTIVE SUMMARY')
    const cardW = (pageW - 50) / 4
    const kpis = [
        { label: 'Total Tickets', value: fmtNum(totalTickets), sub: `${resolvedTickets} resolved`, color: COLORS.headerBg },
        { label: 'Resolution Rate', value: fmtPct(resolutionRate), sub: `${resolvedTickets} of ${totalTickets}`, color: COLORS.positive },
        { label: 'Avg Resolution', value: avgResolutionTime, sub: 'Business hours', color: COLORS.warning },
        { label: 'First Response', value: avgFirstResponse, sub: 'Average time', color: COLORS.sectionBlue },
    ]
    kpis.forEach((kpi, i) => {
        drawKPICard(doc, 20 + i * (cardW + 2.5), y, cardW, 34, kpi.label, kpi.value, kpi.color, kpi.sub)
    })
    y += 40

    // ── ROW 2 KPIs ──
    const kpis2 = [
        { label: 'Avg Travel Time', value: avgTravelTime, sub: 'Per onsite visit (real-time)', color: COLORS.accentCyan },
        { label: 'Avg Onsite Work', value: avgOnsiteResolution, sub: 'In-progress to resolved', color: COLORS.kardexGreen },
        { label: 'Onsite Visits', value: fmtNum(totalOnsiteVisits), sub: totalTickets > 0 ? `${((totalOnsiteVisits / totalTickets) * 100).toFixed(0)}% of tickets` : '0% of tickets', color: COLORS.kardexSilver },
        { label: 'Critical Issues', value: fmtNum(summary.criticalTickets || 0), sub: 'High priority items', color: COLORS.negative },
    ]
    const cardW2 = (pageW - 50) / 4
    kpis2.forEach((kpi, i) => {
        drawKPICard(doc, 20 + i * (cardW2 + 2.5), y, cardW2, 34, kpi.label, kpi.value, kpi.color, kpi.sub)
    })
    y += 40

    // ── STATUS DISTRIBUTION TABLE ──
    const statusEntries = Object.entries(statusDistribution)
    if (statusEntries.length > 0) {
        y = ensurePage(doc, y, 50, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
        y = drawSectionTitle(doc, y, 'STATUS DISTRIBUTION', COLORS.sectionBlue)

        const totalStatusCount = statusEntries.reduce((sum, [, count]) => sum + (count as number), 0)

        autoTable(doc, {
            startY: y,
            head: [['Status', 'Count', 'Percentage', 'Visual']],
            body: statusEntries
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([status, count]) => {
                    const pct = totalStatusCount > 0 ? ((count as number) / totalStatusCount * 100).toFixed(1) : '0'
                    const bar = '|'.repeat(Math.min(Math.round((count as number) / totalStatusCount * 30), 30))
                    return [
                        status.replace(/_/g, ' '),
                        String(count),
                        `${pct}%`,
                        bar
                    ]
                }),
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.sectionBlue,
                textColor: COLORS.white,
                fontSize: 7, fontStyle: 'bold', halign: 'center',
            },
            bodyStyles: { fontSize: 7, textColor: COLORS.textBody, halign: 'center' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark, cellWidth: 55 },
                3: { halign: 'left', textColor: COLORS.sectionBlue, fontStyle: 'bold', fontSize: 5 },
            },
            margin: { left: 15, right: 15 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
    }

    // ── PRIORITY DISTRIBUTION TABLE ──
    const priorityEntries = Object.entries(priorityDistribution)
    if (priorityEntries.length > 0) {
        y = ensurePage(doc, y, 40, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
        y = drawSectionTitle(doc, y, 'PRIORITY DISTRIBUTION', COLORS.kardexGreen)

        const totalPriorityCount = priorityEntries.reduce((sum, [, count]) => sum + (count as number), 0)

        autoTable(doc, {
            startY: y,
            head: [['Priority', 'Count', 'Percentage']],
            body: priorityEntries
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([priority, count]) => {
                    const pct = totalPriorityCount > 0 ? ((count as number) / totalPriorityCount * 100).toFixed(1) : '0'
                    return [priority, String(count), `${pct}%`]
                }),
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.kardexGreen,
                textColor: COLORS.white,
                fontSize: 7, fontStyle: 'bold', halign: 'center',
            },
            bodyStyles: { fontSize: 7, textColor: COLORS.textBody, halign: 'center' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark },
            },
            willDrawCell: (hookData: any) => {
                if (hookData.section === 'body' && hookData.column.index === 0) {
                    const p = hookData.cell.text[0]
                    if (p === 'CRITICAL') hookData.cell.styles.textColor = COLORS.negative
                    else if (p === 'HIGH') hookData.cell.styles.textColor = [239, 68, 68]
                    else if (p === 'MEDIUM') hookData.cell.styles.textColor = COLORS.warning
                    else if (p === 'LOW') hookData.cell.styles.textColor = COLORS.positive
                }
            },
            margin: { left: 15, right: 15 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
    }

    // ── ZONE DISTRIBUTION TABLE ──
    if (zoneDistribution.length > 0) {
        y = ensurePage(doc, y, 50, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
        y = drawSectionTitle(doc, y, 'ZONE-WISE TICKET DISTRIBUTION', COLORS.headerBg)

        const totalZoneTickets = zoneDistribution.reduce((sum: number, z: any) => sum + (z.count || 0), 0)

        autoTable(doc, {
            startY: y,
            head: [['Zone', 'Total', 'Resolved', 'Open', 'Critical', 'Res. Rate', 'Avg Res.', 'Share']],
            body: zoneDistribution
                .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
                .map((zone: any) => {
                    const total = zone.count || 0
                    const resolved = zone.resolvedCount || 0
                    const open = zone.openCount || 0
                    const crt = zone.criticalCount || 0
                    const resRate = total > 0 ? ((resolved / total) * 100).toFixed(0) : '0'
                    const avgResHrs = zone.avgResolutionMinutes ? fmtHours(zone.avgResolutionMinutes / 60) : '-'
                    const bar = '|'.repeat(Math.min(Math.round((total / (totalZoneTickets || 1)) * 25), 25))
                    return [
                        zone.zoneName || 'Unknown', 
                        String(total),
                        String(resolved),
                        String(open),
                        String(crt),
                        `${resRate}%`,
                        avgResHrs,
                        bar
                    ]
                }),
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.headerBg,
                textColor: COLORS.white,
                fontSize: 6.5, fontStyle: 'bold', halign: 'center',
            },
            bodyStyles: { fontSize: 6.5, textColor: COLORS.textBody, halign: 'center' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark, cellWidth: 35 },
                7: { halign: 'left', textColor: COLORS.headerBg, fontStyle: 'bold', fontSize: 5 },
            },
            willDrawCell: (hookData: any) => {
                if (hookData.section === 'body') {
                    // Critical items
                    if (hookData.column.index === 4 && parseInt(hookData.cell.text[0]) > 0) {
                        hookData.cell.styles.textColor = COLORS.negative
                        hookData.cell.styles.fontStyle = 'bold'
                    }
                    // Resolution rate coloring
                    if (hookData.column.index === 5) {
                        const val = parseInt(hookData.cell.text[0])
                        if (val >= 80) hookData.cell.styles.textColor = COLORS.positive
                        else if (val >= 50) hookData.cell.styles.textColor = COLORS.warning
                        else if (val > 0) hookData.cell.styles.textColor = COLORS.negative
                    }
                }
            },
            margin: { left: 15, right: 15 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
    }

    // ── CUSTOMER DISTRIBUTION TABLE ──
    if (customerDistribution.length > 0) {
        y = ensurePage(doc, y, 50, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
        y = drawSectionTitle(doc, y, 'TOP CUSTOMERS BY TICKET VOLUME', COLORS.sectionSand)

        const totalCustTickets = customerDistribution.reduce((sum: number, c: any) => sum + (c.count || 0), 0)

        autoTable(doc, {
            startY: y,
            head: [['#', 'Customer', 'Tickets', 'Percentage']],
            body: customerDistribution
                .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
                .slice(0, 15)
                .map((customer: any, idx: number) => {
                    const pct = totalCustTickets > 0 ? ((customer.count / totalCustTickets) * 100).toFixed(1) : '0'
                    const name = customer.customerName?.length > 35
                        ? customer.customerName.substring(0, 33) + '..'
                        : customer.customerName || 'Unknown'
                    return [String(idx + 1), name, String(customer.count || 0), `${pct}%`]
                }),
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.sectionSand,
                textColor: COLORS.white,
                fontSize: 7, fontStyle: 'bold', halign: 'center',
            },
            bodyStyles: { fontSize: 7, textColor: COLORS.textBody, halign: 'center' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12, fontStyle: 'bold', textColor: COLORS.textMuted },
                1: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark },
            },
            margin: { left: 15, right: 15 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
    }

    // ── TIME ANALYTICS SUMMARY ──
    y = ensurePage(doc, y, 45, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
    y = drawSectionTitle(doc, y, 'TIME ANALYTICS BREAKDOWN')

    autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value', 'Description']],
        body: [
            ['Total Resolution Time', avgResolutionTime, 'End-to-end average (business hours)'],
            ['First Response Time', avgFirstResponse, 'Ticket open to first action taken'],
            ['Travel Time', avgTravelTime, 'Start location to customer site (real-time)'],
            ['Onsite Work Time', avgOnsiteResolution, 'In-progress to resolved at customer site'],
            ['Total Onsite Visits', fmtNum(totalOnsiteVisits), `${totalTickets > 0 ? ((totalOnsiteVisits / totalTickets) * 100).toFixed(0) : 0}% of total tickets required onsite visit`],
        ],
        theme: 'grid',
        headStyles: {
            fillColor: COLORS.headerBg,
            textColor: COLORS.white,
            fontSize: 7.5, fontStyle: 'bold', halign: 'center',
        },
        bodyStyles: { fontSize: 7.5, textColor: COLORS.textBody },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark, cellWidth: 50 },
            1: { halign: 'center', fontStyle: 'bold', textColor: COLORS.headerBg, cellWidth: 40 },
            2: { halign: 'left', textColor: COLORS.textMuted },
        },
        margin: { left: 15, right: 15 },
    })
    y = (doc as any).lastAutoTable.finalY + 8

    // ── SERVICE LIFECYCLE ──
    y = ensurePage(doc, y, 25, pageNum, reportTitle, subtitle, logoBase64, reportTitle)

    doc.setFillColor(...COLORS.offWhite)
    doc.roundedRect(15, y, pageW - 30, 18, 2, 2, 'F')
    doc.setDrawColor(...COLORS.cardBorder); doc.setLineWidth(0.3)
    doc.roundedRect(15, y, pageW - 30, 18, 2, 2, 'S')

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COLORS.textDark)
    doc.text('Service Lifecycle:', 20, y + 6)

    const stages = [
        { label: 'Ticket Created', time: '' },
        { label: `First Response (${avgFirstResponse})`, time: '' },
        { label: `Travel (${avgTravelTime})`, time: '' },
        { label: `Onsite Work (${avgOnsiteResolution})`, time: '' },
        { label: 'Resolved', time: '' },
    ]

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    let stageX = 20
    stages.forEach((stage, i) => {
        doc.setFillColor(...(i === stages.length - 1 ? COLORS.positive : COLORS.accentCyan))
        doc.roundedRect(stageX, y + 9, doc.getTextWidth(stage.label) + 8, 6, 1, 1, 'F')
        doc.setTextColor(...COLORS.white)
        doc.text(stage.label, stageX + 4, y + 13.5)
        stageX += doc.getTextWidth(stage.label) + 12

        if (i < stages.length - 1) {
            doc.setTextColor(...COLORS.textMuted)
            doc.setFontSize(8)
            doc.text('->', stageX - 6, y + 13.5)
            doc.setFontSize(6.5)
        }
    })
    y += 24

    // ── KEY INSIGHTS ──
    if (insights) {
        y = ensurePage(doc, y, 60, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
        y = drawSectionTitle(doc, y, 'KEY INSIGHTS & PERFORMANCE HIGHLIGHTS', COLORS.sectionPurple)

        const insightItems: { text: string; type: string }[] = []

        if (insights.topPerformingZone) {
            insightItems.push({ text: `Top Performing Zone: ${insights.topPerformingZone}`, type: 'success' })
        }
        if (insights.mostActiveCustomer) {
            insightItems.push({ text: `Most Active Customer: ${insights.mostActiveCustomer}`, type: 'info' })
        }
        if (insights.topAssignee) {
            insightItems.push({ text: `Top Assignee: ${insights.topAssignee}`, type: 'success' })
        }
        if (insights.worstPerformingCustomer) {
            insightItems.push({ text: `Needs Attention: ${insights.worstPerformingCustomer}`, type: 'warning' })
        }
        if (resolutionRate >= 90) {
            insightItems.push({ text: `Excellent resolution rate of ${resolutionRate.toFixed(1)}% - well above industry benchmark`, type: 'success' })
        } else if (resolutionRate >= 70) {
            insightItems.push({ text: `Good resolution rate of ${resolutionRate.toFixed(1)}% - room for improvement`, type: 'info' })
        } else if (resolutionRate > 0) {
            insightItems.push({ text: `Resolution rate of ${resolutionRate.toFixed(1)}% is below target - prioritize ticket closure`, type: 'warning' })
        }

        if (totalOnsiteVisits > 0 && totalTickets > 0) {
            const onsitePct = ((totalOnsiteVisits / totalTickets) * 100).toFixed(0)
            insightItems.push({ text: `${onsitePct}% of tickets required onsite visits (${totalOnsiteVisits} visits)`, type: 'info' })
        }

        // Add recommendations
        insightItems.push({ text: 'Recommendation: Focus on reducing first response time to improve customer satisfaction', type: 'action' })
        if (summary.criticalTickets > 0) {
            insightItems.push({ text: `Action Required: ${summary.criticalTickets} critical tickets need immediate attention`, type: 'error' })
        }

        for (const item of insightItems) {
            y = ensurePage(doc, y, 12, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
            const rowH = drawInsightRow(doc, 20, y, pageW - 40, item.text, item.type)
            y += rowH
        }
    }

    drawFooter(doc, pageNum.val, reportTitle)
}

// ============ SERVICE PERSON PERFORMANCE PDF ============
async function generateServicePersonPdf(
    doc: any, autoTable: any,
    data: any, filters: any, zones: any[],
    logoBase64: string | null
): Promise<void> {
    const pageW = doc.internal.pageSize.getWidth()
    const pageNum = { val: 1 }
    const reportTitle = 'Service Person Performance Report'

    // Build subtitle
    const zoneName = filters.zoneId ? zones.find((z: any) => z.id?.toString() === filters.zoneId)?.name : 'All Zones'
    const dateFrom = filters.dateRange?.from ? fmtDate(filters.dateRange.from) : ''
    const dateTo = filters.dateRange?.to ? fmtDate(filters.dateRange.to) : ''
    const subtitle = `${dateFrom ? dateFrom + ' - ' + dateTo : 'All Time'}  |  ${zoneName || 'All Zones'}`

    let y = drawHeader(doc, reportTitle, subtitle, logoBase64)

    const reports = data.reports || []
    const summary = data.summary || {}
    const dateRange = data.dateRange || {}

    // Compute aggregated metrics
    const totalPersons = summary.totalServicePersons || reports.length
    const totalTickets = summary.uniqueMetrics?.totalTickets ?? reports.reduce((s: number, p: any) => s + ((p.summary || {}).totalTickets || 0), 0)
    const totalResolved = summary.uniqueMetrics?.ticketsResolved ?? reports.reduce((s: number, p: any) => s + ((p.summary || {}).ticketsResolved || 0), 0)

    const avgResolution = (() => {
        const totalH = reports.reduce((s: number, p: any) => s + (Math.max((p.summary || {}).averageResolutionTimeHours || 0, 0)), 0)
        const valid = reports.filter((p: any) => ((p.summary || {}).averageResolutionTimeHours || 0) > 0).length
        return valid > 0 ? (totalH / valid) : 0
    })()

    const avgTravel = (() => {
        const totalH = reports.reduce((s: number, p: any) => s + (Math.max((p.summary || {}).averageTravelTimeHours || 0, 0)), 0)
        const valid = reports.filter((p: any) => ((p.summary || {}).averageTravelTimeHours || 0) > 0).length
        return valid > 0 ? (totalH / valid) : 0
    })()

    const avgOnsite = (() => {
        const totalH = reports.reduce((s: number, p: any) => s + (Math.max((p.summary || {}).averageOnsiteTimeHours || 0, 0)), 0)
        const valid = reports.filter((p: any) => ((p.summary || {}).averageOnsiteTimeHours || 0) > 0).length
        return valid > 0 ? (totalH / valid) : 0
    })()

    const overallResRate = totalTickets > 0 ? ((totalResolved / totalTickets) * 100) : 0

    // ── KPI CARDS ROW 1 ──
    y = drawSectionTitle(doc, y, 'OVERALL PERFORMANCE SUMMARY')
    const cardW = (pageW - 50) / 5
    const kpis = [
        { label: 'Service Persons', value: String(totalPersons), sub: 'Total tracked', color: COLORS.headerBg },
        { label: 'Total Tickets', value: fmtNum(totalTickets), sub: `${fmtNum(totalResolved)} resolved`, color: COLORS.sectionBlue },
        { label: 'Resolution Rate', value: fmtPct(overallResRate), sub: `${totalResolved} of ${totalTickets}`, color: COLORS.positive },
        { label: 'Avg Resolution', value: fmtHours(avgResolution), sub: 'Per ticket (biz hours)', color: COLORS.warning },
        { label: 'Avg Travel', value: fmtHours(avgTravel), sub: 'Per ticket (real-time)', color: COLORS.accentCyan },
    ]
    kpis.forEach((kpi, i) => {
        drawKPICard(doc, 20 + i * (cardW + 2.5), y, cardW, 34, kpi.label, kpi.value, kpi.color, kpi.sub)
    })
    y += 42

    // ── EXPLANATION BOX ──
    y = ensurePage(doc, y, 30, pageNum, reportTitle, subtitle, logoBase64, reportTitle)

    doc.setFillColor(...COLORS.offWhite)
    doc.roundedRect(15, y, pageW - 30, 22, 2, 2, 'F')
    doc.setDrawColor(...COLORS.accentCyan); doc.setLineWidth(0.4)
    doc.roundedRect(15, y, pageW - 30, 22, 2, 2, 'S')
    doc.setFillColor(...COLORS.accentCyan)
    doc.rect(15, y, 3, 22, 'F')

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.textDark)
    doc.text('Performance Score Methodology:', 22, y + 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...COLORS.textBody)
    doc.text('- Resolution Rate (40-60% weight): Percentage of successfully resolved tickets vs assigned.', 22, y + 10)
    doc.text('- Speed Score (30-40% weight): Scales against avg ticket resolution time. Perfect if under 8h; drops to 0 by 72h.', 22, y + 14)
    doc.text('- Efficiency Score (30% weight): Scales against physical labor baseline. Perfect if travel+onsite under 4h/ticket.', 22, y + 18)

    y += 28

    // ── PERFORMANCE TABLE ──
    if (reports.length > 0) {
        y = ensurePage(doc, y, 40, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
        y = drawSectionTitle(doc, y, `SERVICE PERSON PERFORMANCE (${reports.length} persons)`, COLORS.headerBg)

        // Sort by performance score descending
        const sorted = [...reports].sort((a: any, b: any) =>
            ((b.summary || {}).performanceScore || 0) - ((a.summary || {}).performanceScore || 0)
        )

        autoTable(doc, {
            startY: y,
            head: [['#', 'Service Person', 'Zone', 'Tickets', 'Resolved', 'Res. Rate', 'Avg Res.', 'Avg Travel', 'Avg Onsite', 'Score']],
            body: sorted.map((person: any, idx: number) => {
                const ps = person.summary || {}
                const total = ps.totalTickets || 0
                const resolved = ps.ticketsResolved || 0
                const rate = total > 0 ? Math.round((resolved / total) * 100) : 0
                const zoneNames = (person.zones || []).map((z: any) => z.name || '').join(', ')
                const zoneTrunc = zoneNames.length > 20 ? zoneNames.substring(0, 18) + '..' : zoneNames

                return [
                    String(idx + 1),
                    (person.name || '').substring(0, 24),
                    zoneTrunc || '-',
                    String(total),
                    String(resolved),
                    `${rate}%`,
                    fmtHours(ps.averageResolutionTimeHours || 0),
                    fmtHours(ps.averageTravelTimeHours || 0),
                    fmtHours(ps.averageOnsiteTimeHours || 0),
                    `${ps.performanceScore || 0}%`,
                ]
            }),
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.headerBg,
                textColor: COLORS.white,
                fontSize: 6, fontStyle: 'bold', halign: 'center',
            },
            bodyStyles: { fontSize: 6, textColor: COLORS.textBody, halign: 'center' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8, fontStyle: 'bold', textColor: COLORS.textMuted },
                1: { halign: 'left', fontStyle: 'bold', textColor: COLORS.textDark, cellWidth: 40 },
                2: { halign: 'left', cellWidth: 35, fontSize: 5.5 },
            },
            willDrawCell: (hookData: any) => {
                // Color code resolution rate column (index 5)
                if (hookData.section === 'body' && hookData.column.index === 5) {
                    const val = parseFloat(hookData.cell.text[0])
                    if (val >= 80) hookData.cell.styles.textColor = COLORS.positive
                    else if (val >= 60) hookData.cell.styles.textColor = COLORS.warning
                    else hookData.cell.styles.textColor = COLORS.negative
                    hookData.cell.styles.fontStyle = 'bold'
                }
                // Color code performance score column (index 9)
                if (hookData.section === 'body' && hookData.column.index === 9) {
                    const val = parseFloat(hookData.cell.text[0])
                    if (val >= 80) hookData.cell.styles.textColor = COLORS.positive
                    else if (val >= 60) hookData.cell.styles.textColor = COLORS.warning
                    else if (val > 0) hookData.cell.styles.textColor = COLORS.negative
                    hookData.cell.styles.fontStyle = 'bold'
                }
                // Highlight top 3 rows
                if (hookData.section === 'body' && hookData.row.index < 3) {
                    hookData.cell.styles.fillColor = [248, 250, 252]
                }
            },
            margin: { left: 15, right: 15 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
    }

    // ── TOP PERFORMERS & INSIGHTS ──
    if (reports.length >= 3) {
        drawFooter(doc, pageNum.val, reportTitle)
        pageNum.val++
        doc.addPage()
        y = drawHeader(doc, reportTitle, subtitle, logoBase64)

        y = drawSectionTitle(doc, y, 'PERFORMANCE ANALYSIS & INSIGHTS', COLORS.sectionPurple)

        // Sort for top/bottom performers
        const sortedByScore = [...reports].sort((a: any, b: any) =>
            ((b.summary || {}).performanceScore || 0) - ((a.summary || {}).performanceScore || 0)
        )
        const topPerformers = sortedByScore.slice(0, 3)
        const bottomPerformers = [...sortedByScore].reverse().slice(0, 3)

        // Top Performers section
        const insightItems: { text: string; type: string }[] = []

        // Top performers
        topPerformers.forEach((p: any, i: number) => {
            const ps = p.summary || {}
            const rate = ps.totalTickets > 0 ? Math.round((ps.ticketsResolved / ps.totalTickets) * 100) : 0
            insightItems.push({
                text: `#${i + 1} Top Performer: ${p.name} - Score: ${ps.performanceScore || 0}%, Resolution: ${rate}%, Tickets: ${ps.totalTickets || 0} (${ps.ticketsResolved || 0} resolved)`,
                type: 'success'
            })
        })

        // Bottom performers needing attention
        bottomPerformers.forEach((p: any) => {
            const ps = p.summary || {}
            if ((ps.performanceScore || 0) < 60 && (ps.totalTickets || 0) > 0) {
                insightItems.push({
                    text: `Needs Improvement: ${p.name} - Score: ${ps.performanceScore || 0}%, Resolution: ${ps.totalTickets > 0 ? Math.round((ps.ticketsResolved / ps.totalTickets) * 100) : 0}%`,
                    type: 'warning'
                })
            }
        })

        // Overall insights
        insightItems.push({
            text: `Overall team resolution rate: ${fmtPct(overallResRate)} across ${totalPersons} service persons`,
            type: 'info'
        })

        if (avgResolution > 0) {
            insightItems.push({
                text: `Average resolution time: ${fmtHours(avgResolution)} per ticket (business hours)`,
                type: avgResolution <= 24 ? 'success' : avgResolution <= 48 ? 'info' : 'warning'
            })
        }

        if (avgTravel > 0) {
            insightItems.push({
                text: `Average travel time: ${fmtHours(avgTravel)} per ticket (real-time)`,
                type: avgTravel <= 2 ? 'success' : avgTravel <= 4 ? 'info' : 'warning'
            })
        }

        // Recommendations
        insightItems.push({
            text: 'Recommendation: Share best practices from top performers with the team through training sessions',
            type: 'action'
        })

        if (overallResRate < 80) {
            insightItems.push({
                text: 'Action: Focus on improving overall resolution rate to reach 80%+ target benchmark',
                type: 'action'
            })
        }

        for (const item of insightItems) {
            y = ensurePage(doc, y, 12, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
            const rowH = drawInsightRow(doc, 20, y, pageW - 40, item.text, item.type)
            y += rowH
        }

        // ── INDIVIDUAL DETAILED BREAKDOWN (per-person) ──
        y = ensurePage(doc, y, 20, pageNum, reportTitle, subtitle, logoBase64, reportTitle)
        y += 4
        y = drawSectionTitle(doc, y, 'INDIVIDUAL PERFORMANCE DETAILS', COLORS.kardexGreen)

        for (let pi = 0; pi < reports.length; pi++) {
            const person = reports[pi]
            const ps = person.summary || {}
            const total = ps.totalTickets || 0
            const resolved = ps.ticketsResolved || 0
            const rate = total > 0 ? Math.round((resolved / total) * 100) : 0
            const zoneNames = (person.zones || []).map((z: any) => z.name || '').join(', ')

            y = ensurePage(doc, y, 20, pageNum, reportTitle, subtitle, logoBase64, reportTitle)

            // Person sub-header with accent color based on score
            const score = ps.performanceScore || 0
            const pColor: [number, number, number] = score >= 80 ? COLORS.positive : score >= 60 ? COLORS.warning : score > 0 ? COLORS.negative : COLORS.textMuted

            doc.setFillColor(...pColor)
            doc.roundedRect(15, y, pageW - 30, 8, 1.5, 1.5, 'F')
            doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.white)
            doc.text(
                `${person.name}  |  ${zoneNames || 'N/A'}  |  Score: ${score}%  |  Tickets: ${total} (${resolved} resolved)  |  Rate: ${rate}%  |  Res: ${fmtHours(ps.averageResolutionTimeHours)}  |  Travel: ${fmtHours(ps.averageTravelTimeHours)}  |  Onsite: ${fmtHours(ps.averageOnsiteTimeHours)}`,
                20, y + 5.5
            )
            y += 12
        }
    }

    drawFooter(doc, pageNum.val, reportTitle)
}

// ============ Main Entry Point ============
export async function generateReportPdf(
    reportType: string,
    reportData: any,
    context: {
        filters: any;
        zones: Array<{ id: number; name: string }>;
        customers?: Array<{ id: number; companyName: string }>;
    }
): Promise<void> {
    const { default: jsPDF } = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = autoTableModule.default || autoTableModule

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any
    const logoBase64 = await loadLogoBase64()

    const { filters, zones } = context

    switch (reportType) {
        case 'ticket-summary': {
            const data = reportData.ticketSummaryData
            if (!data) throw new Error('No ticket summary data available')
            await generateTicketAnalyticsPdf(doc, autoTable, data, filters, zones, logoBase64)
            break
        }
        case 'agent-productivity': {
            const data = reportData.servicePersonPerformanceData
            if (!data) throw new Error('No service person performance data available')
            await generateServicePersonPdf(doc, autoTable, data, filters, zones, logoBase64)
            break
        }
        default:
            throw new Error(`PDF export not yet supported for report type: ${reportType}`)
    }

    // Generate filename
    const dateStr = new Date().toISOString().slice(0, 10)
    const zoneName = filters.zoneId
        ? zones.find((z: any) => z.id?.toString() === filters.zoneId)?.name?.replace(/\s+/g, '_') || 'Zone'
        : 'All_Zones'

    let typeLabel = 'Report'
    if (reportType === 'ticket-summary') typeLabel = 'Ticket_Analytics'
    else if (reportType === 'agent-productivity') typeLabel = 'Service_Person_Performance'
    else typeLabel = String(reportType).replace(/-/g, '_')

    const fileName = `Kardex_${typeLabel}_${zoneName}_${dateStr}.pdf`
    doc.save(fileName)
}
