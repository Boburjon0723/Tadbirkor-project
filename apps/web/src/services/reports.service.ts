import { api } from "@/lib/api";
import { downloadBlobFile } from "@/lib/download-blob";

export type PosReportSummary = {
  source: string;
  receiptsCount: number;
  itemsSold: number;
  grossSales: Record<string, number>;
  discounts: Record<string, number>;
  netSales: Record<string, number>;
  cashSales: Record<string, number>;
  cardSales: Record<string, number>;
  creditSales: Record<string, number>;
  openReceivablesTotal: number;
};

export const reportsService = {
  getPosSummary: async (params?: { dateFrom?: string; dateTo?: string; warehouseId?: string }) => {
    const { data } = await api.get<PosReportSummary>('/reports/pos/summary', { params });
    return data;
  },
  async getStockReport(params?: any) {
    const { data } = await api.get("/reports/stock", { params });
    return data;
  },

  async getStockMovementReport(params?: any) {
    const { data } = await api.get("/reports/stock-movements", { params });
    return data;
  },

  async getPartnersBalanceReport() {
    const { data } = await api.get("/reports/partners-balance");
    return data;
  },

  async getB2BOrdersAnalytics(days: number = 30) {
    const { data } = await api.get(`/reports/analytics/orders?days=${days}`);
    return data;
  },

  async getStockAnalytics(days: number = 30) {
    const { data } = await api.get(`/reports/analytics/stock?days=${days}`);
    return data;
  },

  async downloadBlob(response: { data: Blob }, filename: string) {
    await downloadBlobFile(response.data, filename);
  },

  async exportStock(warehouseId?: string) {
    const response = await api.get('/reports/export/stock', {
      responseType: 'blob',
      params: warehouseId ? { warehouseId } : undefined,
    });
    await this.downloadBlob(response, 'stock_report.xlsx');
  },

  /** Import shabloni bilan bir xil ustunlar — tahrirlab qayta import qilish uchun */
  async exportProductsForImport(
    warehouseId: string,
    warehouseName?: string,
    mode: 'with_stock' | 'without_stock' = 'with_stock',
  ) {
    const response = await api.get('/reports/export/products-import-format', {
      responseType: 'blob',
      params: { warehouseId, mode },
    });
    const safe =
      (warehouseName || 'ombor')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40) || 'ombor';
    const date = new Date().toISOString().slice(0, 10);
    const suffix = mode === 'with_stock' ? 'qoldiq' : 'katalog';
    await this.downloadBlob(response, `ombor-${suffix}-${safe}-${date}.xlsx`);
  },

  async getProductTemplate() {
    const response = await api.get('/reports/templates/products', { responseType: 'blob' });
    await this.downloadBlob(response, 'product_import_template.xlsx');
  },

  async getFieldWorkerInstallations(params?: { dateFrom?: string; dateTo?: string }) {
    const { data } = await api.get('/reports/field-workers/installations', { params });
    return data;
  },

  async getMonthlyOverview(params?: { year?: number; month?: number }) {
    const { data } = await api.get('/reports/monthly-overview', { params });
    return data as MonthlyOverview;
  },

  async downloadPartnerBalancePdf(partnerCompanyId: string, partnerName: string, dateFrom?: string, dateTo?: string) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const response = await api.get(`/reports/partners/${partnerCompanyId}/balance/pdf?${params.toString()}`, {
      responseType: 'blob',
    });
    const filename = `akt-sverka-${partnerName.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    await downloadBlobFile(response.data, filename, { mimeType: 'application/pdf' });
  },
};

export type MonthlyOverview = {
  period: { from: string; to: string; year: number; month: number };
  modules: { pos: boolean; income: boolean; expenses: boolean; payroll: boolean };
  mode: 'CASH_FLOW';
  revenue: {
    pos: {
      receiptsCount: number;
      itemsSold: number;
      grossSales: Record<string, number>;
      discounts: Record<string, number>;
      netSales: Record<string, number>;
      cashSales: Record<string, number>;
      cardSales: Record<string, number>;
      creditSales: Record<string, number>;
    } | null;
    income: {
      totals: Record<string, number>;
      byCategory: Array<{
        categoryId: string;
        name: string;
        amount: Record<string, number>;
        count: number;
      }>;
      totalCount: number;
    } | null;
  };
  costs: {
    expenses: {
      approved: Record<string, number>;
      pending: Record<string, number>;
      rejected: Record<string, number>;
      counts: { pending: number; approved: number; rejected: number };
    } | null;
    payroll: {
      rosterCount: number;
      advancesUZS: number;
      bonusUZS: number;
      openAdvancesUZS: number;
      paidIncludingBonusUZS: number;
      accruedSalaryUZS: number;
      cashOutUZS: number;
    } | null;
  };
  result: {
    cashIn: { UZS: number; USD: number };
    cashOut: { UZS: number; USD: number };
    netProfit: { UZS: number; USD: number };
    status: 'PROFIT' | 'LOSS' | 'NEUTRAL';
  };
  warnings: string[];
};
