import {
  permissionsForRole,
  type SystemRole,
} from '@/lib/roles';

/** API bilan mos keladigan kalitlar */
export const POS_PERMISSION_KEYS = {
  changePrice: 'pos.change_price',
  overridePrice: 'pos.override_price',
  credit: 'pos.credit',
} as const;

export type PosPermissionKey =
  (typeof POS_PERMISSION_KEYS)[keyof typeof POS_PERMISSION_KEYS];

export const POS_PERMISSION_TOGGLES: {
  key: PosPermissionKey;
  label: string;
  hint: string;
}[] = [
  {
    key: POS_PERMISSION_KEYS.changePrice,
    label: 'Narxni o‘zgartirish (chegirma limiti)',
    hint: 'Ro‘yxat narxidan past sotish — kompaniya % limiti ichida',
  },
  {
    key: POS_PERMISSION_KEYS.overridePrice,
    label: 'Limitdan tashqari narx',
    hint: 'Menejer: chegirma limitidan yuqori narx berish',
  },
  {
    key: POS_PERMISSION_KEYS.credit,
    label: 'Nasiya (qarz) sotuv',
    hint: 'Kassada nasiya va mijoz qarziga to‘lov qabul qilish',
  },
];

export function roleDefaultHasPosPermission(
  role: string,
  permission: string,
): boolean {
  return permissionsForRole(role as SystemRole).includes(permission);
}

/** Checkbox holatidan grant/deny massivlari */
export function buildPosGrantDeny(
  role: string,
  checked: Record<string, boolean>,
): { grantPermissions: string[]; denyPermissions: string[] } {
  const grantPermissions: string[] = [];
  const denyPermissions: string[] = [];
  for (const { key } of POS_PERMISSION_TOGGLES) {
    const inRole = roleDefaultHasPosPermission(role, key);
    const on = !!checked[key];
    if (on && !inRole) grantPermissions.push(key);
    if (!on && inRole) denyPermissions.push(key);
  }
  return { grantPermissions, denyPermissions };
}

export function posTogglesFromMember(
  role: string,
  grantPermissions: string[] = [],
  denyPermissions: string[] = [],
): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const { key } of POS_PERMISSION_TOGGLES) {
    const inRole = roleDefaultHasPosPermission(role, key);
    const granted = grantPermissions.includes(key);
    const denied = denyPermissions.includes(key);
    state[key] = denied ? false : inRole || granted;
  }
  return state;
}

/** Rol uchun boshlang‘ich checkbox (yangi xodim) */
export function defaultPosTogglesForRole(role: string): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const { key } of POS_PERMISSION_TOGGLES) {
    state[key] = roleDefaultHasPosPermission(role, key);
  }
  return state;
}
