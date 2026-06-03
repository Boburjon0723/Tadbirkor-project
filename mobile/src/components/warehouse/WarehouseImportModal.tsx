import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Upload, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

type ImportMode = 'set' | 'add' | 'subtract';

type Props = {
  visible: boolean;
  warehouseId: string | null;
  warehouseName?: string;
  onClose: () => void;
  onSuccess: () => void;
};

async function waitImportJob(jobId: string, maxMs = 120_000): Promise<any> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const { data } = await api.get(`/products/import/jobs/${jobId}`);
    const status = String(data?.status || '');
    if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'].includes(status)) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Import vaqti tugadi. Keyinroq statusni tekshiring.');
}

function hasImportableStock(row: any): boolean {
  const raw = row?.initialStockRaw ?? row?.initialStock;
  return (
    row?.fileStockMode === 'with_stock' &&
    Number.isFinite(Number(raw)) &&
    Number(raw) > 0
  );
}

function countConfirmableRows(preview: any): number {
  if (typeof preview?.confirmable === 'number') return Number(preview.confirmable);
  if (!Array.isArray(preview?.rows)) return Number(preview?.valid ?? 0);
  return preview.rows.filter(
    (r: any) =>
      (r.errors || []).length === 0 &&
      (r.rowAction !== 'skip' || hasImportableStock(r)),
  ).length;
}

export function WarehouseImportModal({
  visible,
  warehouseId,
  warehouseName,
  onClose,
  onSuccess,
}: Props) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importMode, setImportMode] = useState<ImportMode>('add');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setFileName(null);
    setPreview(null);
    setImportMode('add');
    setLoading(false);
    setImporting(false);
  }, []);

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const pickFile = async () => {
    if (!warehouseId) {
      Alert.alert('Xatolik', 'Avval omborni tanlang');
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setFileName(asset.name);
    setLoading(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || 'import.xlsx',
        type: asset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any);

      const { data } = await api.post('/products/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { warehouseId, importMode },
      });
      setPreview(data);
      if (data?.defaultImportMode) {
        setImportMode(data.defaultImportMode as ImportMode);
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Faylni o‘qib bo‘lmadi';
      Alert.alert('Xatolik', Array.isArray(msg) ? msg.join('\n') : String(msg));
      setFileName(null);
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = async () => {
    const confirmableCount = countConfirmableRows(preview);
    if (!preview || !warehouseId || confirmableCount === 0) return;

    setImporting(true);
    try {
      const validRows = (preview.rows || [])
        .filter(
          (r: any) =>
            (r.errors || []).length === 0 &&
            (r.rowAction !== 'skip' || hasImportableStock(r)),
        )
        .map((r: any) => ({
          ...r,
          warehouseId: r.warehouseId || warehouseId,
        }));

      const { data: queued } = await api.post(
        '/products/import/confirm',
        {
          rows: validRows,
          importMode,
          stockPolicy: 'apply_all',
        },
        { params: { warehouseId } },
      );

      if (queued?.sync) {
        const ok = Number(queued?.successRows ?? validRows.length);
        Alert.alert('Import yakunlandi', `${ok} ta qator qayd etildi`);
        reset();
        onSuccess();
        onClose();
        return;
      }

      const jobId = queued?.jobId as string | undefined;
      if (!jobId) throw new Error('Import navbati yaratilmadi');

      const job = await waitImportJob(jobId);
      const ok = Number(job?.successRows || 0);
      const bad = Number(job?.failedRows || 0);
      Alert.alert(
        'Import yakunlandi',
        bad > 0 ? `${ok} muvaffaqiyatli, ${bad} ta xato` : `${ok} ta qator import qilindi`,
      );
      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Import xatosi';
      Alert.alert('Xatolik', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setImporting(false);
    }
  };

  const errorSamples = (preview?.rows || [])
    .filter((r: any) => r.errors?.length > 0)
    .slice(0, 3);
  const confirmableCount = countConfirmableRows(preview);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.bg}>
        <View style={s.card}>
          <View style={s.header}>
            <FileSpreadsheet size={20} color="#10b981" />
            <Text style={s.title}>Excel import</Text>
            <TouchableOpacity onPress={handleClose} disabled={importing}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={s.sub}>
            Ombor: {warehouseName || '—'}. Avval «Import shablon» yoki «Tahrir formati»ni yuklab oling.
          </Text>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <View style={s.modeRow}>
              {(['set', 'add', 'subtract'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.modePill, importMode === m && s.modePillActive]}
                  onPress={() => setImportMode(m)}
                  disabled={importing}
                >
                  <Text style={[s.modePillText, importMode === m && s.modePillTextActive]}>
                    {m === 'set' ? 'Almashtirish' : m === 'add' ? 'Qo‘shish' : 'Ayirish'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.pickBtn} onPress={pickFile} disabled={loading || importing}>
              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Upload size={18} color={colors.primary} />
                  <Text style={s.pickText}>
                    {fileName ? fileName : 'Excel faylni tanlash (.xlsx)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {preview ? (
              <View style={s.previewBox}>
                <Text style={s.previewTitle}>Ko‘rib chiqish</Text>
                <Text style={s.previewLine}>Jami qator: {preview.total}</Text>
                <Text style={[s.previewLine, { color: '#10b981' }]}>
                  Importga tayyor: {confirmableCount}
                </Text>
                <Text style={s.previewLine}>Xato: {preview.invalid}</Text>
                <Text style={s.previewLine}>Yangi: {preview.create} · Yangilash: {preview.update}</Text>
                {errorSamples.map((r: any, i: number) => (
                  <Text key={i} style={s.errorLine} numberOfLines={2}>
                    Qator {r.rowNumber || i + 1}: {r.errors?.[0]}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[s.confirmBtn, (!preview || preview.valid === 0 || importing) && s.disabled]}
            onPress={confirmImport}
            disabled={!preview || confirmableCount === 0 || importing}
          >
            {importing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <CheckCircle2 size={18} color="#fff" />
                <Text style={s.confirmText}>Importni tasdiqlash</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'flex-end' },
    card: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      maxHeight: '92%',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    title: { flex: 1, color: c.text, fontSize: 16, fontWeight: 'bold' },
    sub: { color: c.textSecondary, fontSize: 11, marginBottom: 12, lineHeight: 16 },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    modePill: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    modePillActive: { backgroundColor: c.primary, borderColor: c.primary },
    modePillText: { color: c.textSecondary, fontSize: 10, fontWeight: 'bold' },
    modePillTextActive: { color: '#fff' },
    pickBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
      marginBottom: 12,
    },
    pickText: { color: c.text, fontSize: 12, flex: 1 },
    previewBox: {
      backgroundColor: c.cardSecondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    previewTitle: { color: c.text, fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
    previewLine: { color: c.textSecondary, fontSize: 11, marginBottom: 2 },
    errorLine: { color: '#ef4444', fontSize: 10, marginTop: 4 },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 12,
      height: 46,
      marginTop: 8,
    },
    confirmText: { color: '#fff', fontWeight: 'bold' },
    disabled: { opacity: 0.5 },
  });
