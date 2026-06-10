'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { LogOut, Settings, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { authService } from '@/services/auth.service';
import type { SessionRole } from '@/hooks/use-session';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName?: string | null;
  role: SessionRole;
};

export function DashboardUserMenu({ open, onOpenChange, fullName, role }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange]);

  const initial = fullName?.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 p-0.5 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
      >
        <div className="w-full h-full rounded-[10px] bg-[#0a0a0a] flex items-center justify-center text-blue-400 font-black text-xs">
          {initial || <User size={18} />}
        </div>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute right-0 mt-3 w-64 bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 shadow-2xl z-50 backdrop-blur-2xl"
        >
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-xl">
              {initial}
            </div>
            <div>
              <p className="font-black text-white text-sm truncate">{fullName}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{role}</p>
            </div>
          </div>

          <div className="space-y-1">
            <Link
              href="/dashboard/settings"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all text-sm font-bold"
            >
              <User size={16} /> Profil
            </Link>
            <Link
              href="/dashboard/settings"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all text-sm font-bold"
            >
              <Settings size={16} /> Sozlamalar
            </Link>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
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
  );
}
