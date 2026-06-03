import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, KeyboardAvoidingView, Platform, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Search, X, Users, Plus, ChevronRight, Phone, MessageSquare,
  CreditCard, HandCoins
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

export default function PosCustomersScreen({ navigation }: any) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Payment Modal
  const [payModal, setPayModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payCurrency, setPayCurrency] = useState('UZS');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const endpoint = searchTerm.trim() 
        ? `/retail-customers/search?q=${encodeURIComponent(searchTerm.trim())}` 
        : '/retail-customers/summary';
      
      const { data } = await api.get(endpoint);
      setCustomers(data || []);
    } catch (e) {
      console.error('POS Customers error:', e);
    }
  }, [searchTerm]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await fetchCustomers();
    setLoading(false);
  }, [fetchCustomers]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCustomers();
    setRefreshing(false);
  }, [fetchCustomers]);

  const formatMoney = (n: number, cur = 'UZS') => {
    const num = Number(n) || 0;
    if (cur === 'USD') return `$${num.toLocaleString('uz-UZ')}`;
    return `${num.toLocaleString('uz-UZ')} so'm`;
  };

  const handleMakePayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return Alert.alert('Xato', 'Summani to\'g\'ri kiriting');

    setPaying(true);
    try {
      // POST /retail-receivables/:id/payments or /retail-customers/:id/prepaid depending on the exact backend API.
      // Based on architecture and controller, it is /retail-customers/:id/prepaid
      await api.post(`/retail-customers/${selectedCustomer.id}/prepaid`, {
        amount,
        currency: payCurrency,
        notes: payNotes,
      });
      setPayModal(false);
      setPayAmount('');
      setPayNotes('');
      Alert.alert('Muvaffaqiyatli', 'To\'lov qabul qilindi');
      fetchCustomers();
    } catch (e: any) {
      Alert.alert('Xatolik', e.response?.data?.message || 'To\'lov qilishda xatolik');
    } finally {
      setPaying(false);
    }
  };

  const openPayModal = (customer: any) => {
    setSelectedCustomer(customer);
    setPayCurrency('UZS'); // Default
    setPayModal(true);
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Chakana Mijozlar</Text>
          <Text style={s.subtitle}>POS kassa mijozlari va qarzlar</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Search size={16} color={colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Ism yoki telefon raqam..."
          placeholderTextColor={colors.textMuted} value={searchTerm} onChangeText={setSearchTerm} />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}><X size={16} color={colors.textMuted} /></TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : customers.length === 0 ? (
        <View style={s.center}>
          <Users size={48} color={colors.textMuted} />
          <Text style={s.emptyTitle}>Mijozlar topilmadi</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const hasDebtUzs = Number(item.balanceUzs) < 0; // If balance is negative, they owe us. If positive, prepaid.
            const hasDebtUsd = Number(item.balanceUsd) < 0;
            const balanceUzs = Math.abs(Number(item.balanceUzs || 0));
            const balanceUsd = Math.abs(Number(item.balanceUsd || 0));

            return (
              <View style={s.customerCard}>
                <View style={s.customerHeader}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.customerName} numberOfLines={1}>{item.name}</Text>
                    {item.phone && (
                      <View style={s.phoneRow}>
                        <Phone size={10} color={colors.textMuted} />
                        <Text style={s.customerPhone}>{item.phone}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={s.payBtnIcon} onPress={() => openPayModal(item)}>
                    <HandCoins size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={s.balanceRow}>
                  <View>
                    <Text style={s.balanceLabel}>UZS Balans</Text>
                    <Text style={[s.balanceValue, { color: hasDebtUzs ? '#ef4444' : balanceUzs > 0 ? '#10b981' : colors.text }]}>
                      {hasDebtUzs ? '-' : ''}{formatMoney(balanceUzs, 'UZS')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.balanceLabel}>USD Balans</Text>
                    <Text style={[s.balanceValue, { color: hasDebtUsd ? '#ef4444' : balanceUsd > 0 ? '#10b981' : colors.text }]}>
                      {hasDebtUsd ? '-' : ''}{formatMoney(balanceUsd, 'USD')}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Payment Modal */}
      <Modal visible={payModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalContainer}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>To'lov qabul qilish</Text>
                <Text style={s.modalSubtitle}>{selectedCustomer?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setPayModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput style={s.input} placeholder="Summa" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={payAmount} onChangeText={setPayAmount} />
            <View style={s.currencyToggle}>
              <TouchableOpacity style={[s.currBtn, payCurrency === 'UZS' && s.currBtnActive]} onPress={() => setPayCurrency('UZS')}>
                <Text style={[s.currText, payCurrency === 'UZS' && s.currTextActive]}>UZS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.currBtn, payCurrency === 'USD' && s.currBtnActive]} onPress={() => setPayCurrency('USD')}>
                <Text style={[s.currText, payCurrency === 'USD' && s.currTextActive]}>USD</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Izoh (ixtiyoriy)" placeholderTextColor={colors.textMuted} multiline value={payNotes} onChangeText={setPayNotes} />
            
            <TouchableOpacity style={s.submitBtn} onPress={handleMakePayment} disabled={paying}>
              {paying ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Tasdiqlash</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: c.textSecondary, fontSize: 16, fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: c.text },
  subtitle: { fontSize: 11, color: c.textSecondary, marginTop: 2 },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, color: c.text, fontSize: 14 },

  customerCard: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 },
  customerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentBg, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: c.primary, fontSize: 18, fontWeight: 'bold' },
  customerName: { color: c.text, fontSize: 16, fontWeight: 'bold' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  customerPhone: { color: c.textMuted, fontSize: 11 },
  payBtnIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentBg, justifyContent: 'center', alignItems: 'center' },

  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.cardSecondary, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  balanceLabel: { color: c.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  balanceValue: { fontSize: 14, fontWeight: 'bold' },

  // Modal
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
  input: { backgroundColor: c.cardSecondary, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, color: c.text, fontSize: 15, marginBottom: 12 },
  currencyToggle: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  currBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  currBtnActive: { backgroundColor: c.accentBg, borderColor: c.primary },
  currText: { color: c.textSecondary, fontWeight: 'bold' },
  currTextActive: { color: c.primary },
  submitBtn: { backgroundColor: c.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
