const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

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

const workbookPath = path.join(__dirname, 'data', '2026_Zonewise_Open_Closed_Offer funnel.xlsx');

async function main() {
    if (!fs.existsSync(workbookPath)) {
        console.error(`Error: Excel file not found at ${workbookPath}`);
        return;
    }

    const workbook = XLSX.readFile(workbookPath);
    console.log(`Workbook loaded. Sheet names: ${workbook.SheetNames.join(', ')}`);
    const globalUniqueTypes = new Set();

    for (const { name: sheetName } of personSheets) {
        console.log(`\n--- Checking sheet: ${sheetName} ---`);
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            console.log(`Sheet ${sheetName} not found.`);
            continue;
        }

        // Phantom row trimming logic from import-offers.js
        const ref = sheet['!ref'];
        if (ref) {
            const range = XLSX.utils.decode_range(ref);
            if (range.e.r > 5000) { // Check for excessive rows
                let maxRow = 0;
                Object.keys(sheet).forEach(key => {
                    if (key[0] === '!' || !/^[A-Z]+\d+$/.test(key)) return;
                    const r = XLSX.utils.decode_cell(key).r;
                    if (r > maxRow) maxRow = r;
                });
                if (maxRow < range.e.r) {
                    console.log(`  ⚠ Trimming excessive range: ${range.e.r + 1} rows → ${maxRow + 1} rows`);
                    range.e.r = maxRow;
                    sheet['!ref'] = XLSX.utils.encode_range(range);
                }
            }
        }

        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Rows in sheet: ${data.length}`);

        let headers = [];
        let headerRowIndex = -1;

        // Try to find the header row
        for (let i = 0; i < Math.min(100, data.length); i++) {
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
            console.log(`  Headers NOT FOUND. Showing first 10 rows for inspection:`);
            for (let i = 0; i < Math.min(10, data.length); i++) {
                console.log(`  Row ${i}: ${JSON.stringify(data[i])}`);
            }
            continue;
        }

        console.log(`  Header found at row ${headerRowIndex}`);
        const productTypeIndex = headers.findIndex(h => {
            if (h === null || h === undefined) return false;
            const hStr = String(h).toLowerCase().trim();
            return hStr === 'product type' || hStr.includes('product type');
        });

        if (productTypeIndex >= 0) {
            console.log(`  "Product Type" column found at index ${productTypeIndex}`);
            const sheetTypes = new Set();
            for (let i = headerRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (row && row[productTypeIndex]) {
                    const type = String(row[productTypeIndex]).trim();
                    sheetTypes.add(type);
                    globalUniqueTypes.add(type);
                }
            }
            console.log(`  Unique types in this sheet: ${Array.from(sheetTypes).join(', ') || 'NONE'}`);
        } else {
            console.log(`  "Product Type" column NOT FOUND among headers: ${JSON.stringify(headers)}`);
        }
    }

    console.log('\n========================================');
    console.log('GLOBAL UNIQUE PRODUCT TYPES:');
    Array.from(globalUniqueTypes).sort().forEach(type => console.log(`- "${type}"`));
    console.log('========================================\n');
}

main().catch(console.error);
