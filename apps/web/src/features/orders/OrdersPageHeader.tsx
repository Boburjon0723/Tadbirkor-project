'use client';

import React from 'react';
import { Plus } from 'lucide-react';

type Props = {
  onNewOrder: () => void;
};

export function OrdersPageHeader({ onNewOrder }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
      <div>
        <h1 className="dash-page-title mb-1.5">
          B2B <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Buyurtmalar</span>
        </h1>
        <p className="dash-page-subtitle">Hamkorlar bilan savdo oqimi va operatsiyalar monitoringi.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <button
          type="button"
          onClick={onNewOrder}
          className="btn-dash-primary group flex-1 md:flex-none"
        >
          <Plus size={16} className="group-hover:rotate-90 transition-transform shrink-0" />
          <span>Yangi buyurtma</span>
        </button>
      </div>
    </div>
  );
}
