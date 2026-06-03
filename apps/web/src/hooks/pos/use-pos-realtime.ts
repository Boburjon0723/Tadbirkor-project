'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getInventorySocket } from '@/lib/inventory-socket';

type InventoryChangedPayload = {
  warehouseId?: string;
  productVariantId?: string;
  reason?: string;
};

/** POS: katalog yangilanishi (debounce); ombor bilan qoldiq sinxroni */
export function usePosRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ all: boolean; warehouses: Set<string> }>({
    all: false,
    warehouses: new Set(),
  });

  useEffect(() => {
    if (!enabled) return;

    const socket = getInventorySocket();
    if (!socket) return;

    const refreshCatalog = (payload?: InventoryChangedPayload) => {
      const wid = String(payload?.warehouseId || '').trim();
      if (!wid) pendingRef.current.all = true;
      else pendingRef.current.warehouses.add(wid);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const { all, warehouses } = pendingRef.current;
        pendingRef.current = { all: false, warehouses: new Set() };
        void queryClient.invalidateQueries({
          queryKey: ['pos-catalog'],
          predicate: (q) => {
            if (all || warehouses.size === 0) return true;
            const wh = String(q.queryKey[1] || '');
            return warehouses.has(wh);
          },
        });
      }, 450);
    };

    socket.on('inventory:changed', refreshCatalog);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      socket.off('inventory:changed', refreshCatalog);
    };
  }, [enabled, queryClient]);
}
