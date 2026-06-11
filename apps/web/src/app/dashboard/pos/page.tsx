'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, Users, BarChart3, CreditCard, Loader2 } from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PosSalesHistoryTab } from '@/features/pos-center/PosSalesHistoryTab';
import { PosCustomersTab } from '@/features/pos-center/PosCustomersTab';
import { PosReportTab } from '@/features/pos-center/PosReportTab';

const TABS = [
  { id: 'tarix', label: 'Cheklar tarixi', icon: History },
  { id: 'mijozlar', label: 'Mijozlar', icon: Users },
  { id: 'hisobot', label: 'Hisobot', icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]['id'];

function parseTab(raw: string | null): TabId {
  if (raw === 'mijozlar' || raw === 'hisobot') return raw;
  return 'tarix';
}

function PosCenterFallback() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="animate-spin text-blue-500" size={36} />
    </div>
  );
}

function PosCenterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = useMemo(
    () => parseTab(searchParams.get('tab')),
    [searchParams],
  );

  const setTab = (id: TabId) => {
    const q = id === 'tarix' ? '' : `?tab=${id}`;
    router.replace(`/dashboard/pos${q}`);
  };

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && t !== 'tarix' && t !== 'mijozlar' && t !== 'hisobot') {
      router.replace('/dashboard/pos');
    }
  }, [searchParams, router]);

  return (
    <div className="space-y-8 pb-20">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="text-blue-500" size={28} />
          <h1 className="dash-page-title">
            Kassa <span className="text-blue-500">boshqaruvi</span>
          </h1>
        </div>
        <p className="dash-page-subtitle">
          Sotuvlar tarixi, chakana mijozlar va kassa hisoboti.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-black text-xs md:text-sm transition-all ${
              tab === id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'tarix' && <PosSalesHistoryTab />}
      {tab === 'mijozlar' && <PosCustomersTab />}
      {tab === 'hisobot' && <PosReportTab />}
    </div>
  );
}

export default function PosCenterPage() {
  return (
    <ModuleGate moduleKey="POS" moduleLabel="Kassa boshqaruvi">
      <Suspense fallback={<PosCenterFallback />}>
        <PosCenterPageContent />
      </Suspense>
    </ModuleGate>
  );
}
