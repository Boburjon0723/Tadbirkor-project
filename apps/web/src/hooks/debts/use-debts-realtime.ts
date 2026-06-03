'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getInventorySocket } from '@/lib/inventory-socket';

/** Qarz sahifasi: to‘lov qayd/tasdiq va yangi qarz yozuvlari real-time. */
export function useDebtsRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getInventorySocket();
    if (!socket) return;

    const refreshDebts = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void queryClient.refetchQueries({ queryKey: ['debt-partner-groups'], type: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['debt-partner-reports'] });
        void queryClient.invalidateQueries({ queryKey: ['debts'] });
        void queryClient.refetchQueries({ queryKey: ['pending-payment-records'], type: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['partner-balances'] });
        void queryClient.refetchQueries({ queryKey: ['partner-debt-ledger'], type: 'active' });
        void queryClient.refetchQueries({ queryKey: ['debt-detail'], type: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      }, 250);
    };

    socket.on('debts:changed', refreshDebts);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      socket.off('debts:changed', refreshDebts);
    };
  }, [enabled, queryClient]);
}
