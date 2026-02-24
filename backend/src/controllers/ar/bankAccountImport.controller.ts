import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../../config/db';
import {
    logBankAccountActivity,
    getUserFromRequest,
    getIpFromRequest
} from './bankAccountActivityLog.controller';

interface BankAccountImportRow {
    [key: string]: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getValue(row: BankAccountImportRow, ...keys: string[]): any {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return row[key].toString().trim();
        }
    }
    return null;
}

function validateRow(row: BankAccountImportRow, index: number) {
    const errors: { field: string; message: string }[] = [];

    const bpCode = getValue(row, 'BP Code', 'BPCode', 'Customer Code', 'CustomerCode', 'Vendor Code');
    const vendorName = getValue(row, 'Vendor Name', 'VendorName', 'Vendor');
    const bankName = getValue(row, 'Bank Name', 'BankName', 'Bank', 'Beneficiary Bank Name');
    const accountNumber = getValue(row, 'Account Number', 'AccountNumber', 'Account No', 'Account');
    const ifscCode = getValue(row, 'IFSC / SWIFT Code', 'IFSC Code', 'IFSC', 'IFSCCode', 'SWIFT Code', 'SWIFT');

    if (!vendorName) errors.push({ field: 'Vendor Name', message: 'Missing vendor name' });
    if (!bankName) errors.push({ field: 'Bank Name', message: 'Missing bank name' });
    if (!accountNumber) errors.push({ field: 'Account Number', message: 'Missing account number' });
    if (!ifscCode) errors.push({ field: 'IFSC / SWIFT Code', message: 'Missing IFSC / SWIFT code' });

    // MSME logic
    const msmeVal = getValue(row, 'Is MSME', 'MSME', 'isMSME');
    const isMSME = msmeVal === 'TRUE' || msmeVal === 'true' || msmeVal === '1' || msmeVal === 'Yes' || msmeVal === 'YES' || msmeVal === true;
    const udyamRegNum = getValue(row, 'Udyam Registration Number', 'Udyam Reg Num', 'UdyamRegNum', 'MSME Number');
    const currency = getValue(row, 'Currency', 'Curr') || 'INR';
    const gstNumber = getValue(row, 'GST Number', 'GSTNumber', 'GST', 'GSTIN');
    const panNumber = getValue(row, 'PAN Number', 'PANNumber', 'PAN');

    if (isMSME && !udyamRegNum) {
        errors.push({ field: 'Udyam Registration Number', message: 'Udyam number is required for MSME vendors' });
    }

    if (currency === 'INR') {
        if (!gstNumber) errors.push({ field: 'GST Number', message: 'GST number is required for INR transactions' });
        if (!panNumber) errors.push({ field: 'PAN Number', message: 'PAN number is required for INR transactions' });
    }

    return {
        isValid: errors.length === 0,
        errors,
        data: {
            bpCode,
            vendorName,
            beneficiaryBankName: bankName,
            accountNumber,
            ifscCode,
            beneficiaryName: getValue(row, 'Beneficiary Name', 'BeneficiaryName') || vendorName,
            emailId: getValue(row, 'Email', 'EmailId', 'Email ID'),
            nickName: getValue(row, 'Nick Name', 'NickName', 'Alias'),
            gstNumber,
            panNumber,
            accountType: getValue(row, 'Account Type', 'AccountType', 'Type'),
            isMSME,
            udyamRegNum,
            currency
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Preview Excel file for Bank Accounts
 */
export const previewExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: BankAccountImportRow[] = XLSX.utils.sheet_to_json(worksheet);

        if (rows.length === 0) {
            return res.status(400).json({ error: 'Worksheet is empty' });
        }

        const MAX_ROWS = 5000;
        if (rows.length > MAX_ROWS) {
            return res.status(400).json({
                error: 'File too large',
                message: `The file contains ${rows.length} rows, which exceeds the limit of ${MAX_ROWS} per import.`
            });
        }

        const previewData = rows.map((row, index) => {
            const validation = validateRow(row, index);
            const previewRow: any = {
                ...row,
                _rowNumber: index + 2,
                _isValid: validation.isValid,
                _errors: validation.errors,
                _parsed: validation.data
            };
            return previewRow;
        });

        // Check for duplicate account numbers within the file itself
        const accMap = new Map();
        previewData.forEach((row: any) => {
            const acc = row._parsed.accountNumber;
            if (acc) {
                if (accMap.has(acc)) {
                    row._isValid = false;
                    row._errors.push({ field: 'Account Number', message: 'Duplicate account number in file' });
                } else {
                    accMap.set(acc, true);
                }
            }
        });

        // Check against database
        const accountNumbers = previewData.map((r: any) => r._parsed.accountNumber).filter(Boolean);
        const existingAccounts = await prisma.bankAccount.findMany({
            where: { accountNumber: { in: accountNumbers } },
            select: { accountNumber: true }
        });
        const existingSet = new Set(existingAccounts.map((a: { accountNumber: string }) => a.accountNumber));

        previewData.forEach((row: any) => {
            if (existingSet.has(row._parsed.accountNumber)) {
                row._isUpdate = true;
                row._statusText = 'UPDATE';
            } else {
                row._isUpdate = false;
                row._statusText = 'NEW';
            }
        });

        res.json({
            success: true,
            totalRows: rows.length,
            validRows: previewData.filter(r => r._isValid).length,
            invalidRows: previewData.filter(r => !r._isValid).length,
            preview: previewData
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to preview file', message: error.message });
    }
};

/**
 * Bulk Import Bank Accounts
 */
export const importFromExcel = async (req: Request, res: Response) => {
    try {
        const { rows: selectedRows } = req.body;
        const financeUser = (req as any).financeUser;
        const userId = financeUser?.id || (req as any).user?.id || 1;
        const isAdmin = financeUser?.financeRole === 'FINANCE_ADMIN';

        if (!selectedRows || !Array.isArray(selectedRows) || selectedRows.length === 0) {
            return res.status(400).json({ error: 'No valid rows selected for import' });
        }

        const results = await prisma.$transaction(async (tx: any) => {
            const processed = [];
            for (const row of selectedRows) {
                if (isAdmin) {
                    // Direct Import as Admin
                    const account = await tx.bankAccount.upsert({
                        where: { accountNumber: row.accountNumber },
                        create: {
                            bpCode: row.bpCode || null,
                            vendorName: row.vendorName,
                            beneficiaryBankName: row.beneficiaryBankName,
                            accountNumber: row.accountNumber,
                            ifscCode: row.ifscCode,
                            beneficiaryName: row.beneficiaryName || row.vendorName,
                            emailId: row.emailId || null,
                            nickName: row.nickName || null,
                            gstNumber: row.gstNumber || null,
                            panNumber: row.panNumber || null,
                            accountType: row.accountType || null,
                            isMSME: row.isMSME || false,
                            udyamRegNum: row.udyamRegNum || null,
                            currency: row.currency || 'INR',
                            createdById: userId,
                            updatedById: userId
                        },
                        update: {
                            bpCode: row.bpCode || null,
                            vendorName: row.vendorName,
                            beneficiaryBankName: row.beneficiaryBankName,
                            ifscCode: row.ifscCode,
                            beneficiaryName: row.beneficiaryName || row.vendorName,
                            emailId: row.emailId || null,
                            nickName: row.nickName || null,
                            gstNumber: row.gstNumber || null,
                            panNumber: row.panNumber || null,
                            accountType: row.accountType || null,
                            isMSME: row.isMSME || false,
                            udyamRegNum: row.udyamRegNum || null,
                            currency: row.currency || 'INR',
                            updatedById: userId
                        }
                    });
                    processed.push(account);
                } else {
                    // Create Request for approval for Finance User
                    const existingAccount = await tx.bankAccount.findUnique({
                        where: { accountNumber: row.accountNumber }
                    });

                    const request = await tx.bankAccountChangeRequest.create({
                        data: {
                            bankAccountId: existingAccount?.id || null,
                            requestType: existingAccount ? 'UPDATE' : 'CREATE',
                            status: 'PENDING',
                            requestedData: row,
                            requestedById: userId,
                            requestedAt: new Date()
                        }
                    });
                    processed.push(request);
                }
            }
            return processed;
        });

        // Log activities after successful transaction
        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        for (let i = 0; i < results.length; i++) {
            const item = results[i];
            const row = selectedRows[i];

            if (isAdmin) {
                await logBankAccountActivity({
                    bankAccountId: item.id,
                    action: 'BANK_ACCOUNT_CREATED',
                    description: `Directly imported vendor bank account for: ${row.vendorName}`,
                    performedById: user.id,
                    performedBy: user.name,
                    ipAddress,
                    userAgent,
                    metadata: { accountNumber: row.accountNumber, isBulk: true }
                });
            } else {
                await logBankAccountActivity({
                    bankAccountId: item.bankAccountId || null,
                    action: 'CHANGE_REQUEST_CREATED',
                    description: `Change request (${item.requestType}) created via bulk import for: ${row.vendorName || 'Unknown'}`,
                    performedById: user.id,
                    performedBy: user.name,
                    ipAddress,
                    userAgent,
                    metadata: { requestId: item.id, requestType: item.requestType, isBulk: true }
                });
            }
        }

        res.json({
            success: true,
            message: isAdmin
                ? `Successfully processed ${results.length} vendor accounts (Add/Update)`
                : `Successfully submitted ${results.length} accounts for admin approval`,
            count: results.length,
            isRequest: !isAdmin
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Import failed during processing', message: error.message });
    }
};

/**
 * Download Template
 */
export const downloadTemplate = async (req: Request, res: Response) => {
    try {
        const headers = [
            'BP Code',
            'Vendor Name',
            'Nick Name',
            'Email',
            'Is MSME',
            'Udyam Registration Number',
            'Currency',
            'Account Type',
            'GST Number',
            'PAN Number',
            'Bank Name',
            'Beneficiary Name',
            'Account Number',
            'IFSC / SWIFT Code'
        ];

        const sampleData: any[][] = []; // Keep it empty as per previous request "dummy data not included"

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

        // Column widths
        worksheet['!cols'] = [
            { wch: 15 }, // BP Code
            { wch: 25 }, // Vendor Name
            { wch: 15 }, // Nick Name
            { wch: 25 }, // Email
            { wch: 10 }, // Is MSME
            { wch: 25 }, // Udyam Registration Number
            { wch: 10 }, // Currency
            { wch: 15 }, // Account Type
            { wch: 20 }, // GST Number
            { wch: 15 }, // PAN Number
            { wch: 25 }, // Bank Name
            { wch: 25 }, // Beneficiary Name
            { wch: 20 }, // Account Number
            { wch: 15 }  // IFSC / SWIFT Code
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendor Accounts Template');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Vendor_Accounts_Import_Template.xlsx"');
        res.send(buffer);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate template' });
    }
};
