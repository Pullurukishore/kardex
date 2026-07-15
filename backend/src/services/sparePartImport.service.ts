import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import xml2js from 'xml2js';
import XLSX from 'xlsx';
import sharp from 'sharp';
import { logger } from '../utils/logger';

import { storageConfig } from '../config/storage.config';

// Configuration
const STORAGE_DIR = storageConfig.spareParts;

// Types
export interface SparePartImportRow {
    rowNumber: number;
    productName: string;
    partId: string;
    hsnCode?: string;
    useApplication?: string;
    modelSpec?: string;
    manufacturingUnit?: string;
    technicalSheet?: string;
    basePrice?: number;
    imageDataUrl?: string;
    _isValid: boolean;
    _errors: { field: string; message: string }[];
    _isUpdate?: boolean;
}

export interface ImportPreviewResult {
    preview: SparePartImportRow[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    imagesFound: number;
    updateCount: number;
    newCount: number;
}

export interface ImportResult {
    created: number;
    updated: number;
    failed: number;
    errors: { rowNumber: number; error: string }[];
}

/**
 * Extract embedded images from Excel file and map them to rows
 */
async function extractImagesFromExcel(buffer: Buffer): Promise<Map<number, string>> {
    const imageMap = new Map<number, string>();

    try {
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        let drawingRelsContent: string | null = null;
        let drawingContent: string | null = null;
        const mediaFiles = new Map<string, Buffer>();

        for (const entry of zipEntries) {
            const entryName = entry.entryName;

            if (entryName.includes('xl/drawings/_rels/drawing1.xml.rels')) {
                drawingRelsContent = zip.readAsText(entry);
            } else if (entryName.includes('xl/drawings/drawing1.xml')) {
                drawingContent = zip.readAsText(entry);
            } else if (entryName.startsWith('xl/media/')) {
                const fileName = path.basename(entryName);
                const imageBuffer = zip.readFile(entry);
                if (imageBuffer) {
                    mediaFiles.set(fileName, imageBuffer);
                }
            }
        }

        if (!drawingContent) {
            logger.info('No drawing1.xml found - images might not be embedded');
            return imageMap;
        }

        // Parse the relationships XML to get rId -> image file mapping
        const rIdToImage = new Map<string, string>();
        if (drawingRelsContent) {
            const parser = new xml2js.Parser();
            const relsData = await parser.parseStringPromise(drawingRelsContent);
            const relationships = relsData.Relationships?.Relationship || [];

            for (const rel of relationships) {
                const rId = rel.$.Id;
                const target = rel.$.Target;
                if (target && target.includes('media/')) {
                    const imageName = path.basename(target);
                    rIdToImage.set(rId, imageName);
                }
            }
            logger.info(`Found ${rIdToImage.size} image relationships`);
        }

        // Parse the drawing XML to get row -> rId mapping
        const parser = new xml2js.Parser({ explicitArray: false });
        const drawingData = await parser.parseStringPromise(drawingContent);

        const wsDr = drawingData['xdr:wsDr'];
        if (!wsDr) {
            logger.warn('No worksheet drawing data found');
            return imageMap;
        }

        let anchors = wsDr['xdr:twoCellAnchor'] || [];
        if (!Array.isArray(anchors)) {
            anchors = [anchors];
        }

        logger.info(`Found ${anchors.length} anchor elements in drawing`);

        for (const anchor of anchors) {
            try {
                const fromElement = anchor['xdr:from'];
                if (!fromElement) continue;

                const row = parseInt(fromElement['xdr:row'], 10);
                if (isNaN(row)) continue;

                const pic = anchor['xdr:pic'];
                if (!pic) continue;

                const blipFill = pic['xdr:blipFill'];
                if (!blipFill) continue;

                const blip = blipFill['a:blip'];
                if (!blip) continue;

                const rEmbed = blip.$?.['r:embed'];
                if (!rEmbed) continue;

                const imageName = rIdToImage.get(rEmbed);
                if (!imageName) continue;

                const imageBuffer = mediaFiles.get(imageName);
                if (!imageBuffer) continue;

                // Convert to base64 data URL
                const ext = path.extname(imageName).toLowerCase().replace('.', '');
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                const base64 = imageBuffer.toString('base64');
                const dataUrl = `data:${mimeType};base64,${base64}`;

                imageMap.set(row, dataUrl);
            } catch {
                // Skip problematic anchors
            }
        }

        logger.info(`Extracted ${imageMap.size} images mapped to rows`);
        return imageMap;

    } catch (error) {
        logger.error('Failed to extract images:', error);
        return imageMap;
    }
}

/**
 * Column name aliases for flexible matching across different Excel formats
 */
const COLUMN_ALIASES: Record<string, string[]> = {
    'product name': ['product name', 'part discriptions', 'part descriptions', 'description', 'name'],
    'part id': ['part id', 'part number', 'partnumber', 'part no', 'part no.'],
    'price': ['price', 'base price', 'unit price', 'cost'],
    'price 2026': ['price 2026'],
    'hsn code': ['hsn code', 'hsn', 'hsn no'],
    'use/application': ['(use/application of product)', 'use/application', 'application', 'use'],
    'model specification': ['model specification', 'model spec', 'model'],
    'manufacturing unit': ['manufacturing unit', 'mfg unit', 'manufacturer'],
    'technical sheet': ['ratings/technical sheet', 'technical sheet', 'ratings', 'specifications'],
    'quantity': ['quantity', 'qty', 'quant'],
};

/**
 * Get column value with flexible matching using aliases
 */
function getColumnValue(row: any, columnName: string): string {
    // Direct match first
    if (row[columnName]) return String(row[columnName]).trim();
    
    // Case-insensitive direct match
    const directKey = Object.keys(row).find(k => k.toLowerCase() === columnName.toLowerCase());
    if (directKey && row[directKey]) return String(row[directKey]).trim();
    
    // Try alias matching
    const normalizedName = columnName.toLowerCase();
    const aliases = COLUMN_ALIASES[normalizedName];
    if (aliases) {
        for (const alias of aliases) {
            const key = Object.keys(row).find(k => k.toLowerCase().trim() === alias);
            if (key && row[key] !== undefined && row[key] !== '') {
                return String(row[key]).trim();
            }
        }
    }
    
    // Reverse lookup: check if any alias group contains the columnName
    for (const [, aliasList] of Object.entries(COLUMN_ALIASES)) {
        if (aliasList.includes(normalizedName)) {
            for (const alias of aliasList) {
                const key = Object.keys(row).find(k => k.toLowerCase().trim() === alias);
                if (key && row[key] !== undefined && row[key] !== '') {
                    return String(row[key]).trim();
                }
            }
        }
    }
    
    return '';
}

/**
 * Parse Excel file and extract spare parts data with images
 */
export async function parseSparePartsExcel(buffer: Buffer): Promise<{
    rows: SparePartImportRow[];
    headerRowIndex: number;
}> {
    // Extract embedded images first
    const imageMap = await extractImagesFromExcel(buffer);

    // Read Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read raw data to detect header row
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Find the header row - supports multiple formats:
    // Format 1: 'Product Name' + 'Part ID' (original template)
    // Format 2: 'Part Number' + 'Part Discriptions' (alternate format)
    const HEADER_KEYWORDS = ['product name', 'part id', 'part number', 'part discriptions', 'part descriptions'];
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        if (row && row.some((cell: any) => {
            if (!cell) return false;
            const cellLower = String(cell).toLowerCase().trim();
            return HEADER_KEYWORDS.some(kw => cellLower.includes(kw));
        })) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        throw new Error('Could not find header row. Expected columns like "Product Name", "Part ID", "Part Number", or "Part Discriptions"');
    }

