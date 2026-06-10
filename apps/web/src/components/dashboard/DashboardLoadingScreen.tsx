'use client';

import { Loader2 } from 'lucide-react';

export function DashboardLoadingScreen() {
  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Yuklanmoqda...</p>
    </div>
  );
}
