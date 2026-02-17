import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storageConfig } from './storage.config';

// Ensure spare parts directory exists
const sparePartsDir = storageConfig.spareParts;
if (!fs.existsSync(sparePartsDir)) {
    fs.mkdirSync(sparePartsDir, { recursive: true });
}

// Configure multer for spare parts image uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, sparePartsDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `sparepart-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (_req: any, file: any, cb: any) => {
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.'), false);
    }
};

export const sparePartImageUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for single images
    },
});
