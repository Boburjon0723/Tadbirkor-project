'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

type Props = {
  activeTab: 'my' | 'incoming';
  incomingCount: number;
  searchTerm: string;
  onTabChange: (tab: 'my' | 'incoming') => void;
  onSearchChange: (value: string) => void;
};

export function OrdersTabsSearch({
  activeTab,
  incomingCount,
  searchTerm,
  onTabChange,
  onSearchChange,
}: Props) {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
      {/* Elastic Horizontally scrollable sliding tabs */}
      <div className="p-1.5 bg-white/5 border border-white/10 rounded-2xl w-full lg:w-fit overflow-x-auto scrollbar-none flex flex-row flex-nowrap gap-1">
        {[
          { id: 'my', label: 'Chiquvchi buyurtmalar' },
          { id: 'incoming', label: `Kiruvchi (${incomingCount})` }
        ].map((tab) => (
          <button 
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id as 'my' | 'incoming')}
            className="relative px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all duration-300 z-10 whitespace-nowrap flex-shrink-0 flex-1 lg:flex-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeOrderTab"
                className="absolute inset-0 bg-white rounded-lg shadow-md z-[-1]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`transition-colors duration-300 ${activeTab === tab.id ? 'text-black' : 'text-gray-400 hover:text-white'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Spacious Search bar */}
      <div className="relative flex-1 w-full lg:max-w-md group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors w-4.5 h-4.5" />
        <input
          type="text"
          placeholder="Hamkor yoki buyurtma № bo'yicha..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs md:text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white font-bold h-12"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}
