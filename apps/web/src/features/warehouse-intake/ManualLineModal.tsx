'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { productsService } from '@/services/products.service';
import { useQuery } from '@tanstack/react-query';

type Props = {
  open: boolean;
  warehouseId?: string;
  onClose: () => void;
  onSelect: (variantId: string, quantity: number) => Promise<void>;
  loading?: boolean;
};

export function ManualLineModal({
  open,
  warehouseId,
  onClose,
  onSelect,
  loading,
}: Props) {
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['intake-manual-products', debounced, warehouseId],
    queryFn: () =>
      productsService.getProductsPage({
        search: debounced || undefined,
        warehouseId,
        limit: 30,
        view: 'catalog',
      }),
    enabled: open,
  });

  const variants = useMemo(() => {
    const products = data?.items ?? data ?? [];
    const rows: Array<{
      variantId: string;
      label: string;
      sku?: string;
      barcode?: string;
    }> = [];
    for (const p of products as any[]) {
      for (const v of p.variants || []) {
        rows.push({
          variantId: v.id,
          label: `${p.name}${v.name !== p.name ? ` / ${v.name}` : ''}`,
          sku: v.sku,
          barcode: v.barcode,
        });
      }
    }
    return rows.slice(0, 40);
  }, [data]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative w-full max-w-xl glass-card rounded-3xl p-6 space-y-4 max-h-[80vh] flex flex-col"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">Qo&apos;lda qator qo&apos;shish</h2>
              <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Mahsulot qidirish..."
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-blue-500/50"
                />
              </div>
              <input
                type="number"
                min={0.0001}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm font-black text-center"
                title="Miqdor"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-[200px]">
              {isLoading && (
                <div className="py-12 flex justify-center">
                  <Loader2 className="animate-spin text-blue-500" />
                </div>
              )}
              {!isLoading && !variants.length && (
                <p className="text-center text-gray-500 text-sm py-8">Mahsulot topilmadi</p>
              )}
              {variants.map((v) => (
                <button
                  key={v.variantId}
                  type="button"
                  disabled={loading}
                  onClick={() => onSelect(v.variantId, quantity)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
                >
                  <div className="font-bold text-sm">{v.label}</div>
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                    {[v.sku, v.barcode].filter(Boolean).join(' · ') || '—'}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
