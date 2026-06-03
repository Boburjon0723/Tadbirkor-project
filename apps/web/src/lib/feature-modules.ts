import type { CompanyFeatureConfig } from '@/services/companies.service';

export type ModuleMatchMode = 'any' | 'all';

/** Sozlamalar yoqilmagan kompaniyalarda barcha modullar ochiq hisoblanadi. */
export function isModuleKeyEnabled(
  cfg: CompanyFeatureConfig | null | undefined,
  key: string,
): boolean {
  if (!cfg || !cfg.hasFeatureConfig) return true;
  const upper = key.toUpperCase();
  const moduleSet = new Set((cfg.enabledModules || []).map((m) => m.toUpperCase()));
  const featureSet = new Set((cfg.enabledFeatures || []).map((f) => f.toUpperCase()));
  return (
    moduleSet.has(upper) ||
    featureSet.has(upper) ||
    Array.from(featureSet).some((f) => f.startsWith(`${upper}_`))
  );
}

/** Menyu yoki sahifa: bir nechta modul — `all` = hammasi yoqilgan, `any` = kamida bittasi. */
export function areModuleKeysEnabled(
  cfg: CompanyFeatureConfig | null | undefined,
  keys: string[],
  mode: ModuleMatchMode = 'all',
): boolean {
  if (!keys.length) return true;
  if (!cfg || !cfg.hasFeatureConfig) return true;
  const checks = keys.map((k) => isModuleKeyEnabled(cfg, k));
  return mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}

export type MenuGuardItem = {
  href: string;
  moduleKeys?: string[];
  moduleMatch?: ModuleMatchMode;
};

/** Yo‘l uchun eng mos menyu bandi (eng uzun href — `/dashboard/reports` vs `/dashboard/reports/pos`). */
export function findMenuGuardForPath(
  pathname: string,
  items: MenuGuardItem[],
): MenuGuardItem | null {
  const candidates = items.filter((item) => {
    if (!item.moduleKeys?.length) return false;
    if (item.href === '/dashboard') return pathname === '/dashboard';
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.href.length - a.href.length)[0];
}
