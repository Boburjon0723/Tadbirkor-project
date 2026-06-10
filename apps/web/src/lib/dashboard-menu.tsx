import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import type { ModuleMatchMode } from '@/lib/feature-modules';
import type { SessionRole } from '@/hooks/use-session';
import { GROUP, SECTION } from '@/lib/dashboard-labels';

export type DashboardMenuIcons = {
  LayoutDashboard: LucideIcon;
  Box: LucideIcon;
  Handshake: LucideIcon;
  GitBranch: LucideIcon;
  CreditCard: LucideIcon;
  History: LucideIcon;
  ShoppingBag: LucideIcon;
  Truck: LucideIcon;
  Wallet: LucideIcon;
  Users: LucideIcon;
  Store: LucideIcon;
  Wallet2: LucideIcon;
  TrendingUp: LucideIcon;
  Banknote: LucideIcon;
  BarChart3: LucideIcon;
  Link2: LucideIcon;
  Settings: LucideIcon;
  PackagePlus: LucideIcon;
};

export type DashboardMenuItem = {
  icon: ReactNode;
  label: string;
  href: string;
  roles: SessionRole[];
  moduleKeys?: string[];
  moduleMatch?: ModuleMatchMode;
  /** Mobil pastki navda ustuvor tartib (kichik = chaproq) */
  mobileNav?: boolean;
  mobileNavPriority?: number;
};

export type DashboardMenuGroup = {
  id: string;
  title: string;
  items: DashboardMenuItem[];
};

