'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePartners } from '@/hooks/partners/use-partners';
import { useProducts } from '@/hooks/products/use-products';
import { useOrderActions } from '@/hooks/orders/use-orders';
import { ordersService } from '@/services/orders.service';
import dynamic from 'next/dynamic';

const CreateOrderDesktopModal = dynamic(
  () =>
    import('./CreateOrderDesktopModal').then((m) => m.CreateOrderDesktopModal),
  { ssr: false },
);
const CreateOrderMobileSheet = dynamic(
  () => import('./CreateOrderMobileSheet').then((m) => m.CreateOrderMobileSheet),
  { ssr: false },
);
import { CreateOrderCloseConfirm } from './CreateOrderCloseConfirm';
import { ORDER_MAX_LINE_ITEMS } from '@/lib/order-limits';
import {
  type FormState,
  type FormItem,
  type Currency,
  defaultFormItem,
  emptyFormState,
  splitSnapshotToLine,
  buildOrderProductSnapshot,
  formatAmount,
  getOrderTotal,
} from './order-form-utils';

export interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editOrderId?: string | null;
}

export function CreateOrderModal({ isOpen, onClose, editOrderId }: CreateOrderModalProps) {
  const { data: partnersData } = usePartners();
  const { data: productsData } = useProducts();
  const { createOrder, updateDraftOrder } = useOrderActions();

  const partners: any[] = useMemo(
    () => partnersData?.partners || partnersData || [],
    [partnersData],
  );
  const products: any[] = useMemo(
    () => productsData?.products || productsData || [],
    [productsData],
  );

  const [formData, setFormData] = useState<FormState>(emptyFormState());
  const [showNotes, setShowNotes] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [mobileStep, setMobileStep] = useState(1);
  const [mobileAddingItem, setMobileAddingItem] = useState(false);
  const [mobileDraftItem, setMobileDraftItem] = useState<FormItem>(defaultFormItem());
  const [mobileProductSearch, setMobileProductSearch] = useState('');
  const [mobileProductDropdownOpen, setMobileProductDropdownOpen] = useState(false);
  const [mobileAddingCatalog, setMobileAddingCatalog] = useState(false);

  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editOrderId) {
      ordersService.getOrderDetail(editOrderId).then((order: any) => {
        const items: FormItem[] = (order.items || []).map((item: any) => {
          const snap = splitSnapshotToLine(
            item.productNameSnapshot || item.productName || '',
          );
          return {
            productName: snap.productName,
            sellerProductVariantId: item.productVariantId || '',
            variantId: '',
            variantLabel: snap.variantLabel,
            quantity: item.quantity || 1,
            price: String(item.expectedPrice || ''),
            currency: (item.expectedCurrency || 'UZS') as Currency,
            snapshotName: item.productNameSnapshot || item.productName || '',
            snapshotVariant: snap.variantLabel,
          };
        });
        setFormData({
          partnerId: order.sellerCompanyId || '',
          deliveryDate: order.expectedDeliveryDate
            ? order.expectedDeliveryDate.slice(0, 10)
            : '',
          notes: order.note || '',
          items: items.length > 0 ? items : [defaultFormItem()],
        });
        if (order.note) setShowNotes(true);
      });
    } else {
      setFormData(emptyFormState());
      setShowNotes(false);
      setMobileStep(1);
      setMobileAddingItem(false);
      setMobileDraftItem(defaultFormItem());
    }
  }, [isOpen, editOrderId]);

  const activePartners = useMemo(
    () => partners.filter((p: any) => !p.status || p.status === 'ACTIVE'),
    [partners],
  );

  const selectedPartner = useMemo(
    () =>
      activePartners.find((p: any) => {
        const comp = p.isIncoming ? p.ownerCompany : p.partnerCompany;
        const cid = comp?.id || p.company?.id || p.partnerCompanyId || p.id;
        return cid === formData.partnerId;
      }),
    [activePartners, formData.partnerId],
  );

  const orderTotalsByCurrency = useMemo(() => getOrderTotal(formData.items), [formData.items]);

  function renderOrderTotalDisplay() {
    const { uzs, usd } = orderTotalsByCurrency;
    const parts: string[] = [];
    if (uzs > 0) parts.push(formatAmount(uzs, 'UZS'));
    if (usd > 0) parts.push(formatAmount(usd, 'USD'));
    return parts.length > 0 ? parts.join(' + ') : '—';
  }

  const handleAddItem = useCallback(() => {
    setFormData((prev) => {
      if (prev.items.length >= ORDER_MAX_LINE_ITEMS) return prev;
      return { ...prev, items: [...prev.items, defaultFormItem()] };
    });
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items,
    }));
  }, []);

  const handleItemChange = useCallback(
    (index: number, field: keyof FormItem, value: string | number) => {
      setFormData((prev) => {
        const items = [...prev.items];
        items[index] = { ...items[index], [field]: value };
        return { ...prev, items };
      });
    },
    [],
  );

  const buildItemsPayload = useCallback(() => {
    return formData.items
      .filter((item) => item.productName.trim())
      .map((item) => ({
        productVariantId: item.sellerProductVariantId || undefined,
        productName:
          item.snapshotName?.trim() ||
          buildOrderProductSnapshot(item.productName, item.variantLabel, item.variantSku),
        quantity: item.quantity,
        expectedPrice: parseFloat(item.price) || 0,
        expectedCurrency: item.currency,
      }));
  }, [formData.items]);

  const handleSubmit = useCallback(async () => {
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const items = buildItemsPayload();
      if (items.length === 0) {
        setSubmitError("Kamida bitta mahsulot qo'shing.");
        return;
      }
      if (items.length > ORDER_MAX_LINE_ITEMS) {
        setSubmitError(
          `Bitta buyurtmada ${ORDER_MAX_LINE_ITEMS} tadan ortiq mahsulot qo'shib bo'lmaydi (hozir ${items.length} ta).`,
        );
        return;
      }
      if (editOrderId) {
        await updateDraftOrder.mutateAsync({
          id: editOrderId,
          dto: {
            expectedDeliveryDate: formData.deliveryDate || undefined,
            note: formData.notes || undefined,
            items,
          },
        });
      } else {
        if (!formData.partnerId) {
          setSubmitError('Hamkorni tanlang.');
          return;
        }
        await createOrder.mutateAsync({
          sellerCompanyId: formData.partnerId,
          expectedDeliveryDate: formData.deliveryDate || undefined,
          notes: formData.notes || undefined,
          items,
        });
      }
      onClose();
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || "Xatolik yuz berdi. Qayta urinib ko'ring.",
      );
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }, [
    isSubmitting,
    buildItemsPayload,
    editOrderId,
    formData,
    createOrder,
    updateDraftOrder,
    onClose,
  ]);

  const requestCloseModal = useCallback(() => {
    const hasData =
      formData.partnerId ||
      formData.items.some((i) => i.productName.trim()) ||
      formData.notes.trim();
    if (hasData) setCloseConfirmOpen(true);
    else onClose();
  }, [formData, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="hidden md:block">
        <CreateOrderDesktopModal
          formData={formData}
          setFormData={setFormData}
          partners={partners}
          products={products}
          selectedPartner={selectedPartner}
          isSubmitting={isSubmitting}
          submitError={submitError}
          editOrderId={editOrderId}
          renderOrderTotalDisplay={renderOrderTotalDisplay}
          handleItemChange={handleItemChange}
          handleSubmit={handleSubmit}
          requestCloseModal={requestCloseModal}
        />
      </div>

      <div className="block md:hidden">
        <CreateOrderMobileSheet
          formData={formData}
          setFormData={setFormData}
          partners={partners}
          products={products}
          selectedPartner={selectedPartner}
          mobileStep={mobileStep}
          setMobileStep={setMobileStep}
          mobileAddingItem={mobileAddingItem}
          setMobileAddingItem={setMobileAddingItem}
          mobileDraftItem={mobileDraftItem}
          setMobileDraftItem={setMobileDraftItem}
          mobileProductSearch={mobileProductSearch}
          setMobileProductSearch={setMobileProductSearch}
          mobileProductDropdownOpen={mobileProductDropdownOpen}
          setMobileProductDropdownOpen={setMobileProductDropdownOpen}
          mobileAddingCatalog={mobileAddingCatalog}
          setMobileAddingCatalog={setMobileAddingCatalog}
          showNotes={showNotes}
          setShowNotes={setShowNotes}
          isSubmitting={isSubmitting}
          submitError={submitError}
          editOrderId={editOrderId}
          renderOrderTotalDisplay={renderOrderTotalDisplay}
          handleRemoveItem={handleRemoveItem}
          handleItemChange={handleItemChange}
          handleSubmit={handleSubmit}
          requestCloseModal={requestCloseModal}
        />
      </div>

      <AnimatePresence>
        <CreateOrderCloseConfirm
          open={closeConfirmOpen}
          onCancel={() => setCloseConfirmOpen(false)}
          onConfirm={() => {
            setCloseConfirmOpen(false);
            onClose();
          }}
        />
      </AnimatePresence>
    </>
  );
}
