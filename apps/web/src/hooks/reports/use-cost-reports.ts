import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { reportsService } from '@/services/reports.service';

export type ReportsFilterParams = {
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
};

function buildReportParams(filters: ReportsFilterParams) {
  const params: Record<string, string> = {};
  if (filters.dateFrom) params.dateFrom = new Date(filters.dateFrom).toISOString();
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    params.dateTo = end.toISOString();
  }
  if (filters.warehouseId) params.warehouseId = filters.warehouseId;
  return params;
}

export const reportKeys = {
  bundle: (filters: ReportsFilterParams) => ['reports-bundle', filters] as const,
};

export function useReportsBundle(filters: ReportsFilterParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.bundle(filters),
    enabled,
    queryFn: async () => {
      const params = buildReportParams(filters);
      const [summary, daily, top, fieldRes] = await Promise.all([
        api.get('/reports/summary', { params }),
        api.get('/reports/summary/daily', { params }),
        api.get('/reports/summary/top-products', { params: { ...params, limit: '10' } }),
        reportsService
          .getFieldWorkerInstallations(params)
          .then((data) => ({ ok: true as const, data }))
          .catch((err: unknown) => ({ ok: false as const, err })),
      ]);
      return {
        summary: summary.data,
        daily: daily.data || [],
        top: top.data || [],
        fieldRes,
      };
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
