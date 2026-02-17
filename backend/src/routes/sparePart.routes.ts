import { Router } from 'express';
import { SparePartController } from '../controllers/sparePartController';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { sparePartsUpload } from '../config/sparePartsMulter';
import { sparePartImageUpload } from '../config/sparePartImageMulter';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Get all spare parts (admin, zone managers, zone users, and expert helpdesk)
router.get('/', requireRole(['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'EXPERT_HELPDESK']), SparePartController.getSparePartsWrapper);

// Get spare part categories
router.get('/categories', requireRole(['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'EXPERT_HELPDESK']), SparePartController.getCategoriesWrapper);

// Bulk update prices (admin and expert helpdesk) - MUST be before /:id routes
router.put('/bulk-update', requireRole(['ADMIN', 'EXPERT_HELPDESK']), SparePartController.bulkUpdatePricesWrapper);

// ═══════════════════════════════════════════════════════════════════════════
// BULK IMPORT ENDPOINTS (admin and expert helpdesk)
// ═══════════════════════════════════════════════════════════════════════════

// Preview bulk import from Excel file
router.post('/import/preview', requireRole(['ADMIN', 'EXPERT_HELPDESK']), sparePartsUpload.single('file'), SparePartController.previewBulkImportWrapper);

// Execute bulk import from Excel file  
router.post('/import', requireRole(['ADMIN', 'EXPERT_HELPDESK']), sparePartsUpload.single('file'), SparePartController.bulkImportWrapper);

// Download import template
router.get('/import/template', requireRole(['ADMIN', 'EXPERT_HELPDESK']), SparePartController.downloadImportTemplateWrapper);

// Image upload for single spare part
router.post('/upload', requireRole(['ADMIN', 'EXPERT_HELPDESK']), sparePartImageUpload.single('image'), SparePartController.uploadImageWrapper);

// ═══════════════════════════════════════════════════════════════════════════

// Get single spare part
router.get('/:id', requireRole(['ADMIN', 'ZONE_MANAGER', 'ZONE_USER', 'EXPERT_HELPDESK']), SparePartController.getSparePartWrapper);

// Create spare part (admin and expert helpdesk)
router.post('/', requireRole(['ADMIN', 'EXPERT_HELPDESK']), SparePartController.createSparePartWrapper);

// Update spare part (admin and expert helpdesk)
router.put('/:id', requireRole(['ADMIN', 'EXPERT_HELPDESK']), SparePartController.updateSparePartWrapper);

// Delete spare part (admin and expert helpdesk)
router.delete('/:id', requireRole(['ADMIN', 'EXPERT_HELPDESK']), SparePartController.deleteSparePartWrapper);

export default router;
