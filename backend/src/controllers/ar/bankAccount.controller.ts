import { Request, Response } from 'express';
import prisma from '../../config/db';
import {
    logBankAccountActivity,
    logBankAccountFieldChanges,
    getUserFromRequest,
    getIpFromRequest
} from './bankAccountActivityLog.controller';

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT CRUD OPERATIONS
// Only FINANCE_ADMIN can directly create/update/delete
// FINANCE_USER can only view and must use change requests
// ═══════════════════════════════════════════════════════════════════════════

// Get all bank accounts
export const getAllBankAccounts = async (req: Request, res: Response) => {
    try {
        const { search, activeOnly } = req.query;

        const where: any = {};

        if (activeOnly === 'true') {
            where.isActive = true;
        }

        if (search) {
            where.OR = [
                { vendorName: { contains: String(search), mode: 'insensitive' } },
                { bpCode: { contains: String(search), mode: 'insensitive' } },
                { beneficiaryName: { contains: String(search), mode: 'insensitive' } },
                { nickName: { contains: String(search), mode: 'insensitive' } },
                { accountNumber: { contains: String(search), mode: 'insensitive' } },
                { beneficiaryBankName: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const accounts = await prisma.bankAccount.findMany({
            where,
            orderBy: { vendorName: 'asc' },
            select: {
                id: true,
                bpCode: true,
                vendorName: true,
                beneficiaryBankName: true,
                beneficiaryName: true,
                nickName: true,
                accountNumber: true,
                ifscCode: true,
                emailId: true,
                currency: true,
                accountType: true,
                isActive: true,
                isMSME: true,
                panNumber: true,
                gstNumber: true,
                attachments: {
                    select: { id: true }
                },
                _count: {
                    select: { changeRequests: true }
                }
            }
        });

        res.json(accounts);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch bank accounts', message: error.message });
    }
};

// Get bank account by ID
export const getBankAccountById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const account = await prisma.bankAccount.findUnique({
            where: { id },
            include: {
                attachments: true,
                changeRequests: {
                    orderBy: { requestedAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!account) {
            return res.status(404).json({ error: 'Bank account not found' });
        }

        res.json(account);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch bank account', message: error.message });
    }
};

// Create bank account (FINANCE_ADMIN only)
export const createBankAccount = async (req: Request, res: Response) => {
    try {
        const { bpCode, vendorName, beneficiaryBankName, beneficiaryName, accountNumber, ifscCode, emailId, nickName, gstNumber, panNumber, accountType, accountCategory } = req.body;
        const userId = (req as any).user?.id || 1; // Get from auth context

        // Validate required fields
        if (!vendorName || !beneficiaryBankName || !accountNumber || !ifscCode || !accountType) {
            return res.status(400).json({
                error: 'Vendor Name, Beneficiary Bank Name, Account Number, IFSC Code, and Account Type are required'
            });
        }

        // Smart Mandatory Validation for GST/PAN (only for non-International with INR)
        const currency = req.body.currency || 'INR';
        const category = accountCategory || 'DOMESTIC';
        if (currency === 'INR' && category !== 'INTERNATIONAL') {
            if (req.body.isGstRegistered !== false && !gstNumber) {
                return res.status(400).json({ error: 'GST Number is required for INR transactions' });
            }
            if (!panNumber) {
                return res.status(400).json({ error: 'PAN Number is required for INR transactions' });
            }
        }

        // Check for duplicate account number
        const existing = await prisma.bankAccount.findUnique({
            where: { accountNumber }
        });

        if (existing) {
            return res.status(400).json({ error: 'An account with this account number already exists' });
        }

        const account = await prisma.bankAccount.create({
            data: {
                bpCode: bpCode || null,
                vendorName,
                beneficiaryBankName,
                beneficiaryName: beneficiaryName || vendorName, // Default to vendorName if not provided
                accountNumber,
                ifscCode,
                emailId: emailId || null,
                nickName: nickName || null,
                gstNumber: gstNumber || null,
                panNumber: panNumber || null,
                isMSME: req.body.isMSME || false,
                udyamRegNum: req.body.isMSME ? req.body.udyamRegNum : null,
                currency: req.body.currency || 'INR',
                accountType: accountType || null,
                accountCategory: category,
                createdById: userId,
                updatedById: userId
            }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logBankAccountActivity({
            bankAccountId: account.id,
            action: 'BANK_ACCOUNT_CREATED',
            description: `Bank account created for vendor: ${vendorName}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { accountNumber, beneficiaryBankName }
        });

        res.status(201).json(account);
    } catch (error: any) {

        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Account number already exists' });
        }
        res.status(500).json({ error: 'Failed to create bank account', message: error.message });
    }
};

// Update bank account (FINANCE_ADMIN only)
export const updateBankAccount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 1;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.createdById;
        delete updateData.createdAt;
        delete updateData.isGstRegistered;

        // Check if account exists
        const existing = await prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Bank account not found' });
        }

        // Check for duplicate account number if being updated
        if (updateData.accountNumber && updateData.accountNumber !== existing.accountNumber) {
            const duplicate = await prisma.bankAccount.findUnique({
                where: { accountNumber: updateData.accountNumber }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'Account number already exists' });
            }
        }

        const account = await prisma.bankAccount.update({
            where: { id },
            data: {
                ...updateData,
                updatedById: userId
            }
        });

        // Log field changes
        const fieldsToTrack = [
            'bpCode', 'vendorName', 'beneficiaryBankName', 'beneficiaryName', 'accountNumber',
            'ifscCode', 'emailId', 'nickName', 'gstNumber', 'panNumber',
            'isMSME', 'udyamRegNum', 'currency', 'accountType', 'accountCategory', 'isActive'
        ];
        await logBankAccountFieldChanges(id, existing, account, req, fieldsToTrack);

        res.json(account);
    } catch (error: any) {

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Bank account not found' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Account number already exists' });
        }
        res.status(500).json({ error: 'Failed to update bank account', message: error.message });
    }
};

// Delete bank account (soft delete - FINANCE_ADMIN only)
export const deleteBankAccount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id || 1;

        const existing = await prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Bank account not found' });
        }

        // Soft delete by setting isActive to false
        const account = await prisma.bankAccount.update({
            where: { id },
            data: {
                isActive: false,
                updatedById: userId
            }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logBankAccountActivity({
            bankAccountId: id,
            action: 'BANK_ACCOUNT_DEACTIVATED',
            description: `Bank account deactivated for vendor: ${existing.vendorName}`,
            fieldName: 'isActive',
            oldValue: 'true',
            newValue: 'false',
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null
        });

        res.json({ message: 'Bank account deleted successfully', account });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to delete bank account', message: error.message });
    }
};

// Hard delete (permanent - FINANCE_ADMIN only)
export const permanentDeleteBankAccount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get existing data before delete for logging
        const existing = await prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Bank account not found' });
        }

        await prisma.bankAccount.delete({
            where: { id }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logBankAccountActivity({
            bankAccountId: id,
            action: 'BANK_ACCOUNT_DELETED',
            description: `Bank account permanently deleted for vendor: ${existing.vendorName}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { vendorName: existing.vendorName, accountNumber: existing.accountNumber }
        });

        res.json({ message: 'Bank account permanently deleted' });
    } catch (error: any) {

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Bank account not found' });
        }
        res.status(500).json({ error: 'Failed to delete bank account', message: error.message });
    }
};
