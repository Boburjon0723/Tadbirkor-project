'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PlatformAdminShell } from '@/components/platform/PlatformAdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  if (isLogin) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] text-white font-sans selection:bg-indigo-500 selection:text-white">
        {children}
      </div>
    );
  }

  return <PlatformAdminShell>{children}</PlatformAdminShell>;
}
