import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Search, X, Building2, ArrowDownLeft, ArrowUpRight, Wallet,
  ChevronRight, Layers,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

type TabType = 'receivable' | 'payable';

export default function DebtsListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [tab, setTab] = useState<TabType>('receivable');
  const [groups, setGroups] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params: any = { tab };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const { data } = await api.get('/debts/partner-groups', { params });
      setGroups(data.items || []);
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      console.error('Debts fetch error:', e);
    }
  }, [tab, searchTerm]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }, [fetchData]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchData(), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const formatMoney = (n: number) => {
    if (!n || n === 0) return '0';
    return n.toLocaleString('uz-UZ');
  };

  const formatDual = (obj: { uzs: number; usd: number }) => {
    const parts: string[] = [];
    if (obj.uzs) parts.push(`${formatMoney(obj.uzs)} so'm`);
    if (obj.usd) parts.push(`$${formatMoney(obj.usd)}`);
    return parts.join(' · ') || '0';
  };

  const getStatusStyle = (status: string) => {
    if (status === 'PAID') return { bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: 'rgba(16,185,129,0.2)' };
    if (status === 'PARTIAL') return { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.2)' };
    return { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.2)' };
  };

  const statusLabel = (status: string) => {
    if (status === 'PAID') return 'To\'langan';
    if (status === 'PARTIAL') return 'Qisman';
    return 'Ochiq';
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Qarz daftari</Text>
          <Text style={s.subtitle}>Hamkorlar bo'yicha qarzlar</Text>
        </View>
      </View>

      {/* KPI Cards */}
      {summary && (
        <View style={s.kpiRow}>
          <View style={[s.kpiCard, { borderColor: 'rgba(16,185,129,0.15)' }]}>
            <ArrowDownLeft size={18} color="#10b981" />
            <Text style={s.kpiLabel}>Debitorlik</Text>
            <Text style={[s.kpiValue, { color: '#10b981' }]}>
              {formatDual(summary.receivable)}
            </Text>
          </View>
          <View style={[s.kpiCard, { borderColor: 'rgba(239,68,68,0.15)' }]}>
            <ArrowUpRight size={18} color="#ef4444" />
            <Text style={s.kpiLabel}>Kreditorlik</Text>
            <Text style={[s.kpiValue, { color: '#ef4444' }]}>
              {formatDual(summary.payable)}
            </Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabContainer}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'receivable' && s.tabBtnActive]}
          onPress={() => { setTab('receivable'); setSearchTerm(''); }}
        >
          <ArrowDownLeft size={14} color={tab === 'receivable' ? '#fff' : colors.textSecondary} />
          <Text style={[s.tabText, tab === 'receivable' && s.tabTextActive]}>Debitorlik</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'payable' && s.tabBtnActive]}
          onPress={() => { setTab('payable'); setSearchTerm(''); }}
        >
          <ArrowUpRight size={14} color={tab === 'payable' ? '#fff' : colors.textSecondary} />
          <Text style={[s.tabText, tab === 'payable' && s.tabTextActive]}>Kreditorlik</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Search size={16} color={colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Hamkor nomi bo'yicha qidirish..."
          placeholderTextColor={colors.textMuted} value={searchTerm} onChangeText={setSearchTerm} />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}><X size={16} color={colors.textMuted} /></TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Yuklanmoqda...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={s.center}>
          <Wallet size={48} color={colors.textMuted} />
          <Text style={s.emptyTitle}>
            {tab === 'receivable' ? 'Debitorlik yo\'q' : 'Kreditorlik yo\'q'}
          </Text>
          <Text style={s.emptySubtitle}>Ochiq qarz topilmadi</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.partnerCompanyId}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item: group }) => {
            const stl = getStatusStyle(group.aggregateStatus);
            return (
              <TouchableOpacity
                style={s.groupCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('DebtDetail', {
                  partnerCompanyId: group.partnerCompanyId,
                  partnerName: group.partner?.name,
                  tab,
                })}
              >
                <View style={s.groupHeader}>
                  <View style={s.partnerRow}>
                    <View style={s.partnerIcon}>
                      <Building2 size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.partnerName} numberOfLines={1}>{group.partner?.name || 'Noma\'lum'}</Text>
                      <Text style={s.partnerTin}>STIR: {group.partner?.tin || '—'}</Text>
                    </View>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: stl.bg, borderColor: stl.border }]}>
                    <Text style={[s.statusText, { color: stl.text }]}>{statusLabel(group.aggregateStatus)}</Text>
                  </View>
                </View>

                <View style={s.groupBody}>
                  <View>
                    <Text style={s.bodyLabel}>Qolgan qarz</Text>
                    <Text style={[s.bodyValue, { color: tab === 'receivable' ? '#10b981' : '#ef4444' }]}>
                      {formatDual(group.totalRemaining)}
                    </Text>
                    <Text style={s.bodySubval}>Jami: {formatDual(group.totalAmount)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={s.entryCountBadge}>
                      <Layers size={10} color={colors.textSecondary} />
                      <Text style={s.entryCountText}>{group.entryCount} ta yozuv</Text>
                    </View>
                    {group.hasPendingPayment && (
                      <View style={s.pendingBadge}>
                        <Text style={s.pendingText}>To'lov kutilmoqda</Text>
                      </View>
                    )}
                    <ChevronRight size={14} color={colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { color: c.textSecondary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: c.text },
  subtitle: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: 'bold' },
  emptySubtitle: { color: c.textSecondary, fontSize: 13 },

  // KPI
  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  kpiCard: { flex: 1, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  kpiLabel: { color: c.textMuted, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  kpiValue: { fontSize: 13, fontWeight: 'bold' },

  // Tabs
  tabContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6 },
  tabBtnActive: { backgroundColor: c.primary },
  tabText: { fontSize: 12, fontWeight: 'bold', color: c.textSecondary },
  tabTextActive: { color: '#fff' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, color: c.text, fontSize: 14 },

  // Group Card
  groupCard: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  partnerIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder, justifyContent: 'center', alignItems: 'center' },
  partnerName: { color: c.text, fontSize: 14, fontWeight: 'bold' },
  partnerTin: { color: c.textMuted, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' },

  groupBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: c.cardSecondary, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 12 },
  bodyLabel: { color: c.textMuted, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  bodyValue: { fontSize: 15, fontWeight: 'bold' },
  bodySubval: { color: c.textSecondary, fontSize: 10, marginTop: 2 },
  entryCountBadge: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: c.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.border },
  entryCountText: { color: c.textSecondary, fontSize: 9, fontWeight: 'bold' },
  pendingBadge: { backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  pendingText: { color: '#f59e0b', fontSize: 8, fontWeight: 'bold' },
});
