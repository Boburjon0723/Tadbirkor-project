export function formatLedgerAmount(amount: number, currency: string) {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('uz-UZ', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  });
  const sign = amount < 0 ? '−' : amount > 0 ? '+' : '';
  return `${sign}${formatted} ${currency}`;
}

export function formatBalancesLine(balances: Record<string, number>) {
  const parts: string[] = [];
  for (const cur of ['UZS', 'USD']) {
    const v = balances[cur];
    if (v !== undefined && Math.abs(v) >= 0.01) {
      parts.push(formatLedgerAmount(v, cur));
    }
  }
  return parts.length ? parts.join(' · ') : '0 UZS';
}

export function sideLabel(side: string) {
  if (side === 'we_owe') return 'Biz qarzdormiz';
  if (side === 'they_owe') return 'Ular qarzdor';
  return 'Hisob yopiq';
}

/** Daftardan qo‘lda: chiqim (sotish) va pul harakatlari. Tovar kirimi — ombor orqali (yo‘riqnoma). */
export const OPERATION_QUICK_ACTIONS = [
  { type: 'SALE_OUT' as const, label: 'Sotish / chiqim', short: 'Sotish' },
  { type: 'RECEIPT_FROM_PARTNER' as const, label: 'Hamkordan tushum', short: 'Tushum' },
  { type: 'PAYMENT_TO_PARTNER' as const, label: 'Hamkorga to‘lov', short: 'To‘lov' },
] as const;

export const SALE_OUT_MODAL_HINT =
  'Hamkorga tovar berildi deb hisoblanadi — balans oshadi (ular bizga qarzdor). Ombordan chiqim qilsangiz ham, hamkor tanlangan bo‘lsa, yozuv avtomatik tushadi.';
