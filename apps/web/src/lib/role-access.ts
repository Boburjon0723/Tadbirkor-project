import type { SessionRole } from '@/hooks/use-session';

/** Ombor kirimi — skaner va tasdiqlash */
export function canAccessWarehouseIntake(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'owner' || r === 'manager' || r === 'warehouse';
}

/** Ombor kirimi sozlamalari (rejim, tez qo'shish va h.k.) */
export function canManageIntakeSettings(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'owner' || r === 'manager';
}

/** Mahsulot katalogi — barcha rollar ko'radi; warehouse/sales faqat o'qish */
export function canAccessInventoryCatalog(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return ['owner', 'manager', 'warehouse', 'accountant', 'sales'].includes(r);
}

export function isInventoryCatalogReadOnly(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'warehouse' || r === 'sales';
}

/** Ombor harakatlari tarixi (/dashboard/warehouse) */
export function canAccessWarehouseHistory(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'owner' || r === 'manager' || r === 'warehouse' || r === 'accountant';
}

/** Umumiy hisobotlar */
export function canAccessReports(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'owner' || r === 'manager' || r === 'accountant';
}

/** Dashboard moliya KPI (debitor/kreditor) */
export function canSeeFinanceKpi(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'owner' || r === 'manager' || r === 'accountant';
}

/** Kompaniya sozlamalari (to'liq) */
export function canAccessCompanySettings(role: SessionRole | string | undefined): boolean {
  return String(role || '').toLowerCase() === 'owner';
}

/** Yangi ombor yaratish / o'chirish — faqat boshqaruv */
export function canManageWarehouses(role: SessionRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'owner' || r === 'manager';
}

/** Mobil kirim: boshqaruv (egasi/menejer) yoki operatsion (omborchi) */
export type IntakeMobileView = 'management' | 'operator';

export type IntakeMobileCapabilities = {
  view: IntakeMobileView;
  showStats: boolean;
  showWarehouseFilter: boolean;
  showSettingsLink: boolean;
  showHistoryLink: boolean;
  showSearch: boolean;
  showPartnerOnCreate: boolean;
  showNakladnoyOnList: boolean;
  roleLabel: string;
};

export function getIntakeMobileCapabilities(
  role: SessionRole | string | undefined,
): IntakeMobileCapabilities {
  const r = String(role || '').toLowerCase();
  if (r === 'owner' || r === 'manager') {
    return {
      view: 'management',
      showStats: true,
      showWarehouseFilter: true,
      showSettingsLink: true,
      showHistoryLink: true,
      showSearch: true,
      showPartnerOnCreate: true,
      showNakladnoyOnList: true,
      roleLabel: r === 'owner' ? 'Egasi' : 'Menejer',
    };
  }
  return {
    view: 'operator',
    showStats: false,
    showWarehouseFilter: false,
    showSettingsLink: false,
    showHistoryLink: false,
    showSearch: true,
    showPartnerOnCreate: false,
    showNakladnoyOnList: false,
    roleLabel: 'Omborchi',
  };
}

/** Omborchi yaratishda ombor tanlovini qulflash */
export function shouldLockIntakeWarehouseOnCreate(
  role: SessionRole | string | undefined,
  warehouseCount: number,
): boolean {
  if (warehouseCount <= 1) return true;
  return String(role || '').toLowerCase() === 'warehouse';
}
