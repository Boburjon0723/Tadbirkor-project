import { Response } from 'express';

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'access_token';

export function getAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const crossSite =
    process.env.AUTH_COOKIE_CROSS_SITE === 'true' || isProd;

  return {
    httpOnly: true,
    secure: crossSite || isProd,
    sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getAuthCookieOptions(),
    maxAge: 0,
  });
}

export function extractTokenFromRequest(request: {
  headers?: { authorization?: string; cookie?: string };
  cookies?: Record<string, string>;
  query?: Record<string, any>;
}): string | undefined {
  const fromQuery = request.query?.token || (request as any).query?.access_token;
  if (fromQuery) return fromQuery;

  const fromCookie = request.cookies?.[AUTH_COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const [type, token] = request.headers?.authorization?.split(' ') ?? [];
  if (type === 'Bearer' && token) return token;

  const rawCookie = request.headers?.cookie;
  if (!rawCookie) return undefined;

  const prefix = `${AUTH_COOKIE_NAME}=`;
  const part = rawCookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix));
  if (!part) return undefined;
  return decodeURIComponent(part.slice(prefix.length));
}

export function extractTokenFromCookieHeader(
  cookieHeader?: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const prefix = `${AUTH_COOKIE_NAME}=`;
  const part = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix));
  if (!part) return undefined;
  return decodeURIComponent(part.slice(prefix.length));
}
