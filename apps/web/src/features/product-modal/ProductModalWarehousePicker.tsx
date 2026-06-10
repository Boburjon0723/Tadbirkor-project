'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, ChevronDown } from 'lucide-react';

type Props = {
  productId?: string;
  warehouses: any[] | undefined;
  targetWarehouseId: string;
  configWarehouseName?: string;
  resolvedWarehouseId: string;
  showStockColumn: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (warehouseId: string) => void;
  onClose: () => void;
};

export function ProductModalWarehousePicker({
  productId,
  warehouses,
  targetWarehouseId,
  configWarehouseName,
  resolvedWarehouseId,
  showStockColumn,
  isOpen,
  onToggle,
  onSelect,
  onClose,
}: Props) {
  if (!showStockColumn) return null;

  return (
    <div className="space-y-4">
      <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
        <Layers size={14} /> {productId ? 'Zaxira ombori' : "Boshlang'ich zaxira ombori"}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl py-3.5 md:py-4 px-4 md:px-6 focus:outline-none focus:border-blue-500/50 transition-all flex items-center justify-between text-sm min-w-0"
        >
          <span className={targetWarehouseId ? 'text-white' : 'text-gray-500'}>
            {targetWarehouseId
              ? warehouses?.find((w: any) => w.id === targetWarehouseId)?.name
              : 'Omborni tanlang'}
          </span>
          <ChevronDown
            size={18}
            className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-[110]" onClick={onClose} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[120] backdrop-blur-2xl"
              >
                <div className="max-h-60 overflow-y-auto p-1">
                  <button
                    type="button"
                    onClick={() => onSelect('')}
                    className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${!targetWarehouseId ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                  >
                    Omborni tanlang
                  </button>
                  {warehouses?.map((w: any) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onSelect(w.id)}
                      className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${targetWarehouseId === w.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      {configWarehouseName && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-300">
          Konfiguratsiya: {configWarehouseName}
        </div>
      )}
      {!resolvedWarehouseId && (
        <p className="text-xs text-amber-400">Zaxira kiritish uchun avval ombor tanlang.</p>
      )}
      {resolvedWarehouseId && !showStockColumn && (
        <p className="text-xs text-amber-400">
          «Ustun sozlamasi»da <strong>Umumiy zaxira</strong> yoqilgan bo‘lishi kerak (shu ombor uchun).
        </p>
      )}
    </div>
  );
}
