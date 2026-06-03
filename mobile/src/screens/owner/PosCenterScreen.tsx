import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingCart,
  Users,
  Receipt,
  TrendingUp,
  DollarSign,
  CreditCard,
  Warehouse,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';
import { usePosCreditAccess } from '../../hooks/usePosCreditAccess';
import { usePosReportWarehouse } from '../../hooks/usePosReportWarehouse';

type DateRange = 'today' | 'week' | 'month';

export default function PosCenterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const posCredit = usePosCreditAccess();
  const whScope = usePosReportWarehouse();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [summary, setSummary] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const getDates = (range: DateRange) => {
    const now = new Date();
    let from = new Date();
    if (range === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (range === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      from = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }
    return {
      dateFrom: from.toISOString(),
      dateTo: new Date().toISOString(),
    };
  };

  const formatValyuta = (record: Record<string, number> | null | undefined) => {
    if (!record) return "0 so'm";
    const parts: string[] = [];
    if (record.USD) parts.push(`$${Number(record.USD).toLocaleString('uz-UZ')}`);
    if (record.UZS) parts.push(`${Number(record.UZS).toLocaleString('uz-UZ')} so'm`);
    return parts.length ? parts.join(' · ') : "0 so'm";
  };

  const fetchPosCenter = useCallback(async () => {
    if (!whScope.reportWarehouseId) {
      setSummary(null);
      setTopProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { dateFrom, dateTo } = getDates(dateRange);
      const warehouseId = whScope.reportWarehouseId;
      const [summaryRes, topRes] = await Promise.allSettled([
        api.get('/reports/pos/summary', { params: { dateFrom, dateTo, warehouseId } }),
        api.get('/reports/pos/top-products', {
          params: { dateFrom, dateTo, warehouseId, limit: 5 },
        }),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data);
      } else {
        setSummary(null);
      }

      if (topRes.status === 'fulfilled') {
        setTopProducts(Array.isArray(topRes.value.data) ? topRes.value.data : []);
      } else {
        setTopProducts([]);
      }
    } catch (error) {
      console.error('Failed to load POS center data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, whScope.reportWarehouseId]);

  useEffect(() => {
    if (whScope.loading) return;
    fetchPosCenter();
  }, [fetchPosCenter, whScope.loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosCenter();
    setRefreshing(false);
  }, [fetchPosCenter]);

  const showPosReports = !!whScope.reportWarehouseId;
  const isSalesRole = whScope.role === 'SALES';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>POS Markazi</Text>
        <Text style={styles.headerSubtitle}>Kassa, mijozlar va chakana hisobotlar</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('POSTerminal')}>
          <ShoppingCart size={18} color="#3b82f6" />
          <Text style={styles.actionTitle}>POS Kassa</Text>
          <Text style={styles.actionDesc}>Savdo qilish</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('PosCustomers')}>
          <Users size={18} color="#3b82f6" />
          <Text style={styles.actionTitle}>Mijozlar</Text>
          <Text style={styles.actionDesc}>
            {posCredit.enabled ? "Nasiya va oldindan to'lov" : 'Mijozlar ro‘yxati'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPosReports && (
        <>
          {whScope.canPickWarehouse && whScope.warehouses.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.warehouseScroll}
              contentContainerStyle={styles.warehouseScrollContent}
            >
              {whScope.warehouses.map((wh) => (
                <TouchableOpacity
                  key={wh.id}
                  style={[
                    styles.warehouseChip,
                    whScope.reportWarehouseId === wh.id && styles.warehouseChipActive,
                  ]}
                  onPress={() => whScope.setSelectedWarehouseId(wh.id)}
                >
                  <Warehouse
                    size={12}
                    color={whScope.reportWarehouseId === wh.id ? '#fff' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.warehouseChipText,
                      whScope.reportWarehouseId === wh.id && styles.warehouseChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {wh.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : showPosReports ? (
            <View style={styles.warehouseLocked}>
              <Warehouse size={14} color={colors.textSecondary} />
              <Text style={styles.warehouseLockedText} numberOfLines={1}>
                Ombor: {whScope.reportWarehouseName}
                {isSalesRole ? ' (faqat ko‘rish)' : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.filterRow}>
            {(['today', 'week', 'month'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[styles.filterTab, dateRange === range && styles.filterTabActive]}
                onPress={() => setDateRange(range)}
              >
                <Text style={[styles.filterTabText, dateRange === range && styles.filterTabTextActive]}>
                  {range === 'today' ? 'Bugun' : range === 'week' ? 'Shu hafta' : 'Shu oy'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {(loading || whScope.loading) && !refreshing ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>POS ma'lumotlar yuklanmoqda...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          showsVerticalScrollIndicator={false}
        >
          {!showPosReports && !whScope.loading ? (
            <View style={styles.roleHintCard}>
              <Text style={styles.roleHintTitle}>Ombor biriktirilmagan</Text>
              <Text style={styles.roleHintText}>
                POS hisobotlari uchun jamoa a&apos;zoga ombor belgilangan bo&apos;lishi kerak. Administrator
                webda Jamoa bo‘limidan omborni biriktirsin.
              </Text>
            </View>
          ) : null}

          {showPosReports ? (
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>
                JAMI GROSS SAVDO · {whScope.reportWarehouseName.toUpperCase()}
              </Text>
              <Text style={styles.heroValue}>{formatValyuta(summary?.grossSales)}</Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Receipt size={14} color="#64748b" />
                  <Text style={styles.heroStatLabel}>Cheklar:</Text>
                  <Text style={styles.heroStatValue}>{summary?.receiptsCount || 0} ta</Text>
                </View>
                <View style={styles.heroStatItem}>
                  <TrendingUp size={14} color="#64748b" />
                  <Text style={styles.heroStatLabel}>Tovar:</Text>
                  <Text style={styles.heroStatValue}>{summary?.itemsSold || 0} ta</Text>
                </View>
              </View>
            </View>
          ) : null}

          {showPosReports && (
            <>
              <Text style={styles.sectionTitle}>To'lov turlari</Text>
              <View style={styles.blockCard}>
                <View style={styles.row}>
                  <DollarSign size={16} color="#10b981" />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>Naqd savdo</Text>
                    <Text style={styles.rowValue}>{formatValyuta(summary?.cashSales)}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <CreditCard size={16} color="#3b82f6" />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>Karta orqali</Text>
                    <Text style={styles.rowValue}>{formatValyuta(summary?.cardSales)}</Text>
                  </View>
                </View>
                {posCredit.companyEnabled ? (
                  <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <Users size={16} color="#f43f5e" />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowLabel}>Nasiya savdo</Text>
                      <Text style={[styles.rowValue, { color: '#f43f5e' }]}>
                        {formatValyuta(summary?.creditSales)}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <Text style={styles.sectionTitle}>Top POS mahsulotlar</Text>
              <View style={styles.blockCard}>
                {topProducts.length ? (
                  topProducts.map((item, idx) => (
                    <View
                      key={`${item?.productVariantId || item?.name || idx}`}
                      style={[styles.row, idx === topProducts.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <TrendingUp size={16} color="#3b82f6" />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {item?.name || 'Mahsulot'}
                        </Text>
                        <Text style={styles.rowValue}>
                          {Number(item?.quantity || item?.value || 0).toLocaleString('uz-UZ')} ta
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Bu davr uchun POS sotuvlari topilmadi.</Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: c.textSecondary, marginTop: 10, fontSize: 12, fontWeight: '600' },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: { color: c.text, fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { color: c.textSecondary, fontSize: 11, marginTop: 2 },
    actionRow: { flexDirection: 'row', gap: 10, padding: 12 },
    actionCard: {
      flex: 1,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 12,
      gap: 5,
    },
    actionTitle: { color: c.text, fontSize: 13, fontWeight: 'bold' },
    actionDesc: { color: c.textSecondary, fontSize: 10 },
    warehouseScroll: { maxHeight: 44, marginBottom: 4 },
    warehouseScrollContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
    warehouseChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      maxWidth: 180,
    },
    warehouseChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    warehouseChipText: { color: c.textSecondary, fontSize: 11, fontWeight: '600', flexShrink: 1 },
    warehouseChipTextActive: { color: '#fff' },
    warehouseLocked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    warehouseLockedText: { color: c.textSecondary, fontSize: 11, fontWeight: '600', flex: 1 },
    filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
    filterTab: {
      flex: 1,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterTabActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterTabText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
    filterTabTextActive: { color: '#fff' },
    scrollContent: { paddingHorizontal: 12, paddingBottom: 28 },
    roleHintCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
    },
    roleHintTitle: { color: c.text, fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
    roleHintText: { color: c.textSecondary, fontSize: 11, lineHeight: 16 },
    heroCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginBottom: 14,
    },
    heroLabel: { color: c.textSecondary, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.6 },
    heroValue: { color: c.text, fontSize: 24, fontWeight: '900', marginVertical: 8 },
    heroStatsRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 10,
      gap: 14,
    },
    heroStatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heroStatLabel: { color: c.textSecondary, fontSize: 11 },
    heroStatValue: { color: c.text, fontSize: 11, fontWeight: 'bold' },
    sectionTitle: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 2,
    },
    blockCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 8,
      marginBottom: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingVertical: 11,
      paddingHorizontal: 6,
    },
    rowBody: { flex: 1 },
    rowLabel: { color: c.textSecondary, fontSize: 11, marginBottom: 2 },
    rowValue: { color: c.text, fontSize: 14, fontWeight: 'bold' },
    emptyText: { color: c.textSecondary, fontSize: 12, textAlign: 'center', paddingVertical: 16 },
  });

