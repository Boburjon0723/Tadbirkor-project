'use client';

import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CreateOrderCloseConfirm({ open, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative z-10 w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <AlertCircle size={20} className="text-red-400" />
          </div>
          <h3 className="text-lg font-black text-white">Yopishni tasdiqlang</h3>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Kiritilgan ma&apos;lumotlar saqlanmaydi. Davom etasizmi?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-2xl transition-all"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all"
          >
            Ha, yopish
          </button>
        </div>
      </motion.div>
    </div>
  );
}
