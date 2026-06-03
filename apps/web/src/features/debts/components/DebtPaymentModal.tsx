'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, DollarSign, Loader2, CheckCircle2 } from 'lucide-react';
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
  const modalTransition = { duration: 0.12, ease: 'easeOut' as const };

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={modalTransition}
            className="relative w-full max-w-xl glass-card rounded-[2.5rem] p-6 md:p-8 bg-[#0a0a0c]/95 border border-white/10 shadow-2xl backdrop-blur-3xl"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl md:text-2xl font-black mb-1">
                  {selectedDebt.isIncoming ? (
                    <>To&apos;lovni <span className="text-emerald-500">Qabul Qilish</span></>
                  ) : (
                    <>To&apos;lovni <span className="text-blue-500">Qayd Etish</span></>
                  )}
                </h3>
                <p className="text-gray-500 text-xs">
                  Hamkor: <span className="text-white font-bold">{selectedDebt.partner.name}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all focus:outline-none"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Qolgan Qarz</p>
                  <p className="text-2xl font-black text-white">
                    {formatMoney(Number(selectedDebt.remainingAmount), (selectedDebt.currency || 'UZS') as 'UZS' | 'USD')}
                  </p>
                </div>
                <AlertCircle className="text-blue-400 opacity-50" size={32} />
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1 flex justify-between gap-2">
                    <span>To'lov Summasi</span>
                    <span className="text-blue-400 normal-case">
                      {String(selectedDebt.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS'}
                    </span>
                  </label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors w-4.5 h-4.5" />
                    <input
                      required
                      type="number"
                      max={selectedDebt.remainingAmount}
                      placeholder={String(selectedDebt.currency || 'UZS').toUpperCase() === 'USD' ? '0.00' : '0'}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-lg font-black focus:border-blue-500/50 outline-none transition-all text-white h-12"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Izoh / To'lov Usuli</label>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 font-bold outline-none focus:border-blue-500/50 transition-all h-20 resize-none text-white text-xs md:text-sm"
                    placeholder="Masalan: Naqd pul orqali yoki karta raqamiga..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-gray-400 hover:text-white transition-all text-xs h-12 active:scale-95"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isPending || !paymentAmount}
                  className={`flex-[2] py-3 text-white font-black rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5 text-xs h-12 ${
                    selectedDebt.isIncoming
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <span>
                        {selectedDebt.isIncoming ? "To'lovni qabul qilish" : "To'lovni yuborish"}
                      </span>
                      <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
