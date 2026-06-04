/** Telegram bildirishnomalar — faqat o‘qilishi oson, inson tilidagi qatorlar */

const SKIP_DETAIL_KEYS = new Set([
  'paymentIds',
  'allocations',
  'payload',
  'newData',
  'oldData',
  'entityId',
  'targetId',
  'userId',
  'companyId',
  'partnerCompanyId',
  'debtEntryId',
]);

const DETAIL_LABELS: Record<string, string> = {
  appliedTotal: 'Summa',
  confirmedTotal: 'Tasdiqlangan summa',
  amount: 'Summa',
  remainingAmount: 'Qolgan qarz',
  currency: 'Valyuta',
  entriesCount: 'Yozuvlar soni',
  confirmedCount: 'Tasdiqlangan yozuvlar',
  debtor: 'Qarzdor',
  creditor: 'Haqdor',
  seller: 'Sotuvchi',
  buyer: 'Xaridor',
  hamkor: 'Hamkor',
  haqdor: 'Haqdor',
  partner: 'Hamkor',
  orderId: 'Buyurtma',
  status: 'Holat',
  paymentRecordId: 'To‘lov',
  warehouse: 'Ombor',
  taskId: 'Vazifa',
  receiptId: 'Qabul',
  dispatchId: 'Jo‘natma',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  ACCEPTED: 'Qabul qilindi',
  PARTIALLY_ACCEPTED: 'Qisman qabul',
  REJECTED: 'Rad etildi',
  OPEN: 'Ochiq',
  PARTIAL: 'Qisman to‘langan',
  PAID: 'To‘langan',
  CONFIRMED: 'Tasdiqlangan',
  DONE: 'Bajarilgan',
  FAILED: 'Xatolik',
  DRAFT: 'Qoralama',
  SENT: 'Yuborilgan',
  APPROVED: 'Tasdiqlangan',
  CANCELLED: 'Bekor qilingan',
  COMPLETED: 'Yakunlangan',
  DISPATCHED: 'Jo‘natilgan',
  VOIDED: 'Bekor qilingan',
};

export const TELEGRAM_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Egasi',
  MANAGER: 'Menejer',
  WAREHOUSE: 'Omborchi',
  ACCOUNTANT: 'Hisobchi',
  SALES: 'Sotuvchi',
  FIELD_WORKER: 'Dala xodimi',
  WORKER: 'Oddiy ishchi',
};

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function formatShortId(id: string, prefix = ''): string {
  const s = String(id || '').trim();
  if (!s) return '—';
  if (isUuidLike(s)) {
    return prefix ? `${prefix}-${s.slice(0, 8).toUpperCase()}` : s.slice(0, 8).toUpperCase();
  }
  return s.length > 12 ? `${s.slice(0, 12)}…` : s;
}

export function formatTelegramMoney(amount: unknown, currency?: string): string {
  const cur = String(currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  if (cur === 'USD') {
    return `${n.toLocaleString('uz-UZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  }
  return `${Math.round(n).toLocaleString('uz-UZ')} so'm`;
}

function formatStatus(value: unknown): string {
  const s = String(value || '').toUpperCase();
  return STATUS_LABELS[s] || String(value);
}

function formatArrayValue(key: string, value: unknown[]): string | null {
  if (value.length === 0) return null;
  const allStrings = value.every((v) => typeof v === 'string');
  if (allStrings && value.every((v) => isUuidLike(String(v)))) {
    if (key === 'paymentIds') {
      return `${value.length} ta to‘lov yozuvi (tafsilotlar veb-ilovada)`;
    }
    return `${value.length} ta yozuv`;
  }
  return `${value.length} ta element`;
}

function formatScalar(key: string, value: unknown, currency?: string): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (key === 'orderId' && typeof value === 'string') {
    return formatShortId(value, 'ORD');
  }
  if ((key === 'paymentRecordId' || key === 'receiptId' || key === 'taskId') && typeof value === 'string') {
    return formatShortId(value);
  }
  if (key === 'status') {
    return formatStatus(value);
  }
  if (
    ['appliedTotal', 'confirmedTotal', 'amount', 'remainingAmount'].includes(key) &&
    (typeof value === 'number' || typeof value === 'string')
  ) {
    return formatTelegramMoney(value, currency);
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toLocaleString('uz-UZ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Ha' : 'Yo‘q';
  }
  if (typeof value === 'string' && isUuidLike(value)) {
    return formatShortId(value);
  }
  return String(value);
}

/**
 * `details` obyektidan Telegram uchun qo‘shimcha qatorlar (texnik UUID ro‘yxatisiz).
 */
export function formatTelegramDetailLines(details?: Record<string, unknown> | null): string[] {
  if (!details || typeof details !== 'object') return [];

  const currency =
    details.currency != null ? String(details.currency).toUpperCase() : undefined;
  const lines: string[] = [];
  const consumed = new Set<string>();

  const moneyKeys = ['appliedTotal', 'confirmedTotal', 'amount'] as const;
  for (const mk of moneyKeys) {
    if (details[mk] != null && !consumed.has(mk)) {
      const label = DETAIL_LABELS[mk] || mk;
      lines.push(`💰 ${label}: ${formatTelegramMoney(details[mk], currency)}`);
      consumed.add(mk);
      consumed.add('currency');
      break;
    }
  }

  if (details.remainingAmount != null && !consumed.has('remainingAmount')) {
    lines.push(
      `📉 Qolgan qarz: ${formatTelegramMoney(details.remainingAmount, currency)}`,
    );
    consumed.add('remainingAmount');
  }

  for (const [key, raw] of Object.entries(details)) {
    if (consumed.has(key) || SKIP_DETAIL_KEYS.has(key)) continue;
    if (key === 'currency') continue;

    const label = DETAIL_LABELS[key] || key;

    if (Array.isArray(raw)) {
      const formatted = formatArrayValue(key, raw);
      if (formatted) lines.push(`• ${label}: ${formatted}`);
      continue;
    }

    if (raw !== null && typeof raw === 'object') continue;

    const formatted = formatScalar(key, raw, currency);
    if (formatted) lines.push(`• ${label}: ${formatted}`);
  }

  return lines;
}

export function formatTelegramRoles(roles: string[]): string {
  return roles.map((r) => TELEGRAM_ROLE_LABELS[r.toUpperCase()] || r).join(', ');
}
