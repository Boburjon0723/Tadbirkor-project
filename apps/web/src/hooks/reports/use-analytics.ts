import { useQuery } from "@tanstack/react-query";
import { reportsService } from "@/services/reports.service";

export function useOrderAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["analytics-orders", days],
    queryFn: () => reportsService.getB2BOrdersAnalytics(days),
  });
}

export function useStockAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["analytics-stock", days],
    queryFn: () => reportsService.getStockAnalytics(days),
  });
}

export function usePartnersBalance() {
  return useQuery({
    queryKey: ["analytics-balance"],
    queryFn: reportsService.getPartnersBalanceReport,
  });
}
