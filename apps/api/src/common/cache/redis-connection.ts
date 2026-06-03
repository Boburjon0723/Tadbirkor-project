import IORedis from 'ioredis';

/** Railway Redis: REDIS_URL, REDIS_PRIVATE_URL yoki plugin reference */
export function resolveRedisUrl(): string | undefined {
  const url =
    process.env.REDIS_URL ||
    process.env.REDIS_PRIVATE_URL ||
    process.env.REDIS_PUBLIC_URL;
  const trimmed = String(url || '').trim();
  return trimmed || undefined;
}

export function createRedisClient(
  purpose: 'cache' | 'queue',
): IORedis | null {
  const url = resolveRedisUrl();
  if (!url) return null;

  const useTls = url.startsWith('rediss://');
  const common = {
    lazyConnect: true as const,
    ...(useTls ? { tls: {} } : {}),
  };

  if (purpose === 'queue') {
    return new IORedis(url, {
      ...common,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return new IORedis(url, {
    ...common,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 10_000,
    commandTimeout: 5_000,
  });
}
