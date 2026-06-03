'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/hooks/notifications/use-notifications';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationSoundSettings } from '@/components/NotificationSoundSettings';

export function NotificationBell() {
  const { data: unreadCount } = useUnreadCount();
  const pathname = usePathname();
  const isActive = pathname === '/dashboard/notifications';
  const count = Number(unreadCount || 0);
  const badgeText = count > 99 ? '99+' : String(count);

  return (
    <div className="flex items-center gap-1">
      <NotificationSoundSettings compact />
      <Link
        href="/dashboard/notifications"
        className={`relative p-3 rounded-2xl border transition-all group ${
          isActive
            ? 'bg-blue-500/10 border-blue-500/20'
            : 'bg-white/5 hover:bg-white/10 border-white/5'
        }`}
      >
        <Bell
          className={`w-6 h-6 transition-all ${
            count > 0 || isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'
          }`}
        />
        {count > 0 && (
          <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">
            {badgeText}
          </span>
        )}
      </Link>
    </div>
  );
}
