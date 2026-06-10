'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Building2, Layers, FileText, ChevronRight } from 'lucide-react';
import { formatDualCurrency, partnerHasActiveDebt, type PartnerDebtGroup } from '../debts-utils';

interface DebtsTableProps {
  isLoading: boolean;
  partnerGroupsWithPending: any[];
  activeTab: 'receivable' | 'payable';
  openPartnerDetail: (group: any) => void;
  handleExportAkt: (
    partnerId: string,
    partnerName: string,
    format: 'pdf' | 'excel',
    group?: PartnerDebtGroup,
  ) => void;
}

export function DebtsTable({
  isLoading,
  partnerGroupsWithPending,
  activeTab,
  openPartnerDetail,
  handleExportAkt,
}: DebtsTableProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'CONFIRMED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PARTIAL':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  const debtStatusLabelUz = (status: string) => {
    if (status === 'PAID' || status === 'CONFIRMED') return 'Tasdiqlandi';
    if (status === 'PARTIAL') return 'Qisman';
    return 'Ochiq';
  };

  return (
    <div className="hidden md:block dash-section shadow-xl">
      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-6">
          <Loader2 className="animate-spin text-emerald-500" size={50} />
          <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
        </div>
      ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Hamkor</th>
                  <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Yozuvlar</th>
                  <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Jami / Qolgan</th>
                  <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Status</th>
                  <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {partnerGroupsWithPending.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-24 text-center text-gray-500 font-bold text-sm px-6">
                      Ochiq qarz yo‘q. Yopilgan hamkorlar akt sverkasi — pastdagi arxivda
                    </td>
                  </tr>
                ) : (
                  partnerGroupsWithPending.map((group) => (
                    <motion.tr
                      key={group.partnerCompanyId}
                      initial={false}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.08 }}
                      onClick={() => partnerHasActiveDebt(group) && openPartnerDetail(group)}
                      className={`hover:bg-white/[0.02] transition-colors group ${partnerHasActiveDebt(group) ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
                    >
                      <td className="px-4 xl:px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 border border-white/5 group-hover:scale-105 transition-transform shrink-0">
                            <Building2 size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs md:text-sm text-white truncate max-w-[150px] xl:max-w-[200px]">
                              {group.partner.name}
                            </p>
                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                              STIR: {group.partner.tin}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 xl:px-8 py-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-gray-300">
                          <Layers size={12} className="text-gray-500" />
                          {group.entryCount} ta yozuv
                        </span>
                      </td>
                      <td className="px-4 xl:px-8 py-5">
                        <p className="font-bold text-gray-400 text-xs md:text-sm">
                          {formatDualCurrency(group.totalAmount)}
                        </p>
                        <p className={`font-black text-sm md:text-base mt-0.5 ${activeTab === 'receivable' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatDualCurrency(group.totalRemaining)}
                        </p>
                      </td>
                      <td className="px-4 xl:px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(group.aggregateStatus)}`}>
                          {debtStatusLabelUz(group.aggregateStatus)}
                        </span>
                        {group.hasPendingPayment && (
                          <p className="text-[9px] text-amber-400 font-bold mt-1">To&apos;lov kutilmoqda</p>
                        )}
                      </td>
                      <td className="px-4 xl:px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {partnerHasActiveDebt(group) && (
                            <button
                              type="button"
                              onClick={() =>
                                handleExportAkt(
                                  group.partnerCompanyId,
                                  group.partner.name,
                                  'pdf',
                                  group,
                                )
                              }
                              className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 h-10 w-10 flex items-center justify-center transition-all"
                              title="Akt sverka PDF"
                            >
                              <FileText size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openPartnerDetail(group)}
                            disabled={!partnerHasActiveDebt(group)}
                            className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-gray-500 h-10 w-10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                            title={partnerHasActiveDebt(group) ? 'Batafsil' : 'Ochiq qarz yo‘q'}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      )}
    </div>
  );
}
