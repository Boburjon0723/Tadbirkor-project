import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import type { ModuleMatchMode } from '@/lib/feature-modules';
import type { SessionRole } from '@/hooks/use-session';

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
};

export type DashboardMenuItem = {
  icon: ReactNode;
  label: string;
  href: string;
  roles: SessionRole[];
  moduleKeys?: string[];
  moduleMatch?: ModuleMatchMode;
  /** Mobil pastki navigatsiyada ko‘rsatish */
  mobileNav?: boolean;
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
      title: 'Umumiy',
      items: [
        {
          icon: <I.LayoutDashboard size={s} />,
          label: 'Asosiy',
          href: '/dashboard',
          roles: ['owner', 'manager', 'accountant', 'warehouse', 'sales'],
          mobileNav: true,
        },
      ],
    },
    {
      id: 'pos',
      title: 'Chakana (POS)',
      items: [
        {
          icon: <I.CreditCard size={s} />,
          label: 'POS / Kassa',
          href: '/pos',
          roles: ['owner', 'manager', 'sales'],
          moduleKeys: ['POS'],
        },
        {
          icon: <I.History size={s} />,
          label: 'POS markazi',
          href: '/dashboard/pos',
          roles: ['owner', 'manager', 'accountant', 'sales'],
          moduleKeys: ['POS'],
        },
      ],
    },
    {
      id: 'warehouse',
      title: 'Ombor',
      items: [
        {
          icon: <I.Box size={s} />,
          label: 'Mahsulotlar va qoldiq',
          href: '/dashboard/inventory',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['WAREHOUSE_BASIC'],
          mobileNav: true,
        },
        {
          icon: <I.History size={s} />,
          label: 'Harakatlar tarixi',
          href: '/dashboard/activity',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['WAREHOUSE_BASIC', 'B2B', 'DEBT'],
          moduleMatch: 'any',
        },
        {
          icon: <I.Truck size={s} />,
          label: 'Saralash (picking)',
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
          label: 'Inventarizatsiya',
          href: '/dashboard/inventory-count',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['WAREHOUSE_INVENTORY_COUNT'],
        },
      ],
    },
    {
      id: 'b2b',
      title: 'B2B savdo',
      items: [
        {
          icon: <I.Handshake size={s} />,
          label: 'Hamkorlar',
          href: '/dashboard/partners',
          roles: ['owner', 'manager', 'sales'],
          moduleKeys: ['PARTNERS'],
        },
        {
          icon: <I.GitBranch size={s} />,
          label: 'Mahsulot mapping',
          href: '/dashboard/product-mappings',
          roles: ['owner', 'manager'],
          moduleKeys: ['PRODUCT_MAPPING'],
        },
        {
          icon: <I.ShoppingBag size={s} />,
          label: 'Buyurtmalar',
          href: '/dashboard/orders',
          roles: ['owner', 'manager', 'sales'],
          moduleKeys: ['B2B'],
          mobileNav: true,
        },
        {
          icon: <I.Truck size={s} />,
          label: 'Kelgan yuklar',
          href: '/dashboard/receipts',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['WAREHOUSE_BASIC', 'B2B'],
          moduleMatch: 'any',
        },
      ],
    },
    {
      id: 'finance',
      title: 'Moliya (B2B)',
      items: [
        {
          icon: <I.Wallet size={s} />,
          label: 'Qarz daftari',
          href: '/dashboard/debts',
          roles: ['owner', 'accountant', 'manager'],
          moduleKeys: ['DEBT'],
        },
        {
          icon: <I.Users size={s} />,
          label: 'Hamkor daftari',
          href: '/dashboard/partner-ledger',
          roles: ['owner', 'accountant', 'manager'],
          moduleKeys: ['PARTNER_LEDGER'],
        },
        {
          icon: <I.Wallet2 size={s} />,
          label: 'Xarajatlar',
          href: '/dashboard/expenses',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['EXPENSES'],
        },
        {
          icon: <I.TrendingUp size={s} />,
          label: 'Kirimlar',
          href: '/dashboard/income',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['INCOME'],
        },
        {
          icon: <I.Banknote size={s} />,
          label: 'Xodimlar (oylik)',
          href: '/dashboard/payroll',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['PAYROLL'],
        },
      ],
    },
    {
      id: 'field',
      title: 'Dala xizmati',
      items: [
        {
          icon: <I.Truck size={s} />,
          label: 'Dala xodimlari',
          href: '/dashboard/field',
          roles: ['owner', 'manager', 'warehouse'],
          moduleKeys: ['FIELD_SERVICE'],
        },
      ],
    },
    {
      id: 'reports',
      title: 'Hisobot',
      items: [
        {
          icon: <I.BarChart3 size={s} />,
          label: 'Umumiy hisobotlar',
          href: '/dashboard/reports',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['REPORTS'],
        },
        {
          icon: <I.TrendingUp size={s} />,
          label: 'Oy moliyasi',
          href: '/dashboard/reports/monthly',
          roles: ['owner', 'manager', 'accountant'],
          moduleKeys: ['REPORTS'],
        },
      ],
    },
    {
      id: 'company',
      title: 'Kompaniya',
      items: [
        {
          icon: <I.Store size={s} />,
          label: 'Onlayn do‘kon',
          href: '/dashboard/storefront',
          roles: ['owner', 'manager'],
          moduleKeys: ['STOREFRONT'],
        },
        {
          icon: <I.Users size={s} />,
          label: 'Xodimlar',
          href: '/dashboard/settings/team',
          roles: ['owner', 'manager'],
          moduleKeys: ['EMPLOYEES'],
        },
        {
          icon: <I.Link2 size={s} />,
          label: 'Ulanishlar',
          href: '/dashboard/integrations',
          roles: ['owner', 'manager'],
          moduleKeys: ['INTEGRATIONS'],
        },
      ],
    },
    {
      id: 'system',
      title: 'Tizim',
      items: [
        {
          icon: <I.Settings size={s} />,
          label: 'Sozlamalar',
          href: '/dashboard/settings',
          roles: ['owner'],
        },
        {
          icon: <HelpCircle size={s} className="text-blue-400" />,
          label: 'Yordam',
          href: '#support',
          roles: ['owner', 'manager', 'accountant', 'warehouse', 'sales'],
          mobileNav: true,
        },
      ],
    },
  ];
}

export function flattenMenuGroups(groups: DashboardMenuGroup[]): DashboardMenuItem[] {
  return groups.flatMap((g) => g.items);
}

export function isMenuItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/pos') return pathname === '/pos' || pathname.startsWith('/pos/');
  return pathname === href || pathname.startsWith(`${href}/`);
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
