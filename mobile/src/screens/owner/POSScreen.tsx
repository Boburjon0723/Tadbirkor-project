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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Plus, LayoutGrid, List, Search, ChevronDown, ShoppingCart, LogOut, ScanLine, ArrowLeft, Users } from 'lucide-react-native';
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
  type CartSession = { id: string; label: string; cart: any[] };
  const [cartSessions, setCartSessions] = useState<CartSession[]>([
    { id: '1', label: 'Mijoz 1', cart: [] }
  ]);
  const [activeCartId, setActiveCartId] = useState('1');

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
    setCartSessions(prev => {
      const newLabel = `Mijoz ${prev.length + 1}`;
      return [...prev, { id: newId, label: newLabel, cart: [] }];
    });
    setActiveCartId(newId);
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
      warehouseId: selectedWarehouseId
    });
  };

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

    return (
      <View style={[styles.card, !isGrid && styles.cardList]}>
        <View style={[styles.imageContainer, !isGrid && styles.imageContainerList]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <Package size={isGrid ? 40 : 24} color="#94a3b8" />
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
            <TouchableOpacity style={styles.selectButton} onPress={() => addToCart({ ...item, product, variants: [variant] })}>
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
        {userRole === 'OWNER' && (
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

        <View style={styles.searchContainer}>
          <Search size={16} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Qidiruv..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

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

        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => navigation.navigate('PosCustomers')}
        >
          <Users color="#3b82f6" size={20} />
        </TouchableOpacity>

        {userRole === 'SALES' && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color="#ef4444" size={20} />
          </TouchableOpacity>
        )}
      </View>

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

      {/* Multi-Cart Tabs */}
      <View style={styles.multiCartContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={cartSessions}
          keyExtractor={s => s.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.cartTab, activeCartId === item.id && styles.cartTabActive]}
              onPress={() => setActiveCartId(item.id)}
              onLongPress={() => handleRemoveCart(item.id)}
            >
              <Text style={[styles.cartTabText, activeCartId === item.id && styles.cartTabTextActive]}>
                {item.label} ({item.cart.reduce((sum: number, i: any) => sum + i.qty, 0)})
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        />
        <TouchableOpacity style={styles.addCartBtn} onPress={handleAddCart}>
          <Plus size={16} color="#fff" />
        </TouchableOpacity>
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
          contentContainerStyle={[styles.listContainer, cart.length > 0 && { paddingBottom: 100 }]}
          columnWrapperStyle={viewMode === 'grid' ? styles.row : undefined}
        />
      )}

      {/* Cart Bottom Bar */}
      {cart.length > 0 && (
        <View style={styles.cartBar}>
          <View style={styles.cartInfo}>
            <View style={styles.cartIconWrapper}>
              <ShoppingCart size={20} color="#fff" />
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
                </Text>
              </View>
            </View>
            <View>
              <Text style={styles.cartTotalLabel}>Jami summa</Text>
              {Object.entries(totalsByCurrency).map(([currency, total]) => (
                <Text key={currency} style={styles.cartTotalValue}>
                  {formatPrice(Number(total), currency)}
                </Text>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={navigateToCart}>
            <Text style={styles.checkoutText}>Sotish</Text>
          </TouchableOpacity>
        </View>
      )}

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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    width: 120, // max width to keep it small
    justifyContent: 'space-between',
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
  multiCartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  cartTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
  },
  cartTabActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  cartTabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cartTabTextActive: {
    color: '#3b82f6',
  },
  addCartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginLeft: 8,
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
  
  // Cart Styles
  cartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
