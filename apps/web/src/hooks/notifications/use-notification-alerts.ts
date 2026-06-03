'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getNotificationsSocket } from '@/lib/notifications-socket';
import {
  playSystemNotificationSound,
  unlockNotificationAudio,
} from '@/lib/browser-notification';
import { notificationsService } from '@/services/notifications.service';

type NotificationPayload = {
  id?: string;
  title?: string;
  message?: string;
  isRead?: boolean;
};

/** Yangi bildirishnomada in-app ovoz + tizim toast (ruxsat bo‘lsa). */
export function useNotificationAlerts(enabled = true) {
  const queryClient = useQueryClient();
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const unlockOnce = () => {
      unlockNotificationAudio();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce);
    const socket = getNotificationsSocket();
    if (!socket) return;

    let cancelled = false;

    const syncUnreadBaseline = async () => {
      try {
        const count = Number(await notificationsService.getUnreadCount());
        if (!cancelled) prevUnreadRef.current = count;
      } catch {
        // ignore
      }
    };

    void syncUnreadBaseline();

    const onNew = (notif: NotificationPayload) => {
      if (!notif?.id || notif.isRead) return;

      playSystemNotificationSound({
        title: String(notif.title || 'Yangi bildirishnoma'),
        message: String(notif.message || ''),
        tag: `axis-notif-${notif.id}`,
      });

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    };

    const onRefresh = async () => {
      try {
        const count = Number(await notificationsService.getUnreadCount());
        const prev = prevUnreadRef.current;
        if (prev !== null && count > prev) {
          playSystemNotificationSound({
            title: 'Yangi bildirishnoma',
            message: 'Tadbirkor — yangi xabar keldi',
            tag: 'axis-notif-batch',
          });
        }
        prevUnreadRef.current = count;
      } catch {
        // ignore
      }

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    };

    socket.on('notification:new', onNew);
    socket.on('notification:refresh', onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
      socket.off('notification:new', onNew);
      socket.off('notification:refresh', onRefresh);
    };
  }, [queryClient, enabled]);
}
