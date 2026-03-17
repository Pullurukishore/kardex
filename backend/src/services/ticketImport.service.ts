import XLSX from 'xlsx';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';

/**
 * Map Excel time values.
 * Excel stores time as fraction of a day (e.g., 0.75 = 18:00).
 */
function excelTimeToString(val: any): string | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'string') return val.trim() || null;
    if (typeof val === 'number') {
        // Excel time serial number → HH:mm
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return null;
}

/**
 * Parse Excel date to JS Date (handles serial numbers and strings).
 */
function excelDateToJS(excelDate: any): Date | null {
    if (!excelDate) return null;
    let date: Date | null = null;

    if (typeof excelDate === 'string') {
        // Try common date formats  
        const trimmed = excelDate.trim();
        if (!trimmed) return null;
        date = new Date(trimmed);
    } else if (typeof excelDate === 'number') {
        // Excel serial number
        date = new Date((excelDate - 25569) * 86400 * 1000);
    }

    if (date && !isNaN(date.getTime())) {
        const year = date.getFullYear();
        if (year < 1900 || year > 2100) return null;
        return date;
    }
    return null;
}

/**
 * Combine a date and a time value into a single Date.
 */
function combineDateAndTime(dateVal: any, timeVal: any): Date | null {
    const date = excelDateToJS(dateVal);
    if (!date) return null;

    const timeStr = excelTimeToString(timeVal);
    if (timeStr) {
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
            date.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0, 0);
        }
    }
    return date;
}

/**
 * Check if a row is effectively empty.
 */
function isRowEmpty(row: any[]): boolean {
    return !row || row.length === 0 || !row.some(cell =>
        cell !== null && cell !== undefined && String(cell).trim() !== ''
    );
}

/**
 * Map call type string from Excel to db enum.
 */
function mapCallType(val: any): string | null {
    if (!val) return null;
    const s = String(val).trim().toUpperCase();
    if (s === 'UMC' || s.includes('UNDER') || s.includes('MAINTENANCE') || s.includes('CONTRACT')) {
        return 'UNDER_MAINTENANCE_CONTRACT';
    }
    if (s === 'NON UMC' || s.includes('NOT') || s.includes('WITHOUT')) {
        return 'NOT_UNDER_CONTRACT';
    }
    // Default: return UMC if it looks like it, else NOT_UNDER_CONTRACT
    return 'NOT_UNDER_CONTRACT';
}

/**
 * Fix "Phantom Rows" in XLSX sheets.
 */
function trimPhantomRows(sheet: any) {
    const ref = sheet['!ref'];
    if (!ref) return;

    const range = XLSX.utils.decode_range(ref);
    if (range.e.r > 5000) {
        const keys = Object.keys(sheet).filter(k => k[0] !== '!' && /^[A-Z]+\d+$/.test(k));
        if (keys.length === 0) return;

        let maxRow = 0;
        keys.forEach(key => {
            const r = XLSX.utils.decode_cell(key).r;
            if (r > maxRow) maxRow = r;
        });

        if (maxRow < range.e.r) {
            range.e.r = Math.min(maxRow, range.e.r);
            sheet['!ref'] = XLSX.utils.encode_range(range);
        }
    }
}

/**
 * Find the header row in data. We look for a row containing key headers like
 * "Company Name" or "Company Nan" (typo seen in screenshot) and "Ticket ID".
 * Returns null if not found.
 */
function findHeaderRow(data: any[][]) {
    for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row || !Array.isArray(row)) continue;
        const rowStr = row.map(c => String(c || '').trim().toLowerCase()).join('|');
        // Look for key columns present in the ticket Excel
        if ((rowStr.includes('company') || rowStr.includes('ticket')) &&
            (rowStr.includes('ticket id') || rowStr.includes('ticket date') || rowStr.includes('machine serial'))) {
            return i;
        }
    }
    return -1;
}

/**
 * Build column index map from headers.
 */
