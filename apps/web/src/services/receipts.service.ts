import { api } from "@/lib/api";
import { reportsService } from "@/services/reports.service";
import { toast, formatApiError } from "@/lib/toast";

export const receiptsService = {
  async getReceipts(params?: Record<string, any>) {
    const { data } = await api.get("/goods-receipts", { params });
    return data;
  },
  
  async getReceipt(
    id: string,
    params?: { mode?: 'view' | 'full'; page?: number; limit?: number },
  ) {
    const { data } = await api.get(`/goods-receipts/${id}`, {
      params: {
        ...(params?.mode ? { mode: params.mode } : {}),
        ...(params?.page ? { page: params.page } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    });
    return data;
  },
  
  async acceptReceipt(
    id: string,
    payload: {
      warehouseId: string;
      items?: Array<{ itemId: string; receivedQuantity: number }>;
      note?: string;
    },
  ) {
    const { data } = await api.post(`/goods-receipts/${id}/accept`, payload, {
      timeout: 600_000,
    });
    return data;
  },
  
  async rejectReceipt(id: string, reason?: string) {
    const { data } = await api.post(`/goods-receipts/${id}/reject`, {
      reason,
    });
    return data;
  },

  async partialAcceptReceipt(
    id: string,
    payload: { warehouseId: string; items: Array<{ itemId: string; receivedQuantity: number }>; note?: string }
  ) {
    const { data } = await api.post(`/goods-receipts/${id}/partial-accept`, payload, {
      timeout: 600_000,
    });
    return data;
  },
  async exportReceiptExcel(id: string) {
    try {
      const short = id.slice(0, 8).toUpperCase();
      const response = await api.get(`/goods-receipts/${id}/export/excel`, {
        responseType: 'blob',
      });
      await reportsService.downloadBlob(response, `qabul-RCP-${short}.xlsx`);
      toast.success('Excel yuklandi');
    } catch (err) {
      toast.error(formatApiError(err, 'Excel eksportda xato'));
    }
  },

  async exportAllReceiptsExcel() {
    try {
      const response = await api.get('/goods-receipts/export/excel', {
        responseType: 'blob',
      });
      const date = new Date().toISOString().slice(0, 10);
      await reportsService.downloadBlob(response, `qabullar-${date}.xlsx`);
      toast.success('Excel yuklandi');
    } catch (err) {
      toast.error(formatApiError(err, 'Excel eksportda xato'));
    }
  },

  async downloadReceiptPdf(id: string, receiptNumber: string) {
    const response = await api.get(`/goods-receipts/${id}/pdf`, { responseType: 'blob' });
    await reportsService.downloadBlob(response, `receipt-${receiptNumber}.pdf`);
  },
};
