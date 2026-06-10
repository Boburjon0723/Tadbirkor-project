'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useCompanyRealtime } from '@/hooks/use-company-realtime';
import { useNotificationAlerts } from '@/hooks/notifications/use-notification-alerts';
import { useDashboardGuards } from '@/hooks/use-dashboard-guards';
import { useDashboardMenu } from '@/hooks/use-dashboard-menu';
import { isWarehouseMobileShellPath } from '@/lib/dashboard-shell';
import { prefetchDashboardRoute } from '@/lib/dashboard-prefetch';
import { SubscriptionExpiredBanner } from '@/components/SubscriptionExpiredBanner';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { DashboardDesktopSidebar } from '@/components/dashboard/DashboardDesktopSidebar';
import { DashboardMobileDrawer } from '@/components/dashboard/DashboardMobileDrawer';
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar';

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [uiReady, setUiReady] = useState(false);

  useEffect(() => {
    setUiReady(true);
  }, []);

  const {
    data: session,
    isPending: sessionPending,
    isError: sessionError,
    isPlaceholderData: sessionIsPlaceholder,
  } = useSession();

  const role = session?.role ?? 'owner';
  const featureConfig = session?.features ?? {
    hasFeatureConfig: false,
    enabledFeatures: [],
    enabledModules: [],
  };
  const user = session?.me;
  const isPlatformAdmin = session?.me?.isPlatformAdmin === true;
  const showSessionLoading = sessionPending && !session && !sessionIsPlaceholder;

  useCompanyRealtime(!showSessionLoading && !!user);
  useNotificationAlerts(!showSessionLoading && !!user);

  const { menuGroupsForNav, allMenuItems, filteredMenu, mobileNavItems } = useDashboardMenu({
    role,
    featureConfig,
    isPlatformAdmin,
  });

  useDashboardGuards({
    pathname,
    search,
    role,
    layoutHold: showSessionLoading,
    sessionPending,
    sessionIsPlaceholder,
    sessionError,
    user,
    session,
    featureConfig,
    allMenuItems,
  });

  const isWarehouseMobileShell = isWarehouseMobileShellPath(pathname);

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden">
      <DashboardDesktopSidebar
        collapsed={isCollapsed}
        onToggleCollapsed={() => setIsCollapsed((v) => !v)}
        groups={menuGroupsForNav}
        pathname={pathname}
        search={search}
        role={role}
      />

      <DashboardMobileDrawer
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        groups={menuGroupsForNav}
        pathname={pathname}
        search={search}
      />

      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-20 md:pb-0">
        <DashboardTopbar
          hiddenOnMobileWarehouse={isWarehouseMobileShell}
          userFullName={uiReady ? user?.user?.fullName : undefined}
          role={role}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <div
          className={`flex-1 ${
            isWarehouseMobileShell
              ? 'max-lg:p-0 max-lg:pb-0'
              : 'p-4 md:p-6 lg:p-8 max-w-[1600px] xl:mx-auto w-full'
          }`}
        >
          {showSessionLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 min-h-[50vh]">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p className="text-gray-500 font-black uppercase tracking-widest text-xs">
                Yuklanmoqda...
              </p>
            </div>
          ) : (
            <>
              <SubscriptionExpiredBanner
                canWrite={session?.me?.company?.canWrite !== false}
                subscriptionLabel={session?.me?.company?.subscriptionLabel}
              />
              {children}
            </>
          )}
        </div>

        <MobileBottomNav
          items={mobileNavItems.length > 0 ? mobileNavItems : filteredMenu}
          pathname={pathname}
          search={search}
          onPrefetch={(href) => prefetchDashboardRoute(router, href)}
          className={isWarehouseMobileShell ? 'max-lg:hidden' : ''}
        />
      </main>
    </div>
  );
}
