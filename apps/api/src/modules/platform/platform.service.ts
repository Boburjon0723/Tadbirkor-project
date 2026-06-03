import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeTrialEndsAt, getTrialDays } from '../../common/trial.util';
import { resolveSubscriptionAccess } from '../../common/subscription.util';
import { UpdateCompanySubscriptionDto } from './dto/update-company-subscription.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async listCompanies(query?: { search?: string; page?: number; limit?: number }) {
    const search = String(query?.search || '').trim();
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(query?.limit) || 30));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { tin: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          tin: true,
          phone: true,
          status: true,
          trialStartedAt: true,
          trialEndsAt: true,
          subscriptionStatus: true,
          subscriptionNote: true,
          subscriptionActivatedAt: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items: rows.map((c) => ({
        ...c,
        userCount: c._count.users,
        access: resolveSubscriptionAccess(c),
      })),
      page,
      limit,
      total,
      hasMore: skip + rows.length < total,
      trialDaysDefault: getTrialDays(),
    };
  }

  async updateCompanySubscription(companyId: string, dto: UpdateCompanySubscriptionDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Kompaniya topilmadi');

    const data: Record<string, unknown> = {};

    if (dto.subscriptionNote !== undefined) {
      data.subscriptionNote = dto.subscriptionNote?.trim() || null;
    }

    if (dto.extendTrialDays) {
      const base = new Date(company.trialEndsAt);
      const from = base.getTime() > Date.now() ? base : new Date();
      const end = new Date(from);
      end.setDate(end.getDate() + dto.extendTrialDays);
      data.trialEndsAt = end;
      data.subscriptionStatus = 'TRIAL';
    }

    if (dto.subscriptionStatus) {
      data.subscriptionStatus = dto.subscriptionStatus;
      if (dto.subscriptionStatus === 'ACTIVE') {
        data.subscriptionActivatedAt = new Date();
      }
      if (dto.subscriptionStatus === 'TRIAL' && !dto.extendTrialDays) {
        data.trialEndsAt = computeTrialEndsAt();
      }
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data,
      select: {
        id: true,
        name: true,
        tin: true,
        trialEndsAt: true,
        subscriptionStatus: true,
        subscriptionNote: true,
        subscriptionActivatedAt: true,
      },
    });

    return {
      ...updated,
      access: resolveSubscriptionAccess(updated),
    };
  }

  async getStats() {
    const [total, active, trial, expired] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { subscriptionStatus: 'ACTIVE' } }),
      this.prisma.company.count({ where: { subscriptionStatus: 'TRIAL' } }),
      this.prisma.company.count({ where: { subscriptionStatus: 'EXPIRED' } }),
    ]);
    return { total, active, trial, expired };
  }

  async broadcastToUsers(dto: BroadcastNotificationDto) {
    const type = dto.type || 'INFO';
    let userIds: string[] = [];

    if (dto.target === 'all') {
      // Barcha aktiv foydalanuvchilar
      const users = await this.prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else if (dto.target === 'company' && dto.companyIds?.length) {
      // Tanlangan kompaniyalarning foydalanuvchilari
      const rows = await this.prisma.companyUser.findMany({
        where: { companyId: { in: dto.companyIds } },
        select: { userId: true },
      });
      userIds = [...new Set(rows.map((r) => r.userId))];
    } else if (dto.target === 'user' && dto.userIds?.length) {
      // To'g'ridan-to'g'ri foydalanuvchi ID lari
      userIds = dto.userIds;
    }

    if (userIds.length === 0) {
      return { sent: 0, message: 'Foydalanuvchilar topilmadi' };
    }

    // Har bir foydalanuvchiga in-app notification yuborish
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: dto.title,
        message: dto.message,
        type,
        isRead: false,
        moduleKey: 'platform',
        eventKey: 'admin_broadcast',
      })),
    });

    // Socket orqali real vaqtda xabar
    for (const userId of userIds) {
      this.notificationsGateway.emitToUser(
        userId,
        'notification:new',
        { title: dto.title, message: dto.message, type },
      );
    }

    return { sent: userIds.length };
  }
}
