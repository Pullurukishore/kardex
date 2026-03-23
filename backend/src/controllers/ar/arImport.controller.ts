import { Request, Response } from 'express';
import { ARInvoiceStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logInvoiceActivity, getUserFromRequest, getIpFromRequest } from './arActivityLog.controller';
import { calculateDaysBetween, calculateRiskClass } from '../../utils/dateUtils';

import prisma from '../../config/db';


// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../../uploads/ar');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `ar_import_${timestamp}${path.extname(file.originalname)}`);
    }
});

export const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * SAP Excel Column Mapping (Mandatory Green Fields):
 * A: Doc. No.        → invoiceNumber
 * C: Customer Code   → bpCode
 * D: Customer Name   → customerName
 * F: Customer Ref No → poNo (Mandatory)
 * H: Amount          → totalAmount (Mandatory)
 * I: Net             → netAmount (Mandatory)
 * J: Tax             → taxAmount (Mandatory)
 * M: Document Date   → invoiceDate (Mandatory)
 */
interface SAPImportRow {
    [key: string]: any;
}

// Helper function to parse Excel date
function parseExcelDate(value: any): Date | null {
    if (!value) return null;

    // If it's already a Date object
    if (value instanceof Date) return value;

    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + value * 86400000);
    }

    // If it's a string, try to parse it
    if (typeof value === 'string') {
        const trimmed = value.trim();

        // 1. Try DD/MM/YYYY format
        const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
            const day = parseInt(ddmmyyyy[1]);
            const month = parseInt(ddmmyyyy[2]) - 1;
            const year = parseInt(ddmmyyyy[3]);
            return new Date(year, month, day);
        }

        // 2. Try DD.MM.YYYY format (Common in SAP)
        const ddmmyyyyDot = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (ddmmyyyyDot) {
            const day = parseInt(ddmmyyyyDot[1]);
            const month = parseInt(ddmmyyyyDot[2]) - 1;
            const year = parseInt(ddmmyyyyDot[3]);
            return new Date(year, month, day);
        }

        // 3. Try DD-MM-YYYY format (Dashes)
        const ddmmyyyyDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (ddmmyyyyDash) {
            const day = parseInt(ddmmyyyyDash[1]);
            const month = parseInt(ddmmyyyyDash[2]) - 1;
            const year = parseInt(ddmmyyyyDash[3]);
            return new Date(year, month, day);
        }

        // 4. Try YYYY-MM-DD format
        const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (yyyymmdd) {
            return new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
        }

        // 5. Try DD-MMM-YYYY format (e.g., 25-Feb-2025)
        const ddmmmyyyy = trimmed.match(/^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})$/i);
        if (ddmmmyyyy) {
            const day = parseInt(ddmmmyyyy[1]);
            const monthStr = ddmmmyyyy[2].toLowerCase();
            const months: { [key: string]: number } = {
                jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            const month = months[monthStr];
            const year = parseInt(ddmmmyyyy[3]);
            return new Date(year, month, day);
        }

        // 6. Try MMM-YY format (e.g., Sep-24)
        const mmmyy = trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2,4})$/i);
        if (mmmyy) {
            const monthStr = mmmyy[1].toLowerCase();
            const months: { [key: string]: number } = {
                jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            const month = months[monthStr];
            let year = parseInt(mmmyy[2]);
            if (year < 100) year += 2000; // Assume 20xx for YY
            return new Date(year, month, 1); // Default to 1st of month
        }

        // 7. Fallback to generic parsing for other formats
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

// Helper function to parse decimal values
function parseDecimal(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Remove currency symbols and commas
        const cleaned = value.replace(/[₹$€£,\s]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

// Helper function to get value from multiple possible column names
function getValue(row: SAPImportRow, ...keys: string[]): any {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const searchKey = key.trim().toLowerCase();
        
        // Try direct match first (fastest)
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            let value = row[key];
            if (typeof value === 'string' && /^[=+\-@]/.test(value)) value = `'${value}`;
            return value;
        }

        // Try case-insensitive and trimmed match
        const actualKey = rowKeys.find(rk => {
            const normalized = rk.replace(/\s+/g, ' ').trim().toLowerCase();
            const normalizedSearch = searchKey.replace(/\s+/g, ' ').trim().toLowerCase();
            return normalized === normalizedSearch || normalized.includes(normalizedSearch);
        });

        if (actualKey && row[actualKey] !== undefined && row[actualKey] !== null && row[actualKey] !== '') {
            let value = row[actualKey];
            // Sanitization: Prevent CSV/Formula Injection
            if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
                value = `'${value}`;
            }
            return value;
        }
    }
    return null;
}

