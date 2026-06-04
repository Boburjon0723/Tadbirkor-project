'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer } from 'lucide-react';
import {
  formatPayrollMoney,
  formatPayrollMonth,
  LINE_TYPE_LABEL,
  PERIOD_STATUS_LABEL,
} from '@/lib/payroll-labels';
import type { PayrollPeriod, PayrollRun } from '@/lib/payroll-types';
import { ROLE_LABELS, type SystemRole } from '@/lib/roles';

type Props = {
  open: boolean;
  period: PayrollPeriod | null;
  run: PayrollRun | null;
  onClose: () => void;
};

export function PayrollPayslipModal({ open, period, run, onClose }: Props) {
  if (!period || !run) return null;

  const roleLabel =
    ROLE_LABELS[run.employeeRole as SystemRole] || run.employeeRole;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] print:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none print:static print:p-0"
          >
            <div
              className="pointer-events-auto w-full max-w-lg glass-card rounded-3xl border border-white/10 p-8 space-y-6 print:bg-white print:text-black print:border-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 print:hidden">
                <div>
                  <h3 className="text-2xl font-black">Payslip</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatPayrollMonth(period.year, period.month)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                    title="Chop etish"
                  >
                    <Printer size={18} />
                  </button>
                  <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-1 border-b border-white/10 pb-4 print:border-gray-200">
                <p className="text-2xl font-black">{run.employeeName}</p>
                <p className="text-sm text-gray-400 print:text-gray-600">{roleLabel}</p>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">
                  {PERIOD_STATUS_LABEL[period.status]}
                </p>
              </div>

              <div className="space-y-2">
                {run.lines.map((line) => (
                  <div key={line.id} className="flex justify-between text-sm font-bold">
                    <span className="text-gray-400 print:text-gray-600">
                      {line.label || LINE_TYPE_LABEL[line.type]}
                    </span>
                    <span className={line.amount < 0 ? 'text-red-400 print:text-red-600' : 'text-white print:text-black'}>
                      {line.amount < 0 ? '−' : '+'}
                      {formatPayrollMoney(Math.abs(line.amount), run.currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-4 space-y-2 print:border-gray-200">
                <div className="flex justify-between font-bold text-gray-400 print:text-gray-600">
                  <span>Brutto</span>
                  <span>{formatPayrollMoney(run.grossAmount, run.currency)}</span>
                </div>
                {(run.deductionAmount > 0 || run.advanceAmount > 0) && (
                  <div className="flex justify-between font-bold text-red-400 print:text-red-600">
                    <span>Ushlab qolish</span>
                    <span>
                      −{formatPayrollMoney(run.deductionAmount + run.advanceAmount, run.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black text-violet-400 print:text-violet-700">
                  <span>To‘lanadigan</span>
                  <span>{formatPayrollMoney(run.netAmount, run.currency)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
