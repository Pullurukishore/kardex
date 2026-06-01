import { Request, Response } from 'express';
import prisma from '../../config/db';
import {
    logBankAccountActivity,
    logBankAccountFieldChanges,
    getUserFromRequest,
    getIpFromRequest
} from './bankAccountActivityLog.controller';

/**
 * Helper to check if an account number or additional account numbers are already in use
 * in any existing bank accounts.
 */
export const checkAccountNumberUnique = async (
    accountNumber: string,
    otherAccountNumbers: string[],
    ignoreId?: string
) => {
    const mainAcc = (accountNumber || '').trim();
    if (!mainAcc) {
        return { unique: false, error: 'Account number is required' };
    }

    const otherAccs = (otherAccountNumbers || [])
        .map(a => (a || '').trim())
        .filter(Boolean)
        .map(a => a.includes('|') ? a.split('|')[0].trim() : a);

    // Check internal duplicate (main vs others)
    if (otherAccs.includes(mainAcc)) {
        return { unique: false, error: `Additional account numbers cannot contain the primary account number` };
    }

    // Check internal duplicates (within others)
    const uniqueOthers = new Set(otherAccs);
    if (uniqueOthers.size !== otherAccs.length) {
        return { unique: false, error: `Duplicate account numbers found in the additional account numbers list` };
    }

    // Determine all account IDs to exclude (primary + all secondary accounts of this vendor)
    let excludeIds: string[] = [];
    if (ignoreId) {
        excludeIds.push(ignoreId);
        const existing = await prisma.bankAccount.findUnique({
            where: { id: ignoreId },
            select: { id: true, parentAccountId: true }
        });
        if (existing) {
            const parentId = existing.parentAccountId || existing.id;
            excludeIds.push(parentId);
            const secondaries = await prisma.bankAccount.findMany({
                where: { parentAccountId: parentId },
                select: { id: true }
            });
            excludeIds.push(...secondaries.map((s: { id: string }) => s.id));
        }
    }
    const uniqueExcludeIds = Array.from(new Set(excludeIds));

    // Fetch all accounts to check uniqueness (handles pipe-separated encoded account numbers)
    const accounts = await prisma.bankAccount.findMany({
        where: {
            id: uniqueExcludeIds.length > 0 ? { notIn: uniqueExcludeIds } : undefined
        },
        select: {
            id: true,
            accountNumber: true,
            otherAccountNumbers: true
        }
    });

    for (const acc of accounts) {
        const accMain = acc.accountNumber.trim();
        const accOthers = acc.otherAccountNumbers.map((a: string) => a.includes('|') ? a.split('|')[0].trim() : a.trim());

        // 1. Check if our main account number is used as primary or secondary elsewhere
        if (accMain === mainAcc) {
            return { unique: false, error: `Account number ${mainAcc} is already in use as a primary account number` };
        }
        if (accOthers.includes(mainAcc)) {
            return { unique: false, error: `Account number ${mainAcc} is already in use as an additional account number` };
        }

        // 2. Check if any of our secondary account numbers are used as primary or secondary elsewhere
        for (const otherAcc of otherAccs) {
            if (accMain === otherAcc) {
                return { unique: false, error: `Account number ${otherAcc} is already in use as a primary account number` };
            }
            if (accOthers.includes(otherAcc)) {
                return { unique: false, error: `Account number ${otherAcc} is already in use as an additional account number` };
            }
        }
    }

    return { unique: true };
};

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT CRUD OPERATIONS
// Only FINANCE_ADMIN can directly create/update/delete
// FINANCE_USER can only view and must use change requests
// ═══════════════════════════════════════════════════════════════════════════