// Validate a single row and return field-level errors
function validateRow(row: SAPImportRow, rowNumber: number): { isValid: boolean; errors: { field: string; message: string }[] } {
    const errors: { field: string; message: string }[] = [];

    const invoiceNumber = getValue(row, 'Doc. No.', 'Doc No', 'DocNo', 'Invoice No', 'InvoiceNo')?.toString()?.trim();
    const bpCode = getValue(row, 'Customer Code', 'CustomerCode', 'BP Code', 'BPCode')?.toString()?.trim();
    const customerName = getValue(row, 'Customer Name', 'CustomerName')?.toString()?.trim();
    const totalAmount = getValue(row, 'Amount', 'Total Amount', 'TotalAmount', 'Original Amount', 'OriginalAmount');
    const poNo = getValue(row, 'Customer Ref. No.', 'Customer Ref No', 'CustomerRefNo', 'PO No', 'PONo')?.toString()?.trim();
    const netAmount = getValue(row, 'Net', 'Net Amount', 'NetAmount');
    const taxAmountValue = getValue(row, 'Tax', 'Tax Amount', 'TaxAmount');
    const invoiceDate = getValue(row, 'Document Date', 'DocumentDate', 'Invoice Date', 'InvoiceDate');

    if (!invoiceNumber) {
        errors.push({ field: 'Doc. No.', message: 'Missing invoice number (Doc. No.)' });
    }

    if (!bpCode) {
        errors.push({ field: 'Customer Code', message: 'Missing customer code (BP Code)' });
    }

    if (!customerName) {
        errors.push({ field: 'Customer Name', message: 'Missing customer name' });
    }

    if (!poNo) {
        errors.push({ field: 'Customer Ref. No.', message: 'Missing Customer Ref. No. (PO No)' });
    }

    if (totalAmount === null || totalAmount === undefined || totalAmount === '') {
        errors.push({ field: 'Amount', message: 'Missing total amount' });
    } else if (isNaN(parseDecimal(totalAmount))) {
        errors.push({ field: 'Amount', message: 'Invalid amount format' });
    }

    if (netAmount === null || netAmount === undefined || netAmount === '') {
        errors.push({ field: 'Net', message: 'Missing net amount' });
    } else if (isNaN(parseDecimal(netAmount))) {
        errors.push({ field: 'Net', message: 'Invalid net amount format' });
    }

    if (taxAmountValue === null || taxAmountValue === undefined || taxAmountValue === '') {
        errors.push({ field: 'Tax', message: 'Missing tax amount' });
    } else if (isNaN(parseDecimal(taxAmountValue))) {
        errors.push({ field: 'Tax', message: 'Invalid tax amount format' });
    }

    if (!invoiceDate) {
        errors.push({ field: 'Document Date', message: 'Missing document date' });
    } else if (!parseExcelDate(invoiceDate)) {
        errors.push({ field: 'Document Date', message: 'Invalid date format' });
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Helper to normalize booking month to YYYY-MM
 */
function normalizeBookingMonth(value: any): string | null {
    if (!value) return null;
    
    const str = value.toString().trim();
    if (!str) return null;

    // 1. If already YYYY-MM
    if (/^\d{4}-\d{2}$/.test(str)) return str;

    // 2. Try parsing as a general date
    const date = parseExcelDate(value);
    if (date && !isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    // 3. Try common month formats if parseExcelDate missed them
    const monthsMap: { [key: string]: string } = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    
    const parts = str.split(/[\s/-]/);
    if (parts.length >= 2) {
        let month = '';
        let year = '';
        
        for (const p of parts) {
            const lp = p.toLowerCase().substring(0, 3);
            if (monthsMap[lp]) month = monthsMap[lp];
            else if (/^\d{4}$/.test(p)) year = p;
            else if (/^\d{2}$/.test(p) && !year) year = p;
        }
        
        if (month && year) {
            if (year.length === 2) year = '20' + year;
            return `${year}-${month}`;
        }
    }

    return str;
}

/**
 * Preview Excel file before importing (shows ALL rows with validation)
 */
export const previewExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
                details: 'Please select an Excel file (.xlsx or .xls) to upload'
            });
        }

        let workbook;
        try {
            // Read file from buffer (memoryStorage)
            workbook = XLSX.read(req.file.buffer, { cellDates: true });
        } catch (parseError: any) {
            return res.status(400).json({
                success: false,
                message: 'Failed to read Excel file',
                details: 'The file appears to be corrupted or is not a valid Excel file',
                error: parseError.message
            });
        }

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No worksheets found',
                details: 'The Excel file does not contain any worksheets'
            });
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
            return res.status(400).json({
                success: false,
                message: 'Empty worksheet',
                details: `The worksheet "${sheetName}" is empty or could not be read`
            });
        }

        // Convert to JSON with headers
        let rows: SAPImportRow[];
        try {
            rows = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        } catch (convError: any) {
            return res.status(400).json({
                success: false,
                message: 'Failed to parse worksheet data',
                details: 'Could not convert the Excel data to a readable format',
                error: convError.message
            });
        }

        // Potential Resource Exhaustion Check (Hole #3)
        const MAX_ROWS = 5000;
        if (rows.length > MAX_ROWS) {
            return res.status(400).json({
                success: false,
                message: 'File too large',
                details: `The file contains ${rows.length} rows, which exceeds the limit of ${MAX_ROWS} per import.`
            });
        }

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No data rows found',
                details: 'The Excel file has headers but no data rows. Please add invoice data below the header row.'
            });
        }

        // Get headers from the first row
        const headers = Object.keys(rows[0]);

        // --- Milestone Specific Detection ---
        const milestoneRequiredColumns = [
            'Invoice Number', 'SO no.', 'PO No.', 'Booking month', 'Customer', 
            'Accounting status', 'Total Amount', 'Order Value', 'GST', 
            'Invoice Date', 'Finance Comments', 'Mail to TSP'
        ];
        const isMilestoneFormat = headers.some(h => h.trim().toLowerCase().includes('so no.')) || 
                                 headers.some(h => h.trim().toLowerCase().includes('booking month'));

        // Required columns for standard SAP import
        const sapRequiredColumns = ['Doc. No.', 'Customer Code', 'Customer Name', 'Customer Ref. No.', 'Amount', 'Net', 'Tax', 'Document Date'];
        
        const possibleHeaders: { [key: string]: string[] } = isMilestoneFormat ? {
            'Invoice Number': ['Invoice Number', 'Invoice No', 'InvNo', 'Doc. No.', 'Bill No'],
            'SO no.': ['SO no.', 'SO.no', 'SONo', 'SO Number', 'Sales Order'],
            'PO No.': ['PO No.', 'PO.No', 'PONo', 'Customer Ref. No.', 'PO Number'],
            'Booking month': ['Booking month', 'Month', 'Booking Month'],
            'Customer': ['Customer', 'Customer Name', 'BP Name', 'Sold-to party'],
            'Accounting status': ['Accounting status', 'Status', 'Accounting Status'],
            'Mail to TSP': ['Mail to TSP', 'TSP'],
            'Invoice Date': ['Invoice Date', 'Document Date'],
            'Due Date': ['Due Date'],
            'Order Value': ['Order Value', 'Net', 'Value'],
            'GST': ['GST', 'Tax'],
            'Total Amount': ['Total Amount', 'Amount', 'Total'],
            'Actual Payment terms': ['Actual Payment terms', 'Payment Terms', 'Terms'],
            'Finance Comments': ['Finance Comments', 'Remarks', 'Comments']
        } : {
            'Doc. No.': ['Doc. No.', 'Doc No', 'DocNo', 'Invoice No', 'InvoiceNo'],
            'Customer Code': ['Customer Code', 'CustomerCode', 'BP Code', 'BPCode'],
            'Customer Name': ['Customer Name', 'CustomerName'],
            'Customer Ref. No.': ['Customer Ref. No.', 'Customer Ref No', 'CustomerRefNo', 'PO No', 'PONo'],
            'Amount': ['Amount', 'Total Amount', 'TotalAmount', 'Original Amount', 'OriginalAmount'],
            'Net': ['Net', 'Net Amount', 'NetAmount'],
            'Tax': ['Tax', 'Tax Amount', 'TaxAmount'],
            'Document Date': ['Document Date', 'DocumentDate', 'Invoice Date', 'InvoiceDate'],
            // Master Fields
            'Email ID': ['Email ID', 'Email', 'Contact Email'],
            'Contact No': ['Contact No', 'Phone', 'Mobile'],
            'Region': ['Region', 'Location', 'Zone'],
            'Department': ['Department'],
            'Person In-charge': ['Person In-charge', 'POC'],
            'Category': ['Category', 'Type', 'Service Type']
        };

        const displayHeaders = isMilestoneFormat ? milestoneRequiredColumns : sapRequiredColumns;
        const missingColumns: string[] = [];
        for (const reqCol of displayHeaders) {
            const possibleNames = possibleHeaders[reqCol];
            const found = headers.some(h => possibleNames.some(p => h.toLowerCase().includes(p.toLowerCase())));
            if (!found) {
                missingColumns.push(reqCol);
            }
        }

        // Create a normalized row object for consistent frontend usage
        const validatedRows = rows.map((row, index) => {
            const cleanRow: any = {
                invoiceNumber: getValue(row, 'Invoice Number', 'Invoice No', 'InvNo', 'Doc. No.', 'Bill No'),
                bpCode: getValue(row, 'Customer Code', 'CustomerCode', 'BP Code', 'BPCode'),
                soNo: getValue(row, 'SO no.', 'SO.no', 'SONo', 'SO Number', 'Sales Order'),
                poNo: getValue(row, 'PO No.', 'PO.No', 'PONo', 'Customer Ref. No.', 'PO Number'),
                customerName: getValue(row, 'Customer', 'Customer Name', 'BP Name', 'Sold-to party'),
                bookingMonth: normalizeBookingMonth(getValue(row, 'Booking month', 'Month', 'Booking Month')),
                accountingStatus: getValue(row, 'Accounting status', 'Status', 'Accounting Status'),
                totalAmount: getValue(row, 'Total Amount', 'Amount', 'Total'),
                netAmount: getValue(row, 'Order Value', 'Net', 'Value'),
                taxAmount: getValue(row, 'GST', 'Tax'),
                invoiceDate: getValue(row, 'Invoice Date', 'Document Date'),
                financeComments: getValue(row, 'Finance Comments', 'Remarks', 'Comments'),
                mailToTSP: getValue(row, 'Mail to TSP', 'TSP'),
                actualPaymentTerms: getValue(row, 'Actual Payment terms', 'Payment Terms', 'Terms'),
                type: getValue(row, 'Category', 'Type', 'Service Type'),
                // Master Fields
                emailId: getValue(row, 'Email ID', 'Email', 'Contact Email'),
                contactNo: getValue(row, 'Contact No', 'Phone', 'Mobile'),
                region: getValue(row, 'Region', 'Location', 'Zone'),
                department: getValue(row, 'Department'),
                personInCharge: getValue(row, 'Person In-charge', 'POC')
            };

            let validation;
            if (isMilestoneFormat) {
                const errors: { field: string; message: string }[] = [];
                if (!cleanRow.customerName) errors.push({ field: 'Customer', message: 'Missing Customer' });
                if (!cleanRow.totalAmount) errors.push({ field: 'Total Amount', message: 'Missing Total Amount' });
                
                if (cleanRow.invoiceDate && !parseExcelDate(cleanRow.invoiceDate)) {
                    errors.push({ field: 'Invoice Date', message: 'Invalid date format' });
                }
                validation = { isValid: errors.length === 0, errors };
            } else {
                validation = validateRow(row, index + 2);
            }

            return {
                ...cleanRow,
                _rowNumber: index + 2,
                _isValid: validation.isValid,
                _errors: validation.errors,
                _isMilestone: isMilestoneFormat
            };
        });

        const validRowsCount = validatedRows.filter(r => r._isValid).length;
        const invalidRowsCount = validatedRows.filter(r => !r._isValid).length;

        return res.status(200).json({
            success: true,
            headers: displayHeaders, // Keep original headers for dynamic parts if any
            preview: validatedRows,
            totalRows: rows.length,
            validRows: validRowsCount,
            invalidRows: invalidRowsCount,
            missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
            sheetName,
            isMilestone: isMilestoneFormat
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: 'Failed to preview file',
            details: 'An unexpected error occurred while reading the file',
            error: error.message
        });
    }
};

