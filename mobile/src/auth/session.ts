import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export async function clearAuthSession() {
  await AsyncStorage.multiRemove(['token', 'user']);
}

export function confirmLogout(navigation: any) {
  Alert.alert('Chiqish', 'Tizimdan chiqmoqchimisiz?', [
    { text: 'Bekor qilish', style: 'cancel' },
    {
      text: 'Chiqish',
      style: 'destructive',
      onPress: async () => {
        await clearAuthSession();
        navigation.replace('Login');
      },
    },
  ]);
}

