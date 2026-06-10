'use client';

import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { ConnectionHealthMonitor } from '@/components/ConnectionHealthMonitor';
import { SessionWarmup } from '@/components/SessionWarmup';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: unknown) => {
              const status = (error as { response?: { status?: number } })
                ?.response?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 1;
            },
            placeholderData: keepPreviousData,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <SessionWarmup />
        <ConnectionHealthMonitor />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            className: 'font-bold',
          }}
        />
      </ConfirmProvider>
    </QueryClientProvider>
  );
}
