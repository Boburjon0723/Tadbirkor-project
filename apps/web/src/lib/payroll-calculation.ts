export type PayrollCalcInput = {
  baseSalary: number;
  totalDays: number;
  workedDays: number;
  bonus: number;
  penalties: number;
  advancesTotal: number;
};

/** (oylik / kun) × ishlangan + bonus − jarima − avans */
export function computeFinalPayrollPayment(input: PayrollCalcInput): number {
  const {
    baseSalary,
    totalDays,
    workedDays,
    bonus,
    penalties,
    advancesTotal,
  } = input;

  if (totalDays <= 0) return 0;

  const proportional =
    (baseSalary / totalDays) * Math.min(Math.max(workedDays, 0), totalDays);
  const net = proportional + bonus - penalties - advancesTotal;
  return Math.max(0, Math.round(net));
}

/** Dam olishdan keyin avans limiti — oylik × (ishlangan / jami ish kuni) */
export function computeEffectiveSalaryCap(
  baseSalary: number,
  totalDays: number,
  workedDays: number,
) {
  if (baseSalary <= 0 || totalDays <= 0) return baseSalary;
  const worked = Math.min(Math.max(workedDays, 0), totalDays);
  return Math.max(0, Math.round((baseSalary / totalDays) * worked));
}

/**
 * Avans limiti uchun ishlangan kunlar.
 * Limitdan ortiq dam olish bo‘lsa — jami ish kunidan ortiq qism ayiriladi.
 */
export function computeWorkedDaysForSalaryCap(input: {
  totalDays: number;
  workedDaysFromRecord: number;
  excessLeaveDays: number;
  isManual: boolean;
  workedDaysMode: 'AUTO' | 'MANUAL';
}): number {
  const total = Math.max(0, input.totalDays);
  const leaveAdjusted = Math.max(0, total - Math.max(0, input.excessLeaveDays));
  if (input.workedDaysMode === 'MANUAL' && input.isManual) {
    return Math.min(
      Math.min(Math.max(input.workedDaysFromRecord, 0), total),
      leaveAdjusted,
    );
  }
  return leaveAdjusted;
}

export function countWeekdaysInMonth(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count || 22;
}

export function formatCalcFormula(input: PayrollCalcInput, final: number) {
  const a = input.baseSalary.toLocaleString('uz-UZ');
  const b = input.totalDays;
  const c = input.workedDays;
  const d = input.bonus.toLocaleString('uz-UZ');
  const e = input.penalties.toLocaleString('uz-UZ');
  const f = input.advancesTotal.toLocaleString('uz-UZ');
  const r = final.toLocaleString('uz-UZ');
  return `(${a} / ${b}) × ${c} + ${d} − ${e} − ${f} = ${r} UZS`;
}
