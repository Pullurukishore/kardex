import { Router } from 'express';
import multer from 'multer';

// Import controllers
import * as invoiceController from '../../controllers/ar/arInvoice.controller';
import * as customerController from '../../controllers/ar/arCustomer.controller';
import * as paymentTermsController from '../../controllers/ar/arPaymentTerms.controller';
import * as importController from '../../controllers/ar/arImport.controller';
import * as bankAccountController from '../../controllers/ar/bankAccount.controller';
import * as bankAccountRequestController from '../../controllers/ar/bankAccountRequest.controller';
import * as bankAccountAttachmentController from '../../controllers/ar/bankAccountAttachment.controller';
import * as bankAccountImportController from '../../controllers/ar/bankAccountImport.controller';
import * as bankAccountActivityController from '../../controllers/ar/bankAccountActivityLog.controller';
import { bankDocUpload } from '../../config/bankDocMulter';
import * as financeUserController from '../../controllers/ar/financeUser.controller';
import * as dashboardController from '../../controllers/ar/arDashboard.controller';
import * as activityController from '../../controllers/ar/arTotalActivity.controller';
import * as reportsController from '../../controllers/ar/arReports.controller';

// Import auth middleware
import { authenticate } from '../../middleware/auth.middleware';

// Import finance middleware
import {
    requireFinanceAccess,
    requireFinanceAdmin,
    requireFinanceWrite,
    requireFinanceRead,
    requireFinanceDelete,
} from '../../middleware/finance.middleware';

const router = Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication first, then finance access check to all AR routes
router.use(authenticate);
router.use(requireFinanceAccess);

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES
// View: All finance users
// ═══════════════════════════════════════════════════════════════════════════
// NEW: Essential dashboard with performance indicators
router.get('/dashboard/essential', requireFinanceRead, dashboardController.getEssentialDashboard);

// Legacy endpoints (backward compatibility)
router.get('/dashboard/kpis', requireFinanceRead, dashboardController.getDashboardKPIs);
router.get('/dashboard/aging', requireFinanceRead, dashboardController.getAgingAnalysis);
router.get('/dashboard/collection-trend', requireFinanceRead, dashboardController.getCollectionTrend);
router.get('/dashboard/status-distribution', requireFinanceRead, dashboardController.getStatusDistribution);
router.get('/dashboard/risk-distribution', requireFinanceRead, dashboardController.getRiskDistribution);
router.get('/dashboard/critical-overdue', requireFinanceRead, dashboardController.getCriticalOverdue);
router.get('/dashboard/top-customers', requireFinanceRead, dashboardController.getTopCustomers);
router.get('/dashboard/recent-payments', requireFinanceRead, dashboardController.getRecentPayments);


// ═══════════════════════════════════════════════════════════════════════════
// INVOICE ROUTES
// View: All | Create/Edit: Admin & User | Delete: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/invoices', requireFinanceRead, invoiceController.getAllInvoices);

router.get('/invoices/:id', requireFinanceRead, invoiceController.getInvoiceById);
router.post('/invoices', requireFinanceWrite, invoiceController.createInvoice);
router.put('/invoices/:id', requireFinanceWrite, invoiceController.updateInvoice);
router.delete('/invoices/:id', requireFinanceDelete, invoiceController.deleteInvoice);
router.put('/invoices/:id/delivery', requireFinanceWrite, invoiceController.updateDeliveryTracking);
router.post('/invoices/update-overdue', requireFinanceWrite, invoiceController.updateOverdueStatus);
router.post('/invoices/:id/payments', requireFinanceWrite, invoiceController.addPaymentRecord);
router.put('/invoices/:id/payments/:paymentId', requireFinanceWrite, invoiceController.updatePaymentRecord);
router.delete('/invoices/:id/payments/:paymentId', requireFinanceWrite, invoiceController.deletePaymentRecord);
router.get('/invoices/:id/remarks', requireFinanceRead, invoiceController.getInvoiceRemarks);
router.post('/invoices/:id/remarks', requireFinanceWrite, invoiceController.addInvoiceRemark);
router.get('/invoices/:id/activity', requireFinanceRead, invoiceController.getInvoiceActivityLog);

