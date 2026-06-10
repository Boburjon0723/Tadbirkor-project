'use client';

import React from 'react';
import { Building2, ChevronRight, Loader2 } from 'lucide-react';
import {
  formatDualCurrency,
  partnerHasActiveDebt,
  type PartnerDebtGroup,
} from '../debts-utils';
import { MOBILE_LIST_ITEM, MOBILE_LIST_SURFACE } from '@/lib/mobile-pwa';

type Props = {
  isLoading: boolean;
  partnerGroupsWithPending: PartnerDebtGroup[];
  activeTab: 'receivable' | 'payable';
  openPartnerDetail: (group: PartnerDebtGroup) => void;
};

function getStatusStyle(status: string) {
  switch (status) {
    case 'PAID':
    case 'CONFIRMED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'PARTIAL':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default:
      return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
}

function debtStatusLabelUz(status: string) {
  if (status === 'PAID' || status === 'CONFIRMED') return 'Tasdiqlandi';
  if (status === 'PARTIAL') return 'Qisman';
  return 'Ochiq';
}

export function DebtsListMobile({
  isLoading,
  partnerGroupsWithPending,
  activeTab,
  openPartnerDetail,
}: Props) {
  if (isLoading) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-20 flex flex-col items-center justify-center gap-4`}>
        <Loader2 className="animate-spin text-emerald-500" size={32} />
        <p className="text-gray-500 font-bold text-xs">Yuklanmoqda...</p>
      </div>
    );
  }

  if (partnerGroupsWithPending.length === 0) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-20 text-center text-gray-500 font-bold text-sm px-6`}>
        Ochiq qarz yo‘q. Yopilgan hamkorlar akt sverkasi — pastdagi arxivda
      </div>
    );
  }

  return (
    <div className={MOBILE_LIST_SURFACE}>
      {partnerGroupsWithPending.map((group) => {
        const canOpen = partnerHasActiveDebt(group);
        return (
          <button
            key={group.partnerCompanyId}
            type="button"
            disabled={!canOpen}
            onClick={() => canOpen && openPartnerDetail(group)}
            className={`${MOBILE_LIST_ITEM} text-left ${!canOpen ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 border border-white/5 shrink-0">
                  <Building2 size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-[15px] truncate">{group.partner.name}</p>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                    STIR: {group.partner.tin}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-600 shrink-0 mt-1" />
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Qolgan qarz
                </p>
                <p
                  className={`font-black text-sm mt-0.5 ${activeTab === 'receivable' ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatDualCurrency(group.totalRemaining)}
                </p>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                  Jami: {formatDualCurrency(group.totalAmount)} · {group.entryCount} yozuv
                </p>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${getStatusStyle(group.aggregateStatus)}`}
                >
                  {debtStatusLabelUz(group.aggregateStatus)}
                </span>
                {group.hasPendingPayment && (
                  <p className="text-[9px] text-amber-400 font-bold mt-1.5">To&apos;lov kutilmoqda</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
