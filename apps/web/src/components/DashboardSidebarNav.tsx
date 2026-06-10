'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { DashboardMenuGroup, DashboardMenuItem } from '@/lib/dashboard-menu';
import { isMenuItemActive } from '@/lib/dashboard-menu';
import {
  prefetchDashboardRoute,
  prefetchDashboardRouteData,
} from '@/lib/dashboard-prefetch';

type Props = {
  groups: DashboardMenuGroup[];
  pathname: string;
  search?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  layoutIdPrefix?: string;
};

function MenuLink({
  item,
  pathname,
  search = '',
  collapsed,
  onNavigate,
  layoutIdPrefix,
}: {
  item: DashboardMenuItem;
  pathname: string;
  search?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  layoutIdPrefix?: string;
}) {
  if (item.href === '#support') {
    return (
      <button
        type="button"
        onClick={() => {
          if (onNavigate) onNavigate();
          window.dispatchEvent(new CustomEvent('open-support-widget'));
        }}
        className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative text-gray-500 hover:bg-white/5 hover:text-white text-left"
      >
        <div className="shrink-0">{item.icon}</div>
        {!collapsed && (
          <span className="text-sm font-bold leading-snug">{item.label}</span>
        )}
      </button>
    );
  }

  const router = useRouter();
  const queryClient = useQueryClient();
  const isActive = isMenuItemActive(pathname, item.href, search);
  const warmRoute = () => {
    prefetchDashboardRoute(router, item.href);
    prefetchDashboardRouteData(queryClient, item.href);
  };
  return (
    <Link
      href={item.href}
      prefetch
      onMouseEnter={warmRoute}
      onFocus={warmRoute}
      onClick={onNavigate}
      className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
          : 'text-gray-500 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="shrink-0">{item.icon}</div>
      {!collapsed && (
        <span className="text-sm font-bold leading-snug">{item.label}</span>
      )}
      {isActive && !collapsed && layoutIdPrefix && (
        <motion.div
          layoutId={`${layoutIdPrefix}-active-pill`}
          className="absolute right-4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff]"
        />
      )}
    </Link>
  );
}

export function DashboardSidebarNav({
  groups,
  pathname,
  search = '',
  collapsed = false,
  onNavigate,
  layoutIdPrefix = 'sidebar',
}: Props) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.id}>
          {!collapsed && (
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
              {group.title}
            </p>
          )}
          {collapsed && <div className="h-px bg-white/5 mx-3 mb-2 first:hidden" />}
          <div className="space-y-1">
            {group.items.map((item) => (
              <MenuLink
                key={item.href}
                item={item}
                pathname={pathname}
                search={search}
                collapsed={collapsed}
                onNavigate={onNavigate}
                layoutIdPrefix={layoutIdPrefix}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
