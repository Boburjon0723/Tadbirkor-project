import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incomeService } from '@/services/income.service';

export const incomeKeys = {
  all: ['income'] as const,
  categories: () => [...incomeKeys.all, 'categories'] as const,
  list: (filters: Record<string, unknown>) => [...incomeKeys.all, 'list', filters] as const,
};

const defaults = {
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
};

export function useIncomeCategories() {
  return useQuery({
    queryKey: incomeKeys.categories(),
    queryFn: () => incomeService.getCategories(),
    ...defaults,
  });
}

export function useIncomes(filters: {
  categoryId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: incomeKeys.list(filters),
    queryFn: () => incomeService.list(filters),
    ...defaults,
  });
}

export function useIncomeMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.refetchQueries({ queryKey: incomeKeys.all, type: 'active' });
    void qc.invalidateQueries({ queryKey: incomeKeys.all, type: 'inactive' });
  };

  return {
    create: useMutation({
      mutationFn: incomeService.create,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof incomeService.update>[1]) =>
        incomeService.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => incomeService.remove(id),
      onSuccess: invalidate,
    }),
  };
}
