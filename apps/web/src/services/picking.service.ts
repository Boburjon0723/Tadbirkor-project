import { api } from "@/lib/api";

export const pickingService = {
  async listPickTasks(params?: { status?: string; warehouseId?: string }) {
    const { data } = await api.get("/pick-tasks", { params });
    return data;
  },

  async getPickTask(taskId: string) {
    const { data } = await api.get(`/pick-tasks/${taskId}`);
    return data;
  },

  async getDispatchPickTasks(dispatchId: string) {
    const { data } = await api.get(`/dispatches/${dispatchId}/pick-tasks`);
    return data;
  },

  async scanPickTask(taskId: string, payload: { barcode: string; quantity?: number }) {
    const { data } = await api.patch(`/pick-tasks/${taskId}/scan`, payload);
    return data;
  },

  async completePickTask(taskId: string) {
    const { data } = await api.patch(`/pick-tasks/${taskId}/complete`);
    return data;
  },
};
