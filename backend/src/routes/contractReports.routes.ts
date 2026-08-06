import { Router } from 'express';
import {
  getPMScheduleOverview,
  getExpiringContractsReport,
  getZoneContractSummary,
  getTechnicianPMReport,
  getCustomerPortfolioReport,
  exportContractReport
} from '../controllers/contractReports.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all contract report endpoints
router.use(authenticate);

// PM Schedule Overview — flat list of all PM visits
router.get('/pm-overview', getPMScheduleOverview);

// Expiring Contracts — contracts expiring within N days
router.get('/expiring', getExpiringContractsReport);

// Zone-wise Contract Summary — aggregated per zone
router.get('/zone-summary', getZoneContractSummary);

// Technician-wise PM Report — completion rates per technician
router.get('/technician', getTechnicianPMReport);

// Customer Contract Portfolio — grouped by customer
router.get('/customer-portfolio', getCustomerPortfolioReport);

// Export any report to Excel/PDF
router.get('/export', exportContractReport);

export default router;
