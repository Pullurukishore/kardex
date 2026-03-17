import axios from 'axios';
import api from '@/lib/api/axios';

// Ensure this matches backend server (Express app mounts routes under /api)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Auth methods
  async login(credentials: { email: string; password: string }) {
    const response = await api.post(`${this.baseURL}/auth/login`, credentials);
    return response.data;
  }

  async logout() {
    const response = await api.post(`${this.baseURL}/auth/logout`);
    return response.data;
  }

  async getMe() {
    const response = await api.get(`${this.baseURL}/auth/me`);
    return response.data;
  }

  // Offer methods
  async getOffers(params?: any) {
    const response = await api.get(`${this.baseURL}/offers`, { params });
    return response.data;
  }

  async getOffer(id: number) {
    const response = await api.get(`${this.baseURL}/offers/${id}`);
    return response.data;
  }

  async createOffer(offerData: any) {
    const response = await api.post(`${this.baseURL}/offers`, offerData);
    return response.data;
  }

  async updateOffer(id: number, offerData: any) {
    const response = await api.put(`${this.baseURL}/offers/${id}`, offerData);
    return response.data;
  }

  async deleteOffer(id: number) {
    const response = await api.delete(`${this.baseURL}/offers/${id}`);
    return response.data;
  }

  async getNextOfferReference(params: { zoneId: number; productType: string }) {
    const response = await api.get(`${this.baseURL}/offers/next-reference`, { params });
    return response.data;
  }

  async importOffers(file: File, targetYear?: number): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (targetYear) formData.append('targetYear', String(targetYear));
    const response = await api.post(`${this.baseURL}/offers/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000 // 5 min for import (many DB writes)
    });
    return response.data;
  }

  async previewOfferImport(file: File, targetYear?: number): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (targetYear) formData.append('targetYear', String(targetYear));
    const response = await api.post(`${this.baseURL}/offers/import/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 120s for preview (large files)
    });
    return response.data;
  }

  async getOfferForQuoteAdmin(id: number) {
    const response = await api.get(`${this.baseURL}/offers/quote/admin/${id}`);
    return response.data;
  }

  async getOfferForQuote(id: number) {
    const response = await api.get(`${this.baseURL}/offers/quote/zone/${id}`);
    return response.data;
  }

  async getOfferForQuoteZone(id: number) {
    const response = await api.get(`${this.baseURL}/offers/quote/zone/${id}`);
    return response.data;
  }

  // Target methods
  async getTargets(params?: any) {
    const response = await api.get(`${this.baseURL}/targets`, { params });
    return response.data;
  }

  async createTarget(targetData: any) {
    const response = await api.post(`${this.baseURL}/targets`, targetData);
    return response.data;
  }

  async updateTarget(id: number, targetData: any) {
    const response = await api.put(`${this.baseURL}/targets/${id}`, targetData);
    return response.data;
  }

  async deleteTarget(id: number) {
    const response = await api.delete(`${this.baseURL}/targets/${id}`);
    return response.data;
  }

  async getTargetSummary(params?: any) {
    const response = await api.get(`${this.baseURL}/targets/summary`, { params });
    return response.data;
  }

  async getTargetsSummary(params?: any) {
    return this.getTargetSummary(params);
  }

  // Spare Part methods
  async getSpareParts(params?: any) {
    const response = await api.get(`${this.baseURL}/spare-parts`, { params });
    return response.data;
  }

  async createSparePart(partData: any) {
    const response = await api.post(`${this.baseURL}/spare-parts`, partData);
    return response.data;
  }

  async updateSparePart(id: number, partData: any) {
    const response = await api.put(`${this.baseURL}/spare-parts/${id}`, partData);
    return response.data;
  }

  async deleteSparePart(id: number) {
    const response = await api.delete(`${this.baseURL}/spare-parts/${id}`);
    return response.data;
  }

  async bulkUpdatePrices(updates: any[]) {
    const response = await api.put(`${this.baseURL}/spare-parts/bulk-update-prices`, { updates });
    return response.data;
  }

  async bulkUpdateSparePartPrices(updates: any[]) {
    return this.bulkUpdatePrices(updates);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPARE PART BULK IMPORT
  // ═══════════════════════════════════════════════════════════════════════════

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`${this.baseURL}/spare-parts/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.imageUrl;
  }

  async previewSparePartImport(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${this.baseURL}/spare-parts/import/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async bulkImportSpareParts(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${this.baseURL}/spare-parts/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async downloadSparePartImportTemplate(): Promise<void> {
    const response = await api.get(`${this.baseURL}/spare-parts/import/template`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Spare_Parts_Import_Template.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }





  // Target methods
  async getZoneTargets(params?: any) {
    const response = await api.get(`${this.baseURL}/targets/zones`, { params });
    return response.data;
  }

  async getUserTargets(params?: any) {
    const response = await api.get(`${this.baseURL}/targets/users`, { params });
    return response.data;
  }

  async setZoneTarget(targetData: any) {
    const response = await api.post(`${this.baseURL}/targets/zones`, targetData);
    return response.data;
  }

  async updateZoneTarget(targetId: number, targetData: any) {
    const response = await api.put(`${this.baseURL}/targets/zones/${targetId}`, targetData);
    return response.data;
  }

  async deleteZoneTarget(targetId: number) {
    const response = await api.delete(`${this.baseURL}/targets/zones/${targetId}`);
    return response.data;
  }

  async getZoneTargetDetails(zoneId: number, params?: any) {
    const response = await api.get(`${this.baseURL}/targets/zones/${zoneId}/details`, { params });
    return response.data;
  }

  async setUserTarget(targetData: any) {
    const response = await api.post(`${this.baseURL}/targets/users`, targetData);
    return response.data;
  }

  async updateUserTarget(targetId: number, targetData: any) {
    const response = await api.put(`${this.baseURL}/targets/users/${targetId}`, targetData);
    return response.data;
  }

  async deleteUserTarget(targetId: number) {
    const response = await api.delete(`${this.baseURL}/targets/users/${targetId}`);
    return response.data;
  }

  async getUserTargetDetails(userId: number, params?: any) {
    const response = await api.get(`${this.baseURL}/targets/users/${userId}/details`, { params });
    return response.data;
  }

  // Activity methods
  async getActivities(params?: any) {
    const response = await api.get(`${this.baseURL}/activities`, { params });
    return response.data;
  }

  async getActivityStats(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/stats`, { params });
    return response.data;
  }

  async getZoneActivities(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/zone`, { params });
    return response.data;
  }

  async getUserActivities(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/user`, { params });
    return response.data;
  }

  async getActivityHeatmap(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/heatmap`, { params });
    return response.data;
  }

  async getRealtimeActivities(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/realtime`, { params });
    return response.data;
  }

  async getOfferActivities(offerReferenceNumber: string, params?: any) {
    const response = await api.get(`${this.baseURL}/activities/offer`, {
      params: { ...params, offerReferenceNumber },
    });
    return response.data;
  }

  async getActivityComparison(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/comparison`, { params });
    return response.data;
  }

  async getActivityByEntity(entityType: string, entityId: number, params?: any) {
    const response = await api.get(`${this.baseURL}/activities/entity/${entityType}/${entityId}`, { params });
    return response.data;
  }

  async getUserLeaderboard(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/leaderboard`, { params });
    return response.data;
  }

  async exportActivities(params?: any) {
    const response = await api.get(`${this.baseURL}/tickets/export`, { params });
    return response.data;
  }

  async getSecurityAlerts(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/security`, { params });
    return response.data;
  }

  async getWorkflowAnalysis(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/workflow`, { params });
    return response.data;
  }

  async getComplianceReport(params?: any) {
    const response = await api.get(`${this.baseURL}/activities/compliance`, { params });
    return response.data;
  }

  // Admin Activity Log methods (for Ticket/Offer Activity Log pages)
  async getTicketActivityLogs(params?: any) {
    const response = await api.get(`${this.baseURL}/admin/ticket-activity-log`, { params });
    return response.data;
  }

  async getTicketActivityStats() {
    const response = await api.get(`${this.baseURL}/admin/ticket-activity-log/stats`);
    return response.data;
  }

  async getOfferActivityLogs(params?: any) {
    const response = await api.get(`${this.baseURL}/admin/offer-activity-log`, { params });
    return response.data;
  }

  async getOfferActivityStats() {
    const response = await api.get(`${this.baseURL}/admin/offer-activity-log/stats`);
    return response.data;
  }

  async getActivityLogUsers() {
    const response = await api.get(`${this.baseURL}/admin/activity-log/users`);
    return response.data;
  }


  // Customer methods
  async getCustomers(params?: { zoneId?: number | string;[key: string]: any }) {
    const { include, zoneId, limit = 100, ...queryParams } = params || {};

    // Map zoneId to serviceZoneId for the backend
    if (zoneId) {
      queryParams.serviceZoneId = zoneId;
    }

    // Ensure limit doesn't exceed the maximum allowed by the backend (100)
    const safeLimit = Math.min(Number(limit) || 100, 100);

    // Add include parameter to the request if provided
    if (include) {
      queryParams.include = include;
    }

    console.log('Fetching customers with params:', { ...queryParams, limit: safeLimit });

    const response = await api.get(`${this.baseURL}/customers`, {
      params: {
        ...queryParams,
        limit: safeLimit
      }
    });

    // Log the response to debug
    console.log('Customers API response:', response.data);

    // Return the data - backend already includes contacts/assets if requested
    const customers = response.data?.data || response.data || [];
    console.log(`Fetched ${customers.length} customers`);

    return customers;
  }

  async getCustomer(id: number) {
    const response = await api.get(`${this.baseURL}/customers/${id}`);
    return response.data;
  }

  async createCustomer(customerData: any) {
    const response = await api.post(`${this.baseURL}/customers`, customerData);
    return response.data;
  }

  async createCustomerContact(customerId: number, contactData: any) {
    const response = await api.post(`${this.baseURL}/customers/${customerId}/contacts`, contactData);
    return response.data;
  }

  async createCustomerAsset(customerId: number, assetData: any) {
    const response = await api.post(`${this.baseURL}/customers/${customerId}/assets`, assetData);
    return response.data;
  }

  async updateCustomer(id: number, customerData: any) {
    const response = await api.put(`${this.baseURL}/customers/${id}`, customerData);
    return response.data;
  }

  async deleteCustomer(id: number) {
    const response = await api.delete(`${this.baseURL}/customers/${id}`);
    return response.data;
  }

  // User methods
  async getUsers(params?: any) {
    const response = await api.get(`${this.baseURL}/admin/users`, { params });
    return response.data;
  }

  async getUser(id: number) {
    const response = await api.get(`${this.baseURL}/admin/${id}`);
    return response.data;
  }

  async createUser(userData: any) {
    const response = await api.post(`${this.baseURL}/admin/users`, userData);
    return response.data;
  }

  async updateUser(id: number, userData: any) {
    const response = await api.put(`${this.baseURL}/admin/${id}`, userData);
    return response.data;
  }

  async deleteUser(id: number) {
    const response = await api.delete(`${this.baseURL}/admin/${id}`);
    return response.data;
  }

  // Zone methods
  async getZones() {
    const response = await api.get(`${this.baseURL}/service-zones`);
    return response.data;
  }

  async getZone(id: number) {
    const response = await api.get(`${this.baseURL}/service-zones/${id}`);
    return response.data;
  }

  async createZone(zoneData: any) {
    const response = await api.post(`${this.baseURL}/service-zones`, zoneData);
    return response.data;
  }

  async updateZone(id: number, zoneData: any) {
    const response = await api.put(`${this.baseURL}/service-zones/${id}`, zoneData);
    return response.data;
  }

  async deleteZone(id: number) {
    const response = await api.delete(`${this.baseURL}/service-zones/${id}`);
    return response.data;
  }

  // Ticket methods
  async getTickets(params?: any) {
    const response = await api.get(`${this.baseURL}/tickets`, { params });
    return response.data;
  }

  async getTicket(id: number) {
    const response = await api.get(`${this.baseURL}/tickets/${id}`);
    return response.data;
  }

  async createTicket(ticketData: any) {
    const response = await api.post(`${this.baseURL}/tickets`, ticketData);
    return response.data;
  }

  async updateTicket(id: number, ticketData: any) {
    const response = await api.put(`${this.baseURL}/tickets/${id}`, ticketData);
    return response.data;
  }

  async deleteTicket(id: number) {
    const response = await api.delete(`${this.baseURL}/tickets/${id}`);
    return response.data;
  }

  async updateTicketStatus(id: number, status: string, location?: any) {
    const response = await api.post(`${this.baseURL}/tickets/${id}/status`, { status, location });
    return response.data;
  }

  async getTicketHistory(id: number) {
    const response = await api.get(`${this.baseURL}/tickets/${id}/history`);
    return response.data;
  }

  async getTicketStats(params?: any) {
    const response = await api.get(`${this.baseURL}/tickets/stats`, { params });
    return response.data;
  }

  async exportTickets(params?: any) {
    const response = await api.get(`${this.baseURL}/tickets/export`, {
      params,
      responseType: 'blob'
    });
    return response.data;
  }

  async previewTicketImport(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${this.baseURL}/tickets/import/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    });
    return response.data;
  }

  async importTickets(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${this.baseURL}/tickets/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000
    });
    return response.data;
  }

  // Dashboard methods

  async getDashboardStats(params?: any) {
    const response = await api.get(`${this.baseURL}/dashboard/stats`, { params });
    return response.data;
  }

  async getDashboardCharts(params?: any) {
    const response = await api.get(`${this.baseURL}/dashboard/charts`, { params });
    return response.data;
  }

  async getDashboardRecent(params?: any) {
    const response = await api.get(`${this.baseURL}/dashboard/recent`, { params });
    return response.data;
  }

  // Reports methods
  async generateReport(params?: any) {
    const response = await api.get(`${this.baseURL}/reports/generate`, { params });
    return response.data;
  }

  async generateZoneReport(params?: any) {
    const response = await api.get(`${this.baseURL}/reports/zone`, { params });
    return response.data;
  }

  async getServicePersonReports(params?: any) {
    const response = await api.get(`${this.baseURL}/service-person-reports`, { params });
    return response.data;
  }

  async exportReport(params?: any) {
    const response = await api.get(`${this.baseURL}/reports/export`, {
      params,
      responseType: 'blob'
    });
    return response.data;
  }

  async getProductTypeAnalysis(params?: any) {
    // Call the KardexCare backend for product type analysis
    const response = await api.get(`${this.baseURL}/reports/product-type-analysis`, { params });
    return response.data;
  }

  async getCustomerPerformance(params?: any) {
    // Call the KardexCare backend for customer performance
    const response = await api.get(`${this.baseURL}/reports/customer-performance`, { params });
    return response.data;
  }



  async getZoneManagerTargets(params?: any) {
    const response = await api.get(`${this.baseURL}/targets/zone-manager`, { params });
    return response.data;
  }

  // Forecast methods
  async getForecastSummary(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/summary`, { params });
    return response.data;
  }

  async getForecastMonthly(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/monthly`, { params });
    return response.data;
  }

  async getUserMonthlyBreakdown(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/user-monthly`, { params });
    return response.data;
  }

  async getPOExpectedMonthBreakdown(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/po-expected`, { params });
    return response.data;
  }

  async getProductUserZoneBreakdown(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/product-user-zone`, { params });
    return response.data;
  }

  async getProductWiseForecast(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/product-wise`, { params });
    return response.data;
  }

  async getForecastAnalytics(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/analytics`, { params });
    return response.data;
  }

  async getGrowthPillar(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/growth-report`, { params });
    return response.data;
  }

  // Dashboard methods for Offer Analytics
  // These methods fetch comprehensive offer/sales data for dashboard display
  async getAdminDashboard(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/analytics`, { params });
    return this.transformForecastToAdminDashboard(response.data);
  }

  async getZoneManagerDashboard(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/analytics`, { params });
    return this.transformForecastToAdminDashboard(response.data);
  }

  async getZoneDashboard(params?: any) {
    const response = await api.get(`${this.baseURL}/forecast/analytics`, { params });
    return this.transformForecastToAdminDashboard(response.data);
  }

  // Transform forecast analytics data to dashboard format
  private transformForecastToAdminDashboard(data: any) {
    const analytics = data?.data || data;

    // Extract totals from the response
    const totals = analytics?.totals || {};
    const zoneAnalytics = analytics?.zoneAnalytics || [];
    const productAnalytics = analytics?.productAnalytics || [];
    const monthlyTrends = analytics?.monthlyTrends || {};
    const topUsers = analytics?.topUsers || [];

    // Calculate stats
    const totalOffers = totals.offers || 0;
    const totalValue = totals.value || 0;
    const wonValue = totals.won || 0;
    const wonOffers = zoneAnalytics.reduce((sum: number, z: any) => sum + (z.metrics?.wonCount || 0), 0);
    const lostOffers = zoneAnalytics.reduce((sum: number, z: any) => sum + (z.metrics?.lostCount || 0), 0);
    const closedOffers = wonOffers + lostOffers;
    const activeOffers = totalOffers - closedOffers;
    const winRate = closedOffers > 0 ? (wonOffers / closedOffers) * 100 : 0;
    const conversionRate = totalOffers > 0 ? (wonOffers / totalOffers) * 100 : 0;
    const avgOfferValue = totalOffers > 0 ? totalValue / totalOffers : 0;

    // Transform zone data
    const offersByZone = zoneAnalytics.map((z: any) => ({
      name: z.zoneName,
      offers: z.metrics?.offers || 0,
      value: z.metrics?.offersValue || 0,
    }));

    // Transform product type data
    const offersByProductType = productAnalytics.map((p: any) => ({
      productType: p.productType,
      count: p.count || 0,
      value: p.value || 0,
    }));

    const productTypePerformance = productAnalytics.map((p: any) => ({
      productType: p.productType,
      count: p.count || 0,
      value: p.value || 0,
      wonValue: p.won || 0,
      targetValue: null,
      targetOfferCount: null,
      achievement: null,
    }));

    // Transform monthly trends
    const monthlyTrendArray = Object.entries(monthlyTrends).map(([month, data]: [string, any]) => ({
      month,
      offers: data?.offers || 0,
      value: data?.value || 0,
    }));

    // Transform zone analytics to stages
    const offersByStage: Array<{ stage: string; count: number }> = [];
    const stageCounts: Record<string, number> = {};
    zoneAnalytics.forEach((z: any) => {
      const stageBreakdown = z.stageBreakdown || {};
      Object.entries(stageBreakdown).forEach(([stage, count]) => {
        stageCounts[stage] = (stageCounts[stage] || 0) + (count as number);
      });
    });
    Object.entries(stageCounts).forEach(([stage, count]) => {
      offersByStage.push({ stage, count });
    });

    // Get zones list
    const zones = zoneAnalytics.map((z: any) => ({
      id: z.zoneId,
      name: z.zoneName,
    }));

    return {
      stats: {
        totalOffers,
        activeOffers,
        wonOffers,
        lostOffers,
        closedOffers,
        totalValue,
        wonValue,
        avgOfferValue,
        wonThisMonth: wonOffers, // Simplified - would need month filter
        wonLastMonth: 0,
        wonLastYear: 0,
        winRate,
        conversionRate,
        momGrowth: 0,
        yoyGrowth: 0,
        valueGrowth: 0,
        last7DaysOffers: 0,
        last30DaysOffers: 0,
        avgDealTime: 0,
        totalZones: zones.length,
        activeUsers: topUsers.length,
        wonValueThisMonth: wonValue,
        totalTargetValue: totals.target || 0,
        targetAchievement: totals.target > 0 ? (wonValue / totals.target) * 100 : 0,
      },
      recentOffers: [],
      offersByStage,
      offersByZone,
      offersByProductType,
      topCustomers: [],
      monthlyTrend: monthlyTrendArray,
      productTypePerformance,
      zoneProductTypeBreakdown: [],
      zones,
      velocityMetrics: [],
      currentMonthTargets: {
        period: '',
        zones: [],
        users: [],
        productTypes: [],
      },
    };
  }

}

export const apiService = new ApiService();
export default apiService;

// Export individual methods for direct imports
export const getZoneManagerTargets = (params?: any) => apiService.getZoneManagerTargets(params);
export const previewSparePartImport = (file: File) => apiService.previewSparePartImport(file);
export const bulkImportSpareParts = (file: File) => apiService.bulkImportSpareParts(file);
export const downloadSparePartImportTemplate = () => apiService.downloadSparePartImportTemplate();
