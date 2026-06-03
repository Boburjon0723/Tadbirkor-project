import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesService } from '@/services/expenses.service';

export const expenseKeys = {
  all: ['expenses'] as const,
  categories: () => [...expenseKeys.all, 'categories'] as const,
  summary: (from?: string, to?: string) => [...expenseKeys.all, 'summary', from, to] as const,
  list: (filters: Record<string, unknown>) => [...expenseKeys.all, 'list', filters] as const,
};

const defaults = {
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
};

export function useExpenseCategories() {
  return useQuery({
    queryKey: expenseKeys.categories(),
    queryFn: () => expensesService.getCategories(),
    ...defaults,
  });
}

export function useExpenseSummary(from?: string, to?: string) {
  return useQuery({
    queryKey: expenseKeys.summary(from, to),
    queryFn: () => expensesService.getSummary({ from, to }),
    ...defaults,
  });
}

export function useExpenses(filters: {
  status?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: expenseKeys.list(filters),
    queryFn: () => expensesService.list(filters),
    ...defaults,
  });
}

export function useExpenseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.refetchQueries({ queryKey: expenseKeys.all, type: 'active' });
    void qc.invalidateQueries({ queryKey: expenseKeys.all, type: 'inactive' });
  };

  return {
    create: useMutation({
      mutationFn: expensesService.create,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof expensesService.update>[1]) =>
        expensesService.update(id, payload),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: (id: string) => expensesService.approve(id),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        expensesService.reject(id, reason),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => expensesService.remove(id),
      onSuccess: invalidate,
    }),
    createCategory: useMutation({
      mutationFn: expensesService.createCategory,
      onSuccess: invalidate,
    }),
  };
}