// Prepaid Invoice Linking Routes
router.get('/invoices/:id/matching-prepaids', requireFinanceRead, invoiceController.getMatchingPrepaids);
router.post('/invoices/:id/accept-prepaid', requireFinanceWrite, invoiceController.acceptPrepaid);
router.get('/invoices/:id/linked-prepaid', requireFinanceRead, invoiceController.getLinkedPrepaidDetails);


// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER ROUTES
// View: All | Create/Edit: Admin & User | Delete: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/customers', requireFinanceRead, customerController.getAllCustomers);
router.get('/customers/:id', requireFinanceRead, customerController.getCustomerById);
router.post('/customers', requireFinanceWrite, customerController.createCustomer);
router.put('/customers/:id', requireFinanceWrite, customerController.updateCustomer);
router.delete('/customers/:id', requireFinanceDelete, customerController.deleteCustomer);

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT TERMS ROUTES
// View: All | Create/Edit: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/payment-terms', requireFinanceRead, paymentTermsController.getAllPaymentTerms);
router.post('/payment-terms', requireFinanceAdmin, paymentTermsController.createPaymentTerm);
router.post('/payment-terms/seed', requireFinanceAdmin, paymentTermsController.seedPaymentTerms);
router.get('/payment-terms/:id', requireFinanceRead, paymentTermsController.getPaymentTermById);
router.put('/payment-terms/:id', requireFinanceAdmin, paymentTermsController.updatePaymentTerm);

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT ROUTES
// View: All finance users | Create/Update/Delete: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/bank-accounts', requireFinanceRead, bankAccountController.getAllBankAccounts);
router.get('/bank-accounts/:id', requireFinanceRead, bankAccountController.getBankAccountById);
router.post('/bank-accounts', requireFinanceAdmin, bankAccountController.createBankAccount);
router.put('/bank-accounts/:id', requireFinanceAdmin, bankAccountController.updateBankAccount);
router.delete('/bank-accounts/:id', requireFinanceAdmin, bankAccountController.deleteBankAccount);

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT CHANGE REQUEST ROUTES
// View own requests: All | Approve/Reject: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/bank-accounts/requests/stats', requireFinanceRead, bankAccountRequestController.getRequestStats);
router.get('/bank-accounts/requests/pending', requireFinanceAdmin, bankAccountRequestController.getPendingRequests);
router.get('/bank-accounts/requests/my', requireFinanceRead, bankAccountRequestController.getMyRequests);
router.get('/bank-accounts/requests/:id', requireFinanceRead, bankAccountRequestController.getRequestById);
router.post('/bank-accounts/requests', requireFinanceWrite, bankAccountRequestController.createChangeRequest);
router.post('/bank-accounts/requests/:id/approve', requireFinanceAdmin, bankAccountRequestController.approveRequest);
router.post('/bank-accounts/requests/:id/reject', requireFinanceAdmin, bankAccountRequestController.rejectRequest);

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT ATTACHMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/bank-accounts/:id/attachments', requireFinanceRead, bankAccountAttachmentController.getAttachments);
router.post('/bank-accounts/:id/attachments', requireFinanceWrite, bankDocUpload.single('file'), bankAccountAttachmentController.uploadAttachment);
router.get('/bank-accounts/attachments/:attachmentId/download', requireFinanceRead, bankAccountAttachmentController.downloadAttachment);
router.put('/bank-accounts/attachments/:attachmentId/vendor-type', requireFinanceWrite, bankAccountAttachmentController.updateAttachmentVendorType);
router.delete('/bank-accounts/attachments/:attachmentId', requireFinanceAdmin, bankAccountAttachmentController.deleteAttachment);

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT ACTIVITY LOG ROUTES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/bank-accounts/:id/activities', requireFinanceRead, bankAccountActivityController.getActivityLogs);
router.get('/bank-accounts/activities/recent', requireFinanceAdmin, bankAccountActivityController.getRecentActivities);
router.get('/bank-accounts/activities/stats', requireFinanceAdmin, bankAccountActivityController.getActivityStats);

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT IMPORT ROUTES
// ═══════════════════════════════════════════════════════════════════════════
router.post('/bank-accounts/import/preview', requireFinanceWrite, upload.single('file'), bankAccountImportController.previewExcel);
router.post('/bank-accounts/import/excel', requireFinanceAdmin, bankAccountImportController.importFromExcel);
router.get('/bank-accounts/import/template', requireFinanceRead, bankAccountImportController.downloadTemplate);

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT ROUTES - Admin & User can import
// ═══════════════════════════════════════════════════════════════════════════
router.post('/import/preview', requireFinanceWrite, upload.single('file'), importController.previewExcel);
router.post('/import/excel', requireFinanceWrite, upload.single('file'), importController.importFromExcel);
router.get('/import/history', requireFinanceRead, importController.getImportHistory);
router.get('/import/template', requireFinanceRead, importController.downloadTemplate);
router.post('/import/recalculate', requireFinanceAdmin, importController.recalculateAll);

