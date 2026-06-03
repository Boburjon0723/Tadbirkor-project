import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Package, 
  ShoppingCart, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Bell,
  Database,
  BookOpen,
} from 'lucide-react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

const { width: screenWidth } = Dimensions.get('window');

export default function OwnerDashboard({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats & Analytics states (matching Web dashboard payload)
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, ordersRes, stockRes, featuresRes] = await Promise.allSettled([
        api.get('/dashboard/stats'),
        api.get('/reports/analytics/orders?days=30'),
        api.get('/reports/analytics/stock?days=30'),
        api.get('/companies/features'),
      ]);

      if (statsRes.status === 'fulfilled') {
        setDashboardData(statsRes.value.data);
      }
      if (ordersRes.status === 'fulfilled') {
        setOrderData(ordersRes.value.data);
      }
      if (stockRes.status === 'fulfilled') {
        setStockData(stockRes.value.data);
      }
      if (featuresRes.status === 'fulfilled') {
        const mods = (featuresRes.value.data?.enabledModules || []).map((m: string) => m.toUpperCase());
        setEnabledModules(mods);
      }
    } catch (err) {
      console.error('Error loading dashboard analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Format money helper matching Web 1:1
  const formatMoney = (v: any, currency?: 'UZS' | 'USD') => {
    if (typeof v === 'object' && v !== null) {
      const parts: string[] = [];
      if (v.USD && v.USD !== 0) parts.push(`$${Number(v.USD).toLocaleString('uz-UZ')}`);
      if (v.UZS && v.UZS !== 0) parts.push(`${Number(v.UZS).toLocaleString('uz-UZ')} so'm`);
      if (parts.length === 0) return "0 so'm";
      return parts.join(" · ");
    }
    return currency === 'USD' ? `$${Number(v || 0).toLocaleString('uz-UZ')}` : `${Number(v || 0).toLocaleString('uz-UZ')} so'm`;
  };

  const receivables = dashboardData?.stats?.totalReceivables || { UZS: 0, USD: 0 };
  const payables = dashboardData?.stats?.totalPayables || { UZS: 0, USD: 0 };

  // Modul manba badge
  const hasDebt = enabledModules.includes('DEBT');
  const hasPartnerLedger = enabledModules.includes('PARTNER_LEDGER');
  const hasFeatureConfig = enabledModules.length > 0;

  // Manba belgisi: qaysi modullardan kelayotgani
  const debtSourceLabel = !hasFeatureConfig
    ? 'Qarz daftar (sukut)'
    : hasDebt && hasPartnerLedger
    ? 'Qarz daftar'
    : hasDebt
    ? 'Qarz daftar'
    : 'Manba yo\'q';

  const partnerLedgerNote = hasPartnerLedger && (
    'Hamkor daftar alohida'
  );

  // Sof balans = Debitorlik - Kreditorlik
  const netBalance = {
    UZS: (receivables.UZS || 0) - (payables.UZS || 0),
    USD: (receivables.USD || 0) - (payables.USD || 0)
  };

  const isNetPositive = netBalance.UZS >= 0 && netBalance.USD >= 0;

  // Render Premium SVG Chart for Order Dynamics
  const renderOrderChart = () => {
    const chartData = orderData?.data || [];
    const detectedCurrency = orderData?.currency || 'UZS';

    if (chartData.length < 2) {
      return (
        <View style={styles.emptyChartBox}>
          <ShoppingCart size={24} color="#334155" />
          <Text style={styles.emptyChartText}>Buyurtmalar dinamikasi bo'sh</Text>
        </View>
      );
    }

    const width = screenWidth - 32; // Screen width minus padding
    const height = 140;
    const padding = 8;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    const volumes = chartData.map((d: any) => Number(d.volume) || 0);
    const maxVal = Math.max(...volumes, 1);
    const minVal = Math.min(...volumes, 0);
    const valRange = maxVal - minVal;

    // Map each daily item to coordinate points
    const points = chartData.map((d: any, i: number) => {
      const x = padding + (i / (chartData.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((Number(d.volume || 0) - minVal) / valRange) * chartHeight;
      return { x, y };
    });

    // Build SVG Path
    let lineD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      lineD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${lineD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return (
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Buyurtmalar Dinamikasi</Text>
            <Text style={styles.chartSubtitle}>So'nggi 30 kunlik hajm</Text>
          </View>
          <View style={styles.chartCurrencyBadge}>
            <Text style={styles.chartCurrencyText}>{detectedCurrency}</Text>
          </View>
        </View>

        <View style={styles.svgWrapper}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                <Stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Grid Dashed Lines */}
            <Line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke={colors.border} strokeWidth={1} strokeDasharray="3 3" />
            <Line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke={colors.border} strokeWidth={1} strokeDasharray="3 3" />
            <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={colors.textMuted} strokeWidth={1} />

            {/* Gradient Area Fill */}
            <Path d={areaD} fill="url(#chartGrad)" />

            {/* Smooth Outline Path */}
            <Path d={lineD} stroke="#3b82f6" strokeWidth={2.5} fill="none" />

            {/* Pulsing End Point Circle */}
            <Circle 
              cx={points[points.length - 1].x} 
              cy={points[points.length - 1].y} 
              r={4.5} 
              fill="#3b82f6" 
              stroke={colors.card} 
              strokeWidth={1.5} 
            />
          </Svg>
        </View>

        {/* Chart Info Row */}
        <View style={styles.chartInfoRow}>
          <View style={styles.chartInfoItem}>
            <Text style={styles.chartInfoLabel}>Jami buyurtmalar</Text>
            <Text style={styles.chartInfoValue}>
              {chartData.reduce((sum: number, item: any) => sum + (item.count || 0), 0)} ta
            </Text>
          </View>
          <View style={[styles.chartInfoItem, { alignItems: 'flex-end' }]}>
            <Text style={styles.chartInfoLabel}>Jami hajm</Text>
            <Text style={[styles.chartInfoValue, { color: '#3b82f6' }]}>
              {formatMoney(chartData.reduce((sum: number, item: any) => sum + (item.volume || 0), 0), detectedCurrency as any)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Analitika yuklanmoqda...</Text>
      </SafeAreaView>
    );
  }

  const topProducts = stockData?.topProducts || [];
  const maxProductSales = topProducts.length ? Math.max(...topProducts.map((p: any) => p.value), 1) : 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Tadbirkor ERP</Text>
            <Text style={styles.headerSubtitle}>Boshqaruv & Tahlil markazi</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell color="#fff" size={20} />
          </TouchableOpacity>
        </View>

        {/* Sof Balans (Net Balance Hero) */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Scale size={20} color={isNetPositive ? '#10b981' : '#f87171'} />
            <Text style={styles.heroTitle}>Sof Balans</Text>
          </View>
          <Text style={[styles.heroValue, { color: isNetPositive ? '#10b981' : '#f87171' }]}>
            {formatMoney(netBalance)}
          </Text>
          <Text style={styles.heroDesc}>
            Debitorlik va kreditorlik o'rtasidagi farq
          </Text>
        </View>

        {/* Receivables & Payables Row */}
        <View style={styles.statsRow}>
          {/* Receivables (Debitorlik) */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <ArrowDownLeft size={16} color="#10b981" />
              <Text style={styles.statCardLabel}>Debitorlik (Kirim)</Text>
            </View>
            <Text style={styles.statCardValue}>{formatMoney(receivables)}</Text>
            <View style={styles.sourceBadge}>
              <Database size={9} color="#64748b" />
              <Text style={styles.sourceBadgeText}>{debtSourceLabel}</Text>
            </View>
            {hasPartnerLedger && (
              <View style={styles.partnerLedgerNote}>
                <BookOpen size={9} color="#f59e0b" />
                <Text style={styles.partnerLedgerNoteText}>+ Hamkor daftar alohida</Text>
              </View>
            )}
          </View>

          {/* Payables (Kreditorlik) */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <ArrowUpRight size={16} color="#ef4444" />
              <Text style={styles.statCardLabel}>Kreditorlik (Chiqim)</Text>
            </View>
            <Text style={[styles.statCardValue, { color: '#ef4444' }]}>{formatMoney(payables)}</Text>
            <View style={styles.sourceBadge}>
              <Database size={9} color="#64748b" />
              <Text style={styles.sourceBadgeText}>{debtSourceLabel}</Text>
            </View>
            {hasPartnerLedger && (
              <View style={styles.partnerLedgerNote}>
                <BookOpen size={9} color="#f59e0b" />
                <Text style={styles.partnerLedgerNoteText}>+ Hamkor daftar alohida</Text>
              </View>
            )}
          </View>
        </View>

        {/* Dynamic Orders Area Chart */}
        {renderOrderChart()}

        {/* Stock movement summary */}
        <View style={styles.stockOverviewCard}>
          <Text style={styles.sectionTitle}>Zaxiralar & Ombor Harakati</Text>
          <View style={styles.stockRow}>
            <View style={styles.stockStat}>
              <Text style={styles.stockLabel}>Kirimlar soni</Text>
              <Text style={styles.stockValue}>
                {stockData?.daily ? stockData.daily.reduce((sum: number, item: any) => sum + (item.in || 0), 0) : 0} ta
              </Text>
            </View>
            <View style={styles.stockDivider} />
            <View style={styles.stockStat}>
              <Text style={styles.stockLabel}>Chiqimlar soni</Text>
              <Text style={[styles.stockValue, { color: '#ef4444' }]}>
                {stockData?.daily ? stockData.daily.reduce((sum: number, item: any) => sum + (item.out || 0), 0) : 0} ta
              </Text>
            </View>
          </View>
        </View>

        {/* Top Sold Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Eng ko'p sotilgan mahsulotlar</Text>
          {topProducts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Package size={28} color="#334155" />
              <Text style={styles.emptyText}>Mahsulot sotuvlari topilmadi</Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {topProducts.map((p: any, index: number) => {
                const percentage = Math.min(100, Math.round((p.value / maxProductSales) * 100));
                return (
                  <View key={index} style={styles.productRow}>
                    <View style={styles.productTextRow}>
                      <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.productCount}>{p.value} ta</Text>
                    </View>
                    <View style={styles.progressBarWrapper}>
                      <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.textSecondary, fontSize: 13, marginTop: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 24,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    notificationBtn: {
      padding: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // Hero Card (Sof Balans)
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginHorizontal: 16,
      marginBottom: 16,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    heroTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    heroValue: {
      fontSize: 28,
      fontWeight: '900',
      marginVertical: 4,
      color: colors.text,
    },
    heroDesc: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 4,
    },

    // Stats Row
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
    },
    statCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    statCardLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: 'bold',
    },
    statCardValue: {
      color: colors.success,
      fontSize: 16,
      fontWeight: '900',
    },
    statCardSub: {
      color: colors.textMuted,
      fontSize: 9,
      marginTop: 4,
    },

    // Source badge (ma'lumot manbasi)
    sourceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      backgroundColor: colors.cardSecondary,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    },
    sourceBadgeText: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '600',
    },
    partnerLedgerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.2)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    },
    partnerLedgerNoteText: {
      color: '#f59e0b',
      fontSize: 9,
      fontWeight: '600',
    },

    // Chart Card Styles
    chartCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 20,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    chartTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    chartSubtitle: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    chartCurrencyBadge: {
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chartCurrencyText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '900',
    },
    svgWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 4,
    },
    chartInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
      marginTop: 12,
    },
    chartInfoItem: {
      flex: 1,
    },
    chartInfoLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      marginBottom: 2,
    },
    chartInfoValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },

    // Stock Overview Card
    stockOverviewCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 20,
    },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },
    stockStat: {
      flex: 1,
      alignItems: 'center',
    },
    stockLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      marginBottom: 4,
    },
    stockValue: {
      color: colors.success,
      fontSize: 20,
      fontWeight: '900',
    },
    stockDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },

    // Section Styles
    section: {
      paddingHorizontal: 16,
      marginBottom: 40,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    emptyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    emptyChartBox: {
      height: 140,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      marginHorizontal: 16,
      marginBottom: 20,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    emptyChartText: {
      color: colors.textSecondary,
      fontSize: 12,
    },

    // Top products list
    productsList: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      padding: 16,
      gap: 16,
    },
    productRow: {
      gap: 6,
    },
    productTextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    productName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '500',
      flex: 1,
      marginRight: 10,
    },
    productCount: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: 'bold',
    },
    progressBarWrapper: {
      height: 5,
      backgroundColor: colors.cardSecondary,
      borderRadius: 2.5,
      overflow: 'hidden',
    },
    progressBar: {
      height: 5,
      backgroundColor: colors.primary,
      borderRadius: 2.5,
    },
  });
}
