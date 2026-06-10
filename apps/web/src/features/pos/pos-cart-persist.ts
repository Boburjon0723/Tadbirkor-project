import type { CartSession } from './usePosMultiCart';

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'axis-pos-cart';

export type PersistedPosCart = {
  version: number;
  sessions: CartSession[];
  activeId: string;
  savedAt: string;
};

export function posCartStorageKey(
  companyId: string,
  userId: string,
  warehouseId: string,
): string {
  return `${STORAGE_PREFIX}:v${STORAGE_VERSION}:${companyId}:${userId}:${warehouseId}`;
}

export function loadPosCart(key: string): PersistedPosCart | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPosCart;
    if (parsed?.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(parsed.sessions) || !parsed.sessions.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePosCart(
  key: string,
  data: Pick<PersistedPosCart, 'sessions' | 'activeId'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedPosCart = {
      version: STORAGE_VERSION,
      sessions: data.sessions,
      activeId: data.activeId,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // localStorage to'lgan yoki bloklangan
  }
}

export function clearPosCart(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
