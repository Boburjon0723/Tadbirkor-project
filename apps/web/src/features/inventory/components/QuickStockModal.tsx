'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  Package,
  Check,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { productsService, normalizeProductsList } from '@/services/products.service';
import { useInventoryActions } from '@/hooks/warehouse/use-warehouse';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { stockQtyForWarehouse, variantColorFromApi } from '@/features/product-modal/product-modal-utils';
import { formatStockQuantity, parseStockFieldValue } from '@/lib/product-units';
import { toast, formatApiError } from '@/lib/toast';

type VariantRow = {
  id: string;
  name: string;
  label: string;
  currentStock: number;
  unit: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  warehouseId: string;
  warehouseName?: string;
  /** Ro‘yxatdan ochilganda */
  initialProduct?: any | null;
  onSuccess?: () => void;
};

function buildVariantRows(product: any, warehouseId: string): VariantRow[] {
  const unit = product?.unit || 'dona';
  const variants = product?.variants || [];
  return variants
    .filter((v: any) => v?.id && v?.status !== 'ARCHIVED')
    .map((v: any) => {
      const color = variantColorFromApi(v);
      const name = String(v.name || 'Standart').trim();
      const label = color ? `${name} · ${color}` : name;
      return {
        id: v.id,
        name,
        label,
        currentStock: stockQtyForWarehouse(v, warehouseId),
        unit,
      };
    });
}

export function QuickStockModal({
  isOpen,
  onClose,
  warehouseId,
  warehouseName,
  initialProduct,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const { recordIn, recordOut } = useInventoryActions();

  const [mode, setMode] = useState<'IN' | 'OUT'>('IN');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 280);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  const variantRows = useMemo(
    () => (selectedProduct ? buildVariantRows(selectedProduct, warehouseId) : []),
    [selectedProduct, warehouseId],
  );

  const selectedVariant = variantRows.find((v) => v.id === variantId);

  const reset = useCallback(() => {
    setMode('IN');
    setSearch('');
    setSearchResults([]);
    setSelectedProduct(null);
    setVariantId('');
    setQuantity('');
    setNote('');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }
    if (initialProduct?.id) {
      setSelectedProduct(initialProduct);
      const rows = buildVariantRows(initialProduct, warehouseId);
      setVariantId(rows[0]?.id || '');
      setSearch(String(initialProduct.name || ''));
    }
  }, [isOpen, initialProduct, warehouseId, reset]);

  useEffect(() => {
    if (!isOpen || !warehouseId) return;
    if (selectedProduct && !debouncedSearch.trim()) return;

    let cancelled = false;
    setSearching(true);
    void productsService
      .getProductsPage({
        warehouseId,
        search: debouncedSearch.trim() || undefined,
        limit: 25,
        view: 'catalog',
      })
      .then((data) => {
        if (cancelled) return;
        setSearchResults(normalizeProductsList(data));
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, warehouseId, debouncedSearch, selectedProduct]);

  const pickProduct = (product: any) => {
    setSelectedProduct(product);
    const rows = buildVariantRows(product, warehouseId);
    setVariantId(rows[0]?.id || '');
    setSearch(String(product.name || ''));
    setSearchResults([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const invalidateAfterStock = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      toast.error('Omborni tanlang.');
      return;
    }
    if (!variantId) {
      toast.error('Variantni tanlang.');
      return;
    }

    const unit = selectedProduct?.unit || 'dona';
    const qty = parseStockFieldValue(quantity, unit);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Miqdorni kiriting.');
      return;
    }

    const current = selectedVariant?.currentStock ?? 0;
    if (mode === 'OUT' && qty > current) {
      toast.error(`Omborda yetarli qoldiq yo'q. Mavjud: ${formatStockQuantity(current, unit)}`);
      return;
    }

    const dto = {
      warehouseId,
      productVariantId: variantId,
      quantity: qty,
      note: note.trim() || undefined,
    };

    try {
      if (mode === 'IN') {
        await recordIn.mutateAsync(dto);
        toast.success('Kirim qayd etildi.');
      } else {
        await recordOut.mutateAsync(dto);
        toast.success('Chiqim qayd etildi.');
      }
      await invalidateAfterStock();
      onSuccess?.();
      handleClose();
    } catch (err) {
      toast.error(formatApiError(err, 'Amal bajarilmadi.'));
    }
  };

  const pending = recordIn.isPending || recordOut.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                  Tezkor kirim / chiqim
                </p>
                <h2 className="text-xl font-black text-white">
                  {mode === 'IN' ? 'Omborga kirim' : 'Ombordan chiqim'}
                </h2>
                {warehouseName && (
                  <p className="text-xs text-gray-500 mt-1">Ombor: {warehouseName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-white/5 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setMode('IN')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${
                    mode === 'IN'
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TrendingUp size={14} />
                  Kirim
                </button>
                <button
                  type="button"
                  onClick={() => setMode('OUT')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${
                    mode === 'OUT'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TrendingDown size={14} />
                  Chiqim
                </button>
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (selectedProduct && e.target.value !== selectedProduct.name) {
                      setSelectedProduct(null);
                      setVariantId('');
                    }
                  }}
                  placeholder="Mahsulot nomi, SKU yoki barkod..."
                  className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/40 outline-none"
                  autoFocus
                />
                {searching && (
                  <Loader2
                    size={16}
                    className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-500"
                  />
                )}
              </div>

              {!selectedProduct && searchResults.length > 0 && (
                <ul className="max-h-44 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 divide-y divide-white/5">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => pickProduct(p)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                          <Package size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {(p.variants?.length || 0)} variant
                            {p.variants?.[0]?.sku ? ` · ${p.variants[0].sku}` : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {selectedProduct && (
                <div className="space-y-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-white truncate">{selectedProduct.name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setVariantId('');
                        setSearch('');
                      }}
                      className="text-[10px] font-bold text-gray-500 hover:text-white shrink-0"
                    >
                      Boshqa
                    </button>
                  </div>

                  {variantRows.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {variantRows.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setVariantId(v.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            variantId === v.id
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  ) : variantRows.length === 1 ? (
                    <p className="text-xs text-gray-400">{variantRows[0].label}</p>
                  ) : (
                    <p className="text-xs text-red-400">Faol variant topilmadi.</p>
                  )}

                  {selectedVariant && (
                    <p className="text-xs text-gray-500">
                      Joriy qoldiq:{' '}
                      <span className="font-black text-white tabular-nums">
                        {formatStockQuantity(selectedVariant.currentStock, selectedVariant.unit)}
                      </span>
                    </p>
                  )}

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                      Miqdor ({selectedProduct.unit || 'dona'})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={mode === 'IN' ? 'Masalan: 50' : 'Chiqim miqdori'}
                      className="mt-1.5 w-full px-4 py-3.5 bg-black/30 border border-white/10 rounded-xl text-lg font-black text-white tabular-nums focus:border-emerald-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                      Izoh (ixtiyoriy)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Masalan: Yetkazib beruvchi №12"
                      className="mt-1.5 w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/20 outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={pending || !selectedProduct || !variantId}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98] ${
                  mode === 'IN'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {pending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                {mode === 'IN' ? 'Kirimni tasdiqlash' : 'Chiqimni tasdiqlash'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
