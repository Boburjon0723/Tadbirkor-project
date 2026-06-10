'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  PosCustomerStrip,
  type PosCustomerSelection,
} from './PosCustomerStrip';

type Props = {
  open: boolean;
  value: PosCustomerSelection;
  onChange: (v: PosCustomerSelection) => void;
  onClose: () => void;
};

export function PosCustomerMobileSheet({
  open,
  value,
  onChange,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden fixed inset-0 z-[110] flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-h-[88dvh] overflow-hidden bg-[var(--pos-cart-bg)] border-t border-[var(--pos-cart-border)] rounded-t-[1.75rem] shadow-2xl flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--pos-cart-border)] shrink-0">
              <div>
                <h2 className="text-lg font-black text-[var(--pos-cart-text)]">
                  Mijoz tanlash
                </h2>
                <p className="text-[11px] text-[var(--pos-cart-muted)] font-medium">
                  Qidirish yoki yangi mijoz qo&apos;shish
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-[var(--pos-cart-card)] text-[var(--pos-cart-muted)] flex items-center justify-center"
                aria-label="Yopish"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] custom-scrollbar">
              <PosCustomerStrip
                value={value}
                onChange={onChange}
                tone="cart"
                variant="sheet"
                autoFocus
                onPicked={onClose}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
