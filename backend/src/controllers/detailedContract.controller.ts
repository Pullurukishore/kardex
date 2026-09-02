import { Request, Response } from 'express';
import prisma from '../config/db';

// Safely cast prisma to bypass typescript client stale cache
const db = prisma as any;

// ============================
// Helpers
// ============================

/** Compute MC expiry status & days remaining accurately based on calendar dates */
const computeExpiryStatus = (endDate: Date | string | null | undefined) => {
  if (!endDate) return { status: 'N/A', daysLeft: null, bucket: 'na' };
  const d = new Date(endDate);
  if (isNaN(d.getTime())) return { status: 'N/A', daysLeft: null, bucket: 'na' };

  // Calculate calendar days difference (ignoring current hour/minute/second)
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const targetUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  const daysLeft = Math.round((targetUTC - todayUTC) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { status: 'Expired', daysLeft, bucket: 'expired' };
  if (daysLeft <= 30) return { status: 'Expiring ≤30d', daysLeft, bucket: 'critical' };
  if (daysLeft <= 60) return { status: 'Expiring 31-60d', daysLeft, bucket: 'warning' };
  if (daysLeft <= 90) return { status: 'Expiring 61-90d', daysLeft, bucket: 'attention' };
  return { status: 'Active', daysLeft, bucket: 'healthy' };
};

/** Parse Excel serial date to JS Date */
const excelDateToJS = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
};

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

/** Try to parse a date value from various formats into exact UTC midnight Date */
const parseDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;

  // 1. Excel serial number (number or 5-digit numeric string like 45453)
  const numVal = typeof val === 'number' ? val : (typeof val === 'string' && /^\d{5}$/.test(val.trim()) ? Number(val.trim()) : NaN);
  if (!isNaN(numVal) && numVal > 25000 && numVal < 60000) {
    const utcDays = Math.floor(numVal - 25569);
    return new Date(utcDays * 86400 * 1000);
  }

  const str = String(val).trim();
  if (!str) return null;

  // 2. Named month format: e.g. "14-Mar-16", "15-Jul-2019", "Jul 15, 2019", "15/Jul/2019"
  const namedMatch = str.match(/^(\d{1,2})[\s\-\/\.]([a-zA-Z]{3,9})[\s\-\/\.](\d{2,4})$/);
  if (namedMatch) {
    const day = parseInt(namedMatch[1], 10);
    const month = MONTH_MAP[namedMatch[2].toLowerCase()];
    let year = parseInt(namedMatch[3], 10);
    if (namedMatch[3].length === 2) year = year < 50 ? 2000 + year : 1900 + year;
    if (month && day >= 1 && day <= 31 && year >= 1970 && year <= 2100) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const namedMatch2 = str.match(/^([a-zA-Z]{3,9})[\s\-\/\.](\d{1,2}),?[\s\-\/\.](\d{2,4})$/);
  if (namedMatch2) {
    const month = MONTH_MAP[namedMatch2[1].toLowerCase()];
    const day = parseInt(namedMatch2[2], 10);
    let year = parseInt(namedMatch2[3], 10);
    if (namedMatch2[3].length === 2) year = year < 50 ? 2000 + year : 1900 + year;
    if (month && day >= 1 && day <= 31 && year >= 1970 && year <= 2100) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // 3. Numeric 3-part format: e.g. "4/10/23", "3/10/26", "02-13-2026", "3/31/2027", "13-02-2026"
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    // YYYY-MM-DD
    if (parts[0].length === 4) {
      const y = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      if (y >= 1970 && y <= 2100) {
        if (p1 > 12) {
          return new Date(Date.UTC(y, p2 - 1, p1));
        }
        return new Date(Date.UTC(y, p1 - 1, p2));
      }
    }
    // XX-XX-YYYY or XX-XX-YY
    if (parts[2].length === 4 || parts[2].length === 2) {
      let y = parseInt(parts[2], 10);
      if (parts[2].length === 2) y = y < 50 ? 2000 + y : 1900 + y;
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      if (y >= 1970 && y <= 2100) {
        // If p2 > 12 (e.g. 3/31/2027 or 02-13-2026 or 12/31/2026):
        // p1 must be Month, p2 must be Day!
        if (p2 > 12 && p1 <= 12) {
          return new Date(Date.UTC(y, p1 - 1, p2));
        }

        // Standard Indian Date format DD/MM/YYYY:
        // p1 is DAY, p2 is MONTH (e.g. 4/10/23 = 04 Oct 2023, 3/10/26 = 03 Oct 2026)
        if (p2 <= 12 && p1 <= 31) {
          return new Date(Date.UTC(y, p2 - 1, p1));
        }
      }
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    if (y >= 1970 && y <= 2100) {
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }
  }

  return null;
};

const smartAlignDatePair = (startVal: any, endVal: any): { startDate: Date | null; endDate: Date | null } => {
  return {
    startDate: parseDate(startVal),
    endDate: parseDate(endVal)
  };
};

/** Parse numeric value (removes commas etc.) */
const parseNumeric = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
};

