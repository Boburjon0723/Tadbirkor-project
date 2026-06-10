import {
  allowsDecimalStock,
  formatStockQuantity,
  minSaleQuantity,
  normalizeProductUnit,
  quantityStep,
} from '@/lib/product-units';

/** Skaner orqali bitta marta qo'shiladigan miqdor (dona/kg ...) */
export function getScanAddQuantityLabel(unit?: string | null): {
  quantity: number;
  label: string;
  needsQuantityModal: boolean;
} {
  const normalized = normalizeProductUnit(unit);
  if (allowsDecimalStock(normalized)) {
    return {
      quantity: minSaleQuantity(normalized),
      label: formatStockQuantity(minSaleQuantity(normalized), normalized),
      needsQuantityModal: true,
    };
  }
  const step = quantityStep(normalized);
  return {
    quantity: step,
    label: formatStockQuantity(step, normalized),
    needsQuantityModal: false,
  };
}
