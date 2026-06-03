import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { debtsService } from "@/services/debts.service";

export function useDebts(params?: {
  tab?: 'receivable' | 'payable';
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['debt-partner-groups', params],
    queryFn: () => debtsService.getPartnerGroups(params),
  });
}

export function usePartnerReportArchive(
  params?: {
    tab?: 'receivable' | 'payable';
    search?: string;
    page?: number;
    limit?: number;
    settledOnly?: boolean;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: ['debt-partner-reports', params],
    queryFn: () => debtsService.getPartnerReportArchive(params),
    enabled,
  });
}

export function usePartnerBalances() {
  return useQuery({
    queryKey: ["partner-balances"],
    queryFn: debtsService.getPartnerBalances,
  });
}

export function usePendingPaymentRecords() {
  return useQuery({
    queryKey: ['pending-payment-records'],
    queryFn: debtsService.getPendingPaymentRecords,
  });
}

export function useDebtDetail(id: string | null) {
  return useQuery({
    queryKey: ["debt-detail", id],
    queryFn: () => debtsService.getDebtDetail(id!),
    enabled: !!id,
  });
}

export function usePartnerDebtLedger(partnerCompanyId: string | null) {
  return useQuery({
    queryKey: ["partner-debt-ledger", partnerCompanyId],
    queryFn: () => debtsService.getPartnerLedger(partnerCompanyId!),
    enabled: !!partnerCompanyId,
  });
}

export function useDebtActions() {
  const queryClient = useQueryClient();

  const invalidateFinancials = () => {
    void queryClient.refetchQueries({ queryKey: ['debt-partner-groups'], type: 'active' });
    void queryClient.refetchQueries({ queryKey: ['pending-payment-records'], type: 'active' });
    void queryClient.refetchQueries({ queryKey: ['partner-debt-ledger'], type: 'active' });
    void queryClient.invalidateQueries({ queryKey: ['debt-partner-reports'] });
    void queryClient.invalidateQueries({ queryKey: ['debts'] });
    void queryClient.invalidateQueries({ queryKey: ["partner-balances"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const createPayment = useMutation({
    mutationFn: debtsService.createPaymentRecord,
    onSuccess: invalidateFinancials,
  });

  const applyPaymentByCreditor = useMutation({
    mutationFn: debtsService.applyPaymentByCreditor,
    onSuccess: invalidateFinancials,
  });

  const recordPartnerBulkPayment = useMutation({
    mutationFn: debtsService.recordPartnerBulkPayment,
    onSuccess: invalidateFinancials,
  });

  const confirmPartnerBulkPayments = useMutation({
    mutationFn: debtsService.confirmPartnerBulkPayments,
    onSuccess: invalidateFinancials,
  });

  const confirmPayment = useMutation({
    mutationFn: debtsService.confirmPayment,
    onSuccess: invalidateFinancials,
  });

  const rejectPayment = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      debtsService.rejectPayment(id, reason),
    onSuccess: invalidateFinancials,
  });

  return {
    createPayment,
    applyPaymentByCreditor,
    recordPartnerBulkPayment,
    confirmPartnerBulkPayments,
    confirmPayment,
    rejectPayment,
  };
}
