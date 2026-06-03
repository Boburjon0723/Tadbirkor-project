import { Permission } from './enums/role.enum';

export type SystemRole =
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'WAREHOUSE'
  | 'SALES'
  | 'FIELD_WORKER';

export interface RoleCatalogEntry {
  key: SystemRole;
  label: string;
  description: string;
  assignable: boolean;
  requiresWarehouse: boolean;
}

export const ROLE_CATALOG: RoleCatalogEntry[] = [
  {
    key: 'OWNER',
    label: 'Egasi',
    description: 'Barcha modullar, sozlamalar va xodimlarni boshqaradi.',
    assignable: false,
    requiresWarehouse: false,
  },
  {
    key: 'MANAGER',
    label: 'Menejer',
    description: 'Mahsulot, buyurtma, hamkor va operatsion jarayonlar.',
    assignable: true,
    requiresWarehouse: false,
  },
  {
    key: 'ACCOUNTANT',
    label: 'Buxgalter',
    description: 'Qarz, hisobotlar va moliyaviy ko‘rinishlar.',
    assignable: true,
    requiresWarehouse: false,
  },
  {
    key: 'WAREHOUSE',
    label: 'Omborchi',
    description: 'Biriktirilgan omborda kirim, chiqim va qabul qilish.',
    assignable: true,
    requiresWarehouse: true,
  },
  {
    key: 'SALES',
    label: 'Sotuvchi',
    description: 'Buyurtma, kassa va biriktirilgan do‘kon nuqtasi.',
    assignable: true,
    requiresWarehouse: true,
  },
  {
    key: 'FIELD_WORKER',
    label: 'Dala xodimi',
    description: 'Tashqarida montaj/kuryer: vazifa, tovar qabul va hisobot.',
    assignable: true,
    requiresWarehouse: true,
  },
];

const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

const FIELD_MANAGER_PERMS: Permission[] = [
  Permission.FIELD_TASK_CREATE,
  Permission.FIELD_TASK_ASSIGN,
  Permission.FIELD_TASK_APPROVE,
  Permission.FIELD_TASK_VIEW_ALL,
  Permission.FIELD_STOCK_VIEW_ALL,
];

export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  MANAGER: [
    Permission.PRODUCTS_VIEW,
    Permission.PRODUCTS_CREATE,
    Permission.PRODUCTS_UPDATE,
    Permission.WAREHOUSE_VIEW,
    Permission.WAREHOUSE_RECEIVE,
    Permission.WAREHOUSE_DISPATCH,
    Permission.PARTNERS_VIEW,
    Permission.PARTNERS_MANAGE,
    Permission.PRODUCT_MAPPINGS_VIEW,
    Permission.PRODUCT_MAPPINGS_MANAGE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_SEND,
    Permission.ORDERS_ACCEPT,
    Permission.DISPATCHES_VIEW,
    Permission.DISPATCHES_CREATE,
    Permission.DISPATCHES_SEND,
    Permission.GOODS_RECEIPTS_VIEW,
    Permission.GOODS_RECEIPTS_ACCEPT,
    Permission.DEBT_VIEW,
    Permission.EXPENSES_VIEW,
    Permission.EXPENSES_CREATE,
    Permission.EXPENSES_MANAGE,
    Permission.EXPENSES_APPROVE,
    Permission.EXPENSES_REJECT,
    Permission.PARTNER_LEDGER_VIEW,
    Permission.PARTNER_LEDGER_MANAGE,
    Permission.REPORTS_VIEW,
    Permission.TASKS_VIEW,
    Permission.TASKS_MANAGE,
    Permission.TASKS_ASSIGN,
    Permission.POS_VIEW,
    Permission.POS_CREATE,
    Permission.POS_VOID,
    Permission.POS_CHANGE_PRICE,
    Permission.POS_OVERRIDE_PRICE,
    Permission.POS_CREDIT,
    Permission.USERS_MANAGE,
    ...FIELD_MANAGER_PERMS,
  ],
  WAREHOUSE: [
    Permission.PRODUCTS_VIEW,
    Permission.WAREHOUSE_VIEW,
    Permission.WAREHOUSE_RECEIVE,
    Permission.WAREHOUSE_DISPATCH,
    Permission.GOODS_RECEIPTS_VIEW,
    Permission.GOODS_RECEIPTS_ACCEPT,
    Permission.TASKS_VIEW,
    Permission.FIELD_TASK_CREATE,
    Permission.FIELD_TASK_ASSIGN,
    Permission.FIELD_TASK_VIEW_ALL,
    Permission.FIELD_STOCK_VIEW_ALL,
  ],
  ACCOUNTANT: [
    Permission.PRODUCTS_VIEW,
    Permission.DEBT_VIEW,
    Permission.DEBT_CONFIRM_PAYMENT,
    Permission.EXPENSES_VIEW,
    Permission.EXPENSES_CREATE,
    Permission.EXPENSES_APPROVE,
    Permission.EXPENSES_REJECT,
    Permission.PARTNER_LEDGER_VIEW,
    Permission.PARTNER_LEDGER_MANAGE,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
    Permission.TASKS_VIEW,
    Permission.POS_VIEW,
  ],
  SALES: [
    Permission.PRODUCTS_VIEW,
    Permission.WAREHOUSE_VIEW,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_CREATE,
    Permission.TASKS_VIEW,
    Permission.POS_VIEW,
    Permission.POS_CREATE,
  ],
  FIELD_WORKER: [
    Permission.FIELD_TASK_VIEW_OWN,
    Permission.FIELD_TASK_ACCEPT,
    Permission.FIELD_TASK_REPORT,
    Permission.FIELD_STOCK_VIEW_OWN,
    Permission.PRODUCTS_VIEW,
    Permission.WAREHOUSE_VIEW,
  ],
};

export function permissionsForRole(role: string): Permission[] {
  const upper = role.toUpperCase() as SystemRole;
  return ROLE_PERMISSIONS[upper] ?? [];
}

/** Jamoa sahifasida sozlanadigan POS qo‘shimcha ruxsatlar. */
export const POS_ASSIGNABLE_PERMISSIONS: Permission[] = [
  Permission.POS_CHANGE_PRICE,
  Permission.POS_OVERRIDE_PRICE,
  Permission.POS_CREDIT,
];

/** Faqat jamoa UI orqali beriladigan POS grant/deny kalitlari. */
export function sanitizePosPermissionOverrides(
  grantPermissions?: string[] | null,
  denyPermissions?: string[] | null,
): { grantPermissions: string[]; denyPermissions: string[] } {
  const allowed = new Set(POS_ASSIGNABLE_PERMISSIONS.map(String));
  return {
    grantPermissions: (grantPermissions || []).filter((p) => allowed.has(p)),
    denyPermissions: (denyPermissions || []).filter((p) => allowed.has(p)),
  };
}

export function effectivePermissions(
  role: string,
  grantPermissions?: string[] | null,
  denyPermissions?: string[] | null,
): Permission[] {
  const base = new Set(permissionsForRole(role).map(String));
  for (const p of denyPermissions || []) {
    base.delete(p);
  }
  for (const p of grantPermissions || []) {
    if ((ALL_PERMISSIONS as string[]).includes(p)) {
      base.add(p);
    }
  }
  return Array.from(base) as Permission[];
}

export function roleHasPermission(role: string, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}
