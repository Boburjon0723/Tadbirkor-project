'use client';

import Link from 'next/link';
import { Loader2, LayoutGrid } from 'lucide-react';
import { useModuleGate } from '@/hooks/use-module-gate';
import type { ModuleMatchMode } from '@/lib/feature-modules';

type ModuleGateProps = {
  moduleKey: string;
  moduleKeys?: string[];
  match?: ModuleMatchMode;
  moduleLabel?: string;
  children: React.ReactNode;
};

export function ModuleGate({
  moduleKey,
  moduleKeys,
  match,
  moduleLabel,
  children,
}: ModuleGateProps) {
  const { enabled, loading } = useModuleGate(moduleKey, { moduleKeys, match });

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-gray-500">
          <LayoutGrid size={28} />
        </div>
        <p className="font-black text-xl">{moduleLabel || moduleKey} moduli o‘chirilgan</p>
        <p className="text-gray-500 text-sm font-bold">
          Ushbu bo‘limni ishlatish uchun Sozlamalar → Modullar bo‘limida modulni yoqing.
        </p>
        <Link
          href="/dashboard/settings?tab=modullar"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 transition-colors"
        >
          Modullarni boshqarish
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
