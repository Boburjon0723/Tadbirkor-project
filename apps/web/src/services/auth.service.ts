import { api } from '../lib/api';
import { setAuthToken, clearAuthToken } from '../lib/auth-token';
import { disconnectNotificationsSocket } from '../lib/notifications-socket';

function persistAuthSession(data: { access_token?: string; user?: unknown }) {
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }
}

export const authService = {
  login: async (login: string, password: string) => {
    const { data } = await api.post('/auth/login', { login, password });
    persistAuthSession(data);
    return data;
  },

  register: async (data: {
    fullName: string;
    login: string;
    password: string;
    companyName: string;
    tin?: string;
    email?: string;
    phone?: string;
  }) => {
    const response = await api.post('/auth/register', {
      fullName: data.fullName,
      login: data.login,
      password: data.password,
      companyName: data.companyName,
      tin: data.tin,
      email: data.email,
      phone: data.phone,
    });
    persistAuthSession(response.data);
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Cookie tozalangan bo'lsa ham chiqamiz
    }
    clearAuthToken();
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    disconnectNotificationsSocket();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getMe: async () => {
    const { data } = await api.get('/auth/me');
    if (data.company) {
      localStorage.setItem('company', JSON.stringify(data.company));
    }
    return data;
  },

  inviteUser: async (data: any) => {
    const response = await api.post('/auth/invite', data);
    return response.data;
  },

  /** Parolni unutdim — server bir martalik Telegram havola kodi beradi */
  getPasswordResetTelegramLink: async (login?: string) => {
    const trimmed = login?.trim();
    const { data } = await api.post<{ botUrl: string; startUrl: string; instructions?: string }>(
      '/auth/password-reset/telegram-link',
      trimmed ? { login: trimmed } : {},
    );
    return data;
  },
};