    // Extract headers from the header row
    const headers = rawData[headerRowIndex].map((h: any) => h ? String(h).trim() : '');

    // Convert data rows to objects using the correct headers
    const dataRows = rawData.slice(headerRowIndex + 1);
    const rows: SparePartImportRow[] = [];

    for (let i = 0; i < dataRows.length; i++) {
        const rowData = dataRows[i];
        if (!rowData || rowData.length === 0) continue;

        // Build row object from headers
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
            if (header) {
                obj[header] = rowData[index] !== undefined ? rowData[index] : '';
            }
        });

        // Extract data with flexible column matching
        // Supports both formats:
        //   Format 1: "Product Name" → name, "Part ID" → partNumber
        //   Format 2: "Part Discriptions" → name, "Part Number" → partNumber
        const productName = getColumnValue(obj, 'Product Name');
        const partId = getColumnValue(obj, 'Part ID');

        // Skip empty rows
        if (!productName && !partId) continue;

        // Get image for this row
        const excelRowIndex = headerRowIndex + 1 + i;
        const imageDataUrl = imageMap.get(excelRowIndex) || undefined;

        // Try to get price - check 'Price 2026' first (preferred), then 'Price', then 'Base Price'
        const price2026 = getColumnValue(obj, 'Price 2026');
        const regularPrice = getColumnValue(obj, 'Price');

        // Helper to check if a value is a valid numeric price greater than 0
        const isValidPrice = (val: string) => {
            if (!val) return false;
            const cleaned = val.replace(/[^0-9.]/g, '').trim();
            if (cleaned === '') return false;
            const parsed = parseFloat(cleaned);
            return !isNaN(parsed) && parsed > 0;
        };

        let priceStr = '0';
        if (isValidPrice(price2026)) {
            priceStr = price2026;
        } else if (isValidPrice(regularPrice)) {
            priceStr = regularPrice;
        } else {
            // Fallback: if both are zero or invalid, try to use whatever numeric value is there
            const p2026Clean = price2026.replace(/[^0-9.]/g, '');
            const regClean = regularPrice.replace(/[^0-9.]/g, '');
            const p2026Num = p2026Clean ? parseFloat(p2026Clean) : NaN;
            const regNum = regClean ? parseFloat(regClean) : NaN;
            if (!isNaN(p2026Num)) {
                priceStr = String(p2026Num);
            } else if (!isNaN(regNum)) {
                priceStr = String(regNum);
            } else {
                priceStr = '0';
            }
        }

        // Validate row
        const errors: { field: string; message: string }[] = [];
        if (!productName) {
            errors.push({ field: 'Product Name', message: 'Product Name / Part Description is required' });
        }
        if (!partId) {
            errors.push({ field: 'Part ID', message: 'Part ID / Part Number is required' });
        }

        rows.push({
            rowNumber: i + 2, // Excel row number (1-indexed + header)
            productName,
            partId,
            hsnCode: getColumnValue(obj, 'HSN Code'),
            useApplication: getColumnValue(obj, '(Use/Application of product)') || getColumnValue(obj, 'Use/Application'),
            modelSpec: getColumnValue(obj, 'Model Specification'),
            manufacturingUnit: getColumnValue(obj, 'Manufacturing Unit'),
            technicalSheet: getColumnValue(obj, 'Ratings/Technical sheet') || getColumnValue(obj, 'Technical Sheet'),
            basePrice: parseFloat(priceStr.replace(/,/g, '') || '0'),
            imageDataUrl,
            _isValid: errors.length === 0,
            _errors: errors,
        });
    }

    return { rows, headerRowIndex };
}

