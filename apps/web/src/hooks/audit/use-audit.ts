import { useQuery } from "@tanstack/react-query";
import { auditService } from "@/services/audit.service";

export function useAuditLogs(params?: Record<string, any>) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditService.getLogs(params),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useAuditStats() {
  return useQuery({
    queryKey: ["audit-stats"],
    queryFn: auditService.getStats,
  });
}

export function useAuditLog(id?: string | null) {
  return useQuery({
    queryKey: ['audit-log', id],
    queryFn: () => auditService.getLog(id as string),
    enabled: Boolean(id),
  });
}
