import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

export default function MyStockScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStock = useCallback(async () => {
    try {
      const { data } = await api.get('/field/me/stock');
      setStock(Array.isArray(data) ? data : (data?.items || []));
    } catch (e) {
      console.error('Error fetching field stock', e);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await fetchStock();
    setLoading(false);
  }, [fetchStock]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStock();
    setRefreshing(false);
  }, [fetchStock]);

  const renderItem = ({ item }: any) => {
    // API returns stock balances similar to warehouse balances
    const variant = item.productVariant || {};
    const product = variant.product || {};
    const name = `${product.name || 'Noma\'lum'} ${variant.name || ''}`.trim();
    const unit = product.unit || 'dona';
    const quantity = item.quantity || 0;

    return (
      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          <Box size={24} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
        <View style={styles.quantityWrapper}>
          <Text style={styles.quantity}>{quantity}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mening Omborim</Text>
        <Text style={styles.headerSubtitle}>Joriy qoldiqlar (Avtomobilda)</Text>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : stock.length === 0 ? (
        <View style={styles.center}>
          <Box size={48} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>Omborda mahsulot yo'q</Text>
        </View>
      ) : (
        <FlatList
          data={stock}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: c.text },
  headerSubtitle: { fontSize: 13, color: c.textSecondary, marginTop: 4 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  iconWrapper: { width: 48, height: 48, borderRadius: 12, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  info: { flex: 1 },
  name: { color: c.text, fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  unit: { color: c.textSecondary, fontSize: 11 },
  quantityWrapper: { alignItems: 'flex-end' },
  quantity: { color: c.primary, fontSize: 18, fontWeight: 'bold' }
});
