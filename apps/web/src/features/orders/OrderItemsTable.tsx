'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, GitBranch, Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ordersService } from '@/services/orders.service';
import { ORDER_ITEMS_PAGE_SIZE } from '@/lib/order-limits';
import { displayOrderProductSnapshot } from '@/lib/order-product-label';
import {
  formatOrderAmount,
  isOrderLineMapped,
  orderHasDispatchInfo,
  orderLineDispatchedQty,
  orderLineOrderedQty,
} from './orders-utils';

type ItemRow = {
  id: string;
  quantity: unknown;
  expectedPrice?: unknown;
  expectedCurrency?: string | null;
  productNameSnapshot: string;
  productVariantId?: string | null;
  mappingStatus?: string | null;
  orderedQuantity?: number;
  dispatchedQuantity?: number;
};

type Props = {
  orderId: string;
  items?: ItemRow[];
  itemsPaginated?: boolean;
  itemCount?: number;
  activeTab: 'my' | 'incoming';
  isLoadingDetail?: boolean;
  showDispatchQty?: boolean;
};

export function OrderItemsTable({
  orderId,
  items: inlineItems,
  itemsPaginated,
  itemCount,
  activeTab,
  isLoadingDetail,
  showDispatchQty,
}: Props) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = search.trim();

  useEffect(() => {
    setPage(1);
  }, [orderId, debouncedSearch]);

  const usePaged = Boolean(itemsPaginated);

  const { data: paged, isLoading: loadingPage } = useQuery({
    queryKey: ['order-items-page', orderId, page, debouncedSearch],
    queryFn: () =>
      ordersService.getOrderItemsPage(orderId, {
        page,
        limit: ORDER_ITEMS_PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
    enabled: usePaged && Boolean(orderId),
    staleTime: 15_000,
  });

  const filteredInline = useMemo(() => {
    if (usePaged) return [];
    const list = inlineItems ?? [];
    if (!debouncedSearch) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter((item) =>
      String(item.productNameSnapshot || '').toLowerCase().includes(q),
    );
  }, [usePaged, inlineItems, debouncedSearch]);

  const inlinePageCount = Math.max(
    1,
    Math.ceil(filteredInline.length / ORDER_ITEMS_PAGE_SIZE),
  );
  const inlineSlice = useMemo(() => {
    if (usePaged) return [];
    const start = (page - 1) * ORDER_ITEMS_PAGE_SIZE;
    return filteredInline.slice(start, start + ORDER_ITEMS_PAGE_SIZE);
  }, [usePaged, filteredInline, page]);

  const rows = usePaged ? paged?.items ?? [] : inlineSlice;
  const total = usePaged ? paged?.total ?? itemCount ?? 0 : filteredInline.length;
  const pageCount = Math.max(1, Math.ceil(total / ORDER_ITEMS_PAGE_SIZE));
  const loading = isLoadingDetail || (usePaged && loadingPage);
  const dispatchCols = showDispatchQty ?? orderHasDispatchInfo({ items: rows });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
          {total} ta mahsulot
          {usePaged ? ' · sahifalab yuklanadi' : ''}
        </p>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulot nomi..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500/40"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/5 max-h-[min(52vh,420px)] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/5 sticky top-0 z-10">
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              <th className="px-4 py-3">Mahsulot</th>
              {dispatchCols ? (
                <>
                  <th className="px-4 py-3 text-center">Buyurtma</th>
                  <th className="px-4 py-3 text-center">Jo&apos;natilgan</th>
                </>
              ) : (
                <th className="px-4 py-3 text-center">Miqdor</th>
              )}
              <th className="px-4 py-3 text-center">Narx</th>
              {activeTab === 'incoming' && <th className="px-4 py-3 text-center">Mapping</th>}
              <th className="px-4 py-3 text-right">Summa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={dispatchCols ? (activeTab === 'incoming' ? 6 : 5) : activeTab === 'incoming' ? 5 : 4} className="px-4 py-12 text-center">
                  <Loader2 className="animate-spin text-blue-500 mx-auto" size={28} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500 text-sm font-bold">
                  Mahsulot topilmadi
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} className="text-sm text-white">
                  <td className="px-4 py-3">
                    <p className="font-bold text-xs">
                      {displayOrderProductSnapshot(item.productNameSnapshot)}
                    </p>
                  </td>
                  {dispatchCols ? (
                    <>
                      <td className="px-4 py-3 text-center font-black text-gray-400">
                        {orderLineOrderedQty(item)}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-amber-400">
                        {orderLineDispatchedQty(item)}
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-center font-black">{String(item.quantity)}</td>
                  )}
                  <td className="px-4 py-3 text-center font-bold text-xs">
                    {formatOrderAmount(
                      Number(item.expectedPrice),
                      (item.expectedCurrency || 'UZS') as 'UZS' | 'USD',
                    )}
                  </td>
                  {activeTab === 'incoming' && (
                    <td className="px-4 py-3 text-center">
                      {isOrderLineMapped(item) ? (
                        <span className="text-emerald-400 inline-flex items-center justify-center gap-1 text-xs">
                          <CheckCircle2 size={12} /> OK
                        </span>
                      ) : (
                        <span className="text-red-400 inline-flex items-center justify-center gap-1 text-xs">
                          <GitBranch size={12} /> Kerak
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-black text-blue-400 text-xs">
                    {formatOrderAmount(
                      (dispatchCols ? orderLineDispatchedQty(item) : orderLineOrderedQty(item)) *
                        Number(item.expectedPrice),
                      (item.expectedCurrency || 'UZS') as 'UZS' | 'USD',
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 text-xs font-black text-gray-400 disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Oldingi
          </button>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            {page} / {usePaged ? pageCount : inlinePageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 text-xs font-black text-gray-400 disabled:opacity-40"
          >
            Keyingi <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
