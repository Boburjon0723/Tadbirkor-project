import { api } from "@/lib/api";

export interface PosSaleItemInput {
  productVariantId: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreatePosSaleDto {
  warehouseId: string;
  items: PosSaleItemInput[];
  discountAmount?: number;
  note?: string;
  retailCustomerId?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface CheckoutPosSaleDto {
  method: 'CASH' | 'CARD' | 'CREDIT';
  cashReceived?: number;
  retailCustomerId?: string;
  customerName?: string;
  customerPhone?: string;
}

export type QuickCheckoutPosSaleDto = CreatePosSaleDto & CheckoutPosSaleDto;

export type PosCatalogItem = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice: number;
  currency?: string;
  image?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  quantity: number;
};

export type PosCatalogResponse = {
  items: PosCatalogItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export const posService = {
  async getCatalog(params: {
    warehouseId: string;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    const { data } = await api.get<PosCatalogResponse>('/pos/catalog', { params });
    return data;
  },

  async quickSearch(query: string, warehouseId?: string) {
    const { data } = await api.get("/pos/quick-search", { params: { query, warehouseId } });
    return data;
  },

  async summaryToday(cashierId?: string) {
    const { data } = await api.get("/pos/summary/today", { params: { cashierId } });
    return data;
  },

  async createSale(dto: CreatePosSaleDto) {
    const { data } = await api.post("/pos/sales", dto);
    return data;
  },

  async findAll(params?: any) {
    const { data } = await api.get("/pos/sales", { params });
    return data;
  },

  async findOne(id: string) {
    const { data } = await api.get(`/pos/sales/${id}`);
    return data;
  },

  async updateSale(id: string, dto: any) {
    const { data } = await api.patch(`/pos/sales/${id}`, dto);
    return data;
  },

  async checkout(id: string, dto: CheckoutPosSaleDto) {
    const { data } = await api.post(`/pos/sales/${id}/checkout`, dto);
    return data;
  },

  /** Bitta so‘rov: chek + to‘lov (tez POS). Eski API build bo‘lsa create+checkout fallback. */
  async quickCheckout(dto: QuickCheckoutPosSaleDto) {
    try {
      const { data } = await api.post('/pos/sales/quick-checkout', dto);
      return data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) throw err;

      const { method, cashReceived, retailCustomerId, customerName, customerPhone, ...createDto } =
        dto;
      const { data: sale } = await api.post('/pos/sales', createDto);
      const { data } = await api.post(`/pos/sales/${sale.id}/checkout`, {
        method,
        cashReceived,
        retailCustomerId,
        customerName,
        customerPhone,
      });
      return data;
    }
  },

  async voidSale(id: string, dto: { reason: string }) {
    const { data } = await api.post(`/pos/sales/${id}/void`, dto);
    return data;
  },

  async deleteDraft(id: string) {
    const { data } = await api.delete(`/pos/sales/${id}`);
    return data;
  },
};
