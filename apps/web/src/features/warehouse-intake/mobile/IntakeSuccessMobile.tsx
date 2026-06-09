'use client';

import React from 'react';
import { CheckCircle2, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { IntakeNakladnoyButton } from '@/features/warehouse-intake/IntakeNakladnoyButton';

type Props = {
  intakeId: string;
  reference: string;
  units: number;
  onBackToList: () => void;
};

export function IntakeSuccessMobile({ intakeId, reference, units, onBackToList }: Props) {
  return (
    <div className="fixed inset-0 z-[90] bg-[#0e1511] flex flex-col items-center justify-center px-6 pb-24">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="intake-glass rounded-[24px] p-8 w-full max-w-sm text-center shadow-[0_0_80px_-10px_rgba(16,185,129,0.3)]"
      >
        <CheckCircle2 size={64} className="text-[#10b981] mx-auto mb-4" />
        <h2 className="text-xl font-extrabold text-[#dde4dd] mb-2">Muvaffaqiyatli yakunlandi</h2>
        <p className="text-sm text-[#bbcabf] mb-1 font-mono">{reference}</p>
        <p className="text-2xl font-black text-[#10b981] mb-6">{units} dona</p>
        <div className="mb-3">
          <IntakeNakladnoyButton
            intakeId={intakeId}
            reference={reference}
            label="Nakladnoy chop etish"
          />
        </div>
        <button
          type="button"
          onClick={onBackToList}
          className="w-full h-14 bg-[#0566d9] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <List size={18} />
          Ro&apos;yxatga qaytish
        </button>
      </motion.div>
    </div>
  );
}
