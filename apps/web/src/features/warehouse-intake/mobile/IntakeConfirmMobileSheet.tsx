'use client';

import React from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IntakeLine } from '@/services/warehouse-intake.service';
import { lineQty } from '@/features/warehouse-intake/intake-utils';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  lines: IntakeLine[];
  positions: number;
  units: number;
  loading?: boolean;
};

export function IntakeConfirmMobileSheet({
  open,
  onClose,
  onConfirm,
  lines,
  positions,
  units,
  loading,
}: Props) {
  const preview = lines.slice(0, 5);
  const rest = Math.max(0, lines.length - 5);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg intake-glass rounded-t-[24px] p-6 pb-10"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-extrabold text-[#dde4dd]">Kirimni tasdiqlash</h2>
              <button type="button" onClick={onClose} className="p-2">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-[#bbcabf] mb-4">
              {positions} ta mahsulot, jami <span className="text-emerald-400 font-bold">{units}</span>{' '}
              dona omborga kiritiladi.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-6">
              {preview.map((line) => (
                <div
                  key={line.id}
                  className="flex justify-between text-sm py-2 border-b border-white/5"
                >
                  <span className="text-[#dde4dd] truncate pr-2">
                    {line.productVariant?.name}
                  </span>
                  <span className="text-emerald-400 font-bold shrink-0">{lineQty(line)}</span>
                </div>
              ))}
              {rest > 0 && (
                <p className="text-xs text-[#86948a] pt-1">va yana {rest} ta mahsulot...</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={loading}
              className="w-full h-14 bg-[#10b981] text-[#00422b] font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Omborga kiritish
                  <Send size={18} />
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