// Get all bank accounts
export const getAllBankAccounts = async (req: Request, res: Response) => {
    try {
        const { search, activeOnly, isPrimary } = req.query;

        const where: any = {};

        if (activeOnly === 'true') {
            where.isActive = true;
        }

        if (isPrimary !== undefined) {
            where.isPrimary = isPrimary === 'true';
        } else {
            where.isPrimary = true; // Default to only showing primary bank accounts in main lists
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
                otherAccountNumbers: true,
                ifscCode: true,
                emailId: true,
                currency: true,
                accountType: true,
                isActive: true,
                isMSME: true,
                panNumber: true,
                gstNumber: true,
                isPrimary: true,
                parentAccountId: true,
                attachments: {
                    select: { id: true }
                },
                _count: {
                    select: {
                        changeRequests: true,
                        secondaryAccounts: true
                    }
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
                },
                secondaryAccounts: {
                    where: { isActive: true },
                    include: { attachments: true }
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
        const {
            bpCode,
            vendorName,
            beneficiaryBankName,
            beneficiaryName,
            accountNumber,
            ifscCode,
            emailId,
            nickName,
            gstNumber,
            panNumber,
            accountType,
            accountCategory,
            otherAccountNumbers,
            parentAccountId
        } = req.body;
        const userId = (req as any).user?.id || 1; // Get from auth context

        let isPrimary = req.body.isPrimary !== undefined ? req.body.isPrimary : true;
        let finalBpCode = bpCode || null;
        let finalVendorName = vendorName;
        let finalGstNumber = gstNumber || null;
        let finalPanNumber = panNumber || null;
        let finalIsMSME = req.body.isMSME || false;
        let finalUdyamRegNum = req.body.isMSME ? req.body.udyamRegNum : null;

        // If parentAccountId is provided, this is a secondary account
        if (parentAccountId) {
            isPrimary = false;
            // Fetch parent account to verify it exists and inherit vendor details
            const parent = await prisma.bankAccount.findUnique({ where: { id: parentAccountId } });
            if (!parent) {
                return res.status(404).json({ error: 'Primary bank account not found' });
            }
            if (!parent.isPrimary) {
                return res.status(400).json({ error: 'Parent bank account must be a primary bank account' });
            }
            // Inherit fields from parent if not explicitly provided
            finalBpCode = bpCode || parent.bpCode;
            finalVendorName = vendorName || parent.vendorName;
            finalGstNumber = gstNumber || parent.gstNumber;
            finalPanNumber = panNumber || parent.panNumber;
            finalIsMSME = req.body.isMSME !== undefined ? req.body.isMSME : parent.isMSME;
            finalUdyamRegNum = req.body.isMSME ? req.body.udyamRegNum : (parent.isMSME ? parent.udyamRegNum : null);
        }

        // Validate required fields
        if (!finalVendorName || !beneficiaryBankName || !accountNumber || !ifscCode || !accountType) {
            return res.status(400).json({
                error: 'Vendor Name, Beneficiary Bank Name, Account Number, IFSC Code, and Account Type are required'
            });
        }

        // Smart Mandatory Validation for GST/PAN (only for primary, non-International with INR)
        const currency = req.body.currency || 'INR';
        const category = accountCategory || 'DOMESTIC';
        if (isPrimary && currency === 'INR' && category !== 'INTERNATIONAL') {
            if (req.body.isGstRegistered !== false && !finalGstNumber) {
                return res.status(400).json({ error: 'GST Number is required for INR transactions' });
            }
            if (!finalPanNumber) {
                return res.status(400).json({ error: 'PAN Number is required for INR transactions' });
            }
        }

        // Check for duplicate account number
        const uniquenessCheck = await checkAccountNumberUnique(accountNumber, otherAccountNumbers || []);
        if (!uniquenessCheck.unique) {
            return res.status(400).json({ error: uniquenessCheck.error });
        }

        const account = await prisma.bankAccount.create({
            data: {
                bpCode: finalBpCode,
                vendorName: finalVendorName,
                beneficiaryBankName,
                beneficiaryName: beneficiaryName || finalVendorName, // Default to vendorName if not provided
                accountNumber,
                ifscCode,
                emailId: emailId || null,
                nickName: nickName || null,
                gstNumber: finalGstNumber,
                panNumber: finalPanNumber,
                isMSME: finalIsMSME,
                udyamRegNum: finalUdyamRegNum,
                currency: req.body.currency || 'INR',
                accountType: accountType || null,
                accountCategory: category,
                otherAccountNumbers: otherAccountNumbers || [],
                isPrimary,
                parentAccountId: parentAccountId || null,
                createdById: userId,
                updatedById: userId
            }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logBankAccountActivity({
            bankAccountId: account.id,
            action: 'BANK_ACCOUNT_CREATED',
            description: `Bank account created for vendor: ${finalVendorName} (${isPrimary ? 'Primary' : 'Secondary'})`,
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

        // Prevent isPrimary change if it has secondaries
        if (updateData.isPrimary === false && existing.isPrimary === true) {
            const secondariesCount = await prisma.bankAccount.count({
                where: { parentAccountId: id }
            });
            if (secondariesCount > 0) {
                return res.status(400).json({
                    error: 'Cannot convert a primary bank account with secondary accounts into a secondary account.'
                });
            }
        }

        // Validate uniqueness if accountNumber or otherAccountNumbers is being updated
        const targetAccountNumber = updateData.accountNumber !== undefined ? updateData.accountNumber : existing.accountNumber;
        const targetOtherAccountNumbers = updateData.otherAccountNumbers !== undefined ? updateData.otherAccountNumbers : existing.otherAccountNumbers;

        if (updateData.accountNumber !== undefined || updateData.otherAccountNumbers !== undefined) {
            const uniquenessCheck = await checkAccountNumberUnique(targetAccountNumber, targetOtherAccountNumbers, id);
            if (!uniquenessCheck.unique) {
                return res.status(400).json({ error: uniquenessCheck.error });
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
            'isMSME', 'udyamRegNum', 'currency', 'accountType', 'accountCategory', 'isActive',
            'otherAccountNumbers', 'isPrimary', 'parentAccountId'
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

// Get secondary accounts for a primary bank account
export const getSecondaryAccounts = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const primary = await prisma.bankAccount.findUnique({ where: { id } });
        if (!primary) {
            return res.status(404).json({ error: 'Primary bank account not found' });
        }

        const secondaries = await prisma.bankAccount.findMany({
            where: {
                parentAccountId: id,
                isActive: true
            },
            include: {
                attachments: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(secondaries);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch secondary bank accounts', message: error.message });
    }
};
