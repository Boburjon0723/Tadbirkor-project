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

export type PosCatalogVariant = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  salePrice?: number | string;
  currency?: string;
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
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all border border-white/5 active:scale-95"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Zap className="text-blue-500 fill-blue-500 w-5 h-5 md:w-6 md:h-6" />
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-xl font-black tracking-tight">
                  Axis <span className="text-blue-500">POS</span>
                </h1>
                {!isSalesRole && !showWarehousePicker && warehouseName ? (
                  <p className="text-[10px] text-gray-500 font-bold truncate max-w-[140px]">
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
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 md:py-2.5 px-3 text-xs md:text-sm font-bold flex items-center justify-between gap-2 hover:bg-white/10 transition-all"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Building2 size={16} className="text-blue-500 shrink-0" />
                  <span className="truncate">
                    {warehouseName || 'Omborni tanlang'}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-500 shrink-0 transition-transform ${isWarehouseOpen ? 'rotate-180' : ''}`}
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
                      className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-40 p-1 max-h-56 overflow-y-auto custom-scrollbar"
                    >
                      {!warehouses?.length ? (
                        <p className="px-4 py-3 text-xs text-gray-500">Faol ombor yo&apos;q</p>
                      ) : (
                        warehouses.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => onSelectWarehouse?.(w.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                              selectedWarehouseId === w.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="block truncate">{w.name}</span>
                            {w.address ? (
                              <span
                                className={`block text-[10px] truncate mt-0.5 ${
                                  selectedWarehouseId === w.id
                                    ? 'text-blue-100'
                                    : 'text-gray-500'
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
            <input
              ref={searchInputRef as RefObject<HTMLInputElement>}
              type="text"
              placeholder="Qidirish (Ctrl+F)..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 md:py-2.5 pl-11 md:pl-12 pr-4 text-xs md:text-sm focus:outline-none focus:border-blue-500/50 transition-all font-bold"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
            {(['grid', 'list', 'compact'] as const).map((mode) => {
              const Icon = mode === 'grid' ? Grid : mode === 'list' ? List : Square;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
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
              className="p-2 md:p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
              title="Mavzuni o'zgartirish"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
              <div className="w-6 h-6 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-[9px]">
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
                className="p-2 md:p-2.5 rounded-xl bg-white/5 border border-white/10 text-red-400 hover:bg-red-500/10 transition-all"
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
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${!selectedCategory ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-500 hover:text-white border border-white/5'}`}
          >
            Barchasi
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === cat.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-500 hover:text-white border border-white/5'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain custom-scrollbar pr-2 pb-24 md:pb-0">
        {productsLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-blue-500" size={40} />
            <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">
              Mahsulotlar yuklanmoqda...
            </p>
          </div>
        ) : filteredVariants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-gray-300 font-black">Bu omborda sotish uchun qoldiq yo&apos;q</p>
            <p className="text-gray-500 text-sm max-w-md">
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
                      className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-blue-500/30 transition-all cursor-pointer active:scale-[0.99]"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl ${bgColor}/10 flex items-center justify-center shrink-0 border border-white/5 overflow-hidden`}
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
                        <h4 className="font-bold text-sm truncate group-hover:text-blue-400">
                          {variant.productName}
                        </h4>
                        <p className="text-[11px] text-gray-500 truncate font-medium">
                          {variant.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <p className="font-black text-emerald-400 text-sm">
                          {formatMoney(price, cur)}
                        </p>
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
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
                      className="glass-card p-4 rounded-2xl border border-white/5 hover:border-blue-500/30 cursor-pointer flex flex-col gap-3 bg-white/[0.01]"
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
                        <p className="text-[10px] text-gray-500 truncate">
                          {variant.name}
                        </p>
                        <p className="font-black text-emerald-400 text-sm pt-1">
                          {formatMoney(price, cur)}
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
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-blue-600 cursor-pointer text-center active:scale-95"
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
                    <p className="font-black text-emerald-400 text-[10px]">
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
