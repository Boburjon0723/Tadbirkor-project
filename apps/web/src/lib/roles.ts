export type SystemRole =
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'WAREHOUSE'
  | 'SALES'
  | 'FIELD_WORKER'
  | 'WORKER';

export const ROLE_LABELS: Record<SystemRole, string> = {
  OWNER: 'Egasi',
  MANAGER: 'Menejer',
  ACCOUNTANT: 'Buxgalter',
  WAREHOUSE: 'Omborchi',
  SALES: 'Sotuvchi',
  FIELD_WORKER: 'Dala xodimi',
  WORKER: 'Oddiy ishchi',
};

export const ASSIGNABLE_ROLES = [
  { value: 'MANAGER' as const, label: 'Menejer' },
  { value: 'ACCOUNTANT' as const, label: 'Buxgalter' },
  { value: 'WAREHOUSE' as const, label: 'Omborchi' },
  { value: 'SALES' as const, label: 'Sotuvchi' },
  { value: 'FIELD_WORKER' as const, label: 'Dala xodimi' },
  { value: 'WORKER' as const, label: 'Oddiy ishchi' },
];

export const ROLES_REQUIRING_WAREHOUSE: SystemRole[] = ['SALES', 'WAREHOUSE', 'FIELD_WORKER'];

export function roleRequiresWarehouse(role: string): boolean {
  return ROLES_REQUIRING_WAREHOUSE.includes(role.toUpperCase() as SystemRole);
}

/** Rol bo‘yicha default ruxsatlar (API ROLE_PERMISSIONS bilan sinxron) */
export function permissionsForRole(role: string): string[] {
  const upper = role.toUpperCase() as SystemRole;
  const MAP: Record<SystemRole, string[]> = {
    OWNER: [],
    MANAGER: [
      'pos.view',
      'pos.create',
      'pos.void',
      'pos.change_price',
      'pos.override_price',
      'pos.credit',
    ],
    ACCOUNTANT: ['pos.view'],
    WAREHOUSE: [],
    SALES: ['pos.view', 'pos.create'],
    FIELD_WORKER: [],
    WORKER: [],
  };
  if (upper === 'OWNER') {
    return Object.values(MAP).flat();
  }
  return MAP[upper] ?? [];
}

export const PERMISSION_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Mahsulotlar',
    keys: ['products.view', 'products.create', 'products.update', 'products.delete'],
  },
  {
    title: 'Ombor',
    keys: [
      'warehouse.view',
      'warehouse.receive',
      'warehouse.dispatch',
      'warehouse.adjust',
      'warehouse.manage',
    ],
  },
  {
    title: 'B2B va hamkorlar',
    keys: [
      'partners.view',
      'partners.manage',
      'orders.view',
      'orders.create',
      'product_mappings.view',
    ],
  },
  {
    title: 'Moliya',
    keys: ['debt.view', 'debt.confirm_payment', 'reports.view', 'reports.export'],
  },
  {
    title: 'Kassa (POS)',
    keys: [
      'pos.view',
      'pos.create',
      'pos.void',
      'pos.change_price',
      'pos.override_price',
      'pos.credit',
    ],
  },
  {
    title: 'Dala xizmati',
    keys: [
      'field.task.view_own',
      'field.task.create',
      'field.task.approve',
      'field.stock.view_all',
    ],
  },
  {
    title: 'Jamoa',
    keys: ['users.manage', 'settings.manage'],
  },
];

export function formatPermissionKey(key: string): string {
  return key.replace(/\./g, ' · ');
}
