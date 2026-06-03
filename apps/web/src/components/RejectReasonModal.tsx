'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X, XCircle } from 'lucide-react';

type Props = {
  open: boolean;
  title?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
};

export function RejectReasonModal({
  open,
  title = 'Rad etish sababi',
  busy,
  onClose,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState('');
  const modalTransition = { duration: 0.12, ease: 'easeOut' as const };

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed || busy) return;
    await onSubmit(trimmed);
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={busy ? undefined : onClose}
          />
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={modalTransition}
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{title}</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    Sabab qisqa va aniq yozilishi kerak.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl p-2 text-gray-400 hover:bg-white/10 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Masalan: hujjat yetarli emas"
              className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400/60"
            />

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={busy || !reason.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Rad etish
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
