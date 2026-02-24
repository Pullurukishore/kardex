import { Request, Response } from 'express';
import prisma from '../../config/db';
import { sendEmail } from '../../utils/email';
import {
    logBankAccountActivity,
    getUserFromRequest,
    getIpFromRequest
} from './bankAccountActivityLog.controller';

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT CHANGE REQUEST OPERATIONS
// FINANCE_USER submits change requests
// FINANCE_ADMIN approves/rejects requests
// ═══════════════════════════════════════════════════════════════════════════

// Create a change request (FINANCE_USER)
export const createChangeRequest = async (req: Request, res: Response) => {
    try {
        const { bankAccountId, requestType, requestedData } = req.body;
        const userId = (req as any).user?.id || 1;

        // Validate request type
        if (!['CREATE', 'UPDATE', 'DELETE'].includes(requestType)) {
            return res.status(400).json({ error: 'Invalid request type. Must be CREATE, UPDATE, or DELETE' });
        }

        // For UPDATE and DELETE, bankAccountId is required
        if ((requestType === 'UPDATE' || requestType === 'DELETE') && !bankAccountId) {
            return res.status(400).json({ error: 'Bank account ID is required for UPDATE and DELETE requests' });
        }

        // For CREATE, validate required fields in requestedData
        if (requestType === 'CREATE') {
            const { vendorName, beneficiaryBankName, accountNumber, ifscCode } = requestedData || {};
            if (!vendorName || !beneficiaryBankName || !accountNumber || !ifscCode) {
                return res.status(400).json({
                    error: 'Vendor Name, Beneficiary Bank Name, Account Number, and IFSC Code are required'
                });
            }

            // Smart Mandatory Validation for GST/PAN (only for non-International with INR)
            const currency = requestedData?.currency || 'INR';
            const category = requestedData?.accountCategory || 'DOMESTIC';
            if (currency === 'INR' && category !== 'INTERNATIONAL') {
                if (!requestedData?.gstNumber) {
                    return res.status(400).json({ error: 'GST Number is required for INR transactions' });
                }
                if (!requestedData?.panNumber) {
                    return res.status(400).json({ error: 'PAN Number is required for INR transactions' });
                }
            }

            // Validate MSME/Udyam
            if (requestedData?.isMSME && !requestedData?.udyamRegNum) {
                return res.status(400).json({ error: 'Udyam Registration Number is required for MSME vendors' });
            }

            // Check if account number already exists
            const existing = await prisma.bankAccount.findUnique({
                where: { accountNumber }
            });
            if (existing) {
                return res.status(400).json({ error: 'An account with this account number already exists' });
            }
        }

        // For UPDATE/DELETE, verify the bank account exists
        if (bankAccountId) {
            const bankAccount = await prisma.bankAccount.findUnique({
                where: { id: bankAccountId }
            });
            if (!bankAccount) {
                return res.status(404).json({ error: 'Bank account not found' });
            }
        }

        // Check for existing pending request for the same account and type
        if (bankAccountId) {
            const existingRequest = await prisma.bankAccountChangeRequest.findFirst({
                where: {
                    bankAccountId,
                    requestType: requestType as any,
                    status: 'PENDING'
                }
            });
            if (existingRequest) {
                return res.status(400).json({
                    error: 'A pending request already exists for this account',
                    existingRequestId: existingRequest.id
                });
            }
        }

        const changeRequest = await prisma.bankAccountChangeRequest.create({
            data: {
                bankAccountId: bankAccountId || null,
                requestType: requestType as any,
                requestedData: requestedData || {},
                requestedById: userId
            },
            include: {
                bankAccount: true
            }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logBankAccountActivity({
            bankAccountId: bankAccountId || null,
            action: 'CHANGE_REQUEST_CREATED',
            description: `Change request (${requestType}) created${changeRequest.bankAccount ? ` for: ${changeRequest.bankAccount.vendorName}` : ` for new vendor: ${requestedData?.vendorName || 'Unknown'}`}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { requestId: changeRequest.id, requestType }
        });

        // ── Email: Notify all FINANCE_ADMINs about the new request ──
        try {
            const admins = await prisma.user.findMany({
                where: { financeRole: 'FINANCE_ADMIN', isActive: true },
                select: { email: true, name: true }
            });
            const requester = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, email: true }
            });
            const typeLabel = requestType === 'CREATE' ? 'Add'
                : requestType === 'UPDATE' ? 'Edit' : 'Delete';
            const vendorName = requestedData?.vendorName
                || changeRequest.bankAccount?.vendorName
                || 'Unknown';

            for (const admin of admins) {
                await sendEmail({
                    to: admin.email,
                    subject: `[Action Required] Vendor ${typeLabel} Request – ${vendorName}`,
                    template: 'vendor-request',
                    context: {
                        adminName: admin.name || 'Admin',
                        requestType: typeLabel,
                        vendorName,
                        requestedBy: requester?.name || 'Unknown',
                        requestedByEmail: requester?.email || '',
                        requestedAt: new Date().toLocaleString('en-IN'),
                        isAdd: requestType === 'CREATE',
                        isEdit: requestType === 'UPDATE',
                        isDelete: requestType === 'DELETE',
                        actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/finance/bank-accounts/requests`,
                        currentYear: new Date().getFullYear()
                    }
                });
            }
        } catch (emailError) {
            // Email failure should not break the request
            console.error('[Email] Failed to send vendor request notification:', emailError);
        }

        res.status(201).json(changeRequest);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to create change request', message: error.message });
    }
};

