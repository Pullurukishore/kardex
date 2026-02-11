const XLSX = require('xlsx');
const path = require('path');

const workbookPath = path.join(__dirname, 'data', '2026_Zonewise_Open_Closed_Offer funnel.xlsx');
const workbook = XLSX.readFile(workbookPath);
const sheetName = 'Yogesh';
const sheet = workbook.Sheets[sheetName];

if (sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Sheet: ${sheetName}`);
    for (let i = 0; i < Math.min(10, data.length); i++) {
        console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }
} else {
    console.log(`Sheet ${sheetName} not found`);
    console.log('Available sheets:', workbook.SheetNames);
}
