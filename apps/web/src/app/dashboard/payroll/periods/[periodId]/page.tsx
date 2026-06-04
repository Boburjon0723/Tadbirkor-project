'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Calculator,
  CheckCircle2,
  Banknote,
  Plus,
  FileText,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { AddPayrollAdjustmentModal } from '@/features/payroll/AddPayrollAdjustmentModal';
import { PayrollPayslipModal } from '@/features/payroll/PayrollPayslipModal';
import {
  usePayrollMutations,
  usePayrollPeriod,
} from '@/hooks/payroll/use-payroll';
import { usePayrollAccess } from '@/hooks/use-payroll-access';
import {
  formatPayrollMonth,
  formatPayrollMoney,
  PERIOD_STATUS_LABEL,
  PERIOD_STATUS_STYLE,
  RUN_STATUS_LABEL,
} from '@/lib/payroll-labels';
import type { PayrollRun } from '@/lib/payroll-types';
import { ROLE_LABELS, type SystemRole } from '@/lib/roles';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';

export default function PayrollPeriodDetailPage() {
  const params = useParams();
  const periodId = String(params.periodId || '');
  const { data: period, isLoading } = usePayrollPeriod(periodId);
  const mutations = usePayrollMutations();
  const { canCalculate, canApprove, canPay, loading: accessLoading } = usePayrollAccess();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [adjustRun, setAdjustRun] = useState<PayrollRun | null>(null);
  const [payslipRun, setPayslipRun] = useState<PayrollRun | null>(null);

  const isEditable =
    period && !['PAID', 'CLOSED'].includes(period.status);

  const handleCalculate = async () => {
    setBusyAction('calculate');
    try {
      await mutations.calculatePeriod.mutateAsync(periodId);
      toast.success('Oylik hisoblandi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async () => {
    const ok = await confirmAction('Ushbu davrni tasdiqlaysizmi?', {
      title: 'Tasdiqlash',
      confirmLabel: 'Tasdiqlash',
    });
    if (!ok) return;
    setBusyAction('approve');
    try {
      await mutations.approvePeriod.mutateAsync(periodId);
      toast.success('Davr tasdiqlandi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleMarkPaid = async () => {
    const ok = await confirmAction('To‘lov amalga oshirilgan deb belgilaysizmi?', {
      title: 'To‘langan',
      confirmLabel: 'Ha, to‘landi',
    });
    if (!ok) return;
    setBusyAction('paid');
    try {
      await mutations.markPeriodPaid.mutateAsync(periodId);
      toast.success('To‘langan deb belgilandi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleClose = async () => {
    const ok = await confirmAction('Davr yopiladi — keyin o‘zgartirib bo‘lmaydi.', {
      title: 'Davrni yopish',
      variant: 'danger',
      confirmLabel: 'Yopish',
    });
    if (!ok) return;
    setBusyAction('close');
    try {
      await mutations.closePeriod.mutateAsync(periodId);
      toast.success('Davr yopildi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyAction(null);
    }
  };

  const handleAdjustment = async (payload: {
    type: Parameters<typeof mutations.addAdjustment.mutateAsync>[0]['type'];
    label: string;
    amount: number;
  }) => {
    if (!adjustRun) return;
    try {
      await mutations.addAdjustment.mutateAsync({
        periodId,
        runId: adjustRun.id,
        ...payload,
      });
      toast.success('Qo‘shildi');
      setAdjustRun(null);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const totalNetUzs =
    period?.runs.reduce(
      (acc, r) => acc + (r.currency === 'UZS' ? r.netAmount : 0),
      0,
    ) ?? 0;

  return (
    <ModuleGate moduleKey="PAYROLL" moduleLabel="Oylik">
      <div className="space-y-8 pb-20">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/payroll/periods"
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            {period ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black tracking-tight">
                    {formatPayrollMonth(period.year, period.month)}
                  </h1>
                  <span
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      PERIOD_STATUS_STYLE[period.status]
                    }`}
                  >
                    {PERIOD_STATUS_LABEL[period.status]}
                  </span>
                </div>
                <p className="text-gray-500 font-bold text-sm mt-1">
                  Jami to‘lanadigan: {formatPayrollMoney(totalNetUzs, 'UZS')}
                </p>
              </>
            ) : (
              <h1 className="text-3xl font-black">Oylik davri</h1>
            )}
          </div>
        </div>

        {isLoading || accessLoading ? (
          <PageSkeleton rows={6} />
        ) : !period ? (
          <p className="text-center text-gray-500 font-bold py-20">Davr topilmadi</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {canCalculate && isEditable && (
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={!!busyAction}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm disabled:opacity-50"
                >
                  {busyAction === 'calculate' ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Calculator size={18} />
                  )}
                  Hisoblash
                </button>
              )}
              {canApprove && period.status === 'CALCULATED' && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={!!busyAction}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-sm disabled:opacity-50"
                >
                  {busyAction === 'approve' ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  Tasdiqlash
                </button>
              )}
              {canPay && period.status === 'APPROVED' && (
                <button
                  type="button"
                  onClick={handleMarkPaid}
                  disabled={!!busyAction}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-black text-sm disabled:opacity-50"
                >
                  {busyAction === 'paid' ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Banknote size={18} />
                  )}
                  To‘langan deb belgilash
                </button>
              )}
              {period.status === 'PAID' && (
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={!!busyAction}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 font-black text-sm disabled:opacity-50"
                >
                  Davrni yopish
                </button>
              )}
            </div>

            {period.runs.length === 0 ? (
              <div className="glass-card rounded-3xl border border-white/5 p-12 text-center">
                <p className="font-black text-gray-400">Xodimlar hali hisoblanmagan</p>
                <p className="text-sm text-gray-600 mt-2 font-bold">
                  Xodimlar sahifasida oylik belgilang, keyin «Hisoblash» tugmasini bosing
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="text-left py-4 px-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Xodim
                      </th>
                      <th className="text-right py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Asosiy
                      </th>
                      <th className="text-right py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Qo‘shimcha
                      </th>
                      <th className="text-right py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Ushlab qolish
                      </th>
                      <th className="text-right py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        To‘lanadigan
                      </th>
                      <th className="text-right py-4 px-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Amallar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {period.runs.map((run) => (
                      <tr key={run.id} className="hover:bg-white/[0.02]">
                        <td className="py-4 px-6">
                          <span className="font-black text-white">{run.employeeName}</span>
                          <p className="text-xs text-gray-500 font-bold">
                            {ROLE_LABELS[run.employeeRole as SystemRole] || run.employeeRole} ·{' '}
                            {RUN_STATUS_LABEL[run.status]}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-gray-300">
                          {formatPayrollMoney(run.baseAmount, run.currency)}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-emerald-400">
                          {run.bonusAmount > 0
                            ? `+${formatPayrollMoney(run.bonusAmount, run.currency)}`
                            : '—'}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-red-400">
                          {run.deductionAmount + run.advanceAmount > 0
                            ? `−${formatPayrollMoney(
                                run.deductionAmount + run.advanceAmount,
                                run.currency,
                              )}`
                            : '—'}
                        </td>
                        <td className="py-4 px-4 text-right font-black text-violet-300">
                          {formatPayrollMoney(run.netAmount, run.currency)}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setPayslipRun(run)}
                              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                              title="Payslip"
                            >
                              <FileText size={16} />
                            </button>
                            {isEditable && canCalculate && (
                              <button
                                type="button"
                                onClick={() => setAdjustRun(run)}
                                className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20"
                                title="Qo‘shimcha"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <AddPayrollAdjustmentModal
          open={!!adjustRun}
          employeeName={adjustRun?.employeeName}
          onClose={() => setAdjustRun(null)}
          onSubmit={handleAdjustment}
          busy={mutations.addAdjustment.isPending}
        />

        <PayrollPayslipModal
          open={!!payslipRun}
          period={period ?? null}
          run={payslipRun}
          onClose={() => setPayslipRun(null)}
        />
      </div>
    </ModuleGate>
  );
}
