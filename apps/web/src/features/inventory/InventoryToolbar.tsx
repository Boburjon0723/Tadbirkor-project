'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Building2,
  Trash2,
} from 'lucide-react';

type Props = {
  warehouses: any[] | undefined;
  categories: any[] | undefined;
  selectedWarehouseId: string;
  selectedCategoryId: string;
  searchTerm: string;
  sortBy: string;
  sortOrder: string;
  isWarehouseOpen: boolean;
  isFilterOpen: boolean;
  isSortOpen: boolean;
  deleteWarehousePending: boolean;
  onSearchChange: (value: string) => void;
  onWarehouseOpenToggle: () => void;
  onWarehouseClose: () => void;
  onSelectWarehouse: (id: string) => void;
  onDeleteWarehouse: (warehouse: any) => void;
  onOpenCreateWarehouse: () => void;
  onOpenWarehouseConfig: () => void;
  onFilterOpenToggle: () => void;
  onFilterClose: () => void;
  onSelectCategory: (id: string) => void;
  onSortOpenToggle: () => void;
  onSortClose: () => void;
  onSelectSort: (sort: string, order: string) => void;
};

const SORT_OPTIONS = [
  { label: 'Nomi (A-Z)', sort: 'name', order: 'asc' },
  { label: 'Nomi (Z-A)', sort: 'name', order: 'desc' },
  { label: 'Eng yangi', sort: 'createdAt', order: 'desc' },
  { label: 'Eng eskisi', sort: 'createdAt', order: 'asc' },
] as const;

