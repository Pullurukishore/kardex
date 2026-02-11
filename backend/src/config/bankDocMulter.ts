import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { storageConfig } from './storage.config';
import { Request } from 'express';

const ATTACHMENT_DIR = process.env.BANK_DOC_UPLOAD_DIR || path.join(storageConfig.root, 'bank-account-docs');

// Ensure directory exists
if (!fs.existsSync(ATTACHMENT_DIR)) {
    fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb) => {
        cb(null, ATTACHMENT_DIR);
    },
    filename: (req: Request, file: Express.Multer.File, cb) => {
        const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
        const ext = path.extname(file.originalname);
        cb(null, `doc-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Explicitly block ZIP files
    if (ext === '.zip' || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
        return cb(new Error('ZIP files are not allowed for security reasons'));
    }

    // Allow everything else
    cb(null, true);
};

export const bankDocUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit
    },
});
