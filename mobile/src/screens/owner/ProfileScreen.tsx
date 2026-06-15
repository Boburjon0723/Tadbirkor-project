import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Phone, Mail, Shield, KeyRound, CheckCircle2, AlertCircle, Building2, Send } from 'lucide-react-native';
import { TELEGRAM_BOT_MENTION } from '../../constants/telegram';
import { api } from '../../api/client';
import { useTheme } from '../../theme';

export default function ProfileScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const cachedUser = await AsyncStorage.getItem('user');
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser);
        setUser(parsed);
      }
    } catch (e) {
      console.error('Failed to load user credentials:', e);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Xatolik', 'Barcha parol maydonlarini to\'ldiring');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Xatolik', 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi shart');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Xatolik', 'Yangi parollar bir-biriga mos kelmadi');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword,
        newPassword
      });
      
      Alert.alert('Muvaffaqiyatli', 'Parolingiz muvaffaqiyatli yangilandi!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Joriy parol noto\'g\'ri kiritildi';
      Alert.alert('Xatolik', msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bg }, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Generate Initials
  const getInitials = (name: string) => {
    if (!name) return 'O';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Mening profilim</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar and Profile Header Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarGradient}>
                <Text style={styles.avatarText}>{getInitials(user.fullName)}</Text>
              </View>
              <View style={styles.onlineBadge} />
            </View>

            <Text style={styles.fullName}>{user.fullName}</Text>
            <Text style={styles.username}>@{user.login}</Text>

            <View style={styles.roleContainer}>
              <Shield size={14} color="#3b82f6" />
              <Text style={styles.roleText}>{user.role || 'OWNER'}</Text>
            </View>
          </View>

          {/* Details Section */}
          <Text style={styles.sectionTitle}>Shaxsiy ma'lumotlar</Text>
          <View style={styles.infoGroup}>
            <View style={styles.infoRow}>
              <View style={styles.iconWrapper}>
                <Phone size={18} color="#94a3b8" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Telefon raqam</Text>
                <Text style={styles.infoValue}>{user.phone || 'Kiritilmagan'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconWrapper}>
                <Mail size={18} color="#94a3b8" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Elektron pochta</Text>
                <Text style={styles.infoValue}>{user.email || 'Kiritilmagan'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconWrapper}>
                <Building2 size={18} color="#94a3b8" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Kompaniya</Text>
                <Text style={styles.infoValue}>{user.companies?.[0]?.company?.name || 'Tadbirkor ERP'}</Text>
              </View>
            </View>
          </View>

          {/* Telegram bot link status */}
          <Text style={styles.sectionTitle}>Telegram Bot Integratsiyasi</Text>
          <View style={styles.telegramBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Send size={24} color="#38bdf8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.telegramTitle}>Telegram xabarnomalar</Text>
                {user.telegramChatId ? (
                  <View style={styles.statusBadgeLinked}>
                    <CheckCircle2 size={12} color="#4ade80" />
                    <Text style={styles.statusTextLinked}>Ulanish faol (ID: {user.telegramChatId})</Text>
                  </View>
                ) : (
                  <View style={styles.statusBadgeUnlinked}>
                    <AlertCircle size={12} color="#f87171" />
                    <Text style={styles.statusTextUnlinked}>Ulanmagan</Text>
                  </View>
                )}
              </View>
            </View>
            {!user.telegramChatId && (
              <Text style={styles.telegramInstructions}>
                {TELEGRAM_BOT_MENTION} botini oching va telefon raqamingizni ulashing — real-time hisobotlar va ogohlantirishlar shu chatga keladi.
              </Text>
            )}
          </View>

          {/* Change Password Section */}
          <Text style={styles.sectionTitle}>Xavfsizlik & Parolni yangilash</Text>
          <View style={styles.passwordCard}>
            <View style={styles.inputContainer}>
              <View style={styles.passIcon}>
                <KeyRound size={16} color="#64748b" />
              </View>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="Joriy parol"
                placeholderTextColor="#64748b"
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.passIcon}>
                <KeyRound size={16} color="#64748b" />
              </View>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="Yangi parol"
                placeholderTextColor="#64748b"
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.passIcon}>
                <KeyRound size={16} color="#64748b" />
              </View>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="Yangi parolni tasdiqlash"
                placeholderTextColor="#64748b"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, passwordLoading && styles.saveBtnDisabled]} 
              onPress={handleChangePassword}
              disabled={passwordLoading}
            >
              {passwordLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Parolni yangilash</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#222' 
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  // Profile Card
  profileCard: {
    backgroundColor: '#111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#222',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#111',
  },
  fullName: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 12,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  // Info Group
  sectionTitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  infoGroup: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: 8,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },

  // Telegram Box
  telegramBox: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    marginBottom: 24,
  },
  telegramTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadgeLinked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTextLinked: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '500',
  },
  statusBadgeUnlinked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTextUnlinked: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500',
  },
  telegramInstructions: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 12,
  },

  // Password Card
  passwordCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  passIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    height: 48,
  },
  saveBtn: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
