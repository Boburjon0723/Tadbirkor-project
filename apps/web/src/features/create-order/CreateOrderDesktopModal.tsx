'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Search,
  Package,
  ShoppingBag,
  PenLine,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { B2bOrderManualLinePanel } from './B2bOrderManualLinePanel';
import { toast } from '@/lib/toast';
import { ordersService } from '@/services/orders.service';
import { buildOrderProductSnapshot, formatVariantLabel } from '@/lib/order-product-label';
import { ORDER_MAX_LINE_ITEMS } from '@/lib/order-limits';
import {
  type FormState,
  type FormItem,
  type Currency,
  formatAmount,
} from './order-form-utils';

export interface CreateOrderDesktopModalProps {
  formData: FormState;
  setFormData: React.Dispatch<React.SetStateAction<FormState>>;
  partners: any[];
  products: any[];
  selectedPartner: any;
  isSubmitting: boolean;
  submitError: string | null;
  editOrderId?: string | null;
  renderOrderTotalDisplay: () => string;
  handleItemChange: (i: number, field: keyof FormItem, value: string | number) => void;
  handleSubmit: () => void;
  requestCloseModal: () => void;
}

type CatalogItem = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string | null;
  color: string | null;
  imageUrl: string | null;
  salePrice: number;
  currency: string;
};

function resolveImageUrl(raw?: string | null) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const apiBase = String(process.env.NEXT_PUBLIC_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const origin = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
  if (!origin) return v;
  return v.startsWith('/') ? `${origin}${v}` : `${origin}/${v}`;
}

