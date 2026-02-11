const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Load user mapping
const userMappingPath = path.join(__dirname, 'data', 'user-mapping.json');
const userMapping = JSON.parse(fs.readFileSync(userMappingPath, 'utf8'));

// Product type mapping from Excel to Prisma enum
const productMapping = {
    'contract': 'CONTRACT',
    'mc': 'CONTRACT',
    'contarct': 'CONTRACT',
    'ccontarct': 'CONTRACT',
    'spp': 'SPP',
    'relocation': 'RELOCATION',
    'upgradekit': 'UPGRADE_KIT',
    'upgrade': 'UPGRADE_KIT',
    'software': 'SOFTWARE',
    'bdcharges': 'BD_CHARGES',
    'bdcharges': 'BD_CHARGES', // Already covered but just in case
    'bdspare': 'BD_SPARE',
    'midlifeupgrade': 'MIDLIFE_UPGRADE',
    'mlu': 'MIDLIFE_UPGRADE',
    'retrofitkit': 'RETROFIT_KIT',
    'retrofit': 'RETROFIT_KIT'
};

function normalizeProductType(type) {
    if (!type) return null;
    // Lowercase and remove all spaces, underscores, and dashes
    const normalized = String(type).toLowerCase().replace(/[\s\-_]/g, '');
    return productMapping[normalized] || null;
}

const leadStatusMap = {
    'Yes': 'YES',
    'No': 'NO'
};

