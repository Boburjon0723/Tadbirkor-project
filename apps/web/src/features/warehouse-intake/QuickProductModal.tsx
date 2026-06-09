'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  open: boolean;
  barcode: string;
  defaultQty?: number;
  onClose: () => void;
  onSubmit: (dto: {
    barcode: string;
    name: string;
    quantity?: number;
    salePrice?: number;
    unit?: string;
  }) => Promise<void>;
  loading?: boolean;
};

export function QuickProductModal({
  open,
  barcode,
  defaultQty = 1,
  onClose,
  onSubmit,
  loading,
}: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(defaultQty);
  const [salePrice, setSalePrice] = useState('');
  const [unit, setUnit] = useState('dona');

  useEffect(() => {
    if (open) {
      setName('');
      setQuantity(defaultQty);
      setSalePrice('');
      setUnit('dona');
    }
  }, [open, barcode, defaultQty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      barcode,
      name: name.trim(),
      quantity,
      salePrice: salePrice ? Number(salePrice) : undefined,
      unit: unit.trim() || 'dona',
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md glass-card rounded-3xl p-8 space-y-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-black">Tez mahsulot qo&apos;shish</h2>
                <p className="text-xs text-amber-400/90 mt-1">Katalogda topilmadi</p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">
                Barcode
              </span>
              <div className="font-mono text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                {barcode}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">
                Nomi *
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500/50"
                placeholder="Mahsulot nomi"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">
                  Miqdor
                </label>
                <input
                  type="number"
                  min={0.0001}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">
                  Narx
                </label>
                <input
                  type="number"
                  min={0}
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm font-bold"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">
                  Birlik
                </label>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || name.trim().length < 2}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Qo&apos;shish va davom etish
            </button>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
