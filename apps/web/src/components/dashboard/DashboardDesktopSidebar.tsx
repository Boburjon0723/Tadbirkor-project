'use client';

import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { AxisLogo } from '@/components/AxisLogo';
import { DashboardSidebarNav } from '@/components/DashboardSidebarNav';
import { authService } from '@/services/auth.service';
import type { DashboardMenuGroup } from '@/lib/dashboard-menu';
import type { SessionRole } from '@/hooks/use-session';

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  groups: DashboardMenuGroup[];
  pathname: string;
  role: SessionRole;
};

export function DashboardDesktopSidebar({
  collapsed,
  onToggleCollapsed,
  groups,
  pathname,
  role,
}: Props) {
  return (
    <aside
      className={`bg-[#080808] border-r border-white/5 transition-all duration-300 hidden md:flex flex-col z-30 sticky top-0 h-screen ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div
        className={`h-20 flex items-center border-b border-white/5 overflow-hidden ${collapsed ? 'justify-center px-0' : 'px-4'}`}
      >
        <AxisLogo size={36} showText={!collapsed} />
      </div>

      <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <DashboardSidebarNav
          groups={groups}
          pathname={pathname}
          collapsed={collapsed}
          layoutIdPrefix="desktop-sidebar"
        />
      </nav>

      <div className="p-4 border-t border-white/5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="w-full py-3 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-gray-500 transition-all"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {!collapsed && (
          <div className="mt-4 p-4 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-2xl border border-white/5">
            <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Rol</p>
            <p className="text-xs font-bold capitalize">{role}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => authService.logout()}
          className="w-full mt-4 flex items-center gap-4 px-4 py-3.5 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all group"
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span className="text-sm font-bold">Chiqish</span>}
        </button>
      </div>
    </aside>
  );
}
