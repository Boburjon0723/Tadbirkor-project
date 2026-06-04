import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollService } from '@/services/payroll.service';
import type { PayrollLineType, PayrollCurrency } from '@/lib/payroll-types';

export const payrollKeys = {
  all: ['payroll'] as const,
  compensations: () => [...payrollKeys.all, 'compensations'] as const,
  members: () => [...payrollKeys.all, 'members'] as const,
  extras: () => [...payrollKeys.all, 'extras'] as const,
  summary: () => [...payrollKeys.all, 'summary'] as const,
  periods: () => [...payrollKeys.all, 'periods'] as const,
  period: (id: string) => [...payrollKeys.all, 'period', id] as const,
};

const defaults = {
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
};

export function usePayrollSummary() {
  return useQuery({
    queryKey: payrollKeys.summary(),
    queryFn: () => payrollService.getSummary(),
    ...defaults,
  });
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: payrollKeys.periods(),
    queryFn: () => payrollService.listPeriods(),
    ...defaults,
  });
}

export function usePayrollPeriod(id: string) {
  return useQuery({
    queryKey: payrollKeys.period(id),
    queryFn: () => payrollService.getPeriod(id),
    enabled: !!id,
    ...defaults,
  });
}

export function usePayrollCompensations() {
  return useQuery({
    queryKey: payrollKeys.compensations(),
    queryFn: () => payrollService.listCompensations(),
    ...defaults,
  });
}

export function usePayrollMembers() {
  return useQuery({
    queryKey: payrollKeys.members(),
    queryFn: () => payrollService.getMembersForPayroll(),
    retry: false,
    ...defaults,
  });
}

export function usePayrollEmployeeExtras() {
  return useQuery({
    queryKey: payrollKeys.extras(),
    queryFn: () => payrollService.listEmployeeExtras(),
    ...defaults,
  });
}

export function usePayrollMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: payrollKeys.all });
  };

  return {
    createPeriod: useMutation({
      mutationFn: payrollService.createPeriod,
      onSuccess: invalidate,
    }),
    calculatePeriod: useMutation({
      mutationFn: (id: string) => payrollService.calculatePeriod(id),
      onSuccess: invalidate,
    }),
    addAdjustment: useMutation({
      mutationFn: ({
        periodId,
        runId,
        ...payload
      }: {
        periodId: string;
        runId: string;
        type: PayrollLineType;
        label: string;
        amount: number;
      }) => payrollService.addAdjustment(periodId, runId, payload),
      onSuccess: invalidate,
    }),
    approvePeriod: useMutation({
      mutationFn: (id: string) => payrollService.approvePeriod(id),
      onSuccess: invalidate,
    }),
    markPeriodPaid: useMutation({
      mutationFn: (id: string) => payrollService.markPeriodPaid(id),
      onSuccess: invalidate,
    }),
    closePeriod: useMutation({
      mutationFn: (id: string) => payrollService.closePeriod(id),
      onSuccess: invalidate,
    }),
    upsertCompensation: useMutation({
      mutationFn: (payload: {
        companyUserId: string;
        employeeName: string;
        employeeRole: string;
        baseSalary: number;
        currency?: PayrollCurrency;
        effectiveFrom?: string;
      }) => payrollService.upsertCompensation(payload),
      onSuccess: invalidate,
    }),
    addEmployeeAdvance: useMutation({
      mutationFn: payrollService.addEmployeeAdvance,
      onSuccess: invalidate,
    }),
  };
}
