import { api } from "@/lib/api";

export type CreateOrderItemDto = {
  productVariantId?: string;
  productName: string;
  quantity: number;
  expectedPrice: number;
  expectedCurrency?: 'UZS' | 'USD';
  note?: string;
};

export interface CreateOrderDto {
  sellerCompanyId: string;
  expectedDeliveryDate?: string;
  notes?: string;
  items: CreateOrderItemDto[];
}

export interface UpdateDraftOrderDto {
  expectedDeliveryDate?: string;
  note?: string;
  items: CreateOrderItemDto[];
}

export type OrdersListResponse = {
  items: any[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type OrdersHubStats = {
  my: {
    sent: number;
    accepted: number;
    mappingNeeded: number;
    inProgress: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  incoming: {
    sent: number;
    accepted: number;
    mappingNeeded: number;
    inProgress: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
};

export const ordersService = {
  async getOrdersHubStats() {
    const { data } = await api.get<OrdersHubStats>('/b2b-orders/hub/stats');
    return data;
  },

  // Outgoing Orders (Buyer side)
  async getOrders() {
    const { data } = await api.get('/b2b-orders');
    return data;
  },

  async getOrdersPage(params: Record<string, unknown>) {
    const { data } = await api.get('/b2b-orders', {
      params: { ...params, limit: params.limit ?? 30 },
    });
    return data as OrdersListResponse;
  },

  async createOrder(dto: CreateOrderDto) {
    const { notes, ...rest } = dto;
    const { data } = await api.post("/b2b-orders", { ...rest, note: notes });
    return data;
  },

  async updateDraftOrder(id: string, dto: UpdateDraftOrderDto) {
    const { data } = await api.patch(`/b2b-orders/${id}`, dto);
    return data;
  },

  async getPricingSuggestion(sellerCompanyId: string, productName: string) {
    const { data } = await api.get<{
      expectedPrice: number;
      expectedCurrency?: 'UZS' | 'USD';
      productVariantId?: string;
      productName?: string;
      variantName?: string;
    }>("/b2b-orders/pricing/suggestion", {
      params: { sellerCompanyId, productName },
    });
    return data;
  },

  /** Faol hamkor uchun sotuvchi katalogi (buyurtma beruvchi ma'lumot uchun). */
  async getSellerCatalog(sellerCompanyId: string, search?: string) {
    const { data } = await api.get("/b2b-orders/seller-catalog", {
      params: {
        sellerCompanyId,
        ...(search?.trim() ? { search: search.trim() } : {}),
      },
    });
    return data as {
      sellerCompanyId: string;
      total?: number;
      warehouseFilterActive?: boolean;
      items: Array<{
        productId: string;
        productName: string;
        variantId: string;
        variantName: string;
        sku: string | null;
        color: string | null;
        imageUrl: string | null;
        salePrice: number;
        currency: string;
      }>;
    };
  },

  async sendOrder(id: string) {
    const { data } = await api.post(`/b2b-orders/${id}/send`);
    return data;
  },

  async cancelOrder(id: string) {
    const { data } = await api.post(`/b2b-orders/${id}/cancel`);
    return data;
  },

  async deleteOrder(id: string) {
    const { data } = await api.delete(`/b2b-orders/${id}`);
    return data;
  },

  // Incoming Orders (Seller side)
  async getIncomingOrders() {
    const { data } = await api.get('/incoming-orders');
    return data;
  },

  async getIncomingOrdersPage(params: Record<string, unknown>) {
    const { data } = await api.get('/incoming-orders', {
      params: { ...params, limit: params.limit ?? 30 },
    });
    return data as OrdersListResponse;
  },

  async acceptIncomingOrder(id: string, options?: { allowPartial?: boolean }) {
    const { data } = await api.post(`/incoming-orders/${id}/accept`, options ?? {});
    return data;
  },

  async rejectIncomingOrder(id: string) {
    const { data } = await api.post(`/incoming-orders/${id}/reject`);
    return data;
  },

  async mapIncomingOrderItem(
    orderId: string,
    itemId: string,
    payload: { ownProductVariantId: string; sellerPrice?: number; sellerCurrency?: 'UZS' | 'USD' },
  ) {
    const { data } = await api.post(`/incoming-orders/${orderId}/items/${itemId}/map`, {
      ...payload,
    });
    return data;
  },

  async getOrderDetail(id: string) {
    const { data } = await api.get(`/b2b-orders/${id}`);
    return data;
  },

  async getOrderItemsPage(
    orderId: string,
    params: { page?: number; limit?: number; search?: string; unmappedOnly?: boolean },
  ) {
    const { data } = await api.get(`/b2b-orders/${orderId}/items`, {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        ...(params.search ? { search: params.search } : {}),
        ...(params.unmappedOnly ? { unmappedOnly: 'true' } : {}),
      },
    });
    return data as {
      items: any[];
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
      maxLineItems: number;
    };
  },

  async closeOrderRemainder(id: string, role: 'my' | 'incoming') {
    const path =
      role === 'incoming'
        ? `/incoming-orders/${id}/close-remainder`
        : `/b2b-orders/${id}/close-remainder`;
    const { data } = await api.post(path);
    return data;
  },
};
