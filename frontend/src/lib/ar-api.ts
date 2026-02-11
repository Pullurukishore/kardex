import api from '@/lib/api/axios';

// The centralized axios instance already has the correct baseURL set to includes /api
// So we can use relative paths like '/ar/...'

// Types
export interface ARCustomer {
    id: string;
    bpCode: string;
    customerName: string;
    region?: string;
    department?: string;
    personInCharge?: string;
    contactNo?: string;
    emailId?: string;
    riskClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    creditLimit?: number;
    totalInvoiceAmount?: number;
    outstandingBalance?: number;
    createdAt: string;
    _count?: { invoices: number };
}

export interface ARPaymentTerm {
    id: string;
    termCode: string;
    termName: string;
    dueDays: number;
    description?: string;
    isActive: boolean;
}

export interface ARInvoice {
    id: string;
    invoiceNumber: string;
    bpCode: string;
    customerName: string;
    poNo?: string;
    totalAmount: number;
    netAmount: number;
    taxAmount?: number;
    invoiceDate: string;
    dueDate?: string;
    actualPaymentTerms?: string;
    balance?: number;
    riskClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueByDays?: number;
    // Customer Master Fields
    emailId?: string;
    contactNo?: string;
    region?: string;
    department?: string;
    personInCharge?: string;
    pocName?: string;
    // Manual Tracking Fields
    receipts?: number;
    adjustments?: number;
    totalReceipts?: number;
    type?: 'LCS' | 'NB' | 'FINANCE';
    modeOfDelivery?: string;
    sentHandoverDate?: string;
    deliveryStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'ACKNOWLEDGED';
    impactDate?: string;
    comments?: string;
    status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    paymentHistory?: ARPaymentHistory[];
    createdAt?: string;
    updatedAt?: string;
    // Prepaid Invoice Fields
    invoiceType?: 'REGULAR' | 'PREPAID';
    advanceReceivedDate?: string;
    deliveryDueDate?: string;
    prepaidStatus?: 'AWAITING_DELIVERY' | 'PARTIALLY_DELIVERED' | 'FULLY_DELIVERED' | 'EXPIRED' | 'LINKED';
    // Prepaid Linking Fields
    soNo?: string;
    linkedInvoiceId?: string;
    linkedPrepaidId?: string;
    prepaidAcceptedAt?: string;
    linkedFromPrepaids?: ARInvoice[];
    linkedInvoice?: ARInvoice;
    // Prepaid Milestones & Aging
    grnDate?: string;
    bgDate?: string;
    othersDate?: string;
    agingMilestone?: 'ADVANCE' | 'INVOICE' | 'GRN' | 'BG' | 'OTHERS';
}

export interface ARPaymentHistory {
    id: string;
    invoiceId: string;
    amount: number;
    paymentDate: string;
    paymentMode: string;
    referenceNo?: string;
    referenceBank?: string;
    notes?: string;
    recordedBy?: string;
    createdAt: string;
}

export interface ARDashboardKPIs {
    totalOutstanding: number;
    overdueAmount: number;
    collectionsToday: number;
    pendingInvoices: number;
    overdueInvoices: number;
}

export interface ARAgingData {
    current: { count: number; amount: number };
    days1to30: { count: number; amount: number };
    days31to60: { count: number; amount: number };
    days61to90: { count: number; amount: number };
    over90: { count: number; amount: number };
}

// Activity types for AR Total Activity Dashboard
export interface ARActivity {
    id: string;
    type: 'INVOICE' | 'SESSION';
    action: string;
    description?: string;
    // Invoice-specific
    invoiceId?: string;
    invoiceNumber?: string;
    customerName?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    // Session-specific
    userId?: number;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    financeRole?: string;
    deviceInfo?: string;
    // Common
    performedBy?: string;
    performedById?: number;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
    createdAt: string;
}

export interface ARActivityStats {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byType: { invoice: number; session: number };
    byAction: Record<string, number>;
    todayBreakdown: { invoice: number; session: number };
}

