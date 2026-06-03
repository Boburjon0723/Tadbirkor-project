'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package,
  Loader2,
  Layers,
  Barcode,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  resolveImageUrl,
  formatMoney,
  productTotalStock,
  productVariantCount,
  visibleColumnCount,
  type WarehouseFieldConfig,
} from './inventory-utils';
import { formatStockQuantity } from '@/lib/product-units';
import { InventoryEmptyState } from './InventoryEmptyState';

type Props = {
  products: any[];
  selectedWarehouseId: string;
  activeConfig: WarehouseFieldConfig;
  catalogReadOnly?: boolean;
  isLoading: boolean;
  isError: boolean;
  onEdit: (product: any) => void;
  onQuickStock: (product: any) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (productId: string) => void;
};

export function InventoryProductsTable({
  products,
  selectedWarehouseId,
  activeConfig,
  catalogReadOnly = false,
  isLoading,
  isError,
  onEdit,
  onQuickStock,
  onDelete,
  onOpenDetail,
}: Props) {
  const showCatalogSizeColumn = true;
  const colSpan = visibleColumnCount(activeConfig, { alwaysShowCatalogSize: true });

  return (
    <div className="hidden md:block overflow-x-auto rounded-3xl border border-white/5 bg-white/[0.01]">
      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <Loader2 className="animate-spin text-blue-500" size={50} />
            <div className="absolute inset-0 blur-xl bg-blue-500/20 animate-pulse" />
          </div>
          <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
        </div>
      ) : isError ? (
        <div className="py-20 text-center text-red-400 font-bold text-sm">
          Ma&apos;lumotlarni yuklashda xatolik yuz berdi.
        </div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th className="px-4 xl:px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 whitespace-nowrap">
                Mahsulot / Variantlar
              </th>
              {(activeConfig.showSku || activeConfig.showBarcode || activeConfig.showColor) && (
                <th className="px-4 xl:px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 whitespace-nowrap">
                  SKU / Barkod / Rang
                </th>
              )}
              {showCatalogSizeColumn && (
                <th className="px-4 xl:px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 whitespace-nowrap">
                  Variantlar
                </th>
              )}
              {activeConfig.showTotalStock && (
                <th className="px-4 xl:px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 whitespace-nowrap">
                  Qoldiq
                </th>
              )}
              {(activeConfig.showSalePrice || activeConfig.showPurchasePrice) && (
                <th className="px-4 xl:px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 whitespace-nowrap">
                  Narx
                </th>
              )}
              <th className="px-4 xl:px-8 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 text-right whitespace-nowrap">
                Amallar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 xl:px-8 py-32 text-center">
                  <InventoryEmptyState selectedWarehouseId={selectedWarehouseId} />
                </td>
              </tr>
            ) : (
              products.map((product: any, idx: number) => {
                const variantCount = productVariantCount(product);
                const totalStock = productTotalStock(product, selectedWarehouseId);

                return (
                  <motion.tr
                    key={product.id}
                    initial={false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.08 }}
                    className="hover:bg-white/[0.03] hover:backdrop-blur-sm transition-all duration-300 group"
                  >
                    {/* Column 1: Image & Description */}
                    <td className="px-4 xl:px-8 py-5">
                      <div className="flex items-center gap-4">
                        {activeConfig.showImage && (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 flex items-center justify-center text-blue-400 border border-white/5 group-hover:scale-105 group-hover:border-blue-500/20 transition-all overflow-hidden shrink-0">
                            {product.imageUrl ? (
                              <img
                                src={resolveImageUrl(product.imageUrl)}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package size={20} />
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-black text-sm lg:text-base text-white group-hover:text-blue-400 transition-colors truncate">
                            {product.name}
                          </p>
                          {activeConfig.showDescription && (
                            <p className="text-[11px] text-gray-500 max-w-xs lg:max-w-md line-clamp-1 mt-0.5">
                              {product.description || 'Tavsif yo‘q'}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {activeConfig.showVariantName &&
                              product.variants?.slice(0, 3).map((v: any) => (
                                <span
                                  key={v.id}
                                  className="text-[8px] font-black uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded border border-white/5 text-gray-400"
                                >
                                  {v.name}
                                </span>
                              ))}
                            {product.variants?.length > 3 && (
                              <span className="text-[8px] font-black text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                +{product.variants.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: SKU, Barcode, Color */}
                    {(activeConfig.showSku || activeConfig.showBarcode || activeConfig.showColor) && (
                      <td className="px-4 xl:px-8 py-5">
                        <div className="space-y-1">
                          {activeConfig.showSku && (
                            <div className="flex items-center gap-1.5 text-gray-400 text-[11px] font-bold">
                              <Layers size={11} className="text-blue-500 shrink-0" />
                              <span className="truncate">
                                {product.variants?.[0]?.sku || 'SKU yo‘q'}
                              </span>
                            </div>
                          )}
                          {activeConfig.showBarcode && product.variants?.[0]?.barcode && (
                            <div className="flex items-center gap-1.5 text-gray-500 text-[10px]">
                              <Barcode size={11} className="shrink-0" />
                              <span className="truncate">{product.variants[0].barcode}</span>
                            </div>
                          )}
                          {activeConfig.showColor && product.variants?.[0]?.attributesJson?.color && (
                            <div className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">
                              Rang: {product.variants[0].attributesJson.color}
                            </div>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Column 3: Variants count */}
                    {showCatalogSizeColumn && (
                      <td className="px-4 xl:px-8 py-5">
                        <p className="font-black text-lg text-white tabular-nums">
                          {variantCount}
                          <span className="text-xs font-bold text-gray-500 ml-1">ta</span>
                        </p>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">variantlar</p>
                      </td>
                    )}

                    {/* Column 4: Total Stock */}
                    {activeConfig.showTotalStock && (
                      <td className="px-4 xl:px-8 py-5">
                        <span
                          className={`font-black text-sm lg:text-base tabular-nums inline-flex items-center px-2.5 py-1 rounded-full ${
                            totalStock > 0 
                              ? 'bg-white/5 border border-white/5 text-white' 
                              : 'bg-red-500/10 border border-red-500/20 text-red-400'
                          }`}
                        >
                          {formatStockQuantity(totalStock, product.unit)}
                        </span>
                      </td>
                    )}

                    {/* Column 5: Prices */}
                    {(activeConfig.showSalePrice || activeConfig.showPurchasePrice) && (
                      <td className="px-4 xl:px-8 py-5">
                        <div className="flex flex-col gap-1">
                          {activeConfig.showSalePrice && (
                            <p className="font-black text-xs lg:text-sm text-emerald-400 inline-flex items-center bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 rounded-lg w-max">
                              {formatMoney(
                                Number(product.variants?.[0]?.salePrice || 0),
                                (product.variants?.[0]?.currency || 'UZS') as 'UZS' | 'USD',
                              )}
                            </p>
                          )}
                          {activeConfig.showPurchasePrice && (
                            <p className="text-[10px] text-gray-500 font-bold pl-1">
                              Kirim:{' '}
                              {formatMoney(
                                Number(product.variants?.[0]?.purchasePrice || 0),
                                (product.variants?.[0]?.currency || 'UZS') as 'UZS' | 'USD',
                              )}
                            </p>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Column 6: Actions */}
                    <td className="px-4 xl:px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2.5 md:opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        {!catalogReadOnly && (
                          <>
                        <button
                          type="button"
                          onClick={() => onQuickStock(product)}
                          className="p-2.5 bg-white/5 hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-500/30 rounded-xl text-gray-400 hover:text-emerald-400 transition-all active:scale-95"
                          title="Tezkor kirim"
                        >
                          <TrendingUp size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          className="p-2.5 bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 rounded-xl text-gray-400 hover:text-blue-400 transition-all active:scale-95"
                          title="Tahrirlash"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(product.id)}
                          className="p-2.5 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-xl text-gray-400 hover:text-red-400 transition-all active:scale-95"
                          title="O'chirish"
                        >
                          <Trash2 size={15} />
                        </button>
                          </>
                        )}
                        <Link
                          href={
                            selectedWarehouseId
                              ? `/dashboard/inventory/${product.id}?warehouseId=${selectedWarehouseId}`
                              : `/dashboard/inventory/${product.id}`
                          }
                          prefetch
                          className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md hover:scale-105 hover:bg-blue-500 transition-all active:scale-95 inline-flex"
                          title="Batafsil"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
