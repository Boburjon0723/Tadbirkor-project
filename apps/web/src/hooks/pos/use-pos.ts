import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  posService,
  CreatePosSaleDto,
  CheckoutPosSaleDto,
  QuickCheckoutPosSaleDto,
  type PosCatalogResponse,
} from "@/services/pos.service";
import { posCustomerPickerKey } from "@/hooks/pos/use-pos-customer-picker";

export function usePosCatalog(
  warehouseId: string | null | undefined,
  search?: string,
  options?: { enabled?: boolean },
) {
  const wh = (warehouseId || '').trim();
  const q = (search || '').trim();
  return useQuery({
    queryKey: ['pos-catalog', wh, q],
    queryFn: () =>
      posService.getCatalog({
        warehouseId: wh,
        search: q || undefined,
        limit: 120,
        page: 1,
      }),
    enabled: (options?.enabled ?? true) && !!wh,
    staleTime: 20 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function usePosSummary(cashierId?: string) {
  return useQuery({
    queryKey: ["pos-summary", cashierId],
    queryFn: () => posService.summaryToday(cashierId),
  });
}

export function usePosSales(params?: any) {
  return useQuery({
    queryKey: ["pos-sales", params],
    queryFn: () => posService.findAll(params),
  });
}

export function usePosActions() {
  const queryClient = useQueryClient();

  const refreshPosAfterSale = () => {
    // Optimistic catalog update is enough for instant UI; refetch in background.
    window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['pos-summary'] });
      void queryClient.invalidateQueries({ queryKey: posCustomerPickerKey });
      void queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['pos-sales'] });
    }, 0);
  };

  const createSaleMutation = useMutation({
    mutationFn: (dto: CreatePosSaleDto) => posService.createSale(dto),
    onSuccess: refreshPosAfterSale,
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CheckoutPosSaleDto }) =>
      posService.checkout(id, dto),
    onSuccess: refreshPosAfterSale,
  });

  const quickCheckoutMutation = useMutation({
    mutationFn: (dto: QuickCheckoutPosSaleDto) => posService.quickCheckout(dto),
    onSuccess: (_data, dto) => {
      const wh = (dto.warehouseId || '').trim();
      const sold = new Map(
        (dto.items || []).map((i) => [i.productVariantId, Number(i.quantity)]),
      );
      if (wh && sold.size > 0) {
        queryClient.setQueriesData<PosCatalogResponse>(
          { queryKey: ['pos-catalog', wh] },
          (old) => {
            if (!old?.items?.length) return old;
            const items = old.items
              .map((item) => ({
                ...item,
                quantity: Math.max(
                  0,
                  item.quantity - (sold.get(item.id) ?? 0),
                ),
              }))
              .filter((item) => item.quantity > 0);
            return { ...old, items, total: items.length };
          },
        );
      }
      refreshPosAfterSale();
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { reason: string } }) => 
      posService.voidSale(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pos-sales"] });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (id: string) => posService.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-sales"] });
    },
  });

  return {
    createSale: createSaleMutation,
    checkout: checkoutMutation,
    quickCheckout: quickCheckoutMutation,
    voidSale: voidMutation,
    deleteDraft: deleteDraftMutation,
  };
}