export function InventoryToolbar({
  warehouses,
  categories,
  selectedWarehouseId,
  selectedCategoryId,
  searchTerm,
  sortBy,
  sortOrder,
  isWarehouseOpen,
  isFilterOpen,
  isSortOpen,
  deleteWarehousePending,
  onSearchChange,
  onWarehouseOpenToggle,
  onWarehouseClose,
  onSelectWarehouse,
  onDeleteWarehouse,
  onOpenCreateWarehouse,
  onOpenWarehouseConfig,
  onFilterOpenToggle,
  onFilterClose,
  onSelectCategory,
  onSortOpenToggle,
  onSortClose,
  onSelectSort,
}: Props) {
  return (
    <div className="glass-card p-5 rounded-[2rem] flex flex-col xl:flex-row gap-4 xl:items-center relative z-20">
      
      {/* Group 1: Warehouse Dropdown + Create Warehouse + Config (Left Row) */}
      <div className="flex items-center gap-3 w-full xl:w-auto">
        <div className="relative flex-1 sm:flex-initial sm:w-64">
          <button
            type="button"
            onClick={onWarehouseOpenToggle}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-xs lg:text-sm font-bold flex items-center justify-between hover:bg-white/10 transition-all active:scale-[0.98] h-12"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Building2 size={16} className="text-blue-500 shrink-0" />
              <span className="truncate font-black">
                {selectedWarehouseId
                  ? warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name ||
                    'Omborni tanlang'
                  : 'Omborni tanlang'}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-500 transition-transform shrink-0 ${isWarehouseOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isWarehouseOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={onWarehouseClose} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0f]/95 border border-white/10 rounded-[1.5rem] shadow-2xl overflow-hidden z-40 backdrop-blur-3xl"
                >
                  <div className="p-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                    {!warehouses?.length ? (
                      <p className="px-4 py-3.5 text-xs text-gray-500">
                        Faol ombor yo&apos;q. Yangi ombor yarating.
                      </p>
                    ) : null}
                    {warehouses?.map((w: any) => (
                      <div
                        key={w.id}
                        className={`w-full px-1.5 py-0.5 rounded-xl text-xs lg:text-sm transition-all group ${
                          selectedWarehouseId === w.id
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <button
                            type="button"
                            onClick={() => onSelectWarehouse(w.id)}
                            className="min-w-0 flex-1 text-left px-2.5 py-2.5"
                          >
                            <div className="flex flex-col">
                              <span className="font-black truncate">{w.name}</span>
                              {w.address && (
                                <span
                                  className={`text-[9px] truncate ${selectedWarehouseId === w.id ? 'text-blue-100' : 'text-gray-500'}`}
                                >
                                  {w.address}
                                </span>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteWarehouse(w);
                            }}
                            disabled={deleteWarehousePending}
                            className={`shrink-0 p-2 rounded-lg transition-all disabled:opacity-50 ${
                              selectedWarehouseId === w.id
                                ? 'hover:bg-blue-500/30 text-blue-100'
                                : 'hover:bg-red-500/20 text-red-400'
                            }`}
                            title="O'chirish"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Warehouse Actions (Yangi ombor, Ustun sozlamasi) inside dropdown for Mobile Viewports */}
                    <div className="border-t border-white/5 mt-1.5 pt-1.5 space-y-1 block md:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          onWarehouseClose();
                          onOpenCreateWarehouse();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black text-blue-400 hover:bg-blue-500/10 transition-all text-left"
                      >
                        <span>+ Yangi ombor yaratish</span>
                      </button>
                      {selectedWarehouseId && (
                        <button
                          type="button"
                          onClick={() => {
                            onWarehouseClose();
                            onOpenWarehouseConfig();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black text-gray-400 hover:bg-white/5 transition-all text-left"
                        >
                          <span>Ustunlarni sozlash</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={onOpenCreateWarehouse}
          className="hidden md:inline-flex items-center px-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl font-black text-xs lg:text-sm hover:bg-blue-600/20 transition-all whitespace-nowrap active:scale-95 h-12"
        >
          + Yangi ombor
        </button>
        
        <button
          type="button"
          onClick={onOpenWarehouseConfig}
          disabled={!selectedWarehouseId}
          className="hidden md:inline-flex items-center px-4 bg-white/5 border border-white/10 text-gray-300 rounded-2xl font-black text-xs lg:text-sm hover:bg-white/10 transition-all whitespace-nowrap active:scale-95 disabled:opacity-50 h-12"
        >
          Ustun sozlamasi
        </button>
      </div>

      {/* Group 2: Search Input + Category Filter + Sorting (Right Row - stretches nicely in a single clean row on mobile!) */}
      <div className="flex items-center gap-2.5 w-full xl:flex-1">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Nomi, SKU yoki barkod..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs lg:text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all font-bold h-12"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Category Filter Button */}
          <div className="relative">
            <button
              type="button"
              onClick={onFilterOpenToggle}
              className={`flex items-center justify-center gap-2 p-3.5 sm:px-5 sm:py-3 border rounded-2xl text-xs lg:text-sm font-black transition-all active:scale-95 h-12 whitespace-nowrap ${selectedCategoryId ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
            >
              <Filter size={16} className={selectedCategoryId ? 'text-white' : 'text-blue-500'} />
              <span className="hidden sm:inline">Filtr</span>
            </button>
            <AnimatePresence>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={onFilterClose} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    className="absolute top-full right-0 mt-2 w-56 bg-[#0d0d0f]/95 border border-white/10 rounded-[1.5rem] shadow-2xl overflow-hidden z-40 backdrop-blur-3xl p-1.5"
                  >
                    <p className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gray-500">
                      Kategoriya
                    </p>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => onSelectCategory('')}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${!selectedCategoryId ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                      >
                        Barcha kategoriyalar
                      </button>
                      {categories?.map((cat: any) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => onSelectCategory(cat.id)}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Sort Button */}
          <div className="relative">
            <button
              type="button"
              onClick={onSortOpenToggle}
              className="flex items-center justify-center gap-2 p-3.5 sm:px-5 sm:py-3 bg-white/5 border border-white/10 rounded-2xl text-xs lg:text-sm font-black hover:bg-white/10 transition-all text-gray-400 active:scale-95 h-12 whitespace-nowrap"
            >
              <ArrowUpDown size={16} className="text-purple-500" />
              <span className="hidden sm:inline">Saralash</span>
            </button>
            <AnimatePresence>
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={onSortClose} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    className="absolute top-full right-0 mt-2 w-56 bg-[#0d0d0f]/95 border border-white/10 rounded-[1.5rem] shadow-2xl overflow-hidden z-40 backdrop-blur-3xl p-1.5"
                  >
                    <div className="space-y-0.5">
                      <p className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gray-500">
                        Tartiblash
                      </p>
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => onSelectSort(opt.sort, opt.order)}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${sortBy === opt.sort && sortOrder === opt.order ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
