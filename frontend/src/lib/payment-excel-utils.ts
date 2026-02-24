
export interface PaymentRow {
    vendorName: string;
    bpCode: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    amount: number;
    emailId: string;
    valueDate: Date;
    transactionMode: 'NFT' | 'RTI' | 'FT';
    accountType: string; // 'Saving' or 'Current'
}

/**
 * Format 1: HDFC (Wide)
 */
export const downloadICICICMS = async (payments: PaymentRow[], customFilename?: string) => {
    // Dynamic imports to reduce bundle size
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const FileSaver = await import('file-saver');
    const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;
    const { format } = await import('date-fns');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('HDFC');

    // Row 1: Labels
    const row1 = [
        "Trn Type", "Bene code", "Bene A/C No.", "Instrument Amt", "Bene Name",
        "Drawee Location", "Print Location", "Bene Addr 1", "Bene Addr 2", "Bene Addr 3",
        "Bene Addr 4", "Instruction on Ref No.", "Customer Ref No.",
        "Payment Detail 1", "Payment Detail 2", "Payment Detail 3", "Payment Detail 4",
        "Payment Detail 5", "Payment Detail 6", "Payment Detail 7",
        "Instrument no", "Inst. Date", "MICR NO", "IFSC Code", "Bene Bank Name",
        "Bene Bank Branch Name", "", "", "", "Bene Email ID"
    ];

    // Row 2: Type Codes
    const row2 = [
        "A", "A", "A", "N", "C", "A", "A", "A", "A", "A", "A", "A", "C",
        "C", "C", "C", "C", "C", "C", "C", "N", "DD/MM/YYYY", "N", "A", "A",
        "A", "A", "A", "A", "A"
    ];

    // Row 3: Character Lengths
    const row3 = [
        "1", "15", "20", "20", "100", "30", "30", "70", "70", "70", "70", "30", "30",
        "30", "30", "30", "30", "30", "30", "30", "12", "10", "15", "15", "100",
        "50", "50", "50", "50", "100"
    ];

    // Row 4: Mandatory/Optional Flags
    const row4 = [
        "Mandatory", "Mandatory", "Mandatory", "Mandatory", "Mandatory",
        "Optional", "Optional", "Optional", "Optional", "Optional", "Optional", "Optional",
        "Mandatory", "Optional", "Optional", "Optional", "Optional", "Optional", "Optional", "Optional",
        "Optional", "Mandatory", "Optional", "Mandatory", "Mandatory", "Optional",
        "Optional", "Optional", "Optional", "Mandatory"
    ];

    // Styling Constants
    const headerBg = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }; // Light Grey
    const redFont = { color: { argb: 'FFFF0000' }, bold: true, size: 9 };
    const blackFont = { color: { argb: 'FF000000' }, bold: true, size: 9 };
    const borderStyle: any = { style: 'thin', color: { argb: 'FF000000' } };

    // Add Rows
    [row1, row2, row3, row4].forEach((rowData, idx) => {
        const row = worksheet.addRow(rowData);
        row.height = 20;
        row.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.fill = headerBg as any;
            cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };

            // Red text for labels and mandatory flags
            if (idx === 0 || idx === 1 || (idx === 3 && cell.value === 'Mandatory') || idx === 2) {
                cell.font = redFont;
            } else {
                cell.font = blackFont;
            }
        });
    });

    // Add Data Rows
    payments.forEach(p => {
        const trnType = p.transactionMode === 'NFT' ? 'N' : p.transactionMode === 'RTI' ? 'R' : 'I';
        const beneCode = p.bpCode || p.vendorName.substring(0, 15).trim();
        const custRef = p.vendorName.split(' ')[0].substring(0, 30);

        const rowData = Array(30).fill("");
        rowData[0] = trnType;
        rowData[1] = beneCode;
        rowData[2] = p.accountNumber;
        rowData[3] = p.amount;
        rowData[4] = p.vendorName;
        rowData[12] = custRef;

        rowData[21] = format(p.valueDate, 'dd/MM/yyyy');
        rowData[23] = p.ifscCode;
        rowData[24] = p.bankName;
        rowData[29] = p.emailId;

        const row = worksheet.addRow(rowData);
        row.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
            cell.alignment = { vertical: 'middle' };
            cell.font = { size: 10 };
        });
    });

    // Set Column Widths (Row 3 values mapped to Excel widths)
    const widths = [8, 15, 20, 15, 40, 12, 12, 15, 15, 15, 15, 15, 20, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 30, 20, 15, 15, 15, 30];
    worksheet.columns = widths.map(w => ({ width: w }));

    const buffer = await workbook.xlsx.writeBuffer();
    const finalFilename = customFilename ? (customFilename.endsWith('.xlsx') ? customFilename : `${customFilename}.xlsx`) : `HDFC_Bulk_Payment_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    saveAs(new Blob([buffer]), finalFilename);
};

/**
 * Format 2: DB
 */
export const downloadStandardPayment = async (payments: PaymentRow[], customFilename?: string) => {
    // Dynamic imports to reduce bundle size
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const FileSaver = await import('file-saver');
    const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;
    const { format } = await import('date-fns');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payments');

    const headers = [
        "Transaction Mode", "Transaction Amount", "Value Date/Execution Date",
        "Counter Party Name", "Counter Party Account", "Ben Account Type",
        "Counter Party Bank Code/Clearing Code", "Order Party Reference",
        "Transaction Details Line 1"
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 25;
    headerRow.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF444444' } }; // Dark Grey
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    payments.forEach(p => {
        const nameParts = p.vendorName.split(' ');
        let ref = p.vendorName.substring(0, 15);
        if (nameParts.length > 2) {
            ref = `Adv ${nameParts[0]}`;
        } else if (nameParts[0].length > 15) {
            ref = nameParts[0].substring(0, 15);
        } else {
            ref = nameParts[0];
        }

        const row = worksheet.addRow([
            p.transactionMode,
            p.amount,
            format(p.valueDate, 'dd/MM/yyyy'),
            p.vendorName,
            p.accountNumber,
            p.accountType.toLowerCase().includes('sav') ? '10' : '11',
            p.ifscCode,
            ref,
            ref
        ]);

        row.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle' };
        });
    });

    worksheet.columns = [
        { width: 18 }, { width: 20 }, { width: 25 }, { width: 35 },
        { width: 25 }, { width: 18 }, { width: 35 }, { width: 22 }, { width: 22 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const finalFilename = customFilename ? (customFilename.endsWith('.xlsx') ? customFilename : `${customFilename}.xlsx`) : `DB_Bulk_Payment_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    saveAs(new Blob([buffer]), finalFilename);
};

