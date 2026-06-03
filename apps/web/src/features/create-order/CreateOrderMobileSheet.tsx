'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Trash2, ChevronDown, Loader2, CheckCircle2, Minus,
  ChevronLeft, ChevronRight, ShoppingBag, User, Calendar, Package,
  ArrowRight, ClipboardList, BookOpen, FileText, AlertCircle,
} from 'lucide-react';
import { SellerCatalogPanel } from '@/components/SellerCatalogPanel';
import {
  type FormState,
  type FormItem,
  type Currency,
  defaultFormItem,
  getMatchedVariants,
  getOrderTotal,
  formatAmount,
  buildOrderProductSnapshot,
  displayOrderProductSnapshot,
  splitSnapshotToLine,
} from './order-form-utils';
import { MobileOrderItemCard } from './MobileOrderItemCard';
// в”Ђв”Ђв”Ђ Mobile Bottom Sheet в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface CreateOrderMobileSheetProps {
  formData: FormState;
  setFormData: React.Dispatch<React.SetStateAction<FormState>>;
  partners: any[];
  products: any[];
  selectedPartner: any;
  mobileStep: number;
  setMobileStep: (v: number) => void;
  mobileAddingItem: boolean;
  setMobileAddingItem: (v: boolean) => void;
  mobileDraftItem: FormItem;
  setMobileDraftItem: React.Dispatch<React.SetStateAction<FormItem>>;
  mobileProductSearch: string;
  setMobileProductSearch: (v: string) => void;
  mobileProductDropdownOpen: boolean;
  setMobileProductDropdownOpen: (v: boolean) => void;
  mobileAddingCatalog: boolean;
  setMobileAddingCatalog: (v: boolean) => void;
  showNotes: boolean;
  setShowNotes: (v: boolean) => void;
  isSubmitting: boolean;
  submitError: string | null;
  editOrderId?: string | null;
  renderOrderTotalDisplay: () => string;
  handleRemoveItem: (i: number) => void;
  handleItemChange: (i: number, field: keyof FormItem, value: string | number) => void;
  handleSubmit: () => void;
  requestCloseModal: () => void;
}

