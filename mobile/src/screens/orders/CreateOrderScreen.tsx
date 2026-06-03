import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Search, X, Plus, Minus, ShoppingCart, Send, Package, Building2, Trash2,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

type CartItem = {
  productVariantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  expectedPrice: number;
  expectedCurrency: string;
  sku: string;
  availableQty: number;
};

export default function CreateOrderScreen({ navigation }: any) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<'partner' | 'catalog'>('partner');

  // Load partners list
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/partners');
        const active = (Array.isArray(data) ? data : data.items || [])
          .filter((p: any) => p.status === 'ACTIVE');
        setPartners(active);
      } catch (e) { console.error('Partners error:', e); }
      setLoading(false);
    })();
  }, []);

  // Load seller catalog when partner selected
  const loadCatalog = useCallback(async (search?: string) => {
    if (!selectedPartner) return;
    setCatalogLoading(true);
    try {
      const partnerId = selectedPartner.partnerCompanyId || selectedPartner.partnerCompany?.id;
      const params: any = { sellerCompanyId: partnerId };
      if (search?.trim()) params.search = search.trim();
      const { data } = await api.get('/b2b-orders/seller-catalog', { params });
      setCatalog(data.items || []);
    } catch (e) { console.error('Catalog error:', e); }
    setCatalogLoading(false);
  }, [selectedPartner]);

  useEffect(() => {
    if (step === 'catalog' && selectedPartner) loadCatalog(searchTerm);
  }, [step, selectedPartner]);

  // Debounced search
  useEffect(() => {
    if (step !== 'catalog') return;
    const t = setTimeout(() => loadCatalog(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const selectPartner = (partner: any) => {
    setSelectedPartner(partner);
    setStep('catalog');
    setCart([]);
    setSearchTerm('');
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const exists = prev.find(c => c.productVariantId === item.variantId);
      if (exists) {
        return prev.map(c => c.productVariantId === item.variantId
          ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        productVariantId: item.variantId,
        productName: `${item.productName} - ${item.variantName}`,
        variantName: item.variantName,
        quantity: 1,
        expectedPrice: item.salePrice || 0,
        expectedCurrency: item.currency || 'UZS',
        sku: item.sku || '',
        availableQty: item.quantity || 0,
      }];
    });
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.productVariantId !== variantId) return c;
      const newQty = Math.max(0, c.quantity + delta);
      return newQty === 0 ? c : { ...c, quantity: newQty };
    }));
  };

  const removeFromCart = (variantId: string) => {
    setCart(prev => prev.filter(c => c.productVariantId !== variantId));
  };

  const getCartQty = (variantId: string) => {
    return cart.find(c => c.productVariantId === variantId)?.quantity || 0;
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * c.expectedPrice, 0);
  const cartCurrency = cart[0]?.expectedCurrency || 'UZS';

  const formatMoney = (n: number, cur: string) => {
    if (cur === 'USD') return `$${n.toLocaleString('uz-UZ')}`;
    return `${n.toLocaleString('uz-UZ')} so'm`;
  };

  const handleCreateAndSend = async (sendImmediately: boolean) => {
    if (cart.length === 0) return Alert.alert('Xatolik', 'Kamida 1 ta mahsulot tanlang');
    const partnerId = selectedPartner.partnerCompanyId || selectedPartner.partnerCompany?.id;
    setSending(true);
    try {
      const { data: order } = await api.post('/b2b-orders', {
        sellerCompanyId: partnerId,
        note: note.trim() || undefined,
        items: cart.map(c => ({
          productVariantId: c.productVariantId,
          productName: c.productName,
          quantity: c.quantity,
          expectedPrice: c.expectedPrice,
          expectedCurrency: c.expectedCurrency,
        })),
      });
      if (sendImmediately) {
        await api.post(`/b2b-orders/${order.id}/send`);
        Alert.alert('Muvaffaqiyatli', 'Buyurtma yaratildi va yuborildi!');
      } else {
        Alert.alert('Muvaffaqiyatli', 'Buyurtma qoralama sifatida saqlandi');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Xatolik', e.response?.data?.message || 'Buyurtma yaratishda xatolik');
    }
    setSending(false);
  };

  // ——— STEP 1: Partner Selection ———
  if (step === 'partner') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Yangi buyurtma</Text>
            <Text style={s.subtitle}>Sotuvchini tanlang</Text>
          </View>
        </View>
        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : partners.length === 0 ? (
          <View style={s.center}>
            <Building2 size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Hamkorlar topilmadi</Text>
            <Text style={s.emptySubtitle}>Avval CRM da hamkor qo'shing</Text>
          </View>
        ) : (
          <FlatList
            data={partners}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const partner = item.partnerCompany || {};
              return (
                <TouchableOpacity style={s.partnerCard} onPress={() => selectPartner(item)} activeOpacity={0.7}>
                  <View style={s.partnerIcon}><Building2 size={16} color={colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.partnerName}>{partner.name || 'Noma\'lum'}</Text>
                    {partner.tin && <Text style={s.partnerTin}>STIR: {partner.tin}</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ——— STEP 2: Catalog + Cart ———
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => setStep('partner')}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Mahsulot tanlash</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {selectedPartner?.partnerCompany?.name || 'Sotuvchi'}
          </Text>
        </View>
        {cart.length > 0 && (
          <View style={s.cartBadge}>
            <ShoppingCart size={16} color="#fff" />
            <Text style={s.cartBadgeText}>{cart.length}</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Search size={16} color={colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Mahsulot qidirish..." placeholderTextColor={colors.textMuted}
          value={searchTerm} onChangeText={setSearchTerm} />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}><X size={16} color={colors.textMuted} /></TouchableOpacity>
        )}
      </View>

      {/* Catalog */}
      {catalogLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={catalog}
          keyExtractor={(item) => item.variantId}
          contentContainerStyle={{ padding: 16, paddingBottom: cart.length > 0 ? 200 : 32 }}
          renderItem={({ item }) => {
            const inCart = getCartQty(item.variantId);
            return (
              <View style={s.catalogCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.catalogName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={s.catalogVariant}>{item.variantName}{item.sku ? ` · ${item.sku}` : ''}</Text>
                  <View style={s.catalogMeta}>
                    <Text style={s.catalogPrice}>{formatMoney(item.salePrice, item.currency)}</Text>
                    <Text style={s.catalogStock}>Qoldiq: {item.quantity}</Text>
                  </View>
                </View>
                {inCart > 0 ? (
                  <View style={s.qtyControls}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.variantId, -1)}>
                      <Minus size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={s.qtyText}>{inCart}</Text>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.variantId, 1)}>
                      <Plus size={14} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.removeBtn} onPress={() => removeFromCart(item.variantId)}>
                      <Trash2 size={12} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.addBtn} onPress={() => addToCart(item)}>
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Package size={40} color={colors.textMuted} />
              <Text style={s.emptyTitle}>Mahsulot topilmadi</Text>
            </View>
          }
        />
      )}

      {/* Cart Summary + Actions */}
      {cart.length > 0 && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.cartBar}>
          <View style={s.cartSummary}>
            <Text style={s.cartLabel}>{cart.length} mahsulot</Text>
            <Text style={s.cartTotal}>{formatMoney(cartTotal, cartCurrency)}</Text>
          </View>
          <TextInput style={s.noteInput} placeholder="Izoh (ixtiyoriy)..." placeholderTextColor={colors.textMuted}
            value={note} onChangeText={setNote} />
          <View style={s.cartActions}>
            <TouchableOpacity style={s.draftBtn} onPress={() => handleCreateAndSend(false)} disabled={sending}>
              <Text style={s.draftBtnText}>Saqlash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sendBtn} onPress={() => handleCreateAndSend(true)} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : (
                <><Send size={16} color="#fff" /><Text style={s.sendBtnText}>Yuborish</Text></>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: c.text },
  subtitle: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: 'bold' },
  emptySubtitle: { color: c.textSecondary, fontSize: 13, textAlign: 'center' },

  // Partner card
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
  partnerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder, justifyContent: 'center', alignItems: 'center' },
  partnerName: { color: c.text, fontSize: 14, fontWeight: 'bold' },
  partnerTin: { color: c.textMuted, fontSize: 10, marginTop: 2 },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, color: c.text, fontSize: 14 },

  // Catalog card
  catalogCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
  catalogName: { color: c.text, fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  catalogVariant: { color: c.textSecondary, fontSize: 11, marginBottom: 6 },
  catalogMeta: { flexDirection: 'row', gap: 12 },
  catalogPrice: { color: c.primary, fontSize: 13, fontWeight: 'bold' },
  catalogStock: { color: c.textMuted, fontSize: 11 },

  // Qty controls
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: c.cardSecondary, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  qtyText: { color: c.text, fontSize: 14, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  removeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },

  // Cart badge
  cartBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  cartBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Cart bar
  cartBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border, padding: 16, paddingBottom: 32 },
  cartSummary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cartLabel: { color: c.textSecondary, fontSize: 12, fontWeight: 'bold' },
  cartTotal: { color: c.primary, fontSize: 16, fontWeight: 'bold' },
  noteInput: { backgroundColor: c.cardSecondary, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 13, marginBottom: 12 },
  cartActions: { flexDirection: 'row', gap: 10 },
  draftBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: c.cardSecondary, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  draftBtnText: { color: c.text, fontSize: 14, fontWeight: 'bold' },
  sendBtn: { flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
