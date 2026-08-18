import { Response } from 'express';
import prisma from '../config/db';

// Safely cast prisma to bypass typescript client stale cache
const db = prisma as any;

// Helper to format date as DD/MM/YYYY
const formatDateString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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

// Helper to normalize MC Type casing
const normalizeMcType = (mcType: string | null | undefined): string => {
  if (!mcType) return '';
  const trimmed = mcType.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'flex care') return 'Flex Care';
  if (lower === 'full care') return 'Full Care';
  if (lower === 'premium care') return 'Premium Care';
  if (lower === 'active care') return 'Active Care';
  return trimmed.replace(/\b\w/g, (l: string) => l.toUpperCase());
};

// Create a new contract and distribute PM visits
export const createContract = async (req: any, res: Response) => {
  try {
    const {
      customerName,
      place,
      poNo,
      poDate,
      mcType,
      noOfMachine = 1,
      amount,
      noOfVisits = 3,
      startDate,
      endDate,
      responsible,
      zoneName,
      bdCount = 0,
      paymentTerms,
      softwareSupport = false,
      customerId,
      zoneId
    } = req.body;

    if (!customerName || !place || !poNo || !amount || !startDate || !endDate || !customerId || !zoneId) {
      return res.status(400).json({ error: 'Missing required contract fields' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const scheduledMonth = start.toLocaleString('default', { month: 'long' });

    // Distribute PM cycles
    const diff = end.getTime() - start.getTime();
    const segment = diff / noOfVisits;
    const pmSchedulesData: { pmNumber: number; range: string; status: string }[] = [];

    for (let i = 1; i <= noOfVisits; i++) {
      const cycleStart = new Date(start.getTime() + segment * (i - 1));
      const cycleEnd = new Date(start.getTime() + segment * i);
      pmSchedulesData.push({
        pmNumber: i,
        range: `${formatDateString(cycleStart)} TO ${formatDateString(cycleEnd)}`,
        status: 'Pending'
      });
    }

    const createdById = req.user?.id;
    if (!createdById) {
      return res.status(401).json({ error: 'User context not found' });
    }

    const currentYear = new Date().getFullYear();
    const existingContracts = await db.contract.findMany({
      where: {
        contractNumber: {
          startsWith: `CON-${currentYear}-`
        }
      },
      select: {
        contractNumber: true
      }
    });
    const existingNumbers = new Set(existingContracts.map((c: any) => c.contractNumber));
    let nextIndex = 1;
    let contractNumber = '';
    while (true) {
      const candidate = `CON-${currentYear}-${String(nextIndex).padStart(3, '0')}`;
      if (!existingNumbers.has(candidate)) {
        contractNumber = candidate;
        break;
      }
      nextIndex++;
    }

    const result = await db.$transaction(async (tx: any) => {
      let assignedToId: number | null = null;
      if (responsible) {
        const names = responsible.split(/[\/,]+/).map((n: string) => n.trim()).filter(Boolean);
        const primaryName = names[0] || responsible;
        const user = await tx.user.findFirst({
          where: {
            OR: [
              { name: { equals: primaryName, mode: 'insensitive' } },
              { email: { startsWith: primaryName.toLowerCase() } }
            ]
          }
        });
        if (user) {
          assignedToId = user.id;
        }
      }

      const contract = await tx.contract.create({
        data: {
          contractNumber,
          scheduledMonth,
          customerName,
          place,
          poNo,
          poDate: poDate ? new Date(poDate) : start,
          mcType: normalizeMcType(mcType),
          noOfMachine: Number(noOfMachine),
          amount: Number(amount),
          noOfVisits: Number(noOfVisits),
          startDate: start,
          endDate: end,
          responsible,
          zoneName,
          bdCount: bdCount !== undefined
            ? (String(bdCount).trim().toLowerCase() === 'unlimited' || String(bdCount).trim().toLowerCase() === 'ul' || String(bdCount).trim() === '999' ? 999 : (parseInt(String(bdCount), 10) || 0))
            : 0,
          paymentTerms,
          status: computeContractStatus(end),
          softwareSupport: Boolean(softwareSupport),
          customerId: Number(customerId),
          zoneId: Number(zoneId),
          createdById: Number(createdById),
          assignedToId
        }
      });

      const schedules = await Promise.all(
        pmSchedulesData.map(pm =>
          tx.contractPMSchedule.create({
            data: {
              contractId: contract.id,
              pmNumber: pm.pmNumber,
              range: pm.range,
              status: pm.status
            }
          })
        )
      );

      return { ...contract, pmSchedules: schedules };
    });

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Failed to create contract:', error);
    return res.status(500).json({ error: 'Failed to create contract', details: error.message });
  }
};

// List all contracts with role filtering & search filters
export const listContracts = async (req: any, res: Response) => {
  try {
    const { search = '', zone, status, tech } = req.query;
    const where: any = {};

    if (search) {
      where.OR = [
        { customerName: { contains: search as string, mode: 'insensitive' } },
        { place: { contains: search as string, mode: 'insensitive' } },
        { poNo: { contains: search as string, mode: 'insensitive' } },
        { contractNumber: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (status && status !== 'all') {
      const now = new Date();
      if (status === 'Expired') {
        where.endDate = { lt: now };
      } else if (status === 'Expiring Soon') {
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        where.endDate = { gte: now, lte: thirtyDaysLater };
      } else if (status === 'Active') {
        where.endDate = { gte: now };
      } else {
        where.status = status as string;
      }
    }

    if (zone && zone !== 'all') {
      where.zoneName = { contains: zone as string, mode: 'insensitive' };
    }

    if (tech && tech !== 'all') {
      where.responsible = { contains: tech as string, mode: 'insensitive' };
    }

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

    const contracts = await db.contract.findMany({
      where,
      include: {
        pmSchedules: {
          orderBy: { pmNumber: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const now = new Date();
    const mappedContracts = contracts.map((c: any) => ({
      ...c,
      status: computeContractStatus(c.endDate)
    }));

    return res.status(200).json(mappedContracts);
  } catch (error: any) {
    console.error('Failed to list contracts:', error);
    return res.status(500).json({ error: 'Failed to retrieve contracts', details: error.message });
  }
};

// Get single contract details
export const getContractById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await db.contract.findUnique({
      where: { id: Number(id) },
      include: {
        pmSchedules: {
          orderBy: { pmNumber: 'asc' }
        }
      }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const mappedContract = {
      ...contract,
      status: computeContractStatus(contract.endDate)
    };

    return res.status(200).json(mappedContract);
  } catch (error: any) {
    console.error('Failed to get contract:', error);
    return res.status(500).json({ error: 'Failed to retrieve contract', details: error.message });
  }
};

// Update PM Schedule cycle status
export const updatePMSchedule = async (req: any, res: Response) => {
  try {
    const { pmId } = req.params;
    const { status, completedAt } = req.body;

    if (!status || !['Completed', 'Pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updated = await db.contractPMSchedule.update({
      where: { id: Number(pmId) },
      data: {
        status,
        completedAt: status === 'Completed'
          ? (completedAt ? new Date(completedAt) : new Date())
          : null
      }
    });

    return res.status(200).json(updated);
  } catch (error: any) {
    console.error('Failed to update PM schedule:', error);
    return res.status(500).json({ error: 'Failed to update schedule status', details: error.message });
  }
};

// Delete service agreement
export const deleteContract = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    await db.contract.delete({
      where: { id: Number(id) }
    });

    return res.status(200).json({ message: 'Contract deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete contract:', error);
    return res.status(500).json({ error: 'Failed to delete contract', details: error.message });
  }
};

// Update contract details
export const updateContract = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      place,
      poNo,
      poDate,
      mcType,
      noOfMachine,
      amount,
      noOfVisits,
      startDate,
      endDate,
      responsible,
      zoneName,
      bdCount,
      paymentTerms,
      softwareSupport,
      status,
      customerId,
      zoneId
    } = req.body;

    const contractId = Number(id);
    const existing = await db.contract.findUnique({
      where: { id: contractId },
      include: { pmSchedules: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const start = startDate ? new Date(startDate) : existing.startDate;
    const end = endDate ? new Date(endDate) : existing.endDate;
    const scheduledMonth = startDate ? start.toLocaleString('default', { month: 'long' }) : existing.scheduledMonth;

    // Check if dates or visits count changed, to redistribute PM cycles
    const datesChanged = startDate && new Date(startDate).getTime() !== existing.startDate.getTime();
    const endDateChanged = endDate && new Date(endDate).getTime() !== existing.endDate.getTime();
    const visitsChanged = noOfVisits !== undefined && Number(noOfVisits) !== existing.noOfVisits;

    let pmSchedulesData: { pmNumber: number; range: string; status: string }[] = [];
    const redistNeeded = datesChanged || endDateChanged || visitsChanged;

    const visitsCount = noOfVisits !== undefined ? Number(noOfVisits) : existing.noOfVisits;

    if (redistNeeded) {
      const diff = end.getTime() - start.getTime();
      const segment = diff / visitsCount;
      for (let i = 1; i <= visitsCount; i++) {
        const cycleStart = new Date(start.getTime() + segment * (i - 1));
        const cycleEnd = new Date(start.getTime() + segment * i);
        pmSchedulesData.push({
          pmNumber: i,
          range: `${formatDateString(cycleStart)} TO ${formatDateString(cycleEnd)}`,
          status: 'Pending'
        });
      }
    }

    const result = await db.$transaction(async (tx: any) => {
      let assignedToId: number | null | undefined = undefined;
      const respName = responsible !== undefined ? responsible : existing.responsible;
      if (respName) {
        const names = respName.split(/[\/,]+/).map((n: string) => n.trim()).filter(Boolean);
        const primaryName = names[0] || respName;
        const user = await tx.user.findFirst({
          where: {
            OR: [
              { name: { equals: primaryName, mode: 'insensitive' } },
              { email: { startsWith: primaryName.toLowerCase() } }
            ]
          }
        });
        if (user) {
          assignedToId = user.id;
        }
      }

      // Update contract metadata
      const contract = await tx.contract.update({
        where: { id: contractId },
        data: {
          scheduledMonth,
          customerName: customerName ?? existing.customerName,
          place: place ?? existing.place,
          poNo: poNo ?? existing.poNo,
          poDate: poDate ? new Date(poDate) : (poNo ? start : existing.poDate),
          mcType: normalizeMcType(mcType ?? existing.mcType),
          noOfMachine: noOfMachine !== undefined ? Number(noOfMachine) : existing.noOfMachine,
          amount: amount !== undefined ? Number(amount) : existing.amount,
          noOfVisits: visitsCount,
          startDate: start,
          endDate: end,
          responsible: responsible ?? existing.responsible,
          zoneName: zoneName ?? existing.zoneName,
          bdCount: bdCount !== undefined
            ? (String(bdCount).trim().toLowerCase() === 'unlimited' || String(bdCount).trim().toLowerCase() === 'ul' || String(bdCount).trim() === '999' ? 999 : (parseInt(String(bdCount), 10) || 0))
            : existing.bdCount,
          paymentTerms: paymentTerms ?? existing.paymentTerms,
          softwareSupport: softwareSupport !== undefined ? Boolean(softwareSupport) : existing.softwareSupport,
          status: status !== undefined ? status : computeContractStatus(end),
          customerId: customerId !== undefined ? Number(customerId) : existing.customerId,
          zoneId: zoneId !== undefined ? Number(zoneId) : existing.zoneId,
          assignedToId
        }
      });

      if (redistNeeded) {
        // Delete old schedules
        await tx.contractPMSchedule.deleteMany({
          where: { contractId }
        });

        // Insert new schedules
        const schedules = await Promise.all(
          pmSchedulesData.map(pm =>
            tx.contractPMSchedule.create({
              data: {
                contractId,
                pmNumber: pm.pmNumber,
                range: pm.range,
                status: pm.status
              }
            })
          )
        );

        return { ...contract, pmSchedules: schedules };
      }

      const schedules = await tx.contractPMSchedule.findMany({
        where: { contractId },
        orderBy: { pmNumber: 'asc' }
      });

      return { ...contract, pmSchedules: schedules };
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Failed to update contract:', error);
    return res.status(500).json({ error: 'Failed to update contract', details: error.message });
  }
};

// Bulk create/update contracts — optimised with pre-fetch + batch operations
export const bulkImportContracts = async (req: any, res: Response) => {
  try {
    const { contracts } = req.body;
    if (!Array.isArray(contracts) || contracts.length === 0) {
      return res.status(400).json({ error: 'No contracts payload provided' });
    }

    const createdById = req.user?.id;
    if (!createdById) {
      return res.status(401).json({ error: 'User context not found' });
    }

    // ── PHASE 0: Pre-fetch all lookup data in parallel (3 queries total) ──
    const incomingContractNumbers = contracts
      .map(c => c.contractNumber ? String(c.contractNumber).trim() : null)
      .filter(Boolean) as string[];

    const [existingContractsRaw, allCustomers, allUsers, currentYearContracts] = await Promise.all([
      // All contracts matching incoming contract numbers
      incomingContractNumbers.length > 0
        ? db.contract.findMany({
          where: { contractNumber: { in: incomingContractNumbers } },
          include: { pmSchedules: true }
        })
        : Promise.resolve([]),

      // All customers (for matching without per-row query)
      db.customer.findMany({
        select: { id: true, companyName: true, address: true, serviceZoneId: true }
      }),

      // All users (for responsible lookup)
      db.user.findMany({
        select: { id: true, name: true, email: true }
      }),

      // Existing contract numbers this year (for sequential numbering)
      db.contract.findMany({
        where: { contractNumber: { startsWith: `CON-${new Date().getFullYear()}-` } },
        select: { contractNumber: true }
      })
    ]);

    // Build O(1) lookup maps
    const existingByContractNo = new Map<string, any>(
      existingContractsRaw.map((c: any) => [c.contractNumber, c])
    );

    // Customer map: key = `${companyName_lower}::${address_lower}::${zoneId}`
    const customerMap = new Map<string, any>();
    allCustomers.forEach((c: any) => {
      const key = `${String(c.companyName).toLowerCase().trim()}::${String(c.address || '').toLowerCase().trim()}::${c.serviceZoneId}`;
      customerMap.set(key, c);
    });

    // User map: name_lower → id
    const userByName = new Map<string, number>(
      allUsers.map((u: any) => [String(u.name).toLowerCase().trim(), u.id])
    );

    const normalizePlaceForComparison = (place: string): string => {
      const norm = place.trim().toLowerCase();

      // Bangalore synonyms
      if (norm === 'bangalore' || norm === 'bengaluru' || norm === 'bng' || norm === 'blr' || norm.includes('bangalore') || norm.includes('bengaluru')) {
        return 'bengaluru';
      }

      // Belgaum synonyms
      if (norm === 'belgum' || norm === 'belgam' || norm === 'belgaum') {
        return 'belgaum';
      }

      // Kolkata synonyms
      if (norm === 'kolkota' || norm === 'kolkata') {
        return 'kolkata';
      }

      // Nashik synonyms
      if (norm === 'nasik' || norm === 'nashik') {
        return 'nashik';
      }

      // Akurdi synonyms
      if (norm === 'akrudi' || norm === 'akurdi') {
        return 'akurdi';
      }

      // Hoshiarpur synonyms
      if (norm === 'hosiarpur-punjab' || norm === 'hoshiarpur- punjab' || norm === 'hoshiarpur' || norm.includes('hoshiarpur') || norm.includes('hosiarpur')) {
        return 'hoshiarpur';
      }

      // Dapodi synonyms
      if (norm === 'dapodi' || norm === 'dapodi pune' || norm === 'dapodi, pune' || norm === 'dapodi-pune') {
        return 'dapodi';
      }

      // Chinchwad synonyms
      if (norm === 'chinchwad pune' || norm === 'chinhwad - pune' || norm === 'chinchwad-pune' || norm.includes('chinchwad') || norm.includes('chinhwad')) {
        return 'chinchwad';
      }

      // Bidadi synonyms
      if (norm === 'bidaddi' || norm === 'bidadi') {
        return 'bidadi';
      }

      // Kothrud/Pune
      if (norm === 'kothrud') {
        return 'pune';
      }

      return norm;
    };

    const isPlaceMatch = (p1: string, p2: string): boolean => {
      if (!p1 || !p2) return true;
      const n1 = normalizePlaceForComparison(p1);
      const n2 = normalizePlaceForComparison(p2);
      return n1 === n2 || n1.includes(n2) || n2.includes(n1);
    };

    const isFuzzyNameMatch = (n1: string, n2: string): boolean => {
      const clean = (s: string) => s.toLowerCase().replace(/\b(pvt|ltd|private|limited|co|corp|corporation|company|india|ltd\.|pvt\.)\b/gi, '').replace(/[^a-z0-9]/g, '').trim();
      return clean(n1) === clean(n2);
    };

    const findCustomerInDb = (custName: string, custPlace: string, zId: number) => {
      const normName = String(custName).trim().toLowerCase();
      const normPlace = custPlace ? String(custPlace).trim().toLowerCase() : '';
      const directKey = `${normName}::${normPlace}::${zId}`;
      if (customerMap.has(directKey)) {
        return customerMap.get(directKey);
      }

      // Fuzzy lookup across allCustomers
      for (const [key, cust] of customerMap.entries()) {
        if (cust.serviceZoneId !== zId) continue;
        if (!isFuzzyNameMatch(cust.companyName, custName)) continue;
        if (custPlace && cust.address) {
          if (isPlaceMatch(custPlace, cust.address)) return cust;
        } else if (!custPlace && !cust.address) {
          return cust;
        }
      }
      return null;
    };

    const existingNumbers = new Set(currentYearContracts.map((c: any) => c.contractNumber));
    const currentYear = new Date().getFullYear();
    let nextIndex = 1;

    const generateContractNumber = (): string => {
      while (true) {
        const candidate = `CON-${currentYear}-${String(nextIndex).padStart(3, '0')}`;
        nextIndex++;
        if (!existingNumbers.has(candidate)) {
          existingNumbers.add(candidate);
          return candidate;
        }
      }
    };

    // ── PHASE 1: Auto-create missing customers (outside main transaction for speed) ──
    const customersToCreate: { companyName: string; address: string | null; serviceZoneId: number; key: string }[] = [];

    for (const item of contracts) {
      const { customerName, place, zoneId, customerId } = item;
      if (!customerName || !zoneId) continue;

      // If caller already resolved a customerId, skip
      if (customerId) continue;

      const normName = String(customerName).trim().toLowerCase();
      const normPlace = place ? String(place).trim().toLowerCase() : '';
      const custKey = `${normName}::${normPlace}::${Number(zoneId)}`;

      const existingCust = findCustomerInDb(customerName, place || '', Number(zoneId));
      if (!existingCust && !customersToCreate.find(c => c.key === custKey)) {
        customersToCreate.push({
          companyName: String(customerName).trim(),
          address: place ? String(place).trim() : null,
          serviceZoneId: Number(zoneId),
          key: custKey
        });
      }
    }

    // Create missing customers in one batch if any
    if (customersToCreate.length > 0) {
      const created = await db.$transaction(
        customersToCreate.map(c =>
          db.customer.create({
            data: {
              companyName: c.companyName,
              address: c.address,
              serviceZoneId: c.serviceZoneId,
              createdById: Number(createdById),
              updatedById: Number(createdById)
            },
            select: { id: true, companyName: true, address: true, serviceZoneId: true }
          })
        )
      );
      created.forEach((c: any) => {
        const key = `${String(c.companyName).toLowerCase().trim()}::${String(c.address || '').toLowerCase().trim()}::${c.serviceZoneId}`;
        customerMap.set(key, c);
      });
    }

    // ── PHASE 2: Also scan for existing contracts by (customerName+place+zoneId) for rows without contractNumber ──
    // Fetch existing contracts for those combos to avoid duplicates
    const nameBasedContracts = await db.contract.findMany({
      where: {
        customerName: { in: contracts.map((c: any) => String(c.customerName || '').trim()).filter(Boolean) }
      },
      include: { pmSchedules: true }
    });
    // Existing by natural key: customerName_lower::place_lower::zoneId
    const existingByNaturalKey = new Map<string, any>();
    nameBasedContracts.forEach((c: any) => {
      const key = `${String(c.customerName).toLowerCase().trim()}::${String(c.place || '').toLowerCase().trim()}::${c.zoneId}`;
      // Keep the most recent one if duplicates exist
      if (!existingByNaturalKey.has(key)) {
        existingByNaturalKey.set(key, c);
      }
    });

    // ── PHASE 3: Process each contract (create or update) ──
    const results: any[] = [];

    for (const item of contracts) {
      const {
        contractNumber,
        customerName,
        place,
        poNo,
        poDate,
        mcType,
        noOfMachine = 1,
        amount,
        noOfVisits = 3,
        startDate,
        endDate,
        responsible,
        zoneName,
        bdCount = 0,
        paymentTerms,
        softwareSupport = false,
        customerId,
        zoneId,
        pmSchedules
      } = item;

      if (!customerName || !place || !startDate || !endDate || !zoneId || amount === undefined || amount === null || isNaN(Number(amount))) {
        throw new Error(`Missing required fields for customer: ${customerName || 'Unknown'}`);
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error(`Invalid dates for customer: ${customerName}`);
      }

      const scheduledMonth = start.toLocaleString('default', { month: 'long' });
      const safePoNo = poNo ? String(poNo).trim() : '';
      const safeMcType = mcType ? normalizeMcType(String(mcType)) : '';
      const safeResponsible = responsible ? String(responsible).trim() : '';
      const safeZoneName = zoneName ? String(zoneName).trim() : '';
      const safePoDate = poDate && !isNaN(new Date(poDate).getTime()) ? new Date(poDate) : start;

      // Resolve customer id
      let finalCustomerId: number | null = null;
      if (customerId && Number(customerId)) {
        finalCustomerId = Number(customerId);
      } else {
        const found = findCustomerInDb(customerName, place || '', Number(zoneId));
        if (found) finalCustomerId = found.id;
      }

      // Resolve user id from name
      let assignedToId: number | null = null;
      if (safeResponsible) {
        const primaryName = safeResponsible.split(/[\/,]+/)[0].trim().toLowerCase();
        assignedToId = userByName.get(primaryName) || null;
      }

      // Build PM schedule data
      const pmSchedulesData: { pmNumber: number; range: string; status: string; completedAt: Date | null }[] = [];

      if (Array.isArray(pmSchedules) && pmSchedules.length > 0) {
        pmSchedules.forEach((pm: any) => {
          const pmDate = pm.completedAt && !isNaN(new Date(pm.completedAt).getTime()) ? new Date(pm.completedAt) : null;
          pmSchedulesData.push({
            pmNumber: Number(pm.pmNum || pm.pmNumber),
            range: pm.range || '',
            status: pmDate ? 'Completed' : 'Pending',
            completedAt: pmDate
          });
        });
      } else {
        const diff = end.getTime() - start.getTime();
        const segment = diff / Number(noOfVisits);
        for (let i = 1; i <= Number(noOfVisits); i++) {
          const cycleStart = new Date(start.getTime() + segment * (i - 1));
          const cycleEnd = new Date(start.getTime() + segment * i);
          pmSchedulesData.push({
            pmNumber: i,
            range: `${formatDateString(cycleStart)} TO ${formatDateString(cycleEnd)}`,
            status: 'Pending',
            completedAt: null
          });
        }
      }

      let parsedBdCount = 0;
      if (bdCount !== undefined && bdCount !== null) {
        const bdStr = String(bdCount).trim().toLowerCase();
        if (bdStr === 'unlimited' || bdStr === 'ul' || bdStr === '999') parsedBdCount = 999;
        else parsedBdCount = parseInt(bdStr, 10) || 0;
      }

      // Find existing contract: by contractNumber first, then by natural key
      const safeContractNo = contractNumber ? String(contractNumber).trim() : '';
      const naturalKey = `${String(customerName).trim().toLowerCase()}::${String(place).trim().toLowerCase()}::${Number(zoneId)}`;

      const existingContract = (safeContractNo && existingByContractNo.has(safeContractNo))
        ? existingByContractNo.get(safeContractNo)
        : existingByNaturalKey.get(naturalKey) || null;

      const contractData = {
        scheduledMonth,
        customerName: String(customerName).trim(),
        place: String(place).trim(),
        poNo: safePoNo,
        poDate: safePoDate,
        mcType: safeMcType,
        noOfMachine: Number(noOfMachine || 1),
        amount: Number(amount || 0),
        noOfVisits: Number(noOfVisits || 3),
        startDate: start,
        endDate: end,
        responsible: safeResponsible,
        zoneName: safeZoneName,
        bdCount: parsedBdCount,
        paymentTerms: paymentTerms ? String(paymentTerms).trim() : null,
        status: computeContractStatus(end),
        softwareSupport: Boolean(softwareSupport),
        zoneId: Number(zoneId),
        assignedToId
      };

      let savedContract: any;

      if (existingContract) {
        // ── UPDATE existing contract ──
        savedContract = await db.contract.update({
          where: { id: existingContract.id },
          data: contractData
        });

        // Sync PM schedules: delete obsolete, upsert remaining
        // Delete PMs that no longer exist
        await db.contractPMSchedule.deleteMany({
          where: {
            contractId: existingContract.id,
            pmNumber: { gt: pmSchedulesData.length }
          }
        });

        // Update or create each PM using upsert
        await Promise.all(
          pmSchedulesData.map(pm => {
            const existingPM = existingContract.pmSchedules?.find((p: any) => p.pmNumber === pm.pmNumber);
            if (existingPM) {
              return db.contractPMSchedule.update({
                where: { id: existingPM.id },
                data: {
                  range: pm.range,
                  // Don't override Completed status back to Pending
                  status: pm.status === 'Completed' ? 'Completed' : existingPM.status,
                  completedAt: pm.status === 'Completed' ? (pm.completedAt || existingPM.completedAt) : existingPM.completedAt
                }
              });
            } else {
              return db.contractPMSchedule.create({
                data: {
                  contractId: existingContract.id,
                  pmNumber: pm.pmNumber,
                  range: pm.range,
                  status: pm.status,
                  completedAt: pm.completedAt
                }
              });
            }
          })
        );

      } else {
        // ── CREATE new contract ──
        const genContractNumber = safeContractNo || generateContractNumber();

        savedContract = await db.contract.create({
          data: {
            ...contractData,
            contractNumber: genContractNumber,
            customerId: finalCustomerId ? Number(finalCustomerId) : undefined,
            createdById: Number(createdById)
          }
        });

        // Create PMs in one batch
        await db.contractPMSchedule.createMany({
          data: pmSchedulesData.map(pm => ({
            contractId: savedContract.id,
            pmNumber: pm.pmNumber,
            range: pm.range,
            status: pm.status,
            completedAt: pm.completedAt
          }))
        });
      }

      results.push(savedContract);
    }

    return res.status(201).json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    console.error('Failed bulk importing contracts:', error);
    return res.status(500).json({ error: 'Failed bulk importing contracts', details: error.message });
  }
};
