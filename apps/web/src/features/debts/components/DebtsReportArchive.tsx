'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  ChevronDown,
  FileText,
  Loader2,
  Search,
  Building2,
} from 'lucide-react';
import { usePartnerReportArchive } from '@/hooks/debts/use-debts';
import type { DebtType, PartnerReportArchiveItem } from '../debts-utils';

type Props = {
  activeTab: DebtType;
  onExportPdf: (partnerId: string, partnerName: string) => void;
  onExportExcel: (partnerId: string, partnerName: string) => void;
};

export function DebtsReportArchive({ activeTab, onExportPdf, onExportExcel }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = usePartnerReportArchive(
    { tab: activeTab, search, page: 1, limit: 50, settledOnly: true },
    open,
  );

  const items: PartnerReportArchiveItem[] = data?.items ?? [];
  const years = data?.archiveYears ?? 3;

  return (
    <div className="dash-section overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 p-5 md:p-6 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Archive size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm md:text-base text-white">Akt sverka arxivi</p>
            <p className="text-[10px] md:text-xs text-gray-500 font-semibold mt-0.5 leading-snug">
              Yopilgan hamkorlar. Barcha yozuvlar bazada saqlanadi — hisobotni istalgan vaqtda yuklang.
            </p>
          </div>
        </div>
        <ChevronDown
          size={20}
          className={`text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-5 md:p-6 pt-0 space-y-4">
              <p className="text-[10px] text-gray-500 font-bold">
                So‘nggi {years} yil ichidagi yopilgan hamkorlar ({activeTab === 'receivable' ? 'bizga qarzdor' : 'biz qarzdor'}).
              </p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Hamkor nomi yoki STIR..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-white focus:outline-none focus:border-amber-500/40"
                />
              </div>

              {isLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="animate-spin text-amber-400" size={28} />
                </div>
              ) : items.length === 0 ? (
                <p className="py-10 text-center text-gray-500 text-sm font-bold">
                  Yopilgan hamkorlar topilmadi
                </p>
              ) : (
                <ul className="divide-y divide-white/5 rounded-xl border border-white/5 overflow-hidden">
                  {items.map((row: PartnerReportArchiveItem) => (
                    <li
                      key={row.partnerCompanyId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 shrink-0">
                          <Building2 size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{row.partner.name}</p>
                          <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                            STIR: {row.partner.tin} · {row.entryCount} yozuv ·{' '}
                            {new Date(row.lastActivityAt).toLocaleDateString('uz-UZ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onExportPdf(row.partnerCompanyId, row.partner.name)}
                          className="px-3 py-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600/20 transition-all flex items-center gap-1.5"
                        >
                          <FileText size={14} />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportExcel(row.partnerCompanyId, row.partner.name)}
                          className="px-3 py-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider hover:bg-blue-600/20 transition-all flex items-center gap-1.5"
                        >
                          <FileText size={14} />
                          Excel
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
