/** O‘zbekiston — yil bo‘yi UTC+5 (DST yo‘q). */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Tashkent';
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export type DayRange = { start: Date; end: Date; dateLabel: string };

/**
 * Berilgan vaqt zonasida «bugun» oralig‘i (default: Asia/Tashkent).
 * POS kunlik hisobot va kassa summary shu chegaradan foydalanadi.
 */
export function getDayRangeInAppTimezone(timeZone = APP_TIMEZONE): DayRange {
  if (timeZone === 'Asia/Tashkent' || timeZone === 'Asia/Samarkand') {
    return getTashkentDayRange();
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString('sv-SE', { timeZone });
  const [y, m, d] = dateLabel.split('-').map((x) => parseInt(x, 10));
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const tzWall = new Date(probe.toLocaleString('en-US', { timeZone }));
  const utcWall = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = tzWall.getTime() - utcWall.getTime();
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs);
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMs);
  return { start, end, dateLabel };
}

export function getTashkentDayRange(reference = new Date()): DayRange {
  const local = new Date(reference.getTime() + TASHKENT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - TASHKENT_OFFSET_MS);
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - TASHKENT_OFFSET_MS);
  const dateLabel = `${String(d).padStart(2, '0')}.${String(m + 1).padStart(2, '0')}.${y}`;
  return { start, end, dateLabel };
}
