import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  RefreshControl,
  Modal,
  Alert,
  Dimensions,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Warehouse, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  ArrowLeftRight, 
  Clock, 
  Trash2, 
  X,
  AlertCircle,
  CheckCircle2,
  MapPin,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  Download,
  SlidersHorizontal,
  Settings,
  Tag
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';
import { useWarehouseScope } from '../../hooks/useWarehouseScope';
import { ExportStockFormatModal } from '../../components/warehouse/ExportStockFormatModal';
import { WarehouseImportModal } from '../../components/warehouse/WarehouseImportModal';
import { StockAdjustModal } from '../../components/warehouse/StockAdjustModal';
import { AddProductModal } from '../../components/warehouse/AddProductModal';
import { downloadAuthenticatedFile } from '../../utils/warehouse-download';
import { cacheGet, cacheSet, cacheInvalidatePrefix, DEFAULT_CACHE_TTL_MS } from '../../lib/data-cache';
import { useInventoryRealtime } from '../../hooks/useInventoryRealtime';

const { width: screenWidth } = Dimensions.get('window');

export default function WarehouseScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const whScope = useWarehouseScope();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'balances' | 'history' | 'products' | 'list'>('balances');
  const [searchTerm, setSearchTerm] = useState('');

  // Column / balances sorting settings
  const [sortBy, setSortBy] = useState<'name' | 'qty_desc' | 'qty_asc' | 'low_stock'>('name');

  // Warehouse Column / Field Config states
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configWarehouse, setConfigWarehouse] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [fieldConfig, setFieldConfig] = useState({
    showVariantName: true,
    showImage: true,
    showDescription: true,
    showSku: true,
    showBarcode: false,
    showColor: true,
    showTotalStock: true,
    showPurchasePrice: true,
    showSalePrice: true,
  });

  // REST Data states
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [exportFormatOpen, setExportFormatOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustBalance, setAdjustBalance] = useState<any>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);

  // Create Warehouse Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseAddress, setNewWarehouseAddress] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchAllData = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (whScope.loading) return;

    if (!whScope.activeWarehouseId && activeTab !== 'list') {
      setBalances([]);
      setMovements([]);
      setLoading(false);
      return;
    }

    const whId = whScope.activeWarehouseId;
    const whKey = 'warehouses:list';
    const balKey = whId ? `stock:balances:${whId}` : '';
    const movKey = whId ? `stock:movements:${whId}` : '';

    if (!opts?.force) {
      const cachedWh = cacheGet<any[]>(whKey);
      if (cachedWh) setWarehouses(cachedWh);
      if (whId) {
        const cachedBal = cacheGet<any[]>(balKey);
        const cachedMov = cacheGet<any[]>(movKey);
        if (cachedBal) setBalances(cachedBal);
        if (cachedMov) setMovements(cachedMov);
        if (cachedBal && cachedMov && !opts?.silent) {
          setLoading(false);
        }
      }
    }

    if (!opts?.silent) setLoading(true);

    try {
      const requests: Promise<any>[] = [api.get('/warehouses')];
      if (whId) {
        requests.push(
          api.get('/stock/balances', { params: { warehouseId: whId } }),
          api.get('/stock/movements', { params: { warehouseId: whId } }),
        );
      }

      const results = await Promise.allSettled(requests);
      const whRes = results[0];
      const balRes = results[1];
      const movRes = results[2];

      if (whRes.status === 'fulfilled') {
        const list = Array.isArray(whRes.value.data) ? whRes.value.data : [];
        setWarehouses(list);
        cacheSet(whKey, list, DEFAULT_CACHE_TTL_MS);
      }
      if (balRes?.status === 'fulfilled') {
        setBalances(balRes.value.data);
        if (balKey) cacheSet(balKey, balRes.value.data, DEFAULT_CACHE_TTL_MS);
      } else if (activeTab !== 'list') {
        setBalances([]);
      }
      if (movRes?.status === 'fulfilled') {
        setMovements(movRes.value.data);
        if (movKey) cacheSet(movKey, movRes.value.data, DEFAULT_CACHE_TTL_MS);
      } else if (activeTab !== 'list') {
        setMovements([]);
      }
    } catch (e) {
      console.error('Error fetching warehouse stats:', e);
    } finally {
      setLoading(false);
    }
  }, [whScope.loading, whScope.activeWarehouseId, activeTab]);

  useInventoryRealtime({
    enabled: !whScope.loading,
    warehouseId: whScope.activeWarehouseId,
    onChanged: () => {
      if (whScope.activeWarehouseId) {
        cacheInvalidatePrefix(`stock:balances:${whScope.activeWarehouseId}`);
        cacheInvalidatePrefix(`stock:movements:${whScope.activeWarehouseId}`);
      }
      void fetchAllData({ silent: true, force: true });
    },
  });

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (whScope.activeWarehouseId) {
      cacheInvalidatePrefix(`stock:balances:${whScope.activeWarehouseId}`);
      cacheInvalidatePrefix(`stock:movements:${whScope.activeWarehouseId}`);
    }
    cacheInvalidatePrefix('warehouses:');
    await fetchAllData({ force: true });
    setRefreshing(false);
  }, [fetchAllData, whScope.activeWarehouseId]);

  // Group balances by warehouse with custom column sorting
  const groupedBalances = React.useMemo(() => {
    if (!balances?.length) return [];
    
    // Filter balances by search term
    const filtered = balances.filter((b: any) => {
      const pName = b.productVariant?.product?.name || '';
      const vName = b.productVariant?.name || '';
      const query = searchTerm.toLowerCase();
      return pName.toLowerCase().includes(query) || vName.toLowerCase().includes(query);
    });

    // Apply sorting
    const sorted = [...filtered].sort((a: any, b: any) => {
      if (sortBy === 'name') {
        const nameA = a.productVariant?.product?.name || '';
        const nameB = b.productVariant?.product?.name || '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'qty_desc') {
        return Number(b.quantity || 0) - Number(a.quantity || 0);
      }
      if (sortBy === 'qty_asc') {
        return Number(a.quantity || 0) - Number(b.quantity || 0);
      }
      if (sortBy === 'low_stock') {
        const aLow = Number(a.quantity || 0) < 10 ? 1 : 0;
        const bLow = Number(b.quantity || 0) < 10 ? 1 : 0;
        return bLow - aLow; // Low stock items first
      }
      return 0;
    });

    const groups = new Map<string, { warehouse: any; items: any[] }>();

    sorted.forEach((balance: any) => {
      const key = balance.warehouse?.id || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          warehouse: balance.warehouse || { name: "Noma'lum ombor" },
          items: [],
        });
      }
      groups.get(key)!.items.push(balance);
    });

    return Array.from(groups.values());
  }, [balances, searchTerm, sortBy]);

  // Filter movements by search term
  const filteredMovements = React.useMemo(() => {
    if (!movements?.length) return [];
    return movements.filter((m: any) => {
      const pName = m.productVariant?.product?.name || '';
      const query = searchTerm.toLowerCase();
      return pName.toLowerCase().includes(query);
    });
  }, [movements, searchTerm]);

  // Products fetch
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { data } = await api.get('/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Products fetch error:', e);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'products') void fetchProducts();
  }, [activeTab, fetchProducts]);

  const handleDeleteProduct = (id: string, name: string) => {
    Alert.alert('O\'chirish', `"${name}" mahsulotini o\'chirasizmi?`, [
      { text: 'Bekor', style: 'cancel' },
      { text: 'O\'chirish', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/products/${id}`);
          Alert.alert('Bajarildi', 'Mahsulot o\'chirildi');
          void fetchProducts();
        } catch (e: any) {
          Alert.alert('Xatolik', e.response?.data?.message || 'O\'chirishda xatolik');
        }
      }},
    ]);
  };

  const filteredProducts = React.useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p: any) => p.name?.toLowerCase().includes(q));
  }, [products, productSearch]);

  // Create Warehouse submission
  const handleCreateWarehouse = async () => {
    if (!newWarehouseName.trim()) {
      Alert.alert('Xatolik', 'Ombor nomini kiriting');
      return;
    }

    setCreateLoading(true);
    try {
      const { data } = await api.post('/warehouses', {
        name: newWarehouseName,
        address: newWarehouseAddress,
      });
      Alert.alert('Muvaffaqiyatli', 'Yangi ombor muvaffaqiyatli yaratildi!');
      setIsCreateModalOpen(false);
      setNewWarehouseName('');
      setNewWarehouseAddress('');
      cacheInvalidatePrefix('warehouses:');
      fetchAllData({ force: true });
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Ombor yaratishda xatolik yuz berdi';
      Alert.alert('Xatolik', msg);
    } finally {
      setCreateLoading(false);
    }
  };

  // Delete/Archive Warehouse
  const handleDeleteWarehouse = async (id: string, name: string) => {
    Alert.alert(
      'Tasdiqlash',
      `"${name}" omborini o'chirishni (yoki arxivlashni) tasdiqlaysizmi?`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        { 
          text: 'O\'chirish', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/warehouses/${id}`);
              Alert.alert('Bajarildi', 'Ombor muvaffaqiyatli o\'chirildi.');
              cacheInvalidatePrefix('warehouses:');
              fetchAllData({ force: true });
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Omborni o\'chirishda xatolik yuz berdi';
              Alert.alert('Xatolik', msg);
            }
          }
        }
      ]
    );
  };

  // Column / Field Config methods
  const openConfigModal = (wh: any) => {
    setConfigWarehouse(wh);
    setFieldConfig({
      showVariantName: wh.fieldConfig?.showVariantName ?? true,
      showImage: wh.fieldConfig?.showImage ?? true,
      showDescription: wh.fieldConfig?.showDescription ?? true,
      showSku: wh.fieldConfig?.showSku ?? true,
      showBarcode: wh.fieldConfig?.showBarcode ?? false,
      showColor: wh.fieldConfig?.showColor ?? true,
      showTotalStock: wh.fieldConfig?.showTotalStock ?? true,
      showPurchasePrice: wh.fieldConfig?.showPurchasePrice ?? true,
      showSalePrice: wh.fieldConfig?.showSalePrice ?? true,
    });
    setIsConfigModalOpen(true);
  };

  const handleUpdateFieldConfig = async () => {
    if (!configWarehouse?.id) return;
    setConfigLoading(true);
    try {
      await api.patch(`/warehouses/${configWarehouse.id}`, {
        fieldConfig,
      });
      Alert.alert('Muvaffaqiyatli', 'Ombor ustun sozlamalari saqlandi!');
      setIsConfigModalOpen(false);
      cacheInvalidatePrefix('warehouses:');
      fetchAllData({ silent: true, force: true });
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Sozlamalarni saqlashda xatolik yuz berdi';
      Alert.alert('Xatolik', msg);
    } finally {
      setConfigLoading(false);
    }
  };

  const buildReportPath = (base: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (whScope.activeWarehouseId) params.set('warehouseId', whScope.activeWarehouseId);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const handleDownloadTemplate = async (action: 'template' | 'edit_stock') => {
    try {
      if (action === 'edit_stock' && !whScope.activeWarehouseId) {
        Alert.alert('Xatolik', 'Iltimos, omborni tanlang');
        return;
      }
      const path =
        action === 'template'
          ? '/reports/templates/products'
          : buildReportPath('/reports/export/products-import-format', { mode: 'with_stock' });
      const filename = action === 'template' ? 'import-shablon.xlsx' : 'tahrir-formati.xlsx';
      await downloadAuthenticatedFile(path, filename);
    } catch (e: any) {
      Alert.alert('Xatolik', e.message || 'Faylni yuklab olishda muammo');
    }
  };

  const handleStockExport = async (format: 'excel' | 'pdf') => {
    if (!whScope.activeWarehouseId) {
      Alert.alert('Xatolik', 'Avval omborni tanlang');
      return;
    }
    setExportLoading(true);
    try {
      const path =
        format === 'pdf'
          ? buildReportPath('/reports/export/stock/pdf')
          : buildReportPath('/reports/export/stock');
      const filename = format === 'pdf' ? 'zaxira-hisobot.pdf' : 'zaxira-hisobot.xlsx';
      await downloadAuthenticatedFile(path, filename);
      setExportFormatOpen(false);
    } catch (e: any) {
      Alert.alert('Xatolik', e.message || 'Eksportda xatolik');
    } finally {
      setExportLoading(false);
    }
  };

  const openBalanceActions = (b: any) => {
    const name = b.productVariant?.product?.name || b.productVariant?.name || 'Mahsulot';
    Alert.alert(name, 'Mahsulot bilan ishlash', [
      {
        text: 'Qoldiq (kirim/chiqim)',
        onPress: () => {
          setAdjustBalance(b);
          setAdjustOpen(true);
        },
      },
      {
        text: 'Variantlar',
        onPress: () => {
          const p = b.productVariant?.product;
          const v = b.productVariant;
          navigation.getParent()?.navigate('ProductVariants', {
            product: {
              productId: p?.id,
              productName: p?.name || v?.name,
              productImage: p?.imageUrl,
              totalQuantity: Number(b.quantity || 0),
              variants: [b],
            },
          });
        },
      },
      { text: 'Bekor', style: 'cancel' },
    ]);
  };

  const renderExcelTools = () => {
    return (
      <View style={styles.excelToolsCard}>
        <View style={styles.excelToolsHeader}>
          <FileSpreadsheet size={18} color="#10b981" />
          <Text style={styles.excelToolsTitle}>Excel Operatsiyalari (Import/Export)</Text>
        </View>

        <Text style={styles.excelGuide}>
          1) «Tahrir formati» yoki «Shablon»ni yuklang → 2) Excelda tahrirlang → 3) «Excel import» orqali
          yuklang. Bitta mahsulot uchun qatorga bosing — kirim/chiqim.
        </Text>
        <Text style={styles.excelScopeHint}>
          Ombor: {whScope.activeWarehouseName || 'tanlanmagan'}
        </Text>

        <View style={styles.excelButtonsRow}>
          <TouchableOpacity
            style={styles.excelBtnItem}
            onPress={() => setExportFormatOpen(true)}
          >
            <View style={styles.excelBtnIconBg}>
              <Download size={14} color="#10b981" />
            </View>
            <Text style={styles.excelBtnText}>Zaxirani eksport</Text>
            <Text style={styles.excelBtnSubtext}>Excel yoki PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.excelBtnItem}
            onPress={() => {
              if (!whScope.activeWarehouseId) {
                Alert.alert('Xatolik', 'Avval omborni tanlang');
                return;
              }
              setImportOpen(true);
            }}
          >
            <View style={[styles.excelBtnIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Sparkles size={14} color="#10b981" />
            </View>
            <Text style={styles.excelBtnText}>Excel import</Text>
            <Text style={styles.excelBtnSubtext}>Tahrirlangan fayl</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.excelButtonsRow}>
          <TouchableOpacity style={styles.excelBtnItem} onPress={() => handleDownloadTemplate('template')}>
            <View style={[styles.excelBtnIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Plus size={14} color="#3b82f6" />
            </View>
            <Text style={styles.excelBtnText}>Import shablon</Text>
            <Text style={styles.excelBtnSubtext}>Yangi mahsulot</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.excelBtnItem} onPress={() => handleDownloadTemplate('edit_stock')}>
            <View style={[styles.excelBtnIconBg, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
              <ArrowLeftRight size={14} color="#a855f7" />
            </View>
            <Text style={styles.excelBtnText}>Tahrir formati</Text>
            <Text style={styles.excelBtnSubtext}>Mavjud qoldiq bilan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const startOfToday = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // KPI — faqat tanlangan ombor bo‘yicha
  const totalStock = balances?.reduce((sum: number, b: any) => sum + Number(b.quantity || 0), 0) || 0;
  const todayIn =
    movements?.filter(
      (m: any) => m.type === 'IN' && new Date(m.createdAt) >= startOfToday,
    ).length || 0;
  const todayOut =
    movements?.filter(
      (m: any) => m.type === 'OUT' && new Date(m.createdAt) >= startOfToday,
    ).length || 0;

  const kpis = [
    { label: 'TANLANGAN OMBOR', value: whScope.activeWarehouseName || '—', icon: <Warehouse size={16} color="#3b82f6" />, color: 'rgba(59, 130, 246, 0.1)', isText: true },
    { label: 'MAHSULOT QOLDIG\'I', value: totalStock, icon: <Package size={16} color="#a855f7" />, color: 'rgba(168, 85, 247, 0.1)' },
    { label: 'BUGUNGI KIRIM', value: todayIn, icon: <TrendingUp size={16} color="#10b981" />, color: 'rgba(16, 185, 129, 0.1)' },
    { label: 'BUGUNGI CHIQIM', value: todayOut, icon: <TrendingDown size={16} color="#ef4444" />, color: 'rgba(239, 68, 68, 0.1)' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ombor Boshqaruvi</Text>
          <Text style={styles.subtitle}>
            {activeTab === 'balances' ? 'Zaxira qoldiqlari' :
             activeTab === 'history' ? 'Harakat tarixi' :
             activeTab === 'products' ? 'Mahsulotlar katalogi' : 'Omborlar ro\'yxati'}
          </Text>
        </View>
        {activeTab === 'products' ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddProductOpen(true)}>
            <Plus size={20} color="#10b981" />
          </TouchableOpacity>
        ) : activeTab === 'list' && whScope.canPickWarehouse ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsCreateModalOpen(true)}>
            <Plus size={20} color="#3b82f6" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Ombor tanlash — webdagi kabi bitta ombor bo‘yicha */}
      {(activeTab === 'balances' || activeTab === 'history') && (
        whScope.canPickWarehouse && whScope.warehouses.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scopeScroll}
            contentContainerStyle={styles.scopeScrollContent}
          >
            {whScope.warehouses.map((wh) => (
              <TouchableOpacity
                key={wh.id}
                style={[
                  styles.scopeChip,
                  whScope.activeWarehouseId === wh.id && styles.scopeChipActive,
                ]}
                onPress={() => whScope.setSelectedWarehouseId(wh.id)}
              >
                <Warehouse
                  size={12}
                  color={whScope.activeWarehouseId === wh.id ? '#fff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.scopeChipText,
                    whScope.activeWarehouseId === wh.id && styles.scopeChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {wh.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : whScope.activeWarehouseId ? (
          <View style={styles.scopeLocked}>
            <Warehouse size={14} color={colors.textSecondary} />
            <Text style={styles.scopeLockedText} numberOfLines={1}>
              Ombor: {whScope.activeWarehouseName}
            </Text>
          </View>
        ) : (
          <View style={styles.scopeLocked}>
            <AlertCircle size={14} color="#f59e0b" />
            <Text style={styles.scopeLockedText}>Ombor biriktirilmagan</Text>
          </View>
        )
      )}

      {/* Search Bar */}
      {(activeTab === 'balances' || activeTab === 'history') && (
        <View style={styles.searchContainer}>
          <Search size={18} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Mahsulot nomini kiriting..."
            placeholderTextColor="#64748b"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 4 }}>
              <X size={16} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBar}>
        {(['balances', 'history', 'products', 'list'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab);
              setSearchTerm('');
              setProductSearch('');
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'balances' ? '📦 Qoldiqlar' : tab === 'history' ? '📋 Tarix' : tab === 'products' ? '🏷️ Mahsulotlar' : '🏭 Omborlar'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {(loading || whScope.loading) && !refreshing ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Ma'lumotlar yuklanmoqda...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.mainScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          contentContainerStyle={[
            styles.scrollContent,
            activeTab === 'history' && styles.scrollContentHistory,
          ]}
        >
          {/* KPI Row - Only visible in Balances Tab */}
          {activeTab === 'balances' && (
            <View style={styles.kpiGrid}>
              {kpis.map((kpi, idx) => (
                <View key={idx} style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrapper, { backgroundColor: kpi.color }]}>
                    {kpi.icon}
                  </View>
                  <Text style={styles.kpiLabel}>{kpi.label}</Text>
                  <Text style={[styles.kpiValue, (kpi as any).isText && styles.kpiValueSmall]} numberOfLines={1}>
                    {kpi.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Excel tools integration */}
          {activeTab === 'balances' && renderExcelTools()}

          {/* Column Sort Settings - Balances Tab */}
          {activeTab === 'balances' && (
            <View style={styles.sortContainer}>
              <View style={styles.sortHeader}>
                <SlidersHorizontal size={14} color="#64748b" />
                <Text style={styles.sortLabel}>USTUNLAR TARTIBI (SETTINGS):</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
                <TouchableOpacity 
                  style={[styles.sortPill, sortBy === 'name' && styles.sortPillActive]} 
                  onPress={() => setSortBy('name')}
                >
                  <Text style={[styles.sortText, sortBy === 'name' && styles.sortTextActive]}>Mahsulot (A-Z)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortPill, sortBy === 'qty_desc' && styles.sortPillActive]} 
                  onPress={() => setSortBy('qty_desc')}
                >
                  <Text style={[styles.sortText, sortBy === 'qty_desc' && styles.sortTextActive]}>Qoldiq (Kamayish)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortPill, sortBy === 'qty_asc' && styles.sortPillActive]} 
                  onPress={() => setSortBy('qty_asc')}
                >
                  <Text style={[styles.sortText, sortBy === 'qty_asc' && styles.sortTextActive]}>Qoldiq (Ko'payish)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortPill, sortBy === 'low_stock' && styles.sortPillActive]} 
                  onPress={() => setSortBy('low_stock')}
                >
                  <Text style={[styles.sortText, sortBy === 'low_stock' && styles.sortTextActive]}>Kam qolganlar birinchi</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* TAB CONTENT: BALANCES */}
          {activeTab === 'balances' && (
            <View style={styles.balancesContainer}>
              {groupedBalances.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Package size={32} color="#334155" />
                  <Text style={styles.emptyText}>Zaxira qoldiqlari topilmadi</Text>
                </View>
              ) : (
                groupedBalances.map((group: any, gIdx: number) => (
                  <View key={gIdx} style={styles.warehouseGroupCard}>
                    <View style={styles.groupHeader}>
                      <Warehouse size={16} color="#3b82f6" />
                      <Text style={styles.groupTitle}>{group.warehouse?.name}</Text>
                      <View style={styles.badgeCount}>
                        <Text style={styles.badgeCountText}>{group.items.length} ta</Text>
                      </View>
                    </View>
                    <View style={styles.groupBody}>
                      {group.items.map((b: any, bIdx: number) => {
                        const config = group.warehouse?.fieldConfig || {
                          showVariantName: true,
                          showSku: true,
                          showBarcode: false,
                          showColor: true,
                          showPurchasePrice: true,
                          showSalePrice: true,
                        };
                        const isLow = Number(b.quantity || 0) < 10;
                        return (
                          <TouchableOpacity
                            key={b.productVariant?.id || `${gIdx}-${bIdx}`}
                            style={[styles.balanceRow, bIdx === group.items.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => openBalanceActions(b)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.prodName}>{b.productVariant?.product?.name}</Text>
                              
                              {config.showVariantName !== false && (
                                <Text style={styles.prodVariant}>{b.productVariant?.name}</Text>
                              )}

                              {config.showSku !== false && b.productVariant?.sku ? (
                                <Text style={styles.prodDetailText}>SKU: {b.productVariant.sku}</Text>
                              ) : null}

                              {config.showBarcode === true && b.productVariant?.barcode ? (
                                <Text style={styles.prodDetailText}>Barkod: {b.productVariant.barcode}</Text>
                              ) : null}

                              {config.showColor !== false && b.productVariant?.color ? (
                                <Text style={styles.prodDetailText}>Rang: {b.productVariant.color}</Text>
                              ) : null}

                              <View style={styles.pricesRow}>
                                {config.showPurchasePrice !== false && b.productVariant?.purchasePrice ? (
                                  <Text style={styles.prodDetailPrice}>
                                    Kirim: {b.productVariant.purchasePrice} {b.productVariant.currency || 'UZS'}
                                  </Text>
                                ) : null}
                                {config.showSalePrice !== false && b.productVariant?.salePrice ? (
                                  <Text style={[styles.prodDetailPrice, { marginLeft: 8, color: '#10b981' }]}>
                                    Sotuv: {b.productVariant.salePrice} {b.productVariant.currency || 'UZS'}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={[styles.prodQty, isLow && { color: '#ef4444' }]}>
                                {b.quantity}
                              </Text>
                              <View style={[styles.statusIndicator, { backgroundColor: isLow ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }]}>
                                <Text style={[styles.statusIndicatorText, { color: isLow ? '#ef4444' : '#10b981' }]}>
                                  {isLow ? 'Kam qolgan' : 'Normal'}
                                </Text>
                              </View>
                            </View>
                            <ChevronRight size={16} color="#64748b" />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB CONTENT: HISTORY (MOVEMENTS) */}
          {activeTab === 'history' && (
            <View style={styles.historyContainer}>
              {filteredMovements.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Clock size={32} color="#334155" />
                  <Text style={styles.emptyText}>Harakatlar tarixi bo'sh</Text>
                </View>
              ) : (
                <View style={styles.timelineList}>
                  {filteredMovements.map((m: any, mIdx: number) => (
                    <View key={mIdx} style={styles.movementCard}>
                      <View style={styles.movHeader}>
                        <Text style={styles.movDate}>
                          {new Date(m.createdAt).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </Text>
                        <View style={[styles.typeBadge, { backgroundColor: m.type === 'IN' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                          <Text style={[styles.typeBadgeText, { color: m.type === 'IN' ? '#10b981' : '#ef4444' }]}>
                            {m.type === 'IN' ? 'KIRIM' : 'CHIQIM'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.movBody}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.movProdName}>{m.productVariant?.product?.name}</Text>
                          <Text style={styles.movVariantName}>{m.productVariant?.name}</Text>
                          {m.note ? (
                            <Text style={styles.movNote}>Izoh: {m.note}</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.movQtyText, { color: m.type === 'IN' ? '#10b981' : '#ef4444' }]}>
                          {m.type === 'IN' ? '+' : '-'}{m.quantity}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB CONTENT: PRODUCTS */}
          {activeTab === 'products' && (
            <View style={styles.listContainer}>
              {/* Search */}
              <View style={styles.searchContainer}>
                <Search size={16} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Mahsulot qidirish..."
                  placeholderTextColor="#64748b"
                  value={productSearch}
                  onChangeText={setProductSearch}
                />
                {productSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setProductSearch('')} style={{ padding: 4 }}>
                    <X size={14} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              {productsLoading ? (
                <View style={styles.emptyBox}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.emptyText}>Yuklanmoqda...</Text>
                </View>
              ) : filteredProducts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Package size={32} color="#334155" />
                  <Text style={styles.emptyText}>Mahsulotlar topilmadi</Text>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: '#10b981', flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10, height: 'auto' as any }]}
                    onPress={() => setAddProductOpen(true)}
                  >
                    <Plus size={14} color="#10b981" />
                    <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>Mahsulot qo'shish</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredProducts.map((p: any) => (
                  <View key={p.id} style={styles.whCard}>
                    <View style={styles.whHeader}>
                      <View style={styles.whIconBg}>
                        <Package size={18} color="#10b981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.whName} numberOfLines={1}>{p.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <Tag size={11} color="#64748b" />
                          <Text style={styles.whAddress} numberOfLines={1}>
                            {p.category?.name || 'Kategoriyasiz'} • {p.variants?.length || 0} variant
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.whDeleteBtn}
                        onPress={() => handleDeleteProduct(p.id, p.name)}
                      >
                        <Trash2 size={15} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    {p.variants?.length > 0 && (
                      <View style={styles.whFooter}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {p.variants.slice(0, 4).map((v: any) => (
                              <View key={v.id} style={styles.variantPill}>
                                <Text style={styles.variantPillText}>{v.name}</Text>
                                {v.salePrice ? <Text style={styles.variantPillPrice}>{Number(v.salePrice).toLocaleString()}</Text> : null}
                              </View>
                            ))}
                            {p.variants.length > 4 && (
                              <View style={styles.variantPill}>
                                <Text style={styles.variantPillText}>+{p.variants.length - 4}</Text>
                              </View>
                            )}
                          </View>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB CONTENT: WAREHOUSE LIST */}
          {activeTab === 'list' && (
            <View style={styles.listContainer}>
              {warehouses.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Warehouse size={32} color="#334155" />
                  <Text style={styles.emptyText}>Omborlar mavjud emas</Text>
                </View>
              ) : (
                warehouses.map((w: any, idx: number) => (
                  <View key={idx} style={styles.whCard}>
                    <View style={styles.whHeader}>
                      <View style={styles.whIconBg}>
                        <Warehouse size={20} color="#3b82f6" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.whName}>{w.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <MapPin size={12} color="#64748b" />
                          <Text style={styles.whAddress} numberOfLines={1}>{w.address || "Manzil ko'rsatilmagan"}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity 
                          style={styles.whConfigBtn}
                          onPress={() => openConfigModal(w)}
                        >
                          <Settings size={16} color="#3b82f6" />
                        </TouchableOpacity>
                        {whScope.canPickWarehouse ? (
                          <TouchableOpacity
                            style={styles.whDeleteBtn}
                            onPress={() => handleDeleteWarehouse(w.id, w.name)}
                          >
                            <Trash2 size={16} color="#ef4444" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.whFooter}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={12} color="#10b981" />
                        <Text style={styles.whStatusText}>FAOL OMBOR</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* --- CREATE WAREHOUSE MODAL --- */}
      <Modal visible={isCreateModalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Warehouse size={20} color="#3b82f6" />
              <Text style={styles.modalTitle}>Yangi Ombor Yaratish</Text>
              <TouchableOpacity onPress={() => setIsCreateModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>OMBOR NOMI</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Masalan: Bosh Ombor yoki Do'kon 1"
                placeholderTextColor="#475569"
                value={newWarehouseName}
                onChangeText={setNewWarehouseName}
              />

              <Text style={styles.inputLabel}>MANZILI</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Masalan: Toshkent sh., Chilonzor d."
                placeholderTextColor="#475569"
                value={newWarehouseAddress}
                onChangeText={setNewWarehouseAddress}
              />

              <TouchableOpacity 
                style={[styles.modalSubmitBtn, createLoading && styles.disabledBtn]}
                onPress={handleCreateWarehouse}
                disabled={createLoading}
              >
                {createLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.modalSubmitText}>Omborni yaratish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- WAREHOUSE COLUMN SETTINGS (FIELD CONFIG) MODAL --- */}
      <Modal visible={isConfigModalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Settings size={18} color="#3b82f6" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalTitle}>Ombor ustun sozlamalari</Text>
                <Text style={{ color: '#64748b', fontSize: 10 }}>
                  Faqat "{configWarehouse?.name}" ombori uchun qo'llaniladi
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsConfigModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
              {[
                { key: 'showVariantName', label: 'Variant nomi' },
                { key: 'showImage', label: 'Mahsulot rasmi' },
                { key: 'showDescription', label: 'Tavsif' },
                { key: 'showSku', label: 'SKU' },
                { key: 'showBarcode', label: 'Barkod' },
                { key: 'showColor', label: 'Rang' },
                { 
                  key: 'showTotalStock', 
                  label: 'Umumiy zaxira', 
                  hint: "O'chirilsa zaxira majburiy tekshirilmaydi." 
                },
                { key: 'showPurchasePrice', label: 'Kirim narxi' },
                { key: 'showSalePrice', label: 'Sotuv narxi' },
              ].map((item) => {
                const key = item.key as keyof typeof fieldConfig;
                return (
                  <View key={item.key} style={styles.configRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.configLabel}>{item.label}</Text>
                      {'hint' in item && item.hint ? (
                        <Text style={styles.configHint}>{item.hint}</Text>
                      ) : null}
                    </View>
                    <Switch
                      value={fieldConfig[key]}
                      onValueChange={(val) =>
                        setFieldConfig((prev) => ({ ...prev, [key]: val }))
                      }
                      trackColor={{ false: '#222', true: '#3b82f6' }}
                      thumbColor={fieldConfig[key] ? '#fff' : '#475569'}
                    />
                  </View>
                );
              })}

              <TouchableOpacity 
                style={[styles.modalSubmitBtn, configLoading && styles.disabledBtn, { backgroundColor: '#3b82f6', marginTop: 12 }]}
                onPress={handleUpdateFieldConfig}
                disabled={configLoading}
              >
                {configLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalSubmitText, { color: '#fff' }]}>Saqlash</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AddProductModal
        visible={addProductOpen}
        warehouses={warehouses}
        activeWarehouseId={whScope.activeWarehouseId}
        onClose={() => setAddProductOpen(false)}
        onSuccess={() => {
          void fetchProducts();
          cacheInvalidatePrefix('warehouses:');
          void fetchAllData({ silent: true, force: true });
        }}
      />

      <ExportStockFormatModal
        visible={exportFormatOpen}
        loading={exportLoading}
        warehouseName={whScope.activeWarehouseName}
        onClose={() => !exportLoading && setExportFormatOpen(false)}
        onPick={handleStockExport}
      />

      <WarehouseImportModal
        visible={importOpen}
        warehouseId={whScope.activeWarehouseId}
        warehouseName={whScope.activeWarehouseName}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          if (whScope.activeWarehouseId) {
            cacheInvalidatePrefix(`stock:balances:${whScope.activeWarehouseId}`);
            cacheInvalidatePrefix(`stock:movements:${whScope.activeWarehouseId}`);
          }
          void fetchAllData({ silent: true, force: true });
        }}
      />

      <StockAdjustModal
        visible={adjustOpen}
        balance={adjustBalance}
        warehouseId={whScope.activeWarehouseId}
        onClose={() => setAdjustOpen(false)}
        onSuccess={() => {
          if (whScope.activeWarehouseId) {
            cacheInvalidatePrefix(`stock:balances:${whScope.activeWarehouseId}`);
            cacheInvalidatePrefix(`stock:movements:${whScope.activeWarehouseId}`);
          }
          void fetchAllData({ silent: true, force: true });
        }}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 12, fontWeight: 'bold', marginTop: 12, letterSpacing: 0.5 },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    padding: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    margin: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },

  scopeScroll: { maxHeight: 44, marginBottom: 6 },
  scopeScrollContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 200,
  },
  scopeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scopeChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  scopeChipTextActive: { color: '#fff' },
  scopeLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scopeLockedText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', flex: 1 },
  excelGuide: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, marginBottom: 8 },
  excelScopeHint: { color: colors.textSecondary, fontSize: 10, fontWeight: '600', marginBottom: 10 },
  kpiValueSmall: { fontSize: 13 },

  // TabBar
  tabBarScroll: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
    maxHeight: 56,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
  },
  variantPill: {
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  variantPillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  variantPillPrice: {
    color: colors.primary,
    fontSize: 9,
    marginTop: 1,
  },

  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  scrollContentHistory: {
    paddingTop: 16,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
  },
  kpiIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  kpiValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },

  // Section
  emptyBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  // Balances Group Card
  balancesContainer: {
    gap: 16,
  },
  warehouseGroupCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeCount: {
    backgroundColor: colors.accentBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeCountText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: 'bold',
  },
  groupBody: {
    padding: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prodName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  prodVariant: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  prodQty: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statusIndicator: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusIndicatorText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  // History Tab Styles
  historyContainer: {
    gap: 12,
    paddingTop: 4,
  },
  timelineList: {
    gap: 12,
  },
  movementCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
  },
  movHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 8,
  },
  movDate: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  movBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  movProdName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  movVariantName: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  movNote: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  movQtyText: {
    fontSize: 20,
    fontWeight: '900',
  },

  // Warehouse List Tab
  listContainer: {
    gap: 12,
  },
  whCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
  },
  whHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  whAddress: {
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  whDeleteBtn: {
    padding: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
  },
  whConfigBtn: {
    padding: 8,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 8,
  },
  whFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 12,
  },
  whStatusText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '900',
  },

  // Modal Styles
  modalBg: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
    marginBottom: 20,
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  closeBtn: { padding: 4 },
  modalBody: { gap: 16 },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    height: 48,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  disabledBtn: { opacity: 0.6 },
  modalSubmitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Excel Tools Styles
  excelToolsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  excelToolsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  excelToolsTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  whPickerScroll: {
    paddingBottom: 6,
    gap: 8,
  },
  whPickerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whPickerPillActive: {
    backgroundColor: colors.accentBg,
    borderColor: colors.primary,
  },
  whPickerText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  whPickerTextActive: {
    color: colors.primary,
  },
  excelButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  excelBtnItem: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  excelBtnIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  excelBtnText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  excelBtnSubtext: {
    color: colors.textMuted,
    fontSize: 8,
    textAlign: 'center',
  },

  // Column sorting styles
  sortContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sortHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sortLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sortScroll: {
    gap: 8,
    paddingRight: 16,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortPillActive: {
    backgroundColor: colors.accentBg,
    borderColor: colors.primary,
  },
  sortText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  sortTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },

  // Balances Config detail styles
  prodDetailText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  pricesRow: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
  },
  prodDetailPrice: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },

  // Config Switch Modal Styles
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  configLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  configHint: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 4,
    lineHeight: 12,
  },
});
