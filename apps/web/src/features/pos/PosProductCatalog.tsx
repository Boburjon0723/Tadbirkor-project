'use client';

import React, { RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Grid,
  List,
  Loader2,
  LogOut,
  Plus,
  Search,
  Square,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import {
  normalizeSaleCurrency,
  type SaleCurrency,
} from '@/lib/currency';
import {
  formatStockQuantity,
  normalizeProductUnit,
  PRODUCT_UNIT_LABELS,
} from '@/lib/product-units';

export type PosCatalogVariant = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  salePrice?: number | string;
  currency?: string;
  unit?: string;
  stockQuantity?: number;
  image?: string;
  barcode?: string;
  categoryId?: string;
  categoryName?: string;
};

type Props = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  viewMode: 'grid' | 'list' | 'compact';
  onViewModeChange: (m: 'grid' | 'list' | 'compact') => void;
  categories: Array<{ id: string; name: string }> | undefined;
  selectedCategory: string | null;
  onCategoryChange: (id: string | null) => void;
  filteredVariants: PosCatalogVariant[];
  productsLoading: boolean;
  warehouseName?: string;
  showWarehousePicker?: boolean;
  warehouses?: Array<{ id: string; name: string; address?: string }>;
  selectedWarehouseId?: string | null;
  isWarehouseOpen?: boolean;
  onWarehouseOpenToggle?: () => void;
  onWarehouseClose?: () => void;
  onSelectWarehouse?: (id: string) => void;
  showDashboardBack: boolean;
  isSalesRole: boolean;
  cashierName: string;
  formatMoney: (value: number, currency?: SaleCurrency) => string;
  onBack: () => void;
  onLogout?: () => void;
  onAddToCart: (variant: PosCatalogVariant) => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
};

