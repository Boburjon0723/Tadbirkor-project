export function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function getExplicitOrigins(): Set<string> {
  const rawOrigins = process.env.CORS_ORIGINS || '';
  return new Set(
    rawOrigins
      .split(',')
      .map((item) => normalizeOrigin(item))
      .filter(Boolean),
  );
}

function isLocalhostOrigin(normalizedOrigin: string): boolean {
  return (
    /^http:\/\/localhost:\d+$/.test(normalizedOrigin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(normalizedOrigin)
  );
}

function isVercelPreviewOrigin(origin: string): boolean {
  if (process.env.CORS_ALLOW_VERCEL_PREVIEW !== 'true') {
    return false;
  }
  const pattern = (process.env.CORS_VERCEL_PREVIEW_PATTERN || '').trim();
  try {
    const hostname = new URL(origin).hostname;
    if (pattern) {
      const regex = new RegExp(pattern);
      return regex.test(hostname);
    }
    return /\.vercel\.app$/.test(hostname);
  } catch {
    return false;
  }
}

/** HTTP va WebSocket uchun bir xil origin tekshiruvi. */
export function isOriginAllowed(origin: string | undefined): boolean {
  // Non-browser clients (curl, Postman) — CORS qo‘llanmaydi
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const explicitOrigins = getExplicitOrigins();
  const allowLocalhost =
    process.env.NODE_ENV !== 'production' ||
    process.env.CORS_ALLOW_LOCALHOST === 'true';

  if (allowLocalhost && isLocalhostOrigin(normalizedOrigin)) {
    return true;
  }
  if (explicitOrigins.has(normalizedOrigin)) {
    return true;
  }
  if (isVercelPreviewOrigin(origin)) {
    return true;
  }

  return false;
}

export function createCorsOriginCallback() {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
}

/** Socket.IO uchun: ruxsat etilgan origin yoki rad etish. */
export function createSocketCorsOrigin():
  | boolean
  | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void) {
  return (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
}
