import { api } from '@/lib/api';

export type LedgerOperationType =
  | 'MATERIAL_IN'
  | 'SALE_OUT'
  | 'RECEIPT_FROM_PARTNER'
  | 'PAYMENT_TO_PARTNER';

export type LedgerContactListItem = {
  id: string;
  name: string;
  phone?: string | null;
  tag?: string | null;
  balances: Record<string, number>;
  side: 'we_owe' | 'they_owe' | 'settled';
  operationCount: number;
  lastOperation?: {
    type: string;
    typeLabel: string;
    operationDate: string;
  } | null;
};

export type PartnerLedgerCatalogItem = {
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
  stockQty: number;
};

export type PartnerLedgerSettlementType =
  | 'on_credit'
  | 'cash'
  | 'card'
  | 'barter'
  | 'partial'
  | 'promised';

export type LedgerOperation = {
  id: string;
  type: LedgerOperationType;
  typeLabel: string;
  amount: number;
  currency: string;
  operationDate: string;
  notes?: string | null;
  productSummary?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  fromStock?: boolean;
  isSaleOrder?: boolean;
  hasLineDetail?: boolean;
  saleOrderStatus?: string | null;
  saleOrderComment?: string | null;
  balanceDelta: number;
  createdBy: { id: string; fullName: string; login: string };
};

export type PartnerLedgerSaleOrderLine = {
  productName: string;
  variantName: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
  salePrice: number;
  currency: string;
  lineTotal: number;
  warehouseName: string;
};

