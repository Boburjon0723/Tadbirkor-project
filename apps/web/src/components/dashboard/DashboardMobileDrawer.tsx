'use client';

import { LogOut, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardSidebarNav } from '@/components/DashboardSidebarNav';
import { authService } from '@/services/auth.service';
import type { DashboardMenuGroup } from '@/lib/dashboard-menu';

type Props = {
  open: boolean;
  onClose: () => void;
  groups: DashboardMenuGroup[];
  pathname: string;
  search?: string;
};

export function DashboardMobileDrawer({
  open,
  onClose,
  groups,
  pathname,
  search = '',
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
              <DashboardSidebarNav
                groups={groups}
                pathname={pathname}
                search={search}
                onNavigate={onClose}
                layoutIdPrefix="mobile-sidebar"
              />
            </nav>
            <div className="p-4 border-t border-white/5">
              <button
                type="button"
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
  );
}
