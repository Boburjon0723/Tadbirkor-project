/** Dam olishdan keyin avans limiti — oylik × (ishlangan / jami ish kuni) */
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

export function computeEffectiveSalaryCap(
  baseSalary: number,
  totalDays: number,
  workedDays: number,
): number {
  if (baseSalary <= 0 || totalDays <= 0) return baseSalary;
  const worked = Math.min(Math.max(workedDays, 0), totalDays);
  return Math.max(0, Math.round((baseSalary / totalDays) * worked));
}

export function computeFinalPayrollPayment(input: {
  baseSalary: number;
  totalDays: number;
  workedDays: number;
  bonus: number;
  penalties: number;
  advancesTotal: number;
}): number {
  const { baseSalary, totalDays, workedDays, bonus, penalties, advancesTotal } =
    input;
  if (totalDays <= 0) return 0;
  const proportional =
    (baseSalary / totalDays) * Math.min(Math.max(workedDays, 0), totalDays);
  const net = proportional + bonus - penalties - advancesTotal;
  return Math.max(0, Math.round(net));
}

export function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}
