'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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

export function QuickProductMobileSheet({
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

  useEffect(() => {
    if (!open) return;
    setName('');
    setQuantity(defaultQty);
    setSalePrice('');
  }, [open, barcode, defaultQty]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.form
            onSubmit={async (e) => {
              e.preventDefault();
              if (name.trim().length < 2) return;
              await onSubmit({
                barcode,
                name: name.trim(),
                quantity,
                salePrice: salePrice ? Number(salePrice) : undefined,
                unit: 'dona',
              });
            }}
            className="relative w-full intake-glass rounded-t-[24px] p-6 pb-10 max-h-[90dvh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="flex justify-between mb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#dde4dd]">Tez mahsulot</h2>
                <p className="text-xs text-[#ffb95f] mt-0.5">Katalogda topilmadi</p>
              </div>
              <button type="button" onClick={onClose} className="p-2">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#bbcabf]">
                  Barcode
                </span>
                <div className="mt-1 font-mono text-sm bg-[#1a211d] border border-white/10 rounded-xl px-4 py-3">
                  {barcode}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#bbcabf]">
                  Nomi *
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full h-14 bg-[#1a211d] border border-white/10 rounded-xl px-4 text-base font-semibold focus:border-emerald-500 outline-none"
                  placeholder="Mahsulot nomi"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#bbcabf]">
                    Miqdor
                  </label>
                  <input
                    type="number"
                    min={0.0001}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="mt-1 w-full h-12 bg-[#1a211d] border border-white/10 rounded-xl px-3 text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#bbcabf]">
                    Narx
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="mt-1 w-full h-12 bg-[#1a211d] border border-white/10 rounded-xl px-3 text-center font-bold"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || name.trim().length < 2}
                className="w-full h-14 bg-[#10b981] text-[#00422b] font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Qo&apos;shish va davom etish
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
