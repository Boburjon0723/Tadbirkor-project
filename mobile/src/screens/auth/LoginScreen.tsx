import React, { useState } from 'react';
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
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Lock, Eye, EyeOff, MessageSquare, Phone } from 'lucide-react-native';
import { authApi } from '../../services/auth.service';
import { useTheme } from '../../theme';
import { AuthThemeToggle } from '../../components/auth/AuthThemeToggle';
import { AuthBrandHeader } from '../../components/auth/AuthBrandHeader';
import { loginFieldAutofill, passwordFieldAutofill } from '../../lib/auth-autofill';
import { TELEGRAM_BOT_MENTION, TELEGRAM_BOT_URL } from '../../constants/telegram';

export default function LoginScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotHint, setForgotHint] = useState<string | null>(null);

  const [isLoginFocused, setIsLoginFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const performLogin = async (loginStr: string, passwordStr: string) => {
    setLoading(true);
    try {
      const data = await authApi.login(loginStr, passwordStr);
      
      if (data.access_token) {
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        
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
      const msg = error.response?.data?.message || 'Login, telefon yoki parol xato';
      Alert.alert('Xatolik', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (!login.trim() || !password) {
      Alert.alert('Xatolik', 'Login/telefon va parolni kiriting');
      return;
    }
    setForgotHint(null);
    performLogin(login.trim(), password);
  };

  const handleForgotPassword = async () => {
    setForgotLoading(true);
    setForgotHint(null);
    try {
      const loginValue = login.trim();
      const { botUrl, instructions } = await authApi.getPasswordResetTelegramLink(
        loginValue || undefined,
      );
      const canOpen = await Linking.canOpenURL(botUrl);
      if (canOpen) {
        await Linking.openURL(botUrl);
      }
      setForgotHint(
        instructions ||
          'Telegram bot ochildi. «Telefon raqamni ulashish» tugmasini bosing va yangi parol kiriting.',
      );
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Telegram havolasini yaratib bo‘lmadi. Keyinroq urinib ko‘ring.';
      Alert.alert('Xatolik', msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <KeyboardAvoidingView 
      style={styles.flex} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        <View style={styles.topHeader}>
          <AuthBrandHeader compact />
          <AuthThemeToggle />
        </View>

        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Tizimga kirish</Text>
            <Text style={styles.subtitle}>Boshqaruv paneli</Text>
            <Text style={styles.autofillHint}>
              Birinchi kirishdan keyin telefon login va parolni saqlashni taklif qiladi — keyingi safar Face ID bilan avtomatik to‘ldiriladi.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>LOGIN YOKI TELEFON</Text>
            <View style={[
              styles.inputWrapper,
              isLoginFocused && { borderColor: '#3b82f6' }
            ]}>
              <User size={18} color={isLoginFocused ? '#3b82f6' : colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Login yoki +998901234567"
                placeholderTextColor={colors.textMuted}
                value={login}
                onChangeText={setLogin}
                autoCapitalize="none"
                keyboardType="default"
                onFocus={() => setIsLoginFocused(true)}
                onBlur={() => setIsLoginFocused(false)}
                returnKeyType="next"
                {...loginFieldAutofill}
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
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                {...passwordFieldAutofill}
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
              onPress={handleForgotPassword}
              disabled={forgotLoading}
              style={styles.forgotLinkWrap}
              activeOpacity={0.7}
            >
              {forgotLoading ? (
                <ActivityIndicator color="#3b82f6" size="small" />
              ) : (
                <Text style={styles.forgotLink}>Parolni unutdingizmi? — Telegram orqali tiklash</Text>
              )}
            </TouchableOpacity>

            {forgotHint ? (
              <Text style={styles.forgotHint}>{forgotHint}</Text>
            ) : null}

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

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={{ marginTop: 16, alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: '600' }}>
                Akkauntingiz yo'qmi? Ro'yxatdan o'tish
              </Text>
            </TouchableOpacity>

            <View style={styles.supportDividerRow}>
              <View style={styles.supportLine} />
              <Text style={styles.supportDividerText}>YORDAM KERAKMI?</Text>
              <View style={styles.supportLine} />
            </View>

            <View style={styles.supportRow}>
              <TouchableOpacity 
                style={styles.supportItem}
                onPress={() => Linking.openURL(TELEGRAM_BOT_URL)}
                activeOpacity={0.7}
              >
                <MessageSquare size={14} color="#3b82f6" />
                <Text style={styles.supportLink}>{TELEGRAM_BOT_MENTION}</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    position: 'relative',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
    zIndex: 10,
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.1)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.07)',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginTop: 52,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  autofillHint: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  form: {
    gap: 12,
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
  forgotLinkWrap: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingVertical: 4,
  },
  forgotLink: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  forgotHint: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
    marginTop: 20,
  },
  supportDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
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
});
