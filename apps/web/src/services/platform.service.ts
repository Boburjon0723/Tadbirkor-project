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

export type PlatformUserRow = {
  id: string;
  fullName: string;
  login: string;
  email: string | null;
  phone: string | null;
  status: string;
  companyCount: number;
  companiesPreview: string;
  createdAt: string;
};

export type PlatformScheduledJob = {
  id: string;
  kind: 'broadcast' | 'subscription';
  status: string;
  runAt: string;
  payload: Record<string, unknown>;
  createdAt: string;
  processedAt?: string | null;
  errorMessage?: string | null;
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
      trialEndsAt?: string;
      companyStatus?: 'active' | 'suspended';
      scheduleAt?: string;
    },
  ) {
    const { data } = await api.patch(`/platform/companies/${companyId}`, body, {
      headers: platformHeaders(),
    });
    return data;
  },

  async listUsers(params?: { search?: string; status?: string; page?: number; limit?: number }) {
    const { data } = await api.get('/platform/users', {
      params,
      headers: platformHeaders(),
    });
    return data as {
      items: PlatformUserRow[];
      page: number;
      total: number;
      hasMore: boolean;
    };
  },

  async updateUser(userId: string, body: { status: 'active' | 'inactive' }) {
    const { data } = await api.patch(`/platform/users/${userId}`, body, {
      headers: platformHeaders(),
    });
    return data;
  },

  async getRedisHealth() {
    const { data } = await api.get<{ cache: Record<string, unknown>; ping: string }>(
      '/platform/redis-health',
      { headers: platformHeaders() },
    );
    return data;
  },

  async broadcast(body: {
    title: string;
    message: string;
    target: string;
    type?: string;
    companyIds?: string[];
    userIds?: string[];
    scheduledAt?: string;
  }) {
    const { data } = await api.post<{ sent?: number; scheduled?: boolean; job?: PlatformScheduledJob; message?: string }>(
      '/platform/broadcast',
      body,
      { headers: platformHeaders() },
    );
    return data;
  },

  async listScheduledJobs(params?: { status?: string; page?: number; limit?: number }) {
    const { data } = await api.get('/platform/scheduled-jobs', {
      params,
      headers: platformHeaders(),
    });
    return data as {
      items: PlatformScheduledJob[];
      page: number;
      total: number;
      hasMore: boolean;
    };
  },

  async cancelScheduledJob(jobId: string) {
    const { data } = await api.delete(`/platform/scheduled-jobs/${jobId}`, {
      headers: platformHeaders(),
    });
    return data;
  },
};
