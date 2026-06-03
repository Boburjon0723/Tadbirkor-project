'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
  return (
    <div className="md:hidden p-4 space-y-4">
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <p className="text-gray-500 font-bold text-xs">Yuklanmoqda...</p>
        </div>
      ) : products.length === 0 ? (
        <InventoryEmptyState selectedWarehouseId={selectedWarehouseId} variant="mobile" />
      ) : (
        products.map((product: any, idx: number) => {
          const variantCount = productVariantCount(product);

          return (
            <motion.div
              key={product.id}
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.08 }}
              className="p-5 bg-white/5 border border-white/5 rounded-3xl space-y-4"
            >
              <div className="flex items-center gap-4">
                {activeConfig.showImage && (
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={resolveImageUrl(product.imageUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={24} />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-lg truncate">{product.name}</h4>
                  {activeConfig.showDescription && (
                    <p className="text-[11px] text-gray-500 truncate">
                      {product.description || 'Tavsif yo‘q'}
                    </p>
                  )}
                  {activeConfig.showVariantName && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase mt-1">
                      <Layers size={10} className="text-blue-500" />
                      <span>{product.variants?.[0]?.name || "Variant yo'q"}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  {!catalogReadOnly &&
                    (activeConfig.showSalePrice || activeConfig.showPurchasePrice) && (
                      <p className="font-black text-emerald-400">
                        {formatMoney(
                          Number(product.variants?.[0]?.salePrice || 0),
                          (product.variants?.[0]?.currency || 'UZS') as 'UZS' | 'USD',
                        )}
                      </p>
                    )}
                  <p
                    className={`text-[10px] font-black text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full ${catalogReadOnly ? '' : 'mt-1'}`}
                  >
                    {variantCount} variant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={
                    selectedWarehouseId
                      ? `/dashboard/inventory/${product.id}?warehouseId=${selectedWarehouseId}`
                      : `/dashboard/inventory/${product.id}`
                  }
                  prefetch
                  className="flex-1 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-black rounded-xl text-xs transition-all text-center"
                >
                  Batafsil
                </Link>
                {!catalogReadOnly && (
                  <>
                <button
                  type="button"
                  onClick={() => onQuickStock(product)}
                  className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all"
                  title="Tezkor kirim"
                >
                  <TrendingUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-all"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(product.id)}
                  className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
                >
                  <Trash2 size={16} />
                </button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
