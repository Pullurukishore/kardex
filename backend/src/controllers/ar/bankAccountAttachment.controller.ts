import { Request, Response } from 'express';
import prisma from '../../config/db';
import fs from 'fs';
import path from 'path';

import { storageConfig } from '../../config/storage.config';

const ATTACHMENT_DIR = process.env.BANK_DOC_UPLOAD_DIR || path.join(storageConfig.root, 'bank-account-docs');

// Ensure directory exists
if (!fs.existsSync(ATTACHMENT_DIR)) {
    fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
}

export const uploadAttachment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // Generic id param
        const userId = (req as any).user?.id || 1;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Try to find if 'id' is a BankAccount or a ChangeRequest
        const [bankAccount, changeRequest] = await Promise.all([
            prisma.bankAccount.findUnique({ where: { id } }),
            prisma.bankAccountChangeRequest.findUnique({ where: { id } })
        ]);

        if (!bankAccount && !changeRequest) {
            // Cleanup
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ error: 'Associated Bank Account or Request not found' });
        }

        const { vendorType } = req.body;

        const attachment = await prisma.bankAccountAttachment.create({
            data: {
                filename: req.file.originalname,
                path: req.file.path,
                mimeType: req.file.mimetype,
                size: req.file.size,
                bankAccountId: bankAccount ? id : (changeRequest?.bankAccountId || null),
                changeRequestId: changeRequest ? id : null,
                uploadedById: userId,
                vendorType: vendorType || null
            }
        });

        res.status(201).json(attachment);
    } catch (error: any) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload attachment', message: error.message });
    }
};

export const getAttachments = async (req: Request, res: Response) => {
    try {
        const { id: bankAccountId } = req.params;

        const attachments = await prisma.bankAccountAttachment.findMany({
            where: { bankAccountId },
            orderBy: { createdAt: 'desc' },
            include: {
                uploadedBy: {
                    select: { id: true, name: true }
                }
            }
        });

        res.json(attachments);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch attachments', message: error.message });
    }
};

export const downloadAttachment = async (req: Request, res: Response) => {
    try {
        const { attachmentId } = req.params;
        const { inline } = req.query;

        const attachment = await prisma.bankAccountAttachment.findUnique({
            where: { id: attachmentId }
        });

        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        if (!fs.existsSync(attachment.path)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }

        if (inline === 'true') {
            res.setHeader('Content-Type', attachment.mimeType);
            res.setHeader('Content-Disposition', 'inline');
            return res.sendFile(path.resolve(attachment.path));
        }

        res.download(attachment.path, attachment.filename);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to download attachment', message: error.message });
    }
};

export const updateAttachmentVendorType = async (req: Request, res: Response) => {
    try {
        const { attachmentId } = req.params;
        const { vendorType } = req.body;

        const attachment = await prisma.bankAccountAttachment.findUnique({
            where: { id: attachmentId }
        });

        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        const updated = await prisma.bankAccountAttachment.update({
            where: { id: attachmentId },
            data: { vendorType }
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update attachment vendor type', message: error.message });
    }
};

export const deleteAttachment = async (req: Request, res: Response) => {
    try {
        const { attachmentId } = req.params;

        const attachment = await prisma.bankAccountAttachment.findUnique({
            where: { id: attachmentId }
        });

        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        // Delete from disk
        if (fs.existsSync(attachment.path)) {
            fs.unlinkSync(attachment.path);
        }

        // Delete from DB
        await prisma.bankAccountAttachment.delete({
            where: { id: attachmentId }
        });

        res.json({ message: 'Attachment deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete attachment', message: error.message });
    }
};
