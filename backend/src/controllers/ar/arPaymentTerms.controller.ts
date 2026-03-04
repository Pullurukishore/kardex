import { Request, Response } from 'express';
import prisma from '../../config/db';

// Get all payment terms
export const getAllPaymentTerms = async (req: Request, res: Response) => {
    try {
        const { activeOnly } = req.query;

        const where = activeOnly === 'true' ? { isActive: true } : {};

        const terms = await prisma.aRPaymentTerms.findMany({
            where,
            orderBy: { dueDays: 'asc' }
        });

        res.json(terms);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch payment terms', message: error.message });
    }
};

// Get payment term by ID
export const getPaymentTermById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const term = await prisma.aRPaymentTerms.findUnique({
            where: { id }
        });

        if (!term) {
            return res.status(404).json({ error: 'Payment term not found' });
        }

        res.json(term);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch payment term', message: error.message });
    }
};

// Create payment term
export const createPaymentTerm = async (req: Request, res: Response) => {
    try {
        const { termCode, termName, dueDays, description, isActive } = req.body;

        if (!termCode || !termName || dueDays === undefined) {
            return res.status(400).json({
                error: 'Term Code, Term Name, and Due Days are required'
            });
        }

        const term = await prisma.aRPaymentTerms.create({
            data: {
                termCode,
                termName,
                dueDays: Number(dueDays),
                description,
                isActive: isActive !== false
            }
        });

        res.status(201).json(term);
    } catch (error: any) {

        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Payment term with this code already exists' });
        }
        res.status(500).json({ error: 'Failed to create payment term', message: error.message });
    }
};

// Update payment term
export const updatePaymentTerm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (updateData.dueDays !== undefined) {
            updateData.dueDays = Number(updateData.dueDays);
        }

        const term = await prisma.aRPaymentTerms.update({
            where: { id },
            data: updateData
        });

        res.json(term);
    } catch (error: any) {

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Payment term not found' });
        }
        res.status(500).json({ error: 'Failed to update payment term', message: error.message });
    }
};

// Seed default payment terms
export const seedPaymentTerms = async (req: Request, res: Response) => {
    try {
        const defaultTerms = [
            { termCode: 'NET30', termName: 'Net 30 Days', dueDays: 30, description: 'Payment due in 30 days' },
            { termCode: 'NET45', termName: 'Net 45 Days', dueDays: 45, description: 'Payment due in 45 days' },
            { termCode: 'NET60', termName: 'Net 60 Days', dueDays: 60, description: 'Payment due in 60 days' },
            { termCode: 'NET90', termName: 'Net 90 Days', dueDays: 90, description: 'Payment due in 90 days' },
            { termCode: 'COD', termName: 'Cash on Delivery', dueDays: 0, description: 'Immediate payment required' },
            { termCode: 'MILESTONE', termName: 'Milestone', dueDays: -7, description: 'Milestone based payment structure' },
        ];

        const results = await Promise.all(
            defaultTerms.map(term =>
                prisma.aRPaymentTerms.upsert({
                    where: { termCode: term.termCode },
                    create: term,
                    update: term
                })
            )
        );

        res.json({ message: `Seeded ${results.length} payment terms`, terms: results });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to seed payment terms', message: error.message });
    }
};
