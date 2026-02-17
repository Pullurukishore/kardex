import { Response } from 'express';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ActivityController } from './activityController';
import { SparePartImportService } from '../services/sparePartImport.service';
import fs from 'fs/promises';
import XLSX from 'xlsx';


export class SparePartController {
  // Wrapper methods for routes without authentication
  static async getSparePartsWrapper(req: any, res: Response) {
    return SparePartController.getSpareParts(req as AuthenticatedRequest, res);
  }

  static async getSparePartWrapper(req: any, res: Response) {
    return SparePartController.getSparePart(req as AuthenticatedRequest, res);
  }

  static async createSparePartWrapper(req: any, res: Response) {
    return SparePartController.createSparePart(req as AuthenticatedRequest, res);
  }

  static async updateSparePartWrapper(req: any, res: Response) {
    return SparePartController.updateSparePart(req as AuthenticatedRequest, res);
  }

  static async deleteSparePartWrapper(req: any, res: Response) {
    return SparePartController.deleteSparePart(req as AuthenticatedRequest, res);
  }

  static async getCategoriesWrapper(req: any, res: Response) {
    return SparePartController.getCategories(req as AuthenticatedRequest, res);
  }

  static async bulkUpdatePricesWrapper(req: any, res: Response) {
    return SparePartController.bulkUpdatePrices(req as AuthenticatedRequest, res);
  }

  static async previewBulkImportWrapper(req: any, res: Response) {
    return SparePartController.previewBulkImport(req as AuthenticatedRequest, res);
  }

  static async bulkImportWrapper(req: any, res: Response) {
    return SparePartController.bulkImport(req as AuthenticatedRequest, res);
  }

  static async downloadImportTemplateWrapper(req: any, res: Response) {
    return SparePartController.downloadImportTemplate(req as AuthenticatedRequest, res);
  }

  static async uploadImageWrapper(req: any, res: Response) {
    return SparePartController.uploadImage(req as AuthenticatedRequest, res);
  }

  // Get all spare parts
  static async getSpareParts(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        search,
        page = 1,
        limit = 1000,
        category,
        status = 'ACTIVE'
      } = req.query;

      const where: any = {};

      if (status !== 'ALL') {
        where.status = status;
      }

