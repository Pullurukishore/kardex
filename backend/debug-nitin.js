const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const workbookPath = path.join(__dirname, 'data', '2026_Zonewise_Open_Closed_Offer funnel.xlsx');

async function main() {
    const workbook = XLSX.readFile(workbookPath);
    const sheetName = 'Nitin';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
        console.log(`Sheet ${sheetName} not found.`);
        return;
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headers = [];
    let headerRowIndex = -1;

    for (let i = 0; i < 50; i++) {
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

    if (headerRowIndex === -1) {
        console.log('Headers not found.');
        return;
    }

    const companyIndex = headers.findIndex(h => String(h || '').toLowerCase().includes('company'));
    const offerRefIndex = headers.findIndex(h => {
        const hStr = String(h || '').toLowerCase();
        return hStr.includes('offer reference number') || hStr.includes('offer ref');
    });

    console.log(`Inspecting missing Offer References in ${sheetName} sheet...`);
    console.log(`Company Column: ${companyIndex}, Offer Ref Column: ${offerRefIndex}`);

    let count = 0;
    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const company = String(row[companyIndex] || '').trim();
        const offerRef = String(row[offerRefIndex] || '').trim();
        const sl = row[0];

        if (company && !offerRef) {
            count++;
            console.log(`Row ${i} (SL: ${sl}): Customer "${company}" has NO Offer Reference. Script will name it: AUTO-NITIN-${sl || i}`);
            if (count > 20) {
                console.log('... more rows found ...');
                break;
            }
        }
    }
}

main().catch(console.error);
