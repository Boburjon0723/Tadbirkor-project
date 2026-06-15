import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PROD_API_URL = 'https://tadbirkor-backend-production.up.railway.app/api';

/** Kompyuteringizning LAN IP manzili — `ipconfig` (Win) yoki `ifconfig` (Mac) */
const DEV_LAN_FALLBACK = 'http://192.168.100.52:4003/api';

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function resolveDevDefault(): string {
  if (Platform.OS === 'android') {
    // Emulator: host mashina
    if (!Constants.isDevice) {
      return 'http://10.0.2.2:4003/api';
    }
    return DEV_LAN_FALLBACK;
  }
  // iOS simulator localhost ishlaydi; fizik qurilma uchun .env da LAN IP ko'rsating
  return Constants.isDevice ? DEV_LAN_FALLBACK : 'http://localhost:4003/api';
}

export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return normalizeApiUrl(fromEnv);
  }
  if (__DEV__) {
    return resolveDevDefault();
  }
  return PROD_API_URL;
}

export const API_URLS = {
  production: PROD_API_URL,
  devLanFallback: DEV_LAN_FALLBACK,
};
