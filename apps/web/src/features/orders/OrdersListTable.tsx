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

export function OrdersListTable({ partnerGroups, isLoading, onOpenPartner }: Props) {
  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-6">
        <Loader2 className="animate-spin text-blue-500" size={50} />
        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="hidden md:block overflow-x-auto overflow-y-visible rounded-b-[2rem]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/[0.02] border-b border-white/5">
            <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
              Hamkor
            </th>
            <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
              Buyurtmalar
            </th>
            <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
              Jami summa
            </th>
            <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
              Status
            </th>
            <th className="px-4 xl:px-6 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right w-[1%] whitespace-nowrap">
              Amallar
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {partnerGroups.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-24 text-center text-gray-500 font-bold text-sm">
                Buyurtmalar mavjud emas
              </td>
            </tr>
          ) : (
            partnerGroups.map((group, idx) => (
              <motion.tr
                key={group.partnerCompanyId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                onClick={() => onOpenPartner(group)}
                className="hover:bg-white/[0.02] transition-colors group cursor-pointer relative"
              >
                <td className="px-4 xl:px-8 py-5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 shrink-0 border border-white/5 group-hover:scale-105 transition-transform">
                      <Building2 size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs md:text-sm text-white truncate max-w-[150px] xl:max-w-[220px]">
                        {group.partner.name}
                      </p>
                      {group.partner.tin && (
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                          STIR: {group.partner.tin}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 xl:px-8 py-5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-gray-300">
                    <Layers size={12} className="text-gray-500" />
                    {group.orderCount} ta buyurtma
                  </span>
                </td>
                <td className="px-4 xl:px-8 py-5 font-black text-xs md:text-sm text-blue-400">
                  {formatOrdersGroupTotalLabel(group.orders)}
                </td>
                <td className="px-4 xl:px-8 py-5">
                  <span
                    className={`px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border ${getOrderStatusStyle(group.aggregateStatus)}`}
                  >
                    {orderStatusLabelUz(group.aggregateStatus)}
                  </span>
                  {group.orderCount > 1 && (
                    <p className="text-[9px] text-gray-500 font-bold mt-1">
                      Eng faol status
                    </p>
                  )}
                </td>
                <td
                  className="px-4 xl:px-6 py-5 text-right align-middle w-[1%] whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onOpenPartner(group)}
                    className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-gray-500 h-10 w-10 inline-flex items-center justify-center"
                    title="Batafsil"
                  >
                    <ChevronRight size={16} />
                  </button>
                </td>
              </motion.tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
