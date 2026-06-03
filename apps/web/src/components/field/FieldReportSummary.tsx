'use client';

import React from 'react';
import { Package } from 'lucide-react';
import type { FieldReportRow } from '@/lib/field-report';

type Props = {
  rows: FieldReportRow[];
  title?: string;
  subtitle?: string;
};

export function FieldReportSummary({ rows, title, subtitle }: Props) {
  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-emerald-400" />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">
            {title || 'O‘rnatilgan mahsulotlar hisobi'}
          </p>
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <ul className="divide-y divide-white/5">
        {rows.map((row) => (
          <li key={row.variantId} className="px-4 py-3 space-y-1">
            <div className="flex justify-between gap-3">
              <span className="font-bold text-sm text-white">{row.label}</span>
              <span className="text-emerald-400 font-black text-sm shrink-0">
                {row.usedQty} o‘rnatildi
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
              <span>Reja: {row.plannedQty}</span>
              {row.returnedQty > 0 && <span>Qaytarildi: {row.returnedQty}</span>}
              {row.lostQty > 0 && <span>Yo‘qotildi: {row.lostQty}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