/**
 * Import AR Invoices from SAP Excel file
 */
export const importFromExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const fileName = req.file.originalname;
        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        // Read the Excel file from buffer (memoryStorage)
        const workbook = XLSX.read(req.file.buffer, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const rows: SAPImportRow[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Excel file is empty or has no valid data'
            });
        }

        // Get headers for format detection
        const headers = Object.keys(rows[0]);
        const isMilestoneFormat = headers.some(h => h.trim().toLowerCase().includes('so no.')) || 
                                 headers.some(h => h.trim().toLowerCase().includes('booking month'));

        // Mapping config
        const possibleHeaders: { [key: string]: string[] } = isMilestoneFormat ? {
            'invoiceNumber': ['Invoice Number', 'Invoice No', 'InvNo', 'Doc. No.', 'Bill No'],
            'soNo': ['SO no.', 'SO.no', 'SONo', 'SO Number', 'Sales Order'],
            'poNo': ['PO No.', 'PO.No', 'PONo', 'Customer Ref. No.', 'PO Number'],
            'bookingMonth': ['Booking month', 'Month', 'Booking Month'],
            'customerName': ['Customer', 'Customer Name', 'BP Name', 'Sold-to party'],
            'accountingStatus': ['Accounting status', 'Status', 'Accounting Status'],
            'mailToTSP': ['Mail to TSP', 'TSP'],
            'invoiceDate': ['Invoice Date', 'Document Date'],
            'dueDate': ['Due Date'],
            'netAmount': ['Order Value', 'Net', 'Value'],
            'taxAmount': ['GST', 'Tax'],
            'totalAmount': ['Total Amount', 'Amount', 'Total'],
            'actualPaymentTerms': ['Actual Payment terms', 'Payment Terms', 'Terms'],
            'financeComments': ['Finance Comments', 'Remarks', 'Comments']
        } : {
            'invoiceNumber': ['Doc. No.', 'Doc No', 'DocNo', 'Invoice No', 'InvoiceNo'],
            'bpCode': ['Customer Code', 'CustomerCode', 'BP Code', 'BPCode'],
            'customerName': ['Customer Name', 'CustomerName'],
            'poNo': ['Customer Ref. No.', 'Customer Ref No', 'CustomerRefNo', 'PO No', 'PONo'],
            'totalAmount': ['Amount', 'Total Amount', 'TotalAmount', 'Original Amount', 'OriginalAmount'],
            'netAmount': ['Net', 'Net Amount', 'NetAmount'],
            'taxAmount': ['Tax', 'Tax Amount', 'TaxAmount'],
            'invoiceDate': ['Document Date', 'DocumentDate', 'Invoice Date', 'InvoiceDate'],
            'type': ['Category', 'Type', 'Service Type']
        };

        // Potential Resource Exhaustion Check (Hole #3)
        const MAX_ROWS = 5000;
        if (rows.length > MAX_ROWS) {
            return res.status(400).json({
                success: false,
                message: 'File too large',
                details: `The file contains ${rows.length} rows, which exceeds the limit of ${MAX_ROWS} per import.`
            });
        }

        // Parse selectedIndices if provided - only import selected rows
        let selectedIndices: Set<number> | null = null;
        if (req.body?.selectedIndices) {
            try {
                const indices = JSON.parse(req.body.selectedIndices);
                if (Array.isArray(indices)) {
                    selectedIndices = new Set(indices);
                }
            } catch (e) {
                // Ignore parsing errors, import all rows
            }
        }

        // Phase 1: Validate all rows and prepare data (outside transaction)
        const validRows: Array<{
            rowNumber: number;
            invoiceNumber: string;
            bpCode: string;
            customerName: string;
            poNo: string | null;
            soNo: string | null;
            totalAmount: number;
            netAmount: number;
            taxAmount: number;
            invoiceDate: Date | null;
            finalDueDate: Date | null;
            actualPaymentTerms: string | null;
            bookingMonth: string | null;
            accountingStatus: any;
            mailToTSP: string | null;
            financeComments: string | null;
            invoiceType: 'REGULAR' | 'MILESTONE';
            // Master Fields
            emailId?: string | null;
            contactNo?: string | null;
            region?: string | null;
            department?: string | null;
            personInCharge?: string | null;
            pocName?: string | null;
            type?: string | null;
        }> = [];

        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
            // Skip rows that are not selected (if selection was provided)
            if (selectedIndices !== null && !selectedIndices.has(i)) {
                continue;
            }

            const row = rows[i];
            const rowNumber = i + 2; // Excel rows are 1-indexed, plus header row

            // Extract fields with flexible column name matching
            const invoiceNumber = getValue(row, ...possibleHeaders['invoiceNumber'])?.toString()?.trim();
            const customerName = getValue(row, ...possibleHeaders['customerName'])?.toString()?.trim();
            const totalAmount = parseDecimal(getValue(row, ...possibleHeaders['totalAmount']));
            const bpCode = !isMilestoneFormat ? getValue(row, ...possibleHeaders['bpCode'])?.toString()?.trim() : '';
            const poNo = getValue(row, ...possibleHeaders['poNo'])?.toString()?.trim();
            const netAmount = parseDecimal(getValue(row, ...possibleHeaders['netAmount']));
            const taxAmount = parseDecimal(getValue(row, ...possibleHeaders['taxAmount']));
            const invoiceDate = parseExcelDate(getValue(row, ...possibleHeaders['invoiceDate']));

            // Milestone specific fields
            const soNo = isMilestoneFormat ? getValue(row, ...possibleHeaders['soNo'])?.toString()?.trim() : null;
            const bookingMonthValue = isMilestoneFormat ? getValue(row, ...possibleHeaders['bookingMonth']) : null;
            const bookingMonth = normalizeBookingMonth(bookingMonthValue);
            const mailToTSP = isMilestoneFormat ? getValue(row, ...possibleHeaders['mailToTSP'])?.toString()?.trim() : null;
            const actualPaymentTerms = isMilestoneFormat ? getValue(row, ...possibleHeaders['actualPaymentTerms'])?.toString()?.trim() : null;
            const financeComments = isMilestoneFormat ? getValue(row, ...possibleHeaders['financeComments'])?.toString()?.trim() : null;
            const typeStr = getValue(row, ...possibleHeaders['type'] || ['Category', 'Type', 'Service Type'])?.toString()?.trim()?.toUpperCase() || null;
            let finalType: any = null;
            if (typeStr === 'LCS' || typeStr === 'NB' || typeStr === 'FINANCE') {
                finalType = typeStr;
            } else if (typeStr === 'NEW BUSINESS') {
                finalType = 'NB';
            }
            
            // Validation
            if (!invoiceNumber && !isMilestoneFormat) {
                errors.push(`Row ${rowNumber}: Missing Invoice Number`);
                continue;
            }
            if (!customerName) {
                errors.push(`Row ${rowNumber}: Missing Customer Name`);
                continue;
            }
            if (totalAmount <= 0) {
                errors.push(`Row ${rowNumber}: Invalid or zero Total Amount`);
                continue;
            }

            // Fallback for missing invoice number in milestone format
            const finalInvoiceNumber = invoiceNumber || '';

            // Ignore Due Date from Excel even if provided - user adds it manually
            const dueDateFromExcel = null;

            let accountingStatus: any = null;
            if (isMilestoneFormat) {
                const statusStr = getValue(row, ...possibleHeaders['accountingStatus'])?.toString()?.trim()?.toUpperCase();
                if (statusStr === 'REVENUE RECOGNISED' || statusStr === 'REVENUE_RECOGNISED') {
                    accountingStatus = 'REVENUE_RECOGNISED';
                } else if (statusStr === 'BACKLOG') {
                    accountingStatus = 'BACKLOG';
                }
            }

            validRows.push({
                rowNumber,
                invoiceNumber: finalInvoiceNumber,
                bpCode: bpCode || '',
                customerName,
                poNo: poNo || null,
                soNo: soNo || null,
                totalAmount,
                netAmount,
                taxAmount,
                invoiceDate,
                finalDueDate: dueDateFromExcel,
                actualPaymentTerms: actualPaymentTerms || null,
                bookingMonth: bookingMonth || null,
                accountingStatus,
                mailToTSP: mailToTSP || null,
                financeComments: financeComments || null,
                invoiceType: isMilestoneFormat ? 'MILESTONE' : 'REGULAR',
                // Master Fields
                emailId: getValue(row, 'Email ID', 'Email', 'Contact Email'),
                contactNo: getValue(row, 'Contact No', 'Phone', 'Mobile'),
                region: getValue(row, 'Region', 'Location', 'Zone'),
                department: getValue(row, 'Department'),
                personInCharge: getValue(row, 'Person In-charge', 'POC'),
                type: finalType
            });
        }

        const failedCount = errors.length;
        let successCount = 0;
        const importedInvoices: Array<{ id: string; invoiceNumber: string; totalAmount: number; rowNumber: number }> = [];

        // Phase 2: Execute all upserts in a single transaction for atomicity
        if (validRows.length > 0) {
            try {
                await prisma.$transaction(async (tx) => {
                    for (const row of validRows) {
                        // For milestones without BP Code, we might want to try finding the customer by name
                        let bpCode = row.bpCode;
                        if (!bpCode && row.customerName) {
                            const lastInvoice = await tx.aRInvoice.findFirst({
                                where: { customerName: row.customerName, bpCode: { not: '' } },
                                select: { bpCode: true }
                            });
                            if (lastInvoice) bpCode = lastInvoice.bpCode;
                        }

                        const upsertData: any = {
                            bpCode: bpCode,
                            customerName: row.customerName,
                            poNo: row.poNo,
                            soNo: row.soNo,
                            totalAmount: row.totalAmount,
                            netAmount: row.netAmount,
                            taxAmount: row.taxAmount,
                            invoiceDate: row.invoiceDate,
                            dueDate: row.finalDueDate,
                            actualPaymentTerms: row.actualPaymentTerms,
                            bookingMonth: row.bookingMonth,
                            accountingStatus: row.accountingStatus,
                            mailToTSP: row.mailToTSP,
                            invoiceType: row.invoiceType,
                            // Master Fields
                            emailId: row.emailId || null,
                            contactNo: row.contactNo || null,
                            region: row.region || null,
                            department: row.department || null,
                            personInCharge: row.personInCharge || null,
                            type: row.type || null
                        };

                        // Check if invoice already exists (by number AND type to prevent accidental overwrites)
                        const existingInvoice = await tx.aRInvoice.findFirst({
                            where: { invoiceNumber: row.invoiceNumber, invoiceType: row.invoiceType },
                            select: { id: true, receipts: true, adjustments: true, totalReceipts: true }
                        });


                        let upsertedInvoice;

                        if (existingInvoice) {
                            // If invoice exists, preserve receipts and recalculate balance/status
                            const currentReceipts = Number(existingInvoice.receipts || 0);
                            const currentAdjustments = Number(existingInvoice.adjustments || 0);
                            const totalReceipts = currentReceipts + currentAdjustments;
                            const newBalance = Number(row.totalAmount) - totalReceipts;
                            
                            let newStatus: ARInvoiceStatus = 'PENDING';
                            if (newBalance <= 0) newStatus = 'PAID';
                            else if (totalReceipts > 0) newStatus = 'PARTIAL';

                            upsertedInvoice = await tx.aRInvoice.update({
                                where: { id: existingInvoice.id },
                                data: {
                                    ...upsertData,
                                    receipts: currentReceipts,
                                    adjustments: currentAdjustments,
                                    totalReceipts: totalReceipts,
                                    balance: newBalance,
                                    status: newStatus
                                }
                            });
                        } else {
                            // New invoice - default to full balance and pending status
                            upsertedInvoice = await tx.aRInvoice.create({
                                data: {
                                    invoiceNumber: row.invoiceNumber,
                                    ...upsertData,
                                    balance: row.totalAmount,
                                    receipts: 0,
                                    adjustments: 0,
                                    totalReceipts: 0,
                                    status: 'PENDING'
                                }
                            });
                        }


                        // 3. Update or Create Master Customer Record if BP Code exists
                        if (bpCode) {
                            await tx.aRCustomer.upsert({
                                where: { bpCode: bpCode },
                                create: {
                                    bpCode: bpCode,
                                    customerName: row.customerName,
                                    emailId: row.emailId || null,
                                    contactNo: row.contactNo || null,
                                    region: row.region || null,
                                    department: row.department || null,
                                    personInCharge: row.personInCharge || null,
                                    riskClass: calculateRiskClass(0) // Default for new
                                },
                                update: {
                                    customerName: row.customerName,
                                    emailId: row.emailId || undefined,
                                    contactNo: row.contactNo || undefined,
                                    region: row.region || undefined,
                                    department: row.department || undefined,
                                    personInCharge: row.personInCharge || undefined
                                }
                            });
                        }

                        // Add Finance Comments as Remark if present
                        if (row.financeComments) {
                            await tx.aRInvoiceRemark.create({
                                data: {
                                    invoiceId: upsertedInvoice.id,
                                    content: row.financeComments,
                                    createdById: user.id as number
                                }
                            });
                        }

                        importedInvoices.push({
                            id: upsertedInvoice.id,
                            invoiceNumber: row.invoiceNumber,
                            totalAmount: row.totalAmount,
                            rowNumber: row.rowNumber
                        });
                    }
                }, { timeout: 60000 }); // 60 second timeout for large imports

                successCount = importedInvoices.length;
            } catch (txError: any) {
                // Transaction failed - all upserts rolled back
                errors.push(`Transaction failed: ${txError.message}`);
                // All valid rows failed due to transaction rollback
                for (const row of validRows) {
                    errors.push(`Row ${row.rowNumber}: Rolled back due to transaction failure`);
                }
            }
        }

        // Phase 3: Log activity for imported invoices (outside transaction - non-critical)
        for (const inv of importedInvoices) {
            await logInvoiceActivity({
                invoiceId: inv.id,
                action: 'INVOICE_IMPORTED',
                description: `Invoice ${inv.invoiceNumber} imported from ${isMilestoneFormat ? 'Milestone' : 'SAP'} Excel - Amount: ₹${inv.totalAmount.toLocaleString()}`,
                performedById: user.id,
                performedBy: user.name || 'System Import',
                ipAddress,
                userAgent,
                metadata: { fileName, rowNumber: inv.rowNumber, source: isMilestoneFormat ? 'MILESTONE_IMPORT' : 'SAP_IMPORT' }
            });
        }

        // Log import history
        await prisma.aRImportHistory.create({
            data: {
                fileName,
                recordsCount: rows.length,
                successCount,
                failedCount: rows.length - successCount,
                importedBy: (req as any).user?.name || 'System',
                status: successCount === rows.length ? 'COMPLETED' : successCount === 0 ? 'FAILED' : 'PARTIAL',
                errorLog: errors.length > 0 ? errors.slice(0, 50).join('\n') : null
            }
        });

        return res.status(200).json({
            message: `Import completed: ${successCount} records imported, ${rows.length - successCount} failed`,
            total: rows.length,
            success: successCount,
            failed: rows.length - successCount,
            errors: errors.slice(0, 20),
            isMilestone: isMilestoneFormat
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: 'Failed to import file',
            error: error.message
        });
    }
};


