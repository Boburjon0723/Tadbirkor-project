import { api } from '@/lib/api';

export type RetailReceivable = {
  id: string;
  amount: number | string;
  remainingAmount: number | string;
  currency: string;
  status: string;
  retailCustomer: { id: string; name: string; phone?: string | null };
  posSale?: { saleNumber: string; completedAt?: string };
};

export const retailReceivablesService = {
  findAll: async (params?: { status?: string; retailCustomerId?: string }) => {
    const { data } = await api.get('/retail-receivables', { params });
    return data as RetailReceivable[];
  },
  recordPayment: async (id: string, payload: { amount: number; notes?: string }) => {
    const { data } = await api.post(`/retail-receivables/${id}/payments`, payload);
    return data;
  },
};
