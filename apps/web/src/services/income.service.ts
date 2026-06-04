import { api } from '@/lib/api';

export type IncomeCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type IncomeRow = {
  id: string;
  categoryId: string;
  amount: number;
  currency: string;
  incomeDate: string;
  description?: string | null;
  notes?: string | null;
  category: { id: string; name: string };
  createdBy: { id: string; fullName: string; login: string };
  createdAt: string;
};

export const incomeService = {
  async getCategories() {
    const { data } = await api.get<IncomeCategory[]>('/income/categories');
    return data;
  },

  async list(params?: {
    categoryId?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { data } = await api.get('/income', { params });
    return data as {
      items: IncomeRow[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  },

  async create(payload: {
    categoryId: string;
    amount: number;
    currency?: string;
    incomeDate: string;
    description?: string;
    notes?: string;
  }) {
    const { data } = await api.post('/income', payload);
    return data as IncomeRow;
  },

  async update(
    id: string,
    payload: Partial<{
      categoryId: string;
      amount: number;
      currency: string;
      incomeDate: string;
      description: string;
      notes: string;
    }>,
  ) {
    const { data } = await api.patch(`/income/${id}`, payload);
    return data as IncomeRow;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/income/${id}`);
    return data;
  },
};
