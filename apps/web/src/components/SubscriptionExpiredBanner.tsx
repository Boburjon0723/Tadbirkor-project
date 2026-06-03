'use client';

import Link from 'next/link';
import { AlertCircle, Crown } from 'lucide-react';

type Props = {
  canWrite: boolean;
  subscriptionLabel?: string;
};

export function SubscriptionExpiredBanner({ canWrite, subscriptionLabel }: Props) {
  if (canWrite) return null;

  return (
    <div className="mb-6 p-4 md:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={22} />
        <div>
          <p className="font-black text-amber-200 text-sm">Sinov muddati tugagan</p>
          <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
            Ma’lumotlarni ko‘rishingiz mumkin, yangi buyurtma, to‘lov va boshqa amallar bloklangan.
            {subscriptionLabel ? ` Holat: ${subscriptionLabel}.` : ''}
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/settings?tab=tariflar"
        className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
      >
        <Crown size={16} />
        Obunani faollashtirish
      </Link>
    </div>
  );
}
