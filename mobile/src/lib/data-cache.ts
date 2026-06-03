type CacheEntry = { data: unknown; expires: number };

const store = new Map<string, CacheEntry>();

export const DEFAULT_CACHE_TTL_MS = 30_000;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs = DEFAULT_CACHE_TTL_MS) {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export function cacheInvalidate(key: string) {
  store.delete(key);
}

export function cacheInvalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
