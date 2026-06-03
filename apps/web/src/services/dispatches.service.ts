import { api } from "@/lib/api";

export const dispatchesService = {
  async getDispatches(params?: Record<string, any>) {
    const { data } = await api.get("/dispatches", { params });
    return data;
  },
  
  async getDispatch(id: string) {
    const { data } = await api.get(`/dispatches/${id}`);
    return data;
  },
  
  async createDispatch(payload: {
    orderId: string;
    warehouseId: string;
    items?: Array<{ orderItemId: string; quantity: number }>;
  }) {
    const { data } = await api.post("/dispatches", payload);
    return data;
  },

  async createAndSendDispatch(payload: {
    orderId: string;
    warehouseId: string;
    items?: Array<{ orderItemId: string; quantity: number }>;
  }) {
    const { data } = await api.post("/dispatches/create-and-send", payload);
    return data;
  },
  
  async sendDispatch(id: string) {
    const { data } = await api.post(`/dispatches/${id}/send`);
    return data;
  },
  
  async cancelDispatch(id: string) {
    const { data } = await api.post(`/dispatches/${id}/cancel`);
    return data;
  },
};
