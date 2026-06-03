'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ordersService } from '@/services/orders.service';
import { ORDER_ITEMS_PAGE_SIZE } from '@/lib/order-limits';
import { displayOrderProductSnapshot } from '@/lib/order-product-label';
import { isOrderLineMapped } from './orders-utils';

type Props = {
  orderId: string;
  order: any;
  ownProducts: any[] | undefined;
  mappingSelections: Record<string, string>;
  mappingPrices: Record<string, string>;
  mappingCurrencies: Record<string, 'UZS' | 'USD'>;
  onMappingSelect: (itemId: string, variantId: string, variant?: any) => void;
  onMappingPrice: (itemId: string, value: string) => void;
  onMappingCurrency: (itemId: string, currency: 'UZS' | 'USD') => void;
  onMapItem: (orderId: string, itemId: string) => void;
};

export function OrderMappingSection({
  orderId,
  order,
  ownProducts,
  mappingSelections,
  mappingPrices,
  mappingCurrencies,
  onMappingSelect,
  onMappingPrice,
  onMappingCurrency,
  onMapItem,
}: Props) {
  const [page, setPage] = useState(1);
  const usePaged = Boolean(order?.itemsPaginated);

  const inlineUnmapped = (order?.items ?? []).filter((item: any) => !isOrderLineMapped(item));

  const { data: paged, isLoading } = useQuery({
    queryKey: ['order-unmapped-items', orderId, page],
    queryFn: () =>
      ordersService.getOrderItemsPage(orderId, {
        page,
        limit: ORDER_ITEMS_PAGE_SIZE,
        unmappedOnly: true,
      }),
    enabled: usePaged && Boolean(orderId),
    staleTime: 10_000,
  });

  useEffect(() => {
    setPage(1);
  }, [orderId]);

  const rows = usePaged ? paged?.items ?? [] : inlineUnmapped;
  const total = usePaged ? paged?.total ?? 0 : inlineUnmapped.length;
  const pageCount = Math.max(1, Math.ceil(total / ORDER_ITEMS_PAGE_SIZE));

  if (total === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h5 className="text-sm font-black text-gray-300">
        Seller mapping (kelgan nom → ombor varianti) · {total} ta
      </h5>
      {isLoading && usePaged ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : (
        rows.map((item: any) => {
          const selectedVariantId = mappingSelections[item.id];
          const priceRaw = mappingPrices[item.id];
          const hasValidPrice = !priceRaw || Number(priceRaw) > 0;
          const canSave = Boolean(selectedVariantId) && hasValidPrice;

          return (
            <div
              key={item.id}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl"
            >
              <div className="md:col-span-2">
                <p className="text-xs text-gray-400 mb-1">Kelgan nom</p>
                <p className="font-bold text-white">
                  {displayOrderProductSnapshot(item.productNameSnapshot)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Ombordagi varianti</p>
                <select
                  value={mappingSelections[item.id] || ''}
                  onChange={(e) => {
                    const variantId = e.target.value;
                    const variant = ownProducts
                      ?.flatMap((p: any) => p.variants || [])
                      .find((v: any) => v.id === variantId);
                    onMappingSelect(item.id, variantId, variant);
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white"
                >
                  <option value="">Tanlang...</option>
                  {(ownProducts || []).flatMap((product: any) =>
                    (product.variants || []).map((variant: any) => (
                      <option key={variant.id} value={variant.id}>
                        {product.name} — {variant.name}
                      </option>
                    )),
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Narx</p>
                  <input
                    type="number"
                    step={(mappingCurrencies[item.id] || 'UZS') === 'USD' ? '0.01' : '1'}
                    value={mappingPrices[item.id] || ''}
                    onChange={(e) =>
                      onMappingPrice(item.id, e.target.value.replace(/,/g, '.'))
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Valyuta</p>
                  <select
                    value={mappingCurrencies[item.id] || 'UZS'}
                    onChange={(e) =>
                      onMappingCurrency(item.id, e.target.value as 'UZS' | 'USD')
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="flex items-end md:col-span-4">
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => onMapItem(orderId, item.id)}
                  className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl text-xs transition-all"
                >
                  Mapping saqlash
                </button>
              </div>
            </div>
          );
        })
      )}
      {usePaged && pageCount > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-2 rounded-xl bg-white/5 text-xs font-black text-gray-400 disabled:opacity-40"
          >
            <ChevronLeft size={14} className="inline" /> Oldingi
          </button>
          <span className="text-[10px] text-gray-500 font-black">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-2 rounded-xl bg-white/5 text-xs font-black text-gray-400 disabled:opacity-40"
          >
            Keyingi <ChevronRight size={14} className="inline" />
          </button>
        </div>
      )}
    </div>
  );
}
