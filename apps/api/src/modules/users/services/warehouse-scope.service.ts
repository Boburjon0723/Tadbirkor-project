import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { roleAllowsAllWarehouses } from '../domain/role-assignment.policy';

/**
 * Foydalanuvchining ombor scope'ini hisoblaydi.
 *
 * `all: true` — barcha omborlarga ruxsat (OWNER/MANAGER/ACCOUNTANT)
 * `all: false` — faqat `warehouseIds` ichida sanab o'tilgan omborlar (SALES/WAREHOUSE)
 *
 * Hozircha bir foydalanuvchi bitta omborga bog'lanadi, lekin natija interfeysi
 * `warehouseIds: string[]` bo'lib, kelajakda M2M scope bilan kengayishga tayyor.
 */

export interface WarehouseScope {
  all: boolean;
  warehouseIds: string[];
  defaultWarehouseId: string | null;
  role: string;
}

@Injectable()
export class WarehouseScopeService {
  constructor(private prisma: PrismaService) {}

  async getForUser(companyId: string, userId: string): Promise<WarehouseScope> {
    const membership = await this.prisma.companyUser.findFirst({
      where: { companyId, userId },
      select: { role: true, warehouseId: true },
    });

    const role = membership?.role || 'OWNER';

    if (roleAllowsAllWarehouses(role)) {
      return {
        all: true,
        warehouseIds: [],
        defaultWarehouseId: membership?.warehouseId || null,
        role,
      };
    }

    const warehouseId = membership?.warehouseId || null;
    return {
      all: false,
      warehouseIds: warehouseId ? [warehouseId] : [],
      defaultWarehouseId: warehouseId,
      role,
    };
  }

  /**
   * Berilgan warehouseId foydalanuvchining scope'iga to'g'ri kelishini tekshiradi.
   * `all: true` bo'lsa hamma narsani ruxsat etadi; aks holda warehouseId scope ichida bo'lishi kerak.
   */
  isAllowed(scope: WarehouseScope, warehouseId: string): boolean {
    if (scope.all) return true;
    return scope.warehouseIds.includes(warehouseId);
  }
}
