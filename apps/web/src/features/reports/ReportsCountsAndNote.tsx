'use client';

import React from 'react';
import type { CostSummary } from './reports-types';

type Props = {
  summary: CostSummary | null;
};

export function ReportsCountsAndNote({ summary }: Props) {
  if (!summary) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
            Davrda kirimlar
          </p>
          <p className="text-2xl font-black">{summary.counts.purchaseMovements}</p>
          <p className="text-[11px] text-gray-500 mt-1">harakat</p>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
            Davrda chiqimlar
          </p>
          <p className="text-2xl font-black">{summary.counts.salesMovements}</p>
          <p className="text-[11px] text-gray-500 mt-1">harakat</p>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
            Joriy ombor pozitsiyalari
          </p>
          <p className="text-2xl font-black">{summary.counts.stockLines}</p>
          <p className="text-[11px] text-gray-500 mt-1">qator</p>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white/[0.01] border border-white/5 text-[12px] text-gray-500 leading-relaxed space-y-2">
        <p>
          <strong className="text-gray-300">Kirim summasi</strong> — faqat hamkordan rasmiy qabul (
          <em className="text-gray-300">GoodsReceipt</em>): miqdor × mahsulotning{' '}
          <strong className="text-gray-300">kirim narxi</strong> (purchasePrice). Excel/qo‘lda kirim va
          boshlang‘ich qoldiq bu yerga kirmaydi.
        </p>
        <p>
          <strong className="text-gray-300">Sotuv summasi</strong> — davrdagi barcha ombor chiqimlari (OUT):
          miqdor × <strong className="text-gray-300">katalog sotuv narxi</strong> (salePrice). POS chekdagi
          chegirma yoki boshqa narx bu hisobotga alohida yozilmaydi.
        </p>
        <p>
          <strong className="text-gray-300">Foyda</strong> = sotuv − kirim (har valyuta alohida). Bu
          buxgalteriya COGS emas — xarajatlar (Expenses) va naqd pul oqimi alohida.
        </p>
        <p>
          <strong className="text-gray-300">Ombor qiymati (hozir)</strong> — joriy qoldiq × kirim narxi;
          sotuv narxi bo‘yicha emas.
        </p>
        <p className="text-[11px] text-gray-600">
          Narxlar har doim variantning <strong className="text-gray-400">joriy</strong> narxidan olinadi;
          o‘tgan davr uchun tarixiy snapshot saqlanmaydi (narx o‘zgarganda hisobot ham o‘zgaradi).
        </p>
      </div>
    </>
  );
}
