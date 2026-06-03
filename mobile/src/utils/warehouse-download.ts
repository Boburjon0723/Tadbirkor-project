import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { currentApiUrl } from '../api/client';

export async function downloadAuthenticatedFile(
  path: string,
  filename: string,
): Promise<void> {
  const token = await AsyncStorage.getItem('token');
  if (!token) {
    throw new Error('Tizimga qaytadan kiring.');
  }

  const sep = path.includes('?') ? '&' : '?';
  const url = `${currentApiUrl}${path}${sep}token=${encodeURIComponent(token)}`;

  try {
    const dest = `${FileSystem.cacheDirectory || ''}${filename}`;
    const result = await FileSystem.downloadAsync(url, dest);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        mimeType: filename.endsWith('.pdf')
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: filename,
      });
      return;
    }
  } catch {
    // fallback — brauzer orqali
  }

  await Linking.openURL(url);
}
