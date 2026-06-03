'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PackageCheck, Warehouse, Loader2, CheckCircle2, ArrowRight, AlertCircle, Building2, ChevronDown, Minus, Plus } from 'lucide-react';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { useReceiptActions } from '@/hooks/logistics/use-logistics';
import { useQuery } from '@tanstack/react-query';
import { receiptsService } from '@/services/receipts.service';
import { CreateWarehouseModal } from '@/components/CreateWarehouseModal';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import { displayOrderProductSnapshot } from '@/lib/order-product-label';

interface AcceptReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: any;
}

type InboundPreviewRow = { item: any; qty: number };

export function AcceptReceiptModal({ isOpen, onClose, receipt }: AcceptReceiptModalProps) {
  const formatAmount = (value: number, currency: 'UZS' | 'USD' = 'UZS') =>
    new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'uz-UZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'USD' ? 2 : 0,
    }).format(Number(value || 0));

  const [isCreateWarehouseOpen, setIsCreateWarehouseOpen] = useState(false);
  const { data: receiptDetail } = useQuery({
    queryKey: ['goods-receipt', receipt?.id, 'full'],
    queryFn: () => receiptsService.getReceipt(receipt.id, { mode: 'full' }),
    enabled: isOpen && !!receipt?.id,
    staleTime: 30_000,
  });
  const activeReceipt = receiptDetail || receipt;

  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  
  const { data: warehouses } = useWarehouses();
  const { acceptReceipt, rejectReceipt, partialAcceptReceipt } = useReceiptActions();
  const acceptLockRef = useRef(false);
  const receiptBusy =
    acceptReceipt.isPending ||
    partialAcceptReceipt.isPending ||
    rejectReceipt.isPending;

  React.useEffect(() => {
    if (warehouses?.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  React.useEffect(() => {
    if (!activeReceipt?.items) return;
    setItemQuantities(
      activeReceipt.items.reduce((acc: any, item: any) => ({ ...acc, [item.id]: Number(item.quantity) }), {})
    );
  }, [activeReceipt]);

  const handleQtyChange = (itemId: string, val: string) => {
    const num = Number(val);
    const row = receiptItems.find((i: any) => i.id === itemId);
    if (!row) return;
    const originalQty = Number(row.quantity);
    if (num >= 0 && num <= originalQty) {
      setItemQuantities(prev => ({ ...prev, [itemId]: num }));
    }
  };

  const receiptItems = activeReceipt?.items ?? [];
  const isPartialShipment = Boolean(activeReceipt?.isPartialShipment);

  const duplicateMappedVariant =
    receiptItems.length > 1 &&
    receiptItems.every((i: any) => i.inboundStatus === 'EXISTING' && i.mapping) &&
    new Set(
      receiptItems.map(
        (i: any) =>
          i.mapping?.ownProductVariantId || i.mapping?.ownProductVariant?.id,
      ),
    ).size === 1;

  const isPartial = receiptItems.some(
    (item: any) => (itemQuantities[item.id] ?? 0) < Number(item.quantity),
  );

  const currentTotal = receiptItems.reduce(
    (acc: number, item: any) =>
      acc + (itemQuantities[item.id] ?? 0) * Number(item.expectedPrice || 0),
    0,
  );

  const inboundPreview: InboundPreviewRow[] = receiptItems
    .map((item: any) => ({
      item,
      qty: itemQuantities[item.id] ?? 0,
    }))
    .filter((row: InboundPreviewRow) => row.qty > 0);

  const inboundTotalQty = inboundPreview.reduce(
    (sum: number, row: InboundPreviewRow) => sum + row.qty,
    0,
  );
  const selectedWarehouseName = warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name;

  const handleAccept = async () => {
    if (acceptLockRef.current || receiptBusy) return;
    if (!selectedWarehouseId) {
      toast.error('Qabul qilish uchun omborni tanlang.');
      return;
    }
    if (inboundTotalQty <= 0) {
      toast.error('Kamida bitta mahsulot uchun qabul miqdorini kiriting.');
      return;
    }
    acceptLockRef.current = true;
    try {
      const payload = {
        id: receipt.id,
        warehouseId: selectedWarehouseId,
        items: Object.entries(itemQuantities).map(([itemId, receivedQuantity]) => ({
          itemId,
          receivedQuantity,
        })),
      };
      const result = isPartial
        ? await partialAcceptReceipt.mutateAsync(payload)
        : await acceptReceipt.mutateAsync(payload);

      const wh = result?.warehouseName || selectedWarehouseName || 'Ombor';
      const lines = result?.inbound?.length ?? inboundPreview.length;
      const qty =
        result?.inbound?.reduce((s: number, l: any) => s + Number(l.quantity || 0), 0) ??
        inboundTotalQty;
      toast.success(
        isPartial
          ? `Qisman qabul: ${wh} ga ${qty} dona kirim (${lines} ta qator).`
          : `To'liq qabul: ${wh} ga ${qty} dona kirim (${lines} ta qator).`,
      );
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(formatApiError(err, "Qabul qilishda xatolik yuz berdi. Iltimos qayta urinib ko'ring."));
    } finally {
      acceptLockRef.current = false;
    }
  };

  const handleReject = async () => {
    if (receiptBusy) return;
    if (await confirmAction("Ushbu qabulni rad etmoqchimisiz?", { variant: 'danger', confirmLabel: 'Ha, rad etish' })) {
      try {
        await rejectReceipt.mutateAsync({ id: receipt.id });
        onClose();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4">
          <CreateWarehouseModal
            isOpen={isCreateWarehouseOpen}
            onClose={() => setIsCreateWarehouseOpen(false)}
          />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !receiptBusy && onClose()} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <motion.div
            initial={{ y: '100%', scale: 1 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 1 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-t-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-[92vh] sm:h-auto sm:max-h-[90vh] p-5 sm:p-10 absolute bottom-0 sm:relative"
          >
            <div className="flex justify-between items-start mb-6 sm:mb-8 shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                  <PackageCheck size={20} className="sm:size-[28px]" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-3xl font-black mb-0.5 sm:mb-1">Yukni <span className="text-emerald-500">Qabul Qilish</span></h3>
                  <p className="text-[11px] sm:text-sm text-gray-500 font-medium truncate max-w-[220px] sm:max-w-none">Sotuvchi: <span className="text-white">{activeReceipt.sellerCompany.name}</span></p>
                </div>
              </div>
              <button type="button" disabled={receiptBusy} onClick={onClose} className="p-2 sm:p-3 hover:bg-white/5 rounded-xl sm:rounded-2xl disabled:opacity-40"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
              {isPartialShipment && (
                <div className="p-5 bg-orange-500/10 border border-orange-500/25 rounded-3xl flex gap-4">
                  <AlertCircle className="text-orange-400 shrink-0" size={24} />
                  <div>
                    <p className="text-sm font-black text-orange-300 mb-1">Qisman kelgan yuk</p>
                    <p className="text-sm text-orange-200/80 leading-relaxed">
                      Sotuvchi buyurtmadagi miqdordan kam yuborgan. Quyida{' '}
                      <span className="text-white font-bold">Buyurtma</span> va{' '}
                      <span className="text-white font-bold">Jo&apos;natilgan</span> ustunlarini
                      solishtiring. Qolgan qism keyinroq alohida jo‘natilishi mumkin.
                    </p>
                  </div>
                </div>
              )}

              {/* Warehouse Selection */}
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Warehouse size={14} className="text-blue-500" />
                  Qabul qilinadigan ombor
                </label>
                 <div className="relative">
                   <button
                     type="button"
                     onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                     className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-blue-500/50 transition-all flex items-center justify-between text-white"
                   >
                     <span className={selectedWarehouseId ? 'text-white' : 'text-gray-500'}>
                       {selectedWarehouseId 
                         ? warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name 
                         : "Omborni tanlang"}
                     </span>
                     <ChevronDown size={18} className={`text-gray-500 transition-transform ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
                   </button>

                   <AnimatePresence>
                     {isWarehouseDropdownOpen && (
                       <>
                         <div className="fixed inset-0 z-[120]" onClick={() => setIsWarehouseDropdownOpen(false)} />
                         <motion.div
                           initial={{ opacity: 0, y: 10, scale: 0.95 }}
                           animate={{ opacity: 1, y: 0, scale: 1 }}
                           exit={{ opacity: 0, y: 10, scale: 0.95 }}
                           className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[130] backdrop-blur-2xl p-1"
                         >
                           <div className="max-h-60 overflow-y-auto custom-scrollbar">
                             <button
                               type="button"
                               onClick={() => { setSelectedWarehouseId(''); setIsWarehouseDropdownOpen(false); }}
                               className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${!selectedWarehouseId ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                             >
                               Omborni tanlang
                             </button>
                             {warehouses?.map((w: any) => (
                               <button
                                 key={w.id}
                                 type="button"
                                 onClick={() => { setSelectedWarehouseId(w.id); setIsWarehouseDropdownOpen(false); }}
                                 className={`w-full text-left px-5 py-4 rounded-xl text-sm font-bold transition-all ${selectedWarehouseId === w.id ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                               >
                                 <div className="flex flex-col">
                                   <span>{w.name}</span>
                                   <span className={`text-[10px] ${selectedWarehouseId === w.id ? 'text-emerald-100' : 'text-gray-500'}`}>{w.address}</span>
                                 </div>
                               </button>
                             ))}
                           </div>
                         </motion.div>
                       </>
                     )}
                   </AnimatePresence>
                 </div>
                {warehouses?.length === 0 && (
                  <p className="text-xs text-amber-400 font-semibold">
                    Faol ombor topilmadi. Avval ombor yarating.
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCreateWarehouseOpen(true)}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    + Yangi ombor yaratish
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <h4 className="text-xl font-black flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                  Mahsulotlar ro'yxati
                </h4>
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-hidden rounded-3xl border border-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <th className="px-6 py-4">Mahsulot</th>
                        {isPartialShipment && (
                          <th className="px-6 py-4 text-center">Buyurtma</th>
                        )}
                        <th className="px-6 py-4 text-center">Jo&apos;natilgan</th>
                        <th className="px-6 py-4 text-center">Qabul (qo&apos;lda)</th>
                        <th className="px-6 py-4 text-center">Omborga</th>
                        <th className="px-6 py-4 text-right">Summa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {receiptItems.map((item: any) => (
                        <tr key={item.id} className="group text-sm">
                          <td className="px-6 py-4 font-bold">
                            {displayOrderProductSnapshot(item.productNameSnapshot)}
                          </td>
                          {isPartialShipment && (
                            <td className="px-6 py-4 text-center font-black text-gray-500">
                              {item.orderedQuantity ?? '—'}
                            </td>
                          )}
                          <td
                            className={`px-6 py-4 text-center font-black ${
                              item.isPartialLine ? 'text-orange-400' : 'text-gray-500'
                            }`}
                          >
                            {item.shippedQuantity ?? item.quantity}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input 
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={itemQuantities[item.id]}
                              onChange={(e) => handleQtyChange(item.id, e.target.value)}
                              className="w-20 bg-white/10 border border-white/10 rounded-lg py-1 px-2 text-center font-black focus:border-emerald-500/50 outline-none transition-all"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.inboundStatus === 'EXISTING' || item.mapping ? (
                              <span className="text-emerald-400 font-bold uppercase text-[10px]">
                                Mavjud
                              </span>
                            ) : (
                              <span className="text-amber-400 font-bold uppercase text-[10px]">
                                Yangi (avtomatik)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-blue-400">
                            {formatAmount(
                              itemQuantities[item.id] * Number(item.expectedPrice || 0),
                              (item.expectedCurrency || 'UZS') as 'UZS' | 'USD',
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View List */}
                <div className="block md:hidden space-y-3">
                  {receiptItems.map((item: any) => {
                    const itemQty = itemQuantities[item.id] ?? 0;
                    const maxQty = Number(item.shippedQuantity ?? item.quantity) || 0;
                    const unitPrice = Number(item.expectedPrice || 0);
                    const cur = (item.expectedCurrency || 'UZS') as 'UZS' | 'USD';
                    const isExisting = item.inboundStatus === 'EXISTING' || item.mapping;
                    
                    return (
                      <div key={item.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center text-gray-300 font-extrabold text-xs shrink-0 select-none">
                            {displayOrderProductSnapshot(item.productNameSnapshot).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-white leading-tight">
                              {displayOrderProductSnapshot(item.productNameSnapshot)}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                Jo&apos;natilgan: {maxQty}
                              </span>
                              {isPartialShipment && item.orderedQuantity != null && (
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                  Buyurtma: {item.orderedQuantity}
                                </span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isExisting ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {isExisting ? 'Mavjud' : 'Yangi'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                          {/* Reactive Tap Stepper */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setItemQuantities(prev => {
                                  const curQty = prev[item.id] ?? 0;
                                  if (curQty <= 0) return prev;
                                  return { ...prev, [item.id]: curQty - 1 };
                                });
                              }}
                              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center font-black transition-all shrink-0"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-6 text-center text-xs font-black text-white shrink-0 select-none">
                              {itemQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setItemQuantities(prev => {
                                  const curQty = prev[item.id] ?? 0;
                                  if (curQty >= maxQty) return prev;
                                  return { ...prev, [item.id]: curQty + 1 };
                                });
                              }}
                              className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white flex items-center justify-center font-black transition-all shrink-0"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Summa</p>
                            <p className="font-black text-xs text-blue-400">
                              {formatAmount(itemQty * unitPrice, cur)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedWarehouseId && inboundPreview.length > 0 && (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/25 rounded-3xl space-y-4">
                  <p className="text-sm font-black text-emerald-300 flex items-center gap-2">
                    <Warehouse size={16} />
                    Omborga kirim (tasdiqlashdan oldin)
                  </p>
                  <p className="text-xs text-emerald-200/80">
                    <span className="font-bold text-white">{selectedWarehouseName}</span> omboriga
                    quyidagi mahsulotlar <span className="font-bold">+{inboundTotalQty} dona</span>{' '}
                    kiradi:
                  </p>
                  <ul className="space-y-2 text-xs max-h-40 overflow-y-auto custom-scrollbar">
                    {inboundPreview.map(({ item, qty }) => (
                      <li
                        key={item.id}
                        className="flex justify-between gap-3 py-2 px-3 rounded-xl bg-black/20 border border-white/5"
                      >
                        <span className="font-bold text-white truncate">
                          {displayOrderProductSnapshot(item.productNameSnapshot)}
                        </span>
                        <span className="shrink-0 font-black text-emerald-400">
                          +{qty}{' '}
                          <span className="text-[9px] text-gray-500 uppercase">
                            {item.inboundStatus === 'EXISTING' || item.mapping ? 'mavjud' : 'yangi'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {duplicateMappedVariant && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3">
                  <AlertCircle className="text-amber-400 shrink-0" size={20} />
                  <p className="text-sm text-amber-200/90">
                    Diqqat: barcha qatorlar bitta ombor variantiga bog‘langan. Har bir rang uchun alohida
                    mapping tekshiring (Mahsulot mapping).
                  </p>
                </div>
              )}

              {/* Warning box */}
              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl flex gap-4">
                 <AlertCircle className="text-blue-400 shrink-0" size={24} />
                 <p className="text-sm text-gray-400 leading-relaxed">
                   Tasdiqlanganda mahsulotlar avval tanlangan omborga kirim qilinadi (IN harakati),
                   keyin qarzdorlik yoziladi. Birinchi qabulda katalog yangilanadi; keyingi
                   qabulda (qisman yuk) mavjud mapping ishlatiladi.
                   Sotuvchi foydasiga 
                   <span className="text-white font-bold">
                    {' '}
                    {formatAmount(currentTotal, (activeReceipt.items?.[0]?.expectedCurrency || 'UZS') as 'UZS' | 'USD')}{' '}
                   </span> 
                   miqdorida qarzdorlik yoziladi.
                 </p>
              </div>
            </div>

            <div className="pt-4 sm:pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 shrink-0">
              <div className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start w-full sm:w-auto gap-2">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest sm:mb-1">Jami Summa</p>
                <p className="text-xl sm:text-3xl font-black text-white">
                  {formatAmount(currentTotal, (activeReceipt.items?.[0]?.expectedCurrency || 'UZS') as 'UZS' | 'USD')}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <button type="button" disabled={receiptBusy} onClick={handleReject} className="flex-1 sm:px-8 py-3.5 sm:py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-red-400 hover:bg-red-500/10 transition-all text-xs disabled:opacity-40">Rad etish</button>
                <button 
                  type="button"
                  onClick={handleAccept}
                  disabled={!selectedWarehouseId || receiptBusy || inboundTotalQty <= 0}
                  className={`flex-[2] sm:px-12 py-3.5 sm:py-4 ${isPartial ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 text-xs disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {receiptBusy ? <Loader2 size={16} className="animate-spin" /> : (
                    <>
                      {isPartial ? 'Qisman Qabul' : "To'liq Qabul"} 
                      <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