const monthMap = {
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

function excelDateToJS(excelDate) {
    if (!excelDate) return null;
    let date = null;

    if (typeof excelDate === 'string') {
        date = new Date(excelDate);
    } else if (typeof excelDate === 'number') {
        // Excel date serial number
        date = new Date((excelDate - 25569) * 86400 * 1000);
    }

    if (date && !isNaN(date.getTime())) {
        // Force ALL years to 2026 for this specific import
        date.setFullYear(2026);
        return date;
    }
    return null;
}

function monthToYYYYMM(monthName, year) {
    if (!monthName) return null;
    if (!year) year = 2026;
    const monthStr = String(monthName).trim().toLowerCase();
    const monthNum = monthMap[monthStr];
    if (monthNum) return `${year}-${monthNum}`;
    return null;
}

function probabilityToPercentage(prob) {
    if (prob === null || prob === undefined || typeof prob !== 'number') return null;
    if (prob <= 1) return Math.round(prob * 100);
    return Math.round(prob);
}

const personSheets = [
    { name: 'Yogesh', zone: 'WEST' },
    { name: 'Ashraf', zone: 'WEST' },
    { name: 'Rahul', zone: 'WEST' },
    { name: 'Minesh', zone: 'WEST' },
    { name: 'Gajendra', zone: 'SOUTH' },
    { name: 'Pradeep', zone: 'SOUTH' },
    { name: 'Sasi', zone: 'SOUTH' },
    { name: 'Vinay', zone: 'NORTH' },
    { name: 'Nitin', zone: 'NORTH' },
    { name: 'Pankaj', zone: 'EAST' }
];

const isDryRun = process.argv.includes('--dry-run');

// Cache to speed up lookup - MAJOR performance boost
const customerCache = new Map(); // key: companyName + zoneId
const contactCache = new Map();  // key: customerId + phone/name
const assetCache = new Map();    // key: serialNo

async function main() {
    console.log('========================================');
    console.log(isDryRun ? 'DRY RUN - Analyzing Offers from Excel' : 'Importing Offers from Excel');
    console.log('========================================\n');

    const workbookPath = path.join(__dirname, 'data', '2026_Zonewise_Open_Closed_Offer funnel.xlsx');
    if (!fs.existsSync(workbookPath)) {
        console.error(`Error: Excel file not found at ${workbookPath}`);
        return;
    }

    console.log('Loading workbook (this might take a few seconds)...');
    const workbook = XLSX.readFile(workbookPath);
    console.log('Workbook loaded successfully.\n');

    let totalReadFromExcel = 0;
    let totalUniqueOffers = 0;
    let totalImported = 0;
    let totalErrors = 0;
    const userStats = [];
    const globalOfferRefs = new Set();

    let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) adminUser = await prisma.user.findFirst();
    const adminId = adminUser?.id || 1;

    for (const { name: sheetName, zone } of personSheets) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            console.log(`Sheet "${sheetName}" not found. Skipping.`);
            continue;
        }

        // Detect and fix "Phantom Rows" before processing to prevent hangs
        const ref = sheet['!ref'];
        if (ref) {
            const range = XLSX.utils.decode_range(ref);
            if (range.e.r > 5000) { // If sheet appears to have >5k rows
                let maxRow = 0;
                // Find the actual highest row index present in the sheet object keys
                Object.keys(sheet).forEach(key => {
                    if (key[0] === '!' || !/^[A-Z]+\d+$/.test(key)) return;
                    const r = XLSX.utils.decode_cell(key).r;
                    if (r > maxRow) maxRow = r;
                });

                if (maxRow < range.e.r) {
                    console.log(`  ⚠ Trimming excessive range: ${range.e.r + 1} rows → ${maxRow + 1} rows`);
                    range.e.r = Math.min(maxRow, range.e.r);
                    sheet['!ref'] = XLSX.utils.encode_range(range);
                }
            }
        }

        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\nProcessing ${sheetName} (${zone})... Rows in sheet: ${data.length}`);

        // Robust header detection
        let headerRowIndex = -1;
        let headers = [];

        for (let i = 0; i < Math.min(50, data.length); i++) { // Increased range search
            const row = data[i];
            if (row && Array.isArray(row)) {
                // Case-insensitive check for markers
                const rowStr = JSON.stringify(row).toUpperCase();
                if (rowStr.includes('"SL"') && rowStr.includes('"COMPANY"')) {
                    headerRowIndex = i;
                    headers = row;
                    break;
                }
            }
        }

        if (headerRowIndex === -1) {
            console.log(`  ⚠ Headers not found in first 50 rows of ${sheetName}. Skipping.`);
            continue;
        }

        // ... rest of indices ...
        const getColIndex = (keywords) => {
            return headers.findIndex(h => {
                if (h === null || h === undefined) return false;
                const hStr = String(h).toLowerCase().trim();
                return keywords.some(k => hStr === k.toLowerCase() || hStr.includes(k.toLowerCase()));
            });
        };

        const regDateIndex = getColIndex(['Reg Date', 'Registration']);
        const companyIndex = getColIndex(['Company', 'Customer Name']);
        const locationIndex = getColIndex(['Location', 'Address']);
        const departmentIndex = getColIndex(['Department']);
        const contactNameIndex = getColIndex(['Contact Person']);
        const contactNumberIndex = getColIndex(['Contact Number', 'Phone']);
        const emailIndex = getColIndex(['E-Mail', 'Email']);
        const machineSerialIndex = getColIndex(['Machine Serial']);
        const productTypeIndex = getColIndex(['Product Type']);
        const leadIndex = getColIndex(['Lead']);
        const offerRefIndex = getColIndex(['Offer Reference Number', 'Offer Ref']);
        const offerDateIndex = getColIndex(['Offer Reference Date', 'Offer Date']);
        const offerValueIndex = getColIndex(['Offer Value']);
        const offerMonthIndex = getColIndex(['Offer Month']);
        const poExpectedMonthIndex = getColIndex(['PO Expected']);
        const probabilityIndex = getColIndex(['Probabality', 'Probability']);
        const poNumberIndex = getColIndex(['PO Number']);
        const poDateIndex = getColIndex(['PO Date']);
        const poValueIndex = getColIndex(['PO Value']);
        const poReceivedMonthIndex = getColIndex(['PO Received Month']);
        const openFunnelIndex = getColIndex(['Open Funnel']);
        const remarksIndex = getColIndex(['Remarks']);

        const offerDataMap = new Map();
        let sheetReadCount = 0;
        let emptyRowsCount = 0;
        const MAX_EMPTY_ROWS = 100; // Stop after 100 empty rows

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];

            // Efficiency: check if row is effectively empty
            const isRowEmpty = !row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');

            if (isRowEmpty) {
                emptyRowsCount++;
                if (emptyRowsCount >= MAX_EMPTY_ROWS) {
                    console.log(`  Reached ${MAX_EMPTY_ROWS} consecutive empty rows. Stopping sheet read.`);
                    break;
                }
                continue;
            }

            // Reset empty count if we find data
            emptyRowsCount = 0;

            const slValue = row[0];
            const companyName = companyIndex >= 0 ? String(row[companyIndex] || '').trim() : '';
            const offerRef = offerRefIndex >= 0 ? String(row[offerRefIndex] || '').trim() : '';
            const offerValueVal = offerValueIndex >= 0 ? row[offerValueIndex] : null;

            // Skip if no offer reference - as per user requirement
            if (!offerRef) {
                continue;
            }

            totalReadFromExcel++;
            sheetReadCount++;

            const finalOfferRef = offerRef;

            const poValueVal = poValueIndex >= 0 ? row[poValueIndex] : null;
            const machineSerial = machineSerialIndex >= 0 ? row[machineSerialIndex] : null;

            if (!offerDataMap.has(finalOfferRef)) {
                offerDataMap.set(finalOfferRef, {
                    firstRow: row,
                    slValue: slValue,
                    offerValue: (typeof offerValueVal === 'number') ? offerValueVal : 0,
                    poValue: (typeof poValueVal === 'number') ? poValueVal : 0,
                    machineSerials: new Set()
                });
            } else {
                const existing = offerDataMap.get(finalOfferRef);
                if (typeof offerValueVal === 'number') existing.offerValue += offerValueVal;
                if (typeof poValueVal === 'number') existing.poValue += poValueVal;
            }

            if (machineSerial) {
                offerDataMap.get(finalOfferRef).machineSerials.add(String(machineSerial).trim());
            }
        }

        console.log(`  Found ${offerDataMap.size} unique offers from ${sheetReadCount} rows`);

        if (isDryRun) {
            let sheetUniqueCount = 0;
            for (const ref of offerDataMap.keys()) {
                if (!globalOfferRefs.has(ref)) {
                    globalOfferRefs.add(ref);
                    sheetUniqueCount++;
                    totalUniqueOffers++;
                    totalImported++;
                }
            }
            userStats.push({ name: sheetName, zone, read: sheetReadCount, imported: sheetUniqueCount, unique: offerDataMap.size });
            continue;
        }

        const userData = userMapping[sheetName];
        if (!userData) {
            console.error(`  ✗ User mapping not found for ${sheetName}. Skipping sheet.`);
            totalErrors++;
            continue;
        }

        let sheetImportedCount = 0;
        let offersProcessedInSheet = 0;

        for (const [offerRefStr, offerData] of offerDataMap) {
            offersProcessedInSheet++;
            if (offersProcessedInSheet % 50 === 0) {
                console.log(`    ... processing item ${offersProcessedInSheet} / ${offerDataMap.size}`);
            }

            const row = offerData.firstRow;
            const machineSerials = Array.from(offerData.machineSerials);

            const isNewUniqueOffer = !globalOfferRefs.has(offerRefStr);
            if (isNewUniqueOffer) {
                globalOfferRefs.add(offerRefStr);
                totalUniqueOffers++;
            }

            try {
                const companyName = companyIndex >= 0 ? String(row[companyIndex] || 'Unknown Company').trim() : 'Unknown Company';
                const locationVal = locationIndex >= 0 ? String(row[locationIndex] || '').trim() : null;
                const department = departmentIndex >= 0 ? String(row[departmentIndex] || '').trim() : null;
                const contactName = contactNameIndex >= 0 ? String(row[contactNameIndex] || 'Unknown Contact').trim() : 'Unknown Contact';
                const contactNumber = contactNumberIndex >= 0 ? String(row[contactNumberIndex] || '0000000000').trim() : '0000000000';
                const emailVal = emailIndex >= 0 ? String(row[emailIndex] || '').trim() : null;

                // 1. Customer Cache/Fetch
                const customerKey = `${companyName}|${userData.zoneId}`;
                let customerId = customerCache.get(customerKey);

                if (!customerId) {
                    let customer = await prisma.customer.findFirst({
                        where: { companyName, serviceZoneId: userData.zoneId }
                    });
                    if (!customer) {
                        customer = await prisma.customer.create({
                            data: {
                                companyName,
                                address: locationVal,
                                serviceZoneId: userData.zoneId,
                                createdById: adminId,
                                updatedById: adminId
                            }
                        });
                    }
                    customerId = customer.id;
                    customerCache.set(customerKey, customerId);
                }

                // 2. Contact Cache/Fetch
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
                const productTypeRaw = productTypeIndex >= 0 ? String(row[productTypeIndex] || '').trim() : null;
                const productTypeVal = normalizeProductType(productTypeRaw);

                if (productTypeRaw && !productTypeVal) {
                    console.warn(`    ⚠ Unmapped Product Type found: "${productTypeRaw}" (Offer: ${offerRefStr})`);
                }

                const leadVal = leadIndex >= 0 ? String(row[leadIndex] || '').trim() : null;
                const offerDateVal = offerDateIndex >= 0 ? row[offerDateIndex] : null;
                const offerMonthVal = offerMonthIndex >= 0 ? row[offerMonthIndex] : null;
                const poExpectedVal = poExpectedMonthIndex >= 0 ? row[poExpectedMonthIndex] : null;
                const probabilityVal = probabilityIndex >= 0 ? row[probabilityIndex] : null;
                const poNumberVal = poNumberIndex >= 0 ? row[poNumberIndex] : null;
                const poDateVal = poDateIndex >= 0 ? row[poDateIndex] : null;
                const poReceivedMonthVal = poReceivedMonthIndex >= 0 ? row[poReceivedMonthIndex] : null;
                const openFunnelVal = openFunnelIndex >= 0 ? row[openFunnelIndex] : null;
                const remarksVal = remarksIndex >= 0 ? row[remarksIndex] : null;
                const regDate = regDateIndex >= 0 ? row[regDateIndex] : null;

                let registrationDateJS = excelDateToJS(regDate);
                if (!registrationDateJS) registrationDateJS = new Date(2026, 0, 1);

                let stage = 'INITIAL';
                if (poNumberVal && offerData.poValue > 0) {
                    stage = 'WON';
                } else if (probabilityVal && typeof probabilityVal === 'number' && probabilityVal > 0) {
                    stage = 'PROPOSAL_SENT';
                }

                const offerDataForDb = {
                    offerReferenceNumber: offerRefStr,
                    offerReferenceDate: excelDateToJS(offerDateVal),
                    title: `Offer for ${companyName}`,
                    productType: productTypeVal,
                    lead: leadStatusMap[leadVal] || null,
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
                    zoneId: userData.zoneId,
                    assignedToId: userData.userId,
                    createdById: userData.userId,
                    updatedById: userData.userId,
                    offerValue: offerData.offerValue > 0 ? offerData.offerValue : null,
                    offerMonth: monthToYYYYMM(offerMonthVal, 2026) ||
                        `${2026}-${String(registrationDateJS.getMonth() + 1).padStart(2, '0')}`,
                    poExpectedMonth: monthToYYYYMM(poExpectedVal, 2026),
                    probabilityPercentage: probabilityToPercentage(probabilityVal),
                    poNumber: poNumberVal ? String(poNumberVal) : null,
                    poDate: excelDateToJS(poDateVal),
                    poValue: offerData.poValue > 0 ? offerData.poValue : null,
                    poReceivedMonth: monthToYYYYMM(poReceivedMonthVal, 2026),
                    openFunnel: openFunnelVal !== null ? (openFunnelVal > 0 || openFunnelVal === true) : true,
                    remarks: remarksVal ? String(remarksVal) : null,
                    updatedAt: new Date()
                };

                const offer = await prisma.offer.upsert({
                    where: { offerReferenceNumber: offerRefStr },
                    update: offerDataForDb,
                    create: {
                        ...offerDataForDb,
                        createdAt: registrationDateJS || new Date()
                    }
                });

                // 4. Handle Assets/OfferAssets
                for (const serial of machineSerials) {
                    let assetId = assetCache.get(serial);
                    if (!assetId) {
                        // Check for existing asset by EITHER machineId OR serialNo
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

                if (isNewUniqueOffer) {
                    sheetImportedCount++;
                    totalImported++;
                }

            } catch (error) {
                console.error(`    ✗ Error importing offer ${offerRefStr}:`, error.message);
                totalErrors++;
            }
        }

        userStats.push({ name: sheetName, zone, read: sheetReadCount, imported: sheetImportedCount, unique: offerDataMap.size });
        console.log(`  ✓ Sheet complete: ${sheetReadCount} rows read, ${sheetImportedCount} new offers imported.`);
    }

    console.log('\n========================================');
    console.log(isDryRun ? 'DRY RUN SUMMARY' : 'IMPORT SUMMARY');
    console.log('========================================');
    console.log('USER-WISE BREAKDOWN:');
    console.log('┌──────────┬────────┬────────┬──────────┬──────────┐');
    console.log('│   User   │  Zone  │  Rows  │  Unique  │ Imported │');
    console.log('├──────────┼────────┼────────┼──────────┼──────────┤');
    for (const stat of userStats) {
        console.log(`│ ${stat.name.padEnd(8)} │ ${stat.zone.padEnd(6)} │ ${String(stat.read).padStart(6)} │ ${String(stat.unique).padStart(8)} │ ${String(stat.imported).padStart(8)} │`);
    }
    console.log('└──────────┴────────┴────────┴──────────┴──────────┘');
    console.log('\nTOTALS:');
    console.log(`  Total Rows Read:        ${totalReadFromExcel}`);
    console.log(`  Total Unique Offer IDs: ${totalUniqueOffers}`);
    console.log(`  ${isDryRun ? 'Would Import' : 'Imported'}:              ${totalImported}`);
    console.log(`  Errors:                 ${totalErrors}`);
    console.log('========================================\n');
}

main()
    .catch((e) => {
        console.error('Fatal Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
