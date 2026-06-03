'use client';

import React from 'react';
import { Plus } from 'lucide-react';

type Props = {
  onNewOrder: () => void;
};

export function OrdersPageHeader({ onNewOrder }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          B2B <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Buyurtmalar</span>
        </h1>
        <p className="text-gray-400 text-sm md:text-base">Hamkorlar bilan savdo oqimi va operatsiyalar monitoringi.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
        <button
          type="button"
          onClick={onNewOrder}
          className="group flex-1 md:flex-none flex items-center justify-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-[0_12px_24px_rgba(37,99,235,0.25)] active:scale-95 text-xs lg:text-sm h-12"
        >
          <Plus size={16} className="group-hover:rotate-90 transition-transform shrink-0" />
          <span>Yangi buyurtma</span>
        </button>
      </div>
    </div>
  );
}
