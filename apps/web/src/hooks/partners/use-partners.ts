import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partnersService } from "@/services/partners.service";

export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: partnersService.getPartners,
  });
}

export function useSearchCompany(tin: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ["search-company", tin],
    queryFn: () => partnersService.searchCompanyByTin(tin),
    enabled: enabled && tin.length >= 3,
    retry: false,
  });
}

export function usePartnerActions() {
  const queryClient = useQueryClient();

  const sendRequestMutation = useMutation({
    mutationFn: (partnerCompanyId: string) => partnersService.sendRequest(partnerCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => partnersService.acceptRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => partnersService.rejectRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: (id: string) => partnersService.blockPartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => partnersService.removePartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const warehouseVisibilityMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { allVisible: boolean; warehouseIds?: string[] } }) =>
      partnersService.updateWarehouseVisibility(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  return {
    sendRequest: sendRequestMutation,
    accept: acceptMutation,
    reject: rejectMutation,
    block: blockMutation,
    remove: removeMutation,
    updateWarehouseVisibility: warehouseVisibilityMutation,
  };
}