// Get all pending requests (FINANCE_ADMIN)
export const getPendingRequests = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        const where: any = {};
        const statusFilter = Array.isArray(status) ? status[0] : status;

        if (!statusFilter) {
            // Default behaviour: only pending requests
            where.status = 'PENDING';
        } else if (statusFilter !== 'ALL') {
            // Explicit status filter: PENDING / APPROVED / REJECTED
            where.status = statusFilter;
        }

        const requests = await prisma.bankAccountChangeRequest.findMany({
            where,
            orderBy: { requestedAt: 'desc' },
            select: {
                id: true,
                requestType: true,
                status: true,
                requestedAt: true,
                requestedById: true,
                requestedData: true,
                reviewNotes: true,
                bankAccount: {
                    select: {
                        id: true,
                        vendorName: true,
                        accountNumber: true
                    }
                }
            }
        });

        // Enrich with user names
        const userIds = [...new Set(requests.map((r: any) => r.requestedById).filter(Boolean))] as number[];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true }
        });
        const userMap = new Map(users.map((u: { id: number; name: string | null; email: string }) => [u.id, u]));

        const enrichedRequests = requests.map((r: any) => ({
            ...r,
            requestedBy: userMap.get(r.requestedById) || null
        }));

        res.json(enrichedRequests);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch pending requests', message: error.message });
    }
};

// Get user's own requests (FINANCE_USER)
export const getMyRequests = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || 1;

        const requests = await prisma.bankAccountChangeRequest.findMany({
            where: { requestedById: userId },
            orderBy: { requestedAt: 'desc' },
            select: {
                id: true,
                requestType: true,
                status: true,
                requestedAt: true,
                requestedData: true,
                reviewNotes: true,
                bankAccount: {
                    select: {
                        id: true,
                        vendorName: true,
                        accountNumber: true
                    }
                }
            }
        });

        res.json(requests);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch requests', message: error.message });
    }
};

