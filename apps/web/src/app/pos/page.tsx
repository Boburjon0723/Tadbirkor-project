'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePosRealtime } from '@/hooks/pos/use-pos-realtime';
import { usePosCatalog } from '@/hooks/pos/use-pos';
import type { PosCatalogItem } from '@/services/pos.service';
import { authService } from '@/services/auth.service';
import { useSession } from '@/hooks/use-session';
import { isModuleKeyEnabled } from '@/lib/feature-modules';
import { usePosActions } from '@/hooks/pos/use-pos';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { toast, formatApiError } from '@/lib/toast';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { PosBlockedScreen, PosLoadingScreen } from '@/features/pos/PosGateScreens';
import {
  PosProductCatalog,
  type PosCatalogVariant,
} from '@/features/pos/PosProductCatalog';
import {
  PosCartSidebar,
  PosMobileCartBar,
} from '@/features/pos/PosCartSidebar';
import { PosCheckoutModal } from '@/features/pos/PosCheckoutModal';
import { PosPriceEditModal } from '@/features/pos/PosPriceEditModal';
import { PosBarcodeScanner } from '@/features/pos/PosBarcodeScanner';
import { usePosMultiCart } from '@/features/pos/usePosMultiCart';
import type { PosCartItem } from '@/features/pos/types';
import { PosReceiptPrintModal, type ReceiptData } from '@/features/pos/PosReceiptPrintModal';

