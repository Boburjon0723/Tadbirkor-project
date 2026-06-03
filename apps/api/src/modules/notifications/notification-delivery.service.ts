import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JobsOptions, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createRedisClient, resolveRedisUrl } from '../../common/cache/redis-connection';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CompanyTelegramPayload } from './notification-events';

export type TelegramDeliveryKind = 'company' | 'chat';

export type TelegramDeliveryPayload = {
  kind: TelegramDeliveryKind;
  companyId: string;
  chatId?: string;
  title: string;
  message: string;
  type: string;
  telegramPayload?: CompanyTelegramPayload;
};

type EnqueueTelegramInput = TelegramDeliveryPayload & {
  dedupKey?: string;
  dedupTtlMs?: number;
  throwOnFailure?: boolean;
};

@Injectable()
export class NotificationDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private readonly queueName = 'notifications-delivery';
  private redis?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  async onModuleInit() {
    const redisUrl = resolveRedisUrl();
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL topilmadi — Telegram delivery sync fallback (queue yo‘q).',
      );
      return;
    }

    this.redis = createRedisClient('queue') ?? undefined;
    if (!this.redis) return;

    await this.redis.connect();
    this.logger.log('Notification delivery queue ulandi (BullMQ).');

    this.queue = new Queue(this.queueName, { connection: this.redis });
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        const deliveryId = String(job.data?.deliveryId || '').trim();
        if (!deliveryId) return;
        await this.processDelivery(deliveryId);
      },
      {
        connection: this.redis,
        concurrency: Number(process.env.NOTIFICATION_DELIVERY_CONCURRENCY || 3),
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn({
        channel: 'telegram',
        deliveryId: job?.data?.deliveryId,
        errorMessage: err.message,
        attemptsMade: job?.attemptsMade,
      });
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    if (this.redis) await this.redis.quit();
  }

  private jobOptions(): JobsOptions {
    return {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    };
  }

  private async findRecentDuplicate(dedupKey: string, ttlMs: number) {
    const since = new Date(Date.now() - ttlMs);
    return this.prisma.notificationDelivery.findFirst({
      where: {
        dedupKey,
        status: { in: ['PENDING', 'SENT', 'RETRYING'] },
        createdAt: { gte: since },
      },
      select: { id: true, status: true },
    });
  }

  async hasRecentDelivery(dedupKey: string, ttlMs = 5 * 60_000): Promise<boolean> {
    const dup = await this.findRecentDuplicate(dedupKey, ttlMs);
    return Boolean(dup);
  }

  async enqueueTelegram(input: EnqueueTelegramInput): Promise<{ deliveryId: string; queued: boolean; deduped?: boolean }> {
    const dedupKey = input.dedupKey?.trim();
    if (dedupKey) {
      const dup = await this.findRecentDuplicate(dedupKey, input.dedupTtlMs ?? 5 * 60_000);
      if (dup) {
        this.logger.debug({
          channel: 'telegram',
          dedupKey,
          existingDeliveryId: dup.id,
          deduped: true,
        });
        return { deliveryId: dup.id, queued: false, deduped: true };
      }
    }

    const payload: TelegramDeliveryPayload = {
      kind: input.kind,
      companyId: input.companyId,
      chatId: input.chatId,
      title: input.title,
      message: input.message,
      type: input.type,
      telegramPayload: input.telegramPayload,
    };

    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        companyId: input.companyId,
        channel: 'TELEGRAM',
        status: 'PENDING',
        target: input.kind === 'chat' ? input.chatId : `company:${input.companyId}`,
        moduleKey: input.telegramPayload?.moduleKey,
        eventKey: input.telegramPayload?.eventKey,
        dedupKey: dedupKey || null,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    if (this.queue) {
      await this.queue.add('telegram-send', { deliveryId: delivery.id }, this.jobOptions());
      return { deliveryId: delivery.id, queued: true };
    }

    try {
      await this.processDelivery(delivery.id);
    } catch (error) {
      this.logger.warn({
        channel: 'telegram',
        deliveryId: delivery.id,
        companyId: input.companyId,
        eventKey: input.telegramPayload?.eventKey,
        errorMessage: (error as Error).message,
      });
      if (input.throwOnFailure) throw error;
    }
    return { deliveryId: delivery.id, queued: false };
  }

  async enqueueCompanyTelegram(
    companyId: string,
    title: string,
    message: string,
    type: string,
    telegramPayload?: CompanyTelegramPayload,
    options?: { dedupKey?: string; dedupTtlMs?: number },
  ) {
    return this.enqueueTelegram({
      kind: 'company',
      companyId,
      title,
      message,
      type,
      telegramPayload,
      dedupKey: options?.dedupKey,
      dedupTtlMs: options?.dedupTtlMs,
    });
  }

  async enqueueChatTelegram(
    companyId: string,
    chatId: string,
    title: string,
    message: string,
    type: string,
    telegramPayload?: CompanyTelegramPayload,
    options?: { dedupKey?: string; dedupTtlMs?: number; throwOnFailure?: boolean },
  ) {
    return this.enqueueTelegram({
      kind: 'chat',
      companyId,
      chatId,
      title,
      message,
      type,
      telegramPayload,
      dedupKey: options?.dedupKey,
      dedupTtlMs: options?.dedupTtlMs,
      throwOnFailure: options?.throwOnFailure,
    });
  }

  private async markAttemptFailed(deliveryId: string, error: unknown, attempt: number, maxAttempts: number) {
    const message = (error as Error)?.message ?? String(error);
    const isDead = attempt >= maxAttempts;
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        attempt,
        status: isDead ? 'DEAD' : 'RETRYING',
        lastError: message.slice(0, 2000),
        nextRetryAt: isDead ? null : new Date(Date.now() + 30_000 * Math.pow(2, Math.min(attempt - 1, 4))),
      },
    });
    if (isDead) {
      this.logger.warn({
        channel: 'telegram',
        deliveryId,
        attempt,
        status: 'DEAD',
        errorMessage: message,
      });
    }
    throw error instanceof Error ? error : new Error(message);
  }

  async processDelivery(deliveryId: string) {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery || delivery.status === 'SENT' || delivery.status === 'DEAD') return;

    const payload = delivery.payload as TelegramDeliveryPayload | null;
    if (!payload) {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: 'DEAD', lastError: 'Missing payload' },
      });
      return;
    }

    const nextAttempt = delivery.attempt + 1;
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'RETRYING', attempt: nextAttempt },
    });

    try {
      if (payload.kind === 'chat') {
        if (!payload.chatId) throw new Error('chatId missing');
        await this.telegramService.sendToChat(
          payload.companyId,
          payload.chatId,
          payload.title,
          payload.message,
          payload.type,
          payload.telegramPayload,
        );
      } else {
        await this.telegramService.sendToCompany(
          payload.companyId,
          payload.title,
          payload.message,
          payload.type,
          payload.telegramPayload,
        );
      }

      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        },
      });
    } catch (error) {
      await this.markAttemptFailed(deliveryId, error, nextAttempt, delivery.maxAttempts);
    }
  }
}
