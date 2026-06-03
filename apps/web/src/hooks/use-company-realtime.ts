'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getInventorySocket } from '@/lib/inventory-socket';

/** Kompaniya darajasidagi socket yangilanishlari (inventar, buyurtma, dashboard). */
export function useCompanyRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const inventoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ordersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getInventorySocket();
    if (!socket) return;

    const refreshInventory = () => {
      if (inventoryTimerRef.current) clearTimeout(inventoryTimerRef.current);
      inventoryTimerRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['products'] });
        void queryClient.invalidateQueries({ queryKey: ['product-categories'] });
        void queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics-stock'] });
        void queryClient.invalidateQueries({ queryKey: ['reports-bundle'] });
      }, 450);
    };

    const refreshOrders = () => {
      if (ordersTimerRef.current) clearTimeout(ordersTimerRef.current);
      ordersTimerRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['b2b-orders'] });
        void queryClient.invalidateQueries({ queryKey: ['incoming-orders'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics-orders'] });
        void queryClient.invalidateQueries({ queryKey: ['reports-bundle'] });
      }, 450);
    };

    const refreshDashboard = () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['reports-bundle'] });
    };

    socket.on('inventory:changed', refreshInventory);
    socket.on('orders:changed', refreshOrders);
    socket.on('dashboard:refresh', refreshDashboard);

    return () => {
      if (inventoryTimerRef.current) clearTimeout(inventoryTimerRef.current);
      if (ordersTimerRef.current) clearTimeout(ordersTimerRef.current);
      socket.off('inventory:changed', refreshInventory);
      socket.off('orders:changed', refreshOrders);
      socket.off('dashboard:refresh', refreshDashboard);
    };
  }, [enabled, queryClient]);
}
