import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileSpreadsheet,
  Search,
  X,
  ChevronRight,
  Building2,
  Clock,
  Package,
  Plus,
  ArrowLeft,
  Filter,
  Inbox,
  Send,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

/**
 * B2B buyurtma statuslari va ularning ranglari
 * Backend status enum: DRAFT, SENT, ACCEPTED, IN_PROGRESS, REJECTED, DISPATCHED, PARTIALLY_DISPATCHED, RECEIVED, PARTIALLY_ACCEPTED, COMPLETED, CANCELLED
 */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:                 { label: 'Qoralama',       bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
  SENT:                  { label: 'Yuborildi',      bg: 'rgba(59,130,246,0.1)',   text: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
  ACCEPTED:              { label: 'Qabul qilindi',  bg: 'rgba(16,185,129,0.1)',   text: '#10b981', border: 'rgba(16,185,129,0.2)' },
  IN_PROGRESS:           { label: 'Jarayonda',      bg: 'rgba(59,130,246,0.1)',   text: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
  REJECTED:              { label: 'Rad etildi',     bg: 'rgba(239,68,68,0.1)',    text: '#ef4444', border: 'rgba(239,68,68,0.2)' },
  DISPATCHED:            { label: 'Jo\'natildi',    bg: 'rgba(99,102,241,0.1)',   text: '#6366f1', border: 'rgba(99,102,241,0.2)' },
  PARTIALLY_DISPATCHED:  { label: 'Qisman jo\'nat', bg: 'rgba(245,158,11,0.1)',   text: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  RECEIVED:              { label: 'Qabul qilindi',  bg: 'rgba(16,185,129,0.1)',   text: '#10b981', border: 'rgba(16,185,129,0.2)' },
  PARTIALLY_ACCEPTED:    { label: 'Qisman qabul',   bg: 'rgba(245,158,11,0.1)',   text: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  COMPLETED:             { label: 'Yakunlandi',     bg: 'rgba(16,185,129,0.1)',   text: '#10b981', border: 'rgba(16,185,129,0.2)' },
  CANCELLED:             { label: 'Bekor qilindi',  bg: 'rgba(107,114,128,0.1)',  text: '#6b7280', border: 'rgba(107,114,128,0.2)' },
};

type ViewMode = 'my' | 'incoming';

const STATUS_FILTERS = [
  { key: '', label: 'Barchasi' },
  { key: 'SENT', label: 'Yuborilgan' },
  { key: 'ACCEPTED', label: 'Qabul' },
  { key: 'IN_PROGRESS', label: 'Jarayonda' },
  { key: 'DISPATCHED', label: 'Jo\'natildi' },
  { key: 'COMPLETED', label: 'Yakunlandi' },
  { key: 'REJECTED', label: 'Rad' },
  { key: 'CANCELLED', label: 'Bekor' },
];

export default function OrdersListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [viewMode, setViewMode] = useState<ViewMode>('my');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Stats
  const [myStats, setMyStats] = useState<any>(null);
  const [incomingStats, setIncomingStats] = useState<any>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const endpoint = viewMode === 'my' ? '/b2b-orders' : '/incoming-orders';
      const params: any = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter) params.status = statusFilter;

      const { data } = await api.get(endpoint, { params });

      // API returns { items, page, limit, total, hasMore } or array
      const items = Array.isArray(data) ? data : (data.items || []);
      setOrders(items);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  }, [viewMode, searchTerm, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const [myRes, incomingRes] = await Promise.allSettled([
        api.get('/b2b-orders/stats'),
        api.get('/incoming-orders/stats'),
      ]);
      if (myRes.status === 'fulfilled') setMyStats(myRes.value.data);
      if (incomingRes.status === 'fulfilled') setIncomingStats(incomingRes.value.data);
    } catch (e) {
      console.error('Error fetching order stats:', e);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchOrders(), fetchStats()]);
    setLoading(false);
  }, [fetchOrders, fetchStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload when view mode or filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchStats()]);
    setRefreshing(false);
  }, [fetchOrders, fetchStats]);

  const formatMoney = (amount: number, currency: string) => {
    const num = Number(amount) || 0;
    if (currency === 'USD') return `$${num.toLocaleString('uz-UZ')}`;
    return `${num.toLocaleString('uz-UZ')} so'm`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  };

  const getOrderTotal = (order: any) => {
    const items = order.items || [];
    if (items.length === 0) return { total: 0, currency: 'UZS' };

    const currency = order.displayCurrency || items[0]?.expectedCurrency || 'UZS';
    const total = items.reduce((sum: number, item: any) => {
      return sum + (Number(item.quantity) * Number(item.expectedPrice || 0));
    }, 0);
    return { total, currency };
  };

  const currentStats = viewMode === 'my' ? myStats : incomingStats;
  const totalActiveOrders = currentStats
    ? (currentStats.sent || 0) + (currentStats.accepted || 0) + (currentStats.inProgress || 0)
    : 0;

  const renderOrderItem = ({ item: order }: { item: any }) => {
    const statusCfg = getStatusConfig(order.status);
    const { total, currency } = getOrderTotal(order);
    const partner = viewMode === 'my' ? order.seller : order.buyer;
    const itemCount = order._count?.items || order.items?.length || 0;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('OrderDetail', { orderId: order.id, viewMode })}
        activeOpacity={0.7}
      >
        {/* Header: Partner + Status */}
        <View style={styles.orderHeader}>
          <View style={styles.partnerRow}>
            <View style={styles.partnerIconBg}>
              <Building2 size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {partner?.name || 'Noma\'lum'}
              </Text>
              {partner?.tin && (
                <Text style={styles.partnerTin}>STIR: {partner.tin}</Text>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
            <Text style={[styles.statusText, { color: statusCfg.text }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Body: Amount + Info */}
        <View style={styles.orderBody}>
          <View style={styles.orderInfoRow}>
            <View style={styles.orderInfoItem}>
              <Text style={styles.infoLabel}>Jami summa</Text>
              <Text style={styles.infoValue}>{formatMoney(total, currency)}</Text>
            </View>
            <View style={[styles.orderInfoItem, { alignItems: 'flex-end' }]}>
              <Text style={styles.infoLabel}>Mahsulotlar</Text>
              <Text style={styles.infoValue}>{itemCount} ta</Text>
            </View>
          </View>
        </View>

        {/* Footer: Date + Arrow */}
        <View style={styles.orderFooter}>
          <View style={styles.dateRow}>
            <Clock size={12} color={colors.textMuted} />
            <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
          </View>
          {order.hasDispatch && (
            <View style={styles.dispatchBadge}>
              <Package size={10} color="#6366f1" />
              <Text style={styles.dispatchText}>Jo'natma bor</Text>
            </View>
          )}
          <ChevronRight size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>B2B Buyurtmalar</Text>
          <Text style={styles.subtitle}>
            {totalActiveOrders > 0 ? `${totalActiveOrders} ta faol buyurtma` : 'Ulgurji savdo buyurtmalari'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateOrder')}
        >
          <Plus size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* View Mode Toggle: Mening / Kiruvchi */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'my' && styles.viewModeBtnActive]}
          onPress={() => { setViewMode('my'); setStatusFilter(''); }}
        >
          <Send size={14} color={viewMode === 'my' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.viewModeText, viewMode === 'my' && styles.viewModeTextActive]}>
            Mening ({myStats ? (myStats.sent || 0) + (myStats.accepted || 0) + (myStats.inProgress || 0) : 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'incoming' && styles.viewModeBtnActive]}
          onPress={() => { setViewMode('incoming'); setStatusFilter(''); }}
        >
          <Inbox size={14} color={viewMode === 'incoming' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.viewModeText, viewMode === 'incoming' && styles.viewModeTextActive]}>
            Kiruvchi ({incomingStats ? (incomingStats.sent || 0) + (incomingStats.accepted || 0) : 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Hamkor nomi, ID bo'yicha qidirish..."
          placeholderTextColor={colors.textMuted}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 4 }}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.filterWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const isActive = item.key === statusFilter;
            return (
              <TouchableOpacity
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setStatusFilter(item.key)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        />
      </View>

      {/* Orders List */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Buyurtmalar yuklanmoqda...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <FileSpreadsheet size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Buyurtmalar topilmadi</Text>
          <Text style={styles.emptySubtitle}>
            {statusFilter
              ? 'Boshqa filtr tanlang yoki qidiruvni o\'zgartiring'
              : viewMode === 'my'
                ? 'Yangi buyurtma yaratish uchun "+" tugmasini bosing'
                : 'Hali kiruvchi buyurtmalar yo\'q'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { color: colors.textSecondary, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder,
    justifyContent: 'center', alignItems: 'center',
  },

  // View mode toggle
  viewModeContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  viewModeBtnActive: {
    backgroundColor: colors.primary,
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  viewModeTextActive: {
    color: '#fff',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    height: '100%',
  },

  // Filter pills
  filterWrapper: {
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accentBg,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterTextActive: {
    color: colors.primary,
  },

  // Order Card
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  partnerIconBg: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.accentBg,
    borderWidth: 1, borderColor: colors.accentBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  partnerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  partnerTin: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Order Body
  orderBody: {
    backgroundColor: colors.cardSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderInfoItem: {},
  infoLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },

  // Order Footer
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  dispatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  dispatchText: {
    color: '#6366f1',
    fontSize: 9,
    fontWeight: 'bold',
  },

  // Empty State
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
