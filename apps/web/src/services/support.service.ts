import { api } from '@/lib/api';

export type SupportConfig = {
  telegramUsername: string | null;
  telegramUrl: string | null;
  email: string;
  phone: string | null;
  hours: string;
  chatEnabled: boolean;
};

export type SupportContext = {
  config: SupportConfig;
  user: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  company: { id: string; name: string } | null;
};

export const supportService = {
  async getContext() {
    const { data } = await api.get<SupportContext>('/support/context');
    return data;
  },

  async sendMessage(payload: { message: string; topic?: string }) {
    const { data } = await api.post<{
      ok: boolean;
      deliveredToTelegram: boolean;
      telegramUrl: string | null;
      message: string;
    }>('/support/messages', payload);
    return data;
  },

  async sendPublicMessage(payload: { name: string; contact: string; message: string; topic?: string }) {
    const { data } = await api.post<{
      ok: boolean;
      deliveredToTelegram: boolean;
      message: string;
    }>('/support/public-messages', payload);
    return data;
  },
};
