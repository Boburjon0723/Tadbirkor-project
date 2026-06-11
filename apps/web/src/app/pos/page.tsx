'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { toast } from '@/lib/toast';
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
import { PosCustomerMobileSheet } from '@/features/pos/PosCustomerMobileSheet';
import { PosPriceEditModal } from '@/features/pos/PosPriceEditModal';
import { PosBarcodeScanner } from '@/features/pos/PosBarcodeScanner';
import { usePosMultiCart } from '@/features/pos/usePosMultiCart';
import { posCartStorageKey } from '@/features/pos/pos-cart-persist';
import type { PosCartItem } from '@/features/pos/types';
import type { PosReceiptSettings } from '@/components/settings/SettingsPosReceiptSection';
import { markPosPrinterReady } from '@/features/pos/pos-receipt-print.util';
import { getPosCustomerLabel, hasPosCustomer } from '@/features/pos/pos-customer.util';
import { usePosCheckout } from '@/features/pos/usePosCheckout';
import {
  PosQuantityModal,
  type PosQuantityModalVariant,
} from '@/features/pos/PosQuantityModal';
import {
  allowsDecimalStock,
  formatStockQuantity,
  normalizeProductUnit,
} from '@/lib/product-units';
import { playPosScanSound } from '@/features/pos/pos-scan-feedback.util';
import { usePosBarcodeScan } from '@/features/pos/hooks/use-pos-barcode-scan';
import { getScanAddQuantityLabel } from '@/features/pos/pos-scan-quantity.util';

