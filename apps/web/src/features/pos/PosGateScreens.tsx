'use client';

import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';

export function PosLoadingScreen() {
  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-gray-500 font-black uppercase tracking-widest text-xs">
        POS yuklanmoqda...
      </p>
    </div>
  );
}

export function PosBlockedScreen() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 gap-6">
      <AlertCircle className="text-amber-400" size={48} />
      <div className="text-center max-w-md space-y-3">
        <h1 className="text-2xl font-black">POS / Kassa o‘chirilgan</h1>
        <p className="text-gray-400 font-medium">
          Bu kompaniya uchun kassa interfeysi hozir faol emas. Uni{' '}
          <strong className="text-white">Sozlamalar → Modullar</strong> orqali
          yoqishingiz mumkin.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/dashboard"
          className="px-8 py-4 rounded-2xl bg-white/10 border border-white/15 font-black text-sm hover:bg-white/15 transition-all"
        >
          Asosiy panel
        </Link>
        <Link
          href="/dashboard/settings?tab=modullar"
          className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm transition-all"
        >
          Modullarni ochish
        </Link>
      </div>
    </div>
  );
}
