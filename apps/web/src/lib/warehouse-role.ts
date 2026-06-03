import type { SessionRole } from '@/hooks/use-session';
import type { WarehouseFieldConfig } from '@/features/product-modal/product-modal-utils';

export function normalizeSessionRole(role: string | undefined): SessionRole | string {
  return String(role || 'owner').toLowerCase();
}

export function isWarehouseRole(role: string | undefined): boolean {
  return normalizeSessionRole(role) === 'warehouse';
}

/** Katalog: faqat qoldiq ko‘rish, tahrirlash/import yo‘q */
export function isInventoryCatalogReadOnly(role: string | undefined): boolean {
  return isWarehouseRole(role);
}

/** Omborchi: katalog jadvali va batafsilda narx ustunlari ko‘rinmasin */
export function maskWarehouseCatalogFieldConfig(
  config: WarehouseFieldConfig,
  role: string | undefined,
): WarehouseFieldConfig {
  if (!isInventoryCatalogReadOnly(role)) return config;
  return {
    ...config,
    showSalePrice: false,
    showPurchasePrice: false,
  };
}