function buildColumnIndices(headers: any[]) {
    const getIdx = (keywords: string[]) => {
        return headers.findIndex(h => {
            if (h === null || h === undefined) return false;
            const s = String(h).toLowerCase().trim();
            return keywords.some(k => s === k.toLowerCase() || s.includes(k.toLowerCase()));
        });
    };

    return {
        companyName: getIdx(['Company Name', 'Company Nan']),
        place: getIdx(['Place']),
        ticketId: getIdx(['Ticket ID']),
        ticketDate: getIdx(['Ticket Date']),
        ticketTime: getIdx(['Ticket Time']),
        machineSerial: getIdx(['Machine serial Number', 'Machine Serial']),
        callType: getIdx(['Call Type']),
        error: getIdx(['Error']),
        responsibleFSM: getIdx(['Responsible FSM', 'Responsible FSM / Engineer', 'Engineer']),
        zone: getIdx(['Zone']),
        respDate: getIdx(['Resp Date', 'Rcsp Date']),
        respTime: getIdx(['Time']),
        respondTime: getIdx(['Respond time', 'Respond Time']),
        scheduledOn: getIdx(['Scheduled On']),
        closedOn: getIdx(['Closed on', 'Closed On']),
        legAStart: getIdx(['Leg A Start']),
        legAEnd: getIdx(['Leg A End']),
        legBStart: getIdx(['Leg B Start']),
        legBEnd: getIdx(['Leg B End']),
        reportedHour: getIdx(['Reported Hour']),
        travelHour: getIdx(['Travel Hour']),
        workStart: getIdx(['Work Start']),
        workEnd: getIdx(['Work End']),
        workHour: getIdx(['Work Hour']),
        kdxEngineer: getIdx(['Kdx Engineer']),
        kontoTeam: getIdx(['Konto Team']),
        serviceReportDetails: getIdx(['Service Report Details']),
        remarks: getIdx(['Remarks']),
        contactName: getIdx(['Name']),
        contactNumber: getIdx(['Number']),
        afterOfficeHours: getIdx(['After Office Hours']),
        closedOn2: getIdx(['Closed on2']),
        downtime: getIdx(['Downtime']),
        remarks2: getIdx(['Remarks2']),
        mdt: getIdx(['MDT']),
        responseOffSite: getIdx(['Response Off-Site']),
        responseOnSite: getIdx(['Response On-site']),
        month: getIdx(['Month']),
    };
}

function getCellStr(row: any[], idx: number): string | null {
    if (idx < 0 || !row[idx]) return null;
    return String(row[idx]).trim() || null;
}

function getCellNum(row: any[], idx: number): number | null {
    if (idx < 0 || row[idx] === null || row[idx] === undefined) return null;
    const n = Number(row[idx]);
    return isNaN(n) ? null : n;
}

export class TicketImportService {

    /**
     * Preview ticket import from Excel. Returns stats without writing to DB.
     */
    static async previewFromExcel(buffer: Buffer) {
        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.read(buffer, { type: 'buffer', dense: true });
        } catch (err: any) {
            logger.error('Failed to parse ticket Excel file:', err.message);
            throw new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('No sheets found in Excel file.');
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error('Could not read the sheet.');

        trimPhantomRows(sheet);
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length < 2) throw new Error('Sheet has no data rows.');

        const headerRowIndex = findHeaderRow(data);
        if (headerRowIndex === -1) throw new Error('Could not find header row. Expected columns like "Company Name", "Ticket ID", etc.');

        const indices = buildColumnIndices(data[headerRowIndex]);

        // Collect all ticket IDs from the sheet
        const ticketIds: string[] = [];
        let rowCount = 0;
        let emptyStreak = 0;
        const MAX_EMPTY = 50;

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (isRowEmpty(row)) {
                emptyStreak++;
                if (emptyStreak >= MAX_EMPTY) break;
                continue;
            }
            emptyStreak = 0;
            rowCount++;

