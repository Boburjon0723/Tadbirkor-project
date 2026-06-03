import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_ANY_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../enums/role.enum';
import { effectivePermissions } from '../role-permissions';
import { PrismaService } from '../../prisma/prisma.service';

type CachedMembership = {
  permissions: Permission[];
  expiresAt: number;
};

/** Har API so'rovda DB ga urmaslik — P2028 / pool to'lib qolishini kamaytiradi */
const MEMBERSHIP_CACHE_TTL_MS = 60_000;

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly membershipCache = new Map<string, CachedMembership>();

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  private cacheKey(userId: string, companyId: string) {
    return `${userId}:${companyId}`;
  }

  private async resolvePermissions(
    userId: string,
    companyId: string,
  ): Promise<Permission[]> {
    const key = this.cacheKey(userId, companyId);
    const now = Date.now();
    const cached = this.membershipCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.permissions;
    }

    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId, companyId },
      select: {
        role: true,
        grantPermissions: true,
        denyPermissions: true,
      },
    });

    if (!companyUser) {
      throw new ForbiddenException('Ushbu kompaniyaga kirish ruxsati yo‘q');
    }

    const permissions = effectivePermissions(
      companyUser.role,
      companyUser.grantPermissions,
      companyUser.denyPermissions,
    ) as Permission[];

    this.membershipCache.set(key, {
      permissions,
      expiresAt: now + MEMBERSHIP_CACHE_TTL_MS,
    });

    return permissions;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAll = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredAll?.length && !requiredAny?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user?.sub || !user.companyId) {
      throw new ForbiddenException('Kompaniya ma’lumotlari topilmadi');
    }

    const userPermissions = await this.resolvePermissions(
      user.sub,
      user.companyId,
    );

    const hasAll =
      !requiredAll?.length ||
      requiredAll.every((permission) => userPermissions.includes(permission));
    const hasAny =
      !requiredAny?.length ||
      requiredAny.some((permission) => userPermissions.includes(permission));

    if (!hasAll || !hasAny) {
      throw new ForbiddenException(
        'Sizda ushbu amalni bajarish uchun yetarli ruxsatlar yo‘q',
      );
    }

    return true;
  }
}
