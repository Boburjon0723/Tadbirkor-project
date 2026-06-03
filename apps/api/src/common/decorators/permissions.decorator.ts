import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/role.enum';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_ANY_KEY = 'permissions_any';

/** Barcha ko‘rsatilgan ruxsatlar kerak (AND). */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Kamida bitta ruxsat yetarli (OR) — dashboard analitika kabi. */
export const PermissionsAny = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
