'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { formatKpiTotals } from '../debts-utils';

interface DebtsKpiCardsProps {
  receivable: { uzs: number; usd: number };
  payable: { uzs: number; usd: number };
  net: { uzs: number; usd: number };
}

export function DebtsKpiCards({ receivable, payable, net }: DebtsKpiCardsProps) {
  const kpiStyles = {
    receivable: {
      bgIcon: 'bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5',
      textIcon: 'text-emerald-400',
      glow: 'shadow-emerald-500/5 hover:border-emerald-500/20 bg-emerald-500/[0.01]'
    },
    payable: {
      bgIcon: 'bg-red-500/10 border border-red-500/20 shadow-lg shadow-red-500/5',
      textIcon: 'text-red-400',
      glow: 'shadow-red-500/5 hover:border-red-500/20 bg-red-500/[0.01]'
    },
    net: {
      bgIcon: 'bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5',
      textIcon: 'text-blue-400',
      glow: 'shadow-blue-500/5 hover:border-blue-500/20 bg-blue-500/[0.01]'
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Receivable */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.01 }}
        className={`glass-card p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 ${kpiStyles.receivable.glow}`}
      >
        <div className="flex flex-col gap-4">
          <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${kpiStyles.receivable.bgIcon} ${kpiStyles.receivable.textIcon}`}>
            <ArrowDownLeft size={24} className="md:size-[28px] shrink-0" />
          </div>
          <div>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Jami Debitorlik</p>
            <h3 className="text-2xl md:text-3xl font-black mt-1 text-emerald-400 leading-tight break-words tabular-nums">
              {formatKpiTotals(receivable.uzs, receivable.usd)}
            </h3>
          </div>
        </div>
      </motion.div>

      {/* Payable */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        whileHover={{ y: -4, scale: 1.01 }}
        className={`glass-card p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 ${kpiStyles.payable.glow}`}
      >
        <div className="flex flex-col gap-4">
          <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${kpiStyles.payable.bgIcon} ${kpiStyles.payable.textIcon}`}>
            <ArrowUpRight size={24} className="md:size-[28px] shrink-0" />
          </div>
          <div>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Jami Kreditorlik</p>
            <h3 className="text-2xl md:text-3xl font-black mt-1 text-red-400 leading-tight break-words tabular-nums">
              {formatKpiTotals(payable.uzs, payable.usd)}
            </h3>
          </div>
        </div>
      </motion.div>

      {/* Net */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        whileHover={{ y: -4, scale: 1.01 }}
        className={`glass-card p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 ${kpiStyles.net.glow}`}
      >
        <div className="flex flex-col gap-4">
          <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${kpiStyles.net.bgIcon} ${kpiStyles.net.textIcon}`}>
            <Wallet size={24} className="md:size-[28px] shrink-0" />
          </div>
          <div>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Sof Balans</p>
            <h3 className="text-2xl md:text-3xl font-black mt-1 text-blue-400 leading-tight break-words tabular-nums">
              {formatKpiTotals(net.uzs, net.usd)}
            </h3>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
