export type SaleCurrency = 'UZS' | 'USD';

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
