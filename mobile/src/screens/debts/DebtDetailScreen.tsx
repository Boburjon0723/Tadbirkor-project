import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Building2, Wallet, Plus, CheckCircle2, ChevronDown, Layers,
  CreditCard, X, AlertCircle, FileText
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

export default function DebtDetailScreen({ route, navigation }: any) {
  const { partnerCompanyId, partnerName, tab } = route.params || {};
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Payment Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payCurrency, setPayCurrency] = useState('UZS');
  const [paying, setPaying] = useState(false);

  const fetchLedger = useCallback(async () => {
    try {
      const { data } = await api.get(`/debts/partners/${partnerCompanyId}/ledger`);
      setLedger(data);
    } catch (e) {
      console.error('Ledger error:', e);
      Alert.alert('Xatolik', 'Qarz ma\'lumotlarini yuklashda xatolik');
    }
  }, [partnerCompanyId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchLedger();
      setLoading(false);
    };
    load();
  }, [fetchLedger]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLedger();
    setRefreshing(false);
  }, [fetchLedger]);

  const formatMoney = (n: number, currency = 'UZS') => {
    const num = Number(n) || 0;
    if (currency === 'USD') return `$${num.toLocaleString('uz-UZ')}`;
    return `${num.toLocaleString('uz-UZ')} so'm`;
  };

  const formatDate = (dStr: string) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleMakePayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return Alert.alert('Xato', 'Summani to\'g\'ri kiriting');

    setPaying(true);
    try {
      await api.post(`/debts/partners/${partnerCompanyId}/record-bulk-payment`, {
        amount,
        currency: payCurrency,
        notes: payNotes,
        paymentMethod: 'CASH', // default
      });
      setModalVisible(false);
      setPayAmount('');
      setPayNotes('');
      Alert.alert('Muvaffaqiyatli', 'To\'lov qayd etildi');
      fetchLedger();
    } catch (e: any) {
      Alert.alert('Xatolik', e.response?.data?.message || 'To\'lov qilishda xatolik');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!ledger) {
    return (
      <SafeAreaView style={[s.container, s.center]}>
        <Text style={s.emptyTitle}>Ma'lumot topilmadi</Text>
      </SafeAreaView>
    );
  }

  const isDebtor = ledger.isIncoming === false || tab === 'payable'; // I owe them

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{partnerName || ledger.partner?.name}</Text>
          <Text style={s.subtitle}>STIR: {ledger.partner?.tin || '—'}</Text>
        </View>
      </View>

      <FlatList
        data={ledger.entries || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={s.summaryCard}>
            <View style={s.summaryIcon}>
              <Wallet size={24} color={isDebtor ? '#ef4444' : '#10b981'} />
            </View>
            <View>
              <Text style={s.summaryLabel}>Umumiy qoldiq</Text>
              {ledger.totals?.remaining?.uzs > 0 && (
                <Text style={[s.summaryValue, { color: isDebtor ? '#ef4444' : '#10b981' }]}>
                  {formatMoney(ledger.totals.remaining.uzs, 'UZS')}
                </Text>
              )}
              {ledger.totals?.remaining?.usd > 0 && (
                <Text style={[s.summaryValue, { color: isDebtor ? '#ef4444' : '#10b981' }]}>
                  {formatMoney(ledger.totals.remaining.usd, 'USD')}
                </Text>
              )}
              {(!ledger.totals?.remaining?.uzs && !ledger.totals?.remaining?.usd) && (
                <Text style={[s.summaryValue, { color: colors.text }]}>0 so'm</Text>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isExp = expandedEntry === item.id;
          const statusBg = item.status === 'PAID' ? 'rgba(16,185,129,0.1)' : item.status === 'PARTIAL' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)';
          const statusText = item.status === 'PAID' ? '#10b981' : item.status === 'PARTIAL' ? '#3b82f6' : '#ef4444';
          const label = item.status === 'PAID' ? 'To\'langan' : item.status === 'PARTIAL' ? 'Qisman' : 'Ochiq';

          return (
            <View style={s.entryCard}>
              <TouchableOpacity style={s.entryHeader} activeOpacity={0.7} onPress={() => setExpandedEntry(isExp ? null : item.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.entryDate}>{formatDate(item.createdAt)}</Text>
                  <Text style={s.entryAmount}>Jami: {formatMoney(item.amount, item.currency)}</Text>
                  <Text style={s.entryRemaining}>Qoldiq: {formatMoney(item.remainingAmount, item.currency)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <View style={[s.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[s.statusText, { color: statusText }]}>{label}</Text>
                  </View>
                  {item.receipt && (
                    <View style={s.docBadge}>
                      <FileText size={10} color={colors.textSecondary} />
                      <Text style={s.docText}>Hujjat</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              
              {isExp && item.payments && item.payments.length > 0 && (
                <View style={s.paymentsList}>
                  <Text style={s.paymentsTitle}>To'lovlar tarixi:</Text>
                  {item.payments.map((p: any) => (
                    <View key={p.id} style={s.paymentRow}>
                      <View>
                        <Text style={s.payDate}>{formatDate(p.createdAt)}</Text>
                        {p.notes ? <Text style={s.payNotes}>{p.notes}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.payAmount}>{formatMoney(p.amount, item.currency)}</Text>
                        <Text style={[s.payStatus, { color: p.status === 'CONFIRMED' ? '#10b981' : p.status === 'REJECTED' ? '#ef4444' : '#f59e0b' }]}>
                          {p.status === 'CONFIRMED' ? 'Tasdiqlangan' : p.status === 'REJECTED' ? 'Rad etilgan' : 'Kutilmoqda'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.center}>
            <AlertCircle size={40} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Yozuvlar topilmadi</Text>
          </View>
        }
      />

      {isDebtor && (
        <View style={s.footerBar}>
          <TouchableOpacity style={s.payBtn} onPress={() => setModalVisible(true)}>
            <Plus size={20} color="#fff" />
            <Text style={s.payBtnText}>To'lov qo'shish</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Payment Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalContainer}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>To'lov qo'shish</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  emptyTitle: { color: c.textSecondary, fontSize: 16, fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: c.text },
  subtitle: { fontSize: 11, color: c.textSecondary, marginTop: 2 },

  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border, gap: 16 },
  summaryIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: c.cardSecondary, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { color: c.textSecondary, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: 'bold' },

  entryCard: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, marginBottom: 12, overflow: 'hidden' },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  entryDate: { color: c.textMuted, fontSize: 11, marginBottom: 6 },
  entryAmount: { color: c.text, fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  entryRemaining: { color: c.primary, fontSize: 14, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  docBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.cardSecondary, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  docText: { color: c.textSecondary, fontSize: 9, fontWeight: 'bold' },

  paymentsList: { backgroundColor: c.cardSecondary, padding: 16, borderTopWidth: 1, borderTopColor: c.border },
  paymentsTitle: { color: c.textSecondary, fontSize: 11, fontWeight: 'bold', marginBottom: 12 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  payDate: { color: c.text, fontSize: 12 },
  payNotes: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  payAmount: { color: c.text, fontSize: 13, fontWeight: 'bold' },
  payStatus: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 },

  footerBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 14, borderRadius: 14 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Modal
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: 'bold' },
  input: { backgroundColor: c.cardSecondary, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, color: c.text, fontSize: 15, marginBottom: 12 },
  currencyToggle: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  currBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  currBtnActive: { backgroundColor: c.accentBg, borderColor: c.primary },
  currText: { color: c.textSecondary, fontWeight: 'bold' },
  currTextActive: { color: c.primary },
  submitBtn: { backgroundColor: c.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
