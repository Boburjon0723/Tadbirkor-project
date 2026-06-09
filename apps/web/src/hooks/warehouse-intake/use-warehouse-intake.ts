import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  warehouseIntakeService,
  type WarehouseIntake,
} from '@/services/warehouse-intake.service';

export const INTAKE_LIST_KEY = ['warehouse-intake', 'list'] as const;
export const intakeDetailKey = (id: string) => ['warehouse-intake', id] as const;

export function useWarehouseIntakeList(params?: {
  status?: string;
  warehouseId?: string;
}) {
  return useQuery({
    queryKey: [...INTAKE_LIST_KEY, params ?? {}],
    queryFn: () => warehouseIntakeService.list(params),
    staleTime: 30_000,
  });
}

export function useWarehouseIntake(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: intakeDetailKey(id),
    queryFn: () => warehouseIntakeService.getOne(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
    staleTime: 5_000,
  });
}

export function useIntakeSettings(warehouseId?: string) {
  return useQuery({
    queryKey: ['intake-settings', warehouseId ?? 'company'],
    queryFn: () => warehouseIntakeService.getIntakeSettings(warehouseId),
    staleTime: 60_000,
  });
}

export function useWarehouseIntakeMutations(intakeId?: string) {
  const queryClient = useQueryClient();

  const patchIntakeDetail = (data: WarehouseIntake) => {
    if (intakeId) {
      queryClient.setQueryData(intakeDetailKey(intakeId), data);
    }
  };

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: INTAKE_LIST_KEY });
  };

  const invalidate = async () => {
    invalidateList();
    if (intakeId) {
      await queryClient.invalidateQueries({ queryKey: intakeDetailKey(intakeId) });
    }
  };

  const create = useMutation({
    mutationFn: warehouseIntakeService.create,
    onSuccess: () => invalidate(),
  });

  const scan = useMutation({
    mutationFn: (dto: { barcode: string; quantity?: number }) =>
      warehouseIntakeService.scan(intakeId!, dto),
    onSuccess: (data) => {
      patchIntakeDetail(data);
      invalidateList();
    },
  });

  const quickProduct = useMutation({
    mutationFn: (dto: Parameters<typeof warehouseIntakeService.quickProduct>[1]) =>
      warehouseIntakeService.quickProduct(intakeId!, dto),
    onSuccess: (data) => {
      patchIntakeDetail(data);
      invalidateList();
    },
  });

  const addLine = useMutation({
    mutationFn: (dto: { productVariantId: string; quantity: number }) =>
      warehouseIntakeService.addLine(intakeId!, dto),
    onSuccess: (data) => {
      patchIntakeDetail(data);
      invalidateList();
    },
  });

  const updateLine = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      warehouseIntakeService.updateLine(intakeId!, lineId, quantity),
    onSuccess: (data) => {
      patchIntakeDetail(data);
      invalidateList();
    },
  });

  const removeLine = useMutation({
    mutationFn: (lineId: string) => warehouseIntakeService.removeLine(intakeId!, lineId),
    onSuccess: (data) => {
      patchIntakeDetail(data);
      invalidateList();
    },
  });

  const complete = useMutation({
    mutationFn: () => warehouseIntakeService.complete(intakeId!),
    onSuccess: (data) => {
      patchIntakeDetail(data);
      invalidateList();
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => warehouseIntakeService.cancel(intakeId!),
    onSuccess: () => invalidate(),
  });

  const updateSettings = useMutation({
    mutationFn: warehouseIntakeService.updateIntakeSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intake-settings'] });
      if (intakeId) {
        queryClient.invalidateQueries({ queryKey: intakeDetailKey(intakeId) });
      }
    },
  });

  return {
    create,
    scan,
    quickProduct,
    addLine,
    updateLine,
    removeLine,
    complete,
    cancel,
    updateSettings,
  };
}
