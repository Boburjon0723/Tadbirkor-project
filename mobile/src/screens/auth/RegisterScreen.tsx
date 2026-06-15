import React, { useState, useEffect, useRef } from 'react';
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
import {
  Building2,
  User,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ChevronLeft,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { authApi } from '../../services/auth.service';
import { TELEGRAM_BOT_MENTION } from '../../constants/telegram';
import { loginFieldAutofill, newPasswordFieldAutofill } from '../../lib/auth-autofill';
import { AuthThemeToggle } from '../../components/auth/AuthThemeToggle';
import { AuthBrandHeader } from '../../components/auth/AuthBrandHeader';

type Step = 'form' | 'telegram' | 'otp';

export default function RegisterScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+998');

  const [sessionToken, setSessionToken] = useState('');
  const [botUrl, setBotUrl] = useState('');
  const [otpDelivered, setOtpDelivered] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (token: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await authApi.registerStatus(token);
        if (status.otpDelivered) {
          setOtpDelivered(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // ignore transient errors while polling
      }
    }, 2500);
  };

  const handleStartRegistration = async () => {
    if (!companyName.trim() || !fullName.trim() || !login.trim() || !password.trim() || !phone.trim()) {
      Alert.alert('Xatolik', 'Barcha majburiy maydonlarni to\'ldiring');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Xatolik', 'Parol kamida 6 belgidan iborat bo\'lishi kerak');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.registerStart({
        companyName: companyName.trim(),
        fullName: fullName.trim(),
        login: login.trim(),
        password,
        phone: phone.trim(),
      });
      setSessionToken(res.sessionToken);
      setBotUrl(res.botUrl);
      setOtpDelivered(false);
      setStep('telegram');
      startPolling(res.sessionToken);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || 'Ro\'yxatdan o\'tishni boshlab bo\'lmadi';
      Alert.alert('Xatolik', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTelegram = async () => {
    if (!botUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(botUrl);
      if (canOpen) {
        await Linking.openURL(botUrl);
      } else {
        Alert.alert('Xatolik', 'Telegram ochib bo\'lmadi');
      }
    } catch {
      Alert.alert('Xatolik', 'Telegram ochib bo\'lmadi');
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) next[index + i] = d;
      });
      setOtp(next);
      const focusIdx = Math.min(index + digits.length, 5);
      otpRefs.current[focusIdx]?.focus();
      return;
    }
    if (value && !/^\d$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleCompleteRegistration = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      Alert.alert('Xatolik', '6 xonali tasdiqlash kodini kiriting');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.registerComplete(sessionToken, code);
      if (data.access_token) {
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        navigation.replace('OwnerMain');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || 'Tasdiqlash muvaffaqiyatsiz';
      Alert.alert('Xatolik', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderFormStep = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Ro'yxatdan o'tish</Text>
        <Text style={styles.subtitle}>7 kunlik bepul sinov — Telegram orqali tasdiqlash</Text>
        <Text style={styles.stepNote}>
          Formada o‘zingiz parol o‘ylab topasiz. Bot esa faqat 6 xonali tasdiqlash kodini yuboradi.
        </Text>
      </View>

      <Field label="KOMPANIYA NOMI" icon={<Building2 size={18} color={colors.textSecondary} />}>
        <TextInput
          style={styles.input}
          placeholder="Masalan: OOO Samarqand Trade"
          placeholderTextColor={colors.textMuted}
          value={companyName}
          onChangeText={setCompanyName}
        />
      </Field>

      <Field label="TO'LIQ ISM" icon={<User size={18} color={colors.textSecondary} />}>
        <TextInput
          style={styles.input}
          placeholder="Ism familiyangiz"
          placeholderTextColor={colors.textMuted}
          value={fullName}
          onChangeText={setFullName}
        />
      </Field>

      <Field label="TELEFON" icon={<Phone size={18} color={colors.textSecondary} />}>
        <TextInput
          style={styles.input}
          placeholder="+998901234567"
          placeholderTextColor={colors.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </Field>

      <Field label="LOGIN" icon={<User size={18} color={colors.textSecondary} />}>
        <TextInput
          style={styles.input}
          placeholder="Login"
          placeholderTextColor={colors.textMuted}
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          {...loginFieldAutofill}
        />
      </Field>

      <Field label="PAROL" icon={<Lock size={18} color={colors.textSecondary} />}>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Kamida 6 belgi"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            {...newPasswordFieldAutofill}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            {showPassword ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>
      </Field>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleStartRegistration}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>DAVOM ETISH</Text>}
      </TouchableOpacity>
    </>
  );

  const renderTelegramStep = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Telegram tasdiqlash</Text>
        <Text style={styles.subtitle}>
          {TELEGRAM_BOT_MENTION} botini oching va telefon raqamingizni ulashing. 6 xonali tasdiqlash kodi shu chatga keladi (bu sizning kirish parolingiz emas).
        </Text>
      </View>

      <View style={styles.infoBox}>
        <MessageSquare size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          {otpDelivered
            ? '✅ Kod yuborildi! Keyingi bosqichda kodni kiriting.'
            : 'Telegram botda «Telefon raqamni ulashish» tugmasini bosing.'}
        </Text>
      </View>

      <TouchableOpacity style={styles.telegramButton} onPress={handleOpenTelegram}>
        <MessageSquare size={20} color="#fff" />
        <Text style={styles.telegramButtonText}>TELEGRAM BOTNI OCHISH</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !otpDelivered && styles.buttonOutline]}
        onPress={() => setStep('otp')}
        disabled={!otpDelivered}
      >
        <Text style={[styles.buttonText, !otpDelivered && styles.buttonOutlineText]}>
          {otpDelivered ? 'KODNI KIRITISH' : 'Kod kutilmoqda...'}
        </Text>
      </TouchableOpacity>

      {!otpDelivered && (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 16 }} />
      )}
    </>
  );

  const renderOtpStep = () => (
    <>
      <View style={styles.header}>
        <ShieldCheck size={32} color="#3b82f6" style={{ marginBottom: 8 }} />
        <Text style={styles.title}>Tasdiqlash kodi</Text>
        <Text style={styles.subtitle}>Telegram botdan kelgan 6 xonali kodni kiriting</Text>
      </View>

      <View style={styles.otpRow}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { otpRefs.current[index] = ref; }}
            style={styles.otpInput}
            value={digit}
            onChangeText={(v) => handleOtpChange(v, index)}
            keyboardType="number-pad"
            maxLength={6}
            selectTextOnFocus
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleCompleteRegistration}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>RO'YXATDAN O'TISH</Text>}
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => {
            if (step === 'otp') setStep('telegram');
            else if (step === 'telegram') setStep('form');
            else navigation.goBack();
          }}>
            <ChevronLeft size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Orqaga</Text>
          </TouchableOpacity>
          <AuthThemeToggle />
        </View>

        <View style={styles.brandRow}>
          <AuthBrandHeader compact />
        </View>

        <View style={styles.card}>
          {step === 'form' && renderFormStep()}
          {step === 'telegram' && renderTelegramStep()}
          {step === 'otp' && renderOtpStep()}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLinkWrap}>
          <Text style={styles.loginLink}>Akkauntingiz bormi? Kirish</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <View style={styles.inputIcon}>{icon}</View>
        {children}
      </View>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1,
    borderColor: colors.border, padding: 18, gap: 12,
    marginTop: 44,
  },
  header: { marginBottom: 8, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, textAlign: 'center' },
  stepNote: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    textAlign: 'center',
  },
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginLeft: 4 },
  inputWrapper: {
    backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14 },
  passwordRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  eyeButton: { padding: 8 },
  button: {
    backgroundColor: '#3b82f6', height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonOutlineText: { color: colors.textSecondary },
  telegramButton: {
    backgroundColor: '#0088cc', height: 52, borderRadius: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  telegramButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: colors.cardSecondary, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  infoText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginVertical: 8 },
  otpInput: {
    flex: 1, height: 56, backgroundColor: colors.cardSecondary,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: colors.text,
  },
  loginLinkWrap: { marginTop: 24, alignItems: 'center' },
  loginLink: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
});
