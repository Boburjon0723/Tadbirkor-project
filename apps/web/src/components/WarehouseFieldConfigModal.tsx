'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Settings2, X } from 'lucide-react';
import { useInventoryActions } from '@/hooks/warehouse/use-warehouse';

interface WarehouseFieldConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouse: any | null;
}

export function WarehouseFieldConfigModal({ isOpen, onClose, warehouse }: WarehouseFieldConfigModalProps) {
  const { updateWarehouse } = useInventoryActions();
  const [fieldConfig, setFieldConfig] = useState({
    showVariantName: true,
    showImage: true,
    showDescription: true,
    showSku: true,
    showBarcode: false,
    showColor: true,
    showTotalStock: true,
    showPurchasePrice: true,
    showSalePrice: true,
  });

  useEffect(() => {
    if (!warehouse) return;
    setFieldConfig({
      showVariantName: warehouse.fieldConfig?.showVariantName ?? true,
      showImage: warehouse.fieldConfig?.showImage ?? true,
      showDescription: warehouse.fieldConfig?.showDescription ?? true,
      showSku: warehouse.fieldConfig?.showSku ?? true,
      showBarcode: warehouse.fieldConfig?.showBarcode ?? false,
      showColor: warehouse.fieldConfig?.showColor ?? true,
      showTotalStock: warehouse.fieldConfig?.showTotalStock ?? true,
      showPurchasePrice: warehouse.fieldConfig?.showPurchasePrice ?? true,
      showSalePrice: warehouse.fieldConfig?.showSalePrice ?? true,
    });
  }, [warehouse, isOpen]);

  const save = async () => {
    if (!warehouse?.id) return;
    await updateWarehouse.mutateAsync({
      id: warehouse.id,
      dto: { fieldConfig },
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0a0a0a] p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings2 className="text-blue-400" size={20} />
                <div>
                  <h3 className="text-lg font-black">Ombor ustun sozlamalari</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Faqat <span className="text-white font-bold">{warehouse?.name || 'tanlangan ombor'}</span> uchun qo'llanadi
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {(
                [
                  { key: 'showVariantName', label: 'Variant nomi' },
                  { key: 'showImage', label: 'Mahsulot rasmi' },
                  { key: 'showDescription', label: 'Tavsif' },
                  { key: 'showSku', label: 'SKU' },
                  { key: 'showBarcode', label: 'Barkod' },
                  { key: 'showColor', label: 'Rang' },
                  {
                    key: 'showTotalStock',
                    label: 'Umumiy zaxira',
                    hint: 'O‘chirilsa ombor “ishlab chiqarish / buyurtma bo‘yicha” rejimida hisoblanadi: B2B jo‘natmada zaxira yetarligi majburiy tekshirilmaydi.',
                  },
                  { key: 'showPurchasePrice', label: 'Kirim narxi' },
                  { key: 'showSalePrice', label: 'Sotuv narxi' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex flex-col gap-1.5 rounded-xl bg-white/5 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-sm">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={(fieldConfig as any)[item.key]}
                      onChange={(e) =>
                        setFieldConfig((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 accent-blue-600"
                    />
                  </div>
                  {'hint' in item && item.hint ? (
                    <p className="text-[10px] text-gray-500 leading-relaxed pr-2">{item.hint}</p>
                  ) : null}
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={save}
              disabled={updateWarehouse.isPending}
              className="mt-5 w-full rounded-2xl bg-blue-600 py-3 font-black text-white disabled:opacity-60"
            >
              {updateWarehouse.isPending ? <Loader2 className="mx-auto animate-spin" size={18} /> : "Saqlash"}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
