'use client';

import { Loader2 } from 'lucide-react';
import { DashboardDesktopSidebar } from '@/components/dashboard/DashboardDesktopSidebar';

/** Suspense fallback — server va client bir xil `<aside>` tuzilmasini saqlaydi (hydration xatosi oldini olish). */
export function DashboardLayoutFallback() {
  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden">
      <DashboardDesktopSidebar
        collapsed={false}
        onToggleCollapsed={() => {}}
        groups={[]}
        pathname="/dashboard"
        search=""
        role="owner"
      />
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-20 md:pb-0">
        <div className="flex flex-col items-center justify-center gap-4 min-h-[50vh] flex-1">
          <Loader2 className="animate-spin text-blue-500" size={40} />
          <p className="text-gray-500 font-black uppercase tracking-widest text-xs">
            Yuklanmoqda...
          </p>
        </div>
      </main>
    </div>
  );
}
