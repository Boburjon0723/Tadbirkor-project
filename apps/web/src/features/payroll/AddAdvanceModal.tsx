'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { amount: number; reason: string; advanceDate: string }) => Promise<void>;
  busy?: boolean;
};

export function AddAdvanceModal({ open, onClose, onSubmit, busy }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setReason('');
    setAdvanceDate(new Date().toISOString().slice(0, 10));
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!num || num <= 0 || !advanceDate) return;
    await onSubmit({ amount: num, reason: reason.trim() || 'Avans', advanceDate });
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <form
              onSubmit={handleSubmit}
              className="pointer-events-auto w-full max-w-md glass-card rounded-2xl border border-white/10 p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black">Yangi avans</h3>
                <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/5">
                  <X size={18} />
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Summa (UZS)</span>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Sana</span>
                <input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Sabab</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Masalan: Shaxsiy ehtiyojlar"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-blue-600 font-black disabled:opacity-50 flex justify-center gap-2"
              >
                {busy && <Loader2 className="animate-spin" size={16} />}
                Qo‘shish
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
