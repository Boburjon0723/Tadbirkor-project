'use client';

import React from 'react';
import { Truck, Loader2 } from 'lucide-react';
import type { FieldWorkerInstallRow } from './reports-types';

type Props = {
  loading: boolean;
  fieldInstalls: FieldWorkerInstallRow[] | null;
  fieldTotalInstalled: number;
};

export function ReportsFieldWorkersSection({
  loading,
  fieldInstalls,
  fieldTotalInstalled,
}: Props) {
  const hasFieldData = (fieldInstalls?.length ?? 0) > 0;

  return (
    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/10 text-cyan-400 rounded-2xl flex items-center justify-center border border-white/5">
            <Truck size={18} />
          </div>
          <div>
            <h3 className="font-black text-lg">Dala xodimlari — o‘rnatilgan mahsulotlar</h3>
            <p className="text-[11px] text-gray-500">Tanlangan davrda tasdiqlangan vazifalar bo‘yicha (dona)</p>
          </div>
        </div>
        {hasFieldData && (
          <p className="text-sm font-black text-cyan-400">Jami: {fieldTotalInstalled} dona</p>
        )}
      </div>

      {loading && fieldInstalls === null ? (
        <div className="h-32 flex items-center justify-center text-gray-500">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : !hasFieldData ? (
        <div className="h-28 flex flex-col items-center justify-center text-gray-500 gap-2">
          <Truck size={32} className="opacity-50" />
          <p className="text-sm font-bold">Tanlangan davrda tasdiqlangan o‘rnatish yo‘q</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                <th className="text-left py-3 px-2">Xodim</th>
                <th className="text-right py-3 px-2">Vazifalar</th>
                <th className="text-right py-3 px-2">O‘rnatildi</th>
                <th className="text-right py-3 px-2">Qaytarildi</th>
                <th className="text-right py-3 px-2">Yo‘qotildi</th>
              </tr>
            </thead>
            <tbody>
              {fieldInstalls!.map((w) => (
                <tr
                  key={w.userId}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-2 font-bold text-white">{w.name}</td>
                  <td className="py-3 px-2 text-right text-gray-400">{w.approved}</td>
                  <td className="py-3 px-2 text-right font-black text-emerald-400">{w.usedQty}</td>
                  <td className="py-3 px-2 text-right text-gray-400">{w.returnedQty}</td>
                  <td className="py-3 px-2 text-right text-rose-400/90">{w.lostQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
