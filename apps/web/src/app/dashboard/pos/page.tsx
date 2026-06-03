'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, Users, BarChart3, CreditCard } from 'lucide-react';
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

export default function PosCenterPage() {
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
    <ModuleGate moduleKey="POS" moduleLabel="POS markazi">
      <div className="space-y-8 pb-20">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="text-blue-500" size={28} />
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">
              POS <span className="text-blue-500">markazi</span>
            </h1>
          </div>
          <p className="text-gray-400 text-sm md:text-lg">
            Kassa tarixi, chakana mijozlar (POS) va hisobot — B2B hamkorlar alohida.
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
    </ModuleGate>
  );
}
