import {
  warehouseFieldConfig,
  resolveImageUrl,
  type WarehouseFieldConfig,
} from '@/features/product-modal/product-modal-utils';

export { resolveImageUrl, warehouseFieldConfig, type WarehouseFieldConfig };

export function formatMoney(value: number, currency: 'UZS' | 'USD' = 'UZS') {
  const amount = Number(value || 0);
  if (currency === 'USD') {
    return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} USD`;
  }
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} UZS`;
}

export function visibleColumnCount(
  config: WarehouseFieldConfig,
  options?: { alwaysShowCatalogSize?: boolean },
): number {
  const showCatalogSize = options?.alwaysShowCatalogSize ?? false;
  return (
    1 +
    (config.showSku || config.showBarcode || config.showColor ? 1 : 0) +
    (showCatalogSize ? 1 : 0) +
    (config.showTotalStock ? 1 : 0) +
    (config.showSalePrice || config.showPurchasePrice ? 1 : 0) +
    1
  );
}

/** Ombor katalogi: nechta mahsulot (pozitsiya) va nechta variant (rang) */
export function summarizeWarehouseCatalog(products: any[] | undefined): {
  productCount: number;
  variantCount: number;
} {
  const list = products || [];
  return {
    productCount: list.length,
    variantCount: list.reduce((sum, p) => sum + (p.variants?.length || 0), 0),
  };
}

export function productVariantCount(product: any): number {
  return product?.variants?.length || 0;
}

export function filterProductsForWarehouse(
  products: any[] | undefined,
  warehouseId: string,
): any[] {
  if (!warehouseId) return [];
  return products || [];
}

export function productTotalStock(product: any, warehouseId: string): number {
  return (product.variants || []).reduce((sum: number, v: any) => {
    const balances = warehouseId
      ? (v.stockBalances || []).filter((b: any) => b.warehouseId === warehouseId)
      : v.stockBalances || [];
    return (
      sum +
      balances.reduce((s: number, b: any) => s + Number(b.quantity || 0), 0)
    );
  }, 0);
}
