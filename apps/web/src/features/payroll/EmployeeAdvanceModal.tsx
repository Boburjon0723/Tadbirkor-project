'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { PayrollAdvance } from '@/lib/payroll-types';
import { formatPayrollMonth, formatPayrollMoney, formatSalaryTableAmount } from '@/lib/payroll-labels';

type Props = {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  baseSalary: number;
  /** Dam olish limiti oshganda — ish kunlari bo‘yicha avans limiti */
  effectiveSalaryCap?: number;
  excessLeaveDays?: number;
  leaveDaysUsed?: number;
  paidLeaveQuota?: number;
  totalWorkDays?: number;
  workedDaysForCap?: number;
  year: number;
  month: number;
  advances: PayrollAdvance[];
  advancesTotal: number;
  onSubmit: (payload: { amount: number; reason: string; advanceDate: string }) => Promise<void>;
  busy?: boolean;
  loadingHistory?: boolean;
  loadingCap?: boolean;
};

function formatAdvanceDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function EmployeeAdvanceModal({
  open,
  onClose,
  employeeName,
  baseSalary,
  year,
  month,
  advances,
  advancesTotal,
  effectiveSalaryCap,
  excessLeaveDays = 0,
  leaveDaysUsed = 0,
  paidLeaveQuota = 0,
  totalWorkDays = 0,
  workedDaysForCap = 0,
  onSubmit,
  busy,
  loadingHistory,
  loadingCap,
}: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');

  const salaryCap = effectiveSalaryCap ?? baseSalary;
  const leaveLimitExceeded = excessLeaveDays > 0;

  const remaining = Math.max(0, salaryCap - advancesTotal);
  const salarySet = baseSalary > 0;
  const salaryCovered = salarySet && advancesTotal >= salaryCap;
  const canAdd = salarySet && !salaryCovered && remaining > 0 && !loadingCap;

  const maxAmount = remaining;

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setReason('');
    setAdvanceDate(new Date().toISOString().slice(0, 10));
  }, [open]);

  const progressPct = useMemo(() => {
    if (!salarySet || salaryCap <= 0) return 0;
    return Math.min(100, Math.round((advancesTotal / salaryCap) * 100));
  }, [salaryCap, advancesTotal, salarySet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    const num = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!num || num <= 0 || !advanceDate) return;
    if (num > maxAmount) return;
    await onSubmit({ amount: num, reason: reason.trim() || 'Avans', advanceDate });
    setAmount('');
    setReason('');
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex flex-col sm:items-center sm:justify-center sm:p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto flex flex-col w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-lg overflow-hidden bg-[#0a0a0a] sm:glass-card rounded-none sm:rounded-2xl border-0 sm:border sm:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] border-b border-white/5 shrink-0">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <Wallet className="text-violet-400" size={22} />
                      Avans berish
                    </h3>
                    <p className="text-sm font-bold text-gray-500 mt-1">{employeeName}</p>
                    <p className="text-xs font-bold text-gray-600 mt-0.5">
                      {formatPayrollMonth(year, month)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2.5 rounded-xl hover:bg-white/5 -mr-1"
                    aria-label="Yopish"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] font-black uppercase text-gray-500">Oylik</p>
                    <p className="text-sm font-black text-white mt-1">
                      {salarySet ? formatSalaryTableAmount(baseSalary) : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] font-black uppercase text-gray-500">
                      {salaryCovered ? 'To‘langan' : 'Berilgan'}
                    </p>
                    <p
                      className={`text-sm font-black mt-1 ${
                        salaryCovered ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {formatSalaryTableAmount(advancesTotal)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] font-black uppercase text-gray-500">
                      {leaveLimitExceeded ? 'Avans qoldiq' : 'Qoldiq'}
                    </p>
                    <p className="text-sm font-black text-emerald-300 mt-1">
                      {salarySet && !loadingCap ? formatSalaryTableAmount(remaining) : '—'}
                    </p>
                  </div>
                </div>

                {leaveLimitExceeded && (
                  <p className="mt-3 text-xs font-bold text-amber-400 flex items-start gap-1.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>
                      Dam olish: {leaveDaysUsed} kun (limit {paidLeaveQuota}) —{' '}
                      {leaveDaysUsed - paidLeaveQuota} kun ortiq. Ish kunlari:{' '}
                      {workedDaysForCap}/{totalWorkDays} → avans limiti{' '}
                      {formatSalaryTableAmount(salaryCap)} UZS (
                      {formatSalaryTableAmount(baseSalary)} oylikdan)
                    </span>
                  </p>
                )}

                {salarySet && (
                  <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        salaryCovered ? 'bg-emerald-500' : 'bg-violet-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}

                {!salarySet && (
                  <p className="mt-3 text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    Avval xodimga oylik maosh belgilang
                  </p>
                )}
                {salaryCovered && (
                  <p className="mt-3 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    Oylik to‘lov amalga oshgan — qo‘shimcha avans berilmaydi
                  </p>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4 custom-scrollbar">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                    Avanslar tarixi
                  </p>
                  {loadingHistory ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="animate-spin text-violet-400" size={24} />
                    </div>
                  ) : advances.length === 0 ? (
                    <p className="text-sm font-bold text-gray-500 py-4 text-center">
                      Bu oyda avans yo‘q
                    </p>
                  ) : (
                    <ul className="space-y-2 sm:max-h-[200px] sm:overflow-y-auto">
                      {advances.map((a) => (
                        <li
                          key={a.id}
                          className="flex justify-between items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div>
                            <p className="text-sm font-black text-white">
                              {formatSalaryTableAmount(a.amount)} UZS
                            </p>
                            <p className="text-xs font-bold text-gray-500 mt-0.5">
                              {formatAdvanceDate(a.advanceDate)}
                              {a.reason ? ` · ${a.reason}` : ''}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canAdd && (
                  <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-white/5">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase text-gray-500">
                        Yangi avans (UZS)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={maxAmount}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Maks. ${formatSalaryTableAmount(maxAmount)}`}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                        required
                      />
                      <p className="text-[11px] font-bold text-gray-600">
                        {leaveLimitExceeded
                          ? `Dam olish hisobida maksimal: ${formatPayrollMoney(maxAmount, 'UZS')}`
                          : `Maksimal: ${formatPayrollMoney(maxAmount, 'UZS')}`}
                      </p>
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
                        placeholder="Masalan: Shaxsiy ehtiyoj"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-black disabled:opacity-50 flex justify-center gap-2"
                    >
                      {busy && <Loader2 className="animate-spin" size={16} />}
                      Avansni saqlash
                    </button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
