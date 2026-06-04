'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  daysInMonth,
  isWeekend,
  monthLabel,
  toDateKey,
  weekdayShortUz,
} from '@/lib/payroll-leave-dates.util';

type Props = {
  year: number;
  month: number;
  selectedDates: Set<string>;
  onToggleDate: (dateKey: string) => void;
  onChangeMonth: (year: number, month: number) => void;
  maxSelectable?: number;
  paidLeaveQuota: number;
};

export function PayrollMonthLeaveCalendar({
  year,
  month,
  selectedDates,
  onToggleDate,
  onChangeMonth,
  maxSelectable,
  paidLeaveQuota,
}: Props) {
  const totalDays = daysInMonth(year, month);
  const selectedCount = selectedDates.size;
  const overQuota = selectedCount > paidLeaveQuota;
  const salaryImpactDays = Math.max(0, selectedCount - paidLeaveQuota);

  const cells = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    const items: Array<{ key: string; day: number } | null> = [];
    for (let i = 0; i < offset; i++) items.push(null);
    for (let d = 1; d <= totalDays; d++) {
      items.push({ key: toDateKey(year, month, d), day: d });
    }
    return items;
  }, [year, month, totalDays]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    onChangeMonth(y, m);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-black text-white">{monthLabel(year, month)}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-500">
        {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`e-${idx}`} />;
          const weekend = isWeekend(year, month, cell.day);
          const selected = selectedDates.has(cell.key);
          const blocked =
            maxSelectable != null &&
            !selected &&
            selectedCount >= maxSelectable;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={blocked}
              onClick={() => onToggleDate(cell.key)}
              className={[
                'aspect-square rounded-lg text-xs font-black transition-colors',
                weekend ? 'text-gray-600' : 'text-gray-300',
                selected
                  ? 'bg-emerald-600 text-white border border-emerald-400'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10',
                blocked ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
              title={weekdayShortUz(new Date(year, month - 1, cell.day))}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="text-xs font-bold space-y-1">
        <p className="text-gray-400">
          Tanlangan: <span className="text-white">{selectedCount}</span> kun · Limit:{' '}
          <span className="text-emerald-300">{paidLeaveQuota}</span> kun (maoshga ta’sir
          qilmaydi)
        </p>
        {overQuota && (
          <p className="text-amber-400">
            Limitdan {salaryImpactDays} kun ortiq — oylik hisobidan ayiriladi
          </p>
        )}
        {selectedCount === 0 && (
          <p className="text-gray-600">Dam kunlarini kalendarda bosing</p>
        )}
      </div>
    </div>
  );
}