/**
 * Store spare part image to local filesystem
 */
export async function storeSparePartImage(
    imageDataUrl: string,
    partId: string
): Promise<string> {
    try {
        // Ensure storage directory exists
        await fs.mkdir(STORAGE_DIR, { recursive: true });

        // Parse data URL
        const matches = imageDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
        if (!matches) {
            throw new Error('Invalid image data URL format');
        }

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Compress image using sharp
        const compressedBuffer = await sharp(buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        // Generate unique filename
        const hash = crypto.createHash('md5').update(partId + Date.now()).digest('hex').slice(0, 8);
        const safePartId = partId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${safePartId}-${hash}.jpg`;
        const filepath = path.join(STORAGE_DIR, filename);

        // Write file
        await fs.writeFile(filepath, compressedBuffer);

        logger.info(`Stored image for part ${partId}: ${filename}`);

        // Return URL path (served by express.static at /storage)
        // Public path for images is /storage/images/spare-parts
        return `/storage/images/spare-parts/${filename}`;
    } catch (error) {
        logger.error(`Failed to store image for part ${partId}:`, error);
        throw error;
    }
}

/**
 * Preview import - parse Excel and check for existing parts
 */
export async function previewImport(
    buffer: Buffer,
    existingPartIds: string[]
): Promise<ImportPreviewResult> {
    const { rows } = await parseSparePartsExcel(buffer);

    const existingSet = new Set(existingPartIds.map(id => id.toLowerCase()));

    let imagesFound = 0;
    let updateCount = 0;
    let newCount = 0;

    for (const row of rows) {
        if (row.imageDataUrl) {
            imagesFound++;
        }

        if (row._isValid) {
            if (existingSet.has(row.partId.toLowerCase())) {
                row._isUpdate = true;
                updateCount++;
            } else {
                row._isUpdate = false;
                newCount++;
            }
        }
    }

    return {
        preview: rows,
        totalRows: rows.length,
        validRows: rows.filter(r => r._isValid).length,
        invalidRows: rows.filter(r => !r._isValid).length,
        imagesFound,
        updateCount,
        newCount,
    };
}

export const SparePartImportService = {
    parseSparePartsExcel,
    storeSparePartImage,
    previewImport,
    extractImagesFromExcel,
};
