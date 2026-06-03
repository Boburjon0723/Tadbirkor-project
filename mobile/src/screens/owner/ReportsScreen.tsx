import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  FileSpreadsheet, 
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Wallet,
  Package,
  BarChart3,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

type MoneyBucket = { UZS: number; USD: number };

export default function ReportsScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('month');
  
  // General reports data states
  const [summary, setSummary] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [movementRows, setMovementRows] = useState<any[]>([]);

  const getDates = () => {
    const today = new Date();
    let from = new Date();
    
    if (dateRange === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (dateRange === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      from = new Date(today.setDate(diff));
      from.setHours(0, 0, 0, 0);
    } else {
      // Month
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    return {
      dateFrom: from.toISOString(),
      dateTo: new Date().toISOString(),
    };
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getDates();
      
      const [summaryRes, dailyRes, topRes, stockRes, movementRes] = await Promise.allSettled([
        api.get('/reports/summary', {
          params: { dateFrom, dateTo }
        }),
        api.get('/reports/summary/daily', {
          params: { dateFrom, dateTo }
        }),
        api.get('/reports/summary/top-products', {
          params: { dateFrom, dateTo, limit: 5 }
        }),
        api.get('/reports/stock'),
        api.get('/reports/stock-movements', {
          params: { dateFrom, dateTo }
        }),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data);
      }
      if (dailyRes.status === 'fulfilled') {
        setDaily(Array.isArray(dailyRes.value.data) ? dailyRes.value.data : []);
      }
      if (topRes.status === 'fulfilled') {
        setTopProducts(Array.isArray(topRes.value.data) ? topRes.value.data : []);
      }
      if (stockRes.status === 'fulfilled') {
        setStockRows(Array.isArray(stockRes.value.data?.data) ? stockRes.value.data.data : []);
      }
      if (movementRes.status === 'fulfilled') {
        setMovementRows(Array.isArray(movementRes.value.data) ? movementRes.value.data : []);
      }
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [fetchReports]);

  // Format currency helpers
  const formatValyuta = (record: Record<string, number> | null | undefined) => {
    if (!record) return "0 so'm";
    const parts: string[] = [];
    if (record.USD && record.USD !== 0) parts.push(`$${Number(record.USD).toLocaleString('uz-UZ')}`);
    if (record.UZS && record.UZS !== 0) parts.push(`${Number(record.UZS).toLocaleString('uz-UZ')} so'm`);
    if (parts.length === 0) return "0 so'm";
    return parts.join(" · ");
  };

  const sumMoney = (a: MoneyBucket, b: MoneyBucket): MoneyBucket => ({
    UZS: Number(a.UZS || 0) + Number(b.UZS || 0),
    USD: Number(a.USD || 0) + Number(b.USD || 0),
  });
  const subMoney = (a: MoneyBucket, b: MoneyBucket): MoneyBucket => ({
    UZS: Number(a.UZS || 0) - Number(b.UZS || 0),
    USD: Number(a.USD || 0) - Number(b.USD || 0),
  });

  const salePriceByVariant = new Map<string, number>();
  for (const row of stockRows) {
    const key = `${String(row?.product || '').trim().toLowerCase()}::${String(row?.variant || '').trim().toLowerCase()}`;
    const salePrice = Number(row?.salePrice || 0);
    if (!salePriceByVariant.has(key) || salePriceByVariant.get(key) === 0) {
      salePriceByVariant.set(key, salePrice);
    }
  }

  const potentialDailyMap = new Map<string, MoneyBucket>();
  for (const row of movementRows) {
    if (String(row?.type || '').toUpperCase() !== 'IN') continue;
    const day = String(row?.date || '').slice(0, 10);
    if (!day) continue;
    const key = `${String(row?.product || '').trim().toLowerCase()}::${String(row?.variant || '').trim().toLowerCase()}`;
    const salePrice = Number(salePriceByVariant.get(key) || 0);
    const qty = Math.abs(Number(row?.quantity || 0));
    const potential = qty * salePrice;
    const prev = potentialDailyMap.get(day) || { UZS: 0, USD: 0 };
    potentialDailyMap.set(day, { UZS: prev.UZS + potential, USD: prev.USD });
  }

  const derivedDaily = daily.map((row) => {
    const purchase: MoneyBucket = {
      UZS: Number(row?.purchase?.UZS || 0),
      USD: Number(row?.purchase?.USD || 0),
    };
    const sales: MoneyBucket = {
      UZS: Number(row?.sales?.UZS || 0),
      USD: Number(row?.sales?.USD || 0),
    };
    const profit: MoneyBucket = {
      UZS: Number(row?.profit?.UZS || 0),
      USD: Number(row?.profit?.USD || 0),
    };
    const potentialSales = potentialDailyMap.get(String(row?.date || '')) || { UZS: 0, USD: 0 };
    const potentialProfit = subMoney(potentialSales, purchase);
    return {
      date: String(row?.date || ''),
      purchase,
      sales,
      profit,
      potentialSales,
      potentialProfit,
    };
  });

  const totals = derivedDaily.reduce(
    (acc, row) => ({
      purchase: sumMoney(acc.purchase, row.purchase),
      sales: sumMoney(acc.sales, row.sales),
      profit: sumMoney(acc.profit, row.profit),
      potentialSales: sumMoney(acc.potentialSales, row.potentialSales),
      potentialProfit: sumMoney(acc.potentialProfit, row.potentialProfit),
    }),
    {
      purchase: { UZS: 0, USD: 0 },
      sales: { UZS: 0, USD: 0 },
      profit: { UZS: 0, USD: 0 },
      potentialSales: { UZS: 0, USD: 0 },
      potentialProfit: { UZS: 0, USD: 0 },
    } as {
      purchase: MoneyBucket;
      sales: MoneyBucket;
      profit: MoneyBucket;
      potentialSales: MoneyBucket;
      potentialProfit: MoneyBucket;
    },
  );

  const recentFlow = [...derivedDaily].slice(-7).reverse();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Umumiy Hisobotlar</Text>
          <Text style={styles.headerSubtitle}>Kirim, sotuv, foyda va ombor qiymati</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={() => Alert.alert('Eksport', 'Hisobot Excel fayli yuklab olindi.')}>
          <FileSpreadsheet size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Date Range Selector */}
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

      {loading && !refreshing ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Hisobotlar tayyorlanmoqda...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        >
          {/* General Summary Hero */}
          <View style={styles.heroReportCard}>
            <Text style={styles.heroLabel}>REAL FOYDA (SOTUV - KIRIM)</Text>
            <Text style={styles.heroValue}>{formatValyuta(totals.profit)}</Text>
            
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <BarChart3 size={14} color="#64748b" />
                <Text style={styles.heroStatLabel}>Kirimlar: </Text>
                <Text style={styles.heroStatValue}>{summary?.counts?.purchaseMovements || 0} ta</Text>
              </View>
              <View style={styles.heroStatItem}>
                <Package size={14} color="#64748b" />
                <Text style={styles.heroStatLabel}>Sotuvlar: </Text>
                <Text style={styles.heroStatValue}>{summary?.counts?.salesMovements || 0} ta</Text>
              </View>
            </View>
          </View>

          {/* Financial Breakdown */}
          <Text style={styles.sectionTitle}>Real oqim (amalda bo'lgan)</Text>
          
          <View style={styles.cardGroup}>
            <View style={styles.breakdownRow}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <ArrowDownCircle size={18} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakdownName}>Kirim summasi</Text>
                <Text style={styles.breakdownValue}>{formatValyuta(totals.purchase)}</Text>
              </View>
            </View>

            <View style={styles.breakdownRow}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <ArrowUpCircle size={18} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakdownName}>Sotuv summasi</Text>
                <Text style={styles.breakdownValue}>{formatValyuta(totals.sales)}</Text>
              </View>
            </View>

            <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(250, 204, 21, 0.12)' }]}>
                <Wallet size={18} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakdownName}>Ombor qiymati (joriy)</Text>
                <Text style={[styles.breakdownValue, { color: '#f59e0b' }]}>{formatValyuta(summary?.inventoryValue || { UZS: 0, USD: 0 })}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Potensial oqim (IN qty × salePrice)</Text>
          <View style={styles.cardGroup}>
            <View style={styles.breakdownRow}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <ArrowUpCircle size={18} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakdownName}>Potensial sotuv summasi</Text>
                <Text style={[styles.breakdownValue, { color: '#3b82f6' }]}>{formatValyuta(totals.potentialSales)}</Text>
              </View>
            </View>
            <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <TrendingUp size={18} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakdownName}>Potensial foyda</Text>
                <Text style={styles.breakdownValue}>{formatValyuta(totals.potentialProfit)}</Text>
              </View>
            </View>
          </View>

          {/* Daily aggregated from summary/daily */}
          <Text style={styles.sectionTitle}>Sana bo'yicha oqim (so'nggi 7 kun)</Text>
          <View style={styles.debtOverviewBox}>
            {recentFlow.length === 0 ? (
              <Text style={styles.warehouseDesc}>Bu davr uchun kunlik oqim topilmadi.</Text>
            ) : (
              recentFlow.map((row, idx) => (
                <View
                  key={`${row.date}-${idx}`}
                  style={[
                    styles.breakdownRow,
                    idx === recentFlow.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.debtLabel}>{row.date}</Text>
                    <Text style={styles.debtDesc}>
                      Kirim: {formatValyuta(row.purchase)}
                      {'\n'}
                      Real sotuv: {formatValyuta(row.sales)}
                      {'\n'}
                      Potensial sotuv: {formatValyuta(row.potentialSales)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Top products from general summary */}
          <Text style={styles.sectionTitle}>Eng ko'p sotilgan mahsulotlar</Text>
          <View style={styles.warehouseCard}>
            {topProducts.length ? (
              topProducts.map((item, idx) => (
                <View
                  key={`${item.productVariantId || item.sku || item.variantName || idx}`}
                  style={[
                    styles.breakdownRow,
                    idx === topProducts.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
                  ]}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <TrendingUp size={18} color="#3b82f6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.breakdownName} numberOfLines={1}>
                      {item.productName} {item.variantName ? `• ${item.variantName}` : ''}
                    </Text>
                    <Text style={styles.breakdownValue}>
                      {Number(item.quantity || 0).toLocaleString('uz-UZ')} ta
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.warehouseDesc}>Bu davr uchun sotuv chiqimi topilmadi.</Text>
            )}
            <Text style={[styles.warehouseDesc, { marginTop: 10 }]}>
              Izoh: top mahsulotlar real OUT harakatlari asosida hisoblanadi.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 13, marginTop: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  exportBtn: {
    padding: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Date Range Filters
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#FFF',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Hero Report Card
  heroReportCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 24,
    marginTop: 8,
  },
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  heroStatValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Section Styles
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Card Groups
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    marginBottom: 24,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  breakdownName: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  breakdownValue: {
    color: colors.success,
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Debt Overview
  debtOverviewBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  debtLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  debtValue: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
  debtDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },

  // Warehouse summary
  warehouseCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  warehouseTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  warehouseDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
