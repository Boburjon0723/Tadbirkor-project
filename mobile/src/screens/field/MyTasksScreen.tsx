import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Clock, ArrowRight, ClipboardList } from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

export default function MyTasksScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get('/field/me/tasks');
      setTasks(Array.isArray(data) ? data : (data?.items || []));
    } catch (e) {
      console.error('Error fetching field tasks', e);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await fetchTasks();
    setLoading(false);
  }, [fetchTasks]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  }, [fetchTasks]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusCfg = (status: string) => {
    switch(status) {
      case 'IN_PROGRESS': return { label: 'Jarayonda', bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' };
      case 'APPROVED': return { label: 'Bajarildi', bg: 'rgba(16,185,129,0.1)', text: '#10b981' };
      case 'REJECTED': return { label: 'Rad etildi', bg: 'rgba(239,68,68,0.1)', text: '#ef4444' };
      default: return { label: 'Yangi', bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' };
    }
  };

  const renderItem = ({ item }: any) => {
    const st = getStatusCfg(item.status);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>
          <View style={styles.timeWrapper}>
            <Clock size={12} color={colors.textSecondary} />
            <Text style={styles.timeText}>{formatDate(item.createdAt || item.assignedAt)}</Text>
          </View>
        </View>

        <Text style={styles.title}>{item.title || 'Vazifa nomi kiritilmagan'}</Text>
        <Text style={styles.customer}>{item.customerName || 'Noma\'lum mijoz'}</Text>

        <View style={styles.footer}>
          <View style={styles.addressWrapper}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.address || item.customerAddress || 'Manzil kiritilmagan'}
            </Text>
          </View>
          <View style={styles.arrowButton}>
            <ArrowRight size={16} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mening Vazifalarim</Text>
        <Text style={styles.headerSubtitle}>Bugungi qilinadigan ishlar</Text>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <ClipboardList size={48} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>Vazifalar yo'q</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: c.text },
  headerSubtitle: { fontSize: 13, color: c.textSecondary, marginTop: 4 },

  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  timeWrapper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { color: c.textSecondary, fontSize: 11, fontWeight: 'bold' },

  title: { color: c.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  customer: { color: c.textSecondary, fontSize: 13, marginBottom: 20 },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 },
  addressWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 16 },
  addressText: { color: c.textSecondary, fontSize: 12 },
  arrowButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }
});
