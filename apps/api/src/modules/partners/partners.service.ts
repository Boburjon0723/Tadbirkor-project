import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PartnerRequestDto, PartnerWarehouseVisibilityDto } from './dto/partner.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DEFAULT_TX_OPTIONS } from '../../prisma/transaction-options';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService) {}

  private extractVisibleWarehouseIds(config: unknown, companyId: string): string[] | null {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
    const raw = (config as Record<string, unknown>)[companyId];
    if (!Array.isArray(raw)) return null;
    return raw.filter((v): v is string => typeof v === 'string' && !!v.trim());
  }

  async requestPartner(ownerCompanyId: string, dto: PartnerRequestDto, userId: string) {
    if (!dto.partnerCompanyId && !dto.partnerTin?.trim()) {
      throw new BadRequestException('Hamkor STIR yoki kompaniya ID si kerak');
    }

    // 1. Get partner company
    const partnerCompany = await this.prisma.company.findUnique({
      where: dto.partnerCompanyId ? { id: dto.partnerCompanyId } : { tin: dto.partnerTin }
    });

    if (!partnerCompany) throw new NotFoundException('Kompaniya topilmadi');
    
    if (partnerCompany.id === ownerCompanyId) {
      throw new BadRequestException('O‘zingizga hamkorlik so‘rovi yubora olmaysiz');
    }

    // 2. Check if already exists (any status)
    const existing = await this.prisma.partner.findFirst({
      where: {
        OR: [
          { ownerCompanyId, partnerCompanyId: partnerCompany.id },
          { ownerCompanyId: partnerCompany.id, partnerCompanyId: ownerCompanyId }
        ]
      }
    });

    if (existing) {
      if (existing.status === 'ACTIVE') throw new ConflictException('Ushbu kompaniya bilan allaqachon hamkorlik o‘rnatilgan');
      if (existing.status === 'PENDING') throw new ConflictException('Hamkorlik so‘rovi allaqachon yuborilgan');
      if (existing.status === 'BLOCKED') throw new ConflictException('Ushbu hamkor bloklangan');
      
      if (existing.status === 'REJECTED') {
        const updated = await this.prisma.$transaction(async (tx) => {
          const row = await tx.partner.update({
            where: { id: existing.id },
            data: { status: 'PENDING', ownerCompanyId, partnerCompanyId: partnerCompany.id, createdBy: userId }
          });

          await tx.auditLog.create({
            data: {
              userId,
              companyId: ownerCompanyId,
              action: 'partner.request_sent',
              entityType: 'PARTNER',
              entityId: row.id,
              newData: { partnerCompanyId: partnerCompany.id, isReRequest: true } as any
            }
          });

          return row;
        }, DEFAULT_TX_OPTIONS);

        await this.notifyPartnerRequestCreated(ownerCompanyId, partnerCompany.id, updated.id);
        return updated;
      }
    }

    // 3. Create partnership (PENDING)
    const { partner, ownerName } = await this.prisma.$transaction(async (tx) => {
      const row = await tx.partner.create({
        data: {
          ownerCompanyId,
          partnerCompanyId: partnerCompany.id,
          status: 'PENDING',
          createdBy: userId
        }
      });

      await tx.auditLog.create({
        data: {
          userId: userId,
          companyId: ownerCompanyId,
          action: 'partner.request_sent',
          entityType: 'PARTNER',
          entityId: row.id,
          newData: { partnerCompanyId: partnerCompany.id } as any
        }
      });

      const owner = await tx.company.findUnique({ where: { id: ownerCompanyId }, select: { name: true } });
      return { partner: row, ownerName: owner?.name || 'Kompaniya' };
    }, DEFAULT_TX_OPTIONS);

    await this.notificationsService.notifyCompany(
      partnerCompany.id,
      'Yangi hamkor so‘rovi',
      `${ownerName} hamkorlik so‘rovi yubordi.`,
      'INFO',
      {
        moduleKey: 'PARTNERS',
        eventKey: 'partner.request_created',
        details: {
          partnerRequestId: partner.id,
          fromCompany: ownerName,
          status: 'PENDING',
        },
        targetRoles: ['OWNER', 'MANAGER'],
        actions: [
          { key: 'PARTNER_ACCEPT', label: 'Qabul qilish', targetType: 'PARTNER', targetId: partner.id },
          { key: 'PARTNER_REJECT', label: 'Bekor qilish', targetType: 'PARTNER', targetId: partner.id },
        ],
      },
    );

    return partner;
  }

  private async notifyPartnerRequestCreated(
    ownerCompanyId: string,
    partnerCompanyId: string,
    partnerId: string,
  ) {
    const owner = await this.prisma.company.findUnique({
      where: { id: ownerCompanyId },
      select: { name: true },
    });
    await this.notificationsService.notifyCompany(
      partnerCompanyId,
      'Yangi hamkor so‘rovi',
      `${owner?.name || 'Kompaniya'} hamkorlik so‘rovi yubordi.`,
      'INFO',
      {
        moduleKey: 'PARTNERS',
        eventKey: 'partner.request_created',
        details: {
          partnerRequestId: partnerId,
          fromCompany: owner?.name || ownerCompanyId,
          status: 'PENDING',
        },
        targetRoles: ['OWNER', 'MANAGER'],
        actions: [
          { key: 'PARTNER_ACCEPT', label: 'Qabul qilish', targetType: 'PARTNER', targetId: partnerId },
          { key: 'PARTNER_REJECT', label: 'Bekor qilish', targetType: 'PARTNER', targetId: partnerId },
        ],
      },
    );
  }

  async acceptRequest(ownerCompanyId: string, requestId: string, userId: string) {
    const request = await this.prisma.partner.findFirst({
      where: { id: requestId, partnerCompanyId: ownerCompanyId }
    });

    if (!request) {
      throw new NotFoundException('Hamkorlik so‘rovi topilmadi');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Faqat PENDING holatidagi so‘rovlarni qabul qilish mumkin');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.partner.update({
        where: { id: requestId },
        data: { 
          status: 'ACTIVE',
          acceptedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          companyId: ownerCompanyId,
          userId,
          action: 'partner.accepted',
          entityType: 'PARTNER',
          entityId: requestId
        }
      });

      return row;
    }, DEFAULT_TX_OPTIONS);

    await this.notificationsService.notifyCompany(
      request.ownerCompanyId,
      'Hamkor so‘rovi qabul qilindi',
      'Yuborgan hamkorlik so‘rovingiz qabul qilindi.',
      'SUCCESS',
      {
        moduleKey: 'PARTNERS',
        eventKey: 'partner.request_accepted',
        details: {
          partnerRequestId: requestId,
          status: 'ACTIVE',
        },
        targetRoles: ['OWNER', 'MANAGER'],
      },
    );

    return updated;
  }

  async rejectRequest(ownerCompanyId: string, requestId: string, userId: string) {
    const request = await this.prisma.partner.findFirst({
      where: { id: requestId, partnerCompanyId: ownerCompanyId }
    });

    if (!request) throw new NotFoundException('Hamkorlik so‘rovi topilmadi');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.partner.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
      });

      await tx.auditLog.create({
        data: {
          companyId: ownerCompanyId,
          userId,
          action: 'partner.rejected',
          entityType: 'PARTNER',
          entityId: requestId
        }
      });

      return row;
    }, DEFAULT_TX_OPTIONS);

    await this.notificationsService.notifyCompany(
      request.ownerCompanyId,
      'Hamkor so‘rovi rad etildi',
      'Yuborgan hamkorlik so‘rovingiz rad etildi.',
      'ERROR',
      {
        moduleKey: 'PARTNERS',
        eventKey: 'partner.request_rejected',
        details: {
          partnerRequestId: requestId,
          status: 'REJECTED',
        },
        targetRoles: ['OWNER', 'MANAGER'],
      },
    );

    return updated;
  }

  async blockPartner(ownerCompanyId: string, partnerId: string, userId: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { 
        id: partnerId,
        OR: [{ ownerCompanyId }, { partnerCompanyId: ownerCompanyId }]
      }
    });

    if (!partner) throw new NotFoundException('Hamkor topilmadi');

    return this.prisma.$transaction(async (tx) => {
      // Block both directions
      await tx.partner.updateMany({
        where: {
          OR: [
            { ownerCompanyId: partner.ownerCompanyId, partnerCompanyId: partner.partnerCompanyId },
            { ownerCompanyId: partner.partnerCompanyId, partnerCompanyId: partner.ownerCompanyId }
          ]
        },
        data: { status: 'BLOCKED' }
      });

      await tx.auditLog.create({
        data: {
          companyId: ownerCompanyId,
          userId,
          action: 'partner.blocked',
          entityType: 'PARTNER',
          entityId: partnerId
        }
      });

      return { success: true };
    });
  }

  async findAll(companyId: string) {
    const partners = await this.prisma.partner.findMany({
      where: {
        OR: [
          { ownerCompanyId: companyId },
          { partnerCompanyId: companyId }
        ]
      },
      include: {
        ownerCompany: {
          select: { id: true, name: true, tin: true, phone: true, address: true, businessType: true }
        },
        partnerCompany: {
          select: { id: true, name: true, tin: true, phone: true, address: true, businessType: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = partners.map(p => {
      const isIncoming = p.partnerCompanyId === companyId;
      const visibleWarehouseIdsForCurrentCompany = this.extractVisibleWarehouseIds(
        (p as any).warehouseVisibilityConfig,
        companyId,
      );
      return {
        ...p,
        isIncoming,
        visibleWarehouseIdsForCurrentCompany,
        // The "partner" for the current user is the one who ISN'T them
        company: isIncoming ? p.ownerCompany : p.partnerCompany
      };
    });

    return mapped;
  }

  async findOne(companyId: string, id: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { 
        id, 
        OR: [
          { ownerCompanyId: companyId },
          { partnerCompanyId: companyId }
        ]
      },
      include: {
        ownerCompany: true,
        partnerCompany: true
      }
    });
    if (!partner) throw new NotFoundException('Hamkor topilmadi');
    
    return {
      ...partner,
      isIncoming: partner.partnerCompanyId === companyId
    };
  }

  async remove(companyId: string, id: string, userId: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { 
        id, 
        OR: [
          { ownerCompanyId: companyId },
          { partnerCompanyId: companyId }
        ]
      }
    });

    if (!partner) throw new NotFoundException('Hamkorlik topilmadi');

    return this.prisma.$transaction(async (tx) => {
      await tx.partner.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'partner.removed',
          entityType: 'PARTNER',
          entityId: id,
          newData: { partnerCompanyId: partner.partnerCompanyId === companyId ? partner.ownerCompanyId : partner.partnerCompanyId } as any
        }
      });

      return { success: true };
    });
  }

  async searchCompany(tin: string) {
    const company = await this.prisma.company.findUnique({
      where: { tin },
      select: {
        id: true,
        name: true,
        tin: true,
        address: true,
        businessType: true
      }
    });
    if (!company) throw new NotFoundException('Kompaniya topilmadi');
    return company;
  }

  async ensureActivePartner(ownerCompanyId: string, partnerCompanyId: string) {
    const partner = await this.prisma.partner.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [
          { ownerCompanyId, partnerCompanyId },
          { ownerCompanyId: partnerCompanyId, partnerCompanyId: ownerCompanyId }
        ]
      }
    });

    if (!partner) {
      throw new BadRequestException('Ushbu kompaniya bilan faol hamkorlik mavjud emas');
    }
    return partner;
  }

  async updateWarehouseVisibility(
    companyId: string,
    partnerId: string,
    userId: string,
    dto: PartnerWarehouseVisibilityDto,
  ) {
    const partner = await this.prisma.partner.findFirst({
      where: {
        id: partnerId,
        status: 'ACTIVE',
        OR: [{ ownerCompanyId: companyId }, { partnerCompanyId: companyId }],
      },
      select: {
        id: true,
        ownerCompanyId: true,
        partnerCompanyId: true,
        warehouseVisibilityConfig: true,
      },
    });
    if (!partner) throw new NotFoundException('Faol hamkor topilmadi');

    const warehouseIds = dto.allVisible ? [] : Array.from(new Set(dto.warehouseIds || []));
    if (!dto.allVisible) {
      if (!warehouseIds.length) {
        throw new BadRequestException("Kamida bitta ombor tanlang yoki 'Barchasi' rejimini yoqing.");
      }
      const validWarehouses = await this.prisma.warehouse.findMany({
        where: { companyId, status: 'ACTIVE', id: { in: warehouseIds } },
        select: { id: true },
      });
      if (validWarehouses.length !== warehouseIds.length) {
        throw new BadRequestException('Tanlangan omborlardan biri topilmadi yoki nofaol.');
      }
    }

    const currentConfig =
      partner.warehouseVisibilityConfig &&
      typeof partner.warehouseVisibilityConfig === 'object' &&
      !Array.isArray(partner.warehouseVisibilityConfig)
        ? { ...(partner.warehouseVisibilityConfig as Record<string, unknown>) }
        : {};

    if (dto.allVisible) {
      delete currentConfig[companyId];
    } else {
      currentConfig[companyId] = warehouseIds;
    }

    const updated = await this.prisma.partner.update({
      where: { id: partnerId },
      data: {
        warehouseVisibilityConfig: Object.keys(currentConfig).length ? (currentConfig as any) : null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'partner.warehouse_visibility_updated',
        entityType: 'PARTNER',
        entityId: partnerId,
        newData: {
          allVisible: dto.allVisible,
          warehouseIds: dto.allVisible ? [] : warehouseIds,
        } as any,
      },
    });

    return {
      id: updated.id,
      allVisible: dto.allVisible,
      warehouseIds: dto.allVisible ? [] : warehouseIds,
    };
  }
}
