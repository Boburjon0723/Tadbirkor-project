/** Oylik to‘liq yopilganmi (bazada tasdiq yoki avanslar limitdan oshgan) */
export function isPayrollSalaryClosed(input: {
  salary: number;
  advancesTotal: number;
  paymentConfirmed: boolean;
  /** Ish kunlari bo‘yicha limit; berilmasa — to‘liq oylik */
  salaryCap?: number;
}): boolean {
  if (input.paymentConfirmed) return true;
  const cap =
    input.salaryCap != null && input.salaryCap > 0 ? input.salaryCap : input.salary;
  return input.salary > 0 && cap > 0 && input.advancesTotal >= cap;
}

/** Jadval / karta: maosh va to‘lov holati qatorlari */
export function payrollSalarySubline(input: {
  salary: number;
  advancesTotal: number;
  paymentConfirmed: boolean;
  paidAmount?: number;
  salaryCap?: number;
  bonus?: number;
}): { kind: 'none' | 'advance' | 'paid' | 'bonus'; amount: number } {
  if (input.salary <= 0) return { kind: 'none', amount: 0 };
  if (
    isPayrollSalaryClosed({
      salary: input.salary,
      advancesTotal: input.advancesTotal,
      paymentConfirmed: input.paymentConfirmed,
      salaryCap: input.salaryCap,
    })
  ) {
    const amount =
      input.paidAmount && input.paidAmount > 0
        ? input.paidAmount
        : input.advancesTotal;
    return { kind: 'paid', amount };
  }
  if (input.advancesTotal > 0) {
    return { kind: 'advance', amount: input.advancesTotal };
  }
  if ((input.bonus ?? 0) > 0) {
    return { kind: 'bonus', amount: input.bonus! };
  }
  return { kind: 'none', amount: 0 };
}

/** Oy bo‘yicha ko‘rsatish statistikasi (API tasdiq bo‘lmasa ham avans yopilganini hisoblaydi) */
export function enrichPayrollMonthStats<
  T extends {
    advancesByUser: Record<string, number>;
    paymentConfirmedByUser: Record<string, boolean>;
    paidAmountByUser: Record<string, number>;
    totalPaidUZS: number;
    paidEmployeeCount: number;
    totalOpenAdvancesUZS?: number;
  },
>(
  stats: T,
  rows: Array<{ companyUserId: string; salary: number }>,
  salaryCapByUser?: Record<string, number>,
): T {
  const paymentConfirmedByUser = { ...stats.paymentConfirmedByUser };
  const paidAmountByUser = { ...stats.paidAmountByUser };
  let totalPaidUZS = stats.totalPaidUZS;
  let paidEmployeeCount = stats.paidEmployeeCount;

  for (const row of rows) {
    const advancesTotal = stats.advancesByUser[row.companyUserId] ?? 0;
    const cap = salaryCapByUser?.[row.companyUserId];
    const closed = isPayrollSalaryClosed({
      salary: row.salary,
      advancesTotal,
      paymentConfirmed: paymentConfirmedByUser[row.companyUserId],
      salaryCap: cap,
    });
    if (!closed) continue;
    if (!paymentConfirmedByUser[row.companyUserId]) {
      paymentConfirmedByUser[row.companyUserId] = true;
      paidAmountByUser[row.companyUserId] = advancesTotal;
      totalPaidUZS += advancesTotal;
      paidEmployeeCount += 1;
    }
  }

  let totalOpenAdvancesUZS = 0;
  for (const row of rows) {
    if (paymentConfirmedByUser[row.companyUserId]) continue;
    totalOpenAdvancesUZS += stats.advancesByUser[row.companyUserId] ?? 0;
  }

  return {
    ...stats,
    paymentConfirmedByUser,
    paidAmountByUser,
    totalPaidUZS,
    paidEmployeeCount,
    totalOpenAdvancesUZS,
  };
}
