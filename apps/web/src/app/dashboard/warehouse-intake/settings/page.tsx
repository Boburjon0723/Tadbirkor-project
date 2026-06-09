'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { SettingsIntakeSection } from '@/components/settings/SettingsIntakeSection';
import { useSession } from '@/hooks/use-session';
import { canManageIntakeSettings } from '@/lib/role-access';

export default function WarehouseIntakeSettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const role = session?.role ?? 'owner';
  const canWrite = session?.me?.company?.canWrite !== false;

  useEffect(() => {
    if (isPending || !session) return;
    if (!canManageIntakeSettings(role)) {
      router.replace('/dashboard/warehouse-intake');
    }
  }, [isPending, session, role, router]);

  if (isPending) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  if (!canManageIntakeSettings(role)) {
    return null;
  }

  return (
    <ModuleGate moduleKey="WAREHOUSE_INTAKE" moduleLabel="Ombor kirimi sozlamalari">
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/warehouse-intake"
            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Kirim <span className="text-emerald-500">sozlamalari</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Skaner rejimi, tez qo&apos;shish va miqdor limitlari
            </p>
          </div>
        </div>
        <SettingsIntakeSection canWrite={canWrite} />
      </div>
    </ModuleGate>
  );
}
