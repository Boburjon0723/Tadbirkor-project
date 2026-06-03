import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  Package,
  CheckCircle,
  AlertTriangle,
  Info,
  Truck,
  ShoppingCart,
} from 'lucide-react-native';
import { api } from '../../api/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: 'READ' | 'UNREAD';
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hozir';
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  return `${days} kun oldin`;
}

function NotifIcon({ type }: { type: string }) {
  if (type?.includes('task') || type?.includes('FIELD'))
    return <CheckCircle color="#10b981" size={22} />;
  if (type?.includes('stock') || type?.includes('STOCK'))
    return <Package color="#f59e0b" size={22} />;
  if (type?.includes('dispatch') || type?.includes('DISPATCH'))
    return <Truck color="#3b82f6" size={22} />;
  if (type?.includes('pos') || type?.includes('POS'))
    return <ShoppingCart color="#8b5cf6" size={22} />;
  if (type?.includes('alert') || type?.includes('ERROR'))
    return <AlertTriangle color="#ef4444" size={22} />;
  return <Info color="#6b7280" size={22} />;
}

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications?limit=50');
      const items: Notification[] =
        data?.data || data?.items || data || [];
      setNotifications(items);
    } catch {
      // Bo'sh qoldirish, foydalanuvchi refresh qila oladi
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n)),
      );
    } catch {
      // Silent fail
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = item.status === 'UNREAD';
    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.unreadCard]}
        onPress={() => markAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, isUnread && styles.iconContainerUnread]}>
          <NotifIcon type={item.type} />
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isUnread && styles.unreadTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.dot} />}
          </View>
          <Text style={styles.desc} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirishnomalar</Text>
        {notifications.some((n) => n.status === 'UNREAD') && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {notifications.filter((n) => n.status === 'UNREAD').length}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Bell size={48} color="#333" />
          <Text style={styles.emptyText}>Yangi bildirishnomalar yo'q</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#0a0a0a',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  unreadCard: { backgroundColor: '#141a24', borderColor: '#1e3a5f' },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  iconContainerUnread: { backgroundColor: '#1e2a3a' },
  content: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: '500', color: '#aaa', flex: 1 },
  unreadTitle: { color: '#fff', fontWeight: 'bold' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    flexShrink: 0,
  },
  desc: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 6 },
  time: { fontSize: 11, color: '#444' },
  emptyText: { fontSize: 15, color: '#666' },
});
