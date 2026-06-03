'use client';

import React from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import {
  type FormItem,
  type Currency,
  formatAmount,
  buildOrderProductSnapshot,
  displayOrderProductSnapshot,
} from './order-form-utils';
// в”Ђв”Ђв”Ђ Mobile Item Card в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface MobileOrderItemCardProps {
  item: FormItem;
  index: number;
  handleItemChange: (i: number, field: keyof FormItem, value: string | number) => void;
  handleRemoveItem: (i: number) => void;
}

export function MobileOrderItemCard({
  item,
  index,
  handleItemChange,
  handleRemoveItem,
}: MobileOrderItemCardProps) {
  const lineTotal = (parseFloat(item.price) || 0) * (item.quantity || 0);

  return (
    <div className="p-3.5 bg-white/[0.04] border border-white/10 rounded-2xl space-y-3">
      {/* Name row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white truncate">
            {displayOrderProductSnapshot(
              buildOrderProductSnapshot(item.productName, item.variantLabel),
            )}
          </p>
          {lineTotal > 0 && (
            <p className="text-xs text-blue-400 font-black mt-0.5">
              {formatAmount(lineTotal, item.currency)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleRemoveItem(index)}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 flex items-center justify-center transition-all shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Qty stepper */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button
            type="button"
            onClick={() => handleItemChange(index, 'quantity', Math.max(1, item.quantity - 1))}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all"
          >
            <Minus size={14} />
          </button>
          <span className="w-8 text-center text-sm font-black text-white">{item.quantity}</span>
          <button
            type="button"
            onClick={() => handleItemChange(index, 'quantity', item.quantity + 1)}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Price input */}
        <input
          type="number"
          min={0}
          value={item.price}
          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
          placeholder="Narx"
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm font-bold text-white outline-none focus:border-blue-500/40 transition-all placeholder:text-gray-600 min-h-[44px]"
        />

        {/* Currency pill toggle */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 shrink-0">
          {(['UZS', 'USD'] as Currency[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleItemChange(index, 'currency', c)}
              className={`px-2.5 py-2.5 text-[10px] font-black transition-all min-h-[44px] ${
                item.currency === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
