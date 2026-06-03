'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { retailCustomersService } from '@/services/retail-customers.service';

export const retailCustomersSummaryKey = ['retail-customers', 'summary'] as const;
export const retailCustomerLedgerKey = (id: string) =>
  ['retail-customers', 'ledger', id] as const;

export function useRetailCustomersSummary() {
  return useQuery({
    queryKey: retailCustomersSummaryKey,
    queryFn: () => retailCustomersService.findAllSummary(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useRetailCustomerLedger(customerId: string | null) {
  return useQuery({
    queryKey: retailCustomerLedgerKey(customerId || ''),
    queryFn: () => retailCustomersService.getLedger(customerId!),
    enabled: !!customerId,
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useInvalidateRetailCustomers() {
  const queryClient = useQueryClient();
  return (customerId?: string) => {
    void queryClient.invalidateQueries({ queryKey: retailCustomersSummaryKey });
    if (customerId) {
      void queryClient.invalidateQueries({
        queryKey: retailCustomerLedgerKey(customerId),
      });
    }
  };
}