function catalogItemToFormItem(item: CatalogItem, quantity = 1): FormItem {
  const variantLabel = formatVariantLabel(item.variantName, item.color);
  return {
    productName: item.productName,
    sellerProductVariantId: item.variantId,
    variantId: '',
    variantLabel,
    variantSku: item.sku?.trim() || undefined,
    quantity,
    price: String(item.salePrice ?? 0),
    currency: String(item.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS',
    snapshotName: buildOrderProductSnapshot(item.productName, variantLabel, item.sku),
  };
}

function lineTotal(item: FormItem) {
  return (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
}

export function CreateOrderDesktopModal({
  formData,
  setFormData,
  partners,
  products,
  selectedPartner,
  isSubmitting,
  submitError,
  editOrderId,
  renderOrderTotalDisplay,
  handleItemChange,
  handleSubmit,
  requestCloseModal,
}: CreateOrderDesktopModalProps) {
  const isEditMode = Boolean(editOrderId);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const activePartners = useMemo(
    () => partners.filter((p: any) => !p.status || p.status === 'ACTIVE'),
    [partners],
  );

  const sellerDisplayName = selectedPartner
    ? selectedPartner.isIncoming
      ? selectedPartner.ownerCompany?.name
      : selectedPartner.partnerCompany?.name
    : undefined;

  const { data: catalog, isPending: catalogLoading } = useQuery({
    queryKey: ['b2b-seller-catalog', formData.partnerId, debouncedSearch],
    queryFn: () => ordersService.getSellerCatalog(formData.partnerId, debouncedSearch),
    enabled: Boolean(formData.partnerId),
    staleTime: 60_000,
  });

  const catalogItems: CatalogItem[] = catalog?.items ?? [];

  const cartEntries = useMemo(
    () =>
      formData.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.productName.trim() || item.sellerProductVariantId),
    [formData.items],
  );

  const cartFull = cartEntries.length >= ORDER_MAX_LINE_ITEMS;

  const addCatalogToCart = (item: CatalogItem) => {
    setFormData((prev) => {
      const filled = prev.items.filter(
        (it) => it.productName.trim() || it.sellerProductVariantId,
      );
      if (filled.length >= ORDER_MAX_LINE_ITEMS) return prev;
      const idx = filled.findIndex((it) => it.sellerProductVariantId === item.variantId);
      if (idx >= 0) {
        const items = [...filled];
        items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 };
        return { ...prev, items };
      }
      return { ...prev, items: [...filled, catalogItemToFormItem(item, 1)] };
    });
  };

  const setCartQty = (index: number, qty: number) => {
    if (qty <= 0) {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
      return;
    }
    handleItemChange(index, 'quantity', qty);
  };

  const removeCartLine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const addManualLine = (item: FormItem) => {
    setFormData((prev) => {
      const filled = prev.items.filter(
        (it) => it.productName.trim() || it.sellerProductVariantId,
      );
      if (filled.length >= ORDER_MAX_LINE_ITEMS) return prev;
      return { ...prev, items: [...filled, item] };
    });
    toast.success('Savatga qo‘shildi');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={requestCloseModal}
        className="fixed inset-0 bg-black/75 z-[100]"
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="fixed inset-2 md:inset-6 lg:inset-10 z-[110] glass-card rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <ShoppingBag size={20} className="text-blue-400" />
              {isEditMode ? 'Buyurtmani tahrirlash' : 'Yangi B2B buyurtma'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {sellerDisplayName || 'Hamkorni tanlang'} · hamkor katalogi yoki qo‘lda
            </p>
          </div>
          <button
            type="button"
            onClick={requestCloseModal}
            className="p-2 rounded-xl hover:bg-white/10 text-gray-400"
          >
            <X size={22} />
          </button>
        </div>

        {submitError ? (
          <div className="mx-5 mt-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 shrink-0">
            <AlertCircle size={18} className="shrink-0" />
            {submitError}
          </div>
        ) : null}

        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Katalog */}
          <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-white/10">
            <div className="p-4 flex flex-wrap gap-3 border-b border-white/5">
              <select
                value={formData.partnerId}
                disabled={isEditMode}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, partnerId: e.target.value, items: [] }));
                  setSearch('');
                  setDebouncedSearch('');
                  setManualOpen(false);
                }}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold min-w-[180px] disabled:opacity-60"
              >
                <option value="">Hamkorni tanlang</option>
                {activePartners.map((p: any) => {
                  const comp = p.isIncoming ? p.ownerCompany : p.partnerCompany;
                  const cid = comp?.id || p.company?.id || p.partnerCompanyId || p.id;
                  const cname =
                    comp?.name || p.company?.name || p.partnerCompanyName || 'Nomsiz hamkor';
                  return (
                    <option key={cid} value={cid}>
                      {cname}
                    </option>
                  );
                })}
              </select>

              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={!formData.partnerId}
                  placeholder={
                    formData.partnerId ? 'Nomi, SKU, shtrix-kod…' : 'Avval hamkorni tanlang'
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold disabled:opacity-50"
                />
              </div>

              {search.trim() && formData.partnerId ? (
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-600/15 border border-amber-500/25 text-xs font-bold text-amber-200 hover:bg-amber-600/25"
                  title="Qidiruv matnini qo‘lda qatorga o‘tkazish"
                >
                  <Plus size={14} />
                  «{search.trim().slice(0, 20)}
                  {search.trim().length > 20 ? '…' : ''}»
                </button>
              ) : null}
              <button
                type="button"
                disabled={!formData.partnerId}
                onClick={() => setManualOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${
                  manualOpen
                    ? 'bg-amber-600/20 border-amber-500/30 text-amber-200'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <PenLine size={14} />
                Qo‘lda yozish
              </button>
            </div>

            {formData.partnerId && manualOpen ? (
              <B2bOrderManualLinePanel
                open={manualOpen}
                onClose={() => setManualOpen(false)}
                partnerId={formData.partnerId}
                products={products}
                searchPrefill={search}
                cartFull={cartFull}
                onAdd={addManualLine}
              />
            ) : null}

            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {!formData.partnerId ? (
                <p className="text-center text-gray-500 text-sm font-bold py-16">
                  Buyurtma berish uchun sotuvchi hamkorni tanlang
                </p>
              ) : catalogLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-gray-500" size={28} />
                </div>
              ) : !catalogItems.length ? (
                <div className="text-center py-12 space-y-4">
                  <p className="text-gray-500 text-sm font-bold">
                    {debouncedSearch
                      ? `«${debouncedSearch}» hamkor katalogida yo‘q`
                      : 'Hamkor katalogida mahsulot topilmadi'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setManualOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/20 border border-amber-500/30 text-sm font-bold text-amber-200 hover:bg-amber-600/30"
                  >
                    <PenLine size={16} />
                    {debouncedSearch
                      ? `«${debouncedSearch}» ni qo‘lda qo‘shish`
                      : 'Qo‘lda yozish'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {catalogItems.map((v) => {
                    const img = resolveImageUrl(v.imageUrl);
                    const variantLabel = formatVariantLabel(v.variantName, v.color);
                    const cur = String(v.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
                    return (
                      <button
                        key={v.variantId}
                        type="button"
                        onClick={() => addCatalogToCart(v)}
                        className="text-left p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-blue-500/30 transition-all"
                      >
                        <div className="flex gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={20} className="text-gray-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white truncate">{v.productName}</p>
                            <p className="text-xs text-gray-400 truncate">{variantLabel}</p>
                            {v.sku ? (
                              <p className="text-[10px] font-mono text-gray-500 mt-0.5">SKU: {v.sku}</p>
                            ) : null}
                            <p className="text-sm font-black text-blue-400 mt-2">
                              {formatAmount(Number(v.salePrice), cur)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Savat */}
          <div className="w-full lg:w-[380px] flex flex-col min-h-0 bg-black/20">
            <div className="p-4 border-b border-white/10">
              <p className="text-[10px] font-black uppercase text-gray-500">Buyurtma</p>
              {cartEntries.length === 0 ? (
                <p className="text-sm text-gray-500 mt-3 font-bold">Katalogdan yoki qo‘lda qo‘shing</p>
              ) : (
                <ul className="mt-3 space-y-2 max-h-[220px] overflow-y-auto">
                  {cartEntries.map(({ item, index }) => {
                    const cur = (item.currency || 'UZS') as Currency;
                    return (
                      <li
                        key={`${index}-${item.sellerProductVariantId || item.productName}`}
                        className="flex gap-2 items-start rounded-xl bg-white/5 p-2 border border-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{item.productName}</p>
                          {item.variantLabel ? (
                            <p className="text-[10px] text-gray-500 truncate">{item.variantLabel}</p>
                          ) : null}
                          <p className="text-xs font-black text-blue-400 mt-1">
                            {formatAmount(lineTotal(item), cur)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setCartQty(index, item.quantity - 1)}
                            className="p-1 rounded-lg bg-white/10"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              setCartQty(index, parseFloat(e.target.value) || 0)
                            }
                            className="w-12 text-center text-xs font-bold bg-white/5 rounded-lg py-1"
                          />
                          <button
                            type="button"
                            onClick={() => setCartQty(index, item.quantity + 1)}
                            className="p-1 rounded-lg bg-white/10"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCartLine(index)}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-500 mb-2">
                  Jami (kutilayotgan narx)
                </p>
                <p className="text-xl font-black text-emerald-400">{renderOrderTotalDisplay()}</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1">
                  <Calendar size={12} /> Yetkazish sanasi
                </label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, deliveryDate: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-500">Eslatma</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Buyurtma bo‘yicha qo‘shimcha shartlar…"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 shrink-0">
              <button
                type="button"
                disabled={cartEntries.length === 0 || isSubmitting}
                onClick={() => handleSubmit()}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                {isEditMode ? 'O‘zgarishlarni saqlash' : 'Buyurtmani yaratish'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
