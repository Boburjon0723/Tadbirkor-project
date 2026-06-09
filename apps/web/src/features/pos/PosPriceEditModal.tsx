'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { PosCartItem } from './types';
import type { SaleCurrency } from '@/lib/currency';

type Props = {
  open: boolean;
  item: PosCartItem | null;
  maxDiscountPercent: number;
  canOverridePrice: boolean;
  canChangePrice: boolean;
  formatMoney: (value: number, currency?: SaleCurrency) => string;
  onClose: () => void;
  onSave: (variantId: string, price: number) => void;
};

export function PosPriceEditModal({
  open,
  item,
  maxDiscountPercent,
  canOverridePrice,
  canChangePrice,
  formatMoney,
  onClose,
  onSave,
}: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setInput(String(item.price));
      setError(null);
    }
  }, [item]);

  if (!item) return null;

  const listPrice = item.listPrice;
  const parsed = Number(input);
  const minAllowed = canOverridePrice
    ? 0
    : canChangePrice
      ? listPrice * (1 - maxDiscountPercent / 100)
      : listPrice;

  const handleSave = () => {
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('To‘g‘ri narx kiriting');
      return;
    }
    if (
      !canOverridePrice &&
      canChangePrice &&
      parsed < minAllowed - 0.01
    ) {
      const pct =
        listPrice > 0 ? ((listPrice - parsed) / listPrice) * 100 : 0;
      setError(
        `Chegirma ${pct.toFixed(1)}% — ruxsat ${maxDiscountPercent}% gacha`,
      );
      return;
    }
    onSave(item.variantId, parsed);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="relative w-full max-w-md bg-[var(--pos-panel)] border border-[var(--pos-border)] rounded-3xl p-8 space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Narxni o‘zgartirish</h3>
                <p className="text-xs text-gray-500 font-bold truncate">
                  {item.name} — {item.variantName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-sm text-gray-400 space-y-1">
              <p>
                Ro‘yxat narxi:{' '}
                <span className="text-white font-black">
                  {formatMoney(listPrice, item.currency)}
                </span>
              </p>
              {!canOverridePrice && (
                <p className="text-[11px]">
                  Maks. chegirma: {maxDiscountPercent}% (minimal{' '}
                  {formatMoney(minAllowed, item.currency)})
                </p>
              )}
              {canOverridePrice && (
                <p className="text-[11px] text-[var(--pos-money)]/80">
                  Sizda chekirmasiz narx o‘zgartirish huquqi bor.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Yangi birlik narxi
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(null);
                }}
                className="w-full bg-black/50 border border-[var(--pos-border)] rounded-2xl py-4 px-5 text-xl font-black text-[var(--pos-money)] focus:outline-none focus:border-emerald-500/50"
              />
              {error && (
                <p className="text-xs text-red-400 font-bold">{error}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-slate-800/50 font-black text-sm"
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 rounded-2xl bg-[var(--pos-accent)] hover:brightness-110 font-black text-sm"
              >
                Saqlash
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
