import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pickingService } from "@/services/picking.service";

export function usePickTasks(params?: { status?: string; warehouseId?: string }) {
  return useQuery({
    queryKey: ["pick-tasks", params],
    queryFn: () => pickingService.listPickTasks(params),
  });
}

export function useDispatchPickTasks(dispatchId: string | undefined) {
  return useQuery({
    queryKey: ["pick-tasks", "dispatch", dispatchId],
    queryFn: () => pickingService.getDispatchPickTasks(dispatchId!),
    enabled: Boolean(dispatchId),
  });
}

export function usePickTaskActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pick-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    queryClient.invalidateQueries({ queryKey: ["b2b-orders"] });
    queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    queryClient.invalidateQueries({ queryKey: ["stock-availability"] });
    queryClient.invalidateQueries({ queryKey: ["stock-availability-batch"] });
  };

  const scan = useMutation({
    mutationFn: ({ taskId, ...payload }: { taskId: string; barcode: string; quantity?: number }) =>
      pickingService.scanPickTask(taskId, payload),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (taskId: string) => pickingService.completePickTask(taskId),
    onSuccess: invalidate,
  });

  return { scan, complete };
}
