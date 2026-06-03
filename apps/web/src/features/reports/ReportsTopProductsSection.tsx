'use client';

import React from 'react';
import { Trophy, Package as PackageIcon, Loader2 } from 'lucide-react';
import { formatSaleAmount } from '@/lib/currency';
import type { TopProduct } from './reports-types';

type Props = {
  loading: boolean;
  top: TopProduct[];
};

export function ReportsTopProductsSection({ loading, top }: Props) {
  const hasTopData = top.length > 0;

  return (
    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center border border-white/5">
          <Trophy size={18} />
        </div>
        <div>
          <h3 className="font-black text-lg">Top 10 sotilgan mahsulot</h3>
          <p className="text-[11px] text-gray-500">Tanlangan davrdagi chiqimlar bo‘yicha</p>
        </div>
      </div>

      {loading && top.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-gray-500">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : !hasTopData ? (
        <div className="h-32 flex flex-col items-center justify-center text-gray-500 gap-2">
          <PackageIcon size={32} className="opacity-50" />
          <p className="text-sm font-bold">Sotuv yozuvlari topilmadi</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                <th className="text-left py-3 px-2 w-12">#</th>
                <th className="text-left py-3 px-2">Mahsulot</th>
                <th className="text-left py-3 px-2">Variant</th>
                <th className="text-left py-3 px-2">SKU</th>
                <th className="text-right py-3 px-2">Miqdor</th>
                <th className="text-right py-3 px-2" title="Miqdor × joriy katalog sotuv narxi">
                  Tushum (katalog)
                </th>
              </tr>
            </thead>
            <tbody>
              {top.map((t, idx) => (
                <tr
                  key={t.productVariantId}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-black ${
                        idx === 0
                          ? 'bg-amber-500/20 text-amber-300'
                          : idx === 1
                            ? 'bg-gray-400/20 text-gray-300'
                            : idx === 2
                              ? 'bg-orange-700/20 text-orange-300'
                              : 'bg-white/5 text-gray-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-bold text-white">{t.productName}</td>
                  <td className="py-3 px-2 text-gray-400">{t.variantName}</td>
                  <td className="py-3 px-2 text-gray-500 font-mono text-xs">{t.sku || '—'}</td>
                  <td className="py-3 px-2 text-right font-black">{t.quantity}</td>
                  <td className="py-3 px-2 text-right font-black text-emerald-400">
                    {formatSaleAmount(t.revenue, t.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