// ═══════════════════════════════════════════════════════════════════════════
// FINANCE USER ROUTES - Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/finance-users', requireFinanceAdmin, financeUserController.getFinanceUsers);
router.get('/finance-users/stats', requireFinanceAdmin, financeUserController.getFinanceUserStats);
router.get('/finance-users/:id', requireFinanceAdmin, financeUserController.getFinanceUserById);
router.post('/finance-users', requireFinanceAdmin, financeUserController.createFinanceUser);
router.put('/finance-users/:id', requireFinanceAdmin, financeUserController.updateFinanceUser);
router.delete('/finance-users/:id', requireFinanceAdmin, financeUserController.deleteFinanceUser);

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG ROUTES - Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/activities', requireFinanceAdmin, activityController.getAllActivities);
router.get('/activities/stats', requireFinanceAdmin, activityController.getActivityStats);
router.get('/activities/recent', requireFinanceAdmin, activityController.getRecentActivities);

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS ROUTES - Finance users can view, Admin for full access
// ═══════════════════════════════════════════════════════════════════════════

// Aging Reports
router.get('/reports/aging/detailed', requireFinanceRead, reportsController.getDetailedAgingReport);
router.get('/reports/aging/summary', requireFinanceRead, reportsController.getAgingSummary);
router.get('/reports/aging/customer', requireFinanceRead, reportsController.getCustomerAgingReport);
router.get('/reports/aging/risk', requireFinanceRead, reportsController.getRiskAgingReport);

// Collection Reports
router.get('/reports/collections/trends', requireFinanceRead, reportsController.getCollectionTrends);
router.get('/reports/collections/payment-modes', requireFinanceRead, reportsController.getPaymentModeAnalysis);
router.get('/reports/collections/bankwise', requireFinanceRead, reportsController.getBankwiseCollections);
router.get('/reports/dso', requireFinanceRead, reportsController.getDSOReport);

// Customer Reports
router.get('/reports/customers/outstanding', requireFinanceRead, reportsController.getTopOutstandingCustomers);
router.get('/reports/customers/risk', requireFinanceRead, reportsController.getCustomerRiskReport);

// Invoice Reports
router.get('/reports/invoices/status', requireFinanceRead, reportsController.getInvoiceStatusSummary);
router.get('/reports/invoices/prepaid', requireFinanceRead, reportsController.getPrepaidAnalysisReport);
router.get('/reports/invoices/delivery', requireFinanceRead, reportsController.getDeliveryStatusReport);

// Legacy report endpoints (backward compatibility)
router.get('/reports/aging', requireFinanceRead, reportsController.getAgingReport);
router.get('/reports/collection-efficiency', requireFinanceRead, reportsController.getCollectionEfficiency);

export default router;
