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
import { MapPin, Clock, ArrowLeft, Plus } from 'lucide-react-native';
import { api } from '../../api/client';

interface FieldTask {
  id: string;
  title: string;
  status: string;
  assignee?: { fullName: string; login: string };
  scheduledAt?: string;
  customerName?: string;
}

export default function FieldTasksList({ navigation }: any) {
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get('/field/tasks');
      const items = data?.data || data || [];
      setTasks(items);
    } catch (error) {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  }, [fetchTasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REPORTED':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'IN_PROGRESS':
        return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'ASSIGNED':
        return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' };
      case 'APPROVED':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      default:
        return { color: '#666', bg: '#222' };
    }
  };

  const renderItem = ({ item }: { item: FieldTask }) => {
    const statusStyle = getStatusColor(item.status);
    const workerName = item.assignee?.fullName || item.assignee?.login || 'Biriktirilmagan';
    const dateStr = item.scheduledAt 
      ? new Date(item.scheduledAt).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
      : 'Vaqt belgilanmagan';

    return (
      <TouchableOpacity style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.workerBadge}>{workerName}</Text>
          <Text style={[styles.statusBadge, { color: statusStyle.color, backgroundColor: statusStyle.bg }]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Clock size={14} color="#666" />
            <Text style={styles.footerText}>{dateStr}</Text>
          </View>
          {item.customerName && (
            <View style={styles.footerRow}>
              <MapPin size={14} color="#666" />
              <Text style={styles.footerText}>{item.customerName}</Text>
            </View>
          )}
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
        <Text style={styles.headerTitle}>Vazifalar tarixi</Text>
        <TouchableOpacity style={styles.addButton}>
          <Plus size={20} color="#000" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: '#666' }}>Vazifalar topilmadi</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  addButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  workerBadge: {
    color: '#888',
    fontSize: 12,
    backgroundColor: '#222',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
  }
});