// ============================
// LIST with filters & search
// ============================
export const listDetailedContracts = async (req: Request, res: Response) => {
  try {
    const {
      search, zone, customerClass, contractType, expiryBucket,
      page = '1', limit = '50', sortBy = 'customerName', sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const pageSize = Math.min(parseInt(limit as string, 10) || 50, 200);
    const skip = (pageNum - 1) * pageSize;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { customerName: { contains: search as string, mode: 'insensitive' } },
        { serialNumber: { contains: search as string, mode: 'insensitive' } },
        { engineerName: { contains: search as string, mode: 'insensitive' } },
        { place: { contains: search as string, mode: 'insensitive' } },
        { unitType: { contains: search as string, mode: 'insensitive' } },
        { mcPoNumber: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (zone && zone !== 'all') {
      where.zoneName = { equals: zone as string, mode: 'insensitive' };
    }
    if (customerClass && customerClass !== 'all') {
      where.customerClass = customerClass as string;
    }
    if (contractType && contractType !== 'all') {
      where.contractType = { equals: contractType as string, mode: 'insensitive' };
    }

    // Expiry bucket filter requires post-query filtering
    const [records, total] = await Promise.all([
      db.detailedContract.findMany({
        where,
        orderBy: { [sortBy as string]: sortOrder === 'desc' ? 'desc' : 'asc' },
        skip,
        take: pageSize,
      }),
      db.detailedContract.count({ where }),
    ]);

    // Enrich with computed expiry info
    let enriched = records.map((r: any) => {
      const mc = computeExpiryStatus(r.mcEndDate);
      const warranty = computeExpiryStatus(r.warrantyEndDate);
      const software = computeExpiryStatus(r.softwareEndDate);
      const remote = computeExpiryStatus(r.remoteSupportEndDate);
      return {
        ...r,
        mcValue: r.mcValue ? Number(r.mcValue) : null,
        mcExpiry: mc,
        warrantyExpiry: warranty,
        softwareExpiry: software,
        remoteSupportExpiry: remote,
      };
    });

    // Filter by expiry bucket if requested
    if (expiryBucket && expiryBucket !== 'all') {
      enriched = enriched.filter((r: any) => r.mcExpiry.bucket === expiryBucket);
    }

    res.json({
      data: enriched,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Failed to list detailed contracts:', error);
    res.status(500).json({ error: 'Failed to list detailed contracts' });
  }
};

// ============================
// STATS / KPI
// ============================
export const getDetailedContractStats = async (req: Request, res: Response) => {
  try {
    const { zone, customerClass, contractType, unitType, engineer, department, dateFrom, dateTo, search } = req.query;
    const where: any = {};
    if (zone && zone !== 'all') where.zoneName = { equals: zone as string, mode: 'insensitive' };
    if (customerClass && customerClass !== 'all') where.customerClass = customerClass as string;
    if (contractType && contractType !== 'all') where.contractType = { equals: contractType as string, mode: 'insensitive' };
    if (unitType && unitType !== 'all') where.unitType = { contains: unitType as string, mode: 'insensitive' };
    if (engineer && engineer !== 'all') {
      const engStr = String(engineer).trim();
      const engLower = engStr.toLowerCase();
      if (engLower.startsWith('sasi')) {
        where.engineerName = { contains: 'sasi', mode: 'insensitive' };
      } else {
        where.engineerName = { contains: engStr, mode: 'insensitive' };
      }
    }
    if (department && department !== 'all') where.department = { equals: department as string, mode: 'insensitive' };

    if (dateFrom || dateTo) {
      where.mcEndDate = {};
      if (dateFrom) where.mcEndDate.gte = new Date(dateFrom as string);
      if (dateTo) where.mcEndDate.lte = new Date(dateTo as string);
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search as string, mode: 'insensitive' } },
        { serialNumber: { contains: search as string, mode: 'insensitive' } },
        { place: { contains: search as string, mode: 'insensitive' } },
        { engineerName: { contains: search as string, mode: 'insensitive' } },
        { unitType: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const records = await db.detailedContract.findMany({ where });

    let totalMachines = records.length;
    let totalMCValue = 0;
    let expiring30 = 0;
    let expiring60 = 0;
    let expiring90 = 0;
    let expired = 0;
    let active = 0;
    let warrantyExpiring30 = 0;
    let classA = 0;
    let classB = 0;
    let classC = 0;
    const uniqueCustomers = new Set<string>();

    records.forEach((r: any) => {
      if (r.mcValue) totalMCValue += Number(r.mcValue);
      const mc = computeExpiryStatus(r.mcEndDate);
      if (mc.bucket === 'expired') expired++;
      else if (mc.bucket === 'critical') expiring30++;
      else if (mc.bucket === 'warning') expiring60++;
      else if (mc.bucket === 'attention') expiring90++;
      else active++;

      const w = computeExpiryStatus(r.warrantyEndDate);
      if (w.bucket === 'critical') warrantyExpiring30++;

      if (r.customerClass === 'A') classA++;
      else if (r.customerClass === 'B') classB++;
      else if (r.customerClass === 'C') classC++;

      uniqueCustomers.add(r.customerName?.trim().toLowerCase());
    });

    res.json({
      totalMachines,
      totalCustomers: uniqueCustomers.size,
      totalMCValue,
      expiring30,
      expiring60,
      expiring90,
      expired,
      active,
      warrantyExpiring30,
      classA,
      classB,
      classC,
    });
  } catch (error) {
    console.error('Failed to get detailed contract stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

// ============================
// CUSTOMER-GROUPED VIEW
// ============================
export const getCustomerGroupedContracts = async (req: Request, res: Response) => {
  try {
    const { search, zone, customerClass, contractType, unitType, engineer, department, dateFrom, dateTo, expiryBucket } = req.query;
    const where: any = {};

    if (search) {
      where.OR = [
        { customerName: { contains: search as string, mode: 'insensitive' } },
        { serialNumber: { contains: search as string, mode: 'insensitive' } },
        { place: { contains: search as string, mode: 'insensitive' } },
        { engineerName: { contains: search as string, mode: 'insensitive' } },
        { unitType: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (zone && zone !== 'all') where.zoneName = { equals: zone as string, mode: 'insensitive' };
    if (customerClass && customerClass !== 'all') where.customerClass = customerClass as string;
    if (contractType && contractType !== 'all') where.contractType = { equals: contractType as string, mode: 'insensitive' };
    if (unitType && unitType !== 'all') where.unitType = { contains: unitType as string, mode: 'insensitive' };
    if (engineer && engineer !== 'all') {
      const engStr = String(engineer).trim();
      const engLower = engStr.toLowerCase();
      if (engLower.startsWith('sasi')) {
        where.engineerName = { contains: 'sasi', mode: 'insensitive' };
      } else {
        where.engineerName = { contains: engStr, mode: 'insensitive' };
      }
    }
    if (department && department !== 'all') where.department = { equals: department as string, mode: 'insensitive' };

    if (dateFrom || dateTo) {
      where.mcEndDate = {};
      if (dateFrom) where.mcEndDate.gte = new Date(dateFrom as string);
      if (dateTo) where.mcEndDate.lte = new Date(dateTo as string);
    }

    const records = await db.detailedContract.findMany({
      where,
      orderBy: [{ customerName: 'asc' }, { slNo: 'asc' }],
    });

    // Group by customer name + zone (case-insensitive) so each zone appears separately
    const customerMap: Record<string, any> = {};

    records.forEach((r: any) => {
      const mc = computeExpiryStatus(r.mcEndDate);
      const warranty = computeExpiryStatus(r.warrantyEndDate);

      // If filtering by expiry bucket, only include machines matching that expiry bucket!
      if (expiryBucket && expiryBucket !== 'all' && mc.bucket !== expiryBucket) {
        return;
      }

      const custKey = r.customerName?.trim().toLowerCase() || 'unknown';
      const zoneKey = r.zoneName?.trim().toLowerCase() || 'unknown';
      const key = `${custKey}::${zoneKey}`;
      if (!customerMap[key]) {
        customerMap[key] = {
          customerName: r.customerName?.trim() || 'Unknown',
          customerId: r.customerId,
          customerClass: r.customerClass,
          place: r.place,
          zoneName: r.zoneName,
          engineerName: r.engineerName || null,
          engineers: new Set<string>(),
          totalMachines: 0,
          totalMCValue: 0,
          totalPMVisits: 0,
          totalBDVisits: 0,
          machines: [],
          earliestMCExpiry: null as Date | null,
          expiryStatus: 'Active',
        };
      }

      if (r.engineerName) {
        r.engineerName.split(/[\/,]+/).forEach((eng: string) => {
          const trimmed = eng.trim();
          if (trimmed) customerMap[key].engineers.add(trimmed);
        });
      }

      const machine = {
        ...r,
        mcValue: r.mcValue ? Number(r.mcValue) : null,
        mcExpiry: mc,
        warrantyExpiry: warranty,
        softwareExpiry: computeExpiryStatus(r.softwareEndDate),
        remoteSupportExpiry: computeExpiryStatus(r.remoteSupportEndDate),
      };

      customerMap[key].totalMachines++;
      if (r.mcValue) customerMap[key].totalMCValue += Number(r.mcValue);
      customerMap[key].totalPMVisits += r.pmVisitsCount || 0;
      customerMap[key].totalBDVisits += r.bdVisitsCount || 0;
      customerMap[key].machines.push(machine);

      // Track earliest MC expiry
      if (r.mcEndDate) {
        const endD = new Date(r.mcEndDate);
        if (!customerMap[key].earliestMCExpiry || endD < customerMap[key].earliestMCExpiry) {
          customerMap[key].earliestMCExpiry = endD;
        }
      }
    });

    // Compute overall status per customer
    let customers = Object.values(customerMap).map((c: any) => {
      const earliest = computeExpiryStatus(c.earliestMCExpiry);
      c.expiryStatus = earliest.status;
      c.expiryBucket = earliest.bucket;
      c.daysToEarliestExpiry = earliest.daysLeft;
      if (c.engineers && c.engineers.size > 0) {
        c.engineerName = Array.from(c.engineers).join(', ');
      }
      delete c.engineers;
      return c;
    });

    // Sort by urgency (earliest expiry first)
    customers.sort((a: any, b: any) => {
      const aD = a.daysToEarliestExpiry ?? 99999;
      const bD = b.daysToEarliestExpiry ?? 99999;
      return aD - bD;
    });

    res.json({ data: customers });
  } catch (error) {
    console.error('Failed to get customer grouped contracts:', error);
    res.status(500).json({ error: 'Failed to get customer grouped contracts' });
  }
};

// ============================
// GET BY ID
// ============================
export const getDetailedContractById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await db.detailedContract.findUnique({ where: { id: Number(id) } });
    if (!record) return res.status(404).json({ error: 'Detailed contract not found' });

    const mc = computeExpiryStatus(record.mcEndDate);
    const warranty = computeExpiryStatus(record.warrantyEndDate);

    res.json({
      ...record,
      mcValue: record.mcValue ? Number(record.mcValue) : null,
      mcExpiry: mc,
      warrantyExpiry: warranty,
      softwareExpiry: computeExpiryStatus(record.softwareEndDate),
      remoteSupportExpiry: computeExpiryStatus(record.remoteSupportEndDate),
    });
  } catch (error) {
    console.error('Failed to get detailed contract:', error);
    res.status(500).json({ error: 'Failed to get detailed contract' });
  }
};

// ============================
// CREATE
// ============================
export const createDetailedContract = async (req: Request, res: Response) => {
  try {
    const { customerId, zoneId, ...data } = req.body;
    const userId = (req as any).user?.id;

    if (!data.customerName || !data.serialNumber || !data.zoneName) {
      return res.status(400).json({ error: 'customerName, serialNumber, and zoneName are required' });
    }

    const record = await db.detailedContract.create({
      data: {
        ...data,
        mcValue: data.mcValue ? parseFloat(String(data.mcValue)) : null,
        poDate: data.poDate ? new Date(data.poDate) : null,
        mcStartDate: data.mcStartDate ? new Date(data.mcStartDate) : null,
        mcEndDate: data.mcEndDate ? new Date(data.mcEndDate) : null,
        warrantyStartDate: data.warrantyStartDate ? new Date(data.warrantyStartDate) : null,
        warrantyEndDate: data.warrantyEndDate ? new Date(data.warrantyEndDate) : null,
        softwareStartDate: data.softwareStartDate ? new Date(data.softwareStartDate) : null,
        softwareEndDate: data.softwareEndDate ? new Date(data.softwareEndDate) : null,
        remoteSupportStartDate: data.remoteSupportStartDate ? new Date(data.remoteSupportStartDate) : null,
        remoteSupportEndDate: data.remoteSupportEndDate ? new Date(data.remoteSupportEndDate) : null,
        pmVisitsCount: parseInt(data.pmVisitsCount) || 0,
        bdVisitsCount: parseInt(data.bdVisitsCount) || 0,
        customer: customerId ? { connect: { id: Number(customerId) } } : undefined,
        zone: zoneId ? { connect: { id: Number(zoneId) } } : undefined,
        createdBy: userId ? { connect: { id: Number(userId) } } : undefined,
      },
    });

    res.status(201).json(record);
  } catch (error) {
    console.error('Failed to create detailed contract:', error);
    res.status(500).json({ error: 'Failed to create detailed contract' });
  }
};

// ============================
// UPDATE
// ============================
export const updateDetailedContract = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerId, zoneId, ...data } = req.body;

    const existing = await db.detailedContract.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ error: 'Detailed contract not found' });

    const record = await db.detailedContract.update({
      where: { id: Number(id) },
      data: {
        ...data,
        mcValue: data.mcValue !== undefined ? (data.mcValue ? parseFloat(String(data.mcValue)) : null) : undefined,
        poDate: data.poDate !== undefined ? (data.poDate ? new Date(data.poDate) : null) : undefined,
        mcStartDate: data.mcStartDate !== undefined ? (data.mcStartDate ? new Date(data.mcStartDate) : null) : undefined,
        mcEndDate: data.mcEndDate !== undefined ? (data.mcEndDate ? new Date(data.mcEndDate) : null) : undefined,
        warrantyStartDate: data.warrantyStartDate !== undefined ? (data.warrantyStartDate ? new Date(data.warrantyStartDate) : null) : undefined,
        warrantyEndDate: data.warrantyEndDate !== undefined ? (data.warrantyEndDate ? new Date(data.warrantyEndDate) : null) : undefined,
        softwareStartDate: data.softwareStartDate !== undefined ? (data.softwareStartDate ? new Date(data.softwareStartDate) : null) : undefined,
        softwareEndDate: data.softwareEndDate !== undefined ? (data.softwareEndDate ? new Date(data.softwareEndDate) : null) : undefined,
        remoteSupportStartDate: data.remoteSupportStartDate !== undefined ? (data.remoteSupportStartDate ? new Date(data.remoteSupportStartDate) : null) : undefined,
        remoteSupportEndDate: data.remoteSupportEndDate !== undefined ? (data.remoteSupportEndDate ? new Date(data.remoteSupportEndDate) : null) : undefined,
        customer: customerId !== undefined ? (customerId ? { connect: { id: Number(customerId) } } : { disconnect: true }) : undefined,
        zone: zoneId !== undefined ? (zoneId ? { connect: { id: Number(zoneId) } } : { disconnect: true }) : undefined,
      },
    });

    res.json(record);
  } catch (error) {
    console.error('Failed to update detailed contract:', error);
    res.status(500).json({ error: 'Failed to update detailed contract' });
  }
};

// ============================
// DELETE
// ============================
export const deleteDetailedContract = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.detailedContract.delete({ where: { id: Number(id) } });
    res.json({ message: 'Detailed contract deleted successfully' });
  } catch (error) {
    console.error('Failed to delete detailed contract:', error);
    res.status(500).json({ error: 'Failed to delete detailed contract' });
  }
};

// ============================
// BULK IMPORT (Sheet 2 format - Upsert by Serial Number)
// ============================
export const bulkImportDetailedContracts = async (req: Request, res: Response) => {
  try {
    const { records: importRecords } = req.body;
    const userId = (req as any).user?.id;

    if (!importRecords || !Array.isArray(importRecords) || importRecords.length === 0) {
      return res.status(400).json({ error: 'No records provided for import' });
    }

    // 1. Prefetch all reference data in memory (3 fast queries instead of thousands)
    const [allCustomers, allZones, allExisting] = await Promise.all([
      db.customer.findMany({ select: { id: true, companyName: true } }),
      db.serviceZone.findMany({ select: { id: true, name: true } }),
      db.detailedContract.findMany({ select: { id: true, serialNumber: true } }),
    ]);

    const customerMap = new Map<string, number>();
    allCustomers.forEach((c: any) => {
      if (c.companyName) customerMap.set(c.companyName.toLowerCase().trim(), c.id);
    });

    const zoneMap = new Map<string, number>();
    allZones.forEach((z: any) => {
      if (z.name) zoneMap.set(z.name.toLowerCase().trim(), z.id);
    });

    const existingContractMap = new Map<string, number>();
    allExisting.forEach((e: any) => {
      if (e.serialNumber) existingContractMap.set(e.serialNumber.toLowerCase().trim(), e.id);
    });

    const findCustomerId = (name: string): number | null => {
      if (!name) return null;
      const clean = name.toLowerCase().trim();
      if (customerMap.has(clean)) return customerMap.get(clean)!;
      for (const [cName, id] of customerMap.entries()) {
        if (cName.includes(clean) || clean.includes(cName)) return id;
      }
      return null;
    };

    const findZoneId = (name: string): number | null => {
      if (!name) return null;
      const clean = name.toLowerCase().trim();
      if (zoneMap.has(clean)) return zoneMap.get(clean)!;
      for (const [zName, id] of zoneMap.entries()) {
        if (zName.includes(clean) || clean.includes(zName)) return id;
      }
      return null;
    };

    const results = { created: 0, updated: 0, success: 0, failed: 0, errors: [] as any[] };

    // 2. Process in fast concurrent chunks of 50
    const CHUNK_SIZE = 50;
    for (let cIdx = 0; cIdx < importRecords.length; cIdx += CHUNK_SIZE) {
      const chunk = importRecords.slice(cIdx, cIdx + CHUNK_SIZE);
      
      await Promise.all(chunk.map(async (row, idxInChunk) => {
        const globalRowIdx = cIdx + idxInChunk + 1;
        try {
          if (!row.customerName || !row.serialNumber) {
            results.errors.push({ row: globalRowIdx, error: 'Missing customerName or serialNumber' });
            results.failed++;
            return;
          }

          const serialNumber = String(row.serialNumber).trim();
          const cleanSerial = serialNumber.toLowerCase().trim();

          const customerId = row.customerId || findCustomerId(row.customerName);
          const zoneId = row.zoneId || findZoneId(row.zoneName);

          const mcDates = smartAlignDatePair(row.mcStartDate, row.mcEndDate);
          const warrantyDates = smartAlignDatePair(row.warrantyStartDate, row.warrantyEndDate);
          const softwareDates = smartAlignDatePair(row.softwareStartDate, row.softwareEndDate);
          const remoteSupportDates = smartAlignDatePair(row.remoteSupportStartDate, row.remoteSupportEndDate);

          const payload = {
            slNo: row.slNo ? parseInt(row.slNo) : null,
            customerName: row.customerName.trim(),
            customerClass: row.customerClass || null,
            place: row.place || null,
            department: row.department || null,
            zoneName: row.zoneName || 'Unknown',
            engineerName: row.engineerName || null,
            unitType: row.unitType || row.modelNumber || null,
            controlType: row.controlType || null,
            serialNumber,
            softwareName: row.softwareName || null,
            installationYear: row.installationYear ? String(row.installationYear) : null,
            contractType: row.contractType || null,
            mcPoNumber: row.mcPoNumber ? String(row.mcPoNumber) : null,
            poDate: parseDate(row.poDate),
            mcStartDate: mcDates.startDate,
            mcEndDate: mcDates.endDate,
            warrantyStartDate: warrantyDates.startDate,
            warrantyEndDate: warrantyDates.endDate,
            softwarePoNo: row.softwarePoNo ? String(row.softwarePoNo) : null,
            softwareStartDate: softwareDates.startDate,
            softwareEndDate: softwareDates.endDate,
            remoteSupportStartDate: remoteSupportDates.startDate,
            remoteSupportEndDate: remoteSupportDates.endDate,
            pmVisitsCount: parseInt(row.pmVisitsCount) || 0,
            bdVisitsCount: parseInt(row.bdVisitsCount) || 0,
            mcValue: parseNumeric(row.mcValue),
            customer: customerId ? { connect: { id: customerId } } : undefined,
            zone: zoneId ? { connect: { id: zoneId } } : undefined,
            createdBy: userId ? { connect: { id: userId } } : undefined,
          };

          const existingId = existingContractMap.get(cleanSerial);

          if (existingId) {
            await db.detailedContract.update({
              where: { id: existingId },
              data: payload,
            });
            results.updated++;
          } else {
            const created = await db.detailedContract.create({
              data: payload,
            });
            existingContractMap.set(cleanSerial, created.id);
            results.created++;
          }

          results.success++;
        } catch (err: any) {
          results.errors.push({ row: globalRowIdx, error: err.message || 'Unknown error' });
          results.failed++;
        }
      }));
    }

    res.json({
      message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      ...results,
    });
  } catch (error) {
    console.error('Failed to bulk import detailed contracts:', error);
    res.status(500).json({ error: 'Failed to bulk import detailed contracts' });
  }
};

// ============================
// EXPORT (download template or data)
// ============================
export const exportDetailedContracts = async (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.query;
    const records = await db.detailedContract.findMany({
      orderBy: [{ customerName: 'asc' }, { slNo: 'asc' }],
    });

    if (format === 'json') {
      const enriched = records.map((r: any) => ({
        ...r,
        mcValue: r.mcValue ? Number(r.mcValue) : null,
        mcExpiry: computeExpiryStatus(r.mcEndDate),
        warrantyExpiry: computeExpiryStatus(r.warrantyEndDate),
      }));
      return res.json({ data: enriched });
    }

    // Default JSON export
    res.json({ data: records });
  } catch (error) {
    console.error('Failed to export detailed contracts:', error);
    res.status(500).json({ error: 'Failed to export detailed contracts' });
  }
};
