import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partnerLedgerService } from '@/services/partner-ledger.service';

export const partnerLedgerKeys = {
  all: ['partner-ledger'] as const,
  summary: () => [...partnerLedgerKeys.all, 'summary'] as const,
  contacts: (search?: string) => [...partnerLedgerKeys.all, 'contacts', search ?? ''] as const,
  contactsSelect: (search?: string) =>
    [...partnerLedgerKeys.all, 'contacts-select', search ?? ''] as const,
  contact: (id: string) => [...partnerLedgerKeys.all, 'contact', id] as const,
  operations: (id: string) => [...partnerLedgerKeys.all, 'operations', id] as const,
  history: (id: string) => [...partnerLedgerKeys.all, 'history', id] as const,
  saleCatalog: (warehouseId: string, search: string) =>
    [...partnerLedgerKeys.all, 'sale-catalog', warehouseId, search] as const,
};

const defaults = { staleTime: 45 * 1000, gcTime: 5 * 60 * 1000 };

export function usePartnerLedgerSummary() {
  return useQuery({
    queryKey: partnerLedgerKeys.summary(),
    queryFn: () => partnerLedgerService.getSummary(),
    ...defaults,
  });
}

export function usePartnerLedgerContacts(search?: string) {
  return useQuery({
    queryKey: partnerLedgerKeys.contacts(search),
    queryFn: () => partnerLedgerService.listContacts(search),
    ...defaults,
  });
}

export function usePartnerLedgerContactsSelect(search?: string) {
  return useQuery({
    queryKey: partnerLedgerKeys.contactsSelect(search),
    queryFn: () => partnerLedgerService.listContactsForSelect(search),
    ...defaults,
  });
}

export function usePartnerLedgerContact(contactId: string | null) {
  return useQuery({
    queryKey: partnerLedgerKeys.contact(contactId || ''),
    queryFn: () => partnerLedgerService.getContact(contactId!),
    enabled: Boolean(contactId),
    ...defaults,
  });
}

export function usePartnerLedgerOperations(contactId: string | null) {
  return useQuery({
    queryKey: partnerLedgerKeys.operations(contactId || ''),
    queryFn: () => partnerLedgerService.listOperations(contactId!),
    enabled: Boolean(contactId),
    ...defaults,
  });
}

export function usePartnerLedgerHistory(contactId: string | null) {
  return useQuery({
    queryKey: partnerLedgerKeys.history(contactId || ''),
    queryFn: () => partnerLedgerService.getBalanceHistory(contactId!, 7),
    enabled: Boolean(contactId),
    ...defaults,
  });
}

export function usePartnerLedgerSaleCatalog(
  warehouseId: string | null,
  search: string,
  enabled = true,
) {
  return useQuery({
    queryKey: partnerLedgerKeys.saleCatalog(warehouseId || '', search),
    queryFn: () =>
      partnerLedgerService.getSaleCatalog({
        warehouseId: warehouseId!,
        search: search || undefined,
        limit: 80,
      }),
    enabled: Boolean(warehouseId) && enabled,
    ...defaults,
  });
}

export function usePartnerLedgerMutations() {
  const qc = useQueryClient();
  const refreshLedger = (contactId?: string) => {
    void qc.refetchQueries({ queryKey: partnerLedgerKeys.summary(), type: 'active' });
    void qc.refetchQueries({ queryKey: [...partnerLedgerKeys.all, 'contacts'], type: 'active' });
    if (contactId) {
      void qc.refetchQueries({ queryKey: partnerLedgerKeys.contact(contactId), type: 'active' });
      void qc.refetchQueries({ queryKey: partnerLedgerKeys.operations(contactId), type: 'active' });
      void qc.invalidateQueries({ queryKey: partnerLedgerKeys.history(contactId) });
    }
  };
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: partnerLedgerKeys.all });
  };

  return {
    createContact: useMutation({
      mutationFn: partnerLedgerService.createContact,
      onSuccess: invalidate,
    }),
    deleteContact: useMutation({
      mutationFn: partnerLedgerService.deleteContact,
      onSuccess: invalidate,
    }),
    createOperation: useMutation({
      mutationFn: ({
        contactId,
        ...payload
      }: Parameters<typeof partnerLedgerService.createOperation>[1] & { contactId: string }) =>
        partnerLedgerService.createOperation(contactId, payload),
      onSuccess: (_data, variables) => refreshLedger(variables.contactId),
    }),
    updateOperation: useMutation({
      mutationFn: ({
        operationId,
        ...payload
      }: Parameters<typeof partnerLedgerService.updateOperation>[1] & { operationId: string }) =>
        partnerLedgerService.updateOperation(operationId, payload),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: partnerLedgerKeys.all });
        refreshLedger();
      },
    }),
    deleteOperation: useMutation({
      mutationFn: partnerLedgerService.deleteOperation,
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: partnerLedgerKeys.all });
        refreshLedger();
      },
    }),
    createSaleOrder: useMutation({
      mutationFn: ({
        contactId,
        ...payload
      }: Parameters<typeof partnerLedgerService.createSaleOrder>[1] & { contactId: string }) =>
        partnerLedgerService.createSaleOrder(contactId, payload),
      onSuccess: (_data, variables) => {
        refreshLedger(variables.contactId);
        void qc.invalidateQueries({ queryKey: ['stock-balances'] });
        void qc.invalidateQueries({ queryKey: ['stock-movements'] });
        void qc.invalidateQueries({ queryKey: ['products'] });
      },
    }),
    sendSaleOrderToPartner: useMutation({
      mutationFn: ({
        contactId,
        batchId,
      }: {
        contactId: string;
        batchId: string;
      }) => partnerLedgerService.sendSaleOrderToPartner(contactId, batchId),
      onSuccess: (_data, variables) => refreshLedger(variables.contactId),
    }),
  };
}
