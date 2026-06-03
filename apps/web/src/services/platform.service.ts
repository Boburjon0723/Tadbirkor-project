import { api } from '@/lib/api';

const PIN_STORAGE_KEY = 'axis_platform_admin_pin';

export function getStoredPlatformAdminPin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredPlatformAdminPin(pin: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PIN_STORAGE_KEY, pin);
}

export function clearStoredPlatformAdminPin() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PIN_STORAGE_KEY);
}

function platformHeaders() {
  const pin = getStoredPlatformAdminPin();
  return pin ? { 'X-Platform-Admin-Pin': pin } : {};
}

export type PlatformCompanyRow = {
  id: string;
  name: string;
  tin: string | null;
  phone: string | null;
  status: string;
  trialEndsAt: string;
  subscriptionStatus: string;
  subscriptionNote: string | null;
  userCount: number;
  access: {
    status: string;
    canWrite: boolean;
    trialActive: boolean;
    labelUz: string;
  };
};

export const platformService = {
  async getAccess() {
    const { data } = await api.get<{ isPlatformAdmin: boolean; pinRequired: boolean }>(
      '/platform/access',
    );
    return data;
  },

  async verifyPin(pin: string) {
    const { data } = await api.post<{ ok: boolean; pinRequired: boolean }>(
      '/platform/verify-pin',
      { pin },
    );
    if (data.ok) setStoredPlatformAdminPin(pin);
    return data;
  },

  async getStats() {
    const { data } = await api.get('/platform/stats', { headers: platformHeaders() });
    return data;
  },

  async listCompanies(params?: { search?: string; page?: number; limit?: number }) {
    const { data } = await api.get('/platform/companies', {
      params,
      headers: platformHeaders(),
    });
    return data as {
      items: PlatformCompanyRow[];
      page: number;
      total: number;
      hasMore: boolean;
      trialDaysDefault: number;
    };
  },

  async updateCompany(
    companyId: string,
    body: {
      subscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'EXPIRED';
      extendTrialDays?: number;
      subscriptionNote?: string;
    },
  ) {
    const { data } = await api.patch(`/platform/companies/${companyId}`, body, {
      headers: platformHeaders(),
    });
    return data;
  },
};
