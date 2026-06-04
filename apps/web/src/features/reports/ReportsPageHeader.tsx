'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileDown, RefreshCw, Loader2 } from 'lucide-react';

type Props = {
  exporting: boolean;
  isFetching: boolean;
  onExport: () => void;
  onRefresh: () => void;
};

export function ReportsPageHeader({ exporting, isFetching, onExport, onRefresh }: Props) {
  return (
    <>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white transition-colors"
      >
        <ArrowLeft size={18} /> Asosiy
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Hisobotlar</h1>
          <p className="text-gray-400 mt-2 max-w-xl">
            Tanlangan davr va ombor bo‘yicha kirim, sotuv, foyda va ombor qiymati ko‘rsatkichlari.
            Valyutalar (UZS va USD) alohida hisoblanadi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/reports/monthly"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-black transition-all"
          >
            Oy moliyasi
          </Link>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting || isFetching}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
            Excel eksport
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Yangilash
          </button>
        </div>
      </div>
    </>
  );
}
