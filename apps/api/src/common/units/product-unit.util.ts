import { BadRequestException } from '@nestjs/common';
import {
  normalizeProductUnit,
  ProductUnitCode,
  PRODUCT_UNIT_CODES,
} from '../../modules/products/product-import-excel.util';

export { normalizeProductUnit, ProductUnitCode, PRODUCT_UNIT_CODES };

export const PRODUCT_UNIT_LABELS: Record<ProductUnitCode, string> = {
  dona: 'dona',
  kg: 'kg',
  l: 'litr',
  m: 'metr',
};

/** kg, l, m — o'nlik qoldiq; dona — faqat butun son */
export function allowsDecimalStock(unit?: string | null): boolean {
  const u = normalizeProductUnit(unit);
  return u === 'kg' || u === 'l' || u === 'm';
}

export function isIntegerStockQuantity(qty: number): boolean {
  if (!Number.isFinite(qty)) return false;
  return Math.abs(qty - Math.round(qty)) < 1e-9;
}

/** Saqlash/import uchun miqdorni birlik bo'yicha normallashtirish */
export function normalizeStockQuantity(
  qty: number,
  unit?: string | null,
): number {
  const n = Number(qty);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (allowsDecimalStock(unit)) {
    return Math.round(n * 10000) / 10000;
  }
  return Math.round(n);
}

export function validateStockQuantity(
  qty: number,
  unit?: string | null,
  context?: string,
): number {
  const n = Number(qty);
  const prefix = context ? `${context}: ` : '';
  if (!Number.isFinite(n) || n <= 0) {
    throw new BadRequestException(`${prefix}Miqdor 0 dan katta bo'lishi kerak`);
  }
  if (!allowsDecimalStock(unit) && !isIntegerStockQuantity(n)) {
    const label = PRODUCT_UNIT_LABELS[normalizeProductUnit(unit)];
    throw new BadRequestException(
      `${prefix}«${label}» birligi uchun qoldiq butun son bo'lishi kerak (masalan: 5, 10). ${n} qabul qilinmaydi.`,
    );
  }
  return normalizeStockQuantity(n, unit);
}

/** Import preview — xato matni, throw emas */
export function stockQuantityImportError(
  qty: number,
  unit?: string | null,
): string | null {
  const n = Number(qty);
  if (!Number.isFinite(n) || n < 0) return 'Qoldiq manfiy bo\'lishi mumkin emas';
  if (!allowsDecimalStock(unit) && n > 0 && !isIntegerStockQuantity(n)) {
    const label = PRODUCT_UNIT_LABELS[normalizeProductUnit(unit)];
    return `Qoldiq butun son bo'lishi kerak (${label} birligi). Masalan: 5, 10 — ${n} emas.`;
  }
  return null;
}
