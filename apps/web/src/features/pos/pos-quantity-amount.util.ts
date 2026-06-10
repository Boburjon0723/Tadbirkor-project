import {
  allowsDecimalStock,
  minSaleQuantity,
  normalizeProductUnit,
  normalizeStockInput,
} from '@/lib/product-units';

/** Miqdor × birlik narx = qator summasi */
export function calcLineAmount(quantity: number, unitPrice: number): number {
  const qty = Number(quantity);
  const price = Number(unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price <= 0) {
    return 0;
  }
  return Math.round(qty * price * 100) / 100;
}

/** Summa ÷ birlik narx → o‘lchov birligiga mos miqdor (litr / kg / metr / dona) */
export function calcQuantityFromLineAmount(
  amount: number,
  unitPrice: number,
  unit?: string | null,
): number {
  const sum = Number(amount);
  const price = Number(unitPrice);
  if (!Number.isFinite(sum) || sum <= 0 || !Number.isFinite(price) || price <= 0) {
    return 0;
  }
  const raw = sum / price;
  const normalized = normalizeProductUnit(unit);
  if (allowsDecimalStock(normalized)) {
    return normalizeStockInput(raw, normalized);
  }
  const pieces = Math.round(raw);
  return Math.max(minSaleQuantity(normalized), pieces);
}

/** Miqdor maydoni uchun matn (ortiqcha nollarsiz) */
export function formatQuantityDraft(quantity: number, unit?: string | null): string {
  const normalized = normalizeProductUnit(unit);
  const n = normalizeStockInput(quantity, normalized);
  if (!allowsDecimalStock(normalized)) return String(Math.round(n));
  return n.toFixed(4).replace(/\.?0+$/, '');
}
