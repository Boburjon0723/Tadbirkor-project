import { api } from '../api/client';

export type RegisterStartPayload = {
  companyName: string;
  fullName: string;
  login: string;
  password: string;
  phone: string;
  email?: string;
};

export type RegisterStartResponse = {
  sessionToken: string;
  botUrl: string;
  expiresAt: string;
  phone: string;
  instructions: string;
};

export type RegisterStatusResponse = {
  otpDelivered: boolean;
  expiresAt: string;
  phone: string;
};

export type PasswordResetTelegramResponse = {
  botUrl: string;
  startUrl: string;
  instructions?: string;
  expiresAt?: string;
};

export const authApi = {
  login: async (login: string, password: string) => {
    const { data } = await api.post('/auth/login', { login, password });
    return data;
  },

  getPasswordResetTelegramLink: async (login?: string) => {
    const trimmed = login?.trim();
    const { data } = await api.post<PasswordResetTelegramResponse>(
      '/auth/password-reset/telegram-link',
      trimmed ? { login: trimmed } : {},
    );
    return data;
  },

  registerStart: async (payload: RegisterStartPayload) => {
    const { data } = await api.post<RegisterStartResponse>('/auth/register/start', payload);
    return data;
  },

  registerStatus: async (sessionToken: string) => {
    const { data } = await api.get<RegisterStatusResponse>('/auth/register/status', {
      params: { sessionToken },
    });
    return data;
  },

  registerComplete: async (sessionToken: string, code: string) => {
    const { data } = await api.post('/auth/register/complete', { sessionToken, code });
    return data;
  },
};
