const TOKEN_STORAGE_KEY = 'axis_access_token';

function readFrom(storage: Storage): string | null {
  try {
    return storage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeTo(storage: Storage, token: string | null) {
  try {
    if (token) {
      storage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      storage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Eski sessionStorage tokenini localStorage ga ko‘chirish (PWA qayta ochilganda login so‘ramaslik uchun) */
function migrateLegacyToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromSession = readFrom(sessionStorage);
  if (!fromSession) return null;
  const fromLocal = readFrom(localStorage);
  if (!fromLocal) {
    writeTo(localStorage, fromSession);
  }
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  return fromLocal || fromSession;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const local = readFrom(localStorage);
  if (local) return local;
  return migrateLegacyToken();
}

export function setAuthToken(token: string | null | undefined) {
  if (typeof window === 'undefined') return;
  if (token) {
    writeTo(localStorage, token);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    clearAuthToken();
  }
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  writeTo(localStorage, null);
  writeTo(sessionStorage, null);
}
