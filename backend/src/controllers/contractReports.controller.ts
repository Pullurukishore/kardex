import { Response } from 'express';
import prisma from '../config/db';
import { generatePdf, getPdfColumns, generateCombinedPdf } from '../utils/pdfGenerator';

// Safely cast prisma to bypass typescript client stale cache
const db = prisma as any;

// Helper to compute contract status dynamically based on end date
const computeContractStatus = (endDate: Date | null | string): string => {
  if (!endDate) return 'Active';
  const now = new Date();
  const end = new Date(endDate);

  if (end < now) {
    return 'Expired';
  }

  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (end <= thirtyDaysLater) {
    return 'Expiring Soon';
  }

  return 'Active';
};

// Helper: Apply role-based zone filtering
const applyZoneFilter = async (where: any, req: any) => {
  const role = req.user?.role;
  const userId = req.user?.id;

  if (role === 'ZONE_USER' || role === 'ZONE_MANAGER') {
    const userWithZones = await db.user.findUnique({
      where: { id: userId },
      include: { serviceZones: true }
    });

    if (userWithZones && userWithZones.serviceZones.length > 0) {
      const zoneIds = userWithZones.serviceZones.map((sz: any) => sz.serviceZoneId);
      where.zoneId = { in: zoneIds };
    }
  }
};

