'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; phone?: string; tag?: string }) => Promise<void>;
  busy?: boolean;
};

export function AddPartnerLedgerContactModal({ open, onClose, onSubmit, busy }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tag, setTag] = useState('');
  const modalTransition = { duration: 0.12, ease: 'easeOut' as const };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      tag: tag.trim() || undefined,
    });
    setName('');
    setPhone('');
    setTag('');
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={modalTransition}
            className="fixed inset-x-4 top-[15vh] md:left-1/2 md:-translate-x-1/2 md:max-w-md z-[210] glass-card rounded-3xl border border-white/10 p-6 w-full md:w-auto"
          >
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-black">Hamkor qo‘shish</h2>
              <button type="button" onClick={onClose} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                placeholder="Ism *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                required
              />
              <input
                placeholder="Telefon"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
              />
              <input
                placeholder="Teg (masalan: kraskachi)"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-gray-900 font-black text-white flex justify-center gap-2"
              >
                {busy && <Loader2 className="animate-spin" size={16} />}
                Qo‘shish
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
