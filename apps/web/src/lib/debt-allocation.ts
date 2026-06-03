/** Qarz yozuvlariga to‘lovni eng eskidan boshlab taqsimlash (FIFO). */
export function allocateDebtPaymentsFifo(
  entries: Array<{
    id: string;
    remainingAmount: number;
    createdAt: string | Date;
    status?: string;
  }>,
  amount: number,
) {
  const open = entries
    .filter(
      (e) =>
        Number(e.remainingAmount) > 0 &&
        e.status !== 'PAID' &&
        e.status !== 'CONFIRMED',
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  let left = Number(amount) || 0;
  const allocations: Array<{
    debtEntryId: string;
    amount: number;
    fullyPaid: boolean;
  }> = [];

  for (const e of open) {
    if (left <= 0.0001) break;
    const rem = Number(e.remainingAmount);
    const applied = Math.min(left, rem);
    if (applied <= 0) continue;
    allocations.push({
      debtEntryId: e.id,
      amount: applied,
      fullyPaid: applied >= rem - 0.009,
    });
    left -= applied;
  }

  const appliedTotal = allocations.reduce((s, a) => s + a.amount, 0);
  return {
    allocations,
    appliedTotal,
    unapplied: Math.max(0, left),
    fullyPaidCount: allocations.filter((a) => a.fullyPaid).length,
    openCount: open.length,
  };
}
