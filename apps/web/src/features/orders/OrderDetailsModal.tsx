'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  Truck,
} from 'lucide-react';
import { invoicesService } from '@/services/invoices.service';
import {
  getOrderTotal,
  getDispatchedOrderTotal,
  getOrderStatusStyle,
  orderStatusLabelUz,
  orderDisplayId,
  orderHasDispatchInfo,
  orderCanDispatchMore,
  orderCanCloseRemainder,
  formatOrderAmountSummary,
} from './orders-utils';
import { OrderItemsTable } from './OrderItemsTable';
import { OrderMappingSection } from './OrderMappingSection';

type Props = {
  isOpen: boolean;
  order: any | null;
  isLoadingDetail?: boolean;
  activeTab: 'my' | 'incoming';
  ownProducts: any[] | undefined;
  mappingSelections: Record<string, string>;
  mappingPrices: Record<string, string>;
  mappingCurrencies: Record<string, 'UZS' | 'USD'>;
  onClose: () => void;
  onMappingSelect: (itemId: string, variantId: string, variant?: any) => void;
  onMappingPrice: (itemId: string, value: string) => void;
  onMappingCurrency: (itemId: string, currency: 'UZS' | 'USD') => void;
  onMapItem: (orderId: string, itemId: string) => void;
  onAction: (action: 'accept' | 'acceptPartial' | 'reject' | 'send' | 'cancel' | 'delete', id: string) => void;
  onOpenDispatch: (order: any) => void;
  onCloseRemainder?: (orderId: string) => void;
};

