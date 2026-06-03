import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  ordersService,
  CreateOrderDto,
  UpdateDraftOrderDto,
  OrdersListResponse,
} from '@/services/orders.service';

export function useOrders() {
  return useQuery({
    queryKey: ['b2b-orders'],
    queryFn: ordersService.getOrders,
    staleTime: 60 * 1000,
  });
}

export function useIncomingOrders() {
  return useQuery({
    queryKey: ['incoming-orders'],
    queryFn: ordersService.getIncomingOrders,
    staleTime: 60 * 1000,
  });
}

export function useOrdersHubStats() {
  return useQuery({
    queryKey: ['b2b-orders', 'hub-stats'],
    queryFn: ordersService.getOrdersHubStats,
    staleTime: 45 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useOrderDetail(orderId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['b2b-order-detail', orderId],
    queryFn: () => ordersService.getOrderDetail(orderId!),
    enabled: enabled && !!orderId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useOrdersInfinite(
  role: 'my' | 'incoming',
  params: Record<string, unknown>,
  options?: { enabled?: boolean },
) {
  const limit = Number(params.limit) || 30;
  return useInfiniteQuery({
    queryKey: ['b2b-orders', 'infinite', role, params],
    queryFn: ({ pageParam }) => {
      const pageParams = { ...params, page: pageParam, limit };
      return role === 'my'
        ? ordersService.getOrdersPage(pageParams)
        : ordersService.getIncomingOrdersPage(pageParams);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: OrdersListResponse) =>
      lastPage?.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function flattenOrdersPages(
  data: ReturnType<typeof useOrdersInfinite>['data'],
): any[] {
  if (!data?.pages?.length) return [];
  return data.pages.flatMap((page) => page.items || []);
}

export function useOrderActions() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['b2b-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['incoming-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['b2b-order-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const createOrderMutation = useMutation({
    mutationFn: (dto: CreateOrderDto) => ordersService.createOrder(dto),
    onSuccess: invalidateAll,
  });

  const updateDraftOrderMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDraftOrderDto }) =>
      ordersService.updateDraftOrder(id, dto),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['b2b-order-detail'] });
    },
  });

  const sendOrderMutation = useMutation({
    mutationFn: (id: string) => ordersService.sendOrder(id),
    onSuccess: invalidateAll,
  });

  const acceptIncomingMutation = useMutation({
    mutationFn: (payload: string | { id: string; allowPartial?: boolean }) => {
      if (typeof payload === 'string') {
        return ordersService.acceptIncomingOrder(payload);
      }
      return ordersService.acceptIncomingOrder(payload.id, {
        allowPartial: payload.allowPartial,
      });
    },
    onSuccess: invalidateAll,
  });

  const rejectIncomingMutation = useMutation({
    mutationFn: (id: string) => ordersService.rejectIncomingOrder(id),
    onSuccess: invalidateAll,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id: string) => ordersService.cancelOrder(id),
    onSuccess: invalidateAll,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => ordersService.deleteOrder(id),
    onSuccess: invalidateAll,
  });

  const closeRemainderMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'my' | 'incoming' }) =>
      ordersService.closeOrderRemainder(id, role),
    onSuccess: invalidateAll,
  });

  const mapIncomingItemMutation = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      ownProductVariantId,
      sellerPrice,
      sellerCurrency,
    }: {
      orderId: string;
      itemId: string;
      ownProductVariantId: string;
      sellerPrice?: number;
      sellerCurrency?: 'UZS' | 'USD';
    }) =>
      ordersService.mapIncomingOrderItem(orderId, itemId, {
        ownProductVariantId,
        sellerPrice,
        sellerCurrency,
      }),
    onSuccess: invalidateAll,
  });

  return {
    createOrder: createOrderMutation,
    updateDraftOrder: updateDraftOrderMutation,
    sendOrder: sendOrderMutation,
    acceptIncoming: acceptIncomingMutation,
    rejectIncoming: rejectIncomingMutation,
    cancelOrder: cancelOrderMutation,
    deleteOrder: deleteOrderMutation,
    mapIncomingItem: mapIncomingItemMutation,
    closeRemainder: closeRemainderMutation,
  };
}
