import { Router } from 'express';
import { 
  createContract, 
  listContracts, 
  getContractById, 
  updatePMSchedule, 
  deleteContract,
  updateContract,
  bulkImportContracts
} from '../controllers/contract.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all contract endpoints
router.use(authenticate);

// Get all contracts with filters
router.get('/', listContracts);

// Bulk import agreements
router.post('/bulk', bulkImportContracts);

// Get single contract details
router.get('/:id', getContractById);

// Create a new contract agreement and generate its PM cycles
router.post('/', createContract);

// Update contract details
router.put('/:id', updateContract);

// Update status of specific PM schedule cycle
router.patch('/:id/pm/:pmId', updatePMSchedule);

// Delete contract (cascades delete on PM cycles)
router.delete('/:id', deleteContract);

export default router;