export default function POSPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { can, loading: permLoading } = usePermissions();

  const { data: session } = useSession();
  const [posGate, setPosGate] = useState<'loading' | 'ok' | 'blocked'>('loading');
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [cashierName, setCashierName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'card' | 'credit'
  >('cash');
  const [posCreditEnabled, setPosCreditEnabled] = useState(false);
  const [posMaxDiscountPercent, setPosMaxDiscountPercent] = useState(15);
  // customer state is now managed inside usePosMultiCart per session
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('list');
  const [priceEditItem, setPriceEditItem] = useState<PosCartItem | null>(null);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);

  const {
    sessions,
    activeId,
    addCart,
    removeCart,
    switchCart,
    cart,
    customer,
    cartCurrency,
    totalAmount,
    formatMoney,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemPrice,
    clearCart,
    setCustomer,
    itemCount,
  } = usePosMultiCart();

  const { data: warehouses } = useWarehouses();
  const { quickCheckout } = usePosActions();
  const debouncedSearch = useDebouncedValue(searchTerm, 200);
  const { data: catalogData, isLoading: productsLoading } = usePosCatalog(
    selectedWarehouseId,
    debouncedSearch,
    { enabled: !!selectedWarehouseId },
  );

  usePosRealtime(!!selectedWarehouseId);
  const activeWarehouse = warehouses?.find(
    (w: { id: string }) => w.id === selectedWarehouseId,
  );

  const canChangePrice = can('pos.change_price');
  const canOverridePrice = can('pos.override_price');
  const canUseCredit = can('pos.credit');
  const showPriceEdit =
    !permLoading && (canChangePrice || canOverridePrice);

  useEffect(() => {
    if (!warehouses?.length) {
      if (selectedWarehouseId) setSelectedWarehouseId(null);
      return;
    }
    const stillValid = selectedWarehouseId
      ? warehouses.some((w: { id: string }) => w.id === selectedWarehouseId)
      : false;
    if (!stillValid) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  useEffect(() => {
    if (!session) return;
    setSessionRole((session.role || '').toUpperCase());
    setCashierName(session.me?.user?.fullName || '');
    const posEnabled = isModuleKeyEnabled(session.features, 'POS');
    setPosGate(posEnabled ? 'ok' : 'blocked');

    if (posEnabled) {
      let alive = true;
      (async () => {
        try {
          const { data } = await api.get('/companies/pos-settings');
          if (!alive) return;
          setPosCreditEnabled(!!data?.posCreditEnabled);
          if (typeof data?.posMaxDiscountPercent === 'number') {
            setPosMaxDiscountPercent(data.posMaxDiscountPercent);
          }
        } catch {
          if (alive) {
            setPosCreditEnabled(false);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }
  }, [session]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allVariants = useMemo((): PosCatalogVariant[] => {
    if (!catalogData?.items?.length || !selectedWarehouseId) return [];
    return catalogData.items.map((v: PosCatalogItem) => ({
      id: v.id,
      productId: v.productId,
      productName: v.productName,
      name: v.name,
      salePrice: v.salePrice,
      currency: v.currency,
      barcode: v.barcode ?? undefined,
      image: v.image ?? undefined,
      categoryId: v.categoryId ?? undefined,
      categoryName: v.categoryName || 'Boshqa',
    }));
  }, [catalogData, selectedWarehouseId]);

  const posCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of allVariants) {
      if (v.categoryId) {
        map.set(v.categoryId, v.categoryName || 'Boshqa');
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allVariants]);

  const filteredVariants = useMemo(() => {
    return allVariants.filter(
      (v: PosCatalogVariant) =>
        !selectedCategory || v.categoryId === selectedCategory,
    );
  }, [allVariants, selectedCategory]);

  const handleConfirmPayment = async () => {
    if (!selectedWarehouseId) {
      if (!warehouses || warehouses.length === 0) {
        toast.error(
          "Sizga hech qanday ombor biriktirilmagan. Kompaniya egasidan jamoa sahifasida sizga ombor biriktirishni so'rang.",
        );
      } else {
        toast.error('Iltimos, omborni tanlang');
      }
      return;
    }
    if (cart.length === 0) return;

    if (
      paymentMethod === 'credit' &&
      !customer.retailCustomerId &&
      !customer.customerName
    ) {
      toast.error('Nasiya uchun mijoz tanlang yoki ism kiriting');
      return;
    }

    setIsProcessing(true);
    try {
      const methodApi =
        paymentMethod === 'cash'
          ? 'CASH'
          : paymentMethod === 'card'
            ? 'CARD'
            : 'CREDIT';
      const cashVal =
        paymentMethod === 'cash' ? Number(cashReceivedInput) : undefined;

      const saleResult = await quickCheckout.mutateAsync({
        warehouseId: selectedWarehouseId,
        items: cart.map((item) => ({
          productVariantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        retailCustomerId: customer.retailCustomerId || undefined,
        customerName: customer.customerName || undefined,
        customerPhone: customer.customerPhone || undefined,
        method: methodApi,
        ...(cashVal !== undefined ? { cashReceived: cashVal } : {}),
      });

      const newReceipt: ReceiptData = {
        receiptNumber: saleResult?.receiptNumber || saleResult?.id?.substring(0, 8) || undefined,
        date: new Date(),
        cashierName,
        warehouseName: activeWarehouse?.name || '',
        items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, amount: i.quantity * i.price })),
        total: totalAmount,
        currency: cartCurrency,
        paymentMethod: methodApi,
        customerName: customer.customerName || customer.retailCustomerId || undefined,
        cashReceived: cashVal,
        change: methodApi === 'CASH' && cashVal ? Math.max(0, cashVal - totalAmount) : 0,
      };

      setReceiptData(newReceipt);
      setIsCheckoutModalOpen(false);
      clearCart();
      setCashReceivedInput('');
    } catch (err: unknown) {
      console.error(err);
      toast.error(formatApiError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  if (posGate === 'loading') return <PosLoadingScreen />;
  if (posGate === 'blocked') return <PosBlockedScreen />;

  const isSalesRole = sessionRole === 'SALES';
  const isOwner = sessionRole === 'OWNER';
  const showDashboardBack = sessionRole !== null && sessionRole !== 'SALES';

  const handleSelectWarehouse = (warehouseId: string) => {
    if (warehouseId === selectedWarehouseId) {
      setIsWarehouseOpen(false);
      return;
    }
    setSelectedWarehouseId(warehouseId);
    setSelectedCategory(null);
    clearCart();
    setIsWarehouseOpen(false);
  };
  const creditCustomerOk =
    !!customer.retailCustomerId || !!customer.customerName;

  const handleAddVariantToCart = (v: {
    id: string;
    productId: string;
    productName: string;
    name: string;
    salePrice?: number | string;
    currency?: string;
    image?: string;
  }) =>
    addToCart({
      id: v.id,
      productId: v.productId,
      productName: v.productName,
      name: v.name,
      salePrice: v.salePrice,
      currency: v.currency,
      image: v.image,
    });

  return (
    <div className={`h-screen bg-[#050505] text-white flex flex-col md:flex-row overflow-hidden p-4 md:p-8 gap-4 md:gap-8 ${theme === 'light' ? 'pos-light-theme' : ''}`}>
      <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
        <PosBarcodeScanner
          warehouseId={selectedWarehouseId}
          onAddItem={handleAddVariantToCart}
        />
        <PosProductCatalog
          searchInputRef={searchInputRef}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          categories={posCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          filteredVariants={filteredVariants}
          productsLoading={productsLoading}
          warehouseName={activeWarehouse?.name}
          showWarehousePicker={isOwner}
          warehouses={warehouses}
          selectedWarehouseId={selectedWarehouseId}
          isWarehouseOpen={isWarehouseOpen}
          onWarehouseOpenToggle={() => setIsWarehouseOpen((v) => !v)}
          onWarehouseClose={() => setIsWarehouseOpen(false)}
          onSelectWarehouse={handleSelectWarehouse}
          showDashboardBack={showDashboardBack}
          isSalesRole={isSalesRole}
          cashierName={cashierName}
          formatMoney={formatMoney}
          onBack={() => router.push('/dashboard')}
          onLogout={() => authService.logout()}
          onAddToCart={handleAddVariantToCart}
          theme={theme}
          onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        />
      </div>

      <PosMobileCartBar
        itemCount={itemCount}
        totalAmount={totalAmount}
        formatMoney={(v) => formatMoney(v, cartCurrency)}
        onOpen={() => setIsCartOpenMobile(true)}
      />

      <PosCartSidebar
        cart={cart}
        customer={customer}
        totalAmount={totalAmount}
        isCartOpenMobile={isCartOpenMobile}
        formatMoney={formatMoney}
        onCustomerChange={setCustomer}
        onClearCart={clearCart}
        onCloseMobile={() => setIsCartOpenMobile(false)}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        onCheckout={() => {
          setIsCartOpenMobile(false);
          setIsCheckoutModalOpen(true);
        }}
        onEditPrice={setPriceEditItem}
        showPriceEdit={showPriceEdit}
        sessions={sessions}
        activeId={activeId}
        onAddCart={addCart}
        onSwitchCart={switchCart}
        onRemoveCart={removeCart}
      />

      <PosCheckoutModal
        open={isCheckoutModalOpen}
        totalAmount={totalAmount}
        cartCurrency={cartCurrency}
        paymentMethod={paymentMethod}
        posCreditEnabled={posCreditEnabled && canUseCredit}
        cashReceivedInput={cashReceivedInput}
        isProcessing={isProcessing}
        creditCustomerOk={creditCustomerOk}
        formatMoney={formatMoney}
        onClose={() => setIsCheckoutModalOpen(false)}
        onPaymentMethodChange={setPaymentMethod}
        onCashInputChange={setCashReceivedInput}
        onConfirm={handleConfirmPayment}
      />

      <PosPriceEditModal
        open={!!priceEditItem}
        item={priceEditItem}
        maxDiscountPercent={posMaxDiscountPercent}
        canOverridePrice={canOverridePrice}
        canChangePrice={canChangePrice}
        formatMoney={formatMoney}
        onClose={() => setPriceEditItem(null)}
        onSave={updateItemPrice}
      />

      <PosReceiptPrintModal
        open={!!receiptData}
        data={receiptData}
        onClose={() => setReceiptData(null)}
        formatMoney={formatMoney}
      />
    </div>
  );
}
