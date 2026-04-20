import XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
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
 * Convert HH:mm to total minutes.
 */
function parseTimeToMinutes(timeStr: string | null): number | null {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const total = (hours * 60) + minutes;
        return total;
    }
    return null;
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
        responsibleFSM: getIdx(['Responsible FSM', 'Responsible FSM / Engineer', 'Engineer', 'Responsib']),
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
        kontoTeam: getIdx(['Konto Team', 'Konte Team']),
        serviceReportDetails: getIdx(['Service Report Details']),
        remarks: getIdx(['Remarks']),
        contactName: getIdx(['Name']),
        contactNumber: getIdx(['Number']),
        afterOfficeHours: getIdx(['After Office Hours']),
        closedOn2: getIdx(['Closed on2']),
        downtime: getIdx(['Downtime']),
        remarks2: getIdx(['Remarks2']),
        rowIdx: getIdx(['Row']),
        mdt: getIdx(['MDT']),
        responseOffSite: getIdx(['Response Off-Site']),
        responseOnSite: getIdx(['Response On-site']),
        month: getIdx(['Month']),
        ticketReg: getIdx(['Ticket Reg']),
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

const EXPERT_NAMES = ['amrender', 'sreenadh', 'rohit'];
const TYPO_MAP: Record<string, string> = {
    'asharf': 'ashraf',
};

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
            const existing = await prisma.ticket.findMany({
                where: { ticketNumber: { in: ticketIds } },
                select: { ticketNumber: true }
            });
            existingCount = existing.length;
        }

        // Build sample rows for preview
        const sampleRows: any[] = [];
        let sampleCount = 0;
        emptyStreak = 0;
        for (let i = headerRowIndex + 1; i < data.length; i++) {
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
                owner: getCellStr(row, indices.kdxEngineer),
                assigned: getCellStr(row, indices.kontoTeam),
                workStart: excelTimeToString(indices.workStart >= 0 ? row[indices.workStart] : null),
                workEnd: excelTimeToString(indices.workEnd >= 0 ? row[indices.workEnd] : null),
                downtime: excelTimeToString(indices.downtime >= 0 ? row[indices.downtime] : null),
                ticketReg: getCellStr(row, indices.ticketReg),
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
                const fullName = u.name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/\./g, '');
                userByName.set(fullName, u);

                // Map individual name parts (firstName, lastName) if unique
                const parts = fullName.split(' ');
                parts.forEach(part => {
                    if (part.length > 2 && !userByName.has(part)) {
                        userByName.set(part, u);
                    }
                });
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
        let nextTicketNumber = 1001;
        if (lastTicket?.ticketNumber) {
            const parsed = parseInt(lastTicket.ticketNumber, 10);
            if (!isNaN(parsed)) {
                nextTicketNumber = parsed + 1;
            }
        }

        // Shared map for newly created users during this import to prevent duplicate creation
        // We store the Promise itself to prevent race conditions during concurrent batch processing
        const userCreationPromises = new Map<string, Promise<number | null>>();

        // Build map of existing tickets by ticketNumber for upsert
        const existingTickets = await prisma.ticket.findMany({
            select: { id: true, ticketNumber: true }
        });
        const ticketByNumber = new Map<string, number>();
        existingTickets.forEach(t => {
            if (t.ticketNumber !== null && t.ticketNumber !== undefined) {
                ticketByNumber.set(String(t.ticketNumber), t.id);
            }
        });

        // Concurrency guard for tickets within the same batch
        const ongoingTicketCreations = new Map<string, Promise<number>>();

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
                        const ticketIdNum = ticketIdRaw || null;
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
                        const ticketReg = getCellStr(row, indices.ticketReg);
                        const responseOffSite = getCellStr(row, indices.responseOffSite);
                        const responseOnSite = getCellStr(row, indices.responseOnSite);

                        // ── Date & time ──
                        const ticketDate = combineDateAndTime(
                            indices.ticketDate >= 0 ? row[indices.ticketDate] : null,
                            indices.ticketTime >= 0 ? row[indices.ticketTime] : null
                        ) || new Date();

                        let closedDate = excelDateToJS(closedOnVal) || excelDateToJS(closedOn2Val);
                        const scheduledDate = excelDateToJS(scheduledOnVal);

                        // Lifecycle dates
                        const visitStartedAt = combineDateAndTime(
                            indices.respDate >= 0 ? row[indices.respDate] : (indices.ticketDate >= 0 ? row[indices.ticketDate] : null),
                            indices.respTime >= 0 ? row[indices.respTime] : null
                        );

                        const visitInProgressAt = combineDateAndTime(
                            indices.ticketDate >= 0 ? row[indices.ticketDate] : null,
                            indices.workStart >= 0 ? row[indices.workStart] : null
                        );

                        const visitResolvedAt = combineDateAndTime(
                            indices.ticketDate >= 0 ? row[indices.ticketDate] : null,
                            indices.workEnd >= 0 ? row[indices.workEnd] : null
                        );

                        const workStartTime = excelTimeToString(indices.workStart >= 0 ? row[indices.workStart] : null);
                        const workEndTime = excelTimeToString(indices.workEnd >= 0 ? row[indices.workEnd] : null);

                        const legAStartTime = excelTimeToString(indices.legAStart >= 0 ? row[indices.legAStart] : null);
                        const legAEndTime = excelTimeToString(indices.legAEnd >= 0 ? row[indices.legAEnd] : null);
                        const legBStartTime = excelTimeToString(indices.legBStart >= 0 ? row[indices.legBStart] : null);
                        const legBEndTime = excelTimeToString(indices.legBEnd >= 0 ? row[indices.legBEnd] : null);

                        // ── Build metadata JSON for extra fields ──
                        const metadata: any = {};

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

                        // ── Assigned User (Konte Team = Service Persons) ──
                        let assignedToId: number | null = null;
                        let subOwnerId: number | null = null;

                        const tryFindUser = (name: string | null) => {
                            if (!name) return null;
                            let normalized = name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/\./g, '');

                            // Apply typo map
                            if (TYPO_MAP[normalized]) {
                                normalized = TYPO_MAP[normalized];
                            }

                            // Check initial users baseline
                            let found = userByName.get(normalized);
                            if (found) return found;

                            return null;
                        };

                        const createMissingUser = async (name: string, role: string, zoneId: number): Promise<number | null> => {
                            if (!name || typeof name !== 'string') return null;

                            const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/\./g, '');
                            
                            // Check if the name looks like a note from the Excel file
                            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                            const keywords = ['logged', 'resolved', 'before', 'after', 'hour', 'min', 'closed', 'call', 'ticket', 'work'];
                            
                            const isPotentialNote = 
                                name.length > 35 || // Real names are rarely this long
                                /\d/.test(name) || // Contains digits (dates/times/years)
                                months.some(m => normalized.includes(m)) ||
                                keywords.some(k => normalized.includes(k));

                            if (isPotentialNote) {
                                logger.info(`Skipping user creation for suspected note/junk: "${name}"`);
                                return null;
                            }

                            // Check initial map first
                            const existingInMap = tryFindUser(name);
                            if (existingInMap) return existingInMap.id;

                            // ── Race Condition Guard ──
                            // Check if a creation for this name is already in progress
                            if (userCreationPromises.has(normalized)) {
                                return userCreationPromises.get(normalized)!;
                            }

                            // Start the creation promise and store it
                            const creationPromise = (async () => {
                                try {
                                    const email = `${normalized.replace(/[^a-z0-9]/g, '')}@kardex.com`;

                                    // Check DB by Email or Name
                                    const existing = await prisma.user.findFirst({
                                        where: {
                                            OR: [
                                                { email },
                                                { name: { equals: name, mode: 'insensitive' } }
                                            ]
                                        }
                                    });

                                    if (existing) {
                                        // Update zone if not set
                                        if (!existing.zoneId && role === 'SERVICE_PERSON') {
                                            await prisma.user.update({
                                                where: { id: existing.id },
                                                data: { zoneId: String(zoneId) }
                                            });
                                            // Ensure service person zone entryexists
                                            await prisma.servicePersonZone.upsert({
                                                where: { userId_serviceZoneId: { userId: existing.id, serviceZoneId: zoneId } },
                                                update: {},
                                                create: { userId: existing.id, serviceZoneId: zoneId }
                                            });
                                        }
                                        return existing.id;
                                    }

                                    const hashedPassword = await bcrypt.hash('Kardex@123', 10);
                                    const newUser = await prisma.user.create({
                                        data: {
                                            name,
                                            email,
                                            password: hashedPassword,
                                            role: role as any,
                                            isActive: true,
                                            tokenVersion: uuidv4(),
                                            zoneId: String(zoneId)
                                        }
                                    });

                                    // If service person, also add to junction table
                                    if (role === 'SERVICE_PERSON') {
                                        await prisma.servicePersonZone.create({
                                            data: {
                                                userId: newUser.id,
                                                serviceZoneId: zoneId
                                            }
                                        });
                                    }

                                    return newUser.id;
                                } catch (err) {
                                    // If we hit a race condition here despite the guard, try one last fetch
                                    const fallback = await prisma.user.findFirst({
                                        where: { name: { equals: name, mode: 'insensitive' } }
                                    });
                                    if (fallback) return fallback.id;

                                    logger.error(`Failed to auto-create user ${name}:`, err);
                                    return null;
                                }
                            })();

                            userCreationPromises.set(normalized, creationPromise);
                            return creationPromise;
                        };

                        let teamList: string[] = [];
                        if (kontoTeam) {
                            const names = kontoTeam.split('/').map(n => n.trim()).filter(Boolean);
                            teamList = names;
                            const userIds: number[] = [];

                            for (const name of names) {
                                const found = tryFindUser(name);
                                if (found) {
                                    userIds.push(found.id);
                                } else {
                                    const newId = await createMissingUser(name, 'SERVICE_PERSON', zoneId);
                                    if (newId) userIds.push(newId);
                                }
                            }

                            if (userIds.length > 0) {
                                assignedToId = userIds[0];
                                if (userIds.length > 1) {
                                    subOwnerId = userIds[1];
                                }
                                metadata.allAssigneeIds = userIds;
                                metadata.teamMembers = names;
                            }
                        }

                        // Fallback to FSM if no assignedToId yet
                        if (!assignedToId && fsmName) {
                            const names = fsmName.split('/').map(n => n.trim()).filter(Boolean);
                            teamList = names;
                            const userIds: number[] = [];

                            for (const name of names) {
                                const found = tryFindUser(name);
                                if (found) {
                                    userIds.push(found.id);
                                } else {
                                    const newId = await createMissingUser(name, 'SERVICE_PERSON', zoneId);
                                    if (newId) userIds.push(newId);
                                }
                            }

                            if (userIds.length > 0) {
                                assignedToId = userIds[0];
                                if (userIds.length > 1) {
                                    subOwnerId = userIds[1];
                                }
                                metadata.allAssigneeIds = userIds;
                                metadata.teamMembers = names;
                            }
                        }

                        // ── Kdx Engineer (Helpdesk / Zone Users) → owner ──
                        let ownerId = adminId;
                        if (kdxEngineerName) {
                            const names = kdxEngineerName.split('/').map(n => n.trim()).filter(Boolean);
                            const userIds: number[] = [];

                            for (const name of names) {
                                const found = tryFindUser(name);
                                if (found) {
                                    userIds.push(found.id);
                                } else {
                                    const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/\./g, '');
                                    const roleToAssign = EXPERT_NAMES.includes(normalized) ? 'EXPERT_HELPDESK' : 'ZONE_USER';
                                    const newId = await createMissingUser(name, roleToAssign, zoneId);
                                    if (newId) userIds.push(newId);
                                }
                            }

                            if (userIds.length > 0) {
                                ownerId = userIds[0];
                            }
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
                        if (legAStartTime) metadata.legAStart = legAStartTime;
                        if (legAEndTime) metadata.legAEnd = legAEndTime;
                        if (legBStartTime) metadata.legBStart = legBStartTime;
                        if (legBEndTime) metadata.legBEnd = legBEndTime;
                        if (workStartTime) metadata.workStart = workStartTime;
                        if (workEndTime) metadata.workEnd = workEndTime;
                        if (fsmName) metadata.responsibleFSM = fsmName;
                        if (afterOfficeHours) metadata.afterOfficeHours = afterOfficeHours;
                        if (mdtVal) metadata.mdt = mdtVal;
                        if (kontoTeam) metadata.kontoTeam = kontoTeam;
                        if (ticketReg) metadata.ticketReg = ticketReg;
                        if (responseOffSite) metadata.responseOffSite = responseOffSite;
                        if (responseOnSite) metadata.responseOnSite = responseOnSite;
                        if (remarks2Val) metadata.remarks2 = remarks2Val;

                        const reportedHour = excelTimeToString(indices.reportedHour >= 0 ? row[indices.reportedHour] : null);
                        const travelHour = excelTimeToString(indices.travelHour >= 0 ? row[indices.travelHour] : null);
                        const workHour = excelTimeToString(indices.workHour >= 0 ? row[indices.workHour] : null);
                        const downtimeVal = excelTimeToString(indices.downtime >= 0 ? row[indices.downtime] : null);
                        const respondTimeVal = excelTimeToString(indices.respondTime >= 0 ? row[indices.respondTime] : null);
                        if (reportedHour) metadata.reportedHour = reportedHour;
                        if (travelHour) metadata.travelHour = travelHour;
                        if (workHour) metadata.workHour = workHour;
                        if (downtimeVal) metadata.downtime = downtimeVal;
                        if (respondTimeVal) metadata.respondTime = respondTimeVal;

                        // Store all time values as minutes for dashboard/reports calculations
                        const respondTimeMinutes = parseTimeToMinutes(respondTimeVal);
                        const reportedHourMinutes = parseTimeToMinutes(reportedHour);
                        const travelHourMinutes = parseTimeToMinutes(travelHour);
                        const workHourMinutes = parseTimeToMinutes(workHour);
                        const downtimeMinutes = parseTimeToMinutes(downtimeVal);
                        if (respondTimeMinutes !== null) metadata.respondTimeMinutes = respondTimeMinutes;
                        if (reportedHourMinutes !== null) metadata.reportedHourMinutes = reportedHourMinutes;
                        if (travelHourMinutes !== null) metadata.travelHourMinutes = travelHourMinutes;
                        if (workHourMinutes !== null) metadata.workHourMinutes = workHourMinutes;
                        if (downtimeMinutes !== null) metadata.downtimeMinutes = downtimeMinutes;

                        // ── Upsert Ticket ──
                        const findExistingId = () => {
                            if (!ticketIdNum) return undefined;
                            return ticketByNumber.get(String(ticketIdNum));
                        };

                        const existingDbId = findExistingId();

                        const lastStatusChange = closedDate || visitResolvedAt || visitInProgressAt || visitStartedAt || ticketDate;

                        const ticketData: any = {
                            title,
                            description: [
                                errorDetails || 'Imported ticket',
                                teamList.length > 1 ? `\n\nAssigned Team: ${teamList.join(', ')}` : '',
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
                            subOwnerId,
                            createdById: adminId,
                            assignedToId,
                            zoneId,
                            errorDetails,
                            resolutionSummary: serviceReport || null,
                            visitPlannedDate: scheduledDate,
                            visitCompletedDate: closedDate,
                            visitStartedAt: visitStartedAt,
                            visitInProgressAt: visitInProgressAt,
                            visitResolvedAt: visitResolvedAt,
                            actualResolutionTime: parseTimeToMinutes(downtimeVal),
                            lastStatusChange: lastStatusChange,
                            relatedMachineIds: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
                        };

                        if (existingDbId) {
                            // Update existing ticket
                            await prisma.ticket.update({
                                where: { id: existingDbId },
                                data: {
                                    ...ticketData,
                                    ticketNumber: ticketIdNum || undefined,
                                    updatedAt: closedDate || lastStatusChange || new Date(),
                                }
                            });

                            // For updates, we don't recreate the entire history to avoid duplicates, 
                            // but we ensure the basic resolution record exists if it's closed
                            if (closedDate && (status === 'CLOSED' || status === 'RESOLVED')) {
                                const historyExists = await prisma.ticketStatusHistory.findFirst({
                                    where: { ticketId: existingDbId, status: status as any }
                                });
                                if (!historyExists) {
                                    await prisma.ticketStatusHistory.create({
                                        data: {
                                            ticketId: existingDbId,
                                            status: status as any,
                                            changedAt: closedDate,
                                            changedById: adminId,
                                            notes: 'Updated to Fixed/Closed via Import'
                                        }
                                    });
                                }
                            }
                            return { isNew: false };
                        } else {
                            // Check concurrency guard
                            if (ticketIdNum && ongoingTicketCreations.has(String(ticketIdNum))) {
                                await ongoingTicketCreations.get(String(ticketIdNum));
                                return { isNew: false }; // Treat as update or secondary handle
                            }

                            const creationPromise = (async () => {
                                // Create new ticket
                                let ticketNumber = ticketIdNum || String(nextTicketNumber++);
                                // Make sure ticketNumber doesn't collide
                                if (!ticketIdNum) {
                                    while (ticketByNumber.has(ticketNumber)) {
                                        ticketNumber = String(nextTicketNumber++);
                                    }
                                }

                                const created = await prisma.ticket.create({
                                    data: {
                                        ...ticketData,
                                        ticketNumber,
                                        createdAt: ticketDate,
                                        updatedAt: closedDate || lastStatusChange || new Date(), // Try to set it for analytics
                                    }
                                });

                                // ── Generate Status History for Analytics ──
                                // 1. Initial OPEN status
                                await prisma.ticketStatusHistory.create({
                                    data: {
                                        ticketId: created.id,
                                        status: 'OPEN',
                                        changedAt: ticketDate,
                                        changedById: adminId,
                                        notes: 'Imported from Excel'
                                    }
                                });

                                // 2. ASSIGNED status (if we have a scheduled date/engineer)
                                if (assignedToId && (scheduledDate || ticketDate)) {
                                    await prisma.ticketStatusHistory.create({
                                        data: {
                                            ticketId: created.id,
                                            status: 'ASSIGNED',
                                            changedAt: scheduledDate || ticketDate,
                                            changedById: adminId,
                                            notes: 'Imported Assignment'
                                        }
                                    });
                                }

                                // 3. FINAL status (if CLOSED or RESOLVED)
                                if (closedDate && (status === 'CLOSED' || status === 'RESOLVED')) {
                                    await prisma.ticketStatusHistory.create({
                                        data: {
                                            ticketId: created.id,
                                            status: status as any,
                                            changedAt: closedDate,
                                            changedById: adminId,
                                            notes: 'Imported as Fixed/Closed'
                                        }
                                    });
                                }

                                // Track for future upsert within same import
                                if (ticketIdNum) {
                                    ticketByNumber.set(String(ticketIdNum), created.id);
                                }
                                return created.id;
                            })();

                            if (ticketIdNum) ongoingTicketCreations.set(String(ticketIdNum), creationPromise);
                            await creationPromise;
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
