'use client';

import React, { useState } from 'react';
import {
  Calendar,
  FileText,
  CreditCard,
  CheckCircle2,
  XCircle,
  Settings2,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DebtRowActionsProps {
  debt: any;
  activeTab: 'receivable' | 'payable';
  pendingByDebtId: Record<string, any>;
  resolvedPendingDebtIds: Record<string, boolean>;
  onDownloadPdf: () => void;
  onOpenPayment: () => void;
  onConfirmPayment: () => void;
  onRejectPayment: () => void;
  onShowTimeline: () => void;
}

export function DebtRowActions({
  debt,
  activeTab,
  pendingByDebtId,
  resolvedPendingDebtIds,
  onDownloadPdf,
  onOpenPayment,
  onConfirmPayment,
  onRejectPayment,
  onShowTimeline,
}: DebtRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasPending =
    activeTab === 'receivable' &&
    pendingByDebtId[debt.id] &&
    !resolvedPendingDebtIds[debt.id];
  const showPayable = activeTab === 'payable' && debt.status !== 'PAID';

  const actions: any[] = [];

  actions.push({
    label: "Tarixni ko'rish",
    icon: Calendar,
    onClick: onShowTimeline,
    className: 'text-blue-400 hover:bg-blue-500/10 hover:text-blue-300',
  });

  actions.push({
    label: 'Akt Sverka PDF',
    icon: FileText,
    onClick: onDownloadPdf,
    className: 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300',
  });

  if (showPayable) {
    actions.push({
      label: "To'lov qayd etish",
      icon: CreditCard,
      onClick: onOpenPayment,
      className: 'text-blue-400 hover:bg-blue-500/10 hover:text-blue-300',
    });
  }

  if (hasPending) {
    actions.push({
      label: "To'lovni tasdiqlash",
      icon: CheckCircle2,
      onClick: onConfirmPayment,
      className: 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300',
    });
    actions.push({
      label: "To'lovni rad etish",
      icon: XCircle,
      onClick: onRejectPayment,
      className: 'text-red-400 hover:bg-red-500/10 hover:text-red-300',
    });
  }

  const shouldCollapse = actions.length >= 3;

  return (
    <div className="relative flex items-center justify-end gap-2 z-30">
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
      )}

      <AnimatePresence>
        {isOpen && shouldCollapse && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 bg-[#0c0c0e]/95 border border-white/10 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl z-50 flex flex-col gap-0.5"
          >
            {actions.map((act) => (
              <button
                key={act.label}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  act.onClick();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${act.className}`}
              >
                <act.icon size={15} className="shrink-0" />
                <span>{act.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 h-10 w-10 flex items-center justify-center transition-all active:scale-95 ${isOpen ? 'bg-white/10 text-white' : ''}`}
          title="Amallar"
        >
          <Settings2 size={16} />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          {actions.map((act) => (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className={`p-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 h-10 w-10 flex items-center justify-center transition-all active:scale-95 ${act.className}`}
              title={act.label}
            >
              <act.icon size={16} />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onShowTimeline}
        className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-gray-500 h-10 w-10 flex items-center justify-center active:scale-95"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
