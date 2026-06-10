'use client';

import React, { useState } from 'react';
import { Warehouse, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { useInventoryActions } from '@/hooks/warehouse/use-warehouse';
import { MobileFormShell } from '@/components/mobile/MobileFormShell';

interface CreateWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_FIELD_CONFIG = {
  showVariantName: true,
  showImage: true,
  showDescription: true,
  showSku: true,
  showBarcode: false,
  showColor: true,
  showPurchasePrice: true,
  showSalePrice: true,
};

export function CreateWarehouseModal({ isOpen, onClose }: CreateWarehouseModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    fieldConfig: { ...DEFAULT_FIELD_CONFIG },
  });

  const { createWarehouse } = useInventoryActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWarehouse.mutateAsync(formData);
      setFormData({
        name: '',
        address: '',
        fieldConfig: { ...DEFAULT_FIELD_CONFIG },
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <MobileFormShell
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      zIndex={110}
      icon={
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
          <Warehouse size={20} />
        </div>
      }
      title={
        <>
          Yangi <span className="text-blue-500">Ombor</span>
        </>
      }
      subtitle="Kirim va chiqim manzili"
      footer={
        <button
          type="submit"
          form="create-warehouse-form"
          disabled={createWarehouse.isPending}
          className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {createWarehouse.isPending ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              Omborni yaratish
              <CheckCircle2 size={18} />
            </>
          )}
        </button>
      }
    >
      <form id="create-warehouse-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
            Ombor nomi
          </label>
          <div className="relative group">
            <Warehouse className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              required
              type="text"
              placeholder="Masalan: Asosiy Ombor"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all font-bold"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
            Mahsulot ustunlari (ombor uchun)
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
            <label
              key={item.key}
              className="flex items-center justify-between py-1 text-sm font-bold text-gray-300"
            >
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={(formData.fieldConfig as Record<string, boolean>)[item.key]}
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
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
            Manzil
          </label>
          <div className="relative group">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              required
              type="text"
              placeholder="Masalan: Toshkent, Chilonzor"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all font-bold"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
        </div>
      </form>
    </MobileFormShell>
  );
}
