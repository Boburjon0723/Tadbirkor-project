import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, User, UserX } from 'lucide-react-native';
import { api } from '../../api/client';
import type { PosCustomerSelection } from '../../lib/pos-customer.util';

type Props = {
  visible: boolean;
  value?: PosCustomerSelection | null;
  onSelect: (customer: PosCustomerSelection | null) => void;
  onClose: () => void;
};

export function PosCustomerPickerSheet({
  visible,
  value,
  onSelect,
  onClose,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCustomers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `/retail-customers/search?q=${encodeURIComponent(q.trim())}`
        : '/retail-customers/summary';
      const { data } = await api.get(endpoint);
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => fetchCustomers(searchTerm), searchTerm.trim() ? 350 : 0);
    return () => clearTimeout(t);
  }, [visible, searchTerm, fetchCustomers]);

  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mijoz tanlash</Text>
            <Text style={styles.subtitle}>Qidirish yoki mehmon sifatida davom etish</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Search size={16} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Ism yoki telefon..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoFocus
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.guestRow, !hasSelection(value) && styles.guestRowActive]}
          onPress={() => {
            onSelect(null);
            handleClose();
          }}
        >
          <UserX size={18} color="#64748b" />
          <Text style={styles.guestText}>Mehmon (mijozsiz)</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {searchTerm.trim() ? 'Mijoz topilmadi' : 'Mijozlar ro‘yxati bo‘sh'}
              </Text>
            }
            renderItem={({ item }) => {
              const selected = value?.retailCustomerId === item.id;
              return (
                <TouchableOpacity
                  style={[styles.row, selected && styles.rowActive]}
                  onPress={() => {
                    onSelect({
                      retailCustomerId: item.id,
                      customerName: item.name,
                      customerPhone: item.phone || undefined,
                    });
                    handleClose();
                  }}
                >
                  <View style={styles.avatar}>
                    <User size={16} color="#3b82f6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.phone} numberOfLines={1}>
                      {item.phone || 'Telefon yo‘q'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function hasSelection(value?: PosCustomerSelection | null) {
  return !!value?.retailCustomerId || !!value?.customerName?.trim();
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    minHeight: 320,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  guestRowActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  guestText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  loading: {
    padding: 32,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    paddingVertical: 24,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowActive: {
    backgroundColor: '#eff6ff',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  phone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
