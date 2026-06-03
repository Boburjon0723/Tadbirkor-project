'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getInventorySocket } from '@/lib/inventory-socket';

/** Ombor sahifasi: inventar o‘zgarishlarida faqat tegishli cache yangilanadi */
export function useInventoryRealtime(enabled = true, warehouseId?: string) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wh = (warehouseId || '').trim();

  useEffect(() => {
    if (!enabled) return;

    const socket = getInventorySocket();
    if (!socket) return;

    const refresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void queryClient.refetchQueries({
          queryKey: ['products', 'infinite'],
          predicate: (query) => {
            if (!wh) return true;
            const params = query.queryKey[2];
            if (!params || typeof params !== 'object') return false;
            return (params as Record<string, unknown>).warehouseId === wh;
          },
          type: 'active',
        });
        void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
        if (wh) {
          void queryClient.invalidateQueries({
            queryKey: ['product-categories', wh],
          });
          void queryClient.invalidateQueries({
            queryKey: ['stock-balances', { warehouseId: wh }],
          });
        } else {
          void queryClient.invalidateQueries({ queryKey: ['product-categories'] });
          void queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
        }
      }, 300);
    };

    socket.on('inventory:changed', refresh);
    socket.on('dashboard:refresh', refresh);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      socket.off('inventory:changed', refresh);
      socket.off('dashboard:refresh', refresh);
    };
  }, [enabled, queryClient, wh]);
}
