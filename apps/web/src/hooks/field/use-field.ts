import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fieldService } from '@/services/field.service';

export const fieldKeys = {
  all: ['field'] as const,
  tasks: (status?: string) => [...fieldKeys.all, 'tasks', status ?? 'all'] as const,
  task: (id: string) => [...fieldKeys.all, 'task', id] as const,
  myTasks: () => [...fieldKeys.all, 'my-tasks'] as const,
  myHistory: () => [...fieldKeys.all, 'my-history'] as const,
  myStock: () => [...fieldKeys.all, 'my-stock'] as const,
  kpi: (from?: string, to?: string) => [...fieldKeys.all, 'kpi', from, to] as const,
  workerBalances: () => [...fieldKeys.all, 'worker-balances'] as const,
};

const fieldQueryDefaults = {
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
};

export function useFieldTasks(status?: string) {
  return useQuery({
    queryKey: fieldKeys.tasks(status),
    queryFn: () => fieldService.listTasks(status ? { status } : undefined),
    ...fieldQueryDefaults,
  });
}

export function useMyFieldTasks() {
  return useQuery({
    queryKey: fieldKeys.myTasks(),
    queryFn: () => fieldService.myTasks(),
    ...fieldQueryDefaults,
  });
}

export function useMyFieldHistory() {
  return useQuery({
    queryKey: fieldKeys.myHistory(),
    queryFn: () => fieldService.myHistory(),
    ...fieldQueryDefaults,
  });
}

export function useMyFieldStock() {
  return useQuery({
    queryKey: fieldKeys.myStock(),
    queryFn: () => fieldService.myStock(),
    ...fieldQueryDefaults,
  });
}

export function useFieldTask(id: string | undefined) {
  return useQuery({
    queryKey: fieldKeys.task(id || ''),
    queryFn: () => fieldService.myTask(id!),
    enabled: Boolean(id),
    ...fieldQueryDefaults,
  });
}

export function useFieldKpi(from?: string, to?: string) {
  return useQuery({
    queryKey: fieldKeys.kpi(from, to),
    queryFn: () => fieldService.kpi(from, to),
    ...fieldQueryDefaults,
  });
}

export function useFieldWorkerBalances() {
  return useQuery({
    queryKey: fieldKeys.workerBalances(),
    queryFn: () => fieldService.workerBalances(),
    ...fieldQueryDefaults,
  });
}

export function useFieldMutations() {
  const queryClient = useQueryClient();

  const invalidateField = () => {
    queryClient.invalidateQueries({ queryKey: fieldKeys.all });
  };

  const acceptTask = useMutation({
    mutationFn: (id: string) => fieldService.acceptTask(id),
    onSuccess: invalidateField,
  });

  const submitReport = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      fieldService.submitReport(id, payload),
    onSuccess: invalidateField,
  });

  const approveTask = useMutation({
    mutationFn: (id: string) => fieldService.approveTask(id),
    onSuccess: invalidateField,
  });

  const rejectTask = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fieldService.rejectTask(id, reason),
    onSuccess: invalidateField,
  });

  return { acceptTask, submitReport, approveTask, rejectTask, invalidateField };
}
