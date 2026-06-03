'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { retailCustomersService } from '@/services/retail-customers.service';

export const posCustomerPickerKey = ['pos-customer-picker'] as const;

export function usePrefetchPosCustomers() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.prefetchQuery({
      queryKey: [...posCustomerPickerKey, ''],
      queryFn: () => retailCustomersService.posPicker(),
      staleTime: 60_000,
    });
  };
}

export function usePosCustomerPicker(search: string) {
  const debounced = useDebouncedValue(search.trim(), 150);
  return useQuery({
    queryKey: [...posCustomerPickerKey, debounced],
    queryFn: () => retailCustomersService.posPicker(debounced || undefined),
    staleTime: debounced ? 20_000 : 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}
