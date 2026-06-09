'use client';

import { useCallback, useState } from 'react';
import {
  formatSaleAmount,
  normalizeSaleCurrency,
  type SaleCurrency,
} from '@/lib/currency';
import { toast } from '@/lib/toast';
import {
  minSaleQuantity,
  normalizeProductUnit,
  normalizeStockInput,
  quantityStep,
  type ProductUnitCode,
} from '@/lib/product-units';
import type { PosCartItem } from './types';
import type { PosCustomerSelection } from './PosCustomerStrip';

let nextCartId = 1;

export interface CartSession {
  id: string;
  label: string;
  cart: PosCartItem[];
  customer: PosCustomerSelection;
}

function emptyCustomer(): PosCustomerSelection {
  return { retailCustomerId: null, customerName: null, customerPhone: null };
}

function newSession(label: string): CartSession {
  return {
    id: `cart-${nextCartId++}`,
    label,
    cart: [],
    customer: emptyCustomer(),
  };
}

export function usePosMultiCart() {
  const [sessions, setSessions] = useState<CartSession[]>(() => [
    newSession('Mijoz 1'),
  ]);
  const [activeId, setActiveId] = useState<string>(sessions[0].id);

  /* ─── helpers ─────────────────────────────────────────────────── */

  const updateActive = useCallback(
    (updater: (s: CartSession) => CartSession) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeId ? updater(s) : s)),
      );
    },
    [activeId],
  );

  /* ─── multi-cart actions ───────────────────────────────────────── */

  const addCart = useCallback(() => {
    setSessions((prev) => {
      const label = `Mijoz ${prev.length + 1}`;
      const session = newSession(label);
      setActiveId(session.id);
      return [...prev, session];
    });
  }, []);

  const removeCart = useCallback(
    (id: string) => {
      setSessions((prev) => {
        if (prev.length === 1) {
          // Reset instead of remove
          return [{ ...prev[0], cart: [], customer: emptyCustomer() }];
        }
        const idx = prev.findIndex((s) => s.id === id);
        const next = prev.filter((s) => s.id !== id);
        // If removing active, switch to neighbor
        if (id === activeId) {
          const newActive = next[Math.max(0, idx - 1)];
          setActiveId(newActive.id);
        }
        return next;
      });
    },
    [activeId],
  );

  const switchCart = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  /* ─── cart item actions (operate on active session) ───────────── */

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const { cart, customer } = activeSession;

  const cartCurrency: SaleCurrency = cart[0]?.currency ?? 'UZS';

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const formatMoney = useCallback(
    (value: number, currency: SaleCurrency = cartCurrency) =>
      formatSaleAmount(value, currency),
    [cartCurrency],
  );

  const addToCart = useCallback(
    (variant: {
      id: string;
      productId: string;
      productName: string;
      name: string;
      salePrice?: number | string;
      currency?: string;
      unit?: string;
      stockQuantity?: number;
      image?: string;
      quantity?: number;
    }) => {
      const currency = normalizeSaleCurrency(variant.currency);
      const listPrice = Number(variant.salePrice || 0);
      const unit = normalizeProductUnit(variant.unit) as ProductUnitCode;
      const step = quantityStep(unit);
      const initialQty = variant.quantity !== undefined
        ? normalizeStockInput(variant.quantity, unit)
        : minSaleQuantity(unit);

      updateActive((s) => {
        if (s.cart.length > 0 && s.cart[0].currency !== currency) {
          toast.error(
            "Bitta chekda faqat bitta valyutali mahsulotlar bo'lishi mumkin.",
          );
          return s;
        }
        const existing = s.cart.find((item) => item.variantId === variant.id);
        if (existing) {
          const addQty = variant.quantity !== undefined ? initialQty : step;
          const nextQty = normalizeStockInput(existing.quantity + addQty, unit);
          const maxStock = existing.stockQuantity;
          if (maxStock !== undefined && nextQty > maxStock) {
            toast.error('Ombordagi qoldiqdan oshib ketdi');
            return s;
          }
          return {
            ...s,
            cart: s.cart.map((item) =>
              item.variantId === variant.id
                ? { ...item, quantity: nextQty }
                : item,
            ),
          };
        }
        return {
          ...s,
          cart: [
            ...s.cart,
            {
              variantId: variant.id,
              productId: variant.productId,
              name: variant.productName,
              variantName: variant.name,
              listPrice,
              price: listPrice,
              currency,
              unit,
              quantity: initialQty,
              stockQuantity: variant.stockQuantity,
              image: variant.image,
            },
          ],
        };
      });
    },
    [updateActive],
  );

  const removeFromCart = useCallback(
    (variantId: string) => {
      updateActive((s) => ({
        ...s,
        cart: s.cart.filter((item) => item.variantId !== variantId),
      }));
    },
    [updateActive],
  );

  const setItemQuantity = useCallback(
    (variantId: string, quantity: number) => {
      updateActive((s) => ({
        ...s,
        cart: s.cart.map((item) => {
          if (item.variantId !== variantId) return item;
          const minQty = minSaleQuantity(item.unit);
          const next = normalizeStockInput(Math.max(minQty, quantity), item.unit);
          if (item.stockQuantity !== undefined && next > item.stockQuantity) {
            toast.error('Ombordagi qoldiqdan oshib ketdi');
            return item;
          }
          return { ...item, quantity: next };
        }),
      }));
    },
    [updateActive],
  );

  const updateItemPrice = useCallback(
    (variantId: string, price: number) => {
      updateActive((s) => ({
        ...s,
        cart: s.cart.map((item) =>
          item.variantId === variantId ? { ...item, price } : item,
        ),
      }));
    },
    [updateActive],
  );

  const clearCart = useCallback(() => {
    updateActive((s) => ({ ...s, cart: [], customer: emptyCustomer() }));
  }, [updateActive]);

  const setCustomer = useCallback(
    (customer: PosCustomerSelection) => {
      updateActive((s) => ({ ...s, customer }));
    },
    [updateActive],
  );

  const itemCount = cart.length;

  return {
    /* multi-cart */
    sessions,
    activeId,
    activeSession,
    addCart,
    removeCart,
    switchCart,
    /* active session shortcuts */
    cart,
    customer,
    cartCurrency,
    totalAmount,
    formatMoney,
    addToCart,
    removeFromCart,
    setItemQuantity,
    updateItemPrice,
    clearCart,
    setCustomer,
    itemCount,
  };
}
