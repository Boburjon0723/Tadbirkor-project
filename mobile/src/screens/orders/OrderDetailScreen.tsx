import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Truck,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  Warehouse,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';
import { orderFilesService } from '../../services/order-files';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:                 { label: 'Qoralama',       bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
  SENT:                  { label: 'Yuborildi',      bg: 'rgba(59,130,246,0.1)',   text: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
  ACCEPTED:              { label: 'Qabul qilindi',  bg: 'rgba(16,185,129,0.1)',   text: '#10b981', border: 'rgba(16,185,129,0.2)' },
  IN_PROGRESS:           { label: 'Jarayonda',      bg: 'rgba(59,130,246,0.1)',   text: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
  REJECTED:              { label: 'Rad etildi',     bg: 'rgba(239,68,68,0.1)',    text: '#ef4444', border: 'rgba(239,68,68,0.2)' },
  DISPATCHED:            { label: 'Jo\'natildi',    bg: 'rgba(99,102,241,0.1)',   text: '#6366f1', border: 'rgba(99,102,241,0.2)' },
  PARTIALLY_DISPATCHED:  { label: 'Qisman jo\'nat', bg: 'rgba(245,158,11,0.1)',   text: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  RECEIVED:              { label: 'Qabul qilindi',  bg: 'rgba(16,185,129,0.1)',   text: '#10b981', border: 'rgba(16,185,129,0.2)' },
  PARTIALLY_ACCEPTED:    { label: 'Qisman qabul',   bg: 'rgba(245,158,11,0.1)',   text: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  COMPLETED:             { label: 'Yakunlandi',     bg: 'rgba(16,185,129,0.1)',   text: '#10b981', border: 'rgba(16,185,129,0.2)' },
  CANCELLED:             { label: 'Bekor qilindi',  bg: 'rgba(107,114,128,0.1)',  text: '#6b7280', border: 'rgba(107,114,128,0.2)' },
};

export default function OrderDetailScreen({ route, navigation }: any) {
  const { orderId, viewMode = 'my' } = route.params || {};
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [dispatchWarehouseId, setDispatchWarehouseId] = useState<string>('');
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchStock, setDispatchStock] = useState<any[]>([]);
  const [dispatchStockLoading, setDispatchStockLoading] = useState(false);
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});

  const fetchOrder = useCallback(async () => {
    try {
      const endpoint = viewMode === 'incoming'
        ? `/incoming-orders/${orderId}`
        : `/b2b-orders/${orderId}`;
      const { data } = await api.get(endpoint);
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order detail:', error);
      Alert.alert('Xatolik', 'Buyurtma ma\'lumotlarini yuklashda xatolik');
    }
  }, [orderId, viewMode]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchOrder();
      setLoading(false);
    };
    load();
  }, [fetchOrder]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/warehouses');
        const list = Array.isArray(data) ? data : [];
        setWarehouses(list);
        if (list.length > 0) {
          setDispatchWarehouseId(list[0].id);
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!showDispatchModal || !dispatchWarehouseId) return;
    (async () => {
      setDispatchStockLoading(true);
      try {
        const { data } = await api.get('/stock/balances', {
          params: { warehouseId: dispatchWarehouseId },
        });
        setDispatchStock(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching dispatch stock:', error);
        setDispatchStock([]);
      } finally {
        setDispatchStockLoading(false);
      }
    })();
  }, [showDispatchModal, dispatchWarehouseId]);

  useEffect(() => {
    if (!showDispatchModal || !order?.items?.length) return;
    const initial: Record<string, number> = {};
    for (const item of order.items) {
      initial[item.id] = getRemainingQty(item);
    }
    setDispatchQuantities(initial);
  }, [showDispatchModal, order?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrder();
    setRefreshing(false);
  }, [fetchOrder]);

  const formatMoney = (amount: number, currency: string) => {
    const num = Number(amount) || 0;
    if (currency === 'USD') return `$${num.toLocaleString('uz-UZ')}`;
    return `${num.toLocaleString('uz-UZ')} so'm`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // ——— ACTION HANDLERS ———

  const handleSendOrder = async () => {
    Alert.alert('Tasdiqlash', 'Buyurtmani sotuvchiga yuborasizmi?', [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Yuborish',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.post(`/b2b-orders/${orderId}/send`);
            Alert.alert('Muvaffaqiyatli', 'Buyurtma yuborildi!');
            await fetchOrder();
          } catch (e: any) {
            Alert.alert('Xatolik', e.response?.data?.message || 'Yuborishda xatolik');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleAcceptOrder = async () => {
    setActionLoading(true);
    try {
      await api.post(`/incoming-orders/${orderId}/accept`);
      Alert.alert('Muvaffaqiyatli', 'Buyurtma qabul qilindi!');
      await fetchOrder();
    } catch (e: any) {
      Alert.alert('Xatolik', e.response?.data?.message || 'Qabul qilishda xatolik');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    Alert.alert('Tasdiqlash', 'Buyurtmani rad etasizmi?', [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Rad etish',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.post(`/incoming-orders/${orderId}/reject`);
            Alert.alert('Muvaffaqiyatli', 'Buyurtma rad etildi');
            await fetchOrder();
          } catch (e: any) {
            Alert.alert('Xatolik', e.response?.data?.message || 'Rad etishda xatolik');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleCancelOrder = async () => {
    Alert.alert('Tasdiqlash', 'Buyurtmani bekor qilasizmi?', [
      { text: 'Yo\'q', style: 'cancel' },
      {
        text: 'Bekor qilish',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.post(`/b2b-orders/${orderId}/cancel`);
            Alert.alert('Bajarildi', 'Buyurtma bekor qilindi');
            await fetchOrder();
          } catch (e: any) {
            Alert.alert('Xatolik', e.response?.data?.message || 'Bekor qilishda xatolik');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteOrder = async () => {
    Alert.alert('Tasdiqlash', 'Bu qoralama buyurtmani o\'chirasizmi?', [
      { text: 'Yo\'q', style: 'cancel' },
      {
        text: 'O\'chirish',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.delete(`/b2b-orders/${orderId}`);
            Alert.alert('Bajarildi', 'Buyurtma o\'chirildi');
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Xatolik', e.response?.data?.message || 'O\'chirishda xatolik');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const getOrderedQty = (item: any) => Number(item?.orderedQuantity ?? item?.quantity ?? 0);
  const getDispatchedQty = (item: any) =>
    item?.dispatchedQuantity !== undefined && item?.dispatchedQuantity !== null
      ? Number(item.dispatchedQuantity || 0)
      : 0;
  const getRemainingQty = (item: any) => {
    if (item?.remainingToDispatch !== undefined && item?.remainingToDispatch !== null) {
      return Math.max(0, Number(item.remainingToDispatch || 0));
    }
    return Math.max(0, getOrderedQty(item) - getDispatchedQty(item));
  };

  const getVariantId = (item: any) =>
    item?.productVariantId || item?.productVariant?.id || null;

  const getStockQty = (item: any) => {
    const variantId = getVariantId(item);
    if (!variantId) return 0;
    const row = dispatchStock.find((s: any) => s.productVariantId === variantId);
    return Number(row?.quantity || 0);
  };

  const getPlannedQty = (item: any) => {
    const remaining = getRemainingQty(item);
    const planned = Number(dispatchQuantities[item.id]);
    if (!Number.isFinite(planned)) return remaining;
    if (planned < 0) return 0;
    return Math.min(planned, remaining);
  };

  const setPlannedQty = (itemId: string, nextRaw: string, max: number) => {
    const parsed = Number(nextRaw.replace(/[^\d]/g, ''));
    const safe = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0;
    setDispatchQuantities((prev) => ({ ...prev, [itemId]: safe }));
  };

  const handleOpenDispatchModal = () => {
    if (!warehouses.length) {
      Alert.alert('Xatolik', 'Jo‘natma uchun ombor topilmadi');
      return;
    }
    setShowDispatchModal(true);
  };

  const handleCreateAndSendDispatch = async () => {
    const items = (order?.items || [])
      .map((item: any) => ({
        orderItemId: item.id,
        quantity: getPlannedQty(item),
      }))
      .filter((row: any) => row.quantity > 0);

    if (!items.length) {
      Alert.alert('Maʼlumot', 'Jo‘natiladigan qolgan mahsulot yo‘q');
      return;
    }
    if (!dispatchWarehouseId) {
      Alert.alert('Xatolik', 'Omborni tanlang');
      return;
    }
    const hasInsufficientStock = (order?.items || []).some((item: any) => {
      const planned = getPlannedQty(item);
      if (planned <= 0) return false;
      return getStockQty(item) < planned;
    });
    if (hasInsufficientStock) {
      Alert.alert('Xatolik', "Zaxira yetarli emas. Jo'natib bo'lmaydi.");
      return;
    }

    setActionLoading(true);
    try {
      await api.post('/dispatches/create-and-send', {
        orderId,
        warehouseId: dispatchWarehouseId,
        items,
      });
      setShowDispatchModal(false);
      Alert.alert('Muvaffaqiyatli', "Jo'natma yaratildi va yuborildi");
      await fetchOrder();
    } catch (e: any) {
      Alert.alert('Xatolik', e.response?.data?.message || "Jo'natma yaratishda xatolik");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Yuklanmoqda...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>Buyurtma topilmadi</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontWeight: 'bold', marginTop: 12 }}>Orqaga</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT;
  const items = order.items || [];
  const displayCurrency = order.displayCurrency || items[0]?.expectedCurrency || 'UZS';
  const totalAmount = items.reduce((sum: number, item: any) =>
    sum + (Number(item.quantity) * Number(item.expectedPrice || 0)), 0);

  const displayedItems = showAllItems ? items : items.slice(0, 5);
  const hasMoreItems = items.length > 5;

  const isBuyer = viewMode === 'my';
  const canSend = isBuyer && order.status === 'DRAFT';
  const canCancel = isBuyer && ['DRAFT', 'SENT'].includes(order.status);
  const canDelete = isBuyer && order.status === 'DRAFT';
  const canAccept = !isBuyer && order.status === 'SENT';
  const canReject = !isBuyer && order.status === 'SENT';
  const hasRemainingToDispatch = (order.items || []).some((item: any) => getRemainingQty(item) > 0);
  const blockedDispatchStatuses = ['DRAFT', 'SENT', 'REJECTED', 'CANCELLED', 'COMPLETED'];
  const canDispatch =
    !isBuyer &&
    hasRemainingToDispatch &&
    !blockedDispatchStatuses.includes(order.status) &&
    (order.canDispatchMore === true ||
      ['ACCEPTED', 'IN_PROGRESS', 'PARTIALLY_DISPATCHED', 'RECEIVED', 'DISPATCHED'].includes(
        order.status,
      ));
  const dispatchPreview = (order.items || [])
    .map((item: any) => {
      const remaining = getRemainingQty(item);
      const planned = getPlannedQty(item);
      const stock = getStockQty(item);
      return {
        id: item.id,
        title: item.productNameSnapshot || 'Nomsiz',
        remaining,
        planned,
        stock,
        ok: planned === 0 || stock >= planned,
      };
    })
    .filter((row: any) => row.remaining > 0);
  const hasDispatchShortage = dispatchPreview.some((row: any) => row.planned > 0 && !row.ok);
  const shortageRows = dispatchPreview.filter((row: any) => row.planned > 0 && !row.ok);
  const remainingAfterDispatchQty = dispatchPreview.reduce(
    (sum: number, row: any) => sum + Math.max(0, row.remaining - row.planned),
    0,
  );
  const remainingAfterDispatchLines = dispatchPreview.filter(
    (row: any) => row.remaining - row.planned > 0,
  ).length;

  const handleZeroInsufficient = () => {
    setDispatchQuantities((prev) => {
      const next = { ...prev };
      for (const row of shortageRows) {
        next[row.id] = 0;
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Buyurtma detali</Text>
          <Text style={styles.orderId} numberOfLines={1}>#{order.id?.slice(0, 8)}</Text>
        </View>
        <View style={[styles.headerStatusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
          <Text style={[styles.headerStatusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        {/* Partner Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Building2 size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>{isBuyer ? 'Sotuvchi' : 'Xaridor'}</Text>
          </View>
          <View style={styles.partnerCard}>
            <Text style={styles.partnerNameLarge}>
              {(isBuyer ? order.seller : order.buyer)?.name || 'Noma\'lum'}
            </Text>
            <Text style={styles.partnerDetail}>
              STIR: {(isBuyer ? order.seller : order.buyer)?.tin || '—'}
            </Text>
            {(isBuyer ? order.seller : order.buyer)?.phone && (
              <Text style={styles.partnerDetail}>
                Tel: {(isBuyer ? order.seller : order.buyer).phone}
              </Text>
            )}
          </View>
        </View>

        {/* Order Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Calendar size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Buyurtma ma'lumotlari</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoGridItem}>
              <Text style={styles.gridLabel}>Yaratilgan sana</Text>
              <Text style={styles.gridValue}>{formatDate(order.createdAt)}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.gridLabel}>Kutilayotgan yetkazish</Text>
              <Text style={styles.gridValue}>{formatDate(order.expectedDeliveryDate)}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.gridLabel}>Jami summa</Text>
              <Text style={[styles.gridValue, { color: colors.primary }]}>
                {formatMoney(totalAmount, displayCurrency)}
              </Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.gridLabel}>Mahsulotlar soni</Text>
              <Text style={styles.gridValue}>{order.itemCount || items.length} ta</Text>
            </View>
          </View>
          {order.note && (
            <View style={styles.noteBox}>
              <MessageSquare size={14} color={colors.textSecondary} />
              <Text style={styles.noteText}>{order.note}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FileText size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Eksport</Text>
          </View>
          <View style={styles.exportRow}>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => void orderFilesService.exportOrderPdf(orderId)}
              disabled={actionLoading}
            >
              <FileText size={16} color={colors.primary} />
              <Text style={styles.exportBtnText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => void orderFilesService.exportOrderExcel(orderId)}
              disabled={actionLoading}
            >
              <FileSpreadsheet size={16} color={colors.primary} />
              <Text style={styles.exportBtnText}>Excel</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dispatch Info (if applicable) */}
        {order.hasDispatch && order.latestDispatch && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={16} color="#6366f1" />
              <Text style={styles.cardTitle}>Jo'natma ma'lumotlari</Text>
            </View>
            <View style={styles.dispatchInfoRow}>
              <Text style={styles.gridLabel}>So'nggi jo'natma</Text>
              <Text style={styles.gridValue}>#{order.latestDispatch.dispatchNumber}</Text>
            </View>
            {order.dispatchedTotalAmount > 0 && (
              <View style={styles.dispatchInfoRow}>
                <Text style={styles.gridLabel}>Jo'natilgan summa</Text>
                <Text style={[styles.gridValue, { color: '#6366f1' }]}>
                  {formatMoney(order.dispatchedTotalAmount, displayCurrency)}
                </Text>
              </View>
            )}
            {order.isPartialDispatch && (
              <View style={styles.partialBadge}>
                <Text style={styles.partialBadgeText}>Qisman jo'natma — yana qoldi</Text>
              </View>
            )}
          </View>
        )}

        {/* Items List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Mahsulotlar</Text>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{items.length} ta</Text>
            </View>
          </View>

          {displayedItems.map((item: any, idx: number) => {
            const lineTotal = Number(item.quantity) * Number(item.expectedPrice || 0);
            const currency = item.expectedCurrency || displayCurrency;
            return (
              <View key={item.id || idx} style={[styles.itemRow, idx === displayedItems.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.productNameSnapshot || 'Nomsiz'}
                  </Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemMeta}>
                      {item.quantity} × {formatMoney(item.expectedPrice || 0, currency)}
                    </Text>
                    {item.mappingStatus && item.mappingStatus !== 'MAPPED' && (
                      <View style={styles.unmappedBadge}>
                        <Text style={styles.unmappedText}>Moslanmagan</Text>
                      </View>
                    )}
                  </View>
                  {/* Dispatch quantities for dispatched orders */}
                  {item.dispatchedQuantity !== undefined && item.dispatchedQuantity > 0 && (
                    <Text style={styles.dispatchedQty}>
                      Jo'natilgan: {item.dispatchedQuantity} / {item.orderedQuantity || item.quantity}
                    </Text>
                  )}
                </View>
                <Text style={styles.itemTotal}>{formatMoney(lineTotal, currency)}</Text>
              </View>
            );
          })}

          {hasMoreItems && (
            <TouchableOpacity
              style={styles.showMoreBtn}
              onPress={() => setShowAllItems(!showAllItems)}
            >
              {showAllItems ? (
                <ChevronUp size={16} color={colors.primary} />
              ) : (
                <ChevronDown size={16} color={colors.primary} />
              )}
              <Text style={styles.showMoreText}>
                {showAllItems ? 'Kamroq ko\'rsatish' : `Yana ${items.length - 5} ta ko'rsatish`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      {(canSend || canCancel || canDelete || canAccept || canReject || canDispatch) && (
        <View style={styles.actionBar}>
          {actionLoading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <View style={styles.actionRow}>
              {canDelete && (
                <TouchableOpacity style={styles.actionBtnDanger} onPress={handleDeleteOrder}>
                  <XCircle size={16} color="#ef4444" />
                  <Text style={styles.actionTextDanger}>O'chirish</Text>
                </TouchableOpacity>
              )}
              {canCancel && (
                <TouchableOpacity style={styles.actionBtnDanger} onPress={handleCancelOrder}>
                  <XCircle size={16} color="#ef4444" />
                  <Text style={styles.actionTextDanger}>Bekor qilish</Text>
                </TouchableOpacity>
              )}
              {canSend && (
                <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleSendOrder}>
                  <Send size={16} color="#fff" />
                  <Text style={styles.actionTextPrimary}>Yuborish</Text>
                </TouchableOpacity>
              )}
              {canReject && (
                <TouchableOpacity style={styles.actionBtnDanger} onPress={handleRejectOrder}>
                  <XCircle size={16} color="#ef4444" />
                  <Text style={styles.actionTextDanger}>Rad etish</Text>
                </TouchableOpacity>
              )}
              {canAccept && (
                <TouchableOpacity style={styles.actionBtnSuccess} onPress={handleAcceptOrder}>
                  <CheckCircle2 size={16} color="#fff" />
                  <Text style={styles.actionTextPrimary}>Qabul qilish</Text>
                </TouchableOpacity>
              )}
              {canDispatch && (
                <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleOpenDispatchModal}>
                  <Truck size={16} color="#fff" />
                  <Text style={styles.actionTextPrimary}>Jo'natma yaratish</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      <Modal visible={showDispatchModal} transparent animationType="slide" onRequestClose={() => setShowDispatchModal(false)}>
        <SafeAreaView style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalTopBar}>
              <View style={styles.modalTitleWrap}>
                <Warehouse size={18} color={colors.primary} />
                <Text style={styles.modalTitle}>Jo'natma yaratish</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDispatchModal(false)} style={styles.modalCloseBtn}>
                <XCircle size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} contentContainerStyle={{ gap: 10 }}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>1. Omborni tanlang</Text>
                <View style={{ maxHeight: 150 }}>
                  {warehouses.map((item) => {
                    const active = item.id === dispatchWarehouseId;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.warehouseRow, active && styles.warehouseRowActive]}
                        onPress={() => setDispatchWarehouseId(item.id)}
                      >
                        <Text style={[styles.warehouseText, active && styles.warehouseTextActive]}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>2. Mahsulotlar holati</Text>
                <View style={styles.dispatchPreviewWrap}>
                  {dispatchStockLoading ? (
                    <View style={styles.dispatchLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : (
                    <ScrollView style={{ maxHeight: 280, minHeight: 120 }} nestedScrollEnabled>
                    {dispatchPreview.map((row: any) => (
                      <View key={row.id} style={styles.dispatchItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dispatchItemTitle} numberOfLines={2}>
                            {row.title}
                          </Text>
                          <Text style={styles.dispatchItemMeta}>
                            Qolgan: {row.remaining} · Ombor: {row.stock}
                          </Text>
                        </View>
                        <View style={styles.qtyInputWrap}>
                          <Text style={styles.qtyInputLabel}>Jo'natiladi</Text>
                          <TextInput
                            value={String(row.planned)}
                            keyboardType="number-pad"
                            onChangeText={(v) => setPlannedQty(row.id, v, row.remaining)}
                            style={styles.qtyInput}
                          />
                        </View>
                        <View
                          style={[
                            styles.stockBadge,
                            row.ok ? styles.stockBadgeOk : styles.stockBadgeBad,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stockBadgeText,
                              row.ok ? styles.stockBadgeTextOk : styles.stockBadgeTextBad,
                            ]}
                          >
                            {row.ok ? 'Yetarli' : 'Yetarli emas'}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {!dispatchPreview.length && (
                      <Text style={styles.dispatchItemMeta}>
                        Jo'natiladigan qolgan mahsulot yo'q.
                      </Text>
                    )}
                    </ScrollView>
                  )}
                </View>
              </View>

              {hasDispatchShortage && (
              <View style={styles.shortageWrap}>
                <Text style={styles.dispatchErrorText}>
                  Zaxira yetarli emas. Yetmagan qatorlarni 0 qiling.
                </Text>
                <TouchableOpacity style={styles.shortageFixBtn} onPress={handleZeroInsufficient}>
                  <Text style={styles.shortageFixBtnText}>
                    Yetmaganlarni 0 qilish ({shortageRows.length})
                  </Text>
                </TouchableOpacity>
              </View>
              )}
              {(remainingAfterDispatchQty > 0 || order?.isPartialDispatch) && (
                <Text style={styles.dispatchWarnText}>
                  Qisman jo'natma: {remainingAfterDispatchLines} ta qatorda {remainingAfterDispatchQty} dona
                  mahsulot yuborilmay qoladi.
                </Text>
              )}
            </ScrollView>

            <View style={styles.exportRow}>
              <TouchableOpacity
                style={styles.actionBtnDanger}
                onPress={() => setShowDispatchModal(false)}
                disabled={actionLoading}
              >
                <Text style={styles.actionTextDanger}>Bekor qilish</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtnPrimary,
                  (actionLoading || hasDispatchShortage || dispatchStockLoading) && styles.actionBtnDisabled,
                ]}
                onPress={handleCreateAndSendDispatch}
                disabled={actionLoading || hasDispatchShortage || dispatchStockLoading}
              >
                <Truck size={16} color="#fff" />
                <Text style={styles.actionTextPrimary}>Yaratish va yuborish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 12, fontWeight: 'bold', marginTop: 12 },
  emptyText: { color: colors.textSecondary, fontSize: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  orderId: { fontSize: 10, color: colors.textMuted, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 2 },
  headerStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  headerStatusText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Cards
  card: {
    backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: 'bold', flex: 1 },

  partnerCard: { gap: 4 },
  partnerNameLarge: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  partnerDetail: { color: colors.textSecondary, fontSize: 12 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoGridItem: {
    width: '47%',
    backgroundColor: colors.cardSecondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 12,
  },
  gridLabel: { color: colors.textMuted, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  gridValue: { color: colors.text, fontSize: 14, fontWeight: 'bold' },

  noteBox: {
    flexDirection: 'row', gap: 8, marginTop: 12,
    backgroundColor: colors.cardSecondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 12,
  },
  noteText: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 20 },

  // Dispatch
  dispatchInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  partialBadge: {
    marginTop: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start',
  },
  partialBadgeText: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold' },

  // Items
  itemCountBadge: {
    backgroundColor: colors.accentBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  itemCountText: { color: colors.primary, fontSize: 10, fontWeight: 'bold' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemName: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemMeta: { color: colors.textSecondary, fontSize: 11 },
  unmappedBadge: {
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  unmappedText: { color: '#f59e0b', fontSize: 8, fontWeight: 'bold' },
  dispatchedQty: { color: '#6366f1', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
  itemTotal: { color: colors.text, fontSize: 14, fontWeight: 'bold' },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 12, marginTop: 4,
  },
  showMoreText: { color: colors.primary, fontSize: 12, fontWeight: 'bold' },

  // Action Bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    padding: 16, paddingBottom: 32,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
  },
  actionBtnSuccess: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 14,
  },
  actionBtnDanger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  actionTextPrimary: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  actionTextDanger: { color: '#ef4444', fontSize: 14, fontWeight: 'bold' },
  exportRow: { flexDirection: 'row', gap: 10 },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  exportBtnText: { color: colors.primary, fontSize: 13, fontWeight: 'bold' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 12,
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.cardSecondary,
  },
  modalSection: {
    gap: 8,
  },
  modalBodyScroll: {
    flex: 1,
  },
  modalSectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  warehouseRow: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
    marginBottom: 8,
  },
  warehouseRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.accentBg,
  },
  warehouseText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  warehouseTextActive: { color: colors.primary },
  dispatchPreviewWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.cardSecondary,
    padding: 12,
    gap: 8,
  },
  dispatchPreviewTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  dispatchLoading: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dispatchItemTitle: { color: colors.text, fontSize: 12, fontWeight: '600' },
  dispatchItemMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  qtyInputWrap: { width: 78, alignItems: 'center', gap: 4 },
  qtyInputLabel: { color: colors.textMuted, fontSize: 9, fontWeight: 'bold' },
  qtyInput: {
    width: '100%',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: 'bold',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  stockBadgeOk: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  stockBadgeBad: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  stockBadgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  stockBadgeTextOk: { color: '#10b981' },
  stockBadgeTextBad: { color: '#ef4444' },
  dispatchErrorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  shortageWrap: {
    gap: 8,
  },
  shortageFixBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  shortageFixBtnText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dispatchWarnText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
});
