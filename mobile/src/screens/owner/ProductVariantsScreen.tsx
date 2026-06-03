import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { Package, ArrowLeft } from 'lucide-react-native';
import { api } from '../../api/client';

export default function ProductVariantsScreen({ route, navigation }: any) {
  const { product } = route.params;
  const [productData, setProductData] = useState(product);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get('/stock/balances');
      const filtered = data.filter((item: any) => item.productVariant?.product?.id === product.productId);
      
      let totalQty = 0;
      filtered.forEach((item: any) => {
        totalQty += Number(item.quantity) || 0;
      });

      setProductData({
        ...productData,
        totalQuantity: totalQty,
        variants: filtered
      });
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const renderVariant = ({ item: v }: any) => {
    return (
      <View style={styles.variantRow}>
        <View style={styles.variantInfo}>
          <Text style={styles.variantName} numberOfLines={2}>
            {v.productVariant.name}
          </Text>
          <Text style={styles.variantSku}>
            {v.productVariant.sku || 'SKU yo\'q'}
          </Text>
        </View>
        <View style={styles.variantRight}>
          <Text style={styles.variantQty}>{v.quantity} ta</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {productData.productName}
        </Text>
      </View>

      <View style={styles.productInfo}>
        <View style={styles.imageContainer}>
          {productData.productImage ? (
            <Image source={{ uri: productData.productImage }} style={styles.image} />
          ) : (
            <Package size={64} color="#333" />
          )}
        </View>
        <View style={styles.stats}>
          <Text style={styles.statsLabel}>Jami qoldiq</Text>
          <Text style={styles.statsValue}>{productData.totalQuantity} ta</Text>
          <Text style={styles.statsSub}>
            {productData.variants.length} xil variant
          </Text>
        </View>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Variantlar ro'yxati</Text>
        <FlatList
          data={productData.variants}
          keyExtractor={(item) => item.id}
          renderItem={renderVariant}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48, 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#222' 
  },
  backBtn: {
    marginRight: 16,
    padding: 4,
  },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#fff' },
  productInfo: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    alignItems: 'center',
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
  stats: {
    flex: 1,
    marginLeft: 16,
  },
  statsLabel: { color: '#666', fontSize: 14, marginBottom: 4 },
  statsValue: { color: '#10b981', fontSize: 32, fontWeight: 'bold' },
  statsSub: { color: '#888', fontSize: 14, marginTop: 4 },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  variantInfo: {
    flex: 1,
    marginRight: 16,
  },
  variantName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  variantSku: {
    color: '#666',
    fontSize: 12,
  },
  variantRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  variantQty: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
