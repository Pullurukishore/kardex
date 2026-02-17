import { Router } from 'express';
import { OfferController } from '../controllers/offerController';
import { authenticate } from '../middleware/auth.middleware';

import multer from 'multer';

const router = Router();

// Configure multer for offer imports (using memory storage for buffer access)
const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Apply authentication middleware to all routes
router.use(authenticate);

// Import offers from Excel (admin only)
router.post('/import', importUpload.single('file'), OfferController.importOffersWrapper);
router.post('/import/preview', importUpload.single('file'), OfferController.previewImportOffersWrapper);

// Get next offer reference number (for preview)
router.get('/next-reference', OfferController.getNextOfferReferenceNumberWrapper);

// Quote generation endpoints (must come before /:id route)
// Zone manager/user quote endpoint
router.get('/quote/zone/:id', OfferController.getOfferForQuoteWrapper);

// Admin quote endpoint
router.get('/quote/admin/:id', OfferController.getOfferForQuoteAdminWrapper);

// Get all offers (both admin and zone users)
router.get('/', OfferController.getOffersWrapper);

// Get offer activity log (must come before /:id route)
router.get('/:id/activity-log', OfferController.getOfferActivityLogWrapper);

// Get single offer
router.get('/:id', OfferController.getOfferWrapper);


// Create offer (both admin and zone users)
router.post('/', OfferController.createOfferWrapper);

// Update offer (both admin and zone users)
router.put('/:id', OfferController.updateOfferWrapper);

// Update offer status
router.patch('/:id/status', OfferController.updateStatusWrapper);

// Delete offer (admin only)
router.delete('/:id', OfferController.deleteOfferWrapper);

// Add note to offer
router.post('/:id/notes', OfferController.addNoteWrapper);

export default router;
