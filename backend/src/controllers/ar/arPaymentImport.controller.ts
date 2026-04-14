import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/db';
import { logInvoiceActivity, getUserFromRequest, getIpFromRequest } from './arActivityLog.controller';
import { format } from 'date-fns';

/**
 * FIXED EXCEL TEMPLATE STRUCTURE
 * A: Invoice No (invoiceNumber)
 * B: Payment Amount (amount)
 * C: Payment Date (paymentDate)
 * D: Payment Mode (paymentMode)
 * E: Reference Bank (referenceBank)
 * F: Notes (notes)
 */

const PAYMENT_MODES = ['RECEIPT', 'TDS', 'LD', 'OTHER', 'NEFT', 'RTGS', 'CHEQUE', 'CASH', 'ADJUSTMENT', 'CREDIT_NOTE'];

/**
 * Parse Numeric value from Excel (stripping commas)
 */
const parseNumeric = (val: any) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

/**
 * Parse Excel Date to JS Date
 */
const parseExcelDate = (val: any) => {
    if (!val) return null;
    if (val instanceof Date) return val;

    // Handle string dates
    if (typeof val === 'string') {
        const cleaned = val.trim();
        if (!cleaned) return null;

        // Try YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
            const date = new Date(cleaned);
            if (!isNaN(date.getTime())) return date;
        }

        // Try DD/MM/YYYY or DD-MM-YYYY
        const parts = cleaned.split(/[/-]/);
        if (parts.length === 3) {
            let day, month, year;
            if (parts[0].length === 4) { // YYYY-MM-DD
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10);
            } else { // DD-MM-YYYY
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
            }
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }
    }

    // Handle Excel serial numbers
    if (typeof val === 'number') {
        // Excel base date is Dec 30, 1899
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) return date;
    }

    return null;
};

/**
 * Preview Payment Import
 */
export const previewPaymentExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Use buffer instead of path because multer uses memoryStorage in routes/ar/index.ts
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' }) as any[];

        // Remove header row (row 1)
        const rows = jsonData.slice(1);

        const previewRows = [];
        const invoiceNumbers = new Set(rows.map(r => String(r.A || '').trim()).filter(Boolean));

        // Batch fetch invoices for performance
        const matchedInvoices = await prisma.aRInvoice.findMany({
            where: {
                invoiceNumber: { in: Array.from(invoiceNumbers) },
                invoiceType: 'REGULAR'
            }
        });

        const invoiceMap = new Map();
        matchedInvoices.forEach(inv => {
            invoiceMap.set(inv.invoiceNumber, inv);
        });

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const invoiceNo = String(row.A || '').trim();
            const amount = parseNumeric(row.B);
            const paymentDateRaw = row.C;
            const paymentMode = String(row.D || '').toUpperCase().trim();
            const referenceBank = String(row.E || '').trim();
            const notes = String(row.F || '').trim();

            const parsedDate = parseExcelDate(paymentDateRaw);
            const invoice = invoiceMap.get(invoiceNo);

            const errors = [];
            const warnings = [];

            if (!invoiceNo) errors.push('Invoice Number is missing');
            else if (!invoice) errors.push(`Invoice "${invoiceNo}" not found`);

            if (isNaN(amount) || amount <= 0) errors.push('Invalid amount');
            if (!parsedDate) errors.push('Invalid date format (Expect DD/MM/YYYY)');
            if (!paymentMode) errors.push('Payment mode is missing');
            else if (!PAYMENT_MODES.includes(paymentMode)) errors.push(`Invalid mode: ${paymentMode}`);

            if (invoice && amount > Number(invoice.balance || 0) + 1) { // 1 rupee buffer for rounding
                warnings.push(`Payment (₹${amount}) exceeds remaining balance (₹${Number(invoice.balance || 0)})`);
            }

            previewRows.push({
                index: i + 2, // Excel row number (1-indexed + header)
                invoiceNo,
                amount,
                paymentDate: parsedDate,
                paymentMode,
                referenceBank,
                notes,
                customerName: invoice?.customerName || 'N/A',
                currentBalance: invoice ? Number(invoice.balance || 0) : 0,
                isValid: errors.length === 0,
                errors,
                warnings
            });
        }

        res.json({
            rows: previewRows,
            summary: {
                totalRows: previewRows.length,
                validRows: previewRows.filter(r => r.isValid).length,
                invalidRows: previewRows.filter(r => !r.isValid).length,
                totalAmount: previewRows.filter(r => r.isValid).reduce((sum, r) => sum + r.amount, 0)
            }
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to preview Excel file', message: error.message });
    }
};

/**
 * Import Payment Excel
 */
