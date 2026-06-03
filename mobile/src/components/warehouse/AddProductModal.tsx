import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Package,
  Tag,
  Warehouse,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

const PRODUCT_TYPES = [
  { value: 'GOODS', label: 'Tovar' },
  { value: 'SERVICE', label: 'Xizmat' },
  { value: 'RAW_MATERIAL', label: 'Xom ashyo' },
  { value: 'FINISHED_GOOD', label: 'Tayyor mahsulot' },
];

const UNITS = ['dona', 'kg', 'litr', 'm', 'm²', 'm³', 'quti', 'juft', 'komplekt'];

type Category = { id: string; name: string };
type Warehouse = { id: string; name: string };
type Variant = {
  name: string;
  salePrice: string;
  purchasePrice: string;
  sku: string;
};

type Props = {
  visible: boolean;
  warehouses: Warehouse[];
  activeWarehouseId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddProductModal({ visible, warehouses, activeWarehouseId, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = getStyles(colors);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState('GOODS');
  const [unit, setUnit] = useState('dona');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // Step 2
  const [variants, setVariants] = useState<Variant[]>([
    { name: '', salePrice: '', purchasePrice: '', sku: '' },
  ]);

  // Step 3
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(activeWarehouseId || '');
  const [initialStock, setInitialStock] = useState('');

  useEffect(() => {
    if (visible) {
      loadCategories();
      setSelectedWarehouseId(activeWarehouseId || '');
    }
  }, [visible, activeWarehouseId]);

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const { data } = await api.get('/product-categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    } finally {
      setCatLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setName('');
    setCategoryId('');
    setProductType('GOODS');
    setUnit('dona');
    setVariants([{ name: '', salePrice: '', purchasePrice: '', sku: '' }]);
    setSelectedWarehouseId(activeWarehouseId || '');
    setInitialStock('');
    setShowCatPicker(false);
    setShowTypePicker(false);
    setShowUnitPicker(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateStep1 = () => {
    if (!name.trim()) { Alert.alert('Xatolik', 'Mahsulot nomini kiriting'); return false; }
    if (!categoryId) { Alert.alert('Xatolik', 'Kategoriya tanlang'); return false; }
    return true;
  };

  const validateStep2 = () => {
    for (let i = 0; i < variants.length; i++) {
      if (!variants[i].name.trim()) {
        Alert.alert('Xatolik', `${i + 1}-variantning nomini kiriting`);
        return false;
      }
      if (!variants[i].salePrice || Number(variants[i].salePrice) < 0) {
        Alert.alert('Xatolik', `${i + 1}-variantning sotuv narxini kiriting`);
        return false;
      }
    }
    return true;
  };

  const updateVariant = (index: number, field: keyof Variant, value: string) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const addVariant = () => {
    setVariants(prev => [...prev, { name: '', salePrice: '', purchasePrice: '', sku: '' }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length === 1) { Alert.alert('Xatolik', 'Kamida 1 ta variant bo\'lishi kerak'); return; }
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const stock = Number(initialStock);
      const payload: any = {
        name: name.trim(),
        categoryId,
        type: productType,
        unit,
        variants: variants.map(v => ({
          name: v.name.trim(),
          salePrice: Number(v.salePrice) || 0,
          purchasePrice: Number(v.purchasePrice) || 0,
          sku: v.sku.trim() || undefined,
          currency: 'UZS',
          ...(stock > 0 && selectedWarehouseId ? {
            initialStock: stock,
            warehouseId: selectedWarehouseId,
          } : {}),
        })),
      };

      await api.post('/products', payload);
      Alert.alert('Muvaffaqiyatli! ✅', `"${name}" mahsuloti qo'shildi`);
      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Mahsulot qo\'shishda xatolik';
      Alert.alert('Xatolik', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  const selectedCat = categories.find(c => c.id === categoryId);
  const selectedType = PRODUCT_TYPES.find(t => t.value === productType);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={s.overlay}>
            <TouchableWithoutFeedback accessible={false}>
              <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {/* Header */}
                <View style={s.header}>
                  <View style={s.headerLeft}>
                    <Package size={18} color={colors.primary} />
                    <Text style={s.headerTitle}>Yangi Mahsulot</Text>
                  </View>
                  <TouchableOpacity onPress={handleClose} hitSlop={12} style={s.closeBtn}>
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Step Indicator */}
                <View style={s.stepRow}>
                  {[1, 2, 3].map(n => (
                    <React.Fragment key={n}>
                      <View style={[s.stepDot, step >= n && s.stepDotActive]}>
                        {step > n ? (
                          <CheckCircle2 size={14} color="#fff" />
                        ) : (
                          <Text style={[s.stepNum, step >= n && s.stepNumActive]}>{n}</Text>
                        )}
                      </View>
                      {n < 3 && (
                        <View style={[s.stepLine, step > n && s.stepLineActive]} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
                <Text style={s.stepLabel}>
                  {step === 1 ? 'Asosiy ma\'lumot' : step === 2 ? 'Variantlar' : 'Boshlang\'ich zaxira'}
                </Text>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={s.scrollContent}
                >
                  {/* ── STEP 1 ── */}
                  {step === 1 && (
                    <View style={s.stepContent}>
                      <Text style={s.fieldLabel}>MAHSULOT NOMI *</Text>
                      <TextInput
                        style={s.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Masalan: Coca-Cola 1L"
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="next"
                      />

                      <Text style={s.fieldLabel}>KATEGORIYA *</Text>
                      <TouchableOpacity
                        style={s.pickerBtn}
                        onPress={() => { setShowCatPicker(true); setShowTypePicker(false); setShowUnitPicker(false); }}
                      >
                        <Tag size={14} color={selectedCat ? colors.primary : colors.textSecondary} />
                        <Text style={[s.pickerText, selectedCat && s.pickerTextSelected]}>
                          {catLoading ? 'Yuklanmoqda...' : selectedCat ? selectedCat.name : 'Tanlang...'}
                        </Text>
                        <ChevronRight size={14} color={colors.textSecondary} />
                      </TouchableOpacity>

                      {showCatPicker && (
                        <View style={s.dropdownBox}>
                          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                            {categories.map(cat => (
                              <TouchableOpacity
                                key={cat.id}
                                style={[s.dropdownItem, categoryId === cat.id && s.dropdownItemActive]}
                                onPress={() => { setCategoryId(cat.id); setShowCatPicker(false); }}
                              >
                                <Text style={[s.dropdownText, categoryId === cat.id && s.dropdownTextActive]}>
                                  {cat.name}
                                </Text>
                                {categoryId === cat.id && <CheckCircle2 size={14} color={colors.primary} />}
                              </TouchableOpacity>
                            ))}
                            {categories.length === 0 && (
                              <Text style={s.emptyDropdown}>Kategoriyalar topilmadi</Text>
                            )}
                          </ScrollView>
                        </View>
                      )}

                      <Text style={s.fieldLabel}>TURI</Text>
                      <TouchableOpacity
                        style={s.pickerBtn}
                        onPress={() => { setShowTypePicker(t => !t); setShowCatPicker(false); setShowUnitPicker(false); }}
                      >
                        <Text style={s.pickerTextSelected}>{selectedType?.label}</Text>
                        <ChevronRight size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {showTypePicker && (
                        <View style={s.dropdownBox}>
                          {PRODUCT_TYPES.map(t => (
                            <TouchableOpacity
                              key={t.value}
                              style={[s.dropdownItem, productType === t.value && s.dropdownItemActive]}
                              onPress={() => { setProductType(t.value); setShowTypePicker(false); }}
                            >
                              <Text style={[s.dropdownText, productType === t.value && s.dropdownTextActive]}>{t.label}</Text>
                              {productType === t.value && <CheckCircle2 size={14} color={colors.primary} />}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <Text style={s.fieldLabel}>O'LCHOV BIRLIGI</Text>
                      <TouchableOpacity
                        style={s.pickerBtn}
                        onPress={() => { setShowUnitPicker(u => !u); setShowCatPicker(false); setShowTypePicker(false); }}
                      >
                        <Text style={s.pickerTextSelected}>{unit}</Text>
                        <ChevronRight size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {showUnitPicker && (
                        <View style={s.dropdownBox}>
                          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                            {UNITS.map(u => (
                              <TouchableOpacity
                                key={u}
                                style={[s.dropdownItem, unit === u && s.dropdownItemActive]}
                                onPress={() => { setUnit(u); setShowUnitPicker(false); }}
                              >
                                <Text style={[s.dropdownText, unit === u && s.dropdownTextActive]}>{u}</Text>
                                {unit === u && <CheckCircle2 size={14} color={colors.primary} />}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── STEP 2 ── */}
                  {step === 2 && (
                    <View style={s.stepContent}>
                      <Text style={s.stepHint}>Kamida 1 ta variant bo'lishi kerak. Bir xil mahsulotning turli o'lchami, rangi bo'lsa — ko'p variant qo'shing.</Text>
                      {variants.map((v, idx) => (
                        <View key={idx} style={s.variantCard}>
                          <View style={s.variantHeader}>
                            <Text style={s.variantTitle}>Variant {idx + 1}</Text>
                            {variants.length > 1 && (
                              <TouchableOpacity onPress={() => removeVariant(idx)} hitSlop={8}>
                                <Trash2 size={15} color="#ef4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={s.fieldLabel}>VARIANT NOMI *</Text>
                          <TextInput
                            style={s.input}
                            value={v.name}
                            onChangeText={val => updateVariant(idx, 'name', val)}
                            placeholder="Masalan: Standart yoki 0.5L"
                            placeholderTextColor={colors.textSecondary}
                          />
                          <View style={s.row2}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.fieldLabel}>SOTUV NARXI *</Text>
                              <TextInput
                                style={s.input}
                                value={v.salePrice}
                                onChangeText={val => updateVariant(idx, 'salePrice', val)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={colors.textSecondary}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.fieldLabel}>KIRIM NARXI</Text>
                              <TextInput
                                style={s.input}
                                value={v.purchasePrice}
                                onChangeText={val => updateVariant(idx, 'purchasePrice', val)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={colors.textSecondary}
                              />
                            </View>
                          </View>
                          <Text style={s.fieldLabel}>SKU (ixtiyoriy)</Text>
                          <TextInput
                            style={s.input}
                            value={v.sku}
                            onChangeText={val => updateVariant(idx, 'sku', val)}
                            placeholder="Masalan: CC-1L-001"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="characters"
                          />
                        </View>
                      ))}
                      <TouchableOpacity style={s.addVariantBtn} onPress={addVariant}>
                        <Plus size={15} color={colors.primary} />
                        <Text style={s.addVariantText}>Variant qo'shish</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ── STEP 3 ── */}
                  {step === 3 && (
                    <View style={s.stepContent}>
                      <Text style={s.stepHint}>Boshlang'ich qoldiq ixtiyoriy. O'tkazib yuborish mumkin.</Text>

                      <Text style={s.fieldLabel}>OMBOR TANLANG</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {warehouses.map(wh => (
                            <TouchableOpacity
                              key={wh.id}
                              style={[s.whChip, selectedWarehouseId === wh.id && s.whChipActive]}
                              onPress={() => setSelectedWarehouseId(wh.id)}
                            >
                              <Warehouse size={12} color={selectedWarehouseId === wh.id ? '#fff' : colors.textSecondary} />
                              <Text style={[s.whChipText, selectedWarehouseId === wh.id && s.whChipTextActive]}>
                                {wh.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>

                      <Text style={s.fieldLabel}>BOSHLANG'ICH MIQDOR (barcha variantlarga)</Text>
                      <TextInput
                        style={s.input}
                        value={initialStock}
                        onChangeText={setInitialStock}
                        keyboardType="numeric"
                        placeholder="0 (bo'sh qoldirsa — zaxira qo'shilmaydi)"
                        placeholderTextColor={colors.textSecondary}
                      />

                      <View style={s.summaryBox}>
                        <Text style={s.summaryTitle}>📋 Xulosa</Text>
                        <Text style={s.summaryText}>Mahsulot: <Text style={s.summaryVal}>{name}</Text></Text>
                        <Text style={s.summaryText}>Kategoriya: <Text style={s.summaryVal}>{selectedCat?.name || '—'}</Text></Text>
                        <Text style={s.summaryText}>Tur: <Text style={s.summaryVal}>{selectedType?.label}</Text></Text>
                        <Text style={s.summaryText}>Variantlar: <Text style={s.summaryVal}>{variants.length} ta</Text></Text>
                        {Number(initialStock) > 0 && (
                          <Text style={s.summaryText}>Boshlang'ich zaxira: <Text style={[s.summaryVal, { color: '#10b981' }]}>{initialStock} {unit}</Text></Text>
                        )}
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Footer Buttons */}
                <View style={s.footer}>
                  {step > 1 && (
                    <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => s - 1)}>
                      <ChevronLeft size={16} color={colors.textSecondary} />
                      <Text style={s.backBtnText}>Orqaga</Text>
                    </TouchableOpacity>
                  )}
                  {step < 3 ? (
                    <TouchableOpacity
                      style={s.nextBtn}
                      onPress={() => {
                        if (step === 1 && !validateStep1()) return;
                        if (step === 2 && !validateStep2()) return;
                        setStep(s => s + 1);
                      }}
                    >
                      <Text style={s.nextBtnText}>Keyingisi</Text>
                      <ChevronRight size={16} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.nextBtn, { backgroundColor: '#10b981' }]}
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <CheckCircle2 size={16} color="#fff" />
                          <Text style={s.nextBtnText}>Saqlash</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: c.text, fontSize: 16, fontWeight: 'bold' },
  closeBtn: { padding: 4 },

  // Step indicator
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: c.cardSecondary,
    borderWidth: 1, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotActive: { backgroundColor: c.primary, borderColor: c.primary },
  stepNum: { color: c.textSecondary, fontSize: 12, fontWeight: 'bold' },
  stepNumActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: c.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: c.primary },
  stepLabel: { color: c.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 16 },

  scrollContent: { paddingBottom: 8 },
  stepContent: { gap: 4 },
  stepHint: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },

  fieldLabel: { color: c.textSecondary, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: c.cardSecondary,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 12, height: 46,
    paddingHorizontal: 14, color: c.text, fontSize: 14,
    marginBottom: 4,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.cardSecondary,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 12, height: 46,
    paddingHorizontal: 14, marginBottom: 4,
  },
  pickerText: { flex: 1, color: c.textSecondary, fontSize: 14 },
  pickerTextSelected: { flex: 1, color: c.text, fontSize: 14 },
  dropdownBox: {
    backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 12, marginBottom: 8,
    overflow: 'hidden',
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  dropdownItemActive: { backgroundColor: c.accentBg },
  dropdownText: { color: c.text, fontSize: 14 },
  dropdownTextActive: { color: c.primary, fontWeight: 'bold' },
  emptyDropdown: { color: c.textSecondary, fontSize: 12, padding: 14, textAlign: 'center' },

  variantCard: {
    backgroundColor: c.cardSecondary,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 12, marginBottom: 12,
  },
  variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  variantTitle: { color: c.primary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  row2: { flexDirection: 'row', gap: 8 },

  addVariantBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: c.primary, borderStyle: 'dashed',
    borderRadius: 12, height: 42, marginTop: 4,
  },
  addVariantText: { color: c.primary, fontSize: 13, fontWeight: '600' },

  // Step 3
  whChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.cardSecondary,
  },
  whChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  whChipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  whChipTextActive: { color: '#fff' },

  summaryBox: {
    backgroundColor: c.cardSecondary,
    borderWidth: 1, borderColor: c.border,
    borderRadius: 16, padding: 14, marginTop: 8, gap: 6,
  },
  summaryTitle: { color: c.text, fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  summaryText: { color: c.textSecondary, fontSize: 12 },
  summaryVal: { color: c.text, fontWeight: '600' },

  // Footer
  footer: { flexDirection: 'row', gap: 8, paddingTop: 12 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: c.border,
  },
  backBtnText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  nextBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.primary, height: 48, borderRadius: 12,
  },
  nextBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
