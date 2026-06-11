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

/** Ombor ichidagi alohida bo‘lim (WAREHOUSE_PICKING, WAREHOUSE_ATP, …) */
export function isFeatureKeyEnabled(
  cfg: CompanyFeatureConfig | null | undefined,
  featureKey: string,
): boolean {
  if (!cfg || !cfg.hasFeatureConfig) return true;
  return (cfg.enabledFeatures || []).some(
    (f) => String(f).toUpperCase() === featureKey.toUpperCase(),
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
  const checks = keys.map((k) => {
    const upper = k.toUpperCase();
    if (upper.includes('_') && !upper.endsWith('_MAIN')) {
      return isFeatureKeyEnabled(cfg, upper) || isModuleKeyEnabled(cfg, upper);
    }
    return isModuleKeyEnabled(cfg, k);
  });
  return mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}

export type MenuGuardItem = {
  href: string;
  moduleKeys?: string[];
  moduleMatch?: ModuleMatchMode;
};

const WAREHOUSE_PAGE_PATH = '/dashboard/warehouse';
const WAREHOUSE_BASIC_TABS = new Set(['balances', 'history', 'list']);

/**
 * Ombor sahifasi tablari bitta menyuda (`?tab=history`) himoyalangan;
 * `?tab=balances` / `list` uchun ham WAREHOUSE_BASIC qo‘llanadi.
 * `/dashboard/warehouse` (querysiz, WAREHOUSE_ATP) esa faqat ATP tab uchun.
 */
export function warehouseMenuQueryMatch(href: string, search = ''): boolean | null {
  const [path, queryString] = href.split('?');
  if (path !== WAREHOUSE_PAGE_PATH) return null;

  const actual = new URLSearchParams(search.replace(/^\?/, ''));
  const actualTab = actual.get('tab') || 'balances';

  if (queryString) {
    const expected = new URLSearchParams(queryString);
    if (expected.get('tab') === 'history') {
      return WAREHOUSE_BASIC_TABS.has(actualTab);
    }
    return null;
  }

  return !WAREHOUSE_BASIC_TABS.has(actualTab);
}

function menuHrefMatchesPathForGuard(
  pathname: string,
  href: string,
  search = '',
): boolean {
  const [path, queryString] = href.split('?');
  const pathMatches =
    path === '/dashboard'
      ? pathname === '/dashboard'
      : path === '/pos'
        ? pathname === '/pos' || pathname.startsWith('/pos/')
        : pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;

  if (pathname === WAREHOUSE_PAGE_PATH) {
    const warehouseMatch = warehouseMenuQueryMatch(href, search);
    if (warehouseMatch !== null) return warehouseMatch;
  }

  if (!queryString) return true;
  const expected = new URLSearchParams(queryString);
  const actual = new URLSearchParams(search.replace(/^\?/, ''));
  let ok = true;
  expected.forEach((value, key) => {
    if (actual.get(key) !== value) ok = false;
  });
  return ok;
}

/** Yo‘lga mos keladigan barcha modul himoyasi bandlari. */
export function findMenuGuardsForPath(
  pathname: string,
  items: MenuGuardItem[],
  search = '',
): MenuGuardItem[] {
  return items.filter((item) => {
    if (!item.moduleKeys?.length) return false;
    return menuHrefMatchesPathForGuard(pathname, item.href, search);
  });
}

/** Yo‘l uchun eng mos menyu bandi (eng uzun href — `/dashboard/reports` vs `/dashboard/reports/pos`). */
export function findMenuGuardForPath(
  pathname: string,
  items: MenuGuardItem[],
  search = '',
): MenuGuardItem | null {
  const candidates = findMenuGuardsForPath(pathname, items, search);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.href.length - a.href.length)[0];
}

/** Bir nechta menyu bandi mos kelsa — kamida bittasining moduli yoqilgan bo‘lsa kirish mumkin. */
export function isPathModuleAccessAllowed(
  pathname: string,
  items: MenuGuardItem[],
  cfg: CompanyFeatureConfig | null | undefined,
  search = '',
): boolean {
  const guards = findMenuGuardsForPath(pathname, items, search);
  if (!guards.length) return true;
  return guards.some((guard) =>
    areModuleKeysEnabled(cfg, guard.moduleKeys ?? [], guard.moduleMatch ?? 'all'),
  );
}
