'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  User,
  X,
} from 'lucide-react';
import { saleCurrencySuffix, type SaleCurrency } from '@/lib/currency';
import {
  PosCustomerStrip,
  type PosCustomerSelection,
} from './PosCustomerStrip';

export type PosPaymentMethod = 'cash' | 'card' | 'credit';

type Props = {
  open: boolean;
  totalAmount: number;
  cartCurrency: SaleCurrency;
  paymentMethod: PosPaymentMethod;
  posCreditEnabled: boolean;
  cashReceivedInput: string;
  creditCustomerOk: boolean;
  customer: PosCustomerSelection;
  formatMoney: (value: number, currency?: SaleCurrency) => string;
  onClose: () => void;
  onPaymentMethodChange: (m: PosPaymentMethod) => void;
  onCashInputChange: (v: string) => void;
  onCustomerChange: (v: PosCustomerSelection) => void;
  onConfirm: () => void;
  onOpenCustomerPicker?: () => void;
};

export function PosCheckoutModal({
  open,
  totalAmount,
  cartCurrency,
  paymentMethod,
  posCreditEnabled,
  cashReceivedInput,
  creditCustomerOk,
  customer,
  formatMoney,
  onClose,
  onPaymentMethodChange,
  onCashInputChange,
  onCustomerChange,
  onConfirm,
  onOpenCustomerPicker,
}: Props) {
  const received = Number(cashReceivedInput) || 0;
  const change =
    paymentMethod === 'cash' && received >= totalAmount
      ? received - totalAmount
      : 0;
  const cashOk =
    paymentMethod !== 'cash' || received >= totalAmount;
  const creditBlocked = paymentMethod === 'credit' && !creditCustomerOk;
  const disabled = !cashOk || creditBlocked;

  const customerLabel =
    customer.customerName ||
    (customer.retailCustomerId ? 'Mijoz tanlangan' : null);

  const handleMethodChange = (method: PosPaymentMethod) => {
    onPaymentMethodChange(method);
    if (method === 'cash' && !cashReceivedInput.trim()) {
      onCashInputChange(String(totalAmount));
    }
  };

  const disabledReason = (() => {
    if (paymentMethod === 'cash' && received > 0 && received < totalAmount) {
      return `Yetarli emas — yana ${formatMoney(totalAmount - received)} kerak`;
    }
    if (paymentMethod === 'cash' && received <= 0) {
      return 'Qabul qilingan summani kiriting';
    }
    if (creditBlocked) {
      return 'Nasiya uchun mijoz tanlang yoki ism kiriting';
    }
    return null;
  })();

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
        onClick={() => !isDisabled && handleMethodChange(key)}
        className={`p-3 md:p-6 rounded-2xl md:rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 md:gap-3 group ${
          isDisabled
            ? 'bg-slate-800/50 border-[var(--pos-border)] text-gray-600 opacity-50 cursor-not-allowed'
            : active
              ? activeClass
              : 'bg-slate-800/50 border-[var(--pos-border)] text-gray-500 hover:bg-white/10'
        }`}
      >
        <div
          className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${
            isDisabled
              ? 'bg-slate-800/50'
              : active
                ? activeIconClass
                : 'bg-slate-800/50 group-hover:scale-110'
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

  const cashStep = cartCurrency === 'USD' ? '0.01' : '1';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
          data-revert-theme="true"
        >
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
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[var(--pos-modal-bg)] border border-[var(--pos-border)] rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 relative shadow-2xl custom-scrollbar text-[var(--pos-text)]"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
            <div className="relative space-y-6 md:space-y-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-3xl font-black mb-1 md:mb-2">
                    To&apos;lovni <span className="text-[var(--pos-money)]">Yakunlash</span>
                  </h2>
                  <p className="text-xs text-gray-500 font-bold">
                    Jami: {formatMoney(totalAmount, cartCurrency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-800/50 flex items-center justify-center text-gray-500 hover:text-white transition-all shrink-0"
                >
                  <X size={20} className="md:w-6 md:h-6" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {methodBtn(
                  'cash',
                  'Naqd pul',
                  <Banknote size={22} className="md:w-7 md:h-7" />,
                  'bg-emerald-500/10 border-emerald-500/50 text-[var(--pos-money)]',
                  'bg-emerald-500 text-white',
                )}
                {methodBtn(
                  'card',
                  'Karta',
                  <CreditCard size={22} className="md:w-7 md:h-7" />,
                  'bg-blue-500/10 border-blue-500/50 text-cyan-300',
                  'bg-[var(--pos-accent)] text-white',
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

              <div className="p-6 md:p-8 bg-slate-800/50 rounded-[2rem] md:rounded-[2.5rem] border border-[var(--pos-border)] space-y-4 md:space-y-6">
                <div className="flex justify-between items-center text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">
                  <span>Umumiy miqdor</span>
                  <span className="text-xl md:text-2xl text-white font-black">
                    {formatMoney(totalAmount, cartCurrency)}
                  </span>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-3 md:space-y-4 pt-4 md:pt-6 border-t border-[var(--pos-border)]">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Qabul qilingan summa
                    </label>
                    <p className="text-xs text-gray-500 font-medium -mt-1">
                      Mijoz bergan naqd pul. Qaytim avtomatik hisoblanadi.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onCashInputChange(String(totalAmount))}
                        className="px-3 py-1.5 rounded-xl bg-[var(--pos-accent-soft)] border border-cyan-500/30 text-[var(--pos-money)] text-[10px] font-black uppercase tracking-wider hover:bg-cyan-600/20 transition-all"
                      >
                        Aniq summa
                      </button>
                      {cartCurrency === 'UZS' && (
                        <>
                          {[10_000, 50_000, 100_000, 200_000, 500_000].map(
                            (denom) => (
                              <button
                                key={denom}
                                type="button"
                                onClick={() =>
                                  onCashInputChange(
                                    String(
                                      Math.max(totalAmount, denom),
                                    ),
                                  )
                                }
                                className="px-3 py-1.5 rounded-xl bg-slate-800/50 border border-[var(--pos-border)] text-gray-400 text-[10px] font-black hover:bg-white/10 transition-all"
                              >
                                {(denom / 1000).toLocaleString('uz-UZ')}k
                              </button>
                            ),
                          )}
                        </>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={cashStep}
                        className="w-full bg-black/50 border border-[var(--pos-border)] rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-lg md:text-xl font-black text-[var(--pos-money)] focus:outline-none focus:border-emerald-500/50"
                        placeholder="0"
                        value={cashReceivedInput}
                        onChange={(e) => onCashInputChange(e.target.value)}
                      />
                      <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs md:text-base pointer-events-none">
                        {saleCurrencySuffix(cartCurrency)}
                      </div>
                    </div>
                    {change > 0 && (
                      <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--pos-money)]/80">
                          Qaytim
                        </span>
                        <span className="text-lg font-black text-[var(--pos-money)]">
                          {formatMoney(change, cartCurrency)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <p className="text-sm text-blue-300/90 font-medium pt-4 border-t border-[var(--pos-border)]">
                    Mijoz to‘liq summani bank kartasi yoki terminal orqali to‘laydi.
                    Qaytim va qabul qilingan summa kiritilmaydi.
                  </p>
                )}

                {paymentMethod === 'credit' && posCreditEnabled && (
                  <div className="space-y-4 pt-4 border-t border-[var(--pos-border)]">
                    <p className="text-sm text-amber-300/90 font-medium">
                      Mijoz hozir to‘lamaydi — qarz yoziladi. Ro‘yxatdan o‘tgan
                      mijoz tanlang yoki yangi qo‘shing.
                    </p>
                    {customerLabel ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <User size={16} className="text-amber-400 shrink-0" />
                        <span className="text-sm font-bold text-amber-200">
                          {customerLabel}
                          {customer.customerPhone
                            ? ` · ${customer.customerPhone}`
                            : ''}
                        </span>
                      </div>
                    ) : null}
                    {onOpenCustomerPicker ? (
                      <button
                        type="button"
                        onClick={onOpenCustomerPicker}
                        className="md:hidden w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-800/80 border border-[var(--pos-border)] text-left"
                      >
                        <User size={18} className="text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Mijoz
                          </p>
                          <p className="text-sm font-bold text-white truncate">
                            {customerLabel || 'Tanlash uchun bosing'}
                          </p>
                        </div>
                        <span className="text-[10px] font-black text-amber-400 uppercase">
                          Tanlash
                        </span>
                      </button>
                    ) : null}
                    <div className={onOpenCustomerPicker ? 'hidden md:block' : ''}>
                      <PosCustomerStrip
                        value={customer}
                        onChange={onCustomerChange}
                      />
                    </div>
                  </div>
                )}
              </div>

              {disabledReason && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{disabledReason}</span>
                </div>
              )}

              <button
                type="button"
                disabled={disabled}
                onClick={onConfirm}
                className="w-full py-4 md:py-5 bg-[var(--pos-accent)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl md:rounded-2xl shadow-xl shadow-cyan-900/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <CheckCircle2 className="md:w-6 md:h-6" size={20} />
                <span className="text-sm md:text-base">TASDIQLASH</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