/**
 * Get import history
 */
export const getImportHistory = async (req: Request, res: Response) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const [history, total] = await Promise.all([
            prisma.aRImportHistory.findMany({
                orderBy: { importedAt: 'desc' },
                take: Number(limit),
                skip: Number(offset)
            }),
            prisma.aRImportHistory.count()
        ]);

        return res.status(200).json({
            success: true,
            data: history,
            pagination: {
                total,
                limit: Number(limit),
                offset: Number(offset)
            }
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch import history',
            error: error.message
        });
    }
};

/**
 * Download import template (empty with headers only)
 */
export const downloadTemplate = async (req: Request, res: Response) => {
    try {
        // Create headers only - no sample data
        const headers = [
            'Doc. No.',
            'Customer Code',
            'Customer Name',
            'Customer Ref. No.',
            'Amount',
            'Net',
            'Tax',
            'Document Date'
        ];

        // Create workbook with empty data but headers
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([headers]);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, // Doc. No.
            { wch: 15 }, // Customer Code
            { wch: 30 }, // Customer Name
            { wch: 18 }, // Customer Ref. No.
            { wch: 15 }, // Amount
            { wch: 15 }, // Net
            { wch: 12 }, // Tax
            { wch: 15 }  // Document Date
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'AR Import Template');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="AR_Import_Template.xlsx"');
        res.send(buffer);

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: 'Failed to generate template',
            error: error.message
        });
    }
};

