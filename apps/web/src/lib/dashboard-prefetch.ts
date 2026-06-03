import type { QueryClient } from '@tanstack/react-query';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { warehouseService } from '@/services/warehouse.service';

/** Asosiy dashboard marshrutlari — sidebar hover va layout mount da oldindan yuklash */
export const DASHBOARD_PREFETCH_PATHS = [
  '/dashboard',
  '/dashboard/inventory',
  '/dashboard/orders',
  '/dashboard/partners',
  '/dashboard/partner-ledger',
  '/dashboard/warehouse',
  '/dashboard/picking',
  '/dashboard/inventory-count',
  '/dashboard/reports',
  '/dashboard/settings',
  '/dashboard/pos',
] as const;

export function prefetchDashboardRoute(
  router: AppRouterInstance,
  href: string,
) {
  if (!href || href.startsWith('#')) return;
  try {
    router.prefetch(href);
  } catch {
    // prefetch muvaffaqiyatsiz — navigatsiya baribir ishlaydi
  }
}

export function prefetchDashboardRoutes(router: AppRouterInstance) {
  for (const path of DASHBOARD_PREFETCH_PATHS) {
    prefetchDashboardRoute(router, path);
  }
}

/** Marshrutga bog‘liq React Query ma’lumotlarini oldindan yuklash */
export function prefetchDashboardRouteData(
  queryClient: QueryClient,
  href: string,
) {
  if (href === '/dashboard/inventory' || href.startsWith('/dashboard/inventory')) {
    void queryClient.prefetchQuery({
      queryKey: ['warehouses'],
      queryFn: () => warehouseService.getWarehouses(),
      staleTime: 10 * 60 * 1000,
    });
  }
}