export default function POSPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { can, loading: permLoading } = usePermissions();

  const { data: session } = useSession();
  const [posGate, setPosGate] = useState<'loading' | 'ok' | 'blocked'>('loading');
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [cashierName, setCashierName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [quantityModalVariant, setQuantityModalVariant] =
    useState<PosQuantityModalVariant | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'card' | 'credit'
  >('cash');
  const [posCreditEnabled, setPosCreditEnabled] = useState(false);
  const [posMaxDiscountPercent, setPosMaxDiscountPercent] = useState(15);
  const [posReceiptSettings, setPosReceiptSettings] = useState<PosReceiptSettings>({
    autoPrint: true,
    receiptFormat: 'thermal',
  });
  // customer state is now managed inside usePosMultiCart per session
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('list');
  const [priceEditItem, setPriceEditItem] = useState<PosCartItem | null>(null);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);

  const cartStorageKey = useMemo(() => {
    const companyId = session?.me?.company?.id;
    const userId = session?.me?.user?.id;
    if (!companyId || !userId || !selectedWarehouseId) return null;
    return posCartStorageKey(companyId, userId, selectedWarehouseId);
  }, [session?.me?.company?.id, session?.me?.user?.id, selectedWarehouseId]);

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
    setItemQuantity,
    updateItemPrice,
    clearCart,
    setCustomer,
    itemCount,
  } = usePosMultiCart({ storageKey: cartStorageKey });

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
    setCompanyName(session.me?.company?.name || '');
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
          if (data?.receiptSettings) {
            const receiptSettings: PosReceiptSettings = {
              autoPrint: !!data.receiptSettings.autoPrint,
              receiptFormat: data.receiptSettings.receiptFormat || 'thermal',
            };
            setPosReceiptSettings(receiptSettings);
            if (receiptSettings.receiptFormat !== 'none') markPosPrinterReady();
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
      unit: v.unit,
      stockQuantity: v.quantity,
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

  const { paymentInFlight, confirmPayment } = usePosCheckout({
    cart,
    customer,
    totalAmount,
    cartCurrency,
    paymentMethod,
    cashReceivedInput,
    selectedWarehouseId,
    warehouseName: activeWarehouse?.name || '',
    companyName,
    cashierName,
    posReceiptSettings,
    formatMoney,
    quickCheckout: (dto) => quickCheckout.mutateAsync(dto),
    onClearActiveCart: clearCart,
    onPaymentStarted: () => setIsCheckoutModalOpen(false),
    onPaymentSuccess: () => {
      setCashReceivedInput('');
      setPaymentMethod('cash');
    },
    onPaymentFailed: () => setIsCheckoutModalOpen(true),
  });

  const handleConfirmPayment = () => {
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
    confirmPayment();
  };

  const handleAddVariantToCart = useCallback(
    (v: PosQuantityModalVariant, opts?: { silent?: boolean }) => {
      if (paymentInFlight) return;
      if (v.stockQuantity !== undefined && v.stockQuantity <= 0) {
        if (!opts?.silent) {
          playPosScanSound('error');
          toast.warning(`${v.productName} — omborda qoldiq yo'q`);
        }
        return;
      }

      const unit = normalizeProductUnit(v.unit);
      if (allowsDecimalStock(unit)) {
        setQuantityModalVariant(v);
        return;
      }

      addToCart({
        id: v.id,
        productId: v.productId,
        productName: v.productName,
        name: v.name,
        salePrice: v.salePrice,
        currency: v.currency,
        unit: v.unit,
        stockQuantity: v.stockQuantity,
        image: v.image,
      });

      if (!opts?.silent) {
        const { label } = getScanAddQuantityLabel(v.unit);
        playPosScanSound('success');
        toast.success(`+${label} · ${v.productName}`, { duration: 2200 });
      }
    },
    [addToCart],
  );

  const posScan = usePosBarcodeScan({
    warehouseId: selectedWarehouseId,
    onAddItem: (v) => handleAddVariantToCart(v, { silent: true }),
    disabled: posGate !== 'ok',
  });

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
    setIsWarehouseOpen(false);
  };
  const creditCustomerOk = hasPosCustomer(customer);
  const hasCustomer = creditCustomerOk;
  const customerLabel = getPosCustomerLabel(customer);
  const openCustomerSheet = () => setCustomerSheetOpen(true);

  const openCheckout = () => {
    if (paymentInFlight) return;
    setIsCartOpenMobile(false);
    setPaymentMethod('cash');
    setCashReceivedInput(String(totalAmount));
    setIsCheckoutModalOpen(true);
  };

  const showMobileDock = sessions.length > 1 || itemCount > 0;

  const handleQuantityConfirm = (
    v: PosQuantityModalVariant,
    quantity: number,
  ) => {
    addToCart({
      id: v.id,
      productId: v.productId,
      productName: v.productName,
      name: v.name,
      salePrice: v.salePrice,
      currency: v.currency,
      unit: v.unit,
      stockQuantity: v.stockQuantity,
      image: v.image,
      quantity,
    });
    const qtyText = formatStockQuantity(
      quantity,
      normalizeProductUnit(v.unit),
    );
    toast.success(`+${qtyText} · ${v.productName}`, { duration: 2200 });
    playPosScanSound('success');
  };

  return (
    <div
      className={`pos-shell h-screen flex flex-col md:flex-row overflow-hidden p-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:p-8 md:pt-8 gap-2 md:gap-8 bg-[var(--pos-bg)] ${theme === 'light' ? 'pos-theme-light' : ''}`}
    >
      <div className="flex-1 flex flex-col gap-1 md:gap-2 min-w-0 min-h-0">
        <PosBarcodeScanner
          warehouseId={selectedWarehouseId}
          onAddItem={(v) => handleAddVariantToCart(v, { silent: true })}
          scanControl={posScan}
          hideMobileChrome
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
          onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onScanClick={posScan.openCamera}
          scanStatus={posScan.status}
          scanStatusHint={posScan.statusHint}
          sessionCount={sessions.length}
          onAddCart={addCart}
        />
      </div>

      <PosMobileCartBar
        sessions={sessions}
        activeId={activeId}
        itemCount={itemCount}
        totalAmount={totalAmount}
        formatMoney={(v) => formatMoney(v, cartCurrency)}
        customerLabel={customerLabel}
        hasCustomer={hasCustomer}
        visible={showMobileDock}
        onOpen={() => setIsCartOpenMobile(true)}
        onCheckout={openCheckout}
        onCustomerClick={openCustomerSheet}
        onSwitchCart={switchCart}
        onAddCart={addCart}
        onRemoveCart={removeCart}
        paymentInFlight={paymentInFlight}
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
        onSetQuantity={setItemQuantity}
        onRemove={removeFromCart}
        onCheckout={openCheckout}
        onEditPrice={setPriceEditItem}
        showPriceEdit={showPriceEdit}
        sessions={sessions}
        activeId={activeId}
        onAddCart={addCart}
        onSwitchCart={switchCart}
        onRemoveCart={removeCart}
        paymentInFlight={paymentInFlight}
        onOpenCustomerPicker={openCustomerSheet}
      />

      <PosCheckoutModal
        open={isCheckoutModalOpen}
        totalAmount={totalAmount}
        cartCurrency={cartCurrency}
        paymentMethod={paymentMethod}
        posCreditEnabled={posCreditEnabled && canUseCredit}
        cashReceivedInput={cashReceivedInput}
        creditCustomerOk={creditCustomerOk}
        customer={customer}
        formatMoney={formatMoney}
        onClose={() => setIsCheckoutModalOpen(false)}
        onPaymentMethodChange={setPaymentMethod}
        onCashInputChange={setCashReceivedInput}
        onCustomerChange={setCustomer}
        onConfirm={handleConfirmPayment}
        onOpenCustomerPicker={openCustomerSheet}
        processing={paymentInFlight}
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

      <PosQuantityModal
        open={!!quantityModalVariant}
        variant={quantityModalVariant}
        formatMoney={formatMoney}
        onClose={() => setQuantityModalVariant(null)}
        onConfirm={handleQuantityConfirm}
      />

      <PosCustomerMobileSheet
        open={customerSheetOpen}
        value={customer}
        onChange={setCustomer}
        onClose={() => setCustomerSheetOpen(false)}
      />

    </div>
  );
}
