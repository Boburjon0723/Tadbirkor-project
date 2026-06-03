'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardList, Package, History, LogOut, Loader2 } from 'lucide-react';
import { AxisLogo } from '@/components/AxisLogo';
import { authService } from '@/services/auth.service';
import { useSession } from '@/hooks/use-session';

const nav = [
  { href: '/field', label: 'Vazifalar', icon: ClipboardList },
  { href: '/field/stock', label: 'Mening tovarlarim', icon: Package },
  { href: '/field/history', label: 'Tarix', icon: History },
];

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const layoutHold = isPending && !session;

  useEffect(() => {
    if (layoutHold) return;
    if (!session) {
      router.replace('/');
      return;
    }
    if (session.role !== 'field_worker') {
      router.replace('/dashboard');
    }
  }, [session, layoutHold, router]);

  if (layoutHold) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-500" size={36} />
      </div>
    );
  }

  const hideNav = pathname.includes('/report');

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="p-4 border-b border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          <AxisLogo size={32} showText={false} />
          <span className="font-black text-lg truncate">Axis Field</span>
        </div>
        <button type="button" onClick={() => authService.logout()} className="p-2 text-gray-500">
          <LogOut size={20} />
        </button>
      </header>
      <main className="flex-1 p-4 pb-24">{children}</main>
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 flex justify-around p-2">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-[10px] font-black ${active ? 'text-cyan-400' : 'text-gray-500'}`}
              >
                <Icon size={22} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
