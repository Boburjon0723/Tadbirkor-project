'use client';

import React from 'react';
import { Gift, HandCoins, Palmtree } from 'lucide-react';
import {
  PAYROLL_STATUS_LABEL,
  PAYROLL_STATUS_STYLE,
  type PayrollEmployeeRow,
} from '@/lib/payroll-employees';
import { formatSalaryTableAmount } from '@/lib/payroll-labels';
import { isPayrollSalaryClosed, payrollSalarySubline } from '@/lib/payroll-salary-display';

type MonthStatsSlice = {
  advancesByUser: Record<string, number>;
  paymentConfirmedByUser: Record<string, boolean>;
  paidAmountByUser: Record<string, number>;
  bonusByUser: Record<string, number>;
};

type Props = {
  row: PayrollEmployeeRow;
  monthLabel: string;
  leaveDays: number;
  stats: MonthStatsSlice;
  canManage: boolean;
  onAdvance: () => void;
  onLeave: () => void;
  onBonus: () => void;
  menuSlot: React.ReactNode;
};

function MetricCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate">
        {label}
      </p>
      <p className={`text-sm font-black mt-1 truncate ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export function EmployeeActionButtons({
  row,
  advancesTotal,
  canManage,
  onAdvance,
  onLeave,
  onBonus,
  paymentCompleted = false,
  layout = 'row',
}: {
  row: PayrollEmployeeRow;
  advancesTotal: number;
  canManage: boolean;
  onAdvance: () => void;
  onLeave: () => void;
  onBonus: () => void;
  paymentCompleted?: boolean;
  layout?: 'row' | 'stack';
}) {
  if (!canManage) {
    return <span className="text-[10px] font-bold text-gray-600">—</span>;
  }

  const wrap =
    layout === 'stack'
      ? 'flex flex-col gap-2 w-full'
      : 'flex flex-nowrap items-center justify-center gap-1.5';

  const btn =
    'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap';
  const btnSm = `${btn} shrink-0`;
  const advanceLabel = 'Avans/To‘lov';

  if (row.salary <= 0) {
    return (
      <div className={wrap}>
        <span className="text-[10px] font-bold text-gray-600 w-full text-center">Maosh yo‘q</span>
        <button
          type="button"
          onClick={onLeave}
          className={`${btnSm} bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 w-full sm:w-auto`}
        >
          <Palmtree size={12} />
          Dam olish
        </button>
      </div>
    );
  }

  const salaryCovered = isPayrollSalaryClosed({
    salary: row.salary,
    advancesTotal,
    paymentConfirmed: paymentCompleted,
  });

  return (
    <div className={wrap}>
      {salaryCovered ? (
        <span
          className={`${btnSm} bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 cursor-default`}
          title="Oylik to‘liq to‘langan"
        >
          <HandCoins size={12} />
          To‘langan
        </span>
      ) : (
        <button
          type="button"
          onClick={onAdvance}
          className={`${btnSm} bg-violet-600/20 text-violet-300 border border-violet-500/30`}
        >
          <HandCoins size={12} />
          {advanceLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onBonus}
        className={`${btnSm} bg-amber-600/20 text-amber-300 border border-amber-500/30`}
      >
        <Gift size={12} />
        Bonus
      </button>
      <button
        type="button"
        onClick={onLeave}
        className={`${btnSm} bg-teal-600/15 text-teal-300 border border-teal-500/30`}
      >
        <Palmtree size={12} />
        Dam olish
      </button>
    </div>
  );
}

export function PayrollEmployeeMobileCard({
  row,
  monthLabel,
  leaveDays,
  stats,
  canManage,
  onAdvance,
  onLeave,
  onBonus,
  menuSlot,
}: Props) {
  const advanceTotal = stats.advancesByUser[row.companyUserId] ?? 0;
  const paymentCompleted = stats.paymentConfirmedByUser[row.companyUserId];
  const bonusTotal = stats.bonusByUser[row.companyUserId] ?? 0;
  const salarySub = payrollSalarySubline({
    salary: row.salary,
    advancesTotal: advanceTotal,
    paymentConfirmed: paymentCompleted,
    paidAmount: stats.paidAmountByUser[row.companyUserId],
    bonus: bonusTotal,
  });

  return (
    <article className="glass-card rounded-2xl border border-white/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/20 border border-white/10 flex items-center justify-center text-sm font-black text-violet-300 shrink-0">
            {row.initials}
          </div>
          <div className="min-w-0">
            <p className="font-black text-white truncate">{row.fullName}</p>
            <p className="text-xs font-bold text-gray-500 truncate">
              {row.position} · {row.department}
            </p>
            <p className="text-[10px] font-mono font-bold text-gray-600 mt-0.5">{row.employeeId}</p>
            <span
              className={`inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${PAYROLL_STATUS_STYLE[row.status]}`}
            >
              {PAYROLL_STATUS_LABEL[row.status]}
            </span>
          </div>
        </div>
        {menuSlot}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCell
          label="Maosh"
          value={row.salary > 0 ? formatSalaryTableAmount(row.salary) : '—'}
        />
        <MetricCell
          label={
            salarySub.kind === 'paid'
              ? 'To‘langan'
              : salarySub.kind === 'advance'
                ? 'Avans'
                : salarySub.kind === 'bonus'
                  ? 'Bonus'
                  : 'To‘lov'
          }
          value={
            salarySub.kind !== 'none'
              ? formatSalaryTableAmount(salarySub.amount)
              : '—'
          }
          accent={
            salarySub.kind === 'paid'
              ? 'text-emerald-400'
              : 'text-amber-300'
          }
        />
        <MetricCell
          label={`Dam olish (${monthLabel})`}
          value={leaveDays > 0 ? `${leaveDays} kun` : '—'}
        />
      </div>

      <EmployeeActionButtons
        row={row}
        advancesTotal={advanceTotal}
        canManage={canManage}
        onAdvance={onAdvance}
        onLeave={onLeave}
        onBonus={onBonus}
        paymentCompleted={paymentCompleted}
        layout="stack"
      />
    </article>
  );
}
