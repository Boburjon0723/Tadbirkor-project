import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Buffer } from 'buffer';
import { api } from '../api/client';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

async function downloadAndShare(orderId: string, format: 'pdf' | 'excel') {
  const endpoint =
    format === 'pdf' ? `/invoices/${orderId}/pdf` : `/b2b-orders/${orderId}/export/excel`;
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  const mimeType =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const response = await api.get(endpoint, { responseType: 'arraybuffer' });
  const base64 = arrayBufferToBase64(response.data as ArrayBuffer);
  const fileUri = `${FileSystem.cacheDirectory}order-${orderId.slice(0, 8)}.${ext}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: format === 'pdf' ? 'PDF ulashish' : 'Excel ulashish',
      UTI: format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
    });
    return;
  }

  Alert.alert('Saqlangan', `Fayl saqlandi: ${fileUri}`);
}

export const orderFilesService = {
  async exportOrderPdf(orderId: string) {
    try {
      await downloadAndShare(orderId, 'pdf');
    } catch (error: any) {
      Alert.alert('Xatolik', error?.response?.data?.message || 'PDF yuklab bo‘lmadi');
    }
  },
  async exportOrderExcel(orderId: string) {
    try {
      await downloadAndShare(orderId, 'excel');
    } catch (error: any) {
      Alert.alert('Xatolik', error?.response?.data?.message || 'Excel yuklab bo‘lmadi');
    }
  },
};