// Helper: Apply common query filters
const applyCommonFilters = (where: any, query: any) => {
  const { zone, status, responsible, dateFrom, dateTo, search } = query;

  if (search) {
    where.OR = [
      { customerName: { contains: search as string, mode: 'insensitive' } },
      { place: { contains: search as string, mode: 'insensitive' } },
      { contractNumber: { contains: search as string, mode: 'insensitive' } },
      { poNo: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  if (zone && zone !== 'all') {
    where.zoneName = { contains: zone as string, mode: 'insensitive' };
  }

  if (status && status !== 'all') {
    const now = new Date();
    if (status === 'Expired') {
      where.endDate = { lt: now };
    } else if (status === 'Expiring Soon') {
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      where.endDate = { gte: now, lte: thirtyDaysLater };
    } else if (status === 'Active') {
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      where.endDate = { gt: thirtyDaysLater };
    }
  }

  if (responsible && responsible !== 'all') {
    where.responsible = { contains: responsible as string, mode: 'insensitive' };
  }

  if (dateFrom || dateTo) {
    where.startDate = {};
    if (dateFrom) where.startDate.gte = new Date(dateFrom as string);
    if (dateTo) where.endDate = { ...where.endDate, lte: new Date(dateTo as string) };
  }
};

// ─── 1. PM SCHEDULE OVERVIEW ─────────────────────────────
// Returns flat list of all PM visits across contracts
export const getPMScheduleOverview = async (req: any, res: Response) => {
  try {
    const where: any = {};
    applyCommonFilters(where, req.query);
    await applyZoneFilter(where, req);

    const { pmStatus } = req.query;

    const contracts = await db.contract.findMany({
      where,
      include: {
        pmSchedules: {
          orderBy: { pmNumber: 'asc' },
          ...(pmStatus && pmStatus !== 'all' ? { where: { status: pmStatus } } : {})
        }
      },
      orderBy: { customerName: 'asc' }
    });

    const now = new Date();

    // Flatten PM schedules with contract metadata
    const pmRows: any[] = [];
    let totalPMs = 0;
    let completedPMs = 0;
    let pendingPMs = 0;
    let overduePMs = 0;

    contracts.forEach((c: any) => {
      const contractStatus = computeContractStatus(c.endDate);

      c.pmSchedules.forEach((pm: any) => {
        if (pm.status === 'Not Applicable') return;

        totalPMs++;
        if (pm.status === 'Completed') {
          completedPMs++;
        } else {
          pendingPMs++;
          // Check if overdue: parse the range end date and compare with now
          if (pm.range) {
            const rangeParts = pm.range.split(' TO ');
            if (rangeParts.length === 2) {
              const rangeEndStr = rangeParts[1].trim();
              // Parse DD/MM/YYYY
              const [day, month, year] = rangeEndStr.split('/').map(Number);
              const rangeEnd = new Date(year, month - 1, day);
              if (rangeEnd < now) {
                overduePMs++;
              }
            }
          }
        }

        pmRows.push({
          pmId: pm.id,
          contractId: c.id,
          contractNumber: c.contractNumber,
          customerName: c.customerName,
          place: c.place,
          zoneName: c.zoneName,
          mcType: c.mcType,
          contractStatus,
          pmNumber: pm.pmNumber,
          range: pm.range,
          pmStatus: pm.status,
          completedAt: pm.completedAt,
          responsible: c.responsible,
          noOfMachine: c.noOfMachine,
          amount: c.amount,
          startDate: c.startDate,
          endDate: c.endDate
        });
      });
    });

    return res.status(200).json({
      reportType: 'pm-overview',
      summary: {
        totalPMs,
        completedPMs,
        pendingPMs,
        overduePMs,
        completionPercentage: totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0,
        totalContracts: contracts.length
      },
      data: pmRows
    });
  } catch (error: any) {
    console.error('Failed to generate PM Schedule Overview:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};

// ─── 2. EXPIRING CONTRACTS REPORT ────────────────────────
export const getExpiringContractsReport = async (req: any, res: Response) => {
  try {
    const { daysAhead = 90 } = req.query;
    const now = new Date();
    const futureDate = new Date(now.getTime() + Number(daysAhead) * 24 * 60 * 60 * 1000);

    const where: any = {
      endDate: { gte: now, lte: futureDate }
    };

    // Apply zone/responsible filters but not status (we're already filtering by expiring)
    const { zone, responsible, search } = req.query;
    if (search) {
      where.OR = [
        { customerName: { contains: search as string, mode: 'insensitive' } },
        { place: { contains: search as string, mode: 'insensitive' } },
        { contractNumber: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    if (zone && zone !== 'all') {
      where.zoneName = { contains: zone as string, mode: 'insensitive' };
    }
    if (responsible && responsible !== 'all') {
      where.responsible = { contains: responsible as string, mode: 'insensitive' };
    }

    await applyZoneFilter(where, req);

    const contracts = await db.contract.findMany({
      where,
      include: {
        pmSchedules: {
          orderBy: { pmNumber: 'asc' }
        }
      },
      orderBy: { endDate: 'asc' }
    });

    const data = contracts.map((c: any) => {
      const applicablePMs = c.pmSchedules.filter((p: any) => p.status !== 'Not Applicable');
      const completedPMs = applicablePMs.filter((p: any) => p.status === 'Completed').length;
      const totalPMs = applicablePMs.length;
      const daysRemaining = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        customerName: c.customerName,
        place: c.place,
        zoneName: c.zoneName,
        mcType: c.mcType,
        responsible: c.responsible,
        startDate: c.startDate,
        endDate: c.endDate,
        daysRemaining,
        amount: c.amount,
        noOfMachine: c.noOfMachine,
        softwareSupport: c.softwareSupport,
        pmCompleted: completedPMs,
        pmTotal: totalPMs,
        pmPercentage: totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0,
        urgency: daysRemaining <= 30 ? 'Critical' : daysRemaining <= 60 ? 'Warning' : 'Notice'
      };
    });

    const totalValue = data.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

    return res.status(200).json({
      reportType: 'expiring-contracts',
      summary: {
        totalExpiring: data.length,
        critical: data.filter((c: any) => c.urgency === 'Critical').length,
        warning: data.filter((c: any) => c.urgency === 'Warning').length,
        notice: data.filter((c: any) => c.urgency === 'Notice').length,
        totalValue,
        daysAhead: Number(daysAhead)
      },
      data
    });
  } catch (error: any) {
    console.error('Failed to generate Expiring Contracts Report:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};

// ─── 3. ZONE-WISE CONTRACT SUMMARY ──────────────────────
export const getZoneContractSummary = async (req: any, res: Response) => {
  try {
    const where: any = {};
    applyCommonFilters(where, req.query);
    await applyZoneFilter(where, req);

    const contracts = await db.contract.findMany({
      where,
      include: {
        pmSchedules: {
          orderBy: { pmNumber: 'asc' }
        }
      }
    });

    // Group by zone
    const zoneMap: Record<string, any> = {};

    contracts.forEach((c: any) => {
      const zone = c.zoneName || 'Unassigned';
      if (!zoneMap[zone]) {
        zoneMap[zone] = {
          zoneName: zone,
          totalContracts: 0,
          activeContracts: 0,
          expiringContracts: 0,
          expiredContracts: 0,
          totalValue: 0,
          totalMachines: 0,
          pmCompleted: 0,
          pmTotal: 0,
          pmPercentage: 0,
          softwareSupportCount: 0,
          technicians: new Set()
        };
      }

      const status = computeContractStatus(c.endDate);
      zoneMap[zone].totalContracts++;
      if (status === 'Active') zoneMap[zone].activeContracts++;
      else if (status === 'Expiring Soon') zoneMap[zone].expiringContracts++;
      else if (status === 'Expired') zoneMap[zone].expiredContracts++;

      zoneMap[zone].totalValue += Number(c.amount);
      zoneMap[zone].totalMachines += c.noOfMachine;
      if (c.softwareSupport) zoneMap[zone].softwareSupportCount++;
      if (c.responsible) zoneMap[zone].technicians.add(c.responsible);

      c.pmSchedules.forEach((pm: any) => {
        if (pm.status !== 'Not Applicable') {
          zoneMap[zone].pmTotal++;
          if (pm.status === 'Completed') zoneMap[zone].pmCompleted++;
        }
      });
    });

    // Calculate percentages and convert sets
    const data = Object.values(zoneMap).map((z: any) => ({
      ...z,
      pmPercentage: z.pmTotal > 0 ? Math.round((z.pmCompleted / z.pmTotal) * 100) : 0,
      technicians: Array.from(z.technicians),
      technicianCount: z.technicians.size
    })).sort((a: any, b: any) => b.totalValue - a.totalValue);

    const grandTotal = {
      totalContracts: data.reduce((s: number, z: any) => s + z.totalContracts, 0),
      activeContracts: data.reduce((s: number, z: any) => s + z.activeContracts, 0),
      expiredContracts: data.reduce((s: number, z: any) => s + z.expiredContracts, 0),
      totalValue: data.reduce((s: number, z: any) => s + z.totalValue, 0),
      totalMachines: data.reduce((s: number, z: any) => s + z.totalMachines, 0),
      pmCompleted: data.reduce((s: number, z: any) => s + z.pmCompleted, 0),
      pmTotal: data.reduce((s: number, z: any) => s + z.pmTotal, 0),
      pmPercentage: 0,
      totalZones: data.length
    };
    grandTotal.pmPercentage = grandTotal.pmTotal > 0
      ? Math.round((grandTotal.pmCompleted / grandTotal.pmTotal) * 100) : 0;

    return res.status(200).json({
      reportType: 'zone-summary',
      summary: grandTotal,
      data
    });
  } catch (error: any) {
    console.error('Failed to generate Zone Contract Summary:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};

// ─── 4. TECHNICIAN-WISE PM REPORT ────────────────────────
export const getTechnicianPMReport = async (req: any, res: Response) => {
  try {
    const where: any = {};
    applyCommonFilters(where, req.query);
    await applyZoneFilter(where, req);

    const contracts = await db.contract.findMany({
      where,
      include: {
        pmSchedules: {
          orderBy: { pmNumber: 'asc' }
        }
      }
    });

    // Group by responsible technician
    const techMap: Record<string, any> = {};

    contracts.forEach((c: any) => {
      const tech = c.responsible || 'Unassigned';
      if (!techMap[tech]) {
        techMap[tech] = {
          technician: tech,
          assignedContracts: 0,
          activeContracts: 0,
          totalPMs: 0,
          completedPMs: 0,
          pendingPMs: 0,
          overduePMs: 0,
          completionPercentage: 0,
          totalMachines: 0,
          totalValue: 0,
          zones: new Set(),
          customers: new Set()
        };
      }

      const now = new Date();
      const status = computeContractStatus(c.endDate);

      techMap[tech].assignedContracts++;
      if (status === 'Active') techMap[tech].activeContracts++;
      techMap[tech].totalMachines += c.noOfMachine;
      techMap[tech].totalValue += Number(c.amount);
      techMap[tech].zones.add(c.zoneName);
      techMap[tech].customers.add(c.customerName);

      c.pmSchedules.forEach((pm: any) => {
        if (pm.status === 'Not Applicable') return;
        techMap[tech].totalPMs++;
        if (pm.status === 'Completed') {
          techMap[tech].completedPMs++;
        } else {
          techMap[tech].pendingPMs++;
          // Check overdue
          if (pm.range) {
            const rangeParts = pm.range.split(' TO ');
            if (rangeParts.length === 2) {
              const rangeEndStr = rangeParts[1].trim();
              const [day, month, year] = rangeEndStr.split('/').map(Number);
              const rangeEnd = new Date(year, month - 1, day);
              if (rangeEnd < now) {
                techMap[tech].overduePMs++;
              }
            }
          }
        }
      });
    });

    // Calculate percentages and convert sets
    const data = Object.values(techMap).map((t: any) => ({
      ...t,
      completionPercentage: t.totalPMs > 0 ? Math.round((t.completedPMs / t.totalPMs) * 100) : 0,
      zones: Array.from(t.zones),
      zoneCount: t.zones.size,
      customers: Array.from(t.customers),
      customerCount: t.customers.size
    })).sort((a: any, b: any) => b.completionPercentage - a.completionPercentage);

    return res.status(200).json({
      reportType: 'technician-pm',
      summary: {
        totalTechnicians: data.length,
        totalPMs: data.reduce((s: number, t: any) => s + t.totalPMs, 0),
        completedPMs: data.reduce((s: number, t: any) => s + t.completedPMs, 0),
        pendingPMs: data.reduce((s: number, t: any) => s + t.pendingPMs, 0),
        overduePMs: data.reduce((s: number, t: any) => s + t.overduePMs, 0),
        avgCompletion: data.length > 0
          ? Math.round(data.reduce((s: number, t: any) => s + t.completionPercentage, 0) / data.length)
          : 0
      },
      data
    });
  } catch (error: any) {
    console.error('Failed to generate Technician PM Report:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};

// ─── 5. CUSTOMER PORTFOLIO REPORT ────────────────────────
export const getCustomerPortfolioReport = async (req: any, res: Response) => {
  try {
    const where: any = {};
    applyCommonFilters(where, req.query);
    await applyZoneFilter(where, req);

    const contracts = await db.contract.findMany({
      where,
      include: {
        pmSchedules: {
          orderBy: { pmNumber: 'asc' }
        }
      },
      orderBy: { customerName: 'asc' }
    });

    // Group by customer
    const customerMap: Record<string, any> = {};

    contracts.forEach((c: any) => {
      const key = c.customerId ? String(c.customerId) : c.customerName;
      if (!customerMap[key]) {
        customerMap[key] = {
          customerId: c.customerId || 0,
          customerName: c.customerName,
          place: c.place,
          zoneName: c.zoneName,
          totalContracts: 0,
          activeContracts: 0,
          expiredContracts: 0,
          expiringContracts: 0,
          totalValue: 0,
          totalMachines: 0,
          pmCompleted: 0,
          pmTotal: 0,
          pmPercentage: 0,
          hasSoftwareSupport: false,
          contracts: [] as any[]
        };
      }

      const status = computeContractStatus(c.endDate);
      customerMap[key].totalContracts++;
      if (status === 'Active') customerMap[key].activeContracts++;
      else if (status === 'Expired') customerMap[key].expiredContracts++;
      else if (status === 'Expiring Soon') customerMap[key].expiringContracts++;

      customerMap[key].totalValue += Number(c.amount);
      customerMap[key].totalMachines += c.noOfMachine;
      if (c.softwareSupport) customerMap[key].hasSoftwareSupport = true;

      const applicablePMs = c.pmSchedules.filter((p: any) => p.status !== 'Not Applicable');
      const completedPMs = applicablePMs.filter((p: any) => p.status === 'Completed').length;

      customerMap[key].pmTotal += applicablePMs.length;
      customerMap[key].pmCompleted += completedPMs;

      customerMap[key].contracts.push({
        id: c.id,
        contractNumber: c.contractNumber,
        poNo: c.poNo,
        mcType: c.mcType,
        status,
        startDate: c.startDate,
        endDate: c.endDate,
        amount: c.amount,
        noOfMachine: c.noOfMachine,
        noOfVisits: c.noOfVisits,
        responsible: c.responsible,
        softwareSupport: c.softwareSupport,
        bdCount: c.bdCount,
        pmSchedules: c.pmSchedules.map((pm: any) => ({
          pmNumber: pm.pmNumber,
          range: pm.range,
          status: pm.status,
          completedAt: pm.completedAt
        }))
      });
    });

    // Calculate percentages
    const data = Object.values(customerMap).map((cu: any) => ({
      ...cu,
      pmPercentage: cu.pmTotal > 0 ? Math.round((cu.pmCompleted / cu.pmTotal) * 100) : 0
    })).sort((a: any, b: any) => b.totalValue - a.totalValue);

    const grandTotal = {
      totalCustomers: data.length,
      totalContracts: data.reduce((s: number, c: any) => s + c.totalContracts, 0),
      activeContracts: data.reduce((s: number, c: any) => s + c.activeContracts, 0),
      expiredContracts: data.reduce((s: number, c: any) => s + c.expiredContracts, 0),
      totalValue: data.reduce((s: number, c: any) => s + c.totalValue, 0),
      totalMachines: data.reduce((s: number, c: any) => s + c.totalMachines, 0),
      pmCompleted: data.reduce((s: number, c: any) => s + c.pmCompleted, 0),
      pmTotal: data.reduce((s: number, c: any) => s + c.pmTotal, 0),
      pmPercentage: 0
    };
    grandTotal.pmPercentage = grandTotal.pmTotal > 0
      ? Math.round((grandTotal.pmCompleted / grandTotal.pmTotal) * 100) : 0;

    return res.status(200).json({
      reportType: 'customer-portfolio',
      summary: grandTotal,
      data
    });
  } catch (error: any) {
    console.error('Failed to generate Customer Portfolio Report:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};

// Helper to fetch report data internally
const fetchReportDataInternal = async (type: string, req: any): Promise<any> => {
  const mockRes = {
    statusCode: 200,
    jsonData: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this.jsonData = data; return this; }
  };

  switch (type) {
    case 'pm-overview':
      await getPMScheduleOverview(req, mockRes as any);
      break;
    case 'expiring-contracts':
      await getExpiringContractsReport(req, mockRes as any);
      break;
    case 'zone-summary':
      await getZoneContractSummary(req, mockRes as any);
      break;
    case 'technician-pm':
      await getTechnicianPMReport(req, mockRes as any);
      break;
    case 'customer-portfolio':
      await getCustomerPortfolioReport(req, mockRes as any);
      break;
    default:
      return null;
  }

  if (mockRes.statusCode !== 200 || !mockRes.jsonData) {
    return null;
  }
  return mockRes.jsonData;
};

// ─── 6. EXPORT CONTRACT REPORT ──────────────────────────
export const exportContractReport = async (req: any, res: Response) => {
  try {
    const { reportType, format: exportFormat = 'excel' } = req.query;

    if (!reportType) {
      return res.status(400).json({ error: 'reportType query parameter is required' });
    }

    const reportsList = [
      { type: 'customer-portfolio', name: 'Customer Portfolio', title: 'Customer Contract Portfolio' },
      { type: 'pm-overview', name: 'PM Visit Schedule', title: 'PM Schedule Overview' },
      { type: 'expiring-contracts', name: 'Expiring Contracts', title: 'Expiring Contracts' },
      { type: 'zone-summary', name: 'Zone Summary', title: 'Zone-wise Contract Summary' },
      { type: 'technician-pm', name: 'Technician PM', title: 'Technician PM Performance' }
    ];

    if (reportType === 'all') {
      // 1. COMBINED EXCEL EXPORT
      if (exportFormat === 'excel') {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Kardex Remstar FSM';
        workbook.created = new Date();

        const HEADER_BG = '546A7A';
        const HEADER_TEXT = 'FFFFFF';
        const ROW_EVEN = 'F1F5F9';
        const ROW_ODD = 'FFFFFF';

        for (const r of reportsList) {
          const reportData = await fetchReportDataInternal(r.type, req);
          if (!reportData) continue;

          const sheet = workbook.addWorksheet(r.name);

          // Title row
          const titleRow = sheet.addRow([r.title]);
          titleRow.font = { size: 14, bold: true, color: { argb: HEADER_BG } };
          sheet.addRow([`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
          sheet.addRow([]);

          // Summary row
          if (reportData.summary) {
            const summaryKeys = Object.keys(reportData.summary);
            const summaryRow = sheet.addRow(summaryKeys.map(k => formatLabel(k)));
            summaryRow.font = { bold: true, size: 10 };
            summaryRow.eachCell((cell: any) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '82A094' } };
              cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 9 };
              cell.border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
            });

            const summaryValRow = sheet.addRow(summaryKeys.map(k => {
              const val = reportData.summary[k];
              if (typeof val === 'number' && (k.toLowerCase().includes('value') || k.toLowerCase().includes('amount'))) {
                return `₹${val.toLocaleString('en-IN')}`;
              }
              return val;
            }));
            summaryValRow.font = { size: 9 };
            sheet.addRow([]);
          }

          // Data table
          if (reportData.data && reportData.data.length > 0) {
            const columns = getExportColumns(r.type);
            const headerRow = sheet.addRow(columns.map((c: any) => c.header));
            headerRow.eachCell((cell: any) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
              cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 9 };
              cell.alignment = { horizontal: 'center' };
              cell.border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
            });

            reportData.data.forEach((item: any, idx: number) => {
              const row = sheet.addRow(columns.map((c: any) => {
                const val = item[c.key];
                if (c.format) return c.format(val, item);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));

              row.eachCell((cell: any) => {
                cell.fill = {
                  type: 'pattern', pattern: 'solid',
                  fgColor: { argb: idx % 2 === 0 ? ROW_EVEN : ROW_ODD }
                };
                cell.font = { size: 9 };
                cell.border = { bottom: { style: 'hair', color: { argb: 'E2E8F0' } } };
              });
            });

            columns.forEach((_: any, i: number) => {
              sheet.getColumn(i + 1).width = Math.max(12, columns[i].header.length + 4);
            });
          }
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=KardexCare-Combined-Contract-Reports-${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        return;
      }

      // 2. COMBINED PDF EXPORT
      if (exportFormat === 'pdf') {
        const sections: any[] = [];
        for (const r of reportsList) {
          const reportData = await fetchReportDataInternal(r.type, req);
          if (reportData) {
            sections.push({
              title: r.title,
              reportType: r.type,
              data: reportData.data || [],
              summaryData: reportData.summary
            });
          }
        }

        const pdfFilters = {
          Zone: req.query.zone || 'All',
          Status: req.query.status || 'All',
          Responsible: req.query.responsible || 'All',
          Search: req.query.search || ''
        };

        await generateCombinedPdf(res, sections, pdfFilters);
        return;
      }
    }

    // Single report export fallback
    let reportData = await fetchReportDataInternal(reportType as string, req);
    if (!reportData) {
      return res.status(400).json({ error: `Unknown report type or failed to fetch: ${reportType}` });
    }

    if (exportFormat === 'excel') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Kardex Remstar FSM';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Contract Report');
      const HEADER_BG = '546A7A';
      const HEADER_TEXT = 'FFFFFF';
      const ROW_EVEN = 'F1F5F9';
      const ROW_ODD = 'FFFFFF';

      const titleRow = sheet.addRow([`Contract Report — ${getReportTitle(reportType as string)}`]);
      titleRow.font = { size: 16, bold: true, color: { argb: HEADER_BG } };
      sheet.addRow([`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
      sheet.addRow([]);

      if (reportData.summary) {
        const summaryKeys = Object.keys(reportData.summary);
        const summaryRow = sheet.addRow(summaryKeys.map(k => formatLabel(k)));
        summaryRow.font = { bold: true, size: 10 };
        summaryRow.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '82A094' } };
          cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 10 };
          cell.border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
        });

        const summaryValRow = sheet.addRow(summaryKeys.map(k => {
          const val = reportData.summary[k];
          if (typeof val === 'number' && (k.toLowerCase().includes('value') || k.toLowerCase().includes('amount'))) {
            return `₹${val.toLocaleString('en-IN')}`;
          }
          return val;
        }));
        summaryValRow.font = { size: 10 };
        sheet.addRow([]);
      }

      if (reportData.data && reportData.data.length > 0) {
        const columns = getExportColumns(reportType as string);
        const headerRow = sheet.addRow(columns.map((c: any) => c.header));
        headerRow.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
          cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 10 };
          cell.alignment = { horizontal: 'center' };
          cell.border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
        });

        reportData.data.forEach((item: any, idx: number) => {
          const row = sheet.addRow(columns.map((c: any) => {
            const val = item[c.key];
            if (c.format) return c.format(val, item);
            if (Array.isArray(val)) return val.join(', ');
            return val ?? '';
          }));

          row.eachCell((cell: any) => {
            cell.fill = {
              type: 'pattern', pattern: 'solid',
              fgColor: { argb: idx % 2 === 0 ? ROW_EVEN : ROW_ODD }
            };
            cell.font = { size: 9 };
            cell.border = { bottom: { style: 'hair', color: { argb: 'E2E8F0' } } };
          });
        });

        columns.forEach((_: any, i: number) => {
          sheet.getColumn(i + 1).width = Math.max(12, columns[i].header.length + 4);
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=contract-report-${reportType}-${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      return;
    }

    if (exportFormat === 'pdf') {
      const pdfColumns = getPdfColumns(reportType as string);
      const pdfTitle = getReportTitle(reportType as string);
      const pdfFilters = {
        Zone: req.query.zone || 'All',
        Status: req.query.status || 'All',
        Responsible: req.query.responsible || 'All',
        Search: req.query.search || '—'
      };
      await generatePdf(res, reportData.data, pdfColumns, pdfTitle, pdfFilters, reportData.summary);
      return;
    }

    return res.status(200).json(reportData);
  } catch (error: any) {
    console.error('Failed to export contract report:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
  }
};

// ─── HELPERS ─────────────────────────────────────────────

function getReportTitle(reportType: string): string {
  switch (reportType) {
    case 'pm-overview': return 'PM Schedule Overview';
    case 'expiring-contracts': return 'Expiring Contracts';
    case 'zone-summary': return 'Zone-wise Contract Summary';
    case 'technician-pm': return 'Technician PM Performance';
    case 'customer-portfolio': return 'Customer Contract Portfolio';
    default: return 'Contract Report';
  }
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function getExportColumns(reportType: string) {
  switch (reportType) {
    case 'pm-overview':
      return [
        { key: 'contractNumber', header: 'Contract #' },
        { key: 'customerName', header: 'Customer' },
        { key: 'place', header: 'Place' },
        { key: 'zoneName', header: 'Zone' },
        { key: 'pmNumber', header: 'PM Visit #' },
        { key: 'range', header: 'Date Range' },
        { key: 'pmStatus', header: 'Status' },
        { key: 'completedAt', header: 'Completed At', format: (v: any) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
        { key: 'responsible', header: 'Responsible' },
        { key: 'mcType', header: 'MC Type' },
        { key: 'amount', header: 'Value (₹)', format: (v: any) => Number(v).toLocaleString('en-IN') }
      ];
    case 'expiring-contracts':
      return [
        { key: 'contractNumber', header: 'Contract #' },
        { key: 'customerName', header: 'Customer' },
        { key: 'place', header: 'Place' },
        { key: 'zoneName', header: 'Zone' },
        { key: 'endDate', header: 'End Date', format: (v: any) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
        { key: 'daysRemaining', header: 'Days Remaining' },
        { key: 'urgency', header: 'Urgency' },
        { key: 'pmPercentage', header: 'PM %' },
        { key: 'amount', header: 'Amount (₹)', format: (v: any) => Number(v).toLocaleString('en-IN') },
        { key: 'responsible', header: 'Responsible' }
      ];
    case 'zone-summary':
      return [
        { key: 'zoneName', header: 'Zone' },
        { key: 'totalContracts', header: 'Total Contracts' },
        { key: 'activeContracts', header: 'Active' },
        { key: 'expiringContracts', header: 'Expiring' },
        { key: 'expiredContracts', header: 'Expired' },
        { key: 'totalValue', header: 'Total Value (₹)', format: (v: any) => Number(v).toLocaleString('en-IN') },
        { key: 'totalMachines', header: 'Machines' },
        { key: 'pmPercentage', header: 'PM %' },
        { key: 'technicianCount', header: 'Technicians' }
      ];
    case 'technician-pm':
      return [
        { key: 'technician', header: 'Technician' },
        { key: 'assignedContracts', header: 'Contracts' },
        { key: 'totalPMs', header: 'Total PMs' },
        { key: 'completedPMs', header: 'Completed' },
        { key: 'pendingPMs', header: 'Pending' },
        { key: 'overduePMs', header: 'Overdue' },
        { key: 'completionPercentage', header: 'Completion %' },
        { key: 'totalMachines', header: 'Machines' },
        { key: 'totalValue', header: 'Value (₹)', format: (v: any) => Number(v).toLocaleString('en-IN') },
        { key: 'zones', header: 'Zones' }
      ];
    case 'customer-portfolio':
      return [
        { key: 'customerName', header: 'Customer' },
        { key: 'place', header: 'Place' },
        { key: 'zoneName', header: 'Zone' },
        { key: 'totalContracts', header: 'Contracts' },
        { key: 'activeContracts', header: 'Active' },
        { key: 'expiredContracts', header: 'Expired' },
        { key: 'totalValue', header: 'Portfolio Value (₹)', format: (v: any) => Number(v).toLocaleString('en-IN') },
        { key: 'totalMachines', header: 'Machines' },
        { key: 'pmPercentage', header: 'PM %' },
        { key: 'hasSoftwareSupport', header: 'SW Support', format: (v: any) => v ? 'Yes' : 'No' }
      ];
    default:
      return [];
  }
}