export interface ARActivityFilters {
    fromDate?: string;
    toDate?: string;
    action?: string;
    activityType?: 'INVOICE' | 'SESSION' | 'ALL';
    userId?: number;
    invoiceId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ReportFilters {
    status?: string;
    riskClass?: string;
    customer?: string;
    fromDate?: string;
    toDate?: string;
    bucket?: string;
}

export interface AgingReportData {
    data: {
        id: string;
        invoiceNumber: string;
        bpCode: string;
        customerName: string;
        totalAmount: number;
        netAmount: number;
        balance: number;
        dueDate: string;
        invoiceDate: string;
        riskClass: string;
        status: string;
        region?: string;
        poNo?: string;
        daysOverdue: number;
        agingBucket: string;
    }[];
    summary: {
        totalInvoices: number;
        totalAmount: number;
        totalBalance: number;
    };
}

export interface AgingSummaryData {
    buckets: {
        key: string;
        label: string;
        count: number;
        amount: number;
        percentage: string;
    }[];
    total: {
        count: number;
        amount: number;
    };
}

export interface CustomerAgingData {
    customers: {
        bpCode: string;
        customerName: string;
        invoiceCount: number;
        totalBalance: number;
        riskClass: string;
        currentAmount: number;
        overdueAmount: number;
        maxDaysOverdue: number;
    }[];
    summary: {
        totalCustomers: number;
        totalBalance: number;
        totalOverdue: number;
    };
}

export interface RiskAgingData {
    risks: {
        riskClass: string;
        count: number;
        balance: number;
        totalAmount: number;
        percentage: string;
    }[];
    total: {
        count: number;
        balance: number;
    };
}

export interface CollectionTrendsData {
    trends: {
        period: string;
        amount: number;
        count: number;
    }[];
    summary: {
        totalCollected: number;
        avgCollection: number;
        totalPayments: number;
        periods: number;
    };
}

export interface PaymentModeData {
    modes: {
        mode: string;
        count: number;
        amount: number;
        percentage: string;
    }[];
    total: {
        count: number;
        amount: number;
    };
}

export interface BankwiseData {
    banks: {
        bank: string;
        count: number;
        amount: number;
        percentage: string;
    }[];
    total: {
        count: number;
        amount: number;
    };
}

export interface DSOData {
    monthly: {
        period: string;
        totalSales: number;
        endingReceivables: number;
        dso: number;
    }[];
    current: {
        dso: number;
        totalReceivables: number;
        avgMonthlySales: number;
        status: 'GOOD' | 'AVERAGE' | 'BAD';
    };
}

export interface TopCustomersData {
    customers: {
        rank: number;
        bpCode: string;
        customerName: string;
        invoiceCount: number;
        totalBalance: number;
        riskClass: string;
        region?: string;
        percentage: string;
    }[];
    summary: {
        topCustomersBalance: number;
        totalOutstanding: number;
        concentration: string;
    };
}

export interface CustomerRiskData {
    distribution: {
        riskClass: string;
        count: number;
        balance: number;
        customers: string[];
        percentage: string;
    }[];
    summary: {
        totalCustomers: number;
        highRiskCount: number;
        highRiskBalance: number;
        totalBalance: number;
    };
}

export interface InvoiceStatusData {
    statuses: {
        status: string;
        count: number;
        totalAmount: number;
        balance: number;
        countPercentage: string;
        amountPercentage: string;
    }[];
    summary: {
        totalInvoices: number;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        collectionRate: string;
    };
}

export interface PrepaidAnalysisData {
    byType: {
        type: string;
        count: number;
        totalAmount: number;
        balance: number;
        paid: number;
        paidPercentage: string;
    }[];
    prepaidStatuses: {
        status: string;
        count: number;
        amount: number;
    }[];
    summary: {
        totalInvoices: number;
        regularCount: number;
        prepaidCount: number;
        prepaidPercentage: string;
    };
}

export interface DeliveryStatusData {
    statuses: {
        status: string;
        count: number;
        amount: number;
        percentage: string;
    }[];
    summary: {
        totalPending: number;
        totalDelivered: number;
        pendingAmount: number;
        deliveredAmount: number;
    };
}

// Matching Prepaid Invoice type for linking
export interface MatchingPrepaid {
    id: string;
    invoiceNumber: string;
    soNo?: string;
    poNo?: string;
    totalAmount: number;
    netAmount?: number;
    receipts?: number;
    totalReceipts?: number;
    balance?: number;
    advanceReceivedDate?: string;
    prepaidStatus?: string;
    customerName: string;
    bpCode: string;
    invoiceDate: string;
    status: string;
    payments: {
        id: string;
        amount: number;
        paymentDate: string;
        paymentMode: string;
        referenceNo?: string;
    }[];
    totalPayments: number;
}


// API Functions
export const arApi = {
    // ═══════════════════════════════════════════════════════════════════════════
    // Essential Dashboard with Performance Indicators
    // ═══════════════════════════════════════════════════════════════════════════

    async getEssentialDashboard(): Promise<any> {
        const res = await api.get('/ar/dashboard/essential');
        return res.data;
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // Legacy Dashboard Endpoints
    // ═══════════════════════════════════════════════════════════════════════════

    async getDashboardKPIs(): Promise<ARDashboardKPIs> {
        const res = await api.get('/ar/dashboard/kpis');
        return res.data;
    },

    async getAgingAnalysis(): Promise<ARAgingData> {
        const res = await api.get('/ar/dashboard/aging');
        return res.data;
    },

    async getStatusDistribution(): Promise<any> {
        const res = await api.get('/ar/dashboard/status-distribution');
        return res.data;
    },

    async getRiskDistribution(): Promise<any> {
        const res = await api.get('/ar/dashboard/risk-distribution');
        return res.data;
    },

    async getCollectionTrend(): Promise<{ month: string; amount: number }[]> {
        const res = await api.get('/ar/dashboard/collection-trend');
        return res.data;
    },

    async getCriticalOverdue(limit = 10): Promise<any[]> {
        const res = await api.get(`/ar/dashboard/critical-overdue?limit=${limit}`);
        return res.data;
    },

    async getRecentPayments(limit = 10): Promise<any[]> {
        const res = await api.get(`/ar/dashboard/recent-payments?limit=${limit}`);
        return res.data;
    },

    async getTopCustomers(limit = 5): Promise<any[]> {
        const res = await api.get(`/ar/dashboard/top-customers?limit=${limit}`);
        return res.data;
    },

    async getMonthlyComparison(): Promise<any> {
        const res = await api.get('/ar/dashboard/monthly-comparison');
        return res.data;
    },

    async getDSOMetrics(): Promise<any> {
        const res = await api.get('/ar/dashboard/dso-metrics');
        return res.data;
    },


    // Customers
    async getCustomers(params?: { search?: string; page?: number; limit?: number }) {
        const res = await api.get('/ar/customers', { params });
        return res.data;
    },

    async createCustomer(data: Partial<ARCustomer>): Promise<ARCustomer> {
        const res = await api.post('/ar/customers', data);
        return res.data;
    },

    async updateCustomer(id: string, data: Partial<ARCustomer>): Promise<ARCustomer> {
        const res = await api.put(`/ar/customers/${id}`, data);
        return res.data;
    },

    async getCustomerById(id: string): Promise<ARCustomer & { invoices?: any[] }> {
        const res = await api.get(`/ar/customers/${id}`);
        return res.data;
    },

    // Payment Terms
    async getPaymentTerms(activeOnly = false): Promise<ARPaymentTerm[]> {
        const res = await api.get('/ar/payment-terms', { params: { activeOnly } });
        return res.data;
    },

    async seedPaymentTerms(): Promise<void> {
        await api.post('/ar/payment-terms/seed');
    },

    async getPaymentTermById(id: string): Promise<ARPaymentTerm> {
        const res = await api.get(`/ar/payment-terms/${id}`);
        return res.data;
    },

    async createPaymentTerm(data: Partial<ARPaymentTerm>): Promise<ARPaymentTerm> {
        const res = await api.post('/ar/payment-terms', data);
        return res.data;
    },

    async updatePaymentTerm(id: string, data: Partial<ARPaymentTerm>): Promise<ARPaymentTerm> {
        const res = await api.put(`/ar/payment-terms/${id}`, data);
        return res.data;
    },

    // Invoices
    async getInvoices(params?: { search?: string; status?: string; customerId?: string; invoiceType?: string; page?: number; limit?: number }) {
        const res = await api.get('/ar/invoices', { params });
        return res.data;
    },

    async getInvoiceById(id: string): Promise<ARInvoice> {
        const res = await api.get(`/ar/invoices/${id}`);
        return res.data;
    },

    async updateInvoice(id: string, data: Partial<ARInvoice>): Promise<ARInvoice> {
        const res = await api.put(`/ar/invoices/${id}`, data);
        return res.data;
    },

    async addPayment(invoiceId: string, data: any): Promise<ARPaymentHistory> {
        const res = await api.post(`/ar/invoices/${invoiceId}/payments`, data);
        return res.data;
    },

    async updatePayment(invoiceId: string, paymentId: string, data: any): Promise<ARPaymentHistory> {
        const res = await api.put(`/ar/invoices/${invoiceId}/payments/${paymentId}`, data);
        return res.data;
    },

    async deletePayment(invoiceId: string, paymentId: string): Promise<void> {
        await api.delete(`/ar/invoices/${invoiceId}/payments/${paymentId}`);
    },

    async createInvoice(data: Partial<ARInvoice>): Promise<ARInvoice> {
        const res = await api.post('/ar/invoices', data);
        return res.data;
    },

    async deleteInvoice(id: string): Promise<void> {
        await api.delete(`/ar/invoices/${id}`);
    },

    async getInvoiceRemarks(invoiceId: string): Promise<any[]> {
        const res = await api.get(`/ar/invoices/${invoiceId}/remarks`);
        return res.data;
    },

    async addInvoiceRemark(invoiceId: string, content: string): Promise<any> {
        const res = await api.post(`/ar/invoices/${invoiceId}/remarks`, { content });
        return res.data;
    },

    async getInvoiceActivityLog(invoiceId: string): Promise<any[]> {
        const res = await api.get(`/ar/invoices/${invoiceId}/activity`);
        return res.data;
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PREPAID INVOICE LINKING
    // ═══════════════════════════════════════════════════════════════════════════

    async getMatchingPrepaids(invoiceId: string): Promise<{
        prepaids: MatchingPrepaid[];
        hasLinkedPrepaid: boolean;
        invoicePoNo: string;
    }> {
        const res = await api.get(`/ar/invoices/${invoiceId}/matching-prepaids`);
        return res.data;
    },

    async acceptPrepaid(invoiceId: string, prepaidId: string, transferPayments = true): Promise<{
        success: boolean;
        prepaidInvoiceNumber: string;
        totalTransferred: number;
        newBalance?: number;
        newStatus?: string;
    }> {
        const res = await api.post(`/ar/invoices/${invoiceId}/accept-prepaid`, {
            prepaidId,
            transferPayments
        });
        return res.data;
    },

    async getLinkedPrepaidDetails(invoiceId: string): Promise<{
        linkedPrepaid: any;
        transferredPayments: any[];
        totalTransferred: number;
    }> {
        const res = await api.get(`/ar/invoices/${invoiceId}/linked-prepaid`);
        return res.data;
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // TOTAL ACTIVITIES - Combined invoice and session activities
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllActivities(params?: ARActivityFilters): Promise<{ data: ARActivity[]; pagination: any }> {
        const res = await api.get('/ar/activities', { params });
        return res.data;
    },

    async getActivityStats(): Promise<ARActivityStats> {
        const res = await api.get('/ar/activities/stats');
        return res.data;
    },

    async getRecentActivities(limit = 10): Promise<ARActivity[]> {
        const res = await api.get(`/ar/activities/recent?limit=${limit}`);
        return res.data;
    },


    async importExcel(file: File, selectedIndices?: number[], mapping?: any) {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedIndices && selectedIndices.length > 0) {
            formData.append('selectedIndices', JSON.stringify(selectedIndices));
        }
        if (mapping) formData.append('mapping', JSON.stringify(mapping));

        const res = await api.post('/ar/import/excel', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },

    async previewExcel(file: File) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post('/ar/import/preview', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },

    async getImportHistory() {
        const res = await api.get('/ar/import/history');
        return res.data;
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // VENDOR ACCOUNTS
    // ═══════════════════════════════════════════════════════════════════════════

    async getBankAccounts(params?: { search?: string; activeOnly?: boolean }) {
        const res = await api.get('/ar/bank-accounts', { params });
        return res.data;
    },

    async getBankAccountById(id: string): Promise<BankAccount> {
        const res = await api.get(`/ar/bank-accounts/${id}`);
        return res.data;
    },

    async createBankAccount(data: Partial<BankAccount>): Promise<BankAccount> {
        const res = await api.post('/ar/bank-accounts', data);
        return res.data;
    },

    async updateBankAccount(id: string, data: Partial<BankAccount>): Promise<BankAccount> {
        const res = await api.put(`/ar/bank-accounts/${id}`, data);
        return res.data;
    },

    async deleteBankAccount(id: string): Promise<void> {
        await api.delete(`/ar/bank-accounts/${id}`);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // VENDOR ACCOUNT CHANGE REQUESTS
    // ═══════════════════════════════════════════════════════════════════════════

    async createBankAccountRequest(data: {
        bankAccountId?: string;
        requestType: 'CREATE' | 'UPDATE' | 'DELETE';
        requestedData: Partial<BankAccount>;
    }): Promise<BankAccountChangeRequest> {
        const res = await api.post('/ar/bank-accounts/requests', data);
        return res.data;
    },

    async getPendingRequests(status?: string): Promise<BankAccountChangeRequest[]> {
        const res = await api.get('/ar/bank-accounts/requests/pending', { params: { status } });
        return res.data;
    },

    async getMyRequests(): Promise<BankAccountChangeRequest[]> {
        const res = await api.get('/ar/bank-accounts/requests/my');
        return res.data;
    },

    async getRequestById(id: string): Promise<BankAccountChangeRequest> {
        const res = await api.get(`/ar/bank-accounts/requests/${id}`);
        return res.data;
    },

    async approveRequest(id: string, reviewNotes?: string): Promise<any> {
        const res = await api.post(`/ar/bank-accounts/requests/${id}/approve`, { reviewNotes });
        return res.data;
    },

    async rejectRequest(id: string, reviewNotes: string): Promise<any> {
        const res = await api.post(`/ar/bank-accounts/requests/${id}/reject`, { reviewNotes });
        return res.data;
    },

    async getRequestStats(): Promise<{ pending: number; approved: number; rejected: number; total: number }> {
        const res = await api.get('/ar/bank-accounts/requests/stats');
        return res.data;
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // VENDOR ACCOUNT ATTACHMENTS
    // ═══════════════════════════════════════════════════════════════════════════

    async getBankAccountAttachments(id: string): Promise<BankAccountAttachment[]> {
        const res = await api.get(`/ar/bank-accounts/${id}/attachments`);
        return res.data;
    },

    async uploadBankAccountAttachment(id: string, file: File, vendorType?: string): Promise<BankAccountAttachment> {
        const formData = new FormData();
        formData.append('file', file);
        if (vendorType) {
            formData.append('vendorType', vendorType);
        }
        const res = await api.post(`/ar/bank-accounts/${id}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },

    async downloadBankAccountAttachment(attachmentId: string): Promise<void> {
        // We use window.open for downloads or a blob approach.
        // For standard file download, window.open is often simplest if the server sets Content-Disposition
        const baseURL = process.env.NEXT_PUBLIC_API_URL || '';
        window.open(`${baseURL}/ar/bank-accounts/attachments/${attachmentId}/download`, '_blank');
    },

    async deleteBankAccountAttachment(attachmentId: string): Promise<void> {
        await api.delete(`/ar/bank-accounts/attachments/${attachmentId}`);
    },

    async updateBankAccountAttachmentVendorType(attachmentId: string, vendorType: string): Promise<BankAccountAttachment> {
        const res = await api.put(`/ar/bank-accounts/attachments/${attachmentId}/vendor-type`, { vendorType });
        return res.data;
    },

    async previewBankAccountImport(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/ar/bank-accounts/import/preview', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return data;
    },

    async importBankAccountsFromExcel(rows: any[]): Promise<any> {
        const { data } = await api.post('/ar/bank-accounts/import/excel', { rows });
        return data;
    },

    async downloadBankAccountTemplate(): Promise<void> {
        const { data } = await api.get('/ar/bank-accounts/import/template', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Vendor_Accounts_Template.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // VENDOR ACCOUNT ACTIVITY LOGS
    // ═══════════════════════════════════════════════════════════════════════════

    async getBankAccountActivityLogs(id: string, params?: { limit?: number; offset?: number }): Promise<{ logs: any[]; total: number }> {
        const res = await api.get(`/ar/bank-accounts/${id}/activities`, { params });
        return res.data;
    },

    async getRecentBankAccountActivities(limit = 50): Promise<any[]> {
        const res = await api.get('/ar/bank-accounts/activities/recent', { params: { limit } });
        return res.data;
    },

    async getBankAccountActivityStats(): Promise<{ total: number; byAction: Record<string, number> }> {
        const res = await api.get('/ar/bank-accounts/activities/stats');
        return res.data;
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // REPORTS API
    // ═══════════════════════════════════════════════════════════════════════════

    // Aging Reports
    async getDetailedAgingReport(params?: ReportFilters): Promise<AgingReportData> {
        const res = await api.get('/ar/reports/aging/detailed', { params });
        return res.data;
    },

    async getAgingSummary(params?: ReportFilters): Promise<AgingSummaryData> {
        const res = await api.get('/ar/reports/aging/summary', { params });
        return res.data;
    },

    async getCustomerAgingReport(params?: { limit?: number; sortBy?: 'balance' | 'overdue' }): Promise<CustomerAgingData> {
        const res = await api.get('/ar/reports/aging/customer', { params });
        return res.data;
    },

    async getRiskAgingReport(): Promise<RiskAgingData> {
        const res = await api.get('/ar/reports/aging/risk');
        return res.data;
    },

    // Collection Reports
    async getCollectionTrends(params?: { months?: number; groupBy?: 'month' | 'week' }): Promise<CollectionTrendsData> {
        const res = await api.get('/ar/reports/collections/trends', { params });
        return res.data;
    },

    async getPaymentModeAnalysis(params?: ReportFilters): Promise<PaymentModeData> {
        const res = await api.get('/ar/reports/collections/payment-modes', { params });
        return res.data;
    },

    async getBankwiseCollections(params?: ReportFilters): Promise<BankwiseData> {
        const res = await api.get('/ar/reports/collections/bankwise', { params });
        return res.data;
    },

    async getDSOReport(params?: { months?: number }): Promise<DSOData> {
        const res = await api.get('/ar/reports/dso', { params });
        return res.data;
    },

    // Customer Reports
    async getTopOutstandingCustomers(limit = 10): Promise<TopCustomersData> {
        const res = await api.get('/ar/reports/customers/outstanding', { params: { limit } });
        return res.data;
    },

    async getCustomerRiskReport(): Promise<CustomerRiskData> {
        const res = await api.get('/ar/reports/customers/risk');
        return res.data;
    },

    // Invoice Reports
    async getInvoiceStatusSummary(params?: ReportFilters): Promise<InvoiceStatusData> {
        const res = await api.get('/ar/reports/invoices/status', { params });
        return res.data;
    },

    async getPrepaidAnalysisReport(): Promise<PrepaidAnalysisData> {
        const res = await api.get('/ar/reports/invoices/prepaid');
        return res.data;
    },

    async getDeliveryStatusReport(): Promise<DeliveryStatusData> {
        const res = await api.get('/ar/reports/invoices/delivery');
        return res.data;
    }
};

// Bank Account Types
export interface BankAccount {
    id: string;
    bpCode?: string;
    vendorName: string;
    beneficiaryBankName: string;
    accountNumber: string;
    ifscCode: string;
    emailId?: string;
    beneficiaryName?: string;
    nickName?: string;
    isActive: boolean;
    isMSME: boolean;
    udyamRegNum?: string;
    gstNumber?: string;
    panNumber?: string;
    currency: string;
    accountType?: string;
    createdById: number;
    updatedById: number;
    createdAt: string;
    updatedAt: string;
    attachments?: BankAccountAttachment[];
    changeRequests?: BankAccountChangeRequest[];
    _count?: { changeRequests: number };
}

export interface BankAccountChangeRequest {
    id: string;
    bankAccountId?: string;
    requestType: 'CREATE' | 'UPDATE' | 'DELETE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requestedData: Partial<BankAccount>;
    requestedById: number;
    requestedAt: string;
    reviewedById?: number;
    reviewedAt?: string;
    reviewNotes?: string;
    bankAccount?: BankAccount;
    requestedBy?: { id: number; name: string; email: string };
    reviewedBy?: { id: number; name: string; email: string };
    attachments?: BankAccountAttachment[];
}

export interface BankAccountAttachment {
    id: string;
    filename: string;
    path: string;
    mimeType: string;
    size: number;
    bankAccountId: string;
    uploadedById: number;
    vendorType?: string;
    createdAt: string;
    uploadedBy?: { id: number; name: string };
}

export interface BankAccountActivityLog {
    id: string;
    bankAccountId?: string;
    action: string;
    description: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    performedById?: number;
    performedBy?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
    createdAt: string;
}

// Utility functions
export const formatARCurrency = (amount: number): string => {
    return `₹${Number(amount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })}`;
};

export const formatARDate = (date?: string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

