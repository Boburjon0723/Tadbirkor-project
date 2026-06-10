export type SaleCurrency = 'UZS' | 'USD';

/** Backend `round2` bilan mos: 2 xonagacha yaxlitlash */
export function roundMoney(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

/** Ombor miqdori — uzun kasr satrlarini qisqartirish */
export function formatStockQty(value: number): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return Math.round(rounded).toLocaleString('uz-UZ');
  }
  return rounded.toLocaleString('uz-UZ', { maximumFractionDigits: 3 });
}

/** POS savat jami — har qator alohida yaxlitlanadi (PosService.resolveItems bilan bir xil) */
export function calcPosCartTotal(
  items: Array<{ price: number; quantity: number }>,
): number {
  const subtotal = items.reduce(
    (sum, item) => sum + roundMoney(item.price * item.quantity),
    0,
  );
  return roundMoney(subtotal);
}

export function normalizeSaleCurrency(value: unknown): SaleCurrency {
  return String(value || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
}

export function formatSaleAmount(value: number, currency: SaleCurrency = 'UZS'): string {
  const amount = Number(value || 0);
  if (currency === 'USD') {
    return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} USD`;
  }
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} UZS`;
}

export function saleCurrencySuffix(currency: SaleCurrency = 'UZS'): string {
  return currency === 'USD' ? 'USD' : "so'm";
}

export function formatSaleAmountMap(map?: Partial<Record<SaleCurrency, number>>): string {
  if (!map) return '—';
  const parts: string[] = [];
  const uzs = Number(map.UZS || 0);
  const usd = Number(map.USD || 0);
  if (uzs) parts.push(formatSaleAmount(uzs, 'UZS'));
  if (usd) parts.push(formatSaleAmount(usd, 'USD'));
  return parts.length ? parts.join(' · ') : formatSaleAmount(0, 'UZS');
}
