import { api } from '../lib/api';

export type CompanyFeatureConfig = {
  hasFeatureConfig: boolean;
  enabledFeatures: string[];
  enabledModules: string[];
};

export type UpdateModulePayload = {
  moduleKey: string;
  enabled: boolean;
};

export type TelegramBinding = {
  id: string;
  role: string;
  moduleKey: string;
  chatId: string;
  enabled: boolean;
};

export type UpsertTelegramBindingPayload = {
  role: string;
  moduleKey: string;
  chatId: string;
  enabled?: boolean;
};

export const companiesService = {
  getFeatures: async (): Promise<CompanyFeatureConfig> => {
    const { data } = await api.get('/companies/features');
    return data;
  },
  updateModule: async (payload: UpdateModulePayload): Promise<CompanyFeatureConfig> => {
    const { data } = await api.patch('/companies/features', payload);
    return data;
  },
  getTelegramBindings: async (): Promise<TelegramBinding[]> => {
    const { data } = await api.get('/companies/me/telegram-bindings');
    return data;
  },
  upsertTelegramBinding: async (payload: UpsertTelegramBindingPayload): Promise<TelegramBinding> => {
    const { data } = await api.patch('/companies/me/telegram-bindings', payload);
    return data;
  },
  removeTelegramBinding: async (payload: { role: string; moduleKey: string }): Promise<{ success: boolean }> => {
    const { data } = await api.delete('/companies/me/telegram-bindings', { data: payload });
    return data;
  },
};
