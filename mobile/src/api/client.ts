import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROD_URL = 'https://tadbirkor-backend-production.up.railway.app/api';
const LOCAL_URL = 'http://192.168.100.52:4002/api';

// Asosiy qilib Localni olamiz, ulanolmasa Railwayga o'tadi
export let currentApiUrl = LOCAL_URL;

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
});

api.interceptors.request.use(
  async (config) => {
    config.baseURL = currentApiUrl; // Har doim joriy manzilni ishlatish
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Agar serverga ulanib bo'lmasa (tarmoq xatosi) va hali qayta urinib ko'rmagan bo'lsak:
    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Manzilni zaxiraga (fallback) o'zgartiramiz
      currentApiUrl = (currentApiUrl === LOCAL_URL) ? PROD_URL : LOCAL_URL;
      console.log('Server javob bermadi, manzil o\'zgartirildi:', currentApiUrl);
      
      originalRequest.baseURL = currentApiUrl;
      return api(originalRequest); // Qayta so'rov yuborish
    }

    // Agar ruxsat xatosi bo'lsa (masalan token eskirgan), tizimdan chiqarish
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // Navigation ni Login ga qaytarish amali App darajasida ushlanadi
    }
    return Promise.reject(error);
  }
);
