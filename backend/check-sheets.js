const XLSX = require('xlsx');
const path = require('path');

const workbookPath = path.join(__dirname, 'data', '2026_Zonewise_Open_Closed_Offer funnel.xlsx');
try {
    const workbook = XLSX.readFile(workbookPath);
    console.log('Sheet Names:', workbook.SheetNames);
} catch (error) {
    console.error('Error reading workbook:', error);
}
