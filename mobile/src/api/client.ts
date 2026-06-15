import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveApiBaseUrl } from './config';

export let currentApiUrl = resolveApiBaseUrl();

if (__DEV__) {
  console.log('[API] Backend manzili:', currentApiUrl);
}

export const fixImageUrl = (url: string | undefined | null) => {
  if (!url) return null;
  if (url.includes('localhost:')) {
    const baseUrl = currentApiUrl.replace('/api', '');
    return url.replace(/http:\/\/localhost:\d+/, baseUrl);
  }
  return url;
};

export const api = axios.create({
  baseURL: currentApiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

api.interceptors.request.use(
  async (config) => {
    config.baseURL = currentApiUrl;
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  },
);
