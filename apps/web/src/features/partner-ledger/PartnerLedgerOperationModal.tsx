'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { LedgerOperation, LedgerOperationType } from '@/services/partner-ledger.service';
import { OPERATION_QUICK_ACTIONS } from './partner-ledger-utils';
import { PartnerLedgerWorkflowInfo } from './PartnerLedgerWorkflowInfo';

type Props = {
  open: boolean;
  onClose: () => void;
  presetType?: LedgerOperationType;
  initial?: LedgerOperation | null;
  onSubmit: (payload: {
    type: LedgerOperationType;
    amount: number;
    currency: string;
    operationDate: string;
    notes?: string;
  }) => Promise<void>;
  busy?: boolean;
};

export function PartnerLedgerOperationModal({
  open,
  onClose,
  presetType,
  initial,
  onSubmit,
  busy,
}: Props) {
  const [type, setType] = useState<LedgerOperationType>('SALE_OUT');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');
  const [operationDate, setOperationDate] = useState('');
  const [notes, setNotes] = useState('');
  const modalTransition = { duration: 0.12, ease: 'easeOut' as const };

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type);
      setAmount(String(initial.amount));
      setCurrency(initial.currency === 'USD' ? 'USD' : 'UZS');
      setOperationDate(initial.operationDate.slice(0, 10));
      setNotes(initial.notes || '');
    } else {
      setType(presetType || 'SALE_OUT');
      setAmount('');
      setCurrency('UZS');
      setOperationDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open, initial, presetType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || num <= 0) return;
    await onSubmit({ type, amount: num, currency, operationDate, notes: notes.trim() || undefined });
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={modalTransition}
            className="fixed inset-x-4 top-[8vh] md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-[210] glass-card rounded-3xl border border-white/10 p-6 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black text-white">
                {initial ? 'Operatsiyani tahrirlash' : 'Yangi operatsiya'}
              </h2>
              <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400">
                <X size={20} />
              </button>
            </div>

            {!initial && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {OPERATION_QUICK_ACTIONS.filter((a) => a.type !== 'SALE_OUT').map((a) => (
                    <button
                      key={a.type}
                      type="button"
                      onClick={() => setType(a.type)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border text-left ${
                        type === a.type
                          ? 'bg-blue-600/30 border-blue-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                {type === 'SALE_OUT' ? (
                  <p className="text-xs text-amber-400/90 mb-3 leading-relaxed">
                    Tovar sotish uchun sahifadagi «Sotish» tugmasidan katalogli buyurtmani ishlating.
                  </p>
                ) : null}
                <PartnerLedgerWorkflowInfo variant="compact" />
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500">Summa</label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500">Valyuta</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'UZS' | 'USD')}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold"
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500">Sana</label>
                <input
                  type="date"
                  value={operationDate}
                  onChange={(e) => setOperationDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500">Eslatma</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="animate-spin" size={16} />}
                Saqlash
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
