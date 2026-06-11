'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileDown, RefreshCw, Loader2, BookOpen } from 'lucide-react';
import { ReportsGuideModal } from '@/features/reports/ReportsGuideModal';

type Props = {
  exporting: boolean;
  isFetching: boolean;
  onExport: () => void;
  onRefresh: () => void;
};

export function ReportsPageHeader({ exporting, isFetching, onExport, onRefresh }: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white transition-colors"
      >
        <ArrowLeft size={18} /> Asosiy
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="dash-page-title">Savdo hisoboti</h1>
          <p className="dash-page-subtitle mt-1.5">
            Tanlangan davr va ombor bo‘yicha sotuv, kirim va ombor qiymati.
            Valyutalar (UZS va USD) alohida hisoblanadi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="btn-dash bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
          >
            <BookOpen size={16} />
            Qo‘llanma
          </button>
          <Link
            href="/dashboard/reports/monthly"
            className="btn-dash bg-violet-600 hover:bg-violet-500 text-white"
          >
            Oy moliyasi
          </Link>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting || isFetching}
            className="btn-dash bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {exporting ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
            Excel eksport
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="btn-dash-primary disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Yangilash
          </button>
        </div>
      </div>

      <ReportsGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
