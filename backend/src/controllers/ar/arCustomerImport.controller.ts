import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../../config/db';
import { logInvoiceActivity, getUserFromRequest, getIpFromRequest } from './arActivityLog.controller';

interface CustomerImportRow {
    [key: string]: any;
}

// Helper function to get value from multiple possible column names
function getValue(row: CustomerImportRow, ...keys: string[]): any {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const searchKey = key.trim().toLowerCase();
        
        // Try direct match first
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return row[key];
        }

        // Try case-insensitive and trimmed match
        const actualKey = rowKeys.find(rk => {
            const normalized = rk.replace(/\s+/g, ' ').trim().toLowerCase();
            const normalizedSearch = searchKey.replace(/\s+/g, ' ').trim().toLowerCase();
            return normalized === normalizedSearch || normalized.includes(normalizedSearch);
        });

        if (actualKey && row[actualKey] !== undefined && row[actualKey] !== null && row[actualKey] !== '') {
            return row[actualKey];
        }
    }
    return null;
}

// Helper function to parse decimal values
function parseDecimal(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[₹$€£,\s]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

/**
 * Preview Customer Excel file before importing
 */
export const previewExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const workbook = XLSX.read(req.file.buffer, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: CustomerImportRow[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No data rows found'
            });
        }

        const validatedRows = rows.map((row, index) => {
            const bpCode = getValue(row, 'Customer Code', 'BP Code', 'Code')?.toString()?.trim();
            const customerName = getValue(row, 'Customer Name', 'Customer', 'Name')?.toString()?.trim();
            const emailId = getValue(row, 'Email ID', 'Email', 'Contact Email')?.toString()?.trim();
            const contactNo = getValue(row, 'Contact No', 'Phone', 'Mobile')?.toString()?.trim();
            const region = getValue(row, 'Region', 'Location', 'Zone')?.toString()?.trim();
            const creditLimit = parseDecimal(getValue(row, 'Credit Limit', 'Limit'));
            const department = getValue(row, 'Department')?.toString()?.trim();
            const personInCharge = getValue(row, 'Person In-charge', 'POC')?.toString()?.trim();

            const errors: { field: string; message: string }[] = [];
            if (!bpCode) errors.push({ field: 'Customer Code', message: 'Missing Customer Code' });
            if (!customerName) errors.push({ field: 'Customer Name', message: 'Missing Customer Name' });

            return {
                bpCode,
                customerName,
                emailId,
                contactNo,
                region,
                creditLimit,
                department,
                personInCharge,
                _rowNumber: index + 2,
                _isValid: errors.length === 0,
                _errors: errors
            };
        });

        return res.status(200).json({
            success: true,
            preview: validatedRows,
            totalRows: rows.length,
            validRows: validatedRows.filter(r => r._isValid).length,
            invalidRows: validatedRows.filter(r => !r._isValid).length,
            sheetName
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to preview file',
            error: error.message
        });
    }
};

/**
 * Import Customers from Excel - Updated to support persistent ARCustomer Master
 */
export const importFromExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const workbook = XLSX.read(req.file.buffer, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: CustomerImportRow[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        let selectedIndices: Set<number> | null = null;
        if (req.body?.selectedIndices) {
            try {
                const indices = JSON.parse(req.body.selectedIndices);
                if (Array.isArray(indices)) selectedIndices = new Set(indices);
            } catch (e) {}
        }

        interface ValidRow {
            bpCode: string;
            customerName: string;
            emailId: string | null;
            contactNo: string | null;
            region: string | null;
            creditLimit: number;
            department: string | null;
            personInCharge: string | null;
        }

        const validRows: ValidRow[] = [];
        for (let i = 0; i < rows.length; i++) {
            if (selectedIndices !== null && !selectedIndices.has(i)) continue;

            const row = rows[i];
            const bpCode = getValue(row, 'Customer Code', 'BP Code', 'Code')?.toString()?.trim();
            const customerName = getValue(row, 'Customer Name', 'Customer', 'Name')?.toString()?.trim();
            
            if (bpCode && customerName) {
                validRows.push({
                    bpCode,
                    customerName,
                    emailId: getValue(row, 'Email ID', 'Email', 'Contact Email')?.toString()?.trim(),
                    contactNo: getValue(row, 'Contact No', 'Phone', 'Mobile')?.toString()?.trim(),
                    region: getValue(row, 'Region', 'Location', 'Zone')?.toString()?.trim(),
                    creditLimit: parseDecimal(getValue(row, 'Credit Limit', 'Limit')),
                    department: getValue(row, 'Department')?.toString()?.trim(),
                    personInCharge: getValue(row, 'Person In-charge', 'POC')?.toString()?.trim()
                });
            }
        }

        let totalInvoicesUpdated = 0;
        let masterCreatedCount = 0;
        let masterUpdatedCount = 0;
        const errors: string[] = [];

        if (validRows.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const row of validRows) {
                    try {
                        const normalizedBpCode = row.bpCode.trim();
                        
                        // 1. Core Change: Upsert into ARCustomer Master Table
                        // This ensures the customer exists even without invoices
                        const existingMaster = await tx.aRCustomer.findUnique({
                            where: { bpCode: normalizedBpCode }
                        });

                        await tx.aRCustomer.upsert({
                            where: { bpCode: normalizedBpCode },
                            create: {
                                bpCode: normalizedBpCode,
                                customerName: row.customerName,
                                emailId: row.emailId,
                                contactNo: row.contactNo,
                                region: row.region,
                                creditLimit: row.creditLimit,
                                department: row.department,
                                personInCharge: row.personInCharge
                            },
                            update: {
                                customerName: row.customerName,
                                emailId: row.emailId || undefined,
                                contactNo: row.contactNo || undefined,
                                region: row.region || undefined,
                                creditLimit: row.creditLimit || undefined,
                                department: row.department || undefined,
                                personInCharge: row.personInCharge || undefined
                            }
                        });

                        if (existingMaster) masterUpdatedCount++; else masterCreatedCount++;

                        // 2. Secondary: Update all existing invoices for this bpCode
                        const result = await tx.aRInvoice.updateMany({
                            where: { bpCode: normalizedBpCode },
                            data: {
                                customerName: row.customerName,
                                emailId: row.emailId || undefined,
                                contactNo: row.contactNo || undefined,
                                region: row.region || undefined,
                                creditLimit: row.creditLimit || undefined,
                                department: row.department || undefined,
                                personInCharge: row.personInCharge || undefined
                            }
                        });

                        totalInvoicesUpdated += result.count;

                        // Activity Logging
                        await logInvoiceActivity({
                            invoiceId: null, // Global master activity
                            action: 'CUSTOMER_IMPORTED',
                            description: `Customer ${row.customerName} (${normalizedBpCode}) master record synchronized. ${result.count} invoices patched.`,
                            performedById: user.id,
                            performedBy: user.name,
                            ipAddress,
                            userAgent,
                            metadata: { bpCode: normalizedBpCode, affectedInvoices: result.count }
                        });

                    } catch (err: any) {
                        errors.push(`BP Code ${row.bpCode}: ${err.message}`);
                    }
                }
            });
        }

        return res.status(200).json({
            success: true,
            totalProcessed: validRows.length,
            totalImported: masterCreatedCount + masterUpdatedCount,
            masterCreated: masterCreatedCount,
            masterUpdated: masterUpdatedCount,
            totalInvoicesUpdated,
            unmatchedCustomers: [], // In the new system, we don't 'skip' customers anymore
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Import failed',
            error: error.message
        });
    }
};
