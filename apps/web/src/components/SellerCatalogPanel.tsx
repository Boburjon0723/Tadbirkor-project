'use client';

import React, { useState, useDeferredValue, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Loader2, Package, LayoutGrid, List, ChevronDown, Plus, Minus, ArrowRight } from 'lucide-react';
import { ordersService } from '@/services/orders.service';
import { formatVariantLabel } from '@/lib/order-product-label';

function formatAmount(value: number, currency: 'UZS' | 'USD') {
  const amount = Number(value || 0);
  if (currency === 'USD') {
    return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} USD`;
  }
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} UZS`;
}

const resolveImageUrl = (raw?: string | null) => {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const apiBase = String(process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  const origin = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
  if (!origin) return v;
  return v.startsWith('/') ? `${origin}${v}` : `${origin}/${v}`;
};

export type SellerCatalogApplyPayload = {
  sellerProductVariantId: string;
  productName: string;
  variantLabel: string;
  variantSku?: string | null;
  salePrice: number;
  expectedCurrency: 'UZS' | 'USD';
  quantity: number;
};

export interface SellerCatalogPanelProps {
  sellerCompanyId: string;
  sellerName?: string;
  lineCount: number;
  onApplyMultiple?: (items: SellerCatalogApplyPayload[]) => void;
  onFinalize?: () => void;
  onClose: () => void;
}

export function SellerCatalogPanel({
  sellerCompanyId,
  sellerName,
  lineCount,
  onApplyMultiple,
  onFinalize,
  onClose,
}: SellerCatalogPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [previewProduct, setPreviewProduct] = useState<{
    productId: string;
    productName: string;
    imageUrl: string;
    variants: any[];
  } | null>(null);

  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!previewProduct) {
      setQuantities({});
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewProduct(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewProduct]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['b2b-seller-catalog', sellerCompanyId, deferredSearch],
    queryFn: () => ordersService.getSellerCatalog(sellerCompanyId, deferredSearch),
    enabled: !!sellerCompanyId,
    staleTime: 60_000,
  });

  const groupedProducts = useMemo(() => {
    if (!data?.items) return [];
    const groups: Record<string, any> = {};
    data.items.forEach((item: any) => {
      if (!groups[item.productId]) {
        groups[item.productId] = {
          productId: item.productId,
          productName: item.productName,
          imageUrl: item.imageUrl,
          variants: [],
        };
      }
      // Agar mahsulot kartochkasi rasmsiz, lekin variantda rasm bor bo'lsa — shuni olamiz
      if (!groups[item.productId].imageUrl && item.imageUrl) {
        groups[item.productId].imageUrl = item.imageUrl;
      }
      groups[item.productId].variants.push(item);
    });
    return Object.values(groups);
  }, [data?.items]);

  const handleApply = () => {
    if (!previewProduct || !onApplyMultiple) return;
    
    const itemsToAdd: SellerCatalogApplyPayload[] = [];
    previewProduct.variants.forEach((v) => {
      const qty = quantities[v.variantId] || 0;
      if (qty > 0) {
        itemsToAdd.push({
          sellerProductVariantId: v.variantId,
          productName: previewProduct.productName,
          variantLabel: formatVariantLabel(v.variantName, v.color),
          variantSku: v.sku?.trim() || null,
          salePrice: Number(v.salePrice || 0),
          expectedCurrency: ((v.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS') as 'UZS' | 'USD',
          quantity: qty,
        });
      }
    });

    if (itemsToAdd.length > 0) {
      onApplyMultiple(itemsToAdd);
      setPreviewProduct(null);
    }
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="flex w-full min-w-0 flex-col border border-white/10 bg-[#050505]/90 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] md:w-[320px] md:shrink-0 md:max-w-[320px] rounded-[2.5rem] overflow-hidden min-h-0 h-full md:max-h-[92vh] md:h-full"
    >
      <div className="shrink-0 border-b border-white/5 p-5 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Hamkor Katalogi</p>
            <p className="text-base font-black text-white truncate" title={sellerName}>
              {sellerName || 'Hamkor'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <List size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-emerald-500/50 hover:bg-white/10 transition-all placeholder:text-gray-600"
            />
          </div>
          {data?.total != null && (
            <p className="text-[10px] text-gray-500 font-bold px-1">
              {data.total} ta variant
              {data.warehouseFilterActive
                ? ' · zaxira faqat ochiq omborlar bo‘yicha'
                : ''}
            </p>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="w-full py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
          >
            Katalogni yangilash
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-2">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <p className="text-xs font-bold uppercase tracking-widest">Yuklanmoqda...</p>
          </div>
        )}
        {isError && (
          <div className="px-5 py-20 text-center">
            <X className="text-amber-500 mx-auto mb-4" size={32} />
            <p className="text-amber-400 text-xs font-bold leading-relaxed">Katalog yuklanmadi.</p>
          </div>
        )}
        {!isLoading && !isError && groupedProducts.length === 0 && (
          <div className="py-20 text-center text-gray-600">
            <Package className="mx-auto mb-3 opacity-20" size={40} />
            <p className="text-xs font-bold uppercase tracking-widest">Mahsulot topilmadi</p>
          </div>
        )}

        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-2" : "space-y-2"}>
          {!isLoading && !isError && groupedProducts.map((product: any) => (
            <button
              key={product.productId}
              type="button"
              onClick={() => setPreviewProduct(product)}
              className={`group relative flex border transition-all duration-300 text-left overflow-hidden ${
                viewMode === 'grid' 
                  ? "flex-col p-2 bg-white/[0.03] hover:bg-white/[0.06] border-transparent hover:border-white/10 rounded-2xl" 
                  : "flex-row items-center gap-4 p-3 bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/10 rounded-2xl"
              }`}
            >
              <div className={`relative shrink-0 overflow-hidden rounded-xl bg-white/5 ${viewMode === 'grid' ? "aspect-square w-full mb-2" : "h-14 w-14"}`}>
                {product.imageUrl ? (
                  <img 
                    src={resolveImageUrl(product.imageUrl)} 
                    alt="" 
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                    <Package size={viewMode === 'grid' ? 32 : 24} />
                    <span className="absolute text-[40px] font-black opacity-[0.03]">B</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col">
                  <p className={`font-black text-white leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors ${viewMode === 'grid' ? "text-[11px]" : "text-[13px]"}`}>
                    {product.productName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      {product.variants.length} variantlar
                    </span>
                    {viewMode === 'list' && (
                       <span className="text-[10px] font-black text-emerald-500/50 group-hover:text-emerald-500 transition-colors">
                         Tanlash →
                       </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {mounted && previewProduct && createPortal(
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 sm:p-8"
          onClick={() => setPreviewProduct(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewProduct(null)}
            className="absolute top-6 right-6 z-10 p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={24} />
          </button>

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="relative w-full max-w-2xl bg-[#0d0d0d] border border-white/10 rounded-t-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] absolute bottom-0 sm:relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Image Section */}
              <div className="w-full bg-white/5 relative overflow-hidden flex items-center justify-center">
                {previewProduct.imageUrl ? (
                  <img
                    src={resolveImageUrl(previewProduct.imageUrl)}
                    alt={previewProduct.productName}
                    className="w-full h-auto object-contain max-h-[500px]"
                  />
                ) : (
                  <div className="w-full h-[300px] flex items-center justify-center text-gray-700 bg-white/5">
                    <Package size={64} className="opacity-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-transparent flex flex-col justify-end p-6 md:p-8">
                  <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-emerald-400 mb-2">Mahsulot</p>
                  <h3 className="text-xl md:text-2xl font-black text-white leading-tight">{previewProduct.productName}</h3>
                </div>
              </div>

              {/* Variants Section */}
              <div className="p-6 md:p-8">
                <table className="w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-left">
                      <th className="px-2 pb-2">Variant</th>
                      <th className="px-2 pb-2">Narx</th>
                      <th className="px-2 pb-2 text-right">Miqdor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewProduct.variants.map((v: any) => (
                      <tr key={v.variantId} className="group/row">
                        <td className="bg-white/5 rounded-l-xl px-4 py-3">
                          <p className="text-xs font-bold text-white leading-tight">
                            {v.variantName}
                          </p>
                          {v.color && <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{v.color}</p>}
                        </td>
                        <td className="bg-white/5 px-4 py-3 text-xs font-black text-emerald-400">
                          {formatAmount(v.salePrice, v.currency)}
                        </td>
                        <td className="bg-white/5 rounded-r-xl px-4 py-3">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              type="button"
                              onClick={() => setQuantities(prev => {
                                const current = prev[v.variantId] || 0;
                                if (current <= 0) return prev;
                                return { ...prev, [v.variantId]: current - 1 };
                              })}
                              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center font-black transition-all shrink-0"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center text-xs font-black text-white shrink-0 select-none">
                              {quantities[v.variantId] || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuantities(prev => {
                                const current = prev[v.variantId] || 0;
                                return { ...prev, [v.variantId]: current + 1 };
                              })}
                              className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white flex items-center justify-center font-black transition-all shrink-0"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 p-6 md:p-8 bg-black/60 backdrop-blur-xl border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between px-2">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Jami tanlandi</p>
                <p className="text-lg font-black text-white">
                  {Object.values(quantities).reduce((a, b) => a + b, 0)} dona
                </p>
              </div>
              <button
                type="button"
                onClick={handleApply}
                disabled={Object.values(quantities).reduce((a, b) => a + b, 0) === 0}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:grayscale text-white text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                Buyurtmaga qo‘shish
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
      
      {/* Navigation Footer (Mobile Only) */}
      <div className="shrink-0 p-4 bg-white/[0.03] border-t border-white/5 flex items-center justify-between gap-4 md:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Savatda</p>
          <p className="text-sm font-black text-white">{lineCount} xil mahsulot</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onFinalize) onFinalize();
            else onClose();
          }}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
        >
          Buyurtmaga o'tish
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.aside>
  );
}
