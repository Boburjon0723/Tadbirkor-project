'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, ChevronRight, Layers, Loader2 } from 'lucide-react';
import {
  formatOrdersGroupTotalLabel,
  getOrderStatusStyle,
  orderStatusLabelUz,
  type PartnerOrderGroup,
} from './orders-utils';

type Props = {
  partnerGroups: PartnerOrderGroup[];
  isLoading: boolean;
  onOpenPartner: (group: PartnerOrderGroup) => void;
};

export function OrdersListMobile({ partnerGroups, isLoading, onOpenPartner }: Props) {
  if (isLoading) {
    return (
      <div className="md:hidden py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-gray-500 font-bold text-xs">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="md:hidden p-4 space-y-4">
      {partnerGroups.length === 0 ? (
        <div className="py-20 text-center text-gray-500 font-bold">Buyurtmalar topilmadi</div>
      ) : (
        partnerGroups.map((group, idx) => (
          <motion.div
            key={group.partnerCompanyId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onOpenPartner(group)}
            className="p-5 bg-white/5 border border-white/5 rounded-3xl space-y-4 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-white text-base truncate">{group.partner.name}</p>
                  {group.partner.tin && (
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                      STIR: {group.partner.tin}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 shrink-0 mt-1" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-gray-300">
                <Layers size={12} className="text-gray-500" />
                {group.orderCount} ta
              </span>
              <span
                className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${getOrderStatusStyle(group.aggregateStatus)}`}
              >
                {orderStatusLabelUz(group.aggregateStatus)}
              </span>
            </div>

            <div className="pt-3 border-t border-white/5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Jami summa</p>
              <p className="font-black text-blue-400 text-lg mt-0.5">
                {formatOrdersGroupTotalLabel(group.orders)}
              </p>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}
