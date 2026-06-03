import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseService } from "@/services/warehouse.service";

export function useWarehouses(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: warehouseService.getWarehouses,
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useStockBalances(
  params?: { warehouseId?: string },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["stock-balances", params ?? {}],
    queryFn: () => warehouseService.getStockBalances(params),
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useStockAvailability(
  variantId?: string,
  params?: { warehouseId?: string },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["stock-availability", variantId, params ?? {}],
    queryFn: () => warehouseService.getStockAvailability(variantId!, params),
    enabled: Boolean(variantId) && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useBatchStockAvailability(
  params?: { warehouseId?: string; variantIds?: string[] },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["stock-availability-batch", params ?? {}],
    queryFn: () =>
      warehouseService.getBatchStockAvailability({
        warehouseId: params?.warehouseId,
        variantIds: params?.variantIds ?? [],
      }),
    enabled: Boolean(params?.variantIds?.length) && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useStockMovements(
  params?: { warehouseId?: string },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["stock-movements", params ?? {}],
    queryFn: () => warehouseService.getStockMovements(params),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useInventoryActions() {
  const queryClient = useQueryClient();

  const adjustMutation = useMutation({
    mutationFn: (dto: any) => warehouseService.adjust(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (dto: any) => warehouseService.transfer(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });

  const recordInMutation = useMutation({
    mutationFn: (dto: any) => warehouseService.recordIn(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
    },
  });

  const recordOutMutation = useMutation({
    mutationFn: (dto: any) => warehouseService.recordOut(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (dto: any) => warehouseService.createWarehouse(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => warehouseService.updateWarehouse(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: (id: string) => warehouseService.deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
      queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-categories"] });
    },
  });

  return {
    createWarehouse: createWarehouseMutation,
    updateWarehouse: updateWarehouseMutation,
    deleteWarehouse: deleteWarehouseMutation,
    adjust: adjustMutation,
    transfer: transferMutation,
    recordIn: recordInMutation,
    recordOut: recordOutMutation,
  };
}
