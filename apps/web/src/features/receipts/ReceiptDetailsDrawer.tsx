'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  FileText,
  FileSpreadsheet,
  Printer,
  Building2,
  PackageCheck,
  Loader2,
  ArrowRight,
  AlertCircle,
  Search,
} from 'lucide-react';
import { receiptsService } from '@/services/receipts.service';
import { displayOrderProductSnapshot } from '@/lib/order-product-label';
import {
  formatReceiptTotal,
  orderDisplayId,
  printReceiptDocument,
  receiptDisplayId,
  receiptDisplayStatusLabel,
  receiptStatusBadgeStyle,
} from './receipt-export';
import { formatSaleAmount, normalizeSaleCurrency } from '@/lib/currency';
import { useSession } from '@/hooks/use-session';
import { isWarehouseReceiptsOpsRole } from '@/lib/warehouse-receipts-view';

const RECEIPT_ITEMS_PAGE = 50;

type Props = {
  receipt: any | null;
  onClose: () => void;
  onAccept?: (receipt: any) => void;
};

export function ReceiptDetailsDrawer({ receipt, onClose, onAccept }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: session } = useSession();
  const warehouseOps = isWarehouseReceiptsOpsRole(session?.role);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['goods-receipt', receipt?.id, 'view'],
    queryFn: ({ pageParam = 1 }) =>
      receiptsService.getReceipt(receipt!.id, {
        mode: 'view',
        page: pageParam,
        limit: RECEIPT_ITEMS_PAGE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const meta = last?.itemsPaginated;
      if (meta?.hasMore) return meta.page + 1;
      return undefined;
    },
    enabled: !!receipt?.id,
    staleTime: 60_000,
  });

  const detail = data?.pages[0];
  const allItems = useMemo(
    () => data?.pages.flatMap((p) => p.items ?? []) ?? [],
    [data?.pages],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item: any) =>
      String(item.productNameSnapshot || '').toLowerCase().includes(q),
    );
  }, [allItems, search]);

  const active = detail ? { ...receipt, ...detail, items: allItems } : receipt;
  const resolvedStatus = detail?.status ?? receipt?.status;
  const canAccept = resolvedStatus === 'PENDING';
  const totalItemCount = detail?.itemsPaginated?.total ?? allItems.length;

  useEffect(() => {
    if (detail && receipt && detail.status !== receipt.status) {
      void queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
    }
  }, [detail, receipt, queryClient]);

  useEffect(() => {
    if (!receipt?.id) setSearch('');
  }, [receipt?.id]);

  return (
    <AnimatePresence>
      {receipt && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 z-[110] w-full max-w-lg bg-[#0a0a0a] border-l border-white/10 shadow-2xl flex flex-col"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 border-b border-white/5 flex items-start justify-between gap-4"
            >
              <motion.div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">
                  Yuk tafsilotlari
                </p>
                <h2 className="text-2xl font-black text-white">{receiptDisplayId(active?.id || receipt.id)}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Buyurtma:{' '}
                  <span className="text-white font-bold">
                    {orderDisplayId(active?.orderId || receipt.orderId)}
                  </span>
                </p>
              </motion.div>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"
              >
                <X size={20} />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
            >
              {isLoading && !detail ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
              ) : (
                <>
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                    <motion.div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-black uppercase">Sotuvchi</p>
                        <p className="font-bold text-white">{active?.sellerCompany?.name}</p>
                        {!warehouseOps && (
                          <p className="text-xs text-gray-500">STIR: {active?.sellerCompany?.tin || '—'}</p>
                        )}
                      </div>
                    </motion.div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${receiptStatusBadgeStyle(active || {})}`}
                      >
                        {receiptDisplayStatusLabel(active || {})}
                      </span>
                      {active?.isPartialShipment && (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-orange-500/15 text-orange-300 border border-orange-500/20">
                          Qisman kelgan
                        </span>
                      )}
                      {(active?.status === 'PARTIALLY_ACCEPTED' || active?.isPartialAcceptance) && (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-blue-500/15 text-blue-300 border border-blue-500/20">
                          Qisman qabul
                        </span>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(active?.createdAt).toLocaleString('uz-UZ')}
                      </p>
                    </div>
                  </div>

                  {active?.isPartialShipment && active?.status === 'PENDING' && (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex gap-3">
                      <AlertCircle className="text-orange-400 shrink-0" size={18} />
                      <p className="text-xs text-orange-200/90 leading-relaxed">
                        <span className="font-black text-orange-300">Qisman kelgan yuk.</span>{' '}
                        Buyurtmadan kam miqdor yuborilgan — qolgani keyinroq kelishi mumkin.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <PackageCheck size={16} className="text-emerald-500" />
                        Mahsulotlar
                        <span className="text-gray-500 font-bold text-xs">({totalItemCount})</span>
                      </h3>
                    </div>
                    {totalItemCount > 20 && (
                      <motion.div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Mahsulot qidirish..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500/40"
                        />
                      </motion.div>
                    )}
                    <div className="rounded-2xl border border-white/5 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-[9px] uppercase text-gray-500 font-black">
                          <tr>
                            <th className="px-4 py-3">Mahsulot</th>
                            {active?.isPartialShipment && (
                              <th className="px-4 py-3 text-center">Buyurtma</th>
                            )}
                            <th className="px-4 py-3 text-center">Jo&apos;natilgan</th>
                            <th className="px-4 py-3 text-right">
                              {warehouseOps ? 'Birlik narxi' : 'Summa'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredItems.map((item: any) => {
                            const cur = normalizeSaleCurrency(
                              item.expectedCurrency || active?.displayCurrency,
                            );
                            const qty = Number(item.shippedQuantity ?? item.quantity) || 0;
                            const price = Number(item.expectedPrice) || 0;
                            return (
                              <tr key={item.id}>
                                <td className="px-4 py-3 font-bold text-white">
                                  {displayOrderProductSnapshot(item.productNameSnapshot)}
                                </td>
                                {active?.isPartialShipment && (
                                  <td className="px-4 py-3 text-center font-black text-gray-500">
                                    {item.orderedQuantity ?? '—'}
                                  </td>
                                )}
                                <td
                                  className={`px-4 py-3 text-center font-black ${
                                    item.isPartialLine ? 'text-orange-400' : ''
                                  }`}
                                >
                                  {qty}
                                </td>
                                <td className="px-4 py-3 text-right text-emerald-400 font-black">
                                  {formatSaleAmount(warehouseOps ? price : qty * price, cur)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredItems.length === 0 && (
                        <p className="text-center text-xs text-gray-500 py-8">Natija topilmadi</p>
                      )}
                    </div>
                    {hasNextPage && !search.trim() && (
                      <button
                        type="button"
                        disabled={isFetchingNextPage}
                        onClick={() => fetchNextPage()}
                        className="mt-3 w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-black text-gray-300 hover:bg-white/10 disabled:opacity-50"
                      >
                        {isFetchingNextPage ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Yuklanmoqda...
                          </span>
                        ) : (
                          `Yana ${RECEIPT_ITEMS_PAGE} ta qator yuklash`
                        )}
                      </button>
                    )}
                  </div>

                  <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Umumiy summa</p>
                    <p className="text-2xl font-black text-emerald-400">{formatReceiptTotal(active)}</p>
                  </div>

                  {(active?.status === 'ACCEPTED' || active?.status === 'PARTIALLY_ACCEPTED') && (
                    <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        Omborga kirim
                      </p>
                      {active?.inboundStock?.length ? (
                        <ul className="space-y-2 text-xs max-h-48 overflow-y-auto custom-scrollbar">
                          {active.inboundStock.map((row: any, i: number) => (
                            <li
                              key={`${row.productVariantId}-${i}`}
                              className="flex justify-between gap-2 text-gray-300"
                            >
                              <span className="font-bold text-white truncate">
                                {row.productName}
                                {row.variantName ? ` — ${row.variantName}` : ''}
                              </span>
                              <span className="shrink-0 text-emerald-400 font-black">
                                +{row.quantity} · {row.warehouseName}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-amber-400 font-semibold">
                          Kirim harakati topilmadi.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>

            <div className="p-6 border-t border-white/5 space-y-3">
              <div className={`grid gap-2 ${warehouseOps ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <button
                  type="button"
                  onClick={() => active && printReceiptDocument(active)}
                  className="flex flex-col items-center gap-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-300 hover:bg-white/10"
                >
                  <Printer size={16} />
                  Chop etish
                </button>
                {!warehouseOps && (
                  <button
                    type="button"
                    onClick={() => receiptsService.exportReceiptExcel(receipt.id)}
                    className="flex flex-col items-center gap-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-300 hover:bg-white/10"
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    receiptsService.downloadReceiptPdf(
                      receipt.id,
                      receipt.id.slice(0, 8).toUpperCase(),
                    )
                  }
                  className="flex flex-col items-center gap-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-300 hover:bg-white/10"
                >
                  <FileText size={16} />
                  PDF
                </button>
              </div>
              {canAccept && onAccept ? (
                <button
                  type="button"
                  onClick={() => onAccept(active)}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl flex items-center justify-center gap-2"
                >
                  {active?.isPartialShipment ? 'Qisman yukni qabul qilish' : 'Yukni qabul qilish'}{' '}
                  <ArrowRight size={18} />
                </button>
              ) : resolvedStatus && resolvedStatus !== 'PENDING' ? (
                <p className="text-center text-xs text-gray-500 font-semibold py-2">
                  Ushbu yuk allaqachon qabul qilingan.
                </p>
              ) : null}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
