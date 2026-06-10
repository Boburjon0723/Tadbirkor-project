'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
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
  const { inset: keyboardInset, viewportHeight } = useKeyboardInset(open);

  const sheetMaxHeight =
    viewportHeight != null
      ? Math.min(viewportHeight * 0.92, viewportHeight - 8)
      : undefined;

  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden fixed inset-0 z-[110]">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute left-0 right-0 flex flex-col overflow-hidden bg-[var(--pos-cart-bg)] border-t border-[var(--pos-cart-border)] rounded-t-[1.75rem] shadow-2xl"
            style={{
              bottom: keyboardInset,
              maxHeight: sheetMaxHeight ?? 'min(88dvh, 92svh)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--pos-cart-border)] shrink-0">
              <div className="min-w-0 pr-3">
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
                className="w-10 h-10 shrink-0 rounded-xl bg-[var(--pos-cart-card)] text-[var(--pos-cart-muted)] inline-flex items-center justify-center"
                aria-label="Yopish"
              >
                <X size={20} className="block" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] custom-scrollbar">
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
