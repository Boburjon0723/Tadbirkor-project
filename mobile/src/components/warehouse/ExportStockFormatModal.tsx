import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FileSpreadsheet, FileText, X } from 'lucide-react-native';
import { useTheme } from '../../theme';

type Props = {
  visible: boolean;
  loading?: boolean;
  warehouseName?: string;
  onClose: () => void;
  onPick: (format: 'excel' | 'pdf') => void;
};

export function ExportStockFormatModal({
  visible,
  loading,
  warehouseName,
  onClose,
  onPick,
}: Props) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.bg}>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>Zaxirani eksport</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={s.sub}>
            {warehouseName ? `Ombor: ${warehouseName}` : 'Tanlangan ombor bo‘yicha'}
          </Text>

          <TouchableOpacity
            style={s.option}
            onPress={() => onPick('excel')}
            disabled={loading}
          >
            <FileSpreadsheet size={22} color="#10b981" />
            <View style={s.optionBody}>
              <Text style={s.optionTitle}>Excel (.xlsx)</Text>
              <Text style={s.optionDesc}>Tahrir va qayta import uchun</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.option}
            onPress={() => onPick('pdf')}
            disabled={loading}
          >
            <FileText size={22} color="#ef4444" />
            <View style={s.optionBody}>
              <Text style={s.optionTitle}>PDF</Text>
              <Text style={s.optionDesc}>Chop etish va ulashish uchun</Text>
            </View>
          </TouchableOpacity>

          {loading ? (
            <View style={s.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.loadingText}>Fayl tayyorlanmoqda...</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'center', padding: 20 },
    card: {
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: c.text, fontSize: 16, fontWeight: 'bold' },
    sub: { color: c.textSecondary, fontSize: 11, marginTop: 6, marginBottom: 14 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 10,
      backgroundColor: c.cardSecondary,
    },
    optionBody: { flex: 1 },
    optionTitle: { color: c.text, fontSize: 14, fontWeight: 'bold' },
    optionDesc: { color: c.textSecondary, fontSize: 10, marginTop: 2 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    loadingText: { color: c.textSecondary, fontSize: 11 },
  });