export function CreateOrderMobileSheet({
  formData,
  setFormData,
  partners,
  products,
  selectedPartner,
  mobileStep,
  setMobileStep,
  mobileAddingItem,
  setMobileAddingItem,
  mobileDraftItem,
  setMobileDraftItem,
  mobileProductSearch,
  setMobileProductSearch,
  mobileProductDropdownOpen,
  setMobileProductDropdownOpen,
  mobileAddingCatalog,
  setMobileAddingCatalog,
  showNotes,
  setShowNotes,
  isSubmitting,
  submitError,
  editOrderId,
  renderOrderTotalDisplay,
  handleRemoveItem,
  handleItemChange,
  handleSubmit,
  requestCloseModal,
}: CreateOrderMobileSheetProps) {
  const [partnerDropdownOpen, setPartnerDropdownOpen] = useState(false);

  const sellerName =
    selectedPartner?.company?.name ||
    selectedPartner?.partnerCompanyName ||
    selectedPartner?.name ||
    selectedPartner?.companyName ||
    '';

  const matchedProducts = useMemo(
    () => getMatchedVariants(products, mobileProductSearch),
    [products, mobileProductSearch],
  );

  const activePartners = useMemo(
    () => partners.filter((p: any) => !p.status || p.status === 'ACTIVE'),
    [partners],
  );

  const canGoNext = useMemo(() => {
    if (mobileStep === 1) return !!(formData.partnerId || editOrderId);
    if (mobileStep === 2) return formData.items.some((i) => i.productName.trim());
    return true;
  }, [mobileStep, formData.partnerId, formData.items, editOrderId]);

  const addDraftItemToList = () => {
    if (!mobileDraftItem.productName.trim()) return;
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items.filter((i) => i.productName.trim()),
        { ...mobileDraftItem },
      ],
    }));
    setMobileDraftItem(defaultFormItem());
    setMobileProductSearch('');
    setMobileAddingItem(false);
  };

  const { uzs, usd } = useMemo(() => getOrderTotal(formData.items), [formData.items]);

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={requestCloseModal}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 h-[92vh] bg-[#0a0a0a] rounded-t-[2rem] flex flex-col overflow-hidden shadow-2xl border-t border-white/10"
      >
        {/* Drag handle */}
        <div className="shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Sheet header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div>
            <h2 className="text-lg font-black text-white">
              {editOrderId ? 'Buyurtmani Tahrirlash' : 'Yangi Buyurtma'}
            </h2>
            <p className="text-[11px] text-gray-500 font-bold">
              {mobileStep === 1 && 'Hamkor & Sana'}
              {mobileStep === 2 && 'Mahsulotlar'}
              {mobileStep === 3 && 'Tasdiqlash'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`rounded-full transition-all ${
                    s === mobileStep
                      ? 'w-5 h-2 bg-blue-500'
                      : s < mobileStep
                      ? 'w-2 h-2 bg-blue-500/50'
                      : 'w-2 h-2 bg-white/15'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={requestCloseModal}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-center transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {mobileStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-5 space-y-5"
              >
                {/* Partner */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                    Hamkor Tanlash
                  </label>
                  
                  {formData.partnerId ? (
                    /* Selected Partner Card */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                          {sellerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white truncate">{sellerName}</p>
                          <p className="text-[10px] font-bold text-blue-400">Tanlangan Hamkor</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, partnerId: '' }));
                        }}
                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-xl active:scale-95 transition-all shrink-0"
                      >
                        O&apos;zgartirish
                      </button>
                    </motion.div>
                  ) : (
                    /* Elegant Active Partners List */
                    <div className="space-y-2">
                      {activePartners.length === 0 ? (
                        <div className="py-8 text-center text-gray-500 text-sm font-bold bg-white/[0.02] border border-white/5 rounded-2xl">
                          Faol hamkorlar topilmadi
                        </div>
                      ) : (
                        activePartners.map((p: any) => {
                          const pid = p.company?.id || p.partnerCompanyId || p.id;
                          const pname =
                            p.company?.name ||
                            p.partnerCompanyName ||
                            p.name ||
                            p.companyName ||
                            'Nomsiz hamkor';
                          return (
                            <button
                              key={pid}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, partnerId: pid }));
                                // Auto advance to step 2 for superior native feel
                                setTimeout(() => setMobileStep(2), 150);
                              }}
                              className="w-full text-left p-4 bg-white/[0.02] border border-white/5 hover:border-white/10 active:border-blue-500/30 rounded-2xl transition-all flex items-center justify-between gap-3 min-h-[64px]"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/5 to-white/10 group-hover:from-blue-500 group-hover:to-indigo-600 flex items-center justify-center text-gray-300 group-hover:text-white font-black text-sm shrink-0">
                                  {pname.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white truncate">{pname}</p>
                                  <p className="text-[10px] font-bold text-gray-500">B2B Hamkor</p>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-gray-600 shrink-0" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Delivery date */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Yetkazib berish sanasi
                  </label>
                  <input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, deliveryDate: e.target.value }))
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all min-h-[52px]"
                  />
                </div>
              </motion.div>
            )}

            {mobileStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-4 space-y-4"
              >
                {/* Running total */}
                {(uzs > 0 || usd > 0) && (
                  <div className="flex items-center justify-between p-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                    <span className="text-xs font-black text-blue-400 uppercase tracking-wide">Jami</span>
                    <span className="text-sm font-black text-white">{renderOrderTotalDisplay()}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                      Tanlangan mahsulotlar ({formData.items.filter(i => i.productName.trim()).length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setMobileAddingCatalog(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      <BookOpen size={14} />
                      Katalog
                    </button>
                  </div>

                  {formData.items
                    .filter((i) => i.productName.trim())
                    .map((item, index) => (
                      <MobileOrderItemCard
                        key={index}
                        item={item}
                        index={index}
                        handleItemChange={handleItemChange}
                        handleRemoveItem={handleRemoveItem}
                      />
                    ))}
                  {formData.items.filter((i) => i.productName.trim()).length === 0 && !mobileAddingItem && (
                    <div className="py-8 text-center text-gray-600 text-sm font-bold">
                      Hali mahsulot qo'shilmagan
                    </div>
                  )}
                </div>

                {/* Mobile Catalog Overlay */}
                <AnimatePresence>
                  {mobileAddingCatalog && (
                    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
                      <SellerCatalogPanel
                        sellerCompanyId={formData.partnerId}
                        sellerName={selectedPartner?.name || 'Hamkor'}
                        lineCount={formData.items.length}
                        onApplyMultiple={(itemsToAdd) => {
                          setFormData((prev) => {
                            const currentItems = prev.items.filter((it) => it.productName.trim() || it.variantId);
                            const newItems = itemsToAdd.map((it) => ({
                              productName: it.productName,
                              sellerProductVariantId: it.sellerProductVariantId,
                              variantId: '',
                              variantLabel: it.variantLabel,
                              variantSku: it.variantSku?.trim() || undefined,
                              quantity: it.quantity || 1,
                              price: String(it.salePrice || 0),
                              currency: it.expectedCurrency || 'UZS',
                              snapshotName: buildOrderProductSnapshot(
                                it.productName,
                                it.variantLabel,
                                it.variantSku,
                              ),
                            }));
                            return { ...prev, items: [...currentItems, ...newItems] };
                          });
                          setMobileAddingCatalog(false);
                        }}
                        onFinalize={() => {
                          setMobileAddingCatalog(false);
                          setMobileStep(3);
                        }}
                        onClose={() => setMobileAddingCatalog(false)}
                      />
                    </div>
                  )}
                </AnimatePresence>

                {/* Inline add item form */}
                <AnimatePresence>
                  {mobileAddingItem && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-white/[0.04] border border-white/10 rounded-2xl space-y-3">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                          Yangi mahsulot
                        </p>

                        {/* Product name with autocomplete */}
                        <div className="relative">
                          <input
                            type="text"
                            value={mobileProductSearch}
                            onChange={(e) => {
                              setMobileProductSearch(e.target.value);
                              setMobileDraftItem((prev) => ({
                                ...prev,
                                productName: e.target.value,
                                variantId: '',
                                variantLabel: '',
                              }));
                              setMobileProductDropdownOpen(true);
                            }}
                            onFocus={() => setMobileProductDropdownOpen(true)}
                            placeholder="Mahsulot nomini kiriting..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/40 transition-all placeholder:text-gray-600 min-h-[48px]"
                          />
                          <AnimatePresence>
                            {mobileProductDropdownOpen && matchedProducts.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 p-1"
                              >
                                <div className="max-h-52 overflow-y-auto custom-scrollbar">
                                  {matchedProducts.map((m) => (
                                    <button
                                      key={m.variantId || m.label}
                                      type="button"
                                      onClick={() => {
                                        setMobileDraftItem((prev) => ({
                                          ...prev,
                                          productName: m.productName,
                                          variantId: m.variantId,
                                          variantLabel: splitSnapshotToLine(m.label)
                                            .variantLabel,
                                          price: m.salePrice != null ? String(m.salePrice) : prev.price,
                                          currency: (m.currency || 'UZS') as Currency,
                                        }));
                                        setMobileProductSearch(m.label);
                                        setMobileProductDropdownOpen(false);
                                      }}
                                      className="w-full text-left px-4 py-3.5 rounded-lg text-sm font-bold text-gray-300 hover:bg-white/5 hover:text-white transition-all min-h-[48px] flex items-center"
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Quantity stepper */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            Miqdor
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setMobileDraftItem((prev) => ({
                                  ...prev,
                                  quantity: Math.max(1, prev.quantity - 1),
                                }))
                              }
                              className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xl font-black transition-all"
                            >
                              <Minus size={18} />
                            </button>
                            <span className="flex-1 text-center text-xl font-black text-white">
                              {mobileDraftItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setMobileDraftItem((prev) => ({
                                  ...prev,
                                  quantity: prev.quantity + 1,
                                }))
                              }
                              className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xl font-black transition-all"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Price + currency */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            Narx
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={0}
                              value={mobileDraftItem.price}
                              onChange={(e) =>
                                setMobileDraftItem((prev) => ({ ...prev, price: e.target.value }))
                              }
                              placeholder="0"
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/40 transition-all placeholder:text-gray-600 min-h-[48px]"
                            />
                            {/* Currency pill toggle */}
                            <div className="flex rounded-xl overflow-hidden border border-white/10">
                              {(['UZS', 'USD'] as Currency[]).map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() =>
                                    setMobileDraftItem((prev) => ({ ...prev, currency: c }))
                                  }
                                  className={`px-4 py-3.5 text-xs font-black transition-all min-h-[48px] ${
                                    mobileDraftItem.currency === c
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

                        {/* Add / Cancel */}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMobileAddingItem(false);
                              setMobileDraftItem(defaultFormItem());
                              setMobileProductSearch('');
                            }}
                            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-xl transition-all min-h-[48px]"
                          >
                            Bekor
                          </button>
                          <button
                            type="button"
                            onClick={addDraftItemToList}
                            disabled={!mobileDraftItem.productName.trim()}
                            className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl transition-all min-h-[48px]"
                          >
                            Qo'shish
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add item button */}
                {!mobileAddingItem && (
                  <button
                    type="button"
                    onClick={() => setMobileAddingItem(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-white/[0.03] border border-white/10 border-dashed rounded-2xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all min-h-[52px]"
                  >
                    <Plus size={16} />
                    Mahsulot qo'shish
                  </button>
                )}
              </motion.div>
            )}

            {mobileStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-4 space-y-4"
              >
                {/* Summary card */}
                <div className="p-4 bg-white/[0.04] border border-white/10 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Buyurtma xulosasi
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-bold">Hamkor</span>
                      <span className="text-sm font-black text-white">
                        {sellerName || 'вЂ”'}
                      </span>
                    </div>
                    {formData.deliveryDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-bold">Yetkazish sanasi</span>
                        <span className="text-sm font-black text-white">
                          {formData.deliveryDate}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-bold">Mahsulotlar</span>
                      <span className="text-sm font-black text-white">
                        {formData.items.filter((i) => i.productName.trim()).length} ta
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-white/10">
                      <span className="text-xs text-gray-500 font-bold">Jami summa</span>
                      <span className="text-sm font-black text-blue-400">
                        {renderOrderTotalDisplay()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items list (read-only) */}
                <div className="space-y-2">
                  {formData.items
                    .filter((i) => i.productName.trim())
                    .map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">
                            {displayOrderProductSnapshot(
                              item.snapshotName?.trim() ||
                              buildOrderProductSnapshot(
                                item.productName,
                                item.variantLabel,
                                item.variantSku,
                              ),
                            )}
                          </p>
                          <p className="text-xs text-gray-500 font-bold">
                            {item.quantity} Г— {formatAmount(parseFloat(item.price) || 0, item.currency)}
                          </p>
                        </div>
                        <span className="text-sm font-black text-white shrink-0 ml-3">
                          {formatAmount((parseFloat(item.price) || 0) * item.quantity, item.currency)}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Notes toggle */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowNotes(!showNotes)}
                    className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-gray-300 uppercase tracking-widest transition-all min-h-[44px]"
                  >
                    <FileText size={13} />
                    {showNotes ? "Izohni yashirish" : "+ Izoh qo'shish"}
                  </button>
                  <AnimatePresence>
                    {showNotes && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <textarea
                          value={formData.notes}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          placeholder="Buyurtma bo'yicha izoh..."
                          rows={3}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all resize-none placeholder:text-gray-600"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Error */}
                {submitError && (
                  <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold">
                    <AlertCircle size={16} />
                    {submitError}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom navigation */}
        <div className="shrink-0 px-5 py-4 border-t border-white/10 bg-[#0a0a0a]">
          {mobileStep < 3 ? (
            <div className="flex gap-3">
              {mobileStep > 1 && (
                <button
                  type="button"
                  onClick={() => setMobileStep(mobileStep - 1)}
                  className="flex items-center gap-2 px-5 py-4 bg-white/5 hover:bg-white/10 text-gray-300 font-black rounded-2xl transition-all min-h-[56px]"
                >
                  <ChevronLeft size={18} />
                  Orqaga
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileStep(mobileStep + 1)}
                disabled={!canGoNext}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-2xl transition-all min-h-[56px]"
              >
                Keyingi
                <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMobileStep(2)}
                className="flex items-center gap-2 px-5 py-4 bg-white/5 hover:bg-white/10 text-gray-300 font-black rounded-2xl transition-all min-h-[56px]"
              >
                <ChevronLeft size={18} />
                Orqaga
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all min-h-[56px] shadow-lg shadow-blue-900/30"
              >
                {isSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Buyurtma yaratish
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
