import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatchesService } from "@/services/dispatches.service";
import { receiptsService } from "@/services/receipts.service";

export function useDispatches(params?: Record<string, any>) {
  return useQuery({
    queryKey: ["dispatches", params],
    queryFn: () => dispatchesService.getDispatches(params),
  });
}

export function useDispatchActions() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    queryClient.invalidateQueries({ queryKey: ["pick-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["b2b-orders"] });
    queryClient.invalidateQueries({ queryKey: ["incoming-orders"] });
    queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
    queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const createDispatch = useMutation({
    mutationFn: dispatchesService.createDispatch,
    retry: false,
    onSuccess: invalidateAll,
  });

  const createAndSendDispatch = useMutation({
    mutationFn: dispatchesService.createAndSendDispatch,
    retry: false,
    onSuccess: invalidateAll,
  });

  const sendDispatch = useMutation({
    mutationFn: dispatchesService.sendDispatch,
    retry: false,
    onSuccess: invalidateAll,
  });

  const cancelDispatch = useMutation({
    mutationFn: dispatchesService.cancelDispatch,
    retry: false,
    onSuccess: invalidateAll,
  });

  return {
    createDispatch,
    createAndSendDispatch,
    sendDispatch,
    cancelDispatch,
  };
}

export function useGoodsReceipts(params?: Record<string, any>) {
  return useQuery({
    queryKey: ["goods-receipts", params],
    queryFn: () => receiptsService.getReceipts(params),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useReceiptActions() {
  const queryClient = useQueryClient();

  const invalidateAll = (receiptId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
    if (receiptId) {
      queryClient.invalidateQueries({ queryKey: ["goods-receipt", receiptId] });
    }
    queryClient.invalidateQueries({ queryKey: ["b2b-orders"] });
    queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
    queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
    queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    queryClient.invalidateQueries({ queryKey: ["debt-entries"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const acceptReceipt = useMutation({
    mutationFn: ({
      id,
      warehouseId,
      items,
    }: {
      id: string;
      warehouseId: string;
      items?: Array<{ itemId: string; receivedQuantity: number }>;
    }) => receiptsService.acceptReceipt(id, { warehouseId, items }),
    retry: false,
    onSuccess: (_data, vars) => invalidateAll(vars.id),
  });

  const rejectReceipt = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      receiptsService.rejectReceipt(id, reason),
    retry: false,
    onSuccess: (_data, vars) => invalidateAll(vars.id),
  });

  const partialAcceptReceipt = useMutation({
    mutationFn: ({ id, warehouseId, items, note }: { id: string; warehouseId: string; items: any[]; note?: string }) => 
      receiptsService.partialAcceptReceipt(id, { warehouseId, items, note }),
    retry: false,
    onSuccess: (_data, vars) => invalidateAll(vars.id),
  });

  return {
    acceptReceipt,
    rejectReceipt,
    partialAcceptReceipt,
  };
}
