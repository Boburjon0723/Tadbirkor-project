'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Truck, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { useFieldTasks, useFieldMutations } from '@/hooks/field/use-field';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { toast, formatApiError } from '@/lib/toast';
import { RejectReasonModal } from '@/components/RejectReasonModal';

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Biriktirilgan',
  IN_PROGRESS: 'Jarayonda',
  REPORTED: 'Hisobot kutilmoqda',
  APPROVED: 'Tasdiqlangan',
  NEEDS_FIX: 'Qayta hisobot',
  REJECTED: 'Rad etilgan',
  CANCELED: 'Bekor',
};

export default function FieldDashboardPage() {
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { data: tasks = [], isPending, isFetching } = useFieldTasks(filter || undefined);
  const { approveTask, rejectTask } = useFieldMutations();

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await approveTask.mutateAsync(id);
    } catch (e: any) {
      toast.error(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    setBusyId(id);
    try {
      await rejectTask.mutateAsync({ id, reason });
      setRejectingId(null);
    } catch (e: any) {
      toast.error(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  if (isPending && !tasks.length) {
    return (
      <div className="pb-20">
        <PageSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Truck className="text-cyan-400" /> Dala xodimlari
          </h1>
          <p className="text-gray-400 mt-2">Vazifalar, tovar biriktirish va hisobot tasdiqlash</p>
        </div>

        <div className="flex gap-3">
          <Link href="/dashboard/field/workers" className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold text-sm">
            KPI / Balans
          </Link>
          <Link href="/dashboard/field/new" className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-black text-sm">
            <Plus size={18} /> Yangi vazifa
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {['', 'REPORTED', 'IN_PROGRESS', 'ASSIGNED', 'APPROVED'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border ${
              filter === s ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            {s ? STATUS_LABEL[s] || s : 'Hammasi'}
          </button>
        ))}
        {isFetching && !isPending && (
          <span className="text-xs text-cyan-500/80 font-bold ml-2">Yangilanmoqda…</span>
        )}
      </div>

      <div className="grid gap-4">
        {tasks.length === 0 && <p className="text-gray-500 font-bold text-center py-16">Vazifalar yo‘q</p>}
        {tasks.map((t: any) => (
          <div key={t.id} className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="font-black text-xl text-white">{t.title}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t.assignee?.fullName} · {t.sourceWarehouse?.name}
              </p>
              {t.customerName && <p className="text-xs text-gray-500 mt-1">Mijoz: {t.customerName}</p>}
              {t.address && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin size={12} /> {t.address}
                </p>
              )}
              <span className="inline-block mt-3 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/10 text-gray-300">
                {STATUS_LABEL[t.status] || t.status}
              </span>
              {t.report?.gpsDistanceM != null && (
                <span className={`ml-2 text-xs font-bold ${t.report.gpsDistanceM > 500 ? 'text-red-400' : 'text-emerald-400'}`}>
                  GPS: {Math.round(t.report.gpsDistanceM)} m
                </span>
              )}
            </div>
            {t.status === 'REPORTED' && (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => handleApprove(t.id)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-sm disabled:opacity-50"
                >
                  {busyId === t.id ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 size={18} />}
                  Tasdiqlash
                </button>
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => setRejectingId(t.id)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 font-black text-sm"
                >
                  <XCircle size={18} /> Rad
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <RejectReasonModal
        open={!!rejectingId}
        busy={!!rejectingId && busyId === rejectingId}
        onClose={() => {
          if (busyId) return;
          setRejectingId(null);
        }}
        onSubmit={(reason) => (rejectingId ? handleReject(rejectingId, reason) : undefined)}
      />
    </div>
  );
}
