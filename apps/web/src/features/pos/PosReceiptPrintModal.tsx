'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, FileText, CheckCircle } from 'lucide-react';
import { SaleCurrency } from '@/lib/currency';
import { printPosReceipt } from './pos-receipt-print.util';

export type ReceiptData = {
  receiptNumber?: string;
  date: Date;
  companyName?: string;
  cashierName: string;
  warehouseName: string;
  items: {
    name: string;
    quantity: number;
    unit?: string;
    price: number;
    amount: number;
  }[];
  total: number;
  currency: SaleCurrency;
  paymentMethod: 'CASH' | 'CARD' | 'CREDIT';
  customerName?: string;
  cashReceived?: number;
  change?: number;
};

type Props = {
  open: boolean;
  data: ReceiptData | null;
  onClose: () => void;
  formatMoney: (v: number, currency?: SaleCurrency) => string;
};

export function PosReceiptPrintModal({ open, data, onClose, formatMoney }: Props) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = (format: 'thermal' | 'a4') => {
    if (!data) return;
    setPrinting(true);
    void printPosReceipt(data, format, formatMoney).finally(() => {
      setPrinting(false);
      onClose();
    });
  };

  return (
    <AnimatePresence>
      {open && data && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-6"
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
            className="w-full max-w-md bg-[var(--pos-panel)] border border-[var(--pos-border)] rounded-[2rem] p-8 relative shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-[60px] -mr-20 -mt-20 pointer-events-none" />

            <button
              type="button"
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800/50 text-gray-500 hover:text-white transition-all z-10"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mb-8 relative z-10">
              <div className="w-16 h-16 bg-emerald-500/10 text-[var(--pos-money)] rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Sotuv bajarildi!</h2>
              <p className="text-gray-400 text-sm">
                Xaridorga chek berish uchun quyidagi formatlardan birini tanlang.
              </p>
            </div>

            <div className="space-y-3 relative z-10">
              <button
                type="button"
                disabled={printing}
                onClick={() => handlePrint('thermal')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--pos-border)] bg-slate-800/50 hover:bg-white/10 hover:border-blue-500/50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-blue-500/10 text-cyan-300 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Printer size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-0.5">Termal Chek (58/80mm)</h3>
                  <p className="text-xs text-gray-500">Do&apos;kon printerlari uchun ixcham chek</p>
                </div>
              </button>

              <button
                type="button"
                disabled={printing}
                onClick={() => handlePrint('a4')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--pos-border)] bg-slate-800/50 hover:bg-white/10 hover:border-purple-500/50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-0.5">A4 Invoys Format</h3>
                  <p className="text-xs text-gray-500">Standart A4 o&apos;lchamdagi to&apos;liq hisobot</p>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--pos-border)] relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 text-sm font-bold text-gray-400 hover:text-white transition-colors"
              >
                Cheksiz davom etish
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
