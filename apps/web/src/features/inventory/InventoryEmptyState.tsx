'use client';

import React from 'react';
import { Package } from 'lucide-react';

type Props = {
  selectedWarehouseId: string;
  variant?: 'table' | 'mobile';
};

export function InventoryEmptyState({ selectedWarehouseId, variant = 'table' }: Props) {
  if (variant === 'mobile') {
    return (
      <div className="py-16 px-4 text-center flex flex-col items-center gap-3 opacity-60">
        <Package size={40} className="text-gray-600" />
        {!selectedWarehouseId ? (
          <>
            <p className="text-gray-300 font-black">Avval omborni tanlang</p>
            <p className="text-gray-500 text-xs">
              Yuqoridagi &quot;Omborni tanlang&quot; tugmasi orqali ombor belgilang.
            </p>
          </>
        ) : (
          <p className="text-gray-500 font-bold">Bu omborda hali mahsulotlar yo&apos;q</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 opacity-60">
      <Package size={48} className="text-gray-600" />
      {!selectedWarehouseId ? (
        <>
          <p className="text-gray-300 font-black text-lg">Avval omborni tanlang</p>
          <p className="text-gray-500 text-sm max-w-md">
            Mahsulotlar ombor bo&apos;yicha ko&apos;rsatiladi. Yuqoridagi{' '}
            <span className="text-blue-400 font-bold">&quot;Omborni tanlang&quot;</span> tugmasi orqali
            tegishli omborni belgilang.
          </p>
        </>
      ) : (
        <p className="text-gray-500 font-bold text-lg">Bu omborda hali mahsulotlar yo&apos;q</p>
      )}
    </div>
  );
}
