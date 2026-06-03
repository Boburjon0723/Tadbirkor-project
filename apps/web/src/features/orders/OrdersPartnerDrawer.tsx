'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, FileText, X } from 'lucide-react';
import {
  formatOrdersGroupTotalLabel,
  getDispatchedOrderTotal,
  getOrderStatusStyle,
  getOrderTotal,
  orderDisplayId,
  orderItemsCount,
  orderStatusLabelUz,
  type PartnerOrderGroup,
} from './orders-utils';
import { OrderRowActions } from './OrderRowActions';

type Props = {
  group: PartnerOrderGroup | null;
  activeTab: 'my' | 'incoming';
  onClose: () => void;
  onSelectOrder: (order: any) => void;
  onReject: (id: string) => void;
  onAccept: (id: string) => void;
  onDispatch: (order: any) => void;
  onEdit: (order: any) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onPrintInvoice: (order: any) => void;
  onExportPdf: (order: any) => void;
  onExportExcel: (order: any) => void;
};

export function OrdersPartnerDrawer({
  group,
  activeTab,
  onClose,
  onSelectOrder,
  onReject,
  onAccept,
  onDispatch,
  onEdit,
  onCancel,
  onDelete,
  onPrintInvoice,
  onExportPdf,
  onExportExcel,
}: Props) {
  return (
    <AnimatePresence>
      {group && (
        <div className="fixed inset-0 z-[115] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative w-full max-w-lg md:max-w-2xl bg-[#0c0c0e]/95 border-l border-white/10 shadow-2xl backdrop-blur-3xl h-full flex flex-col"
          >
            <div className="p-6 md:p-8 border-b border-white/5 flex items-start justify-between shrink-0">
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Building2 size={10} />
                  {activeTab === 'my' ? 'Chiquvchi buyurtmalar' : 'Kiruvchi buyurtmalar'}
                </p>
                <h3 className="text-2xl font-black text-white">{group.partner.name}</h3>
                {group.partner.tin && (
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">
                    STIR: {group.partner.tin}
                  </p>
                )}
                <p className="text-gray-500 text-xs mt-2">{group.orderCount} ta buyurtma</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6">
              <div className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                  Jami summa (barcha buyurtmalar)
                </p>
                <p className="font-black text-blue-400 text-lg mt-1">
                  {formatOrdersGroupTotalLabel(group.orders)}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Buyurtmalar ro&apos;yxati
                </p>
                {group.orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-white/10 transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order)}
                        className="text-left"
                      >
                        <p className="text-sm font-black text-white flex items-center gap-2">
                          {orderDisplayId(order.id)}
                          {order.note && <FileText size={12} className="text-blue-500/50" />}
                        </p>
                        <p className="text-[9px] text-gray-500 font-bold mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString('uz-UZ', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          · {orderItemsCount(order)} xil mahsulot
                        </p>
                      </button>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getOrderStatusStyle(order.status)}`}
                      >
                        {orderStatusLabelUz(order.status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] text-gray-500 font-black uppercase">Summa</p>
                        {order.isPartialDispatch ? (
                          <>
                            <p className="font-black text-amber-400 text-sm">
                              {getDispatchedOrderTotal(order).label}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              buyurtma {getOrderTotal(order).label}
                            </p>
                          </>
                        ) : (
                          <p className="font-black text-blue-400 text-sm">
                            {getOrderTotal(order).label}
                          </p>
                        )}
                      </div>
                      <OrderRowActions
                        activeTab={activeTab}
                        order={order}
                        variant="mobile"
                        onOpenDetails={() => onSelectOrder(order)}
                        onReject={() => onReject(order.id)}
                        onAccept={() => onAccept(order.id)}
                        onDispatch={() => onDispatch(order)}
                        onEdit={() => onEdit(order)}
                        onCancel={() => onCancel(order.id)}
                        onDelete={() => onDelete(order.id)}
                        onPrintInvoice={() => onPrintInvoice(order)}
                        onExportPdf={() => onExportPdf(order)}
                        onExportExcel={() => onExportExcel(order)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
