'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Warehouse, Package, Loader2, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBatchStockAvailability, useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { useDispatchActions } from '@/hooks/logistics/use-logistics';
import { ordersService } from '@/services/orders.service';
import { displayB2BOrderLineItem } from '@/lib/order-product-label';
import { orderLineRemainingQty, orderLineDispatchedQty, orderLineOrderedQty } from '@/features/orders/orders-utils';

interface CreateDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function CreateDispatchModal({ isOpen, onClose, order }: CreateDispatchModalProps) {
  const router = useRouter();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: warehouses } = useWarehouses();
  const { createDispatch } = useDispatchActions();
  const submitLockRef = useRef(false);
  const isSubmitting = createDispatch.isPending;

  const { data: orderDetail, isLoading: orderDetailLoading } = useQuery({
    queryKey: ['b2b-order-detail', order?.id],
    queryFn: () => ordersService.getOrderDetail(order.id),
    enabled: isOpen && !!order?.id,
    staleTime: 30_000,
  });
  const activeOrder = orderDetail ?? order;
  const orderItems = activeOrder?.items ?? [];
  const [shipQuantities, setShipQuantities] = useState<Record<string, number>>({});
  const variantIds = React.useMemo(
    () => Array.from(
      new Set(
        orderItems
          .map((item: any) => item.productVariantId)
          .filter(Boolean),
      ),
    ) as string[],
    [orderItems],
  );
  const {
    data: availability = [],
    refetch: refetchAvailability,
  } = useBatchStockAvailability(
    { warehouseId: selectedWarehouseId, variantIds },
    { enabled: isOpen && Boolean(selectedWarehouseId) && variantIds.length > 0 },
  );

  React.useEffect(() => {
    if (isOpen && selectedWarehouseId && variantIds.length > 0) {
      void refetchAvailability();
    }
  }, [isOpen, selectedWarehouseId, variantIds.length, refetchAvailability]);

  React.useEffect(() => {
    if (warehouses?.length === 1 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  React.useEffect(() => {
    if (!orderItems.length) return;
    setShipQuantities(
      orderItems.reduce((acc: Record<string, number>, item: any) => {
        const remaining = orderLineRemainingQty(item);
        return { ...acc, [item.id]: remaining > 0 ? remaining : 0 };
      }, {}),
    );
  }, [orderItems, activeOrder?.id]);

  const handleShipQtyChange = (orderItemId: string, val: string) => {
    const num = Number(val);
    const row = orderItems.find((i: any) => i.id === orderItemId);
    if (!row || !Number.isFinite(num)) return;
    const max = orderLineRemainingQty(row);
    if (num >= 0 && num <= max) {
      setShipQuantities((prev) => ({ ...prev, [orderItemId]: num }));
    }
  };

  const selectedWarehouse = warehouses?.find((w: any) => w.id === selectedWarehouseId);
  /** `fieldConfig.showTotalStock === false` — zaxira ustuni o‘chirilgan ombor: jo‘natma zaxirasiz ham tasdiqlanadi. */
  const skipStockGuard =
    Boolean(selectedWarehouse && selectedWarehouse.fieldConfig?.showTotalStock === false);

  const orderUsesReservation = ['ACCEPTED', 'PARTIAL_ACCEPTED', 'PARTIALLY_DISPATCHED'].includes(
    String(activeOrder?.status || ''),
  );

  const getStockStatus = (variantId: string, requestedQty: number) => {
    if (!selectedWarehouseId) {
      return {
        ok: false,
        stock: 0,
        free: 0,
        reserved: 0,
        blocked: 0,
        dispatchable: 0,
        productionMode: false,
      };
    }
    const stockItem = availability?.find((b: any) => b.productVariantId === variantId);
    const stock = stockItem ? Number(stockItem.onHand) : 0;
    const free = stockItem ? Number(stockItem.free) : 0;
    const reserved = stockItem ? Number(stockItem.reserved) : 0;
    const blocked = stockItem ? Number(stockItem.blocked) : 0;
    /** Qabul qilingan buyurtmada rezerv allaqachon shu buyurtmaga — jo‘natishda Jami − Blok yetarli */
    const dispatchable = Math.max(0, stock - blocked);
    const availableForShip = orderUsesReservation ? dispatchable : free;
    if (skipStockGuard) {
      return {
        ok: true,
        stock,
        free,
        reserved,
        blocked,
        dispatchable: availableForShip,
        productionMode: true,
      };
    }
    return {
      ok: availableForShip >= requestedQty,
      stock,
      free,
      reserved,
      blocked,
      dispatchable: availableForShip,
      productionMode: false,
    };
  };

  const handleCreateDraft = async () => {
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setSubmitError(null);
    try {
      const items = Object.entries(shipQuantities)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity: Number(quantity) }))
        .filter((row) => row.quantity > 0);

      if (items.length === 0) {
        setSubmitError('Kamida bitta mahsulot uchun jo‘natma miqdorini kiriting.');
        submitLockRef.current = false;
        return;
      }

      if (!selectedWarehouseId) {
        setSubmitError('Jo‘natish uchun omborni tanlang.');
        submitLockRef.current = false;
        return;
      }

      if (!skipStockGuard) {
        const shortages: string[] = [];
        for (const item of orderItems) {
          const qty = shipQuantities[item.id] ?? 0;
          if (qty <= 0) continue;
          const status = getStockStatus(item.productVariantId, qty);
          if (!status.ok) {
            const line = displayB2BOrderLineItem(item);
            shortages.push(`${line.title}: kerak ${qty}, mavjud ${status.dispatchable}`);
          }
        }
        if (shortages.length) {
          setSubmitError(`Omborda yetarli qoldiq yo'q — ${shortages.join('; ')}`);
          submitLockRef.current = false;
          return;
        }
      }

      const dispatch = await createDispatch.mutateAsync({
        orderId: activeOrder.id,
        warehouseId: selectedWarehouseId,
        items,
      });
      onClose();
      if (dispatch?.id) {
        router.push(`/dashboard/picking/dispatch/${dispatch.id}`);
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Jo‘natmani yaratish yoki yuborishda xatolik yuz berdi';
      setSubmitError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      submitLockRef.current = false;
    }
  };

  const linesToShip = orderItems.filter(
    (item: any) => (shipQuantities[item.id] ?? 0) > 0,
  );

  const allItemsAvailable =
    !!selectedWarehouseId &&
    linesToShip.length > 0 &&
    (skipStockGuard ||
      linesToShip.every((item: any) =>
        getStockStatus(item.productVariantId, shipQuantities[item.id] ?? 0).ok,
      ));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="desktop-modal-panel max-w-3xl lg:max-w-4xl p-4 md:p-6">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <Truck size={28} />
                </div>
                <div>
                  <h3 className="text-3xl font-black mb-1">
                    {activeOrder?.isPartialDispatch || activeOrder?.status === 'PARTIALLY_DISPATCHED'
                      ? <>Qolganini <span className="text-amber-500">Jo&apos;natish</span></>
                      : <>Jo&apos;natma <span className="text-amber-500">Yaratish</span></>}
                  </h3>
                  <p className="text-gray-500 font-medium">Buyurtma: <span className="text-white">ORD-{order.id.slice(0, 8).toUpperCase()}</span></p>
                </div>
              </div>
              <button type="button" disabled={isSubmitting} onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl disabled:opacity-40"><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
              {/* Warehouse Selection */}
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Warehouse size={14} className="text-blue-500" />
                  Yuk jo'natiladigan ombor
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
                               className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${!selectedWarehouseId ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                             >
                               Omborni tanlang
                             </button>
                             {warehouses?.map((w: any) => (
                               <button
                                 key={w.id}
                                 type="button"
                                 onClick={() => { setSelectedWarehouseId(w.id); setIsWarehouseDropdownOpen(false); }}
                                 className={`w-full text-left px-5 py-4 rounded-xl text-sm font-bold transition-all ${selectedWarehouseId === w.id ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                               >
                                 <div className="flex flex-col">
                                   <span>{w.name}</span>
                                   <span className={`text-[10px] ${selectedWarehouseId === w.id ? 'text-amber-100' : 'text-gray-500'}`}>{w.address}</span>
                                 </div>
                               </button>
                             ))}
                           </div>
                         </motion.div>
                       </>
                     )}
                   </AnimatePresence>
                 </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <h4 className="text-xl font-black flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                  Mahsulotlar va qoldiqlar
                </h4>
                <div className="overflow-hidden rounded-3xl border border-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <th className="px-6 py-4">Mahsulot</th>
                        <th className="px-6 py-4 text-center">Buyurtma</th>
                        {(activeOrder?.isPartialDispatch || activeOrder?.hasDispatch) && (
                          <th className="px-6 py-4 text-center">Jo&apos;natilgan</th>
                        )}
                        <th className="px-6 py-4 text-center">Qolgan</th>
                        <th className="px-6 py-4 text-center">Jo‘natiladi</th>
                        <th className="px-6 py-4 text-center">ATP qoldiq</th>
                        <th className="px-6 py-4 text-right">Holat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {orderDetailLoading && orderItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <Loader2 className="animate-spin text-amber-500 mx-auto" size={28} />
                          </td>
                        </tr>
                      ) : null}
                      {orderItems.map((item: any) => {
                        const ordered = orderLineOrderedQty(item);
                        const dispatched = orderLineDispatchedQty(item);
                        const remaining = orderLineRemainingQty(item);
                        const shipQty = shipQuantities[item.id] ?? remaining;
                        const status = getStockStatus(item.productVariantId, shipQty);
                        const line = displayB2BOrderLineItem(item);
                        const skipped = shipQty <= 0 || remaining <= 0;
                        const showDispatchedCol =
                          activeOrder?.isPartialDispatch || activeOrder?.hasDispatch;
                        return (
                          <tr key={item.id} className={`group ${skipped ? 'opacity-50' : ''}`}>
                            <td className="px-6 py-4">
                              <p className="font-bold">{line.title}</p>
                              <p className="text-[10px] text-gray-500 font-bold uppercase">
                                SKU: {line.sku || '---'}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-center font-black text-gray-500">
                              {ordered}
                            </td>
                            {showDispatchedCol && (
                              <td className="px-6 py-4 text-center font-black text-amber-400/80">
                                {dispatched}
                              </td>
                            )}
                            <td className="px-6 py-4 text-center font-black text-white">
                              {remaining}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <input
                                type="number"
                                min={0}
                                max={remaining}
                                disabled={remaining <= 0}
                                value={shipQuantities[item.id] ?? 0}
                                onChange={(e) => handleShipQtyChange(item.id, e.target.value)}
                                className="w-20 bg-white/10 border border-white/10 rounded-lg py-1 px-2 text-center font-black focus:border-amber-500/50 outline-none transition-all"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              {!selectedWarehouseId ? (
                                <span className="text-gray-600 italic">Ombor tanlanmagan</span>
                              ) : (
                                <div className="space-y-1">
                                  <span className={`block font-black ${status.ok ? 'text-white' : 'text-red-400'}`}>
                                    {status.dispatchable}
                                  </span>
                                  <span className="block text-[10px] font-bold text-gray-500">
                                    Jami {status.stock} · Rezerv {status.reserved} · Erkin {status.free}
                                    {status.blocked > 0 ? ` · Blok ${status.blocked}` : ''}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {!selectedWarehouseId ? (
                                <span className="w-2 h-2 rounded-full bg-gray-700 inline-block" />
                              ) : status.productionMode ? (
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 rounded-full text-[10px] font-black uppercase">
                                  <CheckCircle2 size={10} /> Ishlab chiqarish
                                </span>
                              ) : status.ok ? (
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase">
                                  <CheckCircle2 size={10} /> Yetarli
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] font-black uppercase">
                                  <AlertCircle size={10} /> Yetarli emas
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {submitError ? (
              <motion.div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-sm font-bold">
                {submitError}
              </motion.div>
            ) : null}

            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                 <AlertCircle size={20} className={allItemsAvailable ? 'text-blue-400' : 'text-red-400'} />
                 <p className={`text-sm font-bold ${allItemsAvailable ? 'text-gray-400' : 'text-red-400'}`}>
                   {allItemsAvailable
                    ? skipStockGuard
                      ? "Bu omborda umumiy zaxira nazorati o‘chirilgan — jo‘natma zaxirasiz ham tasdiqlanadi (ishlab chiqarish rejimi). 0 qator — jo‘natilmaydi."
                      : "Jo‘natma yaratiladi — keyin saralash (picking) va PGI yuborish."
                    : linesToShip.length === 0
                      ? "Kamida bitta mahsulot uchun miqdor kiriting."
                      : activeOrder?.isPartialDispatch
                        ? "Qolgan miqdor uchun omborda yetarli zaxira yo'q — jo'natish bloklangan."
                        : "Zaxira yetarli emasligi sababli jo'natish bloklangan."}
                 </p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <button type="button" disabled={isSubmitting} onClick={onClose} className="btn-dash-secondary flex-1 text-gray-400">Bekor qilish</button>
                <button 
                  type="button"
                  onClick={handleCreateDraft}
                  disabled={!selectedWarehouseId || !allItemsAvailable || isSubmitting}
                  className="btn-dash flex-[2] bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 justify-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : (
                    <>Saralashga o&apos;tish <ArrowRight size={20} /></>
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
