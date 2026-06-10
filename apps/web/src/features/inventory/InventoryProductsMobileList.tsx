'use client';

import React from 'react';
import Link from 'next/link';
import { Package, Loader2, Layers, Edit2, Trash2, TrendingUp } from 'lucide-react';
import {
  resolveImageUrl,
  formatMoney,
  productVariantCount,
  type WarehouseFieldConfig,
} from './inventory-utils';
import { InventoryEmptyState } from './InventoryEmptyState';

type Props = {
  products: any[];
  selectedWarehouseId: string;
  activeConfig: WarehouseFieldConfig;
  catalogReadOnly?: boolean;
  isLoading: boolean;
  onEdit: (product: any) => void;
  onQuickStock: (product: any) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (productId: string) => void;
};

export function InventoryProductsMobileList({
  products,
  selectedWarehouseId,
  activeConfig,
  catalogReadOnly = false,
  isLoading,
  onEdit,
  onQuickStock,
  onDelete,
  onOpenDetail,
}: Props) {
  if (isLoading) {
    return (
      <div className="md:hidden py-20 flex flex-col items-center justify-center gap-4 border-t border-white/5">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-gray-500 font-bold text-xs">Yuklanmoqda...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="md:hidden border-t border-white/5">
        <InventoryEmptyState selectedWarehouseId={selectedWarehouseId} variant="mobile" />
      </div>
    );
  }

  return (
    <div className="md:hidden border-t border-white/5 divide-y divide-white/5 bg-[#050505]">
      {products.map((product: any) => {
        const variantCount = productVariantCount(product);
        const detailHref = selectedWarehouseId
          ? `/dashboard/inventory/${product.id}?warehouseId=${selectedWarehouseId}`
          : `/dashboard/inventory/${product.id}`;

        return (
          <article
            key={product.id}
            className="w-full px-4 py-3.5 active:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3">
              {activeConfig.showImage && (
                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                  {product.imageUrl ? (
                    <img
                      src={resolveImageUrl(product.imageUrl)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={22} />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[15px] leading-snug truncate text-white">
                  {product.name}
                </h4>
                {activeConfig.showDescription && (
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {product.description || 'Tavsif yo‘q'}
                  </p>
                )}
                {activeConfig.showVariantName && (
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold uppercase mt-0.5">
                    <Layers size={10} className="text-blue-500 shrink-0" />
                    <span className="truncate">
                      {product.variants?.[0]?.name || "Variant yo'q"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0 pl-2">
                {!catalogReadOnly &&
                  (activeConfig.showSalePrice || activeConfig.showPurchasePrice) && (
                    <p className="font-black text-sm text-emerald-400 tabular-nums">
                      {formatMoney(
                        Number(product.variants?.[0]?.salePrice || 0),
                        (product.variants?.[0]?.currency || 'UZS') as 'UZS' | 'USD',
                      )}
                    </p>
                  )}
                <p
                  className={`text-[9px] font-black text-blue-400/90 ${catalogReadOnly ? '' : 'mt-0.5'}`}
                >
                  {variantCount} variant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Link
                href={detailHref}
                prefetch
                className="flex-1 py-2.5 bg-blue-600/15 active:bg-blue-600/25 text-blue-400 font-bold rounded-lg text-xs text-center"
              >
                Batafsil
              </Link>
              {!catalogReadOnly && (
                <>
                  <button
                    type="button"
                    onClick={() => onQuickStock(product)}
                    className="p-2.5 bg-emerald-500/10 active:bg-emerald-500/20 text-emerald-400 rounded-lg"
                    title="Tezkor kirim"
                  >
                    <TrendingUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    className="p-2.5 bg-white/5 active:bg-white/10 rounded-lg text-gray-400"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(product.id)}
                    className="p-2.5 bg-red-500/10 active:bg-red-500/20 text-red-500 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
