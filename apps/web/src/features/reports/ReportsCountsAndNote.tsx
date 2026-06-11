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
          <strong className="text-gray-300">Kirim summasi</strong> — davrda omborga kirgan mahsulotlar: hamkor
          qabuli, ombor kirimi, boshlang‘ich qoldiq va ijobiy tuzatishlar. Narx:{' '}
          <strong className="text-gray-300">kirim narxi</strong>, bo‘sh bo‘lsa — sotuv narxi.
        </p>
        <p>
          <strong className="text-gray-300">Sotuv summasi</strong> — haqiqiy daromad: POS chekdagi qator
          summasi (chegirma bilan), B2B jo‘natmada buyurtma narxi, qolgan chiqimlar — katalog narxi.
          Bekor qilingan cheklar hisobga olinmaydi.
        </p>
        <p>
          <strong className="text-gray-300">Yalpi foyda</strong> = sotuv −{' '}
          <strong className="text-gray-300">tannarx (COGS)</strong> — sotilgan miqdor ×{' '}
          <strong className="text-gray-300">kirim narxi</strong>. Kirim narxi kiritilmagan mahsulotlar
          tannarxga 0 deb olinadi — aniq foyda uchun katalogda kirim narxini to‘ldiring.
        </p>
        <p>
          <strong className="text-gray-300">Ombor qiymati (hozir)</strong> — joriy qoldiq × kirim narxi
          (bo‘sh bo‘lsa sotuv narxi).
        </p>
        <p className="text-[11px] text-gray-600">
          Narxlar har doim variantning <strong className="text-gray-400">joriy</strong> narxidan olinadi;
          o‘tgan davr uchun tarixiy snapshot saqlanmaydi (narx o‘zgarganda hisobot ham o‘zgaradi).
        </p>
      </div>
    </>
  );
}
