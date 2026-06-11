'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Package, PackagePlus, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StockHistoryItem } from '@/features/warehouse/warehouse-history-types';
import { isIntakeHistoryItem } from '@/features/warehouse/warehouse-history-types';
import { formatStockQuantity } from '@/lib/product-units';

type Props = {
  items?: StockHistoryItem[];
  isLoading?: boolean;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function IntakeHistoryCard({ item }: { item: StockHistoryItem & { kind: 'intake' } }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-emerald-500/20 rounded-2xl overflow-hidden bg-emerald-500/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-5 flex items-start gap-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
          <PackagePlus size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-black text-emerald-300">
              {item.reference}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-400">
              Ombor kirimi
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>{formatDate(item.createdAt)}</span>
            {item.warehouse?.name && <span>{item.warehouse.name}</span>}
            <span className="text-emerald-400 font-bold">
              {item.lineCount} poz
            </span>
          </div>
          {item.createdBy && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-300">
              <User size={14} className="text-blue-400" />
              <span className="font-semibold">{item.createdBy.fullName}</span>
            </div>
          )}
          {item.note && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.note}</p>
          )}
        </div>
        <div className="p-2 text-gray-500 shrink-0">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 border-t border-emerald-500/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-3">
                Kiritilgan mahsulotlar
              </p>
              <div className="space-y-2">
                {item.lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{line.productName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {line.variantName}
                        {(line.barcode || line.sku) && (
                          <span className="font-mono text-gray-600">
                            {' '}
                            · {line.barcode || line.sku}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-emerald-400">
                        +{formatStockQuantity(line.quantity, line.unit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SingleHistoryRow({ item }: { item: StockHistoryItem & { kind: 'single' } }) {
  const isIn = item.type === 'IN';

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-5 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isIn ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          <Package size={18} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{item.productVariant.product.name}</p>
          <p className="text-xs text-gray-500 truncate">{item.productVariant.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:gap-6 text-sm">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatDate(item.createdAt)}
        </span>
        <span
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
            isIn ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
          }`}
        >
          {item.sourceLabel}
        </span>
        <span className={`font-black ${isIn ? 'text-emerald-400' : 'text-red-400'}`}>
          {isIn ? '+' : '-'}
          {formatStockQuantity(item.quantity, item.unit ?? item.productVariant.product.unit)}
        </span>
        {item.createdBy && (
          <span className="flex items-center gap-1.5 text-gray-400 text-xs">
            <User size={12} />
            {item.createdBy.fullName}
          </span>
        )}
        {item.note && (
          <span className="text-xs text-gray-500 max-w-[200px] truncate">{item.note}</span>
        )}
      </div>
    </div>
  );
}

export function WarehouseHistoryList({ items, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="py-20 flex justify-center text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Yuklanmoqda...
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="py-20 text-center text-gray-500 font-bold">
        Harakatlar tarixi bo&apos;sh
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {items.map((item) =>
        isIntakeHistoryItem(item) ? (
          <IntakeHistoryCard key={item.id} item={item} />
        ) : (
          <div
            key={item.id}
            className="rounded-2xl border border-white/5 overflow-hidden bg-white/[0.01]"
          >
            <SingleHistoryRow item={item} />
          </div>
        ),
      )}
    </div>
  );
}