            const ticketIdStr = getCellStr(row, indices.ticketId);
            if (ticketIdStr) ticketIds.push(ticketIdStr);
        }

        // Check which ticket IDs already exist (by ticketNumber)
        let existingCount = 0;
        if (ticketIds.length > 0) {
            const numericIds = ticketIds
                .map(id => parseInt(id))
                .filter(n => !isNaN(n));

            if (numericIds.length > 0) {
                const existing = await prisma.ticket.findMany({
                    where: { ticketNumber: { in: numericIds } },
                    select: { ticketNumber: true }
                });
                existingCount = existing.length;
            }
        }

        // Build sample rows for preview
        const sampleRows: any[] = [];
        let sampleCount = 0;
        emptyStreak = 0;
        for (let i = headerRowIndex + 1; i < data.length && sampleCount < 10; i++) {
            const row = data[i];
            if (isRowEmpty(row)) {
                emptyStreak++;
                if (emptyStreak >= MAX_EMPTY) break;
                continue;
            }
            emptyStreak = 0;
            sampleCount++;

            sampleRows.push({
                ticketId: getCellStr(row, indices.ticketId),
                company: getCellStr(row, indices.companyName),
                place: getCellStr(row, indices.place),
                machineSerial: getCellStr(row, indices.machineSerial),
                zone: getCellStr(row, indices.zone),
                fsm: getCellStr(row, indices.responsibleFSM),
                callType: getCellStr(row, indices.callType),
                error: getCellStr(row, indices.error),
            });
        }

        return {
            totalRows: rowCount,
            totalNew: rowCount - existingCount,
            totalUpdate: existingCount,
            sheetName,
            sampleRows,
            headers: data[headerRowIndex]?.map((h: any) => String(h || '').trim()).filter(Boolean) || []
        };
    }

    /**
     * Import tickets from Excel buffer into database.
     */
    static async importFromExcel(buffer: Buffer, adminId: number) {
        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.read(buffer, { type: 'buffer', dense: true });
        } catch (err: any) {
            logger.error('Failed to parse ticket Excel file:', err.message);
            throw new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('No sheets found in Excel file.');
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error('Could not read the sheet.');

        trimPhantomRows(sheet);
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length < 2) throw new Error('Sheet has no data rows.');

        const headerRowIndex = findHeaderRow(data);
        if (headerRowIndex === -1) throw new Error('Could not find header row.');

        const indices = buildColumnIndices(data[headerRowIndex]);

        // Bulk-load lookups
        const [users, zones, allCustomers, allContacts, allAssets] = await Promise.all([
            prisma.user.findMany({ select: { id: true, name: true, email: true, zoneId: true, role: true } }),
            prisma.serviceZone.findMany({ select: { id: true, name: true } }),
            prisma.customer.findMany({ select: { id: true, companyName: true, serviceZoneId: true } }),
            prisma.contact.findMany({ select: { id: true, customerId: true, phone: true, name: true } }),
            prisma.asset.findMany({ select: { id: true, machineId: true, serialNo: true, customerId: true } })
        ]);

        // Build lookup maps
        const userByName = new Map<string, typeof users[0]>();
        users.forEach(u => {
            if (u.name) {
                userByName.set(u.name.toLowerCase().trim(), u);
                const firstName = u.name.trim().split(/\s+/)[0].toLowerCase();
                if (firstName && !userByName.has(firstName)) {
                    userByName.set(firstName, u);
                }
            }
        });

        const zoneByName = new Map<string, number>();
        zones.forEach(z => {
            zoneByName.set(z.name.toLowerCase().trim(), z.id);
        });

        const customerCache = new Map<string, number>();
        allCustomers.forEach(c => {
            customerCache.set(`${c.companyName.toLowerCase()}|${c.serviceZoneId}`, c.id);
        });

        const contactCache = new Map<string, number>();
        allContacts.forEach(c => {
            contactCache.set(`${c.customerId}|${c.phone}`, c.id);
        });

        const assetCache = new Map<string, { id: number; customerId: number }>();
        allAssets.forEach(a => {
            if (a.machineId) assetCache.set(a.machineId.toLowerCase(), { id: a.id, customerId: a.customerId });
            if (a.serialNo) assetCache.set(a.serialNo.toLowerCase(), { id: a.id, customerId: a.customerId });
        });

        // Get the current max ticket number for auto-generation
        const lastTicket = await prisma.ticket.findFirst({
            orderBy: { ticketNumber: 'desc' },
            select: { ticketNumber: true }
        });
        let nextTicketNumber = lastTicket?.ticketNumber ? lastTicket.ticketNumber + 1 : 1001;

        // Build map of existing tickets by ticketNumber for upsert
        const existingTickets = await prisma.ticket.findMany({
            select: { id: true, ticketNumber: true }
        });
        const ticketByNumber = new Map<number, number>();
        existingTickets.forEach(t => {
            if (t.ticketNumber) ticketByNumber.set(t.ticketNumber, t.id);
        });

        const results = {
            totalRead: 0,
            imported: 0,
            updated: 0,
            errors: 0,
            errorDetails: [] as string[]
        };

        // Default fallbacks
        const defaultZoneId = zones.length > 0 ? zones[0].id : 1;
        const adminUser = users.find(u => u.role === 'ADMIN') || users[0];

        // Process rows
        let emptyStreak = 0;
        const MAX_EMPTY = 50;
        const BATCH_SIZE = 5;
        const rows: { index: number; row: any[] }[] = [];

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (isRowEmpty(row)) {
                emptyStreak++;
                if (emptyStreak >= MAX_EMPTY) break;
                continue;
            }
            emptyStreak = 0;
            rows.push({ index: i, row });
        }

        results.totalRead = rows.length;

        for (let bi = 0; bi < rows.length; bi += BATCH_SIZE) {
            const batch = rows.slice(bi, bi + BATCH_SIZE);
            const batchResults = await Promise.allSettled(
                batch.map(async ({ index, row }) => {
                    try {
                        // ── Extract fields ──
                        const companyName = getCellStr(row, indices.companyName) || 'Unknown Company';
                        const place = getCellStr(row, indices.place);
                        const ticketIdRaw = getCellStr(row, indices.ticketId);
                        const ticketIdNum = ticketIdRaw ? parseInt(ticketIdRaw) : null;
                        const machineSerial = getCellStr(row, indices.machineSerial);
                        const callTypeRaw = getCellStr(row, indices.callType);
                        const errorDetails = getCellStr(row, indices.error);
                        const fsmName = getCellStr(row, indices.responsibleFSM);
                        const zoneName = getCellStr(row, indices.zone);
                        const closedOnVal = indices.closedOn >= 0 ? row[indices.closedOn] : null;
                        const closedOn2Val = indices.closedOn2 >= 0 ? row[indices.closedOn2] : null;
                        const scheduledOnVal = indices.scheduledOn >= 0 ? row[indices.scheduledOn] : null;
                        const kdxEngineerName = getCellStr(row, indices.kdxEngineer);
                        const serviceReport = getCellStr(row, indices.serviceReportDetails);
                        const remarksVal = getCellStr(row, indices.remarks);
                        const remarks2Val = getCellStr(row, indices.remarks2);
                        const contactName = getCellStr(row, indices.contactName) || 'Unknown Contact';
                        const contactNumber = getCellStr(row, indices.contactNumber) || '0000000000';
                        const afterOfficeHours = getCellStr(row, indices.afterOfficeHours);
                        const mdtVal = getCellStr(row, indices.mdt);
                        const kontoTeam = getCellStr(row, indices.kontoTeam);
                        const responseOffSite = getCellStr(row, indices.responseOffSite);
                        const responseOnSite = getCellStr(row, indices.responseOnSite);

                        // ── Date & time ──
                        const ticketDate = combineDateAndTime(
                            indices.ticketDate >= 0 ? row[indices.ticketDate] : null,
                            indices.ticketTime >= 0 ? row[indices.ticketTime] : null
                        ) || new Date();

                        const closedDate = excelDateToJS(closedOnVal) || excelDateToJS(closedOn2Val);
                        const scheduledDate = excelDateToJS(scheduledOnVal);

                        const workStartTime = excelTimeToString(indices.workStart >= 0 ? row[indices.workStart] : null);
                        const workEndTime = excelTimeToString(indices.workEnd >= 0 ? row[indices.workEnd] : null);

                        const legAStartTime = excelTimeToString(indices.legAStart >= 0 ? row[indices.legAStart] : null);
                        const legAEndTime = excelTimeToString(indices.legAEnd >= 0 ? row[indices.legAEnd] : null);
                        const legBStartTime = excelTimeToString(indices.legBStart >= 0 ? row[indices.legBStart] : null);
                        const legBEndTime = excelTimeToString(indices.legBEnd >= 0 ? row[indices.legBEnd] : null);

                        // ── Zone ──
                        let zoneId = defaultZoneId;
                        if (zoneName) {
                            const foundZone = zoneByName.get(zoneName.toLowerCase().trim());
                            if (foundZone) zoneId = foundZone;
                        }

                        // ── Customer (find or create) ──
                        const custKey = `${companyName.toLowerCase()}|${zoneId}`;
                        let customerId = customerCache.get(custKey);
                        if (!customerId) {
                            let customer = await prisma.customer.findFirst({
                                where: { companyName: { equals: companyName, mode: 'insensitive' }, serviceZoneId: zoneId }
                            });
                            if (!customer) {
                                customer = await prisma.customer.create({
                                    data: {
                                        companyName,
                                        address: place,
                                        serviceZoneId: zoneId,
                                        createdById: adminId,
                                        updatedById: adminId
                                    }
                                });
                            }
                            customerId = customer.id;
                            customerCache.set(custKey, customerId);
                        }

                        // ── Contact (find or create) ──
                        const contKey = `${customerId}|${contactNumber}`;
                        let contactId = contactCache.get(contKey);
                        if (!contactId) {
                            let contact = await prisma.contact.findFirst({
                                where: { customerId, phone: contactNumber }
                            });
                            if (!contact) {
                                contact = await prisma.contact.create({
                                    data: {
                                        name: contactName,
                                        contactPersonName: contactName,
                                        phone: contactNumber,
                                        contactNumber: contactNumber,
                                        customerId
                                    }
                                });
                            }
                            contactId = contact.id;
                            contactCache.set(contKey, contactId);
                        }

                        // ── Asset (find or create) ──
                        let assetId: number;
                        if (machineSerial) {
                            const assetInfo = assetCache.get(machineSerial.toLowerCase());
                            if (assetInfo) {
                                assetId = assetInfo.id;
                            } else {
                                let asset = await prisma.asset.findFirst({
                                    where: {
                                        OR: [
                                            { machineId: machineSerial },
                                            { serialNo: machineSerial }
                                        ]
                                    }
                                });
                                if (!asset) {
                                    asset = await prisma.asset.create({
                                        data: {
                                            machineId: machineSerial,
                                            serialNo: machineSerial,
                                            customerId
                                        }
                                    });
                                }
                                assetId = asset.id;
                                assetCache.set(machineSerial.toLowerCase(), { id: assetId, customerId });
                            }
                        } else {
                            // Need a default asset for the customer
                            let defaultAsset = await prisma.asset.findFirst({
                                where: { customerId }
                            });
                            if (!defaultAsset) {
                                defaultAsset = await prisma.asset.create({
                                    data: {
                                        machineId: `IMPORT-${customerId}-${Date.now()}`,
                                        customerId
                                    }
                                });
                            }
                            assetId = defaultAsset.id;
                        }

                        // ── Assigned User ──
                        let assignedToId: number | null = null;
                        if (fsmName) {
                            const found = userByName.get(fsmName.toLowerCase().trim());
                            if (found) assignedToId = found.id;
                        }

                        // ── Kdx Engineer → owner ──
                        let ownerId = adminId;
                        if (kdxEngineerName) {
                            const found = userByName.get(kdxEngineerName.toLowerCase().trim());
                            if (found) ownerId = found.id;
                        }

                        // ── Determine status ──
                        let status: string = 'OPEN';
                        if (closedDate) {
                            status = 'CLOSED';
                        } else if (assignedToId) {
                            status = 'ASSIGNED';
                        }

                        // ── Call type ──
                        const callType = mapCallType(callTypeRaw);

                        // ── Title ──
                        const title = errorDetails
                            ? `${companyName} - ${errorDetails.substring(0, 100)}`
                            : `${companyName} - Ticket ${ticketIdRaw || 'Import'}`;

                        // ── Build metadata JSON for extra fields ──
                        const metadata: any = {};
                        if (legAStartTime) metadata.legAStart = legAStartTime;
                        if (legAEndTime) metadata.legAEnd = legAEndTime;
                        if (legBStartTime) metadata.legBStart = legBStartTime;
                        if (legBEndTime) metadata.legBEnd = legBEndTime;
                        if (workStartTime) metadata.workStart = workStartTime;
                        if (workEndTime) metadata.workEnd = workEndTime;
                        if (afterOfficeHours) metadata.afterOfficeHours = afterOfficeHours;
                        if (mdtVal) metadata.mdt = mdtVal;
                        if (kontoTeam) metadata.kontoTeam = kontoTeam;
                        if (responseOffSite) metadata.responseOffSite = responseOffSite;
                        if (responseOnSite) metadata.responseOnSite = responseOnSite;
                        if (remarks2Val) metadata.remarks2 = remarks2Val;

                        const reportedHour = excelTimeToString(indices.reportedHour >= 0 ? row[indices.reportedHour] : null);
                        const travelHour = excelTimeToString(indices.travelHour >= 0 ? row[indices.travelHour] : null);
                        const workHour = excelTimeToString(indices.workHour >= 0 ? row[indices.workHour] : null);
                        const downtimeVal = excelTimeToString(indices.downtime >= 0 ? row[indices.downtime] : null);
                        if (reportedHour) metadata.reportedHour = reportedHour;
                        if (travelHour) metadata.travelHour = travelHour;
                        if (workHour) metadata.workHour = workHour;
                        if (downtimeVal) metadata.downtime = downtimeVal;

                        // ── Upsert Ticket ──
                        const isExisting = ticketIdNum && ticketByNumber.has(ticketIdNum);
                        const existingDbId = ticketIdNum ? ticketByNumber.get(ticketIdNum) : undefined;

                        const ticketData: any = {
                            title,
                            description: [
                                errorDetails || 'Imported ticket',
                                serviceReport ? `\n\nService Report: ${serviceReport}` : '',
                                remarksVal ? `\nRemarks: ${remarksVal}` : '',
                                remarks2Val ? `\nAdditional: ${remarks2Val}` : '',
                            ].join(''),
                            status: status as any,
                            priority: 'MEDIUM' as any,
                            callType: callType as any,
                            customerId,
                            contactId,
                            assetId,
                            ownerId,
                            createdById: adminId,
                            assignedToId,
                            zoneId,
                            errorDetails,
                            resolutionSummary: serviceReport || null,
                            visitPlannedDate: scheduledDate,
                            visitCompletedDate: closedDate,
                            lastStatusChange: closedDate || ticketDate,
                            relatedMachineIds: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
                        };

                        if (isExisting && existingDbId) {
                            // Update existing ticket
                            await prisma.ticket.update({
                                where: { id: existingDbId },
                                data: {
                                    ...ticketData,
                                    updatedAt: new Date(),
                                }
                            });
                            return { isNew: false };
                        } else {
                            // Create new ticket
                            const ticketNumber = ticketIdNum || nextTicketNumber++;
                            // Make sure ticketNumber doesn't collide
                            if (!ticketIdNum) {
                                while (ticketByNumber.has(ticketNumber)) {
                                    nextTicketNumber++;
                                }
                            }

                            const created = await prisma.ticket.create({
                                data: {
                                    ...ticketData,
                                    ticketNumber,
                                    createdAt: ticketDate,
                                }
                            });

                            // Track for future upsert within same import
                            if (ticketIdNum) {
                                ticketByNumber.set(ticketIdNum, created.id);
                            }

                            return { isNew: true };
                        }
                    } catch (err: any) {
                        throw new Error(`Row ${index + 1}: ${err.message}`);
                    }
                })
            );

            for (const res of batchResults) {
                if (res.status === 'fulfilled') {
                    if (res.value.isNew) {
                        results.imported++;
                    } else {
                        results.updated++;
                    }
                } else {
                    results.errors++;
                    const errMsg = res.reason?.message || 'Unknown error';
                    results.errorDetails.push(errMsg);
                    logger.error('Ticket import error:', errMsg);
                }
            }
        }

        return results;
    }
}
