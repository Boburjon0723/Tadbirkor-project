import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  Animated
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { 
  Home, 
  Package, 
  BarChart3, 
  Menu,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  Users,
  FileSpreadsheet,
  Warehouse,
  MapPin,
  CheckCircle2,
  LayoutGrid,
  BookOpen,
} from 'lucide-react-native';

import OwnerDashboard from './OwnerDashboard';
import WarehouseScreen from './WarehouseScreen';
import ReportsScreen from './ReportsScreen';
import MenuScreen from './MenuScreen';
import { api } from '../../api/client';
import { useTheme } from '../../theme';
import { MODULE_CATALOG } from '../../config/modules';

const Tab = createBottomTabNavigator();
const { width: screenWidth } = Dimensions.get('window');
const DRAWER_WIDTH = 270;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function OwnerMain({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeModulesList, setActiveModulesList] = useState<string[]>([]);
  const [hasFeatureConfig, setHasFeatureConfig] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  /** Tab navigator — drawer modullarini to‘g‘ri tabga o‘tkazish uchun */
  const tabNavRef = useRef<{ navigate: (name: string) => void } | null>(null);

  const captureTabNav = (navigation: { navigate: (name: string) => void }) => ({
    focus: () => {
      tabNavRef.current = navigation;
    },
  });

  // Load enabled modules from the company features API
  const fetchFeatures = async () => {
    try {
      const res = await api.get('/companies/features');
      if (res.data && res.data.hasFeatureConfig) {
        setHasFeatureConfig(true);
        setActiveModulesList((res.data.enabledModules || []).map((m: string) => m.toUpperCase()));
      } else {
        setHasFeatureConfig(false);
      }
    } catch (e) {
      console.error('Error fetching company features:', e);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const isModuleEnabled = (key: string) => {
    if (!hasFeatureConfig) return true; // Default fallback to active if no features configuration is initialized
    return activeModulesList.includes(key.toUpperCase());
  };

  const toggleDrawer = (open: boolean) => {
    setIsDrawerOpen(open);
    if (open) {
      // Re-fetch features on open to ensure real-time accuracy
      fetchFeatures();
    }
    Animated.timing(slideAnim, {
      toValue: open ? 0 : -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  /** Tab ichidagi ekranlar — Stack emas, OwnerMain ichidagi Tab.Navigator */
  const goToOwnerTab = (screen: 'Dashboard' | 'Warehouse' | 'Reports' | 'Menu') => {
    if (tabNavRef.current) {
      tabNavRef.current.navigate(screen);
      return;
    }
    navigation.dispatch(
      CommonActions.navigate({
        name: 'OwnerMain',
        params: { screen },
      }),
    );
  };

  const modules = MODULE_CATALOG.map((item) => ({
    ...item,
    icon:
      item.id === 'POS' ? <ShoppingCart size={16} color="#3b82f6" /> :
      item.id === 'DEBT' ? <Users size={16} color="#3b82f6" /> :
      item.id === 'PARTNER_LEDGER' ? <BookOpen size={16} color="#3b82f6" /> :
      item.id === 'B2B' ? <FileSpreadsheet size={16} color="#3b82f6" /> :
      item.id === 'WAREHOUSE' ? <Warehouse size={16} color="#3b82f6" /> :
      item.id === 'FIELD_SERVICE' ? <MapPin size={16} color="#3b82f6" /> :
      <BarChart3 size={16} color="#3b82f6" />,
    action: () => {
      if (item.id === 'POS') return navigation.navigate('SalesMain');
      if (item.id === 'DEBT') return navigation.navigate('DebtsList');
      if (item.id === 'PARTNER_LEDGER') return navigation.navigate('DebtsList');
      if (item.id === 'B2B') return navigation.navigate('OrdersList');
      if (item.id === 'WAREHOUSE') return goToOwnerTab('Warehouse');
      if (item.id === 'FIELD_SERVICE') return navigation.navigate('FieldMain');
      return goToOwnerTab('Reports');
    },
  }));

  // Filter modules based on what's active in the company feature settings
  const enabledModulesList = modules.filter(m => isModuleEnabled(m.id));

  // Interpolate pull tab position to lock on drawer edge
  const pullTabLeft = slideAnim.interpolate({
    inputRange: [-DRAWER_WIDTH, 0],
    outputRange: [0, DRAWER_WIDTH - 2],
  });

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={OwnerDashboard}
          options={{
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
            tabBarLabel: 'Asosiy',
          }}
          listeners={({ navigation: tabNav }) => captureTabNav(tabNav)}
        />
        <Tab.Screen
          name="Warehouse"
          component={WarehouseScreen}
          options={{
            tabBarIcon: ({ color, size }) => <Warehouse color={color} size={size} />,
            tabBarLabel: 'Ombor',
          }}
          listeners={({ navigation: tabNav }) => captureTabNav(tabNav)}
        />
        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{
            tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
            tabBarLabel: 'Hisobotlar',
          }}
          listeners={({ navigation: tabNav }) => captureTabNav(tabNav)}
        />
        <Tab.Screen
          name="Menu"
          component={MenuScreen}
          options={{
            tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
            tabBarLabel: 'Menyu',
          }}
          listeners={({ navigation: tabNav }) => captureTabNav(tabNav)}
        />
      </Tab.Navigator>

      {/* --- BACKDROP FOR DRAWER --- */}
      {isDrawerOpen && (
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={() => toggleDrawer(false)}
        />
      )}

      {/* --- FLOATING LEFT-SIDE MODULES DRAWER --- */}
      <Animated.View style={[styles.drawer, { left: slideAnim }]}>
        <View style={styles.drawerHeader}>
          <LayoutGrid size={18} color="#3b82f6" />
          <Text style={styles.drawerTitle}>Yoqilgan Modullar</Text>
        </View>
        <ScrollView 
          contentContainerStyle={styles.drawerScroll} 
          showsVerticalScrollIndicator={false}
        >
          {enabledModulesList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Yoqilgan modullar mavjud emas</Text>
            </View>
          ) : (
            enabledModulesList.map((m, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.moduleRow}
                onPress={() => {
                  toggleDrawer(false);
                  m.action();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconBg}>
                  {m.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moduleName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.moduleDesc} numberOfLines={1}>{m.desc}</Text>
                </View>
                <View style={styles.statusPill}>
                  <CheckCircle2 size={10} color="#10b981" />
                  <Text style={styles.statusPillText}>FAOL</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>

      {/* --- PULL TAB FLOATING TRIGGER (VERTICALLY CENTERED ON LEFT EDGE) --- */}
      <AnimatedTouchableOpacity 
        style={[
          styles.pullTab, 
          { left: pullTabLeft }
        ]}
        onPress={() => toggleDrawer(!isDrawerOpen)}
        activeOpacity={0.9}
      >
        {isDrawerOpen ? (
          <ChevronLeft size={16} color="#3b82f6" />
        ) : (
          <ChevronRight size={16} color="#3b82f6" />
        )}
      </AnimatedTouchableOpacity>
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.backdrop,
      zIndex: 990,
    },
    drawer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      backgroundColor: colors.card,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      zIndex: 995,
      paddingTop: 64,
      paddingHorizontal: 16,
    },
    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 16,
      marginBottom: 16,
    },
    drawerTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    drawerScroll: {
      gap: 12,
      paddingBottom: 40,
    },
    moduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cardSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
    },
    iconBg: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: 'bold',
    },
    moduleDesc: {
      color: colors.textSecondary,
      fontSize: 9,
      marginTop: 2,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    statusPillText: {
      color: colors.success,
      fontSize: 8,
      fontWeight: '900',
    },
    pullTab: {
      position: 'absolute',
      top: '48%',
      width: 24,
      height: 48,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 0,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 998,
      shadowColor: colors.primary,
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    emptyContainer: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
    },
  });
}
