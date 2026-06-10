import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, TextInput, Modal, DeviceEventEmitter } from 'react-native';
import { ArrowLeft, Trash2, Minus, Plus, Banknote, CreditCard, QrCode, Search, UserPlus } from 'lucide-react-native';
import { api, fixImageUrl } from '../../api/client';
import { usePosCreditAccess } from '../../hooks/usePosCreditAccess';
import { calcPosCartTotal, roundMoney } from '../../lib/money';

export default function POSCartScreen({ route, navigation }: any) {
  const posCredit = usePosCreditAccess();
  // We receive the cart and warehouse ID from POSScreen
  const { cart: initialCart, warehouseId, customer: initialCustomer } = route.params || { cart: [] };
  
  const [cart, setCart] = useState<any[]>(initialCart);

  useEffect(() => {
    if (!initialCustomer) return;
    if (initialCustomer.retailCustomerId) {
      setSelectedCreditCustomer({
        id: initialCustomer.retailCustomerId,
        name: initialCustomer.customerName,
        phone: initialCustomer.customerPhone,
      });
    } else if (initialCustomer.customerName?.trim()) {
      setCreditCustomerName(initialCustomer.customerName.trim());
      if (initialCustomer.customerPhone?.trim()) {
        setCreditCustomerPhone(initialCustomer.customerPhone.trim());
      }
    }
  }, [initialCustomer]);

  // Sync back to POSScreen whenever cart changes
  useEffect(() => {
    DeviceEventEmitter.emit('cart_updated', cart);
  }, [cart]);

  // State for Payment Modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'select' | 'qr' | 'credit'>('select');
  const [creditSearchTerm, setCreditSearchTerm] = useState('');
  const [creditSearchResults, setCreditSearchResults] = useState<any[]>([]);
  const [creditSearchLoading, setCreditSearchLoading] = useState(false);
  const [creditSearchTouched, setCreditSearchTouched] = useState(false);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<any>(null);
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('');

  useEffect(() => {
    if (!paymentModalVisible || paymentStep !== 'credit') return;
    const term = creditSearchTerm.trim();
    if (term.length < 2) {
      setCreditSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setCreditSearchLoading(true);
        setCreditSearchTouched(true);
        const { data } = await api.get(`/retail-customers/search?q=${encodeURIComponent(term)}`);
        setCreditSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setCreditSearchResults([]);
      } finally {
        setCreditSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [creditSearchTerm, paymentModalVisible, paymentStep]);

  // Helper function to format price with correct currency
  const formatPrice = (price: number, currency: string) => {
    const num = Number(price) || 0;
    if (currency === 'USD') {
      return `$${num.toLocaleString()}`;
    }
    return `${num.toLocaleString()} so'm`;
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const currentQty = Number(item.qty) || 0;
          const newQty = currentQty + delta;
          if (newQty <= 0) return null; 
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(Boolean) as any[];
    });
  };

  const handleManualQtyChange = (productId: string, text: string) => {
    // Vergulni nuqtaga almashtiramiz
    const sanitizedText = text.replace(',', '.');
    
    if (sanitizedText === '') {
      setCart(prev => prev.map(item => item.product.id === productId ? { ...item, qty: '' } : item));
      return;
    }
    
    const newQty = parseFloat(sanitizedText);
    if (isNaN(newQty)) return;

    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        // We temporarily store the raw string so they can type "1." before "1.5"
        // But the value evaluated is newQty
        return { ...item, qty: sanitizedText };
      }
      return item;
    }));
  };

  const handleQtyBlur = (productId: string) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          if (item.qty === '' || item.qty <= 0) return null;
        }
        return item;
      }).filter(Boolean) as any[];
    });
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Calculate totals by currency
  const totalsByCurrency = cart.reduce((acc, item) => {
    const variant = item.product.variants?.[0] || {};
    const price = Number(variant.salePrice || 0);
    const currency = variant.currency || 'UZS';
    const qty = Number(item.qty) || 0;
    
    if (!acc[currency]) acc[currency] = 0;
    acc[currency] = roundMoney(acc[currency] + roundMoney(price * qty));
    return acc;
  }, {} as Record<string, number>);

  const openCreditStep = () => {
    if (!posCredit.enabled) {
      const msg = !posCredit.companyEnabled
        ? 'Nasiya sotuv kompaniyada o‘chirilgan. Egasi webda Sozlamalar → Kompaniya orqali yoqishi mumkin.'
        : 'Nasiya sotuv uchun sizda ruxsat yo‘q. Menejer Jamoa bo‘limida «Nasiya (qarz) sotuv»ni yoqishi kerak.';
      Alert.alert('Nasiya mavjud emas', msg);
      return;
    }
    setPaymentStep('credit');
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    // Ombordagi qoldiqdan oshib ketgan mahsulotlarni topamiz
    const invalidItems = cart.filter(item => {
      const maxStock = Number(item.product.quantity ?? item.product.productVariant?.quantity ?? 0);
      const currentQty = Number(item.qty) || 0;
      return currentQty > maxStock;
    });

    if (invalidItems.length > 0) {
      Alert.alert(
        'Sotib bo\'lmaydi', 
        `Savatdagi ba'zi mahsulotlar miqdori ombordagi qoldiqdan ko'p (Qizil bilan belgilangan). Ularning miqdorini kamaytiring.`
      );
      return;
    }

    setPaymentStep('select');
    setPaymentModalVisible(true);
  };

  const completeSale = async (method: 'CASH' | 'CARD' | 'CREDIT') => {
    try {
      // API call to create sale
      const items = cart.map(item => ({
        productVariantId: item.product.variants?.[0]?.id || item.product.id,
        quantity: Number(item.qty),
        unitPrice: Number(item.product.variants?.[0]?.salePrice || 0)
      }));

      const totalAmount = calcPosCartTotal(
        cart.map((item) => ({
          price: Number(item.product.variants?.[0]?.salePrice || 0),
          quantity: Number(item.qty),
        })),
      );

      if (method === 'CREDIT') {
        const name = creditCustomerName.trim();
        const phone = creditCustomerPhone.trim();
        const phoneDigits = phone.replace(/\D/g, '');

        if (!creditSearchTouched || creditSearchTerm.trim().length < 2) {
          Alert.alert('Diqqat', 'Nasiya uchun avval mijozni qidirish majburiy.');
          return;
        }

        if (!selectedCreditCustomer && (!name || !phone)) {
          Alert.alert('Diqqat', 'Nasiya uchun mijoz ismi va telefon raqami majburiy.');
          return;
        }

        if (!selectedCreditCustomer && phoneDigits.length < 9) {
          Alert.alert('Diqqat', 'Telefon raqami noto‘g‘ri kiritildi.');
          return;
        }
      }

      await api.post('/pos/sales/quick-checkout', {
        warehouseId,
        items,
        method,
        cashReceived: method === 'CASH' ? totalAmount : 0,
        retailCustomerId: method === 'CREDIT' ? selectedCreditCustomer?.id : undefined,
        customerName: method === 'CREDIT' && !selectedCreditCustomer ? creditCustomerName.trim() : undefined,
        customerPhone: method === 'CREDIT' && !selectedCreditCustomer ? creditCustomerPhone.trim() : undefined,
      });

      setPaymentModalVisible(false);
      setPaymentStep('select');
      setCreditSearchTerm('');
      setCreditSearchResults([]);
      setCreditSearchTouched(false);
      setSelectedCreditCustomer(null);
      setCreditCustomerName('');
      setCreditCustomerPhone('');
      Alert.alert(
        'Muvaffaqiyatli',
        method === 'CREDIT'
          ? 'Savdo nasiya (qarz) tarzida yakunlandi.'
          : `Savdo ${method === 'CASH' ? 'Naqd pul' : 'Karta/QR'} orqali yakunlandi!`,
      );
      
      const soldItems = items.map((row) => ({
        productVariantId: row.productVariantId,
        quantity: row.quantity,
      }));

      DeviceEventEmitter.emit('cart_cleared', { soldItems, warehouseId });
      navigation.goBack();

    } catch (error: any) {
      console.error('Sale error:', error.response?.data || error);
      Alert.alert('Xatolik', 'Savdoni yakunlashda xatolik yuz berdi');
      setPaymentModalVisible(false);
    }
  };

  const renderCartItem = ({ item }: any) => {
    // item.product is the payload passed from POSScreen (which is the stock balance item augmented with product and variants)
    const payload = item.product; 
    const actualProduct = payload.product || {};
    const variant = payload.variants?.[0] || payload.productVariant || {};
    
    const pName = actualProduct.name || '';
    const vName = variant.name || '';
    const displayName = `${pName} ${vName}`.trim() || 'Nomsiz mahsulot';
    
    const price = variant.salePrice || 0;
    const currency = variant.currency || 'UZS';
    const imageUrl = fixImageUrl(actualProduct.imageUrl || variant.imageUrl);

    const maxStock = Number(payload.quantity || 0);
    const currentQty = Number(item.qty) || 0;
    // Ombordagidan ko'p kiritilsa Qizil, bo'lmasa Yashil
    const qtyColor = currentQty > maxStock ? '#ef4444' : '#22c55e';

    return (
      <View style={styles.cartItem}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={[styles.itemImage, styles.itemImagePlaceholder]} />
        )}
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{displayName}</Text>
          <Text style={styles.itemPrice}>{formatPrice(price, currency)} x {item.qty}</Text>
        </View>
        
        <View style={styles.actions}>
          <View style={styles.qtyControls}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(payload.id, -1)}>
              <Minus size={16} color="#64748b" />
            </TouchableOpacity>
            <TextInput
              style={[styles.qtyInput, { color: qtyColor, borderColor: qtyColor }]}
              keyboardType="decimal-pad"
              value={String(item.qty)}
              onChangeText={(text) => handleManualQtyChange(payload.id, text)}
              onBlur={() => handleQtyBlur(payload.id)}
              selectTextOnFocus
            />
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(payload.id, 1)}>
              <Plus size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(payload.id)}>
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>Savatcha</Text>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Savatcha bo'sh</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={item => item.product.id}
            renderItem={renderCartItem}
            contentContainerStyle={styles.listContainer}
          />
          
          <View style={styles.footer}>
            <Text style={styles.summaryTitle}>Jami hisob:</Text>
            {Object.entries(totalsByCurrency).map(([currency, total]) => (
              <View key={currency} style={styles.summaryRow}>
                <Text style={styles.summaryCurrency}>{currency}:</Text>
                <Text style={styles.summaryTotal}>{formatPrice(total as number, currency)}</Text>
              </View>
            ))}
            
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
              <Text style={styles.checkoutBtnText}>Savdoni tasdiqlash</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            {paymentStep === 'select' ? (
              <>
                <Text style={styles.modalTitle}>To'lov usulini tanlang</Text>
                <View style={styles.paymentMethods}>
                  <TouchableOpacity style={styles.paymentBtn} onPress={() => completeSale('CASH')}>
                    <Banknote size={40} color="#10b981" />
                    <Text style={styles.paymentText}>Naqd pul</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.paymentBtn} onPress={() => setPaymentStep('qr')}>
                    <CreditCard size={40} color="#3b82f6" />
                    <Text style={styles.paymentText}>Karta / QR</Text>
                  </TouchableOpacity>
                  {posCredit.enabled ? (
                    <TouchableOpacity style={styles.paymentBtn} onPress={openCreditStep}>
                      <UserPlus size={40} color="#f59e0b" />
                      <Text style={styles.paymentText}>Nasiya</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Bekor qilish</Text>
                </TouchableOpacity>
              </>
            ) : paymentStep === 'credit' ? (
              <View style={styles.qrContainer}>
                <Text style={styles.modalTitle}>Nasiya rasmiylashtirish</Text>
                <Text style={styles.creditHint}>Mijozni qidiring. Topilmasa ism va telefonni kiriting.</Text>

                <View style={styles.searchBox}>
                  <Search size={16} color="#94a3b8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Mijoz ismi yoki telefon..."
                    placeholderTextColor="#94a3b8"
                    value={creditSearchTerm}
                    onChangeText={(v) => {
                      setCreditSearchTerm(v);
                      if (selectedCreditCustomer) setSelectedCreditCustomer(null);
                    }}
                  />
                </View>

                {creditSearchLoading ? (
                  <Text style={styles.qrWaitText}>Qidirilmoqda...</Text>
                ) : creditSearchTerm.trim().length >= 2 && creditSearchResults.length > 0 ? (
                  <View style={styles.customerList}>
                    {creditSearchResults.slice(0, 4).map((c: any) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.customerRow,
                          selectedCreditCustomer?.id === c.id && styles.customerRowActive,
                        ]}
                        onPress={() => {
                          setSelectedCreditCustomer(c);
                          setCreditCustomerName(c.name || '');
                          setCreditCustomerPhone(c.phone || '');
                        }}
                      >
                        <Text style={styles.customerName} numberOfLines={1}>{c.name}</Text>
                        <Text style={styles.customerPhone}>{c.phone || 'Telefon yo‘q'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <TextInput
                  style={styles.creditInput}
                  placeholder="Mijoz ismi (majburiy)"
                  placeholderTextColor="#94a3b8"
                  value={creditCustomerName}
                  onChangeText={setCreditCustomerName}
                />
                <TextInput
                  style={styles.creditInput}
                  placeholder="Telefon raqami (majburiy)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={creditCustomerPhone}
                  onChangeText={setCreditCustomerPhone}
                />

                <TouchableOpacity style={[styles.checkoutBtn, { width: '100%' }]} onPress={() => completeSale('CREDIT')}>
                  <Text style={styles.checkoutBtnText}>Nasiyani tasdiqlash</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentStep('select')}>
                  <Text style={styles.cancelBtnText}>Orqaga</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.qrContainer}>
                <Text style={styles.modalTitle}>QR orqali to'lov</Text>
                <View style={styles.qrPlaceholder}>
                  <QrCode size={120} color="#94a3b8" />
                </View>
                <Text style={styles.qrWaitText}>Mijoz tomonidan to'lov tasdiqlanishi kutilmoqda...</Text>
                
                <TouchableOpacity style={[styles.checkoutBtn, { width: '100%' }]} onPress={() => completeSale('CARD')}>
                  <Text style={styles.checkoutBtnText}>To'lov o'tdi (Tasdiqlash)</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentStep('select')}>
                  <Text style={styles.cancelBtnText}>Orqaga</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48, 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff'
  },
  backBtn: { marginRight: 16, padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 18 },
  listContainer: { padding: 16 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemImagePlaceholder: {
    backgroundColor: '#f1f5f9',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemPrice: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 60,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyBtn: {
    padding: 8,
  },
  qtyInput: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 4,
    minWidth: 40,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  removeBtn: {
    padding: 4,
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 24,
    paddingBottom: 40,
  },
  summaryTitle: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryCurrency: {
    color: '#94a3b8',
    fontSize: 16,
  },
  summaryTotal: {
    color: '#3b82f6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  checkoutBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Modal Styles
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 24,
    textAlign: 'center',
  },
  paymentMethods: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  paymentBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    marginBottom: 24,
  },
  qrWaitText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  creditHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  searchBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#1e293b',
    fontSize: 14,
  },
  customerList: {
    width: '100%',
    marginBottom: 10,
  },
  customerRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  customerRowActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  customerName: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 13,
  },
  customerPhone: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 11,
  },
  creditInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    color: '#1e293b',
    fontSize: 14,
    backgroundColor: '#f8fafc',
  },
});
