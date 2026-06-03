import { api } from '@/lib/api';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ExpenseCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type ExpenseRow = {
  id: string;
  categoryId: string;
  amount: number;
  currency: string;
  expenseDate: string;
  description?: string | null;
  notes?: string | null;
  status: ExpenseStatus;
  rejectReason?: string | null;
  category: { id: string; name: string };
  createdBy: { id: string; fullName: string; login: string };
  approvedBy?: { id: string; fullName: string; login: string } | null;
  approvedAt?: string | null;
  createdAt: string;
};

export const expensesService = {
  async getCategories() {
    const { data } = await api.get<ExpenseCategory[]>('/expenses/categories');
    return data;
  },

  async createCategory(payload: { name: string; sortOrder?: number }) {
    const { data } = await api.post('/expenses/categories', payload);
    return data;
  },

  async getSummary(params?: { from?: string; to?: string; currency?: string }) {
    const { data } = await api.get('/expenses/summary', { params });
    return data as {
      pending: Record<string, number>;
      approved: Record<string, number>;
      rejected: Record<string, number>;
      counts: { pending: number; approved: number; rejected: number };
    };
  },

  async list(params?: {
    status?: string;
    categoryId?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { data } = await api.get('/expenses', { params });
    return data as {
      items: ExpenseRow[];
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
    expenseDate: string;
    description?: string;
    notes?: string;
  }) {
    const { data } = await api.post('/expenses', payload);
    return data as ExpenseRow;
  },

  async update(
    id: string,
    payload: Partial<{
      categoryId: string;
      amount: number;
      currency: string;
      expenseDate: string;
      description: string;
      notes: string;
    }>,
  ) {
    const { data } = await api.patch(`/expenses/${id}`, payload);
    return data as ExpenseRow;
  },

  async approve(id: string) {
    const { data } = await api.post(`/expenses/${id}/approve`);
    return data as ExpenseRow;
  },

  async reject(id: string, reason: string) {
    const { data } = await api.post(`/expenses/${id}/reject`, { reason });
    return data as ExpenseRow;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/expenses/${id}`);
    return data;
  },
};