export function PosProductCatalog({
  searchInputRef,
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  categories,
  selectedCategory,
  onCategoryChange,
  filteredVariants,
  productsLoading,
  warehouseName,
  showWarehousePicker = false,
  warehouses,
  selectedWarehouseId,
  isWarehouseOpen = false,
  onWarehouseOpenToggle,
  onWarehouseClose,
  onSelectWarehouse,
  showDashboardBack,
  isSalesRole,
  cashierName,
  formatMoney,
  onBack,
  onLogout,
  onAddToCart,
  theme,
  onThemeToggle,
}: Props) {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-indigo-500',
  ];

  return (
    <div className="flex-1 flex flex-col gap-4 md:gap-8 min-w-0 min-h-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3 shrink-0">
            {showDashboardBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[var(--pos-input-bg)] flex items-center justify-center text-[var(--pos-muted)] hover:text-[var(--pos-text)] transition-all border border-[var(--pos-border)] active:scale-95"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Zap className="text-[var(--pos-accent)] fill-[var(--pos-accent)] w-5 h-5 md:w-6 md:h-6" />
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-xl font-black tracking-tight">
                  Axis <span className="text-[var(--pos-accent)]">POS</span>
                </h1>
                {!isSalesRole && !showWarehousePicker && warehouseName ? (
                  <p className="text-[10px] text-[var(--pos-muted)] font-bold truncate max-w-[140px]">
                    Ombor: {warehouseName}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {showWarehousePicker ? (
            <div className="relative w-full sm:w-52 shrink-0">
              <button
                type="button"
                onClick={onWarehouseOpenToggle}
                className="w-full bg-[var(--pos-input-bg)] border border-[var(--pos-border)] rounded-xl py-2 md:py-2.5 px-3 text-xs md:text-sm font-bold flex items-center justify-between gap-2 hover:bg-[var(--pos-card)] transition-all"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Building2 size={16} className="text-[var(--pos-accent)] shrink-0" />
                  <span className="truncate">
                    {warehouseName || 'Omborni tanlang'}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-[var(--pos-muted)] shrink-0 transition-transform ${isWarehouseOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {isWarehouseOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={onWarehouseClose} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-[var(--pos-panel)] border border-[var(--pos-border)] rounded-2xl shadow-2xl overflow-hidden z-40 p-1 max-h-56 overflow-y-auto custom-scrollbar"
                    >
                      {!warehouses?.length ? (
                        <p className="px-4 py-3 text-xs text-[var(--pos-muted)]">Faol ombor yo&apos;q</p>
                      ) : (
                        warehouses.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => onSelectWarehouse?.(w.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                              selectedWarehouseId === w.id
                                ? 'bg-[var(--pos-accent)] text-white'
                                : 'text-[var(--pos-muted)] hover:bg-[var(--pos-input-bg)] hover:text-[var(--pos-text)]'
                            }`}
                          >
                            <span className="block truncate">{w.name}</span>
                            {w.address ? (
                              <span
                                className={`block text-[10px] truncate mt-0.5 ${
                                  selectedWarehouseId === w.id
                                    ? 'text-white/80'
                                    : 'text-[var(--pos-muted)]'
                                }`}
                              >
                                {w.address}
                              </span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : null}

          <div className="flex-1 max-w-xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--pos-muted)] group-focus-within:text-[var(--pos-accent)] transition-colors w-4 h-4" />
            <input
              ref={searchInputRef as RefObject<HTMLInputElement>}
              type="text"
              placeholder="Qidirish (Ctrl+F)..."
              className="w-full bg-[var(--pos-input-bg)] border border-[var(--pos-border)] rounded-xl py-2 md:py-2.5 pl-11 md:pl-12 pr-4 text-xs md:text-sm text-[var(--pos-text)] focus:outline-none focus:border-[var(--pos-accent)] transition-all font-bold"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center bg-[var(--pos-input-bg)] p-1 rounded-xl border border-[var(--pos-border)] shrink-0">
            {(['grid', 'list', 'compact'] as const).map((mode) => {
              const Icon = mode === 'grid' ? Grid : mode === 'list' ? List : Square;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-[var(--pos-accent)] text-white shadow-lg shadow-cyan-900/30' : 'text-[var(--pos-muted)] hover:text-[var(--pos-text)] hover:bg-[var(--pos-input-bg)]'}`}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              type="button"
              onClick={onThemeToggle}
              className="p-2 md:p-2.5 rounded-xl bg-[var(--pos-input-bg)] border border-[var(--pos-border)] text-[var(--pos-muted)] hover:text-[var(--pos-text)] transition-all active:scale-95"
              title={theme === 'dark' ? 'Qaymoq rejim' : 'Qorong\'u rejim'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-[var(--pos-input-bg)] rounded-xl border border-[var(--pos-border)]">
              <div className="w-6 h-6 rounded-lg bg-[var(--pos-accent)]/20 flex items-center justify-center text-cyan-300 font-black text-[9px]">
                {(cashierName || '?').charAt(0).toUpperCase()}
              </div>
              <p className="text-[11px] font-bold truncate max-w-[80px]">
                {cashierName || '—'}
              </p>
            </div>
            {isSalesRole && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 md:p-2.5 rounded-xl bg-[var(--pos-input-bg)] border border-[var(--pos-border)] text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scrollbar-hide">
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${!selectedCategory ? 'bg-[var(--pos-accent)] text-white shadow-lg shadow-cyan-900/20' : 'bg-[var(--pos-input-bg)] text-[var(--pos-muted)] hover:text-[var(--pos-text)] border border-[var(--pos-border)]'}`}
          >
            Barchasi
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === cat.id ? 'bg-[var(--pos-accent)] text-white shadow-lg shadow-cyan-900/20' : 'bg-[var(--pos-input-bg)] text-[var(--pos-muted)] hover:text-[var(--pos-text)] border border-[var(--pos-border)]'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain custom-scrollbar pr-2 pb-24 md:pb-0">
        {productsLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-[var(--pos-accent)]" size={40} />
            <p className="text-[var(--pos-muted)] font-black uppercase tracking-widest text-[10px]">
              Mahsulotlar yuklanmoqda...
            </p>
          </div>
        ) : filteredVariants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-[var(--pos-text)] font-black">Bu omborda sotish uchun qoldiq yo&apos;q</p>
            <p className="text-[var(--pos-muted)] text-sm max-w-md">
              POS faqat tanlangan faol ombordagi qoldiqdan ko&apos;rsatadi.
              {warehouseName ? ` Hozir: «${warehouseName}».` : ''} Inventardan import yoki kirim qiling.
            </p>
          </div>
        ) : (
          <div
            className={
              viewMode === 'list'
                ? 'space-y-2'
                : viewMode === 'grid'
                  ? 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'
            }
          >
            <AnimatePresence mode="popLayout">
              {filteredVariants.map((variant, idx) => {
                const bgColor = colors[variant.productName.length % colors.length];
                const price = Number(variant.salePrice || 0);
                const cur = normalizeSaleCurrency(variant.currency);
                const unit = normalizeProductUnit(variant.unit);
                const unitLabel = PRODUCT_UNIT_LABELS[unit];
                const stockText =
                  variant.stockQuantity !== undefined
                    ? formatStockQuantity(variant.stockQuantity, unit)
                    : null;

                if (viewMode === 'list') {
                  return (
                    <motion.div
                      layout
                      key={variant.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                      onClick={() => onAddToCart(variant)}
                      className="group flex items-center gap-4 p-3 rounded-2xl bg-[var(--pos-card)]/50 border border-[var(--pos-border)] hover:bg-[var(--pos-card)] hover:border-cyan-500/30 transition-all cursor-pointer active:scale-[0.99]"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl ${bgColor}/10 flex items-center justify-center shrink-0 border border-[var(--pos-border)] overflow-hidden`}
                      >
                        {variant.image ? (
                          <img src={variant.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span
                            className={`text-lg font-black ${bgColor.replace('bg-', 'text-')}`}
                          >
                            {variant.productName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate group-hover:text-cyan-300">
                          {variant.productName}
                        </h4>
                        <p className="text-[11px] text-[var(--pos-muted)] truncate font-medium">
                          {variant.name}
                          {stockText ? ` · ${stockText}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <p className="font-black text-[var(--pos-money)] text-sm">
                          {formatMoney(price, cur)}
                          <span className="text-[var(--pos-muted)] text-[10px] font-bold">
                            /{unitLabel}
                          </span>
                        </p>
                        <div className="w-9 h-9 rounded-xl bg-[var(--pos-accent)] flex items-center justify-center">
                          <Plus size={18} className="text-white" />
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                if (viewMode === 'grid') {
                  return (
                    <motion.div
                      layout
                      key={variant.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                      onClick={() => onAddToCart(variant)}
                      className="glass-card p-4 rounded-2xl border border-[var(--pos-border)] hover:border-cyan-500/30 cursor-pointer flex flex-col gap-3 bg-[var(--pos-card)]/40"
                    >
                      <div
                        className={`w-full aspect-square ${bgColor}/10 rounded-xl flex items-center justify-center overflow-hidden`}
                      >
                        {variant.image ? (
                          <img src={variant.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span
                            className={`text-4xl font-black ${bgColor.replace('bg-', 'text-')}`}
                          >
                            {variant.productName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs line-clamp-1">
                          {variant.productName}
                        </h4>
                        <p className="text-[10px] text-[var(--pos-muted)] truncate">
                          {variant.name}
                          {stockText ? ` · ${stockText}` : ''}
                        </p>
                        <p className="font-black text-[var(--pos-money)] text-sm pt-1">
                          {formatMoney(price, cur)}
                          <span className="text-[var(--pos-muted)] text-[9px] font-bold">
                            /{unitLabel}
                          </span>
                        </p>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    layout
                    key={variant.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: Math.min(idx * 0.005, 0.2) }}
                    onClick={() => onAddToCart(variant)}
                    className="p-2.5 rounded-xl bg-[var(--pos-card)]/50 border border-[var(--pos-border)] hover:bg-[var(--pos-accent)] cursor-pointer text-center active:scale-95"
                  >
                    <div
                      className={`w-10 h-10 mx-auto mb-2 rounded-lg ${bgColor}/10 flex items-center justify-center overflow-hidden`}
                    >
                      {variant.image ? (
                        <img src={variant.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span
                          className={`text-sm font-black ${bgColor.replace('bg-', 'text-')}`}
                        >
                          {variant.productName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-[10px] truncate">{variant.productName}</h4>
                    <p className="text-[8px] text-[var(--pos-muted)]">{unitLabel}</p>
                    <p className="font-black text-[var(--pos-money)] text-[10px]">
                      {formatMoney(price, cur).split(' ')[0]}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
