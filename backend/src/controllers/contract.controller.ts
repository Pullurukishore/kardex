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
      const contract = await tx.contract.create({
        data: {
          contractNumber,
          scheduledMonth,
          customerName,
          place,
          poNo,
          poDate: poDate ? new Date(poDate) : start,
          mcType,
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
          softwareSupport: Boolean(softwareSupport),
          customerId: Number(customerId),
          zoneId: Number(zoneId),
          createdById: Number(createdById)
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
      where.status = status as string;
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

    return res.status(200).json(contracts);
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

    return res.status(200).json(contract);
  } catch (error: any) {
    console.error('Failed to get contract:', error);
    return res.status(500).json({ error: 'Failed to retrieve contract', details: error.message });
  }
};

// Update PM Schedule cycle status
export const updatePMSchedule = async (req: any, res: Response) => {
  try {
    const { pmId } = req.params;
    const { status } = req.body;

    if (!status || !['Completed', 'Pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updated = await db.contractPMSchedule.update({
      where: { id: Number(pmId) },
      data: {
        status,
        completedAt: status === 'Completed' ? new Date() : null
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
      // Update contract metadata
      const contract = await tx.contract.update({
        where: { id: contractId },
        data: {
          scheduledMonth,
          customerName: customerName ?? existing.customerName,
          place: place ?? existing.place,
          poNo: poNo ?? existing.poNo,
          poDate: poDate ? new Date(poDate) : (poNo ? start : existing.poDate),
          mcType: mcType ?? existing.mcType,
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
          status: status ?? existing.status,
          customerId: customerId !== undefined ? Number(customerId) : existing.customerId,
          zoneId: zoneId !== undefined ? Number(zoneId) : existing.zoneId
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

// Bulk create/import contracts inside a database transaction
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

    const results = await db.$transaction(async (tx: any) => {
      const imported: any[] = [];
      
      for (const item of contracts) {
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
          zoneId,
          pmSchedules
        } = item;

        if (!customerName || !place || !startDate || !endDate || !zoneId || amount === undefined || amount === null || isNaN(Number(amount))) {
          throw new Error(`Missing required fields in item for customer ${customerName || 'Unknown'}`);
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const scheduledMonth = start.toLocaleString('default', { month: 'long' });

        // Resolve or auto-create customer in backend
        let finalCustomerId = customerId ? Number(customerId) : null;
        if (!finalCustomerId) {
          let existingCust = await tx.customer.findFirst({
            where: { companyName: { equals: customerName, mode: 'insensitive' } }
          });
          
          if (!existingCust) {
            existingCust = await tx.customer.create({
              data: {
                companyName: customerName,
                address: place || null,
                serviceZoneId: Number(zoneId),
                createdById: Number(createdById),
                updatedById: Number(createdById)
              }
            });
          }
          finalCustomerId = existingCust.id;
        }

        // Parse custom PM schedules if available, otherwise auto-generate
        const pmSchedulesData: { pmNumber: number; range: string; status: string; completedAt: Date | null }[] = [];
        
        if (Array.isArray(pmSchedules) && pmSchedules.length > 0) {
          pmSchedules.forEach((pm: any) => {
            pmSchedulesData.push({
              pmNumber: Number(pm.pmNum || pm.pmNumber),
              range: pm.range || '',
              status: pm.completedAt ? 'Completed' : 'Pending',
              completedAt: pm.completedAt ? new Date(pm.completedAt) : null
            });
          });
        } else {
          // Distribute PM cycles
          const diff = end.getTime() - start.getTime();
          const segment = diff / noOfVisits;
          for (let i = 1; i <= noOfVisits; i++) {
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

        let contractNumber = '';
        while (true) {
          const candidate = `CON-${currentYear}-${String(nextIndex).padStart(3, '0')}`;
          if (!existingNumbers.has(candidate)) {
            contractNumber = candidate;
            existingNumbers.add(candidate);
            break;
          }
          nextIndex++;
        }

        let parsedBdCount = 0;
        if (bdCount !== undefined && bdCount !== null) {
          const bdStr = String(bdCount).trim().toLowerCase();
          if (bdStr === 'unlimited' || bdStr === 'ul' || bdStr === '999') {
            parsedBdCount = 999;
          } else {
            parsedBdCount = parseInt(bdStr, 10) || 0;
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
            mcType,
            noOfMachine: Number(noOfMachine),
            amount: Number(amount),
            noOfVisits: Number(noOfVisits),
            startDate: start,
            endDate: end,
            responsible,
            zoneName,
            bdCount: parsedBdCount,
            paymentTerms,
            softwareSupport: Boolean(softwareSupport),
            customerId: Number(finalCustomerId),
            zoneId: Number(zoneId),
            createdById: Number(createdById)
          }
        });

        const schedules = await Promise.all(
          pmSchedulesData.map(pm => 
            tx.contractPMSchedule.create({
              data: {
                contractId: contract.id,
                pmNumber: pm.pmNumber,
                range: pm.range,
                status: pm.status,
                completedAt: pm.completedAt
              }
            })
          )
        );

        imported.push({ ...contract, pmSchedules: schedules });
      }

      return imported;
    });

    return res.status(201).json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    console.error('Failed bulk importing contracts:', error);
    return res.status(500).json({ error: 'Failed bulk importing contracts', details: error.message });
  }
};

