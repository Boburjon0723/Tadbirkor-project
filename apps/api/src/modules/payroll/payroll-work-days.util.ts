/** Oy ichidagi ish kunlari (dush–juma) */
export function countWeekdaysInMonth(year: number, month: number): number {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export function toDateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function parseDateOnly(input: string | Date): Date {
  if (input instanceof Date) return toDateOnlyUtc(input);
  const s = String(input).trim().slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateOnlyUz(d: Date): string {
  return d.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function addDaysUtc(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateOnlyUtc(next);
}

/** [start, end] oralig‘idagi ish kunlari (dush–juma) */
export function countWeekdaysInclusive(start: Date, end: Date): number {
  const a = toDateOnlyUtc(start);
  const b = toDateOnlyUtc(end);
  if (b < a) return 0;
  let count = 0;
  for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

/** Berilgan oy bilan kesishgan ish kunlari */
export function countLeaveWeekdaysInMonth(
  start: Date,
  end: Date,
  year: number,
  month: number,
): number {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const a = toDateOnlyUtc(start);
  const b = toDateOnlyUtc(end);
  const from = a > monthStart ? a : monthStart;
  const to = b < monthEnd ? b : monthEnd;
  if (to < from) return 0;
  return countWeekdaysInclusive(from, to);
}

export function monthsTouchedByRange(start: Date, end: Date): Array<{ year: number; month: number }> {
  const a = toDateOnlyUtc(start);
  const b = toDateOnlyUtc(end);
  const out: Array<{ year: number; month: number }> = [];
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth() + 1;
  const endY = b.getUTCFullYear();
  const endM = b.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
