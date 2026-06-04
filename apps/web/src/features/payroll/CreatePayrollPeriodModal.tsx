'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { year: number; month: number; notes?: string }) => Promise<void>;
  busy?: boolean;
};

const MONTHS = [
  { value: 1, label: 'Yanvar' },
  { value: 2, label: 'Fevral' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Aprel' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Iyun' },
  { value: 7, label: 'Iyul' },
  { value: 8, label: 'Avgust' },
  { value: 9, label: 'Sentabr' },
  { value: 10, label: 'Oktabr' },
  { value: 11, label: 'Noyabr' },
  { value: 12, label: 'Dekabr' },
];

export function CreatePayrollPeriodModal({ open, onClose, onSubmit, busy }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setNotes('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ year, month, notes: notes.trim() || undefined });
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
              className="pointer-events-auto w-full max-w-md glass-card rounded-3xl border border-white/10 p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black">Yangi oylik davri</h3>
                  <p className="text-sm text-gray-500 mt-1">Hisoblash uchun oy tanlang</p>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Yil</span>
                  <input
                    type="number"
                    min={2020}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                    required
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Oy</span>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value} className="bg-[#111]">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Izoh (ixtiyoriy)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold resize-none"
                  placeholder="Masalan: iyun oyi — yangi xodim qo‘shildi"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 font-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : null}
                Davr yaratish
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
