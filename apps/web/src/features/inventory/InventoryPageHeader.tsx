'use client';

import React, { useState } from 'react';
import { Plus, Layers, Download, Upload, Table2, FileSpreadsheet, MoreHorizontal, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { reportsService } from '@/services/reports.service';
import { toast, formatApiError } from '@/lib/toast';

type Props = {
  selectedWarehouseId: string;
  selectedWarehouseName?: string;
  productCount?: number;
  variantCount?: number;
  isLoading?: boolean;
  onOpenCategories: () => void;
  onOpenImport: () => void;
  onOpenQuickStock: () => void;
  onOpenNewProduct: () => void;
};

function requireWarehouse(selectedWarehouseId: string): boolean {
  if (selectedWarehouseId) return true;
  toast.error('Avval omborni tanlang.');
  return false;
}

export function InventoryPageHeader({
  selectedWarehouseId,
  selectedWarehouseName,
  productCount = 0,
  variantCount = 0,
  isLoading = false,
  onOpenCategories,
  onOpenImport,
  onOpenQuickStock,
  onOpenNewProduct,
}: Props) {
  const [exportingWithStock, setExportingWithStock] = useState(false);
  const [exportingWithoutStock, setExportingWithoutStock] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleExport = async (mode: 'with_stock' | 'without_stock') => {
    if (!requireWarehouse(selectedWarehouseId)) return;
    const setLoading = mode === 'with_stock' ? setExportingWithStock : setExportingWithoutStock;
    setLoading(true);
    try {
      await reportsService.exportProductsForImport(
        selectedWarehouseId,
        selectedWarehouseName,
        mode,
      );
      toast.success(
        mode === 'with_stock'
          ? 'Excel yuklandi (qoldiq bilan). Tahrirlang va Import qiling.'
          : 'Excel yuklandi (qoldiqsiz). Faqat narx/katalog — zaxira o‘zgarmaydi.',
      );
    } catch (err) {
      console.error(err);
      toast.error(formatApiError(err, 'Excel exportda xatolik'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-white/5">
      <div className="w-full">
        {/* Mobile top stats side-by-side cards */}
        {selectedWarehouseId ? (
          <div className="grid grid-cols-2 gap-3 w-full md:hidden mb-4">
            {/* Ombordagi mahsulotlar card */}
            <div className="px-4 py-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5 backdrop-blur-xl flex flex-col justify-between">
              <p className="text-[9px] font-black uppercase tracking-wider text-blue-400/80 mb-1">
                Mahsulotlar
              </p>
              <p className="text-xl font-black text-white tabular-nums">
                {isLoading ? '…' : productCount}
                <span className="text-xs font-bold text-gray-400 ml-1">ta</span>
              </p>
            </div>
            
            {/* Jami variantlar card */}
            <div className="px-4 py-3.5 rounded-2xl bg-white/[0.02] border border-white/5 shadow-md backdrop-blur-xl flex flex-col justify-between">
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500 mb-1">
                Variantlar
              </p>
              <p className="text-xl font-black text-gray-200 tabular-nums">
                {isLoading ? '…' : variantCount}
                <span className="text-xs font-bold text-gray-500 ml-1">ta</span>
              </p>
            </div>
          </div>
        ) : null}

        <h1 className="hidden md:block text-3xl md:text-4xl font-black tracking-tight mb-1.5">
          Mahsulotlar <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Katalogi</span>
        </h1>
        <p className="hidden md:block text-gray-400 text-sm md:text-base">
          Barcha mahsulotlar, variantlar va narxlarni boshqarish.
        </p>
        
        {selectedWarehouseId ? (
          <div className="mt-4 hidden md:flex flex-wrap items-center gap-3">
            {/* Ombordagi mahsulotlar micro-card */}
            <div className="px-4 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5 backdrop-blur-xl">
              <p className="text-[9px] font-black uppercase tracking-wider text-blue-400/80 mb-0.5">
                Ombordagi mahsulotlar
              </p>
              <p className="text-xl font-black text-white tabular-nums">
                {isLoading ? '…' : productCount}
                <span className="text-xs font-bold text-gray-400 ml-1">ta</span>
              </p>
            </div>
            
            {/* Jami variantlar micro-card */}
            <div className="px-4 py-2 rounded-2xl bg-white/[0.02] border border-white/5 shadow-md backdrop-blur-xl">
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500 mb-0.5">
                Jami variantlar (ranglar)
              </p>
              <p className="text-lg font-black text-gray-200 tabular-nums">
                {isLoading ? '…' : variantCount}
                <span className="text-xs font-bold text-gray-500 ml-1">ta</span>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Highly optimized laptop responsive action buttons (Desktop View) */}
      <div className="hidden md:flex flex-wrap items-center gap-2 lg:gap-3 mt-2 xl:mt-0">
        <button
          type="button"
          onClick={onOpenCategories}
          className="flex items-center gap-2 px-3.5 py-2.5 lg:px-4 lg:py-3 bg-purple-600/10 border border-purple-500/20 rounded-xl text-[10px] lg:text-xs font-black hover:bg-purple-600/20 transition-all text-purple-400 group active:scale-95 whitespace-nowrap"
        >
          <Layers size={14} className="group-hover:rotate-12 transition-transform" />
          <span>Kategoriyalar</span>
        </button>

        <button
          type="button"
          onClick={async () => {
            try {
              await reportsService.getProductTemplate();
              toast.success('Shablon yuklandi.');
            } catch (err) {
              console.error(err);
              toast.error(formatApiError(err, 'Shablon yuklashda xatolik'));
            }
          }}
          className="flex items-center gap-2 px-3.5 py-2.5 lg:px-4 lg:py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] lg:text-xs font-black hover:bg-white/10 transition-all text-gray-400 hover:text-white group active:scale-95 whitespace-nowrap"
          title="Bo'sh import shabloni"
        >
          <Download size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>Shablon</span>
        </button>

        <button
          type="button"
          onClick={() => handleExport('with_stock')}
          disabled={exportingWithStock || !selectedWarehouseId}
          className="flex items-center gap-2 px-3.5 py-2.5 lg:px-4 lg:py-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-[10px] lg:text-xs font-black hover:bg-blue-600/20 transition-all text-blue-400 disabled:opacity-50 active:scale-95 whitespace-nowrap"
          title="Tanlangan ombor — joriy qoldiq bilan (tahrirlab import)"
        >
          <Table2 size={14} className="text-blue-400" />
          <span>
            {exportingWithStock ? 'Eksport...' : 'Excel (qoldiq)'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleExport('without_stock')}
          disabled={exportingWithoutStock || !selectedWarehouseId}
          className="flex items-center gap-2 px-3.5 py-2.5 lg:px-4 lg:py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] lg:text-xs font-black hover:bg-white/10 transition-all text-gray-400 hover:text-white disabled:opacity-50 active:scale-95 whitespace-nowrap"
          title="Tanlangan ombor — qoldiqsiz (faqat narx va katalog)"
        >
          <FileSpreadsheet size={14} className="text-violet-400" />
          <span>
            {exportingWithoutStock ? 'Eksport...' : 'Excel (katalog)'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenImport}
          className="flex items-center gap-2 px-3.5 py-2.5 lg:px-4 lg:py-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-[10px] lg:text-xs font-black hover:bg-emerald-600/20 transition-all text-emerald-400 group active:scale-95 whitespace-nowrap"
        >
          <Upload size={14} className="group-hover:-translate-y-0.5 transition-transform" />
          <span>Import</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!requireWarehouse(selectedWarehouseId)) return;
            onOpenQuickStock();
          }}
          className="flex items-center gap-2 px-3.5 py-2.5 lg:px-4 lg:py-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[10px] lg:text-xs font-black hover:bg-amber-500/20 transition-all text-amber-300 group active:scale-95 whitespace-nowrap"
        >
          <TrendingUp size={14} className="group-hover:-translate-y-0.5 transition-transform" />
          <span>Tezkor kirim</span>
        </button>

        <button
          type="button"
          onClick={onOpenNewProduct}
          className="group flex items-center gap-2 px-4 py-2.5 lg:px-6 lg:py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl lg:rounded-2xl transition-all shadow-[0_10px_20px_rgba(37,99,235,0.2)] active:scale-95 whitespace-nowrap text-[10px] lg:text-xs"
        >
          <Plus size={14} className="group-hover:rotate-90 transition-transform" />
          <span>Yangi mahsulot</span>
        </button>
      </div>

      {/* Highly optimized elegant actions dropdown for Mobile View */}
      <div className="flex md:hidden items-center gap-2 w-full mt-2 relative">
        <button
          type="button"
          onClick={onOpenNewProduct}
          className="group flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-[0_10px_20px_rgba(37,99,235,0.2)] active:scale-[0.97] whitespace-nowrap text-xs"
        >
          <Plus size={14} className="group-hover:rotate-90 transition-transform" />
          <span>Yangi mahsulot</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center justify-center p-3.5 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all active:scale-[0.97]"
            title="Qo'shimcha amallar"
          >
            <MoreHorizontal size={16} />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-black/10" 
                  onClick={() => setShowDropdown(false)} 
                />
                
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-[#0a0a0c]/98 border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50 backdrop-blur-2xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      onOpenCategories();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all text-xs font-bold text-left"
                  >
                    <Layers size={14} className="text-purple-400" />
                    Kategoriyalar
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setShowDropdown(false);
                      try {
                        await reportsService.getProductTemplate();
                        toast.success('Shablon yuklandi.');
                      } catch (err) {
                        console.error(err);
                        toast.error(formatApiError(err, 'Shablon yuklashda xatolik'));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all text-xs font-bold text-left"
                  >
                    <Download size={14} className="text-emerald-400" />
                    Bo'sh import shabloni
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      handleExport('with_stock');
                    }}
                    disabled={exportingWithStock || !selectedWarehouseId}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-50 transition-all text-xs font-bold text-left"
                  >
                    <Table2 size={14} className="text-blue-400" />
                    Excel (qoldiq bilan)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      handleExport('without_stock');
                    }}
                    disabled={exportingWithoutStock || !selectedWarehouseId}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-50 transition-all text-xs font-bold text-left"
                  >
                    <FileSpreadsheet size={14} className="text-violet-400" />
                    Excel (qoldiqsiz)
                  </button>

                  <div className="h-px bg-white/5 my-1.5" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      if (!requireWarehouse(selectedWarehouseId)) return;
                      onOpenQuickStock();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all text-xs font-black text-left"
                  >
                    <TrendingUp size={14} />
                    Tezkor kirim
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      onOpenImport();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 transition-all text-xs font-black text-left"
                  >
                    <Upload size={14} />
                    Excel import qilish
                  </button>

                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
