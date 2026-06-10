import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Vibration,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Plus, LayoutGrid, List, Search, ChevronDown, ShoppingCart, LogOut, ScanLine, ArrowLeft, User, X } from 'lucide-react-native';
import { PosCustomerPickerSheet } from '../../components/pos/PosCustomerPickerSheet';
import { getPosCustomerLabel, hasPosCustomer, type PosCustomerSelection } from '../../lib/pos-customer.util';
import { nextSessionLabel } from '../../lib/pos-session.util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api, fixImageUrl } from '../../api/client';
import { confirmLogout } from '../../auth/session';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInventoryRealtime } from '../../hooks/useInventoryRealtime';
import {
  fetchPosCatalog,
  invalidatePosCatalogCache,
  mapCatalogItemToStockRow,
  searchPosByBarcode,
} from '../../lib/pos-catalog';
import { cacheGet, cacheSet, DEFAULT_CACHE_TTL_MS } from '../../lib/data-cache';

export default function POSScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [catalogRows, setCatalogRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const catalogFetchRef = useRef(0);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [userRole, setUserRole] = useState('');

  // Multi-cart state
  type CartSession = {
    id: string;
    label: string;
    cart: any[];
    customer?: PosCustomerSelection | null;
  };
  const [cartSessions, setCartSessions] = useState<CartSession[]>([
    { id: '1', label: 'Mijoz 1', cart: [], customer: null },
  ]);
  const [activeCartId, setActiveCartId] = useState('1');
  const [searchOpen, setSearchOpen] = useState(false);
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);

  // Compute active cart for UI
  const activeSession = cartSessions.find(s => s.id === activeCartId) || cartSessions[0];
  const cart = activeSession.cart;

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const loadCatalog = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      if (!selectedWarehouseId) return;

      const search = debouncedSearch.trim();
      const cacheKey = `pos:rows:${selectedWarehouseId}:${search}`;

      if (!opts?.force) {
        const cached = cacheGet<any[]>(cacheKey);
        if (cached) {
          setCatalogRows(cached);
          if (!opts?.silent) setCatalogLoading(false);
        }
      }

      const fetchId = ++catalogFetchRef.current;
      if (!opts?.silent) setCatalogLoading(true);

      try {
        const { items } = await fetchPosCatalog(selectedWarehouseId, {
          search,
          limit: 120,
          force: opts?.force,
        });
        if (fetchId !== catalogFetchRef.current) return;

        const rows = items.map(mapCatalogItemToStockRow);
        setCatalogRows(rows);
        cacheSet(cacheKey, rows, DEFAULT_CACHE_TTL_MS);
      } catch (error) {
        console.error('Error fetching POS catalog:', error);
      } finally {
        if (fetchId === catalogFetchRef.current) {
          setCatalogLoading(false);
        }
      }
    },
    [selectedWarehouseId, debouncedSearch],
  );

  useEffect(() => {
    if (selectedWarehouseId) {
      void loadCatalog();
    }
  }, [selectedWarehouseId, debouncedSearch, loadCatalog]);

  useEffect(() => {
    let filtered = catalogRows;
    if (selectedCategoryId) {
      filtered = filtered.filter(
        (item: any) => item.productVariant?.product?.categoryId === selectedCategoryId,
      );
    }
    setProducts(filtered);
  }, [catalogRows, selectedCategoryId]);

  useInventoryRealtime({
    enabled: Boolean(selectedWarehouseId),
    warehouseId: selectedWarehouseId,
    onChanged: () => {
      invalidatePosCatalogCache(selectedWarehouseId || undefined);
      void loadCatalog({ silent: true, force: true });
    },
  });

  // Savatchani tozalash va yangilash logikasi (Event orqali)
  useEffect(() => {
    const updateSub = DeviceEventEmitter.addListener('cart_updated', (updatedCart) => {
      setCartSessions(prev => prev.map(s => s.id === activeCartId ? { ...s, cart: updatedCart } : s));
    });
    
    const clearSub = DeviceEventEmitter.addListener('cart_cleared', (payload?: {
      soldItems?: { productVariantId: string; quantity: number }[];
      warehouseId?: string;
    }) => {
      setCartSessions(prev => prev.map(s => s.id === activeCartId ? { ...s, cart: [] } : s));

      if (payload?.soldItems?.length && payload.warehouseId === selectedWarehouseId) {
        setCatalogRows((prev) =>
          prev.map((row) => {
            const variantId = row.productVariant?.id;
            const sold = payload.soldItems!.find((s) => s.productVariantId === variantId);
            if (!sold) return row;
            return {
              ...row,
              quantity: Math.max(0, Number(row.quantity) - sold.quantity),
            };
          }).filter((row) => Number(row.quantity) > 0),
        );
        invalidatePosCatalogCache(selectedWarehouseId || undefined);
      }
    });

    return () => {
      updateSub.remove();
      clearSub.remove();
    };
  }, [activeCartId, selectedWarehouseId]);

  const fetchInitialData = async () => {
    try {
      const u = await AsyncStorage.getItem('user');
      if (u) {
        setUserRole(JSON.parse(u).role);
      }

      const whKey = 'pos:warehouses';
      const catKey = 'pos:categories';
      const cachedWh = cacheGet<any[]>(whKey);
      const cachedCat = cacheGet<any[]>(catKey);
      if (cachedWh) setWarehouses(cachedWh);
      if (cachedCat) setCategories([{ id: null, name: 'Barchasi' }, ...cachedCat]);

      const [catRes, whRes] = await Promise.all([
        api.get('/product-categories'),
        api.get('/warehouses'),
      ]);
      const catList = Array.isArray(catRes.data) ? catRes.data : [];
      const whList = Array.isArray(whRes.data) ? whRes.data : [];
      cacheSet(catKey, catList, DEFAULT_CACHE_TTL_MS);
      cacheSet(whKey, whList, DEFAULT_CACHE_TTL_MS);
      setCategories([{ id: null, name: 'Barchasi' }, ...catList]);
      setWarehouses(whList);
      if (whList.length > 0) {
        setSelectedWarehouseId(whList[0].id);
      }
    } catch (error) {
      console.error('Error fetching categories or warehouses:', error);
    }
  };

  const addToCart = (product: any) => {
    const stockQty = Number(product.quantity);
    if (Number.isFinite(stockQty) && stockQty <= 0) {
      Alert.alert('Qoldiq yo‘q', 'Ushbu mahsulot omborda tugagan');
      return;
    }

    // Joriy aktiv savatchani topamiz
    const activeSession = cartSessions.find(s => s.id === activeCartId);
    
    if (activeSession && activeSession.cart.length > 0) {
      // Savatdagi birinchi mahsulot valyutasi
      const firstVariant = activeSession.cart[0].product.variants?.[0] || activeSession.cart[0].product.productVariant || {};
      const cartCurrency = firstVariant.currency || 'UZS';
      
      // Yangi qo'shilayotgan mahsulot valyutasi
      const newVariant = product.variants?.[0] || product.productVariant || {};
      const newCurrency = newVariant.currency || 'UZS';
      
      if (cartCurrency !== newCurrency) {
        Alert.alert(
          'Xatolik', 
          'Bitta chekda faqat bitta valyutali mahsulotlar bo\'lishi mumkin. Boshqa valyuta uchun yangi savatcha (Mijoz +) oching.'
        );
        return;
      }
    }

    setCartSessions(prev => prev.map(s => {
      if (s.id !== activeCartId) return s;
      const existing = s.cart.find((item: any) => item.product.id === product.id);
      if (existing) {
        return {
          ...s,
          cart: s.cart.map((item: any) => 
            item.product.id === product.id 
              ? { ...item, qty: item.qty + 1 } 
              : item
          )
        };
      }
      return { ...s, cart: [...s.cart, { product, qty: 1 }] };
    }));
  };

  const handleAddCart = () => {
    const newId = Date.now().toString();
    setCartSessions((prev) => {
      const newLabel = nextSessionLabel(prev);
      return [...prev, { id: newId, label: newLabel, cart: [], customer: null }];
    });
    setActiveCartId(newId);
  };

  const setActiveSessionCustomer = (customer: PosCustomerSelection | null) => {
    setCartSessions((prev) =>
      prev.map((s) => (s.id === activeCartId ? { ...s, customer } : s)),
    );
  };

  const handleRemoveCart = (id: string) => {
    setCartSessions(prev => {
      if (prev.length === 1) {
        return [{ ...prev[0], cart: [] }];
      }
      const next = prev.filter(s => s.id !== id);
      if (activeCartId === id) {
        setActiveCartId(next[next.length - 1].id);
      }
      return next;
    });
  };

  // Helper to format price
  const formatPrice = (price: number, currency: string) => {
    const num = Number(price) || 0;
    if (currency === 'USD') return `$${num.toLocaleString()}`;
    return `${num.toLocaleString()} so'm`;
  };

  // Group total cart price by currency
  const totalsByCurrency = cart.reduce((acc, item) => {
    const variant = item.product.variants?.[0] || {};
    const price = Number(variant.salePrice || 0);
    const currency = variant.currency || 'UZS';
    
    if (!acc[currency]) acc[currency] = 0;
    acc[currency] += price * item.qty;
    return acc;
  }, {} as Record<string, number>);

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  const navigateToCart = () => {
    navigation.navigate('POSCart', {
      cart,
      warehouseId: selectedWarehouseId,
      customer: activeSession.customer || null,
    });
  };

  const showSessionsBar = cartSessions.length > 1;
  const showBottomDock = showSessionsBar || cart.length > 0;
  const listBottomPad = showBottomDock
    ? (showSessionsBar ? 158 : 108) + insets.bottom
    : 16 + insets.bottom;
  const customerLabel = getPosCustomerLabel(activeSession.customer);
  const hasCustomer = hasPosCustomer(activeSession.customer);

  const handleLogout = async () => {
    confirmLogout(navigation);
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Ruxsat yo‘q', 'Kamera orqali skanerlash uchun ruxsat kerak!');
        return;
      }
    }
    scanLock.current = false;
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ type, data }: { type: string, data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    Vibration.vibrate(); // Skanerlanganda qisqa titrash
    setIsScanning(false);
    
    // UI qotib qolmasligi va modal tezroq yopilishi uchun 
    // savatga qo'shishni (re-render) biroz orqaga suramiz
    setTimeout(async () => {
      if (!selectedWarehouseId) return;

      let foundItem = catalogRows.find((item) => item.productVariant?.barcode === data);
      if (!foundItem) {
        foundItem = await searchPosByBarcode(selectedWarehouseId, data);
      }

      if (foundItem) {
        const variant = foundItem.productVariant;
        addToCart({
          ...foundItem,
          product: variant.product,
          variants: [variant],
        });
      } else {
        Alert.alert('Topilmadi', `Barkod bo'yicha mahsulot topilmadi: ${data}`);
      }
    }, 150);
  };

  const renderCategoryTab = ({ item }: any) => {
    const isSelected = item.id === selectedCategoryId;
    return (
      <TouchableOpacity 
        style={[styles.tab, isSelected && styles.tabActive]}
        onPress={() => setSelectedCategoryId(item.id)}
      >
        <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderProductItem = ({ item }: any) => {
    const isGrid = viewMode === 'grid';
    // Use the product variant from stock balance
    const variant = item.productVariant || {};
    const product = variant.product || {};
    const price = variant.salePrice || 0;
    const currency = variant.currency || 'UZS';
    const imageUrl = fixImageUrl(product.imageUrl || variant.imageUrl);
    const displayName = `${product.name} ${variant.name}`;
    const stockQty = Number(item.quantity);
    const outOfStock = Number.isFinite(stockQty) && stockQty <= 0;
    const lowStock = Number.isFinite(stockQty) && stockQty > 0 && stockQty <= 5;

    return (
      <View style={[styles.card, !isGrid && styles.cardList, outOfStock && styles.cardDisabled]}>
        <View style={[styles.imageContainer, !isGrid && styles.imageContainerList]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <Package size={isGrid ? 40 : 24} color="#94a3b8" />
          )}
          {Number.isFinite(stockQty) && (
            <View
              style={[
                styles.stockBadge,
                outOfStock && styles.stockBadgeOut,
                lowStock && !outOfStock && styles.stockBadgeLow,
              ]}
            >
              <Text style={styles.stockBadgeText}>
                {outOfStock ? 'Tugagan' : `${stockQty} dona`}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.infoContainer, !isGrid && styles.infoContainerList]}>
          <Text style={[styles.name, !isGrid && styles.nameList]} numberOfLines={isGrid ? 2 : 1}>
            {displayName}
          </Text>
          <View style={[styles.bottomRow, !isGrid && styles.bottomRowList]}>
            <View style={!isGrid && { flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.priceLabel}>Narxi:</Text>
              <Text style={styles.priceValue}>{formatPrice(price, currency)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.selectButton, outOfStock && styles.selectButtonDisabled]}
              disabled={outOfStock}
              onPress={() => addToCart({ ...item, product, variants: [variant] })}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {userRole === 'OWNER' && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={20} color="#1e293b" />
          </TouchableOpacity>
        )}

        {/* Warehouse Dropdown Trigger */}
        {userRole === 'OWNER' && !searchOpen && (
          <TouchableOpacity 
            style={styles.whSelector} 
            onPress={() => setShowWarehouseModal(true)}
          >
            <Text style={styles.whSelectorText} numberOfLines={1}>
              {selectedWarehouse ? selectedWarehouse.name : 'Omborni tanlang'}
            </Text>
            <ChevronDown size={16} color="#888" />
          </TouchableOpacity>
        )}

        {!searchOpen ? (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setSearchOpen(true)}
          >
            <Search color="#3b82f6" size={20} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={handleOpenScanner}
        >
          <ScanLine color="#3b82f6" size={20} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
        >
          {viewMode === 'grid' ? <List color="#1e293b" size={20} /> : <LayoutGrid color="#1e293b" size={20} />}
        </TouchableOpacity>

        {cartSessions.length === 1 && (
          <TouchableOpacity style={styles.toggleButton} onPress={handleAddCart}>
            <Plus color="#3b82f6" size={20} />
          </TouchableOpacity>
        )}

        {userRole === 'SALES' && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color="#ef4444" size={20} />
          </TouchableOpacity>
        )}
      </View>

      {searchOpen && (
        <View style={styles.searchExpandedRow}>
          <Search size={16} color="#64748b" />
          <TextInput
            style={styles.searchExpandedInput}
            placeholder="Mahsulot qidirish..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity
            onPress={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
            style={styles.searchCloseBtn}
          >
            <X size={18} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c, idx) => c.id || idx.toString()}
          renderItem={renderCategoryTab}
          contentContainerStyle={styles.tabsContainer}
        />
      </View>

      {catalogLoading && products.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Package size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Mahsulotlar topilmadi</Text>
        </View>
      ) : (
        <FlatList
          key={viewMode}
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={[styles.listContainer, { paddingBottom: listBottomPad }]}
          columnWrapperStyle={viewMode === 'grid' ? styles.row : undefined}
        />
      )}

      {showBottomDock && (
        <View style={[styles.bottomDock, { paddingBottom: 12 + insets.bottom }]}>
          {showSessionsBar && (
            <View style={styles.sessionsRow}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={cartSessions}
                keyExtractor={(s) => s.id}
                renderItem={({ item }) => {
                  const count = item.cart.reduce((sum: number, i: any) => sum + Number(i.qty || 0), 0);
                  const subtitle = getPosCustomerLabel(item.customer);
                  return (
                    <TouchableOpacity
                      style={[styles.sessionTab, activeCartId === item.id && styles.sessionTabActive]}
                      onPress={() => setActiveCartId(item.id)}
                      onLongPress={() => handleRemoveCart(item.id)}
                    >
                      <Text
                        style={[
                          styles.sessionTabText,
                          activeCartId === item.id && styles.sessionTabTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                        {count > 0 ? ` (${count})` : ''}
                      </Text>
                      {subtitle ? (
                        <Text style={styles.sessionSubtitle} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.sessionsList}
              />
              <TouchableOpacity style={styles.addSessionBtn} onPress={handleAddCart}>
                <Plus size={16} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          )}

          {cart.length > 0 && (
            <View style={styles.cartBar}>
              <TouchableOpacity
                style={styles.customerBtn}
                onPress={() => setCustomerSheetOpen(true)}
              >
                <User size={18} color={hasCustomer ? '#38bdf8' : '#fff'} />
                {hasCustomer ? (
                  <Text style={styles.customerBtnLabel} numberOfLines={1}>
                    {customerLabel}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cartInfoTap} onPress={navigateToCart}>
                <View style={styles.cartIconWrapper}>
                  <ShoppingCart size={20} color="#fff" />
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cart.reduce((sum, item) => sum + Number(item.qty || 0), 0)}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cartTotalLabel}>Jami summa</Text>
                  {Object.entries(totalsByCurrency).map(([currency, total]) => (
                    <Text key={currency} style={styles.cartTotalValue} numberOfLines={1}>
                      {formatPrice(Number(total), currency)}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.checkoutBtn} onPress={navigateToCart}>
                <Text style={styles.checkoutText}>Sotish</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <PosCustomerPickerSheet
        visible={customerSheetOpen}
        value={activeSession.customer}
        onSelect={setActiveSessionCustomer}
        onClose={() => setCustomerSheetOpen(false)}
      />

      {/* Warehouse Selection Modal */}
      <Modal visible={showWarehouseModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Qaysi ombordan savdo qilasiz?</Text>
            {warehouses.map(w => (
              <TouchableOpacity 
                key={w.id} 
                style={[styles.modalItem, selectedWarehouseId === w.id && styles.modalItemActive]}
                onPress={() => {
                  setSelectedWarehouseId(w.id);
                  setShowWarehouseModal(false);
                }}
              >
                <Text style={[styles.modalItemText, selectedWarehouseId === w.id && styles.modalItemTextActive]}>
                  {w.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowWarehouseModal(false)}>
              <Text style={styles.modalCloseText}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Scanner Modal */}
      <Modal visible={isScanning} animationType="slide" onRequestClose={() => setIsScanning(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Barkodni Skanerlash</Text>
            <TouchableOpacity onPress={() => setIsScanning(false)} style={{ padding: 8 }}>
              <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: 'bold' }}>Yopish</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, position: 'relative' }}>
            <CameraView 
              style={{ flex: 1 }} 
              facing="back"
              onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
              }}
            />
            {/* O'rtadagi skaner ramkasi */}
            <View style={styles.scannerFrame}>
              <View style={styles.scannerBox} />
              <Text style={styles.scannerText}>Kamerani barkodga qaratib turing</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48, 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 8
  },
  whSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    minWidth: 0,
    maxWidth: 200,
    justifyContent: 'space-between',
  },
  searchExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchExpandedInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: '#0f172a',
  },
  searchCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whSelectorText: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 4,
  },
  searchContainer: {
    flex: 1, // takes remaining space
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#1e293b',
    fontSize: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    justifyContent: 'center',
    alignItems: 'center'
  },
  filtersWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  sessionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  sessionsList: {
    gap: 8,
    paddingRight: 4,
  },
  sessionTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 120,
  },
  sessionTabActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  sessionTabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  sessionTabTextActive: {
    color: '#2563eb',
  },
  sessionSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  addSessionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  row: {
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stockBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockBadgeLow: {
    backgroundColor: 'rgba(234, 88, 12, 0.9)',
  },
  stockBadgeOut: {
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
  },
  stockBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardDisabled: {
    opacity: 0.72,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    height: 40,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardList: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    padding: 12,
  },
  imageContainerList: {
    width: 64,
    height: 64,
    aspectRatio: undefined,
    borderRadius: 8,
    marginRight: 12,
  },
  infoContainerList: {
    flex: 1,
    padding: 0,
  },
  nameList: {
    height: 'auto',
    marginBottom: 8,
    fontSize: 16,
  },
  bottomRowList: {
    alignItems: 'center',
  },
  priceLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  priceValue: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectButtonDisabled: {
    backgroundColor: '#94a3b8',
  },

  cartBar: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  customerBtn: {
    width: 48,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  customerBtnLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 2,
    maxWidth: 44,
    textAlign: 'center',
  },
  cartInfoTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  cartIconWrapper: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6'
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cartTotalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  cartTotalValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  checkoutText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Modal Styles
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalItem: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  modalItemText: {
    color: '#334155',
    fontSize: 16,
    textAlign: 'center',
  },
  modalItemTextActive: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  modalCloseBtn: {
    marginTop: 16,
    padding: 16,
  },
  modalCloseText: {
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  scannerFrame: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerBox: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  scannerText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 14,
    fontWeight: 'bold',
  }
});