      if (category) {
        where.category = category;
      }

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { partNumber: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
          { category: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const [spareParts, total] = await Promise.all([
        prisma.sparePart.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            updatedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.sparePart.count({ where }),
      ]);

      res.json({
        spareParts,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
      return;
    } catch (error) {
      logger.error('Get spare parts error:', error);
      res.status(500).json({ error: 'Failed to fetch spare parts' });
      return;
    }
  }

  // Get single spare part
  static async getSparePart(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const sparePart = await prisma.sparePart.findUnique({
        where: { id: parseInt(id) },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!sparePart) {
        return res.status(404).json({ error: 'Spare part not found' });
      }

      res.json({ sparePart });
      return;
    } catch (error) {
      logger.error('Get spare part error:', error);
      res.status(500).json({ error: 'Failed to fetch spare part' });
      return;
    }
  }

  // Create new spare part (admin only)
  static async createSparePart(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        name,
        partNumber,
        description,
        category,
        basePrice,
        imageUrl,
        specifications,
        status = 'ACTIVE',
      } = req.body;

      // Validation
      if (!name || !partNumber || !basePrice) {
        return res.status(400).json({
          error: 'Name, part number, and base price are required'
        });
      }

      // Check if part number already exists
      const existingPart = await prisma.sparePart.findUnique({
        where: { partNumber },
      });

      if (existingPart) {
        return res.status(400).json({
          error: 'Part number already exists'
        });
      }

      const sparePart = await prisma.sparePart.create({
        data: {
          name,
          partNumber,
          description,
          category,
          basePrice: parseFloat(basePrice),
          imageUrl,
          specifications: specifications ? JSON.stringify(specifications) : null,
          status,
          createdById: req.user!.id,
          updatedById: req.user!.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      logger.info(`Spare part created: ${sparePart.partNumber} by ${req.user?.email || 'unknown'}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'SPARE_PART_CREATED',
        entityType: 'SparePart',
        entityId: sparePart.id.toString(),
        details: {
          name: sparePart.name,
          partNumber: sparePart.partNumber,
          basePrice: sparePart.basePrice
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({ sparePart });
      return;
    } catch (error) {
      logger.error('Create spare part error:', error);
      res.status(500).json({ error: 'Failed to create spare part' });
      return;
    }
  }

  // Update spare part (admin only)
  static async updateSparePart(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        createdBy: _createdBy,
        updatedBy: _updatedBy,
        offerSpareParts: _offerSpareParts,
        ...updates
      } = req.body;

      const existingSparePart = await prisma.sparePart.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingSparePart) {
        return res.status(404).json({ error: 'Spare part not found' });
      }

      // If updating part number, check for duplicates
      if (updates.partNumber && updates.partNumber !== existingSparePart.partNumber) {
        const existingPart = await prisma.sparePart.findUnique({
          where: { partNumber: updates.partNumber },
        });

        if (existingPart) {
          return res.status(400).json({
            error: 'Part number already exists'
          });
        }
      }

      // Handle specifications as JSON
      if (updates.specifications && typeof updates.specifications === 'object') {
        updates.specifications = JSON.stringify(updates.specifications);
      }

      // Convert basePrice to float if provided
      if (updates.basePrice !== undefined) {
        updates.basePrice = parseFloat(updates.basePrice.toString());
      }

      const sparePart = await prisma.sparePart.update({
        where: { id: parseInt(id) },
        data: {
          ...updates,
          updatedById: req.user!.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      logger.info(`Spare part updated: ${sparePart.partNumber} by ${req.user?.email || 'unknown'}`);

      // Log activity
      await ActivityController.logSparePartUpdate({
        sparePartId: sparePart.id,
        partNumber: sparePart.partNumber,
        oldData: existingSparePart,
        newData: updates,
        userId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ sparePart });
      return;
    } catch (error) {
      logger.error('Update spare part error:', error);
      res.status(500).json({ error: 'Failed to update spare part' });
      return;
    }
  }

  // Delete spare part (admin only)
  static async deleteSparePart(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const sparePart = await prisma.sparePart.findUnique({
        where: { id: parseInt(id) },
      });

      if (!sparePart) {
        return res.status(404).json({ error: 'Spare part not found' });
      }

      // Soft delete by setting status to INACTIVE
      const updatedSparePart = await prisma.sparePart.update({
        where: { id: parseInt(id) },
        data: {
          status: 'INACTIVE',
          updatedById: req.user!.id,
        },
      });

      logger.info(`Spare part updated: ${updatedSparePart.partNumber} by ${req.user?.email || 'unknown'}`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'SPARE_PART_DELETED',
        entityType: 'SparePart',
        entityId: id,
        details: {
          name: updatedSparePart.name,
          partNumber: updatedSparePart.partNumber
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ message: 'Spare part deleted successfully' });
      return;
    } catch (error) {
      logger.error('Delete spare part error:', error);
      res.status(500).json({ error: 'Failed to delete spare part' });
      return;
    }
  }

  // Upload spare part image
  static async uploadImage(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
      }

      // The file is already saved by multer to STORAGE_DIR
      const filename = req.file.filename;
      const imageUrl = `/storage/images/spare-parts/${filename}`;

      res.status(200).json({
        message: 'Image uploaded successfully',
        imageUrl
      });
      return;
    } catch (error) {
      logger.error('Upload spare part image error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
      return;
    }
  }

  // Get spare part categories
  static async getCategories(req: AuthenticatedRequest, res: Response) {
    try {
      const categories = await prisma.sparePart.findMany({
        where: {
          status: 'ACTIVE',
          category: {
            not: null,
          },
        },
        select: {
          category: true,
        },
        distinct: ['category'],
        orderBy: {
          category: 'asc',
        },
      });

      const categoryList = categories
        .map((item: any) => item.category)
        .filter(Boolean) as string[];

      res.json({ categories: categoryList });
      return;
    } catch (error) {
      logger.error('Get categories error:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
      return;
    }
  }

  // Bulk update prices (admin only)
  static async bulkUpdatePrices(req: AuthenticatedRequest, res: Response) {
    try {
      const { updates } = req.body; // Array of { id, basePrice }

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'Updates array is required' });
      }

      const updatedResults = await prisma.$transaction(
        updates
          .filter(update => update.id && update.basePrice)
          .map(update =>
            prisma.sparePart.update({
              where: { id: parseInt(update.id) },
              data: {
                basePrice: parseFloat(update.basePrice),
                updatedById: req.user!.id,
              },
            })
          )
      );

      logger.info(`Bulk price update completed by ${req.user?.email || 'unknown'}. ${updatedResults.length} parts updated.`);

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'BULK_PRICE_UPDATED',
        entityType: 'SparePart',
        entityId: 'SYSTEM',
        details: {
          count: updatedResults.length,
          updates: updates.map(u => ({ id: u.id, price: u.basePrice }))
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        message: `Successfully updated ${updatedResults.length} spare parts`,
        updatedParts: updatedResults
      });
      return;
    } catch (error) {
      logger.error('Bulk update prices error:', error);
      res.status(500).json({ error: 'Failed to bulk update prices' });
      return;
    }
  }

  // Preview bulk import from Excel file
  static async previewBulkImport(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Read file buffer
      const fileBuffer = await fs.readFile(req.file.path);

      // Get existing part IDs for upsert detection
      const existingParts = await prisma.sparePart.findMany({
        select: { partNumber: true },
      });
      const existingPartIds = existingParts.map((p: { partNumber: string }) => p.partNumber);

      // Preview import
      const result = await SparePartImportService.previewImport(fileBuffer, existingPartIds);

      // Clean up temp file
      await fs.unlink(req.file.path).catch(() => { });

      logger.info(`Bulk import preview: ${result.totalRows} rows, ${result.validRows} valid, ${result.imagesFound} images`);

      res.json(result);
      return;
    } catch (error: any) {
      logger.error('Preview bulk import error:', error);
      // Clean up temp file on error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => { });
      }
      res.status(500).json({ error: error.message || 'Failed to preview import' });
      return;
    }
  }

  // Execute bulk import from Excel
  static async bulkImport(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Read file buffer
      const fileBuffer = await fs.readFile(req.file.path);

      // Parse Excel
      const { rows } = await SparePartImportService.parseSparePartsExcel(fileBuffer);

      // Filter valid rows only
      const validRows = rows.filter(r => r._isValid);

      if (validRows.length === 0) {
        await fs.unlink(req.file.path).catch(() => { });
        return res.status(400).json({ error: 'No valid rows to import' });
      }

      // Get existing parts for upsert
      const existingParts = await prisma.sparePart.findMany({
        select: { id: true, partNumber: true },
      });
      const existingMap = new Map(existingParts.map((p: { id: number; partNumber: string }) => [p.partNumber.toLowerCase(), p.id]));

      let created = 0;
      let updated = 0;
      let failed = 0;
      const errors: { rowNumber: number; error: string }[] = [];

      // Process each row
      for (const row of validRows) {
        try {
          // Build description from available fields
          let description = '';
          if (row.hsnCode) description += `HSN Code: ${row.hsnCode}\n`;
          if (row.useApplication) description += `Use/Application: ${row.useApplication}\n`;
          if (row.modelSpec) description += `Model Specification: ${row.modelSpec}\n`;
          if (row.manufacturingUnit) description += `Manufacturing Unit: ${row.manufacturingUnit}`;

          // Handle image storage
          let imageUrl: string | null = null;
          if (row.imageDataUrl) {
            try {
              imageUrl = await SparePartImportService.storeSparePartImage(row.imageDataUrl, row.partId);
            } catch (imgError) {
              logger.warn(`Failed to store image for ${row.partId}:`, imgError);
            }
          }

          const existingId = existingMap.get(row.partId.toLowerCase());

          if (existingId) {
            // Update existing
            await prisma.sparePart.update({
              where: { id: existingId },
              data: {
                name: row.productName,
                description: description.trim() || undefined,
                specifications: row.technicalSheet ? JSON.stringify({ technicalSheet: row.technicalSheet }) : undefined,
                imageUrl: imageUrl || undefined,
                updatedById: req.user!.id,
              },
            });
            updated++;
          } else {
            // Create new
            const newPart = await prisma.sparePart.create({
              data: {
                name: row.productName,
                partNumber: row.partId,
                description: description.trim() || null,
                category: null,
                basePrice: row.basePrice ? parseFloat(row.basePrice.toString()) : 0,
                imageUrl,
                specifications: row.technicalSheet ? JSON.stringify({ technicalSheet: row.technicalSheet }) : null,
                status: 'ACTIVE',
                createdById: req.user!.id,
                updatedById: req.user!.id,
              },
            });

            // Add to map to prevent duplicate creation if same partId appears again in same file
            existingMap.set(row.partId.toLowerCase(), newPart.id);
            created++;
          }
        } catch (rowError: any) {
          failed++;
          errors.push({ rowNumber: row.rowNumber, error: rowError.message });
        }
      }

      // Clean up temp file
      await fs.unlink(req.file.path).catch(() => { });

      // Log activity
      await ActivityController.logActivity({
        userId: req.user!.id,
        action: 'BULK_IMPORT_SPARE_PARTS',
        entityType: 'SparePart',
        entityId: 'SYSTEM',
        details: {
          created,
          updated,
          failed,
          totalRows: validRows.length,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      logger.info(`Bulk import completed by ${req.user?.email}: ${created} created, ${updated} updated, ${failed} failed`);

      res.json({
        message: `Import completed: ${created} created, ${updated} updated, ${failed} failed`,
        created,
        updated,
        failed,
        errors,
      });
      return;
    } catch (error: any) {
      logger.error('Bulk import error:', error);
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => { });
      }
      res.status(500).json({ error: error.message || 'Failed to import spare parts' });
      return;
    }
  }

  // Download import template
  static async downloadImportTemplate(_req: AuthenticatedRequest, res: Response) {
    try {
      // Create template workbook
      const workbook = XLSX.utils.book_new();

      // Template headers matching expected format
      const headers = [
        'HSN Code',
        'Product Name',
        'Part ID',
        '(Use/Application of product)',
        'Model Specification',
        'Manufacturing Unit',
        'Ratings/Technical sheet',
        'Image and brochures of product',
      ];

      // Sample row
      const sampleRow = [
        '84139100',
        'Sample Pump Assembly',
        'SP-001',
        'Industrial use for fluid transfer',
        'Model XYZ-123',
        'Chennai Plant',
        '5HP, 50Hz, 220V',
        '(Embed image in this cell)',
      ];

      const data = [headers, sampleRow];
      const worksheet = XLSX.utils.aoa_to_sheet(data);

      // Set column widths
      worksheet['!cols'] = headers.map(() => ({ wch: 25 }));

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Spare Parts Template');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Spare_Parts_Import_Template.xlsx');
      res.send(buffer);
      return;
    } catch (error) {
      logger.error('Download template error:', error);
      res.status(500).json({ error: 'Failed to generate template' });
      return;
    }
  }
}
