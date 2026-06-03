import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeUzPhone, phonesEquivalent } from '../../common/phone.util';
import {
  ROLES_REQUIRING_WAREHOUSE,
  roleRequiresWarehouse,
} from './domain/role-assignment.policy';
import {
  ROLE_CATALOG,
  permissionsForRole,
  sanitizePosPermissionOverrides,
} from '../../common/role-permissions';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByLogin(login: string) {
    return this.prisma.user.findUnique({
      where: { login },
      include: { companies: { include: { company: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { companies: { include: { company: true } } },
    });
  }

  async findByCompany(companyId: string) {
    return this.prisma.companyUser.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            login: true,
            email: true,
            phone: true,
            telegramChatId: true,
            telegramLinkedAt: true,
          },
        },
        warehouse: {
          select: { id: true, name: true, status: true },
        },
      },
    });
  }

  private async setPasswordHash(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true },
    });
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException('Joriy parol noto\'g\'ri');
    }

    return this.setPasswordHash(userId, newPassword);
  }

  private static readonly ASSIGNABLE_ROLES = [
    'MANAGER',
    'ACCOUNTANT',
    'WAREHOUSE',
    'SALES',
    'FIELD_WORKER',
  ] as const;

  /**
   * Berilgan warehouseId tegishli kompaniyaga, mavjud va ARCHIVED bo'lmagan
   * omborga tegishli ekanligini tekshiradi. Aks holda BadRequestException.
   */
  async assertWarehouseBelongsToCompany(companyId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId },
      select: { id: true, status: true },
    });
    if (!warehouse) {
      throw new BadRequestException("Bunday ombor topilmadi yoki bu kompaniyaga tegishli emas");
    }
    if (warehouse.status === 'ARCHIVED') {
      throw new BadRequestException("Bu ombor arxivlangan, biriktirib bo'lmaydi");
    }
  }

  /**
   * Rol va warehouseId mosligini tekshiradi (domain qoidasi).
   * SALES/WAREHOUSE uchun warehouseId majburiy; boshqalari uchun null bo'ladi.
   */
  resolveWarehouseIdForRole(role: string, warehouseId: string | null | undefined): string | null {
    const upper = role.toUpperCase();
    if (roleRequiresWarehouse(upper)) {
      if (!warehouseId) {
        throw new BadRequestException(
          `${upper} roli uchun ombor (do'kon) tanlanishi shart. Mavjud rollar majburiy ombor talab qiladi: ${ROLES_REQUIRING_WAREHOUSE.join(', ')}`,
        );
      }
      return warehouseId;
    }
    // OWNER/MANAGER/ACCOUNTANT — scope yo'q, warehouseId saqlanmaydi
    return null;
  }

  async updateMemberRole(
    companyId: string,
    membershipId: string,
    role: string,
    warehouseId?: string | null,
    grantPermissions?: string[],
    denyPermissions?: string[],
  ) {
    const upper = role.toUpperCase();
    if (!UsersService.ASSIGNABLE_ROLES.includes(upper as any)) {
      throw new BadRequestException(
        "Rol noto'g'ri: faqat MANAGER, ACCOUNTANT, WAREHOUSE, SALES yoki FIELD_WORKER tanlanadi",
      );
    }

    const membership = await this.prisma.companyUser.findFirst({
      where: { id: membershipId, companyId },
      include: { user: { select: { fullName: true, login: true } } },
    });

    if (!membership) {
      throw new NotFoundException("Kompaniya a'zosi topilmadi");
    }

    if (membership.role === 'OWNER') {
      throw new BadRequestException("Egasi (OWNER) rolini bu yerda o'zgartirib bo'lmaydi");
    }

    const resolvedWarehouseId = this.resolveWarehouseIdForRole(upper, warehouseId);
    if (resolvedWarehouseId) {
      await this.assertWarehouseBelongsToCompany(companyId, resolvedWarehouseId);
    }

    const posOverrides =
      grantPermissions !== undefined || denyPermissions !== undefined
        ? sanitizePosPermissionOverrides(grantPermissions, denyPermissions)
        : null;

    return this.prisma.companyUser.update({
      where: { id: membershipId },
      data: {
        role: upper,
        warehouseId: resolvedWarehouseId,
        ...(posOverrides
          ? {
              grantPermissions: posOverrides.grantPermissions,
              denyPermissions: posOverrides.denyPermissions,
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            login: true,
            email: true,
            phone: true,
          },
        },
        warehouse: {
          select: { id: true, name: true, status: true },
        },
      },
    });
  }

  getRolesCatalog() {
    return ROLE_CATALOG.map((role) => ({
      ...role,
      permissions: permissionsForRole(role.key),
    }));
  }

  /** Telegram bot: telefon tasdiqlangandan keyin parolni yangilash */
  async resetPasswordByTelegram(userId: string, newPassword: string) {
    const trimmed = String(newPassword || '').trim();
    if (trimmed.length < 6) {
      throw new BadRequestException('Parol kamida 6 belgidan iborat bo‘lishi kerak');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    await this.setPasswordHash(userId, trimmed);
    return { success: true, login: user.login };
  }

  async resetMemberPassword(
    companyId: string,
    membershipId: string,
    newPassword: string,
  ) {
    const membership = await this.assertEditableMembership(companyId, membershipId);
    await this.setPasswordHash(membership.userId, newPassword);
    return { success: true };
  }

  private async assertEditableMembership(companyId: string, membershipId: string) {
    const membership = await this.prisma.companyUser.findFirst({
      where: { id: membershipId, companyId },
    });
    if (!membership) {
      throw new NotFoundException("Kompaniya a'zosi topilmadi");
    }
    if (membership.role === 'OWNER') {
      throw new BadRequestException('Egasi (OWNER) uchun bu amal mumkin emas');
    }
    return membership;
  }

  async updateMemberPhone(companyId: string, membershipId: string, phoneRaw: string) {
    const membership = await this.assertEditableMembership(companyId, membershipId);
    const phone = normalizeUzPhone(phoneRaw);
    if (!phone) {
      throw new BadRequestException('Telefon raqami noto‘g‘ri (masalan: +998901234567)');
    }

    const current = await this.prisma.user.findUnique({
      where: { id: membership.userId },
      select: { phone: true, telegramChatId: true },
    });
    if (!current) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    if (!phonesEquivalent(current.phone, phone)) {
      const taken = await this.prisma.user.findFirst({
        where: { phone, id: { not: membership.userId } },
        select: { id: true },
      });
      if (taken) {
        throw new BadRequestException('Bunday telefon raqami boshqa foydalanuvchida band');
      }
    }

    const phoneChanged = !phonesEquivalent(current.phone, phone);
    const hadTelegram = Boolean(current.telegramChatId);

    await this.prisma.user.update({
      where: { id: membership.userId },
      data: {
        phone,
        ...(phoneChanged
          ? { telegramChatId: null, telegramLinkedAt: null }
          : {}),
      },
    });

    return {
      success: true,
      phone,
      telegramUnlinked: phoneChanged && hadTelegram,
    };
  }

  async removeMemberFromCompany(
    companyId: string,
    membershipId: string,
    actorUserId: string,
  ) {
    const membership = await this.assertEditableMembership(companyId, membershipId);
    if (membership.userId === actorUserId) {
      throw new BadRequestException('O‘zingizni o‘chirib bo‘lmaydi');
    }

    const userId = membership.userId;

    await this.prisma.$transaction(async (tx) => {
      await tx.companyUser.delete({ where: { id: membershipId } });

      const remaining = await tx.companyUser.count({ where: { userId } });
      if (remaining === 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            status: 'inactive',
            telegramChatId: null,
            telegramLinkedAt: null,
          },
        });
      }
    });

    return { success: true };
  }
}
