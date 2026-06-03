import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  InputAccessoryView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

const KEYBOARD_DONE_ID = 'stock-adjust-keyboard-done';

type BalanceItem = {
  productVariant?: {
    id?: string;
    name?: string;
    product?: { name?: string };
  };
  quantity?: number | string;
};

type Props = {
  visible: boolean;
  balance: BalanceItem | null;
  warehouseId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function StockAdjustModal({
  visible,
  balance,
  warehouseId,
  onClose,
  onSuccess,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = getStyles(colors);
  const [mode, setMode] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const variantId = balance?.productVariant?.id;
  const productName =
    balance?.productVariant?.product?.name ||
    balance?.productVariant?.name ||
    'Mahsulot';
  const currentQty = Number(balance?.quantity || 0);

  const reset = () => {
    setMode('IN');
    setQty('');
    setNote('');
    Keyboard.dismiss();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    Keyboard.dismiss();
    const amount = Number(qty.replace(',', '.'));
    if (!warehouseId || !variantId) {
      Alert.alert('Xatolik', 'Ombor yoki variant topilmadi');
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert('Xatolik', 'Miqdorni kiriting');
      return;
    }

    if (mode === 'OUT' && amount > currentQty) {
      Alert.alert(
        'Yetarli qoldiq yo‘q',
        `Omborda ${currentQty} bor, ${amount} chiqim qilib bo‘lmaydi.`,
      );
      return;
    }

    setLoading(true);
    try {
      const path = mode === 'IN' ? '/stock/movements/in' : '/stock/movements/out';
      await api.post(path, {
        warehouseId,
        productVariantId: variantId,
        quantity: amount,
        note: note.trim() || undefined,
      });
      Alert.alert('Tayyor', mode === 'IN' ? 'Kirim qayd etildi' : 'Chiqim qayd etildi');
      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Amal bajarilmadi';
      Alert.alert('Xatolik', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  const keyboardDoneBar =
    Platform.OS === 'ios' ? (
      <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
        <View style={s.accessoryBar}>
          <TouchableOpacity onPress={Keyboard.dismiss} style={s.accessoryBtn}>
            <Text style={s.accessoryBtnText}>Tayyor</Text>
          </TouchableOpacity>
        </View>
      </InputAccessoryView>
    ) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {keyboardDoneBar}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={s.bg}>
            <TouchableWithoutFeedback accessible={false}>
              <View style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <View style={s.header}>
                    <Text style={s.title}>Qoldiqni tahrir</Text>
                    <TouchableOpacity onPress={handleClose} hitSlop={12}>
                      <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.prodName} numberOfLines={2}>
                    {productName}
                  </Text>
                  <Text style={s.sub}>Joriy qoldiq: {currentQty}</Text>

                  <View style={s.modeRow}>
                    <TouchableOpacity
                      style={[s.modeBtn, mode === 'IN' && s.modeBtnIn]}
                      onPress={() => setMode('IN')}
                    >
                      <TrendingUp size={16} color={mode === 'IN' ? '#fff' : '#10b981'} />
                      <Text style={[s.modeText, mode === 'IN' && s.modeTextActive]}>Kirim</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.modeBtn, mode === 'OUT' && s.modeBtnOut]}
                      onPress={() => setMode('OUT')}
                    >
                      <TrendingDown size={16} color={mode === 'OUT' ? '#fff' : '#ef4444'} />
                      <Text style={[s.modeText, mode === 'OUT' && s.modeTextActive]}>Chiqim</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={s.label}>MIQDOR</Text>
                  <TextInput
                    style={s.input}
                    value={qty}
                    onChangeText={setQty}
                    keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                    inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_DONE_ID : undefined}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                  <Text style={s.label}>IZOH (ixtiyoriy)</Text>
                  <TextInput
                    style={s.input}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Masalan: inventarizatsiya"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  {Platform.OS === 'android' ? (
                    <TouchableOpacity style={s.dismissKb} onPress={Keyboard.dismiss}>
                      <Text style={s.dismissKbText}>Klaviaturani yopish</Text>
                    </TouchableOpacity>
                  ) : null}
                </ScrollView>

                <TouchableOpacity style={s.submit} onPress={submit} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.submitText}>Saqlash</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    flex: { flex: 1 },
    bg: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'flex-end' },
    card: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 16,
      borderWidth: 1,
      borderColor: c.border,
      maxHeight: '88%',
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    title: { color: c.text, fontSize: 16, fontWeight: 'bold' },
    prodName: { color: c.text, fontSize: 14, fontWeight: '600' },
    sub: { color: c.textSecondary, fontSize: 11, marginBottom: 12 },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    modeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    modeBtnIn: { backgroundColor: '#10b981', borderColor: '#10b981' },
    modeBtnOut: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
    modeText: { color: c.textSecondary, fontSize: 12, fontWeight: 'bold' },
    modeTextActive: { color: '#fff' },
    label: { color: c.textSecondary, fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: c.text,
      marginBottom: 12,
      fontSize: 16,
    },
    dismissKb: {
      alignSelf: 'flex-end',
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginBottom: 4,
    },
    dismissKbText: { color: c.primary, fontSize: 12, fontWeight: '600' },
    submit: {
      backgroundColor: c.primary,
      borderRadius: 12,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitText: { color: '#fff', fontWeight: 'bold' },
    accessoryBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    accessoryBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    accessoryBtnText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  });
