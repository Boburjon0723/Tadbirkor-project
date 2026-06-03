'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { ordersService } from '@/services/orders.service';
import { buildOrderProductSnapshot, formatVariantLabel } from '@/lib/order-product-label';
import {
  type FormItem,
  type Currency,
  defaultFormItem,
  getMatchedVariants,
} from './order-form-utils';

function getVariantColor(variant: any) {
  return variant?.attributesJson?.color || variant?.attributes?.color || '';
}

type Props = {
  open: boolean;
  onClose: () => void;
  partnerId: string;
  products: any[];
  searchPrefill?: string;
  cartFull: boolean;
  onAdd: (item: FormItem) => void;
};

export function B2bOrderManualLinePanel({
  open,
  onClose,
  partnerId,
  products,
  searchPrefill = '',
  cartFull,
  onAdd,
}: Props) {
  const [draft, setDraft] = useState<FormItem>(defaultFormItem());
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft((d) => ({
      ...defaultFormItem(),
      productName: searchPrefill.trim() || d.productName,
    }));
    const t = setTimeout(() => productInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, searchPrefill]);

  const productQuery = draft.productName.trim();

  const catalogSuggestions = useMemo(
    () => getMatchedVariants(products, productQuery).slice(0, 8),
    [products, productQuery],
  );

  const variantChips = useMemo(() => {
    if (!productQuery) return [];
    const key = productQuery.toLowerCase();
    const product = products?.find((p: any) => p.name?.toLowerCase() === key);
    if (!product?.variants?.length) return [];
    return (product.variants as any[]).map((v) => ({
      id: v.id,
      label: formatVariantLabel(v.name, getVariantColor(v)),
      salePrice: v.salePrice,
      currency: v.currency,
    }));
  }, [products, productQuery]);

  const applyOwnCatalogRow = (row: {
    productName: string;
    variantLabel: string;
    salePrice?: number;
    currency?: string;
  }) => {
    setDraft((d) => ({
      ...d,
      productName: row.productName,
      variantLabel: row.variantLabel,
      price: row.salePrice != null ? String(row.salePrice) : d.price,
      currency:
        String(row.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : ('UZS' as Currency),
    }));
    setSuggestOpen(false);
  };

  const runAutoPrice = useCallback(async () => {
    if (!partnerId || !productQuery) return;
    const snapshot = buildOrderProductSnapshot(
      draft.productName,
      draft.variantLabel,
      draft.variantSku,
    );
    setPriceLoading(true);
    try {
      const result = await ordersService.getPricingSuggestion(partnerId, snapshot);
      const suggested =
        result?.expectedPrice != null
          ? result.expectedPrice
          : (result as { price?: number })?.price;
      if (suggested != null && !Number.isNaN(Number(suggested))) {
        setDraft((d) => ({
          ...d,
          price: String(suggested),
          currency:
            (result?.expectedCurrency ||
              (result as { currency?: Currency })?.currency ||
              d.currency) === 'USD'
              ? 'USD'
              : 'UZS',
        }));
      }
    } catch {
      // ignore
    } finally {
      setPriceLoading(false);
    }
  }, [partnerId, productQuery, draft.productName, draft.variantLabel, draft.variantSku]);

  const submit = () => {
    if (!productQuery || cartFull) return;
    const snapshot = buildOrderProductSnapshot(
      draft.productName,
      draft.variantLabel,
      draft.variantSku,
    );
    onAdd({
      ...draft,
      sellerProductVariantId: '',
      snapshotName: snapshot,
      quantity: Math.max(1, draft.quantity || 1),
    });
    setDraft((d) => ({
      ...defaultFormItem(),
      productName: d.productName,
      currency: d.currency,
    }));
    productInputRef.current?.focus();
  };

  const onFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  return (
    <div
      className="shrink-0 border-b border-amber-500/20 bg-gradient-to-b from-amber-500/[0.08] to-transparent px-4 py-3"
      onKeyDown={onFormKeyDown}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-black text-amber-200/90 uppercase tracking-wide">
          Qo‘lda qator
        </p>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-white/10 hover:text-white"
          aria-label="Yopish"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-2 items-end">
        <div className="lg:col-span-4 relative">
          <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">
            Mahsulot
          </label>
          <input
            ref={productInputRef}
            value={draft.productName}
            onFocus={() => setSuggestOpen(true)}
            onChange={(e) => {
              setDraft((d) => ({ ...d, productName: e.target.value }));
              setSuggestOpen(true);
            }}
            placeholder="Nom yoki qidiruv…"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
            autoComplete="off"
          />
          {suggestOpen && productQuery.length >= 1 ? (
            <>
              <div className="fixed inset-0 z-[115]" onClick={() => setSuggestOpen(false)} />
              <ul className="absolute top-full left-0 right-0 mt-1 z-[120] max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#0f1117] shadow-xl py-1">
                {catalogSuggestions.length === 0 ? (
                  <li className="px-3 py-2 text-[11px] text-gray-500">
                    O‘z katalogingizda yo‘q — nomni yozib davom eting
                  </li>
                ) : (
                  catalogSuggestions.map((s) => (
                    <li key={`${s.productName}-${s.label}`}>
                      <button
                        type="button"
                        onClick={() =>
                          applyOwnCatalogRow({
                            productName: s.productName,
                            variantLabel: s.label.includes(' — ')
                              ? s.label.split(' — ').slice(1).join(' — ')
                              : '',
                            salePrice: s.salePrice,
                            currency: s.currency,
                          })
                        }
                        className="w-full text-left px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5"
                      >
                        {s.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : null}
        </div>

        <div className="lg:col-span-3">
          <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">
            Variant
          </label>
          <input
            value={draft.variantLabel}
            onChange={(e) => setDraft((d) => ({ ...d, variantLabel: e.target.value }))}
            placeholder="Tilla, Qora…"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
          />
          {variantChips.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {variantChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    applyOwnCatalogRow({
                      productName: productQuery,
                      variantLabel: chip.label,
                      salePrice: Number(chip.salePrice),
                      currency: chip.currency,
                    })
                  }
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    draft.variantLabel === chip.label
                      ? 'bg-amber-500/25 border-amber-400/50 text-amber-100'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-1">
          <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">
            Miqdor
          </label>
          <input
            type="number"
            min={1}
            value={draft.quantity}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
              }))
            }
            className="w-full px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-center"
          />
        </div>

        <div className="lg:col-span-3">
          <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">
            Narx
          </label>
          <div className="flex gap-1">
            <input
              type="number"
              min={0}
              step={draft.currency === 'USD' ? '0.01' : '1'}
              value={draft.price}
              onChange={(e) =>
                setDraft((d) => ({ ...d, price: e.target.value.replace(/,/g, '.') }))
              }
              className="flex-1 min-w-0 px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
            />
            <select
              value={draft.currency}
              onChange={(e) =>
                setDraft((d) => ({ ...d, currency: e.target.value as Currency }))
              }
              className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black"
            >
              <option value="UZS">UZS</option>
              <option value="USD">USD</option>
            </select>
            <button
              type="button"
              title="Hamkor bo‘yicha narx taklifi"
              disabled={!partnerId || !productQuery || priceLoading}
              onClick={() => void runAutoPrice()}
              className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/25 text-blue-300 hover:bg-blue-600/25 disabled:opacity-40 shrink-0"
            >
              {priceLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <button
            type="button"
            disabled={!productQuery || cartFull}
            onClick={submit}
            className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-black text-sm flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Plus size={16} />
            <span className="hidden lg:inline">Qo‘shish</span>
          </button>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mt-2">
        Enter — savatga qo‘shish · Esc — yopish
        {cartFull ? ' · Savat to‘ldi' : ''}
      </p>
    </div>
  );
}
