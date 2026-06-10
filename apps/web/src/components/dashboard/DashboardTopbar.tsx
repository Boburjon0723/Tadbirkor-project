'use client';

import { useState } from 'react';
import { Menu, Zap } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { DashboardUserMenu } from '@/components/dashboard/DashboardUserMenu';
import type { SessionRole } from '@/hooks/use-session';

type Props = {
  hiddenOnMobileWarehouse?: boolean;
  userFullName?: string | null;
  role: SessionRole;
  onOpenMobileMenu: () => void;
};

export function DashboardTopbar({
  hiddenOnMobileWarehouse,
  userFullName,
  role,
  onOpenMobileMenu,
}: Props) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header
      className={`mobile-header-bar px-6 md:px-12 flex items-center justify-between border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-40 ${
        hiddenOnMobileWarehouse ? 'max-lg:hidden' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2.5 min-w-[44px] min-h-[44px] hover:bg-white/5 rounded-xl text-gray-400 active:scale-95 transition-all touch-manipulation"
        >
          <Menu size={24} />
        </button>
        <div className="hidden md:block">
          <Zap className="text-blue-500 fill-blue-500" size={24} />
        </div>
        <p className="hidden lg:block text-xs font-black text-gray-500 uppercase tracking-widest">
          Xush kelibsiz, <span className="text-white">{userFullName || 'Foydalanuvchi'}</span>
        </p>
        <div className="md:hidden flex items-center gap-2">
          <Zap className="text-blue-500 fill-blue-500" size={20} />
          <span className="font-bold text-lg">Axis</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <DashboardUserMenu
          open={userMenuOpen}
          onOpenChange={setUserMenuOpen}
          fullName={userFullName}
          role={role}
        />
      </div>
    </header>
  );
}
