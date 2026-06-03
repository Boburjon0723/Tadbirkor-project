import { api } from "@/lib/api";

export const auditService = {
  async getLogs(params?: Record<string, any>) {
    const { data } = await api.get("/audit-logs", { params });
    return data;
  },

  async getStats() {
    const { data } = await api.get("/audit-logs/stats");
    return data;
  },

  async getLog(id: string) {
    const { data } = await api.get(`/audit-logs/${id}`);
    return data;
  },
};
