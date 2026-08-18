import { Router } from 'express';
import {
  listDetailedContracts,
  getDetailedContractStats,
  getCustomerGroupedContracts,
  getDetailedContractById,
  createDetailedContract,
  updateDetailedContract,
  deleteDetailedContract,
  bulkImportDetailedContracts,
  exportDetailedContracts,
} from '../controllers/detailedContract.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all endpoints
router.use(authenticate);

// Stats / KPI counters
router.get('/stats', getDetailedContractStats);

// Customer-grouped view
router.get('/customer-grouped', getCustomerGroupedContracts);

// Export
router.get('/export', exportDetailedContracts);

// Bulk import (Sheet 2 format)
router.post('/bulk-import', bulkImportDetailedContracts);

// CRUD
router.get('/', listDetailedContracts);
router.get('/:id', getDetailedContractById);
router.post('/', createDetailedContract);
router.put('/:id', updateDetailedContract);
router.delete('/:id', deleteDetailedContract);

export default router;
