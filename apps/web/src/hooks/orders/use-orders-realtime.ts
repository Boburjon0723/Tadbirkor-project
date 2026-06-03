'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getInventorySocket } from '@/lib/inventory-socket';

/** Buyurtmalar sahifasi: faqat buyurtma statistikasi va ro‘yxat (inventar emas). */
export function useOrdersRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getInventorySocket();
    if (!socket) return;

    const refreshOrders = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['b2b-orders'] });
        void queryClient.invalidateQueries({ queryKey: ['incoming-orders'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }, 600);
    };

    socket.on('orders:changed', refreshOrders);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      socket.off('orders:changed', refreshOrders);
    };
  }, [enabled, queryClient]);
}
