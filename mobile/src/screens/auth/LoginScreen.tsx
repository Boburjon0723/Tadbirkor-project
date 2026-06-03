import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Sparkles, User, Lock, Eye, EyeOff, MessageSquare, Phone, Fingerprint, ScanFace } from 'lucide-react-native';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

export default function LoginScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face'>('fingerprint');

  const [isLoginFocused, setIsLoginFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (compatible && enrolled) {
        setIsBiometricSupported(true);
        
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        }
        
        handleBiometricAuth(true);
      }
    })();
  }, []);

  const handleBiometricAuth = async (autoLogin: boolean = false) => {
    try {
      const savedLogin = await SecureStore.getItemAsync('saved_login');
      const savedPassword = await SecureStore.getItemAsync('saved_password');
      
      if (!savedLogin || !savedPassword) {
        if (!autoLogin) Alert.alert('Xatolik', "Saqlangan ma'lumotlar topilmadi. Iltimos, avval parol bilan kiring.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Tizimga kirish',
        fallbackLabel: 'Parol orqali kirish',
        cancelLabel: 'Bekor qilish',
      });

      if (result.success) {
        setLogin(savedLogin);
        setPassword(savedPassword);
        performLogin(savedLogin, savedPassword);
      }
    } catch (error) {
      console.log('Biometric auth error:', error);
    }
  };

  const performLogin = async (loginStr: string, passwordStr: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { login: loginStr, password: passwordStr });
      
      if (data.access_token) {
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        
        await SecureStore.setItemAsync('saved_login', loginStr);
        await SecureStore.setItemAsync('saved_password', passwordStr);
        
        const role = data.user?.role || 'FIELD_WORKER'; 
        
        if (role === 'OWNER' || role === 'MANAGER') {
          navigation.replace('OwnerMain');
        } else if (role === 'SALES') {
          navigation.replace('SalesMain');
        } else {
          navigation.replace('FieldMain');
        }
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Login yoki parol xato';
      Alert.alert('Xatolik', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (!login || !password) {
      Alert.alert('Xatolik', 'Login va parolni kiriting');
      return;
    }
    performLogin(login, password);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Decorative background glows */}
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.brandContainer}>
          <View style={styles.brandIconWrapper}>
            <Sparkles size={32} color="#3b82f6" />
          </View>
          <Text style={styles.brandName}>Axis <Text style={{ color: '#3b82f6' }}>ERP</Text></Text>
        </View>

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Tizimga kirish</Text>
            <Text style={styles.subtitle}>Boshqaruv paneli</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>LOGIN</Text>
            <View style={[
              styles.inputWrapper,
              isLoginFocused && { borderColor: '#3b82f6' }
            ]}>
              <User size={18} color={isLoginFocused ? '#3b82f6' : colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Loginni kiriting"
                placeholderTextColor={colors.textMuted}
                value={login}
                onChangeText={setLogin}
                autoCapitalize="none"
                onFocus={() => setIsLoginFocused(true)}
                onBlur={() => setIsLoginFocused(false)}
              />
            </View>

            <Text style={styles.label}>PAROL</Text>
            <View style={[
              styles.inputWrapper,
              isPasswordFocused && { borderColor: '#3b82f6' }
            ]}>
              <Lock size={18} color={isPasswordFocused ? '#3b82f6' : colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIcon}
                placeholder="Parolni kiriting"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                {showPassword ? (
                  <EyeOff color={isPasswordFocused ? '#3b82f6' : colors.textSecondary} size={18} />
                ) : (
                  <Eye color={isPasswordFocused ? '#3b82f6' : colors.textSecondary} size={18} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>KIRISH</Text>
              )}
            </TouchableOpacity>

            {isBiometricSupported && (
              <TouchableOpacity 
                style={styles.biometricButton} 
                onPress={() => handleBiometricAuth(false)}
                activeOpacity={0.8}
              >
                {biometricType === 'face' ? (
                  <ScanFace color="#3b82f6" size={24} />
                ) : (
                  <Fingerprint color="#3b82f6" size={24} />
                )}
                <Text style={styles.biometricText}>
                  {biometricType === 'face' ? 'Face ID orqali kirish' : 'Touch ID / Biometrik kirish'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.supportDividerRow}>
              <View style={styles.supportLine} />
              <Text style={styles.supportDividerText}>YORDAM KERAKMI?</Text>
              <View style={styles.supportLine} />
            </View>

            <View style={styles.supportRow}>
              <TouchableOpacity 
                style={styles.supportItem}
                onPress={() => Alert.alert('Telegram Yordam', 'Savol va takliflaringizni @tadbirkor_malumot_bot telegram manziliga yuborishingiz mumkin.')}
                activeOpacity={0.7}
              >
                <MessageSquare size={14} color="#3b82f6" />
                <Text style={styles.supportLink}>Telegram bot</Text>
              </TouchableOpacity>
              
              <View style={styles.verticalDivider} />
              
              <TouchableOpacity 
                style={styles.supportItem}
                onPress={() => Alert.alert(
                  'Call-markaz',
                  'Telefon raqami:\n+998 (95) 020-36-01\nIsh vaqti: 24/7 xizmatingizdamiz.',
                  [
                    { text: 'Yopish', style: 'cancel' },
                    { text: 'Qo\'ng\'iroq qilish', onPress: () => Linking.openURL('tel:+998950203601') }
                  ]
                )}
                activeOpacity={0.7}
              >
                <Phone size={14} color="#10b981" />
                <Text style={styles.supportLink}>Call-markaz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.footerCopyright}>© 2026 Axis ERP. Barcha huquqlar himoyalangan.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    position: 'relative',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  brandIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 5,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  form: {
    gap: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: -8,
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    height: '100%',
  },
  inputWithIcon: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    height: '100%',
  },
  eyeButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  footerCopyright: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 32,
  },
  supportDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    gap: 8,
  },
  supportLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  supportDividerText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  supportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  supportItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  verticalDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
  supportLink: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  biometricText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