export const importPaymentExcel = async (req: Request, res: Response) => {
    try {
        const { rows, selectedIndices } = req.body;

        if (!rows || !Array.isArray(rows)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        const filteredRows = selectedIndices && selectedIndices.length > 0
            ? rows.filter(r => selectedIndices.includes(r.index) && r.isValid)
            : rows.filter(r => r.isValid);

        if (filteredRows.length === 0) {
            return res.status(400).json({ error: 'No valid rows selected for import' });
        }

        const user = getUserFromRequest(req);
        const recordedBy = user.name || 'System';
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const results = await prisma.$transaction(async (tx) => {
            const importResults = [];
            const affectedInvoiceIds = new Set<string>();

            // Process each payment
            for (const row of filteredRows) {
                // Find invoice again inside transaction to be safe
                const invoice = await tx.aRInvoice.findFirst({
                    where: { invoiceNumber: row.invoiceNo, invoiceType: 'REGULAR' }
                });

                if (!invoice) continue;

                // Create payment record
                await tx.aRPaymentHistory.create({
                    data: {
                        invoiceId: invoice.id,
                        amount: row.amount,
                        paymentDate: new Date(row.paymentDate),
                        paymentMode: row.paymentMode,
                        referenceBank: row.referenceBank || null,
                        notes: row.notes || null,
                        recordedBy
                    }
                });

                affectedInvoiceIds.add(invoice.id);
                importResults.push({ invoiceNo: row.invoiceNo, amount: row.amount });
            }

            // Recalculate all affected invoices
            for (const invoiceId of affectedInvoiceIds) {
                const invoice = await tx.aRInvoice.findUnique({ where: { id: invoiceId } });
                if (!invoice) continue;

                const allPayments = await tx.aRPaymentHistory.findMany({
                    where: { invoiceId }
                });

                let newReceipts = 0;
                let newAdjustments = 0;
                allPayments.forEach((p: any) => {
                    const amt = Number(p.amount);
                    const mode = (p.paymentMode || '').toUpperCase();
                    if (mode === 'ADJUSTMENT' || mode === 'CREDIT_NOTE' || mode === 'TDS' || mode === 'LD') {
                        newAdjustments += amt;
                    } else {
                        newReceipts += amt;
                    }
                });

                const totalReceipts = newReceipts + newAdjustments;
                const balance = Number(invoice.totalAmount) - totalReceipts;

                let status = invoice.status;
                if (invoice.status !== 'CANCELLED') {
                    if (balance <= 0 && totalReceipts > 0) status = 'PAID';
                    else if (totalReceipts > 0) status = 'PARTIAL';
                    else status = 'PENDING';
                }

                await tx.aRInvoice.update({
                    where: { id: invoiceId },
                    data: {
                        receipts: newReceipts,
                        adjustments: newAdjustments,
                        totalReceipts,
                        balance,
                        status
                    }
                });

                // Log activity
                await logInvoiceActivity({
                    invoiceId,
                    action: 'BULK_PAYMENT_IMPORTED',
                    description: `Payment of ₹${filteredRows.find(r => r.invoiceNo === invoice.invoiceNumber)?.amount.toLocaleString()} imported via bulk Excel`,
                    performedById: user.id,
                    performedBy: user.name,
                    ipAddress,
                    userAgent,
                    metadata: { batchImport: true, count: filteredRows.length }
                });
            }

            return { count: importResults.length, items: importResults };
        });

        res.json({
            success: true,
            message: `Successfully imported ${results.count} payments`,
            count: results.count
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to import payments', message: error.message });
    }
};

/**
 * Download Fixed Template
 */
export const downloadPaymentTemplate = async (req: Request, res: Response) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Payment Import');

        // Style the header
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } } as ExcelJS.Fill,
            alignment: { horizontal: 'center' } as ExcelJS.Alignment,
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            } as ExcelJS.Borders
        };

        const headers = [
            'Invoice No (Doc. No.)',
            'Payment Amount',
            'Payment Date (DD/MM/YYYY)',
            'Payment Mode',
            'Reference Bank',
            'Notes'
        ];

        sheet.addRow(headers);
        sheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle as any;
        });

        // Add sample row
        sheet.addRow([
            '900123456',
            150000,
            format(new Date(), 'dd/MM/yyyy'),
            'NEFT',
            'HDFC',
            'Weekly batch payment'
        ]);

        // Add validations (DROPDOWN for mode)
        for (let i = 2; i <= 1000; i++) {
            sheet.getCell(`D${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`"Receipt,TDS,LD,Other,NEFT,RTGS,Cheque,Cash"`]
            };

            // Format column B as currency/number
            sheet.getCell(`B${i}`).numFmt = '#,##0.00';

            // Format column C as date
            sheet.getCell(`C${i}`).numFmt = 'dd/mm/yyyy';
        }

        // Column widths
        sheet.columns = [
            { width: 20 }, // Invoice No
            { width: 15 }, // Amount
            { width: 25 }, // Date
            { width: 15 }, // Mode
            { width: 20 }, // Bank
            { width: 30 }, // Notes
        ];

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Payment_Import_Template.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate template', message: error.message });
    }
};
