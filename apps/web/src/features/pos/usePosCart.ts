'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  formatSaleAmount,
  normalizeSaleCurrency,
  type SaleCurrency,
} from '@/lib/currency';
import { toast } from '@/lib/toast';
import type { PosCartItem } from './types';

export function usePosCart() {
  const [cart, setCart] = useState<PosCartItem[]>([]);

  const cartCurrency: SaleCurrency = cart[0]?.currency || 'UZS';
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const formatMoney = useCallback(
    (value: number, currency: SaleCurrency = cartCurrency) =>
      formatSaleAmount(value, currency),
    [cartCurrency],
  );

  const addToCart = useCallback((variant: {
    id: string;
    productId: string;
    productName: string;
    name: string;
    salePrice?: number | string;
    currency?: string;
    image?: string;
  }) => {
    const currency = normalizeSaleCurrency(variant.currency);
    const listPrice = Number(variant.salePrice || 0);
    setCart((prev) => {
      if (prev.length > 0 && prev[0].currency !== currency) {
        toast.error(
          "Bitta chekda faqat bitta valyutali mahsulotlar bo'lishi mumkin.",
        );
        return prev;
      }
      const existing = prev.find((item) => item.variantId === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productId: variant.productId,
          name: variant.productName,
          variantName: variant.name,
          listPrice,
          price: listPrice,
          currency,
          quantity: 1,
          image: variant.image,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.variantId !== variantId) return item;
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }),
    );
  }, []);

  const updateItemPrice = useCallback((variantId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.variantId === variantId ? { ...item, price } : item,
      ),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const itemCount = useMemo(
    () => cart.reduce((a, b) => a + b.quantity, 0),
    [cart],
  );

  return {
    cart,
    setCart,
    cartCurrency,
    totalAmount,
    formatMoney,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemPrice,
    clearCart,
    itemCount,
  };
}
