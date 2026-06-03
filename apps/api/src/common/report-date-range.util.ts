import { BadRequestException } from '@nestjs/common';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getReportDefaultRangeDays(): number {
  const n = Number(process.env.REPORT_DEFAULT_RANGE_DAYS || 90);
  return Number.isFinite(n) && n >= 7 && n <= 365 ? Math.floor(n) : 90;
}

export function getReportMaxRangeDays(): number {
  const n = Number(process.env.REPORT_MAX_RANGE_DAYS || 366);
  return Number.isFinite(n) && n >= 30 && n <= 730 ? Math.floor(n) : 366;
}

export function getReportMaxMovementRows(): number {
  const n = Number(process.env.REPORT_MAX_MOVEMENT_ROWS || 25_000);
  return Number.isFinite(n) && n >= 1000 && n <= 200_000 ? Math.floor(n) : 25_000;
}

export type ParsedReportDateRange = {
  dateFrom: string;
  dateTo: string;
  gte: Date;
  lte: Date;
  days: number;
  capped: boolean;
  defaulted: boolean;
};

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function parseDateInput(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Hisobotlar uchun sana oralig‘i: default oxirgi N kun, maksimum 366 kun.
 */
export function parseReportDateRange(query?: {
  dateFrom?: string;
  dateTo?: string;
}): ParsedReportDateRange {
  const maxDays = getReportMaxRangeDays();
  const defaultDays = getReportDefaultRangeDays();

  let to = parseDateInput(query?.dateTo);
  let from = parseDateInput(query?.dateFrom);
  let defaulted = false;
  let capped = false;

  if (!to && !from) {
    to = new Date();
    from = new Date(to.getTime() - defaultDays * MS_PER_DAY);
    defaulted = true;
  } else if (!to) {
    to = new Date();
  } else if (!from) {
    from = new Date(to.getTime() - defaultDays * MS_PER_DAY);
    defaulted = true;
  }

  if (from!.getTime() > to!.getTime()) {
    throw new BadRequestException('dateFrom dateTo dan katta bo‘lishi mumkin emas');
  }

  let gte = startOfUtcDay(from!);
  let lte = endOfUtcDay(to!);

  const spanDays =
    Math.floor((lte.getTime() - gte.getTime()) / MS_PER_DAY) + 1;

  if (spanDays > maxDays) {
    gte = startOfUtcDay(new Date(lte.getTime() - (maxDays - 1) * MS_PER_DAY));
    capped = true;
  }

  const days = Math.floor((lte.getTime() - gte.getTime()) / MS_PER_DAY) + 1;

  return {
    dateFrom: toIsoDate(gte),
    dateTo: toIsoDate(lte),
    gte,
    lte,
    days,
    capped,
    defaulted,
  };
}
