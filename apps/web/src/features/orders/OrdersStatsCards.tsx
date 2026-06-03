'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { OrderStatCard } from './orders-utils';

type Props = {
  stats: OrderStatCard[];
};

// Compile-safe static dictionary mapping for theme glows
const statColorStyles: Record<OrderStatCard['color'], { bgIcon: string; textIcon: string; glow: string }> = {
  blue: {
    bgIcon: 'bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5',
    textIcon: 'text-blue-400',
    glow: 'shadow-blue-500/5 hover:border-blue-500/20'
  },
  amber: {
    bgIcon: 'bg-amber-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/5',
    textIcon: 'text-amber-400',
    glow: 'shadow-amber-500/5 hover:border-amber-500/20'
  },
  emerald: {
    bgIcon: 'bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5',
    textIcon: 'text-emerald-400',
    glow: 'shadow-emerald-500/5 hover:border-emerald-500/20'
  },
  red: {
    bgIcon: 'bg-red-500/10 border border-red-500/20 shadow-lg shadow-red-500/5',
    textIcon: 'text-red-400',
    glow: 'shadow-red-500/5 hover:border-red-500/20'
  }
};

export function OrdersStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {stats.map((stat, idx) => {
        const colors = statColorStyles[stat.color] || statColorStyles.blue;
        return (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, type: 'spring', stiffness: 100 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className={`glass-card p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] relative overflow-hidden group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 ${colors.glow}`}
          >
            <div className="relative flex flex-col gap-3 md:gap-4">
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-300 ${colors.bgIcon} ${colors.textIcon}`}>
                <stat.icon size={20} className="md:size-[28px] shrink-0" />
              </div>
              <div>
                <p className="text-gray-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest">
                  {stat.title}
                </p>
                <h3 className="text-xl md:text-3xl font-black text-white mt-1 tabular-nums">{stat.value}</h3>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
