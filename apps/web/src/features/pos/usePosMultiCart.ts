'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPosCart, savePosCart } from './pos-cart-persist';
import {
  calcPosCartTotal,
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
import { nextSessionLabel } from './pos-session.util';

let nextCartId = 1;

function bumpNextCartIdFromSessions(sessions: CartSession[]) {
  for (const s of sessions) {
    const match = s.id.match(/cart-(\d+)/);
    if (match) {
      nextCartId = Math.max(nextCartId, Number(match[1]) + 1);
    }
  }
}

function createDefaultSession(): CartSession {
  const session = newSession('Mijoz 1');
  return session;
}

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

type UsePosMultiCartOptions = {
  /** Ombor + foydalanuvchi bo'yicha savatni brauzerda saqlash */
  storageKey?: string | null;
};

export function usePosMultiCart(options?: UsePosMultiCartOptions) {
  const storageKey = options?.storageKey ?? null;

  const [sessions, setSessions] = useState<CartSession[]>(() => [
    createDefaultSession(),
  ]);
  const [activeId, setActiveId] = useState<string>(() => sessions[0]?.id ?? '');
  const skipNextPersistRef = useRef(true);

  useEffect(() => {
    skipNextPersistRef.current = true;

    if (!storageKey) {
      const fresh = createDefaultSession();
      setSessions([fresh]);
      setActiveId(fresh.id);
      return;
    }

    const loaded = loadPosCart(storageKey);
    if (loaded?.sessions?.length) {
      bumpNextCartIdFromSessions(loaded.sessions);
      const nextActive = loaded.sessions.some((s) => s.id === loaded.activeId)
        ? loaded.activeId
        : loaded.sessions[0].id;
      setSessions(loaded.sessions);
      setActiveId(nextActive);
      return;
    }

    const fresh = createDefaultSession();
    setSessions([fresh]);
    setActiveId(fresh.id);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !activeId) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    savePosCart(storageKey, { sessions, activeId });
  }, [storageKey, sessions, activeId]);

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
      const label = nextSessionLabel(prev);
      const session = newSession(label);
      setActiveId(session.id);
      toast.success(`${label} savati ochildi`);
      return [...prev, session];
    });
  }, []);

  const removeCart = useCallback(
    (id: string) => {
      setSessions((prev) => {
        if (prev.length === 1) {
          toast.info('Savat tozalandi');
          return [{ ...prev[0], cart: [], customer: emptyCustomer() }];
        }
        const removed = prev.find((s) => s.id === id);
        const idx = prev.findIndex((s) => s.id === id);
        const next = prev.filter((s) => s.id !== id);
        if (id === activeId) {
          const newActive = next[Math.max(0, idx - 1)];
          setActiveId(newActive.id);
        }
        if (removed) {
          toast.info(`${removed.label} yopildi`);
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

  const totalAmount = calcPosCartTotal(cart);

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
