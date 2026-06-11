'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Loader2, Search, RefreshCw } from 'lucide-react';
import { SESSION_QUERY_KEY } from '@/hooks/use-session';
import { platformService, type PlatformCompanyRow } from '@/services/platform.service';
import { toast } from '@/lib/toast';

function toDateInputValue(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function PlatformCompaniesPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [trialDraft, setTrialDraft] = useState<Record<string, string>>({});
  const [extendDraft, setExtendDraft] = useState<Record<string, string>>({});
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, string>>({});
  const [scheduleAction, setScheduleAction] = useState<Record<string, 'ACTIVE' | 'EXPIRED'>>({});

  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => platformService.getStats(),
  });

  const { data: list, isLoading, refetch } = useQuery({
    queryKey: ['platform-companies', search],
    queryFn: () => platformService.listCompanies({ search, page: 1, limit: 50 }),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof platformService.updateCompany>[1];
    }) => platformService.updateCompany(id, body),
    onSuccess: (data: { kind?: string; runAt?: string }) => {
      if (data?.kind && data?.runAt) {
        toast.success('Reja yaratildi');
        void queryClient.invalidateQueries({ queryKey: ['platform-scheduled-jobs'] });
      } else {
        toast.success('Saqlandi');
      }
      void queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (err: Error) => toast.error(err.message || 'Xatolik'),
  });

  const statusBadge = (row: PlatformCompanyRow) => {
    const s = row.access.status;
    if (s === 'ACTIVE') return 'bg-emerald-500/20 text-emerald-400';
    if (s === 'TRIAL') return 'bg-blue-500/20 text-blue-400';
    return 'bg-amber-500/20 text-amber-400';
  };

  const noteFor = (row: PlatformCompanyRow) => noteDraft[row.id] ?? row.subscriptionNote ?? '';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Kompaniyalar</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Obuna, sinov muddati, vaqt belgilash va bloklash
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-neutral-300 hover:bg-white/10"
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
            <div key={s.label} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">
                {s.label}
              </p>
              <p className="text-2xl font-black mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kompaniya, STIR, telefon..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
        />
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {(list?.items || []).map((row) => (
            <div
              key={row.id}
              className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-lg">{row.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    STIR: {row.tin || '—'} · {row.userCount} foydalanuvchi · Holat:{' '}
                    {row.status}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Sinov tugashi: {new Date(row.trialEndsAt).toLocaleDateString('uz-UZ')}
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
                value={noteFor(row)}
                onChange={(e) =>
                  setNoteDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                }
                className="w-full min-h-[60px] px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs"
              />

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1 mb-1">
                    <Calendar size={12} />
                    Sinov tugash sanasi
                  </label>
                  <input
                    type="date"
                    value={trialDraft[row.id] ?? toDateInputValue(row.trialEndsAt)}
                    onChange={(e) =>
                      setTrialDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-500 mb-1 block">
                    Kun qo‘shish
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    placeholder="7"
                    value={extendDraft[row.id] ?? ''}
                    onChange={(e) =>
                      setExtendDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-500 mb-1 block">
                    Rejalashtirish
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={scheduleAction[row.id] ?? 'EXPIRED'}
                      onChange={(e) =>
                        setScheduleAction((prev) => ({
                          ...prev,
                          [row.id]: e.target.value as 'ACTIVE' | 'EXPIRED',
                        }))
                      }
                      className="flex-1 px-2 py-2 rounded-xl bg-black/30 border border-white/10 text-xs font-bold"
                    >
                      <option value="EXPIRED">Bloklash</option>
                      <option value="ACTIVE">Faollashtirish</option>
                    </select>
                    <input
                      type="datetime-local"
                      value={scheduleDraft[row.id] ?? ''}
                      onChange={(e) =>
                        setScheduleDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      className="flex-1 px-2 py-2 rounded-xl bg-black/30 border border-white/10 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: row.id,
                      body: {
                        subscriptionStatus: 'ACTIVE',
                        subscriptionNote: noteFor(row),
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
                  onClick={() => {
                    const days = parseInt(extendDraft[row.id] || '7', 10);
                    updateMut.mutate({
                      id: row.id,
                      body: {
                        extendTrialDays: Number.isFinite(days) ? days : 7,
                        subscriptionNote: noteFor(row),
                      },
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-black"
                >
                  Kun qo‘shish
                </button>
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() => {
                    const dateVal = trialDraft[row.id] ?? toDateInputValue(row.trialEndsAt);
                    if (!dateVal) return;
                    updateMut.mutate({
                      id: row.id,
                      body: {
                        trialEndsAt: new Date(dateVal).toISOString(),
                        subscriptionNote: noteFor(row),
                      },
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-black"
                >
                  Sanani saqlash
                </button>
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: row.id,
                      body: {
                        subscriptionStatus: 'EXPIRED',
                        subscriptionNote: noteFor(row),
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
                      body: {
                        companyStatus: row.status === 'suspended' ? 'active' : 'suspended',
                        subscriptionNote: noteFor(row),
                      },
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-black"
                >
                  {row.status === 'suspended' ? 'To‘xtatishni olib tashlash' : 'To‘xtatish'}
                </button>
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() => {
                    const local = scheduleDraft[row.id];
                    if (!local) {
                      toast.error('Reja vaqtini tanlang');
                      return;
                    }
                    updateMut.mutate({
                      id: row.id,
                      body: {
                        subscriptionStatus: scheduleAction[row.id] ?? 'EXPIRED',
                        scheduleAt: new Date(local).toISOString(),
                        subscriptionNote: noteFor(row),
                      },
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-black"
                >
                  Rejani saqlash
                </button>
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: row.id,
                      body: { subscriptionNote: noteFor(row) },
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-neutral-400 text-xs font-black"
                >
                  Izohni saqlash
                </button>
              </div>
            </div>
          ))}
          {!list?.items?.length && (
            <p className="text-center text-neutral-500 py-12">Kompaniya topilmadi</p>
          )}
        </div>
      )}
    </div>
  );
}
