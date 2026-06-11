'use client';

import { useCallback, useRef, useState } from 'react';
import { toast, formatApiError } from '@/lib/toast';
import type { SaleCurrency } from '@/lib/currency';
import type { PosReceiptSettings } from '@/components/settings/SettingsPosReceiptSection';
import type { PosCartItem } from './types';
import type { PosCustomerSelection } from './PosCustomerStrip';
import type { ReceiptData } from './PosReceiptPrintModal';
import { printPosReceipt, shouldAutoPrintReceipt } from './pos-receipt-print.util';
import { hasPosCustomer } from './pos-customer.util';
import type { PosPaymentMethod } from './PosCheckoutModal';

type CheckoutItem = {
  productVariantId: string;
  quantity: number;
  unitPrice: number;
};

type QuickCheckoutResult = {
  id?: string;
  receiptNumber?: string;
};

type QuickCheckoutInput = {
  warehouseId: string;
  items: CheckoutItem[];
  retailCustomerId?: string;
  customerName?: string;
  customerPhone?: string;
  method: 'CASH' | 'CARD' | 'CREDIT';
  cashReceived?: number;
};

type Args = {
  cart: PosCartItem[];
  customer: PosCustomerSelection;
  totalAmount: number;
  cartCurrency: SaleCurrency;
  paymentMethod: PosPaymentMethod;
  cashReceivedInput: string;
  selectedWarehouseId: string | null;
  warehouseName: string;
  companyName: string;
  cashierName: string;
  posReceiptSettings: PosReceiptSettings;
  formatMoney: (v: number, currency?: SaleCurrency) => string;
  quickCheckout: (input: QuickCheckoutInput) => Promise<QuickCheckoutResult>;
  onClearActiveCart: () => void;
  onPaymentStarted?: () => void;
  onPaymentSuccess: () => void;
  onPaymentFailed: () => void;
};

export function usePosCheckout({
  cart,
  customer,
  totalAmount,
  cartCurrency,
  paymentMethod,
  cashReceivedInput,
  selectedWarehouseId,
  warehouseName,
  companyName,
  cashierName,
  posReceiptSettings,
  formatMoney,
  quickCheckout,
  onClearActiveCart,
  onPaymentStarted,
  onPaymentSuccess,
  onPaymentFailed,
}: Args) {
  const [paymentInFlight, setPaymentInFlight] = useState(false);
  const inFlightRef = useRef(false);
  const receiptSettingsRef = useRef(posReceiptSettings);
  receiptSettingsRef.current = posReceiptSettings;

  const confirmPayment = useCallback(() => {
    if (inFlightRef.current) return false;

    if (!selectedWarehouseId) {
      toast.error('Iltimos, omborni tanlang');
      return false;
    }
    if (cart.length === 0) return false;

    if (paymentMethod === 'credit' && !hasPosCustomer(customer)) {
      toast.error('Nasiya uchun mijoz tanlang yoki ism kiriting');
      return false;
    }

    const cashVal =
      paymentMethod === 'cash' ? Number(cashReceivedInput) || 0 : undefined;
    if (paymentMethod === 'cash' && (cashVal ?? 0) < totalAmount) {
      toast.error('Qabul qilingan summa yetarli emas');
      return false;
    }

    const methodApi =
      paymentMethod === 'cash'
        ? 'CASH'
        : paymentMethod === 'card'
          ? 'CARD'
          : 'CREDIT';

    const receiptItems = cart.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      price: i.price,
      amount: i.quantity * i.price,
    }));

    const snapshot = {
      items: cart.map((item) => ({
        productVariantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      receiptItems,
      total: totalAmount,
      currency: cartCurrency,
      customerName:
        customer.customerName?.trim() ||
        (customer.retailCustomerId ? 'Mijoz' : undefined),
      retailCustomerId: customer.retailCustomerId || undefined,
      customerPhone: customer.customerPhone || undefined,
      warehouseName,
    };

    inFlightRef.current = true;
    setPaymentInFlight(true);
    onPaymentStarted?.();

    void quickCheckout({
      warehouseId: selectedWarehouseId,
      items: snapshot.items,
      retailCustomerId: snapshot.retailCustomerId,
      customerName: customer.customerName?.trim() || undefined,
      customerPhone: snapshot.customerPhone,
      method: methodApi,
      ...(cashVal !== undefined ? { cashReceived: cashVal } : {}),
    })
      .then((saleResult) => {
        onClearActiveCart();
        onPaymentSuccess();
        inFlightRef.current = false;
        setPaymentInFlight(false);

        const receipt: ReceiptData = {
          receiptNumber:
            saleResult?.receiptNumber ||
            saleResult?.id?.substring(0, 8) ||
            undefined,
          date: new Date(),
          companyName: companyName || undefined,
          cashierName,
          warehouseName: snapshot.warehouseName,
          items: snapshot.receiptItems,
          total: snapshot.total,
          currency: snapshot.currency,
          paymentMethod: methodApi,
          customerName: snapshot.customerName,
          cashReceived: cashVal,
          change:
            methodApi === 'CASH' && cashVal
              ? Math.max(0, cashVal - snapshot.total)
              : 0,
        };

        const settings = receiptSettingsRef.current;

        if (!shouldAutoPrintReceipt(settings)) {
          toast.success("To'lov muvaffaqiyatli yakunlandi");
          return;
        }

        const format = settings.receiptFormat === 'a4' ? 'a4' : 'thermal';
        void printPosReceipt(receipt, format, formatMoney).then(() => {
          toast.success("To'lov muvaffaqiyatli yakunlandi");
        });
      })
      .catch((err: unknown) => {
        console.error(err);
        inFlightRef.current = false;
        setPaymentInFlight(false);
        onPaymentFailed();
        toast.error(
          formatApiError(
            err,
            "To'lov yuborilmadi — savat saqlab qolindi, qayta urinib ko'ring",
          ),
          { duration: 5000 },
        );
      });

    return true;
  }, [
    cart,
    cartCurrency,
    cashierName,
    cashReceivedInput,
    companyName,
    customer,
    formatMoney,
    onClearActiveCart,
    onPaymentFailed,
    onPaymentStarted,
    onPaymentSuccess,
    paymentMethod,
    quickCheckout,
    selectedWarehouseId,
    totalAmount,
    warehouseName,
  ]);

  return { paymentInFlight, confirmPayment };
}
