'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, PenLine } from 'lucide-react';
import type { LedgerOperation, LedgerOperationType } from '@/services/partner-ledger.service';
import { OPERATION_QUICK_ACTIONS } from './partner-ledger-utils';
import { PartnerLedgerWorkflowInfo } from './PartnerLedgerWorkflowInfo';
import { MobileFormShell } from '@/components/mobile/MobileFormShell';

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
    <MobileFormShell
      open={open}
      onClose={onClose}
      maxWidth="lg"
      zIndex={200}
      icon={
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
          <PenLine size={20} />
        </div>
      }
      title={initial ? 'Operatsiyani tahrirlash' : 'Yangi operatsiya'}
      footer={
        <button
          type="submit"
          form="partner-ledger-operation-form"
          disabled={busy}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy && <Loader2 className="animate-spin" size={16} />}
          Saqlash
        </button>
      }
    >
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

      <form id="partner-ledger-operation-form" onSubmit={handleSubmit} className="space-y-3 mt-4">
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
      </form>
    </MobileFormShell>
  );
}
