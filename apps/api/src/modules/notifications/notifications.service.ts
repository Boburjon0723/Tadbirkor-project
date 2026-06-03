import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import {
  buildEventKey,
  CompanyTelegramPayload,
  NotificationEventPayload,
  notificationPayloadToTelegramDetails,
} from './notification-events';
import { NotificationDeliveryService } from './notification-delivery.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly companyUserIdsCache = new Map<
    string,
    { ids: string[]; expiresAt: number }
  >();

  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
    private deliveryService: NotificationDeliveryService,
  ) {}

  private async getCompanyUserIds(companyId: string): Promise<string[]> {
    const cached = this.companyUserIdsCache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.ids;
    }

    const rows = await this.prisma.companyUser.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const ids = rows.map((r) => r.userId);
    this.companyUserIdsCache.set(companyId, {
      ids,
      expiresAt: Date.now() + 60_000,
    });
    return ids;
  }

  private async getCompanyUserIdsByRoles(
    companyId: string,
    roles: string[],
  ): Promise<string[]> {
    const normalized = roles.map((r) => r.toUpperCase());
    const rows = await this.prisma.companyUser.findMany({
      where: { companyId, role: { in: normalized } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private logDeliveryFailure(
    channel: 'telegram' | 'in_app',
    context: Record<string, unknown>,
    error: unknown,
  ) {
    const err = error as { message?: string; code?: string };
    this.logger.warn({
      channel,
      errorMessage: err?.message ?? String(error),
      errorCode: err?.code,
      ...context,
    });
  }

  private parsePage(page?: string) {
    const parsed = Number(page);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
  }

  private parseLimit(limit?: string) {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed < 1) return 20;
    return Math.min(Math.floor(parsed), 100);
  }

  async notifyCompanyEvent(
    companyId: string,
    event: NotificationEventPayload,
    options?: { skipDedup?: boolean; dedupTtlMs?: number },
  ) {
    const severity = event.severity ?? 'INFO';
    const dedupKey = options?.skipDedup
      ? undefined
      : buildEventKey(
          event.moduleKey,
          event.eventKey,
          event.entityId ?? event.entityType,
        );
    const fullDedupKey = dedupKey ? `${companyId}:${dedupKey}` : undefined;
    if (fullDedupKey && (await this.deliveryService.hasRecentDelivery(fullDedupKey, options?.dedupTtlMs))) {
      this.logger.debug({
        channel: 'in_app',
        companyId,
        moduleKey: event.moduleKey,
        eventKey: event.eventKey,
        deduped: true,
      });
      return { count: 0, deduped: true as const };
    }

    const telegramDetails = notificationPayloadToTelegramDetails({
      ...event.details,
      entityType: event.entityType,
      entityId: event.entityId,
      occurredAt: new Date().toISOString(),
    });

    return this.notifyCompany(companyId, event.title, event.message, severity, {
      moduleKey: event.moduleKey,
      eventKey: event.eventKey,
      details: telegramDetails,
      targetRoles: event.targetRoles,
    }, {
      dedupKey: fullDedupKey,
      dedupTtlMs: options?.dedupTtlMs,
    });
  }

  async findAll(
    userId: string,
    query?: {
      page?: string;
      limit?: string;
      scope?: string;
      severity?: string;
      moduleKey?: string;
    },
  ) {
    const page = this.parsePage(query?.page);
    const limit = this.parseLimit(query?.limit);
    const scope = String(query?.scope || 'all').toLowerCase();
    const severity = String(query?.severity || '').toUpperCase();
    const moduleKey = String(query?.moduleKey || '').trim();
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (scope === 'unread') where.isRead = false;
    if (['INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(severity)) where.type = severity;
    if (moduleKey) where.moduleKey = moduleKey;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  async findUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    this.notificationsGateway.emitToUser(userId, 'notification:updated', { id, isRead: true });
    return updated;
  }

  async markAllAsRead(userId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    this.notificationsGateway.emitToUser(userId, 'notification:all_read', { success: true });
    return updated;
  }

  async create(
    userId: string,
    title: string,
    message: string,
    type: string = 'INFO',
    extra?: { moduleKey?: string; eventKey?: string },
  ) {
    const created = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        moduleKey: extra?.moduleKey || null,
        eventKey: extra?.eventKey || null,
      },
    });
    this.notificationsGateway.emitToUser(userId, 'notification:new', created);
    return created;
  }

  async notifyCompanyRoles(
    companyId: string,
    roles: string[],
    title: string,
    message: string,
    type: string = 'INFO',
    telegramPayload?: CompanyTelegramPayload,
  ) {
    const normalized = roles.map((r) => r.toUpperCase());
    const userIds = await this.getCompanyUserIdsByRoles(companyId, roles);
    if (userIds.length === 0) return { count: 0 };

    const notifications = userIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      moduleKey: telegramPayload?.moduleKey || null,
      eventKey: telegramPayload?.eventKey || null,
    }));

    const result = await this.prisma.notification.createMany({ data: notifications });

    try {
      await this.deliveryService.enqueueCompanyTelegram(
        companyId,
        title,
        message,
        type,
        {
          ...telegramPayload,
          targetRoles: normalized,
        },
        {
          dedupKey: telegramPayload?.eventKey
            ? `${companyId}:${telegramPayload.moduleKey}:${telegramPayload.eventKey}`
            : undefined,
        },
      );
    } catch (error) {
      this.logDeliveryFailure('telegram', {
        companyId,
        moduleKey: telegramPayload?.moduleKey,
        eventKey: telegramPayload?.eventKey,
        targetRoles: normalized,
      }, error);
    }

    for (const userId of userIds) {
      this.notificationsGateway.emitToUser(userId, 'notification:refresh', {
        reason: 'role_broadcast',
      });
    }
    return result;
  }

  async notifyCompany(
    companyId: string,
    title: string,
    message: string,
    type: string = 'INFO',
    telegramPayload?: CompanyTelegramPayload,
    deliveryOptions?: { dedupKey?: string; dedupTtlMs?: number },
  ) {
    const userIds = await this.getCompanyUserIds(companyId);
    if (userIds.length === 0) return { count: 0 };

    const notifications = userIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      moduleKey: telegramPayload?.moduleKey || null,
      eventKey: telegramPayload?.eventKey || null,
    }));

    const result = await this.prisma.notification.createMany({
      data: notifications,
    });

    // Telegram navbat orqali yuboriladi; xato bo‘lsa ham biznes jarayon to‘xtamaydi.
    try {
      const delivery = await this.deliveryService.enqueueCompanyTelegram(
        companyId,
        title,
        message,
        type,
        telegramPayload,
        deliveryOptions,
      );
      if (delivery.deduped) {
        this.logger.debug({
          channel: 'telegram',
          companyId,
          moduleKey: telegramPayload?.moduleKey,
          eventKey: telegramPayload?.eventKey,
          deduped: true,
        });
      }
    } catch (error) {
      this.logDeliveryFailure('telegram', {
        companyId,
        moduleKey: telegramPayload?.moduleKey,
        eventKey: telegramPayload?.eventKey,
      }, error);
    }

    for (const userId of userIds) {
      this.notificationsGateway.emitToUser(userId, 'notification:refresh', { reason: 'company_broadcast' });
    }
    return result;
  }
}
