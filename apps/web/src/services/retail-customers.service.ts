import { api } from '@/lib/api';

export type RetailCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type CurrencyBalance = {
  totalDebt: number;
  prepaidBalance: number;
  netBalance: number;
};

export type RetailCustomerSummary = RetailCustomer & {
  balances: { UZS: CurrencyBalance; USD: CurrencyBalance };
  totalDebt: number;
  prepaidBalance: number;
  netBalance: number;
  totalPaid: number;
  totalCredited: number;
  openReceivablesCount: number;
  lastSaleAt: string | null;
};

export type RetailLedgerEntry = {
  id: string;
  operation: string;
  operationLabel: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  currency: 'UZS' | 'USD';
  note?: string | null;
  posSaleId?: string | null;
  posSaleItemCount?: number;
  receivableId?: string | null;
  paymentId?: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName?: string } | null;
  posSale?: {
    id: string;
    saleNumber: string;
    currency: 'UZS' | 'USD';
    completedAt?: string | null;
    totalAmount: number;
    items?: Array<{
      id: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  } | null;
};

export type RetailCustomerLedger = {
  customer: { id: string; name: string; phone?: string | null; notes?: string | null };
  balances: { UZS: CurrencyBalance; USD: CurrencyBalance };
  totalDebt: number;
  prepaidBalance: number;
  netBalance: number;
  totalPaid: number;
  entries: RetailLedgerEntry[];
  receivables: Array<{
    id: string;
    amount: number;
    remainingAmount: number;
    currency: string;
    status: string;
    createdAt: string;
    posSale?: {
      saleNumber: string;
      completedAt?: string;
      totalAmount: number;
    } | null;
    payments: Array<{
      id: string;
      amount: number;
      notes?: string | null;
      createdAt: string;
      createdBy?: { fullName?: string };
    }>;
  }>;
};

export type PosPickerCustomer = Pick<RetailCustomer, 'id' | 'name' | 'phone'>;

export const retailCustomersService = {
  search: async (q?: string, limit = 20): Promise<RetailCustomer[]> => {
    const { data } = await api.get('/retail-customers/search', { params: { q, limit } });
    return data;
  },
  /** Kassa mijoz tanlash — yengil maydonlar, oxirgi mijozlar */
  posPicker: async (q?: string, limit = 12): Promise<PosPickerCustomer[]> => {
    const { data } = await api.get('/retail-customers/pos-picker', {
      params: { q: q || undefined, limit },
    });
    return data;
  },
  findAll: async (): Promise<RetailCustomer[]> => {
    const { data } = await api.get('/retail-customers');
    return data;
  },
  findAllSummary: async (): Promise<RetailCustomerSummary[]> => {
    const { data } = await api.get('/retail-customers/summary');
    return data;
  },
  getLedger: async (id: string): Promise<RetailCustomerLedger> => {
    const { data } = await api.get(`/retail-customers/${id}/ledger`);
    return data;
  },
  getLedgerSaleItems: async (
    customerId: string,
    entryId: string,
  ): Promise<{
    items: Array<{
      id: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }> => {
    const { data } = await api.get(
      `/retail-customers/${customerId}/ledger/entries/${entryId}/sale-items`,
    );
    return data;
  },
  create: async (payload: { name: string; phone?: string; notes?: string }) => {
    const { data } = await api.post('/retail-customers', payload);
    return data as RetailCustomer;
  },
  update: async (id: string, payload: { name?: string; phone?: string; notes?: string }) => {
    const { data } = await api.patch(`/retail-customers/${id}`, payload);
    return data as RetailCustomer;
  },

  recordPrepaid: async (
    id: string,
    payload: { amount: number; currency?: 'UZS' | 'USD'; notes?: string },
  ) => {
    const { data } = await api.post(`/retail-customers/${id}/prepaid`, payload);
    return data as {
      prepaidBalance: number;
      totalDebt: number;
      netBalance: number;
    };
  },

  recordWithdraw: async (
    id: string,
    payload: { amount: number; currency?: 'UZS' | 'USD'; notes?: string },
  ) => {
    const { data } = await api.post(`/retail-customers/${id}/withdraw`, payload);
    return data as {
      prepaidBalance: number;
      totalDebt: number;
      netBalance: number;
    };
  },
};
