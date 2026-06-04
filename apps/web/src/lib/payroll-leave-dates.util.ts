import { PAYROLL_MONTH_NAMES } from '@/lib/payroll-labels';

/** YYYY-MM-DD */
export function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function weekdayShortUz(date: Date) {
  return ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'][date.getDay()];
}

export function isWeekend(year: number, month: number, day: number) {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

/** Ketma-ket sanalarni dam olish oralig‘iga ajratadi */
export function mergeDateKeysToRanges(dates: string[]): Array<{ startDate: string; daysCount: number }> {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const ranges: Array<{ start: string; end: string }> = [];
  let start = sorted[0];
  let prev = sorted[0];

  const nextDay = (key: string) => {
    const { year, month, day } = parseDateKey(key);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + 1);
    return toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur === nextDay(prev)) {
      prev = cur;
    } else {
      ranges.push({ start, end: prev });
      start = cur;
      prev = cur;
    }
  }
  ranges.push({ start, end: prev });

  return ranges.map((r) => {
    const a = parseDateKey(r.start);
    const b = parseDateKey(r.end);
    const startD = new Date(a.year, a.month - 1, a.day);
    const endD = new Date(b.year, b.month - 1, b.day);
    const daysCount = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
    return { startDate: r.start, daysCount };
  });
}

export function countWeekdaysInDateKeys(dates: string[]) {
  return dates.filter((key) => {
    const { year, month, day } = parseDateKey(key);
    return !isWeekend(year, month, day);
  }).length;
}

export function monthLabel(year: number, month: number) {
  return `${PAYROLL_MONTH_NAMES[month - 1] ?? month} ${year}`;
}

function countWeekdaysInclusiveLocal(start: Date, end: Date) {
  let n = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= endLocal) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

/** Berilgan oralig‘dagi ish kunlari (shu oy ichida) */
export function countLeaveWeekdaysInMonth(
  startIso: string,
  endIso: string,
  year: number,
  month: number,
) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const a = new Date(String(startIso).slice(0, 10));
  const b = new Date(String(endIso).slice(0, 10));
  const from = a > monthStart ? a : monthStart;
  const to = b < monthEnd ? b : monthEnd;
  if (to < from) return 0;
  return countWeekdaysInclusiveLocal(from, to);
}

export function sumApprovedLeaveWeekdaysInMonth(
  leaves: Array<{ status: string; startDate: string; endDate: string }>,
  year: number,
  month: number,
) {
  return leaves
    .filter((l) => l.status === 'APPROVED')
    .reduce(
      (sum, l) => sum + countLeaveWeekdaysInMonth(l.startDate, l.endDate, year, month),
      0,
    );
}