// ============================================================================
// HDFC — Helper: Build data rows (reused by CSV & TXT)
// ============================================================================
function buildICICIDataRows(payments: PaymentRow[], formatDate: (d: Date, f: string) => string) {
    return payments.map(p => {
        const trnType = p.transactionMode === 'NFT' ? 'N' : p.transactionMode === 'RTI' ? 'R' : 'I';
        const beneCode = p.bpCode || p.vendorName.substring(0, 15).trim();
        const custRef = p.vendorName.split(' ')[0].substring(0, 30);

        const row = Array(30).fill('');
        row[0] = trnType;
        row[1] = beneCode;
        row[2] = p.accountNumber;
        row[3] = String(p.amount);
        row[4] = p.vendorName;
        row[12] = custRef;
        row[21] = formatDate(p.valueDate, 'dd/MM/yyyy');
        row[23] = p.ifscCode;
        row[24] = p.bankName;
        row[29] = p.emailId || '';
        return row;
    });
}

// ============================================================================
// DB — Helper: Build data rows (reused by CSV & TXT) 
// ============================================================================
function buildStandardDataRows(payments: PaymentRow[], formatDate: (d: Date, f: string) => string) {
    return payments.map(p => {
        const nameParts = p.vendorName.split(' ');
        let ref = p.vendorName.substring(0, 15);
        if (nameParts.length > 2) {
            ref = `Adv ${nameParts[0]}`;
        } else if (nameParts[0].length > 15) {
            ref = nameParts[0].substring(0, 15);
        } else {
            ref = nameParts[0];
        }

        return [
            p.transactionMode,
            String(p.amount),
            formatDate(p.valueDate, 'dd/MM/yyyy'),
            p.vendorName,
            p.accountNumber,
            p.accountType.toLowerCase().includes('sav') ? '10' : '11',
            p.ifscCode,
            ref,
            ref
        ];
    });
}

// ============================================================================
// CSV helper — escape fields for CSV format
// ============================================================================
function csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// HDFC — CSV (Data Only, no header rows)
// ============================================================================
export const downloadICICICMS_CSV = async (payments: PaymentRow[], customFilename?: string) => {
    const { format } = await import('date-fns');
    const rows = buildICICIDataRows(payments, format);
    const csvContent = rows.map(row => row.map(csvEscape).join(',')).join('\n');
    const finalFilename = customFilename ? (customFilename.endsWith('.csv') ? customFilename : `${customFilename}.csv`) : `HDFC_Data_${format(new Date(), 'yyyyMMdd')}.csv`;
    downloadBlob(csvContent, finalFilename, 'text/csv;charset=utf-8;');
};

// ============================================================================
// HDFC — TXT (Pipe-delimited, essential fields only)
// ============================================================================
export const downloadICICICMS_TXT = async (payments: PaymentRow[], customFilename?: string) => {
    const { format } = await import('date-fns');
    const rows = buildICICIDataRows(payments, format);
    const txtContent = rows.map(row => row.join(',')).join('\n');
    const finalFilename = customFilename ? (customFilename.endsWith('.txt') ? customFilename : `${customFilename}.txt`) : `HDFC_Data_${format(new Date(), 'yyyyMMdd')}.txt`;
    downloadBlob(txtContent, finalFilename, 'text/plain;charset=utf-8;');
};

// ============================================================================
// DB — CSV (Data Only, no header row)
// ============================================================================
export const downloadStandard_CSV = async (payments: PaymentRow[], customFilename?: string) => {
    const { format } = await import('date-fns');
    const rows = buildStandardDataRows(payments, format);
    const csvContent = rows.map(row => row.map(csvEscape).join(',')).join('\n');
    const finalFilename = customFilename ? (customFilename.endsWith('.csv') ? customFilename : `${customFilename}.csv`) : `DB_Payment_Data_${format(new Date(), 'yyyyMMdd')}.csv`;
    downloadBlob(csvContent, finalFilename, 'text/csv;charset=utf-8;');
};

// ============================================================================
// DB — TXT (Pipe-delimited data only)
// ============================================================================
export const downloadStandard_TXT = async (payments: PaymentRow[], customFilename?: string) => {
    const { format } = await import('date-fns');
    const rows = buildStandardDataRows(payments, format);
    const txtContent = rows.map(row => row.join(',')).join('\n');
    const finalFilename = customFilename ? (customFilename.endsWith('.txt') ? customFilename : `${customFilename}.txt`) : `DB_Payment_Data_${format(new Date(), 'yyyyMMdd')}.txt`;
    downloadBlob(txtContent, finalFilename, 'text/plain;charset=utf-8;');
};