export function OrderDetailsModal({
  isOpen,
  order,
  isLoadingDetail = false,
  activeTab,
  ownProducts,
  mappingSelections,
  mappingPrices,
  mappingCurrencies,
  onClose,
  onMappingSelect,
  onMappingPrice,
  onMappingCurrency,
  onMapItem,
  onAction,
  onOpenDispatch,
  onCloseRemainder,
}: Props) {
  const showDispatchQty = orderHasDispatchInfo(order);

  return (
    <AnimatePresence>
      {isOpen && order && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="relative w-full max-w-4xl glass-card rounded-t-[2.5rem] md:rounded-[3rem] p-6 md:p-10 bg-[#0a0a0a] border-white/10 shadow-2xl flex flex-col h-full md:h-auto max-h-[100vh] md:max-h-[90vh]"
          >
            <div className="flex justify-between items-start mb-6 md:mb-8">
              <div>
                <h3 className="text-xl md:text-3xl font-black mb-1">
                  Buyurtma <span className="text-blue-500">Tafsilotlari</span>
                </h3>
                <p className="text-xs md:text-gray-500">
                  Hamkor:{' '}
                  <span className="text-white font-bold">
                    {activeTab === 'my' ? order.seller?.name : order.buyer?.name}
                  </span>
                </p>
              </div>
              <button type="button" onClick={onClose} className="p-2 md:p-3 hover:bg-white/5 rounded-2xl text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                    Buyurtma №
                  </p>
                  <p className="text-xl font-black text-white">{orderDisplayId(order.id)}</p>
                </div>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Status</p>
                  <span
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getOrderStatusStyle(order.status)}`}
                  >
                    {orderStatusLabelUz(order.status)}
                  </span>
                </div>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Sana</p>
                  <p className="text-xl font-black text-white">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {order.note && (
                <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-[2rem] space-y-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <FileText size={16} />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Buyurtma izohi</p>
                  </div>
                  <p className="text-gray-200 font-medium leading-relaxed italic text-sm pl-6">
                    &quot;{order.note}&quot;
                  </p>
                </div>
              )}

              {showDispatchQty && order.isPartialDispatch && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-sm text-amber-200/90">
                  Qisman jo‘natma: buyurtmadagi miqdordan kam yuborilgan. Quyida{' '}
                  <span className="font-bold text-white">Buyurtma</span> va{' '}
                  <span className="font-bold text-white">Jo‘natilgan</span> ustunlarini solishtiring.
                  {order.latestDispatch?.dispatchNumber ? (
                    <span className="block mt-1 text-xs text-amber-300/80">
                      Jo‘natma: {order.latestDispatch.dispatchNumber}
                    </span>
                  ) : null}
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-xl font-black flex items-center gap-3 text-white">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  Mahsulotlar ro&apos;yxati
                  {(order.itemCount ?? order.items?.length) ? (
                    <span className="text-sm font-bold text-gray-500">
                      ({order.itemCount ?? order.items?.length})
                    </span>
                  ) : null}
                </h4>
                {order.itemsPaginated && (
                  <p className="text-xs text-amber-400/90 font-bold">
                    Ko‘p qatorli buyurtma — mahsulotlar 50 tadan sahifalab yuklanadi (qidiruv mavjud).
                  </p>
                )}
                <OrderItemsTable
                  orderId={order.id}
                  items={order.items}
                  itemsPaginated={order.itemsPaginated}
                  itemCount={order.itemCount}
                  activeTab={activeTab}
                  isLoadingDetail={isLoadingDetail}
                  showDispatchQty={showDispatchQty}
                />

                {activeTab === 'incoming' && (
                  <OrderMappingSection
                    orderId={order.id}
                    order={order}
                    ownProducts={ownProducts}
                    mappingSelections={mappingSelections}
                    mappingPrices={mappingPrices}
                    mappingCurrencies={mappingCurrencies}
                    onMappingSelect={onMappingSelect}
                    onMappingPrice={onMappingPrice}
                    onMappingCurrency={onMappingCurrency}
                    onMapItem={onMapItem}
                  />
                )}
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                {showDispatchQty && order.isPartialDispatch ? (
                  <>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                      Jo&apos;natilgan summa
                    </p>
                    <p className="text-3xl font-black text-amber-400">
                      {getDispatchedOrderTotal(order).label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Buyurtma bo‘yicha: {getOrderTotal(order).label}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                      Umumiy summa
                    </p>
                    <p className="text-3xl font-black text-white">
                      {order.itemsPaginated && order.amountSummary
                        ? formatOrderAmountSummary(order.amountSummary)
                        : getOrderTotal(order).label}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => void invoicesService.exportOrderPdf(order.id)}
                  className="flex-1 md:flex-none px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-blue-400 hover:bg-blue-600/10 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={18} />
                  PDF yuklash
                </button>
                <button
                  type="button"
                  onClick={() => void invoicesService.printInvoice(order)}
                  className="flex-1 md:flex-none px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-indigo-400 hover:bg-indigo-600/10 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={18} />
                  Invoice chop etish
                </button>
                <button
                  type="button"
                  onClick={() => void invoicesService.exportOrderExcel(order.id)}
                  className="flex-1 md:flex-none px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-emerald-400 hover:bg-emerald-600/10 transition-all flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet size={18} />
                  Excel ga eksport
                </button>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  {activeTab === 'incoming' &&
                    (order.status === 'SENT' || order.status === 'DRAFT') && (
                      <>
                        <button
                          type="button"
                          onClick={() => onAction('reject', order.id)}
                          className="flex-1 md:px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          Rad etish
                        </button>
                        <button
                          type="button"
                          onClick={() => onAction('acceptPartial', order.id)}
                          className="flex-1 md:px-6 py-4 bg-amber-600/20 border border-amber-500/30 rounded-2xl font-black text-amber-400 hover:bg-amber-600/30 transition-all text-sm"
                        >
                          Qisman
                        </button>
                        <button
                          type="button"
                          onClick={() => onAction('accept', order.id)}
                          className="flex-[2] md:px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-3"
                        >
                          To&apos;liq qabul <ArrowDownLeft size={20} />
                        </button>
                      </>
                    )}
                  {activeTab === 'my' && order.status === 'DRAFT' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onAction('delete', order.id)}
                        className="flex-1 md:px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        O&apos;chirish
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction('cancel', order.id)}
                        className="flex-1 md:px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        Bekor qilish
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction('send', order.id)}
                        className="flex-[2] md:px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all"
                      >
                        Yuborish <ArrowUpRight size={20} />
                      </button>
                    </>
                  )}
                  {activeTab === 'incoming' && orderCanDispatchMore(order) && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDispatch(order);
                        onClose();
                      }}
                      className="flex-[2] md:px-10 py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-3"
                    >
                      {order.isPartialDispatch || order.status === 'PARTIALLY_DISPATCHED'
                        ? "Qolganini jo'natish"
                        : "Jo'natma yaratish"}{' '}
                      <Truck size={20} />
                    </button>
                  )}
                  {orderCanCloseRemainder(order) && onCloseRemainder && (
                    <button
                      type="button"
                      onClick={() => onCloseRemainder(order.id)}
                      className="flex-1 md:px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-orange-300 hover:bg-orange-500/10 transition-all"
                    >
                      {activeTab === 'my'
                        ? "Qolganini kutmayman"
                        : "Qolganini jo'natmaslik"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
