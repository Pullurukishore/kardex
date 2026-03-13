import { Request, Response } from 'express';
import prisma from '../../config/db';
import { logInvoiceActivity, getUserFromRequest, getIpFromRequest } from './arActivityLog.controller';

// Note: The AR module uses a denormalized structure - customer data is embedded in ARInvoice.
// These functions provide customer-related queries from the ARInvoice table.

// Get all unique customers from AR invoices with pagination
export const getAllCustomers = async (req: Request, res: Response) => {
    try {
        const { search, riskClass, page = 1, limit = 50 } = req.query;

        // Build the where clause for ARInvoice
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

        // Get distinct customers from ARInvoice
        const invoices = await prisma.aRInvoice.findMany({
            where,
            select: {
                bpCode: true,
                customerName: true,
                riskClass: true,
                emailId: true,
                contactNo: true,
                region: true,
                department: true,
                personInCharge: true,
                creditLimit: true,
            },
            distinct: ['bpCode'],
            skip,
            take: Number(limit),
            orderBy: { customerName: 'asc' },
        });

        // Get total count of unique customers
        const totalAggregate = await prisma.aRInvoice.groupBy({
            by: ['bpCode'],
            where: { 
                ...where,
                status: { not: 'CANCELLED' }
            },
        });
        const total = totalAggregate.length;

        // Get totals for all customers in the current page batch in one query to avoid N+1
        const pageBpCodes = invoices.map(i => i.bpCode);
        const financialStats = await prisma.aRInvoice.groupBy({
            by: ['bpCode'],
            where: { 
                bpCode: { in: pageBpCodes },
                status: { not: 'CANCELLED' }
            },
            _sum: {
                totalAmount: true,
                balance: true
            },
            _count: {
                _all: true
            }
        });

        const customersWithCounts = invoices.map((customer) => {
            const stats = financialStats.find(s => s.bpCode === customer.bpCode);
            return {
                id: customer.bpCode,
                bpCode: customer.bpCode,
                customerName: customer.customerName,
                riskClass: customer.riskClass,
                emailId: customer.emailId,
                contactNo: customer.contactNo,
                region: customer.region,
                department: customer.department,
                personInCharge: customer.personInCharge,
                creditLimit: (customer.creditLimit !== null && customer.creditLimit !== undefined) ? Number(customer.creditLimit) : undefined,
                totalInvoiceAmount: stats?._sum.totalAmount !== null ? Number(stats?._sum.totalAmount) : 0,
                outstandingBalance: stats?._sum.balance !== null ? Number(stats?._sum.balance) : 0,
                _count: { invoices: stats?._count._all || 0 }
            };
        });

        res.json({
            data: customersWithCounts,
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

// Get customer by BP Code (id in the route is bpCode)
export const getCustomerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get customer info from the first invoice with this bpCode
        const customerInvoice = await prisma.aRInvoice.findFirst({
            where: { bpCode: id },
            select: {
                bpCode: true,
                customerName: true,
                riskClass: true,
                emailId: true,
                contactNo: true,
                region: true,
                department: true,
                personInCharge: true,
                creditLimit: true,
            }
        });

        if (!customerInvoice) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get latest invoices for UI list
        const invoices = await prisma.aRInvoice.findMany({
            where: { bpCode: id },
            orderBy: { invoiceDate: 'desc' },
            take: 10,
        });

        // Get total financial stats across ALL active invoices for this customer
        const financialStats = await prisma.aRInvoice.aggregate({
            where: { 
                bpCode: id,
                status: { not: 'CANCELLED' }
            },
            _sum: {
                totalAmount: true,
                balance: true
            },
            _count: {
                _all: true
            }
        });

        // Get overdue count strictly
        const overdueCount = await prisma.aRInvoice.count({
            where: { 
                bpCode: id,
                status: 'OVERDUE'
            }
        });

        const customer = {
            id: customerInvoice.bpCode,
            bpCode: customerInvoice.bpCode,
            customerName: customerInvoice.customerName,
            riskClass: customerInvoice.riskClass,
            emailId: customerInvoice.emailId,
            contactNo: customerInvoice.contactNo,
            region: customerInvoice.region,
            department: customerInvoice.department,
            personInCharge: customerInvoice.personInCharge,
            creditLimit: (customerInvoice.creditLimit !== null && customerInvoice.creditLimit !== undefined) ? Number(customerInvoice.creditLimit) : undefined,
            totalInvoiceAmount: financialStats?._sum.totalAmount !== null ? Number(financialStats?._sum.totalAmount) : 0,
            outstandingBalance: financialStats?._sum.balance !== null ? Number(financialStats?._sum.balance) : 0,
            invoiceCount: financialStats?._count._all || 0,
            overdueCount,
            invoices,
        };

        res.json(customer);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch customer', message: error.message });
    }
};

// Create customer - Not applicable in denormalized schema
// Customer info is created with invoices
export const createCustomer = async (req: Request, res: Response) => {
    res.status(400).json({
        error: 'Customer creation is not supported. Customer data is managed through invoice imports.'
    });
};

// Update customer - Updates customer info on all invoices with this bpCode
export const updateCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { emailId, contactNo, region, department, personInCharge, riskClass, creditLimit } = req.body;

        // Update customer info on all invoices with this bpCode
        const updateResult = await prisma.aRInvoice.updateMany({
            where: { bpCode: id },
            data: {
                ...(emailId !== undefined && { emailId }),
                ...(contactNo !== undefined && { contactNo }),
                ...(region !== undefined && { region }),
                ...(department !== undefined && { department }),
                ...(personInCharge !== undefined && { personInCharge }),
                ...(riskClass !== undefined && { riskClass }),
                ...(creditLimit !== undefined && { creditLimit }),
            }
        });

        if (updateResult.count === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get all affected invoice IDs for logging
        const affectedInvoices = await prisma.aRInvoice.findMany({
            where: { bpCode: id },
            select: { id: true, invoiceNumber: true }
        });

        // Log activity for each affected invoice (first 10 to avoid performance issues)
        const user = getUserFromRequest(req);
        const ipAddress = getIpFromRequest(req);
        const userAgent = req.headers['user-agent'] || null;

        const logPromises = affectedInvoices.slice(0, 10).map(inv =>
            logInvoiceActivity({
                invoiceId: inv.id,
                action: 'CUSTOMER_UPDATED',
                description: `Customer information updated for BP Code ${id} (${updateResult.count} invoices affected)`,
                performedById: user.id,
                performedBy: user.name,
                ipAddress,
                userAgent,
                metadata: { bpCode: id, updatedFields: Object.keys(req.body), invoiceCount: updateResult.count }
            })
        );

        await Promise.all(logPromises);

        // Return updated customer info
        const updatedCustomer = await prisma.aRInvoice.findFirst({
            where: { bpCode: id },
            select: {
                bpCode: true,
                customerName: true,
                riskClass: true,
                emailId: true,
                contactNo: true,
                region: true,
                department: true,
                personInCharge: true,
                creditLimit: true,
            }
        });

        res.json({
            id: id,
            ...updatedCustomer,
            message: `Updated ${updateResult.count} invoice(s)`
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to update customer', message: error.message });
    }
};

// Delete customer - Not supported in denormalized schema
export const deleteCustomer = async (req: Request, res: Response) => {
    res.status(400).json({
        error: 'Customer deletion is not supported. Delete individual invoices instead.'
    });
};
