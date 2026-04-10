import { Request, Response } from 'express';
import prisma from '../../config/db';
import { logInvoiceActivity, getUserFromRequest, getIpFromRequest } from './arActivityLog.controller';

/**
 * Get all unique customers from ARCustomer master table with pagination and financial stats
 */
export const getAllCustomers = async (req: Request, res: Response) => {
    try {
        const { search, riskClass, page = 1, limit = 50 } = req.query;

        // Build where clause for ARCustomer
        const where: any = {};
        if (search) {
            where.OR = [
                { bpCode: { contains: String(search), mode: 'insensitive' } },
                { customerName: { contains: String(search), mode: 'insensitive' } },
            ];
        }
        if (riskClass) {
            where.riskClass = riskClass;
        }

        const skip = (Number(page) - 1) * Number(limit);

        // 1. Fetch from Master Table as Primary Source
        const customers = await prisma.aRCustomer.findMany({
            where,
            skip,
            take: Number(limit),
            orderBy: { customerName: 'asc' },
        });

        const total = await prisma.aRCustomer.count({ where });

        // 2. Fetch financial stats from ARInvoice table for these specific customers
        const pageBpCodes = customers.map((c: any) => c.bpCode);
        const financialStats = await prisma.aRInvoice.groupBy({
            by: ['bpCode'],
            where: {
                bpCode: { in: pageBpCodes },
                status: { not: 'CANCELLED' },
                OR: [
                    { milestoneStatus: { not: 'LINKED' } },
                    { milestoneStatus: null }
                ]
            },
            _sum: {
                totalAmount: true,
                balance: true
            },
            _count: {
                _all: true
            }
        });

        const customersWithStats = customers.map((c: any) => {
            const stats = financialStats.find((s: any) => s.bpCode === c.bpCode);
            return {
                id: c.bpCode,
                ...c,
                creditLimit: c.creditLimit !== null ? Number(c.creditLimit) : 0,
                totalInvoiceAmount: stats?._sum.totalAmount !== null ? Number(stats?._sum.totalAmount) : 0,
                outstandingBalance: stats?._sum.balance !== null ? Number(stats?._sum.balance) : 0,
                _count: { invoices: stats?._count._all || 0 }
            };
        });

        res.json({
            data: customersWithStats,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch customers', message: error.message });
    }
};

/**
 * Get customer details by BP Code
 */
export const getCustomerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Fetch from Master Table
        const master = await prisma.aRCustomer.findUnique({
            where: { bpCode: id }
        });

        if (!master) {
            return res.status(404).json({ error: 'Customer not found in master records' });
        }

        // Get snapshot from invoices for activity display
        const invoices = await prisma.aRInvoice.findMany({
            where: { bpCode: id },
            orderBy: { invoiceDate: 'desc' },
            take: 10,
        });

        const financialStats = await prisma.aRInvoice.aggregate({
            where: {
                bpCode: id,
                status: { not: 'CANCELLED' },
                OR: [
                    { milestoneStatus: { not: 'LINKED' } },
                    { milestoneStatus: null }
                ]
            },
            _sum: {
                totalAmount: true,
                balance: true
            },
            _count: {
                _all: true
            }
        });

        const overdueCount = await prisma.aRInvoice.count({
            where: {
                bpCode: id,
                status: 'OVERDUE'
            }
        });

        res.json({
            id: master.bpCode,
            ...master,
            creditLimit: master.creditLimit !== null ? Number(master.creditLimit) : 0,
            totalInvoiceAmount: financialStats?._sum.totalAmount !== null ? Number(financialStats?._sum.totalAmount) : 0,
            outstandingBalance: financialStats?._sum.balance !== null ? Number(financialStats?._sum.balance) : 0,
            invoiceCount: financialStats?._count._all || 0,
            overdueCount,
            invoices,
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch customer', message: error.message });
    }
};

/**
 * Explicitly create a customer master record (without invoice)
 */
export const createCustomer = async (req: Request, res: Response) => {
    try {
        const { bpCode, customerName, emailId, contactNo, region, department, personInCharge, riskClass, creditLimit } = req.body;

        if (!bpCode || !customerName) {
            return res.status(400).json({ error: 'BP Code and Customer Name are mandatory' });
        }

        const customer = await prisma.aRCustomer.create({
            data: {
                bpCode: bpCode.trim(),
                customerName: customerName.trim(),
                emailId,
                contactNo,
                region,
                department,
                personInCharge,
                riskClass: riskClass || 'LOW',
                creditLimit: creditLimit || 0
            }
        });

        const user = getUserFromRequest(req);
        await logInvoiceActivity({
            invoiceId: null,
            action: 'CUSTOMER_CREATED',
            description: `New customer master created: ${customerName} (${bpCode})`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { bpCode }
        });

        res.status(201).json(customer);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'BP Code already exists' });
        }
        res.status(500).json({ error: 'Failed to create customer', message: error.message });
    }
};

/**
 * Update customer in both Master and Invoices
 */
export const updateCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // BP Code
        const data = req.body;

        // 1. Update Master Table
        const updatedMaster = await prisma.aRCustomer.update({
            where: { bpCode: id },
            data: {
                customerName: data.customerName,
                emailId: data.emailId,
                contactNo: data.contactNo,
                region: data.region,
                department: data.department,
                personInCharge: data.personInCharge,
                riskClass: data.riskClass,
                creditLimit: data.creditLimit
            }
        });

        // 2. Cascade update to all invoices
        await prisma.aRInvoice.updateMany({
            where: { bpCode: id },
            data: {
                customerName: data.customerName,
                emailId: data.emailId,
                contactNo: data.contactNo,
                region: data.region,
                department: data.department,
                personInCharge: data.personInCharge,
                riskClass: data.riskClass,
                creditLimit: data.creditLimit
            }
        });

        const user = getUserFromRequest(req);
        await logInvoiceActivity({
            invoiceId: null,
            action: 'CUSTOMER_UPDATED',
            description: `Customer master updated: ${id}`,
            performedById: user.id,
            performedBy: user.name,
            ipAddress: getIpFromRequest(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: { bpCode: id, fields: Object.keys(data) }
        });

        res.json(updatedMaster);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update customer', message: error.message });
    }
};

/**
 * Delete customer master record
 */
export const deleteCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if invoices exist
        const invoiceCount = await prisma.aRInvoice.count({
            where: { bpCode: id }
        });

        if (invoiceCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete customer',
                message: `This customer has ${invoiceCount} active invoices. Delete invoices first.`
            });
        }

        await prisma.aRCustomer.delete({
            where: { bpCode: id }
        });

        res.json({ message: 'Customer master record deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete customer', message: error.message });
    }
};