// Get request by ID
export const getRequestById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const request = await prisma.bankAccountChangeRequest.findUnique({
            where: { id },
            include: {
                bankAccount: true,
                attachments: {
                    include: {
                        uploadedBy: { select: { id: true, name: true } }
                    }
                }
            }
        });

        if (!request) {
            return res.status(404).json({ error: 'Change request not found' });
        }

        // Get user info
        const requestedBy = await prisma.user.findUnique({
            where: { id: request.requestedById },
            select: { id: true, name: true, email: true }
        });

        let reviewedBy = null;
        if (request.reviewedById) {
            reviewedBy = await prisma.user.findUnique({
                where: { id: request.reviewedById },
                select: { id: true, name: true, email: true }
            });
        }

        res.json({
            ...request,
            requestedBy,
            reviewedBy
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch request', message: error.message });
    }
};

// Approve request (FINANCE_ADMIN)
export const approveRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reviewNotes } = req.body;
        const userId = (req as any).user?.id || 1;

        const request = await prisma.bankAccountChangeRequest.findUnique({
            where: { id },
            include: { bankAccount: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Change request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request has already been processed' });
        }

        // Process based on request type
        let bankAccount = null;
        const requestedData = request.requestedData as any;

        if (request.requestType === 'CREATE') {
            // Create new bank account
            bankAccount = await prisma.bankAccount.create({
                data: {
                    bpCode: requestedData.bpCode || null,
                    vendorName: requestedData.vendorName,
                    beneficiaryBankName: requestedData.beneficiaryBankName,
                    accountNumber: requestedData.accountNumber,
                    ifscCode: requestedData.ifscCode,
                    emailId: requestedData.emailId || null,
                    beneficiaryName: requestedData.beneficiaryName || requestedData.vendorName,
                    nickName: requestedData.nickName || null,
                    gstNumber: requestedData.gstNumber || null,
                    panNumber: requestedData.panNumber || null,
                    isMSME: requestedData.isMSME || false,
                    udyamRegNum: requestedData.isMSME ? requestedData.udyamRegNum : null,
                    currency: requestedData.currency || 'INR',
                    accountType: requestedData.accountType || null,
                    accountCategory: requestedData.accountCategory || 'DOMESTIC',
                    createdById: request.requestedById,
                    updatedById: userId
                }
            });

            // Update the request with the new bank account ID
            await prisma.bankAccountChangeRequest.update({
                where: { id },
                data: {
                    bankAccountId: bankAccount.id,
                    status: 'APPROVED',
                    reviewedById: userId,
                    reviewedAt: new Date(),
                    reviewNotes
                }
            });

            // Transfer attachments from Request to BankAccount
            await prisma.bankAccountAttachment.updateMany({
                where: { changeRequestId: id },
                data: { bankAccountId: bankAccount.id }
            });
        } else if (request.requestType === 'UPDATE') {
            if (!request.bankAccountId) {
                return res.status(400).json({ error: 'Bank account ID is missing from request' });
            }

            // Update existing bank account
            bankAccount = await prisma.bankAccount.update({
                where: { id: request.bankAccountId },
                data: {
                    ...requestedData,
                    updatedById: userId
                }
            });

            await prisma.bankAccountChangeRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    reviewedById: userId,
                    reviewedAt: new Date(),
                    reviewNotes
                }
            });
        } else if (request.requestType === 'DELETE') {
            if (!request.bankAccountId) {
                return res.status(400).json({ error: 'Bank account ID is missing from request' });
            }

            // Soft delete the bank account
            bankAccount = await prisma.bankAccount.update({
                where: { id: request.bankAccountId },
                data: {
                    isActive: false,
                    updatedById: userId
                }
            });

            await prisma.bankAccountChangeRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    reviewedById: userId,
                    reviewedAt: new Date(),
                    reviewNotes
                }
            });
        }

        // Log activity
        const user = getUserFromRequest(req);
        await logBankAccountActivity({
            bankAccountId: bankAccount?.id || request.bankAccountId || null,
            action: 'CHANGE_REQUEST_APPROVED',
            description: `Change request (${request.requestType}) approved${bankAccount ? ` for vendor: ${bankAccount.vendorName}` : ''}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { requestId: id, requestType: request.requestType, reviewNotes }
        });

        // ── Email: Notify the requester about the approval ──
        try {
            const requester = await prisma.user.findUnique({
                where: { id: request.requestedById },
                select: { email: true, name: true }
            });
            if (requester?.email) {
                await sendEmail({
                    to: requester.email,
                    subject: `Your Vendor Request has been APPROVED`,
                    template: 'vendor-request-status',
                    context: {
                        requesterName: requester.name || 'User',
                        requestType: request.requestType,
                        vendorName: bankAccount?.vendorName || (request.requestedData as any)?.vendorName || '-',
                        decision: 'APPROVED',
                        decidedAt: new Date().toLocaleString('en-IN'),
                        isApproved: true,
                        isRejected: false,
                        reviewNotes: reviewNotes || '',
                        currentYear: new Date().getFullYear()
                    }
                });
            }
        } catch (emailError) {
            console.error('[Email] Failed to send vendor approval notification:', emailError);
        }

        res.json({
            message: 'Request approved successfully',
            bankAccount,
            request: await prisma.bankAccountChangeRequest.findUnique({ where: { id } })
        });
    } catch (error: any) {

        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Account number already exists' });
        }
        res.status(500).json({ error: 'Failed to approve request', message: error.message });
    }
};

// Reject request (FINANCE_ADMIN)
export const rejectRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reviewNotes } = req.body;
        const userId = (req as any).user?.id || 1;

        if (!reviewNotes) {
            return res.status(400).json({ error: 'Review notes are required when rejecting a request' });
        }

        const request = await prisma.bankAccountChangeRequest.findUnique({
            where: { id }
        });

        if (!request) {
            return res.status(404).json({ error: 'Change request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request has already been processed' });
        }

        const updatedRequest = await prisma.bankAccountChangeRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                reviewedById: userId,
                reviewedAt: new Date(),
                reviewNotes
            },
            include: {
                bankAccount: true
            }
        });

        // Log activity
        const user = getUserFromRequest(req);
        await logBankAccountActivity({
            bankAccountId: updatedRequest.bankAccountId || null,
            action: 'CHANGE_REQUEST_REJECTED',
            description: `Change request (${updatedRequest.requestType}) rejected${updatedRequest.bankAccount ? ` for vendor: ${updatedRequest.bankAccount.vendorName}` : ''}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { requestId: id, requestType: updatedRequest.requestType, reviewNotes }
        });

        // ── Email: Notify the requester about the rejection ──
        try {
            const requester = await prisma.user.findUnique({
                where: { id: updatedRequest.requestedById },
                select: { email: true, name: true }
            });
            if (requester?.email) {
                await sendEmail({
                    to: requester.email,
                    subject: `Your Vendor Request has been REJECTED`,
                    template: 'vendor-request-status',
                    context: {
                        requesterName: requester.name || 'User',
                        requestType: updatedRequest.requestType,
                        vendorName: updatedRequest.bankAccount?.vendorName
                            || (updatedRequest.requestedData as any)?.vendorName || '-',
                        decision: 'REJECTED',
                        decidedAt: new Date().toLocaleString('en-IN'),
                        isApproved: false,
                        isRejected: true,
                        reviewNotes: reviewNotes || '',
                        currentYear: new Date().getFullYear()
                    }
                });
            }
        } catch (emailError) {
            console.error('[Email] Failed to send vendor rejection notification:', emailError);
        }

        res.json({
            message: 'Request rejected',
            request: updatedRequest
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to reject request', message: error.message });
    }
};

// Get request statistics
export const getRequestStats = async (req: Request, res: Response) => {
    try {
        const [pending, approved, rejected] = await Promise.all([
            prisma.bankAccountChangeRequest.count({ where: { status: 'PENDING' } }),
            prisma.bankAccountChangeRequest.count({ where: { status: 'APPROVED' } }),
            prisma.bankAccountChangeRequest.count({ where: { status: 'REJECTED' } })
        ]);

        res.json({
            pending,
            approved,
            rejected,
            total: pending + approved + rejected
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
    }
};
