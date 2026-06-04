'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { LINE_TYPE_LABEL } from '@/lib/payroll-labels';
import type { PayrollLineType } from '@/lib/payroll-types';

type Props = {
  open: boolean;
  employeeName?: string;
  onClose: () => void;
  onSubmit: (payload: { type: PayrollLineType; label: string; amount: number }) => Promise<void>;
  busy?: boolean;
};

const ADJUSTMENT_TYPES: PayrollLineType[] = ['BONUS', 'PENALTY', 'ADVANCE', 'COMMISSION', 'MANUAL'];

export function AddPayrollAdjustmentModal({
  open,
  employeeName,
  onClose,
  onSubmit,
  busy,
}: Props) {
  const [type, setType] = useState<PayrollLineType>('BONUS');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [isDeduction, setIsDeduction] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType('BONUS');
    setLabel('');
    setAmount('');
    setIsDeduction(false);
  }, [open]);

  useEffect(() => {
    if (type === 'PENALTY' || type === 'ADVANCE') {
      setIsDeduction(true);
    } else if (type === 'BONUS' || type === 'COMMISSION') {
      setIsDeduction(false);
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || num <= 0) return;

    const signed =
      isDeduction || type === 'PENALTY' || type === 'ADVANCE' ? -Math.abs(num) : Math.abs(num);

    await onSubmit({
      type,
      label: label.trim() || LINE_TYPE_LABEL[type],
      amount: signed,
    });
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
                  <h3 className="text-2xl font-black">Qo‘shimcha / ushlab qolish</h3>
                  {employeeName && (
                    <p className="text-sm text-violet-400 mt-1 font-bold">{employeeName}</p>
                  )}
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>

              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Turi</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PayrollLineType)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                >
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-[#111]">
                      {LINE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Izoh</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                  placeholder="Masalan: savdo bonusi"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Summa</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                  required
                />
              </label>

              {type === 'MANUAL' && (
                <label className="flex items-center gap-3 text-sm font-bold text-gray-400">
                  <input
                    type="checkbox"
                    checked={isDeduction}
                    onChange={(e) => setIsDeduction(e.target.checked)}
                    className="rounded"
                  />
                  Ushlab qolish (minus)
                </label>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 font-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : null}
                Qo‘shish
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
