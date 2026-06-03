import { api } from '../api/client';
import { cacheGet, cacheSet, cacheInvalidatePrefix, DEFAULT_CACHE_TTL_MS } from './data-cache';

export type PosCatalogItem = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice: number;
  currency: string;
  image?: string | null;
  categoryId?: string | null;
  quantity: number;
};

export type PosCatalogResponse = {
  items: PosCatalogItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

/** POS ro'yxati uchun stock/balance qatoriga mos shakl */
export function mapCatalogItemToStockRow(item: PosCatalogItem) {
  const variant = {
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcode: item.barcode,
    salePrice: item.salePrice,
    currency: item.currency || 'UZS',
    imageUrl: item.image,
    product: {
      id: item.productId,
      name: item.productName,
      imageUrl: item.image,
      categoryId: item.categoryId,
    },
  };
  return {
    id: item.id,
    quantity: item.quantity,
    productVariant: variant,
  };
}

export function mapQuickSearchToStockRow(item: {
  id: string;
  productId: string;
  productName: string | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice: number;
  currency: string;
  stock: number | null;
}) {
  return mapCatalogItemToStockRow({
    id: item.id,
    productId: item.productId,
    productName: item.productName || '',
    name: item.name,
    sku: item.sku,
    barcode: item.barcode,
    salePrice: item.salePrice,
    currency: item.currency,
    quantity: Number(item.stock ?? 0),
  });
}

function catalogCacheKey(warehouseId: string, search: string, limit: number) {
  return `pos:catalog:${warehouseId}:${search}:${limit}`;
}

export async function fetchPosCatalog(
  warehouseId: string,
  opts?: { search?: string; limit?: number; force?: boolean },
): Promise<PosCatalogResponse> {
  const search = String(opts?.search || '').trim();
  const limit = opts?.limit ?? 120;
  const key = catalogCacheKey(warehouseId, search, limit);

  if (!opts?.force) {
    const cached = cacheGet<PosCatalogResponse>(key);
    if (cached) return cached;
  }

  const { data } = await api.get<PosCatalogResponse>('/pos/catalog', {
    params: { warehouseId, search: search || undefined, limit, page: 1 },
  });

  const result: PosCatalogResponse = {
    items: Array.isArray(data?.items) ? data.items : [],
    page: data?.page ?? 1,
    limit: data?.limit ?? limit,
    total: data?.total ?? 0,
    hasMore: Boolean(data?.hasMore),
  };

  cacheSet(key, result, DEFAULT_CACHE_TTL_MS);
  return result;
}

export function invalidatePosCatalogCache(warehouseId?: string) {
  if (warehouseId) {
    cacheInvalidatePrefix(`pos:catalog:${warehouseId}:`);
  } else {
    cacheInvalidatePrefix('pos:catalog:');
  }
}

export async function searchPosByBarcode(warehouseId: string, barcode: string) {
  const { data } = await api.get('/pos/quick-search', {
    params: { query: barcode, warehouseId },
  });
  const rows = Array.isArray(data) ? data : [];
  const withStock = rows.find((r: { stock?: number | null }) => Number(r.stock ?? 0) > 0);
  return withStock ? mapQuickSearchToStockRow(withStock) : null;
}
