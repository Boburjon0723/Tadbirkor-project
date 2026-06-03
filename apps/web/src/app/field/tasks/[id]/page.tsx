'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, MapPin, Package, CheckCircle2, PlayCircle } from 'lucide-react';
import { fieldService } from '@/services/field.service';
import { FIELD_TASK_STATUS_LABEL, fieldStatusBadgeClass } from '@/lib/field-status';
import { mergeTaskReportRows } from '@/lib/field-report';
import { FieldReportSummary } from '@/components/field/FieldReportSummary';
import { toast, formatApiError } from '@/lib/toast';

export default function FieldTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fieldService.myTask(id).then(setTask).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const accept = async () => {
    setBusy(true);
    try {
      await fieldService.acceptTask(id!);
      load();
    } catch (e: any) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !task) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="animate-spin text-cyan-500" />
      </div>
    );
  }

  const planned: any[] = Array.isArray(task.plannedItems) ? task.plannedItems : [];
  const isAssigned = task.status === 'ASSIGNED';
  const isInProgress = task.status === 'IN_PROGRESS';
  const canFinish = ['IN_PROGRESS', 'NEEDS_FIX'].includes(task.status);
  const isApproved = task.status === 'APPROVED';
  const isReported = task.status === 'REPORTED';
  const hasReport = Boolean(task.report?.items);
  const reportRows = hasReport ? mergeTaskReportRows(task) : [];
  const showPlannedList = !isApproved;
  const backHref =
    searchParams.get('from') === 'history' || isApproved ? '/field/history' : '/field';

  return (
    <div className="space-y-6 pb-8">
      <Link href={backHref} className="text-cyan-400 text-sm font-bold">
        ← Orqaga
      </Link>

      <div className="space-y-2">
        <span
          className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${fieldStatusBadgeClass(task.status)}`}
        >
          {FIELD_TASK_STATUS_LABEL[task.status] || task.status}
        </span>
        <h1 className="text-2xl font-black">{task.title}</h1>
        {task.description && <p className="text-sm text-gray-400">{task.description}</p>}
        {task.address && (
          <p className="text-sm text-gray-400 flex gap-1 items-start">
            <MapPin size={14} className="shrink-0 mt-0.5" />
            {task.address}
          </p>
        )}
        {task.customerName && (
          <p className="text-xs text-gray-500">
            Mijoz: {task.customerName}
            {task.customerPhone ? ` · ${task.customerPhone}` : ''}
          </p>
        )}
      </div>

      {isInProgress && (
        <div className="flex gap-3 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25">
          <CheckCircle2 className="text-cyan-400 shrink-0" size={22} />
          <div>
            <p className="font-black text-cyan-300 text-sm">Topshiriqni qabul qildingiz</p>
            <p className="text-xs text-gray-400 mt-1">Ishni bajarib, tugagach «Tugatdim» tugmasini bosing</p>
          </div>
        </div>
      )}

      {showPlannedList && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Package size={16} className="text-cyan-400" />
            <p className="text-xs font-black uppercase tracking-widest text-gray-500">
              Vazifa bo‘yicha mahsulotlar
            </p>
          </div>
          <ul className="divide-y divide-white/5">
            {planned.map((p: any) => (
              <li key={p.variantId} className="px-4 py-3 flex justify-between gap-3">
                <span className="font-bold text-sm text-white">{p.label || 'Mahsulot'}</span>
                <span className="text-cyan-400 font-black text-sm shrink-0">{p.qty} dona</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasReport && (isApproved || isReported) && (
        <FieldReportSummary
          rows={reportRows}
          subtitle={
            isReported ? 'Hisobot yuborilgan — menejer tasdiqlashini kuting' : undefined
          }
        />
      )}

      {isAssigned && (
        <button
          type="button"
          disabled={busy}
          onClick={accept}
          className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black flex items-center justify-center gap-2"
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              <PlayCircle size={20} />
              Qabul qildim va ishni boshladim
            </>
          )}
        </button>
      )}

      {canFinish && (
        <button
          type="button"
          onClick={() => router.push(`/field/tasks/${id}/report`)}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black"
        >
          Tugatdim — hisobot
        </button>
      )}

      {isReported && !hasReport && (
        <p className="text-center text-sm text-gray-500 font-bold">
          Hisobot yuborilgan. Menejer tasdiqlashini kuting.
        </p>
      )}
    </div>
  );
}
