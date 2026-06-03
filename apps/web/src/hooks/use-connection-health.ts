'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getInventorySocket } from '@/lib/inventory-socket';
import { getNotificationsSocket } from '@/lib/notifications-socket';
import { toast } from '@/lib/toast';

export type ConnectionIssue = 'offline' | 'server' | 'socket';

/** Platformada kamida shuncha vaqt bo‘lgach ulanish uzilganda ogohlantiramiz */
const MIN_ACTIVE_MS = Number(process.env.NEXT_PUBLIC_CONN_MIN_ACTIVE_MS || 2 * 60 * 1000);
/** Tab yashirin bo‘lgach qaytishda tekshiruv */
const HIDDEN_RESUME_MS = Number(process.env.NEXT_PUBLIC_CONN_HIDDEN_MS || 2 * 60 * 1000);
/** Fon tekshiruvi (tab ochiq) */
const PROBE_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_CONN_PROBE_MS || 90 * 1000);

async function probeApi(): Promise<'ok' | 'offline' | 'server' | 'auth'> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  try {
    await api.get('/auth/me', { timeout: 10_000 });
    return 'ok';
  } catch (err: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) return 'auth';
    if (!status || status >= 500) return 'server';
    return 'server';
  }
}

export function useConnectionHealth(enabled: boolean) {
  const [issue, setIssue] = useState<ConnectionIssue | null>(null);
  const activeSinceRef = useRef(Date.now());
  const hiddenAtRef = useRef<number | null>(null);
  const toastShownRef = useRef(false);

  const isActiveLongEnough = useCallback(
    () => Date.now() - activeSinceRef.current >= MIN_ACTIVE_MS,
    [],
  );

  const clearIssue = useCallback(() => {
    setIssue(null);
    toastShownRef.current = false;
  }, []);

  const reportIssue = useCallback(
    (kind: ConnectionIssue) => {
      if (!isActiveLongEnough()) return;
      setIssue(kind);
      if (toastShownRef.current) return;
      toastShownRef.current = true;
      toast.warning(
        'Aloqa uzildi yoki eskirgan. Ma’lumotlar yangilanmasligi mumkin — sahifani yangilang.',
        { duration: 12_000 },
      );
    },
    [isActiveLongEnough],
  );

  const runProbe = useCallback(async () => {
    if (!enabled) return;
    const result = await probeApi();
    if (result === 'ok') {
      clearIssue();
      return;
    }
    if (result === 'auth') {
      clearIssue();
      return;
    }
    if (result === 'offline') reportIssue('offline');
    else reportIssue('server');
  }, [enabled, clearIssue, reportIssue]);

  useEffect(() => {
    if (!enabled) {
      clearIssue();
      return;
    }

    activeSinceRef.current = Date.now();

    const onOffline = () => reportIssue('offline');
    const onOnline = () => void runProbe();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current == null) return;
      const hiddenMs = Date.now() - hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenMs >= HIDDEN_RESUME_MS) void runProbe();
    };

    const onSocketDisconnect = (reason: string) => {
      if (reason === 'io client disconnect') return;
      reportIssue('socket');
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    const inventorySocket = getInventorySocket();
    const notificationsSocket = getNotificationsSocket();
    inventorySocket?.on('disconnect', onSocketDisconnect);
    notificationsSocket?.on('disconnect', onSocketDisconnect);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void runProbe();
    }, PROBE_INTERVAL_MS);

    void runProbe();

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
      inventorySocket?.off('disconnect', onSocketDisconnect);
      notificationsSocket?.off('disconnect', onSocketDisconnect);
    };
  }, [enabled, clearIssue, reportIssue, runProbe]);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  return { issue, refresh, clearIssue };
}
