'use client';

import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  allowsDecimalStock,
  commitStockFieldValue,
  minSaleQuantity,
  normalizeProductUnit,
  PRODUCT_UNIT_LABELS,
  parseStockFieldValue,
  quantityStep,
  sanitizeStockDraftInput,
  stockFieldDisplayValue,
  type ProductUnitCode,
  type StockFieldValue,
} from '@/lib/product-units';

type Props = {
  quantity: number;
  unit?: string | null;
  maxStock?: number;
  tone?: 'catalog' | 'cart';
  onChange: (quantity: number) => void;
};

export function PosQuantityInput({
  quantity,
  unit,
  maxStock,
  tone = 'catalog',
  onChange,
}: Props) {
  const isCart = tone === 'cart';
  const boxBg = isCart ? 'bg-[var(--pos-cart-bg)]' : 'bg-[var(--pos-input-bg)]';
  const boxBorder = isCart ? 'border-[var(--pos-cart-border)]' : 'border-[var(--pos-border)]';
  const textColor = isCart ? 'text-[var(--pos-cart-text)]' : 'text-[var(--pos-text)]';
  const mutedColor = isCart ? 'text-[var(--pos-cart-muted)]' : 'text-[var(--pos-muted)]';
  const normalizedUnit = normalizeProductUnit(unit);
  const step = quantityStep(normalizedUnit);
  const minQty = minSaleQuantity(normalizedUnit);
  const [draft, setDraft] = useState<StockFieldValue | null>(null);

  const displayValue =
    draft !== null ? stockFieldDisplayValue(draft) : String(quantity);

  const applyQuantity = (next: number) => {
    const clamped = Math.max(minQty, next);
    const capped =
      maxStock !== undefined && maxStock > 0
        ? Math.min(clamped, maxStock)
        : clamped;
    onChange(
      allowsDecimalStock(normalizedUnit)
        ? Math.round(capped * 10000) / 10000
        : Math.round(capped),
    );
    setDraft(null);
  };

  const handleDelta = (delta: number) => {
    applyQuantity(quantity + delta * step);
  };

  const unitLabel = PRODUCT_UNIT_LABELS[normalizedUnit];

  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`flex items-center gap-1.5 ${boxBg} p-1 md:p-1.5 rounded-xl border ${boxBorder}`}>
        <button
          type="button"
          onClick={() => handleDelta(-1)}
          disabled={quantity <= minQty + 1e-9}
          className={`w-5 h-5 md:w-6 md:h-6 rounded-lg hover:opacity-80 flex items-center justify-center ${mutedColor} disabled:opacity-30`}
        >
          <Minus size={12} />
        </button>
        <input
          type="text"
          inputMode={allowsDecimalStock(normalizedUnit) ? 'decimal' : 'numeric'}
          className={`font-black text-[10px] md:text-xs w-12 md:w-14 text-center bg-transparent outline-none ${textColor}`}
          value={displayValue}
          onChange={(e) => {
            const next = sanitizeStockDraftInput(e.target.value, normalizedUnit);
            if (next === null) return;
            setDraft(next);
          }}
          onBlur={() => {
            if (draft === null) return;
            const parsed = parseStockFieldValue(
              commitStockFieldValue(draft, normalizedUnit),
              normalizedUnit,
            );
            applyQuantity(parsed || minQty);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          type="button"
          onClick={() => handleDelta(1)}
          disabled={maxStock !== undefined && quantity >= maxStock - 1e-9}
          className={`w-5 h-5 md:w-6 md:h-6 rounded-lg hover:opacity-80 flex items-center justify-center ${mutedColor} disabled:opacity-30`}
        >
          <Plus size={12} />
        </button>
      </div>
      <span className={`text-[8px] md:text-[9px] font-bold ${mutedColor} uppercase`}>
        {unitLabel as ProductUnitCode}
      </span>
    </div>
  );
}
