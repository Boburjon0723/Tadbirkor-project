import { api } from "@/lib/api";
import type { StockHistoryItem } from "@/features/warehouse/warehouse-history-types";

export const warehouseService = {
  // Warehouses
  async getWarehouses() {
    const { data } = await api.get("/warehouses");
    return data;
  },

  async createWarehouse(dto: any) {
    const { data } = await api.post("/warehouses", dto);
    return data;
  },

  async updateWarehouse(id: string, dto: any) {
    const { data } = await api.patch(`/warehouses/${id}`, dto);
    return data;
  },

  async deleteWarehouse(id: string) {
    const { data } = await api.delete(`/warehouses/${id}`);
    return data;
  },

  // Stock Balances
  async getStockBalances(params?: any) {
    const { data } = await api.get("/stock/balances", { params });
    return data;
  },

  async getStockAvailability(variantId: string, params?: { warehouseId?: string }) {
    const { data } = await api.get(`/stock/availability/${variantId}`, { params });
    return data;
  },

  async getBatchStockAvailability(dto: { warehouseId?: string; variantIds: string[] }) {
    const { data } = await api.post("/stock/availability/batch", dto);
    return data;
  },

  // Stock Movements
  async getStockMovements(params?: { warehouseId?: string }) {
    const { data } = await api.get<StockHistoryItem[]>("/stock/movements", { params });
    return data;
  },

  // Inventory Operations
  async recordIn(dto: any) {
    const { data } = await api.post("/stock/movements/in", dto);
    return data;
  },

  async recordOut(dto: any) {
    const { data } = await api.post("/stock/movements/out", dto);
    return data;
  },

  async adjust(dto: any) {
    const { data } = await api.post("/stock/adjustments", dto);
    return data;
  },

  async transfer(dto: any) {
    const { data } = await api.post("/stock/transfer", dto);
    return data;
  },
};
