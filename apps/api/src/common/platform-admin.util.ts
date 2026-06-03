import { timingSafeEqual } from 'crypto';

/** Platforma administratori — faqat env ro‘yxatidagi email/login */

function readEnvList(...keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const raw = String(process.env[key] || '');
    for (const part of raw.split(/[,;\s]+/)) {
      const v = part.trim();
      if (v) out.push(v);
    }
  }
  return out;
}

/** Railway da ADMIN_PASSWORD / ADMIN_PIN ham qabul qilinadi (PLATFORM_ADMIN_PIN alias) */
export function getPlatformAdminPin(): string {
  return String(
    process.env.PLATFORM_ADMIN_PIN ||
      process.env.ADMIN_PIN ||
      process.env.ADMIN_PASSWORD ||
      '',
  ).trim();
}

export function isPlatformAdminPinRequired(): boolean {
  return getPlatformAdminPin().length >= 4;
}

export function verifyPlatformAdminPin(input: string): boolean {
  const expected = getPlatformAdminPin();
  if (!expected || expected.length < 4) return true;
  const a = Buffer.from(String(input || '').trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getPlatformAdminEmails(): Set<string> {
  return new Set(
    readEnvList(
      'PLATFORM_ADMIN_EMAILS',
      'PLATFORM_ADMIN_EMAIL',
      'ADMIN_EMAILS',
      'ADMIN_EMAIL',
    ).map((e) => e.toLowerCase()),
  );
}

export function getPlatformAdminLogins(): Set<string> {
  return new Set(
    readEnvList('PLATFORM_ADMIN_LOGINS', 'ADMIN_LOGINS', 'ADMIN_LOGIN').map((e) =>
      e.toLowerCase(),
    ),
  );
}

export function isPlatformAdminUser(user: {
  email?: string | null;
  login?: string | null;
}): boolean {
  const emails = getPlatformAdminEmails();
  const logins = getPlatformAdminLogins();
  if (!emails.size && !logins.size) return false;

  const email = String(user.email || '').trim().toLowerCase();
  const login = String(user.login || '').trim().toLowerCase();
  if (email && emails.has(email)) return true;
  if (login && logins.has(login)) return true;
  return false;
}
