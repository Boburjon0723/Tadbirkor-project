import type { StockFieldValue } from '@/lib/product-units';

/** API variantidan UI «Rang» maydoni (attributesJson.color, kerak bo‘lsa nomdan) */
export function variantColorFromApi(variant: {
  name?: string;
  attributesJson?: { color?: unknown };
  attributes?: { color?: unknown };
}): string {
  const fromAttrs = variant?.attributesJson?.color ?? variant?.attributes?.color;
  if (fromAttrs != null && String(fromAttrs).trim()) {
    return String(fromAttrs).trim();
  }
  const name = String(variant?.name || '').trim();
  const lower = name.toLowerCase();
  if (!name || lower === 'standart' || lower.startsWith('default /')) return '';
  return name;
}

export function stockQtyForWarehouse(variant: any, warehouseId: string): number {
  if (!warehouseId || !variant?.stockBalances) return 0;
  const row = variant.stockBalances.find((b: any) => b.warehouseId === warehouseId);
  return row ? Number(row.quantity) : 0;
}

export const resolveImageUrl = (raw?: string) => {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const apiBase = String(process.env.NEXT_PUBLIC_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const origin = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
  if (!origin) return v;
  return v.startsWith('/') ? `${origin}${v}` : `${origin}/${v}`;
};

export type ProductVariantForm = {
  id?: string;
  name: string;
  barcode: string;
  color?: string;
  purchasePrice: number | '';
  salePrice: number | '';
  currency: 'UZS' | 'USD';
  initialStock: StockFieldValue;
  previousStock?: number;
};

export type ProductFormData = {
  name: string;
  description: string;
  categoryId: string;
  sku: string;
  unit: string;
  type: string;
  imageUrl: string;
  targetWarehouseId: string;
  variants: ProductVariantForm[];
};

export type WarehouseFieldConfig = {
  showVariantName: boolean;
  showImage: boolean;
  showDescription: boolean;
  showSku: boolean;
  showBarcode: boolean;
  showColor: boolean;
  showTotalStock: boolean;
  showPurchasePrice: boolean;
  showSalePrice: boolean;
};

export function warehouseFieldConfig(configWarehouse: any): WarehouseFieldConfig {
  return {
    showVariantName: configWarehouse?.fieldConfig?.showVariantName ?? true,
    showImage: configWarehouse?.fieldConfig?.showImage ?? true,
    showDescription: configWarehouse?.fieldConfig?.showDescription ?? true,
    showSku: configWarehouse?.fieldConfig?.showSku ?? true,
    showBarcode: configWarehouse?.fieldConfig?.showBarcode ?? true,
    showColor: configWarehouse?.fieldConfig?.showColor ?? true,
    showTotalStock: configWarehouse?.fieldConfig?.showTotalStock ?? true,
    showPurchasePrice: configWarehouse?.fieldConfig?.showPurchasePrice ?? true,
    showSalePrice: configWarehouse?.fieldConfig?.showSalePrice ?? true,
  };
}
