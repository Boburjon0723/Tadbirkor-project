'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Box, 
  BarChart3, 
  Users, 
  Store,
  Wallet2,
  TrendingUp,
  Banknote,
  Link2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  Settings,
  Wallet,
  History,
  Handshake,
  ShoppingBag,
  User,
  GitBranch,
  Truck,
  Menu,
  X,
  Loader2,
  CreditCard,
  Crown,
  PackagePlus,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { NotificationBell } from '@/components/NotificationBell';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/services/auth.service';
import {
  isModuleKeyEnabled,
  areModuleKeysEnabled,
  findMenuGuardForPath,
} from '@/lib/feature-modules';
import { useQueryClient } from '@tanstack/react-query';
import { useSession, SESSION_QUERY_KEY, type SessionRole, type SessionData } from '@/hooks/use-session';
import { isMenuItemActive } from '@/lib/dashboard-menu';
import { AxisLogo } from '@/components/AxisLogo';
import { DashboardSidebarNav } from '@/components/DashboardSidebarNav';
import {
  buildDashboardMenuGroups,
  flattenMenuGroups,
  isDashboardPathAllowedForRole,
  type DashboardMenuItem,
} from '@/lib/dashboard-menu';
import { computeOnboardingProgress } from '@/lib/onboarding';
import { useCompanyRealtime } from '@/hooks/use-company-realtime';
import { useNotificationAlerts } from '@/hooks/notifications/use-notification-alerts';
import { SubscriptionExpiredBanner } from '@/components/SubscriptionExpiredBanner';
import { prefetchDashboardRoute, prefetchDashboardRoutes } from '@/lib/dashboard-prefetch';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [onboardingGateReady, setOnboardingGateReady] = useState(false);
  const { data: session, isPending: sessionPending, isError: sessionError } = useSession();

  React.useEffect(() => {
    if (!sessionError) return;
    router.replace('/');
  }, [sessionError, router]);
  const role: SessionRole = session?.role ?? 'owner';
  const featureConfig = session?.features ?? {
    hasFeatureConfig: false,
    enabledFeatures: [],
    enabledModules: [],
  };
  const user = session?.me;
  const isPlatformAdmin = session?.me?.isPlatformAdmin === true;
  const layoutHold = sessionPending && !session;

  useCompanyRealtime(!layoutHold && !!user);
  useNotificationAlerts(!layoutHold && !!user);

  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /** Sotuvchi: POS moduli yoqilgan bo‘lsa, dashboardga kirganda kassaga yo‘naltirish */
  React.useEffect(() => {
    if (layoutHold) return;
    if (role !== 'sales') return;
    if (!isModuleKeyEnabled(featureConfig, 'POS')) return;
    if (!pathname.startsWith('/dashboard')) return;
    router.replace('/pos');
  }, [role, featureConfig, pathname, router, layoutHold]);

  /** Dala xodimi: faqat mobil field interfeysi */
  React.useEffect(() => {
    if (layoutHold) return;
    if (role !== 'field_worker') return;
    router.replace('/field');
  }, [role, layoutHold, router]);

  /** Onboarding gate: sessiya allaqachon useSession da (qayta refetch keraksiz DB yuk) */
  React.useEffect(() => {
    if (layoutHold || !user) return;
    setOnboardingGateReady(true);
  }, [layoutHold, user]);

  /** Asosiy sahifalarni oldindan yuklash (sahifalar orasida tezroq o‘tish) */
  React.useEffect(() => {
    if (layoutHold) return;
    prefetchDashboardRoutes(router);
  }, [layoutHold, router]);

  /** OWNER: STIR / biznes turi / modullar to'ldirilmagan bo'lsa onboarding */
  React.useEffect(() => {
    if (layoutHold || !user || !onboardingGateReady) return;
    if (role !== 'owner') return;
    const fresh =
      queryClient.getQueryData<SessionData>(SESSION_QUERY_KEY) ?? session;
    if (!fresh?.me) return;
    const progress = computeOnboardingProgress(
      { role: fresh.me.role, company: fresh.me.company },
      fresh.features ?? featureConfig,
    );
    if (!progress.isComplete) {
      router.replace(progress.requiredPath);
    }
  }, [
    layoutHold,
    user,
    role,
    featureConfig,
    router,
    onboardingGateReady,
    queryClient,
    session,
  ]);

  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const menuGroupsRaw = React.useMemo(
    () =>
      buildDashboardMenuGroups({
        LayoutDashboard,
        Box,
        Handshake,
        GitBranch,
        CreditCard,
        History,
        ShoppingBag,
        Truck,
        Wallet,
        Users,
        Store,
        Wallet2,
        TrendingUp,
        Banknote,
        BarChart3,
        Link2,
        Settings,
        PackagePlus,
      }),
    [],
  );

  const shouldShowByFeature = (item: DashboardMenuItem) => {
    if (!item.moduleKeys?.length) return true;
    const match = item.moduleMatch ?? 'all';
    return areModuleKeysEnabled(featureConfig, item.moduleKeys, match);
  };

  const allMenuItems = React.useMemo(
    () => flattenMenuGroups(menuGroupsRaw),
    [menuGroupsRaw],
  );

  React.useEffect(() => {
    if (layoutHold || !featureConfig.hasFeatureConfig) return;
    const guard = findMenuGuardForPath(pathname, allMenuItems);
    if (!guard?.moduleKeys?.length) return;
    const match = guard.moduleMatch ?? 'all';
    if (!areModuleKeysEnabled(featureConfig, guard.moduleKeys, match)) {
      router.replace('/dashboard');
    }
  }, [pathname, featureConfig, layoutHold, router, allMenuItems]);

  React.useEffect(() => {
    if (layoutHold || sessionPending) return;
    if (!isDashboardPathAllowedForRole(pathname, role, allMenuItems)) {
      router.replace('/dashboard');
    }
  }, [pathname, role, layoutHold, sessionPending, router, allMenuItems]);

  const filterItem = (item: DashboardMenuItem) =>
    item.roles.includes(role) && shouldShowByFeature(item);

  const filteredMenuGroups = menuGroupsRaw
    .map((group) => ({
      ...group,
      items: group.items.filter(filterItem),
    }))
    .filter((group) => group.items.length > 0);

  const menuGroupsForNav = React.useMemo(() => {
    if (!isPlatformAdmin) return filteredMenuGroups;
    const allRoles: SessionRole[] = [
      'owner',
      'manager',
      'accountant',
      'warehouse',
      'sales',
      'field_worker',
      'worker',
    ];
    return [
      ...filteredMenuGroups,
      {
        id: 'platform-admin',
        title: 'Platforma',
        items: [
          {
            href: '/dashboard/platform-admin',
            label: 'Admin panel',
            icon: <Crown size={20} />,
            roles: allRoles,
          },
        ],
      },
    ];
  }, [filteredMenuGroups, isPlatformAdmin]);

  const filteredMenu = menuGroupsForNav.flatMap((g) => g.items);

  const mobileNavItems = filteredMenu.filter((item) => item.mobileNav);

  if (layoutHold) {
    return (
      <div className="h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-[#080808] border-r border-white/5 transition-all duration-300 hidden md:flex flex-col z-30 sticky top-0 h-screen ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div
          className={`h-20 flex items-center border-b border-white/5 overflow-hidden ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
        >
          <AxisLogo size={36} showText={!isCollapsed} />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          <DashboardSidebarNav
            groups={menuGroupsForNav}
            pathname={pathname}
            collapsed={isCollapsed}
            layoutIdPrefix="desktop-sidebar"
          />
        </nav>

        <div className="p-4 border-t border-white/5">
           <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full py-3 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-gray-500 transition-all"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          
          {!isCollapsed && (
            <div className="mt-4 p-4 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Rol</p>
              <p className="text-xs font-bold capitalize">{role}</p>
            </div>
          )}

          <button 
            onClick={() => authService.logout()}
            className="w-full mt-4 flex items-center gap-4 px-4 py-3.5 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all group"
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span className="text-sm font-bold">Chiqish</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-[#080808] border-r border-white/5 z-[70] flex flex-col md:hidden"
            >
              <div className="h-20 flex items-center px-6 border-b border-white/5 justify-between">
                <div className="flex items-center">
                  <Zap className="text-blue-500 fill-blue-500" size={24} />
                  <span className="ml-3 font-bold text-xl tracking-tight">Axis ERP</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-gray-500">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                <DashboardSidebarNav
                  groups={menuGroupsForNav}
                  pathname={pathname}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                  layoutIdPrefix="mobile-sidebar"
                />
              </nav>
              <div className="p-4 border-t border-white/5">
                <button 
                  onClick={() => authService.logout()}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all font-bold text-sm"
                >
                  <LogOut size={20} /> Chiqish
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-20 md:pb-0">
        {/* Topbar */}
        <header className="h-20 px-6 md:px-12 flex items-center justify-between border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="md:hidden p-2 hover:bg-white/5 rounded-xl text-gray-400 active:scale-95 transition-all"
             >
               <Menu size={24} />
             </button>
             <div className="hidden md:block">
                <Zap className="text-blue-500 fill-blue-500" size={24} />
             </div>
             <p className="hidden lg:block text-xs font-black text-gray-500 uppercase tracking-widest">Xush kelibsiz, <span className="text-white">{user?.user?.fullName || 'Foydalanuvchi'}</span></p>
             <div className="md:hidden flex items-center gap-2">
                <Zap className="text-blue-500 fill-blue-500" size={20} />
                <span className="font-bold text-lg">Axis</span>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 p-0.5 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                <div className="w-full h-full rounded-[10px] bg-[#0a0a0a] flex items-center justify-center text-blue-400 font-black text-xs">
                  {user?.user?.fullName ? user.user.fullName.charAt(0).toUpperCase() : <User size={18} />}
                </div>
              </button>

              {isUserMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute right-0 mt-3 w-64 bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 shadow-2xl z-50 backdrop-blur-2xl"
                >
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-xl">
                      {user?.user?.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-white text-sm truncate">{user?.user?.fullName}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{role}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Link 
                      href="/dashboard/settings" 
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all text-sm font-bold"
                    >
                      <User size={16} /> Profil
                    </Link>
                    <Link 
                      href="/dashboard/settings" 
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all text-sm font-bold"
                    >
                      <Settings size={16} /> Sozlamalar
                    </Link>
                    <button 
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        authService.logout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-500 transition-all text-sm font-bold"
                    >
                      <LogOut size={16} /> Chiqish
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </header>


        <div className="p-6 md:p-12 flex-1">
          <SubscriptionExpiredBanner
            canWrite={session?.me?.company?.canWrite !== false}
            subscriptionLabel={session?.me?.company?.subscriptionLabel}
          />
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#080808]/90 backdrop-blur-2xl border-t border-white/5 px-6 flex items-center justify-between z-50">
          {(mobileNavItems.length > 0 ? mobileNavItems : filteredMenu.slice(0, 4)).map(
            (item) => {
              const isActive = isMenuItemActive(pathname, item.href);
              const shortLabel =
                item.label === 'Mahsulotlar va qoldiq'
                  ? 'Ombor'
                  : item.label === 'POS / Kassa'
                    ? 'Kassa'
                    : item.label.length > 12
                      ? item.label.split(' ')[0]
                      : item.label;

              if (item.href === '#support') {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-support-widget'))}
                    className="relative flex flex-col items-center gap-1.5 transition-all text-gray-500 hover:text-white"
                  >
                    <div className="scale-100 transition-transform">
                      {item.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter max-w-[72px] truncate">
                      {shortLabel}
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onMouseEnter={() => prefetchDashboardRoute(router, item.href)}
                  className={`relative flex flex-col items-center gap-1.5 transition-all ${
                    isActive ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  <div
                    className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform`}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter max-w-[72px] truncate">
                    {shortLabel}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active"
                      className="absolute -bottom-1 w-1 h-1 bg-blue-500 rounded-full"
                    />
                  )}
                </Link>
              );
            },
          )}
        </nav>
      </main>
    </div>
  );
}
