'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield, Search, Crown, RefreshCw } from 'lucide-react';
import { SESSION_QUERY_KEY } from '@/hooks/use-session';
import { platformService, type PlatformCompanyRow } from '@/services/platform.service';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { PlatformAdminPinGate } from '@/components/PlatformAdminPinGate';

export default function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const { data: access, isPending } = useQuery({
    queryKey: ['platform-access'],
    queryFn: () => platformService.getAccess(),
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = access?.isPlatformAdmin === true;

  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => platformService.getStats(),
    enabled: isAdmin,
  });

  const { data: list, isLoading, refetch } = useQuery({
    queryKey: ['platform-companies', search],
    queryFn: () => platformService.listCompanies({ search, page: 1, limit: 50 }),
    enabled: isAdmin,
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof platformService.updateCompany>[1];
    }) => platformService.updateCompany(id, body),
    onSuccess: () => {
      toast.success('Saqlandi');
      void queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (err: Error) => toast.error(err.message || 'Xatolik'),
  });

  if (isPending) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <Shield className="mx-auto text-gray-600" size={48} />
        <h1 className="text-xl font-black">Ruxsat yo‘q</h1>
        <p className="text-gray-500 text-sm">
          Platforma admin paneli faqat administrator uchun.{' '}
          <code className="text-xs bg-white/5 px-2 py-1 rounded">PLATFORM_ADMIN_EMAILS</code> (Railway API)
        </p>
        <Link href="/dashboard" className="text-blue-400 font-bold text-sm">
          Dashboardga qaytish
        </Link>
      </div>
    );
  }

  const statusBadge = (row: PlatformCompanyRow) => {
    const s = row.access.status;
    if (s === 'ACTIVE') return 'bg-emerald-500/20 text-emerald-400';
    if (s === 'TRIAL') return 'bg-blue-500/20 text-blue-400';
    return 'bg-amber-500/20 text-amber-400';
  };

  return (
    <PlatformAdminPinGate isPlatformAdmin={isAdmin}>
    <div className="max-w-6xl space-y-8 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Crown className="text-amber-400" />
            Platforma admin
          </h1>
          <p className="text-gray-500 text-sm mt-1">Kompaniyalar obunasi va sinov muddati</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-300 hover:bg-white/10"
        >
          <RefreshCw size={16} />
          Yangilash
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Jami', value: stats.total },
            { label: 'Faol', value: stats.active },
            { label: 'Sinov', value: stats.trial },
            { label: 'Tugagan', value: stats.expired },
          ].map((s) => (
            <div
              key={s.label}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/5"
            >
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                {s.label}
              </p>
              <p className="text-2xl font-black mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kompaniya, STIR, telefon..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
        />
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {(list?.items || []).map((row) => (
            <div
              key={row.id}
              className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-lg">{row.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    STIR: {row.tin || '—'} · {row.userCount} foydalanuvchi · Sinov tugashi:{' '}
                    {new Date(row.trialEndsAt).toLocaleDateString('uz-UZ')}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusBadge(row)}`}
                >
                  {row.access.labelUz}
                </span>
              </div>

              <textarea
                placeholder="Izoh (to‘lov, kelishuv...)"
                value={noteDraft[row.id] ?? row.subscriptionNote ?? ''}
                onChange={(e) =>
                  setNoteDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                }
                className="w-full min-h-[60px] px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: row.id,
                      body: {
                        subscriptionStatus: 'ACTIVE',
                        subscriptionNote: noteDraft[row.id],
                      },
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-black"
                >
                  Faol qilish
                </button>
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: row.id,
                      body: { extendTrialDays: 7, subscriptionNote: noteDraft[row.id] },
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-black"
                >
                  +7 kun sinov
                </button>
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: row.id,
                      body: {
                        subscriptionStatus: 'EXPIRED',
                        subscriptionNote: noteDraft[row.id],
                      },
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-400 text-xs font-black"
                >
                  Bloklash
                </button>
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: row.id,
                      body: { subscriptionNote: noteDraft[row.id] },
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-black"
                >
                  Izohni saqlash
                </button>
              </div>
            </div>
          ))}
          {!list?.items?.length && (
            <p className="text-center text-gray-500 py-12">Kompaniya topilmadi</p>
          )}
        </div>
      )}
    </div>
    </PlatformAdminPinGate>
  );
}
