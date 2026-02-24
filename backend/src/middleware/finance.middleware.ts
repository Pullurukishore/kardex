import { Response, NextFunction, Request, RequestHandler } from 'express';
import prisma from '../config/db';

// Finance role types
export type FinanceRole = 'FINANCE_ADMIN' | 'FINANCE_USER' | 'FINANCE_VIEWER' | 'FINANCE_APPROVER';

// Extend Request to include finance user info
declare global {
    namespace Express {
        interface Request {
            financeUser?: {
                id: number;
                email: string;
                financeRole: FinanceRole;
                name?: string | null;
            };
        }
    }
}

/**
 * Middleware to require finance module access
 * Checks if the user has a financeRole assigned
 */
export const requireFinanceAccess: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = (req as any).user;
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }

        // Fetch user's finance role from database
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                email: true,
                name: true,
                financeRole: true,
            },
        });

        if (!dbUser || !dbUser.financeRole) {
            res.status(403).json({
                success: false,
                error: 'Access denied. Finance module access required.',
            });
            return;
        }

        // Attach finance user info to request
        req.financeUser = {
            id: dbUser.id,
            email: dbUser.email,
            financeRole: dbUser.financeRole as FinanceRole,
            name: dbUser.name,
        };

        next();
    } catch (error) {

        res.status(500).json({
            success: false,
            error: 'Authorization failed',
        });
    }
};

/**
 * Middleware to require specific finance roles
 * @param allowedRoles Array of allowed finance roles
 */
export const requireFinanceRole = (allowedRoles: FinanceRole[]): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            // First ensure finance access
            if (!req.financeUser) {
                // If financeUser not attached, fetch it
                if (!user) {
                    res.status(401).json({
                        success: false,
                        error: 'Authentication required',
                    });
                    return;
                }

                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        financeRole: true,
                    },
                });

                if (!dbUser || !dbUser.financeRole) {
                    res.status(403).json({
                        success: false,
                        error: 'Access denied. Finance module access required.',
                    });
                    return;
                }

                req.financeUser = {
                    id: dbUser.id,
                    email: dbUser.email,
                    financeRole: dbUser.financeRole as FinanceRole,
                    name: dbUser.name,
                };
            }

            // Check if user's role is in allowed roles
            // FINANCE_ADMIN always has access
            if (req.financeUser.financeRole === 'FINANCE_ADMIN') {
                next();
                return;
            }

            if (!allowedRoles.includes(req.financeUser.financeRole)) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions for this action',
                    requiredRoles: allowedRoles,
                    userRole: req.financeUser.financeRole,
                });
                return;
            }

            next();
        } catch (error) {

            res.status(500).json({
                success: false,
                error: 'Authorization failed',
            });
        }
    };
};

/**
 * Middleware for admin-only actions (Finance Users management, Bank Accounts, etc.)
 */
export const requireFinanceAdmin = requireFinanceRole(['FINANCE_ADMIN']);

/**
 * Middleware for actions that require write access (ADMIN and USER)
 * VIEWER is excluded
 */
export const requireFinanceWrite = requireFinanceRole(['FINANCE_ADMIN', 'FINANCE_USER']);

export const requireFinanceRead = requireFinanceRole(['FINANCE_ADMIN', 'FINANCE_USER', 'FINANCE_VIEWER', 'FINANCE_APPROVER']);

/**
 * Middleware for payment batch approval actions (Admin + Approver)
 */
export const requireFinanceApprover = requireFinanceRole(['FINANCE_ADMIN', 'FINANCE_APPROVER']);

/**
 * Helper to check if user can delete resources
 * Only FINANCE_ADMIN can delete
 */
export const requireFinanceDelete = requireFinanceRole(['FINANCE_ADMIN']);