/** Guruhlangan sidebar — URL lar o‘zgarmaydi */
export function buildDashboardMenuGroups(
  icons: DashboardMenuIcons,
): DashboardMenuGroup[] {
  const I = icons;
  const s = 20;

  return [
    {
      id: 'general',
      title: GROUP.general,
      items: [
        {
          icon: <I.LayoutDashboard size={s} />,
          label: SECTION.dashboard,
          href: '/dashboard',
          roles: ['owner', 'manager', 'accountant', 'warehouse', 'sales'],
          mobileNav: true,
          mobileNavPriority: 1,
        },
      ],
    },
    {
      id: 'pos',
      title: GROUP.pos,
      items: [
        {
          icon: <I.CreditCard size={s} />,
          label: SECTION.posKassa,
          href: '/pos',
          roles: ['owner', 'manager', 'sales'],
          moduleKeys: ['POS'],
        },
        {
          icon: <I.History size={s} />,
          label: SECTION.posCenter,
          href: '/dashboard/pos',
          roles: ['owner', 'manager', 'accountant', 'sales'],
          moduleKeys: ['POS'],
        },
      ],
    },
    {
      id: 'warehouse',
      title: GROUP.warehouse,
      items: [
        {
          icon: <I.Box size={s} />,
          label: SECTION.inventory,
          href: '/dashboard/inventory',
          roles: ['owner', 'manager', 'warehouse', 'accountant', 'sales'],
          moduleKeys: ['WAREHOUSE_BASIC'],
          mobileNav: true,
          mobileNavPriority: 3,
        },
        {
          icon: <I.PackagePlus size={s} />,
          label: SECTION.warehouseIntake,
          href: '/dashboard/warehouse-intake',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['WAREHOUSE_INTAKE'],
          mobileNav: true,
          mobileNavPriority: 2,
        },
        {
          icon: <I.Settings size={s} />,
          label: SECTION.warehouseIntakeSettings,
          href: '/dashboard/warehouse-intake/settings',
          roles: ['owner', 'manager'],
          moduleKeys: ['WAREHOUSE_INTAKE'],
        },
        {
          icon: <I.History size={s} />,
          label: SECTION.warehouseHistory,
          href: '/dashboard/warehouse?tab=history',
          roles: ['owner', 'manager', 'warehouse', 'accountant'],
          moduleKeys: ['WAREHOUSE_BASIC'],
        },
        {
          icon: <I.History size={s} />,
          label: SECTION.activity,
          href: '/dashboard/activity',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['WAREHOUSE_BASIC', 'B2B', 'DEBT'],
          moduleMatch: 'any',
        },
        {
          icon: <I.Truck size={s} />,
          label: SECTION.picking,
          href: '/dashboard/picking',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['WAREHOUSE_PICKING'],
        },
        {
          icon: <I.History size={s} />,
          label: 'Zaxira holati (ATP)',
          href: '/dashboard/warehouse',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['WAREHOUSE_ATP'],
        },
        {
          icon: <I.Box size={s} />,
          label: SECTION.inventoryCount,
          href: '/dashboard/inventory-count',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['WAREHOUSE_INVENTORY_COUNT'],
        },
      ],
    },
    {
      id: 'b2b',
      title: GROUP.b2b,
      items: [
        {
          icon: <I.Handshake size={s} />,
          label: SECTION.partners,
          href: '/dashboard/partners',
          roles: ['owner', 'manager', 'sales'],
          moduleKeys: ['PARTNERS'],
        },
        {
          icon: <I.GitBranch size={s} />,
          label: SECTION.productMapping,
          href: '/dashboard/product-mappings',
          roles: ['owner', 'manager'],
          moduleKeys: ['PRODUCT_MAPPING'],
        },
        {
          icon: <I.ShoppingBag size={s} />,
          label: SECTION.orders,
          href: '/dashboard/orders',
          roles: ['owner', 'manager', 'sales'],
          moduleKeys: ['B2B'],
          mobileNav: true,
          mobileNavPriority: 5,
        },
        {
          icon: <I.Truck size={s} />,
          label: SECTION.receipts,
          href: '/dashboard/receipts',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['GOODS_RECEIPTS'],
          mobileNav: true,
          mobileNavPriority: 3,
        },
      ],
    },
    {
      id: 'finance',
      title: GROUP.finance,
      items: [
        {
          icon: <I.Wallet size={s} />,
          label: SECTION.debts,
          href: '/dashboard/debts',
          roles: ['owner', 'accountant', 'manager'],
          moduleKeys: ['DEBT'],
        },
        {
          icon: <I.Users size={s} />,
          label: SECTION.partnerLedger,
          href: '/dashboard/partner-ledger',
          roles: ['owner', 'accountant', 'manager'],
          moduleKeys: ['PARTNER_LEDGER'],
        },
        {
          icon: <I.Wallet2 size={s} />,
          label: SECTION.expenses,
          href: '/dashboard/expenses',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['EXPENSES'],
        },
        {
          icon: <I.TrendingUp size={s} />,
          label: SECTION.income,
          href: '/dashboard/income',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['INCOME'],
        },
        {
          icon: <I.Banknote size={s} />,
          label: SECTION.payroll,
          href: '/dashboard/payroll',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['PAYROLL'],
        },
      ],
    },
    {
      id: 'field',
      title: GROUP.field,
      items: [
        {
          icon: <I.Truck size={s} />,
          label: SECTION.field,
          href: '/dashboard/field',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['FIELD_SERVICE'],
        },
      ],
    },
    {
      id: 'reports',
      title: GROUP.reports,
      items: [
        {
          icon: <I.BarChart3 size={s} />,
          label: SECTION.reports,
          href: '/dashboard/reports',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['REPORTS'],
        },
        {
          icon: <I.TrendingUp size={s} />,
          label: SECTION.reportsMonthly,
          href: '/dashboard/reports/monthly',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['REPORTS'],
        },
      ],
    },
    {
      id: 'company',
      title: GROUP.company,
      items: [
        {
          icon: <I.Store size={s} />,
          label: SECTION.storefront,
          href: '/dashboard/storefront',
          roles: ['owner', 'manager'],
          moduleKeys: ['STOREFRONT'],
        },
        {
          icon: <I.Users size={s} />,
          label: SECTION.team,
          href: '/dashboard/settings/team',
          roles: ['owner', 'manager'],
          moduleKeys: ['EMPLOYEES'],
        },
        {
          icon: <I.Link2 size={s} />,
          label: SECTION.integrations,
          href: '/dashboard/integrations',
          roles: ['owner', 'manager'],
          moduleKeys: ['INTEGRATIONS'],
        },
      ],
    },
    {
      id: 'system',
      title: GROUP.system,
      items: [
        {
          icon: <I.Settings size={s} />,
          label: SECTION.settings,
          href: '/dashboard/settings',
          roles: ['owner'],
        },
        {
          icon: <HelpCircle size={s} className="text-blue-400" />,
          label: SECTION.help,
          href: '#support',
          roles: ['owner', 'manager', 'accountant', 'warehouse', 'sales'],
          mobileNav: true,
          mobileNavPriority: 4,
        },
      ],
    },
  ];
}

