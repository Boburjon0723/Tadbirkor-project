'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { IncomeCategory, IncomeRow } from '@/services/income.service';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/amount-input';
import { MobileFormShell } from '@/components/mobile/MobileFormShell';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: IncomeCategory[];
  initial?: IncomeRow | null;
  defaultDate?: string;
  onSubmit: (payload: {
    categoryId: string;
    amount: number;
    currency: string;
    incomeDate: string;
    description?: string;
    notes?: string;
  }) => Promise<void>;
  busy?: boolean;
};

export function CreateIncomeModal({
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
  const [incomeDate, setIncomeDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCategoryId(initial.categoryId);
      setAmount(String(initial.amount));
      setCurrency(initial.currency === 'USD' ? 'USD' : 'UZS');
      setIncomeDate(initial.incomeDate.slice(0, 10));
      setDescription(initial.description || '');
      setNotes(initial.notes || '');
    } else {
      setCategoryId(categories[0]?.id || '');
      setAmount('');
      setCurrency('UZS');
      setIncomeDate(defaultDate || new Date().toISOString().slice(0, 10));
      setDescription('');
      setNotes('');
    }
  }, [open, initial, categories, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseAmountInput(amount);
    if (!categoryId || !Number.isFinite(num) || num <= 0 || !incomeDate) return;
    await onSubmit({
      categoryId,
      amount: num,
      currency,
      incomeDate,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <MobileFormShell
      open={open}
      onClose={onClose}
      title={initial ? 'Kirimni tahrirlash' : 'Yangi kirim'}
      maxWidth="lg"
      zIndex={200}
      footer={
        <button
          type="submit"
          form="income-form"
          disabled={busy}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 font-black text-white flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
        >
          {busy && <Loader2 className="animate-spin" size={18} />}
          Saqlash
        </button>
      }
    >
      <form id="income-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Kategoriya</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-base"
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
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
              className="mt-1 w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-base"
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Valyuta</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'UZS' | 'USD')}
              className="mt-1 w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-base"
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
            value={incomeDate}
            onChange={(e) => setIncomeDate(e.target.value)}
            className="mt-1 w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-base"
            required
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Tavsif</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white text-base"
            placeholder="Masalan: naqd savdo tushumi"
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase text-gray-500 tracking-widest">Izoh</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 font-bold text-white resize-none text-base"
          />
        </div>
      </form>
    </MobileFormShell>
  );
}
