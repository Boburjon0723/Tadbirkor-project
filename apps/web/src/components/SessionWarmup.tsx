'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchSession } from '@/hooks/use-session';

/** Ilova ochilganda sessiyani oldindan yuklash — dashboard kutishini qisqartiradi */
export function SessionWarmup() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void prefetchSession(queryClient);
  }, [queryClient]);

  return null;
}
