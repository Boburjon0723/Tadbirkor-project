'use client';

import React from 'react';
import { AlertCircle, DollarSign, Loader2, CheckCircle2 } from 'lucide-react';
import { MobileFormShell } from '@/components/mobile/MobileFormShell';
import { formatMoney } from '../debts-utils';

interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDebt: any;
  paymentAmount: string;
  setPaymentAmount: (val: string) => void;
  paymentNotes: string;
  setPaymentNotes: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function DebtPaymentModal({
  isOpen,
  onClose,
  selectedDebt,
  paymentAmount,
  setPaymentAmount,
  paymentNotes,
  setPaymentNotes,
  onSubmit,
  isPending,
}: DebtPaymentModalProps) {
  if (!selectedDebt) return null;

  const title = selectedDebt.isIncoming ? (
    <>To&apos;lovni <span className="text-emerald-500">qabul qilish</span></>
  ) : (
    <>To&apos;lovni <span className="text-blue-500">qayd etish</span></>
  );

  return (
    <MobileFormShell
      open={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`Hamkor: ${selectedDebt.partner.name}`}
      maxWidth="xl"
      zIndex={140}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3.5 bg-white/5 border border-white/10 rounded-xl font-bold text-gray-400 text-sm"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            form="debt-payment-form"
            disabled={isPending || !paymentAmount}
            className={`w-full sm:flex-[2] py-3.5 text-white font-black rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-sm ${
              selectedDebt.isIncoming
                ? 'bg-emerald-600'
                : 'bg-blue-600'
            }`}
          >
            {isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                {selectedDebt.isIncoming ? "To'lovni qabul qilish" : "To'lovni yuborish"}
                <CheckCircle2 size={16} />
              </>
            )}
          </button>
        </>
      }
    >
      <form id="debt-payment-form" onSubmit={onSubmit} className="space-y-5">
        <div className="p-4 md:p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl md:rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">
              Qolgan qarz
            </p>
            <p className="text-2xl font-black text-white">
              {formatMoney(
                Number(selectedDebt.remainingAmount),
                (selectedDebt.currency || 'UZS') as 'UZS' | 'USD',
              )}
            </p>
          </div>
          <AlertCircle className="text-blue-400 opacity-50" size={28} />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1 flex justify-between gap-2">
              <span>To&apos;lov summasi</span>
              <span className="text-blue-400 normal-case">
                {String(selectedDebt.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS'}
              </span>
            </label>
            <div className="relative group">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                required
                type="number"
                inputMode="decimal"
                max={selectedDebt.remainingAmount}
                placeholder={
                  String(selectedDebt.currency || 'UZS').toUpperCase() === 'USD' ? '0.00' : '0'
                }
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-lg font-black focus:border-blue-500/50 outline-none text-white text-base"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">
              Izoh / to&apos;lov usuli
            </label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 font-bold outline-none focus:border-blue-500/50 h-24 resize-none text-white text-base"
              placeholder="Masalan: Naqd pul yoki karta..."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>
        </div>
      </form>
    </MobileFormShell>
  );
}
