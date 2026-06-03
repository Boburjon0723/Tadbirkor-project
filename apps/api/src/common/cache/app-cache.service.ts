import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import IORedis from 'ioredis';
import { createRedisClient, resolveRedisUrl } from './redis-connection';

type MemoryEntry = {
  expiresAt: number;
  value: string;
};

@Injectable()
export class AppCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private redis?: IORedis;
  private redisReady = false;

  async onModuleInit() {
    const redisUrl = resolveRedisUrl();
    this.logger.log(
      redisUrl
        ? 'Redis cache: REDIS_URL bor, ulanish boshlandi…'
        : 'REDIS_URL topilmadi — cache xotira (in-memory) rejimida. Railway: API → Variables → Redis reference.',
    );
    if (!redisUrl) return;

    try {
      this.redis = createRedisClient('cache') ?? undefined;
      if (!this.redis) {
        this.logger.warn('Redis client yaratilmadi (URL bor, lekin client null).');
        return;
      }
      await this.redis.connect();
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`PING javobi: ${String(pong)}`);
      }
      this.redisReady = true;
      const host = redisUrl.replace(/:[^:@/]+@/, ':***@').split('@').pop();
      this.logger.log(`Redis cache ulandi (${host || 'railway'}).`);
    } catch (err) {
      this.logger.warn(
        `Redis ulanmadi, in-memory cache: ${(err as Error).message}`,
      );
      if (this.redis) {
        await this.redis.quit().catch(() => undefined);
      }
      this.redis = undefined;
      this.redisReady = false;
    }
  }

  /** Platform diagnostika / log tekshiruv */
  getDiagnostics() {
    const url = resolveRedisUrl();
    return {
      redisConfigured: Boolean(url),
      redisReady: this.redisReady,
      mode: this.redisReady ? ('redis' as const) : ('memory' as const),
      hostHint: url
        ? url.replace(/:[^:@/]+@/, ':***@').split('@').pop() || 'set'
        : null,
    };
  }

  async ping(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    if (!this.redisReady || !this.redis) {
      return { ok: false, error: 'redis_not_connected' };
    }
    const started = Date.now();
    try {
      const pong = await this.redis.ping();
      return {
        ok: pong === 'PONG',
        latencyMs: Date.now() - started,
        ...(pong !== 'PONG' ? { error: `unexpected: ${String(pong)}` } : {}),
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private readMemory(key: string): string | null {
    const row = this.memory.get(key);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return row.value;
  }

  private writeMemory(key: string, value: string, ttlMs: number) {
    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async get(key: string): Promise<string | null> {
    if (this.redisReady && this.redis) {
      try {
        return await this.redis.get(key);
      } catch (err) {
        this.logger.warn(`Redis GET ${key}: ${(err as Error).message}`);
      }
    }
    return this.readMemory(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    if (this.redisReady && this.redis) {
      try {
        await this.redis.set(key, value, 'EX', ttlSec);
        return;
      } catch (err) {
        this.logger.warn(`Redis SET ${key}: ${(err as Error).message}`);
      }
    }
    this.writeMemory(key, value, ttlMs);
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlMs);
  }

  /** Cache miss → factory → set (Redis yoki in-memory) */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.setJson(key, value, ttlMs);
    return value;
  }

  async del(key: string): Promise<void> {
    if (this.redisReady && this.redis) {
      try {
        await this.redis.del(key);
      } catch (err) {
        this.logger.warn(`Redis DEL ${key}: ${(err as Error).message}`);
      }
    }
    this.memory.delete(key);
  }

  static authMeKey(userId: string, companyId: string) {
    return `auth:me:${userId}:${companyId}`;
  }

  static companyFeaturesKey(companyId: string) {
    return `company:features:${companyId}`;
  }

  static inventoryCountsListKey(
    companyId: string,
    query?: { status?: string; warehouseId?: string },
  ) {
    const status = String(query?.status || '').trim().toUpperCase() || '_';
    const wh = String(query?.warehouseId || '').trim() || '_';
    return `inv-counts:${companyId}:${wh}:${status}`;
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }
    if (!this.redisReady || !this.redis) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Redis prefix DEL ${prefix}: ${(err as Error).message}`);
    }
  }
}
