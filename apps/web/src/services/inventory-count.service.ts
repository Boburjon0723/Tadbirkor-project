import { api } from "@/lib/api";

export const inventoryCountService = {
  async list(params?: { status?: string; warehouseId?: string }) {
    const { data } = await api.get("/inventory-counts", { params });
    return data;
  },

  async getOne(id: string) {
    const { data } = await api.get(`/inventory-counts/${id}`);
    return data;
  },

  async start(dto: { warehouseId: string; productVariantIds?: string[] }) {
    const { data } = await api.post("/inventory-counts", dto);
    return data;
  },

  async recordCount(itemId: string, countedQuantity: number) {
    const { data } = await api.patch(`/inventory-counts/items/${itemId}/count`, {
      countedQuantity,
    });
    return data;
  },

  async scan(countId: string, payload: { barcode: string; countedQuantity: number }) {
    const { data } = await api.post(`/inventory-counts/${countId}/scan`, payload);
    return data;
  },

  async approveItem(itemId: string) {
    const { data } = await api.patch(`/inventory-counts/items/${itemId}/approve`);
    return data;
  },

  async complete(id: string) {
    const { data } = await api.post(`/inventory-counts/${id}/complete`);
    return data;
  },

  async cancel(id: string) {
    const { data } = await api.post(`/inventory-counts/${id}/cancel`);
    return data;
  },
};
