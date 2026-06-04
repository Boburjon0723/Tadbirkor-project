'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { PayrollCurrency } from '@/lib/payroll-types';

type Props = {
  open: boolean;
  employeeName: string;
  initialSalary?: number;
  initialCurrency?: PayrollCurrency;
  onClose: () => void;
  onSubmit: (payload: { baseSalary: number; currency: PayrollCurrency }) => Promise<void>;
  busy?: boolean;
};

export function CompensationModal({
  open,
  employeeName,
  initialSalary,
  initialCurrency,
  onClose,
  onSubmit,
  busy,
}: Props) {
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState<PayrollCurrency>('UZS');

  useEffect(() => {
    if (!open) return;
    setSalary(initialSalary ? String(initialSalary) : '');
    setCurrency(initialCurrency ?? 'UZS');
  }, [open, initialSalary, initialCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(salary.replace(',', '.'));
    if (!num || num < 0) return;
    await onSubmit({ baseSalary: num, currency });
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <form
              onSubmit={handleSubmit}
              className="pointer-events-auto w-full max-w-md glass-card rounded-3xl border border-white/10 p-8 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black">Asosiy oylik</h3>
                  <p className="text-sm text-violet-400 mt-1 font-bold">{employeeName}</p>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 space-y-2">
                  <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Summa</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                    required
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Valyuta</span>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as PayrollCurrency)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                  >
                    <option value="UZS" className="bg-[#111]">UZS</option>
                    <option value="USD" className="bg-[#111]">USD</option>
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 font-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : null}
                Saqlash
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
