import type { SessionRole } from '@/hooks/use-session';
import type { WarehouseFieldConfig } from '@/features/product-modal/product-modal-utils';
import { isInventoryCatalogReadOnly as isCatalogReadOnly } from '@/lib/role-access';

export function normalizeSessionRole(role: string | undefined): SessionRole | string {
  return String(role || 'owner').toLowerCase();
}

export function isWarehouseRole(role: string | undefined): boolean {
  return normalizeSessionRole(role) === 'warehouse';
}

/** Katalog: omborchi va sotuvchi — faqat qoldiq, narx/tahrir cheklangan */
export function isInventoryCatalogReadOnly(role: string | undefined): boolean {
  return isCatalogReadOnly(role);
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
