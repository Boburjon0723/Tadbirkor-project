import { api } from "@/lib/api";

export const dashboardService = {
  async getStats() {
    const { data } = await api.get("/dashboard/stats");
    return data;
  },
};
