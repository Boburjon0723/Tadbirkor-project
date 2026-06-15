import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  Modal, 
  Linking,
  Switch,
  ActivityIndicator
} from 'react-native';
import { 
  User, 
  Building2, 
  LayoutGrid, 
  ShieldAlert, 
  KeyRound, 
  Sparkles, 
  Headphones, 
  LogOut, 
  ChevronRight, 
  Shield, 
  X, 
  CheckCircle2, 
  HelpCircle,
  Smartphone,
  Globe,
  Copy
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '../../api/client';
import { useTheme } from '../../theme';
import { MODULE_CATALOG } from '../../config/modules';
import { confirmLogout } from '../../auth/session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TELEGRAM_BOT_URL } from '../../constants/telegram';

export default function MenuScreen({ navigation }: any) {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  const [user, setUser] = useState<any>(null);
  
  // Modal states
  const [activeModal, setActiveModal] = useState<'company' | 'modules' | 'roles' | 'subscription' | 'support' | null>(null);

  // Dynamic modules configuration state
  const [hasFeatureConfig, setHasFeatureConfig] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [togglingModule, setTogglingModule] = useState<string | null>(null);

  // Dynamic roles config state
  const [members, setMembers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleTab, setRoleTab] = useState<'info' | 'team'>('info');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<Record<string, { role: string, warehouseId: string | null }>>({});

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const cachedUser = await AsyncStorage.getItem('user');
      if (cachedUser) {
        setUser(JSON.parse(cachedUser));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFeatures = async () => {
    setModulesLoading(true);
    try {
      const { data } = await api.get('/companies/features');
      setHasFeatureConfig(data.hasFeatureConfig);
      setEnabledModules((data.enabledModules || []).map((m: string) => m.toUpperCase()));
    } catch (error) {
      console.error('Error fetching modules in Menu:', error);
    } finally {
      setModulesLoading(false);
    }
  };

  const handleToggleModule = async (moduleKey: string) => {
    const isCurrentlyEnabled = enabledModules.includes(moduleKey.toUpperCase());
    const nextEnabled = !isCurrentlyEnabled;
    setTogglingModule(moduleKey);
    try {
      const { data } = await api.patch('/companies/features', {
        moduleKey,
        enabled: nextEnabled,
      });
      setHasFeatureConfig(data.hasFeatureConfig);
      setEnabledModules((data.enabledModules || []).map((m: string) => m.toUpperCase()));
      Alert.alert(
        'Muvaffaqiyatli', 
        `"${moduleKey}" moduli muvaffaqiyatli ${nextEnabled ? "yoqildi" : "o'chirildi"}!`
      );
    } catch (error: any) {
      console.error('Error toggling module:', error);
      const msg = error.response?.data?.message || "Modulni o'zgartirishda xatolik yuz berdi";
      Alert.alert('Xatolik', msg);
    } finally {
      setTogglingModule(null);
    }
  };

  const fetchRolesData = async () => {
    setRolesLoading(true);
    try {
      const [membersRes, warehousesRes] = await Promise.all([
        api.get('/users/company'),
        api.get('/warehouses')
      ]);
      const membersData = Array.isArray(membersRes.data) ? membersRes.data : [];
      setMembers(membersData);
      setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : []);
      
      const initialPending: any = {};
      membersData.forEach(m => {
        initialPending[m.id] = {
          role: m.role,
          warehouseId: m.warehouse?.id || null
        };
      });
      setPendingRole(initialPending);
    } catch (e) {
      console.log('Error fetching roles data', e);
    } finally {
      setRolesLoading(false);
    }
  };

  const handleSaveRole = async (membershipId: string) => {
    const pending = pendingRole[membershipId];
    if (!pending) return;

    if (['SALES', 'WAREHOUSE', 'FIELD_WORKER'].includes(pending.role) && !pending.warehouseId) {
      Alert.alert('Xatolik', 'Ushbu rol uchun omborni tanlash majburiy');
      return;
    }

    setUpdatingUser(membershipId);
    try {
      await api.patch(`/users/company/members/${membershipId}/role`, {
        role: pending.role,
        warehouseId: pending.warehouseId,
        grantPermissions: [],
        denyPermissions: []
      });
      Alert.alert('Muvaffaqiyatli', 'Xodim roli yangilandi!');
      await fetchRolesData();
    } catch (e: any) {
      Alert.alert('Xatolik', e.response?.data?.message || "Rolni saqlashda xatolik yuz berdi");
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleLogout = () => {
    confirmLogout(navigation);
  };

  const handleCopyTin = async (tin: string) => {
    try {
      await Clipboard.setStringAsync(tin);
      Alert.alert('Muvaffaqiyatli', 'STIR nusxalandi!');
    } catch (err) {
      console.log('Copy error:', err);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'O';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const menuItems = [
    { title: 'Kompaniya ma\'lumotlari', icon: <Building2 size={18} color={colors.text} />, action: () => setActiveModal('company') },
    { 
      title: 'Tizim modullari', 
      icon: <LayoutGrid size={18} color={colors.text} />, 
      action: () => {
        fetchFeatures();
        setActiveModal('modules');
      } 
    },
    { 
      title: 'Rollar & Huquqlar', 
      icon: <ShieldAlert size={18} color={colors.text} />, 
      action: () => {
        fetchRolesData();
        setActiveModal('roles');
      } 
    },
    { title: 'Xavfsizlik & Parol', icon: <KeyRound size={18} color={colors.text} />, action: () => navigation.navigate('Profile') },
    { title: 'Obuna & Tariflar', icon: <Sparkles size={18} color="#facc15" />, action: () => setActiveModal('subscription') },
    { title: 'Texnik yordam (Support)', icon: <Headphones size={18} color={colors.text} />, action: () => setActiveModal('support') },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menyu</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {user && (
          <TouchableOpacity 
            style={styles.profileCard} 
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <View style={styles.avatarGradient}>
              <Text style={styles.avatarText}>{getInitials(user.fullName)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{user.fullName}</Text>
              <View style={styles.roleBadge}>
                <Shield size={10} color="#3b82f6" />
                <Text style={styles.roleText}>{user.role || 'OWNER'}</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <View style={styles.list}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.menuItem} onPress={item.action}>
              <View style={styles.iconWrapper}>{item.icon}</View>
              <Text style={styles.menuText}>{item.title}</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}

          {/* --- PREMIUM LIGHT/DARK THEME SWITCHER ROW --- */}
          <View style={styles.menuItem}>
            <View style={[styles.iconWrapper, { backgroundColor: isDark ? 'rgba(250, 204, 21, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
              {isDark ? (
                <Sparkles size={18} color="#facc15" />
              ) : (
                <Globe size={18} color="#3b82f6" />
              )}
            </View>
            <Text style={styles.menuText}>Yorug' mavzu (Light theme)</Text>
            <Switch
              value={!isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#222', true: 'rgba(59, 130, 246, 0.2)' }}
              thumbColor={!isDark ? '#3b82f6' : '#64748b'}
            />
          </View>

          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <View style={[styles.iconWrapper, styles.logoutIconWrapper]}>
              <LogOut size={18} color="#ef4444" />
            </View>
            <Text style={[styles.menuText, styles.logoutText]}>Tizimdan chiqish</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* --- COMPANY MODAL --- */}
      <Modal visible={activeModal === 'company'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Building2 size={24} color="#3b82f6" />
              <Text style={styles.modalTitle}>Kompaniya</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Kompaniya nomi</Text>
                <Text style={styles.modalValue}>{user?.companies?.[0]?.company?.name || 'Tadbirkor ERP'}</Text>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Tax ID (STIR)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.modalValue}>{user?.companies?.[0]?.company?.tin || '309 482 110'}</Text>
                  <TouchableOpacity onPress={() => handleCopyTin(user?.companies?.[0]?.company?.tin || '309 482 110')}>
                    <Copy size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Asosiy valyuta</Text>
                <Text style={styles.modalValue}>
                  {user?.companies?.[0]?.company?.currency === 'USD' ? 'AQSH Dollari (USD)' : 'O\'zbek So\'mi (UZS)'}
                </Text>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Ro'yxatdan o'tgan sana</Text>
                <Text style={styles.modalValue}>
                  {user?.companies?.[0]?.company?.createdAt 
                    ? new Date(user.companies[0].company.createdAt).toISOString().split('T')[0] 
                    : '2025-05-12'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- MODULES MODAL --- */}
      <Modal visible={activeModal === 'modules'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <LayoutGrid size={24} color="#3b82f6" />
              <Text style={styles.modalTitle}> ERP Modullari</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              {modulesLoading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#3b82f6" size="large" />
                </View>
              ) : (
                MODULE_CATALOG.map((m) => {
                  const isModuleActive = !hasFeatureConfig || enabledModules.includes(m.id);
                  const isUpdating = togglingModule === m.id;
                  return (
                    <View key={m.id} style={styles.moduleRow}>
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={styles.moduleName}>{m.name}</Text>
                        <Text style={styles.moduleDesc}>{m.desc}</Text>
                      </View>
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#3b82f6" style={{ marginRight: 8 }} />
                      ) : (
                        <Switch
                          value={isModuleActive}
                          onValueChange={() => handleToggleModule(m.id)}
                          trackColor={{ false: '#222', true: 'rgba(59, 130, 246, 0.2)' }}
                          thumbColor={isModuleActive ? '#3b82f6' : '#64748b'}
                        />
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- ROLES MODAL --- */}
      <Modal visible={activeModal === 'roles'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ShieldAlert size={24} color="#3b82f6" />
              <Text style={styles.modalTitle}>Rollar & Huquqlar</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: isDark ? '#111' : '#f1f5f9', borderRadius: 8, padding: 4 }}>
               <TouchableOpacity style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: roleTab === 'info' ? (isDark ? '#222' : '#fff') : 'transparent', borderRadius: 6 }} onPress={() => setRoleTab('info')}>
                 <Text style={{ color: roleTab === 'info' ? colors.text : colors.textSecondary, fontWeight: 'bold', fontSize: 13 }}>Rollar haqida</Text>
               </TouchableOpacity>
               <TouchableOpacity style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: roleTab === 'team' ? (isDark ? '#222' : '#fff') : 'transparent', borderRadius: 6 }} onPress={() => setRoleTab('team')}>
                 <Text style={{ color: roleTab === 'team' ? colors.text : colors.textSecondary, fontWeight: 'bold', fontSize: 13 }}>Jamoa</Text>
               </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              {roleTab === 'info' ? (
                [
                  { role: 'OWNER (Boshqaruvchi)', desc: 'Tizimdagi to\'liq va cheksiz huquqlar. Moliyaviy ko\'rsatkichlar va obunalarni boshqarish.' },
                  { role: 'MANAGER (Menejer)', desc: 'Xodimlarni boshqarish, dala topshiriqlari berish va mahsulotlar katalogini boshqarish.' },
                  { role: 'SALES (Kassir)', desc: 'POS tizimida chakana savdo qilish, qoldiqlarni sotish va chek chiqarish.' },
                  { role: 'FIELD_WORKER (Agent)', desc: 'Mobil ilova orqali topshiriqlarni olish, mijozlar bilan ishlash va ombor zaxirasini ko\'rish.' },
                ].map((r, i) => (
                  <View key={i} style={styles.roleCardDetail}>
                    <Text style={styles.roleTitleText}>{r.role}</Text>
                    <Text style={styles.roleDescText}>{r.desc}</Text>
                  </View>
                ))
              ) : (
                rolesLoading ? (
                  <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} />
                ) : members.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>Xodimlar topilmadi.</Text>
                ) : (
                  members.map(m => {
                    const pending = pendingRole[m.id];
                    const isOwner = m.role === 'OWNER';
                    const needsWarehouse = pending && ['SALES', 'WAREHOUSE', 'FIELD_WORKER'].includes(pending.role);
                    
                    return (
                      <View key={m.id} style={[styles.roleCardDetail, { gap: 8 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View>
                            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 14 }}>{m.user?.fullName}</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>@{m.user?.login}</Text>
                          </View>
                          {isOwner && <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 12 }}>OWNER</Text>}
                        </View>
                        
                        {!isOwner && pending && (
                          <View style={{ marginTop: 8 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 4 }}>Rol</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                              {['MANAGER', 'ACCOUNTANT', 'WAREHOUSE', 'SALES', 'FIELD_WORKER'].map(r => (
                                <TouchableOpacity 
                                  key={r}
                                  style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: pending.role === r ? '#3b82f6' : colors.border, backgroundColor: pending.role === r ? 'rgba(59,130,246,0.1)' : 'transparent' }}
                                  onPress={() => setPendingRole(prev => ({ ...prev, [m.id]: { ...prev[m.id], role: r } }))}
                                >
                                  <Text style={{ color: pending.role === r ? '#3b82f6' : colors.text, fontSize: 10 }}>{r}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {needsWarehouse && (
                              <View style={{ marginTop: 12 }}>
                                <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 4 }}>Ombor (Majburiy)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                  {warehouses.map(w => (
                                    <TouchableOpacity 
                                      key={w.id}
                                      style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: pending.warehouseId === w.id ? '#10b981' : colors.border, backgroundColor: pending.warehouseId === w.id ? 'rgba(16,185,129,0.1)' : 'transparent', marginRight: 6 }}
                                      onPress={() => setPendingRole(prev => ({ ...prev, [m.id]: { ...prev[m.id], warehouseId: w.id } }))}
                                    >
                                      <Text style={{ color: pending.warehouseId === w.id ? '#10b981' : colors.text, fontSize: 10 }}>{w.name}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}

                            {(pending.role !== m.role || pending.warehouseId !== (m.warehouse?.id || null)) && (
                              <TouchableOpacity 
                                style={{ backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 16 }}
                                onPress={() => handleSaveRole(m.id)}
                                disabled={updatingUser === m.id}
                              >
                                {updatingUser === m.id ? (
                                  <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Saqlash</Text>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- SUBSCRIPTION MODAL --- */}
      <Modal visible={activeModal === 'subscription'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Sparkles size={24} color="#facc15" />
              <Text style={styles.modalTitle}>Obuna & Tariflar</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.subCard}>
                <Text style={styles.subCardPlan}>PREMIUM PRO</Text>
                <Text style={styles.subCardStatus}>Faol obuna muddati</Text>
                <Text style={styles.subCardExpiry}>2027-05-26 gacha</Text>
              </View>
              <Text style={styles.subBenefitsTitle}>Tarif imkoniyatlari:</Text>
              {[
                'Cheksiz savdo cheklari va buyurtmalar',
                'Dala xodimlari soni: Cheksiz',
                'Dual-valyutali (UZS/USD) hisobotlar',
                'Avtomatik zaxira nusxalash (Auto-backup)',
                '24/7 Premium qo\'llab-quvvatlash',
              ].map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <CheckCircle2 size={14} color="#facc15" />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* --- SUPPORT MODAL --- */}
      <Modal visible={activeModal === 'support'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Headphones size={24} color="#3b82f6" />
              <Text style={styles.modalTitle}>Qo'llab-quvvatlash</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.supportIntro}>
                Tadbirkor ERP bo'yicha savollaringiz yoki muammolaringiz bormi? Bizning yordam markazimiz har doim sizga ko'maklashishga tayyor.
              </Text>
              
              <TouchableOpacity 
                style={styles.supportActionBtn} 
                onPress={() => Linking.openURL(TELEGRAM_BOT_URL)}
              >
                <Smartphone size={20} color="#FFF" />
                <Text style={styles.supportActionText}>Telegram orqali bog'lanish</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.supportActionBtn, { backgroundColor: '#1e293b', marginTop: 12 }]} 
                onPress={() => Linking.openURL('mailto:support@tadbirkor-erp.uz')}
              >
                <HelpCircle size={20} color="#94a3b8" />
                <Text style={[styles.supportActionText, { color: '#94a3b8' }]}>support@tadbirkor-erp.uz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  // Profile Card Preview
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentBg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBg,
    borderWidth: 0.5,
    borderColor: colors.accentBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  list: { gap: 12 },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.card, 
    padding: 16, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
  logoutItem: { marginTop: 24, borderColor: 'rgba(239, 68, 68, 0.2)' },
  logoutIconWrapper: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  logoutText: { color: colors.danger },

  // Interactive Modal Styles
  modalBg: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
    marginBottom: 16,
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 16,
  },
  modalScrollBody: {
    maxHeight: 400,
  },
  modalField: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  modalLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  modalValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },

  // Modules Modal Rows
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardSecondary,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moduleName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  moduleDesc: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePillText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '900',
  },

  // Roles Card detail
  roleCardDetail: {
    backgroundColor: colors.cardSecondary,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleTitleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  roleDescText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  // Subscription Modal Styles
  subCard: {
    backgroundColor: colors.warning,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  subCardPlan: {
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subCardStatus: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
  },
  subCardExpiry: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  subBenefitsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  benefitText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  // Support Modal Styles
  supportIntro: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  supportActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
  },
  supportActionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
