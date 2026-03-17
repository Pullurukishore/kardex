import { Request, Response } from 'express';
import prisma from '../../config/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { FinanceRole } from '@prisma/client';

// Finance User Interface
interface FinanceUser {
    id: number;
    email: string;
    name: string | null;
    phone: string | null;
    financeRole: FinanceRole | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// Get all finance users with pagination and search
export const getFinanceUsers = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 30, search = '' } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build where clause
        const where: any = {
            financeRole: { not: null }, // Only users with finance roles
        };

        if (search) {
            where.OR = [
                { email: { contains: search as string, mode: 'insensitive' } },
                { name: { contains: search as string, mode: 'insensitive' } },
                { phone: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        // Get users and count
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limitNum,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    phone: true,
                    financeRole: true,
                    arRole: true,
                    vendorRole: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        // Calculate stats
        const stats = {
            total: users.length,
            active: users.filter(u => u.isActive).length,
            inactive: users.filter(u => !u.isActive).length,
            admins: users.filter(u => u.financeRole === 'FINANCE_ADMIN').length,
            regularUsers: users.filter(u => u.financeRole === 'FINANCE_USER').length,
            viewers: users.filter(u => u.financeRole === 'FINANCE_VIEWER').length,
        };

        res.json({
            success: true,
            data: users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
            stats,
        });
    } catch (error: any) {

        res.status(500).json({
            success: false,
            error: 'Failed to fetch finance users',
            message: error.message,
        });
    }
};

// Get finance user by ID
export const getFinanceUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                financeRole: true,
                arRole: true,
                vendorRole: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Finance user not found',
            });
        }

        if (!user.financeRole) {
            return res.status(404).json({
                success: false,
                error: 'User is not a finance user',
            });
        }

        res.json({
            success: true,
            data: user,
        });
    } catch (error: any) {

        res.status(500).json({
            success: false,
            error: 'Failed to fetch finance user',
            message: error.message,
        });
    }
};

// Create a new finance user
export const createFinanceUser = async (req: Request, res: Response) => {
    try {
        const { email, name, phone, password, financeRole, arRole, vendorRole } = req.body;

        // Validate required fields
        if (!email || !password || !financeRole) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and finance role are required',
            });
        }

        // Validate finance role
        const validRoles: FinanceRole[] = ['FINANCE_ADMIN', 'FINANCE_USER', 'FINANCE_VIEWER', 'FINANCE_APPROVER'];
        if (!validRoles.includes(financeRole)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid finance role. Must be FINANCE_ADMIN, FINANCE_USER, FINANCE_VIEWER, or FINANCE_APPROVER',
            });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'A user with this email already exists',
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                name: name || null,
                phone: phone || null,
                password: hashedPassword,
                financeRole: financeRole as FinanceRole,
                arRole: arRole as FinanceRole || null,
                vendorRole: vendorRole as FinanceRole || null,
                tokenVersion: uuidv4(),
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                financeRole: true,
                arRole: true,
                vendorRole: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.status(201).json({
            success: true,
            data: user,
            message: 'Finance user created successfully',
        });
    } catch (error: any) {

        res.status(500).json({
            success: false,
            error: 'Failed to create finance user',
            message: error.message,
        });
    }
};

// Update a finance user
export const updateFinanceUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const { email, name, phone, password, financeRole, arRole, vendorRole, isActive } = req.body;

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
            });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                error: 'Finance user not found',
            });
        }

        // Check if email is being changed and if new email already exists
        if (email && email.toLowerCase() !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    error: 'A user with this email already exists',
                });
            }
        }

        // Validate finance role if provided
        if (financeRole) {
            const validRoles: FinanceRole[] = ['FINANCE_ADMIN', 'FINANCE_USER', 'FINANCE_VIEWER', 'FINANCE_APPROVER'];
            if (!validRoles.includes(financeRole)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid finance role',
                });
            }
        }

        // Build update data
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (email) updateData.email = email.toLowerCase();
        if (name !== undefined) updateData.name = name || null;
        if (phone !== undefined) updateData.phone = phone || null;
        if (financeRole) updateData.financeRole = financeRole as FinanceRole;
        if (arRole !== undefined) updateData.arRole = arRole as FinanceRole || null;
        if (vendorRole !== undefined) updateData.vendorRole = vendorRole as FinanceRole || null;
        if (typeof isActive === 'boolean') updateData.isActive = isActive;

        // Hash password if provided
        if (password && password.length >= 6) {
            updateData.password = await bcrypt.hash(password, 10);
            updateData.tokenVersion = uuidv4(); // Invalidate existing sessions
        }

        // Update user
        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                financeRole: true,
                arRole: true,
                vendorRole: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.json({
            success: true,
            data: user,
            message: 'Finance user updated successfully',
        });
    } catch (error: any) {

        res.status(500).json({
            success: false,
            error: 'Failed to update finance user',
            message: error.message,
        });
    }
};

// Delete a finance user
export const deleteFinanceUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
            });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                error: 'Finance user not found',
            });
        }

        if (!existingUser.financeRole) {
            return res.status(400).json({
                success: false,
                error: 'User is not a finance user',
            });
        }

        // Delete user
        await prisma.user.delete({
            where: { id: userId },
        });

        res.json({
            success: true,
            message: 'Finance user deleted successfully',
        });
    } catch (error: any) {

        res.status(500).json({
            success: false,
            error: 'Failed to delete finance user',
            message: error.message,
        });
    }
};

// Get finance user stats
export const getFinanceUserStats = async (req: Request, res: Response) => {
    try {
        const where = {
            financeRole: { not: null as any },
        };

        const [total, active, admins, regularUsers, viewers, approvers] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.count({ where: { ...where, isActive: true } }),
            prisma.user.count({ where: { financeRole: 'FINANCE_ADMIN' } }),
            prisma.user.count({ where: { financeRole: 'FINANCE_USER' } }),
            prisma.user.count({ where: { financeRole: 'FINANCE_VIEWER' } }),
            prisma.user.count({ where: { financeRole: 'FINANCE_APPROVER' } }),
        ]);

        res.json({
            success: true,
            data: {
                total,
                active,
                inactive: total - active,
                admins,
                regularUsers,
                viewers,
                approvers,
            },
        });
    } catch (error: any) {

        res.status(500).json({
            success: false,
            error: 'Failed to fetch finance user stats',
            message: error.message,
        });
    }
};
