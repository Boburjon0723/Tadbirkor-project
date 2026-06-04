'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  Plus,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { CreatePayrollPeriodModal } from '@/features/payroll/CreatePayrollPeriodModal';
import {
  usePayrollMutations,
  usePayrollPeriods,
  usePayrollSummary,
} from '@/hooks/payroll/use-payroll';
import { usePayrollAccess } from '@/hooks/use-payroll-access';
import {
  formatPayrollMonth,
  formatPayrollMoney,
  PERIOD_STATUS_LABEL,
  PERIOD_STATUS_STYLE,
  sumByCurrency,
} from '@/lib/payroll-labels';
import { toast, formatApiError } from '@/lib/toast';

export default function PayrollPeriodsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { canManage, loading: accessLoading } = usePayrollAccess();
  const { data: periods = [], isPending: periodsLoading } = usePayrollPeriods();
  const { data: summary } = usePayrollSummary();
  const mutations = usePayrollMutations();

  const handleCreate = async (payload: { year: number; month: number; notes?: string }) => {
    try {
      const period = await mutations.createPeriod.mutateAsync(payload);
      toast.success(`${formatPayrollMonth(period.year, period.month)} davri yaratildi`);
      setModalOpen(false);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const loading = periodsLoading || accessLoading;

  return (
    <ModuleGate moduleKey="PAYROLL" moduleLabel="Oylik">
      <div className="space-y-8 pb-20">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/payroll"
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Banknote className="text-violet-400" /> Oylik davrlari
              </h1>
              <p className="text-gray-500 font-bold text-sm mt-1">
                Hisoblash, tasdiqlash va to‘lov holati
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-black text-sm"
              >
                <Plus size={18} /> Yangi davr
              </button>
            )}
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-violet-500/20">
              <p className="text-xs font-black uppercase text-violet-400/80 tracking-widest">
                Jami to‘lanadigan (UZS)
              </p>
              <p className="text-2xl font-black text-white mt-2">
                {formatPayrollMoney(sumByCurrency(summary.totalNet, 'UZS'), 'UZS')}
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-blue-500/20">
              <p className="text-xs font-black uppercase text-blue-400/80 tracking-widest">
                Hisoblangan
              </p>
              <p className="text-2xl font-black text-white mt-2">
                {summary.byStatus.CALCULATED + summary.byStatus.APPROVED}
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-emerald-500/20">
              <p className="text-xs font-black uppercase text-emerald-400/80 tracking-widest">
                To‘langan
              </p>
              <p className="text-2xl font-black text-white mt-2">{summary.byStatus.PAID}</p>
            </div>
          </div>
        )}

        {loading ? (
          <PageSkeleton rows={4} />
        ) : periods.length === 0 ? (
          <div className="glass-card rounded-3xl border border-white/5 p-16 text-center">
            <Calculator className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="font-black text-xl text-gray-400">Hozircha davrlar yo‘q</p>
            {canManage && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-6 px-6 py-3 rounded-2xl bg-violet-600 font-black text-sm"
              >
                Birinchi davrni yaratish
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {periods.map((period) => {
              const totalNet = period.runs.reduce(
                (acc, r) => acc + (r.currency === 'UZS' ? r.netAmount : 0),
                0,
              );
              return (
                <Link
                  key={period.id}
                  href={`/dashboard/payroll/periods/${period.id}`}
                  className="glass-card p-6 rounded-3xl border border-white/5 flex items-center justify-between gap-4 hover:border-violet-500/30 transition-colors group"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-xl text-white">
                        {formatPayrollMonth(period.year, period.month)}
                      </p>
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          PERIOD_STATUS_STYLE[period.status]
                        }`}
                      >
                        {PERIOD_STATUS_LABEL[period.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2 font-bold">
                      {period.runs.length} xodim ·{' '}
                      {totalNet > 0
                        ? formatPayrollMoney(totalNet, 'UZS')
                        : 'hali hisoblanmagan'}
                    </p>
                  </div>
                  <ChevronRight
                    className="text-gray-600 group-hover:text-violet-400 transition-colors shrink-0"
                    size={24}
                  />
                </Link>
              );
            })}
          </div>
        )}

        <CreatePayrollPeriodModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
          busy={mutations.createPeriod.isPending}
        />
      </div>
    </ModuleGate>
  );
}
