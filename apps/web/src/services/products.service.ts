import { api } from "@/lib/api";

export interface CreateProductDto {
  name: string;
  categoryId: string;
  unit: string;
  type: 'GOODS' | 'SERVICE' | 'RAW_MATERIAL' | 'FINISHED_GOOD';
  description?: string;
  imageUrl?: string | null;
  variants?: {
    name: string;
    sku?: string;
    barcode?: string;
    purchasePrice?: number;
    salePrice?: number;
    attributes?: Record<string, any>;
    weight?: number;
    volume?: number;
  }[];
}

export type ProductsListResponse = {
  items: any[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  summary?: { productCount: number; variantCount: number };
};

export function isPaginatedProductsResponse(
  data: unknown,
): data is ProductsListResponse {
  return (
    !!data &&
    typeof data === 'object' &&
    Array.isArray((data as ProductsListResponse).items)
  );
}

export function normalizeProductsList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (isPaginatedProductsResponse(data)) return data.items;
  return [];
}

export const productsService = {
  // Products
  async getProducts(params?: Record<string, unknown>) {
    const { data } = await api.get('/products', { params });
    return data;
  },

  async getProductsPage(params: Record<string, unknown>) {
    const { data } = await api.get('/products', {
      params: {
        ...params,
        limit: params.limit ?? 50,
        view: params.view ?? 'catalog',
      },
    });
    return data as ProductsListResponse;
  },

  async getCatalogSummary(params?: Record<string, unknown>) {
    const { data } = await api.get('/products/summary/stats', { params });
    return data as { productCount: number; variantCount: number };
  },

  async getProduct(id: string, warehouseId?: string) {
    const { data } = await api.get(`/products/${id}`, {
      params: warehouseId ? { warehouseId } : undefined,
    });
    return data;
  },

  async createProduct(dto: CreateProductDto) {
    const { data } = await api.post("/products", dto);
    return data;
  },

  async updateProduct(id: string, dto: any) {
    const { data } = await api.patch(`/products/${id}`, dto);
    return data;
  },

  async deleteProduct(id: string) {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  },

  // Variants
  async createVariant(productId: string, dto: any) {
    const { data } = await api.post(`/product-variants/product/${productId}`, dto);
    return data;
  },

  async deleteVariant(id: string) {
    const { data } = await api.delete(`/product-variants/${id}`);
    return data;
  },

  async publishVariant(id: string, isPublishedToWebsite: boolean) {
    const { data } = await api.patch(`/product-variants/${id}/publish`, {
      isPublishedToWebsite,
    });
    return data;
  },

  // Categories
  async getCategories(params?: { warehouseId?: string }) {
    const { data } = await api.get("/product-categories", { params });
    return data;
  },

  async createCategory(dto: { name: string; parentId?: string; warehouseId: string }) {
    const { data } = await api.post("/product-categories", dto);
    return data;
  },

  async deleteCategory(id: string) {
    const { data } = await api.delete(`/product-categories/${id}`);
    return data;
  },

  async importPreview(
    file: File,
    options?: { warehouseId?: string; importMode?: 'set' | 'add' | 'subtract' },
  ) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/products/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      params: {
        ...(options?.warehouseId ? { warehouseId: options.warehouseId } : {}),
        ...(options?.importMode ? { importMode: options.importMode } : {}),
      },
    });
    return data;
  },

  async importConfirm(
    rows: any[],
    options?: {
      importMode?: 'set' | 'add' | 'subtract';
      stockPolicy?: 'skip_zero_and_unchanged' | 'apply_all';
      warehouseId?: string;
      partnerLedgerContactId?: string;
    },
  ) {
    const { data } = await api.post(
      '/products/import/confirm',
      {
        rows,
        importMode: options?.importMode ?? 'set',
        stockPolicy: options?.stockPolicy ?? 'apply_all',
        ...(options?.partnerLedgerContactId
          ? { partnerLedgerContactId: options.partnerLedgerContactId }
          : {}),
      },
      {
        params: options?.warehouseId ? { warehouseId: options.warehouseId } : undefined,
        timeout: 600_000,
      },
    );
    return data;
  },

  async getImportJobStatus(jobId: string) {
    const { data } = await api.get(`/products/import/jobs/${jobId}`);
    return data;
  },

  async getImportJobFailures(jobId: string, limit = 30) {
    const { data } = await api.get(`/products/import/jobs/${jobId}/failures`, {
      params: { limit },
    });
    return data;
  },

  async cancelImportJob(jobId: string) {
    const { data } = await api.post(`/products/import/jobs/${jobId}/cancel`);
    return data;
  },
};
