'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Gift } from 'lucide-react';
import { formatPayrollMonth, formatSalaryTableAmount } from '@/lib/payroll-labels';

type Props = {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  year: number;
  month: number;
  currentBonus?: number;
  onSubmit: (payload: { amount: number; reason: string }) => Promise<void>;
  busy?: boolean;
};

export function EmployeeBonusModal({
  open,
  onClose,
  employeeName,
  year,
  month,
  currentBonus = 0,
  onSubmit,
  busy,
}: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setReason('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!num || num <= 0) return;
    await onSubmit({
      amount: num,
      reason: reason.trim() || 'Bonus',
    });
    setAmount('');
    setReason('');
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex flex-col sm:items-center sm:justify-center sm:p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto flex flex-col w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-md overflow-hidden bg-[#0a0a0a] sm:glass-card rounded-none sm:rounded-2xl border-0 sm:border sm:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] border-b border-white/5 shrink-0">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <Gift className="text-amber-400" size={22} />
                      Bonus berish
                    </h3>
                    <p className="text-sm font-bold text-gray-500 mt-1">{employeeName}</p>
                    <p className="text-xs font-bold text-gray-600 mt-0.5">
                      {formatPayrollMonth(year, month)} · oylikdan tashqari
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2.5 rounded-xl hover:bg-white/5 -mr-1"
                    aria-label="Yopish"
                  >
                    <X size={20} />
                  </button>
                </div>
                {currentBonus > 0 && (
                  <p className="mt-3 text-xs font-bold text-amber-300">
                    Bu oyda jami bonus: {formatSalaryTableAmount(currentBonus)} UZS
                  </p>
                )}
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4 custom-scrollbar"
              >
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-500">
                    Bonus summasi (UZS)
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Masalan: 500 000"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-500">Sabab</span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Masalan: savdo natijasi"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                  />
                </label>
                <p className="text-[11px] font-bold text-gray-600">
                  Bonus «To‘langan oylik» kartasiga qo‘shiladi (oylik avansdan alohida).
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-black disabled:opacity-50 flex justify-center gap-2"
                >
                  {busy && <Loader2 className="animate-spin" size={16} />}
                  Bonusni saqlash
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
