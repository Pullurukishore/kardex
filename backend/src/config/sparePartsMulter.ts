import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { storageConfig } from './storage.config';

// Ensure temp directory exists
const tempDir = path.join(storageConfig.root, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for spare parts Excel uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, tempDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `spareparts-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (_req: any, file: any, cb: any) => {
    const allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'), false);
    }
};

export const sparePartsUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for Excel files with images
    },
});
