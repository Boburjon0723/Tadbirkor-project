'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, X } from 'lucide-react';
import {
  allowsDecimalStock,
  formatStockQuantity,
  minSaleQuantity,
  normalizeProductUnit,
  normalizeStockInput,
  parseStockFieldValue,
  PRODUCT_UNIT_LABELS,
  quantityStep,
  sanitizeStockDraftInput,
  type ProductUnitCode,
} from '@/lib/product-units';
import { normalizeSaleCurrency, type SaleCurrency } from '@/lib/currency';

export type PosQuantityModalVariant = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  salePrice?: number | string;
  currency?: string;
  unit?: string;
  stockQuantity?: number;
  image?: string;
};

type Props = {
  open: boolean;
  variant: PosQuantityModalVariant | null;
  formatMoney: (value: number, currency?: SaleCurrency) => string;
  onClose: () => void;
  onConfirm: (variant: PosQuantityModalVariant, quantity: number) => void;
};

const QUICK_PRESETS: Record<ProductUnitCode, number[]> = {
  dona: [1, 2, 3, 5, 10],
  kg: [0.5, 1, 1.5, 2, 5],
  l: [0.5, 1, 2, 5, 10],
  m: [0.5, 1, 2, 5, 10],
};

export function PosQuantityModal({
  open,
  variant,
  formatMoney,
  onClose,
  onConfirm,
}: Props) {
  const unit = normalizeProductUnit(variant?.unit);
  const [input, setInput] = useState('1');

  useEffect(() => {
    if (open && variant) {
      setInput(String(minSaleQuantity(unit)));
    }
  }, [open, variant, unit]);

  if (!variant) return null;

  const price = Number(variant.salePrice || 0);
  const currency = normalizeSaleCurrency(variant.currency);
  const unitLabel = PRODUCT_UNIT_LABELS[unit];
  const parsed = parseStockFieldValue(input, unit);
  const lineTotal = price * (parsed || 0);
  const maxStock = variant.stockQuantity;
  const tooMuch = maxStock !== undefined && parsed > maxStock;
  const tooSmall = parsed < minSaleQuantity(unit);

  const handleConfirm = () => {
    const qty = normalizeStockInput(parsed, unit);
    if (qty < minSaleQuantity(unit)) return;
    if (maxStock !== undefined && qty > maxStock) return;
    onConfirm(variant, qty);
    onClose();
  };

  const presets = QUICK_PRESETS[unit];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative w-full max-w-md bg-[var(--pos-modal-bg)] border border-[var(--pos-border)] rounded-[2rem] p-6 md:p-8 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-cyan-600/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                {variant.image ? (
                  <img src={variant.image} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <Package size={24} className="text-cyan-400" />
                )}
              </div>
              <div className="min-w-0 pr-8">
                <h3 className="font-black text-lg text-[var(--pos-text)] truncate">
                  {variant.productName}
                </h3>
                <p className="text-sm text-[var(--pos-muted)] truncate">{variant.name}</p>
                <p className="text-amber-400 font-black mt-1">
                  {formatMoney(price, currency)}
                  <span className="text-[var(--pos-muted)] text-xs font-bold"> / {unitLabel}</span>
                </p>
                {maxStock !== undefined && (
                  <p className="text-xs text-slate-500 mt-1">
                    Omborda: {formatStockQuantity(maxStock, unit)}
                  </p>
                )}
              </div>
            </div>

            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Miqdor ({unitLabel})
            </label>
            <div className="relative mt-2 mb-4">
              <input
                autoFocus
                type="text"
                inputMode={allowsDecimalStock(unit) ? 'decimal' : 'numeric'}
                value={input}
                onChange={(e) => {
                  const next = sanitizeStockDraftInput(e.target.value, unit);
                  if (next !== null) setInput(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                className="w-full bg-[var(--pos-input-bg)] border border-[var(--pos-border)] rounded-2xl py-4 px-5 text-2xl font-black text-[var(--pos-accent)] outline-none focus:border-[var(--pos-accent)]"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                {unitLabel}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setInput(String(preset))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-600/30 text-slate-300 text-xs font-black hover:bg-cyan-600/20 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
                >
                  {allowsDecimalStock(unit)
                    ? preset.toString().replace(/\.0$/, '')
                    : preset}{' '}
                  {unitLabel}
                </button>
              ))}
              {maxStock !== undefined && (
                <button
                  type="button"
                  onClick={() => setInput(String(maxStock))}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black hover:bg-amber-500/20 transition-all"
                >
                  Hammasi ({formatStockQuantity(maxStock, unit)})
                </button>
              )}
            </div>

            <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-800/40 border border-slate-600/25 mb-5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Summa
              </span>
              <span className="text-xl font-black text-amber-400">
                {formatMoney(lineTotal, currency)}
              </span>
            </div>

            {(tooSmall || tooMuch) && (
              <p className="text-xs text-red-400 font-bold mb-3">
                {tooSmall
                  ? `Kamida ${minSaleQuantity(unit)} ${unitLabel} kiriting`
                  : `Omborda faqat ${formatStockQuantity(maxStock!, unit)} bor`}
              </p>
            )}

            <button
              type="button"
              disabled={tooSmall || tooMuch || !parsed}
              onClick={handleConfirm}
              className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-black rounded-2xl shadow-lg shadow-cyan-900/30 transition-all"
            >
              Savatga qo&apos;shish — {formatStockQuantity(parsed || 0, unit)}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
