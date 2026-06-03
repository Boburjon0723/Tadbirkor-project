export type CustomerBalanceView = {
  label: string;
  text: string;
  tone: 'debt' | 'prepaid' | 'zero';
};

export function formatCustomerBalance(
  totalDebt: number,
  prepaidBalance: number,
  netBalance?: number,
): CustomerBalanceView {
  const debt = Number(totalDebt) || 0;
  const prepaid = Number(prepaidBalance) || 0;
  const net =
    netBalance !== undefined ? Number(netBalance) : prepaid - debt;

  if (net > 0.001) {
    return {
      label: 'Avans',
      text: `+${net.toLocaleString()}`,
      tone: 'prepaid',
    };
  }
  if (net < -0.001) {
    return {
      label: 'Qarz',
      text: Math.abs(net).toLocaleString(),
      tone: 'debt',
    };
  }
  return { label: 'Balans', text: '0', tone: 'zero' };
}