/**
 * Recalculate all invoice balances and risk classes
 * Uses cursor-based pagination and batched transactions for consistency and performance
 */
export const recalculateAll = async (req: Request, res: Response) => {
    try {
        const FETCH_BATCH_SIZE = 500; // Fetch invoices in batches to avoid memory issues
        const UPDATE_BATCH_SIZE = 100;
        let updatedCount = 0;
        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
            // Fetch invoices in batches using cursor pagination
            const invoices: {
                id: string;
                receipts: any;
                adjustments: any;
                totalAmount: any;
                dueDate: Date | null;
            }[] = await prisma.aRInvoice.findMany({
                take: FETCH_BATCH_SIZE,
                ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
                orderBy: { id: 'asc' },
                select: {
                    id: true,
                    receipts: true,
                    adjustments: true,
                    totalAmount: true,
                    dueDate: true
                }
            });

            if (invoices.length === 0) {
                hasMore = false;
                break;
            }

            // Update cursor for next iteration
            cursor = invoices[invoices.length - 1].id;
            hasMore = invoices.length === FETCH_BATCH_SIZE;

            // Prepare update data for this batch
            const updateData = invoices.map(invoice => {
                const receipts = Number(invoice.receipts) || 0;
                const adjustments = Number(invoice.adjustments) || 0;
                const totalReceipts = receipts + adjustments;
                const balance = Number(invoice.totalAmount) - totalReceipts;
                let dueByDays = 0;
                if (invoice.dueDate) {
                    dueByDays = calculateDaysBetween(invoice.dueDate);
                }
                const riskClass = calculateRiskClass(dueByDays);

                // Determine status
                let status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED' = 'PENDING';
                if (balance <= 0) {
                    status = 'PAID';
                } else if (totalReceipts > 0) {
                    status = 'PARTIAL';
                } else if (dueByDays > 0) {
                    status = 'OVERDUE';
                }

                return {
                    id: invoice.id,
                    totalReceipts,
                    balance,
                    dueByDays,
                    riskClass,
                    status
                };
            });

            // Process updates in smaller batches within transactions
            for (let i = 0; i < updateData.length; i += UPDATE_BATCH_SIZE) {
                const batch = updateData.slice(i, i + UPDATE_BATCH_SIZE);

                await prisma.$transaction(
                    batch.map((data: { id: string; totalReceipts: number; balance: number; dueByDays: number; riskClass: any; status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED' }) =>
                        prisma.aRInvoice.update({
                            where: { id: data.id },
                            data: {
                                totalReceipts: data.totalReceipts,
                                balance: data.balance,
                                dueByDays: data.dueByDays,
                                riskClass: data.riskClass,
                                status: data.status
                            }
                        })
                    )
                );

                updatedCount += batch.length;
            }
        }

        return res.status(200).json({
            success: true,
            message: `Recalculated ${updatedCount} invoices`,
            data: { updatedCount }
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: 'Failed to recalculate invoices',
            error: error.message
        });
    }
};
