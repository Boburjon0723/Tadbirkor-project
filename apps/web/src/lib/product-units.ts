export type ProductUnitCode = 'dona' | 'kg' | 'l' | 'm';

export const PRODUCT_UNIT_OPTIONS: { value: ProductUnitCode; label: string }[] = [
  { value: 'dona', label: 'dona (butun son)' },
  { value: 'kg', label: 'kg' },
  { value: 'l', label: 'litr (l)' },
  { value: 'm', label: 'metr (m)' },
];

const UNIT_ALIASES: Record<string, ProductUnitCode> = {
  dona: 'dona',
  don: 'dona',
  ta: 'dona',
  kg: 'kg',
  l: 'l',
  litr: 'l',
  liter: 'l',
  m: 'm',
  metr: 'm',
};

export const PRODUCT_UNIT_LABELS: Record<ProductUnitCode, string> = {
  dona: 'dona',
  kg: 'kg',
  l: 'litr',
  m: 'metr',
};

export function normalizeProductUnit(
  raw?: string | null,
  fallback: ProductUnitCode = 'dona',
): ProductUnitCode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '');
  if (!s) return fallback;
  return UNIT_ALIASES[s] ?? (['dona', 'kg', 'l', 'm'].includes(s) ? (s as ProductUnitCode) : fallback);
}

export function allowsDecimalStock(unit?: string | null): boolean {
  const u = normalizeProductUnit(unit);
  return u === 'kg' || u === 'l' || u === 'm';
}

export function normalizeStockInput(value: number, unit?: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (allowsDecimalStock(unit)) {
    return Math.round(n * 10000) / 10000;
  }
  return Math.round(n);
}

export function formatStockQuantity(qty: number, unit?: string | null): string {
  const u = normalizeProductUnit(unit);
  const label = PRODUCT_UNIT_LABELS[u] || u;
  const n = Number(qty);
  if (!Number.isFinite(n)) return `— ${label}`;
  if (!allowsDecimalStock(u)) {
    return `${Math.round(n)} ${label}`;
  }
  const text = n.toFixed(4).replace(/\.?0+$/, '');
  return `${text} ${label}`;
}

export function stockInputStep(unit?: string | null): string {
  return allowsDecimalStock(unit) ? '0.0001' : '1';
}

/** Raqam, bo‘sh yoki kiritish paytidagi qisman matn ("12.") */
export type StockFieldValue = number | '' | string;

/** Kiritish paytida qisman matn ("12.", "0,5") saqlanadi */
export function sanitizeStockDraftInput(
  raw: string,
  unit?: string | null,
): string | null {
  const text = raw.replace(',', '.');
  if (text === '') return '';
  if (!allowsDecimalStock(unit) && text.includes('.')) return null;
  const pattern = allowsDecimalStock(unit) ? /^\d*\.?\d*$/ : /^\d*$/;
  if (!pattern.test(text)) return null;
  return text;
}

export function stockFieldDisplayValue(value: StockFieldValue): string {
  if (value === '') return '';
  if (!Number.isFinite(value)) return '';
  return String(value);
}

export function parseStockFieldValue(
  value: StockFieldValue,
  unit?: string | null,
): number {
  if (value === '') return 0;
  const n =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(',', '.').trim());
  return normalizeStockInput(n, unit);
}

/** Blur yoki saqlashdan oldin matnni raqamga aylantirish */
export function commitStockFieldValue(
  value: StockFieldValue,
  unit?: string | null,
): StockFieldValue {
  if (value === '') return '';
  return parseStockFieldValue(value, unit);
}