export function flattenMenuGroups(groups: DashboardMenuGroup[]): DashboardMenuItem[] {
  return groups.flatMap((g) => g.items);
}

/** Mobil pastki nav: markazda Asosiy, chapda tarix/hisobot, o‘ngda tez-tez ishlatiladiganlar */
const MOBILE_NAV_CENTER_HREF = '/dashboard';

/** Kamroq ishlatiladigan — Asosiyning chap tomoni */
const MOBILE_NAV_LEFT_ORDER = [
  '/dashboard/reports',
  '/dashboard/reports/monthly',
  '/dashboard/warehouse?tab=history',
  '/dashboard/activity',
  '/dashboard/debts',
  '/dashboard/partner-ledger',
  '/dashboard/expenses',
  '/dashboard/income',
  '/dashboard/payroll',
  '/dashboard/field',
  '/dashboard/product-mappings',
  '/dashboard/pos',
  '/dashboard/picking',
  '/dashboard/inventory-count',
  '/dashboard/warehouse',
  '/dashboard/storefront',
  '/dashboard/settings/team',
  '/dashboard/integrations',
  '/dashboard/settings',
  '/dashboard/platform-admin',
] as const;

/** Tez-tez ishlatiladigan — Asosiyning o‘ng tomoni */
const MOBILE_NAV_RIGHT_ORDER = [
  '/pos',
  '/dashboard/warehouse-intake',
  '/dashboard/inventory',
  '/dashboard/receipts',
  '/dashboard/orders',
  '/dashboard/partners',
  '#support',
] as const;

const MOBILE_NAV_RIGHT_WAREHOUSE: readonly string[] = [
  '/dashboard/warehouse-intake',
  '/dashboard/receipts',
  '/dashboard/inventory',
  '#support',
];

function pickNavItemsByOrder(
  items: DashboardMenuItem[],
  order: readonly string[],
): DashboardMenuItem[] {
  const byHref = new Map(items.map((item) => [item.href, item]));
  return order
    .map((href) => byHref.get(href))
    .filter((item): item is DashboardMenuItem => Boolean(item));
}

export function orderMobileBottomNavItems(
  items: DashboardMenuItem[],
  role?: SessionRole,
): DashboardMenuItem[] {
  const byHref = new Map(items.map((item) => [item.href, item]));
  const center = byHref.get(MOBILE_NAV_CENTER_HREF);

  const rightOrder =
    role === 'warehouse' ? MOBILE_NAV_RIGHT_WAREHOUSE : MOBILE_NAV_RIGHT_ORDER;

  const left = pickNavItemsByOrder(items, MOBILE_NAV_LEFT_ORDER);
  const right = pickNavItemsByOrder(items, rightOrder);

  const placed = new Set<string>([
    ...left.map((item) => item.href),
    ...right.map((item) => item.href),
    MOBILE_NAV_CENTER_HREF,
  ]);

  const remainder = items.filter((item) => !placed.has(item.href));

  return [
    ...left,
    ...remainder,
    ...(center ? [center] : []),
    ...right.filter((item) => item.href !== MOBILE_NAV_CENTER_HREF),
  ];
}

export function isMenuItemActive(
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
  if (!queryString) return true;

  const expected = new URLSearchParams(queryString);
  const actual = new URLSearchParams(search.replace(/^\?/, ''));
  let matches = true;
  expected.forEach((value, key) => {
    if (actual.get(key) !== value) matches = false;
  });
  return matches;
}

/** Rol bo‘yicha yo‘l: menyuda yo‘q bo‘limlarga to‘g‘ridan-to‘g‘ri URL ochilmasin */
export function isDashboardPathAllowedForRole(
  pathname: string,
  role: SessionRole,
  items: Pick<DashboardMenuItem, 'href' | 'roles'>[],
): boolean {
  const relevant = items.filter((item) => {
    if (item.href === '#support') return false;
    if (item.href === '/dashboard') return pathname === '/dashboard';
    if (item.href === '/pos') return pathname === '/pos' || pathname.startsWith('/pos/');
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  if (!relevant.length) return true;
  return relevant.some((item) => item.roles.includes(role));
}
