'use client';

import React, { useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { openIntakeNakladnoyPdf } from '@/features/warehouse-intake/intake-nakladnoy';

type Props = {
  intakeId: string;
  reference: string;
  className?: string;
  label?: string;
  compact?: boolean;
};

export function IntakeNakladnoyButton({
  intakeId,
  reference,
  className = '',
  label = 'Nakladnoy chop etish',
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        try {
          await openIntakeNakladnoyPdf(intakeId, reference);
        } finally {
          setLoading(false);
        }
      }}
      className={
        className ||
        (compact
          ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-emerald-400'
          : 'w-full py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/15 disabled:opacity-50')
      }
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
      {label}
    </button>
  );
}
