import { api } from '@/lib/api';

export const fieldService = {
  listTasks: async (params?: { status?: string; assigneeId?: string; warehouseId?: string }) => {
    const { data } = await api.get('/field/tasks', { params });
    return data;
  },

  getTask: async (id: string) => {
    const { data } = await api.get(`/field/tasks/${id}`);
    return data;
  },

  createTask: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/field/tasks', payload);
    return data;
  },

  approveTask: async (id: string) => {
    const { data } = await api.post(`/field/tasks/${id}/approve`);
    return data;
  },

  rejectTask: async (id: string, reason: string) => {
    const { data } = await api.post(`/field/tasks/${id}/reject`, { reason });
    return data;
  },

  workerBalances: async () => {
    const { data } = await api.get('/field/workers/stock');
    return data;
  },

  kpi: async (from?: string, to?: string) => {
    const { data } = await api.get('/field/reports/kpi', { params: { from, to } });
    return data;
  },

  myTasks: async (status?: string) => {
    const { data } = await api.get('/field/me/tasks', { params: { status } });
    return data;
  },

  myTask: async (id: string) => {
    const { data } = await api.get(`/field/me/tasks/${id}`);
    return data;
  },

  myStock: async () => {
    const { data } = await api.get('/field/me/stock');
    return data;
  },

  myHistory: async () => {
    const { data } = await api.get('/field/me/history');
    return data;
  },

  acceptTask: async (id: string) => {
    const { data } = await api.post(`/field/tasks/${id}/accept`);
    return data;
  },

  submitReport: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.post(`/field/tasks/${id}/report`, payload);
    return data;
  },
};
