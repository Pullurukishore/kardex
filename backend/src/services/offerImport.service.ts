import XLSX from 'xlsx';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';

// Product type mapping from Excel to Prisma enum
const productMapping: Record<string, string> = {
    'contract': 'CONTRACT',
    'mc': 'CONTRACT',
    'contarct': 'CONTRACT',
    'ccontarct': 'CONTRACT',
    'spp': 'SPARE_PARTS',
    'spareparts': 'SPARE_PARTS',
    'kardexconnect': 'KARDEX_CONNECT',
    'relocation': 'RELOCATION',
    'upgradekit': 'UPGRADE_KIT',
    'upgrade': 'UPGRADE_KIT',
    'software': 'SOFTWARE',
    'others': 'OTHERS',
    'bdcharges': 'OTHERS',
    'bdspare': 'BD_SPARE',
    'retrofitkit': 'RETROFIT_KIT',
    'retrofit': 'RETROFIT_KIT',
    'midlifeupgrade': 'UPGRADE_KIT',
    'midlife': 'UPGRADE_KIT'
};

const leadStatusMap: Record<string, string> = {
    'Yes': 'YES',
    'yes': 'YES',
    'No': 'NO',
    'no': 'NO'
};

const monthMap: Record<string, string> = {
    'january': '01', 'januray': '01', 'jan': '01',
    'february': '02', 'febraury': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sept': '09', 'sep': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12'
};

// Valid Prisma enum values
const VALID_PRODUCT_TYPES = new Set([
    'RELOCATION', 'CONTRACT', 'SPARE_PARTS', 'KARDEX_CONNECT',
    'UPGRADE_KIT', 'SOFTWARE', 'OTHERS', 'BD_SPARE', 'RETROFIT_KIT'
]);

const VALID_OFFER_STAGES = new Set([
    'INITIAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'PO_RECEIVED', 'WON', 'LOST'
]);

const VALID_LEAD_STATUSES = new Set(['YES', 'NO']);

function normalizeProductType(type: any): string | null {
    if (!type) return null;
    const normalized = String(type).toLowerCase().replace(/[\s\-_]/g, '');
    const mapped = productMapping[normalized] || null;
    if (mapped && VALID_PRODUCT_TYPES.has(mapped)) return mapped;
    return null;
}

function excelDateToJS(excelDate: any): Date | null {
    if (!excelDate) return null;
    let date: Date | null = null;

    if (typeof excelDate === 'string') {
        date = new Date(excelDate);
    } else if (typeof excelDate === 'number') {
        date = new Date((excelDate - 25569) * 86400 * 1000);
    }

    if (date && !isNaN(date.getTime())) {
        // Reject dates with unreasonable years (e.g. 12025, 20205) —
        // Excel sometimes produces these from corrupted cells, and Prisma
        // cannot serialize years with more than 4 digits.
        const year = date.getFullYear();
        if (year < 1900 || year > 2100) {
            return null;
        }
        return date;
    }
    return null;
}

function monthToYYYYMM(monthName: any, year = new Date().getFullYear()): string | null {
    if (!monthName) return null;
    const monthStr = String(monthName).trim().toLowerCase();
    const monthNum = monthMap[monthStr];
    if (monthNum) return `${year}-${monthNum}`;
    return null;
}

function probabilityToPercentage(prob: any): number | null {
    if (prob === null || prob === undefined || typeof prob !== 'number') return null;
    if (prob <= 1) return Math.round(prob * 100);
    return Math.round(prob);
}

/**
 * Fix "Phantom Rows" in XLSX sheets by trimming excessive empty rows.
 * Some Excel files report thousands of rows when only a few hundred have data.
 * This prevents hangs and crashes during parsing.
 */
