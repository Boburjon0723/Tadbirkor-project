'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Lock, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { WarehouseIntake } from '@/services/warehouse-intake.service';

type Props = {
  open: boolean;
  onClose: () => void;
  warehouses: { id: string; name: string }[];
  defaultWarehouseId?: string;
  lockWarehouse?: boolean;
  onSubmit: (dto: {
    warehouseId: string;
    note?: string;
    partnerLedgerContactId?: string;
  }) => Promise<WarehouseIntake>;
  loading?: boolean;
};

export function CreateIntakeMobileSheet({
  open,
  onClose,
  warehouses,
  defaultWarehouseId,
  lockWarehouse = false,
  onSubmit,
  loading,
}: Props) {
  const [warehouseId, setWarehouseId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setWarehouseId(defaultWarehouseId || warehouses[0]?.id || '');
    setNote('');
  }, [open, defaultWarehouseId, warehouses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return;
    await onSubmit({ warehouseId, note: note.trim() || undefined });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-[#0e1511]/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.form
            onSubmit={handleSubmit}
            className="relative w-full max-w-lg intake-glass rounded-t-[24px] p-6 pb-8 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-[#dde4dd]">Yangi kirim</h2>
                <p className="text-sm text-[#bbcabf] mt-1">
                  Operatsiyani boshlash uchun ma&apos;lumotlarni kiriting
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90"
              >
                <X size={20} className="text-[#bbcabf]" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#bbcabf] px-1">
                  Ombor
                </label>
                <div className="relative">
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    disabled={lockWarehouse || warehouses.length <= 1}
                    className="w-full h-14 bg-[#2f3632]/50 border border-white/10 rounded-xl px-4 text-base font-semibold text-[#dde4dd] appearance-none disabled:opacity-80 disabled:cursor-not-allowed"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} className="bg-[#1a211d]">
                        {w.name}
                      </option>
                    ))}
                  </select>
                  {(lockWarehouse || warehouses.length <= 1) && (
                    <Lock
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#bbcabf]/50 pointer-events-none"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#bbcabf] px-1">
                  Izoh (ixtiyoriy)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Yuk haqida qo'shimcha ma'lumotlar..."
                  className="w-full bg-[#1a211d]/80 border border-white/10 rounded-xl p-4 text-base text-[#dde4dd] placeholder:text-[#86948a]/60 resize-none focus:border-emerald-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !warehouseId}
                className="w-full h-14 bg-[#10b981] text-[#00422b] font-bold rounded-xl shadow-[0_8px_16px_-4px_rgba(16,185,129,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Boshlash
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 text-[#bbcabf] font-bold rounded-xl active:scale-95"
              >
                Bekor qilish
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
