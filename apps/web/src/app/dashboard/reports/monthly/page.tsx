'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet2,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { useMonthlyOverview } from '@/hooks/reports/use-monthly-overview';
import type { MonthlyOverview } from '@/services/reports.service';

function formatMoney(amount: number, currency = 'UZS') {
  if (currency === 'USD') {
    return `${amount.toFixed(2)} USD`;
  }
  return `${Math.round(amount).toLocaleString('uz-UZ')} UZS`;
}

function bucketUZS(record?: Record<string, number>) {
  return Number(record?.UZS || 0);
}

function formatMonthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('uz-UZ', {
    month: 'long',
    year: 'numeric',
  });
}

function ProfitHero({ data }: { data: MonthlyOverview }) {
  const { status, netProfit } = data.result;
  const isProfit = status === 'PROFIT';
  const isLoss = status === 'LOSS';

  return (
    <div
      className={`rounded-2xl border p-6 md:p-8 ${
        isProfit
          ? 'border-emerald-400/30 bg-emerald-500/10'
          : isLoss
            ? 'border-red-400/30 bg-red-500/10'
            : 'border-white/10 bg-white/5'
      }`}
    >
      <p className="text-xs font-black uppercase tracking-widest text-gray-400">
        Oy yakuni (naqd oqim)
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        {isProfit ? (
          <TrendingUp className="text-emerald-400" size={40} />
        ) : isLoss ? (
          <TrendingDown className="text-red-400" size={40} />
        ) : (
          <Wallet2 className="text-gray-400" size={40} />
        )}
        <div>
          <p
            className={`text-3xl md:text-4xl font-black tabular-nums ${
              isProfit ? 'text-emerald-300' : isLoss ? 'text-red-300' : 'text-white'
            }`}
          >
            {isProfit ? '+' : ''}
            {formatMoney(netProfit.UZS)}
          </p>
          <p className="mt-1 text-sm font-bold text-gray-500">
            {isProfit ? 'Foyda' : isLoss ? 'Zarar' : 'Neytral'} ·{' '}
            {formatMonthTitle(data.period.year, data.period.month)}
          </p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-emerald-300">
            <ArrowDownRight size={14} /> Kirim (naqd)
          </p>
          <p className="mt-2 text-xl font-black text-white">
            {formatMoney(data.result.cashIn.UZS)}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-amber-300">
            <ArrowUpRight size={14} /> Chiqim
          </p>
          <p className="mt-2 text-xl font-black text-white">
            {formatMoney(data.result.cashOut.UZS)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MonthlyFinanceReportPage() {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth() + 1;

  const { data, isPending, isFetching, refetch } = useMonthlyOverview(year, month);

  const moveMonth = (delta: number) => {
    setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const sections = useMemo(() => {
    if (!data) return null;
    const pos = data.revenue.pos;
    const income = data.revenue.income;
    const expenses = data.costs.expenses;
    const payroll = data.costs.payroll;

    return [
      {
        key: 'pos',
        enabled: data.modules.pos,
        title: 'POS savdo',
        href: '/dashboard/pos?tab=hisobot',
        lines: pos
          ? [
              { label: 'Sof savdo', value: bucketUZS(pos.netSales) },
              { label: 'Naqd + karta (hisobotga kirgan)', value: bucketUZS(pos.cashSales) + bucketUZS(pos.cardSales) },
              { label: 'Nasiya (pul hali kelmagan)', value: bucketUZS(pos.creditSales) },
              { label: 'Cheklar', value: pos.receiptsCount, money: false },
            ]
          : [],
      },
      {
        key: 'income',
        enabled: data.modules.income,
        title: 'Kirimlar daftari',
        href: '/dashboard/income',
        lines: income
          ? [{ label: 'Jami', value: bucketUZS(income.totals) }]
          : [],
      },
      {
        key: 'expenses',
        enabled: data.modules.expenses,
        title: 'Xarajatlar (tasdiqlangan)',
        href: '/dashboard/expenses',
        lines: expenses
          ? [
              { label: 'Tasdiqlangan', value: bucketUZS(expenses.approved) },
              { label: 'Kutilmoqda', value: bucketUZS(expenses.pending) },
            ]
          : [],
      },
      {
        key: 'payroll',
        enabled: data.modules.payroll,
        title: 'Xodimlar oyligi',
        href: '/dashboard/payroll',
        lines: payroll
          ? [
              { label: 'Avanslar', value: payroll.advancesUZS },
              { label: 'Bonuslar', value: payroll.bonusUZS },
              { label: 'Chiqim (avans + bonus)', value: payroll.cashOutUZS },
              { label: 'Hisoblangan qoldiq (maosh)', value: payroll.accruedSalaryUZS },
            ]
          : [],
      },
    ];
  }, [data]);

  return (
    <ModuleGate moduleKey="REPORTS" moduleLabel="Hisobotlar">
      <div className="space-y-6 pb-20">
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white"
        >
          <ArrowLeft size={18} /> Ombor hisobotlari
        </Link>

        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-violet-300">
              Moliya · oy hisoboti
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">Oy moliyasi</h1>
            <p className="mt-2 max-w-xl text-sm font-bold text-gray-500">
              POS (naqd/karta), kirimlar, tasdiqlangan xarajatlar va oylik chiqimlari. Foyda =
              kirim − chiqim.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex min-w-[190px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-black capitalize">
              <CalendarDays size={18} className="text-violet-300" />
              {formatMonthTitle(year, month)}
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date())}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"
            >
              Hozirgi oy
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {isFetching ? <Loader2 className="animate-spin inline" size={16} /> : 'Yangilash'}
            </button>
          </div>
        </section>

        {isPending ? (
          <PageSkeleton rows={6} />
        ) : data ? (
          <>
            <ProfitHero data={data} />

            {data.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-200">
                {data.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sections?.map((section) => (
                <div
                  key={section.key}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-black text-white">{section.title}</h2>
                    {section.enabled && section.href ? (
                      <Link
                        href={section.href}
                        className="text-xs font-black text-violet-300 hover:text-violet-200"
                      >
                        Batafsil →
                      </Link>
                    ) : (
                      <span className="text-xs font-black text-gray-500">Modul o‘chiq</span>
                    )}
                  </div>
                  {!section.enabled ? (
                    <p className="mt-4 text-sm font-bold text-gray-500">
                      Sozlamalarda modulni yoqing yoki bu oyda hisobga olinmaydi.
                    </p>
                  ) : section.lines.length === 0 ? (
                    <p className="mt-4 text-sm font-bold text-gray-500">Bu oyda yozuv yo‘q</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {section.lines.map((line) => (
                        <li
                          key={line.label}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="font-bold text-gray-400">{line.label}</span>
                          <span className="font-black text-white tabular-nums">
                            {'money' in line && line.money === false
                              ? String(line.value)
                              : formatMoney(Number(line.value))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-center font-bold text-gray-500">Ma’lumot yuklanmadi</p>
        )}
      </div>
    </ModuleGate>
  );
}
