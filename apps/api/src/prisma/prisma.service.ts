import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './database-url';
import { DEFAULT_TX_OPTIONS } from './transaction-options';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = resolveDatabaseUrl(process.env.DATABASE_URL);
    super(
      url
        ? {
            datasources: {
              db: { url },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** $transaction with sensible maxWait (avoids P2028 under pooler load) */
  runTransaction<T>(
    fn: Parameters<PrismaClient['$transaction']>[0],
    options?: Parameters<PrismaClient['$transaction']>[1],
  ): Promise<T> {
    return this.$transaction(fn, {
      ...DEFAULT_TX_OPTIONS,
      ...options,
    } as Parameters<PrismaClient['$transaction']>[1]) as Promise<T>;
  }
}
