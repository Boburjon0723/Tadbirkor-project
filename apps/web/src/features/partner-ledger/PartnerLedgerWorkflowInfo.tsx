'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Info, Package, FileSpreadsheet, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  contactName?: string;
  defaultExpanded?: boolean;
  variant?: 'banner' | 'compact';
};

export function PartnerLedgerWorkflowInfo({
  contactName,
  defaultExpanded = true,
  variant = 'banner',
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const contactHint = contactName
    ? `«${contactName}» ni mahsulot yoki importda hamkor sifatida tanlang — yozuv shu kartochkaga tushadi.`
    : 'Avval chapdan hamkorni tanlang, keyin ombor/importda shu hamkorni belgilang.';

  if (variant === 'compact') {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100/90">
        <p className="font-bold flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
          Tovar kirimi bu yerda qilinmaydi
        </p>
        <p className="text-xs text-amber-200/70 mt-2 leading-relaxed">
          Kirim faqat <strong className="text-amber-100">ombordan</strong> qilinadi; daftar avtomatik
          yangilanadi.{' '}
          <Link href="/dashboard/inventory" className="underline text-amber-300 hover:text-white">
            Mahsulotlar
          </Link>{' '}
          → qoldiq tuzatish yoki Excel import, hamkor tanlash bilan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-black text-white">
          <Info size={16} className="text-blue-400 shrink-0" />
          Kirim va chiqim qanday qilinadi?
        </span>
        {expanded ? (
          <ChevronUp size={18} className="text-gray-500 shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-gray-500 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 flex items-center gap-1.5">
                <Package size={12} />
                Tovar kirimi (xomashyo)
              </p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Avval omborga mahsulot kiradi, keyin daftarda{' '}
                <span className="text-red-300 font-bold">biz qarzdor</span> bo‘lamiz (avtomatik yozuv).
              </p>
              <ol className="mt-3 space-y-2 text-xs text-gray-300 list-decimal list-inside font-bold">
                <li>
                  <Link href="/dashboard/inventory" className="text-blue-400 hover:underline">
                    Mahsulotlar
                  </Link>{' '}
                  → mahsulotni oching → variant qoldig‘ini oshiring (kirim)
                </li>
                <li>
                  Yoki{' '}
                  <Link href="/dashboard/inventory" className="text-blue-400 hover:underline">
                    Excel import
                  </Link>{' '}
                  <FileSpreadsheet size={12} className="inline -mt-0.5 text-gray-500" /> — importda
                  hamkorni tanlang
                </li>
                <li>«Hamkor (ixtiyoriy)» maydonida daftar hamkorini tanlang</li>
              </ol>
              <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{contactHint}</p>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/80 flex items-center gap-1.5">
                <TrendingDown size={12} />
                Tovar chiqimi (sotish)
              </p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                <span className="text-white font-bold">«Sotish»</span> — mahsulot katalogidan buyurtma
                (SKU, miqdor), sotuv narxi bo‘yicha hisob, ombordan chiqim va daftarga yozuv bir vaqtda.
                «Hamkor nima beradi» — qarz, naqd, bartar va hokazo.
              </p>
              <p className="text-[11px] text-gray-500 mt-3">
                Pul tushumi yoki to‘lov uchun «Tushum» / «To‘lov» tugmalaridan foydalaning.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
