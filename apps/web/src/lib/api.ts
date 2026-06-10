import axios from 'axios';
import { getAuthToken } from './auth-token';

const DEFAULT_PROD_API_URL = 'https://tadbirkor-backend-production.up.railway.app/api';
const DEFAULT_PROD_SOCKET_ORIGIN = DEFAULT_PROD_API_URL.replace(/\/api\/?$/, '');

const CUSTOM_DOMAIN_HOSTS = new Set(['www.axis-erp.uz', 'axis-erp.uz']);

export function resolveApiUrl(): string {
  const raw = String(process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  const useSameOrigin = process.env.NEXT_PUBLIC_USE_SAME_ORIGIN_API === 'true';

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (useSameOrigin || raw === 'same-origin' || CUSTOM_DOMAIN_HOSTS.has(hostname)) {
      return `${origin}/api`;
    }
  }

  if (!raw || raw === 'same-origin') {
    return process.env.NODE_ENV === 'production' ? DEFAULT_PROD_API_URL : 'http://localhost:4003/api';
  }

  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export function getApiOrigin(): string {
  return resolveApiUrl().replace(/\/api\/?$/, '');
}

/** WebSocket: custom domen + API proxy bo‘lsa Railway ga (Bearer token bilan) */
export function getSocketOrigin(): string {
  const explicit = String(process.env.NEXT_PUBLIC_SOCKET_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (explicit) return explicit;

  const rawApi = String(process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (rawApi.includes('railway.app')) {
    return rawApi.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && CUSTOM_DOMAIN_HOSTS.has(window.location.hostname)) {
    return DEFAULT_PROD_SOCKET_ORIGIN;
  }

  return getApiOrigin();
}

/** @deprecated — har so‘rovda `resolveApiUrl()` ishlating */
export const API_URL = typeof window !== 'undefined' ? resolveApiUrl() : DEFAULT_PROD_API_URL;
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export const api = axios.create({
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = resolveApiUrl();
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      const code = error.response?.data?.code;
      if (code === 'SUBSCRIPTION_EXPIRED' && typeof window !== 'undefined') {
        const msg =
          error.response?.data?.message ||
          'Sinov tugagan. Yangi amallar uchun obunani faollashtiring.';
        import('@/lib/toast').then(({ toast }) => toast.error(msg));
      }
    }
    if (error.response?.status === 401) {
      const isAuthRequest =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/register') ||
        error.config?.url?.includes('/support/context');

      if (!isAuthRequest && typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('company');
        try {
          sessionStorage.removeItem('axis_access_token');
        } catch {
          /* ignore */
        }
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  },
);
