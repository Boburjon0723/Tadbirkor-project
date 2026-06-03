/**
 * Supabase pooler:
 * - Ilova (NestJS / Railway): Transaction pooler — :6543 + ?pgbouncer=true
 * - Migratsiya (prisma migrate): DIRECT_URL — session :5432 (schema.prisma directUrl)
 */
export function resolveDatabaseUrl(raw?: string): string | undefined {
  if (!raw?.trim()) return raw;

  try {
    const url = new URL(raw);
    const isPooler = url.hostname.includes('pooler.supabase.com');

    // Railway da ko‘pincha noto‘g‘ri :5432 qo‘yiladi — runtime uchun :6543 ga o‘tkazamiz
    if (isPooler && (url.port === '5432' || url.port === '')) {
      console.warn(
        '[Prisma] DATABASE_URL session pooler (:5432) aniqlandi — ilova uchun :6543 (transaction) ga o‘tkazildi. ' +
          'Migratsiya uchun Railway da alohida DIRECT_URL (:5432) qoldiring.',
      );
      url.port = '6543';
    }

    if (isPooler && url.port === '6543' && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }

    // Supabase transaction pooler odatda 25–30; 10+ foydalanuvchi uchun 15 (Railway Variables da ham qo‘yish mumkin)
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '15');
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '60');
    }

    return url.toString();
  } catch {
    return raw;
  }
}
