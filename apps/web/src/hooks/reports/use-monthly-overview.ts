import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';

export const monthlyOverviewKeys = {
  all: ['monthly-overview'] as const,
  month: (year: number, month: number) => [...monthlyOverviewKeys.all, year, month] as const,
};

export function useMonthlyOverview(year: number, month: number) {
  return useQuery({
    queryKey: monthlyOverviewKeys.month(year, month),
    queryFn: () => reportsService.getMonthlyOverview({ year, month }),
    staleTime: 60 * 1000,
  });
}
