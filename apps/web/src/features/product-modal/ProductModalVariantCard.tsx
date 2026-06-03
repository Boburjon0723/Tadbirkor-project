'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Palette } from 'lucide-react';
import type { ProductVariantForm, WarehouseFieldConfig } from './product-modal-utils';
import {
  allowsDecimalStock,
  commitStockFieldValue,
  formatStockQuantity,
  PRODUCT_UNIT_LABELS,
  normalizeProductUnit,
  sanitizeStockDraftInput,
  stockFieldDisplayValue,
} from '@/lib/product-units';

type Props = {
  variant: ProductVariantForm;
  index: number;
  canRemove: boolean;
  visibleConfig: WarehouseFieldConfig;
  showVariantStockInput: boolean;
  configWarehouseName?: string;
  isEditing: boolean;
  productUnit?: string;
  onChange: (index: number, field: string, value: unknown) => void;
  onRemove: (index: number) => void;
};

function ProductModalVariantCardInner({
  variant,
  index,
  canRemove,
  visibleConfig,
  showVariantStockInput,
  configWarehouseName,
  isEditing,
  productUnit = 'dona',
  onChange,
  onRemove,
}: Props) {
  const unitCode = normalizeProductUnit(productUnit);
  const unitLabel = PRODUCT_UNIT_LABELS[unitCode];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-7 bg-white/[0.03] border border-white/10 rounded-[2rem] relative group/card hover:bg-white/[0.04] transition-all hover:border-white/20 hover:shadow-2xl hover:shadow-black/40"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {visibleConfig.showVariantName && (
          <div className="space-y-2">
            <label
              htmlFor={`variant-name-${index}`}
              className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1"
            >
              Variant Nomi
            </label>
            <input
              id={`variant-name-${index}`}
              required={visibleConfig.showVariantName}
              type="text"
              value={variant.name}
              onChange={(e) => onChange(index, 'name', e.target.value)}
              placeholder="Masalan: XL Hajm"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500/50 focus:bg-blue-500/[0.02] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
        )}

        {visibleConfig.showBarcode && (
          <div className="space-y-2">
            <label
              htmlFor={`variant-barcode-${index}`}
              className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1"
            >
              Barcode
            </label>
            <input
              id={`variant-barcode-${index}`}
              type="text"
              value={variant.barcode}
              onChange={(e) => onChange(index, 'barcode', e.target.value)}
              placeholder="Masalan: 4780012345678"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-indigo-500/50 focus:bg-indigo-500/[0.02] focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
        )}

        {visibleConfig.showColor && (
          <div className="space-y-2">
            <label
              htmlFor={`variant-color-${index}`}
              className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1"
            >
              Rang
            </label>
            <div className="relative group/input">
              <Palette
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/input:text-purple-400 transition-colors"
                size={16}
              />
              <input
                id={`variant-color-${index}`}
                type="text"
                value={variant.color || ''}
                onChange={(e) => onChange(index, 'color', e.target.value)}
                placeholder="Masalan: Qizil"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-purple-500/50 focus:bg-purple-500/[0.02] focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {visibleConfig.showPurchasePrice && (
          <div className="space-y-2">
            <label
              htmlFor={`variant-purchase-price-${index}`}
              className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1"
            >
              Kirim Narxi
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`variant-purchase-price-${index}`}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={variant.purchasePrice ?? ''}
                onChange={(e) =>
                  onChange(
                    index,
                    'purchasePrice',
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-[130px] bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500/50 focus:bg-blue-500/[0.02] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <select
                value={variant.currency || 'UZS'}
                onChange={(e) => onChange(index, 'currency', e.target.value)}
                className="w-[88px] shrink-0 bg-white/5 border border-white/10 rounded-xl py-3 px-3 text-xs font-black text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        )}

        {visibleConfig.showSalePrice && (
          <div className="space-y-2">
            <label
              htmlFor={`variant-sale-price-${index}`}
              className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1"
            >
              Sotuv Narxi
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`variant-sale-price-${index}`}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={variant.salePrice ?? ''}
                onChange={(e) =>
                  onChange(
                    index,
                    'salePrice',
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-[130px] bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-emerald-500/50 focus:bg-emerald-500/[0.02] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <select
                value={variant.currency || 'UZS'}
                onChange={(e) => onChange(index, 'currency', e.target.value)}
                className="w-[88px] shrink-0 bg-white/5 border border-white/10 rounded-xl py-3 px-3 text-xs font-black text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        )}

        {showVariantStockInput && (
          <div className="space-y-2">
            <label
              htmlFor={`variant-stock-${index}`}
              className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1"
            >
              Zaxira ({unitLabel})
              {configWarehouseName ? ` · ${configWarehouseName}` : ''}
            </label>
            <input
              id={`variant-stock-${index}`}
              type="text"
              inputMode={allowsDecimalStock(productUnit) ? 'decimal' : 'numeric'}
              autoComplete="off"
              value={stockFieldDisplayValue(variant.initialStock)}
              onChange={(e) => {
                const next = sanitizeStockDraftInput(e.target.value, productUnit);
                if (next === null) return;
                onChange(index, 'initialStock', next);
              }}
              onBlur={() => {
                const committed = commitStockFieldValue(
                  variant.initialStock,
                  productUnit,
                );
                if (committed !== variant.initialStock) {
                  onChange(index, 'initialStock', committed);
                }
              }}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500/50 focus:bg-orange-500/[0.02] focus:ring-2 focus:ring-orange-500/20 outline-none transition-all [appearance:textfield]"
            />
            {isEditing && variant.previousStock !== undefined && (
              <p className="text-[10px] text-gray-600">
                Oldingi: {formatStockQuantity(variant.previousStock, productUnit)} → saqlanganda
                ombor yangilanadi
              </p>
            )}
          </div>
        )}
      </div>

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute -top-3 -right-3 w-10 h-10 bg-red-500/15 text-red-400 border border-red-500/25 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-100 shadow-xl backdrop-blur-md"
        >
          <Trash2 size={18} />
        </button>
      )}
    </motion.div>
  );
}

export const ProductModalVariantCard = React.memo(ProductModalVariantCardInner);
