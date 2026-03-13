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
import * as bankReportsController from '../../controllers/ar/bankReports.controller';
import * as paymentBatchController from '../../controllers/ar/paymentBatch.controller';

// Import auth middleware
import { authenticate } from '../../middleware/auth.middleware';

// Import finance middleware
import {
    requireFinanceAccess,
    requireFinanceAdmin,
    requireFinanceWrite,
    requireFinanceRead,
    requireARRead,
    requireFinanceDelete,
    requireFinanceApprover,
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
router.get('/dashboard/essential', requireARRead, dashboardController.getEssentialDashboard);

// Legacy endpoints (backward compatibility)
router.get('/dashboard/kpis', requireARRead, dashboardController.getDashboardKPIs);
router.get('/dashboard/aging', requireARRead, dashboardController.getAgingAnalysis);
router.get('/dashboard/collection-trend', requireARRead, dashboardController.getCollectionTrend);
router.get('/dashboard/status-distribution', requireARRead, dashboardController.getStatusDistribution);
router.get('/dashboard/risk-distribution', requireARRead, dashboardController.getRiskDistribution);
router.get('/dashboard/critical-overdue', requireARRead, dashboardController.getCriticalOverdue);
router.get('/dashboard/top-customers', requireARRead, dashboardController.getTopCustomers);
router.get('/dashboard/recent-payments', requireARRead, dashboardController.getRecentPayments);


// ═══════════════════════════════════════════════════════════════════════════
// INVOICE ROUTES
// View: All | Create/Edit: Admin & User | Delete: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/invoices', requireARRead, invoiceController.getAllInvoices);

router.get('/invoices/:id', requireARRead, invoiceController.getInvoiceById);
router.post('/invoices', requireFinanceWrite, invoiceController.createInvoice);
router.put('/invoices/:id', requireFinanceWrite, invoiceController.updateInvoice);
router.delete('/invoices/:id', requireFinanceDelete, invoiceController.deleteInvoice);
router.put('/invoices/:id/delivery', requireFinanceWrite, invoiceController.updateDeliveryTracking);
router.post('/invoices/update-overdue', requireFinanceWrite, invoiceController.updateOverdueStatus);
router.post('/invoices/:id/payments', requireFinanceWrite, invoiceController.addPaymentRecord);
router.put('/invoices/:id/payments/:paymentId', requireFinanceWrite, invoiceController.updatePaymentRecord);
router.delete('/invoices/:id/payments/:paymentId', requireFinanceWrite, invoiceController.deletePaymentRecord);
router.get('/invoices/:id/remarks', requireARRead, invoiceController.getInvoiceRemarks);
router.post('/invoices/:id/remarks', requireFinanceWrite, invoiceController.addInvoiceRemark);
router.get('/invoices/:id/activity', requireARRead, invoiceController.getInvoiceActivityLog);

// Milestone Invoice Linking Routes
router.get('/invoices/:id/matching-milestones', requireARRead, invoiceController.getMatchingMilestones);
router.post('/invoices/:id/accept-milestone', requireFinanceWrite, invoiceController.acceptMilestone);
router.get('/invoices/:id/linked-milestone', requireARRead, invoiceController.getLinkedMilestoneDetails);


// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER ROUTES
// View: All | Create/Edit: Admin & User | Delete: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/customers', requireARRead, customerController.getAllCustomers);
router.get('/customers/:id', requireARRead, customerController.getCustomerById);
router.post('/customers', requireFinanceWrite, customerController.createCustomer);
router.put('/customers/:id', requireFinanceWrite, customerController.updateCustomer);
router.delete('/customers/:id', requireFinanceDelete, customerController.deleteCustomer);

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT TERMS ROUTES
// View: All | Create/Edit: Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/payment-terms', requireARRead, paymentTermsController.getAllPaymentTerms);
router.post('/payment-terms', requireFinanceAdmin, paymentTermsController.createPaymentTerm);
router.post('/payment-terms/seed', requireFinanceAdmin, paymentTermsController.seedPaymentTerms);
router.get('/payment-terms/:id', requireARRead, paymentTermsController.getPaymentTermById);
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
router.post('/bank-accounts/import/excel', requireFinanceWrite, bankAccountImportController.importFromExcel);
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
router.get('/reports/aging/detailed', requireARRead, reportsController.getDetailedAgingReport);
router.get('/reports/aging/summary', requireARRead, reportsController.getAgingSummary);
router.get('/reports/aging/customer', requireARRead, reportsController.getCustomerAgingReport);
router.get('/reports/aging/risk', requireARRead, reportsController.getRiskAgingReport);

// Collection Reports
router.get('/reports/collections/trends', requireARRead, reportsController.getCollectionTrends);
router.get('/reports/collections/payment-modes', requireARRead, reportsController.getPaymentModeAnalysis);
router.get('/reports/collections/bankwise', requireARRead, reportsController.getBankwiseCollections);
router.get('/reports/dso', requireARRead, reportsController.getDSOReport);

// Customer Reports
router.get('/reports/customers/outstanding', requireARRead, reportsController.getTopOutstandingCustomers);
router.get('/reports/customers/risk', requireARRead, reportsController.getCustomerRiskReport);

// Invoice Reports
router.get('/reports/invoices/status', requireARRead, reportsController.getInvoiceStatusSummary);
router.get('/reports/invoices/milestone', requireARRead, reportsController.getMilestoneAnalysisReport);
router.get('/reports/invoices/delivery', requireARRead, reportsController.getDeliveryStatusReport);

// Bank Account Reports
router.get('/reports/bank-accounts/audit', requireFinanceRead, bankReportsController.getVendorMasterAudit);
router.get('/reports/bank-accounts/compliance', requireFinanceRead, bankReportsController.getComplianceMetrics);
router.get('/reports/bank-accounts/payments', requireFinanceRead, bankReportsController.getPaymentVolumeInsights);

// Legacy report endpoints (backward compatibility)
router.get('/reports/aging', requireARRead, reportsController.getAgingReport);
router.get('/reports/collection-efficiency', requireARRead, reportsController.getCollectionEfficiency);

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT BATCH ROUTES - Request & Approval Workflow
// Submit: Finance User+ | Review/Download: Admin & Approver
// ═══════════════════════════════════════════════════════════════════════════
router.get('/payment-batches/stats', requireFinanceApprover, paymentBatchController.getBatchStats);
router.get('/payment-batches/pending', requireFinanceApprover, paymentBatchController.getPendingBatches);
router.get('/payment-batches/my', requireFinanceRead, paymentBatchController.getMyBatches);
router.get('/payment-batches/:id', requireFinanceRead, paymentBatchController.getBatchById);
router.post('/payment-batches', requireFinanceWrite, paymentBatchController.submitBatch);
router.put('/payment-batches/:id/review', requireFinanceApprover, paymentBatchController.reviewBatch);
router.get('/payment-batches/:id/download', requireFinanceRead, paymentBatchController.downloadBatch);
router.put('/payment-batches/:id/resubmit', requireFinanceWrite, paymentBatchController.resubmitRejectedItems);
router.delete('/payment-batches/:id/items/:itemId', requireFinanceWrite, paymentBatchController.deleteBatchItem);

export default router;
