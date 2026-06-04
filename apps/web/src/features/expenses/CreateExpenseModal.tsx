'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { ExpenseCategory, ExpenseRow } from '@/services/expenses.service';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  initial?: ExpenseRow | null;
  defaultDate?: string;
  onSubmit: (payload: {
    categoryId: string;
    amount: number;
    currency: string;
    expenseDate: string;
    description?: string;
    notes?: string;
  }) => Promise<void>;
  busy?: boolean;
};

export function CreateExpenseModal({
  open,
  onClose,
  categories,
  initial,
  defaultDate,
  onSubmit,
  busy,
}: Props) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');
  const [expenseDate, setExpenseDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const modalTransition = { duration: 0.12, ease: 'easeOut' as const };

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCategoryId(initial.categoryId);
      setAmount(String(initial.amount));
      setCurrency(initial.currency === 'USD' ? 'USD' : 'UZS');
      setExpenseDate(initial.expenseDate.slice(0, 10));
      setDescription(initial.description || '');
      setNotes(initial.notes || '');
    } else {
      setCategoryId(categories[0]?.id || '');
      setAmount('');
      setCurrency('UZS');
      setExpenseDate(defaultDate || new Date().toISOString().slice(0, 10));
      setDescription('');
      setNotes('');
    }
  }, [open, initial, categories, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!categoryId || !num || num <= 0 || !expenseDate) return;
    await onSubmit({
      categoryId,
      amount: num,
      currency,
      expenseDate,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
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
            transition={modalTransition}
            className="fixed inset-0 bg-black/70 z-[200]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={modalTransition}
            className="fixed inset-x-4 top-[10vh] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-[210] glass-card rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">
                {initial ? 'Xarajatni tahrirlash' : 'Yangi xarajat'}
              </h2>
              <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Kategoriya</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold text-white"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-gray-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Summa</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold text-white"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Valyuta</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'UZS' | 'USD')}
                    className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold text-white"
                  >
                    <option value="UZS" className="bg-gray-900">UZS</option>
                    <option value="USD" className="bg-gray-900">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Sana</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Tavsif</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold text-white"
                  placeholder="Masalan: ofis qog‘ozlari"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Izoh</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold text-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-white flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="animate-spin" size={18} />}
                Saqlash
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