export const partnerLedgerService = {
  getSummary() {
    return api.get('/partner-ledger/summary').then((r) => r.data);
  },

  listContacts(search?: string) {
    return api
      .get<LedgerContactListItem[]>('/partner-ledger/contacts', { params: { search } })
      .then((r) => r.data);
  },

  listContactsForSelect(search?: string) {
    return api
      .get<Array<{ id: string; name: string; phone?: string | null; tag?: string | null; side: string }>>(
        '/partner-ledger/contacts/select',
        { params: { search } },
      )
      .then((r) => r.data);
  },

  getContact(contactId: string) {
    return api.get(`/partner-ledger/contacts/${contactId}`).then((r) => r.data);
  },

  createContact(payload: { name: string; phone?: string; tag?: string; notes?: string }) {
    return api.post('/partner-ledger/contacts', payload).then((r) => r.data);
  },

  updateContact(
    contactId: string,
    payload: Partial<{ name: string; phone: string; tag: string; notes: string }>,
  ) {
    return api.patch(`/partner-ledger/contacts/${contactId}`, payload).then((r) => r.data);
  },

  deleteContact(contactId: string) {
    return api.delete(`/partner-ledger/contacts/${contactId}`).then((r) => r.data);
  },

  listOperations(contactId: string, page = 1) {
    return api
      .get<{ items: LedgerOperation[]; total: number }>(
        `/partner-ledger/contacts/${contactId}/operations`,
        { params: { page, limit: 100 } },
      )
      .then((r) => r.data);
  },

  getBalanceHistory(contactId: string, days = 7) {
    return api
      .get<{ points: { date: string; UZS: number; USD: number }[] }>(
        `/partner-ledger/contacts/${contactId}/balance-history`,
        { params: { days } },
      )
      .then((r) => r.data);
  },

  getSaleCatalog(params: {
    warehouseId: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return api
      .get<{
        warehouse: { id: string; name: string };
        items: PartnerLedgerCatalogItem[];
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
      }>('/partner-ledger/sale-catalog', { params })
      .then((r) => r.data);
  },

  createSaleOrder(
    contactId: string,
    payload: {
      warehouseId: string;
      lines: Array<{ productVariantId: string; quantity: number }>;
      operationDate?: string;
      notes?: string;
      settlementType?: PartnerLedgerSettlementType;
      settlementNote?: string;
    },
  ) {
    return api
      .post(`/partner-ledger/contacts/${contactId}/sale-orders`, payload)
      .then((r) => r.data);
  },

  getSaleOrderLines(contactId: string, batchId: string) {
    return api
      .get<{
        batchId: string;
        lines: PartnerLedgerSaleOrderLine[];
        totals: Array<{ currency: string; amount: number }>;
      }>(`/partner-ledger/contacts/${contactId}/sale-orders/${batchId}/lines`)
      .then((r) => r.data);
  },

  getOperationLines(operationId: string) {
    return api
      .get<{
        lines: PartnerLedgerSaleOrderLine[];
        summaryOnly?: string | null;
        totals: Array<{ currency: string; amount: number }>;
      }>(`/partner-ledger/operations/${operationId}/lines`)
      .then((r) => r.data);
  },

  async exportOperationExcel(operationId: string, contactName: string) {
    const { downloadBlobFile } = await import('@/lib/download-blob');
    const response = await api.get(`/partner-ledger/operations/${operationId}/export/excel`, {
      responseType: 'blob',
    });
    const safe = contactName.replace(/[^\w\u0400-\u04FF-]+/g, '_').slice(0, 32);
    downloadBlobFile(response.data, `operatsiya-${safe}.xlsx`);
  },

  async exportOperationsExcel(contactId: string, contactName: string) {
    const { downloadBlobFile } = await import('@/lib/download-blob');
    const response = await api.get(
      `/partner-ledger/contacts/${contactId}/operations/export/excel`,
      { responseType: 'blob' },
    );
    const safe = contactName.replace(/[^\w\u0400-\u04FF-]+/g, '_').slice(0, 40);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlobFile(response.data, `hamkor-daftari-${safe}-${date}.xlsx`);
  },

  async downloadSaleOrderTemplate(warehouseId: string, contactName?: string) {
    const { downloadBlobFile } = await import('@/lib/download-blob');
    const response = await api.get('/partner-ledger/sale-order-template', {
      params: { warehouseId, contactName },
      responseType: 'blob',
    });
    downloadBlobFile(response.data, 'hamkor-buyurtma-shablon.xlsx');
  },

  async previewSaleOrderExcel(contactId: string, warehouseId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{
      lines: Array<{
        rowNumber: number;
        productVariantId: string;
        productName: string;
        name: string;
        sku?: string | null;
        barcode?: string | null;
        salePrice: number;
        currency: string;
        stockQty: number;
        quantity: number;
        lineTotal: number;
      }>;
      errors: Array<{ rowNumber: number; message: string; sku?: string; barcode?: string }>;
    }>(`/partner-ledger/contacts/${contactId}/sale-orders/preview-excel`, form, {
      params: { warehouseId },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async exportSaleOrderExcel(contactId: string, batchId: string, contactName: string) {
    const { downloadBlobFile } = await import('@/lib/download-blob');
    const response = await api.get(
      `/partner-ledger/contacts/${contactId}/sale-orders/${batchId}/export/excel`,
      { responseType: 'blob' },
    );
    const safe = contactName.replace(/[^\w\u0400-\u04FF-]+/g, '_').slice(0, 32);
    downloadBlobFile(response.data, `sotuv-${safe}.xlsx`);
  },

  sendSaleOrderToPartner(contactId: string, batchId: string) {
    return api
      .post(`/partner-ledger/contacts/${contactId}/sale-orders/${batchId}/send`)
      .then((r) => r.data);
  },

  createOperation(
    contactId: string,
    payload: {
      type: LedgerOperationType;
      amount: number;
      currency?: string;
      operationDate: string;
      notes?: string;
    },
  ) {
    return api
      .post(`/partner-ledger/contacts/${contactId}/operations`, payload)
      .then((r) => r.data);
  },

  updateOperation(
    operationId: string,
    payload: Partial<{
      type: LedgerOperationType;
      amount: number;
      currency: string;
      operationDate: string;
      notes: string;
    }>,
  ) {
    return api.patch(`/partner-ledger/operations/${operationId}`, payload).then((r) => r.data);
  },

  deleteOperation(operationId: string) {
    return api.delete(`/partner-ledger/operations/${operationId}`).then((r) => r.data);
  },
};
