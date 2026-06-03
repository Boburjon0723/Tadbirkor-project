'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  User,
  X,
} from 'lucide-react';
import { saleCurrencySuffix, type SaleCurrency } from '@/lib/currency';

export type PosPaymentMethod = 'cash' | 'card' | 'credit';

type Props = {
  open: boolean;
  totalAmount: number;
  cartCurrency: SaleCurrency;
  paymentMethod: PosPaymentMethod;
  posCreditEnabled: boolean;
  cashReceivedInput: string;
  isProcessing: boolean;
  creditCustomerOk: boolean;
  formatMoney: (value: number, currency?: SaleCurrency) => string;
  onClose: () => void;
  onPaymentMethodChange: (m: PosPaymentMethod) => void;
  onCashInputChange: (v: string) => void;
  onConfirm: () => void;
};

export function PosCheckoutModal({
  open,
  totalAmount,
  cartCurrency,
  paymentMethod,
  posCreditEnabled,
  cashReceivedInput,
  isProcessing,
  creditCustomerOk,
  formatMoney,
  onClose,
  onPaymentMethodChange,
  onCashInputChange,
  onConfirm,
}: Props) {
  const received = Number(cashReceivedInput) || 0;
  const change =
    paymentMethod === 'cash' && received >= totalAmount
      ? received - totalAmount
      : 0;
  const cashOk =
    paymentMethod !== 'cash' || received >= totalAmount;
  const disabled =
    isProcessing ||
    !cashOk ||
    (paymentMethod === 'credit' && !creditCustomerOk);

  const methodBtn = (
    key: PosPaymentMethod,
    label: string,
    icon: React.ReactNode,
    activeClass: string,
    activeIconClass: string,
    opts?: { disabled?: boolean },
  ) => {
    const active = paymentMethod === key;
    const isDisabled = opts?.disabled;
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && onPaymentMethodChange(key)}
        className={`p-3 md:p-6 rounded-2xl md:rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 md:gap-3 group ${
          isDisabled
            ? 'bg-white/5 border-white/5 text-gray-600 opacity-50 cursor-not-allowed'
            : active
              ? activeClass
              : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
        }`}
      >
        <div
          className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${
            isDisabled
              ? 'bg-white/5'
              : active
                ? activeIconClass
                : 'bg-white/5 group-hover:scale-110'
          }`}
        >
          {icon}
        </div>
        <span className="font-black tracking-widest text-[9px] md:text-[10px] uppercase text-center leading-tight">
          {label}
        </span>
      </button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />
            <div className="relative space-y-6 md:space-y-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-3xl font-black mb-1 md:mb-2">
                    To&apos;lovni <span className="text-emerald-400">Yakunlash</span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all"
                >
                  <X size={20} className="md:w-6 md:h-6" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {methodBtn(
                  'cash',
                  'Naqd pul',
                  <Banknote size={22} className="md:w-7 md:h-7" />,
                  'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
                  'bg-emerald-500 text-white',
                )}
                {methodBtn(
                  'card',
                  'Karta',
                  <CreditCard size={22} className="md:w-7 md:h-7" />,
                  'bg-blue-500/10 border-blue-500/50 text-blue-400',
                  'bg-blue-600 text-white',
                )}
                {posCreditEnabled
                  ? methodBtn(
                      'credit',
                      'Nasiya',
                      <User size={22} className="md:w-7 md:h-7" />,
                      'bg-amber-500/10 border-amber-500/50 text-amber-400',
                      'bg-amber-500 text-white',
                    )
                  : methodBtn(
                      'credit',
                      'Nasiya (o‘chiq)',
                      <User size={22} className="md:w-7 md:h-7" />,
                      '',
                      '',
                      { disabled: true },
                    )}
              </div>

              <div className="p-6 md:p-8 bg-white/5 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 space-y-4 md:space-y-6">
                <div className="flex justify-between items-center text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">
                  <span>Umumiy miqdor</span>
                  <span className="text-xl md:text-2xl text-white font-black">
                    {formatMoney(totalAmount)}
                  </span>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-3 md:space-y-4 pt-4 md:pt-6 border-t border-white/10">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Qabul qilingan summa
                    </label>
                    <p className="text-xs text-gray-500 font-medium -mt-1">
                      Mijoz bergan naqd pul. Qaytim avtomatik hisoblanadi.
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-full bg-black/50 border border-white/10 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-lg md:text-xl font-black text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                        placeholder="0.00"
                        value={cashReceivedInput}
                        onChange={(e) => onCashInputChange(e.target.value)}
                      />
                      <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs md:text-base">
                        {saleCurrencySuffix(cartCurrency)}
                      </div>
                    </div>
                    {received > 0 && received < totalAmount && (
                      <p className="text-xs text-red-400 font-bold">
                        Yetarli emas — yana{' '}
                        {formatMoney(totalAmount - received)} kerak
                      </p>
                    )}
                    {change > 0 && (
                      <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
                          Qaytim
                        </span>
                        <span className="text-lg font-black text-emerald-400">
                          {formatMoney(change)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <p className="text-sm text-blue-300/90 font-medium pt-4 border-t border-white/10">
                    Mijoz to‘liq summani bank kartasi yoki terminal orqali to‘laydi.
                    Qaytim va qabul qilingan summa kiritilmaydi.
                  </p>
                )}

                {paymentMethod === 'credit' && posCreditEnabled && (
                  <p className="text-sm text-amber-300/90 font-medium pt-4 border-t border-white/10">
                    Mijoz hozir to‘lamaydi — qarz yoziladi. Savatda mijoz tanlangan
                    bo‘lishi kerak.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={onConfirm}
                className="w-full py-4 md:py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl md:rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin md:w-6 md:h-6" size={20} />
                ) : (
                  <CheckCircle2 className="md:w-6 md:h-6" size={20} />
                )}
                <span className="text-sm md:text-base">
                  {isProcessing ? 'YUBORILMOQDA...' : 'TASDIQLASH'}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
