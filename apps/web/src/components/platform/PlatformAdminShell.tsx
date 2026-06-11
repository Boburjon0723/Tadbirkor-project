'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Crown,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Server,
  Users,
} from 'lucide-react';
import { AxisLogo } from '@/components/AxisLogo';
import { PlatformAdminPinGate } from '@/components/PlatformAdminPinGate';
import { authService } from '@/services/auth.service';
import { platformService } from '@/services/platform.service';
import { useSession } from '@/hooks/use-session';

const nav = [
  { href: '/admin', label: 'Kompaniyalar', icon: Building2, exact: true },
  { href: '/admin/users', label: 'Foydalanuvchilar', icon: Users },
  { href: '/admin/broadcast', label: 'Xabar yuborish', icon: Megaphone },
  { href: '/admin/system', label: 'Tizim', icon: Server },
];

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();

  const { data: access, isPending: accessPending } = useQuery({
    queryKey: ['platform-access'],
    queryFn: () => platformService.getAccess(),
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = access?.isPlatformAdmin === true;
  const loading = sessionPending || (!!session && accessPending);

  useEffect(() => {
    if (sessionPending) return;
    if (!session) {
      router.replace('/admin/login');
      return;
    }
    if (!accessPending && access && !access.isPlatformAdmin) {
      router.replace('/admin/login');
    }
  }, [session, sessionPending, access, accessPending, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={36} />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <PlatformAdminPinGate isPlatformAdmin={isAdmin}>
      <div className="min-h-screen bg-[#0c0c0f] text-white flex flex-col md:flex-row">
        <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-white/10 bg-[#111116] flex flex-col">
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Crown className="text-amber-400 shrink-0" size={22} />
              <div className="min-w-0">
                <p className="font-black text-sm truncate">Axis Console</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                  Platforma boshqaruvi
                </p>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1 flex-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-neutral-400 hover:bg-white/5 hover:text-white"
            >
              <LayoutDashboard size={18} />
              ERP panel
            </Link>
            <button
              type="button"
              onClick={() => void authService.logout()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-neutral-400 hover:bg-white/5 hover:text-white"
            >
              <LogOut size={18} />
              Chiqish
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden p-4 border-b border-white/10 flex items-center justify-between">
            <AxisLogo size={28} showText={false} />
            <span className="text-xs font-black text-amber-400">Console</span>
          </header>
          <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </PlatformAdminPinGate>
  );
}
