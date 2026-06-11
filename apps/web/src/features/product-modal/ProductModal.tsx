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
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const keyboardActive = isOpen && isMobileViewport;
  const { inset: keyboardInset, viewportHeight, offsetTop } =
    useKeyboardInset(keyboardActive);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  React.useEffect(() => {
    if (!keyboardActive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [keyboardActive]);

  const handleFieldFocus = useCallback(
    (e: React.FocusEvent) => {
      if (!isMobileViewport) return;
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.matches('input, textarea, select')) return;
      window.setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 280);
    },
    [isMobileViewport],
  );

  const mobilePanelStyle = isMobileViewport
    ? {
        position: 'fixed' as const,
        top: offsetTop,
        left: 0,
        right: 0,
        height: viewportHeight ?? undefined,
        maxHeight: viewportHeight ?? undefined,
      }
    : undefined;
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const [partnerLedgerContactId, setPartnerLedgerContactId] = useState('');
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const lastWarehouseForStockSync = useRef<string | null>(null);
  const formInitKeyRef = useRef<string | null>(null);
  const lastHydrationKeyRef = useRef<string | null>(null);
  /** Foydalanuvchi zaxiraga teganda server/forma qayta yozmasin */
  const stockTouchedRef = useRef(false);

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

  const buildVariantsFromProduct = useCallback(
    (source: any, warehouseId: string) =>
      source.variants?.map((v: any) => {
        const qty = stockQtyForWarehouse(v, warehouseId);
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
      }) || [
        {
          name: 'Standart',
          barcode: '',
          color: '',
          purchasePrice: 0,
          salePrice: 0,
          currency: 'UZS' as const,
          initialStock: 0,
          previousStock: 0,
        },
      ],
    [],
  );

  /** API dan qoldiq kelganda qayta sinxronlash (ro'yxatda stockBalances bo'lmasa 0 ko'rinadi) */
  const productStockHydrationKey = React.useMemo(() => {
    if (!product?.variants?.length) return '';
    const wh = defaultWarehouseId || '';
    return product.variants
      .map(
        (v: any) =>
          `${v.id}:${stockQtyForWarehouse(v, wh)}:${(v.stockBalances || []).length}`,
      )
      .join('|');
  }, [product, defaultWarehouseId]);

  React.useEffect(() => {
    if (!isOpen) {
      setPartnerLedgerContactId('');
      setRemovedVariantIds([]);
      lastWarehouseForStockSync.current = null;
      formInitKeyRef.current = null;
      lastHydrationKeyRef.current = null;
      stockTouchedRef.current = false;
      return;
    }
    if (product?.id && detailLoading) return;

    const wh = defaultWarehouseId || '';
    const initKey = product?.id ? `edit:${product.id}` : 'create';
    const hydrationKey = `${initKey}:${productStockHydrationKey}:${wh}`;

    const applyProductForm = (source: any) => {
      const variantSku =
        source.variants?.find((v: any) => v.sku && String(v.sku).trim())?.sku || '';
      const existingSku = inferProductSkuFromName(source.name || '', variantSku);
      setRemovedVariantIds([]);
      lastWarehouseForStockSync.current = wh || null;
      setFormData({
        name: source.name || '',
        description: source.description || '',
        categoryId: source.categoryId || '',
        sku: existingSku,
        unit: source.unit || 'dona',
        type: source.type || 'GOODS',
        imageUrl: source.imageUrl || '',
        targetWarehouseId: wh,
        variants: buildVariantsFromProduct(source, wh),
      });
    };

    if (formInitKeyRef.current !== initKey) {
      formInitKeyRef.current = initKey;
      lastHydrationKeyRef.current = hydrationKey;
      stockTouchedRef.current = false;
      if (product) applyProductForm(product);
      else {
        lastWarehouseForStockSync.current = defaultWarehouseId || null;
        setFormData({
          name: '',
          description: '',
          categoryId: '',
          sku: '',
          unit: 'dona',
          type: 'GOODS',
          imageUrl: '',
          targetWarehouseId: defaultWarehouseId || '',
          variants: [
            {
              name: 'Standart',
              barcode: '',
              color: '',
              purchasePrice: 0,
              salePrice: 0,
              currency: 'UZS',
              initialStock: 0,
              previousStock: 0,
            },
          ],
        });
      }
      return;
    }

    if (
      product?.id &&
      hydrationKey !== lastHydrationKeyRef.current &&
      !stockTouchedRef.current
    ) {
      lastHydrationKeyRef.current = hydrationKey;
      setFormData((prev) => ({
        ...prev,
        variants: prev.variants.map((fv: any) => {
          const src = product.variants?.find((pv: any) => pv.id === fv.id);
          if (!src?.id) return fv;
          const qty = stockQtyForWarehouse(src, wh);
          return { ...fv, initialStock: qty, previousStock: qty };
        }),
      }));
    }
  }, [
    isOpen,
    product?.id,
    productStockHydrationKey,
    defaultWarehouseId,
    detailLoading,
    buildVariantsFromProduct,
    product,
  ]);

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

  /** Foydalanuvchi boshqa omborni tanlaganda — zaxirani shu ombordan qayta olish */
  React.useEffect(() => {
    if (!product?.id || !resolvedWarehouseId || detailLoading) return;
    if (lastWarehouseForStockSync.current === resolvedWarehouseId) return;
    lastWarehouseForStockSync.current = resolvedWarehouseId;
    stockTouchedRef.current = false;
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((fv: any) => {
        const src = product.variants?.find((pv: any) => pv.id === fv.id);
        if (!src?.id) return fv;
        const qty = stockQtyForWarehouse(src, resolvedWarehouseId);
        return { ...fv, initialStock: qty, previousStock: qty };
      }),
    }));
  }, [resolvedWarehouseId, product?.id, product, detailLoading]);

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
    if (field === 'initialStock') {
      stockTouchedRef.current = true;
    }
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
          purchasePrice: visibleConfig.showPurchasePrice
            ? Number(variant.purchasePrice ?? 0)
            : undefined,
          salePrice: visibleConfig.showSalePrice ? Number(variant.salePrice ?? 0) : 0,
          currency: (variant.currency || 'UZS') as 'UZS' | 'USD',
          attributes:
            visibleConfig.showColor
              ? variant.color
                ? { color: String(variant.color).trim() }
                : {}
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

        const wh = resolvedWarehouseId || '';
        const refreshQueries: Promise<unknown>[] = [
          queryClient.invalidateQueries({ queryKey: ['product', product.id] }),
        ];
        if (stockAdjustments?.length && wh) {
          refreshQueries.push(
            queryClient.invalidateQueries({
              queryKey: ['products', 'infinite'],
              predicate: (query) => {
                const params = query.queryKey[2];
                return (
                  !!params &&
                  typeof params === 'object' &&
                  (params as Record<string, unknown>).warehouseId === wh
                );
              },
            }),
            queryClient.invalidateQueries({
              queryKey: ['stock-balances', { warehouseId: wh }],
            }),
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
            queryClient.invalidateQueries({ queryKey: ['partner-ledger'] }),
          );
        }
        await Promise.all(refreshQueries);
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
        <div className="fixed inset-0 z-[100] flex flex-col md:items-center md:justify-center md:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={
              isMobileViewport
                ? { opacity: 0, y: '100%' }
                : { opacity: 0, scale: 0.96, y: 16 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              isMobileViewport
                ? { opacity: 0, y: '100%' }
                : { opacity: 0, scale: 0.96, y: 16 }
            }
            transition={
              isMobileViewport
                ? { type: 'spring', damping: 28, stiffness: 320 }
                : { duration: 0.2 }
            }
            style={mobilePanelStyle}
            className="relative w-full h-full md:h-auto md:max-w-3xl lg:max-w-4xl bg-[#0a0a0a] md:border md:border-white/10 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:max-h-[92vh] pt-[env(safe-area-inset-top)] md:!top-auto md:!left-auto md:!right-auto md:!h-auto md:!max-h-[92vh]"
          >
            {detailLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-sm text-gray-300">Mahsulot yuklanmoqda…</p>
              </div>
            )}
            {/* Header */}
            <div className="shrink-0 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-start gap-3 p-4 md:p-8 md:pb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <Package size={22} className="md:w-6 md:h-6" />
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <h2 className="text-lg md:text-2xl font-black leading-tight">
                    {product?.id ? (
                      <>Mahsulotni <span className="text-blue-500">tahrirlash</span></>
                    ) : (
                      <>Yangi <span className="text-blue-500">Mahsulot</span></>
                    )}
                  </h2>
                  <p className="text-gray-500 text-xs md:text-sm mt-0.5 hidden sm:block">
                    {product?.id
                      ? "Variantlar, narx va ombor qoldig'ini yangilang"
                      : "Katalogingizga yangi mahsulot va variantlarni qo'shing"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2.5 md:p-3 hover:bg-white/5 rounded-xl md:rounded-2xl transition-colors shrink-0"
                  aria-label="Yopish"
                >
                  <X size={22} className="md:w-6 md:h-6" />
                </button>
              </div>

              {showStockColumn && (
                <div className="px-4 pb-4 md:px-5 md:pb-5">
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
                      lastWarehouseForStockSync.current = null;
                      stockTouchedRef.current = false;
                      setFormData((prev) => ({ ...prev, targetWarehouseId: warehouseId }));
                      setIsWarehouseDropdownOpen(false);
                    }}
                    onClose={() => setIsWarehouseDropdownOpen(false)}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div
              ref={scrollRef}
              onFocusCapture={handleFieldFocus}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 md:p-8 space-y-8 md:space-y-12 custom-scrollbar scroll-pt-4 scroll-pb-28 md:scroll-pb-4"
            >
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
              <div className="space-y-4 md:space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                    <h3 className="text-base md:text-xl font-black text-white/90">Variantlar</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="group flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl md:rounded-2xl text-xs font-black transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                  >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                    Variant qo&apos;shish
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

              <div className="divide-y divide-white/5 md:divide-y-0 md:space-y-6 border-t border-white/5 md:border-t-0">
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

            </div>

              {/* Footer — klaviatura ustida qoladi (panel visualViewport ga mos) */}
              <div
                className={`desktop-modal-footer bg-[#0a0a0a]/95 backdrop-blur-xl ${
                  keyboardInset > 0 ? 'py-2' : 'py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
                }`}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3.5 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.98]"
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
                  className="relative group w-full sm:w-auto px-6 md:px-12 py-3.5 md:py-4 bg-blue-600 overflow-hidden rounded-xl md:rounded-2xl transition-all shadow-xl shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="relative text-white font-black text-sm tracking-wide uppercase flex items-center justify-center gap-2">
                    {isSaving || createProduct.isPending || updateProduct.isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Saqlanmoqda...
                      </>
                    ) : (
                      'Saqlash'
                    )}
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
