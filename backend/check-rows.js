const XLSX = require('xlsx');
const path = require('path');

const workbookPath = path.join(__dirname, 'data', '2026_Zonewise_Open_Closed_Offer funnel.xlsx');
console.log('Loading workbook...');
const workbook = XLSX.readFile(workbookPath);

const personSheets = [
    'Yogesh', 'Ashraf', 'Rahul', 'Minesh', 'Gajendra',
    'Pradeep', 'Sasi', 'Vinay', 'Nitin', 'Pankaj'
];

console.log('\nSheet Row Analysis:');
personSheets.forEach(name => {
    const sheet = workbook.Sheets[name];
    if (sheet) {
        // Excel's metadata range (often bloated)
        const ref = sheet['!ref'];
        const range = XLSX.utils.decode_range(ref);
        const metadataRows = range.e.r - range.s.r + 1;

        // Actual data detection (scan backwards for the last row with content)
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        const actualRows = data.length;

        console.log(`- ${name.padEnd(8)}: Metadata says ${String(metadataRows).padStart(7)} rows | Actual data: ~${String(actualRows).padStart(4)} rows`);

        if (metadataRows > actualRows + 1000) {
            console.log(`    ⚠ WARNING: Sheet "${name}" has "Phantom Rows". Excel thinks it has ${metadataRows} rows but data ends at row ${actualRows}.`);
        }
    } else {
        console.log(`- ${name.padEnd(8)}: NOT FOUND`);
    }
});
