import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { ForecastController } from '../controllers/forecast.controller';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Get zone-wise summary (Offers Highlights)
router.get(
    '/summary',
    requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']),
    ForecastController.getZoneSummaryWrapper
);

// Get monthly breakdown for all zones
router.get(
    '/monthly',
    requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']),
    ForecastController.getMonthlyBreakdownWrapper
);

// Get monthly breakdown for all users (similar to zones)
router.get(
    '/user-monthly',
    requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK', 'ZONE_USER']),
    ForecastController.getUserMonthlyBreakdownWrapper
);

// Get PO Expected Month breakdown (Zone-wise and User-wise)
router.get(
    '/po-expected',
    requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK', 'ZONE_USER']),
    ForecastController.getPOExpectedMonthWrapper
);

// Get Product × User × Zone breakdown
router.get(
    '/product-user-zone',
    requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK', 'ZONE_USER']),
    ForecastController.getProductUserZoneBreakdownWrapper
);

// Get Product-wise Forecast (Zone → User → Product × Months)
router.get(
    '/product-wise',
    requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK', 'ZONE_USER']),
    ForecastController.getProductWiseForecastWrapper
);

// Get Comprehensive Forecast Analytics
router.get(
    '/analytics',
    requireRole(['ADMIN', 'ZONE_MANAGER', 'EXPERT_HELPDESK']),
    ForecastController.getForecastAnalyticsWrapper
);

// Get Growth Report data (Target vs Offer Value vs Won, with filters)
router.get(
    '/growth-report',
    requireRole(['ADMIN']),
    ForecastController.getGrowthReportWrapper
);

export default router;


