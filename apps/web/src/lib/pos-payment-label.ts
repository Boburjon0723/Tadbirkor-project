/** PosPayment.method → o‘zbekcha */
export function posPaymentMethodLabel(method?: string | null): string {
  switch (String(method || '').toUpperCase()) {
    case 'CASH':
      return 'Naqd';
    case 'CARD':
      return 'Karta';
    case 'CREDIT':
      return 'Nasiya';
    default:
      return method || '—';
  }
}

export function posPaymentMethodBadgeClass(method?: string | null): string {
  switch (String(method || '').toUpperCase()) {
    case 'CASH':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'CARD':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'CREDIT':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

/** Chek ro‘yxatida: birinchi to‘lov usuli */
export function primaryPaymentMethod(
  payments?: { method?: string }[] | null,
): string | undefined {
  return payments?.[0]?.method;
}
