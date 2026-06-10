'use client';

import React from 'react';
import { Building2, ChevronRight, Layers, Loader2 } from 'lucide-react';
import {
  formatOrdersGroupTotalLabel,
  getOrderStatusStyle,
  orderStatusLabelUz,
  type PartnerOrderGroup,
} from './orders-utils';
import { MOBILE_LIST_ITEM, MOBILE_LIST_SURFACE } from '@/lib/mobile-pwa';

type Props = {
  partnerGroups: PartnerOrderGroup[];
  isLoading: boolean;
  onOpenPartner: (group: PartnerOrderGroup) => void;
};

export function OrdersListMobile({ partnerGroups, isLoading, onOpenPartner }: Props) {
  if (isLoading) {
    return (
      <div className="md:hidden py-20 flex flex-col items-center justify-center gap-4 border-t border-white/5">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-gray-500 font-bold text-xs">Yuklanmoqda...</p>
      </div>
    );
  }

  if (partnerGroups.length === 0) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-16 text-center text-gray-500 font-bold text-sm`}>
        Buyurtmalar topilmadi
      </div>
    );
  }

  return (
    <div className={MOBILE_LIST_SURFACE}>
      {partnerGroups.map((group) => (
        <button
          key={group.partnerCompanyId}
          type="button"
          onClick={() => onOpenPartner(group)}
          className={`${MOBILE_LIST_ITEM} text-left`}
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-[15px] truncate">{group.partner.name}</p>
                {group.partner.tin && (
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                    STIR: {group.partner.tin}
                  </p>
                )}
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-600 shrink-0 mt-1" />
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Layers size={14} className="text-blue-400" />
              <span className="font-bold">{group.orders.length} buyurtma</span>
            </div>
            <div className="text-right">
              <p className="font-black text-emerald-400 text-sm">
                {formatOrdersGroupTotalLabel(group.orders)}
              </p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${getOrderStatusStyle(group.aggregateStatus)}`}
              >
                {orderStatusLabelUz(group.aggregateStatus)}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