function trimPhantomRows(sheet: any) {
    const ref = sheet['!ref'];
    if (!ref) return;

    const range = XLSX.utils.decode_range(ref);
    if (range.e.r > 5000) {
        // In dense mode, sheets are arrays-of-arrays — no cell keys to iterate.
        // Dense mode doesn't create phantom rows, so skip trimming.
        const keys = Object.keys(sheet).filter(k => k[0] !== '!' && /^[A-Z]+\d+$/.test(k));
        if (keys.length === 0) return; // dense sheet — nothing to trim

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
 * Find header row and build column index map.
 * Returns null if no valid header found.
 */
function findHeaderAndIndices(data: any[][]) {
    let headerRowIndex = -1;
    let headers: any[] = [];

    for (let i = 0; i < Math.min(50, data.length); i++) {
        const row = data[i];
        if (row && Array.isArray(row)) {
            const rowStr = JSON.stringify(row).toUpperCase();
            if (rowStr.includes('"SL"') && rowStr.includes('"COMPANY"')) {
                headerRowIndex = i;
                headers = row;
                break;
            }
        }
    }

    if (headerRowIndex === -1) return null;

    const getColIndex = (keywords: string[]) => {
        return headers.findIndex(h => {
            if (h === null || h === undefined) return false;
            const hStr = String(h).toLowerCase().trim();
            return keywords.some(k => hStr === k.toLowerCase() || hStr.includes(k.toLowerCase()));
        });
    };

    return {
        headerRowIndex,
        headers,
        indices: {
            regDate: getColIndex(['Reg Date', 'Registration']),
            company: getColIndex(['Company', 'Customer Name']),
            location: getColIndex(['Location', 'Address']),
            department: getColIndex(['Department']),
            contactName: getColIndex(['Contact Person']),
            contactNumber: getColIndex(['Contact Number', 'Phone']),
            email: getColIndex(['E-Mail', 'Email']),
            machineSerial: getColIndex(['Machine Serial']),
            productType: getColIndex(['Product Type']),
            lead: getColIndex(['Lead']),
            offerRef: getColIndex(['Offer Reference Number', 'Offer Ref']),
            offerDate: getColIndex(['Offer Reference Date', 'Offer Date']),
            offerValue: getColIndex(['Offer Value']),
            offerMonth: getColIndex(['Offer Month']),
            poExpectedMonth: getColIndex(['PO Expected']),
            probability: getColIndex(['Probabality', 'Probability']),
            poNumber: getColIndex(['PO Number']),
            poDate: getColIndex(['PO Date']),
            poValue: getColIndex(['PO Value']),
            poReceivedMonth: getColIndex(['PO Received Month']),
            openFunnel: getColIndex(['Open Funnel']),
            remarks: getColIndex(['Remarks'])
        }
    };
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
 * Collect offer data from rows into a Map, combining multi-line offers
 * with the same offer reference number (summing values, collecting serials).
 */
function collectOfferData(data: any[][], headerRowIndex: number, indices: any) {
    const offerDataMap = new Map();
    let rowCount = 0;
    let emptyRowsCount = 0;
    const MAX_EMPTY_ROWS = 100;

    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];

        if (isRowEmpty(row)) {
            emptyRowsCount++;
            if (emptyRowsCount >= MAX_EMPTY_ROWS) break;
            continue;
        }
        emptyRowsCount = 0;

        const offerRef = indices.offerRef >= 0 ? String(row[indices.offerRef] || '').trim() : '';
        if (!offerRef) continue;

        rowCount++;

        const offerValueVal = indices.offerValue >= 0 ? row[indices.offerValue] : null;
        const poValueVal = indices.poValue >= 0 ? row[indices.poValue] : null;
        const machineSerial = indices.machineSerial >= 0 ? row[indices.machineSerial] : null;

        if (!offerDataMap.has(offerRef)) {
            offerDataMap.set(offerRef, {
                firstRow: row,
                offerValue: (typeof offerValueVal === 'number') ? offerValueVal : 0,
                poValue: (typeof poValueVal === 'number') ? poValueVal : 0,
                machineSerials: new Set()
            });
        } else {
            const existing = offerDataMap.get(offerRef);
            if (typeof offerValueVal === 'number') existing.offerValue += offerValueVal;
            if (typeof poValueVal === 'number') existing.poValue += poValueVal;
        }

        if (machineSerial) {
            offerDataMap.get(offerRef).machineSerials.add(String(machineSerial).trim());
        }
    }

    return { offerDataMap, rowCount };
}

export class OfferImportService {

    /**
     * Import offers from Excel buffer into database.
     * Matches logic from the proven import-offers.js script.
     */
    static async importFromExcel(buffer: Buffer, adminId: number) {
        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.read(buffer, { type: 'buffer', dense: true });
        } catch (err: any) {
            logger.error('Failed to parse Excel file:', err.message);
            throw new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }

        // Fetch all users, zones, existing customers, and contacts in parallel
        const [users, zones, allCustomers, allContacts, allAssets] = await Promise.all([
            prisma.user.findMany({ select: { id: true, name: true, email: true, zoneId: true } }),
            prisma.serviceZone.findMany({ select: { id: true, name: true } }),
            prisma.customer.findMany({ select: { id: true, companyName: true, serviceZoneId: true } }),
            prisma.contact.findMany({ select: { id: true, customerId: true, phone: true } }),
            prisma.asset.findMany({ select: { id: true, machineId: true, serialNo: true } })
        ]);

        // Build user lookup by name (case-insensitive)
        // Support both exact match and first-name match
        const userByName = new Map<string, typeof users[0]>();
        users.forEach(u => {
            if (u.name) {
                userByName.set(u.name.toLowerCase().trim(), u);
                // Also index by first name for partial matching
                const firstName = u.name.trim().split(/\s+/)[0].toLowerCase();
                if (firstName && !userByName.has(firstName)) {
                    userByName.set(firstName, u);
                }
            }
        });

        // Build zone lookup by name (case-insensitive)
        const zoneByName = new Map<string, number>();
        zones.forEach(z => {
            zoneByName.set(z.name.toUpperCase(), z.id);
        });

        const results = {
            totalRead: 0,
            imported: 0,
            updated: 0,
            errors: 0,
            details: [] as any[]
        };

        const globalOfferRefs = new Set();

        // Pre-populate caches from bulk-loaded data to avoid per-offer DB lookups
        const customerCache = new Map<string, number>();
        allCustomers.forEach(c => {
            customerCache.set(`${c.companyName}|${c.serviceZoneId}`, c.id);
        });

        const contactCache = new Map<string, number>();
        allContacts.forEach(c => {
            contactCache.set(`${c.customerId}|${c.phone}`, c.id);
        });

        const assetCache = new Map<string, number>();
        allAssets.forEach(a => {
            if (a.machineId) assetCache.set(a.machineId, a.id);
            if (a.serialNo) assetCache.set(a.serialNo, a.id);
        });

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            // Fix phantom rows before parsing
            trimPhantomRows(sheet);

            const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (data.length < 2) continue;

            const headerResult = findHeaderAndIndices(data);
            if (!headerResult) continue;

            const { headerRowIndex, indices } = headerResult;

            // Match sheet name to a user
            const targetUser = userByName.get(sheetName.toLowerCase());
            if (!targetUser) {
                continue;
            }

            // Determine zone: use user's own zone, or first zone as fallback
            const userZoneId = targetUser.zoneId ? Number(targetUser.zoneId) : null;
            const zoneId = userZoneId || (zones.length > 0 ? zones[0].id : 1);

            // Collect all offer data from the sheet
            const { offerDataMap, rowCount } = collectOfferData(data, headerRowIndex, indices);
            results.totalRead += rowCount;

            let sheetImportedCount = 0;
            let sheetUpdatedCount = 0;
            let sheetErrorCount = 0;

            // Process offers in parallel batches for speed
            const PARALLEL_BATCH = 10;
            const offerEntries = Array.from(offerDataMap.entries());

            for (let bi = 0; bi < offerEntries.length; bi += PARALLEL_BATCH) {
                const batch = offerEntries.slice(bi, bi + PARALLEL_BATCH);
                const batchResults = await Promise.allSettled(
                    batch.map(async ([offerRefStr, offerData]) => {
                        const row = offerData.firstRow;
                        const machineSerials = Array.from(offerData.machineSerials) as string[];

                        const companyName = indices.company >= 0
                            ? String(row[indices.company] || 'Unknown Company').trim()
                            : 'Unknown Company';
                        const locationVal = indices.location >= 0
                            ? String(row[indices.location] || '').trim() || null
                            : null;
                        const department = indices.department >= 0
                            ? String(row[indices.department] || '').trim() || null
                            : null;
                        const contactName = indices.contactName >= 0
                            ? String(row[indices.contactName] || 'Unknown Contact').trim()
                            : 'Unknown Contact';
                        const contactNumber = indices.contactNumber >= 0
                            ? String(row[indices.contactNumber] || '0000000000').trim()
                            : '0000000000';
                        const emailVal = indices.email >= 0
                            ? String(row[indices.email] || '').trim() || null
                            : null;

                        // 1. Customer - find or create
                        const customerKey = `${companyName}|${zoneId}`;
                        let customerId = customerCache.get(customerKey);
                        if (!customerId) {
                            let customer = await prisma.customer.findFirst({
                                where: { companyName, serviceZoneId: zoneId }
                            });
                            if (!customer) {
                                customer = await prisma.customer.create({
                                    data: {
                                        companyName,
                                        address: locationVal,
                                        serviceZoneId: zoneId,
                                        createdById: adminId,
                                        updatedById: adminId
                                    }
                                });
                            }
                            customerId = customer.id;
                            customerCache.set(customerKey, customerId);
                        }

                        // 2. Contact - find or create
                        const contactKey = `${customerId}|${contactNumber}`;
                        let contactId = contactCache.get(contactKey);
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
                                        email: emailVal,
                                        customerId
                                    }
                                });
                            }
                            contactId = contact.id;
                            contactCache.set(contactKey, contactId);
                        }

                        // 3. Prepare Offer Data
                        const productTypeRaw = indices.productType >= 0
                            ? String(row[indices.productType] || '').trim()
                            : null;
                        const productTypeVal = normalizeProductType(productTypeRaw);

                        const leadVal = indices.lead >= 0 ? String(row[indices.lead] || '').trim() : null;

                        const offerDateVal = indices.offerDate >= 0 ? row[indices.offerDate] : null;
                        const offerMonthVal = indices.offerMonth >= 0 ? row[indices.offerMonth] : null;
                        const poExpectedVal = indices.poExpectedMonth >= 0 ? row[indices.poExpectedMonth] : null;
                        const probabilityVal = indices.probability >= 0 ? row[indices.probability] : null;
                        const poNumberVal = indices.poNumber >= 0 ? row[indices.poNumber] : null;
                        const poDateVal = indices.poDate >= 0 ? row[indices.poDate] : null;
                        const poReceivedMonthVal = indices.poReceivedMonth >= 0 ? row[indices.poReceivedMonth] : null;
                        const openFunnelVal = indices.openFunnel >= 0 ? row[indices.openFunnel] : null;
                        const remarksVal = indices.remarks >= 0 ? row[indices.remarks] : null;
                        const regDate = indices.regDate >= 0 ? row[indices.regDate] : null;

                        let registrationDateJS = excelDateToJS(regDate);
                        if (!registrationDateJS) registrationDateJS = new Date();

                        // Determine stage
                        let stage = 'INITIAL';
                        if (poNumberVal && offerData.poValue > 0) {
                            stage = 'WON';
                        } else if (probabilityVal && typeof probabilityVal === 'number' && probabilityVal > 0) {
                            stage = 'PROPOSAL_SENT';
                        }

                        const openFunnelParsed = openFunnelVal !== null && openFunnelVal !== undefined
                            ? (openFunnelVal > 0 || openFunnelVal === true)
                            : true;

                        const currentYear = new Date().getFullYear();

                        const offerDataForDb: any = {
                            offerReferenceNumber: offerRefStr,
                            offerReferenceDate: excelDateToJS(offerDateVal),
                            title: `Offer for ${companyName}`,
                            productType: productTypeVal,
                            lead: leadStatusMap[leadVal || ''] || null,
                            registrationDate: registrationDateJS,
                            company: companyName,
                            location: locationVal,
                            department: department,
                            contactPersonName: contactName,
                            contactNumber: contactNumber,
                            email: emailVal,
                            machineSerialNumber: machineSerials[0] || null,
                            status: 'OPEN',
                            stage: stage,
                            customerId,
                            contactId,
                            zoneId,
                            assignedToId: targetUser.id,
                            createdById: targetUser.id,
                            updatedById: targetUser.id,
                            offerValue: offerData.offerValue > 0 ? offerData.offerValue : null,
                            offerMonth: monthToYYYYMM(offerMonthVal, currentYear) ||
                                `${currentYear}-${String(registrationDateJS.getMonth() + 1).padStart(2, '0')}`,
                            poExpectedMonth: monthToYYYYMM(poExpectedVal, currentYear),
                            probabilityPercentage: probabilityToPercentage(probabilityVal),
                            poNumber: poNumberVal ? String(poNumberVal) : null,
                            poDate: excelDateToJS(poDateVal),
                            poValue: offerData.poValue > 0 ? offerData.poValue : null,
                            poReceivedMonth: monthToYYYYMM(poReceivedMonthVal, currentYear),
                            openFunnel: openFunnelParsed,
                            remarks: remarksVal ? String(remarksVal) : null,
                            updatedAt: new Date()
                        };

                        // Use upsert
                        const offer = await prisma.offer.upsert({
                            where: { offerReferenceNumber: offerRefStr },
                            update: offerDataForDb,
                            create: {
                                ...offerDataForDb,
                                createdAt: registrationDateJS || new Date()
                            }
                        });

                        // Track new vs updated
                        const isNewUniqueOffer = !globalOfferRefs.has(offerRefStr);
                        if (isNewUniqueOffer) {
                            globalOfferRefs.add(offerRefStr);
                        }

                        // 4. Handle Assets
                        for (const serial of machineSerials) {
                            let assetId = assetCache.get(serial);
                            if (!assetId) {
                                let asset = await prisma.asset.findFirst({
                                    where: {
                                        OR: [
                                            { machineId: serial },
                                            { serialNo: serial }
                                        ]
                                    }
                                });

                                if (!asset) {
                                    asset = await prisma.asset.create({
                                        data: {
                                            machineId: serial,
                                            serialNo: serial,
                                            customerId
                                        }
                                    });
                                }
                                assetId = asset.id;
                                assetCache.set(serial, assetId);
                            }

                            await prisma.offerAsset.upsert({
                                where: { offerId_assetId: { offerId: offer.id, assetId } },
                                update: {},
                                create: { offerId: offer.id, assetId }
                            });
                        }

                        return { offerRefStr, isNew: isNewUniqueOffer };
                    })
                );

                // Tally batch results
                for (const res of batchResults) {
                    if (res.status === 'fulfilled' && res.value.isNew) {
                        sheetImportedCount++;
                        results.imported++;
                    } else if (res.status === 'rejected') {
                        logger.error(`Error importing offer:`, res.reason?.message || res.reason);
                        results.errors++;
                        sheetErrorCount++;
                    }
                }
            }

            results.details.push({
                sheetName,
                user: targetUser.name,
                read: rowCount,
                imported: sheetImportedCount,
                updated: sheetUpdatedCount,
                errors: sheetErrorCount
            });
        }

        return results;
    }

    /**
     * Preview what an Excel import would do without actually importing.
     * Returns sheet info, offer counts, and which ones would be new vs update.
     */
    static async previewFromExcel(buffer: Buffer) {
        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.read(buffer, { type: 'buffer', dense: true });
        } catch (err: any) {
            logger.error('Failed to parse Excel file for preview:', err.message);
            throw new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }

        const users = await prisma.user.findMany({ select: { id: true, name: true } });
        // Build a Set of all matchable user names (full name + first name)
        const userNames = new Set<string>();
        const userNameMap = new Map<string, string>(); // sheetName -> matched user display name
        users.forEach(u => {
            if (u.name) {
                const fullName = u.name.toLowerCase().trim();
                userNames.add(fullName);
                const firstName = fullName.split(/\s+/)[0];
                if (firstName) userNames.add(firstName);
            }
        });

        const previewResults = {
            totalRows: 0,
            sheets: [] as any[]
        };

        const allRefs = new Set<string>();
        const sheetsData: any[] = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            // Check user match FIRST — skip non-matching sheets entirely
            // This matches import-offers.js which only processes known personSheets
            const sheetNameLower = sheetName.toLowerCase().trim();
            const isMatchedUser = userNames.has(sheetNameLower);
            let matchedUserName: string | null = null;

            if (isMatchedUser) {
                const matchedUser = users.find(u =>
                    u.name?.toLowerCase().trim() === sheetNameLower ||
                    u.name?.toLowerCase().trim().split(/\s+/)[0] === sheetNameLower
                );
                matchedUserName = matchedUser?.name || null;
            }

            // Skip non-matching sheets — don't waste time parsing _copy sheets etc.
            if (!isMatchedUser) continue;

            // Fix phantom rows only for matched sheets
            trimPhantomRows(sheet);

            let data: any[][];
            try {
                data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            } catch (err: any) {
                logger.warn(`Failed to parse sheet "${sheetName}":`, err.message);
                continue;
            }

            if (data.length < 2) continue;

            const headerResult = findHeaderAndIndices(data);
            if (!headerResult) continue;

            const { headerRowIndex, indices } = headerResult;

            const sheetOffers = new Map();
            let sheetRowCount = 0;
            let emptyRowsCount = 0;
            const MAX_EMPTY_ROWS = 100;

            for (let i = headerRowIndex + 1; i < data.length; i++) {
                const row = data[i];

                if (isRowEmpty(row)) {
                    emptyRowsCount++;
                    if (emptyRowsCount >= MAX_EMPTY_ROWS) break;
                    continue;
                }
                emptyRowsCount = 0;

                const offerRef = indices.offerRef >= 0 ? String(row[indices.offerRef] || '').trim() : '';
                if (!offerRef) continue;

                sheetRowCount++;
                previewResults.totalRows++;
                allRefs.add(offerRef);

                const company = indices.company >= 0 ? String(row[indices.company] || '').trim() : 'Unknown';
                const value = indices.offerValue >= 0 && typeof row[indices.offerValue] === 'number'
                    ? row[indices.offerValue] : 0;
                const type = indices.productType >= 0
                    ? String(row[indices.productType] || '').trim() : '';

                if (!sheetOffers.has(offerRef)) {
                    sheetOffers.set(offerRef, { offerRef, company, value, type });
                } else {
                    const existing = sheetOffers.get(offerRef);
                    if (typeof value === 'number') existing.value += value;
                }
            }

            if (sheetRowCount > 0) {
                sheetsData.push({
                    sheetName,
                    sheetRowCount,
                    sheetOffers,
                    isMatchedUser,
                    matchedUserName
                });
            }
        }

        // Only query for existing offers if we have refs to check
        let existingRefs = new Set<string>();
        if (allRefs.size > 0) {
            try {
                const refsArray = Array.from(allRefs);
                // Use parallel batches for speed
                const BATCH_SIZE = 500;
                const batches: string[][] = [];
                for (let i = 0; i < refsArray.length; i += BATCH_SIZE) {
                    batches.push(refsArray.slice(i, i + BATCH_SIZE));
                }
                const batchResults = await Promise.all(
                    batches.map(batch =>
                        prisma.offer.findMany({
                            where: { offerReferenceNumber: { in: batch } },
                            select: { offerReferenceNumber: true }
                        })
                    )
                );
                batchResults.forEach(results =>
                    results.forEach(o => existingRefs.add(o.offerReferenceNumber))
                );
            } catch (err: any) {
                logger.error('Failed to check existing offers:', err.message);
            }
        }

        let totalNewOffers = 0;
        let totalUpdateOffers = 0;

        for (const s of sheetsData) {
            const offersList = Array.from(s.sheetOffers.values()).map((o: any) => ({
                ...o,
                value: typeof o.value === 'number' ? o.value : 0,
                isUpdate: existingRefs.has(o.offerRef)
            }));

            const newCount = offersList.filter((o: any) => !o.isUpdate).length;
            const updateCount = offersList.filter((o: any) => o.isUpdate).length;
            totalNewOffers += newCount;
            totalUpdateOffers += updateCount;

            previewResults.sheets.push({
                sheetName: s.sheetName,
                rowCount: s.sheetRowCount,
                offers: offersList.slice(0, 10),
                totalInSheet: offersList.length,
                newCount,
                updateCount,
                isMatchedUser: s.isMatchedUser,
                matchedUserName: s.matchedUserName || null
            });
        }

        return { ...previewResults, totalNewOffers, totalUpdateOffers };
    }
}
