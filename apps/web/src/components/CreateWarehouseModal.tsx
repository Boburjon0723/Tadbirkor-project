'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Warehouse, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { useInventoryActions } from '@/hooks/warehouse/use-warehouse';

interface CreateWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWarehouseModal({ isOpen, onClose }: CreateWarehouseModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    fieldConfig: {
      showVariantName: true,
      showImage: true,
      showDescription: true,
      showSku: true,
      showBarcode: false,
      showColor: true,
      showPurchasePrice: true,
      showSalePrice: true,
    },
  });
  
  const { createWarehouse } = useInventoryActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWarehouse.mutateAsync(formData);
      setFormData({
        name: '',
        address: '',
        fieldConfig: {
          showVariantName: true,
          showImage: true,
          showDescription: true,
          showSku: true,
          showBarcode: false,
          showColor: true,
          showPurchasePrice: true,
          showSalePrice: true,
        },
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative w-full max-w-md glass-card rounded-[2.5rem] p-8 bg-[#0a0a0a] border-white/10 shadow-2xl"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                  <Warehouse size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black">Yangi <span className="text-blue-500">Ombor</span></h3>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Kirim va chiqim manzili</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Ombor Nomi</label>
                <div className="relative group">
                  <Warehouse className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    required
                    type="text"
                    placeholder="Masalan: Asosiy Ombor"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all font-bold"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                  Mahsulot Ustunlari (Ombor uchun)
                </label>
                {[
                  { key: 'showVariantName', label: 'Variant nomini ko‘rsatish' },
                  { key: 'showImage', label: 'Mahsulot rasmini ko‘rsatish' },
                  { key: 'showDescription', label: 'Tavsifni ko‘rsatish' },
                  { key: 'showSku', label: 'SKU ni ko‘rsatish' },
                  { key: 'showBarcode', label: 'Barkod ni ko‘rsatish' },
                  { key: 'showColor', label: 'Rang ni ko‘rsatish' },
                  { key: 'showPurchasePrice', label: 'Kirim narxini ko‘rsatish' },
                  { key: 'showSalePrice', label: 'Sotuv narxini ko‘rsatish' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between py-1 text-sm font-bold text-gray-300">
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={(formData.fieldConfig as any)[item.key]}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          fieldConfig: {
                            ...prev.fieldConfig,
                            [item.key]: e.target.checked,
                          },
                        }))
                      }
                      className="h-4 w-4 accent-blue-600"
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Manzil</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    required
                    type="text"
                    placeholder="Masalan: Toshkent, Chilonzor"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all font-bold"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={createWarehouse.isPending}
                className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
              >
                {createWarehouse.isPending ? <Loader2 className="animate-spin" /> : (
                  <>
                    Omborni Yaratish
                    <CheckCircle2 size={20} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
