import { api } from "@/lib/api";
import { downloadBlobFile, mobileDownloadHint, isMobileOrPwa } from "@/lib/download-blob";
import { toast } from "@/lib/toast";

export const debtsService = {
  // Debt list
  async getDebts(params?: Record<string, any>) {
    const { data } = await api.get("/debts/entries", { params });
    return data;
  },

  async getPartnerGroups(params?: {
    tab?: 'receivable' | 'payable';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { data } = await api.get('/debts/partner-groups', { params });
    return data;
  },

  async getPartnerGroupOne(partnerCompanyId: string, tab: 'receivable' | 'payable') {
    const id = encodeURIComponent(String(partnerCompanyId || '').trim());
    const { data } = await api.get(`/debts/partner-groups/${id}`, { params: { tab } });
    return data;
  },

  /** Yopilgan hamkorlar — akt sverka arxivi (ma'lumotlar bazadan) */
  async getPartnerReportArchive(params?: {
    tab?: 'receivable' | 'payable';
    search?: string;
    page?: number;
    limit?: number;
    settledOnly?: boolean;
  }) {
    const { data } = await api.get('/debts/partner-reports', { params });
    return data;
  },

  async getDebtDetail(id: string) {
    const { data } = await api.get(`/debts/entries/${id}`);
    return data;
  },

  async getPendingPaymentRecords() {
    const { data } = await api.get('/debts/payment-records/pending');
    return data;
  },

  // Payment records
  async createPaymentRecord(payload: {
    debtId: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
  }) {
    const { data } = await api.post(`/debts/${payload.debtId}/payment-records`, {
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      notes: payload.notes,
    });
    return data;
  },

  /** Bizga qarzdor to‘laganda — haqdor to‘lovni darhol qabul qiladi */
  async applyPaymentByCreditor(payload: {
    debtId: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
  }) {
    const { data } = await api.post(`/debts/entries/${payload.debtId}/apply-payment`, {
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      notes: payload.notes,
    });
    return data;
  },

  /** Qarzdor: «2500 berdim» — FIFO bo‘yicha PENDING yozuvlar */
  async recordPartnerBulkPayment(payload: {
    partnerCompanyId: string;
    amount: number;
    currency: 'UZS' | 'USD';
    paymentMethod?: string;
    notes?: string;
  }) {
    const id = encodeURIComponent(String(payload.partnerCompanyId || '').trim());
    const { data } = await api.post(`/debts/partners/${id}/record-bulk-payment`, {
      amount: payload.amount,
      currency: payload.currency,
      paymentMethod: payload.paymentMethod || 'CASH',
      notes: payload.notes,
    });
    return data;
  },

  /** Haqdor: hamkordan kelgan kutilayotgan to‘lovlarni tasdiqlash */
  async confirmPartnerBulkPayments(payload: {
    partnerCompanyId: string;
    currency?: 'UZS' | 'USD';
  }) {
    const id = encodeURIComponent(String(payload.partnerCompanyId || '').trim());
    const { data } = await api.post(`/debts/partners/${id}/confirm-bulk-payments`, {
      ...(payload.currency ? { currency: payload.currency } : {}),
    });
    return data;
  },

  async confirmPayment(paymentId: string) {
    const { data } = await api.post(`/debts/payment-records/${paymentId}/confirm`);
    return data;
  },

  async rejectPayment(paymentId: string, reason?: string) {
    const { data } = await api.post(`/debts/payment-records/${paymentId}/reject`, { reason });
    return data;
  },

  // Stats & Balances
  async getPartnerBalances() {
    const { data } = await api.get("/reports/partners-balance");
    return data;
  },

  async getPartnerLedger(partnerCompanyId: string) {
    const id = encodeURIComponent(String(partnerCompanyId || '').trim());
    const { data } = await api.get(`/debts/partners/${id}/ledger`);
    return data;
  },

  async downloadPartnerAktPdf(partnerCompanyId: string, partnerName: string) {
    const id = encodeURIComponent(String(partnerCompanyId || '').trim());
    const response = await api.get(`/debts/partners/${id}/akt-sverka/pdf`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    if (blob.type?.includes('json')) {
      const text = await blob.text();
      let message = 'PDF yuklab bo‘lmadi';
      try {
        const parsed = JSON.parse(text);
        message = parsed.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    const safeName =
      String(partnerName || 'hamkor')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40) || 'hamkor';
    const result = await downloadBlobFile(
      blob,
      `akt-sverka-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`,
      { mimeType: 'application/pdf' },
    );
    if (isMobileOrPwa()) toast.success(mobileDownloadHint(result));
  },

  async downloadPartnerAktExcel(partnerCompanyId: string, partnerName: string) {
    const id = encodeURIComponent(String(partnerCompanyId || '').trim());
    const response = await api.get(`/debts/partners/${id}/akt-sverka/excel`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    if (blob.type?.includes('json')) {
      const text = await blob.text();
      let message = 'Excel yuklab bo‘lmadi';
      try {
        const parsed = JSON.parse(text);
        message = parsed.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    const safeName =
      String(partnerName || 'hamkor')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40) || 'hamkor';
    const result = await downloadBlobFile(
      blob,
      `akt-sverka-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      {
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    );
    if (isMobileOrPwa()) toast.success(mobileDownloadHint(result));
  },
};
