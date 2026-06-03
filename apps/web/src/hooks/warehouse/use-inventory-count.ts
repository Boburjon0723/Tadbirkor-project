import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryCountService } from "@/services/inventory-count.service";

export function useInventoryCounts(params?: { status?: string; warehouseId?: string }) {
  return useQuery({
    queryKey: ["inventory-counts", params],
    queryFn: () => inventoryCountService.list(params),
  });
}

export function useInventoryCount(id: string | undefined) {
  return useQuery({
    queryKey: ["inventory-count", id],
    queryFn: () => inventoryCountService.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useInventoryCountActions() {
  const queryClient = useQueryClient();

  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
    if (id) queryClient.invalidateQueries({ queryKey: ["inventory-count", id] });
    queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
  };

  const start = useMutation({
    mutationFn: inventoryCountService.start,
    onSuccess: invalidate,
  });

  const recordCount = useMutation({
    mutationFn: ({ itemId, countedQuantity }: { itemId: string; countedQuantity: number }) =>
      inventoryCountService.recordCount(itemId, countedQuantity),
    onSuccess: () => invalidate(),
  });

  const scan = useMutation({
    mutationFn: ({
      countId,
      barcode,
      countedQuantity,
    }: {
      countId: string;
      barcode: string;
      countedQuantity: number;
    }) => inventoryCountService.scan(countId, { barcode, countedQuantity }),
    onSuccess: () => invalidate(),
  });

  const approveItem = useMutation({
    mutationFn: (itemId: string) => inventoryCountService.approveItem(itemId),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (id: string) => inventoryCountService.complete(id),
    onSuccess: (_d, id) => invalidate(id),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => inventoryCountService.cancel(id),
    onSuccess: invalidate,
  });

  return { start, recordCount, scan, approveItem, complete, cancel };
}
