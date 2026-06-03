'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Package, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useProductActions, useCategories } from '@/hooks/products/use-products';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { api } from '@/lib/api';
import { parseStockFieldValue, commitStockFieldValue } from '@/lib/product-units';
import { toast, formatApiError } from '@/lib/toast';
import { inferProductSkuFromName } from '@/lib/product-sku';
import {
  stockQtyForWarehouse,
  resolveImageUrl,
  variantColorFromApi,
  warehouseFieldConfig,
  type ProductFormData,
} from './product-modal-utils';
import { ProductModalWarehousePicker } from './ProductModalWarehousePicker';
import { ProductModalBasicSection } from './ProductModalBasicSection';
import { ProductModalVariantCard } from './ProductModalVariantCard';
import { PartnerLedgerContactSelect } from '@/features/partner-ledger/PartnerLedgerContactSelect';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: any; // Add product prop for editing
  defaultWarehouseId?: string;
  warehouseContext?: any | null;
  /** Tahrirlash: to‘liq mahsulot yuklanmaguncha */
  detailLoading?: boolean;
}

export function ProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  defaultWarehouseId = '',
  warehouseContext = null,
  detailLoading = false,
}: ProductModalProps) {
  const queryClient = useQueryClient();
  const { data: warehouses } = useWarehouses();
  const { createProduct, updateProduct } = useProductActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const [partnerLedgerContactId, setPartnerLedgerContactId] = useState('');
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    categoryId: '',
    sku: '',
    unit: 'dona',
    type: 'GOODS',
    imageUrl: '',
    targetWarehouseId: '',
    variants: [
      {
        name: 'Standart',
        barcode: '',
        color: '',
        purchasePrice: 0,
        salePrice: 0,
        currency: 'UZS' as 'UZS' | 'USD',
        initialStock: 0,
        previousStock: 0,
      },
    ],
  });

  // Load product data when editing
  React.useEffect(() => {
    if (product) {
      // SKU mahsulot darajasida bitta: variantlardan birinchi mavjudini ko'taramiz.
      const variantSku =
        product.variants?.find((v: any) => v.sku && String(v.sku).trim())?.sku || '';
      const existingSku = inferProductSkuFromName(product.name || '', variantSku);
      setRemovedVariantIds([]);
      setFormData({
        name: product.name || '',
        description: product.description || '',
        categoryId: product.categoryId || '',
        sku: existingSku,
        unit: product.unit || 'dona',
        type: product.type || 'GOODS',
        imageUrl: product.imageUrl || '',
        targetWarehouseId: defaultWarehouseId || '',
        variants: product.variants?.map((v: any) => {
          const wh = defaultWarehouseId || '';
          const qty = stockQtyForWarehouse(v, wh);
          return {
            id: v.id,
            name: v.name,
            barcode: v.barcode || '',
            color: variantColorFromApi(v),
            purchasePrice: Number(v.purchasePrice) || 0,
            salePrice: Number(v.salePrice) || 0,
            currency: (v.currency || 'UZS') as 'UZS' | 'USD',
            initialStock: qty,
            previousStock: qty,
          };
        }) || [{ name: 'Standart', barcode: '', color: '', purchasePrice: 0, salePrice: 0, currency: 'UZS' as 'UZS' | 'USD', initialStock: 0, previousStock: 0 }]
      });
    } else {
      setFormData({
        name: '',
        description: '',
        categoryId: '',
        sku: '',
        unit: 'dona',
        type: 'GOODS',
        imageUrl: '',
        targetWarehouseId: defaultWarehouseId || '',
        variants: [{ name: 'Standart', barcode: '', color: '', purchasePrice: 0, salePrice: 0, currency: 'UZS' as 'UZS' | 'USD', initialStock: 0, previousStock: 0 }]
      });
    }
  }, [product?.id, isOpen, defaultWarehouseId]);

  React.useEffect(() => {
    if (!isOpen) {
      setPartnerLedgerContactId('');
      setRemovedVariantIds([]);
    }
  }, [isOpen]);

  const resolvedWarehouseId = formData.targetWarehouseId || defaultWarehouseId;
  const { data: categories } = useCategories(resolvedWarehouseId, {
    enabled: isOpen && !!resolvedWarehouseId,
  });

  React.useEffect(() => {
    if (!isOpen || product?.id || !categories?.length) return;
    setFormData((prev) => {
      if (prev.categoryId) return prev;
      return { ...prev, categoryId: categories[0].id };
    });
  }, [isOpen, product?.id, categories]);
  const configWarehouse =
    warehouses?.find((w: any) => w.id === resolvedWarehouseId) ||
    warehouseContext ||
    null;
  const visibleConfig = warehouseFieldConfig(configWarehouse);

  const showStockColumn = visibleConfig.showTotalStock !== false;
  const showVariantStockInput = Boolean(resolvedWarehouseId) && showStockColumn;

  React.useEffect(() => {
    if (!product?.id || !resolvedWarehouseId) return;
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((fv: any) => {
        const src = product.variants?.find((pv: any) => pv.id === fv.id);
        if (!src?.id) return fv;
        const qty = stockQtyForWarehouse(src, resolvedWarehouseId);
        return { ...fv, initialStock: qty, previousStock: qty };
      }),
    }));
  }, [resolvedWarehouseId, product?.id]);

  const handleAddVariant = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          name: '',
          barcode: '',
          color: '',
          purchasePrice: 0,
          salePrice: 0,
          currency: 'UZS' as 'UZS' | 'USD',
          initialStock: 0,
          previousStock: 0,
        },
      ],
    }));
  }, []);

  const handleRemoveVariant = useCallback((index: number) => {
    setFormData((prev) => {
      if (prev.variants.length <= 1) return prev;
      const removedId = prev.variants[index]?.id;
      if (removedId) {
        setRemovedVariantIds((ids) =>
          ids.includes(removedId) ? ids : [...ids, removedId],
        );
      }
      return {
        ...prev,
        variants: prev.variants.filter((_, i) => i !== index),
      };
    });
  }, []);

  const handleVariantChange = useCallback((index: number, field: string, value: unknown) => {
    setFormData((prev) => {
      const newVariants = [...prev.variants];
      newVariants[index] = { ...newVariants[index], [field]: value };
      return { ...prev, variants: newVariants };
    });
  }, []);

  const handleFormFieldChange = useCallback(
    <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
      if (key === 'unit') {
        const unit = String(value);
        setFormData((prev) => ({
          ...prev,
          unit,
          variants: prev.variants.map((variant) => ({
            ...variant,
            initialStock:
              variant.initialStock === ''
                ? ''
                : commitStockFieldValue(variant.initialStock, unit),
          })),
        }));
        return;
      }
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const form = new FormData();
    form.append('image', file);

    try {
      const { data } = await api.post('/uploads/image', form, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const uploadedUrl = resolveImageUrl(data?.url || data?.path);
      if (uploadedUrl) {
        setFormData(prev => ({ ...prev, imageUrl: uploadedUrl }));
      }
    } catch (err) {
      console.error('Rasm yuklashda xatolik:', err);
      toast.error(formatApiError(err, "Rasm yuklashda xatolik yuz berdi."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const categoryId = formData.categoryId.trim();
      if (!categoryId) {
        toast.error('Kategoriya tanlash majburiy.');
        return;
      }
      const seenBarcode = new Set<string>();
      const variants = formData.variants as any[];
      for (let idx = 0; idx < variants.length; idx += 1) {
        const variant = variants[idx];
        const barcode = String(variant.barcode || '').trim().toLowerCase();
        if (barcode) {
          if (seenBarcode.has(barcode)) {
            toast.error(`${idx + 1}-variant: Barkod takrorlangan (${variant.barcode}). Har bir variant barkodi noyob bo'lishi kerak.`);
            return;
          }
          seenBarcode.add(barcode);
        }
      }
      const canonicalSku = inferProductSkuFromName(
        formData.name,
        String(formData.sku || '').trim(),
      );
      const seenColors = new Set<string>();
      for (const variant of formData.variants as any[]) {
        const color = String(variant.color || '').trim().toLowerCase();
        if (!color) continue;
        if (seenColors.has(color)) {
          toast.error(`Rang takrorlanmasligi kerak: ${variant.color}`);
          return;
        }
        seenColors.add(color);
      }

      const payload = {
        name: formData.name,
        categoryId,
        unit: formData.unit,
        type: formData.type as 'GOODS' | 'SERVICE' | 'RAW_MATERIAL' | 'FINISHED_GOOD',
        description: visibleConfig.showDescription ? formData.description : undefined,
        imageUrl: visibleConfig.showImage
          ? String(formData.imageUrl || '').trim() || null
          : undefined,
        variants: formData.variants.map((variant: any, variantIndex: number) => ({
          id: variant.id,
          name: visibleConfig.showVariantName
            ? (variant.name || 'Standart')
            : (String(variant.color || '').trim() || 'Standart'),
          // SKU mahsulot darajasida bitta bo'lsin: faqat birinchi variantga yozamiz.
          sku: visibleConfig.showSku ? (variantIndex === 0 ? (canonicalSku || undefined) : undefined) : undefined,
          barcode: visibleConfig.showBarcode
            ? String(variant.barcode || '').trim() || undefined
            : undefined,
          purchasePrice: visibleConfig.showPurchasePrice ? Number(variant.purchasePrice || 0) : undefined,
          salePrice: visibleConfig.showSalePrice ? Number(variant.salePrice || 0) : 0,
          currency: (variant.currency || 'UZS') as 'UZS' | 'USD',
          attributes:
            visibleConfig.showColor && variant.color
              ? { color: String(variant.color).trim() }
              : undefined,
          initialStock:
            showVariantStockInput && !variant.id
              ? parseStockFieldValue(variant.initialStock, formData.unit)
              : 0,
          warehouseId: resolvedWarehouseId || undefined,
        })),
      };

      if (product?.id) {
        const stockAdjustments =
          showVariantStockInput && resolvedWarehouseId
            ? ((formData.variants as any[])
                .filter((variant) => variant.id)
                .map((variant) => {
                  const prev = Number(variant.previousStock ?? 0);
                  const next = parseStockFieldValue(variant.initialStock, formData.unit);
                  const delta = next - prev;
                  if (delta === 0) return null;
                  return {
                    warehouseId: resolvedWarehouseId,
                    productVariantId: variant.id as string,
                    quantity: delta,
                    note: 'Mahsulot kartochkasidan zaxira tuzatish',
                    ...(partnerLedgerContactId ? { partnerLedgerContactId } : {}),
                  };
                })
                .filter(Boolean) as Array<{
                  warehouseId: string;
                  productVariantId: string;
                  quantity: number;
                  note: string;
                  partnerLedgerContactId?: string;
                }>)
            : undefined;

        await updateProduct.mutateAsync({
          id: product.id,
          dto: {
            ...payload,
            removedVariantIds:
              removedVariantIds.length > 0 ? removedVariantIds : undefined,
            ...(stockAdjustments?.length ? { stockAdjustments } : {}),
          },
        });

        if (stockAdjustments?.length && resolvedWarehouseId) {
          const wh = resolvedWarehouseId;
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ['products', 'infinite'],
              predicate: (query) => {
                if (!wh) return true;
                const params = query.queryKey[2];
                return (
                  !!params &&
                  typeof params === 'object' &&
                  (params as Record<string, unknown>).warehouseId === wh
                );
              },
            }),
            queryClient.invalidateQueries({
              queryKey: ['stock-balances', wh ? { warehouseId: wh } : {}],
            }),
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
            queryClient.invalidateQueries({ queryKey: ['partner-ledger'] }),
            queryClient.invalidateQueries({ queryKey: ['product', product.id, wh] }),
          ]);
        }
      } else {
        await createProduct.mutateAsync(payload);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Mahsulotni saqlashda xatolik yuz berdi.";
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {detailLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-sm text-gray-300">Mahsulot yuklanmoqda…</p>
              </div>
            )}
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Package size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black">
                    {product?.id ? (
                      <>Mahsulotni <span className="text-blue-500">tahrirlash</span></>
                    ) : (
                      <>Yangi <span className="text-blue-500">Mahsulot</span></>
                    )}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {product?.id
                      ? 'Variantlar, narx va ombor qoldigвЂini yangilang'
                      : "Katalogingizga yangi mahsulot va variantlarni qo'shing"}
                  </p>
                </div>
              </div>

              <ProductModalWarehousePicker
                productId={product?.id}
                warehouses={warehouses}
                targetWarehouseId={formData.targetWarehouseId}
                configWarehouseName={configWarehouse?.name}
                resolvedWarehouseId={resolvedWarehouseId}
                showStockColumn={showStockColumn}
                isOpen={isWarehouseDropdownOpen}
                onToggle={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                onSelect={(warehouseId) => {
                  setFormData((prev) => ({ ...prev, targetWarehouseId: warehouseId }));
                  setIsWarehouseDropdownOpen(false);
                }}
                onClose={() => setIsWarehouseDropdownOpen(false)}
              />
              <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
              <ProductModalBasicSection
                formData={formData}
                categories={categories}
                visibleConfig={visibleConfig}
                isUploading={isUploading}
                fileInputRef={fileInputRef}
                isCategoryDropdownOpen={isCategoryDropdownOpen}
                onCategoryDropdownToggle={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                onCategoryDropdownClose={() => setIsCategoryDropdownOpen(false)}
                onFieldChange={handleFormFieldChange}
                onFileUpload={handleFileUpload}
                onClearImage={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                onPickFile={() => fileInputRef.current?.click()}
                variantCount={product?.variants?.length}
              />
              {/* Variants Section */}
              <div className="space-y-8">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                    <h3 className="text-xl font-black text-white/90">Mahsulot Variantlari</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="group flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                  >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                    Variant qo'shish
                  </button>
                </div>

                {showVariantStockInput && product?.id ? (
                <div className="hidden px-2">
                  <PartnerLedgerContactSelect
                    value={partnerLedgerContactId}
                    onChange={setPartnerLedgerContactId}
                    hint="Zaxira o‘zgarganda kirim/chiqim shu hamkor daftariga yoziladi (miqdor × narx)."
                  />
                </div>
              ) : null}

              <div className="space-y-6">
                  {formData.variants.map((variant, index) => (
                    <ProductModalVariantCard
                      key={variant.id ?? `new-${index}`}
                      variant={variant}
                      index={index}
                      canRemove={formData.variants.length > 1}
                      visibleConfig={visibleConfig}
                      showVariantStockInput={showVariantStockInput}
                      configWarehouseName={configWarehouse?.name}
                      isEditing={!!product?.id}
                      productUnit={formData.unit}
                      onChange={handleVariantChange}
                      onRemove={handleRemoveVariant}
                    />
                  ))}
                </div>
              </div>

              {/* Footer Section */}
              <div className="pt-10 flex items-center justify-end gap-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={
                    detailLoading ||
                    isSaving ||
                    createProduct.isPending ||
                    updateProduct.isPending
                  }
                  className="relative group px-12 py-4 bg-blue-600 overflow-hidden rounded-2xl transition-all shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="relative text-white font-black text-sm tracking-widest uppercase">
                    {isSaving || createProduct.isPending || updateProduct.isPending ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={18} />
                        Saqlanmoqda...
                      </div>
                    ) : 'Mahsulotni Saqlash'}
                  </span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
