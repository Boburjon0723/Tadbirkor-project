'use client';

import React, { RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Layers,
  ChevronDown,
  Trash2,
  Upload,
  Loader2,
  Image as ImageIcon,
  Link as LinkIcon,
} from 'lucide-react';
import { resolveImageUrl, type ProductFormData, type WarehouseFieldConfig } from './product-modal-utils';
import { PRODUCT_UNIT_OPTIONS } from '@/lib/product-units';

type Props = {
  formData: ProductFormData;
  categories: any[] | undefined;
  visibleConfig: WarehouseFieldConfig;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  isCategoryDropdownOpen: boolean;
  onCategoryDropdownToggle: () => void;
  onCategoryDropdownClose: () => void;
  onFieldChange: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  onPickFile: () => void;
  variantCount?: number;
};

export function ProductModalBasicSection({
  formData,
  categories,
  visibleConfig,
  isUploading,
  fileInputRef,
  isCategoryDropdownOpen,
  onCategoryDropdownToggle,
  onCategoryDropdownClose,
  onFieldChange,
  onFileUpload,
  onClearImage,
  onPickFile,
  variantCount,
}: Props) {
  return (
    <div className="space-y-5 md:space-y-8 md:bg-white/[0.02] md:border md:border-white/5 md:rounded-[2.5rem] md:p-8 pb-6 md:pb-8 border-b border-white/5 md:border-b-0">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
        <h3 className="text-base md:text-lg font-bold text-white/90">Asosiy ma&apos;lumotlar</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">
            Mahsulot Nomi
          </label>
          <div className="relative group">
            <Tag
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors"
              size={18}
            />
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
              placeholder="Masalan: Premium Shakar"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl py-3.5 md:py-4 pl-12 pr-4 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/[0.02] transition-all placeholder:text-gray-600 text-base"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">
            O&apos;lchov birligi
          </label>
          <select
            value={formData.unit || 'dona'}
            onChange={(e) => onFieldChange('unit', e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-blue-500/50 text-sm text-white"
          >
            {PRODUCT_UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#121212]">
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-600 ml-1">
            dona — faqat butun son; kg, litr, metr — o&apos;nlik qoldiq mumkin
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">
            Kategoriya
          </label>
          <div className="relative">
            <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <button
              type="button"
              onClick={onCategoryDropdownToggle}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-blue-500/50 transition-all flex items-center justify-between text-sm group"
            >
              <span className={formData.categoryId ? 'text-white' : 'text-gray-500'}>
                {formData.categoryId
                  ? categories?.find((c: any) => c.id === formData.categoryId)?.name
                  : 'Kategoriyasiz'}
              </span>
              <ChevronDown
                size={20}
                className={`text-gray-500 transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180 text-blue-500' : ''}`}
              />
            </button>

            <AnimatePresence>
              {isCategoryDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[110]" onClick={onCategoryDropdownClose} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 right-0 mt-3 bg-[#121212]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[120] backdrop-blur-3xl"
                  >
                    <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => {
                          onFieldChange('categoryId', '');
                          onCategoryDropdownClose();
                        }}
                        className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-bold transition-all mb-1 ${!formData.categoryId ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5'}`}
                      >
                        Kategoriyasiz
                      </button>
                      {categories?.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onFieldChange('categoryId', c.id);
                            onCategoryDropdownClose();
                          }}
                          className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-bold transition-all mb-1 ${formData.categoryId === c.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {variantCount !== undefined ? (
          <div className="md:col-span-2 space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">
              Variantlar soni
            </label>
            <div className="flex items-baseline gap-2 px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <span className="text-3xl font-black tabular-nums text-white">{variantCount}</span>
              <span className="text-sm font-bold text-gray-400">ta rang / pozitsiya</span>
            </div>
          </div>
        ) : null}

        {visibleConfig.showSku && (
          <div className="md:col-span-2 space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 ml-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              Mahsulot Kodi (SKU)
              <span className="normal-case tracking-normal text-[10px] text-gray-600 font-normal">
                — bitta mahsulot uchun bitta kod, barcha variantlarga umumiy. Bo&apos;sh qoldirsangiz,
                tizim avtomatik yaratadi.
              </span>
            </label>
            <div className="relative group">
              <Tag
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors"
                size={18}
              />
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => onFieldChange('sku', e.target.value)}
                placeholder="Masalan: SHK-001 yoki bo'sh qoldiring"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl py-3.5 md:py-4 pl-12 pr-4 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/[0.02] transition-all placeholder:text-gray-600 text-base"
              />
            </div>
          </div>
        )}

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-8">
          {visibleConfig.showDescription && (
            <div
              className={`${visibleConfig.showImage ? 'md:col-span-2' : 'md:col-span-3'} space-y-3`}
            >
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">
                Tavsif (Ixtiyoriy)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => onFieldChange('description', e.target.value)}
                placeholder="Mahsulot haqida qisqacha ma'lumot..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-3xl py-4 px-6 focus:outline-none focus:border-blue-500/50 transition-all h-40 resize-none custom-scrollbar placeholder:text-gray-600"
              />
            </div>
          )}

          {visibleConfig.showImage && (
            <div className="space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 ml-1">
                Mahsulot Rasmi
              </label>
              <div className="relative group/img aspect-square rounded-[2rem] bg-white/[0.02] border-2 border-dashed border-white/10 overflow-hidden flex flex-col items-center justify-center p-2 transition-all hover:border-blue-500/40 hover:bg-blue-500/[0.02]">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 blur-xl bg-blue-500/30 animate-pulse" />
                      <Loader2 className="animate-spin text-blue-500 relative" size={40} />
                    </div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      Yuklanmoqda...
                    </p>
                  </div>
                ) : formData.imageUrl ? (
                  <>
                    <img
                      src={resolveImageUrl(formData.imageUrl)}
                      alt="Preview"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={onClearImage}
                        className="p-3.5 bg-red-500 rounded-2xl text-white shadow-xl hover:bg-red-600 transition-colors transform hover:scale-110 active:scale-95"
                      >
                        <Trash2 size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={onPickFile}
                        className="p-3.5 bg-blue-600 rounded-2xl text-white shadow-xl hover:bg-blue-700 transition-colors transform hover:scale-110 active:scale-95"
                      >
                        <Upload size={20} />
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onPickFile}
                    className="text-center group/btn w-full h-full flex flex-col items-center justify-center"
                  >
                    <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center text-gray-500 mb-4 group-hover/btn:bg-blue-500/10 group-hover/btn:text-blue-400 transition-all duration-300 transform group-hover/btn:rotate-6">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      Fayldan tanlash
                    </p>
                    <p className="text-[9px] text-gray-600 mt-2">PNG, JPG (max 5MB)</p>
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <div className="relative group">
                <LinkIcon
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors"
                  size={16}
                />
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => onFieldChange('imageUrl', e.target.value)}
                  placeholder="Rasm havolasini kiriting..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-xs focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
