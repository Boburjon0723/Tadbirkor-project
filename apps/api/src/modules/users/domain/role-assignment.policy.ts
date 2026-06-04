/**
 * Rol → ombor (do'kon nuqtasi) scope siyosati.
 */

export type AssignableRole =
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'WAREHOUSE'
  | 'SALES'
  | 'FIELD_WORKER'
  | 'WORKER';

export const ROLES_REQUIRING_WAREHOUSE: ReadonlyArray<AssignableRole> = [
  'SALES',
  'WAREHOUSE',
  'FIELD_WORKER',
];

export const ROLES_WITHOUT_WAREHOUSE: ReadonlyArray<AssignableRole> = [
  'OWNER',
  'MANAGER',
  'ACCOUNTANT',
  'WORKER',
];

export function roleRequiresWarehouse(role: string): boolean {
  return ROLES_REQUIRING_WAREHOUSE.includes(role.toUpperCase() as AssignableRole);
}

export function roleAllowsAllWarehouses(role: string): boolean {
  return ROLES_WITHOUT_WAREHOUSE.includes(role.toUpperCase() as AssignableRole);
}
