'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import {
  usePartnerLedgerMutations,
  usePartnerLedgerSaleCatalog,
} from '@/hooks/partner-ledger/use-partner-ledger';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { formatLedgerAmount } from './partner-ledger-utils';
import { SETTLEMENT_OPTIONS } from './partner-ledger-settlement';
import type {
  PartnerLedgerCatalogItem,
  PartnerLedgerSettlementType,
} from '@/services/partner-ledger.service';
import { partnerLedgerService } from '@/services/partner-ledger.service';
import { toast, formatApiError } from '@/lib/toast';

type CartLine = {
  variant: PartnerLedgerCatalogItem;
  quantity: number;
};

type WarehouseOption = { id: string; name: string };

type Props = {
  open: boolean;
  contactId: string;
  contactName: string;
  onClose: () => void;
  onSuccess: () => void;
};

function lineTotal(variant: PartnerLedgerCatalogItem, qty: number) {
  return qty * Number(variant.salePrice || 0);
}

export function PartnerLedgerSaleModal({ open, contactId, contactName, onClose, onSuccess }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [settlementType, setSettlementType] = useState<PartnerLedgerSettlementType>('on_credit');
  const [settlementNote, setSettlementNote] = useState('');
  const [notes, setNotes] = useState('');
  const [operationDate, setOperationDate] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importErrors, setImportErrors] = useState<
    Array<{ rowNumber: number; message: string; sku?: string; barcode?: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalTransition = { duration: 0.12, ease: 'easeOut' as const };

  const { data: warehousesData } = useWarehouses();
  const warehouses: WarehouseOption[] = Array.isArray(warehousesData)
    ? (warehousesData as WarehouseOption[])
    : [];
  const { data: catalog, isPending: catalogLoading } = usePartnerLedgerSaleCatalog(
    warehouseId,
    debouncedSearch,
    open,
  );
  const mutations = usePartnerLedgerMutations();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search, open]);

  useEffect(() => {
    if (!open) return;
    setCart([]);
    setSearch('');
    setDebouncedSearch('');
    setSettlementNote('');
    setNotes('');
    setSettlementType('on_credit');
    setOperationDate(new Date().toISOString().slice(0, 10));
    setImportErrors([]);
  }, [open]);

  useEffect(() => {
    if (!open || warehouseId || !warehouses[0]?.id) return;
    setWarehouseId(warehouses[0].id);
  }, [open, warehouses, warehouseId]);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      const cur = (line.variant.currency || 'UZS').toUpperCase();
      map.set(cur, (map.get(cur) || 0) + lineTotal(line.variant, line.quantity));
    }
    return Array.from(map.entries());
  }, [cart]);

  const addToCart = (variant: PartnerLedgerCatalogItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.variant.id === variant.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { variant, quantity: 1 }];
    });
  };

  const setQty = (variantId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.variant.id !== variantId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.variant.id === variantId ? { ...l, quantity: qty } : l)),
    );
  };

  const settlementHint = SETTLEMENT_OPTIONS.find((o) => o.value === settlementType)?.hint;

  const handleDownloadTemplate = async () => {
    if (!warehouseId) {
      toast.error('Avval omborni tanlang');
      return;
    }
    setTemplateBusy(true);
    try {
      await partnerLedgerService.downloadSaleOrderTemplate(warehouseId, contactName);
      toast.success('Shablon yuklandi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleExcelImport = async (file: File) => {
    if (!warehouseId) {
      toast.error('Avval omborni tanlang');
      return;
    }
    setImportBusy(true);
    setImportErrors([]);
    try {
      const preview = await partnerLedgerService.previewSaleOrderExcel(
        contactId,
        warehouseId,
        file,
      );
      setImportErrors(preview.errors || []);
      if (!preview.lines?.length) {
        toast.error('Hech qanday qator mos kelmadi');
        return;
      }
      const blocking = (preview.errors || []).filter((e) => e.message.includes('yetarli'));
      if (blocking.length) {
        toast.error(`${blocking.length} ta qatorda omborda yetarli qoldiq yo‘q`);
      }
      setCart(
        preview.lines.map((line) => ({
          variant: {
            id: line.productVariantId,
            productId: '',
            productName: line.productName,
            name: line.name,
            sku: line.sku,
            barcode: line.barcode,
            salePrice: line.salePrice,
            currency: line.currency,
            stockQty: line.stockQty,
          },
          quantity: line.quantity,
        })),
      );
      toast.success(`${preview.lines.length} ta qator yuklandi`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!warehouseId || cart.length === 0) return;
    for (const line of cart) {
      if (line.quantity > line.variant.stockQty) {
        toast.error(
          `${line.variant.productName} — omborda ${line.variant.stockQty} dona, ${line.quantity} so‘ralmoqda`,
        );
        return;
      }
    }
    try {
      const result = await mutations.createSaleOrder.mutateAsync({
        contactId,
        warehouseId,
        lines: cart.map((l) => ({
          productVariantId: l.variant.id,
          quantity: l.quantity,
        })),
        operationDate,
        notes: notes.trim() || undefined,
        settlementType,
        settlementNote: settlementNote.trim() || undefined,
      });
      toast.success('Buyurtma saqlandi — operatsiyalar jadvaliga yozildi');
      if (result?.batchId) {
        try {
          await partnerLedgerService.exportSaleOrderExcel(
            contactId,
            result.batchId,
            contactName,
          );
        } catch {
          toast.error('Excel eksport qilinmadi — operatsiyadan qayta yuklang');
        }
      }
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/75 z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={modalTransition}
            className="fixed inset-2 md:inset-6 lg:inset-10 z-[210] glass-card rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10 shrink-0">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShoppingCart size={20} className="text-blue-400" />
                  Hamkorga sotish
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {contactName} · sotuv narxi bo‘yicha · ombordan chiqim
                </p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400">
                <X size={22} />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 min-h-0">
              <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-white/10">
                <div className="p-4 flex flex-wrap gap-3 border-b border-white/5">
                  <select
                    value={warehouseId}
                    onChange={(e) => {
                      setWarehouseId(e.target.value);
                      setCart([]);
                      setSearch('');
                      setDebouncedSearch('');
                    }}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold min-w-[160px]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nomi, SKU, shtrix-kod…"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 w-full">
                    <button
                      type="button"
                      disabled={!warehouseId || templateBusy}
                      onClick={() => void handleDownloadTemplate()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
                    >
                      {templateBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FileSpreadsheet size={14} />
                      )}
                      Shablon
                    </button>
                    <button
                      type="button"
                      disabled={!warehouseId || importBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
                    >
                      {importBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      Excel dan yuklash
                    </button>
                    <p className="w-full text-[10px] text-gray-500 leading-relaxed">
                      Shablon: SKU, Variant (masalan Tilla), Miqdor — «Katalog»dan ko‘chiring.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleExcelImport(f);
                      }}
                    />
                  </div>
                  {importErrors.length > 0 ? (
                    <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 max-h-24 overflow-y-auto">
                      {importErrors.map((err) => (
                        <p key={`${err.rowNumber}-${err.message}`} className="text-[11px] text-amber-200/90">
                          Qator {err.rowNumber}: {err.message}
                          {err.sku ? ` (${err.sku})` : ''}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {catalogLoading ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="animate-spin text-gray-500" size={28} />
                    </div>
                  ) : !catalog?.items?.length ? (
                    <p className="text-center text-gray-500 text-sm font-bold py-16">Mahsulot topilmadi</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {catalog.items.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => addToCart(v)}
                          className="text-left p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-blue-500/30 transition-all"
                        >
                          <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                              {v.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={v.image} alt="" className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                <Package size={20} className="text-gray-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white truncate">{v.productName}</p>
                              <p className="text-xs text-gray-400 truncate">{v.name}</p>
                              {v.sku ? (
                                <p className="text-[10px] font-mono text-gray-500 mt-0.5">SKU: {v.sku}</p>
                              ) : null}
                              <div className="flex items-center justify-between mt-2 gap-2">
                                <span className="text-sm font-black text-blue-400">
                                  {formatLedgerAmount(v.salePrice, v.currency || 'UZS').replace(/^\+/, '')}
                                </span>
                                <span
                                  className={`text-[10px] font-bold ${
                                    v.stockQty > 0 ? 'text-gray-500' : 'text-red-400'
                                  }`}
                                >
                                  Qoldiq: {v.stockQty}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full lg:w-[380px] flex flex-col min-h-0 bg-black/20">
                <div className="p-4 border-b border-white/10">
                  <p className="text-[10px] font-black uppercase text-gray-500">Buyurtma</p>
                  {cart.length === 0 ? (
                    <p className="text-sm text-gray-500 mt-3 font-bold">Katalogdan mahsulot tanlang</p>
                  ) : (
                    <ul className="mt-3 space-y-2 max-h-[200px] overflow-y-auto">
                      {cart.map((line) => (
                        <li
                          key={line.variant.id}
                          className="flex gap-2 items-start rounded-xl bg-white/5 p-2 border border-white/5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{line.variant.productName}</p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {line.variant.name}
                              {line.variant.sku ? ` · ${line.variant.sku}` : ''}
                            </p>
                            <p className="text-xs font-black text-blue-400 mt-1">
                              {formatLedgerAmount(
                                lineTotal(line.variant, line.quantity),
                                line.variant.currency || 'UZS',
                              ).replace(/^\+/, '')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setQty(line.variant.id, line.quantity - 1)}
                              className="p-1 rounded-lg bg-white/10"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                setQty(line.variant.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-12 text-center text-xs font-bold bg-white/5 rounded-lg py-1"
                            />
                            <button
                              type="button"
                              onClick={() => setQty(line.variant.id, line.quantity + 1)}
                              className="p-1 rounded-lg bg-white/10"
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setQty(line.variant.id, 0)}
                              className="p-1 rounded-lg text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-500 mb-2">Jami (sotuv narxi)</p>
                    {totalsByCurrency.length === 0 ? (
                      <p className="text-gray-500 text-sm font-bold">—</p>
                    ) : (
                      totalsByCurrency.map(([cur, sum]) => (
                        <p key={cur} className="text-xl font-black text-emerald-400">
                          {formatLedgerAmount(sum, cur).replace(/^\+/, '')}
                        </p>
                      ))
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-500">
                      Hamkor buyurtmani nima bilan beradi?
                    </label>
                    <select
                      value={settlementType}
                      onChange={(e) =>
                        setSettlementType(e.target.value as PartnerLedgerSettlementType)
                      }
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
                    >
                      {SETTLEMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {settlementHint ? (
                      <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{settlementHint}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-500">
                      Batafsil (ixtiyoriy)
                    </label>
                    <input
                      value={settlementNote}
                      onChange={(e) => setSettlementNote(e.target.value)}
                      placeholder="Masalan: 15-iyunda 50% naqd, qolgani tovar almashinuvi"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-500">Sana</label>
                      <input
                        type="date"
                        value={operationDate}
                        onChange={(e) => setOperationDate(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-500">Eslatma</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold resize-none"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-white/10 shrink-0">
                  <button
                    type="button"
                    disabled={cart.length === 0 || mutations.createSaleOrder.isPending}
                    onClick={() => void handleSubmit()}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {mutations.createSaleOrder.isPending && <Loader2 className="animate-spin" size={16} />}
                    Tasdiqlash — ombor + daftar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
