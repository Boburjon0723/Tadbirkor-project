'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { useCompanyRealtime } from '@/hooks/use-company-realtime';
import { useNotificationAlerts } from '@/hooks/notifications/use-notification-alerts';
import { useDashboardGuards } from '@/hooks/use-dashboard-guards';
import { useDashboardMenu } from '@/hooks/use-dashboard-menu';
import { isWarehouseMobileShellPath } from '@/lib/dashboard-shell';
import { prefetchDashboardRoute } from '@/lib/dashboard-prefetch';
import { SubscriptionExpiredBanner } from '@/components/SubscriptionExpiredBanner';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { DashboardLoadingScreen } from '@/components/dashboard/DashboardLoadingScreen';
import { DashboardDesktopSidebar } from '@/components/dashboard/DashboardDesktopSidebar';
import { DashboardMobileDrawer } from '@/components/dashboard/DashboardMobileDrawer';
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const layoutHold = sessionPending && !session && !sessionIsPlaceholder;

  useCompanyRealtime(!layoutHold && !!user);
  useNotificationAlerts(!layoutHold && !!user);

  const { menuGroupsForNav, allMenuItems, filteredMenu, mobileNavItems } = useDashboardMenu({
    role,
    featureConfig,
    isPlatformAdmin,
  });

  useDashboardGuards({
    pathname,
    role,
    layoutHold,
    sessionPending,
    sessionIsPlaceholder,
    sessionError,
    user,
    session,
    featureConfig,
    allMenuItems,
  });

  const isWarehouseMobileShell = isWarehouseMobileShellPath(pathname);

  if (layoutHold) {
    return <DashboardLoadingScreen />;
  }

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden">
      <DashboardDesktopSidebar
        collapsed={isCollapsed}
        onToggleCollapsed={() => setIsCollapsed((v) => !v)}
        groups={menuGroupsForNav}
        pathname={pathname}
        role={role}
      />

      <DashboardMobileDrawer
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        groups={menuGroupsForNav}
        pathname={pathname}
      />

      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-20 md:pb-0">
        <DashboardTopbar
          hiddenOnMobileWarehouse={isWarehouseMobileShell}
          userFullName={user?.user?.fullName}
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
          <SubscriptionExpiredBanner
            canWrite={session?.me?.company?.canWrite !== false}
            subscriptionLabel={session?.me?.company?.subscriptionLabel}
          />
          {children}
        </div>

        <MobileBottomNav
          items={mobileNavItems.length > 0 ? mobileNavItems : filteredMenu}
          pathname={pathname}
          search={searchParams.toString()}
          onPrefetch={(href) => prefetchDashboardRoute(router, href)}
          className={isWarehouseMobileShell ? 'max-lg:hidden' : ''}
        />
      </main>
    </div>
  );
}
